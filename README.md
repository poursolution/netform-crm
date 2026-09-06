# netform-crm — PC / 모바일 통합 CRM

CRM 데이터와 서버 쓰기 구조는 하나이며 사용자 화면만 PC와 모바일로 구분합니다.

## 조회 이전 작업 상태 — 2026-09-05

로컬 PC·모바일 조회는 공용 `crm-read.js`를 통해 Supabase `crm_read_bundle()` RPC로
변경했습니다. **운영 DB 적용은 권한 변경 승인 대기이며, 사이트 배포도 아직 하지 않았습니다.**
승인·서버 검증 없이 이 프론트 코드를 운영 배포하면 조회 함수가 없어 실패합니다.

- 조회만 이전: 기존 n8n `crm-write` 및 대기 중인 쓰기 요청은 그대로 유지합니다.
- 로그인 전 예열 제거, 2분 자동조회, 동시 조회 합치기, 실패 시 n8n fallback 없음.
- 기존 비계정별 고객 캐시는 새 조회에서 사용하지 않습니다.
- SQL: `sql/20260905_crm_direct_read.sql` / 테스트: `tests/crm-read.test.cjs`.
- 기존 `crm_bundle()`의 익명·일반 사용자 전체조회 우회를 막는 권한 축소가 포함됩니다.
- 상세 승인 범위·검증 계획: [조회 이전](docs/crm-direct-read-migration.md).

## 신규 개발 기준 — n8n 비의존

2026-09-05 확정: **새 기능에 n8n 의존성을 추가하지 않는다.**
PC·모바일은 같은 DB 함수와 권한 규칙을 사용한다.

- 단순 조회/독립적인 저장: Supabase Data API + 최소 권한 + RLS.
- 중요한 업무 변경: DB RPC 트랜잭션. 담당·단계·확장전환·병합은 브라우저 다중 저장 금지.
- 외부 API·비밀키·외부 콜백·파일 가공: Edge Function.
- 파일: 비공개 Storage. 실시간 반영: Realtime 변경 알림 + 필요한 데이터 재조회.
- 예약: DB 데이터 + 스케줄러. 앱을 닫아도 실행해야 하는 작업은 앱 조회에 의존하지 않는다.

상세 경계와 배포 검증은 [아키텍처 결정](docs/architecture-001-supabase-first.md),
기존 기능 이전은 [n8n 전환 계획](docs/n8n-exit-plan.md)을 따른다.
**아래 그림과 기존 운영 반영 설명은 현재 레거시 경로다. 이전 완료를 뜻하지 않는다.**

```text
https://poursolution.github.io/netform-crm/
                 │
        ┌────────┴────────┐
        PC              모바일
        │                 │
     crm.html         mobile.html
        └────────┬────────┘
              crm-api
              crm-write
                 │
              Supabase
```

## 운영 주소

- PC: `https://poursolution.github.io/netform-crm/?view=pc`
- 모바일: `https://poursolution.github.io/netform-crm/?view=mobile`

`index.html`이 `view` 값과 기기 환경을 확인해 `crm.html` 또는 `mobile.html`을 전체 화면으로 불러옵니다. 사용자가 PC/모바일 전환 버튼을 누르면 선택값과 주소가 함께 갱신됩니다.

## 파일

- `index.html`: PC/모바일 통합 진입점
- `crm.html`: PC 관리 CRM
- `mobile.html`: 모바일 CRM

기존 PC와 모바일은 동일한 `crm-api` 읽기 경로와 `crm-write` 쓰기 큐를 사용합니다. 이전 시 내부 데이터 구조, `STAGE_MASTER`, 사업유형, 변경근거와 미완료 요청의 식별자를 보존합니다. 신규 기능은 위 n8n 비의존 기준을 따릅니다.

## 로그인 · 권한

기기는 어떤 화면을 보여줄지만 정하고, 데이터 접근 범위는 로그인 권한이 정합니다.

```text
기기 판단    PC → PC UI          모바일 → 모바일 UI
로그인
권한 판단    rep   → 내 영업
             admin → 관리
             dual  → 내 영업 ⇄ 관리 전환
```

## 운영 참고

- 인증은 서버의 Auth/JWT 및 RLS 정책을 기준으로 강화해야 합니다.
- 현재 PC와 모바일은 같은 서버 데이터를 주기적으로 다시 조회하고, 화면 복귀 시 즉시 갱신합니다.
- 완전한 실시간 반영이 필요하면 Supabase Realtime 연결을 추가합니다.

## 영업기회 공종 데이터

공종은 현장(아파트)의 고정 속성이 아니라 각 영업기회에 저장합니다. 따라서 한 아파트에서도 연도·공사별로 서로 다른 공종의 영업기회를 만들 수 있습니다.

- `primaryWork`: 대표 공종 1개 (`대분류>세부공종`)
- `workItems[]`: 선택한 전체 공종
- `workScopeType`: `single` 또는 `multi` 자동 판정
- `workSummary`: 화면 표시용 요약
- 기존 `work_type`/`gj`: 읽기 호환용. 새 저장의 정본은 위 구조화 필드입니다.

선택지는 옥상(싱글·금속기와·듀얼·우레탄·PVC), 재도장(외+내부·외부·내부), 지하주차장(에폭시·배면차수·지하주차장 재도장), 기타 직접 입력입니다. 두 개 이상 선택하면 복합공종으로 판정하고 대표 공종을 요구합니다. 기존 미입력 데이터는 자동 추정해 저장하지 않고 `공종 미분류`로 유지합니다.

