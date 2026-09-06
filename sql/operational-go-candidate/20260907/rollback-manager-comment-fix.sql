-- Restore the pre-fix function text if the incremental patch must be reverted.
BEGIN;
DO $rollback$
DECLARE ddl text; changed text;
BEGIN
 SELECT pg_get_functiondef('crm_security.crm_operational_go_command_v1(uuid,text,uuid,integer,jsonb)'::regprocedure) INTO ddl;
 IF position('v_week_start date;' in ddl)=0 OR position('ON CONFLICT ON CONSTRAINT rep_manager_comments_pkey' in ddl)=0
 THEN RAISE EXCEPTION 'manager comment rollback drift'; END IF;
 changed:=replace(ddl,'v_week_start date;','week_start date;');
 changed:=replace(changed,'v_week_start:=nullif(p_payload->>''week_start'','''')::date','week_start:=nullif(p_payload->>''week_start'','''')::date');
 changed:=replace(changed,'OR v_week_start IS NULL','OR week_start IS NULL');
 changed:=replace(changed,'VALUES(target_user.user_id,v_week_start,','VALUES(target_user.user_id,week_start,');
 changed:=replace(changed,'''week_start'',v_week_start,','''week_start'',week_start,');
 changed:=replace(changed,'ON CONFLICT ON CONSTRAINT rep_manager_comments_pkey','ON CONFLICT(rep_user_id,week_start)');
 EXECUTE changed;
END $rollback$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_go_command_v1(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
