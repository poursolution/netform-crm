import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

// Local synthetic rows only. Execute the installed can_deal definition captured by
// the read-only catalog audit, including its actual actor approval rules.
const catalog=JSON.parse(readFileSync(new URL('../review-preview/fixtures/contact-match-functions.json',import.meta.url),'utf8'));
const canDeal=catalog.functions.find(f=>f.name==='can_deal').definition;
const actor=catalog.functions.find(f=>f.name==='actor').definition;
const migration=readFileSync(new URL('../supabase/migrations/20261011082134_contact_match_scoped_read.sql',import.meta.url),'utf8');
const uuid=n=>`00000000-0000-4000-8000-${n.toString(16).padStart(12,'0')}`;
const U=uuid(1),O=uuid(2),ADMIN=uuid(3),BRANCH=uuid(4),AUTH=uuid(101),OTHER_AUTH=uuid(102),ADMIN_AUTH=uuid(103),BRANCH_AUTH=uuid(104);
const D=uuid(201),D2=uuid(202),HIDDEN=uuid(203),S=uuid(301),S2=uuid(302),HS=uuid(303),C=uuid(401),HC=uuid(402);
const PHONE='01012345678';
const fixture=`
create role anon; create role authenticated; create role service_role;
create schema auth; create schema crm_security;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table public.users(user_id uuid primary key,auth_uid uuid,name text,role text,active boolean);
create table public.sites(site_id uuid primary key,site_name text not null,norm_name text not null,address text);
create table public.deals(id uuid primary key,owner_id uuid,contact_id uuid,site_id uuid,person_key text,version integer not null default 1);
create table public.contacts(id uuid primary key,person_key text unique,name text,role text,title text,mobile text,phone text,current_site text,organization_id uuid,emails jsonb);
create table public.contact_assignments(id uuid primary key default gen_random_uuid(),person_key text not null references public.contacts(person_key),opportunity_id uuid,site_name text not null,office_phone text,started_at date not null default current_date,ended_at date,status text,reason text);
create unique index contact_assign_open on public.contact_assignments(person_key,site_name) where ended_at is null;
create table crm_security.access_review(user_id uuid primary key,permission_role text,approved boolean,reviewed_auth_uid uuid,source_role text,expires_at timestamptz);
create table crm_security.object_scope(user_id uuid,deal_id uuid,expires_at timestamptz,can_write boolean);
grant usage on schema public,auth to authenticated,anon,service_role;
`;

