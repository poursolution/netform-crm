# 영업운영 CRM 운영 재점검 — 2026-09-19 후속

대상: poursolution/netform-crm. PC·모바일 확인 기준 빌드: d77c0e40a037493a57c59777e3ac40d6bef1885d.

## 이번에 완료한 범위

- 승인된 과거 클라이언트 접근 차단을 Production에 적용했다. migration 이력은 `20260919105045_contain_legacy_client_access`다.
- 5개 과거 함수와 11개 테이블/뷰의 PUBLIC·anon·authenticated 직접 권한을 회수했다. 현재 scoped API와 service_role 유효 권한은 적용 후 assertions로 확인했다.
- 데이터 행, 함수 본문, 로그인 계정, RLS 활성화 상태는 이 migration에서 변경하지 않았다.
- 적용 후 로그인된 PC를 새로고침해 핵심 데이터 최신/전체 343 표시를 확인했다. 모바일도 실제 로그인 상태에서 우선순위와 오늘 업무를 다시 로드했다.
- 보안 Advisor의 ERROR 11건과 anon SECURITY DEFINER 실행 WARN 5건이 사라졌다. 남아 있는 authenticated 함수 실행·search_path·유출 비밀번호 보호 경고는 별도 검토 대상이다. 모든 보안 조치를 완료했다는 의미가 아니다.

## 관계관리 운영 DB 검증

공개 `crm_write_command_v2`를 authenticated 역할과 합성 JWT subject로 호출했다. 임시 users/access_review/deal만 만들었고 전체 트랜잭션을 ROLLBACK했다. 실제 계정 비밀번호나 기존 고객 행을 변경하지 않았다.

10개 검사 통과:
1. 다음 일정 저장 실패 시 연락 기록·버전·영수증도 롤백.
2. 연락 기록과 다음 일정 함께 저장, 서버 ID 연결 및 재조회.
3. 같은 요청 재시도 시 중복 생성 없음.
4. 오래된 버전 거부.
5. 같은 요청 ID로 다른 내용 전송 거부.
6. 다른 담당자의 rep 쓰기 거부.
7. consultation 쓰기 거부.
8. 범위 미승인 branch 쓰기 거부.
9. 비활성 사용자 쓰기 거부.
10. 만료된 권한 검토 사용자 쓰기 거부.

후속 조회에서 합성 사용자 잔여 0건을 확인했다. 재현 SQL은 `relationship-production-rollback.sql`이다. 이 검증은 실계정 브라우저 저장·새로고침 또는 실제 두 세션의 동시 경쟁을 대체하지 않는다.

## 기존 미완료 목록 정정 및 남은 항목

| 항목 | 현재 확인 결과 | 남은 작업 |
| --- | --- | --- |
| 비밀번호 | #84/#85 운영 반영: 휴대폰 번호 안내 제거, PC·모바일 개인 변경창 | 사용자 실제 변경·재로그인, 임시 비밀번호 발급/재설정/퇴사자 회수 절차 |
| 관계관리 | Production helper/dispatcher 존재, 위 10개 운영 DB 검증 통과 | 실계정 UI 저장 및 두 세션 동시성 |
| Site 검토 Queue | 9/16 Production migration 및 공개 RPC 존재. Staging 전용이라는 이전 판정 정정 | 사람의 검토 결정 및 적용 후 재조회 |
| 미연결 고객자산 | Site 없는 Deal 60, Inquiry 86; Site identity 검토 결정 0 | 동일 현장 증거 검토 후 연결. 고객 원본 자동 변경 없음 |
| 데이터 정리 | Production cleanup RPC 전부 없음 | UUID 기반 현재 권한 계약을 쓰는 서버 구현, fingerprint/멱등성/원본 보존 검증 후 UI 연결 |
| 확장 견적 전환 | Production helper와 migration 존재 | 발송증명, 합성 트랜잭션/중복 검증, 실제 새 Deal 확인 |
| Campaign | public뿐 아니라 전체 schema에서도 campaign/recipient 관계 및 campaign/provider 함수 없음. Edge Functions 0개, cron.job 없음 | Queue migration 검토·적용, 실제 provider worker 구축, callback 인증/멱등성 및 예약 검증 |
| Sheets 담당자 동기화 | 서버 service-role RPC 소스/이력은 있으나 실제 실행 경로 미확인 | 실제 Apps Script/n8n 주소, 최근 실행과 Sheets→DB 대조 |
| ASQ 운영정보 | 이전 읽기 migration/검증 유지 | netform-crm 내 실제 worker 연결 및 실제 1건 읽기. 별도 제품 저장소 변경 없음 |
| 코드 정리 | 이번 변경 범위에 포함하지 않음 | 저장·권한 검증 후 미사용 함수 작은 단위 정리 |

Campaign 소스가 있다는 사실과 Production에 배포됐다는 사실을 구분한다. 현재 확인한 Production에는 서버 발송 경로가 없다. 외부 시스템 전체에 공급자 연동이 없다는 뜻은 아니다. 테스트 수신번호는 공개 저장소 기록에서 제외한다.

[Supabase API 권한 안내](https://supabase.com/docs/guides/api/securing-your-api) · [비로그인 SECURITY DEFINER 경고](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
