# Parity 누락 목록·UX 동결 — 2026-09-05

이번 단계는 **Inventory/Matrix 작성만**이다. 원격 SQL·Auth·seed·기존 UI 연결/배포를 하지 않았다. 이전 요청으로 작성하던 `staging/` 축약 화면, `sql/business-v2/`, `20260905140050_crm_v2_business_contracts.sql`은 **미적용·보류 초안**이며 승인된 전환본이 아니다. 6개 로컬 DB 시험 통과는 기능 Parity 증거가 아니다.

## 1. 가장 먼저 고정할 기준

원격 `master`는 GitHub API 실측상 `6c1b570b8d79f908a7340292944acf96cecc9d68`이다. Git object를 읽어 검토했으므로 현재 dirty 파일을 운영 코드와 섞지 않았다. 이 작업에서는 GitHub Pages를 실행하거나 운영 Supabase/n8n에 접속하지 않았다.

| 대상 | Golden commit | 현재 로컬 overlay | 보존 원칙 |
|---|---|---|---|
| PC 기본 진입 | `G.page='dash'`, 대시보드 | 오늘 홈/분석 대시보드 분리 | 사용자 최신 요구에 따라 기존 화면을 유지. 어느 판본인지 Matrix에 명시하고 임의로 합치거나 삭제하지 않음 |
| PC sidebar 정적 마크업 | 11개 항목 | 15개 항목 | 동적 라벨/권한 노출은 별도 회귀. 정적 개수가 런타임 메뉴 수를 보장하지 않음 |
| 확장관리 | `STAGE_MASTER.expansion` 및 Pipeline/모바일 expansion 동작 | Closed Won 뒤 별도 Pool, 실제 견적 발송 증거 뒤 신규 sent Deal | 사용자 최신 요구는 Pool 흐름 보존. 운영 커밋과의 차이를 명시하고 보안전환으로 Stage를 임의 삭제하지 않음 |
| 데이터 정리 | 중복현장/비교·병합 전 상태 | Preview/fingerprint/원본보존 Site 연결·문의정리센터 | 단순 dup 조회로 로컬 정리 기능까지 이식됐다고 표시하지 않음 |
| 서버 읽기 | n8n `crm-api` + 캐시 | `crm-read.js` → `crm_read_bundle()` v1 candidate | 실제 Staging v2와 둘 다 다른 응답 계약 |
| 캠페인·ASQ·지원 관리 | 기본 커밋에 해당 신규 계약 없음 | UI·SQL·README 추가 있음 | 로컬 변경을 보존하되 운영 배포/서버 동작 완료로 오인하지 않음 |

메뉴 구조, 대시보드, Stage/SLA/확률, 문의 흐름, 사업유형, 공종 구조, 담당자 분류, KPI 분모/금액, 경남 분리, 기술자문 경계, 메시지, Next, 확장, 자산, 중복 처리, 모바일 및 모달 Action을 동결한다. 기능이 새 v2에서 불가능하면 숨기는 대신 누락으로 남긴다.

**보안 정책 예외는 Parity와 분리한다.** 기존 전화번호 비밀번호 관행과 무제한 전체 JSON/큐 다운로드의 취약 동작까지 재현하는 것이 목표가 아니다. 기존에 승인된 UUID·권한·MFA/Export 보안 요구를 유지하되 화면/업무 변화가 필요한 부분은 명시하고 별도로 검토한다. 이 보고서 작성 중 로그인/Export 구현은 바꾸지 않았다.

## 2. 실제 v2와 필요한 데이터의 차이

증거: 저장된 실제 Staging [`staging-final-public.json`](../../sql/v2-owned/20260905/staging-final-public.json). 새 원격 조회는 하지 않았다.

| 현재 entry | 실제 반환/처리 | 기존 업무에 부족한 것 |
|---|---|---|
| `crm_profile_scoped_v2()` | Auth UUID, CRM UUID, name, permission_role | 원본 로그인/dual 모드 어댑터, 상담/지사/본사 Master 투영 |
| `crm_read_scoped_v2(...)` | Deal: id/site_id/owner_id/stage_code/brand/primary_work/work_items/version. 문의: id/assigned_to/site_name/status | 금액 3종, 날짜/이력/Next/연락처·동의, 지사/원천 분류, 상담자, KPI/보고서 데이터, 첨부/견적/인계·Site 계층 등 |
| `crm_contacts_scoped_v2(uuid)` | Deal.contact_id에 연결된 contact의 id/name/phone/mobile | 여러 연락처·관계역할·직함·동의/거부·재직/이동 이력. 최소 조회 격리는 통과했지만 기능 계약은 미완성 |
| `crm_work_set_scoped_v2(...,p_actor_name)` | 허용 Deal 공종, version, 서버 actor 감사 | 원본 공종 editor 미연결. actor 제거 5인자 signature는 로컬 초안에만 있으며 원격 교체하지 않음 |

