-- CRM 기술자문 브랜드 영업건 일괄 삭제 (2026-09-25 대표 지시)
-- 대상: public.deals.brand='기술자문' 47건 · 원장(contract_sales) 연결 0건 사전 확인됨
-- 전 행 crm_security.manual_delete_backup 에 jsonb 백업 후 삭제. 트랜잭션 1개.
-- 실행: 이 파일 전체를 Supabase SQL Editor 에 붙여넣고 Run.
begin;
-- 0) 원장 실적이 붙은 딜이 있으면 즉시 중단 (실적 보존 정책)
do $chk$ begin
 if exists(select 1 from public.deals d join crm_security.contract_sales cs on cs.deal_id=d.id where d.brand='기술자문') then
  raise exception '원장 실적이 연결된 기술자문 딜이 있어 중단합니다';
 end if;
end $chk$;
-- 1) 백업 보관함 + 대상 고정
create table if not exists crm_security.manual_delete_backup(batch text, table_name text, row jsonb, saved_at timestamptz default now());
create temporary table _target on commit drop as select id from public.deals where brand='기술자문';
insert into crm_security.manual_delete_backup(batch,table_name,row)
 select 'advisory-deals-20260925','deals',to_jsonb(d) from public.deals d where d.id in (select id from _target);
insert into crm_security.manual_delete_backup(batch,table_name,row) select 'advisory-deals-20260925','deal_attachments',to_jsonb(t) from crm_security.deal_attachments t where t.deal_id in (select id from _target);
insert into crm_security.manual_delete_backup(batch,table_name,row) select 'advisory-deals-20260925','deal_close_events',to_jsonb(t) from crm_security.deal_close_events t where t.deal_id in (select id from _target);
insert into crm_security.manual_delete_backup(batch,table_name,row) select 'advisory-deals-20260925','deal_won_events',to_jsonb(t) from crm_security.deal_won_events t where t.deal_id in (select id from _target);
insert into crm_security.manual_delete_backup(batch,table_name,row) select 'advisory-deals-20260925','message_outcomes',to_jsonb(t) from crm_security.message_outcomes t where t.deal_id in (select id from _target);
insert into crm_security.manual_delete_backup(batch,table_name,row) select 'advisory-deals-20260925','relationship_events',to_jsonb(t) from crm_security.relationship_events t where t.deal_id in (select id from _target);
insert into crm_security.manual_delete_backup(batch,table_name,row) select 'advisory-deals-20260925','stage_transition_events',to_jsonb(t) from crm_security.stage_transition_events t where t.deal_id in (select id from _target);
insert into crm_security.manual_delete_backup(batch,table_name,row) select 'advisory-deals-20260925','expansion_pool',to_jsonb(t) from crm_security.expansion_pool t where t.source_deal_id in (select id from _target) or t.created_opportunity_id in (select id from _target);
insert into crm_security.manual_delete_backup(batch,table_name,row) select 'advisory-deals-20260925','expansion_pool_events',to_jsonb(t) from crm_security.expansion_pool_events t where t.source_deal_id in (select id from _target);
-- 2) RESTRICT/NO ACTION 자식 정리
delete from crm_security.expansion_pool_events where source_deal_id in (select id from _target);
delete from crm_security.expansion_pool where source_deal_id in (select id from _target) or created_opportunity_id in (select id from _target);
delete from crm_security.deal_attachments where deal_id in (select id from _target);
delete from crm_security.deal_close_events where deal_id in (select id from _target);
delete from crm_security.deal_won_events where deal_id in (select id from _target);
delete from crm_security.message_outcomes where deal_id in (select id from _target);
delete from crm_security.relationship_events where deal_id in (select id from _target);
delete from crm_security.stage_transition_events where deal_id in (select id from _target);
delete from crm_security.object_scope where deal_id in (select id from _target);
delete from crm_security.attachment_audit_events where deal_id in (select id from _target);
delete from crm_security.sms_campaign_recipients where deal_id in (select id from _target);
-- 3) 딜 삭제 (activities·next_actions·stage_history 등 12개 테이블은 CASCADE, notes·inquiries 링크는 SET NULL)
delete from public.deals where id in (select id from _target);
commit;
-- 4) 결과 확인
select (select count(*) from public.deals where brand='기술자문') remaining,
       (select count(*) from crm_security.manual_delete_backup where batch='advisory-deals-20260925') backed_up;
