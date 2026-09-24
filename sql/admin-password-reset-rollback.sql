-- 관리자 계정 관리 v1 되돌리기 — 감사 로그 테이블은 기록 보존을 위해 유지한다.
BEGIN;
DROP FUNCTION IF EXISTS public.crm_admin_reset_password_v1(uuid,text);
DROP FUNCTION IF EXISTS public.crm_admin_list_accounts_v1();
COMMIT;
