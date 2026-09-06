-- REVIEWED EXACT-FIXTURE CLEANUP CANDIDATE. NOT EXECUTED.
-- Staging rprechiaglyjaydkmxsu only. Apply immediately before the exact
-- Storage API removal and run storage-cleanup-policy-rollback.sql immediately
-- after the API proof is written.
BEGIN;
SET LOCAL crm.exact_storage_cleanup_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';

DO $guard$
BEGIN
 IF current_user<>'postgres'
  OR current_setting('crm.exact_storage_cleanup_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regclass('storage.objects') IS NULL
  OR to_regprocedure('public.crm_attachment_object_insert_allowed(text,text)') IS NULL
  OR (SELECT count(*) FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='crm_attachment_insert_v1'
      AND permissive='PERMISSIVE' AND roles=ARRAY['authenticated']::name[]
      AND cmd='INSERT' AND qual IS NULL
      AND with_check LIKE '%crm-site-files%'
      AND with_check LIKE '%crm_attachment_object_insert_allowed%'
  )<>1
  OR EXISTS(
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname IN (
        'crm_fixture_cleanup_select_20260906',
        'crm_fixture_cleanup_delete_20260906'
      )
  )
  OR EXISTS(
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND cmd IN ('SELECT','DELETE','ALL')
      AND ('authenticated'::name=ANY(roles) OR 'public'::name=ANY(roles))
  )
 THEN
  RAISE EXCEPTION 'exact Storage cleanup policy prerequisite drift';
 END IF;
END
$guard$;

CREATE POLICY crm_fixture_cleanup_select_20260906
 ON storage.objects
 FOR SELECT
 TO authenticated
 USING (
  id='c5838a9b-7aee-44fd-af88-58331d88f772'::uuid
  AND bucket_id='crm-site-files'
  AND name='deals/431d2489-6e72-44c3-a8d4-41e95d0f0804/31b422c8-ad61-4336-b161-b8c00432d6db'
  AND owner_id='b5295979-d6c9-48f2-971a-2dea418b75e6'
  AND owner_id=(SELECT auth.uid())::text
 );

CREATE POLICY crm_fixture_cleanup_delete_20260906
 ON storage.objects
 FOR DELETE
 TO authenticated
 USING (
  id='c5838a9b-7aee-44fd-af88-58331d88f772'::uuid
  AND bucket_id='crm-site-files'
  AND name='deals/431d2489-6e72-44c3-a8d4-41e95d0f0804/31b422c8-ad61-4336-b161-b8c00432d6db'
  AND owner_id='b5295979-d6c9-48f2-971a-2dea418b75e6'
  AND owner_id=(SELECT auth.uid())::text
 );

DO $post$
DECLARE
 p record;
BEGIN
 FOR p IN
  SELECT policyname,permissive,roles,cmd,qual,with_check
  FROM pg_policies
  WHERE schemaname='storage' AND tablename='objects'
    AND policyname IN (
      'crm_fixture_cleanup_select_20260906',
      'crm_fixture_cleanup_delete_20260906'
    )
 LOOP
  IF p.permissive<>'PERMISSIVE'
   OR p.roles<>ARRAY['authenticated']::name[]
   OR (p.policyname='crm_fixture_cleanup_select_20260906' AND p.cmd<>'SELECT')
   OR (p.policyname='crm_fixture_cleanup_delete_20260906' AND p.cmd<>'DELETE')
   OR p.with_check IS NOT NULL
   OR p.qual NOT LIKE '%c5838a9b-7aee-44fd-af88-58331d88f772%'
   OR p.qual NOT LIKE '%crm-site-files%'
   OR p.qual NOT LIKE '%deals/431d2489-6e72-44c3-a8d4-41e95d0f0804/31b422c8-ad61-4336-b161-b8c00432d6db%'
   OR p.qual NOT LIKE '%b5295979-d6c9-48f2-971a-2dea418b75e6%'
   OR p.qual NOT LIKE '%auth.uid%'
  THEN
   RAISE EXCEPTION 'exact Storage cleanup policy post-apply drift: %',p.policyname;
  END IF;
 END LOOP;
 IF (SELECT count(*) FROM pg_policies
     WHERE schemaname='storage' AND tablename='objects'
       AND policyname IN (
        'crm_fixture_cleanup_select_20260906',
        'crm_fixture_cleanup_delete_20260906'
       ))<>2
 THEN
  RAISE EXCEPTION 'exact Storage cleanup policies were not created exactly twice';
 END IF;
END
$post$;
COMMIT;
