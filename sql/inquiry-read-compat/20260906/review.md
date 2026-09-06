# Inquiry scoped read compatibility — local candidate review

상태: **LOCAL_CANDIDATE_NOT_APPLIED / READ_ONLY_ANALYSIS_COMPLETE**

## 결론

현행 Staging `crm_read_scoped_v2`는 문의마다 `id, assigned_to, site_name, status`만 반환한다. 현재 PC/mobile UI는 문의 식별·검색·상세·배정 후 새로고침에 표시명, 접수일, 연락처, 공종, 연결 Deal, 응대시각과 배정이력이 더 필요하다. 이 후보는 기존 함수와 `can_inquiry` 범위를 유지하고 실제 Staging 컬럼으로 확정되는 값만 보충한다.

## 보충 필드

- `id`
- `sheet_row + row`
- `brand`
- `site_name + site`
- `address`
- `contact_name + contact`
- `phone`
- `assignee_name + assignee (assigned_to FK users.name)`
- `assigned_to UUID`
- `status`
- `deal_id`
- `opportunity_id`
- `received_at + created_at + at`
- `site_id`
- `source_channel`
- `channel`
- `work_type + work`
- `assigned_at`
- `first_response_at`
- `responded_at`
- `next_action_date + due`
- `detail (allow-listed inbound raw keys)`
- `assignment_history`

- `assigned_to`는 UUID 정본을 그대로 유지한다. 화면 표시명은 FK가 가리키는 `users.name`을 `assignee`/`assignee_name`으로 별도 반환한다.
- 공종 PASS에 필요한 Deal의 `primary_work / work_items / work_scope_type / work_summary / version` projection은 한 글자도 제거하지 않는다.
- 문의별 `assignment_history`만 lateral aggregate한다. 외부 history row를 볼 수 있는 별도 범위는 만들지 않는다.

## 의도적으로 제외 / BLOCKED

- **응대 본문 BLOCKED:** UI는 `responses`를 소비하지만 Staging에는 문의 응대 전용 history table/FK가 없다. 기존 `raw['응대내용']` 파싱은 저장 정본·append 규칙이 확정되지 않았으므로 이 후보에서 반환하지 않는다.
- **응대 actor BLOCKED:** `raw['전화응대자']`는 서버 UUID 감사 정본이 아니므로 `responder`로 투영하지 않는다.
- `raw` 전체는 반환하지 않는다. 문의 접수 상세에 현재 UI가 쓰는 allow-list 키만 `detail`로 만든다.
- `assigned_to` UUID를 legacy 표시명으로 바꾸지 않는다. 기존 UI에 연결할 때는 현재 read compatibility layer가 `assignee`를 표시용으로 사용해야 하며 UUID를 이름으로 가장하면 안 된다.

## 보안·호환 불변식

- 함수 signature, owner `postgres`, `SECURITY DEFINER`, 빈 `search_path`, 기존 ACL(`authenticated` execute; `anon` 없음)을 유지한다.
- actor 및 대상 단건 guard와 각 row의 `crm_security.can_inquiry(i.id)`를 유지한다.
- `can_inquiry` 함수, object scope, RLS, GRANT를 변경하지 않는다.
- 관계 join은 이미 허용된 inquiry의 담당자 이름과 그 inquiry의 assignment history에만 제한한다.
- Production/n8n/운영 Pages 접근 또는 Staging DDL/DML은 수행하지 않았다.

## 근거

- Staging snapshot: `sql/inquiry-direct-assign/20260906/after.json`; inquiries 28개 컬럼, assignment_history FK 대상 컬럼, users FK 표시명 컬럼을 대조했다.
- 기존 read 정의 SHA-256: `de66a2eca9c25fdbfb5cfbb30a16951640000e86cccda34ca723650bf3cf513c`.
- `crm.html`: PC inquiry identity/site/status — `function inqKey(q){return String(q.id||q.row||[q.site,q.at].join('|'))}`
- `crm.html`: PC assignment/response timestamps — `function inquiryRespondedAt(q){return q.first_activity||q.firstActivity||q.responded_at||q.respondedAt||(q.detail&&q.detail.responded_at)||''}`
- `crm.html`: PC contact/work/detail fallbacks — `function inqCtlContactLabel(q)`
- `crm.html`: PC assignment history fallback — `q.assignmentHistory||q.assignment_history||[]`
- `mobile.html`: Mobile inquiry normalization — `function inquiryViewM(q)`
- `mobile.html`: Mobile response body consumer — `(q.responses||[]).forEach(function(r)`
- `mobile.html`: Mobile canonical response timestamp mutation — `q.raw.responded_at=at`

## 적용 Gate

이 파일은 적용 승인이 아니다. Staging 적용 전 snapshot drift guard, 역할별 JWT scope, 목록/단건 pagination, 배정 후 새로고침, 응대 BLOCKED 표시를 별도로 검증해야 한다.
