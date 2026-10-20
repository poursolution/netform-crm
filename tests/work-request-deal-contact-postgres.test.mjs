// 영업건 요청 항목별 처리(crm_work_request_deal_contact_v1) — 실제 Postgres(PGlite)에서 실제 SQL 파일로 검사 (2026-10-20 모바일 v5)
import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {fixture} from './aligo-database-fixture.mjs';
const sql=f=>readFileSync(new URL('../sql/'+f,import.meta.url),'utf8');
const id=n=>'20000000-0000-4000-8000-'+String(n).padStart(12,'0');
const owner=id(1),admin=id(2),other=id(3),deal=id(10),request=id(20),act=id(40),miss=id(41);
let db,due,n=100;
const as=async actor=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[actor]);await db.exec('set role authenticated');};
const call=async p=>(await db.query('select public.crm_work_request_deal_contact_v1($1::jsonb) r',[JSON.stringify(p)])).rows[0].r;
const op=()=>id(++n);
const row=async()=>{await db.exec('reset role');const r=(await db.query('select status,result,next_text,next_due::text,reply_note,closed_at from crm_security.work_requests where id=$1',[request])).rows[0];await as(owner);return r;};
const activity=async(meaningful,by='담당',ago="0 hours")=>{await db.exec('reset role');await db.query(`delete from public.activities where id=$1`,[act]);await db.query(`insert into public.activities(id,deal_id,actor_name,type,detail,occurred_at) values($1,$2,$3,'전화',jsonb_build_object('note','통화','meaningful_contact',$4::boolean),now()-$5::interval)`,[act,deal,by,meaningful,ago]);await as(owner);};
const ask=async asks=>{await db.exec('reset role');await db.query(`update crm_security.work_requests set asks=$2::jsonb where id=$1`,[request,JSON.stringify(asks)]);await as(owner);};
before(async()=>{
 db=new PGlite();await db.exec(fixture);
 await db.exec(`alter table public.users add column created_at timestamptz default now();alter table public.users add column email text;alter table public.activities add column actor_email text;
 create table crm_security.sales_directors(name text,active boolean);
 create or replace function crm_security.can_deal(uuid,boolean) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from crm_security.actor()) $$;
 insert into public.users(user_id,auth_uid,name,role,active) values('${owner}','${owner}','담당','rep',true),('${admin}','${admin}','관리자','admin',true),('${other}','${other}','다른 담당','rep',true);
 insert into crm_security.access_review values('${owner}','${owner}','rep','rep',true,now()+interval '1 day'),('${admin}','${admin}','admin','admin',true,now()+interval '1 day'),('${other}','${other}','rep','rep',true,now()+interval '1 day');
 insert into public.deals(id) values('${deal}');`);
 await db.exec(sql('work-request-v1-20261005.sql'));
 /* 요청 기록 표 = 운영과 같은 정의(20261009215629_request_compound_contact.sql 의 create table 그대로) */
 const ddl=sql('20261009215629_request_compound_contact.sql'),s=ddl.indexOf('create table if not exists crm_security.work_request_objective_events');await db.exec(ddl.slice(s,ddl.indexOf(');',s)+2));
 await db.exec(sql('work-request-deal-contact-v1-20261020.sql'));
 await db.exec(sql('work-request-deal-contact-v1-20261020.sql'));
 due=(await db.query("select ((now() at time zone 'Asia/Seoul')::date+2)::text d")).rows[0].d;
});
beforeEach(async()=>{
 await db.exec(`reset role;truncate crm_security.work_request_objective_events,crm_security.work_requests;
 insert into crm_security.work_requests(id,target_type,target_id,kind,label,to_scope,to_user_id,to_name,asks,due_at,requested_by_user_id,requested_by_name)
 values('${request}','deal','${deal}','first','첫 연락 요청','user','${owner}','담당','["고객 첫 연락","연락 후 견적 필요 여부 확인","현장방문 필요 여부 확인"]',now()+interval '3 hours','${admin}','관리자');`);
 await as(owner);
});
after(async()=>{await db?.close();});

