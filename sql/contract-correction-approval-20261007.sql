-- B9: approved construction-contract balance correction. No historical rewrite.
begin;
alter table public.crm_approval_requests drop constraint crm_approval_requests_type_check;
alter table public.crm_approval_requests add constraint crm_approval_requests_type_check check(type in
 ('owner_change','dup_lead','strategic_win','special_incentive','result_fix','transfer','contract_amount'));
create unique index if not exists contract_amount_pending on public.crm_approval_requests(deal_id)
 where type='contract_amount' and status='pending';
create table crm_security.contract_correction_requests(
 actor_auth_uid uuid not null,request_id uuid not null,approval_id bigint not null unique,
 payload jsonb not null,ledger_request_id uuid not null default gen_random_uuid(),applied jsonb,
 primary key(actor_auth_uid,request_id)
);
alter table crm_security.contract_correction_requests enable row level security;
revoke all on crm_security.contract_correction_requests from public,anon,authenticated,service_role;

create function public.crm_contract_correction_preview_v1(p jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a record;d uuid;h crm_security.contract_sales%rowtype;e crm_security.contract_sales_events%rowtype;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501';end if;
 if jsonb_typeof(p) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p) k where k<>'deal_id') then raise exception 'invalid payload' using errcode='22023';end if;
 d:=(p->>'deal_id')::uuid;
 if d is null or not crm_security.can_deal(d,true) then raise exception 'forbidden' using errcode='42501';end if;
 select * into h from crm_security.contract_sales where deal_id=d;
 if not found then raise exception 'verified contract required' using errcode='22023';end if;
 select * into e from crm_security.contract_sales_events where deal_id=d and sequence=h.version;
 if not found then raise exception 'incomplete contract history' using errcode='PT409';end if;
 return jsonb_build_object('ok',true,'deal_id',d,'source_event_id',e.event_id,'expected_version',h.version,
  'balance',h.balance,'contract_amount',h.contract_amount,'contract_date',h.contract_date,
  'sales_owner',h.sales_owner,'last_effective_date',e.effective_date,'cancelled',h.cancelled,
  'previous_balance',case when e.kind='amended' then h.balance-e.amount_delta else null end);
end $$;
revoke all on function public.crm_contract_correction_preview_v1(jsonb) from public,anon,service_role;
grant execute on function public.crm_contract_correction_preview_v1(jsonb) to authenticated;

