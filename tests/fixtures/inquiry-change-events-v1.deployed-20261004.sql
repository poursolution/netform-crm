-- Event-driven inquiry updates. Only the existing trusted server credential may call these RPCs.
create table if not exists private.inquiry_change_events (
  event_id text primary key,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','applied','review')),
  inquiry_id uuid,
  reason text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  next_retry_at timestamptz not null default now()
);
alter table private.inquiry_change_events enable row level security;
revoke all on private.inquiry_change_events from public,anon,authenticated;
grant select,insert,update on private.inquiry_change_events to service_role;

create or replace function public.crm_inquiry_change_apply_v1(p_event_id text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  e private.inquiry_change_events%rowtype; p jsonb; i public.inquiries%rowtype;
  kind text; source_at timestamptz; row_no integer; matches integer; target_id uuid;
  phone_value text; brand_value text; result jsonb; reason_value text;
  response_value text; status_value text; response_done boolean; old_values jsonb;
  new_date date; owner_name text;
begin
  if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),
    nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';
  end if;
  select * into e from private.inquiry_change_events where event_id=p_event_id for update;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if e.status <> 'pending' then
    return jsonb_build_object('ok',e.status='applied','status',e.status,'reason',e.reason,'replayed',true,'inquiry_id',e.inquiry_id);
  end if;
  p:=e.payload; kind:=p->>'kind';
  source_at:=(p->>'occurred_at')::timestamptz;
  row_no:=nullif(p->>'sheet_row','')::integer;
  phone_value:=regexp_replace(p->>'phone','[^0-9]','','g'); brand_value:=btrim(p->>'brand');
  if row_no is not null then
    perform pg_advisory_xact_lock(hashtextextended('crm_inquiry_sheet:'||row_no::text,0));
  end if;
  select count(*), min(q.id::text)::uuid into matches,target_id from public.inquiries q
    where (row_no is null or q.sheet_row=row_no)
      and q.brand=brand_value and regexp_replace(q.phone,'[^0-9]','','g')=phone_value;
  -- A new webhook inquiry may not have its sheet row yet. Match only a unique
  -- recent, unconverted row; never attach an occupied or conflicting sheet row.
  if matches=0 and kind='assign' and row_no is not null
     and not exists(select 1 from public.inquiries where sheet_row=row_no) then
    select count(*),min(q.id::text)::uuid into matches,target_id from public.inquiries q
      where q.sheet_row is null and q.deal_id is null and q.opportunity_id is null and q.qualified_at is null
        and q.brand=brand_value and regexp_replace(q.phone,'[^0-9]','','g')=phone_value
        and coalesce(q.received_at,q.created_at)>=source_at-interval '24 hours'
        and coalesce(q.received_at,q.created_at)<=source_at;
  end if;
  if matches=0 then reason_value:='INQUIRY_NOT_FOUND';
  elsif matches>1 then reason_value:='IDENTITY_AMBIGUOUS';
  else
    select * into i from public.inquiries where id=target_id for update;
    if i.updated_at > source_at then reason_value:='CRM_CHANGED_REVIEW';
    elsif i.deal_id is not null or i.opportunity_id is not null or i.qualified_at is not null then reason_value:='CONVERTED_REVIEW';
    elsif coalesce(i.status,'') in ('수주','실주','배드핏','종결','종료','영업전환') then reason_value:='CLOSED_REVIEW';
    else
      old_values:=jsonb_build_object('status',i.status,'assignee_name',i.assignee_name,'assigned_to',i.assigned_to,
        'response_content',i.raw->>'응대내용','next_action_date',i.next_action_date,'close_reason',i.close_reason);
      begin
        if kind in ('assign','reassign') then
          if kind='reassign' and nullif(btrim(p->>'expected_from'),'') is null then
            raise exception 'EXPECTED_OWNER_REQUIRED';
          end if;
          result:=public.crm_inquiry_assignment_sync_v1(jsonb_build_object(
            'inquiry_id',i.id,'sheet_row',row_no,'phone',p->>'phone','brand',brand_value,
            'to',p->>'to','operation',kind,'expected_from',p->>'expected_from'));
        elsif kind='response' then
          status_value:=p->>'status'; response_value:=btrim(p->>'response_content');
          new_date:=nullif(p->>'next_action_date','')::date;
          -- Append the new response to the existing CRM history; never replace earlier notes.
          response_done:=status_value in ('전화응대 완료','현장방문예정','견적서 발송예정','보류','배드핏','수주','실주','종결','종료')
            and coalesce(response_value,'')<>'';
          update public.inquiries set status=status_value,
            responded_at=case when response_done then source_at else responded_at end,
            first_response_at=case when response_done then coalesce(first_response_at,source_at) else first_response_at end,
            next_action_date=case when p ? 'next_action_date' then new_date else next_action_date end,
            close_reason=case when p ? 'close_reason' then nullif(p->>'close_reason','') else close_reason end,
            raw=coalesce(raw,'{}'::jsonb)||jsonb_build_object('진행상태',status_value,
              '응대내용',concat_ws(E'\n',nullif(raw->>'응대내용',''),
                '['||to_char(source_at at time zone 'Asia/Seoul','YYYY-MM-DD HH24:MI:SS')||'] '||response_value),
              '응대완료일시',case when response_done then source_at::text else raw->>'응대완료일시' end)
              ||case when p ? 'close_reason' then jsonb_build_object('종료사유',p->>'close_reason') else '{}'::jsonb end,
            updated_at=clock_timestamp()
            where id=i.id;
          result:=jsonb_build_object('ok',true,'reason','RESPONSE_SYNCED');
        end if;
        update public.inquiries set raw=coalesce(raw,'{}'::jsonb)||jsonb_build_object('external_change_history',
          coalesce(raw->'external_change_history','[]'::jsonb)||jsonb_build_array(jsonb_build_object(
            'event_id',p_event_id,'kind',kind,'source_at',source_at,'applied_at',clock_timestamp(),
            'before',old_values,'after',p-'event_id')))
          where id=i.id;
        update private.inquiry_change_events set status='applied',reason=coalesce(result->>'reason','SYNCED'),
          inquiry_id=i.id,processed_at=clock_timestamp(),attempts=attempts+1 where event_id=p_event_id;
        return jsonb_build_object('ok',true,'status','applied','inquiry_id',i.id,'reason',result->>'reason');
      exception when others then
        reason_value:=case when sqlerrm like 'assignment_sync_rejected:%' or sqlerrm='EXPECTED_OWNER_REQUIRED'
          then sqlerrm else 'APPLY_FAILED:'||sqlstate end;
      end;
    end if;
  end if;
  update private.inquiry_change_events set
    status=case when (reason_value='INQUIRY_NOT_FOUND' or reason_value like 'APPLY_FAILED:%') and attempts<7 then 'pending' else 'review' end,
    reason=reason_value,inquiry_id=i.id,attempts=attempts+1,
    next_retry_at=clock_timestamp()+interval '15 minutes',processed_at=clock_timestamp()
    where event_id=p_event_id returning * into e;
  return jsonb_build_object('ok',false,'status',e.status,'reason',e.reason,'inquiry_id',e.inquiry_id);
