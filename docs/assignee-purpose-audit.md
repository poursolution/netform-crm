# 담당자 선택창 목적별 점검 (2026-09-05)

기준: `SALES_PEOPLE_MASTER` → `PeopleEligibility.eligible(purpose, context)`.
사용자/로그인 목록이나 조회 필터를 배정 후보로 재사용하지 않는다.

| 진입점 | 후보 기준 |
| --- | --- |
| 확장관리 → 신규기회 `nd-rep` | 원 수주 Deal 담당 우선, 해당 조직 sales role만. 미지정 Pool/퇴사자/상담담당 자동선택 안 함 |
| 일반 신규기회 `nd-rep` | 본사 활성 영업. 담당자 필수, 임의 첫 사람 자동배정 안 함 |
| 상세 `dv-assignee`, 기존 전환 `tr-assignee` | 해당 고객 조직 활성 영업 |
| 상세 다음 행동 `dv-na-assignee` | 해당 조직 영업 실행 담당 |
| Pipeline 일괄 `bulkValue`, 레거시 `bulkAssignee` | 선택한 현장 모두에서 적격인 후보의 교집합. 조직 혼합이면 분리 선택 안내 |
| 문의 배정 Modal/레거시 빠른 배정/일괄 | 본사 inquiryAssignable + 별도 지사 인계 흐름 |
| 문의 상담담당 | 해당 조직 inquiryConsultable, 영업귀속과 분리 |
| 경남지사 실담당 | gyeongnam sales role. 미지정 유지 액션은 별도 |
| 조회용 담당자 필터 | 실제 영업 전체를 조회할 수 있음. 배정용과 구분 |
| PT 지원 / 관리자 지원 | ptSupport / managementSupport 명시 capability. PT 미등록 시 임의 추천 안 함 |
| 모바일 | 현재 별도 영업담당 Select는 없음. 로그인 선택/고객 Contact 역할/ASQ 감리담당 읽기 표시를 영업 배정으로 바꾸지 않음 |

지원요청은 현재 자동 선별된 업무·담당 기반이며 새로운 인원 선택 UI를 만들지 않았다.
과거 기록의 담당자, 고객 정보, 회사 전체 실적은 삭제하거나 자동 재배정하지 않았다.
서버 people master의 신규 capability도 정규화하여 읽는다.

운영 n8n 저장 분기에는 동일한 목적·조직/역할 검증이 필요하다. 이번 변경은 로컬
화면과 저장 요청 직전 검증이며, 운영 DB 역할 변경이나 실고객 담당자 변경·배포는 실행하지 않았다.
