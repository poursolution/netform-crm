'use strict';
/* 영업이사 배정(2026-09-28): 로그인 계정 없는 영업이사에게 이름으로 문의를 배정한다 — 관리자 전용 서버 함수 + 허용 명단 */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');

test('서버 함수는 관리자만·허용 명단만·이력과 감사 기록을 남긴다',()=>{
 const sql=read('sql/inquiry-director-assign-v1-20260928.sql');
 assert.match(sql,/create or replace function public\.crm_inquiry_director_assign_v1\(p jsonb\)/);
 assert.match(sql,/permission_role<>'admin'/);
 assert.match(sql,/crm_security\.sales_directors d where d\.name=v_to and d\.active/);
 assert.match(sql,/assigned_to=null, assignee_name=v_to/);
 assert.match(sql,/insert into public\.assignment_history/);
 assert.match(sql,/insert into crm_security\.inquiry_audit_events/);
 assert.match(sql,/재배정 사유가 필요합니다/);
 assert.match(sql,/revoke all on function public\.crm_inquiry_director_assign_v1\(jsonb\) from public, anon/);
 assert.match(sql,/insert into crm_security\.sales_directors\(name\) values \('전용성'\),\('조성용'\)/);
});

test('화면: 배정 창에 영업이사 칸 · 서버 확인 후에만 반영 · 전송 허용',()=>{
 const html=read('crm.html');
 assert.match(html,/\{name:'전용성'[^}]*directorAssignable:true/);
 assert.match(html,/\{name:'조성용'[^}]*directorAssignable:true/);
 assert.match(html,/directorAssignable:personBool\(x,'directorAssignable','director_assignable',base\)/);
 assert.match(html,/function inquiryDirectorReps\(\)/);
 assert.match(html,/inqCtlAssignGroup\('director','영업이사'/);
 assert.match(html,/\+hq\+dir\+branch\+/);
 const fn=html.slice(html.indexOf('function inqCtlConfirmDirector('),html.indexOf('\nfunction inqCtlError('));
 assert.match(fn,/rpc\('crm_inquiry_director_assign_v1'/);
 assert.ok(fn.indexOf("r.data.ok!==true")<fn.indexOf('q.assignee='),'서버 확인 전에 화면을 바꾸면 안 됨');
 assert.match(html,/if\(repProfile\(rep\)\.directorAssignable\)return inqCtlConfirmDirector\(/);
 assert.match(read('pc-manager-transport.js'),/'crm_inquiry_director_assign_v1'/);
});
