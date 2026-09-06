# Reachable operations cumulative candidate

이 디렉터리는 현재 Staging의 frozen 4-op Dispatcher를 기준으로, 이미 각각 로컬 검증된 read/Pipeline/문의관리 후보를 한 번에 검토하기 위한 **미적용 후보**다.

- `staging-apply.sql`: 15개 delta를 의존 순서대로 단일 transaction에 적용한다.
- `rollback.sql`: 같은 delta를 역순 단일 transaction으로 되돌린다. 각 계층의 기존 rollback 규칙에 따라 durable evidence는 private archive에 보존한다.
- `operational-adapter.candidate.js`, `operational-overlay.candidate.js`, `transport.candidate.js`: 최종 누적 UI 후보다.
- `manifest.json`: 모든 입력·출력 해시와 포함/차단 의미를 고정한다.
- `staging-preflight.json`: 허용된 Staging ref와 현재 frozen function OID/hash/ACL/constraint, 후보 object 부재를 SELECT-only로 재확인한 증거다.

이 패키지는 Staging 적용 승인이 아니다. 실제 적용 전 live definition/OID/ACL/constraint drift를 다시 캡처하고, 적용 후 synthetic JWT/browser E2E와 frozen 기능 회귀를 모두 수행해야 한다. `response_update`, 경남 인계/담당, 신규 Pipeline 생성, 수주, 첨부, provider 메시징은 포함하지 않는다.

`inquiry_purge`는 실제 업무행을 물리 삭제하므로 전체 migration rollback은 해당 operation 사용 전만 보장한다. 사용 후에는 삭제 데이터를 만들어내지 않고 fail closed한다. Production 전환에는 별도의 backup/PITR 및 불가역 작업 runbook 승인이 필요하다.
