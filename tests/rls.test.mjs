import { PGlite } from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key, raw_user_meta_data jsonb); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
await db.exec(readFileSync(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222', C='33333333-3333-4333-8333-333333333333';
await db.query(`insert into auth.users values ($1,'{"display_name":"Alice"}'),($2,'{"display_name":"Bob"}'),($3,'{"display_name":"Carol"}')`,[A,B,C]);
const profiles=(await db.query('select * from public.profiles order by display_name')).rows;
let checks=0;
async function as(id,fn){await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`);try{return await fn();}finally{await db.exec('reset role');}}
async function eq(query,expected,label){const result=await db.query(query);assert.equal(result.rows[0].n,expected,label);checks++;console.log('PASS',label);}
async function denied(fn,label){await assert.rejects(fn);checks++;console.log('PASS',label);}
async function save(id,vis,viewers=[],title='Test activity'){return(await db.query(`select public.save_event($1,$2,'tennis','2026-10-20 10:00+08','2026-10-20 11:00+08','Court','Note',$3,$4::uuid[]) as id`,[id,title,vis,viewers])).rows[0].id;}
let privateId,sharedId,publicId;
await as(A,async()=>{
  await db.query('select public.add_contact($1)',[profiles.find(p=>p.id===B).friend_code]);
  privateId=await save(null,'private');sharedId=await save(null,'selected',[B]);publicId=await save(null,'public');
  await eq('select count(*)::int as n from public.events',3,'owner reads all own events');
  await denied(()=>db.query('update public.profiles set friend_code=\'STOLEN\''),'friend codes cannot be edited');
  await denied(()=>save(null,'selected',[C]),'only existing contacts can be selected');
  await denied(()=>save(null,'selected',[]),'empty selected list rejected');
  await denied(()=>db.query(`insert into public.events(owner_id,title,category,starts_at,ends_at) values($1,'Impersonate','tennis',now(),now()+interval '1 hour')`,[B]),'cannot impersonate event owner');
});
await as(B,async()=>{
  await eq('select count(*)::int as n from public.events',2,'selected recipient reads shared and public only');
  await eq(`select count(*)::int as n from public.events where id='${privateId}'`,0,'private activity inaccessible even with known UUID');
  await eq(`with changed as(update public.events set title='Hacked' where id='${sharedId}' returning id) select count(*)::int as n from changed`,0,'recipient cannot edit shared activity');
  await eq(`with removed as(delete from public.events where id='${sharedId}' returning id) select count(*)::int as n from removed`,0,'recipient cannot delete shared activity');
  await denied(()=>save(sharedId,'public'),'save RPC rejects non-owner');
  await denied(()=>db.query(`insert into public.event_shares values($1,$2)`,[privateId,B]),'cannot self-grant private access');
  await eq(`select count(*)::int as n from public.contacts`,0,'cannot read another person contact list');
});
await as(C,async()=>{
  await eq('select count(*)::int as n from public.events',1,'unselected user sees public only');
  await eq(`select count(*)::int as n from public.events where id='${sharedId}'`,0,'direct link does not bypass selected permission');
});
await db.exec('set role anon');
await denied(()=>db.query('select * from public.events'),'signed-out users cannot read activities');
await denied(()=>db.query('select public.add_contact(\'ABCDEFGHIJKL\')'),'signed-out users cannot call contact RPC');
await db.exec('reset role');
await as(A,async()=>{
  await save(sharedId,'private',[]);
  await eq(`select count(*)::int as n from public.event_shares where event_id='${sharedId}'`,0,'changing visibility atomically clears recipients');
});
await as(B,async()=>eq(`select count(*)::int as n from public.events where id='${sharedId}'`,0,'revoked recipient loses read access'));
await as(A,async()=>{
  await save(sharedId,'selected',[B]);
  await db.query('select public.remove_contact($1)',[B]);
  await eq('select count(*)::int as n from public.event_shares',0,'removing contact revokes all designated shares');
  await denied(()=>save(sharedId,'selected',[B]),'removed contact cannot be reselected');
});
await as(B,async()=>eq(`select count(*)::int as n from public.events where id='${sharedId}'`,0,'removed friend cannot read designated activity'));
await as(A,async()=>{
  await denied(()=>db.query(`select public.save_event(null,'Bad','tennis','2026-10-20','2026-10-19','','','private','{}')`),'invalid time rejected at database');
  await db.query('delete from public.events where id=$1',[publicId]);
});
await as(C,async()=>eq('select count(*)::int as n from public.events',0,'deleted public activity disappears for others'));
console.log(`${checks} database checks passed`);await db.close();
