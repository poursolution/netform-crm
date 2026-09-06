# CRM 전체 권한 보안 점검 v2

검토일: 2026-09-05  
판정: **P0 보안 결함 확인 / 운영 hardening 적용 금지 / 운영 ACL·정책 재확인 필요**

## 범위와 증거 한계

저장소의 모든 SQL, PC·모바일 HTML/JS, 인증 안내, localStorage 사용, Supabase RPC 호출을
정적 분석했다. 운영 Supabase·n8n·배포 사이트는 조회하거나 변경하지 않았다. 따라서 아래
ACL/RLS 표는 저장소가 의도한 상태이며, 실제 운영 상태는 catalog dump로 별도 확인해야 한다.

## 주요 발견

| 우선순위 | 발견 | 영향 | 판정 |
|---|---|---|---|
| P0 | `crm_bundle()`이 호출자 검사 없이 전체 번들을 반환 | CRM 전체 읽기·RLS 우회 가능 | 기존 검토 유지 |
| P0 | inquiry assign/unassign/status/trash/restore/duplicate/purge가 auth/역할/소유권 검사 없음 | 로그인 사용자 또는 PUBLIC 기본권한을 통한 전사 문의 변조·삭제 가능 | 즉시 브라우저 실행 차단 필요 |
| P0 | `p_changed_by`, `p_deleted_by`, `p_restored_by`를 감사 actor로 신뢰 | 행위자 위조 | 서버가 `auth.uid()`로 확정해야 함 |
| P0 | `crm_site_contacts(uuid)`와 `crm_contact_upsert(jsonb)`에 Deal 접근검사 없음 | 임의 opportunity UUID로 개인정보 읽기·변조 가능 | service_role 전용 유지 후 교체 |
| P0 | PC·모바일에 “비밀번호=본인 핸드폰 번호 전체” 안내가 존재 | 추측·재사용 가능한 약한 인증 | Auth 정책·계정 전환 계획 필요 |
| P1 | favorite/touch/states가 caller의 `user_key`를 신뢰 | 타 사용자 개인 상태 조회·변경 가능 | auth.uid 기반 user key로 교체 |
| P1 | 첨부 메타 함수가 `uploaded_by`와 opportunity_id를 신뢰 | 임의 현장 첨부 메타 생성·조회 가능 | Deal 권한검사 + Edge signed URL |
| P1 | 메시지·견적·인수인계 함수가 client actor/owner 필드를 저장 | 감사로그 위조 가능 | 서버 actor와 대상 권한검사 필요 |
| P1 | 여러 service_role 전용 함수가 GRANT만 있고 PUBLIC REVOKE가 없음 | PostgreSQL 기본 PUBLIC EXECUTE 잔존 가능 | 운영 ACL 전수 확인·회수 |
| P1 | 고정 localStorage 쓰기 큐와 로컬 CRM 변경 데이터 | 공유 PC 계정 전환 시 교차 전송·개인정보 잔존 위험 | 사용자별 namespace·로그아웃 격리 |
| P1 | 동적 HTML sink 193개 라인, inline event handler 524개 라인, CSP 0개 | Stored XSS가 지속 세션 권한으로 확대 | sink별 taint 감사 후 DOM API/CSP 전환 |
| P1 | Supabase Auth `persistSession:true` 및 PC 기본 createClient | XSS·공유 PC에서 장기 세션 악용 | 위협모델에 맞는 세션 정책·강제 로그아웃 |
| P1 | PC 전체 CRM JSON 다운로드 경로 존재 | 정상/탈취 계정의 대량 반출 | admin+MFA+감사로그+서버 export로 제한 |
| P1 | jsDelivr Supabase SDK 사용, CSP/SRI 없음 | 공급망 또는 허용 출처 확대 | 자체 호스팅/무결성 검증 및 nonce 기반 CSP |

## SECURITY DEFINER 인벤토리

저장소에서 확인한 계열은 다음과 같다. 동일 함수가 후속 SQL에서 재정의되는 경우 최종 적용
순서에 따라 본문과 ACL이 달라질 수 있다.

