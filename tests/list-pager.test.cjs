'use strict';
/* 목록 쪽 번호(2026-10-05 대표 전체 지침 — AGENTS.md '목록은 쪽 번호 — 한 쪽 최대 20건'):
   한 쪽 최대 20건 · 1 2 3 4 5 · 누를수록 아래로 길어지는 '나머지 n건 더 보기'는 다시 만들지 않는다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
function load(G){const ctx={G:G||{},setTimeout,console};ctx.window=ctx;ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'list-pager.js'),'utf8').replace("typeof window==='object'?window:globalThis",'window'),ctx);return ctx;}

test('한 쪽 최대 20건 · 범위를 벗어난 쪽은 마지막 쪽으로',()=>{
 const {ListPager:LP}=load(),list=Array.from({length:97},(_,i)=>i+1);
 assert.equal(LP.SIZE,20);
 let pg=LP.cut(list,1);assert.deepEqual([pg.rows.length,pg.rows[0],pg.rows[19],pg.page,pg.pages,pg.from,pg.to,pg.total],[20,1,20,1,5,0,20,97]);
 pg=LP.cut(list,5);assert.deepEqual([pg.rows.length,pg.rows[0],pg.rows[16],pg.from,pg.to],[17,81,97,80,97]);
 assert.equal(LP.cut(list,99).page,5);assert.equal(LP.cut(list,0).page,1);assert.equal(LP.cut(list,'x').page,1);
 assert.equal(LP.cut(list,1,50).rows.length,20,'화면이 더 큰 수를 넘겨도 20건까지만');
 assert.equal(LP.cut(list,2,8).rows[0],9,'묶음은 더 작게 끊을 수 있다');
 assert.deepEqual([LP.cut([],3).rows.length,LP.cut([],3).pages,LP.cut(null,1).total],[0,1,0]);
});

test('쪽 번호: 20건 이하면 없음 · 7쪽 이하면 전부 · 넘으면 1 … 앞뒤 2쪽 … 끝',()=>{
 const {ListPager:LP}=load(),of=n=>Array.from({length:n},(_,i)=>i);
 assert.equal(LP.html(LP.cut(of(20),1),{ns:'il'}),'','20건 이하면 쪽 번호를 그리지 않는다');
 const h=LP.html(LP.cut(of(97),2),{ns:'il',unit:'곳'});
 assert.match(h,/^<nav class="lpg" aria-label="쪽 이동"/);assert.match(h,/<span class="lpg-info">21–40 \/ 97곳<\/span>/);
 assert.deepEqual([...h.matchAll(/data-il="page" data-page="(\d+)"[^>]*>([^<]+)</g)].map(m=>m[1]+':'+m[2]),['1:‹','1:1','2:2','3:3','4:4','5:5','3:›']);
 assert.match(h,/data-page="2" aria-current="page">2</);assert.doesNotMatch(h,/더 ?보기/);
 assert.match(LP.html(LP.cut(of(97),1),{ns:'il'}),/data-page="0" disabled aria-label="이전 쪽"/);assert.match(LP.html(LP.cut(of(97),5),{ns:'il'}),/data-page="6" disabled aria-label="다음 쪽"/);
 const nums=(p,n)=>[...LP.numbers(p,n)];assert.deepEqual(nums(1,5),[1,2,3,4,5]);assert.deepEqual(nums(1,20),[1,2,3,4,5,0,20]);assert.deepEqual(nums(10,20),[1,0,8,9,10,11,12,0,20]);assert.deepEqual(nums(20,20),[1,0,16,17,18,19,20]);
 assert.match(LP.html(LP.cut(of(50),1),{ns:'sb',v:'col:a"b',small:true,info:false}),/^<nav class="lpg sm"[^>]*>(?!<span class="lpg-info">)[\s\S]*data-v="col:a&quot;b"/,'묶음 값은 안전하게 넣는다');
});

test('공통 필터가 바뀌면 1쪽으로 · 묶음마다 쪽을 따로',()=>{
 const ctx=load({brand:'전체',rep:'전체',q:''}),LP=ctx.ListPager,S={};
 assert.equal(LP.page(S),1);LP.set(S,null,3);assert.equal(LP.page(S),3);LP.set(S,'g2',4);assert.equal(LP.page(S,'g2'),4);assert.equal(LP.page(S,'g9'),1);
 ctx.G.q='삼성';assert.equal(LP.page(S),1,'검색이 바뀌면 1쪽');assert.equal(LP.page(S,'g2'),1);
 LP.set(S,null,2);ctx.G.brand='POUR솔루션';assert.equal(LP.page(S),1,'브랜드가 바뀌면 1쪽');
 LP.set(S,null,2);LP.set(S,'g1',2);LP.reset(S);assert.deepEqual([LP.page(S),LP.page(S,'g1')],[1,1]);
});

test("누를수록 아래로 길어지는 '더 보기' 버튼을 다시 만들지 않는다",()=>{
 /* 허용: 메뉴를 여는 '··· 더보기' · 작업 더보기, 칸반 열 아래 '단계 화면으로 가기' */
 const allow={'pipeline-workspace.js':1};
 const bad=[];
 for(const f of fs.readdirSync(root).filter(f=>f.endsWith('.js'))){
  const t=fs.readFileSync(path.join(root,f),'utf8');
  const n=(t.match(/(나머지|다음|\+ ?'\+[\w.]+\+'|\d+)[^'"<>]{0,24}(건|곳|명)?\s*더 ?보기[ ▾]*<\/button>|data-[a-z0-9-]+="more"[^>]*>[^<]*더 ?보기/g)||[]).length;
  if(n>(allow[f]||0))bad.push(f+' '+n);
 }
 assert.deepEqual(bad,[],'쪽 번호(ListPager)로 바꿔야 하는 목록: '+bad.join(', '));
 const html=fs.readFileSync(path.join(root,'crm.html'),'utf8');
 assert.match(html,/release-contract\.js\?v=[^"]+"><\/script><script src="\.\/list-pager\.js\?v=/,'쪽 번호 도우미는 화면 모듈보다 먼저 싣는다');
 for(const f of ['stage-board.js','pipeline-stage-b.js','pipeline-rel-b.js','asset-c.js','inquiry-list-v3.js','today-v3.js','today-assist.js','today-tower.js','kpi-b.js','pipeline-list-v2.js','expansion-v2.js','gyeongnam-v2.js','asset-v2.js','work-v2.js','dup-v2.js','inquiry-list-v2.js','today-v2.js','relationship-management.js','stage-workspaces.js','technical-advisory-ui.js'])
  assert.match(fs.readFileSync(path.join(root,f),'utf8'),/\bListPager\b/,f+' 는 공용 쪽 번호를 쓴다');
});
