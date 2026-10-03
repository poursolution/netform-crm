'use strict';
/* 견적문의 빈 칸 바로 입력(2026-10-03): 서버 함수로만 저장 — 담당자·관리자만, 허용 항목만, 종결 건 거부, 감사 기록. 화면은 함수가 설치됐을 때만 입력 칸을 연다 */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');

test('서버 함수: 담당자·관리자만, 허용 항목만, 200자, 종결 건 거부, raw 키 = 접수 시트 키, 감사 기록',()=>{
 const sql=read('sql/inquiry-field-update-v1-20261003.sql');
 assert.match(sql,/create or replace function public\.crm_inquiry_field_update_v1\(p jsonb\)/);
 assert.match(sql,/a\.permission_role<>'admin' and \(oldq\.assigned_to is null or oldq\.assigned_to<>a\.user_id\)/);
 assert.match(sql,/v_field not in \('contact_name','phone','address','site_name','customer_type','work_type','channel','inflow','responder'\)/);
 assert.match(sql,/length\(v_value\)>200/);
 assert.match(sql,/in \('종결','종료','수주','실주'\)/);
 assert.match(sql,/when 'work_type' then '공사유형' when 'channel' then '상담채널' when 'inflow' then '유입경로'/);
 assert.match(sql,/insert into crm_security\.inquiry_audit_events\(/);
 assert.match(sql,/'field_update'/);
 assert.doesNotMatch(sql,/deleted_at/,'운영 inquiries에 없는 열');
 assert.match(sql,/revoke all on function public\.crm_inquiry_field_update_v1\(jsonb\) from public, anon/);
});

test('화면: 전송 허용 목록에 있고, 설치 안 됐으면 입력 칸을 열지 않으며, 서버 확인 뒤에만 화면을 바꾼다',()=>{
 assert.match(read('pc-manager-transport.js'),/'crm_inquiry_field_update_v1'/);
 const js=read('inquiry-detail-v2.js');
 assert.match(js,/CRMRelease\.has\('crm_inquiry_field_update_v1'\)===false/);
 const fn=js.slice(js.indexOf('async function saveField('),js.indexOf('function onInput('));
 assert.ok(fn.indexOf('r.data.ok!==true')>=0&&fn.indexOf('r.data.ok!==true')<fn.indexOf('applyField('),'서버 확인 전에 화면을 바꾸면 안 됨');
});
