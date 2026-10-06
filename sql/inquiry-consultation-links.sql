-- Non-destructive consultation relationships. No inquiry/assignment/status writes.
-- Apply as one transaction after review. This does not enable the legacy cleanup UI.
begin;

-- The external event inbox currently has only its event-ID index. Pair reads
-- should remain narrow as that inbox grows.
create index if not exists inquiry_change_events_applied_inquiry
 on private.inquiry_change_events(inquiry_id,event_id) where status='applied';

create table crm_security.inquiry_consultation_links (
 left_id uuid not null references public.inquiries(id),
 right_id uuid not null references public.inquiries(id),
 active boolean not null,
 version integer not null check(version>0),
 updated_at timestamptz not null,
 primary key(left_id,right_id), check(left_id<right_id)
);
create index inquiry_consultation_links_right on crm_security.inquiry_consultation_links(right_id,left_id) where active;
create table crm_security.inquiry_consultation_events (
 event_id uuid primary key default gen_random_uuid(),
 left_id uuid not null, right_id uuid not null,
 actor_auth_uid uuid not null, actor_user_id uuid not null, actor_name text not null,
 request_id uuid not null, operation text not null check(operation in ('link','unlink')),
 reason text not null check(length(reason) between 1 and 2000),
 request_payload jsonb not null, receipt jsonb not null,
 created_at timestamptz not null,
 foreign key(left_id,right_id) references crm_security.inquiry_consultation_links(left_id,right_id),
 unique(actor_auth_uid,request_id)
);
create index inquiry_consultation_events_pair on crm_security.inquiry_consultation_events(left_id,right_id,created_at,event_id);
alter table crm_security.inquiry_consultation_links enable row level security;
alter table crm_security.inquiry_consultation_events enable row level security;
revoke all on crm_security.inquiry_consultation_links,crm_security.inquiry_consultation_events from public,anon,authenticated,service_role;

