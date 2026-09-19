const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite'),{create}=require('../inquiry-create-client.js');
const uid='11111111-1111-4111-8111-111111111111',user='22222222-2222-4222-8222-222222222222',request='33333333-3333-4333-8333-333333333333',id='44444444-4444-4444-8444-444444444444';
const payload={brand:'POUR솔루션',site_name:'합성 문의 현장',contact_name:'합성 문의자',phone:'010-0000-0000',address:'',work_type:'옥상 방수',message:'합성 데이터 등록 검증',channel:'전화'};
const ack={ok:true,contract_version:1,operation:'inquiry_manual_create',request_id:request,inquiry_id:id,actor_auth_uid:uid,actor_user_id:user,status:'접수',assigned_to:null,replayed:false,server_at:'2026-09-20T00:00:00Z'};
function fixture(options={}){const m=new Map();let calls=0;const config={profile:()=>({auth_uid:uid,user_id:user}),storage:{getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)},rpc:async()=>{calls++;return ack},readback:async()=>true,uuid:()=>request,...options};return {config,m,get calls(){return calls},client:create(config)};}
test('client retains request on uncertain response and reuses it after reload',async()=>{let calls=[];const f=fixture({rpc:async(n,a)=>{calls.push(a);if(calls.length===1)throw Error('offline');return ack}});await assert.rejects(f.client.submit(payload),/offline/);assert.equal(f.m.size,1);const next=create(f.config);await next.submit({...payload,message:'changed draft must not replace uncertain request'});assert.deepEqual(calls[0],calls[1]);assert.equal(f.m.size,0);});
test('client reads back before clearing receipt; read retry performs no second write',async()=>{let readable=false;const f=fixture({readback:async()=>readable});await assert.rejects(f.client.submit(payload),/READBACK_PENDING/);assert.equal(f.calls,1);assert.ok(f.client.pending().ack);readable=true;await create(f.config).submit(payload);assert.equal(f.calls,1);assert.equal(f.m.size,0);});
test('client rejects forged ACK, identity changes, concurrent clicks, and storage failure',async()=>{
 const f=fixture({rpc:async()=>({...ack,actor_auth_uid:id})});await assert.rejects(f.client.submit(payload),/INVALID_ACK/);assert.equal(f.m.size,1);
 let resolve;const g=fixture({rpc:()=>new Promise(r=>resolve=r)});const first=g.client.submit(payload);await assert.rejects(g.client.submit(payload),/BUSY/);
 resolve(ack);await first;
 let current=uid;const h=fixture({profile:()=>({auth_uid:current,user_id:user}),rpc:async()=>{current=id;return ack}});await assert.rejects(h.client.submit(payload),/IDENTITY_CHANGED/);assert.equal(h.m.size,1);
 const j=fixture({storage:{getItem:()=>null,setItem:()=>{throw Error('quota')},removeItem:()=>{}}});await assert.rejects(j.client.submit(payload),/quota/);assert.equal(j.calls,0);
});
test('client validates fields before writing and fails closed on invalid cached request',async()=>{const f=fixture();await assert.rejects(f.client.submit({...payload,assigned_to:user}),/INVALID_FIELDS/);await assert.rejects(f.client.submit({...payload,phone:'abc'}),/INVALID_PHONE/);assert.equal(f.calls,0);f.m.set('manual-inquiry-pending-v1','{}');await assert.rejects(f.client.submit(payload),/PENDING_INVALID/);assert.equal(f.calls,0);});

