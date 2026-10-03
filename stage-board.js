/* 단계 보드 공용 부품 (2026-10-03 대표: "확장관리 · 경남지사 · 고객자산 · 문자 전부 파이프라인 기준으로")
   파이프라인 단계별 B안(pipeline-stage-b)과 같은 틀을 다른 화면이 쓴다 — 왼쪽 진단(막대 3칸 · 숫자 3개 · 왜 멈춰 있나 · 뭘 해야 하나) / 오른쪽 확인할 현장(리스트 · 보드).
   CSS 는 pipeline-stage-b.css 의 .psb-* 그대로. 화면마다 CFG(S 막대 3칸 · RS 사유 · 설명)와 행(items)만 만들어 넘긴다.
   items: {key, site, brand, owner, amount, bucket, sub, rs:[사유키], stall(일수), extra?} — 정렬은 B안과 같다: 첫 빨강 사유 순 → 사유 수 → 일수.
   클릭은 data-sb 로 받는다(bucket · reason · clear · view · more · act · open). 저장은 없다 — 열기 · 액션은 화면이 넘긴 open(key,act)로. */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const RED='#d93a3a',INK='#374151';
 const BRAND={'석민이앤씨':'#e8590c','POUR솔루션':'#1f9d55','POUR공법':'#7048e8','아파트스퀘어':'#3b6ce4'};
 const money=v=>{const n=Number(v)||0;if(!n)return '금액 미정';if(n>=1e8)return (Math.round(n/1e7)/10)+'억';if(n>=1e4)return Math.round(n/1e4).toLocaleString('ko-KR')+'만';return n.toLocaleString('ko-KR');};
 const isRedOf=C=>k=>!!(C.RS[k]&&C.RS[k][1]===RED);
 /* 정렬 + 우선 사유 */
 function rank(C,items){
  const isRed=isRedOf(C),order=Object.keys(C.RS);
  const out=items.map(it=>{const rs=it.rs||[];const first=rs.find(isRed)||rs[0]||'';const i=order.findIndex(k=>rs.includes(k)&&isRed(k));return Object.assign({},it,{rs,first,red:rs.some(isRed),pri:i<0?99:i,stall:Number(it.stall)||0});});
  out.sort((a,b)=>a.pri-b.pri||b.rs.length-a.rs.length||b.stall-a.stall||String(a.site||'').localeCompare(String(b.site||''),'ko'));
  return out;
 }
 const dayLabel=(C,n)=>(C.stallUnit||'')+n+'일';
 function rowHtml(C,it,reason){
  const k=reason||it.first,rs=k?C.RS[k]:null,bc=BRAND[it.brand]||'#9ca3af',S=C.S.find(s=>s[0]===it.bucket)||C.S[0],hot=C.stallRed!=null&&it.stall>C.stallRed;
  return '<div class="psb-row" role="row" tabindex="0" data-sb="open" data-key="'+attr(it.key)+'" style="border-left-color:'+bc+'"><div class="l"><b title="'+attr(it.site)+'">'+h(it.site)+(it.badge||'')+'</b><span><em style="color:'+bc+'">'+h(it.brand||'브랜드 미지정')+'</em> · '+h(it.owner||'미배정')+' · '+h(it.amountText||money(it.amount))+'</span></div><div class="r"><div class="s"><b style="color:'+(S[2]==='#15171c'?'#15171c':'#6b7280')+'">'+h(S[1].split(' · ')[0])+'</b><span>'+h(it.sub)+'</span></div><span class="i" style="color:'+(rs?rs[1]:'#6b7280')+'">'+h(rs?rs[0]:'정상')+'</span><b class="d'+(hot?' r':'')+'">'+h(dayLabel(C,it.stall))+'</b><button type="button" data-sb="act" data-key="'+attr(it.key)+'" data-v="'+attr(k||'')+'">'+h(rs?rs[2]:(C.openLabel||'열기'))+'</button></div></div>';
 }
 function cardHtml(C,it,reason){
  const k=reason||it.first,rs=k?C.RS[k]:null,bc=BRAND[it.brand]||'#9ca3af',hot=C.stallRed!=null&&it.stall>C.stallRed;
  return '<div class="psb-card" role="button" tabindex="0" data-sb="open" data-key="'+attr(it.key)+'" style="border-left-color:'+bc+'"><div class="t"><b style="color:'+bc+'">'+h(it.brand||'브랜드 미지정')+'</b><i></i><b class="'+(hot?'r':'')+'">'+h(dayLabel(C,it.stall))+'</b></div><strong>'+h(it.site)+'</strong><span>'+h(it.sub)+' · '+h(it.amountText||money(it.amount))+'</span><div class="b"><em style="color:'+(rs?rs[1]:'#6b7280')+'">'+h(rs?rs[0]:'정상')+'</em><i></i><button type="button" data-sb="act" data-key="'+attr(it.key)+'" data-v="'+attr(k||'')+'">'+h(rs?rs[2]:(C.openLabel||'열기'))+'</button></div></div>';
 }
 /* C: {id,name,desc,axis,S,RS,unit,stallUnit,stallRed,openLabel,kpi2?:(inB,cnt)=>[label,value,sub], topHtml?, moreTitle?} · S 상태: {view,bucket,reason,limit} */
 function html(C,rawItems,S){
  const items=rank(C,rawItems),isRed=isRedOf(C),unit=C.unit||'곳';
  const inB=items,byS=S.bucket==='all'?inB:inB.filter(i=>i.bucket===S.bucket),listed=S.reason?byS.filter(i=>i.rs.includes(S.reason)):byS;
  const n=inB.length||1,cnt=k=>inB.filter(i=>i.bucket===k).length,W=C.S.map(s=>Math.round(cnt(s[0])/n*100));
  const sumAmt=inB.reduce((s,i)=>s+(Number(i.amount)||0),0),avg=Math.round(inB.reduce((s,i)=>s+i.stall,0)/n),redN=inB.filter(i=>i.red).length;
  const reasons=Object.keys(C.RS).map(k=>({k,n:byS.filter(i=>i.rs.includes(k)).length})).filter(x=>x.n>0);
  const acts=(S.reason?[S.reason]:reasons.slice(0,3).map(x=>x.k)).map(k=>({tag:C.RS[k][0]+' '+byS.filter(i=>i.rs.includes(k)).length+unit,t:C.RS[k][3]}));
  const filters=[S.bucket!=='all'?(C.S.find(s=>s[0]===S.bucket)||[])[1]:null,S.reason?C.RS[S.reason][0]:null].filter(Boolean);
  const k2=C.kpi2?C.kpi2(inB,cnt):[C.S[0][1],cnt(C.S[0][0])+unit,C.S[0][3]];
  const k3=C.kpi3?C.kpi3(inB,avg):['평균 '+(C.stallName||'체류'),avg+'일',C.stallDesc||'이 단계에 머문 일수'];
  const diag='<section class="psb-diag"><div class="psb-box"><header><b>'+h(C.diagTitle||'진단')+'</b><span>'+inB.length+unit+(C.noAmount?'':' · '+h(money(sumAmt)))+'</span><i></i>'+(filters.length?'<button type="button" class="lnk" data-sb="clear">필터 해제</button>':'')+'</header>'
   +'<div class="psb-axis"><span>'+h(C.axis)+'</span><div class="bar">'+C.S.map((s,i)=>'<div style="width:'+W[i]+'%;background:'+s[2]+'"></div>').join('')+'</div><div class="leg">'+C.S.map(s=>'<button type="button" data-sb="bucket" data-v="'+s[0]+'" aria-pressed="'+(S.bucket===s[0])+'"><i style="background:'+s[2]+'"></i>'+h(s[1])+' <b>'+cnt(s[0])+'</b></button>').join('')+'</div></div>'
   +'<div class="psb-kpis"><div><span>기준 넘김 (빨강)</span><b style="color:'+(redN?RED:'#15171c')+'">'+redN+unit+'</b><small>오늘 처리할 것</small></div><div><span>'+h(k2[0])+'</span><b>'+h(k2[1])+'</b><small>'+h(k2[2])+'</small></div><div><span>'+h(k3[0])+'</span><b>'+h(k3[1])+'</b><small>'+h(k3[2])+'</small></div></div></div>'
   +'<div class="psb-two"><div class="psb-box"><header><b>왜 멈춰 있나</b><span>누르면 오른쪽이 걸러짐</span></header>'+(reasons.length?reasons.map(x=>'<button type="button" class="psb-reason" data-sb="reason" data-v="'+x.k+'" aria-pressed="'+(S.reason===x.k)+'"><span>'+h(C.RS[x.k][0])+'</span><b style="color:'+C.RS[x.k][1]+'">'+x.n+'</b><i><u style="width:'+(byS.length?Math.round(x.n/byS.length*100):0)+'%;background:'+(isRed(x.k)?RED:'#9aa0ab')+'"></u></i></button>').join(''):'<p class="psb-none">멈춘 사유가 없습니다</p>')+'</div>'
   +'<div class="psb-box"><header><b>그래서 뭘 해야 하나</b></header>'+(acts.length?acts.map(a=>'<div class="psb-act"><span>'+h(a.tag)+'</span><p>'+h(a.t)+'</p></div>').join(''):'<p class="psb-none">기준을 넘긴 곳이 없습니다</p>')+'</div></div>'+(C.sideHtml||'')+'</section>';
  const shown=listed.slice(0,S.limit||30);
  const head='<div class="psb-lhead"><b>'+h(C.listTitle||'확인할 현장')+' <span>'+listed.length+unit+'</span></b>'+(filters.length?'<em>'+h(filters.join(' · '))+'</em>':'')+'<i></i><div class="psb-views"><button type="button" data-sb="view" data-v="list" aria-pressed="'+(S.view==='list')+'">리스트</button><button type="button" data-sb="view" data-v="board" aria-pressed="'+(S.view==='board')+'">보드</button></div></div>';
  let body;
  if(S.view==='board')body='<div class="psb-board">'+C.S.map(s=>{const cards=listed.filter(i=>i.bucket===s[0]).slice(0,40);return '<div class="psb-col"><div class="ch"><i style="background:'+s[2]+'"></i><b>'+h(s[1])+'</b><span>'+cards.length+'</span><em>'+h(s[3])+'</em></div>'+(cards.length?cards.map(i=>cardHtml(C,i,S.reason)).join(''):'<p class="psb-none">없음</p>')+'</div>';}).join('')+'</div>';
  else body='<div class="psb-list">'+(shown.length?shown.map(i=>rowHtml(C,i,S.reason)).join(''):'<div class="psb-empty">'+h(C.empty||'해당하는 곳이 없습니다.')+'</div>')+(listed.length>shown.length?'<button type="button" class="psb-more" data-sb="more">나머지 '+(listed.length-shown.length)+'건 더 보기</button>':'')+'</div>';
  return '<div id="'+attr(C.id)+'" class="psb sb" data-board="'+attr(C.id)+'"><div class="psb-head"><b>'+h(C.name)+'</b><span>'+h(typeof C.desc==='function'?C.desc():C.desc)+'</span></div>'+(C.topHtml||'')+'<div class="psb-body">'+diag+'<section class="psb-main">'+head+body+'</section></div></div>';
 }
 /* 클릭 연결: ctx = {state():S, cfg():C, paint(), open(key,act)} — host 에 한 번만 붙는다 */
 function bind(host,ctx){
  if(host.__sb)return;host.__sb=true;
  host.addEventListener('click',e=>{
   const b=e.target.closest('.sb [data-sb]');if(!b||!host.contains(b))return;const S=ctx.state(),a=b.dataset.sb,v=b.dataset.v,C=ctx.cfg();
   if(a==='bucket'){S.bucket=S.bucket===v?'all':v;S.reason=null;return ctx.paint();}
   if(a==='reason'){S.reason=S.reason===v?null:v;return ctx.paint();}
   if(a==='clear'){S.bucket='all';S.reason=null;return ctx.paint();}
   if(a==='view'){S.view=v;return ctx.paint();}
   if(a==='more'){S.limit=(S.limit||30)+30;return ctx.paint();}
   e.stopPropagation();
   if(a==='act')return ctx.open(b.dataset.key,C&&C.RS[v]?C.RS[v][4]:'',v);
   if(a==='open'&&!e.target.closest('button'))return ctx.open(b.dataset.key,'','');
  },true);
  host.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('.sb [data-sb="open"]')){e.preventDefault();e.target.click();}});
 }
 const state=key=>{const G=root.G;G.sb=G.sb||{};return G.sb[key]||(G.sb[key]={view:'list',bucket:'all',reason:null,limit:30});};
 root.StageBoard={html,bind,rank,state,money,RED,INK,BRAND};
})(window);
