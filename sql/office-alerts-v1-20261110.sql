-- AI 사무실 서버 판정 v1 (2026-11-10 대표 결정 'A안 진행')
-- 왜: 사무실 알림봇은 대표실 PC 가 보람님 로그인 세션으로 3분마다 조회해 판정했다 → PC 가 꺼지거나 로그인이 풀리면 판정이 멈췄다(2026-11-10 아침).
-- 무엇: 같은 판정을 CRM 서버 안에서 10분마다(pg_cron) 돌려 결과표에 남긴다. 사무실 · 대표실은 결과만 읽는다.
--   · 재료 = crm_office_timing_v1 본문(crm_security.crm_office_timing_core · 같은 파일에서 분리) — 사무실이 받던 칸과 같은 정의
--   · 기준값 = public.crm_settings 'ops_rules'(화면 운영 기준 화면과 같은 줄), 없으면 화면 기본값(ops-rules.js DEF)
--   · 결과에는 id · 규칙 · 시각 · 담당 id 만(고객 이름 · 연락처 · 현장명 · 메모 없음). 기한을 넘겼는지까지 서버가 정한다.
--   · 보관 = 최근 6회(약 1시간)만. 판정이 멈췄는지는 읽을 때 last_run 시각으로 안다.
-- 규칙(rule 코드):
--   inquiry  assign_overdue        미배정 · 전환/종결 아님 · 접수 뒤 assign_minutes(30분) 넘음
--            first_contact_overdue  견적문의 목록 '첫 연락 전'(before_first_contact_approx) · 배정(없으면 접수) 뒤 first_contact_hours(2시간) 넘음 · 근사
--            close_reason_missing  종결 · 사유 없음
--            hold_reason_missing   보류 · 사유 없음
--   deal     quote_followup_overdue 견적 발송일 있음 · 반응 기록 없음 · 발송 뒤 실제 연결 없음 · quote_followup_days(7일) 넘음 · 근사
--            stale                 진행 중 · 마지막 영업 활동(시스템 기록 제외) 뒤 stale_days(30일) 이상 · 다음 할 일 날짜가 아직 안 온 건 제외(2026-11-08 대표 결정 · crm.html isStale)
--            inactive              진행 중 · 마지막 영업 활동 뒤 inactive_days(7일) 이상(연락 주기 알림 · 정체 아님) · 다음 할 일 날짜가 아직 안 온 건 제외
--            next_action_overdue   진행 중 · 다음 할 일 날짜 지남
--            lost_reason_missing   실주 · 사유 없음
--            hold_reason_missing   대기(waiting) 단계 · 진행 중 · 보류 사유 없음
--   request  request_overdue       관리자 요청 · 열림(sent/seen/working) · 기한 지남
--   legacy=true = Live(2026-10-01) 전 이관 자료이거나 활동 기록 없이 등록일로 센 건 → 하나씩 알리지 말고 숫자만(사무실 합의 2026-11-09).
-- 권한: 판정 함수는 서버 전용(외부 실행 불가). 읽기 crm_office_alerts_v1 = 로그인한 CRM 사용자(관리자 = 전체, 그 밖 = 본인 담당 건).
--       다시 판정 crm_office_alerts_refresh_v1 = 관리자만(pg_cron 이 없을 때 · 바로 보고 싶을 때).
-- 먼저 sql/office-timing-v1-20261108.sql 을 Run(본문 분리판)한 뒤 이 파일을 Run. 여러 번 Run 해도 안전. 되돌리기: sql/office-alerts-v1-20261110-rollback.sql
begin;

