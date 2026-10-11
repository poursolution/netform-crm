'use strict';
/* 원가 기준 서버 함수 약속 (2026-10-11 견적 v3 5단계) — SQL · 전송 허용 목록 · 화면이 같은 이름 · 같은 규칙 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8').replace(/\r\n/g,'\n');
const sql=read('sql/quote-v3-step5-20261011.sql');
const NAMES=['crm_cost_standard_list_v1','crm_cost_standard_stage_v1','crm_cost_standard_approve_v1','crm_cost_standard_discard_v1'];
test('SQL: 함수 4개 · 쓰기는 관리자만 · 출처 없으면 승인 거절 · 승인된 값은 덮어쓰지 않음',()=>{
 for(const n of NAMES){assert.match(sql,new RegExp('create or replace function public\\.'+n+'\\(p jsonb'));assert.match(sql,new RegExp('revoke all on function public\\.'+n+'\\(jsonb\\) from public, anon;'));assert.match(sql,new RegExp('grant execute on function public\\.'+n+'\\(jsonb\\) to authenticated;'));}
 assert.equal((sql.match(/a\.permission_role<>'admin' then raise exception 'forbidden'/g)||[]).length,3,'초안 저장 · 승인 · 버리기는 관리자만');
 assert.match(sql,/a\.permission_role not in \('rep','branch','admin'\)/,'읽기는 영업/팀장/관리자');
 assert.match(sql,/출처 없이는 승인할 수 없습니다/);assert.match(sql,/where status='draft'/);
 assert.doesNotMatch(sql,/update public\.crm_(labor_rates|cost_rates|material_prices) set (rate|daily_wage|unit_price)/,'승인된 값을 고치는 문장이 없다');
 assert.match(sql,/create unique index if not exists crm_cost_rates_item_tier_from_uq on public\.crm_cost_rates\(item,tier,effective_from\)/);
});
test('전송 허용 목록 · 오류 이름 · 화면이 같은 이름을 쓴다',()=>{
 const tr=read('pc-manager-transport.js'),er=read('pc-error-state.js'),ui=read('cost-admin.js'),h=read('crm.html');
 for(const n of NAMES){assert.match(tr,new RegExp("'"+n+"'"));assert.match(er,new RegExp(n+":'"));assert.match(ui,new RegExp(n));}
 assert.match(h,/data-admin-nav hidden data-p="costbase"/);assert.match(h,/id="pg-costbase"><div id="cost-admin">/);assert.match(h,/CostAdmin\.render\(\)/);
 assert.match(h,/quote-excel\.js\?v=qv1[^>]*><\/script><script src="\.\/quote-standards\.js/);
});
