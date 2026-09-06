SET crm.v2_staging_ref='rprechiaglyjaydkmxsu'; SET crm.v2_approved='yes';BEGIN; SET LOCAL search_path=public,pg_catalog; SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='60s';
DO $$ BEGIN IF current_user<>'postgres' OR current_setting('crm.v2_staging_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu' OR current_setting('crm.v2_approved',true) IS DISTINCT FROM 'yes' THEN RAISE EXCEPTION 'Staging rollback approval required'; END IF;
IF to_regnamespace('crm_business_archive') IS NOT NULL THEN RAISE EXCEPTION 'Archive already exists'; END IF; END $$;
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
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'functions')))::text) IS DISTINCT FROM '540de8504e9503e2496c92df691c50ae' THEN RAISE EXCEPTION 'public.functions metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'views')))::text) IS DISTINCT FROM 'c50422769a9ac1982edb92a6bd0894fe' THEN RAISE EXCEPTION 'public.views metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'triggers')))::text) IS DISTINCT FROM '257d543ef610f2acbc3ebb3efc70af82' THEN RAISE EXCEPTION 'public.triggers metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'policies')))::text) IS DISTINCT FROM '43460d0b92d895f19d4495bf429bfb21' THEN RAISE EXCEPTION 'public.policies metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'default_privileges')))::text) IS DISTINCT FROM 'fa5134712645b7d90e76a031498fea50' THEN RAISE EXCEPTION 'public.default_privileges metadata drift'; END IF;
IF md5((actual->'custom_types')::text) IS DISTINCT FROM '37a6259cc0c1dae299a7866489dff0bd' THEN RAISE EXCEPTION 'public.custom_types metadata drift'; END IF;
IF md5((actual->'custom_collations')::text) IS DISTINCT FROM '37a6259cc0c1dae299a7866489dff0bd' THEN RAISE EXCEPTION 'public.custom_collations metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'dependencies')))::text) IS DISTINCT FROM 'b2c44739dff3785b42763c6a05a890c8' THEN RAISE EXCEPTION 'public.dependencies metadata drift'; END IF;
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
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'relations')))::text) IS DISTINCT FROM 'bcee5679875bff8d52a7576333d68420' THEN RAISE EXCEPTION 'crm_security.relations metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'columns')))::text) IS DISTINCT FROM '23621db8db53a3a0c885e1efe1805a72' THEN RAISE EXCEPTION 'crm_security.columns metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'constraints')))::text) IS DISTINCT FROM '994ddfa99f0d439c5c8b71552b90fb57' THEN RAISE EXCEPTION 'crm_security.constraints metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'indexes')))::text) IS DISTINCT FROM '338f13956630118a7e4bc857e0475116' THEN RAISE EXCEPTION 'crm_security.indexes metadata drift'; END IF;
IF md5((actual->'sequences')::text) IS DISTINCT FROM '37a6259cc0c1dae299a7866489dff0bd' THEN RAISE EXCEPTION 'crm_security.sequences metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'functions')))::text) IS DISTINCT FROM 'e9fc00613c3a767f970fd881441565db' THEN RAISE EXCEPTION 'crm_security.functions metadata drift'; END IF;
IF md5((actual->'views')::text) IS DISTINCT FROM '37a6259cc0c1dae299a7866489dff0bd' THEN RAISE EXCEPTION 'crm_security.views metadata drift'; END IF;
IF md5((actual->'triggers')::text) IS DISTINCT FROM '37a6259cc0c1dae299a7866489dff0bd' THEN RAISE EXCEPTION 'crm_security.triggers metadata drift'; END IF;
IF md5((actual->'policies')::text) IS DISTINCT FROM '37a6259cc0c1dae299a7866489dff0bd' THEN RAISE EXCEPTION 'crm_security.policies metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'default_privileges')))::text) IS DISTINCT FROM '4828b0ad9c231f5b6d492f0fb4462106' THEN RAISE EXCEPTION 'crm_security.default_privileges metadata drift'; END IF;
IF md5((actual->'custom_types')::text) IS DISTINCT FROM '37a6259cc0c1dae299a7866489dff0bd' THEN RAISE EXCEPTION 'crm_security.custom_types metadata drift'; END IF;
IF md5((actual->'custom_collations')::text) IS DISTINCT FROM '37a6259cc0c1dae299a7866489dff0bd' THEN RAISE EXCEPTION 'crm_security.custom_collations metadata drift'; END IF;
IF md5(((SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'dependencies')))::text) IS DISTINCT FROM '2285c89c0b26a56103c44a809b93e977' THEN RAISE EXCEPTION 'crm_security.dependencies metadata drift'; END IF;
END $metadata_guard$;
LOCK TABLE public.deals,public.inquiries,public.next_actions IN SHARE MODE;
LOCK TABLE crm_security.business_events,crm_security.assignment_rules IN ACCESS EXCLUSIVE MODE;
DROP FUNCTION public.crm_activity_add_scoped_v2(text,uuid,text,text,text) RESTRICT;
DROP FUNCTION public.crm_assign_scoped_v2(text,uuid,uuid,text,text) RESTRICT;
DROP FUNCTION public.crm_assignment_targets_scoped_v2(text,uuid) RESTRICT;
DROP FUNCTION public.crm_dashboard_scoped_v2(date,date,text,uuid) RESTRICT;
DROP FUNCTION public.crm_deal_amount_scoped_v2(uuid,bigint,integer,text) RESTRICT;
DROP FUNCTION public.crm_deal_stage_scoped_v2(uuid,text,integer,text) RESTRICT;
DROP FUNCTION public.crm_deals_scoped_v2(uuid,integer) RESTRICT;
DROP FUNCTION public.crm_inquiries_scoped_v2(uuid,integer) RESTRICT;
DROP FUNCTION public.crm_inquiry_response_scoped_v2(uuid,text,text) RESTRICT;
DROP FUNCTION public.crm_inquiry_status_scoped_v2(uuid,text,text,text) RESTRICT;
DROP FUNCTION public.crm_next_add_scoped_v2(text,uuid,text,text,timestamp with time zone,text) RESTRICT;
DROP FUNCTION public.crm_next_complete_scoped_v2(uuid,text) RESTRICT;
DROP FUNCTION public.crm_today_scoped_v2(date) RESTRICT;
DROP FUNCTION crm_security.business_can_write(text,uuid) RESTRICT;
DROP FUNCTION crm_security.business_lock(text,uuid,text) RESTRICT;
DROP FUNCTION crm_security.business_log(text,uuid,text,jsonb,jsonb,text) RESTRICT;
DROP FUNCTION public.crm_work_set_scoped_v2(uuid,text,jsonb,text,integer) RESTRICT;
CREATE OR REPLACE FUNCTION public.crm_work_set_scoped_v2(p_opportunity_id uuid, p_primary_work text, p_work_items jsonb, p_reason text, p_expected_version integer, p_actor_name text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE a record; oldrow public.deals%ROWTYPE; newrow public.deals%ROWTYPE; n integer; work_summary_value text; event uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 -- Lock authorization rows against concurrent revocation/identity edits for this write.
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.deal_id=p_opportunity_id FOR SHARE;
 IF NOT crm_security.can_deal(p_opportunity_id,true) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_reason IS NULL OR length(trim(p_reason))<5 OR length(p_reason)>2000 OR p_work_items IS NULL OR jsonb_typeof(p_work_items)<>'array'
 OR p_expected_version IS NULL THEN RAISE EXCEPTION 'invalid work contract' USING ERRCODE='22023'; END IF;
 n:=jsonb_array_length(p_work_items);
 IF n<1 OR n>20 OR p_primary_work IS NULL OR length(trim(p_primary_work))<1 OR length(p_primary_work)>100 OR NOT(p_work_items ? p_primary_work)
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_work_items) x WHERE jsonb_typeof(x)<>'string')
 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_work_items) x WHERE length(trim(x))<1 OR length(x)>100)
 OR (SELECT count(DISTINCT x) FROM jsonb_array_elements_text(p_work_items) x)<>n THEN RAISE EXCEPTION 'invalid work items' USING ERRCODE='22023'; END IF;
 SELECT * INTO oldrow FROM public.deals WHERE id=p_opportunity_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF oldrow.version<>p_expected_version THEN RAISE EXCEPTION 'version conflict' USING ERRCODE='PT409'; END IF;
 IF (a.permission_role='rep' AND oldrow.owner_id IS DISTINCT FROM a.user_id) OR NOT crm_security.can_deal(p_opportunity_id,true)
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT string_agg(x,' / ' ORDER BY ord) INTO work_summary_value FROM jsonb_array_elements_text(p_work_items) WITH ORDINALITY t(x,ord);
 UPDATE public.deals SET primary_work=p_primary_work,work_items=p_work_items,work_scope_type=CASE WHEN n=1 THEN 'single' ELSE 'multi' END,
 work_summary=work_summary_value,version=version+1 WHERE id=p_opportunity_id RETURNING * INTO newrow;
 -- Client p_actor_name is deliberately ignored. No user_metadata/name/email authorization.
 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason)
 VALUES(a.auth_uid,a.user_id,a.display_name,p_opportunity_id,'work_set',
 jsonb_build_object('primary_work',oldrow.primary_work,'work_items',oldrow.work_items,'work_scope_type',oldrow.work_scope_type,'work_summary',oldrow.work_summary,'version',oldrow.version,'updated_at',oldrow.updated_at),
 jsonb_build_object('primary_work',newrow.primary_work,'work_items',newrow.work_items,'work_scope_type',newrow.work_scope_type,'work_summary',newrow.work_summary,'version',newrow.version,'updated_at',newrow.updated_at),p_reason) RETURNING event_id INTO event;
 RETURN jsonb_build_object('id',newrow.id,'version',newrow.version,'audit_event_id',event);
