-- 견적문의 흐름 v5 (2026-10-13 대표 확정): 문의에서 넘어오는 영업건은 방문 완료 · 견적 발송 완료 모두 '컨설팅 설계'(consulting) 단계로 만든다.
-- 예전: 견적 발송 완료 → 'sent'(자료 발송완료), 그 밖 → 'consulting'.
-- 바꾸는 것은 단계를 정하는 함수 하나뿐 — 전환 명령(crm_inquiry_pipeline_promote_command_v1)의 다른 검증 · 이력 · 감사는 그대로.
-- 화면 · 전송 계층(crm.html qualifyStage · operational-adapter.js promotionStage)과 같은 값이어야 한다. 값이 다르면 전환 요청이 거절된다.
-- 이미 만들어진 영업건의 단계는 바꾸지 않는다(앞으로 넘어오는 건부터). 재실행 안전.
-- 되돌리기: 아래 함수 본문을  SELECT CASE WHEN p_status ~ '견적.*발송[[:space:]]*완료' THEN 'sent' ELSE 'consulting' END  로 다시 만들면 된다(화면도 같이 되돌려야 함).
begin;
create or replace function crm_security.crm_inquiry_pipeline_stage_v1(p_status text) returns text
language sql immutable strict set search_path='' as $fn$
 select 'consulting'::text
$fn$;
revoke execute on function crm_security.crm_inquiry_pipeline_stage_v1(text) from public,anon,authenticated,service_role;
commit;

-- 적용 확인: 두 값 모두 consulting 이어야 한다
select crm_security.crm_inquiry_pipeline_stage_v1('견적서 발송완료') as quote_sent,
       crm_security.crm_inquiry_pipeline_stage_v1('현장방문 완료') as visit_done;
