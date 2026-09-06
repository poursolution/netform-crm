# O07S/O08M public read compatibility gate

상태: `PUBLIC_CONNECT_BLOCKED_SELECTOR_REQUIRED / CONNECTED_READS_0 / LOCAL_ONLY`

## 결론

O07S Dashboard source와 O08M Mobile Mine의 private source fragment 자체는 권한상 `DERIVED_SAFE`다. 그러나 현재 UI는 두 화면 모두 `Phase1.read('operational',{limit:100})`를 호출하고 transport는 똑같은 네 인자 `p_after/p_limit/p_deal_id/p_inquiry_id`만 `crm_read_scoped_v2`에 보낸다. 서버가 어느 화면의 최소 projection을 요구받았는지 유일하게 판별할 수 없다.

기존 public 함수 signature/OID를 보존하면서 안전한 selector를 실어 보낼 빈 인자가 없다. `p_after`나 target UUID를 sentinel로 재사용하거나 JWT/header/GUC에 화면 의도를 넣는 것은 계약 훼손이므로 금지한다. 따라서 이번 후보는 public 함수와 UI를 연결하지 않는다.

## 왜 unconditional superset도 채택하지 않았는가

- 같은 RPC는 `work_items` 단건 새로고침에도 쓰인다. 항상 operational source child/PII를 붙이면 공종 단건 read까지 확장된다.
- Dashboard와 Mine의 complete 의미가 다르다. 동일한 100-row page를 각각 “Dashboard 전체” 또는 “내 전체”로 오인할 수 있다.
- 현재 함수는 Deal과 Inquiry에 같은 cursor/limit를 독립 적용하지만 collection별 `has_more/next_cursor`가 없다.
- admin/branch도 전사 전체가 아니라 explicit `object_scope`만 보므로 role명으로 complete를 추론할 수 없다.

## 최소 discriminator 제안 — 미적용

UI adapter 입력에 `resource: 'dashboard_source' | 'mine_source'`를 명시하고 서버 ACK에도 동일 값을 echo해야 한다. 서버 envelope에는 반드시 다음이 필요하다.

- `scope_completeness: 'actor_authorized_rows_only'`
- collection별 `pagination.completeness: 'complete' | 'partial'`
- `pagination.has_more`
- `pagination.next_cursor`

하지만 이 값을 현재 4-argument RPC에 추가하면 signature가 바뀐다. 이번 지시의 signature/OID 보존 조건 아래에서는 연결할 수 없으므로 `adapter-contract.js`의 `toCurrentRpc()`는 항상 `PUBLIC_READ_SELECTOR_UNAVAILABLE`로 fail closed한다. 별도 승인 없이 overload나 새 endpoint를 만들지 않는다.

## 보존된 계약

- 기존 `crm_read_scoped_v2(uuid,integer,uuid,uuid)` signature/OID/body/owner/ACL/config는 변경하지 않는다.
- 기존 inquiry compatibility와 공종 `primary_work/work_items/work_scope_type/work_summary/version` 필드를 변경하지 않는다.
- 기존 `can_deal/can_inquiry`, 단건 forbidden, 역할별 explicit scope를 변경하지 않는다.
- `sql/operational-read-fragments/20260906` private 후보도 public에 연결하거나 수정하지 않는다.
- `candidate.sql`과 `rollback.sql`은 `BEGIN READ ONLY` metadata gate일 뿐 DDL/DML을 수행하지 않는다.

## 적용 전 필요한 한 줄 규칙

**부족 규칙:** 기존 public signature/OID 보존 조건을 해제할지, 아니면 두 safe source를 하나의 명시된 `operational_source` superset 계약으로 항상 반환하도록 승인할지 결정해야 한다.

Production/Staging/n8n/Pages 원격 접근 및 변경은 수행하지 않았다.
