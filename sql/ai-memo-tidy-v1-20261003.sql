-- AI 제안 종류 추가 (2026-10-03): memo_tidy — 모바일 통화 결과 창에서 말로 남긴 메모를 정리(요약 · 결과 분류 · 다음 할 일 제안)
-- 다시 실행해도 안전. 기존 제안 행은 그대로. 운영 적용: Supabase SQL 편집기에서 대표가 Run.
-- 적용 뒤 서버 함수 crm-ai 가 memo_tidy 를 저장할 수 있다(함수 자체는 따로 재배포).

alter table public.ai_suggestions drop constraint if exists ai_suggestions_kind_check;
alter table public.ai_suggestions add constraint ai_suggestions_kind_check
 check (kind in ('work_guess','ask_parse','report_text','dup_judge','next_action','call_opener','memo_tidy'));

create or replace function public.crm_ai_suggestion_save_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare a record; t public.ai_suggestions%rowtype; v_kind text; v_type text; v_id text; v_hash text;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if not coalesce((select (s.value)::text='true' from public.crm_settings s where s.key='ai_enabled'),false) then
  raise exception 'AI 제안이 꺼져 있습니다' using errcode='42501';
 end if;
 v_kind:=coalesce(p->>'kind',''); v_type:=nullif(btrim(coalesce(p->>'subject_type','')),''); v_id:=nullif(btrim(coalesce(p->>'subject_id','')),''); v_hash:=nullif(btrim(coalesce(p->>'input_hash','')),'');
 if v_kind not in ('work_guess','ask_parse','report_text','dup_judge','next_action','call_opener','memo_tidy') or v_type is null or v_id is null or v_hash is null
    or length(v_type)>40 or length(v_id)>200 or length(v_hash)>128 or jsonb_typeof(p->'suggestion')<>'object'
    or pg_catalog.octet_length((p->'suggestion')::text)>20000 or length(coalesce(p->>'model',''))>80 then
  raise exception 'invalid payload' using errcode='22023';
 end if;
 insert into public.ai_suggestions(kind,subject_type,subject_id,input_hash,suggestion,model,created_by)
  values(v_kind,v_type,v_id,v_hash,p->'suggestion',nullif(p->>'model',''),a.user_id)
  on conflict (kind,subject_type,subject_id,input_hash) do update set suggestion=public.ai_suggestions.suggestion
  returning * into t;
 return jsonb_build_object('ok',true,'suggestion',to_jsonb(t));
end $fn$;
revoke all on function public.crm_ai_suggestion_save_v1(jsonb) from public, anon;
grant execute on function public.crm_ai_suggestion_save_v1(jsonb) to authenticated;

create or replace function public.crm_ai_suggestion_list_v1(p jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare a record; v_kind text;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 v_kind:=coalesce(p->>'kind','');
 if v_kind not in ('work_guess','ask_parse','report_text','dup_judge','next_action','call_opener','memo_tidy') then raise exception 'invalid payload' using errcode='22023'; end if;
 return jsonb_build_object('ok',true,'suggestions',coalesce((
  select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
   select s.* from public.ai_suggestions s
   where s.kind=v_kind
     and (nullif(p->>'subject_type','') is null or s.subject_type=p->>'subject_type')
     and (jsonb_typeof(p->'subject_ids')<>'array' or p->'subject_ids' is null or s.subject_id in (select jsonb_array_elements_text(p->'subject_ids')))
     and (nullif(p->>'status','') is null or s.status=p->>'status')
   order by s.created_at desc limit least(greatest(coalesce(nullif(p->>'limit','')::int,200),1),1000)) x),'[]'::jsonb));
end $fn$;
revoke all on function public.crm_ai_suggestion_list_v1(jsonb) from public, anon;
grant execute on function public.crm_ai_suggestion_list_v1(jsonb) to authenticated;
