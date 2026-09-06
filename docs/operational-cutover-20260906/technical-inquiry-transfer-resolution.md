# I15 기술자문 문의 영업기회 이관 계약

판정: `DERIVED_SAFE_LOCAL_CANDIDATE` — 로컬 DB/Adapter/UI 검증 완료, Staging 미적용.

## 실제 UI 의미

`crm.html#inqTechPromote` 하나만 도달 가능하다. 기술자문으로 잘못 분류된 기존 문의 원본을 지우지 않고, `public.deals`에 기술자문 Deal을 하나 만든 뒤 문의를 `영업전환`으로 바꾼다. 현재 UI가 연속으로 보내는 `opportunity_create` + `inquiry_status`는 서버에서 하나의 transaction으로 흡수해야 한다.

`public.advisory_deals`는 현재 해당 버튼이 사용하지 않는 레거시 저장소다. 이관 transaction에 중복 insert하지 않는다.

## 서버 정본

- 호출자: 현재 inquiry scope가 있는 승인된 `admin`만.
- 원본: 서버가 lock한 inquiry의 `brand/inquiry_type`, `site_id/site_name`, `work_type`, `assigned_to`, `status`.
- 중복: `deals.origin_inquiry_id`, inquiry `deal_id/opportunity_id` 중 하나라도 있으면 409.
- Deal: `brand=list_name=service_type=origin_business=current_business='기술자문'`, `stage_code='first_contact'`, `origin_inquiry_id=inquiry.id`, `version=1`.
- Site: inquiry에 유효한 `site_id`가 있으면 그대로 쓴다. 없으면 UI처럼 Deal `site_id=NULL`을 유지하고 `list_fields.site_name`만 표시용으로 저장한다. 이름으로 새 Site를 추론하지 않는다.
- 담당자: inquiry `assigned_to`가 active/approved/미만료 `rep` UUID일 때만 Deal owner로 사용한다. 아니면 UI의 명시적 규칙대로 `owner_id=NULL`인 미배정 Deal을 만든다. 가짜 사용자 UUID를 만들지 않는다.
- 미배정 Deal 가시성: 생성 admin의 기존 review 만료일까지 explicit `object_scope` read/write를 동일 transaction에 추가한다.
- 금액: actual inquiries에 canonical amount 컬럼이 없으므로 `NULL`. 클라이언트 `q.amt`/raw를 정본으로 사용하지 않는다.
- 부수효과: inquiry `status='영업전환'`, `qualified_at`, Deal stage history, Deal activity, Deal/private inquiry audit, command receipt를 원자적으로 저장한다.
- 멱등성: request UUID 재전송은 동일 ACK, 다른 payload 재사용은 409.
- ACK: 기존 `operation:'opportunity_create'`, `new_opportunity_id`, `opportunity_id`, `version`, server actor/time을 유지한다. 뒤이은 `inquiry_status` child write는 UI overlay가 흡수한다.

## 차단 유지

일반 문의 promote, 경남 인계, 확장견적 전환, 임의 `brand='기술자문'` 직접 생성은 이 intent를 사용할 수 없다.

## 구현 및 다음 검증

`sql/technical-inquiry-transfer/20260906`에 admin-only helper와 Adapter/UI 흡수 경로를 구현했고, 배정/미배정, site 있음/없음, 중복 lineage, replay/reuse, late-audit rollback, evidence-preserving rollback을 로컬에서 검증했다. 누적 package의 마지막 레이어에도 연결했다. 다음은 별도 승인 후 Staging preflight와 JWT/browser read-back 검증이며, 승인 전에는 적용하지 않는다.
