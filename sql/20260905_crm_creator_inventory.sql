-- SELECT ONLY. No pg_authid/password/role creation and no customer data.
-- Review alongside the Dashboard's actual exposed-schema configuration.
WITH candidates AS (
 SELECT r.oid,r.rolname,r.rolcanlogin,r.rolsuper,
   has_schema_privilege(r.oid,'public','CREATE') AS can_create_public,
   EXISTS(SELECT 1 FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proowner=r.oid) AS owns_public_function,
   EXISTS(SELECT 1 FROM pg_default_acl d WHERE d.defaclrole=r.oid AND d.defaclobjtype='f'
     AND d.defaclnamespace IN (0,'public'::regnamespace::oid)) AS has_function_defaults
 FROM pg_roles r
)
SELECT c.rolname,c.rolcanlogin,c.rolsuper,c.can_create_public,c.owns_public_function,c.has_function_defaults,
 pg_has_role(current_user,c.oid,'MEMBER') AS executor_is_member,
 (SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'acl',d.defaclacl) ORDER BY d.defaclnamespace)
  FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
  WHERE d.defaclrole=c.oid AND d.defaclobjtype='f') AS default_acl
FROM candidates c
WHERE can_create_public OR owns_public_function OR has_function_defaults
ORDER BY c.rolname;
