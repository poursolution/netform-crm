-- Candidate only. No production deployment has been performed.
-- Private definer is required because canonical organizations have deny-by-default
-- table RLS; it retains the approved actor and existing note authorization checks.
create or replace function crm_security.orphan_organization_history(p_org uuid default null,p_after uuid default null,p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; page_size integer:=greatest(1,least(coalesce(p_limit,50),100));
begin
 if not exists(select 1 from crm_security.actor() a where a.permission_role='admin') then
   raise exception 'forbidden' using errcode='42501';
 end if;
 if p_org is null then
  with candidates as (
   select o.id,o.name from public.organizations o
   where (p_after is null or o.id>p_after)
    and not exists(select 1 from public.deals d where d.organization_id=o.id)
    and exists(select 1 from public.notes n where n.organization_id=o.id and crm_security.can_read_legacy_note(n.deal_id,n.organization_id))
   order by o.id limit page_size+1
  ), page as(select * from candidates order by id limit page_size)
  select jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'organization_id',p.id,'key','organization:'||p.id::text,'site_id',null,'name',p.name,'note_count',(select count(*) from public.notes n where n.organization_id=p.id and crm_security.can_read_legacy_note(n.deal_id,n.organization_id))) order by p.id) from page p),'[]'::jsonb),
  'has_more',(select count(*)>page_size from candidates),'next_cursor',(select id from page order by id desc limit 1)) into result;
 else
  if not exists(select 1 from public.organizations o where o.id=p_org) or exists(select 1 from public.deals d where d.organization_id=p_org) then
   return jsonb_build_object('items','[]'::jsonb,'has_more',false,'next_cursor',null);
  end if;
  with candidates as(
   select n.id,n.body,n.author_name,n.posted_at,n.created_at from public.notes n
   where n.organization_id=p_org and (p_after is null or n.id>p_after)
    and crm_security.can_read_legacy_note(n.deal_id,n.organization_id)
   order by n.id limit page_size+1
  ), page as(select * from candidates order by id limit page_size)
  select jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',id,'source','relate_note','body',body,'actor',author_name,'occurred_at',posted_at,'recorded_at',created_at) order by id) from page),'[]'::jsonb),
  'has_more',(select count(*)>page_size from candidates),'next_cursor',(select id from page order by id desc limit 1)) into result;
 end if;
 return result;
end $$;
revoke all on function crm_security.orphan_organization_history(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function crm_security.orphan_organization_history(uuid,uuid,integer) to authenticated;
create or replace function public.crm_orphan_organization_history(p_org uuid default null,p_after uuid default null,p_limit integer default 50)
-- Bind the private function at creation time. Runtime string-body parsing would
-- require schema USAGE, which authenticated intentionally does not possess.
-- Keep invoker security and the private function's explicit actor authorization.
returns jsonb language sql stable security invoker set search_path=''
return crm_security.orphan_organization_history(p_org,p_after,p_limit);
revoke all on function public.crm_orphan_organization_history(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.crm_orphan_organization_history(uuid,uuid,integer) to authenticated;
