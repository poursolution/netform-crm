BEGIN READ ONLY;
SET LOCAL search_path=public,pg_catalog;
SELECT jsonb_build_object(
 'deal',(SELECT jsonb_build_object('id',id,'version',version,'primary_work',primary_work,'work_items',work_items) FROM public.deals WHERE id='f6090500-0006-4000-8000-000000000001'),
 'audit',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY created_at,event_id),'[]') FROM crm_security.audit_events a),
 'approvals',(SELECT count(*) FROM crm_security.access_review),
 'scopes',(SELECT count(*) FROM crm_security.object_scope),
 'auth_count',(SELECT count(*) FROM auth.users),
 'activity',(SELECT jsonb_agg(jsonb_build_object('role',usename,'state',state,'wait_type',wait_event_type,'wait_event',wait_event,'duration_seconds',extract(epoch FROM now()-query_start))) FROM pg_stat_activity WHERE datname=current_database() AND state<>'idle' AND pid<>pg_backend_pid())
) result;
COMMIT;
