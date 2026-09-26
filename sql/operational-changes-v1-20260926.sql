-- 바뀐 것만 받기 (2026-09-26 대표: "운영데이터를 1시간에 222번이나 하는게 말이되?")
--
-- 문제: 화면을 새로 열 때마다(새로고침·잠든 탭 복귀·페이지 이동) 영업 1,166건과 문의 전체를 100건씩 약 18번에 걸쳐
--       다시 받았다(한 번 약 3MB). 9/26 1시간 로그: 운영 조회 222회 = 사무실 두 화면이 12번 새로 열림 × 18회.
--       주기 확인(영업 10분·문의 5분)도 매번 전체를 받았다.
-- 해결: 영업·문의가 바뀔 때 이미 도는 실시간 트리거(crm_change_signal)가 "무엇이 언제 바뀌었는지"를 장부에 한 줄 남긴다.
--       화면은 저장해 둔 목록을 먼저 보여주고 "마지막으로 받은 뒤 바뀐 번호"만 묻는다(1회) —
--       없으면 끝, 30건 이하면 그 건만 기존 1건 조회로, 더 많으면 그 영역만 전체로 받는다.
-- 노출: 번호(uuid)와 "지금 내가 볼 수 있는지"만. 바뀐 번호는 실시간 방송('crm:changes')이 이미 로그인 사용자에게 보내는 것과 같다.
--       내용은 기존 권한 검사 조회(crm_operational_source_v1)로만 읽는다.
-- 보관: 7일. 그보다 오래된 저장본은 전체를 다시 받는다(화면 저장본 자체도 24시간이면 만료).
-- 안전: 장부 기록 실패가 업무 저장을 막지 않는다(예외 삼킴). 되돌리기는 맨 아래.
begin;

create table if not exists crm_security.change_log(
  id bigint generated always as identity primary key,
  at timestamptz not null default clock_timestamp(),
  deal_id uuid,
  inquiry_id uuid
);
create index if not exists change_log_at_idx on crm_security.change_log(at);
revoke all on table crm_security.change_log from public, anon, authenticated;

-- 실시간 변경 신호 + 장부 기록 (sql/realtime-change-signal-20260926.sql 의 같은 함수에 장부 한 줄을 더함)
create or replace function crm_security.crm_change_signal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  j jsonb;
  did text;
  iid text;
begin
  if tg_op = 'DELETE' then j := to_jsonb(old); else j := to_jsonb(new); end if;
  did := case when tg_argv[0] = '-' then null else nullif(j ->> tg_argv[0], '') end;
  iid := case when tg_argv[1] = '-' then null else nullif(j ->> tg_argv[1], '') end;
  if did is null and iid is null then return null; end if;
  begin
    insert into crm_security.change_log(deal_id, inquiry_id) values (did::uuid, iid::uuid);
  exception when others then
    null; -- 장부는 보조 수단: 업무 저장을 막지 않는다
  end;
  perform realtime.send(
    jsonb_strip_nulls(jsonb_build_object('d', did, 'i', iid, 't', tg_table_name, 'op', lower(tg_op))),
    'change', 'crm:changes', true);
  return null;
exception when others then
  return null; -- 실시간은 보조 수단: 어떤 경우에도 업무 저장을 막지 않는다
end;
$$;
revoke all on function crm_security.crm_change_signal() from public, anon, authenticated;

-- p_since 이후 바뀐 영업·문의 번호와 "지금 내가 볼 수 있는지"(v). p_since 가 없으면 서버 시각만 돌려준다
-- (전체를 받기 직전에 불러 기준 시각으로 쓴다). 너무 많으면 truncated — 화면은 그 영역만 전체로 받는다.
create or replace function public.crm_operational_changes_v1(p_since timestamptz default null, p_limit integer default 500)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  lim integer := least(greatest(coalesce(p_limit, 500), 1), 2000);
  deals jsonb;
  inquiries jsonb;
  nd integer;
  ni integer;
begin
  if not exists(select 1 from crm_security.actor()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from crm_security.change_log where at < now() - interval '8 days'; -- 보통 0건(색인 사용)
  if p_since is null then
    return jsonb_build_object('ok', true, 'contract_version', 1, 'server_time', now(),
      'deals', '[]'::jsonb, 'inquiries', '[]'::jsonb, 'truncated', jsonb_build_object('deals', false, 'inquiries', false));
  end if;
  if p_since < now() - interval '7 days' then
    return jsonb_build_object('ok', true, 'contract_version', 1, 'server_time', now(), 'expired', true);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', x.deal_id, 'v', crm_security.can_deal(x.deal_id, false))), '[]'::jsonb), count(*)
    into deals, nd
    from (select distinct l.deal_id from crm_security.change_log l
          where l.at > p_since and l.deal_id is not null limit lim + 1) x;
  select coalesce(jsonb_agg(jsonb_build_object('id', x.inquiry_id, 'v', crm_security.can_inquiry(x.inquiry_id))), '[]'::jsonb), count(*)
    into inquiries, ni
    from (select distinct l.inquiry_id from crm_security.change_log l
          where l.at > p_since and l.inquiry_id is not null limit lim + 1) x;
  return jsonb_build_object('ok', true, 'contract_version', 1, 'server_time', now(),
    'deals', case when nd > lim then '[]'::jsonb else deals end,
    'inquiries', case when ni > lim then '[]'::jsonb else inquiries end,
    'truncated', jsonb_build_object('deals', nd > lim, 'inquiries', ni > lim));
end
$fn$;
revoke all on function public.crm_operational_changes_v1(timestamptz, integer) from public, anon;
grant execute on function public.crm_operational_changes_v1(timestamptz, integer) to authenticated;

commit;

-- 적용 확인: table 1 · fn 1 · 장부 기록 함수에 insert 포함 true
select (select count(*) from information_schema.tables where table_schema = 'crm_security' and table_name = 'change_log') as change_log,
       (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'crm_operational_changes_v1') as changes_fn,
       (select pg_get_functiondef('crm_security.crm_change_signal()'::regprocedure) like '%change_log%') as signal_logs;

-- ROLLBACK (필요할 때만 따로 실행 — 장부 없이 realtime-change-signal-20260926.sql 의 함수로 되돌린 뒤)
-- drop function if exists public.crm_operational_changes_v1(timestamptz, integer);
-- drop table if exists crm_security.change_log;
