SET crm.v2_staging_ref='rprechiaglyjaydkmxsu'; SET crm.v2_approved='yes';BEGIN; SET LOCAL search_path=public,pg_catalog; SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='60s';
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
DO $$ BEGIN IF current_user<>'postgres' OR current_setting('crm.v2_staging_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu' OR current_setting('crm.v2_approved',true) IS DISTINCT FROM 'yes' THEN RAISE EXCEPTION 'Staging business approval required'; END IF;
IF to_regclass('crm_security.business_events') IS NOT NULL OR to_regnamespace('crm_business_archive') IS NOT NULL THEN RAISE EXCEPTION 'Existing business layer'; END IF; END $$;
-- Function bodies used only by the guarded Staging business-contract builder.
CREATE TABLE crm_security.business_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_kind text NOT NULL CHECK(entity_kind IN('deal','inquiry')),
 object_id uuid NOT NULL, action text NOT NULL, actor_auth_uid uuid NOT NULL, actor_user_id uuid NOT NULL,
 actor_name text NOT NULL, before_data jsonb NOT NULL, after_data jsonb NOT NULL, reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE crm_security.assignment_rules(
 actor_user_id uuid NOT NULL REFERENCES public.users(user_id), entity_kind text NOT NULL CHECK(entity_kind IN('deal','inquiry')),
 object_id uuid NOT NULL, target_user_id uuid NOT NULL REFERENCES public.users(user_id), expires_at timestamptz NOT NULL,
 PRIMARY KEY(actor_user_id,entity_kind,object_id,target_user_id)
);
ALTER TABLE crm_security.business_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_security.assignment_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE crm_security.business_events,crm_security.assignment_rules FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.business_can_write(k text,target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT CASE WHEN k='deal' THEN crm_security.can_deal(target,true) WHEN k='inquiry' THEN EXISTS(
 SELECT 1 FROM crm_security.actor() a JOIN public.inquiries i ON i.id=target WHERE
 (a.permission_role IN('rep','consultation') AND i.assigned_to=a.user_id) OR
 (a.permission_role IN('branch','admin') AND EXISTS(SELECT 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.inquiry_id=target AND s.can_write AND s.expires_at>now()))) ELSE false END
$fn$;
CREATE FUNCTION crm_security.business_lock(k text,target uuid,token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE r jsonb; BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.users WHERE auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review WHERE reviewed_auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.object_scope s JOIN crm_security.actor() a ON a.user_id=s.user_id WHERE s.deal_id=target OR s.inquiry_id=target FOR SHARE OF s;
 IF NOT crm_security.business_can_write(k,target) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF k='deal' THEN SELECT to_jsonb(d) INTO r FROM public.deals d WHERE id=target FOR UPDATE;
 ELSE SELECT to_jsonb(i) INTO r FROM public.inquiries i WHERE id=target FOR UPDATE; END IF;
 IF r IS NULL OR NOT crm_security.business_can_write(k,target) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF token IS NULL OR (k='deal' AND r->>'version' IS DISTINCT FROM token) OR (k='inquiry' AND (r->>'updated_at')::timestamptz IS DISTINCT FROM token::timestamptz) THEN RAISE EXCEPTION 'version conflict' USING ERRCODE='PT409'; END IF;
 RETURN r;
END $fn$;
CREATE FUNCTION crm_security.business_log(k text,target uuid,act text,before_row jsonb,after_row jsonb,why text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record; eid uuid; BEGIN
 SELECT * INTO a FROM crm_security.actor(); IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF why IS NULL OR length(trim(why))<2 OR length(why)>2000 THEN RAISE EXCEPTION 'reason required' USING ERRCODE='22023'; END IF;
 INSERT INTO crm_security.business_events(entity_kind,object_id,action,actor_auth_uid,actor_user_id,actor_name,before_data,after_data,reason)
 VALUES(k,target,act,a.auth_uid,a.user_id,a.display_name,before_row,after_row,why) RETURNING id INTO eid;
 RETURN eid;
END $fn$;
CREATE FUNCTION public.crm_deals_scoped_v2(p_after uuid DEFAULT NULL,p_limit integer DEFAULT 100) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE rows jsonb; total bigint; BEGIN
 IF NOT EXISTS(SELECT 1 FROM crm_security.actor()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>100 THEN RAISE EXCEPTION 'invalid limit' USING ERRCODE='22023'; END IF;
 SELECT count(*) INTO total FROM public.deals d WHERE crm_security.can_deal(d.id,false) AND (p_after IS NULL OR d.id>p_after);
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.id),'[]') INTO rows FROM(
 SELECT d.id,d.site_id,s.site_name,d.owner_id,u.name AS owner_name,d.brand,d.stage_code,d.amount::text AS amount,d.version,d.primary_work,d.work_items,d.work_summary,d.created_at,d.stage_entered_at,d.last_activity_at,d.lifecycle_status,
 crm_security.business_can_write('deal',d.id) can_write,EXISTS(SELECT 1 FROM crm_security.assignment_rules ar JOIN crm_security.actor() a ON a.user_id=ar.actor_user_id WHERE ar.entity_kind='deal' AND ar.object_id=d.id AND ar.expires_at>now()) can_assign
 FROM public.deals d LEFT JOIN public.sites s ON s.site_id=d.site_id LEFT JOIN public.users u ON u.user_id=d.owner_id
 WHERE crm_security.can_deal(d.id,false) AND (p_after IS NULL OR d.id>p_after) ORDER BY d.id LIMIT p_limit) q;
 RETURN jsonb_build_object('contract_version',3,'coverage',CASE WHEN total>p_limit THEN 'partial' ELSE 'complete' END,'scope','authorized_only','rows',rows,'has_more',total>p_limit);
END $fn$;
CREATE FUNCTION public.crm_inquiries_scoped_v2(p_after uuid DEFAULT NULL,p_limit integer DEFAULT 100) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE rows jsonb; total bigint; BEGIN
 IF NOT EXISTS(SELECT 1 FROM crm_security.actor()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>100 THEN RAISE EXCEPTION 'invalid limit' USING ERRCODE='22023'; END IF;
 SELECT count(*) INTO total FROM public.inquiries i WHERE crm_security.can_inquiry(i.id) AND (p_after IS NULL OR i.id>p_after);
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.id),'[]') INTO rows FROM(
 SELECT i.id,i.site_id,i.site_name,i.brand,i.address,i.contact_name,i.phone,i.work_type,coalesce(i.raw->>'message',i.raw->>'inquiry',i.raw->>'note') content,i.status,i.received_at,i.created_at,i.assigned_to,u.name AS owner_name,i.assigned_at,i.first_response_at,i.responded_at,i.next_action_date,i.updated_at,
 CASE WHEN i.deal_id IS NOT NULL AND crm_security.can_deal(i.deal_id,false) THEN i.deal_id ELSE NULL END AS deal_id,
 crm_security.business_can_write('inquiry',i.id) can_write,EXISTS(SELECT 1 FROM crm_security.assignment_rules ar JOIN crm_security.actor() a ON a.user_id=ar.actor_user_id WHERE ar.entity_kind='inquiry' AND ar.object_id=i.id AND ar.expires_at>now()) can_assign
 FROM public.inquiries i LEFT JOIN public.users u ON u.user_id=i.assigned_to WHERE crm_security.can_inquiry(i.id) AND (p_after IS NULL OR i.id>p_after) ORDER BY i.id LIMIT p_limit) q;
 RETURN jsonb_build_object('contract_version',3,'coverage',CASE WHEN total>p_limit THEN 'partial' ELSE 'complete' END,'scope','authorized_only','rows',rows,'has_more',total>p_limit);
END $fn$;
CREATE FUNCTION public.crm_dashboard_scoped_v2(p_from date DEFAULT NULL,p_to date DEFAULT NULL,p_brand text DEFAULT NULL,p_owner uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record; groups jsonb; n bigint; unknowns bigint; amount_value numeric; ni bigint; BEGIN
 SELECT * INTO a FROM crm_security.actor(); IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF (p_from IS NOT NULL AND p_to IS NOT NULL AND p_from>p_to) THEN RAISE EXCEPTION 'invalid period' USING ERRCODE='22023'; END IF;
 SELECT count(*) INTO ni FROM public.inquiries i WHERE crm_security.can_inquiry(i.id) AND (p_brand IS NULL OR i.brand=p_brand) AND (p_owner IS NULL OR i.assigned_to=p_owner)
 AND (p_from IS NULL OR coalesce(i.received_at,i.created_at)>=(p_from::timestamp AT TIME ZONE 'Asia/Seoul')) AND (p_to IS NULL OR coalesce(i.received_at,i.created_at)<((p_to+1)::timestamp AT TIME ZONE 'Asia/Seoul'));
 IF a.permission_role='consultation' THEN RETURN jsonb_build_object('contract_version',3,'coverage','complete','scope','authorized_only','company_coverage','partial','inquiries',ni,'sales_status','unavailable','deals',NULL,'amount',NULL,'groups','[]'::jsonb); END IF;
 WITH allowed AS (SELECT d.* FROM public.deals d WHERE crm_security.can_deal(d.id,false) AND (p_brand IS NULL OR d.brand=p_brand) AND (p_owner IS NULL OR d.owner_id=p_owner)
 AND (p_from IS NULL OR d.created_at>=(p_from::timestamp AT TIME ZONE 'Asia/Seoul')) AND (p_to IS NULL OR d.created_at<((p_to+1)::timestamp AT TIME ZONE 'Asia/Seoul')))
 SELECT count(*),count(*) FILTER(WHERE amount IS NULL),sum(amount),
 (SELECT coalesce(jsonb_agg(to_jsonb(g)),'[]') FROM(SELECT brand,stage_code,owner_id,count(*) count,sum(amount)::text amount FROM allowed GROUP BY brand,stage_code,owner_id ORDER BY brand,stage_code,owner_id) g)
 INTO n,unknowns,amount_value,groups FROM allowed;
 RETURN jsonb_build_object('contract_version',3,'coverage','complete','scope','authorized_only','company_coverage','partial','sales_status','available','deals',n,'inquiries',ni,'amount',coalesce(amount_value,0)::text,'unknown_amount_count',unknowns,'groups',groups);
END $fn$;
CREATE FUNCTION public.crm_assignment_targets_scoped_v2(p_kind text,p_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF NOT crm_security.business_can_write(p_kind,p_id) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('user_id',u.user_id,'name',u.name) ORDER BY u.user_id),'[]')
 FROM crm_security.assignment_rules r JOIN crm_security.actor() a ON a.user_id=r.actor_user_id AND a.permission_role='admin'
 JOIN public.users u ON u.user_id=r.target_user_id JOIN crm_security.access_review ar ON ar.user_id=u.user_id AND ar.reviewed_auth_uid=u.auth_uid AND ar.source_role=u.role
 WHERE r.entity_kind=p_kind AND r.object_id=p_id AND r.expires_at>now() AND ar.approved AND ar.expires_at>now() AND u.active
 AND u.auth_uid IS NOT NULL AND (SELECT count(*) FROM public.users du WHERE du.auth_uid=u.auth_uid)=1
 AND (p_kind='inquiry' OR ar.permission_role<>'consultation')
 AND (ar.permission_role NOT IN('branch','admin') OR EXISTS(SELECT 1 FROM crm_security.object_scope ts WHERE ts.user_id=u.user_id AND ts.expires_at>now() AND ((p_kind='deal' AND ts.deal_id=p_id) OR (p_kind='inquiry' AND ts.inquiry_id=p_id)))));
END $fn$;
CREATE FUNCTION public.crm_assign_scoped_v2(p_kind text,p_id uuid,p_target uuid,p_token text,p_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE oldrow jsonb; result jsonb; target_name text; BEGIN
 oldrow:=crm_security.business_lock(p_kind,p_id,p_token);
 PERFORM 1 FROM public.users WHERE user_id=p_target FOR SHARE;
 PERFORM 1 FROM crm_security.access_review WHERE user_id=p_target FOR SHARE;
 PERFORM 1 FROM crm_security.assignment_rules r WHERE r.entity_kind=p_kind AND r.object_id=p_id AND r.target_user_id=p_target FOR SHARE;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.crm_assignment_targets_scoped_v2(p_kind,p_id)) t WHERE (t->>'user_id')::uuid=p_target) THEN RAISE EXCEPTION 'assignment forbidden' USING ERRCODE='42501'; END IF;
 SELECT name INTO target_name FROM public.users WHERE user_id=p_target AND active FOR SHARE;
 IF p_kind='deal' THEN UPDATE public.deals SET owner_id=p_target,assignee_name=target_name,assignee_email=NULL,version=version+1 WHERE id=p_id RETURNING to_jsonb(deals) INTO result;
 ELSE UPDATE public.inquiries SET assigned_to=p_target,assignee_name=target_name,assigned_at=now(),updated_at=clock_timestamp() WHERE id=p_id RETURNING to_jsonb(inquiries) INTO result; END IF;
 PERFORM crm_security.business_log(p_kind,p_id,'assignment',oldrow,result,p_reason);
 RETURN jsonb_build_object('id',p_id,'saved',true);