| 계열 | 함수 | 저장소상 브라우저 권한/검사 |
|---|---|---|
| 전체조회 | `crm_bundle`, `crm_read_bundle` | 원본 위험; reader만 auth.uid 검사 |
| 문의 | `crm_inquiry_assign`, `unassign`, `status`, `trash`, `restore`, `duplicate`, `purge`, `crm_purge_expired_inquiries` | authenticated GRANT, 내부 auth/역할 검사 없음 |
| 연락처 | `crm_site_contacts`, `crm_contact_upsert`, consent/message stats | 대부분 service_role GRANT만; 대상 접근검사 없음 |
| 메시지 | `crm_message_log`, relationship response/hold/stage helpers, logs JSON | service_role용이나 client actor 필드 존재 |
| 실행/견적/인수인계 | relationship upsert, quote version, stage check, handover | service_role용, client created_by/owner 값 존재 |
| 첨부/개인상태 | prepare/complete/fail/list, favorite/touch/states | service_role용, user_key/uploaded_by·대상 권한검사 부족 |
| 캠페인/지원/관리 | campaign create/delivery/json, customer support, rep comments | service_role용; PUBLIC REVOKE 누락 가능 |
| 확장영업 | pool upsert/update/json, note/context/finish/actor | note/context는 auth-aware guard 사용; email JWT 연결은 auth_uid로 교체 권고 |
| 데이터정리 | cleanup actor/preview/apply/state 및 내부 helper | 관리자 guard 있음; email JWT 대신 auth_uid 권고 |
| 지사/담당자 | `crm_sales_people`, inquiry assign 재정의 | roster는 authenticated 공개; assign 재정의도 actor 검증 없음 |
| ASQ | sync/json | service_role용; PUBLIC REVOKE 확인 필요 |

정확한 운영 목록과 각 `proacl`은 다음 catalog 조회 결과를 승인 전에 첨부해야 한다.

```sql
select n.nspname,p.proname,p.oid::regprocedure signature,p.prosecdef,p.proacl,
       has_function_privilege('anon',p.oid,'execute') anon_execute,
       has_function_privilege('authenticated',p.oid,'execute') authenticated_execute,
       has_function_privilege('service_role',p.oid,'execute') service_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prosecdef order by 2,3;
```

PUBLIC은 실제 role이 아니므로 `has_function_privilege('public',...)`로 검사하지 않고,
`aclexplode(coalesce(proacl,acldefault('f',proowner)))`의 `grantee=0`을 확인한다.

## 테이블·뷰·RLS와 anon 점검

저장소에서 RLS enable 및 anon/authenticated table 권한 회수가 명시된 신규 테이블은 캠페인,
캠페인 수신자, 첨부, 사용자별 현장상태, 메시지 로그, 견적 version, 인수인계, 지원 액션,
확장 이벤트/발송, 대기맥락, 데이터정리 테이블들이다. `sales_people`과 확장 pool에는
authenticated SELECT 정책이 있다. 문의 배정 이력은 authenticated 전체 SELECT/INSERT
정책이라 최소권한 위반이다.

기존 핵심 `users/deals/inquiries/contacts/organizations/notes`의 CREATE/RLS 원본은 이
저장소에 완전하게 존재하지 않아 운영 정책을 판정할 수 없다. 모든 public table/view와
storage는 아래 운영 read-only dump가 없으면 통과 처리하지 않는다.

```sql
select n.nspname,c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','storage') and c.relkind in ('r','p','v','m') order by 1,2;
select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies order by 1,2,3;
select table_schema,table_name,privilege_type from information_schema.role_table_grants
where grantee='anon' order by 1,2,3;
```

저장소상 `crm-site-files` 버킷은 `public=false`다. 그러나 signed URL 발급 주체가
`auth.uid()` → CRM user → opportunity 접근권한을 검증한다는 Edge Function/정책 코드는
발견되지 않았다. 이 검증 전에는 브라우저 다운로드 경로를 승인하면 안 된다.

