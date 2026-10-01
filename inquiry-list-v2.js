/* 견적문의 목록 v2 (2026-10-01 디자인 핸드오프 'design_handoff_inquiry' — 목록 부분)
   '오늘 처리해야 할 문의' 박스·할 일 카드 4개·3줄 필터를 → 머리 한 줄 + 묶음 알약 + 우선순위 묶음 표로 바꾼다.
   자료·필터·권한은 기존 것을 그대로 쓴다: 목록 = inqCtlScopeActive()(역할·브랜드·담당자·공종·기간·검색 반영),
   브랜드 알약 = 기존 data-sf-brand 처리기, 역할 전환·문의 등록·더보기(탭·연도·공종·담당자 구분) = 기존 요소를 그대로 옮겨 쓴다.
   행·버튼은 기존 상세(InquiryWorkbench.open)를 연다. 저장 경로는 건드리지 않는다.
   다른 탭(영업전환·스토어·보류·휴지통)이나 '예전 목록'은 기존 화면 그대로 보인다. */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const DAY=864e5,PER=20;
 const GROUPS=[
  ['assign','지금 배정 필요','#e5484d','담당자를 정해야 연락이 시작돼요'],
  ['stale','7일 넘게 연락 없음','#f08c2e','배정됐지만 후속 연락이 멈춘 건'],
  ['today','오늘 들어온 문의','#3b6ce4','첫 연락을 오늘 안에'],
  ['active','진행 중','#c4c8d0','다음 연락 일정이 잡힌 건']];
 const BRAND_DOT={'석민이앤씨':'#f08c2e','POUR솔루션':'#30a46c','POUR공법':'#7a5af8','아파트스퀘어':'#3b6ce4','전체':'#9ca3af'};
 const W=()=>root.InquiryWorkbench;
 function st(){const g=root.G;if(!g.inqV2)g.inqV2={group:'all',limits:{},more:false};return g.inqV2;}
 function enabled(){const g=root.G;return g.page==='inq'&&!g.inqLegacyView&&(g.inqBucket||'전체')==='전체'&&(g.inqView||'console')==='console'&&!g.inqV2Off&&!!W();}
 const startOfDay=t=>{const d=new Date(t);d.setHours(0,0,0,0);return d.getTime();};
 function contacts(q){const p=root.itemPatch(q,'inq')||{},seen=new Set();return [...(q.activities||[]),...(p.activities||[])].filter(a=>{const k=a.id||[a.at,a.type,a.note,a.result].join('|');if(seen.has(k))return false;seen.add(k);return /전화|통화|문자|SMS|카카오|이메일|메일|방문/i.test(a.type||'')&&Number.isFinite(Date.parse(a.at||a.occurred_at||a.created_at));}).sort((a,b)=>Date.parse(b.at||b.occurred_at||b.created_at)-Date.parse(a.at||a.occurred_at||a.created_at));}
 function info(q){
  const created=Date.parse(root.inquiryCreatedAt(q)||''),now=Date.now(),ageDays=Number.isFinite(created)?Math.max(0,Math.round((startOfDay(now)-startOfDay(created))/DAY)):null;
  const assigned=root.inquiryAssigned(q),list=contacts(q),latest=list[0],first=root.inqCtlFirstResponseAt(q);
  const lastAt=latest?Date.parse(latest.at||latest.occurred_at||latest.created_at):first?Date.parse(first):Date.parse(root.inquiryAssignedAt?.(q)||'')||created;
  const silent=Number.isFinite(lastAt)?Math.floor((now-lastAt)/DAY):null;
  const group=!assigned?'assign':silent!==null&&silent>=7?'stale':ageDays===0?'today':'active';
  return {q,key:root.inqKey(q),ageDays,assigned,latest,first,created,group,silent};
 }
 function rows(){return root.inqCtlScopeActive().filter(q=>W().task(q).kind!=='closed').map(info);}
 const md=t=>{if(!Number.isFinite(t))return '';const d=new Date(t);return (d.getMonth()+1)+'/'+d.getDate();};
 function rowHtml(x){
  const q=x.q,d=q.detail&&typeof q.detail==='object'?q.detail:{},r=q.raw&&typeof q.raw==='object'?q.raw:{},admin=root.inqCtlRoleView()==='admin';
  const owner=root.inquiryRoutedOwner(q),phone=root.inqCtlContactLabel(q),digits=String(phone||'').replace(/\D/g,'');
  const customer=[d.customerType||r['고객유형'],q.contact_name||q.contact].filter(v=>v&&String(v).trim()).join(' · ')||'고객 미입력';
  const work=root.inqCtlWorkLabel(q),channel=d.channel||q.channel||r['상담채널']||d.inflow||q.source_channel||r['유입경로']||'채널 미기록',brand=q.brand||root.inquiryBrandOf?.(q)||'브랜드 미지정';
  const lastText=x.latest?[x.latest.note,x.latest.result].filter(Boolean).join(' · ')||x.latest.type:x.first?'첫 연락 기록 있음':'문의 접수';
  const lastDate=x.latest?md(Date.parse(x.latest.at||x.latest.occurred_at||x.latest.created_at))+' · '+(x.latest.type||'연락'):x.first?md(Date.parse(x.first)):md(x.created);
  const age=x.ageDays===null?'—':x.ageDays===0?'오늘':x.ageDays+'일',ageCls=x.ageDays===null?'':x.ageDays>=14?'hot':x.ageDays===0?'new':'';
  const cta=!x.assigned?(admin?['배정','fill','rep']:['확인','line','none']):x.group==='today'&&!x.first?['첫 연락','line','process']:['후속 연락','line','process'];
  return '<div class="iv-row" role="button" tabindex="0" data-k="'+attr(x.key)+'" data-group="'+x.group+'">'
   +'<div class="iv-c iv-site"><b>'+h(q.site||'현장명 미입력')+'</b><span>'+h(W().gist(q)||'문의 내용 확인 필요')+'</span></div>'
   +'<div class="iv-c iv-cust"><span>'+h(customer)+'</span><span class="'+(digits.length>=8?'':'warn')+'">'+h(digits.length>=8?phone:'연락처 없음')+'</span></div>'
   +'<div class="iv-c iv-brand"><b>'+h(brand)+'</b><span class="'+(work==='공종 미분류'?'warn':'')+'">'+h(work)+' · '+h(channel)+'</span></div>'
   +'<span class="iv-owner'+(owner?'':' none')+'">'+h(owner?root.repDisplay(owner):'미배정')+'</span>'
   +'<div class="iv-c iv-last"><span title="'+attr(lastText)+'">'+h(lastText)+'</span><small>'+h(lastDate)+'</small></div>'
   +'<span class="iv-age '+ageCls+'">'+h(age)+'</span>'
   +'<button type="button" class="iv-cta '+cta[1]+'" data-k="'+attr(x.key)+'" data-act="'+cta[2]+'">'+h(cta[0])+'</button></div>';
 }
 function render(){
  const page=document.getElementById('pg-inq');if(!page)return;
  let host=document.getElementById('inq-v2');
  if(!enabled()){page.classList.remove('inq-v2');host?.remove();
   /* 예전 목록으로 바꿨을 때 돌아오는 길 */
   if(root.G.inqV2Off&&root.G.page==='inq'){const heading=page.querySelector('.inq-inbox-heading');if(heading&&!heading.querySelector('.iv-back')){const b=document.createElement('button');b.type='button';b.className='iv-back';b.textContent='← 새 목록으로';b.onclick=()=>{root.G.inqV2Off=false;root.paint();};heading.prepend(b);}}
   return;}
  page.classList.add('inq-v2');
  if(!host){host=document.createElement('div');host.id='inq-v2';page.prepend(host);host.addEventListener('click',click);host.addEventListener('keydown',key);host.addEventListener('change',change);}
  const s=st(),all=rows(),by={};GROUPS.forEach(g=>by[g[0]]=all.filter(x=>x.group===g[0]).sort((a,b)=>(b.ageDays??-1)-(a.ageDays??-1)||String(a.key).localeCompare(String(b.key))));
  const admin=root.inqCtlIsAdmin?.(),view=root.inqCtlRoleView();
  /* 브랜드 알약: 기존 공통 필터 줄의 건수·선택 상태를 그대로 읽는다(누르면 기존 처리기가 동작) */
  const chips=[...document.querySelectorAll('#pg-inq .inq-inbox-sticky [data-sf-brand], #pg-inq #sg-signals [data-sf-brand]')];
  const seen=new Set(),brandHtml=chips.filter(b=>{const v=b.dataset.sfBrand;if(seen.has(v))return false;seen.add(v);return true;}).map(b=>{const name=b.dataset.sfBrand,n=b.querySelector('em')?.textContent||'',on=b.getAttribute('aria-pressed')==='true';return '<button type="button" class="iv-pill'+(on?' on':'')+'" data-sf-brand="'+attr(name)+'" aria-pressed="'+on+'"><i style="background:'+(BRAND_DOT[name]||'#9ca3af')+'"></i>'+h(name)+' <em>'+h(n)+'</em></button>';}).join('');
  const seg=admin?'<div class="iv-seg" role="group" aria-label="문의 조회 범위"><button type="button" data-iv="scope" data-v="admin" aria-pressed="'+(view==='admin')+'">팀 문의</button><button type="button" data-iv="scope" data-v="mine" aria-pressed="'+(view==='mine')+'">내 담당</button></div>':'';
  const tabs=[['all','전체',all.length,'#15171c','']].concat(GROUPS.map(g=>[g[0],g[1],by[g[0]].length,g[2],g[0]==='assign'?'red':g[0]==='stale'?'amber':'']));
  const tabHtml=tabs.map(t=>'<button type="button" class="iv-tab'+(s.group===t[0]?' on':'')+'" data-iv="group" data-v="'+t[0]+'" aria-pressed="'+(s.group===t[0])+'"><i style="background:'+t[3]+'"></i>'+h(t[1])+'<b class="'+t[4]+'">'+t[2]+'</b></button>').join('');
  const shown=GROUPS.filter(g=>s.group==='all'||s.group===g[0]);
  const body=shown.map(g=>{const list=by[g[0]],limit=s.limits[g[0]]||PER,part=list.slice(0,limit),more=list.length-part.length;
   return '<div class="iv-ghead" role="button" tabindex="0" data-iv="group" data-v="'+(s.group===g[0]?'all':g[0])+'"><i style="background:'+g[2]+'"></i><b>'+h(g[1])+'</b><span>'+list.length+'건</span><small>· '+h(g[3])+'</small><em>'+(s.group===g[0]?'전체 보기':'이것만 보기')+'</em></div>'
    +(list.length?part.map(rowHtml).join(''):'<div class="iv-empty">해당하는 문의가 없습니다</div>')
    +(more>0?'<button type="button" class="iv-more" data-iv="more" data-v="'+g[0]+'">+ '+more+'건 더보기</button>':'');}).join('');
  host.innerHTML='<div class="iv-head"><div class="iv-title"><h2>견적문의</h2><p>위에서부터 처리하세요 · 배정 → 첫 연락 → 후속 연락 → 영업건 전환</p></div>'+seg+'<div class="iv-spacer"></div><div class="iv-brands" role="group" aria-label="브랜드">'+brandHtml+'</div>'
   +'<input class="iv-search" aria-label="문의 검색" placeholder="현장 · 고객 · 연락처" value="'+attr(root.G.q||'')+'"><span class="iv-create-slot"></span><span class="iv-more-slot"></span></div>'
   +'<div class="iv-tabs" role="group" aria-label="우선순위 묶음">'+tabHtml+'</div>'
   +'<div class="iv-table"><div class="iv-thead"><span>현장 · 문의</span><span>고객 · 연락처</span><span>브랜드 · 공종 · 채널</span><span>담당</span><span>마지막 연락</span><span>경과</span><span></span></div>'+body+'</div>';
  adopt(host);
 }
 /* 기존 요소를 그대로 옮겨 쓴다: 문의 등록 버튼, 더보기(탭·보기 전환·일괄 처리) + 공종·상태·담당자 구분·기간 필터 */
 function adopt(host){
  const create=document.querySelector('#pg-inq .inq-inbox-heading .inq-create-trigger');if(create)host.querySelector('.iv-create-slot').append(create);
  const tools=document.querySelector('#pg-inq .inq-inbox-heading .inq-work-tools');
  if(tools){const body=tools.querySelector('.inq-tools-body');const filters=document.querySelector('#pg-inq .inq-inbox-sticky .inq-work-filters'),bar=document.querySelector('#pg-inq .inq-inbox-sticky .sales-filterbar');
   if(body){if(filters){filters.classList.add('iv-in-more');body.prepend(filters);}if(bar){bar.classList.add('iv-in-more');body.prepend(bar);}
    if(!body.querySelector('.iv-legacy')){const b=document.createElement('button');b.type='button';b.className='iv-legacy';b.textContent='예전 목록으로 보기(일괄 선택·배정)';b.onclick=()=>{root.G.inqV2Off=true;root.paint();};body.append(b);}}
   tools.open=!!st().more;tools.addEventListener('toggle',()=>{st().more=tools.open;});host.querySelector('.iv-more-slot').append(tools);}
 }
 function open(key,act){const w=W();if(!w)return;if(act==='rep'||act==='none'||!act)return w.open(key);return w.open(key,act);}
 function click(e){
  const cta=e.target.closest('.iv-cta');if(cta){e.stopPropagation();return open(cta.dataset.k,cta.dataset.act);}
  const b=e.target.closest('[data-iv]');
  if(b){const v=b.dataset.v,s=st();
   /* 머리 줄에 옮겨 둔 기존 요소(브랜드 건수·더보기·등록)가 다시 만들어지도록 전체를 다시 그린다 */
   if(b.dataset.iv==='group'){s.group=v;return root.paint();}
   if(b.dataset.iv==='more'){s.limits[v]=(s.limits[v]||PER)+PER;return root.paint();}
   if(b.dataset.iv==='scope'){if(root.inqCtlRoleView()!==v)root.inqCtlSetRoleView(v);return;}
  }
  const row=e.target.closest('.iv-row');if(row&&!e.target.closest('button,a,input,select'))open(row.dataset.k);
 }
 function key(e){
  if(e.target.classList?.contains('iv-search')&&e.key==='Enter'){root.G.q=e.target.value.trim();root.G.inqPage=1;st().limits={};root.paint();return;}
  if((e.key==='Enter'||e.key===' ')&&e.target.matches('.iv-row,.iv-ghead')){e.preventDefault();e.target.click();}
 }
 function change(e){if(e.target.classList?.contains('iv-search')&&e.target.value.trim()!==String(root.G.q||'')){root.G.q=e.target.value.trim();root.G.inqPage=1;st().limits={};root.paint();}}
 const base=root.paintInq;
 if(typeof base==='function')root.paintInq=function(){const r=base.apply(this,arguments);try{render();}catch(err){document.getElementById('pg-inq')?.classList.remove('inq-v2');document.getElementById('inq-v2')?.remove();if(root.console)root.console.warn('inquiry list v2: '+err.message);}return r;};
 root.InquiryListV2={render,rows,enabled,groups:()=>GROUPS.map(g=>g[0])};
})(window);
