-- 견적 기능 v3 · 5단계: 원가 기준(노임 · 원가 요율 · 자재 단가) 업로드 → 초안 → 승인 (2026-10-11 design_handoff_quote_v3 3번)
-- ★ 먼저 sql/quote-v3-step1-20261011.sql 을 Run 해야 합니다(기준 표 6개가 거기서 만들어짐). 대표가 Supabase SQL 편집기에서 Run. 여러 번 실행해도 안전.
-- 하는 일:
--  ① 기준 표에 칸을 더한다 — 원가 요율: tier(공사규모 × 기간 · 대상액 구간 · 공사 종류) · fixed_amount(기초액) / 노임: trade_no / 자재: pack_size(포장 수량).
--     공법 기준(method) 도 같은 흐름: 통합관리표의 공법별 일위대가(재료 · 노무 구성)를 올려 초안 → 승인 (6단계 공법견적이 읽는다).
--  ② 함수 4개(쓰기는 관리자 전용 · 읽기는 영업/팀장/관리자 — 견적을 쓸 때 시행일에 맞는 승인 기준을 읽어야 해서):
--      crm_cost_standard_list_v1    승인된 기준 전체 + (관리자) 초안 + 최근 승인 기록
--      crm_cost_standard_stage_v1   올린 파일에서 읽은 항목을 '초안'으로 저장(같은 종류의 이전 초안은 대체). 같은 항목 · 같은 시행일에 이미 승인된 값이 있으면 건너뛰고 알려 줌
--      crm_cost_standard_approve_v1 초안 → 사용 중(active). 출처가 비어 있는 항목이 하나라도 있으면 승인 거절. 승인 기록을 남김
--      crm_cost_standard_discard_v1 초안 버리기
--  ③ 승인된 기준은 지우거나 덮지 않는다 — 새 값은 새 시행일의 새 줄. 어떤 견적이든 그 견적일에 시행 중이던 기준(시행일이 견적일 이전인 가장 늦은 줄)을 쓴다.
-- 하지 않는 것: 이미 확정 · 발송한 견적의 재계산(기준이 바뀌어도 건드리지 않음) · 공법 기준(method_specs, 6단계).

begin;

alter table public.crm_cost_rates add column if not exists tier text not null default '';
alter table public.crm_cost_rates add column if not exists fixed_amount numeric(18,2) not null default 0;
alter table public.crm_labor_rates add column if not exists trade_no text;
alter table public.crm_material_prices add column if not exists pack_size numeric(14,4);
update public.crm_material_prices set spec='' where spec is null;
alter table public.crm_material_prices alter column spec set default '';
alter table public.crm_material_prices alter column spec set not null;

-- 원가 요율 고유 키: (항목, 항목 구분, 시행일) — 예전 (항목, 시행일) 제약은 구간표를 담지 못해 바꾼다
do $$ declare c record; begin
  for c in select con.conname from pg_constraint con where con.conrelid='public.crm_cost_rates'::regclass and con.contype='u'
    and (select array_agg(a.attname::text order by a.attname::text) from pg_attribute a where a.attrelid=con.conrelid and a.attnum=any(con.conkey))=array['effective_from','item']
  loop execute format('alter table public.crm_cost_rates drop constraint %I',c.conname); end loop;
end $$;
create unique index if not exists crm_cost_rates_item_tier_from_uq on public.crm_cost_rates(item,tier,effective_from);

create table if not exists public.crm_cost_standard_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('labor','cost','material','method')),
  action text not null check (action in ('stage','approve','discard')),
  effective_from date, source text, row_count integer not null default 0, skipped_count integer not null default 0,
  actor_name text, created_at timestamptz not null default now()
);
do $$ begin
  alter table public.crm_cost_standard_events drop constraint if exists crm_cost_standard_events_kind_check;
  alter table public.crm_cost_standard_events add constraint crm_cost_standard_events_kind_check check (kind in ('labor','cost','material','method'));
end $$;
alter table public.crm_cost_standard_events enable row level security;
revoke all on public.crm_cost_standard_events from anon, authenticated;
grant select, insert on public.crm_cost_standard_events to service_role;

