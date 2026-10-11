-- LOCAL CANDIDATE ONLY. Not installed/enabled by this file's creation.
-- Requires schedule-preserve-v1-20261011.sql and inquiry-contact-two-results-20261007.sql.
-- Existing inquiry visit/quote FACTS, not quote-v3 composition, sending, or pipeline conversion.
-- No existing next_action/calendar is changed/completed/cancelled. No inferred first response.
begin;
create table if not exists crm_security.inquiry_milestone_v1_settings(
 singleton boolean primary key default true check(singleton),enabled boolean not null default false
);
insert into crm_security.inquiry_milestone_v1_settings(singleton,enabled) values(true,false) on conflict do nothing;
create table if not exists crm_security.inquiry_milestone_v1_events(
 event_id uuid primary key default gen_random_uuid(),actor_auth_uid uuid not null,actor_user_id uuid not null,
 inquiry_id uuid not null,request_id uuid not null,kind text not null check(kind in ('visit_planned','visit_done','quote_draft','quote_sent')),
 fact jsonb not null,command jsonb not null,ack jsonb not null,created_at timestamptz not null default clock_timestamp(),
 unique(actor_auth_uid,request_id)
);
alter table crm_security.inquiry_milestone_v1_settings enable row level security;
alter table crm_security.inquiry_milestone_v1_events enable row level security;
revoke all on crm_security.inquiry_milestone_v1_settings,crm_security.inquiry_milestone_v1_events from public,anon,authenticated;

create or replace function crm_security.inquiry_milestone_v1_context(iid uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c jsonb; st jsonb; ft text; sched text; calendars jsonb; allowed boolean;
begin
 c:=crm_security.schedule_v1_context('inquiry',iid);
 -- Keep the existing explicit B2B separation. Do not create construction facts for agreements.
 allowed:=not(coalesce(c->'parent'->>'work_type','') ~ '협약' or coalesce(c->'parent'->'raw'->>'공사유형','') ~ '협약'
  or (coalesce(c->'parent'->'raw'->>'문의내용','') !~ '협약(서)?[[:space:]]*(관련[[:space:]]*)?(문의|상담|요청)?[[:space:]]*(아님|아니|없음)'
   and coalesce(c->'parent'->'raw'->>'문의내용','') ~ '협약(서)?[[:space:]]*(관련[[:space:]]*)?(문의|상담|요청|진행|체결)'));
 st:=crm_security.inquiry_flow_state_json(iid);
 select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) into calendars from crm_security.schedules x where x.inquiry_id=iid;
 ft:=md5(jsonb_build_object('state',st,'calendars',calendars)::text);
 sched:=crm_security.schedule_v1_token('inquiry',iid,c->'parent');
 return jsonb_build_object('ok',true,'contract','crm.inquiry-milestone.v1','inquiry_id',iid,
  'actor_auth_uid',c->'actor_auth_uid','actor_user_id',c->'actor_user_id','owner_id',c->'owner_id',
  'enabled',coalesce((select enabled from crm_security.inquiry_milestone_v1_settings where singleton),false)
   and coalesce((select enabled from crm_security.schedule_v1_settings where singleton),false),
  'writable',(c->>'writable')::boolean and allowed,
  'token',md5(sched||ft),'schedule_token',sched,'fact_token',ft,
  'parent_guard',md5(((c->'parent')-array['next_action_date','updated_at'])::text),
  'open_action_count',(select count(*) from public.next_actions n where n.inquiry_id=iid and n.status='open'),
  'open_calendar_count',(select count(*) from crm_security.schedules x where x.inquiry_id=iid and x.status='open' and x.type in ('visit','quote_followup')),
  'parent',jsonb_build_object('status',c->'parent'->'status','first_response_at',c->'parent'->'first_response_at',
   'responded_at',c->'parent'->'responded_at','next_action_date',c->'parent'->'next_action_date','updated_at',c->'parent'->'updated_at'),
  'state',st);
end $$;
revoke all on function crm_security.inquiry_milestone_v1_context(uuid) from public,anon,authenticated;

