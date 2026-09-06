'use strict';

const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

const root=path.resolve(__dirname,'..');
const dir=path.join(root,'sql','inquiry-read-compat','20260906');
const snapshotPath=path.join(root,'sql','inquiry-direct-assign','20260906','after.json');
const projectRef='rprechiaglyjaydkmxsu';
const signature='public.crm_read_scoped_v2(uuid,integer,uuid,uuid)';
const requiredColumns={
 inquiries:{id:'uuid',brand:'text',site_name:'text',address:'text',contact_name:'text',phone:'text',assignee_name:'text',status:'text',deal_id:'uuid',received_at:'timestamp with time zone',sheet_row:'integer',raw:'jsonb',created_at:'timestamp with time zone',site_id:'uuid',source_channel:'text',assigned_to:'uuid',assigned_at:'timestamp with time zone',first_response_at:'timestamp with time zone',opportunity_id:'uuid',channel:'text',work_type:'text',responded_at:'timestamp with time zone',next_action_date:'date',close_reason:'text'},
 assignment_history:{id:'uuid',inquiry_id:'uuid',from_owner:'text',to_owner:'text',reason:'text',actor_name:'text',changed_at:'timestamp with time zone'},
 users:{user_id:'uuid',name:'text'}
};

function md5(value){return crypto.createHash('md5').update(value).digest('hex')}
function sha256(value){return crypto.createHash('sha256').update(value).digest('hex')}
function sqlLiteral(value){return "'"+String(value).replaceAll("'","''")+"'"}
function loadSnapshot(){return JSON.parse(fs.readFileSync(snapshotPath,'utf8'))}
function functionFrom(snapshot){const fn=snapshot.public.functions.find(x=>x.signature===signature);if(!fn)throw Error(signature+' missing from Staging snapshot');return fn}
function validateSnapshot(snapshot){
 for(const [table,columns] of Object.entries(requiredColumns))for(const [name,type] of Object.entries(columns)){
  const actual=snapshot.public.columns.find(x=>x.table===table&&x.name===name);
  if(!actual)throw Error(`Staging snapshot missing ${table}.${name}`);
  if(actual.type!==type)throw Error(`Staging snapshot type drift ${table}.${name}: ${actual.type} != ${type}`);
 }
 const fn=functionFrom(snapshot);
 if(fn.owner!=='postgres'||!fn.security_definer||!Array.isArray(fn.acl)||!fn.acl.includes('authenticated=X/postgres')||fn.acl.some(x=>/^anon=/.test(x)))throw Error('crm_read_scoped_v2 owner/ACL/security drift');
 for(const invariant of ['crm_security.can_deal(d.id,false)','crm_security.can_inquiry(i.id)','d.work_scope_type','d.work_summary'])if(!fn.definition.includes(invariant))throw Error('current read invariant missing: '+invariant);
 return fn;
}