create or replace function public.crm_cost_standard_list_v1(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare a record; adm boolean; v_labor jsonb; v_cost jsonb; v_mat jsonb; v_met jsonb; v_ev jsonb;
begin
 select * into a from crm_security.actor();
 if not found or a.permission_role not in ('rep','branch','admin') then raise exception 'forbidden' using errcode='42501'; end if;
 adm:=a.permission_role='admin';
 select coalesce(jsonb_agg(jsonb_build_object('trade',trade,'trade_no',trade_no,'daily_wage',daily_wage,'effective_from',effective_from,'status',status,'source',source,'approved_by',approved_by,'approved_at',approved_at) order by trade_no,effective_from desc),'[]'::jsonb)
  into v_labor from public.crm_labor_rates where status<>'draft' or adm;
 select coalesce(jsonb_agg(jsonb_build_object('item',item,'tier',tier,'category',category,'base_of',base_of,'rate',rate,'fixed_amount',fixed_amount,'effective_from',effective_from,'status',status,'source',source,'approved_by',approved_by,'approved_at',approved_at) order by item,tier,effective_from desc),'[]'::jsonb)
  into v_cost from public.crm_cost_rates where status<>'draft' or adm;
 select coalesce(jsonb_agg(jsonb_build_object('item',item,'spec',spec,'unit',unit,'pack_size',pack_size,'unit_price',unit_price,'price_date',price_date,'status',status,'source',source,'approved_by',approved_by,'approved_at',approved_at) order by item,spec,price_date desc),'[]'::jsonb)
  into v_mat from public.crm_material_prices where status<>'draft' or adm;
 select coalesce(jsonb_agg(jsonb_build_object('method',method,'composition',composition,'effective_from',effective_from,'status',status,'source',source,'approved_by',approved_by,'approved_at',approved_at) order by method,effective_from desc),'[]'::jsonb)
  into v_met from public.crm_method_specs where status<>'draft' or adm;
 select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc),'[]'::jsonb) into v_ev
  from (select kind,action,effective_from,source,row_count,skipped_count,actor_name,created_at from public.crm_cost_standard_events order by created_at desc limit 20) e;
 return jsonb_build_object('ok',true,'labor',v_labor,'cost',v_cost,'material',v_mat,'method',v_met,'events',v_ev,'can_manage',adm);
end $fn$;