create or replace function public.crm_inquiry_milestone_context_v1(p jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if jsonb_typeof(p) is distinct from 'object' or not p ? 'inquiry_id'
  or exists(select 1 from jsonb_object_keys(p) k where k<>'inquiry_id') or p->>'inquiry_id' is null then
  raise exception 'MILESTONE_INVALID_INPUT' using errcode='22023'; end if;
 return crm_security.inquiry_milestone_v1_context((p->>'inquiry_id')::uuid);
end $$;

create or replace function public.crm_inquiry_milestone_save_v1(p jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c jsonb; fresh jsonb; iid uuid; rid uuid; eid uuid:=gen_random_uuid(); kind text; at_time timestamptz:=clock_timestamp();
 today date:=(clock_timestamp() at time zone 'Asia/Seoul')::date; day date; tm time; v_amount bigint; sent timestamptz;
 prior crm_security.inquiry_milestone_v1_events%rowtype; se crm_security.schedule_v1_events%rowtype;
 oldrow public.inquiries%rowtype; nr public.inquiries%rowtype; qv crm_security.inquiry_quote_versions%rowtype;
 fact jsonb; ack jsonb; audit_id uuid; version_id uuid; v_version_no integer; status_text text; planned boolean; author text;
begin
 if jsonb_typeof(p) is distinct from 'object' or not p ?& array['inquiry_id','request_id','expected_token','kind']
  or exists(select 1 from jsonb_object_keys(p) k where k not in ('inquiry_id','request_id','expected_token','kind','date','time','amount','method','file_name','change_reason','recipient','schedule_request_id','schedule_action_id')) then
  raise exception 'MILESTONE_INVALID_INPUT' using errcode='22023'; end if;
 iid:=(p->>'inquiry_id')::uuid;rid:=(p->>'request_id')::uuid;kind:=p->>'kind';
 if iid is null or rid is null or kind is null or kind not in ('visit_planned','visit_done','quote_draft','quote_sent') or coalesce(p->>'expected_token','') !~ '^[a-f0-9]{32}$' then
  raise exception 'MILESTONE_INVALID_INPUT' using errcode='22023'; end if;
 c:=crm_security.inquiry_milestone_v1_context(iid);
 perform pg_advisory_xact_lock(hashtextextended((c->>'actor_auth_uid')||rid::text,175));
 select * into prior from crm_security.inquiry_milestone_v1_events e where e.actor_auth_uid=(c->>'actor_auth_uid')::uuid and e.request_id=rid;
 if found then
  if prior.command is distinct from p or prior.actor_user_id is distinct from (c->>'actor_user_id')::uuid then raise exception 'REQUEST_ID_REUSE' using errcode='PT409'; end if;
  return prior.ack||jsonb_build_object('replayed',true);
 end if;
 if not (c->>'enabled')::boolean then raise exception 'MILESTONE_RELEASE_DISABLED' using errcode='PT503'; end if;
 if not (c->>'writable')::boolean then raise exception 'MILESTONE_STATE_CONFLICT' using errcode='PT409'; end if;
 if c->>'token' is distinct from p->>'expected_token' then raise exception 'MILESTONE_STALE' using errcode='PT409'; end if;
 if p->>'date' is not null then
  if p->>'date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'MILESTONE_INVALID_DATE' using errcode='22023'; end if;
  day:=(p->>'date')::date;if day::text<>p->>'date' or day<date '2000-01-01' or day>today+3650 then raise exception 'MILESTONE_INVALID_DATE' using errcode='22023'; end if;
 end if;
 if p->>'time' is not null then
  if kind not in ('visit_planned','visit_done') or p->>'time' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'MILESTONE_INVALID_TIME' using errcode='22023'; end if;
  tm:=(p->>'time')::time;
 end if;
 if kind in ('visit_planned','visit_done','quote_sent') and day is null then raise exception 'MILESTONE_DATE_REQUIRED' using errcode='22023'; end if;
 if kind in ('visit_done','quote_sent') and (day>today or (kind='visit_done' and tm is not null and (day+tm) at time zone 'Asia/Seoul'>at_time)) then raise exception 'MILESTONE_FUTURE_FACT' using errcode='22023'; end if;
 if p->>'amount' is not null then
  if jsonb_typeof(p->'amount')<>'number' or p->>'amount' !~ '^[0-9]+$' then raise exception 'MILESTONE_INVALID_AMOUNT' using errcode='22023'; end if;
  v_amount:=(p->>'amount')::bigint;if v_amount<1 or v_amount>9000000000000000 or kind not in ('quote_draft','quote_sent') then raise exception 'MILESTONE_INVALID_AMOUNT' using errcode='22023'; end if;
 end if;
 if kind='quote_sent' and v_amount is null or kind='quote_draft' and v_amount is null and day is null then raise exception 'MILESTONE_AMOUNT_REQUIRED' using errcode='22023'; end if;
 if (p ? 'method' and (jsonb_typeof(p->'method') is distinct from 'string' or length(btrim(p->>'method')) not between 1 and 100))
  or (p ? 'file_name' and (jsonb_typeof(p->'file_name') is distinct from 'string' or length(btrim(p->>'file_name')) not between 1 and 500))
  or (p ? 'change_reason' and (jsonb_typeof(p->'change_reason') is distinct from 'string' or length(btrim(p->>'change_reason')) not between 1 and 1000))
  or (p ? 'recipient' and (jsonb_typeof(p->'recipient') is distinct from 'object' or octet_length((p->'recipient')::text)>4000)) then raise exception 'MILESTONE_INVALID_INPUT' using errcode='22023'; end if;
 if kind like 'visit_%' and p ?| array['method','file_name','change_reason','recipient'] then raise exception 'MILESTONE_INVALID_INPUT' using errcode='22023'; end if;
 planned:=kind='visit_planned' or kind='quote_draft' and day is not null;
 if planned then
  -- The common schedule may have committed before midnight and lost its ACK.
  -- Keep its original date; only the exact already-created schedule event can justify a past planned date.
  if p->>'schedule_request_id' is null or p->>'schedule_action_id' is null then raise exception 'MILESTONE_SCHEDULE_REQUIRED' using errcode='PT409'; end if;
  select * into se from crm_security.schedule_v1_events e where e.actor_auth_uid=(c->>'actor_auth_uid')::uuid and e.actor_user_id=(c->>'actor_user_id')::uuid
   and e.request_id=(p->>'schedule_request_id')::uuid and e.action_id=(p->>'schedule_action_id')::uuid and e.target_type='inquiry' and e.target_id=iid and e.operation='add';
  if not found or se.date_basis<>'internal_plan' or se.command->>'due_on' is distinct from day::text or (se.created_at at time zone 'Asia/Seoul')::date>day
   or se.command->>'action_type' is distinct from (case when kind='visit_planned' then '방문' else '기타' end)
   or se.command->>'title' is distinct from (case when kind='visit_planned' then '현장방문'||case when tm is null then '' else ' '||(p->>'time') end else '견적서 발송' end)
   or (c->>'open_calendar_count')::integer<>0 or (c->>'open_action_count')::integer<>1
   or not exists(select 1 from public.next_actions n where n.id=se.action_id and n.inquiry_id=iid and n.status='open' and to_jsonb(n)=se.after_data) then
   raise exception 'MILESTONE_SCHEDULE_CONFLICT' using errcode='PT409'; end if;
 else
  if p ?| array['schedule_request_id','schedule_action_id'] then raise exception 'MILESTONE_INVALID_INPUT' using errcode='22023'; end if;
 end if;
 select * into oldrow from public.inquiries where id=iid;
 select display_name into author from crm_security.actor();
 insert into crm_security.inquiry_flow_state(inquiry_id) values(iid) on conflict do nothing;
 if v_amount is not null then
  select * into qv from crm_security.inquiry_quote_versions v where v.inquiry_id=iid order by v.version_no desc limit 1 for update;
  sent:=case when kind='quote_sent' then day::timestamp at time zone 'Asia/Seoul' end;
  -- Only an explicitly saved existing unsent draft can become sent; immutable sent versions remain unchanged.
  if qv.id is not null and qv.sent_at is null then
   if qv.amount<>v_amount and nullif(btrim(p->>'change_reason'),'') is null then raise exception 'MILESTONE_QUOTE_CHANGE_REASON_REQUIRED' using errcode='22023'; end if;
   -- Missing keys preserve the draft's original dispatch metadata; explicit null/blank is rejected above.
   update crm_security.inquiry_quote_versions set amount=v_amount,sent_at=sent,
    recipient=case when p ? 'recipient' then p->'recipient' else qv.recipient end,
    method=case when p ? 'method' then p->>'method' else qv.method end,
    file_name=case when p ? 'file_name' then p->>'file_name' else qv.file_name end,
    change_reason=case when p ? 'change_reason' then p->>'change_reason' else qv.change_reason end,
    author_user_id=(c->>'actor_user_id')::uuid,author_name=author,actor_auth_uid=(c->>'actor_auth_uid')::uuid,request_id=rid where id=qv.id returning id,inquiry_quote_versions.version_no into version_id,v_version_no;
  else
   if qv.id is not null and nullif(btrim(p->>'change_reason'),'') is null then raise exception 'MILESTONE_QUOTE_CHANGE_REASON_REQUIRED' using errcode='22023'; end if;
   v_version_no:=coalesce(qv.version_no,0)+1;
   insert into crm_security.inquiry_quote_versions(inquiry_id,version_no,amount,sent_at,recipient,method,file_name,change_reason,author_user_id,author_name,actor_auth_uid,request_id)
   values(iid,v_version_no,v_amount,sent,p->'recipient',p->>'method',p->>'file_name',p->>'change_reason',(c->>'actor_user_id')::uuid,author,(c->>'actor_auth_uid')::uuid,rid) returning id into version_id;
  end if;
 end if;
 -- Date-only facts use KST day precision in legacy timestamp projection; exact optional time stays in fact.
 if kind='visit_done' then
  update crm_security.inquiry_flow_state set visit_done_at=coalesce(visit_done_at,(day+coalesce(tm,time '00:00')) at time zone 'Asia/Seoul'),updated_at=at_time where inquiry_id=iid;
 elsif kind='quote_sent' then
  update crm_security.inquiry_flow_state set quote_sent_at=coalesce(quote_sent_at,sent),updated_at=at_time where inquiry_id=iid;
 else update crm_security.inquiry_flow_state set updated_at=at_time where inquiry_id=iid; end if;
 status_text:=case kind when 'visit_planned' then '현장방문예정' when 'visit_done' then '현장방문 완료' when 'quote_sent' then '견적서 발송완료' else '견적서 발송예정' end;
 update public.inquiries set status=status_text,updated_at=at_time where id=iid returning * into nr;
 fact:=(p-array['inquiry_id','request_id','expected_token'])||jsonb_build_object('precision',case when tm is null then 'day' else 'minute' end);
 insert into crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
 values((c->>'actor_auth_uid')::uuid,(c->>'actor_user_id')::uuid,iid,case when kind like 'visit_%' then 'flow_visit' when kind='quote_sent' then 'flow_quote_send' else 'flow_quote_draft' end,to_jsonb(oldrow),
  to_jsonb(nr)||jsonb_build_object('milestone_event_id',eid,'fact',fact,'quote_version_id',version_id,'cancelled_action_ids','[]'::jsonb,'completed_action_ids','[]'::jsonb),
  '방문·견적 사실 기록 · 기존 업무 유지',at_time) returning event_id into audit_id;
 fresh:=crm_security.inquiry_milestone_v1_context(iid);
 ack:=fresh||jsonb_build_object('request_id',rid,'kind',kind,'fact',fact,'event_id',eid,'inquiry_audit_event_id',audit_id,'quote_version_id',version_id,'quote_version_no',v_version_no,
  'cancelled_action_ids','[]'::jsonb,'completed_action_ids','[]'::jsonb,'changed_calendar_ids','[]'::jsonb,'promoted',false,'replayed',false,'server_at',at_time);
 insert into crm_security.inquiry_milestone_v1_events(event_id,actor_auth_uid,actor_user_id,inquiry_id,request_id,kind,fact,command,ack)
 values(eid,(c->>'actor_auth_uid')::uuid,(c->>'actor_user_id')::uuid,iid,rid,kind,fact,p,ack);
 return ack;
end $$;

create or replace function public.crm_inquiry_milestone_receipt_v1(p jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c jsonb; iid uuid; rid uuid; prior crm_security.inquiry_milestone_v1_events%rowtype;
begin
 if jsonb_typeof(p) is distinct from 'object' or not p ?& array['inquiry_id','request_id'] or exists(select 1 from jsonb_object_keys(p) k where k not in ('inquiry_id','request_id')) then raise exception 'MILESTONE_INVALID_INPUT' using errcode='22023'; end if;
 iid:=(p->>'inquiry_id')::uuid;rid:=(p->>'request_id')::uuid;if iid is null or rid is null then raise exception 'MILESTONE_INVALID_INPUT' using errcode='22023'; end if;
 c:=crm_security.inquiry_milestone_v1_context(iid);
 select * into prior from crm_security.inquiry_milestone_v1_events e where e.actor_auth_uid=(c->>'actor_auth_uid')::uuid and e.actor_user_id=(c->>'actor_user_id')::uuid and e.inquiry_id=iid and e.request_id=rid;
 return jsonb_build_object('ok',true,'contract','crm.inquiry-milestone.v1','inquiry_id',iid,'request_id',rid,'actor_auth_uid',c->'actor_auth_uid','actor_user_id',c->'actor_user_id','found',found,'ack',case when found then prior.ack end);
end $$;
revoke all on function public.crm_inquiry_milestone_context_v1(jsonb),public.crm_inquiry_milestone_save_v1(jsonb),public.crm_inquiry_milestone_receipt_v1(jsonb) from public,anon,authenticated;
grant execute on function public.crm_inquiry_milestone_context_v1(jsonb),public.crm_inquiry_milestone_save_v1(jsonb),public.crm_inquiry_milestone_receipt_v1(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
