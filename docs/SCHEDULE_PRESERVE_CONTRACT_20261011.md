# 42번 가이드 — 기존 일정 보존 서버 계약 후보

2026-10-11. 로컬 후보의 일부 구현·검사를 마쳤다. PC·모바일 영업건 입력에 비활성 연결했으나, 전체 경로 전환·운영 SQL 적용·PR·배포는 미완료다. 포트 8766은 사용자 제공 디자인 예시이며 이 저장 계약의 실행 화면이 아니다. PC·모바일 배치/CSS는 변경하지 않았다.

## 확인 근거

- 코드 기준: netform-crm `5fe1b714dff4c0b7efc963066b45242d96fa4d10`. PR 작성 전 최신 master에 다시 대조해야 한다.
- 운영 Supabase의 함수 정의·열·제약·트리거·인덱스만 읽었다. 고객 원자료 조회 및 운영 쓰기는 하지 않았다.
- 운영 `crm_inquiry_action_command_v1`의 `inquiry_next_set`은 열린 기존 업무를 취소하고 새 업무를 만든다.
- 운영 `crm_next_action_postpone_command_v1`은 기존 기한 이후이면서 KST 오늘 이후만 허용한다. 앞당기기·오늘로 변경에 재사용할 수 없다.
- 기존 `CRMRelease.has()`는 초기 미조회 시에도 true이며 모바일 HTML은 release-contract.js를 로드하지 않는다. 함수 이름만으로 활성화하면 안 된다.
- staging 프로젝트는 INACTIVE였다. 재개하거나 새 프로젝트를 만들지 않고 기존 로컬 PGlite로 SQL을 실행했다.

## 새 파일과 기존 파일

| 파일 | 역할 |
| --- | --- |
| sql/schedule-preserve-v1-20261011.sql | 기존 업무 보존 조회·추가·날짜 변경·영수증 조회. 기본 비활성 |
| sql/schedule-preserve-v1-disable.sql | 새 쓰기만 끄는 비파괴 중지. 업무·이력·영수증 보존 |
| schedule-contract.js | PC·모바일 공통 전송/ACK 검증. 공통 전송 모듈. 기존 HTML에 비활성 상태로 연결한 로컬 후보 |
| transport.js, pc-manager-transport.js | 아래 3개 RPC 허용 목록 추가만 |
| pc-error-state.js | 아래 3개 RPC 오류 이름 추가만 |
| tests/schedule-contract.test.cjs | 실제 SQL을 로컬 PostgreSQL 엔진에서 실행, 37개 |
| tests/schedule-client.test.cjs | 게이트·응답/계정 검증·동일 요청 재시도, 10개 |

추가한 서버 표는 비공개 `crm_security.schedule_v1_settings`, `crm_security.schedule_v1_events` 두 개다. 기존 공용 테이블에 새 열을 추가하지 않는다. 이벤트 표에 원래/변경 후 업무 전체 값, 사유, 고객 합의/내부 계획 구분, 처리 계정, 요청 번호, 저장 명령과 ACK를 보존한다. 삭제 연쇄로 이력이 없어지지 않도록 외래키는 만들지 않았다. 직접 접근은 RLS 및 권한 회수로 막고 기존 actor/access_review/대상 쓰기 권한을 통과한 RPC만 사용한다.

## RPC 계약

모두 인자 이름은 `p` 하나이며 JSON 객체다. 계약명은 `crm.schedule.v1`이다.

### crm_schedule_list_v1

입력: `{target_type:'deal'|'inquiry', target_id: UUID, page:1}`.

출력: `{ok,contract,enabled,writable,target_type,target_id,token,actor_auth_uid,actor_user_id,owner_id,page,per:20,total,items}`.

각 항목: `{id,action_type,title,due_at,due_on,status,assignee_name,updated_at,date_basis}`. 열린 업무만 기한·ID 순서로 한 쪽 최대 20개. 목록 아래 쪽 번호 렌더링은 기존 list-pager.js를 쓰며 이번 후보에는 UI를 추가하지 않았다. 새 날짜 근거가 없거나 다른 경로에서 업무를 수정했으면 `date_basis:'unconfirmed'`다. 기존 날짜를 고객 약속으로 추정하지 않는다.

`token`은 부모 원자료와 해당 대상의 모든 업무 행을 포함한 낙관적 충돌 검사용 지문이다. 담당/상태/업무를 다른 경로에서 변경했다면 이전 지문으로 저장할 수 없다. 버전 번호만 없는 문의도 같은 검사를 받는다. 지문은 권한 토큰이 아니며 매번 대상 권한을 별도로 확인한다.

### crm_schedule_write_v1

공통: `{request_id, target_type, target_id, expected_token, operation, due_on, date_basis}`.

