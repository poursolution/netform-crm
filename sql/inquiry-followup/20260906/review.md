# Inquiry follow-up postponement — local candidate

판정: `DERIVED_SAFE_LOCAL_CANDIDATE / NOT APPLIED`.

현재 reachable 기능은 모바일 Today의 문의 카드에서 `내일 / 3일 뒤 / 다음 주`를 선택하는 `inquiry_followup` 하나다. payload는 `inquiry_id`, `due_at`, 고정 reason `담당자 연기`뿐이고 Actual `inquiries.next_action_date`와 scoped inquiry source가 정확히 같은 날짜를 이미 가진다.

따라서 이 command는 generic `next_actions` row를 새로 만들거나 교체하지 않는다. 기존 action UUID·제목·유형이 없는 상태에서 임의 row를 생성하면 현재 UI 계약을 넘어선다. 서버는 current assigned UUID actor와 scope를 확인하고, KST 기준 미래 1~365일 날짜만 `inquiries.next_action_date`에 저장하며 status/assignment를 유지한다. private audit/receipt와 같은 transaction이고 client actor/time은 받지 않는다.

모바일 호환 overlay는 `inquiryViewM()`에 persisted `next_action_date`를 전달하고 `buildToday()`에서 미래 문의를 숨기며 당일/지난 후속을 다시 Today에 노출한다. 이 read 소비 보완이 없으면 새로고침 뒤 연기가 사라지므로 write만 연결하지 않는다.

같은 최종 overlay에는 선행 operational source의 actor-scoped Deal/문의 원천행, 서버 Next Action UUID와 `next_action_complete` transaction도 함께 들어 있다. 통합 UI 시험은 모바일 Today가 Deal 완료에서 파생 Activity를 중복 전송하지 않고 `next_action_complete` 한 건만 만들며, 문의 연기는 별도 `inquiry_followup` 한 건으로 유지하는 것을 확인한다. 따라서 O08T의 **권한 범위 Today 목록·상세 이동·Deal Next 완료·문의 후속 연기**는 `DERIVED_SAFE_LOCAL_CANDIDATE`다. 문의 카드의 실제 응대 완료는 여전히 I03 `response_update`이고 이 후보에 포함하지 않는다.

동일 request replay는 원 ACK, payload reuse는 409, 같은 날짜의 별도 요청도 409다. 휴지통/완전삭제 문의와 타 담당자 문의는 차단한다. 자동 알림, 별도 Next Action 생성, `response_update`, 경남 routing은 포함하지 않는다.
