-- REVIEW ONLY. Creator-default preparation BEFORE additive v2, AFTER baseline.
-- Existing object ACLs are NOT changed. Full rollback if ANY creator cannot be
-- inspected/changed/probed. Never grant membership or escalate to bypass a failure.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
DO $defaults$
DECLARE approved jsonb; detected text[]; listed text[]; creator text; executor name:=current_user; probe oid;
BEGIN
 IF current_setting('crm.reviewed_staging_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
    OR current_setting('crm.creator_defaults_approved',true) IS DISTINCT FROM 'yes'
    OR current_setting('crm.managed_creator_impact_reviewed',true) IS DISTINCT FROM 'yes' THEN
   RAISE EXCEPTION 'REVIEW ONLY: all-creator and managed-schema impact approval required';
 END IF;
 approved:=coalesce(nullif(current_setting('crm.approved_function_creators',true),''),'[]')::jsonb;
 IF jsonb_typeof(approved)<>'array' OR jsonb_array_length(approved)=0 OR
    EXISTS(SELECT 1 FROM jsonb_array_elements(approved) a WHERE jsonb_typeof(a)<>'string') THEN
   RAISE EXCEPTION 'Reviewed creator inventory is required';
 END IF;
 SELECT array_agg(x ORDER BY x) INTO listed FROM jsonb_array_elements_text(approved) x;
 SELECT array_agg(r.rolname::text ORDER BY r.rolname::text) INTO detected FROM pg_roles r
 WHERE has_schema_privilege(r.oid,'public','CREATE')
   OR EXISTS(SELECT 1 FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proowner=r.oid)
   OR EXISTS(SELECT 1 FROM pg_default_acl d WHERE d.defaclrole=r.oid AND d.defaclobjtype='f'
       AND d.defaclnamespace IN (0,'public'::regnamespace::oid));
 IF listed IS DISTINCT FROM detected THEN RAISE EXCEPTION 'Creator inventory drift; stop and review'; END IF;
 IF NOT ('postgres'=ANY(listed)) OR NOT ('supabase_admin'=ANY(listed)) THEN
   RAISE EXCEPTION 'Observed postgres/supabase_admin creator missing';
 END IF;
 IF to_regprocedure('public._crm_default_acl_probe()') IS NOT NULL THEN RAISE EXCEPTION 'Probe name occupied'; END IF;
 FOREACH creator IN ARRAY listed LOOP
   -- Global PUBLIC default cannot be removed by an IN SCHEMA-only REVOKE.
   -- This global change can affect future routines outside public: managed creator
   -- impact must be approved. Insufficient authority aborts ALL changes.
   EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC,anon,authenticated',creator);
   EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC,anon,authenticated',creator);
   -- Effective privilege probe as the actual creator, not a different member role.
   EXECUTE format('SET LOCAL ROLE %I',creator);
   EXECUTE 'CREATE FUNCTION public._crm_default_acl_probe() RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path='''' AS ''SELECT 1''';
   EXECUTE format('SET LOCAL ROLE %I',executor);
   probe:=to_regprocedure('public._crm_default_acl_probe()');
   IF has_function_privilege('anon',probe,'EXECUTE') OR has_function_privilege('authenticated',probe,'EXECUTE')
     OR EXISTS(SELECT 1 FROM pg_proc p,LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
       WHERE p.oid=probe AND a.grantee=0 AND a.privilege_type='EXECUTE') THEN
     RAISE EXCEPTION 'Future function effective ACL still open for creator %',creator;
   END IF;
   EXECUTE 'DROP FUNCTION public._crm_default_acl_probe()';
 END LOOP;
END
$defaults$;
COMMIT;
-- Ephemeral metadata-only probe is created/dropped inside the transaction.
-- No existing CRM routine, CRM row, role membership or managed schema is changed.
-- If a managed/pseudo-role cannot SET ROLE or create the probe: STOP/NO-GO.
-- Do not silently remove it from the allowlist or claim all creators passed.
