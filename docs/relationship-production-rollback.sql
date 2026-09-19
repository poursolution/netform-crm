BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='20s';
DO $verify$
DECLARE
 u uuid:=gen_random_uuid(); au uuid:=gen_random_uuid(); d uuid:=gen_random_uuid();
 req uuid:=gen_random_uuid(); ack jsonb; replay jsonb; snap jsonb; after_snap jsonb;
 p jsonb:='{"activity":{"type":"전화","note":"SYNTHETIC rollback verification","result":"validation","occurred_at":"2026-09-19T01:00:00Z","meaningful_contact":true},"next_action":{"type":"전화","text":"SYNTHETIC followup","due_at":"2026-09-20"}}';
 checks jsonb:='[]'; role_name text; other_u uuid; other_au uuid;
BEGIN
 INSERT INTO public.users(user_id,name,role,active,auth_uid) VALUES(u,'SYNTHETIC_ROLLBACK_'||u,'rep',true,au);
 INSERT INTO crm_security.access_review(user_id,reviewed_auth_uid,source_role,permission_role,approved,reviewed_by,expires_at)
 VALUES(u,au,'rep','rep',true,'rollback verification',now()+interval '1 hour');
 INSERT INTO public.deals(id,owner_id,stage_code,version) VALUES(d,u,'rapport',1);
 PERFORM set_config('request.jwt.claim.sub',au::text,true);
 -- Use authenticated role through the production public dispatcher.
 SET LOCAL ROLE authenticated;
 BEGIN
  PERFORM public.crm_write_command_v2(gen_random_uuid(),'relationship_contact',d,1,jsonb_set(p,'{next_action,text}','""'));
  RAISE EXCEPTION 'invalid second write accepted';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
 RESET ROLE;
 IF (SELECT version FROM public.deals WHERE id=d)<>1 OR EXISTS(SELECT 1 FROM public.activities WHERE deal_id=d)
 OR EXISTS(SELECT 1 FROM crm_security.command_receipts WHERE object_id=d)
 THEN RAISE EXCEPTION 'partial write survived failure'; END IF;
 checks:=checks||'"second-write failure atomic rollback"'::jsonb;
 SET LOCAL ROLE authenticated;
 ack:=public.crm_write_command_v2(req,'relationship_contact',d,1,p);
 replay:=public.crm_write_command_v2(req,'relationship_contact',d,1,p);
 RESET ROLE;
 IF ack->>'version'<>'3' OR ack->>'replayed'<>'false' OR replay->>'replayed'<>'true'
 OR (SELECT count(*) FROM public.activities WHERE deal_id=d)<>1
 OR (SELECT count(*) FROM public.next_actions WHERE deal_id=d)<>1
 OR (SELECT count(*) FROM crm_security.command_receipts WHERE object_id=d)<>2
 OR NOT EXISTS(SELECT 1 FROM public.next_actions WHERE id=(ack->>'next_action_id')::uuid AND source_activity_id=(ack->>'activity_id')::uuid)
 THEN RAISE EXCEPTION 'atomic readback or idempotency failed'; END IF;
 checks:=checks||'["atomic save linked IDs readback","same-request replay no duplicate"]'::jsonb;
 SET LOCAL ROLE authenticated;
 BEGIN PERFORM public.crm_write_command_v2(gen_random_uuid(),'relationship_contact',d,1,p);
  RAISE EXCEPTION 'stale version accepted';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
 BEGIN PERFORM public.crm_write_command_v2(req,'relationship_contact',d,1,jsonb_set(p,'{next_action,text}','"changed"'));
  RAISE EXCEPTION 'changed retry accepted';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
 RESET ROLE;
 checks:=checks||'["stale-version conflict","request-ID payload conflict"]'::jsonb;
 FOR role_name IN SELECT unnest(ARRAY['rep','consultation','branch']) LOOP
  other_u:=gen_random_uuid(); other_au:=gen_random_uuid();
  INSERT INTO public.users(user_id,name,role,active,auth_uid) VALUES(other_u,'SYNTHETIC_ROLLBACK_'||other_u,'rep',true,other_au);
  INSERT INTO crm_security.access_review(user_id,reviewed_auth_uid,source_role,permission_role,approved,reviewed_by,expires_at)
  VALUES(other_u,other_au,'rep',role_name,true,'rollback verification',now()+interval '1 hour');
  PERFORM set_config('request.jwt.claim.sub',other_au::text,true);
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM public.crm_write_command_v2(gen_random_uuid(),'relationship_contact',d,3,p);
   RAISE EXCEPTION 'foreign or unscoped actor accepted';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
  RESET ROLE;
  checks:=checks||to_jsonb(role_name||' unscoped write denied');
 END LOOP;
 PERFORM set_config('request.jwt.claim.sub',au::text,true);
 UPDATE public.users SET active=false WHERE user_id=u;
 SET LOCAL ROLE authenticated;
 BEGIN PERFORM public.crm_write_command_v2(gen_random_uuid(),'relationship_contact',d,3,p);
  RAISE EXCEPTION 'inactive user accepted';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
 RESET ROLE;
 UPDATE public.users SET active=true WHERE user_id=u;
 UPDATE crm_security.access_review SET expires_at=now()-interval '1 minute' WHERE user_id=u;
 SET LOCAL ROLE authenticated;
 BEGIN PERFORM public.crm_write_command_v2(gen_random_uuid(),'relationship_contact',d,3,p);
  RAISE EXCEPTION 'expired review accepted';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
 RESET ROLE;
 checks:=checks||'["inactive actor denied","expired access denied"]'::jsonb;
 IF (SELECT version FROM public.deals WHERE id=d)<>3 OR (SELECT count(*) FROM public.activities WHERE deal_id=d)<>1
 OR (SELECT count(*) FROM public.next_actions WHERE deal_id=d)<>1
 OR (SELECT count(*) FROM crm_security.command_receipts WHERE object_id=d)<>2
 THEN RAISE EXCEPTION 'rejected request mutated records'; END IF;
 PERFORM set_config('crm.relationship_verify_result',jsonb_build_object('checks',checks,'synthetic',true,'transaction','ROLLBACK')::text,true);
END $verify$;
SELECT current_setting('crm.relationship_verify_result')::jsonb result;
ROLLBACK;