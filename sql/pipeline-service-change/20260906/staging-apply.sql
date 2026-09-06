SET crm.pipeline_service_ref='rprechiaglyjaydkmxsu';
-- Staging-only candidate. Generate and review staging-apply.sql before execution.
-- Adds only service_change. The frozen work/direct-assignment implementation is moved,
-- not rewritten, and remains the delegate for its two operations.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $$ BEGIN
 IF current_user<>'postgres'
  OR current_setting('crm.pipeline_service_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('crm_security.crm_write_command_v2_frozen_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
 THEN RAISE EXCEPTION 'Staging pipeline service-change approval required'; END IF;
END $$;
DO $metadata_guard$ DECLARE actual jsonb; BEGIN
-- Read-only catalog metadata only. Never selects customer/Auth rows or Storage files.
-- Run by an authorized reviewer; this file is NOT automatically executed remotely.
WITH rel AS (SELECT c.* FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S')),
fun AS (SELECT p.* FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'),
cols AS (SELECT c.relname AS "table",a.attnum AS ordinal,a.attname AS name,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull AS not_null,pg_get_expr(d.adbin,d.adrelid) AS "default",a.attidentity AS identity,a.attgenerated AS generated,a.attstorage AS storage,a.attcompression AS compression,CASE WHEN a.attcollation=0 THEN NULL ELSE a.attcollation::regcollation::text END AS collation,a.attacl AS acl FROM rel c JOIN pg_attribute a ON a.attrelid=c.oid LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE c.relkind IN ('r','p','v','m') AND a.attnum>0 AND NOT a.attisdropped),
snap AS (SELECT jsonb_build_object(
'version',current_setting('server_version'),'encoding',current_setting('server_encoding'),
'database',(SELECT jsonb_build_object('collate',datcollate,'ctype',datctype,'provider',datlocprovider,'locale',datlocale) FROM pg_database WHERE datname=current_database()),
'schema',(SELECT jsonb_build_object('owner',pg_get_userbyid(nspowner),'acl',nspacl) FROM pg_namespace WHERE nspname='public'),
'relations',(SELECT jsonb_agg(jsonb_build_object('name',relname,'kind',relkind,'owner',pg_get_userbyid(relowner),'acl',relacl,'rls',relrowsecurity,'force_rls',relforcerowsecurity,'options',reloptions,'persistence',relpersistence,'replica_identity',relreplident,'tablespace',reltablespace) ORDER BY relname) FROM rel),
'columns',(SELECT jsonb_agg(to_jsonb(a) ORDER BY "table",ordinal) FROM cols a),
'constraints',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',k.conname,'type',k.contype,'definition',pg_get_constraintdef(k.oid,true),'validated',k.convalidated,'deferrable',k.condeferrable,'deferred',k.condeferred) ORDER BY c.relname,k.conname) FROM rel c JOIN pg_constraint k ON k.conrelid=c.oid),
'indexes',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',ic.relname,'definition',pg_get_indexdef(i.indexrelid),'valid',i.indisvalid,'ready',i.indisready,'clustered',i.indisclustered,'replica_identity',i.indisreplident,'constraint_owned',EXISTS(SELECT 1 FROM pg_constraint k WHERE k.conindid=i.indexrelid AND k.conrelid=c.oid AND k.contype IN ('p','u','x'))) ORDER BY c.relname,ic.relname) FROM rel c JOIN pg_index i ON i.indrelid=c.oid JOIN pg_class ic ON ic.oid=i.indexrelid),
'sequences',(SELECT jsonb_agg(jsonb_build_object('name',c.relname,'type',format_type(s.seqtypid,NULL),'start',s.seqstart::text,'increment',s.seqincrement::text,'min',s.seqmin::text,'max',s.seqmax::text,'cache',s.seqcache::text,'cycle',s.seqcycle,'owned_by',(SELECT format('%I.%I.%I',n.nspname,t.relname,a.attname) FROM pg_depend d JOIN pg_class t ON t.oid=d.refobjid JOIN pg_namespace n ON n.oid=t.relnamespace JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=d.refobjsubid WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.refclassid='pg_class'::regclass AND d.deptype IN ('a','i') LIMIT 1)) ORDER BY c.relname) FROM rel c JOIN pg_sequence s ON s.seqrelid=c.oid),
'functions',(SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'definition',replace(replace(pg_get_functiondef(p.oid),chr(13)||chr(10),chr(10)),chr(13),chr(10)),'owner',pg_get_userbyid(p.proowner),'acl',p.proacl,'security_definer',p.prosecdef,'config',p.proconfig,'language',(SELECT lanname FROM pg_language WHERE oid=p.prolang),'volatility',p.provolatile,'parallel',p.proparallel,'strict',p.proisstrict,'leakproof',p.proleakproof) ORDER BY p.oid::regprocedure::text) FROM fun p WHERE p.prokind IN ('f','p')),
'views',(SELECT jsonb_agg(jsonb_build_object('name',relname,'definition',pg_get_viewdef(oid,true),'options',reloptions,'owner',pg_get_userbyid(relowner),'acl',relacl) ORDER BY relname) FROM rel WHERE relkind='v'),
'triggers',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',t.tgname,'definition',pg_get_triggerdef(t.oid,true),'enabled',t.tgenabled) ORDER BY c.relname,t.tgname) FROM rel c JOIN pg_trigger t ON t.tgrelid=c.oid WHERE NOT t.tgisinternal),
'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY tablename,policyname) FROM pg_policies p WHERE schemaname='public'),
'default_privileges',(SELECT jsonb_agg(jsonb_build_object('creator',pg_get_userbyid(d.defaclrole),'schema',n.nspname,'type',d.defaclobjtype,'acl',d.defaclacl) ORDER BY pg_get_userbyid(d.defaclrole),n.nspname,d.defaclobjtype) FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace WHERE d.defaclnamespace=0 OR n.nspname='public'),
'creators',(SELECT jsonb_agg(jsonb_build_object('role',r.rolname,'can_login',r.rolcanlogin,'superuser',r.rolsuper,'bypass_rls',r.rolbypassrls,'inherit',r.rolinherit,'can_create_public',has_schema_privilege(r.oid,'public','CREATE'),'executor_member',pg_has_role(current_user,r.oid,'MEMBER')) ORDER BY r.rolname) FROM pg_roles r WHERE has_schema_privilege(r.oid,'public','CREATE') OR EXISTS(SELECT 1 FROM fun p WHERE p.proowner=r.oid) OR EXISTS(SELECT 1 FROM pg_default_acl d WHERE d.defaclrole=r.oid AND (d.defaclnamespace=0 OR d.defaclnamespace='public'::regnamespace))),
'extensions',(SELECT jsonb_agg(jsonb_build_object('name',e.extname,'version',e.extversion,'schema',n.nspname,'owner',pg_get_userbyid(e.extowner)) ORDER BY e.extname) FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace),
'custom_types',(SELECT jsonb_agg(jsonb_build_object('name',t.typname,'kind',t.typtype,'base',format_type(t.typbasetype,t.typtypmod))) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typtype IN ('e','d')),
'custom_collations',(SELECT jsonb_agg(jsonb_build_object('name',c.collname,'provider',c.collprovider,'collate',c.collcollate,'ctype',c.collctype,'locale',c.colllocale,'version',c.collversion)) FROM pg_collation c JOIN pg_namespace n ON n.oid=c.collnamespace WHERE n.nspname='public'),
'dependencies',(SELECT jsonb_agg(jsonb_build_object('source',pg_describe_object(d.classid,d.objid,d.objsubid),'target',pg_describe_object(d.refclassid,d.refobjid,d.refobjsubid),'type',d.deptype) ORDER BY d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.refobjsubid) FROM pg_depend d WHERE (d.classid='pg_proc'::regclass AND d.objid IN(SELECT oid FROM fun)) OR (d.classid='pg_rewrite'::regclass AND d.objid IN(SELECT rw.oid FROM pg_rewrite rw JOIN rel c ON c.oid=rw.ev_class)) OR (d.classid='pg_class'::regclass AND d.objid IN(SELECT oid FROM rel)) OR (d.classid='pg_attrdef'::regclass AND d.objid IN(SELECT a.oid FROM pg_attrdef a JOIN rel c ON c.oid=a.adrelid)))
) AS payload) SELECT payload INTO actual FROM snap;

IF md5((actual->'schema')::text) IS DISTINCT FROM '793bc7fc6b640d7fb530c67862bceb9b' THEN RAISE EXCEPTION 'public.schema metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'relations')))::text) IS DISTINCT FROM '55cef2065d9d7899725f14a95ef8bfc9' THEN RAISE EXCEPTION 'public.relations metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'columns')))::text) IS DISTINCT FROM '2c09dda6f06b2a73ef53a877a7c222f5' THEN RAISE EXCEPTION 'public.columns metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'constraints')))::text) IS DISTINCT FROM 'b66207f6371dbfc55f1eb262809daa77' THEN RAISE EXCEPTION 'public.constraints metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'indexes')))::text) IS DISTINCT FROM 'e46e18edd383c0c94a9d307774ab7357' THEN RAISE EXCEPTION 'public.indexes metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'sequences')))::text) IS DISTINCT FROM 'ff220ef0b2fe715b7c6e6080ee5f5493' THEN RAISE EXCEPTION 'public.sequences metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'functions')))::text) IS DISTINCT FROM '4961b7555fa0f4d8b6c109d7fc7082a8' THEN RAISE EXCEPTION 'public.functions metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'views')))::text) IS DISTINCT FROM '62dd46bb6c0473d80dc32ec8a18f7d30' THEN RAISE EXCEPTION 'public.views metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'triggers')))::text) IS DISTINCT FROM '51befedcd469c20566239cd48918a668' THEN RAISE EXCEPTION 'public.triggers metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'policies')))::text) IS DISTINCT FROM '43460d0b92d895f19d4495bf429bfb21' THEN RAISE EXCEPTION 'public.policies metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'default_privileges')))::text) IS DISTINCT FROM 'fa5134712645b7d90e76a031498fea50' THEN RAISE EXCEPTION 'public.default_privileges metadata drift'; END IF;
IF md5((actual->'custom_types')::text) IS DISTINCT FROM '37a6259cc0c1dae299a7866489dff0bd' THEN RAISE EXCEPTION 'public.custom_types metadata drift'; END IF;
IF md5((actual->'custom_collations')::text) IS DISTINCT FROM '37a6259cc0c1dae299a7866489dff0bd' THEN RAISE EXCEPTION 'public.custom_collations metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'dependencies')))::text) IS DISTINCT FROM '04140a2835ba7a51b879f7d441d8568d' THEN RAISE EXCEPTION 'public.dependencies metadata drift'; END IF;
END $metadata_guard$;
DO $metadata_guard$ DECLARE actual jsonb; BEGIN
-- Read-only catalog metadata only. Never selects customer/Auth rows or Storage files.
-- Run by an authorized reviewer; this file is NOT automatically executed remotely.
WITH rel AS (SELECT c.* FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='crm_security' AND c.relkind IN ('r','p','v','m','S')),
fun AS (SELECT p.* FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='crm_security'),
cols AS (SELECT c.relname AS "table",a.attnum AS ordinal,a.attname AS name,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull AS not_null,pg_get_expr(d.adbin,d.adrelid) AS "default",a.attidentity AS identity,a.attgenerated AS generated,a.attstorage AS storage,a.attcompression AS compression,CASE WHEN a.attcollation=0 THEN NULL ELSE a.attcollation::regcollation::text END AS collation,a.attacl AS acl FROM rel c JOIN pg_attribute a ON a.attrelid=c.oid LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE c.relkind IN ('r','p','v','m') AND a.attnum>0 AND NOT a.attisdropped),
snap AS (SELECT jsonb_build_object(
'version',current_setting('server_version'),'encoding',current_setting('server_encoding'),
'database',(SELECT jsonb_build_object('collate',datcollate,'ctype',datctype,'provider',datlocprovider,'locale',datlocale) FROM pg_database WHERE datname=current_database()),
'schema',(SELECT jsonb_build_object('owner',pg_get_userbyid(nspowner),'acl',nspacl) FROM pg_namespace WHERE nspname='crm_security'),
'relations',(SELECT jsonb_agg(jsonb_build_object('name',relname,'kind',relkind,'owner',pg_get_userbyid(relowner),'acl',relacl,'rls',relrowsecurity,'force_rls',relforcerowsecurity,'options',reloptions,'persistence',relpersistence,'replica_identity',relreplident,'tablespace',reltablespace) ORDER BY relname) FROM rel),
'columns',(SELECT jsonb_agg(to_jsonb(a) ORDER BY "table",ordinal) FROM cols a),
'constraints',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',k.conname,'type',k.contype,'definition',pg_get_constraintdef(k.oid,true),'validated',k.convalidated,'deferrable',k.condeferrable,'deferred',k.condeferred) ORDER BY c.relname,k.conname) FROM rel c JOIN pg_constraint k ON k.conrelid=c.oid),
'indexes',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',ic.relname,'definition',pg_get_indexdef(i.indexrelid),'valid',i.indisvalid,'ready',i.indisready,'clustered',i.indisclustered,'replica_identity',i.indisreplident,'constraint_owned',EXISTS(SELECT 1 FROM pg_constraint k WHERE k.conindid=i.indexrelid AND k.conrelid=c.oid AND k.contype IN ('p','u','x'))) ORDER BY c.relname,ic.relname) FROM rel c JOIN pg_index i ON i.indrelid=c.oid JOIN pg_class ic ON ic.oid=i.indexrelid),
'sequences',(SELECT jsonb_agg(jsonb_build_object('name',c.relname,'type',format_type(s.seqtypid,NULL),'start',s.seqstart::text,'increment',s.seqincrement::text,'min',s.seqmin::text,'max',s.seqmax::text,'cache',s.seqcache::text,'cycle',s.seqcycle,'owned_by',(SELECT format('%I.%I.%I',n.nspname,t.relname,a.attname) FROM pg_depend d JOIN pg_class t ON t.oid=d.refobjid JOIN pg_namespace n ON n.oid=t.relnamespace JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=d.refobjsubid WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.refclassid='pg_class'::regclass AND d.deptype IN ('a','i') LIMIT 1)) ORDER BY c.relname) FROM rel c JOIN pg_sequence s ON s.seqrelid=c.oid),
'functions',(SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'definition',replace(replace(pg_get_functiondef(p.oid),chr(13)||chr(10),chr(10)),chr(13),chr(10)),'owner',pg_get_userbyid(p.proowner),'acl',p.proacl,'security_definer',p.prosecdef,'config',p.proconfig,'language',(SELECT lanname FROM pg_language WHERE oid=p.prolang),'volatility',p.provolatile,'parallel',p.proparallel,'strict',p.proisstrict,'leakproof',p.proleakproof) ORDER BY p.oid::regprocedure::text) FROM fun p WHERE p.prokind IN ('f','p')),
'views',(SELECT jsonb_agg(jsonb_build_object('name',relname,'definition',pg_get_viewdef(oid,true),'options',reloptions,'owner',pg_get_userbyid(relowner),'acl',relacl) ORDER BY relname) FROM rel WHERE relkind='v'),
'triggers',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',t.tgname,'definition',pg_get_triggerdef(t.oid,true),'enabled',t.tgenabled) ORDER BY c.relname,t.tgname) FROM rel c JOIN pg_trigger t ON t.tgrelid=c.oid WHERE NOT t.tgisinternal),
'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY tablename,policyname) FROM pg_policies p WHERE schemaname='crm_security'),
'default_privileges',(SELECT jsonb_agg(jsonb_build_object('creator',pg_get_userbyid(d.defaclrole),'schema',n.nspname,'type',d.defaclobjtype,'acl',d.defaclacl) ORDER BY pg_get_userbyid(d.defaclrole),n.nspname,d.defaclobjtype) FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace WHERE d.defaclnamespace=0 OR n.nspname='crm_security'),
'creators',(SELECT jsonb_agg(jsonb_build_object('role',r.rolname,'can_login',r.rolcanlogin,'superuser',r.rolsuper,'bypass_rls',r.rolbypassrls,'inherit',r.rolinherit,'can_create_public',has_schema_privilege(r.oid,'public','CREATE'),'executor_member',pg_has_role(current_user,r.oid,'MEMBER')) ORDER BY r.rolname) FROM pg_roles r WHERE has_schema_privilege(r.oid,'public','CREATE') OR EXISTS(SELECT 1 FROM fun p WHERE p.proowner=r.oid) OR EXISTS(SELECT 1 FROM pg_default_acl d WHERE d.defaclrole=r.oid AND (d.defaclnamespace=0 OR d.defaclnamespace='crm_security'::regnamespace))),
'extensions',(SELECT jsonb_agg(jsonb_build_object('name',e.extname,'version',e.extversion,'schema',n.nspname,'owner',pg_get_userbyid(e.extowner)) ORDER BY e.extname) FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace),
'custom_types',(SELECT jsonb_agg(jsonb_build_object('name',t.typname,'kind',t.typtype,'base',format_type(t.typbasetype,t.typtypmod))) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='crm_security' AND t.typtype IN ('e','d')),
'custom_collations',(SELECT jsonb_agg(jsonb_build_object('name',c.collname,'provider',c.collprovider,'collate',c.collcollate,'ctype',c.collctype,'locale',c.colllocale,'version',c.collversion)) FROM pg_collation c JOIN pg_namespace n ON n.oid=c.collnamespace WHERE n.nspname='crm_security'),
'dependencies',(SELECT jsonb_agg(jsonb_build_object('source',pg_describe_object(d.classid,d.objid,d.objsubid),'target',pg_describe_object(d.refclassid,d.refobjid,d.refobjsubid),'type',d.deptype) ORDER BY d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.refobjsubid) FROM pg_depend d WHERE (d.classid='pg_proc'::regclass AND d.objid IN(SELECT oid FROM fun)) OR (d.classid='pg_rewrite'::regclass AND d.objid IN(SELECT rw.oid FROM pg_rewrite rw JOIN rel c ON c.oid=rw.ev_class)) OR (d.classid='pg_class'::regclass AND d.objid IN(SELECT oid FROM rel)) OR (d.classid='pg_attrdef'::regclass AND d.objid IN(SELECT a.oid FROM pg_attrdef a JOIN rel c ON c.oid=a.adrelid)))
) AS payload) SELECT payload INTO actual FROM snap;