운영 Supabase에는 2026-09-05에 [`sql/20260905_opportunity_work_types.sql`](sql/20260905_opportunity_work_types.sql)을 적용했습니다. `crm-write`에는 `opportunity_work_set` RPC 분기와 `opportunity_create` 구조화 필드 저장을 연결했습니다. 다른 환경에 배포할 때는 해당 환경의 `crm_bundle()` 정의를 먼저 확인한 뒤 같은 마이그레이션과 분기를 적용합니다.

## 관계관리 메시징 엔진

PC·모바일의 문자/카카오 버튼은 빈 외부 앱을 바로 여는 대신 현재 Stage, 마지막 실제 고객 접촉, 공종, 다음 행동을 기준으로 2~3개의 문구만 추천합니다. 담당자가 문구를 확인·수정하고 외부 앱에서 보낸 뒤 `실제 발송 완료`를 눌러야 활동과 다음 행동이 저장됩니다. 외부 앱을 열거나 문구를 복사한 것만으로는 발송 성공을 기록하지 않습니다.

- `lastMeaningfulContactAt`: 실제 통화 완료, 고객 회신, 미팅·현장방문처럼 양방향 의미가 확인된 접촉만 갱신합니다.
- `lastOutboundAt`: 문자·카카오 발송 완료 확인 시 갱신합니다. 이 값은 관계 주기를 초기화하지 않습니다.
- 관계관리·안부·재영업 문구는 광고성으로 취급하며 연락처별 채널 동의, 동의일시, 무료 수신거부 정보, 발송 가능 시간을 모두 확인합니다.
- 수신거부 연락처와 장기 무응답 휴면 고객은 자동 관계관리 발송 대상에서 제외합니다.
- 웹에서는 특정 전화번호의 카카오 1:1 대화방을 직접 열 수 없으므로 받는 번호와 문구를 복사하고 카카오 앱을 엽니다.

관계 인텔리전스는 발송량을 늘리는 기능이 아니라 연락 판단을 돕는 안전장치입니다. PC·모바일 상세에서 고객 온도(`HOT/WARM/COOL/DORMANT`), 관계 점수, 무응답 `n/3`, 같은 연락처의 최근 30일 메시지 수, 연락 이유, Next Best Action, 발송 보류 이유를 함께 표시합니다.

- 고객 응답이 기록되면 무응답 횟수를 0으로 초기화하고 기존 관계관리 Cadence를 재검토 상태로 돌립니다.
- 무응답 3회 또는 최근 30일 3회 이상이면 일반 관계관리 발송을 중지하고, 필수 정보성 안내만 별도 확인 후 허용합니다.
- 발송 목적은 `관계 유지 / 공사 일정 확인 / 견적 후속 / 자료 제공 / 재활성 / 대기 종료 / 확장 영업 / 명절 인사` 중 하나로 저장합니다.
- 템플릿은 `승인 / 추천 초안 / 자유작성` 등급을 저장합니다. 승인 템플릿도 담당자가 내용을 수정하면 해당 발송 이력은 `자유작성`으로 기록합니다.
- 메시지 성과는 발송 수가 아니라 `발송 → 응답 → Next Action → Stage 전진`으로 연결합니다.
- 수주 후 미영업 공종은 확장 후보, 실주 후 일정 기간이 지난 고객은 사유별 재활성 후보로 담당자의 관계관리 목록에 다시 올립니다.

운영 반영 순서:

1. [`sql/20260905_relationship_messaging.sql`](sql/20260905_relationship_messaging.sql)을 Supabase에 적용합니다.
2. `crm-write`의 `contact_upsert` 분기에서 기존 `crm_contact_upsert` 뒤에 `crm_contact_consent_upsert(payload)`를 호출합니다.
3. `crm-write`에 `message_log` 분기를 추가해 `crm_message_log(payload || {write_id})`를 호출합니다.
4. `relationship_response`, `message_stage_advanced`, `relationship_hold` 분기를 각각 `crm_relationship_response`, `crm_message_stage_advanced`, `crm_relationship_hold` RPC에 연결합니다. 고객 응답 시 아직 실행되지 않은 메시지 발송 Next Action은 삭제하지 말고 `재검토` 상태로 바꿉니다.
5. [`sql/20260905_contextual_message_composer.sql`](sql/20260905_contextual_message_composer.sql)을 적용해 개별 Deal 발송의 현장·견적 Version·첨부 참조를 저장합니다.
6. 무료 수신거부 번호가 확정되면 PC·모바일의 `nf_rel_free_optout` 설정값을 관리 설정 화면에서 저장하도록 연결합니다. 값이 없는 현재 상태에서는 광고성 문구 발송 버튼이 의도적으로 비활성화됩니다.

### Contextual Message Composer

개별 현장 상세의 `문자 / 카카오 / 자료발송`은 `문자발송` 메뉴로 이동하지 않습니다. PC는 현재 Deal 위에 우측 Drawer를, 모바일은 Bottom Sheet를 열어 현장·연락처·Stage·공종·최근 접촉·현재 Next Action을 유지한 채 발송을 끝냅니다.

