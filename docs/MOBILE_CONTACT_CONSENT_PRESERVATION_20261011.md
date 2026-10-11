# [단계 8 후속] PC·모바일 연락처 저장의 생략값 보존

상태: **로컬 구현·합성 검증 완료 / 운영 미적용**. Claude 모바일 원본의 배치·색·글꼴·컴포넌트는 변경하지 않았다. I-3 명함 저장 전체가 완료됐다는 뜻은 아니다.

## 1. 한 일

이름·역할·대표 연락처를 수정하면서 수신동의·수신거부까지 false/null 또는 오래된 조회값으로 덮어쓰던 공통 경로를 수정했다.

- 동의 관련 6필드의 **생략 / 명시 false / 명시 null**을 구분한다. 기존 사람의 번호를 변경할 때 기존 사람의 동의는 자동 승계하지 않는다.
- PC 대표 지정, 연락처 폼, 파이프라인 패널, 명시적 동의 변경을 같은 저장 계약에 연결한다. 연락처만 수정해도 동의 확인 시각이 새 시각으로 바뀌던 처리를 제거했다.
- 서버는 생략한 값을 기존 `(contact_id, deal_id)` 상태와 병합한 뒤 검사한다. 채널 동의와 거부가 동시에 남거나 필요한 확인 시각을 지우는 요청은 전체 취소한다.
- 서버에 실제 저장된 상태와 계약 표식을 저장 receipt에 남긴다. PC는 확인된 응답의 최종 동의 상태를 반영하며 저장 성공 전 로컬 변경·성공 표시를 하지 않는다.
- PC·모바일은 공통 `crm_contact_command_v1`을 사용한다. 미설치 서버에서 기존 쓰기 함수로 우회하지 않는다. 새 adapter와 옛 enqueue 호출이 섞이면 큐 등록 전에 거절한다.
- 같은 로그인 UUID라도 내부 사용자 ID가 바뀐 큐는 송신 전에 거절한다. 재시도는 원래 요청 ID와 payload를 유지한다.
- 옛 모바일 `contactEditSheetM` 진입은 기존 승인 I-3으로 연결한다. 옛 `saveContactM`은 더 이상 저장을 실행하지 않는다. 새 I-3 저장은 미연결 계약 때문에 계속 차단한다.

## 2. 추가·변경한 계약

`crm_contact_command_v1(p_request_id, p_operation, p_object_id, p_expected_version, p_payload)`는 기존 공통 dispatcher를 사용하며 `contact_upsert`만 허용한다. 현재 영업건 수정 권한, 계정 연결, 요청·영업건 버전을 검사한다. 익명 실행을 허용하지 않는다.

응답에는 기존 필드와 아래 값이 함께 필요하다.

```json
{
  "contact_consent_contract": "preserve-omitted-v1",
  "consent": {
    "sms_consent": false,
    "kakao_consent": false,
    "consent_at": null,
    "opt_out_at": null,
    "send_blocked": false,
    "send_blocked_reason": null
  }
}
```

위 값은 구조 예시이며 운영 상태가 아니다. `consent`는 저장 당시의 최종 상태다. 재시도 때 이후 변경된 최신 상태로 바꾸지 않고 같은 receipt를 반환한다. 시각 표기가 `Z`와 `+00:00`으로 달라도 같은 시각인지 비교한다.

생략 보존은 위 6개 필드에 한정한다. 동일인 판단, 회사 귀속, 현장·영업건 연결, 대표 지정 규칙은 이번 SQL에서 변경하지 않는다. 새 관계의 동의 기본값은 기존 false/null을 유지하며 다른 영업건의 동의를 복사하지 않는다.

## 3. 검증

