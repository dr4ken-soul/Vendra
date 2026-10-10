import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
const raw = fs.readFileSync(".env.local","utf8"); const env={};
for (const line of raw.split("\n")){const t=line.trim(); if(!t||t.startsWith("#"))continue; const i=t.indexOf("="); if(i<0)continue; let v=t.slice(i+1).trim(); const f=v[0]; if((f==="\""||f==="'\''")&&v[v.length-1]===f)v=v.slice(1,-1); env[t.slice(0,i).trim()]=v;}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const { data: users } = await db.auth.admin.listUsers({ perPage: 200 });
const byId = new Map(users.users.map(u=>[u.id,u]));
const emails = ["indarauchiha22@gmail.com","psychothedev@gmail.com","psychoancestor092@gmail.com"];
for (const e of emails) {
  const u = [...byId.values()].find(x=>x.email===e);
  console.log(`\n=== ${e}`);
  if (!u) { console.log("  NOT FOUND"); continue; }
  console.log(`  confirmed: ${Boolean(u.email_confirmed_at)}   provider: ${u.app_metadata?.provider ?? "?"}`);
  console.log(`  last sign in: ${u.last_sign_in_at ?? "never"}`);
  const { data: m } = await db.from("shop_memberships").select("shop_id,role").eq("user_id",u.id);
  for (const mem of m) {
    const { data: s } = await db.from("shops").select("name,currency_code,created_at").eq("id",mem.shop_id).single();
    console.log(`  shop: ${s.name} (${s.currency_code}) created ${String(s.created_at).slice(0,10)}  role ${mem.role}`);
    const { data: d } = await db.from("deals").select("headline,status").eq("shop_id",mem.shop_id);
    console.log(`  deals: ${d.map(x=>x.headline).join(" | ")}`);
    const { data: ev } = await db.from("deal_events").select("event_type,summary").eq("shop_id",mem.shop_id);
    for (const x of ev) console.log(`     ${x.event_type}: ${String(x.summary).slice(0,72)}`);
  }
}
