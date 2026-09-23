-- Add only customer-facing inquiry fields to the existing authorized read.
-- No raw payload, permission, customer record or dashboard changes.
DO $patch$
DECLARE
 target regprocedure := 'crm_security.crm_operational_source_fragment_pre_inquiry_response_20260906(text,uuid,integer)'::regprocedure;
 definition text;
 old_acl aclitem[];
 old_owner oid;
 needle text := 'i.first_response_at,i.responded_at,i.next_action_date,i.contact_name,i.phone';
 replacement text := $projection$i.first_response_at,i.responded_at,i.next_action_date,i.contact_name,i.phone,
    i.address,
    jsonb_build_object(
     'inquiry',coalesce(nullif(btrim(i.raw->>'문의내용'),''),nullif(btrim(i.raw->>'message'),''),nullif(btrim(i.raw->>'inquiry'),'')),
     'workType',coalesce(nullif(i.work_type,''),i.raw->>'공사유형'),
     'note',i.raw->>'특이사항',
     'address',coalesce(nullif(i.address,''),i.raw->>'건물주소'),
     'channel',coalesce(nullif(i.channel,''),i.raw->>'상담채널'),
     'inflow',coalesce(nullif(i.source_channel,''),i.raw->>'유입경로')
    ) AS detail$projection$;
BEGIN
 SELECT pg_get_functiondef(oid),proacl,proowner INTO definition,old_acl,old_owner FROM pg_proc WHERE oid=target;
 IF strpos(definition,replacement)>0 THEN RETURN; END IF;
 IF (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1
 OR strpos(definition,'crm_security.can_inquiry(i.id)')=0 THEN
  RAISE EXCEPTION 'Inquiry source projection drift: stop without modification';
 END IF;
 EXECUTE replace(definition,needle,replacement);
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid=target AND (proacl IS DISTINCT FROM old_acl OR proowner<>old_owner))
 THEN RAISE EXCEPTION 'Inquiry source permissions changed'; END IF;
END
$patch$;

DO $patch$
DECLARE
 target regprocedure := 'crm_security.crm_operational_source_fragment_pre_inquiry_response_20260906(text,uuid,integer)'::regprocedure;
 definition text;
 needle text := $old$'note',i.raw->>'특이사항',$old$;
 replacement text := $new$'customerType',i.raw->>'고객유형',
     'office',i.raw->>'관리사무소',
     'buildingType',i.raw->>'건물유형',
     'complex',i.raw->>'단지개요',
     'sourceSite',i.raw->>'현장명',
     'responder',i.raw->>'전화응대자',
     'assignComment',i.raw->>'배정 코멘트',
     'response',i.raw->>'응대내용',
     'note',i.raw->>'특이사항',$new$;
BEGIN
 SELECT pg_get_functiondef(target) INTO definition;
 IF strpos(definition,replacement)>0 THEN RETURN; END IF;
 IF (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 THEN
 RAISE EXCEPTION 'Inquiry customer projection drift'; END IF;
 EXECUTE replace(definition,needle,replacement);
END $patch$;
