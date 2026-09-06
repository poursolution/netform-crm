# Personal state compatibility — apply-ready local bundle

상태: `LOCAL_APPLY_READY / STAGING_CANONICAL_PREFLIGHT_PASS / TARGET_GUARDS_READY / NOT_APPLIED`

## 2026-09-06 Staging read-only preflight

정확한 대상 `netform-crm-staging / rprechiaglyjaydkmxsu`에서 catalog만 읽었다. public Dispatcher OID `18115`, scoped read OID `18064`, frozen Dispatcher OID `18077`, unassign helper OID `18112`, ACL/config와 기존 4-op receipt constraint는 확인됐고 personal object는 모두 부재했다. 원문 definition MD5는 로컬 PGlite snapshot과 달랐지만, 문자열·quoted identifier를 보존하고 주석/공백만 제거한 전체 SQL 토큰 비교에서 네 함수 모두 토큰 수와 순서가 완전히 일치했다. 따라서 실제 함수 drift가 아니라 source formatting 차이로 확정했다. 적용 가드는 현재 Staging 원문 MD5/OID를 exact baseline으로 사용하고, rollback은 캡처한 live read definition을 복원한다. 적용은 하지 않았고 DDL/DML, Production, n8n 요청은 0이다.

## 범위

T03의 현재 PC/mobile 동작만 기존 단일 `public.crm_write_command_v2`와 `crm_read_scoped_v2`에 연결한다.

- `favorite_set`
- `opportunity_touch` (`touch_kind=view|work`)

T01/T02 첨부 Storage, 다른 미연결 op, Production/n8n/운영 Pages는 포함하지 않는다. 이 작업에서 원격 접근과 Staging DDL/DML은 수행하지 않았다.

## 적용 파일

- DB: `staging-apply.sql`
- DB rollback: `rollback.sql`
- UI source 최소 변경: `ui-minimal.diff`
- 변경 후 generator용 완성본: `operational-adapter.candidate.js`, `operational-overlay.candidate.js`
- 해시/정본: `manifest.json`

`ui-minimal.diff`는 `sql/operational-ui/20260906` generator source에 적용한 뒤 기존 `build.cjs`로 `staging-operational`을 다시 생성하는 용도다. generated `staging-operational` 파일은 이 bundle에서 직접 수정하지 않는다.

## Dispatcher 합성

현재 배포된 4-op public Dispatcher는 삭제·재작성하지 않는다. 동일 함수 객체를:

```text
public.crm_write_command_v2
  -- RENAME + SET SCHEMA, OID/body/config 보존 -->
crm_security.crm_write_command_v2_operational_20260906
```

로 이동하고 직접 EXECUTE를 모두 회수한다. 새 public wrapper는 personal op 두 개만 private helper로 보내고, 나머지는 이동된 4-op Dispatcher에 그대로 위임한다.

```text
public.crm_write_command_v2
  ├─ favorite_set / opportunity_touch
  │    -> crm_security.crm_user_opportunity_state_command_v2
  └─ all other operations
       -> exact moved operational 4-op Dispatcher
```

적용 전 live guard는 다음을 강제한다.

- project ref `rprechiaglyjaydkmxsu`
- canonical token equivalence가 확인된 현재 operational public Dispatcher/read/frozen/unassign helper의 exact live definition MD5
- owner, `SECURITY DEFINER`, empty search path, exact ACL
- 기존 2-op frozen Dispatcher OID `18077`
- scoped read OID `18064`, current Dispatcher OID `18115`, unassign helper OID `18112`
- 현재 4-op receipt constraint
- 새 helper/table/archive 부재

현재 4-op public Dispatcher OID와 원문 MD5는 `staging-live-baseline.json`에 고정했다. apply transaction이 시작될 때 body/config도 temp guard에 다시 캡처하고, 이동된 private delegate가 같은 OID/body/config인지 DDL 직후 검증한다. 전체 schema snapshot MD5는 PostgreSQL/PGlite의 catalog 직렬화 차이로 오탐하므로 사용하지 않고, 변경 대상 함수·table·constraint·ACL만 fail-closed 검증한다.

