-- 견적문의 흐름 v1 (2026-10-05 대표 핸드오프 design_handoff_inquiry_flow · P0 1~7)
-- 견적문의 → 실제 접촉 → 적합 판단 → 견적 → 파이프라인 전환이 한 흐름으로 이어지도록, 화면이 부르는 저장 명령을 하나(crm_inquiry_command_v1)로 둔다.
--   · contact_log  응대 기록 한 줄. 결과가 시도(부재 · 통화불가 · 번호오류)면 first_attempt_at, 접촉(연결됨 · 고객 회신 · 검토중 · 자료요청 · 견적요청)이면 first_connected_at 을
--                  처음 한 번만 찍는다(그 뒤로 바뀌지 않는다). 최초응대 완료 = first_connected_at 이 있는 것.
--   · close        종결 3종(Bad Fit · 연락두절 · 상담종결) — 사유 필수, 고르는 즉시 종결(열린 다음 할 일은 취소). 스토어 이관 · B2B 협약은 기존 전용 명령이 처리한다.
--                  Bad Fit 사유 목록은 운영 기준(설정 화면의 'Bad Fit 사유')이 정한다 — 화면이 그 목록에서 고른 값을 그대로 적는다. 상담종결 사유는 계획 없음 · 단순 문의 · 타사 선택.
--   · quote_send   견적 = 버전(version · 금액(원) · 보낸 날 · 받는 사람 · 방법 · 파일 · 바꾼 이유 · 작성자). 보내면 후속 할 일이 '보낸 날 + 7일 · 고객 반응 확인'으로 잡힌다(같은 날 할 일은 만들지 않는다).
--                  draft=true 면 아직 안 보낸 금액(초안)만 적어 둔다 — 전환 기준 · 후속 할 일은 보낼 때 생긴다. 초안이 있으면 보낼 때 그 버전에 보낸 날을 찍는다.
--   · visit        1차 현장방문 일정 / 완료. 전환 기준 = 1차 현장방문 완료 또는 견적 발송 완료 중 먼저 일어난 것(qualified_at · qualified_by).
--   · schedule_set 대표회의(meeting) · 자료 회신 기한(reply_due)을 따로 저장(일정 표 crm_security.schedules).
--   · field_set    phone_handler(전화 응대자) — 시트 열 이름과 화면 저장 이름이 달라 새로 고치면 사라지던 값을 한 칸으로.
-- 쓰는 것: 새 곁표 4개(crm_security.inquiry_flow_state · inquiry_contact_logs · inquiry_quote_versions · schedules) + 감사 기록(inquiry_audit_events).
--          public.inquiries 는 close(상태 · 종결 사유 · 다음 할 일 날짜) · quote_send(다음 할 일 날짜) 때만, public.next_actions 는 close(취소) · quote_send(후속 한 건) 때만 건드린다.
--          기존 first_response_at · 응대 이력 · 영업건 · 계약 원장은 바꾸지 않는다.
-- 권한: 관리자 또는 그 문의의 담당자(영업 · 상담). 읽기(crm_inquiry_flow_list_v1)는 관리자 = 전체, 그 밖 = 본인 담당 문의.
-- 맨 아래 '이관'은 여러 번 돌려도 같은 결과(이미 옮긴 문의는 건너뜀). 배드핏 재분류는 여기서 하지 않는다(목록만 따로 — 관리자 확인 뒤 적용).
-- 끝의 '전환 조건' 한 줄 바꾸기: 기존 파이프라인 전환 명령이 '견적 … 발송' 상태만 받던 것을 '현장방문 완료'도 받게 한다(④ 전환 기준 = 1차 현장방문 완료 또는 견적 발송 완료).
--   지금 운영에 설치된 함수 본문을 읽어 그 조건 한 곳만 바꿔 다시 만든다. 바꿀 자리가 정확히 1곳이 아니면 아무것도 바꾸지 않고 멈춘다. 이미 바뀌어 있으면 건너뛴다.

