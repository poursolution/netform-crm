'use strict';
/* 오늘 업무 · 관리자 한마디를 종류별로(day-word.js · design_handoff_day_zones §4-4): 줄 분류 · 묶음 요청은 영업건 단위로 한 번만 */
const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../day-word.js');
const G=globalThis;
function setup(comment,rules){
 G.G={};G.B={deals:[1,2,3,4,5].map(n=>({id:'d'+n,site:'현장 '+n,brand:'POUR솔루션',assignee:'이필선'})),inquiries:[]};
 G.repN=v=>String(v||'');G.repManagerWeekKey=()=>'2026-10-05';G.repManagerComment=(rep)=>rep==='이필선'?{rep_name:'이필선',week_start:'2026-10-05',comment,status:'open',created_by:'송보람',updated_at:'2026-10-09T02:00:00Z'}:null;
 G.stageLabel=()=>'실주';G.dealStage=()=>'lost';
 G.KpiV7={stageGroups:()=>[{label:'실주',rules}]};G.KpiB=null;D._reset();
}
const T=(ids,owner)=>ids.map(i=>({kind:'deal',id:'d'+i,name:'현장 '+i,owner:owner||'이필선'}));
test('줄 분류: 공지 · 업무 요청 · 코칭 · 묶음(제목 — n건:)',()=>{
 const L=D.parse('· [KPI 요청] 실주 · 실주 사유 미입력 — 83건: A, B, C 외 80건\n[공지] 단가표 변경\n견적 후 3일 수신 확인\n· [KPI 요청] 기록 시작 — 통화 결과를 남겨 주세요\n· [KPI 요청] 다음 할 일 — 1건: A');
 assert.deepEqual(L.map(l=>l.kind),['업무 요청','공지','코칭','업무 요청','업무 요청']);
 assert.deepEqual(L.map(l=>l.bulk&&[l.bulk.title,l.bulk.n]),[['실주 · 실주 사유 미입력',83],null,null,null,null],'한 건짜리 · 사람에게 온 요청은 묶음이 아니다');
});
test('대상이 겹치는 두 묶음 요청은 한 묶음 · 영업건 단위로 한 번만',()=>{
 setup('· [KPI 요청] 실주 · 사유 미입력 — 4건: 현장 1, 현장 2, 현장 3 외 1건\n· [KPI 요청] 실주 · 재영업 여부 미정 — 2건: 현장 3, 현장 4\n[공지] 단가표 변경',
  [{t:'사유 미입력',targets:T([1,2,3,4]).concat(T([5],'다른사람'))},{t:'재영업 여부 미정',targets:T([3,4])}]);
 const B=D.bulks('이필선');assert.equal(B.length,1);
 assert.deepEqual([B[0].n,B[0].m,B[0].dup,B[0].resolved,B[0].by,B[0].at],[4,2,2,true,'송보람','10.9'],'합친 4건 · 요청 2건 · 겹치는 2건 · 남의 건은 빠진다');
 const h=D.lineHtml('이필선').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
 assert.equal(h,'묶음 요청 송보람 · 10.9 · 실주 · 사유 미입력 외 1 4건 (요청 2건 · 겹치는 2건 합침) → 정보 보완에서 처리 · 지연 · 평가 아님 정보 보완 열기 ›');
 const rows=D.infoRows('이필선',new Set(['deal:d1']),null);
 assert.deepEqual(rows.map(r=>[r.key,r.missTxt]),[['deal:d2','사유 미입력'],['deal:d3','사유 미입력 · 재영업 여부 미정'],['deal:d4','사유 미입력 · 재영업 여부 미정']],'이미 다른 줄에 있는 건(d1)은 다시 넣지 않고, 겹친 건은 한 줄에 요청 내용을 모은다');
 assert.equal(rows[0].bulk.why,'묶음 요청 · 송보람 10.9');assert.equal(rows[0].rk,'bulk');
});
test('같은 제목을 두 번 보낸 것은 겹침으로 세지 않는다 · 다 채우면 줄이 사라진다',()=>{
 const c='· [KPI 요청] 실주 · 사유 미입력 — 3건: 현장 1, 현장 2, 현장 3\n· [KPI 요청] 실주 · 사유 미입력 — 2건: 현장 1, 현장 2';
 setup(c,[{t:'사유 미입력',targets:T([1,2])}]);
 const B=D.bulks('이필선');assert.deepEqual([B.length,B[0].n,B[0].m,B[0].dup],[1,2,2,0]);
 assert.match(D.lineHtml('이필선'),/요청 2건 · 같은 건은 한 번만 셈 · 보낸 3 · 2건 중 남은 것/);
 setup(c,[{t:'사유 미입력',targets:[]}]);assert.equal(D.lineHtml('이필선'),'','남은 대상이 없으면 한 줄도 없다');
});
test('대상 목록을 다시 계산할 수 없는 제목은 보낸 건수만 · 정보 보완 줄은 만들지 않는다',()=>{
 setup('· [KPI 요청] 모르는 요청 — 7건: A, B, C 외 4건',[]);
 const B=D.bulks('이필선');assert.deepEqual([B[0].n,B[0].resolved,B[0].dup],[7,false,null]);
 assert.match(D.lineHtml('이필선'),/모르는 요청 <b>7건<\/b> <small>\(보낸 건수 기준\)<\/small>/);
 assert.deepEqual(D.infoRows('이필선',new Set(),null),[]);
});
test('공지 · 코칭 · 사람에게 온 요청은 알림 목록으로(묶음은 빼고) · 끄기',()=>{
 setup('· [KPI 요청] 실주 · 사유 미입력 — 2건: 현장 1, 현장 2\n[공지] 단가표 변경\n견적 후 3일 수신 확인\n· [KPI 요청] 기록 시작 — 통화 결과를 남겨 주세요',[{t:'사유 미입력',targets:T([1,2])}]);
 G.localStorage={getItem:()=>null,setItem(){}};
 assert.deepEqual(D.notes('이필선').map(n=>[n.kind,n.text,n.seen]),[['공지','단가표 변경',false],['코칭','견적 후 3일 수신 확인',false],['요청','기록 시작 — 통화 결과를 남겨 주세요',false]]);
 assert.match(D.coachHtml('이필선'),/이번 주 코칭<\/b><span[^>]*>견적 후 3일 수신 확인<\/span>/);
 G.G.dayWordOff=true;assert.equal(D.on(),false);assert.equal(D.lineHtml('이필선'),'');assert.equal(D.coachHtml('이필선'),'');assert.deepEqual(D.infoRows('이필선',new Set(),null),[]);G.G.dayWordOff=false;
});
