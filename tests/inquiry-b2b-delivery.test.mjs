import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{plan,verifyWrite}=require('../server/inquiry-b2b/sheet-delivery.cjs');
const {PGlite}=await import('@electric-sql/pglite');
const id='11111111-1111-4111-8111-111111111111',inq='22222222-2222-4222-8222-222222222222';
const claim={event:{event_id:id,inquiry_id:inq,sheet_row:12,phone:'0000000000',brand:'테스트',source_inquiry:'협약 관련 문의',result:'협약완료',note:'',completed_at:'2026-10-04T01:00:00Z'},token:id};
const headers=['고객연락처','브랜드','문의내용','진행상태','응대내용','다음액션일','종료사유','응대완료일시','담당자'];
const data=()=>({valueRanges:[{values:[headers]},{values:[['000-000-0000','테스트','협약 관련 문의','배정완료','기존 메모','2026-10-08','','2026-09-01','조재연']]}]});
test('단일 행 네 필드만 갱신, 원문·담당자·실제 응대시각 보존, RAW로 수식 실행 방지',()=>{
 const p=plan(claim,data());assert.equal(p.action,'write');assert.equal(p.body.valueInputOption,'RAW');assert.equal(p.body.data.length,4);assert.deepEqual(p.body.data.map(x=>x.range),["'시트1'!D12","'시트1'!E12","'시트1'!F12","'시트1'!G12"]);assert.match(p.body.data[1].values[0][0],/^기존 메모\n\[CRM B2B/);
 const response={totalUpdatedCells:4,responses:p.body.data.map(x=>({updatedData:{values:x.values}}))};assert.equal(verifyWrite(p,response),true);response.responses[0].updatedData.values=[['수주']];assert.equal(verifyWrite(p,response),false);
});
test('다른 행·누락 헤더·이미 닫힌 시트 건을 덮어쓰지 않고 재전송 이력을 중복 추가하지 않는다',()=>{
 let d=data();d.valueRanges[1].values[0][0]='99999999';assert.equal(plan(claim,d).action,'review');
 d=data();d.valueRanges[0].values=[headers.filter(x=>x!=='종료사유')];assert.equal(plan(claim,d).reason,'SHEET_HEADERS_REVIEW');
 d=data();d.valueRanges[1].values[0][3]='수주';assert.equal(plan(claim,d).reason,'SHEET_STATE_REVIEW');
 d=data();const p=plan(claim,d);for(const entry of p.body.data){const c=entry.range.match(/!([A-Z]+)/)[1].charCodeAt(0)-65;d.valueRanges[1].values[0][c]=entry.values[0][0];}assert.equal(plan(claim,d).action,'ack');
});
test('배타 임대·재시도·변경 차단·중복 ACK·브라우저 접근 차단',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema private;create schema crm_security;
 create table public.inquiries(id uuid,phone text,brand text,status text,raw jsonb,sheet_row int);
 create table crm_security.inquiry_audit_events(inquiry_id uuid,action text,created_at timestamptz);
 create table private.inquiry_b2b_sync_outbox(event_id uuid primary key,inquiry_id uuid,payload jsonb,status text default 'pending',created_at timestamptz default now(),synced_at timestamptz,reason text);
 insert into public.inquiries values('${inq}','0000000000','테스트','협약완료','{"문의내용":"협약 관련 문의","b2b_completion":{"event_id":"${id}"}}',12);
 insert into private.inquiry_b2b_sync_outbox(event_id,inquiry_id,payload) values('${id}','${inq}','${JSON.stringify(claim.event)}');`);
 await db.exec(readFileSync(new URL('../sql/inquiry-b2b-sheet-delivery.sql',import.meta.url),'utf8'));
 const rpc=async(a,e=null,t=null,r=null)=>(await db.query('select public.crm_inquiry_b2b_delivery_v1($1,$2,$3,$4) r',[a,e,t,r])).rows[0].r;
 const c=await rpc('claim');assert.equal(c.event.event_id,id);assert.equal((await rpc('claim')).event,null);
 await assert.rejects(rpc('ack',id,id),/LEASE_REQUIRED/);assert.equal((await rpc('verify',id,c.token)).ok,true);
 await db.exec("update public.inquiries set status='종결'");assert.equal((await rpc('verify',id,c.token)).status,'review');
 await db.exec("update public.inquiries set status='협약완료';update private.inquiry_b2b_sync_outbox set status='pending',lease_until=null");const c2=await rpc('claim');assert.equal((await rpc('ack',id,c2.token)).status,'synced');assert.equal((await rpc('ack',id,c2.token)).replayed,true);
 const acl=(await db.query("select has_function_privilege('anon','public.crm_inquiry_b2b_delivery_v1(text,uuid,uuid,text)','execute') a,has_function_privilege('authenticated','public.crm_inquiry_b2b_delivery_v1(text,uuid,uuid,text)','execute') b,has_function_privilege('service_role','public.crm_inquiry_b2b_delivery_v1(text,uuid,uuid,text)','execute') c")).rows[0];assert.deepEqual(acl,{a:false,b:false,c:true});
 }finally{await db.close();}
});
