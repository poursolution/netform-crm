-- LOCAL REVIEW CANDIDATE ONLY. Separate Staging approval is required.
BEGIN;
SET LOCAL crm.expansion_note_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='90s';

DO $guard$ BEGIN
 IF current_user<>'postgres' OR current_setting('crm.expansion_note_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_expansion_pool_update_command_v1(uuid,uuid,integer,jsonb)') IS NULL
  OR to_regclass('crm_security.expansion_pool') IS NULL OR to_regclass('crm_security.expansion_pool_events') IS NULL
  OR to_regprocedure('public.crm_expansion_note(jsonb)') IS NOT NULL OR to_regprocedure('public.crm_expansion_context(jsonb)') IS NOT NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.expansion_pool_events'::regclass AND conname='expansion_pool_events_kind_check') IS DISTINCT FROM $expected$CHECK (kind = ANY (ARRAY['status_change'::text, 'next_contact_change'::text, 'status_and_next_contact'::text, 'note'::text]))$expected$
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'opportunity_create'::text, 'lineage_link'::text, 'attachment_prepare'::text, 'attachment_complete'::text, 'expansion_pool_update'::text]))$expected$
 THEN RAISE EXCEPTION 'expansion note/context prerequisite drift'; END IF;
END $guard$;

ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN (
 'opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch',
 'next_action','activity','quote_version','next_action_complete','stage_check','transition','close','amount',
 'waiting_context','inquiry_reclassify','inquiry_status','inquiry_trash','inquiry_restore','inquiry_purge',
 'inquiry_followup','opportunity_create','lineage_link','attachment_prepare','attachment_complete',
 'expansion_pool_update','expansion_note'
));

