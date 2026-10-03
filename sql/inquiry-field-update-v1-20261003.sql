-- 견적문의 정보 바로 입력 v1 (2026-10-03 핸드오프 inquiry_v2: 상세 창의 빈 칸을 "미입력 · 눌러서 입력"으로 그 자리에서 채운다)
-- 관리자 또는 그 문의의 담당자(assigned_to)만. 허용 항목만, 값은 200자 이내. 감사(inquiry_audit_events) 기록.
-- 열 항목(문의자 · 연락처 · 현장 주소 · 현장명)은 열에, 나머지(업체 · 공종 · 상담 채널 · 유입 경로 · 응대)는 raw jsonb 에 접수 시트와 같은 키로 넣는다 — 화면은 raw 의 그 키를 읽는다.
-- 다시 실행해도 안전. 운영 적용: Supabase SQL 편집기에서 대표가 Run. 화면은 CRMRelease 게이트로 이 함수가 있을 때만 입력 칸을 연다.

create or replace function public.crm_inquiry_field_update_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 a record; oldq public.inquiries%rowtype; newq public.inquiries%rowtype;
 v_id uuid; v_field text; v_value text; v_at timestamptz:=clock_timestamp(); v_audit uuid; v_rawkey text;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 begin v_id:=(p->>'inquiry_id')::uuid; exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 v_field:=nullif(btrim(coalesce(p->>'field','')),'');
 v_value:=nullif(btrim(coalesce(p->>'value','')),'');
 if v_id is null or v_field is null or v_value is null or length(v_value)>200 then raise exception 'invalid payload' using errcode='22023'; end if;
 if v_field not in ('contact_name','phone','address','site_name','customer_type','work_type','channel','inflow','responder') then raise exception 'invalid payload' using errcode='22023'; end if;
 select * into oldq from public.inquiries i where i.id=v_id for update;
 if not found then raise exception '문의를 찾을 수 없습니다' using errcode='22023'; end if;
 if a.permission_role<>'admin' and (oldq.assigned_to is null or oldq.assigned_to<>a.user_id) then
  raise exception '담당자 또는 관리자만 입력할 수 있습니다' using errcode='42501';
 end if;
 if coalesce(oldq.status,'') in ('종결','종료','수주','실주') then raise exception '종결된 문의는 수정할 수 없습니다' using errcode='22023'; end if;
 v_rawkey:=case v_field when 'customer_type' then '고객유형' when 'work_type' then '공사유형' when 'channel' then '상담채널' when 'inflow' then '유입경로' when 'responder' then '전화 응대자' else null end;
 if v_field='contact_name' then update public.inquiries i set contact_name=v_value, updated_at=v_at where i.id=v_id returning * into newq;
 elsif v_field='phone' then update public.inquiries i set phone=v_value, updated_at=v_at where i.id=v_id returning * into newq;
 elsif v_field='address' then update public.inquiries i set address=v_value, updated_at=v_at where i.id=v_id returning * into newq;
 elsif v_field='site_name' then update public.inquiries i set site_name=v_value, updated_at=v_at where i.id=v_id returning * into newq;
 else update public.inquiries i set raw=coalesce(case when jsonb_typeof(i.raw)='object' then i.raw else '{}'::jsonb end,'{}'::jsonb)||jsonb_build_object(v_rawkey,v_value), updated_at=v_at where i.id=v_id returning * into newq;
 end if;
 insert into crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
  values(a.auth_uid,a.user_id,v_id,'field_update',to_jsonb(oldq),to_jsonb(newq)||jsonb_build_object('field',v_field),'상세 창 빈 칸 입력: '||v_field,v_at)
  returning event_id into v_audit;
 return jsonb_build_object('ok',true,'inquiry_id',v_id,'field',v_field,'value',v_value,'raw_key',v_rawkey,'updated_at',v_at,'inquiry_audit_event_id',v_audit);
end $fn$;
revoke all on function public.crm_inquiry_field_update_v1(jsonb) from public, anon;
grant execute on function public.crm_inquiry_field_update_v1(jsonb) to authenticated;
