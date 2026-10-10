/* 모바일 오늘 동선 (2026-10-10 대표 승인 · design_handoff_mobile_all 5번 '오늘 동선' — 구조: 카카오 지도 + 이미 있는 현장 좌표 재사용, 새 데이터 없음)
   · 오늘: [목록 | 오늘 동선] 전환. 동선 = 오늘 방문 일정이 있는 내 현장을 지도에 번호 핀 · 순서 · 이동 시간으로.
   · 좌표 = PC 견적문의 '근처 현장'이 쓰는 현장 좌표(crm_site_geo_list_v1 · 읽기만). 지도 키도 그 응답의 카카오 JS 키(공개 키 · 사이트 주소 등록 필요) — 새로 저장하는 것 없음.
   · 순서 = 내 위치(눌렀을 때만 위치 허용을 묻는다)에서 가장 가까운 곳부터 차례로. 이동 시간 = 직선거리 기준 어림값('약' 표시, 실제 길 · 교통은 반영하지 않는다).
   · 근처 관계관리 현장 = 오늘 방문지 주변 5km 안의 내 관계관리 영업(보고 지나치지 않게 추천만 — 일정은 만들지 않는다).
   · 좌표가 없는 현장은 지도에 넣지 않고 '위치를 못 찾은 현장'으로 따로. 지도 · 좌표 저장소 중 하나라도 안 되면 순서 목록만 보여 주고 그 사실을 적는다.
   끄기: G.mobileRouteOff=true */
