'use strict';

// Offline-only compiler. It consumes a captured, validated post-apply catalog
// and emits review artifacts. It never connects to Supabase or executes SQL.
const crypto=require('node:crypto');
const catalogContract=require('./fixture-catalog.cjs');

const PROJECT_REF='rprechiaglyjaydkmxsu';
const FORBIDDEN_REF='ymfbmpnizxvqsamnczow';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RUN=/^stg-e2e-\d{8}t\d{6}z-[a-f0-9]{8}$/;
const q=value=>`'${String(value).replaceAll("'","''")}'`;
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const json=value=>q(JSON.stringify(value))+'::jsonb';
const arr=values=>`ARRAY[${values.map(q).join(',')}]::uuid[]`;

const requiredColumns={
 'public.inquiries':{id:'uuid',brand:'text',site_name:'text',address:'text',contact_name:'text',phone:'text',assignee_name:'text',status:'text',received_at:'timestamp with time zone',sheet_row:'integer',raw:'jsonb',created_at:'timestamp with time zone',site_id:'uuid',assigned_to:'uuid',assigned_at:'timestamp with time zone',updated_at:'timestamp with time zone'},
 'public.deals':{id:'uuid',relate_id:'text',organization_id:'uuid',contact_id:'uuid',brand:'text',list_name:'text',stage_code:'text',stage_group:'text',assignee_name:'text',assignee_email:'text',amount:'bigint',source:'text',next_action:'text',next_action_date:'date',list_fields:'jsonb',created_at:'timestamp with time zone',updated_at:'timestamp with time zone',site_id:'uuid',owner_id:'uuid',origin_inquiry_id:'uuid',lifecycle_status:'text',outcome:'text',stage_entered_at:'timestamp with time zone',version:'integer',primary_work:'text',work_items:'jsonb',work_scope_type:'text',work_summary:'text',stage_checklist:'jsonb',stage_contexts:'jsonb',won_amount:'bigint',completion_date:'date'},
 'crm_security.object_scope':{scope_id:'uuid',user_id:'uuid',deal_id:'uuid',inquiry_id:'uuid',can_write:'boolean',reviewed_by:'text',expires_at:'timestamp with time zone'},
 'crm_security.command_receipts':{actor_auth_uid:'uuid',request_id:'uuid',actor_user_id:'uuid',operation:'text',object_id:'uuid',expected_version:'integer',payload:'jsonb',ack:'jsonb',created_at:'timestamp with time zone'}
};
const selectorKinds={
 inquiry_id:'inquiry',deal_id:'deal',opportunity_id:'deal',source_deal_id:'deal',object_id:'both',target_id:'both'
};
const neverDelete=new Set(['public.users','public.sites','public.organizations','public.contacts','crm_security.access_review','storage.buckets','storage.objects']);

function deterministicUuid(runId,label){
 const h=sha(`${runId}:${label}`).slice(0,32).split('');
 h[12]='4';h[16]=((parseInt(h[16],16)&3)|8).toString(16);
 return `${h.slice(0,8).join('')}-${h.slice(8,12).join('')}-${h.slice(12,16).join('')}-${h.slice(16,20).join('')}-${h.slice(20).join('')}`;
}

