'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const overlay=require('../operational-overlay.js');

test('operational shell restores legacy deal and inquiry field aliases',()=>{
 const bundle=overlay.shell({
  deals:[{id:'d1',stage_code:'sent',stage_raw:'자료 발송',brand:'A',current_business:'B',origin_business:'C',amount:10,quote_amount:8,activity_signals:[{id:'a1',type:'전화',occurred_at:'2026-09-07T00:00:00Z'}]}],
  inquiries:[{id:'i1',site_name:'테스트 현장',contact_name:'담당자',assignee_name:'황윤선',assigned_to:'00000000-0000-4000-8000-000000000001',received_at:'2026-09-07T01:00:00Z',work_type:'옥상'}],
  user_directory:[{id:'u1',name:'황윤선'}],rep_manager_comments:[{id:'u1:2026-09-07'}]
 });
 const d=bundle.deals[0],q=bundle.inquiries[0];
 assert.equal(d.grp,'컨설팅·견적');
 assert.equal(d.currentBusiness,'B');
 assert.equal(d.originBusiness,'C');
 assert.equal(d.activities[0].at,'2026-09-07T00:00:00Z');
 assert.equal(q.site,'테스트 현장');
 assert.equal(q.contact,'담당자');
 assert.equal(q.assignee,'황윤선');
 assert.equal(q.at,'2026-09-07T01:00:00Z');
 assert.equal(q.work,'옥상');
 assert.equal(bundle.sales_people[0].name,'황윤선');
 assert.equal(bundle.repManagerComments.length,1);
});

test('operational shell standardizes supported site labels without inventing a region',()=>{
 const bundle=overlay.shell({
  deals:[{id:'d1',site_name:'현진에버빌아파트',site_address:'서울특별시 마포구 월드컵로 1',stage_code:'sent'}],
  inquiries:[
   {id:'i1',message:'■ 현장 · 공장 : 도장 공장\n■ 문의내용 : 기술자문',received_at:'2026-09-07T01:00:00Z'},
   {id:'abc12345',received_at:'2026-09-07T01:00:00Z'}
  ]
 });
 assert.equal(bundle.deals[0].site,'[서울 마포] 현진에버빌아파트');
 assert.equal(bundle.inquiries[0].site,'도장 공장');
 assert.equal(bundle.inquiries[1].site,'문의내용 미분류 · 2026-09-07 · #c12345');
 assert.doesNotMatch(bundle.inquiries[1].site,/현장명 미입력/);
 assert.equal(overlay.shell({deals:[{id:'d2',site_address:'서울특별시 마포구 월드컵로 1',stage_code:'sent'}]}).deals[0].site,'영업기회 · d2');
});

test('PC inquiry linking rejects empty-site joins and prefers explicit ids',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','crm.html'),'utf8');
 assert.match(html,/if\(byId\)return byId;/);
 assert.match(html,/if\(!k\)return null;/);
 assert.match(html,/q\.assignee_name\|\|q\.sales_assignee/);
});

test('nearby visit suggestions stay inside the current salesperson ownership',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','crm.html'),'utf8');
 assert.match(html,/repN\(d\.assignee\)===owner/);
 assert.match(html,/내 담당 현장만/);
});

test('journey uses the seven existing business sections with a distinct current-state card',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','crm.html'),'utf8');
 assert.match(html,/FLOW_STEPS=\['견적문의 접수','응대·현장파악','견적서 발송','영업·관계관리','경쟁·입찰','계약·시공','수주·실주·종료'\]/);
 assert.match(html,/journey-current/);
 assert.match(html,/class="jstep[^\n]+jstep-no/);
 assert.match(html,/\.jstep\.now\{[^}]+linear-gradient/);
});

test('customer asset opportunities show enough identity to distinguish similar rows',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','crm.html'),'utf8');
 assert.match(html,/공사명 · 공종 · 등록일 · ID로 구분/);
 assert.match(html,/class="opp-name"/);
 assert.match(html,/String\(d\.id\|\|''\)\.slice\(-6\)/);
});

