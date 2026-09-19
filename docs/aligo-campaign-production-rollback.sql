BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='30s';
DO $verify$
DECLARE
 u uuid:=gen_random_uuid(); au uuid:=gen_random_uuid(); d uuid:=gen_random_uuid(); ct uuid:=gen_random_uuid();
 cmp uuid:=gen_random_uuid(); req uuid:=gen_random_uuid(); worker uuid:=gen_random_uuid();
 second_cmp uuid:=gen_random_uuid(); second_req uuid:=gen_random_uuid();
 p jsonb; ack jsonb; batch jsonb; row_data jsonb; recipient uuid; claim uuid; checks jsonb:='[]';
BEGIN
 INSERT INTO public.users(user_id,name,role,active,auth_uid) VALUES(u,'SYNTHETIC_ALIGO_ROLLBACK_'||u,'admin',true,au);
 INSERT INTO crm_security.access_review(user_id,reviewed_auth_uid,source_role,permission_role,approved,reviewed_by,expires_at)
 VALUES(u,au,'admin','admin',true,'synthetic aligo rollback',now()+interval '1 hour');
 INSERT INTO public.contacts(id,name,person_key,mobile,phone) VALUES(ct,'SYNTHETIC_ALIGO','mobile:01000000000','01000000000','01000000000');
 INSERT INTO public.deals(id,owner_id,stage_code,version,contact_id,person_key) VALUES(d,u,'rapport',1,ct,'mobile:01000000000');
 INSERT INTO crm_security.contact_compat_state(contact_id,deal_id,sms_consent,consent_at,send_blocked,updated_by_auth_uid,updated_by_user_id,updated_at)
 VALUES(ct,d,true,now()-interval '1 day',false,au,u,now());
 PERFORM set_config('request.jwt.claim.sub',au::text,true);
 p:=jsonb_build_object('campaign_id','synthetic-'||cmp,'category_key','test','category_label','test','category_group','test',
 'template_key','custom','body','synthetic rollback','status','queued','recipient_count',1,'excluded_count',0,
 'recipients',jsonb_build_array(jsonb_build_object('opportunity_id',d,'person_key','mobile:01000000000','phone','01000000000',
 'site_name','synthetic','contact_name','synthetic','owner','synthetic','personalized_body','synthetic rollback')));
 SET LOCAL ROLE authenticated;
 ack:=public.crm_write_command_v2(req,'campaign_create',cmp,0,p);
 IF ack->>'status'<>'queued' OR ack->>'recipient_count'<>'1' THEN RAISE EXCEPTION 'create ack failed'; END IF;
 IF public.crm_write_command_v2(req,'campaign_create',cmp,0,p)->>'replayed'<>'true' THEN RAISE EXCEPTION 'replay failed'; END IF;
 BEGIN PERFORM public.crm_write_command_v2(req,'campaign_create',cmp,0,p||'{"body":"changed"}');
 RAISE EXCEPTION 'changed replay accepted'; EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
 BEGIN PERFORM public.crm_sms_worker_claim_v1(worker,ARRAY['01000000000'],10);
 RAISE EXCEPTION 'authenticated worker access accepted'; EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
 RESET ROLE;
 IF (SELECT count(*) FROM crm_security.sms_campaign_recipients WHERE campaign_id=cmp)<>1 THEN RAISE EXCEPTION 'recipient duplicate'; END IF;
 checks:=checks||'["admin create and ack","idempotent create","changed payload rejected","authenticated worker denied"]';
 UPDATE crm_security.contact_compat_state SET send_blocked=true,sms_consent=false,opt_out_at=now() WHERE contact_id=ct AND deal_id=d;
 SET LOCAL ROLE service_role;
 batch:=public.crm_sms_worker_claim_v1(worker,ARRAY['01000000000'],10);
 IF jsonb_array_length(batch->'items')<>0 THEN RAISE EXCEPTION 'blocked recipient claimed'; END IF;
 RESET ROLE;
 UPDATE crm_security.contact_compat_state SET send_blocked=false,sms_consent=true,opt_out_at=null WHERE contact_id=ct AND deal_id=d;
 SET LOCAL ROLE service_role;
 batch:=public.crm_sms_worker_claim_v1(worker,ARRAY['01011111111'],10);
 IF jsonb_array_length(batch->'items')<>0 THEN RAISE EXCEPTION 'allowlist ignored'; END IF;
 batch:=public.crm_sms_worker_claim_v1(worker,ARRAY['01000000000'],10);
 IF jsonb_array_length(batch->'items')<>1 THEN RAISE EXCEPTION 'claim failed'; END IF;
 row_data:=batch->'items'->0;recipient:=(row_data->>'id')::uuid;claim:=(row_data->>'claim_token')::uuid;
 IF jsonb_array_length(public.crm_sms_worker_claim_v1(worker,ARRAY['01000000000'],10)->'items')<>0 THEN RAISE EXCEPTION 'duplicate claim'; END IF;
 BEGIN PERFORM public.crm_sms_worker_result_v1(worker,recipient,gen_random_uuid(),'sent','123',null);
 RAISE EXCEPTION 'wrong claim accepted'; EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
 PERFORM public.crm_sms_worker_result_v1(worker,recipient,claim,'submitted','123',null);
 BEGIN PERFORM public.crm_sms_worker_result_v1(worker,recipient,claim,'sent','999',null);
 RAISE EXCEPTION 'changed provider ID accepted'; EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
 PERFORM public.crm_sms_worker_result_v1(worker,recipient,claim,'sent','123',null);
 PERFORM public.crm_sms_worker_result_v1(worker,recipient,claim,'sent','123',null);
 BEGIN PERFORM public.crm_sms_worker_result_v1(worker,recipient,claim,'submitted','123',null);
 RAISE EXCEPTION 'terminal downgrade accepted'; EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
 RESET ROLE;
 IF (SELECT count(*) FROM public.activities WHERE deal_id=d)<>1 OR (SELECT status FROM crm_security.sms_campaigns WHERE id=cmp)<>'sent'
 THEN RAISE EXCEPTION 'delivery readback failed'; END IF;
 checks:=checks||'["consent rechecked","receiver allowlist","single claim","wrong claim rejected","provider ID immutable","terminal replay no duplicate activity","terminal downgrade rejected"]';
 SET LOCAL ROLE authenticated;
 ack:=public.crm_operational_source_v1('campaign_core',null,100);
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(ack->'items') x WHERE x->>'id'=cmp::text AND x->>'sent_count'='1')
 THEN RAISE EXCEPTION 'campaign UI readback failed'; END IF;
 p:=p||jsonb_build_object('campaign_id','synthetic-'||second_cmp,'status','scheduled','scheduled_at',now()+interval '1 hour');
 PERFORM public.crm_write_command_v2(second_req,'campaign_create',second_cmp,0,p);
 RESET ROLE;
 SET LOCAL ROLE service_role;
 IF jsonb_array_length(public.crm_sms_worker_claim_v1(worker,ARRAY['01000000000'],10)->'items')<>0 THEN RAISE EXCEPTION 'scheduled sent early'; END IF;
 RESET ROLE;
 UPDATE crm_security.sms_campaign_recipients SET available_at=now()-interval '1 second' WHERE campaign_id=second_cmp;
 SET LOCAL ROLE service_role;
 batch:=public.crm_sms_worker_claim_v1(worker,ARRAY['01000000000'],10);
 row_data:=batch->'items'->0;recipient:=(row_data->>'id')::uuid;claim:=(row_data->>'claim_token')::uuid;
 IF recipient IS NULL THEN RAISE EXCEPTION 'due schedule not claimed'; END IF;
 PERFORM public.crm_sms_worker_result_v1(worker,recipient,claim,'unknown',null,'SYNTHETIC_TIMEOUT');
 IF jsonb_array_length(public.crm_sms_worker_claim_v1(worker,ARRAY['01000000000'],10)->'items')<>0 THEN RAISE EXCEPTION 'unknown requeued'; END IF;
 RESET ROLE;
 UPDATE crm_security.access_review SET permission_role='rep' WHERE user_id=u;
 SET LOCAL ROLE authenticated;
 BEGIN PERFORM public.crm_operational_source_v1('campaign_core',null,100);
 RAISE EXCEPTION 'rep campaign read accepted'; EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
 RESET ROLE;
 checks:=checks||'["campaign source readback","future schedule deferred","due schedule claimed","unknown never requeued","non-admin read denied"]';
 PERFORM set_config('crm.aligo_verification',jsonb_build_object('checks',checks,'external_provider_called',false,'synthetic',true,'transaction','ROLLBACK')::text,true);
END $verify$;
SELECT current_setting('crm.aligo_verification')::jsonb result;
ROLLBACK;
