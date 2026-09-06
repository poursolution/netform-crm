# Pipeline 담당자 변경·인수인계 판정

판정: `NEEDS_VERIFICATION_BLOCKED`. Staging DDL/DML은 수행하지 않았다.

## 현재 도달 경로

- PC `saveAssigneeChange()`는 같은 담당자를 거절하고, 사용자 입력 사유와 `PeopleEligibility(..., 'pipeline', ...)`를 요구한 뒤 `assign`을 보낸다. 뒤의 wrapper가 인수인계 요약을 만들어 별도 `handover`를 보낸다.
- 모바일 상세의 재배정 버튼은 관리자 mode에서만 보인다. 파일 앞쪽의 오래된 `pickReassign()`은 뒤의 같은 이름 함수에 의해 shadow되며, 최종 함수는 `관리자 재배정`을 고정 사유처럼 사용하고 `assign`과 `handover`를 연속 전송한다.
- 두 요청은 별도 write/request ID이고 서로를 묶는 correlation key가 없다.

## 실제 저장 정본과 충돌

- `public.deals.owner_id`는 UUID이고 표시 호환을 위한 `assignee_name`, `assignee_email`, 동시성용 `version`이 있다.
- `public.assignment_history`는 Deal FK를 가지지만 from/to/actor가 text다. 서버 UUID 정본은 private audit에 함께 남겨야 한다.
- 실제 Staging에는 Golden 후보 SQL의 `crm_handover_summaries`가 없다. 별도 public legacy table을 새로 만드는 근거도 없다.
- `public.users`와 `crm_security.access_review`는 활성·승인·만료·권한 역할은 판별하지만, Golden UI가 사용하는 `head_office / external / gyeongnam` 팀 소속은 보유하지 않는다.
- 따라서 승인된 `permission_role='rep'`만으로 target을 허용하면 Golden UI의 same-team 제한보다 서버 권한이 넓어진다. 이름 seed나 client `assignment_group`을 권한 정본으로 쓰는 것도 허용할 수 없다.

## 팀 정본이 생긴 뒤 사용할 최소 계약

외부 op는 `assign`을 유지한다. payload는 target 표시명과 필수 reason만 호환 입력으로 받고, 서버가 target UUID와 현재 owner UUID를 확정한다. admin write scope, 현재 Deal version, 활성·승인·미만료 rep, current/target same-team을 모두 검사한다.

한 transaction에서 다음을 수행한다.

1. `deals.owner_id / assignee_name / assignee_email / version` 갱신
2. 기존 `assignment_history` 1건 기록
3. 담당자 변경 Activity 1건 기록
4. 서버가 현재 stage·amount·대표 연락처·최근 Activity·현재 Next Action에서 인수인계 요약 생성
5. `crm_security.audit_events.after_data.handover_summary`에 UUID before/after와 요약 기록
6. command receipt와 기존 `{ok:true, write_id, operation:'assign', ...}` ACK 기록

Golden의 뒤따르는 `handover` child는 UI compatibility layer에서 같은 handler 실행 중 흡수한다. client가 만든 summary, from, actor, time은 권한·감사 정본으로 사용하지 않는다. 모바일은 PC와 동일하게 사용자 입력 재배정 사유를 받는 최소 UI 보완이 필요하다.

## 부족한 규칙 한 줄

`public.users.user_id`별 `head_office / external / gyeongnam` 팀 소속과 Pipeline 배정 가능 여부를 서버가 검증할 수 있는 승인된 UUID 정본이 필요하다.

