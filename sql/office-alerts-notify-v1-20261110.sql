-- AI 사무실 서버 판정 → 잔디 알림 v1 (2026-11-10 대표 결정 'B안 진행')
-- 왜: 서버 판정(sql/office-alerts-v1-20261110.sql)은 결과표에 쌓이지만, 알림을 띄우는 쪽은 대표실 PC 였다 → PC 가 꺼지면 알림도 멈춘다.
-- 무엇: 10분 판정 뒤 '새로 기준을 넘긴 일'만 잔디 토픽으로 보낸다(서버 pg_net · PC 불필요).
--   · 보내는 것: 규칙 이름 · 담당 이름(직원) · 지난 시간 · CRM 열기 링크(모바일 mobile.html?open=inq:<id> · deal:<id>). 고객 이름 · 연락처 · 현장명 · 메모는 보내지 않는다.
--   · 이관 자료(legacy)는 보내지 않는다(숫자만 — 사무실 합의). 같은 건은 한 번만 — 해소됐다가 다시 넘기면 다시 보낸다.
--   · 조용한 시간(기본 20시~8시, 서울)에는 보내지 않고 모아 두었다가 아침 첫 판정 때 보낸다.
--   · 웹훅 주소는 이 파일 · 저장소에 없다. 대표가 SQL 편집기에서 한 번 넣는다(아래 '켜기'). 밖에서 읽을 수 없는 서버 표에만 있다.
-- 먼저 sql/office-alerts-v1-20261110.sql 이 설치돼 있어야 한다. 여러 번 Run 해도 안전. 되돌리기: sql/office-alerts-notify-v1-20261110-rollback.sql
begin;

create table if not exists crm_security.office_notify_settings(
 id integer primary key default 1 check (id=1),
 enabled boolean not null default false,
 webhook_url text,
 quiet_from integer not null default 20 check (quiet_from between 0 and 24),
 quiet_to integer not null default 8 check (quiet_to between 0 and 24),
 max_items integer not null default 10 check (max_items between 1 and 30),
 app_base text not null default 'https://poursolution.github.io/netform-crm/',
 updated_at timestamptz not null default now()
);
insert into crm_security.office_notify_settings(id) values(1) on conflict (id) do nothing;
create table if not exists crm_security.office_alert_notified(
 rule text not null, object_type text not null, object_id text not null,
 notified_at timestamptz not null default now(),
 primary key(rule,object_type,object_id)
);
create table if not exists crm_security.office_notify_log(
 id bigserial primary key,
 sent_at timestamptz not null default now(),
 run_id uuid,
 kind text not null,                 -- new · test · skipped · error
 items integer not null default 0,
 request_id bigint,
 note text
);
alter table crm_security.office_notify_settings enable row level security;
alter table crm_security.office_alert_notified enable row level security;
alter table crm_security.office_notify_log enable row level security;
revoke all on crm_security.office_notify_settings, crm_security.office_alert_notified, crm_security.office_notify_log from public, anon, authenticated;
revoke all on sequence crm_security.office_notify_log_id_seq from public, anon, authenticated;

-- 규칙 이름(잔디에 보이는 말)
create or replace function crm_security.crm_office_rule_label(p text)
returns text language sql immutable set search_path='' as $fn$
 select case p
  when 'assign_overdue' then '배정 30분 넘김' when 'first_contact_overdue' then '첫 연락 2시간 넘김'
  when 'close_reason_missing' then '종결 사유 없음' when 'hold_reason_missing' then '보류 사유 없음'
  when 'quote_followup_overdue' then '견적 후 7일 · 후속 없음' when 'stale' then '정체(영업 활동 30일 없음)'
  when 'inactive' then '연락 주기 7일 넘김' when 'next_action_overdue' then '다음 할 일 날짜 지남'
  when 'lost_reason_missing' then '실주 사유 없음' when 'request_overdue' then '관리자 요청 기한 지남'
  else p end
$fn$;
-- 지난 시간 글
create or replace function crm_security.crm_office_over_text(m integer)
returns text language sql immutable set search_path='' as $fn$
 select case when m is null then '기록 필요' when m<60 then m||'분 지남' when m<1440 then (m/60)||'시간 '||(m%60)||'분 지남' else (m/1440)||'일 지남' end
$fn$;
revoke all on function crm_security.crm_office_rule_label(text) from public, anon, authenticated, service_role;
revoke all on function crm_security.crm_office_over_text(integer) from public, anon, authenticated, service_role;

-- 잔디로 보내기(서버 전용). p_test=true 면 조용한 시간 · 새 알림과 상관없이 시험 한 줄을 보낸다
create or replace function crm_security.crm_office_alerts_notify_v1(p_test boolean default false)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 s crm_security.office_notify_settings%rowtype; v_run uuid; v_hour int:=extract(hour from (clock_timestamp() at time zone 'Asia/Seoul'))::int;
 quiet boolean; n_new int; payload jsonb; lines text; cards jsonb; req bigint;
