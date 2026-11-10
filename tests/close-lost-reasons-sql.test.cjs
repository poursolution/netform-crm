'use strict';
/* 실주 원인 새 목록 받기 SQL(2026-11-10): 서버가 받는 실주 원인 = 화면 기본 '실주 원인'(ops-rules.js reasons_lost) · 설정 목록 · 예전 목록 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const sql=fs.readFileSync(require.resolve('../sql/close-lost-reasons-v1-20261110.sql'),'utf8'),ops=fs.readFileSync(require.resolve('../ops-rules.js'),'utf8');
test('SQL 목록 = 화면 기본 실주 원인 12개',()=>{
 const list=JSON.parse(ops.match(/reasons_lost:Object\.freeze\((\[[^\]]+\])\)/)[1].replace(/'/g,'"'));
 const inSql=sql.match(/AND category_value NOT IN \(([^)]+)\)/)[1].split(',').map(s=>s.trim().replace(/^'|'$/g,''));
 assert.deepEqual(inSql,list);
});
test('설정 목록(crm_settings ops_rules.reasons_lost)도 받는다 · 다시 실행 안전 · 자리가 한 곳일 때만 바꾼다',()=>{
 assert.match(sql,/s\.key='ops_rules' AND btrim\(x\.v\)=category_value/);
 assert.match(sql,/close-lost-reasons-v1:start' in d\)>0 then raise notice '이미 적용됨/);
 assert.match(sql,/if n<>1 then raise exception/);
 assert.match(sql,/anchor text := \$a\$'타업체 선정','내부 사정','기타'\)\$a\$/);
});
test('되돌리기 파일이 있다',()=>{assert.ok(fs.existsSync(require.resolve('../sql/close-lost-reasons-v1-20261110-rollback.sql')));});
