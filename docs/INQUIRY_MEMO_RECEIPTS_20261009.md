# 과거 메모 판단 — 재전송 방지 서버 보완

기준: netform-crm master `67ee6248cbc906d2d52cb5dcec2c9d178a99a3dc` (#536).
범위: 서버 SQL, 실패·재전송 검사. 화면·CSS·표시 위치·운영 원자료를 변경하지 않는다.

## 문제와 변경

기존 서버는 판단 행의 마지막 `request_id`만 비교한다. A(미완료) → B(완료) → A 재전송 시 A가 다시 실행돼 B를 덮어썼다.

`crm_security.inquiry_memo_receipts`에 문의 ID + 요청 ID별 영수증을 보관한다. 같은 문의의 기존 행 잠금 안에서 판단, 감사 이력, 영수증을 함께 저장한다. 하나라도 실패하면 모두 취소된다. 다음 할 일(`next_set`)까지 이 트랜잭션에 포함한 것은 아니다.

- 현재 판단과 같은 요청·내용·작성자의 재전송: 현재 확인 응답을 반환하고 다시 쓰지 않는다.
- 이미 처리한 이전 요청의 재전송: 최신 판단을 유지하고 오류를 반환한다. 과거 성공 응답을 반환해 화면까지 되돌리지 않는다.
- 같은 요청 ID에 다른 결과·날짜·원문·제목·항목·작성자: 거절한다.
- 재배정·휴지통·권한 변경: 영수증 조회 전에 현재 접근 권한을 재검사한다.
- 새 감사 기록에는 `request_id`도 남긴다. 기존 감사 기록은 재작성하지 않는다.

영수증은 비공개 스키마에 두고 RLS를 켠다. `PUBLIC`, `anon`, `authenticated`의 표 직접 접근을 금지한다. 기존 RPC의 역할·담당 검사와 빈 search_path를 유지한다. 새로운 공개 RPC나 권한 확대는 없다.

## 변경 파일·서버 칸

| 파일 | 변경 |
|---|---|
| `sql/inquiry-memo-review-v1-20261008.sql` | 영수증 표, 현재 마지막 요청 이관, 기존 쓰기 RPC의 재전송 검사. 전체 설치 SQL을 트랜잭션으로 묶음 |
| `tests/inquiry-memo-receipts.test.cjs` | 실제 PGlite SQL 실행으로 재전송·내용 충돌·권한·실패 롤백·설치 재실행 확인 |
| `tests/inquiry-memo-runtime.test.cjs` | 동일 요청 재시도는 동일 본문을 쓰도록 기존 검사 보완 |
| `tests/inquiry-memo-ack.test.cjs` | 이전 요청 거절 후 화면의 서버 확인값·완료 이력 보존 |
| `package.json` | 새 검사를 필수 Quality Gate에 연결 |

영수증 칸: `inquiry_id`, `request_id`, `actor_user_id`, 정규화 `payload`, `legacy`, `created_at`.
기존 RPC `crm_inquiry_memo_review_v1`과 `crm_inquiry_memo_review_list_v1`을 유지하므로 RPC 허용 목록·오류 이름·CRMRelease 함수 존재 검사는 이미 연결된 경로를 그대로 쓴다. 함수 존재만으로 이 보완 버전의 설치까지 증명하지는 않는다.

## 적용 전 반드시 구분할 범위

1. 설치 당시 현재 행에 남은 마지막 요청은 영수증으로 보존한다. `original_at`은 과거 원본값 보존 과정에서 요청값과 다를 수 있어 이관 영수증에서만 비교 대상에서 제외한다.
2. **설치 전에 덮어써진 요청 ID는 과거 감사 이력에 없어 복원할 수 없다.** 이 영수증에 없는 과거 요청까지 모두 차단한다고 설명하지 않는다. 운영 적용 전 기존 전송 대기·진행 중 저장을 확인하고, 사용자 판단 없이 대기 자료를 일괄 삭제하지 않는다.
3. SQL 적용 순간 실행 중인 구버전 쓰기 호출은 별도 확인 대상이다. 운영 적용은 쓰기가 진행되지 않는 시점에 하고 적용 후 열린 클라이언트를 갱신한다. 기존 대기 자료 검토가 끝나지 않았으면 운영 완료로 보고하지 않는다.
4. 미완료 판단과 다음 할 일 등록의 원자 처리, 별개 약속의 독립 업무 ID·기한 연결은 후속 범위다. 이 SQL은 문의의 다음 행동이나 계약실적을 수정하지 않는다.
5. 고객 데이터 일괄 수정·발송·n8n 추가 없음. 이번 문서는 설치 승인이나 설치 완료 기록이 아니다.

## 검증과 배포 순서

1. 필수 CI 통과 확인.
2. 위 기존 대기·진행 중 저장 조건 확인 후, 운영 SQL 적용을 별도로 승인받는다.
3. `sql/inquiry-memo-review-v1-20261008.sql` 전체를 적용한다. 오류 시 트랜잭션을 롤백한다. 일부 구간만 실행하지 않는다.
4. 아래 읽기 전용 확인으로 영수증 표·RLS·권한·함수 본문을 검증한다. 실제 고객 판단으로 테스트하지 않는다.
5. 서버 적용 결과를 기록하고 PR 병합·배포를 진행한다. 적용 전 기능 완료로 표시하지 않는다.

```sql
select to_regclass('crm_security.inquiry_memo_receipts') as receipts;
select relrowsecurity from pg_class
where oid='crm_security.inquiry_memo_receipts'::regclass;
select r, has_table_privilege(r,'crm_security.inquiry_memo_receipts','SELECT,INSERT,UPDATE,DELETE') as direct_access
from unnest(array['anon','authenticated']) r;
select md5(pg_get_functiondef('public.crm_inquiry_memo_review_v1(jsonb)'::regprocedure)) as function_hash,
 position('inquiry_memo_receipts' in pg_get_functiondef('public.crm_inquiry_memo_review_v1(jsonb)'::regprocedure)) > 0 as uses_receipts;
```

로컬 검증은 합성 PGlite와 Node에서 한다. 실제 다중 세션 부하 테스트·운영 쓰기 테스트와 구분한다. 기존 문의 행 잠금과 영수증 복합 기본키로 같은 문의의 저장을 직렬화한다. 고객 첫 연락 시각·원본·실적을 보존하는 기존 회귀 검사도 유지한다.

참고: [Supabase 함수 보안](https://supabase.com/docs/guides/database/functions), [PostgreSQL 행 잠금](https://www.postgresql.org/docs/current/explicit-locking.html). 2026-09-25 Supabase 변경 기록의 ltree·구형 암호·GiST·사용자 연산자 변경은 이 SQL의 사용 기능에 해당하지 않는다.
