-- Minimal Staging correction: avoid PL/pgSQL variable shadowing in ON CONFLICT inference.
BEGIN;
DO $fix$
DECLARE ddl text; changed text;
BEGIN
 SELECT pg_get_functiondef('crm_security.crm_operational_go_command_v1(uuid,text,uuid,integer,jsonb)'::regprocedure) INTO ddl;
 IF position('week_start date;' in ddl)=0
 OR position('ON CONFLICT(rep_user_id,week_start)' in ddl)=0
 THEN RAISE EXCEPTION 'manager comment function drift'; END IF;
 changed:=replace(ddl,'week_start date;','v_week_start date;');
 changed:=replace(changed,'week_start:=nullif(p_payload->>''week_start'','''')::date','v_week_start:=nullif(p_payload->>''week_start'','''')::date');
 changed:=replace(changed,'OR week_start IS NULL','OR v_week_start IS NULL');
 changed:=replace(changed,'VALUES(target_user.user_id,week_start,','VALUES(target_user.user_id,v_week_start,');
 changed:=replace(changed,'''week_start'',week_start,','''week_start'',v_week_start,');
 changed:=replace(changed,'ON CONFLICT(rep_user_id,week_start)','ON CONFLICT ON CONSTRAINT rep_manager_comments_pkey');
 IF changed=ddl OR position('v_week_start' in changed)=0 OR position('ON CONFLICT ON CONSTRAINT rep_manager_comments_pkey' in changed)=0
 THEN RAISE EXCEPTION 'manager comment patch failed'; END IF;
 EXECUTE changed;
END $fix$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_go_command_v1(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
