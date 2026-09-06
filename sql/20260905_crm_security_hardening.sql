-- STAGING CANDIDATE. Supply a reviewed, exact manifest before any changes.
-- temp crm_security_expected(signature text, definition_md5 text, acl_md5 text, allow_authenticated boolean)
-- temp crm_security_expected_meta(policy_md5 text, defaults_md5 text)
-- Hashes must be reviewed offline; this migration never self-approves a live inventory.
begin;
do $$
declare r record; h text; count_live integer;
begin
  if to_regclass('pg_temp.crm_security_expected') is null or to_regclass('pg_temp.crm_security_expected_meta') is null then raise exception 'Reviewed snapshot manifest required';end if;
  if (select count(*) from pg_temp.crm_security_expected_meta)<>1 then raise exception 'Expected one metadata row';end if;
  select md5(coalesce(string_agg(row_to_json(p)::text,'|' order by schemaname,tablename,policyname),'')) into h from pg_policies p where schemaname in ('public','storage');
  if h is distinct from (select policy_md5 from pg_temp.crm_security_expected_meta) then raise exception 'Policy drift';end if;
  select md5(coalesce(string_agg(row_to_json(d)::text,'|' order by defaclrole,defaclnamespace,defaclobjtype),'')) into h from pg_default_acl d;
  if h is distinct from (select defaults_md5 from pg_temp.crm_security_expected_meta) then
    if to_regclass('pg_temp.crm_security_after_defaults') is null then raise exception 'Default ACL drift';end if;
    if h is distinct from (select fingerprint from pg_temp.crm_security_after_defaults) then raise exception 'Default ACL drift';end if;
  end if;
  select count(*) into count_live from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'crm\_%' escape '\' and p.prosecdef;
  if count_live=0 or count_live<>(select count(*) from pg_temp.crm_security_expected) then raise exception 'Function inventory drift';end if;
  if exists(select signature from pg_temp.crm_security_expected group by signature having count(*)>1) then raise exception 'Duplicate signature';end if;
  if exists(select to_regprocedure(signature) from pg_temp.crm_security_expected group by to_regprocedure(signature) having count(*)>1) then raise exception 'Duplicate resolved function';end if;
  for r in select * from pg_temp.crm_security_expected loop
    if r.allow_authenticated is null or not exists(
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where p.oid=to_regprocedure(r.signature) and n.nspname='public' and p.prosecdef and p.prokind='f'
        and p.proname like 'crm\_%' escape '\' and pg_get_userbyid(p.proowner)=current_user
        and md5(pg_get_functiondef(p.oid))=r.definition_md5
    ) then raise exception 'Function/owner/definition/ACL mismatch: %',r.signature;end if;
    if not exists(select 1 from pg_proc p where p.oid=to_regprocedure(r.signature) and md5(coalesce(p.proacl,acldefault('f',p.proowner))::text)=r.acl_md5) then
      if to_regclass('pg_temp.crm_security_after_functions') is null then raise exception 'Function ACL mismatch';end if;
      if not exists(select 1 from pg_proc p join pg_temp.crm_security_after_functions x on p.oid=x.oid where p.oid=to_regprocedure(r.signature) and coalesce(p.proacl,acldefault('f',p.proowner))=x.acl) then raise exception 'Function ACL drift after apply';end if;
    end if;
    if exists(select 1 from pg_proc p cross join lateral aclexplode(nullif(coalesce(p.proacl,acldefault('f',p.proowner)),'{}'::aclitem[])) a where p.oid=to_regprocedure(r.signature) and a.grantor<>p.proowner) then raise exception 'Delegated grants require separate review';end if;
  end loop;
end $$;
-- Session backup includes semantic defaults when catalog ACL is NULL.
create temp table if not exists crm_security_before_functions on commit preserve rows as
select p.oid,p.oid::regprocedure::text signature,p.proowner,coalesce(p.proacl,acldefault('f',p.proowner)) acl,md5(pg_get_functiondef(p.oid)) definition_md5
from pg_proc p join pg_temp.crm_security_expected e on p.oid=to_regprocedure(e.signature);
create temp table if not exists crm_security_before_defaults on commit preserve rows as
select 0::oid namespace,coalesce((select defaclacl from pg_default_acl where defaclrole=current_user::regrole and defaclnamespace=0 and defaclobjtype='f'),acldefault('f',current_user::regrole)) acl
union all select 'public'::regnamespace::oid,coalesce((select defaclacl from pg_default_acl where defaclrole=current_user::regrole and defaclnamespace='public'::regnamespace and defaclobjtype='f'),'{}'::aclitem[]);
do $$
declare r record;
begin
  for r in select * from pg_temp.crm_security_expected loop
    execute format('revoke execute on function %s from public, anon, authenticated',r.signature::regprocedure);
    execute format('grant execute on function %s to service_role',r.signature::regprocedure);
    if r.allow_authenticated then execute format('grant execute on function %s to authenticated',r.signature::regprocedure);end if;
  end loop;
end $$;
-- Global default PUBLIC cannot be removed by a schema-only REVOKE.
-- Affects FUTURE functions by this owner in ALL schemas; explicit review required.
alter default privileges revoke execute on functions from public,anon,authenticated;
alter default privileges in schema public revoke execute on functions from public,anon,authenticated;
do $$
declare r record;
begin
  for r in select * from pg_temp.crm_security_expected loop
    if has_function_privilege('anon',r.signature,'EXECUTE') or
       has_function_privilege('authenticated',r.signature,'EXECUTE')<>r.allow_authenticated or
       not has_function_privilege('service_role',r.signature,'EXECUTE') or exists(
         select 1 from pg_proc p cross join lateral aclexplode(nullif(coalesce(p.proacl,acldefault('f',p.proowner)),'{}'::aclitem[])) a where p.oid=to_regprocedure(r.signature) and a.grantee=0
       ) then raise exception 'ACL postcondition failed: %',r.signature;end if;
  end loop;
end $$;
create temp table if not exists crm_security_after_functions on commit preserve rows as select p.oid,coalesce(p.proacl,acldefault('f',p.proowner)) acl from pg_proc p join pg_temp.crm_security_before_functions b on b.oid=p.oid;
create temp table if not exists crm_security_after_defaults on commit preserve rows as select md5(coalesce(string_agg(row_to_json(d)::text,'|' order by defaclrole,defaclnamespace,defaclobjtype),'')) fingerprint from pg_default_acl d;
notify pgrst,'reload schema';
commit;
