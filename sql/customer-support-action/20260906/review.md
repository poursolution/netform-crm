# O02 고객관리 지원요청 — 로컬 호환 후보

판정: `DERIVED_SAFE_LOCAL_CANDIDATE_NOT_APPLIED`.

최종 PC UI의 `repSupportRecord`는 지원 카드 버튼을 누르는 즉시 `customer_support_action`을 기록한 뒤 문의/Deal 상세, 전화 앱, 메시징 화면, Activity 또는 Next 입력 화면으로 이동한다. 따라서 이 op의 정본 의미는 downstream 실행 완료가 아니라 관리자 지원요청 `requested` 한 건이다. 전화·메시지·Activity·Next는 각각 기존 독립 기능이고 이 요청과 한 transaction으로 묶지 않는다.

Adapter는 기존 외부 op와 ACK envelope를 유지하며 Deal 또는 문의 UUID, UI가 생성한 `client_ref`, 허용 action key와 표시 snapshot만 보낸다. client actor/time, rep 이름, site 이름, status는 권한 정본으로 사용하지 않는다. 서버는 현재 Auth UUID가 승인·미만료 admin인지, 대상이 명시 scope 안인지, 대상의 현재 담당자가 승인·미만료 `rep` UUID인지 다시 확인한다.

private `crm_security.customer_support_actions`는 append-only 요청/감사 ledger다. common receipt와 같은 transaction으로 정확히 한 행을 만들며 동일 request replay는 중복 0, 다른 payload 재사용은 409다. 별도 완료 상태를 발명하지 않고 `status='requested'`만 허용한다.

기존 operational source에 admin 전용 `customer_support_action` domain을 보충한다. 비-admin에게는 빈 배열을 반환하고 admin도 현재 scope 대상만 본다. 반환 shape는 현재 `B.customerSupportActions/B.customer_support_actions` 소비 계약을 그대로 충족한다.

O01은 이 후보에 포함하지 않는다. 주차별 mutable snapshot 의미는 확정됐지만 실제 UUID 구조에 `head_office/internal/performanceIncluded` 정본이 없어, Golden의 여섯 이름을 서버 권한 allowlist로 하드코딩하지 않는다.

Rollback은 지원요청과 receipt를 private archive에 보존하고 직전 P09M Dispatcher/read 계층을 복원한다. Staging DDL/DML은 수행하지 않았다.
