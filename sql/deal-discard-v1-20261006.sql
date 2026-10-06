-- 과거 이관 · 분류 전 자료 삭제 v1 (2026-10-06 대표 "이런 현장은 좀 삭제할 수 있게 해줘")
-- 화면: pipeline-legacy.js(펼침 칸의 [이 자료 삭제]) · deal-discard.js · 상세 창 [···] 메뉴. 관리자만.
-- 지울 수 있는 것 = 열린 건(종료 아님 · 결과 없음)인데 현재 CRM 단계 값이 아닌 것(예전 리드 단계 · 단계 없음) — 화면의 PipelineScope.isLegacy 와 같은 규칙.
-- 하는 일(한 트랜잭션): ① 영업건 행 + 그 영업건을 가리키는 모든 하위 행(외래키 메타데이터로 찾는다)을 crm_security.manual_delete_backup 에 JSON 백업
--                       ② 계약실적 · 수주 · 종료 기록 · 첨부 · 확장관리 · 공종 합치기 · ASQ 연결 · 견적문의 연결이 있으면 거절(실적 · 문의 보존)
--                       ③ RESTRICT · NO ACTION 하위 행은 직접 삭제, 나머지는 영업건 삭제에 따라 CASCADE · SET NULL  ④ crm_security.audit_events 에 'discard' 기록
-- 복구: 백업의 table_name 별 row 를 원래 표에 다시 넣는다(영업건 먼저). 다시 실행해도 안전(create or replace).
-- 운영 적용: Supabase SQL 편집기에서 대표가 Run. 다른 표 · 자료는 건드리지 않는다.

create or replace function public.crm_deal_discard_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 a record; d public.deals%rowtype; fk record;
 v_id uuid; v_ver integer; v_reason text; v_batch text; n integer; total integer:=0; kids jsonb:='{}'::jsonb;
 known text[]:=array['first_contact','consulting','sent','rapport','silent','waiting','compete','imminent','bidding','contract','construction','completion','won','lost','badfit_lead','badfit','badfit_pipe','nocontact','expansion'];
 guard text[]:=array['contract_sales','deal_won_events','deal_close_events','deal_attachments','expansion_pool','expansion_pool_events','gongjong_merges','crm_asq_project_links','inquiries'];
begin
 select * into a from crm_security.actor();
 if not found or a.permission_role<>'admin' then raise exception '과거 이관 자료 삭제는 관리자만 할 수 있습니다' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 begin v_id:=(p->>'deal_id')::uuid; v_ver:=nullif(p->>'expected_version','')::integer;
 exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 if v_id is null then raise exception 'invalid payload' using errcode='22023'; end if;
 v_reason:=left(btrim(coalesce(p->>'reason','')),300); if v_reason='' then v_reason:='과거 이관 자료 정리'; end if;
 select * into d from public.deals x where x.id=v_id for update;
 if not found then raise exception '영업건을 찾을 수 없습니다' using errcode='P0002'; end if;
 if v_ver is not null and d.version is distinct from v_ver then raise exception '다른 곳에서 먼저 바뀐 자료입니다 — 새로 고친 뒤 다시 해 주세요' using errcode='PT409'; end if;
 if d.lifecycle_status='closed' or d.outcome is not null or (d.stage_code is not null and d.stage_code=any(known)) then
  raise exception '과거 이관 · 분류 전 자료만 지울 수 있습니다(진행 · 수주 · 실주 건은 삭제하지 않습니다)' using errcode='PT409';
 end if;
 if d.origin_inquiry_id is not null then raise exception '견적문의에서 만들어진 자료는 삭제할 수 없습니다' using errcode='PT409'; end if;
 v_batch:='deal-discard-'||to_char(now() at time zone 'Asia/Seoul','YYYYMMDD');
 -- 영업건을 가리키는 모든 외래키(한 칸짜리) 순서대로: 보호 표면 거절 → 백업 → RESTRICT · NO ACTION 이면 직접 삭제
 for fk in
  select distinct ns.nspname as sch, c.relname as tbl, att.attname as col, k.confdeltype as del
  from pg_catalog.pg_constraint k
  join pg_catalog.pg_class c on c.oid=k.conrelid
  join pg_catalog.pg_namespace ns on ns.oid=c.relnamespace
  join pg_catalog.pg_attribute att on att.attrelid=k.conrelid and att.attnum=k.conkey[1]
  where k.contype='f' and k.confrelid='public.deals'::regclass and array_length(k.conkey,1)=1
  order by 1,2,3
 loop
  execute format('select count(*) from %I.%I t where t.%I=$1',fk.sch,fk.tbl,fk.col) into n using v_id;
  if n>0 then
   if fk.tbl=any(guard) then
    raise exception '% 기록이 연결된 자료는 삭제할 수 없습니다 (%건) — 연결을 먼저 풀거나 그대로 두세요', fk.tbl, n using errcode='PT409';
   end if;
   execute format('insert into crm_security.manual_delete_backup(batch,table_name,row) select $1,%L,to_jsonb(t) from %I.%I t where t.%I=$2',fk.sch||'.'||fk.tbl,fk.sch,fk.tbl,fk.col) using v_batch,v_id;
   kids:=kids||jsonb_build_object(fk.sch||'.'||fk.tbl||'.'||fk.col,n); total:=total+n;
   if fk.del in ('r','a') then execute format('delete from %I.%I where %I=$1',fk.sch,fk.tbl,fk.col) using v_id; end if;
  end if;
 end loop;
 insert into crm_security.manual_delete_backup(batch,table_name,row) values(v_batch,'public.deals',to_jsonb(d));
 insert into crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 values(a.auth_uid,a.user_id,a.display_name,v_id,'discard',to_jsonb(d),jsonb_build_object('batch',v_batch,'child_rows',total,'children',kids,'site',d.list_name,'stage_code',d.stage_code),v_reason,now());
 delete from public.deals where id=v_id;
 get diagnostics n=row_count; if n<>1 then raise exception 'deal discard delete mismatch'; end if;
 return jsonb_build_object('ok',true,'deal_id',v_id,'batch',v_batch,'child_rows',total,'children',kids,'server_at',now());
end $fn$;
revoke all on function public.crm_deal_discard_v1(jsonb) from public, anon;
grant execute on function public.crm_deal_discard_v1(jsonb) to authenticated;
