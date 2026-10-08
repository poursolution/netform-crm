-- 견적문의 · 과거 메모의 통화 · 약속 확인 v1 (2026-10-08 대표 핸드오프 design_handoff_inquiry_memo)
-- 이관 메모에서 화면(규칙)이 찾은 '통화 후보'와 '약속 후보'에 담당이 내린 판단을 저장한다. 화면 파일: inquiry-memo.js
--   · call_supplement  메모 속 통화일로 '실제 연결일'을 보완한 기록. 첫 연락(최초응대) 판정 값 crm_security.inquiry_flow_state.first_connected_at 은 바꾸지 않는다
--                      (화면이 '실제 연결일'로 보여 주는 날짜만 따로 둔다). 원래 값(original_at)은 이 줄과 감사 기록(before_data)에 남는다.
--   · promise          메모에서 찾은 약속 한 줄의 판단 — 완료 · 미완료 · 확인 불가. 같은 약속을 다시 고르면 값을 바꾸고, 이전 값은 감사 기록에 남는다.
--                      '미완료 → 지금 할 일 등록'은 화면이 기존 다음 할 일 저장(inquiry_followup)으로 따로 한다 — 여기서는 판단만 적는다.
-- 쓰는 것: 새 곁표 crm_security.inquiry_memo_reviews + 감사 기록(inquiry_audit_events: flow_memo_call · flow_memo_promise).
--          public.inquiries · 응대 기록 · 영업건 · 계약 원장은 바꾸지 않는다.
-- 권한: 담당이 정해진 문의에서 그 문의의 담당자 또는 관리자(영업 · 상담). 읽기는 문의를 볼 수 있는 사람(crm_security.can_inquiry).
-- 여러 번 돌려도 같은 결과.

create table if not exists crm_security.inquiry_memo_reviews(
 id uuid primary key default gen_random_uuid(),
 inquiry_id uuid not null references public.inquiries(id) on delete cascade,
 kind text not null check(kind in ('call','promise')),
 item_key text not null check(length(item_key) between 1 and 120),
 title text not null default '' check(length(title)<=120),
 source_text text not null default '' check(length(source_text)<=600),
 on_date date,
 result text check(result is null or result in ('완료','미완료','확인 불가')),
 original_at timestamptz,
 decided_by_user_id uuid not null,
 decided_by text not null,
 decided_at timestamptz not null default clock_timestamp(),
 request_id uuid not null,
 unique(inquiry_id,kind,item_key),
 check((kind='call' and result is null and on_date is not null) or (kind='promise' and result is not null))
);
create index if not exists inquiry_memo_reviews_inquiry on crm_security.inquiry_memo_reviews(inquiry_id);
alter table crm_security.inquiry_memo_reviews enable row level security;
revoke all on crm_security.inquiry_memo_reviews from public, anon, authenticated;

-- 감사 기록의 허용 목록에 새 이름 둘만 더한다(기존 이름은 그대로 보존).
DO $migration$
DECLARE d text;
BEGIN
 SELECT pg_get_constraintdef(oid) INTO STRICT d FROM pg_constraint
 WHERE conrelid='crm_security.inquiry_audit_events'::regclass AND conname='inquiry_audit_events_action_check';
 IF position('flow_memo_call' in d)>0 AND position('flow_memo_promise' in d)>0 THEN RETURN; END IF;
 IF left(d,7)<>'CHECK (' OR right(d,1)<>')' THEN RAISE EXCEPTION 'UNEXPECTED_AUDIT_CONSTRAINT'; END IF;
 ALTER TABLE crm_security.inquiry_audit_events DROP CONSTRAINT inquiry_audit_events_action_check;
 EXECUTE 'ALTER TABLE crm_security.inquiry_audit_events ADD CONSTRAINT inquiry_audit_events_action_check CHECK (('
 ||substring(d from 8 for length(d)-8)||') OR action IN (''flow_memo_call'',''flow_memo_promise''))';
END $migration$;

create or replace function public.crm_inquiry_memo_review_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 a record; q public.inquiries%rowtype; r crm_security.inquiry_memo_reviews%rowtype; n crm_security.inquiry_memo_reviews%rowtype;
 v_type text; v_kind text; v_id uuid; v_rid uuid; v_at timestamptz:=clock_timestamp(); v_today date:=(clock_timestamp() at time zone 'Asia/Seoul')::date;
 v_key text; v_title text; v_src text; v_date date; v_res text; v_orig timestamptz; v_audit uuid; v_action text; v_found boolean;