create table if not exists crm_security.office_alert_runs(
 run_id uuid primary key default gen_random_uuid(),
 started_at timestamptz not null default clock_timestamp(),
 finished_at timestamptz,
 ok boolean not null default false,
 error text,
 rules jsonb not null default '{}'::jsonb,
 counts jsonb not null default '{}'::jsonb
);
create table if not exists crm_security.office_alerts(
 run_id uuid not null references crm_security.office_alert_runs(run_id) on delete cascade,
 rule text not null,
 object_type text not null check (object_type in ('inquiry','deal','request')),
 object_id text not null,
 owner_user_id uuid,
 basis_at timestamptz,
 due_at timestamptz,
 over_minutes integer,
 legacy boolean not null default false,
 approx boolean not null default false,
 primary key(run_id,rule,object_type,object_id)
);
create index if not exists office_alerts_owner on crm_security.office_alerts(run_id,owner_user_id);
alter table crm_security.office_alert_runs enable row level security;
alter table crm_security.office_alerts enable row level security;
revoke all on crm_security.office_alert_runs, crm_security.office_alerts from public, anon, authenticated;

-- 판정 기준표(2026-11-10 보람님 결정 · 사무실 알림봇과 같게): 배정 30분 · 첫 연락 2시간은 근무시간(평일 08:30~18:00 서울, 주말 · 공휴일 제외)으로 센다.
--   밤 · 주말 접수는 다음 근무일 08:30부터. 견적문의 두 규칙은 inquiry_from(2026-11-01) 접수분부터만 본다(그 전은 사무실 정리봇이 따로).
--   공휴일은 사무실 crm-bots.js HOLIDAYS 와 같은 목록 — 2027년은 새로 넣어야 한다:
--   update crm_security.office_alert_rules set holidays=holidays||array['2027-01-01'::date] where id=1;
create table if not exists crm_security.office_alert_rules(
 id integer primary key default 1 check (id=1),
 inquiry_from date not null default '2026-11-01',
 work_from time not null default '08:30',
 work_to time not null default '18:00',
 holidays date[] not null default array['2026-01-01','2026-02-16','2026-02-17','2026-02-18','2026-03-02','2026-05-05','2026-05-25','2026-06-03','2026-06-08','2026-08-17','2026-09-24','2026-09-25','2026-09-28','2026-10-05','2026-10-09','2026-12-25']::date[],
 updated_at timestamptz not null default now(),
 check (work_from<work_to)
);
insert into crm_security.office_alert_rules(id) values(1) on conflict (id) do nothing;
alter table crm_security.office_alert_rules enable row level security;
revoke all on crm_security.office_alert_rules from public, anon, authenticated;

-- a~b 사이 근무시간(분). 사무실 crm-bots.js bizMs 와 같은 계산
create or replace function crm_security.crm_office_biz_minutes(a timestamptz, b timestamptz, wf time, wt time, hol date[])
returns integer language plpgsql immutable set search_path='' as $fn$
declare d date; s timestamptz; e timestamptz; total numeric:=0;
begin
 if a is null or b is null or b<=a then return 0; end if;
 d:=(a at time zone 'Asia/Seoul')::date;
 while d<=(b at time zone 'Asia/Seoul')::date loop
  if extract(isodow from d)<6 and not (d=any(coalesce(hol,'{}'::date[]))) then
   s:=greatest(a,(d+wf) at time zone 'Asia/Seoul'); e:=least(b,(d+wt) at time zone 'Asia/Seoul');
   if e>s then total:=total+extract(epoch from (e-s))/60; end if;
  end if;
  d:=d+1;
 end loop;
 return floor(total)::int;
end $fn$;
-- a 부터 근무시간 m 분이 지나는 시각(기한)
create or replace function crm_security.crm_office_biz_add(a timestamptz, m integer, wf time, wt time, hol date[])
returns timestamptz language plpgsql immutable set search_path='' as $fn$
declare d date; s timestamptz; e timestamptz; left_m numeric:=greatest(coalesce(m,0),0);
begin
 if a is null then return null; end if;
 d:=(a at time zone 'Asia/Seoul')::date;
 for i in 1..400 loop
  if extract(isodow from d)<6 and not (d=any(coalesce(hol,'{}'::date[]))) then
   s:=greatest(a,(d+wf) at time zone 'Asia/Seoul'); e:=(d+wt) at time zone 'Asia/Seoul';
   if e>s then
    if extract(epoch from (e-s))/60>=left_m then return s+make_interval(secs=>left_m*60); end if;
    left_m:=left_m-extract(epoch from (e-s))/60;
   end if;
  end if;
  d:=d+1;
 end loop;
 return null;
