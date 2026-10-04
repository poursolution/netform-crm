-- Trusted n8n worker only. Browser roles cannot fetch customer payloads or acknowledge delivery.
alter table private.inquiry_b2b_sync_outbox
 add column if not exists lease_token uuid,
 add column if not exists lease_until timestamptz,
 add column if not exists attempts integer not null default 0,
 add column if not exists available_at timestamptz not null default now();
create index if not exists inquiry_b2b_pending_delivery_idx on private.inquiry_b2b_sync_outbox(available_at,created_at) where status='pending';

create or replace function public.crm_inquiry_b2b_delivery_v1(
 p_action text,p_event_id uuid default null,p_token uuid default null,p_reason text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare o private.inquiry_b2b_sync_outbox%rowtype; i public.inquiries%rowtype; n integer:=0; token uuid; source_valid boolean;
begin
 if p_action not in ('claim','verify','ack','review') or p_action is null then raise exception 'INVALID_DELIVERY_ACTION' using errcode='22023'; end if;
 if p_action='claim' then
  loop
   n:=n+1; if n>25 then return jsonb_build_object('event',null); end if;
   select * into o from private.inquiry_b2b_sync_outbox where status='pending' and available_at<=clock_timestamp()
    and (lease_until is null or lease_until<clock_timestamp()) order by created_at,event_id for update skip locked limit 1;
   if not found then return jsonb_build_object('event',null); end if;
   select * into i from public.inquiries where id=o.inquiry_id;
   source_valid:=found and i.status=o.payload->>'result' and i.raw->'b2b_completion'->>'event_id'=o.event_id::text
    and i.sheet_row>=2 and i.sheet_row<1000000 and length(regexp_replace(coalesce(i.phone,''),'[^0-9]','','g'))>=8
    and nullif(i.brand,'') is not null and nullif(btrim(i.raw->>'문의내용'),'') is not null
    and i.sheet_row=(o.payload->>'sheet_row')::integer and i.phone=o.payload->>'phone' and i.brand=o.payload->>'brand'
    and not exists(select 1 from public.inquiries q where q.id<>i.id and (q.sheet_row=i.sheet_row or
     (regexp_replace(coalesce(q.phone,''),'[^0-9]','','g')=regexp_replace(i.phone,'[^0-9]','','g') and q.brand=i.brand)))
    and not exists(select 1 from crm_security.inquiry_audit_events e where e.inquiry_id=i.id and e.action in ('inquiry_trash','inquiry_purge')
      and e.created_at>=o.created_at);
   if source_valid is distinct from true or o.attempts>=5 then
    update private.inquiry_b2b_sync_outbox set status='review',reason=case when o.attempts>=5 then 'RETRY_LIMIT' else 'SOURCE_IDENTITY_REVIEW' end,
     lease_until=null where event_id=o.event_id;
   else
    token:=gen_random_uuid();
    update private.inquiry_b2b_sync_outbox set lease_token=token,lease_until=clock_timestamp()+interval '5 minutes',attempts=attempts+1 where event_id=o.event_id;
    return jsonb_build_object('event',o.payload||jsonb_build_object('source_inquiry',i.raw->>'문의내용'),'token',token);
   end if;
  end loop;
 end if;
 select * into o from private.inquiry_b2b_sync_outbox where event_id=p_event_id for update;
 if not found or p_token is null or o.lease_token is distinct from p_token then raise exception 'DELIVERY_LEASE_REQUIRED' using errcode='PT409'; end if;
 if p_action='ack' and o.status='synced' then return jsonb_build_object('ok',true,'status','synced','replayed',true); end if;
 if o.status<>'pending' or o.lease_until<clock_timestamp() then raise exception 'DELIVERY_LEASE_EXPIRED' using errcode='PT409'; end if;
 if p_action='review' then
  if p_reason is null or p_reason not in ('SHEET_IDENTITY_REVIEW','SHEET_STATE_REVIEW','SHEET_HEADERS_REVIEW','SOURCE_CHANGED','WRITE_RESPONSE_REVIEW') then raise exception 'INVALID_DELIVERY_REASON' using errcode='22023'; end if;
  update private.inquiry_b2b_sync_outbox set status='review',reason=p_reason,lease_until=null where event_id=o.event_id;
  return jsonb_build_object('ok',true,'status','review');
 end if;
 select * into i from public.inquiries where id=o.inquiry_id;
 if not found or i.status is distinct from o.payload->>'result' or i.raw->'b2b_completion'->>'event_id' is distinct from o.event_id::text
  or i.sheet_row is distinct from (o.payload->>'sheet_row')::integer or i.phone is distinct from o.payload->>'phone' or i.brand is distinct from o.payload->>'brand'
  or exists(select 1 from crm_security.inquiry_audit_events e where e.inquiry_id=i.id and e.action in ('inquiry_trash','inquiry_purge') and e.created_at>=o.created_at) then
  update private.inquiry_b2b_sync_outbox set status='review',reason='SOURCE_CHANGED',lease_until=null where event_id=o.event_id;
  return jsonb_build_object('ok',false,'status','review');
 end if;
 if p_action='ack' then
  update private.inquiry_b2b_sync_outbox set status='synced',synced_at=clock_timestamp(),reason=null,lease_until=null where event_id=o.event_id;
 end if;
 return jsonb_build_object('ok',true,'status',case when p_action='ack' then 'synced' else 'pending' end,'event_id',o.event_id);
end $$;
revoke all on function public.crm_inquiry_b2b_delivery_v1(text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.crm_inquiry_b2b_delivery_v1(text,uuid,uuid,text) to service_role;
