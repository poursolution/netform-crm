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
