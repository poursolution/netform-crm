begin;
set local lock_timeout='5s';
set local statement_timeout='90s';
set local search_path=pg_catalog;

drop function public.crm_write_command_v2(uuid,text,uuid,integer,jsonb);
alter function crm_security.crm_write_command_v2_pre_expansion_convert_20260907(uuid,text,uuid,integer,jsonb) set schema public;
alter function public.crm_write_command_v2_pre_expansion_convert_20260907(uuid,text,uuid,integer,jsonb) rename to crm_write_command_v2;
revoke execute on function public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) to authenticated;

drop function public.crm_expansion_context(jsonb);
alter function crm_security.crm_expansion_context_pre_convert_20260907(jsonb) set schema public;
alter function public.crm_expansion_context_pre_convert_20260907(jsonb) rename to crm_expansion_context;
revoke execute on function public.crm_expansion_context(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.crm_expansion_context(jsonb) to authenticated;

drop function public.crm_operational_source_v1(text,uuid,integer);
alter function crm_security.crm_operational_source_v1_pre_expansion_convert_20260907(text,uuid,integer) set schema public;
alter function public.crm_operational_source_v1_pre_expansion_convert_20260907(text,uuid,integer) rename to crm_operational_source_v1;
revoke execute on function public.crm_operational_source_v1(text,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.crm_operational_source_v1(text,uuid,integer) to authenticated;

drop function crm_security.crm_expansion_quote_convert_command_v1(uuid,uuid,integer,jsonb);
drop function crm_security.crm_expansion_quote_convert_pre_legacy_won_20260907(uuid,uuid,integer,jsonb);
alter table crm_security.command_receipts drop constraint command_receipts_operation_check;
alter table crm_security.command_receipts add constraint command_receipts_operation_check check(operation=any(array[
 'opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch',
 'next_action','activity','quote_version','next_action_complete','stage_check','transition','close','amount',
 'waiting_context','inquiry_reclassify','inquiry_status','inquiry_trash','inquiry_restore','inquiry_purge',
 'inquiry_followup','opportunity_create','lineage_link','attachment_prepare','attachment_complete',
 'expansion_pool_update','expansion_note','customer_support_action','message_log','relationship_hold','relationship_response',
 'inquiry_consultant','assign','contact_upsert','contact_relationship','contact_move','rep_manager_comment'
]::text[]));
alter table crm_security.expansion_pool_events drop constraint expansion_pool_events_kind_check;
alter table crm_security.expansion_pool_events add constraint expansion_pool_events_kind_check check(kind=any(array[
 'status_change','next_contact_change','status_and_next_contact','note'
]::text[]));
alter table crm_security.expansion_pool drop column created_opportunity_id;
commit;
