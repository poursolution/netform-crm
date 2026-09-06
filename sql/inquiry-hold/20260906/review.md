# I06 inquiry hold local candidate

판정: `DERIVED_SAFE_LOCAL_CANDIDATE`, Staging 미적용.

- 현재 도달 가능한 PC Control Center의 `hold` 분기만 연결한다. 같은 `inquiry_status`를 쓰는 기술자문 영업전환과 그 밖의 상태 변경은 차단한다.
- 외부 op/ACK는 `inquiry_status` 그대로 유지한다. client `from_status`, actor, time은 정본으로 쓰지 않는다.
- admin + 현재 inquiry scope만 허용하고, 서버가 현재 status를 읽어 `보류`로 변경한다. 이미 보류인 문의의 새 request는 409다.
- Actual `inquiries.status`, private inquiry audit, receipt를 한 transaction으로 처리한다. audit의 sanitized hold aliases/history를 scoped read에 투영하여 public business table이나 임의 JSON 필드를 추가하지 않는다.
- 보류 해제는 별도 reachable 저장 계약이 없으므로 이번 intent에 포함하지 않는다.

적용 순서는 `inquiry-reclassify/20260906` 뒤다. live schema/ACL guard와 Staging JWT/PC 단건·일괄/replay/read-back 검증 전에는 PASS로 계산하지 않는다.
