-- AI 사무실(Hermes) 시간 기준 점검용 읽기 전용 조회 v1 (2026-11-08 대표 지시「시간 기준 4개 설정해」)
-- 왜: 사무실은 crm_operational_source_v1(deal_core · inquiry_core)로 현장명 · 단계 · 담당 · 다음 할 일 기한 · 상태 · updated_at 만 받아
--     배정 30분 · 첫 연락 2시간 · 견적 후 7일 · 사유 빈칸 판정이 늘 '미확인'이었다.
-- 무엇: 시각과 있음/없음만 내보내는 사무실 전용 조회 하나. 고객 이름 · 연락처 · 주소 · 현장명 · 메모 글은 내보내지 않는다(레코드 id 만).
--       기존 crm_operational_source_v1 · crm_dashboard_source_v1 · 모든 저장 명령은 바꾸지 않는다. 판정(기한 넘김 여부)은 하지 않는다 — 사무실이 한다.
-- 정의(화면과 같게 맞춘 것 — 서버가 다 볼 수 없는 부분은 *_approx 로 표시):
--   ① 배정: received_at(접수 = received_at, 없으면 created_at) · assigned_at(배정 칸, 없으면 담당 변경 기록의 마지막 배정 시각 · basis 로 구분)
--   ② 첫 실제 연결: 견적문의 목록 '첫 연락 전'(inquiry-list-v3 model step 1 · InquiryV4.base · kpi-v7 누적 첫 연락 전)과 같은 순서
--      · 응대 기록(crm_security.inquiry_flow_state.first_connected_at) — 부재 · 통화불가 · 번호오류 · 회신대기(보낸 문자 · 카카오)는 '시도'라서 넣지 않는다
--      · 예전 응대 시각(responded_at · first_response_at): 흐름 이관(migrated) 전 문의만, 시트 응대내용이 '시도만'이면 넣지 않는다(inquiry-flow.js own() 과 같은 글 규칙)
--      · 예전 상태(접수 · 신규 · 담당자 배정 · 배정완료 밖)만 있고 시각이 없으면 마지막 수정 시각(화면과 같다)
--      · 메모 속 통화로 보완한 날(crm_security.inquiry_memo_reviews kind=call)이 있으면 그 날이 첫 연결(precision=day)
--      · 화면만 볼 수 있는 것: 같은 현장 다른 문의의 연락(ContactState.siblings) · 메모 글 속 통화 후보 → 서버 값은 근사(first_contact_approx)
--   ③ 견적 후 7일: 영업건 단계 정보 sent.fields.sent_date(화면 sentEvidence 와 같은 칸 — 없으면 판정 불가) · 그 뒤(서울 날짜로 다음 날부터) 첫 활동 / 첫 실제 연결
--   ④ 사유: 영업건 보류(sent 와 같은 단계 정보 waiting.fields.reason · resume_date, 없으면 wake_up_at) · 실주 사유(lost.fields.close_reason, 없으면 lost_reason)
--          견적문의 보류(마지막 inquiry_hold 기록의 사유 · 재검토일 = 열린 다음 할 일 기한, 없으면 next_action_date) · 종결 사유(close_reason · 흐름 종결 사유 · 시트 종료사유)
--   ⑤ stage_entered_at: 단계 체류 날짜만(정체 아님 — 판정하지 않음)
--   ⑥ 정체(2026-11-09 추가 · definitions_version 2): 2026-11-08 대표 결정 '영업 활동 기록 30일 이상 없음' 하나(crm.html isStale · PR #736).
--      last_sales_activity_at = 시스템 기록(담당자변경 · 일괄관리 · 장기현장 검토 · 데이터 · 이관 · 병합 · 정리)을 뺀 마지막 활동 → 마지막 활동 칸 → 등록일.
--      next_action_due_at = 열린 다음 할 일 기한(이 날짜가 아직 안 왔으면 '기다리는 중'이라 정체 아님). 30일 판정은 사무실이 한다.
--   ⑦ 단계 근거 날짜(2026-11-09 추가 · definitions_version 3): 화면 pipeline-judge.js basis 가 읽는 단계 정보 날짜 · 완료된 미팅 날짜를 그대로 내보낸다.
--      판정 결과(kind · due · why)는 내보내지 않는다 — 화면 판정이 고객 합의 대기(DecisionCollab) · 대기 이유(ContactLink) · 문의 이어받기(JourneyPath) ·
--      연락 판정(ContactState) · 운영 기준값(OPS_RULES) 같은 화면 모듈을 함께 읽어서, 서버에서 따로 만들면 화면과 갈라진다.
--      이 파일은 create or replace 라 여러 번 Run 해도 된다(v1 설치 뒤 이 판을 한 번 더 Run).
-- 권한: 로그인한 CRM 사용자(authenticated)만. 관리자 = 전체, 그 밖 = 기존 can_deal · can_inquiry 범위(사무실 연결이 쓰는 공개 키 + 계정 로그인과 같은 길).
-- 운영 적용: 대표 Run(Supabase SQL 편집기). 되돌리기: sql/office-timing-v1-20261108-rollback.sql
begin;

create or replace function crm_security.crm_office_safe_day(p text)
returns date language plpgsql stable set search_path='' as $fn$
declare s text:=btrim(coalesce(p,''));
begin
 if s='' then return null; end if;
 if s ~ '^\d{4}-\d{2}-\d{2}$' then return s::date; end if;
 if s ~ '^\d{4}-\d{2}-\d{2}[T ]' then return (s::timestamptz at time zone 'Asia/Seoul')::date; end if;
 return null;
exception when others then return null;
end $fn$;
revoke all on function crm_security.crm_office_safe_day(text) from public, anon, authenticated, service_role;

-- 단계 정보 날짜 한 칸(stage_contexts[stage].fields[key]) → 서울 날짜. 화면 pipeline-judge.js fld() 와 같은 자리
create or replace function crm_security.crm_office_ctx_day(cx jsonb, p_stage text, p_key text)
returns date language sql stable set search_path='' as $fn$
 select crm_security.crm_office_safe_day(case when jsonb_typeof(cx->p_stage->'fields'->p_key)='string' then cx->p_stage->'fields'->>p_key end)
$fn$;
-- 어느 단계든 그 칸이 있는 첫 값(화면 anyFld). 단계 이름 순서로 고른다
create or replace function crm_security.crm_office_ctx_any_day(cx jsonb, p_key text)
returns date language sql stable set search_path='' as $fn$
 select crm_security.crm_office_safe_day(e.value->'fields'->>p_key)
 from jsonb_each(case when jsonb_typeof(cx)='object' then cx else '{}'::jsonb end) e
 where jsonb_typeof(e.value->'fields'->p_key)='string' and nullif(btrim(e.value->'fields'->>p_key),'') is not null
 order by e.key limit 1
$fn$;
revoke all on function crm_security.crm_office_ctx_day(jsonb,text,text) from public, anon, authenticated, service_role;
revoke all on function crm_security.crm_office_ctx_any_day(jsonb,text) from public, anon, authenticated, service_role;

-- 글이 '시도만'인가(부재 · 안 받음 …이 있고 통화함 · 상담 · 견적 …이 없음). inquiry-flow.js ATT_TXT · CON_TXT 와 같은 글 규칙
create or replace function crm_security.crm_office_attempt_only(p text)
returns boolean language sql immutable set search_path='' as $fn$
 select coalesce(p,'') ~ '부재|안 ?받|받지 ?않|통화 ?불가|연결 ?안 ?(됨|되)|번호 ?오류|없는 ?번호|결번'
    and not coalesce(p,'') ~ '통화 ?(함|완료|했|하였|됨|후)|상담|안내|설명|요청|방문|견적|검토|회신 ?(받|옴|함)|연결됨|예정|보내|발송|전달|확인'
$fn$;

-- 활동 한 줄 → 'attempt'(시도) · 'connected'(실제 연결) · null(고객 접점 아님). inquiry-flow.js logOf/kindOf 와 같은 규칙
create or replace function crm_security.crm_office_activity_kind(p_type text, p_detail jsonb)
returns text language plpgsql immutable set search_path='' as $fn$
declare
 t text:=coalesce(p_type,'');
 note text:=case when jsonb_typeof(p_detail)='object' and jsonb_typeof(p_detail->'note')='string' then p_detail->>'note'
                 when jsonb_typeof(p_detail)='string' then p_detail #>> '{}' else '' end;
 res text:=case when jsonb_typeof(p_detail)='object' and jsonb_typeof(p_detail->'result')='string' then p_detail->>'result' else '' end;
 m text[]; r text; txt text;
begin
 if t='체크' then return null; end if;
 m:=regexp_match(res,'^\[(전화|카카오|문자|이메일|방문|기타) · ([^\]]+)\]');
 if m is null then m:=regexp_match(note,'^\[(전화|카카오|문자|이메일|방문|기타) · ([^\]]+)\]'); end if;
 if m is not null then r:=btrim(m[2]);
 else
  m:=regexp_match(res,'^통화 결과:\s*([^→]+?)\s*(→|$)');
  if m is null then m:=regexp_match(note,'^통화 결과:\s*([^→]+?)\s*(→|$)'); end if;
  if m is not null then r:=btrim(m[1]); end if;
 end if;
 if r is not null then
  return case when r in ('부재','통화불가','번호오류','회신대기') then 'attempt' else 'connected' end;
 end if;
 txt:=note||' '||res;
 if note ~ '^고객 응대 기록' and res<>'' then
  return case when crm_security.crm_office_attempt_only(res) then 'attempt' else 'connected' end;
 end if;
 if t ~ '전화|통화' then return case when crm_security.crm_office_attempt_only(txt) then 'attempt' else 'connected' end; end if;
 if t ~* '문자|SMS|카카오|메일|메시지' then return 'attempt'; end if;
 if t ~ '방문' then return 'connected'; end if;
 return null;
end $fn$;

revoke all on function crm_security.crm_office_activity_kind(text,jsonb) from public, anon, authenticated, service_role;
revoke all on function crm_security.crm_office_attempt_only(text) from public, anon, authenticated, service_role;

-- 본문(2026-11-10 분리): 로그인 확인 없이 서버 안에서만 부른다(사무실 판정 예약 작업 · 아래 공개 함수). 외부 실행 권한 없음.
--   p_admin=true 면 전체, false 면 기존 can_inquiry · can_deal 범위(로그인한 사람 기준)
create or replace function crm_security.crm_office_timing_core(p_domain text, p_after uuid, p_limit integer, p_admin boolean)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare
 v_admin boolean; raw_items jsonb; items jsonb; has_more boolean; next_cursor uuid; v_memo jsonb:='{}'::jsonb;
begin
 if p_domain is null or p_domain not in ('inquiry_timing','deal_timing') then
  raise exception 'unsupported office timing domain' using errcode='22023';
 end if;
 if p_limit is null or p_limit<1 or p_limit>500 then raise exception 'invalid limit' using errcode='22023'; end if;
 v_admin:=coalesce(p_admin,false);

 if p_domain='inquiry_timing' then
  -- 메모 속 통화 보완 날(메모 확인 SQL 이 운영에 없으면 빈 값 — 이 함수는 그대로 돈다)
  if to_regclass('crm_security.inquiry_memo_reviews') is not null then
   execute $q$select coalesce(jsonb_object_agg(x.inquiry_id::text,x.on_date),'{}'::jsonb) from (
     select distinct on (r.inquiry_id) r.inquiry_id,r.on_date from crm_security.inquiry_memo_reviews r
     where r.kind='call' and r.on_date is not null order by r.inquiry_id,r.decided_at desc) x$q$ into v_memo;
  end if;
  with page as (
   select i.id,i.status,i.assigned_to,i.assignee_name,i.assigned_at,i.received_at,i.created_at,i.updated_at,
    i.responded_at,i.first_response_at,i.deal_id,i.opportunity_id,i.work_type,i.close_reason,i.next_action_date,
    i.raw->>'응대내용' as response_text,i.raw->>'공사유형' as raw_work,i.raw->>'종료사유' as raw_close,
    fs.first_attempt_at as fs_fa,fs.first_connected_at as fs_fc,fs.migrated as fs_mig,fs.close_kind as fs_ck,fs.close_reason as fs_cr
   from public.inquiries i
   left join crm_security.inquiry_flow_state fs on fs.inquiry_id=i.id
   where (p_after is null or i.id>p_after)
    and coalesce(i.inquiry_type,'')<>'기술자문' and coalesce(i.brand,'')<>'기술자문'
    and coalesce((select e.action not in ('inquiry_trash','inquiry_purge') from crm_security.inquiry_audit_events e
      where e.inquiry_id=i.id and e.action in ('inquiry_trash','inquiry_restore','inquiry_purge')
      order by e.created_at desc,e.event_id desc limit 1),true)
    -- inquiry_sheet_mirror_read_v1: 시트 줄과 같은 문의가 접수 양식으로 한 번 더 들어온 손대지 않은 줄은 뺀다(대시보드 조회와 같은 조건)
    and not (
     i.sheet_row is null and i.assigned_to is null and nullif(btrim(i.assignee_name),'') is null
     and i.status in ('접수','신규') and i.deal_id is null and i.opportunity_id is null
     and i.qualified_at is null and i.responded_at is null and i.first_response_at is null and i.next_action_date is null
     and not exists (select 1 from crm_security.inquiry_audit_events ae where ae.inquiry_id=i.id)
     and not exists (select 1 from public.next_actions na where na.inquiry_id=i.id)
     and exists (
      select 1 from public.inquiries s
      where s.sheet_row is not null and s.brand=i.brand
      and length(regexp_replace(coalesce(i.phone,''),'[^0-9]','','g'))>=9
      and regexp_replace(s.phone,'[^0-9]','','g')=regexp_replace(i.phone,'[^0-9]','','g')
      and nullif(btrim(i.raw->>'접수일시'),'') is not null and s.raw->>'접수일시'=i.raw->>'접수일시'
      and nullif(btrim(i.raw->>'문의내용'),'') is not null and s.raw->>'문의내용'=i.raw->>'문의내용'
      and coalesce(s.raw->>'현장명','')=coalesce(i.raw->>'현장명','')
      and coalesce(s.address,'')=coalesce(i.address,'')
      and (select count(*) from public.inquiries same_s where same_s.sheet_row is not null
        and same_s.brand=s.brand and regexp_replace(same_s.phone,'[^0-9]','','g')=regexp_replace(s.phone,'[^0-9]','','g')
        and same_s.raw->>'접수일시'=s.raw->>'접수일시' and same_s.raw->>'문의내용'=s.raw->>'문의내용'
        and coalesce(same_s.raw->>'현장명','')=coalesce(s.raw->>'현장명','') and coalesce(same_s.address,'')=coalesce(s.address,''))=1
      and (select count(*) from public.inquiries same_d where same_d.sheet_row is null
        and same_d.brand=s.brand and regexp_replace(same_d.phone,'[^0-9]','','g')=regexp_replace(s.phone,'[^0-9]','','g')
        and same_d.raw->>'접수일시'=s.raw->>'접수일시' and same_d.raw->>'문의내용'=s.raw->>'문의내용'
        and coalesce(same_d.raw->>'현장명','')=coalesce(s.raw->>'현장명','') and coalesce(same_d.address,'')=coalesce(s.address,''))=1
     )
    )
    and (v_admin or crm_security.can_inquiry(i.id))
   order by i.id limit p_limit+1
  ), base as (
   select p.*,
    coalesce(p.received_at,p.created_at) as recv,
    (p.assigned_to is not null or coalesce(nullif(btrim(p.assignee_name),''),'미배정')<>'미배정') as assigned,
    (select max(h.changed_at) from public.assignment_history h
      where h.inquiry_id=p.id and coalesce(nullif(btrim(h.to_owner),''),'미배정')<>'미배정') as hist_assigned_at,
    coalesce(p.responded_at,p.first_response_at) as stamp,
    exists(select 1 from crm_security.inquiry_contact_logs l where l.inquiry_id=p.id and l.kind='connected') as has_connected_log,
    crm_security.crm_office_attempt_only(p.response_text) as text_attempt_only,
    nullif(v_memo->>(p.id::text),'')::date as memo_day,
    (p.deal_id is not null or p.opportunity_id is not null or coalesce(p.status,'') ~ '영업전환|전환완료') as converted,
    (coalesce(p.status,'') in ('수주','실주','배드핏','연락두절','종결','종료','POUR스토어 이관대기','POUR스토어 접수완료','자재 견적안내','자재 구매완료','미구매 종료')
      or coalesce(p.work_type,'') ~ '협약' or coalesce(p.raw_work,'') ~ '협약') as tracking_closed,
    (select e.after_data->>'hold_reason' from crm_security.inquiry_audit_events e
      where e.inquiry_id=p.id and e.action='inquiry_hold' order by e.created_at desc,e.event_id desc limit 1) as hold_reason,
    (select min(n.due_at) from public.next_actions n where n.inquiry_id=p.id and n.status='open') as open_due
   from page p
  ), contact as (
   select b.*,
    -- 예전 응대 시각: 흐름 이관 전 문의만, 시트 응대내용이 '시도만'이 아니면 실제 연결
    case when b.stamp is not null and b.fs_mig is null and not b.text_attempt_only then b.stamp end as stamp_connected,
    -- 예전 상태만 있고 시각이 없는 문의: 마지막 수정 시각(화면 InquiryFlow.own 과 같다)
    case when b.fs_fc is null and b.stamp is null
      and coalesce(b.status,'접수') not in ('접수','신규','담당자 배정','배정완료','') and not b.text_attempt_only
     then b.updated_at end as status_connected
   from base b
  ), judged as (
   select c.*,
    case when c.memo_day is not null then (c.memo_day::timestamp at time zone 'Asia/Seoul')
         else coalesce(least(c.fs_fc,c.stamp_connected),c.status_connected) end as first_contact_at,
    case when c.memo_day is not null then 'memo_confirmed'
         when c.fs_fc is not null and (c.stamp_connected is null or c.fs_fc<=c.stamp_connected)
          then case when c.has_connected_log then 'contact_log' else 'migrated' end
         when c.stamp_connected is not null then 'legacy_stamp'
         when c.status_connected is not null then 'legacy_status'
         else 'none' end as first_contact_basis,
    -- 화면 InquiryMemo.contactReview 'copied_received_date': 확인된 연결 기록 없이 첫 연결 시각이 접수일 복사로 보이는 문의 → '이관 기록 확인'(첫 연락 전에서 뺌)
    (c.assigned and not c.converted and not c.tracking_closed and not c.has_connected_log and c.memo_day is null
      and coalesce(c.fs_fc,c.first_response_at,c.responded_at) is not null and c.recv is not null
      and (abs(extract(epoch from coalesce(c.fs_fc,c.first_response_at,c.responded_at)-c.recv))<60
       or (coalesce(c.fs_fc,c.first_response_at,c.responded_at) at time zone 'Asia/Seoul')::date=(c.recv at time zone 'Asia/Seoul')::date)) as review_needed
   from contact c
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',j.id,
    'status',j.status,
    'received_at',j.recv,
    'assigned',j.assigned,
    'assigned_at',case when j.assigned then coalesce(j.assigned_at,j.hist_assigned_at) end,
    'assigned_at_basis',case when not j.assigned then 'none' when j.assigned_at is not null then 'column' when j.hist_assigned_at is not null then 'assignment_history' else 'none' end,
    'first_attempt_at',j.fs_fa,
    'first_connected_at',j.fs_fc,
    'memo_call_date',j.memo_day,
    'first_contact_at',j.first_contact_at,
    'first_contact_precision',case when j.memo_day is not null then 'day' when j.first_contact_at is not null then 'time' end,
    'first_contact_basis',j.first_contact_basis,
    'first_contact_approx',j.first_contact_basis not in ('contact_log','memo_confirmed'),
    'review_needed_approx',j.review_needed,
    'before_first_contact_approx',(j.assigned and not j.converted and not j.tracking_closed and j.first_contact_at is null and not j.review_needed),
    'converted',j.converted,
    'tracking_closed',j.tracking_closed,
    'close_kind',j.fs_ck,
    'close_reason_present',coalesce(nullif(btrim(j.close_reason),''),nullif(btrim(j.fs_cr),''),nullif(btrim(j.raw_close),'')) is not null,
    'on_hold',coalesce(j.status,'')='보류',
    'hold_reason_present',coalesce(j.status,'')='보류' and nullif(btrim(j.hold_reason),'') is not null,
    'hold_review_date',case when coalesce(j.status,'')='보류' then coalesce((j.open_due at time zone 'Asia/Seoul')::date,j.next_action_date) end,
    'updated_at',j.updated_at
   ) order by j.id),'[]'::jsonb) into raw_items from judged j;
 else
  with page as (
   select d.id,d.owner_id,d.stage_code,d.stage_group,d.lifecycle_status,d.outcome,d.created_at,d.stage_entered_at,d.updated_at,
    d.last_customer_contact_at,d.last_activity_at,d.wake_up_at,d.lost_reason,d.version,d.completion_date,d.closed_at,
    case when jsonb_typeof(d.stage_contexts)='object' then d.stage_contexts else '{}'::jsonb end as cx
   from public.deals d
   where (p_after is null or d.id>p_after) and (v_admin or crm_security.can_deal(d.id,false))
   order by d.id limit p_limit+1
  ), base as (
   select p.*,
    crm_security.crm_office_safe_day(case when jsonb_typeof(p.cx->'sent'->'fields'->'sent_date')='string' then p.cx->'sent'->'fields'->>'sent_date' end) as sent_day,
    coalesce(p.cx->'sent'->'fields'->>'sent_date_check','')='확인 불가' as sent_unverifiable,
    nullif(btrim(case when jsonb_typeof(p.cx->'sent'->'fields'->'reaction')='string' then p.cx->'sent'->'fields'->>'reaction' else '' end),'') is not null as reaction_present,
    nullif(btrim(case when jsonb_typeof(p.cx->'waiting'->'fields'->'reason')='string' then p.cx->'waiting'->'fields'->>'reason' else '' end),'') is not null as hold_reason_present,
    crm_security.crm_office_safe_day(case when jsonb_typeof(p.cx->'waiting'->'fields'->'resume_date')='string' then p.cx->'waiting'->'fields'->>'resume_date' end) as resume_day,
    coalesce(nullif(btrim(case when jsonb_typeof(p.cx->'lost'->'fields'->'close_reason')='string' then p.cx->'lost'->'fields'->>'close_reason' else '' end),''),nullif(btrim(p.lost_reason),'')) is not null as lost_reason_present,
    -- 정체(2026-11-08 대표 결정 · crm.html salesActivityAt): 시스템 기록(SYSTEM_ACT)을 뺀 마지막 영업 활동 → 마지막 활동 칸 → 등록일
    (select max(ac.occurred_at) from public.activities ac where ac.deal_id=p.id
      and not coalesce(ac.type,'') ~ '담당자변경|일괄관리|장기현장 검토|데이터|이관|병합|정리') as sales_act_at,
    -- 기다리는 중(crm.html staleWaiting): 열린 다음 할 일 가운데 기한이 가장 이른 것(화면 next_action 과 같은 순서)
    (select n.due_at from public.next_actions n where n.deal_id=p.id and n.status='open' order by n.due_at nulls last,n.id limit 1) as next_due_at,
    -- 완료된 미팅(화면 pipeline-judge.js meetingOf): 현장방문 · 방문 · 미팅 · 실측 · 실사 기록 가운데 예정 · 취소 · 불발 등이 아닌 것, 오늘(서울)까지의 가장 늦은 날
    (select max((ac.occurred_at at time zone 'Asia/Seoul')::date) from public.activities ac
      where ac.deal_id=p.id and btrim(coalesce(ac.type,'')) in ('현장방문','방문','미팅','실측','실사')
      and not (coalesce(case when jsonb_typeof(ac.detail)='object' then coalesce(ac.detail->>'note','')||' '||coalesce(ac.detail->>'result','')||' '||coalesce(ac.detail->>'status','') when jsonb_typeof(ac.detail)='string' then ac.detail #>> '{}' end,'')
       ~ '예정|계획|취소|불발|미실시|미완료|못함|못했|안 함|안했|조건부|시간이 맞으면')
      and not coalesce(case when jsonb_typeof(ac.detail)='object' then ac.detail->>'status' end,'') ~ '^(open|pending|cancelled|canceled|planned)$'
      and (ac.occurred_at at time zone 'Asia/Seoul')::date<=(now() at time zone 'Asia/Seoul')::date) as meeting_done_day
   from page p
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',b.id,
    'owner_assigned',b.owner_id is not null,
    'stage_code',b.stage_code,
    'stage_group',b.stage_group,
    'lifecycle_status',b.lifecycle_status,
    'outcome',b.outcome,
    'created_at',b.created_at,
    'stage_entered_at',b.stage_entered_at,
    'quote_sent_date',b.sent_day,
    'quote_sent_unverifiable',b.sent_unverifiable and b.sent_day is null,
    'quote_reaction_present',b.reaction_present,
    'first_activity_after_sent_at',case when b.sent_day is not null then (select min(ac.occurred_at) from public.activities ac
      where ac.deal_id=b.id and (ac.occurred_at at time zone 'Asia/Seoul')::date>b.sent_day
      and crm_security.crm_office_activity_kind(ac.type,ac.detail) is not null) end,
    'first_connected_after_sent_at',case when b.sent_day is not null then (select min(ac.occurred_at) from public.activities ac
      where ac.deal_id=b.id and (ac.occurred_at at time zone 'Asia/Seoul')::date>b.sent_day
      and crm_security.crm_office_activity_kind(ac.type,ac.detail)='connected') end,
    'followup_approx',true,
    'last_customer_contact_at',b.last_customer_contact_at,
    'last_sales_activity_at',coalesce(b.sales_act_at,b.last_activity_at,b.created_at),
    'last_sales_activity_basis',case when b.sales_act_at is not null then 'activity' when b.last_activity_at is not null then 'last_activity_at' when b.created_at is not null then 'created_at' else 'none' end,
    'next_action_due_at',b.next_due_at,
    -- 단계 근거 날짜(화면 pipeline-judge.js basis 가 읽는 자리 · 날짜 · 있음/없음만)
    'consulting_quote_due',crm_security.crm_office_ctx_day(b.cx,'consulting','quote_due'),
    'consulting_quote_request_present',nullif(btrim(case when jsonb_typeof(b.cx->'consulting'->'fields'->'quote_request')='string' then b.cx->'consulting'->'fields'->>'quote_request' else '' end),'') is not null,
    'meeting_scheduled_date',coalesce(crm_security.crm_office_ctx_day(b.cx,'consulting','meeting_date'),crm_security.crm_office_ctx_day(b.cx,'first_contact','meeting_date')),
    'meeting_done_date',b.meeting_done_day,
    'sent_followup_date',crm_security.crm_office_ctx_day(b.cx,'sent','followup_date'),
    'waiting_resume_date',crm_security.crm_office_ctx_day(b.cx,'waiting','resume_date'),
    'bid_deadline_date',crm_security.crm_office_ctx_any_day(b.cx,'bid_deadline'),
    'decision_date',crm_security.crm_office_ctx_any_day(b.cx,'decision_date'),
    'briefing_date',crm_security.crm_office_ctx_any_day(b.cx,'briefing_date'),
    'any_meeting_date',crm_security.crm_office_ctx_any_day(b.cx,'meeting_date'),
    'construction_start_date',crm_security.crm_office_ctx_day(b.cx,'construction','start_date'),
    'contract_date',crm_security.crm_office_ctx_day(b.cx,'contract','contract_date'),
    'completion_date',coalesce(b.completion_date,crm_security.crm_office_ctx_day(b.cx,'completion','completion_date')),
    'closed_at',b.closed_at,
    'hold_reason_present',b.hold_reason_present,
    'hold_review_date',coalesce(b.resume_day,(b.wake_up_at at time zone 'Asia/Seoul')::date),
    'hold_review_basis',case when b.resume_day is not null then 'resume_date' when b.wake_up_at is not null then 'wake_up_at' else 'none' end,
    'lost_reason_present',b.lost_reason_present,
    'updated_at',b.updated_at,
    'version',b.version
   ) order by b.id),'[]'::jsonb) into raw_items from base b;
 end if;

 has_more:=jsonb_array_length(raw_items)>p_limit;
 items:=case when has_more then raw_items-p_limit else raw_items end;
 next_cursor:=case when has_more and jsonb_array_length(items)>0 then (items->(jsonb_array_length(items)-1)->>'id')::uuid end;
 return jsonb_build_object(
  'contract_version',1,'resource','office_timing','domain',p_domain,'definitions_version',3,
  'scope_completeness','actor_authorized_rows_only',
  'generated_at',now(),
  'items',items,
  'pagination',jsonb_build_object('completeness',case when has_more then 'partial' else 'complete' end,
   'has_more',has_more,'next_cursor',next_cursor));
