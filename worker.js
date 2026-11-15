// Cloudflare Worker: hourly EU Normal Alliance commodity scanner.
const URLBASE="https://eu.api.blizzard.com/data/wow/ruleset/2/auctions/111/commodities?namespace=dynamic-forever-eu";
const json=(x,status=200)=>Response.json(x,{status,headers:{"Cache-Control":"no-store"}});
async function scan(env){
 if(!env.BLIZZARD_CLIENT_ID||!env.BLIZZARD_CLIENT_SECRET)throw Error("Missing Blizzard credentials");
 const token=await fetch("https://oauth.battle.net/token",{method:"POST",headers:{Authorization:"Basic "+btoa(env.BLIZZARD_CLIENT_ID+":"+env.BLIZZARD_CLIENT_SECRET),"Content-Type":"application/x-www-form-urlencoded"},body:"grant_type=client_credentials"});
 if(!token.ok)throw Error("OAuth HTTP "+token.status);
 const {access_token}=await token.json();
 const res=await fetch(URLBASE,{headers:{Authorization:"Bearer "+access_token}});
 if(!res.ok)throw Error("Auction HTTP "+res.status);
 const stamp=Date.parse(res.headers.get("last-modified")||"");
 if(!Number.isFinite(stamp)||stamp>Date.now()+60000||Date.now()-stamp>86400000)throw Error("Missing or stale source timestamp");
 const body=await res.json();if(!Array.isArray(body.auctions)||!body.auctions.length)throw Error("Empty or unexpected auction response");
 const grouped=new Map();
 for(const a of body.auctions){const id=a.item?.id,p=a.unit_price,q=a.quantity;if(!Number.isSafeInteger(id)||!Number.isSafeInteger(p)||p<=0||!Number.isSafeInteger(q)||q<=0)continue;let x=grouped.get(id);if(!x){x=new Map();grouped.set(id,x)}x.set(p,(x.get(p)||0)+q)}
 if(!grouped.size)throw Error("No valid commodities");
 const existing=await env.DB.prepare("SELECT stamp FROM scans WHERE stamp=?").bind(stamp).first();if(existing)return {stamp,duplicate:true};
 const rows=[];
 for(const [id,book] of grouped){const sorted=[...book].sort((a,b)=>a[0]-b[0]),total=sorted.reduce((s,x)=>s+x[1],0);let cum=0,reference=sorted[0][0];for(const [p,q] of sorted){cum+=q;reference=p;if(cum>=Math.ceil(total*.15))break}rows.push([id,sorted[0][0],sorted[0][1],reference,total]);}
 // Store one atomic scan as a compact JSON document, avoiding thousands of D1 writes.
 await env.DB.batch([env.DB.prepare("INSERT OR IGNORE INTO scans(stamp, payload) VALUES (?,?)").bind(stamp,JSON.stringify(rows)),env.DB.prepare("DELETE FROM scans WHERE stamp < ?").bind(Date.now()-30*86400000)]);
 return {stamp,items:rows.length};
}
export default{
 async scheduled(event,env,ctx){ctx.waitUntil(scan(env))},
 async fetch(request,env){const u=new URL(request.url);if(u.pathname==="/api/status"){const r=await env.DB.prepare("SELECT MAX(stamp) AS latest, COUNT(*) AS scans FROM scans").first();return json({market:"eu-normal-alliance",...r})}
 if(u.pathname==="/api/history"){const result=await env.DB.prepare("SELECT stamp,payload FROM scans WHERE stamp>=? ORDER BY stamp").bind(Date.now()-7*86400000).all();return json({market:"eu-normal-alliance",source:"Blizzard",rows:result.results.map(r=>[r.stamp,JSON.parse(r.payload)])})}
 return env.ASSETS.fetch(request)}
};
