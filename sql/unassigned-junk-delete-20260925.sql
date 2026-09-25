-- 기록 없는 미배정 영업건 일괄 삭제 (2026-09-25 · 대표 확정 '337건 모두 삭제')
-- 대상: 진행/대기 + 담당 없음 + 흔적 없음(금액·활동·문의 연결·견적 버전·첨부·다음 할 일·문자 결과·관계 이벤트·확장 기록·계약실적 전부 없음).
--   실측 337건(잠재고객 178 · Customers 61 · 황윤선 전체고객 33 …). 이 중 126건은 같은 현장에 다른 기록이 있는 중복,
--   삭제 시 고객 자산(아파트 명단)에서 다른 기록이 없는 약 113곳이 사라짐 — 대표 확인.
-- 백업: crm_security.manual_delete_backup batch='unassigned-junk-20260925' — 영업건 + 영업건을 참조하는 모든 하위 행(28개 연결)을 JSON으로.
-- 복구: 백업의 table_name별 row를 원래 테이블에 재삽입(영업건 먼저).
begin;
create table if not exists crm_security.manual_delete_backup(batch text, table_name text, row jsonb, saved_at timestamptz default now());

-- 1) 대상 고정 = 영업건 행 백업 (이후 모든 단계는 이 목록만 사용)
insert into crm_security.manual_delete_backup(batch,table_name,row)
select 'unassigned-junk-20260925','deals',to_jsonb(d) from public.deals d
where d.lifecycle_status in ('active','parked') and d.owner_id is null and coalesce(d.assignee_name,'')=''
  and coalesce(d.amount,0)<=0 and d.origin_inquiry_id is null
  and not exists(select 1 from public.activities x where x.deal_id=d.id)
  and not exists(select 1 from public.next_actions x where x.deal_id=d.id)
  and not exists(select 1 from crm_security.quote_versions x where x.deal_id=d.id)
  and not exists(select 1 from crm_security.deal_attachments x where x.deal_id=d.id)
  and not exists(select 1 from crm_security.message_outcomes x where x.deal_id=d.id)
  and not exists(select 1 from crm_security.relationship_events x where x.deal_id=d.id)
  and not exists(select 1 from crm_security.expansion_pool x where x.source_deal_id=d.id or x.created_opportunity_id=d.id)
  and not exists(select 1 from crm_security.contract_sales x where x.deal_id=d.id)
  and not exists(select 1 from crm_security.manual_delete_backup b where b.batch='unassigned-junk-20260925' and b.table_name='deals' and (b.row->>'id')::uuid=d.id);

-- 2) 하위 행 백업 (복구용 — 삭제·연결해제되는 모든 행)
insert into crm_security.manual_delete_backup(batch,table_name,row) select 'unassigned-junk-20260925',t.tbl,t.r from (
 select 'activities' tbl,to_jsonb(x) r,x.deal_id id from public.activities x
 union all select 'next_actions',to_jsonb(x),x.deal_id from public.next_actions x
 union all select 'stage_history',to_jsonb(x),x.opportunity_id from public.stage_history x
 union all select 'assignment_history',to_jsonb(x),x.opportunity_id from public.assignment_history x
 union all select 'business_history',to_jsonb(x),x.deal_id from public.business_history x
 union all select 'crm_asq_project_links',to_jsonb(x),x.opportunity_id from public.crm_asq_project_links x
 union all select 'projects',to_jsonb(x),x.opportunity_id from public.projects x
 union all select 'notes',to_jsonb(x),x.deal_id from public.notes x
 union all select 'contact_compat_state',to_jsonb(x),x.deal_id from crm_security.contact_compat_state x
 union all select 'message_reminders',to_jsonb(x),x.deal_id from crm_security.message_reminders x
 union all select 'next_action_postponements',to_jsonb(x),x.deal_id from crm_security.next_action_postponements x
 union all select 'user_opportunity_state',to_jsonb(x),x.deal_id from crm_security.user_opportunity_state x
 union all select 'object_scope',to_jsonb(x),x.deal_id from crm_security.object_scope x
 union all select 'sms_campaign_recipients',to_jsonb(x),x.deal_id from crm_security.sms_campaign_recipients x
 union all select 'attachment_audit_events',to_jsonb(x),x.deal_id from crm_security.attachment_audit_events x
 union all select 'deal_close_events',to_jsonb(x),x.deal_id from crm_security.deal_close_events x
 union all select 'deal_won_events',to_jsonb(x),x.deal_id from crm_security.deal_won_events x
 union all select 'stage_transition_events',to_jsonb(x),x.deal_id from crm_security.stage_transition_events x
 union all select 'expansion_pool_events',to_jsonb(x),x.source_deal_id from crm_security.expansion_pool_events x
) t where t.id in (select (b.row->>'id')::uuid from crm_security.manual_delete_backup b where b.batch='unassigned-junk-20260925' and b.table_name='deals');

-- 3) 삭제를 막는 연결(RESTRICT/NO ACTION) 먼저 정리
delete from crm_security.expansion_pool_events where source_deal_id in (select (row->>'id')::uuid from crm_security.manual_delete_backup where batch='unassigned-junk-20260925' and table_name='deals');
delete from crm_security.attachment_audit_events where deal_id in (select (row->>'id')::uuid from crm_security.manual_delete_backup where batch='unassigned-junk-20260925' and table_name='deals');
delete from crm_security.deal_close_events where deal_id in (select (row->>'id')::uuid from crm_security.manual_delete_backup where batch='unassigned-junk-20260925' and table_name='deals');
delete from crm_security.deal_won_events where deal_id in (select (row->>'id')::uuid from crm_security.manual_delete_backup where batch='unassigned-junk-20260925' and table_name='deals');
delete from crm_security.stage_transition_events where deal_id in (select (row->>'id')::uuid from crm_security.manual_delete_backup where batch='unassigned-junk-20260925' and table_name='deals');
delete from crm_security.object_scope where deal_id in (select (row->>'id')::uuid from crm_security.manual_delete_backup where batch='unassigned-junk-20260925' and table_name='deals');
delete from crm_security.sms_campaign_recipients where deal_id in (select (row->>'id')::uuid from crm_security.manual_delete_backup where batch='unassigned-junk-20260925' and table_name='deals');

-- 4) 영업건 삭제 (나머지 하위 행은 CASCADE, 문의·메모 연결은 SET NULL)
delete from public.deals where id in (select (row->>'id')::uuid from crm_security.manual_delete_backup where batch='unassigned-junk-20260925' and table_name='deals');
commit;

-- 5) 결과 확인: deals_deleted(≈337, 더 엄격한 조건으로 조금 적을 수 있음) · still_there 0 · unassigned_open_left(≈61, 금액·활동 있는 건)
select (select count(*) from crm_security.manual_delete_backup where batch='unassigned-junk-20260925' and table_name='deals') as deals_deleted,
       (select count(*) from crm_security.manual_delete_backup where batch='unassigned-junk-20260925' and table_name<>'deals') as child_rows_backed_up,
       (select count(*) from public.deals where id in (select (row->>'id')::uuid from crm_security.manual_delete_backup where batch='unassigned-junk-20260925' and table_name='deals')) as still_there,
       (select count(*) from public.deals d where d.lifecycle_status in ('active','parked') and d.owner_id is null and coalesce(d.assignee_name,'')='') as unassigned_open_left,
       (select count(*) from public.deals where lifecycle_status='active') as active_now;
