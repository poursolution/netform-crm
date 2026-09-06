# Operational bundle Staging JWT 검증 계획

상태: `LOCAL_HARNESS_READY / REMOTE_NOT_RUN / STAGING_NOT_APPLIED`

대상 harness: `tests/operational-bundle-jwt.test.cjs`

## 검증 범위

세 local candidate를 한 리허설로 검증한다.

1. `inquiry-read-compat`: 확장된 `crm_read_scoped_v2`
2. `inquiry-domain`: public Dispatcher의 `inquiry_unassign` 분기
3. `pipeline-service-change`: 기존 Dispatcher의 `service_change` 분기

쓰기는 회귀 대상 두 개를 포함한 네 operation이다.

- 동결 `opportunity_work_set`
- 동결 `inquiry_assign / direct_assign`
- 후보 `inquiry_unassign`
- 후보 `service_change`

후보 SQL, 동결 Dispatcher, Compatibility Adapter는 이 harness 작업에서 수정하지 않았다.

## 실행 Gate

환경이 하나라도 없으면 real JWT test는 Node test의 명시적 `SKIP (not PASS)`가 된다. SKIP은 `STAGING_COMPAT_PASS`나 bundle PASS로 계산하지 않는다.

필수 환경:

```text
CRM_RUN_OPERATIONAL_BUNDLE_STAGING=1
STAGING_PROJECT_REF=rprechiaglyjaydkmxsu
STAGING_CONFIRM_PROJECT_REF=rprechiaglyjaydkmxsu
STAGING_SUPABASE_URL=https://rprechiaglyjaydkmxsu.supabase.co
STAGING_PUBLISHABLE_KEY=<publishable key>
STAGING_SYNTHETIC_AUTH_FILE=<local synthetic account JSON path>
```

선택 fixture override는 기존 synthetic UUID와 정확히 같을 때만 허용한다.

```text
STAGING_SYNTHETIC_DEAL_ID=f6090500-0006-4000-8000-000000000001
STAGING_SYNTHETIC_INQUIRY_ID=f6090500-0005-4000-8000-000000000005
```

환경 전체에서 Production ref `ymfbmpnizxvqsamnczow` 또는 hostname에 `n8n`이 들어간 URL을 찾으면, 필수 환경 누락 여부보다 먼저 실패한다. Supabase service-role/secret/DB URL도 이 JWT harness에서는 금지한다. 전송은 exact Staging origin의 `/auth/v1/` 및 `/rest/v1/`만 허용하고 redirect를 따르지 않는다.

## Synthetic preflight와 before snapshot

- checked-in `crm-synthetic-20260905` fixture의 TEST Deal/Inquiry만 선택한다.
- JWT Auth UUID와 `crm_profile_scoped_v2` CRM UUID가 fixture와 같아야 한다.
- Deal은 복원 가능한 기존 공종 값이 있어야 한다.
- Inquiry는 미응대(`first_response_at/responded_at IS NULL`), `배정완료`이며 현재 담당자가 승인된 synthetic rep여야 한다. 그래야 unassign 뒤 같은 public command로 owner/status를 정확히 복원할 수 있다.
- read candidate의 Deal 공종 필드와 Inquiry UI compatibility 필드를 확인한 뒤 memory before snapshot을 만든다.
- INTERNAL_REP, OTHER_REP, CONSULT, GYEONGNAM, ADMIN의 허용/거절 scope를 실제 JWT로 확인한다.

조건이 맞지 않으면 쓰기 전에 실패한다. 운영 row를 자동 탐색하거나 대용하지 않는다.

## 네 operation 검증

각 write는 server actor Auth UUID/CRM UUID와 감사 event UUID를 확인한다.

| operation | success/read refresh | replay | reuse | stale/scope | history/audit |
|---|---|---|---|---|---|
| `opportunity_work_set` | 공종 3종 + version | 같은 ACK/event | 다른 payload 409 | stale 409, 타 owner 403 | private audit exact 1 |
| `inquiry_assign` | target rep UUID/status | 같은 ACK/event | 다른 target 409 | non-admin 403 | assignment history + inquiry audit exact 1 |
| `inquiry_unassign` | assigned fields null, 미응대만 `접수` | 같은 ACK/event | 다른 reason 409 | non-admin 403 | assignment history + inquiry audit exact 1 |
| `service_change` | visible business + version | 같은 ACK/event | 다른 payload 409 | stale 409, 타 owner 403 | business history/activity/deal audit exact 1 |

