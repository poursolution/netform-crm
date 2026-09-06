# Production rollback procedure

STATUS: READY

현재 rollback 후보 SHA-256: `7e58f816cce046b4aef8c3bae3db0af54de7765d471c74e69469cde0a3c8a720`.
Storage 정책 전용 rollback 후보 SHA-256: `4814de2336b9ab9f02388457f9ed14bd3d3d14f56b90ac8ff714bb64a3d3b96c`.

## 적용 가능 범위

- schema rollback은 단일 transaction 역순 실행이다.
- Storage 정책 rollback은 `crm_attachment_insert_v1` 정책만 제거하며 Storage object나 업무 데이터를 삭제하지 않는다.
- manifest의 runtime 제한은 `PRE_OPPORTUNITY_CREATE_INQUIRY_PURGE_OR_CLOSED_WON_USE_ONLY`다.
- `inquiry_purge`, runtime `opportunity_create`, Closed Won 등 비가역·업무 데이터 생성 이후에는 이 SQL을 자동 실행하지 않는다. 즉시 쓰기를 중단하고 데이터 보존형 복구안을 별도 승인받는다.
- UI rollback은 최종 배포 직전 보존한 PC/mobile artifact hash로 되돌린다. 배포 직전 commit SHA와 Pages artifact SHA를 체크리스트에 기록한다.

## 절차

1. 신규 쓰기 트래픽을 중단하고 실패 시점·request_id·영향 operation을 보존한다.
2. 대상 ref, 현재 catalog fingerprint, 적용 manifest/apply/rollback hash를 재확인한다.
3. 비가역 runtime operation 실행 여부를 확인한다.
4. UI 문제만이면 DB를 되돌리지 않고 직전 UI artifact만 복원한다.
5. Storage 정책 문제만이면 Storage object 존재 여부를 보존한 채 정책 전용 rollback을 적용한다.
6. DB rollback 제한을 충족할 때만 최종 승인된 `rollback.sql`을 단일 transaction으로 적용한다.
7. frozen Dispatcher/read/ACL fingerprint와 기존 frozen 회귀를 재검증한다.
8. 생성 데이터·receipt·audit 중복과 canonical 데이터 손상 여부를 확인한다.
9. 결과를 기록하고 재적용은 별도 승인 전 금지한다.

## 현재 상태

Staging 31-op 35/35, 75/75 mutation step, 후속 8개 UUID 호환 경로, 첨부 Storage lifecycle과 exact fixture cleanup이 PASS다. fixture/잔여/Storage는 0이고 canonical 문의·Deal 전체행 MD5가 보존됐다. 절차는 준비됐지만 Production cutover와 rollback 실행은 별도 Production 승인 전 금지다.
