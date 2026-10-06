-- 실주 건 다시 열기 v1 (2026-10-06 · design_handoff_inquiry_site — 대표 "[새 공사로 진행 / 실주 건 다시 열기]")
-- 같은 단지에서 같은 공사가 다시 문의됐을 때, 실주로 닫힌 영업건을 다시 진행으로 올려 이력을 이어 간다.
-- 지금까지는 닫힌 영업건을 다시 여는 길이 없었다(단계 전환 명령은 종료 건을 거절한다). 이 함수는 실주 건에서만 동작한다.
--   · 대상: 실주(outcome='lost' · stage_code='lost' · lifecycle_status='closed')로 닫힌 영업건만. 수주 · Bad Fit · 연락두절 · 진행 중인 건은 거절.
--   · 꼭 받는 것: 새 단계(to) + 다음 행동(next_action) + 날짜(next_date · 오늘 이후) + 다시 여는 이유(note).
--       새 단계는 컨설팅 설계 ~ 입찰까지(consulting · sent · rapport · silent · compete · imminent · bidding). 계약 이후 단계로는 바로 올리지 않는다.
--   · 하는 일: 단계 · 묶음 · 진행 상태를 되돌리고(outcome · closed_at · lost_reason · lost_kind 비움), 열려 있던 다음 할 일은 취소하고 새로 하나 만든다.
--   · 남기는 기록: 단계 이력(stage_history · lost → 새 단계) · 활동(단계전환) · 감사(audit_events — 닫혔을 때의 값과 실주 때 적은 내용을 그대로 보존).
--       실주 때 적은 내용(stage_contexts.lost)은 지우지도 고치지도 않는다.
--   · 건드리지 않는 것: 담당 · 금액 · 공종 · 견적 버전 · 계약 원장(contract_sales) · 다른 영업건 · 문의.
--       문의를 이 영업건에 붙이는 것은 화면이 기존 함수(crm_inquiry_site_link_v1 · 같은 공사)로 따로 저장한다.
--   · 다시 연 건은 실주 수에서 빠진다(실주했다가 다시 열었다는 사실은 위 세 기록에 남는다).
-- 권한: 역할(rep/branch/admin) + 담당 범위(crm_security.can_deal 쓰기). 그사이 내용이 바뀌었으면(version) PT409.
-- 다시 실행해도 안전(create or replace). 운영 적용: Supabase SQL 편집기에서 대표가 Run. 화면은 CRMRelease 게이트로 함수가 있을 때만 버튼을 연다.

create or replace function public.crm_deal_reopen_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 a record; oldrow public.deals%rowtype; newrow public.deals%rowtype;
 v_id uuid; v_ver integer; v_to text; v_title text; v_due date; v_note text; v_inq uuid;
 v_at timestamptz:=clock_timestamp(); v_today date:=(clock_timestamp() at time zone 'Asia/Seoul')::date;
 v_group text; v_owner text; v_email text; v_cancelled jsonb:='[]'::jsonb;
 v_next uuid; v_hist uuid; v_act uuid; v_audit uuid;
