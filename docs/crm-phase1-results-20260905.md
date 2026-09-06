# Phase 1 F02–F06 — 구현 및 검증 결과

**판정: NO-GO. 공통 엔진은 Staging 적용 및 시험을 진행했지만, Phase 1 EXACT_PARITY 완료는 아니다.**

제품 정본은 Golden `6c1b570b8d79f908a7340292944acf96cecc9d68` + 사용자 승인 최신 local overlay다. 확장관리는 `Closed Won → 확장관리 Pool → 실제 견적 발송 → 새 Opportunity`를 유지한다. 기존 Closed Won Deal을 재개하지 않는다. Campaign/ASQ/데이터정리/Next Picker/메시지 호칭/이슈 모달/eligibility를 제거하지 않았다.

## 적용 범위와 실제 결과

- **Staging `rprechiaglyjaydkmxsu`만 사용. Production 접속/변경 0, 운영 Pages 배포 0, Legacy ACL/RLS 변경 0.**
- `crm_profile_scoped_v2()`에 서버가 확정한 `source_role`, `allowed_modes` 추가. 기존 `auth_uid/user_id/permission_role` 유지.
- `crm_write_command_v2(uuid,text,uuid,integer,jsonb)` 추가. 이번에는 기존 `opportunity_work_set`만 허용하며 신규 업무 Action은 만들지 않았다.
- 비공개 `crm_security.command_receipts` 추가. 요청 ID는 Auth UUID별로 격리하고 동일 요청 재시도는 동일 ACK/감사 ID를 반환한다. 요청 ID 재사용·버전 충돌은 HTTP 409. 클라이언트 actor 인자는 거절한다.
- 생성과 같은 transaction에서 PUBLIC/anon/service_role EXECUTE 회수, authenticated에는 승인된 entrypoint만 허용. owner=postgres, 고정 search_path, effective ACL 검사. private 장부는 RLS ON, 직접 grant 없음.
- v2 authenticated SECURITY DEFINER allowlist는 현재 `crm_profile_scoped_v2()`, `crm_read_scoped_v2(uuid,integer,uuid,uuid)`, `crm_contacts_scoped_v2(uuid)`, `crm_work_set_scoped_v2(uuid,text,jsonb,text,integer,text)`, `crm_write_command_v2(uuid,text,uuid,integer,jsonb)` 5개다. Legacy 공개 함수는 별도 미해결 위험이며 전체 anon 접근 0을 주장하지 않는다. `supabase_admin`은 계속 `PLATFORM_MANAGED_RESIDUAL`; managed role/default를 변경하지 않았다.
- 실행 전 public/private metadata diff **0**. 실행 후 예상 public/private metadata diff **0**. baseline newline canonicalization 이외의 정규화는 추가하지 않았다.
- 적용 SQL SHA-256: `9d3c7c234d7f7f314192b47151d644dd3f1c50e6fabd1e80d25b68511441523d`.
- 첫 시도는 SQL 묶음 생성기의 dollar-quote 치환 오류로 파싱 단계에서 거절됐다. 수정 후 **실제 생성된 파일** 적용/rollback 시험을 추가하고 재실행하여 COMMIT 성공을 확인했다.

| 항목 | 적용 전 | 적용 후 |
|---|---:|---:|
| public baseline tables | 18 | 18 |
| public views | 5 | 5 |
| public functions | 21 (Legacy17 + v2 4) | 22 |
| 합성 Auth 사용자 | 6 | 6 |
| public.users / deals | 6 / 5 | 6 / 5 |
| v2 audit_events | 3 | 4 |
| Phase1 command_receipts | 없음 | 1 |

실제 공종 쓰기 시험은 Rep A의 기존 공종 값을 그대로 전송했다. **분류 값은 유지, version 4→5, audit 1행 및 receipt 1행 추가**가 의도한 시험 영향이다. 동시 요청 2개와 후속 재시도가 동일 감사 ID를 반환했다. 감사 actor는 Auth `b5295979-d6c9-48f2-971a-2dea418b75e6` / CRM `f6090500-0001-4000-8000-000000000001`로 서버가 확정했다.

증거: [deployment-evidence](../sql/phase1/deployment-evidence.json), [실제 ACK](../sql/phase1/staging-command-proof.json), [최종 상태](../sql/phase1/staging-final-state.json).

## 기존 화면 연결 — 축약 CRM 아님

