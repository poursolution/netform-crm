-- 되돌리기: 서버 판정 → 잔디 알림 v1(sql/office-alerts-notify-v1-20261110.sql)
-- 예약 작업은 판정만 하던 원래 모양으로 되돌리고, 알림 함수 · 설정 · 기록 표만 지운다(판정 · 결과표는 그대로).
begin;
do $$
begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  begin perform cron.schedule('crm-office-alerts','*/10 * * * *','select crm_security.crm_office_alerts_compute_v1()');
  exception when others then raise notice 'reschedule skipped: %', sqlerrm; end;
 end if;
end $$;
drop function if exists crm_security.crm_office_alerts_notify_v1(boolean);
drop function if exists crm_security.crm_office_over_text(integer,boolean);
drop function if exists crm_security.crm_office_rule_label(text);
drop table if exists crm_security.office_notify_log;
drop table if exists crm_security.office_alert_notified;
drop table if exists crm_security.office_notify_settings;
commit;
