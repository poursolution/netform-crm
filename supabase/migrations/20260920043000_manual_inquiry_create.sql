-- Manual intake for an existing approved administrator. No ingestion credentials
-- or direct table privileges are exposed to browsers. Existing rows are untouched.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
create table crm_security.manual_inquiry_receipts (
 actor_auth_uid uuid not null,
 request_id uuid not null,
 actor_user_id uuid not null,
 inquiry_id uuid not null,
 payload jsonb not null,
 ack jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(actor_auth_uid,request_id)
);
alter table crm_security.manual_inquiry_receipts enable row level security;
revoke all on crm_security.manual_inquiry_receipts from public,anon,authenticated,service_role;

create function public.crm_inquiry_manual_capability_v1() returns jsonb
language sql stable security definer set search_path='' as $fn$
 select jsonb_build_object('contract_version',1,'can_create',exists(
  select 1 from crm_security.actor() a where a.permission_role='admin'));
$fn$;

create function public.crm_inquiry_manual_create_v1(p_request_id uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare a record; prior crm_security.manual_inquiry_receipts%rowtype;
 v_id uuid; v_at timestamptz:=clock_timestamp(); v_ack jsonb; v_phone text; v_key text;
begin
 if auth.uid() is null then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 perform 1 from public.users where auth_uid=auth.uid() for share;
 perform 1 from crm_security.access_review where reviewed_auth_uid=auth.uid() for share;
 select * into a from crm_security.actor();
 if not found or a.permission_role<>'admin' then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 if p_request_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object'
  or not (p_payload ?& array['brand','site_name','contact_name','phone','address','work_type','message','channel'])
  or (p_payload - array['brand','site_name','contact_name','phone','address','work_type','message','channel']) <> '{}'::jsonb
 then raise exception 'INVALID_PAYLOAD' using errcode='22023'; end if;
 for v_key in select jsonb_object_keys(p_payload) loop
  if jsonb_typeof(p_payload->v_key)<>'string' then raise exception 'INVALID_FIELD_TYPE' using errcode='22023'; end if;
 end loop;
 if p_payload->>'brand' not in ('석민이앤씨','POUR솔루션','POUR공법','아파트스퀘어')
  or p_payload->>'channel' not in ('전화','문자','카카오','이메일','방문','기타')
  or length(btrim(p_payload->>'site_name')) not between 1 and 200
  or length(btrim(p_payload->>'message')) not between 2 and 10000
  or length(p_payload->>'contact_name')>100 or length(p_payload->>'address')>500
  or length(p_payload->>'work_type')>200 or length(p_payload->>'phone')>50
 then raise exception 'INVALID_INQUIRY_FIELDS' using errcode='22023'; end if;
 v_phone:=regexp_replace(p_payload->>'phone','[^0-9]','','g');
 if (btrim(p_payload->>'contact_name')='' and v_phone='')
  or (p_payload->>'phone'<>'' and ((p_payload->>'phone') !~ '^[0-9+(). -]+$' or length(v_phone) not between 9 and 15))
 then raise exception 'INVALID_CONTACT' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('manual-inquiry:'||a.auth_uid::text||':'||p_request_id::text,0));
 select * into prior from crm_security.manual_inquiry_receipts where actor_auth_uid=a.auth_uid and request_id=p_request_id;
 if found then
  if prior.payload<>p_payload or prior.actor_user_id<>a.user_id then raise exception 'REQUEST_ID_REUSE' using errcode='PT409'; end if;
  if not crm_security.can_inquiry(prior.inquiry_id) then raise exception 'INQUIRY_UNAVAILABLE' using errcode='PT409'; end if;
  return prior.ack||jsonb_build_object('replayed',true);
 end if;
 insert into public.inquiries(brand,site_name,contact_name,phone,address,work_type,status,received_at,created_at,updated_at,
  assigned_to,assigned_at,assignee_name,source_channel,source,channel,inquiry_type,business_type,raw)
 values(p_payload->>'brand',btrim(p_payload->>'site_name'),nullif(btrim(p_payload->>'contact_name'),''),nullif(v_phone,''),
  nullif(btrim(p_payload->>'address'),''),nullif(btrim(p_payload->>'work_type'),''),'접수',v_at,v_at,v_at,
  null,null,null,'crm_manual','CRM 수동 등록',p_payload->>'channel','견적문의','견적문의',
  p_payload||jsonb_build_object('manual_request_id',p_request_id,'manual_actor_user_id',a.user_id,
   'manual_actor_name',a.display_name,'message',btrim(p_payload->>'message')))
 returning id into v_id;
 -- A deployment with different admin scope rules must fail atomically rather
 -- than creating an inquiry that the submitting actor cannot read back.
 if not crm_security.can_inquiry(v_id) then raise exception 'INQUIRY_SCOPE_UNAVAILABLE' using errcode='42501'; end if;
 v_ack:=jsonb_build_object('ok',true,'contract_version',1,'operation','inquiry_manual_create','request_id',p_request_id,
  'inquiry_id',v_id,'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'status','접수','assigned_to',null,'server_at',v_at,'replayed',false);
 insert into crm_security.manual_inquiry_receipts(actor_auth_uid,request_id,actor_user_id,inquiry_id,payload,ack)
 values(a.auth_uid,p_request_id,a.user_id,v_id,p_payload,v_ack);
 return v_ack;
end $fn$;
revoke all on function public.crm_inquiry_manual_capability_v1() from public,anon,authenticated,service_role;
revoke all on function public.crm_inquiry_manual_create_v1(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.crm_inquiry_manual_capability_v1() to authenticated;
grant execute on function public.crm_inquiry_manual_create_v1(uuid,jsonb) to authenticated;
commit;
