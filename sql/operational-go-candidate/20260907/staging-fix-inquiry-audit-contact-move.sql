-- Minimal Staging corrections found by real JWT execution.
BEGIN;
ALTER TABLE crm_security.inquiry_audit_events DROP CONSTRAINT inquiry_audit_events_action_check;
ALTER TABLE crm_security.inquiry_audit_events ADD CONSTRAINT inquiry_audit_events_action_check CHECK(action=ANY(ARRAY[
 'direct_assign','direct_reassign','inquiry_unassign','inquiry_reclassify','inquiry_hold','inquiry_trash','inquiry_restore','inquiry_purge','inquiry_followup',
 'inquiry_response_progress','inquiry_response_next_week_retry','inquiry_response_missed_retry','inquiry_pipeline_promote','inquiry_lineage_link','inquiry_stage_progress',
 'inquiry_next_set','inquiry_next_complete','inquiry_check','technical_inquiry_transfer','inquiry_consultant','inquiry_branch_handoff','inquiry_branch_owner_assign','inquiry_branch_owner_pool'
]::text[]));
DO $fix$
DECLARE ddl text; changed text;
BEGIN
 SELECT pg_get_functiondef('crm_security.crm_operational_go_command_v1(uuid,text,uuid,integer,jsonb)'::regprocedure) INTO ddl;
 IF position('site_name text;' in ddl)=0
 OR position('VALUES(a.auth_uid,a.user_id,p_object_id,p_operation,before_data' in ddl)=0
 OR position('ON CONFLICT(person_key,site_name) WHERE ended_at IS NULL' in ddl)=0
 THEN RAISE EXCEPTION 'inquiry/contact function drift'; END IF;
 changed:=replace(ddl,'site_name text;','v_site_name text;');
 changed:=replace(changed,'site_name:=nullif(btrim(coalesce(p_payload->>''site_name'','''')),''''','v_site_name:=nullif(btrim(coalesce(p_payload->>''site_name'','''')),''''');
 changed:=replace(changed,'OR site_name IS NULL','OR v_site_name IS NULL');
 changed:=replace(changed,'person_key,mobile,manager_role,site_name,server_at','person_key,mobile,manager_role,v_site_name,server_at');
 changed:=replace(changed,'current_site=site_name,emails=','current_site=v_site_name,emails=');
 changed:=replace(changed,'SET site_name=site_name,','SET site_name=v_site_name,');
 changed:=replace(changed,'VALUES(person_key,p_object_id,site_name,','VALUES(person_key,p_object_id,v_site_name,');
 changed:=replace(changed,'manager_current_site=site_name,','manager_current_site=v_site_name,');
 changed:=replace(changed,'VALUES(a.auth_uid,a.user_id,p_object_id,p_operation,before_data','VALUES(a.auth_uid,a.user_id,p_object_id,CASE WHEN p_operation=''inquiry_consultant'' THEN ''inquiry_consultant'' ELSE ''inquiry_''||intent END,before_data');
 IF changed=ddl OR position('v_site_name text;' in changed)=0 OR position('inquiry_''||intent' in changed)=0
 THEN RAISE EXCEPTION 'inquiry/contact patch failed'; END IF;
 EXECUTE changed;
END $fix$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_go_command_v1(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
