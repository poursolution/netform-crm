-- LOCAL DECISION GATE ONLY. The current four-argument public read has no
-- resource/domain selector, so O07S/O08M are deliberately not connected.
BEGIN READ ONLY;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';

DO $guard$ DECLARE p record; BEGIN
 SELECT * INTO p FROM pg_proc
  WHERE oid='public.crm_read_scoped_v2(uuid,integer,uuid,uuid)'::regprocedure;
 IF current_setting('crm.operational_read_compat_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR p.oid IS NULL OR pg_get_userbyid(p.proowner)<>'postgres' OR NOT p.prosecdef
  OR p.provolatile<>'s' OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']
  OR coalesce(p.proacl::text,'')<>'{postgres=X/postgres,authenticated=X/postgres}'
  OR md5(pg_get_functiondef(p.oid))<>'919c4abff86e37beeb62ccb15beba33e'
  OR p.pronargs<>4 OR p.proargtypes::text<>'2950 23 2950 2950'
 THEN RAISE EXCEPTION 'operational read compatibility baseline drift'; END IF;
END $guard$;

SELECT jsonb_build_object(
 'status','PUBLIC_CONNECT_BLOCKED',
 'reason','RESOURCE_SELECTOR_REQUIRED',
 'connected_reads',jsonb_build_array(),
 'public_function_changed',false,
 'required_discriminator','resource',
 'allowed_future_values',jsonb_build_array('dashboard_source','mine_source')
) AS local_decision;
COMMIT;
