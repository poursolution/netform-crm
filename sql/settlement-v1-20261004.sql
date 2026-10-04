-- 정산 내역 v1 (2026-10-04 · design_handoff_rules '승인 요청 창 보완')
-- 예외 승인자가 승인한 '중복 리드 정산(실적 나눔)'과 '특별 인센티브'를 별도 항목으로 남기는 기록. 인센티브 정산 화면은 나중에 만든다 — 지금은 기록만.
-- 수주실적 · 계약실적 원장 · 영업건은 건드리지 않는다. 쓰기는 승인 함수(crm_approval_decide_v1)가 내부 함수로만 한다.
-- 표는 RLS 를 켜고 정책을 두지 않는다. 다시 실행해도 안전. 운영 적용: Supabase SQL 편집기에서 대표가 Run.

create table if not exists public.crm_settlement_items(
 id bigserial primary key,
 kind text not null check (kind in ('split','incentive')),
 deal_id text,
 request_id bigint,
 person text not null,
 person_id uuid,
 ratio numeric,
 amount numeric,
 pay_month text,
 payload jsonb not null default '{}'::jsonb,
 approved_by uuid,
 approved_by_name text,
 created_at timestamptz not null default now()
);
alter table public.crm_settlement_items enable row level security;
revoke all on table public.crm_settlement_items from public, anon, authenticated;
create index if not exists crm_settlement_items_deal on public.crm_settlement_items(deal_id,created_at desc);
create index if not exists crm_settlement_items_person on public.crm_settlement_items(person,created_at desc);

-- 기록(내부용): 승인 함수가 부른다. 직접 부를 수 없다.
create or replace function crm_security.settlement_add(p_kind text,p_deal text,p_request bigint,p_person text,p_ratio numeric,p_amount numeric,p_pay_month text,p_payload jsonb,p_actor uuid,p_actor_name text)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare v_person text:=nullif(btrim(coalesce(p_person,'')),''); v_pid uuid; cur public.crm_settlement_items%rowtype;
begin
 if p_kind not in ('split','incentive') or v_person is null then raise exception '정산 내역을 확인해 주세요' using errcode='22023'; end if;
 select u.user_id into v_pid from public.users u where btrim(u.name)=v_person order by u.active desc nulls last limit 1;
 if v_pid is null then raise exception '정산 대상은 계정에 있는 이름이어야 합니다' using errcode='22023'; end if;
 insert into public.crm_settlement_items(kind,deal_id,request_id,person,person_id,ratio,amount,pay_month,payload,approved_by,approved_by_name)
  values(p_kind,p_deal,p_request,v_person,v_pid,p_ratio,p_amount,p_pay_month,coalesce(p_payload,'{}'::jsonb),p_actor,p_actor_name) returning * into cur;
 return to_jsonb(cur);
end $fn$;
revoke all on function crm_security.settlement_add(text,text,bigint,text,numeric,numeric,text,jsonb,uuid,text) from public, anon, authenticated;

-- 읽기: 관리자 · 예외 승인자 = 전부, 그 밖 = 자기 항목만. 최근 300건.
create or replace function public.crm_settlement_list_v1(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare a record; adm boolean; v_deal text;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 adm:=a.permission_role='admin' or crm_security.approval_approver(a.user_id);
 v_deal:=nullif(btrim(coalesce(p->>'deal_id','')),'');
 return jsonb_build_object('ok',true,'rows',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id desc)
  from (select * from public.crm_settlement_items s where (adm or s.person_id=a.user_id) and (v_deal is null or s.deal_id=v_deal) order by s.created_at desc,s.id desc limit 300) r),'[]'::jsonb));
end $fn$;
revoke all on function public.crm_settlement_list_v1(jsonb) from public, anon;
grant execute on function public.crm_settlement_list_v1(jsonb) to authenticated;
