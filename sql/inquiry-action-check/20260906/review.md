# Inquiry action/check local candidate

I07의 현재 PC 도달 경로 네 개만 연결한다.

- `splitSaveNext`: 단건 Next 등록/교체
- `applyInqBulkAction`: 선택 문의별 동일 Next 등록/교체. 각 문의는 독립 receipt이며 전체 일괄 원자성은 주장하지 않는다.
- `splitDoneAction`: 서버 read에서 받은 `next_action.id`가 있는 현재 open 행동만 완료
- `splitCheck`: 고정 6개 응대 체크 항목만 토글

외부 op와 ACK envelope는 기존 `next_action`, `next_action_complete`, `stage_check`를 유지한다. `inquiry_id`와 고정 내부 intent가 있을 때만 문의 helper로 분기하며 기존 Deal 의미와 version 규칙은 변경하지 않는다. 서버는 Auth/CRM UUID, scope, 현재 담당자, action 소유관계와 현재 체크 상태를 다시 확정한다. 클라이언트 actor/time은 받지 않는다.

체크리스트는 새 public 업무 컬럼을 만들지 않고 private append-only 문의 audit의 최신 값에서 projection한다. Rollback은 receipt/audit 증거를 별도 schema로 보존하며 이미 반영된 public Next 상태를 추측해 되돌리지 않는다.

이 후보는 Staging에 적용되지 않았다. JWT/browser 검증 전에는 `STAGING_COMPAT_PASS`가 아니다.
