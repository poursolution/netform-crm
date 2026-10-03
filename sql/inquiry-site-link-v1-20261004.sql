-- 견적문의 목록 v2 시안 반영 (2026-10-04)
-- ① crm_inquiry_site_link_v1 (새 함수): 같은 현장에 영업건이 이미 있을 때 "같은 공사(기존 영업건에 붙이기) / 새 공사" 판단을 문의에 남긴다.
--    판단은 raw jsonb 의 '기존 현장 판단'('같은 공사' | '새 공사') · '기존 영업건'(영업건 id)에만 적는다 — 영업건 · 계약실적 · 담당은 건드리지 않는다.
--    관리자 또는 그 문의의 담당자만. 종결된 문의는 바꿀 수 없다. 감사(inquiry_audit_events) 기록. decision='clear' 로 되돌린다.
-- ② crm_inquiry_field_update_v1 (v1.2 로 교체): 필수 확인 9개 가운데 여기서 바로 적는 4칸 추가 — 공사 시기 · 경쟁사 · 요청 자료 · 결정권자(raw 의 같은 이름 키).
-- 다시 실행해도 안전. 운영 적용: Supabase SQL 편집기에서 대표가 Run. 화면은 CRMRelease 게이트로 ① 함수가 있을 때만 판단 버튼 · 새 4칸을 연다.

create or replace function public.crm_inquiry_site_link_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 a record; oldq public.inquiries%rowtype; newq public.inquiries%rowtype;
 v_id uuid; v_dec text; v_deal text; v_at timestamptz:=clock_timestamp(); v_audit uuid; v_raw jsonb; v_found boolean;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 begin v_id:=(p->>'inquiry_id')::uuid; exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 v_dec:=nullif(btrim(coalesce(p->>'decision','')),'');
 v_deal:=nullif(btrim(coalesce(p->>'deal_id','')),'');
 if v_id is null or v_dec is null or v_dec not in ('same','new','clear') then raise exception 'invalid payload' using errcode='22023'; end if;
 if v_dec='same' and (v_deal is null or length(v_deal)>80) then raise exception '붙일 영업건을 골라 주세요' using errcode='22023'; end if;
 select * into oldq from public.inquiries i where i.id=v_id for update;
 if not found then raise exception '문의를 찾을 수 없습니다' using errcode='22023'; end if;
 if a.permission_role<>'admin' and (oldq.assigned_to is null or oldq.assigned_to<>a.user_id) then
  raise exception '담당자 또는 관리자만 정할 수 있습니다' using errcode='42501';
 end if;
 if coalesce(oldq.status,'') in ('종결','종료','수주','실주') then raise exception '종결된 문의는 수정할 수 없습니다' using errcode='22023'; end if;
 if v_dec='same' then
  select exists(select 1 from public.deals d where d.id::text=v_deal) into v_found;
  if not v_found then raise exception '영업건을 찾을 수 없습니다' using errcode='22023'; end if;
 end if;
 v_raw:=coalesce(case when jsonb_typeof(oldq.raw)='object' then oldq.raw else '{}'::jsonb end,'{}'::jsonb) - '기존 현장 판단' - '기존 영업건';
 if v_dec='same' then v_raw:=v_raw||jsonb_build_object('기존 현장 판단','같은 공사','기존 영업건',v_deal);
 elsif v_dec='new' then v_raw:=v_raw||jsonb_build_object('기존 현장 판단','새 공사');
 end if;
 update public.inquiries i set raw=v_raw, updated_at=v_at where i.id=v_id returning * into newq;
 insert into crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
  values(a.auth_uid,a.user_id,v_id,'field_update',to_jsonb(oldq),to_jsonb(newq)||jsonb_build_object('field','site_link','decision',v_dec,'deal_id',v_deal),'기존 현장 판단: '||v_dec||coalesce(' · '||v_deal,''),v_at)
  returning event_id into v_audit;
 return jsonb_build_object('ok',true,'inquiry_id',v_id,'decision',v_dec,'deal_id',case when v_dec='same' then v_deal else null end,'updated_at',v_at,'inquiry_audit_event_id',v_audit);
end $fn$;
revoke all on function public.crm_inquiry_site_link_v1(jsonb) from public, anon;
grant execute on function public.crm_inquiry_site_link_v1(jsonb) to authenticated;

-- ② 빈 칸 바로 입력 v1.2 — 허용 항목에 공사 시기 · 경쟁사 · 요청 자료 · 결정권자 추가(나머지는 v1.1 그대로)
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
 if v_field not in ('contact_name','phone','address','site_name','customer_type','work_type','channel','inflow','responder','meeting_date','reply_due','timing','competitor','requested_material','keyman') then raise exception 'invalid payload' using errcode='22023'; end if;
 if v_field in ('meeting_date','reply_due') and v_value !~ '^\d{4}-\d{2}-\d{2}$' then raise exception '날짜는 YYYY-MM-DD 형식이어야 합니다' using errcode='22023'; end if;
 select * into oldq from public.inquiries i where i.id=v_id for update;
 if not found then raise exception '문의를 찾을 수 없습니다' using errcode='22023'; end if;
 if a.permission_role<>'admin' and (oldq.assigned_to is null or oldq.assigned_to<>a.user_id) then
  raise exception '담당자 또는 관리자만 입력할 수 있습니다' using errcode='42501';
 end if;
 if coalesce(oldq.status,'') in ('종결','종료','수주','실주') then raise exception '종결된 문의는 수정할 수 없습니다' using errcode='22023'; end if;
 v_rawkey:=case v_field when 'customer_type' then '고객유형' when 'work_type' then '공사유형' when 'channel' then '상담채널' when 'inflow' then '유입경로' when 'responder' then '전화 응대자' when 'meeting_date' then '대표회의' when 'reply_due' then '자료 회신 기한'
  when 'timing' then '공사 시기' when 'competitor' then '경쟁사' when 'requested_material' then '요청 자료' when 'keyman' then '결정권자' else null end;
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
