-- Read-only operational triage. No customer phone numbers or raw payloads.
-- Does not prove Sheets/n8n delivery, nor authorize merging duplicate candidates.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';
SELECT jsonb_build_object(
 'counts',(SELECT jsonb_build_object(
   'total',count(*),
   'uuid_missing',count(*) FILTER (WHERE i.assigned_to IS NULL),
   'name_only',count(*) FILTER (WHERE i.assigned_to IS NULL AND nullif(btrim(i.assignee_name),'') IS NOT NULL),
   'uuid_name_mismatch',count(*) FILTER (WHERE i.assigned_to IS NOT NULL AND i.assignee_name IS DISTINCT FROM u.name),
   'inactive_or_missing_uuid_user',count(*) FILTER (WHERE i.assigned_to IS NOT NULL AND u.active IS NOT TRUE)
 ) FROM public.inquiries i LEFT JOIN public.users u ON u.user_id=i.assigned_to),
 'missing_uuid_statuses',(SELECT jsonb_agg(x) FROM (
   SELECT status,count(*) AS rows FROM public.inquiries WHERE assigned_to IS NULL GROUP BY status
 ) x),
 'named_without_uuid',(SELECT jsonb_agg(x) FROM (
   SELECT i.id,i.sheet_row,i.status,i.assignee_name,
     (SELECT count(*) FROM public.users u WHERE u.active AND btrim(u.name)=btrim(i.assignee_name)) AS active_exact_matches,
     i.assigned_at IS NOT NULL AS has_assignment_time,
     (SELECT count(*) FROM public.assignment_history h WHERE h.inquiry_id=i.id) AS history_count
   FROM public.inquiries i WHERE i.assigned_to IS NULL AND nullif(btrim(i.assignee_name),'') IS NOT NULL
 ) x),
 'service_boundary',(SELECT jsonb_agg(jsonb_build_object(
   'function',p.proname,'source_hash',md5(p.prosrc),
   'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),
   'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),
   'service_execute',has_function_privilege('service_role',p.oid,'EXECUTE')
 )) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
 AND p.proname IN ('crm_inquiry_ingest_v1','crm_inquiry_assignment_sync_v1'))
) AS assignment_audit;
COMMIT;
