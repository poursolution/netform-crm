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
