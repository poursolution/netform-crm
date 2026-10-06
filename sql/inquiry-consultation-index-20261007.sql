-- Requires sql/inquiry-consultation-links.sql (existing preview/write + RLS).
-- Narrow, permission-filtered lookup; max 20. No customer data changes.
begin;
CREATE OR REPLACE FUNCTION public.crm_inquiry_consultation_list_v1(p_inquiry uuid, p_after uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
 if not exists(select 1 from crm_security.actor()) or not crm_security.consultation_can_read(p_inquiry) then
  raise exception 'forbidden' using errcode='42501'; end if;
 with peers as (
  select left_id,right_id,right_id id,version from crm_security.inquiry_consultation_links where left_id=p_inquiry and active
  union all select left_id,right_id,left_id id,version from crm_security.inquiry_consultation_links where right_id=p_inquiry and active
 ), permitted as (
  select p.id,p.version,i.brand,i.site_name,i.status,i.assigned_to,e.created_at as at,e.actor_name as by
  from peers p join public.inquiries i on i.id=p.id
  left join lateral (
   select created_at,actor_name from crm_security.inquiry_consultation_events e
   where e.left_id=p.left_id and e.right_id=p.right_id and e.operation='link'
   order by created_at desc,event_id desc limit 1
  ) e on true
  where (p_after is null or p.id>p_after) and crm_security.consultation_can_read(p.id) order by p.id limit 21
 ), page as (select * from permitted order by id limit 20)
 select jsonb_build_object('ok',true,'items',coalesce((select jsonb_agg(to_jsonb(p) order by id) from page p),'[]'::jsonb),
  'next_cursor',case when (select count(*) from permitted)>20 then (select max(id::text) from page) else null end) into result;
 return result;
end $function$;
notify pgrst, 'reload schema';
commit;