- 견적 단계에서는 최신 견적 Version, 마지막 발송 시점과 미응답 기간을 보고 `견적 발송 안내 / 견적 확인 요청 / 수정 견적 안내` 문구를 우선 추천합니다.
- 발송 문구는 수정할 수 있고, 문자와 카카오는 같은 동의·수신거부·빈도 검증 및 메시지 로그를 공유합니다.
- 발송 완료를 확인한 경우에만 `message_log`, Opportunity Activity, `lastOutboundAt`, 선택한 견적 Version·파일 참조와 후속 Next Action을 함께 저장합니다.
- 외부 문자·카카오 앱의 바이너리 파일 자동 첨부는 공급자/API 지원이 필요합니다. 현재 UI는 선택한 견적 Version과 파일 참조를 CRM 이력에 남기며, 직접 앱을 여는 방식에서는 사용자가 파일을 확인해 첨부합니다.
- 사이드바 `문자발송`은 여러 고객의 일괄·예약 발송 전용이며, 개별 Deal과 Campaign은 엔진·템플릿·검증·발송로그를 공유합니다.

## 문자발송 Campaign Center

PC 사이드바의 `문자발송`은 개별 현장 문자 버튼과 별개인 관리자용 Campaign Center입니다. `Stage / 최근 유효접촉 / 수주·실주 / 공종 / 담당자 / 사업유형 / 지역 / 관계온도`로 고객군을 추출하고, 아래 순서로만 발송 대기열에 등록합니다.

`대상 선택 → 템플릿 선택 → 개인화 미리보기 → 즉시·예약 발송 요청`

- 같은 휴대폰이 여러 Contact·영업기회에 연결되어 있어도 한 캠페인에서는 한 번만 포함합니다.
- `+82 10` 형식은 `010`으로 정규화하고, 휴대폰 형식·수신동의·수신거부·최근 30일 과다발송을 발송 전에 검사합니다.
- `[관리소장명] / [현장명] / [담당자명] / [공종요약] / [회사명]`을 대상별 실제 값으로 치환한 샘플 3명을 확인합니다.
- 브라우저는 발송 성공을 직접 기록하지 않습니다. `campaign_create`로 `queued/scheduled` 요청만 저장하고 문자 공급자의 성공 콜백 뒤에 Campaign·개별 Message Log·Opportunity Activity를 확정합니다.
- 성과는 `발송 → 응답 → Next Action → Stage 전진 → 수주`로 집계합니다.

서버 반영 순서:

1. [`sql/20260905_relationship_messaging.sql`](sql/20260905_relationship_messaging.sql)을 먼저 적용합니다.
2. [`sql/20260905_campaign_center.sql`](sql/20260905_campaign_center.sql)을 적용합니다.
3. `crm-write`에 `campaign_create → crm_campaign_create(payload || {write_id})` 분기를 연결합니다.
4. 문자 공급자 발송 결과 webhook은 `crm_campaign_delivery(payload)`를 호출합니다. 성공 콜백 전에는 `sent`로 바꾸지 않습니다.
5. `crm-api` 번들의 `campaigns`에 `crm_campaigns_json()` 결과를 포함합니다.

## 영업사원 관리

PC 관리 메뉴의 `영업사원 관리`는 본사 영업관리팀 6명(황윤선·이필선·한준엽·정정훈·김성민·조현식)만 대상으로 하는 People Control Tower입니다. 경남지사 인원은 포함하지 않습니다.

- `배정 → 최초응대 → 영업기회 → 경쟁·입찰 → 수주`는 대시보드 담당자 흐름과 같은 계산을 재사용합니다.
- Stage 변경이력이 없는 기간은 전진 `0건`으로 단정하지 않고 `수집 중`으로 표시합니다.
- 오늘 관리자 개입, 담당자별 Stage 병목, 지난 7일 움직임, 미응대·Next 없음·기한초과·장기정체, 업무량 균형을 한 화면에서 연결합니다.
- 업무량은 견적문의 배정창과 같은 `진행 + 신규배정×2 + 기한초과×3 + (오늘 일정+미응대)×2` 점수를 사용합니다.
- 관리자 코멘트는 주차별 약속으로 저장하며 평가점수에는 포함하지 않습니다.

### 고객관리 지원

`영업사원 관리`의 고객관리 지원 영역은 `유대관계 강화 → 침묵관리 → 대기고객 → 재활성`을 관리자 행동으로 연결합니다. 관리자가 고객관계를 대신 수행하는 화면이 아니라, 담당자에게 연락 이유와 완료 기준을 분명하게 전달하는 지원 허브입니다.

- 배정 후 3시간 이상 최초응대가 없으면 `응대 요청` 대상으로 표시합니다.
- 유대강화는 30일 접촉 주기와 입대의 일정 기록을, 침묵관리는 무응답 기간·발신 횟수를 확인합니다.
- 대기고객은 보류 사유와 재접촉일을 필수 근거로 사용하고, 재접촉일 도래·초과를 최우선으로 올립니다.
- 문자 버튼은 현재 현장 안의 Contextual Message Composer를 열며, 수신동의와 발송빈도 검수는 그대로 유지합니다. 다수 고객은 별도 `문자발송` Campaign Center에서 처리합니다.
- 지원 요청 자체와 실제 완료를 구분합니다. 완료 여부는 통화·문자 Activity, Next Action, 입대의 일정, 대기사유, Stage 변경처럼 실제 CRM 데이터로 확인합니다.

서버 반영 순서:

1. [`sql/20260905_sales_rep_management.sql`](sql/20260905_sales_rep_management.sql)을 적용합니다.
2. `crm-write`에 `rep_manager_comment → crm_rep_manager_comment_upsert(payload)` 분기를 연결합니다.
3. `crm-api` 번들의 `rep_manager_comments`에 `crm_rep_manager_comments_json()` 결과를 포함합니다.
4. [`sql/20260905_customer_support_actions.sql`](sql/20260905_customer_support_actions.sql)을 적용합니다.
5. `crm-write`에 `customer_support_action → crm_customer_support_action_upsert(payload)` 분기를 연결합니다.
6. `crm-api` 번들의 `customerSupportActions`에 `crm_customer_support_actions_json()` 결과를 포함합니다.

## 영업 실행 엔진

모바일 영업사원은 로그인 후 `오늘`을 별도 홈으로 사용합니다. 업무는 `기한초과 / 오늘 할 일 / 이번 주 방문 / 새로 배정`으로 분리되며 각 건에서 전화, 완료, 연기를 바로 처리합니다. 방문 동선 추천은 두 현장에 유효한 위도·경도가 있을 때만 10km 안의 거리를 계산하며, 위치가 없을 때 임의의 거리를 표시하지 않습니다.

PC·모바일 현장 상세에는 다음 기능을 같은 영업기회 데이터로 연결합니다.

- 단계별 실행 체크리스트: 현재 Stage가 바뀌면 해당 단계의 영업 매뉴얼로 전환
- 고객 관계도: 여러 연락처에 의사결정 역할과 관계 상태 저장
- 견적 Version: V1·V2·V3와 조정 사유를 보존하고 최종 계약금액과 비교
- 자동 인수인계 요약: 담당자 변경 시 현재 단계·금액·핵심 고객·최근 진행·다음 행동을 생성
- 잠든 고객 깨우기: 침묵·대기·유대관리 및 장기 미접촉 현장을 재접촉 후보로 추천
- CRM에게 물어보기: 오늘 전화, 담당자별 장기 미접촉, 이번 주 방문, 고액 Next Action 누락, 기술자문 전환 등을 조건 검색

서버 반영 순서:

1. [`sql/20260905_sales_execution_engine.sql`](sql/20260905_sales_execution_engine.sql)을 Supabase에 적용합니다.
2. `crm-write`에 `contact_relationship`, `quote_version`, `stage_check`, `handover` 분기를 추가하고, 각 분기에서 `payload`에 바깥 요청의 `write_id`를 합친 뒤 각각 `crm_contact_relationship_upsert`, `crm_quote_version_add`, `crm_stage_check_set`, `crm_handover_add` RPC로 연결합니다.
3. 현장 좌표는 `organizations.latitude/longitude`에 저장합니다. 거리 추천은 좌표가 확인된 현장만 대상으로 합니다.

## 현장 사진·자료와 빠른 현장

현장 파일은 HTML 또는 `localStorage`에 base64로 저장하지 않습니다. 브라우저는 파일명·분류·태그·설명 같은 메타데이터만 들고 있으며, 원본은 비공개 Supabase Storage 버킷 `crm-site-files`에 `opportunity_id/attachment_id/file_name` 구조로 저장합니다. 파일당 상한은 20MB입니다.

- 분류: `현장사진 / 견적자료 / 도면 / 회의자료 / 계약관련 / 기타`
- 사진 태그: `현장방문 전 / 현장확인 / 공사범위 / 문제부위`
- 즐겨찾기·최근 본 현장·최근 작업 현장은 `user_key + opportunity_id` 기준으로 저장해 PC와 모바일에서 공유합니다.
- 단계 체크리스트는 연락처, 공종, 활동, 견적, 다음 행동, 첨부파일을 읽어 자동 완료하며 사람이 직접 체크할 항목만 남깁니다.
- CRM 질의 1차 버전은 질문을 구조화된 조건으로 변환하는 읽기 전용 검색입니다. 실제 조회된 영업기회만 결과로 표시합니다.

서버 반영 순서:

1. [`sql/20260905_attachments_favorites.sql`](sql/20260905_attachments_favorites.sql)을 Supabase에 적용합니다.
2. `crm-write`에 `attachment_prepare` 분기를 추가합니다. 서버가 `crm_attachment_prepare_meta(payload || {write_id})`를 호출한 뒤 Supabase Storage signed upload URL을 만들어 `attachment_id`, `object_path`, `upload_url`을 반환해야 합니다.
3. `attachment_complete`는 Storage 객체 존재 여부를 확인하는 `crm_attachment_complete`, 실패 시 `crm_attachment_mark_failed`에 연결합니다.
4. `favorite_set`, `opportunity_touch`는 각각 `crm_favorite_set`, `crm_opportunity_touch` RPC에 연결합니다.
5. `crm-api`는 로그인 사용자의 `crm_user_opportunity_states(user_key)` 결과를 각 딜의 `favorite`, `last_viewed_at`, `last_worked_at`에 병합합니다. 첨부 메타데이터는 `crm_bundle()`의 `attachments`에서 내려옵니다. 다운로드는 공개 URL이 아니라 필요할 때만 signed download URL을 발급합니다.

## 경남지사 운영 단위

경남지사는 본사 내부 영업과 다른 운영 단위로 관리합니다. 운영 소속은 `team=gyeongnam`, 대표 보고 분류는 `reporting_group=external`이며, 이 두 값을 이름 조건문 대신 담당자 Master에서 읽습니다.

