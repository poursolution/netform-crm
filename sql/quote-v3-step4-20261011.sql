-- 견적 기능 v3 · 4단계: 가산 → 고객 제출금액 확정 (2026-10-11 design_handoff_quote_v3 5번 · 대표 "둘 다 적용해서")
-- ★ 먼저 sql/quote-v3-step1-20261011.sql 을 Run 해야 합니다(견적 수정본에 base_amount 등 열이 있어야 함). 대표가 Supabase SQL 편집기에서 Run.
-- 하는 일: 영업건의 최신 견적 수정본(Vn)의 '적산 기준금액'에 가산을 붙여 새 수정본(Vn+1)을 만든다 — 덮어쓰지 않는다.
--   · 새 수정본의 amount = 고객 제출금액(= 파이프라인 · 리포트 · 발송이 읽는 '견적 금액'), base_amount = 적산 기준금액(원본 보존).
--   · 가산 방식은 같이 쓸 수 있다: 배수 → ㎡당 → 정액 순서로 적용한 뒤 10만원 아래 절삭(화면 quote-amounts.js 와 같은 순서).
--   · 화면이 계산한 금액(expected_submit)과 서버가 다시 계산한 금액이 다르면 저장하지 않는다(PT409) — 계산이 두 곳에서 갈라지는 것을 막는다.
--   · 이미 제출금액이 확정된 수정본에는 다시 가산하지 않는다(확정 · 보낸 견적은 자동 재계산 금지). 다시 하려면 새 기준금액 수정본에서.
--   · 담당 범위(crm_security.can_deal) · 역할(rep/branch/admin) 확인, 영업건 version +1, 감사(audit_events) 기록. 종료된 건은 거절.
-- 하지 않는 것: 기준금액 수정(영업 불가) · 발송 · 기준(노임 · 요율) 계산.

create or replace function public.crm_quote_submit_confirm_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 a record; oldrow public.deals%rowtype; newrow public.deals%rowtype; src crm_security.quote_versions%rowtype;
 v_id uuid; v_ver int; v_max int; v_items jsonb:='[]'::jsonb; v_in jsonb; it jsonb; v_t text; v_val numeric; v_area numeric;
 base numeric; raw numeric; nxt numeric; v_submit bigint; v_expected bigint; v_display text; v_note text; v_type text;
 v_cnt int:=0; v_desc text:=''; v_qid uuid; v_audit uuid; v_at timestamptz:=clock_timestamp(); v_reason text; v_single numeric; v_singlearea numeric;
