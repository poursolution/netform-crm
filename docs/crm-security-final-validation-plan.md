# CRM 운영 적용 전 최종 검증 계획

상태: **NO-GO**  
운영 변경: 없음

## 역할 허용 행렬

| 기능 | anon | 상담 | 본사 rep | 경남 rep | manager/admin | admin+aal2 | service_role |
|---|---:|---:|---:|---:|---:|---:|---:|
| CRM 읽기 | 금지 | 상담 범위 | 본인 영업 | 지사 범위 | 관리 범위 | 관리 범위 | 서버 필요 범위 |
| 담당 문의 응대 | 금지 | 허용 범위 확정 필요 | 본인만 | 지사 본인만 | 허용 | 허용 | 허용 |
| 배정·재배정 | 금지 | 금지 | 금지 | 금지 | 허용 | 허용 | 허용 |
| trash/restore/merge | 금지 | 금지 | 금지 | 금지 | 정책 확정 필요 | 허용 | 허용 |
| purge/전체 export | 금지 | 금지 | 금지 | 금지 | 금지 | 허용 | 서버 작업만 |
| 연락처/첨부/signed URL | 금지 | 허용 Deal만 | 허용 Deal만 | 지사 허용 Deal만 | 관리 범위 | 관리 범위 | 검증된 서버 작업 |

`dual`이 manager인지, viewer/상담 역할의 정확한 범위는 운영 역할표 승인 전 확정하지 않는다.

## 산출물 사용법

1. `20260905_crm_security_snapshot.sql`을 사람이 검토한다.
2. 별도 승인 후 운영에서 **조회만** 실행하고 결과를 암호화된 보안 위치에 저장한다.
3. 결과의 `definition_md5`, ACL, RLS, policy를 저장소 예상값과 비교한다.
4. 운영과 분리된 staging 프로젝트에 후보 migration과 테스트 전용 probe RPC를 설치한다.
5. 테스트 전용 Auth 계정과 서로 다른 소유자의 Deal/문의 fixture를 만든다.
6. 환경변수를 비밀 저장소에서 주입해 `crm-security.integration.test.cjs`를 실행한다.
7. 테스트 probe와 fixture는 staging에만 두고 운영 migration에는 포함하지 않는다.

테스트 파일은 secret 값을 출력하지 않으며 환경변수가 없으면 전부 skip한다. 현재 저장소에는
staging 자격증명이 없으므로 아직 PASS가 아니다.

## XSS 우선순위

### P0 후보

- `openSheet(introHtml, body)`와 `inqCtlModal(title, html)`처럼 HTML 문자열을 그대로 sink에 넣는 공용 함수
- 서버/DB 데이터로 조립한 `body`, 활동·메모·상담·파일명·현장명을 전달하는 모든 호출자
- 객체 전체를 inline `onclick` JavaScript 문자열에 넣는 `JSON.stringify` 경로

공용 함수가 HTML을 의도적으로 받으므로 sink 자체만 `textContent`로 바꿀 수 없다. 호출자를
분류하고 데이터 값은 `textContent`, 속성은 DOM property, 이벤트는 `addEventListener`로 옮긴다.
P0 fixture에는 `<img src=x onerror=...>`, `</textarea><script>...`, 따옴표 탈출 문자열을 넣고
DOM에 실행 가능한 element/handler가 생기지 않는지 검사한다.

### P1

- Deal/문의/연락처/활동/메시지/첨부 데이터를 escape helper와 함께 HTML로 조립하는 경로
- 서버 오류문구와 API 응답을 화면에 표시하는 경로

대부분 `esc`/`escAttr`가 보이지만 context별 escaping과 누락을 회귀테스트로 증명해야 한다.

### P2

- 고정 탭·버튼·아이콘·레이아웃 템플릿만 넣는 innerHTML
- 고정 배열에서만 만들어지는 선택지

P2는 CSP 전환 때 DOM template/component 단위로 순차 교체한다.

## CSP 단계

1. Report-Only: 현재 inline/CDN 의존을 허용한 상태에서 violation endpoint로 기준 수집
2. inline handler를 이벤트 위임/`addEventListener`로 제거하고 inline script를 정적 JS로 이동
3. Supabase SDK를 자체 호스팅하거나 고정 version+SRI+`crossorigin`으로 관리
4. nonce/hash 기반 `script-src`, 엄격한 `object-src 'none'`, `base-uri 'none'`, 제한된 `connect-src`
5. staging 위반 0과 전체 UI 회귀 후 enforced CSP 적용

## Export 수정안

현재 `exportFullDataJSON()`은 이미 브라우저에 내려온 전체 `B`, 로컬 override, 쓰기 큐를 파일로
저장하며 역할·MFA·감사 제어가 없다. UI 버튼만 숨겨서는 보안 통제가 아니다.

- 서버 `crm_export_create`에서 auth.uid, admin role, JWT `aal2`, 사유를 검증
- 기간·사업유형·허용 컬럼·최대 건수 필수, 연락처는 별도 명시 옵션
- export job/result를 append-only audit에 기록하고 짧은 만료 signed URL만 반환
- 사용자·시간대별 rate limit과 동시 job 제한
- 브라우저의 `buildFullExport/exportFullDataJSON`은 서버 경로 전환 후 제거

## Session/Auth

- 실제 UI는 Supabase email/password 로그인을 사용하지만 “휴대폰 번호 전체”를 비밀번호로 입력하라고 안내한다. 실제 계정 비밀번호 정책은 Auth 관리자료 없이는 확정할 수 없다.
- 모바일은 `persistSession:true`; PC는 Supabase JS 기본 세션 지속 동작을 사용한다.
- 로그아웃은 양쪽 모두 `SB.auth.signOut()` 후 reload하나 CRM localStorage 쓰기 큐·override까지 지우거나 사용자별 격리하지 않는다.
- 퇴사/권한변경 시 Auth 세션 철회, users.active 변경, Refresh Token 폐기 절차가 필요하다.
- 관리자 purge/export/대량변경은 JWT `aal2`와 최근 재인증 시각을 서버에서 다시 확인한다.

## Kill Switch 설계

Data API에 직접 노출하지 않는 `crm_private.security_controls` 단일 행에
`writes_enabled`, `exports_enabled`, `messaging_enabled`, `locked_user_ids`, 변경자·사유·시각을
둔다. 모든 auth-aware RPC와 Edge Function은 작업 직전에 이를 확인한다. 읽기 전용 사고 대응은
쓰기/Export/메시지를 false로 바꾸되 로그인과 최소 조회는 유지한다. 변경은 admin+aal2 전용
RPC에서만 가능하고 append-only 감사로그를 남기며, 설정 장애 시 고위험 작업은 fail-closed한다.

## 최종 승인 Gate

- [ ] snapshot 결과에서 anon CRM 접근 0
- [ ] SECURITY DEFINER ACL allowlist 완료
- [ ] actor/ownership 전부 auth.uid 기반
- [ ] 역할별 RLS/RPC 검증
- [ ] integration 11개 PASS
- [ ] Storage authorization 및 signed URL IDOR PASS
- [ ] P0 Stored XSS 0
- [ ] 전체 Export admin+aal2+audit+limit
- [ ] secret scan과 key rotation 계획 승인
- [ ] rollback SQL을 staging에서 실행·복구 검증
- [ ] backup/PITR 또는 restore rehearsal 확인
- [ ] Kill Switch 동작·감사·fail-closed 시험

현재는 snapshot 미실행, staging 자격증명/fixture 없음, integration 미실행, P0 XSS 미해소,
Export 서버 통제 미구현 상태다. 따라서 최종 판정은 **NO-GO**다.

