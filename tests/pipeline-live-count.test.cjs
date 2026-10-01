'use strict';
/* 지표 단일화(2026-10-01 컨설턴트 4항): 파이프라인 메뉴 숫자와 페이지 상단 '진행'이 같은 판정(liveRow)을 쓴다 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const js=fs.readFileSync(path.join(__dirname,'..','pipeline-workspace.js'),'utf8');
test('메뉴 숫자·상단 띠·단계 지표가 같은 진행 판정을 쓴다',()=>{
 assert.match(js,/function liveRow\(r\)\{return !\['won','lost','expansion'\]\.includes\(r\.group\);\}/);
 assert.match(js,/const live=data\.filter\(liveRow\)\.length;/);
 assert.match(js,/const act=all\.filter\(liveRow\)/);
 assert.match(js,/const active=list\.filter\(liveRow\)/);
 assert.doesNotMatch(js,/filter\(r=>!\['won','lost'\]\.includes\(r\.group\)\)/,'확장 기회를 더하는 옛 판정');
});
test('숫자에 기준 설명이 붙는다',()=>{
 assert.match(js,/badge\.title='기준: 진행 중 영업건/);
 assert.match(js,/function liveBasis\(\)/);
 const html=fs.readFileSync(path.join(__dirname,'..','crm.html'),'utf8');
 assert.match(html,/inqBadge'\)\.title='기준: 미배정 문의/);
 assert.match(html,/pipe:\['파이프라인','기준: 공사예정년도/);
 assert.match(html,/inq:\['견적문의 관제','기준: 접수일/);
});
