-- 견적문의 / 기술자문 경계
-- 기술자문은 Pipeline 사업유형이며 견적문의 KPI·배정 대상이 아니다.
-- 기존 기술자문 문의는 삭제하지 않고 관리자 검토 상태로 보존한다.

begin;

alter table public.inquiries
  add column if not exists legacy_review_status text,
  add column if not exists legacy_reviewed_at timestamptz,
  add column if not exists legacy_reviewed_by text;

alter table public.inquiries
  drop constraint if exists inquiries_legacy_review_status_check;

alter table public.inquiries
  add constraint inquiries_legacy_review_status_check
  check (
    legacy_review_status is null
    or legacy_review_status in ('pending', 'reclassified', 'promoted')
  );

update public.inquiries
set legacy_review_status = 'pending'
where regexp_replace(coalesce(brand, ''), '\s', '', 'g') = '기술자문'
  and legacy_review_status is null;

create index if not exists inquiries_technical_review_idx
  on public.inquiries (legacy_review_status, received_at desc)
  where regexp_replace(coalesce(brand, ''), '\s', '', 'g') = '기술자문'
    and deleted_at is null;

comment on column public.inquiries.legacy_review_status is
  '기존 기술자문 문의 검토 상태: pending/reclassified/promoted. 기술자문은 신규 견적문의 유입상품이 아님.';

commit;
