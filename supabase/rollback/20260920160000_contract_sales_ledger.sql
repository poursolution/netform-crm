-- Disable new entrypoints, preserve all signed history for investigation/recovery.
BEGIN;
DROP TRIGGER IF EXISTS capture_contract_signing ON public.deals;
REVOKE ALL ON FUNCTION public.crm_contract_sales_write_v1(jsonb) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.crm_contract_sales_read_v1(uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