end $fn$;
revoke all on function crm_security.crm_office_biz_minutes(timestamptz,timestamptz,time,time,date[]) from public, anon, authenticated, service_role;
revoke all on function crm_security.crm_office_biz_add(timestamptz,integer,time,time,date[]) from public, anon, authenticated, service_role;

-- 판정 한 번(서버 전용)
create or replace function crm_security.crm_office_alerts_compute_v1()
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 v_run uuid; v_now timestamptz:=clock_timestamp(); v_today date:=(clock_timestamp() at time zone 'Asia/Seoul')::date;
 v_live date:='2026-10-01'; s jsonb:='{}'::jsonb; r jsonb; pg jsonb; cur uuid; dom text; v_counts jsonb;
 assign_min int; first_h int; quote_d int; stale_d int; inactive_d int;
 rr crm_security.office_alert_rules%rowtype;
begin
 select * into rr from crm_security.office_alert_rules where id=1;
 if rr.id is null then rr.inquiry_from:='2026-11-01'; rr.work_from:='08:30'; rr.work_to:='18:00'; rr.holidays:='{}'; end if;
 if to_regclass('public.crm_settings') is not null then
  execute $q$select coalesce((select value from public.crm_settings where key='ops_rules'),'{}'::jsonb)$q$ into s;
  if jsonb_typeof(s) is distinct from 'object' then s:='{}'::jsonb; end if;
 end if;
 -- 화면 ops-rules.js 와 같은 기본값
 assign_min:=coalesce(nullif(s->>'assign_minutes','')::int,30);
 first_h:=coalesce(nullif(s->>'first_contact_hours','')::int,2);
 quote_d:=coalesce(nullif(s->>'quote_followup_days','')::int,7);
 stale_d:=coalesce(nullif(s->>'stale_days','')::int,30);
 inactive_d:=coalesce(nullif(s->>'inactive_days','')::int,7);
 r:=jsonb_build_object('assign_minutes',assign_min,'first_contact_hours',first_h,'quote_followup_days',quote_d,'stale_days',stale_d,'inactive_days',inactive_d,'live_from',v_live,
  'inquiry_from',rr.inquiry_from,'work_hours',to_char(rr.work_from,'HH24:MI')||'~'||to_char(rr.work_to,'HH24:MI'),'holidays',coalesce(array_length(rr.holidays,1),0),'business_time_rules',jsonb_build_array('assign_overdue','first_contact_overdue'));
 insert into crm_security.office_alert_runs(started_at,rules) values(v_now,r) returning run_id into v_run;
 begin
  foreach dom in array array['inquiry_timing','deal_timing'] loop
   cur:=null;
   loop
    pg:=crm_security.crm_office_timing_core(dom,cur,500,true);
    if dom='inquiry_timing' then
     insert into crm_security.office_alerts(run_id,rule,object_type,object_id,owner_user_id,basis_at,due_at,over_minutes,legacy,approx)
     select v_run,x.rule,'inquiry',x.id,i.assigned_to,x.basis_at,x.due_at,
      case when x.over_m is not null then x.over_m when x.due_at is null then null else greatest(0,floor(extract(epoch from (v_now-x.due_at))/60))::int end,x.legacy,x.approx
     from (
      -- 배정 30분 · 첫 연락 2시간: 근무시간으로 세고(over_m = 기준을 넘긴 근무시간 분), inquiry_from 접수분부터만
      select c.id,c.rule,c.basis_at,
       crm_security.crm_office_biz_add(c.basis_at,c.limit_m,rr.work_from,rr.work_to,rr.holidays) as due_at,
       c.bm-c.limit_m as over_m,false as legacy,c.approx
      from (
       select q.*,crm_security.crm_office_biz_minutes(q.basis_at,v_now,rr.work_from,rr.work_to,rr.holidays) as bm from (
        select j->>'id' as id,'assign_overdue' as rule,(j->>'received_at')::timestamptz as basis_at,assign_min as limit_m,false as approx
        from jsonb_array_elements(pg->'items') j
        where not (j->>'assigned')::boolean and not (j->>'converted')::boolean and not (j->>'tracking_closed')::boolean
         and j->>'received_at' is not null and ((j->>'received_at')::timestamptz at time zone 'Asia/Seoul')::date>=rr.inquiry_from
        union all
        select j->>'id','first_contact_overdue',coalesce((j->>'assigned_at')::timestamptz,(j->>'received_at')::timestamptz),first_h*60,true
        from jsonb_array_elements(pg->'items') j
        where (j->>'before_first_contact_approx')::boolean and not (j->>'converted')::boolean and not (j->>'tracking_closed')::boolean
         and j->>'received_at' is not null and ((j->>'received_at')::timestamptz at time zone 'Asia/Seoul')::date>=rr.inquiry_from
       ) q
      ) c where c.bm>c.limit_m
      union all
      select j->>'id','close_reason_missing',(j->>'updated_at')::timestamptz,null::timestamptz,null::int,
       ((j->>'received_at')::timestamptz at time zone 'Asia/Seoul')::date<v_live,false
      from jsonb_array_elements(pg->'items') j
      where (j->>'tracking_closed')::boolean and not (j->>'close_reason_present')::boolean
      union all
      select j->>'id','hold_reason_missing',(j->>'updated_at')::timestamptz,null::timestamptz,null::int,
       ((j->>'received_at')::timestamptz at time zone 'Asia/Seoul')::date<v_live,false
      from jsonb_array_elements(pg->'items') j
      where (j->>'on_hold')::boolean and not (j->>'hold_reason_present')::boolean
     ) x left join public.inquiries i on i.id::text=x.id
     on conflict do nothing;
    else
     insert into crm_security.office_alerts(run_id,rule,object_type,object_id,owner_user_id,basis_at,due_at,over_minutes,legacy,approx)
     select v_run,x.rule,'deal',b.id,d.owner_id,x.basis_at,x.due_at,
      case when x.due_at is null then null else greatest(0,floor(extract(epoch from (v_now-x.due_at))/60))::int end,x.legacy,x.approx
     from (
      select j, j->>'id' as id,
       (j->>'outcome' is null and coalesce(j->>'lifecycle_status','')<>'closed') as open_deal,
       ((j->>'created_at')::timestamptz at time zone 'Asia/Seoul')::date<v_live or j->>'last_sales_activity_basis' in ('created_at','none') as legacy_deal,
       ((j->>'next_action_due_at')::timestamptz at time zone 'Asia/Seoul')::date as next_day,
       (j->>'last_sales_activity_at')::timestamptz as act_at
      from jsonb_array_elements(pg->'items') j
     ) b
     cross join lateral (
      select 'quote_followup_overdue' as rule,(b.j->>'quote_sent_date')::date::timestamp at time zone 'Asia/Seoul' as basis_at,
       ((b.j->>'quote_sent_date')::date+quote_d+1)::timestamp at time zone 'Asia/Seoul' as due_at,b.legacy_deal as legacy,true as approx
      where b.open_deal and b.j->>'quote_sent_date' is not null and not (b.j->>'quote_reaction_present')::boolean
       and b.j->>'first_connected_after_sent_at' is null and v_today-(b.j->>'quote_sent_date')::date>quote_d
      union all
      select 'stale',b.act_at,b.act_at+make_interval(days=>stale_d),b.legacy_deal,false
      where b.open_deal and b.act_at is not null and v_today-(b.act_at at time zone 'Asia/Seoul')::date>=stale_d
       and not (b.next_day is not null and b.next_day>v_today)
      union all
      select 'inactive',b.act_at,b.act_at+make_interval(days=>inactive_d),b.legacy_deal,false
      where b.open_deal and b.act_at is not null and v_today-(b.act_at at time zone 'Asia/Seoul')::date>=inactive_d
       and v_today-(b.act_at at time zone 'Asia/Seoul')::date<stale_d
       and not (b.next_day is not null and b.next_day>v_today)
      union all
      select 'next_action_overdue',(b.j->>'next_action_due_at')::timestamptz,(b.next_day+1)::timestamp at time zone 'Asia/Seoul',b.legacy_deal,false
      where b.open_deal and b.next_day is not null and b.next_day<v_today
      union all
      select 'lost_reason_missing',(b.j->>'closed_at')::timestamptz,null::timestamptz,b.legacy_deal,false
      where (b.j->>'outcome'='lost' or b.j->>'stage_code'='lost') and not (b.j->>'lost_reason_present')::boolean
      union all
      select 'hold_reason_missing',(b.j->>'stage_entered_at')::timestamptz,null::timestamptz,b.legacy_deal,false
      where b.open_deal and b.j->>'stage_code'='waiting' and not (b.j->>'hold_reason_present')::boolean
     ) x
     left join public.deals d on d.id::text=b.id
     on conflict do nothing;
    end if;
    exit when not coalesce((pg->'pagination'->>'has_more')::boolean,false);
    cur:=(pg->'pagination'->>'next_cursor')::uuid;
   end loop;
  end loop;
  -- 관리자 요청 기한 지남(요청 표가 있을 때만)
  if to_regclass('crm_security.work_requests') is not null then
   execute $q$insert into crm_security.office_alerts(run_id,rule,object_type,object_id,owner_user_id,basis_at,due_at,over_minutes,legacy,approx)
    select $1,'request_overdue','request',w.id::text,w.to_user_id,w.created_at,w.due_at,greatest(0,floor(extract(epoch from ($2-w.due_at))/60))::int,false,false
    from crm_security.work_requests w where w.status in ('sent','seen','working') and w.due_at<$2
    on conflict do nothing$q$ using v_run,v_now;
  end if;
  select coalesce(jsonb_object_agg(k,n),'{}'::jsonb) into v_counts from (
   select a.rule||case when a.legacy then ':legacy' else '' end as k,count(*) as n from crm_security.office_alerts a where a.run_id=v_run group by 1) t;
  update crm_security.office_alert_runs set finished_at=clock_timestamp(),ok=true,counts=v_counts where run_id=v_run;
 exception when others then
  update crm_security.office_alert_runs set finished_at=clock_timestamp(),ok=false,error=left(sqlerrm,500) where run_id=v_run;
 end;
 -- 보관: 최근 6회만
 delete from crm_security.office_alert_runs o where o.run_id not in (select run_id from crm_security.office_alert_runs order by started_at desc limit 6);
 return (select jsonb_build_object('run_id',o.run_id,'ok',o.ok,'error',o.error,'started_at',o.started_at,'finished_at',o.finished_at,'counts',o.counts)
  from crm_security.office_alert_runs o where o.run_id=v_run);
