-- Compound first-contact saves preserve unverified quote/visit objectives. No UI or backfill.
begin;
create or replace function public.crm_work_request_reply_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare r crm_security.work_requests%rowtype; a record; rid uuid;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 begin rid:=(p->>'id')::uuid; exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 select * into r from crm_security.work_requests where id=rid;
 if found and r.target_type='inquiry' and r.kind='first' and p->>'action' in ('done','reply') then
  -- No unverified old client may close a contact request with a result string.
  raise exception 'REQUEST_CONTACT_PROOF_REQUIRED: 서버에서 응대 저장과 완료 조건을 확인해 주세요' using errcode='22023';
 end if;
 return crm_security.work_request_reply_pre_contact_guard(p);
end $fn$;
revoke all on function public.crm_work_request_reply_v1(jsonb) from public,anon,service_role;
grant execute on function public.crm_work_request_reply_v1(jsonb) to authenticated;

create or replace function public.crm_work_request_inquiry_contact_v2(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 a record; r crm_security.work_requests%rowtype; q public.inquiries%rowtype;
 receipt crm_security.work_request_contact_receipts%rowtype; previous crm_security.work_request_contact_receipts%rowtype; prior_task public.next_actions%rowtype;
 rid uuid; oid uuid; qid uuid; nxt uuid; logged jsonb; ack jsonb;
 v_result text; nt text; nd date; contact text; reaction text;
 at_time timestamptz:=clock_timestamp(); today date:=(clock_timestamp() at time zone 'Asia/Seoul')::date;
begin
 select * into a from crm_security.actor();
 if not found or a.permission_role not in ('admin','rep','consultation') then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' or p - array['id','operation_id','result','next_text','next_due'] <> '{}'::jsonb then
  raise exception 'invalid payload' using errcode='22023';
 end if;
 begin rid:=(p->>'id')::uuid; oid:=(p->>'operation_id')::uuid; nd:=(p->>'next_due')::date;
 exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 if rid is null or oid is null then raise exception 'invalid payload' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('work-contact:'||a.auth_uid::text||oid::text,0));
 select * into receipt from crm_security.work_request_contact_receipts where actor_auth_uid=a.auth_uid and operation_id=oid;
 if found then
  if receipt.payload is distinct from p then raise exception 'REQUEST_ID_REUSE' using errcode='22023'; end if;
  if receipt.ack->>'contract_version' is distinct from '2' then raise exception 'REQUEST_ID_REUSE' using errcode='22023'; end if;
  return receipt.ack || jsonb_build_object('replayed',true); -- Original ACK only; client reloads current state.
 end if;
 select * into r from crm_security.work_requests where id=rid;
 if not found or r.target_type<>'inquiry' or r.to_scope<>'user' or r.to_user_id is distinct from a.user_id then
  raise exception '받는 담당자만 기록할 수 있습니다' using errcode='42501';
 end if;
 begin qid:=r.target_id::uuid; exception when others then raise exception 'invalid target' using errcode='22023'; end;
 -- Match the inquiry writer's lock order, then recheck the request under lock.
 select * into q from public.inquiries where id=qid for update;
 if not found or q.assigned_to is distinct from a.user_id or not crm_security.can_inquiry(qid) then
  raise exception '현재 문의 담당자를 확인해 주세요' using errcode='42501';
 end if;
 select * into r from crm_security.work_requests where id=rid for update;
 if r.target_type<>'inquiry' or r.target_id<>qid::text or r.to_scope<>'user' or r.to_user_id is distinct from a.user_id then
  raise exception '현재 요청 담당자를 확인해 주세요' using errcode='42501';
 end if;
 if r.status not in ('sent','seen','working') then raise exception '이미 끝난 요청입니다' using errcode='22023'; end if;
 -- Only the exact built-in compound first-contact objectives are accepted.
 if r.kind<>'first' or r.label<>'첫 연락 요청' or jsonb_typeof(r.asks) is distinct from 'array' then
  raise exception 'REQUEST_CONTACT_REVIEW_REQUIRED: 요청 조건을 상세에서 확인해 주세요' using errcode='22023';
 end if;
 if jsonb_array_length(r.asks) not between 2 and 3 or not (r.asks ? '고객 첫 연락')
  or not (r.asks <@ '["고객 첫 연락","연락 후 견적 필요 여부 확인","현장방문 필요 여부 확인"]'::jsonb)
  or (select count(distinct x) from jsonb_array_elements_text(r.asks) x)<>jsonb_array_length(r.asks) then
  raise exception 'REQUEST_CONTACT_REVIEW_REQUIRED: 요청 조건을 상세에서 확인해 주세요' using errcode='22023';
 end if;
 if coalesce(q.status,'') in ('종결','종료','수주','실주','배드핏','연락두절','협약완료','해결완료','영업전환')
  or q.deal_id is not null or q.opportunity_id is not null or q.qualified_at is not null then
  raise exception 'REQUEST_STAGE_REVIEW_REQUIRED: 문의 단계가 바뀌어 요청 확인이 필요합니다' using errcode='22023';
 end if;
 if coalesce(q.raw->>'응대내용','')<>'' or coalesce(q.raw->>'응대 내용','')<>'' or coalesce(q.raw->>'상담내용','')<>'' then
  raise exception 'REQUEST_CONTACT_REVIEW_REQUIRED: 이관 응대 기록을 상세에서 먼저 확인해 주세요' using errcode='22023';
 end if;
 if q.first_response_at is not null or q.responded_at is not null or exists(
  select 1 from crm_security.inquiry_flow_state s where s.inquiry_id=qid and s.first_connected_at is not null) then
  raise exception 'REQUEST_CONTACT_REVIEW_REQUIRED: 기존 응대와 후속 일정을 상세에서 확인해 주세요' using errcode='22023';
 end if;
 -- A retry may resolve only the unchanged task created by this same request's last absence.
 select * into previous from crm_security.work_request_contact_receipts c where c.request_id=rid order by c.created_at desc,c.operation_id desc limit 1;
 if found and previous.payload->>'result'='부재' and previous.actor_auth_uid=a.auth_uid then
  select * into prior_task from public.next_actions n where n.id=(previous.ack->>'next_action_id')::uuid for update;
  if not found or prior_task.inquiry_id is distinct from qid or prior_task.status<>'open' or prior_task.action_type<>'전화'
   or prior_task.title is distinct from previous.payload->>'next_text' or prior_task.assignee_name is distinct from a.display_name
   or prior_task.due_at is distinct from ((previous.payload->>'next_due')::date::timestamp at time zone 'Asia/Seoul')
   or q.next_action_date is distinct from (previous.payload->>'next_due')::date then
   raise exception 'REQUEST_PLAN_CONFLICT: 기존 재연락 일정이 변경되어 상세 확인이 필요합니다' using errcode='22023';
  end if;
 end if;
 -- Never replace an existing visit, quote, customer promise or even an undated task.
 if (q.next_action_date is not null and prior_task.id is null) or exists(select 1 from public.next_actions n where n.inquiry_id=qid and n.status='open' and n.id is distinct from prior_task.id)
  or exists(select 1 from crm_security.schedules s where s.inquiry_id=qid and s.status='open')
  or exists(select 1 from crm_security.inquiry_flow_state s where s.inquiry_id=qid and (s.meeting_date is not null or s.reply_due is not null)) then
  raise exception 'REQUEST_PLAN_CONFLICT: 기존 일정이 있습니다. 상세에서 약속과 다음 할 일을 확인해 주세요' using errcode='22023';
 end if;
 v_result:=nullif(btrim(p->>'result'),''); nt:=nullif(btrim(p->>'next_text'),'');
 if v_result is null or v_result not in ('연결됨','견적요청','검토중','부재') or nt is null or length(nt)>200
  or nd is null or nd<today or nd>today+366 then raise exception '결과와 다음 일정이 올바르지 않습니다' using errcode='22023'; end if;
 contact:=case when v_result='부재' then '부재' else '연결됨' end;
 reaction:=case when v_result in ('견적요청','검토중') then v_result else null end;
 logged:=public.crm_inquiry_command_v1(jsonb_build_object('type','contact_log','inquiry_id',qid,'request_id',oid,
  'channel','전화','result',v_result,'contact_result',contact,'customer_reaction',reaction,'content','관리자 요청 처리',
  'next_action',nt,'next_check_date',nd,'occurred_at',at_time));
 if logged->>'ok' is distinct from 'true' or nullif(logged->>'log_id','') is null then raise exception 'INVALID_CONTACT_ACK'; end if;
 -- Verify the persisted row, not the claimed result or client-local history.
 if not exists(select 1 from crm_security.inquiry_contact_logs l where l.id=(logged->>'log_id')::uuid
  and l.inquiry_id=qid and l.actor_user_id=a.user_id and l.request_id=oid and l.result=v_result
  and l.kind=case when v_result='부재' then 'attempt' else 'connected' end
  and l.next_action=nt and l.next_check_date=nd) then raise exception 'INVALID_CONTACT_PROOF'; end if;
 if prior_task.id is not null then
  update public.next_actions set status='completed',completed_at=at_time,updated_at=at_time where id=prior_task.id;
 end if;
 insert into public.next_actions(inquiry_id,action_type,title,due_at,assignee_name,status,created_at,updated_at)
 values(qid,case when v_result='견적요청' then '견적' else '전화' end,nt,nd::timestamp at time zone 'Asia/Seoul',a.display_name,'open',at_time,at_time) returning id into nxt;
 update public.inquiries set next_action_date=nd,updated_at=at_time,
  first_response_at=case when v_result='부재' then first_response_at else coalesce(first_response_at,at_time) end,
  responded_at=case when v_result='부재' then responded_at else coalesce(responded_at,at_time) end,
  status=case when v_result<>'부재' and coalesce(status,'') in ('','신규','접수','담당자 배정','배정완료') then '전화응대 완료' else status end
 where id=qid returning * into q;
 update crm_security.work_requests set status='working',
  result=v_result, next_text=nt,next_due=nd,seen_at=coalesce(seen_at,at_time),
  closed_at=null,updated_at=at_time,auto_done=false,
  replied_by_user_id=a.user_id,replied_by_name=a.display_name where id=rid returning * into r;
 ack:=jsonb_build_object('ok',true,'contract_version',2,'operation_id',oid,'inquiry_id',qid,'log_id',logged->>'log_id',
  'completion',jsonb_build_object('policy_version','first-compound-v1','requested_asks',r.asks,
   'satisfied_asks',case when v_result='부재' then '[]'::jsonb else '["고객 첫 연락"]'::jsonb end,
   'remaining_asks',(select jsonb_agg(x order by ord) from jsonb_array_elements(r.asks) with ordinality t(x,ord)
     where v_result='부재' or x<>'"고객 첫 연락"'::jsonb),
   'contact_log_id',logged->>'log_id','request_complete',false),
  'next_action_id',nxt,'state',logged->'state','request',crm_security.work_request_json(r,a.user_id,a.permission_role)||jsonb_build_object('to_user_id',r.to_user_id),
  'inquiry_update',jsonb_build_object('status',q.status,'responded_at',q.responded_at,'first_response_at',q.first_response_at,'next_action_date',q.next_action_date,'updated_at',q.updated_at),'server_at',at_time);
 insert into crm_security.work_request_contact_receipts(actor_auth_uid,operation_id,request_id,payload,ack)
 values(a.auth_uid,oid,rid,p,ack);
 return ack;