v2 JWT 11/11 PASS는 위 보안 경로 격리 시험이다. 네 RPC로 전체 CRM의 역할·화면·업무가 완성됐다는 뜻이 아니다.

## 3. 보류한 작은 업무 RPC/축약 UI가 Parity가 아닌 구체적 이유

1. **단계 변경**: 원본 `confirmTransition()`은 한 일, 결과, 담당자, 변경근거, 다음 행동, 기한, 종료사유, 특정 단계 금액을 검증한다. 초안은 stage/reason 중심이며 원본 history·연관 저장·수주/실주 의미를 모두 보존하지 않는다.
2. **금액**: 원본은 예상/견적/수주 금액과 수주일·기간을 구별한다. 초안 단일 `amount` 집계/수정으로는 KPI/예상매출을 그대로 재현할 수 없다.
3. **문의**: Control Center의 기술문의/휴지통 제외, 본사6명 배정, 경남 미지정 Pool, 회수/보류/전환/원문 보존이 작은 status/assign RPC에 없다. 상담담당과 영업담당도 분리해야 한다.
4. **Next**: 원본의 상세 유형/담당/완료/연기·횟수 및 로컬 공용 8분류를 초안 4유형이 대체하지 못한다.
5. **모바일 오늘**: 원본 최종 `buildToday()`는 새 문의·새 Deal, 기한초과, 이번 주 방문, 오늘, 수주근접, Next 없음, 정체를 우선순위로 합친다. 초안 due bucket 조회만으로는 동등하지 않다.
6. **감사/활동**: 새 private `business_events`에 쌓기만 하면 기존 activity/단계/배정 Timeline과 KPI 소비자가 그 사실을 읽지 못한다. actor UUID는 유지하되 데이터 의미와 read projection을 함께 맞춰야 한다.
7. **화면**: 새 `staging/crm.html`/`mobile.html`은 5개 단순 메뉴의 시험용 초안이다. 원본 sidebar, 카드, Kanban/분할, Drawer/Sheet, 모달/버튼을 대체하는 제품으로 채택하지 않는다.

## 4. 누락 작업 묶음 (상세는 Matrix F/L ID)

| 묶음 | 누락 ID | 다음에 설계할 최소 계약/검증 |
|---|---|---|
| 정본/공통 | F01–F06, F68, L01/L17 | 원본 UX 그대로 client transport만 교체, profile/role mapping, 목적별 read projections, explicit ACK/idempotency/격리 큐 정책 |
| 대시보드/실적 | F07–F11, F57–F61 | 기존 계산식을 합성 Golden fixture의 oracle로 고정. 금액/기간/Stage이력/분모/branch 포함·제외/partial 상태 일치 |
| 견적문의 | F12–F21, L13 | 배정/회수/보류/응대/전환/휴지통/복원/중복 각각 auth-aware transaction. 원본과 상담자/영업자·이력 보존 |
| 경남/자문 | F22–F26 | team/reporting_group/미지정 Pool와 실제 UUID Master, 상담브랜드≠Pipeline 사업유형, 인계/전환 history |
| Pipeline | F27–F39, L12/L14 | Stage별 form/업무 plan를 그대로 서버 계약화. 복합 변경 원자성, 금액3종, Next 전체 유형·완료/연기, activity/history, optimistic conflict |
| 연락처/메시지 | F40–F46, L05–L07/L16 | 다중 contact/동의·이동·관계 상태, 개인 메시지/캠페인 분리, 실제발송증거/응답/Next/Stage 연결. 외부공급자는 별도 서버경계 |
| 실행/자료 | F47–F54 | 체크리스트, 관계도, 견적 Version, 인수인계, 첨부 준비/완료/실패/다운로드, AuthUID favorite/history, scoped 검색 |
| Site/확장/정리 | F55/F56, L08–L11 | Site1:N Opportunity, 과거수주 불변, 실견적발송 뒤 새Deal1개, 미리보기/fingerprint·모든 원본/매출/자료 보존 |
| 모바일 | F62–F66 | 기존 모든 하단탭·관리 drilldown·Sheet·전화복귀·오늘 우선순위·방문 동선·미지원 상태를 같은 API로 연결 |
| 민감 기능 | F67 | 기존 요구한 admin+MFA+범위제한+audit Export를 별도 승인 단계에서 완성; 이번에는 Export/Storage/MFA 실행 없음 |

