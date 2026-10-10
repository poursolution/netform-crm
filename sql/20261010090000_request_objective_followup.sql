-- #550 UI connection contract. Additive plans only; never replace a customer plan.
begin;
create table if not exists crm_security.work_request_followup_events (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references crm_security.work_requests(id),
 inquiry_id uuid not null references public.inquiries(id),
 actor_auth_uid uuid not null, actor_user_id uuid not null,
 operation_id uuid not null, next_action_id uuid references public.next_actions(id),
 payload jsonb not null, ack jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 unique(actor_auth_uid,operation_id)
);
create index if not exists work_request_followup_request on crm_security.work_request_followup_events(request_id,created_at,id);
create index if not exists work_request_followup_task on crm_security.work_request_followup_events(next_action_id) where next_action_id is not null;
alter table crm_security.work_request_followup_events enable row level security;
revoke all on crm_security.work_request_followup_events from public,anon,authenticated,service_role;

-- Private helper: callers must check access. Token covers ALL plans, not just page 1.
create or replace function crm_security.work_request_plan_context(qid uuid)
returns jsonb language sql stable security definer set search_path='' as $fn$
 with q as (select next_action_date,updated_at,assigned_to from public.inquiries where id=qid),
 n as (select id,action_type,title,due_at,status,assignee_name,completed_at,updated_at from public.next_actions where inquiry_id=qid),
 s as (select id,type,title,at,at_time,status,owner_user_id,updated_at from crm_security.schedules where inquiry_id=qid),
 snapshot as (select jsonb_build_object('inquiry',(select to_jsonb(q) from q),
 'tasks',coalesce((select jsonb_agg(to_jsonb(n) order by id) from n),'[]'::jsonb),
 'schedules',coalesce((select jsonb_agg(to_jsonb(s) order by id) from s),'[]'::jsonb)) v)
 select jsonb_build_object('token',md5(v::text),'next_action_date',(select next_action_date from q),
 'open_task_count',(select count(*) from n where status='open'),'open_schedule_count',(select count(*) from s where status='open'),
 'tasks',coalesce((select jsonb_agg(to_jsonb(x) order by due_at,id) from (select * from n where status='open' order by due_at,id limit 20) x),'[]'::jsonb),
 'schedules',coalesce((select jsonb_agg(to_jsonb(x) order by at,id) from (select * from s where status='open' order by at,id limit 20) x),'[]'::jsonb)) from snapshot;
$fn$;
revoke all on function crm_security.work_request_plan_context(uuid) from public,anon,authenticated,service_role;

create or replace function public.crm_work_request_objective_followup_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare a record; r crm_security.work_requests%rowtype; q public.inquiries%rowtype; saved crm_security.work_request_followup_events%rowtype;
 rid uuid; oid uuid; qid uuid; tid uuid; eid uuid:=gen_random_uuid(); stamp timestamptz; due date; rev integer;
 ctx jsonb; proof jsonb; ack jsonb; origin text; mode text; v_title text; reason text; ask text; evidence text; at_time timestamptz:=clock_timestamp();
