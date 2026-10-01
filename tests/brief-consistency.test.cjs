'use strict';
/* 주간 브리핑 문장 정합성(2026-10-01 컨설턴트: "신규 유입 5건 — 이 중 최초 미응대 85건")
   '이 중'으로 세는 값은 반드시 신규 유입의 부분집합이어야 한다 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','crm.html'),'utf8');
test("'이 중 최초 미응대'는 신규 유입 안에서만 센다",()=>{
 assert.match(html,/var newNoResponse=newQ\.filter\(function\(q\)\{return inquiryAssigned\(q\)&&!inquiryResponded\(q\)\}\);/);
 assert.match(html,/이 중 최초 미응대 <b>'\+newNoResponse\.length\+'건<\/b>/);
 assert.doesNotMatch(html,/이 중 최초 미응대 <b>'\+noResponse\.length/,'전체 미응대를 신규의 부분처럼 쓰면 안 됨');
 assert.match(html,/누적 미응대 <b>'\+noResponse\.length\+'건<\/b>/);
});