test('pipeline to customer assets avoids repeated full relationship assembly',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','crm.html'),'utf8');
 assert.match(html,/SITE_MASTER_DATA_CACHE/);
 assert.match(html,/scheduleSiteMasterWarmup\(\)/);
 assert.match(html,/if\(!hidePeriod\)paintPeriod\(\);if\(!hideRep\)paintRepTabs\(\)/);
 assert.match(html,/content-visibility:auto;contain-intrinsic-size:auto 72px/);
});

test('quote inbox has a focused refresh safety net when realtime delivery is unavailable',()=>{
 const pc=fs.readFileSync(path.join(__dirname,'..','crm.html'),'utf8');
 const mobile=fs.readFileSync(path.join(__dirname,'..','mobile.html'),'utf8');
 assert.match(pc,/INQUIRY_SYNC_MS=15000/);
 assert.doesNotMatch(pc,/syncInquiryNow\(force\)[\s\S]{0,240}\['today','dash','inq'\]/);
 assert.match(pc,/refreshOperationalDomains\(\['inquiry_core'\],'inquiry-poll'\)/);
 assert.match(mobile,/INQUIRY_SYNC_MS=30000/);
 assert.match(mobile,/refreshOperationalDomains\(\['inquiry_core'\],'inquiry-poll'\)/);
 assert.match(fs.readFileSync(path.join(__dirname,'..','operational-overlay.js'),'utf8'),/reason==='realtime'\|\|reason==='inquiry-poll'/);
 assert.match(pc,/visibilitychange[^\n]+syncInquiryNow\(false\)/);
 assert.match(pc,/addEventListener\('focus'[^\n]+syncInquiryNow\(false\)/);
 assert.doesNotMatch(pc,/addEventListener\('focus'[^\n]+syncInquiryNow\(true\)/);
 assert.match(pc,/function refreshPageAfterPaint\(p\)[\s\S]{0,420}syncInquiryNow\(false\)/);
 assert.doesNotMatch(pc,/function (?:nav|goPage)\([^\n]+syncInquiryNow\(true\)/);
 assert.match(fs.readFileSync(path.join(__dirname,'..','operational-overlay.js'),'utf8'),/root\.applyBundle\(bundle\);root\.LAST_INQUIRY_SYNC=Date\.now\(\);readState\('핵심 데이터 최신'/);
});

test('quote inbox reuses expensive status decisions during one paint',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','crm.html'),'utf8');
 assert.match(html,/var INQ_CTL_BUCKET_CACHE=null;/);
 assert.match(html,/INQ_CTL_BUCKET_CACHE=new Map\(\);/);
 assert.match(html,/INQ_CTL_BUCKET_CACHE&&INQ_CTL_BUCKET_CACHE\.get\(key\)/);
 assert.match(html,/INQ_CTL_BUCKET_CACHE\.set\(key,bucket\)/);
 assert.match(html,/inqCtlRows\(active,trash,tech\)/);
 assert.match(html,/inqCtlConsole\(Q,c\)/);
});

test('quote inbox renders only one 50-row page and defers offscreen layout',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','crm.html'),'utf8');
 assert.match(html,/\.inq-ctl-row:not\(\.head\)\{content-visibility:auto;contain-intrinsic-size:auto 58px\}/);
 assert.match(html,/pageSize=50/);
 assert.match(html,/L\.slice\(\(page-1\)\*pageSize,page\*pageSize\)/);
 assert.match(html,/class="inq-ctl-pager"/);
 assert.match(html,/function inqCtlPage\(page\)\{G\.inqPage=page;paint\(\)\}/);
});

test('today manager intervention identifies inquiries with actionable context',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','crm.html'),'utf8');
 assert.match(html,/function todayPriorityMeta\(x\)/);
 assert.match(html,/문의내용 미분류/);
 assert.match(html,/연락처 미확인/);
 assert.match(html,/todayPriorityMeta\(x\)/);
});

test('unchanged realtime refreshes do not repaint the whole CRM',()=>{
 const source=fs.readFileSync(path.join(__dirname,'..','operational-overlay.js'),'utf8');
 assert.match(source,/function domainRevision\(rows\)/);
 assert.match(source,/if\(!changed\.length\)/);
 assert.match(source,/applyBundle\(bundle,changed\)/);
});

test('message campaign history and analysis can be filtered by year',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','crm.html'),'utf8');
 assert.match(html,/campaignYear:'전체'/);
 assert.match(html,/function campaignYearTabs\(\)/);
 assert.match(html,/\['전체',String\(cy\),String\(cy-1\),String\(cy-2\),'이전'\]/);
 assert.match(html,/campaignLogs\(\)\.filter\(campaignYearMatch\)/);
 assert.match(html,/function refreshPageAfterPaint\(p\)[\s\S]{0,220}loadOperationalPageData\(p\)/);
});

