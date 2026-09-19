-- Align the existing private validator with the PC/mobile relationship form.
-- Preserve the function OID, owner, ACL and all other stage validation.
begin;
do $migration$
declare
 definition text := pg_get_functiondef('crm_security.crm_transition_validate_v1(text,jsonb,date)'::regprocedure);
 old_rapport text := $s$WHEN 'rapport' THEN ARRAY['reaction','likelihood','contact_date']$s$;
 old_silent text := $s$WHEN 'silent' THEN ARRAY['reason','last_contact','contact_date']$s$;
 marker text := $s$ IF p_to='first_contact' THEN$s$;
 validation text := $validation$
 -- relationship-fields-v1:start
 IF p_to IN ('rapport','silent') AND p_fields ?| ARRAY['relationship_reason','relationship_reason_detail'] THEN
  IF jsonb_typeof(p_fields->'relationship_reason') IS DISTINCT FROM 'string'
   OR p_fields->>'relationship_reason' NOT IN ('공사 일정 미정','예산 미확보','내년도 사업 검토','입주자대표회의 결정 대기','관리소장 변경 또는 내부 검토 대기','현재 타업체 진행 중','장기적인 관계 유지 필요','기타')
   OR (p_fields ? 'relationship_reason_detail' AND jsonb_typeof(p_fields->'relationship_reason_detail') IS DISTINCT FROM 'string')
   OR length(coalesce(p_fields->>'relationship_reason_detail',''))>2000
   OR (p_fields->>'relationship_reason'='기타' AND length(trim(coalesce(p_fields->>'relationship_reason_detail','')))<2)
  THEN RAISE EXCEPTION 'invalid relationship reason' USING ERRCODE='22023'; END IF;
  -- Only normalize the validator's local argument. The ledger keeps original fields.
  IF p_to='silent' THEN
   p_fields:=p_fields||jsonb_build_object('reason',CASE WHEN p_fields->>'relationship_reason'='기타' THEN p_fields->>'relationship_reason_detail' ELSE p_fields->>'relationship_reason' END);
  END IF;
 END IF;
 -- relationship-fields-v1:end
$validation$;
begin
 if position('relationship-fields-v1:start' in definition)>0 then return; end if;
 if position(old_rapport in definition)=0 or position(old_silent in definition)=0 or position(marker in definition)=0 then
  raise exception 'unexpected transition validator; no changes applied';
 end if;
 definition:=replace(definition,old_rapport,$s$WHEN 'rapport' THEN ARRAY['reaction','likelihood','contact_date','relationship_reason','relationship_reason_detail']$s$);
 definition:=replace(definition,old_silent,$s$WHEN 'silent' THEN ARRAY['reason','last_contact','contact_date','relationship_reason','relationship_reason_detail']$s$);
 definition:=replace(definition,marker,validation||marker);
 execute definition;
end $migration$;
commit;
