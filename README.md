# netform-crm — PC / 모바일 통합 CRM

CRM 데이터와 서버 쓰기 구조는 하나이며 사용자 화면만 PC와 모바일로 구분합니다.

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

PC와 모바일은 동일한 `crm-api` 읽기 경로와 `crm-write` 쓰기 큐를 사용합니다. 화면 명칭이나 진입 경로를 변경해도 내부 데이터 구조, `STAGE_MASTER`, 사업유형, 변경근거, 쓰기 큐는 유지합니다.

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
5. 무료 수신거부 번호가 확정되면 PC·모바일의 `nf_rel_free_optout` 설정값을 관리 설정 화면에서 저장하도록 연결합니다. 값이 없는 현재 상태에서는 광고성 문구 발송 버튼이 의도적으로 비활성화됩니다.

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
