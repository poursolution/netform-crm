-- 운영 자료 큰 페이지 읽기 v2 (2026-10-01 컨설턴트 P1-12 — 로그인 뒤 crm_operational_source_v1이 15~17회 순차 호출돼 완비까지 약 11초)
-- v1은 한 번에 100건까지만 준다. v2는 서버 안에서 v1을 이어 불러 최대 p_limit건을 한 번에 돌려준다(왕복 횟수 12회 → 2회).
-- 권한·범위·행 모양은 v1 그대로(v1을 그대로 호출). 응답 모양도 v1과 같아 화면 검증(contract_version 1, pagination)을 통과한다.

create or replace function public.crm_operational_source_v2(p_domain text, p_after uuid default null, p_limit integer default 1000)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare
 acc jsonb:='[]'::jsonb; cur uuid:=p_after; r jsonb; n integer:=0; more boolean:=false; guard integer:=0;
begin
 if p_limit is null or p_limit not between 1 and 2000 then raise exception 'invalid limit' using errcode='22023'; end if;
 loop
  guard:=guard+1; if guard>40 then exit; end if;
  r:=public.crm_operational_source_v1(p_domain,cur,least(100,p_limit-n));
  if r is null or jsonb_typeof(r->'items') is distinct from 'array' then raise exception 'source contract mismatch' using errcode='22023'; end if;
  acc:=acc||(r->'items');
  n:=n+jsonb_array_length(r->'items');
  more:=coalesce((r->'pagination'->>'has_more')::boolean,false);
  if not more then exit; end if;
  cur:=(r->'pagination'->>'next_cursor')::uuid;
  if n>=p_limit then exit; end if;
 end loop;
 return jsonb_build_object('contract_version',1,'resource','operational_source','domain',p_domain,
  'scope_completeness','actor_authorized_rows_only','items',acc,
  'pagination',jsonb_build_object('completeness',case when more then 'partial' else 'complete' end,'has_more',more,
   'next_cursor',case when more then cur::text else null end));
end $fn$;
revoke all on function public.crm_operational_source_v2(text,uuid,integer) from public, anon;
grant execute on function public.crm_operational_source_v2(text,uuid,integer) to authenticated;

-- 확인
select proname from pg_proc where proname='crm_operational_source_v2';