function definition(){return `CREATE OR REPLACE FUNCTION public.crm_read_scoped_v2(p_after uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 100, p_deal_id uuid DEFAULT NULL::uuid, p_inquiry_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM crm_security.actor()) OR (p_deal_id IS NOT NULL AND NOT crm_security.can_deal(p_deal_id,false))
 OR (p_inquiry_id IS NOT NULL AND NOT crm_security.can_inquiry(p_inquiry_id)) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>100 THEN RAISE EXCEPTION 'invalid limit' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('contract_version',2,
 'deals',coalesce((SELECT jsonb_agg(to_jsonb(q) ORDER BY q.id) FROM(
 SELECT d.id,d.site_id,d.owner_id,d.stage_code,d.brand,d.primary_work,d.work_items,d.work_scope_type,d.work_summary,d.version FROM public.deals d
 WHERE crm_security.can_deal(d.id,false) AND (p_after IS NULL OR d.id>p_after) AND (p_deal_id IS NULL OR d.id=p_deal_id) ORDER BY d.id LIMIT p_limit) q),'[]'::jsonb),
 'inquiries',coalesce((SELECT jsonb_agg(to_jsonb(q) ORDER BY q.id) FROM(
 SELECT i.id,
  i.sheet_row, i.sheet_row AS "row",
  i.brand,
  i.site_name, i.site_name AS site,
  i.address,
  i.contact_name, i.contact_name AS contact,
  i.phone,
  coalesce(u.name,i.assignee_name) AS assignee_name,
  coalesce(u.name,i.assignee_name) AS assignee,
  i.assigned_to,
  i.status,
  i.deal_id, i.opportunity_id,
  i.received_at, i.created_at, coalesce(i.received_at,i.created_at) AS at,
  i.site_id,
  i.source_channel,
  i.channel,
  i.work_type, i.work_type AS work,
  i.assigned_at,
  i.first_response_at,
  i.responded_at,
  i.next_action_date, i.next_action_date AS due,
  jsonb_build_object(
   'customerType',i.raw->>'고객유형',
   'buildingType',i.raw->>'건물유형',
   'address',coalesce(nullif(i.raw->>'건물주소',''),i.address),
   'complex',i.raw->>'단지개요',
   'workType',coalesce(nullif(i.raw->>'공사유형',''),i.work_type),
   'inquiry',i.raw->>'문의내용',
   'channel',coalesce(nullif(i.raw->>'상담채널',''),i.channel),
   'inflow',coalesce(nullif(i.raw->>'유입경로',''),i.source_channel),
   'office',i.raw->>'관리사무소',
   'note',i.raw->>'특이사항',
   'assignComment',i.raw->>'배정 코멘트',
   'closeReason',coalesce(nullif(i.raw->>'종료사유',''),i.close_reason)
  ) AS detail,
  coalesce(h.items,'[]'::jsonb) AS assignment_history
 FROM public.inquiries i
 LEFT JOIN public.users u ON u.user_id=i.assigned_to
 LEFT JOIN LATERAL (
  SELECT jsonb_agg(jsonb_build_object(
   'id',ah.id,
   'inquiry_id',ah.inquiry_id,
   'from_owner',ah.from_owner,'from',ah.from_owner,
   'to_owner',ah.to_owner,'to',ah.to_owner,
   'reason',ah.reason,
   'actor_name',ah.actor_name,'actor',ah.actor_name,'changed_by',ah.actor_name,
   'changed_at',ah.changed_at,'at',ah.changed_at
  ) ORDER BY ah.changed_at,ah.id) AS items
  FROM public.assignment_history ah WHERE ah.inquiry_id=i.id
 ) h ON true
 WHERE crm_security.can_inquiry(i.id)
 AND (p_after IS NULL OR i.id>p_after) AND (p_inquiry_id IS NULL OR i.id=p_inquiry_id) ORDER BY i.id LIMIT p_limit) q),'[]'::jsonb));
END $function$`}

function aclText(fn){return '{'+fn.acl.join(',')+'}'}
function candidate(snapshot){
 const current=validateSnapshot(snapshot),fn=definition();
 return `-- Local candidate only. Do not run against Production.
SET crm.inquiry_read_ref='${projectRef}';
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $preflight$ DECLARE p record; BEGIN
 IF current_user<>'postgres' OR current_setting('crm.inquiry_read_ref',true) IS DISTINCT FROM '${projectRef}' THEN RAISE EXCEPTION 'Staging inquiry read approval required'; END IF;
 SELECT * INTO p FROM pg_proc WHERE oid='public.crm_read_scoped_v2(uuid,integer,uuid,uuid)'::regprocedure;
 IF pg_get_userbyid(p.proowner)<>'postgres' OR NOT p.prosecdef OR coalesce(p.proacl::text,'')<>${sqlLiteral(aclText(current))}
  OR md5(pg_get_functiondef(p.oid))<>${sqlLiteral(md5(current.definition))}
 THEN RAISE EXCEPTION 'crm_read_scoped_v2 drift'; END IF;
END $preflight$;
${fn};
DO $postflight$ DECLARE p record; body text; BEGIN
 SELECT *,pg_get_functiondef(oid) AS body INTO p FROM pg_proc WHERE oid='public.crm_read_scoped_v2(uuid,integer,uuid,uuid)'::regprocedure;
 body:=p.body;
 IF pg_get_userbyid(p.proowner)<>'postgres' OR NOT p.prosecdef OR coalesce(p.proacl::text,'')<>${sqlLiteral(aclText(current))}
  OR position('crm_security.can_inquiry(i.id)' in body)=0 OR position('crm_security.can_deal(d.id,false)' in body)=0
  OR position('d.work_scope_type' in body)=0 OR position('d.work_summary' in body)=0
  OR position('parse_responses' in body)>0
 THEN RAISE EXCEPTION 'inquiry read compatibility postflight failed'; END IF;
END $postflight$;
COMMIT;
`;
}

