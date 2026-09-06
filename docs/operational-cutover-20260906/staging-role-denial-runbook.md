# Staging negative-role mutation gate

대상은 `netform-crm-staging / rprechiaglyjaydkmxsu` 하나뿐이다. Production, n8n, service-role/secret key, DB URL을 환경에 넣으면 하네스가 실행을 거부한다.

이 Gate는 이미 생성된 disposable fixture 두 건을 사용해 다음 6개 요청이 모두 `HTTP 403 / SQLSTATE 42501`로 거절되는지 검증한다.

- `OTHER_REP`, `CONSULT`, `GYEONGNAM`이 INTERNAL_REP 소유 Deal의 `opportunity_work_set` 실행 시도
- 같은 세 역할이 admin 전용 `inquiry_reclassify` 실행 시도

하네스는 거절 직전 owner/admin이 현재 값을 읽고, 여섯 요청 뒤 다시 읽어 Deal·문의의 업무 필드가 완전히 동일한지도 확인한다. 성공 요청, receipt, audit, domain mutation은 기대하지 않는다.

실행 전 조건:

1. 현재 exact fixture cleanup을 아직 실행하지 않았을 것
2. `browser-mutation-proof.json`이 `35 scenarios / 75 steps / 0 fail`일 것
3. `cleanup-pending-audit.json`이 현재 cleanup 대기 상태일 것
4. 출력 파일 `role-denial-proof.json`이 아직 없을 것

실행 환경 변수:

```text
CRM_RUN_OPERATIONAL_ROLE_DENIAL_STAGING=1
STAGING_PROJECT_REF=rprechiaglyjaydkmxsu
STAGING_CONFIRM_PROJECT_REF=rprechiaglyjaydkmxsu
STAGING_SUPABASE_URL=https://rprechiaglyjaydkmxsu.supabase.co/
STAGING_PUBLISHABLE_KEY=<Staging publishable key>
STAGING_SYNTHETIC_AUTH_FILE=<local synthetic auth JSON>
STAGING_ROLE_DENIAL_PROOF_FILE=<absolute path>/role-denial-proof.json
```

실행:

```text
node scripts/run-operational-role-denial-staging.cjs
```

PASS 기준:

- `pass=6`, `fail=0`, `skip=0`
- 세 역할 모두 두 요청에서 `403/42501`
- `state_unchanged=true`
- `committed_mutations=0`
- `production_requests=0`, `n8n_requests=0`

이 하네스는 준비만 완료됐으며 아직 Staging에서 실행하지 않았다.
