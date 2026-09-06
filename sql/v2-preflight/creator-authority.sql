-- SELECT-only Staging preflight. No customer values, passwords, SET ROLE or DDL.
WITH candidates AS (
 SELECT r.oid,r.rolname,r.rolcanlogin,r.rolsuper,
   has_schema_privilege(r.oid,'public','CREATE') AS can_create_public,
   EXISTS(SELECT 1 FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proowner=r.oid) AS owns_public_function,
   EXISTS(SELECT 1 FROM pg_default_acl d WHERE d.defaclrole=r.oid AND d.defaclobjtype='f'
     AND d.defaclnamespace IN (0,'public'::regnamespace::oid)) AS has_function_defaults
 FROM pg_roles r
), creators AS (
 SELECT c.rolname,c.rolcanlogin,c.rolsuper,c.can_create_public,c.owns_public_function,c.has_function_defaults,
   pg_has_role(current_user,c.oid,'MEMBER') AS executor_member,
   pg_has_role(current_user,c.oid,'USAGE') AS executor_inherits,
   pg_has_role(session_user,c.oid,'SET') AS session_can_set_role,
   (SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'acl',d.defaclacl) ORDER BY d.defaclnamespace)
    FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
    WHERE d.defaclrole=c.oid AND d.defaclobjtype='f') AS function_defaults
 FROM candidates c WHERE can_create_public OR owns_public_function OR has_function_defaults
)
SELECT jsonb_build_object(
 'executor',current_user,'session_user',session_user,
 'executor_superuser',(SELECT rolsuper FROM pg_roles WHERE rolname=current_user),
 'database_owner',(SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database()),
 'creators',(SELECT jsonb_agg(to_jsonb(c) ORDER BY rolname) FROM creators c),
 'public_functions',(SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace),
 'crm_security_exists',to_regnamespace('crm_security') IS NOT NULL,
 'auth_user_count',(SELECT count(*) FROM auth.users),
 'global_function_default_rows',(SELECT count(*) FROM pg_default_acl WHERE defaclobjtype='f' AND defaclnamespace=0)
) AS creator_authority;
