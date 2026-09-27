-- 영업이사 문의 배정 v1 (2026-09-28 대표 "영업이사 배정하는 것도 만들어줘")
-- 기존 영업이사(외부 영업)는 CRM 로그인 계정이 없다 → 일반 배정(direct_assign: 로그인·권한 검토 필수)으로는 저장 불가.
-- 경남지사 인계와 같은 방식으로 '이름으로 배정': inquiries.assigned_to=NULL, assignee_name=이사 이름, 경로=본사 관리.
-- 대상은 crm_security.sales_directors(관리자 관리 명단)만. 관리자만 실행. 이력(assignment_history)·감사(inquiry_audit_events) 기록.

create table if not exists crm_security.sales_directors(
  name text primary key check (length(btrim(name)) between 1 and 40),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
revoke all on crm_security.sales_directors from public, anon, authenticated;
insert into crm_security.sales_directors(name) values ('전용성'),('조성용') on conflict (name) do nothing;

create or replace function public.crm_inquiry_director_assign_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 a record; oldq public.inquiries%rowtype; newq public.inquiries%rowtype;
 v_id uuid; v_to text; v_reason text; v_at timestamptz:=clock_timestamp(); v_hist uuid; v_audit uuid; v_had boolean;
begin
 select * into a from crm_security.actor();
 if not found or a.permission_role<>'admin' then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 begin v_id:=(p->>'inquiry_id')::uuid; exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 v_to:=nullif(btrim(coalesce(p->>'to_name','')),'');
 v_reason:=nullif(btrim(coalesce(p->>'reason','')),'');
 if v_id is null or v_to is null then raise exception 'invalid payload' using errcode='22023'; end if;
 if not exists(select 1 from crm_security.sales_directors d where d.name=v_to and d.active) then
  raise exception '영업이사 배정 대상이 아닙니다' using errcode='42501';
 end if;
 select * into oldq from public.inquiries i where i.id=v_id for update;
 if not found then raise exception '문의를 찾을 수 없습니다' using errcode='22023'; end if;
 v_had:=oldq.assigned_to is not null or nullif(btrim(coalesce(oldq.assignee_name,'')),'') is not null;
 if v_had and coalesce(oldq.assignee_name,'') is distinct from v_to and v_reason is null then
  raise exception '재배정 사유가 필요합니다' using errcode='22023';
 end if;
 update public.inquiries i set assigned_to=null, assignee_name=v_to, assigned_at=v_at,
   status=case when coalesce(i.status,'') ~ '^(접수|신규|영업배정 필요)' then '배정완료' else i.status end,
   updated_at=v_at
  where i.id=v_id returning * into newq;
 insert into crm_security.inquiry_routing(inquiry_id,consultant_user_id,branch_code,routing_group,updated_by_auth_uid,updated_by_user_id,updated_at)
  values(v_id,null,null,'head_office',a.auth_uid,a.user_id,v_at)
  on conflict(inquiry_id) do update set branch_code=null,routing_group='head_office',
   updated_by_auth_uid=excluded.updated_by_auth_uid,updated_by_user_id=excluded.updated_by_user_id,updated_at=excluded.updated_at;
 insert into public.assignment_history(inquiry_id,from_owner,to_owner,reason,actor_name,changed_at)
  values(v_id,coalesce(nullif(btrim(coalesce(oldq.assignee_name,'')),''),'미배정'),v_to,coalesce(v_reason,'영업이사 배정'),a.display_name,v_at)
  returning id into v_hist;
 insert into crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
  values(a.auth_uid,a.user_id,v_id,case when v_had then 'direct_reassign' else 'direct_assign' end,
   to_jsonb(oldq),to_jsonb(newq)||jsonb_build_object('director_assign',true),coalesce(v_reason,'영업이사 배정'),v_at)
  returning event_id into v_audit;
 return jsonb_build_object('ok',true,'inquiry_id',v_id,'assignee_name',v_to,'assigned_to',null,'status',newq.status,
  'assigned_at',v_at,'assignment_history_id',v_hist,'inquiry_audit_event_id',v_audit);
end $fn$;
revoke all on function public.crm_inquiry_director_assign_v1(jsonb) from public, anon;
grant execute on function public.crm_inquiry_director_assign_v1(jsonb) to authenticated;
