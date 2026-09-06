SET crm.opportunity_create_ref='rprechiaglyjaydkmxsu';
BEGIN;SET LOCAL search_path=pg_catalog;SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN IF current_user<>'postgres' OR current_setting('crm.opportunity_create_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
 OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
 OR to_regprocedure('crm_security.crm_inquiry_followup_command_v1(uuid,uuid,jsonb)') IS NULL
 OR to_regprocedure('crm_security.crm_operational_source_fragment_v1(text,uuid,integer)') IS NULL
 OR to_regprocedure('crm_security.crm_write_command_v2_inquiry_followup_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
 OR to_regprocedure('crm_security.crm_operational_source_fragment_pre_opportunity_create_20260906(text,uuid,integer)') IS NOT NULL
 OR to_regprocedure('crm_security.crm_opportunity_create_command_v1(uuid,uuid,jsonb)') IS NOT NULL
 OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text]))$expected$
 THEN RAISE EXCEPTION 'opportunity create prerequisite drift';END IF;END $guard$;
LOCK TABLE crm_security.command_receipts IN ACCESS EXCLUSIVE MODE;
ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2_inquiry_followup_20260906;
ALTER FUNCTION public.crm_write_command_v2_inquiry_followup_20260906(uuid,text,uuid,integer,jsonb) SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_inquiry_followup_20260906(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer) RENAME TO crm_operational_source_fragment_pre_opportunity_create_20260906;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_fragment_pre_opportunity_create_20260906(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity','quote_version','next_action_complete','stage_check','transition','close','amount','waiting_context','inquiry_reclassify','inquiry_status','inquiry_trash','inquiry_restore','inquiry_purge','inquiry_followup','opportunity_create'));
CREATE FUNCTION crm_security.crm_site_common_key_v1(p_name text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path='' AS $fn$
 SELECT pg_catalog.lower(pg_catalog.regexp_replace(
  pg_catalog.replace(pg_catalog.regexp_replace(pg_catalog.btrim(p_name),'\[[^]]*\]','','g'),'아파트',''),
  '[[:space:]]+','','g'))
$fn$;

CREATE FUNCTION crm_security.crm_site_pc_key_v1(p_name text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path='' AS $fn$
 SELECT pg_catalog.replace(crm_security.crm_site_common_key_v1(p_name),'현장','')
$fn$;

CREATE FUNCTION crm_security.crm_site_mobile_key_v1(p_name text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path='' AS $fn$
 SELECT pg_catalog.regexp_replace(
  pg_catalog.regexp_replace(crm_security.crm_site_common_key_v1(p_name),'apt','','gi'),
  '[-_.,]','','g')
$fn$;

REVOKE EXECUTE ON FUNCTION crm_security.crm_site_common_key_v1(text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE EXECUTE ON FUNCTION crm_security.crm_site_pc_key_v1(text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE EXECUTE ON FUNCTION crm_security.crm_site_mobile_key_v1(text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_opportunity_create_command_v1(
 p_request_id uuid,p_object_id uuid,p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a record; target_user record; target_count integer; receipt crm_security.command_receipts%ROWTYPE;
 server_at timestamptz:=pg_catalog.clock_timestamp(); common_key text; pc_key text; mobile_key text;
 site_ids uuid[]; site_target uuid; site_row public.sites%ROWTYPE; broad_count integer; supplied_site uuid;
 contact_target uuid; assignment_target uuid; deal_target uuid:=gen_random_uuid(); activity_target uuid; next_target uuid;
 audit_target uuid; office_digits text; mobile_digits text; item_count integer; normalized jsonb; ack jsonb;
 target_review_expires timestamptz;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR p_object_id IS DISTINCT FROM p_request_id OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN
   ('surface','site_id','name','work_name','work_type','primary_work','work_items','work_scope_type','work_summary',
    'brand','owner','amount','address','reason','reason_source','office_phone','office_email','manager_name',
    'manager_mobile','manager_role','person_key','client_ref'))
  OR NOT p_payload ?& ARRAY['surface','name','work_name','work_type','primary_work','work_items','work_scope_type','work_summary',
    'brand','owner','reason','office_phone','manager_name','manager_mobile','manager_role','person_key','client_ref']
 THEN RAISE EXCEPTION 'invalid opportunity create contract' USING ERRCODE='22023'; END IF;

 IF p_payload->>'surface' NOT IN ('pc','mobile')
  OR jsonb_typeof(p_payload->'name') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'name')) NOT BETWEEN 1 AND 300
  OR jsonb_typeof(p_payload->'work_name') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'work_name')) NOT BETWEEN 1 AND 500
  OR jsonb_typeof(p_payload->'work_type') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'work_type')) NOT BETWEEN 1 AND 200
  OR jsonb_typeof(p_payload->'primary_work') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'primary_work')) NOT BETWEEN 1 AND 100
  OR jsonb_typeof(p_payload->'work_items') IS DISTINCT FROM 'array'
  OR jsonb_typeof(p_payload->'work_summary') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'work_summary')) NOT BETWEEN 1 AND 2000
  OR p_payload->>'work_scope_type' NOT IN ('single','multi')
  OR p_payload->>'brand' NOT IN ('POUR솔루션','아파트스퀘어','석민이앤씨','기술자문')
  OR jsonb_typeof(p_payload->'owner') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'owner')) NOT BETWEEN 1 AND 100
  OR jsonb_typeof(p_payload->'reason') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'reason')) NOT BETWEEN 5 AND 2000
  OR jsonb_typeof(p_payload->'office_phone') IS DISTINCT FROM 'string'
  OR jsonb_typeof(p_payload->'manager_name') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'manager_name')) NOT BETWEEN 1 AND 200
  OR jsonb_typeof(p_payload->'manager_mobile') IS DISTINCT FROM 'string'
  OR p_payload->>'manager_role' IS DISTINCT FROM '관리소장'
  OR jsonb_typeof(p_payload->'person_key') IS DISTINCT FROM 'string'
  OR jsonb_typeof(p_payload->'client_ref') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'client_ref')) NOT BETWEEN 1 AND 200
  OR (p_payload ? 'amount' AND jsonb_typeof(p_payload->'amount') NOT IN ('number','null'))
  OR (p_payload ? 'address' AND jsonb_typeof(p_payload->'address') NOT IN ('string','null'))
  OR (p_payload ? 'reason_source' AND jsonb_typeof(p_payload->'reason_source') NOT IN ('string','null'))
  OR (p_payload ? 'office_email' AND jsonb_typeof(p_payload->'office_email') NOT IN ('string','null'))
  OR (p_payload ? 'site_id' AND jsonb_typeof(p_payload->'site_id') NOT IN ('string','null'))
 THEN RAISE EXCEPTION 'invalid opportunity create values' USING ERRCODE='22023'; END IF;

 item_count:=jsonb_array_length(p_payload->'work_items');
 IF item_count NOT BETWEEN 1 AND 30
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'work_items') x WHERE jsonb_typeof(x)<>'string')
  OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_payload->'work_items') x WHERE length(btrim(x)) NOT BETWEEN 1 AND 100)
  OR (SELECT count(DISTINCT x) FROM jsonb_array_elements_text(p_payload->'work_items') x)<>item_count
  OR NOT ((p_payload->'work_items') ? (p_payload->>'primary_work'))
  OR (item_count=1 AND p_payload->>'work_scope_type'<>'single')
  OR (item_count>1 AND p_payload->>'work_scope_type'<>'multi')
 THEN RAISE EXCEPTION 'invalid opportunity work contract' USING ERRCODE='22023'; END IF;

 IF p_payload->>'amount' IS NOT NULL AND ((p_payload->>'amount') !~ '^[0-9]+$' OR (p_payload->>'amount')::numeric>9007199254740991)
 THEN RAISE EXCEPTION 'invalid opportunity amount' USING ERRCODE='22023'; END IF;
 IF length(coalesce(p_payload->>'address',''))>1000 OR length(coalesce(p_payload->>'reason_source',''))>200
  OR length(coalesce(p_payload->>'office_email',''))>320
 THEN RAISE EXCEPTION 'invalid opportunity optional values' USING ERRCODE='22023'; END IF;

 office_digits:=regexp_replace(p_payload->>'office_phone','[^0-9]','','g');
 mobile_digits:=regexp_replace(p_payload->>'manager_mobile','[^0-9]','','g');
 IF length(office_digits) NOT BETWEEN 8 AND 20 OR length(mobile_digits) NOT BETWEEN 10 AND 20
  OR p_payload->>'person_key' IS DISTINCT FROM 'mobile:'||mobile_digits
 THEN RAISE EXCEPTION 'invalid contact identity' USING ERRCODE='22023'; END IF;

 normalized:=jsonb_strip_nulls(jsonb_build_object(
  'surface',p_payload->>'surface','site_id',p_payload->'site_id','name',btrim(p_payload->>'name'),
  'work_name',btrim(p_payload->>'work_name'),'work_type',btrim(p_payload->>'work_type'),
  'primary_work',btrim(p_payload->>'primary_work'),'work_items',p_payload->'work_items',
  'work_scope_type',p_payload->>'work_scope_type','work_summary',btrim(p_payload->>'work_summary'),
  'brand',p_payload->>'brand','owner',btrim(p_payload->>'owner'),'amount',p_payload->'amount',
  'address',nullif(btrim(coalesce(p_payload->>'address','')),''),'reason',btrim(p_payload->>'reason'),
  'reason_source',nullif(btrim(coalesce(p_payload->>'reason_source','')),''),'office_phone',office_digits,
  'office_email',nullif(btrim(coalesce(p_payload->>'office_email','')),''),'manager_name',btrim(p_payload->>'manager_name'),
  'manager_mobile',mobile_digits,'manager_role','관리소장','person_key','mobile:'||mobile_digits,
  'client_ref',btrim(p_payload->>'client_ref')));

 PERFORM pg_advisory_xact_lock(hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM 'opportunity_create'
   OR receipt.object_id IS DISTINCT FROM p_object_id OR receipt.expected_version IS DISTINCT FROM 0 OR receipt.payload IS DISTINCT FROM normalized
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;

 SELECT count(*) INTO target_count FROM public.users u JOIN crm_security.access_review r ON r.user_id=u.user_id
  WHERE u.name=normalized->>'owner' AND u.active AND u.auth_uid IS NOT NULL AND r.reviewed_auth_uid=u.auth_uid
   AND r.source_role=u.role AND r.approved AND r.expires_at>server_at;
 IF target_count<>1 THEN RAISE EXCEPTION 'invalid or ambiguous owner' USING ERRCODE='22023'; END IF;
 SELECT u.user_id,u.name,u.email,r.permission_role,r.expires_at INTO target_user
  FROM public.users u JOIN crm_security.access_review r ON r.user_id=u.user_id
  WHERE u.name=normalized->>'owner' AND u.active AND u.auth_uid IS NOT NULL AND r.reviewed_auth_uid=u.auth_uid
   AND r.source_role=u.role AND r.approved AND r.expires_at>server_at;
 target_review_expires:=target_user.expires_at;
 IF a.permission_role IN ('rep','admin') THEN
  IF target_user.permission_role<>'rep' THEN RAISE EXCEPTION 'owner is not an approved head-office rep' USING ERRCODE='42501'; END IF;
 ELSIF a.permission_role='branch' THEN
  IF target_user.permission_role<>'branch' OR target_user.user_id<>a.user_id THEN RAISE EXCEPTION 'branch create must be self-owned' USING ERRCODE='42501'; END IF;
 ELSE RAISE EXCEPTION 'creator role cannot create direct opportunities' USING ERRCODE='42501';
 END IF;

 common_key:=crm_security.crm_site_common_key_v1(normalized->>'name');
 pc_key:=crm_security.crm_site_pc_key_v1(normalized->>'name');
 mobile_key:=crm_security.crm_site_mobile_key_v1(normalized->>'name');
 IF common_key='' THEN RAISE EXCEPTION 'empty site identity' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('site:'||common_key,0));

 IF normalized ? 'site_id' THEN
  BEGIN supplied_site:=(normalized->>'site_id')::uuid; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'invalid site id' USING ERRCODE='22023'; END;
 END IF;
 IF supplied_site IS NOT NULL THEN
  SELECT * INTO site_row FROM public.sites s WHERE s.site_id=supplied_site FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'site not found' USING ERRCODE='22023'; END IF;
  IF crm_security.crm_site_common_key_v1(site_row.site_name) IS DISTINCT FROM common_key
  THEN RAISE EXCEPTION 'SITE_ID_NAME_MISMATCH' USING ERRCODE='PT409'; END IF;
  site_target:=site_row.site_id;
  UPDATE public.sites SET address=coalesce(nullif(address,''),normalized->>'address') WHERE site_id=site_target;
 ELSE
  SELECT array_agg(s.site_id ORDER BY s.site_id) INTO site_ids FROM public.sites s
   WHERE crm_security.crm_site_common_key_v1(s.site_name)=common_key;
  IF coalesce(array_length(site_ids,1),0)>1 THEN RAISE EXCEPTION 'SITE_NORMALIZATION_AMBIGUOUS' USING ERRCODE='PT409'; END IF;
  IF coalesce(array_length(site_ids,1),0)=1 THEN site_target:=site_ids[1];
  ELSE
   SELECT count(*) INTO broad_count FROM public.sites s WHERE
    crm_security.crm_site_pc_key_v1(s.site_name)=pc_key OR crm_security.crm_site_mobile_key_v1(s.site_name)=mobile_key
    OR s.norm_name='crm:v1:'||common_key;
   IF broad_count>0 THEN RAISE EXCEPTION 'SITE_MATCH_REQUIRES_EXPLICIT_SELECTION' USING ERRCODE='PT409'; END IF;
   INSERT INTO public.sites(site_name,norm_name,address) VALUES(normalized->>'name','crm:v1:'||common_key,normalized->>'address')
    RETURNING site_id INTO site_target;
  END IF;
 END IF;

 IF normalized->>'surface'='mobile' AND EXISTS(
  SELECT 1 FROM public.deals d WHERE d.site_id=site_target AND btrim(coalesce(d.list_fields->>'work_name',''))=normalized->>'work_name'
   AND btrim(coalesce(d.work_summary,''))=normalized->>'work_summary')
 THEN RAISE EXCEPTION 'SEMANTIC_DUPLICATE' USING ERRCODE='PT409'; END IF;

 PERFORM pg_advisory_xact_lock(hashtextextended('contact:'||(normalized->>'person_key'),0));
 UPDATE public.contacts SET name=normalized->>'manager_name',title='관리소장',phone=normalized->>'manager_mobile',
  mobile=normalized->>'manager_mobile',role='관리소장',current_site=(SELECT site_name FROM public.sites WHERE site_id=site_target),updated_at=server_at
  WHERE person_key=normalized->>'person_key' RETURNING id INTO contact_target;
 IF contact_target IS NULL THEN
  INSERT INTO public.contacts(name,title,phone,mobile,role,person_key,current_site,created_at,updated_at)
  VALUES(normalized->>'manager_name','관리소장',normalized->>'manager_mobile',normalized->>'manager_mobile','관리소장',
   normalized->>'person_key',(SELECT site_name FROM public.sites WHERE site_id=site_target),server_at,server_at)
  RETURNING id INTO contact_target;
 END IF;

 INSERT INTO public.deals(id,contact_id,brand,list_name,stage_code,assignee_name,assignee_email,amount,source,list_fields,
  created_at,updated_at,site_id,owner_id,lifecycle_status,stage_entered_at,last_activity_at,opened_at,version,
  service_type,origin_business,current_business,office_phone,office_email,manager_name,manager_mobile,person_key,
  manager_role,manager_current_site,manager_started_at,manager_status,primary_work,work_items,work_scope_type,work_summary)
 VALUES(deal_target,contact_target,normalized->>'brand',normalized->>'brand','first_contact',target_user.name,target_user.email,
  CASE WHEN normalized ? 'amount' THEN (normalized->>'amount')::bigint ELSE NULL END,'direct_ui',
  jsonb_strip_nulls(jsonb_build_object('work_name',normalized->>'work_name','reason_source',normalized->>'reason_source',
   'create_surface',normalized->>'surface','client_ref',normalized->>'client_ref')),
  server_at,server_at,site_target,target_user.user_id,'active',server_at,server_at,server_at,1,
  normalized->>'brand',normalized->>'brand',normalized->>'brand',normalized->>'office_phone',normalized->>'office_email',
  normalized->>'manager_name',normalized->>'manager_mobile',normalized->>'person_key','관리소장',
  (SELECT site_name FROM public.sites WHERE site_id=site_target),server_at::date,'current',normalized->>'primary_work',
  normalized->'work_items',normalized->>'work_scope_type',normalized->>'work_summary');

 INSERT INTO public.contact_assignments(person_key,opportunity_id,site_name,office_phone,started_at,status,reason)
 VALUES(normalized->>'person_key',deal_target,(SELECT site_name FROM public.sites WHERE site_id=site_target),
  normalized->>'office_phone',server_at::date,'current','영업 등록')
 ON CONFLICT(person_key,site_name) WHERE ended_at IS NULL DO UPDATE SET office_phone=excluded.office_phone,status='current'
 RETURNING id INTO assignment_target;

 INSERT INTO public.activities(deal_id,actor_email,actor_name,type,detail,occurred_at)
 VALUES(deal_target,(SELECT email FROM public.users WHERE user_id=a.user_id),a.display_name,'영업등록',
  jsonb_strip_nulls(jsonb_build_object('note',(normalized->>'work_name')||' ('||(normalized->>'work_summary')||')',
   'result',normalized->>'reason','surface',normalized->>'surface','reason_source',normalized->>'reason_source')),server_at)
 RETURNING id INTO activity_target;
 IF normalized->>'surface'='mobile' THEN
  INSERT INTO public.next_actions(deal_id,action_type,title,due_at,assignee_name,status,source_activity_id,created_at,updated_at)
  VALUES(deal_target,'첫통화','등록 후 첫 통화',(server_at::date+1)::timestamptz,target_user.name,'open',activity_target,server_at,server_at)
  RETURNING id INTO next_target;
 END IF;

 IF a.permission_role IN ('branch','admin') THEN
  INSERT INTO crm_security.object_scope(scope_id,user_id,deal_id,can_write,reviewed_by,expires_at)
  VALUES(gen_random_uuid(),a.user_id,deal_target,true,'opportunity_create:'||p_request_id::text,
   (SELECT expires_at FROM crm_security.access_review WHERE user_id=a.user_id));
 END IF;

 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,deal_target,'opportunity_create','{}'::jsonb,
  jsonb_build_object('site_id',site_target,'owner_id',target_user.user_id,'contact_id',contact_target,'surface',normalized->>'surface',
   'primary_work',normalized->>'primary_work','work_items',normalized->'work_items','work_summary',normalized->>'work_summary',
   'activity_id',activity_target,'next_action_id',next_target),normalized->>'reason',server_at)
 RETURNING event_id INTO audit_target;

 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation','opportunity_create',
  'object_id',p_object_id,'new_opportunity_id',deal_target,'site_id',site_target,'owner_id',target_user.user_id,
  'contact_id',contact_target,'contact_assignment_id',assignment_target,'activity_id',activity_target,
  'next_action_id',next_target,'audit_event_id',audit_target,'version',1,'server_at',server_at,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack,created_at)
 VALUES(a.auth_uid,p_request_id,a.user_id,'opportunity_create',p_object_id,0,normalized,ack,server_at);
 RETURN ack;