create table if not exists crm_security.inquiry_flow_state(
 inquiry_id uuid primary key references public.inquiries(id) on delete cascade,
 first_attempt_at timestamptz,
 first_connected_at timestamptz,
 attempt_count integer not null default 0,
 connected_count integer not null default 0,
 last_attempt_at timestamptz,
 last_connected_at timestamptz,
 close_kind text check(close_kind is null or close_kind in ('bad_fit','unreachable','consult_end')),
 close_reason text,
 close_detail text,
 closed_at timestamptz,
 closed_by_user_id uuid,
 closed_by_name text,
 prev_status text,
 phone_handler text,
 visit_done_at timestamptz,
 quote_sent_at timestamptz,
 qualified_at timestamptz,
 qualified_by text check(qualified_by is null or qualified_by in ('visit_done','quote_sent')),
 meeting_date date,
 reply_due date,
 migrated text check(migrated is null or migrated in ('attempt','connected')),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp()
);
create table if not exists crm_security.inquiry_contact_logs(
 id uuid primary key default gen_random_uuid(),
 inquiry_id uuid not null references public.inquiries(id) on delete cascade,
 request_id uuid not null,
 channel text not null check(channel in ('전화','카카오','문자','이메일','방문','기타')),
 result text not null,
 kind text not null check(kind in ('attempt','connected','wait')),
 content text not null default '',
 next_action text,
 next_check_date date,
 occurred_at timestamptz not null,
 actor_auth_uid uuid not null,
 actor_user_id uuid not null,
 actor_name text not null,
 created_at timestamptz not null default clock_timestamp(),
 unique(actor_auth_uid,request_id)
);
create index if not exists inquiry_contact_logs_inquiry_at on crm_security.inquiry_contact_logs(inquiry_id,occurred_at);
create table if not exists crm_security.inquiry_quote_versions(
 id uuid primary key default gen_random_uuid(),
 inquiry_id uuid not null references public.inquiries(id) on delete cascade,
 version_no integer not null check(version_no>=1),
 amount bigint not null check(amount>0),
 sent_at timestamptz,
 recipient jsonb,
 method text,
 file_name text,
 change_reason text,
 author_user_id uuid,
 author_name text not null,
 actor_auth_uid uuid,
 request_id uuid,
 source text not null default 'crm' check(source in ('crm','migrated')),
 created_at timestamptz not null default clock_timestamp(),
 unique(inquiry_id,version_no)
);
create table if not exists crm_security.schedules(
 id uuid primary key default gen_random_uuid(),
 type text not null check(type in ('meeting','reply_due','visit','quote_followup')),
 at date not null,
 at_time time,
 inquiry_id uuid references public.inquiries(id) on delete cascade,
 deal_id uuid references public.deals(id) on delete cascade,
 owner_user_id uuid,
 owner_name text,
 title text,
 status text not null default 'open' check(status in ('open','done','cancelled')),
 created_by_user_id uuid,
 created_by_name text not null,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 check(inquiry_id is not null or deal_id is not null)
);
create unique index if not exists schedules_inquiry_type_open on crm_security.schedules(inquiry_id,type) where status='open' and inquiry_id is not null;
alter table crm_security.inquiry_flow_state enable row level security;
alter table crm_security.inquiry_contact_logs enable row level security;
alter table crm_security.inquiry_quote_versions enable row level security;
alter table crm_security.schedules enable row level security;
revoke all on crm_security.inquiry_flow_state, crm_security.inquiry_contact_logs, crm_security.inquiry_quote_versions, crm_security.schedules from public, anon, authenticated;

-- 결과 → 종류(시도 · 접촉 · 대기). 화면(inquiry-flow.js)의 결과 마스터와 같은 목록. 마스터 밖의 예전 값: 회신대기 = 보냈지만 답이 없는 것(접촉 아님 · 시도 횟수에도 안 넣음), 그 밖 = 대화가 있었던 것
create or replace function crm_security.inquiry_contact_kind(p_result text)
returns text language sql immutable set search_path='' as $fn$
 select case
  when p_result in ('부재','통화불가','번호오류') then 'attempt'
  when p_result in ('연결됨','고객 회신','검토중','자료요청','견적요청') then 'connected'
  when p_result in ('회신대기') then 'wait'
  when p_result in ('보류','거절','연락 완료','대표회의 예정','재견적 요청','경쟁사 비교','계약 검토') then 'connected'
  else null end
$fn$;

