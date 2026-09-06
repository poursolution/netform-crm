# Operational PC/mobile transport candidate

상태: `LOCAL_UI_CANDIDATE_BROWSER_READ_PASS_NOT_DEPLOYED / T03 BROWSER WRITE NOT RUN`

실제 headless Edge에서 Staging synthetic 6역할 × PC/mobile 12조합의 Auth·scoped read·미승인 op network-before-fail 검증이 모두 통과했다. 업무 write는 보내지 않았고 Production/n8n/위반 요청은 0건이다. 증거는 `docs/operational-cutover-20260906/operational-ui-browser-read.json`이다. 기존 4개 write의 서버 JWT 증거는 기존 operational bundle에 있으나, 이 UI 후보에서 버튼을 눌러 실행한 write E2E는 아직 수행하지 않았다.

별도 browser transport 검증에서 PC `opportunity_work_set`과 mobile `service_change`는 현재 표시값을 유지하는 새 synthetic write로, `direct_assign`과 `inquiry_unassign`은 기존 검증 receipt replay로 queue/ACK를 확인했다. 기존 4/4 PASS, 최종 표시값 동일, Production/n8n 0이다. 이는 transport·receipt E2E 증거이며 direct/unassign 버튼의 신규 mutation E2E로 계산하지 않는다. 증거는 `docs/operational-cutover-20260906/operational-ui-browser-write.json`이다.

## 연결 범위

- `opportunity_work_set`
- `inquiry_assign` 중 `direct_assign`
- `inquiry_unassign`
- `service_change`
- `favorite_set`
- `opportunity_touch`
- `crm_read_scoped_v2` inquiry-compatible + per-actor personal-state projection

모든 write는 `public.crm_write_command_v2` 하나로만 전송한다. 다른 op는 `OP_NOT_CONNECTED:<op>`로 fail-closed하며 Supabase나 기존 n8n으로 우회하지 않는다.

## 원본 보존과 load order

원본 `crm.html`, `mobile.html`과 기존 `staging-phase1` 파일은 수정하지 않는다. Build는 `staging-operational/` 사본을 만들고:

1. `<head>`에서 config → operational adapter → transport 순서로 로드
2. 기존 inline handler의 마지막 override 뒤이자 최초 PC/mobile boot 호출 직전에 operational overlay 로드
3. 뒤이어 로드되는 stage/work editor asset에는 `pushWrite`, `loadData`, `loadLive`, `commitBiz` 재정의가 없음을 build test로 고정

따라서 최초 조회가 구 transport와 경주하지 않고, 실제 reachable `commitBiz`, `inqCtlConfirmReason`, direct assignment, work editor가 operational transport를 사용한다. 과거 중복 함수나 dead handler를 직접 수정하지 않는다.

## Queue/ACK

기존 사용자 행동은 synchronous enqueue 후 background flush를 유지한다. Queue는 계정별 storage, request UUID, sending/uncertain/conflict/rejected 상태와 replay ACK를 유지한다. Adapter가 여섯 op payload를 allow-list로 정규화하고 각 ACK의 request/object/actor/version 또는 inquiry audit 계약을 검증한다.

`service_change`는 scoped read에서 받은 Deal version이 없으면 enqueue하지 않는다. client 표시용 from/at/actor는 서버 권한 정본이 아니다.

## 복합 Activity 중복 방지

Mobile `commitBiz()` 실행 동안 발생하는 파생 `activity`, `next_action_complete`, `next_action` queue item은 overlay가 흡수하고 `service_change` 한 건만 enqueue한다. 서버 bundle이 Activity와 optional Next Action을 원자적으로 만든다. 사용자가 별도 화면에서 기록하는 Activity는 현재 미연결 op이므로 fail-closed이며 조용히 버리지 않는다.

## Scoped read 제한

문의 목록/상세·배정이력은 실제 projection으로 채운다. Deal projection은 아직 공종/owner/stage/brand/version 중심의 부분 계약이라 UI에 제한 상태를 표시한다. 사업유형 현재값은 `brand`로 새로고침되지만 business history와 완전한 Pipeline 상세는 아직 보충 대상이다. Pagination도 100건 단일 page 후보라 운영 전체 read 완료로 판정하지 않는다.

## 금지 범위

Production/n8n/운영 Pages 접근·변경 없음. Staging DDL/DML 없음. 다른 op 자동 연결 없음.
