-- 이 단지 영업 이력 v1 (2026-10-05 대표 핸드오프 design_handoff_site_history · 영업건 상세 왼쪽 '이 단지 영업 이력')
-- 타임라인 줄의 수정 · 추가 · 삭제를 저장한다.
--   · 수기 줄(source='manual'): CRM 밖 과거 공사를 그 단지에 직접 적어 둔 것.
--   · CRM 줄(source='crm', deal_id): 그 영업건이 '이력'에 보이는 모습(공종 · 결과 · 날짜 · 금액 · 담당 · 설명)을 고쳐 적은 것.
--     영업건 자체(단계 · 종료 상태 · 예상/수주 금액 · 담당 · 계약 원장)는 이 함수로 바뀌지 않는다 — 이력 표시만 바뀐다.
--     삭제 = 이력에서 숨김(hidden=true). 영업건을 지우지 않는다. 지금 보는 건은 삭제할 수 없다.
--   · 저장 · 삭제 · 추가마다 지금 보는 영업건의 응대 이력에 '이력 수정' 시스템 기록 + 감사 기록(이전 값 보존).
--   · 결과가 실주면 실주 원인(분류 · 세부 사유) 필수. 결과가 수주면 금액은 낙찰금액(VAT 별도)으로 적는다.
-- 같은 단지 = deals.site_id. 중복으로 연결된 현장은 화면이 같은 단지로 묶은 영업건 목록(deal_ids)을 넘겨 함께 읽는다.
-- 권한: 읽기 = 승인된 직원, 쓰기 = 역할(rep/branch/admin) + 지금 보는 영업건의 쓰기 권한(crm_security.can_deal).

create table if not exists crm_security.site_history_entries(
 id uuid primary key default gen_random_uuid(),
 site_id uuid not null,
 deal_id uuid null references public.deals(id) on delete cascade,
 source text not null check(source in ('manual','crm')),
 work text,
 result text check(result is null or result in ('진행','수주','실주','보류','배드핏')),
 when_text text,
 amount bigint check(amount is null or amount>=0),
 owner_name text,
 note text,
 lost_reason text,
 hidden boolean not null default false,
 version integer not null default 1,
 created_by uuid, created_by_name text, created_at timestamptz not null default now(),
 updated_by uuid, updated_by_name text, updated_at timestamptz not null default now(),
 check((source='crm')=(deal_id is not null))
);
create unique index if not exists site_history_entries_deal_uq on crm_security.site_history_entries(deal_id) where deal_id is not null;
create index if not exists site_history_entries_site_ix on crm_security.site_history_entries(site_id);
alter table crm_security.site_history_entries enable row level security;
revoke all on crm_security.site_history_entries from public, anon, authenticated;

