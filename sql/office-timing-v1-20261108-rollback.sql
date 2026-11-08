-- 되돌리기: AI 사무실 시간 기준 조회 v1(sql/office-timing-v1-20261108.sql)
-- 새로 만든 함수 6개(조회 1 + 보조 5)만 지운다. 표 · 자료 · 기존 조회(crm_operational_source_v1 · crm_dashboard_source_v1) · 저장 명령은 건드리지 않는다.
begin;
drop function if exists public.crm_office_timing_v1(text,uuid,integer);
drop function if exists crm_security.crm_office_activity_kind(text,jsonb);
drop function if exists crm_security.crm_office_attempt_only(text);
drop function if exists crm_security.crm_office_ctx_any_day(jsonb,text);
drop function if exists crm_security.crm_office_ctx_day(jsonb,text,text);
drop function if exists crm_security.crm_office_safe_day(text);
notify pgrst, 'reload schema';
commit;
