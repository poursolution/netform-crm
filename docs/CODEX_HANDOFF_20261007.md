# 코덱스 인수인계서 — 2026-10-07 (Claude Code → Codex)

대표 지시(2026-10-04): 화면 · 시안 반영은 Claude, 서버 · 데이터 · 로직 연결은 Codex. 이 문서는 2026-10-07 하루 동안 Claude 가 운영에 반영한 것과, 그 위에서 Codex 가 이어서 해야 할 서버 몫을 적은 것이다. 모든 PR 은 master 에 병합됐고 운영(`https://poursolution.github.io/netform-crm/crm.html?view=pc`)에 올라가 있다.

읽는 순서: ① 오늘 바뀐 것(건드리지 말 것) → ② 서버에 이미 적용된 SQL → ③ Codex 가 할 일 → ④ 규칙 · 함정.

---

## ① 오늘 운영에 반영된 것 (화면 · 디자인은 되돌리지 않는다)

| PR | 내용 | 주 파일 | 끄기 스위치 |
|---|---|---|---|
| #496 | 점검 7가지(매출 합계 근거 · 비율 분모 · 낙찰/계약 분리 · 날짜 확인된 계약 예정 · 퍼널 집단 · 불러오는 중 · 재개 가능 이름) | perf-v3.js · report-b.js · dash-b.js · today-v3.js · pipeline-legacy.js | — |
| #499 | 단계 값 NULL 인 과거 이관 건의 영업 재개(출발 단계 `unclassified`) | pipeline-scope.js · stage-transition-ui.js · deal-detail-v3.js | — |
| #500 | 영업건 휴지통(30일 보관 · 복원) + '이 단계 필수 정보' 항상 펼침 | deal-trash.js/.css · deal-discard.js · deal-detail-v3.js | — |
| #501 | 단지 영업 이력 편집칸 찌그러짐 수정 · 담당 없는 과거 이관 건은 담당 먼저 | site-history.css · stage-transition-ui.js | — |
| #502 | ops_12 A 판정 · 집계 통일(한 줄 '판정: 근거 → 추천' · 기한 초과/날짜 미입력/판정 불가 · 분해 숫자) | pipeline-judge.js · pipeline-row-v11.js · stage-board.js | G.judgeOff |
| #503 | ops_12 B 담당자 선택 묶음 · 설정 '적용 중' 알약 · 이번 주 새로 멈춘 건 | pc-common-filterbar.js · rules-admin.js · today-v3.js | — |
| #504 | ops_12 C 요청 5단계 · 재배정 인계 · 보류 사유 + 재개 날짜 | work-request.js · deal-owner-v2.js · stage-transition.js | G.workRequestOff |
| #505 | ops_12 D 관리팀 지표 · 단계별 선행→결과 · AI 근거 3줄 | kpi-v7.js · perf-v3.js · now-card.js | — |
| #506 | 연락 한 번 연결(반영될 곳 · 연결 표식 · 지사 3단계 · 확장관리 단지 머리 줄 · 대기 이유) | contact-link.js/.css · gyeongnam-b.js · expansion-b.js · expansion-v2.js | G.contactLinkOff |
| #507 | 결정 일정 · 협업 8가지(결정 일정 · 막힌 곳 · 진척≠접촉 · 하자 · 정보 확인 · 되돌리기 · 경고 묶음 · 고객 자산 숫자 나누기) | decision-collab.js/.css · asset-c.js · today-v3.js | G.decisionCollabOff |

검사: `npm run test:contracts`(476) + `package.json` 의 브라우저 검사 목록(quality-gate). 새로 추가된 검사: `scripts/verify-contact-link-browser.cjs`, `scripts/verify-decision-collab-browser.cjs`. 문구를 바꾸면 그 문구를 보는 다른 검사(scope · deal-win · row-v11 · gyeongnam-b 등)도 같이 고칠 것.

---

## ② 서버에 이미 적용된 SQL (대표가 Supabase SQL 편집기에서 Run · 확인 끝)

