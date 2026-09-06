'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),build=require('./build.cjs');
function load(text,name){const m=new Module(name);m._compile(text,name+'.js');return m.exports;}
const uuid=n=>`f6090600-0115-4000-8000-${String(n).padStart(12,'0')}`,inq=uuid(1),deal=uuid(2),site=uuid(3);
function fixture(){
 const adapter=load(build.adapter(),'inq-pipe-ui-adapter'),overlay=load(build.overlay(),'inq-pipe-ui-overlay'),queued=[],listeners={};let seq=20;
 const inquiry={id:inq,status:'견적서 발송완료',assignee:'TEST INTERNAL_REP',site:'TEST 아파트',site_id:site,brand:'TEST',work:'TEST 공종'},deals=[];
 const root={OperationalAdapter:adapter,TOKEN:'jwt',ME:{id:'admin'},WRITE_Q:[],B:{inquiries:[inquiry],deals},DEALS:deals,console,
  crypto:{randomUUID:()=>uuid(++seq)},queueMicrotask,addEventListener:(n,f)=>listeners[n]=f,
  document:{getElementById:()=>null,querySelectorAll:()=>[]},inqKey:q=>q.id,inquirySalesOwner:q=>q.assignee,
  itemOwnerTeam:()=> 'head_office',isTechnicalInquiry:()=>false,splitSel:()=>inquiry,linkedDeal:q=>deals.find(d=>d.site===q.site)||null,
  autoPromote(q){const d=this.linkedDeal(q);if(d)this.pushWrite('transition',{opportunity_id:d.id,from:d.code,to:'sent',note:'견적 발송완료로 파이프라인 인계',origin_inquiry_id:q.id});else{const local={id:'local-1',site:q.site,code:'sent'};deals.push(local);this.pushWrite('opportunity_create',{name:q.site,work_name:q.work,brand:q.brand,owner:q.assignee,amount:null,stage_code:'sent',origin_inquiry_id:q.id,site_id:q.site_id,origin_source:'견적문의',client_ref:local.id,reason:'견적 발송완료로 파이프라인 인계',reason_source:'auto'});}},
  promoteToPipeline(){return this.autoPromote(inquiry);},
  Phase1:{read:async()=>({data:{deals:deals.map(d=>({...d,stage_code:d.code,version:d.version||4})),inquiries:[inquiry]}}),queue:{enqueue(op,id,version,payload,requestId){const c=adapter.normalize(op,id,version,payload),x={...c,payload:c.payload,request_id:requestId||uuid(++seq),status:'pending'};queued.push(x);return x;},list:()=>queued,flush:async()=>queued}}};
 const ui=overlay.install(root);return{root,inquiry,deals,queued,listeners,ui};
}
test('auto promotion injects only the compatibility discriminator and keeps external op',()=>{const x=fixture();x.root.autoPromote(x.inquiry);assert.equal(x.queued.length,1);assert.equal(x.queued[0].operation,'opportunity_create');assert.equal(x.queued[0].payload.intent,'inquiry_promote_create');assert.equal(x.queued[0].payload.inquiry_id,inq);assert.equal(x.queued[0].payload.promotion_mode,'auto');assert.equal(x.queued[0].payload.to,'sent');});
test('lineage-first linkedDeal beats same-site legacy fallback after refresh',()=>{const x=fixture(),wrong={id:uuid(8),site:'TEST 아파트',origin_inquiry_id:null},right={id:deal,site:'다른 표기',origin_inquiry_id:inq};x.deals.push(wrong,right);assert.equal(x.root.linkedDeal(x.inquiry),right);});
test('existing promotion uses current read version and ACK hydrates lineage without duplicate local Deal',()=>{const x=fixture(),d={id:deal,site:'TEST 아파트',code:'first_contact',version:4};x.deals.push(d);x.ui.versions.set(deal,4);x.root.promoteToPipeline();assert.equal(x.queued[0].operation,'transition');assert.equal(x.queued[0].expected_version,4);assert.equal(x.queued[0].payload.intent,'inquiry_promote_existing');x.queued[0].status='done';x.queued[0].ack={intent:'inquiry_promote_existing',inquiry_id:inq,opportunity_id:deal,site_id:site,owner_id:uuid(9),to_stage:'sent',version:5,inquiry_status:'견적서 발송완료',server_at:'2026-09-06T00:00:00Z'};x.listeners['phase1:queue']();assert.equal(d.origin_inquiry_id,inq);assert.equal(d.version,5);assert.equal(x.inquiry.opportunity_id,deal);});
