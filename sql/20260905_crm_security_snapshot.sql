-- PRODUCTION READ-ONLY SECURITY SNAPSHOT.
-- This file contains SELECT statements only. It must never change ACL, policy,
-- schema, data, auth users, storage objects, or configuration.

-- 1. Functions, owner, SECURITY DEFINER and effective EXECUTE access.
select
  'functions' section,
  n.nspname schema_name,
  p.proname function_name,
  p.oid::regprocedure::text signature,
  pg_get_userbyid(p.proowner) owner_name,
  p.prosecdef security_definer,
  p.provolatile volatility,
  p.proconfig settings,
  exists (
    select 1 from aclexplode(nullif(coalesce(p.proacl,acldefault('f',p.proowner)),'{}'::aclitem[])) a
    where a.grantee=0 and a.privilege_type='EXECUTE'
  ) public_execute,
  has_function_privilege('anon',p.oid,'EXECUTE') anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execute,
  has_function_privilege('service_role',p.oid,'EXECUTE') service_role_execute,
  p.proacl::text raw_acl,
  md5(coalesce(p.proacl,acldefault('f',p.proowner))::text) acl_md5,
  p.prokind,
  case when p.prokind in ('f','p') then md5(pg_get_functiondef(p.oid)) end definition_md5
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
order by p.proname,p.oid::regprocedure::text;

-- 2. Immediate function findings to diff against the deny-by-default target.
select
  'function_findings' section,
  p.oid::regprocedure::text signature,
  case
    when p.prosecdef and exists (
      select 1 from aclexplode(nullif(coalesce(p.proacl,acldefault('f',p.proowner)),'{}'::aclitem[])) a
      where a.grantee=0 and a.privilege_type='EXECUTE'
    ) then 'FAIL_SECURITY_DEFINER_PUBLIC_EXECUTE'
    when p.prosecdef and has_function_privilege('anon',p.oid,'EXECUTE') then 'FAIL_SECURITY_DEFINER_ANON_EXECUTE'
    when p.prosecdef and has_function_privilege('authenticated',p.oid,'EXECUTE')
      then 'REVIEW_AUTHENTICATED_EXACT_SIGNATURE_AND_BODY'
    else 'OK_OR_REVIEWED'
  end expected_diff
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prosecdef
order by expected_diff,signature;

-- 3. Exposed tables/views and RLS state.
select
  'relations' section,
  n.nspname schema_name,c.relname relation_name,c.relkind,
  c.relrowsecurity rls_enabled,c.relforcerowsecurity rls_forced,
  c.reloptions view_options,
  case when c.relkind in ('v','m') then md5(pg_get_viewdef(c.oid,true)) end view_definition_md5,
  pg_get_userbyid(c.relowner) owner_name,
  has_table_privilege('anon',c.oid,'SELECT') anon_select,
  has_table_privilege('anon',c.oid,'INSERT') anon_insert,
  has_table_privilege('anon',c.oid,'UPDATE') anon_update,
  has_table_privilege('anon',c.oid,'DELETE') anon_delete,
  has_table_privilege('anon',c.oid,'TRUNCATE') anon_truncate,
  has_any_column_privilege('anon',c.oid,'SELECT') anon_column_select,
  has_any_column_privilege('anon',c.oid,'INSERT') anon_column_insert,
  has_any_column_privilege('anon',c.oid,'UPDATE') anon_column_update,
  has_table_privilege('authenticated',c.oid,'SELECT') authenticated_select,
  has_table_privilege('authenticated',c.oid,'INSERT') authenticated_insert,
  has_table_privilege('authenticated',c.oid,'UPDATE') authenticated_update,
  has_table_privilege('authenticated',c.oid,'DELETE') authenticated_delete,
  has_table_privilege('authenticated',c.oid,'TRUNCATE') authenticated_truncate,
  c.relacl::text raw_acl
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','storage') and c.relkind in ('r','p','v','m')
order by n.nspname,c.relname;

-- 4. Policies exactly as deployed.
select 'policies' section,schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies
where schemaname in ('public','storage')
order by schemaname,tablename,policyname;

-- 5. Direct anon grants on tables/views (effective access is also in section 3).
select 'anon_grants' section,table_schema,table_name,privilege_type,is_grantable
from information_schema.role_table_grants
where grantee='anon' and table_schema in ('public','storage')
order by table_schema,table_name,privilege_type;

-- 6. Storage bucket exposure. Object rows and customer file names are not read.
select 'storage_buckets' section,id,name,public,file_size_limit,allowed_mime_types
from storage.buckets order by id;

-- 7. Function default privileges, including PUBLIC (grantee 0).
select
  'default_function_privileges' section,
  pg_get_userbyid(d.defaclrole) owner_name,
  coalesce(n.nspname,'<all schemas>') schema_name,
  case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end grantee,
  a.privilege_type,a.is_grantable,d.defaclacl::text raw_acl
