-- B6: index explicit contact markers without copying the original contact.
-- No FK cascade: trash/restore keeps the index; reads require both live records.
begin;
create table if not exists crm_security.activity_links(
 source_type text not null check(source_type in ('deal','inquiry')),
 activity_id uuid not null, source_id uuid not null,
 target_type text not null check(target_type in ('deal','inquiry')),target_id uuid not null,
 created_at timestamptz not null default now(),
 primary key(source_type,activity_id,target_type,target_id),
 check(source_type<>target_type or source_id<>target_id)
);
create index if not exists activity_links_target on crm_security.activity_links(target_type,target_id,activity_id);
create index if not exists activity_links_source on crm_security.activity_links(source_type,source_id);
alter table crm_security.activity_links enable row level security;
revoke all on crm_security.activity_links from public,anon,authenticated,service_role;

create or replace function crm_security.activity_target_allowed(kind text,id uuid,writing boolean default false)
returns boolean language sql stable security definer set search_path='' as $$
 select case when kind='deal' then coalesce(crm_security.can_deal(id,writing),false)
 when kind='inquiry' then coalesce(crm_security.consultation_can_read(id),false) and
  (not writing or exists(select 1 from crm_security.actor() a join public.inquiries i on i.id=id
   where a.permission_role='admin' or (a.permission_role in ('rep','consultation') and i.assigned_to=a.user_id)
    or (a.permission_role='branch' and exists(select 1 from crm_security.object_scope s
     where s.user_id=a.user_id and s.inquiry_id=i.id and s.expires_at>now() and s.can_write))))
 else false end
$$;
revoke all on function crm_security.activity_target_allowed(text,uuid,boolean) from public,anon,authenticated,service_role;

create or replace function crm_security.activity_marker_targets(note text)
returns table(target_type text,target_id uuid) language sql immutable set search_path='' as $$
 select distinct case split_part(k,':',1) when 'inq' then 'inquiry' else 'deal' end,split_part(k,':',2)::uuid
 from regexp_matches(coalesce(note,''),'\[연결 ([^\]]*)\]','g') m,
 lateral unnest(string_to_array(m[1],',')) k
 where k ~ '^(deal|inq):[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
$$;
revoke all on function crm_security.activity_marker_targets(text) from public,anon,authenticated,service_role;

create or replace function crm_security.index_activity_links()
returns trigger language plpgsql security definer set search_path='' as $$
declare typ text; sid uuid; note text; oldnote text; target record;
begin
 if tg_table_schema='public' then typ:='deal';sid:=new.deal_id;note:=new.detail->>'note';
  if tg_op='UPDATE' then oldnote:=old.detail->>'note'; end if;
 else typ:='inquiry';sid:=new.inquiry_id;note:=new.content;
  if tg_op='UPDATE' then oldnote:=old.content; end if;
 end if;
 if tg_op='UPDATE' and note is not distinct from oldnote then return new; end if;
 -- Restore of an unchanged original record must not re-authorize old targets.
 -- Only newly added links require current write access; every read rechecks both ends.
 for target in select * from crm_security.activity_marker_targets(note) loop
  if typ=target.target_type and sid=target.target_id then continue; end if;
  if not exists(select 1 from crm_security.activity_links l where l.source_type=typ and l.activity_id=new.id
    and l.source_id=sid and l.target_type=target.target_type and l.target_id=target.target_id) then
   if not crm_security.activity_target_allowed(typ,sid,true) or
      not crm_security.activity_target_allowed(target.target_type,target.target_id,true) then
    raise exception '연결할 원본과 대상의 기록 권한을 확인해 주세요' using errcode='42501';
   end if;
   insert into crm_security.activity_links(source_type,activity_id,source_id,target_type,target_id)
    values(typ,new.id,sid,target.target_type,target.target_id);
  end if;
 end loop;
 -- No original note/history is modified. Removed markers only remove their derived index.
 delete from crm_security.activity_links l where l.source_type=typ and l.activity_id=new.id
  and not exists(select 1 from crm_security.activity_marker_targets(note) t where t.target_type=l.target_type and t.target_id=l.target_id);
 return new;
end $$;
revoke all on function crm_security.index_activity_links() from public,anon,authenticated,service_role;
drop trigger if exists crm_index_activity_links on public.activities;
create trigger crm_index_activity_links after insert or update of detail on public.activities
 for each row execute function crm_security.index_activity_links();
drop trigger if exists crm_index_inquiry_activity_links on crm_security.inquiry_contact_logs;
create trigger crm_index_inquiry_activity_links after insert or update of content on crm_security.inquiry_contact_logs
 for each row execute function crm_security.index_activity_links();

-- Exact legacy markers only. Non-UUID keys and missing source records stay in original text.
insert into crm_security.activity_links(source_type,activity_id,source_id,target_type,target_id)
 select 'deal',a.id,a.deal_id,t.target_type,t.target_id from public.activities a
 cross join lateral crm_security.activity_marker_targets(a.detail->>'note') t
 where a.deal_id is not null and not(t.target_type='deal' and t.target_id=a.deal_id)
 on conflict do nothing;
insert into crm_security.activity_links(source_type,activity_id,source_id,target_type,target_id)
 select 'inquiry',a.id,a.inquiry_id,t.target_type,t.target_id from crm_security.inquiry_contact_logs a
 cross join lateral crm_security.activity_marker_targets(a.content) t
 where not(t.target_type='inquiry' and t.target_id=a.inquiry_id) on conflict do nothing;

create or replace function public.crm_activity_links_v1(p jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare typ text:=p->>'target_type';tid uuid;cursor_id uuid;result jsonb;
begin
 begin tid:=(p->>'target_id')::uuid;cursor_id:=nullif(p->>'after','')::uuid;
 exception when others then raise exception 'invalid payload' using errcode='22023';end;
 if not exists(select 1 from crm_security.actor()) or not crm_security.activity_target_allowed(typ,tid) then
  raise exception 'forbidden' using errcode='42501';end if;
 with linked as (
  select l.activity_id,l.source_id,l.source_type from crm_security.activity_links l
  where l.target_type=typ and l.target_id=tid and (cursor_id is null or l.activity_id>cursor_id)
   and crm_security.activity_target_allowed(l.source_type,l.source_id)
 ), permitted as (
  select l.activity_id,a.occurred_at at,a.actor_name who,a.type,a.detail->>'note' note,'deal:'||l.source_id src,d.list_name site
  from linked l join public.activities a on l.source_type='deal' and a.id=l.activity_id and a.deal_id=l.source_id
   join public.deals d on d.id=l.source_id
  union all
  select l.activity_id,a.occurred_at,a.actor_name,a.channel,a.content,'inq:'||l.source_id,i.site_name
  from linked l join crm_security.inquiry_contact_logs a on l.source_type='inquiry' and a.id=l.activity_id and a.inquiry_id=l.source_id
   join public.inquiries i on i.id=l.source_id
 ), bounded as(select * from permitted order by activity_id limit 21),page as(select * from bounded order by activity_id limit 20)
 select jsonb_build_object('ok',true,'items',coalesce((select jsonb_agg(to_jsonb(x)-'note'||jsonb_build_object('text',regexp_replace(x.note,'\s*\[연결 [^\]]*\]','','g')) order by activity_id) from page x),'[]'::jsonb),
 'next_cursor',case when (select count(*) from bounded)>20 then (select max(activity_id::text) from page) else null end) into result;
 return result;
end $$;
revoke all on function public.crm_activity_links_v1(jsonb) from public,anon;
grant execute on function public.crm_activity_links_v1(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
