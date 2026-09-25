-- 한인규 담당 진행 영업·미종결 문의 → 미배정 (2026-09-25 · 대표 결정 A '계정만 정리 + 영업·문의 보관')
-- 계정: 로그인 계정은 원래 없음(auth 미연결·users.active=false·화면에서도 비활성). 로그인 이름 목록(phase1-config.js)에서 제외.
-- users 행은 유지 — 지우면 deals.owner_id FK(ON DELETE SET NULL)로 종료 영업 82건(과거 수주 19 포함)의 담당 이력이 끊긴다.
-- 대상: 진행(active/parked) 영업 + 미종결 문의만. 종료 영업은 담당 이력 그대로.
-- 결과: '과거 영업 정리'(미배정)와 컨트롤타워 루프 끊김의 '담당자 없는 영업'·'미배정 문의'에 모인다.
-- 되돌리기: crm_security.reassign_backup batch='haningyu-20260925'의 before_data로 복원.
create table if not exists crm_security.reassign_backup (
 batch text not null, object_type text not null, object_id uuid not null,
 before_data jsonb not null, backed_up_at timestamptz not null default now(),
 primary key (batch, object_type, object_id));
revoke all on table crm_security.reassign_backup from public, anon, authenticated;

insert into crm_security.reassign_backup(batch, object_type, object_id, before_data)
select 'haningyu-20260925', 'deal', d.id,
       jsonb_build_object('owner_id',d.owner_id,'assignee_name',d.assignee_name,'assignee_email',d.assignee_email,'version',d.version)
from public.deals d
where d.lifecycle_status in ('active','parked')
  and (d.owner_id=(select u.user_id from public.users u where u.name='한인규') or d.assignee_name='한인규')
on conflict do nothing;

insert into crm_security.reassign_backup(batch, object_type, object_id, before_data)
select 'haningyu-20260925', 'inquiry', i.id,
       jsonb_build_object('assigned_to',i.assigned_to,'assignee_name',i.assignee_name,'assigned_at',i.assigned_at)
from public.inquiries i
where coalesce(i.status,'') not in ('종결','종료','배드핏','수주','실주')
  and (i.assigned_to=(select u.user_id from public.users u where u.name='한인규') or i.assignee_name='한인규')
on conflict do nothing;

update public.deals d set owner_id=null, assignee_name=null, assignee_email=null, version=d.version+1, updated_at=now()
where d.lifecycle_status in ('active','parked')
  and (d.owner_id=(select u.user_id from public.users u where u.name='한인규') or d.assignee_name='한인규');

update public.inquiries i set assigned_to=null, assignee_name=null, assigned_at=null, updated_at=now()
where coalesce(i.status,'') not in ('종결','종료','배드핏','수주','실주')
  and (i.assigned_to=(select u.user_id from public.users u where u.name='한인규') or i.assignee_name='한인규');

-- 적용 확인: deals_backed_up≈165 · inquiries_backed_up≈24 · open_left 0 · closed_history_kept≈82
select (select count(*) from crm_security.reassign_backup where batch='haningyu-20260925' and object_type='deal') as deals_backed_up,
       (select count(*) from crm_security.reassign_backup where batch='haningyu-20260925' and object_type='inquiry') as inquiries_backed_up,
       (select count(*) from public.deals d where d.lifecycle_status in ('active','parked') and (d.owner_id=(select user_id from public.users where name='한인규') or d.assignee_name='한인규')) as open_left,
       (select count(*) from public.deals d where d.owner_id=(select user_id from public.users where name='한인규')) as closed_history_kept;