## 역할별 목표 구조

- anon: public/storage의 CRM table, view, RPC 접근 0
- rep: `users.auth_uid=auth.uid()`로 식별하고 안정적 assignee_user_id로 연결된 행만 읽고 씀
- manager(`dual` 포함 여부를 운영 역할표로 확정): 팀/조직 범위 관리
- admin: 전체 관리, purge·권한관리 같은 고위험 작업만 허용
- service_role: Edge Function·서버·migration에서만 사용하고 브라우저/HTML/저장소에 금지
- audit actor: 요청 JSON의 이름이 아니라 서버가 `auth.uid()`로 확정한 UUID와 표시명을 저장

## 작성한 hardening SQL의 성격

`20260905_crm_security_hardening.sql`은 차단 우선 초안이다. 실행 시 public schema의 모든
`crm_* SECURITY DEFINER`에서 PUBLIC/anon/authenticated 실행권한을 회수하고 service_role만
유지한 뒤, 이미 auth guard가 확인된 reader/cleanup/expansion RPC만 authenticated에 다시
허용한다. 위험한 문의·연락처 함수는 의도적으로 브라우저에서 차단된다.

이는 데이터 DML을 하지 않고 transaction 사전·사후조건 실패 시 rollback하지만, 현재
브라우저/n8n 기능을 중단시킬 수 있으므로 운영 ACL·호출자 덤프 없이 실행하면 안 된다.
auth-aware inquiry/contact 함수는 실제 운영 스키마와 역할 정책 확정 후 별도 migration으로
교체한다. 매개변수 호환을 위해 client actor 값은 받을 수 있어도 무시하고 서버 actor를 쓴다.

## 전화번호 비밀번호 교체안

1. 신규 계정부터 랜덤 초기 비밀번호 또는 관리자 초대/magic link로 생성한다.
2. 전화번호 유래 비밀번호 계정을 식별하되 실제 비밀번호를 조회·기록하지 않는다.
3. 강제 비밀번호 재설정, 최소 길이·유출 비밀번호 차단, 가능하면 MFA를 적용한다.
4. PC·모바일의 전화번호 비밀번호 안내를 제거하고 재설정/초대 안내로 교체한다.
5. 기존 세션 철회와 계정별 Auth UUID 연결을 검증한다.
6. 전환 완료 전에는 로그인 문구만 먼저 바꿔 사용자를 잠그지 않는다.

## XSS·세션·대량반출 감사

정적 검색 결과 PC/mobile/index 합계 기준 동적 HTML sink가 있는 라인 193개,
inline `onclick/onerror/onload` 라인 524개, CSP 선언은 0개다. 숫자는 취약점 개수가 아니라
검토 대상 라인 수다. 여러 경로가 `esc()`/`escAttr()`를 사용하지만, 문자열 조립이 방대해
모든 사용자 입력의 escaping을 증명하지 못했다. 특히 아파트명·연락처명·메모·상담내용·서버
오류문구가 `innerHTML`에 도달하는 경로를 taint 기준으로 하나씩 검사해야 한다.

Supabase SDK는 모바일에서 `persistSession:true, autoRefreshToken:true`, PC에서는 기본 설정으로
생성된다. 브라우저 저장 세션이 있다는 사실만으로 취약한 것은 아니지만 Stored XSS 및 공유 PC
위협과 결합하면 영향이 커진다. CSP는 inline handler가 많아 즉시 엄격 적용할 수 없으므로,
이벤트 위임/`addEventListener`, `textContent`, DOM node 생성으로 먼저 전환한 뒤 nonce 기반
`script-src`를 report-only → enforcement 순서로 적용한다.

PC에는 `netform-crm-full-*.json` 전체 다운로드 기능과 인계 JSON export가 있다. 현재 번들 전체를
브라우저에 올린 뒤 내보내므로 DB pagination만으로 반출을 막을 수 없다. 전체 export는 서버 RPC나
Edge Function으로 옮겨 admin 역할, MFA `aal2`, 사유, 건수 상한, 감사로그, rate limit을 강제한다.
일반 목록은 서버 페이지당 50~100건, 상세·연락처는 화면 진입 시 단건 조회로 분리한다.

