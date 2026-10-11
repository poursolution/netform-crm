-- Candidate only. Install disabled; do not enable until all replacement writers are routed.
-- Existing actor/access_review and next_actions remain authoritative. No backfill.
begin;

create table if not exists crm_security.schedule_v1_settings (
 singleton boolean primary key default true check (singleton),
 enabled boolean not null default false
);
insert into crm_security.schedule_v1_settings(singleton,enabled) values(true,false) on conflict do nothing;
create table if not exists crm_security.schedule_v1_events (
 event_id uuid primary key default gen_random_uuid(),
 actor_auth_uid uuid not null, actor_user_id uuid not null,
 request_id uuid not null, target_type text not null check(target_type in ('deal','inquiry')),
 target_id uuid not null, action_id uuid not null,
 operation text not null check(operation in ('add','reschedule')),
 date_basis text not null check(date_basis in ('internal_plan','customer_agreed')),
 reason text not null, before_data jsonb, after_data jsonb not null,
 command jsonb not null, ack jsonb not null, created_at timestamptz not null default clock_timestamp(),
 unique(actor_auth_uid,request_id)
);
-- Intentionally no cascading FK: original schedule/owner history survives deletion.
create index if not exists schedule_v1_action_history on crm_security.schedule_v1_events(action_id,created_at desc,event_id desc);
alter table crm_security.schedule_v1_settings enable row level security;
alter table crm_security.schedule_v1_events enable row level security;
revoke all on crm_security.schedule_v1_settings,crm_security.schedule_v1_events from public,anon,authenticated;