(function(root){
 'use strict';
 const GEO='crm_site_geo_list_v1',SDK_URL='https://dapi.kakao.com/v2/maps/sdk.js',NEAR_KM=5,MIN_PER_KM=3;
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const enabled=()=>!(root.G&&(root.G.mobileRouteOff||root.G.mobileV2Off));
 const ready=()=>!!(root.Phase1&&typeof root.Phase1.rpc==='function'&&root.Phase1.profile);
 const kst=n=>{try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(Date.now()+(n||0)*864e5));}catch(e){return new Date(Date.now()+(n||0)*864e5).toISOString().slice(0,10);}};
 const M={st:'idle',key:'',pts:new Map(),sdk:'none',me:null,meErr:'',view:'list',map:null,sig:''};
 const day=v=>String(v||'').slice(0,10);
 const mine=()=>{try{return (root.myDeals?root.myDeals():[]).filter(d=>typeof root.isOpen!=='function'||root.isOpen(d));}catch(e){return [];}};
 const openNext=d=>{const a=d&&d.nextAction;return a&&a.status==='open'?a:null;};
 const isVisit=a=>!!a&&/방문|실측|미팅/.test(String(a.type||'')+' '+String(a.text||''));
 const REL=['rapport','silent','waiting'];
 /* 두 점 사이 직선거리(km) */
 function km(a,b){const R=6371,rad=x=>x*Math.PI/180,dLat=rad(b.lat-a.lat),dLng=rad(b.lng-a.lng),s=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLng/2)**2;return 2*R*Math.asin(Math.sqrt(s));}
 const minOf=k=>Math.max(1,Math.round(k*MIN_PER_KM));
 const kmTxt=k=>k<1?Math.round(k*1000)+'m':(Math.round(k*10)/10)+'km';
 const ptOf=d=>{const id=String(d&&(d.cleanup_site_id||d.site_id||d.siteId)||'');return id?M.pts.get(id)||null:null;};
 /* 오늘 방문 일정이 있는 내 현장(기한 오늘 · 지난 방문 포함하지 않음) */
 function stopsToday(){
  const T=kst(0);return mine().map(d=>{const a=openNext(d);return a&&isVisit(a)&&day(a.due_at||a.due)===T?{d,a}:null;}).filter(Boolean);
 }
 /* 순서: 시작점(내 위치, 없으면 좌표가 있는 첫 곳)에서 가장 가까운 곳으로 차례로 */
 function order(stops,from){
  const withPt=stops.map(s=>Object.assign({pt:ptOf(s.d)},s)),have=withPt.filter(s=>s.pt),none=withPt.filter(s=>!s.pt);
  const out=[];let cur=from||(have[0]&&have[0].pt)||null,rest=have.slice();
  while(rest.length){let bi=0,bd=Infinity;rest.forEach((s,i)=>{const k=cur?km(cur,s.pt):0;if(k<bd){bd=k;bi=i;}});const s=rest.splice(bi,1)[0];s.leg=cur?km(cur,s.pt):0;out.push(s);cur=s.pt;}
  return {route:out,missing:none};
 }
 function nearRel(route){
  const anchors=route.map(s=>s.pt);if(!anchors.length)return [];const ids=new Set(route.map(s=>String(s.d.id)));
  return mine().filter(d=>REL.includes(String(d.code))&&!ids.has(String(d.id))).map(d=>{const p=ptOf(d);if(!p)return null;const k=Math.min(...anchors.map(a=>km(a,p)));return k<=NEAR_KM?{d,k}:null;}).filter(Boolean).sort((a,b)=>a.k-b.k).slice(0,3);
 }
 /* ── 좌표 · 지도 ── */
 async function geoLoad(){
  if(M.st!=='idle'||!ready())return;M.st='loading';
  try{
   const r=await root.Phase1.rpc(GEO,{p:{}}),D=r&&r.data&&typeof r.data==='object'&&!Array.isArray(r.data)?r.data:r;
   if(!D||!Array.isArray(D.sites))throw Error('GEO_BAD');
   M.key=String(D.kakao_js_key||'');M.pts.clear();
   D.sites.forEach(x=>{const id=String(x[0]);if(x[3]!=='none'&&x[1]!=null&&x[2]!=null&&Number.isFinite(Number(x[1]))&&Number.isFinite(Number(x[2])))M.pts.set(id,{lat:Number(x[1]),lng:Number(x[2])});});
   M.st='ready';sdkLoad();
  }catch(e){M.st=(e&&(e.code==='PGRST202'||/CONTRACT_UNAVAILABLE|PHASE1_RPC_DENIED/i.test(String(e.message||''))))?'nostore':'error';}
  rerender();
 }
 function sdkLoad(){
  if(M.sdk!=='none'||!M.key)return;M.sdk='loading';
  const done=()=>{try{root.kakao.maps.load(()=>{M.sdk='ready';rerender();});}catch(e){M.sdk='error';rerender();}};
  if(root.kakao&&root.kakao.maps&&typeof root.kakao.maps.load==='function')return done();
  const sc=root.document.createElement('script');sc.src=SDK_URL+'?appkey='+encodeURIComponent(M.key)+'&autoload=false';sc.async=true;sc.onload=done;sc.onerror=()=>{M.sdk='error';sc.remove();rerender();};root.document.head.append(sc);
 }
 function rerender(){try{const G=root.G;if(G&&G.user&&!G.deal&&!G.sub&&G.tab==='today'&&G.mode==='rep'&&M.view==='route')root.render();}catch(e){}}
 function locate(){
  if(!root.navigator||!root.navigator.geolocation){M.meErr='이 휴대폰은 위치를 지원하지 않습니다';return rerender();}
  M.meErr='';root.navigator.geolocation.getCurrentPosition(p=>{M.me={lat:p.coords.latitude,lng:p.coords.longitude};rerender();},e=>{M.meErr=e&&e.code===1?'위치 사용을 허용하지 않았습니다 — 첫 방문지부터 순서를 잡았습니다':'내 위치를 확인하지 못했습니다';rerender();},{enableHighAccuracy:false,timeout:8000,maximumAge:60000});
 }
 /* ── 화면 ── */
 function tabsHtml(){return '<div class="mr-tabs" role="tablist"><button type="button" role="tab" data-mr="view" data-v="list" aria-selected="'+(M.view==='list')+'">목록</button><button type="button" role="tab" data-mr="view" data-v="route" aria-selected="'+(M.view==='route')+'">오늘 동선</button></div>';}
 function routeHtml(){
  const stops=stopsToday(),O=order(stops,M.me),R=O.route,total=R.reduce((a,s)=>a+s.leg,0),near=nearRel(R);
  const why=!ready()?'로그인 상태에서만 지도를 불러옵니다':M.st==='nostore'?'현장 좌표 저장소가 아직 없어 지도를 표시하지 않습니다':M.st==='error'?'현장 좌표를 불러오지 못해 지도를 표시하지 않습니다':M.st==='loading'||M.st==='idle'?'현장 좌표를 불러오는 중입니다':!M.key?'지도 키가 등록되지 않아 순서 목록만 보여 드립니다':M.sdk==='error'?'카카오 지도를 불러오지 못해 순서 목록만 보여 드립니다(키 · 사이트 주소 등록 확인)':M.sdk!=='ready'?'지도를 불러오는 중입니다':'';
  const head='<div class="sec-h"><h2>오늘 동선 '+R.length+'곳</h2><span>'+(R.length?'이동 약 '+minOf(total)+'분 · 직선거리 '+kmTxt(total)+' 기준':'오늘 방문 일정 '+stops.length+'건')+'</span></div>';
  if(!stops.length)return '<section class="mr" aria-label="오늘 동선">'+head+'<p class="mr-none">오늘 방문 일정이 없습니다 — 일정 탭에서 방문 약속을 확인하세요</p></section>';
  return '<section class="mr" aria-label="오늘 동선">'+head
   +'<div class="mr-bar"><button type="button" data-mr="locate" class="mr-loc">'+(M.me?'내 위치 다시 확인':'내 위치에서 시작')+'</button><span>'+h(M.meErr||(M.me?'내 위치에서 가까운 곳부터':'위치는 눌렀을 때만 확인합니다'))+'</span></div>'
   +(R.length&&!why?'<div id="mr-map" class="mr-map" role="img" aria-label="오늘 방문지 지도"></div>':(why?'<p class="mr-note">'+h(why)+'</p>':''))
   +'<ol class="mr-list">'+R.map((s,i)=>'<li><button type="button" data-mr="open" data-id="'+attr(s.d.id)+'"><i>'+(i+1)+'</i><span><b>'+h(s.d.nm)+'</b><small>'+h(String(s.a.text||'').replace(/^\s*고객\s*약속\s*:?\s*/,''))+'</small></span><em>'+(i===0&&!M.me?'출발':'+'+minOf(s.leg)+'분 · '+kmTxt(s.leg))+'</em></button></li>').join('')+'</ol>'
   +(O.missing.length?'<div class="mr-miss"><b>위치를 못 찾은 현장 '+O.missing.length+'곳</b>'+O.missing.map(s=>'<button type="button" data-mr="open" data-id="'+attr(s.d.id)+'">'+h(s.d.nm)+'</button>').join('')+'<small>지도에는 넣지 않았습니다 — 현장 주소가 있으면 PC 근처 현장에서 좌표를 찾습니다</small></div>':'')
   +(near.length?'<div class="mr-near"><b>근처 관계관리 현장 <small>방문지 '+NEAR_KM+'km 안 · 추천만 합니다</small></b>'+near.map(x=>'<button type="button" data-mr="open" data-id="'+attr(x.d.id)+'"><span>'+h(x.d.nm)+'</span><em>'+kmTxt(x.k)+'</em></button>').join('')+'</div>':'')
   +'</section>';
 }
 /* 번호 핀 · 순서선 · 내 위치 */
 function drawMap(){
  const box=root.document.getElementById('mr-map');if(!box||M.sdk!=='ready'||!root.kakao||!root.kakao.maps)return;
  const R=order(stopsToday(),M.me).route;if(!R.length)return;const K=root.kakao.maps,sig=JSON.stringify([R.map(s=>[s.d.id,s.pt.lat,s.pt.lng]),M.me]);
  if(box.dataset.sig===sig)return;box.dataset.sig=sig;
  try{
   const ll=p=>new K.LatLng(p.lat,p.lng),pts=R.map(s=>s.pt).concat(M.me?[M.me]:[]),map=new K.Map(box,{center:ll(R[0].pt),level:6});M.map=map;
   const bounds=new K.LatLngBounds();pts.forEach(p=>bounds.extend(ll(p)));
   if(R.length>1||M.me)map.setBounds(bounds);
   const path=(M.me?[M.me]:[]).concat(R.map(s=>s.pt)).map(ll);if(path.length>1)new K.Polyline({map,path,strokeWeight:4,strokeColor:'#3b6ce4',strokeOpacity:.8});
   R.forEach((s,i)=>{new K.CustomOverlay({map,position:ll(s.pt),yAnchor:1,content:'<div class="mr-pin"><span style="transform:rotate(45deg)">'+(i+1)+'</span></div>'});});
   if(M.me)new K.CustomOverlay({map,position:ll(M.me),yAnchor:.5,content:'<div class="mr-me" title="내 위치"></div>'});
  }catch(e){box.textContent='지도를 그리지 못했습니다';}
 }
 function decorate(body){
  if(!enabled()||!body)return;
  if(!body.querySelector('.mr-tabs')){const el=root.document.createElement('div');el.innerHTML=tabsHtml();const head=body.querySelector(':scope>.mt-head');if(head)head.after(el.firstElementChild);else body.prepend(el.firstElementChild);}
  body.classList.toggle('mr-route',M.view==='route');
  if(M.view==='route'&&!body.querySelector('.mr')){geoLoad();const el=root.document.createElement('div');el.innerHTML=routeHtml();body.querySelector('.mr-tabs').after(el.firstElementChild);}
  if(M.view==='route')root.setTimeout(drawMap,0);
 }
 root.document.addEventListener('click',e=>{
  const b=e.target.closest('#scr [data-mr]');if(!b||!enabled())return;const a=b.dataset.mr;
  if(a==='view'){M.view=b.dataset.v==='route'?'route':'list';return root.render();}
  if(a==='locate')return locate();
  if(a==='open'){const G=root.G;G.deal=b.dataset.id;G.sub=null;return root.render();}
 });
 root.MobileRoute=Object.freeze({enabled,decorate,order,stopsToday,km,minOf,state:()=>M,routeHtml,_set:(k,v)=>{M[k]=v;}});
})(window);
