-- REVIEW CANDIDATE ONLY. NEVER PRODUCTION. NO APPROVAL HAS BEEN GIVEN.
-- Official CLI generated filename; normal db push is deliberately blocked.
-- FINAL LEGACY CUTOVER: run ONLY AFTER additive v2 + compatibility verification.
-- File timestamp is historical, NOT the approved execution order. Do not db push.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';

DO $guard$
DECLARE feature text; evidence jsonb;
BEGIN
  IF current_setting('crm.reviewed_staging_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
     OR current_setting('crm.approval_ticket',true) IS DISTINCT FROM 'SEPARATE_STAGING_APPROVAL_REQUIRED'
     OR current_setting('crm.schema_diff_reviewed',true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'REVIEW ONLY: separate staging approval + schema diff required';
  END IF;
  -- These settings are operator attestations, NOT proof of network destination.
  -- A separately reviewed runner must verify URL/ref before opening this transaction.
  IF current_user<>'postgres' THEN RAISE EXCEPTION 'Unexpected migration owner'; END IF;
  IF current_setting('server_version_num')::int<150000 THEN RAISE EXCEPTION 'PG15+ required'; END IF;
  evidence:=coalesce(nullif(current_setting('crm.cutover_evidence',true),''),'{}')::jsonb;
  FOREACH feature IN ARRAY ARRAY['baseline','profile','dashboard','inquiries','pipeline','mobile_today','write_queue','v2_rpc','creator_defaults','rollback_plan'] LOOP
    IF evidence->>feature IS DISTINCT FROM 'pass' THEN
      RAISE EXCEPTION 'Cutover blocked: missing independently reviewed evidence for %',feature;
    END IF;
  END LOOP;
END
$guard$;

CREATE TEMP TABLE _crm_expected_function(signature text PRIMARY KEY, definer boolean, client_execute boolean) ON COMMIT DROP;
INSERT INTO _crm_expected_function VALUES
 ('crm_bundle()',true,true),('crm_site_contacts(uuid)',true,true),
 ('crm_opportunity_work_set(jsonb)',true,true),('today_tasks(text)',true,true),('today_counts()',true,true),
 ('crm_contact_move(jsonb)',true,false),('crm_contact_upsert(jsonb)',true,false),
 ('_done_today(text)',false,true),('apply_business_change(uuid,text,text,text,text,text,date)',false,true),
 ('metrics_channel_flow()',false,true),('metrics_lost_breakdown(text)',false,true),
 ('metrics_operations(text)',false,true),('parse_responses(text)',false,true),
 ('require_reason(text,text)',false,true),('set_updated_at()',false,true),
 ('stage_sla_days(text)',false,true),('work_items_today(text)',false,true);

CREATE TEMP TABLE _crm_v2_allowlist(signature text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO _crm_v2_allowlist VALUES ('crm_profile_scoped_v2()'),('crm_read_scoped_v2(uuid,integer)'),
 ('crm_contacts_scoped_v2(uuid)'),('crm_work_set_scoped_v2(uuid,text,jsonb,text,integer)');

CREATE TEMP TABLE _crm_expected_relation(name text PRIMARY KEY, kind "char", rls boolean) ON COMMIT DROP;
INSERT INTO _crm_expected_relation VALUES
 ('activities','r',true),('advisory_deals','r',false),('assignment_history','r',false),
 ('audit_logs','r',true),('business_history','r',false),('contact_assignments','r',true),
 ('contacts','r',true),('dashboard_state','r',true),('deals','r',true),('inquiries','r',true),
 ('next_actions','r',true),('notes','r',false),('organizations','r',true),('projects','r',false),
 ('sites','r',true),('stage_catalog','r',false),('stage_history','r',false),('users','r',true),
 ('opportunities','v',false),('v_assignee','v',false),('v_dup_org','v',false),('v_funnel','v',false),('v_kanban','v',false);

-- A review/rehearsal session may use this snapshot to restore exact prior ACLs.
-- It is session-local metadata, not a persistent security backup.
CREATE TEMP TABLE IF NOT EXISTS _crm_before_function ON COMMIT PRESERVE ROWS AS
 SELECT p.oid,p.oid::regprocedure::text AS signature,p.proacl,p.proowner
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public';
CREATE TEMP TABLE IF NOT EXISTS _crm_before_relation ON COMMIT PRESERVE ROWS AS
 SELECT c.oid,c.relname,c.relkind,c.relacl,c.relowner,c.relrowsecurity,c.relforcerowsecurity,c.reloptions
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S');
CREATE TEMP TABLE IF NOT EXISTS _crm_before_policy ON COMMIT PRESERVE ROWS AS
 SELECT * FROM pg_policies WHERE schemaname='public';
CREATE TEMP TABLE IF NOT EXISTS _crm_before_default_acl ON COMMIT PRESERVE ROWS AS SELECT * FROM pg_default_acl;

DO $preflight$
DECLARE f record; r record; o oid; v_done boolean;
BEGIN
  v_done := current_setting('crm.allow_idempotent_recheck',true)='yes';
  IF (SELECT count(*) FROM _crm_before_function)<>21 OR
     (SELECT count(*) FROM _crm_before_relation WHERE relkind IN ('r','p','v','m'))<>23 THEN
    RAISE EXCEPTION 'Unexpected public object inventory';
  END IF;
  IF (SELECT count(*) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'
      AND a.attnum>0 AND NOT a.attisdropped)<>242 THEN RAISE EXCEPTION 'Column inventory changed (241 + actor_auth_uid expected)'; END IF;
  FOR f IN SELECT signature FROM _crm_v2_allowlist LOOP
    o:=to_regprocedure('public.'||f.signature);
    IF o IS NULL OR has_function_privilege('anon',o,'EXECUTE') OR
       NOT has_function_privilege('authenticated',o,'EXECUTE') OR
       NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=o AND prosecdef AND proowner='postgres'::regrole
         AND proconfig @> ARRAY['search_path=""']) THEN
      RAISE EXCEPTION 'v2 allowlist drift: %',f.signature;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.deals'::regclass
      AND conname='deals_owner_id_fkey' AND confrelid='public.users'::regclass)
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.inquiries'::regclass
      AND conname='inquiries_assigned_to_fkey' AND confrelid='public.users'::regclass)
     OR NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.users'::regclass
      AND attname='auth_uid' AND atttypid='uuid'::regtype AND NOT attisdropped) THEN
    RAISE EXCEPTION 'Observed UUID relationship missing';
  END IF;
  FOR f IN SELECT * FROM _crm_expected_function LOOP
    o:=to_regprocedure('public.'||f.signature);
    IF o IS NULL OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=o AND prosecdef=f.definer
         AND proowner='postgres'::regrole) THEN RAISE EXCEPTION 'Function drift: %',f.signature; END IF;
    IF NOT has_function_privilege('service_role',o,'EXECUTE') THEN RAISE EXCEPTION 'Server ACL drift'; END IF;
    IF NOT coalesce(v_done,false) AND (
      has_function_privilege('anon',o,'EXECUTE')<>f.client_execute OR
      has_function_privilege('authenticated',o,'EXECUTE')<>f.client_execute OR
      EXISTS (SELECT 1 FROM pg_proc p,LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
        WHERE p.oid=o AND a.grantee=0 AND a.privilege_type='EXECUTE')<>f.client_execute) THEN
      RAISE EXCEPTION 'Function ACL drift: %',f.signature;
    END IF;
  END LOOP;
  FOR r IN SELECT * FROM _crm_expected_relation LOOP
    IF NOT EXISTS (SELECT 1 FROM _crm_before_relation WHERE relname=r.name AND relkind=r.kind
       AND relowner='postgres'::regrole AND (coalesce(v_done,false) OR relrowsecurity=r.rls)) THEN
      RAISE EXCEPTION 'Relation drift: %',r.name;
    END IF;
    IF NOT coalesce(v_done,false) AND (
      NOT has_table_privilege('anon','public.'||quote_ident(r.name),'SELECT') OR
      NOT has_table_privilege('authenticated','public.'||quote_ident(r.name),'SELECT')) THEN
      RAISE EXCEPTION 'Relation ACL drift: %',r.name;
    END IF;
  END LOOP;
  IF NOT coalesce(v_done,false) AND (
    (SELECT count(*) FROM _crm_before_policy)<>2 OR
    NOT EXISTS (SELECT 1 FROM _crm_before_policy WHERE tablename='dashboard_state' AND policyname='allow all'
      AND cmd='ALL' AND roles=ARRAY['public']::name[] AND qual='true' AND with_check='true') OR
    NOT EXISTS (SELECT 1 FROM _crm_before_policy WHERE tablename='users' AND policyname='own row read' AND cmd='SELECT')) THEN
    RAISE EXCEPTION 'Policy drift; review exact expressions in schema diff';
  END IF;
  -- This coarse preflight complements, never replaces, full DDL/ACL/policy diff.
