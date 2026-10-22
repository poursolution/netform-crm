-- 브랜드별 공식 채널 발신 분리 v1 (2026-10-22 회의록 9/9 '공식 브랜드 채널 발신 연동': 고객이 아는 브랜드(POUR공법 · 아파트스퀘어 · 석민이앤씨 · POUR솔루션)의 발신번호로 문자가 나가게)
--   · 큐 표는 바꾸지 않는다. 실행기가 가져가는 항목(claim · pending)에 'sender_brand'(캠페인 = 그 고객 영업건의 유입 브랜드, 문의 문자 = 문의 브랜드)만 더한다.
--   · 발신번호 자체는 서버에 두지 않는다 — 대표 PC 실행기의 암호화 설정(브랜드 → 알리고 등록 발신번호)이 고른다. 브랜드가 없거나 번호가 안 정해졌으면 기본 발신번호.
--   · 함수 4개 교체(같은 이름 · 같은 인자 · 같은 반환 모양 + 칸 하나). public 겉함수 · 권한은 그대로. 다시 실행해도 안전하다.
BEGIN;

CREATE OR REPLACE FUNCTION crm_security.crm_sms_worker_claim_v1(p_worker_id uuid,p_allowed_receivers text[],p_limit integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
declare result jsonb;
begin
 if p_worker_id is null or p_limit is null or p_limit not between 1 and 50
 or coalesce(cardinality(p_allowed_receivers),0) not between 1 and 500
 or exists(select 1 from unnest(p_allowed_receivers) p where p is null or p !~ '^010[0-9]{8}$')
 then raise exception 'invalid worker claim' using errcode='22023'; end if;
 -- Never requeue sending rows: a timeout is not evidence that Aligo rejected a send.
 with picked as (
 select r.id from crm_security.sms_campaign_recipients r
 join crm_security.sms_campaigns c on c.id=r.campaign_id
 join public.contacts ct on ct.id=r.contact_id
 join crm_security.contact_compat_state cs on cs.contact_id=r.contact_id and cs.deal_id=r.deal_id
 join public.deals d on d.id=r.deal_id
 join public.users u on u.user_id=c.created_by_user_id
 join crm_security.access_review ar on ar.user_id=u.user_id
 where r.status='queued' and r.available_at<=clock_timestamp() and r.phone=any(p_allowed_receivers)
 and c.status in ('queued','scheduled','sending','submitted','unknown')
 and u.active and u.auth_uid=c.created_by_auth_uid and ar.approved and ar.permission_role='admin'
 and ar.source_role=u.role and ar.reviewed_auth_uid=u.auth_uid and ar.expires_at>now()
 and cs.sms_consent and cs.consent_at is not null and cs.consent_at<=now()
 and not coalesce(cs.send_blocked,true) and cs.opt_out_at is null
 and ct.person_key=r.person_key
 and regexp_replace(coalesce(nullif(ct.mobile,''),ct.phone,''),'[^0-9]','','g')=r.phone
 and (ct.id=d.contact_id or ct.person_key=d.person_key or exists(
 select 1 from public.contact_assignments ca where ca.person_key=ct.person_key
 and ca.opportunity_id=d.id and ca.status='current' and ca.ended_at is null))
 order by r.available_at,r.id for update of r skip locked limit p_limit
 ), updated as (
 update crm_security.sms_campaign_recipients r set status='sending',worker_id=p_worker_id,
 claim_token=gen_random_uuid(),claimed_at=clock_timestamp(),attempt_count=attempt_count+1,updated_at=clock_timestamp()
 from picked where picked.id=r.id returning r.*
 )
 select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'claim_token',x.claim_token,'receiver',x.phone,
 'message',x.personalized_body,'type',case when octet_length(x.personalized_body)<=90 then 'SMS' else 'LMS' end,
 'status',x.status,'provider_message_id',x.provider_message_id,
 'sender_brand',coalesce(nullif(btrim(d.origin_business),''),nullif(btrim(d.brand),'')))),'[]'::jsonb) into result
 from updated x left join public.deals d on d.id=x.deal_id;
 return jsonb_build_object('contract_version',1,'items',result);
end $$;

