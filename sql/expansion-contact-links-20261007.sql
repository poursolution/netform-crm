-- B8: one original expansion contact event, atomic links to confirmed same-site pools.
begin;
create table if not exists crm_security.expansion_contact_links(
 event_id uuid not null,source_deal_id uuid not null,target_deal_id uuid not null,
 created_at timestamptz not null default now(),primary key(event_id,target_deal_id),
 check(source_deal_id<>target_deal_id)
);
create index if not exists expansion_contact_links_target on crm_security.expansion_contact_links(target_deal_id,event_id);
create table if not exists crm_security.expansion_contact_receipts(
 actor_auth_uid uuid not null,request_id uuid not null,payload jsonb not null,ack jsonb not null,
 primary key(actor_auth_uid,request_id)
);
alter table crm_security.expansion_contact_links enable row level security;
alter table crm_security.expansion_contact_receipts enable row level security;
revoke all on crm_security.expansion_contact_links,crm_security.expansion_contact_receipts from public,anon,authenticated,service_role;

create or replace function public.crm_expansion_contact_write_v1(p jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a record;src uuid;req uuid;targets uuid[];member_id uuid;site uuid;other_site uuid;
 canonical jsonb;old crm_security.expansion_contact_receipts%rowtype;ack jsonb;ev uuid;
begin
 select * into a from crm_security.actor();if not found then raise exception 'forbidden' using errcode='42501';end if;
 if jsonb_typeof(p) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p) k where k not in('source_opportunity_id','request_id','note','target_ids'))
 or jsonb_typeof(p->'target_ids') is distinct from 'array' or jsonb_array_length(p->'target_ids')>200 then raise exception 'invalid payload' using errcode='22023';end if;
 begin
  src:=(p->>'source_opportunity_id')::uuid;req:=(p->>'request_id')::uuid;
  select array_agg(distinct v::uuid order by v::uuid) into targets from jsonb_array_elements_text(p->'target_ids') x(v);
 exception when others then raise exception 'invalid identity' using errcode='22023';end;
 if src is null or req is null or array_position(targets,null) is not null then raise exception 'invalid identity' using errcode='22023';end if;
 targets:=array_remove(coalesce(targets,array[]::uuid[]),src);
 canonical:=jsonb_build_object('source_opportunity_id',src,'note',p->'note','target_ids',to_jsonb(targets));
 perform 1 from public.users where auth_uid=a.auth_uid for share;
 perform 1 from crm_security.access_review where reviewed_auth_uid=a.auth_uid for share;
 perform pg_advisory_xact_lock(hashtextextended(a.auth_uid::text||req::text,0));
 -- Lock targets in one order; recheck ACL/state before replay as well as a new write.
 for member_id in select unnest(array_append(targets,src)) order by 1 loop
  perform 1 from crm_security.object_scope where user_id=a.user_id and deal_id=member_id for share;
  if not crm_security.can_deal(member_id,true) then raise exception 'forbidden' using errcode='42501';end if;
  perform 1 from public.deals d where d.id=member_id and d.outcome='won' and d.stage_code='won' and d.lifecycle_status='closed' for share;
  if not found then raise exception 'expansion pool state conflict' using errcode='PT409';end if;
  select x.site_id into other_site from crm_security.expansion_pool x where x.source_deal_id=member_id for update;
  if not found then raise exception 'expansion pool state conflict' using errcode='PT409';end if;
  if cardinality(targets)>0 then
   if other_site is null then raise exception 'verified site required' using errcode='22023';end if;
   if not exists(select 1 from public.deals d where d.id=member_id and d.site_id=other_site) then raise exception 'site mapping changed' using errcode='PT409';end if;
   if site is null then site:=other_site;elsif site is distinct from other_site then raise exception 'same site required' using errcode='22023';end if;
  end if;
 end loop;
 select * into old from crm_security.expansion_contact_receipts r where r.actor_auth_uid=a.auth_uid and r.request_id=req;
 if found then
  if old.payload is distinct from canonical then raise exception 'REQUEST_ID_REUSE' using errcode='PT409';end if;
  return old.ack||jsonb_build_object('replayed',true);
 end if;
 ack:=public.crm_expansion_note(jsonb_build_object('source_opportunity_id',src,'request_id',req,'note',p->'note'));
 if ack->>'ok' is distinct from 'true' then raise exception 'original save not acknowledged';end if;
 ev:=(ack#>>'{event,id}')::uuid;
 if ev is null then raise exception 'original event missing';end if;
 insert into crm_security.expansion_contact_links(event_id,source_deal_id,target_deal_id)
 select ev,src,t from unnest(targets) x(t);
 ack:=ack||jsonb_build_object('operation','crm_expansion_contact_write_v1','target_ids',targets,'linked_count',cardinality(targets));
 insert into crm_security.expansion_contact_receipts values(a.auth_uid,req,canonical,ack);
 return ack;
end $$;
revoke all on function public.crm_expansion_contact_write_v1(jsonb) from public,anon;
grant execute on function public.crm_expansion_contact_write_v1(jsonb) to authenticated;

create or replace function public.crm_expansion_contact_context_v1(p jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;src uuid;linked jsonb;
begin
 result:=public.crm_expansion_context(p);src:=(p->>'source_opportunity_id')::uuid;
 select coalesce(jsonb_agg(jsonb_build_object('id','linked:'||e.event_id::text||':'||src::text,
  'source_opportunity_id',src,'kind','접촉·니즈 기록','note',e.note,'actor',e.actor_name,
  'created_at',e.occurred_at,'occurred_at',e.occurred_at,'linked',true,'original_event_id',e.event_id,
  'original_source_id',e.source_deal_id) order by e.occurred_at,e.event_id),'[]'::jsonb)
 into linked from crm_security.expansion_contact_links l
 join crm_security.expansion_pool_events e on e.event_id=l.event_id and e.source_deal_id=l.source_deal_id
 join public.deals d on d.id=l.source_deal_id
 where l.target_deal_id=src and crm_security.can_deal(l.source_deal_id,false)
 -- Legacy reference lines stay in original storage; do not render a duplicate derived copy.
 and not exists(select 1 from crm_security.expansion_pool_events old where old.source_deal_id=src and old.note like '[단지 연락 · 연결] % 원본 기록 '||e.event_id::text);
 return result||jsonb_build_object('events',coalesce(result->'events','[]'::jsonb)||linked);
end $$;
revoke all on function public.crm_expansion_contact_context_v1(jsonb) from public,anon;
grant execute on function public.crm_expansion_contact_context_v1(jsonb) to authenticated;
-- Backfill only exact original UUID + confirmed common site. Never rewrite source notes.
insert into crm_security.expansion_contact_links(event_id,source_deal_id,target_deal_id)
 select original.event_id,original.source_deal_id,ref.source_deal_id
 from crm_security.expansion_pool_events ref
 cross join lateral regexp_match(ref.note,'^\[단지 연락 · 연결\] .* 원본 기록 ([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$') m
 join crm_security.expansion_pool_events original on original.event_id=m[1]::uuid
 join crm_security.expansion_pool a on a.source_deal_id=original.source_deal_id
 join crm_security.expansion_pool b on b.source_deal_id=ref.source_deal_id and b.site_id=a.site_id
 where ref.kind='note' and original.kind='note' and ref.source_deal_id<>original.source_deal_id and a.site_id is not null on conflict do nothing;
notify pgrst,'reload schema';
commit;
