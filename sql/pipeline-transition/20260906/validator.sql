CREATE FUNCTION crm_security.crm_transition_field_date_v1(
 p_fields jsonb,p_key text,p_required boolean
) RETURNS date LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $fn$
DECLARE value text; parsed date;
BEGIN
 value:=p_fields->>p_key;
 IF value IS NULL OR value='' THEN
  IF p_required THEN RAISE EXCEPTION 'missing transition date field: %',p_key USING ERRCODE='22023'; END IF;
  RETURN NULL;
 END IF;
 IF jsonb_typeof(p_fields->p_key) IS DISTINCT FROM 'string' OR value !~ '^\d{4}-\d{2}-\d{2}$'
 THEN RAISE EXCEPTION 'invalid transition date field: %',p_key USING ERRCODE='22023'; END IF;
 BEGIN parsed:=value::date; EXCEPTION WHEN datetime_field_overflow THEN RAISE EXCEPTION 'invalid transition date field: %',p_key USING ERRCODE='22023'; END;
 IF parsed::text<>value THEN RAISE EXCEPTION 'invalid transition date field: %',p_key USING ERRCODE='22023'; END IF;
 RETURN parsed;
END $fn$;

CREATE FUNCTION crm_security.crm_transition_validate_v1(
 p_to text,p_fields jsonb,p_transition_date date
) RETURNS void LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $fn$
DECLARE allowed text[]; sent_date date; followup date; contact_date date; last_contact date;
 start_date date; contract_date date; completion_date date; support jsonb; checks jsonb;