IF md5((actual->'schema')::text) IS DISTINCT FROM '1b9541895fcea1f9220c33cbf263896e' THEN RAISE EXCEPTION 'crm_security.schema metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'relations')))::text) IS DISTINCT FROM 'b653c7216ca41e6e174f38d73ea76c69' THEN RAISE EXCEPTION 'crm_security.relations metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'columns')))::text) IS DISTINCT FROM '93c9b652f5c6a04fb5147cd2a62d16fa' THEN RAISE EXCEPTION 'crm_security.columns metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'constraints')))::text) IS DISTINCT FROM '3af8065d672b8752a53b6bdcbf632693' THEN RAISE EXCEPTION 'crm_security.constraints metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'indexes')))::text) IS DISTINCT FROM '43cff5e11244df19020c283997a82fed' THEN RAISE EXCEPTION 'crm_security.indexes metadata drift'; END IF;
IF md5((actual->'sequences')::text) IS DISTINCT FROM '37a6259cc0c1dae299a7866489dff0bd' THEN RAISE EXCEPTION 'crm_security.sequences metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'functions')))::text) IS DISTINCT FROM '9b5da5cddc455eccc286329e7d08051a' THEN RAISE EXCEPTION 'crm_security.functions metadata drift'; END IF;
IF md5((actual->'views')::text) IS DISTINCT FROM '37a6259cc0c1dae299a7866489dff0bd' THEN RAISE EXCEPTION 'crm_security.views metadata drift'; END IF;
IF md5((actual->'triggers')::text) IS DISTINCT FROM '37a6259cc0c1dae299a7866489dff0bd' THEN RAISE EXCEPTION 'crm_security.triggers metadata drift'; END IF;
IF md5((actual->'policies')::text) IS DISTINCT FROM '37a6259cc0c1dae299a7866489dff0bd' THEN RAISE EXCEPTION 'crm_security.policies metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'default_privileges')))::text) IS DISTINCT FROM '4828b0ad9c231f5b6d492f0fb4462106' THEN RAISE EXCEPTION 'crm_security.default_privileges metadata drift'; END IF;
IF md5((actual->'custom_types')::text) IS DISTINCT FROM '37a6259cc0c1dae299a7866489dff0bd' THEN RAISE EXCEPTION 'crm_security.custom_types metadata drift'; END IF;
IF md5((actual->'custom_collations')::text) IS DISTINCT FROM '37a6259cc0c1dae299a7866489dff0bd' THEN RAISE EXCEPTION 'crm_security.custom_collations metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'dependencies')))::text) IS DISTINCT FROM 'd8ed65ec0c848d51e3dcc579621f6e06' THEN RAISE EXCEPTION 'crm_security.dependencies metadata drift'; END IF;
END $metadata_guard$;

