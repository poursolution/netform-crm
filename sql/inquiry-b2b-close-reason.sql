-- Require a reason for NEW closures. Existing receipts remain replayable.
create or replace function crm_security.crm_inquiry_b2b_complete_command_v1(
 p_request_id uuid,p_inquiry_id uuid,p_payload jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 a record; i public.inquiries%rowtype; receipt crm_security.command_receipts%rowtype;
 canonical jsonb; ack jsonb; result_value text; note_value text; expected_at timestamptz;
 server_at timestamptz:=clock_timestamp(); audit_id uuid; cancelled_ids jsonb; latest_management text;
begin
 if auth.uid() is null then raise exception 'forbidden' using errcode='42501'; end if;
 perform 1 from public.users where auth_uid=auth.uid() for share;
 perform 1 from crm_security.access_review where reviewed_auth_uid=auth.uid() for share;
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if p_request_id is null or p_inquiry_id is null or jsonb_typeof(p_payload) is distinct from 'object'
  or not p_payload ?& array['intent','result','expected_updated_at','note']
  or exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('intent','result','expected_updated_at','note'))
  or p_payload->>'intent' is distinct from 'b2b_complete'
  or coalesce(p_payload->>'result','') not in ('협약완료','해결완료','종결')
  or jsonb_typeof(p_payload->'note') is distinct from 'string'
  or length(p_payload->>'note')>4000
  or nullif(p_payload->>'expected_updated_at','') is null then
  raise exception 'INVALID_B2B_COMPLETION' using errcode='22023';
 end if;
 result_value:=p_payload->>'result'; note_value:=btrim(p_payload->>'note');
 expected_at:=(p_payload->>'expected_updated_at')::timestamptz;
 canonical:=jsonb_build_object('intent','b2b_complete','result',result_value,'note',note_value,'expected_updated_at',expected_at);
 -- Lock receipt identity before the target to make a retry a no-op even after closure.
 perform pg_advisory_xact_lock(hashtextextended(a.auth_uid::text||p_request_id::text,0));
 perform 1 from crm_security.object_scope where user_id=a.user_id and inquiry_id=p_inquiry_id for share;
 select * into i from public.inquiries where id=p_inquiry_id for update;
 if not found or not crm_security.can_inquiry(p_inquiry_id)
  or a.permission_role not in ('admin','rep','consultation')
  or (a.permission_role<>'admin' and i.assigned_to is distinct from a.user_id) then
  raise exception 'forbidden' using errcode='42501';
 end if;
 select * into receipt from crm_security.command_receipts where actor_auth_uid=a.auth_uid and request_id=p_request_id;
 if found then
  if receipt.actor_user_id is distinct from a.user_id or receipt.operation is distinct from 'inquiry_status'
   or receipt.object_id is distinct from p_inquiry_id or receipt.expected_version is distinct from 0
   or receipt.payload is distinct from canonical then raise exception 'REQUEST_ID_REUSE' using errcode='PT409'; end if;
  return receipt.ack||jsonb_build_object('replayed',true);
 end if;
 if result_value='종결' and note_value='' then
  raise exception 'B2B_CLOSE_REASON_REQUIRED' using errcode='22023';
 end if;
 if not (coalesce(i.work_type,'') ~ '협약' or coalesce(i.raw->>'공사유형','') ~ '협약'
  or (coalesce(i.raw->>'문의내용','') !~ '협약(서)?[[:space:]]*(관련[[:space:]]*)?(문의|상담|요청)?[[:space:]]*(아님|아니|없음)'
   and coalesce(i.raw->>'문의내용','') ~ '협약(서)?[[:space:]]*(관련[[:space:]]*)?(문의|상담|요청|진행|체결)')) then
  raise exception 'AGREEMENT_INQUIRY_REQUIRED' using errcode='22023';
 end if;
 select action into latest_management from crm_security.inquiry_audit_events
  where inquiry_id=p_inquiry_id and action in ('inquiry_trash','inquiry_restore','inquiry_purge')
  order by created_at desc,event_id desc limit 1;
 if latest_management in ('inquiry_trash','inquiry_purge') or i.updated_at is distinct from expected_at
  or coalesce(i.status,'') in ('협약완료','해결완료','종결','종료','수주','실주','배드핏','연락두절','영업전환')
  or i.deal_id is not null or i.opportunity_id is not null or i.qualified_at is not null then
  raise exception 'B2B_STATE_CONFLICT' using errcode='PT409';
 end if;
 select coalesce(jsonb_agg(id),'[]'::jsonb) into cancelled_ids from public.next_actions where inquiry_id=p_inquiry_id and status='open';
 update public.next_actions set status='cancelled',updated_at=server_at where inquiry_id=p_inquiry_id and status='open';
 update public.inquiries set status=result_value,next_action_date=null,
  close_reason=result_value||case when note_value<>'' then ' · '||note_value else '' end,
  raw=coalesce(raw,'{}'::jsonb)||jsonb_build_object('진행상태',result_value,
   'b2b_completion',jsonb_build_object('result',result_value,'note',note_value,'at',server_at,'actor',a.display_name,'event_id',p_request_id),
   '응대내용',concat_ws(E'\n',nullif(raw->>'응대내용',''),'['||to_char(server_at at time zone 'Asia/Seoul','YYYY-MM-DD HH24:MI:SS')||'] '||result_value||case when note_value<>'' then ' · '||note_value else '' end)),
  updated_at=server_at where id=p_inquiry_id;
 insert into crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
 values(a.auth_uid,a.user_id,p_inquiry_id,'close',
  jsonb_build_object('status',i.status,'next_action_date',i.next_action_date),
  jsonb_build_object('intent','b2b_complete','status',result_value,'note',note_value,'cancelled_action_ids',cancelled_ids,'sales_performance',false),
  result_value||case when note_value<>'' then ' · '||note_value else '' end,server_at) returning event_id into audit_id;
 insert into private.inquiry_b2b_sync_outbox(event_id,inquiry_id,payload)
 values(p_request_id,p_inquiry_id,jsonb_build_object('event_id',p_request_id,'inquiry_id',p_inquiry_id,'sheet_row',i.sheet_row,
  'phone',i.phone,'brand',i.brand,'result',result_value,'note',note_value,'completed_at',server_at,'actor',a.display_name));
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation','inquiry_status','object_id',p_inquiry_id,
  'intent','b2b_complete','status',result_value,'note',note_value,'next_action_date',null,'completed_at',server_at,
  'inquiry_audit_event_id',audit_id,'cancelled_action_ids',cancelled_ids,'sync_event_id',p_request_id,'sync_status','pending',
  'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'changed',true,'replayed',false);
 insert into crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack,created_at)
 values(a.auth_uid,p_request_id,a.user_id,'inquiry_status',p_inquiry_id,0,canonical,ack,server_at);
 return ack;
end;
$$;
revoke all on function crm_security.crm_inquiry_b2b_complete_command_v1(uuid,uuid,jsonb) from public,anon,authenticated,service_role;

