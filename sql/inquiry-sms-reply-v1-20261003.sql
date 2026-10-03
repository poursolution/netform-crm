-- 견적문의 응대 문자 — CRM 직접 발송 큐 v1 (2026-10-03 대표 "진행해")
-- 고객이 먼저 문의한 건에 대한 응대 문자(거래 안내)를 담당자가 상세 창에서 [CRM에서 보내기]로 요청하면 큐에 쌓이고,
-- 대표 PC의 알리고 실행기(ALIGO_INQUIRY_REPLIES=true)가 가져가 보낸다. 광고성 캠페인 큐(sms_campaign_*)와 분리한다.
-- 지키는 것: 관리자 또는 그 문의의 담당자만 · 종결 문의 금지 · 받는 번호는 문의에 적힌 휴대폰(010) 그대로 · 문의당 24시간 3건 · 24시간 지난 요청은 실행기가 집지 않음(취소 처리).
-- 다시 실행해도 안전. 운영 적용: Supabase SQL 편집기에서 대표가 Run. 화면은 CRMRelease 게이트로 함수가 있을 때만 [CRM에서 보내기]를 연다.

create table if not exists crm_security.inquiry_sms_requests(
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null unique,
 inquiry_id uuid not null references public.inquiries(id),
 phone text not null check (phone ~ '^010[0-9]{8}$'),
 body text not null check (length(body) between 1 and 2000),
 requested_by uuid not null,
 requested_by_auth uuid not null,
 requested_by_name text not null,
 status text not null default 'queued' check (status in ('queued','sending','submitted','sent','failed','unknown','cancelled')),
 attempt_count integer not null default 0 check (attempt_count>=0),
 available_at timestamptz not null default clock_timestamp(),
 claimed_at timestamptz, worker_id uuid, claim_token uuid,
 submitted_at timestamptz, delivered_at timestamptz, failed_at timestamptz,
 provider_message_id text, last_error text,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp()
);
create index if not exists inquiry_sms_requests_claim_idx on crm_security.inquiry_sms_requests(status,available_at) where status in ('queued','sending','submitted');
create index if not exists inquiry_sms_requests_inquiry_idx on crm_security.inquiry_sms_requests(inquiry_id,created_at desc);
alter table crm_security.inquiry_sms_requests enable row level security;
revoke all on table crm_security.inquiry_sms_requests from public, anon, authenticated;

-- ① 화면: 발송 요청(담당자 · 관리자)
create or replace function public.crm_inquiry_sms_request_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare a record; q public.inquiries%rowtype; v_id uuid; v_req uuid; v_body text; v_phone text; v_n int; r crm_security.inquiry_sms_requests%rowtype;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 begin v_id:=(p->>'inquiry_id')::uuid; v_req:=(p->>'request_id')::uuid; exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 v_body:=nullif(btrim(coalesce(p->>'text','')),'');
 if v_id is null or v_req is null or v_body is null or length(v_body)>2000 then raise exception 'invalid payload' using errcode='22023'; end if;
 select * into r from crm_security.inquiry_sms_requests where request_id=v_req;
 if found then return jsonb_build_object('ok',true,'id',r.id,'status',r.status,'phone',r.phone,'duplicate',true); end if;
 select * into q from public.inquiries i where i.id=v_id for update;
 if not found then raise exception '문의를 찾을 수 없습니다' using errcode='22023'; end if;
 if a.permission_role<>'admin' and (q.assigned_to is null or q.assigned_to<>a.user_id) then raise exception '담당자 또는 관리자만 보낼 수 있습니다' using errcode='42501'; end if;
 if coalesce(q.status,'') in ('종결','종료','수주','실주') then raise exception '종결된 문의에는 보낼 수 없습니다' using errcode='22023'; end if;
 v_phone:=regexp_replace(coalesce(q.phone,''),'[^0-9]','','g');
 if v_phone !~ '^010[0-9]{8}$' then raise exception '문의의 휴대폰 번호(010)를 먼저 확인해 주세요' using errcode='22023'; end if;
 select count(*) into v_n from crm_security.inquiry_sms_requests x where x.inquiry_id=v_id and x.created_at>clock_timestamp()-interval '24 hours' and x.status<>'cancelled';
 if v_n>=3 then raise exception '같은 문의에 24시간 안 3건까지만 보낼 수 있습니다' using errcode='22023'; end if;
 insert into crm_security.inquiry_sms_requests(request_id,inquiry_id,phone,body,requested_by,requested_by_auth,requested_by_name)
  values(v_req,v_id,v_phone,v_body,a.user_id,a.auth_uid,a.display_name) returning * into r;
 return jsonb_build_object('ok',true,'id',r.id,'status',r.status,'phone',r.phone,'created_at',r.created_at);