END
$preflight$;

DO $contain$
DECLARE r record; f record; col record;
BEGIN
  FOR f IN SELECT signature FROM _crm_expected_function LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION public.'||f.signature||' FROM PUBLIC, anon, authenticated';
  END LOOP;
  FOR r IN SELECT * FROM _crm_expected_relation LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated',r.name);
    -- Column-level grants survive table-level REVOKE; remove them too.
    FOR col IN SELECT attname FROM pg_attribute WHERE attrelid=to_regclass('public.'||quote_ident(r.name))
      AND attnum>0 AND NOT attisdropped LOOP
      EXECUTE format('REVOKE ALL (%I) ON TABLE public.%I FROM PUBLIC, anon, authenticated',col.attname,r.name);
    END LOOP;
    IF r.kind='r' THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',r.name);
    ELSE
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker=true)',r.name);
    END IF;
  END LOOP;
  FOR r IN SELECT * FROM _crm_before_relation WHERE relkind='S' LOOP
    EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM PUBLIC, anon, authenticated',r.relname);
  END LOOP;
END
$contain$;
DROP POLICY IF EXISTS "allow all" ON public.dashboard_state;
DROP POLICY IF EXISTS "own row read" ON public.users;
DROP POLICY IF EXISTS crm_observed_deal_read ON public.deals;
CREATE POLICY crm_observed_deal_read ON public.deals FOR SELECT TO authenticated
 USING (crm_security.can_deal(id,false));
