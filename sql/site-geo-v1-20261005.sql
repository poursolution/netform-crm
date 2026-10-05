-- 현장 좌표 저장소 v1 (2026-10-05 · design_handoff_inquiry_site 2차 — 견적문의 상세 '근처에서 영업했던 현장' 지도)
-- 새 표 1개(site_geo) + 함수 3개. 기존 표 · 영업 자료 · 권한은 건드리지 않는다. 다시 실행해도 안전하다(if not exists / create or replace).
--   · site_geo: 현장(sites.site_id)마다 위도 · 경도 한 줄.
--       source = 'address'(주소로 찾음) | 'name'(주소가 없어 현장 이름으로 찾음 — 추정) | 'none'(찾지 못함 · 30일 뒤 다시 시도)
--       query = 변환에 쓴 주소 또는 검색어, matched = 지도 서비스가 돌려준 주소 · 장소명(나중에 사람이 대조할 수 있게).
--   · crm_site_geo_list_v1: 영업건 · 문의가 있는 현장의 좌표. 좌표가 없는 현장은 변환에 쓸 주소(현장 주소, 없으면 그 현장 문의의 주소) · 이름. + 지도 키.
--   · crm_site_geo_save_v1: 화면이 찾은 좌표를 저장(한 번에 100줄까지). 주소로 찾은 좌표를 이름 추정 · '못 찾음'으로 덮지 않는다.
--   · crm_map_config_v1: 카카오맵 JavaScript 키 등록 · 삭제(관리자만). 키는 crm_settings 에만 둔다 — 저장소 · 문서에는 남기지 않는다.
-- 모든 표는 RLS 를 켜고 정책을 두지 않는다 — 읽기 · 쓰기는 아래 함수로만(로그인한 CRM 사용자).
-- 운영 적용: Supabase SQL 편집기에서 대표가 Run. 화면은 CRMRelease 게이트로 함수가 있을 때만 지도를 연다.

create table if not exists public.site_geo(
 site_id uuid primary key,
 lat double precision,
 lng double precision,
 source text not null,
 query text not null,
 matched text,
 updated_by uuid,
 updated_at timestamptz not null default now(),
 constraint site_geo_source_ck check (source in ('address','name','none')),
 constraint site_geo_point_ck check ((source='none' and lat is null and lng is null) or (source<>'none' and lat between 32 and 39.5 and lng between 124 and 132.5))
);
alter table public.site_geo enable row level security;
revoke all on table public.site_geo from public, anon, authenticated;

create or replace function public.crm_site_geo_list_v1(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare a record;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 return jsonb_build_object('ok',true,
  'kakao_js_key',(select s.value#>>'{}' from public.crm_settings s where s.key='kakao_map_js_key'),
  -- 한 줄 = [site_id, lat, lng, source, address, site_name]. 좌표(또는 최근 30일 안의 '못 찾음')가 있으면 주소 · 이름은 비운다.
  'sites',coalesce((
   select jsonb_agg(jsonb_build_array(s.site_id,g.lat,g.lng,g.source,
     case when g.site_id is null then coalesce(nullif(btrim(s.address),''),
      (select nullif(btrim(i.address),'') from public.inquiries i where i.site_id=s.site_id and coalesce(btrim(i.address),'')<>'' order by i.created_at desc limit 1)) end,
     case when g.site_id is null then s.site_name end))
   from public.sites s
   left join public.site_geo g on g.site_id=s.site_id and (g.source<>'none' or g.updated_at>now()-interval '30 days')
   where g.site_id is not null
      or exists(select 1 from public.deals d where d.site_id=s.site_id)
      or exists(select 1 from public.inquiries i where i.site_id=s.site_id)),'[]'::jsonb));
end $fn$;
revoke all on function public.crm_site_geo_list_v1(jsonb) from public, anon;
grant execute on function public.crm_site_geo_list_v1(jsonb) to authenticated;

create or replace function public.crm_site_geo_save_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare a record; r jsonb; n int:=0; v_site uuid; v_lat double precision; v_lng double precision; v_src text; v_q text;
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
  exception when others then raise exception 'invalid payload' using errcode='22023'; end;
  if v_site is null or v_q='' or v_src is null or v_src not in ('address','name','none') then raise exception 'invalid payload' using errcode='22023'; end if;
  if v_src='none' then v_lat:=null; v_lng:=null;
  elsif v_lat is null or v_lng is null or v_lat not between 32 and 39.5 or v_lng not between 124 and 132.5 then
   raise exception 'invalid payload' using errcode='22023';
  end if;
  if not exists(select 1 from public.sites s where s.site_id=v_site) then continue; end if;
  insert into public.site_geo as g(site_id,lat,lng,source,query,matched,updated_by,updated_at)
   values(v_site,v_lat,v_lng,v_src,v_q,nullif(left(btrim(coalesce(r->>'matched','')),300),''),a.user_id,now())
  on conflict (site_id) do update
   set lat=excluded.lat,lng=excluded.lng,source=excluded.source,query=excluded.query,matched=excluded.matched,updated_by=excluded.updated_by,updated_at=excluded.updated_at
   where g.source='none' or excluded.source='address' or (g.source='name' and excluded.source='name');
  n:=n+1;
 end loop;
 return jsonb_build_object('ok',true,'saved',n);
end $fn$;
revoke all on function public.crm_site_geo_save_v1(jsonb) from public, anon;
grant execute on function public.crm_site_geo_save_v1(jsonb) to authenticated;

create or replace function public.crm_map_config_v1(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare a record; v text;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p)='object' and p ? 'kakao_js_key' then
  if a.permission_role<>'admin' then raise exception '관리자만 지도 키를 등록할 수 있습니다' using errcode='42501'; end if;
  v:=btrim(coalesce(p->>'kakao_js_key',''));
  if v='' then
   delete from public.crm_settings s where s.key='kakao_map_js_key';
  elsif v !~ '^[0-9A-Za-z]{16,64}$' then
   raise exception '키 형식이 올바르지 않습니다' using errcode='22023';
  else
   insert into public.crm_settings(key,value,updated_by,updated_at) values('kakao_map_js_key',to_jsonb(v),a.user_id,now())
   on conflict (key) do update set value=excluded.value,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
  end if;
 end if;
 return jsonb_build_object('ok',true,'kakao_js_key',(select s.value#>>'{}' from public.crm_settings s where s.key='kakao_map_js_key'));
end $fn$;
revoke all on function public.crm_map_config_v1(jsonb) from public, anon;
grant execute on function public.crm_map_config_v1(jsonb) to authenticated;