end $fn$;
revoke all on function public.crm_inquiry_sms_request_v1(jsonb) from public, anon;
grant execute on function public.crm_inquiry_sms_request_v1(jsonb) to authenticated;

-- ② 화면: 그 문의의 발송 요청 목록(상태)
create or replace function public.crm_inquiry_sms_list_v1(p jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare a record; q public.inquiries%rowtype; v_id uuid;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 begin v_id:=(p->>'inquiry_id')::uuid; exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 select * into q from public.inquiries i where i.id=v_id;
 if not found then raise exception '문의를 찾을 수 없습니다' using errcode='22023'; end if;
 if a.permission_role<>'admin' and (q.assigned_to is null or q.assigned_to<>a.user_id) then raise exception 'forbidden' using errcode='42501'; end if;
 return jsonb_build_object('ok',true,'rows',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'status',x.status,'body',x.body,'phone',x.phone,'requested_by_name',x.requested_by_name,'created_at',x.created_at,'submitted_at',x.submitted_at,'delivered_at',x.delivered_at,'failed_at',x.failed_at,'last_error',x.last_error) order by x.created_at desc)
  from crm_security.inquiry_sms_requests x where x.inquiry_id=v_id),'[]'::jsonb));
end $fn$;
revoke all on function public.crm_inquiry_sms_list_v1(jsonb) from public, anon;
grant execute on function public.crm_inquiry_sms_list_v1(jsonb) to authenticated;

-- ③ 실행기(service_role 전용): 가져가기 · 진행 중 · 결과 — 요청한 사용자가 지금도 승인된 활성 사용자일 때만, 24시간 지난 요청은 취소
create or replace function crm_security.crm_sms_worker_claim_inquiry_v1(p_worker_id uuid,p_limit integer)
returns jsonb language plpgsql security definer set search_path='' as $fn$
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
  and q.deleted_at is null
  order by r.available_at,r.id for update of r skip locked limit p_limit
 ), updated as (
  update crm_security.inquiry_sms_requests r set status='sending',worker_id=p_worker_id,claim_token=gen_random_uuid(),claimed_at=clock_timestamp(),attempt_count=attempt_count+1,updated_at=clock_timestamp()
  from picked where picked.id=r.id returning r.*
 )
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'claim_token',claim_token,'receiver',phone,'message',body,
  'type',case when octet_length(body)<=90 then 'SMS' else 'LMS' end,'status',status,'provider_message_id',provider_message_id)),'[]'::jsonb) into result from updated;
 return jsonb_build_object('contract_version',1,'items',result);
end $fn$;
create or replace function crm_security.crm_sms_worker_pending_inquiry_v1(p_worker_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare result jsonb;
begin
 if p_worker_id is null then raise exception 'invalid worker' using errcode='22023'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'claim_token',r.claim_token,'receiver',r.phone,'message',r.body,
  'type',case when octet_length(r.body)<=90 then 'SMS' else 'LMS' end,'status',r.status,'provider_message_id',r.provider_message_id)),'[]'::jsonb) into result
  from (select * from crm_security.inquiry_sms_requests where worker_id=p_worker_id and status in ('sending','submitted') order by updated_at,id limit 500) r;
 return jsonb_build_object('contract_version',1,'items',result);
