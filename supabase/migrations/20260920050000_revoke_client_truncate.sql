-- Remove only bulk table-emptying privileges from browser roles.
-- No customer rows, policies, functions, or normal CRUD grants are changed.
DO $contain$
DECLARE
  tables constant text[] := ARRAY['activities','audit_logs','contact_assignments','contacts','deals','inquiries','next_actions','organizations','sites','users'];
  before_acl constant text := '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}';
  after_acl constant text := '{postgres=arwdDxtm/postgres,anon=arwdxtm/postgres,authenticated=arwdxtm/postgres,service_role=arwdDxtm/postgres}';
  table_name text;
  relation regclass;
BEGIN
  PERFORM set_config('lock_timeout','2s',true);
  -- Lock and validate the entire allowlist before changing any permission.
  FOREACH table_name IN ARRAY tables LOOP
    relation := to_regclass(format('public.%I',table_name));
    IF relation IS NULL THEN RAISE EXCEPTION 'Missing target table: %',table_name; END IF;
    EXECUTE format('LOCK TABLE %s IN ACCESS EXCLUSIVE MODE',relation);
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid=relation AND relkind='r'
      AND relowner='postgres'::regrole AND relrowsecurity
      AND relacl::text IN (before_acl,after_acl)) THEN
      RAISE EXCEPTION 'Client TRUNCATE metadata drift: %',table_name;
    END IF;
  END LOOP;
  FOREACH table_name IN ARRAY tables LOOP
    relation := to_regclass(format('public.%I',table_name));
    EXECUTE format('REVOKE TRUNCATE ON TABLE %s FROM PUBLIC, anon, authenticated',relation);
    IF has_table_privilege('anon',relation,'TRUNCATE')
      OR has_table_privilege('authenticated',relation,'TRUNCATE')
      OR NOT has_table_privilege('service_role',relation,'TRUNCATE')
      OR (SELECT relacl::text FROM pg_class WHERE oid=relation) IS DISTINCT FROM after_acl THEN
      RAISE EXCEPTION 'Client TRUNCATE postcondition failed: %',table_name;
    END IF;
  END LOOP;
END $contain$;
