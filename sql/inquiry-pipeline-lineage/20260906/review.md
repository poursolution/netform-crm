# 견적문의 → Pipeline 전환·lineage — 로컬 후보

판정: `DERIVED_SAFE_LOCAL_CANDIDATE / NOT APPLIED`.

Staging `rprechiaglyjaydkmxsu` read-only preflight는 PASS했다. 현재 공개 Dispatcher/read/frozen delegate의 definition·owner·ACL은 기록된 동결 baseline과 같고, `deals.origin_inquiry_id`가 설정된 4건 중 중복 inquiry key는 0이다. 후보 helper는 아직 하나도 적용되지 않았다. 상세 수치는 `staging-preflight.json`에 고정했다.

현재 도달 가능한 PC 일반 견적문의 경로만 연결한다. 모바일에는 문의→Pipeline 전환 버튼이 없다. 기술자문 이관과 경남 Pool/지사 담당 경로는 별도 의미이므로 계속 차단한다.

## 확정 계약

- lineage 정본은 기존 UI 주석대로 `deals.origin_inquiry_id` 한 방향이다. `inquiries.deal_id/opportunity_id`는 이번 경로에서 되쓰지 않는다.
- 한 inquiry는 한 Deal에만 연결한다. apply preflight에서 기존 중복 lineage가 있으면 중단하고, 각 command는 inquiry별 advisory lock 안에서 다른 Deal 연결을 다시 검사한다.
- 새 Deal 생성과 기존 Deal 승격은 각각 외부 `opportunity_create`, `transition` ACK를 유지하되 내부 intent를 분리한다.
- 자동 승격은 `/견적.*발송/` 상태 변경과 Deal 생성/승격을 한 transaction으로 처리한다. 수동 승격은 서버의 현재 inquiry status가 UI status와 같을 때만 처리한다.
- 목표 stage와 인계 사유는 서버가 inquiry status에서 다시 계산한다. 완료는 `sent`, 그 외 견적 발송 상태는 `consulting`이다.
- 승인된 본사 `permission_role='rep'` UUID가 inquiry의 `assigned_to`와 일치해야 하며 PC 관리자만 전환/수동 lineage 확인을 실행한다.
- 기존 Deal fallback은 같은 Site이면서 owner가 inquiry의 승인된 담당자이고, 다른 inquiry lineage가 없고, forward stage일 때만 승격한다.
- `linkedDeal()`은 명시적 reverse id 또는 `origin_inquiry_id`를 먼저 읽고, lineage가 전혀 없는 legacy row에만 기존 현장명 fallback을 쓴다.
- Deal/lineage, inquiry qualified/status, stage history, Activity, Deal audit, inquiry audit, receipt를 한 transaction으로 기록한다.

`inquiries.deal_id/opportunity_id`를 함께 쓰지 않는 이유는 Golden regular promotion이 이를 명시적으로 배제하고 Deal lineage만으로 join한다고 선언하기 때문이다. 반대로 기술자문 경로는 별도 `inquiry_status`를 보내므로 이번 후보에 포함하지 않는다.

Staging DDL/DML, Production, n8n 접근은 수행하지 않았다.