begin
 select * into a from crm_security.actor();
 if not found or a.permission_role not in ('rep','branch','admin') then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 begin
  v_id:=(p->>'deal_id')::uuid; v_ver:=(p->>'expected_version')::integer; v_due:=(p->>'next_date')::date;
  v_inq:=nullif(btrim(coalesce(p->>'inquiry_id','')),'')::uuid;
 exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 v_to:=nullif(btrim(coalesce(p->>'to','')),'');
 v_title:=nullif(btrim(coalesce(p->>'next_action','')),'');
 v_note:=nullif(btrim(coalesce(p->>'note','')),'');
 if v_id is null or v_ver is null or v_ver<0 then raise exception 'invalid payload' using errcode='22023'; end if;
 if v_to is null or v_to not in ('consulting','sent','rapport','silent','compete','imminent','bidding') then raise exception '다시 열 단계를 골라 주세요' using errcode='22023'; end if;
 if v_title is null or length(v_title)>200 then raise exception '다음 행동을 적어 주세요(200자 이내)' using errcode='22023'; end if;
 if v_due is null or v_due<v_today then raise exception '다음 행동 날짜는 오늘 이후로 정해 주세요' using errcode='22023'; end if;
 if v_note is null or length(v_note)>2000 then raise exception '다시 여는 이유를 적어 주세요' using errcode='22023'; end if;
 select * into oldrow from public.deals d where d.id=v_id for update;
 if not found then raise exception '영업건을 찾을 수 없습니다' using errcode='22023'; end if;
 if not crm_security.can_deal(v_id,true) then raise exception '이 영업건의 담당자 또는 관리자만 다시 열 수 있습니다' using errcode='42501'; end if;
 if oldrow.version is distinct from v_ver then raise exception '그사이 내용이 바뀌었습니다. 창을 다시 열어 주세요' using errcode='PT409'; end if;
 if oldrow.outcome is distinct from 'lost' or oldrow.stage_code is distinct from 'lost' or oldrow.lifecycle_status is distinct from 'closed' then
  raise exception '실주로 닫힌 영업건만 다시 열 수 있습니다' using errcode='22023';
 end if;
 if v_inq is not null and not exists(select 1 from public.inquiries i where i.id=v_inq) then raise exception '문의를 찾을 수 없습니다' using errcode='22023'; end if;
 select u.name into v_owner from public.users u where u.user_id=oldrow.owner_id;
 v_owner:=nullif(btrim(coalesce(v_owner,oldrow.assignee_name,'')),'');
 if v_owner is null then raise exception '담당자가 없는 영업건입니다. 담당을 먼저 정해 주세요' using errcode='22023'; end if;
 select u.email into v_email from public.users u where u.user_id=a.user_id;
 v_group:=case when v_to='consulting' then 'design' when v_to='sent' then 'sent' when v_to in ('rapport','silent') then 'rel' else 'comp' end;

 select coalesce(jsonb_agg(n.id order by n.created_at),'[]'::jsonb) into v_cancelled from public.next_actions n where n.deal_id=v_id and n.status='open';
 update public.next_actions n set status='cancelled',updated_at=v_at where n.deal_id=v_id and n.status='open';
 insert into public.next_actions(deal_id,action_type,title,due_at,assignee_name,status,created_at,updated_at)
  values(v_id,'후속접촉',v_title,v_due::timestamp at time zone 'Asia/Seoul',v_owner,'open',v_at,v_at)
  returning id into v_next;
 insert into public.stage_history(opportunity_id,from_stage,to_stage,reason,actor_id,actor_name,changed_at)
  values(v_id,'lost',v_to,'실주 건 다시 열기 · '||v_note,a.user_id,a.display_name,v_at)
  returning id into v_hist;
 insert into public.activities(deal_id,organization_id,actor_email,actor_name,type,detail,occurred_at)
  values(v_id,oldrow.organization_id,v_email,a.display_name,'단계전환',
   jsonb_build_object('note',v_to,'result','실주 건 다시 열기 · '||v_note,'from_stage','lost','to_stage',v_to,'meaningful_contact',false,
    'reopened',true,'previous_closed_at',oldrow.closed_at,'inquiry_id',v_inq),v_at)
  returning id into v_act;
 update public.deals d
   set stage_code=v_to,stage_raw=v_to,stage_group=v_group,lifecycle_status='active',outcome=null,closed_at=null,lost_reason=null,lost_kind=null,
       stage_entered_at=v_at,last_activity_at=v_at,next_action=v_title,next_action_date=v_due,updated_at=v_at,version=coalesce(d.version,0)+1
  where d.id=v_id returning * into newrow;
 insert into crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
  values(a.auth_uid,a.user_id,a.display_name,v_id,'reopen',
   jsonb_build_object('version',oldrow.version,'stage_code',oldrow.stage_code,'stage_group',oldrow.stage_group,'lifecycle_status',oldrow.lifecycle_status,
    'outcome',oldrow.outcome,'closed_at',oldrow.closed_at,'lost_reason',oldrow.lost_reason,'lost_kind',oldrow.lost_kind,'lost_context',oldrow.stage_contexts->'lost',
    'next_action',oldrow.next_action,'next_action_date',oldrow.next_action_date),
   jsonb_build_object('version',newrow.version,'stage_code',newrow.stage_code,'stage_group',newrow.stage_group,'lifecycle_status',newrow.lifecycle_status,
    'outcome',newrow.outcome,'next_action',newrow.next_action,'next_action_date',newrow.next_action_date,'next_action_id',v_next,
    'cancelled_action_ids',v_cancelled,'stage_history_id',v_hist,'activity_id',v_act,'inquiry_id',v_inq),
   '실주 건 다시 열기 · '||v_note,v_at)
  returning event_id into v_audit;
 return jsonb_build_object('ok',true,'deal_id',v_id,'previous_version',oldrow.version,'version',newrow.version,'from_stage','lost','to_stage',v_to,
  'stage_group',v_group,'next_action',v_title,'next_action_date',v_due,'next_action_id',v_next,'stage_history_id',v_hist,'activity_id',v_act,
  'audit_event_id',v_audit,'server_at',v_at);
end $fn$;
revoke all on function public.crm_deal_reopen_v1(jsonb) from public, anon;
grant execute on function public.crm_deal_reopen_v1(jsonb) to authenticated;
