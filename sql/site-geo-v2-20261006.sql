-- 현장 좌표 저장소 v2 (2026-10-06 · 대표 "진행해" — 못 찾은 현장을 다듬은 규칙으로 바로 다시 찾기)
-- v1(sql/site-geo-v1-20261005.sql) 위에 덧붙인다. 표 · 함수 이름은 그대로(화면의 전송 허용 목록 변화 없음). 다시 실행해도 안전하다.
--   · site_geo.rule_version: 그 줄을 만든 찾기 규칙의 판(v1 = 1). 화면이 규칙을 다듬으면 판을 올리고, 예전 판에서 '못 찾음'이던 현장만 다시 찾는다.
--   · crm_site_geo_list_v1: '못 찾음' 줄도 주소 · 이름 · 규칙 판 · 그때 찾은 말(tried)을 같이 준다 — 화면이 "규칙이 새로워졌거나, 그 뒤에 주소가 채워진" 현장만 골라 다시 찾는다.
--       v1 의 '30일 동안 다시 찾지 않는다'는 없앤다(규칙 · 주소가 그대로면 다시 찾아도 같은 결과라, 날짜 대신 규칙 판 · 주소 변화로 판단한다).
--       한 줄 = [site_id, lat, lng, source, address, site_name, rule_version, tried]
--   · crm_site_geo_save_v1: 줄마다 rule(규칙 판)을 받아 적는다. 덮어쓰기 규칙은 v1 그대로(주소로 찾은 좌표를 이름 추정 · '못 찾음'으로 덮지 않는다).
-- 영업 자료 · 다른 표는 건드리지 않는다. 운영 적용: Supabase SQL 편집기에서 대표가 Run.

alter table public.site_geo add column if not exists rule_version integer not null default 1;

create or replace function public.crm_site_geo_list_v1(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare a record;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 return jsonb_build_object('ok',true,
  'kakao_js_key',(select s.value#>>'{}' from public.crm_settings s where s.key='kakao_map_js_key'),
  'sites',coalesce((
   select jsonb_agg(jsonb_build_array(s.site_id,g.lat,g.lng,g.source,
     case when g.site_id is null or g.source='none' then coalesce(nullif(btrim(s.address),''),
      (select nullif(btrim(i.address),'') from public.inquiries i where i.site_id=s.site_id and coalesce(btrim(i.address),'')<>'' order by i.created_at desc limit 1)) end,
     case when g.site_id is null or g.source='none' then s.site_name end,
     g.rule_version,
     case when g.source='none' then g.query end))
   from public.sites s
   left join public.site_geo g on g.site_id=s.site_id
   where g.site_id is not null
      or exists(select 1 from public.deals d where d.site_id=s.site_id)
      or exists(select 1 from public.inquiries i where i.site_id=s.site_id)),'[]'::jsonb));
end $fn$;
revoke all on function public.crm_site_geo_list_v1(jsonb) from public, anon;
grant execute on function public.crm_site_geo_list_v1(jsonb) to authenticated;

create or replace function public.crm_site_geo_save_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare a record; r jsonb; n int:=0; v_site uuid; v_lat double precision; v_lng double precision; v_src text; v_q text; v_rule integer;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' or jsonb_typeof(p->'rows') is distinct from 'array' or jsonb_array_length(p->'rows')>100 then
  raise exception 'invalid payload' using errcode='22023';
 end if;
 for r in select value from jsonb_array_elements(p->'rows') loop
  v_src:=r->>'source'; v_q:=left(btrim(coalesce(r->>'query','')),300);
  begin
   v_site:=(r->>'site_id')::uuid; v_lat:=(r->>'lat')::double precision; v_lng:=(r->>'lng')::double precision;
   v_rule:=coalesce(nullif(r->>'rule','')::integer,1);
  exception when others then raise exception 'invalid payload' using errcode='22023'; end;
  if v_site is null or v_q='' or v_src is null or v_src not in ('address','name','none') or v_rule<1 or v_rule>999 then raise exception 'invalid payload' using errcode='22023'; end if;
  if v_src='none' then v_lat:=null; v_lng:=null;
  elsif v_lat is null or v_lng is null or v_lat not between 32 and 39.5 or v_lng not between 124 and 132.5 then
   raise exception 'invalid payload' using errcode='22023';
  end if;
  if not exists(select 1 from public.sites s where s.site_id=v_site) then continue; end if;
  insert into public.site_geo as g(site_id,lat,lng,source,query,matched,rule_version,updated_by,updated_at)
   values(v_site,v_lat,v_lng,v_src,v_q,nullif(left(btrim(coalesce(r->>'matched','')),300),''),v_rule,a.user_id,now())
  on conflict (site_id) do update
   set lat=excluded.lat,lng=excluded.lng,source=excluded.source,query=excluded.query,matched=excluded.matched,rule_version=excluded.rule_version,updated_by=excluded.updated_by,updated_at=excluded.updated_at
   where g.source='none' or excluded.source='address' or (g.source='name' and excluded.source='name');
  n:=n+1;
 end loop;
 return jsonb_build_object('ok',true,'saved',n);
end $fn$;
revoke all on function public.crm_site_geo_save_v1(jsonb) from public, anon;
grant execute on function public.crm_site_geo_save_v1(jsonb) to authenticated;
