BEGIN;
DROP POLICY IF EXISTS crm_fixture_cleanup_select_20260907 ON storage.objects;
DROP POLICY IF EXISTS crm_fixture_cleanup_delete_20260907 ON storage.objects;
CREATE POLICY crm_fixture_cleanup_select_20260907 ON storage.objects FOR SELECT TO authenticated USING(
 bucket_id='crm-site-files' AND name='deals/b8ff1bd7-e0c7-417d-9521-937ee3ab1db0/26ae0b44-d1de-4f91-8e4c-a52234a7f03f' AND owner_id=auth.uid()::text
);
CREATE POLICY crm_fixture_cleanup_delete_20260907 ON storage.objects FOR DELETE TO authenticated USING(
 bucket_id='crm-site-files' AND name='deals/b8ff1bd7-e0c7-417d-9521-937ee3ab1db0/26ae0b44-d1de-4f91-8e4c-a52234a7f03f' AND owner_id=auth.uid()::text
);
COMMIT;