begin
 select * into a from crm_security.actor();
 if not found or a.permission_role not in ('admin','rep','consultation') then raise exception 'forbidden' using errcode='42501';end if;
 if jsonb_typeof(p) is distinct from 'object' or p-array['id','operation_id','expected_revision','expected_updated_at','plan_token','ask','title','due_date','plan_origin','agreement_note','mode','reason']<>'{}'::jsonb
  or jsonb_typeof(p->'expected_revision') is distinct from 'number' or coalesce(p->>'expected_revision','')!~'^[0-9]+$' then raise exception 'invalid payload' using errcode='22023';end if;
 begin rid:=(p->>'id')::uuid;oid:=(p->>'operation_id')::uuid;stamp:=(p->>'expected_updated_at')::timestamptz;due:=(p->>'due_date')::date;
 exception when others then raise exception 'invalid payload' using errcode='22023';end;
 if rid is null or oid is null or stamp is null or not isfinite(stamp) or due is null or not isfinite(due) or p->>'due_date'<>to_char(due,'YYYY-MM-DD') then raise exception 'invalid payload' using errcode='22023';end if;
 origin:=p->>'plan_origin';mode:=p->>'mode';v_title:=btrim(p->>'title');reason:=btrim(p->>'reason');ask:=p->>'ask';evidence:=btrim(p->>'agreement_note');
 if coalesce(origin,'') not in ('customer_agreed','internal_plan') or coalesce(mode,'') not in ('create','additional','request_change')
  or jsonb_typeof(p->'title') is distinct from 'string' or coalesce(v_title,'') !~ '[^[:space:]]' or length(v_title)>500
  or jsonb_typeof(p->'reason') is distinct from 'string' or coalesce(reason,'') !~ '[^[:space:]]' or length(reason)>2000
  or (origin='customer_agreed' and (jsonb_typeof(p->'agreement_note') is distinct from 'string' or coalesce(evidence,'') !~ '[^[:space:]]' or length(evidence)>2000))
  or (origin='internal_plan' and coalesce(evidence,'')<>'') then raise exception 'invalid plan evidence' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('work-followup:'||a.auth_uid::text||oid::text,0));
 select * into r from crm_security.work_requests where id=rid;
 if not found or r.target_type<>'inquiry' or r.to_scope<>'user' or r.to_user_id is distinct from a.user_id then raise exception 'forbidden' using errcode='42501';end if;
 qid:=r.target_id::uuid;
 select * into q from public.inquiries where id=qid for update;
 if not found or q.assigned_to is distinct from a.user_id or not crm_security.can_inquiry(qid) then raise exception 'forbidden' using errcode='42501';end if;
 select * into r from crm_security.work_requests where id=rid for update;
 if r.target_id<>qid::text or r.to_scope<>'user' or r.to_user_id is distinct from a.user_id then raise exception 'forbidden' using errcode='42501';end if;
 select * into saved from crm_security.work_request_followup_events where actor_auth_uid=a.auth_uid and operation_id=oid;
 if found then
  if saved.payload is distinct from p then raise exception 'REQUEST_ID_REUSE' using errcode='22023';end if;
  return saved.ack||jsonb_build_object('replayed',true);
 end if;
 if r.status not in ('sent','seen','working') then raise exception 'REQUEST_CLOSED' using errcode='22023';end if;
 if r.kind<>'first' or r.label<>'첫 연락 요청' or jsonb_typeof(r.asks) is distinct from 'array' then raise exception 'unsupported request' using errcode='22023';end if;
 if jsonb_array_length(r.asks) not between 2 and 3 or not(r.asks ? '고객 첫 연락') or not(r.asks <@ '["고객 첫 연락","연락 후 견적 필요 여부 확인","현장방문 필요 여부 확인"]'::jsonb)
  or (select count(distinct x) from jsonb_array_elements_text(r.asks) x)<>jsonb_array_length(r.asks)
  or coalesce(ask,'') not in ('연락 후 견적 필요 여부 확인','현장방문 필요 여부 확인') or not(r.asks ? ask) then raise exception 'unsupported request' using errcode='22023';end if;
 if coalesce(q.status,'') in ('종결','종료','수주','실주','배드핏','연락두절','협약완료','해결완료','영업전환') or q.deal_id is not null or q.opportunity_id is not null or q.qualified_at is not null
  or (select e.action from crm_security.inquiry_audit_events e where e.inquiry_id=qid and e.action in ('inquiry_trash','inquiry_restore','inquiry_purge') order by e.created_at desc,e.event_id desc limit 1) in ('inquiry_trash','inquiry_purge') then raise exception 'REQUEST_STAGE_REVIEW_REQUIRED' using errcode='22023';end if;
 select coalesce(max(e.revision),0) into rev from crm_security.work_request_objective_events e where e.request_id=rid;
 if rev::text<>p->>'expected_revision' or r.updated_at is distinct from stamp then raise exception 'REQUEST_REVIEW_CONFLICT' using errcode='40001';end if;
 select c.ack->'completion' into proof from crm_security.work_request_contact_receipts c where c.request_id=rid and c.ack->>'contract_version'='2' and c.payload->>'result'<>'부재' order by c.created_at desc,c.operation_id desc limit 1;
 if proof is null or proof->'requested_asks' is distinct from r.asks or not exists(select 1 from crm_security.inquiry_contact_logs l where l.id=(proof->>'contact_log_id')::uuid and l.inquiry_id=qid and l.kind='connected') then raise exception 'REQUEST_CONTACT_PROOF_REQUIRED' using errcode='22023';end if;
 -- Lock all existing plans before checking the snapshot. Inquiry lock serializes cooperating writers.
 perform 1 from public.next_actions where inquiry_id=qid order by id for update;
 perform 1 from crm_security.schedules where inquiry_id=qid order by id for update;
 ctx:=crm_security.work_request_plan_context(qid);
 if ctx->>'token' is distinct from p->>'plan_token' then raise exception 'REQUEST_PLAN_CHANGED' using errcode='40001';end if;
 if due<(at_time at time zone 'Asia/Seoul')::date then raise exception 'invalid due date' using errcode='22023';end if;
 if mode='create' and (q.next_action_date is not null or (ctx->>'open_task_count')::integer>0 or (ctx->>'open_schedule_count')::integer>0) then raise exception 'REQUEST_PLAN_CONFLICT' using errcode='22023';end if;
 if mode<>'request_change' then
  if exists(select 1 from public.next_actions n where n.inquiry_id=qid and n.assignee_name=a.display_name and n.status='open' and n.action_type=case when ask='연락 후 견적 필요 여부 확인' then '견적' else '방문' end and n.title=v_title and (n.due_at at time zone 'Asia/Seoul')::date=due) then raise exception 'REQUEST_FOLLOWUP_EXISTS' using errcode='22023';end if;
  insert into public.next_actions(inquiry_id,action_type,title,due_at,assignee_name,status,created_at,updated_at)
  values(qid,case when ask='연락 후 견적 필요 여부 확인' then '견적' else '방문' end,v_title,due::timestamp at time zone 'Asia/Seoul',a.display_name,'open',at_time,at_time) returning id into tid;
 end if;
 -- No inquiry scalar, customer schedule, request deadline or task is overwritten.
 ack:=jsonb_build_object('ok',true,'contract_version',1,'operation_id',oid,'request_id',rid,'inquiry_id',qid,'event_id',eid,'next_action_id',tid,
  'status',case when mode='request_change' then 'change_requested' else 'created' end,'mode',mode,'ask',ask,'plan_origin',origin,
  'title',v_title,'due_date',due,'agreement_note',evidence,'reason',reason,'policy_version','objective-followup-v1','server_at',at_time,
  'expected_updated_at',r.updated_at,'revision',rev,'plan_token_before',ctx->>'token');
 insert into crm_security.work_request_followup_events(id,request_id,inquiry_id,actor_auth_uid,actor_user_id,operation_id,next_action_id,payload,ack)
 values(eid,rid,qid,a.auth_uid,a.user_id,oid,tid,p,ack);
 return ack;
