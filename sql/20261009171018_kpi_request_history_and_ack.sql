-- KPI history pages and atomic delivery receipts. Apply before frontend PR #542.
-- No customer status changes, no completion inferred, no external notifications.
begin;
create index if not exists kpi_actions_page_idx on public.kpi_actions(created_at desc,id desc);

create or replace function public.crm_kpi_action_list_v2(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare
 a record; n integer; c jsonb; upper_at timestamptz; upper_id uuid;
 after_at timestamptz; after_id uuid; page jsonb; last_row jsonb; more boolean;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 n:=least(greatest(coalesce((p->>'limit')::integer,200),1),200);
 c:=p->'cursor';
 if c is not null and c<>'null'::jsonb then
  if jsonb_typeof(c)<>'object' then raise exception 'invalid cursor' using errcode='22023'; end if;
  upper_at:=(c->>'upper_at')::timestamptz; upper_id:=(c->>'upper_id')::uuid;
  after_at:=(c->>'after_at')::timestamptz; after_id:=(c->>'after_id')::uuid;
  if upper_at is null or upper_id is null or after_at is null or after_id is null
     or (after_at,after_id)>(upper_at,upper_id) then
   raise exception 'invalid cursor' using errcode='22023';
  end if;
 else
  select k.created_at,k.id into upper_at,upper_id from public.kpi_actions k
   order by k.created_at desc,k.id desc limit 1;
 end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc),'[]'::jsonb) into page
 from (select k.* from public.kpi_actions k
  where (k.created_at,k.id)<=(upper_at,upper_id)
    and (after_at is null or (k.created_at,k.id)<(after_at,after_id))
  order by k.created_at desc,k.id desc limit n+1) x;
 more:=jsonb_array_length(page)>n;
 if more then page:=page-n; end if;
 last_row:=page->(jsonb_array_length(page)-1);
 return jsonb_build_object('ok',true,'contract_version',2,'actions',page,'has_more',more,
  'next_cursor',case when more then jsonb_build_object('upper_at',upper_at,'upper_id',upper_id,
    'after_at',last_row->>'created_at','after_id',last_row->>'id') else null end);
end $fn$;
revoke all on function public.crm_kpi_action_list_v2(jsonb) from public, anon;
grant execute on function public.crm_kpi_action_list_v2(jsonb) to authenticated;

-- A receipt confirms delivery only, never completion of the customer's task.
create table if not exists crm_security.kpi_request_receipts(
 actor_auth_uid uuid not null, request_id uuid not null, payload jsonb not null,
 ack jsonb not null, created_at timestamptz not null default now(),
 primary key(actor_auth_uid,request_id)
);
alter table crm_security.kpi_request_receipts enable row level security;
revoke all on table crm_security.kpi_request_receipts from public,anon,authenticated;

create or replace function public.crm_kpi_request_send_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 a record; rid uuid; owner_name text; owner_id uuid; owner_count integer;
 wk date; pk text; line text; ts jsonb; t jsonb; old_payload jsonb; ack jsonb;
 at_time timestamptz:=clock_timestamp(); cr crm_security.rep_manager_comments%rowtype;
 actions jsonb;
begin
 select * into a from crm_security.actor();
 if not found or a.permission_role not in ('admin','branch') then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 rid:=(p->>'request_id')::uuid;
 if rid is null then raise exception 'request id required' using errcode='22023'; end if;
 -- Serialize same-event retries. Different requests for one rep append under the row lock below.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||':'||rid::text,0));
 select r.payload,r.ack into old_payload,ack from crm_security.kpi_request_receipts r
  where r.actor_auth_uid=a.auth_uid and r.request_id=rid;
 if found then
  if old_payload<>p then raise exception 'request id payload mismatch' using errcode='22023'; end if;
  return ack;
 end if;
 owner_name:=nullif(btrim(p->>'rep_name'),''); wk:=(p->>'week_start')::date;
 pk:=p->>'promise_key'; line:=nullif(btrim(p->>'line'),''); ts:=p->'targets';
 if owner_name is null or length(owner_name)>40 or wk is null or extract(isodow from wk)<>1
   or wk>(at_time at time zone 'Asia/Seoul')::date+7 or pk is null
   or pk !~ '^(kpi:[1-8]|stage:[a-zA-Z0-9_:-]{1,60})$'
   or line is null or length(line)>1500 or jsonb_typeof(ts) is distinct from 'array' then
  raise exception 'invalid payload' using errcode='22023';
 end if;
 if jsonb_array_length(ts)<1 or jsonb_array_length(ts)>200 then raise exception 'invalid targets' using errcode='22023'; end if;
 for t in select value from jsonb_array_elements(ts) loop
  if jsonb_typeof(t)<>'object' or coalesce(t->>'target_type','') not in ('inquiry','deal','person')
    or coalesce(btrim(t->>'target_id'),'')='' or length(t->>'target_id')>80
    or coalesce(btrim(t->>'action'),'')='' or length(t->>'action')>200
    or length(coalesce(t->>'target_name',''))>200 or length(coalesce(t->>'note',''))>500 then
   raise exception 'invalid target' using errcode='22023';
  end if;
 end loop;
 if (select count(distinct (v->>'target_type',v->>'target_id')) from jsonb_array_elements(ts) v)<>jsonb_array_length(ts) then
  raise exception 'duplicate targets' using errcode='22023';
 end if;
 select count(*) into owner_count from public.users u where u.name=owner_name and u.active;
 if owner_count<>1 then raise exception '담당자 계정 확인 필요' using errcode='22023'; end if;
 select u.user_id into owner_id from public.users u where u.name=owner_name and u.active;
 insert into crm_security.rep_manager_comments as c
  (rep_user_id,week_start,comment,status,created_by_auth_uid,created_by_user_id,completed_at,created_at,updated_at)
 values(owner_id,wk,'· [KPI 요청] '||line,'open',a.auth_uid,a.user_id,null,at_time,at_time)
 on conflict(rep_user_id,week_start) do update set
  comment=case when coalesce(btrim(c.comment),'')='' then excluded.comment else c.comment||E'\n'||excluded.comment end,
  status='open',completed_at=null,created_by_auth_uid=a.auth_uid,created_by_user_id=a.user_id,updated_at=at_time
 returning * into cr;
 if length(cr.comment)>6000 then raise exception '관리자 한마디 저장 한도 초과' using errcode='22023'; end if;
 with inserted as (
  insert into public.kpi_actions(promise_key,action,target_type,target_id,target_name,note,actor,actor_name,created_at)
  select pk,v->>'action',v->>'target_type',v->>'target_id',v->>'target_name',v->>'note',a.user_id,a.display_name,at_time
  from jsonb_array_elements(ts) v returning *
 ) select jsonb_agg(to_jsonb(i) order by i.id) into actions from inserted i;
 ack:=jsonb_build_object('ok',true,'request_id',rid,'actions',actions,'comment',jsonb_build_object(
  'rep_name',owner_name,'week_start',wk,'comment',cr.comment,'status',cr.status,'created_by',a.display_name,'updated_at',cr.updated_at));
 insert into crm_security.kpi_request_receipts(actor_auth_uid,request_id,payload,ack) values(a.auth_uid,rid,p,ack);
 return ack;
end $fn$;
revoke all on function public.crm_kpi_request_send_v1(jsonb) from public, anon;
grant execute on function public.crm_kpi_request_send_v1(jsonb) to authenticated;
commit;
