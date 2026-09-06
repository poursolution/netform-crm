# Operational write/read bundle — Staging 적용 전 검토

상태: `LOCAL_COMBINED_CANDIDATE_NOT_APPLIED`

## 포함 범위와 순서

`staging-apply.sql` 한 transaction에서 다음 순서로 적용한다.

1. exact public/private Staging metadata guard
2. `command_receipts` operation allowlist를 4개 op로 한 번 확장
3. `inquiry_audit_events` action allowlist를 한 번 확장
4. verified public Dispatcher를 동일 OID/body/config의 private frozen delegate로 이동
5. private `inquiry_unassign` helper 설치 및 모든 client role 직접 실행 차단
6. public `crm_write_command_v2` wrapper 하나 설치
7. inquiry-compatible `crm_read_scoped_v2` projection 교체
8. after metadata guard 후 commit

공개 신규 write RPC는 만들지 않는다. bundle이 공개하는 write 진입점은 기존 signature의 `public.crm_write_command_v2` 하나다.

## Write routing

- `opportunity_work_set`: frozen delegate에 원형 위임
- `inquiry_assign` / `direct_assign`: frozen delegate에 원형 위임
- `service_change`: server actor, Deal scope/version, public+JSON business history, Activity, optional Next Action, private deal audit, receipt를 한 transaction으로 처리
- `inquiry_unassign`: wrapper가 version sentinel `0`을 확인한 뒤 private helper로 처리. admin inquiry scope, assignment history, private inquiry audit, receipt를 유지
- 그 외 operation: frozen delegate가 기존과 동일하게 거절

Actual Staging의 `crm_security.audit_events`에는 action CHECK가 없으므로 새 제약을 발명하지 않는다. `service_change`는 기존 unconstrained deal audit에 기록한다. 기존 action CHECK가 있는 `inquiry_audit_events`만 한 번 확장한다.

Frozen delegate는 기존 verified 함수의 OID, `prosrc`, owner, `SECURITY DEFINER`, volatility, 빈 `search_path`를 유지한다. PUBLIC/anon/authenticated/service_role은 직접 실행할 수 없다.

## Read

기존 공종 Deal projection을 유지하면서 inquiry에 현재 actual column으로 확인된 identity/site/contact/work/status/assignment/response timestamps, allow-listed detail, 해당 문의의 assignment history만 보충한다. 응대 본문과 응대 actor 정본은 계속 BLOCKED이며 합성하지 않는다.

## Activity 중복 방지

`service_change` 서버 branch가 durable Activity를 정확히 1건 만든다. 향후 Compatibility Adapter는 같은 UI action에서 Mobile `addActivity()`가 생성한 파생 queue item을 parent write correlation으로 억제해야 한다. 독립 Activity 입력은 억제하지 않는다.

## Rollback

Rollback은 한 transaction에서:

- service/unassign receipt와 unassign inquiry audit를 non-public archive schema로 이동
- private helper와 wrapper를 제거
- 동일 frozen OID/body를 original public Dispatcher로 복구
- receipt/audit allowlist를 original 값으로 복구
- original read definition/ACL을 복구
- exact before public/private metadata guard 확인

실제 Deal/문의 상태, business/assignment history, Activity, Next Action, deal audit은 업무 evidence이므로 삭제하거나 역변경하지 않는다.

## 적용 제한

- Staging 적용 승인이 아니다.
- Production, n8n, 운영 Pages에는 접근하지 않는다.
- 적용 전 `manifest.json`의 snapshot/apply/rollback hash와 project ref를 확인해야 한다.
- Live read-only preflight는 `docs/operational-cutover-20260906/staging-preflight-20260906.json`이다. 그 파일의 OID는 관측 증거일 뿐 적용 조건이 아니며, bundle은 definition MD5·owner·ACL·config·constraint를 guard한다.

