-- 주현진 담당 문의 6건 영구 삭제 + 사용자 비활성 (2026-09-25 · 대표 확정 '6건 모두 영구 삭제', 계정 생성 안 함)
-- 대상 실측: 영업건 0건 · 문의 6건(종결 3 · 전화응대 완료 3). 로그인 계정 없음(auth 미연결).
-- 백업: crm_security.inquiry_delete_backup batch='juhyeonjin-20260925' — 문의 행 + 연결 기록(다음 할 일·단계 이력·배정 이력·라우팅·권한 범위·유입 중복 방지)을 JSON으로 보관.
-- 주의: 유입 중복 방지 기록(private.inquiry_ingest_idempotency)도 함께 지워지므로 원본에 남아 있으면 다시 유입될 수 있음(대표 확인).
-- users 행은 삭제하지 않고 비활성 — 여러 이력 테이블이 users를 참조(RESTRICT)하므로 삭제 시 실패·이력 단절.
create table if not exists crm_security.inquiry_delete_backup (
 batch text not null, inquiry_id uuid not null, inquiry jsonb not null, related jsonb not null,
 backed_up_at timestamptz not null default now(), primary key (batch, inquiry_id));
revoke all on table crm_security.inquiry_delete_backup from public, anon, authenticated;

insert into crm_security.inquiry_delete_backup(batch, inquiry_id, inquiry, related)
select 'juhyeonjin-20260925', i.id, to_jsonb(i), jsonb_build_object(
  'next_actions',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.next_actions x where x.inquiry_id=i.id),
  'stage_history',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.stage_history x where x.inquiry_id=i.id),
  'assignment_history',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.assignment_history x where x.inquiry_id=i.id),
  'inquiry_routing',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from crm_security.inquiry_routing x where x.inquiry_id=i.id),
  'object_scope',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from crm_security.object_scope x where x.inquiry_id=i.id),
  'ingest_idempotency',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from private.inquiry_ingest_idempotency x where x.inquiry_id=i.id))
from public.inquiries i
where i.assigned_to=(select u.user_id from public.users u where u.name='주현진') or i.assignee_name='주현진'
on conflict do nothing;

-- 권한 범위(object_scope)는 문의 삭제를 막는 연결(NO ACTION)이라 먼저 정리. 나머지 연결 기록은 문의 삭제 시 함께 삭제(CASCADE), 영업건의 origin_inquiry_id는 비워짐.
delete from crm_security.object_scope o
where o.inquiry_id in (select b.inquiry_id from crm_security.inquiry_delete_backup b where b.batch='juhyeonjin-20260925');

delete from public.inquiries i
where i.id in (select b.inquiry_id from crm_security.inquiry_delete_backup b where b.batch='juhyeonjin-20260925');

update public.users set active=false, updated_at=now() where name='주현진';

-- 적용 확인: backed_up 6 · remaining 0 · user_active false
select (select count(*) from crm_security.inquiry_delete_backup where batch='juhyeonjin-20260925') as backed_up,
       (select count(*) from public.inquiries i where i.assigned_to=(select user_id from public.users where name='주현진') or i.assignee_name='주현진') as remaining,
       (select active from public.users where name='주현진') as user_active;
