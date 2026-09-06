SET crm.personal_state_ref='rprechiaglyjaydkmxsu';
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $approval$ BEGIN
 IF current_user<>'postgres'
  OR current_setting('crm.personal_state_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_operational_20260906(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_user_opportunity_state_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regclass('crm_security.user_opportunity_state') IS NULL
  OR to_regnamespace('crm_personal_state_archive') IS NOT NULL
 THEN RAISE EXCEPTION 'personal-state rollback approval/drift failure'; END IF;
END $approval$;
DO $target_post_guard$ DECLARE w record; r record; h record; moved record; state_rel record; BEGIN
 SELECT * INTO w FROM pg_proc WHERE oid='public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure;
 SELECT * INTO r FROM pg_proc WHERE oid='public.crm_read_scoped_v2(uuid,integer,uuid,uuid)'::regprocedure;
 SELECT * INTO h FROM pg_proc WHERE oid='crm_security.crm_user_opportunity_state_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure;
 SELECT * INTO moved FROM pg_proc WHERE oid='crm_security.crm_write_command_v2_operational_20260906(uuid,text,uuid,integer,jsonb)'::regprocedure;
 SELECT * INTO state_rel FROM pg_class WHERE oid='crm_security.user_opportunity_state'::regclass;
 IF md5(pg_get_functiondef(w.oid))<>'5bbfeae44207a639d80474f882b25e47'
  OR md5(pg_get_functiondef(r.oid))<>'5fe13081a33bcfee6a4e989f4680b3b4'
  OR md5(pg_get_functiondef(h.oid))<>'ba6945da818aff8a26f86037ff06b32a'
  OR moved.oid<>18115
  OR pg_get_userbyid(state_rel.relowner)<>'postgres' OR NOT state_rel.relrowsecurity
  OR has_table_privilege('public',state_rel.oid,'SELECT,INSERT,UPDATE,DELETE')
  OR has_table_privilege('anon',state_rel.oid,'SELECT,INSERT,UPDATE,DELETE')
  OR has_table_privilege('authenticated',state_rel.oid,'SELECT,INSERT,UPDATE,DELETE')
  OR has_table_privilege('service_role',state_rel.oid,'SELECT,INSERT,UPDATE,DELETE')
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.command_receipts'::regclass
       AND conname='command_receipts_operation_check')
     IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text]))$expected$
 THEN RAISE EXCEPTION 'personal-state targeted post-apply drift'; END IF;
END $target_post_guard$;
LOCK TABLE crm_security.command_receipts,crm_security.user_opportunity_state IN ACCESS EXCLUSIVE MODE;
CREATE SCHEMA crm_personal_state_archive AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA crm_personal_state_archive FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE crm_personal_state_archive.command_receipts AS
 SELECT * FROM crm_security.command_receipts
 WHERE operation IN ('favorite_set','opportunity_touch');
REVOKE ALL ON crm_personal_state_archive.command_receipts
 FROM PUBLIC,anon,authenticated,service_role;
DELETE FROM crm_security.command_receipts
 WHERE operation IN ('favorite_set','opportunity_touch');