CREATE FUNCTION public.crm_expansion_note(p jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 source_id uuid; request_id_value uuid; note_value text; canonical jsonb; a record;
 pool crm_security.expansion_pool%ROWTYPE; prior crm_security.command_receipts%ROWTYPE;
 event_id_value uuid; audit_id uuid; server_at timestamptz; event_value jsonb; ack jsonb;
BEGIN
 IF jsonb_typeof(p) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p) k WHERE k NOT IN ('source_opportunity_id','note','request_id'))
  OR NOT p ?& ARRAY['source_opportunity_id','note','request_id']
  OR jsonb_typeof(p->'source_opportunity_id') IS DISTINCT FROM 'string'
  OR jsonb_typeof(p->'note') IS DISTINCT FROM 'string'
  OR jsonb_typeof(p->'request_id') IS DISTINCT FROM 'string'
 THEN RAISE EXCEPTION 'invalid expansion note payload' USING ERRCODE='22023'; END IF;
 BEGIN source_id:=(p->>'source_opportunity_id')::uuid; request_id_value:=(p->>'request_id')::uuid;
 EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'invalid expansion note identity' USING ERRCODE='22023'; END;
 note_value:=trim(p->>'note');
 IF length(note_value)<1 OR length(note_value)>8000 THEN RAISE EXCEPTION 'invalid expansion note' USING ERRCODE='22023'; END IF;
 canonical:=jsonb_build_object('note',note_value);
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor(); IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.deal_id=source_id FOR SHARE;
 IF a.permission_role NOT IN ('rep','branch','admin') OR NOT crm_security.can_deal(source_id,true)
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||request_id_value::text,0));
 SELECT * INTO pool FROM crm_security.expansion_pool x WHERE x.source_deal_id=source_id FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.deals d WHERE d.id=source_id AND d.outcome='won' AND d.stage_code='won' AND d.lifecycle_status='closed')
 THEN RAISE EXCEPTION 'expansion pool state conflict' USING ERRCODE='PT409'; END IF;
 SELECT * INTO prior FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=request_id_value;
 IF FOUND THEN
  IF prior.actor_user_id IS DISTINCT FROM a.user_id OR prior.operation IS DISTINCT FROM 'expansion_note' OR prior.object_id IS DISTINCT FROM source_id OR prior.expected_version IS DISTINCT FROM 0 OR prior.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN prior.ack||jsonb_build_object('replayed',true);
 END IF;
 server_at:=clock_timestamp();
 INSERT INTO crm_security.expansion_pool_events(request_id,source_deal_id,kind,note,before_status,after_status,before_next_contact_at,after_next_contact_at,actor_auth_uid,actor_user_id,actor_name,occurred_at)
 VALUES(request_id_value,source_id,'note',note_value,pool.expansion_status,pool.expansion_status,pool.next_contact_at,pool.next_contact_at,a.auth_uid,a.user_id,a.display_name,server_at)
 RETURNING event_id INTO event_id_value;
 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,source_id,'expansion_note',jsonb_build_object('pool_version',pool.version),jsonb_build_object('pool_version',pool.version,'expansion_event_id',event_id_value),note_value,server_at)
 RETURNING event_id INTO audit_id;
 event_value:=jsonb_build_object('id',event_id_value,'source_opportunity_id',source_id,'kind','접촉·니즈 기록','note',note_value,'actor',a.display_name,'created_at',server_at,'occurred_at',server_at);
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',request_id_value,'operation','crm_expansion_note','source_opportunity_id',source_id,'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'event',event_value,'audit_event_id',audit_id,'server_at',server_at,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack)
 VALUES(a.auth_uid,request_id_value,a.user_id,'expansion_note',source_id,0,canonical,ack);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_expansion_note(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_expansion_note(jsonb) TO authenticated;

CREATE FUNCTION public.crm_expansion_context(p jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE source_id uuid; a record; events_value jsonb;
BEGIN
 IF jsonb_typeof(p) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p) k WHERE k<>'source_opportunity_id')
  OR NOT p ? 'source_opportunity_id' OR jsonb_typeof(p->'source_opportunity_id') IS DISTINCT FROM 'string'
 THEN RAISE EXCEPTION 'invalid expansion context payload' USING ERRCODE='22023'; END IF;
 BEGIN source_id:=(p->>'source_opportunity_id')::uuid;
 EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'invalid expansion context identity' USING ERRCODE='22023'; END;
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND OR a.permission_role NOT IN ('rep','branch','admin') OR NOT crm_security.can_deal(source_id,false)
  OR NOT EXISTS(SELECT 1 FROM crm_security.expansion_pool x WHERE x.source_deal_id=source_id)
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.event_id,'source_opportunity_id',e.source_deal_id,'kind',CASE e.kind WHEN 'note' THEN '접촉·니즈 기록' WHEN 'status_change' THEN '상태 변경' WHEN 'next_contact_change' THEN '다음 접촉일 변경' ELSE '상태·다음 접촉일 변경' END,'note',CASE e.kind WHEN 'note' THEN e.note WHEN 'status_change' THEN e.before_status||' → '||e.after_status WHEN 'next_contact_change' THEN '다음 접촉 '||e.before_next_contact_at||' → '||e.after_next_contact_at ELSE e.before_status||' → '||e.after_status||' · 다음 접촉 '||e.after_next_contact_at END,'actor',e.actor_name,'created_at',e.occurred_at,'occurred_at',e.occurred_at) ORDER BY e.occurred_at,e.event_id),'[]'::jsonb)
 INTO events_value FROM crm_security.expansion_pool_events e WHERE e.source_deal_id=source_id;
 RETURN jsonb_build_object('contract_version',1,'ok',true,'source_opportunity_id',source_id,'events',events_value,'dispatches','[]'::jsonb,'dispatch_completeness','unavailable_until_X03');
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_expansion_context(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_expansion_context(jsonb) TO authenticated;

DO $post$ BEGIN
 IF has_function_privilege('anon','public.crm_expansion_note(jsonb)','EXECUTE') OR has_function_privilege('anon','public.crm_expansion_context(jsonb)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_expansion_note(jsonb)','EXECUTE') OR NOT has_function_privilege('authenticated','public.crm_expansion_context(jsonb)','EXECUTE')
  OR has_function_privilege('service_role','public.crm_expansion_note(jsonb)','EXECUTE') OR has_function_privilege('service_role','public.crm_expansion_context(jsonb)','EXECUTE')
  OR has_table_privilege('authenticated','crm_security.expansion_pool_events','SELECT')
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'opportunity_create'::text, 'lineage_link'::text, 'attachment_prepare'::text, 'attachment_complete'::text, 'expansion_pool_update'::text, 'expansion_note'::text]))$expected$
 THEN RAISE EXCEPTION 'expansion note/context post-apply drift'; END IF;
END $post$;
COMMIT;
