BEGIN;
DROP POLICY IF EXISTS crm_fixture_cleanup_select_20260907 ON storage.objects;
DROP POLICY IF EXISTS crm_fixture_cleanup_delete_20260907 ON storage.objects;
COMMIT;
