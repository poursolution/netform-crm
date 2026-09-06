# O07S/O08M operational source — local chained candidate

상태: `LOCAL_CHAIN_CANDIDATE_AFTER_QUOTE / STAGING_NOT_APPLIED`

2026-09-06 projection 보강: 초기 후보는 DB의 `site_name`, `owner_name`, `amount`, 날짜를 읽고도 mobile 변환에서 현장명을 고정 placeholder로, 담당자를 빈 문자열로 만들고 금액·연락처를 버렸다. 이를 실제 Golden 소비 alias로 교정했다. Deal core는 기존 `can_deal` 범위 안에서 현장/담당/금액/업무/상태/날짜와 `deals.contact_id`로 직접 연결된 대표 연락처 1건만 반환한다. contact `emails/custom_fields`나 다른 Site/Deal 연락처는 포함하지 않는다.

따라서 현재 후보가 연결하는 read는 `O07S`, `O08M`, 모바일 단순 검색 `O08S`다. `crmAskM`의 이번 달 견적발송·과거 근무지 조건은 별도 `O08A`로 분리해 계속 차단한다. 그 조건은 Activity 발송 근거와 권한 있는 전체 연락처/근무이력 projection이 필요하다.

2026-09-06 보완: Deal projection의 `next_action.id`를 PC `nextActionObj.id`와 mobile `nextAction.id`에 그대로 전달한다. 브라우저 임시 ID를 만들지 않고 서버 UUID로 완료 command를 식별하기 위한 read compatibility alias이며 저장 의미는 바꾸지 않는다.

## 결론

기존 `crm_read_scoped_v2(uuid,integer,uuid,uuid)`의 signature/OID/body/ACL을 바꾸지 않는다. 대신 인증 사용자에게만 공개되는 `crm_operational_source_v1(domain,after,limit)`을 별도로 추가하는 후보다. `deal_core`와 `inquiry_core`가 독립 cursor를 가지므로 기존 RPC의 공유 cursor 문제를 피한다.

- 서버는 `limit+1`을 조회해 `has_more`를 실제로 판정한다.
- `scope_completeness='actor_authorized_rows_only'`는 현재 actor가 볼 수 있는 행을 뜻하며 회사 전체를 뜻하지 않는다.
- transport는 domain별로 마지막 page까지 수집하지 못하면 partial data를 UI에 넘기지 않고 fail closed한다.
- Deal에는 T03의 actor별 favorite/recent state와 P14의 append-only quote versions/current quote가 포함된다.
- Activity 자유서술, Inquiry raw/address, audit, 다른 담당자 데이터는 projection에 포함하지 않는다.
- private fragment는 모든 client role의 직접 실행을 금지하고 public wrapper만 authenticated에 허용한다.

## 이번 후보가 닫는 범위

- `O07S`: PC Dashboard가 사용하는 권한 범위 Deal/Inquiry 원천행 공급 경로 후보
- `O08M`: Mobile Mine 담당 Deal 원천행 공급 경로 후보

KPI/Performance/Executive/Gyeongnam/Today/Control/Search의 완전한 화면 의미는 닫지 않는다. quote/won 정본, 전사 scope, branch pool, inquiry follow-up 등 기존 `NEEDS_VERIFICATION` 항목은 그대로다.

## 적용 순서와 rollback

T03 `personal-state-compat/20260906`, pipeline action, quote-version layer 적용이 순서대로 선행돼야 한다. 현 파일은 live OID/hash guard를 아직 포함하지 않은 로컬 체인 후보이므로 Staging 적용 파일이 아니다. rollback은 새 public/private 함수 두 개만 제거하며 기존 read/write 함수와 업무행을 건드리지 않는다.
