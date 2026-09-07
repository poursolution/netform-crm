CREATE OR REPLACE FUNCTION public.crm_inquiry_assignment_sync_v1(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  requested_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  target_name text;
  operation_name text;
  inquiry_uuid uuid;
  inquiry_sheet_row integer;
  inquiry_phone text;
  inquiry_brand text;
  expected_from text;
  expected_uuid uuid;
  matched_inquiry public.inquiries%ROWTYPE;
  target_user_id uuid;
  target_canonical_name text;
  target_count integer;
  inquiry_count integer;
  current_owner_name text;
  changed_at_value timestamptz;
  changed boolean := false;
BEGIN
  IF requested_role <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_payload IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid payload' USING ERRCODE = '22023';
  END IF;

  target_name := btrim(coalesce(p_payload->>'to', p_payload->>'assignee_name', ''));
  operation_name := lower(btrim(coalesce(p_payload->>'operation', 'assign')));
  expected_from := nullif(btrim(coalesce(p_payload->>'expected_from', '')), '');

  IF target_name = '' OR operation_name NOT IN ('assign', 'reassign') THEN
    RAISE EXCEPTION 'invalid assignment target or operation' USING ERRCODE = '22023';
  END IF;

  BEGIN
    inquiry_uuid := nullif(p_payload->>'inquiry_id', '')::uuid;
    inquiry_sheet_row := nullif(p_payload->>'sheet_row', '')::integer;
    expected_uuid := nullif(p_payload->>'expected_assigned_to', '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'invalid inquiry or expected owner identifier' USING ERRCODE = '22023';
  END;
  inquiry_phone := nullif(regexp_replace(coalesce(p_payload->>'phone', ''), '[^0-9]', '', 'g'), '');
  inquiry_brand := nullif(btrim(coalesce(p_payload->>'brand', '')), '');

  SELECT count(*), min(u.user_id::text)::uuid, min(u.name)
  INTO target_count, target_user_id, target_canonical_name
  FROM public.users u
  WHERE u.active IS TRUE
    AND btrim(u.name) = target_name;

  IF target_count <> 1 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'changed', false,
      'reason', CASE WHEN target_count = 0 THEN 'ACTIVE_USER_NOT_FOUND' ELSE 'ACTIVE_USER_NAME_AMBIGUOUS' END,
      'target_name', target_name
    );
  END IF;

  IF inquiry_uuid IS NOT NULL THEN
    SELECT count(*) INTO inquiry_count FROM public.inquiries i WHERE i.id = inquiry_uuid;
    IF inquiry_count = 1 THEN
      SELECT * INTO matched_inquiry FROM public.inquiries i WHERE i.id = inquiry_uuid FOR UPDATE;
    END IF;
  ELSIF inquiry_sheet_row IS NOT NULL THEN
    SELECT count(*) INTO inquiry_count FROM public.inquiries i WHERE i.sheet_row = inquiry_sheet_row;
    IF inquiry_count = 1 THEN
      SELECT * INTO matched_inquiry FROM public.inquiries i WHERE i.sheet_row = inquiry_sheet_row FOR UPDATE;
    END IF;
  ELSIF inquiry_phone IS NOT NULL AND inquiry_brand IS NOT NULL THEN
    SELECT count(*) INTO inquiry_count
    FROM public.inquiries i
    WHERE regexp_replace(coalesce(i.phone, ''), '[^0-9]', '', 'g') = inquiry_phone
      AND btrim(coalesce(i.brand, '')) = inquiry_brand;
    IF inquiry_count = 1 THEN
      SELECT * INTO matched_inquiry
      FROM public.inquiries i
      WHERE regexp_replace(coalesce(i.phone, ''), '[^0-9]', '', 'g') = inquiry_phone
        AND btrim(coalesce(i.brand, '')) = inquiry_brand
      FOR UPDATE;
    END IF;
  ELSE
    RAISE EXCEPTION 'inquiry_id, sheet_row, or phone+brand is required' USING ERRCODE = '22023';
  END IF;

  IF inquiry_count <> 1 OR matched_inquiry.id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'changed', false,
      'reason', CASE WHEN coalesce(inquiry_count, 0) = 0 THEN 'INQUIRY_NOT_FOUND' ELSE 'INQUIRY_MATCH_AMBIGUOUS' END
    );
  END IF;

  IF matched_inquiry.assigned_to = target_user_id THEN
    RETURN jsonb_build_object(
      'ok', true,
      'changed', false,
      'reason', 'ALREADY_SYNCED',
      'inquiry_id', matched_inquiry.id,
      'assigned_to', target_user_id,
      'assignee_name', target_canonical_name
    );
  END IF;

  IF matched_inquiry.assigned_to IS NOT NULL THEN
    SELECT u.name INTO current_owner_name
    FROM public.users u
    WHERE u.user_id = matched_inquiry.assigned_to;

    IF operation_name <> 'reassign'
      OR (expected_uuid IS NULL AND expected_from IS NULL)
      OR (expected_uuid IS NOT NULL AND expected_uuid IS DISTINCT FROM matched_inquiry.assigned_to)
      OR (expected_from IS NOT NULL AND btrim(coalesce(current_owner_name, '')) IS DISTINCT FROM expected_from)
    THEN
      RETURN jsonb_build_object(
        'ok', false,
        'changed', false,
        'reason', 'EXISTING_UUID_PRESERVED',
        'inquiry_id', matched_inquiry.id,
        'assigned_to', matched_inquiry.assigned_to,
        'assignee_name', coalesce(current_owner_name, matched_inquiry.assignee_name)
      );
    END IF;
  END IF;

  changed_at_value := clock_timestamp();
  UPDATE public.inquiries i
  SET assigned_to = target_user_id,
      assignee_name = target_canonical_name,
      assigned_at = CASE
        WHEN matched_inquiry.assigned_to IS DISTINCT FROM target_user_id THEN changed_at_value
        ELSE coalesce(matched_inquiry.assigned_at, changed_at_value)
      END,
      updated_at = changed_at_value
  WHERE i.id = matched_inquiry.id;
  changed := true;

  RETURN jsonb_build_object(
    'ok', true,
    'changed', changed,
    'reason', CASE WHEN matched_inquiry.assigned_to IS NULL THEN 'ASSIGNED' ELSE 'REASSIGNED' END,
    'inquiry_id', matched_inquiry.id,
    'assigned_to', target_user_id,
    'assignee_name', target_canonical_name,
    'server_at', changed_at_value
  );
END
$function$;

REVOKE EXECUTE ON FUNCTION public.crm_inquiry_assignment_sync_v1(jsonb)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_inquiry_assignment_sync_v1(jsonb)
TO service_role;

COMMENT ON FUNCTION public.crm_inquiry_assignment_sync_v1(jsonb) IS
'n8n 견적문의 배정 완료 후 assigned_to UUID를 동기화한다. 활성 사용자 이름과 문의가 각각 유일할 때만 처리하며, 재배정은 기존 담당자 CAS 조건을 요구한다.';
