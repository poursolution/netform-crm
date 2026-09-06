CREATE FUNCTION crm_security.crm_inquiry_purge_command_v1(
 p_request_id uuid,p_inquiry_id uuid,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record;receipt crm_security.command_receipts%ROWTYPE;oldrow public.inquiries%ROWTYPE;trash_event crm_security.inquiry_audit_events%ROWTYPE;
 canonical jsonb:=jsonb_build_object('intent','purge');ack jsonb;audit_id uuid;server_at timestamptz;
 scope_n integer;assignment_n integer;next_n integer;stage_n integer;deleted_n integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 IF p_request_id IS NULL OR p_inquiry_id IS NULL OR p_payload IS DISTINCT FROM canonical THEN RAISE EXCEPTION 'invalid inquiry purge payload; actor and time are server-owned' USING ERRCODE='22023';END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM 'inquiry_purge' OR receipt.object_id IS DISTINCT FROM p_inquiry_id OR receipt.expected_version IS DISTINCT FROM 0 OR receipt.payload IS DISTINCT FROM canonical THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409';END IF;RETURN receipt.ack||jsonb_build_object('replayed',true);END IF;
 IF EXISTS(SELECT 1 FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=p_inquiry_id AND e.action='inquiry_purge') THEN RAISE EXCEPTION 'inquiry already purged' USING ERRCODE='PT409';END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.inquiry_id=p_inquiry_id FOR SHARE;
 SELECT * INTO oldrow FROM public.inquiries i WHERE i.id=p_inquiry_id FOR UPDATE;
 IF NOT FOUND OR a.permission_role<>'admin' OR NOT crm_security.can_inquiry(p_inquiry_id) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 SELECT * INTO trash_event FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=p_inquiry_id AND e.action IN ('inquiry_trash','inquiry_restore') ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND OR trash_event.action IS DISTINCT FROM 'inquiry_trash' THEN RAISE EXCEPTION 'inquiry is not trashed' USING ERRCODE='PT409';END IF;
 IF coalesce((trash_event.after_data->>'archive_protected')::boolean,false) OR oldrow.deal_id IS NOT NULL OR oldrow.opportunity_id IS NOT NULL OR EXISTS(SELECT 1 FROM public.deals d WHERE d.origin_inquiry_id=p_inquiry_id) THEN RAISE EXCEPTION 'linked inquiry cannot be purged' USING ERRCODE='PT409';END IF;
 SELECT count(*)::integer INTO scope_n FROM crm_security.object_scope WHERE inquiry_id=p_inquiry_id;
 SELECT count(*)::integer INTO assignment_n FROM public.assignment_history WHERE inquiry_id=p_inquiry_id;
 SELECT count(*)::integer INTO next_n FROM public.next_actions WHERE inquiry_id=p_inquiry_id;
 SELECT count(*)::integer INTO stage_n FROM public.stage_history WHERE inquiry_id=p_inquiry_id;
 server_at:=clock_timestamp();
 INSERT INTO crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,p_inquiry_id,'inquiry_purge',to_jsonb(oldrow)||jsonb_build_object('trash_event_id',trash_event.event_id),jsonb_build_object('purged',true,'purged_at',server_at,'purged_by',a.display_name,'removed_scope_count',scope_n,'cascaded_assignment_history_count',assignment_n,'cascaded_next_action_count',next_n,'cascaded_stage_history_count',stage_n),'관리자 수동 완전삭제',server_at) RETURNING event_id INTO audit_id;
 DELETE FROM crm_security.object_scope WHERE inquiry_id=p_inquiry_id;GET DIAGNOSTICS deleted_n=ROW_COUNT;IF deleted_n<>scope_n THEN RAISE EXCEPTION 'inquiry scope delete mismatch';END IF;
 DELETE FROM public.inquiries WHERE id=p_inquiry_id;GET DIAGNOSTICS deleted_n=ROW_COUNT;IF deleted_n<>1 THEN RAISE EXCEPTION 'inquiry purge delete mismatch';END IF;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation','inquiry_purge','object_id',p_inquiry_id,'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'purged',true,'purged_at',server_at,'purged_by',a.display_name,'removed_scope_count',scope_n,'cascaded_assignment_history_count',assignment_n,'cascaded_next_action_count',next_n,'cascaded_stage_history_count',stage_n,'inquiry_audit_event_id',audit_id,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack) VALUES(a.auth_uid,p_request_id,a.user_id,'inquiry_purge',p_inquiry_id,0,canonical,ack);RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_inquiry_purge_command_v1(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
