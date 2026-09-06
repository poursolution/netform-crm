# Golden PC/mobile read projection matrix

정본 시점: 2026-09-06. 대상은 `netform-crm-staging / rprechiaglyjaydkmxsu`이며 catalog/function read-only 대조만 수행했다. `company_all`은 역할명으로 추정하지 않고, 현재 `can_deal/can_inquiry`가 증명하는 `actor_authorized_rows_only`와 구분한다.

| 화면·행동 | 실제 Golden 소비 | 현재 Staging read | 판정 | 다음 증거 |
|---|---|---|---|---|
| PC 문의 목록·상세·배정이력 (I19) | 문의/site/contact/work/status/담당/timestamp/history | `crm_read_scoped_v2` inquiry projection에 존재 | `STAGING_COMPAT_PASS_FROZEN` | 동결 회귀만 수행 |
| 모바일 문의 목록·상세 (I19) | `inquiryViewM` aliases와 배정/응대 timestamp | 같은 inquiry projection에 존재 | `STAGING_COMPAT_PASS_FROZEN` | 동결 회귀만 수행 |
| PC Pipeline 기본 목록 (O07S/C03) | site, owner, stage, amount, work, created/updated/closed, version | 현재 public read는 site/amount/date를 누락. operational source 후보는 기존 relation에서 보충 | `DERIVED_SAFE_LOCAL_CANDIDATE` | 전체 chain Staging JWT + 실제 list 렌더 |
| PC Deal 상세 (C03) | 기본 목록 + Next, Stage history, Activity, contacts, attachment, ASQ | source 후보는 Next/history/minimal Activity/대표 contact까지만 제공 | `PARTIAL / NEEDS_VERIFICATION` | A04D 연락처, T02 첨부, ASQ projection을 독립 결합 |
| PC Dashboard 원천행 (O07S) | period 전 Deal/문의 core rows | actor scope source 후보 및 독립 cursor가 local DB/UI PASS | `DERIVED_SAFE_LOCAL_CANDIDATE` | Staging JWT pagination + drill row render |
| PC Dashboard KPI·드릴다운 (O07D) | current/flow 분리, quote/won/expected 금액, risk, complete scope | quote layer 미적용이고 admin도 object scope만 보유 | `NEEDS_VERIFICATION` | 금액 3축 및 dashboard가 actor scope인지 company scope인지 승인 |
| PC Performance (O07P) | Stage history, completed Next, inquiry→Deal lineage, target | 일부 relation은 있으나 목표 정본과 lineage uniqueness가 없음 | `NEEDS_VERIFICATION` | 목표 source 및 UUID lineage 확정 |
| PC Executive Report (O07R) | 전월/전년/분기/담당자 company aggregates | 현재 admin은 explicit object scope뿐 | `NEEDS_VERIFICATION` | 별도 company-wide 승인 scope와 금액 정본 |
| PC Gyeongnam (O07G) | 본사 인계→Pool→실담당→응대→Deal lineage | branch/pool/routing/reporting-group 필드 없음 | `NEEDS_VERIFICATION` | branch_handoff/branch_owner 계약과 동일 정본 |
| 모바일 내 건 (O08M) | site, owner UUID/name, stage, amount, work, date, Next, 대표 contact | 초기 후보가 UI 변환에서 값을 버렸으나 현재 local 후보에서 persisted aliases로 교정 | `DERIVED_SAFE_LOCAL_CANDIDATE` | 6역할 JWT + list/detail render + foreign row 0 |
| 모바일 Today (O08T) | Deal/inquiry core, server Next UUID, due/status/activity timestamps | local chain이 next complete와 inquiry follow-up까지 보유; response_update 제외 | `DERIVED_SAFE_LOCAL_CANDIDATE` | full chain Staging Today E2E |
| 모바일 관리 (O08C) | 관리 모드 전체 Deal/문의 | Golden `myDeals()`는 admin이면 전체를 가정하지만 DB는 explicit object scope | `NEEDS_VERIFICATION` | UI에 범위 표시 또는 승인된 management scope 계약 |
| 모바일 직접 검색 (O08S) | 내 Deal의 현장·담당·대표 연락처/전화 | 보강 source가 `can_deal` 범위의 persisted core와 직접 contact만 제공 | `DERIVED_SAFE_LOCAL_CANDIDATE` | Staging 실제 현장/담당/전화 검색 및 foreign result 0 |
| 모바일 CRM에게 물어보기 (O08A) | Today/방문/고액/기술자문/미접촉/견적발송/과거근무지 | core 조건은 가능하나 견적 발송 detail과 전체 권한 contact history가 불완전 | `NEEDS_VERIFICATION` | A04D 및 최소 Activity evidence projection 결합 |
| PC/mobile 고객자산 timeline (A04D/A04S) | Deal 직접 연락처, 사람 근무이력, Site 1:N | Deal-scoped A04D는 local candidate, Site authority는 없음 | `PARTIAL / NEEDS_VERIFICATION` | A04D Staging 승인 후 Site 권한 별도 확정 |
| PC/mobile 첨부 gallery (T02) | ready metadata | Staging bucket/relation/function/policy 0 | `BLOCKED` | private Storage/metadata 기반 승인 |
| 관계관리·메시징 read-back (M02–M06) | send outcome, consent, cadence, scheduled metadata | M02 user-attested outcome, M04 예약 metadata, M05 hold/response cadence projection은 local candidate; consent/provider callback은 없음 | `PARTIAL / DERIVED_SAFE_LOCAL_CANDIDATE` | M02/M04/M05 Staging JWT 뒤 M06 consent/provider 계약 별도 확정 |
| ASQ 카드 (O09) | opportunity-linked project/status/URL | shell은 `asq_projects=[]`; 현재 외부 링크만 확정 | `READ_CONTRACT_MISSING` | ASQ source와 opportunity UUID 연결 계약 |

## 이번에 닫힌 부분

- shared UUID cursor는 page별 snapshot 한계를 명시한 채 양 relation을 끝까지 읽고 dedupe한다.
- operational source 후보는 기존 public read/write 함수를 변경하지 않고 별도 authenticated RPC로 actor scope를 반환한다.
- PC/mobile 변환에서 persisted `site_name`, `owner_name`, `amount`, 날짜, Next UUID, 대표 contact를 더 이상 버리지 않는다.
- 모바일 단순 검색과 고급 자연어 조건검색을 분리했다. 안전한 기본 검색 때문에 고급 조건을 억지 구현하지 않고, 고급 조건 때문에 기본 검색을 계속 미확정으로 두지도 않는다.

## 여전히 C03을 닫지 못하는 이유

`C03_FULL`은 모든 화면이 요구하는 projection과 scope가 증명돼야 한다. 현재 actor-scoped Pipeline/inquiry core는 후보가 있지만 company report, management all, Gyeongnam routing, attachment, messaging, ASQ가 빠져 있으므로 전체 read 완료를 주장하지 않는다.
