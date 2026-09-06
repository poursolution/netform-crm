-- LOCAL REVIEW CANDIDATE ONLY. Separate Staging approval is required.
BEGIN;
SET LOCAL crm.message_log_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='90s';

DO $guard$ BEGIN
 IF current_user<>'postgres' OR current_setting('crm.message_log_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_pre_message_log_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_operational_source_v1_pre_message_log_20260906(text,uuid,integer)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_message_log_command_v1(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regclass('crm_security.message_outcomes') IS NOT NULL
  OR to_regclass('crm_security.quote_versions') IS NULL
  OR to_regclass('crm_security.deal_attachments') IS NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'opportunity_create'::text, 'lineage_link'::text, 'attachment_prepare'::text, 'attachment_complete'::text, 'expansion_pool_update'::text, 'expansion_note'::text, 'customer_support_action'::text]))$expected$
 THEN RAISE EXCEPTION 'message log prerequisite drift'; END IF;
END $guard$;

LOCK TABLE crm_security.command_receipts IN ACCESS EXCLUSIVE MODE;

CREATE TABLE crm_security.message_outcomes(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL UNIQUE,
 deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE RESTRICT,
 contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE RESTRICT,
 person_key text,
 recipient_phone text NOT NULL,
 channel text NOT NULL CHECK(channel IN ('sms','kakao')),
 template_key text NOT NULL,
 template_title text NOT NULL,
 template_kind text NOT NULL CHECK(template_kind IN ('info','promo','mixed')),
 template_grade text,
 purpose text,
 body text NOT NULL,
 message_context text NOT NULL DEFAULT 'deal' CHECK(message_context='deal'),
 quote_version_no integer,
 quote_attachment_id uuid,
 attachment_refs uuid[] NOT NULL DEFAULT '{}',
 status text NOT NULL CHECK(status IN ('sent','failed','cancelled')),
 attestation_kind text NOT NULL DEFAULT 'user_attested' CHECK(attestation_kind='user_attested'),
 actor_auth_uid uuid NOT NULL,
 actor_user_id uuid NOT NULL REFERENCES public.users(user_id),
 actor_name text NOT NULL,
 activity_id uuid REFERENCES public.activities(id),
 next_action_id uuid REFERENCES public.next_actions(id),
 occurred_at timestamptz NOT NULL,
 CHECK(cardinality(attachment_refs)<=10),
 CHECK((status='sent' AND activity_id IS NOT NULL) OR (status<>'sent' AND activity_id IS NULL AND next_action_id IS NULL))
);
CREATE INDEX message_outcomes_deal_time_idx ON crm_security.message_outcomes(deal_id,occurred_at DESC,id DESC);
ALTER TABLE crm_security.message_outcomes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_security.message_outcomes FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation=ANY(ARRAY[
 'opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity','quote_version','next_action_complete','stage_check','transition','close','amount','waiting_context','inquiry_reclassify','inquiry_status','inquiry_trash','inquiry_restore','inquiry_purge','inquiry_followup','opportunity_create','lineage_link','attachment_prepare','attachment_complete','expansion_pool_update','expansion_note','customer_support_action','message_log'
]::text[]));

ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2_pre_message_log_20260906;
ALTER FUNCTION public.crm_write_command_v2_pre_message_log_20260906(uuid,text,uuid,integer,jsonb) SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_pre_message_log_20260906(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_message_log_command_v1(
 p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a record; prior crm_security.command_receipts%ROWTYPE; oldrow public.deals%ROWTYPE; newrow public.deals%ROWTYPE;
 canonical jsonb; ack jsonb; outcome_id uuid; activity_id_value uuid; next_id uuid; audit_id uuid;
 contact_count integer; contact_id_value uuid; person_key_value text; phone_source text; phone_value text; actor_email text; owner_name text;
 channel_value text; template_key_value text; template_title_value text; template_kind_value text; template_grade_value text;
 purpose_value text; body_value text; status_value text; quote_version_value integer; quote_attachment_value uuid; attachment_values uuid[];
 next_requested boolean; next_type text; next_text text; next_due_text text; next_due_value timestamptz; cancelled_ids jsonb:='[]'::jsonb;
 server_at timestamptz; attachment_count integer;
BEGIN
 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0
  OR p_operation IS DISTINCT FROM 'message_log' OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN
   ('person_key','channel','template_key','template_title','template_kind','template_grade','purpose','body','message_context','quote_version_no','quote_attachment_id','attachment_refs','status','next_action_requested','next_action_type','next_action_text','next_due_at'))
  OR NOT p_payload ?& ARRAY['channel','template_key','template_title','template_kind','body','message_context','attachment_refs','status','next_action_requested']
  OR EXISTS(SELECT 1 FROM (VALUES('channel'),('template_key'),('template_title'),('template_kind'),('body'),('message_context'),('status')) v(k)
     WHERE jsonb_typeof(p_payload->v.k) IS DISTINCT FROM 'string')
  OR jsonb_typeof(p_payload->'next_action_requested') IS DISTINCT FROM 'boolean'
  OR EXISTS(SELECT 1 FROM (VALUES('person_key'),('template_grade'),('purpose'),('next_action_type'),('next_action_text'),('next_due_at')) v(k)
     WHERE p_payload ? v.k AND jsonb_typeof(p_payload->v.k) NOT IN ('string','null'))
  OR (p_payload ? 'quote_version_no' AND jsonb_typeof(p_payload->'quote_version_no') NOT IN ('number','null'))
  OR (p_payload ? 'quote_attachment_id' AND jsonb_typeof(p_payload->'quote_attachment_id') NOT IN ('string','null'))
 THEN RAISE EXCEPTION 'invalid message log payload' USING ERRCODE='22023'; END IF;
 channel_value:=p_payload->>'channel'; template_key_value:=btrim(p_payload->>'template_key'); template_title_value:=btrim(p_payload->>'template_title');
 template_kind_value:=p_payload->>'template_kind'; template_grade_value:=nullif(btrim(p_payload->>'template_grade'),''); purpose_value:=nullif(btrim(p_payload->>'purpose'),'');
 body_value:=btrim(p_payload->>'body'); status_value:=p_payload->>'status'; next_requested:=(p_payload->>'next_action_requested')::boolean;
 next_type:=nullif(btrim(p_payload->>'next_action_type'),''); next_text:=nullif(btrim(p_payload->>'next_action_text'),''); next_due_text:=nullif(p_payload->>'next_due_at','');
 quote_version_value:=CASE WHEN jsonb_typeof(p_payload->'quote_version_no')='number' THEN (p_payload->>'quote_version_no')::integer END;
 IF jsonb_typeof(p_payload->'quote_attachment_id')='string' AND p_payload->>'quote_attachment_id'!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
 THEN RAISE EXCEPTION 'invalid quote attachment' USING ERRCODE='22023'; END IF;
 quote_attachment_value:=CASE WHEN jsonb_typeof(p_payload->'quote_attachment_id')='string' THEN (p_payload->>'quote_attachment_id')::uuid END;
 IF jsonb_typeof(p_payload->'attachment_refs') IS DISTINCT FROM 'array' OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'attachment_refs') x WHERE jsonb_typeof(x)<>'string' OR trim(both '"' from x::text)!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
 THEN RAISE EXCEPTION 'invalid attachment refs' USING ERRCODE='22023'; END IF;
 SELECT coalesce(array_agg(x::uuid),'{}'::uuid[]) INTO attachment_values FROM jsonb_array_elements_text(p_payload->'attachment_refs') x;
 IF channel_value NOT IN ('sms','kakao') OR template_kind_value NOT IN ('info','promo','mixed') OR status_value NOT IN ('sent','failed','cancelled')
  OR p_payload->>'message_context'<>'deal' OR length(template_key_value) NOT BETWEEN 1 AND 200 OR length(template_title_value) NOT BETWEEN 1 AND 300
  OR length(body_value) NOT BETWEEN 1 AND 5000 OR (template_grade_value IS NOT NULL AND length(template_grade_value)>100)
  OR (purpose_value IS NOT NULL AND length(purpose_value)>500) OR cardinality(attachment_values)>10 OR (quote_version_value IS NOT NULL AND quote_version_value<1)
  OR (quote_attachment_value IS NOT NULL AND NOT quote_attachment_value=ANY(attachment_values))
  OR (status_value<>'sent' AND next_requested) OR (next_requested AND (next_type IS NULL OR next_text IS NULL OR next_due_text!~'^\d{4}-\d{2}-\d{2}$'))
  OR (NOT next_requested AND (next_type IS NOT NULL OR next_text IS NOT NULL OR next_due_text IS NOT NULL))
 THEN RAISE EXCEPTION 'invalid message log values' USING ERRCODE='22023'; END IF;
 IF next_requested THEN next_due_value:=(next_due_text||' 09:00:00+09')::timestamptz; END IF;
 canonical:=jsonb_build_object('person_key',nullif(btrim(p_payload->>'person_key'),''),'channel',channel_value,'template_key',template_key_value,
  'template_title',template_title_value,'template_kind',template_kind_value,'template_grade',template_grade_value,'purpose',purpose_value,'body',body_value,
  'message_context','deal','quote_version_no',quote_version_value,'quote_attachment_id',quote_attachment_value,'attachment_refs',to_jsonb(attachment_values),
  'status',status_value,'next_action_requested',next_requested,'next_action_type',next_type,'next_action_text',next_text,'next_due_at',next_due_text);
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
  IF prior.actor_user_id IS DISTINCT FROM a.user_id OR prior.operation IS DISTINCT FROM p_operation OR prior.object_id IS DISTINCT FROM p_object_id
   OR prior.expected_version IS DISTINCT FROM p_expected_version OR prior.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN prior.ack||jsonb_build_object('replayed',true);
 END IF;
 IF oldrow.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'version conflict' USING ERRCODE='PT409'; END IF;
 SELECT count(*)::integer,max(c.id::text)::uuid,max(c.person_key),max(coalesce(nullif(c.mobile,''),nullif(c.phone,'')))
 INTO contact_count,contact_id_value,person_key_value,phone_source
 FROM public.contacts c WHERE
  (nullif(btrim(p_payload->>'person_key'),'') IS NULL OR c.person_key=nullif(btrim(p_payload->>'person_key'),''))
  AND (c.id=oldrow.contact_id OR c.person_key=oldrow.person_key OR EXISTS(
   SELECT 1 FROM public.contact_assignments ca WHERE ca.person_key=c.person_key AND ca.opportunity_id=p_object_id AND ca.status='current' AND ca.ended_at IS NULL));
 phone_value:=regexp_replace(coalesce(phone_source,''),'[^0-9]','','g');
 IF contact_count<>1 OR length(phone_value) NOT BETWEEN 10 AND 15 THEN RAISE EXCEPTION 'unique current Deal contact with phone required' USING ERRCODE='22023'; END IF;
 IF quote_version_value IS NOT NULL AND NOT EXISTS(SELECT 1 FROM crm_security.quote_versions q WHERE q.deal_id=p_object_id AND q.version_no=quote_version_value)
 THEN RAISE EXCEPTION 'quote version not found' USING ERRCODE='22023'; END IF;
 SELECT count(*)::integer INTO attachment_count FROM crm_security.deal_attachments f WHERE f.deal_id=p_object_id AND f.status='ready' AND f.attachment_id=ANY(attachment_values);
 IF attachment_count<>cardinality(attachment_values) THEN RAISE EXCEPTION 'ready Deal attachment required' USING ERRCODE='22023'; END IF;
 SELECT u.email INTO actor_email FROM public.users u WHERE u.user_id=a.user_id;
 SELECT u.name INTO owner_name FROM public.users u JOIN crm_security.access_review r ON r.user_id=u.user_id
 WHERE u.user_id=oldrow.owner_id AND u.active AND r.approved AND r.expires_at>now() AND r.permission_role IN ('rep','branch','admin');
 IF actor_email IS NULL OR owner_name IS NULL THEN RAISE EXCEPTION 'approved UUID actor and owner required' USING ERRCODE='42501'; END IF;
 server_at:=clock_timestamp(); outcome_id:=gen_random_uuid();
 IF status_value='sent' THEN
  INSERT INTO public.activities(deal_id,organization_id,actor_email,actor_name,type,detail,occurred_at)
  VALUES(p_object_id,oldrow.organization_id,actor_email,a.display_name,CASE channel_value WHEN 'sms' THEN '문자' ELSE '카카오' END,
   jsonb_build_object('note',template_title_value||' 발송 · '||coalesce(purpose_value,''),'result',body_value,'meaningful_contact',false,'message_outcome_id',outcome_id,'attestation_kind','user_attested','status','sent'),server_at)
  RETURNING id INTO activity_id_value;
  IF next_requested THEN
   SELECT coalesce(jsonb_agg(id ORDER BY created_at,id),'[]'::jsonb) INTO cancelled_ids FROM public.next_actions WHERE deal_id=p_object_id AND status='open';
   UPDATE public.next_actions SET status='cancelled',updated_at=server_at WHERE deal_id=p_object_id AND status='open';
   INSERT INTO public.next_actions(deal_id,action_type,title,due_at,assignee_name,status,source_activity_id,created_at,updated_at)
   VALUES(p_object_id,next_type,next_text,next_due_value,owner_name,'open',activity_id_value,server_at,server_at) RETURNING id INTO next_id;
  END IF;
 END IF;
 INSERT INTO crm_security.message_outcomes(id,request_id,deal_id,contact_id,person_key,recipient_phone,channel,template_key,template_title,template_kind,template_grade,purpose,body,message_context,quote_version_no,quote_attachment_id,attachment_refs,status,attestation_kind,actor_auth_uid,actor_user_id,actor_name,activity_id,next_action_id,occurred_at)
 VALUES(outcome_id,p_request_id,p_object_id,contact_id_value,person_key_value,phone_value,channel_value,template_key_value,template_title_value,template_kind_value,template_grade_value,purpose_value,body_value,'deal',quote_version_value,quote_attachment_value,attachment_values,status_value,'user_attested',a.auth_uid,a.user_id,a.display_name,activity_id_value,next_id,server_at);
 UPDATE public.deals SET
  next_action=CASE WHEN next_requested THEN next_text ELSE next_action END,
  next_action_date=CASE WHEN next_requested THEN next_due_value::date ELSE next_action_date END,
  last_activity_at=CASE WHEN status_value='sent' THEN greatest(last_activity_at,server_at) ELSE last_activity_at END,
  updated_at=server_at,version=version+1
 WHERE id=p_object_id AND version=p_expected_version RETURNING * INTO newrow;
 IF NOT FOUND THEN RAISE EXCEPTION 'unexpected version mutation' USING ERRCODE='PT409'; END IF;
 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,p_object_id,'message_log',jsonb_build_object('version',oldrow.version),
  jsonb_build_object('version',newrow.version,'message_log_id',outcome_id,'attestation_kind','user_attested','status',status_value,'activity_id',activity_id_value,'next_action_id',next_id,'cancelled_action_ids',cancelled_ids),purpose_value,server_at)
 RETURNING event_id INTO audit_id;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'write_id',p_request_id,'operation',p_operation,'object_id',p_object_id,
  'previous_version',p_expected_version,'version',newrow.version,'message_log_id',outcome_id,'attestation_kind','user_attested','user_attested',true,'status',status_value,
  'contact_id',contact_id_value,'person_key',person_key_value,'recipient_phone',phone_value,'activity_id',activity_id_value,'next_action_id',next_id,
  'cancelled_action_ids',cancelled_ids,'audit_event_id',audit_id,'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'actor_name',a.display_name,'server_at',server_at,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack,created_at)
 VALUES(a.auth_uid,p_request_id,a.user_id,p_operation,p_object_id,p_expected_version,canonical,ack,server_at);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_message_log_command_v1(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_write_command_v2(p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF p_operation='message_log' THEN RETURN crm_security.crm_message_log_command_v1(p_request_id,p_operation,p_object_id,p_expected_version,p_payload); END IF;
 RETURN crm_security.crm_write_command_v2_pre_message_log_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;

ALTER FUNCTION public.crm_operational_source_v1(text,uuid,integer) RENAME TO crm_operational_source_v1_pre_message_log_20260906;
ALTER FUNCTION public.crm_operational_source_v1_pre_message_log_20260906(text,uuid,integer) SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_v1_pre_message_log_20260906(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_operational_source_v1(p_domain text,p_after uuid DEFAULT NULL,p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record; items jsonb; has_more boolean; next_cursor text;
BEGIN
 IF p_domain<>'message_log' THEN RETURN crm_security.crm_operational_source_v1_pre_message_log_20260906(p_domain,p_after,p_limit); END IF;
 IF p_limit<1 OR p_limit>100 THEN RAISE EXCEPTION 'invalid operational source limit' USING ERRCODE='22023'; END IF;
 SELECT * INTO a FROM crm_security.actor(); IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(x.item ORDER BY x.id),'[]'::jsonb) INTO items FROM (
  SELECT m.id,jsonb_build_object('id',m.id,'message_log_id',m.id,'opportunity_id',m.deal_id,'contact_id',m.contact_id,'person_key',m.person_key,
   'recipient_phone',m.recipient_phone,'channel',m.channel,'template_key',m.template_key,'template_title',m.template_title,'template_kind',m.template_kind,
   'template_grade',m.template_grade,'purpose',m.purpose,'body',m.body,'message_context',m.message_context,'quote_version_no',m.quote_version_no,
   'quote_attachment_id',m.quote_attachment_id,'attachment_refs',to_jsonb(m.attachment_refs),'status',m.status,'success',m.status='sent',
   'attestation_kind',m.attestation_kind,'user_attested',true,'actor_name',m.actor_name,'activity_id',m.activity_id,'next_action_id',m.next_action_id,
   'occurred_at',m.occurred_at,'sent_at',CASE WHEN m.status='sent' THEN m.occurred_at END,'failed_at',CASE WHEN m.status='failed' THEN m.occurred_at END) item
  FROM crm_security.message_outcomes m WHERE (p_after IS NULL OR m.id>p_after) AND crm_security.can_deal(m.deal_id,false)
  ORDER BY m.id LIMIT p_limit+1
 ) x;
 has_more:=jsonb_array_length(items)>p_limit; IF has_more THEN items:=items-p_limit; END IF;
 next_cursor:=CASE WHEN has_more THEN items->(jsonb_array_length(items)-1)->>'id' END;
 RETURN jsonb_build_object('contract_version',1,'resource','operational_source','domain',p_domain,'scope_completeness','actor_authorized_rows_only','items',items,
  'pagination',jsonb_build_object('completeness',CASE WHEN has_more THEN 'partial' ELSE 'complete' END,'has_more',has_more,'next_cursor',next_cursor));
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) TO authenticated;

DO $post$ BEGIN
 IF has_table_privilege('authenticated','crm_security.message_outcomes','SELECT')
  OR has_function_privilege('authenticated','crm_security.crm_message_log_command_v1(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_write_command_v2_pre_message_log_20260906(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_operational_source_v1_pre_message_log_20260906(text,uuid,integer)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_operational_source_v1(text,uuid,integer)','EXECUTE')
  OR has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('anon','public.crm_operational_source_v1(text,uuid,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'message log post-apply drift'; END IF;
END $post$;
COMMIT;
