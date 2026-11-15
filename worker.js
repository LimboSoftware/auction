const BASE="https://api.ahledger.com/v1", MARKET="forever.normal.alliance.eu";
export default {async fetch(req,env){
 const u=new URL(req.url);
 if(!u.pathname.startsWith("/api/"))return env.ASSETS.fetch(req);
 if(req.method!=="GET")return new Response("Method not allowed",{status:405});
 if(u.pathname==="/api/version")return Response.json({version:"2.0",build:"cross-faction-trading",market:MARKET},{headers:{"Cache-Control":"no-store"}});
 let path;
 if(u.pathname==="/api/table")path="/pricetable/"+MARKET;
 else if(u.pathname==="/api/table/horde")path="/pricetable/forever.normal.horde.eu";
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