CREATE FUNCTION crm_security.crm_inquiry_trash_command_v1(
 p_request_id uuid,p_inquiry_id uuid,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record;receipt crm_security.command_receipts%ROWTYPE;oldrow public.inquiries%ROWTYPE;latest_action text;
 canonical jsonb;ack jsonb;audit_id uuid;server_at timestamptz;reason_value text;note_value text;protected_value boolean;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 IF p_request_id IS NULL OR p_inquiry_id IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('delete_reason','delete_note'))
  OR NOT p_payload ? 'delete_reason' OR jsonb_typeof(p_payload->'delete_reason') IS DISTINCT FROM 'string'
  OR p_payload->>'delete_reason' NOT IN ('중복 문의','테스트 문의','스팸','잘못된 연락처','관련 없는 문의','기타')
  OR (p_payload ? 'delete_note' AND jsonb_typeof(p_payload->'delete_note') NOT IN ('string','null')) OR length(coalesce(p_payload->>'delete_note',''))>2000
 THEN RAISE EXCEPTION 'invalid inquiry trash payload; actor, time, purge and protection are server-owned' USING ERRCODE='22023';END IF;
 reason_value:=p_payload->>'delete_reason';note_value:=nullif(trim(p_payload->>'delete_note'),'');canonical:=jsonb_build_object('delete_reason',reason_value,'delete_note',note_value);
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.inquiry_id=p_inquiry_id FOR SHARE;
 SELECT * INTO oldrow FROM public.inquiries i WHERE i.id=p_inquiry_id FOR UPDATE;
 IF NOT FOUND OR a.permission_role<>'admin' OR NOT crm_security.can_inquiry(p_inquiry_id) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM 'inquiry_trash' OR receipt.object_id IS DISTINCT FROM p_inquiry_id OR receipt.expected_version IS DISTINCT FROM 0 OR receipt.payload IS DISTINCT FROM canonical THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409';END IF;RETURN receipt.ack||jsonb_build_object('replayed',true);END IF;
 SELECT e.action INTO latest_action FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=p_inquiry_id AND e.action IN ('inquiry_trash','inquiry_restore') ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1;
 IF latest_action='inquiry_trash' THEN RAISE EXCEPTION 'inquiry already trashed' USING ERRCODE='PT409';END IF;
 protected_value:=oldrow.deal_id IS NOT NULL OR oldrow.opportunity_id IS NOT NULL OR EXISTS(SELECT 1 FROM public.deals d WHERE d.origin_inquiry_id=p_inquiry_id);
 server_at:=clock_timestamp();
 INSERT INTO crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,p_inquiry_id,'inquiry_trash',
  jsonb_build_object('status',oldrow.status,'assigned_to',oldrow.assigned_to,'assigned_at',oldrow.assigned_at,'valid_inquiry',true),
  jsonb_build_object('valid_inquiry',false,'deleted_at',server_at,'deleted_by',a.display_name,'delete_reason',reason_value,'delete_note',note_value,'purge_at',server_at+interval '30 days','archive_protected',protected_value,'archive_reason',CASE WHEN protected_value THEN 'linked_opportunity' ELSE NULL END,'trash_snapshot',jsonb_build_object('status',oldrow.status,'assigned_to',oldrow.assigned_to,'assigned_at',oldrow.assigned_at)),
  reason_value,server_at) RETURNING event_id INTO audit_id;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation','inquiry_trash','object_id',p_inquiry_id,'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'valid_inquiry',false,'deleted_at',server_at,'deleted_by',a.display_name,'delete_reason',reason_value,'delete_note',note_value,'purge_at',server_at+interval '30 days','archive_protected',protected_value,'archive_reason',CASE WHEN protected_value THEN 'linked_opportunity' ELSE NULL END,'inquiry_audit_event_id',audit_id,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack) VALUES(a.auth_uid,p_request_id,a.user_id,'inquiry_trash',p_inquiry_id,0,canonical,ack);RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_inquiry_trash_command_v1(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_inquiry_restore_command_v1(
 p_request_id uuid,p_inquiry_id uuid,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record;receipt crm_security.command_receipts%ROWTYPE;oldrow public.inquiries%ROWTYPE;trash_event crm_security.inquiry_audit_events%ROWTYPE;latest_action text;
 canonical jsonb:=jsonb_build_object('intent','restore');ack jsonb;audit_id uuid;server_at timestamptz;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 IF p_request_id IS NULL OR p_inquiry_id IS NULL OR p_payload IS DISTINCT FROM canonical THEN RAISE EXCEPTION 'invalid inquiry restore payload; actor and time are server-owned' USING ERRCODE='22023';END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.inquiry_id=p_inquiry_id FOR SHARE;
 SELECT * INTO oldrow FROM public.inquiries i WHERE i.id=p_inquiry_id FOR UPDATE;
 IF NOT FOUND OR a.permission_role<>'admin' OR NOT crm_security.can_inquiry(p_inquiry_id) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM 'inquiry_restore' OR receipt.object_id IS DISTINCT FROM p_inquiry_id OR receipt.expected_version IS DISTINCT FROM 0 OR receipt.payload IS DISTINCT FROM canonical THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409';END IF;RETURN receipt.ack||jsonb_build_object('replayed',true);END IF;
 SELECT e.action INTO latest_action FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=p_inquiry_id AND e.action IN ('inquiry_trash','inquiry_restore') ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1;
 IF latest_action IS DISTINCT FROM 'inquiry_trash' THEN RAISE EXCEPTION 'inquiry is not trashed' USING ERRCODE='PT409';END IF;
 SELECT * INTO trash_event FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=p_inquiry_id AND e.action='inquiry_trash' ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1;
 server_at:=clock_timestamp();
 INSERT INTO crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,p_inquiry_id,'inquiry_restore',trash_event.after_data,jsonb_build_object('valid_inquiry',true,'restored_at',server_at,'restored_by',a.display_name,'status',oldrow.status,'assigned_to',oldrow.assigned_to,'assigned_at',oldrow.assigned_at),'휴지통 복원',server_at) RETURNING event_id INTO audit_id;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation','inquiry_restore','object_id',p_inquiry_id,'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'valid_inquiry',true,'restored_at',server_at,'restored_by',a.display_name,'inquiry_audit_event_id',audit_id,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack) VALUES(a.auth_uid,p_request_id,a.user_id,'inquiry_restore',p_inquiry_id,0,canonical,ack);RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_inquiry_restore_command_v1(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