create or replace function crm_security.inquiry_flow_state_json(p_inquiry_id uuid)
returns jsonb language sql stable set search_path='' as $fn$
 select jsonb_build_object('inquiry_id',s.inquiry_id,'first_attempt_at',s.first_attempt_at,'first_connected_at',s.first_connected_at,
  'attempt_count',s.attempt_count,'connected_count',s.connected_count,'last_attempt_at',s.last_attempt_at,'last_connected_at',s.last_connected_at,
  'close_kind',s.close_kind,'close_reason',s.close_reason,'close_detail',s.close_detail,'closed_at',s.closed_at,'closed_by_name',s.closed_by_name,'prev_status',s.prev_status,
  'phone_handler',s.phone_handler,'visit_done_at',s.visit_done_at,'quote_sent_at',s.quote_sent_at,'qualified_at',s.qualified_at,'qualified_by',s.qualified_by,
  'meeting_date',s.meeting_date,'reply_due',s.reply_due,'migrated',s.migrated,'updated_at',s.updated_at,
  'logs',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'request_id',l.request_id,'channel',l.channel,'result',l.result,'kind',l.kind,'content',l.content,
     'next_action',l.next_action,'next_check_date',l.next_check_date,'occurred_at',l.occurred_at,'actor_name',l.actor_name) order by l.occurred_at,l.created_at)
    from crm_security.inquiry_contact_logs l where l.inquiry_id=s.inquiry_id),'[]'::jsonb),
  'quotes',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'version_no',v.version_no,'amount',v.amount,'sent_at',v.sent_at,'recipient',v.recipient,'method',v.method,
     'file_name',v.file_name,'change_reason',v.change_reason,'author_name',v.author_name,'source',v.source,'created_at',v.created_at) order by v.version_no)
    from crm_security.inquiry_quote_versions v where v.inquiry_id=s.inquiry_id),'[]'::jsonb),
  'schedules',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'type',c.type,'at',c.at,'at_time',c.at_time,'owner_name',c.owner_name,'title',c.title,'status',c.status,'updated_at',c.updated_at) order by c.at,c.created_at)
    from crm_security.schedules c where c.inquiry_id=s.inquiry_id and c.status<>'cancelled'),'[]'::jsonb))
 from crm_security.inquiry_flow_state s where s.inquiry_id=p_inquiry_id
$fn$;
revoke all on function crm_security.inquiry_contact_kind(text) from public, anon, authenticated;
revoke all on function crm_security.inquiry_flow_state_json(uuid) from public, anon, authenticated;

create or replace function public.crm_inquiry_command_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 a record; q public.inquiries%rowtype; nq public.inquiries%rowtype; s crm_security.inquiry_flow_state%rowtype;
 v_type text; v_id uuid; v_rid uuid; v_at timestamptz:=clock_timestamp(); v_today date:=(clock_timestamp() at time zone 'Asia/Seoul')::date;
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
 insert into crm_security.inquiry_flow_state(inquiry_id) values(v_id) on conflict (inquiry_id) do nothing;
 select * into s from crm_security.inquiry_flow_state x where x.inquiry_id=v_id for update;

 if v_type='contact_log' then
  begin v_rid:=(p->>'request_id')::uuid; exception when others then raise exception 'invalid payload' using errcode='22023'; end;
  v_channel:=coalesce(nullif(btrim(coalesce(p->>'channel','')),''),'전화');
  v_result:=nullif(btrim(coalesce(p->>'result','')),'');
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
  if found then return jsonb_build_object('ok',true,'type',v_type,'replayed',true,'log_id',v_log,'state',crm_security.inquiry_flow_state_json(v_id),'server_at',v_at); end if;
  insert into crm_security.inquiry_contact_logs(inquiry_id,request_id,channel,result,kind,content,next_action,next_check_date,occurred_at,actor_auth_uid,actor_user_id,actor_name)
   values(v_id,v_rid,v_channel,v_result,v_kind,v_content,v_next,v_due,v_occ,a.auth_uid,a.user_id,a.display_name) returning id into v_log;
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
    jsonb_build_object('log_id',v_log,'channel',v_channel,'result',v_result,'kind',v_kind,'occurred_at',v_occ,'next_action',v_next,'next_check_date',v_due,'actor',a.display_name),v_result,v_at)
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
end $fn$;
revoke all on function public.crm_inquiry_command_v1(jsonb) from public, anon;
grant execute on function public.crm_inquiry_command_v1(jsonb) to authenticated;

