-- LOCAL REVIEW CANDIDATE ONLY. Separate Staging approval is required.
BEGIN;
SET LOCAL crm.customer_support_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='90s';

DO $guard$ BEGIN
 IF current_user<>'postgres' OR current_setting('crm.customer_support_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_pre_customer_support_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_operational_source_v1_pre_customer_support_20260906(text,uuid,integer)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_customer_support_action_command_v1(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regclass('crm_security.customer_support_actions') IS NOT NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'opportunity_create'::text, 'lineage_link'::text, 'attachment_prepare'::text, 'attachment_complete'::text, 'expansion_pool_update'::text, 'expansion_note'::text]))$expected$
 THEN RAISE EXCEPTION 'customer support action prerequisite drift'; END IF;
END $guard$;

LOCK TABLE crm_security.command_receipts IN ACCESS EXCLUSIVE MODE;

CREATE TABLE crm_security.customer_support_actions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL UNIQUE,
 client_ref text NOT NULL,
 target_type text NOT NULL CHECK(target_type IN ('deal','inq')),
 target_id uuid NOT NULL,
 site_name text NOT NULL,
 rep_user_id uuid NOT NULL,
 rep_name text NOT NULL,
 action_key text NOT NULL CHECK(action_key IN ('response_request','inquiry_review','call','message','recontact_result','waiting_context','manager_consult','waiting_review','material_support','meeting_check','contact_check','contact_activity','reactivate_review','dormant_review','recontact_schedule','support_detail')),
 action_label text NOT NULL,
 reason text NOT NULL,
 completion_rule text NOT NULL,
 status text NOT NULL DEFAULT 'requested' CHECK(status='requested'),
 requested_by_auth_uid uuid NOT NULL,
 requested_by_user_id uuid NOT NULL,
 requested_by_name text NOT NULL,
 requested_at timestamptz NOT NULL,
 UNIQUE(requested_by_user_id,client_ref)
);
ALTER TABLE crm_security.customer_support_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_security.customer_support_actions FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation=ANY(ARRAY[
 'opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity','quote_version','next_action_complete','stage_check','transition','close','amount','waiting_context','inquiry_reclassify','inquiry_status','inquiry_trash','inquiry_restore','inquiry_purge','inquiry_followup','opportunity_create','lineage_link','attachment_prepare','attachment_complete','expansion_pool_update','expansion_note','customer_support_action'
]::text[]));

ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2_pre_customer_support_20260906;
ALTER FUNCTION public.crm_write_command_v2_pre_customer_support_20260906(uuid,text,uuid,integer,jsonb) SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_pre_customer_support_20260906(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_customer_support_action_command_v1(
 p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a record; prior crm_security.command_receipts%ROWTYPE; support_id uuid; owner_id_value uuid; site_value text;
 target_type_value text; client_ref_value text; action_key_value text; action_label_value text; reason_value text; completion_value text;
 rep_name_value text; server_at timestamptz; canonical jsonb; ack jsonb;
BEGIN
 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version IS DISTINCT FROM 0
  OR p_operation IS DISTINCT FROM 'customer_support_action' OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('client_ref','target_type','action_key','action_label','reason','completion_rule'))
  OR NOT p_payload ?& ARRAY['client_ref','target_type','action_key','action_label','reason','completion_rule']
 THEN RAISE EXCEPTION 'invalid customer support action payload' USING ERRCODE='22023'; END IF;
 target_type_value:=p_payload->>'target_type';client_ref_value:=btrim(p_payload->>'client_ref');action_key_value:=p_payload->>'action_key';
 action_label_value:=btrim(p_payload->>'action_label');reason_value:=btrim(p_payload->>'reason');completion_value:=btrim(p_payload->>'completion_rule');
 IF target_type_value NOT IN ('deal','inq') OR client_ref_value!~'^support-[0-9]{10,16}-[a-z0-9]{5}$'
  OR action_key_value NOT IN ('response_request','inquiry_review','call','message','recontact_result','waiting_context','manager_consult','waiting_review','material_support','meeting_check','contact_check','contact_activity','reactivate_review','dormant_review','recontact_schedule','support_detail')
  OR length(action_label_value) NOT BETWEEN 1 AND 200 OR length(reason_value) NOT BETWEEN 1 AND 4000 OR length(completion_value) NOT BETWEEN 1 AND 1000
 THEN RAISE EXCEPTION 'invalid customer support action values' USING ERRCODE='22023'; END IF;
 canonical:=jsonb_build_object('client_ref',client_ref_value,'target_type',target_type_value,'action_key',action_key_value,'action_label',action_label_value,'reason',reason_value,'completion_rule',completion_value);
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND OR a.permission_role<>'admin' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF target_type_value='deal' THEN
  SELECT d.owner_id,coalesce(s.site_name,d.list_name,'') INTO owner_id_value,site_value FROM public.deals d LEFT JOIN public.sites s ON s.site_id=d.site_id WHERE d.id=p_object_id FOR UPDATE OF d;
  IF NOT FOUND OR NOT crm_security.can_deal(p_object_id,true) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 ELSE
  SELECT i.assigned_to,coalesce(i.site_name,'') INTO owner_id_value,site_value FROM public.inquiries i WHERE i.id=p_object_id FOR UPDATE;
  IF NOT FOUND OR NOT crm_security.can_inquiry(p_object_id) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 END IF;
 SELECT u.name INTO rep_name_value FROM public.users u JOIN crm_security.access_review r ON r.user_id=u.user_id
 WHERE u.user_id=owner_id_value AND u.active AND r.approved AND r.expires_at>now() AND r.permission_role='rep';
 IF rep_name_value IS NULL THEN RAISE EXCEPTION 'support target has no approved UUID rep' USING ERRCODE='42501'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO prior FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF prior.actor_user_id IS DISTINCT FROM a.user_id OR prior.operation IS DISTINCT FROM p_operation OR prior.object_id IS DISTINCT FROM p_object_id
   OR prior.expected_version IS DISTINCT FROM 0 OR prior.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN prior.ack||jsonb_build_object('replayed',true);
 END IF;
 server_at:=clock_timestamp();
 INSERT INTO crm_security.customer_support_actions(request_id,client_ref,target_type,target_id,site_name,rep_user_id,rep_name,action_key,action_label,reason,completion_rule,status,requested_by_auth_uid,requested_by_user_id,requested_by_name,requested_at)
 VALUES(p_request_id,client_ref_value,target_type_value,p_object_id,site_value,owner_id_value,rep_name_value,action_key_value,action_label_value,reason_value,completion_value,'requested',a.auth_uid,a.user_id,a.display_name,server_at)
 RETURNING id INTO support_id;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation',p_operation,'object_id',p_object_id,
  'support_action_id',support_id,'client_ref',client_ref_value,'target_type',target_type_value,'target_id',p_object_id,'rep_user_id',owner_id_value,'rep_name',rep_name_value,
  'action_key',action_key_value,'action_label',action_label_value,'status','requested','requested_by_auth_uid',a.auth_uid,'requested_by_user_id',a.user_id,'requested_by_name',a.display_name,'requested_at',server_at,'server_at',server_at,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack,created_at)
 VALUES(a.auth_uid,p_request_id,a.user_id,p_operation,p_object_id,0,canonical,ack,server_at);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_customer_support_action_command_v1(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_write_command_v2(p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF p_operation='customer_support_action' THEN
  RETURN crm_security.crm_customer_support_action_command_v1(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
 END IF;
 RETURN crm_security.crm_write_command_v2_pre_customer_support_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;

ALTER FUNCTION public.crm_operational_source_v1(text,uuid,integer) RENAME TO crm_operational_source_v1_pre_customer_support_20260906;
ALTER FUNCTION public.crm_operational_source_v1_pre_customer_support_20260906(text,uuid,integer) SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_v1_pre_customer_support_20260906(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_operational_source_v1(p_domain text,p_after uuid DEFAULT NULL,p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record; items jsonb; has_more boolean; next_cursor text;
BEGIN
 IF p_domain<>'customer_support_action' THEN RETURN crm_security.crm_operational_source_v1_pre_customer_support_20260906(p_domain,p_after,p_limit); END IF;
 IF p_limit<1 OR p_limit>100 THEN RAISE EXCEPTION 'invalid operational source limit' USING ERRCODE='22023'; END IF;
 SELECT * INTO a FROM crm_security.actor(); IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF a.permission_role<>'admin' THEN items:='[]'::jsonb;
 ELSE
  SELECT coalesce(jsonb_agg(x.item ORDER BY x.id),'[]'::jsonb) INTO items FROM (
   SELECT c.id,jsonb_build_object('id',c.id,'client_ref',c.client_ref,'target_type',c.target_type,'target_key',c.target_type||':'||c.target_id,
    'opportunity_id',CASE WHEN c.target_type='deal' THEN c.target_id END,'inquiry_id',CASE WHEN c.target_type='inq' THEN c.target_id END,
    'site_name',c.site_name,'rep_user_id',c.rep_user_id,'rep_name',c.rep_name,'action_key',c.action_key,'action_label',c.action_label,'reason',c.reason,
    'completion_rule',c.completion_rule,'status',c.status,'requested_by',c.requested_by_name,'requested_at',c.requested_at) item
   FROM crm_security.customer_support_actions c WHERE (p_after IS NULL OR c.id>p_after)
    AND ((c.target_type='deal' AND crm_security.can_deal(c.target_id,false)) OR (c.target_type='inq' AND crm_security.can_inquiry(c.target_id)))
   ORDER BY c.id LIMIT p_limit+1
  ) x;
 END IF;
 has_more:=jsonb_array_length(items)>p_limit;
 IF has_more THEN items:=items-p_limit; END IF;
 next_cursor:=CASE WHEN has_more THEN items->(jsonb_array_length(items)-1)->>'id' END;
 RETURN jsonb_build_object('contract_version',1,'resource','operational_source','domain',p_domain,'scope_completeness','actor_authorized_rows_only','items',items,
  'pagination',jsonb_build_object('completeness',CASE WHEN has_more THEN 'partial' ELSE 'complete' END,'has_more',has_more,'next_cursor',next_cursor));
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) TO authenticated;

DO $post$ BEGIN
 IF has_table_privilege('authenticated','crm_security.customer_support_actions','SELECT')
  OR has_function_privilege('authenticated','crm_security.crm_customer_support_action_command_v1(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_write_command_v2_pre_customer_support_20260906(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_operational_source_v1_pre_customer_support_20260906(text,uuid,integer)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_operational_source_v1(text,uuid,integer)','EXECUTE')
  OR has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('anon','public.crm_operational_source_v1(text,uuid,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'customer support action post-apply drift'; END IF;
END $post$;
COMMIT;