## private-first 및 기본 권한

새 내부 테이블·helper·감사로그는 `crm_private` 같은 Data API 비노출 schema에 만들고,
public에는 브라우저용 최소 RPC/view만 둔다. 노출 view는 지원 PostgreSQL에서
`security_invoker=true`를 사용해 원본 RLS를 따르게 한다. hardening 초안에는 현재 CRM 함수
소유자별로 public schema의 향후 함수 기본 PUBLIC EXECUTE를 회수하는
`ALTER DEFAULT PRIVILEGES`가 포함됐다. 이는 같은 owner가 만드는 모든 향후 public 함수에
영향을 주므로 운영 owner 목록 검토와 별도 승인이 필요하다.

## 키·환경 수명주기

저장소에서는 publishable key만 브라우저에 확인됐고 service_role/secret key 문자열은 발견되지
않았다. 이것은 n8n 설정·과거 Git 이력·호스팅 로그·Supabase secrets까지 검사한 결과가 아니다.
n8n 핵심 경로 제거 후 서버 키를 새로 발급하고 Edge Function별 최소 secret만 연결한 다음 구 키를
폐기한다. LOCAL/TEST/STAGING/PRODUCTION 프로젝트와 자격증명을 분리하고 Codex 실행 계정에는
production SQL 권한을 상시 부여하지 않는다.

## n8n 제거 목표

PC/mobile → Supabase Auth → scoped read + RLS / auth-aware write RPC → DB·private Storage·audit.
외부 공급자 비밀이 필요한 발송·signed URL만 Edge Function이 맡는다. n8n은 핵심 권한 경로가
아니며, 남길 경우에도 제한된 외부 자동화만 수행한다.

## 운영 적용 전 승인 체크리스트

- [ ] 운영 `pg_proc/proacl`, PUBLIC ACL, table/view grants, RLS/policies dump 확보
- [ ] anon으로 모든 CRM RPC/table/view/storage 접근 실패 확인
- [ ] 현재 배포 PC·모바일과 n8n의 RPC URL/JWT role 전수 확인
- [ ] `admin/dual/viewer/rep`의 실제 의미와 manager 매핑 승인
- [ ] rep 자기/타인 Deal·문의·연락처 행을 분리한 스테이징 fixture 준비
- [ ] inquiry assign/status/trash/restore/duplicate/purge 역할표 승인
- [ ] actor 위조, 임의 user_key/opportunity_id, signed URL IDOR 통합시험 통과
- [ ] service_role key가 브라우저·GitHub Pages·로그·번들에 없음을 secret scan으로 확인
- [ ] 전화번호 비밀번호 계정 전환 및 사용자 공지 계획 승인
- [ ] 193개 동적 HTML sink의 사용자입력 taint 감사 및 Stored XSS fixture 통과
- [ ] inline handler 제거 계획, CSP report-only 결과, 외부 SDK 공급망 정책 승인
- [ ] 전체 export를 admin+MFA+사유+감사+rate limit 서버 경로로 이전
- [ ] 목록 50~100건 pagination 및 연락처/상세 lazy read 부하·권한 시험 통과
- [ ] CRM 함수 owner별 `ALTER DEFAULT PRIVILEGES` 영향 범위 승인
- [ ] n8n/과거 Git/호스팅/Secrets secret scan 및 구 서버 키 rotation 완료
- [ ] LOCAL/TEST/STAGING/PRODUCTION 프로젝트·자격증명 분리 확인
- [ ] localStorage 쓰기 큐 사용자 격리와 로그아웃 시 교차전송 0건 확인
- [ ] 실제 적용 SQL diff, 중단 기능, rollback SQL, 담당자와 적용 시간 승인

**여기서 중단한다. 운영 변경은 사용자의 별도 명시 승인 전 금지한다.**
