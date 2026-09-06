# O07/O08/C03 operational reads — local private fragments

상태: `LOCAL_PRIVATE_FRAGMENTS / READ_CONNECTED_0 / STAGING_NOT_APPLIED`

## 화면별 판정

| 화면 | 판정 | 근거와 부족한 규칙 한 줄 |
|---|---|---|
| PC Dashboard 기본 Deal/문의 모집단 | `DERIVED_SAFE_PRIVATE_FRAGMENT` | `can_deal/can_inquiry`로 필터한 원천행은 안전하다. Golden은 FLOW(생성/확정 기간)와 SNAPSHOT(현재 active)을 분리하므로 서버에서 임의 합산하지 않는다. |
| PC Dashboard KPI/드릴다운 | `NEEDS_VERIFICATION` | Golden 계산은 quote/won 금액, 금액 coverage, 기술자문 제외, 위험/Stage SLA를 함께 사용하며 actual Staging에는 quote/won 정본이 없다. **부족 규칙:** 금액 3축과 전사 scope completeness가 필요하다. |
| PC Performance | `NEEDS_VERIFICATION` | Stage history·완료 Next는 실제 table에 있지만 목표금액/목표건수 정본이 없고 문의→Deal 연결을 UI가 site name으로 추측한다. **부족 규칙:** 목표 정본과 inquiry→Deal UUID lineage를 확정해야 한다. |
| PC Executive Report | `NEEDS_VERIFICATION` | 수주/진행/forecast/전월·전년·분기·담당자 표가 전사 전체를 전제하지만 admin도 actual 권한상 `object_scope` 행만 본다. **부족 규칙:** “회사 전체”를 보장하는 별도 승인 scope와 quote/won 금액 정본이 필요하다. |
| PC Gyeongnam | `NEEDS_VERIFICATION` | UI는 branch Pool·team/reporting group과 본사 인계→실담당 흐름을 요구하지만 실제 inquiry에는 branch/pool 필드가 없다. permission role `branch`만으로 인계 의미를 복원하지 않는다. |
| Mobile Mine | `DERIVED_SAFE_PRIVATE_FRAGMENT` | owner UUID 또는 명시 scope의 Deal 원천행을 반환하면 이름 fallback 없이 내 건을 만들 수 있다. |
| Mobile Today | `NEEDS_VERIFICATION` (safe ingredients only) | Deal core, open/completed Next, activity count, 문의 응대 시각은 투영 가능하다. 하지만 inquiry follow-up 정본, client `na-*` ID, 완료/연기 규칙이 미확정이므로 Golden priority 100%를 닫을 수 없다. |
| Mobile Control | `NEEDS_VERIFICATION` | 관리 모드 `DEALS 전체`와 DB admin/branch explicit object scope가 다르다. partial rows를 전체 관제로 표시하면 안 된다. |
| Mobile Search 직접 입력 | `DERIVED_SAFE_LOCAL_SOURCE` | `rSearch/srchDo`는 내 Deal의 현장·담당·대표 연락처만 검색한다. operational source가 `can_deal` 범위의 persisted identity/amount/date와 직접 연결 contact를 Golden alias로 보충했다. |
| Mobile CRM에게 물어보기 | `NEEDS_VERIFICATION` | core 조건은 가능하지만 이번 달 견적 발송 Activity와 과거 근무지는 권한 있는 전체 연락처/근무이력 projection이 필요하다. |
| C03 자동동기화·전체 read | `NEEDS_VERIFICATION` | 기존 `crm_read_scoped_v2`는 pagination 100과 일부 필드만 제공한다. 화면별 complete pagination과 partial/completeness 표시 계약이 필요하다. |

## Golden 계산 oracle

- Dashboard: `towerBase`는 Deal `created` 기준 FLOW, `wonInPeriod`는 `closed` 기준 확정 FLOW, `dashboardSnapshotDeals`는 현재 active SNAPSHOT이다. 문의와 Deal을 lineage 없이 더하지 않는다.
- Performance: 수주 목표 25+15, Stage 진전 10, 문의 전환 10, 기한 준수 15, Next 지정 10, 정체 10, CRM 완성 5점이다. 누락 정본은 0점이 아니라 `수집 중`이다.
- Gyeongnam: 인계 문의→지사 실담당→최초응대→Deal→경쟁/입찰→수주이며 내부 본사 KPI와 분리한다.
- Mobile Today 최종 우선순위: overdue, 새 배정, 이번 주 방문, 오늘 마감/후기 Stage, Next 없음, 정체이며 최대 60행이다. 문의와 Deal identity를 섞지 않는다.
- Search: 로그인 범위의 open Deal만 대상으로 하고 최대 20행, 화면 표시는 7행이다. 연락처 없음/이번달 견적 발송/과거 관리소장/오늘 전화/이번주 방문/1억+Next없음/기술자문/미접촉 조건이 있다.

## actual Staging 대조

정적 정본은 `sql/inquiry-direct-assign/20260906/after.json`이다.

- 존재: Deal UUID owner/site, stage/outcome/amount/created/closed/version, activity/contact timestamps, work/business fields; `stage_history`, `next_actions`, `activities`; Inquiry UUID assignee, received/assigned/responded/next date.
- 부재/불확정: `quote_amount`, `won_amount`, performance target, branch Pool/routing/reporting group, durable search index, complete Site/contact projection.
- `crm_security.can_deal`: rep는 UUID owner, branch/admin은 unexpired `object_scope`만 허용한다.
- `crm_security.can_inquiry`: rep/consultation은 assigned UUID, branch/admin은 unexpired `object_scope`만 허용한다.
- 따라서 UI의 “관리=전체”나 “대표보고=회사 전체”를 permission role만 보고 구현하지 않는다.

## local private fragment

`candidate.sql`은 `crm_security.crm_operational_read_fragment_v1(domain,after,limit)`만 만든다.

- domain은 `deal_core`/`inquiry_core`만 허용한다.
- actor가 없으면 거절하고 각 행에 기존 `can_deal/can_inquiry`를 적용한다.
- Deal child는 같은 Deal의 open/completed Next, Stage history, 최소 Activity signal만 포함한다.
- Inquiry raw JSON/address/close reason, Activity 자유서술 `detail.note/result`, audit, 다른 담당자의 child는 반환하지 않는다.
- 결과는 ID cursor pagination이고 `scope_completeness='actor_authorized_rows_only'`를 명시한다. 이를 회사 전체 집계로 표시하면 안 된다.
- private schema에 두고 `PUBLIC/anon/authenticated/service_role` 직접 EXECUTE를 전부 금지한다.
- 기존 `crm_read_scoped_v2`와 public Dispatcher의 signature/OID/body/config/ACL은 전혀 바꾸지 않는다.

`connected_operations=[]`, `connected_reads=[]`다. 승인된 향후 wrapper가 기존 public read 계약 안에 조합하기 전에는 UI/network에서 호출하지 않는다.

## Rollback

새 private fragment 함수만 제거한다. 업무행·public function·ACL·receipt/audit에는 변화가 없다.