1. `sql/transition-null-stage-v1-20261007.sql` — `crm_security.crm_deal_transition_command_v1` 본문의 비교 한 줄만 `coalesce(oldrow.stage_code,'unclassified') IS DISTINCT FROM from_value` 로 치환. 저장된 단계 값이 NULL 인 건은 화면이 출발 단계 `'unclassified'` 를 보낸다(`PipelineScope.fromCode`). stage_history.from_stage 에 `unclassified` 가 남는다(화면은 '단계 없음(과거 이관)'으로 보여 줌).
2. `sql/deal-trash-v1-20261007.sql` — `crm_deal_discard_v1`(범위 = relate_id 있거나 예전 단계 값인 열린 건 · batch `deal-trash-YYYYMMDD`), `crm_deal_trash_list_v1(p{page})`, `crm_deal_restore_v1(p{deal_id})`, `crm_deal_trash_purge_v1()`(30일 · pg_cron 있으면 03:20). 보관 표 = `crm_security.manual_delete_backup`(batch · table_name · row · saved_at). 허용 목록(`pc-manager-transport.js`)에 `crm_deal_trash_list_v1` · `crm_deal_restore_v1` 추가됨.

운영 사실(2026-10-07 읽기 조회): 단계 값 NULL 열린 영업건 22건(담당 없음 20) · 휴지통 1건(2c5cfb) · 과거 이관 424건.

---

## ③ Codex 가 할 일 (서버 · 데이터 · 로직)