from pg_default_acl d
left join pg_namespace n on n.oid=d.defaclnamespace
cross join lateral aclexplode(nullif(d.defaclacl,'{}'::aclitem[])) a
where d.defaclobjtype='f'
order by owner_name,schema_name,grantee,privilege_type;

-- 8. Compact NO-GO findings. A clean result is zero rows.
select finding,object_name from (
  select 'PUBLIC_OR_ANON_SECURITY_DEFINER_EXECUTE' finding,p.oid::regprocedure::text object_name
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef and (
    has_function_privilege('anon',p.oid,'EXECUTE') or exists (
      select 1 from aclexplode(nullif(coalesce(p.proacl,acldefault('f',p.proowner)),'{}'::aclitem[])) a
      where a.grantee=0 and a.privilege_type='EXECUTE'))
  union all
  select 'PUBLIC_TABLE_WITHOUT_RLS',c.oid::regclass::text
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity
  union all
  select 'PUBLIC_STORAGE_BUCKET',b.id from storage.buckets b where b.public
) findings order by finding,object_name;

-- 9. Same-database fingerprints for the reviewed hardening manifest.
-- OIDs make these environment-specific: NEVER reuse production hashes on staging.
select 'manifest_meta' section,
 (select md5(coalesce(string_agg(row_to_json(p)::text,'|' order by schemaname,tablename,policyname),'')) from pg_policies p where schemaname in ('public','storage')) policy_md5,
 (select md5(coalesce(string_agg(row_to_json(d)::text,'|' order by defaclrole,defaclnamespace,defaclobjtype),'')) from pg_default_acl d) defaults_md5;

-- Catalog ACL/RLS flags are not a data-access proof. Check view ownership/options,
-- column privileges, role inheritance/BYPASSRLS, policy semantics, and actual JWT.
-- Missing pg_default_acl rows mean PostgreSQL's built-in defaults (PUBLIC EXECUTE),
-- not that future functions are private. Schema-only REVOKE cannot remove that.

-- 10. Effective future-function defaults for public function owners/creators.
-- Global and schema grants are additive; no global row means built-in defaults.
select 'effective_function_defaults' section,r.rolname owner_name,
 'public' schema_name,
 exists (
   select 1 from aclexplode(nullif(coalesce(g.defaclacl,acldefault('f',r.oid)),'{}'::aclitem[])) a
   where a.grantee=0 and a.privilege_type='EXECUTE'
 ) or exists (
   select 1 from aclexplode(nullif(s.defaclacl,'{}'::aclitem[])) a
   where a.grantee=0 and a.privilege_type='EXECUTE'
 ) public_execute,
 exists (
   select 1 from (
    select * from aclexplode(nullif(coalesce(g.defaclacl,acldefault('f',r.oid)),'{}'::aclitem[]))
    union all select * from aclexplode(nullif(s.defaclacl,'{}'::aclitem[]))
   ) a where a.privilege_type='EXECUTE'
     and case when a.grantee=0 then true else pg_has_role('anon',a.grantee,'USAGE') end
 ) anon_execute,
 exists (
   select 1 from (
    select * from aclexplode(nullif(coalesce(g.defaclacl,acldefault('f',r.oid)),'{}'::aclitem[]))
    union all select * from aclexplode(nullif(s.defaclacl,'{}'::aclitem[]))
   ) a where a.privilege_type='EXECUTE'
     and case when a.grantee=0 then true else pg_has_role('authenticated',a.grantee,'USAGE') end
 ) authenticated_execute,
 coalesce(g.defaclacl,acldefault('f',r.oid))::text global_acl,
 s.defaclacl::text schema_acl
from pg_roles r cross join pg_namespace n
left join pg_default_acl g on g.defaclrole=r.oid and g.defaclnamespace=0 and g.defaclobjtype='f'
left join pg_default_acl s on s.defaclrole=r.oid and s.defaclnamespace=n.oid and s.defaclobjtype='f'
where n.nspname='public' and (
 has_schema_privilege(r.oid,n.oid,'CREATE') or exists (
  select 1 from pg_proc p where p.pronamespace=n.oid and p.proowner=r.oid))
order by r.rolname;

-- 11. Browser roles must never be superusers or bypass RLS. Memberships matter.
select 'role_security' section,r.rolname role_name,r.rolsuper superuser,
 r.rolbypassrls bypass_rls,r.rolinherit inherits,
 array(select parent.rolname from pg_roles parent
       where parent.oid<>r.oid and pg_has_role(r.oid,parent.oid,'USAGE')
       order by parent.rolname) inherited_roles
from pg_roles r where r.rolname in ('anon','authenticated','service_role')
order by r.rolname;

-- 12. Effective schema privileges; schema ownership/CREATE can change the boundary.
select 'schema_access' section,n.nspname schema_name,r.rolname role_name,
 has_schema_privilege(r.oid,n.oid,'USAGE') usage,
 has_schema_privilege(r.oid,n.oid,'CREATE') can_create
from pg_namespace n cross join pg_roles r
where n.nspname in ('public','storage')
 and r.rolname in ('anon','authenticated','service_role')
order by n.nspname,r.rolname;
