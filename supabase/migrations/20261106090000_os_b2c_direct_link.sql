-- OS B2C 접수 ↔ CRM 직접 연결. 로그인한 담당자만 호출하고, 서비스 키·표 직접 권한은 브라우저에 주지 않는다.
-- 기존 문의의 담당·내용은 덮어쓰지 않는다. 표와 함수를 새로 더할 뿐 기존 함수는 바꾸지 않는다.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

create table crm_security.os_b2c_links(
 os_b2c_id text primary key,
 inquiry_id uuid not null references public.inquiries(id),
 matched_existing boolean not null default false,
 created_by_user_id uuid not null,
 created_by_name text not null,
 created_at timestamptz not null default clock_timestamp()
);
create index os_b2c_links_inquiry on crm_security.os_b2c_links(inquiry_id);
create table crm_security.os_b2c_link_events(
 id bigint generated always as identity primary key,
 os_b2c_id text not null,
 inquiry_id uuid not null,
 action text not null check(action in ('create','link_existing','owner_change')),
 from_name text,
 to_name text,
 actor_user_id uuid not null,
 actor_name text not null,
 created_at timestamptz not null default clock_timestamp()
);
alter table crm_security.os_b2c_links enable row level security;
alter table crm_security.os_b2c_link_events enable row level security;
revoke all on crm_security.os_b2c_links,crm_security.os_b2c_link_events from public,anon,authenticated,service_role;

-- 권한은 서버 기록으로만 판단한다. 화면이 보낸 이름·역할은 쓰지 않는다.
create function crm_security.os_b2c_actor() returns table(user_id uuid,auth_uid uuid,display_name text,permission_role text)
language sql stable security definer set search_path='' as $fn$
 select a.user_id,a.auth_uid,a.display_name,a.permission_role from crm_security.actor() a where a.permission_role in ('admin','consultation');
$fn$;
revoke all on function crm_security.os_b2c_actor() from public,anon,authenticated,service_role;

-- CRM 직접 배정과 같은 기준: 로그인이 승인된 영업(rep) 계정 중 이름이 정확히 한 명과 맞을 때만 담당으로 잡는다.
create function crm_security.os_b2c_owner(p_name text,out user_id uuid,out name text)
language plpgsql stable security definer set search_path='' as $fn$
declare n integer;
begin
 select count(*),min(u.user_id::text)::uuid,min(u.name) into n,user_id,name from public.users u join crm_security.access_review r on r.user_id=u.user_id
 where u.active is true and u.auth_uid is not null and r.reviewed_auth_uid=u.auth_uid and r.source_role=u.role and r.permission_role='rep' and r.approved and r.expires_at>now() and btrim(u.name)=btrim(coalesce(p_name,''));
 if n<>1 then user_id:=null;name:=null; end if;
end $fn$;
revoke all on function crm_security.os_b2c_owner(text) from public,anon,authenticated,service_role;

-- CRM 담당 이력과 감사 기록에 CRM 직접 배정과 같은 형식으로 남긴다.
create function crm_security.os_b2c_log_assignment(p_inquiry uuid,p_action text,p_from text,p_to text,p_reason text,p_before jsonb,p_after jsonb,p_at timestamptz,p_auth uuid,p_user uuid,p_actor text) returns void
language sql security definer set search_path='' as $fn$
 insert into public.assignment_history(inquiry_id,from_owner,to_owner,reason,actor_name,changed_at) values(p_inquiry,p_from,p_to,p_reason,p_actor,p_at);
 insert into crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at) values(p_auth,p_user,p_inquiry,p_action,p_before,p_after,p_reason,p_at);
$fn$;
revoke all on function crm_security.os_b2c_log_assignment(uuid,text,text,text,text,jsonb,jsonb,timestamptz,uuid,uuid,text) from public,anon,authenticated,service_role;

