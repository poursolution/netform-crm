-- 관리팀 KPI 장기 추이 1년 (2026-10-03 핸드오프 design_handoff_kpi): 주간 결과 조회 상한을 26주 → 60주로.
-- 적용 전에는 '1년' 보기가 저장된 26주까지만 그려진다. 다시 실행해도 안전. 운영 적용: Supabase SQL 편집기에서 대표가 Run.
create or replace function public.crm_kpi_weekly_list_v1(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare a record; v_weeks int;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 v_weeks:=least(greatest(coalesce(nullif(p->>'weeks','')::int,4),1),60);
 return jsonb_build_object('ok',true,'rows',coalesce((
  select jsonb_agg(to_jsonb(w) order by w.week_start desc,w.promise_key)
  from public.kpi_weekly w where w.week_start>=current_date-(v_weeks*7+6)),'[]'::jsonb));
end $fn$;
revoke all on function public.crm_kpi_weekly_list_v1(jsonb) from public, anon;
grant execute on function public.crm_kpi_weekly_list_v1(jsonb) to authenticated;
