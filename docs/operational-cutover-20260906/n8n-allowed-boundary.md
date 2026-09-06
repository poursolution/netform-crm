# 승인된 n8n 유지 경계

STATUS: APPROVED_BOUNDARY / E2E_PENDING

이 문서는 n8n을 CRM의 일반 read/write backend로 계속 사용하는 승인이 아니다. 사용자가 2026-09-06에 확인한 외부 연동만 기존 n8n 경계로 유지한다. Production 또는 n8n workflow 본문은 이 문서를 작성하며 조회·변경하지 않았다.

## n8n 유지

- 견적 유입: 외부 견적 폼·웹훅의 접수, 검증, 중복 방지와 CRM 전달.
- 기술자문 외부 접수·알림 확인: 외부 소스에서 들어오는 기술자문 신호와 알림. CRM 내부의 재분류·영업기회 이관은 포함하지 않는다.
- 문자·카카오 실제 발송: 공급자 비밀키가 필요한 즉시 발송, 예약 실행, 공급자 callback과 전달 결과 확인.

## Supabase 전환

- PC/mobile 목록·대시보드·상세 및 자동 새로고침.
- 배정·응대·상태·Pipeline·담당·단계·금액·공종·Next Action·활동·첨부 등 사용자가 CRM에서 수행하는 저장.
- UUID 권한, request_id 멱등성, version conflict, ACK, receipt와 audit.
- 메시지 작성·수신동의·발송 요청과 CRM 발송이력. 실제 공급자 실행 결과만 n8n callback으로 확정한다.

## Cutover 판정 규칙

- `interactive_n8n_requests = 0`: 일반 CRM 조회·저장 요청은 n8n으로 보내지 않는다.
- `approved_external_n8n_requests`: 위 세 경계만 별도로 계수한다. 이 수치는 0일 필요가 없다.
- `unapproved_n8n_requests = 0`: 허용목록 밖 요청은 한 건이라도 있으면 NO-GO다.
- 오류 시 Supabase와 n8n 두 경로로 같은 업무 저장을 동시에 보내지 않는다.
- UI나 Git 저장소에 공급자 비밀키를 두지 않는다.
- 발송 요청·공급자 접수·실제 발송·전달 완료를 하나의 성공 상태로 합치지 않는다.

## 남은 검증

- 기존 workflow 본문을 바꾸지 않고 Staging/test recipient로 견적 유입, 기술자문 알림, 문자 즉시·예약·callback을 각각 한 번 검증한다.
- 각 요청의 correlation id, 중복 0, CRM read-back과 실패 상태를 확인한다.
- Production 및 실제 고객 번호를 사용하려면 별도 승인이 필요하다.