### A. 이미 전달된 것(2026-10-06 ~ 07 · 아직 미적용이면 먼저)
1. **상담 연결** — `inquiry-consultation-link.js` 가 쓰는 서버 함수 허용 목록 등록 + `root.InquiryConsultationIndex.of(id)` 서버 색인. (PR #497 로 `inquiry-consultation-index.js` · `sql/inquiry-consultation-index-20261007.sql` 가 들어왔으면 운영 적용 여부만 확인.)
2. **견적문의 결과 두 칸** — `InquiryFlow.TWO.of` 가 넘기는 `contact_result` · `customer_reaction` 두 칸 저장(`sql/inquiry-contact-two-results-20261007.sql`).
3. **요청 엔진 켜기** — `crm_work_request_*_v1` 운영 적용 확인(`sql/work-request-v1-20261005.sql`). 켜지면 오늘 업무 [요청 보내기] · 과거 이관 재개 요청 · 재배정 인계 · 관리팀 지표가 살아난다.
4. **대시보드 조회 범위** — `crm_direct_read` 의 `scope:'own'` 을 관리자 · 팀장 밖 영업사원에게도 `all`(대시보드 3개 화면 전원 열람 · `sql/dashboard-read-all-20261007.sql` 가 그것이면 적용 확인).

### B. 오늘 생긴 서버 몫
5. **요청 종류 `handover`** — 재배정 인계는 지금 `kind:'support'` + `label:'재배정 인계'` 로 보낸다(`deal-owner-v2.js handover()` · 서버 kind CHECK 목록이 고정이라). 서버에 `handover` kind 를 추가하고 화면 두 곳(`deal-owner-v2.js`, `work-request.js HANDOVER_LABEL` 판정)을 kind 기준으로 바꿔도 된다. 바꾸지 않아도 동작한다.
6. **연결 표식 → 연결 표** — 연락 한 번 연결은 원본 기록 글 끝에 ` [연결 deal:<id>,inq:<key>]` 표식 하나를 붙이고(`ContactLink.marker`), 연결된 건은 모든 건의 activities 를 훑어 표식을 읽는다(`ContactLink.linkedInto`). 서버에 `activity_links(activity_id, target_type, target_id)` 같은 표를 두면 `linkedInto` 를 서버 조회로 바꿀 수 있다. 화면 글에서 표식을 숨기는 규칙은 `LEGACY_NOTE_SAY`(crm.html) · `now-card.js SAY` 첫 줄.
7. **대기 이유 · 결정 일정 · 막힌 곳 · 진척 · 하자 · 확인 상태** — 전부 내부 메모(`type:'메모'`) 글의 머리 표식으로 저장된다(규칙은 `contact-link.js` · `decision-collab.js` 머리 주석). 서버 표로 옮길 때 표식 문법 그대로 파싱하면 과거 기록이 이어진다.
   - `대기 이유: X (YYYY-MM-DD까지)` → PipelineJudge 가 그 날짜까지 경고 제외
   - `[결정 일정] 종류 | 날짜 | 확인됨·추정·미확인 | 출처`
   - `[막힌 곳] 고객·내부 · 견적팀·내부 · 자료 부족 | 상태 | 담당 | 기한 | 견적팀 단계` · `[막힌 곳 해제]`
   - `[진척] 종류 | 날짜` / `[하자] 내용 | 접수 날짜 | 담당 | 약속 날짜 | 미해결·해결` / `[확인] 항목 | 확인됨·추정·미확인 | 출처 | 날짜`
8. **확장관리 단지 한 번 연락** — 저장 뒤 같은 단지의 다른 계약에는 `crm_expansion_note` 로 `[단지 연락 · 연결] <현장> 원본 기록 <event id>` 줄만 남긴다(`expansion-v2.js saveNote` · `G.xbSiteNote`). 서버에서 원본 event 를 여러 source_opportunity_id 에 연결하는 표가 생기면 그쪽으로.
9. **되돌리기 승인** — 실적 · 계약 금액 되돌리기는 화면에서 승인 요청 창만 연다(`DecisionCollab.revert` kind 'amount'). 원장 금액 되돌리기 서버 명령 + 승인 흐름은 Codex 몫.
10. **정합성** — 단계 값 NULL 22건은 이제 화면에서 재개 가능. 그래도 서버에서 `stage_code` 를 실제 예전 단계 값으로 채울 수 있으면 더 좋다(`relate` 원본 대조).

### C. 운영 확인 요청(읽기 조회로 가능)
- 휴지통: `crm_security.manual_delete_backup where batch like 'deal-trash-%'` · 복원 뒤 행이 빠지는지.
- 영업 재개: `stage_history where from_stage='unclassified'`.

---

## ④ 규칙 · 함정

- **배포 순서**: 새 RPC = 같은 PR 에 SQL + `CRM_RPC_ALLOW`(`pc-manager-transport.js`) + 오류 이름(`pc-error-state.js`). 매니페스트(`crm_release_manifest_v1`)는 `public` 의 `crm_%` 함수 중 `authenticated` 실행 권한이 있는 것을 동적으로 돌려준다 → 함수를 만들고 grant 하면 `CRMRelease.has` 가 바로 참이 된다. 화면 병합은 DB 적용 뒤.
- **판정은 한 함수**: `PipelineJudge.basis/line/state/tally` — 목록 줄 · 오늘 업무 · 상세 · 지금 할 일 카드 · 단계 진단이 같이 쓴다. 문구를 바꾸면 전부 같이 바뀐다. 순서: 고객 합의 대기(결정 일정) → 대기 이유 → 다음 행동일 → 단계 근거 날짜 → 날짜 미입력/판정 불가.
- **진행 범위 정본**: `PipelineScope`(진행 = CRM 유효 단계 + 열린 건 / 과거 이관 = 그 밖 열린 건). 숫자를 고정하지 말고 규칙을 고정.
- **'이 단계 필수 정보'에 접기를 다시 넣지 말 것**(대표 2026-10-07 강조). 목록은 20건 + 쪽 번호. 예전 창을 여는 호출은 두지 않는다.
- **담당 없는 과거 이관 건은 영업 재개 전에 담당부터**(서버 next_action 이 담당 없으면 42501).
- **검사 함정**: `.dcb-dec` 안 날짜는 `:scope>b`, 라벨은 `:scope>div>b`; 공용 틀 줄(row3)은 상태 이름을 ' · ' 로 잘라 첫 조각만 쓴다(지사 단계 이름 '방문·견적 진행'처럼 공백 없는 가운뎃점); 정돈안 검사의 체류 일수는 UTC 자정 경계에서 ±1.
- **PowerShell 치환**: `.NET` 파일 API 는 절대 경로, UTF-8(BOM 없음).

문의: 이 문서와 기억 파일(`crm-ops12-20261007` · `crm-contact-link` · `crm-decision-collab` · `crm-deal-trash`)이 같은 내용을 가리킨다. 다른 저장소(ASQ · fee-crosscheck)는 건드리지 않는다.