end $fn$;
create or replace function crm_security.crm_sms_worker_result_inquiry_v1(p_worker_id uuid,p_request_id uuid,p_claim_token uuid,p_status text,p_provider_message_id text,p_error_code text)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare r crm_security.inquiry_sms_requests%rowtype; now_at timestamptz:=clock_timestamp();
begin
 if p_worker_id is null or p_request_id is null or p_claim_token is null or p_status is null or p_status not in ('submitted','sent','failed','unknown')
  or (p_status in ('submitted','sent') and coalesce(p_provider_message_id,'') !~ '^[1-9][0-9]{0,19}$')
  or (p_provider_message_id is not null and p_provider_message_id !~ '^[1-9][0-9]{0,19}$')
  or (p_error_code is not null and p_error_code !~ '^[A-Z0-9_:-]{1,100}$')
 then raise exception 'invalid worker result' using errcode='22023'; end if;
 select * into r from crm_security.inquiry_sms_requests where id=p_request_id for update;
 if not found or r.worker_id is distinct from p_worker_id or r.claim_token is distinct from p_claim_token then raise exception 'claim conflict' using errcode='PT409'; end if;
 if r.provider_message_id is not null and r.provider_message_id is distinct from p_provider_message_id then raise exception 'provider identity conflict' using errcode='PT409'; end if;
 if r.status in ('sent','failed','cancelled','unknown') then
  if r.status is distinct from p_status then raise exception 'terminal conflict' using errcode='PT409'; end if;
 elsif r.status not in ('sending','submitted') or (r.status='submitted' and p_status='unknown') then
  raise exception 'invalid transition' using errcode='PT409';
 else
  update crm_security.inquiry_sms_requests set status=p_status,provider_message_id=p_provider_message_id,last_error=p_error_code,updated_at=now_at,
   submitted_at=case when p_status in ('submitted','sent') then coalesce(submitted_at,now_at) else submitted_at end,
   delivered_at=case when p_status='sent' then now_at else delivered_at end,
   failed_at=case when p_status='failed' then now_at else failed_at end where id=r.id;
 end if;
 return jsonb_build_object('ok',true,'request_id',r.id,'status',p_status);
end $fn$;
create or replace function public.crm_sms_worker_claim_inquiry_v1(p_worker_id uuid,p_limit integer default 10)
returns jsonb language sql security invoker set search_path='' as $$ select crm_security.crm_sms_worker_claim_inquiry_v1(p_worker_id,p_limit) $$;
create or replace function public.crm_sms_worker_pending_inquiry_v1(p_worker_id uuid)
returns jsonb language sql security invoker set search_path='' as $$ select crm_security.crm_sms_worker_pending_inquiry_v1(p_worker_id) $$;
create or replace function public.crm_sms_worker_result_inquiry_v1(p_worker_id uuid,p_request_id uuid,p_claim_token uuid,p_status text,p_provider_message_id text default null,p_error_code text default null)
returns jsonb language sql security invoker set search_path='' as $$ select crm_security.crm_sms_worker_result_inquiry_v1(p_worker_id,p_request_id,p_claim_token,p_status,p_provider_message_id,p_error_code) $$;
revoke all on function crm_security.crm_sms_worker_claim_inquiry_v1(uuid,integer) from public,anon,authenticated;
revoke all on function crm_security.crm_sms_worker_pending_inquiry_v1(uuid) from public,anon,authenticated;
revoke all on function crm_security.crm_sms_worker_result_inquiry_v1(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.crm_sms_worker_claim_inquiry_v1(uuid,integer) from public,anon,authenticated;
revoke all on function public.crm_sms_worker_pending_inquiry_v1(uuid) from public,anon,authenticated;
revoke all on function public.crm_sms_worker_result_inquiry_v1(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function crm_security.crm_sms_worker_claim_inquiry_v1(uuid,integer) to service_role;
grant execute on function crm_security.crm_sms_worker_pending_inquiry_v1(uuid) to service_role;
grant execute on function crm_security.crm_sms_worker_result_inquiry_v1(uuid,uuid,uuid,text,text,text) to service_role;
grant execute on function public.crm_sms_worker_claim_inquiry_v1(uuid,integer) to service_role;
grant execute on function public.crm_sms_worker_pending_inquiry_v1(uuid) to service_role;
grant execute on function public.crm_sms_worker_result_inquiry_v1(uuid,uuid,uuid,text,text,text) to service_role;
