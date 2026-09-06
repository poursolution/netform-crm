SET LOCAL crm.relationship_cadence_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='90s';

DO $guard$ BEGIN
 IF current_user<>'postgres' OR current_setting('crm.relationship_cadence_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_pre_relationship_cadence_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_operational_source_v1_pre_relationship_cadence_20260906(text,uuid,integer)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_relationship_cadence_command_v1(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regclass('crm_security.message_outcomes') IS NULL OR to_regclass('crm_security.relationship_events') IS NOT NULL
  OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='crm_security' AND table_name='message_outcomes' AND column_name IN ('response_at','response_kind','response_activity_id'))
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'opportunity_create'::text, 'lineage_link'::text, 'attachment_prepare'::text, 'attachment_complete'::text, 'expansion_pool_update'::text, 'expansion_note'::text, 'customer_support_action'::text, 'message_log'::text]))$expected$
 THEN RAISE EXCEPTION 'relationship cadence prerequisite drift'; END IF;
END $guard$;

LOCK TABLE crm_security.command_receipts IN ACCESS EXCLUSIVE MODE;
ALTER TABLE crm_security.message_outcomes ADD COLUMN response_at timestamptz,ADD COLUMN response_kind text,ADD COLUMN response_activity_id uuid REFERENCES public.activities(id);
CREATE TABLE crm_security.relationship_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),request_id uuid NOT NULL UNIQUE,
 deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE RESTRICT,
 contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE RESTRICT,person_key text,
 event_kind text NOT NULL CHECK(event_kind IN ('hold','response')),
 message_outcome_id uuid REFERENCES crm_security.message_outcomes(id) ON DELETE RESTRICT,
 activity_id uuid REFERENCES public.activities(id),next_action_id uuid REFERENCES public.next_actions(id),
 hold_until date,reason text,actor_auth_uid uuid NOT NULL,actor_user_id uuid NOT NULL REFERENCES public.users(user_id),actor_name text NOT NULL,
 business_at timestamptz NOT NULL,created_at timestamptz NOT NULL,
 CHECK((event_kind='hold' AND hold_until IS NOT NULL AND message_outcome_id IS NULL AND activity_id IS NULL AND next_action_id IS NOT NULL)
    OR (event_kind='response' AND hold_until IS NULL AND message_outcome_id IS NOT NULL AND activity_id IS NOT NULL))
);
CREATE INDEX relationship_events_deal_time_idx ON crm_security.relationship_events(deal_id,business_at DESC,id DESC);
ALTER TABLE crm_security.relationship_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_security.relationship_events FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation=ANY(ARRAY[
 'opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity','quote_version','next_action_complete','stage_check','transition','close','amount','waiting_context','inquiry_reclassify','inquiry_status','inquiry_trash','inquiry_restore','inquiry_purge','inquiry_followup','opportunity_create','lineage_link','attachment_prepare','attachment_complete','expansion_pool_update','expansion_note','customer_support_action','message_log','relationship_hold','relationship_response'
]::text[]));
ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2_pre_relationship_cadence_20260906;
ALTER FUNCTION public.crm_write_command_v2_pre_relationship_cadence_20260906(uuid,text,uuid,integer,jsonb) SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_pre_relationship_cadence_20260906(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_relationship_cadence_command_v1(p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record; prior crm_security.command_receipts%ROWTYPE; oldrow public.deals%ROWTYPE; newrow public.deals%ROWTYPE;
 canonical jsonb; ack jsonb; event_id uuid:=gen_random_uuid(); contact_count integer; contact_id_value uuid; person_key_value text;
 server_at timestamptz; business_at timestamptz; owner_name text; actor_email text; next_id uuid; activity_id_value uuid; audit_id uuid;
 hold_value date; reason_value text; next_type text; next_text text; next_due date; cancelled_ids jsonb:='[]'::jsonb;
 response_kind_value text; activity_type_value text; activity_note_value text; activity_result_value text; outcome_id uuid; linked_next_id uuid; linked_cancel_count integer:=0; linked_cancelled boolean:=false;
BEGIN
 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0 OR p_operation NOT IN ('relationship_hold','relationship_response') OR jsonb_typeof(p_payload)<>'object'
 THEN RAISE EXCEPTION 'invalid relationship command' USING ERRCODE='22023'; END IF;
 IF p_operation='relationship_hold' THEN
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('person_key','hold_until','reason','next_action_type','next_action_text','next_due_at'))
   OR NOT p_payload ?& ARRAY['hold_until','reason','next_action_type','next_action_text','next_due_at']
   OR EXISTS(SELECT 1 FROM (VALUES('hold_until'),('reason'),('next_action_type'),('next_action_text'),('next_due_at')) v(k) WHERE jsonb_typeof(p_payload->v.k)<>'string')
  THEN RAISE EXCEPTION 'invalid relationship hold payload' USING ERRCODE='22023'; END IF;
  hold_value:=(p_payload->>'hold_until')::date;reason_value:=btrim(p_payload->>'reason');next_type:=btrim(p_payload->>'next_action_type');next_text:=btrim(p_payload->>'next_action_text');next_due:=(p_payload->>'next_due_at')::date;
  IF p_payload->>'hold_until'!~'^\d{4}-\d{2}-\d{2}$' OR p_payload->>'next_due_at'!~'^\d{4}-\d{2}-\d{2}$' OR hold_value<>next_due OR length(reason_value) NOT BETWEEN 1 AND 2000 OR length(next_type) NOT BETWEEN 1 AND 100 OR length(next_text) NOT BETWEEN 1 AND 500
  THEN RAISE EXCEPTION 'invalid relationship hold values' USING ERRCODE='22023'; END IF;
  canonical:=jsonb_build_object('person_key',nullif(btrim(p_payload->>'person_key'),''),'hold_until',hold_value,'reason',reason_value,'next_action_type',next_type,'next_action_text',next_text,'next_due_at',next_due);
 ELSE
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('person_key','response_kind','activity_type','activity_note','activity_result','activity_occurred_at','cancel_pending_cadence'))
   OR NOT p_payload ?& ARRAY['response_kind','activity_type','activity_note','activity_result','activity_occurred_at','cancel_pending_cadence']
   OR EXISTS(SELECT 1 FROM (VALUES('response_kind'),('activity_type'),('activity_note'),('activity_result'),('activity_occurred_at')) v(k) WHERE jsonb_typeof(p_payload->v.k)<>'string')
   OR jsonb_typeof(p_payload->'cancel_pending_cadence')<>'boolean' OR (p_payload->>'cancel_pending_cadence')::boolean IS NOT TRUE
  THEN RAISE EXCEPTION 'invalid relationship response payload' USING ERRCODE='22023'; END IF;
  response_kind_value:=btrim(p_payload->>'response_kind');activity_type_value:=btrim(p_payload->>'activity_type');activity_note_value:=btrim(p_payload->>'activity_note');activity_result_value:=btrim(p_payload->>'activity_result');
  business_at:=(p_payload->>'activity_occurred_at')::timestamptz;
  IF length(response_kind_value) NOT BETWEEN 1 AND 100 OR activity_type_value<>response_kind_value OR length(activity_note_value) NOT BETWEEN 1 AND 4000 OR length(activity_result_value)>8000
  THEN RAISE EXCEPTION 'invalid relationship response values' USING ERRCODE='22023'; END IF;
  canonical:=jsonb_build_object('person_key',nullif(btrim(p_payload->>'person_key'),''),'response_kind',response_kind_value,'activity_type',activity_type_value,'activity_note',activity_note_value,'activity_result',activity_result_value,'activity_occurred_at',business_at,'cancel_pending_cadence',true);
 END IF;
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();IF NOT FOUND OR a.permission_role NOT IN ('rep','branch','admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.deal_id=p_object_id FOR SHARE;
 SELECT * INTO oldrow FROM public.deals WHERE id=p_object_id FOR UPDATE;IF NOT FOUND OR NOT crm_security.can_deal(p_object_id,true) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT count(*)::integer,max(c.id::text)::uuid,max(c.person_key) INTO contact_count,contact_id_value,person_key_value FROM public.contacts c
 WHERE (nullif(btrim(p_payload->>'person_key'),'') IS NULL OR c.person_key=nullif(btrim(p_payload->>'person_key'),''))
 AND (c.id=oldrow.contact_id OR c.person_key=oldrow.person_key OR EXISTS(SELECT 1 FROM public.contact_assignments ca WHERE ca.person_key=c.person_key AND ca.opportunity_id=p_object_id AND ca.status='current' AND ca.ended_at IS NULL));
 IF contact_count<>1 THEN RAISE EXCEPTION 'unique current Deal contact required' USING ERRCODE='22023'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO prior FROM crm_security.command_receipts WHERE actor_auth_uid=a.auth_uid AND request_id=p_request_id;
 IF FOUND THEN
  IF prior.actor_user_id IS DISTINCT FROM a.user_id OR prior.operation IS DISTINCT FROM p_operation OR prior.object_id IS DISTINCT FROM p_object_id OR prior.expected_version IS DISTINCT FROM p_expected_version OR prior.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;RETURN prior.ack||jsonb_build_object('replayed',true);
 END IF;
 IF oldrow.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'version conflict' USING ERRCODE='PT409'; END IF;
 SELECT u.email INTO actor_email FROM public.users u WHERE u.user_id=a.user_id;
 SELECT u.name INTO owner_name FROM public.users u JOIN crm_security.access_review r ON r.user_id=u.user_id WHERE u.user_id=oldrow.owner_id AND u.active AND r.approved AND r.expires_at>now() AND r.permission_role IN ('rep','branch','admin');
 IF actor_email IS NULL OR owner_name IS NULL THEN RAISE EXCEPTION 'approved UUID actor and owner required' USING ERRCODE='42501'; END IF;
 server_at:=clock_timestamp();
 IF p_operation='relationship_hold' THEN
  IF hold_value<=((server_at AT TIME ZONE 'Asia/Seoul')::date) THEN RAISE EXCEPTION 'hold date must be future' USING ERRCODE='22023'; END IF;
  SELECT coalesce(jsonb_agg(id ORDER BY created_at,id),'[]'::jsonb) INTO cancelled_ids FROM public.next_actions WHERE deal_id=p_object_id AND status='open';
  UPDATE public.next_actions SET status='cancelled',updated_at=server_at WHERE deal_id=p_object_id AND status='open';
  INSERT INTO public.next_actions(deal_id,action_type,title,due_at,assignee_name,status,created_at,updated_at) VALUES(p_object_id,next_type,next_text,(next_due::text||' 09:00:00+09')::timestamptz,owner_name,'open',server_at,server_at) RETURNING id INTO next_id;
  business_at:=server_at;
 ELSE
  IF business_at>server_at+interval '5 minutes' OR business_at<server_at-interval '10 years' THEN RAISE EXCEPTION 'activity time out of range' USING ERRCODE='22023'; END IF;
  SELECT m.id,m.next_action_id INTO outcome_id,linked_next_id FROM crm_security.message_outcomes m
   WHERE m.deal_id=p_object_id AND m.contact_id=contact_id_value AND m.status='sent' AND m.response_at IS NULL AND m.occurred_at<=business_at
   ORDER BY m.occurred_at DESC,m.id DESC LIMIT 1 FOR UPDATE;
  IF outcome_id IS NULL THEN RAISE EXCEPTION 'unresponded user-attested message required' USING ERRCODE='22023'; END IF;
  INSERT INTO public.activities(deal_id,organization_id,actor_email,actor_name,type,detail,occurred_at)
   VALUES(p_object_id,oldrow.organization_id,actor_email,a.display_name,activity_type_value,jsonb_build_object('note',activity_note_value,'result',activity_result_value,'meaningful_contact',true,'message_outcome_id',outcome_id,'relationship_event_id',event_id),business_at)
   RETURNING id INTO activity_id_value;
  IF linked_next_id IS NOT NULL THEN UPDATE public.next_actions SET status='cancelled',updated_at=server_at WHERE id=linked_next_id AND deal_id=p_object_id AND status='open';GET DIAGNOSTICS linked_cancel_count=ROW_COUNT;linked_cancelled:=linked_cancel_count=1;END IF;
  UPDATE crm_security.message_outcomes SET response_at=business_at,response_kind=response_kind_value,response_activity_id=activity_id_value WHERE id=outcome_id;
 END IF;
 INSERT INTO crm_security.relationship_events(id,request_id,deal_id,contact_id,person_key,event_kind,message_outcome_id,activity_id,next_action_id,hold_until,reason,actor_auth_uid,actor_user_id,actor_name,business_at,created_at)
 VALUES(event_id,p_request_id,p_object_id,contact_id_value,person_key_value,CASE WHEN p_operation='relationship_hold' THEN 'hold' ELSE 'response' END,outcome_id,activity_id_value,CASE WHEN p_operation='relationship_hold' THEN next_id ELSE linked_next_id END,hold_value,reason_value,a.auth_uid,a.user_id,a.display_name,business_at,server_at);
 UPDATE public.deals SET wake_up_at=CASE WHEN p_operation='relationship_hold' THEN (hold_value::text||' 09:00:00+09')::timestamptz ELSE wake_up_at END,
  next_action=CASE WHEN p_operation='relationship_hold' THEN next_text WHEN linked_cancelled THEN NULL ELSE next_action END,
  next_action_date=CASE WHEN p_operation='relationship_hold' THEN next_due WHEN linked_cancelled THEN NULL ELSE next_action_date END,
  last_activity_at=CASE WHEN p_operation='relationship_response' THEN greatest(last_activity_at,business_at) ELSE last_activity_at END,
  last_customer_contact_at=CASE WHEN p_operation='relationship_response' THEN greatest(last_customer_contact_at,business_at) ELSE last_customer_contact_at END,
  updated_at=server_at,version=version+1 WHERE id=p_object_id AND version=p_expected_version RETURNING * INTO newrow;
 IF NOT FOUND THEN RAISE EXCEPTION 'unexpected version mutation' USING ERRCODE='PT409'; END IF;
 INSERT INTO crm_security.audit_events AS ae(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,p_object_id,p_operation,jsonb_build_object('version',oldrow.version,'wake_up_at',oldrow.wake_up_at),jsonb_build_object('version',newrow.version,'relationship_event_id',event_id,'message_outcome_id',outcome_id,'activity_id',activity_id_value,'next_action_id',next_id,'linked_next_action_id',linked_next_id,'linked_next_cancelled',linked_cancelled,'cancelled_action_ids',cancelled_ids,'hold_until',hold_value),coalesce(reason_value,response_kind_value),server_at) RETURNING ae.event_id INTO audit_id;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'write_id',p_request_id,'operation',p_operation,'object_id',p_object_id,'previous_version',p_expected_version,'version',newrow.version,
  'relationship_event_id',event_id,'contact_id',contact_id_value,'person_key',person_key_value,'hold_until',hold_value,'message_log_id',outcome_id,'activity_id',activity_id_value,'next_action_id',coalesce(next_id,linked_next_id),'linked_next_cancelled',linked_cancelled,'cancelled_action_ids',cancelled_ids,'audit_event_id',audit_id,'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'actor_name',a.display_name,'business_at',business_at,'server_at',server_at,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack,created_at) VALUES(a.auth_uid,p_request_id,a.user_id,p_operation,p_object_id,p_expected_version,canonical,ack,server_at);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_relationship_cadence_command_v1(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_write_command_v2(p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN IF p_operation IN ('relationship_hold','relationship_response') THEN RETURN crm_security.crm_relationship_cadence_command_v1(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);END IF;RETURN crm_security.crm_write_command_v2_pre_relationship_cadence_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,service_role;GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;

ALTER FUNCTION public.crm_operational_source_v1(text,uuid,integer) RENAME TO crm_operational_source_v1_pre_relationship_cadence_20260906;
ALTER FUNCTION public.crm_operational_source_v1_pre_relationship_cadence_20260906(text,uuid,integer) SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_v1_pre_relationship_cadence_20260906(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.crm_operational_source_v1(p_domain text,p_after uuid DEFAULT NULL,p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE base jsonb; projected jsonb;
BEGIN
 base:=crm_security.crm_operational_source_v1_pre_relationship_cadence_20260906(p_domain,p_after,p_limit);
 IF p_domain='message_log' THEN
  SELECT coalesce(jsonb_agg(i.item||jsonb_build_object('response_at',m.response_at,'response_kind',m.response_kind,'response_activity_id',m.response_activity_id) ORDER BY i.ord),'[]'::jsonb) INTO projected
  FROM jsonb_array_elements(base->'items') WITH ORDINALITY i(item,ord) LEFT JOIN crm_security.message_outcomes m ON m.id=(i.item->>'id')::uuid;
  RETURN jsonb_set(base,'{items}',projected);
 ELSIF p_domain='deal_core' THEN
  SELECT coalesce(jsonb_agg(i.item||jsonb_build_object(
   'last_outbound_at',(SELECT max(m.occurred_at) FROM crm_security.message_outcomes m WHERE m.deal_id=(i.item->>'id')::uuid AND m.status='sent'),
   'last_customer_response_at',(SELECT max(m.response_at) FROM crm_security.message_outcomes m WHERE m.deal_id=(i.item->>'id')::uuid),
   'outbound_attempts',(SELECT count(*)::integer FROM crm_security.message_outcomes m WHERE m.deal_id=(i.item->>'id')::uuid AND m.status='sent' AND m.occurred_at>coalesce((SELECT max(x.response_at) FROM crm_security.message_outcomes x WHERE x.deal_id=m.deal_id),'-infinity'::timestamptz)),
   'relationship_state',coalesce((SELECT CASE e.event_kind WHEN 'hold' THEN 'hold' ELSE 'active' END FROM crm_security.relationship_events e WHERE e.deal_id=(i.item->>'id')::uuid ORDER BY e.business_at DESC,e.id DESC LIMIT 1),'active'),
   'relationship_hold_until',(SELECT e.hold_until FROM crm_security.relationship_events e WHERE e.deal_id=(i.item->>'id')::uuid AND e.event_kind='hold' ORDER BY e.business_at DESC,e.id DESC LIMIT 1),
   'waiting_reason',(SELECT e.reason FROM crm_security.relationship_events e WHERE e.deal_id=(i.item->>'id')::uuid AND e.event_kind='hold' ORDER BY e.business_at DESC,e.id DESC LIMIT 1)
  ) ORDER BY i.ord),'[]'::jsonb) INTO projected FROM jsonb_array_elements(base->'items') WITH ORDINALITY i(item,ord);
  RETURN jsonb_set(base,'{items}',projected);
 END IF;RETURN base;
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) FROM PUBLIC,anon,service_role;GRANT EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) TO authenticated;

DO $post$ BEGIN
 IF has_table_privilege('authenticated','crm_security.relationship_events','SELECT') OR has_function_privilege('authenticated','crm_security.crm_relationship_cadence_command_v1(uuid,text,uuid,integer,jsonb)','EXECUTE')
 OR has_function_privilege('authenticated','crm_security.crm_write_command_v2_pre_relationship_cadence_20260906(uuid,text,uuid,integer,jsonb)','EXECUTE') OR has_function_privilege('authenticated','crm_security.crm_operational_source_v1_pre_relationship_cadence_20260906(text,uuid,integer)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') OR NOT has_function_privilege('authenticated','public.crm_operational_source_v1(text,uuid,integer)','EXECUTE')
 OR has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') OR has_function_privilege('anon','public.crm_operational_source_v1(text,uuid,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'relationship cadence post-apply drift';END IF;
END $post$;
