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

test('PC inquiry linking rejects empty-site joins and prefers explicit ids',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','crm.html'),'utf8');
 assert.match(html,/if\(byId\)return byId;/);
 assert.match(html,/if\(!k\)return null;/);
 assert.match(html,/q\.assignee_name\|\|q\.sales_assignee/);
});
