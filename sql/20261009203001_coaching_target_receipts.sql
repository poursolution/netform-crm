-- Future coaching requests only. Historical recipients cannot be inferred from today's owner.
begin;
alter table public.kpi_actions
 add column if not exists recipient_user_id uuid,
 add column if not exists recipient_name text,
 add column if not exists request_id uuid,
 add column if not exists request_group_id uuid,
 add column if not exists request_week date,
 add column if not exists batch_index integer;
create index if not exists kpi_actions_request_group_idx
 on public.kpi_actions(actor,request_group_id,batch_index) where request_group_id is not null;
create table if not exists crm_security.coaching_request_groups(
 actor_auth_uid uuid not null, group_id uuid not null, snapshot jsonb not null,
 created_at timestamptz not null default now(), primary key(actor_auth_uid,group_id)
);
alter table crm_security.coaching_request_groups enable row level security;
revoke all on table crm_security.coaching_request_groups from public,anon,authenticated;

create or replace function public.crm_kpi_request_send_v2(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
<<body>>
declare
 a record; rid uuid; gid uuid; recipient uuid; rep text; wk date; idx integer; total integer;
 snap jsonb; prior jsonb; ack jsonb; ts jsonb; full_targets jsonb; expected jsonb; t jsonb;
 target_uuid uuid; current_owner uuid; current_name text;
begin
 select * into a from crm_security.actor();
 if not found or a.permission_role not in ('admin','branch') then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 rid:=(p->>'request_id')::uuid; gid:=(p->>'group_id')::uuid;
 recipient:=(p->>'recipient_user_id')::uuid; rep:=p->>'rep_name'; wk:=(p->>'week_start')::date;
 idx:=(p->>'batch_index')::integer; snap:=p->'snapshot'; ts:=p->'targets';
 if rid is null or gid is null or recipient is null or idx is null or idx<0
  or jsonb_typeof(snap) is distinct from 'object' or jsonb_typeof(ts) is distinct from 'array' then
  raise exception 'invalid coaching request' using errcode='22023'; end if;
 -- Same event retries remain readable even after the target is reassigned.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||':'||rid::text,0));
 select r.payload,r.ack into prior,ack from crm_security.kpi_request_receipts r
  where r.actor_auth_uid=a.auth_uid and r.request_id=rid;
 if found then
  if prior<>p or ack->>'contract_version' is distinct from '2' then raise exception 'request id payload mismatch' using errcode='22023'; end if;
  return ack;
 end if;
 if not exists(select 1 from public.users u where u.user_id=recipient and u.active and u.name=rep)
  or (select count(*) from public.users u where u.active and u.name=rep)<>1 then
  raise exception '담당자 계정 확인 필요' using errcode='22023'; end if;
 full_targets:=snap->'targets';
 if snap->>'recipient_user_id' is distinct from recipient::text or snap->>'rep_name' is distinct from rep
  or snap->>'week_start' is distinct from wk::text or snap->>'promise_key' is distinct from p->>'promise_key'
  or snap->>'rule_version' is distinct from 'coaching-targets-v1'
  or jsonb_typeof(full_targets) is distinct from 'array' then raise exception 'invalid snapshot' using errcode='22023'; end if;
 total:=jsonb_array_length(full_targets);
 if total<1 or total>5000 or idx>=(total+199)/200 then raise exception 'invalid batch' using errcode='22023'; end if;
 if (select count(distinct (v->>'target_type',v->>'target_id')) from jsonb_array_elements(full_targets) v)<>total then
  raise exception 'duplicate targets' using errcode='22023'; end if;
 for t in select value from jsonb_array_elements(full_targets) loop
  if jsonb_typeof(t) is distinct from 'object' or coalesce(t->>'target_type','') not in ('deal','inquiry')
   or coalesce(t->>'target_id','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
  raise exception 'invalid target identity' using errcode='22023'; end if;
  if t->>'target_id' is distinct from ((t->>'target_id')::uuid)::text then
   raise exception 'noncanonical target identity' using errcode='22023'; end if;
 end loop;
 select jsonb_agg(v order by ord) into expected from jsonb_array_elements(full_targets) with ordinality x(v,ord)
  where ord>idx*200 and ord<=idx*200+200;
 if ts is distinct from expected then raise exception 'batch snapshot mismatch' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('coaching-group:'||a.auth_uid::text||':'||gid::text,0));
 insert into crm_security.coaching_request_groups(actor_auth_uid,group_id,snapshot) values(a.auth_uid,gid,snap)
  on conflict do nothing;
 select g.snapshot into prior from crm_security.coaching_request_groups g where g.actor_auth_uid=a.auth_uid and g.group_id=gid;
 if prior<>snap then raise exception 'group snapshot mismatch' using errcode='22023'; end if;
 -- Prevent a new request id from duplicating an already accepted batch.
 if exists(select 1 from public.kpi_actions k where k.actor=a.user_id and k.request_group_id=gid and k.batch_index=idx) then
  raise exception 'batch already accepted; retry original request id' using errcode='23505'; end if;
 -- Stable lock order: ownership cannot change between validation and this batch's commit.
 for t in select value from jsonb_array_elements(ts) order by value->>'target_type',value->>'target_id' loop
  target_uuid:=(t->>'target_id')::uuid; current_owner:=null; current_name:=null;
  if t->>'target_type'='deal' then
   select d.owner_id,d.assignee_name into current_owner,current_name from public.deals d where d.id=target_uuid for share;
  else
   select q.assigned_to,q.assignee_name into current_owner,current_name from public.inquiries q where q.id=target_uuid for share;
  end if;
  if not found or current_owner is distinct from recipient or current_name is distinct from rep then
   raise exception '담당자 변경 또는 대상 확인 필요' using errcode='40001'; end if;
 end loop;
 -- Reuse the existing atomic comment + action + receipt writer and its authorization/limits.
 ack:=public.crm_kpi_request_send_v1(p);
 update public.kpi_actions k set recipient_user_id=recipient,recipient_name=rep,request_id=rid,
  request_group_id=gid,request_week=wk,batch_index=idx
  where k.id in(select (v->>'id')::uuid from jsonb_array_elements(ack->'actions') v);
 select jsonb_agg(to_jsonb(k) order by k.id) into ts from public.kpi_actions k
  where k.id in(select (v->>'id')::uuid from jsonb_array_elements(ack->'actions') v);
 ack:=ack||jsonb_build_object('contract_version',2,'group_id',gid,'batch_index',idx,
  'recipient_user_id',recipient,'target_count',total,'actions',ts);
 update crm_security.kpi_request_receipts r set ack=body.ack
  where r.actor_auth_uid=a.auth_uid and r.request_id=rid;
 return ack;
end $fn$;
revoke all on function public.crm_kpi_request_send_v2(jsonb) from public,anon,service_role;
grant execute on function public.crm_kpi_request_send_v2(jsonb) to authenticated;
commit;
