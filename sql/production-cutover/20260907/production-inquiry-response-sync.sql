-- n8n 문의 응대 결과를 Production 정본에 반영하는 최소 호환 Adapter.
-- n8n service_role만 호출할 수 있으며 담당자/권한 정보는 변경하지 않는다.

CREATE TABLE IF NOT EXISTS crm_security.inquiry_first_response_backfill_20260907 AS
SELECT
  i.id,
  i.first_response_at AS before_first_response_at,
  i.responded_at AS before_responded_at,
  clock_timestamp() AS backed_up_at
FROM public.inquiries i
WHERE i.first_response_at IS NULL
  AND i.responded_at IS NOT NULL;

DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'crm_security.inquiry_first_response_backfill_20260907'::regclass
      AND c.contype = 'p'
  ) THEN
    ALTER TABLE crm_security.inquiry_first_response_backfill_20260907
      ADD PRIMARY KEY (id);
  END IF;
END
$block$;

REVOKE ALL ON TABLE crm_security.inquiry_first_response_backfill_20260907 FROM PUBLIC, anon, authenticated;

UPDATE public.inquiries i
SET first_response_at = i.responded_at
FROM crm_security.inquiry_first_response_backfill_20260907 b
WHERE b.id = i.id
  AND i.first_response_at IS NULL
  AND i.responded_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.crm_inquiry_response_sync_v1(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  requested_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  inquiry_uuid uuid;
  inquiry_sheet_row integer;
  inquiry_phone text;
  inquiry_brand text;
  status_value text;
  response_value text;
  next_action_value date;
  matched_inquiry public.inquiries%ROWTYPE;
  inquiry_count integer;
  server_at timestamptz := clock_timestamp();
  is_completed_response boolean;
  raw_patch jsonb;
BEGIN
  IF requested_role <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_payload IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
     OR EXISTS (
       SELECT 1
       FROM jsonb_object_keys(p_payload) AS k
       WHERE k NOT IN (
         'inquiry_id', 'sheet_row', 'phone', 'brand',
         'status', 'response_content', 'next_action_date'
       )
     )
  THEN
    RAISE EXCEPTION 'invalid response payload' USING ERRCODE = '22023';
  END IF;

  BEGIN
    inquiry_uuid := nullif(p_payload->>'inquiry_id', '')::uuid;
    inquiry_sheet_row := nullif(p_payload->>'sheet_row', '')::integer;
    next_action_value := nullif(p_payload->>'next_action_date', '')::date;
  EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow THEN
    RAISE EXCEPTION 'invalid inquiry identifier or next action date' USING ERRCODE = '22023';
  END;

  inquiry_phone := nullif(regexp_replace(coalesce(p_payload->>'phone', ''), '[^0-9]', '', 'g'), '');
  inquiry_brand := nullif(btrim(coalesce(p_payload->>'brand', '')), '');
  status_value := nullif(btrim(coalesce(p_payload->>'status', '')), '');
  response_value := nullif(btrim(coalesce(p_payload->>'response_content', '')), '');

  IF status_value IS NULL OR status_value NOT IN (
    '접수', '신규', '담당자 배정', '배정완료', '응대중',
    '전화응대 완료', '현장방문예정', '견적서 발송예정',
    '보류', '배드핏', '연락두절', '종결', '종료'
  ) THEN
    RAISE EXCEPTION 'invalid response status' USING ERRCODE = '22023';
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

  -- 부재/재시도는 응대 시도일 뿐 최초응대 완료로 계산하지 않는다.
  is_completed_response := status_value NOT IN ('접수', '신규', '담당자 배정', '배정완료')
                           AND response_value IS NOT NULL;

  IF matched_inquiry.status IS NOT DISTINCT FROM status_value
     AND coalesce(matched_inquiry.raw->>'응대내용', '') = coalesce(response_value, '')
     AND matched_inquiry.next_action_date IS NOT DISTINCT FROM coalesce(next_action_value, matched_inquiry.next_action_date)
     AND (NOT is_completed_response OR (
       matched_inquiry.first_response_at IS NOT NULL AND matched_inquiry.responded_at IS NOT NULL
     ))
  THEN
    RETURN jsonb_build_object(
      'ok', true,
      'changed', false,
      'reason', 'ALREADY_SYNCED',
      'inquiry_id', matched_inquiry.id,
      'status', matched_inquiry.status,
      'first_response_at', matched_inquiry.first_response_at,
      'responded_at', matched_inquiry.responded_at
    );
  END IF;

  raw_patch := jsonb_strip_nulls(jsonb_build_object(
    '진행상태', status_value,
    '응대내용', response_value,
    '응대완료일시', CASE WHEN is_completed_response
      THEN to_char(server_at AT TIME ZONE 'Asia/Seoul', 'YYYY. FMMM. FMDD. AM FMHH12:MI:SS')
      ELSE NULL
    END
  ));

  UPDATE public.inquiries i
  SET status = status_value,
      first_response_at = CASE
        WHEN is_completed_response THEN coalesce(i.first_response_at, server_at)
        ELSE i.first_response_at
      END,
      responded_at = CASE
        WHEN is_completed_response THEN server_at
        ELSE i.responded_at
      END,
      next_action_date = coalesce(next_action_value, i.next_action_date),
      raw = coalesce(i.raw, '{}'::jsonb) || raw_patch,
      updated_at = server_at
  WHERE i.id = matched_inquiry.id
  RETURNING * INTO matched_inquiry;

  RETURN jsonb_build_object(
    'ok', true,
    'changed', true,
    'reason', CASE WHEN is_completed_response THEN 'RESPONSE_SYNCED' ELSE 'RESPONSE_ATTEMPT_SYNCED' END,
    'inquiry_id', matched_inquiry.id,
    'status', matched_inquiry.status,
    'first_response_at', matched_inquiry.first_response_at,
    'responded_at', matched_inquiry.responded_at,
    'next_action_date', matched_inquiry.next_action_date,
    'server_at', server_at
  );
END
$function$;

REVOKE ALL ON FUNCTION public.crm_inquiry_response_sync_v1(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_inquiry_response_sync_v1(jsonb) TO service_role;