ALTER TABLE crm_security.command_receipts
 DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts
 ADD CONSTRAINT command_receipts_operation_check
 CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change'));

-- Keep the already Staging-verified body at the same OID. It is private and is the
-- only path used for the two frozen operations.
ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 SET SCHEMA crm_security;
ALTER FUNCTION crm_security.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 RENAME TO crm_write_command_v2_frozen_20260906;
REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_frozen_20260906(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_write_command_v2(
 p_request_id uuid,
 p_operation text,
 p_object_id uuid,
 p_expected_version integer,
 p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a record;
 receipt crm_security.command_receipts%ROWTYPE;
 oldrow public.deals%ROWTYPE;
 newrow public.deals%ROWTYPE;
 ack jsonb;
 event uuid;
 activity_id_value uuid;
 next_action_id_value uuid;
 history_id_value bigint;
 changed_at_value timestamptz;
 from_value text;
 to_value text;
 reason_value text;
 source_value text;
 next_value text;
 next_due_value date;
 actor_email_value text;
 history_entry jsonb;
BEGIN
 IF p_operation IS DISTINCT FROM 'service_change' THEN
  RETURN crm_security.crm_write_command_v2_frozen_20260906(
   p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
 END IF;

 IF auth.uid() IS NULL THEN
  RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
 END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r
  WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;

 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version IS NULL
  OR p_expected_version<0 OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k
   WHERE k NOT IN ('from_service','to_service','origin_channel','reason',
                   'reason_source','next_action','next_due','at'))
  OR NOT p_payload ?& ARRAY['to_service','reason']
  OR jsonb_typeof(p_payload->'to_service') IS DISTINCT FROM 'string'
  OR length(trim(p_payload->>'to_service'))<1
  OR length(p_payload->>'to_service')>100
  OR jsonb_typeof(p_payload->'reason') IS DISTINCT FROM 'string'
  OR length(trim(p_payload->>'reason'))<5
  OR length(p_payload->>'reason')>2000
  OR (p_payload ? 'from_service' AND jsonb_typeof(p_payload->'from_service') NOT IN ('string','null'))
  OR (p_payload ? 'from_service' AND jsonb_typeof(p_payload->'from_service')='string'
      AND length(p_payload->>'from_service')>100)
  OR (p_payload ? 'origin_channel' AND jsonb_typeof(p_payload->'origin_channel') NOT IN ('string','null'))
  OR (p_payload ? 'origin_channel' AND jsonb_typeof(p_payload->'origin_channel')='string'
      AND length(p_payload->>'origin_channel')>100)
  OR (p_payload ? 'reason_source' AND jsonb_typeof(p_payload->'reason_source') NOT IN ('string','null'))
  OR (p_payload ? 'reason_source' AND jsonb_typeof(p_payload->'reason_source')='string'
      AND length(p_payload->>'reason_source')>200)
  OR (p_payload ? 'next_action' AND jsonb_typeof(p_payload->'next_action') NOT IN ('string','null'))
  OR (p_payload ? 'next_action' AND jsonb_typeof(p_payload->'next_action')='string'
      AND length(p_payload->>'next_action')>500)
  OR (p_payload ? 'next_due' AND jsonb_typeof(p_payload->'next_due') NOT IN ('string','null'))
  OR (p_payload ? 'next_due' AND jsonb_typeof(p_payload->'next_due')='string'
      AND p_payload->>'next_due' !~ '^\d{4}-\d{2}-\d{2}$')
  OR (p_payload ? 'at' AND jsonb_typeof(p_payload->'at') NOT IN ('string','null'))
  OR (p_payload ? 'at' AND jsonb_typeof(p_payload->'at')='string'
      AND length(p_payload->>'at')>64)
 THEN RAISE EXCEPTION 'invalid service change payload; actor/time/from are server-owned'
  USING ERRCODE='22023';
 END IF;

 to_value:=trim(p_payload->>'to_service');
 reason_value:=trim(p_payload->>'reason');
 source_value:=coalesce(nullif(trim(p_payload->>'reason_source'),''),'text');
 next_value:=nullif(trim(p_payload->>'next_action'),'');
 IF p_payload->>'next_due' IS NOT NULL THEN
  BEGIN
   next_due_value:=(p_payload->>'next_due')::date;
  EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN
   RAISE EXCEPTION 'invalid service change payload' USING ERRCODE='22023';
  END;
 END IF;
 IF next_value IS NULL AND next_due_value IS NOT NULL THEN
  RAISE EXCEPTION 'next_due requires next_action' USING ERRCODE='22023';
 END IF;

 PERFORM 1 FROM crm_security.object_scope s
  WHERE s.user_id=a.user_id AND s.deal_id=p_object_id FOR SHARE;
 SELECT * INTO oldrow FROM public.deals d WHERE d.id=p_object_id FOR UPDATE;
 IF NOT FOUND OR a.permission_role NOT IN ('rep','branch','admin')
  OR NOT crm_security.can_deal(p_object_id,true)
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;

 PERFORM pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r
  WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id
   OR receipt.operation IS DISTINCT FROM p_operation
   OR receipt.object_id IS DISTINCT FROM p_object_id
   OR receipt.expected_version IS DISTINCT FROM p_expected_version
   OR receipt.payload IS DISTINCT FROM p_payload
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;
 IF oldrow.version IS DISTINCT FROM p_expected_version THEN
  RAISE EXCEPTION 'version conflict' USING ERRCODE='PT409';
 END IF;

 SELECT u.email INTO actor_email_value FROM public.users u
  WHERE u.user_id=a.user_id FOR SHARE;
 from_value:=coalesce(oldrow.current_business,oldrow.brand);
 changed_at_value:=clock_timestamp();
 history_entry:=jsonb_build_object(
  'at',changed_at_value,'from',from_value,'to',to_value,
  'reason',reason_value,'source',source_value,'actor',a.display_name);

 UPDATE public.deals d SET
  current_business=to_value,
  brand=to_value,
  origin_business=coalesce(oldrow.origin_business,from_value),
  service_type=to_value,
  business_history=coalesce(oldrow.business_history,'[]'::jsonb)||history_entry,
  last_activity_at=changed_at_value,
  updated_at=changed_at_value,
  version=oldrow.version+1
 WHERE d.id=p_object_id AND d.version=p_expected_version
 RETURNING * INTO newrow;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'unexpected version mutation' USING ERRCODE='PT409';
 END IF;

 INSERT INTO public.business_history(
  deal_id,from_business,to_business,reason,reason_source,actor_name,changed_at)
 VALUES(p_object_id,from_value,to_value,reason_value,source_value,a.display_name,changed_at_value)
 RETURNING id INTO history_id_value;

 INSERT INTO public.activities(
  deal_id,organization_id,actor_email,actor_name,type,detail,occurred_at)
 VALUES(p_object_id,oldrow.organization_id,actor_email_value,a.display_name,
  '사업유형전환',jsonb_build_object(
   'note',coalesce(from_value,'')||' → '||to_value,
   'result',reason_value,
   'meaningful_contact',false,
   'reason_source',source_value),changed_at_value)
 RETURNING id INTO activity_id_value;

 -- Preserve the deployed apply_business_change rule exactly: an optional action is
 -- appended as open/기타, defaults to current_date+3 at +09:00, and does not cancel
 -- prior open rows or rewrite deals.next_action/deals.next_action_date.
 IF next_value IS NOT NULL THEN
  INSERT INTO public.next_actions(
   deal_id,action_type,title,due_at,assignee_name,status)
  VALUES(p_object_id,'기타',next_value,
   coalesce(next_due_value,current_date+3)::timestamptz+interval '9 hours',
   coalesce(a.display_name,'미지정'),'open')
  RETURNING id INTO next_action_id_value;
 END IF;

 INSERT INTO crm_security.audit_events(
  actor_auth_uid,actor_user_id,actor_name,deal_id,action,
  before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,p_object_id,'service_change',
  jsonb_build_object(
   'current_business',oldrow.current_business,'brand',oldrow.brand,
   'origin_business',oldrow.origin_business,'service_type',oldrow.service_type,
   'business_history',oldrow.business_history,'version',oldrow.version),
  jsonb_build_object(
   'current_business',newrow.current_business,'brand',newrow.brand,
   'origin_business',newrow.origin_business,'service_type',newrow.service_type,
   'business_history',newrow.business_history,'version',newrow.version,
   'business_history_id',history_id_value,'activity_id',activity_id_value,
   'next_action_id',next_action_id_value),reason_value,changed_at_value)
 RETURNING event_id INTO event;

 ack:=jsonb_build_object(
  'contract_version',1,'ok',true,'operation','service_change',
  'request_id',p_request_id,'actor_auth_uid',a.auth_uid,
  'actor_user_id',a.user_id,'object_id',p_object_id,
  'previous_version',p_expected_version,'version',newrow.version,
  'from_service',from_value,'to_service',to_value,
  'business_history_id',history_id_value,'activity_id',activity_id_value,
  'next_action_id',next_action_id_value,'audit_event_id',event,
  'replayed',false);
 INSERT INTO crm_security.command_receipts(
  actor_auth_uid,request_id,actor_user_id,operation,object_id,
  expected_version,payload,ack)
 VALUES(a.auth_uid,p_request_id,a.user_id,p_operation,p_object_id,
  p_expected_version,p_payload,ack);
 RETURN ack;
END $fn$;

REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 TO authenticated;
DO $$ DECLARE p record; frozen record; BEGIN
 SELECT * INTO p FROM pg_proc
  WHERE oid='public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure;
 SELECT * INTO frozen FROM pg_proc
  WHERE oid='crm_security.crm_write_command_v2_frozen_20260906(uuid,text,uuid,integer,jsonb)'::regprocedure;
 IF pg_get_userbyid(p.proowner)<>'postgres' OR NOT p.prosecdef
  OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']
  OR has_function_privilege('anon',p.oid,'EXECUTE')
  OR has_function_privilege('service_role',p.oid,'EXECUTE')
  OR NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
  OR EXISTS(SELECT 1 FROM aclexplode(p.proacl) x WHERE x.grantee=0)
  OR frozen.oid IS NULL OR pg_get_userbyid(frozen.proowner)<>'postgres'
  OR NOT frozen.prosecdef OR frozen.proconfig IS DISTINCT FROM ARRAY['search_path=""']
  OR has_function_privilege('anon',frozen.oid,'EXECUTE')
  OR has_function_privilege('authenticated',frozen.oid,'EXECUTE')
  OR has_function_privilege('service_role',frozen.oid,'EXECUTE')
  OR EXISTS(SELECT 1 FROM aclexplode(frozen.proacl) x WHERE x.grantee=0)
 THEN RAISE EXCEPTION 'pipeline service-change ACL/config drift'; END IF;
END $$;
DO $metadata_guard$ DECLARE actual jsonb; BEGIN
-- Read-only catalog metadata only. Never selects customer/Auth rows or Storage files.
-- Run by an authorized reviewer; this file is NOT automatically executed remotely.
WITH rel AS (SELECT c.* FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S')),
fun AS (SELECT p.* FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'),
cols AS (SELECT c.relname AS "table",a.attnum AS ordinal,a.attname AS name,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull AS not_null,pg_get_expr(d.adbin,d.adrelid) AS "default",a.attidentity AS identity,a.attgenerated AS generated,a.attstorage AS storage,a.attcompression AS compression,CASE WHEN a.attcollation=0 THEN NULL ELSE a.attcollation::regcollation::text END AS collation,a.attacl AS acl FROM rel c JOIN pg_attribute a ON a.attrelid=c.oid LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE c.relkind IN ('r','p','v','m') AND a.attnum>0 AND NOT a.attisdropped),
snap AS (SELECT jsonb_build_object(
'version',current_setting('server_version'),'encoding',current_setting('server_encoding'),
'database',(SELECT jsonb_build_object('collate',datcollate,'ctype',datctype,'provider',datlocprovider,'locale',datlocale) FROM pg_database WHERE datname=current_database()),
'schema',(SELECT jsonb_build_object('owner',pg_get_userbyid(nspowner),'acl',nspacl) FROM pg_namespace WHERE nspname='public'),
'relations',(SELECT jsonb_agg(jsonb_build_object('name',relname,'kind',relkind,'owner',pg_get_userbyid(relowner),'acl',relacl,'rls',relrowsecurity,'force_rls',relforcerowsecurity,'options',reloptions,'persistence',relpersistence,'replica_identity',relreplident,'tablespace',reltablespace) ORDER BY relname) FROM rel),
'columns',(SELECT jsonb_agg(to_jsonb(a) ORDER BY "table",ordinal) FROM cols a),
'constraints',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',k.conname,'type',k.contype,'definition',pg_get_constraintdef(k.oid,true),'validated',k.convalidated,'deferrable',k.condeferrable,'deferred',k.condeferred) ORDER BY c.relname,k.conname) FROM rel c JOIN pg_constraint k ON k.conrelid=c.oid),
'indexes',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',ic.relname,'definition',pg_get_indexdef(i.indexrelid),'valid',i.indisvalid,'ready',i.indisready,'clustered',i.indisclustered,'replica_identity',i.indisreplident,'constraint_owned',EXISTS(SELECT 1 FROM pg_constraint k WHERE k.conindid=i.indexrelid AND k.conrelid=c.oid AND k.contype IN ('p','u','x'))) ORDER BY c.relname,ic.relname) FROM rel c JOIN pg_index i ON i.indrelid=c.oid JOIN pg_class ic ON ic.oid=i.indexrelid),
'sequences',(SELECT jsonb_agg(jsonb_build_object('name',c.relname,'type',format_type(s.seqtypid,NULL),'start',s.seqstart::text,'increment',s.seqincrement::text,'min',s.seqmin::text,'max',s.seqmax::text,'cache',s.seqcache::text,'cycle',s.seqcycle,'owned_by',(SELECT format('%I.%I.%I',n.nspname,t.relname,a.attname) FROM pg_depend d JOIN pg_class t ON t.oid=d.refobjid JOIN pg_namespace n ON n.oid=t.relnamespace JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=d.refobjsubid WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.refclassid='pg_class'::regclass AND d.deptype IN ('a','i') LIMIT 1)) ORDER BY c.relname) FROM rel c JOIN pg_sequence s ON s.seqrelid=c.oid),
'functions',(SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'definition',replace(replace(pg_get_functiondef(p.oid),chr(13)||chr(10),chr(10)),chr(13),chr(10)),'owner',pg_get_userbyid(p.proowner),'acl',p.proacl,'security_definer',p.prosecdef,'config',p.proconfig,'language',(SELECT lanname FROM pg_language WHERE oid=p.prolang),'volatility',p.provolatile,'parallel',p.proparallel,'strict',p.proisstrict,'leakproof',p.proleakproof) ORDER BY p.oid::regprocedure::text) FROM fun p WHERE p.prokind IN ('f','p')),
'views',(SELECT jsonb_agg(jsonb_build_object('name',relname,'definition',pg_get_viewdef(oid,true),'options',reloptions,'owner',pg_get_userbyid(relowner),'acl',relacl) ORDER BY relname) FROM rel WHERE relkind='v'),
'triggers',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',t.tgname,'definition',pg_get_triggerdef(t.oid,true),'enabled',t.tgenabled) ORDER BY c.relname,t.tgname) FROM rel c JOIN pg_trigger t ON t.tgrelid=c.oid WHERE NOT t.tgisinternal),
'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY tablename,policyname) FROM pg_policies p WHERE schemaname='public'),
'default_privileges',(SELECT jsonb_agg(jsonb_build_object('creator',pg_get_userbyid(d.defaclrole),'schema',n.nspname,'type',d.defaclobjtype,'acl',d.defaclacl) ORDER BY pg_get_userbyid(d.defaclrole),n.nspname,d.defaclobjtype) FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace WHERE d.defaclnamespace=0 OR n.nspname='public'),
'creators',(SELECT jsonb_agg(jsonb_build_object('role',r.rolname,'can_login',r.rolcanlogin,'superuser',r.rolsuper,'bypass_rls',r.rolbypassrls,'inherit',r.rolinherit,'can_create_public',has_schema_privilege(r.oid,'public','CREATE'),'executor_member',pg_has_role(current_user,r.oid,'MEMBER')) ORDER BY r.rolname) FROM pg_roles r WHERE has_schema_privilege(r.oid,'public','CREATE') OR EXISTS(SELECT 1 FROM fun p WHERE p.proowner=r.oid) OR EXISTS(SELECT 1 FROM pg_default_acl d WHERE d.defaclrole=r.oid AND (d.defaclnamespace=0 OR d.defaclnamespace='public'::regnamespace))),
'extensions',(SELECT jsonb_agg(jsonb_build_object('name',e.extname,'version',e.extversion,'schema',n.nspname,'owner',pg_get_userbyid(e.extowner)) ORDER BY e.extname) FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace),
'custom_types',(SELECT jsonb_agg(jsonb_build_object('name',t.typname,'kind',t.typtype,'base',format_type(t.typbasetype,t.typtypmod))) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typtype IN ('e','d')),
'custom_collations',(SELECT jsonb_agg(jsonb_build_object('name',c.collname,'provider',c.collprovider,'collate',c.collcollate,'ctype',c.collctype,'locale',c.colllocale,'version',c.collversion)) FROM pg_collation c JOIN pg_namespace n ON n.oid=c.collnamespace WHERE n.nspname='public'),
'dependencies',(SELECT jsonb_agg(jsonb_build_object('source',pg_describe_object(d.classid,d.objid,d.objsubid),'target',pg_describe_object(d.refclassid,d.refobjid,d.refobjsubid),'type',d.deptype) ORDER BY d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.refobjsubid) FROM pg_depend d WHERE (d.classid='pg_proc'::regclass AND d.objid IN(SELECT oid FROM fun)) OR (d.classid='pg_rewrite'::regclass AND d.objid IN(SELECT rw.oid FROM pg_rewrite rw JOIN rel c ON c.oid=rw.ev_class)) OR (d.classid='pg_class'::regclass AND d.objid IN(SELECT oid FROM rel)) OR (d.classid='pg_attrdef'::regclass AND d.objid IN(SELECT a.oid FROM pg_attrdef a JOIN rel c ON c.oid=a.adrelid)))
) AS payload) SELECT payload INTO actual FROM snap;

IF md5((actual->'schema')::text) IS DISTINCT FROM '793bc7fc6b640d7fb530c67862bceb9b' THEN RAISE EXCEPTION 'public.schema metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'relations')))::text) IS DISTINCT FROM '55cef2065d9d7899725f14a95ef8bfc9' THEN RAISE EXCEPTION 'public.relations metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'columns')))::text) IS DISTINCT FROM '2c09dda6f06b2a73ef53a877a7c222f5' THEN RAISE EXCEPTION 'public.columns metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'constraints')))::text) IS DISTINCT FROM 'b66207f6371dbfc55f1eb262809daa77' THEN RAISE EXCEPTION 'public.constraints metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'indexes')))::text) IS DISTINCT FROM 'e46e18edd383c0c94a9d307774ab7357' THEN RAISE EXCEPTION 'public.indexes metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'sequences')))::text) IS DISTINCT FROM 'ff220ef0b2fe715b7c6e6080ee5f5493' THEN RAISE EXCEPTION 'public.sequences metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'functions')))::text) IS DISTINCT FROM 'd73698aec5daefc95e1d7fa8c727296f' THEN RAISE EXCEPTION 'public.functions metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'views')))::text) IS DISTINCT FROM '62dd46bb6c0473d80dc32ec8a18f7d30' THEN RAISE EXCEPTION 'public.views metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'triggers')))::text) IS DISTINCT FROM '51befedcd469c20566239cd48918a668' THEN RAISE EXCEPTION 'public.triggers metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'policies')))::text) IS DISTINCT FROM '43460d0b92d895f19d4495bf429bfb21' THEN RAISE EXCEPTION 'public.policies metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'default_privileges')))::text) IS DISTINCT FROM 'fa5134712645b7d90e76a031498fea50' THEN RAISE EXCEPTION 'public.default_privileges metadata drift'; END IF;
IF md5((actual->'custom_types')::text) IS DISTINCT FROM '37a6259cc0c1dae299a7866489dff0bd' THEN RAISE EXCEPTION 'public.custom_types metadata drift'; END IF;
IF md5((actual->'custom_collations')::text) IS DISTINCT FROM '37a6259cc0c1dae299a7866489dff0bd' THEN RAISE EXCEPTION 'public.custom_collations metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'dependencies')))::text) IS DISTINCT FROM '04140a2835ba7a51b879f7d441d8568d' THEN RAISE EXCEPTION 'public.dependencies metadata drift'; END IF;
END $metadata_guard$;
DO $metadata_guard$ DECLARE actual jsonb; BEGIN
-- Read-only catalog metadata only. Never selects customer/Auth rows or Storage files.
-- Run by an authorized reviewer; this file is NOT automatically executed remotely.
WITH rel AS (SELECT c.* FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='crm_security' AND c.relkind IN ('r','p','v','m','S')),
fun AS (SELECT p.* FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='crm_security'),
cols AS (SELECT c.relname AS "table",a.attnum AS ordinal,a.attname AS name,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull AS not_null,pg_get_expr(d.adbin,d.adrelid) AS "default",a.attidentity AS identity,a.attgenerated AS generated,a.attstorage AS storage,a.attcompression AS compression,CASE WHEN a.attcollation=0 THEN NULL ELSE a.attcollation::regcollation::text END AS collation,a.attacl AS acl FROM rel c JOIN pg_attribute a ON a.attrelid=c.oid LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE c.relkind IN ('r','p','v','m') AND a.attnum>0 AND NOT a.attisdropped),
snap AS (SELECT jsonb_build_object(
'version',current_setting('server_version'),'encoding',current_setting('server_encoding'),
'database',(SELECT jsonb_build_object('collate',datcollate,'ctype',datctype,'provider',datlocprovider,'locale',datlocale) FROM pg_database WHERE datname=current_database()),
'schema',(SELECT jsonb_build_object('owner',pg_get_userbyid(nspowner),'acl',nspacl) FROM pg_namespace WHERE nspname='crm_security'),
'relations',(SELECT jsonb_agg(jsonb_build_object('name',relname,'kind',relkind,'owner',pg_get_userbyid(relowner),'acl',relacl,'rls',relrowsecurity,'force_rls',relforcerowsecurity,'options',reloptions,'persistence',relpersistence,'replica_identity',relreplident,'tablespace',reltablespace) ORDER BY relname) FROM rel),
'columns',(SELECT jsonb_agg(to_jsonb(a) ORDER BY "table",ordinal) FROM cols a),
'constraints',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',k.conname,'type',k.contype,'definition',pg_get_constraintdef(k.oid,true),'validated',k.convalidated,'deferrable',k.condeferrable,'deferred',k.condeferred) ORDER BY c.relname,k.conname) FROM rel c JOIN pg_constraint k ON k.conrelid=c.oid),
'indexes',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',ic.relname,'definition',pg_get_indexdef(i.indexrelid),'valid',i.indisvalid,'ready',i.indisready,'clustered',i.indisclustered,'replica_identity',i.indisreplident,'constraint_owned',EXISTS(SELECT 1 FROM pg_constraint k WHERE k.conindid=i.indexrelid AND k.conrelid=c.oid AND k.contype IN ('p','u','x'))) ORDER BY c.relname,ic.relname) FROM rel c JOIN pg_index i ON i.indrelid=c.oid JOIN pg_class ic ON ic.oid=i.indexrelid),
'sequences',(SELECT jsonb_agg(jsonb_build_object('name',c.relname,'type',format_type(s.seqtypid,NULL),'start',s.seqstart::text,'increment',s.seqincrement::text,'min',s.seqmin::text,'max',s.seqmax::text,'cache',s.seqcache::text,'cycle',s.seqcycle,'owned_by',(SELECT format('%I.%I.%I',n.nspname,t.relname,a.attname) FROM pg_depend d JOIN pg_class t ON t.oid=d.refobjid JOIN pg_namespace n ON n.oid=t.relnamespace JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=d.refobjsubid WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.refclassid='pg_class'::regclass AND d.deptype IN ('a','i') LIMIT 1)) ORDER BY c.relname) FROM rel c JOIN pg_sequence s ON s.seqrelid=c.oid),
'functions',(SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'definition',replace(replace(pg_get_functiondef(p.oid),chr(13)||chr(10),chr(10)),chr(13),chr(10)),'owner',pg_get_userbyid(p.proowner),'acl',p.proacl,'security_definer',p.prosecdef,'config',p.proconfig,'language',(SELECT lanname FROM pg_language WHERE oid=p.prolang),'volatility',p.provolatile,'parallel',p.proparallel,'strict',p.proisstrict,'leakproof',p.proleakproof) ORDER BY p.oid::regprocedure::text) FROM fun p WHERE p.prokind IN ('f','p')),
'views',(SELECT jsonb_agg(jsonb_build_object('name',relname,'definition',pg_get_viewdef(oid,true),'options',reloptions,'owner',pg_get_userbyid(relowner),'acl',relacl) ORDER BY relname) FROM rel WHERE relkind='v'),
'triggers',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',t.tgname,'definition',pg_get_triggerdef(t.oid,true),'enabled',t.tgenabled) ORDER BY c.relname,t.tgname) FROM rel c JOIN pg_trigger t ON t.tgrelid=c.oid WHERE NOT t.tgisinternal),
'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY tablename,policyname) FROM pg_policies p WHERE schemaname='crm_security'),
'default_privileges',(SELECT jsonb_agg(jsonb_build_object('creator',pg_get_userbyid(d.defaclrole),'schema',n.nspname,'type',d.defaclobjtype,'acl',d.defaclacl) ORDER BY pg_get_userbyid(d.defaclrole),n.nspname,d.defaclobjtype) FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace WHERE d.defaclnamespace=0 OR n.nspname='crm_security'),
'creators',(SELECT jsonb_agg(jsonb_build_object('role',r.rolname,'can_login',r.rolcanlogin,'superuser',r.rolsuper,'bypass_rls',r.rolbypassrls,'inherit',r.rolinherit,'can_create_public',has_schema_privilege(r.oid,'public','CREATE'),'executor_member',pg_has_role(current_user,r.oid,'MEMBER')) ORDER BY r.rolname) FROM pg_roles r WHERE has_schema_privilege(r.oid,'public','CREATE') OR EXISTS(SELECT 1 FROM fun p WHERE p.proowner=r.oid) OR EXISTS(SELECT 1 FROM pg_default_acl d WHERE d.defaclrole=r.oid AND (d.defaclnamespace=0 OR d.defaclnamespace='crm_security'::regnamespace))),
'extensions',(SELECT jsonb_agg(jsonb_build_object('name',e.extname,'version',e.extversion,'schema',n.nspname,'owner',pg_get_userbyid(e.extowner)) ORDER BY e.extname) FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace),
'custom_types',(SELECT jsonb_agg(jsonb_build_object('name',t.typname,'kind',t.typtype,'base',format_type(t.typbasetype,t.typtypmod))) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='crm_security' AND t.typtype IN ('e','d')),
'custom_collations',(SELECT jsonb_agg(jsonb_build_object('name',c.collname,'provider',c.collprovider,'collate',c.collcollate,'ctype',c.collctype,'locale',c.colllocale,'version',c.collversion)) FROM pg_collation c JOIN pg_namespace n ON n.oid=c.collnamespace WHERE n.nspname='crm_security'),
'dependencies',(SELECT jsonb_agg(jsonb_build_object('source',pg_describe_object(d.classid,d.objid,d.objsubid),'target',pg_describe_object(d.refclassid,d.refobjid,d.refobjsubid),'type',d.deptype) ORDER BY d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.refobjsubid) FROM pg_depend d WHERE (d.classid='pg_proc'::regclass AND d.objid IN(SELECT oid FROM fun)) OR (d.classid='pg_rewrite'::regclass AND d.objid IN(SELECT rw.oid FROM pg_rewrite rw JOIN rel c ON c.oid=rw.ev_class)) OR (d.classid='pg_class'::regclass AND d.objid IN(SELECT oid FROM rel)) OR (d.classid='pg_attrdef'::regclass AND d.objid IN(SELECT a.oid FROM pg_attrdef a JOIN rel c ON c.oid=a.adrelid)))
) AS payload) SELECT payload INTO actual FROM snap;

