BEGIN;
DO $fix$
DECLARE ddl text; changed text;
BEGIN
 SELECT pg_get_functiondef('crm_security.crm_operational_go_command_v1(uuid,text,uuid,integer,jsonb)'::regprocedure) INTO ddl;
 IF position('v_site_name text;' in ddl)=0 OR position('manager_role,site_name,server_at' in ddl)=0 OR position('current_site=site_name,emails=' in ddl)=0
 THEN RAISE EXCEPTION 'contact site function drift'; END IF;
 changed:=replace(ddl,'person_key,mobile,manager_role,site_name,server_at','person_key,mobile,manager_role,v_site_name,server_at');
 changed:=replace(changed,'current_site=site_name,emails=','current_site=v_site_name,emails=');
 IF changed=ddl THEN RAISE EXCEPTION 'contact site patch failed'; END IF;
 EXECUTE changed;
END $fix$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_go_command_v1(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
