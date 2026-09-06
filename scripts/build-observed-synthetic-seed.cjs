'use strict';
// Data-only fixture for the observed baseline. No network, DDL or legacy seed imports.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {dir,query,sections,canonicalDefinition,canonicalDefinitionSql,md5}=require('./crm-baseline-metadata.cjs');
const source=require('../sql/baseline/20260905/source-metadata.json').payload;
const REF='rprechiaglyjaydkmxsu',BATCH='crm-synthetic-20260905';
const kinds=['INTERNAL_REP','OTHER_REP','CONSULT','GYEONGNAM','ADMIN','ADMIN_MFA'];
const roles=['rep','rep','viewer','rep','admin','admin'];
const uid=(group,n)=>`f6090500-${String(group).padStart(4,'0')}-4000-8000-${String(n).padStart(12,'0')}`;
const accounts=kinds.map((kind,i)=>({kind,email:`crm-${kind.toLowerCase().replaceAll('_','-')}@example.invalid`,name:`TEST ${kind}`,source_role:roles[i],user_id:uid(1,i+1)}));
const lit=x=>"'"+String(x).replaceAll("'","''")+"'";
const ident=x=>'"'+x.replaceAll('"','""')+'"';
const allTables=source.relations.filter(r=>r.kind==='r').map(r=>r.name);
const order=['users','sites','organizations','contacts','inquiries','deals','contact_assignments','activities','next_actions'];
const stamp='2026-09-05T00:00:00+00:00';
function fullRow(table,values){
 const cols=source.columns.filter(c=>c.table===table);assert.ok(cols.length);
 for(const k of Object.keys(values))assert.ok(cols.some(c=>c.name===k),`Unknown ${table}.${k}`);
 return Object.fromEntries(cols.map(c=>{
  if(Object.hasOwn(values,c.name))return[c.name,values[c.name]];
  let v=null,d=c.default;
  if(d==='now()')v=stamp;
  else if(d==='true'||d==='false')v=d==='true';
  else if(d&&/^\d+$/.test(d))v=Number(d);
  else if(d&&/^'.*'::(text|jsonb)$/.test(d)){const text=d.slice(1,d.lastIndexOf("'"));v=d.endsWith('::jsonb')?JSON.parse(text):text;}
  else if(d)throw Error(`Explicit fixture value required for ${table}.${c.name}`);
  assert.ok(v!==null||!c.not_null,`Missing ${table}.${c.name}`);return[c.name,v];
 }));
}
function buildRows(mapping){
 assert.equal(mapping.project_ref,REF,'Staging ref only');assert.equal(mapping.accounts.length,6);
 const mapped=accounts.map(a=>{const m=mapping.accounts.find(m=>m.kind===a.kind);assert.equal(m?.email,a.email);assert.match(m.auth_uid,/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);return{...a,auth_uid:m.auth_uid};});
 assert.equal(new Set(mapped.map(a=>a.auth_uid)).size,6);
 const rows=Object.fromEntries(order.map(t=>[t,[]]));
 const add=(t,v)=>rows[t].push(fullRow(t,v));
 mapped.forEach(a=>add('users',{user_id:a.user_id,name:a.name,email:a.email,role:a.source_role,auth_uid:a.auth_uid}));
 // Shared Site A has opportunities owned by different reps; it must NOT imply shared access.
 ['A','B','CONSULT','GYEONGNAM','ADMIN'].forEach((label,i)=>{
  add('sites',{site_id:uid(2,i+1),site_name:`TEST 아파트 ${label}`,norm_name:`test-site-${label.toLowerCase()}`,address:`TEST 가상주소 ${label}`});
  add('organizations',{id:uid(3,i+1),name:`TEST 아파트 ${label}`,region:`TEST ${label}`,address:`TEST 가상주소 ${label}`,custom_fields:{synthetic_batch:BATCH}});
  add('contacts',{id:uid(4,i+1),organization_id:uid(3,i+1),name:`TEST 연락처 ${label}`,phone:`010-0000-${String(i+1).padStart(4,'0')}`,mobile:`010-0000-${String(i+1).padStart(4,'0')}`,emails:[`contact-${label.toLowerCase()}@example.invalid`],person_key:`${BATCH}-person-${label}`,current_site:`TEST 아파트 ${label}`,custom_fields:{synthetic_batch:BATCH}});
 });
 // 5 inquiry personas; MFA admin gets an Auth/CRM identity but no extra scope grant.
 mapped.slice(0,5).forEach((a,i)=>add('inquiries',{id:uid(5,i+1),brand:'TEST',site_id:uid(2,i+1),site_name:`TEST 아파트 ${['A','B','CONSULT','GYEONGNAM','ADMIN'][i]}`,address:`TEST 가상주소 ${i+1}`,contact_name:`TEST 문의연락처 ${i+1}`,phone:`010-0000-${String(i+1).padStart(4,'0')}`,assigned_to:a.user_id,assignee_name:a.name,status:'접수',received_at:stamp,assigned_at:stamp,raw:{synthetic_batch:BATCH,scenario:a.kind},sheet_row:900001+i,work_type:'TEST 공종'}));
 const dealCases=[{a:0,site:1,inq:1},{a:1,site:2,inq:2},{a:1,site:1,inq:null},{a:3,site:4,inq:4},{a:4,site:5,inq:5}];
 dealCases.forEach((c,i)=>{const a=mapped[c.a];add('deals',{id:uid(6,i+1),organization_id:uid(3,c.site),site_id:uid(2,c.site),contact_id:uid(4,c.site),owner_id:a.user_id,origin_inquiry_id:c.inq?uid(5,c.inq):null,assignee_name:a.name,assignee_email:a.email,brand:'TEST',list_name:`TEST Deal ${i+1}`,stage_code:'first_contact',stage_group:'open',amount:10000*(i+1),list_fields:{synthetic_batch:BATCH,scenario:a.kind},opened_at:stamp,stage_entered_at:stamp,next_action:'TEST 후속 확인',next_action_date:'2026-09-06'});
 if(!rows.contact_assignments.some(r=>r.person_key===`${BATCH}-person-${['A','B','CONSULT','GYEONGNAM','ADMIN'][c.site-1]}`))add('contact_assignments',{id:uid(7,i+1),person_key:`${BATCH}-person-${['A','B','CONSULT','GYEONGNAM','ADMIN'][c.site-1]}`,opportunity_id:uid(6,i+1),site_name:`TEST 아파트 ${['A','B','CONSULT','GYEONGNAM','ADMIN'][c.site-1]}`,office_phone:`010-0000-${String(c.site).padStart(4,'0')}`,started_at:'2026-09-05',reason:'TEST synthetic assignment'});
 add('activities',{id:uid(8,i+1),deal_id:uid(6,i+1),organization_id:uid(3,c.site),actor_email:a.email,actor_name:a.name,type:'TEST 활동',detail:{synthetic_batch:BATCH,note:`TEST 활동메모 ${i+1}`}});
 add('next_actions',{id:uid(9,i+1),deal_id:uid(6,i+1),title:`TEST 다음행동 ${i+1}`,due_at:'2026-09-06T00:00:00+00:00',assignee_name:a.name,source_activity_id:uid(8,i+1)});
 });
 add('next_actions',{id:uid(9,6),inquiry_id:uid(5,3),title:'TEST 상담 후속',due_at:'2026-09-06T00:00:00+00:00',assignee_name:mapped[2].name});
 return{rows,mapped};
}
const recordset=(t,rows)=>`jsonb_populate_recordset(NULL::public.${ident(t)},${lit(JSON.stringify(rows))}::jsonb)`;
function dataGuard(rows){return allTables.map(t=>{
 const expected=rows[t]||[];
 return expected.length?`IF EXISTS((SELECT to_jsonb(r) FROM public.${ident(t)} r EXCEPT ALL SELECT to_jsonb(e) FROM ${recordset(t,expected)} e) UNION ALL (SELECT to_jsonb(e) FROM ${recordset(t,expected)} e EXCEPT ALL SELECT to_jsonb(r) FROM public.${ident(t)} r)) THEN RAISE EXCEPTION 'Synthetic row drift: ${t}'; END IF;`:`IF EXISTS(SELECT 1 FROM public.${ident(t)}) THEN RAISE EXCEPTION 'Unexpected rows: ${t}'; END IF;`;
 }).join('\n');}
