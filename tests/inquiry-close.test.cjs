'use strict';
/* 상담 종결(2026-10-01): 견적 없이 끝난 문의를 서버 함수로 '종결' — 담당자·관리자만, 사유 필수, 전환 건 거부 */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');

test('서버 함수: 담당자·관리자만, 사유 필수, 종결·전환 건 거부, 이전 상태 보존, 감사 기록',()=>{
 const sql=read('sql/inquiry-close-v1-20261001.sql');
 assert.match(sql,/create or replace function public\.crm_inquiry_close_v1\(p jsonb\)/);
 assert.match(sql,/a\.permission_role<>'admin' and \(oldq\.assigned_to is null or oldq\.assigned_to<>a\.user_id\)/);
 assert.match(sql,/v_id is null or v_reason is null/);
 assert.doesNotMatch(sql,/deleted_at/,'운영 inquiries에 없는 열');
 assert.match(sql,/in \('종결','종료','수주','실주'\)/);
 assert.match(sql,/oldq\.deal_id is not null or oldq\.opportunity_id is not null/);
 assert.match(sql,/set status='종결'/);
 assert.match(sql,/이전 상태: /);
 assert.match(sql,/insert into crm_security\.inquiry_audit_events\(/);
 assert.match(sql,/'close'/);
 assert.match(sql,/revoke all on function public\.crm_inquiry_close_v1\(jsonb\) from public, anon/);
});

/* 2026-10-03 주간 브리핑 핸드오프: 견적문의 종결 = 배드핏(부적합 종결) · 사유(구분) 필수 — 서버 함수는 그대로(kind='기타' + 사유 글머리에 배드핏 구분) */
test('화면: 더보기에 배드핏(부적합 종결) · 사유 필수 · 서버 확인 뒤에만 반영 · 전송 허용 · 미설치면 숨김',()=>{
 const html=read('crm.html'),wb=read('inquiry-workbench.js');
 assert.match(wb,/item\('close','배드핏\(부적합 종결\)'\)/);
 assert.match(wb,/root\.inqCtlCloseAvailable\(\)/);
 assert.match(html,/CRMRelease\.has\('crm_inquiry_close_v1'\)===false/);
 const fn=html.slice(html.indexOf('function inqCtlConfirmClose('),html.indexOf('function inqCtlOpenTrash('));
 assert.ok(fn.indexOf('r.data.ok!==true')<fn.indexOf("q.status=p.status='종결'"),'서버 확인 전에 화면을 바꾸면 안 됨');
 assert.match(fn,/배드핏 사유를 골라 주세요/);assert.match(fn,/기타 사유는 메모에 적어 주세요/);assert.match(fn,/reason='배드핏\(부적합\) · '\+cat/);assert.match(fn,/kind='기타'/);
 assert.match(html,/<option value="공사 범위 밖">[\s\S]*<option value="소규모 \(최소 금액 미만\)">[\s\S]*<option value="시공 불가 지역">[\s\S]*<option value="기타">/);
 assert.match(html,/mode==='close'\)inqCtlOpenClose\(k\)/);
 assert.match(read('pc-manager-transport.js'),/'crm_inquiry_close_v1'/);
});
