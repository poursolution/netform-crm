-- 요청 업무 v1 (2026-10-05 design_handoff_request · 대표 "오늘 업무의 '독촉'을 공통 요청 업무로")
-- 오늘 업무(영업관리 · 팀장 · 대표)의 '독촉' 대신 요청 한 건을 남긴다: 누구에게 · 무엇을 · 언제까지 → 요청 → 결과 회신.
--   · 보낸 사람 화면 '답 기다리는 중', 받는 사람 오늘 업무 맨 위('관리자 요청' / '본사 확인 요청'), 그 현장 응대 이력의 '시스템 · 내부 요청' 줄이 모두 이 표 한 곳을 읽는다.
--   · 상태: sent(요청 보냄) → seen(담당 확인) → working(처리 중) → replied(회신) / done(기록으로 자동 완료) / absent(요청 처리 · 부재) / cancelled(취소).
--   · 같은 건 · 같은 요청은 답을 기다리는 동안 한 줄만(부분 유일 색인 = 중복 잠금). 기한이 지나야 [재확인 요청](round + 1).
--   · 부재(absent)는 '요청은 처리했지만 연결은 안 됨'만 뜻한다 — 최초 응대(first_connected_at)는 이 함수들이 건드리지 않는다. 연락 기록은 기존 저장 길이 남긴다.
-- 새 표 1개(crm_security.work_requests) + 함수 4개. 다른 표는 읽기(public.users)만 한다. 다시 실행해도 안전하다.
--   · 표는 RLS 를 켜고 정책을 두지 않는다 — 읽기 · 쓰기는 아래 함수로만.
--   · 보내기 · 재확인 · 취소 = 관리자(admin). 회신 · 완료 = 받는 사람(지사 요청은 지사 계정) 또는 관리자. 읽기 = 보낸 사람 · 받는 사람 · 관리자(현장을 지정하면 로그인한 CRM 사용자).

create table if not exists crm_security.work_requests(
 id uuid primary key default gen_random_uuid(),
 target_type text not null check (target_type in ('inquiry','deal')),
 target_id text not null check (length(target_id) between 1 and 80),
 site text not null default '',
 brand text not null default '',
 kind text not null check (kind in ('branch','first','quote','follow','award','contract','support','deadline')),
 label text not null,                              -- 버튼 이름(지사 확인 요청 · 첫 연락 요청 …)
 to_scope text not null check (to_scope in ('user','branch')),
 to_user_id uuid,                                  -- 받는 사람(to_scope='user')
 to_name text not null,                            -- 화면에 적는 이름(이필선 · 경남지사장)
 asks jsonb not null default '[]'::jsonb,          -- 체크한 요청 내용
 due_at timestamptz not null,
 due_label text not null default '',               -- 오늘 17:00 · 오늘 중 · 내일 12시 · 3일 안
 memo text not null default '',
 status text not null default 'sent' check (status in ('sent','seen','working','replied','done','absent','cancelled')),
 result text,                                      -- 회신 결과(담당 지정 완료 …) 또는 통화 결과(연결됨 …)
 result_owner text,                                -- 지사 실담당
 next_text text,
 next_due date,
 reply_note text,
 auto_done boolean not null default false,         -- 실제 기록을 보고 화면이 닫은 요청
 round integer not null default 1 check (round between 1 and 20),
 requested_by_user_id uuid not null,
 requested_by_name text not null,
 replied_by_user_id uuid,
 replied_by_name text,
 created_at timestamptz not null default now(),
 reasked_at timestamptz,
 seen_at timestamptz,
 closed_at timestamptz,
 updated_at timestamptz not null default now()
);
create unique index if not exists work_requests_open_lock on crm_security.work_requests(target_type,target_id,kind) where status in ('sent','seen','working');
create index if not exists work_requests_to_user on crm_security.work_requests(to_user_id,status);
create index if not exists work_requests_by_user on crm_security.work_requests(requested_by_user_id,created_at desc);
create index if not exists work_requests_target on crm_security.work_requests(target_type,target_id,created_at);
alter table crm_security.work_requests enable row level security;
revoke all on table crm_security.work_requests from public, anon, authenticated;

