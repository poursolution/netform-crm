'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const personal=require('../../personal-state-compat/20260906/build.cjs'),cutover=require('../../operational-cutover-candidate/20260906/build.cjs'),response=require('../../inquiry-response-progress/20260906/build.cjs'),build=require('./build.cjs'),s=require('../../../scripts/crm-phase1.cjs');
const inq=n=>s.uid(5,n),deal=n=>s.uid(6,n),user=n=>s.uid(1,n),site=n=>s.uid(2,n),request=n=>`f6090600-0115-4000-8000-${String(n).padStart(12,'0')}`;
async function setup(){const db=await personal.setup();await db.exec(cutover.compose('apply',{localPersonalCandidate:true,skipResponse:true,skipInquiryPipeline:true}));await db.exec(response.applySql());await db.exec(build.applySql());return db;}
async function actor(db,index=4){await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[s.mapping.accounts[index].auth_uid]);await db.exec('SET ROLE authenticated');}
async function rpc(db,op,requestId,objectId,version,payload,index=4){await actor(db,index);try{return (await db.query('SELECT public.crm_write_command_v2($1,$2,$3,$4,$5) a',[requestId,op,objectId,version,JSON.stringify(payload)])).rows[0].a;}finally{await db.exec('RESET ROLE');}}
async function one(db,sql,params=[]){return (await db.query(sql,params)).rows[0];}

test('manual create promotion atomically creates one lineage Deal and one evidence set',async()=>{const db=await setup();try{
 await db.query('UPDATE public.deals SET origin_inquiry_id=NULL WHERE id=$1',[deal(5)]);await db.query("UPDATE public.inquiries SET assigned_to=$1,assignee_name='TEST INTERNAL_REP',status='견적서 발송완료',deal_id=NULL,opportunity_id=NULL WHERE id=$2",[user(1),inq(5)]);
 const p={intent:'inquiry_promote_create',inquiry_id:inq(5),promotion_mode:'manual',inquiry_status:'견적서 발송완료',owner:'TEST INTERNAL_REP',from:'',to:'sent',note:'견적 발송완료로 파이프라인 인계',amount:12000000,name:'TEST 아파트 ADMIN',work_name:'TEST 공종',brand:'TEST',site_id:site(5),client_ref:'local-promotion'};
 const a=await rpc(db,'opportunity_create',request(1),request(1),0,p);assert.equal(a.intent,'inquiry_promote_create');assert.equal(a.to_stage,'sent');assert.equal(a.version,1);
 assert.equal((await one(db,'SELECT count(*)::int n FROM public.deals WHERE origin_inquiry_id=$1',[inq(5)])).n,1);assert.equal((await one(db,'SELECT count(*)::int n FROM public.stage_history WHERE opportunity_id=$1 AND inquiry_id=$2',[a.opportunity_id,inq(5)])).n,1);assert.equal((await one(db,"SELECT count(*)::int n FROM public.activities WHERE deal_id=$1 AND type='파이프라인 인계'",[a.opportunity_id])).n,1);assert.equal((await one(db,"SELECT count(*)::int n FROM crm_security.inquiry_audit_events WHERE inquiry_id=$1 AND action='inquiry_pipeline_promote'",[inq(5)])).n,1);
 const replay=await rpc(db,'opportunity_create',request(1),request(1),0,p);assert.equal(replay.replayed,true);assert.equal(replay.opportunity_id,a.opportunity_id);assert.equal((await one(db,'SELECT count(*)::int n FROM public.deals WHERE origin_inquiry_id=$1',[inq(5)])).n,1);
 await assert.rejects(rpc(db,'opportunity_create',request(2),request(2),0,p),e=>e.code==='PT409');
 }finally{await db.close();}});

test('automatic existing promotion updates inquiry status, Deal stage and version once',async()=>{const db=await setup();try{
 await db.query("UPDATE public.deals SET owner_id=$1,assignee_name='TEST INTERNAL_REP',origin_inquiry_id=NULL,stage_code='first_contact',lifecycle_status='active',outcome=NULL,version=7 WHERE id=$2",[user(1),deal(5)]);await db.query("UPDATE public.inquiries SET assigned_to=$1,assignee_name='TEST INTERNAL_REP',status='배정완료',deal_id=NULL,opportunity_id=NULL WHERE id=$2",[user(1),inq(5)]);
 const p={intent:'inquiry_promote_existing',inquiry_id:inq(5),promotion_mode:'auto',inquiry_status:'견적서 발송예정',owner:'TEST INTERNAL_REP',opportunity_id:deal(5),from:'first_contact',to:'consulting',note:'견적 준비 단계로 파이프라인 인계',amount:33000000};
 const a=await rpc(db,'transition',request(10),deal(5),7,p);assert.equal(a.version,8);assert.equal(a.to_stage,'consulting');assert.equal((await one(db,'SELECT status FROM public.inquiries WHERE id=$1',[inq(5)])).status,'견적서 발송예정');assert.deepEqual(await one(db,'SELECT stage_code,version,origin_inquiry_id,amount FROM public.deals WHERE id=$1',[deal(5)]),{stage_code:'consulting',version:8,origin_inquiry_id:inq(5),amount:33000000});
 await assert.rejects(rpc(db,'transition',request(11),deal(5),7,p),e=>e.code==='PT409');
 }finally{await db.close();}});