-- 읽기: 관리자는 전체, 그 밖은 본인 담당 문의. 값이 있는 문의만 내려 준다.
-- closed = 종결 사유 글이 적혀 있는 문의의 사유(화면의 기본 읽기는 이 칸을 내려 주지 않아 닫힌 문의가 모두 '사유 미기록'으로 보였다 — 읽기만 한다)
create or replace function public.crm_inquiry_flow_list_v1(p jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare a record;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 return jsonb_build_object('ok',true,'server_at',clock_timestamp(),'states',coalesce((
  select jsonb_agg(crm_security.inquiry_flow_state_json(s.inquiry_id))
  from crm_security.inquiry_flow_state s join public.inquiries i on i.id=s.inquiry_id
  where a.permission_role='admin' or i.assigned_to=a.user_id or crm_security.can_inquiry(i.id)),'[]'::jsonb),
  'closed',coalesce((
  select jsonb_agg(jsonb_build_object('inquiry_id',i.id,'status',i.status,'close_reason',i.close_reason))
  from public.inquiries i
  where nullif(btrim(coalesce(i.close_reason,'')),'') is not null
   and (a.permission_role='admin' or i.assigned_to=a.user_id or crm_security.can_inquiry(i.id))),'[]'::jsonb));
end $fn$;
revoke all on function public.crm_inquiry_flow_list_v1(jsonb) from public, anon;
grant execute on function public.crm_inquiry_flow_list_v1(jsonb) to authenticated;

-- ── 이관(여러 번 돌려도 같은 결과) ──
-- ① 예전 최초응대 시각(first_response_at · responded_at) → 시도 / 접촉으로 나눠 옮긴다. 응대내용이 부재류뿐이면 시도(first_attempt_at), 그 밖(근거가 없는 것 포함)은 접촉(first_connected_at) 그대로.
--    원래 값(public.inquiries.first_response_at)은 지우지 않는다. 이미 옮긴 문의(migrated 가 있는 줄)는 건너뛴다.
with src as (
 select i.id,coalesce(i.first_response_at,i.responded_at) at,btrim(coalesce(i.raw->>'응대내용','')) t,
  -- CRM 에서 첫 응대를 저장하며 남긴 결과 줄("[전화 · 부재] …")이 있으면 그것이 가장 확실한 근거
  coalesce((select coalesce(e.after_data->>'result',e.reason,'') from crm_security.inquiry_audit_events e
    where e.inquiry_id=i.id and e.action='inquiry_response_progress' order by e.created_at limit 1),'') r
 from public.inquiries i where coalesce(i.first_response_at,i.responded_at) is not null
), cls as (
 select id,at,case
   when r ~ '^\[[^\]]* · (부재|통화불가|번호오류)\]' then 'attempt'
   when r ~ '^\[[^\]]* · [^\]]+\]' then 'connected'
   when t ~ '부재|안 ?받|받지 ?않|통화 ?불가|연결 ?안 ?(됨|되)|번호 ?오류|없는 ?번호|결번'
   and t !~ '통화 ?(함|완료|했|하였|됨|후)|상담|안내|설명|요청|방문|견적|검토|회신 ?(받|옴|함)|연결됨|예정|보내|발송|전달|확인' then 'attempt' else 'connected' end k from src
)
insert into crm_security.inquiry_flow_state as t(inquiry_id,first_attempt_at,first_connected_at,attempt_count,connected_count,last_attempt_at,last_connected_at,migrated)
select id,case when k='attempt' then at end,case when k='connected' then at end,case when k='attempt' then 1 else 0 end,case when k='connected' then 1 else 0 end,
 case when k='attempt' then at end,case when k='connected' then at end,k from cls
on conflict (inquiry_id) do update set
 first_attempt_at=coalesce(t.first_attempt_at,excluded.first_attempt_at),
 first_connected_at=coalesce(t.first_connected_at,excluded.first_connected_at),
 attempt_count=greatest(t.attempt_count,excluded.attempt_count),
 connected_count=greatest(t.connected_count,excluded.connected_count),
 last_attempt_at=coalesce(t.last_attempt_at,excluded.last_attempt_at),
 last_connected_at=coalesce(t.last_connected_at,excluded.last_connected_at),
 migrated=excluded.migrated,updated_at=clock_timestamp()
where t.migrated is null;

-- ⑦ 화면이 띄어 쓴 이름('전화 응대자')으로 저장해 둔 값 → phone_handler. 시트 열('전화응대자')은 그대로 두고 화면이 읽는다
insert into crm_security.inquiry_flow_state as t(inquiry_id,phone_handler)
select i.id,btrim(i.raw->>'전화 응대자') from public.inquiries i
where jsonb_typeof(i.raw)='object' and btrim(coalesce(i.raw->>'전화 응대자','')) not in ('','-')
on conflict (inquiry_id) do update set phone_handler=excluded.phone_handler,updated_at=clock_timestamp()
where t.phone_handler is null;

-- ⑥ 문의 정보 칸에 적어 둔 대표회의 · 자료 회신 기한(YYYY-MM-DD) → 따로 저장 + 일정 표
insert into crm_security.inquiry_flow_state as t(inquiry_id,meeting_date,reply_due)
select i.id,
 case when coalesce(i.raw->>'대표회의',i.raw->>'대표회의 일정','') ~ '^\d{4}-\d{2}-\d{2}$' then coalesce(i.raw->>'대표회의',i.raw->>'대표회의 일정')::date end,
 case when coalesce(i.raw->>'자료 회신 기한','') ~ '^\d{4}-\d{2}-\d{2}$' then (i.raw->>'자료 회신 기한')::date end
from public.inquiries i
where jsonb_typeof(i.raw)='object' and (coalesce(i.raw->>'대표회의',i.raw->>'대표회의 일정','') ~ '^\d{4}-\d{2}-\d{2}$' or coalesce(i.raw->>'자료 회신 기한','') ~ '^\d{4}-\d{2}-\d{2}$')
on conflict (inquiry_id) do update set meeting_date=coalesce(t.meeting_date,excluded.meeting_date),
 reply_due=coalesce(t.reply_due,excluded.reply_due),updated_at=clock_timestamp()
where t.meeting_date is null or t.reply_due is null;
insert into crm_security.schedules(type,at,inquiry_id,owner_user_id,owner_name,title,created_by_name)
select 'meeting',s.meeting_date,s.inquiry_id,i.assigned_to,u.name,'대표회의','이관'
from crm_security.inquiry_flow_state s join public.inquiries i on i.id=s.inquiry_id left join public.users u on u.user_id=i.assigned_to
where s.meeting_date is not null and not exists(select 1 from crm_security.schedules c where c.inquiry_id=s.inquiry_id and c.type='meeting');
insert into crm_security.schedules(type,at,inquiry_id,owner_user_id,owner_name,title,created_by_name)
select 'reply_due',s.reply_due,s.inquiry_id,i.assigned_to,u.name,'자료 회신 기한','이관'
from crm_security.inquiry_flow_state s join public.inquiries i on i.id=s.inquiry_id left join public.users u on u.user_id=i.assigned_to
where s.reply_due is not null and not exists(select 1 from crm_security.schedules c where c.inquiry_id=s.inquiry_id and c.type='reply_due');

-- ⑤ 다음 할 일 문장에 들어 있던 예상 금액('… 예상 1,200만원') → 견적 버전 1(금액은 원). 견적 버전이 이미 있는 문의는 건너뛴다. 다음 할 일 문장은 바꾸지 않는다
insert into crm_security.inquiry_quote_versions(inquiry_id,version_no,amount,sent_at,change_reason,author_name,source,created_at)
select distinct on (n.inquiry_id) n.inquiry_id,1,replace(substring(n.title from '예상 *([0-9,]+) *만원'),',','')::bigint*10000,
 case when n.title ~ '발송 후' then n.created_at end,'다음 할 일 문장에서 옮김',coalesce(n.assignee_name,'이관'),'migrated',n.created_at
from public.next_actions n
where n.inquiry_id is not null and n.title ~ '예상 *[0-9,]+ *만원' and replace(substring(n.title from '예상 *([0-9,]+) *만원'),',','') ~ '^[1-9][0-9]{0,9}$'
 and not exists(select 1 from crm_security.inquiry_quote_versions v where v.inquiry_id=n.inquiry_id)
order by n.inquiry_id,n.created_at desc;

-- ── 전환 조건 한 줄 바꾸기(④): '견적 … 발송' 상태 또는 '현장방문 완료' 상태면 파이프라인 전환을 받는다 ──
do $do$
declare
 d text; o oid; n integer;
 a constant text:=$a$status_value !~ '견적.*발송'$a$;
 b constant text:=$b$status_value !~ '견적.*발송|현장[[:space:]]*방문[[:space:]]*완료'$b$;
begin
 select p.oid into o from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='crm_security' and p.proname='crm_inquiry_pipeline_promote_command_v1';
 if o is null then raise notice '파이프라인 전환 명령 함수가 없습니다 — 건너뜁니다'; return; end if;
 d:=pg_get_functiondef(o);
 if position(b in d)>0 then raise notice '전환 조건은 이미 바뀌어 있습니다 — 건너뜁니다'; return; end if;
 n:=(length(d)-length(replace(d,a,'')))/length(a);
 if n<>1 then raise exception '전환 조건을 바꿀 자리가 %곳입니다(1곳이어야 함) — 아무것도 바꾸지 않았습니다',n; end if;
 execute replace(d,a,b);
end $do$;