end;
$$;

create or replace function public.crm_inquiry_change_enqueue_v1(p_event jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare existing_payload jsonb; source_at timestamptz;
begin
  if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),
    nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';
  end if;
  if jsonb_typeof(p_event) is distinct from 'object' or length(coalesce(p_event->>'event_id','')) not between 1 and 200
    or coalesce(p_event->>'kind','') not in ('assign','reassign','response')
    or length(regexp_replace(coalesce(p_event->>'phone',''),'[^0-9]','','g'))<9
    or nullif(btrim(p_event->>'brand'),'') is null then raise exception 'INVALID_EVENT'; end if;
  source_at:=nullif(p_event->>'occurred_at','')::timestamptz;
  if source_at is null or source_at > now()+interval '5 minutes' then raise exception 'INVALID_SOURCE_TIME'; end if;
  if p_event->>'kind'='response' and (
    coalesce(p_event->>'status','') not in ('접수','신규','담당자 배정','배정완료','응대중','전화응대 완료','현장방문예정','견적서 발송예정','보류','배드핏','연락두절','수주','실주','종결','종료')
    or nullif(btrim(p_event->>'response_content'),'') is null) then raise exception 'INVALID_RESPONSE'; end if;
  insert into private.inquiry_change_events(event_id,payload) values(p_event->>'event_id',p_event) on conflict do nothing;
  select payload into existing_payload from private.inquiry_change_events where event_id=p_event->>'event_id' for update;
  if existing_payload is distinct from p_event then raise exception 'EVENT_ID_REUSE'; end if;
  return public.crm_inquiry_change_apply_v1(p_event->>'event_id');
end;
$$;

create or replace function public.crm_inquiry_change_retry_v1()
returns jsonb language plpgsql security invoker set search_path='' as $$
declare e record; results jsonb:='[]'::jsonb;
begin
  if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),
    nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';
  end if;
  for e in select event_id from private.inquiry_change_events where status='pending' and next_retry_at<=now()
    order by created_at limit 100 for update skip locked loop
    results:=results||jsonb_build_array(public.crm_inquiry_change_apply_v1(e.event_id));
  end loop;
  return jsonb_build_object('processed',jsonb_array_length(results),'results',results);
end;
$$;
revoke all on function public.crm_inquiry_change_apply_v1(text),public.crm_inquiry_change_enqueue_v1(jsonb),public.crm_inquiry_change_retry_v1() from public,anon,authenticated;
grant execute on function public.crm_inquiry_change_apply_v1(text),public.crm_inquiry_change_enqueue_v1(jsonb),public.crm_inquiry_change_retry_v1() to service_role;
