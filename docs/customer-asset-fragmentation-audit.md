# 고객자산 분리 현황 감사

이 감사는 고객자산 화면을 수정하기 전에 다음 세 가지를 계측한다.

1. 같은 정규화 현장명이 `Site / Organization / 무연결 문의·영업`으로 몇 조각인지
2. 영업 연결 없는 과거 고객이 기존 Site 후보를 0개, 1개, 복수로 가지는지
3. Deal, Inquiry, Contact, 근무이력 중 `site_id` 연결 밖에 남은 건수

감사 SQL은 [`scripts/customer-asset-fragmentation-audit.sql`](../scripts/customer-asset-fragmentation-audit.sql)이다.

## 안전 조건

- `BEGIN TRANSACTION READ ONLY`와 `ROLLBACK`을 사용한다.
- 테이블, 함수, 정책, 데이터를 생성하거나 수정하지 않는다.
- 실행 제한은 60초, 잠금 대기는 3초다.
- 메모 본문, 전화번호, 사람 이름은 결과에 포함하지 않는다.
- 상위 분리 이름은 최대 200개만 반환한다.
- 이름·주소 일치는 병합이 아니라 **후보 분류**에만 사용한다.

## 실행

Supabase SQL Editor 또는 운영 DB를 읽을 수 있는 관리자용 읽기 전용 연결에서 파일 전체를 실행한다. 결과는 `customer_asset_fragmentation_audit` JSON 한 행이다.

운영 화면의 일반 사용자용 Data API에 이 쿼리나 권한을 노출하지 않는다. 특히 `service_role` 또는 secret key를 브라우저에 넣지 않는다.

## 결과 해석

`candidate_status`는 과거 Organization의 후보 상태다.

- `auto_candidate_exact_address`: 이름과 정규화 주소가 정확히 같은 Site가 하나다. 자동 연결 후보지만 실제 저장 전 검토가 필요하다.
- `review_single_name_candidate`: 이름 후보는 하나지만 주소 근거가 없다. 사람 확인 대상이다.
- `review_multiple_candidates`: 동명 Site가 여러 개다. 자동 연결하면 안 된다.
- `separate_site_candidate`: 같은 이름의 기존 Site가 없다. 별도 Site 생성 후보이다.

`top_fragmented_names`는 화면상 고객자산이 갈라질 가능성이 높은 정규화 이름을 우선순위대로 보여준다. 원본 이름·주소·전화번호는 의도적으로 내보내지 않는다.

이 결과를 확인한 뒤에만 영구 연결 테이블과 확인 Queue를 설계한다. 감사 단계에서는 자동 병합이나 `site_id` 갱신을 수행하지 않는다.
