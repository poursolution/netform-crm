-- LOCAL/STAGING UUID reader candidate. No name/email-based authorization.
-- Requires 20260905_crm_uuid_identity.sql and HUMAN-reviewed UUID backfill.
begin;
do $$
begin
 if to_regclass('crm_private.uuid_v1_marker') is null or
    to_regprocedure('crm_private.uuid_actor()') is null or
    to_regprocedure('public.crm_bundle()') is null then
  raise exception 'Reviewed UUID identity + legacy bundle required';
 end if;
end $$;
create or replace function public.crm_read_bundle()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
 actor public.crm_users;
 source jsonb; own_deals jsonb; own_inquiries jsonb; result jsonb;
begin
 actor:=crm_private.uuid_actor();
 source:=public.crm_bundle()::jsonb;
 -- Join the authoritative TABLE UUID ownership, never a bundle's assignee label.
 select coalesce(jsonb_agg(e),'[]') into own_deals
 from jsonb_array_elements(source->'deals') e
 join public.deals d on d.id::text=e->>'id'
 where crm_private.uuid_can_read_deal(d.assignee_user_id,d.crm_team_id);
 select coalesce(jsonb_agg(
  case when actor.role='consultation' then jsonb_build_object(
   'id',e->'id','site',e->'site','created',e->'created','status',e->'status'
  ) else e end
 ),'[]') into own_inquiries
 from jsonb_array_elements(source->'inquiries') e
 join public.inquiries i on i.id::text=e->>'id'
 where crm_private.uuid_can_read_inquiry(i.assignee_user_id,i.crm_team_id);
 -- Fixed top-level projection. Never return future/global legacy bundle keys.
 result:=jsonb_build_object(
  'generated_at',source->'generated_at','deals',own_deals,'inquiries',own_inquiries,
  'dups','[]'::jsonb,
  'users',jsonb_build_array(jsonb_build_object('id',actor.user_id,'name',actor.display_name,'role',actor.role)),
  'brands',(select coalesce(jsonb_object_agg(k,c),'{}') from
   (select e->>'brand' k,count(*) c from jsonb_array_elements(own_deals) e where e->>'brand' is not null group by 1) x),
  'leads',(select coalesce(jsonb_object_agg(k,c),'{}') from
   (select coalesce(e->>'stage','기타') k,count(*) c from jsonb_array_elements(own_deals) e where e->>'list'='잠재고객' group by 1) x),
  '_crmRead',jsonb_build_object('version',1,'actorId',auth.uid(),'scope',case when actor.role in ('admin','manager') then 'all' else 'own' end)
 );
 return result;
end $$;
revoke all on function public.crm_read_bundle() from public,anon,authenticated;
grant execute on function public.crm_read_bundle() to authenticated;
grant execute on function public.crm_bundle() to service_role;
revoke execute on function public.crm_bundle() from public,anon,authenticated;
do $$
begin
 if has_function_privilege('anon','public.crm_bundle()','EXECUTE') or
    has_function_privilege('authenticated','public.crm_bundle()','EXECUTE') or
    has_function_privilege('anon','public.crm_read_bundle()','EXECUTE') or
    not has_function_privilege('authenticated','public.crm_read_bundle()','EXECUTE') then
  raise exception 'UUID reader ACL mismatch';
 end if;
end $$;
notify pgrst,'reload schema';
commit;
