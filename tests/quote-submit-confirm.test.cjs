'use strict';
/* 견적 v3 · 가산 → 제출금액 서버 함수 약속 (2026-10-11) — SQL 문장 · 전송 허용 목록 · 화면 호출이 같은 이름 · 같은 순서를 쓴다 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8').replace(/\r\n/g,'\n');
const s1=read('sql/quote-v3-step1-20261011.sql'),s4=read('sql/quote-v3-step4-20261011.sql');
test('1단계 SQL 은 운영이 읽는 crm_security.quote_versions 를 확장하고, 기존 줄은 base_amount 로만 옮긴다',()=>{
 assert.match(s1,/alter table crm_security\.quote_versions\s+add column if not exists kind text/);
 assert.match(s1,/add column if not exists markup_items jsonb/);assert.match(s1,/'area','multiplier','flat','multi','none'/);
 assert.match(s1,/update crm_security\.quote_versions\s+set base_amount=amount,[^;]*where base_amount is null and amount>0;/);
 assert.doesNotMatch(s1.replace(/--.*$/gm,''),/alter table public\.crm_quote_versions/,'예전 표를 고치지 않는다');
});
test('서버 함수: 권한 · 담당 범위 · 종료 건 거절 · 같은 순서 계산 · 화면 계산과 다르면 거절 · 새 수정본(덮어쓰기 없음) · 감사',()=>{
 assert.match(s4,/create or replace function public\.crm_quote_submit_confirm_v1\(p jsonb\)/);
 assert.match(s4,/a\.permission_role not in \('rep','branch','admin'\)/);assert.match(s4,/crm_security\.can_deal\(v_id,true\)/);
 assert.match(s4,/array\['multiplier','area','flat'\]/,'배수 → ㎡당 → 정액 (quote-amounts.js 와 같은 순서)');
 assert.match(s4,/floor\(round\(raw,2\)\/100000\)\*100000/);assert.match(s4,/v_submit<>v_expected[\s\S]*PT409/);
 assert.match(s4,/src\.submit_amount is not null then raise exception '이미 제출금액이 확정된 견적/);
 assert.match(s4,/insert into crm_security\.quote_versions\(/);assert.doesNotMatch(s4,/update crm_security\.quote_versions/,'기존 수정본은 고치지 않는다');
 assert.match(s4,/'quote_submit_confirm'/);assert.match(s4,/revoke all on function public\.crm_quote_submit_confirm_v1\(jsonb\) from public, anon;\s*grant execute on function public\.crm_quote_submit_confirm_v1\(jsonb\) to authenticated;/);
});
test('전송 허용 목록 · 오류 이름 · 화면 호출 · 상세 자료 구역 단추가 같은 이름',()=>{
 assert.match(read('pc-manager-transport.js'),/'crm_quote_submit_confirm_v1'/);assert.match(read('pc-error-state.js'),/crm_quote_submit_confirm_v1:'견적 제출금액 확정'/);
 const h=read('crm.html');assert.match(h,/sb\.rpc\('crm_quote_submit_confirm_v1'/);assert.match(h,/CRMRelease\.has\('crm_quote_submit_confirm_v1'\)===false/);assert.match(h,/expected_submit:c\.r\.submit/);
 assert.match(read('deal-detail-v3.js'),/data-v="submit">제출금액 만들기/);
});
