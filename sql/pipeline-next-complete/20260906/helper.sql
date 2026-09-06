CREATE FUNCTION crm_security.crm_next_action_complete_command_v1(
 p_request_id uuid,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record; receipt crm_security.command_receipts%ROWTYPE;
 oldrow public.deals%ROWTYPE; newrow public.deals%ROWTYPE; actionrow public.next_actions%ROWTYPE;
 canonical jsonb; ack jsonb; event uuid; activity_id uuid; server_at timestamptz;
 next_title text; next_due date; actor_email_value text;
BEGIN
 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0
  OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k<>'action_id')
  OR NOT p_payload ? 'action_id' OR jsonb_typeof(p_payload->'action_id') IS DISTINCT FROM 'string'
 THEN RAISE EXCEPTION 'invalid next action completion payload' USING ERRCODE='22023'; END IF;
 BEGIN canonical:=jsonb_build_object('action_id',(p_payload->>'action_id')::uuid);
 EXCEPTION WHEN invalid_text_representation THEN
  RAISE EXCEPTION 'invalid next action id' USING ERRCODE='22023'; END;

 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.deal_id=p_object_id FOR SHARE;
 SELECT * INTO oldrow FROM public.deals d WHERE d.id=p_object_id FOR UPDATE;
 IF NOT FOUND OR a.permission_role NOT IN ('rep','branch','admin') OR NOT crm_security.can_deal(p_object_id,true)
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;

 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r
  WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM 'next_action_complete'
   OR receipt.object_id IS DISTINCT FROM p_object_id OR receipt.expected_version IS DISTINCT FROM p_expected_version
   OR receipt.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;
 IF oldrow.version IS DISTINCT FROM p_expected_version
 THEN RAISE EXCEPTION 'version conflict' USING ERRCODE='PT409'; END IF;

 SELECT * INTO actionrow FROM public.next_actions n
  WHERE n.id=(canonical->>'action_id')::uuid AND n.deal_id=p_object_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF actionrow.status IS DISTINCT FROM 'open'
 THEN RAISE EXCEPTION 'next action state conflict' USING ERRCODE='PT409'; END IF;

 server_at:=clock_timestamp();
 UPDATE public.next_actions SET status='completed',completed_at=server_at,updated_at=server_at
  WHERE id=actionrow.id AND status='open';
 SELECT n.title,n.due_at::date INTO next_title,next_due FROM public.next_actions n
  WHERE n.deal_id=p_object_id AND n.status='open' ORDER BY n.due_at NULLS LAST,n.id LIMIT 1;
 SELECT u.email INTO actor_email_value FROM public.users u WHERE u.user_id=a.user_id;
 INSERT INTO public.activities(deal_id,organization_id,actor_email,actor_name,type,detail,occurred_at)
 VALUES(p_object_id,oldrow.organization_id,actor_email_value,a.display_name,'다음 행동 완료',
  jsonb_build_object('note',actionrow.title,'result','다음 행동 완료','action_id',actionrow.id,'meaningful_contact',false),server_at)
 RETURNING id INTO activity_id;
 UPDATE public.deals SET next_action=next_title,next_action_date=next_due,last_activity_at=server_at,
  updated_at=server_at,version=version+1
  WHERE id=p_object_id AND version=p_expected_version RETURNING * INTO newrow;
 IF NOT FOUND THEN RAISE EXCEPTION 'unexpected version mutation' USING ERRCODE='PT409'; END IF;

 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,p_object_id,'next_action_complete',
  jsonb_build_object('version',oldrow.version,'action_id',actionrow.id,'action_status',actionrow.status,
   'next_action',oldrow.next_action,'next_action_date',oldrow.next_action_date),
  jsonb_build_object('version',newrow.version,'action_id',actionrow.id,'action_status','completed',
   'completed_at',server_at,'activity_id',activity_id,'next_action',newrow.next_action,'next_action_date',newrow.next_action_date),
  actionrow.title,server_at) RETURNING event_id INTO event;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,
  'operation','next_action_complete','object_id',p_object_id,'actor_auth_uid',a.auth_uid,
  'actor_user_id',a.user_id,'previous_version',p_expected_version,'version',newrow.version,
  'next_action_id',actionrow.id,'activity_id',activity_id,'completed_at',server_at,
  'audit_event_id',event,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack)
 VALUES(a.auth_uid,p_request_id,a.user_id,'next_action_complete',p_object_id,p_expected_version,canonical,ack);
 RETURN ack;
END $fn$;

REVOKE EXECUTE ON FUNCTION crm_security.crm_next_action_complete_command_v1(uuid,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
