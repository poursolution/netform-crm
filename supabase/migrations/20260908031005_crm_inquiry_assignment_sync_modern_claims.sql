-- PostgREST exposes JWT claims through request.jwt.claims on current projects.
-- Keep the legacy GUC as a fallback so both legacy service_role JWTs and
-- current Supabase secret keys can call the service-role-only sync RPC.
DO $migration$
DECLARE
  function_def text;
  old_guard text := 'requested_role text := coalesce(current_setting(''request.jwt.claim.role'', true), '''');';
  new_guard text := 'requested_role text := coalesce(nullif(current_setting(''request.jwt.claim.role'', true), ''''), (nullif(current_setting(''request.jwt.claims'', true), '''')::jsonb ->> ''role''), '''');';
BEGIN
  SELECT pg_get_functiondef('public.crm_inquiry_assignment_sync_v1(jsonb)'::regprocedure)
  INTO function_def;

  IF position(new_guard IN function_def) > 0 THEN
    RETURN;
  END IF;

  IF position(old_guard IN function_def) = 0 THEN
    RAISE EXCEPTION 'assignment sync guard signature not found; no change applied';
  END IF;

  function_def := replace(function_def, old_guard, new_guard);
  EXECUTE function_def;
END
$migration$;

REVOKE EXECUTE ON FUNCTION public.crm_inquiry_assignment_sync_v1(jsonb)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_inquiry_assignment_sync_v1(jsonb)
TO service_role;