end $fn$;
revoke all on function public.crm_work_request_inquiry_contact_v2(jsonb) from public,anon,service_role;
grant execute on function public.crm_work_request_inquiry_contact_v2(jsonb) to authenticated;
-- Full review snapshots are append-only; no public table access or historical backfill.
create table if not exists crm_security.work_request_objective_events(
 request_id uuid not null references crm_security.work_requests(id),
 revision integer not null check(revision>0),
 actor_auth_uid uuid not null, actor_user_id uuid not null,
 operation_id uuid not null, payload jsonb not null, ack jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(request_id,revision),unique(actor_auth_uid,operation_id)
);
alter table crm_security.work_request_objective_events enable row level security;
revoke all on crm_security.work_request_objective_events from public,anon,authenticated,service_role;

create or replace function public.crm_work_request_objectives_read_v1(p jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare a record; r crm_security.work_requests%rowtype; rid uuid; proof jsonb; latest jsonb; rev integer; hist jsonb; page_no integer;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' or p-array['id','page']<>'{}'::jsonb or (p ? 'page' and (jsonb_typeof(p->'page') is distinct from 'number' or coalesce(p->>'page','')!~'^[0-9]+$')) then raise exception 'invalid payload' using errcode='22023'; end if;
 begin rid:=(p->>'id')::uuid;page_no:=coalesce((p->>'page')::integer,1); exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 if page_no not between 1 and 100000 then raise exception 'invalid page' using errcode='22023';end if;
 select * into r from crm_security.work_requests where id=rid;
 if not found or not coalesce(a.permission_role='admin' or r.requested_by_user_id=a.user_id or r.to_user_id=a.user_id,false) then
  raise exception 'forbidden' using errcode='42501'; end if;
 if r.target_type<>'inquiry' or r.kind<>'first' then raise exception 'unsupported request' using errcode='22023'; end if;
 select c.ack->'completion' into proof from crm_security.work_request_contact_receipts c
  where c.request_id=rid and c.ack->>'contract_version'='2' order by c.created_at desc,c.operation_id desc limit 1;
 select e.revision,e.ack into rev,latest from crm_security.work_request_objective_events e where e.request_id=rid order by e.revision desc limit 1;
 -- History is bounded. Older revisions stay persisted and are not silently discarded.
 select coalesce(jsonb_agg(x.row order by x.revision desc),'[]'::jsonb) into hist from (
  select e.revision,jsonb_build_object('revision',e.revision,'actor_user_id',e.actor_user_id,'at',e.created_at,
   'decisions',e.ack->'decisions','request_complete',e.ack->'request_complete','policy_version',e.ack->'policy_version') row
  from crm_security.work_request_objective_events e where e.request_id=rid order by e.revision desc limit 20 offset (page_no-1)*20) x;
 return jsonb_build_object('ok',true,'contract_version',1,'request_id',rid,'revision',coalesce(rev,0),
  'request',crm_security.work_request_json(r,a.user_id,a.permission_role),'expected_updated_at',r.updated_at,
  'policy_version','first-compound-v1','contact_proof',proof,'decisions',coalesce(latest->'decisions','[]'::jsonb),
  'request_complete',coalesce((latest->>'request_complete')::boolean,false) and r.status='done',
  'history',hist,'history_total',coalesce(rev,0),'history_page',page_no,'history_has_more',coalesce(rev,0)>page_no*20);
end $fn$;
revoke all on function public.crm_work_request_objectives_read_v1(jsonb) from public,anon,service_role;
grant execute on function public.crm_work_request_objectives_read_v1(jsonb) to authenticated;

create or replace function public.crm_work_request_objectives_write_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare a record; r crm_security.work_requests%rowtype; q public.inquiries%rowtype;
 saved crm_security.work_request_objective_events%rowtype; task public.next_actions%rowtype;
 rid uuid; oid uuid; qid uuid; logid uuid; taskid uuid; expected integer; rev integer; stamp timestamptz;
 proof jsonb; decisions jsonb; d jsonb; facts jsonb:='[]'::jsonb; taskproof jsonb; ack jsonb; complete boolean;
begin
 select * into a from crm_security.actor();
 if not found or a.permission_role not in ('admin','rep','consultation') then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' or p-array['id','operation_id','expected_revision','expected_updated_at','decisions','complete']<>'{}'::jsonb
  or jsonb_typeof(p->'complete') is distinct from 'boolean' or jsonb_typeof(p->'expected_revision') is distinct from 'number'
  or coalesce(p->>'expected_revision','')!~'^[0-9]+$' then raise exception 'invalid payload' using errcode='22023'; end if;
 begin rid:=(p->>'id')::uuid;oid:=(p->>'operation_id')::uuid;expected:=(p->>'expected_revision')::integer;stamp:=(p->>'expected_updated_at')::timestamptz;
 exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 if rid is null or oid is null or stamp is null then raise exception 'invalid payload' using errcode='22023'; end if;
 complete:=(p->>'complete')::boolean;decisions:=p->'decisions';
 if jsonb_typeof(decisions) is distinct from 'array' then raise exception 'invalid decisions' using errcode='22023'; end if;
 if jsonb_array_length(decisions)>2 then raise exception 'invalid decisions' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('work-objectives:'||a.auth_uid::text||oid::text,0));
 select * into r from crm_security.work_requests where id=rid;
 if not found or r.target_type<>'inquiry' or r.to_scope<>'user' or r.to_user_id is distinct from a.user_id then raise exception 'forbidden' using errcode='42501'; end if;
 qid:=r.target_id::uuid;
 select * into q from public.inquiries where id=qid for update;
 if not found or q.assigned_to is distinct from a.user_id or not crm_security.can_inquiry(qid) then raise exception 'forbidden' using errcode='42501'; end if;
 select * into r from crm_security.work_requests where id=rid for update;
 if r.target_type<>'inquiry' or r.target_id<>qid::text or r.to_scope<>'user' or r.to_user_id is distinct from a.user_id then raise exception 'forbidden' using errcode='42501'; end if;
 select * into saved from crm_security.work_request_objective_events where actor_auth_uid=a.auth_uid and operation_id=oid;
 if found then
  if saved.payload is distinct from p then raise exception 'REQUEST_ID_REUSE' using errcode='22023'; end if;
  return saved.ack||jsonb_build_object('replayed',true);
 end if;
 if r.status not in ('sent','seen','working') then raise exception 'REQUEST_CLOSED' using errcode='22023'; end if;
 if r.kind<>'first' or r.label<>'첫 연락 요청' or jsonb_typeof(r.asks) is distinct from 'array' then raise exception 'unsupported request' using errcode='22023'; end if;
 if jsonb_array_length(r.asks) not between 2 and 3 or not(r.asks ? '고객 첫 연락') or not(r.asks <@ '["고객 첫 연락","연락 후 견적 필요 여부 확인","현장방문 필요 여부 확인"]'::jsonb)
  or (select count(distinct x) from jsonb_array_elements_text(r.asks) x)<>jsonb_array_length(r.asks) then raise exception 'unsupported request' using errcode='22023'; end if;
 if coalesce(q.status,'') in ('종결','종료','수주','실주','배드핏','연락두절','협약완료','해결완료','영업전환') or q.deal_id is not null or q.opportunity_id is not null or q.qualified_at is not null then
  raise exception 'REQUEST_STAGE_REVIEW_REQUIRED' using errcode='22023'; end if;
 if (select e.action from crm_security.inquiry_audit_events e where e.inquiry_id=qid and e.action in ('inquiry_trash','inquiry_restore','inquiry_purge') order by e.created_at desc,e.event_id desc limit 1) in ('inquiry_trash','inquiry_purge') then
  raise exception 'REQUEST_STAGE_REVIEW_REQUIRED' using errcode='22023'; end if;
 select coalesce(max(e.revision),0) into rev from crm_security.work_request_objective_events e where e.request_id=rid;
 if rev<>expected or r.updated_at is distinct from stamp then raise exception 'REQUEST_REVIEW_CONFLICT' using errcode='40001'; end if;
 select c.ack->'completion' into proof from crm_security.work_request_contact_receipts c where c.request_id=rid and c.ack->>'contract_version'='2'
  and c.payload->>'result'<>'부재' order by c.created_at desc,c.operation_id desc limit 1;
 if proof is null or proof->'requested_asks' is distinct from r.asks then raise exception 'REQUEST_CONTACT_PROOF_REQUIRED' using errcode='22023'; end if;
 logid:=(proof->>'contact_log_id')::uuid;
 if not exists(select 1 from crm_security.inquiry_contact_logs l where l.id=logid and l.inquiry_id=qid and l.kind='connected') then raise exception 'REQUEST_CONTACT_PROOF_REQUIRED' using errcode='22023'; end if;
 if (select count(distinct x->>'ask') from jsonb_array_elements(decisions) x)<>jsonb_array_length(decisions) then raise exception 'invalid decisions' using errcode='22023'; end if;
 for d in select x from jsonb_array_elements(decisions) x loop
  if jsonb_typeof(d) is distinct from 'object' or d-array['ask','value','note','next_action_id']<>'{}'::jsonb
   or jsonb_typeof(d->'ask') is distinct from 'string' or not(r.asks ? (d->>'ask')) or d->>'ask'='고객 첫 연락'
   or coalesce(d->>'value','') not in ('needed','not_needed','unknown') or jsonb_typeof(d->'note') is distinct from 'string'
   or length(btrim(d->>'note')) not between 1 and 2000 then raise exception 'invalid decisions' using errcode='22023'; end if;
  taskproof:=null;taskid:=null;
  if d->>'value'='needed' then
   begin taskid:=(d->>'next_action_id')::uuid;exception when others then raise exception 'REQUEST_FOLLOWUP_REQUIRED' using errcode='22023';end;
   select * into task from public.next_actions where id=taskid for update;
   if not found or task.inquiry_id is distinct from qid or task.assignee_name is distinct from a.display_name
    or coalesce(task.status,'') not in ('open','completed') or coalesce(task.title,'') !~ '[^[:space:]]'
    or (task.status='open' and (task.due_at is null or not isfinite(task.due_at)))
    or (task.status='completed' and (task.completed_at is null or not isfinite(task.completed_at)))
    or task.action_type is distinct from (case when d->>'ask'='연락 후 견적 필요 여부 확인' then '견적' else '방문' end) then
    raise exception 'REQUEST_FOLLOWUP_REQUIRED' using errcode='22023'; end if;
   taskproof:=jsonb_build_object('id',task.id,'title',task.title,'action_type',task.action_type,'due_at',task.due_at,'status',task.status,'completed_at',task.completed_at);
  elsif d ? 'next_action_id' and d->'next_action_id'<>'null'::jsonb then raise exception 'invalid decisions' using errcode='22023'; end if;
  facts:=facts||jsonb_build_array(jsonb_build_object('ask',d->>'ask','value',d->>'value','note',btrim(d->>'note'),'contact_log_id',logid,'next_action',taskproof));
 end loop;
 if complete and (jsonb_array_length(decisions)<>jsonb_array_length(r.asks)-1 or exists(select 1 from jsonb_array_elements(decisions) x where x->>'value'='unknown')) then
  raise exception 'REQUEST_OBJECTIVES_REMAIN' using errcode='22023'; end if;
 update crm_security.work_requests set status=case when complete then 'done' else 'working' end,closed_at=case when complete then clock_timestamp() else null end,
  auto_done=false,updated_at=clock_timestamp(),replied_by_user_id=a.user_id,replied_by_name=a.display_name where id=rid returning * into r;
 ack:=jsonb_build_object('ok',true,'contract_version',1,'operation_id',oid,'request_id',rid,'revision',rev+1,'policy_version','first-compound-v1',
  'requested_asks',r.asks,'decisions',facts,'contact_proof',proof,'request_complete',complete,'request',crm_security.work_request_json(r,a.user_id,a.permission_role),
  'expected_updated_at',r.updated_at,'server_at',clock_timestamp());
 insert into crm_security.work_request_objective_events(request_id,revision,actor_auth_uid,actor_user_id,operation_id,payload,ack)
 values(rid,rev+1,a.auth_uid,a.user_id,oid,p,ack);
 return ack;
end $fn$;
revoke all on function public.crm_work_request_objectives_write_v1(jsonb) from public,anon,service_role;
grant execute on function public.crm_work_request_objectives_write_v1(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
