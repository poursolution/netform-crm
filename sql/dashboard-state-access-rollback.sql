-- EMERGENCY ONLY: this restores the previous unsafe anonymous access.
-- Do not execute without explicit approval of that security impact.
DO $restore$
DECLARE actual_acl text;
BEGIN
  PERFORM set_config('lock_timeout','2s',true);
  LOCK TABLE public.dashboard_state IN ACCESS EXCLUSIVE MODE;
  SELECT relacl::text INTO actual_acl FROM pg_class WHERE oid='public.dashboard_state'::regclass;
  IF actual_acl IS DISTINCT FROM '{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'
    OR EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.dashboard_state'::regclass)
    OR EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.dashboard_state'::regclass AND attnum>0 AND attacl IS NOT NULL)
    OR NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.dashboard_state'::regclass
      AND relkind='r' AND relowner='postgres'::regrole AND relrowsecurity AND NOT relforcerowsecurity) THEN
    RAISE EXCEPTION 'dashboard_state rollback metadata drift';
  END IF;
  -- Preserve original ACL order as well as effective rights.
  REVOKE ALL PRIVILEGES ON TABLE public.dashboard_state FROM service_role;
  GRANT ALL PRIVILEGES ON TABLE public.dashboard_state TO anon, authenticated, service_role;
  CREATE POLICY "allow all" ON public.dashboard_state FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
END $restore$;
