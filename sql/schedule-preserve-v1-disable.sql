-- Non-destructive rollback: preserve all tasks, original deadlines, events and receipts.
begin;
update crm_security.schedule_v1_settings set enabled=false where singleton;
commit;