test('부재 = 진행 중 · 연락 시도 n회 · 미연결 (요청자 화면 문구)',async()=>{
 await activity(false);
 let a=await call({id:request,operation_id:op(),activity_id:act,result:'부재',confirmed:[]});
 assert.equal(a.request_complete,false);assert.equal(a.attempt,true);
 let r=await row();assert.equal(r.status,'working');assert.equal(r.reply_note,'연락 시도 1회 · 미연결 (부재)');assert.equal(r.closed_at,null);
 a=await call({id:request,operation_id:op(),activity_id:act,result:'번호 오류',confirmed:[]});
 r=await row();assert.equal(r.reply_note,'연락 시도 2회 · 미연결 (번호 오류)');
});
test('일부 확인 = 진행 중 · 일부 처리 k/m · 확인 · 남음',async()=>{
 await activity(true);
 const a=await call({id:request,operation_id:op(),activity_id:act,result:'연결됨',confirmed:['연락 후 견적 필요 여부 확인'],next_text:'현장 방문',next_due:due});
 assert.equal(a.request_complete,false);assert.deepEqual(a.remaining,['현장방문 필요 여부 확인']);
 const r=await row();assert.equal(r.status,'working');assert.equal(r.reply_note,'일부 처리 1/2 · 확인: 연락 후 견적 필요 여부 확인 · 남음: 현장방문 필요 여부 확인');assert.equal(r.result,'연결됨');
});
test('전부 확인 + 다음 행동 · 날짜 = 완료',async()=>{
 await activity(true);
 const a=await call({id:request,operation_id:op(),activity_id:act,result:'연결됨',confirmed:['연락 후 견적 필요 여부 확인','현장방문 필요 여부 확인'],next_text:'현장 방문',next_due:due});
 assert.equal(a.request_complete,true);
 const r=await row();assert.equal(r.status,'done');assert.equal(r.next_text,'현장 방문');assert.equal(r.next_due,due);assert.ok(r.closed_at);
 await assert.rejects(call({id:request,operation_id:op(),activity_id:act,result:'연결됨',confirmed:[],next_text:'x',next_due:due}),/REQUEST_CLOSED/,'끝난 요청은 다시 처리하지 않음');
});
test('첫 연락만 걸린 요청 = 연결 + 다음 행동이면 완료 · 다음 행동 없으면 진행 중',async()=>{
 await ask(['고객 첫 연락']);await activity(true);
 await call({id:request,operation_id:op(),activity_id:act,result:'회신 받음',confirmed:[]});
 let r=await row();assert.equal(r.status,'working');assert.equal(r.reply_note,'연결 · 다음 행동 · 날짜 필요');
 await call({id:request,operation_id:op(),activity_id:act,result:'회신 받음',confirmed:[],next_text:'자료 발송',next_due:due});
 r=await row();assert.equal(r.status,'done');
});
test('같은 operation_id 는 한 번만 · 다른 내용이면 거절',async()=>{
 await activity(false);const o=op(),p={id:request,operation_id:o,activity_id:act,result:'부재',confirmed:[]};
 await call(p);const again=await call(p);assert.equal(again.replayed,true);
 assert.equal((await row()).reply_note,'연락 시도 1회 · 미연결 (부재)','되풀이해도 시도 수 그대로');
 await assert.rejects(call({...p,result:'번호 오류'}),/REQUEST_ID_REUSE/);
});
test('근거 없는 처리 거절: 기록 없음 · 결과와 연결 여부 불일치 · 다른 사람 기록 · 오래된 기록 · 다른 담당',async()=>{
 await activity(true);
 await assert.rejects(call({id:request,operation_id:op(),activity_id:miss,result:'연결됨',confirmed:[]}),/CONTACT_PROOF/);
 await assert.rejects(call({id:request,operation_id:op(),activity_id:act,result:'부재',confirmed:[]}),/CONTACT_PROOF/,'연결 기록으로 부재 처리 불가');
 await activity(false);
 await assert.rejects(call({id:request,operation_id:op(),activity_id:act,result:'연결됨',confirmed:[]}),/CONTACT_PROOF/,'부재 기록으로 연결 처리 불가');
 await activity(true,'다른 담당');
 await assert.rejects(call({id:request,operation_id:op(),activity_id:act,result:'연결됨',confirmed:[]}),/CONTACT_PROOF/);
 await activity(true,'담당','3 days');
 await assert.rejects(call({id:request,operation_id:op(),activity_id:act,result:'연결됨',confirmed:[]}),/CONTACT_PROOF/);
 await activity(true);await as(other);
 await assert.rejects(call({id:request,operation_id:op(),activity_id:act,result:'연결됨',confirmed:[]}),/받는 담당자만/);
});
test('확인 항목은 요청에 적힌 것만 · 중복 · 부재에 확인 불가 · 연락 외 요청 거절',async()=>{
 await activity(true);
 await assert.rejects(call({id:request,operation_id:op(),activity_id:act,result:'연결됨',confirmed:['계약일 입력']}),/invalid confirmed/);
 await assert.rejects(call({id:request,operation_id:op(),activity_id:act,result:'연결됨',confirmed:['현장방문 필요 여부 확인','현장방문 필요 여부 확인']}),/invalid confirmed/);
 await activity(false);
 await assert.rejects(call({id:request,operation_id:op(),activity_id:act,result:'부재',confirmed:['현장방문 필요 여부 확인']}),/invalid confirmed/);
 await db.exec('reset role');await db.query("update crm_security.work_requests set kind='contract',label='계약정보 입력 요청' where id=$1",[request]);await as(owner);
 await assert.rejects(call({id:request,operation_id:op(),activity_id:act,result:'부재',confirmed:[]}),/REQUEST_UNSUPPORTED/);
});
