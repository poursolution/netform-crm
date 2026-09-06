SET LOCAL crm.expansion_update_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='90s';

DO $guard$ BEGIN
 IF current_user<>'postgres'
  OR current_setting('crm.expansion_update_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') IS NULL
  OR to_regprocedure('crm_security.crm_deal_close_won_command_v1(uuid,uuid,integer,jsonb)') IS NULL
  OR to_regclass('crm_security.expansion_pool') IS NULL
  OR to_regclass('crm_security.deal_won_events') IS NULL
  OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='crm_security' AND table_name='expansion_pool' AND column_name='version')
  OR to_regclass('crm_security.expansion_pool_events') IS NOT NULL
  OR to_regprocedure('crm_security.crm_expansion_pool_update_command_v1(uuid,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_pre_expansion_update_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_operational_source_v1_pre_expansion_update_20260906(text,uuid,integer)') IS NOT NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.command_receipts'::regclass
        AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'opportunity_create'::text, 'lineage_link'::text, 'attachment_prepare'::text, 'attachment_complete'::text]))$expected$
 THEN RAISE EXCEPTION 'expansion pool update prerequisite drift'; END IF;
END $guard$;

ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2_pre_expansion_update_20260906;
ALTER FUNCTION public.crm_write_command_v2_pre_expansion_update_20260906(uuid,text,uuid,integer,jsonb) SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_pre_expansion_update_20260906(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION public.crm_operational_source_v1(text,uuid,integer) RENAME TO crm_operational_source_v1_pre_expansion_update_20260906;
ALTER FUNCTION public.crm_operational_source_v1_pre_expansion_update_20260906(text,uuid,integer) SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_v1_pre_expansion_update_20260906(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN (
 'opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch',
 'next_action','activity','quote_version','next_action_complete','stage_check','transition','close','amount',
 'waiting_context','inquiry_reclassify','inquiry_status','inquiry_trash','inquiry_restore','inquiry_purge',
 'inquiry_followup','opportunity_create','lineage_link','attachment_prepare','attachment_complete','expansion_pool_update'
));

ALTER TABLE crm_security.expansion_pool ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE crm_security.expansion_pool ADD CONSTRAINT expansion_pool_version_positive CHECK(version>0);

CREATE TABLE crm_security.expansion_pool_events(
 event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL UNIQUE,
 source_deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE RESTRICT,
 kind text NOT NULL CHECK(kind IN ('status_change','next_contact_change','status_and_next_contact','note')),
 note text,
 before_status text NOT NULL,
 after_status text NOT NULL,
 before_next_contact_at date NOT NULL,
 after_next_contact_at date NOT NULL,
 actor_auth_uid uuid NOT NULL,
 actor_user_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE RESTRICT,
 actor_name text NOT NULL,
 occurred_at timestamptz NOT NULL,
 CONSTRAINT expansion_pool_event_note_shape CHECK((kind='note')=(note IS NOT NULL))
);
CREATE INDEX expansion_pool_events_source_idx ON crm_security.expansion_pool_events(source_deal_id,occurred_at,event_id);
ALTER TABLE crm_security.expansion_pool_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_security.expansion_pool_events FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_expansion_pool_update_command_v1(
 p_request_id uuid,p_source_deal_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a record; prior crm_security.command_receipts%ROWTYPE; oldrow crm_security.expansion_pool%ROWTYPE;
 newrow crm_security.expansion_pool%ROWTYPE; target_status text; target_next date; canonical jsonb;
 event_kind text; event_id_value uuid; audit_id uuid; ack jsonb; server_at timestamptz;
BEGIN
 IF p_request_id IS NULL OR p_source_deal_id IS NULL OR p_expected_version IS NULL OR p_expected_version<1
  OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('expansion_status','next_contact_at'))
  OR NOT p_payload ?& ARRAY['expansion_status','next_contact_at']
  OR jsonb_typeof(p_payload->'expansion_status') IS DISTINCT FROM 'string'
  OR jsonb_typeof(p_payload->'next_contact_at') IS DISTINCT FROM 'string'
 THEN RAISE EXCEPTION 'invalid expansion pool update payload' USING ERRCODE='22023'; END IF;
 target_status:=p_payload->>'expansion_status';
 IF target_status NOT IN ('신규 대상','접촉 예정','관계 관리중','추가 니즈 확인','보류/휴면')
  OR p_payload->>'next_contact_at' !~ '^\d{4}-\d{2}-\d{2}$'
 THEN RAISE EXCEPTION 'invalid expansion pool update value' USING ERRCODE='22023'; END IF;
 BEGIN target_next:=(p_payload->>'next_contact_at')::date;
 EXCEPTION WHEN datetime_field_overflow THEN RAISE EXCEPTION 'invalid expansion next contact date' USING ERRCODE='22023'; END;
 IF target_next::text<>p_payload->>'next_contact_at' THEN RAISE EXCEPTION 'invalid expansion next contact date' USING ERRCODE='22023'; END IF;
 canonical:=jsonb_build_object('expansion_status',target_status,'next_contact_at',target_next);

 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor(); IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.deal_id=p_source_deal_id FOR SHARE;
 IF a.permission_role NOT IN ('rep','branch','admin') OR NOT crm_security.can_deal(p_source_deal_id,true)
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO oldrow FROM crm_security.expansion_pool x WHERE x.source_deal_id=p_source_deal_id FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.deals d WHERE d.id=p_source_deal_id AND d.outcome='won' AND d.stage_code='won' AND d.lifecycle_status='closed')
 THEN RAISE EXCEPTION 'expansion pool state conflict' USING ERRCODE='PT409'; END IF;
 SELECT * INTO prior FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF prior.actor_user_id IS DISTINCT FROM a.user_id OR prior.operation IS DISTINCT FROM 'expansion_pool_update'
   OR prior.object_id IS DISTINCT FROM p_source_deal_id OR prior.expected_version IS DISTINCT FROM p_expected_version
   OR prior.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN prior.ack||jsonb_build_object('replayed',true);
 END IF;
 IF oldrow.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'version conflict' USING ERRCODE='PT409'; END IF;
 IF oldrow.expansion_status=target_status AND oldrow.next_contact_at=target_next
 THEN RAISE EXCEPTION 'expansion pool no-op' USING ERRCODE='PT409'; END IF;
 event_kind:=CASE WHEN oldrow.expansion_status IS DISTINCT FROM target_status AND oldrow.next_contact_at IS DISTINCT FROM target_next THEN 'status_and_next_contact' WHEN oldrow.expansion_status IS DISTINCT FROM target_status THEN 'status_change' ELSE 'next_contact_change' END;
 server_at:=clock_timestamp();
 UPDATE crm_security.expansion_pool SET expansion_status=target_status,next_contact_at=target_next,updated_at=server_at,version=version+1
 WHERE source_deal_id=p_source_deal_id AND version=p_expected_version RETURNING * INTO newrow;
 IF NOT FOUND THEN RAISE EXCEPTION 'unexpected expansion version mutation' USING ERRCODE='PT409'; END IF;
 INSERT INTO crm_security.expansion_pool_events(request_id,source_deal_id,kind,before_status,after_status,before_next_contact_at,after_next_contact_at,actor_auth_uid,actor_user_id,actor_name,occurred_at)
 VALUES(p_request_id,p_source_deal_id,event_kind,oldrow.expansion_status,newrow.expansion_status,oldrow.next_contact_at,newrow.next_contact_at,a.auth_uid,a.user_id,a.display_name,server_at)
 RETURNING event_id INTO event_id_value;
 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,p_source_deal_id,'expansion_pool_update',jsonb_build_object('version',oldrow.version,'expansion_status',oldrow.expansion_status,'next_contact_at',oldrow.next_contact_at),jsonb_build_object('version',newrow.version,'expansion_status',newrow.expansion_status,'next_contact_at',newrow.next_contact_at,'expansion_event_id',event_id_value),event_kind,server_at)
 RETURNING event_id INTO audit_id;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation','expansion_pool_update','object_id',p_source_deal_id,'source_opportunity_id',p_source_deal_id,'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'actor_name',a.display_name,'previous_version',p_expected_version,'version',newrow.version,'expansion_status',newrow.expansion_status,'next_contact_at',newrow.next_contact_at,'kind',event_kind,'expansion_event_id',event_id_value,'audit_event_id',audit_id,'server_at',server_at,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack)
 VALUES(a.auth_uid,p_request_id,a.user_id,'expansion_pool_update',p_source_deal_id,p_expected_version,canonical,ack);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_expansion_pool_update_command_v1(uuid,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_write_command_v2(p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF p_operation='expansion_pool_update' THEN RETURN crm_security.crm_expansion_pool_update_command_v1(p_request_id,p_object_id,p_expected_version,p_payload); END IF;
 RETURN crm_security.crm_write_command_v2_pre_expansion_update_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;

CREATE FUNCTION public.crm_operational_source_v1(p_domain text,p_after uuid DEFAULT NULL,p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE base jsonb; rows jsonb;
BEGIN
 base:=crm_security.crm_operational_source_v1_pre_expansion_update_20260906(p_domain,p_after,p_limit);
 IF p_domain<>'expansion_pool' THEN RETURN base; END IF;
 SELECT coalesce(jsonb_agg(item||jsonb_build_object('version',x.version,'events',coalesce((
   SELECT jsonb_agg(jsonb_build_object('id',e.event_id,'source_opportunity_id',e.source_deal_id,'kind',e.kind,'note',CASE e.kind WHEN 'note' THEN e.note WHEN 'status_change' THEN e.before_status||' → '||e.after_status WHEN 'next_contact_change' THEN '다음 접촉 '||e.before_next_contact_at||' → '||e.after_next_contact_at ELSE e.before_status||' → '||e.after_status||' · 다음 접촉 '||e.after_next_contact_at END,'actor',e.actor_name,'occurred_at',e.occurred_at,'created_at',e.occurred_at) ORDER BY e.occurred_at,e.event_id)
   FROM crm_security.expansion_pool_events e WHERE e.source_deal_id=x.source_deal_id),'[]'::jsonb)) ORDER BY (item->>'id')::uuid),'[]'::jsonb)
 INTO rows FROM jsonb_array_elements(coalesce(base->'items','[]'::jsonb)) item JOIN crm_security.expansion_pool x ON x.source_deal_id=(item->>'id')::uuid;
 RETURN jsonb_set(base,'{items}',rows,false);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) TO authenticated;

DO $post$ BEGIN
 IF has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_expansion_pool_update_command_v1(uuid,uuid,integer,jsonb)','EXECUTE')
  OR has_table_privilege('authenticated','crm_security.expansion_pool_events','SELECT')
  OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='crm_security.expansion_pool_events'::regclass)
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'opportunity_create'::text, 'lineage_link'::text, 'attachment_prepare'::text, 'attachment_complete'::text, 'expansion_pool_update'::text]))$expected$
 THEN RAISE EXCEPTION 'expansion pool update post-apply drift'; END IF;
END $post$;
