-- PT/bidding is optional. Do not invent a bid result for direct contracts.
-- Keep destination contract fields, real stage history and permissions intact.
DO $migration$
DECLARE
  target regprocedure := 'crm_security.crm_transition_validate_v1(text,jsonb,date)'::regprocedure;
  definition text;
  previous_rule text := $old$p_fields->>'bid_result' NOT IN ('낙찰','우선협상','수의계약','확인중') OR p_fields->>'contract_status' NOT IN ('체결 예정','체결 완료')$old$;
  next_rule text := $new$(p_fields ? 'bid_result' AND p_fields->'bid_result' <> 'null'::jsonb AND (jsonb_typeof(p_fields->'bid_result') IS DISTINCT FROM 'string' OR p_fields->>'bid_result' NOT IN ('','낙찰','우선협상','수의계약','확인중'))) OR coalesce(p_fields->>'contract_status','') NOT IN ('체결 예정','체결 완료')$new$;
BEGIN
  definition := pg_get_functiondef(target);
  IF strpos(definition, previous_rule) = 0 OR
     length(definition) - length(replace(definition, previous_rule, '')) <> length(previous_rule) THEN
    RAISE EXCEPTION 'Unexpected contract validator: review before making bid result optional';
  END IF;
  EXECUTE replace(definition, previous_rule, next_rule);
END;
$migration$;
