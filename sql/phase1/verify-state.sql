BEGIN READ ONLY;
SELECT jsonb_build_object(
 'baseline_public_tables',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'),
 'public_views',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='v'),
 'public_functions',(SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'),
 'auth_users',(SELECT count(*) FROM auth.users),
 'crm_users',(SELECT count(*) FROM public.users),
 'crm_deals',(SELECT count(*) FROM public.deals),
 'audit_events',(SELECT count(*) FROM crm_security.audit_events),
 'command_receipts',(SELECT count(*) FROM crm_security.command_receipts),
 'verified_actor',(SELECT jsonb_build_object('auth_uid',a.actor_auth_uid,'user_id',a.actor_user_id,'deal_id',a.deal_id) FROM crm_security.audit_events a WHERE a.event_id='9c91abf9-4239-467d-9998-e2cceb6e58f4')
) result;
COMMIT;