test('malformed payload opportunity UUID is rejected as a controlled validation error',async()=>{const db=await setup();try{
 const p={intent:'inquiry_promote_existing',inquiry_id:inq(5),promotion_mode:'manual',inquiry_status:'견적서 발송예정',owner:'TEST INTERNAL_REP',opportunity_id:'not-a-uuid',from:'first_contact',to:'consulting',note:'견적 준비 단계로 파이프라인 인계'};
 await assert.rejects(rpc(db,'transition',request(12),deal(5),7,p),e=>e.code==='22023'&&/invalid opportunity id/.test(e.message));
 }finally{await db.close();}});

test('manual lineage requires same Site, admin scope, one-to-one lineage and replay safety',async()=>{const db=await setup();try{
 await db.query('UPDATE public.deals SET origin_inquiry_id=NULL,version=4 WHERE id=$1',[deal(5)]);await db.query('UPDATE public.inquiries SET deal_id=NULL,opportunity_id=NULL WHERE id=$1',[inq(5)]);
 const p={intent:'lineage_link',inquiry_id:inq(5)};const a=await rpc(db,'lineage_link',request(20),deal(5),4,p);assert.equal(a.version,5);assert.equal(a.changed,true);const replay=await rpc(db,'lineage_link',request(20),deal(5),4,p);assert.equal(replay.replayed,true);assert.equal((await one(db,'SELECT origin_inquiry_id FROM public.deals WHERE id=$1',[deal(5)])).origin_inquiry_id,inq(5));
 await db.query('UPDATE public.deals SET origin_inquiry_id=NULL,version=1 WHERE id=$1',[deal(3)]);await assert.rejects(rpc(db,'lineage_link',request(21),deal(3),1,p),e=>e.code==='PT409');await assert.rejects(rpc(db,'lineage_link',request(22),deal(5),5,p,0),e=>e.code==='42501');
 }finally{await db.close();}});

test('late audit failure rolls Deal, inquiry, history, activity and receipt back',async()=>{const db=await setup();try{
 await db.query("UPDATE public.deals SET owner_id=$1,assignee_name='TEST INTERNAL_REP',origin_inquiry_id=NULL,stage_code='first_contact',lifecycle_status='active',outcome=NULL,version=3 WHERE id=$2",[user(1),deal(5)]);await db.query("UPDATE public.inquiries SET assigned_to=$1,status='배정완료',deal_id=NULL,opportunity_id=NULL WHERE id=$2",[user(1),inq(5)]);const before=await one(db,'SELECT stage_code,version,origin_inquiry_id FROM public.deals WHERE id=$1',[deal(5)]);
 await db.exec("CREATE FUNCTION crm_security.reject_pipeline_audit() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.action='inquiry_pipeline_promote' THEN RAISE EXCEPTION 'injected pipeline audit failure';END IF;RETURN NEW;END$$; CREATE TRIGGER reject_pipeline_audit BEFORE INSERT ON crm_security.audit_events FOR EACH ROW EXECUTE FUNCTION crm_security.reject_pipeline_audit();");
 const p={intent:'inquiry_promote_existing',inquiry_id:inq(5),promotion_mode:'auto',inquiry_status:'견적서 발송예정',owner:'TEST INTERNAL_REP',opportunity_id:deal(5),from:'first_contact',to:'consulting',note:'견적 준비 단계로 파이프라인 인계'};await assert.rejects(rpc(db,'transition',request(30),deal(5),3,p),/injected pipeline audit failure/);assert.deepEqual(await one(db,'SELECT stage_code,version,origin_inquiry_id FROM public.deals WHERE id=$1',[deal(5)]),before);assert.equal((await one(db,'SELECT count(*)::int n FROM crm_security.command_receipts WHERE request_id=$1',[request(30)])).n,0);
 }finally{await db.close();}});
