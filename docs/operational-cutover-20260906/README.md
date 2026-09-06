# 운영 완전 전환 Coverage — 2026-09-06

판정: **NO-GO / INVENTORY_BASELINE_COMPLETE**. 완료 기준은 행이나 op 개수가 아니라 현재 도달 가능한 업무의 Staging E2E 100%다.

## 정본과 범위

- 기준 UI: 현재 로컬 `crm.html`, `mobile.html` 및 두 파일이 직접 로드하는 overlay. 운영 Pages, Production, n8n 본문은 조회하지 않았다.
- 방법: 메뉴·버튼·모달·form submit·input change에서 최종 handler와 write/read 호출까지 정적 역추적했다. 동일명 구형 함수는 최종 override와 분리했다.
- `coverage-matrix.csv`는 업무 행동 중심 장부이며 reachable mock도 명시한다. `dead-overrides.csv`는 현재 UI에서 호출되지 않거나 후대 정의에 덮인 코드만 분리한다.
- literal `pushWrite` 41종을 모두 reachable/blocked/dead 행 중 하나에 매핑했다. 이 숫자는 완료율이 아니다.

## 현재 결과

- Staging n8n-free 완료·동결: `opportunity_work_set`, `inquiry_assign/direct_assign`.
- Staging 검증 완료: 문의 scoped read, `inquiry_unassign`, `service_change`를 단일 공개 Dispatcher 뒤의 한 transaction bundle로 적용했다.
- 실제 JWT 13/13, 기존 JWT 회귀 11/11, private receipt/audit exact count, synthetic 표시 상태 복구가 모두 PASS했다.
- 별도 `staging-operational` UI 후보는 실제 Staging 6역할 × PC/mobile 12조합 Auth/scoped read에서 PASS했다. 4개 승인 op의 브라우저 transport는 4/4 PASS했지만 direct/unassign은 기존 receipt replay이므로 fresh 버튼 mutation E2E와 실제 배포, 전체 read는 아직 남아 있다. Production/n8n 요청은 0건이다.
- 첨부 T01/T02는 Staging에서 prepare→authenticated signed upload→complete→ready read까지 PASS했다. 이후 브라우저 재실행으로 생성된 exact Storage object 1개와 fixture DB 448행을 승인된 정확 범위로 삭제했고 fixture/잔여/Storage 0 및 canonical 원복을 확인했다.
- 고객자산 A04D와 개인상태 T03은 로컬 후보 검증과 Staging read-only canonical preflight를 통과했다. 초기 raw MD5 차이는 CRLF/source formatting 차이였고 전체 함수 본문을 재대조했다. 현재 Staging 적용은 0이며 승인 전 대기한다.
- Dashboard 원천행과 Mobile Mine은 기존 scoped read를 바꾸지 않는 별도 authenticated domain-paged source의 로컬 체인 후보까지 통과했다. 초기 mobile 변환이 persisted 현장명·담당·금액·날짜·대표 연락처를 버리던 문제를 교정했고, 단순 모바일 검색(O08S)도 같은 actor scope 후보에 연결했다. 자연어 고급검색(O08A)의 견적발송·과거근무지는 별도 projection 전까지 차단한다. T03 적용과 live guard/JWT pagination 검증 전에는 Staging 연결로 계산하지 않는다.
- 위 개인화/read/Pipeline/문의관리 후보 15개 delta는 `sql/reachable-operations-bundle/20260906/`에서 frozen 4-op → 21-op 상태의 단일 transaction apply와 역순 단일 transaction rollback으로 합성했다. 마지막 단계의 의도적 실패가 앞선 모든 계층을 원복하고, 전체 apply 후 rollback이 frozen baseline으로 돌아오는 것을 격리 PostgreSQL에서 검증했다. 이 번들은 아직 Staging 미적용이며 JWT/E2E PASS가 아니다.
- 현재 최상위 누적본은 `sql/operational-cutover-candidate/20260906/`이다. 위 21-op에 직접/문의승격 `opportunity_create`, 문의 기존 Deal 승격 `transition`, I03P/I03N/I03M 문의 응대 세 intent, `lineage_link`, A04D Deal-scoped 연락처/근무이력 read, lineage-first Deal read를 더해 23-op+세 read 보충을 한 transaction apply/역순 rollback으로 합성했다. 마지막 계층 실패와 runtime create/promote/link 뒤 rollback 차단도 격리 PostgreSQL에서 검증했다.
- Pipeline action/quote 체인 뒤에 Next Action 완료(P10/P11)를 붙인 로컬 후보까지 검증했다. 완료 command는 server UUID만 정본으로 받고 Action·Deal summary·Activity·version·private audit·receipt를 한 transaction으로 처리한다. operational source가 UUID를 PC/mobile alias에 공급하기 전에는 Staging 연결로 계산하지 않는다.
- Stage checklist 수동 토글(P15)은 같은 체인 뒤의 로컬 후보로 검증했다. 서버가 최종 PC/mobile guide의 수동 index만 허용하고, 자동 항목은 기존 CRM 데이터에서 계속 계산하며 write하지 않는다.
- 구조화된 비종료 Stage 전환(P03)은 P15 뒤의 로컬 후보로 검증했다. 단계별 fields와 graph를 서버가 검증하고 Deal context·history·Activity·필요한 replacement Next·private event/audit/receipt를 한 transaction으로 처리한다.
- 비수주 종료(P04: 실주·배드핏·연락두절)는 P03 뒤의 로컬 후보로 검증했다. PC의 parent 후 Activity와 모바일의 parent 전 Activity/Next 완료를 모두 `close` 한 transaction에 흡수하고 종료 전 stage를 보존한다.
- Closed Won(P04W/P16)은 25-op 누적 후보 뒤의 별도 로컬 후보로 검증했다. 최종 PC/mobile 구조화 UI의 준공일·공사 완료·준공검사 완료·최종 수주금액만 받으며, 예상금액과 분리된 won 정본·private expansion Pool·history/Activity/audit/receipt를 한 transaction으로 저장한다. 뒤따르는 `activity`와 `expansion_pool_upsert`는 흡수하고 Pool UUID/site/owner/work는 잠긴 Deal에서 서버가 만든다.
- 확장관리 X01은 Closed Won 후보 뒤에서 상태 5종과 다음 접촉일만 받는 별도 로컬 후보로 검증했다. private Pool version/event, Deal scope/audit, receipt를 한 transaction으로 쓰고, Pipeline 전환·접촉메모·client actor/time은 계속 분리한다.
- Next Action 연기(P09X)는 메시지 실행 알림(M04) 뒤의 별도 `next_action/postpone` 로컬 후보로 검증했다. PC `todoDelay`와 모바일 Deal `applyTodayPostponeM`만 실제 read가 공급한 open Action UUID를 사용하며, 같은 Action의 due·서버 계산 연기 횟수·Activity·Deal version·audit·receipt를 한 transaction으로 저장한다. 모바일 문의 연기는 기존 `inquiry_followup`으로 유지하고 임시 `na-*`, client count/type/text, 같거나 이른 날짜는 차단한다.
- 모바일 Today Deal 통화결과(P09M)는 기존 `next_action_complete` 아래 `today_outcome` intent로 분리한 로컬 후보로 검증했다. 진행됨·다음주 다시·못 받으심만 도달 가능하며, 현재 Action 완료·결과 Activity·replacement Next·Deal version/contact·audit/receipt를 한 transaction으로 처리한다. 다음주 결과만 P09X와 공유하는 Deal 단위 `postpone_count`를 올린다. 구형 `quick/pickSkip` 경로는 최종 `rToday/execTaskRowM`에서 호출되지 않아 D09 dead code로 유지한다.
- 고객관리 지원요청(O02)은 기존 `customer_support_action`을 관리자 요청 ledger로만 연결한 로컬 후보로 검증했다. 버튼 직후의 요청 1건과 receipt만 원자 저장하고, 뒤이어 열리는 전화·메시지·Activity·Next는 각 기존 기능으로 남긴다. client actor/time/status/rep/site는 버리고 잠긴 Deal/문의와 현재 승인된 rep UUID를 서버가 다시 확인한다.
- 저장 실패 재시도(C04)는 새 op가 아니라 누적 명령 큐 복구로 연결했다. 네트워크·응답 유실인 `uncertain`만 저장된 동일 request_id/operation/object/version/payload로 다시 보내며, `conflict`와 `rejected`는 확인 필요 상태로 남겨 자동·수동 재전송하지 않는다.
- 영업사원 주간 코멘트(O01)는 UI와 과거 SQL상 `(담당자,주차)` mutable snapshot 의미까지는 확정됐지만, 실제 UUID 사용자에 본사 내부 6명을 식별할 team 정본이 없다. Golden 이름 여섯 개를 권한 allowlist로 만들지 않고 O01은 별도 team/eligibility 승인 전까지 차단한다.
- 예상금액(P05E)은 P04 뒤의 로컬 후보로 분리했다. actual `deals.amount`만 바꾸고 최신 견적금액은 append-only `quote_version`의 concurrency snapshot으로 대조하며 수주금액은 null만 허용한다. PC 상세·문제함의 같은 `amount` op와 read alias를 유지하되 P05Q/P05W 직접 편집은 별도로 계속 차단한다.
- 기존 대기 Deal의 근거·재접촉 저장(P13)은 P05E 뒤의 로컬 후보로 검증했다. waiting context·replacement Next·Activity·Deal version·private audit/receipt를 한 transaction으로 묶고, 기존 UI의 뒤따르는 `next_action`은 흡수한다. 대기 단계 진입 자체는 P03 구조화 전환에 남긴다.
- 기술자문 문의 재분류(I14)는 P13 뒤의 로컬 후보로 검증했다. 기술자문 Deal 이관(I15)도 누적 후보의 마지막 레이어로 분리해, admin scope·현재 inquiry 정본만으로 nullable owner/site를 결정하고 Deal·문의 backlink·history/activity·양쪽 private audit·receipt를 한 transaction에 저장한다. 기존 UI의 뒤따르는 `inquiry_status`는 부모 command에 흡수한다.
- 상담담당 지정(I16)은 Staging read-only 확인 결과 `public.sales_people`가 없고 현재 reviewed role은 `admin/rep/branch/consultation`만 구분한다. UI가 상담 가능한 영업담당까지 후보로 노출하므로 `consultation` role만으로 축소하거나 모든 `rep`로 확대하지 않고, UUID 기반 eligibility 정본이 승인될 때까지 차단한다.
- 관리자 수동 완전삭제(I13)는 trash/restore 상태 정본 뒤의 로컬 후보로 검증했다. latest trash와 양방향 Deal lineage를 서버에서 재확인하고 RESTRICT인 object scope 제거, FK child cascade, private immutable audit/receipt를 한 transaction으로 처리한다. runtime purge는 복구 불가이므로 migration rollback은 purge 사용 전만 허용하며 자동 purge는 별도 차단한다.
- 문의 후속일 연기(I08)는 Actual `inquiries.next_action_date`를 정본으로 쓰는 로컬 후보로 검증했다. 기존 payload에 없는 Next UUID·제목·유형을 발명하지 않고 current assigned UUID actor만 미래 날짜를 저장하며, Mobile Today가 새로고침 뒤 미래 due를 숨기고 당일·기한초과에 다시 표시한다.
- 직접 신규 Pipeline(P01)은 21-op 누적 후보 뒤에 붙는 별도 `opportunity_create` 로컬 후보로 검증했다. 공통 exact Site key만 자동 재사용하고 PC/mobile 전용 broad 차이는 409로 멈추며, reviewed UUID owner matrix와 PC Activity 1/Next 0·모바일 Activity 1/Next 1을 한 transaction으로 처리한다. 문의 promote·기술자문·확장 전환은 같은 op 이름이어도 계속 차단한다.
- 문의 응대(I03P/I03N/I03M)는 기존 `inquiry_assign` 아래의 세 내부 intent로 분리했다. assigned UUID인 rep/consultation만 허용하며 진행·다음주 응답은 최초응대를 한 번 기록하고 마지막시각을 갱신한다. 부재는 미응대 timestamp를 보존한다. 다음주·부재 후속일은 서버 KST 기준 각각 7일·1일 뒤이고 private append-only audit와 scoped response history를 함께 남긴다.
- PC 문의 상세 진행(I04)은 기존 `inquiry_status` 아래 `progress` intent로 분리했다. 비종료 단계 0~5만 허용하고 현재 status를 optimistic token으로 비교하며, 문의 응대시각·단계이력·기존 open 후속 취소·새 Next Action·private audit/receipt를 한 transaction으로 처리한다. 보류와 종료 의미는 계속 별도 차단한다.
- 일반 본사 문의의 Pipeline 승격(I09)과 수동 계보 연결(I10)은 PC 기존 외부 op/ACK를 유지하면서 내부 intent만 분리한 로컬 후보로 검증했다. `deals.origin_inquiry_id`를 정본으로 고정하고 inquiry row/advisory lock 및 적용 전 중복 preflight로 inquiry당 Deal 하나를 보장한다. 자동 승격만 qualifying 문의 status를 원자 갱신하며, 수동 승격은 현재 status 일치를 요구한다. 조회는 명시 lineage를 우선하고 site-name은 legacy fallback으로만 남긴다. 기술자문·경남 승격은 계속 차단한다.
- Pipeline 담당자 배정/인계(P02/P12)는 현재 Staging users에 team 정본이 없고 PC와 mobile의 재배정 사유 규칙도 달라 차단했다. 기존 assignment_history의 text 컬럼을 임의 UUID/team 권한 모델로 해석하지 않는다. P02는 향후 `assign` 한 transaction에서 서버 생성 handover를 흡수하는 계약까지만 고정했으며, 승인된 UUID team/assignability 정본 전에는 후보 SQL을 만들지 않는다.
- 메시징은 외부 앱 open/Clipboard를 유지하면서 message log(M02), reminder(M04), 관계 cadence(M05)를 Supabase ledger·원자 command·scoped read로 연결했다. 실제 문자·카카오 발송·예약·provider callback(M06)은 승인된 n8n 유지 경계이며, 기존 workflow 본문을 바꾸지 않는 별도 외부 E2E만 남는다.
- 명시 차단: `branch_handoff`, `branch_owner_assign`.
- 나머지 저장은 현재 UI에서 n8n, localStorage, 외부 앱, 검증 전 직접 RPC 중 하나에 남아 있다.
- Staging 원본 화면은 업무별 read가 대부분 unavailable이므로 write만 연결해도 운영 전환이 완료되지 않는다.
- 현재 source에 남은 Production/n8n URL은 전환 대상 증거이며, 이 조사에서는 호출하지 않았다.

