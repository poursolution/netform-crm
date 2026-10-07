import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {fixture} from './aligo-database-fixture.mjs';
const A='11111111-1111-4111-8111-111111111111',R='22222222-2222-4222-8222-222222222222',O='33333333-3333-4333-8333-333333333333';
const D='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',T='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',I='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
test('activity links: exact markers, both-end ACL, original retention, paging and trash/restore',async()=>{
 const db=new PGlite();try{
  await db.exec(fixture);
  await db.exec(`alter table public.deals add owner_id uuid,add list_name text;
   create table public.inquiries(id uuid primary key,assigned_to uuid,site_name text);
   create table crm_security.inquiry_contact_logs(id uuid primary key,inquiry_id uuid,content text,channel text,actor_name text,occurred_at timestamptz);
   create table crm_security.object_scope(user_id uuid,inquiry_id uuid,expires_at timestamptz,can_write boolean);
   create or replace function crm_security.can_deal(target uuid,writing boolean default false) returns boolean language sql security definer set search_path='' as $$
    select exists(select 1 from crm_security.actor() a join public.deals d on d.id=target where a.permission_role='admin' or d.owner_id=a.user_id)$$;
   create function crm_security.consultation_can_read(target uuid) returns boolean language sql security definer set search_path='' as $$
    select exists(select 1 from crm_security.actor() a join public.inquiries i on i.id=target where a.permission_role='admin' or i.assigned_to=a.user_id)$$;
   insert into public.users values('${A}','${A}','관리자','admin',true),('${R}','${R}','담당','rep',true),('${O}','${O}','다른담당','rep',true);
   insert into crm_security.access_review values('${A}','${A}','admin','admin',true,now()+interval '1 day'),('${R}','${R}','rep','rep',true,now()+interval '1 day'),('${O}','${O}','rep','rep',true,now()+interval '1 day');
   insert into public.deals(id,owner_id,list_name) values('${D}','${R}','원본 현장'),('${T}','${R}','연결 현장');
   insert into public.inquiries values('${I}','${O}','연결 문의');`);
  const sql=readFileSync(new URL('../sql/activity-links-20261007.sql',import.meta.url),'utf8');
  await db.exec(sql);await db.exec(sql);
  const who=async v=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[v]);};
  const read=async(kind,id,after=null)=>(await db.query('select public.crm_activity_links_v1($1::jsonb) r',[JSON.stringify({target_type:kind,target_id:id,after})])).rows[0].r;
  const add=async id=>db.query('insert into public.activities(id,deal_id,detail,type,actor_name,occurred_at) values($1,$2,$3,\'전화\',\'담당\',now())',[id,D,JSON.stringify({note:'통화 완료 [연결 deal:'+T+',deal:'+T+',inq:'+I+']'})]);
  await who(R);await assert.rejects(add('dddddddd-dddd-4ddd-8ddd-dddddddddddd'),/권한/);
  assert.equal((await db.query('select count(*)::int n from public.activities')).rows[0].n,0,'failed link rolls back original insert');
  await who(A);for(let x=1;x<=21;x++)await add('dddddddd-dddd-4ddd-8ddd-'+String(x).padStart(12,'0'));
  assert.equal((await db.query('select count(*)::int n from crm_security.activity_links')).rows[0].n,42,'repeated marker deduplicated');
  await db.exec('set role authenticated');await assert.rejects(db.exec('select * from crm_security.activity_links'),/permission denied/);
  const first=await read('deal',T);assert.equal(first.items.length,20);assert.ok(first.next_cursor);assert.equal(first.items[0].text,'통화 완료');
  assert.equal((await read('deal',T,first.next_cursor)).items.length,1);
  await who(R);assert.equal((await read('deal',T)).items.length,20);await assert.rejects(read('inquiry',I),/forbidden/);
  await who(O);assert.equal((await read('inquiry',I)).items.length,0,'target permission alone never reveals source');
  await who(A);await db.exec(`delete from public.deals where id='${D}'`);
  assert.equal((await read('deal',T)).items.length,0,'trashed source hidden');
  await db.exec(`insert into public.deals(id,owner_id,list_name) values('${D}','${R}','원본 현장')`);
  assert.equal((await read('deal',T)).items.length,20,'restore reuses derived index');
  const original=(await db.query('select detail->>\'note\' note from public.activities limit 1')).rows[0].note;assert.match(original,/\[연결/,'original text retained');
  await db.exec(`update public.activities set detail=jsonb_build_object('note','수정한 원본')`);
  assert.equal((await read('deal',T)).items.length,0,'removed marker removes derived index only');
  assert.equal((await db.query('select count(*)::int n from public.activities')).rows[0].n,21);
  assert.equal((await db.query("select has_function_privilege('anon','public.crm_activity_links_v1(jsonb)','execute') v")).rows[0].v,false);
 }finally{await db.close();}
});
