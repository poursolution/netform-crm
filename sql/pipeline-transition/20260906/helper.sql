CREATE FUNCTION crm_security.crm_deal_transition_command_v1(
 p_request_id uuid,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record; receipt crm_security.command_receipts%ROWTYPE;
 oldrow public.deals%ROWTYPE; newrow public.deals%ROWTYPE;
 canonical jsonb; ack jsonb; audit_id uuid; transition_event_id uuid; history_id uuid; activity_id uuid; next_id uuid;
 from_value text; to_value text; transition_value date; fields_value jsonb; skip_value text; memo_value text; note_value text;
 effective_at timestamptz; server_at timestamptz; group_value text; lifecycle_value text; actor_email_value text; owner_name_value text;
 next_due date; next_title text; cancelled_ids jsonb:='[]'::jsonb; contexts jsonb; standard boolean;
BEGIN
 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0
  OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('from','to','transition_date','fields','skip_reason','memo','note'))
  OR NOT p_payload ?& ARRAY['from','to','transition_date','fields','skip_reason','memo','note']
  OR jsonb_typeof(p_payload->'from') IS DISTINCT FROM 'string' OR jsonb_typeof(p_payload->'to') IS DISTINCT FROM 'string'
  OR jsonb_typeof(p_payload->'transition_date') IS DISTINCT FROM 'string' OR jsonb_typeof(p_payload->'fields') IS DISTINCT FROM 'object'
  OR jsonb_typeof(p_payload->'skip_reason') IS DISTINCT FROM 'string' OR jsonb_typeof(p_payload->'memo') IS DISTINCT FROM 'string'
  OR jsonb_typeof(p_payload->'note') IS DISTINCT FROM 'string'
 THEN RAISE EXCEPTION 'invalid structured transition payload' USING ERRCODE='22023'; END IF;
 from_value:=p_payload->>'from';to_value:=p_payload->>'to';fields_value:=p_payload->'fields';
 skip_value:=trim(p_payload->>'skip_reason');memo_value:=trim(p_payload->>'memo');note_value:=trim(p_payload->>'note');
 IF length(skip_value)>2000 OR length(memo_value)>8000 OR length(note_value)<1 OR length(note_value)>16000
  OR p_payload->>'transition_date' !~ '^\d{4}-\d{2}-\d{2}$'
 THEN RAISE EXCEPTION 'invalid structured transition payload' USING ERRCODE='22023'; END IF;
 BEGIN transition_value:=(p_payload->>'transition_date')::date; EXCEPTION WHEN datetime_field_overflow THEN RAISE EXCEPTION 'invalid transition date' USING ERRCODE='22023'; END;
 IF transition_value::text<>p_payload->>'transition_date' OR transition_value>(clock_timestamp() AT TIME ZONE 'Asia/Seoul')::date
 THEN RAISE EXCEPTION 'invalid transition date' USING ERRCODE='22023'; END IF;
 IF from_value IN ('won','lost','badfit','badfit_lead','badfit_pipe','nocontact') OR to_value IN ('won','lost','badfit','badfit_lead','badfit_pipe','nocontact') OR from_value=to_value
  OR to_value NOT IN ('first_contact','consulting','sent','rapport','silent','waiting','compete','imminent','bidding','contract','construction','completion')
 THEN RAISE EXCEPTION 'terminal or invalid transition is not connected' USING ERRCODE='22023'; END IF;
 standard:=CASE from_value
  WHEN 'first_contact' THEN to_value='consulting' WHEN 'consulting' THEN to_value='sent'
  WHEN 'sent' THEN to_value IN ('rapport','silent','compete') WHEN 'rapport' THEN to_value IN ('silent','compete')
  WHEN 'silent' THEN to_value IN ('rapport','compete') WHEN 'compete' THEN to_value IN ('imminent','bidding')
  WHEN 'imminent' THEN to_value IN ('bidding','contract') WHEN 'bidding' THEN to_value='contract'
  WHEN 'contract' THEN to_value='construction' WHEN 'construction' THEN to_value='completion'
  WHEN 'waiting' THEN to_value IN ('first_contact','rapport','silent') ELSE false END;
 IF to_value<>'waiting' AND NOT standard AND length(skip_value)<5
 THEN RAISE EXCEPTION 'transition exception reason is required' USING ERRCODE='22023'; END IF;
 PERFORM crm_security.crm_transition_validate_v1(to_value,fields_value,transition_value);
 canonical:=jsonb_build_object('from',from_value,'to',to_value,'transition_date',transition_value,'fields',fields_value,'skip_reason',skip_value,'memo',memo_value,'note',note_value);

 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.deal_id=p_object_id FOR SHARE;
 SELECT * INTO oldrow FROM public.deals d WHERE d.id=p_object_id FOR UPDATE;
 IF NOT FOUND OR a.permission_role NOT IN ('rep','branch','admin') OR NOT crm_security.can_deal(p_object_id,true)
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;

 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM 'transition'
   OR receipt.object_id IS DISTINCT FROM p_object_id OR receipt.expected_version IS DISTINCT FROM p_expected_version OR receipt.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;
 IF oldrow.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'version conflict' USING ERRCODE='PT409'; END IF;
 IF oldrow.stage_code IS DISTINCT FROM from_value OR oldrow.outcome IS NOT NULL OR oldrow.lifecycle_status='closed'
 THEN RAISE EXCEPTION 'stage state conflict' USING ERRCODE='PT409'; END IF;
 IF jsonb_typeof(oldrow.stage_contexts) IS DISTINCT FROM 'object'
 THEN RAISE EXCEPTION 'stage contexts state conflict' USING ERRCODE='PT409'; END IF;
 IF to_value='sent' AND (fields_value->'materials') ? '견적서' AND NOT EXISTS(
  SELECT 1 FROM crm_security.quote_versions q WHERE q.deal_id=p_object_id AND q.version_no=(fields_value->>'quote_version')::integer)
 THEN RAISE EXCEPTION 'quote version not found' USING ERRCODE='22023'; END IF;

 server_at:=clock_timestamp();effective_at:=transition_value::timestamp AT TIME ZONE 'Asia/Seoul';
 group_value:=CASE WHEN to_value IN ('first_contact','consulting') THEN 'design' WHEN to_value='sent' THEN 'sent' WHEN to_value IN ('rapport','silent','waiting') THEN 'rel' WHEN to_value IN ('compete','imminent','bidding') THEN 'comp' ELSE 'con' END;
 lifecycle_value:=CASE WHEN to_value='waiting' THEN 'parked' ELSE 'active' END;
 contexts:=jsonb_set(coalesce(oldrow.stage_contexts,'{}'::jsonb),ARRAY[to_value],jsonb_build_object('transition_date',transition_value,'skip_reason',skip_value,'memo',memo_value,'fields',fields_value,'from',from_value,'to',to_value,'recorded_at',server_at,'actor',a.display_name,'terminal',false),true);
 next_due:=CASE WHEN to_value='sent' THEN nullif(fields_value->>'followup_date','')::date WHEN to_value IN ('rapport','silent','waiting') THEN nullif(fields_value->>'contact_date','')::date ELSE NULL END;
 next_title:=CASE WHEN next_due IS NULL THEN NULL WHEN to_value='sent' THEN '발송자료 검토 여부 확인' ELSE '고객 재접촉' END;
 SELECT u.email,u.name INTO actor_email_value,owner_name_value FROM public.users u WHERE u.user_id=a.user_id;
 IF next_due IS NOT NULL THEN
  SELECT coalesce(jsonb_agg(id ORDER BY created_at),'[]'::jsonb) INTO cancelled_ids FROM public.next_actions WHERE deal_id=p_object_id AND status='open';
  UPDATE public.next_actions SET status='cancelled',updated_at=server_at WHERE deal_id=p_object_id AND status='open';
  SELECT coalesce(u.name,oldrow.assignee_name) INTO owner_name_value FROM public.users u WHERE u.user_id=oldrow.owner_id;
  IF owner_name_value IS NULL THEN RAISE EXCEPTION 'No approved UUID owner' USING ERRCODE='42501'; END IF;
  INSERT INTO public.next_actions(deal_id,action_type,title,due_at,assignee_name,status,created_at,updated_at)
  VALUES(p_object_id,'후속접촉',next_title,next_due::timestamp AT TIME ZONE 'Asia/Seoul',owner_name_value,'open',server_at,server_at) RETURNING id INTO next_id;
 END IF;
 INSERT INTO public.stage_history(opportunity_id,from_stage,to_stage,reason,actor_id,actor_name,changed_at)
 VALUES(p_object_id,from_value,to_value,coalesce(nullif(skip_value,''),note_value),a.user_id,a.display_name,effective_at) RETURNING id INTO history_id;
 INSERT INTO public.activities(deal_id,organization_id,actor_email,actor_name,type,detail,occurred_at)
 VALUES(p_object_id,oldrow.organization_id,actor_email_value,a.display_name,'단계전환',jsonb_build_object('note',to_value,'result',note_value,'from_stage',from_value,'to_stage',to_value,'meaningful_contact',false),effective_at) RETURNING id INTO activity_id;
 INSERT INTO crm_security.stage_transition_events(request_id,deal_id,from_stage,to_stage,transition_date,fields,skip_reason,memo,actor_auth_uid,actor_user_id,recorded_at,stage_history_id,activity_id,next_action_id)
 VALUES(p_request_id,p_object_id,from_value,to_value,transition_value,fields_value,nullif(skip_value,''),nullif(memo_value,''),a.auth_uid,a.user_id,server_at,history_id,activity_id,next_id) RETURNING event_id INTO transition_event_id;
 UPDATE public.deals SET stage_code=to_value,stage_raw=to_value,stage_group=group_value,lifecycle_status=lifecycle_value,
  stage_entered_at=effective_at,stage_contexts=contexts,last_activity_at=effective_at,
  next_action=CASE WHEN next_id IS NULL THEN next_action ELSE next_title END,
  next_action_date=CASE WHEN next_id IS NULL THEN next_action_date ELSE next_due END,
  updated_at=server_at,version=version+1
 WHERE id=p_object_id AND version=p_expected_version RETURNING * INTO newrow;
 IF NOT FOUND THEN RAISE EXCEPTION 'unexpected version mutation' USING ERRCODE='PT409'; END IF;
 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,p_object_id,'transition',
  jsonb_build_object('version',oldrow.version,'stage_code',oldrow.stage_code,'stage_group',oldrow.stage_group,'lifecycle_status',oldrow.lifecycle_status,'next_action',oldrow.next_action,'next_action_date',oldrow.next_action_date),
  jsonb_build_object('version',newrow.version,'stage_code',newrow.stage_code,'stage_group',newrow.stage_group,'lifecycle_status',newrow.lifecycle_status,'transition_event_id',transition_event_id,'stage_history_id',history_id,'activity_id',activity_id,'next_action_id',next_id,'cancelled_action_ids',cancelled_ids,'next_action',newrow.next_action,'next_action_date',newrow.next_action_date),
  coalesce(nullif(skip_value,''),note_value),server_at) RETURNING event_id INTO audit_id;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation','transition','object_id',p_object_id,
  'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'previous_version',p_expected_version,'version',newrow.version,
  'from_stage',from_value,'to_stage',to_value,'transition_date',transition_value,'stage_entered_at',effective_at,
  'stage_contexts',newrow.stage_contexts,'transition_event_id',transition_event_id,'stage_history_id',history_id,
  'activity_id',activity_id,'next_action_id',next_id,'cancelled_action_ids',cancelled_ids,'audit_event_id',audit_id,'server_at',server_at,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack)
 VALUES(a.auth_uid,p_request_id,a.user_id,'transition',p_object_id,p_expected_version,canonical,ack);
 RETURN ack;
END $fn$;

REVOKE EXECUTE ON FUNCTION crm_security.crm_deal_transition_command_v1(uuid,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
