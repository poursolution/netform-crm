const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const uid='11111111-1111-4111-8111-111111111111',user='22222222-2222-4222-8222-222222222222',owner='33333333-3333-4333-8333-333333333333',other='44444444-4444-4444-8444-444444444444';
const base={op:'create',os_b2c_id:'Q-20261106-0001',handoff_key:'os-b2c:Q-20261106-0001',brand:'POUR공법',site_name:'합성 아파트',contact_name:'합성 고객',phone:'010-0000-0001',address:'합성 주소',work_type:'재도장',message:'합성 문의 내용',channel:'기타',consult_channel:'채널톡',assignee_name:'합성 담당',assigned_at:'2026-11-06 10:00',first_contact:{method:'전화',at:'2026-11-06T01:00:00Z'},dup_group:'DUP1'};
async function fixture(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema crm_security;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table public.users(user_id uuid primary key,auth_uid uuid,name text,role text,active boolean);
 create table crm_security.access_review(user_id uuid,reviewed_auth_uid uuid,source_role text,permission_role text,approved boolean,expires_at timestamptz);
 create table public.inquiries(id uuid primary key default gen_random_uuid(),brand text,site_name text,contact_name text,phone text,address text,work_type text,status text,received_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now(),assigned_to uuid,assigned_at timestamptz,assignee_name text,source_channel text,source text,channel text,inquiry_type text,business_type text,raw jsonb,deal_id uuid,close_reason text,next_action_date date);
 create table public.deals(id uuid primary key default gen_random_uuid(),origin_inquiry_id uuid,stage_code text,outcome text,assignee_name text,next_action_date date,amount bigint,created_at timestamptz default now(),updated_at timestamptz default now());
 create table crm_security.inquiry_contact_logs(id uuid primary key default gen_random_uuid(),inquiry_id uuid,content text,actor_name text,occurred_at timestamptz);
 create table crm_security.inquiry_quote_versions(id uuid primary key default gen_random_uuid(),inquiry_id uuid,version_no int,amount bigint);
 create table crm_security.inquiry_audit_events(event_id bigint generated always as identity,inquiry_id uuid,action text,created_at timestamptz default now());
 create function crm_security.actor() returns table(user_id uuid,auth_uid uuid,display_name text,permission_role text) language sql stable security definer set search_path='' as $$
 select u.user_id,u.auth_uid,u.name,r.permission_role from public.users u join crm_security.access_review r on r.user_id=u.user_id
 where auth.uid() is not null and u.auth_uid=auth.uid() and u.active and r.approved and r.reviewed_auth_uid=u.auth_uid and r.source_role=u.role and r.expires_at>now()$$;
 grant usage on schema public,auth to authenticated,anon,service_role;
 insert into public.users values('${user}','${uid}','합성 접수자','consultation',true),('${owner}',null,'합성 담당','rep',true),('${other}',null,'다른 담당','rep',true);
 insert into crm_security.access_review values('${user}','${uid}','consultation','consultation',true,now()+interval '1 day');
 select set_config('request.jwt.claim.sub','${uid}',false);`);
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261106090000_os_b2c_direct_link.sql'),'utf8'));
 return db;
}
const rpc=async(db,fn,arg)=>(await db.query(`select public.${fn}($1::jsonb) v`,[JSON.stringify(arg)])).rows[0].v;
const count=async(db,t)=>(await db.query('select count(*)::int n from '+t)).rows[0].n;

test('ACL: only an approved logged-in reviewer role can call; tables stay closed',async()=>{
 const db=await fixture();try{
  for(const role of ['anon','service_role']){await db.exec('set role '+role);await assert.rejects(rpc(db,'crm_os_b2c_handoff_v1',base),e=>e.code==='42501');await assert.rejects(rpc(db,'crm_os_b2c_status_v1',[base.os_b2c_id]),e=>e.code==='42501');await db.exec('reset role');}
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select * from crm_security.os_b2c_links'),e=>e.code==='42501');
  await assert.rejects(db.query("insert into public.inquiries(site_name) values('bypass')"),e=>e.code==='42501');
  assert.equal((await db.query('select public.crm_os_b2c_capability_v1() v')).rows[0].v.can_link,true);
  await db.exec('reset role');
  for(const change of ["update crm_security.access_review set permission_role='rep'","update crm_security.access_review set approved=false","update public.users set active=false","update crm_security.access_review set expires_at=now()-interval '1 day'"]){
   await db.exec('begin;'+change+';set local role authenticated');assert.equal((await db.query('select public.crm_os_b2c_capability_v1() v')).rows[0].v.can_link,false);await assert.rejects(rpc(db,'crm_os_b2c_handoff_v1',base),e=>e.code==='42501');await db.exec('rollback');
  }
  assert.equal(await count(db,'public.inquiries'),0);
 }finally{await db.close()}
});

test('handoff: creates once, replays, validates, keeps raw and resolves owner by exact unique name',async()=>{
 const db=await fixture();try{
  await db.exec('set role authenticated');
  const a=await rpc(db,'crm_os_b2c_handoff_v1',base);assert.equal(a.ok,true);assert.equal(a.replayed,false);assert.equal(a.assignee_name,'합성 담당');assert.equal(a.os_b2c_id,base.os_b2c_id);assert.equal(a.crm_status,'접수');assert.ok(!('phone' in a));
  const b=await rpc(db,'crm_os_b2c_handoff_v1',base);assert.equal(b.replayed,true);assert.equal(b.crm_inquiry_id,a.crm_inquiry_id);
  for(const bad of [{...base,handoff_key:'os-b2c:OTHER'},{...base,brand:'없는 브랜드'},{...base,channel:'채널톡'},{...base,phone:'검토본 비공개'},{...base,message:null},{...base,contact_name:'',phone:''},{...base,site_name:' '}])await assert.rejects(rpc(db,'crm_os_b2c_handoff_v1',{...bad,os_b2c_id:bad.handoff_key==='os-b2c:OTHER'?base.os_b2c_id:'Q-20261106-0009',handoff_key:bad.handoff_key==='os-b2c:OTHER'?bad.handoff_key:'os-b2c:Q-20261106-0009'}),e=>e.code==='22023');
  await db.exec('reset role');assert.equal(await count(db,'public.inquiries'),1);assert.equal(await count(db,'crm_security.os_b2c_links'),1);
  const row=(await db.query('select * from public.inquiries')).rows[0];assert.equal(row.assigned_to,owner);assert.equal(row.phone,'01000000001');assert.equal(row.source_channel,'os_b2c');assert.equal(row.channel,'기타');assert.equal(row.raw.os_consult_channel,'채널톡');assert.equal(row.raw.os_dup_group,'DUP1');assert.equal(row.raw.os_first_contact.method,'전화');
  await db.exec('set role authenticated');
  const c=await rpc(db,'crm_os_b2c_handoff_v1',{...base,os_b2c_id:'Q-20261106-0002',handoff_key:'os-b2c:Q-20261106-0002',phone:'010-0000-0002',assignee_name:'없는 사람'});assert.equal(c.assignee_name,'');
  await db.exec('reset role');assert.equal((await db.query("select assigned_to from public.inquiries where phone='01000000002'")).rows[0].assigned_to,null);
 }finally{await db.close()}
});

test('handoff: an open same-phone same-brand inquiry is linked, never overwritten; closed, trashed and old ones are not',async()=>{
 const db=await fixture();try{
  const ins=async(extra)=>(await db.query(`insert into public.inquiries(brand,phone,status,assigned_to,assignee_name,site_name,received_at,close_reason) values($1,$2,$3,$4,$5,$6,$7,$8) returning id`,extra)).rows[0].id;
  const open=await ins(['POUR공법','01000000003','접수',other,'다른 담당','원래 현장',new Date().toISOString(),null]);
  const closed=await ins(['POUR공법','01000000004','접수',null,null,'닫힌 현장',new Date().toISOString(),'배드핏']);
  const trashed=await ins(['POUR공법','01000000005','접수',null,null,'휴지통 현장',new Date().toISOString(),null]);await db.query("insert into crm_security.inquiry_audit_events(inquiry_id,action) values($1,'inquiry_trash')",[trashed]);
  const old=await ins(['POUR공법','01000000006','접수',null,null,'옛 현장',new Date(Date.now()-40*864e5).toISOString(),null]);
  const send=(n,phone)=>rpc(db,'crm_os_b2c_handoff_v1',{...base,os_b2c_id:'Q-1-'+n,handoff_key:'os-b2c:Q-1-'+n,phone});
  await db.exec('set role authenticated');
  const a=await send(1,'010-0000-0003');assert.equal(a.duplicate_of,open);assert.equal(a.crm_inquiry_id,open);
  for(const [n,phone,id] of [[2,'010-0000-0004',closed],[3,'010-0000-0005',trashed],[4,'010-0000-0006',old]]){const r=await send(n,phone);assert.equal(r.duplicate_of,undefined);assert.notEqual(r.crm_inquiry_id,id);}
  await assert.rejects(rpc(db,'crm_os_b2c_owner_change_v1',{os_b2c_id:'Q-1-1',assignee_name:'합성 담당'}),e=>e.code==='PT409');
  await db.exec('reset role');const row=(await db.query('select assigned_to,site_name from public.inquiries where id=$1',[open])).rows[0];assert.equal(row.assigned_to,other);assert.equal(row.site_name,'원래 현장');
 }finally{await db.close()}
});

test('owner change: audited, needs a real unique user, stops at closed or deal-owned inquiries',async()=>{
 const db=await fixture();try{
  await db.exec('set role authenticated');const a=await rpc(db,'crm_os_b2c_handoff_v1',base);
  await assert.rejects(rpc(db,'crm_os_b2c_owner_change_v1',{os_b2c_id:'없는 건',assignee_name:'다른 담당'}),e=>e.code==='PT404');
  await assert.rejects(rpc(db,'crm_os_b2c_owner_change_v1',{os_b2c_id:base.os_b2c_id,assignee_name:'없는 사람'}),e=>e.code==='22023');
  const b=await rpc(db,'crm_os_b2c_owner_change_v1',{os_b2c_id:base.os_b2c_id,assignee_name:'다른 담당'});assert.equal(b.changed,true);assert.equal(b.assignee_name,'다른 담당');
  assert.equal((await rpc(db,'crm_os_b2c_owner_change_v1',{os_b2c_id:base.os_b2c_id,assignee_name:'다른 담당'})).changed,false);
  await db.exec('reset role');assert.equal(await count(db,"crm_security.os_b2c_link_events where action='owner_change'"),1);
  await db.query('insert into public.deals(origin_inquiry_id,stage_code) values($1,$2)',[a.crm_inquiry_id,'consulting']);
  await db.exec('set role authenticated');await assert.rejects(rpc(db,'crm_os_b2c_owner_change_v1',{os_b2c_id:base.os_b2c_id,assignee_name:'합성 담당'}),e=>e.code==='PT409');
  await db.exec('reset role');await db.query('delete from public.deals');await db.query("update public.inquiries set close_reason='배드핏'");
  await db.exec('set role authenticated');await assert.rejects(rpc(db,'crm_os_b2c_owner_change_v1',{os_b2c_id:base.os_b2c_id,assignee_name:'합성 담당'}),e=>e.code==='PT409');
 }finally{await db.close()}
});

test('status: reads only linked ids, up to 50, with deal progress and without customer contact',async()=>{
 const db=await fixture();try{
  await db.exec('set role authenticated');const a=await rpc(db,'crm_os_b2c_handoff_v1',base);
  await db.exec('reset role');
  await db.query("insert into public.inquiries(site_name,phone) values('OS 와 무관한 문의','01099999999')");
  await db.query("insert into public.deals(origin_inquiry_id,stage_code,outcome,assignee_name,next_action_date,amount) values($1,'consulting',null,'합성 담당','2026-11-10',124000000)",[a.crm_inquiry_id]);
  await db.query("insert into crm_security.inquiry_contact_logs(inquiry_id,content,actor_name,occurred_at) values($1,'현장 실측','합성 담당',now())",[a.crm_inquiry_id]);
  await db.exec('set role authenticated');
  const s=await rpc(db,'crm_os_b2c_status_v1',[base.os_b2c_id,'없는 건']);assert.equal(s.items.length,1);const v=s.items[0];
  assert.equal(v.deal_stage,'consulting');assert.equal(v.next_date,'2026-11-10');assert.equal(Number(v.quote_amount),124000000);assert.equal(v.last_note,'현장 실측');assert.ok(v.crm_deal_id);assert.ok(!JSON.stringify(v).includes('0100000'));
  await assert.rejects(rpc(db,'crm_os_b2c_status_v1',Array.from({length:51},(_,i)=>'Q-'+i)),e=>e.code==='22023');
  await assert.rejects(rpc(db,'crm_os_b2c_status_v1',{ids:[]}),e=>e.code==='22023');
 }finally{await db.close()}
});

test('rollback stops calls and keeps every record',async()=>{
 const db=await fixture();try{
  await db.exec('set role authenticated');await rpc(db,'crm_os_b2c_handoff_v1',base);await db.exec('reset role');
  await db.exec(fs.readFileSync(path.join(__dirname,'../sql/os-b2c-direct-link-rollback.sql'),'utf8'));
  await assert.rejects(rpc(db,'crm_os_b2c_handoff_v1',base));assert.equal(await count(db,'public.inquiries'),1);assert.equal(await count(db,'crm_security.os_b2c_links'),1);
 }finally{await db.close()}
});
