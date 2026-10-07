-- 영업건 휴지통 v1 (2026-10-07 대표 "파이프라인 단계로 이관됐을 때 영업건 삭제하는 것도 만들어 줘 — 휴지통에 보관, 30일 뒤 삭제")
-- 무엇이 바뀌나
--  ① crm_deal_discard_v1(기존 이름 그대로 · 허용 목록 변경 없음): 지울 수 있는 범위를 '과거 이관 · 분류 전'에서
--     '예전 시스템에서 옮겨 온 열린 영업건'(relate_id 가 있거나 예전 단계 값)으로 넓힌다 — 영업 재개로 파이프라인 단계에 들어간 건도 보낼 수 있다.
--     수주 · 실주 · 종료 건, 견적문의에서 만든 건, CRM 에서 새로 만든 건(relate_id 없음 + CRM 단계)은 거절. 계약실적 · 수주 · 종료 기록 · 첨부 · 확장관리 · 공종 합치기 · ASQ · 견적문의 연결이 있으면 거절(그대로).
--     보관 = crm_security.manual_delete_backup(batch 'deal-trash-YYYYMMDD') — 영업건 행 + 그 영업건을 가리키는 모든 하위 행을 JSON 으로. 감사 기록 action 'discard'.
--  ② crm_deal_trash_list_v1(p{page}): 휴지통 목록(관리자) — 한 쪽 20건 · 보낸 날 · 보낸 사람 · 사유 · 남은 일수. 부를 때마다 30일 지난 것을 먼저 지운다(③).
--  ③ crm_deal_trash_purge_v1(): 보관 30일이 지난 휴지통 행 삭제(pg_cron 이 있으면 매일 03:20 에도 돈다 · 없으면 ② 가 부를 때).
--  ④ crm_deal_restore_v1(p{deal_id}): 복원(관리자) — 영업건 행을 먼저 넣고 하위 행을 외래키 메타데이터 순서로 되돌린다 · 휴지통에서 뺀다 · 감사 기록 action 'restore'.
--     (영업건 삭제 때 'SET NULL' 로 끊긴 하위 행은 그대로 남아 있어 복원해도 다시 연결되지 않는다 — 지금 그런 외래키는 없는 것으로 확인됨 · 있으면 응답의 children 에 0 으로 보인다)
-- 운영 적용: Supabase SQL 편집기에서 대표가 Run. 다시 실행해도 안전(create or replace). 자료는 바꾸지 않는다.
-- 화면: deal-discard.js(보내기) · deal-trash.js(휴지통 목록 · 복원) · 과거 이관 화면 머리 [휴지통] · 상세 [···] 메뉴 [휴지통으로 보내기]. 허용 목록: crm_deal_trash_list_v1 · crm_deal_restore_v1 추가.

-- ③ 30일 지난 휴지통 행 삭제
create or replace function public.crm_deal_trash_purge_v1()
returns integer language plpgsql volatile security definer set search_path='' as $fn$
declare n integer;
begin
 delete from crm_security.manual_delete_backup
  where (batch like 'deal-trash-%' or batch like 'deal-discard-%') and saved_at < now() - interval '30 days';
 get diagnostics n=row_count;
 return n;
end $fn$;
revoke all on function public.crm_deal_trash_purge_v1() from public, anon, authenticated;

-- ① 휴지통으로 보내기(기존 crm_deal_discard_v1 을 넓힌다)
create or replace function public.crm_deal_discard_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 a record; d public.deals%rowtype; fk record;
 v_id uuid; v_ver integer; v_reason text; v_batch text; n integer; total integer:=0; kids jsonb:='{}'::jsonb;
 known text[]:=array['first_contact','consulting','sent','rapport','silent','waiting','compete','imminent','bidding','contract','construction','completion','won','lost','badfit_lead','badfit','badfit_pipe','nocontact','expansion'];
 guard text[]:=array['contract_sales','deal_won_events','deal_close_events','deal_attachments','expansion_pool','expansion_pool_events','gongjong_merges','crm_asq_project_links','inquiries'];