function schemaGuard(){
 const checks=sections.filter(k=>k!=='dependencies');
 const expected=Object.fromEntries(checks.map(k=>[k,source[k]]));
 expected.functions=source.functions.map(f=>({...f,definition:md5(canonicalDefinition(f.definition))}));
 const cap=query().replace('pg_get_functiondef(p.oid)',`md5(${canonicalDefinitionSql('pg_get_functiondef(p.oid)')})`).replace('SELECT payload,md5(payload::text) AS metadata_md5 FROM snap;','SELECT payload INTO actual FROM snap;');
 return`DO $schema_guard$ DECLARE actual jsonb; expected jsonb:=${lit(JSON.stringify(expected))}::jsonb; k text; f jsonb; BEGIN\n${cap}\nFOREACH k IN ARRAY ARRAY[${checks.map(lit)}] LOOP IF NOT ((actual->k) @> (expected->k) AND (expected->k) @> (actual->k)) THEN RAISE EXCEPTION 'Canonical schema drift: %',k; END IF; END LOOP;
 FOR f IN SELECT value FROM jsonb_array_elements(actual->'functions') LOOP IF f->'config' IS DISTINCT FROM (SELECT e->'config' FROM jsonb_array_elements(expected->'functions') e WHERE e->>'signature'=f->>'signature') THEN RAISE EXCEPTION 'Function config drift'; END IF; END LOOP; END $schema_guard$;`;
}
function build(mapping){
 const {rows,mapped}=buildRows(mapping);
 const approval=`DO $approval$ BEGIN IF current_setting('crm.synthetic_staging_ref',true) IS DISTINCT FROM '${REF}' OR current_setting('crm.synthetic_seed_approved',true) IS DISTINCT FROM 'yes' OR current_user<>'postgres' THEN RAISE EXCEPTION 'Staging seed approval/target required'; END IF; END $approval$;`;
 const start=`BEGIN; SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='60s'; SET LOCAL search_path=public,pg_catalog;\n${approval}\nLOCK TABLE ${allTables.map(t=>'public.'+ident(t))} IN ACCESS EXCLUSIVE MODE;\n${schemaGuard()}`;
 const authCheck=`DO $auth_check$ BEGIN IF (SELECT count(*) FROM auth.users)<>6 THEN RAISE EXCEPTION 'Expected exactly six synthetic Auth users'; END IF;\n${mapped.map(a=>`IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=${lit(a.auth_uid)}::uuid AND email=${lit(a.email)} AND email_confirmed_at IS NOT NULL) THEN RAISE EXCEPTION 'Auth mapping mismatch ${a.kind}'; END IF;`).join('\n')} END $auth_check$;`;
 const validation=`DO $data_check$ BEGIN\n${dataGuard(rows)}\nIF EXISTS(SELECT auth_uid FROM public.users GROUP BY auth_uid HAVING auth_uid IS NULL OR count(*)<>1) THEN RAISE EXCEPTION 'Auth UUID mapping invalid'; END IF; END $data_check$;`;
 const insert=order.map(t=>`INSERT INTO public.${ident(t)} SELECT * FROM ${recordset(t,rows[t])};`).join('\n');
 // One-shot, empty-data baseline only: never upsert/overwrite unfamiliar existing records.
 const apply=`-- ${BATCH}; STAGING ONLY; data only; no Auth SQL writes.\n${start}\n${authCheck}\nDO $empty$ BEGIN\n${dataGuard({})}\nEND $empty$;\n${insert}\n${validation}\nCOMMIT;`;
 const pk=t=>source.constraints.find(c=>c.table===t&&c.type==='p').definition.match(/\((\w+)\)/)[1];
 const deletes=[...order].reverse().map(t=>`DELETE FROM public.${ident(t)} WHERE ${ident(pk(t))} IN (${rows[t].map(r=>lit(r[pk(t)])+'::uuid')});`).join('\n');
 const rollback=`-- CRM seed rollback only; delete Auth accounts separately through supported Auth API/UI.\n${start}\n${authCheck}\n${validation}\n${deletes}\nDO $empty$ BEGIN\n${dataGuard({})}\nEND $empty$;\nCOMMIT;`;
 const diffs=allTables.map(t=>{
 const expected=rows[t]||[];
 const discrepancy=expected.length?`SELECT to_jsonb(r) FROM public.${ident(t)} r EXCEPT ALL SELECT to_jsonb(e) FROM ${recordset(t,expected)} e`:`SELECT to_jsonb(r) FROM public.${ident(t)} r`;
 const missing=expected.length?`SELECT to_jsonb(e) FROM ${recordset(t,expected)} e EXCEPT ALL SELECT to_jsonb(r) FROM public.${ident(t)} r`:'SELECT NULL::jsonb WHERE false';
 return `SELECT ${lit(t)} AS table_name,(SELECT count(*) FROM public.${ident(t)}) AS row_count,(SELECT count(*) FROM ((${discrepancy}) UNION ALL (${missing})) d) AS row_diff`;
 }).join('\nUNION ALL\n');
 const verify=`WITH checks AS (${diffs}) SELECT jsonb_build_object('tables',(SELECT jsonb_agg(to_jsonb(c) ORDER BY table_name) FROM checks c),'exact_fixture_diff',(SELECT sum(row_diff) FROM checks),'uuid_null',(SELECT count(*) FROM public.users WHERE auth_uid IS NULL),'uuid_duplicates',(SELECT count(*) FROM (SELECT auth_uid FROM public.users GROUP BY auth_uid HAVING count(*)>1) d),'auth_links',(SELECT count(*) FROM public.users u JOIN auth.users a ON a.id=u.auth_uid AND a.email=u.email),'deal_owner_links',(SELECT count(*) FROM public.deals d JOIN public.users u ON u.user_id=d.owner_id JOIN auth.users a ON a.id=u.auth_uid),'inquiry_owner_links',(SELECT count(*) FROM public.inquiries i JOIN public.users u ON u.user_id=i.assigned_to JOIN auth.users a ON a.id=u.auth_uid),'mappings',(SELECT jsonb_agg(jsonb_build_object('name',name,'user_id',user_id,'auth_uid',auth_uid,'role',role) ORDER BY name) FROM public.users),'mfa_factors',(SELECT count(*) FROM auth.mfa_factors)) AS seed_verification;`;
 return {apply,rollback,validation,verify,rows,mapped};
}
if(require.main===module){
 const mapping=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),b=build(mapping);
 const out=path.join(dir,'synthetic');fs.mkdirSync(out,{recursive:true});
 for(const [n,v] of [['seed.sql',b.apply],['seed-rollback.sql',b.rollback],['verify-seed.sql',b.verify]])fs.writeFileSync(path.join(out,n),v+'\n');
 fs.writeFileSync(path.join(out,'fixture.json'),JSON.stringify({project_ref:REF,batch:BATCH,accounts:b.mapped,rows:b.rows},null,2)+'\n');
 console.log(JSON.stringify({counts:Object.fromEntries(Object.entries(b.rows).map(([t,r])=>[t,r.length])),credentialsWritten:false}));
}
module.exports={REF,BATCH,accounts,uid,build,buildRows,dataGuard};
