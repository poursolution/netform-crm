CREATE FUNCTION crm_security.crm_inquiry_reclassify_command_v1(
 p_request_id uuid,p_inquiry_id uuid,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record;receipt crm_security.command_receipts%ROWTYPE;oldrow public.inquiries%ROWTYPE;newrow public.inquiries%ROWTYPE;
 canonical jsonb;ack jsonb;audit_id uuid;target_brand text;server_at timestamptz;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 IF p_request_id IS NULL OR p_inquiry_id IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k<>'to_brand')
  OR NOT p_payload ? 'to_brand' OR jsonb_typeof(p_payload->'to_brand') IS DISTINCT FROM 'string'
  OR length(trim(p_payload->>'to_brand'))<1 OR length(p_payload->>'to_brand')>100
 THEN RAISE EXCEPTION 'invalid inquiry reclassify payload; actor, source brand and time are server-owned' USING ERRCODE='22023';END IF;
 target_brand:=trim(p_payload->>'to_brand');canonical:=jsonb_build_object('to_brand',target_brand);
 IF target_brand='기술자문' OR NOT(target_brand IN ('석민이앤씨','POUR솔루션','POUR공법','아파트스퀘어')
  OR EXISTS(SELECT 1 FROM public.inquiries x WHERE x.brand=target_brand AND x.brand<>'기술자문'))
 THEN RAISE EXCEPTION 'invalid inquiry brand' USING ERRCODE='22023';END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.inquiry_id=p_inquiry_id FOR SHARE;
 SELECT * INTO oldrow FROM public.inquiries i WHERE i.id=p_inquiry_id FOR UPDATE;
 IF NOT FOUND OR a.permission_role<>'admin' OR NOT crm_security.can_inquiry(p_inquiry_id)
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM 'inquiry_reclassify'
   OR receipt.object_id IS DISTINCT FROM p_inquiry_id OR receipt.expected_version IS DISTINCT FROM 0
   OR receipt.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409';END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;
 IF oldrow.brand IS DISTINCT FROM '기술자문' THEN RAISE EXCEPTION 'inquiry classification conflict' USING ERRCODE='PT409';END IF;
 IF oldrow.deal_id IS NOT NULL OR oldrow.opportunity_id IS NOT NULL
  OR EXISTS(SELECT 1 FROM public.deals d WHERE d.origin_inquiry_id=p_inquiry_id)
 THEN RAISE EXCEPTION 'linked technical inquiry cannot be reclassified' USING ERRCODE='PT409';END IF;
 server_at:=clock_timestamp();
 UPDATE public.inquiries SET brand=target_brand,updated_at=server_at WHERE id=p_inquiry_id RETURNING * INTO newrow;
 INSERT INTO crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,p_inquiry_id,'inquiry_reclassify',
  jsonb_build_object('brand',oldrow.brand,'review_status',NULL),
  jsonb_build_object('brand',newrow.brand,'review_status','reclassified','reviewed_at',server_at,'reviewed_by',a.display_name),
  '기존 기술자문 문의 → '||target_brand,server_at) RETURNING event_id INTO audit_id;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation','inquiry_reclassify',
  'object_id',p_inquiry_id,'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'from_brand','기술자문',
  'to_brand',target_brand,'review_status','reclassified','reviewed_at',server_at,'reviewed_by',a.display_name,
  'inquiry_audit_event_id',audit_id,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack)
 VALUES(a.auth_uid,p_request_id,a.user_id,'inquiry_reclassify',p_inquiry_id,0,canonical,ack);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_inquiry_reclassify_command_v1(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
