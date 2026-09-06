# I14 technical inquiry reclassification local candidate

판정: `DERIVED_SAFE_LOCAL_CANDIDATE`, Staging 미적용.

- 현재 도달 가능한 PC `inqTechReclassify()`만 연결한다. 기술자문 문의를 기존 견적문의 brand로 되돌리는 의미이며 기술자문 Deal 생성은 포함하지 않는다.
- 외부 op/ACK는 `inquiry_reclassify` 그대로 유지한다. client source brand, review status, actor/time은 충돌 감지용일 뿐 정본으로 쓰지 않는다.
- admin + 현재 inquiry scope만 허용하고, 서버가 현재 brand가 `기술자문`이며 연결 Deal이 전혀 없음을 확인한다.
- target은 화면과 동일하게 기본 견적문의 brand 또는 현재 데이터에 존재하는 non-technical brand만 허용한다.
- `inquiries.brand`, private inquiry audit, receipt를 한 transaction으로 처리한다. 기존 private audit의 sanitized review/history만 scoped read에 투영하여 새 public 업무 테이블을 만들지 않는다.
- 동일 request/payload replay는 원 ACK, 다른 payload 재사용은 409다.

적용 순서는 `pipeline-waiting-context/20260906` 뒤다. live schema/ACL guard와 Staging JWT/PC button/replay/linked-Deal/read-back 검증 전에는 PASS로 계산하지 않는다.
