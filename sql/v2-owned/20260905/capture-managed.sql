BEGIN READ ONLY;
SET LOCAL search_path=public,pg_catalog;
SELECT jsonb_build_object(
 'executor',current_user,
 'project_setting',current_setting('supabase.project_ref',true),
 'auth_count',(SELECT count(*) FROM auth.users),
 'private_schema_exists',to_regnamespace('crm_security') IS NOT NULL,
 'all_default_privileges',(SELECT jsonb_agg(jsonb_build_object('creator',pg_get_userbyid(d.defaclrole),'schema',n.nspname,'type',d.defaclobjtype,'acl',d.defaclacl) ORDER BY pg_get_userbyid(d.defaclrole),n.nspname,d.defaclobjtype) FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace),
 'graphql_functions',(SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),'acl',p.proacl,'security_definer',p.prosecdef,'config',p.proconfig,'definition',pg_get_functiondef(p.oid)) ORDER BY p.oid::regprocedure::text) FROM pg_proc p WHERE p.pronamespace='graphql_public'::regnamespace),
 'graphql_relations',(SELECT jsonb_agg(jsonb_build_object('name',c.relname,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl,'kind',c.relkind,'rls',c.relrowsecurity) ORDER BY c.relname) FROM pg_class c WHERE c.relnamespace='graphql_public'::regnamespace)
) snapshot;
COMMIT;