-- Current provenance and historical promise protection are intentionally separate.
-- The optional compound-request migration may be installed before or after this one.
create or replace function crm_security.schedule_v1_provenance(n jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare basis text; followup_basis text; agreed boolean; followup_agreed boolean;
begin
 select e.date_basis into basis from crm_security.schedule_v1_events e
 where e.action_id=(n->>'id')::uuid
  and e.after_data->>'due_at'=n->>'due_at'
  and e.after_data->>'updated_at'=n->>'updated_at'
  and e.after_data->>'title'=n->>'title'
  and e.after_data->>'assignee_name'=n->>'assignee_name'
  and e.after_data->>'action_type'=n->>'action_type'
 order by e.created_at desc,e.event_id desc limit 1;
 select exists(select 1 from crm_security.schedule_v1_events e
  where e.action_id=(n->>'id')::uuid and e.date_basis='customer_agreed') into agreed;
 if n->>'inquiry_id' is not null and to_regclass('crm_security.work_request_followup_events') is not null then
  execute $q$
   select e.ack->>'plan_origin' from crm_security.work_request_followup_events e
   join public.users u on u.user_id=e.actor_user_id
   where e.next_action_id=($1->>'id')::uuid and e.inquiry_id=($1->>'inquiry_id')::uuid
    and e.ack->>'status'='created' and e.ack->>'next_action_id'=$1->>'id'
    and e.ack->>'title'=$1->>'title' and u.name=$1->>'assignee_name'
    and e.ack->>'due_date'=((($1->>'due_at')::timestamptz at time zone 'Asia/Seoul')::date)::text
    and $1->>'action_type'=case e.ack->>'ask'
     when '연락 후 견적 필요 여부 확인' then '견적' when '현장방문 필요 여부 확인' then '방문' end
   order by e.created_at desc,e.id desc limit 1
  $q$ into followup_basis using n;
  execute $q$
   select exists(select 1 from crm_security.work_request_followup_events e
    where e.next_action_id=($1->>'id')::uuid and e.inquiry_id=($1->>'inquiry_id')::uuid
     and e.ack->>'status'='created' and e.ack->>'next_action_id'=$1->>'id'
     and e.ack->>'plan_origin'='customer_agreed')
  $q$ into followup_agreed using n;
 end if;
 return jsonb_build_object('date_basis',coalesce(basis,followup_basis,'unconfirmed'),
  'customer_agreed',agreed or coalesce(followup_agreed,false));
end $$;
revoke all on function crm_security.schedule_v1_provenance(jsonb) from public,anon,authenticated;

create or replace function crm_security.schedule_v1_context(kind text,target uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a record; d public.deals%rowtype; i public.inquiries%rowtype; parent jsonb; own uuid; owner_name text; last_management text; writable boolean;
begin
 if auth.uid() is null or kind is null or kind not in ('deal','inquiry') or target is null then
  raise exception 'SCHEDULE_FORBIDDEN' using errcode='42501';
 end if;
 perform 1 from public.users where auth_uid=auth.uid() for share;
 perform 1 from crm_security.access_review where reviewed_auth_uid=auth.uid() for share;
 select * into a from crm_security.actor();
 if not found then raise exception 'SCHEDULE_FORBIDDEN' using errcode='42501'; end if;
 if kind='deal' then
  perform 1 from crm_security.object_scope where user_id=a.user_id and deal_id=target for share;
  select * into d from public.deals where id=target for update;
  if not found or a.permission_role not in ('rep','branch','admin') or not crm_security.can_deal(target,true) then
   raise exception 'SCHEDULE_FORBIDDEN' using errcode='42501';
  end if;
  own:=d.owner_id; parent:=to_jsonb(d);
  writable:=coalesce(d.lifecycle_status,'')<>'closed' and d.outcome is null
   and coalesce(d.stage_code,'') not in ('won','lost','badfit','badfit_lead','badfit_pipe','nocontact');
 else
  perform 1 from crm_security.object_scope where user_id=a.user_id and inquiry_id=target for share;
  select * into i from public.inquiries where id=target for update;
  if not found or not crm_security.can_inquiry(target) or a.permission_role not in ('rep','consultation','admin')
   or (a.permission_role<>'admin' and i.assigned_to is distinct from a.user_id)
   or coalesce(i.inquiry_type,'')='기술자문' or coalesce(i.brand,'')='기술자문' then
   raise exception 'SCHEDULE_FORBIDDEN' using errcode='42501';
  end if;
  select e.action into last_management from crm_security.inquiry_audit_events e where e.inquiry_id=target
   and e.action in ('inquiry_trash','inquiry_restore','inquiry_purge') order by e.created_at desc,e.event_id desc limit 1;
  own:=i.assigned_to; parent:=to_jsonb(i);
  writable:=coalesce(last_management,'') not in ('inquiry_trash','inquiry_purge')
   and coalesce(i.status,'') not in ('수주','실주','배드핏','연락두절','종결','종료','협약완료','해결완료','영업전환')
   and parent->>'deal_id' is null and parent->>'opportunity_id' is null and parent->>'qualified_at' is null;
 end if;
 select u.name into owner_name from public.users u where u.user_id=own and u.active;
 return jsonb_build_object('actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'owner_id',own,
  'owner_name',owner_name,'parent',parent,'writable',writable and own is not null and owner_name is not null);
end $$;

create or replace function crm_security.schedule_v1_token(kind text,target uuid,parent jsonb)
returns text language sql stable security definer set search_path='' as $$
 select md5(jsonb_build_object('parent',parent,'actions',coalesce(jsonb_agg(to_jsonb(n) order by n.id),'[]'::jsonb))::text)
 from public.next_actions n where (kind='deal' and n.deal_id=target) or (kind='inquiry' and n.inquiry_id=target)
$$;

create or replace function public.crm_schedule_list_v1(p jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ctx jsonb; kind text; target uuid; page_no integer; total integer; items jsonb; token text;
begin
 if jsonb_typeof(p) is distinct from 'object' or not p ?& array['target_type','target_id']
  or exists(select 1 from jsonb_object_keys(p) k where k not in ('target_type','target_id','page')) then
  raise exception 'SCHEDULE_INVALID_INPUT' using errcode='22023'; end if;
 kind:=p->>'target_type'; target:=(p->>'target_id')::uuid; page_no:=coalesce((p->>'page')::integer,1);
 if page_no<1 or page_no>100000 or (p ? 'page' and jsonb_typeof(p->'page') is distinct from 'number') then
  raise exception 'SCHEDULE_INVALID_PAGE' using errcode='22023'; end if;
 ctx:=crm_security.schedule_v1_context(kind,target);
 token:=crm_security.schedule_v1_token(kind,target,ctx->'parent');
 select count(*) into total from public.next_actions n where n.status='open'
  and ((kind='deal' and n.deal_id=target) or (kind='inquiry' and n.inquiry_id=target));
 select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'action_type',x.action_type,'title',x.title,
   'due_at',x.due_at,'due_on',(x.due_at at time zone 'Asia/Seoul')::date,'status',x.status,
   'assignee_name',x.assignee_name,'updated_at',x.updated_at,
   'date_basis',crm_security.schedule_v1_provenance(to_jsonb(x))->>'date_basis') order by x.due_at,x.id),'[]'::jsonb)
 into items from (select n.* from public.next_actions n where n.status='open'
  and ((kind='deal' and n.deal_id=target) or (kind='inquiry' and n.inquiry_id=target))
  order by n.due_at,n.id limit 20 offset (page_no-1)*20) x;
 return jsonb_build_object('ok',true,'contract','crm.schedule.v1','enabled',coalesce((select enabled from crm_security.schedule_v1_settings where singleton),false),
  'writable',ctx->'writable','target_type',kind,'target_id',target,'token',token,'page',page_no,'per',20,'total',total,
  'actor_auth_uid',ctx->'actor_auth_uid','actor_user_id',ctx->'actor_user_id','owner_id',ctx->'owner_id','version',ctx->'parent'->'version','items',items,
  -- Only response_progress may change these four fields between contact and schedule.
  -- All task rows (including completed/cancelled) and every other parent field remain guarded.
  'inquiry_guard',case when kind='inquiry' then crm_security.schedule_v1_token(kind,target,
    (ctx->'parent')-array['status','first_response_at','responded_at','updated_at']) end,
  'response_state',case when kind='inquiry' then jsonb_build_object('status',ctx->'parent'->'status',
    'first_response_at',ctx->'parent'->'first_response_at','responded_at',ctx->'parent'->'responded_at','updated_at',ctx->'parent'->'updated_at') end);
