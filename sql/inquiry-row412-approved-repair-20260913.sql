-- User approved sequential work after exact row 412 repair was proposed.
-- One-shot, fail-closed. assigned_at is repair time, not reconstructed historical time.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
DO $repair$
DECLARE before_row jsonb; after_row jsonb; ack jsonb; others_before text; others_after text;
BEGIN
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.crm_inquiry_assignment_sync_v1(jsonb)'::regprocedure) IS DISTINCT FROM '96c30cebabb9b06aa2fc25932609185b' THEN RAISE EXCEPTION 'RPC_DRIFT'; END IF;
 SELECT to_jsonb(i) INTO before_row FROM public.inquiries i WHERE id='104a32ce-6d86-40ff-9674-262c7c1c93ec' FOR UPDATE;
 IF before_row->>'sheet_row' IS DISTINCT FROM '412' OR before_row->>'assignee_name' IS DISTINCT FROM '조재연' OR before_row->>'assigned_to' IS NOT NULL OR before_row->>'assigned_at' IS NOT NULL THEN RAISE EXCEPTION 'TARGET_DRIFT'; END IF;
 IF (SELECT count(*) FROM public.users WHERE active AND btrim(name)='조재연')<>1 OR NOT EXISTS(SELECT 1 FROM public.users WHERE active AND name='조재연' AND user_id='d3727607-72b3-4bcb-9dfd-da54bbc291b4') THEN RAISE EXCEPTION 'USER_DRIFT'; END IF;
 SELECT md5(string_agg(to_jsonb(i)::text,'|' ORDER BY i.id)) INTO others_before FROM public.inquiries i WHERE id<>'104a32ce-6d86-40ff-9674-262c7c1c93ec';
 PERFORM set_config('request.jwt.claim.role','service_role',true);
 ack:=public.crm_inquiry_assignment_sync_v1(jsonb_build_object('inquiry_id','104a32ce-6d86-40ff-9674-262c7c1c93ec','to','조재연','operation','assign'));
 SELECT to_jsonb(i) INTO after_row FROM public.inquiries i WHERE id='104a32ce-6d86-40ff-9674-262c7c1c93ec';
 IF ack->>'ok' IS DISTINCT FROM 'true' OR after_row->>'assigned_to' IS DISTINCT FROM 'd3727607-72b3-4bcb-9dfd-da54bbc291b4' OR after_row->>'assigned_at' IS NULL OR
 (before_row - ARRAY['assigned_to','assigned_at','updated_at']) IS DISTINCT FROM (after_row - ARRAY['assigned_to','assigned_at','updated_at']) THEN RAISE EXCEPTION 'POSTCHECK_FAILED'; END IF;
 SELECT md5(string_agg(to_jsonb(i)::text,'|' ORDER BY i.id)) INTO others_after FROM public.inquiries i WHERE id<>'104a32ce-6d86-40ff-9674-262c7c1c93ec';
 IF others_before IS DISTINCT FROM others_after THEN RAISE EXCEPTION 'OTHER_INQUIRIES_CHANGED'; END IF;
END $repair$;
COMMIT;
