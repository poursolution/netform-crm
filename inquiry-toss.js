/* 견적문의 · 토스 방식 목록 (2026-10-18 대표 "토스 스타일로 차용" → PC 시안 확인 뒤 "진행해")
   무엇이 문제였나: v5(화살표 띠 · 칩 · 4칸 보드)도 한눈에 '지금 뭘 하면 되는지'가 안 들어왔다.
   여기서 하는 것(공사 견적문의 탭만 — 위쪽 탭 · 브랜드 칩 · 검색, 협약문의 · B2B, 상세 창, 다른 메뉴는 그대로):
     · 맨 위 문장 하나: 지금 가장 급한 일 한 가지를 건수와 함께("첫 연락을 기다리는 문의가 4건 있어요") + 근거 한 줄.
     · 단계 숫자 4칸(v5 와 같은 단계 · 같은 건수 — InquiryV5.compute). 누르면 그 단계만.
     · 확인 필요는 회색 한 줄(건수 있는 것만) — 누르면 그 경고가 붙은 문의만.
     · 목록 = 할 일로 묶은 흰 상자(담당자를 정해 주세요 → 첫 연락이 필요해요 → 기한이 지났어요 → 오늘 할 일 → 다가오는 일 → 기한을 정해 주세요 → 기록을 확인해 주세요).
       한 줄 = 기다린 시간/기한 · 현장(브랜드 · 공종 · 다음 할 일) · 담당 · 접수일 · 버튼 하나. 한 쪽 20건 + 쪽 번호(묶음을 넘어 이어서 센다).
     · 오른쪽 = 고른 문의 요약 + 버튼 둘(할 일 하나 = 파랑 · 상세 열기). 줄을 한 번 더 누르면 상세 창.
   판정은 새로 하지 않는다: 단계 · 경고 · 기한 · 다음 할 일 = 견적문의 흐름 v5 의 것(InquiryV5.lib), 늦음 = 목록 · 오늘 업무와 같은 late.
   끄기: G.inqTossOff=true → 견적문의 흐름 v5. */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const V5=()=>root.InquiryV5,W=()=>root.InquiryWorkbench,LP=()=>root.ListPager,L3=()=>root.InquiryListV3;
 const on=()=>!(root.G&&root.G.inqTossOff)&&!!V5()&&V5().on()&&!!V5().lib;
 const DEF={st:null,wf:'',sel:'',page:1};
 function st(){const g=root.G;if(!g.inqToss||!g.inqToss._t)g.inqToss=Object.assign({},DEF,{_t:true});return g.inqToss;}
 const pad=n=>String(n).padStart(2,'0');
 const todayStr=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());};
 const dayDiff=ymd=>Math.round((Date.parse(ymd+'T00:00:00')-Date.parse(todayStr()+'T00:00:00'))/864e5);
 const md=t=>{if(typeof t==='string'&&/^\d{4}-\d{2}-\d{2}/.test(t))return Number(t.slice(5,7))+'.'+Number(t.slice(8,10));const d=new Date(t);return Number.isFinite(d.getTime())?(d.getMonth()+1)+'.'+d.getDate():'';};
 const repName=n=>{try{return root.repDisplay(n)||String(n||'');}catch(e){return String(n||'');}};
 const isAdmin=()=>{try{return !!root.inqCtlIsAdmin();}catch(e){return false;}};
 /* 할 일 묶음: [열쇠, 제목, 판정] — 위에서부터 처음 맞는 하나에만 들어간다 */
 const GROUPS=[['asg','담당자를 정해 주세요',(m)=>m._s===0],
  ['first','첫 연락이 필요해요',(m)=>m._s===1],
  ['fix','기록을 확인해 주세요',(m)=>!!(m.review&&m.review.required)],
  ['late','기한이 지났어요',(m,d)=>d.late],
  ['today','오늘 할 일',(m)=>!!m.dueDay&&dayDiff(m.dueDay)===0],
  ['soon','다가오는 일',(m)=>!!m.dueDay&&dayDiff(m.dueDay)>0],
  ['none','기한을 정해 주세요',()=>true]];
 const ORDER=['asg','first','late','today','soon','none','fix'];
 const lib=()=>V5().lib;
 /* 단계 칸 아래 한 줄(칸 폭에 들어가게 짧게) */
 const note=i=>['담당을 정하면 다음 단계','실제 연결되면 다음 단계','정보 9개 채우면 다음 단계','견적 보내면 '+(V5().promoStage()||'영업건')+'(으)로'][i]||'';
 const workOf=m=>/미분류/.test(String(m.work||''))?'':String(m.work||'');
 function due(m){try{return lib().dueOf(m,m._s);}catch(e){return {t:'',late:false};}}
 function nextOf(m){try{return lib().nextOf(m,m._s);}catch(e){return '';}}
 function evOf(m){try{return lib().evOf(m,m._s);}catch(e){return '';}}
 function groupOf(m){const d=due(m);for(const g of GROUPS){try{if(g[2](m,d))return g[0];}catch(e){}}return 'none';}
 /* 왼쪽 네모 안 글자: 담당 · 첫 연락은 기다린 시간, 그 밖은 기한 */
 function badge(m,g){
  if(g==='asg'||g==='first')return {t:m.el&&m.el!=='—'?m.el:'새로',red:!!m.late};
  if(g==='fix')return {t:'확인',red:false};
  if(m.dueDay){const dd=dayDiff(m.dueDay);return dd<0?{t:(-dd)+'일',red:true,sub:'지남'}:dd===0?{t:'오늘',red:false}:{t:md(m.dueDay),red:false};}
  if(m.follow&&m.late&&m.sinceLast!=null)return {t:m.sinceLast+'일',red:true,sub:'연락 없음'};
  return {t:'—',red:false};
 }
 /* 줄의 버튼 하나(일어날 일 그대로) */
 function action(m,g){
  if(g==='asg')return {label:isAdmin()?'배정하기':'담당 확인',act:'assign'};
  if(g==='first')return {label:'첫 연락하기',act:'open'};
  if(g==='fix')return {label:'기록 확인',act:'open'};
  return {label:'결과 남기기',act:'open'};
 }
 let VIEW={all:[],list:[],groups:{},cols:[[],[],[],[]],warn:{}};
 function compute(){
  const S=st(),V=V5().compute(),T=V.all;
  if(S.st!=null&&!(S.st>=0&&S.st<4))S.st=null;if(S.wf&&!V5().CHIPS.includes(S.wf))S.wf='';
  T.forEach(m=>{m._g=groupOf(m);});
  const pick=T.filter(m=>(S.st==null||m._s===S.st)&&(!S.wf||m._w.includes(S.wf)));
  const INF=1e18,rank=k=>ORDER.indexOf(k);
  const list=pick.slice().sort((a,b)=>rank(a._g)-rank(b._g)||(b.late?1:0)-(a.late?1:0)||(a.due==null?INF:a.due)-(b.due==null?INF:b.due)||(a.x.created||0)-(b.x.created||0));
  const groups={};ORDER.forEach(k=>{groups[k]=T.filter(m=>m._g===k);});
  return (VIEW={all:T,list,groups,cols:V.cols,warn:V.warn});
 }
 /* 맨 위 문장 — 급한 순으로 하나만 */
 function hero(V){
  const G=V.groups,lateAsg=G.asg.filter(m=>m.late).length,today=V.all.filter(m=>m.x&&m.x.ageDays===0).length;
  const oldest=L=>{const m=L.slice().sort((a,b)=>(Number.isFinite(a.from)?a.from:Infinity)-(Number.isFinite(b.from)?b.from:Infinity))[0];return m&&m.el&&m.el!=='—'?'가장 오래된 건은 '+m.el+'째 기다리고 있어요':'';};
  let n,what,sub='';
  if(lateAsg||(G.asg.length&&!G.first.length)){n=G.asg.length;what='담당자를 기다리는 문의가';sub=oldest(G.asg);}
  else if(G.first.length){n=G.first.length;what='첫 연락을 기다리는 문의가';sub=oldest(G.first);}
  else if(G.late.length){n=G.late.length;what='기한이 지난 문의가';sub='다음 할 일 날짜가 지난 문의예요';}
  else if(G.today.length){n=G.today.length;what='오늘 연락할 문의가';sub='오늘 날짜로 잡힌 다음 할 일이에요';}
  const tail=['진행 중 '+V.all.length+'건',today?'오늘 들어온 문의 '+today+'건':''].filter(Boolean).join(' · ');
  if(!n)return '<p class="tq-hero">지금 급한 문의는 없어요</p><p class="tq-lead">'+h(tail)+'</p>';
  return '<p class="tq-hero">'+h(what)+' <b>'+n+'건</b> 있어요</p><p class="tq-lead">'+h([sub,tail].filter(Boolean).join(' · '))+'</p>';
 }
 function rowHtml(m,S){
  const g=m._g,b=badge(m,g),a=action(m,g),sel=S.sel===m.key,sub=[m.brand,workOf(m),nextOf(m)].filter(Boolean).join(' · ');
  return '<div class="tq-row'+(sel?' on':'')+'" role="button" tabindex="0" data-tq="row" data-v="'+attr(m.key)+'" aria-current="'+sel+'">'
   +'<span class="tq-d'+(b.red?' red':'')+'"><b>'+h(b.t)+'</b>'+(b.sub?'<small>'+h(b.sub)+'</small>':'')+'</span>'
   +'<span class="tq-m"><b class="tq-nm">'+h(m.site)+'</b><span class="tq-ds">'+h(sub)+'</span></span>'
   +'<span class="tq-c">'+h(m.owner?repName(m.owner):'미배정')+'</span>'
   +'<span class="tq-c">'+h(md(m.x.created)?md(m.x.created)+' 접수':'')+'</span>'
   +'<button type="button" class="tq-btn" data-tq="act" data-v="'+attr(m.key)+'">'+h(a.label)+'</button></div>';
 }
 function listHtml(V,S){
  const pg=LP().cut(V.list,LP().page(S));let out='',cur='';
  if(!pg.rows.length)return '<div class="tq-group"><div class="tq-empty">이 조건에 해당하는 문의가 없어요</div></div>';
  const title=k=>(GROUPS.find(g=>g[0]===k)||[])[1]||'';
  pg.rows.forEach(m=>{
   if(m._g!==cur){if(cur)out+='</div>';cur=m._g;const all=V.list.filter(x=>x._g===cur),red=cur==='late'||all.some(x=>x.late&&(cur==='asg'||cur==='first'));
    out+='<div class="tq-group"><p class="tq-gt'+(red?' red':'')+'">'+h(title(cur))+'<em>'+all.length+'</em></p>';}
   out+=rowHtml(m,S);});
  return out+'</div>'+LP().html(pg,{ns:'tq',unit:'건'});
 }
 function sideHtml(m){
  if(!m)return '<aside class="tq-side"><p class="tq-k">고른 문의</p><p class="tq-none">왼쪽 목록에서 문의를 고르면 여기에 요약이 나와요</p></aside>';
  const g=m._g,d=due(m),a=action(m,g),STG=lib().STG();let miss=[];try{miss=L3().missing(m.q);}catch(e){}
  const kv=(k,v,cls)=>v?'<div class="tq-kv"><span>'+h(k)+'</span><span'+(cls?' class="'+cls+'"':'')+'>'+h(v)+'</span></div>':'';
  const warns=(m._w||[]).map(k=>{const w=lib().warn(k);return w?w.tag:'';}).filter(Boolean);
  const wait=g==='asg'||g==='first'?(m.el&&m.el!=='—'?m.el:''):'';
  return '<aside class="tq-side"><p class="tq-k">'+h(STG[m._s][0]+' '+STG[m._s][1])+'</p><h3 class="tq-st">'+h(m.site)+'</h3><p class="tq-k">'+h([m.brand,workOf(m)].filter(Boolean).join(' · ')||'브랜드 미지정')+'</p>'
   +'<div class="tq-kvs">'+kv(wait?'기다린 시간':'기한',wait||d.t,(wait?m.late:d.late)?'red':'')
   +kv('담당',m.owner?repName(m.owner):'미배정')
   +kv('연락처',[m.who,m.phone||'연락처 없음'].filter(Boolean).join(' · '),m.phone?'':'mute')
   +kv('다음 할 일',nextOf(m))
   +kv('지금까지',evOf(m))
   +kv('빠진 정보',miss.length?miss[0]+(miss.length>1?' 외 '+(miss.length-1):''):'모두 채움',miss.length?'':'mute')
   +(warns.length?kv('확인 필요',warns.join(' · '),'red'):'')+'</div>'
   +'<button type="button" class="tq-p1" data-tq="act" data-v="'+attr(m.key)+'">'+h(a.label)+'</button>'
   +'<button type="button" class="tq-p2" data-tq="full" data-v="'+attr(m.key)+'">상세 열기</button></aside>';
 }
 function tools(host){
  /* 더보기(일괄 처리 · 예전 목록 · 종결 · 휴지통) — v5 가 가려진 자기 칸에 둔 것을 이 화면으로 옮긴다 */
  const slot=host.querySelector('.tq-more-slot'),t=document.querySelector('#inq-v5 .inq-work-tools, #inq-v4 .inq-work-tools, #pg-inq .inq-inbox-heading .inq-work-tools')||host.__tools||null;
  if(slot&&t){host.__tools=t;if(t.parentNode!==slot)slot.append(t);}
 }
 function render(){
  const page=document.getElementById('pg-inq');if(!page)return;let host=document.getElementById('inq-toss');
  if(!on()){page.classList.remove('inq-toss');if(host){const t=host.__tools,s=document.querySelector('#inq-v5 .i5-more-slot');if(t&&s)s.append(t);host.remove();}return;}
  page.classList.add('inq-toss');
  if(!host){host=document.createElement('div');host.id='inq-toss';const v5=document.getElementById('inq-v5');if(v5)v5.after(host);else page.append(host);host.addEventListener('click',onClick);host.addEventListener('keydown',onKey);}
  const S=st(),V=compute(),keep=host.__tools;if(keep&&host.contains(keep))keep.remove();
  const pg=LP().cut(V.list,LP().page(S));if(!pg.rows.some(m=>m.key===S.sel))S.sel=pg.rows.length?pg.rows[0].key:'';
  const cur=V.list.find(m=>m.key===S.sel)||null,STG=lib().STG();
  const stages='<div class="tq-stages" role="group" aria-label="견적문의 단계">'+STG.map((g,i)=>{const o=S.st===i;return '<button type="button" class="tq-stg'+(o?' on':'')+'" data-tq="st" data-v="'+i+'" aria-pressed="'+o+'"><span>'+h(g[1])+'</span><b>'+V.cols[i].length+'</b><small>'+h(note(i))+'</small></button>';}).join('')+'</div>';
  const chips=V5().CHIPS.filter(k=>V.warn[k]||S.wf===k).map(k=>{const w=lib().warn(k),o=S.wf===k;return '<button type="button" class="tq-chip'+(o?' on':'')+'" data-tq="wf" data-v="'+k+'" aria-pressed="'+o+'" title="'+attr(w.why)+'">'+h(w.chip)+' '+V.warn[k]+'</button>';}).join('');
  const line='<div class="tq-line">'+(chips?'<span class="tq-lb">확인 필요</span>'+chips:'<span class="tq-lb">확인이 필요한 문의는 없어요</span>')+(S.st!=null||S.wf?'<button type="button" class="tq-clear" data-tq="clear">전체 보기</button>':'')+'<i></i><span class="tq-more-slot"></span></div>';
  host.innerHTML='<div class="tq-wrap"><section class="tq-main">'+hero(V)+stages+line+listHtml(V,S)+'</section>'+sideHtml(cur)+'</div>';
  host.__tools=keep;tools(host);
 }
 function open(key,act){const w=W();if(!w||!key)return;if(act==='assign')return w.open(key,root.inqCtlRoleView&&root.inqCtlRoleView()==='admin'?'rep':undefined);return w.open(key);}
 function onClick(e){
  const b=e.target.closest('[data-tq]');if(!b||b.disabled)return;const k=b.dataset.tq,v=b.dataset.v,S=st();
  if(k==='act'){e.stopPropagation();const m=VIEW.list.find(x=>x.key===v);return open(v,m?action(m,m._g).act:'open');}
  if(k==='full')return open(v);
  if(k==='row'){if(S.sel===v)return open(v);S.sel=v;return render();}
  if(k==='st'){const i=Number(v);S.st=S.st===i?null:i;S.wf='';LP().reset(S);S.sel='';}
  else if(k==='wf'){S.wf=S.wf===v?'':v;S.st=null;LP().reset(S);S.sel='';}
  else if(k==='clear'){S.st=null;S.wf='';LP().reset(S);S.sel='';}
  else if(k==='page'){LP().set(S,null,Number(b.dataset.page)||1);S.sel='';}
  else return;
  render();
 }
 function onKey(e){const t=e.target;if(t&&t.matches&&t.matches('.tq-row')&&(e.key==='Enter'||e.key===' ')){e.preventDefault();t.click();}}
 /* v5 가 그린 뒤에 그 자리를 대신한다(v5 는 가려 두고, 끄면 그대로 나온다) */
 const basePaint=root.paintInq;
 if(typeof basePaint==='function')root.paintInq=function(){const r=basePaint.apply(this,arguments);try{render();}catch(err){const p=document.getElementById('pg-inq');if(p)p.classList.remove('inq-toss');const hst=document.getElementById('inq-toss');if(hst)hst.remove();if(root.console)root.console.warn('inquiry toss: '+err.message);}return r;};
 root.InquiryToss={on,render,compute,state:st,GROUPS:ORDER.slice(),groupOf,badge,action};
})(window);
