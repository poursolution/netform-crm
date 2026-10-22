'use strict';
/* 잔디 사건 알림(2026-10-22): 문의 배정 · 하자 접수 글과 링크(모바일 ?open= · PC #p=) · 꺼짐 · 실패해도 조용히 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const J=require('../jandi-events.js');
test('문의 배정 글 · 링크',()=>{
 const m=J.inquiryAssignedMessage({key:'aaaaaaaa-1111-4111-8111-000000000001',nm:'오산 골든팰리스',brand:'POUR공법',work_type:'옥상 방수'},'이필선','송보람');
 assert.equal(m.event,'inquiry_assigned');assert.equal(m.title,'[문의 배정] 오산 골든팰리스');
 assert.equal(m.text,'POUR공법 · 옥상 방수 · 담당 이필선 · 배정 송보람\n첫 연락 기준 시간 안에 응대해 주세요.');
 assert.equal(m.links.length,2);assert.match(m.links[0].url,/mobile\.html\?open=inq%3Aaaaaaaaa-1111-4111-8111-000000000001$/);assert.match(m.links[1].url,/crm\.html#p=inq$/);
 assert.equal(m.links[0].title,'1차 응대 하기(모바일)');
});
test('하자 접수 글',()=>{
 const m=J.defectReportedMessage({id:'d1',nm:'합성 아파트'},{part:'옥상',urgent:true,memo:'우수관 주변 누수 사진 1장',by:'이필선'});
 assert.equal(m.title,'[하자 접수] 합성 아파트');assert.equal(m.text,'옥상 · 긴급 · 우수관 주변 누수 사진 1장 · 접수 이필선');assert.match(m.links[0].url,/open=deal%3Ad1$/);
});
test('꺼져 있거나 로그인 아니면 보내지 않고, 실패는 조용히',async()=>{
 const root=globalThis;root.TOKEN='';assert.equal(J.on(),false);
 assert.equal(await J.quiet(J.inquiryAssignedMessage({key:'k',nm:'x'},'a','b')),null);
 await assert.rejects(J.send({event:'nope'}),/BAD_EVENT/);
});