-- 한 줄 → 화면이 읽는 모양
create or replace function crm_security.work_request_json(r crm_security.work_requests, a_user uuid, a_role text)
returns jsonb language sql stable set search_path='' as $fn$
 select jsonb_build_object('id',r.id,'target_type',r.target_type,'target_id',r.target_id,'site',r.site,'brand',r.brand,'kind',r.kind,'label',r.label,
  'to_scope',r.to_scope,'to_name',r.to_name,'asks',r.asks,'due_at',r.due_at,'due_label',r.due_label,'memo',r.memo,'status',r.status,
  'result',r.result,'result_owner',r.result_owner,'next_text',r.next_text,'next_due',r.next_due,'reply_note',r.reply_note,'auto_done',r.auto_done,'round',r.round,
  'requested_by',r.requested_by_name,'replied_by',r.replied_by_name,'created_at',r.created_at,'reasked_at',r.reasked_at,'seen_at',r.seen_at,'closed_at',r.closed_at,'updated_at',r.updated_at,
  'open',r.status in ('sent','seen','working'),'overdue',r.status in ('sent','seen','working') and r.due_at<now(),
  'by_me',r.requested_by_user_id=a_user,'to_me',(r.to_scope='user' and r.to_user_id=a_user) or (r.to_scope='branch' and a_role='branch'));
$fn$;
revoke all on function crm_security.work_request_json(crm_security.work_requests,uuid,text) from public, anon, authenticated;

-- ① 요청 보내기
create or replace function public.crm_work_request_create_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 a record; r crm_security.work_requests%rowtype; v_at timestamptz:=clock_timestamp();
 v_type text; v_id text; v_kind text; v_label text; v_scope text; v_to text; v_to_id uuid; v_due timestamptz; v_asks jsonb;
begin
 select * into a from crm_security.actor();
 if not found or a.permission_role<>'admin' then raise exception '요청은 관리자만 보낼 수 있습니다' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 v_type:=p->>'target_type'; v_id:=nullif(btrim(coalesce(p->>'target_id','')),''); v_kind:=p->>'kind';
 v_label:=nullif(btrim(coalesce(p->>'label','')),''); v_scope:=coalesce(nullif(p->>'to_scope',''),'user'); v_to:=nullif(btrim(coalesce(p->>'to_name','')),'');
 v_asks:=case when jsonb_typeof(p->'asks')='array' then p->'asks' else '[]'::jsonb end;
 begin v_due:=nullif(p->>'due_at','')::timestamptz; exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 if v_type not in ('inquiry','deal') or v_id is null or length(v_id)>80 or v_kind not in ('branch','first','quote','follow','award','contract','support','deadline')
  or v_label is null or length(v_label)>40 or v_scope not in ('user','branch') or v_to is null or length(v_to)>40 or v_due is null
  or jsonb_array_length(v_asks)>8 or length(coalesce(p->>'memo',''))>1000 or length(coalesce(p->>'site',''))>200 then
  raise exception 'invalid payload' using errcode='22023';
 end if;
 if v_due<v_at - interval '1 minute' or v_due>v_at + interval '31 days' then raise exception '처리 기한이 올바르지 않습니다' using errcode='22023'; end if;
 if v_scope='user' then
  select u.user_id into v_to_id from public.users u where u.name=v_to and u.active order by u.created_at limit 1;
  if v_to_id is null then raise exception '받는 사람을 찾을 수 없습니다' using errcode='22023'; end if;
  if v_to_id=a.user_id then raise exception '내 담당 건은 요청 없이 바로 처리합니다' using errcode='22023'; end if;
 end if;
 begin
  insert into crm_security.work_requests(target_type,target_id,site,brand,kind,label,to_scope,to_user_id,to_name,asks,due_at,due_label,memo,requested_by_user_id,requested_by_name,created_at,updated_at)
   values(v_type,v_id,left(coalesce(p->>'site',''),200),left(coalesce(p->>'brand',''),40),v_kind,v_label,v_scope,v_to_id,v_to,v_asks,v_due,left(coalesce(p->>'due_label',''),40),coalesce(p->>'memo',''),a.user_id,a.display_name,v_at,v_at)
   returning * into r;
 exception when unique_violation then
  raise exception '이미 답을 기다리는 같은 요청이 있습니다' using errcode='23505';
 end;
 return jsonb_build_object('ok',true,'request',crm_security.work_request_json(r,a.user_id,a.permission_role),'server_at',v_at);