- 별도 추가: `operation:'add', action_type:'전화'|'방문'|'후속접촉'|'기타', title`. 업무 이름은 기존 PC의 의미를 따른다. 견적 발송은 예컨대 type 후속접촉 + title 견적 발송이다. 견적 버전/견적팀 요청 자체를 생성하는 함수는 아니다.
- 날짜 변경: `operation:'reschedule', action_id:기존UUID, reason:필수`. 제목·종류·완료 상태는 바꾸지 않는다. 오늘 및 앞당기기·연기가 가능하며 오늘보다 과거 날짜는 거절한다. 기존 지정 시각은 KST 기준으로 보존한다.
- 날짜 성격: `date_basis:'internal_plan'|'customer_agreed'`. 호출자가 확인한 선택만 전달한다. 날짜만 보고 고객 약속으로 정하지 않는다.
- `request_id`를 최초 전송 전에 기존 계정/대상별 저장 복구 자료에 보관한다. 동일 번호·동일 입력 재시도는 기존 ACK를 반환하고 새 업무/이력/알림 트리거를 만들지 않는다. 같은 번호에 다른 입력은 REQUEST_ID_REUSE다.
- 업무 추가·변경과 사유/전후 이력, 부모 요약 값, ACK는 한 트랜잭션이다. 이력 저장 실패 시 전부 롤백한다. 기존 next_action_postponements를 수정하지 않으며 일반 날짜 변경을 기존 연기 횟수로 임의 합산하지 않는다.
- 응대 기록, 고객 접촉일, 활동 실적, 기존 요청 완료는 만들지 않는다. 완료 RPC도 아니다. ACK의 `completed_action_ids`와 `cancelled_action_ids`는 모두 빈 배열이어야 한다.
- 기존 열린 업무가 여러 개면 부모 next_action/date는 가장 빠른 업무를 가리킨다. 모든 업무는 목록에 남는다. 부모에 날짜만 있고 실제 열린 업무가 없으면 SCHEDULE_LEGACY_REVIEW_REQUIRED로 거절한다.

ACK: 원래 요청 번호·계정·대상·operation·action_id·기한·날짜 성격·event_id·변경 전후 값·새 token·서버 시각. 클라이언트는 대상/계정/기한과 실제 after 행을 검증해야 저장 성공으로 처리한다.

### crm_schedule_receipt_v1

입력: `{target_type,target_id,request_id}`. 출력: `{ok,contract,request_id,found,ack}`.

현재도 대상 쓰기 범위가 있는 요청 작성자만 본인의 저장 결과를 조회한다. 재배정으로 권한을 잃으면 거절한다. `found:false`는 완료가 아니며 새 UUID 자동 재전송의 근거도 아니다. 기능을 꺼도 이미 저장된 영수증은 확인할 수 있다. 이 함수는 새 일정 계약만 대사하며 기존 inquiry close의 불명확한 결과까지 복구하지 않는다.

## 활성화 전 남은 연결 — 지금 켜면 안 됨

1. 기존 업무 취소 후 교체하는 모든 호출 경로를 찾고 새 계약으로 연결하거나 명시적인 교체 작업으로 분리한다. 이번 SQL은 옛 함수를 제거/변경하지 않았다. 옛 함수가 나중에 호출되면 새 계약으로 추가한 업무도 취소할 수 있다.
2. 영업건 mobile-entry.js / PC 공통 입력의 schedule-flow.js와 모바일 문의의 inquiry-schedule-flow.js를 로컬 후보에 연결했다. 플래그 ON 실제 입력/합성 서버 브라우저 검사를 통과했으며 운영은 계속 비활성이다. PC 문의 및 견적 요청 등 나머지 교체 경로는 아직 전환하지 않았다.
3. 모바일 HTML에 CRMRelease 모듈을 추가한 로컬 후보를 준비했다. 모듈/플래그/서버 설정 중 하나라도 미확인이면 새 클라이언트는 닫힌 상태다. CRM_SCHEDULE_V1===true, CRMRelease가 세 RPC를 허용, 실제 list 응답의 enabled/writable=true가 모두 필요하다. 이 후보는 플래그를 켜지 않는다.
4. 실 PostgreSQL 다중 연결의 동시 저장/재배정/권한 회수, 기존 쓰기 경로의 잠금 순서를 검증한다. PGlite 단일 세션 검사는 이를 증명하지 않는다.
5. 기존 문의 알림/부모 날짜 트리거와 실시간 전달을 통합 검증한다. 로컬 검사는 트랜잭션 내 신호 기록으로 대체했다. 외부 알림을 새로 추가하거나 실제 발송하지 않았다.
6. 기존 연기 지표·일정 변경 이력·요청 이력 화면을 새 이벤트에 연결하고 동일 사건을 중복 집계하지 않는지 확인한다. 배치/스타일 변경이 필요한 부분은 Claude 인수인계로 남긴다.
7. 최신 master와 필수 CI를 확인한 같은 PR에 SQL+공통 클라이언트+PC/모바일 허용 목록+오류 이름+게이트를 포함한다. 운영 SQL은 disabled로 적용·검증한 뒤 화면 코드를 병합한다. 모든 경로 연결 및 통합 확인 전에는 서버 설정 enabled를 true로 바꾸지 않는다.

