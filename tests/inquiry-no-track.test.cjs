'use strict';
/* 협약 문의는 추적하지 않는다(2026-10-01 대표) — 공종 기준으로만 판정한다 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','crm.html'),'utf8');
function fn(name){const i=html.indexOf('function '+name+'(');assert.ok(i>=0,name);return html.slice(i,html.indexOf('\n',i))}
const ctx={CLOSED_ST:['수주','실주','종결','종료']};vm.createContext(ctx);vm.runInContext(fn('inqNoTrack')+'\n'+fn('isClosedInq'),ctx);
test('공종이 협약이면 상태와 무관하게 추적 제외',()=>{
 assert.equal(ctx.isClosedInq({status:'접수',work_type:'협약문의'}),true);
 assert.equal(ctx.isClosedInq({status:'배정완료',raw:{'공사유형':'협약서 요청'}}),true);
});
test('글에만 협약이 들어간 공사 문의는 계속 추적',()=>{
 assert.equal(ctx.isClosedInq({status:'접수',work_type:'옥상방수',raw:{'문의내용':'협약업체 소개로 옥상방수 문의'}}),false);
 assert.equal(ctx.isClosedInq({status:'접수',raw:{'문의내용':'협약 관련 문의'}}),false);
});
test('종결 상태는 그대로 종결',()=>assert.equal(ctx.isClosedInq({status:'종결'}),true));
