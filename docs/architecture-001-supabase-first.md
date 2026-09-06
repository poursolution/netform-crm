# ADR-001: Supabase 중심, n8n 비의존 CRM

결정일: 2026-09-05. 상태: **개발 기준 확정 / 운영 이전 미실행**.
이 결정은 이전 전환 계획의 '모든 조회·저장을 Edge로 이전' 기본안을 대체한다.

## 판단 순서

1. DB 조회인가? → 직접 Query 또는 안전한 View, 복잡한 집계는 RPC.
2. 독립적인 한 건의 저장인가? → 최소 권한·RLS·제약조건으로 보장되면 직접 저장.
3. 업무 규칙/여러 데이터 변경이 함께 필요한가? → 한 번의 DB RPC 트랜잭션.
4. 외부 API/비밀키/콜백/파일 가공인가? → Edge Function.

인증은 요청마다 로그인 화면을 거친다는 뜻이 아니다. Supabase Auth가 발급한 사용자
세션으로 각 Query/RPC/Storage/Realtime에 접근하고, 서버가 권한을 검사한다.

## 기능별 경계

| 기능 | 경로 | 필수 조건 |
| --- | --- | --- |
| 목록/대시보드 | Query / View / 집계 RPC | 필요한 필드·페이지 단위, 권한 내 집계 |
| 문의 배정·담당자 변경 | RPC | 실행자 권한 + 후보 적격 + 변경 사유 + 감사 이력 |
| Stage 변경 | RPC | 목표 단계 필수값 + 단계이력 + 파생 데이터 함께 저장 |
| Next 등록 | 직접 또는 RPC | 단독 일정은 직접 가능, 연기이력/기존 Action 교체/완료 활동 연계는 RPC |
| 활동기록 | 직접 또는 RPC | 단순 노트는 직접 가능, 유효접촉·관계상태·Next까지 바뀌면 RPC 또는 검증된 DB 트리거 |
| 확장관리 조회/전환 | 직접 조회 + 전환 RPC | 실제 견적 발송증명, 원 수주 보존, 새 Deal·Case·Activity 한 트랜잭션 |
| 고객자산 | View / RPC | Site 1개 아래 별도 Deal 유지 |
| 중복 정리 | 비교 조회 + RPC | 최신 미리보기·권한·잠금·이력·전체 롤백 |
| 파일 | 비공개 Storage | 사용자별 객체 경로 정책, 필요 시 서명 URL; 변환/검사는 Edge 등 서버 |
| PC/모바일 동기화 | Realtime | 변경 알림 후 해당 데이터 조회, 입력 폼 덮어쓰기 금지 |
| 문자·카카오/이메일 | Edge | 동의·수신거부·빈도·실행자 검증, 실제 공급자 결과 |
| 예약 | DB 일정 + Cron/작업자 | 내부 데이터 작업은 SQL/RPC, 외부 발송만 Edge |
| ASQ | 읽기 권한 있는 DB/API 또는 Edge | 외부 비밀키/공급자 인증은 서버에서 처리, ASQ 운영정보 정본 유지 |
| 대표보고 | View / Materialized View / RPC | 조직별 접근, 기준시각·집계갱신시각 표시 |

## 원자성의 범위

DB RPC 안의 새 Deal 생성·원 수주 연결·origin·확장 상태·Activity 저장은 함께
성공하거나 함께 취소한다. 브라우저가 이 순서를 각각 INSERT/UPDATE하지 않는다.

그러나 **이미 발송된 문자나 견적은 DB 롤백으로 취소되지 않는다.**
외부 발송은 대기작업 → 공급자 실행 → 검증된 결과 저장으로 분리한다.
실제 발송증명을 받은 뒤 전환 RPC가 새 Opportunity를 생성한다.
중복 요청에는 같은 결과를 반환하고, 새 요청 ID로 무조건 재발송하지 않는다.

## 보안

- HTML에는 publishable/anon 키와 사용자 세션만. service_role·DB 암호·공급자 키 금지.
- 실행한 사람(actor)은 auth.uid() 기반으로 확정한다. 선택된 담당자와 actor를 구분한다.
- 직접 수정 가능한 필드를 제한한다. 영업사원이 owner/team/role을 바꾸어 권한을 얻을 수 없어야 한다.
- RLS만 선언하고 끝내지 않는다. 테이블/View 접근권한과 RPC EXECUTE 권한을 각각 검토한다.
- SECURITY DEFINER는 RLS를 우회할 수 있다. 좁은 실행권한, 안전한 search_path,
  인증·조직·업무권한 검사 없이는 브라우저에서 호출 가능한 상태로 두지 않는다.
