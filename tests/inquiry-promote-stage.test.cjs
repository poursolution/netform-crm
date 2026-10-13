'use strict';
/* 문의 → 파이프라인 전환 단계는 화면 · 전송 계층 · 서버가 같은 값(컨설팅 설계)이어야 한다 — 다르면 서버가 전환 요청을 거절한다 (2026-10-13 견적문의 흐름 v5) */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
test('전환 단계 = 컨설팅 설계: crm.html · operational-adapter · SQL 이 같은 값',()=>{
 assert.match(read('operational-adapter.js'),/function promotionStage\(status\)\{return 'consulting';\}/,'전송 계층');
 const html=read('crm.html'),i=html.indexOf('function qualifyStage(status){'),body=html.slice(i,html.indexOf('\n}',i));
 assert.ok(i>0);assert.match(body,/return 'consulting';/);assert.doesNotMatch(body,/'sent'/,'화면: 견적 발송 완료도 컨설팅 설계');
 const sql=read('sql/inquiry-promote-consulting-20261013.sql');
 assert.match(sql,/create or replace function crm_security\.crm_inquiry_pipeline_stage_v1\(p_status text\) returns text\s+language sql immutable strict set search_path='' as \$fn\$\s+select 'consulting'::text\s+\$fn\$;/,'서버');
 assert.match(sql,/revoke execute on function crm_security\.crm_inquiry_pipeline_stage_v1\(text\) from public,anon,authenticated,service_role;/,'직접 실행 권한 없음 유지');
 assert.doesNotMatch(sql,/update\s+public\.deals|delete\s+from/i,'이미 만들어진 영업건은 건드리지 않는다');
});