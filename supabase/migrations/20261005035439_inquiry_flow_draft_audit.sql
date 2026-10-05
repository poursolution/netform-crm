-- Preserve the existing audit allowlist and include quote draft saves.
DO $migration$
DECLARE d text;
BEGIN
 SELECT pg_get_constraintdef(oid) INTO STRICT d FROM pg_constraint
 WHERE conrelid='crm_security.inquiry_audit_events'::regclass AND conname='inquiry_audit_events_action_check';
 IF position('flow_quote_draft' in d)>0 THEN RETURN; END IF;
 IF left(d,7)<>'CHECK (' OR right(d,1)<>')' THEN RAISE EXCEPTION 'UNEXPECTED_AUDIT_CONSTRAINT'; END IF;
 ALTER TABLE crm_security.inquiry_audit_events DROP CONSTRAINT inquiry_audit_events_action_check;
 EXECUTE 'ALTER TABLE crm_security.inquiry_audit_events ADD CONSTRAINT inquiry_audit_events_action_check CHECK (('
 ||substring(d from 8 for length(d)-8)||') OR action = ''flow_quote_draft'')';
END $migration$;
