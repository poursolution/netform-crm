# 파이프라인 연락처 명함 인식

## 동작

- 연락처 등록 패널의 명함 촬영(지원 기기의 후면 카메라) 또는 명함 사진 선택.
- JPG/PNG/WebP, 원본 15MB 이하. 브라우저에서 긴 변 1568px 이하 JPEG로 다시 그려 전송한다. HEIC는 JPG로 변환 안내.
- 기존 `crm-ai` 인증·AI 활성 설정을 통과한 사용자만 Claude 인식 요청 가능.
- `contact_card`는 명함 자체만 읽고 고객 데이터를 조회/수정하지 않는다. 사진과 인식 결과를 CRM DB·Storage·제안 캐시에 저장하지 않는다.
- 이름·010 휴대폰·역할·대표전화·이메일을 채운다. 기존 값 및 인식 중 직접 수정한 값은 유지한다. 수신동의는 변경하지 않는다.
- 인식은 저장과 별개다. 사용자가 결과 확인 후 기존 `saveQuickContact` 경로로 저장한다.
- 패널을 닫거나 현장·로그인 사용자가 바뀌면 늦게 도착한 결과를 적용하지 않는다.

## 검증

`node --test tests/contact-card.test.mjs tests/crm-ai-handler.test.mjs`

`node scripts/verify-contact-card-browser.cjs`

서버 8개 검사와 브라우저 검사 통과. 실제 고객 명함은 테스트에 사용하지 않았고 실제 공급자 인식 정확도는 아직 미확인이다.

## 배포 상태

2026-10-04 사용자 승인 후 운영 crm-ai v6 배포 및 소스 재조회 확인 완료(verify_jwt=true). 프런트엔드 GitHub 배포 진행 중. DB 스키마 변경은 없다.

API 형식 근거: https://platform.claude.com/docs/en/build-with-claude/vision
