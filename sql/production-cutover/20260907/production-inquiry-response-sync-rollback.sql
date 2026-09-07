UPDATE public.inquiries i
SET first_response_at = b.before_first_response_at,
    responded_at = b.before_responded_at
FROM crm_security.inquiry_first_response_backfill_20260907 b
WHERE b.id = i.id;

DROP FUNCTION IF EXISTS public.crm_inquiry_response_sync_v1(jsonb);

-- 백업 테이블은 rollback 검증이 끝날 때까지 보존한다.