-- 화면에 돌려주는 값. 전화번호·주소 같은 고객 원문은 넣지 않는다.
create function crm_security.os_b2c_view(p_os_b2c_id text) returns jsonb
language sql stable security definer set search_path='' as $fn$
 select jsonb_build_object('os_b2c_id',l.os_b2c_id,'crm_inquiry_id',i.id,'crm_deal_id',coalesce(d.id::text,''),
  'crm_status',coalesce(i.status,''),'deal_stage',coalesce(d.stage_code,''),'deal_outcome',coalesce(d.outcome,''),
  'close_reason',coalesce(i.close_reason,''),'assignee_name',coalesce(d.assignee_name,i.assignee_name,''),
  'next_date',coalesce(d.next_action_date::text,i.next_action_date::text,''),
  'last_note',coalesce(c.content,''),'last_note_by',coalesce(c.actor_name,''),'last_note_at',coalesce(c.occurred_at::text,''),
  'quote_amount',coalesce(d.amount,q.amount),'updated_at',greatest(i.updated_at,d.updated_at))
 from crm_security.os_b2c_links l join public.inquiries i on i.id=l.inquiry_id
 left join lateral(select x.* from public.deals x where x.id=i.deal_id or x.origin_inquiry_id=i.id order by (x.id=i.deal_id) desc nulls last,x.created_at desc limit 1) d on true
 left join lateral(select y.content,y.actor_name,y.occurred_at from crm_security.inquiry_contact_logs y where y.inquiry_id=i.id order by y.occurred_at desc limit 1) c on true
 left join lateral(select z.amount from crm_security.inquiry_quote_versions z where z.inquiry_id=i.id order by z.version_no desc limit 1) q on true
 where l.os_b2c_id=p_os_b2c_id;
$fn$;
revoke all on function crm_security.os_b2c_view(text) from public,anon,authenticated,service_role;

create function public.crm_os_b2c_capability_v1() returns jsonb
language sql stable security definer set search_path='' as $fn$
 select jsonb_build_object('contract_version',1,'can_link',exists(select 1 from crm_security.os_b2c_actor()),
  'actor_name',(select a.display_name from crm_security.actor() a limit 1));
$fn$;

