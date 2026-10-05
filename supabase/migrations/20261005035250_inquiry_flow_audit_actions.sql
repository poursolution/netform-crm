-- Preserve all existing allowed audit actions; add only the six deployed flow commands.
DO $migration$
DECLARE d text; expression text;
BEGIN
 SELECT pg_get_constraintdef(oid) INTO STRICT d FROM pg_constraint
 WHERE conrelid='crm_security.inquiry_audit_events'::regclass AND conname='inquiry_audit_events_action_check';
 IF position('flow_contact_log' in d)>0 AND position('flow_schedule_set' in d)>0 THEN RETURN; END IF;
 IF left(d,7)<>'CHECK (' OR right(d,1)<>')' THEN RAISE EXCEPTION 'UNEXPECTED_AUDIT_CONSTRAINT'; END IF;
 expression:=substring(d from 8 for length(d)-8);
 ALTER TABLE crm_security.inquiry_audit_events DROP CONSTRAINT inquiry_audit_events_action_check;
 EXECUTE 'ALTER TABLE crm_security.inquiry_audit_events ADD CONSTRAINT inquiry_audit_events_action_check CHECK (('
 ||expression||') OR action IN (''flow_contact_log'',''flow_close'',''flow_quote_send'',''flow_visit'',''flow_schedule_set'',''flow_field_set''))';
END $migration$;
