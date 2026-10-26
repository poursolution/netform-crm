'use strict';
/* 받는 사람별 확인(2026-10-25 · Flow 공지 '확인 여부 한눈에' 차용): 보낸 요청 머리 아래 '아직 안 봄 / 확인함' 이름 칩 · 줄마다 봄 시각 · 칩 = 그 사람만 · 끄기 G.wrqSeenOff.
   가짜 저장소 · 합성 자료는 verify-work-request-browser 와 같은 틀. */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'',dump=process.env.WRQ_DUMP==='1';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.EDGE_PATH?{executablePath:process.env.EDGE_PATH}:{})});
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  /* 오늘 = 2026-10-07(수) 10:00 */
  await page.clock.setFixedTime(new Date('2026-10-07T10:00:00+09:00'));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.WorkRequest&&window.TodayAssist&&window.TodayV3&&window.TodayWorkQueue&&window.TodayTower&&window.OpsStore&&window.InquiryDetailV2);
  const seed=()=>page.evaluate(()=>{
   const at=d=>new Date(Date.now()-d*864e5).toISOString(),day=d=>new Date(Date.now()+d*864e5).toLocaleDateString('en-CA');
   const inq=(i,site,days,extra)=>Object.assign({id:'0000000'+i+'-0000-4000-8000-00000000000'+i,site,status:'접수',at:at(days),created_at:at(days),brand:'POUR솔루션',phone:'010-1234-56'+(10+i),contact_name:'고객'+i+' 관리소장',assignee:'',assigned_to:'',assigned_at:'',work_type:'옥상방수',raw:{'문의내용':'옥상 누수 재발 문의','상담채널':'홈페이지','공사유형':'옥상방수'}},extra||{});
   const deal=(id,site,extra)=>Object.assign({id,site,assignee:'이필선',brand:'POUR솔루션',created:day(0),code:'consulting',stage_code:'consulting',grp:'영업·관리',amt:2e8,manager_name:'김소장',manager_mobile:'01077778888',last_activity_at:at(1),next_action:{id:'n-'+id,type:'전화',text:'후속',due:day(5),status:'open'}},extra||{});
   B={deals:[
     deal('stall1','[경기 용인] 멈춘 현장',{assignee:'김성민',code:'sent',stage_code:'sent',amt:1.1e8,last_activity_at:at(12),stage_contexts:{sent:{fields:{sent_date:day(-12)}}},next_action:{id:'n3',type:'전화',text:'견적 검토 확인',due:day(-3),status:'open'}}),
     deal('con1','[경기 하남] 고덕아이파크',{amt:2.1e8,code:'contract',stage_code:'contract',assignee:'정정훈',brand:'아파트스퀘어',next_action:{id:'n4',type:'방문',text:'계약 미팅',due:day(4),status:'open'}})],
    inquiries:[
     inq(1,'[경북 경주] 전원하이빌',12,{status:'배정완료',assignee:'경남지사',assigned_to:'경남지사',assignment_group:'gyeongnam',assigned_at:at(12)}),
     inq(2,'[서울 강남] 강변삼부아파트',14,{status:'배정완료',assignee:'이필선',assigned_to:'10000000-0000-4000-8000-000000000001',assigned_at:at(14),raw:{'문의내용':'지하주차장 재도장 문의','상담채널':'전화','공사유형':'지하주차장 재도장'},work_type:'지하주차장 재도장'}),
     inq(3,'[서울 송파] 가락현대TWELVE',14,{status:'배정완료',assignee:'이필선',assigned_to:'10000000-0000-4000-8000-000000000001',assigned_at:at(14)}),
     inq(4,'[대전] 웰니스병원',19,{status:'배정완료',brand:'석민이앤씨',assignee:'송보람',assigned_to:'송보람',assigned_at:at(19)})],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{}};AUTH_ON=true;ME={id:'u-admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.today3=null;G.todayAssist=null;G.tower=null;G.towerRole=null;G.todayQueueOwner='전체';G.workReq=null;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.__writes=[];window.pushWrite=(op,p)=>{__writes.push([op,p]);return 'req-'+__writes.length;};
   window.__open=[];TodayWorkQueue.open=(k,a)=>{__open.push([k,a||'']);};window.__toasts=[];window.toast=m=>{__toasts.push(String(m));};
   /* 가짜 저장소: sql/work-request-v1-20261005.sql 과 같은 규칙(관리자만 보냄 · 같은 요청 잠금 · 받는 사람만 회신 · 기한이 지나야 재확인) */
   const U={'송보람':'u-admin','이필선':'10000000-0000-4000-8000-000000000001','김성민':'u-kim','정정훈':'u-jung','조민준':'u-jo'};window.__db=[];window.__rpc=[];let seq=0;
   const role=()=>ME.role==='admin'?'admin':ME.role==='branch'?'branch':'rep',uid=()=>U[ME.name]||ME.id;
   const J=r=>Object.assign({},r,{to_user_id:r._to,to_reach:r.to_scope==='branch'?true:!!r._to,open:['sent','seen','working'].includes(r.status),overdue:['sent','seen','working'].includes(r.status)&&Date.parse(r.due_at)<Date.now(),by_me:r._by===uid(),to_me:(r.to_scope==='user'&&r._to===uid())||(r.to_scope==='branch'&&role()==='branch')});
   const err=m=>({error:{message:m}}),now=()=>new Date().toISOString();
   window.__srv=true;window.CRMRelease={has:()=>true};
   SB={rpc:async(name,args)=>{const p=(args&&args.p)||{};__rpc.push([name,JSON.parse(JSON.stringify(p)),ME.name]);
    if(!window.__srv&&/^crm_work_request_/.test(name))return {error:{code:'PGRST202',message:'Could not find the function'}};
    if(name==='crm_work_request_create_v1'){if(role()!=='admin')return err('요청은 관리자만 보낼 수 있습니다');
     if(__db.some(r=>r.target_type===p.target_type&&r.target_id===p.target_id&&r.kind===p.kind&&['sent','seen','working'].includes(r.status)))return err('이미 답을 기다리는 같은 요청이 있습니다');
     if(p.to_scope==='user'&&!U[p.to_name]&&!['전용성','조성용'].includes(p.to_name))return err('받는 사람을 찾을 수 없습니다');/* 영업이사 명단은 계정이 없어도 남긴다 */
     const r={id:'r'+(++seq),target_type:p.target_type,target_id:p.target_id,site:p.site,brand:p.brand,kind:p.kind,label:p.label,to_scope:p.to_scope,to_name:p.to_name,asks:p.asks,due_at:p.due_at,due_label:p.due_label,memo:p.memo,status:'sent',result:null,result_owner:null,next_text:null,next_due:null,reply_note:null,auto_done:false,round:1,requested_by:ME.name,replied_by:null,created_at:now(),reasked_at:null,seen_at:null,closed_at:null,updated_at:now(),_by:uid(),_to:U[p.to_name]||null};
     __db.unshift(r);return {data:{ok:true,request:J(r)}};}
    if(name==='crm_work_request_list_v1'){const rows=__db.filter(r=>p.target_type?(r.target_type===p.target_type&&r.target_id===p.target_id):(role()==='admin'||r._by===uid()||(r.to_scope==='user'&&r._to===uid())||(r.to_scope==='branch'&&role()==='branch')));return {data:{ok:true,requests:rows.map(J)}};}
    if(name==='crm_work_request_inquiry_contact_v1'){
     if(window.__badContactAck)return {data:{ok:true}};
     const r=__db.find(x=>x.id===p.id);if(!r||r._to!==uid())return err('받는 담당자만 기록할 수 있습니다');
     const lid='20000000-0000-4000-8000-000000000001';Object.assign(r,{status:p.result==='부재'?'working':'done',result:p.result,next_text:p.next_text,next_due:p.next_due,replied_by:ME.name,closed_at:p.result==='부재'?null:now(),updated_at:now()});
     const state={inquiry_id:r.target_id,logs:[{id:lid,request_id:p.operation_id,result:p.result,kind:p.result==='부재'?'attempt':'connected',next_action:p.next_text,next_check_date:p.next_due,occurred_at:now()}]};
     return {data:{ok:true,contract_version:1,operation_id:p.operation_id,inquiry_id:r.target_id,log_id:lid,next_action_id:'30000000-0000-4000-8000-000000000001',request:J(r),state,
      inquiry_update:{next_action_date:p.next_due},server_at:now()}};
    }
    if(name==='crm_work_request_reply_v1'){const r=__db.find(x=>x.id===p.id);if(!r)return err('요청을 찾을 수 없습니다');const mine=(r.to_scope==='user'&&r._to===uid())||(r.to_scope==='branch'&&role()==='branch');
     if(p.action!=='cancel'&&!mine&&role()!=='admin')return err('받는 사람만 처리할 수 있습니다');if(!['sent','seen','working'].includes(r.status))return {data:{ok:true,request:J(r),already:true}};
     if(p.action==='seen'){if(r.status==='sent')r.status='seen';r.seen_at=r.seen_at||now();}
     else if(p.action==='reply'){if(!p.result)return err('처리 결과를 골라 주세요');if(p.result==='담당 지정 완료'&&!p.result_owner)return err('실담당을 골라 주세요');Object.assign(r,{status:'replied',result:p.result,result_owner:p.result_owner||null,replied_by:ME.name,closed_at:now()});}
     else if(p.action==='done'){Object.assign(r,{status:p.absent?'absent':'done',result:p.result,next_text:p.next_text||null,next_due:p.next_due||null,auto_done:!!p.auto,replied_by:ME.name,closed_at:now()});}
     else if(p.action==='cancel'){Object.assign(r,{status:'cancelled',reply_note:p.note||null,replied_by:ME.name,closed_at:now()});}/* 요청 종료(취소 · 통합 · 대상 오류) = 서버 cancel + note */
     r.updated_at=now();return {data:{ok:true,request:J(r)}};}
    if(name==='crm_work_request_reask_v1'){const r=__db.find(x=>x.id===p.id);if(role()!=='admin')return err('재확인 요청은 관리자만 할 수 있습니다');if(!r||Date.parse(r.due_at)>=Date.now())return err('기한이 지난 뒤에 재확인을 요청할 수 있습니다');
     Object.assign(r,{round:r.round+1,due_at:p.due_at,due_label:p.due_label,status:'sent',reasked_at:now(),updated_at:now()});return {data:{ok:true,request:J(r)}};}
    return {error:{message:'CONTRACT_UNAVAILABLE'}};}};
   G.dayZonesOff=true;/* 예전 묶음 구조 · 카드 흐름을 본다(4구역은 verify-day-zones-browser) */goPage('today');
  });
  const one=s=>String(s).replace(/\s+/g,' ').trim();
  const as=async(me)=>{await page.evaluate(me=>{ME=me;G.workReq=null;G.today3=null;G.todayQueueOwner='전체';paint();},me);await page.waitForTimeout(500);await page.evaluate(()=>paint());await page.waitForTimeout(250);};
  await seed();await page.waitForTimeout(900);
  const v=page.locator('#today-v2 .tv3');assert.equal(await v.getAttribute('data-role'),'mgr');assert.equal(await v.evaluate(n=>n.classList.contains('wrq-on')),true,'저장소가 있으면 요청 업무 켜짐');
  /* 받는 사람별 확인: 보낸 요청 4건(이필선 2 = 안 봄 1 · 봄 1 / 김성민 1 봄 / 정정훈 1 완료) */
  await page.evaluate(()=>{const now=Date.now(),iso=h=>new Date(now-h*36e5).toISOString(),due=new Date(now+2*864e5).toISOString();
   const mk=(id,site,to,status,ch,sh)=>({id,target_type:'deal',target_id:'t-'+id,site,brand:'POUR솔루션',kind:'followup',label:'후속 연락 요청',to_scope:'user',to_name:to,asks:['고객 연락'],due_at:due,due_label:'3일 안',memo:'',status,result:status==='done'?'통화 완료':null,round:1,requested_by:'송보람',created_at:iso(ch),reasked_at:null,seen_at:sh==null?null:iso(sh),closed_at:status==='done'?iso(1):null,updated_at:iso(1),_by:'u-admin',_to:'x'});
   __db.push(mk('s1','[경기 용인] 수지현대','이필선','sent',50,null),mk('s2','[서울] 잠실엘스','이필선','seen',30,20),mk('s3','[인천] 송도더샵','김성민','working',26,5),mk('s4','[경기 하남] 미사강변','정정훈','done',48,40));G.workReq=null;paint();});
  await page.waitForTimeout(700);await page.evaluate(()=>paint());await page.waitForTimeout(300);
  const box=v.locator('.wrq-sent .wrq-seen');assert.equal(await box.count(),1,'보낸 요청 머리 아래 확인 상자');
  const cols=await box.locator('.col').evaluateAll(l=>l.map(c=>[c.querySelector('em').textContent,[...c.querySelectorAll('.wrq-who')].map(b=>b.textContent)]));
  assert.deepEqual(cols,[['아직 안 봄 1명',['이필선안 봄 1 / 2 · 2일째']],['확인함 1명',['김성민1건']]],JSON.stringify(cols));
  assert.equal(one(await box.locator('.sh small').innerText()),'열린 요청 3건 · 봄 = 열어 봄(처리 아님)','완료 건은 확인 현황에서 빠진다');
  const smalls=async()=>v.locator('.wrq-sent .wrq-sr').evaluateAll(l=>l.map(n=>n.querySelector('.l1 b').textContent+' | '+n.querySelector('.l2').textContent));
  const s0=await smalls();assert.ok(s0.includes('[경기 용인] 수지현대 | 이필선 안 봄 2일째 · 고객 연락'),JSON.stringify(s0));assert.ok(s0.some(t=>/^\[서울\] 잠실엘스 \| 이필선 봄 어제 \d\d:\d\d · 고객 연락$/.test(t)),JSON.stringify(s0));assert.ok(s0.includes('[경기 하남] 미사강변 | 정정훈 · 고객 연락'),'완료 줄에는 봄 표시 없음');
  if(shot)await v.locator('.wrq-sent').screenshot({path:shot+'-seen.png'});
  assert.deepEqual(await v.locator('.wrq-sent .wrq-who, .wrq-sent .wrq-seen .sh b, .wrq-sent .wrq-sr .l2').evaluateAll(l=>l.filter(n=>n.scrollWidth>n.clientWidth+1&&!n.classList.contains('l2')).map(n=>n.textContent)),[],'이름 칩 · 제목 잘림 없음');
  assert.equal(await v.locator('.wrq-sent .wrq-sr .l2 em').first().evaluate(n=>{const r=n.getBoundingClientRect(),p=n.closest('.l2').getBoundingClientRect();return r.right<=p.right+1;}),true,'안 봄 · 봄 표시는 잘리지 않는 자리');
  /* 이름 칩 = 그 사람 것만 · 탭 숫자도 같이 · 다시 누르면 전체 */
  await box.locator('.wrq-who').first().click();await page.waitForTimeout(250);
  assert.deepEqual((await smalls()).map(t=>t.split(' | ')[0]).sort(),['[경기 용인] 수지현대','[서울] 잠실엘스']);
  assert.match(one(await v.locator('.wrq-sent>header span').innerText()),/이필선 2건만$/);
  assert.equal(one(await v.locator('.wrq-sent [data-wr="senttab"][data-v="all"]').innerText()),'전체 2');
  if(shot)await v.locator('.wrq-sent').screenshot({path:shot+'-seen-filter.png'});
  await v.locator('.wrq-sent .wrq-seen .wrq-who').first().click();await page.waitForTimeout(250);assert.equal((await smalls()).length,4);
  /* 끄기 */
  await page.evaluate(()=>{G.wrqSeenOff=true;paint();});await page.waitForTimeout(300);assert.equal(await v.locator('.wrq-seen').count(),0);assert.equal((await smalls()).some(t=>/봄/.test(t)),false);
  
  /* 2026-10-26 지금 운영 화면(오늘 업무 v6): 관리자는 목록 아래에 '답 기다리는 중 · 보낸 요청' — 담당자 화면엔 없음 · 끄기 G.t6WrqOff */
  await page.evaluate(()=>{G.wrqSeenOff=false;G.dayZonesOff=false;G.todayV6Off=false;G.today3=null;paint();});await page.waitForTimeout(700);await page.evaluate(()=>paint());await page.waitForTimeout(300);
  const t6=page.locator('#today-v2 .tv6');assert.equal(await t6.count(),1,'v6 화면');
  const wq=t6.locator('.tv6-right>.tv6-wrq');assert.equal(await wq.count(),1,'목록 아래 요청 칸');
  assert.equal(await t6.locator('.tv6-right>*').last().evaluate(n=>n.classList.contains('tv6-wrq')),true,'목록 · 카드 뒤 맨 아래');
  assert.equal(await wq.locator('section.wrq-sent .wrq-seen').count(),1,'받는 사람별 확인도 같이');assert.equal(await wq.locator('section.wrq-wait').count(),1,'답 기다리는 중');
  assert.deepEqual(await wq.locator('.wrq-who').allInnerTexts().then(a=>a.map(one)),['이필선 안 봄 1 / 2 · 2일째','김성민 1건']);
  assert.deepEqual(await wq.evaluate(n=>[...n.querySelectorAll('.wrq-who, .wrq-seen .sh b, .wrq-w .l1 b')].filter(e=>e.scrollWidth>e.clientWidth+1&&!e.matches('.wrq-w .l1 b')).map(e=>e.textContent)),[],'잘림 없음');
  if(shot)await t6.locator('.tv6-right').screenshot({path:shot+'-v6.png'});
  await page.evaluate(()=>{G.t6WrqOff=true;paint();});await page.waitForTimeout(300);assert.equal(await page.locator('#today-v2 .tv6-wrq').count(),0,'끄기');
  await page.evaluate(()=>{G.t6WrqOff=false;ME={id:'10000000-0000-4000-8000-000000000001',name:'이필선',role:'rep'};G.today3=null;G.tower=null;G.towerRole=null;G.workReq=null;paint();});await page.waitForTimeout(700);await page.evaluate(()=>paint());await page.waitForTimeout(300);
  assert.equal(await page.locator('#today-v2 .tv6-wrq').count(),0,'담당자 화면엔 요청 칸 없음');
  assert.deepEqual(errs,[]);console.log(JSON.stringify({status:'PASS',seen_board:true,filter_by_person:true,done_excluded:true,off_switch:true,v6_admin_below_list:true,v6_rep_none:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