create function public.crm_os_b2c_handoff_v1(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare a record; o record; v_id text; v_key text; v_phone text; v_brand_key text; v_inquiry uuid; v_existing uuid; v_at timestamptz:=clock_timestamp(); v_raw jsonb; f text; v_reason text;
begin
 select * into a from crm_security.os_b2c_actor();
 if not found then raise exception 'OS_B2C_FORBIDDEN' using errcode='42501'; end if;
 if p is null or jsonb_typeof(p)<>'object' or pg_column_size(p)>65536 then raise exception 'INVALID_PAYLOAD' using errcode='22023'; end if;
 foreach f in array array['os_b2c_id','handoff_key','brand','site_name','contact_name','phone','address','work_type','message','channel','assignee_name'] loop
  if jsonb_typeof(p->f) is distinct from 'string' then raise exception 'INVALID_FIELD_TYPE' using errcode='22023'; end if;
 end loop;
 v_id:=p->>'os_b2c_id'; v_key:=p->>'handoff_key';
 if v_id !~ '^[A-Za-z0-9-]{1,64}$' or v_key<>'os-b2c:'||v_id then raise exception 'INVALID_HANDOFF_KEY' using errcode='22023'; end if;
 if p->>'brand' not in ('석민이앤씨','POUR솔루션','POUR공법','아파트스퀘어')
  or p->>'channel' not in ('전화','문자','카카오','이메일','방문','기타')
  or length(btrim(p->>'site_name')) not between 1 and 200
  or length(btrim(p->>'message')) not between 2 and 10000
  or length(p->>'contact_name')>100 or length(p->>'address')>500
  or length(p->>'work_type')>200 or length(p->>'phone')>50
  or length(coalesce(p->>'consult_channel',''))>50 or length(coalesce(p->>'inflow_path',''))>100
 then raise exception 'INVALID_INQUIRY_FIELDS' using errcode='22023'; end if;
 v_phone:=regexp_replace(p->>'phone','[^0-9]','','g');
 if (btrim(p->>'contact_name')='' and v_phone='')
  or (p->>'phone'<>'' and ((p->>'phone') !~ '^[0-9+(). -]+$' or length(v_phone) not between 9 and 15))
 then raise exception 'INVALID_CONTACT' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('os-b2c:'||v_id,0));
 if exists(select 1 from crm_security.os_b2c_links l where l.os_b2c_id=v_id) then
  return crm_security.os_b2c_view(v_id)||jsonb_build_object('ok',true,'contract_version',1,'replayed',true);
 end if;
 -- 시트·웹훅 입력과 같은 잠금을 써서, 같은 고객이 동시에 들어와도 한 줄씩 판단한다.
 v_brand_key:=regexp_replace(lower(p->>'brand'),'[[:space:]]','','g');
 if v_phone<>'' then perform pg_advisory_xact_lock(hashtextextended('crm_inquiry_mirror:'||v_phone||'|'||v_brand_key,0)); end if;
 if v_phone<>'' then
  select i.id into v_existing from public.inquiries i
  where regexp_replace(coalesce(i.phone,''),'[^0-9]','','g')=v_phone
   and regexp_replace(lower(coalesce(i.brand,'')),'[[:space:]]','','g')=v_brand_key
   and coalesce(i.status,'') not in ('종결','종료') and nullif(btrim(coalesce(i.close_reason,'')),'') is null
   and coalesce(i.received_at,i.created_at)>=v_at-interval '30 days'
   and coalesce((select e.action from crm_security.inquiry_audit_events e where e.inquiry_id=i.id and e.action in ('inquiry_trash','inquiry_restore','inquiry_purge') order by e.created_at desc,e.event_id desc limit 1),'') not in ('inquiry_trash','inquiry_purge')
  order by coalesce(i.received_at,i.created_at) desc limit 1;
 end if;
 if v_existing is not null then
  insert into crm_security.os_b2c_links(os_b2c_id,inquiry_id,matched_existing,created_by_user_id,created_by_name) values(v_id,v_existing,true,a.user_id,a.display_name);
  insert into crm_security.os_b2c_link_events(os_b2c_id,inquiry_id,action,actor_user_id,actor_name) values(v_id,v_existing,'link_existing',a.user_id,a.display_name);
  return crm_security.os_b2c_view(v_id)||jsonb_build_object('ok',true,'contract_version',1,'replayed',false,'duplicate_of',v_existing);
 end if;
 select * into o from crm_security.os_b2c_owner(p->>'assignee_name');
 -- CRM 상세 화면은 한글 칸 이름으로 읽는다(inquiry-workbench.js sourceFields). 같은 값을 그 이름으로도 넣는다.
 v_raw:=jsonb_strip_nulls(jsonb_build_object('source_system','os-b2c','os_b2c_id',v_id,'handoff_key',v_key,'message',btrim(p->>'message'),
  '문의내용',btrim(p->>'message'),'현장명',btrim(p->>'site_name'),'고객유형',nullif(p->>'customer_type',''),'건물유형',nullif(p->>'building_type',''),'단지개요',nullif(p->>'complex_info',''),
  '관리사무소',nullif(p->>'office_phone',''),'상담채널',nullif(p->>'consult_channel',''),'공사유형',nullif(btrim(p->>'work_type'),''),'유입경로',nullif(p->>'inflow_path',''),
  '전화응대자',nullif(p->>'responder',''),'전화 응대자',nullif(p->>'responder',''),'특이사항',nullif(p->>'memo',''),
  'os_consult_channel',p->>'consult_channel','os_received_at',p->>'received_at','os_owner',p->>'assignee_name','os_assigned_at',p->>'assigned_at',
  'os_dup_group',nullif(p->>'dup_group',''),'os_first_contact',p->'first_contact','office_phone',nullif(p->>'office_phone',''),'customer_type',nullif(p->>'customer_type',''),
  'building_type',nullif(p->>'building_type',''),'complex_info',nullif(p->>'complex_info',''),'inflow_path',nullif(p->>'inflow_path',''),'agent_name',nullif(p->>'agent_name',''),
  'responder',nullif(p->>'responder',''),'memo',nullif(p->>'memo',''),'os_source',nullif(p->>'source',''),'region',nullif(p->>'region',''),'address_raw',nullif(p->>'address_raw',''),'work_type_raw',nullif(p->>'work_type_raw',''),'os_actor_user_id',a.user_id,'os_actor_name',a.display_name));
 insert into public.inquiries(brand,site_name,contact_name,phone,address,work_type,status,received_at,created_at,updated_at,
  assigned_to,assigned_at,assignee_name,source_channel,source,channel,inquiry_type,business_type,raw)
 values(p->>'brand',btrim(p->>'site_name'),nullif(btrim(p->>'contact_name'),''),nullif(v_phone,''),nullif(btrim(p->>'address'),''),nullif(btrim(p->>'work_type'),''),
  case when o.user_id is null then '접수' else '배정완료' end,v_at,v_at,v_at,o.user_id,case when o.user_id is null then null else v_at end,o.name,
  coalesce(nullif(btrim(p->>'inflow_path'),''),'OS B2C 접수'),'OS B2C 접수',coalesce(nullif(btrim(p->>'consult_channel'),''),p->>'channel'),'견적문의','견적문의',v_raw)
 returning id into v_inquiry;
 insert into crm_security.os_b2c_links(os_b2c_id,inquiry_id,created_by_user_id,created_by_name) values(v_id,v_inquiry,a.user_id,a.display_name);
 insert into crm_security.os_b2c_link_events(os_b2c_id,inquiry_id,action,to_name,actor_user_id,actor_name) values(v_id,v_inquiry,'create',o.name,a.user_id,a.display_name);
 if o.user_id is not null then
  v_reason:='OS B2C 배정 · '||v_id||coalesce(' · 1차 연락 '||nullif(p->'first_contact'->>'method',''),'');
  perform crm_security.os_b2c_log_assignment(v_inquiry,'direct_assign','미배정',o.name,v_reason,
   jsonb_build_object('assigned_to',null,'assigned_at',null,'status','접수'),jsonb_build_object('assigned_to',o.user_id,'assigned_at',v_at,'status','배정완료'),v_at,a.auth_uid,a.user_id,a.display_name);
 end if;
 -- 담당을 못 잡았으면 화면에 알려서 CRM 에서 지정하게 한다.
 return crm_security.os_b2c_view(v_id)||jsonb_build_object('ok',true,'contract_version',1,'replayed',false,'owner_unmatched',o.user_id is null);
