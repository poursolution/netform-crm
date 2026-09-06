-- LOCAL/STAGING ONLY. Explicit UUID mapping reviewed by a human; never name matching.
-- Supply pg_temp.crm_uuid_reviewed_mapping(target_table text,target_id uuid,user_id uuid,evidence text).
-- NULL/unreviewed records stay unreadable and in manual_review.
begin;
do $$
declare r record; member public.crm_users; current_owner uuid; current_team uuid; affected bigint;
begin
 if to_regclass('pg_temp.crm_uuid_reviewed_mapping') is null then raise exception 'Reviewed UUID mapping required';end if;
 if exists(select target_table,target_id from pg_temp.crm_uuid_reviewed_mapping group by target_table,target_id having count(*)>1) then
  raise exception 'Duplicate mapping target';end if;
 for r in select * from pg_temp.crm_uuid_reviewed_mapping loop
  if r.target_table not in ('deals','inquiries') or r.target_table is null or r.target_id is null or
     r.evidence is null or length(btrim(r.evidence))<10 then raise exception 'Explicit target and review evidence required';end if;
  select * into strict member from public.crm_users where user_id=r.user_id and active;
  if r.target_table='deals' and member.role not in ('rep','branch_rep','manager','admin') then raise exception 'Consultation cannot own a sales deal';end if;
  -- Lock record; never overwrite a previously assigned, different immutable owner.
  execute format('select assignee_user_id,crm_team_id from public.%I where id=$1 for update',r.target_table) into strict current_owner,current_team using r.target_id;
  if not exists(select 1 from crm_private.identity_review where target_table=r.target_table and target_id=r.target_id) then raise exception 'Target missing from manual review';end if;
  if current_owner is not null and (current_owner<>r.user_id or current_team<>member.team_id) then raise exception 'Ownership changed since review';end if;
  execute format('update public.%I set assignee_user_id=$1,crm_team_id=$2 where id=$3',r.target_table) using r.user_id,member.team_id,r.target_id;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'Expected one mapping target';end if;
  update crm_private.identity_review set status='resolved',resolved_user_id=r.user_id,evidence=r.evidence,reviewed_at=clock_timestamp()
   where target_table=r.target_table and target_id=r.target_id;
 end loop;
end $$;
commit;