- View는 지원되는 환경에서 security_invoker로 사용자 권한을 따르게 한다.
  Materialized View를 원본 RLS가 자동 보호한다고 가정하지 않는다. 비공개 집계 후
  권한 검증 RPC로 필요한 결과만 제공한다.
- Realtime/Storage에도 각자 권한 정책을 적용한다. Data API의 검사만으로 보호됐다고 보지 않는다.
- 관리자/영업/지사 권한과 상담/실적귀속을 기존 사람 정본과 같은 기준으로 검사한다.

## 예약 데이터

기본 `scheduled_actions` 필드:

```text
id, opportunity_id, action_type, due_at(timestamptz), assignee_id, status
request_id(unique), attempts, locked_until, completed_at, last_error_code
```

- `status + due_at` 인덱스로 실행 시점이 된 작업만 묶음 조회한다.
- 예약 건마다 별도 Cron을 만들지 않는다. 적은 수의 작업자가 due 작업을 잠금 후 처리한다.
- 내 할 일/기한초과 화면은 DB 날짜로 계산할 수 있다.
- 앱을 닫아도 필요한 실제 발송/삭제/보고서는 서버 스케줄러가 실행한다.
- 반복 작업은 주기별 실행 식별자를 두고 이전 회차와 혼동하지 않는다.
- 운영 시간대는 Asia/Seoul, 저장/전송 시각은 명확한 timezone 포함. 달력상 1개월과 30일은 별도 규칙이다.
- 10만 건도 n8n 실행횟수와 무관하지만 DB·작업자·Realtime·외부발송 비용과 성능은 검증한다.

## Realtime

- Realtime은 변경을 알리는 수단이며 영구저장 성공 증거 또는 감사 원장이 아니다.
- 초기 조회, 재접속/세션 갱신 후 재조회, 충돌 처리 경로를 반드시 둔다.
- 필요한 테이블·조직 범위만 구독하고 화면/계정 종료 시 해제한다.
- 편집 중에는 '다른 곳에서 변경됨'을 표시하고 작성 내용을 덮어쓰지 않는다.
- 삭제/권한 회수 시 기존 캐시를 정리하고 서버에서 다시 접근권한을 확인한다.
- 연결/메시지 사용량도 측정한다. 무제한 무료 동기화로 가정하지 않는다.

## 공용 데이터 계층과 이전

PC와 모바일에 직접 SQL 규칙을 복제하지 않는다. 공용 데이터 모듈이 Query/RPC/Edge
호출과 오류·재조회·요청 식별자를 처리하고, 실제 권한과 업무 규칙은 DB/서버가 보장한다.

기존 crm-api/crm-write는 이전 완료까지 레거시로 표시한다. 기능별로 단 하나의 쓰기
경로만 활성화한다. 검증이 덜 된 새 기능은 차단 상태로 두고 n8n fallback을 추가하지 않는다.
기존 SQL 파일에 작성된 n8n 연결 지침은 배포 이력/레거시 참고이지 신규 기준이 아니다.

## 변경 요청마다 확인할 것

- [ ] n8n URL/웹훅/새 워크플로 의존성을 추가하지 않았는가?
- [ ] 단순 업무까지 Edge를 통과시키지 않았는가?
- [ ] 배정/단계/확장전환/병합이 단일 RPC인가?
- [ ] 권한 있는 정상 요청뿐 아니라 익명·다른 조직·부적격자 요청을 시험했는가?
- [ ] 중복/동시수정/실패/응답유실/재접속에도 일관적인가?
- [ ] n8n 요청을 차단한 시험 환경에서 조회·저장·첨부·발송 흐름을 검증했는가?
- [ ] PC 저장 → 모바일 조회, 모바일 저장 → PC 조회를 확인했는가?
- [ ] 집계 결과·개인정보·기존 미완료 요청을 보존했는가?
- [ ] DB 쿼리·Realtime 메시지·Edge 호출·발송비를 따로 측정하는가?

## 공식 근거

- [API 권한과 RLS, 함수 실행권한](https://supabase.com/docs/guides/api/securing-your-api)
- [Realtime Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
- [DB Functions](https://supabase.com/docs/guides/database/functions)
- [Cron](https://supabase.com/docs/guides/cron)
