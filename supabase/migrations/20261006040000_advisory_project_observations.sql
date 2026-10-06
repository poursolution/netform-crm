-- Basic project observations must survive even when contracts is an empty array.
-- Preserve the existing immutable contract snapshot and operational stage rules.
create table crm_security.advisory_project_snapshots (
 project_id text primary key references crm_security.advisory_snapshots(project_id),
 revision numeric(25,0) not null,
 snapshot jsonb not null,
 received_at timestamptz not null default now()
);
create table crm_security.advisory_project_history (
 project_id text not null references crm_security.advisory_snapshots(project_id),
 revision numeric(25,0) not null,
 snapshot jsonb not null,
 received_at timestamptz not null default now(),
 primary key(project_id,revision)
);
alter table crm_security.advisory_project_snapshots enable row level security;
alter table crm_security.advisory_project_history enable row level security;
revoke all on crm_security.advisory_project_snapshots,crm_security.advisory_project_history from public,anon,authenticated;

create function public.crm_advisory_ingest_v3(
 p_project_id text,p_revision text,p_snapshot jsonb,p_operations jsonb,p_project jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare ack jsonb; rev numeric(25,0); existing jsonb; current_rev numeric(25,0);
begin
 if jsonb_typeof(p_project) is distinct from 'object'
   or p_project->>'schema_version' is distinct from '1'
   or p_project->>'source_project_id' is distinct from p_project_id
   or p_project->'operations' is distinct from p_operations then
   raise exception 'INVALID_PROJECT_OBSERVATION';
 end if;
 -- v2 validates revision/identity and holds the existing per-project transaction lock.
 -- Any later conflict rolls back both the observation and v2's writes atomically.
 ack:=public.crm_advisory_ingest_v2(p_project_id,p_revision,p_snapshot,p_operations);
 rev:=p_revision::numeric;
 select greatest(s.revision,o.revision,b.revision) into current_rev
 from crm_security.advisory_snapshots s
 left join crm_security.advisory_operations o using(project_id)
 left join crm_security.advisory_project_snapshots b using(project_id)
 where s.project_id=p_project_id;
 if current_rev>rev then
   return ack||jsonb_build_object('project_result','STALE_REVISION');
 end if;
 select snapshot into existing from crm_security.advisory_project_history
 where project_id=p_project_id and revision=rev;
 if found then
   if existing is distinct from p_project then raise exception 'PROJECT_REVISION_CONFLICT'; end if;
   return ack||jsonb_build_object('project_result','ALREADY_CURRENT');
 end if;
 insert into crm_security.advisory_project_history(project_id,revision,snapshot)
 values(p_project_id,rev,p_project);
 insert into crm_security.advisory_project_snapshots(project_id,revision,snapshot)
 values(p_project_id,rev,p_project)
 on conflict(project_id) do update set revision=excluded.revision,
 snapshot=crm_security.advisory_project_snapshots.snapshot||excluded.snapshot,received_at=now()
 where excluded.revision>crm_security.advisory_project_snapshots.revision;
 return ack||jsonb_build_object('project_result','STORED');
end $$;
revoke all on function public.crm_advisory_ingest_v3(text,text,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.crm_advisory_ingest_v3(text,text,jsonb,jsonb,jsonb) to service_role;