end $fn$;
revoke all on function crm_security.crm_office_alerts_compute_v1() from public, anon, authenticated, service_role;

-- 읽기: 마지막으로 성공한 판정의 결과
create or replace function public.crm_office_alerts_v1(p_rule text default null, p_offset integer default 0, p_limit integer default 500)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare a record; v_run crm_security.office_alert_runs%rowtype; v_last crm_security.office_alert_runs%rowtype; items jsonb; total int;
begin
 select * into a from crm_security.actor();
 if not found or a.user_id is null or a.permission_role not in ('admin','rep','branch','consultation') then raise exception 'forbidden' using errcode='42501'; end if;
 if p_limit is null or p_limit<1 or p_limit>2000 or p_offset is null or p_offset<0 then raise exception 'invalid limit' using errcode='22023'; end if;
 select * into v_last from crm_security.office_alert_runs order by started_at desc limit 1;
 select * into v_run from crm_security.office_alert_runs where ok order by started_at desc limit 1;
 if v_run.run_id is null then
  return jsonb_build_object('contract_version',1,'resource','office_alerts','ok',false,'reason','no_successful_run',
   'last_run',case when v_last.run_id is null then null else jsonb_build_object('started_at',v_last.started_at,'ok',v_last.ok,'error',v_last.error) end,'items','[]'::jsonb);
 end if;
 select count(*) into total from crm_security.office_alerts x where x.run_id=v_run.run_id and (p_rule is null or x.rule=p_rule)
   and (a.permission_role='admin' or x.owner_user_id=a.user_id);
 select coalesce(jsonb_agg(jsonb_build_object('rule',x.rule,'object_type',x.object_type,'id',x.object_id,'owner_user_id',x.owner_user_id,
   'basis_at',x.basis_at,'due_at',x.due_at,'over_minutes',x.over_minutes,'legacy',x.legacy,'approx',x.approx) order by x.rule,x.object_type,x.object_id),'[]'::jsonb)
  into items from (select * from crm_security.office_alerts x where x.run_id=v_run.run_id and (p_rule is null or x.rule=p_rule)
   and (a.permission_role='admin' or x.owner_user_id=a.user_id) order by x.rule,x.object_type,x.object_id offset p_offset limit p_limit) x;
 return jsonb_build_object('contract_version',1,'resource','office_alerts','ok',true,
  'scope',case when a.permission_role='admin' then 'all' else 'own' end,'actor_user_id',a.user_id,
  'run',jsonb_build_object('run_id',v_run.run_id,'started_at',v_run.started_at,'finished_at',v_run.finished_at,'rules',v_run.rules,'counts',v_run.counts,
   'age_minutes',floor(extract(epoch from (now()-v_run.finished_at))/60)::int),
  'last_run',jsonb_build_object('started_at',v_last.started_at,'ok',v_last.ok,'error',v_last.error),
  'total',total,'offset',p_offset,'has_more',p_offset+p_limit<total,'items',items);
