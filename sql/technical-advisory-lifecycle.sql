-- Separate operational revisions preserve the immutable contract snapshot history.
create table if not exists crm_security.advisory_operations (
 project_id text primary key references crm_security.advisory_snapshots(project_id),
 revision numeric(25,0) not null, snapshot jsonb not null,
 last_stage text, last_deal_id uuid, result text not null, received_at timestamptz not null default now()
);
create table if not exists crm_security.advisory_stage_events (
 id bigint generated always as identity primary key,
 project_id text not null, revision numeric(25,0) not null,
 deal_id uuid not null, previous_stage text, next_stage text not null,
 evidence jsonb not null, created_at timestamptz not null default now()
);
alter table crm_security.advisory_operations enable row level security;
alter table crm_security.advisory_stage_events enable row level security;
revoke all on crm_security.advisory_operations,crm_security.advisory_stage_events from public,anon,authenticated;

create or replace function public.crm_advisory_ingest_v2(p_project_id text,p_revision text,p_snapshot jsonb,p_operations jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ack jsonb; old crm_security.advisory_operations%rowtype; d public.deals%rowtype;
 target text; why text; deal uuid; today date := (now() at time zone 'Asia/Seoul')::date;
 finished date; started date; progress numeric; rev numeric(25,0);
begin
 ack:=public.crm_advisory_ingest_v1(p_project_id,p_revision,p_snapshot);
 if p_operations is null then return ack; end if;
 if jsonb_typeof(p_operations) is distinct from 'object' or coalesce(p_operations->>'schema_version','') not in ('1','2') then raise exception 'INVALID_OPERATIONS'; end if;
 rev:=p_revision::numeric;
 select * into old from crm_security.advisory_operations where project_id=p_project_id for update;
 if old.revision>rev then return ack||jsonb_build_object('operational_result','STALE_REVISION'); end if;
 if old.revision=rev and old.snapshot is distinct from p_operations and not (old.snapshot->>'schema_version'='1' and p_operations->>'schema_version'='2') then raise exception 'OPERATIONAL_REVISION_CONFLICT'; end if;
 -- Contract ingestion holds the per-project advisory transaction lock.
 started:=nullif(p_operations->>'start_date','')::date;
 finished:=nullif(p_operations->>'completion_date','')::date;
 progress:=(p_operations->>'progress_rate')::numeric;
 if p_operations->>'source_status' in ('termination_sent','contract_terminated','archived') then why:='SOURCE_REVIEW_REQUIRED';
 elsif p_operations->>'completed'='true' then
  if p_operations->>'schema_version'<>'2' or finished is null or finished>today then why:='COMPLETION_FACTS_REQUIRED'; else target:='won'; end if;
 elsif progress=100 then why:='COMPLETION_FACTS_REQUIRED';
 elsif progress>0 and progress<100 then target:='construction';
 elsif p_operations->>'source_status' in ('vendor_contract_draft_sent','owner_contract_received','contract_ready','contract_writing','consulting_contract_sent','contract_sent','signing_in_progress','sent_to_modusign','consulting_contract_completed','handover_ready','contract_completed','signed_completed') then target:='contract';
 else why:='INSUFFICIENT_EVIDENCE'; end if;
 select deal_id into deal from crm_security.advisory_deal_links where project_id=p_project_id;
 if deal is null then why:='EXACT_DEAL_LINK_REQUIRED';
 else
  select * into d from public.deals where id=deal for update;
  if not found then why:='DEAL_MISSING';
  elsif exists(select 1 from crm_security.advisory_deal_links where deal_id=deal and project_id<>p_project_id) then why:='DUPLICATE_DEAL_LINK';
  elsif old.last_deal_id is not null and old.last_deal_id<>deal then why:='LINK_CHANGED_REVIEW';
  elsif why is not null then null;
  elsif old.last_stage is not null and d.stage_code is distinct from old.last_stage and d.stage_code is distinct from target then why:='MANUAL_STAGE_CHANGE_REVIEW';
  elsif d.stage_code in ('lost','badfit','nocontact') then why:='CLOSED_DEAL_REVIEW';
  elsif target is not null and d.stage_code=target then why:='ALREADY_CURRENT';
  elsif array_position(array['contract','construction','completion','won'],d.stage_code)>array_position(array['contract','construction','completion','won'],target) then why:='REGRESSION_REVIEW_REQUIRED';
  end if;
 end if;
 if why is null and target is not null then
  update public.deals set stage_code=target,
   stage_group=case when target='won' then 'closed' else 'exec' end,
   stage_raw=case target when 'won' then '수주' when 'contract' then '계약단계' else '시공단계' end,
   lifecycle_status=case when target='won' then 'closed' else 'active' end,
   outcome=case when target='won' then 'won' else null end,
   completion_date=case when target='won' then finished else completion_date end,
   closed_at=case when target='won' then coalesce(closed_at,finished::timestamp at time zone 'Asia/Seoul') else closed_at end,
   stage_entered_at=now(),version=coalesce(version,0)+1
  where id=deal;
  insert into crm_security.advisory_stage_events(project_id,revision,deal_id,previous_stage,next_stage,evidence)
  values(p_project_id,rev,deal,d.stage_code,target,p_operations);
  why:='APPLIED';
 end if;
 insert into crm_security.advisory_operations(project_id,revision,snapshot,last_stage,last_deal_id,result)
 values(p_project_id,rev,p_operations,case when why in ('APPLIED','ALREADY_CURRENT') then target else old.last_stage end,
 case when why in ('APPLIED','ALREADY_CURRENT') then deal else old.last_deal_id end,why)
 on conflict(project_id) do update set revision=excluded.revision,snapshot=excluded.snapshot,
 last_stage=excluded.last_stage,last_deal_id=excluded.last_deal_id,result=excluded.result,received_at=now();
 return ack||jsonb_build_object('operational_result',why,'target_stage',target);
end $$;
revoke all on function public.crm_advisory_ingest_v2(text,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.crm_advisory_ingest_v2(text,text,jsonb,jsonb) to service_role;
