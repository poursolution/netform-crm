-- LOCAL VALIDATION CANDIDATE ONLY. Not a Production migration or public endpoint.
-- Reuse the existing private activity/next-action contracts inside ONE transaction.
BEGIN;
DO $guard$ BEGIN
 IF current_setting('crm.relationship_contact_lab', true) IS DISTINCT FROM 'local-only'
  OR to_regprocedure('crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb)') IS NULL
 THEN RAISE EXCEPTION 'local relationship contact prerequisite missing'; END IF;
END $guard$;

CREATE FUNCTION crm_security.crm_relationship_contact_candidate(
 p_request_id uuid, p_object_id uuid, p_expected_version integer, p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a record; d public.deals%ROWTYPE;
 activity_request uuid; next_request uuid;
 activity_ack jsonb; next_ack jsonb;
 prior_count integer; due_value date; occurred_value timestamptz;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.users WHERE auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review WHERE reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version IS NULL
  OR p_expected_version<0 OR p_expected_version>2147483645
  OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR NOT p_payload ?& ARRAY['activity','next_action']
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('activity','next_action'))
  OR jsonb_typeof(p_payload->'activity') IS DISTINCT FROM 'object'
  OR jsonb_typeof(p_payload->'next_action') IS DISTINCT FROM 'object'
 THEN RAISE EXCEPTION 'invalid relationship contact envelope' USING ERRCODE='22023'; END IF;
 -- Contact truth must be explicit: a phone attempt must not advance last contact.
 IF jsonb_typeof(p_payload->'activity'->'meaningful_contact') IS DISTINCT FROM 'boolean'
  OR (p_payload->'next_action') ? 'assignee'
 THEN RAISE EXCEPTION 'explicit contact outcome and current owner required' USING ERRCODE='22023'; END IF;
 BEGIN
  occurred_value:=(p_payload->'activity'->>'occurred_at')::timestamptz;
  due_value:=(p_payload->'next_action'->>'due_at')::date;
 EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN
  RAISE EXCEPTION 'invalid contact date' USING ERRCODE='22023';
 END;
 IF occurred_value IS NULL OR NOT isfinite(occurred_value) OR due_value IS NULL
  OR NOT isfinite(due_value) OR due_value < (occurred_value AT TIME ZONE 'Asia/Seoul')::date
 THEN RAISE EXCEPTION 'next contact precedes contact record' USING ERRCODE='22023'; END IF;

 PERFORM 1 FROM crm_security.object_scope WHERE user_id=a.user_id AND deal_id=p_object_id FOR SHARE;
 SELECT * INTO d FROM public.deals WHERE id=p_object_id FOR UPDATE;
 IF NOT FOUND OR NOT crm_security.can_deal(p_object_id,true)
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 -- Stable child IDs make a lost-response retry reuse BOTH durable receipts.
 activity_request:=md5('relationship-contact:activity:'||p_request_id::text)::uuid;
 next_request:=md5('relationship-contact:next:'||p_request_id::text)::uuid;
 PERFORM pg_advisory_xact_lock(hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT count(*) INTO prior_count FROM crm_security.command_receipts
  WHERE actor_auth_uid=a.auth_uid AND request_id IN (activity_request,next_request);
 IF prior_count=1 THEN RAISE EXCEPTION 'incomplete contact receipt pair' USING ERRCODE='PT409'; END IF;
 IF prior_count=0 THEN
  IF d.version IS DISTINCT FROM p_expected_version THEN
   RAISE EXCEPTION 'version conflict' USING ERRCODE='PT409'; END IF;
  IF d.stage_code NOT IN ('rapport','silent','waiting') OR d.stage_code IS NULL
   OR d.outcome IS NOT NULL OR d.lifecycle_status='closed'
  THEN RAISE EXCEPTION 'not an open relationship deal' USING ERRCODE='22023'; END IF;
  -- Do not silently cancel several independent scheduled jobs through the base helper.
  PERFORM 1 FROM public.next_actions WHERE deal_id=p_object_id AND status='open' FOR UPDATE;
  IF (SELECT count(*) FROM public.next_actions WHERE deal_id=p_object_id AND status='open')>1 THEN
   RAISE EXCEPTION 'multiple open actions require explicit resolution' USING ERRCODE='PT409'; END IF;
 END IF;
 activity_ack:=crm_security.crm_pipeline_action_command_v1(
  activity_request,'activity',p_object_id,p_expected_version,p_payload->'activity');
 next_ack:=crm_security.crm_pipeline_action_command_v1(
  next_request,'next_action',p_object_id,p_expected_version+1,p_payload->'next_action');
 -- No exception is swallowed: failure of the second write rolls back the first too.
 IF (activity_ack->>'replayed')::boolean IS DISTINCT FROM (next_ack->>'replayed')::boolean THEN
  RAISE EXCEPTION 'inconsistent contact receipts' USING ERRCODE='PT409'; END IF;
 IF NOT (next_ack->>'replayed')::boolean THEN
  UPDATE public.next_actions SET source_activity_id=(activity_ack->>'activity_id')::uuid
   WHERE id=(next_ack->>'next_action_id')::uuid AND deal_id=p_object_id;
 END IF;
 RETURN jsonb_build_object('ok',true,'operation','relationship_contact','contract_version',1,
  'request_id',p_request_id,'object_id',p_object_id,'previous_version',p_expected_version,
  'version',(next_ack->>'version')::integer,'replayed',(next_ack->>'replayed')::boolean,
  'activity_id',activity_ack->'activity_id','next_action_id',next_ack->'next_action_id',
  'activity_request_id',activity_request,'next_request_id',next_request,
  'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id);
END $fn$;
REVOKE ALL ON FUNCTION crm_security.crm_relationship_contact_candidate(uuid,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
