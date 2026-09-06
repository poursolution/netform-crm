CREATE FUNCTION crm_security.crm_inquiry_followup_command_v1(
 p_request_id uuid,p_inquiry_id uuid,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record;receipt crm_security.command_receipts%ROWTYPE;oldrow public.inquiries%ROWTYPE;latest_management text;
 canonical jsonb;ack jsonb;audit_id uuid;server_at timestamptz;due_value date;today_kst date;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 IF p_request_id IS NULL OR p_inquiry_id IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('due_at','reason')) OR p_payload->>'reason' IS DISTINCT FROM '담당자 연기' OR coalesce(p_payload->>'due_at','') !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'invalid inquiry followup payload' USING ERRCODE='22023';END IF;
 BEGIN due_value:=(p_payload->>'due_at')::date;EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN RAISE EXCEPTION 'invalid inquiry followup date' USING ERRCODE='22023';END;
 today_kst:=(clock_timestamp() AT TIME ZONE 'Asia/Seoul')::date;
 IF due_value<=today_kst OR due_value>today_kst+365 THEN RAISE EXCEPTION 'inquiry followup date must be future and within 365 days' USING ERRCODE='22023';END IF;
 canonical:=jsonb_build_object('due_at',to_char(due_value,'YYYY-MM-DD'),'reason','담당자 연기');
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM 'inquiry_followup' OR receipt.object_id IS DISTINCT FROM p_inquiry_id OR receipt.expected_version IS DISTINCT FROM 0 OR receipt.payload IS DISTINCT FROM canonical THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409';END IF;RETURN receipt.ack||jsonb_build_object('replayed',true);END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.inquiry_id=p_inquiry_id FOR SHARE;
 SELECT * INTO oldrow FROM public.inquiries i WHERE i.id=p_inquiry_id FOR UPDATE;
 IF NOT FOUND OR oldrow.assigned_to IS DISTINCT FROM a.user_id OR NOT crm_security.can_inquiry(p_inquiry_id) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 SELECT e.action INTO latest_management FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=p_inquiry_id AND e.action IN ('inquiry_trash','inquiry_restore','inquiry_purge') ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1;
 IF latest_management IN ('inquiry_trash','inquiry_purge') THEN RAISE EXCEPTION 'inactive inquiry cannot be postponed' USING ERRCODE='PT409';END IF;
 IF oldrow.next_action_date IS NOT DISTINCT FROM due_value THEN RAISE EXCEPTION 'inquiry followup date unchanged' USING ERRCODE='PT409';END IF;
 server_at:=clock_timestamp();UPDATE public.inquiries SET next_action_date=due_value,updated_at=server_at WHERE id=p_inquiry_id;
 INSERT INTO crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,p_inquiry_id,'inquiry_followup',jsonb_build_object('next_action_date',oldrow.next_action_date,'status',oldrow.status,'assigned_to',oldrow.assigned_to),jsonb_build_object('next_action_date',due_value,'status',oldrow.status,'assigned_to',oldrow.assigned_to,'updated_at',server_at),'담당자 연기',server_at) RETURNING event_id INTO audit_id;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation','inquiry_followup','object_id',p_inquiry_id,'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'previous_next_action_date',oldrow.next_action_date,'next_action_date',due_value,'status',oldrow.status,'updated_at',server_at,'inquiry_audit_event_id',audit_id,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack) VALUES(a.auth_uid,p_request_id,a.user_id,'inquiry_followup',p_inquiry_id,0,canonical,ack);RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_inquiry_followup_command_v1(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
