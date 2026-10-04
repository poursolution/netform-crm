'use strict';
/* 전 화면 눌러 보기(시뮬레이션 검증 · 2026-10-04 대표 "지금 안 되는 거 계속 나온다 — 처음부터 끝까지 다 돌려 봐")
   가짜 자료를 넣고 화면마다 보이는 버튼 · 탭 · 줄을 하나씩 눌러 본다. 저장 · 서버 호출 · 발송은 전부 가짜(기록만) — 실제 자료는 건드리지 않는다.
   잡는 것: ① 누르면 스크립트 오류 ② "먼저 … 선택해 주세요"처럼 대상 없이 안내만 뜨는 버튼 ③ 눌러도 아무 일도 없는 버튼(화면 변화 · 호출 · 안내 · 이동 · 포커스 모두 없음)
   쓰는 법: node scripts/simulate-click-all.cjs [결과.json] [화면 이름 …]   (검사 묶음(smoke)에는 넣지 않는다 — 사람이 결과를 읽는 도구) */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=process.argv[2]||'',only=process.argv.slice(3);
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
/* ── 가짜 자료 · 가짜 저장 ── */
function seed(role){
 const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA'),at=n=>new Date(Date.now()+n*864e5).toISOString();
 let seq=0;const mk=(site,who,code,extra)=>{seq++;const x=String(seq).padStart(2,'0');return Object.assign({id:x.repeat(4)+'-1111-4111-8111-'+x.repeat(6),site,site_id:'5'+x.repeat(3)+'0-0000-4000-8000-'+x.repeat(6),assignee:who,brand:'POUR솔루션',created:day(-90),updated:day(-10),code,stage_code:code,grp:'영업·관리',amt:1e8,manager_name:'김영수',manager_mobile:'01012345678',office_phone:'0212345678',contacts:[{person_key:'mobile:01012345678',name:'김영수',role:'관리소장',mobile:'01012345678',status:'current'}],activities:[{id:'a'+seq,type:'전화',note:'소장 통화',at:at(-20),actor:who,meaningful:true}],next_action:{id:'n'+seq,text:'후속 통화',due:day(3),status:'open'}},extra||{});};
 const W=mk('[서울 강서] 마곡청구아파트','황윤선','won',{outcome:'won',grp:'수주 성공',won_amount:82e6,closed_at:day(-60),completion_date:day(-60),contract_date:day(-80),next_action:null});
 const L=mk('[경기 오산] 원동 e편한세상','한준엽','lost',{outcome:'lost',grp:'수주 실패',closed_at:day(-40),lost_reason:'가격 열세',next_action:null,stage_contexts:{lost:{fields:{close_reason:'가격 열세',close_detail:'확인'}}}});
 const D=[mk('[경기 평택] 오뚜기 포승공장','이필선','sent',{stage_contexts:{sent:{fields:{sent_date:day(-15)}}}}),W,L,mk('[경남 창원] 창원 대동','이필선','consulting'),mk('[서울 송파] 잠실 리센츠','황윤선','waiting',{next_action:{id:'nx',text:'안부 연락',due:day(-5),status:'open'}}),mk('[수원] 매탄 임박','이필선','bidding',{amt:4e8,brand:'석민이앤씨',stage_contexts:{bidding:{fields:{bid_deadline:day(2),bid_terms:'일반'}}}}),mk('[서울 강남] 계약 검토','정정훈','contract',{amt:3e8,stage_contexts:{contract:{fields:{contract_status:'체결 예정',contract_amount:35e7,contract_date:day(20)}}}})];
 const inq=(n,site,owner,days,extra)=>Object.assign({id:'q000000'+n+'-0000-4000-8000-00000000000'+n,site,address:'경기도 어딘가',status:owner?'배정완료':'접수',at:at(-days),created_at:at(-days),received_at:at(-days),brand:'POUR솔루션',phone:'010-5436-066'+n,contact_name:'고객'+n+' 소장',work_type:'옥상방수',assignee:owner||'',assigned_to:owner||'',assigned_at:owner?at(-days+0.1):null,raw:{'문의내용':'옥상 방수 견적 문의 '+n,'상담채널':'전화','공사유형':'옥상방수','유입경로':'전화'}},extra||{});
 window.B={deals:D,inquiries:[inq(1,'[충남 천안] 천안두정E편한세상2차','정정훈',2),inq(2,'[서울 강남] 강변삼부아파트','',6),inq(3,'[경남 거제] 한국전력공사','경남지사',17,{assignment_group:'gyeongnam'}),inq(4,'(주)한빛관리','',9,{work_type:'기술 공법 협약 관련 문의',raw:{'문의내용':'협약하고 싶습니다','공사유형':'기술 공법 협약 관련 문의'}}),inq(5,'[인천] 응대 중 현장','이필선',4,{status:'상담중',responded_at:at(-3.5),activities:[{type:'전화',note:'소장 통화',at:at(-3.5),actor:'이필선'}]})],
  activities:[],inquiryTrash:[],messageLogs:[],message_logs:[],
  expansion_pool:[{id:'e2',source_opportunity_id:W.id,site_name:W.site,owner_name:'황윤선',source_work_summary:'옥상 방수',source_won_amount:82e6,completion_date:day(-60),next_contact_at:day(5),last_contact_at:day(-7),expansion_status:'접촉 예정',candidate_work_items:['지하주차장','재도장'],version:1}],
  campaigns:[{id:'c1',category_key:'sent',category:'견적 발송 후 7일',body:'소장님, 넷폼입니다.',status:'partial',recipient_count:2,sent_count:1,failed_count:1,created_by:'이필선',created_at:at(-2),recipients:[{recipient_key:'k1',opportunity_id:D[0].id,site_name:D[0].site,contact_name:'김영수',status:'sent'},{recipient_key:'k2',opportunity_id:D[3].id,site_name:D[3].site,contact_name:'김영수',status:'failed',last_error:'번호 확인 필요'}]}],
  rep_manager_comments:[]};
 window.LOCAL={deals:{},inquiries:{},expansionPool:[]};window.AUTH_ON=true;
 window.ME=role==='rep'?{id:'rep1',name:'이필선',role:'rep'}:{id:'admin',name:'송보람',role:'admin'};
 Object.assign(G,{year:'전체',quarter:0,rep:'전체',brand:'전체',workFilter:'전체',q:'',inqPeriodMode:'snapshot'});
 document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';
 const S=window.__sim=window.__sim||{alerts:[],toasts:[],calls:[]};
 window.saveLocal=()=>{};window.pushWrite=(op)=>{S.calls.push('write:'+op);return 'req-'+S.calls.length;};
 window.alert=m=>{S.alerts.push(String(m));};window.confirm=m=>{S.alerts.push('확인창: '+String(m));return false;};window.prompt=m=>{S.alerts.push('입력창: '+String(m));return null;};
 if(!window.__toast0)window.__toast0=window.toast;window.toast=function(m,k){S.toasts.push(String(m));};
 window.open=()=>{S.calls.push('window.open');return null;};
 window.SB={rpc:async n=>{S.calls.push('rpc:'+n);return {data:{ok:true,rows:[],tasks:[],events:[],requests:[]}};}};window.TOKEN='sim';
 try{const O=window.OpsStore;if(O&&!O.__sim){O.__sim=true;O.rpc=async n=>{S.calls.push('ops:'+n);return {rows:[],tasks:[],events:[],requests:[],owner:null,request:null};};O.ai=async k=>{S.calls.push('ai:'+k);return {suggestion:{}};};}}catch(e){}
 try{const C=window.ContractSalesData;if(C&&!C.__sim){C.__sim=true;const items=[{deal_id:W.id,brand:W.brand,sales_owner_name:'황윤선',site_name:W.site,events:[{kind:'signed',effective_date:day(-80),amount_delta:82e6,event_id:'e1'}]}];C.state=()=>({status:'ready',items});C.entries=()=>items;}}catch(e){}
 try{Phase1.queue.flush=async()=>{};}catch(e){}
 try{navigator.clipboard.writeText=async()=>{S.calls.push('clipboard');};}catch(e){}
}
/* 누를 수 있는 것 모으기(보이는 것만) + 서명 */
function collect(rootSel){
 const R=document.querySelector(rootSel);if(!R)return [];
 const vis=n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return r.width>4&&r.height>4&&s.visibility!=='hidden'&&s.display!=='none'&&s.pointerEvents!=='none'&&!!n.offsetParent;};
 const els=[...R.querySelectorAll('button,[role="button"],[role="tab"],[role="row"][tabindex],a[href],summary,[onclick]')].filter(n=>!n.disabled&&n.getAttribute('aria-disabled')!=='true'&&vis(n)&&!n.closest('[hidden]'));
 const sig=n=>[n.tagName,(n.innerText||n.getAttribute('aria-label')||'').replace(/\s+/g,' ').trim().slice(0,36),String(n.className||'').replace(/\s+(on|sel|active|cur)\b/g,'').slice(0,48),Object.keys(n.dataset).sort().map(k=>k+'='+String(n.dataset[k]).slice(0,24)).join('&').slice(0,90)].join(' | ');
 const seen=new Map(),out=[];els.forEach(n=>{const s=sig(n),i=seen.get(s)||0;seen.set(s,i+1);if(i<2)out.push(s+' #'+i);});/* 같은 모양의 줄은 2개까지만 */
 return out;
}
async function clickOne(args){
 const [rootSel,target]=args,R=document.querySelector(rootSel);if(!R)return {missing:true};
 const vis=n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return r.width>4&&r.height>4&&s.visibility!=='hidden'&&s.display!=='none'&&s.pointerEvents!=='none'&&!!n.offsetParent;};
 const els=[...R.querySelectorAll('button,[role="button"],[role="tab"],[role="row"][tabindex],a[href],summary,[onclick]')].filter(n=>!n.disabled&&n.getAttribute('aria-disabled')!=='true'&&vis(n)&&!n.closest('[hidden]'));
 const sig=n=>[n.tagName,(n.innerText||n.getAttribute('aria-label')||'').replace(/\s+/g,' ').trim().slice(0,36),String(n.className||'').replace(/\s+(on|sel|active|cur)\b/g,'').slice(0,48),Object.keys(n.dataset).sort().map(k=>k+'='+String(n.dataset[k]).slice(0,24)).join('&').slice(0,90)].join(' | ');
 const seen=new Map();let el=null;for(const n of els){const s=sig(n),i=seen.get(s)||0;seen.set(s,i+1);if(s+' #'+i===target){el=n;break;}}
 if(!el)return {missing:true};
 const S=window.__sim;S.alerts.length=0;S.toasts.length=0;S.calls.length=0;
 let muts=0;const mo=new MutationObserver(l=>{muts+=l.length;});mo.observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true});
 const f0=document.activeElement,p0=G.page,h0=location.hash,t0=document.title;
 /* 화면이 달라졌나: 보이는 글 + 켜짐 표시(선택 · 펼침 · 열림) 수 + 스크롤 위치 */
 const shot=()=>document.body.innerText+'|'+document.querySelectorAll('[aria-pressed="true"],[aria-selected="true"],[aria-expanded="true"],[aria-checked="true"],[open],.on,.sel,.active,.open').length+'|'+[...document.querySelectorAll('input,textarea,select')].map(n=>n.type==='checkbox'||n.type==='radio'?n.checked:n.value).join('\u0001')+'|'+Math.round(scrollY)+'|'+[...document.querySelectorAll('.main,.mbody,[class*="scroll"]')].map(n=>Math.round(n.scrollTop)).join(',');
 const s0=shot();
 if(el.tagName==='A'&&/^https?:/.test(el.getAttribute('href')||'')){mo.disconnect();return {muts:1,alerts:[],toasts:[],calls:1,focus:false,nav:true,ext:true};}
 try{el.click();}catch(e){mo.disconnect();return {threw:String(e&&e.message||e)};}
 await new Promise(r=>setTimeout(r,220));mo.disconnect();
 /* 창 · 겹침 화면이 열렸나(다음 누르기 전에 새로 불러와야 하나) */
 const overlay=[...document.querySelectorAll('#detailView.on,dialog[open],.modal.on,[role="dialog"],.xdv,#inq-inbox-dialog,#siteDrawer.on,#drawer.on,#repWindow,.dv3-cpanel:not([hidden])')].some(n=>{const r=n.getBoundingClientRect();return r.width>100&&r.height>100&&getComputedStyle(n).display!=='none'&&!document.querySelector(rootSel)?.contains(n)&&n!==document.querySelector(rootSel);});
 return {same:shot()===s0,overlay,muts,alerts:S.alerts.slice(),toasts:S.toasts.slice(),calls:S.calls.length,callNames:S.calls.slice(0,3),focus:document.activeElement!==f0,nav:G.page!==p0||location.hash!==h0||document.title!==t0};
}
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'?r.continue():r.abort()});
  const page=await ctx.newPage();let errs=[];page.on('pageerror',e=>errs.push(String(e.message).slice(0,200)));
  const url=`http://127.0.0.1:${srv.address().port}/crm.html`;
  const load=async()=>{await page.goto(url);await page.waitForFunction(()=>window.DealDetailV3&&window.PipelineListV2&&window.OpsStore&&window.SalesInsights&&window.CommonFilterBar);};
  await load();
  const pages=await page.evaluate(()=>[...document.querySelectorAll('.apage')].map(n=>n.id.replace(/^pg-/,'')).filter(Boolean));
  /* 화면 = 메뉴 화면 전부 + 자주 쓰는 창(영업건 상세 · 수주 상세 · 견적문의 상세 · 확장관리 창 · 고객 자산 창) */
  const C=[];
  pages.forEach(p=>C.push({name:'화면:'+p,root:'#pg-'+p,open:`(()=>{${p==='pipe'?"G.pipeStageBOff=false;PipelineWorkspace.open('all')":"goPage('"+p+"')"}})()`}));
  C.push({name:'창:영업건 상세(진행)',root:'#detailView',open:"drwDeal(JSON.stringify(B.deals[0]))"});
  C.push({name:'창:영업건 상세(수주)',root:'#detailView',open:"drwDeal(JSON.stringify(B.deals[1]))"});
  C.push({name:'창:견적문의 상세(배정됨)',root:'#inq-inbox-dialog',open:"goPage('inq');InquiryWorkbench.open(inqKey(B.inquiries[0]))"});
  C.push({name:'창:견적문의 상세(미배정)',root:'#inq-inbox-dialog',open:"goPage('inq');InquiryWorkbench.open(inqKey(B.inquiries[1]))"});
  C.push({name:'창:확장관리',root:'.xdv',open:"goPage('expansion');setTimeout(()=>{const r=[...document.querySelectorAll('#pg-expansion [role=row],#pg-expansion .plv-row,#pg-expansion .sb-row,#pg-expansion button')].find(n=>/마곡청구/.test(n.textContent));if(r)r.click();},200)"});
  C.push({name:'창:고객 자산',root:'.xdv',open:"goPage('sites');setTimeout(()=>{const r=[...document.querySelectorAll('#pg-sites [role=row],#pg-sites .plv-row,#pg-sites .sb-row,#pg-sites button')].find(n=>/오뚜기/.test(n.textContent));if(r)r.click();},200)"});
  const part=/^(\d+)\/(\d+)$/.exec(process.env.SIM_PART||'');/* 여러 개로 나눠 돌리기: SIM_PART=0/3 */
  const run=(only.length?C.filter(c=>only.some(o=>c.name.includes(o))):C).filter((c,i)=>!part||i%Number(part[2])===Number(part[1]));
  const report=[];let total=0;
  for(const c of run){
   const open=async()=>{await page.evaluate(seed,'admin');await page.evaluate(c.open).catch(()=>{});await page.waitForTimeout(c.root.startsWith('#pg-')?320:650);};
   let needReload=false;/* 창이 열리거나 화면이 바뀐 뒤에만 새로 불러온다(나머지는 자료만 다시 넣고 다시 연다) */
   await load();await open();
   let list=[];try{list=await page.evaluate(collect,c.root);}catch(e){}
   const rows=[];errs=[];
   for(const t of list){
    if(needReload){await load();needReload=false;}
    await open();errs=[];
    let r;try{r=await page.evaluate(clickOne,[c.root,t]);}catch(e){r={threw:String(e.message).slice(0,160)};}
    await page.waitForTimeout(60);
    const e2=errs.slice();total++;needReload=!!(r.nav||r.threw||e2.length||r.overlay||!c.root.startsWith('#pg-'));
    const warnAlert=(r.alerts||[]).concat(r.toasts||[]).filter(m=>/선택해 주세요|찾을 수 없|찾지 못|오류|실패|undefined|null|NaN|준비되지|연결되지/.test(m));
    const dead=!r.missing&&!r.threw&&(r.same||!r.muts)&&!r.calls&&!(r.alerts||[]).length&&!(r.toasts||[]).length&&!r.focus&&!r.nav&&!r.overlay&&!r.ext;
    const kind=e2.length||r.threw?'오류':warnAlert.length?'안내만':dead?'반응 없음':r.missing?'못 찾음':'';
    if(kind)rows.push({kind,target:t,detail:e2.length?e2[0]:r.threw||warnAlert[0]||''});
   }
   report.push({context:c.name,buttons:list.length,flagged:rows});
   console.log(c.name+' · 누른 것 '+list.length+' · 확인 필요 '+rows.filter(x=>x.kind!=='못 찾음').length);
   rows.filter(x=>x.kind!=='못 찾음').forEach(x=>console.log('   ['+x.kind+'] '+x.target.slice(0,110)+(x.detail?'  →  '+String(x.detail).slice(0,110):'')));
  }
  if(out)fs.writeFileSync(out,JSON.stringify(report,null,1));
  console.log('전체 누른 것 '+total+' · 확인 필요 '+report.reduce((s,r)=>s+r.flagged.filter(x=>x.kind!=='못 찾음').length,0));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
