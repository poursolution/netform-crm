-- Revert only this validator change. Preserve stored transition history.
begin;
do $rollback$
declare definition text := pg_get_functiondef('crm_security.crm_transition_validate_v1(text,jsonb,date)'::regprocedure);
begin
 if position('relationship-fields-v1:start' in definition)=0 then return; end if;
 definition:=replace(definition,$s$WHEN 'rapport' THEN ARRAY['reaction','likelihood','contact_date','relationship_reason','relationship_reason_detail']$s$,$s$WHEN 'rapport' THEN ARRAY['reaction','likelihood','contact_date']$s$);
 definition:=replace(definition,$s$WHEN 'silent' THEN ARRAY['reason','last_contact','contact_date','relationship_reason','relationship_reason_detail']$s$,$s$WHEN 'silent' THEN ARRAY['reason','last_contact','contact_date']$s$);
 definition:=regexp_replace(definition,E'\n -- relationship-fields-v1:start.*? -- relationship-fields-v1:end\n','', 's');
 execute definition;
end $rollback$;
commit;