begin
 select * into a from crm_security.actor();
 if not found or a.permission_role not in ('rep','branch','admin') then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 begin v_id:=(p->>'deal_id')::uuid; exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 begin v_expected:=(p->>'expected_submit')::bigint; exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 if p ? 'version_no' and nullif(p->>'version_no','') is not null then
  begin v_ver:=(p->>'version_no')::int; exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 end if;
 v_in:=p->'items';
 if v_id is null or v_expected is null or v_expected<=0 or jsonb_typeof(v_in) is distinct from 'array' or jsonb_array_length(v_in)>3 then
  raise exception 'invalid payload' using errcode='22023';
 end if;
 v_display:=coalesce(nullif(p->>'display',''),'line');
 if v_display not in ('line','melt') then raise exception 'invalid payload' using errcode='22023'; end if;
 v_note:=nullif(left(btrim(coalesce(p->>'note','')),500),'');

 select * into oldrow from public.deals d where d.id=v_id for update;
 if not found then raise exception '영업건을 찾을 수 없습니다' using errcode='22023'; end if;
 if not crm_security.can_deal(v_id,true) then raise exception 'forbidden' using errcode='42501'; end if;
 if oldrow.outcome is not null or oldrow.lifecycle_status='closed' then raise exception '종료된 영업건은 제출금액을 확정할 수 없습니다' using errcode='22023'; end if;

 select coalesce(max(q.version_no),0) into v_max from crm_security.quote_versions q where q.deal_id=v_id;
 if v_max=0 then raise exception '기준이 되는 견적 수정본이 없습니다. 먼저 견적을 등록해 주세요' using errcode='22023'; end if;
 if v_ver is not null and v_ver<>v_max then raise exception '더 새로운 견적 수정본이 있습니다. 상세를 다시 열어 주세요' using errcode='PT409'; end if;
 select * into src from crm_security.quote_versions q where q.deal_id=v_id and q.version_no=v_max;
 if src.submit_amount is not null then raise exception '이미 제출금액이 확정된 견적입니다. 새 기준금액 수정본에서 가산해 주세요' using errcode='PT409'; end if;
 base:=coalesce(src.base_amount,src.amount);
 if base is null or base<=0 then raise exception '적산 기준금액이 없습니다' using errcode='22023'; end if;

 -- 배수 → ㎡당 → 정액 (같은 방식은 한 번만)
 raw:=base;
 foreach v_t in array array['multiplier','area','flat'] loop
  it:=null;
  select e into it from jsonb_array_elements(v_in) e where e->>'type'=v_t limit 1;
  if it is null then continue; end if;
  if (select count(*) from jsonb_array_elements(v_in) e where e->>'type'=v_t)>1 then raise exception '같은 가산 방식은 한 번만 쓸 수 있습니다' using errcode='22023'; end if;
  begin v_val:=(it->>'value')::numeric; exception when others then raise exception 'invalid payload' using errcode='22023'; end;
  if v_val is null or v_val<0 or v_val>1000000000 then raise exception 'invalid payload' using errcode='22023'; end if;
  v_cnt:=v_cnt+1;
  if v_t='multiplier' then
   if v_val<=0 then raise exception '배수를 넣어 주세요' using errcode='22023'; end if;
   nxt:=raw*v_val; v_desc:=v_desc||case when v_desc='' then '' else ' · ' end||'배수 ×'||trim(trailing '.' from trim(trailing '0' from v_val::text));
   v_items:=v_items||jsonb_build_array(jsonb_build_object('type','multiplier','value',v_val));
   v_single:=v_val;
  elsif v_t='area' then
   begin v_area:=(it->>'area')::numeric; exception when others then raise exception 'invalid payload' using errcode='22023'; end;
   if v_area is null or v_area<=0 then raise exception '적용 면적(㎡)을 넣어 주세요' using errcode='22023'; end if;
   nxt:=raw+v_area*v_val; v_desc:=v_desc||case when v_desc='' then '' else ' · ' end||'㎡당 '||to_char(v_val,'FM999,999,999,990')||'원 × '||to_char(v_area,'FM999,999,990.##')||'㎡';
   v_items:=v_items||jsonb_build_array(jsonb_build_object('type','area','value',v_val,'area',v_area));
   v_single:=v_val; v_singlearea:=v_area;
  else
   nxt:=raw+v_val; v_desc:=v_desc||case when v_desc='' then '' else ' · ' end||'정액 +'||to_char(v_val,'FM999,999,999,990')||'원';
   v_items:=v_items||jsonb_build_array(jsonb_build_object('type','flat','value',v_val));
   v_single:=v_val;
  end if;
  raw:=nxt;
 end loop;
 if v_cnt=0 then v_desc:='가산 없음'; v_type:='none'; v_single:=null; v_singlearea:=null;
 elsif v_cnt=1 then v_type:=v_items->0->>'type';
 else v_type:='multi'; v_single:=null; v_singlearea:=null; end if;
 if (select count(*) from jsonb_array_elements(v_in) e where e->>'type' not in ('multiplier','area','flat','none'))>0 then
  raise exception 'invalid payload' using errcode='22023';
 end if;

 v_submit:=(floor(round(raw,2)/100000)*100000)::bigint;
 if v_submit<=0 then raise exception '제출금액이 0원 이하입니다' using errcode='22023'; end if;
 if v_submit<>v_expected then
  raise exception '화면과 서버의 계산이 다릅니다(화면 %원, 서버 %원). 화면을 새로 열어 주세요',v_expected,v_submit using errcode='PT409';
 end if;

 v_reason:='제출금액 확정 · 기준금액 '||to_char(base,'FM999,999,999,990')||'원 → '||to_char(v_submit,'FM999,999,999,990')||'원 ('||v_desc||', 10만원 아래 절삭)';
 insert into crm_security.quote_versions(deal_id,version_no,amount,reason,actor_auth_uid,actor_user_id,created_at,
   kind,base_amount,supply_amount,markup_type,markup_items,markup_value,markup_area,markup_display,markup_note,markup_by,markup_at,
   rounding_rule,submit_amount,alt_label,status,basis)
 values(v_id,v_max+1,v_submit,v_reason,a.auth_uid,a.user_id,v_at,
   src.kind,base::bigint,src.supply_amount,v_type,case when v_cnt=0 then null else v_items end,v_single,v_singlearea,v_display,v_note,a.display_name,v_at,
   'floor_100k',v_submit,src.alt_label,'final',src.basis)
 returning id into v_qid;
 update public.deals d set updated_at=v_at, version=coalesce(d.version,0)+1 where d.id=v_id returning * into newrow;
 insert into crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
  values(a.auth_uid,a.user_id,a.display_name,v_id,'quote_submit_confirm',
   jsonb_build_object('version',oldrow.version,'source_version_no',v_max,'base_amount',base),
   jsonb_build_object('version',newrow.version,'quote_version_id',v_qid,'version_no',v_max+1,'submit_amount',v_submit,'markup_type',v_type,'markup_items',v_items,'display',v_display),
   v_reason,v_at)
  returning event_id into v_audit;
 return jsonb_build_object('ok',true,'deal_id',v_id,'quote_version_id',v_qid,'version_no',v_max+1,'amount',v_submit,'base_amount',base::bigint,
  'submit_amount',v_submit,'added',v_submit-base::bigint,'markup_type',v_type,'markup_items',v_items,'display',v_display,'reason',v_reason,
  'version',newrow.version,'audit_event_id',v_audit,'server_at',v_at);
end $fn$;
revoke all on function public.crm_quote_submit_confirm_v1(jsonb) from public, anon;
grant execute on function public.crm_quote_submit_confirm_v1(jsonb) to authenticated;
