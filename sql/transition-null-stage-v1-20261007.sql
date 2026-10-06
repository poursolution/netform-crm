-- 단계 값이 비어 있는 과거 이관 건의 영업 재개 v1 (2026-10-07 · 정합성 ③ 남은 것 "단계 값 NULL 22건은 서버 SQL 필요")
-- 문제: 전환 명령 crm_security.crm_deal_transition_command_v1 은 저장된 stage_code 가 출발 단계(from)와 같아야 받는다(다르면 PT409).
--       예전 시스템에서 옮겨 온 자료 중 stage_code 가 NULL 인 건(2026-10-05 운영 조회 22건)은 어떤 출발 단계를 보내도 거절돼
--       화면이 [영업 재개] 대신 [서버 보완 요청]만 보여 주고 있다.
-- 하는 일: 함수 본문의 비교 한 줄만 바꾼다 — 저장된 값이 NULL 이면 출발 단계 'unclassified' 를 그 값으로 본다.
--          coalesce(oldrow.stage_code,'unclassified') IS DISTINCT FROM from_value
--          'unclassified' 는 CRM 단계 값이 아니므로 실제 단계가 있는 건에는 절대 맞지 않는다(기존 동작 그대로).
--          그 밖의 검사(버전 · 종료 여부 · 권한 · 필수 정보 · 이력 · 감사 기록)는 모두 그대로. 자료(deals 행)는 바꾸지 않는다.
-- 방식: 2026-10-05 마이그레이션(stage_transition_without_skip_reason)과 같이 pg_get_functiondef 로 현재 본문을 읽어 그 줄이 정확히 있을 때만 치환.
--       본문이 예상과 다르면 예외로 멈춘다(아무것도 바뀌지 않음). 이미 적용돼 있으면 NOTICE 만 내고 끝난다. 다시 실행해도 안전.
-- 화면: pipeline-scope.js(PipelineScope.fromCode · NULL_FROM) · stage-transition-ui.js(fromOf) — 이 SQL 을 Run 한 뒤에 병합한다(배포 순서: DB → 화면).
-- 운영 적용: Supabase SQL 편집기에서 대표가 Run.

DO $migration$
DECLARE
  target regprocedure := 'crm_security.crm_deal_transition_command_v1(uuid,uuid,integer,jsonb)'::regprocedure;
  definition text;
  old_line text := E' IF oldrow.stage_code IS DISTINCT FROM from_value OR oldrow.outcome IS NOT NULL OR oldrow.lifecycle_status=''closed''';
  new_line text := E' IF coalesce(oldrow.stage_code,''unclassified'') IS DISTINCT FROM from_value OR oldrow.outcome IS NOT NULL OR oldrow.lifecycle_status=''closed''';
BEGIN
  definition := pg_get_functiondef(target);
  IF strpos(definition, new_line) > 0 THEN
    RAISE NOTICE 'transition-null-stage-v1: already applied';
    RETURN;
  END IF;
  IF strpos(definition, old_line) = 0 THEN
    RAISE EXCEPTION 'Unexpected transition function body: review before patching (stage state conflict line not found)';
  END IF;
  EXECUTE replace(definition, old_line, new_line);
  RAISE NOTICE 'transition-null-stage-v1: applied';
END;
$migration$;

-- 확인(읽기 전용): true 한 줄이면 적용됨
-- select strpos(pg_get_functiondef('crm_security.crm_deal_transition_command_v1(uuid,uuid,integer,jsonb)'::regprocedure),
--               'coalesce(oldrow.stage_code,''unclassified'')') > 0 as applied;
-- 대상 건수(읽기 전용): 열린 건 중 stage_code 가 NULL 인 것
-- select count(*) from public.deals where stage_code is null and outcome is null and lifecycle_status is distinct from 'closed';