CREATE OR REPLACE FUNCTION crm_security.crm_sms_worker_pending_v1(p_worker_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
declare result jsonb;
begin
 if p_worker_id is null then raise exception 'invalid worker' using errcode='22023'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'claim_token',r.claim_token,'receiver',r.phone,
 'message',r.personalized_body,'type',case when octet_length(r.personalized_body)<=90 then 'SMS' else 'LMS' end,
 'status',r.status,'provider_message_id',r.provider_message_id,
 'sender_brand',coalesce(nullif(btrim(d.origin_business),''),nullif(btrim(d.brand),'')))),'[]'::jsonb) into result
 from (select * from crm_security.sms_campaign_recipients
 where worker_id=p_worker_id and status in ('sending','submitted') order by updated_at,id limit 500) r
 left join public.deals d on d.id=r.deal_id;
 return jsonb_build_object('contract_version',1,'items',result);
end $$;

CREATE OR REPLACE FUNCTION crm_security.crm_sms_worker_claim_inquiry_v1(p_worker_id uuid,p_limit integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
declare result jsonb;
begin
 if p_worker_id is null or p_limit is null or p_limit not between 1 and 50 then raise exception 'invalid worker claim' using errcode='22023'; end if;
 update crm_security.inquiry_sms_requests set status='cancelled',last_error='EXPIRED_24H',updated_at=clock_timestamp()
  where status='queued' and created_at<clock_timestamp()-interval '24 hours';
 with picked as (
  select r.id from crm_security.inquiry_sms_requests r
  join public.inquiries q on q.id=r.inquiry_id
  join public.users u on u.user_id=r.requested_by
  join crm_security.access_review ar on ar.user_id=u.user_id
  where r.status='queued' and r.available_at<=clock_timestamp()
  and u.active and u.auth_uid=r.requested_by_auth and ar.approved and ar.permission_role in ('admin','rep','branch')
  and ar.source_role=u.role and ar.reviewed_auth_uid=u.auth_uid and ar.expires_at>now()
  and (to_jsonb(q)->>'deleted_at') is null
  order by r.available_at,r.id for update of r skip locked limit p_limit
 ), updated as (
  update crm_security.inquiry_sms_requests r set status='sending',worker_id=p_worker_id,claim_token=gen_random_uuid(),claimed_at=clock_timestamp(),attempt_count=attempt_count+1,updated_at=clock_timestamp()
  from picked where picked.id=r.id returning r.*
 )
 select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'claim_token',x.claim_token,'receiver',x.phone,'message',x.body,
  'type',case when octet_length(x.body)<=90 then 'SMS' else 'LMS' end,'status',x.status,'provider_message_id',x.provider_message_id,
  'sender_brand',nullif(btrim(q.brand),''))),'[]'::jsonb) into result
 from updated x left join public.inquiries q on q.id=x.inquiry_id;
 return jsonb_build_object('contract_version',1,'items',result);
end $fn$;

CREATE OR REPLACE FUNCTION crm_security.crm_sms_worker_pending_inquiry_v1(p_worker_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
declare result jsonb;
begin
 if p_worker_id is null then raise exception 'invalid worker' using errcode='22023'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'claim_token',r.claim_token,'receiver',r.phone,'message',r.body,
  'type',case when octet_length(r.body)<=90 then 'SMS' else 'LMS' end,'status',r.status,'provider_message_id',r.provider_message_id,
  'sender_brand',nullif(btrim(q.brand),''))),'[]'::jsonb) into result
  from (select * from crm_security.inquiry_sms_requests where worker_id=p_worker_id and status in ('sending','submitted') order by updated_at,id limit 500) r
  left join public.inquiries q on q.id=r.inquiry_id;
 return jsonb_build_object('contract_version',1,'items',result);
end $fn$;

REVOKE ALL ON FUNCTION crm_security.crm_sms_worker_claim_v1(uuid,text[],integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION crm_security.crm_sms_worker_pending_v1(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION crm_security.crm_sms_worker_claim_inquiry_v1(uuid,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION crm_security.crm_sms_worker_pending_inquiry_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION crm_security.crm_sms_worker_claim_v1(uuid,text[],integer) TO service_role;
GRANT EXECUTE ON FUNCTION crm_security.crm_sms_worker_pending_v1(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION crm_security.crm_sms_worker_claim_inquiry_v1(uuid,integer) TO service_role;
GRANT EXECUTE ON FUNCTION crm_security.crm_sms_worker_pending_inquiry_v1(uuid) TO service_role;

COMMIT;
