# Attachment/state bundle — T01–T03 local review

상태: `T01_BLOCKED / T02_CONTRACT_ONLY / T03_DERIVED_SAFE_LOCAL_HELPER / NOT_DEPLOYED`

Production, n8n, 운영 Pages, Staging 원격 호출·DDL·DML, 사용자 파일 업로드는 수행하지 않았다. 기존 public `crm_write_command_v2`, frozen delegate, operational UI도 수정하지 않았다.

## 판정

| ID | reachable 기능 | 판정 | local candidate |
|---|---|---|---|
| T01 | PC/mobile `attachment_prepare → signed PUT → attachment_complete` | `BLOCKED` | 없음 |
| T02 | Deal의 `ready` 첨부 metadata 목록/Gallery | `DERIVED_SAFE_CONTRACT_ONLY`, 현재 구현은 `BLOCKED` | 없음 |
| T03 | PC/mobile 즐겨찾기, 최근 본/최근 작업 | `DERIVED_SAFE_LOCAL_HELPER` | private table/helper/read/receipt |

## T01 — prepare, signed PUT, complete

PC의 최종 reachable 경로는 `crm.html:7598-7601`, mobile은 `mobile.html:2424-2426`이다. 한 파일마다 prepare 응답의 `upload_url || signed_url`과 선택적 `upload_headers`를 받아 raw `PUT`한 뒤 complete한다. 두 UI 모두 파일당 20 MiB, 최대 10개, 분류/태그/메모를 제공한다.

현재 Staging snapshot에는 `public.crm_attachments`, attachment 함수가 없다. snapshot은 `storage` schema를 캡처하지 않았으므로 bucket 존재·private 여부·MIME/size 제한·policy도 증명하지 않는다. signer의 raw PUT 응답, signed URL TTL/replay, prepare 후 PUT 실패, PUT 후 complete 실패, 다중 파일 부분 성공, pending/object cleanup 소유자와 보존기간이 미확정이다.

과거 `sql/20260905_attachments_favorites.sql`은 `crm-site-files` bucket과 public metadata table을 만들지만 현재 권한 모델과 맞지 않는다. 특히 client `object_path/uploaded_by/user_key/touched_at`을 신뢰하고, prepare payload 재사용 충돌·server actor·cleanup을 보장하지 않는다. 따라서 해당 SQL을 복사하거나 bucket/table을 새로 만들지 않았다.

부족 규칙 한 줄: **Staging private bucket/ACL/signer 계약과 pending·고아 object cleanup 정책을 read-only preflight로 확정해야 한다.**

## T02 — ready list

PC `execAttachments/execAttachPanel`과 mobile `dealAttachmentsM/openAttachmentGalleryM`은 `status`가 없거나 `ready`인 row만 표시한다. 필요한 최소 표시 필드는 `id,file_name,mime_type,size_bytes,category,tags,memo,uploaded_by,status,created_at`이다. 목록에 object path, signed URL, Storage metadata는 필요 없다.

`can_deal(deal_id,false)`를 적용하고 ready metadata만 scoped read에 중첩하는 계약 자체는 안전하다. 그러나 실제 metadata relation이 없고 scoped read는 이번 범위에서 수정 금지이므로 SQL helper를 만들지 않았다.

부족 규칙 한 줄: **실제 attachment metadata relation과 Deal FK가 확인된 뒤 기존 scoped read의 `attachments` projection으로만 보충해야 한다.**

## T03 — favorite/touch

PC `execTouch/toggleExecFavorite`은 `crm.html:7604-7607`, mobile `execTrackM/toggleFavoriteM`은 `mobile.html:2431-2437`에서 최종 Deal 상세에 연결된다. payload는 다음과 같다.

```text
favorite_set:      opportunity_id, user_key, favorite
opportunity_touch: opportunity_id, user_key, touch_kind(view|work), touched_at
```

`user_key`와 `touched_at`은 표시/낙관 UI 값일 뿐 권한 정본이 아니다. 후보 helper는 JWT로 확정한 Auth UUID/CRM UUID를 state key로 사용하고 server clock만 저장한다. Deal 자체를 수정하지 않으므로 Deal version과 business audit을 만들지 않는다. read scope인 `can_deal(...,false)`를 매 요청 및 read 시 다시 확인한다.

`candidate.sql`은 public endpoint를 추가하지 않고 다음 private object만 만든다.

- `crm_security.user_opportunity_state`
- `crm_security.user_opportunity_state_receipts`
- `crm_security.crm_user_opportunity_state_command_v1(...)`
- `crm_security.crm_user_opportunity_states_v1()`

모두 `PUBLIC/anon/authenticated/service_role` 직접 접근을 금지한다. 향후 공개 연결은 승인된 combined Dispatcher/read migration에서만 수행해야 한다.

### 의미

- favorite은 actor+Deal별 boolean upsert다.
- view touch는 server timestamp와 `view_count + 1`, work touch는 server timestamp만 갱신한다.
- 같은 actor/request/payload replay는 count를 늘리지 않는다.
- 같은 request의 다른 의미 payload는 `PT409`다.
- forged client `user_key/touched_at`은 저장·권한·canonical receipt에 사용하지 않는다.
- PC/mobile은 동일 Auth/CRM actor key를 사용하므로 같은 state를 읽는다.

## Rollback

`rollback.sql`은 private functions를 제거하고 state/receipt table을 `crm_attachment_state_archive`로 이동한다. 즐겨찾기/최근 작업 evidence를 삭제하지 않는다. public Dispatcher와 기존 업무 evidence는 변경하지 않는다.

## 적용 전 gate

1. T03을 기존 단일 public Dispatcher와 scoped read에 합칠 별도 승인
2. exact live function/table/ACL guard 재생성
3. T01 Storage read-only preflight 및 signer/cleanup 결정
4. T02 actual metadata relation 확정
5. browser JWT에서 계정 격리, 타 Deal scope, replay, 새로고침 PC/mobile 동일성 검증