END $fn$;
CREATE FUNCTION public.crm_inquiry_status_scoped_v2(p_id uuid,p_status text,p_token text,p_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE oldrow jsonb; result jsonb; BEGIN
 oldrow:=crm_security.business_lock('inquiry',p_id,p_token);
 IF p_status IS NULL OR p_status NOT IN('접수','배정완료','응대중','전화응대 완료','현장방문예정','견적진행','종료') THEN RAISE EXCEPTION 'invalid status' USING ERRCODE='22023'; END IF;
 UPDATE public.inquiries SET status=p_status,close_reason=CASE WHEN p_status='종료' THEN p_reason ELSE NULL END,updated_at=clock_timestamp() WHERE id=p_id RETURNING to_jsonb(inquiries) INTO result;
 PERFORM crm_security.business_log('inquiry',p_id,'status',oldrow,result,p_reason); RETURN jsonb_build_object('id',p_id,'saved',true);
END $fn$;
CREATE FUNCTION public.crm_inquiry_response_scoped_v2(p_id uuid,p_note text,p_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE oldrow jsonb; result jsonb; BEGIN
 oldrow:=crm_security.business_lock('inquiry',p_id,p_token);
 UPDATE public.inquiries SET first_response_at=coalesce(first_response_at,now()),responded_at=now(),status='전화응대 완료',updated_at=clock_timestamp() WHERE id=p_id RETURNING to_jsonb(inquiries) INTO result;
 PERFORM crm_security.business_log('inquiry',p_id,'response',oldrow,result,p_note); RETURN jsonb_build_object('id',p_id,'saved',true);
END $fn$;
CREATE FUNCTION public.crm_deal_stage_scoped_v2(p_id uuid,p_stage text,p_version integer,p_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE oldrow jsonb; result jsonb; outcome_value text; BEGIN
 oldrow:=crm_security.business_lock('deal',p_id,p_version::text);
 IF p_stage IS NULL OR p_stage NOT IN('first_contact','consulting','sent','rapport','silent','waiting','compete','imminent','bidding','contract','construction','completion','won','lost','badfit','badfit_lead','badfit_pipe','nocontact') THEN RAISE EXCEPTION 'invalid stage' USING ERRCODE='22023'; END IF;
 outcome_value:=CASE WHEN p_stage IN('won','lost','nocontact') THEN p_stage WHEN p_stage IN('badfit','badfit_lead','badfit_pipe') THEN 'badfit' ELSE NULL END;
 UPDATE public.deals SET stage_code=p_stage,stage_raw=p_stage,stage_group=CASE WHEN outcome_value IS NOT NULL THEN 'closed' WHEN p_stage IN('first_contact','consulting') THEN 'design' WHEN p_stage='sent' THEN 'sent' WHEN p_stage IN('rapport','silent','waiting') THEN 'rel' WHEN p_stage IN('compete','imminent','bidding') THEN 'comp' ELSE 'con' END,stage_entered_at=now(),outcome=outcome_value,lifecycle_status=CASE WHEN outcome_value IS NOT NULL THEN 'closed' WHEN p_stage='waiting' THEN 'parked' ELSE 'active' END,closed_at=CASE WHEN outcome_value IS NOT NULL THEN now() ELSE NULL END,version=version+1 WHERE id=p_id RETURNING to_jsonb(deals) INTO result;
 PERFORM crm_security.business_log('deal',p_id,'stage',oldrow,result,p_reason); RETURN jsonb_build_object('id',p_id,'version',result->'version');
END $fn$;
CREATE FUNCTION public.crm_deal_amount_scoped_v2(p_id uuid,p_amount bigint,p_version integer,p_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE oldrow jsonb; result jsonb; BEGIN
 oldrow:=crm_security.business_lock('deal',p_id,p_version::text);
 IF p_amount IS NULL OR p_amount<0 OR p_amount>9007199254740991 THEN RAISE EXCEPTION 'invalid amount' USING ERRCODE='22023'; END IF;
 UPDATE public.deals SET amount=p_amount,version=version+1 WHERE id=p_id RETURNING to_jsonb(deals) INTO result;
 PERFORM crm_security.business_log('deal',p_id,'amount',oldrow,result,p_reason); RETURN jsonb_build_object('id',p_id,'version',result->'version');
END $fn$;
CREATE FUNCTION public.crm_activity_add_scoped_v2(p_kind text,p_id uuid,p_type text,p_note text,p_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE oldrow jsonb; a record; eid uuid; BEGIN
 oldrow:=crm_security.business_lock(p_kind,p_id,p_token); SELECT * INTO a FROM crm_security.actor();
 IF p_type IS NULL OR p_type NOT IN('전화','미팅','업무','메모') THEN RAISE EXCEPTION 'invalid activity type' USING ERRCODE='22023'; END IF;
 IF p_kind='deal' THEN UPDATE public.deals SET last_activity_at=now(),last_customer_contact_at=CASE WHEN p_type IN('전화','미팅') THEN now() ELSE last_customer_contact_at END,version=version+1 WHERE id=p_id;
 ELSE UPDATE public.inquiries SET updated_at=clock_timestamp() WHERE id=p_id; END IF;
 eid:=crm_security.business_log(p_kind,p_id,'activity',oldrow,jsonb_build_object('type',p_type,'note',p_note),p_note);
 RETURN jsonb_build_object('id',eid,'saved',true);
END $fn$;
CREATE FUNCTION public.crm_next_add_scoped_v2(p_kind text,p_id uuid,p_type text,p_title text,p_due timestamptz,p_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE oldrow jsonb; na jsonb; owner_name text; BEGIN
 oldrow:=crm_security.business_lock(p_kind,p_id,p_token);
 IF p_title IS NULL OR length(trim(p_title))<2 OR length(p_title)>500 OR p_due IS NULL OR NOT isfinite(p_due) OR p_type IS NULL OR p_type NOT IN('전화','미팅','업무','후속확인') THEN RAISE EXCEPTION 'invalid next action' USING ERRCODE='22023'; END IF;
 SELECT name INTO owner_name FROM public.users WHERE user_id=CASE WHEN p_kind='deal' THEN (oldrow->>'owner_id')::uuid ELSE (oldrow->>'assigned_to')::uuid END;
 IF owner_name IS NULL THEN RAISE EXCEPTION 'No UUID owner' USING ERRCODE='42501'; END IF;
 INSERT INTO public.next_actions(deal_id,inquiry_id,action_type,title,due_at,assignee_name) VALUES(CASE WHEN p_kind='deal' THEN p_id END,CASE WHEN p_kind='inquiry' THEN p_id END,p_type,p_title,p_due,owner_name) RETURNING to_jsonb(next_actions) INTO na;
 IF p_kind='deal' THEN UPDATE public.deals SET next_action=p_title,next_action_date=(p_due AT TIME ZONE 'Asia/Seoul')::date,version=version+1 WHERE id=p_id;
 ELSE UPDATE public.inquiries SET next_action_date=(p_due AT TIME ZONE 'Asia/Seoul')::date,updated_at=clock_timestamp() WHERE id=p_id; END IF;
 PERFORM crm_security.business_log(p_kind,p_id,'next_action',oldrow,na,p_title); RETURN jsonb_build_object('id',na->'id','saved',true);
END $fn$;
CREATE FUNCTION public.crm_today_scoped_v2(p_day date DEFAULT (now() AT TIME ZONE 'Asia/Seoul')::date) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE tasks jsonb; missed jsonb; events jsonb; n bigint; m bigint; BEGIN
 IF NOT EXISTS(SELECT 1 FROM crm_security.actor()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_day IS NULL THEN RAISE EXCEPTION 'invalid day' USING ERRCODE='22023'; END IF;
 SELECT count(*) INTO n FROM public.next_actions na WHERE na.status='open' AND (crm_security.can_deal(na.deal_id,false) OR crm_security.can_inquiry(na.inquiry_id));
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.due_at,q.id),'[]') INTO tasks FROM(
 SELECT na.id,CASE WHEN na.deal_id IS NULL THEN 'inquiry' ELSE 'deal' END entity_kind,coalesce(na.deal_id,na.inquiry_id) object_id,na.title,na.action_type,na.due_at,na.status,
 CASE WHEN (na.due_at AT TIME ZONE 'Asia/Seoul')::date<p_day THEN 'overdue' WHEN (na.due_at AT TIME ZONE 'Asia/Seoul')::date=p_day THEN 'today' ELSE 'upcoming' END bucket
 FROM public.next_actions na WHERE na.status='open' AND (crm_security.can_deal(na.deal_id,false) OR crm_security.can_inquiry(na.inquiry_id)) ORDER BY due_at,id LIMIT 100) q;
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.id),'[]') INTO missed FROM(SELECT i.id,i.site_name,'inquiry'::text entity_kind FROM public.inquiries i WHERE crm_security.can_inquiry(i.id) AND i.first_response_at IS NULL AND coalesce(i.status,'')<>'종료' ORDER BY id LIMIT 100) q;
 SELECT count(*) INTO m FROM public.inquiries i WHERE crm_security.can_inquiry(i.id) AND i.first_response_at IS NULL AND coalesce(i.status,'')<>'종료';
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC),'[]') INTO events FROM(
 SELECT * FROM (SELECT e.id,e.entity_kind,e.object_id,e.action,e.actor_name,e.reason,e.created_at FROM crm_security.business_events e WHERE (e.entity_kind='deal' AND crm_security.can_deal(e.object_id,false)) OR (e.entity_kind='inquiry' AND crm_security.can_inquiry(e.object_id))
 UNION ALL SELECT a.id,'deal',a.deal_id,a.type,a.actor_name,coalesce(a.detail->>'note',a.type),a.occurred_at FROM public.activities a WHERE crm_security.can_deal(a.deal_id,false)) all_events ORDER BY created_at DESC,id LIMIT 30) q;
 RETURN jsonb_build_object('contract_version',3,'coverage',CASE WHEN n>100 OR m>100 THEN 'partial' ELSE 'complete' END,'scope','authorized_only','tasks',tasks,'unresponded',missed,'recent_activity',events,'day',p_day);
END $fn$;
CREATE FUNCTION public.crm_next_complete_scoped_v2(p_action_id uuid,p_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE na public.next_actions%ROWTYPE; k text; target uuid; oldrow jsonb; BEGIN
 SELECT * INTO na FROM public.next_actions WHERE id=p_action_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 k:=CASE WHEN na.deal_id IS NULL THEN 'inquiry' ELSE 'deal' END; target:=coalesce(na.deal_id,na.inquiry_id);
 oldrow:=crm_security.business_lock(k,target,p_token);
 UPDATE public.next_actions SET status='completed',completed_at=now() WHERE id=p_action_id AND status='open';
 IF NOT FOUND THEN RAISE EXCEPTION 'action already closed' USING ERRCODE='PT409'; END IF;
 IF k='deal' THEN UPDATE public.deals SET version=version+1 WHERE id=target; ELSE UPDATE public.inquiries SET updated_at=clock_timestamp() WHERE id=target; END IF;
 PERFORM crm_security.business_log(k,target,'next_complete',to_jsonb(na),jsonb_build_object('id',p_action_id,'status','completed'),'다음 행동 완료'); RETURN jsonb_build_object('id',p_action_id,'saved',true);
END $fn$;

DROP FUNCTION public.crm_work_set_scoped_v2(uuid,text,jsonb,text,integer,text) RESTRICT;
CREATE OR REPLACE FUNCTION public.crm_work_set_scoped_v2(p_opportunity_id uuid, p_primary_work text, p_work_items jsonb, p_reason text, p_expected_version integer)
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
 -- Actor has no client parameter; server identity only.
 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason)
 VALUES(a.auth_uid,a.user_id,a.display_name,p_opportunity_id,'work_set',
 jsonb_build_object('primary_work',oldrow.primary_work,'work_items',oldrow.work_items,'work_scope_type',oldrow.work_scope_type,'work_summary',oldrow.work_summary,'version',oldrow.version,'updated_at',oldrow.updated_at),
 jsonb_build_object('primary_work',newrow.primary_work,'work_items',newrow.work_items,'work_scope_type',newrow.work_scope_type,'work_summary',newrow.work_summary,'version',newrow.version,'updated_at',newrow.updated_at),p_reason) RETURNING event_id INTO event;
 RETURN jsonb_build_object('id',newrow.id,'version',newrow.version,'audit_event_id',event);
END $function$
;
DO $acl$ DECLARE f record; matched integer:=0; BEGIN
 FOR f IN SELECT p.oid,p.proname,p.proowner,p.proconfig,n.nspname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname||'.'||p.proname IN('crm_security.business_can_write','crm_security.business_lock','crm_security.business_log','public.crm_deals_scoped_v2','public.crm_inquiries_scoped_v2','public.crm_dashboard_scoped_v2','public.crm_assignment_targets_scoped_v2','public.crm_assign_scoped_v2','public.crm_inquiry_status_scoped_v2','public.crm_inquiry_response_scoped_v2','public.crm_deal_stage_scoped_v2','public.crm_deal_amount_scoped_v2','public.crm_activity_add_scoped_v2','public.crm_next_add_scoped_v2','public.crm_today_scoped_v2','public.crm_next_complete_scoped_v2','public.crm_work_set_scoped_v2') LOOP
 matched:=matched+1;
 IF f.proowner<>'postgres'::regrole OR f.proconfig IS DISTINCT FROM ARRAY['search_path=""'] THEN RAISE EXCEPTION 'Unexpected owner/config'; END IF;
 EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.oid::regprocedure);
 IF f.nspname='public' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.oid::regprocedure); END IF;
 IF has_function_privilege('anon',f.oid,'EXECUTE') OR has_function_privilege('authenticated',f.oid,'EXECUTE') IS DISTINCT FROM (f.nspname='public') THEN RAISE EXCEPTION 'ACL verification failed'; END IF;
 END LOOP;
 IF matched<>17 THEN RAISE EXCEPTION 'ACL allowlist inventory mismatch'; END IF;
 IF to_regprocedure('public.crm_work_set_scoped_v2(uuid,text,jsonb,text,integer,text)') IS NOT NULL THEN RAISE EXCEPTION 'Old actor signature remains'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c WHERE c.relnamespace='crm_security'::regnamespace AND c.relname IN('business_events','assignment_rules') AND (c.relowner<>'postgres'::regrole OR NOT c.relrowsecurity OR has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE'))) THEN RAISE EXCEPTION 'Private table exposed'; END IF;
END $acl$;
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
COMMIT;