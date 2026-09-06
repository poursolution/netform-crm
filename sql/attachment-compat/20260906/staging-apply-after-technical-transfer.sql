-- LOCAL REVIEW CANDIDATE ONLY. Staging approval is required.
BEGIN;
-- LOCAL REVIEW CANDIDATE ONLY. Separate Staging approval is required.
SET LOCAL crm.attachment_compat_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='90s';

DO $guard$ BEGIN
 IF current_user<>'postgres'
  OR current_setting('crm.attachment_compat_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') IS NULL
  OR to_regprocedure('crm_security.crm_technical_inquiry_transfer_command_v1(uuid,uuid,jsonb)') IS NULL
  OR to_regclass('storage.buckets') IS NULL OR to_regclass('storage.objects') IS NULL
  OR to_regclass('crm_security.deal_attachments') IS NOT NULL
  OR to_regprocedure('crm_security.crm_attachment_command_v1(uuid,text,uuid,jsonb)') IS NOT NULL
  OR to_regprocedure('public.crm_attachment_object_insert_allowed(text,text)') IS NOT NULL
  OR EXISTS(SELECT 1 FROM storage.buckets WHERE id='crm-site-files' AND
    (name<>'crm-site-files' OR public OR file_size_limit IS DISTINCT FROM 20971520
     OR allowed_mime_types IS DISTINCT FROM ARRAY[
      'image/*','application/pdf','application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/octet-stream']))
  OR EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='crm_attachment_insert_v1')
 THEN RAISE EXCEPTION 'attachment compatibility prerequisite drift'; END IF;
END $guard$;

LOCK TABLE crm_security.command_receipts IN ACCESS EXCLUSIVE MODE;
ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 RENAME TO crm_write_command_v2_technical_transfer_20260906;
ALTER FUNCTION public.crm_write_command_v2_technical_transfer_20260906(uuid,text,uuid,integer,jsonb)
 SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_technical_transfer_20260906(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION public.crm_operational_source_v1(text,uuid,integer)
 RENAME TO crm_operational_source_v1_technical_transfer_20260906;
ALTER FUNCTION public.crm_operational_source_v1_technical_transfer_20260906(text,uuid,integer)
 SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_v1_technical_transfer_20260906(text,uuid,integer)
 FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN (
 'opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch',
 'next_action','activity','quote_version','next_action_complete','stage_check','transition','close','amount',
 'waiting_context','inquiry_reclassify','inquiry_status','inquiry_trash','inquiry_restore','inquiry_purge',
 'inquiry_followup','opportunity_create','lineage_link','attachment_prepare','attachment_complete'));

CREATE TABLE crm_security.deal_attachments(
 attachment_id uuid PRIMARY KEY,
 deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE RESTRICT,
 bucket_id text NOT NULL DEFAULT 'crm-site-files' CHECK(bucket_id='crm-site-files'),
 object_path text NOT NULL UNIQUE,
 file_name text NOT NULL CHECK(length(file_name) BETWEEN 1 AND 255),
 mime_type text NOT NULL CHECK(length(mime_type) BETWEEN 3 AND 200),
 size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 1 AND 20971520),
 category text NOT NULL CHECK(category IN ('현장사진','견적자료','도면','회의자료','계약관련','기타')),
 tags text[] NOT NULL DEFAULT '{}',
 memo text,
 uploaded_by_user_id uuid NOT NULL REFERENCES public.users(user_id),
 uploaded_by_name text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','ready','failed')),
 pending_expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL,
 ready_at timestamptz,
 failed_at timestamptz,
 failure_reason text,
 CHECK(cardinality(tags)<=20),
 CHECK(memo IS NULL OR length(memo)<=4000)
);
CREATE INDEX deal_attachments_ready_idx ON crm_security.deal_attachments(deal_id,created_at DESC)
 WHERE status='ready';
CREATE INDEX deal_attachments_pending_idx ON crm_security.deal_attachments(pending_expires_at)
 WHERE status='pending';

