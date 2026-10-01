'use strict';
/* 과거자료 연결 검토 목록 500 수정(2026-10-01): 8초 제한을 넘기던 본문을 한 번만 계산하는 CTE로 — 응답 모양·권한은 그대로 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const sql=fs.readFileSync(path.join(__dirname,'..','sql','site-link-review-list-fast-20261001.sql'),'utf8');
test('같은 함수 이름·서명·권한 검사·contract_version 3 유지',()=>{
 assert.match(sql,/create or replace function crm_security\.site_link_review_list_v1\(p_limit integer default 50\)/);
 assert.match(sql,/returns jsonb language plpgsql stable security definer set search_path=''/);
 assert.match(sql,/a\.permission_role='admin'/);
 assert.match(sql,/'contract_version',3/);
 assert.match(sql,/'separate_site_candidate'|'review_single_candidate'|'review_multiple_candidates'/);
});
test('비용 큰 부분은 materialized로 한 번만, 후보 상위 8건은 창 함수로',()=>{
 for(const n of ['pending','site_norm','ranked'])assert.match(sql,new RegExp(n+' as materialized'),n);
 assert.match(sql,/row_number\(\) over \(partition by r\.organization_id order by r\.match_score desc,r\.site_name,r\.site_id\)/);
 assert.match(sql,/where t\.rn<=8/);
 assert.doesNotMatch(sql,/can_read_legacy_note/,'관리자 전용이라 메모별 권한 함수 호출 불필요');
 assert.doesNotMatch(sql,/from ranked z where z\.organization_id=p\.organization_id/,'조직마다 ranked 재계산 금지');
});
