-- LOCAL REVIEW CANDIDATE ONLY. Separate Staging approval is required.
BEGIN;
SET LOCAL crm.message_reminder_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='90s';

DO $guard$ BEGIN
 IF current_user<>'postgres' OR current_setting('crm.message_reminder_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_expansion_note(jsonb)') IS NULL OR to_regprocedure('public.crm_expansion_context(jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_pipeline_action_command_v1_pre_message_reminder_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_message_reminder_command_v1(uuid,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') IS NULL
  OR to_regprocedure('crm_security.crm_operational_source_v1_pre_message_reminder_20260906(text,uuid,integer)') IS NOT NULL
  OR to_regclass('crm_security.message_reminders') IS NOT NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'opportunity_create'::text, 'lineage_link'::text, 'attachment_prepare'::text, 'attachment_complete'::text, 'expansion_pool_update'::text, 'expansion_note'::text]))$expected$
 THEN RAISE EXCEPTION 'message reminder prerequisite drift'; END IF;
END $guard$;

CREATE TABLE crm_security.message_reminders(
 next_action_id uuid PRIMARY KEY REFERENCES public.next_actions(id) ON DELETE CASCADE,
 request_id uuid NOT NULL UNIQUE,
 deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
 scheduled_at timestamptz NOT NULL,
 channel text NOT NULL CHECK(channel IN ('sms','kakao')),
 template_key text NOT NULL CHECK(length(template_key) BETWEEN 1 AND 100),
 draft_body text NOT NULL CHECK(length(draft_body) BETWEEN 1 AND 8000),
 actor_auth_uid uuid NOT NULL,
 actor_user_id uuid NOT NULL REFERENCES public.users(user_id),
 actor_name text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE crm_security.message_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_security.message_reminders FORCE ROW LEVEL SECURITY;
REVOKE ALL ON crm_security.message_reminders FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb)
 RENAME TO crm_pipeline_action_command_v1_pre_message_reminder_20260906;