-- Reuse reviewed identity and per-inquiry visibility; trash is not a readable peer.
create function crm_security.consultation_can_read(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce(crm_security.can_inquiry(p_id),false) and coalesce((
  select e.action not in ('inquiry_trash','inquiry_purge')
  from crm_security.inquiry_audit_events e where e.inquiry_id=p_id
   and e.action in ('inquiry_trash','inquiry_restore','inquiry_purge')
  order by e.created_at desc,e.event_id desc limit 1),true)
$$;
revoke all on function crm_security.consultation_can_read(uuid) from public,anon,authenticated,service_role;

create function public.crm_inquiry_consultation_preview_v1(p_left uuid,p_right uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a record; l uuid:=least(p_left,p_right); r uuid:=greatest(p_left,p_right);
 rows jsonb; versions jsonb; rel crm_security.inquiry_consultation_links%rowtype;
begin
 select * into a from crm_security.actor();
 if not found or a.permission_role<>'admin' then raise exception 'forbidden' using errcode='42501'; end if;
 if p_left is null or p_right is null or p_left=p_right then raise exception 'INVALID_PAIR' using errcode='22023'; end if;
 if not crm_security.consultation_can_read(l) or not crm_security.consultation_can_read(r) then
  raise exception 'forbidden' using errcode='42501'; end if;
 -- xmin catches changes even when an old writer forgets updated_at; row hash also
 -- protects content and is opaque to the client. It is not an authorization token.
 select jsonb_object_agg(i.id::text,i.xmin::text||':'||md5(to_jsonb(i)::text)),
  jsonb_agg(jsonb_build_object('id',i.id,'brand',i.brand,'site_name',i.site_name,
   'status',i.status,'assigned_to',i.assigned_to,'updated_at',i.updated_at) order by i.id)
 into versions,rows from public.inquiries i where i.id in (l,r);
 select * into rel from crm_security.inquiry_consultation_links where left_id=l and right_id=r;
 return jsonb_build_object('ok',true,'left_id',l,'right_id',r,'inquiries',rows,
  'expected',jsonb_build_object('rows',versions,'relationship_version',coalesce(rel.version,0)),
  'active',coalesce(rel.active,false));
end $$;

create function public.crm_inquiry_consultation_write_v1(
 p_left uuid,p_right uuid,p_operation text,p_reason text,p_request_id uuid,p_expected jsonb
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare a record; l uuid:=least(p_left,p_right); r uuid:=greatest(p_left,p_right);
 payload jsonb; previous crm_security.inquiry_consultation_events%rowtype;
 state jsonb; rel crm_security.inquiry_consultation_links%rowtype;
 eid uuid:=gen_random_uuid(); at_time timestamptz; result jsonb; target_active boolean;
begin
 select * into a from crm_security.actor();
 if not found or a.permission_role<>'admin' then raise exception 'forbidden' using errcode='42501'; end if;
 if p_left is null or p_right is null or p_left=p_right or p_request_id is null
  or p_operation is null or p_operation not in ('link','unlink')
  or p_reason is null or length(btrim(p_reason)) not between 1 and 2000
  or jsonb_typeof(p_expected) is distinct from 'object' then
  raise exception 'INVALID_REQUEST' using errcode='22023'; end if;
 payload:=jsonb_build_object('left_id',l,'right_id',r,'operation',p_operation,'reason',btrim(p_reason),'expected',p_expected);
 -- Request lock first, then the two source rows in UUID order. Unrelated pairs
 -- are not locked. Source row locks serialize opposite-order requests too.
 perform pg_advisory_xact_lock(hashtextextended('consultation-request:'||a.auth_uid::text||':'||p_request_id::text,0));
 perform 1 from public.inquiries i where i.id in (l,r) order by i.id for update;
 if not crm_security.consultation_can_read(l) or not crm_security.consultation_can_read(r) then
  raise exception 'forbidden' using errcode='42501'; end if;
 select * into previous from crm_security.inquiry_consultation_events
  where actor_auth_uid=a.auth_uid and request_id=p_request_id;
 if found then
  if previous.request_payload is distinct from payload then raise exception 'REQUEST_ID_REUSE' using errcode='PT409'; end if;
  return previous.receipt;
 end if;
 state:=public.crm_inquiry_consultation_preview_v1(l,r);
 if state->'expected' is distinct from p_expected then raise exception 'STALE_PREVIEW' using errcode='PT409'; end if;
 select * into rel from crm_security.inquiry_consultation_links where left_id=l and right_id=r for update;
 target_active:=(p_operation='link');
 if coalesce(rel.active,false)=target_active then raise exception 'RELATIONSHIP_UNCHANGED' using errcode='PT409'; end if;
 at_time:=clock_timestamp();
 insert into crm_security.inquiry_consultation_links(left_id,right_id,active,version,updated_at)
 values(l,r,target_active,coalesce(rel.version,0)+1,at_time)
 on conflict(left_id,right_id) do update set active=excluded.active,version=excluded.version,updated_at=excluded.updated_at;
 result:=jsonb_build_object('ok',true,'operation',p_operation,'request_id',p_request_id,
  'event_id',eid,'left_id',l,'right_id',r,'active',target_active,'version',coalesce(rel.version,0)+1,'saved_at',at_time);
 insert into crm_security.inquiry_consultation_events(event_id,left_id,right_id,actor_auth_uid,actor_user_id,
  actor_name,request_id,operation,reason,request_payload,receipt,created_at)
 values(eid,l,r,a.auth_uid,a.user_id,a.display_name,p_request_id,p_operation,btrim(p_reason),payload,result,at_time);
 return result;
end $$;

-- Direct peers only. No transitive expansion or access grant follows a link.
create function public.crm_inquiry_consultation_list_v1(p_inquiry uuid,p_after uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from crm_security.actor()) or not crm_security.consultation_can_read(p_inquiry) then
  raise exception 'forbidden' using errcode='42501'; end if;
 with peers as (
  select right_id id,version from crm_security.inquiry_consultation_links where left_id=p_inquiry and active
  union all select left_id,version from crm_security.inquiry_consultation_links where right_id=p_inquiry and active
 ), permitted as (
  select p.id,p.version,i.brand,i.site_name,i.status,i.assigned_to from peers p join public.inquiries i on i.id=p.id
  where (p_after is null or p.id>p_after) and crm_security.consultation_can_read(p.id) order by p.id limit 21
 ), page as (select * from permitted order by id limit 20)
 select jsonb_build_object('ok',true,'items',coalesce((select jsonb_agg(to_jsonb(p) order by id) from page p),'[]'::jsonb),
  'next_cursor',case when (select count(*) from permitted)>20 then (select max(id::text) from page) else null end) into result;
 return result;
end $$;

-- Dates from external systems may be absent or malformed. Never invent contact times.
create function crm_security.consultation_source_time(p_text text) returns timestamptz
language plpgsql stable set search_path='' as $$
begin
 if p_text is null or p_text !~ '^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$' then return null; end if;
 return p_text::timestamptz;
exception when others then return null;
end $$;
revoke all on function crm_security.consultation_source_time(text) from public,anon,authenticated,service_role;

create function public.crm_inquiry_consultation_history_v1(p_left uuid,p_right uuid,p_after jsonb default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare l uuid:=least(p_left,p_right); r uuid:=greatest(p_left,p_right); result jsonb; after_at timestamptz; after_key text;
begin
 if p_left is null or p_right is null or p_left=p_right then raise exception 'INVALID_PAIR' using errcode='22023'; end if;
 if not exists(select 1 from crm_security.actor()) or not crm_security.consultation_can_read(l)
  or not crm_security.consultation_can_read(r) then raise exception 'forbidden' using errcode='42501'; end if;
 -- Inactive relationships remain auditable but do not expose a combined timeline.
 if not exists(select 1 from crm_security.inquiry_consultation_links where left_id=l and right_id=r and active) then
  raise exception 'LINK_NOT_ACTIVE' using errcode='PT409'; end if;
 if p_after is not null then
  after_at:=crm_security.consultation_source_time(p_after->>'at'); after_key:=p_after->>'key';
  if jsonb_typeof(p_after) is distinct from 'object' or after_key is null or length(after_key) not between 1 and 1024
   or (p_after->>'at' is not null and after_at is null) then raise exception 'INVALID_CURSOR' using errcode='22023'; end if;
 end if;
 with raw_events as (
  select i.id inquiry_id,e.value,e.ordinality from public.inquiries i
  cross join lateral jsonb_array_elements(case when jsonb_typeof(i.raw->'external_change_history')='array'
   then i.raw->'external_change_history' else '[]'::jsonb end) with ordinality e(value,ordinality)
  where i.id in (l,r)
 ), external_events as (
  select e.inquiry_id,e.event_id,1 priority,e.payload->>'kind' kind,e.payload->>'actor_name' actor_name,
   crm_security.consultation_source_time(e.payload->>'occurred_at') occurred_at,
   jsonb_build_object('content',e.payload->>'response_content','status',e.payload->>'status',
    'reason',e.payload->>'close_reason','to',e.payload->>'to') detail
  from private.inquiry_change_events e where e.inquiry_id in (l,r) and e.status='applied'
  union all
  select e.inquiry_id,coalesce(nullif(e.value->>'event_id',''),'raw-index:'||e.ordinality),2,
   e.value->>'kind',e.value->>'actor_name',crm_security.consultation_source_time(e.value->>'source_at'),
   jsonb_build_object('content',e.value#>>'{after,response_content}','status',e.value#>>'{after,status}',
    'reason',e.value#>>'{after,close_reason}','to',e.value#>>'{after,to}') from raw_events e
 ), canonical_external as (
  select distinct on(inquiry_id,event_id) * from external_events order by inquiry_id,event_id,priority
 ), events as (
  select e.inquiry_id,'external:'||e.inquiry_id||':'||e.event_id event_key,'external' source,e.event_id source_event_id,
   e.kind,e.actor_name,e.occurred_at,e.detail from canonical_external e
  union all
  select c.inquiry_id,'contact:'||c.id,'crm_contact',c.id::text,c.kind,c.actor_name,c.occurred_at,
   jsonb_build_object('content',c.content,'channel',c.channel,'result',c.result)
  from crm_security.inquiry_contact_logs c where c.inquiry_id in (l,r)
  union all
  select null::uuid,'relationship:'||e.event_id,'consultation_link',e.event_id::text,e.operation,e.actor_name,e.created_at,
   jsonb_build_object('reason',e.reason,'left_id',e.left_id,'right_id',e.right_id)
  from crm_security.inquiry_consultation_events e where e.left_id=l and e.right_id=r
 ), bounded as (
  select * from events where p_after is null or
   (coalesce(occurred_at,'-infinity'::timestamptz),event_key collate "C")>
   (coalesce(after_at,'-infinity'::timestamptz),after_key collate "C")
  order by occurred_at asc nulls first,event_key collate "C" limit 21
 ), page as (select * from bounded order by occurred_at asc nulls first,event_key collate "C" limit 20)
 select jsonb_build_object('ok',true,'items',coalesce((select jsonb_agg(to_jsonb(p) order by occurred_at asc nulls first,event_key collate "C") from page p),'[]'::jsonb),
  'next_cursor',case when (select count(*) from bounded)>20 then
   (select jsonb_build_object('at',occurred_at,'key',event_key) from page order by occurred_at desc nulls last,event_key collate "C" desc limit 1)
   else null end) into result;
 return result;
end $$;

revoke all on function public.crm_inquiry_consultation_preview_v1(uuid,uuid),
 public.crm_inquiry_consultation_write_v1(uuid,uuid,text,text,uuid,jsonb),
 public.crm_inquiry_consultation_list_v1(uuid,uuid),public.crm_inquiry_consultation_history_v1(uuid,uuid,jsonb)
 from public,anon,authenticated,service_role;
grant execute on function public.crm_inquiry_consultation_preview_v1(uuid,uuid),
 public.crm_inquiry_consultation_write_v1(uuid,uuid,text,text,uuid,jsonb),
 public.crm_inquiry_consultation_list_v1(uuid,uuid),public.crm_inquiry_consultation_history_v1(uuid,uuid,jsonb)
 to authenticated;
commit;