test('Postgres manual intake: ACL, actual actor checks, idempotency, atomic failure, preservation',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema crm_security;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table public.users(user_id uuid primary key,auth_uid uuid,name text,role text,active boolean);
 create table crm_security.access_review(user_id uuid,reviewed_auth_uid uuid,source_role text,permission_role text,approved boolean,expires_at timestamptz);
 create table public.inquiries(id uuid primary key default gen_random_uuid(),brand text,site_name text,contact_name text,phone text,address text,work_type text,status text,received_at timestamptz,created_at timestamptz,updated_at timestamptz,assigned_to uuid,assigned_at timestamptz,assignee_name text,source_channel text,source text,channel text,inquiry_type text,business_type text,raw jsonb);
 create function crm_security.actor() returns table(user_id uuid,auth_uid uuid,display_name text,permission_role text) language sql stable security definer set search_path='' as $$
 select u.user_id,u.auth_uid,u.name,r.permission_role from public.users u join crm_security.access_review r on r.user_id=u.user_id
 where auth.uid() is not null and u.auth_uid=auth.uid() and u.active and r.approved and r.reviewed_auth_uid=u.auth_uid and r.source_role=u.role and r.expires_at>now()
 and (select count(*) from public.users x where x.auth_uid=u.auth_uid)=1$$;
 create function crm_security.can_inquiry(target uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.inquiries i,crm_security.actor() a where i.id=target and a.permission_role='admin')$$;
 grant usage on schema public,auth to authenticated,anon,service_role;
 insert into public.users values('${user}','${uid}','합성 관리자','admin',true);
 insert into crm_security.access_review values('${user}','${uid}','admin','admin',true,now()+interval '1 day');
 select set_config('request.jwt.claim.sub','${uid}',false);`);
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20260920043000_manual_inquiry_create.sql'),'utf8'));
 const call=async(p=payload,r=request)=>(await db.query('select public.crm_inquiry_manual_create_v1($1::uuid,$2::jsonb) result',[r,JSON.stringify(p)])).rows[0].result;
 const count=async table=>(await db.query('select count(*)::int n from '+table)).rows[0].n;
 for(const role of ['anon','service_role']){await db.exec('set role '+role);await assert.rejects(call(),e=>e.code==='42501');await db.exec('reset role');}
 await db.exec('set role authenticated');await assert.rejects(db.query('select * from crm_security.manual_inquiry_receipts'),e=>e.code==='42501');await assert.rejects(db.query('insert into public.inquiries(site_name) values(\'bypass\')'),e=>e.code==='42501');
 assert.equal((await db.query('select public.crm_inquiry_manual_capability_v1() v')).rows[0].v.can_create,true);
 const created=await call();assert.equal(created.replayed,false);assert.equal((await call()).inquiry_id,created.inquiry_id);assert.equal((await call()).replayed,true);
 await assert.rejects(call({...payload,message:'different'}),e=>e.code==='PT409');
 for(const p of [{...payload,assigned_to:user},{...payload,brand:'unknown'},{...payload,message:null},{...payload,phone:'abc'},{...payload,contact_name:'',phone:''}])await assert.rejects(call(p,id),e=>e.code==='22023');
 await db.exec('reset role');assert.equal(await count('public.inquiries'),1);assert.equal(await count('crm_security.manual_inquiry_receipts'),1);
 const row=(await db.query('select * from public.inquiries')).rows[0];assert.equal(row.assigned_to,null);assert.equal(row.status,'접수');assert.equal(row.phone,'01000000000');assert.equal(row.raw.manual_actor_user_id,user);
 for(const change of ["update crm_security.access_review set permission_role='rep'","update crm_security.access_review set permission_role='branch'","update crm_security.access_review set permission_role='consultation'","update crm_security.access_review set approved=false","update public.users set active=false","update crm_security.access_review set expires_at=now()-interval '1 day'","update crm_security.access_review set source_role='rep'"]){
  await db.exec('begin;'+change+';set local role authenticated');assert.equal((await db.query('select public.crm_inquiry_manual_capability_v1() v')).rows[0].v.can_create,false);await assert.rejects(call(),e=>e.code==='42501');await db.exec('rollback');
 }
 await db.exec("create or replace function crm_security.can_inquiry(target uuid) returns boolean language sql stable security definer set search_path='' as $$select false$$");await assert.rejects(call(payload,id),e=>e.code==='42501');assert.equal(await count('public.inquiries'),1);assert.equal(await count('crm_security.manual_inquiry_receipts'),1);
 await db.exec(fs.readFileSync(path.join(__dirname,'../sql/manual-inquiry-create-rollback.sql'),'utf8'));assert.equal(await count('public.inquiries'),1);assert.equal(await count('crm_security.manual_inquiry_receipts'),1);
 }finally{await db.close()}
});