IF md5((actual->'schema')::text) IS DISTINCT FROM '1b9541895fcea1f9220c33cbf263896e' THEN RAISE EXCEPTION 'crm_security.schema metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'relations')))::text) IS DISTINCT FROM 'b653c7216ca41e6e174f38d73ea76c69' THEN RAISE EXCEPTION 'crm_security.relations metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'columns')))::text) IS DISTINCT FROM '93c9b652f5c6a04fb5147cd2a62d16fa' THEN RAISE EXCEPTION 'crm_security.columns metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'constraints')))::text) IS DISTINCT FROM '46c5a286058d44b0defc7f084a1e43f4' THEN RAISE EXCEPTION 'crm_security.constraints metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'indexes')))::text) IS DISTINCT FROM '43cff5e11244df19020c283997a82fed' THEN RAISE EXCEPTION 'crm_security.indexes metadata drift'; END IF;
IF md5((actual->'sequences')::text) IS DISTINCT FROM '37a6259cc0c1dae299a7866489dff0bd' THEN RAISE EXCEPTION 'crm_security.sequences metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'functions')))::text) IS DISTINCT FROM '015f5073b9cb56d50fca9254944614d2' THEN RAISE EXCEPTION 'crm_security.functions metadata drift'; END IF;
IF md5((actual->'views')::text) IS DISTINCT FROM '37a6259cc0c1dae299a7866489dff0bd' THEN RAISE EXCEPTION 'crm_security.views metadata drift'; END IF;
IF md5((actual->'triggers')::text) IS DISTINCT FROM '37a6259cc0c1dae299a7866489dff0bd' THEN RAISE EXCEPTION 'crm_security.triggers metadata drift'; END IF;
IF md5((actual->'policies')::text) IS DISTINCT FROM '37a6259cc0c1dae299a7866489dff0bd' THEN RAISE EXCEPTION 'crm_security.policies metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'default_privileges')))::text) IS DISTINCT FROM '4828b0ad9c231f5b6d492f0fb4462106' THEN RAISE EXCEPTION 'crm_security.default_privileges metadata drift'; END IF;
IF md5((actual->'custom_types')::text) IS DISTINCT FROM '37a6259cc0c1dae299a7866489dff0bd' THEN RAISE EXCEPTION 'crm_security.custom_types metadata drift'; END IF;
IF md5((actual->'custom_collations')::text) IS DISTINCT FROM '37a6259cc0c1dae299a7866489dff0bd' THEN RAISE EXCEPTION 'crm_security.custom_collations metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'dependencies')))::text) IS DISTINCT FROM '817b4dd5eba53125d6f8db1e8b258c68' THEN RAISE EXCEPTION 'crm_security.dependencies metadata drift'; END IF;
END $metadata_guard$;
COMMIT;