- 견적문의 직접 배정: `inquiry_assignable=true`인 본사 영업 6명(황윤선·이필선·한준엽·정정훈·김성민·조현식)
- 초기 지사 구성원: 조민준, 김훈. 견적문의 본사 배정창에는 노출하지 않습니다.
- 지사 우선 인계 Pool: `경남지사 미지정`
- 견적문의 배정창: 본사 영업 6명 / 경남지사로 인계
- 경남지사 페이지: 조민준 / 김훈 / 미지정 중 실담당자 지정
- 경남지사 페이지: 배정 → 담당자 지정 → 최초응대 → 영업기회 → 경쟁·입찰 → 수주 Funnel, 본사 인계표, 지사 담당자 흐름, 위험, 6개월 추이
- 내부 `관리팀 KPI`와 `담당자 실적`: 경남지사 실행 데이터 제외
- `리포트 · 대표 보고`: 회사 전체 유효 실적에는 모두 포함하되, 개인 비교는 내부영업 6명과 외부영업·경남지사만 분리 표시

사람 역할은 `sales_people`의 명시 속성으로 관리합니다. 등록되지 않은 이름을 자동으로 `외부`로 간주하지 않습니다.

- 내부 영업: 황윤선·이필선·한준엽·정정훈·김성민·조현식 (`sales_rep=true`, `performance_included=true`)
- 대표이사: 이승우 (`role=ceo`, 개인 영업실적 비교 제외)
- 회사직원/상담: 조재연 (`role=consultation`, `inquiry_consultable=true`, Pipeline·영업실적 제외)
- 회사직원: 주현진 (`role=company_employee`, 개인 영업실적 비교 제외)
- 외부영업: 전용성·조성용 (`role=external_sales`)
- 경남지사: 조민준·김훈 (`role=branch_sales`)
- 제외: 한인규 (`active=false`)

견적문의는 `상담담당`과 `영업담당`을 분리합니다. 조재연이 최초 상담을 해도 영업담당은 `미배정`으로 남고, 본사 영업 6명 또는 경남지사에 인계된 시점부터 영업 귀속이 시작됩니다. 상담 기록은 접수 운영지표에만 사용하며 Pipeline과 영업실적에는 포함하지 않습니다.

서버 반영 순서:

1. [`sql/20260905_gyeongnam_branch.sql`](sql/20260905_gyeongnam_branch.sql)을 Supabase에 적용합니다.
2. [`sql/20260905_people_roles_and_consultation.sql`](sql/20260905_people_roles_and_consultation.sql)을 적용해 역할 속성, 상담담당 필드와 RPC를 추가합니다.
3. `crm-api` 번들에 `crm_sales_people()` 결과를 `sales_people` 배열로 포함하고, 문의에는 `consultant_name`, `consulted_at`, `consultation_status`, `sales_assigned_at`을 내려줍니다.
4. `crm-write`의 `inquiry_assign`은 `crm_inquiry_assign`, `inquiry_consultant`는 `crm_inquiry_set_consultant` RPC에 연결합니다.
5. 영업기회 생성 시 견적문의의 영업 귀속 필드만 복사하고, 상담담당은 유입 이력으로 별도 보존합니다.

## 견적문의와 기술자문 경계

`기술자문`은 견적문의 유입 브랜드가 아니라 Pipeline의 영업기회 사업유형입니다. 따라서 견적문의의 브랜드 칩, 활성 건수, 미배정·응대·메이드·배정 KPI와 담당자 업무부하에서는 항상 제외합니다. 직접 기술자문 영업 등록과 기존 POUR솔루션·아파트스퀘어 영업기회의 기술자문 전환은 계속 허용합니다.

기존 데이터에서 브랜드가 `기술자문`인 문의는 자동 삭제하거나 정상 문의로 임의 변경하지 않습니다. 견적문의 Control Center의 `기존 기술자문 확인` 탭에만 표시하고 관리자가 다음 중 하나를 확정합니다.

- 실제 견적문의: POUR솔루션·POUR공법·아파트스퀘어 등 실제 유입 브랜드로 재분류
- 기술자문 영업: 원본 문의를 보존한 채 기술자문 영업기회를 만들고 유입 이력을 연결

서버 반영 순서:

1. [`sql/20260905_technical_inquiry_boundary.sql`](sql/20260905_technical_inquiry_boundary.sql)을 Supabase에 적용합니다.
2. `crm-write`에 `inquiry_reclassify` 분기를 추가해 브랜드, `legacy_review_status`, 검토자·검토시각을 저장합니다.
3. 기술자문 영업기회 이관은 기존 `opportunity_create`와 `inquiry_status` 분기를 사용하고 `origin_inquiry_id`를 보존합니다.
4. 서버 KPI 쿼리도 `regexp_replace(coalesce(brand,''),'\s','','g') <> '기술자문'` 조건을 적용해 화면과 같은 정본을 사용합니다.

## 아파트스퀘어 운영시스템 연동

`아파트스퀘어`는 CRM의 사업유형 표시만으로 끝내지 않고, 계약 뒤 생성되는 ASQ 설계·감리 프로젝트와 같은 영업기회를 연결합니다. 두 시스템의 정본은 다음처럼 분리합니다.

- CRM 정본: 고객·현장, 연락처, 영업담당자, 영업 Stage, 예상/수주금액, 고객관계
- ASQ 정본: 설계·감리 유형, 프로젝트 상태, 감리담당자, 계약·착공·준공 일정, 방문일, 감리보고서 상태

CRM은 ASQ 운영정보를 수정하지 않고 `crm-api.asq_projects` 배열을 읽어 아파트스퀘어 Deal 상세의 `아파트스퀘어 운영현황`과 고객 자산의 `ASQ 수행 이력`에 표시합니다. 연결 데이터가 없을 때는 상태를 추정하거나 임의 생성하지 않고 `연결 대기`로 표시합니다.