create or replace function public.crm_site_history_list_v1(p jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare a record; v_id uuid; v_ids uuid[]; v_sites uuid[];
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 begin
  v_id:=(p->>'deal_id')::uuid;
  select coalesce(array_agg(x::uuid),'{}'::uuid[]) into v_ids
   from jsonb_array_elements_text(case when jsonb_typeof(p->'deal_ids')='array' then p->'deal_ids' else '[]'::jsonb end) x;
 exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 if v_id is null or coalesce(array_length(v_ids,1),0)>60 then raise exception 'invalid payload' using errcode='22023'; end if;
 v_ids:=v_ids||v_id;
 select coalesce(array_agg(distinct d.site_id),'{}'::uuid[]) into v_sites from public.deals d where d.id=any(v_ids) and d.site_id is not null;
 return jsonb_build_object('ok',true,'entries',coalesce((
  select jsonb_agg(jsonb_build_object('id',h.id,'site_id',h.site_id,'deal_id',h.deal_id,'source',h.source,'work',h.work,'result',h.result,'when_text',h.when_text,
    'amount',h.amount,'owner_name',h.owner_name,'note',h.note,'lost_reason',h.lost_reason,'hidden',h.hidden,'version',h.version,
    'updated_by_name',h.updated_by_name,'created_at',h.created_at,'updated_at',h.updated_at) order by h.created_at)
  from crm_security.site_history_entries h where h.site_id=any(v_sites) or h.deal_id=any(v_ids)),'[]'::jsonb));
end $fn$;
revoke all on function public.crm_site_history_list_v1(jsonb) from public, anon;
grant execute on function public.crm_site_history_list_v1(jsonb) to authenticated;

create or replace function public.crm_site_history_write_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 a record; cur public.deals%rowtype; tgt public.deals%rowtype;
 old crm_security.site_history_entries%rowtype; neu crm_security.site_history_entries%rowtype;
 v_op text; v_cur uuid; v_entry uuid; v_target uuid; f jsonb; v_found boolean:=false; v_site uuid;
 v_work text; v_result text; v_when text; v_amount bigint; v_owner text; v_note text; v_lost text; v_summary text; v_kind text;
 v_at timestamptz:=clock_timestamp(); v_act uuid; v_audit uuid; v_email text; v_detail jsonb;
begin
 select * into a from crm_security.actor();
 if not found or a.permission_role not in ('rep','branch','admin') then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 v_op:=p->>'op';
 begin
  v_cur:=(p->>'deal_id')::uuid; v_entry:=nullif(p->>'entry_id','')::uuid; v_target:=nullif(p->>'target_deal_id','')::uuid;
 exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 v_summary:=nullif(btrim(coalesce(p->>'summary','')),'');
 if v_op is null or v_op not in ('save','delete') or v_cur is null or v_summary is null or length(v_summary)>600 then raise exception 'invalid payload' using errcode='22023'; end if;
 select * into cur from public.deals d where d.id=v_cur;
 if not found then raise exception '영업건을 찾을 수 없습니다' using errcode='22023'; end if;
 if not crm_security.can_deal(v_cur,true) then raise exception 'forbidden' using errcode='42501'; end if;
 if v_entry is not null then
  select * into old from crm_security.site_history_entries h where h.id=v_entry for update;
  if not found then raise exception '이력 줄을 찾을 수 없습니다. 창을 다시 열어 주세요' using errcode='PT409'; end if;
  v_found:=true; v_target:=old.deal_id;
 elsif v_target is not null then
  select * into old from crm_security.site_history_entries h where h.deal_id=v_target for update;
  v_found:=found;
 end if;
 if v_target is not null then
  select * into tgt from public.deals d where d.id=v_target;
  if not found then raise exception '영업건을 찾을 수 없습니다' using errcode='22023'; end if;
 end if;
 v_site:=coalesce(case when v_found then old.site_id end,tgt.site_id,cur.site_id);
 if v_site is null then raise exception '현장이 연결되지 않은 영업건입니다 — 현장을 연결한 뒤에 이력을 고칠 수 있습니다' using errcode='22023'; end if;
 if v_op='delete' then
  if v_target is not null and v_target=v_cur then raise exception '지금 보는 건은 삭제할 수 없습니다' using errcode='22023'; end if;
  if not v_found and v_target is null then raise exception 'invalid payload' using errcode='22023'; end if;
  if v_found then
   update crm_security.site_history_entries h set hidden=true,version=h.version+1,updated_by=a.user_id,updated_by_name=a.display_name,updated_at=v_at
    where h.id=old.id returning * into neu;
  else
   insert into crm_security.site_history_entries(site_id,deal_id,source,hidden,created_by,created_by_name,created_at,updated_by,updated_by_name,updated_at)
    values(v_site,v_target,'crm',true,a.user_id,a.display_name,v_at,a.user_id,a.display_name,v_at) returning * into neu;
  end if;
  v_kind:='삭제';
 else
  f:=p->'fields';
  if jsonb_typeof(f) is distinct from 'object' or length(f::text)>3000 then raise exception 'invalid payload' using errcode='22023'; end if;
  v_work:=nullif(btrim(coalesce(f->>'work','')),''); v_result:=f->>'result';
  v_when:=nullif(btrim(coalesce(f->>'when_text','')),''); v_owner:=nullif(btrim(coalesce(f->>'owner_name','')),'');
  v_note:=nullif(btrim(coalesce(f->>'note','')),''); v_lost:=nullif(btrim(coalesce(f->>'lost_reason','')),'');
  if v_work is null then raise exception '공종을 적어 주세요' using errcode='22023'; end if;
  if v_result is null or v_result not in ('진행','수주','실주','보류','배드핏') then raise exception '결과를 골라 주세요' using errcode='22023'; end if;
  if length(v_work)>80 or length(coalesce(v_when,''))>40 or length(coalesce(v_owner,''))>40 or length(coalesce(v_note,''))>200 or length(coalesce(v_lost,''))>120 then
   raise exception '내용이 너무 깁니다' using errcode='22023';
  end if;
  if jsonb_typeof(f->'amount') in ('number','string') then
   begin v_amount:=(f->>'amount')::bigint; exception when others then raise exception '금액은 0 이상의 숫자로 적어 주세요' using errcode='22023'; end;
   if v_amount<0 then raise exception '금액은 0 이상의 숫자로 적어 주세요' using errcode='22023'; end if;
  elsif f ? 'amount' and jsonb_typeof(f->'amount') is distinct from 'null' then
   raise exception '금액은 0 이상의 숫자로 적어 주세요' using errcode='22023';
  end if;
  if v_result='실주' and v_lost is null then raise exception '실주 원인을 골라 주세요' using errcode='22023'; end if;
  if v_result<>'실주' then v_lost:=null; end if;
  if v_found then
   update crm_security.site_history_entries h set work=v_work,result=v_result,when_text=v_when,amount=v_amount,owner_name=v_owner,note=v_note,lost_reason=v_lost,
     hidden=false,version=h.version+1,updated_by=a.user_id,updated_by_name=a.display_name,updated_at=v_at
    where h.id=old.id returning * into neu;
   v_kind:='수정';
  else
   insert into crm_security.site_history_entries(site_id,deal_id,source,work,result,when_text,amount,owner_name,note,lost_reason,created_by,created_by_name,created_at,updated_by,updated_by_name,updated_at)
    values(v_site,v_target,case when v_target is null then 'manual' else 'crm' end,v_work,v_result,v_when,v_amount,v_owner,v_note,v_lost,
     a.user_id,a.display_name,v_at,a.user_id,a.display_name,v_at) returning * into neu;
   v_kind:=case when v_target is null then '추가' else '수정' end;
  end if;
 end if;
 select u.email into v_email from public.users u where u.user_id=a.user_id;
 v_detail:=jsonb_build_object('note','이 단지 영업 이력 '||v_kind||coalesce(' · '||coalesce(neu.work,old.work,nullif(btrim(coalesce(p->'before'->>'work','')),'')),''),
  'result',v_summary,'meaningful_contact',false,'site_history_entry_id',neu.id);
 insert into public.activities(deal_id,organization_id,actor_email,actor_name,type,detail,occurred_at)
  values(v_cur,cur.organization_id,v_email,a.display_name,'이력 수정',v_detail,v_at) returning id into v_act;
 insert into crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
  values(a.auth_uid,a.user_id,a.display_name,v_cur,'site_history_'||v_op,
   jsonb_build_object('entry',case when v_found then to_jsonb(old) end,'shown',case when jsonb_typeof(p->'before')='object' then p->'before' end),
   jsonb_build_object('entry',to_jsonb(neu),'activity_id',v_act),
   '이 단지 영업 이력 '||v_kind,v_at) returning event_id into v_audit;
 return jsonb_build_object('ok',true,'op',v_op,
  'entry',jsonb_build_object('id',neu.id,'site_id',neu.site_id,'deal_id',neu.deal_id,'source',neu.source,'work',neu.work,'result',neu.result,'when_text',neu.when_text,
   'amount',neu.amount,'owner_name',neu.owner_name,'note',neu.note,'lost_reason',neu.lost_reason,'hidden',neu.hidden,'version',neu.version,
   'updated_by_name',neu.updated_by_name,'created_at',neu.created_at,'updated_at',neu.updated_at),
  'activity',jsonb_build_object('id',v_act,'occurred_at',v_at,'type','이력 수정','actor_name',a.display_name,'detail',v_detail),
  'audit_event_id',v_audit,'server_at',v_at);
end $fn$;
revoke all on function public.crm_site_history_write_v1(jsonb) from public, anon;
grant execute on function public.crm_site_history_write_v1(jsonb) to authenticated;
