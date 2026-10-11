# 견적 v3 모바일 연결 전 서버 계약 확인 — Claude 인수인계

## [단계 1 / 연결 사전 점검] 한 일

기준은 netform-crm master `0b7852e8824abf3740bb12b10b227ee7e3f84c59`(#594)와 승인된 견적 v3 자료다. 운영 프로젝트 `ymfbmpnizxvqsamnczow`의 카탈로그·함수 정의만 SELECT로 확인했다. 고객 행 조회·운영 저장·SQL 설치는 하지 않았다. Claude 작성 SQL은 변경 없이 폐기 가능한 로컬 PGlite에 설치해 확인했다.

## 바뀐 파일

- `verify-quote-server-contract.cjs`: 원본 1단계·4단계 SQL의 로컬 실행 검사. 실제 사용자 권한 함수 대신 합성 actor/can_deal을 사용한다.
- `quote-server-contract-result.json`: 통과 항목과 발견된 결함을 따로 기록.
- 이 문서 및 후보 manifest·진행상태. 앱 코드·디자인·서버 SQL 변경 없음.

## 추가·바꾼 데이터 필드

없음. 아래는 확인된 설치 상태 및 필요한 연결 계약이다.

| 항목 | 운영 카탈로그 확인 결과 |
| --- | --- |
| `public.crm_quote_submit_confirm_v1` | 없음 |
| `crm_security.quote_versions` | 기존 8개 열만 존재: id, deal_id, version_no, amount, reason, actor_auth_uid, actor_user_id, created_at |
| base_amount / submit_amount / markup_items / 문서 연결 열 | 없음 |
| public.crm_quote_requests / crm_labor_rates / crm_cost_rates / crm_material_prices / crm_method_specs / crm_brand_templates | 6개 모두 없음 |
| crm_schedule_list_v1 / crm_schedule_write_v1 / crm_schedule_receipt_v1 / crm_inquiry_response_confirm_v1 | 최초 점검 당시 미설치. 후속 사용자 승인으로 2026-10-11 설치·서버 활성화 완료. 아래 견적 RPC 4개와 구분 |

이 결과는 검사 시점의 설치 상태이며, 저장소 코드가 없다는 뜻이 아니다. 기존 일정·기존 견적 기능 전체가 없다는 뜻도 아니다.

## 실제 모바일 조회 경로

`transport.js`는 영업건을 `crm_operational_source_v1(p_domain='deal_core', p_after, p_limit)`로 페이지 조회한다. 이름을 추정해 다른 함수로 바꾸지 않았다.

운영 함수 정의의 위임 경로를 따라가면 `crm_security.crm_operational_source_fragment_pre_inquiry_response_20260906`에서 quote_versions를 구성한다. 현재 투영은 **version_no, amount, reason, created_at** 네 항목이며 `quote_amount`는 최신 버전의 amount다. `operational-overlay.js`는 이 배열을 quoteVersions로 이어받는다.

따라서 SQL 열만 추가해도 모바일에서 기준금액·제출금액·PDF·수신자를 자동으로 조회할 수 있는 것은 아니다. PC/모바일 공통 읽기 계약에 해당 필드를 명시적으로 포함해야 한다. 이는 서버 함수 정의 확인 결과이며 실계정 화면 응답 대조 완료로 보고하지 않는다.

## 현재 저장소 RPC 계약

`crm_quote_submit_confirm_v1(p jsonb)`:

- 입력: deal_id, version_no(현재 SQL에서는 선택), items, expected_submit, display(line/melt), note.
- items 순서: multiplier → area → flat. 서버가 계산 후 10만원 아래 절삭하고 expected_submit과 비교.
- 권한: actor.permission_role은 rep/branch/admin, can_deal(deal_id,true), 종료 건 차단.
- 저장: 기존 수정본은 유지하고 Vn+1 생성, 영업건 version 증가, audit_events 기록.
- 응답: ok, deal_id, quote_version_id, version_no, amount, base_amount, submit_amount, added, markup_type, markup_items, display, reason, version, audit_event_id, server_at.
- 없는 계약: 고정 operation/request ID, 응답 유실 시 영수증 조회, 원본 버전 및 첨부/PDF 무결성 조회. 재시도는 현재 원본 버전이 바뀌어 PT409가 되므로, 성공 응답 유실 후 완료 여부를 복원하는 계약이 별도로 필요하다.

모바일에서는 **원본 버전을 반드시 고정**해야 하며, 새 계산기를 만들거나 이름이 비슷한 예전 quote_version 명령으로 대신 저장하지 않는다. 모바일 허용 목록은 서버 계약·SQL·CRMRelease 준비와 함께 반영할 사항이다.

## 로컬 실행 검증: 12개 통과, 결함 유형 2개

통과: 원본 SQL 두 파일 설치, 가산 없음·배수·면적·정액·복합 5가지의 공통 JS 결과와 실제 SQL 계산 일치, 같은 원본 버전 재호출 시 중복 최종본 차단, expected_submit 불일치 거절, 범위 밖·미지원 역할·종료 건·anon 차단.

실제 세션/JWT 및 운영 can_deal/RLS는 합성 함수로 대체되어 있으므로 실계정 권한 검증 완료는 아니다. SQL 파일 문자열 검사만으로 통과했다고 표시하지 않았다.

### 1. 잘못된 items가 가산 없음으로 확정됨

원본 V1의 기준금액 170,000,000원, expected_submit=170000000에서 아래 입력 모두 새 V2를 생성했다.

```json
{"items":[{}]}
{"items":[null]}
{"items":[{"type":"none"},{"type":"none"}]}
```

type 없는 요소는 `NOT IN`의 NULL 판정에서 제외된다. none은 허용 이름 검사만 통과하고 실제 계산 목록에서는 무시된다. 가산 없음의 정식 표현을 빈 배열로 할지 단일 none으로 할지 공통 계약에서 정하고, 요소 object/type/필수값·중복/불필요 키를 명시적으로 검증해 달라. 모바일에서만 조용히 정리해서 보내는 것으로 대체하지 않는다.

### 2. 정수 배수 끝자리 0이 이력에서 사라짐

`items=[{"type":"multiplier","value":10}]`, expected_submit=1700000000 입력의 저장 금액은 1,700,000,000원으로 맞지만 reason은 **배수 ×1**이다. 현재 `trim(trailing '0' from v_val::text)`가 정수 끝자리도 지운다. 계산값은 바꾸지 않고 소수부 표시 정리만 하도록 수정·재검증해 달라. 10·20·100 및 1.50 회귀 예시가 필요하다.

이 문서는 수정 요청과 재현 자료다. Codex가 Claude의 서버 계산·PC 디자인을 바꾸지는 않았다.

## Claude에게 필요한 연결 계약

1. PC/모바일 공통 견적 읽기: 요청 ID·영업건 ID·수정본 ID·원본 버전·상태·기준금액·고객 제출금액·기준 버전·PDF/엑셀 ID·안 A/B를 함께 반환. 미확정과 0원을 구분.
2. 요청 생성/보완/앞당기기 요청: 고객 약속일과 내부 예정일 분리. 요청만으로 날짜 확정하지 않음. 기존 일정 유지/변경/추가를 구분.
3. 제출금액 확정: 서버 계산 원본 버전 고정, 위 입력 검증과 이력 문구 수정, 응답 유실 영수증 조회.
4. 발송: 당시 수신자·문서 버전·PDF 고정. 재발송 후속 업무 중복 방지. 앱 이동만으로 발송 완료하지 않음.
5. SQL 설치 확인 → 조회/저장 및 권한 실계정 검증 → 허용 목록·오류 이름·CRMRelease 연결 → 승인된 모바일 그림에 연결 순서.

모바일 9개 화면의 최신 `CODEX_HANDOFF.md` 1-1 표는 전달받은 44 ZIP 안에 없다. 현재 로컬 44는 `design_handoff_quote_v3`만 포함한다. 사용자 메시지의 역할 분담을 우선하고, 없는 화면 배치를 임의 구성하지 않는다.

## PC와 다른 점 / 질문

### 2026-10-11 운영 카탈로그 재확인 및 Q-T 계산 연결 조건

master #596 대조 후 운영 `pg_proc`와 `pg_namespace`에 public·crm_security의 `crm_quote_compose_v1`, `crm_cost_standard_list_v1`, `crm_quote_version_save_v1`, `crm_quote_submit_confirm_v1`을 정확한 이름으로 조회했다. 결과는 **0행**이다. 고객 데이터와 함수 실행 결과를 조회하지 않았고, 기존 SQL·권한·배포를 바꾸지 않았다.

source44 Q-T 원본에는 별도 계산 버튼이 없다. 공법·수량을 바꾸면 기존 5행에 계산 결과를 표시하는 구성이며 하단은 ‘초안 저장 / 확인 요청’이다. 저장 버튼을 계산 버튼으로 바꾸거나 조건 입력칸을 새로 추가하지 않는다. 후보 모델의 네 번째 행은 이번에 원본의 ‘원가계산서 · 확인 필요’로 복원했다.

| 연결 항목 | 확인한 계약 / 서버 담당 확인 필요 |
|---|---|
| 공법 계산 | `crm_quote_compose_v1({p:input})`은 저장 없는 STABLE 함수. 기준 조회는 `crm_cost_standard_list_v1({p:{}})` |
| 신규 계산 조건 | 공법·수량 외에 일반관리·이윤·공사기간·보험·퇴직공제·규모/기간/안전/환경 구간을 사용. 생략값을 모바일의 확정 정책으로 만들지 말고 공통 서버 조건을 반환할 것 |
| 기존 조건 이어받기 | 기존 method 수정본의 basis에 있는 date, work_items, extras, generalPct, profitPct, durationDays, retire, tiers를 고정하여 이어받기. 확정·발송본 조회만으로 현재 기준 재계산 금지 |
| 성공 응답 | ok, date, rows, basis, sheet, rates. sheet.base는 적산 기준금액, sheet.supply는 절삭 전 금액. 고객 제출금액으로 바꾸지 않기 |
| 직접공사비 | 응답에 개별 재료비·노무비·경비만 있고 합계 필드 없음. 원본 행을 표시하려면 서버가 합계를 반환할 것 |
| 기준 결측 | ok:false/missing/rows만 반환할 수 있으며 sheet/date/basis/rates가 없을 수 있음. 일부 행·결측을 정상 금액이나 0원으로 표시 금지 |
| 간단견적·가산 | 계산 전용 RPC가 없음. version_save/submit_confirm은 쓰기 함수이므로 미리보기용 호출 금지 |
| 기준일 | 저장은 `crm_quote_compose_v1(p - 'date')`로 서버 KST 오늘에 재계산. 날짜 지정 미리보기와 저장 기준일을 공통 계약에서 일치시킬 것 |
| 시행 상태 | 계산 SQL은 active 전용이 아니라 `status<>'draft'`로 retired도 선택함. 이 상태의 업무 의미를 서버에서 확인할 것 |
| 현재 PC 경로 | `quote-composer.js`는 기준 조회 뒤 `QuoteCompose.compose()` 로컬 계산. 양쪽 같은 서버 계산 요구를 만족하려면 PC 경로도 함께 정리 필요 |

관련 기본 권한 원칙은 [Supabase API 보안 문서](https://supabase.com/docs/guides/api/securing-your-api)를 확인했다. 이번 미설치·응답 계약 판정은 공식 문서 추정이 아니라 운영 카탈로그와 저장소 소스의 대조 결과다.

### master #596 로컬 소스 후속 대조

후속으로 `ad209245d50bdc46569b9533fdcf3b601936f679`를 대조했다. 아래는 **저장소 코드만 확인한 결과**이며 위 운영 카탈로그의 설치 상태를 다시 조회한 것이 아니다. SQL·PC·모바일 견적 화면·허용 목록을 변경하지 않았다.

- `sql/quote-v3-step6-20261011.sql:13`의 `crm_quote_compose_v1`은 읽기 전용 계산 함수다. 기준 조회 `crm_cost_standard_list_v1`과 함께 Q-T의 공통 계산 후보로 사용할 수 있으나 실제 설치·권한·응답 계약을 먼저 확인해야 한다.
- 같은 SQL의 `crm_quote_version_save_v1`은 111행에서 rep를 허용하고 147행에서 항상 `final`을 저장한다. source44의 **영업사원 공법견적은 초안** 규칙과 충돌하므로 모바일 Q-T 저장을 켜지 않는다. 재시도 식별자·저장 결과 재조회 계약도 필요하다.
- Q-M의 `crm_quote_submit_confirm_v1`은 새 수정본을 만드는 저장 함수다. 저장 전 가산 미리보기로 호출할 수 없다. Q-S의 PC 간단견적 미리보기도 현재 JS 계산이므로 서버 공통 계산 경로가 필요하다.
- K3/K5의 운영 조회는 수정본 UUID·기준금액·제출금액·계산 근거·문서 ID 연결이 선행돼야 한다. `crm_quote_requests` 표가 있다는 사실만으로 K1/K2의 요청·앞당기기 회신이 구현된 것은 아니다.
- 후보 셸은 `mobile-guide-shell.js:202`에서 기존 다음 업무명이 `견적 요청 등록`일 때 K1로 연결한다. 나머지 견적 화면은 검토 주소 외 운영 진입이 연결되지 않았다. 기존 승인된 ‘지금 할 일’에 서버 업무 종류를 연결할 사항이며 새 메뉴·버튼을 추가하지 않는다.

모바일 전용 계산·상태·권한·화면 추가 없음. 새 디자인 결정이 필요하지 않은 검증을 완료했다. 서버 구현과 운영 설치가 남아 있어 견적 v3 모바일 저장을 켜지 않았다. 문서 작성은 Claude에게 메시지를 발송했다는 뜻이 아니다.

참고: [Supabase Database Functions](https://supabase.com/docs/guides/database/functions), 공식 변경 로그를 확인했다. 이번 발견은 문서 추정이 아니라 저장소 SQL 실행 및 해당 운영 카탈로그의 읽기 결과에 근거한다.

## 서버 설치 이후 견적 계약 재확인

2026-10-11 일정·응대·연락처 SQL 설치 이후에도 public/crm_security의 `crm_quote_compose_v1`, `crm_cost_standard_list_v1`, `crm_quote_version_save_v1`, `crm_quote_submit_confirm_v1`을 다시 조회한 결과는 **0행**이었다. 이번 3개 SQL 승인 범위에 견적 SQL 설치는 포함하지 않았다.

master #596 소스에서 추가 확인한 연결 문제는 다음과 같다.

- `sql/quote-v3-step4-20261011.sql`의 제출금액 확정은 Vn+1을 만들지만 `excel_file_id`·`pdf_file_id`를 복사하거나 새 문서를 생성하지 않는다. 기준금액 PDF를 변경된 고객 제출금액의 PDF로 표시하거나 보내면 안 된다. 버전·금액·문서가 일치하는 공통 조회와 생성 계약이 필요하다.
- `quote-composer.js` 및 PC 저장 성공 처리의 로컬 `quote_versions` 행은 반환 `quote_version_id`를 보존하지 않는다. 저장 ACK 뒤 공통 상세를 다시 읽어 UUID·금액·상태·PDF를 함께 확정해야 한다.
- 간단견적·공법견적 저장에는 operation/request UUID와 저장 영수증이 없으며, 재시도 시 새 수정본이 중복될 수 있다. 응답 유실 확인을 새 저장 호출로 대신하지 않는다.
- Q-T의 초안/확인 요청과 서버 `final` 저장 상태, PC 로컬 계산과 서버 계산 경로가 아직 일치하지 않는다. 모바일만 별도 계산·상태·권한을 만들지 않는다.

이 결과는 견적 담당 서버 구현을 위한 계약 인수인계다. 이 문서 갱신으로 PC 견적 SQL·화면·모바일 디자인을 변경하거나 기능을 활성화하지 않았다.