CREATE TABLE crm_security.attachment_audit_events(
 event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_auth_uid uuid NOT NULL,
 actor_user_id uuid NOT NULL REFERENCES public.users(user_id),
 deal_id uuid NOT NULL REFERENCES public.deals(id),
 attachment_id uuid NOT NULL REFERENCES crm_security.deal_attachments(attachment_id),
 action text NOT NULL CHECK(action IN ('attachment_prepare','attachment_complete')),
 before_data jsonb NOT NULL CHECK(jsonb_typeof(before_data)='object'),
 after_data jsonb NOT NULL CHECK(jsonb_typeof(after_data)='object'),
 created_at timestamptz NOT NULL
);
ALTER TABLE crm_security.deal_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_security.attachment_audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_security.deal_attachments,crm_security.attachment_audit_events
 FROM PUBLIC,anon,authenticated,service_role;

-- Bucket creation by SQL is supported by Supabase; objects remain API-owned/read-only.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('crm-site-files','crm-site-files',false,20971520,ARRAY[
 'image/*','application/pdf','application/msword',
 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
 'application/octet-stream']) ON CONFLICT(id) DO NOTHING;

CREATE FUNCTION public.crm_attachment_object_insert_allowed(p_bucket_id text,p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT p_bucket_id='crm-site-files' AND EXISTS(
  SELECT 1 FROM crm_security.actor() a
  JOIN crm_security.deal_attachments x ON x.uploaded_by_user_id=a.user_id
  WHERE x.bucket_id=p_bucket_id AND x.object_path=p_name AND x.status='pending'
   AND x.pending_expires_at>clock_timestamp() AND crm_security.can_deal(x.deal_id,true))
$fn$;
REVOKE EXECUTE ON FUNCTION public.crm_attachment_object_insert_allowed(text,text)
 FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.crm_attachment_object_insert_allowed(text,text) TO authenticated;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_attachment_insert_v1 ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='crm-site-files' AND public.crm_attachment_object_insert_allowed(bucket_id,name));

