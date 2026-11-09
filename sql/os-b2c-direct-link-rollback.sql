-- Stop OS B2C direct calls while retaining inquiries, links and events for audit.
begin;
drop function public.crm_os_b2c_status_v1(jsonb);
drop function public.crm_os_b2c_owner_change_v1(jsonb);
drop function public.crm_os_b2c_handoff_v1(jsonb);
drop function public.crm_os_b2c_capability_v1();
revoke all on crm_security.os_b2c_links,crm_security.os_b2c_link_events from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