create or replace function public.crm_cost_standard_stage_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare a record; v_kind text; v_src text; v_rows jsonb; r jsonb; v_n int:=0; v_skip jsonb:='[]'::jsonb; v_first date; v_exist record;
begin
 select * into a from crm_security.actor();
 if not found or a.permission_role<>'admin' then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 v_kind:=p->>'kind'; v_rows:=p->'rows'; v_src:=nullif(left(btrim(coalesce(p->>'source','')),500),'');
 if v_kind not in ('labor','cost','material','method') or jsonb_typeof(v_rows) is distinct from 'array' or jsonb_array_length(v_rows)=0 or jsonb_array_length(v_rows)>600 then
  raise exception 'invalid payload' using errcode='22023';
 end if;
 if v_kind='labor' then delete from public.crm_labor_rates where status='draft';
 elsif v_kind='cost' then delete from public.crm_cost_rates where status='draft';
 elsif v_kind='method' then delete from public.crm_method_specs where status='draft';
 else delete from public.crm_material_prices where status='draft'; end if;
 for r in select value from jsonb_array_elements(v_rows) loop
  if jsonb_typeof(r) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
  if v_kind='labor' then
   if nullif(btrim(r->>'trade'),'') is null or (r->>'daily_wage')::numeric<=0 or (r->>'daily_wage')::numeric>10000000 then raise exception 'invalid row: %',coalesce(r->>'trade','?') using errcode='22023'; end if;
   select * into v_exist from public.crm_labor_rates x where x.trade=r->>'trade' and x.effective_from=(r->>'effective_from')::date;
   if found then v_skip:=v_skip||jsonb_build_array((r->>'trade')||' '||(r->>'effective_from')); continue; end if;
   insert into public.crm_labor_rates(trade,trade_no,daily_wage,effective_from,status,source,created_by)
    values(r->>'trade',nullif(r->>'trade_no',''),(r->>'daily_wage')::numeric,(r->>'effective_from')::date,'draft',coalesce(nullif(btrim(r->>'source'),''),v_src),a.display_name);
  elsif v_kind='cost' then
   if nullif(btrim(r->>'item'),'') is null or r->>'category' not in ('statutory','company','needs_check') or (r->>'rate')::numeric<0 or (r->>'rate')::numeric>5 then raise exception 'invalid row: %',coalesce(r->>'item','?') using errcode='22023'; end if;
   select * into v_exist from public.crm_cost_rates x where x.item=r->>'item' and x.tier=coalesce(r->>'tier','') and x.effective_from=(r->>'effective_from')::date;
   if found then v_skip:=v_skip||jsonb_build_array((r->>'item')||coalesce(' · '||nullif(r->>'tier',''),'')||' '||(r->>'effective_from')); continue; end if;
   insert into public.crm_cost_rates(item,tier,category,base_of,rate,fixed_amount,effective_from,status,source,created_by)
    values(r->>'item',coalesce(r->>'tier',''),r->>'category',nullif(r->>'base_of',''),(r->>'rate')::numeric,coalesce((r->>'fixed_amount')::numeric,0),(r->>'effective_from')::date,'draft',coalesce(nullif(btrim(r->>'source'),''),v_src),a.display_name);
  elsif v_kind='method' then
   if nullif(btrim(r->>'method'),'') is null or jsonb_typeof(r->'composition') is distinct from 'object' or jsonb_typeof(r->'composition'->'materials') is distinct from 'array' or length((r->'composition')::text)>20000 then raise exception 'invalid row: %',coalesce(r->>'method','?') using errcode='22023'; end if;
   select * into v_exist from public.crm_method_specs x where x.method=r->>'method' and x.effective_from=(r->>'effective_from')::date;
   if found then v_skip:=v_skip||jsonb_build_array((r->>'method')||' '||(r->>'effective_from')); continue; end if;
   insert into public.crm_method_specs(method,composition,effective_from,status,source,created_by)
    values(r->>'method',r->'composition',(r->>'effective_from')::date,'draft',coalesce(nullif(btrim(r->>'source'),''),v_src),a.display_name);
  else
   if nullif(btrim(r->>'item'),'') is null or (r->>'unit_price')::numeric<0 then raise exception 'invalid row: %',coalesce(r->>'item','?') using errcode='22023'; end if;
   select * into v_exist from public.crm_material_prices x where x.item=r->>'item' and x.spec=coalesce(r->>'spec','') and x.price_date=(r->>'price_date')::date;
   if found then v_skip:=v_skip||jsonb_build_array((r->>'item')||coalesce(' · '||nullif(r->>'spec',''),'')||' '||(r->>'price_date')); continue; end if;
   insert into public.crm_material_prices(item,spec,unit,pack_size,unit_price,price_date,status,source,created_by)
    values(r->>'item',coalesce(r->>'spec',''),nullif(r->>'unit',''),nullif(r->>'pack_size','')::numeric,(r->>'unit_price')::numeric,(r->>'price_date')::date,'draft',coalesce(nullif(btrim(r->>'source'),''),v_src),a.display_name);
  end if;
  v_n:=v_n+1;
  if v_first is null then v_first:=coalesce((r->>'effective_from')::date,(r->>'price_date')::date); end if;
 end loop;
 insert into public.crm_cost_standard_events(kind,action,effective_from,source,row_count,skipped_count,actor_name) values(v_kind,'stage',v_first,v_src,v_n,jsonb_array_length(v_skip),a.display_name);
 return jsonb_build_object('ok',true,'kind',v_kind,'staged',v_n,'skipped',v_skip);
end $fn$;

