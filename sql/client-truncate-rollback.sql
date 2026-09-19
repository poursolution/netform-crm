-- Emergency only: restores table-emptying privileges to browser roles.
-- Requires separate explicit approval; never run as an automatic fallback.
DO $restore$
DECLARE
  tables constant text[] := ARRAY['activities','audit_logs','contact_assignments','contacts','deals','inquiries','next_actions','organizations','sites','users'];
  table_name text;
  relation regclass;
BEGIN
  PERFORM set_config('lock_timeout','2s',true);
  FOREACH table_name IN ARRAY tables LOOP
    relation := to_regclass(format('public.%I',table_name));
    IF relation IS NULL THEN RAISE EXCEPTION 'Missing rollback table: %',table_name; END IF;
    EXECUTE format('LOCK TABLE %s IN ACCESS EXCLUSIVE MODE',relation);
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid=relation AND relkind='r'
      AND relowner='postgres'::regrole AND relrowsecurity
      AND relacl::text='{postgres=arwdDxtm/postgres,anon=arwdxtm/postgres,authenticated=arwdxtm/postgres,service_role=arwdDxtm/postgres}') THEN
      RAISE EXCEPTION 'Client TRUNCATE rollback drift: %',table_name;
    END IF;
  END LOOP;
  FOREACH table_name IN ARRAY tables LOOP
    EXECUTE format('GRANT TRUNCATE ON TABLE public.%I TO anon, authenticated',table_name);
  END LOOP;
END $restore$;
