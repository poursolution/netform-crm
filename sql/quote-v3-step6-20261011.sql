-- 견적 기능 v3 · 6단계: 공법견적 · 간단견적 계산 + 견적 수정본 저장 (2026-10-11 design_handoff_quote_v3 6번)
-- ★ 먼저 step1 → step4 → step5 SQL 을 Run 해야 합니다(step5 는 공법 기준(method) 를 더한 최신판으로 다시 Run). 대표가 Supabase SQL 편집기에서 Run. 여러 번 실행해도 안전.
-- 하는 일:
--  ① crm_quote_compose_v1(p)  계산만 한다(저장 없음, 영업/팀장/관리자) — 공법 + 수량 → 공법 기준 × 견적일에 시행 중인 승인 기준(자재 단가 · 노임 · 요율) → 직접공사비 → 원가계산서 → 적산 기준금액.
--       화면(quote-compose.js)과 같은 순서 · 같은 절삭이다 — 서버가 다시 계산한 값이 화면과 다르면 저장하지 않는다(PT409).
--  ② crm_quote_version_save_v1(p) 담당자가 확정하면 새 견적 수정본(Vn+1)을 만든다 — 덮어쓰지 않는다.
--       amount = base_amount = 적산 기준금액(공법견적) 또는 합계(간단견적). 가산 → 고객 제출금액은 4단계 함수(crm_quote_submit_confirm_v1)가 이어서 한다.
--       0원 · 수량 0 견적은 저장 거절. 초안은 서버에 저장하지 않는다(파이프라인이 최신 수정본 금액을 읽기 때문).
-- 하지 않는 것: 기준금액 수정 · 가산 · 발송.

begin;