begin
 select * into a from crm_security.actor();
 if not found or a.permission_role not in ('admin','rep','consultation') then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 v_type:=coalesce(p->>'type','');
 if v_type not in ('call_supplement','promise') then raise exception 'invalid payload' using errcode='22023'; end if;
 v_kind:=case v_type when 'call_supplement' then 'call' else 'promise' end;
 v_action:=case v_type when 'call_supplement' then 'flow_memo_call' else 'flow_memo_promise' end;
 begin v_id:=(p->>'inquiry_id')::uuid; v_rid:=(p->>'request_id')::uuid; exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 if v_id is null or v_rid is null then raise exception 'invalid payload' using errcode='22023'; end if;
 select * into q from public.inquiries i where i.id=v_id for update;
 if not found then raise exception '문의를 찾을 수 없습니다' using errcode='22023'; end if;
 if q.assigned_to is null then raise exception '담당이 정해진 문의에서만 저장할 수 있습니다' using errcode='22023'; end if;
 if a.permission_role<>'admin' and q.assigned_to<>a.user_id then raise exception '담당자 또는 관리자만 저장할 수 있습니다' using errcode='42501'; end if;
 if coalesce(q.inquiry_type,'')='기술자문' or coalesce(q.brand,'')='기술자문' then raise exception '기술자문 문의는 기술자문 화면에서 처리합니다' using errcode='22023'; end if;
 if not crm_security.can_inquiry(v_id) then raise exception 'forbidden' using errcode='42501'; end if;
 if (select e.action from crm_security.inquiry_audit_events e where e.inquiry_id=v_id
     and e.action in ('inquiry_trash','inquiry_restore','inquiry_purge') order by e.created_at desc,e.event_id desc limit 1)
     in ('inquiry_trash','inquiry_purge') then raise exception '문의를 찾을 수 없습니다' using errcode='22023'; end if;
 v_key:=btrim(coalesce(p->>'item_key',''));
 v_title:=left(btrim(coalesce(p->>'title','')),120);
 v_src:=left(btrim(coalesce(p->>'source_text','')),600);
 if length(v_key) not between 1 and 120 then raise exception 'invalid payload' using errcode='22023'; end if;
 begin v_date:=nullif(p->>'on_date','')::date; exception when others then raise exception '날짜는 YYYY-MM-DD 형식이어야 합니다' using errcode='22023'; end;
 begin v_orig:=nullif(p->>'original_at','')::timestamptz; exception when others then v_orig:=null; end;
 if v_type='call_supplement' then
  if v_date is null or v_date>v_today or v_date<date '2000-01-01' then raise exception 'invalid payload' using errcode='22023'; end if;
  v_res:=null;
 else
  v_res:=btrim(coalesce(p->>'result',''));
  if v_res not in ('완료','미완료','확인 불가') then raise exception 'invalid payload' using errcode='22023'; end if;
 end if;
 select * into r from crm_security.inquiry_memo_reviews x where x.inquiry_id=v_id and x.kind=v_kind and x.item_key=v_key;
 v_found:=found;
 -- 같은 요청을 다시 보내면 한 번만 남긴다
 if v_found and r.request_id=v_rid then
  return jsonb_build_object('ok',true,'type',v_type,'inquiry_id',v_id,'replayed',true,'server_at',v_at,
   'review',jsonb_build_object('kind',r.kind,'item_key',r.item_key,'title',r.title,'result',r.result,'on_date',r.on_date,'original_at',r.original_at,'decided_by',r.decided_by,'decided_at',r.decided_at));
 end if;
 insert into crm_security.inquiry_memo_reviews(inquiry_id,kind,item_key,title,source_text,on_date,result,original_at,decided_by_user_id,decided_by,decided_at,request_id)
  values(v_id,v_kind,v_key,v_title,v_src,v_date,v_res,v_orig,a.user_id,a.display_name,v_at,v_rid)
  on conflict (inquiry_id,kind,item_key) do update set title=excluded.title,source_text=excluded.source_text,on_date=excluded.on_date,result=excluded.result,
   original_at=coalesce(crm_security.inquiry_memo_reviews.original_at,excluded.original_at),decided_by_user_id=excluded.decided_by_user_id,decided_by=excluded.decided_by,decided_at=excluded.decided_at,request_id=excluded.request_id
  returning * into n;
 insert into crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
  values(a.auth_uid,a.user_id,v_id,v_action,
   case when v_found then jsonb_build_object('result',r.result,'on_date',r.on_date,'original_at',r.original_at,'decided_by',r.decided_by,'decided_at',r.decided_at)
        else jsonb_build_object('original_at',v_orig) end,
   jsonb_build_object('item_key',v_key,'title',v_title,'result',v_res,'on_date',v_date,'actor',a.display_name),
   case v_type when 'call_supplement' then '메모 속 통화로 실제 연결일 보완' else '과거 약속 확인 · '||v_res end,v_at)
  returning event_id into v_audit;
 return jsonb_build_object('ok',true,'type',v_type,'inquiry_id',v_id,'server_at',v_at,'inquiry_audit_event_id',v_audit,'actor_name',a.display_name,
  'review',jsonb_build_object('kind',n.kind,'item_key',n.item_key,'title',n.title,'result',n.result,'on_date',n.on_date,'original_at',n.original_at,'decided_by',n.decided_by,'decided_at',n.decided_at));
end $fn$;
revoke all on function public.crm_inquiry_memo_review_v1(jsonb) from public, anon;
grant execute on function public.crm_inquiry_memo_review_v1(jsonb) to authenticated;

-- 읽기: 문의를 볼 수 있는 사람에게 그 문의의 판단 줄을 내려 준다(휴지통 · 영구 삭제된 문의 제외).
create or replace function public.crm_inquiry_memo_review_list_v1(p jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare a record;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 return jsonb_build_object('ok',true,'server_at',clock_timestamp(),'reviews',coalesce((
  select jsonb_agg(jsonb_build_object('inquiry_id',x.inquiry_id,'kind',x.kind,'item_key',x.item_key,'title',x.title,'source_text',x.source_text,'on_date',x.on_date,
    'result',x.result,'original_at',x.original_at,'decided_by',x.decided_by,'decided_at',x.decided_at) order by x.decided_at)
  from crm_security.inquiry_memo_reviews x join public.inquiries i on i.id=x.inquiry_id
  where crm_security.can_inquiry(i.id) and coalesce((select e.action from crm_security.inquiry_audit_events e
    where e.inquiry_id=i.id and e.action in ('inquiry_trash','inquiry_restore','inquiry_purge')
    order by e.created_at desc,e.event_id desc limit 1),'') not in ('inquiry_trash','inquiry_purge')),'[]'::jsonb));
end $fn$;
revoke all on function public.crm_inquiry_memo_review_list_v1(jsonb) from public, anon;
grant execute on function public.crm_inquiry_memo_review_list_v1(jsonb) to authenticated;

NOTIFY pgrst, 'reload schema';