## 5. 서버 구현을 확인할 증거가 없는 항목

- Golden/로컬 저장소 모두 **운영 n8n workflow JSON/서버 router 전체 구현이 없다**. `pushWrite('op')`가 있다는 사실로 op가 실제 처리된다고 판단하지 않는다.
- SQL 파일의 `crm_inquiry_*`, message/quote/attachment 함수 선언과 이전 실제 public 함수 목록은 일치하지 않는다. [`sql-deployment-evidence.json`](./sql-deployment-evidence.json)에 이름 단위 대조를 남겼다. 이름 일치도 signature/ACL/body 또는 배포 성공의 증거는 아니다.
- 외부 문자 provider callback, signed upload/download 발급, 예약 잔디, ASQ sync, expansion quote dispatch의 실제 서버계약은 미확인이다. 이번 단계에서는 운영 조회 권한을 추정해 접속하지 않는다.
- 나중에 필요한 것은 **비밀값·고객 payload를 제거한 서버 workflow/route 계약**이다. 코드/메타데이터만으로 동작 증거가 부족한 부분은 계속 CONTRACT_MISSING/TEST_MISSING이다.

## 6. 검증·종료 Gate

이번 산출물은 검토 장부이지 실행 완료 보고서가 아니다. 소스 검사기의 전 파일 처리와 링크 검증은 로컬에서 확인한다. 정적 추출은 함수 override, 문자열 생성, 동적 dispatch의 런타임 도달성을 증명하지 않는다. 미확정 컨트롤은 `control-parity-matrix.csv`에서 명시적으로 찾을 수 있다.

| Gate | 현재 | 근거 |
|---|---|---|
| Golden commit 확인 | PASS | GitHub master SHA = 로컬 HEAD |
| 운영/로컬 출처 분리 | PASS | file manifest + 고정 commit 링크 + local anchors |
| 전체 실사용 기능 Inventory 100% | **미완료** | 정적 후보 전수 수록; 동적/간접 컨트롤·서버 실동작 미확정 |
| 필수 CONTRACT_MISSING = 0 | FAIL | Matrix에 남음 |
| 필수 UI_MISSING = 0 | **PASS 주장 안 함** | 계약 누락을 우선 상태로 표시했을 뿐 모든 UI가 있다는 뜻 아님 |
| 핵심 Action TEST_MISSING = 0 | FAIL | 실제 원본 UI 회귀 없음 |
| PC/모바일/역할별 전체 회귀 | 미실행 | 기존 11 JWT는 보안 subset |
| Legacy/n8n fallback 네트워크 0 | 미입증 | 원본 Staging adapter 실제 브라우저 실행 없음 |
| Legacy revoke / Production | **NO-GO** | 위 Gate가 모두 완료될 때까지 금지 |

다음 승인 작업은 이 Matrix의 계약 공백과 미확정 컨트롤을 원본 코드/합성 Golden fixture에 연결하는 것부터다. 화면·업무를 축약하거나 누락을 제외해서 합격률을 올리지 않는다. **이번에는 여기서 멈춘다.**

### 산출물 검증 결과

`node --test tests/crm-parity-inventory.test.cjs`: **5 PASS / 0 FAIL / 0 SKIP**.

검증 대상은 고정 commit/파일 SHA, 전체 대상 파일 수록, 모든 업무행의 근거 anchor·허용 상태, 49종 literal 호출과 모든 컨트롤 후보 수록, NO-GO/미확정 표시 유지다. **실제 브라우저·JWT·업무 Parity 시험이 아니다.** 이전 UI 회귀 준비 중 설치했던 별도 시험용 Playwright 패키지 2개는 범위 변경 후 제거했다. 필요 시 npm으로 재설치 가능하며 사용자 소스/기존 시험 라이브러리는 보존했다.
