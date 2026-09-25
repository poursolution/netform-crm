-- 상태 계약 잠금 (2026-09-25 · 컨설턴트 전체 진단 P0-2)
-- 문제: stage_code='badfit_lead'(견적 배드핏 = 종료 단계)인데 lifecycle_status='active'인 영업건 203건.
--   전부 2026-09-04 이전 '잠재고객' 목록 이관분(closed_at 보유, outcome 없음, 다음 할 일·활동 0).
--   화면(CLOSED_CODES)은 이미 종료로 보는데 서버는 진행 중으로 셈 → 서버 집계와 화면이 어긋남.
-- 정상 경로는 이미 안전: 단계 이동(transition)은 종료 단계로 못 가고, 종료 명령(close)은 lifecycle을 closed로 저장한다.
-- 조치: ① 변경 전 값 백업 ② 종료 단계인데 닫히지 않은 건을 closed로 정정(version+1) ③ 모순을 DB 제약으로 금지.
-- 되돌리기: crm_security.state_fix_backup batch='state-contract-20260925'의 before_data로 복원 (제약을 먼저 drop).

create table if not exists crm_security.state_fix_backup (
 batch text not null,
 deal_id uuid not null,
 before_data jsonb not null,
 backed_up_at timestamptz not null default now(),
 primary key (batch, deal_id)
);
revoke all on table crm_security.state_fix_backup from public, anon, authenticated;

insert into crm_security.state_fix_backup(batch, deal_id, before_data)
select 'state-contract-20260925', d.id,
       jsonb_build_object('stage_code',d.stage_code,'lifecycle_status',d.lifecycle_status,'outcome',d.outcome,
                          'closed_at',d.closed_at,'version',d.version,'updated_at',d.updated_at)
from public.deals d
where d.stage_code in ('lost','badfit_lead','badfit_pipe','nocontact') and d.lifecycle_status<>'closed'
on conflict (batch, deal_id) do nothing;

update public.deals d set
  lifecycle_status='closed',
  outcome=coalesce(d.outcome, case d.stage_code when 'lost' then 'lost' when 'nocontact' then 'nocontact' else 'badfit' end),
  closed_at=coalesce(d.closed_at, d.stage_entered_at, d.updated_at, now()),
  version=d.version+1,
  updated_at=now()
where d.stage_code in ('lost','badfit_lead','badfit_pipe','nocontact') and d.lifecycle_status<>'closed';

do $chk$ begin
 if not exists (select 1 from pg_constraint where conrelid='public.deals'::regclass and conname='deals_closed_stage_consistent') then
  alter table public.deals add constraint deals_closed_stage_consistent
   check (stage_code is null or stage_code not in ('won','lost','badfit_lead','badfit_pipe','nocontact') or lifecycle_status='closed');
 end if;
end $chk$;

-- 적용 확인: contradictions 0 · backed_up 203 · active_now 868 (1,071 → 868)
select (select count(*) from public.deals where stage_code in ('won','lost','badfit_lead','badfit_pipe','nocontact') and lifecycle_status<>'closed') as contradictions,
       (select count(*) from crm_security.state_fix_backup where batch='state-contract-20260925') as backed_up,
       (select count(*) from public.deals where lifecycle_status='active') as active_now;
