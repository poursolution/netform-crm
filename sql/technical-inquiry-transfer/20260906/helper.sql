-- LOCAL CANDIDATE ONLY. Connects the reachable PC technical-inquiry transfer.
SET LOCAL crm.technical_inquiry_transfer_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';

DO $guard$ BEGIN
 IF current_user<>'postgres'
  OR current_setting('crm.technical_inquiry_transfer_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_inquiry_action_command_v1(uuid,text,uuid,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_inquiry_action_check_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_technical_inquiry_transfer_command_v1(uuid,uuid,jsonb)') IS NOT NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.inquiry_audit_events'::regclass AND conname='inquiry_audit_events_action_check')
     IS DISTINCT FROM $expected$CHECK (action = ANY (ARRAY['direct_assign'::text, 'direct_reassign'::text, 'inquiry_unassign'::text, 'inquiry_reclassify'::text, 'inquiry_hold'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'inquiry_response_progress'::text, 'inquiry_response_next_week_retry'::text, 'inquiry_response_missed_retry'::text, 'inquiry_pipeline_promote'::text, 'inquiry_lineage_link'::text, 'inquiry_stage_progress'::text, 'inquiry_next_set'::text, 'inquiry_next_complete'::text, 'inquiry_check'::text]))$expected$
 THEN RAISE EXCEPTION 'technical inquiry transfer prerequisite drift'; END IF;
END $guard$;