## 검사 재현과 한계

현재 작업공간에 이미 설치된 Node 및 `@electric-sql/pglite`를 사용했다. 운영 의존성/설치/패키지 잠금 파일은 변경하지 않았다. CI에 포함할 때는 테스트 의존성을 명시해야 한다.

```
node tests/schedule-contract.test.cjs
node --test tests/schedule-client.test.cjs
```

SQL 37개와 클라이언트 10개 통과. 추가로 기존 공통 입력 12개 및 JS 9파일 문법 검사 통과. SQL 결과는 schedule-sql-result.json에 저장했다. 운영 고객/담당 데이터 변경 0건, 실제 로그인 계정의 end-to-end 저장 검증은 미완료다.

## 44번 인수인계 수신 시점의 보존 상태

견적 PC·계산·데이터는 Claude 담당이라는 최신 지침을 적용한다. 이 일정 계약은 견적 v3 계산 계약이 아니며, 견적팀 기한 승인 흐름으로 대신 쓰지 않는다. 44번 단계 0 보고 후 사용자 확인 전 추가 단계 진행을 멈춘다.

- schedule-flow.js: 영업건 일정 전체 페이지 조회, 본인 응대 저장 직후 버전 대조, 기존 일정 변경 충돌 차단, 같은 UUID 영수증 복구, 별개 PC/mobile 복원 저장소.
- 이번 실행: 공통 입력 12개, SQL 37개, 클라이언트 10개, 저장 순서 11개 통과. 기존 경로(새 플래그 OFF)의 문의 브라우저 13개와 PC/mobile 브라우저 9개를 다시 실행해 통과했다. 새 플래그 ON인 브라우저 전체 저장 흐름은 미검증이다.
- 실제 다중 연결 PostgreSQL 동시성·기존 운영 트리거·알림 통합·실계정 저장은 미검증. 배포/운영 쓰기 0건.

## 최신 검증 결과 — 단계 1 일정 저장 보완

`MOBILE_STAGE1_SCHEDULE_CHECK_20261011.md`를 현재 상태로 따른다. 새 플래그 ON의 실제 PC/mobile 입력 + 합성 서버 브라우저 9개 통과. SQL 39개, 공통 입력 12개, 전송 10개, 저장 순서 12개 통과. PC 재진입 메모 손실 및 저장 전 차단 후 입력 잠금 수정. 고객 합의 일정의 내부 변경은 재합의 근거 경로가 준비될 때까지 클라이언트/SQL에서 거절한다. 위의 과거 'ON 브라우저 미검증' 기록은 이 실행으로 대체한다. 실제 운영 및 기기 간 동시성 검증은 여전히 미완료다.

## 최신 검증 결과 — 문의 일정 연결

`MOBILE_STAGE1_INQUIRY_CONCURRENCY_20261011.md`를 최신 상태로 따른다. 문의 조회 응답에 `inquiry_guard`와 `response_state`를 추가했다. 전자는 네 응대 진행 필드를 제외한 부모 및 모든 업무 행 지문이며, 제외한 네 필드는 이번 응대 ACK와 대조한다. 최종 쓰기는 여전히 전체 `expected_token`을 요구한다. SQL 45개, 문의 순서 12개, 문의 브라우저 28개, 기존 공통 검사 34개 및 PC/mobile 일정 브라우저 9개 통과. 서버·클라이언트 플래그 OFF, 미배포. 단계 진행을 포함한 전체 원자적 저장이나 실 DB 다중 연결 검증까지 완료한 것은 아니다.

## 최신 검증 결과 — 복합 요청의 고객 합의 보호

`MOBILE_STAGE1_SCHEDULE_OBJECTIVES_CHECK_20261011.md`를 후속 검증으로 따른다. 일정과 #550 후속 업무 이벤트의 출처를 비공개 함수 한 곳에서 대조한다. 현재 표시 근거와 과거 고객 약속 보호를 구분하며 제목·담당 등 현재 내용이 바뀌어도 고객 합의 이력을 일반 내부 일정 변경으로 무시할 수 없다. #550 테이블 없이도 기존 일정 SQL 검사는 통과한다. 공개 함수/열/허용 목록 추가 없음. 결합 SQL 75개, 독립 일정 SQL 45개, 문의 응대 SQL 16개 통과. 운영 설치·실계정·다중 연결 검증은 미완료, 기능 OFF.
