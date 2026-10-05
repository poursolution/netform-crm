-- Canonicalize untouched direct/Sheet mirrors at the authorized read boundary.
-- Exact 1:1 original receipt, phone, brand, message, site and address are required.
-- Data/history remain intact; CRM-edited rows and different receipts are preserved.
DO $patch$
DECLARE target regprocedure := 'crm_security.crm_operational_source_fragment_pre_inquiry_response_20260906(text,uuid,integer)'::regprocedure;
definition text; marker text := $marker$WHERE crm_security.can_inquiry(i.id) AND (p_after IS NULL OR i.id>p_after)$marker$;
replacement text := $replacement$WHERE crm_security.can_inquiry(i.id) AND (p_after IS NULL OR i.id>p_after)
-- inquiry_sheet_mirror_read_v1

 AND NOT (
  i.sheet_row IS NULL AND i.assigned_to IS NULL AND nullif(btrim(i.assignee_name),'') IS NULL
  AND i.status IN ('접수','신규') AND i.deal_id IS NULL AND i.opportunity_id IS NULL
  AND i.qualified_at IS NULL AND i.responded_at IS NULL AND i.first_response_at IS NULL AND i.next_action_date IS NULL
  AND NOT EXISTS (SELECT 1 FROM crm_security.inquiry_audit_events ae WHERE ae.inquiry_id=i.id)
  AND NOT EXISTS (SELECT 1 FROM public.next_actions na WHERE na.inquiry_id=i.id)
  AND EXISTS (
   SELECT 1 FROM public.inquiries s
   WHERE s.sheet_row IS NOT NULL AND crm_security.can_inquiry(s.id)
   AND s.brand=i.brand
   AND length(regexp_replace(coalesce(i.phone,''),'[^0-9]','','g'))>=9
   AND regexp_replace(s.phone,'[^0-9]','','g')=regexp_replace(i.phone,'[^0-9]','','g')
   AND nullif(btrim(i.raw->>'접수일시'),'') IS NOT NULL AND s.raw->>'접수일시'=i.raw->>'접수일시'
   AND nullif(btrim(i.raw->>'문의내용'),'') IS NOT NULL AND s.raw->>'문의내용'=i.raw->>'문의내용'
   AND coalesce(s.raw->>'현장명','')=coalesce(i.raw->>'현장명','')
   AND coalesce(s.address,'')=coalesce(i.address,'')
   AND (SELECT count(*) FROM public.inquiries same_s WHERE same_s.sheet_row IS NOT NULL
     AND same_s.brand=s.brand AND regexp_replace(same_s.phone,'[^0-9]','','g')=regexp_replace(s.phone,'[^0-9]','','g')
     AND same_s.raw->>'접수일시'=s.raw->>'접수일시' AND same_s.raw->>'문의내용'=s.raw->>'문의내용'
     AND coalesce(same_s.raw->>'현장명','')=coalesce(s.raw->>'현장명','') AND coalesce(same_s.address,'')=coalesce(s.address,''))=1
   AND (SELECT count(*) FROM public.inquiries same_d WHERE same_d.sheet_row IS NULL
     AND same_d.brand=s.brand AND regexp_replace(same_d.phone,'[^0-9]','','g')=regexp_replace(s.phone,'[^0-9]','','g')
     AND same_d.raw->>'접수일시'=s.raw->>'접수일시' AND same_d.raw->>'문의내용'=s.raw->>'문의내용'
     AND coalesce(same_d.raw->>'현장명','')=coalesce(s.raw->>'현장명','') AND coalesce(same_d.address,'')=coalesce(s.address,''))=1
  )
 )$replacement$;
BEGIN
 definition := pg_get_functiondef(target);
 IF position('inquiry_sheet_mirror_read_v1' in definition)>0 THEN RETURN; END IF;
 IF position(marker in definition)=0 THEN RAISE EXCEPTION 'INQUIRY_SOURCE_SIGNATURE_DRIFT'; END IF;
 definition := replace(definition,'SELECT i.id,i.site_id,i.site_name','SELECT i.id,i.sheet_row,i.site_id,i.site_name');
 EXECUTE replace(definition,marker,replacement);
END $patch$;