BEGIN
 IF jsonb_typeof(p_fields) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'transition fields must be an object' USING ERRCODE='22023'; END IF;
 allowed:=CASE p_to
  WHEN 'first_contact' THEN ARRAY['needs','work_scope','expected_timing']
  WHEN 'consulting' THEN ARRAY['quote_request','required_materials','quote_due']
  WHEN 'sent' THEN ARRAY['materials','quote_version','recipient','sent_date','reaction','followup_date']
  WHEN 'rapport' THEN ARRAY['reaction','likelihood','contact_date']
  WHEN 'silent' THEN ARRAY['reason','last_contact','contact_date']
  WHEN 'waiting' THEN ARRAY['reason','last_contact','speaker','statement','resume_date','contact_date']
  WHEN 'compete' THEN ARRAY['competition_type','competitor','meeting_date','position','support']
  WHEN 'imminent' THEN ARRAY['final_terms','expected_contract','customer_intent','remaining_issues']
  WHEN 'bidding' THEN ARRAY['announcement_date','briefing_date','bid_deadline','bid_terms','bid_plan']
  WHEN 'contract' THEN ARRAY['bid_result','contract_amount','contract_status','contract_date','special_terms']
  WHEN 'construction' THEN ARRAY['start_date','contract_amount','handover','requests']
  WHEN 'completion' THEN ARRAY['completion_date','completion_checks','contract_amount','completion_documents','warranty','payment','customer_handover']
  ELSE NULL END;
 IF allowed IS NULL OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_fields) k WHERE NOT k=ANY(allowed))
 THEN RAISE EXCEPTION 'invalid transition fields' USING ERRCODE='22023'; END IF;

 IF p_to='first_contact' THEN
  IF length(trim(coalesce(p_fields->>'needs','')))<1 OR length(trim(coalesce(p_fields->>'work_scope','')))<1 THEN RAISE EXCEPTION 'required first contact fields missing' USING ERRCODE='22023'; END IF;
 ELSIF p_to='consulting' THEN
  IF length(trim(coalesce(p_fields->>'quote_request','')))<1 THEN RAISE EXCEPTION 'quote request is required' USING ERRCODE='22023'; END IF;
  PERFORM crm_security.crm_transition_field_date_v1(p_fields,'quote_due',true);
 ELSIF p_to='sent' THEN
  IF jsonb_typeof(p_fields->'materials') IS DISTINCT FROM 'array' OR jsonb_array_length(p_fields->'materials')<1
   OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_fields->'materials') x WHERE x NOT IN ('견적서','제안서','공법자료','기타자료'))
   OR length(trim(coalesce(p_fields->>'recipient','')))<1
  THEN RAISE EXCEPTION 'invalid sent fields' USING ERRCODE='22023'; END IF;
  IF (p_fields->'materials') ? '견적서' AND coalesce(p_fields->>'quote_version','') !~ '^\d+$'
  THEN RAISE EXCEPTION 'quote version is required' USING ERRCODE='22023'; END IF;
  IF coalesce(p_fields->>'reaction','')<>'' AND p_fields->>'reaction' NOT IN ('확인 전','검토중','추가자료 요청','가격협의') THEN RAISE EXCEPTION 'invalid reaction' USING ERRCODE='22023'; END IF;
  sent_date:=crm_security.crm_transition_field_date_v1(p_fields,'sent_date',true);
  followup:=crm_security.crm_transition_field_date_v1(p_fields,'followup_date',true);
  IF sent_date>p_transition_date OR followup<sent_date THEN RAISE EXCEPTION 'invalid sent date sequence' USING ERRCODE='22023'; END IF;
 ELSIF p_to='rapport' THEN
  IF length(trim(coalesce(p_fields->>'reaction','')))<1 OR (coalesce(p_fields->>'likelihood','')<>'' AND p_fields->>'likelihood' NOT IN ('높음','보통','낮음','미확인')) THEN RAISE EXCEPTION 'invalid rapport fields' USING ERRCODE='22023'; END IF;
  PERFORM crm_security.crm_transition_field_date_v1(p_fields,'contact_date',true);
 ELSIF p_to IN ('silent','waiting') THEN
  IF length(trim(coalesce(p_fields->>'reason','')))<1 THEN RAISE EXCEPTION 'waiting reason is required' USING ERRCODE='22023'; END IF;
  last_contact:=crm_security.crm_transition_field_date_v1(p_fields,'last_contact',false);
  contact_date:=crm_security.crm_transition_field_date_v1(p_fields,'contact_date',true);
  IF last_contact IS NOT NULL AND last_contact>p_transition_date THEN RAISE EXCEPTION 'last contact is after transition' USING ERRCODE='22023'; END IF;
  IF p_to='waiting' THEN PERFORM crm_security.crm_transition_field_date_v1(p_fields,'resume_date',false); END IF;
 ELSIF p_to='compete' THEN
  IF p_fields->>'competition_type' NOT IN ('PT','경쟁견적','가격협상','타공법 비교') OR (coalesce(p_fields->>'position','')<>'' AND p_fields->>'position' NOT IN ('우세','비슷','열세','모름')) THEN RAISE EXCEPTION 'invalid competition fields' USING ERRCODE='22023'; END IF;
  PERFORM crm_security.crm_transition_field_date_v1(p_fields,'meeting_date',false);
  support:=p_fields->'support';
  IF support IS NOT NULL AND (jsonb_typeof(support) IS DISTINCT FROM 'array' OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(support)x WHERE x NOT IN ('PT자료','비교자료','가격검토','임원지원','없음')) OR (support ? '없음' AND jsonb_array_length(support)>1)) THEN RAISE EXCEPTION 'invalid support fields' USING ERRCODE='22023'; END IF;
 ELSIF p_to='imminent' THEN
  IF length(trim(coalesce(p_fields->>'final_terms','')))<1 THEN RAISE EXCEPTION 'final terms are required' USING ERRCODE='22023'; END IF;
  PERFORM crm_security.crm_transition_field_date_v1(p_fields,'expected_contract',true);
 ELSIF p_to='bidding' THEN
  IF length(trim(coalesce(p_fields->>'bid_terms','')))<1 THEN RAISE EXCEPTION 'bid terms are required' USING ERRCODE='22023'; END IF;
  PERFORM crm_security.crm_transition_field_date_v1(p_fields,'announcement_date',false);PERFORM crm_security.crm_transition_field_date_v1(p_fields,'briefing_date',false);PERFORM crm_security.crm_transition_field_date_v1(p_fields,'bid_deadline',true);
 ELSIF p_to='contract' THEN
  IF p_fields->>'bid_result' NOT IN ('낙찰','우선협상','수의계약','확인중') OR p_fields->>'contract_status' NOT IN ('체결 예정','체결 완료') OR jsonb_typeof(p_fields->'contract_amount') IS DISTINCT FROM 'number' OR (p_fields->>'contract_amount')::numeric<=0 THEN RAISE EXCEPTION 'invalid contract fields' USING ERRCODE='22023'; END IF;
  contract_date:=crm_security.crm_transition_field_date_v1(p_fields,'contract_date',true);
  IF p_fields->>'contract_status'='체결 완료' AND contract_date>p_transition_date THEN RAISE EXCEPTION 'contract date is after transition' USING ERRCODE='22023'; END IF;
 ELSIF p_to='construction' THEN
  IF jsonb_typeof(p_fields->'contract_amount') IS DISTINCT FROM 'number' OR (p_fields->>'contract_amount')::numeric<=0 OR (coalesce(p_fields->>'handover','')<>'' AND p_fields->>'handover' NOT IN ('완료','진행중','미완료')) THEN RAISE EXCEPTION 'invalid construction fields' USING ERRCODE='22023'; END IF;
  start_date:=crm_security.crm_transition_field_date_v1(p_fields,'start_date',true);IF start_date>p_transition_date THEN RAISE EXCEPTION 'start date is after transition' USING ERRCODE='22023'; END IF;
 ELSIF p_to='completion' THEN
  completion_date:=crm_security.crm_transition_field_date_v1(p_fields,'completion_date',true);IF completion_date>p_transition_date THEN RAISE EXCEPTION 'completion date is after transition' USING ERRCODE='22023'; END IF;
  checks:=p_fields->'completion_checks';
  IF jsonb_typeof(checks) IS DISTINCT FROM 'array' OR NOT checks ?& ARRAY['공사 완료','준공검사 완료'] OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(checks)x WHERE x NOT IN ('공사 완료','준공검사 완료','하자보증서 전달','준공서류 전달')) THEN RAISE EXCEPTION 'invalid completion checks' USING ERRCODE='22023'; END IF;
  IF p_fields ? 'contract_amount' AND p_fields->>'contract_amount'<>'' AND (jsonb_typeof(p_fields->'contract_amount') IS DISTINCT FROM 'number' OR (p_fields->>'contract_amount')::numeric<0) THEN RAISE EXCEPTION 'invalid completion amount' USING ERRCODE='22023'; END IF;
  IF coalesce(p_fields->>'payment','')<>'' AND p_fields->>'payment' NOT IN ('청구전','청구완료','일부수금','완납') THEN RAISE EXCEPTION 'invalid payment' USING ERRCODE='22023'; END IF;
  IF coalesce(p_fields->>'customer_handover','')<>'' AND p_fields->>'customer_handover' NOT IN ('완료','확인필요') THEN RAISE EXCEPTION 'invalid customer handover' USING ERRCODE='22023'; END IF;
 END IF;
END $fn$;

REVOKE EXECUTE ON FUNCTION crm_security.crm_transition_field_date_v1(jsonb,text,boolean) FROM PUBLIC,anon,authenticated,service_role;
REVOKE EXECUTE ON FUNCTION crm_security.crm_transition_validate_v1(text,jsonb,date) FROM PUBLIC,anon,authenticated,service_role;