DROP POLICY IF EXISTS crm_observed_inquiry_read ON public.inquiries;
CREATE POLICY crm_observed_inquiry_read ON public.inquiries FOR SELECT TO authenticated
 USING (crm_security.can_inquiry(id));

-- Defense in depth for postgres. The separate ALL-CREATOR preparation module
-- (including supabase_admin) is required earlier; this is not its replacement.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;

DO $verify$
DECLARE r record; f record; who text; perm text;
BEGIN
  FOR f IN SELECT signature FROM _crm_expected_function LOOP
    IF has_function_privilege('anon','public.'||f.signature,'EXECUTE') OR
       has_function_privilege('authenticated','public.'||f.signature,'EXECUTE') OR
       NOT has_function_privilege('service_role','public.'||f.signature,'EXECUTE') THEN
      RAISE EXCEPTION 'Postcondition function ACL failed: %',f.signature;
    END IF;
  END LOOP;
  FOR r IN SELECT * FROM _crm_expected_relation LOOP
    FOREACH who IN ARRAY ARRAY['anon','authenticated'] LOOP
      FOREACH perm IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
        IF has_table_privilege(who,'public.'||quote_ident(r.name),perm) THEN
          RAISE EXCEPTION 'Residual table/inherited grant: % % %',who,r.name,perm;
        END IF;
      END LOOP;
      IF has_any_column_privilege(who,'public.'||quote_ident(r.name),'SELECT,INSERT,UPDATE,REFERENCES') THEN
        RAISE EXCEPTION 'Residual column grant: %',r.name;
      END IF;
    END LOOP;
    IF r.kind='r' AND NOT (SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.'||quote_ident(r.name))) THEN
      RAISE EXCEPTION 'RLS failed: %',r.name;
    END IF;
    IF r.kind='v' AND NOT EXISTS (SELECT 1 FROM pg_class WHERE oid=to_regclass('public.'||quote_ident(r.name))
      AND reloptions @> ARRAY['security_invoker=true']) THEN RAISE EXCEPTION 'Invoker view failed'; END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public')<>2 OR
     EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND
       (tablename,policyname) NOT IN (('deals','crm_observed_deal_read'),('inquiries','crm_observed_inquiry_read'))) THEN
    RAISE EXCEPTION 'Residual or missing policy';
  END IF;
  FOR f IN SELECT signature FROM _crm_v2_allowlist LOOP
    IF has_function_privilege('anon','public.'||f.signature,'EXECUTE') OR
       NOT has_function_privilege('authenticated','public.'||f.signature,'EXECUTE') THEN
      RAISE EXCEPTION 'v2 permission lost during cutover: %',f.signature;
    END IF;
  END LOOP;
  FOR r IN SELECT * FROM _crm_before_relation WHERE relkind='S' LOOP
    IF has_sequence_privilege('anon',r.oid,'USAGE,SELECT,UPDATE') OR
       has_sequence_privilege('authenticated',r.oid,'USAGE,SELECT,UPDATE') THEN
      RAISE EXCEPTION 'Residual sequence grant';
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_default_acl d,LATERAL aclexplode(d.defaclacl) a
    WHERE d.defaclrole='postgres'::regrole AND d.defaclobjtype='f'
      AND d.defaclnamespace IN (0,'public'::regnamespace::oid)
      AND a.grantee IN (0,'anon'::regrole::oid,'authenticated'::regrole::oid)
      AND a.privilege_type='EXECUTE') THEN RAISE EXCEPTION 'Residual postgres default EXECUTE'; END IF;
END
$verify$;
COMMIT;

-- NO business-row INSERT/UPDATE/DELETE, no Auth creation, no Storage changes.
-- Legacy authenticated access is closed; the four verified v2 RPCs remain allowed.
-- Do not deploy without separately approved scoped API replacements and rehearsal.
