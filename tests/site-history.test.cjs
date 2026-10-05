'use strict';
/* 이 단지 영업 이력(2026-10-05 design_handoff_site_history): 이력 수정 · 추가 · 삭제는 '이력에 보이는 모습'만 바꾼다 — 영업건 · 계약 원장은 건드리지 않고, 매번 응대 이력 '이력 수정' + 감사 기록 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
test('서버: 이력 표는 잠겨 있고 함수 두 개로만 읽고 쓴다',()=>{
 const sql=read('sql/site-history-v1-20261005.sql'),body=sql.replace(/^--.*$/gm,'');
 assert.match(body,/create table if not exists crm_security\.site_history_entries\(/);
 assert.match(body,/source text not null check\(source in \('manual','crm'\)\)/,'수기 · CRM 구분');
 assert.match(body,/result text check\(result is null or result in \('진행','수주','실주','보류','배드핏'\)\)/);
 assert.match(body,/alter table crm_security\.site_history_entries enable row level security;\s*revoke all on crm_security\.site_history_entries from public, anon, authenticated;/);
 for(const fn of ['crm_site_history_list_v1','crm_site_history_write_v1']){
  assert.match(body,new RegExp('create or replace function public\\.'+fn+'\\(p jsonb\\)[\\s\\S]*?security definer set search_path=\'\''),fn);
  assert.match(body,new RegExp('revoke all on function public\\.'+fn+'\\(jsonb\\) from public, anon;\\s*grant execute on function public\\.'+fn+'\\(jsonb\\) to authenticated;'),fn+' 권한');
 }
});
test('서버: 쓰기는 권한 확인 · 실주 원인 필수 · 지금 보는 건 삭제 불가 · 응대 이력과 감사 기록',()=>{
 const sql=read('sql/site-history-v1-20261005.sql'),body=sql.replace(/^--.*$/gm,''),w=body.slice(body.indexOf('function public.crm_site_history_write_v1'));
 assert.match(w,/a\.permission_role not in \('rep','branch','admin'\) then raise exception 'forbidden'/);
 assert.match(w,/if not crm_security\.can_deal\(v_cur,true\) then raise exception 'forbidden'/);
 assert.match(w,/if v_target is not null and v_target=v_cur then raise exception '지금 보는 건은 삭제할 수 없습니다'/);
 assert.match(w,/if v_result='실주' and v_lost is null then raise exception '실주 원인을 골라 주세요'/);
 assert.match(w,/insert into public\.activities\([^)]*\)\s*values\(v_cur,cur\.organization_id,v_email,a\.display_name,'이력 수정',v_detail,v_at\)/,"응대 이력 '이력 수정'");
 assert.match(w,/insert into crm_security\.audit_events\([\s\S]*?'site_history_'\|\|v_op,[\s\S]*?'entry',case when v_found then to_jsonb\(old\) end/,'감사 기록에 이전 값');
 assert.doesNotMatch(body,/update\s+public\.deals|delete\s+from\s+public\.deals|contract_sales|won_amount\s*=|outcome\s*=|lifecycle_status\s*=|owner_id\s*=/i,'영업건 · 계약 원장은 쓰지 않는다');
 assert.doesNotMatch(w,/delete\s+from/i,'삭제 = 숨김(hidden)');assert.match(w,/set hidden=true/);
});
test('화면: 서버 함수가 없으면 보기만 · 영업건 상세 왼쪽 칸에 연결 · 전송 허용 목록',()=>{
 const js=read('site-history.js'),dv3=read('deal-detail-v3.js'),tr=read('pc-manager-transport.js'),html=read('crm.html');
 assert.match(js,/const LIST='crm_site_history_list_v1',WRITE='crm_site_history_write_v1'/);
 assert.match(js,/const rpcOk=n=>!!\(R\.SB&&typeof R\.SB\.rpc==='function'\)&&!\(R\.CRMRelease&&R\.CRMRelease\.has\(n\)===false\);/,'CRMRelease 게이트');
 assert.match(js,/const enabled=\(\)=>!R\.G\.siteHistoryOff;/,'끄기 스위치');
 assert.match(dv3,/root\.SiteHistory&&root\.SiteHistory\.enabled\(\)\?root\.SiteHistory\.html\(d,closed\)/);
 for(const n of ['crm_site_history_list_v1','crm_site_history_write_v1'])assert.ok(tr.includes("'"+n+"'"),n+' 허용');
 assert.match(html,/<script src="\.\/deal-detail-v3\.js\?v=[a-z0-9-]+"><\/script><link rel="stylesheet" href="\.\/site-history\.css\?v=[a-z0-9-]+"><script src="\.\/site-history\.js\?v=[a-z0-9-]+"><\/script>/);
 assert.match(read('deal-detail-v2.js'),/\/단계\|배정\|변경\|등록\|완료\|이력 수정\//,"'이력 수정'은 시스템 기록으로 보인다");
});