create or replace function public.crm_quote_compose_v1(p jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare
 a record; v_date date; it jsonb; ex jsonb; l jsonb; m jsonb; x jsonb; spec record; mrow record; lrow record; crow record;
 v_items jsonb; v_extras jsonb; area numeric; q numeric; pr numeric; um numeric; ul numeric; ue numeric; u_m numeric; u_l numeric; u_e numeric; price numeric;
 mat numeric:=0; lab numeric:=0; expn numeric:=0; extra numeric:=0; v_missing jsonb:='[]'::jsonb; v_rows jsonb:='[]'::jsonb; v_basis jsonb:='{}'::jsonb;
 gp numeric; pp numeric; dur numeric; v_health boolean; v_retire boolean;
 t_size text; t_period text; t_safety text; t_env text; tiers jsonb;
 R jsonb:='{}'::jsonb; k text; nm text; tr text; rate numeric;
 e8 numeric; e9 numeric; e12 numeric; e10 numeric; e11 numeric; e13 numeric; e14 numeric; e15 numeric:=0; e16 numeric:=0; e17 numeric:=0; e18 numeric; e19 numeric; e20 numeric; e21 numeric; e22 numeric; e23 numeric:=0; e24 numeric; e25 numeric; e26 numeric; e27 numeric; e28 numeric; e30 numeric;
 b_method date; b_mat date; b_lab date; b_cost date;
begin
 select * into a from crm_security.actor();
 if not found or a.permission_role not in ('rep','branch','admin') then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 begin v_date:=coalesce(nullif(p->>'date','')::date,(now() at time zone 'Asia/Seoul')::date); exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 v_items:=coalesce(p->'items','[]'::jsonb); v_extras:=coalesce(p->'extras','[]'::jsonb);
 if jsonb_typeof(v_items) is distinct from 'array' or jsonb_typeof(v_extras) is distinct from 'array' or jsonb_array_length(v_items)>30 or jsonb_array_length(v_extras)>60 then raise exception 'invalid payload' using errcode='22023'; end if;
 gp:=coalesce(nullif(p->>'generalPct','')::numeric,0); pp:=coalesce(nullif(p->>'profitPct','')::numeric,0);
 if gp<0 or gp>1 or pp<0 or pp>1 then raise exception 'invalid payload' using errcode='22023'; end if;
 tiers:=coalesce(p->'tiers','{}'::jsonb);
 t_size:=coalesce(nullif(tiers->>'size',''),'10억 미만'); t_period:=coalesce(nullif(tiers->>'period',''),'6개월 이하');
 t_safety:=coalesce(nullif(tiers->>'safety',''),'5억미만|건축공사'); t_env:=coalesce(nullif(tiers->>'env',''),'조경, 기타(전문, 개보수 공사)');
 v_retire:=coalesce((p->>'retire')::boolean,false);
 if p ? 'health' and jsonb_typeof(p->'health')='boolean' then v_health:=(p->>'health')::boolean;
 elsif nullif(p->>'durationDays','') is not null then v_health:=(p->>'durationDays')::numeric>=30;
 else v_health:=true; end if;

 for it in select value from jsonb_array_elements(v_items) loop
  area:=coalesce(nullif(it->>'area','')::numeric,0); if area<=0 then continue; end if;
  select s.* into spec from public.crm_method_specs s where s.method=it->>'method' and s.status<>'draft' and s.effective_from<=v_date order by s.effective_from desc limit 1;
  if not found then v_missing:=v_missing||jsonb_build_array('공법 기준 · '||(it->>'method')); continue; end if;
  if b_method is null or spec.effective_from>b_method then b_method:=spec.effective_from; end if;
  u_m:=0; u_l:=0; u_e:=0;
  for m in select value from jsonb_array_elements(coalesce(spec.composition->'materials','[]'::jsonb)) loop
   if m ? 'fixed' then price:=(m->>'fixed')::numeric;
   else
    select r.* into mrow from public.crm_material_prices r where r.item=m#>>'{ref,item}' and r.spec=coalesce(m#>>'{ref,spec}','') and r.status<>'draft' and r.price_date<=v_date order by r.price_date desc limit 1;
    if not found then v_missing:=v_missing||jsonb_build_array('자재 단가 · '||(m#>>'{ref,item}')||case when coalesce(m#>>'{ref,spec}','')<>'' then ' ('||(m#>>'{ref,spec}')||')' else '' end); continue; end if;
    if b_mat is null or mrow.price_date>b_mat then b_mat:=mrow.price_date; end if;
    price:=ceil(round(mrow.unit_price/coalesce(nullif(m#>>'{ref,divisor}','')::numeric,1),6)/100)*100;
   end if;
   u_m:=u_m+floor(round(price*(m->>'qty')::numeric,6));
  end loop;
  for l in select value from jsonb_array_elements(coalesce(spec.composition->'labor','[]'::jsonb)) loop
   select r.* into lrow from public.crm_labor_rates r where r.trade=l->>'trade' and r.status<>'draft' and r.effective_from<=v_date order by r.effective_from desc limit 1;
   if not found then v_missing:=v_missing||jsonb_build_array('노임 · '||(l->>'trade')); continue; end if;
   if b_lab is null or lrow.effective_from>b_lab then b_lab:=lrow.effective_from; end if;
   u_l:=u_l+floor(round(lrow.daily_wage*(l->>'qty')::numeric,6));
  end loop;
  for x in select value from jsonb_array_elements(coalesce(spec.composition->'misc','[]'::jsonb)) loop
   u_e:=u_e+floor(round((case when x->>'of'='lab' then u_l else u_m end)*(x->>'pct')::numeric,6));
  end loop;
  mat:=mat+floor(round(u_m*area,6)); lab:=lab+floor(round(u_l*area,6)); expn:=expn+floor(round(u_e*area,6));
  v_rows:=v_rows||jsonb_build_array(jsonb_build_object('kind','method','method',it->>'method','area',area,'unit',jsonb_build_object('mat',u_m,'lab',u_l,'exp',u_e)));
 end loop;
 for ex in select value from jsonb_array_elements(v_extras) loop
  q:=coalesce(nullif(ex->>'qty','')::numeric,0); pr:=coalesce(nullif(ex->>'price','')::numeric,0);
  if q>0 and pr>0 then extra:=extra+floor(round(q*pr,6)); v_rows:=v_rows||jsonb_build_array(jsonb_build_object('kind','extra','name',ex->>'name','qty',q,'price',pr)); end if;
 end loop;
 mat:=mat+extra;

 -- 원가 요율 12종 (견적일에 시행 중인 승인 기준)
 foreach k in array array['indirectLabor','accident','employment','health','pension','care','safety','asbestos','wageClaim','otherExp','environment','retire'] loop
  nm:=case k when 'indirectLabor' then '간접노무비' when 'accident' then '산재보험료' when 'employment' then '고용보험료' when 'health' then '건강보험료' when 'pension' then '연금보험료' when 'care' then '노인장기요양보험료' when 'safety' then '산업안전보건관리비' when 'asbestos' then '석면분담금' when 'wageClaim' then '임금채권부담금' when 'otherExp' then '기타경비' when 'environment' then '환경보전비' else '퇴직공제부금비' end;
  tr:=case when nm in ('간접노무비','기타경비') then t_size||'|'||t_period when nm='산업안전보건관리비' then t_safety when nm='환경보전비' then t_env else '' end;
  select r.* into crow from public.crm_cost_rates r where r.item=nm and r.tier=tr and r.status<>'draft' and r.effective_from<=v_date order by r.effective_from desc limit 1;
  if not found then v_missing:=v_missing||jsonb_build_array('원가 요율 · '||nm||case when tr<>'' then ' · '||tr else '' end); continue; end if;
  if b_cost is null or crow.effective_from>b_cost then b_cost:=crow.effective_from; end if;
  R:=R||jsonb_build_object(k,crow.rate);
 end loop;

 if jsonb_array_length(v_missing)>0 then
  return jsonb_build_object('ok',false,'missing',(select coalesce(jsonb_agg(distinct v),'[]'::jsonb) from jsonb_array_elements_text(v_missing) v),'rows',v_rows);
 end if;

 e8:=mat; e9:=lab; e12:=expn;
 e10:=floor(round(e9*(R->>'indirectLabor')::numeric,6)); e11:=e9+e10;
 e13:=floor(round(e11*(R->>'accident')::numeric,6)); e14:=floor(round(e11*(R->>'employment')::numeric,6));
 if v_health then e15:=floor(round(e9*(R->>'health')::numeric,6)); e16:=floor(round(e9*(R->>'pension')::numeric,6)); e17:=floor(round(e15*(R->>'care')::numeric,6)); end if;
 e18:=floor(round((e8+e9)*(R->>'safety')::numeric,6)); e19:=floor(round(e11*(R->>'asbestos')::numeric,6)); e20:=floor(round(e11*(R->>'wageClaim')::numeric,6));
 e21:=floor(round((e8+e11)*(R->>'otherExp')::numeric,6)); e22:=floor(round((e8+e9+e12)*(R->>'environment')::numeric,6));
 if v_retire then e23:=floor(round(e9*(R->>'retire')::numeric,6)); end if;
 e24:=e12+e13+e14+e15+e16+e17+e18+e19+e20+e21+e22+e23; e25:=e8+e11+e24;
 e26:=floor(round(e25*gp,6)); e27:=floor(round((e11+e24+e26)*pp,6)); e28:=e25+e26+e27; e30:=floor(e28/100000)*100000;
 return jsonb_build_object('ok',e30>0 and jsonb_array_length(v_rows)>0,'missing','[]'::jsonb,'rows',v_rows,'date',v_date,
  'basis',jsonb_strip_nulls(jsonb_build_object('method',b_method,'material',b_mat,'labor',b_lab,'cost',b_cost)),
  'sheet',jsonb_build_object('directMaterial',e8,'directLabor',e9,'indirectLabor',e10,'labor',e11,'expense',e12,'accident',e13,'employment',e14,'health',e15,'pension',e16,'care',e17,'safety',e18,'asbestos',e19,'wageClaim',e20,'otherExp',e21,'environment',e22,'retire',e23,'subtotalC',e24,'sum',e25,'general',e26,'profit',e27,'supply',e28,'rounding',e30-e28,'base',e30),
  'rates',R);
end $fn$;

create or replace function public.crm_quote_version_save_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 a record; oldrow public.deals%rowtype; newrow public.deals%rowtype; v_id uuid; v_kind text; v_expected bigint; v_max int; v_base numeric; v_supply numeric; v_calc jsonb;
 v_qid uuid; v_audit uuid; v_at timestamptz:=clock_timestamp(); v_reason text; v_basis jsonb; v_memo text; sx jsonb; v_total numeric:=0; v_n int:=0; v_desc text:='';
begin
 select * into a from crm_security.actor();
 if not found or a.permission_role not in ('rep','branch','admin') then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 begin v_id:=(p->>'deal_id')::uuid; v_expected:=(p->>'expected_base')::bigint; exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 v_kind:=p->>'kind'; v_memo:=nullif(left(btrim(coalesce(p->>'memo','')),500),'');
 if v_id is null or v_expected is null or v_expected<=0 or v_kind not in ('simple','method') then raise exception 'invalid payload' using errcode='22023'; end if;
 select * into oldrow from public.deals d where d.id=v_id for update;
 if not found then raise exception '영업건을 찾을 수 없습니다' using errcode='22023'; end if;
 if not crm_security.can_deal(v_id,true) then raise exception 'forbidden' using errcode='42501'; end if;
 if oldrow.outcome is not null or oldrow.lifecycle_status='closed' then raise exception '종료된 영업건은 견적을 저장할 수 없습니다' using errcode='22023'; end if;

 if v_kind='simple' then
  if jsonb_typeof(p->'simple_items') is distinct from 'array' or jsonb_array_length(p->'simple_items')=0 or jsonb_array_length(p->'simple_items')>80 then raise exception 'invalid payload' using errcode='22023'; end if;
  for sx in select value from jsonb_array_elements(p->'simple_items') loop
   if nullif(btrim(sx->>'name'),'') is null then raise exception '이름이 없는 항목이 있습니다' using errcode='22023'; end if;
   if coalesce((sx->>'qty')::numeric,0)<=0 or coalesce((sx->>'price')::numeric,0)<=0 then raise exception '수량 또는 단가가 0인 항목이 있습니다' using errcode='22023'; end if;
   v_total:=v_total+floor(round((sx->>'qty')::numeric*(sx->>'price')::numeric,6)); v_n:=v_n+1;
  end loop;
  v_base:=v_total; v_supply:=null; v_basis:=jsonb_build_object('simple_items',p->'simple_items');
  v_reason:='간단견적 · 항목 '||v_n||'개 · 합계 '||to_char(v_base,'FM999,999,999,990')||'원';
 else
  v_calc:=public.crm_quote_compose_v1(p - 'date');/* 견적일은 서버의 오늘(한국 시각) — 화면이 보낸 날짜는 쓰지 않는다 */
  if (v_calc->>'ok')::boolean is not true then
   if jsonb_array_length(coalesce(v_calc->'missing','[]'::jsonb))>0 then raise exception '승인된 기준이 없는 항목이 있습니다: %',(select string_agg(v,', ') from jsonb_array_elements_text(v_calc->'missing') v) using errcode='22023'; end if;
   raise exception '공종 수량이 없거나 금액이 0원입니다' using errcode='22023';
  end if;
  v_base:=(v_calc#>>'{sheet,base}')::numeric; v_supply:=(v_calc#>>'{sheet,supply}')::numeric;
  v_basis:=jsonb_build_object('dates',v_calc->'basis','sheet',v_calc->'sheet','rates',v_calc->'rates','work_items',p->'items','extras',coalesce(p->'extras','[]'::jsonb),
    'generalPct',p->'generalPct','profitPct',p->'profitPct','durationDays',p->'durationDays','retire',coalesce(p->'retire','false'::jsonb),'tiers',coalesce(p->'tiers','{}'::jsonb),'date',v_calc->'date');
  select string_agg((e->>'method')||' '||to_char((e->>'area')::numeric,'FM999,999,990.##')||'㎡',' · ') into v_desc from jsonb_array_elements(v_calc->'rows') e where e->>'kind'='method';
  v_reason:='공법견적 · '||coalesce(v_desc,'간단 항목만')||' · 적산 기준금액 '||to_char(v_base,'FM999,999,999,990')||'원';
 end if;
 if v_base is null or v_base<=0 then raise exception '금액이 0원입니다' using errcode='22023'; end if;
 if v_base::bigint<>v_expected then raise exception '화면과 서버의 계산이 다릅니다(화면 %원, 서버 %원). 화면을 새로 열어 주세요',v_expected,v_base::bigint using errcode='PT409'; end if;

 select coalesce(max(q.version_no),0) into v_max from crm_security.quote_versions q where q.deal_id=v_id;
 insert into crm_security.quote_versions(deal_id,version_no,amount,reason,actor_auth_uid,actor_user_id,created_at,kind,base_amount,supply_amount,status,basis,markup_note)
  values(v_id,v_max+1,v_base::bigint,v_reason,a.auth_uid,a.user_id,v_at,v_kind,v_base::bigint,v_supply::bigint,'final',v_basis,v_memo)
  returning id into v_qid;
 update public.deals d set updated_at=v_at, version=coalesce(d.version,0)+1 where d.id=v_id returning * into newrow;
 insert into crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
  values(a.auth_uid,a.user_id,a.display_name,v_id,'quote_version_save',
   jsonb_build_object('version',oldrow.version,'latest_quote_version',v_max),
   jsonb_build_object('version',newrow.version,'quote_version_id',v_qid,'version_no',v_max+1,'kind',v_kind,'base_amount',v_base),v_reason,v_at)
  returning event_id into v_audit;
 return jsonb_build_object('ok',true,'deal_id',v_id,'quote_version_id',v_qid,'version_no',v_max+1,'kind',v_kind,'amount',v_base::bigint,'base_amount',v_base::bigint,
  'supply_amount',v_supply,'reason',v_reason,'version',newrow.version,'audit_event_id',v_audit,'server_at',v_at);
end $fn$;

revoke all on function public.crm_quote_compose_v1(jsonb) from public, anon;
revoke all on function public.crm_quote_version_save_v1(jsonb) from public, anon;
grant execute on function public.crm_quote_compose_v1(jsonb) to authenticated;
grant execute on function public.crm_quote_version_save_v1(jsonb) to authenticated;

commit;
