# 첨부 T01/T02 호환 계약 판정

판정일: 2026-09-06  
범위: 현재 로컬 Golden PC/mobile에서 도달 가능한 Deal 첨부 UI와 실제 Staging 스냅샷의 정적 대조  
제외: 외부 Storage 호출, Staging DDL/DML, Production, n8n, 운영 Pages

## 결론

| Coverage | 기능 | UI 의미 | 현재 Staging 호환 상태 | 판정 |
|---|---|---|---|---|
| T01 | 파일 선택 → `attachment_prepare` → signed upload → `attachment_complete` | PC/mobile 모두 실제 도달 가능하며 payload와 순서가 같다 | private metadata, JWT signer/upload, object 검증, audit/receipt 후보가 `sql/attachment-compat/20260906`에 구현됐다 | **DERIVED_SAFE (local candidate), Staging 미적용** |
| T02-a | Deal 첨부 목록/Gallery | PC/mobile 모두 `ready` 메타데이터를 읽어 표시한다 | `deal_core.items[].attachments`에 path/URL 없는 ready-only projection 후보가 구현됐다 | **DERIVED_SAFE (local candidate), Staging 미적용** |
| T02-b | 파일 다운로드 | 일반 첨부 카드/Gallery에는 다운로드 동작이 없다. PC의 문맥 견적 버튼만 이미 포함된 HTTPS URL을 조건부로 연다 | on-demand signed download 발급 함수/TTL/ACK가 없고 mobile 호출부도 없다 | **NEEDS_VERIFICATION / reachable 아님** |

따라서 T01/T02를 아직 Staging 호환 PASS로 계산하면 안 된다. 과거 SQL은 현재 권한·receipt·Storage 계약을 충족하지 않는 후보이므로 재사용하지 않았다. Supabase 공식 Storage 계약 확인 후 private metadata와 인증된 JWT signer/upload를 사용하는 로컬 후보를 구현했다. 집중 시험은 DB/Adapter/UI 기준으로 통과했으며 실제 Staging File/JWT·부분실패·cleanup 시험 전까지 `DERIVED_SAFE_LOCAL_CANDIDATE`다.

## 근거

### 현재 PC/mobile 호출 계약 — CONFIRMED

두 화면은 한 파일마다 같은 순서를 실행한다.

1. `attachment_prepare`
2. 응답의 `upload_url || signed_url`에 `PUT` (응답의 `upload_headers`, 없으면 파일 MIME의 `Content-Type`)
3. `attachment_complete`
4. 선택한 모든 파일이 완료된 뒤 별도 `activity`와 `opportunity_touch`

`attachment_prepare` payload:

```text
opportunity_id, file_name, mime_type, size_bytes,
category, tags, memo, uploaded_by
```

`attachment_complete` payload:

```text
opportunity_id, attachment_id, object_path,
file_name, mime_type, size_bytes, category, tags, memo, uploaded_by
```

UI가 즉시 소비하는 prepare 응답은 `attachment_id`, `object_path`, `upload_url|signed_url`, 선택적 `upload_headers`다. complete 응답은 `attachment` 객체 또는 같은 필드를 최상위에 반환할 수 있다. 공통 write ACK는 최소 `{ok:true, write_id, operation}`을 유지해야 한다. PC는 공통 `WriteAck`로 상관관계를 검사하지만, 첨부용 mobile helper는 현재 HTTP/`ok`만 검사하므로 서버는 ACK를 약화시키지 말고 mobile 쪽 상관관계 검증을 별도 호환 수정 대상으로 둔다.

PC/mobile 모두 한 번에 최대 10개, 파일당 20 MiB를 클라이언트에서 검사한다. 분류는 `현장사진/견적자료/도면/회의자료/계약관련/기타`다. 사진 picker는 `image/*`, 자료 picker는 이미지 및 PDF/Word/Excel/PowerPoint 확장자를 받는다.

### 목록 필드 — DERIVED_SAFE

기존 카드/Gallery가 실제 표시하는 최소 필드는 다음뿐이다.

```text
id, file_name, mime_type, size_bytes, category,
tags, memo, uploaded_by, status, created_at
```

Deal scoped read 안에서 `status='ready'`만 반환하고 `can_deal(opportunity_id, false)`를 그대로 적용하는 보충은 기존 UI 호환 범위다. 목록에 `object_path`, raw Storage metadata, 영구 URL 또는 signed URL을 싣지 않는다. 현재 UI 표시는 이 필드들을 요구하지 않는다.

**부족 규칙 한 줄:** `crm_read_scoped_v2`의 Deal 결과 중 어디에 위 `attachments` 배열을 넣을지와 그 원천이 될 실제 metadata relation/FK를 먼저 승인해야 한다.

### 다운로드 reachability — NEEDS_VERIFICATION

PC의 일반 첨부 카드는 클릭 가능한 다운로드가 아니고 mobile Gallery도 메타데이터만 표시한다. PC에는 별도의 견적 문맥 동작이 있으나, attachment row에 미리 `download_url/downloadUrl/signed_url/signedUrl/url`이 들어 있는 경우에만 새 창을 연다. mobile에는 동등한 signed-download 호출부가 없다.

