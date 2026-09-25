-- 퇴사자 한인규 담당 영업 33건 · 미종결 문의 24건 종료 처리 (2026-09-25 · 대표 확정 '종료 처리')
-- 사유: 퇴사로 고객 연락이 끊긴 건 — 금액이 입력돼 있어도(합계 약 20.6억, 활동 0) 진행 영업이 아님.
-- 영업: 결과 '연락두절'(stage_code=nocontact, stage_group=closed, lifecycle=closed, outcome=nocontact) — 기존 종료 건과 같은 모양.
-- 문의: 상태 '종결' + 종결 사유. 담당은 이력 보존을 위해 한인규로 되돌림(오늘 미배정 처리 전 값, 백업 batch='haningyu-20260925').
-- 백업: crm_security.reassign_backup batch='haningyu-close-20260925' (변경 전 행 전체). 고객 자산에는 과거 이력으로 남음.
begin;
insert into crm_security.reassign_backup(batch,object_type,object_id,before_data)
select 'haningyu-close-20260925','deal',d.id,to_jsonb(d)
from public.deals d join crm_security.reassign_backup b on b.batch='haningyu-20260925' and b.object_type='deal' and b.object_id=d.id
where d.lifecycle_status in ('active','parked') and d.owner_id is null
on conflict do nothing;

insert into crm_security.reassign_backup(batch,object_type,object_id,before_data)
select 'haningyu-close-20260925','inquiry',i.id,to_jsonb(i)
from public.inquiries i join crm_security.reassign_backup b on b.batch='haningyu-20260925' and b.object_type='inquiry' and b.object_id=i.id
where coalesce(i.status,'') not in ('종결','종료','배드핏','수주','실주')
on conflict do nothing;

update public.deals d set
  stage_code='nocontact', stage_raw='연락두절', stage_group='closed', lifecycle_status='closed', outcome='nocontact',
  closed_at=now(), next_action=null, next_action_date=null,
  owner_id=(b.before_data->>'owner_id')::uuid, assignee_name=b.before_data->>'assignee_name', assignee_email=b.before_data->>'assignee_email',
  version=d.version+1, updated_at=now()
from crm_security.reassign_backup b
where b.batch='haningyu-20260925' and b.object_type='deal' and b.object_id=d.id
  and d.id in (select object_id from crm_security.reassign_backup where batch='haningyu-close-20260925' and object_type='deal');

update public.inquiries i set
  status='종결', close_reason='퇴사자(한인규) 담당 — 연락 끊김, 일괄 종결 (2026-09-25 대표 결정)',
  assigned_to=(b.before_data->>'assigned_to')::uuid, assignee_name=b.before_data->>'assignee_name', updated_at=now()
from crm_security.reassign_backup b
where b.batch='haningyu-20260925' and b.object_type='inquiry' and b.object_id=i.id
  and i.id in (select object_id from crm_security.reassign_backup where batch='haningyu-close-20260925' and object_type='inquiry');
commit;

-- 적용 확인: deals_closed 33 · inquiries_closed 24 · haningyu_open_left 0 · unassigned_open_left 28 · active_now ≈500
select (select count(*) from crm_security.reassign_backup where batch='haningyu-close-20260925' and object_type='deal') as deals_closed,
       (select count(*) from crm_security.reassign_backup where batch='haningyu-close-20260925' and object_type='inquiry') as inquiries_closed,
       (select count(*) from public.deals d where d.lifecycle_status in ('active','parked') and d.id in (select object_id from crm_security.reassign_backup where batch='haningyu-20260925' and object_type='deal')) as haningyu_open_left,
       (select count(*) from public.deals d where d.lifecycle_status in ('active','parked') and d.owner_id is null and coalesce(d.assignee_name,'')='') as unassigned_open_left,
       (select count(*) from public.deals where lifecycle_status='active') as active_now;
