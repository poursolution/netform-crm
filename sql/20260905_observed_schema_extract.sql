-- METADATA SELECT ONLY. Prepared, not executed by this file.
-- Output is an ordered schema-only reconstruction kit, NOT a pg_dump replacement.
-- No CRM rows, auth.users rows, bucket objects, sequence last_value, or keys.
-- All returned DDL is TEXT. This SELECT does not execute returned DDL.
WITH rel AS (
  SELECT c.* FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S')
), cols AS (
  SELECT c.relname,a.attnum,a.attname,
    pg_catalog.format_type(a.atttypid,a.atttypmod) AS typ,
    a.attnotnull,a.attidentity,a.attgenerated,
    pg_catalog.pg_get_expr(d.adbin,d.adrelid) AS def
  FROM rel c JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid
  LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
  WHERE c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped
), fragments AS (
  SELECT 10 AS phase,c.relname AS name,
    format('CREATE SEQUENCE public.%I AS %s INCREMENT BY %s MINVALUE %s MAXVALUE %s START WITH %s CACHE %s %s;',
      c.relname,pg_catalog.format_type(s.seqtypid,NULL),s.seqincrement,s.seqmin,
      s.seqmax,s.seqstart,s.seqcache,CASE WHEN s.seqcycle THEN 'CYCLE' ELSE 'NO CYCLE' END) AS ddl
  FROM rel c JOIN pg_catalog.pg_sequence s ON s.seqrelid=c.oid
  UNION ALL
  SELECT 20,relname,format('CREATE TABLE public.%I (%s);',relname,
    string_agg(format('%I %s%s%s',attname,typ,
      CASE WHEN def IS NULL THEN '' ELSE ' DEFAULT '||def END,
      CASE WHEN attnotnull THEN ' NOT NULL' ELSE '' END),', ' ORDER BY attnum))
  FROM cols GROUP BY relname
  UNION ALL
  SELECT 30,c.relname||'.'||k.conname,
    format('ALTER TABLE public.%I ADD CONSTRAINT %I %s;',c.relname,k.conname,pg_catalog.pg_get_constraintdef(k.oid,true))
  FROM rel c JOIN pg_catalog.pg_constraint k ON k.conrelid=c.oid
  WHERE k.contype IN ('p','u','c','x')
  UNION ALL
  SELECT 35,i.relname,pg_catalog.pg_get_indexdef(i.oid)||';'
  FROM rel c JOIN pg_catalog.pg_index x ON x.indrelid=c.oid
  JOIN pg_catalog.pg_class i ON i.oid=x.indexrelid
  WHERE NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint k WHERE k.conindid=i.oid)
  UNION ALL
  SELECT 40,c.relname||'.'||k.conname,
    format('ALTER TABLE public.%I ADD CONSTRAINT %I %s;',c.relname,k.conname,pg_catalog.pg_get_constraintdef(k.oid,true))
  FROM rel c JOIN pg_catalog.pg_constraint k ON k.conrelid=c.oid WHERE k.contype='f'
  UNION ALL
  SELECT 45,c.relname,format('ALTER SEQUENCE public.%I OWNED BY public.%I.%I;',c.relname,t.relname,a.attname)
  FROM rel c JOIN pg_catalog.pg_depend d ON d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='a'
  JOIN pg_catalog.pg_class t ON t.oid=d.refobjid
  JOIN pg_catalog.pg_attribute a ON a.attrelid=t.oid AND a.attnum=d.refobjsubid
  WHERE c.relkind='S'
  UNION ALL
  SELECT 50,p.oid::regprocedure::text,pg_catalog.pg_get_functiondef(p.oid)||';'
  FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prokind IN ('f','p')
  UNION ALL
  SELECT 60,c.relname,format('CREATE VIEW public.%I AS %s',c.relname,pg_catalog.pg_get_viewdef(c.oid,true))
  FROM rel c WHERE c.relkind='v'
  UNION ALL
  SELECT 70,c.relname||'.'||t.tgname,pg_catalog.pg_get_triggerdef(t.oid,true)||';'
  FROM rel c JOIN pg_catalog.pg_trigger t ON t.tgrelid=c.oid WHERE NOT t.tgisinternal
)
SELECT jsonb_build_object(
  'format','crm-observed-schema-kit-v1',
  'server_version',current_setting('server_version'),
  'ddl_fragments',(SELECT jsonb_agg(to_jsonb(f) ORDER BY phase,name) FROM fragments f),
  'columns',(SELECT jsonb_agg(to_jsonb(c) ORDER BY relname,attnum) FROM cols c),
  'relations',(SELECT jsonb_agg(jsonb_build_object('name',relname,'kind',relkind,
    'owner',pg_catalog.pg_get_userbyid(relowner),'rls',relrowsecurity,
    'force_rls',relforcerowsecurity,'options',reloptions,'acl',relacl) ORDER BY relname) FROM rel),
  'function_acl',(SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,
    'owner',pg_catalog.pg_get_userbyid(p.proowner),'acl',p.proacl,'definer',p.prosecdef) ORDER BY p.oid::regprocedure::text)
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'),
  'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY tablename,policyname) FROM pg_catalog.pg_policies p WHERE schemaname='public'),
  'default_acl',(SELECT jsonb_agg(jsonb_build_object('owner',pg_catalog.pg_get_userbyid(d.defaclrole),
    'schema',n.nspname,'type',d.defaclobjtype,'acl',d.defaclacl) ORDER BY d.defaclrole,d.defaclnamespace,d.defaclobjtype)
    FROM pg_catalog.pg_default_acl d LEFT JOIN pg_catalog.pg_namespace n ON n.oid=d.defaclnamespace WHERE d.defaclnamespace=0 OR n.nspname='public'),
  'unsupported',(SELECT jsonb_agg(to_jsonb(z)) FROM (
    SELECT 'identity/generated' AS issue,relname AS object FROM cols WHERE attidentity<>'' OR attgenerated<>''
    UNION ALL SELECT 'partition/materialized view',relname FROM rel WHERE relkind IN ('p','m')
    UNION ALL SELECT 'custom type/domain',t.typname FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
      WHERE n.nspname='public' AND t.typtype IN ('d','e')
    UNION ALL SELECT 'extension-owned public object',e.extname FROM pg_catalog.pg_depend d
      JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid JOIN rel c ON d.classid='pg_class'::regclass AND d.objid=c.oid WHERE d.deptype='e'
  ) z)
) AS schema_only_kit;

-- STOP: review unsupported, dependencies, owner/ACL/policy restoration and function
-- bodies before constructing one transaction. Do not execute individual fragments
-- in a network-exposed empty project. Original function creation defaults can expose
-- SECURITY DEFINER functions before containment! No operational baseline is approved.