end $fn$;

create function public.crm_os_b2c_owner_change_v1(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare a record; o record; l crm_security.os_b2c_links%rowtype; i public.inquiries%rowtype; v_at timestamptz:=clock_timestamp();
begin
 select * into a from crm_security.os_b2c_actor();
 if not found then raise exception 'OS_B2C_FORBIDDEN' using errcode='42501'; end if;
 if p is null or jsonb_typeof(p)<>'object' or jsonb_typeof(p->'os_b2c_id') is distinct from 'string' or jsonb_typeof(p->'assignee_name') is distinct from 'string'
 then raise exception 'INVALID_PAYLOAD' using errcode='22023'; end if;
 select * into l from crm_security.os_b2c_links x where x.os_b2c_id=p->>'os_b2c_id';
 if not found then raise exception 'NOT_LINKED' using errcode='PT404'; end if;
 select * into i from public.inquiries x where x.id=l.inquiry_id for update;
 select * into o from crm_security.os_b2c_owner(p->>'assignee_name');
 if o.user_id is null then raise exception 'OWNER_NOT_FOUND' using errcode='22023'; end if;
 if i.assigned_to is not distinct from o.user_id then return crm_security.os_b2c_view(l.os_b2c_id)||jsonb_build_object('ok',true,'contract_version',1,'changed',false); end if;
 if coalesce(i.status,'') in ('종결','종료') or nullif(btrim(coalesce(i.close_reason,'')),'') is not null then raise exception 'INQUIRY_CLOSED' using errcode='PT409'; end if;
 -- CRM 에 원래 있던 문의의 담당과 영업건 담당은 CRM 에서 정한다.
 if l.matched_existing and i.assigned_to is not null then raise exception 'EXISTING_OWNER_IN_CRM' using errcode='PT409'; end if;
 if i.deal_id is not null or exists(select 1 from public.deals d where d.origin_inquiry_id=i.id) then raise exception 'DEAL_OWNER_IN_CRM' using errcode='PT409'; end if;
 update public.inquiries x set assigned_to=o.user_id,assignee_name=o.name,assigned_at=v_at,updated_at=v_at,
  status=case when i.assigned_to is null and (i.status is null or i.status in ('접수','신규') or i.status like '%영업배정 필요%') then '배정완료' else i.status end where x.id=i.id;
 perform crm_security.os_b2c_log_assignment(i.id,case when i.assigned_to is null then 'direct_assign' else 'direct_reassign' end,coalesce(nullif(btrim(coalesce(i.assignee_name,'')),''),'미배정'),o.name,'OS B2C 담당 변경 · '||l.os_b2c_id,
  jsonb_build_object('assigned_to',i.assigned_to,'assigned_at',i.assigned_at,'status',i.status),jsonb_build_object('assigned_to',o.user_id,'assigned_at',v_at),v_at,a.auth_uid,a.user_id,a.display_name);
 insert into crm_security.os_b2c_link_events(os_b2c_id,inquiry_id,action,from_name,to_name,actor_user_id,actor_name) values(l.os_b2c_id,i.id,'owner_change',i.assignee_name,o.name,a.user_id,a.display_name);
 return crm_security.os_b2c_view(l.os_b2c_id)||jsonb_build_object('ok',true,'contract_version',1,'changed',true);
end $fn$;

-- OS 에서 보낸(연결표에 있는) 건만 읽는다. 다른 CRM 문의는 접수번호로 찾을 수 없다.
create function public.crm_os_b2c_status_v1(p_ids jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $fn$
begin
 if not exists(select 1 from crm_security.os_b2c_actor()) then raise exception 'OS_B2C_FORBIDDEN' using errcode='42501'; end if;
 if p_ids is null or jsonb_typeof(p_ids)<>'array' or jsonb_array_length(p_ids)>50 then raise exception 'INVALID_IDS' using errcode='22023'; end if;
 return jsonb_build_object('ok',true,'contract_version',1,'server_at',clock_timestamp(),'items',coalesce((
  select jsonb_agg(crm_security.os_b2c_view(l.os_b2c_id)) from crm_security.os_b2c_links l
  where l.os_b2c_id in (select jsonb_array_elements_text(p_ids))),'[]'::jsonb));
end $fn$;

revoke all on function public.crm_os_b2c_capability_v1() from public,anon,authenticated,service_role;
revoke all on function public.crm_os_b2c_handoff_v1(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.crm_os_b2c_owner_change_v1(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.crm_os_b2c_status_v1(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.crm_os_b2c_capability_v1() to authenticated;
grant execute on function public.crm_os_b2c_handoff_v1(jsonb) to authenticated;
grant execute on function public.crm_os_b2c_owner_change_v1(jsonb) to authenticated;
grant execute on function public.crm_os_b2c_status_v1(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