end $fn$;
revoke all on function crm_security.crm_office_timing_core(text,uuid,integer,boolean) from public, anon, authenticated, service_role;

-- 공개 함수: 로그인한 CRM 사용자 확인 → 본문 호출(응답 모양은 분리 전과 같다)
create or replace function public.crm_office_timing_v1(p_domain text, p_after uuid default null, p_limit integer default 200)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare a record;
begin
 select * into a from crm_security.actor();
 if not found or a.user_id is null or a.permission_role not in ('admin','rep','branch','consultation') then
  raise exception 'forbidden' using errcode='42501';
 end if;
 return crm_security.crm_office_timing_core(p_domain,p_after,p_limit,a.permission_role='admin')||jsonb_build_object('actor_user_id',a.user_id);
end $fn$;
revoke all on function public.crm_office_timing_v1(text,uuid,integer) from public, anon, service_role;
grant execute on function public.crm_office_timing_v1(text,uuid,integer) to authenticated;
notify pgrst, 'reload schema';
commit;

-- 확인(Run 뒤): 함수 있음 · 사무실 계정 권한 · 민감 칸 없음
-- select p.proname, has_function_privilege('authenticated',p.oid,'EXECUTE') auth_ok, has_function_privilege('anon',p.oid,'EXECUTE') anon_blocked_if_false
--   from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='crm_office_timing_v1';