test('message campaign recipient selection supports all customers and rolling year filters',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','crm.html'),'utf8');
 assert.match(html,/campaignCategory:'all'/);
 assert.match(html,/campaignTargetYear:'전체'/);
 assert.match(html,/function campaignTargetYearMatch\(d\)/);
 assert.match(html,/고객연도<select/);
 assert.match(html,/campaignSetFilter[^\n]+campaignTargetYear/);
 assert.match(html,/필터가 변경되어 발송 대상을 다시 선택해 주세요/);
});

test('salesperson bottleneck stage clicks preserve owner and exact pipeline filters',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','crm.html'),'utf8');
 assert.match(html,/function repFlowGoStage\(i,codes,label\)[^\n]+dashboardGoRepStages\(r\.nm,codes,label\)/);
 assert.match(html,/function dashboardGoRepStages\(nm,codes,label\)\{G\.rep=nm;dashboardGoStages\(codes,label,true\)\}/);
 assert.match(html,/G\.splitCol=PD_COLS\.map[^\n]+findIndex[^\n]+G\.quickStageCodes\.every/);
 assert.match(html,/issueBase=issueBase\.filter\(function\(d\)\{return G\.quickStageCodes\.indexOf\(dealStage\(d\)\)>=0\}\)/);
 assert.match(html,/선택 단계<\/span><button class="pfc on">[^\n]+G\.reportStageLabel/);
 assert.match(html,/G\.quickStageCodes=null;G\.reportStageLabel=\\'\\'/);
});

test('operational read starts without a blocking overlay and coalesces duplicate refreshes',()=>{
 const source=fs.readFileSync(path.join(__dirname,'..','operational-overlay.js'),'utf8');
 assert.match(source,/getElementById\('load'\);if\(el\)el\.style\.display='none'/);
 assert.match(source,/if\(operationalLoadDataJob\)return operationalLoadDataJob/);
 assert.match(source,/if\(operationalLoadLiveJob\)return operationalLoadLiveJob/);
 assert.match(source,/domains\.every\(x=>coreDomains\.includes\(x\)\)/);
 assert.doesNotMatch(source,/SUBSCRIBED[^\n]+scheduleRealtime\('opportunities'\)/);
 const hide=source.indexOf("getElementById('load')",source.indexOf('root.loadData=function'));
 const read=source.indexOf('operationalLoadData.apply',hide);
 assert.ok(hide>=0&&read>hide,'blocking overlay must be dismissed before the operational read');
});

test('authenticated PC boot keeps the post-auth recovery load',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','crm.html'),'utf8');
 assert.match(html,/Promise\.resolve\(AUTH_READY\)[\s\S]*?if\(AUTH_ON&&!TOKEN\)return;\s*loadData\(\);/);
});

test('concurrent PC refreshes share one progressive load job',async()=>{
 let release,reads=0,renders=0;
 const gate=new Promise(resolve=>{release=resolve});
 const root={TOKEN:'token',ME:{id:'user'},Phase1:{read:async(resource,args)=>{reads++;await gate;return {data:args.domains.includes('deal_core')?{deals:[],inquiries:[]}:{expansion_pool:[],customer_support_actions:[],message_logs:[]}}},queue:{list:()=>[],flush:async()=>[]}},OperationalAdapter:{},addEventListener(){},document:{getElementById:()=>({style:{},classList:{toggle(){}}})},applyBundle(){renders++;}};
 overlay.install(root);
 const first=root.loadData(),second=root.loadData(),focusPoll=root.refreshOperationalDomains(['inquiry_core'],'inquiry-poll');
 assert.strictEqual(first,second);
 assert.strictEqual(first,focusPoll);
 release();await Promise.all([first,second,focusPoll]);
 assert.equal(reads,1);assert.equal(renders,1);
});

