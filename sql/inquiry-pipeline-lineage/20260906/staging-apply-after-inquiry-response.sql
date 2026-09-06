-- LOCAL REVIEW CANDIDATE ONLY. Staging approval is required.
BEGIN;
-- LOCAL CANDIDATE ONLY. Connects ordinary head-office inquiry promotion and manual lineage.
SET LOCAL crm.inquiry_pipeline_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';

DO $guard$ BEGIN
 IF current_user<>'postgres'
  OR current_setting('crm.inquiry_pipeline_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_opportunity_create_command_v1(uuid,uuid,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_deal_transition_command_v1(uuid,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_site_common_key_v1(text)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_inquiry_response_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_inquiry_pipeline_promote_command_v1(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_inquiry_lineage_link_command_v1(uuid,uuid,integer,jsonb)') IS NOT NULL
  OR EXISTS(SELECT 1 FROM public.deals WHERE origin_inquiry_id IS NOT NULL GROUP BY origin_inquiry_id HAVING count(*)>1)
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check')
     IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'opportunity_create'::text]))$expected$
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.inquiry_audit_events'::regclass AND conname='inquiry_audit_events_action_check')
     IS DISTINCT FROM $expected$CHECK (action = ANY (ARRAY['direct_assign'::text, 'direct_reassign'::text, 'inquiry_unassign'::text, 'inquiry_reclassify'::text, 'inquiry_hold'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'inquiry_response_progress'::text, 'inquiry_response_next_week_retry'::text, 'inquiry_response_missed_retry'::text]))$expected$
 THEN RAISE EXCEPTION 'inquiry pipeline prerequisite drift or duplicate lineage'; END IF;
END $guard$;

LOCK TABLE crm_security.command_receipts,crm_security.inquiry_audit_events IN ACCESS EXCLUSIVE MODE;
ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 RENAME TO crm_write_command_v2_inquiry_response_20260906;
ALTER FUNCTION public.crm_write_command_v2_inquiry_response_20260906(uuid,text,uuid,integer,jsonb)
 SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_inquiry_response_20260906(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN (
 'opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch',
 'next_action','activity','quote_version','next_action_complete','stage_check','transition','close','amount',
 'waiting_context','inquiry_reclassify','inquiry_status','inquiry_trash','inquiry_restore','inquiry_purge',
 'inquiry_followup','opportunity_create','lineage_link'));
ALTER TABLE crm_security.inquiry_audit_events DROP CONSTRAINT inquiry_audit_events_action_check;
ALTER TABLE crm_security.inquiry_audit_events ADD CONSTRAINT inquiry_audit_events_action_check CHECK(action IN (
 'direct_assign','direct_reassign','inquiry_unassign','inquiry_reclassify','inquiry_hold','inquiry_trash',
 'inquiry_restore','inquiry_purge','inquiry_followup','inquiry_response_progress','inquiry_response_next_week_retry',
 'inquiry_response_missed_retry','inquiry_pipeline_promote','inquiry_lineage_link'));