begin
 select * into s from crm_security.office_notify_settings where id=1;
 if s.id is null or not s.enabled or coalesce(s.webhook_url,'') !~ '^https://wh\.jandi\.com/connect-api/webhook/' then
  return jsonb_build_object('ok',true,'sent',false,'reason','not_configured');
 end if;
 if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
  return jsonb_build_object('ok',false,'sent',false,'reason','pg_net_missing');
 end if;
 if p_test then
  payload:=jsonb_build_object('body','[CRM 알림 시험] 서버 판정 알림이 연결됐습니다. 새로 기준을 넘긴 일이 생기면 10분 안에 이 방으로 옵니다.','connectColor','#15171C');
  execute 'select net.http_post(url:=$1,body:=$2,headers:=$3)' into req using s.webhook_url,payload,
   jsonb_build_object('Accept','application/vnd.tosslab.jandi-v2+json','Content-Type','application/json');
  insert into crm_security.office_notify_log(kind,items,request_id,note) values('test',0,req,'시험');
  return jsonb_build_object('ok',true,'sent',true,'test',true,'request_id',req);
 end if;
 select run_id into v_run from crm_security.office_alert_runs where ok order by started_at desc limit 1;
 if v_run is null then return jsonb_build_object('ok',true,'sent',false,'reason','no_run'); end if;
 -- 해소된 건은 '보냄' 기록을 지운다(다시 넘기면 다시 알림)
 delete from crm_security.office_alert_notified n
  where not exists(select 1 from crm_security.office_alerts a where a.run_id=v_run and a.rule=n.rule and a.object_type=n.object_type and a.object_id=n.object_id);
 quiet:=case when s.quiet_from=s.quiet_to then false
             when s.quiet_from<s.quiet_to then v_hour>=s.quiet_from and v_hour<s.quiet_to
             else v_hour>=s.quiet_from or v_hour<s.quiet_to end;
 if quiet then return jsonb_build_object('ok',true,'sent',false,'reason','quiet_hours'); end if;
 create table if not exists pg_temp.office_notify_new(rule text,object_type text,object_id text,owner text,over_minutes int) on commit drop;
 truncate pg_temp.office_notify_new;
 insert into pg_temp.office_notify_new
  select a.rule,a.object_type,a.object_id,coalesce(u.name,'미배정'),a.over_minutes
  from crm_security.office_alerts a left join public.users u on u.user_id=a.owner_user_id
  where a.run_id=v_run and not a.legacy
   and not exists(select 1 from crm_security.office_alert_notified n where n.rule=a.rule and n.object_type=a.object_type and n.object_id=a.object_id);
 select count(*) into n_new from pg_temp.office_notify_new;
 if n_new=0 then return jsonb_build_object('ok',true,'sent',false,'reason','nothing_new'); end if;
 select string_agg(crm_security.crm_office_rule_label(rule)||' '||c||'건',' · ' order by c desc,rule) into lines
  from (select rule,count(*) c from pg_temp.office_notify_new group by rule) t;
 select coalesce(jsonb_agg(jsonb_build_object(
   'title',crm_security.crm_office_rule_label(x.rule)||' · 담당 '||x.owner||' · '||crm_security.crm_office_over_text(x.over_minutes),
   'description',case x.object_type when 'inquiry' then s.app_base||'mobile.html?open=inq%3A'||x.object_id
                                    when 'deal' then s.app_base||'mobile.html?open=deal%3A'||x.object_id
                                    else s.app_base||'crm.html' end)),'[]'::jsonb)
  into cards from (select * from pg_temp.office_notify_new order by coalesce(over_minutes,0) desc,rule,object_id limit s.max_items) x;
 payload:=jsonb_build_object('body','[CRM 알림] 새로 기준을 넘긴 일 '||n_new||'건'||chr(10)||lines||case when n_new>s.max_items then chr(10)||'(오래된 순 '||s.max_items||'건만 아래에 · 전체는 CRM 오늘 업무)' else '' end,
  'connectColor','#B42318','connectInfo',cards);
 begin
  execute 'select net.http_post(url:=$1,body:=$2,headers:=$3)' into req using s.webhook_url,payload,
   jsonb_build_object('Accept','application/vnd.tosslab.jandi-v2+json','Content-Type','application/json');
 exception when others then
  insert into crm_security.office_notify_log(run_id,kind,items,note) values(v_run,'error',n_new,left(sqlerrm,300));
  return jsonb_build_object('ok',false,'sent',false,'reason','send_failed','error',left(sqlerrm,300));
 end;
 insert into crm_security.office_alert_notified(rule,object_type,object_id) select rule,object_type,object_id from pg_temp.office_notify_new on conflict do nothing;
 insert into crm_security.office_notify_log(run_id,kind,items,request_id) values(v_run,'new',n_new,req);
 delete from crm_security.office_notify_log where sent_at<now()-interval '30 days';
 return jsonb_build_object('ok',true,'sent',true,'items',n_new,'request_id',req);
end $fn$;
revoke all on function crm_security.crm_office_alerts_notify_v1(boolean) from public, anon, authenticated, service_role;

-- 10분 판정 뒤 바로 알림(같은 예약 작업 이름으로 다시 등록)
do $$
begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  begin
   perform cron.schedule('crm-office-alerts','*/10 * * * *','select crm_security.crm_office_alerts_compute_v1(); select crm_security.crm_office_alerts_notify_v1();');
  exception when others then raise notice 'pg_cron schedule skipped: %', sqlerrm;
  end;
 end if;
end $$;
notify pgrst, 'reload schema';
commit;

-- ── 켜기(대표가 SQL 편집기에서 한 번 · 웹훅 주소는 잔디 토픽 → 연동 → Incoming Webhook 에서 복사) ──
-- update crm_security.office_notify_settings set webhook_url='여기에_잔디_웹훅_주소', enabled=true, updated_at=now() where id=1;
-- select crm_security.crm_office_alerts_notify_v1(true);          -- 시험 한 줄
-- 끄기: update crm_security.office_notify_settings set enabled=false, updated_at=now() where id=1;
-- 조용한 시간 바꾸기(예: 21시~7시): update crm_security.office_notify_settings set quiet_from=21, quiet_to=7 where id=1;
-- 확인: select sent_at, kind, items, note from crm_security.office_notify_log order by id desc limit 5;
