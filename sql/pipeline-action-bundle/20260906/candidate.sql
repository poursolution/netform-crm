-- LOCAL CANDIDATE ONLY. Adds private helpers; does not alter the public Dispatcher.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';

DO $guard$ BEGIN
 IF current_setting('crm.pipeline_action_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.command_receipts'::regclass
       AND conname='command_receipts_operation_check')
     IS DISTINCT FROM 'CHECK (operation = ANY (ARRAY[''opportunity_work_set''::text, ''inquiry_assign''::text, ''service_change''::text, ''inquiry_unassign''::text]))'
 THEN RAISE EXCEPTION 'pipeline action local prerequisite drift'; END IF;
END $guard$;

ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check
 CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','next_action','activity'));

CREATE FUNCTION crm_security.crm_pipeline_action_command_v1(
 p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a record; receipt crm_security.command_receipts%ROWTYPE;
 oldrow public.deals%ROWTYPE; newrow public.deals%ROWTYPE;
 canonical jsonb; ack jsonb; event uuid; created_id uuid;
 type_value text; text_value text; result_value text; assignee_value text;
 due_value date; occurred_value timestamptz; meaningful_value boolean;
 actor_email_value text; changed_at_value timestamptz;
 cancelled_ids jsonb:='[]'::jsonb;
BEGIN
 IF p_operation NOT IN ('next_action','activity') THEN
  RAISE EXCEPTION 'operation not handled by pipeline action helper' USING ERRCODE='22023';
 END IF;
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0
  OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
 THEN RAISE EXCEPTION 'invalid pipeline action envelope' USING ERRCODE='22023'; END IF;

 IF p_operation='next_action' THEN
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('type','text','due_at','assignee'))
   OR NOT p_payload ?& ARRAY['type','text','due_at']
   OR jsonb_typeof(p_payload->'type') IS DISTINCT FROM 'string'
   OR length(trim(p_payload->>'type'))<1 OR length(p_payload->>'type')>100
   OR jsonb_typeof(p_payload->'text') IS DISTINCT FROM 'string'
   OR length(trim(p_payload->>'text'))<1 OR length(p_payload->>'text')>500
   OR jsonb_typeof(p_payload->'due_at') IS DISTINCT FROM 'string'
   OR p_payload->>'due_at' !~ '^\d{4}-\d{2}-\d{2}$'
   OR (p_payload ? 'assignee' AND jsonb_typeof(p_payload->'assignee') NOT IN ('string','null'))
   OR (jsonb_typeof(p_payload->'assignee')='string' AND
       (length(trim(p_payload->>'assignee'))<1 OR length(p_payload->>'assignee')>100))
  THEN RAISE EXCEPTION 'invalid next_action base payload' USING ERRCODE='22023'; END IF;
  BEGIN due_value:=(p_payload->>'due_at')::date;
  EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN
   RAISE EXCEPTION 'invalid next_action due date' USING ERRCODE='22023'; END;
  type_value:=trim(p_payload->>'type'); text_value:=trim(p_payload->>'text');
  assignee_value:=nullif(trim(p_payload->>'assignee'),'');
  canonical:=jsonb_build_object('type',type_value,'text',text_value,'due_at',due_value::text)
   ||CASE WHEN assignee_value IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('assignee',assignee_value) END;
 ELSE
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('type','note','result','occurred_at','meaningful_contact'))
   OR NOT p_payload ?& ARRAY['type','note','occurred_at']
   OR jsonb_typeof(p_payload->'type') IS DISTINCT FROM 'string'
   OR length(trim(p_payload->>'type'))<1 OR length(p_payload->>'type')>100
   OR jsonb_typeof(p_payload->'note') IS DISTINCT FROM 'string'
   OR length(trim(p_payload->>'note'))<1 OR length(p_payload->>'note')>4000
   OR (p_payload ? 'result' AND jsonb_typeof(p_payload->'result') NOT IN ('string','null'))
   OR length(coalesce(p_payload->>'result',''))>8000
   OR jsonb_typeof(p_payload->'occurred_at') IS DISTINCT FROM 'string'
   OR (p_payload ? 'meaningful_contact' AND jsonb_typeof(p_payload->'meaningful_contact')<>'boolean')
  THEN RAISE EXCEPTION 'invalid activity base payload' USING ERRCODE='22023'; END IF;
  BEGIN occurred_value:=(p_payload->>'occurred_at')::timestamptz;
  EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN
   RAISE EXCEPTION 'invalid activity occurred_at' USING ERRCODE='22023'; END;
  IF NOT isfinite(occurred_value) THEN RAISE EXCEPTION 'invalid activity occurred_at' USING ERRCODE='22023'; END IF;
  type_value:=trim(p_payload->>'type'); text_value:=trim(p_payload->>'note');
  result_value:=trim(coalesce(p_payload->>'result',''));
  meaningful_value:=CASE WHEN p_payload ? 'meaningful_contact' THEN (p_payload->>'meaningful_contact')::boolean
   WHEN type_value||' '||text_value||' '||result_value ~ '전화\s*시도|작성\s*시작|발송|카카오톡\s*연락\s*준비|부재|못\s*받|무응답|수신거부|실패' THEN false
   ELSE type_value||' '||text_value||' '||result_value ~ '통화\s*완료|통화\s*[—-]\s*진행|고객\s*요청|회신|답변|응답|면담|미팅|현장\s*방문|방문\s*완료|자료\s*수신|문의\s*접수' END;
  canonical:=jsonb_build_object('type',type_value,'note',text_value,'result',result_value,
   'occurred_at',p_payload->>'occurred_at','meaningful_contact',meaningful_value);
 END IF;

 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.deal_id=p_object_id FOR SHARE;
 SELECT * INTO oldrow FROM public.deals d WHERE d.id=p_object_id FOR UPDATE;
 IF NOT FOUND OR a.permission_role NOT IN ('rep','branch','admin') OR NOT crm_security.can_deal(p_object_id,true)
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM p_operation
   OR receipt.object_id IS DISTINCT FROM p_object_id OR receipt.expected_version IS DISTINCT FROM p_expected_version
   OR receipt.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;
 IF oldrow.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'version conflict' USING ERRCODE='PT409'; END IF;
 changed_at_value:=clock_timestamp();

 IF p_operation='next_action' THEN
  IF assignee_value IS NULL THEN
   SELECT u.name INTO assignee_value FROM public.users u JOIN crm_security.access_review r ON r.user_id=u.user_id
    WHERE u.user_id=oldrow.owner_id AND u.active AND r.approved AND r.expires_at>now()
      AND r.permission_role IN ('rep','branch','admin');
  ELSE
   IF (SELECT count(*) FROM public.users u JOIN crm_security.access_review r ON r.user_id=u.user_id
       WHERE u.name=assignee_value AND u.active AND r.approved AND r.expires_at>now()
        AND r.permission_role IN ('rep','branch','admin'))<>1
   THEN RAISE EXCEPTION 'invalid next action assignee' USING ERRCODE='22023'; END IF;
  END IF;
  IF assignee_value IS NULL THEN RAISE EXCEPTION 'No approved UUID owner' USING ERRCODE='42501'; END IF;
  SELECT coalesce(jsonb_agg(id ORDER BY created_at),'[]'::jsonb) INTO cancelled_ids
   FROM public.next_actions WHERE deal_id=p_object_id AND status='open';
  UPDATE public.next_actions SET status='cancelled',updated_at=changed_at_value
   WHERE deal_id=p_object_id AND status='open';
  INSERT INTO public.next_actions(deal_id,action_type,title,due_at,assignee_name,status,created_at,updated_at)
  VALUES(p_object_id,type_value,text_value,due_value::timestamp AT TIME ZONE 'UTC',assignee_value,'open',changed_at_value,changed_at_value)
  RETURNING id INTO created_id;
  UPDATE public.deals SET next_action=text_value,next_action_date=due_value,updated_at=changed_at_value,version=version+1
   WHERE id=p_object_id AND version=p_expected_version RETURNING * INTO newrow;
 ELSE
  SELECT u.email INTO actor_email_value FROM public.users u WHERE u.user_id=a.user_id;
  INSERT INTO public.activities(deal_id,organization_id,actor_email,actor_name,type,detail,occurred_at)
  VALUES(p_object_id,oldrow.organization_id,actor_email_value,a.display_name,type_value,
   jsonb_build_object('note',text_value,'result',result_value,'meaningful_contact',meaningful_value),occurred_value)
  RETURNING id INTO created_id;
  UPDATE public.deals SET last_activity_at=greatest(last_activity_at,occurred_value),
   last_customer_contact_at=CASE WHEN meaningful_value THEN greatest(last_customer_contact_at,occurred_value) ELSE last_customer_contact_at END,
   updated_at=changed_at_value,version=version+1
   WHERE id=p_object_id AND version=p_expected_version RETURNING * INTO newrow;
 END IF;
 IF NOT FOUND THEN RAISE EXCEPTION 'unexpected version mutation' USING ERRCODE='PT409'; END IF;

 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,p_object_id,p_operation,
  jsonb_build_object('version',oldrow.version,'next_action',oldrow.next_action,'next_action_date',oldrow.next_action_date,
   'last_activity_at',oldrow.last_activity_at,'last_customer_contact_at',oldrow.last_customer_contact_at),
  jsonb_build_object('version',newrow.version,'next_action',newrow.next_action,'next_action_date',newrow.next_action_date,
   'last_activity_at',newrow.last_activity_at,'last_customer_contact_at',newrow.last_customer_contact_at,
   'created_id',created_id,'cancelled_action_ids',cancelled_ids,'meaningful_contact',meaningful_value),
  CASE WHEN p_operation='next_action' THEN text_value ELSE type_value||': '||text_value END,changed_at_value)
 RETURNING event_id INTO event;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'operation',p_operation,'request_id',p_request_id,
  'object_id',p_object_id,'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,
  'previous_version',p_expected_version,'version',newrow.version,'audit_event_id',event,'replayed',false)
  ||CASE WHEN p_operation='next_action' THEN jsonb_build_object('next_action_id',created_id,'cancelled_action_ids',cancelled_ids,'due_at',due_value,'assignee_name',assignee_value)
         ELSE jsonb_build_object('activity_id',created_id,'meaningful_contact',meaningful_value,'occurred_at',occurred_value) END;
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack)
 VALUES(a.auth_uid,p_request_id,a.user_id,p_operation,p_object_id,p_expected_version,canonical,ack);
 RETURN ack;
END $fn$;

REVOKE EXECUTE ON FUNCTION crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
COMMIT;