function relationColumns(capture,relation){return (capture.columns||[]).filter(column=>column.relation===relation).sort((a,b)=>a.ordinal-b.ordinal);}
function assertCatalog(capture,{manifest,fixture,mutationPlan,manifestRaw,catalogRaw}){
 const failures=[];
 const verdict=catalogContract.validate(capture,{candidateRelations:manifest.candidate_inventory.relation_names,fixture});
 if(verdict.status!=='PASS')failures.push(...verdict.failures.map(x=>'catalog:'+x));
 if(manifest.project_ref!==PROJECT_REF||capture.project_ref!==PROJECT_REF)failures.push('target');
 if(manifest.files_sha256?.['staging-apply.sql']!==mutationPlan.sources?.candidate_apply_sha256)failures.push('mutation_plan_apply_hash');
 if(mutationPlan.sources?.candidate_manifest_sha256!==sha(manifestRaw))failures.push('mutation_plan_manifest_hash');
 if(mutationPlan.status!=='MUTATION_MATRIX_COMPLETE_FIXTURE_EXTENSION_PENDING_READONLY_PREFLIGHT')failures.push('mutation_plan_status');
 if(!catalogRaw||sha(catalogRaw)===sha('{}'))failures.push('captured_catalog_required');
 for(const [relation,columns] of Object.entries(requiredColumns)){
  const actual=new Map(relationColumns(capture,relation).map(column=>[column.name,column]));
  for(const [name,type] of Object.entries(columns))if(actual.get(name)?.type!==type)failures.push(`column:${relation}.${name}`);
  for(const column of actual.values())if(column.not_null&&!column.default&&!column.generated&&!column.identity&&!columns[column.name])failures.push(`unsupported_required_column:${relation}.${column.name}`);
 }
 const expectedConstraints=[
  ['public.inquiries','inquiries_pkey','p'],['public.inquiries','inquiries_assigned_to_fkey','f'],['public.inquiries','inquiries_site_id_fkey','f'],
  ['public.deals','deals_pkey','p'],['public.deals','deals_owner_id_fkey','f'],['public.deals','deals_site_id_fkey','f'],['public.deals','deals_origin_inquiry_id_fkey','f']
 ];
 for(const [relation,name,type] of expectedConstraints)if(!(capture.constraints||[]).some(x=>x.relation===relation&&x.name===name&&x.type===type))failures.push(`constraint:${relation}.${name}`);
 for(const relation of manifest.candidate_inventory.relation_names){
  const columns=relationColumns(capture,relation);
  if(!columns.some(column=>selectorKinds[column.name]))failures.push(`cleanup_selector:${relation}`);
 }
 const serialized=JSON.stringify({capture,manifest,mutationPlan});
 if(serialized.includes(FORBIDDEN_REF)||/https?:\/\/[^"\s]*n8n/i.test(serialized))failures.push('forbidden_target');
 if(/password|access[_-]?token|refresh[_-]?token|service[_-]?role[_-]?key|secret[_-]?key|database[_-]?url/i.test(serialized))failures.push('secret_field');
 if(failures.length)throw Error('DISPOSABLE_FIXTURE_CATALOG_REJECTED: '+[...new Set(failures)].join(','));
}

function countsFor(scenario){
 const mode=scenario.fixture_mode;
 let inquiries=/INQUIRY/.test(mode)||/PURGE/.test(mode)?1:0;
 let deals=/DEAL/.test(mode)||/STORAGE/.test(mode)?1:0;
 // A snapshot is an assertion style, not permission to mutate the canonical
 // synthetic row. Allocate an equivalent disposable row for every mutating
 // snapshot scenario so the generated plan can keep canonical_rows_mutated=false.
 if(mode==='CANONICAL_SNAPSHOT'){
  if(scenario.operations.some(operation=>operation.startsWith('inquiry_')))inquiries=1;
  else deals=1;
 }
 if(mode==='DEDICATED_DEAL_OR_INQUIRY_REQUIRED')deals=1;
 if(scenario.id==='mobile-inquiry-response-outcomes')inquiries=3;
 if(scenario.id==='inquiry-pipeline-promote-lineage'){inquiries=2;deals=1;}
 if(scenario.id==='technical-inquiry-transfer')deals=0;
 if(scenario.id==='mobile-today-outcomes'){inquiries=2;deals=3;}
 return {inquiries,deals};
}

function allocate(runId,mutationPlan){
 const entities=[],requests=[];
 for(const scenario of mutationPlan.scenarios){
  const {inquiries,deals}=countsFor(scenario);
  for(let i=0;i<inquiries;i++)entities.push({kind:'inquiry',scenario_id:scenario.id,index:i+1,id:deterministicUuid(runId,`${scenario.id}:inquiry:${i+1}`)});
  for(let i=0;i<deals;i++)entities.push({kind:'deal',scenario_id:scenario.id,index:i+1,id:deterministicUuid(runId,`${scenario.id}:deal:${i+1}`),stage_code:['pipeline-close-won-expansion','expansion-pool-update-note-context'].includes(scenario.id)?'completion':scenario.id==='pipeline-waiting-context'?'waiting':'first_contact'});
  // The executable casebook includes happy-path, replay, reuse-conflict and
  // authorization probes. Reserve enough deterministic request IDs for the
  // largest current scenario (all sixteen customer-support action keys).
  for(let i=0;i<Math.max(24,scenario.operations.length*4+4);i++)requests.push({scenario_id:scenario.id,index:i+1,id:deterministicUuid(runId,`${scenario.id}:request:${i+1}`)});
 }
 return {entities,requests};
}

function catalogGuard(capture,catalogSha){
 const targets=capture.target_relations;
 const expectedColumns=(capture.columns||[]).map(({relation,name,ordinal,type,not_null,identity,generated,default:defaultValue})=>({relation,name,ordinal,type,not_null,identity,generated,default:defaultValue}));
 const expectedConstraints=(capture.constraints||[]).map(({relation,name,type,definition,referenced_relation})=>({relation,name,type,definition,referenced_relation}));
 const values=targets.map(name=>{const [schema,relation]=name.split('.');return `(${q(schema)},${q(relation)})`;}).join(',');
 return `DO $catalog_guard$ DECLARE actual_columns jsonb; actual_constraints jsonb; BEGIN
 IF current_user<>'postgres' OR current_setting('crm.operational_disposable_fixture_ref',true) IS DISTINCT FROM '${PROJECT_REF}' THEN RAISE EXCEPTION 'fixture project/role guard failed';END IF;
 WITH wanted(schema_name,relation_name) AS (VALUES ${values})
 SELECT coalesce(jsonb_agg(jsonb_build_object('relation',w.schema_name||'.'||w.relation_name,'name',a.attname,'ordinal',a.attnum,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY w.schema_name,w.relation_name,a.attnum),'[]'::jsonb) INTO actual_columns
 FROM wanted w JOIN pg_namespace n ON n.nspname=w.schema_name JOIN pg_class r ON r.relnamespace=n.oid AND r.relname=w.relation_name JOIN pg_attribute a ON a.attrelid=r.oid AND a.attnum>0 AND NOT a.attisdropped LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum;
 IF actual_columns IS DISTINCT FROM ${json(expectedColumns)} THEN RAISE EXCEPTION 'fixture column catalog drift (${catalogSha})';END IF;
 WITH wanted(schema_name,relation_name) AS (VALUES ${values})
 SELECT coalesce(jsonb_agg(jsonb_build_object('relation',w.schema_name||'.'||w.relation_name,'name',c.conname,'type',c.contype,'definition',pg_get_constraintdef(c.oid,true),'referenced_relation',CASE WHEN c.confrelid=0 THEN NULL ELSE c.confrelid::regclass::text END) ORDER BY w.schema_name,w.relation_name,c.conname),'[]'::jsonb) INTO actual_constraints
 FROM wanted w JOIN pg_namespace n ON n.nspname=w.schema_name JOIN pg_class r ON r.relnamespace=n.oid AND r.relname=w.relation_name JOIN pg_constraint c ON c.conrelid=r.oid;
 IF actual_constraints IS DISTINCT FROM ${json(expectedConstraints)} THEN RAISE EXCEPTION 'fixture constraint catalog drift (${catalogSha})';END IF;
END $catalog_guard$;`;
}

function setupSql(capture,fixture,allocation,runId,catalogSha,manifest){
 const templateInquiry=fixture.rows.inquiries[0],templateDeal=fixture.rows.deals[0],allowedActors=fixture.accounts.filter(x=>x.kind!=='OTHER_REP');
 const inquiries=allocation.entities.filter(x=>x.kind==='inquiry'),deals=allocation.entities.filter(x=>x.kind==='deal');
 const lines=[
  '-- GENERATED REVIEW ARTIFACT. Explicit Staging approval is required before execution.',
  `-- catalog_sha256=${catalogSha} candidate_apply_sha256=${manifest.files_sha256['staging-apply.sql']} run_id=${runId}`,
  'BEGIN;',"SET LOCAL search_path=pg_catalog;","SET LOCAL lock_timeout='3s';","SET LOCAL statement_timeout='60s';",`SET LOCAL crm.operational_disposable_fixture_ref='${PROJECT_REF}';`,catalogGuard(capture,catalogSha)
 ];
 for(const item of inquiries){
 const n=allocation.entities.indexOf(item)+1,linked=deals.find(x=>x.scenario_id===item.scenario_id&&x.index===item.index);
  const brand=['inquiry-reclassify','technical-inquiry-transfer'].includes(item.scenario_id)?'기술자문':
   item.scenario_id==='inquiry-pipeline-promote-lineage'&&item.index===2?'POUR솔루션':'TEST';
 const status=item.scenario_id==='inquiry-pipeline-promote-lineage'?'견적서 발송 완료':'접수';
  const siteName=item.scenario_id==='inquiry-pipeline-promote-lineage'&&item.index===2?'E2E 문의 전환':`TEST E2E ${runId} ${n}`;
  lines.push(`INSERT INTO public.inquiries(id,brand,site_name,address,contact_name,phone,assignee_name,status,deal_id,received_at,sheet_row,raw,created_at,site_id,assigned_to,assigned_at,first_response_at,qualified_at,opportunity_id,updated_at,responded_at,next_action_date,close_reason)
SELECT '${item.id}',${q(brand)},${q(siteName)},address,'TEST E2E CONTACT',phone,${q(templateInquiry.assignee_name)},${q(status)},NULL,clock_timestamp(),${1900000000+n},coalesce(raw,'{}'::jsonb)||${json({fixture_run_id:runId,fixture_scenario:item.scenario_id,fixture_index:item.index})},clock_timestamp(),site_id,assigned_to,clock_timestamp(),NULL,NULL,NULL,clock_timestamp(),NULL,NULL,NULL FROM public.inquiries WHERE id='${templateInquiry.id}';`);
 }
 for(const item of deals){
  const n=allocation.entities.indexOf(item)+1,origin=inquiries.find(x=>x.scenario_id===item.scenario_id&&x.index===item.index),completion=item.stage_code==='completion';
  lines.push(`INSERT INTO public.deals(id,relate_id,organization_id,contact_id,brand,list_name,stage_code,stage_raw,stage_group,assignee_name,assignee_email,amount,source,next_action,next_action_date,list_fields,closed_at,created_at,updated_at,site_id,owner_id,origin_inquiry_id,lifecycle_status,outcome,wake_up_at,amount_unknown_reason,stage_entered_at,last_activity_at,last_customer_contact_at,opened_at,version,lost_kind,origin_channel,service_type,service_history,origin_business,current_business,business_history,primary_work,work_items,work_scope_type,work_summary,stage_checklist,stage_contexts,won_amount,completion_date)
SELECT '${item.id}',NULL,organization_id,contact_id,'TEST',${q(`TEST E2E ${runId} ${n}`)},${q(item.stage_code)},${q(item.stage_code)},${q(completion?'completion':'open')},assignee_name,assignee_email,10000,'inbound','TEST E2E followup',current_date+1,coalesce(list_fields,'{}'::jsonb)||${json({fixture_run_id:runId,fixture_scenario:item.scenario_id,fixture_index:item.index})},NULL,clock_timestamp(),clock_timestamp(),site_id,owner_id,${origin?q(origin.id):'NULL'},'active',NULL,NULL,NULL,clock_timestamp(),NULL,NULL,clock_timestamp(),1,NULL,'e2e',service_type,coalesce(service_history,'[]'::jsonb),origin_business,current_business,coalesce(business_history,'[]'::jsonb),'TEST E2E WORK','["TEST E2E WORK"]'::jsonb,'single','TEST E2E WORK','{}'::jsonb,${completion?`jsonb_build_object('completion',jsonb_build_object('fixture_run_id',${q(runId)}))`:`'{}'::jsonb`},NULL,NULL FROM public.deals WHERE id='${templateDeal.id}';`);
 }
 // OTHER_REP is intentionally left without fixture scope and is the stable
 // foreign-owner denial identity. Role-specific server guards still decide
 // whether each scoped INTERNAL_REP/CONSULT/GYEONGNAM/ADMIN actor may act.
 for(const actor of allowedActors)for(const item of allocation.entities){
  const deal=item.kind==='deal'?q(item.id):'NULL',inquiry=item.kind==='inquiry'?q(item.id):'NULL';
  lines.push(`INSERT INTO crm_security.object_scope(scope_id,user_id,deal_id,inquiry_id,can_write,reviewed_by,expires_at) VALUES('${deterministicUuid(runId,`scope:${actor.kind}:${item.id}`)}','${actor.user_id}',${deal},${inquiry},true,${q(`fixture:${runId}`)},clock_timestamp()+interval '24 hours');`);
 }
 lines.push(`DO $verify$ BEGIN IF (SELECT count(*) FROM public.inquiries WHERE raw->>'fixture_run_id'=${q(runId)})<>${inquiries.length} OR (SELECT count(*) FROM public.deals WHERE list_fields->>'fixture_run_id'=${q(runId)})<>${deals.length} THEN RAISE EXCEPTION 'fixture setup count mismatch';END IF;END $verify$;`,'COMMIT;','');
 return lines.join('\n');
}

function cleanupOrder(capture){
 const relations=capture.target_relations.filter(x=>!neverDelete.has(x));
 const edges=new Map(relations.map(x=>[x,new Set()]));
 for(const constraint of capture.constraints||[])if(constraint.type==='f'&&edges.has(constraint.relation)){
  let parent=constraint.referenced_relation;if(parent&&!parent.includes('.'))parent='public.'+parent;
  if(edges.has(parent)&&parent!==constraint.relation)edges.get(constraint.relation).add(parent);
 }
  const result=[],remaining=new Set(relations);
  while(remaining.size){
  const parents=new Set([...remaining].flatMap(child=>[...edges.get(child)].filter(parent=>remaining.has(parent))));
  const leaf=[...remaining].find(x=>!parents.has(x));
  if(!leaf){result.push(...[...remaining].sort());break;}
  result.push(leaf);remaining.delete(leaf);
 }
 return result;
}

function selector(capture,relation){
 const parts=[];
 for(const column of relationColumns(capture,relation)){
  const kind=selectorKinds[column.name];
  if(kind==='inquiry')parts.push(`${column.name}=ANY(SELECT id FROM pg_temp.crm_fixture_ids WHERE kind='inquiry')`);
  if(kind==='deal')parts.push(`${column.name}=ANY(SELECT id FROM pg_temp.crm_fixture_ids WHERE kind='deal')`);
  if(kind==='both')parts.push(`${column.name}=ANY(SELECT id FROM pg_temp.crm_fixture_ids)`);
 }
 if(relation==='public.inquiries')parts.push("id=ANY(SELECT id FROM pg_temp.crm_fixture_ids WHERE kind='inquiry')");
 if(relation==='public.deals')parts.push("id=ANY(SELECT id FROM pg_temp.crm_fixture_ids WHERE kind='deal')");
 return [...new Set(parts)];
}

function cleanupSql(capture,allocation,runId,catalogSha,manifest){
 const inquiryIds=allocation.entities.filter(x=>x.kind==='inquiry').map(x=>x.id),dealIds=allocation.entities.filter(x=>x.kind==='deal').map(x=>x.id),requestIds=allocation.requests.map(x=>x.id);
 const lines=['-- GENERATED DESTRUCTIVE FIXTURE-ONLY FINALIZER. Review captured evidence first.',`-- catalog_sha256=${catalogSha} candidate_apply_sha256=${manifest.files_sha256['staging-apply.sql']} run_id=${runId}`,'BEGIN;',"SET LOCAL search_path=pg_catalog;","SET LOCAL lock_timeout='3s';","SET LOCAL statement_timeout='60s';",`SET LOCAL crm.operational_disposable_fixture_ref='${PROJECT_REF}';`,catalogGuard(capture,catalogSha),'CREATE TEMP TABLE pg_temp.crm_fixture_ids(kind text NOT NULL,id uuid PRIMARY KEY) ON COMMIT DROP;'];
 for(const id of inquiryIds)lines.push(`INSERT INTO pg_temp.crm_fixture_ids VALUES('inquiry','${id}');`);
 for(const id of dealIds)lines.push(`INSERT INTO pg_temp.crm_fixture_ids VALUES('deal','${id}');`);
 lines.push(`INSERT INTO pg_temp.crm_fixture_ids(kind,id) SELECT 'deal',(ack->>'new_opportunity_id')::uuid FROM crm_security.command_receipts WHERE request_id=ANY(${arr(requestIds)}) AND ack->>'new_opportunity_id' IS NOT NULL ON CONFLICT DO NOTHING;`);
 lines.push(`DO $ownership$ BEGIN IF EXISTS(SELECT 1 FROM public.inquiries i JOIN pg_temp.crm_fixture_ids f ON f.kind='inquiry' AND f.id=i.id WHERE i.raw->>'fixture_run_id' IS DISTINCT FROM ${q(runId)}) OR EXISTS(SELECT 1 FROM public.deals d JOIN pg_temp.crm_fixture_ids f ON f.kind='deal' AND f.id=d.id WHERE d.list_fields->>'fixture_run_id' IS DISTINCT FROM ${q(runId)} AND NOT EXISTS(SELECT 1 FROM crm_security.command_receipts r WHERE r.request_id=ANY(${arr(requestIds)}) AND r.ack->>'new_opportunity_id'=d.id::text)) THEN RAISE EXCEPTION 'fixture ownership mismatch';END IF;END $ownership$;`);
 lines.push(`UPDATE public.inquiries SET deal_id=NULL,opportunity_id=NULL WHERE id=ANY(SELECT id FROM pg_temp.crm_fixture_ids WHERE kind='inquiry');`,`UPDATE public.deals SET origin_inquiry_id=NULL WHERE id=ANY(SELECT id FROM pg_temp.crm_fixture_ids WHERE kind='deal');`);
 for(const relation of cleanupOrder(capture)){
  if(relation==='crm_security.command_receipts'){lines.push(`DELETE FROM crm_security.command_receipts WHERE request_id=ANY(${arr(requestIds)}) OR object_id=ANY(SELECT id FROM pg_temp.crm_fixture_ids);`);continue;}
  const where=selector(capture,relation);if(where.length)lines.push(`DELETE FROM ${relation} WHERE ${where.join(' OR ')};`);
 }
 lines.push(`DO $verify$ BEGIN IF EXISTS(SELECT 1 FROM public.inquiries WHERE raw->>'fixture_run_id'=${q(runId)}) OR EXISTS(SELECT 1 FROM public.deals WHERE list_fields->>'fixture_run_id'=${q(runId)}) OR EXISTS(SELECT 1 FROM crm_security.object_scope WHERE reviewed_by=${q(`fixture:${runId}`)}) THEN RAISE EXCEPTION 'fixture cleanup incomplete';END IF;END $verify$;`,'COMMIT;','');
 return lines.join('\n');
}

function build({capture,catalogRaw,manifest,manifestRaw,fixture,mutationPlan,runId}){
 if(!RUN.test(runId||''))throw Error('run_id must match stg-e2e-YYYYMMDDtHHMMSSz-xxxxxxxx');
 assertCatalog(capture,{manifest,fixture,mutationPlan,manifestRaw,catalogRaw});
 const allocation=allocate(runId,mutationPlan),catalogSha=sha(catalogRaw),manifestSha=sha(manifestRaw);
 const storagePrefix=`crm-staging-e2e/${runId}/`;
 const plan={project_ref:PROJECT_REF,project_name:'netform-crm-staging',status:'GENERATED_NOT_APPROVED_NOT_RUN',run_id:runId,catalog_sha256:catalogSha,candidate_manifest_sha256:manifestSha,candidate_apply_sha256:manifest.files_sha256['staging-apply.sql'],fixture_counts:{inquiries:allocation.entities.filter(x=>x.kind==='inquiry').length,deals:allocation.entities.filter(x=>x.kind==='deal').length,requests:allocation.requests.length},entities:allocation.entities,requests:allocation.requests,canonical_rows_mutated:false,storage:{prefix:storagePrefix,cleanup_transport:'SUPABASE_STORAGE_API_ONLY',direct_storage_sql_forbidden:true},staging_ddl_dml_performed:false,production_accessed:false,n8n_accessed:false};
 return {plan,setup:setupSql(capture,fixture,allocation,runId,catalogSha,manifest),cleanup:cleanupSql(capture,allocation,runId,catalogSha,manifest),storage:{project_ref:PROJECT_REF,status:'NOT_RUN',run_id:runId,bucket:'crm-attachments',prefix:storagePrefix,procedure:['list objects under the exact run prefix','remove only the returned exact paths with the Supabase Storage API','list the prefix again and require zero objects'],direct_sql_delete:false,production_accessed:false,n8n_accessed:false}};
}

module.exports={PROJECT_REF,RUN,requiredColumns,deterministicUuid,relationColumns,assertCatalog,allocate,catalogGuard,cleanupOrder,selector,build};
