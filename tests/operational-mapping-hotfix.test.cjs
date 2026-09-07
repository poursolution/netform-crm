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
 assert.equal(bundle.inquiries[1].site,'견적문의 · 2026-09-07 · #c12345');
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

test('operational read starts without a blocking overlay and coalesces duplicate refreshes',()=>{
 const source=fs.readFileSync(path.join(__dirname,'..','operational-overlay.js'),'utf8');
 assert.match(source,/getElementById\('load'\);if\(el\)el\.style\.display='none'/);
 assert.match(source,/if\(operationalLoadDataJob\)return operationalLoadDataJob/);
 assert.match(source,/if\(operationalLiveLoadJob\)return operationalLiveLoadJob/);
 const hide=source.indexOf("getElementById('load')",source.indexOf('root.loadData=function'));
 const read=source.indexOf('operationalLoadData.apply',hide);
 assert.ok(hide>=0&&read>hide,'blocking overlay must be dismissed before the operational read');
});

test('authenticated PC boot keeps the post-auth recovery load',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','crm.html'),'utf8');
 assert.match(html,/Promise\.resolve\(AUTH_READY\)[\s\S]*?if\(AUTH_ON&&!TOKEN\)return;\s*loadData\(\);/);
});

test('concurrent PC refreshes perform one operational read and one render',async()=>{
 let release,reads=0,renders=0;
 const gate=new Promise(resolve=>{release=resolve});
 const root={TOKEN:'token',ME:{id:'user'},Phase1:{read:async()=>{reads++;await gate;return {data:{deals:[],inquiries:[],expansion_pool:[]}}},queue:{list:()=>[],flush:async()=>[]}},OperationalAdapter:{},addEventListener(){},document:{getElementById:()=>({style:{}})},applyBundle(){renders++;}};
 overlay.install(root);
 const first=root.loadData(),second=root.loadData();
 assert.strictEqual(first,second);
 release();await Promise.all([first,second]);
 assert.equal(reads,1);assert.equal(renders,1);
});