end $$;

create or replace function public.crm_schedule_write_v1(p jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ctx jsonb; kind text; target uuid; request uuid; op text; action_id uuid; due date; basis text; why text;
 before_row public.next_actions%rowtype; after_row public.next_actions%rowtype; prior crm_security.schedule_v1_events%rowtype;
 at_time timestamptz:=clock_timestamp(); event uuid:=gen_random_uuid(); ack jsonb; projection record; newparent jsonb;
begin
 if jsonb_typeof(p) is distinct from 'object' or not p ?& array['request_id','target_type','target_id','expected_token','operation','due_on','date_basis']
  or exists(select 1 from jsonb_object_keys(p) k where k not in ('request_id','target_type','target_id','expected_token','operation','due_on','date_basis','reason','action_id','action_type','title')) then
  raise exception 'SCHEDULE_INVALID_INPUT' using errcode='22023'; end if;
 kind:=p->>'target_type'; target:=(p->>'target_id')::uuid; request:=(p->>'request_id')::uuid; op:=p->>'operation'; basis:=p->>'date_basis';
 if request is null or op is null or op not in ('add','reschedule') or basis is null or basis not in ('internal_plan','customer_agreed')
  or coalesce(p->>'expected_token','') !~ '^[a-f0-9]{32}$' or coalesce(p->>'due_on','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
  raise exception 'SCHEDULE_INVALID_INPUT' using errcode='22023'; end if;
 due:=(p->>'due_on')::date; why:=btrim(coalesce(p->>'reason',''));
 if op='add' then
  if p ? 'action_id' or coalesce(p->>'action_type','') not in ('전화','방문','후속접촉','기타')
   or jsonb_typeof(p->'title') is distinct from 'string' or length(btrim(p->>'title')) not between 1 and 500 then
   raise exception 'SCHEDULE_INVALID_INPUT' using errcode='22023'; end if;
 else
  if p ?| array['title','action_type'] or length(why) not between 1 and 500 then
   raise exception 'SCHEDULE_REASON_REQUIRED' using errcode='22023'; end if;
  action_id:=(p->>'action_id')::uuid;
  if action_id is null then raise exception 'SCHEDULE_INVALID_INPUT' using errcode='22023'; end if;
 end if;
 if length(why)>500 then raise exception 'SCHEDULE_INVALID_INPUT' using errcode='22023'; end if;
 ctx:=crm_security.schedule_v1_context(kind,target);
 perform pg_advisory_xact_lock(hashtextextended((ctx->>'actor_auth_uid')||request::text,173));
 select * into prior from crm_security.schedule_v1_events where actor_auth_uid=(ctx->>'actor_auth_uid')::uuid and request_id=request;
 if found then
  if prior.command is distinct from p or prior.actor_user_id is distinct from (ctx->>'actor_user_id')::uuid then
   raise exception 'REQUEST_ID_REUSE' using errcode='PT409'; end if;
  return prior.ack||jsonb_build_object('replayed',true);
 end if;
 if not coalesce((select enabled from crm_security.schedule_v1_settings where singleton),false) then
  raise exception 'SCHEDULE_RELEASE_DISABLED' using errcode='PT503'; end if;
 if not (ctx->>'writable')::boolean then raise exception 'SCHEDULE_STATE_CONFLICT' using errcode='PT409'; end if;
 if crm_security.schedule_v1_token(kind,target,ctx->'parent') is distinct from p->>'expected_token' then
  raise exception 'SCHEDULE_STALE' using errcode='PT409'; end if;
 -- Flat legacy projections without an actual task must be reconciled, not overwritten.
 if (ctx->'parent'->>'next_action_date') is not null and not exists(select 1 from public.next_actions n where n.status='open'
  and ((kind='deal' and n.deal_id=target) or (kind='inquiry' and n.inquiry_id=target))) then
  raise exception 'SCHEDULE_LEGACY_REVIEW_REQUIRED' using errcode='PT409'; end if;
 if due::text<>p->>'due_on' or due<(at_time at time zone 'Asia/Seoul')::date or due>(at_time at time zone 'Asia/Seoul')::date+3650 then
  raise exception 'SCHEDULE_INVALID_DATE' using errcode='22023'; end if;
 if op='add' then
  action_id:=gen_random_uuid();
  insert into public.next_actions(id,deal_id,inquiry_id,action_type,title,due_at,assignee_name,status,created_at,updated_at)
  values(action_id,case when kind='deal' then target end,case when kind='inquiry' then target end,p->>'action_type',btrim(p->>'title'),
   due::timestamp at time zone 'Asia/Seoul',ctx->>'owner_name','open',at_time,at_time) returning * into after_row;
 else
  select * into before_row from public.next_actions n where n.id=action_id
   and ((kind='deal' and n.deal_id=target) or (kind='inquiry' and n.inquiry_id=target)) for update;
  if not found or before_row.status<>'open' then raise exception 'SCHEDULE_ACTION_CONFLICT' using errcode='PT409'; end if;
  -- A routine internal reschedule cannot rewrite a customer promise.
  -- A future re-agreement path must provide linked evidence; this contract has none.
  if before_row.title ~ '^\s*고객\s*약속' or before_row.action_type like '%약속%'
   or (crm_security.schedule_v1_provenance(to_jsonb(before_row))->>'customer_agreed')::boolean then
   raise exception 'SCHEDULE_CUSTOMER_AGREEMENT_REQUIRED' using errcode='PT409'; end if;
  if (before_row.due_at at time zone 'Asia/Seoul')::date=due then raise exception 'SCHEDULE_DATE_UNCHANGED' using errcode='PT409'; end if;
  -- Preserve any explicit local time. Date-only additions use midnight KST, as existing inquiry writes do.
  update public.next_actions set due_at=(due+(before_row.due_at at time zone 'Asia/Seoul')::time) at time zone 'Asia/Seoul',updated_at=at_time
   where id=action_id returning * into after_row;
 end if;
 select n.title,(n.due_at at time zone 'Asia/Seoul')::date as due_on into projection from public.next_actions n where n.status='open'
  and ((kind='deal' and n.deal_id=target) or (kind='inquiry' and n.inquiry_id=target)) order by n.due_at,n.id limit 1;
 if kind='deal' then
  update public.deals set next_action=projection.title,next_action_date=projection.due_on,updated_at=at_time,version=version+1 where id=target;
  select to_jsonb(d) into newparent from public.deals d where id=target;
 else
  update public.inquiries set next_action_date=projection.due_on,updated_at=at_time where id=target;
  select to_jsonb(i) into newparent from public.inquiries i where id=target;
 end if;
 ack:=jsonb_build_object('ok',true,'contract','crm.schedule.v1','request_id',request,'target_type',kind,'target_id',target,
  'actor_auth_uid',ctx->'actor_auth_uid','actor_user_id',ctx->'actor_user_id','owner_id',ctx->'owner_id',
  'operation',op,'action_id',action_id,'action_status','open','due_on',due,'date_basis',basis,'event_id',event,
  'before',case when op='reschedule' then to_jsonb(before_row) else null end,'after',to_jsonb(after_row),
  'token',crm_security.schedule_v1_token(kind,target,newparent),'version',newparent->'version',
  'cancelled_action_ids','[]'::jsonb,'completed_action_ids','[]'::jsonb,'server_at',at_time,'replayed',false);
 insert into crm_security.schedule_v1_events(event_id,actor_auth_uid,actor_user_id,request_id,target_type,target_id,action_id,operation,date_basis,reason,before_data,after_data,command,ack,created_at)
 values(event,(ctx->>'actor_auth_uid')::uuid,(ctx->>'actor_user_id')::uuid,request,kind,target,action_id,op,basis,why,
  case when op='reschedule' then to_jsonb(before_row) else null end,to_jsonb(after_row),p,ack,at_time);
 return ack;
end $$;

create or replace function public.crm_schedule_receipt_v1(p jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ctx jsonb; prior crm_security.schedule_v1_events%rowtype; req uuid;
begin
 if jsonb_typeof(p) is distinct from 'object' or not p ?& array['target_type','target_id','request_id']
  or exists(select 1 from jsonb_object_keys(p) k where k not in ('target_type','target_id','request_id')) then
  raise exception 'SCHEDULE_INVALID_INPUT' using errcode='22023'; end if;
 req:=(p->>'request_id')::uuid;
 if req is null then raise exception 'SCHEDULE_INVALID_INPUT' using errcode='22023'; end if;
 ctx:=crm_security.schedule_v1_context(p->>'target_type',(p->>'target_id')::uuid);
 select * into prior from crm_security.schedule_v1_events where actor_auth_uid=(ctx->>'actor_auth_uid')::uuid
  and actor_user_id=(ctx->>'actor_user_id')::uuid and request_id=req and target_type=p->>'target_type' and target_id=(p->>'target_id')::uuid;
 return jsonb_build_object('ok',true,'contract','crm.schedule.v1','request_id',req,'found',found,'ack',case when found then prior.ack end);
end $$;

revoke all on function crm_security.schedule_v1_context(text,uuid),crm_security.schedule_v1_token(text,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.crm_schedule_list_v1(jsonb),public.crm_schedule_write_v1(jsonb),public.crm_schedule_receipt_v1(jsonb) from public,anon,authenticated;
grant execute on function public.crm_schedule_list_v1(jsonb),public.crm_schedule_write_v1(jsonb),public.crm_schedule_receipt_v1(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
