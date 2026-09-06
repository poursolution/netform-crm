# Staging exact fixture cleanup runbook

대상은 `netform-crm-staging / rprechiaglyjaydkmxsu`뿐이다. Production, n8n, service-role/secret key, DB URL은 사용하지 않는다. 이 절차는 사용자의 **정확 범위 삭제 승인 후에만** 실행한다.

상태: **COMPLETED / PASS**. 승인된 두 정확 범위 삭제와 읽기 전용 사후검증을 완료했다.

## 고정 대상

- fixture run: `stg-e2e-20260906t125239z-fc70f2d2`
- DB: manifest fixture 433행과 이후 확인된 server-generated TEST/E2E 잔여 15행, 합계 448행
- Storage bucket: `crm-site-files`
- Storage object ID: `c5838a9b-7aee-44fd-af88-58331d88f772`
- Storage path: `deals/431d2489-6e72-44c3-a8d4-41e95d0f0804/31b422c8-ad61-4336-b161-b8c00432d6db`
- Storage owner Auth UUID: `b5295979-d6c9-48f2-971a-2dea418b75e6`

`cleanup.sql`은 범위가 넓으므로 실행하지 않는다. 아래의 정확 범위 파일만 사용한다.

## 실행 순서

1. project ref와 exact object ID/path/owner 및 파일 SHA-256을 재확인했다.
2. Supabase Dashboard에서 exact Storage object 1개만 선택해 삭제했다. 성공 메시지와 SQL metadata 0건을 확인했다.
3. 임시 Storage policy와 로컬 Storage cleanup script는 적용하지 않았다. 사후검증에서 임시 policy 0, 영구 `crm_attachment_insert_v1` 1을 확인했다.
4. `cleanup-exact.sql`로 manifest fixture 433행을 삭제했다.
5. server-generated Deal UUID 3개가 manifest에서 빠진 사실을 발견해 별도 정확 범위 15행을 고정하고 추가 승인을 받았다.
6. `cleanup-generated-residual-exact.sql`로 해당 15행만 삭제했다.
7. 두 읽기 전용 verifier로 fixture/잔여/Storage 0, canonical inquiry 5행·Deal 5행 전체 JSON MD5 보존을 확인했다.
8. 현재 증거는 `cleanup-verification-current.json`이며 과거 `SUPERSEDED_BY_LATER_BROWSER_MUTATION_RUN` 파일을 덮어쓰지 않았다.

## 해시

- `cleanup-exact.sql`: `3dfe6eebb429a9c6b7340adf6ddc38db37a8190749ce4afb5d34e45348536942`
- `cleanup-exact-verify.sql`: `31684629ceb5146075dd9da97847c8bf670f388b80f1e18bc7626ce736d70cff`
- `cleanup-canonical-baseline-final.json`: `9c8634ee04fe0b2c06fed5bab18ef89051d26e259d69de53edef9b98843af5b0`
- `cleanup-generated-residual-exact.sql`: `d2f6835a5368f8ec722b95dcbd60a574597a14c5d7ad033251ed3b52bbd60810`
- `cleanup-generated-residual-verify.sql`: `bafbd13846e494bf5be65454b14d40aeb541b2afb0a92e20341c7829645f7ec3`
- `cleanup-verification-current.json`: `efb2151256e1e05e7641326b61d8f90211e7b45adb670d8e1fa4061c8dcd68aa`
- `storage-cleanup-policy-apply.sql`: `270b6d322c906b93d6a18744b47e874ad9467dc3edfd43c3cd03849ab6af8fcf`
- `storage-cleanup-policy-rollback.sql`: `c5e1d89a5d3850ab482efe8940cfdacc6f93392cb0dc1f0ba0525ffe38a0b882`
- `scripts/remove-exact-staging-storage-object.cjs`: `b5a920d9f424c0972061621fee6eee9efdf0fefb221062c939975aa38d0f439c`

## 실패 처리

- apply guard 실패: 아무 정책도 만들지 않고 중단한다.
- pre-list exact match가 1이 아님: 삭제하지 않고 임시 policy만 원복한다.
- remove 응답 exact match가 1이 아님: DB cleanup을 실행하지 않고 임시 policy를 원복한 뒤 보고한다.
- post-list가 0이 아님: DB cleanup을 실행하지 않고 임시 policy를 원복한 뒤 보고한다.
- DB cleanup guard/verify 실패: transaction rollback 상태를 확인하고 임의 보정하지 않는다.