CREATE FUNCTION crm_security.crm_attachment_command_v1(
 p_request_id uuid,p_operation text,p_object_id uuid,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a record; prior crm_security.command_receipts%ROWTYPE; x crm_security.deal_attachments%ROWTYPE;
 canonical jsonb; ack jsonb; audit_id uuid; attachment_target uuid; server_at timestamptz:=clock_timestamp();
 filename_value text; mime_value text; category_value text; memo_value text; size_value bigint;
 tags_value text[]; object_size bigint; object_mime text; object_owner text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND OR p_request_id IS NULL OR p_object_id IS NULL
  OR p_operation NOT IN ('attachment_prepare','attachment_complete')
  OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR NOT crm_security.can_deal(p_object_id,true)
 THEN RAISE EXCEPTION 'forbidden or invalid attachment command' USING ERRCODE='42501'; END IF;

 IF p_operation='attachment_prepare' THEN
  IF NOT p_payload ?& ARRAY['file_name','mime_type','size_bytes','category','tags']
   OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('file_name','mime_type','size_bytes','category','tags','memo'))
   OR jsonb_typeof(p_payload->'file_name')<>'string' OR length(btrim(p_payload->>'file_name')) NOT BETWEEN 1 AND 255
   OR p_payload->>'file_name' ~ '[[:cntrl:]/\\]'
   OR jsonb_typeof(p_payload->'mime_type')<>'string'
   OR jsonb_typeof(p_payload->'size_bytes')<>'number'
   OR jsonb_typeof(p_payload->'category')<>'string'
   OR jsonb_typeof(p_payload->'tags')<>'array'
   OR jsonb_array_length(p_payload->'tags')>20
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'tags') e
             WHERE jsonb_typeof(e)<>'string' OR length(btrim(e#>>'{}')) NOT BETWEEN 1 AND 100)
   OR (p_payload ? 'memo' AND jsonb_typeof(p_payload->'memo') NOT IN ('string','null'))
  THEN RAISE EXCEPTION 'invalid attachment prepare payload' USING ERRCODE='22023'; END IF;
  BEGIN size_value:=(p_payload->>'size_bytes')::bigint;
  EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'invalid attachment size' USING ERRCODE='22023'; END;
  filename_value:=btrim(p_payload->>'file_name'); mime_value:=lower(btrim(p_payload->>'mime_type'));
  category_value:=p_payload->>'category'; memo_value:=nullif(btrim(coalesce(p_payload->>'memo','')),'');
  SELECT coalesce(array_agg(v ORDER BY ord),'{}') INTO tags_value
   FROM (SELECT DISTINCT btrim(value#>>'{}') v,min(ordinality) ord
         FROM jsonb_array_elements(p_payload->'tags') WITH ORDINALITY GROUP BY btrim(value#>>'{}')) q;
  IF size_value NOT BETWEEN 1 AND 20971520
   OR category_value NOT IN ('현장사진','견적자료','도면','회의자료','계약관련','기타')
   OR length(coalesce(memo_value,''))>4000
   OR NOT (mime_value ~ '^image/[a-z0-9.+-]+$' OR mime_value IN (
    'application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation')
    OR (mime_value='application/octet-stream' AND filename_value ~* '\.(jpe?g|png|webp|heic|heif|gif|pdf|docx?|xlsx?|pptx?)$'))
  THEN RAISE EXCEPTION 'unsupported attachment file' USING ERRCODE='22023'; END IF;
  canonical:=jsonb_build_object('file_name',filename_value,'mime_type',mime_value,'size_bytes',size_value,
   'category',category_value,'tags',to_jsonb(tags_value),'memo',memo_value);
 ELSE
  IF NOT p_payload ? 'attachment_id'
   OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k<>'attachment_id')
  THEN RAISE EXCEPTION 'invalid attachment complete payload' USING ERRCODE='22023'; END IF;
  BEGIN attachment_target:=(p_payload->>'attachment_id')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'invalid attachment id' USING ERRCODE='22023'; END;
  canonical:=jsonb_build_object('attachment_id',attachment_target);
 END IF;

 PERFORM pg_advisory_xact_lock(hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO prior FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF prior.actor_user_id IS DISTINCT FROM a.user_id OR prior.operation IS DISTINCT FROM p_operation
   OR prior.object_id IS DISTINCT FROM p_object_id OR prior.expected_version IS DISTINCT FROM 0
   OR prior.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN prior.ack||jsonb_build_object('replayed',true);
 END IF;

 IF p_operation='attachment_prepare' THEN
  attachment_target:=gen_random_uuid();
  INSERT INTO crm_security.deal_attachments(attachment_id,deal_id,object_path,file_name,mime_type,size_bytes,
   category,tags,memo,uploaded_by_user_id,uploaded_by_name,pending_expires_at,created_at)
  VALUES(attachment_target,p_object_id,'deals/'||p_object_id::text||'/'||attachment_target::text,
   filename_value,mime_value,size_value,category_value,tags_value,memo_value,a.user_id,a.display_name,
   server_at+interval '24 hours',server_at) RETURNING * INTO x;
  INSERT INTO crm_security.attachment_audit_events(actor_auth_uid,actor_user_id,deal_id,attachment_id,action,before_data,after_data,created_at)
  VALUES(a.auth_uid,a.user_id,p_object_id,x.attachment_id,'attachment_prepare','{}',
   jsonb_build_object('status','pending','bucket_id',x.bucket_id,'object_path',x.object_path,'size_bytes',x.size_bytes,'mime_type',x.mime_type),server_at)
  RETURNING event_id INTO audit_id;
  ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation',p_operation,
   'object_id',p_object_id,'attachment_id',x.attachment_id,'bucket_id',x.bucket_id,'object_path',x.object_path,
   'status','pending','pending_expires_at',x.pending_expires_at,'audit_event_id',audit_id,
   'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'server_at',server_at,'replayed',false);
 ELSE
  SELECT * INTO x FROM crm_security.deal_attachments WHERE attachment_id=attachment_target FOR UPDATE;
  IF NOT FOUND OR x.deal_id IS DISTINCT FROM p_object_id OR x.uploaded_by_user_id IS DISTINCT FROM a.user_id
   OR x.status NOT IN ('pending','ready') OR (x.status='pending' AND x.pending_expires_at<=server_at)
  THEN RAISE EXCEPTION 'attachment unavailable' USING ERRCODE='42501'; END IF;
  IF x.status='pending' THEN
   SELECT CASE WHEN coalesce(o.metadata->>'size','')~'^[0-9]+$' THEN (o.metadata->>'size')::bigint
               WHEN coalesce(o.metadata->>'contentLength','')~'^[0-9]+$' THEN (o.metadata->>'contentLength')::bigint END,
          lower(coalesce(o.metadata->>'mimetype','')),o.owner_id
    INTO object_size,object_mime,object_owner
    FROM storage.objects o WHERE o.bucket_id=x.bucket_id AND o.name=x.object_path;
   IF object_size IS DISTINCT FROM x.size_bytes OR object_mime IS DISTINCT FROM x.mime_type
    OR object_owner IS DISTINCT FROM a.auth_uid::text
   THEN RAISE EXCEPTION 'storage object mismatch' USING ERRCODE='PT409'; END IF;
   UPDATE crm_security.deal_attachments SET status='ready',ready_at=server_at WHERE attachment_id=x.attachment_id RETURNING * INTO x;
   INSERT INTO crm_security.attachment_audit_events(actor_auth_uid,actor_user_id,deal_id,attachment_id,action,before_data,after_data,created_at)
   VALUES(a.auth_uid,a.user_id,p_object_id,x.attachment_id,'attachment_complete',jsonb_build_object('status','pending'),
    jsonb_build_object('status','ready','size_bytes',x.size_bytes,'mime_type',x.mime_type),server_at)
   RETURNING event_id INTO audit_id;
  ELSE
   SELECT event_id INTO audit_id FROM crm_security.attachment_audit_events
    WHERE attachment_id=x.attachment_id AND action='attachment_complete' ORDER BY created_at DESC LIMIT 1;
  END IF;
  ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation',p_operation,
   'object_id',p_object_id,'attachment_id',x.attachment_id,'status','ready','audit_event_id',audit_id,
   'attachment',jsonb_build_object('id',x.attachment_id,'file_name',x.file_name,'mime_type',x.mime_type,
    'size_bytes',x.size_bytes,'category',x.category,'tags',to_jsonb(x.tags),'memo',x.memo,
    'uploaded_by',x.uploaded_by_name,'status','ready','created_at',x.created_at),
   'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'server_at',server_at,'replayed',false);
 END IF;
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack,created_at)
 VALUES(a.auth_uid,p_request_id,a.user_id,p_operation,p_object_id,0,canonical,ack,server_at);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_attachment_command_v1(uuid,text,uuid,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_write_command_v2(
 p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF p_operation IN ('attachment_prepare','attachment_complete') THEN
  IF p_expected_version IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'invalid attachment version sentinel' USING ERRCODE='22023'; END IF;
  RETURN crm_security.crm_attachment_command_v1(p_request_id,p_operation,p_object_id,p_payload);
 END IF;
 RETURN crm_security.crm_write_command_v2_technical_transfer_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;

CREATE FUNCTION public.crm_operational_source_v1(p_domain text,p_after uuid DEFAULT NULL,p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE base jsonb; rows jsonb;
BEGIN
 base:=crm_security.crm_operational_source_v1_technical_transfer_20260906(p_domain,p_after,p_limit);
 IF p_domain<>'deal_core' THEN RETURN base; END IF;
 SELECT coalesce(jsonb_agg(item||jsonb_build_object('attachments',coalesce((
   SELECT jsonb_agg(jsonb_build_object('id',x.attachment_id,'file_name',x.file_name,'mime_type',x.mime_type,
    'size_bytes',x.size_bytes,'category',x.category,'tags',to_jsonb(x.tags),'memo',x.memo,
    'uploaded_by',x.uploaded_by_name,'status','ready','created_at',x.created_at) ORDER BY x.created_at DESC,x.attachment_id)
   FROM crm_security.deal_attachments x WHERE x.deal_id=(item->>'id')::uuid AND x.status='ready'),'[]'::jsonb))),'[]'::jsonb)
 INTO rows FROM jsonb_array_elements(coalesce(base->'items','[]'::jsonb)) item;
 RETURN jsonb_set(base,'{items}',rows,false);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) TO authenticated;

DO $post$ BEGIN
 IF has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_operational_source_v1(text,uuid,integer)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_attachment_command_v1(uuid,text,uuid,jsonb)','EXECUTE')
  OR has_table_privilege('authenticated','crm_security.deal_attachments','SELECT')
  OR has_table_privilege('authenticated','crm_security.attachment_audit_events','SELECT')
  OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='crm_security.deal_attachments'::regclass)
  OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='crm_security.attachment_audit_events'::regclass)
 THEN RAISE EXCEPTION 'attachment compatibility post-apply drift'; END IF;
END $post$;
COMMIT;