`staging-phase1/`에 현재 root HTML/JS/CSS 24개를 복제하고, AST 기준 인증/조회/큐 함수 16곳을 수정했다. 원본 `crm.html/mobile.html/index.html` 및 root overlay 파일은 이 작업에서 수정하지 않았다. [원본/복제본 해시 및 patch 목록](../staging-phase1/source-manifest.json)을 보존했다. 예전 `staging/` 축약 prototype은 사용하지 않았다.

- 기존 PC·모바일 이름 로그인 폼/메뉴/모달/업무 코드를 유지. Staging 로그인 주소만 합성 `example.invalid` 계정으로 매핑한다. 이름은 로그인 주소 찾기와 표시용이며 권한은 서버 UUID/승인장부로 판단한다.
- 기존 비밀번호의 **숫자만 남기는 처리 제거**. 랜덤 합성 비밀번호의 대소문자/특수문자를 보존한다. 전화번호 비밀번호 안내도 Staging 복제본에서 수정했다.
- `public.users` 이메일 조회 대신 profile RPC만 사용.
- Auth 세션은 `sessionStorage`, 앱 cache/queue는 `localStorage`에 `environment/ref/Auth UID/contract version` namespace로 분리. auth locator는 UID만 가진 project/version boot 인덱스다.
- 재로그인/계정변경/로그아웃은 이전 앱 cache/queue와 Auth 저장값을 삭제한다. 운영의 unnamespaced 저장값은 **읽지도 삭제하지도 않는다**. 다중 탭은 BroadcastChannel로 무효화하도록 구현했으나 실제 브라우저 다중 탭 시험은 미완료다.
- 사용자 변경 중 응답은 generation 검사로 폐기한다. ACK identity/object/version 불일치는 저장 완료로 처리하지 않는다. 응답 유실은 같은 요청 ID로 재시도, 충돌/권한 오류는 완료로 승격하지 않는다.
- 네트워크 guard는 승인된 Staging Auth 및 entry RPC만 허용한다. Legacy table/view/RPC/n8n fallback은 금지한다. Realtime/Export/Storage는 이번 단계에서 연결하지 않았다.
- F05는 목적별 envelope 및 단일 대상 `work_items` reader만 연결했다. 미구현 업무 resource는 `coverage=unavailable, data=null`이다. `crm_bundle_v2`나 임의 전체 B 객체를 만들지 않았다.
- 로그인 이후 기존 업무 데이터 영역에는 **계약 미연결**을 명시한다. 기존 UI 소스를 보존한 것과 업무 기능이 동작하는 것은 다르며, 이 상태를 기능 축소 완료/Parity PASS로 간주하지 않는다.
- 개발 서버의 CSP는 **로컬 Staging 전용 네트워크 격리**다. inline은 기존 그대로이며, 운영 CSP 전환 또는 XSS 해결을 주장하지 않는다.

## 시험 수준을 구분한 결과

| 시험 | 실제값 | 무엇을 증명하는가 |
|---|---|---|
| 로컬 DB + transport 시험 | **22 PASS / 0 FAIL / 0 SKIP** | ACL/ACK/409/actor/계정 교체/저장소/응답유실/rollback |
| Golden/승인 Overlay·Matrix 회귀 | **5 PASS / 0 FAIL** | 원본 해시 보존, 상태/근거/업무 목록 보존 |
| 실제 Staging JWT RPC 시험 | **10 PASS / 0 FAIL** | 6계정 profile, anon 거절, 타 담당/상담 write 거절, 동시 멱등성, audit UUID, version |
| 원본 복제 HTML + 실제 JWT (JSDOM) | **12 PASS / 0 FAIL** | PC/모바일 × 6계정 로그인/프로필/로그아웃, Rep A 세션복원, 모바일 관리/내 영업 버튼 |
| 실제 브라우저 | **로그인 화면 로딩만 확인** | PC/모바일 기존 화면과 로그인 폼 존재. 인증 후 회귀 PASS는 아님 |
| ADMIN_MFA | **AAL1 / MFA_NOT_ENROLLED** | AAL2 성공으로 처리하지 않음 |
| 실제 hosted rollback | **미실행** | 로컬 rollback 시험과 구분 |

JSDOM 및 RPC 시험 중 관측된 Production 요청 0, Legacy/n8n 요청 0. 실제 브라우저 **인증 후** network log 0건 조건은 아직 미검증이다. 위 결과를 하나의 '전체 보안 PASS' 숫자로 합산하지 않는다.

