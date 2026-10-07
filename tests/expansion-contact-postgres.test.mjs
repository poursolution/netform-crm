import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {PGlite} from '@electric-sql/pglite';import {fixture} from './aligo-database-fixture.mjs';
const U='11111111-1111-4111-8111-111111111111',A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',C='cccccccc-cccc-4ccc-8ccc-cccccccccccc',S='dddddddd-dddd-4ddd-8ddd-dddddddddddd',R='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
test('expansion contact atomically links same-site originals, retries exactly and preserves source history',async()=>{
 const db=new PGlite();try{
 await db.exec(fixture);await db.exec(`
 insert into public.users values('${U}','${U}','관리자','admin',true);insert into crm_security.access_review values('${U}','${U}','admin','admin',true,now()+interval '1 day');
 alter table public.deals add outcome text default 'won',add stage_code text default 'won',add lifecycle_status text default 'closed',add site_id uuid;
 create table crm_security.object_scope(user_id uuid,deal_id uuid);
 create table crm_security.expansion_pool(source_deal_id uuid primary key,site_id uuid,expansion_status text,next_contact_at date,version int default 1);
 create table crm_security.expansion_pool_events(event_id uuid primary key default gen_random_uuid(),request_id uuid,source_deal_id uuid,kind text,note text,before_status text,after_status text,before_next_contact_at date,after_next_contact_at date,actor_auth_uid uuid,actor_user_id uuid,actor_name text,occurred_at timestamptz);
 create table crm_security.audit_events(event_id uuid default gen_random_uuid(),actor_auth_uid uuid,actor_user_id uuid,actor_name text,deal_id uuid,action text,before_data jsonb,after_data jsonb,reason text,created_at timestamptz);
 alter table crm_security.command_receipts drop constraint command_receipts_operation_check;
 insert into public.deals(id) values('${A}'),('${B}'),('${C}');insert into crm_security.expansion_pool(source_deal_id,site_id,expansion_status) values('${A}','${S}','접촉 예정'),('${B}','${S}','접촉 예정'),('${C}','${C}','접촉 예정');
 create function public.crm_expansion_context(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$ begin if not crm_security.can_deal((p->>'source_opportunity_id')::uuid,false) then raise exception 'forbidden' using errcode='42501';end if;return jsonb_build_object('ok',true,'events','[]'::jsonb,'dispatches','[]'::jsonb);end $$;
 `);
 const original=readFileSync(new URL('../sql/expansion-note-context/20260906/helper.sql',import.meta.url),'utf8');await db.exec(original.slice(original.indexOf('CREATE FUNCTION public.crm_expansion_note'),original.indexOf('REVOKE EXECUTE ON FUNCTION public.crm_expansion_note')));
 await db.exec('update public.deals d set site_id=p.site_id from crm_security.expansion_pool p where p.source_deal_id=d.id');
 const sql=readFileSync(new URL('../sql/expansion-contact-links-20261007.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[U]);
 const write=async p=>(await db.query('select public.crm_expansion_contact_write_v1($1) r',[JSON.stringify(p)])).rows[0].r;
 const p={source_opportunity_id:A,request_id:R,note:'한 번 통화 원문',target_ids:[B,B]};
 await assert.rejects(write({...p,target_ids:[B,C]}),/same site/);
 assert.equal((await db.query('select count(*)::int n from crm_security.expansion_pool_events')).rows[0].n,0);
 await db.exec("create function crm_security.fail_link_test() returns trigger language plpgsql as $$ begin raise exception 'link insert failed';end $$;create trigger fail_link before insert on crm_security.expansion_contact_links for each row execute function crm_security.fail_link_test();");
 await assert.rejects(write(p),/link insert failed/);assert.equal((await db.query('select count(*)::int n from crm_security.expansion_pool_events')).rows[0].n,0);assert.equal((await db.query('select count(*)::int n from crm_security.command_receipts')).rows[0].n,0);
 await db.exec('drop trigger fail_link on crm_security.expansion_contact_links');
 const ack=await write(p);assert.equal(ack.linked_count,1);assert.equal(ack.event.note,p.note);assert.equal((await write(p)).replayed,true);
 await assert.rejects(write({...p,target_ids:[]}),/REQUEST_ID_REUSE/);
 assert.equal((await db.query('select count(*)::int n from crm_security.expansion_pool_events')).rows[0].n,1);
 const read=async()=>(await db.query('select public.crm_expansion_contact_context_v1($1) r',[JSON.stringify({source_opportunity_id:B})])).rows[0].r;
 assert.equal((await read()).events[0].note,p.note);assert.equal((await read()).events[0].original_event_id,ack.event.id);
 await db.exec(`delete from public.deals where id='${A}'`);assert.equal((await read()).events.length,0);await db.exec(`insert into public.deals(id) values('${A}')`);assert.equal((await read()).events.length,1);
 const single=await write({...p,request_id:'ffffffff-ffff-4fff-8fff-fffffffffffa',target_ids:[]});assert.equal(single.linked_count,0);
 await assert.rejects(write({...p,request_id:'ffffffff-ffff-4fff-8fff-fffffffffffb'}),/site mapping changed/);
 await db.exec(`create or replace function crm_security.can_deal(uuid,boolean) returns boolean language sql stable as $$ select $1='${B}'::uuid $$;`);assert.equal((await read()).events.length,0);
 await assert.rejects(write({...p,request_id:'ffffffff-ffff-4fff-8fff-ffffffffffff'}),/forbidden/);
 await db.exec('set role authenticated');await assert.rejects(db.exec('select * from crm_security.expansion_contact_links'),/permission denied/);await db.exec('reset role');
 assert.equal((await db.query("select has_function_privilege('anon','public.crm_expansion_contact_write_v1(jsonb)','execute') v")).rows[0].v,false);
 }finally{await db.close();}
});
