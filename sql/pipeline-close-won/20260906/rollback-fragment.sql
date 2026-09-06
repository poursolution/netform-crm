SET LOCAL crm.close_won_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='90s';

DO $guard$ BEGIN
 IF current_user<>'postgres' OR current_setting('crm.close_won_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_pre_close_won_20260906(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_operational_source_v1_pre_close_won_20260906(text,uuid,integer)') IS NULL
  OR to_regprocedure('crm_security.crm_deal_close_won_command_v1(uuid,uuid,integer,jsonb)') IS NULL
  OR to_regclass('crm_security.deal_won_events') IS NULL OR to_regclass('crm_security.expansion_pool') IS NULL
 THEN RAISE EXCEPTION 'closed-won rollback drift';END IF;
 IF EXISTS(SELECT 1 FROM crm_security.deal_won_events) THEN RAISE EXCEPTION 'runtime closed-won evidence exists; schema rollback refused';END IF;
END $guard$;

DROP FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb);
ALTER FUNCTION crm_security.crm_write_command_v2_pre_close_won_20260906(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2;
ALTER FUNCTION crm_security.crm_write_command_v2(uuid,text,uuid,integer,jsonb) SET SCHEMA public;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;

DROP FUNCTION public.crm_operational_source_v1(text,uuid,integer);
ALTER FUNCTION crm_security.crm_operational_source_v1_pre_close_won_20260906(text,uuid,integer) RENAME TO crm_operational_source_v1;
ALTER FUNCTION crm_security.crm_operational_source_v1(text,uuid,integer) SET SCHEMA public;
REVOKE EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) TO authenticated;

DROP FUNCTION crm_security.crm_deal_close_won_command_v1(uuid,uuid,integer,jsonb);
DROP TABLE crm_security.deal_won_events;
DROP TABLE crm_security.expansion_pool;
ALTER TABLE public.deals DROP CONSTRAINT deals_won_truth_consistent;
ALTER TABLE public.deals DROP CONSTRAINT deals_won_amount_positive;
ALTER TABLE public.deals DROP COLUMN completion_date;
ALTER TABLE public.deals DROP COLUMN won_amount;

DO $post$ BEGIN
 IF to_regprocedure('crm_security.crm_deal_close_won_command_v1(uuid,uuid,integer,jsonb)') IS NOT NULL
  OR to_regclass('crm_security.deal_won_events') IS NOT NULL OR to_regclass('crm_security.expansion_pool') IS NOT NULL
  OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='deals' AND column_name IN ('won_amount','completion_date'))
 THEN RAISE EXCEPTION 'closed-won rollback verification drift';END IF;
END $post$;
