-- Local candidate only. Shared PC/mobile read contract; no person/link/consent mutation.
-- Schema and can_deal verified in contact-match-catalog-20261011.json.
begin;

create or replace function public.crm_contact_match_read_v1(
  p_opportunity_id uuid, p_phone text, p_page integer default 1
) returns jsonb
language plpgsql stable security definer set search_path='' as $function$
declare
  a record;
  target_version integer;
  normalized_phone text;
  response jsonb;
begin
  select * into a from crm_security.actor();
  if not found or a.user_id is null or a.auth_uid is distinct from auth.uid() then
    raise exception 'forbidden' using errcode='42501';
  end if;
  select d.version into target_version from public.deals d
  where d.id=p_opportunity_id and crm_security.can_deal(d.id,false);
  if not found then raise exception 'forbidden' using errcode='42501'; end if;

  -- Formatting separators may be removed; letters/OCR guesses may not become digits.
  if p_phone is null or length(p_phone)>64
     or p_phone !~ '^[[:space:]]*(\+82|0)[0-9[:space:]()-]+[[:space:]]*$'
     or p_page is null or p_page<1 then
    raise exception 'invalid contact match query' using errcode='22023';
  end if;
  normalized_phone:=regexp_replace(p_phone,'[[:space:]()-]','','g');
  if left(normalized_phone,3)='+82' then normalized_phone:='0'||substr(normalized_phone,4); end if;
  if normalized_phone !~ '^010[0-9]{8}$' then
    raise exception 'invalid contact match phone' using errcode='22023';
  end if;

  with authorized_deals as materialized (
    select d.id,d.contact_id,d.site_id from public.deals d
    where crm_security.can_deal(d.id,false)
  ), matched_contacts as materialized (
    select c.id,c.person_key,c.name,coalesce(nullif(c.role,''),nullif(c.title,'')) as role
    from public.contacts c
    where exists (
      select 1 from (values(c.mobile),(c.phone)) phone_value(raw)
      cross join lateral (
        select regexp_replace(phone_value.raw,'[[:space:]()-]','','g') as compact
      ) normalized
      where length(phone_value.raw)<=64
        and phone_value.raw ~ '^[[:space:]]*(\+82|0)[0-9[:space:]()-]+[[:space:]]*$'
        and case when left(normalized.compact,3)='+82' then '0'||substr(normalized.compact,4)
                 else normalized.compact end=normalized_phone
    )
  ), scoped_links as materialized (
    select c.id as contact_id,d.id as opportunity_id,d.site_id
    from matched_contacts c join authorized_deals d on d.contact_id=c.id
    union
    select c.id,d.id,d.site_id
    from matched_contacts c
    join public.contact_assignments ca on ca.person_key=c.person_key
    join authorized_deals d on d.id=ca.opportunity_id
    -- Historical assignments remain evidence of a link, not proof of a current role.
  ), visible_contacts as materialized (
    select c.* from matched_contacts c
    where exists(select 1 from scoped_links l where l.contact_id=c.id)
  ), contact_page as (
    select * from visible_contacts order by id
    limit 20 offset ((p_page::bigint-1)*20)
  ), rendered as (
    select c.id,jsonb_build_object(
      'contact_id',c.id,'person_key',c.person_key,'name',c.name,'role',c.role,
      'matched_phone',normalized_phone,
      'linked_to_target',exists(select 1 from scoped_links l where l.contact_id=c.id and l.opportunity_id=p_opportunity_id),
      'links',(
        select jsonb_agg(jsonb_build_object('opportunity_id',l.opportunity_id,'site_id',l.site_id,'site_name',s.site_name) order by l.opportunity_id)
        from (select * from scoped_links sl where sl.contact_id=c.id order by sl.opportunity_id limit 20) l
        left join public.sites s on s.site_id=l.site_id
      ),
      'link_total',(select count(*) from scoped_links l where l.contact_id=c.id),
      'links_truncated',(select count(*)>20 from scoped_links l where l.contact_id=c.id),
      'can_link',false
    ) as value from contact_page c
  )
  select jsonb_build_object(
    'contract','contact-match-read-v1','actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,
    'object_id',p_opportunity_id,'object_version',target_version,'phone',normalized_phone,
    'scope','authorized_deals_only','page',p_page,'page_size',20,
    'total',(select count(*) from visible_contacts),
    'has_more',(select count(*)>(p_page::bigint*20) from visible_contacts),
    'candidates',coalesce((select jsonb_agg(value order by id) from rendered),'[]'::jsonb)
  ) into response;
  return response;
end
$function$;

revoke all on function public.crm_contact_match_read_v1(uuid,text,integer) from public,anon,service_role;
grant execute on function public.crm_contact_match_read_v1(uuid,text,integer) to authenticated;
comment on function public.crm_contact_match_read_v1(uuid,text,integer) is
  'contact-match-read-v1: exact mobile candidates within currently authorized deal links; no merge, link, consent or company writes.';
commit;