test('contact match read uses current authorized links and never writes (local PGlite)',async t=>{
 const db=new PGlite();
 try{
  await db.exec(fixture);await db.exec(actor);await db.exec(canDeal);
  await db.exec('revoke all on function crm_security.actor() from public,anon,authenticated,service_role; revoke all on function crm_security.can_deal(uuid,boolean) from public,anon,authenticated,service_role;');
  await db.exec(migration);
  const login=async(auth=AUTH)=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[auth||'']);
  const read=async(phone=PHONE,page=1,deal=D)=>(await db.query('select public.crm_contact_match_read_v1($1,$2,$3) value',[deal,phone,page])).rows[0].value;
  const contact=async(id,{key='contact:'+id,name='합성 사람',role='담당자',title=null,mobile=PHONE,phone=null,currentSite='비공개 현재 소속',organization=uuid(9000),emails=['private@example.invalid']}={})=>{
   await db.query('insert into public.contacts values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)',[id,key,name,role,title,mobile,phone,currentSite,organization,JSON.stringify(emails)]);return key;
  };
  const deal=async(id,{owner=U,primary=null,site=null,personKey=null,version=7}={})=>db.query('insert into public.deals values($1,$2,$3,$4,$5,$6)',[id,owner,primary,site,personKey,version]);
  const link=async(key,dealId,siteName='연결 '+dealId,ended=null)=>db.query('insert into public.contact_assignments(person_key,opportunity_id,site_name,ended_at,status) values($1,$2,$3,$4,$5)',[key,dealId,siteName,ended,ended?'ended':'current']);
  const reset=async()=>{
   await db.exec('reset role; truncate public.contact_assignments,public.contacts,public.deals,public.sites,public.users,crm_security.access_review,crm_security.object_scope;');
   for(const [user,auth,role] of [[U,AUTH,'rep'],[O,OTHER_AUTH,'rep'],[ADMIN,ADMIN_AUTH,'admin'],[BRANCH,BRANCH_AUTH,'branch']]){
    await db.query('insert into public.users values($1,$2,$3,$4,true)',[user,auth,'합성 '+role,role]);
    await db.query("insert into crm_security.access_review values($1,$2,true,$3,$2,now()+interval '1 day')",[user,role,auth]);
   }
   await db.query('insert into public.sites values($1,$4,$4,null),($2,$4,$4,null),($3,$5,$5,null)',[S,S2,HS,'동명 현장','비공개 현장']);
   await contact(C,{key:'mobile:'+PHONE,name:'보이는 사람'});await contact(HC,{key:'contact:'+HC,name:'비공개 사람'});
   await deal(D,{primary:C,site:S});await deal(D2,{site:S2});await deal(HIDDEN,{owner:O,primary:HC,site:HS});
   await login();
  };

  await t.test('migration repeats without changing helpers, permissions or read-only attributes',async()=>{
   const spec=async()=>(await db.query("select pg_get_functiondef(p.oid) definition,p.provolatile,p.prosecdef,p.proconfig,p.proacl::text acl from pg_proc p where p.oid='public.crm_contact_match_read_v1(uuid,text,integer)'::regprocedure")).rows[0];
   const before=await spec();await db.exec(migration);assert.deepEqual(await spec(),before);
   assert.equal(before.provolatile,'s');assert.equal(before.prosecdef,true);assert.deepEqual(before.proconfig,['search_path=""']);
   assert.match(before.acl,/authenticated=X/);assert.doesNotMatch(before.acl,/(?:anon|service_role)=X|[,{]=X/);
   const definition=(await db.query("select pg_get_functiondef('crm_security.can_deal(uuid,boolean)'::regprocedure) d")).rows[0].d;
   assert.equal(definition,canDeal);
   assert.equal((await db.query("select pg_get_functiondef('crm_security.actor()'::regprocedure) d")).rows[0].d,actor);
  });
  await t.test('target, actor and normalized phone are returned with only documented fields',async()=>{
   await reset();const r=await read(' +82 10-1234-5678 ');
   assert.deepEqual(Object.keys(r).sort(),['contract','actor_auth_uid','actor_user_id','object_id','object_version','phone','scope','page','page_size','total','has_more','candidates'].sort());
   assert.equal(r.contract,'contact-match-read-v1');assert.equal(r.actor_auth_uid,AUTH);assert.equal(r.actor_user_id,U);
   assert.equal(r.object_id,D);assert.equal(r.object_version,7);assert.equal(r.phone,PHONE);assert.equal(r.scope,'authorized_deals_only');
   assert.equal(r.total,1);assert.equal(r.page,1);assert.equal(r.page_size,20);assert.equal(r.has_more,false);
   assert.deepEqual(Object.keys(r.candidates[0]).sort(),['contact_id','person_key','name','role','matched_phone','linked_to_target','links','link_total','links_truncated','can_link'].sort());
   assert.deepEqual(r.candidates[0],{contact_id:C,person_key:'mobile:'+PHONE,name:'보이는 사람',role:'담당자',matched_phone:PHONE,linked_to_target:true,links:[{opportunity_id:D,site_id:S,site_name:'동명 현장'}],link_total:1,links_truncated:false,can_link:false});
  });
  await t.test('unauthorized people and links do not change any visible count or response',async()=>{
   await reset();const before=await read();
   await link('mobile:'+PHONE,HIDDEN,'숨긴 연결');
   await contact(uuid(410),{name:'또 다른 비공개 사람'});await link('contact:'+uuid(410),HIDDEN,'숨긴 연결 2');
   assert.deepEqual(await read(),before);assert.doesNotMatch(JSON.stringify(before),/비공개|private@example/);
  });
  await t.test('primary and repeated historical assignments deduplicate by contact and deal UUID',async()=>{
   await reset();await link('mobile:'+PHONE,D,'기존 연결','2026-01-01');await link('mobile:'+PHONE,D,'또 다른 이력','2026-02-01');
   await link('mobile:'+PHONE,D2,'동명 현장');
   const r=await read();assert.equal(r.total,1);assert.equal(r.candidates[0].link_total,2);
   assert.deepEqual(r.candidates[0].links,[{opportunity_id:D,site_id:S,site_name:'동명 현장'},{opportunity_id:D2,site_id:S2,site_name:'동명 현장'}]);
  });
  await t.test('legacy and nullable person keys retain their UUID identity without name matching',async()=>{
   await reset();const legacy=uuid(420),empty=uuid(421),orphan=uuid(422),nameOnly=uuid(423);
   await contact(legacy,{key:'inquiry:'+legacy,name:'같은 이름'});await link('inquiry:'+legacy,D2,'과거 소속','2026-01-01');
   await contact(empty,{key:null,name:'같은 이름',role:null});await db.query('update public.deals set contact_id=$1 where id=$2',[empty,D2]);
   await contact(orphan);await link('contact:'+orphan,null,'동명 현장');
   await contact(nameOnly,{name:'동명 현장'});await db.query('update public.deals set person_key=$1 where id=$2',['contact:'+nameOnly,D]);
   const r=await read();assert.equal(r.total,3);
   assert.deepEqual(r.candidates.map(c=>c.contact_id),[C,legacy,empty]);
   assert.equal(r.candidates.find(c=>c.contact_id===legacy).person_key,'inquiry:'+legacy);
   assert.equal(r.candidates.find(c=>c.contact_id===empty).person_key,null);assert.equal(r.candidates.find(c=>c.contact_id===empty).role,null);
  });
  await t.test('both phone fields are checked independently and do not duplicate a person',async()=>{
   await reset();await db.query('update public.contacts set mobile=$1,phone=$2 where id=$3',['01099998888','+82 (10) 1234-5678',C]);
   assert.equal((await read()).total,1);assert.equal((await read('01099998888')).total,1);
   await db.query('update public.contacts set mobile=$1 where id=$2',['O10-1234-5678',C]);assert.equal((await read()).total,1);
   await db.query('update public.contacts set mobile=$1,phone=$1 where id=$2',[PHONE,C]);assert.equal((await read()).total,1);
   await db.query('update public.contacts set mobile=$1,phone=$1 where id=$2',['O10-1234-5678',C]);assert.equal((await read()).total,0,'person_key is not a substitute for a valid phone');
  });
  await t.test('malformed or ambiguous phone input and invalid pages fail, not empty-success',async()=>{
   await reset();
   for(const p of [null,'','0101234567','010123456789','O1012345678','전화 01012345678','01012345678 ext 1','01012345678; select 1','+8201012345678','821012345678','01112345678','０１０１２３４５６７８',' '.repeat(65)+PHONE])await assert.rejects(read(p),e=>e.code==='22023');
   for(const p of [null,0,-1])await assert.rejects(read(PHONE,p),e=>e.code==='22023');
   for(const p of ['010-1234-5678',' 010 1234 5678 ','+82-10-1234-5678','010(1234)5678'])assert.equal((await read(p)).phone,PHONE);
   assert.equal((await read(PHONE,2147483647)).candidates.length,0,'large valid pages cannot overflow offset');
  });
  await t.test('twenty-one visible contacts produce two stable pages and unique totals',async()=>{
   await reset();for(let i=0;i<20;i++){const id=uuid(500+i);await contact(id);await link('contact:'+id,D2,'同名 '+i);}
   const p1=await read(),p2=await read(PHONE,2),p3=await read(PHONE,3);
   assert.equal(p1.total,21);assert.equal(p2.total,21);assert.equal(p1.candidates.length,20);assert.equal(p2.candidates.length,1);
   assert.equal(p1.has_more,true);assert.equal(p2.has_more,false);assert.equal(p3.total,21);assert.deepEqual(p3.candidates,[]);
   assert.equal(new Set([...p1.candidates,...p2.candidates].map(c=>c.contact_id)).size,21);assert.deepEqual(await read(),p1);
  });
  await t.test('per-person links are capped at twenty with accurate authorized totals',async()=>{
   await reset();for(let i=0;i<21;i++){const d=uuid(700+i);await deal(d);await link('mobile:'+PHONE,d,'연결 '+i);}
   await link('mobile:'+PHONE,HIDDEN,'숨긴 현장');const r=await read();
   assert.equal(r.total,1);assert.equal(r.candidates[0].link_total,22);assert.equal(r.candidates[0].links.length,20);assert.equal(r.candidates[0].links_truncated,true);
   assert.equal(new Set(r.candidates[0].links.map(l=>l.opportunity_id)).size,20);assert.equal(r.candidates[0].linked_to_target,true);
  });
  await t.test('missing and unauthorized targets return the same forbidden result',async()=>{
   await reset();for(const d of [null,uuid(999),HIDDEN])await assert.rejects(read(PHONE,1,d),e=>e.code==='42501');
   await login(null);await assert.rejects(read(),e=>e.code==='42501');
  });
  await t.test('inactive, unapproved, expired and identity-mismatched actors cannot read',async()=>{
   for(const update of ["update public.users set active=false where user_id=$1","update crm_security.access_review set approved=false where user_id=$1","update crm_security.access_review set expires_at=now()-interval '1 second' where user_id=$1","update crm_security.access_review set reviewed_auth_uid=null where user_id=$1","update crm_security.access_review set source_role='admin' where user_id=$1"]){
    await reset();await db.query(update,[U]);await assert.rejects(read(),e=>e.code==='42501');
   }
   await reset();await db.query('insert into public.users values($1,$2,$3,$4,true)',[uuid(9999),AUTH,'중복 인증','rep']);await assert.rejects(read(),e=>e.code==='42501');
  });
  await t.test('branch read-only scope is sufficient; expiry and write denial are not conflated',async()=>{
   await reset();await login(BRANCH_AUTH);await assert.rejects(read(),e=>e.code==='42501');
   await db.query("insert into crm_security.object_scope values($1,$2,now()+interval '1 day',false)",[BRANCH,D]);
   const r=await read();assert.equal(r.actor_user_id,BRANCH);assert.equal(r.total,1);
   assert.equal((await db.query('select crm_security.can_deal($1,true) value',[D])).rows[0].value,false);
   await db.query("update crm_security.object_scope set expires_at=now()-interval '1 second'");await assert.rejects(read(),e=>e.code==='42501');
  });
  await t.test('admin sees authorized full scope and reassignment revokes rep reads immediately',async()=>{
   await reset();await login(ADMIN_AUTH);const admin=await read();assert.equal(admin.total,2);assert.equal(admin.actor_user_id,ADMIN);
   assert.equal(admin.candidates.find(c=>c.contact_id===HC).linked_to_target,false);
   await login();await db.query('update public.deals set owner_id=$1 where id=$2',[O,D]);await assert.rejects(read(),e=>e.code==='42501');
  });
  await t.test('no site is invented when an authorized deal lacks a site link',async()=>{
   await reset();await db.query('update public.deals set site_id=null where id=$1',[D]);
   assert.deepEqual((await read()).candidates[0].links,[{opportunity_id:D,site_id:null,site_name:null}]);
  });
  await t.test('ACL permits authenticated RPC only, without exposing underlying tables',async()=>{
   await reset();await db.exec('set role authenticated');assert.equal((await read()).total,1);
   await assert.rejects(db.query('select * from public.contacts'),e=>e.code==='42501');
   for(const role of ['anon','service_role']){await db.exec('reset role; set role '+role);await assert.rejects(read(),e=>e.code==='42501');}
   await db.exec('reset role');
  });
  await t.test('reads work in a read-only transaction and leave every fixture row unchanged',async()=>{
   await reset();await link('mobile:'+PHONE,D2,'과거 기록','2026-01-01');
   const snapshot=async()=>{const data={};for(const table of ['public.users','public.sites','public.deals','public.contacts','public.contact_assignments','crm_security.access_review','crm_security.object_scope'])data[table]=(await db.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') value from ${table} t`)).rows[0].value;return data;};
   const before=await snapshot();await db.exec('begin read only');const r=await read();await db.exec('rollback');
   assert.equal(r.total,1);assert.deepEqual(await snapshot(),before);
  });
 }finally{await db.close();}
});
