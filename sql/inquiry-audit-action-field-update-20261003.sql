-- 견적문의 감사 기록 action 허용 목록 보강 (2026-10-03)
-- 운영에서 crm_inquiry_field_update_v1 저장 시 "inquiry_audit_events_action_check 위반" 오류 확인 — 허용 목록에 'field_update'가 없었다.
-- 기존 목록은 그대로 두고 'field_update'와 'close'(상담 종결 함수가 쓰는 값)만 보탠다. 다시 실행해도 안전.
do $$
declare def text; newdef text;
begin
 select pg_get_constraintdef(c.oid) into def from pg_constraint c
  where c.conname='inquiry_audit_events_action_check' and c.conrelid='crm_security.inquiry_audit_events'::regclass;
 if def is null then
  raise notice 'inquiry_audit_events_action_check 없음 — 추가하지 않음';
  return;
 end if;
 if def like '%''field_update''%' and def like '%''close''%' then
  raise notice '이미 허용됨';
  return;
 end if;
 -- CHECK ((action = ANY (ARRAY['a'::text, 'b'::text]))) 모양의 끝에 값을 보탠다
 newdef:=regexp_replace(def,'\]\)\)\)\s*$',', ''field_update''::text, ''close''::text])))');
 if newdef=def then
  raise exception '제약 모양이 예상과 다릅니다: %',def;
 end if;
 execute 'alter table crm_security.inquiry_audit_events drop constraint inquiry_audit_events_action_check';
 execute 'alter table crm_security.inquiry_audit_events add constraint inquiry_audit_events_action_check '||newdef;
end $$;
