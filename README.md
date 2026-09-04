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
