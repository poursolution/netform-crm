-- LOCAL REVIEW CANDIDATE ONLY. Separate Staging approval is required.
BEGIN;
SET LOCAL crm.next_postpone_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='90s';

DO $guard$ BEGIN
 IF current_user<>'postgres' OR current_setting('crm.next_postpone_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regclass('crm_security.message_reminders') IS NULL
  OR to_regprocedure('crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_pipeline_action_command_v1_pre_next_postpone_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_next_action_postpone_command_v1(uuid,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') IS NULL
  OR to_regprocedure('crm_security.crm_operational_source_v1_pre_next_postpone_20260906(text,uuid,integer)') IS NOT NULL
  OR to_regclass('crm_security.next_action_postponements') IS NOT NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'opportunity_create'::text, 'lineage_link'::text, 'attachment_prepare'::text, 'attachment_complete'::text, 'expansion_pool_update'::text, 'expansion_note'::text]))$expected$
 THEN RAISE EXCEPTION 'next postpone prerequisite drift'; END IF;
END $guard$;

CREATE TABLE crm_security.next_action_postponements(
 event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL UNIQUE,
 event_kind text NOT NULL DEFAULT 'postpone' CHECK(event_kind IN ('postpone','today_next_week')),
 next_action_id uuid NOT NULL REFERENCES public.next_actions(id) ON DELETE CASCADE,
 replacement_action_id uuid REFERENCES public.next_actions(id) ON DELETE SET NULL,
 deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
 before_due_at date NOT NULL,
 after_due_at date NOT NULL,
 postpone_count integer NOT NULL CHECK(postpone_count>0),
 actor_auth_uid uuid NOT NULL,
 actor_user_id uuid NOT NULL REFERENCES public.users(user_id),
 actor_name text NOT NULL,
 changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(after_due_at>before_due_at)
);
CREATE UNIQUE INDEX next_action_postponements_deal_count_uq ON crm_security.next_action_postponements(deal_id,postpone_count);
ALTER TABLE crm_security.next_action_postponements ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_security.next_action_postponements FORCE ROW LEVEL SECURITY;
REVOKE ALL ON crm_security.next_action_postponements FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb)
 RENAME TO crm_pipeline_action_command_v1_pre_next_postpone_20260906;
