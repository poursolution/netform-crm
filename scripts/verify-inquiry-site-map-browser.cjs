'use strict';
/* 견적문의 · 근처에서 영업했던 현장 지도 (2026-10-05 design_handoff_inquiry_site 2차)
   합성 자료(이름 · 주소 · 좌표는 지어낸 것) + 가짜 지도(window.kakao 흉내) + 가짜 서버 함수.
   확인: 좌표 저장소 읽기 → 지도 키 → 지도 · 반경 원 · 점 / 좌표 없는 현장은 주소(안 되면 정리한 주소) → 이름(지역 표기가 맞을 때만) 순으로 찾아 저장 · 애매하면 '못 찾음'
        / 반경 1 · 3 · 5km 와 거리순 목록 / 줄을 누르면 지도 이동 / 근처 현장 칸만 다시 그림 / 키가 없으면 관리자에게만 등록 칸 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.join(__dirname,'..');
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!t.startsWith(root)||!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
const one=s=>String(s||'').replace(/\s+/g,' ').trim();
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true}),errs=[];
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await ctx.newPage();page.on('pageerror',e=>errs.push(String(e.message||e)));
  await page.clock.setFixedTime(new Date('2026-10-05T15:00:00+09:00'));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.InquirySite&&window.InquiryDetailV2&&window.InquiryWorkbench&&window.InquiryListV3);
  await page.evaluate(()=>{
   const U=n=>'00000000-0000-4000-8000-00000000000'+n,A='22222222-2222-4222-8222-222222222222',SITE='[경기 화성] 한빛마을2차아파트',ADDR='경기도 화성시 동탄청계로 303-13';
   const deal=(n,site,code,owner,o)=>Object.assign({id:'d000000'+n+'-0000-4000-8000-000000000a1'+n,site,site_id:U(n),assignee:owner,brand:'석민이앤씨',created:'2025-04-01',code,stage_code:code,amt:1e8,amount:1e8,activities:[],workItems:['옥상>우레탄'],primaryWork:'옥상>우레탄',workSummary:'옥상(우레탄)'},o);
   B={deals:[
     deal(1,SITE,'lost','이필선',{grp:'수주 실패',closed_at:'2025-08-21',stage_contexts:{lost:{fields:{close_reason:'가격 열세'}}}}),
     deal(2,'[경기 화성] 동탄새빛캐슬','won','이필선',{grp:'수주 성공',closed_at:'2025-06-10',contract_date:'2025-06-10',won_amount:2.1e8}),
     deal(3,'[경기 화성] 동탄푸른교회','sent','황윤선',{amount:6e6,amt:6e6,created:'2026-08-01'}),
     deal(4,'[경기 화성] 동탄파크뷰','lost','한준엽',{grp:'수주 실패',closed_at:'2025-03-15',amount:8.6e7,amt:8.6e7,stage_contexts:{lost:{fields:{close_reason:'가격 열세'}}}}),
     deal(5,'다른이름타워','sent','이필선',{}),
     deal(6,'[충남 천안] 먼곳아파트','won','이필선',{grp:'수주 성공',closed_at:'2024-06-10',contract_date:'2024-06-10',won_amount:1e8}),
     deal(7,'[경기 화성] 동탄새빛캐슬','sent','황윤선',{site_id:U(2),created:'2026-09-01'})],
    inquiries:[{id:A,site:SITE,site_id:U(1),address:ADDR,status:'현장방문예정',at:'2026-01-13T15:18:00+09:00',created_at:'2026-01-13T15:18:00+09:00',brand:'석민이앤씨',phone:'031-378-5034',work_type:'도로 보수',assignee:'이필선',assigned_to:'이필선',assigned_at:'2026-01-13T15:30:00+09:00',responded_at:'2026-01-13T19:01:00+09:00',raw:{'문의내용':'도로 보수 견적 문의','건물주소':ADDR}}],activities:[]};
   LOCAL={deals:{},inquiries:{}};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};TOKEN='t';G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.inqPeriodMode='snapshot';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.pushWrite=()=>'req';
   const C=[37.2005,127.0975];window.C=C;
   /* 좌표 저장소: 2번(가까움) · 6번(멀리)은 좌표가 있고, 1번 · 3번은 주소만, 4번 · 5번은 이름만 */
   window.GEO={key:'',saved:[],calls:[],sites:[[U(2),37.2086,127.0975,'address',null,null],[U(6),36.8151,127.1139,'address',null,null],[U(1),null,null,null,ADDR,SITE],[U(3),null,null,null,'경기 화성시 동탄대로 99 (오산동) 101동 1203호','[경기 화성] 동탄푸른교회'],[U(4),null,null,null,null,'[경기 화성] 동탄파크뷰'],[U(5),null,null,null,null,'다른이름타워']]};
   SB={rpc:async(n,a)=>{GEO.calls.push(n);const p=a&&a.p;/* 서버 함수는 인자 이름이 p 하나다 — 다르게 보내면 운영에서는 '함수 없음'이 된다 */if(!p||Object.keys(a).length!==1)return {error:{code:'PGRST202',message:'Could not find the function'}};if(n==='crm_site_geo_list_v1')return {data:{ok:true,kakao_js_key:GEO.key,sites:GEO.sites}};if(n==='crm_site_geo_save_v1'){GEO.saved.push(...p.rows);return {data:{ok:true,saved:p.rows.length}};}if(n==='crm_map_config_v1'){GEO.key=p.kakao_js_key;return {data:{ok:true,kakao_js_key:GEO.key}};}return {error:{message:'CONTRACT_UNAVAILABLE'}};}};
   /* 가짜 지도: 부른 것을 적어 둔다 */
   const K={log:{maps:0,relayout:0,bounds:0,pan:[],level:[],overlays:[],circle:null,addr:[],place:[]}};window.KLOG=K.log;
   window.kakao={maps:{load:cb=>setTimeout(cb,0),LatLng:class{constructor(a,b){this.lat=a;this.lng=b;}},
    Map:class{constructor(el,o){K.log.maps++;this.el=el;el.dataset.made='1';}relayout(){K.log.relayout++;}setBounds(){K.log.bounds++;}panTo(p){K.log.pan.push([p.lat,p.lng]);}setLevel(n){K.log.level.push(n);}},
    Circle:class{constructor(o){this.o=o;K.log.circle=this;this.radius=o.radius;this.center=o.center;}setMap(){}setPosition(p){this.center=p;}setRadius(r){this.radius=r;}getBounds(){return {};}},
    CustomOverlay:class{constructor(o){this.o=o;this.on=false;}setMap(m){this.on=!!m;if(m){K.log.overlays.push(this);m.el.append(this.o.content);}else{K.log.overlays=K.log.overlays.filter(x=>x!==this);this.o.content.remove();}}},
    services:{Status:{OK:'OK',ZERO_RESULT:'ZERO_RESULT'},
     Geocoder:class{addressSearch(a,cb){K.log.addr.push(a);const T={[ADDR]:[C[0],C[1]],'경기 화성시 동탄대로 99':[37.2005,127.1246]},h=T[a];setTimeout(()=>h?cb([{y:String(h[0]),x:String(h[1]),address_name:a}],'OK'):cb([],'ZERO_RESULT'),0);}},
     Places:class{keywordSearch(q,cb){K.log.place.push(q);let R=[];
       if(q.includes('동탄파크뷰'))R=[{place_name:'동탄파크뷰아파트',address_name:'경기 화성시 능동 1',road_address_name:'경기 화성시 동탄지성로 5',y:'37.2374',x:'127.0975'},{place_name:'동탄파크뷰 관리사무소',address_name:'경기 화성시 능동 1',road_address_name:'',y:'37.2375',x:'127.0976'},{place_name:'동탄파크뷰아파트',address_name:'부산 해운대구 우동 1',road_address_name:'',y:'35.16',x:'129.16'}];
       if(q.includes('다른이름타워'))R=[{place_name:'다른이름타워',address_name:'서울 강남구 역삼동 1',road_address_name:'',y:'37.50',x:'127.03'},{place_name:'다른이름타워',address_name:'부산 해운대구 우동 2',road_address_name:'',y:'35.16',x:'129.16'}];
       setTimeout(()=>R.length?cb(R,'OK'):cb([],'ZERO_RESULT'),0);}}}}};
   window.A=A;window.U=U;InquirySite._resetMap();goPage('inq');
  });
  await page.waitForTimeout(300);
  const d=page.locator('#inq-inbox-dialog'),NR=d.locator('.isd-near');
  assert.deepEqual(await page.evaluate(()=>[InquirySite.regionTokens('[경기 화성] 가'),InquirySite.regionTokens('[경기용인] 가'),InquirySite.regionTokens('[서울_마포] 가'),InquirySite.regionTokens('[대구 동구] 가'),InquirySite.regionTokens('이름만'),InquirySite.cleanAddr('경기 화성시 동탄대로 99 (오산동) 101동 1203호'),InquirySite.kmText(0.9),InquirySite.kmText(2.44)]),
   [['경기','화성'],['경기','용인'],['서울','마포'],['대구','동구'],[],'경기 화성시 동탄대로 99','900m','2.4km']);
  /* 바깥 연결: 카카오 주소 검색 · 장소 검색(GET)만 열려 있고, 다른 카카오 주소 · POST · 다른 사이트는 계속 막힌다 */
  assert.deepEqual(await page.evaluate(()=>{const t=(m,u)=>{try{new XMLHttpRequest().open(m,u);return 'ok';}catch(e){return String(e.message||e);}};
   return [t('GET','https://dapi.kakao.com/v2/local/search/address.json?query=x'),t('GET','https://dapi.kakao.com/v2/local/search/keyword.json?query=x'),t('GET','https://dapi.kakao.com/v2/local/search/category.json'),t('GET','https://dapi.kakao.com/v2/local/geo/coord2address.json'),t('POST','https://dapi.kakao.com/v2/local/search/address.json'),t('GET','https://dapi.kakao.com.example.com/v2/local/search/address.json'),t('GET','https://example.com/')];}),
   ['ok','ok','PHASE1_TRANSPORT_DENIED','PHASE1_TRANSPORT_DENIED','PHASE1_TRANSPORT_DENIED','PHASE1_TRANSPORT_DENIED','PHASE1_TRANSPORT_DENIED']);
  assert.equal(await page.evaluate(()=>fetch('https://dapi.kakao.com/v2/local/search/address.json',{method:'POST'}).then(()=>'sent',e=>String(e.message||e))),'PHASE1_TRANSPORT_DENIED','fetch 로도 POST 는 막힌다');
  /* ① 지도 키가 없으면: 관리자에게만 등록 칸, 목록은 같은 지역 기준 그대로 */
  await page.evaluate(()=>InquiryWorkbench.open(A));await page.waitForSelector('#inq-inbox-dialog.idv3 .isd-near .isd-keyform');
  assert.match(one(await NR.locator('.isd-map').innerText()),/^카카오맵 키 등록 카카오 개발자 사이트에서 받은 JavaScript 키를 넣으면 지도 · 반경 · 거리가 켜집니다\. 지금은 같은 지역\(.*화성.*\)의 현장을 보여 줍니다\./);
  assert.deepEqual(await NR.locator('.seg button').evaluateAll(l=>l.map(b=>b.disabled)),[true,true,true]);
  assert.equal(await NR.locator('.isd-nrow').count(),3,'같은 지역 현장 3곳(같은 현장의 영업건 2건은 한 줄)');
  assert.equal(await page.evaluate(()=>{const adm=window.inqCtlIsAdmin;window.inqCtlIsAdmin=()=>false;try{const t=document.createElement('div');t.innerHTML=InquirySite.nearHtml(B.inquiries[0],{},'');const m=t.querySelector('.isd-map');return [m.textContent.startsWith('지도 준비 중관리자가 카카오맵 키를 등록하면 지도가 켜집니다.'),!!m.querySelector('.isd-keyform')].join();}finally{window.inqCtlIsAdmin=adm;InquiryWorkbench.close();InquiryWorkbench.open(A);}}),'true,false','담당자에게는 등록 칸이 없다');
  /* ② 키 등록 → 지도 */
  await NR.locator('.isd-keyform input').fill('abcdef0123456789abcdef0123456789');await NR.locator('[data-idv="map-key-save"]').click();
  await page.waitForSelector('#inq-inbox-dialog .isd-near [data-isd-map] .isd-mapbox');
  await page.waitForFunction(()=>!InquirySite._map.job&&InquirySite._map.todo.size===0&&GEO.saved.length>=4);await page.waitForTimeout(200);
  assert.deepEqual(await page.evaluate(()=>GEO.calls.filter(n=>n==='crm_map_config_v1').length),1);
  /* 좌표 찾기: 1번 = 주소, 3번 = 정리한 주소, 4번 = 이름(화성에 있는 것만 · 관리사무소는 같은 자리), 5번 = 같은 이름이 서울 · 부산에 있어 고르지 않음 */
  const saved=await page.evaluate(()=>GEO.saved.map(r=>[r.site_id.slice(-1),r.source,r.lat||null,r.query]).sort((a,b)=>a[0].localeCompare(b[0])));
  assert.deepEqual(saved,[['1','address',37.2005,'경기도 화성시 동탄청계로 303-13'],['3','address',37.2005,'경기 화성시 동탄대로 99 (오산동) 101동 1203호'],['4','name',37.2374,'[경기 화성] 동탄파크뷰'],['5','none',null,'다른이름타워']]);
  assert.deepEqual(await page.evaluate(()=>[KLOG.addr.includes('경기 화성시 동탄대로 99'),KLOG.place.some(q=>q==='경기 화성 동탄파크뷰'),KLOG.place.some(q=>q==='다른이름타워')]),[true,true,true]);
  /* 반경 3km(기본): 2번 0.9km · 3번 2.4km — 4번은 4.1km 라 목록 밖, 점은 찍힌다. 6번(천안)은 점도 없다 */
  const exp=await page.evaluate(()=>{const c={lat:C[0],lng:C[1]},k=(a,b)=>InquirySite.kmText(InquirySite.km(c,{lat:a,lng:b}));return [k(37.2086,127.0975),k(37.2005,127.1246),k(37.2374,127.0975)];});
  assert.deepEqual(exp,['901m','2.4km','4.1km']);
  assert.equal(one(await NR.locator('header').innerText()),'근처에서 영업했던 현장 2곳 · 반경 3km 담당 변경');
  assert.deepEqual(await NR.locator('.seg button').evaluateAll(l=>l.map(b=>[b.textContent,b.disabled,b.getAttribute('aria-pressed')])),[['1km',false,'false'],['3km',false,'true'],['5km',false,'false']]);
  assert.deepEqual((await NR.locator('.isd-nrow').allInnerTexts()).map(one),['동탄새빛캐슬 수주 2025.6 · 옥상 · 이필선 · 2.1억 901m','동탄푸른교회 03. 자료 발송완료 · 황윤선 · 600만 2.4km']);
  assert.deepEqual(await page.evaluate(()=>[KLOG.maps,KLOG.circle.radius,KLOG.overlays.length,KLOG.overlays.filter(o=>o.o.content.classList.contains('now')).length,[...document.querySelectorAll('#inq-inbox-dialog .isd-mapbox .isd-dot:not(.now)')].map(e=>e.title).sort()]),
   [1,3000,4,1,['동탄새빛캐슬 · 수주 2025.6','동탄파크뷰 · 실주 2025.3','동탄푸른교회 · 03. 자료 발송완료']]);
  assert.deepEqual(await page.evaluate(()=>{const n=document.querySelector('#inq-inbox-dialog .isd-dot.now');return [n.title,getComputedStyle(n).backgroundColor,getComputedStyle(document.querySelector('#inq-inbox-dialog .isd-map')).height];}),['지금 문의 · 한빛마을2차아파트','rgb(232, 89, 12)','230px']);
  if(process.env.SHOT_DIR)await page.screenshot({path:path.join(process.env.SHOT_DIR,'inqsite-map.png')});
  /* ③ 반경 바꾸기: 근처 현장 칸만 다시 그린다(가운데 칸은 그대로) · 원 반지름 · 목록 */
  await page.evaluate(()=>{document.querySelector('#inq-inbox-dialog .idv3-c2').dataset.keep='1';});
  await NR.locator('[data-idv="rad"][data-v="5"]').click();await page.waitForTimeout(150);
  assert.equal(one(await NR.locator('header').innerText()),'근처에서 영업했던 현장 3곳 · 반경 5km 담당 변경');
  assert.deepEqual((await NR.locator('.isd-nrow em').allInnerTexts()),['901m','2.4km','4.1km']);
  assert.deepEqual(await page.evaluate(()=>[KLOG.maps,KLOG.circle.radius,document.querySelector('#inq-inbox-dialog .idv3-c2').dataset.keep,!!document.querySelector('#inq-inbox-dialog [data-isd-map] .isd-mapbox[data-made]'),document.querySelector('#inq-inbox-dialog .isd-nrow:nth-child(3) em').title]),[1,5000,'1',true,'현장 이름으로 찾은 위치입니다(주소 미입력)']);
  await NR.locator('[data-idv="rad"][data-v="1"]').click();await page.waitForTimeout(150);
  assert.equal(one(await NR.locator('header').innerText()),'근처에서 영업했던 현장 1곳 · 반경 1km 담당 변경');assert.equal(await page.evaluate(()=>KLOG.circle.radius),1000);
  /* ④ 줄을 누르면 지도 이동 · 그 줄과 점 강조 */
  await NR.locator('.isd-nrow').first().click();await page.waitForTimeout(100);
  assert.deepEqual(await page.evaluate(()=>[KLOG.pan.length,KLOG.pan[0],KLOG.level[0],document.querySelector('#inq-inbox-dialog .isd-nrow').classList.contains('on'),document.querySelectorAll('#inq-inbox-dialog .isd-dot.on').length,!!document.getElementById('inq-inbox-dialog')]),[1,[37.2086,127.0975],4,true,1,true]);
  /* ⑤ 창 전체를 다시 그려도 지도는 새로 만들지 않고 옮겨 꽂는다 */
  await d.locator('.isd-scope [data-v="all"]').click();await page.waitForTimeout(150);
  assert.deepEqual(await page.evaluate(()=>[KLOG.maps,KLOG.relayout>0,!!document.querySelector('#inq-inbox-dialog [data-isd-map] .isd-mapbox[data-made]'),document.querySelector('#inq-inbox-dialog .isd-near header span').textContent]),[1,true,true,'1곳 · 반경 1km']);
  /* ⑤-2 지도 서비스가 오류를 돌려주면(설정 · 사용량 문제) '못 찾음'으로 저장하지 않고 멈춘다 — 지도는 이미 아는 좌표로 그대로 */
  const er=await page.evaluate(async()=>{InquiryWorkbench.close();InquirySite._resetMap();GEO.saved=[];GEO.sites=[[U(1),C[0],C[1],'address',null,null],[U(3),null,null,null,'오류 나는 주소 1','[경기 화성] 동탄푸른교회']];
   const G0=kakao.maps.services.Geocoder;kakao.maps.services.Geocoder=class{addressSearch(a,cb){setTimeout(()=>cb([],'ERROR'),0);}};
   InquiryWorkbench.open(A);await new Promise(r=>setTimeout(r,900));kakao.maps.services.Geocoder=G0;
   return [GEO.saved.length,InquirySite._map.err,InquirySite._map.todo.size,!!document.querySelector('#inq-inbox-dialog [data-isd-map] .isd-mapbox')];});
  assert.deepEqual(er,[0,'blocked',1,true]);
  /* ⑥ 서버 함수가 없으면 1차 화면 그대로 */
  const off=await page.evaluate(async()=>{InquiryWorkbench.close();InquirySite._resetMap();SB={rpc:async()=>({error:{code:'PGRST202',message:'Could not find the function'}})};InquiryWorkbench.open(A);await new Promise(r=>setTimeout(r,200));const m=document.querySelector('#inq-inbox-dialog .isd-map');return [m.classList.contains('empty'),m.textContent.startsWith('지도 준비 중카카오맵 키 등록과 현장 좌표 저장이 끝나면'),document.querySelectorAll('#inq-inbox-dialog .isd-nrow').length];});
  assert.deepEqual(off,[true,true,3]);
  assert.deepEqual(errs,[],'화면 오류 없음: '+errs.join(' | '));
  console.log('inquiry site map ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