## 저장 계약

`crm_security.user_opportunity_state`의 PK는 `(actor_user_id,deal_id)`다. 모든 클라이언트 `user_key`, `touched_at`은 compatibility 표시 입력일 뿐 정본으로 사용하지 않는다.

| op | canonical payload | 서버 효과 |
|---|---|---|
| `favorite_set` | `{favorite:boolean}` | 현재 JWT와 매핑된 CRM user의 favorite를 upsert |
| `opportunity_touch` | `{touch_kind:'view'|'work'}` | server clock으로 해당 timestamp 갱신; view만 view_count 증가 |

두 op는 Deal 업무 version을 변경하지 않으므로 `p_expected_version=0` sentinel만 허용한다. `can_deal(deal,false)` 범위 내에서만 개인 상태를 쓸 수 있다. table은 private schema + RLS enabled + 모든 browser/service role direct grant revoked다.

기존 `crm_security.command_receipts` allow-list에 두 op를 추가한다. receipt payload는 client authority 필드를 제거한 canonical payload다. 같은 actor/request/canonical payload는 replay ACK를 반환하고, 다른 op/object/payload 재사용은 `PT409`다.

ACK는 기존 공통 필드와 다음 결과를 유지한다.

```text
{ok:true, contract_version:1, request_id, operation, object_id,
 actor_auth_uid, actor_user_id, favorite, touch_kind,
 last_viewed_at, last_worked_at, view_count, server_at, replayed}
```

## scoped read-back

기존 Deal projection 필드와 Inquiry projection은 그대로 두고 각 authorized Deal에 현재 actor의 다음 필드만 추가한다.

```text
favorite, last_viewed_at, last_worked_at, view_count
```

상태 row가 없으면 `favorite=false`, `view_count=0`, timestamps는 null이다. 다른 actor의 private state는 join 조건상 반환되지 않는다. PC shell은 spread mapping으로 필드를 보존하고, mobile overlay에는 명시 필드 mapping을 추가한다.

## PC/mobile normalization

현재 UI payload:

```text
favorite_set:      opportunity_id, user_key, favorite
opportunity_touch: opportunity_id, user_key, touch_kind, touched_at
```

Adapter는 `opportunity_id` 일치만 확인하고 `user_key/touched_at`을 제거한다. overlay는 두 op에 version 0을 사용한다. ACK가 오면 PC `B.deals`와 mobile `DEALS`의 personal state를 서버 결과로 갱신한다. 기존 10분 view debounce와 optimistic button UX는 유지한다.

## Rollback

Rollback은 새 public wrapper와 helper를 제거하고 이동해 둔 exact 4-op Dispatcher를 같은 OID로 public에 되돌린다. read projection과 receipt allow-list도 4-op 상태로 복원한다.

업무 증거는 삭제하지 않는다.

- personal state table은 `crm_personal_state_archive`로 이동
- 두 operation receipt는 archive table로 복사 후 active receipt에서 제거
- archive schema/table direct ACL은 모두 닫힘

Rollback 후 기존 4-op Dispatcher body/config/ACL, 기존 2-op frozen Dispatcher, unassign helper와 read definition은 적용 전 snapshot과 같아야 한다.

## 적용/검증 순서

1. manifest/source/apply/rollback/UI diff 해시 확인
2. Staging project ref와 current catalog OID/definition/ACL/config/constraint live guard 통과
3. `staging-apply.sql` 단일 transaction 적용
4. generator source에 `ui-minimal.diff` 적용 후 `sql/operational-ui/20260906/build.cjs`로 UI 재생성
5. JWT로 같은 계정 PC↔mobile favorite/read-back, view/work server time, account isolation, revoked Deal, replay/reuse 확인
6. 기존 frozen 4-op JWT 회귀 전부 재실행
7. private receipt exact count는 별도 authorized read-only evidence로 확인

로컬 DB/UI 시험 통과는 Staging PASS가 아니다.
