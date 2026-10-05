/* 목록 쪽 번호 (2026-10-05 대표 전체 지침 — AGENTS.md '목록은 쪽 번호 — 한 쪽 최대 20건')
   모든 목록은 한 쪽에 최대 20건. 누를수록 아래로 길어지는 '나머지 n건 더 보기' 대신 목록 아래 1 2 3 4 5 로 넘긴다.
   쓰는 법(화면마다 따로 만들지 않는다):
     const pg=ListPager.cut(list,ListPager.page(S));        // pg.rows = 이 쪽의 줄, 범위를 벗어난 쪽은 마지막 쪽으로 맞춘다
     html += ListPager.html(pg,{ns:'il',unit:'건'});          // 버튼 = data-il="page" data-page="n" (+ data-v) → 그 화면의 기존 누르기 처리에서 S.page 만 바꿔 다시 그린다
   묶음이 여러 개인 화면은 ListPager.page(S,key) / ListPager.set(S,key,n) 으로 묶음마다 쪽을 따로 둔다.
   공통 필터(브랜드 · 담당 · 검색 · 공종 · 기간)가 바뀌면 1쪽으로 돌아간다 — 화면 안의 탭 · 칩은 그 화면이 S.page=1 로 돌린다. */
(function(root){
 'use strict';
 const SIZE=20;
 const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const num=n=>Number(n).toLocaleString('ko-KR');
 function cut(list,page,size){
  list=Array.isArray(list)?list:[];size=Math.max(1,Math.min(SIZE,Math.floor(Number(size)||SIZE)));
  const total=list.length,pages=Math.max(1,Math.ceil(total/size));page=Math.min(Math.max(1,Math.floor(Number(page)||1)),pages);
  const from=(page-1)*size,to=Math.min(total,from+size);
  return {rows:list.slice(from,to),page,pages,size,total,from,to};
 }
 /* 공통 필터 서명: 바뀌면 그 화면의 쪽을 1쪽으로 */
 function sig(){
  const G=root.G||{};let f='',sc='';
  try{f=root.SalesFilterState?JSON.stringify(root.SalesFilterState.state()):'';}catch(e){}/* 브랜드(여러 개 선택) · 담당 */
  try{sc=G.salesScope?JSON.stringify(G.salesScope):'';}catch(e){}
  return [f,sc,G.brand,G.rep,G.q,G.workFilter,G.year,G.quarter,G.month].map(v=>v==null?'':String(v)).join('|');
 }
 function page(S,key){
  if(!S)return 1;const s=sig();
  if(S.__pgSig!==s){S.__pgSig=s;S.page=1;S.pages={};}
  if(key==null)return Number(S.page)||1;
  return Number((S.pages||{})[key])||1;
 }
 function set(S,key,n){
  if(!S)return;n=Math.max(1,Math.floor(Number(n)||1));
  if(key==null||key==='')S.page=n;else{S.pages=S.pages||{};S.pages[key]=n;}
 }
 const reset=S=>{if(S){S.page=1;S.pages={};}};
 /* 번호: 7쪽 이하면 전부, 넘으면 1 … (지금 앞뒤 2쪽) … 끝 */
 function numbers(p,pages){
  if(pages<=7)return Array.from({length:pages},(_,i)=>i+1);
  let a=Math.max(2,p-2),b=Math.min(pages-1,p+2);
  if(p<=4){a=2;b=5;}if(p>=pages-3){a=pages-4;b=pages-1;}
  const out=[1];if(a>2)out.push(0);for(let i=a;i<=b;i++)out.push(i);if(b<pages-1)out.push(0);out.push(pages);return out;
 }
 function html(pg,opt){
  opt=opt||{};if(!pg||pg.pages<=1)return '';
  const ns=String(opt.ns||'lpg').replace(/[^a-z0-9-]/gi,''),extra=(opt.v!=null?' data-v="'+esc(opt.v)+'"':'')+(opt.attrs?' '+opt.attrs:'');
  const b=(p,label,cls,off,aria)=>'<button type="button" class="lpg-b'+cls+'" data-'+ns+'="page" data-page="'+p+'"'+extra+(off?' disabled':'')+aria+'>'+label+'</button>';
  return '<nav class="lpg'+(opt.small?' sm':'')+'" aria-label="쪽 이동" data-lpg="'+esc(ns+':'+(opt.v==null?'':opt.v))+'">'
   +(opt.info===false?'':'<span class="lpg-info">'+num(pg.from+1)+'–'+num(pg.to)+' / '+num(pg.total)+esc(opt.unit==null?'건':opt.unit)+'</span>')
   +b(pg.page-1,'‹',' lpg-arrow',pg.page<=1,' aria-label="이전 쪽"')
   +numbers(pg.page,pg.pages).map(p=>p?b(p,p,p===pg.page?' on':'',false,p===pg.page?' aria-current="page"':' aria-label="'+p+'쪽"'):'<span class="lpg-gap" aria-hidden="true">…</span>').join('')
   +b(pg.page+1,'›',' lpg-arrow',pg.page>=pg.pages,' aria-label="다음 쪽"')+'</nav>';
 }
 function style(){
  const d=root.document;if(!d||d.getElementById('lpg-style'))return;
  const s=d.createElement('style');s.id='lpg-style';
  /* 화면마다 버튼 규칙이 달라도 쪽 번호는 어디서나 같은 모양이어야 해서 핵심 속성은 !important 로 고정한다 */
  s.textContent='nav.lpg{display:flex!important;align-items:center;justify-content:center;gap:4px;flex-wrap:wrap;padding:12px 16px;margin:0;background:#fff;border:0;border-top:1px solid #f0f1f4;font-family:inherit;width:auto;box-sizing:border-box}'
   +'nav.lpg .lpg-info{font-size:12px;font-weight:400;color:#9ca3af;margin-right:8px;font-variant-numeric:tabular-nums;white-space:nowrap}'
   +'nav.lpg button.lpg-b{box-sizing:border-box!important;flex:none!important;display:inline-flex!important;align-items:center;justify-content:center;min-width:30px!important;width:auto!important;height:30px!important;min-height:0!important;margin:0!important;padding:0 8px!important;border:1px solid #e3e6ec!important;background:#fff!important;color:#374151!important;border-radius:8px!important;font-family:inherit;font-size:13px!important;font-weight:600!important;line-height:1!important;letter-spacing:0;text-align:center;cursor:pointer;box-shadow:none!important;white-space:nowrap}'
   +'nav.lpg button.lpg-b:hover:not(:disabled):not(.on){border-color:#9aa0ab!important;color:#15171c!important}'
   +'nav.lpg button.lpg-b.on{background:#15171c!important;border-color:#15171c!important;color:#fff!important;cursor:default}'
   +'nav.lpg button.lpg-b:disabled{opacity:.35;cursor:default}'
   +'nav.lpg button.lpg-arrow{font-size:15px!important;color:#6b7280!important}'
   +'nav.lpg .lpg-gap{min-width:18px;text-align:center;color:#9ca3af;font-size:13px}'
   +'nav.lpg.sm{padding:8px 10px;gap:3px;border-top:0;background:transparent}nav.lpg.sm button.lpg-b{min-width:26px!important;height:26px!important;font-size:12px!important;padding:0 6px!important;border-radius:7px!important}nav.lpg.sm .lpg-info{font-size:11.5px;margin-right:4px}';
  (d.head||d.documentElement).appendChild(s);
 }
 /* 쪽을 넘기면 목록 맨 위가 보이게: 화면이 다시 그린 뒤 같은 쪽 번호 줄을 찾아 그 목록의 머리로 올린다(이미 보이면 그대로) */
 function follow(){
  const d=root.document;if(!d||d.__lpgFollow)return;d.__lpgFollow=true;
  d.addEventListener('click',e=>{
   const b=e.target&&e.target.closest&&e.target.closest('.lpg .lpg-b');if(!b||b.disabled||b.classList.contains('on'))return;
   const id=b.closest('.lpg').getAttribute('data-lpg');
   root.setTimeout(()=>{
    const nav=[...d.querySelectorAll('.lpg')].find(n=>n.getAttribute('data-lpg')===id);const box=nav&&nav.parentElement;if(!box)return;
    const r=box.getBoundingClientRect();if(r.top<0||r.top>(root.innerHeight||0)*0.6){try{box.scrollIntoView({block:'start'});}catch(err){}}
   },60);
  },true);
 }
 root.ListPager={SIZE,cut,page,set,reset,html,numbers,sig};
 if(root.document){if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>{style();follow();});else{style();follow();}}
})(typeof window==='object'?window:globalThis);
