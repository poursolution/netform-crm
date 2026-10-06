'use strict';
/* 진행 범위 하나(PipelineScope) — '진행 중'과 '과거 이관 · 분류 전'을 가르는 정본 (2026-10-05 대표 승인 · design_handoff_consistency ② ③)
   숫자를 고정하지 않는다 — 규칙을 고정한다. 파이프라인 · 대시보드 · 오늘 업무 · 주간 브리핑이 모두 이 함수만 쓴다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
function ctx(){
 const w={console,Object,Array,String,Number,Set,Map,JSON,Math};w.window=w;w.globalThis=w;w.G={};w.B={deals:[]};
 /* 화면의 결과 판정(outcomeOf)과 같은 뜻: 수주 · 실주 · Bad Fit · 연락두절은 열린 건이 아니다 */
 w.outcomeOf=d=>d.code==='won'||d.code==='expansion'?'won':d.code==='lost'?'lost':/^badfit/.test(d.code||'')?'badfit':d.code==='nocontact'?'nocontact':'open';
 w.repProfile=n=>({'이필선':{id:'u1',name:'이필선',active:true,salesRep:true},'이승우':{id:'u2',name:'이승우',active:true,salesRep:false},'주현진':{id:'u3',name:'주현진',active:false}})[n]||{id:'legacy:'+n,name:n,active:true};
 vm.createContext(w);vm.runInContext(read('pipeline-stages.js'),w);vm.runInContext(read('pipeline-scope.js'),w);return w;
}
const d=(code,o)=>Object.assign({id:code||'none',code,stage_code:code},o);

test('진행 중 = 현재 CRM 유효 단계 값 + 열린 건',()=>{
 const P=ctx().PipelineScope;
 for(const c of ['first_contact','consulting','sent','rapport','silent','waiting','compete','imminent','bidding','contract','construction','completion']){assert.equal(P.isActive(d(c)),true,c);assert.equal(P.isLegacy(d(c)),false,c);}
 for(const c of ['won','lost','badfit','badfit_lead','badfit_pipe','nocontact','expansion']){assert.equal(P.isActive(d(c)),false,c);assert.equal(P.isLegacy(d(c)),false,c+' 은 과거 이관이 아니다(결과가 난 건)');}
});

test('과거 이관 · 분류 전 = 열린 건인데 현재 CRM 단계 값이 아닌 것 — 진행도 실주도 아니다',()=>{
 const w=ctx(),P=w.PipelineScope;
 for(const c of ['qualified','potential','nurturing','working','',undefined,null,'something_else']){const x=d(c);assert.equal(P.isLegacy(x),true,String(c));assert.equal(P.isActive(x),false,String(c));assert.equal(w.outcomeOf(x),'open','실주 · 종결로 바뀌지 않는다');}
 assert.deepEqual(['qualified','potential','nurturing','working'].map(c=>P.oldStage(d(c))),['검증된 고객','잠재고객','후속 관리 고객','접촉단계']);
 assert.equal(P.oldStage(d('',{stage:'서포트 단계'})),'서포트 단계');assert.equal(P.oldStage(d('',{stage_raw:'검증된 고객(Qualified)'})),'검증된 고객');assert.equal(P.oldStage(d('')),'단계 없음');
 /* 서버는 출발 단계 값이 저장된 값과 같아야 전환을 받는다 — 값이 비어 있는 과거 이관 건은 'unclassified' 로 보낸다(sql/transition-null-stage-v1-20261007.sql · 서버가 NULL 을 그 값으로 본다) */
 assert.equal(P.canResume(d('qualified')),true);assert.equal(P.canResume(d('')),true);assert.equal(P.rawCode(d('qualified')),'qualified');
 assert.equal(P.NULL_FROM,'unclassified');assert.equal(P.fromCode(d('qualified')),'qualified');assert.equal(P.fromCode(d('')),'unclassified');assert.equal(P.rawCode(d('')),'','저장된 값 자체는 그대로 빈 값');
 assert.equal(P.fromCode(d('sent')),'sent');assert.equal(P.fromCode(d('won')),'won','과거 이관이 아닌 건은 저장된 값 그대로');
});