END $fn$;

REVOKE EXECUTE ON FUNCTION crm_security.crm_opportunity_create_command_v1(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_operational_source_fragment_v1(
 p_domain text,p_after uuid,p_limit integer
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE raw_items jsonb; items jsonb; next_cursor uuid; has_more boolean; a record;
BEGIN
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_domain NOT IN ('deal_core','inquiry_core')
 THEN RAISE EXCEPTION 'unsupported operational source domain' USING ERRCODE='22023'; END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>100
 THEN RAISE EXCEPTION 'invalid limit' USING ERRCODE='22023'; END IF;

 IF p_domain='deal_core' THEN
  SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.id),'[]'::jsonb) INTO raw_items FROM(
   SELECT d.id,d.site_id,
    coalesce(s.site_name,o.name,nullif(d.list_fields->>'site_name',''),nullif(d.list_fields->>'name','')) AS site_name,
    coalesce(s.site_name,o.name,nullif(d.list_fields->>'site_name',''),nullif(d.list_fields->>'name','')) AS site,
    d.owner_id,coalesce(u.name,d.assignee_name) AS owner_name,coalesce(u.name,d.assignee_name) AS assignee,
    d.stage_code,d.stage_raw,d.stage_group,d.brand,d.list_name,d.list_fields->>'work_name' AS work_name,d.list_fields->>'work_name' AS work,
    d.amount,d.amount AS amt,d.amount_unknown_reason,
    d.created_at,d.created_at AS created,d.updated_at,d.updated_at AS updated,d.closed_at,d.closed_at AS closed,d.opened_at,
    d.lifecycle_status,d.outcome,d.lost_reason,d.lost_kind,d.badfit_type,d.wake_up_at,d.stage_entered_at,
    d.last_activity_at,d.last_activity_at AS "lastActivity",d.last_customer_contact_at,
    d.stage_entered_at AS "stageAt",d.origin_inquiry_id,d.origin_channel,
    d.source,d.outbound_channel,d.lost_reason,d.lost_kind,d.badfit_type,
    d.service_type,d.service_history,d.origin_business,d.current_business,d.business_history,
    d.primary_work,d.work_items,d.work_scope_type,d.work_summary,d.stage_checklist,d.stage_contexts,d.version,
    s.address,
    d.office_phone,d.office_email,d.manager_name,d.manager_mobile,d.manager_role,d.person_key,
    d.manager_current_site,d.manager_started_at,d.manager_status,d.manager_left_at,
    (SELECT q.amount FROM crm_security.quote_versions q WHERE q.deal_id=d.id ORDER BY q.version_no DESC LIMIT 1) AS quote_amount,
    coalesce((SELECT jsonb_agg(jsonb_build_object('version_no',q.version_no,'amount',q.amount,'reason',q.reason,'created_at',q.created_at) ORDER BY q.version_no)
     FROM crm_security.quote_versions q WHERE q.deal_id=d.id),'[]'::jsonb) AS quote_versions,
    coalesce(nullif(d.manager_mobile,''),nullif(d.office_phone,''),nullif(c.mobile,''),nullif(c.phone,'')) AS call_phone,
    (coalesce(nullif(d.manager_mobile,''),nullif(d.office_phone,''),nullif(c.mobile,''),nullif(c.phone,'')) IS NOT NULL) AS has_contact,
    CASE WHEN c.id IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(jsonb_build_object(
     'id',c.id,'person_key',c.person_key,'name',c.name,
     'role',coalesce(nullif(c.role,''),nullif(c.title,''),'담당자'),
     'phone',c.phone,'mobile',coalesce(c.mobile,c.phone),
     'current_site',coalesce(c.current_site,s.site_name),'office_phone',d.office_phone,
     'is_primary',true
    )) END AS contacts,
    coalesce(ps.favorite,false) AS favorite,ps.last_viewed_at,ps.last_worked_at,coalesce(ps.view_count,0) AS view_count,
    EXISTS(SELECT 1 FROM public.activities ac WHERE ac.deal_id=d.id) AS has_activity,
    (SELECT jsonb_build_object('id',n.id,'type',n.action_type,'text',n.title,'due_at',n.due_at,'assignee_name',n.assignee_name,'status',n.status)
     FROM public.next_actions n WHERE n.deal_id=d.id AND n.status='open'
     ORDER BY n.due_at NULLS LAST,n.id LIMIT 1) AS next_action,
    coalesce((SELECT jsonb_agg(jsonb_build_object('id',n.id,'type',n.action_type,'text',n.title,'due_at',n.due_at,'status',n.status,'completed_at',n.completed_at) ORDER BY n.due_at,n.id)
     FROM public.next_actions n WHERE n.deal_id=d.id AND n.status='completed'),'[]'::jsonb) AS completed_actions,
    coalesce((SELECT jsonb_agg(jsonb_build_object('from',h.from_stage,'to',h.to_stage,'at',h.changed_at,'changed_at',h.changed_at,'reason',h.reason,'actor',h.actor_name,'actor_id',h.actor_id) ORDER BY h.changed_at,h.id)
     FROM public.stage_history h WHERE h.opportunity_id=d.id),'[]'::jsonb) AS stage_history,
    coalesce((SELECT jsonb_agg(jsonb_build_object('id',ac.id,'type',ac.type,'occurred_at',ac.occurred_at) ORDER BY ac.occurred_at,ac.id)
     FROM public.activities ac WHERE ac.deal_id=d.id),'[]'::jsonb) AS activity_signals
   FROM public.deals d
   LEFT JOIN public.sites s ON s.site_id=d.site_id
   LEFT JOIN public.organizations o ON o.id=d.organization_id
   LEFT JOIN public.users u ON u.user_id=d.owner_id
   LEFT JOIN public.contacts c ON c.id=d.contact_id
   LEFT JOIN crm_security.user_opportunity_state ps ON ps.actor_user_id=a.user_id AND ps.deal_id=d.id
   WHERE crm_security.can_deal(d.id,false) AND (p_after IS NULL OR d.id>p_after)
   ORDER BY d.id LIMIT p_limit+1
  )q;
 ELSE
  SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.id),'[]'::jsonb) INTO raw_items FROM(
   SELECT i.id,i.site_id,i.site_name,i.brand,i.inquiry_type,i.work_type,i.source_channel,i.channel,
    i.assigned_to,coalesce(u.name,i.assignee_name) AS assignee_name,ar.permission_role AS assignee_permission_role,
    i.status,i.deal_id,i.opportunity_id,i.received_at,i.created_at,i.updated_at,i.assigned_at,
    i.first_response_at,i.responded_at,i.next_action_date,i.contact_name,i.phone,
    (SELECT e.after_data->>'review_status' FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action='inquiry_reclassify' ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) AS legacy_review_status,
    (SELECT e.after_data->>'reviewed_at' FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action='inquiry_reclassify' ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) AS legacy_reviewed_at,
    (SELECT e.after_data->>'reviewed_by' FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action='inquiry_reclassify' ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) AS legacy_reviewed_by,
    (SELECT e.after_data->>'hold_reason' FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action='inquiry_hold' ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) AS hold_reason,
    (SELECT e.created_at FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action='inquiry_hold' ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) AS held_at,
    (SELECT e.after_data->>'held_by' FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action='inquiry_hold' ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) AS held_by,
    (SELECT CASE WHEN e.action='inquiry_trash' THEN e.created_at END FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action IN ('inquiry_trash','inquiry_restore') ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) AS deleted_at,
    (SELECT CASE WHEN e.action='inquiry_trash' THEN e.after_data->>'deleted_by' END FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action IN ('inquiry_trash','inquiry_restore') ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) AS deleted_by,
    (SELECT CASE WHEN e.action='inquiry_trash' THEN e.after_data->>'delete_reason' END FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action IN ('inquiry_trash','inquiry_restore') ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) AS delete_reason,
    (SELECT CASE WHEN e.action='inquiry_trash' THEN e.after_data->>'delete_note' END FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action IN ('inquiry_trash','inquiry_restore') ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) AS delete_note,
    (SELECT CASE WHEN e.action='inquiry_trash' THEN (e.after_data->>'purge_at')::timestamptz END FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action IN ('inquiry_trash','inquiry_restore') ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) AS purge_at,
    coalesce((SELECT CASE WHEN e.action='inquiry_trash' THEN (e.after_data->>'archive_protected')::boolean ELSE false END FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action IN ('inquiry_trash','inquiry_restore') ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1),false) AS archive_protected,
    (SELECT CASE WHEN e.action='inquiry_trash' THEN e.after_data->>'archive_reason' END FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action IN ('inquiry_trash','inquiry_restore') ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) AS archive_reason,
    coalesce((SELECT e.action<>'inquiry_trash' FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action IN ('inquiry_trash','inquiry_restore') ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1),true) AS valid_inquiry,
    (SELECT CASE WHEN e.action='inquiry_trash' THEN e.after_data->'trash_snapshot' END FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action IN ('inquiry_trash','inquiry_restore') ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) AS trash_snapshot,
    (SELECT e.created_at FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action='inquiry_restore' ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) AS restored_at,
    (SELECT e.after_data->>'restored_by' FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action='inquiry_restore' ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) AS restored_by,
    coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.event_id,'type','데이터정리','note',coalesce(e.before_data->>'brand','기술자문')||' → '||coalesce(e.after_data->>'brand',''),'result','정상 견적문의로 재분류','at',e.created_at,'actor',e.after_data->>'reviewed_by') ORDER BY e.created_at,e.event_id) FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action='inquiry_reclassify'),'[]'::jsonb)
    ||coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.event_id,'type','상태변경','note','보류','result',e.reason,'at',e.created_at,'actor',e.after_data->>'held_by') ORDER BY e.created_at,e.event_id) FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action='inquiry_hold'),'[]'::jsonb) AS activities
   FROM public.inquiries i
   LEFT JOIN public.users u ON u.user_id=i.assigned_to
   LEFT JOIN crm_security.access_review ar ON ar.user_id=i.assigned_to AND ar.approved AND ar.expires_at>now()
   WHERE crm_security.can_inquiry(i.id) AND (p_after IS NULL OR i.id>p_after)
   ORDER BY i.id LIMIT p_limit+1
  )q;
 END IF;

 has_more:=jsonb_array_length(raw_items)>p_limit;
 items:=CASE WHEN has_more THEN raw_items-p_limit ELSE raw_items END;
 next_cursor:=CASE WHEN has_more AND jsonb_array_length(items)>0
  THEN (items->(jsonb_array_length(items)-1)->>'id')::uuid ELSE NULL END;
 RETURN jsonb_build_object(
  'contract_version',1,'resource','operational_source','domain',p_domain,
  'scope_completeness','actor_authorized_rows_only',
  'actor_user_id',a.user_id,'actor_permission_role',a.permission_role,
  'items',items,'pagination',jsonb_build_object(
   'completeness',CASE WHEN has_more THEN 'partial' ELSE 'complete' END,
   'has_more',has_more,'next_cursor',next_cursor));
END $fn$;


REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.crm_write_command_v2(p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$ BEGIN
 IF p_operation='opportunity_create' THEN IF p_expected_version IS DISTINCT FROM 0 OR p_object_id IS DISTINCT FROM p_request_id THEN RAISE EXCEPTION 'invalid create sentinel' USING ERRCODE='22023';END IF;RETURN crm_security.crm_opportunity_create_command_v1(p_request_id,p_object_id,p_payload);END IF;
 RETURN crm_security.crm_write_command_v2_inquiry_followup_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
DO $post$ BEGIN IF has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
 OR has_function_privilege('authenticated','crm_security.crm_opportunity_create_command_v1(uuid,uuid,jsonb)','EXECUTE')
 OR has_function_privilege('authenticated','crm_security.crm_site_common_key_v1(text)','EXECUTE')
 OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'opportunity_create'::text]))$expected$
 THEN RAISE EXCEPTION 'opportunity create post-apply drift';END IF;END $post$;COMMIT;