CREATE OR REPLACE FUNCTION public.crm_read_scoped_v2(p_after uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 100, p_deal_id uuid DEFAULT NULL::uuid, p_inquiry_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM crm_security.actor()) OR (p_deal_id IS NOT NULL AND NOT crm_security.can_deal(p_deal_id,false))
 OR (p_inquiry_id IS NOT NULL AND NOT crm_security.can_inquiry(p_inquiry_id))
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>100 THEN RAISE EXCEPTION 'invalid limit' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('contract_version',2,
 'deals',coalesce((SELECT jsonb_agg(to_jsonb(q) ORDER BY q.id) FROM(
 SELECT d.id,d.site_id,d.owner_id,d.stage_code,d.brand,d.primary_work,d.work_items,d.work_scope_type,d.work_summary,d.version
 FROM public.deals d WHERE crm_security.can_deal(d.id,false) AND (p_after IS NULL OR d.id>p_after)
 AND (p_deal_id IS NULL OR d.id=p_deal_id) ORDER BY d.id LIMIT p_limit) q),'[]'::jsonb),
 'inquiries',coalesce((SELECT jsonb_agg(to_jsonb(q) ORDER BY q.id) FROM(
 SELECT i.id,i.sheet_row,i.sheet_row AS "row",i.brand,i.site_name,i.site_name AS site,i.address,
  i.contact_name,i.contact_name AS contact,i.phone,coalesce(u.name,i.assignee_name) AS assignee_name,
  coalesce(u.name,i.assignee_name) AS assignee,i.assigned_to,i.status,i.deal_id,i.opportunity_id,
  i.received_at,i.created_at,coalesce(i.received_at,i.created_at) AS at,i.site_id,i.source_channel,i.channel,
  i.work_type,i.work_type AS work,i.assigned_at,i.first_response_at,i.responded_at,
  i.next_action_date,i.next_action_date AS due,
  jsonb_build_object(
   'customerType',i.raw->>'고객유형','buildingType',i.raw->>'건물유형',
   'address',coalesce(nullif(i.raw->>'건물주소',''),i.address),'complex',i.raw->>'단지개요',
   'workType',coalesce(nullif(i.raw->>'공사유형',''),i.work_type),'inquiry',i.raw->>'문의내용',
   'channel',coalesce(nullif(i.raw->>'상담채널',''),i.channel),
   'inflow',coalesce(nullif(i.raw->>'유입경로',''),i.source_channel),
   'office',i.raw->>'관리사무소','note',i.raw->>'특이사항',
   'assignComment',i.raw->>'배정 코멘트','closeReason',coalesce(nullif(i.raw->>'종료사유',''),i.close_reason)
  ) AS detail,coalesce(h.items,'[]'::jsonb) AS assignment_history
 FROM public.inquiries i
 LEFT JOIN public.users u ON u.user_id=i.assigned_to
 LEFT JOIN LATERAL (
  SELECT jsonb_agg(jsonb_build_object(
   'id',ah.id,'inquiry_id',ah.inquiry_id,'from_owner',ah.from_owner,'from',ah.from_owner,
   'to_owner',ah.to_owner,'to',ah.to_owner,'reason',ah.reason,
   'actor_name',ah.actor_name,'actor',ah.actor_name,'changed_by',ah.actor_name,
   'changed_at',ah.changed_at,'at',ah.changed_at
  ) ORDER BY ah.changed_at,ah.id) AS items
  FROM public.assignment_history ah WHERE ah.inquiry_id=i.id
 ) h ON true
 WHERE crm_security.can_inquiry(i.id)
 AND (p_after IS NULL OR i.id>p_after) AND (p_inquiry_id IS NULL OR i.id=p_inquiry_id)
 ORDER BY i.id LIMIT p_limit) q),'[]'::jsonb));
END $function$
;
DROP FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) RESTRICT;
DROP FUNCTION crm_security.crm_user_opportunity_state_command_v2(uuid,text,uuid,integer,jsonb) RESTRICT;
ALTER FUNCTION crm_security.crm_write_command_v2_operational_20260906(uuid,text,uuid,integer,jsonb)
 RENAME TO crm_write_command_v2;
ALTER FUNCTION crm_security.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 SET SCHEMA public;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 TO authenticated;
ALTER TABLE crm_security.command_receipts
 DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts
 ADD CONSTRAINT command_receipts_operation_check
 CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign'));
ALTER TABLE crm_security.user_opportunity_state
 SET SCHEMA crm_personal_state_archive;
REVOKE ALL ON crm_personal_state_archive.user_opportunity_state
 FROM PUBLIC,anon,authenticated,service_role;
DO $restored_guard$ DECLARE w record; r record; BEGIN
 SELECT * INTO w FROM pg_proc WHERE oid='public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure;
 SELECT * INTO r FROM pg_proc WHERE oid='public.crm_read_scoped_v2(uuid,integer,uuid,uuid)'::regprocedure;
 IF w.oid<>18115 OR md5(pg_get_functiondef(w.oid))<>'04ad2b922c42ca79c6ec854f79c19583'
  OR r.oid<>18064 OR md5(pg_get_functiondef(r.oid))<>'d1cde3372f07295076fc62bf28d12a01'
  OR to_regprocedure('crm_security.crm_write_command_v2_operational_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_user_opportunity_state_command_v2(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regclass('crm_personal_state_archive.user_opportunity_state') IS NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.command_receipts'::regclass
       AND conname='command_receipts_operation_check')
     IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text]))$expected$
 THEN RAISE EXCEPTION 'personal-state targeted rollback verification drift'; END IF;
END $restored_guard$;
COMMIT;