end $fn$;
revoke all on function public.crm_work_request_create_v1(jsonb) from public, anon;
grant execute on function public.crm_work_request_create_v1(jsonb) to authenticated;

-- ② 목록: 보낸 사람 · 받는 사람 · 관리자. target_type + target_id 를 주면 그 현장의 요청(응대 이력용)
create or replace function public.crm_work_request_list_v1(p jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare a record; v_days integer; v_type text; v_id text;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 begin v_days:=coalesce(nullif(p->>'days','')::integer,30); exception when others then v_days:=30; end;
 v_days:=greatest(1,least(v_days,180));
 v_type:=nullif(p->>'target_type',''); v_id:=nullif(p->>'target_id','');
 return jsonb_build_object('ok',true,'server_at',now(),'requests',coalesce((
  select jsonb_agg(crm_security.work_request_json(r,a.user_id,a.permission_role) order by r.created_at desc)
  from crm_security.work_requests r
  where (v_type is not null and v_id is not null and r.target_type=v_type and r.target_id=v_id)
     or (v_type is null and (r.status in ('sent','seen','working') or r.updated_at>=now() - make_interval(days=>v_days))
         and (a.permission_role='admin' or r.requested_by_user_id=a.user_id or (r.to_scope='user' and r.to_user_id=a.user_id) or (r.to_scope='branch' and a.permission_role='branch')))),'[]'::jsonb));
end $fn$;
revoke all on function public.crm_work_request_list_v1(jsonb) from public, anon;
grant execute on function public.crm_work_request_list_v1(jsonb) to authenticated;

-- ③ 받는 쪽: 확인(seen) · 처리 중(working) · 회신(reply — 지사가 결과 하나 고름) · 완료(done — 실제 기록 저장 뒤 화면이 닫음, 부재면 absent) / 보낸 쪽: 취소(cancel)
create or replace function public.crm_work_request_reply_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 a record; r crm_security.work_requests%rowtype; v_at timestamptz:=clock_timestamp(); v_id uuid; v_action text; v_result text; v_owner text; v_next text; v_next_due date; v_note text;
 v_to_me boolean; v_absent boolean;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 begin v_id:=(p->>'id')::uuid; exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 v_action:=p->>'action'; v_result:=nullif(btrim(coalesce(p->>'result','')),''); v_owner:=nullif(btrim(coalesce(p->>'result_owner','')),'');
 v_next:=nullif(btrim(coalesce(p->>'next_text','')),''); v_note:=nullif(btrim(coalesce(p->>'note','')),'');
 begin v_next_due:=nullif(p->>'next_due','')::date; exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 if v_action not in ('seen','working','reply','done','cancel') or length(coalesce(v_result,''))>60 or length(coalesce(v_owner,''))>40 or length(coalesce(v_next,''))>200 or length(coalesce(v_note,''))>1000 then
  raise exception 'invalid payload' using errcode='22023';
 end if;
 select * into r from crm_security.work_requests w where w.id=v_id for update;
 if not found then raise exception '요청을 찾을 수 없습니다' using errcode='22023'; end if;
 v_to_me:=(r.to_scope='user' and r.to_user_id=a.user_id) or (r.to_scope='branch' and a.permission_role='branch');
 if v_action='cancel' then
  if a.permission_role<>'admin' and r.requested_by_user_id<>a.user_id then raise exception 'forbidden' using errcode='42501'; end if;
 elsif not v_to_me and a.permission_role<>'admin' then
  raise exception '받는 사람만 처리할 수 있습니다' using errcode='42501';
 end if;
 if r.status not in ('sent','seen','working') then
  return jsonb_build_object('ok',true,'request',crm_security.work_request_json(r,a.user_id,a.permission_role),'already',true,'server_at',v_at);
 end if;
 if v_action='seen' then
  update crm_security.work_requests w set status=case when w.status='sent' then 'seen' else w.status end,seen_at=coalesce(w.seen_at,v_at),updated_at=v_at where w.id=v_id returning * into r;
 elsif v_action='working' then
  update crm_security.work_requests w set status='working',seen_at=coalesce(w.seen_at,v_at),updated_at=v_at where w.id=v_id returning * into r;
 elsif v_action='cancel' then
  update crm_security.work_requests w set status='cancelled',closed_at=v_at,updated_at=v_at,reply_note=coalesce(v_note,w.reply_note) where w.id=v_id returning * into r;
 elsif v_action='reply' then
  if v_result is null then raise exception '처리 결과를 골라 주세요' using errcode='22023'; end if;
  if r.kind='branch' then
   if v_result not in ('담당 지정 완료','고객 첫 연락 완료','연락 시도 · 부재','진행 보류','본사 회수 요청') then raise exception '처리 결과를 골라 주세요' using errcode='22023'; end if;
   if v_result='담당 지정 완료' and v_owner is null then raise exception '실담당을 골라 주세요' using errcode='22023'; end if;
  end if;
  update crm_security.work_requests w set status='replied',result=v_result,result_owner=v_owner,reply_note=v_note,next_text=v_next,next_due=v_next_due,
   replied_by_user_id=a.user_id,replied_by_name=a.display_name,seen_at=coalesce(w.seen_at,v_at),closed_at=v_at,updated_at=v_at where w.id=v_id returning * into r;
 else -- done: 연락 기록 · 결과 · 다음 행동이 저장된 뒤(또는 필요한 정보가 채워진 것을 확인한 뒤) 화면이 부른다
  if v_result is null then raise exception '결과를 골라 주세요' using errcode='22023'; end if;
  v_absent:=coalesce((p->>'absent')::boolean,false);
  update crm_security.work_requests w set status=case when v_absent then 'absent' else 'done' end,result=v_result,next_text=v_next,next_due=v_next_due,reply_note=v_note,
   auto_done=coalesce((p->>'auto')::boolean,false),replied_by_user_id=a.user_id,replied_by_name=a.display_name,seen_at=coalesce(w.seen_at,v_at),closed_at=v_at,updated_at=v_at
   where w.id=v_id returning * into r;
 end if;
 return jsonb_build_object('ok',true,'request',crm_security.work_request_json(r,a.user_id,a.permission_role),'server_at',v_at);
end $fn$;
revoke all on function public.crm_work_request_reply_v1(jsonb) from public, anon;
grant execute on function public.crm_work_request_reply_v1(jsonb) to authenticated;

-- ④ 재확인 요청: 기한이 지난 열린 요청만. 같은 줄의 round 를 올리고 기한을 다시 잡는다(2회 미이행 = round 2 가 다시 기한 초과)
create or replace function public.crm_work_request_reask_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare a record; r crm_security.work_requests%rowtype; v_at timestamptz:=clock_timestamp(); v_id uuid; v_due timestamptz;
begin
 select * into a from crm_security.actor();
 if not found or a.permission_role<>'admin' then raise exception '재확인 요청은 관리자만 할 수 있습니다' using errcode='42501'; end if;
 begin v_id:=(p->>'id')::uuid; v_due:=nullif(p->>'due_at','')::timestamptz; exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 if v_due is null or v_due<v_at - interval '1 minute' or v_due>v_at + interval '31 days' then raise exception '처리 기한이 올바르지 않습니다' using errcode='22023'; end if;
 select * into r from crm_security.work_requests w where w.id=v_id for update;
 if not found then raise exception '요청을 찾을 수 없습니다' using errcode='22023'; end if;
 if r.status not in ('sent','seen','working') then raise exception '이미 끝난 요청입니다' using errcode='22023'; end if;
 if r.due_at>=v_at then raise exception '기한이 지난 뒤에 재확인을 요청할 수 있습니다' using errcode='22023'; end if;
 update crm_security.work_requests w set round=least(w.round+1,20),due_at=v_due,due_label=left(coalesce(p->>'due_label',''),40),status='sent',reasked_at=v_at,updated_at=v_at
  where w.id=v_id returning * into r;
 return jsonb_build_object('ok',true,'request',crm_security.work_request_json(r,a.user_id,a.permission_role),'server_at',v_at);
end $fn$;
revoke all on function public.crm_work_request_reask_v1(jsonb) from public, anon;
grant execute on function public.crm_work_request_reask_v1(jsonb) to authenticated;