function rollback(snapshot,candidateCanonical){
 const current=validateSnapshot(snapshot);
 return `-- Restore the exact pre-candidate scoped read definition. Staging only.
SET crm.inquiry_read_ref='${projectRef}';
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $preflight$ DECLARE p record; BEGIN
 IF current_user<>'postgres' OR current_setting('crm.inquiry_read_ref',true) IS DISTINCT FROM '${projectRef}' THEN RAISE EXCEPTION 'Staging inquiry read rollback approval required'; END IF;
 SELECT * INTO p FROM pg_proc WHERE oid='public.crm_read_scoped_v2(uuid,integer,uuid,uuid)'::regprocedure;
 IF pg_get_userbyid(p.proowner)<>'postgres' OR NOT p.prosecdef OR coalesce(p.proacl::text,'')<>${sqlLiteral(aclText(current))}
  OR md5(pg_get_functiondef(p.oid))<>${sqlLiteral(md5(candidateCanonical))}
 THEN RAISE EXCEPTION 'inquiry read rollback drift'; END IF;
END $preflight$;
${current.definition};
DO $postflight$ DECLARE p record; BEGIN
 SELECT * INTO p FROM pg_proc WHERE oid='public.crm_read_scoped_v2(uuid,integer,uuid,uuid)'::regprocedure;
 IF md5(pg_get_functiondef(p.oid))<>${sqlLiteral(md5(current.definition))} OR pg_get_userbyid(p.proowner)<>'postgres'
  OR coalesce(p.proacl::text,'')<>${sqlLiteral(aclText(current))} THEN RAISE EXCEPTION 'inquiry read rollback verification failed'; END IF;
END $postflight$;
COMMIT;
`;
}

function sourceEvidence(){
 const sources={pc:fs.readFileSync(path.join(root,'crm.html'),'utf8'),mobile:fs.readFileSync(path.join(root,'mobile.html'),'utf8')};
 const checks=[
  ['PC inquiry identity/site/status','pc',"function inqKey(q){return String(q.id||q.row||[q.site,q.at].join('|'))}"],
  ['PC assignment/response timestamps','pc',"function inquiryRespondedAt(q){return q.first_activity||q.firstActivity||q.responded_at||q.respondedAt||(q.detail&&q.detail.responded_at)||''}"],
  ['PC contact/work/detail fallbacks','pc','function inqCtlContactLabel(q)'],
  ['PC assignment history fallback','pc','q.assignmentHistory||q.assignment_history||[]'],
  ['Mobile inquiry normalization','mobile','function inquiryViewM(q)'],
  ['Mobile response body consumer','mobile','(q.responses||[]).forEach(function(r)'],
  ['Mobile canonical response timestamp mutation','mobile','q.raw.responded_at=at']
 ];
 for(const [label,key,token] of checks)if(!sources[key].includes(token))throw Error('UI evidence drift: '+label);
 return checks.map(([label,key,token])=>({label,file:key==='pc'?'crm.html':'mobile.html',token}));
}