END $function$
;
REVOKE EXECUTE ON FUNCTION public.crm_work_set_scoped_v2(uuid,text,jsonb,text,integer,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_work_set_scoped_v2(uuid,text,jsonb,text,integer,text) TO authenticated;
DO $archive$ BEGIN IF EXISTS(SELECT 1 FROM crm_security.business_events) OR EXISTS(SELECT 1 FROM crm_security.assignment_rules) THEN
 CREATE SCHEMA crm_business_archive AUTHORIZATION postgres; REVOKE ALL ON SCHEMA crm_business_archive FROM PUBLIC,anon,authenticated,service_role;
 ALTER TABLE crm_security.business_events SET SCHEMA crm_business_archive; ALTER TABLE crm_security.assignment_rules SET SCHEMA crm_business_archive;
 ELSE DROP TABLE crm_security.business_events RESTRICT; DROP TABLE crm_security.assignment_rules RESTRICT; END IF; END $archive$;
UPDATE crm_security.object_scope SET can_write=false WHERE scope_id IN('f6090500-0010-4000-8000-000000000004','f6090500-0010-4000-8000-000000000006') AND inquiry_id='f6090500-0005-4000-8000-000000000005' AND user_id IN('f6090500-0001-4000-8000-000000000005','f6090500-0001-4000-8000-000000000006');
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
COMMIT;