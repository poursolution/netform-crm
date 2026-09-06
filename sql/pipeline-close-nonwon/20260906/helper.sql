CREATE FUNCTION crm_security.crm_deal_close_nonwon_command_v1(
 p_request_id uuid,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record;receipt crm_security.command_receipts%ROWTYPE;oldrow public.deals%ROWTYPE;newrow public.deals%ROWTYPE;
 canonical jsonb;ack jsonb;audit_id uuid;close_event_id uuid;history_id uuid;activity_id uuid;
 from_value text;outcome_value text;category_value text;detail_value text;source_value text;note_value text;lost_kind_value text;
 closed_date_value date;server_at timestamptz;effective_at timestamptz;contexts jsonb;completed_ids jsonb:='[]'::jsonb;actor_email_value text;
BEGIN
 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0 OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('from','outcome','closed_date','category','detail','reason_source','note'))
  OR NOT p_payload ?& ARRAY['from','outcome','closed_date','category','detail','reason_source','note']
  OR jsonb_typeof(p_payload->'from') IS DISTINCT FROM 'string' OR jsonb_typeof(p_payload->'outcome') IS DISTINCT FROM 'string'
  OR jsonb_typeof(p_payload->'category') IS DISTINCT FROM 'string' OR jsonb_typeof(p_payload->'detail') IS DISTINCT FROM 'string'
  OR jsonb_typeof(p_payload->'reason_source') IS DISTINCT FROM 'string' OR jsonb_typeof(p_payload->'note') IS DISTINCT FROM 'string'
  OR jsonb_typeof(p_payload->'closed_date') NOT IN ('string','null')
 THEN RAISE EXCEPTION 'invalid non-won close payload' USING ERRCODE='22023'; END IF;
 from_value:=p_payload->>'from';outcome_value:=p_payload->>'outcome';category_value:=trim(p_payload->>'category');detail_value:=trim(p_payload->>'detail');source_value:=trim(p_payload->>'reason_source');note_value:=trim(p_payload->>'note');
 IF outcome_value NOT IN ('lost','badfit','nocontact') OR from_value IN ('won','lost','badfit','badfit_lead','badfit_pipe','nocontact')
  OR length(category_value)<1 OR length(category_value)>500 OR length(detail_value)<5 OR length(detail_value)>8000 OR length(source_value)<1 OR length(source_value)>50 OR length(note_value)<1 OR length(note_value)>16000
 THEN RAISE EXCEPTION 'invalid non-won close payload' USING ERRCODE='22023'; END IF;
 IF outcome_value='lost' AND category_value NOT IN ('타사 선정 (경쟁 패배)','가격 열세','기술·공법 열세','우리가 연락 못 함','견적 후 후속 지연','담당자 부재·인수인계 누락','고객 예산 무산','공사 시기 연기·취소','가격','일정','타업체 선정','내부 사정','기타')
  OR outcome_value='badfit' AND category_value NOT IN ('지역 밖','공사 범위 밖','공사범위 밖','규모 미달','예산 수준 불일치','스팸·기타','기타')
  OR outcome_value='nocontact' AND category_value NOT IN ('3회 이상 시도 무응답','3회 이상 시도','문자·카카오까지 무응답','문자·카톡까지 무응답','번호 결번·변경','담당자 퇴사·교체')
 THEN RAISE EXCEPTION 'invalid close category' USING ERRCODE='22023'; END IF;
 IF p_payload->>'closed_date' IS NOT NULL THEN
  IF p_payload->>'closed_date' !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'invalid close date' USING ERRCODE='22023'; END IF;
  BEGIN closed_date_value:=(p_payload->>'closed_date')::date;EXCEPTION WHEN datetime_field_overflow THEN RAISE EXCEPTION 'invalid close date' USING ERRCODE='22023';END;
  IF closed_date_value::text<>p_payload->>'closed_date' THEN RAISE EXCEPTION 'invalid close date' USING ERRCODE='22023'; END IF;
 END IF;
 canonical:=jsonb_build_object('from',from_value,'outcome',outcome_value,'closed_date',closed_date_value,'category',category_value,'detail',detail_value,'reason_source',source_value,'note',note_value);
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.deal_id=p_object_id FOR SHARE;
 SELECT * INTO oldrow FROM public.deals d WHERE d.id=p_object_id FOR UPDATE;
 IF NOT FOUND OR a.permission_role NOT IN ('rep','branch','admin') OR NOT crm_security.can_deal(p_object_id,true) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM 'close' OR receipt.object_id IS DISTINCT FROM p_object_id OR receipt.expected_version IS DISTINCT FROM p_expected_version OR receipt.payload IS DISTINCT FROM canonical THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409';END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;
 IF oldrow.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'version conflict' USING ERRCODE='PT409';END IF;
 IF oldrow.stage_code IS DISTINCT FROM from_value OR oldrow.outcome IS NOT NULL OR oldrow.lifecycle_status='closed' THEN RAISE EXCEPTION 'close state conflict' USING ERRCODE='PT409';END IF;
 IF jsonb_typeof(oldrow.stage_contexts) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'stage contexts state conflict' USING ERRCODE='PT409';END IF;
 server_at:=clock_timestamp();closed_date_value:=coalesce(closed_date_value,(server_at AT TIME ZONE 'Asia/Seoul')::date);
 IF closed_date_value>(server_at AT TIME ZONE 'Asia/Seoul')::date THEN RAISE EXCEPTION 'future close date' USING ERRCODE='22023';END IF;
 effective_at:=closed_date_value::timestamp AT TIME ZONE 'Asia/Seoul';
 lost_kind_value:=CASE WHEN category_value IN ('타사 선정 (경쟁 패배)','가격 열세','기술·공법 열세','가격','타업체 선정') THEN '뺏김' WHEN category_value IN ('우리가 연락 못 함','견적 후 후속 지연','담당자 부재·인수인계 누락') THEN '놓침' WHEN outcome_value='lost' THEN '기타' END;
 contexts:=jsonb_set(oldrow.stage_contexts,ARRAY[outcome_value],jsonb_build_object('transition_date',closed_date_value,'fields',jsonb_build_object('close_reason',category_value,'close_detail',detail_value),'from',from_value,'to',outcome_value,'recorded_at',server_at,'actor',a.display_name,'terminal',true,'reason_source',source_value),true);
 SELECT coalesce(jsonb_agg(id ORDER BY created_at),'[]'::jsonb) INTO completed_ids FROM public.next_actions WHERE deal_id=p_object_id AND status='open';
 UPDATE public.next_actions SET status='completed',completed_at=server_at,updated_at=server_at WHERE deal_id=p_object_id AND status='open';
 SELECT u.email INTO actor_email_value FROM public.users u WHERE u.user_id=a.user_id;
 INSERT INTO public.stage_history(opportunity_id,from_stage,to_stage,reason,actor_id,actor_name,changed_at) VALUES(p_object_id,from_value,outcome_value,category_value||' · '||detail_value,a.user_id,a.display_name,effective_at) RETURNING id INTO history_id;
 INSERT INTO public.activities(deal_id,organization_id,actor_email,actor_name,type,detail,occurred_at) VALUES(p_object_id,oldrow.organization_id,actor_email_value,a.display_name,'종료',jsonb_build_object('note',outcome_value,'result',note_value,'category',category_value,'detail',detail_value,'meaningful_contact',false),effective_at) RETURNING id INTO activity_id;
 INSERT INTO crm_security.deal_close_events(request_id,deal_id,from_stage,outcome,closed_date,category,detail,reason_source,actor_auth_uid,actor_user_id,recorded_at,stage_history_id,activity_id,completed_action_ids)
 VALUES(p_request_id,p_object_id,from_value,outcome_value,closed_date_value,category_value,detail_value,source_value,a.auth_uid,a.user_id,server_at,history_id,activity_id,completed_ids) RETURNING event_id INTO close_event_id;
 UPDATE public.deals SET lifecycle_status='closed',outcome=outcome_value,closed_at=effective_at,stage_contexts=contexts,last_activity_at=effective_at,
  lost_reason=CASE WHEN outcome_value='lost' THEN category_value ELSE lost_reason END,lost_kind=CASE WHEN outcome_value='lost' THEN lost_kind_value ELSE lost_kind END,badfit_type=CASE WHEN outcome_value='badfit' THEN category_value ELSE badfit_type END,
  next_action=NULL,next_action_date=NULL,updated_at=server_at,version=version+1 WHERE id=p_object_id AND version=p_expected_version RETURNING * INTO newrow;
 IF NOT FOUND THEN RAISE EXCEPTION 'unexpected version mutation' USING ERRCODE='PT409';END IF;
 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,p_object_id,'close',jsonb_build_object('version',oldrow.version,'stage_code',oldrow.stage_code,'outcome',oldrow.outcome,'lifecycle_status',oldrow.lifecycle_status,'next_action',oldrow.next_action,'next_action_date',oldrow.next_action_date),jsonb_build_object('version',newrow.version,'stage_code',newrow.stage_code,'outcome',newrow.outcome,'lifecycle_status',newrow.lifecycle_status,'close_event_id',close_event_id,'stage_history_id',history_id,'activity_id',activity_id,'completed_action_ids',completed_ids),category_value||' · '||detail_value,server_at) RETURNING event_id INTO audit_id;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation','close','object_id',p_object_id,'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'previous_version',p_expected_version,'version',newrow.version,'from_stage',from_value,'stage_code',newrow.stage_code,'outcome',newrow.outcome,'lifecycle_status',newrow.lifecycle_status,'closed_at',newrow.closed_at,'stage_contexts',newrow.stage_contexts,'lost_reason',newrow.lost_reason,'lost_kind',newrow.lost_kind,'badfit_type',newrow.badfit_type,'close_event_id',close_event_id,'stage_history_id',history_id,'activity_id',activity_id,'completed_action_ids',completed_ids,'audit_event_id',audit_id,'server_at',server_at,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack) VALUES(a.auth_uid,p_request_id,a.user_id,'close',p_object_id,p_expected_version,canonical,ack);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_deal_close_nonwon_command_v1(uuid,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