begin
 select * into a from crm_security.actor();
 if not found or a.permission_role<>'admin' then raise exception '영업건을 휴지통으로 보내는 것은 관리자만 할 수 있습니다' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 begin v_id:=(p->>'deal_id')::uuid; v_ver:=nullif(p->>'expected_version','')::integer;
 exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 if v_id is null then raise exception 'invalid payload' using errcode='22023'; end if;
 v_reason:=left(btrim(coalesce(p->>'reason','')),300); if v_reason='' then v_reason:='휴지통으로 보냄'; end if;
 select * into d from public.deals x where x.id=v_id for update;
 if not found then raise exception '영업건을 찾을 수 없습니다' using errcode='P0002'; end if;
 if v_ver is not null and d.version is distinct from v_ver then raise exception '다른 곳에서 먼저 바뀐 자료입니다 — 새로 고친 뒤 다시 해 주세요' using errcode='PT409'; end if;
 if d.lifecycle_status='closed' or d.outcome is not null then
  raise exception '열린 영업건만 휴지통으로 보낼 수 있습니다(수주 · 실주 · 종료 건은 보내지 않습니다)' using errcode='PT409';
 end if;
 if d.origin_inquiry_id is not null then raise exception '견적문의에서 만들어진 자료는 휴지통으로 보낼 수 없습니다' using errcode='PT409'; end if;
 if d.relate_id is null and d.stage_code is not null and d.stage_code=any(known) then
  raise exception '예전 시스템에서 옮겨 온 자료만 휴지통으로 보낼 수 있습니다(CRM 에서 새로 만든 건은 실주 · 보류로 정리해 주세요)' using errcode='PT409';
 end if;
 v_batch:='deal-trash-'||to_char(now() at time zone 'Asia/Seoul','YYYYMMDD');
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
    raise exception '% 기록이 연결된 자료는 휴지통으로 보낼 수 없습니다 (%건) — 연결을 먼저 풀거나 그대로 두세요', fk.tbl, n using errcode='PT409';
   end if;
   execute format('insert into crm_security.manual_delete_backup(batch,table_name,row) select $1,%L,to_jsonb(t) from %I.%I t where t.%I=$2',fk.sch||'.'||fk.tbl,fk.sch,fk.tbl,fk.col) using v_batch,v_id;
   kids:=kids||jsonb_build_object(fk.sch||'.'||fk.tbl||'.'||fk.col,n); total:=total+n;
   if fk.del in ('r','a') then execute format('delete from %I.%I where %I=$1',fk.sch,fk.tbl,fk.col) using v_id; end if;
  end if;
 end loop;
 insert into crm_security.manual_delete_backup(batch,table_name,row) values(v_batch,'public.deals',to_jsonb(d));
 insert into crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 values(a.auth_uid,a.user_id,a.display_name,v_id,'discard',to_jsonb(d),jsonb_build_object('batch',v_batch,'child_rows',total,'children',kids,'site',d.list_name,'stage_code',d.stage_code,'expires_at',now()+interval '30 days','trash',true),v_reason,now());
 delete from public.deals where id=v_id;
 get diagnostics n=row_count; if n<>1 then raise exception 'deal discard delete mismatch'; end if;
 return jsonb_build_object('ok',true,'deal_id',v_id,'batch',v_batch,'child_rows',total,'children',kids,'expires_at',now()+interval '30 days','retention_days',30,'server_at',now());
end $fn$;
revoke all on function public.crm_deal_discard_v1(jsonb) from public, anon;
grant execute on function public.crm_deal_discard_v1(jsonb) to authenticated;

-- ② 휴지통 목록(관리자) — 부를 때마다 30일 지난 것을 먼저 지운다
create or replace function public.crm_deal_trash_list_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare a record; v_page integer; v_total integer; v_items jsonb; v_purged integer;
begin
 select * into a from crm_security.actor();
 if not found or a.permission_role<>'admin' then raise exception '휴지통은 관리자만 볼 수 있습니다' using errcode='42501'; end if;
 v_page:=greatest(1,coalesce(nullif(p->>'page','')::integer,1));
 v_purged:=public.crm_deal_trash_purge_v1();
 select count(*) into v_total from crm_security.manual_delete_backup b
  where b.table_name='public.deals' and (b.batch like 'deal-trash-%' or b.batch like 'deal-discard-%');
 select coalesce(jsonb_agg(jsonb_build_object(
   'deal_id',t.deal_id,'site',coalesce(t.row->>'list_name',''),'brand',coalesce(t.row->>'brand',''),'stage_code',coalesce(t.row->>'stage_code',''),'owner',coalesce(t.row->>'assignee_name',''),
   'amount',coalesce(t.row->>'expected_amount',t.row->>'amount',''),'created',coalesce(t.row->>'created_at',''),
   'trashed_at',t.saved_at,'expires_at',t.saved_at+interval '30 days',
   'days_left',greatest(0,ceil(extract(epoch from (t.saved_at+interval '30 days'-now()))/86400))::integer,
   'child_rows',(select count(*) from crm_security.manual_delete_backup c where c.batch=t.batch and c.table_name<>'public.deals' and c.row::text like '%'||t.deal_id::text||'%'),
   'by',(select e.actor_name from crm_security.audit_events e where e.deal_id=t.deal_id and e.action='discard' order by e.created_at desc limit 1),
   'reason',(select e.reason from crm_security.audit_events e where e.deal_id=t.deal_id and e.action='discard' order by e.created_at desc limit 1)
  ) order by t.saved_at desc),'[]'::jsonb) into v_items
 from (
  select b.batch,b.saved_at,b.row,(b.row->>'id')::uuid as deal_id from crm_security.manual_delete_backup b
  where b.table_name='public.deals' and (b.batch like 'deal-trash-%' or b.batch like 'deal-discard-%')
  order by b.saved_at desc limit 20 offset (v_page-1)*20
 ) t;
 return jsonb_build_object('ok',true,'total',v_total,'page',v_page,'per',20,'retention_days',30,'purged',v_purged,'items',v_items,'server_at',now());