end $fn$;
revoke all on function public.crm_work_request_objective_followup_v1(jsonb) from public,anon,service_role;
grant execute on function public.crm_work_request_objective_followup_v1(jsonb) to authenticated;
create or replace function public.crm_work_request_objectives_read_v1(p jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare a record; r crm_security.work_requests%rowtype; rid uuid; proof jsonb; latest jsonb; rev integer; hist jsonb; page_no integer; candidate_page integer; candidate_total integer; candidates jsonb; changes jsonb; change_total integer; qid uuid; owner_name text; can_write boolean;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' or p-array['id','page','candidate_page']<>'{}'::jsonb or (p ? 'page' and (jsonb_typeof(p->'page') is distinct from 'number' or coalesce(p->>'page','')!~'^[0-9]+$')) then raise exception 'invalid payload' using errcode='22023'; end if;
 begin rid:=(p->>'id')::uuid;page_no:=coalesce((p->>'page')::integer,1);candidate_page:=coalesce((p->>'candidate_page')::integer,1); exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 if (p ? 'candidate_page' and (jsonb_typeof(p->'candidate_page') is distinct from 'number' or coalesce(p->>'candidate_page','')!~'^[0-9]+$')) or candidate_page not between 1 and 100000 or page_no not between 1 and 100000 then raise exception 'invalid page' using errcode='22023';end if;
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

 qid:=r.target_id::uuid;
 select u.name into owner_name from public.inquiries q join public.users u on u.user_id=q.assigned_to where q.id=qid and q.assigned_to=r.to_user_id;
 can_write:=r.to_user_id=a.user_id and owner_name is not null and r.status in ('sent','seen','working');
 select count(*) into candidate_total from public.next_actions n where n.inquiry_id=qid and n.assignee_name=owner_name and n.action_type in ('견적','방문')
  and n.status in ('open','completed') and coalesce(n.title,'')~'[^[:space:]]' and ((n.status='open' and n.due_at is not null and isfinite(n.due_at)) or (n.status='completed' and n.completed_at is not null and isfinite(n.completed_at)));
 select coalesce(jsonb_agg(x.item order by x.due_at,x.id),'[]'::jsonb) into candidates from (
  select n.id,n.due_at,jsonb_build_object('id',n.id,'title',n.title,'action_type',n.action_type,'due_at',n.due_at,'status',n.status,'completed_at',n.completed_at,
   'plan_origin',coalesce(e.payload->>'plan_origin','unknown'),'agreement_note',e.payload->>'agreement_note','source_recorded_at',e.created_at) item
  from public.next_actions n left join lateral (select e.payload,e.created_at from crm_security.work_request_followup_events e where e.next_action_id=n.id and e.payload->>'title'=n.title and (e.payload->>'due_date')::date=(n.due_at at time zone 'Asia/Seoul')::date and e.actor_user_id=r.to_user_id order by e.created_at desc,e.id desc limit 1) e on true
  where n.inquiry_id=qid and n.assignee_name=owner_name and n.action_type in ('견적','방문') and n.status in ('open','completed')
   and coalesce(n.title,'')~'[^[:space:]]' and ((n.status='open' and n.due_at is not null and isfinite(n.due_at)) or (n.status='completed' and n.completed_at is not null and isfinite(n.completed_at)))
  order by n.due_at,n.id limit 20 offset (candidate_page-1)*20) x;
 select count(*) into change_total from crm_security.work_request_followup_events e where e.request_id=rid and e.payload->>'mode'='request_change';
 select coalesce(jsonb_agg(x.ack order by x.created_at desc,x.id),'[]'::jsonb) into changes from (select e.id,e.created_at,e.ack from crm_security.work_request_followup_events e where e.request_id=rid and e.payload->>'mode'='request_change' order by e.created_at desc,e.id limit 20 offset (page_no-1)*20) x;
 return jsonb_build_object('ok',true,'contract_version',1,'request_id',rid,'revision',coalesce(rev,0),
  'request',crm_security.work_request_json(r,a.user_id,a.permission_role),'expected_updated_at',r.updated_at,
  'policy_version','first-compound-v1','contact_proof',proof,'decisions',coalesce(latest->'decisions','[]'::jsonb),
  'request_complete',coalesce((latest->>'request_complete')::boolean,false) and r.status='done',
  'followup_contract',1,'can_write',coalesce(can_write,false),'plan_context',crm_security.work_request_plan_context(qid),
  'followup_candidates',candidates,'candidate_total',candidate_total,'candidate_page',candidate_page,'candidate_has_more',candidate_total>candidate_page*20,
  'change_requests',changes,'change_request_total',change_total,'change_request_page',page_no,'change_request_has_more',change_total>page_no*20,
  'history',hist,'history_total',coalesce(rev,0),'history_page',page_no,'history_has_more',coalesce(rev,0)>page_no*20);
end $fn$;
revoke all on function public.crm_work_request_objectives_read_v1(jsonb) from public,anon,service_role;
grant execute on function public.crm_work_request_objectives_read_v1(jsonb) to authenticated;


notify pgrst,'reload schema';
commit;