REVOKE EXECUTE ON FUNCTION crm_security.crm_pipeline_action_command_v1_pre_message_reminder_20260906(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_message_reminder_command_v1(
 p_request_id uuid,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a record; oldrow public.deals%ROWTYPE; newrow public.deals%ROWTYPE; prior crm_security.command_receipts%ROWTYPE;
 scheduled_value timestamptz; due_value date; type_value text; text_value text; channel_value text;
 template_value text; draft_value text; owner_name text; actor_email text; server_at timestamptz;
 next_id uuid; activity_id uuid; audit_id uuid; cancelled_ids jsonb:='[]'::jsonb; canonical jsonb; ack jsonb;
BEGIN
 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0
  OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('intent','type','text','due_at','scheduled_at','channel','template_key','draft_body'))
  OR NOT p_payload ?& ARRAY['intent','type','text','due_at','scheduled_at','channel','template_key','draft_body']
  OR p_payload->>'intent'<>'message_reminder' OR p_payload->>'type'<>'메시지발송'
  OR p_payload->>'due_at' !~ '^\d{4}-\d{2}-\d{2}$'
  OR p_payload->>'channel' NOT IN ('sms','kakao')
  OR length(btrim(p_payload->>'text'))<1 OR length(p_payload->>'text')>500
  OR length(btrim(p_payload->>'template_key'))<1 OR length(p_payload->>'template_key')>100
  OR length(btrim(p_payload->>'draft_body'))<1 OR length(p_payload->>'draft_body')>8000
 THEN RAISE EXCEPTION 'invalid message reminder payload' USING ERRCODE='22023'; END IF;
 BEGIN
  due_value:=(p_payload->>'due_at')::date;
  scheduled_value:=(p_payload->>'scheduled_at')::timestamptz;
 EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN
  RAISE EXCEPTION 'invalid message reminder schedule' USING ERRCODE='22023';
 END;
 IF NOT isfinite(scheduled_value) OR due_value IS DISTINCT FROM (scheduled_value AT TIME ZONE 'Asia/Seoul')::date
 THEN RAISE EXCEPTION 'message reminder date mismatch' USING ERRCODE='22023'; END IF;
 type_value:='메시지발송'; text_value:=btrim(p_payload->>'text'); channel_value:=p_payload->>'channel';
 template_value:=btrim(p_payload->>'template_key'); draft_value:=btrim(p_payload->>'draft_body');
 canonical:=jsonb_build_object('intent','message_reminder','type',type_value,'text',text_value,'due_at',due_value,
  'scheduled_at',scheduled_value,'channel',channel_value,'template_key',template_value,'draft_body',draft_value);
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND OR a.permission_role NOT IN ('rep','branch','admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.deal_id=p_object_id FOR SHARE;
 SELECT * INTO oldrow FROM public.deals d WHERE d.id=p_object_id FOR UPDATE;
 IF NOT FOUND OR NOT crm_security.can_deal(p_object_id,true) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO prior FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF prior.actor_user_id IS DISTINCT FROM a.user_id OR prior.operation IS DISTINCT FROM 'next_action'
   OR prior.object_id IS DISTINCT FROM p_object_id OR prior.expected_version IS DISTINCT FROM p_expected_version
   OR prior.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN prior.ack||jsonb_build_object('replayed',true);
 END IF;
 IF oldrow.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'version conflict' USING ERRCODE='PT409'; END IF;
 server_at:=clock_timestamp();
 IF scheduled_value<=server_at THEN RAISE EXCEPTION 'message reminder must be future' USING ERRCODE='22023'; END IF;
 SELECT u.name,u.email INTO owner_name,actor_email
 FROM public.users u JOIN crm_security.access_review r ON r.user_id=u.user_id
 WHERE u.user_id=oldrow.owner_id AND u.active AND r.approved AND r.expires_at>now()
  AND r.permission_role IN ('rep','branch','admin');
 SELECT u.email INTO actor_email FROM public.users u WHERE u.user_id=a.user_id;
 IF owner_name IS NULL OR actor_email IS NULL THEN RAISE EXCEPTION 'No approved UUID owner' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(id ORDER BY created_at,id),'[]'::jsonb) INTO cancelled_ids
 FROM public.next_actions WHERE deal_id=p_object_id AND status='open';
 UPDATE public.next_actions SET status='cancelled',updated_at=server_at WHERE deal_id=p_object_id AND status='open';
 INSERT INTO public.next_actions(deal_id,action_type,title,due_at,assignee_name,status,created_at,updated_at)
 VALUES(p_object_id,type_value,text_value,scheduled_value,owner_name,'open',server_at,server_at) RETURNING id INTO next_id;
 INSERT INTO crm_security.message_reminders(next_action_id,request_id,deal_id,scheduled_at,channel,template_key,draft_body,actor_auth_uid,actor_user_id,actor_name,created_at)
 VALUES(next_id,p_request_id,p_object_id,scheduled_value,channel_value,template_value,draft_value,a.auth_uid,a.user_id,a.display_name,server_at);
 INSERT INTO public.activities(deal_id,organization_id,actor_email,actor_name,type,detail,occurred_at)
 VALUES(p_object_id,oldrow.organization_id,actor_email,a.display_name,'예약',
  jsonb_build_object('note',CASE channel_value WHEN 'sms' THEN '문자' ELSE '카카오' END||' 발송 알림 예약','result',text_value||' · '||scheduled_value,'meaningful_contact',false,'next_action_id',next_id),server_at)
 RETURNING id INTO activity_id;
 UPDATE public.deals SET next_action=text_value,next_action_date=due_value,last_activity_at=greatest(last_activity_at,server_at),updated_at=server_at,version=version+1
 WHERE id=p_object_id AND version=p_expected_version RETURNING * INTO newrow;
 IF NOT FOUND THEN RAISE EXCEPTION 'unexpected version mutation' USING ERRCODE='PT409'; END IF;
 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,p_object_id,'message_reminder',
  jsonb_build_object('version',oldrow.version,'next_action',oldrow.next_action,'next_action_date',oldrow.next_action_date),
  jsonb_build_object('version',newrow.version,'intent','message_reminder','next_action_id',next_id,'activity_id',activity_id,'cancelled_action_ids',cancelled_ids,'scheduled_at',scheduled_value,'channel',channel_value,'template_key',template_value),text_value,server_at)
 RETURNING event_id INTO audit_id;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation','next_action','object_id',p_object_id,
  'intent','message_reminder','actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'previous_version',p_expected_version,'version',newrow.version,
  'next_action_id',next_id,'activity_id',activity_id,'audit_event_id',audit_id,'cancelled_action_ids',cancelled_ids,
  'due_at',due_value,'scheduled_at',scheduled_value,'channel',channel_value,'template_key',template_value,'assignee_name',owner_name,'server_at',server_at,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack,created_at)
 VALUES(a.auth_uid,p_request_id,a.user_id,'next_action',p_object_id,p_expected_version,canonical,ack,server_at);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_message_reminder_command_v1(uuid,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_pipeline_action_command_v1(
 p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF p_operation='next_action' AND p_payload->>'intent'='message_reminder'
 THEN RETURN crm_security.crm_message_reminder_command_v1(p_request_id,p_object_id,p_expected_version,p_payload); END IF;
 RETURN crm_security.crm_pipeline_action_command_v1_pre_message_reminder_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION public.crm_operational_source_v1(text,uuid,integer) RENAME TO crm_operational_source_v1_pre_message_reminder_20260906;
ALTER FUNCTION public.crm_operational_source_v1_pre_message_reminder_20260906(text,uuid,integer) SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_v1_pre_message_reminder_20260906(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_operational_source_v1(p_domain text,p_after uuid DEFAULT NULL,p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE base jsonb; projected jsonb;
BEGIN
 base:=crm_security.crm_operational_source_v1_pre_message_reminder_20260906(p_domain,p_after,p_limit);
 IF p_domain<>'deal_core' THEN RETURN base; END IF;
 SELECT coalesce(jsonb_agg(CASE WHEN r.next_action_id IS NULL THEN item ELSE jsonb_set(item,'{next_action}',
  (item->'next_action')||jsonb_build_object('scheduled_at',r.scheduled_at,'scheduledAt',r.scheduled_at,'channel',r.channel,'template_key',r.template_key,'templateKey',r.template_key,'draft_body',r.draft_body,'draftBody',r.draft_body),false) END
  ORDER BY (item->>'id')::uuid),'[]'::jsonb)
 INTO projected FROM jsonb_array_elements(coalesce(base->'items','[]'::jsonb)) item
 LEFT JOIN crm_security.message_reminders r ON r.next_action_id=nullif(item->'next_action'->>'id','')::uuid;
 RETURN jsonb_set(base,'{items}',projected,false);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) TO authenticated;

DO $post$ BEGIN
 IF has_function_privilege('anon','public.crm_operational_source_v1(text,uuid,integer)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_operational_source_v1(text,uuid,integer)','EXECUTE')
  OR has_function_privilege('service_role','public.crm_operational_source_v1(text,uuid,integer)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_message_reminder_command_v1(uuid,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_table_privilege('authenticated','crm_security.message_reminders','SELECT')
 THEN RAISE EXCEPTION 'message reminder post-apply drift'; END IF;
END $post$;
COMMIT;