end $fn$;
revoke all on function public.crm_deal_trash_list_v1(jsonb) from public, anon;
grant execute on function public.crm_deal_trash_list_v1(jsonb) to authenticated;

-- ④ 복원(관리자)
create or replace function public.crm_deal_restore_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare a record; b record; fk record; v_id uuid; v_batch text; n integer; total integer:=0; kids jsonb:='{}'::jsonb; d public.deals%rowtype;
begin
 select * into a from crm_security.actor();
 if not found or a.permission_role<>'admin' then raise exception '복원은 관리자만 할 수 있습니다' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 begin v_id:=(p->>'deal_id')::uuid; exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 if v_id is null then raise exception 'invalid payload' using errcode='22023'; end if;
 select * into b from crm_security.manual_delete_backup x
  where x.table_name='public.deals' and (x.batch like 'deal-trash-%' or x.batch like 'deal-discard-%') and (x.row->>'id')::uuid=v_id
  order by x.saved_at desc limit 1 for update;
 if not found then raise exception '휴지통에 없는 자료입니다(30일이 지나 지워졌거나 이미 복원됨)' using errcode='P0002'; end if;
 if exists(select 1 from public.deals x where x.id=v_id) then raise exception '이미 복원된 자료입니다' using errcode='PT409'; end if;
 v_batch:=b.batch;
 insert into public.deals select * from jsonb_populate_record(null::public.deals, b.row);
 select * into d from public.deals x where x.id=v_id;
 -- 하위 행: 영업건을 가리키는 외래키 순서대로 되돌린다(이미 있는 행은 건너뜀)
 for fk in
  select distinct ns.nspname as sch, c.relname as tbl, att.attname as col
  from pg_catalog.pg_constraint k
  join pg_catalog.pg_class c on c.oid=k.conrelid
  join pg_catalog.pg_namespace ns on ns.oid=c.relnamespace
  join pg_catalog.pg_attribute att on att.attrelid=k.conrelid and att.attnum=k.conkey[1]
  where k.contype='f' and k.confrelid='public.deals'::regclass and array_length(k.conkey,1)=1
  order by 1,2,3
 loop
  execute format('insert into %I.%I select (jsonb_populate_record(null::%I.%I, x.row)).* from crm_security.manual_delete_backup x where x.batch=$1 and x.table_name=$2 and x.row->>%L=$3 on conflict do nothing',fk.sch,fk.tbl,fk.sch,fk.tbl,fk.col) using v_batch,fk.sch||'.'||fk.tbl,v_id::text;
  get diagnostics n=row_count;
  if n>0 then kids:=kids||jsonb_build_object(fk.sch||'.'||fk.tbl||'.'||fk.col,n); total:=total+n; end if;
 end loop;
 delete from crm_security.manual_delete_backup x
  where x.batch=v_batch and ((x.table_name='public.deals' and (x.row->>'id')::uuid=v_id) or (x.table_name<>'public.deals' and x.row::text like '%'||v_id::text||'%'));
 insert into crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 values(a.auth_uid,a.user_id,a.display_name,v_id,'restore',jsonb_build_object('batch',v_batch),jsonb_build_object('child_rows',total,'children',kids,'site',d.list_name,'stage_code',d.stage_code),'휴지통에서 복원',now());
 return jsonb_build_object('ok',true,'deal_id',v_id,'batch',v_batch,'child_rows',total,'children',kids,'server_at',now());
end $fn$;
revoke all on function public.crm_deal_restore_v1(jsonb) from public, anon;
grant execute on function public.crm_deal_restore_v1(jsonb) to authenticated;

-- 매일 03:20 자동 삭제(pg_cron 이 설치돼 있을 때만 · 없으면 목록을 열 때 지운다)
do $cron$
begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  begin
   perform cron.schedule('crm-deal-trash-purge','20 3 * * *','select public.crm_deal_trash_purge_v1()');
  exception when others then raise notice 'pg_cron schedule skipped: %', sqlerrm;
  end;
 else
  raise notice 'pg_cron not installed — purge runs when the trash list is opened';
 end if;
end $cron$;

-- 확인(읽기 전용)
-- select proname from pg_proc where proname in ('crm_deal_discard_v1','crm_deal_trash_list_v1','crm_deal_restore_v1','crm_deal_trash_purge_v1');
