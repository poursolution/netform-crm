-- Remove only the mandatory explanation for skips/backward moves.
-- Keep the existing function body, ACL, stage requirements and audit writes.
DO $migration$
DECLARE
  target regprocedure := 'crm_security.crm_deal_transition_command_v1(uuid,uuid,integer,jsonb)'::regprocedure;
  definition text;
  required_reason text := E' IF to_value<>''waiting'' AND NOT standard AND length(skip_value)<5\n THEN RAISE EXCEPTION ''transition exception reason is required'' USING ERRCODE=''22023''; END IF;';
BEGIN
  definition := pg_get_functiondef(target);
  IF strpos(definition, required_reason) = 0 THEN
    RAISE EXCEPTION 'Unexpected transition function: review before removing reason requirement';
  END IF;
  EXECUTE replace(definition, required_reason, ' -- Skip/backward explanation is optional; structured stage data and history remain required.');
END;
$migration$;
