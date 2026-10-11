-- Local candidate. Install AFTER schedule-preserve-v1-20261011.sql, while disabled.
-- Confirms first response from an existing contact log; never replaces/completes tasks.
begin;
create table if not exists crm_security.inquiry_response_v1_receipts(
 actor_auth_uid uuid not null,request_id uuid not null,actor_user_id uuid not null,
 inquiry_id uuid not null,command jsonb not null,ack jsonb not null,
 created_at timestamptz not null default clock_timestamp(),primary key(actor_auth_uid,request_id)
);
alter table crm_security.inquiry_response_v1_receipts enable row level security;
revoke all on crm_security.inquiry_response_v1_receipts from public,anon,authenticated;

create or replace function public.crm_inquiry_response_confirm_v1(p jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ctx jsonb; iid uuid; rid uuid; lid uuid; oldrow public.inquiries%rowtype; newrow public.inquiries%rowtype;
 logrow crm_security.inquiry_contact_logs%rowtype; receipt crm_security.inquiry_response_v1_receipts%rowtype;
 at_time timestamptz:=clock_timestamp(); audit_id uuid; history_id uuid; ack jsonb;
begin
 if jsonb_typeof(p) is distinct from 'object' or not p ?& array['inquiry_id','request_id','contact_log_id','expected_token']
  or exists(select 1 from jsonb_object_keys(p) k where k not in ('inquiry_id','request_id','contact_log_id','expected_token')) then
  raise exception 'INQUIRY_RESPONSE_INVALID_INPUT' using errcode='22023'; end if;
 iid:=(p->>'inquiry_id')::uuid;rid:=(p->>'request_id')::uuid;lid:=(p->>'contact_log_id')::uuid;
 if iid is null or rid is null or lid is null or coalesce(p->>'expected_token','') !~ '^[a-f0-9]{32}$' then
  raise exception 'INQUIRY_RESPONSE_INVALID_INPUT' using errcode='22023'; end if;
 ctx:=crm_security.schedule_v1_context('inquiry',iid);
 perform pg_advisory_xact_lock(hashtextextended((ctx->>'actor_auth_uid')||rid::text,174));
 select * into receipt from crm_security.inquiry_response_v1_receipts r
  where r.actor_auth_uid=(ctx->>'actor_auth_uid')::uuid and r.request_id=rid;
 if found then
  if receipt.command is distinct from p or receipt.actor_user_id is distinct from (ctx->>'actor_user_id')::uuid then
   raise exception 'REQUEST_ID_REUSE' using errcode='PT409'; end if;
  return receipt.ack||jsonb_build_object('replayed',true);
 end if;
 if not coalesce((select enabled from crm_security.schedule_v1_settings where singleton),false) then
  raise exception 'SCHEDULE_RELEASE_DISABLED' using errcode='PT503'; end if;
 if not (ctx->>'writable')::boolean then raise exception 'SCHEDULE_STATE_CONFLICT' using errcode='PT409'; end if;
 if crm_security.schedule_v1_token('inquiry',iid,ctx->'parent') is distinct from p->>'expected_token' then
  raise exception 'SCHEDULE_STALE' using errcode='PT409'; end if;
 select * into oldrow from public.inquiries where id=iid;
 if coalesce(oldrow.status,'') not in ('접수','신규','담당자 배정','배정완료','')
  or oldrow.first_response_at is not null or oldrow.responded_at is not null then
  raise exception 'INQUIRY_RESPONSE_STATE_CONFLICT' using errcode='PT409'; end if;
 select * into logrow from crm_security.inquiry_contact_logs l where l.id=lid and l.inquiry_id=iid
  and l.actor_auth_uid=(ctx->>'actor_auth_uid')::uuid and l.actor_user_id=(ctx->>'actor_user_id')::uuid and l.kind='connected' for share;
 if not found then raise exception 'INQUIRY_RESPONSE_CONTACT_REQUIRED' using errcode='PT409'; end if;

 -- Preserve existing PC state timestamps and stage history. Do not touch next_actions or next_action_date.
 update public.inquiries set status='전화응대 완료',first_response_at=at_time,responded_at=at_time,updated_at=at_time
  where id=iid returning * into newrow;
 insert into public.stage_history(inquiry_id,from_stage,to_stage,reason,actor_id,actor_name,changed_at)
 values(iid,'견적문의 접수','응대·컨설팅','응대 기록 확인 · '||logrow.result,(ctx->>'actor_user_id')::uuid,
  (select display_name from crm_security.actor()),at_time) returning id into history_id;
 insert into crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
 values((ctx->>'actor_auth_uid')::uuid,(ctx->>'actor_user_id')::uuid,iid,'inquiry_stage_progress',to_jsonb(oldrow),
  to_jsonb(newrow)||jsonb_build_object('contact_log_id',lid,'stage_history_id',history_id,'from_stage','견적문의 접수','to_stage','응대·컨설팅',
   'cancelled_action_ids','[]'::jsonb,'actor',(select display_name from crm_security.actor())),
  '응대 기록 확인 · '||logrow.result,at_time) returning event_id into audit_id;
 ack:=jsonb_build_object('ok',true,'contract','crm.inquiry-response.v1','request_id',rid,'inquiry_id',iid,'contact_log_id',lid,
  'actor_auth_uid',ctx->'actor_auth_uid','actor_user_id',ctx->'actor_user_id','owner_id',ctx->'owner_id',
  'status',newrow.status,'first_response_at',newrow.first_response_at,'responded_at',newrow.responded_at,'updated_at',newrow.updated_at,
  'next_action_date',newrow.next_action_date,'stage_history_id',history_id,'inquiry_audit_event_id',audit_id,
  'cancelled_action_ids','[]'::jsonb,'completed_action_ids','[]'::jsonb,
  'token',crm_security.schedule_v1_token('inquiry',iid,to_jsonb(newrow)),'replayed',false);
 insert into crm_security.inquiry_response_v1_receipts(actor_auth_uid,request_id,actor_user_id,inquiry_id,command,ack)
 values((ctx->>'actor_auth_uid')::uuid,rid,(ctx->>'actor_user_id')::uuid,iid,p,ack);
 return ack;
end $$;
revoke all on function public.crm_inquiry_response_confirm_v1(jsonb) from public,anon,authenticated;
grant execute on function public.crm_inquiry_response_confirm_v1(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