test('reload paints snapshot, then fresh core without downloading all history',async()=>{
 let reads=0,stored='',painted=[];
 const cached={contract_version:2,generated_at:'2026-09-07T00:00:00Z',deals:[{id:'cached'}],inquiries:[]};
 const elements={load:{style:{}},live:{textContent:'',classList:{toggle(){}}},err:{textContent:'',style:{}}};
 const root={TOKEN:'token',ME:{id:'user'},B:null,console,Phase1:{config:{project_ref:'rprechiaglyjaydkmxsu'},sessionCache:{getItem:()=>JSON.stringify(cached),setItem:(k,v)=>{stored=v},removeItem(){}},read:async(resource,args)=>{reads++;assert.deepEqual(args.domains,['deal_core','inquiry_core']);return {data:{deals:[{id:'fresh'}],inquiries:[]}}},queue:{list:()=>[],flush:async()=>[]}},OperationalAdapter:{},addEventListener(){},document:{getElementById:id=>elements[id]||null},applyBundle(bundle){this.B=bundle;painted.push(bundle.deals[0].id)}};
 overlay.install(root);
 await root.loadData();
 assert.deepEqual(painted,['cached','fresh']);
 assert.equal(elements.live.textContent,'핵심 데이터 최신');
 assert.equal(reads,1);
 assert.ok(Number.isFinite(root.LAST_INQUIRY_SYNC));
 assert.match(stored,/fresh/);
});

test('operational transport supports an allowlisted domain subset for progressive paint',()=>{
 const source=fs.readFileSync(path.join(__dirname,'..','transport.js'),'utf8');
 assert.match(source,/args\.domains===undefined\?knownDomains:args\.domains/);
 assert.match(source,/INVALID_READ_DOMAINS/);
 assert.match(source,/complete_for_requested_domains/);
 assert.match(source,/firstPageLimit/);
 assert.match(source,/onPage\(\{domain,items:items\.slice\(\),has_more:p\.has_more&&!capped\}\)/);
 assert.match(source,/recent_window_for_requested_domains/);
 assert.match(fs.readFileSync(path.join(__dirname,'..','operational-overlay.js'),'utf8'),/firstPageLimit:100/);
});

test('fresh PC paints the first core page before full core pagination completes',async()=>{
 let releaseCore,painted=[];
 const coreGate=new Promise(resolve=>{releaseCore=resolve});
 const root={TOKEN:'token',ME:{id:'user'},B:null,Phase1:{read:async(resource,args)=>{if(args.domains.includes('deal_core')){args.onPage({domain:'deal_core',items:[{id:'deal-first'}],has_more:true});args.onPage({domain:'inquiry_core',items:[{id:'inquiry-first'}],has_more:true});await coreGate;return {data:{deals:[{id:'deal-first'},{id:'deal-last'}],inquiries:[{id:'inquiry-first'}]}};}return {data:{expansion_pool:[],customer_support_actions:[],message_logs:[]}}},queue:{list:()=>[],flush:async()=>[]}},OperationalAdapter:{},addEventListener(){},document:{getElementById:()=>null},applyBundle(bundle){this.B=bundle;painted.push(bundle.deals.length)}};
 overlay.install(root);
 const loading=root.loadData();
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(painted,[1]);
 releaseCore();await loading;
 assert.deepEqual(painted,[1,2]);
});

