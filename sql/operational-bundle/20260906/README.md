# Operational bundle 20260906

이 디렉터리는 `service_change`, `inquiry_unassign`, inquiry read compatibility를 현재 Staging의 단일 write Dispatcher 위에 충돌 없이 조합한 **로컬 후보**다.

- 적용 후보: `staging-apply.sql`
- 복구 후보: `rollback.sql`
- 적용 검토: `review.md`
- 해시와 정본: `manifest.json`
- 격리 PostgreSQL 시험: `db.test.cjs`
- live read-only preflight: `../../../docs/operational-cutover-20260906/staging-preflight-20260906.json`

Live preflight에서 관측한 Dispatcher OID `18077`과 read OID `18064`는 identity 증거일 뿐 SQL gate가 아니다. Local PGlite OID도 `local_fixture_dispatcher_oid`로만 기록한다. 적용 gate는 다음 안정 속성만 강제한다.

- Dispatcher/read definition MD5
- owner `postgres`
- `SECURITY DEFINER`
- 빈 `search_path`
- exact ACL
- receipt/inquiry-audit constraint definition
- candidate helper/frozen function 부재

Production/n8n/운영 Pages에는 적용하거나 접근하지 않는다.