| 검사 | 결과 | 검증 범위 |
|---|---:|---|
| `tests/contact-consent-postgres.test.mjs` | 19 통과 | 로컬 PGlite에서 캡처한 실제 go·dispatcher 정의 사용. 생략·부분 변경·타입·병합 상태, 원자적 취소, 요청 재사용, 권한·버전, 과거 receipt, 부분 롤백, 설치 반복·드리프트 차단 |
| `tests/contact-consent-transport.test.cjs` | 30 통과 | 실제 PC·모바일 전송 코드 + 합성 서버. 엄격한 ACK, 같은 요청 재시도, 잘못된 사용자, 옛 enqueue/adapter 혼합 차단 |
| `tests/contact-consent-callers.test.cjs` | 14 통과 | 대표 지정·일반 수정·번호 변경·명시적 동의 변경·확인 시각·서버 결과 반영·옛 PC 진입 |
| `review-preview/verify-no-legacy-boot.cjs` | 9 묶음 통과 | 옛 UI 노출 방지, 모듈 실패, 옛 연락처 진입 → 승인 I-3, 옛 저장 호출 차단 |
| `review-preview/verify-stage8-input-browser.cjs` | 9 묶음 통과 | I-1~I-3 × 320/375/480px, 원본 글꼴·크기·넘침, 입력 보존·진입·취소 |

실계정 저장, 운영 SQL 적용, 배포, 실제 고객 메시지·명함·마이크 실행은 하지 않았다. PostgreSQL 검사는 합성 테이블·사용자와 운영에서 읽은 함수 정의를 결합한 로컬 검사다. 브라우저 자산 혼합 검사는 enqueue의 구·신 호출 계약 조합을 검사하며, 모든 과거 브라우저·오프라인 캐시 상태를 재현한 것은 아니다.

## 4. 바뀐 파일

- 공통: `operational-adapter.js`, `transport.js`, `pc-manager-transport.js`.
- PC 호출: `pc-primary-contact.js`, `deal-panels-v2.js`, `deal-detail-v3.js`, `crm.html` 마지막 `saveContactInfo`와 자산 버전.
- 모바일: `mobile-guide-shell.js`의 옛 연락처 진입 차단·연결, `mobile.html` 자산 버전.
- 서버 후보: `supabase/migrations/20261011080417_contact_consent_preserve_omitted.sql`.
- 검사: 위 5개 검사와 `tests/contact-consent-fixture.mjs`, 결과 JSON.

## 5. 운영 반영 조건

서버 마이그레이션은 현재 설치 go 정의를 역치환한 해시가 `a0209794d0844913f287bd9da509e3e1`일 때만 진행한다. 관련 없는 서버 변경이 있으면 중단하므로 최신 정의를 대조해야 한다. 설치는 한 트랜잭션이며 수신동의 데이터 일괄 변경은 없다.

서버 계약 적용을 먼저 확인한 뒤 adapter·양쪽 transport·PC 호출 파일·HTML 자산 버전을 함께 반영한다. 옛 receipt를 새 계약처럼 표시하거나 미확인 큐를 새 요청으로 재발행하지 않는다. 기존 요청이 거절되거나 충돌하면 해당 요청의 저장 결과를 먼저 대사한다. 부분 롤백으로 wrapper만 남아도 표식 없는 서버 응답은 전체 트랜잭션을 취소한다.

2026-10-11 GitHub master를 다시 확인했으며 마지막 커밋은 `ad20924`(#596)로 동일했다. 공개 업로드·PR·병합·배포는 이번 후속 작업에서 실행하지 않았다.

## 6. 남은 결정과 연결

명함의 **회사 = 해당 현장에 연결된 소속 / 사람의 공통 소속** 중 저장 기준은 아직 사용자 답변을 기다린다. 명시적 기존 연락처 선택과 UUID 기반 여러 현장·영업건 연결도 남아 있다. 번호 일치만으로 기존 사람을 합치지 않으며, 이 계약들이 갖춰지기 전에는 I-3 저장 완료로 표시하지 않는다.

화면은 기존 [연락처 저장 계약 인수인계](CLAUDE_MOBILE_CONTACT_CONTRACT_20261011.md)의 미결정 조건에 따른다. 회사 선택 화면이나 새로운 동일인 선택 UI를 임의로 만들지 않는다.
