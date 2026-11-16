const BASE="https://api.ahledger.com/v1", MARKET="forever.normal.alliance.eu";

function summarizeNeutral(regular,commodities){
 const rows=new Map(),variantIds=new Set(),seen=new Set();
 const add=(a,commodity)=>{
  if(!a||!a.item||!Number.isSafeInteger(a.item.id)||a.item.id<=0)return;
  const id=a.item.id,q=a.quantity;
  if((Array.isArray(a.item.bonus_lists)&&a.item.bonus_lists.length)||(Array.isArray(a.item.modifiers)&&a.item.modifiers.length)){variantIds.add(id);return;}
  if(!Number.isSafeInteger(q)||q<=0)return;
  const price=commodity?a.unit_price:a.buyout;
  if(!Number.isSafeInteger(price)||price<=0)return;
  if(Number.isSafeInteger(a.id)){const key=(commodity?'c:':'a:')+a.id;if(seen.has(key))return;seen.add(key);}
  const unit=commodity?price:Math.ceil(price/q);
  if(!Number.isSafeInteger(unit)||unit<=0)return;
  const r=rows.get(id);
  if(r){r.min=Math.min(r.min,unit);r.qty+=q;r.listings++;}else rows.set(id,{id,min:unit,qty:q,listings:1});
 };
 const commodityIds=new Set();
 for(const a of commodities){if(Number.isSafeInteger(a?.item?.id))commodityIds.add(a.item.id);add(a,true);}
 for(const a of regular){if(commodityIds.has(a?.item?.id))continue;add(a,false);}
 return [...rows.values()].filter(r=>!variantIds.has(r.id)&&Number.isSafeInteger(r.qty)).sort((a,b)=>a.id-b.id);
}
let tokenState=null,neutralInFlight=null;
const noStoreError=(error,status=503,retry=300)=>Response.json({error},{status,headers:{"Cache-Control":"no-store","Retry-After":String(retry)}});
async function blizzardToken(env){
 if(tokenState&&tokenState.until>Date.now())return tokenState.value;
 const res=await fetch("https://oauth.battle.net/token",{method:"POST",headers:{"Authorization":"Basic "+btoa(env.BLIZZARD_CLIENT_ID+":"+env.BLIZZARD_CLIENT_SECRET),"Content-Type":"application/x-www-form-urlencoded"},body:"grant_type=client_credentials",signal:AbortSignal.timeout(8000)});
 if(!res.ok)throw Error("Blizzard API authorization failed; check Worker secrets.");
 const token=await res.json();if(typeof token.access_token!=="string"||!Number.isFinite(token.expires_in))throw Error("Unexpected Blizzard OAuth response.");
 tokenState={value:token.access_token,until:Date.now()+Math.max(0,token.expires_in-120)*1000};return tokenState.value;
}
async function neutralData(env,cache,key){
 try{
 const token=await blizzardToken(env);
 const base="https://eu.api.blizzard.com/data/wow/ruleset/2/auctions/117";
 const get=path=>fetch(base+path+"?namespace=dynamic-forever-eu&locale=en_GB",{headers:{"Authorization":"Bearer "+token,"Accept":"application/json"},signal:AbortSignal.timeout(15000)});
 const pair=await Promise.all([get(""),get("/commodities")]);
 if(pair.some(x=>x.status===401||x.status===403)){tokenState=null;return noStoreError("Blizzard authorization failed; verify the API client.",424);}
 if(pair.some(x=>!x.ok))return noStoreError("Blackwater API unavailable (HTTP "+pair.map(x=>x.status).join("/") + ").",503);
 const times=pair.map(x=>Date.parse(x.headers.get("last-modified")||""));
 if(times.some(t=>!Number.isFinite(t)||t>Date.now()+60000||Date.now()-t>7200000)||Math.abs(times[0]-times[1])>3600000)return noStoreError("Blackwater source timestamps are missing, stale or mismatched. Alerts withheld.");
 const [a,b]=await Promise.all(pair.map(x=>x.json()));
 if((a.id!==undefined&&Number(a.id)!==117)||(a.name&&typeof a.name==="string"&&!/blackwater/i.test(a.name))||!Array.isArray(a.auctions)||!Array.isArray(b.auctions))return noStoreError("Unexpected Blackwater response structure. Alerts withheld.");
 const rows=summarizeNeutral(a.auctions,b.auctions);if(!rows.length)return noStoreError("No valid Blackwater listings returned.");
 const ts=Math.min(...times),ttl=Math.min(300,Math.floor((7200000-(Date.now()-ts))/1000));if(ttl<10)return noStoreError("Blackwater snapshot is too old.");
 const response=Response.json({market:"forever.normal.blackwater.eu",house:117,ts,rows},{headers:{"Cache-Control":"public, max-age="+ttl}});
 try{await cache.put(key,response.clone());}catch{}return response;
 }catch(e){return noStoreError(e.message?.includes("authorization")?e.message:"Blackwater source unavailable; retry later.");}
}
async function blackwater(req,env){
 if(!env.BLIZZARD_CLIENT_ID||!env.BLIZZARD_CLIENT_SECRET)return noStoreError("Blackwater setup required: add BLIZZARD_CLIENT_ID and BLIZZARD_CLIENT_SECRET to Cloudflare Worker secrets.",424);
 const key=new Request(new URL("/api/cache/blackwater-v1",req.url).href),cache=caches.default;
 try{const cached=await cache.match(key);if(cached)return cached;}catch{}
 if(!neutralInFlight)neutralInFlight=neutralData(env,cache,key).finally(()=>{neutralInFlight=null});
 return (await neutralInFlight).clone();
}

