-- 되돌리기: AI 사무실 서버 판정 v1(sql/office-alerts-v1-20261110.sql)
-- 예약 작업 · 함수 3개 · 결과표 2개만 지운다. 영업 자료와 사무실 조회(crm_office_timing_v1)는 그대로 둔다.
begin;
do $$
begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  begin perform cron.unschedule('crm-office-alerts'); exception when others then raise notice 'unschedule skipped: %', sqlerrm; end;
 end if;
end $$;
drop function if exists public.crm_office_alerts_refresh_v1();
drop function if exists public.crm_office_alerts_v1(text,integer,integer);
drop function if exists crm_security.crm_office_alerts_compute_v1();
drop function if exists crm_security.crm_office_biz_add(timestamptz,integer,time,time,date[]);
drop function if exists crm_security.crm_office_biz_minutes(timestamptz,timestamptz,time,time,date[]);
drop table if exists crm_security.office_alert_rules;
drop table if exists crm_security.office_alerts;
drop table if exists crm_security.office_alert_runs;
notify pgrst, 'reload schema';
commit;
