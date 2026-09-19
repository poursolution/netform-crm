import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {fixture} from './aligo-database-fixture.mjs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const migration=read('../supabase/migrations/20260919150000_activity_content_read.sql');
const rollback=read('../sql/activity-content-read/rollback.sql');
const aligo=read('../supabase/migrations/20260919114702_aligo_campaign_worker.sql');
const U='11111111-1111-4111-8111-111111111111',AU='22222222-2222-4222-8222-222222222222';
const D='33333333-3333-4333-8333-333333333333',OTHER='44444444-4444-4444-8444-444444444444';
const A='55555555-5555-4555-8555-555555555555',B='66666666-6666-4666-8666-666666666666';
test('activity content keeps row scope, cursor, ACLs and source data; rollback restores the exact dispatcher',async()=>{
 const db=new PGlite();
 try {
  await db.exec(fixture);
  await db.exec(`alter table public.deals add column owner_id uuid;
   create table crm_security.object_scope(user_id uuid,deal_id uuid,expires_at timestamptz,can_write boolean);
   create or replace function crm_security.can_deal(uuid,boolean) returns boolean language sql stable security definer set search_path='' as $$
    select exists(select 1 from crm_security.actor() a join public.deals d on d.id=$1 where a.permission_role='admin' or (a.permission_role='rep' and d.owner_id=a.user_id) or (a.permission_role='branch' and exists(select 1 from crm_security.object_scope s where s.user_id=a.user_id and s.deal_id=d.id and s.expires_at>now() and (not $2 or s.can_write)))) $$;
   create or replace function public.crm_operational_source_v1(text,uuid,integer) returns jsonb language plpgsql stable security definer set search_path='' as $$
   begin
    if not exists(select 1 from crm_security.actor()) then raise exception 'forbidden' using errcode='42501'; end if;
    if $3 is null or $3 not between 1 and 100 then raise exception 'invalid limit'; end if;
    if $1 <> 'deal_core' then return jsonb_build_object('delegated',$1); end if;
    return jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'activity_signals',coalesce((select jsonb_agg(jsonb_build_object('id',ac.id,'type',ac.type,'occurred_at',ac.occurred_at) order by ac.id) from public.activities ac where ac.deal_id=d.id),'[]'::jsonb)) order by d.id) from (select * from public.deals where crm_security.can_deal(id,false) and ($2 is null or id>$2) order by id limit $3) d),'[]'::jsonb),'pagination',jsonb_build_object('next_cursor',$2,'fixture',true));
   end $$;`);
  await db.exec(aligo);
  await db.query("insert into public.users values($1,$2,'reader','admin',true)",[U,AU]);
  await db.query("insert into crm_security.access_review values($1,$2,'admin','admin',true,now()+interval '1 day')",[U,AU]);
  await db.query('insert into public.deals(id,owner_id) values($1,$2),($3,null)',[D,U,OTHER]);
  await db.query("insert into crm_security.object_scope values($1,$2,now()+interval '1 day',false)",[U,OTHER]);
  await db.query("insert into public.activities(id,deal_id,actor_name,type,detail,occurred_at) values($1,$2,'sender','문자',$3::jsonb,now()),($4,$5,'other','전화',$6::jsonb,now())",[A,D,JSON.stringify({note:'예약 문자 발송',result:'검증용 본문',provider_message_id:'private-metadata'}),B,OTHER,JSON.stringify('legacy text')]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[AU]);
  const query=async(domain='deal_core',cursor=null,limit=100)=>(await db.query('select public.crm_operational_source_v1($1,$2,$3) result',[domain,cursor,limit])).rows[0].result;
  const signature=async()=> (await db.query("select oid,proacl,proconfig,prosrc,proowner from pg_proc where oid='public.crm_operational_source_v1(text,uuid,integer)'::regprocedure")).rows[0];
  const before=await signature(),baseline=await query();
  await db.exec(migration);
  const after=await signature();for(const k of ['oid','proacl','proconfig','proowner'])assert.deepEqual(after[k],before[k]);
  await db.exec('set role authenticated');
  const enriched=await query();assert.deepEqual(enriched.pagination,baseline.pagination);
  assert.deepEqual(enriched.items.map(x=>x.id),baseline.items.map(x=>x.id));
  assert.equal(enriched.items[0].activity_signals[0].note,'예약 문자 발송');
  assert.equal(enriched.items[0].activity_signals[0].result,'검증용 본문');
  assert.equal(enriched.items[0].activity_signals[0].actor_name,'sender');
  assert.equal(enriched.items[1].activity_signals[0].note,'legacy text');
  assert.equal(enriched.items[0].activity_signals[0].provider_message_id,undefined);
  assert.deepEqual(await query('inquiry_core'),{delegated:'inquiry_core'});
  assert.deepEqual(await query('asq_project'),{delegated:'asq_project'});
  assert.deepEqual((await query('deal_core',D,1)).items.map(x=>x.id),[OTHER]);
  assert.equal((await query('campaign_core')).items.length,0);
  await assert.rejects(query('deal_core',null,101),/invalid limit/);
  await assert.rejects(db.query('select crm_security.crm_activity_content_enrich_v1($1)',[JSON.stringify(enriched)]),/permission denied/);
  for(const role of ['rep','branch','consultation']){
   await db.exec('reset role');await db.query('update crm_security.access_review set permission_role=$1',[role]);await db.exec('set role authenticated');
   assert.deepEqual((await query()).items.map(x=>x.id),role==='consultation'?[]:role==='branch'?[OTHER]:[D]);
  }
  await db.exec("reset role; update crm_security.access_review set permission_role='branch'; update crm_security.object_scope set expires_at=now()-interval '1 day'; set role authenticated");
  assert.deepEqual((await query()).items,[]);
  await db.exec('reset role; update crm_security.access_review set approved=false; set role authenticated');
  await assert.rejects(query(),/forbidden/);
  await db.exec('reset role; set role anon');await assert.rejects(query(),/permission denied/);
  await db.exec('reset role');
  // Even a malformed internal page cannot attach another Deal's activity content.
  await db.exec("update crm_security.access_review set approved=true,permission_role='rep'");
  const forged={items:[{id:D,activity_signals:[{id:B}]},{id:OTHER,activity_signals:[{id:B}]}],pagination:{}};
  assert.deepEqual((await db.query('select crm_security.crm_activity_content_enrich_v1($1) result',[JSON.stringify(forged)])).rows[0].result,forged);
  assert.equal((await db.query('select count(*)::int n from public.activities')).rows[0].n,2);
  assert.equal((await db.query('select detail->>\'result\' body from public.activities where id=$1',[A])).rows[0].body,'검증용 본문');
  await db.exec(rollback);assert.deepEqual(await signature(),before);
 } finally {await db.close();}
});

test('drift aborts atomically without adding a helper or changing the dispatcher',async()=>{
 const db=new PGlite();try{await db.exec(fixture);const before=(await db.query("select pg_get_functiondef('public.crm_operational_source_v1(text,uuid,integer)'::regprocedure) f")).rows[0].f;
  await assert.rejects(db.exec(migration),/definition drift/);await db.exec('rollback');
  assert.equal((await db.query("select pg_get_functiondef('public.crm_operational_source_v1(text,uuid,integer)'::regprocedure) f")).rows[0].f,before);
  assert.equal((await db.query("select to_regprocedure('crm_security.crm_activity_content_enrich_v1(jsonb)') helper")).rows[0].helper,null);
 }finally{await db.close();}
});