export default {async fetch(req,env){
 const u=new URL(req.url);
 if(!u.pathname.startsWith("/api/"))return env.ASSETS.fetch(req);
 if(req.method!=="GET")return new Response("Method not allowed",{status:405});
 if(u.pathname==="/api/version")return Response.json({version:"2.6",build:"streamlined-views",market:MARKET},{headers:{"Cache-Control":"no-store"}});
 let path;
 if(u.pathname==="/api/table")path="/pricetable/"+MARKET;
 else if(u.pathname==="/api/table/blackwater")return blackwater(req,env);
 else if(u.pathname==="/api/markets")path="/markets";
 else if(u.pathname==="/api/crafting"){const profession=u.searchParams.get("profession")||"";if(!["Alchemy","Blacksmithing","Cooking","Enchanting","Engineering","First Aid","Fishing","Herbalism","Leatherworking","Mining","Skinning","Tailoring"].includes(profession))return new Response("Invalid profession",{status:400});path="/crafting/"+MARKET+"?all=1&limit=500&profession="+encodeURIComponent(profession);}
 else if(u.pathname==="/api/disenchant")path="/disenchant/"+MARKET+"?format=csv";
 else if(/^\/api\/long\/[1-9]\d{0,9}$/.test(u.pathname))path="/prices/"+MARKET+"/"+u.pathname.split("/").pop()+"?range=30d";
 else if(u.pathname==="/api/names"){const ids=u.searchParams.get("items")||"";if(!/^[1-9]\d{0,9}(,[1-9]\d{0,9}){0,99}$/.test(ids))return new Response("Invalid item IDs",{status:400});path="/tooltip/"+MARKET+"?items="+ids;}
 else if(/^\/api\/item\/[1-9]\d{0,9}$/.test(u.pathname))path="/prices/"+MARKET+"/"+u.pathname.split("/").pop()+"?range=7d";
 else return new Response("Not found",{status:404});
 try{
 const upstream=await fetch(BASE+path,{signal:AbortSignal.timeout(20000),headers:{"Accept":path.startsWith("/pricetable")?"text/plain":path.startsWith("/disenchant")?"text/csv":"application/json"}});
 const headers=new Headers();
 for(const k of ["content-type","cache-control","age","date","etag","retry-after","link"])if(upstream.headers.has(k))headers.set(k,upstream.headers.get(k));
 // Do not store API data in D1 or archive it. Preserve provider caching rules.
 if(!headers.has("cache-control"))headers.set("cache-control","no-store");
 return new Response(upstream.body,{status:upstream.status,headers});
 }catch{return new Response("Market provider unavailable",{status:502,headers:{"cache-control":"no-store"}})}
}};