CREATE FUNCTION crm_security.crm_inquiry_pipeline_stage_v1(p_status text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path='' AS $fn$
 SELECT CASE WHEN p_status ~ '견적.*발송[[:space:]]*완료' THEN 'sent' ELSE 'consulting' END
$fn$;
CREATE FUNCTION crm_security.crm_inquiry_pipeline_reason_v1(p_status text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path='' AS $fn$
 SELECT CASE
  WHEN p_status ~ '견적.*발송[[:space:]]*완료' THEN '견적 발송완료로 파이프라인 인계'
  WHEN p_status ~ '견적.*발송' THEN '견적 준비 단계로 파이프라인 인계'
  ELSE btrim(p_status)||' 상태로 파이프라인 인계' END
$fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_inquiry_pipeline_stage_v1(text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE EXECUTE ON FUNCTION crm_security.crm_inquiry_pipeline_reason_v1(text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_inquiry_pipeline_promote_command_v1(
 p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a record; receipt crm_security.command_receipts%ROWTYPE;
 inquiry_row public.inquiries%ROWTYPE; deal_row public.deals%ROWTYPE; new_deal public.deals%ROWTYPE;
 canonical jsonb; ack jsonb; server_at timestamptz:=clock_timestamp(); mode_value text; status_value text;
 desired_stage text; reason_value text; inquiry_id_value uuid; opportunity_id_value uuid; amount_value bigint; site_target uuid;
 site_ids uuid[]; common_key text; broad_count integer; deal_target uuid:=gen_random_uuid();
 history_id uuid; activity_id uuid; audit_id uuid; inquiry_audit_id uuid; owner_review record;
 old_status text; old_stage text; old_version integer; is_create boolean:=p_operation='opportunity_create';
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND OR a.permission_role<>'admin' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0
  OR p_operation NOT IN ('opportunity_create','transition') OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR NOT p_payload ?& ARRAY['intent','inquiry_id','promotion_mode','inquiry_status','owner','from','to','note']
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN
   ('intent','inquiry_id','promotion_mode','inquiry_status','owner','from','to','note','amount','name','work_name','brand','site_id','client_ref','opportunity_id'))
 THEN RAISE EXCEPTION 'invalid inquiry promotion payload' USING ERRCODE='22023'; END IF;
 IF NOT is_create THEN
  BEGIN opportunity_id_value:=(p_payload->>'opportunity_id')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'invalid opportunity id' USING ERRCODE='22023'; END;
 END IF;
 IF (is_create AND (p_payload->>'intent'<>'inquiry_promote_create' OR p_object_id<>p_request_id OR p_expected_version<>0))
  OR (NOT is_create AND p_payload->>'intent'<>'inquiry_promote_existing')
  OR (NOT is_create AND opportunity_id_value IS DISTINCT FROM p_object_id)
 THEN RAISE EXCEPTION 'invalid inquiry promotion intent' USING ERRCODE='22023'; END IF;
 BEGIN inquiry_id_value:=(p_payload->>'inquiry_id')::uuid; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'invalid inquiry id' USING ERRCODE='22023'; END;
 mode_value:=p_payload->>'promotion_mode';status_value:=btrim(p_payload->>'inquiry_status');
 IF mode_value NOT IN ('auto','manual') OR length(status_value) NOT BETWEEN 1 AND 100 OR status_value !~ '견적.*발송'
  OR p_payload->>'to' IS DISTINCT FROM crm_security.crm_inquiry_pipeline_stage_v1(status_value)
  OR length(coalesce(p_payload->>'owner','')) NOT BETWEEN 1 AND 100
  OR length(coalesce(p_payload->>'note','')) NOT BETWEEN 1 AND 2000
 THEN RAISE EXCEPTION 'invalid inquiry promotion values' USING ERRCODE='22023'; END IF;
 IF p_payload ? 'amount' AND jsonb_typeof(p_payload->'amount') NOT IN ('number','null') THEN RAISE EXCEPTION 'invalid inquiry promotion amount' USING ERRCODE='22023'; END IF;
 IF p_payload->>'amount' IS NOT NULL THEN
  IF (p_payload->>'amount') !~ '^[0-9]+$' OR (p_payload->>'amount')::numeric>9007199254740991 THEN RAISE EXCEPTION 'invalid inquiry promotion amount' USING ERRCODE='22023'; END IF;
  amount_value:=(p_payload->>'amount')::bigint;
 END IF;
 desired_stage:=crm_security.crm_inquiry_pipeline_stage_v1(status_value);
 reason_value:=crm_security.crm_inquiry_pipeline_reason_v1(status_value);
 IF p_payload->>'note' IS DISTINCT FROM reason_value THEN RAISE EXCEPTION 'promotion reason conflict' USING ERRCODE='PT409'; END IF;
 canonical:=jsonb_strip_nulls(jsonb_build_object('intent',p_payload->>'intent','inquiry_id',inquiry_id_value,
  'promotion_mode',mode_value,'inquiry_status',status_value,'owner',btrim(p_payload->>'owner'),
  'from',p_payload->>'from','to',desired_stage,'note',reason_value,'amount',p_payload->'amount',
  'name',nullif(btrim(coalesce(p_payload->>'name','')),''),'work_name',nullif(btrim(coalesce(p_payload->>'work_name','')),''),
  'brand',nullif(btrim(coalesce(p_payload->>'brand','')),''),'site_id',p_payload->'site_id',
  'client_ref',nullif(btrim(coalesce(p_payload->>'client_ref','')),'')));

 PERFORM pg_advisory_xact_lock(hashtextextended('inquiry-pipeline:'||inquiry_id_value::text,0));
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.inquiry_id=inquiry_id_value FOR SHARE;
 SELECT * INTO inquiry_row FROM public.inquiries i WHERE i.id=inquiry_id_value FOR UPDATE;
 IF NOT FOUND OR NOT crm_security.can_inquiry(inquiry_id_value)
  OR coalesce(inquiry_row.brand,'')='기술자문' OR coalesce(inquiry_row.inquiry_type,'') ~ '기술자문'
  OR coalesce(inquiry_row.status,'') IN ('수주','실주','배드핏','연락두절','종결','종료')
  OR inquiry_row.assigned_to IS NULL
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT u.user_id,u.name,u.email,r.permission_role INTO owner_review
 FROM public.users u JOIN crm_security.access_review r ON r.user_id=u.user_id AND r.reviewed_auth_uid=u.auth_uid
 WHERE u.user_id=inquiry_row.assigned_to AND u.active AND u.auth_uid IS NOT NULL AND r.source_role=u.role
  AND r.approved AND r.expires_at>server_at;
 IF NOT FOUND OR owner_review.permission_role<>'rep' OR owner_review.name IS DISTINCT FROM btrim(p_payload->>'owner')
 THEN RAISE EXCEPTION 'inquiry owner is not an approved head-office rep' USING ERRCODE='42501'; END IF;
 IF mode_value='manual' AND inquiry_row.status IS DISTINCT FROM status_value THEN RAISE EXCEPTION 'inquiry status conflict' USING ERRCODE='PT409'; END IF;
 old_status:=inquiry_row.status;

 PERFORM pg_advisory_xact_lock(hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM p_operation
   OR receipt.object_id IS DISTINCT FROM p_object_id OR receipt.expected_version IS DISTINCT FROM p_expected_version
   OR receipt.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;

 IF is_create THEN
  IF EXISTS(SELECT 1 FROM public.deals d WHERE d.origin_inquiry_id=inquiry_id_value)
   OR inquiry_row.deal_id IS NOT NULL OR inquiry_row.opportunity_id IS NOT NULL
  THEN RAISE EXCEPTION 'inquiry already linked' USING ERRCODE='PT409'; END IF;
  IF coalesce(p_payload->>'from','')<>'' THEN RAISE EXCEPTION 'invalid create source stage' USING ERRCODE='22023'; END IF;
  IF inquiry_row.site_id IS NOT NULL THEN
   SELECT s.site_id INTO site_target FROM public.sites s WHERE s.site_id=inquiry_row.site_id FOR UPDATE;
   IF site_target IS NULL THEN RAISE EXCEPTION 'inquiry site not found' USING ERRCODE='PT409'; END IF;
  ELSE
   common_key:=crm_security.crm_site_common_key_v1(inquiry_row.site_name);
   IF common_key='' THEN RAISE EXCEPTION 'empty inquiry site identity' USING ERRCODE='22023'; END IF;
   PERFORM pg_advisory_xact_lock(hashtextextended('site:'||common_key,0));
   SELECT array_agg(s.site_id ORDER BY s.site_id) INTO site_ids FROM public.sites s
    WHERE crm_security.crm_site_common_key_v1(s.site_name)=common_key;
   IF coalesce(array_length(site_ids,1),0)>1 THEN RAISE EXCEPTION 'SITE_NORMALIZATION_AMBIGUOUS' USING ERRCODE='PT409'; END IF;
   IF coalesce(array_length(site_ids,1),0)=1 THEN site_target:=site_ids[1];
   ELSE
    SELECT count(*) INTO broad_count FROM public.sites s WHERE
     crm_security.crm_site_pc_key_v1(s.site_name)=crm_security.crm_site_pc_key_v1(inquiry_row.site_name)
     OR crm_security.crm_site_mobile_key_v1(s.site_name)=crm_security.crm_site_mobile_key_v1(inquiry_row.site_name)
     OR s.norm_name='crm:v1:'||common_key;
    IF broad_count>0 THEN RAISE EXCEPTION 'SITE_MATCH_REQUIRES_EXPLICIT_SELECTION' USING ERRCODE='PT409'; END IF;
    INSERT INTO public.sites(site_name,norm_name,address) VALUES(inquiry_row.site_name,'crm:v1:'||common_key,inquiry_row.address)
     RETURNING site_id INTO site_target;
   END IF;
  END IF;
  IF p_payload->>'site_id' IS NOT NULL AND (p_payload->>'site_id')::uuid IS DISTINCT FROM site_target
  THEN RAISE EXCEPTION 'inquiry site conflict' USING ERRCODE='PT409'; END IF;
  IF nullif(btrim(coalesce(p_payload->>'name','')),'') IS DISTINCT FROM btrim(inquiry_row.site_name)
   OR nullif(btrim(coalesce(p_payload->>'brand','')),'') IS DISTINCT FROM inquiry_row.brand
  THEN RAISE EXCEPTION 'inquiry snapshot conflict' USING ERRCODE='PT409'; END IF;
  INSERT INTO public.deals(id,brand,list_name,stage_code,stage_raw,stage_group,assignee_name,assignee_email,amount,
   source,list_fields,created_at,updated_at,site_id,owner_id,origin_inquiry_id,lifecycle_status,stage_entered_at,
   last_activity_at,opened_at,version,service_type,origin_business,current_business)
  VALUES(deal_target,inquiry_row.brand,inquiry_row.brand,desired_stage,desired_stage,
   CASE WHEN desired_stage='sent' THEN 'sent' ELSE 'design' END,owner_review.name,owner_review.email,amount_value,
   'inquiry_promotion',jsonb_strip_nulls(jsonb_build_object('work_name',coalesce(nullif(btrim(coalesce(p_payload->>'work_name','')),''),inquiry_row.work_type),
    'create_surface','pc','client_ref',p_payload->>'client_ref','promotion_mode',mode_value)),server_at,server_at,
   site_target,owner_review.user_id,inquiry_id_value,'active',server_at,server_at,server_at,1,
   inquiry_row.brand,inquiry_row.brand,inquiry_row.brand) RETURNING * INTO new_deal;
  old_stage:=NULL;old_version:=0;
 ELSE
  SELECT * INTO deal_row FROM public.deals d WHERE d.id=p_object_id FOR UPDATE;
  IF NOT FOUND OR NOT crm_security.can_deal(p_object_id,true) OR deal_row.outcome IS NOT NULL OR deal_row.lifecycle_status='closed'
   OR deal_row.version IS DISTINCT FROM p_expected_version OR deal_row.stage_code IS DISTINCT FROM p_payload->>'from'
   OR deal_row.owner_id IS DISTINCT FROM inquiry_row.assigned_to
   OR deal_row.origin_inquiry_id IS NOT NULL AND deal_row.origin_inquiry_id IS DISTINCT FROM inquiry_id_value
   OR EXISTS(SELECT 1 FROM public.deals d WHERE d.origin_inquiry_id=inquiry_id_value AND d.id<>p_object_id)
  THEN RAISE EXCEPTION 'promotion deal state conflict' USING ERRCODE='PT409'; END IF;
  IF inquiry_row.site_id IS NOT NULL AND deal_row.site_id IS DISTINCT FROM inquiry_row.site_id
  THEN RAISE EXCEPTION 'promotion site conflict' USING ERRCODE='PT409'; END IF;
  IF (CASE desired_stage WHEN 'consulting' THEN 2 WHEN 'sent' THEN 3 ELSE 0 END) <=
     (CASE deal_row.stage_code WHEN 'first_contact' THEN 1 WHEN 'consulting' THEN 2 WHEN 'sent' THEN 3
      WHEN 'rapport' THEN 4 WHEN 'silent' THEN 5 WHEN 'compete' THEN 6 WHEN 'imminent' THEN 7 WHEN 'bidding' THEN 8
      WHEN 'contract' THEN 9 WHEN 'construction' THEN 10 WHEN 'completion' THEN 11 ELSE 99 END)
  THEN RAISE EXCEPTION 'promotion is not forward' USING ERRCODE='PT409'; END IF;
  old_stage:=deal_row.stage_code;old_version:=deal_row.version;deal_target:=deal_row.id;site_target:=deal_row.site_id;
  UPDATE public.deals SET origin_inquiry_id=coalesce(origin_inquiry_id,inquiry_id_value),stage_code=desired_stage,
   stage_raw=desired_stage,stage_group=CASE WHEN desired_stage='sent' THEN 'sent' ELSE 'design' END,
   amount=coalesce(amount_value,amount),stage_entered_at=server_at,last_activity_at=server_at,updated_at=server_at,
   version=version+1 WHERE id=p_object_id AND version=p_expected_version RETURNING * INTO new_deal;
  IF NOT FOUND THEN RAISE EXCEPTION 'unexpected version mutation' USING ERRCODE='PT409'; END IF;
 END IF;

 IF mode_value='auto' THEN UPDATE public.inquiries SET status=status_value,qualified_at=coalesce(qualified_at,server_at),updated_at=server_at WHERE id=inquiry_id_value;
 ELSE UPDATE public.inquiries SET qualified_at=coalesce(qualified_at,server_at),updated_at=server_at WHERE id=inquiry_id_value; END IF;
 INSERT INTO public.stage_history(opportunity_id,inquiry_id,from_stage,to_stage,reason,actor_id,actor_name,changed_at)
 VALUES(deal_target,inquiry_id_value,old_stage,desired_stage,reason_value,a.user_id,a.display_name,server_at) RETURNING id INTO history_id;
 INSERT INTO public.activities(deal_id,organization_id,actor_email,actor_name,type,detail,occurred_at)
 VALUES(deal_target,new_deal.organization_id,(SELECT email FROM public.users WHERE user_id=a.user_id),a.display_name,'파이프라인 인계',
  jsonb_build_object('note',reason_value,'result',CASE WHEN is_create THEN '신규 Deal 생성' ELSE '기존 Deal 단계 전환' END,
   'origin_inquiry_id',inquiry_id_value,'promotion_mode',mode_value,'meaningful_contact',false),server_at) RETURNING id INTO activity_id;
 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,deal_target,'inquiry_pipeline_promote',
  jsonb_build_object('inquiry_status',old_status,'stage_code',old_stage,'version',old_version),
  jsonb_build_object('inquiry_id',inquiry_id_value,'inquiry_status',CASE WHEN mode_value='auto' THEN status_value ELSE old_status END,
   'stage_code',new_deal.stage_code,'version',new_deal.version,'site_id',site_target,'owner_id',new_deal.owner_id,
   'stage_history_id',history_id,'activity_id',activity_id,'promotion_mode',mode_value),reason_value,server_at)
 RETURNING event_id INTO audit_id;
 INSERT INTO crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,inquiry_id_value,'inquiry_pipeline_promote',
  jsonb_build_object('status',old_status),jsonb_build_object('status',CASE WHEN mode_value='auto' THEN status_value ELSE old_status END,
   'deal_id',deal_target,'stage_code',new_deal.stage_code,'stage_history_id',history_id,'activity_id',activity_id),reason_value,server_at)
 RETURNING event_id INTO inquiry_audit_id;
 IF a.permission_role='admin' THEN
  INSERT INTO crm_security.object_scope(scope_id,user_id,deal_id,can_write,reviewed_by,expires_at)
  VALUES(gen_random_uuid(),a.user_id,deal_target,true,'inquiry_pipeline:'||p_request_id::text,
   (SELECT expires_at FROM crm_security.access_review WHERE user_id=a.user_id)) ON CONFLICT DO NOTHING;
 END IF;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation',p_operation,'object_id',p_object_id,
  'intent',p_payload->>'intent','inquiry_id',inquiry_id_value,'new_opportunity_id',CASE WHEN is_create THEN deal_target ELSE NULL END,
  'opportunity_id',deal_target,'site_id',site_target,'owner_id',new_deal.owner_id,'from_stage',old_stage,'to_stage',new_deal.stage_code,
  'previous_version',old_version,'version',new_deal.version,'inquiry_status',CASE WHEN mode_value='auto' THEN status_value ELSE old_status END,
  'stage_history_id',history_id,'activity_id',activity_id,'audit_event_id',audit_id,'inquiry_audit_event_id',inquiry_audit_id,
  'server_at',server_at,'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack,created_at)
 VALUES(a.auth_uid,p_request_id,a.user_id,p_operation,p_object_id,p_expected_version,canonical,ack,server_at);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_inquiry_pipeline_promote_command_v1(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_inquiry_lineage_link_command_v1(
 p_request_id uuid,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record; receipt crm_security.command_receipts%ROWTYPE; inquiry_row public.inquiries%ROWTYPE;
 old_deal public.deals%ROWTYPE; new_deal public.deals%ROWTYPE; inquiry_id_value uuid; canonical jsonb; ack jsonb;
 server_at timestamptz:=clock_timestamp(); audit_id uuid; inquiry_audit_id uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM crm_security.actor();IF NOT FOUND OR a.permission_role<>'admin' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0
  OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR NOT p_payload ? 'inquiry_id'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('intent','inquiry_id','site_id','inquiry_site'))
  OR coalesce(p_payload->>'intent','lineage_link')<>'lineage_link'
 THEN RAISE EXCEPTION 'invalid lineage link payload' USING ERRCODE='22023'; END IF;
 BEGIN inquiry_id_value:=(p_payload->>'inquiry_id')::uuid; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'invalid inquiry id' USING ERRCODE='22023'; END;
 canonical:=jsonb_build_object('intent','lineage_link','inquiry_id',inquiry_id_value);
 PERFORM pg_advisory_xact_lock(hashtextextended('inquiry-pipeline:'||inquiry_id_value::text,0));
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.inquiry_id=inquiry_id_value FOR SHARE;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.deal_id=p_object_id FOR SHARE;
 SELECT * INTO inquiry_row FROM public.inquiries i WHERE i.id=inquiry_id_value FOR UPDATE;
 SELECT * INTO old_deal FROM public.deals d WHERE d.id=p_object_id FOR UPDATE;
 IF inquiry_row.id IS NULL OR old_deal.id IS NULL OR NOT crm_security.can_inquiry(inquiry_id_value) OR NOT crm_security.can_deal(p_object_id,true)
  OR inquiry_row.site_id IS NULL OR old_deal.site_id IS DISTINCT FROM inquiry_row.site_id
  OR old_deal.created_at<coalesce(inquiry_row.received_at,inquiry_row.created_at)
  OR old_deal.origin_inquiry_id IS NOT NULL AND old_deal.origin_inquiry_id IS DISTINCT FROM inquiry_id_value
  OR EXISTS(SELECT 1 FROM public.deals d WHERE d.origin_inquiry_id=inquiry_id_value AND d.id<>p_object_id)
  OR inquiry_row.deal_id IS NOT NULL AND inquiry_row.deal_id<>p_object_id
  OR inquiry_row.opportunity_id IS NOT NULL AND inquiry_row.opportunity_id<>p_object_id
 THEN RAISE EXCEPTION 'lineage link conflict' USING ERRCODE='PT409'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation<>'lineage_link' OR receipt.object_id<>p_object_id
   OR receipt.expected_version<>p_expected_version OR receipt.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;
 IF old_deal.version<>p_expected_version THEN RAISE EXCEPTION 'version conflict' USING ERRCODE='PT409'; END IF;
 IF old_deal.origin_inquiry_id IS NULL THEN
  UPDATE public.deals SET origin_inquiry_id=inquiry_id_value,updated_at=server_at,version=version+1
  WHERE id=p_object_id AND version=p_expected_version RETURNING * INTO new_deal;
 ELSE new_deal:=old_deal; END IF;
 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,p_object_id,'inquiry_lineage_link',
  jsonb_build_object('origin_inquiry_id',old_deal.origin_inquiry_id,'version',old_deal.version),
  jsonb_build_object('origin_inquiry_id',inquiry_id_value,'version',new_deal.version),'관리자 확인 lineage 연결',server_at)
 RETURNING event_id INTO audit_id;
 INSERT INTO crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,inquiry_id_value,'inquiry_lineage_link','{}'::jsonb,
  jsonb_build_object('deal_id',p_object_id,'version',new_deal.version),'관리자 확인 lineage 연결',server_at)
 RETURNING event_id INTO inquiry_audit_id;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation','lineage_link','object_id',p_object_id,
  'intent','lineage_link','inquiry_id',inquiry_id_value,'opportunity_id',p_object_id,'previous_version',old_deal.version,
  'version',new_deal.version,'changed',old_deal.origin_inquiry_id IS NULL,'audit_event_id',audit_id,
  'inquiry_audit_event_id',inquiry_audit_id,'server_at',server_at,'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack,created_at)
 VALUES(a.auth_uid,p_request_id,a.user_id,'lineage_link',p_object_id,p_expected_version,canonical,ack,server_at);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_inquiry_lineage_link_command_v1(uuid,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_write_command_v2(
 p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF p_operation IN ('opportunity_create','transition') AND p_payload->>'intent' IN ('inquiry_promote_create','inquiry_promote_existing')
 THEN RETURN crm_security.crm_inquiry_pipeline_promote_command_v1(p_request_id,p_operation,p_object_id,p_expected_version,p_payload); END IF;
 IF p_operation='lineage_link' THEN
  RETURN crm_security.crm_inquiry_lineage_link_command_v1(p_request_id,p_object_id,p_expected_version,p_payload); END IF;
 RETURN crm_security.crm_write_command_v2_inquiry_response_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;

DO $post$ BEGIN
 IF has_function_privilege('public','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_inquiry_pipeline_promote_command_v1(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_inquiry_lineage_link_command_v1(uuid,uuid,integer,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'inquiry pipeline post-apply ACL drift'; END IF;
END $post$;
COMMIT;