test('나누기 · 기준 한 줄 · 끄기',()=>{
 const w=ctx(),P=w.PipelineScope,list=[d('sent'),d('consulting'),d('qualified'),d('potential'),d(''),d('won'),d('lost')];
 const sp=P.split(list);assert.deepEqual([sp.active.length,sp.legacy.length],[2,3]);
 assert.equal(P.basis(),'기준: 현재 CRM 유효 단계(컨설팅 설계 · 자료 발송완료 · 관계관리 · 경쟁·입찰 · 계약·시공) · 열린 건(수주 · 실주 · Bad Fit · 연락두절 · 종결 제외) · 과거 이관 · 분류 전 제외');
 assert.equal(P.LABEL,'과거 이관 · 분류 전');
 /* 직원 명단에 있는 사람(영업 담당이 아니어도)과 명단에 없는 이름 */
 assert.deepEqual(['이필선','이승우','주현진','미등록 담당자'].map(n=>P.ownerKnown(n)),[true,true,false,false]);
 w.G.pipeScopeOff=true;assert.equal(P.isLegacy(d('qualified')),false,'끄면 예전처럼');assert.equal(P.isActive(d('qualified')),true);
});

test('모든 화면이 같은 판정을 쓴다(코드 연결)',()=>{
 const html=read('crm.html'),pw=read('pipeline-workspace.js'),ui=read('stage-transition-ui.js'),br=read('brief-b.js'),dv=read('deal-detail-v3.js');
 /* 오늘 업무 · 관제탑 · 대시보드 · KPI 의 진행 판정 */
 assert.match(html,/function towerActive\(d\)\{if\(window\.PipelineScope&&PipelineScope\.on\(\)\)return PipelineScope\.validStage\(d\);/);
 /* 과거 이관은 열린 건 그대로(실주 · 종결 계산에 섞이지 않는다) — 진행을 셀 때만 뺀다 */
 assert.match(html,/function isOpen\(d\)\{return outcomeOf\(d\)==='open'\}/);assert.match(html,/function isActiveDeal\(d\)\{return isOpen\(d\)&&!isLegacyDeal\(d\)\}/);
 assert.match(html,/function briefScopeDeal\(d,name\)\{var owner=repN\(d\.assignee\);return !isLegacyDeal\(d\)&&/,'주간 브리핑 범위에서 뺀다(진행 · 정체 · 실주 어디에도 안 들어간다)');
 assert.ok(html.indexOf('pipeline-scope.js?v=')>0&&html.indexOf('pipeline-scope.js?v=')<html.indexOf('pipeline-workspace.js?v='),'범위 모듈을 먼저 싣는다');
 /* 파이프라인: 기본은 진행 건만 · 과거 이관은 따로 */
 assert.match(pw,/legacy=!!\(PS\(\)&&PS\(\)\.isLegacy\(d\)\),group=legacy\?'legacy':S\.group\(code,outcome\);if\(L!=='all'&&legacy!==\(L==='only'\)\)continue;/);
 assert.match(pw,/data-value="legacy"/);assert.match(pw,/root\.PipelineLegacy\.html\(rows\(undefined,\{legacy:'only'\}\)\)/);
 /* 영업 재개: 서버에 저장된 예전 단계 값에서 출발(first_contact 로 바꿔 보내면 서버가 거절한다) */
 assert.match(ui,/const fromOf=d=>\{try\{const P=root\.PipelineScope;if\(P&&P\.on\(\)&&P\.isLegacy\(d\)\)\{const f=P\.fromCode\?P\.fromCode\(d\):P\.rawCode\(d\);if\(f\)return f;\}\}catch\(e\)\{\}return dealStage\(d\);\};/);
 assert.equal((ui.match(/mobile\?d(?:eal)?\.code:fromOf\(/g)||[]).length,2);
 assert.match(dv,/legacy\?\(PSC\.fromCode\?PSC\.fromCode\(d\):PSC\.rawCode\(d\)\):root\.dealStage\(d\)/);assert.match(dv,/lg\?\(PSC\.fromCode\?PSC\.fromCode\(d\):PSC\.rawCode\(d\)\):root\.dealStage\(d\)/);assert.match(dv,/S\.mvLabel=legacy\?'영업 재개':'단계 바꾸기'/);
 assert.match(br,/function scopeLine\(x\)/);
});
