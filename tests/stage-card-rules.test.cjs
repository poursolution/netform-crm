'use strict';
/* 2026-10-23 01 오늘: 견적문의(그룹 없는 코드)가 '컨설팅'(방문 결과 조건)으로 떨어지던 것 — PipelineStages.group 이 null 이면 String(null)='null' */
const {test}=require('node:test');
const assert=require('node:assert/strict');
globalThis.PipelineStages=require('../pipeline-stages.js');
const R=require('../stage-card-rules.js');

test('견적문의 첫 연락 = 견적문의 기준(방문 결과 조건 없음)', ()=>{
 assert.equal(R.keyOf('inquiry'),'inquiry');
 const r=R.of('inquiry');
 assert.equal(r.done,'연결돼서 확인한 내용을 남기면 끝');
 assert.ok(!/방문 결과|실측/.test(r.check+' '+r.done),'첫 연락에 방문 완료 조건을 붙이지 않는다');
});

test('기존 단계 판정은 그대로', ()=>{
 assert.equal(R.keyOf('consulting'),'consulting');
 assert.equal(R.keyOf('first_contact'),'consulting','컨설팅 설계단계 그룹(PipelineStages)');
 assert.equal(R.keyOf('rapport'),'relationship');
 assert.equal(R.keyOf('bidding'),'compete','경쟁 · 입찰(그룹 competition)');
 assert.equal(R.keyOf('imminent'),'compete');
 assert.equal(R.of('compete').done,'실제 제출 근거를 남기면 끝');
 assert.equal(R.keyOf('contract'),'contract');
 assert.equal(R.keyOf('sent'),'sent');
 assert.equal(R.keyOf('compete','won'),'won');
 assert.equal(R.keyOf('compete','lost'),'lost');
});