브라우저 도구는 저장소 밖 보호된 합성 비밀번호 파일을 읽는 단계에서 EPERM으로 거절됐다. 비밀번호를 채팅/저장소/임시 웹 endpoint로 옮겨 우회하지 않았다. 별도 승인된 테스트 프로세스에서는 기존 private 파일을 읽고 실제 Auth 로그인했으며 토큰/비밀번호는 결과 파일에 기록하지 않았다. **브라우저 인증 접근이 해결되기 전 실제 브라우저 Parity는 미완료**다.

추가로 현재 PC 원본은 `dashboard-hierarchy.js`, `dashboard-hierarchy.css`를 참조하지만 파일이 없다. 두 참조를 지우거나 임의 대체 구현으로 통과시키지 않았다.

## F02–F06 Matrix 갱신

| 행 | Phase1 구현 | 상태 | 남은 Gate |
|---|---|---|---|
| F02 | 원본 폼 → Auth → scoped profile 연결 | TEST_MISSING | 실제 브라우저 6계정/승인거절/이름변경 |
| F03 | session restore/logout, cache/queue 격리 | TEST_MISSING | 실제 브라우저 refresh 만료/계정교체/다중 탭 |
| F04 | source/permission/mode 매핑 및 모바일 모드 연결 | TEST_MISSING | dual 실제계정 없음; PC 역할별 홈과 브라우저 회귀 |
| F05 | 목적별 read transport contract 확정 | CONTRACT_MISSING | 전체 기능 행 기준 업무별 reader/동기화/진단은 후속 범위 |
| F06 | 공통 ACK/queue/idempotency/version Staging 검증 | CONTRACT_MISSING | 기존 업무 handler의 expected_version 전달 및 생성 RPC의 서버 UUID 채택 미연결 |

현재 기존 공종 편집 handler는 expected_version을 보내지 않으므로 새 queue는 이를 거절한다. 서버 최신 버전을 몰래 읽어 덮어쓰거나 성공 토스트만 띄우는 방식으로 맞추지 않았다. 실제 UI Action 연결은 적절한 read/version 계약과 함께 남아 있다.

85행의 현재 상태: **EXACT_PARITY 0 / V2_IMPLEMENTED_NOT_UI_CONNECTED 1 / CONTRACT_MISSING 77 / UI_MISSING 0 / TEST_MISSING 7**. 기존 controls inventory는 최초 조사 증거이며, 최신 F02–F06 판단은 갱신된 feature Matrix와 이 보고서가 정본이다.

## Rollback과 재현 방법

- [Phase1 rollback](../sql/phase1/rollback.sql)은 profile을 정확한 이전 정의로 복원하고 새 wrapper만 제거한다. baseline18/5/17, 기존 v2, Auth, CRM 및 기존 감사행을 삭제하지 않는다.
- receipt가 비어 있으면 새 table을 제거한다. receipt가 있으면 `crm_phase1_archive`로 옮겨 비공개로 보존한다. 따라서 **현재처럼 receipt가 존재하면 의도된 archive가 남으며 DB 전체 byte-identical 복구를 주장하지 않는다**.
- public/crm_security before metadata guard는 복구 후 일치한다. 승인된 추가 archive 이외의 drift는 거절한다.
- 로컬에서 COMMIT 후 DB를 닫고 다시 열어 rollback 실행 성공. populated receipt + audit + CRM/Auth 보존 시험도 통과. Staging rollback은 실행하지 않았다.
- 재실행/다른 프로젝트/기존 archive/예상 외 schema면 중단한다. migration 폴더 전체를 `db push`하지 않는다.

로컬 재검증:

```powershell
node --test tests/crm-phase1-db.test.cjs tests/crm-phase1-transport.test.cjs
node scripts/build-phase1-ui.cjs
node scripts/serve-phase1.cjs
# 아래는 기존 private 합성 자격증명이 필요하며 Staging만 사용한다.
node scripts/verify-phase1-staging.cjs
node scripts/verify-phase1-ui-dom.cjs
```

`verify-phase1-staging.cjs`를 다시 실행하면 새로운 요청 UUID를 사용하므로 합성 Deal version/audit/receipt가 추가로 1회 증가한다. 증거 수집을 목적으로 불필요하게 반복하지 않는다.

## 종료

**Phase1 부분 구현 완료 / 실제 브라우저 Parity 미완료 / Production NO-GO.** F07 이후, Legacy revoke, 운영 배포, Storage/Export/MFA enrollment는 진행하지 않았다. 다음 진행 조건은 누락된 최신 overlay 두 파일 확인, 브라우저의 보호된 합성 인증 접근 해결, F02–F06 남은 UI/version/세션 회귀다. 아직 다음 업무 Phase나 Legacy 차단으로 넘어가지 않는다.
