# Production cutover checklist

STATUS: READY

이 문서는 Production 실행 승인이 아니다. Staging Gate 2·3·4가 모두 PASS한 뒤 별도 Production 승인으로만 사용한다.

## 현재 Gate 스냅샷

- Local 전체 회귀: `877 PASS / 0 FAIL / 16 SKIP` (`SKIP`은 원격 전용이며 PASS에 포함하지 않음)
- Staging 31-op JWT/E2E: `35 PASS / 0 FAIL / 0 SKIP`
- Staging 브라우저 mutation: `75 step PASS / 0 FAIL / 0 SKIP`
- 첨부: `crm_attachment_insert_v1` 정책 적용 후 prepare→PUT→complete→ready read PASS
- Coverage: `53 PASS / 0 BLOCKED / 11 OUT_OF_SCOPE` (`64` logical reachable actions; 승인된 31-op 운영 범위 완료율 100%)
- fixture cleanup: **PASS**, exact disposable DB `448행`과 Storage object `1개`를 삭제했고 fixture/잔여/Storage 모두 0, canonical 문의 5행·Deal 5행 전체행 MD5 보존을 확인했다.
- Production 요청: `0`; 31-op Staging mutation 중 n8n 요청: `0`
- n8n 최종 경계: 일반 CRM read/write는 0, 견적 유입·기술자문 외부 알림·문자/카카오 발송만 승인 예외

## 변경 목록

- Staging에서 검증된 `sql/operational-full-local-candidate/20260906/staging-apply.sql`과 동일한 최종 승인본만 적용한다.
- 현재 후보 apply SHA-256: `81a44efa1331454059ac59c83cc9931cc3aaa5070140c2321a3bcafcdd6e469e`.
- 현재 후보 rollback SHA-256: `7e58f816cce046b4aef8c3bae3db0af54de7765d471c74e69469cde0a3c8a720`.
- 현재 후보는 31개 기존 operation, 공통 read projection, receipt/audit/ACL 및 호환 Adapter 자산을 포함한다.
- UI 배포 후보는 `operational-adapter.candidate.js` (`88af52ed8c3e2684d1b0a89735e2ac4731a55e25946e89434a054c87dee941bc`), `operational-overlay.candidate.js` (`c7200ef41b0ac9007ba4bf8b0054fb19b74d367795b8d8fb71dd8081630050c4`), `transport.candidate.js` (`53f50ba5362c4689cef444ce30096c23f7f7b9cecbd313140ce44303ef3b9469`)다.
- 첨부 업로드용 `storage.objects` authenticated INSERT 정책 `crm_attachment_insert_v1`은 Staging에서 별도 적용·검증했다. 조건은 `bucket_id='crm-site-files' AND public.crm_attachment_object_insert_allowed(bucket_id,name)`이다.
- Storage 정책 포함 후보 SHA-256은 `6ab7068d0bbb92db7607e84ba40dfc1252f28afb9ba1a10d0d8f30cf4437dc55`이다.
- frozen `opportunity_work_set`과 `direct_assign`의 의미를 변경하지 않는다.
- 승인된 n8n 외부 경계는 보존한다. dead/shadow 코드와 장기 advisor/RLS backlog는 이 cutover 범위에 포함하지 않는다.

## 적용 순서 후보

1. 별도 승인된 Production ref와 catalog/function/ACL fingerprint를 읽기 전용으로 캡처한다.
2. 위 hash의 DB apply를 단일 transaction으로 적용한다.
3. Storage 기능이 최종 범위에 포함될 때만 owner 권한으로 정책 한 건을 적용한다.
4. PC/mobile UI 후보를 배포하되 기존 UI·업무규칙·ACK를 유지한다.
5. 실제 JWT 역할 matrix와 frozen 회귀·주요 업무 E2E를 확인하고, 일반 CRM read/write n8n 요청 0 및 승인 외 경계 0을 확인한다.
6. 관측 창 종료 후에만 cutover 완료를 선언한다.

## 실행 전 필수 체크

- [x] 64개 논리 reachable 행동 최종 판정 완료
- [x] BLOCKED 중 운영 필수 항목 0
- [x] Staging 실제 JWT mutation E2E `35/35` PASS
- [x] frozen 공종/direct_assign 및 31-op 비첨부 회귀 PASS
- [x] exact fixture DB 448행·Storage object 1개 cleanup 및 canonical 원복 PASS
- [x] 일반 CRM read/write n8n 요청 0 및 승인된 외부 n8n 경계 분리 증거
- [x] 역할별 권한 matrix PASS
- [x] 최종 apply/rollback hash 재확인
- [x] 최종 배포용 PC/mobile artifact에서 n8n/Production 고정 참조 0
- [ ] Production project ref를 별도 승인 절차에서 재확인
- [ ] Production 승인 시 rollback 담당자·판정 시점·관측 창 확정

## 중단 조건

- catalog/function/ACL fingerprint drift
- manifest hash 불일치
- Production ref 또는 대상 환경 불일치
- 필수 Gate 증거 누락
- 승인된 Storage 정책 없이 attachment upload를 포함한 운영 전환 시도
- 견적 유입·기술자문 외부 알림·문자/카카오 외의 n8n 요청 발견
- runtime irreversible operation이 이미 실행된 상태에서 schema rollback 요구

## 현재 판정

`STAGING_GO / PRODUCTION_NOT_APPLIED`. 승인된 31-op 운영 범위와 후속 8개 UUID 호환 경로는 실제 Staging JWT·read-back·멱등성·권한·cleanup까지 PASS했다. 11개 OUT_OF_SCOPE는 직접 금액 편집, 로컬 일괄관리, 데이터 정리, provider 기반 확장 전환, 승인된 n8n 문자 경계, 관리자 Export, 외부 앱·mock 등이며 PASS로 계산하지 않았다. Production 적용은 별도 승인 전 금지한다.