public assignment/business history는 고유 run reason으로 확인한다. `inquiry_unassign`을 포함한 네 operation은 모두 `staging-write/compat-adapter-operational-candidate.js`를 거쳐 public `crm_write_command_v2`만 호출한다. private command 함수를 직접 호출하지 않는다.

Private receipt/audit은 JWT ACK의 exact request/event ID를 결과 JSON에 남긴다. JWT만으로 private schema를 읽거나 ACL을 완화하지 않는다. 따라서 JWT test가 모두 성공해도 결과 상태는 최종 PASS가 아니라 `JWT_PASS_PRIVATE_EVIDENCE_PENDING`이다.

## 별도 read-only Supabase 증거와 finalizer

JWT 실행이 restore까지 끝난 뒤 Supabase connector의 read-only catalog/data 조회로 별도 JSON을 만든다. 새 public verification RPC, private schema GRANT, service-role browser 호출은 만들지 않는다. 증거 JSON은 최소 다음 계약을 따른다.

```json
{
  "project_ref": "rprechiaglyjaydkmxsu",
  "run_id": "<JWT result와 같은 UUID>",
  "source": "supabase_connector_read_only",
  "read_only": true,
  "captured_at": "2026-09-06T...Z",
  "receipt_counts": {"<request uuid>": 1},
  "deal_audit_counts": {"<event uuid>": 1},
  "inquiry_audit_counts": {"<event uuid>": 1},
  "assignment_history_counts": {"<run reason>": 1},
  "business_history_counts": {"<run reason>": 1},
  "private_schema_usage_authenticated": false,
  "private_schema_usage_anon": false
}
```

`tests/operational-bundle-jwt-finalize.test.cjs`는 네트워크를 사용하지 않고 JWT 결과와 위 증거를 결합한다. `run_id`, 모든 request/audit ID, 모든 history reason token이 정확히 일치하고 각 count가 1이며 private ACL이 유지된 경우에만 `operational-bundle-final.json`에 `FINAL_PRIVATE_EVIDENCE_PASS`를 기록한다.

```powershell
$env:CRM_FINALIZE_OPERATIONAL_BUNDLE='1'
$env:STAGING_OPERATIONAL_PRIVATE_EVIDENCE_FILE='<read-only connector evidence JSON>'
node --test tests/operational-bundle-jwt-finalize.test.cjs
```

증거 파일이나 opt-in이 없으면 finalizer도 `SKIP (not PASS)`다.

## Restore와 잔존 증거

`finally`에서 현재 row 상태를 반드시 읽고 같은 business command로 복원한다.

- Inquiry owner/status를 before와 같게 복원
- Deal의 UI-visible business를 before와 같게 복원
- Deal 공종 3종을 before와 같게 복원
- 복원 후 새 read로 동일성을 확인

복원도 정상 command이므로 version은 증가하고 receipt/history/audit는 삭제하지 않는다. 이는 synthetic 업무 증거이며 중복 검증 대상이다. `service_change`의 현재 계약은 최초 변경 때 `origin_business`를 채우고 append-only business history/activity를 남기므로 byte-for-byte row rewind가 아니다. 현재 UI가 소비하는 업무 상태만 복원하고 append-only 증거는 별도 read-only connector 증거로 정확히 센다.

중간 assertion이 실패해도 restore를 시도한다. restore가 실패하면 원래 실패를 가리지 않고 결과 status를 `RESTORE_FAILED`로 기록하며 Node test도 실패한다. 결과 파일은 `docs/operational-cutover-20260906/operational-bundle-jwt-results.json`에 남지만 token, password, response body는 저장하지 않는다.

## 실행·판정

현재 단계에서는 원격 실행하지 않는다. 적용 승인, manifest/drift 검증, 세 candidate의 충돌 없는 bundle 합성 이후에만 다음을 실행한다.

```powershell
node --test tests/operational-bundle-jwt.test.cjs
```

JWT 단계의 성공 조건은 test summary `fail=0, skip=0`, 결과 JSON `status=JWT_PASS_PRIVATE_EVIDENCE_PENDING`, restore `PASS`, 그리고 `n8n_requests=0 / production_requests=0` 전부다. 최종 PASS는 이어서 offline finalizer가 `FINAL_PRIVATE_EVIDENCE_PASS`를 만든 때뿐이다. 환경 없음 SKIP이나 private count 미검증 상태는 PASS가 아니다.
