-- 관리자 요청 실시간 변경 신호 (2026-10-20 design_handoff_six_fixes ③ "어디서 처리하든 다른 기기에 새로고침 없이")
--
-- 문제: 요청(crm_security.work_requests)에는 변경 신호 트리거가 없어서, 모바일에서 요청을 처리해도
--       PC는 최대 60초 뒤 다시 읽을 때까지 예전 상태(미확인 · 처리 중)를 보여 줬다(반대도 같음).
-- 해결: 요청이 생기거나 바뀌면 기존 비공개 방송 채널 'crm:changes' 로 "바뀐 대상 ID + 표 이름(work_requests)"만 보낸다.
--       행 내용은 보내지 않는다. 화면(work-request.js · mobile-requests.js)은 이 신호를 받으면 기존 권한 검사 조회
--       (crm_work_request_list_v1)로 다시 읽는다. 새 RPC 없음(릴리스 계약 영향 없음).
-- 안전: 신호 실패가 요청 저장을 막지 않도록 예외를 삼킨다(2026-09-26 신호 함수와 같은 방식).
-- 되돌리기: 맨 아래 ROLLBACK 블록.
begin;

create or replace function crm_security.crm_work_request_signal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  tid text;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  tid := nullif(r.target_id::text, '');
  perform realtime.send(
    jsonb_strip_nulls(jsonb_build_object(
      'd', case when r.target_type = 'deal' then tid end,
      'i', case when r.target_type = 'inquiry' then tid end,
      't', 'work_requests', 'op', lower(tg_op))),
    'change', 'crm:changes', true);
  return null;
exception when others then
  return null; -- 실시간은 보조 수단: 어떤 경우에도 요청 저장을 막지 않는다
end;
$$;

revoke all on function crm_security.crm_work_request_signal() from public, anon, authenticated;

drop trigger if exists crm_work_request_signal on crm_security.work_requests;
create trigger crm_work_request_signal
  after insert or update or delete on crm_security.work_requests
  for each row execute function crm_security.crm_work_request_signal();

commit;

-- 확인(읽기만): 트리거가 붙었는지
-- select tgname from pg_trigger where tgrelid = 'crm_security.work_requests'::regclass and not tgisinternal;

-- ROLLBACK (되돌릴 때만)
-- begin;
-- drop trigger if exists crm_work_request_signal on crm_security.work_requests;
-- drop function if exists crm_security.crm_work_request_signal();
-- commit;