보안 계약 후보는 attachment ID를 받아 서버가 row의 Deal을 역참조하고 `can_deal(deal_id, false)`를 다시 확인한 다음, private bucket의 짧은 수명 URL을 on demand로 발급하는 것이다. URL은 목록/DB/receipt에 장기 저장하지 않는다. 그러나 이것은 현재 UI 계약으로 확정되지 않았다.

**부족 규칙 한 줄:** 일반 첨부 다운로드를 현재 reachable 기능으로 볼지, 견적 문맥에만 둘지와 signed URL 만료/응답 형태가 확정되지 않았다.

## 과거 SQL과 실제 Staging 스냅샷 대조

`sql/20260905_attachments_favorites.sql`은 다음 의도를 보여준다.

- private bucket `crm-site-files`
- 20 MiB 및 MIME allowlist
- `crm_attachments`의 `pending → ready|failed` 상태
- ready 목록과 Storage object 존재 확인

하지만 현재 계약으로 재사용할 수 없는 차이가 있다.

| 항목 | 과거 SQL | 현재 호환 요구 | 판정 |
|---|---|---|---|
| 권한 | Deal 존재만 확인 | JWT actor를 서버에서 확정하고 prepare/complete에 `can_deal(..., true)`, list/download에 `can_deal(..., false)` | NEEDS_VERIFICATION |
| 경로 | 클라이언트 `object_path` override 허용 | 서버가 Deal/attachment ID로 경로 생성, 클라이언트 경로는 정본 아님 | DERIVED_SAFE |
| actor | `uploaded_by` text를 신뢰 | Auth UUID/CRM UUID를 서버에서 확정하고 표시명만 파생 | DERIVED_SAFE |
| signed upload | metadata만 반환 | 현재 raw `PUT`과 호환되는 URL/header를 인증된 서버 Adapter가 발급 | NEEDS_VERIFICATION |
| MIME/크기 | bucket allowlist와 DB 20 MiB check; prepare는 MIME allowlist 미검사, 0 byte 허용 | prepare와 bucket 모두 `0 < size <= 20 MiB` 및 동일 MIME 집합 적용, complete에서 object metadata 일치 확인 | NEEDS_VERIFICATION |
| 멱등성 | 같은 `write_id`면 memo를 덮어씀 | canonical payload hash가 같으면 동일 결과, 다르면 409 | NEEDS_VERIFICATION |
| complete | attachment ID의 object 존재만 확인 | same Deal/권한/상태/size/type를 재검증한 뒤 ready 전환 | DERIVED_SAFE |
| ACL | service role grant 위주 | SECURITY DEFINER 고정 search_path, PUBLIC/anon/authenticated 직접 실행 차단, Adapter 전용 경계 | NEEDS_VERIFICATION |
| Storage DDL | `storage.buckets` 직접 INSERT/UPDATE | Storage schema를 migration SQL로 직접 변경하지 말고 승인된 Storage API/대시보드 상태를 preflight로 확인 | NEEDS_VERIFICATION |

실제 `sql/inquiry-direct-assign/20260906/after.json`에는 public `crm_attachments` relation과 `crm_attachment_*`/`crm_deal_attachments` 함수가 없다. 이어서 2026-09-06 실제 Staging을 `storage.buckets`, `pg_policies`, `information_schema`, `pg_proc`로 read-only 확인했고 결과를 `staging-attachment-preflight-20260906.json`에 고정했다. bucket 0, attachment metadata relation/column 0, attachment function 0, `storage.objects` policy 0이다. 즉 Storage 축도 단순 미캡처가 아니라 현재 Staging에 기반이 없음이 확인됐다.

**부족 규칙 한 줄:** 새 private bucket/20 MiB/MIME/policy와 signer 계약을 먼저 승인해야 하며, 현재 연결할 기존 bucket은 없다.

## 최소 서버 경계 후보

이 절은 구현 승인이 아니라, 기존 UI를 바꾸지 않는 최소 경계를 명시한다.

### prepare

- 서버 JWT에서 Auth UUID/CRM UUID를 확정한다.
- `can_deal(opportunity_id, true)`를 통과해야 한다.
- file name/category/positive size/allowlisted MIME를 검사한다.
- attachment ID와 object path는 서버가 만든다.
- metadata는 `pending`으로 생성한다.
- `request_id/write_id` receipt는 canonical payload hash와 묶고, 다른 payload 재사용은 409로 거절한다.
- signed URL은 인증된 Adapter가 private bucket에 한해 만든다. service key는 브라우저에 노출하지 않는다.

prepare DB transaction과 Storage signed URL 생성은 하나의 DB transaction이 될 수 없다. URL 발급 실패 시 `pending` row를 어떻게 실패/재시도할지, 같은 request replay에서 만료된 URL을 재발급할지 규칙이 필요하다.

**부족 규칙 한 줄:** prepare receipt의 결과에 만료 URL을 고정할지, 같은 request 재시도에서 안전하게 재발급할지 결정되지 않았다.

