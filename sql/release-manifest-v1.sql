-- 릴리스 계약 매니페스트 v1 (2026-09-25 · 컨설턴트 진단 1순위 'Release Drift')
-- 운영 DB에 실제로 있는(authenticated가 실행 가능한) crm_* 함수 이름 목록을 돌려준다.
-- 화면(release-contract.js)이 관리자 로그인 시 이 목록을 전송 허용 목록(CRM_RPC_ALLOW)과 대조해
-- 빠진 함수가 있으면 '서버 적용 대기' 배너를 띄우고 해당 기능을 숨긴다. 함수 이름만 노출(데이터 없음).
create or replace function public.crm_release_manifest_v1()
returns jsonb language sql stable security definer set search_path='' as $fn$
 select jsonb_build_object('ok',true,'contract_version',1,'checked_at',now(),
  'functions',coalesce((
   select jsonb_agg(p.proname order by p.proname)
   from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname like 'crm\_%' escape '\'
     and pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')),'[]'::jsonb))
$fn$;
revoke all on function public.crm_release_manifest_v1() from public, anon;
grant execute on function public.crm_release_manifest_v1() to authenticated;
