CREATE FUNCTION crm_security.crm_deal_waiting_context_command_v1(
 p_request_id uuid,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record;receipt crm_security.command_receipts%ROWTYPE;oldrow public.deals%ROWTYPE;newrow public.deals%ROWTYPE;
 canonical jsonb;ack jsonb;audit_id uuid;activity_id uuid;next_id uuid;cancelled_ids jsonb:='[]'::jsonb;
 reason_value text;speaker_value text;statement_value text;evidence_value text;wake_value date;resume_value date;server_at timestamptz;due_at timestamptz;contexts jsonb;actor_email text;
BEGIN
 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0 OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('waiting_reason','waiting_speaker','waiting_customer_statement','wake_up_at','waiting_evidence','expected_resume_at'))
  OR NOT p_payload ?& ARRAY['waiting_reason','waiting_speaker','waiting_customer_statement','wake_up_at','waiting_evidence','expected_resume_at']
  OR EXISTS(SELECT 1 FROM jsonb_each(p_payload) e WHERE jsonb_typeof(e.value) IS DISTINCT FROM 'string')
 THEN RAISE EXCEPTION 'invalid waiting context payload' USING ERRCODE='22023';END IF;
 reason_value:=trim(p_payload->>'waiting_reason');speaker_value:=trim(p_payload->>'waiting_speaker');statement_value:=trim(p_payload->>'waiting_customer_statement');evidence_value:=trim(p_payload->>'waiting_evidence');
 IF length(reason_value)<2 OR length(reason_value)>2000 OR length(speaker_value)<1 OR length(speaker_value)>500 OR length(statement_value)<2 OR length(statement_value)>8000 OR length(evidence_value)<2 OR length(evidence_value)>4000 OR p_payload->>'wake_up_at' !~ '^\d{4}-\d{2}-\d{2}$' OR p_payload->>'expected_resume_at' !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'invalid waiting context payload' USING ERRCODE='22023';END IF;
 BEGIN wake_value:=(p_payload->>'wake_up_at')::date;resume_value:=(p_payload->>'expected_resume_at')::date;EXCEPTION WHEN datetime_field_overflow THEN RAISE EXCEPTION 'invalid waiting dates' USING ERRCODE='22023';END;
 IF wake_value::text<>p_payload->>'wake_up_at' OR resume_value::text<>p_payload->>'expected_resume_at' THEN RAISE EXCEPTION 'invalid waiting dates' USING ERRCODE='22023';END IF;
 canonical:=jsonb_build_object('waiting_reason',reason_value,'waiting_speaker',speaker_value,'waiting_customer_statement',statement_value,'wake_up_at',wake_value,'waiting_evidence',evidence_value,'expected_resume_at',resume_value);
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.deal_id=p_object_id FOR SHARE;
 SELECT * INTO oldrow FROM public.deals d WHERE d.id=p_object_id FOR UPDATE;
 IF NOT FOUND OR a.permission_role NOT IN ('rep','branch','admin') OR NOT crm_security.can_deal(p_object_id,true) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM 'waiting_context' OR receipt.object_id IS DISTINCT FROM p_object_id OR receipt.expected_version IS DISTINCT FROM p_expected_version OR receipt.payload IS DISTINCT FROM canonical THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409';END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;
 IF oldrow.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'version conflict' USING ERRCODE='PT409';END IF;
 IF oldrow.stage_code IS DISTINCT FROM 'waiting' OR oldrow.outcome IS NOT NULL OR oldrow.lifecycle_status='closed' OR jsonb_typeof(oldrow.stage_contexts) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'waiting context state conflict' USING ERRCODE='PT409';END IF;
 server_at:=clock_timestamp();due_at:=wake_value::timestamp AT TIME ZONE 'Asia/Seoul';
 contexts:=jsonb_set(oldrow.stage_contexts,ARRAY['waiting'],jsonb_build_object('from','waiting','to','waiting','recorded_at',server_at,'actor',a.display_name,'fields',jsonb_build_object('reason',reason_value,'speaker',speaker_value,'statement',statement_value,'contact_date',wake_value,'resume_date',resume_value,'evidence',evidence_value)),true);
 SELECT coalesce(jsonb_agg(id ORDER BY created_at),'[]'::jsonb) INTO cancelled_ids FROM public.next_actions WHERE deal_id=p_object_id AND status='open';
 UPDATE public.next_actions SET status='cancelled',updated_at=server_at WHERE deal_id=p_object_id AND status='open';
 INSERT INTO public.next_actions(deal_id,action_type,title,due_at,assignee_name,status,created_at,updated_at) VALUES(p_object_id,'전화','대기 사유 확인 후 재접촉',due_at,a.display_name,'open',server_at,server_at) RETURNING id INTO next_id;
 SELECT u.email INTO actor_email FROM public.users u WHERE u.user_id=a.user_id;
 INSERT INTO public.activities(deal_id,organization_id,actor_email,actor_name,type,detail,occurred_at) VALUES(p_object_id,oldrow.organization_id,actor_email,a.display_name,'대기정보',jsonb_build_object('note',reason_value,'result',speaker_value||' · 재접촉 '||wake_value::text||' · '||evidence_value,'customer_statement',statement_value,'expected_resume_at',resume_value,'meaningful_contact',false),server_at) RETURNING id INTO activity_id;
 UPDATE public.deals SET wake_up_at=due_at,stage_contexts=contexts,next_action='대기 사유 확인 후 재접촉',next_action_date=wake_value,last_activity_at=server_at,updated_at=server_at,version=version+1 WHERE id=p_object_id AND version=p_expected_version RETURNING * INTO newrow;
 IF NOT FOUND THEN RAISE EXCEPTION 'unexpected version mutation' USING ERRCODE='PT409';END IF;
 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,p_object_id,'waiting_context',jsonb_build_object('version',oldrow.version,'wake_up_at',oldrow.wake_up_at,'waiting',oldrow.stage_contexts->'waiting','next_action',oldrow.next_action,'next_action_date',oldrow.next_action_date),jsonb_build_object('version',newrow.version,'wake_up_at',newrow.wake_up_at,'waiting',newrow.stage_contexts->'waiting','next_action_id',next_id,'activity_id',activity_id,'cancelled_action_ids',cancelled_ids),reason_value,server_at) RETURNING event_id INTO audit_id;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation','waiting_context','object_id',p_object_id,'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'previous_version',p_expected_version,'version',newrow.version,'wake_up_at',wake_value,'expected_resume_at',resume_value,'waiting_context',newrow.stage_contexts->'waiting','next_action_id',next_id,'activity_id',activity_id,'cancelled_action_ids',cancelled_ids,'audit_event_id',audit_id,'server_at',server_at,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack) VALUES(a.auth_uid,p_request_id,a.user_id,'waiting_context',p_object_id,p_expected_version,canonical,ack);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_deal_waiting_context_command_v1(uuid,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
