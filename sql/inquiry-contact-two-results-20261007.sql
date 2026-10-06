-- Inquiry contact records only. No inferred backfill, deal changes or notifications.
begin;
alter table crm_security.inquiry_contact_logs
 add column if not exists contact_result text,
 add column if not exists customer_reaction text;
alter table crm_security.inquiry_contact_logs drop constraint if exists inquiry_contact_two_results;
alter table crm_security.inquiry_contact_logs add constraint inquiry_contact_two_results check (
 (contact_result is null and customer_reaction is null) or
 (contact_result is not null and contact_result in ('연결됨','고객 회신','부재','번호오류')
  and (customer_reaction is null or (contact_result in ('연결됨','고객 회신') and customer_reaction in ('검토중','자료요청','견적요청','보류','거절')))
  and result is not distinct from coalesce(customer_reaction,contact_result))
);
CREATE OR REPLACE FUNCTION public.crm_inquiry_command_v1(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 a record; q public.inquiries%rowtype; nq public.inquiries%rowtype; s crm_security.inquiry_flow_state%rowtype;
 v_type text; v_id uuid; v_rid uuid; v_at timestamptz:=clock_timestamp(); v_today date:=(clock_timestamp() at time zone 'Asia/Seoul')::date;
 v_contact text; v_reaction text;
 v_channel text; v_result text; v_kind text; v_content text; v_next text; v_due date; v_occ timestamptz;
 v_reason text; v_detail text; v_status text; v_label text; v_attempts integer;
 v_amount bigint; v_sent timestamptz; v_sent_day date; v_ver integer; v_method text; v_file text; v_change text; v_recipient jsonb;
 v_owner text; v_follow date; v_next_id uuid; v_cancelled jsonb:='[]'::jsonb;
 v_date date; v_time time; v_done boolean; v_stype text; v_field text; v_value text;
 v_log uuid; v_audit uuid; v_extra jsonb:='{}'::jsonb; v_draft boolean:=false; lv crm_security.inquiry_quote_versions%rowtype;
begin
 select * into a from crm_security.actor();
 if not found or a.permission_role not in ('admin','rep','consultation') then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 v_type:=coalesce(p->>'type','');
 if v_type not in ('contact_log','close','quote_send','visit','schedule_set','field_set') then raise exception 'invalid payload' using errcode='22023'; end if;
 begin v_id:=(p->>'inquiry_id')::uuid; exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 if v_id is null then raise exception 'invalid payload' using errcode='22023'; end if;
 select * into q from public.inquiries i where i.id=v_id for update;
 if not found then raise exception '문의를 찾을 수 없습니다' using errcode='22023'; end if;
 if a.permission_role<>'admin' and (q.assigned_to is null or q.assigned_to<>a.user_id) then
  raise exception '담당자 또는 관리자만 저장할 수 있습니다' using errcode='42501';
 end if;
 if coalesce(q.inquiry_type,'')='기술자문' or coalesce(q.brand,'')='기술자문' then raise exception '기술자문 문의는 기술자문 화면에서 처리합니다' using errcode='22023'; end if;
 -- Reuse existing inquiry visibility and recoverable-trash rules.
 if not crm_security.can_inquiry(v_id) then raise exception 'forbidden' using errcode='42501'; end if;
 if (select e.action from crm_security.inquiry_audit_events e where e.inquiry_id=v_id
     and e.action in ('inquiry_trash','inquiry_restore','inquiry_purge') order by e.created_at desc,e.event_id desc limit 1)
     in ('inquiry_trash','inquiry_purge') then raise exception '문의를 찾을 수 없습니다' using errcode='22023'; end if;
 if v_type in ('close','quote_send','visit','schedule_set') and
   (coalesce(q.status,'') in ('종결','종료','수주','실주','배드핏','연락두절','협약완료','해결완료','영업전환')
    or q.deal_id is not null or q.opportunity_id is not null or q.qualified_at is not null)
 then raise exception '이미 종결 또는 전환된 문의입니다' using errcode='22023'; end if;
 if v_type in ('close','quote_send','visit') and
   (coalesce(q.work_type,'') ~ '협약' or coalesce(q.raw->>'공사유형','') ~ '협약'
    or (coalesce(q.raw->>'문의내용','') !~ '협약(서)?[[:space:]]*(관련[[:space:]]*)?(문의|상담|요청)?[[:space:]]*(아님|아니|없음)'
    and coalesce(q.raw->>'문의내용','') ~ '협약(서)?[[:space:]]*(관련[[:space:]]*)?(문의|상담|요청|진행|체결)'))
 then raise exception '협약문의는 B2B 전용 처리로 완료해 주세요' using errcode='22023'; end if;
 insert into crm_security.inquiry_flow_state(inquiry_id) values(v_id) on conflict (inquiry_id) do nothing;
 select * into s from crm_security.inquiry_flow_state x where x.inquiry_id=v_id for update;

 if v_type='contact_log' then
  begin v_rid:=(p->>'request_id')::uuid; exception when others then raise exception 'invalid payload' using errcode='22023'; end;
  v_channel:=coalesce(nullif(btrim(coalesce(p->>'channel','')),''),'전화');
  v_result:=nullif(btrim(coalesce(p->>'result','')),'');
  v_contact:=nullif(btrim(coalesce(p->>'contact_result','')),'');
  v_reaction:=nullif(btrim(coalesce(p->>'customer_reaction','')),'');
  if (p ? 'contact_result' or p ? 'customer_reaction') then
   if v_contact is null or v_contact not in ('연결됨','고객 회신','부재','번호오류')
    or (v_reaction is not null and v_reaction not in ('검토중','자료요청','견적요청','보류','거절'))
    or (v_contact in ('부재','번호오류') and v_reaction is not null)
    or v_result is distinct from coalesce(v_reaction,v_contact) then
    raise exception 'invalid payload: contact results' using errcode='22023';
   end if;
  end if;
  v_kind:=crm_security.inquiry_contact_kind(v_result);
  v_content:=btrim(coalesce(p->>'content',''));
  v_next:=nullif(btrim(coalesce(p->>'next_action','')),'');
  if v_rid is null or v_kind is null or v_channel not in ('전화','카카오','문자','이메일','방문','기타') or length(v_content)>4000 or length(coalesce(v_next,''))>500 then
   raise exception 'invalid payload' using errcode='22023';
  end if;
  begin v_due:=nullif(p->>'next_check_date','')::date; exception when others then raise exception '날짜는 YYYY-MM-DD 형식이어야 합니다' using errcode='22023'; end;
  begin v_occ:=nullif(p->>'occurred_at','')::timestamptz; exception when others then v_occ:=null; end;
  if v_occ is null or v_occ>v_at+interval '5 minutes' or v_occ<v_at-interval '30 days' then v_occ:=v_at; end if;
  -- 같은 요청을 다시 보내면 한 번만 남긴다
  select l.id into v_log from crm_security.inquiry_contact_logs l where l.actor_auth_uid=a.auth_uid and l.request_id=v_rid;
  if found then
   if exists(select 1 from crm_security.inquiry_contact_logs l where l.id=v_log and
     (l.inquiry_id is distinct from v_id or l.channel is distinct from v_channel or l.result is distinct from v_result
      or l.contact_result is distinct from v_contact or l.customer_reaction is distinct from v_reaction
      or l.content is distinct from v_content or l.next_action is distinct from v_next or l.next_check_date is distinct from v_due))
   then raise exception 'REQUEST_ID_REUSE' using errcode='PT409'; end if;
   return jsonb_build_object('ok',true,'type',v_type,'replayed',true,'log_id',v_log,'state',crm_security.inquiry_flow_state_json(v_id),'server_at',v_at); end if;
  insert into crm_security.inquiry_contact_logs(inquiry_id,request_id,channel,result,contact_result,customer_reaction,kind,content,next_action,next_check_date,occurred_at,actor_auth_uid,actor_user_id,actor_name)
   values(v_id,v_rid,v_channel,v_result,v_contact,v_reaction,v_kind,v_content,v_next,v_due,v_occ,a.auth_uid,a.user_id,a.display_name) returning id into v_log;
  -- 최초 시도 · 최초 접촉 시각은 처음 한 번만 찍는다(변경 불가)
  if v_kind='attempt' then
   update crm_security.inquiry_flow_state x set first_attempt_at=coalesce(x.first_attempt_at,v_occ),attempt_count=x.attempt_count+1,
    last_attempt_at=greatest(coalesce(x.last_attempt_at,v_occ),v_occ),updated_at=v_at where x.inquiry_id=v_id;
  elsif v_kind='connected' then
   update crm_security.inquiry_flow_state x set first_connected_at=coalesce(x.first_connected_at,v_occ),connected_count=x.connected_count+1,
    last_connected_at=greatest(coalesce(x.last_connected_at,v_occ),v_occ),updated_at=v_at where x.inquiry_id=v_id;
  else
   update crm_security.inquiry_flow_state x set updated_at=v_at where x.inquiry_id=v_id;
  end if;
  insert into crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
   values(a.auth_uid,a.user_id,v_id,'flow_contact_log',jsonb_build_object('first_attempt_at',s.first_attempt_at,'first_connected_at',s.first_connected_at,'attempt_count',s.attempt_count),
    jsonb_build_object('log_id',v_log,'channel',v_channel,'result',v_result,'contact_result',v_contact,'customer_reaction',v_reaction,'kind',v_kind,'occurred_at',v_occ,'next_action',v_next,'next_check_date',v_due,'actor',a.display_name),v_result,v_at)
   returning event_id into v_audit;
  v_extra:=jsonb_build_object('log_id',v_log,'kind',v_kind);

 elsif v_type='close' then
  v_kind:=coalesce(p->>'kind','');
  v_reason:=nullif(btrim(coalesce(p->>'reason','')),'');
  v_detail:=nullif(btrim(coalesce(p->>'detail','')),'');
  if v_kind not in ('bad_fit','unreachable','consult_end') or length(coalesce(v_detail,''))>2000 then raise exception 'invalid payload' using errcode='22023'; end if;
  if coalesce(q.status,'') in ('종결','종료','수주','실주','배드핏','연락두절') then raise exception '이미 종결된 문의입니다' using errcode='22023'; end if;
  if q.deal_id is not null or q.opportunity_id is not null then raise exception '영업건으로 전환된 문의는 영업건에서 처리합니다' using errcode='22023'; end if;
  if v_kind='bad_fit' then
   if v_reason is null or length(v_reason)>60 then raise exception 'Bad Fit 사유를 골라 주세요' using errcode='22023'; end if;
   if v_reason='기타' and v_detail is null then raise exception '기타 사유를 적어 주세요' using errcode='22023'; end if;
   v_status:='배드핏'; v_label:='Bad Fit';
  elsif v_kind='unreachable' then
   -- 시도 횟수는 자동: 서버에 남은 시도 수와 화면이 센 수(이 함수가 생기기 전 기록 포함) 중 큰 값
   begin v_attempts:=coalesce(nullif(p->>'attempts','')::integer,0); exception when others then v_attempts:=0; end;
   v_attempts:=greatest(s.attempt_count,least(greatest(v_attempts,0),99));
   if s.first_connected_at is not null then raise exception '이미 접촉한 문의입니다 — 상담종결로 처리해 주세요' using errcode='22023'; end if;
   if v_attempts<1 then raise exception '연락 시도 기록이 없습니다' using errcode='22023'; end if;
   v_reason:='시도 '||v_attempts||'회'; v_status:='연락두절'; v_label:='연락두절';
  else
   if v_reason is null or v_reason not in ('계획 없음','단순 문의','타사 선택') then raise exception '상담종결 사유를 골라 주세요' using errcode='22023'; end if;
   v_status:='종결'; v_label:='상담종결';
  end if;
  select coalesce(jsonb_agg(n.id order by n.created_at,n.id),'[]'::jsonb) into v_cancelled from public.next_actions n where n.inquiry_id=v_id and n.status='open';
  update public.next_actions n set status='cancelled',updated_at=v_at where n.inquiry_id=v_id and n.status='open';
  update public.inquiries i set status=v_status,close_reason=v_label||' · '||v_reason||coalesce(' — '||v_detail,''),next_action_date=null,updated_at=v_at
   where i.id=v_id returning * into nq;
  update crm_security.inquiry_flow_state x set close_kind=v_kind,close_reason=v_reason,close_detail=v_detail,closed_at=v_at,closed_by_user_id=a.user_id,closed_by_name=a.display_name,
   prev_status=q.status,updated_at=v_at where x.inquiry_id=v_id;
  insert into crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
   values(a.auth_uid,a.user_id,v_id,'flow_close',to_jsonb(q),to_jsonb(nq)||jsonb_build_object('close_kind',v_kind,'cancelled_action_ids',v_cancelled,'actor',a.display_name),v_label||' · '||v_reason,v_at)
   returning event_id into v_audit;
  v_extra:=jsonb_build_object('status',nq.status,'close_reason',nq.close_reason,'close_kind',v_kind,'cancelled_action_ids',v_cancelled);

 elsif v_type='quote_send' then
  begin v_rid:=nullif(p->>'request_id','')::uuid; exception when others then raise exception 'invalid payload' using errcode='22023'; end;
  begin v_amount:=nullif(p->>'amount','')::bigint; exception when others then raise exception '금액은 원 단위 숫자여야 합니다' using errcode='22023'; end;
  begin v_sent:=nullif(p->>'sent_at','')::timestamptz; exception when others then raise exception '보낸 날이 올바르지 않습니다' using errcode='22023'; end;
  v_sent:=coalesce(v_sent,v_at);
  v_draft:=coalesce((p->>'draft')='true',false);
  v_method:=nullif(btrim(coalesce(p->>'method','')),''); v_file:=nullif(btrim(coalesce(p->>'file_name','')),''); v_change:=nullif(btrim(coalesce(p->>'change_reason','')),'');
  v_recipient:=case when jsonb_typeof(p->'recipient')='object' then p->'recipient' else null end;
  if v_amount is null or v_amount<=0 or v_amount>1000000000000 or v_sent>v_at+interval '1 day' or v_sent<v_at-interval '366 days'
   or length(coalesce(v_method,''))>40 or length(coalesce(v_file,''))>300 or length(coalesce(v_change,''))>500 or length(coalesce(v_recipient::text,''))>1000 then
   raise exception 'invalid payload' using errcode='22023';
  end if;
  if v_rid is not null then
   select v.version_no into v_ver from crm_security.inquiry_quote_versions v where v.inquiry_id=v_id and v.request_id=v_rid;
   if found then return jsonb_build_object('ok',true,'type',v_type,'replayed',true,'version_no',v_ver,'state',crm_security.inquiry_flow_state_json(v_id),'server_at',v_at); end if;
  end if;
  -- 아직 안 보낸 초안이 마지막 버전이면 그 버전을 고쳐 쓴다(보낼 때 보낸 날을 찍는다). 아니면 새 버전
  select * into lv from crm_security.inquiry_quote_versions v where v.inquiry_id=v_id order by v.version_no desc limit 1;
  if found and lv.sent_at is null then
   v_ver:=lv.version_no;
   update crm_security.inquiry_quote_versions v set amount=v_amount,sent_at=case when v_draft then null else v_sent end,recipient=coalesce(v_recipient,v.recipient),method=coalesce(v_method,v.method),
    file_name=coalesce(v_file,v.file_name),change_reason=coalesce(v_change,v.change_reason),author_user_id=a.user_id,author_name=a.display_name,actor_auth_uid=a.auth_uid,request_id=v_rid where v.id=lv.id;
  else
   v_ver:=coalesce(lv.version_no,0)+1;
   insert into crm_security.inquiry_quote_versions(inquiry_id,version_no,amount,sent_at,recipient,method,file_name,change_reason,author_user_id,author_name,actor_auth_uid,request_id)
    values(v_id,v_ver,v_amount,case when v_draft then null else v_sent end,v_recipient,v_method,v_file,v_change,a.user_id,a.display_name,a.auth_uid,v_rid);
  end if;
  if not v_draft then
   update crm_security.inquiry_flow_state x set quote_sent_at=coalesce(x.quote_sent_at,v_sent),
    qualified_at=coalesce(x.qualified_at,v_sent),qualified_by=coalesce(x.qualified_by,'quote_sent'),updated_at=v_at where x.inquiry_id=v_id;
  else
   update crm_security.inquiry_flow_state x set updated_at=v_at where x.inquiry_id=v_id;
  end if;
  -- 후속 할 일 자동: 보낸 날 + 7일 '고객 반응 확인' (같은 날 할 일은 만들지 않는다). 보냈을 때만 · 담당자가 있고 아직 종결 · 전환 전일 때만
  v_sent_day:=(v_sent at time zone 'Asia/Seoul')::date; v_follow:=greatest(v_sent_day+7,v_today+1);
  select u.name into v_owner from public.users u where u.user_id=q.assigned_to;
  if not v_draft and v_owner is not null and coalesce(q.status,'') not in ('종결','종료','수주','실주','배드핏','연락두절') and q.deal_id is null and q.opportunity_id is null then
   select coalesce(jsonb_agg(n.id order by n.created_at,n.id),'[]'::jsonb) into v_cancelled from public.next_actions n where n.inquiry_id=v_id and n.status='open';
   update public.next_actions n set status='cancelled',updated_at=v_at where n.inquiry_id=v_id and n.status='open';
   insert into public.next_actions(inquiry_id,action_type,title,due_at,assignee_name,status,created_at,updated_at)
    values(v_id,'전화','고객 반응 확인',v_follow::timestamp at time zone 'Asia/Seoul',v_owner,'open',v_at,v_at) returning id into v_next_id;
   update public.inquiries i set next_action_date=v_follow,updated_at=v_at where i.id=v_id;
   insert into crm_security.schedules(type,at,inquiry_id,owner_user_id,owner_name,title,created_by_user_id,created_by_name)
    values('quote_followup',v_follow,v_id,q.assigned_to,v_owner,'고객 반응 확인',a.user_id,a.display_name)
    on conflict (inquiry_id,type) where status='open' and inquiry_id is not null do update set at=excluded.at,owner_user_id=excluded.owner_user_id,owner_name=excluded.owner_name,updated_at=v_at;
  end if;
  insert into crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
   values(a.auth_uid,a.user_id,v_id,case when v_draft then 'flow_quote_draft' else 'flow_quote_send' end,jsonb_build_object('next_action_date',q.next_action_date,'cancelled_action_ids',v_cancelled,'quote_sent_at',s.quote_sent_at),
    jsonb_build_object('version_no',v_ver,'amount',v_amount,'sent_at',case when v_draft then null else v_sent end,'method',v_method,'file_name',v_file,'change_reason',v_change,'next_action_id',v_next_id,'next_action_date',case when v_next_id is not null then v_follow end,'actor',a.display_name),
    '견적 v'||v_ver||case when v_draft then ' 초안' else ' 발송' end,v_at) returning event_id into v_audit;
  v_extra:=jsonb_build_object('version_no',v_ver,'draft',v_draft,'next_action_id',v_next_id,'next_action_date',case when v_next_id is not null then v_follow end,'next_action_text',case when v_next_id is not null then '고객 반응 확인' end,'cancelled_action_ids',v_cancelled);

 elsif v_type='visit' then
  begin v_date:=nullif(p->>'date','')::date; exception when others then raise exception '날짜는 YYYY-MM-DD 형식이어야 합니다' using errcode='22023'; end;
  begin v_time:=nullif(p->>'time','')::time; exception when others then v_time:=null; end;
  v_done:=coalesce((p->>'done')='true',false);
  if v_date is null or v_date<v_today-366 or v_date>v_today+3650 or (v_done and v_date>v_today) then raise exception '방문 날짜를 확인해 주세요' using errcode='22023'; end if;
  select u.name into v_owner from public.users u where u.user_id=q.assigned_to;
  if v_done then
   update crm_security.schedules c set status='done',at=v_date,at_time=coalesce(v_time,c.at_time),updated_at=v_at where c.inquiry_id=v_id and c.type='visit' and c.status='open';
   if not found then
    insert into crm_security.schedules(type,at,at_time,inquiry_id,owner_user_id,owner_name,title,status,created_by_user_id,created_by_name)
     values('visit',v_date,v_time,v_id,q.assigned_to,v_owner,'1차 현장방문','done',a.user_id,a.display_name);
   end if;
   update crm_security.inquiry_flow_state x set visit_done_at=coalesce(x.visit_done_at,(v_date::timestamp+coalesce(v_time,time '12:00')) at time zone 'Asia/Seoul'),
    qualified_at=coalesce(x.qualified_at,(v_date::timestamp+coalesce(v_time,time '12:00')) at time zone 'Asia/Seoul'),qualified_by=coalesce(x.qualified_by,'visit_done'),updated_at=v_at where x.inquiry_id=v_id;
  else
   insert into crm_security.schedules(type,at,at_time,inquiry_id,owner_user_id,owner_name,title,created_by_user_id,created_by_name)
    values('visit',v_date,v_time,v_id,q.assigned_to,v_owner,'1차 현장방문',a.user_id,a.display_name)
    on conflict (inquiry_id,type) where status='open' and inquiry_id is not null do update set at=excluded.at,at_time=excluded.at_time,owner_user_id=excluded.owner_user_id,owner_name=excluded.owner_name,updated_at=v_at;
   update crm_security.inquiry_flow_state x set updated_at=v_at where x.inquiry_id=v_id;
  end if;
  insert into crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
   values(a.auth_uid,a.user_id,v_id,'flow_visit',jsonb_build_object('visit_done_at',s.visit_done_at,'qualified_at',s.qualified_at),
    jsonb_build_object('date',v_date,'time',v_time,'done',v_done,'actor',a.display_name),case when v_done then '1차 현장방문 완료' else '1차 현장방문 일정' end,v_at) returning event_id into v_audit;

 elsif v_type='schedule_set' then
  v_stype:=coalesce(p->>'schedule_type','');
  begin v_date:=nullif(p->>'at','')::date; exception when others then raise exception '날짜는 YYYY-MM-DD 형식이어야 합니다' using errcode='22023'; end;
  if v_stype not in ('meeting','reply_due') or v_date is null or v_date<v_today-366 or v_date>v_today+3650 then raise exception 'invalid payload' using errcode='22023'; end if;
  select u.name into v_owner from public.users u where u.user_id=q.assigned_to;
  insert into crm_security.schedules(type,at,inquiry_id,owner_user_id,owner_name,title,created_by_user_id,created_by_name)
   values(v_stype,v_date,v_id,q.assigned_to,v_owner,case v_stype when 'meeting' then '대표회의' else '자료 회신 기한' end,a.user_id,a.display_name)
   on conflict (inquiry_id,type) where status='open' and inquiry_id is not null do update set at=excluded.at,owner_user_id=excluded.owner_user_id,owner_name=excluded.owner_name,updated_at=v_at;
  if v_stype='meeting' then update crm_security.inquiry_flow_state x set meeting_date=v_date,updated_at=v_at where x.inquiry_id=v_id;
  else update crm_security.inquiry_flow_state x set reply_due=v_date,updated_at=v_at where x.inquiry_id=v_id; end if;
  insert into crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
   values(a.auth_uid,a.user_id,v_id,'flow_schedule_set',jsonb_build_object('meeting_date',s.meeting_date,'reply_due',s.reply_due),
    jsonb_build_object('schedule_type',v_stype,'at',v_date,'actor',a.display_name),case v_stype when 'meeting' then '대표회의 일정' else '자료 회신 기한' end,v_at) returning event_id into v_audit;

 else
  v_field:=coalesce(p->>'field',''); v_value:=nullif(btrim(coalesce(p->>'value','')),'');
  if v_field<>'phone_handler' or v_value is null or length(v_value)>60 then raise exception 'invalid payload' using errcode='22023'; end if;
  update crm_security.inquiry_flow_state x set phone_handler=v_value,updated_at=v_at where x.inquiry_id=v_id;
  insert into crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
   values(a.auth_uid,a.user_id,v_id,'flow_field_set',jsonb_build_object('phone_handler',s.phone_handler),jsonb_build_object('field',v_field,'value',v_value,'actor',a.display_name),'전화 응대자',v_at)
   returning event_id into v_audit;
 end if;
 return jsonb_build_object('ok',true,'type',v_type,'inquiry_id',v_id,'state',crm_security.inquiry_flow_state_json(v_id),'inquiry_audit_event_id',v_audit,'actor_name',a.display_name,'server_at',v_at)||v_extra;
end $function$;
CREATE OR REPLACE FUNCTION crm_security.inquiry_flow_state_json(p_inquiry_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select jsonb_build_object('inquiry_id',s.inquiry_id,'first_attempt_at',s.first_attempt_at,'first_connected_at',s.first_connected_at,
  'attempt_count',s.attempt_count,'connected_count',s.connected_count,'last_attempt_at',s.last_attempt_at,'last_connected_at',s.last_connected_at,
  'close_kind',s.close_kind,'close_reason',s.close_reason,'close_detail',s.close_detail,'closed_at',s.closed_at,'closed_by_name',s.closed_by_name,'prev_status',s.prev_status,
  'phone_handler',s.phone_handler,'visit_done_at',s.visit_done_at,'quote_sent_at',s.quote_sent_at,'qualified_at',s.qualified_at,'qualified_by',s.qualified_by,
  'meeting_date',s.meeting_date,'reply_due',s.reply_due,'migrated',s.migrated,'updated_at',s.updated_at,
  'logs',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'request_id',l.request_id,'channel',l.channel,'result',l.result,'contact_result',l.contact_result,'customer_reaction',l.customer_reaction,'kind',l.kind,'content',l.content,
     'next_action',l.next_action,'next_check_date',l.next_check_date,'occurred_at',l.occurred_at,'actor_name',l.actor_name) order by l.occurred_at,l.created_at)
    from crm_security.inquiry_contact_logs l where l.inquiry_id=s.inquiry_id),'[]'::jsonb),
  'quotes',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'version_no',v.version_no,'amount',v.amount,'sent_at',v.sent_at,'recipient',v.recipient,'method',v.method,
     'file_name',v.file_name,'change_reason',v.change_reason,'author_name',v.author_name,'source',v.source,'created_at',v.created_at) order by v.version_no)
    from crm_security.inquiry_quote_versions v where v.inquiry_id=s.inquiry_id),'[]'::jsonb),
  'schedules',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'type',c.type,'at',c.at,'at_time',c.at_time,'owner_name',c.owner_name,'title',c.title,'status',c.status,'updated_at',c.updated_at) order by c.at,c.created_at)
    from crm_security.schedules c where c.inquiry_id=s.inquiry_id and c.status<>'cancelled'),'[]'::jsonb))
 from crm_security.inquiry_flow_state s where s.inquiry_id=p_inquiry_id
$function$;
-- Existing reviewed function grants and table RLS remain unchanged.
notify pgrst, 'reload schema';
commit;
