SET crm.phase1_ref='rprechiaglyjaydkmxsu';
-- Phase 1 only: Staging approval wrapper supplies strict before/after catalog guards.
BEGIN;
SET LOCAL search_path=public,pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
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
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'columns')))::text) IS DISTINCT FROM '01d4e671166f1f3bbdb708da470dff31' THEN RAISE EXCEPTION 'public.columns metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'constraints')))::text) IS DISTINCT FROM '670ce82527917ccebd39bba46b395e82' THEN RAISE EXCEPTION 'public.constraints metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'indexes')))::text) IS DISTINCT FROM 'e46e18edd383c0c94a9d307774ab7357' THEN RAISE EXCEPTION 'public.indexes metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'sequences')))::text) IS DISTINCT FROM 'ff220ef0b2fe715b7c6e6080ee5f5493' THEN RAISE EXCEPTION 'public.sequences metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'functions')))::text) IS DISTINCT FROM '6483bd42eac49b5c286de316f053e3ad' THEN RAISE EXCEPTION 'public.functions metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'views')))::text) IS DISTINCT FROM 'c50422769a9ac1982edb92a6bd0894fe' THEN RAISE EXCEPTION 'public.views metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'triggers')))::text) IS DISTINCT FROM '257d543ef610f2acbc3ebb3efc70af82' THEN RAISE EXCEPTION 'public.triggers metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'policies')))::text) IS DISTINCT FROM '43460d0b92d895f19d4495bf429bfb21' THEN RAISE EXCEPTION 'public.policies metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'default_privileges')))::text) IS DISTINCT FROM 'fa5134712645b7d90e76a031498fea50' THEN RAISE EXCEPTION 'public.default_privileges metadata drift'; END IF;
IF md5((actual->'custom_types')::text) IS DISTINCT FROM '37a6259cc0c1dae299a7866489dff0bd' THEN RAISE EXCEPTION 'public.custom_types metadata drift'; END IF;
IF md5((actual->'custom_collations')::text) IS DISTINCT FROM '37a6259cc0c1dae299a7866489dff0bd' THEN RAISE EXCEPTION 'public.custom_collations metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'dependencies')))::text) IS DISTINCT FROM '03d5e7ccc2c273c7e5fdf954fbf2e563' THEN RAISE EXCEPTION 'public.dependencies metadata drift'; END IF;
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
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'relations')))::text) IS DISTINCT FROM '591e7a83aa35ecb928edaed32e2fa95d' THEN RAISE EXCEPTION 'crm_security.relations metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'columns')))::text) IS DISTINCT FROM '6b76f04c9194bbc2e5e99b14e692a3e7' THEN RAISE EXCEPTION 'crm_security.columns metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'constraints')))::text) IS DISTINCT FROM 'bad8790ff345d723ba55dc29336e99ea' THEN RAISE EXCEPTION 'crm_security.constraints metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'indexes')))::text) IS DISTINCT FROM '8165410ddfffaa20775d2a0ac1f678f3' THEN RAISE EXCEPTION 'crm_security.indexes metadata drift'; END IF;
IF md5((actual->'sequences')::text) IS DISTINCT FROM '37a6259cc0c1dae299a7866489dff0bd' THEN RAISE EXCEPTION 'crm_security.sequences metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'functions')))::text) IS DISTINCT FROM '9b5da5cddc455eccc286329e7d08051a' THEN RAISE EXCEPTION 'crm_security.functions metadata drift'; END IF;
IF md5((actual->'views')::text) IS DISTINCT FROM '37a6259cc0c1dae299a7866489dff0bd' THEN RAISE EXCEPTION 'crm_security.views metadata drift'; END IF;
IF md5((actual->'triggers')::text) IS DISTINCT FROM '37a6259cc0c1dae299a7866489dff0bd' THEN RAISE EXCEPTION 'crm_security.triggers metadata drift'; END IF;
IF md5((actual->'policies')::text) IS DISTINCT FROM '37a6259cc0c1dae299a7866489dff0bd' THEN RAISE EXCEPTION 'crm_security.policies metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'default_privileges')))::text) IS DISTINCT FROM '4828b0ad9c231f5b6d492f0fb4462106' THEN RAISE EXCEPTION 'crm_security.default_privileges metadata drift'; END IF;
IF md5((actual->'custom_types')::text) IS DISTINCT FROM '37a6259cc0c1dae299a7866489dff0bd' THEN RAISE EXCEPTION 'crm_security.custom_types metadata drift'; END IF;
IF md5((actual->'custom_collations')::text) IS DISTINCT FROM '37a6259cc0c1dae299a7866489dff0bd' THEN RAISE EXCEPTION 'crm_security.custom_collations metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'dependencies')))::text) IS DISTINCT FROM 'f604c32027e43be7b51de60aad1b9eee' THEN RAISE EXCEPTION 'crm_security.dependencies metadata drift'; END IF;
END $metadata_guard$;
DO $$ BEGIN
 IF current_user<>'postgres' OR current_setting('crm.phase1_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
 THEN RAISE EXCEPTION 'Explicit Staging Phase 1 approval required'; END IF;
 IF to_regclass('crm_security.command_receipts') IS NOT NULL OR to_regnamespace('crm_phase1_archive') IS NOT NULL
 THEN RAISE EXCEPTION 'Existing Phase 1 state; do not overwrite'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.crm_profile_scoped_v2() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record; sr text; modes jsonb; BEGIN
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT u.role INTO sr FROM public.users u WHERE u.user_id=a.user_id;
 IF sr NOT IN ('rep','admin','dual','viewer') OR a.permission_role NOT IN ('rep','consultation','branch','admin')
 THEN RAISE EXCEPTION 'unsupported role mapping' USING ERRCODE='42501'; END IF;
 -- Mode is presentation, never a substitute for the approved permission/scope ledger.
 modes:=CASE WHEN a.permission_role='admin' AND sr IN ('admin','dual') THEN '["rep","admin"]'::jsonb ELSE '["rep"]'::jsonb END;
 RETURN jsonb_build_object('contract_version',2,'user_id',a.user_id,'auth_uid',a.auth_uid,
  'name',a.display_name,'permission_role',a.permission_role,'source_role',sr,'allowed_modes',modes);
END $fn$;

CREATE TABLE crm_security.command_receipts(
 actor_auth_uid uuid NOT NULL,request_id uuid NOT NULL,actor_user_id uuid NOT NULL,
 operation text NOT NULL CHECK(operation='opportunity_work_set'),object_id uuid NOT NULL,
 expected_version integer NOT NULL,payload jsonb NOT NULL,ack jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(actor_auth_uid,request_id)
);
ALTER TABLE crm_security.command_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE crm_security.command_receipts FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_write_command_v2(p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record; receipt crm_security.command_receipts%ROWTYPE; result jsonb; ack jsonb; BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 -- Approval, identity and explicit scope cannot be revoked midway through a replay.
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.deal_id=p_object_id FOR SHARE;
 PERFORM 1 FROM public.deals d WHERE d.id=p_object_id FOR UPDATE;
 IF NOT crm_security.can_deal(p_object_id,true) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0
 OR p_operation IS DISTINCT FROM 'opportunity_work_set' OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
 THEN RAISE EXCEPTION 'unsupported command' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('primary_work','work_items','reason'))
 OR NOT p_payload ?& ARRAY['primary_work','work_items','reason']
 OR jsonb_typeof(p_payload->'primary_work') IS DISTINCT FROM 'string'
 OR jsonb_typeof(p_payload->'reason') IS DISTINCT FROM 'string'
 THEN RAISE EXCEPTION 'invalid payload; actor is server-owned' USING ERRCODE='22023'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM p_operation
  OR receipt.object_id IS DISTINCT FROM p_object_id OR receipt.expected_version IS DISTINCT FROM p_expected_version
  OR receipt.payload IS DISTINCT FROM p_payload
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;
 result:=public.crm_work_set_scoped_v2(p_object_id,p_payload->>'primary_work',p_payload->'work_items',p_payload->>'reason',p_expected_version,NULL);
 ack:=jsonb_build_object('contract_version',1,'ok',true,'operation',p_operation,'request_id',p_request_id,
  'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'object_id',result->'id',
  'previous_version',p_expected_version,'version',result->'version','audit_event_id',result->'audit_event_id','replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack)
 VALUES(a.auth_uid,p_request_id,a.user_id,p_operation,p_object_id,p_expected_version,p_payload,ack);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_profile_scoped_v2(),public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_profile_scoped_v2(),public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT * FROM pg_proc WHERE oid IN ('public.crm_profile_scoped_v2()'::regprocedure,'public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure) LOOP
  IF pg_get_userbyid(p.proowner)<>'postgres' OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']
   OR has_function_privilege('anon',p.oid,'EXECUTE') OR NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
   OR EXISTS(SELECT 1 FROM aclexplode(p.proacl) x WHERE x.grantee=0 AND x.privilege_type='EXECUTE')
  THEN RAISE EXCEPTION 'Phase 1 function owner/config/effective ACL mismatch'; END IF;
 END LOOP;
 IF (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid='crm_security.command_receipts'::regclass)<>'postgres'
 OR has_table_privilege('anon','crm_security.command_receipts','SELECT')
 OR has_table_privilege('authenticated','crm_security.command_receipts','SELECT')
 THEN RAISE EXCEPTION 'Phase 1 private table mismatch'; END IF;
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
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'columns')))::text) IS DISTINCT FROM '01d4e671166f1f3bbdb708da470dff31' THEN RAISE EXCEPTION 'public.columns metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'constraints')))::text) IS DISTINCT FROM '670ce82527917ccebd39bba46b395e82' THEN RAISE EXCEPTION 'public.constraints metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'indexes')))::text) IS DISTINCT FROM 'e46e18edd383c0c94a9d307774ab7357' THEN RAISE EXCEPTION 'public.indexes metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'sequences')))::text) IS DISTINCT FROM 'ff220ef0b2fe715b7c6e6080ee5f5493' THEN RAISE EXCEPTION 'public.sequences metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'functions')))::text) IS DISTINCT FROM 'a7186e8019ca03240393db5a14daa4b8' THEN RAISE EXCEPTION 'public.functions metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'views')))::text) IS DISTINCT FROM 'c50422769a9ac1982edb92a6bd0894fe' THEN RAISE EXCEPTION 'public.views metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'triggers')))::text) IS DISTINCT FROM '257d543ef610f2acbc3ebb3efc70af82' THEN RAISE EXCEPTION 'public.triggers metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'policies')))::text) IS DISTINCT FROM '43460d0b92d895f19d4495bf429bfb21' THEN RAISE EXCEPTION 'public.policies metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'default_privileges')))::text) IS DISTINCT FROM 'fa5134712645b7d90e76a031498fea50' THEN RAISE EXCEPTION 'public.default_privileges metadata drift'; END IF;
IF md5((actual->'custom_types')::text) IS DISTINCT FROM '37a6259cc0c1dae299a7866489dff0bd' THEN RAISE EXCEPTION 'public.custom_types metadata drift'; END IF;
IF md5((actual->'custom_collations')::text) IS DISTINCT FROM '37a6259cc0c1dae299a7866489dff0bd' THEN RAISE EXCEPTION 'public.custom_collations metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'dependencies')))::text) IS DISTINCT FROM 'c6a9c21f65763c0ac27cc91e633a5bdd' THEN RAISE EXCEPTION 'public.dependencies metadata drift'; END IF;
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
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'relations')))::text) IS DISTINCT FROM '6f93cdfed2cfcded05b9aa8f3b712a2b' THEN RAISE EXCEPTION 'crm_security.relations metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'columns')))::text) IS DISTINCT FROM '259744b3c464cab493105c47ffdfa8bc' THEN RAISE EXCEPTION 'crm_security.columns metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'constraints')))::text) IS DISTINCT FROM 'a2910310c1a039bf1d2fe691bc5af39b' THEN RAISE EXCEPTION 'crm_security.constraints metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'indexes')))::text) IS DISTINCT FROM '8dc393c8d45fd264eca351ebd616334f' THEN RAISE EXCEPTION 'crm_security.indexes metadata drift'; END IF;
IF md5((actual->'sequences')::text) IS DISTINCT FROM '37a6259cc0c1dae299a7866489dff0bd' THEN RAISE EXCEPTION 'crm_security.sequences metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'functions')))::text) IS DISTINCT FROM '9b5da5cddc455eccc286329e7d08051a' THEN RAISE EXCEPTION 'crm_security.functions metadata drift'; END IF;
IF md5((actual->'views')::text) IS DISTINCT FROM '37a6259cc0c1dae299a7866489dff0bd' THEN RAISE EXCEPTION 'crm_security.views metadata drift'; END IF;
IF md5((actual->'triggers')::text) IS DISTINCT FROM '37a6259cc0c1dae299a7866489dff0bd' THEN RAISE EXCEPTION 'crm_security.triggers metadata drift'; END IF;
IF md5((actual->'policies')::text) IS DISTINCT FROM '37a6259cc0c1dae299a7866489dff0bd' THEN RAISE EXCEPTION 'crm_security.policies metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'default_privileges')))::text) IS DISTINCT FROM '4828b0ad9c231f5b6d492f0fb4462106' THEN RAISE EXCEPTION 'crm_security.default_privileges metadata drift'; END IF;
IF md5((actual->'custom_types')::text) IS DISTINCT FROM '37a6259cc0c1dae299a7866489dff0bd' THEN RAISE EXCEPTION 'crm_security.custom_types metadata drift'; END IF;
IF md5((actual->'custom_collations')::text) IS DISTINCT FROM '37a6259cc0c1dae299a7866489dff0bd' THEN RAISE EXCEPTION 'crm_security.custom_collations metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'dependencies')))::text) IS DISTINCT FROM '7263145f1207fe6c88f27db847f24afc' THEN RAISE EXCEPTION 'crm_security.dependencies metadata drift'; END IF;
END $metadata_guard$;
COMMIT;