LOCK TABLE crm_security.command_receipts,crm_security.inquiry_audit_events IN ACCESS EXCLUSIVE MODE;
ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 RENAME TO crm_write_command_v2_inquiry_action_check_20260906;
ALTER FUNCTION public.crm_write_command_v2_inquiry_action_check_20260906(uuid,text,uuid,integer,jsonb)
 SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_inquiry_action_check_20260906(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE crm_security.inquiry_audit_events DROP CONSTRAINT inquiry_audit_events_action_check;
ALTER TABLE crm_security.inquiry_audit_events ADD CONSTRAINT inquiry_audit_events_action_check CHECK(action IN (
 'direct_assign','direct_reassign','inquiry_unassign','inquiry_reclassify','inquiry_hold','inquiry_trash',
 'inquiry_restore','inquiry_purge','inquiry_followup','inquiry_response_progress','inquiry_response_next_week_retry',
 'inquiry_response_missed_retry','inquiry_pipeline_promote','inquiry_lineage_link','inquiry_stage_progress',
 'inquiry_next_set','inquiry_next_complete','inquiry_check','technical_inquiry_transfer'));

CREATE FUNCTION crm_security.crm_technical_inquiry_transfer_command_v1(
 p_request_id uuid,p_object_id uuid,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a record; receipt crm_security.command_receipts%ROWTYPE; inquiry_row public.inquiries%ROWTYPE;
 owner_review record; canonical jsonb; ack jsonb; server_at timestamptz:=clock_timestamp();
 inquiry_id_value uuid; deal_target uuid:=gen_random_uuid(); site_target uuid; owner_target uuid;
 owner_name text; owner_email text; history_id uuid; activity_id uuid; audit_id uuid; inquiry_audit_id uuid;
 review_expires timestamptz; latest_management text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND OR a.permission_role<>'admin' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR p_object_id IS DISTINCT FROM p_request_id OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR NOT p_payload ?& ARRAY['intent','inquiry_id','client_ref']
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('intent','inquiry_id','client_ref'))
  OR p_payload->>'intent'<>'technical_inquiry_transfer'
  OR length(coalesce(p_payload->>'client_ref','')) NOT BETWEEN 12 AND 200
  OR p_payload->>'client_ref' !~ '^local-tech-[A-Za-z0-9._:-]+$'
 THEN RAISE EXCEPTION 'invalid technical inquiry transfer payload' USING ERRCODE='22023'; END IF;
 BEGIN inquiry_id_value:=(p_payload->>'inquiry_id')::uuid;
 EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'invalid inquiry id' USING ERRCODE='22023'; END;
 canonical:=jsonb_build_object('intent','technical_inquiry_transfer','inquiry_id',inquiry_id_value,'client_ref',p_payload->>'client_ref');

 PERFORM pg_advisory_xact_lock(hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM 'opportunity_create'
   OR receipt.object_id IS DISTINCT FROM p_object_id OR receipt.expected_version IS DISTINCT FROM 0
   OR receipt.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;

 PERFORM pg_advisory_xact_lock(hashtextextended('technical-inquiry:'||inquiry_id_value::text,0));
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.inquiry_id=inquiry_id_value FOR SHARE;
 SELECT * INTO inquiry_row FROM public.inquiries i WHERE i.id=inquiry_id_value FOR UPDATE;
 IF NOT FOUND OR NOT crm_security.can_inquiry(inquiry_id_value)
  OR NOT (coalesce(inquiry_row.brand,'')='기술자문' OR coalesce(inquiry_row.inquiry_type,'') ~ '기술자문')
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT e.action INTO latest_management FROM crm_security.inquiry_audit_events e
  WHERE e.inquiry_id=inquiry_id_value AND e.action IN ('inquiry_trash','inquiry_restore','inquiry_purge')
  ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1;
 IF latest_management IN ('inquiry_trash','inquiry_purge')
  OR EXISTS(SELECT 1 FROM public.deals d WHERE d.origin_inquiry_id=inquiry_id_value)
  OR inquiry_row.deal_id IS NOT NULL OR inquiry_row.opportunity_id IS NOT NULL
 THEN RAISE EXCEPTION 'technical inquiry already linked or unavailable' USING ERRCODE='PT409'; END IF;

 IF inquiry_row.site_id IS NOT NULL THEN
  SELECT s.site_id INTO site_target FROM public.sites s WHERE s.site_id=inquiry_row.site_id FOR SHARE;
 END IF;
 IF inquiry_row.assigned_to IS NOT NULL THEN
  SELECT u.user_id,u.name,u.email INTO owner_review
   FROM public.users u JOIN crm_security.access_review r ON r.user_id=u.user_id AND r.reviewed_auth_uid=u.auth_uid
   WHERE u.user_id=inquiry_row.assigned_to AND u.active AND u.auth_uid IS NOT NULL AND r.source_role=u.role
    AND r.approved AND r.expires_at>server_at AND r.permission_role='rep';
  IF FOUND THEN owner_target:=owner_review.user_id;owner_name:=owner_review.name;owner_email:=owner_review.email; END IF;
 END IF;

 INSERT INTO public.deals(id,brand,list_name,stage_code,stage_raw,stage_group,assignee_name,assignee_email,amount,
  source,list_fields,created_at,updated_at,site_id,owner_id,origin_inquiry_id,lifecycle_status,stage_entered_at,
  last_activity_at,opened_at,version,service_type,origin_business,current_business)
 VALUES(deal_target,'기술자문','기술자문','first_contact','first_contact','design',owner_name,owner_email,NULL,
  'technical_inquiry_transfer',jsonb_strip_nulls(jsonb_build_object('site_name',nullif(btrim(coalesce(inquiry_row.site_name,'')),''),
   'work_name',nullif(btrim(coalesce(inquiry_row.work_type,'')),''),'client_ref',p_payload->>'client_ref','origin_source','기존 기술자문 문의 검토')),
  server_at,server_at,site_target,owner_target,inquiry_id_value,'active',server_at,server_at,server_at,1,
  '기술자문','기술자문','기술자문');
 UPDATE public.inquiries SET status='영업전환',qualified_at=coalesce(qualified_at,server_at),updated_at=server_at,
  deal_id=deal_target,opportunity_id=deal_target WHERE id=inquiry_id_value;
 INSERT INTO public.stage_history(opportunity_id,inquiry_id,from_stage,to_stage,reason,actor_id,actor_name,changed_at)
 VALUES(deal_target,inquiry_id_value,NULL,'first_contact','기존 기술자문 문의를 Pipeline 영업기회로 이관',a.user_id,a.display_name,server_at)
 RETURNING id INTO history_id;
 INSERT INTO public.activities(deal_id,actor_email,actor_name,type,detail,occurred_at)
 VALUES(deal_target,(SELECT email FROM public.users WHERE user_id=a.user_id),a.display_name,'파이프라인 인계',
  jsonb_build_object('note','기존 기술자문 문의 검토','result','기술자문 영업기회 생성','origin_inquiry_id',inquiry_id_value,
   'owner_id',owner_target,'site_id',site_target,'meaningful_contact',false),server_at) RETURNING id INTO activity_id;
 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,deal_target,'technical_inquiry_transfer','{}'::jsonb,
  jsonb_build_object('inquiry_id',inquiry_id_value,'stage_code','first_contact','version',1,'owner_id',owner_target,
   'site_id',site_target,'stage_history_id',history_id,'activity_id',activity_id),
  '기존 기술자문 문의를 Pipeline 영업기회로 이관',server_at) RETURNING event_id INTO audit_id;
 INSERT INTO crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,inquiry_id_value,'technical_inquiry_transfer',
  jsonb_build_object('status',inquiry_row.status,'deal_id',inquiry_row.deal_id,'opportunity_id',inquiry_row.opportunity_id),
  jsonb_build_object('status','영업전환','deal_id',deal_target,'opportunity_id',deal_target,'stage_code','first_contact',
   'stage_history_id',history_id,'activity_id',activity_id),
  '기존 기술자문 문의를 Pipeline 영업기회로 이관',server_at) RETURNING event_id INTO inquiry_audit_id;
 SELECT r.expires_at INTO review_expires FROM crm_security.access_review r
  WHERE r.user_id=a.user_id AND r.reviewed_auth_uid=a.auth_uid AND r.approved AND r.expires_at>server_at;
 IF review_expires IS NULL THEN RAISE EXCEPTION 'admin review expired' USING ERRCODE='42501'; END IF;
 INSERT INTO crm_security.object_scope(scope_id,user_id,deal_id,can_write,reviewed_by,expires_at)
 VALUES(gen_random_uuid(),a.user_id,deal_target,true,'technical_inquiry_transfer:'||p_request_id::text,review_expires)
 ON CONFLICT DO NOTHING;

 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation','opportunity_create',
  'object_id',p_object_id,'intent','technical_inquiry_transfer','inquiry_id',inquiry_id_value,
  'new_opportunity_id',deal_target,'opportunity_id',deal_target,'site_id',site_target,'owner_id',owner_target,
  'to_stage','first_contact','version',1,'stage_history_id',history_id,'activity_id',activity_id,
  'audit_event_id',audit_id,'inquiry_audit_event_id',inquiry_audit_id,'server_at',server_at,
  'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack,created_at)
 VALUES(a.auth_uid,p_request_id,a.user_id,'opportunity_create',p_object_id,0,canonical,ack,server_at);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_technical_inquiry_transfer_command_v1(uuid,uuid,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_write_command_v2(
 p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF p_operation='opportunity_create' AND p_payload->>'intent'='technical_inquiry_transfer' THEN
  IF p_expected_version IS DISTINCT FROM 0 OR p_object_id IS DISTINCT FROM p_request_id
  THEN RAISE EXCEPTION 'invalid technical inquiry transfer sentinel' USING ERRCODE='22023'; END IF;
  RETURN crm_security.crm_technical_inquiry_transfer_command_v1(p_request_id,p_object_id,p_payload);
 END IF;
 RETURN crm_security.crm_write_command_v2_inquiry_action_check_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;

DO $post$ BEGIN
 IF has_function_privilege('public','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_technical_inquiry_transfer_command_v1(uuid,uuid,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'technical inquiry transfer post-apply ACL drift'; END IF;
END $post$;
