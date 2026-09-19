-- netform-crm: contain the legacy shared dashboard table without changing rows.
-- Guarded against the production catalog observed on 2026-09-20.
DO $contain$
DECLARE
  before_acl constant text := '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}';
  after_acl constant text := '{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}';
  actual_acl text;
  role_name text;
BEGIN
  PERFORM set_config('lock_timeout','2s',true);
  LOCK TABLE public.dashboard_state IN ACCESS EXCLUSIVE MODE;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.dashboard_state'::regclass
    AND relkind='r' AND relowner='postgres'::regrole AND relrowsecurity AND NOT relforcerowsecurity)
    OR EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.dashboard_state'::regclass
      AND attnum>0 AND NOT attisdropped AND attacl IS NOT NULL) THEN
    RAISE EXCEPTION 'dashboard_state table metadata drift';
  END IF;
  SELECT relacl::text INTO actual_acl FROM pg_class WHERE oid='public.dashboard_state'::regclass;
  IF actual_acl=after_acl AND NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.dashboard_state'::regclass) THEN
    NULL; -- Safe repeat: still verify effective permissions below.
  ELSE
    IF actual_acl IS DISTINCT FROM before_acl
      OR (SELECT count(*) FROM pg_policy WHERE polrelid='public.dashboard_state'::regclass)<>1
      OR NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.dashboard_state'::regclass
        AND polname='allow all' AND polcmd='*' AND polpermissive AND polroles=ARRAY[0::oid]
        AND pg_get_expr(polqual,polrelid)='true' AND pg_get_expr(polwithcheck,polrelid)='true') THEN
      RAISE EXCEPTION 'dashboard_state ACL or policy drift';
    END IF;
    REVOKE ALL PRIVILEGES ON TABLE public.dashboard_state FROM PUBLIC, anon, authenticated;
    DROP POLICY "allow all" ON public.dashboard_state;
  END IF;
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF has_table_privilege(role_name,'public.dashboard_state','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR has_any_column_privilege(role_name,'public.dashboard_state','SELECT,INSERT,UPDATE,REFERENCES') THEN
      RAISE EXCEPTION 'dashboard_state client privilege remains: %',role_name;
    END IF;
  END LOOP;
  IF NOT has_table_privilege('service_role','public.dashboard_state','SELECT')
    OR NOT has_table_privilege('service_role','public.dashboard_state','INSERT')
    OR NOT has_table_privilege('service_role','public.dashboard_state','UPDATE')
    OR NOT has_table_privilege('service_role','public.dashboard_state','DELETE') THEN
    RAISE EXCEPTION 'dashboard_state service privilege lost';
  END IF;
END $contain$;
