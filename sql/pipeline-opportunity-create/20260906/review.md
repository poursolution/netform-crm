# Pipeline direct opportunity create — local candidate

판정: `DERIVED_SAFE_LOCAL_CANDIDATE / NOT APPLIED`.

이 후보는 현재 Golden PC의 `+영업`과 모바일 `신규 영업등록`에서 도달 가능한 **직접 생성**만 연결한다. 문의→Pipeline 전환, 기술자문 이관, 확장견적 전환은 같은 `opportunity_create` 이름을 쓰도 lineage·상태 부수효과가 다르므로 계속 차단한다.

Site 식별은 양쪽 화면이 공통으로 제거하는 대괄호 태그·공백·`아파트`만 exact key로 삼는다. exact key가 하나면 재사용하고, 둘 이상이면 409다. PC만 제거하는 `현장`, 모바일만 제거하는 `APT`·구두점 또는 기존 `norm_name`에 의한 broad match만 존재하면 자동 병합하지 않고 명시적 Site 선택을 요구한다. 모바일의 substring 중복 판정은 사용하지 않는다. 이 규칙은 기존 Site를 조용히 합치거나 같은 Site를 새로 만드는 것보다 보수적인 fail-closed 호환 규칙이다.

owner 정본은 서버가 `users`와 승인·활성·미만료 `access_review`를 결합해 UUID로 확정한다. 본사 rep/admin은 승인된 `permission_role='rep'`를 지정할 수 있고 branch는 자기 자신만 지정할 수 있으며 consultation은 직접 생성을 사용할 수 없다. 모바일 consultation 화면에서는 버튼을 숨기고 서버도 거절한다. 모바일 admin/dual에는 기존 본사 담당자 목록을 이용한 최소 picker만 보충한다.

한 transaction에서 Site 확인/생성, Contact upsert, Deal, 연락처 배치, 초기 Activity, 선택적 모바일 Next Action, 필요한 object scope, private audit, receipt를 기록한다. PC는 기존 화면과 같이 Activity 1건·Next 0건, 모바일은 Activity 1건·`첫통화 / 등록 후 첫 통화` Next 1건이다. 모바일이 parent 전에 보내던 Activity/Next는 overlay가 흡수하므로 중복 child write는 없다. request UUID를 create sentinel과 idempotency key로 함께 사용하고 ACK의 `new_opportunity_id`로 임시 Deal ID를 교체한다.

Rollback은 runtime `opportunity_create` receipt/audit가 생기기 전 migration 취소만 허용한다. 실제 생성 후 business row를 지우거나 조작하는 rollback은 제공하지 않는다. Staging DDL/DML, Production, n8n 접근은 수행하지 않았다.