연결 키:

- `site_id`: 두 시스템의 동일 고객/아파트 식별자
- `opportunity_id`: CRM 영업기회 식별자
- `asq_project_id`: ASQ 운영 프로젝트 식별자

서버 반영 순서:

1. [`sql/20260905_apartment_square_integration.sql`](sql/20260905_apartment_square_integration.sql)을 Supabase에 적용합니다.
2. ASQ API 또는 Webhook에서 프로젝트 변경을 받는 n8n 서버 워크플로를 구성합니다. 브라우저에서 ASQ 자격증명을 사용하지 않습니다.
3. 서버 워크플로는 `site_id / opportunity_id / asq_project_id` 매핑을 검증한 뒤 `crm_asq_project_sync(payload)`를 호출합니다.
4. `crm-api` 번들에 `asq_projects: crm_asq_projects_json()`을 포함합니다.
5. `project_url`은 사용자가 접근 가능한 HTTPS 주소만 반환합니다. CRM은 해당 주소를 새 창으로 여는 기능만 제공합니다.

ASQ 연결 payload의 최소 필드는 `opportunity_id`, `site_id`, `asq_project_id`이며, 운영 필드는 `service_type`, `project_status`, `supervisor_name`, `contract_amount`, `contract_signed_at`, `contract_started_at`, `contract_ended_at`, `construction_started_at`, `expected_completion_at`, `last_supervision_at`, `next_visit_at`, `report_status`, `source_updated_at`, `project_url`입니다.

## 오늘 홈 · Action-first UX

PC CRM의 기본 진입 화면은 분석 대시보드가 아니라 `오늘 홈`입니다. 사용자가 여러 메뉴를 해석하기 전에 CRM이 실데이터에서 즉시 처리할 대상을 먼저 뽑습니다.

- 견적문의: 미배정, 배정 후 최초응대 지연
- 영업 실행: Next Action 없음, 기한초과, 수주 근접 단계의 장기 무활동
- 관리자 지원: 견적 검토, PT·입찰 지원, 고객관리 지원 등 담당자별 개입 사유
- 관계관리: 약속한 재접촉일 도래, 문자 검토 대상

`오늘 홈`의 우선순위 행을 누르면 별도 페이지를 찾아가지 않고 해당 견적문의 또는 영업기회 상세를 바로 엽니다. 현장 상세 상단에는 현재 단계·금액·현재 문제·다음 행동·연락할 사람을 먼저 표시하고 `전화 / 카카오 / 문자 / 활동기록 / 다음 행동`을 즉시 실행할 수 있게 합니다.

기존 `문자발송` 메뉴는 `고객 실행센터`로 확장해 재접촉, 침묵고객, Lost 복구, 기존고객 확장과 문자 실행을 같은 대상 선택 흐름으로 연결합니다. 대시보드·담당자 실적·대표 보고는 분석 메뉴에 유지하며 오늘 업무와 관리자 개입 화면을 대신하지 않습니다.

## Closed Won 이후 확장관리

`확장단계`는 Active Pipeline Stage에서 제거합니다. 영업기회는 `계약 → 시공 → 준공 → Closed Won`에서 종료하고, 완료 고객의 재접촉과 Cross-sell 탐색은 별도 `확장관리` Pool에서 수행합니다.

- `준공 확인 + Closed Won` 시 기존 Deal을 다시 열지 않고 확장관리 대상이 자동 생성됩니다. 준공 근거가 없는 과거 수주는 자동 편입하지 않습니다.
- 최초 관리일은 준공·Closed Won 후 30일로 추천합니다.
- Pool 상태는 `신규 대상 / 접촉 예정 / 관계 관리중 / 추가 니즈 확인 / 신규 영업기회 생성 / 보류·휴면`으로 관리합니다.
- 기존 공종과 사업유형을 기반으로 추가 공종 후보를 추천하지만 영업기회는 자동 생성하지 않습니다.
- 실제 니즈를 확인한 뒤 `신규 영업기회 만들기`를 눌러야 새 Deal이 생성됩니다.
- 새 Deal에는 `source_opportunity_id`와 `origin_source=existing_customer_expansion`을 저장해 기존고객 확장 매출을 구분합니다.
- 확장관리의 전화·문자·카카오는 현장 맥락을 유지한 Contextual Message Composer를 사용합니다.
- 고객 자산은 기존 Closed Won Deal, 확장관리 Record, 확장에서 파생된 신규 Deal을 함께 보여줍니다.

서버 반영 순서:

1. [`sql/20260905_expansion_management.sql`](sql/20260905_expansion_management.sql)을 Supabase에 적용합니다.
2. `crm-api` 번들에 `crm_expansion_pool_json()` 결과를 `expansion_pool` 키로 포함합니다.
3. `crm-write`에 `expansion_pool_upsert`, `expansion_pool_update` 분기를 추가하고 각각 `crm_expansion_pool_upsert`, `crm_expansion_pool_update` RPC에 연결합니다.
4. 기존 `opportunity_create` 분기가 `source_opportunity_id`, `origin_source`를 저장하도록 확장합니다.
5. 적용 전 UI는 Closed Won Deal에서 Pool을 파생해 보여주지만, 상태·다음 접촉일의 영구 저장은 위 서버 연결이 완료되어야 보장됩니다.

## 다음 행동 선택 간소화