test('mobile renders core without downloading secondary history',async()=>{
 let renders=0,reads=0;
 const root={TOKEN:'token',CUR:'today',Phase1:{read:async(resource,args)=>{reads++;args.onPage({domain:'deal_core',items:[{id:'deal-1',site_name:'빠른 현장',stage_code:'consulting',amount:100}],has_more:false});args.onPage({domain:'inquiry_core',items:[],has_more:false});return {data:{deals:[{id:'deal-1',site_name:'빠른 현장',stage_code:'consulting',amount:100}],inquiries:[]}}},queue:{list:()=>[],flush:async()=>[]}},OperationalAdapter:{},normalizeDeal:d=>d,rebuildAdmin(){},render(){renders++},addEventListener(){},document:{getElementById:()=>null}};
 overlay.install(root);
 await root.loadLive();
 assert.equal(reads,1);
 assert.equal(renders,2);
 assert.equal(root.DEALS[0].nm,'빠른 현장');
});

test('view snapshot is session-only and identity scoped',()=>{
 const source=fs.readFileSync(path.join(__dirname,'..','transport.js'),'utf8');
 assert.match(source,/nativeSession\.setItem\(key,JSON\.stringify/);
 assert.match(source,/base\+activeUid\+'\:view\:'/);
 assert.doesNotMatch(source,/nativeLocal\.setItem\(key,JSON\.stringify\(\{version:VERSION,auth_uid:activeUid,at:Date\.now\(\),value:String\(v\)\}\)\);\},removeItem\(k\)\{const key=sessionKey/);
});

test('realtime is constrained to Supabase signals and refreshes only the changed domain',()=>{
 const transport=fs.readFileSync(path.join(__dirname,'..','transport.js'),'utf8');
 const source=fs.readFileSync(path.join(__dirname,'..','operational-overlay.js'),'utf8');
 assert.match(transport,/u\.hostname!==REF\+'\.supabase\.co'\|\|u\.pathname!=='\/realtime\/v1\/websocket'/);
 assert.match(transport,/client\.channel=\(\)=>\{const inert=/);
 assert.match(transport,/subscribe\(resource,onSignal,onStatus\)/);
 assert.match(transport,/Object\.freeze\(\{table,event_type:eventType\|\|'\*'\}\)/);
 assert.match(source,/table==='inquiries'\?'inquiry_core':String\(table\|\|''\)\.indexOf\('crm_expansion_'\)===0\?'expansion_pool':'deal_core'/);
 assert.match(transport,/crm_expansion_pool/);
 assert.match(transport,/crm_expansion_events/);
 assert.match(transport,/crm_expansion_quote_dispatches/);
 assert.match(source,/root\.refreshOperationalDomains\(domains,'realtime'\)/);
});

test('domain refresh preserves unrelated cached rows and marks a partial paint',async()=>{
 const painted=[];
 const root={TOKEN:'token',ME:{id:'user'},B:{contract_version:2,deals:[{id:'deal-old'}],inquiries:[{id:'inquiry-old'}],message_logs:[]},Phase1:{profile:null,read:async(resource,args)=>{assert.deepEqual(args.domains,['inquiry_core']);return {data:{inquiries:[{id:'inquiry-new',site_name:'새 문의'}]}}},queue:{list:()=>[],flush:async()=>[]}},OperationalAdapter:{},addEventListener(){},document:{getElementById:()=>null},applyBundle(bundle,domains){this.B=bundle;painted.push(domains)}};
 overlay.install(root);
 await root.refreshOperationalDomains(['inquiry_core'],'realtime');
 assert.deepEqual(root.B.deals.map(x=>x.id),['deal-old']);
 assert.deepEqual(root.B.inquiries.map(x=>x.id),['inquiry-new']);
 assert.deepEqual(painted,[['inquiry_core']]);
});

test('pipeline quick selection replaces only the detail panel',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','crm.html'),'utf8');
 assert.match(html,/id="pipeline-quick-panel"/);
 assert.match(html,/onclick="selectSplitDeal\(this\)"/);
 assert.match(html,/panel\.outerHTML=quickPanelHTML\(d\)/);
 assert.doesNotMatch(html,/onclick="G\.splitScroll=this\.parentElement\.scrollTop;G\.splitKey=this\.dataset\.k;G\.splitForm=null;paint\(\)"/);
});
