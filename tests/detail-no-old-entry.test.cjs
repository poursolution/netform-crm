'use strict';
/* 새로 만든 화면이 있으면 버튼 · 메뉴는 새 화면으로 간다 — 예전 화면이 눈에 띄지 않게(2026-10-05 대표 지침).
   ① 상세 창 머리줄의 [⋯ 작업 더보기] 메뉴는 없앴다 ② 목록의 [미팅 잡기] 류 버튼은 새 상세(v3)의 자리로 먼저 간다 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
test('상세 창 머리줄의 [⋯ 작업 더보기] 메뉴를 다시 만들지 않는다',()=>{
 const js=read('detail-actions.js');
 assert.doesNotMatch(js,/className='da-more'|className='da-toolbar'|작업 더보기'/);
 for(const f of ['deal-detail-v2.js','deal-detail-v3.js'])assert.doesNotMatch(read(f),/\.da-tools|\.da-more/,f);
});
test('목록 버튼([미팅 잡기] · [확인 연락] · [견적 요청] · [단계 판단])은 새 상세의 자리로 먼저 간다',()=>{
 const b=read('pipeline-stage-b.js'),i=b.indexOf('DealDetailV3.openFrom(act)'),j=b.indexOf('root.DetailActions.open(act)');
 assert.ok(i>0&&j>i,'새 상세(openFrom)를 먼저, 예전 입력 창은 그다음');
 const v3=read('deal-detail-v3.js');
 assert.match(v3,/function openFrom\(act\)/);assert.match(v3,/NXT,openFrom[,}]/);
 /* next · activity 는 예전 창(DetailActions · DealPanelsV2)을 부르지 않고 '지금 할 일' 카드를 펼친다 */
 const body=v3.slice(v3.indexOf('function openFrom(act)'),v3.indexOf("if(act==='stagefields')"));/* next · activity 부분 */
 assert.doesNotMatch(body,/DetailActions\.open|DealPanelsV2/);assert.match(body,/S\.rec=\{ch:'전화'/);
 /* 정돈안(2026-10-06): 연락 입구는 가운데 입력칸 하나 — 오른쪽 카드 안의 입력 틀을 펼치지 않고 입력칸으로 간다 */
 assert.match(body,/if\(tidy\(\)\)\{if\(!S\.calling\)startCall\(d,true\);show\('#ddvComposer'\);return true;\}/);
});
test("'지금 할 일' 카드의 [직접 정하기]는 카드 안에서 날짜를 고른다 — 예전 '다음 할 일 설정' 창을 열지 않는다",()=>{
 const v3=read('deal-detail-v3.js'),i=v3.indexOf("if(a==='nextmore')"),line=v3.slice(i,v3.indexOf('\n',i));
 assert.ok(i>0);assert.doesNotMatch(line,/DetailActions\.open|DealPanelsV2/);assert.match(line,/nextDate=true/);
});
test('연락 결과 · 다음 할 일 바로가기(dccGoActivity · briefNextAction)는 새 상세에서 지금 할 일 카드로 간다',()=>{
 const js=read('detail-actions.js'),i=js.indexOf('function focus(id)'),line=js.slice(i,js.indexOf('\n',i));
 assert.ok(i>0);assert.ok(line.indexOf('DealDetailV3.openFrom(key)')>0&&line.indexOf('DealDetailV3.openFrom(key)')<line.indexOf('open(key);return true'),'새 상세를 먼저');
});
