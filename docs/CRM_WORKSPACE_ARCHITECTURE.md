# 영업운영 CRM 화면 구조 기준

## 화면 유형

- 전체 파이프라인은 기존 Kanban을 유지한다. 개별 단계의 업무 Queue로 대체하지 않는다.
- 컨설팅, 자료발송, 경쟁입찰, 계약시공, 수주, 실주는 동일한 Stage Split Shell을 사용한다.
- 관계관리와 확장관리는 전용 Workspace를 유지한다. 단계 선택, Scope, 색상은 공유한다.
- 일반 Deal 상세는 기존 `renderDetail`과 `renderDetailAddons` 경로 한 벌만 유지한다. 새로운 페이지별 상세 HTML/입력 폼을 복제하지 않는다.

## 변경 지점과 소유권

| 관심사 | 정본 | 변경 방식 |
| --- | --- | --- |
| 단계 순서·명칭·코드·색 | `pipeline-stages.js` | 키 기반 `colors`와 단계 메타데이터 수정 |
| 단계 업무 규칙 | `stage-specs.js` | 목적, 우선순위, 목록 필드, 주 Action, 상세 요약, 정렬, 결과/특수 유형 수정 |
| 공통 Queue 렌더링 | `stage-workspaces.js` | Spec을 받아 공통 카드/그룹 생성. 개별 단계 HTML 함수 추가 금지 |
| 분할 Shell·선택·Selector | `pipeline-split.js` | 단계와 무관한 레이아웃/수명주기만 담당 |
| Deal 상세·Action 연결 | `deal-detail-workspace.js` | `open(dealId, context)` 및 `run(action)`; 기존 상세·서버 명령 재사용 |
| 입력·저장 | `detail-actions.js`, 기존 전환·계약 UI | ACK/권한/충돌 처리 유지. 표시 계층에 쓰기 로직 추가 금지 |
| Global Scope | `sales-filters.js`, `sales-scope.js` | 브랜드 복수선택·직원유형·담당자 단일선택을 화면 간 유지 |
| Local Filter | `SalesFilterState.enter`, 해당 Workspace | 검색·공종·조회월·기한 등 화면별 상태 유지 |
| 계약실적 | `contract-sales-data.js`, 계약 원장 | 계약일과 계약 당시 귀속 기준. 현재 단계·현재 담당자로 대체 금지 |

기존 `drwDeal` 진입점은 호환을 위해 유지하되, 같은 `renderDetail`을 호출하고 `DealDetailWorkspace.decorate`에서 공통 단계 요약과 Action을 붙인다. 확장관리 전용 관리창은 일반 Deal 상세와 혼합하지 않는다.

## Spec 규칙

- 브랜드/담당자 Scope를 Spec에서 별도로 계산하지 않는다. 권한과 Scope를 적용한 목록을 받는다.
- Queue의 정렬은 우선순위 → 업무 날짜 → 안정적인 Deal ID 순서이다.
- 수주·실주는 `result` 유형이다. 연락 Queue용 버튼을 자동 부착하지 않는다.
- 날짜·금액·계약 당시 담당자가 없으면 미확인으로 표시한다. 임의 추정하지 않는다.
- 계약 지표는 현재 단계와 별개인 원장을 사용한다. 단계 화면의 결과 건수와 기간 계약실적은 서로 다른 의미로 표시한다.
- 초기 목록은 60건만 렌더링하고 더 보기로 확장한다. 전체 결과 건수와 표시 건수를 구분한다.
- 상세 DOM은 이동해서 재사용한다. 갱신 시 작성 중 폼을 복제하거나 지우지 않는다.

## 변경·검증 절차

1. 업무 의미 변경은 먼저 Spec에 반영한다.
2. 해당 우선순위·날짜 경계·귀속 규칙 검사를 실행한다.
3. 상세/작업/Scope 연결이 바뀌면 해당 브라우저 회귀만 실행한다.
4. Kanban, Special Workspace, 서버 저장 정책을 의도 없이 변경하지 않는다.
5. 배포 시 저장소 필수 Quality Gate를 통과한 뒤 운영 버전과 변경 동작을 확인한다.

화면 간격·폰트 조정은 이 구조 이후에 진행한다. 새 업무의 차이를 이유로 Split Shell이나 상세 Renderer를 다시 만들지 않는다.