function review(snapshot,evidence){
 const current=functionFrom(snapshot);
 const projected=['id','sheet_row + row','brand','site_name + site','address','contact_name + contact','phone','assignee_name + assignee (assigned_to FK users.name)','assigned_to UUID','status','deal_id','opportunity_id','received_at + created_at + at','site_id','source_channel','channel','work_type + work','assigned_at','first_response_at','responded_at','next_action_date + due','detail (allow-listed inbound raw keys)','assignment_history'];
 return `# Inquiry scoped read compatibility — local candidate review

상태: **LOCAL_CANDIDATE_NOT_APPLIED / READ_ONLY_ANALYSIS_COMPLETE**

## 결론

현행 Staging \`crm_read_scoped_v2\`는 문의마다 \`id, assigned_to, site_name, status\`만 반환한다. 현재 PC/mobile UI는 문의 식별·검색·상세·배정 후 새로고침에 표시명, 접수일, 연락처, 공종, 연결 Deal, 응대시각과 배정이력이 더 필요하다. 이 후보는 기존 함수와 \`can_inquiry\` 범위를 유지하고 실제 Staging 컬럼으로 확정되는 값만 보충한다.

## 보충 필드

${projected.map(x=>'- `'+x+'`').join('\n')}

- \`assigned_to\`는 UUID 정본을 그대로 유지한다. 화면 표시명은 FK가 가리키는 \`users.name\`을 \`assignee\`/\`assignee_name\`으로 별도 반환한다.
- 공종 PASS에 필요한 Deal의 \`primary_work / work_items / work_scope_type / work_summary / version\` projection은 한 글자도 제거하지 않는다.
- 문의별 \`assignment_history\`만 lateral aggregate한다. 외부 history row를 볼 수 있는 별도 범위는 만들지 않는다.

## 의도적으로 제외 / BLOCKED

- **응대 본문 BLOCKED:** UI는 \`responses\`를 소비하지만 Staging에는 문의 응대 전용 history table/FK가 없다. 기존 \`raw['응대내용']\` 파싱은 저장 정본·append 규칙이 확정되지 않았으므로 이 후보에서 반환하지 않는다.
- **응대 actor BLOCKED:** \`raw['전화응대자']\`는 서버 UUID 감사 정본이 아니므로 \`responder\`로 투영하지 않는다.
- \`raw\` 전체는 반환하지 않는다. 문의 접수 상세에 현재 UI가 쓰는 allow-list 키만 \`detail\`로 만든다.
- \`assigned_to\` UUID를 legacy 표시명으로 바꾸지 않는다. 기존 UI에 연결할 때는 현재 read compatibility layer가 \`assignee\`를 표시용으로 사용해야 하며 UUID를 이름으로 가장하면 안 된다.

## 보안·호환 불변식

- 함수 signature, owner \`postgres\`, \`SECURITY DEFINER\`, 빈 \`search_path\`, 기존 ACL(\`authenticated\` execute; \`anon\` 없음)을 유지한다.
- actor 및 대상 단건 guard와 각 row의 \`crm_security.can_inquiry(i.id)\`를 유지한다.
- \`can_inquiry\` 함수, object scope, RLS, GRANT를 변경하지 않는다.
- 관계 join은 이미 허용된 inquiry의 담당자 이름과 그 inquiry의 assignment history에만 제한한다.
- Production/n8n/운영 Pages 접근 또는 Staging DDL/DML은 수행하지 않았다.

## 근거

- Staging snapshot: \`sql/inquiry-direct-assign/20260906/after.json\`; inquiries 28개 컬럼, assignment_history FK 대상 컬럼, users FK 표시명 컬럼을 대조했다.
- 기존 read 정의 SHA-256: \`${sha256(current.definition)}\`.
${evidence.map(x=>`- \`${x.file}\`: ${x.label} — \`${x.token.replaceAll('`','\\`')}\``).join('\n')}

## 적용 Gate

이 파일은 적용 승인이 아니다. Staging 적용 전 snapshot drift guard, 역할별 JWT scope, 목록/단건 pagination, 배정 후 새로고침, 응대 BLOCKED 표시를 별도로 검증해야 한다.
`;
}

async function build(){
 const snapshot=loadSnapshot(),current=validateSnapshot(snapshot),evidence=sourceEvidence();
 const apply=candidate(snapshot);
 fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'candidate.sql'),apply);
 // Canonicalize the replacement exactly as PostgreSQL will expose it so rollback can reject drift.
 const direct=require('./crm-inquiry-direct-assign.cjs');
 const db=await direct.setup();
 let canonical;
 try{await db.exec(apply);canonical=(await db.query("SELECT pg_get_functiondef('public.crm_read_scoped_v2(uuid,integer,uuid,uuid)'::regprocedure) d")).rows[0].d;}
 finally{await db.close()}
 const undo=rollback(snapshot,canonical);
 fs.writeFileSync(path.join(dir,'rollback.sql'),undo);
 fs.writeFileSync(path.join(dir,'review.md'),review(snapshot,evidence));
 fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({project_ref:projectRef,source_snapshot:'sql/inquiry-direct-assign/20260906/after.json',source_function_sha256:sha256(current.definition),candidate_sha256:sha256(apply),rollback_sha256:sha256(undo),status:'LOCAL_CANDIDATE_NOT_APPLIED',blocked:['response_body_storage','response_actor_authority']},null,2)+'\n');
 return {candidate:apply,rollback:undo,canonical,evidence};
}

if(require.main===module)build().then(()=>console.log('Inquiry read compatibility candidate generated locally.')).catch(error=>{console.error(error);process.exitCode=1});
module.exports={root,dir,projectRef,signature,requiredColumns,loadSnapshot,functionFrom,validateSnapshot,definition,candidate,rollback,sourceEvidence,review,build,md5,sha256};
