-- Restores the exact dispatcher object retained by the production migration.
-- Durable business/audit/receipt rows are intentionally preserved.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';
set local search_path=pg_catalog;
do $guard$
begin
 if current_user <> 'postgres'
    or to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') is null
    or to_regprocedure('crm_security.crm_write_command_v2_pre_relationship_contact_20260913(uuid,text,uuid,integer,jsonb)') is null
    or position('crm_relationship_contact_command_v1' in pg_get_functiondef(to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'))) = 0
 then raise exception 'relationship contact rollback baseline drift'; end if;
end $guard$;
drop function public.crm_write_command_v2(uuid,text,uuid,integer,jsonb);
alter function crm_security.crm_write_command_v2_pre_relationship_contact_20260913(uuid,text,uuid,integer,jsonb) set schema public;
alter function public.crm_write_command_v2_pre_relationship_contact_20260913(uuid,text,uuid,integer,jsonb) rename to crm_write_command_v2;
grant execute on function public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) to authenticated;
drop function crm_security.crm_relationship_contact_command_v1(uuid,uuid,integer,jsonb);
commit;