상태별 업무행: BROWSER_STAGING_PASS_NOT_DEPLOYED 2 / EXTERNAL_APP 3 / LOCAL_ONLY_CONFIRMED 2 / OUT_OF_SCOPE_31_OP_BOUNDARY 7 / REACHABLE_MOCK_BLOCKER 2 / STAGING_COMPAT_PASS_FROZEN 6 / STAGING_JWT_E2E_PASS_20260906 62.

## 도메인 처리 순서

1. 공통 read projection + queue/receipt/audit/ACK 회귀 harness
2. 견적문의: 응대·상태·회수·후속·전환, 이후 경남 routing
3. Pipeline + Next/Activity: 생성·담당·단계·종료·금액·사업유형·대기
4. 고객자산: Site·연락처·관계·이동·Timeline·정리
5. 기술자문·확장관리
6. 첨부/메모
7. 개별 메시징, 이후 campaign/provider
8. 관리자·보고·Export와 역할별 전체 회귀

각 묶음은 확정 가능한 계약을 함께 구현하되, 한 transaction이어야 하는 동작을 여러 성공 toast로 쪼개지 않는다. NEEDS_VERIFICATION 행은 다른 묶음 진행을 막지 않는다.

## 최종 Gate

- reachable matrix의 PASS/E2E coverage 100%
- PC·모바일 주요 업무 E2E 및 모든 역할 권한 PASS
- duplicate write 0, stale/version·request reuse 충돌 PASS
- 대화형 CRM read/write에서 n8n 요청 0, 승인된 외부 유입·발송 경계만 n8n 허용
- Production 요청 0인 Staging 리허설 PASS
- Production cutover/rollback·legacy RLS backlog 검토 완료

## 검토 자료

- `sql/operational-bundle/20260906/`: 통합 apply/rollback/manifest/local DB 검증
- `sql/reachable-operations-bundle/20260906/`: 미적용 후보 15개 delta의 원자 누적 apply/역순 rollback/최종 UI asset/hash manifest
- `sql/operational-full-local-candidate/20260906/`: 25-op 기반부터 M02/M05까지 31개 operation을 단일 apply/역순 rollback으로 합성한 최종 로컬 후보
- `staging-write/compat-adapter-operational-candidate.js`: 공개 Dispatcher 단일 경로 Adapter 후보
- `docs/operational-cutover-20260906/staging-preflight-20260906.json`: Staging read-only live preflight
- `docs/operational-cutover-20260906/operational-bundle-staging-application.json`: migration/JWT/private evidence/복구 결과
- `docs/operational-cutover-20260906/staging-advisor-after-operational-bundle.md`: 적용 후 advisor 분리 기록
- `docs/operational-cutover-20260906/production-security-backlog.md`: 이번 bundle과 분리한 legacy RLS cutover backlog