현장 상세와 파이프라인 빠른 등록의 다음 행동은 활동기록용 `ACTIVITY_TYPES`를 재사용하지 않습니다. `next-action-picker.js`의 공용 정본으로 전화 / 메시지 / 이메일·자료발송 / 방문·미팅 / 견적·자료 준비 / 후속접촉 / 입찰·계약 업무 / 기타 8개만 보여줍니다. 메시지는 문자·카카오, 방문·미팅은 현장방문·회의·PT·현장설명을 2차 선택합니다.

저장 `type`은 기존 세부유형을 유지하여 채널, 일정 분류, 모바일 표시, 서버 쓰기와 호환됩니다. 기존 사진·메모 등으로 저장된 예약은 기타로 보여주되 원래 유형·내용을 자동 변경하지 않습니다. 새 사진·메모는 활동기록/첨부에서 작성합니다. 견적 발송완료는 3일 후 후속접촉, 경쟁 단계는 PT 일정 확인을 추천하며 사용자가 눌러 입력한 뒤 저장해야 반영됩니다.

검증: `node --test tests/next-action-picker.test.cjs` / 외부 요청 없는 `tests/next-action-picker-ui.html`.

## 데이터 정리 / 중복 해결센터 (2026-09-05)

`중복현장` 메뉴를 `데이터 정리`로 교체했습니다. 기존 `dup` 라우트는 링크 호환을 위해 유지합니다.

- 검토 필요 / 현장 중복 / 문의 중복 / 연락처 확인 / 처리 이력 탭을 제공합니다.
- 후보는 검토 **쌍** 기준이며, 현재 로드된 데이터에서 탐지합니다. 주소·전화·이름·공종·사업유형·등록 시기를 근거로 추천하지만 자동 확정하지 않습니다.
- 같은 현장 다른 공종·사업유형은 Site 연결, 같은 휴대전화 다른 현장은 사람 이동 검토, 같은 공종·근접 시기 영업은 Deal 검토로 분리합니다. 상담/영업담당 차이는 중복 판단 근거가 아닙니다.
- 두 원본 비교 → 처리 방식·기준 선택 → 사유 → 서버 최신 결과 미리보기 → 확인 체크 → 처리 순서입니다.
- 현장 통합은 `crm_cleanup_sites`와 `crm_cleanup_links`의 **정본 Site 연결**입니다. 원래 organization/deal/inquiry/contact ID와 각 ID에 연결된 이력·견적·첨부·금액을 삭제하거나 덮어쓰지 않습니다.
- 문의 병합/활동 연결은 원본을 보존하고 `duplicate_resolution=merged/activity`로 활성 문의 집계에서 제외합니다. 영업기회에 연결된 문의는 병합 차단 후 Site 연결을 권합니다.
- 사람 이동은 확인일·두 현장·사유를 별도 이력에 저장합니다. 연락처나 현장 원본을 합치지 않습니다. 고객 자산 관계 타임라인에서 확인할 수 있습니다.
- `영업기회 중복 검토`는 검토 기록만 저장합니다. Deal 물리 병합·실적 재귀속은 수행하지 않습니다.
- 처리/보류/별도 유지 이력은 서버에 저장합니다. 미리보기 fingerprint로 원본 변경을 감지하며, 요청 ID로 중복 실행을 방지합니다. 관리자 인증과 명시적인 성공 응답 없이는 완료로 표시하지 않습니다.

### 운영 반영 필요 (이번 작업에서는 실행하지 않음)

1. 백업 후 `sql/20260905_data_cleanup.sql`을 검증 환경에서 먼저 실행합니다. `organizations`, `deals`, `inquiries`, `contacts`, `users` 및 기존 문의 Control Center 컬럼이 필요합니다. 선택 테이블(노트·견적Version·첨부)이 없으면 미리보기에서 `미연결`로 표시합니다.
2. SQL의 관리자 role 허용 목록을 운영 `users.role` 값과 확인합니다. 프런트엔드 이름으로 권한을 결정하지 않습니다.
3. `crm-api`의 기존 권한 검증 이후, 반환 번들을 서비스 역할의 `crm_cleanup_bundle(기존번들)`로 투영합니다. PC·모바일 모두 정본 Site 연결과 문의 활성/보존 구분을 동일하게 받도록 합니다. 브라우저에 service key를 넣지 않습니다.
4. 정리 UI는 로그인 토큰으로 `crm_cleanup_state`, `crm_cleanup_preview`, `crm_cleanup_apply`를 직접 호출합니다. n8n의 범용 write ACK나 localStorage로 병합을 성공 처리하지 않습니다. RPC 미설치·권한 부족 시 저장은 차단됩니다.
5. 검증 환경에서 Site 연결 전후 Deal/수주금액/첨부/견적Version 보존, 문의 병합 후 활성집계 제외·원본 보존, 사람 이동 후 양쪽 현장 유지, 새로고침·다른 계정/기기 조회를 확인한 뒤 배포합니다.

검증: `node --test tests/data-cleanup*.test.cjs` (분류·JS 구문·저장 실패·ACK 검증·변경된 미리보기 차단).
`tests/data-cleanup-ui.html`은 외부 요청 없는 가상 데이터 UI 검증용입니다. 운영 데이터로 테스트 병합하지 마세요.
# 금액 입력 쉼표 (2026-09-05, 로컬 반영)

