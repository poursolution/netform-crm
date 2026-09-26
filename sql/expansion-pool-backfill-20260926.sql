-- 확장관리 과거 수주 채우기 (2026-09-26)
-- 원인: crm_security.expansion_pool은 앱의 '수주 종료' 명령(crm_deal_close_won_command_v1)에서만 채워진다.
--       과거 이관 수주 149건은 그 명령을 거치지 않아 확장 목록이 0건이었다.
-- 규칙: 수주 종료 명령과 같은 값(타공종 확인 · 기존고객 · 신규 대상). 금액·준공일 있는 140건만.
--       준공+30일이 모두 지나 있어 첫 연락일은 2026-10-05(월)부터 담당자별 주 5건씩(최근 준공 먼저).
--       비활성 담당(퇴사) 건은 담당 비움 → 관리자가 배정. 이미 있는 건은 건너뜀(다시 실행해도 안전).
begin;
with src as (
  select d.id, d.site_id,
         case when u.active then d.owner_id end as owner_id,
         d.work_summary,
         coalesce(nullif(d.won_amount, 0), d.amount)::bigint as amt,
         d.completion_date
  from public.deals d
  left join public.users u on u.user_id = d.owner_id
  where (d.stage_code = 'won' or d.outcome = 'won')
    and d.completion_date is not null
    and coalesce(nullif(d.won_amount, 0), d.amount) > 0
    and not exists (select 1 from crm_security.expansion_pool p where p.source_deal_id = d.id)
), ranked as (
  select s.*, row_number() over (partition by s.owner_id order by s.completion_date desc, s.id) as rn
  from src s
)
insert into crm_security.expansion_pool
  (source_deal_id, site_id, owner_id, source_work_summary, source_won_amount, completion_date,
   next_contact_at, candidate_work_items, relationship_state, expansion_status, created_at, updated_at)
select id, site_id, owner_id, work_summary, amt, completion_date,
       greatest(completion_date + 30, date '2026-10-05' + ((rn - 1) / 5)::int * 7),
       '["타공종 확인"]'::jsonb, '기존고객', '신규 대상', now(), now()
from ranked;

select count(*) as pool_rows,
       count(*) filter (where owner_id is null) as unassigned,
       min(next_contact_at) as first_contact, max(next_contact_at) as last_contact
from crm_security.expansion_pool;
commit;
-- 기대값: pool_rows 140 · unassigned 19 · first_contact 2026-10-05
