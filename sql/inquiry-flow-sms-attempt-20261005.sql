-- 견적문의 문자 보내기(2026-10-05 design_handoff_inquiry_sms): 보낸 문자 · 카카오('회신대기')를 연락 시도로 센다.
-- 접촉 · 최초 응대(first_connected_at)는 찍지 않는다. 화면(inquiry-flow.js kindOf)과 같은 기준.
-- ① 결과 → 종류 함수: 회신대기 = attempt  ② 이미 'wait'로 남은 기록을 attempt 로 옮기고, 그 문의의 최초 시도 · 시도 수 · 마지막 시도를 기록에서 다시 맞춘다.
-- 여러 번 돌려도 같은 결과. 문의 본문 · 상태 · 최초 접촉 시각은 건드리지 않는다.

create or replace function crm_security.inquiry_contact_kind(p_result text)
returns text language sql immutable set search_path='' as $fn$
 select case
  when p_result in ('부재','통화불가','번호오류','회신대기') then 'attempt'
  when p_result in ('연결됨','고객 회신','검토중','자료요청','견적요청') then 'connected'
  when p_result in ('보류','거절','연락 완료','대표회의 예정','재견적 요청','경쟁사 비교','계약 검토') then 'connected'
  else null end
$fn$;
revoke all on function crm_security.inquiry_contact_kind(text) from public, anon, authenticated;

with moved as (
 update crm_security.inquiry_contact_logs l set kind='attempt' where l.kind='wait' and l.result='회신대기' returning l.inquiry_id
), agg as (
 select l.inquiry_id,min(l.occurred_at) first_at,max(l.occurred_at) last_at,count(*)::int n
 from crm_security.inquiry_contact_logs l
 where l.inquiry_id in (select inquiry_id from moved) and (l.kind='attempt' or (l.kind='wait' and l.result='회신대기'))
 group by l.inquiry_id
)
update crm_security.inquiry_flow_state s set
 first_attempt_at=least(coalesce(s.first_attempt_at,a.first_at),a.first_at),
 last_attempt_at=greatest(coalesce(s.last_attempt_at,a.last_at),a.last_at),
 attempt_count=greatest(s.attempt_count,a.n),
 updated_at=clock_timestamp()
from agg a where a.inquiry_id=s.inquiry_id;

notify pgrst, 'reload schema';