### PUT

PUT은 DB command가 아니라 signed Storage capability 사용이다. 기존 UI는 URL 자체에 raw `PUT`하고 선택적 headers를 사용하므로, signer의 실제 응답이 이 형태와 일치해야 한다. 허용된 MIME와 20 MiB는 UI 검사만 믿지 않고 bucket과 prepare에도 일치시킨다.

**부족 규칙 한 줄:** 현행 Supabase signer가 `upload_url + upload_headers` raw PUT 계약을 그대로 제공하는지 Staging에서 검증되지 않았다.

### complete

- 서버가 attachment row를 잠그고 `opportunity_id`, 현재 actor의 `can_deal(..., true)`, `pending|ready` 상태를 다시 확인한다.
- 클라이언트가 재전송한 file/path/actor 값은 권한 또는 정본으로 쓰지 않는다.
- 실제 object의 bucket/path/size/content type이 pending metadata와 같아야 한다.
- 최초 complete는 `ready` 전환, private audit, receipt를 한 DB transaction에서 기록한다.
- 같은 request/payload complete는 기존 ACK를 반환하고 ready/audit/activity를 중복 생성하지 않는다. 다른 payload의 request ID 재사용은 409다.

Storage byte PUT은 이 transaction 밖에 있으므로 complete 실패 시 object와 pending row가 남을 수 있다.

### activity/ACK 원자 경계 — NEEDS_VERIFICATION

현재 PC/mobile은 여러 파일을 차례로 complete한 뒤, 전체 성공 시 `파일첨부 N개 등록` activity와 touch를 별도 op로 기록한다. 중간 파일이 실패하면 앞 파일은 이미 ready일 수 있지만 UI 배열과 batch activity는 갱신되지 않는다. 반대로 complete 내부에서 파일별 activity를 만들면 기존 batch activity와 중복·의미 차이가 난다.

확정 가능한 경계는 각 파일의 `ready + audit + complete receipt`를 원자화하는 것뿐이다. `N개 등록` activity를 정확히 한 번 보장하려면 batch ID/finalize 또는 기존 별도 activity의 멱등 규칙이 필요하며, 현재 payload에는 batch ID가 없다. touch는 파생 UX state이므로 파일 정본 transaction과 묶지 않는다.

**부족 규칙 한 줄:** 여러 파일 중 일부만 성공했을 때 ready 파일을 유지할지 보상 삭제할지와 batch activity를 언제 한 건 기록할지 결정되지 않았다.

## metadata 상태와 고아 cleanup — NEEDS_VERIFICATION

최소 상태 의미는 다음과 같이 제한할 수 있다.

- `pending`: metadata 생성, complete 전
- `ready`: object 검증 및 complete transaction 성공, 목록에 노출
- `failed`: 업로드 포기/검증 실패/cleanup 대상, 목록에 미노출

과거 `crm_attachment_mark_failed`는 client에서 호출되지 않고, pending TTL이나 Storage object 삭제가 없다. 실패 경우에는 (a) PUT 전 URL 발급 실패의 metadata-only pending, (b) PUT 성공 후 complete 실패의 object+pending, (c) 여러 파일 batch 중 일부 성공이 모두 가능하다. Storage object 삭제는 Storage API를 통해 수행해야 하며 metadata table을 지우는 것으로 bytes가 정리된다고 가정하면 안 된다.

**부족 규칙 한 줄:** pending 만료 시간, 재시도 유예, 누가 cleanup을 실행하는지와 failed row/Storage object 보존 기간이 정해지지 않았다.

## 타입 경계 — NEEDS_VERIFICATION

과거 bucket allowlist는 JPEG/PNG/WebP/HEIC/HEIF, PDF, Word, Excel, PowerPoint다. 그러나 UI의 `image/*`는 GIF/SVG 등 더 넓고 MIME이 비어 있으면 `application/octet-stream`으로 보낸다. 따라서 과거 allowlist를 유지하면 picker에서 선택됐지만 prepare/PUT에서 거절되는 파일이 생긴다.

**부족 규칙 한 줄:** `image/*` 전체를 허용할지 과거 명시 allowlist로 제한하고 PC/mobile `accept` 문구를 맞출지 결정되지 않았다.

## 적용 전 필수 검증

1. Staging ref를 확인한 read-only Storage preflight로 bucket, private, 20 MiB, MIME allowlist, policy를 캡처한다.
2. 현재 DB snapshot에서 attachment metadata relation/function이 없음을 재확인한다.
3. `can_deal` write/read scope를 각각 prepare/complete와 list/download에 적용한다.
4. raw PUT signer 응답과 만료/재시도 동작을 synthetic 파일로 검증할 계획을 먼저 승인받는다.
5. partial batch, expired signed URL, complete retry, payload collision, permission loss between prepare/complete, type/size mismatch를 시험한다.
6. generic download가 실제 운영 기능인지 UI owner가 확정하기 전에는 T02 download를 coverage PASS로 계산하지 않는다.

이 문서는 local contract evidence이며 Staging 적용 승인이나 PASS 증거가 아니다.
