# n8n 쓰기 통신 교체 — 2026-09-06 작업 상태

## 범위

기존 crm.html/mobile.html 및 승인 Overlay는 제품 정본이다. 이번 작업은 새 화면, 새 업무 흐름, 85개 기능 재구축을 만들지 않는다. Phase1/phase11 산출물은 삭제하거나 확대하지 않았다.

## 이번에 작성·검증한 부분

- `scripts/extract-write-contracts.cjs`: 실제 PC/모바일과 직접 연결된 로컬 JS에서 pushWrite 119곳, 정적 op 41종 추출. 각 payload 원문과 파일/행, 기존 기대 ACK를 `contracts.json`에 보존. AST상의 호출 위치 목록이지 각 호출의 런타임 도달 가능성을 증명한 수치는 아니다.
- `staging-write/compat-adapter.js`: 기존 요청 envelope를 변경하지 않고 내부 RPC 인자로 변환하는 Staging 전용 초안. 현재 서버에서 확인된 공종 op만 연결 가능하다. 아직 기존 HTML에는 주입하지 않았다.
- 원래 write_id와 Auth UID를 사용해 재시도/재접속에도 같은 request UUID를 사용한다. 원래 write_id는 서버의 상관관계가 검증된 ACK에만 다시 붙인다.
- 클라이언트 actor는 서버 권한에 전달하지 않는다. 다른 계정의 큐 전송, 예상하지 못한 ACK, 409, 응답 유실을 성공으로 처리하지 않는다. 자동 재전송/최신 버전 자동 채택 없음.
- UI에서 읽은 version이 없으면 저장하지 않는다. 기존 envelope.version=1을 DB version으로 해석하지 않는다.
- 기존 공종 표시명과 서버 key 조합의 summary가 다르면 `WORK_DISPLAY_CONTRACT_MISSING`으로 차단한다. 기존 표시 의미를 조용히 변경하지 않는다.

검증 명령:

```text
node scripts/extract-write-contracts.cjs
node --test tests/crm-write-compat.test.cjs tests/crm-write-compat-db.test.cjs tests/write-ack.test.cjs
```

결과: **26 PASS / 0 FAIL / 0 SKIP**. 기존 SQL을 실행한 로컬 PGlite 시험과 HTTP 모형/기존 ACK 소비자 시험이다. 실제 Staging JWT·브라우저·9개 업무 전환 PASS를 뜻하지 않는다.

## 확인된 실제 호환성 공백

| 대상 | 현재 근거 | 필요한 처리 |
| --- | --- | --- |
| 기존 조회 | 프론트는 CrmRead와 crm_read_bundle을 사용. 로컬 SQL은 과거 crm_users/crm_private/assignee_user_id 전제 | 현재 users.auth_uid/users.user_id/owner_id 구조와 일치하는지 검증·보완. 새 조회 아키텍처를 만들지 않음 |
| 금액 | UI saveBasics는 amount/quote_amount/won_amount를 별도로 보냄. baseline deals에는 amount만 존재 | 기존 n8n 저장 규칙 확인. 금액을 임의로 합치거나 새 저장 위치를 추정하지 않음 |
| 배정 | UI의 to/owner에 표시명이 들어가는 호출 존재 | UUID 권한 정본을 유지하며 기존 승인 대상/배정 의미를 확인. 이름 자체로 권한 부여하지 않음 |
| 공종 | 기존 UI는 표시용 work_summary도 보냄. 현재 v2는 key를 합쳐 summary 생성 | 기존 표시/활동이력 의미를 보존하는 Dispatcher 보완 필요 |
| Next 완료 | PC는 text/due_at, 모바일은 action_id를 보내는 경로가 있음 | 동일 대상 선택 규칙을 확인하고 임의로 모든 열린 Next를 완료하지 않음 |
| 생성/문의 전환 | client_ref/local_id 및 서버 new_opportunity_id 채택 요구, branch/owner 등 부가 필드 존재 | 원래 저장 규칙과 원자적 처리 범위 확인. 가짜 생성 ACK 금지 |

현재 `crm_write_command_v2` 및 command_receipts CHECK는 opportunity_work_set만 허용한다. 다른 op를 연결한 것으로 표시하지 않는다. 앞서 작성된 business-v2 후보는 실제 기존 처리와 일치 여부를 확인하지 않고 자동 적용하지 않는다.

## n8n 읽기 전용 확인

워크플로 `CRM 쓰기 API (crm-write · 멱등)` / `J5u7dtzgibqVSGud`를 기존 로그인 세션으로 열었다. 화면은 Inactive/Saved 상태였고, 다음행동 저장/완료, 딜 갱신/생성, 감사 활동/로그, 공종 저장 등의 노드 연결을 확인했다. 실행·활성화·저장·테스트 웹훅 호출을 하지 않았다.

검증·준비 코드에 비밀 상수가 포함되어 있어 전체 코드의 클립보드 복사·추출 시도가 자동 보안 검토에서 차단됐다. 이후 사용자가 비밀 제외 규칙 분석을 승인했다. 그러나 부분 편집기 추출도 안전성을 보장하지 못해 거절됐다. 이 추출 경로는 중단했다.

2026-09-06 읽기 전용 노드 패널의 상태를 확인하던 중 n8n Variables가 자동으로 표시되어 일부 비밀값이 도구 출력에 포함됐다. 값을 다시 인용하거나 저장소에 저장하지 않았다. **비밀 출력 0을 주장하지 않는다.** 원격 패널 조회를 중단했고 비밀값 교체 검토가 필요함을 사용자에게 알렸다. credential 변경은 실행하지 않았다.

확인한 비밀 없는 분기 설정·부분 생성 규칙만 `n8n-observed-rules.json`에 수기로 요약했다. 원본 워크플로/코드/클립보드/실행 기록을 저장한 파일이 아니다. `n8n-op-map.json/md`는 41개 op마다 입력·저장 규칙·대상·ACK·대체 처리를 기록하되 미확인은 UNKNOWN으로 남긴다. 정상 ACK 식, op별 전체 처리 및 원자성은 아직 확정하지 못했다.

다시 일반 승인을 요청하는 문제가 아니라 **비밀값을 사전에 제거한 별도 규칙 자료**가 필요한 상태다. 검증·준비의 op 분기, 필수값 검사, 각 DB 노드의 요청 본문/대상 선택 규칙, 생성ID 반영, 정상/중복 ACK, 오류·재시도 설정을 비밀/실행 데이터 없이 제공받아야 현재 9개 업무를 같은 의미로 연결할 수 있다.

## 미실행 및 다음 작업

이번 작업의 원격 DB 변경 0, Auth 변경 0, Production DB 접속 0, n8n 변경/실행 0, 배포 0. 사용자 PC/모바일 루트 소스 변경 0. 새 어댑터의 실제 HTML 연결 및 Staging 적용은 아직 미실행이다.

요청한 9개 업무는 완료되지 않았다. 기존 n8n op별 저장 규칙을 확인한 뒤 현재 Dispatcher의 내부 처리만 순차 연결한다. 읽기 보완은 기존 CrmRead 응답 형태를 유지한다. 업무·권한 회귀 없이 운영 전환하지 않는다.
