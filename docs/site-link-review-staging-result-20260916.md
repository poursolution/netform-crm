# Site 연결 검토 Queue — staging 검증 결과

- 대상: `netform-crm-staging` / `rprechiaglyjaydkmxsu`
- Production 변경: 없음
- 적용 migration: `site_link_review_v1`
- 테이블: `crm_security.site_identity_links`
- 공개 RPC: `crm_site_link_review_list_v1`, `crm_site_link_review_resolve_v1`
- 후속 migration: `site_linked_history_v1`
- 별도현장 migration: `site_separate_canonical_v1` 및 검증 후속 수정
- Site 상세 RPC: `crm_site_linked_history_v1`

## 확인 결과

- private schema 테이블 생성 및 RLS 활성화 확인
- 원본 조직·메모·연락처·영업 데이터 변경 없음
- 저장된 연결 결정 0건
- 비인가 authenticated 호출 차단 확인
- 만료된 staging 관리자 권한은 트랜잭션 안에서만 임시 보정하여 관리자 목록 계약을 확인했고 즉시 rollback 확인
- staging 기본 데이터의 실제 검토 후보 0건
- 트랜잭션 합성 데이터로 `후보 조회 → 관리자 연결 → Queue 제거 → canonical Site 과거이력 조회` 통과
- 합성 Site·organization·메모·연결결정과 임시 권한 만료시각은 모두 rollback 및 0건 재확인
- 같은 이름·다른 주소의 기존 Site가 있어도 `별도 현장` 선택 시 새 Site 생성 확인
- 동일 요청 재시도는 기존 Site ID를 반환하고 추가 Site를 만들지 않는 것 확인

## 배포 전 남은 조건

1. 실제 후보가 있는 production 복제/격리 데이터에서 목록 분류 검증
2. 전체 브라우저 smoke test와 production manifest 생성

## Advisor 관찰

이번 migration이 만든 private table은 직접 권한을 전부 회수하고 제한 RPC만 허용했다. staging 전체에는 이번 변경과 무관한 기존 public RLS 미활성 테이블 6개와 security-definer view 경고가 남아 있다. 별도 보안 변경으로 검토해야 하며 이번 작업에서 자동 변경하지 않았다.
