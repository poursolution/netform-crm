-- 견적문의 상담 종결 v1 (2026-10-01 대표 "상담만 하는 경우·협약 관련은 추적 안 해도 된다")
-- 견적까지 가지 않고 상담으로 끝난 문의를 '종결'로 닫는다. 영업건 전환·휴지통과 다르게 문의 기록은 그대로 두고 추적 화면에서만 빠진다.
-- 관리자, 또는 그 문의의 담당자(assigned_to)만 실행. 사유 필수. 이전 상태를 close_reason에 남기고 감사(inquiry_audit_events) 기록.

create or replace function public.crm_inquiry_close_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 a record; oldq public.inquiries%rowtype; newq public.inquiries%rowtype;
 v_id uuid; v_reason text; v_kind text; v_at timestamptz:=clock_timestamp(); v_audit uuid;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 begin v_id:=(p->>'inquiry_id')::uuid; exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 v_reason:=nullif(btrim(coalesce(p->>'reason','')),'');
 v_kind:=coalesce(nullif(btrim(coalesce(p->>'kind','')),''),'상담만');
 if v_id is null or v_reason is null or length(v_reason)>2000 then raise exception 'invalid payload' using errcode='22023'; end if;
 if v_kind not in ('상담만','협약','기타') then raise exception 'invalid payload' using errcode='22023'; end if;
 select * into oldq from public.inquiries i where i.id=v_id for update;
 if not found then raise exception '문의를 찾을 수 없습니다' using errcode='22023'; end if;
 if a.permission_role<>'admin' and (oldq.assigned_to is null or oldq.assigned_to<>a.user_id) then
  raise exception '담당자 또는 관리자만 종결할 수 있습니다' using errcode='42501';
 end if;
 -- 운영 inquiries에는 휴지통 열이 없다(2026-10-01 실행 오류 42703으로 확인) — 휴지통 판정은 화면 패치에서만 한다
 if coalesce(oldq.status,'') in ('종결','종료','수주','실주') then raise exception '이미 종결된 문의입니다' using errcode='22023'; end if;
 if oldq.deal_id is not null or oldq.opportunity_id is not null then raise exception '영업건으로 전환된 문의는 영업건에서 처리합니다' using errcode='22023'; end if;
 update public.inquiries i set status='종결',
   close_reason=v_kind||' 종결 — '||v_reason||' · 이전 상태: '||coalesce(nullif(btrim(coalesce(i.status,'')),''),'없음'),
   next_action_date=null, updated_at=v_at
  where i.id=v_id returning * into newq;
 insert into crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
  values(a.auth_uid,a.user_id,v_id,'close',to_jsonb(oldq),to_jsonb(newq)||jsonb_build_object('close_kind',v_kind),v_reason,v_at)
  returning event_id into v_audit;
 return jsonb_build_object('ok',true,'inquiry_id',v_id,'status',newq.status,'close_reason',newq.close_reason,'closed_at',v_at,'inquiry_audit_event_id',v_audit);
end $fn$;
revoke all on function public.crm_inquiry_close_v1(jsonb) from public, anon;
grant execute on function public.crm_inquiry_close_v1(jsonb) to authenticated;
