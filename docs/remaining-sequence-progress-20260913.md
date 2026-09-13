# 남은 작업 순차 진행 결과

## 완료된 로컬 변경

- 상세화면의 execution/field/relationship engine/relationship page 4개 중첩 override를 제거했다. `renderDetailAddons()`가 기존 순서대로 명시적 함수를 호출한다.
- 기존 화면 구성·저장 함수·터치 기록·권한은 바꾸지 않았다. 세 번 연속 다시 그려도 활동폼/Next/연락처/관계정보/첨부 영역이 각 1개임을 브라우저에서 검증했다.
- 프런트엔드 지침은 기존 업무 화면의 간결함을 유지하는 데 적용했다. 새 장식이나 레이아웃 변경은 없다.
- 관계관리 통합 저장은 별도 비공개 로컬 DB 후보를 작성했다. 운영 RPC/adapter/UI에는 미연결이다. 상세 계약과 적용 전 조건은 `sql/relationship-contact-atomic/20260913/review.md` 참고.

## 검증

- 전체 회귀: 616개 / PASS 600 / FAIL 0 / SKIP 16.
- 통합 저장 로컬 PGlite: 13 PASS / 0 FAIL. 중간·마지막 쓰기 실패 전체 롤백, 중복/충돌, 권한 거절·만료, 잘못된 날짜, 부재 연락, 여러 미완료 일정 보호.
- Edge 합성 브라우저: detail workspace, pipeline detail interactions, detail P1, inquiry role view, inquiry unassigned, relationship management 통과.
- 실제 고객 데이터에 시험 기록을 남기지 않았다. 실제 계정 로그인·HTTP 저장·두 세션 동시 쓰기는 이 결과에 포함하지 않는다.

## 다음 순서 / 필요한 결정

1. 황윤선·이승우 관리자 권한 유지: 사용자 확인 완료. 권한 변경 없음.
2. 승인된 테스트 계정·대상으로 실계정 저장/RLS/동시성 E2E. 실고객 임의 수정 금지.
3. 관계관리 단일 저장의 최신 Production 계약 대조, 공개 dispatcher/adapter 연결·rollback 준비 및 별도 운영 적용 승인.
4. 기존 활동을 단계 전환 근거로 재사용하는 서버 계약. 근거 없는 새 활동 복제는 계속 금지.
5. 미사용 DCC 함수와 다른 저장/상세 보조 함수의 점진적 정리. 이번에 전부 제거하지 않았다.

이번 UI 배포에 새 DB 후보 적용, 권한 변경, n8n·잔디·구글시트 변경은 포함하지 않는다.
