-- READ-ONLY LIVE PREFLIGHT. Capture its single JSON result before approval.
BEGIN TRANSACTION READ ONLY;
SET LOCAL search_path=pg_catalog;
SET LOCAL statement_timeout='30s';

SELECT jsonb_pretty(jsonb_build_object(
 'captured_at',clock_timestamp(),
 'project_ref',current_setting('crm.customer_asset_ref',true),
 'function',jsonb_build_object(
  'signature','public.crm_contacts_scoped_v2(uuid)',
  'oid',p.oid,
  'definition_md5',md5(pg_get_functiondef(p.oid)),
  'definition_md5_lf',md5(replace(replace(pg_get_functiondef(p.oid),chr(13)||chr(10),chr(10)),chr(13),chr(10))),
  'owner',pg_get_userbyid(p.proowner),
  'security_definer',p.prosecdef,
  'language',l.lanname,
  'volatility',p.provolatile,
  'strict',p.proisstrict,
  'parallel',p.proparallel,
  'leakproof',p.proleakproof,
  'config',p.proconfig,
  'acl',p.proacl::text
 ),
 'can_deal_definition_md5',md5(pg_get_functiondef('crm_security.can_deal(uuid,boolean)'::regprocedure)),
 'can_deal_definition_md5_lf',md5(replace(replace(pg_get_functiondef('crm_security.can_deal(uuid,boolean)'::regprocedure),chr(13)||chr(10),chr(10)),chr(13),chr(10))),
 'expected',jsonb_build_object(
  'project_ref','rprechiaglyjaydkmxsu',
  'definition_md5','1a58be86503cb53bdc3a9a784eb4add2',
  'can_deal_definition_md5','05d51a3c77344504a05a0e932cfcb15d',
  'owner','postgres','security_definer',true,'language','plpgsql','volatility','s',
  'strict',false,'parallel','u','leakproof',false,
  'config',jsonb_build_array('search_path=""'),
  'acl','{postgres=X/postgres,authenticated=X/postgres}'
 ),
 'matches_expected',
  current_setting('crm.customer_asset_ref',true)='rprechiaglyjaydkmxsu'
  AND md5(replace(replace(pg_get_functiondef(p.oid),chr(13)||chr(10),chr(10)),chr(13),chr(10)))='1a58be86503cb53bdc3a9a784eb4add2'
  AND md5(replace(replace(pg_get_functiondef('crm_security.can_deal(uuid,boolean)'::regprocedure),chr(13)||chr(10),chr(10)),chr(13),chr(10)))='05d51a3c77344504a05a0e932cfcb15d'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.prosecdef AND l.lanname='plpgsql'
  AND p.provolatile='s' AND NOT p.proisstrict AND p.proparallel='u' AND NOT p.proleakproof
  AND p.proconfig=ARRAY['search_path=""'] AND p.proacl::text='{postgres=X/postgres,authenticated=X/postgres}'
 )) AS customer_asset_preflight
FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang
WHERE p.oid='public.crm_contacts_scoped_v2(uuid)'::regprocedure;
ROLLBACK;
