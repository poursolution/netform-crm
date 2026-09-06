# PC inquiry stage progress local candidate

판정: `DERIVED_SAFE_LOCAL_CANDIDATE / NOT APPLIED`.

I04의 PC 상세 폼은 모바일의 단축 응대 결과와 다르다. 한 번의 저장에서 현재 문의 status를 확인하고, 비종료 단계 0~5로 이동하며, 한 일/결과, 최초·최근 응대시각, 단계이력, 기존 후속 취소와 새 Next Action을 원자적으로 남긴다.

- 공개 operation과 ACK는 기존 `inquiry_status`를 유지하고 내부 intent만 `progress`로 분리한다.
- client actor/time은 버리고 서버 Auth UUID/CRM UUID와 server time을 사용한다.
- payload의 `from_status`는 optimistic token으로만 사용하며 실제 status와 다르면 409다.
- 현재 담당 UUID인 `rep`/`consultation`, 또는 scope가 있는 `admin`만 허용한다. 기술자문과 branch 의미는 제외한다.
- 서버가 status와 표시용 단계명을 고정 매핑하고 public `stage_history`, public `next_actions`, private inquiry audit, receipt를 한 transaction에 기록한다.
- 기존 open inquiry Next Action은 `cancelled`, 새 전화 Next Action은 `open`으로 교체한다.
- read projection은 단계이력, sanitized 활동, 현재 open Next Action만 actor scope 안에서 반환한다.
- `보류`, `실주`, `배드핏`, `연락두절`은 서로 다른 사유·종료 규칙과 충돌하므로 이 후보가 처리하지 않는다.
- rollback은 업무 데이터를 추측 복원하지 않고 progress receipt/audit만 private archive로 보존한 뒤 이전 dispatcher/read layer를 복구한다.

Staging DDL/DML, Production, n8n 접근은 수행하지 않았다.
