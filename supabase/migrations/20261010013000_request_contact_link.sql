-- Reuse an already persisted inquiry contact and task. No new contact/task or backfill.
begin;
create table if not exists crm_security.work_request_contact_links (
 request_id uuid not null references crm_security.work_requests(id),
 log_id uuid not null references crm_security.inquiry_contact_logs(id),
 next_action_id uuid not null,
 actor_user_id uuid not null,
 policy_version text not null default 'basic-contact-link-v1',
 request_snapshot jsonb not null,
 contact_snapshot jsonb not null,
 task_snapshot jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(request_id,log_id)
);
alter table crm_security.work_request_contact_links enable row level security;
revoke all on crm_security.work_request_contact_links from public,anon,authenticated,service_role;

create or replace function public.crm_work_request_contact_link_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 a record; r crm_security.work_requests%rowtype; q public.inquiries%rowtype;
 l crm_security.inquiry_contact_logs%rowtype; n public.next_actions%rowtype;
 rid uuid; lid uuid; qid uuid; tid uuid; candidates uuid[]; since_at timestamptz; at_time timestamptz:=clock_timestamp();
 previous_request jsonb; why text; linked boolean:=false; replayed boolean:=false;
begin
 select * into a from crm_security.actor();
 if not found or a.permission_role not in ('admin','rep','consultation') then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' or p-array['id','log_id']<>'{}'::jsonb then raise exception 'invalid payload' using errcode='22023'; end if;
 begin rid:=(p->>'id')::uuid; lid:=(p->>'log_id')::uuid;
 exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 if rid is null or lid is null then raise exception 'invalid payload' using errcode='22023'; end if;
 select * into r from crm_security.work_requests where id=rid;
 if not found or r.target_type<>'inquiry' or r.to_scope<>'user' or r.to_user_id is distinct from a.user_id then raise exception 'forbidden' using errcode='42501'; end if;
 begin qid:=r.target_id::uuid; exception when others then raise exception 'invalid target' using errcode='22023'; end;
 -- Same lock order as the atomic contact writer: inquiry, request, existing task.
 select * into q from public.inquiries where id=qid for update;
 if not found or q.assigned_to is distinct from a.user_id or not crm_security.can_inquiry(qid) then raise exception 'forbidden' using errcode='42501'; end if;
 select * into r from crm_security.work_requests where id=rid for update;
 if r.target_type<>'inquiry' or r.target_id<>qid::text or r.to_scope<>'user' or r.to_user_id is distinct from a.user_id then raise exception 'forbidden' using errcode='42501'; end if;
 if (select e.action from crm_security.inquiry_audit_events e where e.inquiry_id=qid and e.action in ('inquiry_trash','inquiry_restore','inquiry_purge') order by e.created_at desc,e.event_id desc limit 1) in ('inquiry_trash','inquiry_purge') then raise exception 'forbidden' using errcode='42501'; end if;
 since_at:=greatest(r.created_at,coalesce(r.reasked_at,r.created_at));
 if r.status not in ('sent','seen','working') then why:='request_closed';
 elsif r.kind<>'first' or r.label<>'첫 연락 요청' or r.asks is distinct from '["고객 첫 연락"]'::jsonb then why:='unsupported_objectives';
 elsif coalesce(q.status,'') in ('종결','종료','수주','실주','배드핏','연락두절','협약완료','해결완료','영업전환') or q.deal_id is not null or q.opportunity_id is not null or q.qualified_at is not null then why:='stage_review';
 end if;
 select * into l from crm_security.inquiry_contact_logs where id=lid for share;
 if why is null and (not found or l.inquiry_id is distinct from qid or l.actor_user_id is distinct from a.user_id or l.actor_auth_uid is distinct from a.auth_uid
  or not isfinite(l.occurred_at) or l.occurred_at<since_at or l.created_at<since_at or l.occurred_at>at_time
  or ((l.kind='connected' and l.contact_result in ('연결됨','고객 회신')) or (l.kind='attempt' and l.contact_result='부재')) is not true)
 then why:='contact_proof_missing'; end if;
 if why is null and exists(select 1 from crm_security.inquiry_contact_logs x where x.inquiry_id=qid and (x.occurred_at,x.created_at,x.id)>(l.occurred_at,l.created_at,l.id)) then why:='newer_contact_exists'; end if;
 if why is null and exists(select 1 from crm_security.work_request_contact_links x where x.request_id=rid and x.log_id=lid) then
  replayed:=true; why:='already_linked';
 end if;
 if why is null then
  if coalesce(l.next_action,'') !~ '[^[:space:]]' or l.next_check_date is null or not isfinite(l.next_check_date) then why:='followup_proof_missing';
  else
   select array_agg(x.id) into candidates from public.next_actions x where x.inquiry_id=qid and x.deal_id is null
    and x.assignee_name=a.display_name and x.title=l.next_action and isfinite(x.due_at)
    and (x.due_at at time zone 'Asia/Seoul')::date=l.next_check_date
    and x.created_at>=l.occurred_at-interval '5 minutes'
    and (x.status='open' or (x.status='completed' and x.completed_at is not null and isfinite(x.completed_at)));
   if coalesce(array_length(candidates,1),0)<>1 then why:='followup_proof_missing';
   else
    tid:=candidates[1]; select * into n from public.next_actions where id=tid for update;
    -- Recheck after lock acquisition; do not trust the pre-lock candidate.
    if n.inquiry_id is distinct from qid or n.deal_id is not null or n.assignee_name is distinct from a.display_name or n.title is distinct from l.next_action
     or not isfinite(n.due_at) or (n.due_at at time zone 'Asia/Seoul')::date is distinct from l.next_check_date
     or n.created_at is null or n.created_at<l.occurred_at-interval '5 minutes'
     or not (n.status='open' or (n.status='completed' and n.completed_at is not null and isfinite(n.completed_at))) then why:='followup_proof_missing'; end if;
   end if;
  end if;
 end if;
 if why is null then
  previous_request:=to_jsonb(r);
  update crm_security.work_requests set status=case when l.kind='connected' then 'done' else 'working' end,
   result=l.result,next_text=l.next_action,next_due=l.next_check_date,seen_at=coalesce(seen_at,at_time),
   closed_at=case when l.kind='connected' then at_time else null end,updated_at=at_time,auto_done=true,
   replied_by_user_id=a.user_id,replied_by_name=a.display_name where id=rid returning * into r;
  insert into crm_security.work_request_contact_links(request_id,log_id,next_action_id,actor_user_id,request_snapshot,contact_snapshot,task_snapshot)
   values(rid,lid,tid,a.user_id,previous_request,to_jsonb(l),to_jsonb(n));
  linked:=true;
 end if;
 return jsonb_build_object('ok',true,'contract_version',1,'inquiry_id',qid,'log_id',lid,'linked',linked,'replayed',replayed,'reason',why,
  'next_action_id',tid,'request',crm_security.work_request_json(r,a.user_id,a.permission_role)||jsonb_build_object('to_user_id',r.to_user_id),'server_at',at_time);
end $fn$;
revoke all on function public.crm_work_request_contact_link_v1(jsonb) from public,anon,service_role;
grant execute on function public.crm_work_request_contact_link_v1(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
