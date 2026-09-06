# DUAL fixture — 적용 전 복구 계획

허용 대상은 Staging rprechiaglyjaydkmxsu의 TEST DUAL / crm-dual@example.invalid 1명뿐이다. 기존 6개 Auth/CRM 사용자 및 모든 Deal/Inquiry/감사행을 보존한다.

1. Auth 생성은 공식 signup API 또는 권한 있는 Auth admin API만 사용한다. signup 거절/미확인 상태면 settings 변경이나 Auth 내부 row 조작으로 우회하지 않는다.
2. 기존 이메일 존재 또는 반환 UUID 불확실 시 중단한다. 생성 UUID는 비밀값 없는 mapping에 기록한다.
3. CRM 연결 전 미승인 사용자 시험을 수행한다. 이후 source role dual, 승인된 permission role admin, 합성 Deal5/Inquiry5의 명시 scope만 사용한다.
4. CRM rollback은 mapping의 정확한 UUID/email/name/source role를 사전 검사하고 신규 scope → access_review → public.users 순으로 제거한다. DUAL이 소유한 업무행/생성한 audit/receipt가 있으면 중단한다. 강제 cascade나 감사행 삭제를 하지 않는다.
5. Auth rollback은 먼저 생성된 테스트 세션을 signOut하고 approval이 제거된 것을 확인한 뒤 admin deleteUser(정확한 생성 UUID)로 수행한다. Auth 삭제만으로 기존 JWT 즉시 무효화가 보장된다고 주장하지 않는다.
6. admin API 자격증명이 없으면 Auth 제거는 실행하지 않고 명시적 보류로 보고한다. 기존 Auth6 삭제/role 변경, Legacy ACL 변경은 금지한다.

이 계획은 실행 완료 증거가 아니다. 정확한 UUID를 확보한 후 guarded SQL/스크립트와 로컬 fixture roundtrip 테스트가 준비되어야 CRM seed를 적용한다.
