-- 실시간 변경 신호 (2026-09-26 · 대표 요구 "영업사원 데이터는 실시간 반영")
--
-- 문제: 화면은 실시간 구독을 하고 있었지만 대상이 뷰(opportunities)이거나 읽기 정책이 없는 테이블이라
--       서버가 알림을 전부 버렸다(9월 실시간 메시지 0건). 그래서 주기적으로 '전체'를 다시 받아 전송량 한도 초과.
-- 해결: 영업·문의와 그 하위 기록이 바뀌면 트리거가 "어느 영업/문의가 바뀌었는지(ID만)"를
--       비공개 방송 채널 'crm:changes' 로 보낸다. 행 내용은 보내지 않는다.
--       화면은 그 ID 1건만 기존 권한 검사 조회(crm_operational_source_v1, can_deal/can_inquiry)로 다시 읽어
--       목록에 끼워 넣고, 볼 수 없게 된 건(담당 변경·삭제)은 목록에서 뺀다.
-- 안전: 신호 실패가 업무 저장을 막지 않도록 예외를 삼킨다. 새 RPC 없음(릴리스 계약 영향 없음).
-- 되돌리기: 맨 아래 ROLLBACK 블록.
begin;

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
  perform realtime.send(
    jsonb_strip_nulls(jsonb_build_object('d', did, 'i', iid, 't', tg_table_name, 'op', lower(tg_op))),
    'change', 'crm:changes', true);
  return null;
exception when others then
  return null; -- 실시간은 보조 수단: 어떤 경우에도 업무 저장을 막지 않는다
end;
$$;

revoke all on function crm_security.crm_change_signal() from public, anon, authenticated;

-- (테이블, 영업 ID 컬럼, 문의 ID 컬럼) — '-' = 해당 없음
do $$
declare
  r record;
begin
  for r in select * from (values
    ('public','deals','id','-'),
    ('public','inquiries','-','id'),
    ('public','activities','deal_id','-'),
    ('public','next_actions','deal_id','inquiry_id'),
    ('public','stage_history','opportunity_id','-'),
    ('crm_security','quote_versions','deal_id','-'),
    ('crm_security','deal_attachments','deal_id','-'),
    ('crm_security','next_action_postponements','deal_id','-'),
    ('crm_security','message_reminders','deal_id','-'),
    ('crm_security','message_outcomes','deal_id','-'),
    ('crm_security','relationship_events','deal_id','-'),
    ('crm_security','object_scope','deal_id','inquiry_id'),
    ('crm_security','inquiry_audit_events','-','inquiry_id'),
    ('crm_security','inquiry_routing','-','inquiry_id')
  ) as t(s, tb, dcol, icol)
  loop
    execute format('drop trigger if exists crm_change_signal on %I.%I', r.s, r.tb);
    execute format(
      'create trigger crm_change_signal after insert or update or delete on %I.%I for each row execute function crm_security.crm_change_signal(%L, %L)',
      r.s, r.tb, r.dcol, r.icol);
  end loop;
end $$;

-- 비공개 채널 수신 권한: 로그인한 CRM 사용자만 'crm:changes' 방송을 받는다(내용은 ID뿐, 실제 조회는 권한 검사됨)
drop policy if exists "crm changes receive" on realtime.messages;
create policy "crm changes receive" on realtime.messages
  for select to authenticated
  using (realtime.topic() = 'crm:changes' and extension = 'broadcast');

commit;

-- 적용 확인: triggers 14 · policy 1 · fn 1
select (select count(*) from information_schema.triggers where trigger_name = 'crm_change_signal' and event_manipulation = 'UPDATE') as triggers,
       (select count(*) from pg_policies where schemaname = 'realtime' and policyname = 'crm changes receive') as policy,
       (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'crm_security' and p.proname = 'crm_change_signal') as fn;

-- ROLLBACK (필요할 때만 따로 실행)
-- do $$ declare r record; begin
--   for r in select event_object_schema s, event_object_table tb from information_schema.triggers where trigger_name='crm_change_signal' group by 1,2
--   loop execute format('drop trigger if exists crm_change_signal on %I.%I', r.s, r.tb); end loop; end $$;
-- drop policy if exists "crm changes receive" on realtime.messages;
-- drop function if exists crm_security.crm_change_signal();
