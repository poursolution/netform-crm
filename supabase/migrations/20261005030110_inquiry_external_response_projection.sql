-- Read-only response projection for the existing actor-authorized inquiry feed.
-- No customer data, permissions, stages, or activity records are changed.
DO $migration$
DECLARE
 target regprocedure := 'crm_security.crm_operational_source_fragment_pre_inquiry_response_20260906(text,uuid,integer)'::regprocedure;
 definition text;
 previous_acl aclitem[];
 previous_config text[];
 previous_definer boolean;
 anchor text := E'    i.address,\n    jsonb_build_object(';
 addition text := $projection$    i.address,
    -- inquiry_external_response_projection_v1
    i.close_reason,
    jsonb_build_object(
     '응대내용',i.raw->>'응대내용',
     '종료사유',coalesce(nullif(i.close_reason,''),i.raw->>'종료사유'),
     'external_change_history',coalesce((
      SELECT jsonb_agg(jsonb_build_object(
       'kind','response','event_id',e.value->>'event_id','source_at',e.value->>'source_at',
       'after',jsonb_build_object(
        'response_content',e.value->'after'->>'response_content',
        'status',e.value->'after'->>'status',
        'close_reason',e.value->'after'->>'close_reason'
       )
      ) ORDER BY e.ordinality)
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(i.raw->'external_change_history')='array'
       THEN i.raw->'external_change_history' ELSE '[]'::jsonb END) WITH ORDINALITY AS e(value,ordinality)
      WHERE e.value->>'kind'='response' AND jsonb_typeof(e.value->'after')='object'
     ),'[]'::jsonb)
    ) AS raw,
    jsonb_build_object($projection$;
BEGIN
 SELECT pg_get_functiondef(target),proacl,proconfig,prosecdef
 INTO definition,previous_acl,previous_config,previous_definer FROM pg_proc WHERE oid=target;
 IF position('inquiry_external_response_projection_v1' in definition)>0 THEN RETURN; END IF;
 IF position('WHERE crm_security.can_inquiry(i.id)' in definition)=0
    OR position('SELECT * INTO a FROM crm_security.actor()' in definition)=0
    OR (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1
 THEN RAISE EXCEPTION 'Unexpected inquiry source definition; review before applying'; END IF;
 EXECUTE replace(definition,anchor,addition);
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid=target AND
   (proacl IS DISTINCT FROM previous_acl OR proconfig IS DISTINCT FROM previous_config OR prosecdef IS DISTINCT FROM previous_definer))
 THEN RAISE EXCEPTION 'Inquiry source security properties changed'; END IF;
END
$migration$;
