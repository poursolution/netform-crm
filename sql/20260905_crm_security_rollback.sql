-- Same-session STAGING rollback. Original ACL may restore known vulnerabilities.
-- Never use this as an automatic production incident response.
begin;
do $$
declare r record; a record; role_name text; scope text; h text; restored aclitem[];
begin
  if to_regclass('pg_temp.crm_security_before_functions') is null then raise exception 'Rollback backup missing';end if;
  select md5(coalesce(string_agg(row_to_json(d)::text,'|' order by defaclrole,defaclnamespace,defaclobjtype),'')) into h from pg_default_acl d;
  if h<>(select fingerprint from pg_temp.crm_security_after_defaults) then raise exception 'Default ACL changed after apply';end if;
  -- Validate ALL objects before touching ANY ACL.
  for r in select * from pg_temp.crm_security_before_functions loop
    if not exists(select 1 from pg_proc p join pg_temp.crm_security_after_functions x on x.oid=p.oid where p.oid=r.oid and p.proowner=r.proowner
      and md5(pg_get_functiondef(p.oid))=r.definition_md5 and coalesce(p.proacl,acldefault('f',p.proowner))=x.acl)
    then raise exception 'Function changed after apply: %',r.signature;end if;
  end loop;
  for r in select * from pg_temp.crm_security_before_functions loop
    for a in select distinct z.grantee from pg_proc p cross join lateral aclexplode(nullif(coalesce(p.proacl,acldefault('f',p.proowner)),'{}'::aclitem[])) z where p.oid=r.oid loop
      role_name:=case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end;
      execute format('revoke execute on function %s from %s',r.oid::regprocedure,role_name);
    end loop;
    for a in select * from aclexplode(case when cardinality(r.acl)>0 then r.acl else null end) loop
      role_name:=case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end;
      execute format('grant execute on function %s to %s%s',r.oid::regprocedure,role_name,case when a.is_grantable then ' with grant option' else '' end);
    end loop;
  end loop;
  for r in select * from pg_temp.crm_security_before_defaults loop
    scope:=case when r.namespace=0 then '' else ' in schema public' end;
    for a in select distinct z.grantee from pg_default_acl d cross join lateral aclexplode(case when cardinality(d.defaclacl)>0 then d.defaclacl else null end) z where d.defaclrole=current_user::regrole and d.defaclnamespace=r.namespace and d.defaclobjtype='f' loop
      role_name:=case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end;
      execute format('alter default privileges%s revoke execute on functions from %s',scope,role_name);
    end loop;
    for a in select * from aclexplode(case when cardinality(r.acl)>0 then r.acl else null end) loop
      role_name:=case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end;
      execute format('alter default privileges%s grant execute on functions to %s%s',scope,role_name,case when a.is_grantable then ' with grant option' else '' end);
    end loop;
  end loop;
  for r in select * from pg_temp.crm_security_before_functions loop
    if exists((select * from aclexplode(nullif(r.acl,'{}'::aclitem[])) except select z.* from pg_proc p cross join lateral aclexplode(nullif(coalesce(p.proacl,acldefault('f',p.proowner)),'{}'::aclitem[])) z where p.oid=r.oid)
      union all (select z.* from pg_proc p cross join lateral aclexplode(nullif(coalesce(p.proacl,acldefault('f',p.proowner)),'{}'::aclitem[])) z where p.oid=r.oid except select * from aclexplode(nullif(r.acl,'{}'::aclitem[]))))
    then raise exception 'Rollback ACL mismatch';end if;
  end loop;
  for r in select * from pg_temp.crm_security_before_defaults loop
    select coalesce((select defaclacl from pg_default_acl where defaclrole=current_user::regrole and defaclnamespace=r.namespace and defaclobjtype='f'),
      case when r.namespace=0 then acldefault('f',current_user::regrole) else '{}'::aclitem[] end) into restored;
    if exists((select * from aclexplode(nullif(r.acl,'{}'::aclitem[])) except select * from aclexplode(nullif(restored,'{}'::aclitem[])))
      union all (select * from aclexplode(nullif(restored,'{}'::aclitem[])) except select * from aclexplode(nullif(r.acl,'{}'::aclitem[]))))
    then raise exception 'Rollback default ACL mismatch';end if;
  end loop;
end $$;
drop table pg_temp.crm_security_before_functions,pg_temp.crm_security_after_functions,pg_temp.crm_security_before_defaults,pg_temp.crm_security_after_defaults;
notify pgrst,'reload schema';
commit;