PC·모바일의 견적 Version, 신규 영업 예상금액, 상세 견적/예상/수주금액, 문의→Pipeline 전환 금액에 `data-money`와 공유 `money-input.js`를 적용한다. 초기 표시·입력·붙여넣기에서 천 단위 쉼표를 유지하고 저장은 `MoneyInput.parse`로 숫자 처리한다. 원/만원 단위는 기존대로 유지하며, 전화번호·날짜 등 다른 입력은 변경하지 않는다. 잘못된 금액은 저장을 차단한다. 테스트: `tests/money-input.test.cjs`, 외부 요청 없는 `tests/money-input-ui.html`.

# 메시지 자동 호칭 (2026-09-05, 로컬 반영)

PC·모바일의 견적/관계관리/시즌 메시지와 일괄발송은 `message-salutation.js`를 공유한다. 기본 호칭은 `현장명 + 실제 연락처 직함 + 님`이며 직함이 없으면 `관계자님`, 현장명이 없으면 직함만 사용한다. 이름 데이터와 과거 발송이력·직접 작성한 문구는 수정하지 않는다. 새 템플릿은 `[고객호칭]`을 사용하고, 기존 `[관리소장명]님` 변수도 안전한 호칭으로 치환한다. 연락처 UI의 기본 표시 직함과 실제 메시지용 `messageRole`을 구분하여 누락 직함을 관리소장으로 추정하지 않는다.

검수: `tests/message-salutation.test.cjs`에서 PC·모바일 실제 템플릿 생성, 연락처별 직함, 누락값, 중복 님, 일괄 미리보기를 검사한다. 실제 메시지 발송이나 운영 배포는 하지 않았다.

# 확장관리: 견적 실제 발송 → 새 Pipeline (2026-09-05, 운영 연결 전)

- `expansion-flow.js` / `expansion-pool.js`는 과거 수주 거래·접촉 이력·재영업 시점을 표시한다. 신규 기회는 니즈 확인만으로 생성하지 않는다.
- 상태는 관리대상 / 접촉예정 / 관계관리 / 니즈확인 / Pipeline 전환 / 보류. 이전 저장값은 호환해서 읽는다. 사용자가 완료 상태를 임의 선택할 수 없으며, 전환 완료 이력은 읽기 전용이다.
- 새 Deal 요청은 `code=sent`, `stage_code=sent`, `origin=expansion`, `source_opportunity_id=기존 수주 Deal ID`. 이전 Deal은 수정하거나 다시 열지 않는다.
- 일반 `opportunity_create`의 낙관적 저장 경로를 쓰지 않는다. 전용 서버 트랜잭션의 정확한 ACK 확인 전에는 새 Deal이나 완료 상태를 로컬에 만들지 않는다.

## 운영 적용에 남은 필수 작업 — 아직 발송·DB 검증 완료가 아님

1. 기존 expansion_management SQL 다음에 `sql/20260905_expansion_quote_handoff.sql`을 검토·적용한다. 운영 스키마의 `deals` 단계 표현이 `code/stage_code`가 아니라 FK라면 검증 함수를 실제 정본에 맞게 연결해야 한다. SQL 실행 검증은 아직 하지 않았다.
2. 실제 **신규 견적** 발송 성공 콜백에서 `crm_expansion_quote_dispatches`를 기록한다. 견적 Version ID, 수신자, provider receipt, 발송시각, 공종·금액 snapshot을 보존한다. 기존 수주 견적을 재사용하거나 브라우저의 sent 값/체크박스를 증거로 삼지 않는다. 실패·예약·초안은 전환 대상이 아니다.
3. `crm-write`에 `expansion_quote_convert`를 구현한다. 저장소에는 이 워크플로의 서버 코드가 없어 **아직 이 분기는 미연결**이다. UI의 `견적 발송 확인·전환`은 발송이력 확인 화면이며 견적서를 직접 발송하지 않는다. 실제 견적 발송 UI/콜백과의 연결도 필요하다.
4. 서버는 인증·현재 담당/관리 권한을 확인하고 **하나의 DB 트랜잭션**에서 Pool을 `FOR UPDATE` 잠금 → 이미 전환된 경우 동일 child 반환 → 발송이력/신규 공종/금액/수신자/현장 일치 검증 → 새 Deal 생성 → `crm_expansion_finish` 호출 → commit 한다. Deal 생성과 완료처리를 두 HTTP 쓰기로 나누지 않는다. 실패하면 모두 rollback. idempotency key는 `expansion:<source ID>`이며 반복 클릭/응답 유실 시 중복 Deal을 만들면 안 된다.
5. 성공 응답: `{ok:true, operation:'expansion_quote_convert', source_opportunity_id, new_opportunity_id, quote_dispatch_id, stage_code:'sent', origin:'expansion', expansion_status:'Pipeline 전환'}`. 일반 `{ok:true}`는 완료로 인정하지 않는다. 새 Deal의 실제 전체 데이터는 crm-api 재조회로 가져온다.
6. crm-api 번들에 `expansion_pool`, `expansion_events`, `expansion_quote_dispatches`를 사용자 권한에 맞게 포함한다. 개별 서버 이력 조회는 `crm_expansion_context` RPC, 접촉·니즈 기록은 `crm_expansion_note` RPC를 사용한다. 메시지·전화 결과를 확장 이력에 연결할 때도 원본 고객/Deal과 Pool 연결값을 보존한다.

검수: `node --test tests/*.test.cjs`, 네트워크 없는 `tests/expansion-pool-ui.html`. 실제 견적 발송·실고객 데이터 변경·운영 SQL 적용·배포는 실행하지 않았다.