REVOKE EXECUTE ON FUNCTION crm_security.crm_pipeline_action_command_v1_pre_next_postpone_20260906(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_next_action_postpone_command_v1(
 p_request_id uuid,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a record; oldrow public.deals%ROWTYPE; newrow public.deals%ROWTYPE; actionrow public.next_actions%ROWTYPE;
 prior crm_security.command_receipts%ROWTYPE; action_id_value uuid; due_value date; before_due date;
 count_value integer; event_value uuid; activity_value uuid; audit_value uuid; actor_email text;
 server_at timestamptz; canonical jsonb; ack jsonb;
BEGIN
 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0
  OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('intent','action_id','due_at'))
  OR NOT p_payload ?& ARRAY['intent','action_id','due_at'] OR p_payload->>'intent'<>'postpone'
  OR p_payload->>'due_at' !~ '^\d{4}-\d{2}-\d{2}$'
 THEN RAISE EXCEPTION 'invalid next postpone payload' USING ERRCODE='22023'; END IF;
 BEGIN action_id_value:=(p_payload->>'action_id')::uuid;due_value:=(p_payload->>'due_at')::date;
 EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow OR invalid_datetime_format THEN
  RAISE EXCEPTION 'invalid next postpone identity/date' USING ERRCODE='22023';
 END;
 canonical:=jsonb_build_object('intent','postpone','action_id',action_id_value,'due_at',due_value);
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND OR a.permission_role NOT IN ('rep','branch','admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.deal_id=p_object_id FOR SHARE;
 SELECT * INTO oldrow FROM public.deals d WHERE d.id=p_object_id FOR UPDATE;
 IF NOT FOUND OR NOT crm_security.can_deal(p_object_id,true) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO actionrow FROM public.next_actions n WHERE n.id=action_id_value AND n.deal_id=p_object_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'next action not found' USING ERRCODE='PT409'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO prior FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF prior.actor_user_id IS DISTINCT FROM a.user_id OR prior.operation IS DISTINCT FROM 'next_action'
   OR prior.object_id IS DISTINCT FROM p_object_id OR prior.expected_version IS DISTINCT FROM p_expected_version
   OR prior.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN prior.ack||jsonb_build_object('replayed',true);
 END IF;
 IF oldrow.version IS DISTINCT FROM p_expected_version OR actionrow.status<>'open'
 THEN RAISE EXCEPTION 'next postpone state conflict' USING ERRCODE='PT409'; END IF;
 before_due:=(actionrow.due_at AT TIME ZONE 'Asia/Seoul')::date;
 server_at:=clock_timestamp();
 IF due_value<=before_due OR due_value<=(server_at AT TIME ZONE 'Asia/Seoul')::date
 THEN RAISE EXCEPTION 'next postpone must move later' USING ERRCODE='PT409'; END IF;
 SELECT coalesce(max(e.postpone_count),0)+1 INTO count_value
 FROM crm_security.next_action_postponements e WHERE e.deal_id=p_object_id;
 UPDATE public.next_actions SET due_at=due_value::timestamp AT TIME ZONE 'UTC',updated_at=server_at
 WHERE id=action_id_value AND deal_id=p_object_id AND status='open';
 INSERT INTO crm_security.next_action_postponements(request_id,event_kind,next_action_id,deal_id,before_due_at,after_due_at,postpone_count,actor_auth_uid,actor_user_id,actor_name,changed_at)
 VALUES(p_request_id,'postpone',action_id_value,p_object_id,before_due,due_value,count_value,a.auth_uid,a.user_id,a.display_name,server_at)
 RETURNING event_id INTO event_value;
 SELECT u.email INTO actor_email FROM public.users u WHERE u.user_id=a.user_id;
 INSERT INTO public.activities(deal_id,organization_id,actor_email,actor_name,type,detail,occurred_at)
 VALUES(p_object_id,oldrow.organization_id,actor_email,a.display_name,'연기',jsonb_build_object('note','오늘 할 일 연기','result',due_value||' · '||count_value||'회','meaningful_contact',false,'next_action_id',action_id_value,'postpone_event_id',event_value),server_at)
 RETURNING id INTO activity_value;
 UPDATE public.deals SET next_action=actionrow.title,next_action_date=due_value,last_activity_at=greatest(last_activity_at,server_at),updated_at=server_at,version=version+1
 WHERE id=p_object_id AND version=p_expected_version RETURNING * INTO newrow;
 IF NOT FOUND THEN RAISE EXCEPTION 'unexpected version mutation' USING ERRCODE='PT409'; END IF;
 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,p_object_id,'next_action_postpone',
  jsonb_build_object('version',oldrow.version,'next_action_id',action_id_value,'due_at',before_due),
  jsonb_build_object('version',newrow.version,'intent','postpone','next_action_id',action_id_value,'due_at',due_value,'postpone_count',count_value,'postpone_event_id',event_value,'activity_id',activity_value),
  '오늘 할 일 연기',server_at) RETURNING event_id INTO audit_value;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation','next_action','object_id',p_object_id,
  'intent','postpone','actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'previous_version',p_expected_version,'version',newrow.version,
  'next_action_id',action_id_value,'previous_due_at',before_due,'due_at',due_value,'postpone_count',count_value,
  'postpone_event_id',event_value,'activity_id',activity_value,'audit_event_id',audit_value,'server_at',server_at,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack,created_at)
 VALUES(a.auth_uid,p_request_id,a.user_id,'next_action',p_object_id,p_expected_version,canonical,ack,server_at);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_next_action_postpone_command_v1(uuid,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_pipeline_action_command_v1(
 p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF p_operation='next_action' AND p_payload->>'intent'='postpone'
 THEN RETURN crm_security.crm_next_action_postpone_command_v1(p_request_id,p_object_id,p_expected_version,p_payload); END IF;
 RETURN crm_security.crm_pipeline_action_command_v1_pre_next_postpone_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION public.crm_operational_source_v1(text,uuid,integer) RENAME TO crm_operational_source_v1_pre_next_postpone_20260906;
ALTER FUNCTION public.crm_operational_source_v1_pre_next_postpone_20260906(text,uuid,integer) SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_v1_pre_next_postpone_20260906(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.crm_operational_source_v1(p_domain text,p_after uuid DEFAULT NULL,p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE base jsonb; projected jsonb;
BEGIN
 base:=crm_security.crm_operational_source_v1_pre_next_postpone_20260906(p_domain,p_after,p_limit);
 IF p_domain<>'deal_core' THEN RETURN base; END IF;
 SELECT coalesce(jsonb_agg(CASE WHEN nullif(item->'next_action'->>'id','') IS NULL THEN item ELSE jsonb_set(item,'{next_action}',
  (item->'next_action')||jsonb_build_object('postpone_count',(SELECT count(*)::integer FROM crm_security.next_action_postponements e WHERE e.deal_id=(item->>'id')::uuid),'postponeCount',(SELECT count(*)::integer FROM crm_security.next_action_postponements e WHERE e.deal_id=(item->>'id')::uuid)),false) END
  ORDER BY (item->>'id')::uuid),'[]'::jsonb)
 INTO projected FROM jsonb_array_elements(coalesce(base->'items','[]'::jsonb)) item;
 RETURN jsonb_set(base,'{items}',projected,false);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) TO authenticated;

DO $post$ BEGIN
 IF has_function_privilege('anon','public.crm_operational_source_v1(text,uuid,integer)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_operational_source_v1(text,uuid,integer)','EXECUTE')
  OR has_function_privilege('service_role','public.crm_operational_source_v1(text,uuid,integer)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_next_action_postpone_command_v1(uuid,uuid,integer,jsonb)','EXECUTE')
  OR has_table_privilege('authenticated','crm_security.next_action_postponements','SELECT')
 THEN RAISE EXCEPTION 'next postpone post-apply drift'; END IF;
END $post$;
COMMIT;
