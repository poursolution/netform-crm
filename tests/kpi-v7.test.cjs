'use strict';
/* 관리팀 KPI v7(2026-10-05 design_handoff_kpi_v7): 숫자는 기존 계산과 단계 화면의 계산 함수를 그대로 쓴다 · 요청은 담당자의 '관리자 한마디'로 서버에 저장된다 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
test('KPI v7 은 따로 세지 않는다: 핵심 지표 = KpiB.compute, 단계별 기준 = 단계 화면과 같은 함수',()=>{
 const js=read('kpi-v7.js'),kb=read('kpi-b.js');
 assert.match(js,/const s=ST\(\),C=K\(\)\.compute\(\)/,'핵심 지표는 기존 계산');
 assert.match(js,/try\{md=P\.model\(key,list\);\}catch/,'단계별 기준 = PipelineStageB.model');
 assert.match(js,/red=Object\.keys\(md\.C\.RS\)\.filter\(k=>md\.isRed\(k\)\|\|LF\.includes\(k\)\)/,'기준 = 단계 화면의 빨강 사유(실주는 완료 판정 사유 3개 · 측정 기준 a3 와 같은 판정)');
 assert.match(js,/const ms=IV\.rows\(\)\.map\(x=>IL\.model\(x\)\)/,'견적문의 = 목록 화면과 같은 판정');
 assert.match(js,/const enabled=\(\)=>!R\.G\.kpiV7Off&&!!K\(\)&&K\(\)\.enabled\(\)/,'끄기 스위치 · 예전 화면이 꺼져 있으면 같이 꺼짐');
 assert.match(kb,/root\.KpiB=\{enabled,compute,DEF,stageItems,[^}]*personVals,requestLine,saveWeek,autoSave,load,names,openTarget,weekly:\(\)=>W,weekRowOf:weekRow\};/);
 assert.match(kb,/const KEY=i=>'kpi:'\+\(i\+1\);/,'지표 열쇠 kpi:1~8 유지');
 assert.match(kb,/\/\^\(kpi:\\d\|stage:\[\\w:-\]\{1,60\}\)\$\//,'단계별 기준 요청(stage:…)도 조치 기록으로 읽는다');
 assert.match(read('crm.html'),/<script src="\.\/kpi-b\.js\?v=[a-z0-9-]+"><\/script><link rel="stylesheet" href="\.\/kpi-v7\.css\?v=[a-z0-9-]+"><script src="\.\/kpi-v7\.js\?v=[a-z0-9-]+"><\/script>/);
});
test('요청 → 관리자 한마디: 관리자만 저장 · 그 표 한 줄만 쓴다 · 담당자 오늘 업무에 보인다',()=>{
 const sql=read('sql/rep-manager-comment-save-v1-20261005.sql'),body=sql.replace(/^--.*$/gm,''),kb=read('kpi-b.js'),tv=read('today-v3.js');
 assert.match(body,/create or replace function public\.crm_rep_manager_comment_save_v1\(p jsonb\)[\s\S]*?security definer set search_path=''/);
 assert.match(body,/a\.permission_role not in \('admin','branch'\) then raise exception 'forbidden'/);
 assert.match(body,/insert into crm_security\.rep_manager_comments as c\([^)]*\)[\s\S]*?on conflict \(rep_user_id,week_start\) do update/,'운영 표(crm_security.rep_manager_comments · 사람 ID 기준)');
 assert.match(body,/create or replace function public\.crm_rep_manager_comment_list_v1\(p jsonb\)[\s\S]*?a\.permission_role in \('admin','branch'\) or c\.rep_user_id=a\.user_id/,'읽기: 관리자는 전원 · 그 밖은 본인 것만');
 assert.doesNotMatch(body,/public\.deals|public\.inquiries|contract_sales|delete\s+from/i,'다른 표는 건드리지 않는다');
 for(const fn of ['crm_rep_manager_comment_save_v1','crm_rep_manager_comment_list_v1'])assert.match(body,new RegExp('revoke all on function public\\.'+fn+'\\(jsonb\\) from public, anon;\\s*grant execute on function public\\.'+fn+'\\(jsonb\\) to authenticated;'),fn);
 assert.match(kb,/await o\.rpc\(fn,p\)/,'요청은 원자적 저장 RPC의 응답을 기다린다');
 assert.match(kb,/fn='crm_kpi_request_send_v1'/);
 assert.doesNotMatch(kb,/pushWrite\('rep_manager_comment'/,'로컬 성공이나 미연결 전송으로 우회하지 않는다');
 for(const fn of ['crm_rep_manager_comment_save_v1','crm_rep_manager_comment_list_v1'])assert.ok(read('pc-manager-transport.js').includes("'"+fn+"'"),fn+' 전송 허용 목록');
 assert.match(tv,/o\.rpc\('crm_rep_manager_comment_list_v1',\{weeks:2\}\)/,'담당자 화면이 서버에서 관리자 한마디를 읽는다');
 assert.match(tv,/if\(root\.G\.todayWordOff\|\|role==='mgr'\|\|!me\|\|typeof root\.repManagerComment!=='function'\)return '';/,'영업관리 화면에는 없다 · 끄기 스위치');
 assert.match(tv,/if\(!c\|\|c\.status==='done'\|\|!String\(c\.comment\|\|''\)\.trim\(\)\)return '';/,'처리된 것은 안 보인다');
});
