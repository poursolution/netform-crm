'use strict';

// Offline compiler for the approved-Staging JWT mutation run. It accepts only
// the catalog-gated disposable fixture plan and produces concrete, ordered
// commands. It performs no network I/O.
const assert=require('node:assert/strict');
const adapter=require('./operational-adapter.candidate.js');

const REF='rprechiaglyjaydkmxsu';
const EXPECTED_SCENARIOS=35;
const DIRECT_OPERATION='expansion_note';
const SUPPORT_KEYS=['response_request','inquiry_review','call','message','recontact_result','waiting_context','manager_consult','waiting_review','material_support','meeting_check','contact_check','contact_activity','reactivate_review','dormant_review','recontact_schedule','support_detail'];
const UUID=/^[0-9a-f]{8}-[0-9a-f-]{27}$/i;

const isoDay=(base,days)=>{const parts=Object.fromEntries(new Intl.DateTimeFormat('en',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(base)).map(x=>[x.type,x.value]));return new Date(Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day)+days,12)).toISOString().slice(0,10);};
const isoAt=(base,minutes=0)=>new Date(new Date(base).getTime()+minutes*60000).toISOString();

function build(plan,fixture,{now='2026-09-06T12:00:00.000Z'}={}){
 assert.equal(plan.project_ref,REF);assert.equal(plan.status,'GENERATED_NOT_APPROVED_NOT_RUN');assert.equal(plan.canonical_rows_mutated,false);
 assert.match(plan.run_id,/^stg-e2e-/);assert.equal(fixture.project_ref,REF);
 const scenarios=new Map(),declared=require('../../../docs/operational-cutover-20260906/staging-mutation-e2e-plan.json').scenarios;
 assert.equal(declared.length,EXPECTED_SCENARIOS);
 const account=kind=>{const row=fixture.accounts.find(x=>x.kind===kind);assert.ok(row,`missing ${kind}`);return row;};
 const entity=(id,kind,index=1)=>{const row=plan.entities.find(x=>x.scenario_id===id&&x.kind===kind&&x.index===index);assert.ok(row,`${id}: disposable ${kind} ${index} missing`);return row.id;};
 const requests=id=>plan.requests.filter(x=>x.scenario_id===id).sort((a,b)=>a.index-b.index);
 const add=(id,steps)=>{assert.equal(scenarios.has(id),false,`duplicate scenario ${id}`);scenarios.set(id,{id,steps});};
 const command=(ctx,operation,object_id,expected_version,payload,actor='INTERNAL_REP',extra={})=>{
  const request=ctx.requests[ctx.requestIndex++];assert.ok(request,`${ctx.id}: request ids exhausted`);
  const placeholder='f6090500-0099-4000-8000-000000000001',sample=value=>typeof value==='string'&&value.startsWith('$ack.')?placeholder:Array.isArray(value)?value.map(sample):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,sample(v)])):value;
  adapter.normalize(operation,sample(object_id),expected_version,sample(payload));
  return {kind:'write',id:`${ctx.id}:${ctx.stepIndex++}`,actor,request_id:request.id,operation,object_id,expected_version,payload,replay:true,proof:['ack','refresh','receipt','audit'],...extra};
 };
 const direct=(ctx,rpc,args,actor='INTERNAL_REP',extra={})=>{const request=ctx.requests[ctx.requestIndex++];assert.ok(request);return {kind:'direct_rpc',id:`${ctx.id}:${ctx.stepIndex++}`,actor,rpc,args:{...args,request_id:request.id},request_id:request.id,replay:true,...extra};};
 const ref=(step,key)=>`$ack.${step}.${key}`;
 const ctx=id=>({id,requests:requests(id),requestIndex:0,stepIndex:1});
 const dealPayload=id=>({opportunity_id:id});
 const inquiryPayload=id=>({inquiry_id:id});
 const today=isoDay(now,0),future=isoDay(now,14),later=isoDay(now,21),at=isoAt(now);
 const rep=account('INTERNAL_REP').name,other=account('OTHER_REP').name;

 add('cross-cutting-receipt-replay',[{kind:'policy_assertion',id:'cross-cutting-receipt-replay:1',operations:[...adapter.operations,DIRECT_OPERATION],checks:['every successful mutation is replayed with the same request_id','a valid changed command with the same request_id returns 409','no duplicate receipt or domain evidence']}]);

 {const id='frozen-direct-assign-pc-mobile',c=ctx(id),q=entity(id,'inquiry');add(id,[command(c,'inquiry_assign',q,0,{...inquiryPayload(q),to:rep},'ADMIN'),command(c,'inquiry_assign',q,0,{...inquiryPayload(q),to:other,reason:'모바일 재배정 검증'},'ADMIN')]);}
 {const id='mobile-inquiry-response-outcomes',c=ctx(id),outcomes=[['진행됨 — 다음 잡음','전화응대 완료'],['다음주 다시','응대중'],['못 받으심 (내일 재시도)','배정완료']];add(id,outcomes.map(([response,status],i)=>command(c,'inquiry_assign',entity(id,'inquiry',i+1),0,{inquiry_id:entity(id,'inquiry',i+1),from:rep,to:rep,response,status},'INTERNAL_REP')));}
 {const id='pc-inquiry-progress',c=ctx(id),q=entity(id,'inquiry');add(id,[command(c,'inquiry_status',q,0,{...inquiryPayload(q),intent:'progress',from_status:'접수',target:'step:1',did:'전화 상담',result:'현장 조건 확인',next:'견적 준비',due:future})]);}
 {const id='frozen-inquiry-unassign',c=ctx(id),q=entity(id,'inquiry');add(id,[command(c,'inquiry_assign',q,0,{...inquiryPayload(q),to:rep},'ADMIN'),command(c,'inquiry_unassign',q,0,{...inquiryPayload(q),reason:'담당 권역 변경'},'ADMIN')]);}
 {const id='inquiry-hold',c=ctx(id),q=entity(id,'inquiry');add(id,[command(c,'inquiry_status',q,0,{...inquiryPayload(q),from_status:'접수',to_status:'보류',reason:'고객 일정 대기'},'ADMIN')]);}
 {const id='inquiry-next-complete-check',c=ctx(id),q=entity(id,'inquiry'),s1=command(c,'next_action',q,0,{...inquiryPayload(q),intent:'inquiry_next_set',type:'전화',text:'문의 후속 연락',due_at:future});add(id,[s1,command(c,'next_action_complete',q,0,{...inquiryPayload(q),intent:'inquiry_next_complete',action_id:ref(s1.id,'next_action_id')}),command(c,'stage_check',q,0,{...inquiryPayload(q),intent:'inquiry_check',item_index:0,item_text:'최초 연락 완료',checked:true})]);}
 {const id='inquiry-followup',c=ctx(id),q=entity(id,'inquiry');add(id,[command(c,'inquiry_followup',q,0,{...inquiryPayload(q),due_at:future,reason:'담당자 연기'})]);}
 {const id='inquiry-pipeline-promote-lineage',c=ctx(id),q1=entity(id,'inquiry',1),q2=entity(id,'inquiry',2),d=entity(id,'deal'),reason='견적 발송완료로 파이프라인 인계',s1=command(c,'transition',d,1,{intent:'inquiry_promote_existing',inquiry_id:q1,promotion_mode:'manual',inquiry_status:'견적서 발송 완료',owner:rep,from:'first_contact',to:'sent',note:reason,amount:0,opportunity_id:d},'ADMIN'),createId=c.requests[c.requestIndex].id,s2=command(c,'opportunity_create',createId,0,{intent:'inquiry_promote_create',inquiry_id:q2,promotion_mode:'manual',inquiry_status:'견적서 발송 완료',owner:rep,from:'',to:'sent',note:reason,amount:0,name:'E2E 문의 전환',work_name:'바닥 공사',brand:'POUR솔루션',client_ref:`e2e-${plan.run_id}`},'ADMIN');add(id,[s1,s2,command(c,'lineage_link',ref(s2.id,'new_opportunity_id'),1,{intent:'lineage_link',opportunity_id:ref(s2.id,'new_opportunity_id'),inquiry_id:q2},'ADMIN')]);}
 {const id='inquiry-trash-restore',c=ctx(id),q=entity(id,'inquiry');add(id,[command(c,'inquiry_trash',q,0,{...inquiryPayload(q),delete_reason:'테스트 문의',delete_note:'E2E 격리 행'} ,'ADMIN'),command(c,'inquiry_restore',q,0,{...inquiryPayload(q)},'ADMIN')]);}
 {const id='inquiry-purge',c=ctx(id),q=entity(id,'inquiry');add(id,[command(c,'inquiry_trash',q,0,{...inquiryPayload(q),delete_reason:'테스트 문의',delete_note:'purge 선행 격리'},'ADMIN'),command(c,'inquiry_purge',q,0,{...inquiryPayload(q)},'ADMIN_MFA',{irreversible_fixture_only:true})]);}
 {const id='inquiry-reclassify',c=ctx(id),q=entity(id,'inquiry');add(id,[command(c,'inquiry_reclassify',q,0,{...inquiryPayload(q),from_brand:'기술자문',to_brand:'POUR솔루션',review_status:'reclassified'},'ADMIN')]);}
 {const id='technical-inquiry-transfer',c=ctx(id),q=entity(id,'inquiry'),createId=c.requests[c.requestIndex].id;add(id,[command(c,'opportunity_create',createId,0,{intent:'technical_inquiry_transfer',inquiry_id:q,client_ref:`local-tech-${plan.run_id}`},'ADMIN')]);}
 add('frozen-inquiry-read-refresh',[{kind:'read',id:'frozen-inquiry-read-refresh:1',actor:'INTERNAL_REP',rpc:'crm_read_scoped_v2',args:{p_limit:100},assert:'frozen inquiry projection and history remain visible'}]);
 {const id='pipeline-opportunity-create',c=ctx(id),createId=c.requests[c.requestIndex].id;add(id,[command(c,'opportunity_create',createId,0,{surface:'pc',name:'E2E 신규 기회',work_name:'옥상 방수',work_type:'방수',primary_work:'방수',work_items:['방수'],work_scope_type:'single',work_summary:'방수',brand:'POUR솔루션',owner:rep,amount:1000000,address:'테스트 주소',reason:'실제 문의 확인 후 생성',reason_source:'manual',office_phone:'025551234',manager_name:'테스트 관리소장',manager_mobile:'01012345678',manager_role:'관리소장',person_key:'mobile:01012345678',client_ref:`pc-${plan.run_id}`})]);}
 {const id='pipeline-stage-transition',c=ctx(id),d=entity(id,'deal'),context={from:'first_contact',to:'consulting',transition_date:today,skip_reason:'',memo:'E2E 진행',fields:{quote_request:'견적 산출 요청',required_materials:'도면',quote_due:future}};add(id,[command(c,'transition',d,1,{...dealPayload(d),from:'first_contact',to:'consulting',stage_code:'first_contact',transition_date:today,note:'E2E 상담 전환',stage_context:context})]);}
 {const id='pipeline-close-nonwon',c=ctx(id),d=entity(id,'deal');add(id,[command(c,'close',d,1,{...dealPayload(d),outcome:'lost',reason:'고객 예산 무산 · 고객 예산과 제안 금액 차이',reason_source:'structured',stage_code:'first_contact',closed_at:at})]);}
 {const id='pipeline-close-won-expansion',c=ctx(id),d=entity(id,'deal'),fields={completion_date:today,completion_checks:['공사 완료','준공검사 완료'],contract_amount:5000000};add(id,[command(c,'close',d,1,{...dealPayload(d),from:'completion',to:'won',stage_code:'completion',outcome:'won',transition_date:today,note:'E2E 수주 완료',won_amount:5000000,contract_amount:5000000,completion_date:today,stage_context:{from:'completion',to:'won',transition_date:today,terminal:true,memo:'',fields}})]);}
 {const id='pipeline-expected-amount',c=ctx(id),d=entity(id,'deal');add(id,[command(c,'amount',d,1,{...dealPayload(d),amount:2500000,quote_amount:null,won_amount:null})]);}
 {const id='frozen-opportunity-work',c=ctx(id),d=entity(id,'deal');add(id,[command(c,'opportunity_work_set',d,1,{...dealPayload(d),primary_work:'방수',work_items:['방수','도장'],reason:'E2E 공종 호환 검증'})]);}
 {const id='frozen-service-change',c=ctx(id),d=entity(id,'deal');add(id,[command(c,'service_change',d,1,{...dealPayload(d),to_service:'기술자문',reason:'계약 형태 변경 확정',reason_source:'text',next_action:'기술자문 계약서 작성',next_due:future})]);}
 {const id='pipeline-activity-and-contact',c=ctx(id),d=entity(id,'deal');add(id,[command(c,'activity',d,1,{...dealPayload(d),intent:'standalone',type:'전화',note:'고객 통화',result:'현장 일정 확인',occurred_at:at,meaningful_contact:true})]);}
 {const id='deal-next-action-lifecycle',c=ctx(id),d=entity(id,'deal'),s1=command(c,'next_action',d,1,{...dealPayload(d),intent:'standalone',type:'전화',text:'고객 후속 연락',due_at:future});add(id,[s1,command(c,'next_action_complete',d,2,{...dealPayload(d),action_id:ref(s1.id,'next_action_id')})]);}
 {const id='mobile-today-outcomes',c=ctx(id),steps=[];['progress','next_week','missed'].forEach((outcome,i)=>{const d=entity(id,'deal',i+1),set=command(c,'next_action',d,1,{...dealPayload(d),intent:'standalone',type:'전화',text:'오늘 연락',due_at:isoDay(now,1)});steps.push(set,command(c,'next_action_complete',d,2,{...dealPayload(d),intent:'today_outcome',action_id:ref(set.id,'next_action_id'),outcome}));});add(id,steps);}
 {const id='pipeline-waiting-context',c=ctx(id),d=entity(id,'deal');add(id,[command(c,'waiting_context',d,1,{...dealPayload(d),waiting_reason:'예산 승인 대기',waiting_speaker:'관리소장',waiting_customer_statement:'입주자대표회의 이후 결정',wake_up_at:future,waiting_evidence:'회의 일정 확인',expected_resume_at:future}),command(c,'next_action',d,2,{...dealPayload(d),intent:'standalone',type:'전화',text:'회의 결과 확인',due_at:future})]);}
 {const id='pipeline-quote-version',c=ctx(id),d=entity(id,'deal');add(id,[command(c,'quote_version',d,1,{...dealPayload(d),amount:3300000,reason:'수량 변경 반영'})]);}
 {const id='pipeline-stage-check',c=ctx(id),d=entity(id,'deal');add(id,[command(c,'stage_check',d,1,{...dealPayload(d),stage_code:'first_contact',item_index:1,item_text:'공사 예정시기 확인',checked:true})]);}
 add('customer-and-operational-reads',[{kind:'read',id:'customer-and-operational-reads:1',actor:'INTERNAL_REP',rpc:'crm_operational_source_v1',args:{p_domain:'deal_core',p_after:null,p_limit:100},assert:'actor-scoped customer/deal source remains paged and duplicate-free'}]);
 {const id='expansion-pool-update-note-context',c=ctx(id),d=entity(id,'deal'),fields={completion_date:today,completion_checks:['공사 완료','준공검사 완료'],contract_amount:5000000},won=command(c,'close',d,1,{...dealPayload(d),from:'completion',to:'won',stage_code:'completion',outcome:'won',transition_date:today,note:'확장 Pool 선행 수주',won_amount:5000000,contract_amount:5000000,completion_date:today,stage_context:{from:'completion',to:'won',transition_date:today,terminal:true,memo:'',fields}}),update=command(c,'expansion_pool_update',d,1,{...dealPayload(d),source_opportunity_id:d,expansion_status:'접촉 예정',next_contact_at:later,relationship_state:'기존고객',created_opportunity_id:null,updated_at:at});add(id,[won,update,direct(c,'crm_expansion_note',{source_opportunity_id:d,note:'추가 공종 니즈 확인'}),{kind:'direct_rpc',id:`${id}:context`,actor:'INTERNAL_REP',rpc:'crm_expansion_context',args:{source_opportunity_id:d},assert:'note appears exactly once'}]);}
 {const id='attachment-lifecycle',c=ctx(id),d=entity(id,'deal'),prepare=command(c,'attachment_prepare',d,0,{...dealPayload(d),file_name:'e2e.pdf',mime_type:'application/pdf',size_bytes:16,category:'기타',tags:['e2e'],memo:'격리 첨부'});add(id,[prepare,{kind:'storage_put',id:`${id}:put`,actor:'INTERNAL_REP',bucket:'crm-site-files',object_path:ref(prepare.id,'object_path'),content_type:'application/pdf',body:'0123456789abcdef'},command(c,'attachment_complete',d,0,{...dealPayload(d),attachment_id:ref(prepare.id,'attachment_id')})]);}
 {const id='personalization',c=ctx(id),d=entity(id,'deal');add(id,[command(c,'favorite_set',d,0,{...dealPayload(d),favorite:true}),command(c,'opportunity_touch',d,0,{...dealPayload(d),touch_kind:'view'})]);}
 {const id='message-log',c=ctx(id),d=entity(id,'deal');add(id,[command(c,'message_log',d,1,{...dealPayload(d),channel:'sms',template_key:'e2e',template_title:'E2E 안내',template_kind:'info',purpose:'일정 안내',body:'테스트 메시지',message_context:'deal',attachment_refs:[],status:'sent',next_action_requested:false})]);}
 {const id='message-reminder',c=ctx(id),d=entity(id,'deal'),scheduled=isoAt(now,60*24*14);add(id,[command(c,'next_action',d,1,{...dealPayload(d),intent:'message_reminder',type:'메시지발송',text:'안내 메시지 발송',due_at:isoDay(scheduled,0),scheduled_at:scheduled,channel:'sms',template_key:'e2e-reminder',draft_body:'예약 메시지'})]);}
 {const id='relationship-cadence',c=ctx(id),d=entity(id,'deal'),responseAt=isoAt(now,1),hold=command(c,'relationship_hold',d,1,{...dealPayload(d),hold_until:future,reason:'고객 요청',next_action_type:'전화',next_action_text:'보류 종료 후 연락',next_due_at:future}),message=command(c,'message_log',d,2,{...dealPayload(d),channel:'sms',template_key:'e2e-cadence',template_title:'E2E 보류 안내',template_kind:'info',purpose:'보류 후속',body:'테스트 보류 메시지',message_context:'deal',attachment_refs:[],status:'sent',next_action_requested:false});add(id,[hold,message,command(c,'relationship_response',d,3,{...dealPayload(d),response_at:responseAt,response_kind:'문자',cancel_pending_cadence:true,activity_type:'문자',activity_note:'고객 회신',activity_result:'상담 재개',activity_occurred_at:responseAt})]);}
 {const id='customer-support-request',c=ctx(id),d=entity(id,'deal');add(id,SUPPORT_KEYS.map((key,i)=>command(c,'customer_support_action',d,0,{client_ref:`support-${String(1700000000000+i)}-abcde`,target_type:'deal',target_key:`deal:${d}`,opportunity_id:d,inquiry_id:null,site_name:'E2E 현장',rep_name:rep,action_key:key,action_label:`지원 ${key}`,reason:'운영 지원 요청',completion_rule:'담당자가 별도 완료 확인',status:'requested'},'ADMIN')));}

 const built=declared.map(row=>{const value=scenarios.get(row.id);assert.ok(value,`missing casebook scenario ${row.id}`);return {...value,domain:row.domain,coverage_ids:row.coverage_ids,declared_operations:row.operations};});
 assert.equal(scenarios.size,EXPECTED_SCENARIOS);
 const covered=new Set(built.flatMap(x=>x.steps.flatMap(step=>step.kind==='write'?[step.operation]:step.rpc==='crm_expansion_note'?[DIRECT_OPERATION]:[])));
 for(const operation of [...adapter.operations,DIRECT_OPERATION])assert.ok(covered.has(operation),`operation lacks executable step: ${operation}`);
 return {project_ref:REF,run_id:plan.run_id,status:'COMPILED_NOT_RUN',candidate_manifest_sha256:plan.candidate_manifest_sha256,candidate_apply_sha256:plan.candidate_apply_sha256,catalog_sha256:plan.catalog_sha256,scenario_count:built.length,operation_count:covered.size,scenarios:built,production_accessed:false,n8n_accessed:false,staging_ddl_dml_performed:false};
}

function resolve(value,acks){
 if(Array.isArray(value))return value.map(x=>resolve(x,acks));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,resolve(v,acks)]));
 if(typeof value!=='string'||!value.startsWith('$ack.'))return value;
 const path=value.slice(5).split('.'),step=path.shift();let out=acks[step];for(const key of path)out=out?.[key];assert.notEqual(out,undefined,`unresolved ${value}`);return out;
}

function validateResolvedStep(step,acks,identities){
 const value=resolve(step,acks);
 if(value.kind==='write'){
  const command={...adapter.normalize(value.operation,value.object_id,value.expected_version,value.payload),request_id:value.request_id,auth_uid:identities[value.actor].auth_uid,user_id:identities[value.actor].user_id};
  assert.match(command.request_id,UUID);return command;
 }
 return value;
}

module.exports={REF,EXPECTED_SCENARIOS,DIRECT_OPERATION,SUPPORT_KEYS,build,resolve,validateResolvedStep};
