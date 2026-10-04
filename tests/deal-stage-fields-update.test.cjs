'use strict';
/* 이 단계에서 챙길 정보 제자리 입력(2026-09-30): 현재 단계의 항목만 갱신하는 서버 함수 + 단계 항목만 있는 입력창 */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');

test('서버 함수: 담당 범위·역할 확인, 현재 단계만, 종료 건 거부, 단계·금액·다음 할 일 불변, 활동·감사 기록',()=>{
 const sql=read('sql/deal-stage-fields-update-v1-20260930.sql');
 assert.match(sql,/create or replace function public\.crm_deal_stage_fields_update_v1\(p jsonb\)/);
 assert.match(sql,/a\.permission_role not in \('rep','branch','admin'\)/);
 assert.match(sql,/crm_security\.can_deal\(v_id,true\)/);
 assert.match(sql,/oldrow\.outcome is not null or oldrow\.lifecycle_status='closed'/);
 assert.match(sql,/oldrow\.stage_code is distinct from v_stage/);
 assert.match(sql,/update public\.deals d set stage_contexts=jsonb_set\(/);
 assert.doesNotMatch(sql,/set stage_code|contract_amount=|next_action=|outcome=/);
 assert.match(sql,/insert into public\.activities\(deal_id,organization_id,actor_email,actor_name,type,detail,occurred_at\)/);
 assert.match(sql,/'단계정보'/);
 assert.match(sql,/insert into crm_security\.audit_events\(/);
 assert.match(sql,/'stage_fields_update'/);
 assert.match(sql,/revoke all on function public\.crm_deal_stage_fields_update_v1\(jsonb\) from public, anon/);
});

test('화면: 단계 항목만 있는 입력창 · 서버 확인 뒤에만 반영 · 전송 허용 · 미설치면 숨김',()=>{
 const js=read('detail-actions.js');
 assert.match(js,/const STAGE_FIELDS_RPC='crm_deal_stage_fields_update_v1'/);
 assert.match(js,/stagefields:'이 단계에서 챙길 정보 입력'/);
 assert.match(js,/root\.StageTransitionUI\.fieldHTML\(f,cur\[f\.key\]\?\?'',quotes\)/);
 const save=js.slice(js.indexOf('async function saveStageFields('),js.indexOf('function isAdminNow('));
 assert.ok(save.indexOf('r.data.ok!==true')<save.indexOf('d.stage_contexts=Object.assign'),'서버 확인 전에 화면을 바꾸면 안 됨');
 assert.match(save,/noteMissing\?\.\(STAGE_FIELDS_RPC\)/);
 assert.match(js,/root\.CRMRelease\.has\(STAGE_FIELDS_RPC\)===false/);
 assert.match(js,/if\(kind==='field'&&!canEdit\)return;/);
 assert.doesNotMatch(js,/연락 결과 입력창이 열립니다/);
 assert.match(read('pc-manager-transport.js'),/'crm_deal_stage_fields_update_v1'/);
});

test('화면은 사유를 함께 보낸다 — 서버 감사 기록(audit_events.reason)은 빈 값을 받지 않는다(2026-10-04 운영: 사유 없이 보내 매번 거절됨)',()=>{
 for(const f of ['deal-detail-v3.js','detail-actions.js','deal-panels-v2.js']){
  const js=read(f),calls=js.match(/\.rpc\((?:SF_RPC|STAGE_FIELDS_RPC|RPC),\{p:\{[^}]*\}\}\)/g)||[];
  assert.equal(calls.length>=1,true,f+' 호출부');
  calls.forEach(c=>assert.match(c,/deal_id:String\(d\.id\),stage_code:code,fields,reason:'상세에서 바로 입력'/,f));
 }
 assert.match(read('sql/deal-stage-fields-update-v1-20260930.sql'),/nullif\(btrim\(coalesce\(p->>'reason',''\)\),''\),v_at\)/,'서버는 받은 사유를 그대로 감사 기록에 넣는다');
});

test('종료 건 정보 입력 함수는 종료 건에서만, 허용 항목 · 예상 금액만 고친다(2026-10-04 대표 "실주에서 입력 왜 뺐어 · 수주도 마찬가지")',()=>{
 const sql=read('sql/deal-closed-info-update-v1-20261004.sql'),body=sql.replace(/^--.*$/gm,''),js=read('deal-detail-v3.js');
 assert.match(sql,/create or replace function public\.crm_deal_closed_info_update_v1\(p jsonb\)/);
 assert.match(sql,/v_allowed constant text\[\]:=array\['customer_reaction','decision_maker','competitor','construction_plan','close_reason','close_detail','lesson','recontact_possibility','win_reason'\];/,'허용 항목');
 assert.match(sql,/if not \(r\.key = any\(v_allowed\)\) then raise exception/);
 assert.match(sql,/if oldrow\.outcome is null and oldrow\.lifecycle_status is distinct from 'closed' then raise exception/,'진행 중인 건은 거절');
 assert.match(sql,/if not crm_security\.can_deal\(v_id,true\) then raise exception 'forbidden'/);
 assert.doesNotMatch(body,/won_amount\s*=|completion_date\s*=|closed_at\s*=|owner_id\s*=|lifecycle_status\s*=|contract_sales|->\s*'contract'/,'단계 · 종료 상태 · 수주금액 · 준공일 · 담당 · 계약 원장은 쓰지 않는다');
 assert.equal((body.match(/update public\.deals d set/g)||[]).length,2,'쓰는 곳은 단계 항목 · 예상 금액 두 갈래뿐');
 assert.match(sql,/coalesce\(nullif\(btrim\(coalesce\(p->>'reason',''\)\),''\),'종료 건 정보 입력'\),v_at\)/,'감사 기록 사유는 비지 않는다');
 assert.match(sql,/revoke all on function public\.crm_deal_closed_info_update_v1\(jsonb\) from public, anon;\s*grant execute on function public\.crm_deal_closed_info_update_v1\(jsonb\) to authenticated;/);
 assert.match(js,/CI_KEYS=\['customer_reaction','decision_maker','competitor','construction_plan','close_reason','close_detail','lesson','recontact_possibility','win_reason'\]/,'화면 허용 항목 = 서버 허용 항목');
 assert.match(js,/\.rpc\(CI_RPC,\{p:Object\.assign\(\{deal_id:String\(d\.id\),stage_code:String\(d\.stage_code\|\|code\),reason:'종료 건 상세에서 바로 입력'\}/,'종료 건은 전용 함수로 · 사유 포함');
 assert.match(read('pc-manager-transport.js'),/'crm_deal_closed_info_update_v1'/,'전송 허용 목록');
});