create or replace function public.crm_cost_standard_approve_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare a record; v_kind text; v_n int; v_nosrc int; v_first date; v_src text;
begin
 select * into a from crm_security.actor();
 if not found or a.permission_role<>'admin' then raise exception 'forbidden' using errcode='42501'; end if;
 v_kind:=p->>'kind';
 if v_kind not in ('labor','cost','material','method') then raise exception 'invalid payload' using errcode='22023'; end if;
 if v_kind='labor' then
  select count(*), count(*) filter (where nullif(btrim(source),'') is null), min(effective_from), min(source) into v_n,v_nosrc,v_first,v_src from public.crm_labor_rates where status='draft';
 elsif v_kind='cost' then
  select count(*), count(*) filter (where nullif(btrim(source),'') is null), min(effective_from), min(source) into v_n,v_nosrc,v_first,v_src from public.crm_cost_rates where status='draft';
 elsif v_kind='method' then
  select count(*), count(*) filter (where nullif(btrim(source),'') is null), min(effective_from), min(source) into v_n,v_nosrc,v_first,v_src from public.crm_method_specs where status='draft';
 else
  select count(*), count(*) filter (where nullif(btrim(source),'') is null), min(price_date), min(source) into v_n,v_nosrc,v_first,v_src from public.crm_material_prices where status='draft';
 end if;
 if v_n=0 then raise exception '승인할 초안이 없습니다' using errcode='22023'; end if;
 if v_nosrc>0 then raise exception '출처가 없는 항목이 %개 있습니다. 출처 없이는 승인할 수 없습니다',v_nosrc using errcode='22023'; end if;
 if v_kind='labor' then update public.crm_labor_rates set status='active',approved_by=a.display_name,approved_at=now() where status='draft';
 elsif v_kind='cost' then update public.crm_cost_rates set status='active',approved_by=a.display_name,approved_at=now() where status='draft';
 elsif v_kind='method' then update public.crm_method_specs set status='active',approved_by=a.display_name,approved_at=now() where status='draft';
 else update public.crm_material_prices set status='active',approved_by=a.display_name,approved_at=now() where status='draft'; end if;
 insert into public.crm_cost_standard_events(kind,action,effective_from,source,row_count,actor_name) values(v_kind,'approve',v_first,v_src,v_n,a.display_name);
 return jsonb_build_object('ok',true,'kind',v_kind,'approved',v_n,'effective_from',v_first);
end $fn$;

create or replace function public.crm_cost_standard_discard_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare a record; v_kind text; v_n int;
begin
 select * into a from crm_security.actor();
 if not found or a.permission_role<>'admin' then raise exception 'forbidden' using errcode='42501'; end if;
 v_kind:=p->>'kind';
 if v_kind='labor' then delete from public.crm_labor_rates where status='draft'; get diagnostics v_n=row_count;
 elsif v_kind='cost' then delete from public.crm_cost_rates where status='draft'; get diagnostics v_n=row_count;
 elsif v_kind='material' then delete from public.crm_material_prices where status='draft'; get diagnostics v_n=row_count;
 elsif v_kind='method' then delete from public.crm_method_specs where status='draft'; get diagnostics v_n=row_count;
 else raise exception 'invalid payload' using errcode='22023'; end if;
 insert into public.crm_cost_standard_events(kind,action,row_count,actor_name) values(v_kind,'discard',v_n,a.display_name);
 return jsonb_build_object('ok',true,'kind',v_kind,'discarded',v_n);
end $fn$;

revoke all on function public.crm_cost_standard_list_v1(jsonb) from public, anon;
revoke all on function public.crm_cost_standard_stage_v1(jsonb) from public, anon;
revoke all on function public.crm_cost_standard_approve_v1(jsonb) from public, anon;
revoke all on function public.crm_cost_standard_discard_v1(jsonb) from public, anon;
grant execute on function public.crm_cost_standard_list_v1(jsonb) to authenticated;
grant execute on function public.crm_cost_standard_stage_v1(jsonb) to authenticated;
grant execute on function public.crm_cost_standard_approve_v1(jsonb) to authenticated;
grant execute on function public.crm_cost_standard_discard_v1(jsonb) to authenticated;

commit;
