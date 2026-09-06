BEGIN;
DO $rollback$
DECLARE ddl text; changed text; old_block text; new_block text;
BEGIN
 SELECT pg_get_functiondef('crm_security.crm_operational_go_command_v1(uuid,text,uuid,integer,jsonb)'::regprocedure) INTO ddl;
 old_block:='UPDATE public.contact_assignments ca SET office_phone=nullif(p_payload->>''to_office_phone'',''''),started_at=(p_payload->>''moved_at'')::date,status=''current'',reason=reason'||chr(10)||
  '     WHERE ca.person_key=p_payload->>''person_key'' AND ca.site_name=btrim(p_payload->>''to_site'') AND ca.ended_at IS NULL;'||chr(10)||
  '    IF NOT FOUND THEN'||chr(10)||
  '     INSERT INTO public.contact_assignments(person_key,opportunity_id,site_name,office_phone,started_at,status,reason)'||chr(10)||
  '     VALUES(p_payload->>''person_key'',NULL,btrim(p_payload->>''to_site''),nullif(p_payload->>''to_office_phone'',''''),(p_payload->>''moved_at'')::date,''current'',reason);'||chr(10)||
  '    END IF;';
 new_block:='INSERT INTO public.contact_assignments(person_key,opportunity_id,site_name,office_phone,started_at,status,reason)'||chr(10)||
  '     VALUES(person_key,NULL,btrim(p_payload->>''to_site''),nullif(p_payload->>''to_office_phone'',''''),(p_payload->>''moved_at'')::date,''current'',reason)'||chr(10)||
  '     ON CONFLICT(person_key,site_name) WHERE ended_at IS NULL DO UPDATE SET office_phone=excluded.office_phone,started_at=excluded.started_at,status=''current'',reason=excluded.reason;';
 IF position(old_block in ddl)=0 THEN RAISE EXCEPTION 'contact move rollback drift'; END IF;
 changed:=replace(ddl,old_block,new_block);
 EXECUTE changed;
END $rollback$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_go_command_v1(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