end $fn$;
revoke all on function public.crm_office_alerts_v1(text,integer,integer) from public, anon, service_role;
grant execute on function public.crm_office_alerts_v1(text,integer,integer) to authenticated;

-- 바로 다시 판정(관리자만)
create or replace function public.crm_office_alerts_refresh_v1()
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare a record;
begin
 select * into a from crm_security.actor();
 if not found or a.permission_role<>'admin' then raise exception 'forbidden' using errcode='42501'; end if;
 return crm_security.crm_office_alerts_compute_v1();
end $fn$;
revoke all on function public.crm_office_alerts_refresh_v1() from public, anon, service_role;
grant execute on function public.crm_office_alerts_refresh_v1() to authenticated;

-- 10분마다(pg_cron 이 켜져 있을 때만 · 없으면 알림만 남기고 넘어간다 → 대시보드 Database > Extensions 에서 pg_cron 을 켠 뒤 이 파일을 다시 Run)
do $$
begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  begin
   -- 잔디 알림(sql/office-alerts-notify-v1-20261110.sql)이 설치돼 있으면 같이 부른다 — 이 파일을 다시 Run 해도 알림이 빠지지 않게
   perform cron.schedule('crm-office-alerts','*/10 * * * *','select crm_security.crm_office_alerts_compute_v1();'
    ||case when to_regprocedure('crm_security.crm_office_alerts_notify_v1(boolean)') is not null then ' select crm_security.crm_office_alerts_notify_v1();' else '' end);
  exception when others then raise notice 'pg_cron schedule skipped: %', sqlerrm;
  end;
 else
  raise notice 'pg_cron 이 꺼져 있습니다 — 판정은 crm_office_alerts_refresh_v1() 를 부를 때만 돕니다';
 end if;
end $$;

-- 설치하면서 한 번 판정
select crm_security.crm_office_alerts_compute_v1();
notify pgrst, 'reload schema';
commit;

-- 확인(Run 뒤 · 읽기 전용):
-- select started_at, ok, error, counts from crm_security.office_alert_runs order by started_at desc limit 3;
-- select jobname, schedule, active from cron.job where jobname='crm-office-alerts';   -- pg_cron 이 있을 때