create function public.crm_contract_correction_request_v1(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a record;d uuid;req uuid;src uuid;v integer;target bigint;dt date;why text;canonical jsonb;
 h crm_security.contract_sales%rowtype;e crm_security.contract_sales_events%rowtype;
 receipt crm_security.contract_correction_requests%rowtype;q public.crm_approval_requests%rowtype;
begin
 select * into a from crm_security.actor();if not found then raise exception 'forbidden' using errcode='42501';end if;
 if jsonb_typeof(p) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p) k where k not in
 ('deal_id','request_id','source_event_id','expected_version','target_balance','effective_date','reason')) then raise exception 'invalid payload' using errcode='22023';end if;
 if jsonb_typeof(p->'expected_version') is distinct from 'number' or coalesce(p->>'expected_version','')!~'^[1-9][0-9]*$'
 or jsonb_typeof(p->'target_balance') is distinct from 'number' or coalesce(p->>'target_balance','')!~'^[1-9][0-9]*$'
 or coalesce(p->>'effective_date','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'explicit version amount and date required' using errcode='22023';end if;
 d:=(p->>'deal_id')::uuid;req:=(p->>'request_id')::uuid;src:=(p->>'source_event_id')::uuid;
 v:=(p->>'expected_version')::integer;target:=(p->>'target_balance')::bigint;dt:=(p->>'effective_date')::date;why:=btrim(p->>'reason');
 if d is null or req is null or src is null or target>9007199254740991 or why is null or length(why) not between 1 and 300
 or dt>(now() at time zone 'Asia/Seoul')::date then raise exception 'invalid correction' using errcode='22023';end if;
 perform 1 from public.users where auth_uid=a.auth_uid for share;
 perform 1 from crm_security.access_review where reviewed_auth_uid=a.auth_uid for share;
 if not crm_security.can_deal(d,true) then raise exception 'forbidden' using errcode='42501';end if;
 canonical:=p-'request_id';
 perform pg_advisory_xact_lock(hashtextextended('contract-correction:'||a.auth_uid::text||req::text,0));
 select * into receipt from crm_security.contract_correction_requests where actor_auth_uid=a.auth_uid and request_id=req;
 if found then
  if receipt.payload is distinct from canonical then raise exception 'REQUEST_ID_REUSE' using errcode='PT409';end if;
  select * into q from public.crm_approval_requests where id=receipt.approval_id;
  return jsonb_build_object('ok',true,'operation','crm_contract_correction_request_v1','request_id',req,'request',to_jsonb(q),'replayed',true);
 end if;
 perform 1 from public.deals where id=d for update;
 if not found then raise exception 'deal not found' using errcode='22023';end if;
 select * into h from crm_security.contract_sales where deal_id=d for update;
 if not found or h.cancelled then raise exception 'verified active contract required' using errcode='22023';end if;
 select * into e from crm_security.contract_sales_events where deal_id=d and sequence=h.version;
 if not found or h.version<>v or e.event_id<>src then raise exception 'CONTRACT_VERSION_CONFLICT' using errcode='PT409';end if;
 if dt<e.effective_date or target=h.balance then raise exception 'invalid correction date or unchanged amount' using errcode='22023';end if;
 insert into public.crm_approval_requests(type,deal_id,title,reason,payload,requested_by,requested_by_name)
 values('contract_amount',d::text,'계약금액 정정: '||h.balance::text||'원 → '||target::text||'원 · 적용일 '||dt::text,why,
  canonical||jsonb_build_object('before_balance',h.balance,'amount_delta',target-h.balance),a.user_id,a.display_name) returning * into q;
 insert into crm_security.contract_correction_requests(actor_auth_uid,request_id,approval_id,payload) values(a.auth_uid,req,q.id,canonical);
 insert into public.crm_approval_events(request_id,action,after,actor,actor_name) values(q.id,'request',to_jsonb(q),a.user_id,a.display_name);
 return jsonb_build_object('ok',true,'operation','crm_contract_correction_request_v1','request_id',req,'request',to_jsonb(q));
end $$;
revoke all on function public.crm_contract_correction_request_v1(jsonb) from public,anon,service_role;
grant execute on function public.crm_contract_correction_request_v1(jsonb) to authenticated;

-- Existing approval decision RPC supplies approver/self-approval checks and audit.
-- This trigger adds the ledger effect to the SAME transaction; failure keeps pending.
create function crm_security.apply_contract_correction() returns trigger
language plpgsql security definer set search_path='' as $$
declare a record;r crm_security.contract_correction_requests%rowtype;h crm_security.contract_sales%rowtype;
 e crm_security.contract_sales_events%rowtype;ack jsonb;d uuid;target bigint;
begin
 if old.type<>'contract_amount' and new.type<>'contract_amount' then return new;end if;
 if old.type is distinct from new.type or old.payload is distinct from new.payload or old.deal_id is distinct from new.deal_id
 or old.reason is distinct from new.reason or old.requested_by is distinct from new.requested_by then raise exception 'immutable correction request';end if;
 if new.status is not distinct from old.status then return new;end if;
 if old.status<>'pending' then raise exception 'correction already decided' using errcode='PT409';end if;
 if new.status<>'approved' then return new;end if;
 select * into a from crm_security.actor();
 if not found or crm_security.approval_approver(a.user_id) is not true or a.user_id is not distinct from old.requested_by
 or a.user_id is distinct from new.decided_by then raise exception 'forbidden' using errcode='42501';end if;
 select * into r from crm_security.contract_correction_requests where approval_id=old.id for update;
 if not found or r.applied is not null then raise exception 'correction receipt missing or applied' using errcode='PT409';end if;
 d:=(r.payload->>'deal_id')::uuid;target:=(r.payload->>'target_balance')::bigint;
 if not crm_security.can_deal(d,true) then raise exception 'forbidden' using errcode='42501';end if;
 perform 1 from public.deals where id=d for update;
 if not found then raise exception 'deal not found' using errcode='PT409';end if;
 select * into h from crm_security.contract_sales where deal_id=d for update;
 if not found or h.cancelled or h.version<>(r.payload->>'expected_version')::integer then raise exception 'CONTRACT_VERSION_CONFLICT' using errcode='PT409';end if;
 select * into e from crm_security.contract_sales_events where deal_id=d and sequence=h.version;
 if not found or e.event_id<>(r.payload->>'source_event_id')::uuid then raise exception 'CONTRACT_VERSION_CONFLICT' using errcode='PT409';end if;
 ack:=public.crm_contract_sales_write_v1(jsonb_build_object('deal_id',d,'request_id',r.ledger_request_id,'kind','amended',
  'effective_date',r.payload->>'effective_date','amount_delta',target-h.balance,'expected_version',h.version,
  'reason','승인 요청 #'||old.id::text||': '||(r.payload->>'reason')));
 if ack->>'ok' is distinct from 'true' or nullif(ack->>'event_id','') is null then raise exception 'ledger acknowledgement missing';end if;
 update crm_security.contract_correction_requests set applied=ack where approval_id=old.id;
 return new;
end $$;
revoke all on function crm_security.apply_contract_correction() from public,anon,authenticated,service_role;
create trigger apply_contract_correction after update on public.crm_approval_requests
for each row execute function crm_security.apply_contract_correction();
notify pgrst,'reload schema';
commit;
