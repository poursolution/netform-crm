CREATE FUNCTION crm_security.crm_stage_check_command_v1(
 p_request_id uuid,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record; receipt crm_security.command_receipts%ROWTYPE;
 oldrow public.deals%ROWTYPE; newrow public.deals%ROWTYPE;
 canonical jsonb; ack jsonb; event uuid; server_at timestamptz;
 stage_value text; item_value integer; checked_value boolean; item_label text;
 prior_json jsonb; prior_value boolean;
BEGIN
 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0
  OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('stage_code','item_index','checked'))
  OR NOT p_payload ?& ARRAY['stage_code','item_index','checked']
  OR jsonb_typeof(p_payload->'stage_code') IS DISTINCT FROM 'string'
  OR jsonb_typeof(p_payload->'item_index') IS DISTINCT FROM 'number'
  OR jsonb_typeof(p_payload->'checked') IS DISTINCT FROM 'boolean'
 THEN RAISE EXCEPTION 'invalid stage check payload' USING ERRCODE='22023'; END IF;
 BEGIN
  stage_value:=p_payload->>'stage_code';
  item_value:=(p_payload->>'item_index')::integer;
  checked_value:=(p_payload->>'checked')::boolean;
 EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
  RAISE EXCEPTION 'invalid stage check payload' USING ERRCODE='22023';
 END;
 item_label:=CASE stage_value
  WHEN 'first_contact' THEN CASE item_value WHEN 1 THEN '공사 예정시기 확인' WHEN 3 THEN '예산·견적 필요 여부 확인' END
  WHEN 'consulting' THEN CASE item_value WHEN 3 THEN '견적 작성 요청' END
  WHEN 'sent' THEN CASE item_value WHEN 1 THEN '자료 수신 확인' WHEN 2 THEN '검토 일정 확인' END
  WHEN 'rapport' THEN CASE item_value WHEN 2 THEN '예산·회의 시점 확인' END
  WHEN 'silent' THEN CASE item_value WHEN 1 THEN '진행·보류 여부 확인' END
  WHEN 'waiting' THEN CASE item_value WHEN 0 THEN '대기 사유 기록' WHEN 1 THEN '재개 조건 확인' END
  WHEN 'compete' THEN CASE item_value WHEN 0 THEN '경쟁업체 여부 확인' WHEN 1 THEN 'PT·현설 일정 확인' END
  WHEN 'imminent' THEN CASE item_value WHEN 0 THEN '공사 예정일 확인' WHEN 1 THEN '현설·회의 일정 확인' END
  WHEN 'bidding' THEN CASE item_value WHEN 0 THEN '입찰조건 확인' WHEN 1 THEN '제출서류 확인' WHEN 2 THEN '예상 낙찰가 확인' END
  WHEN 'contract' THEN CASE item_value WHEN 0 THEN '계약조건 확인' WHEN 3 THEN '착수 일정 확인' END
  WHEN 'construction' THEN CASE item_value WHEN 1 THEN '현장 이슈 확인' END
  WHEN 'completion' THEN CASE item_value WHEN 0 THEN '준공검사 확인' WHEN 2 THEN '미해결 사항 확인' END
  ELSE NULL END;
 IF item_label IS NULL THEN RAISE EXCEPTION 'stage check item is not manually writable' USING ERRCODE='22023'; END IF;
 canonical:=jsonb_build_object('stage_code',stage_value,'item_index',item_value,'checked',checked_value);

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
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM 'stage_check'
   OR receipt.object_id IS DISTINCT FROM p_object_id OR receipt.expected_version IS DISTINCT FROM p_expected_version
   OR receipt.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;
 IF oldrow.version IS DISTINCT FROM p_expected_version
 THEN RAISE EXCEPTION 'version conflict' USING ERRCODE='PT409'; END IF;
 IF oldrow.stage_code IS DISTINCT FROM stage_value
 THEN RAISE EXCEPTION 'stage check stage conflict' USING ERRCODE='PT409'; END IF;
 IF oldrow.stage_checklist ? stage_value AND jsonb_typeof(oldrow.stage_checklist->stage_value) IS DISTINCT FROM 'object'
 THEN RAISE EXCEPTION 'stage checklist shape conflict' USING ERRCODE='PT409'; END IF;
 prior_json:=oldrow.stage_checklist->stage_value->(item_value::text);
 IF prior_json IS NOT NULL AND jsonb_typeof(prior_json) IS DISTINCT FROM 'boolean'
 THEN RAISE EXCEPTION 'stage checklist shape conflict' USING ERRCODE='PT409'; END IF;
 prior_value:=coalesce((prior_json#>>'{}')::boolean,false);
 IF prior_value=checked_value
 THEN RAISE EXCEPTION 'stage check state conflict' USING ERRCODE='PT409'; END IF;

 server_at:=clock_timestamp();
 UPDATE public.deals SET
  stage_checklist=jsonb_set(
   jsonb_set(coalesce(stage_checklist,'{}'::jsonb),ARRAY[stage_value],'{}'::jsonb,true),
   ARRAY[stage_value,item_value::text],to_jsonb(checked_value),true),
  updated_at=server_at,version=version+1
 WHERE id=p_object_id AND version=p_expected_version RETURNING * INTO newrow;
 IF NOT FOUND THEN RAISE EXCEPTION 'unexpected version mutation' USING ERRCODE='PT409'; END IF;

 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,p_object_id,'stage_check',
  jsonb_build_object('version',oldrow.version,'stage_code',stage_value,'item_index',item_value,'item_text',item_label,'checked',prior_value),
  jsonb_build_object('version',newrow.version,'stage_code',stage_value,'item_index',item_value,'item_text',item_label,'checked',checked_value),
  item_label,server_at) RETURNING event_id INTO event;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,
  'operation','stage_check','object_id',p_object_id,'actor_auth_uid',a.auth_uid,
  'actor_user_id',a.user_id,'previous_version',p_expected_version,'version',newrow.version,
  'stage_code',stage_value,'item_index',item_value,'item_text',item_label,'checked',checked_value,
  'stage_checklist',newrow.stage_checklist,'audit_event_id',event,'server_at',server_at,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack)
 VALUES(a.auth_uid,p_request_id,a.user_id,'stage_check',p_object_id,p_expected_version,canonical,ack);
 RETURN ack;
END $fn$;

REVOKE EXECUTE ON FUNCTION crm_security.crm_stage_check_command_v1(uuid,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
