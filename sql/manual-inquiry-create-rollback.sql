-- Stop new manual intake while retaining every inquiry and receipt for audit.
begin;
drop function public.crm_inquiry_manual_create_v1(uuid,jsonb);
drop function public.crm_inquiry_manual_capability_v1();
revoke all on crm_security.manual_inquiry_receipts from public,anon,authenticated,service_role;
commit;
