# Canonical baseline 검증 — 2026-09-05

**Canonical baseline reproduction PASS / byte-identical reproduction NOT CLAIMED**

저장된 운영 원본과 실제 Staging after 스냅샷을 로컬에서 비교한 결과다. 이번 작업에서는 Production·Staging에 접속하거나 원격 DDL을 실행하지 않았다. 함수 재생성도 하지 않았다.

## 판정 근거

| 항목 | 기대값 | 실제값 | 판정 |
|---|---|---|---|
| 함수 canonical definition | 17개 일치 | 17개 일치 | PASS |
| raw definition 증거 | 차이 보존 | 13개 `newline_only_diff`, 4개 원문 동일 | 보존 |
| 그 외 캡처된 메타데이터 | diff 0 | diff 0 | PASS |
| 문자·공백 변경 | 거절 | 비교기와 SQL rollback guard 모두 거절 | PASS |
| ACL·config/search_path 변경 | 거절 | 비교기와 SQL rollback guard 모두 거절 | PASS |
| signature·security·owner·policy 변경 | 거절 | 비교기 거절; security·owner는 SQL guard도 거절 | PASS |
| config 배열 순서 변경 | 거절 | 비교기 거절, SQL에도 별도 exact 비교 유지 | PASS |
| 실제 after 형태 로컬 복원 후 COMMIT/재접속/rollback | before diff 0 | diff 0, 관리형 모형 객체 diff 0 | PASS |
| 로컬 테스트 | 실패·skip 없음 | **46 PASS / 0 FAIL / 0 SKIP** | PASS |
| 이번 작업의 원격 DDL | 0 | 0 | 준수 |

객체 수는 저장된 after 기준 table 18 / view 5 / function 17 / sequence 2 / constraint 63 / index 67 / trigger 8 / policy 2다. 이번에 새로 원격 조회한 수치가 아니다.

## 허용한 정규화의 정확한 범위

함수 `definition` 문자열에만 순서대로 적용한다.

```js
definition.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
```

PostgreSQL guard는 같은 규칙을 사용한다.

```sql
replace(replace(pg_get_functiondef(p.oid), chr(13)||chr(10), chr(10)), chr(13), chr(10))
```

공백·탭·들여쓰기·대소문자·기타 Unicode 줄 구분자는 변경하지 않는다. 함수 signature/config/security/owner/ACL, View 정의, policy와 다른 메타데이터에는 이 규칙을 적용하지 않는다. 기존 카탈로그 목록·ACL의 출력 순서 비교 방식은 유지하되 함수 config 배열은 순서까지 엄격하게 비교한다. 일반적인 SQL 의미 동등성 판정이나 다른 공백 정규화가 아니다.

비교기는 raw/canonical MD5를 각각 기록하고 실제 canonical 문자열 전체도 비교한다. canonical이 다르거나 다른 필드가 다르면 FAIL이다. PostgreSQL rollback guard는 canonical MD5와 나머지 원본 메타데이터를 검증한다. PostgreSQL 문자열 함수 근거: [PostgreSQL 17 문서](https://www.postgresql.org/docs/17/functions-string.html).

## 증거 보존 및 변경 파일

- 원본 `source-metadata.json`, 실제 `staging-after-apply-observed.json` 및 과거 `staging-apply-result.json`의 raw 차이 기록은 덮어쓰지 않았다.
- 원본 metadata MD5: `9872dac5bc6f60f19fc7c4a5514af0af`.
- 실제 after metadata MD5: `ee9a0407d84f3080bec238f368cc20fb`.
- [canonical-baseline-comparison.json](../sql/baseline/20260905/canonical-baseline-comparison.json): 함수별 source/actual raw MD5, canonical MD5, `newline_only_diff`, 전체 canonical diff.
- [canonical-rollback-local-result.json](../sql/baseline/20260905/canonical-rollback-local-result.json): 저장된 실제 after fixture의 로컬 재접속·rollback 결과.
- 비교기: `scripts/crm-baseline-metadata.cjs`.
- rollback 생성기: `scripts/build-crm-baseline-rollback.cjs`.
- 수정된 역 SQL: `sql/baseline/20260905/baseline-only-rollback.sql`.
- 회귀시험: `tests/crm-baseline-rollback.test.cjs`.

기존 승인·대상·빈 데이터·구조·ACL 가드, 명시적 객체 목록과 RESTRICT, transaction 및 복원 후 검증을 유지했다. 관리형 schema/extension/event trigger를 변경하는 구문을 추가하지 않았다. 역 SQL에는 함수 raw/canonical 해시 증거를 남기며, 원본 함수 본문 바이트는 원본 JSON에 그대로 보존한다.

해시 검증:

| 파일 | SHA-256 | 상태 |
|---|---|---|
| staging-apply.sql | `89dce8ae467f614a1857dca82b49a7d17cf5483da97d2540cd814c0d4a9ea2de` | 승인 파일 그대로 |
| public-baseline.sql | `1899adacb05b6fe07d187f76fe2fc57a1842be40fb73a47fad9a951eb5e4de78` | 변경 없음 |
| baseline-only-rollback.sql | `62bfdd8948eb84cda8e74bf466bfc08d8490e17abfc41768f32363f5607c3c73` | 로컬 guard 수정본, 원격 미실행 |

## 시험 재현

저장소 루트에서:

```powershell
node --test tests/crm-baseline.test.cjs tests/crm-baseline-rollback.test.cjs
```

결과: 46 tests / 46 PASS / 0 FAIL / 0 SKIP. 두 canonical 결과 JSON은 이 시험에서 생성된다. 시험은 로컬 PGlite 0.3.14 / PostgreSQL 17.5를 사용하며, 실제 Staging after metadata로 구성한 로컬 fixture를 COMMIT한 다음 연결을 닫고 다시 열어 역 SQL을 검증한다. 원격 17.6에서 rollback을 실행한 결과라고 주장하지 않는다. 관리형 환경은 로컬 모형이므로 hosted Supabase 전체 인증을 대체하지 않는다.

## 멈추는 지점

- **Staging baseline 구조 재현: Canonical PASS.** 바이트 동일 재현은 주장하지 않는다.
- **보안 PASS가 아니다.** 기존 취약 ACL까지 재현된 상태이며 실제 고객정보를 넣으면 안 된다.
- **Production: NO-GO 유지.** 실제 JWT·Storage·v2·전체 보안/복구 검증 완료를 의미하지 않는다.
- Auth 생성, 합성 seed, UUID 연결, v2, Legacy revoke, 프론트 변경, 배포 모두 이번 작업에서 미실행.
- baseline-only rollback은 데이터/seed/v2 이전 상태에 한정되며 이후 단계의 전체 rollback이 아니다.

사용자 요청대로 로컬 비교기·guard 검증과 보고까지만 완료하고 멈춘다.
