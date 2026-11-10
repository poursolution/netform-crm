# AI 사무실 서버 판정 `crm_office_alerts_v1` (2026-11-10)

대표 결정 'A안 진행' — 사무실 알림봇 판정을 대표실 PC 가 아니라 CRM 서버 안에서 10분마다 돌린다. PC 가 꺼지거나 로그인이 풀려도 판정은 계속된다.
SQL: `sql/office-alerts-v1-20261110.sql`(먼저 `sql/office-timing-v1-20261108.sql` 본문 분리판) · 되돌리기: `sql/office-alerts-v1-20261110-rollback.sql` · 검사: `tests/office-alerts-postgres.test.cjs`

## 구조
| 부분 | 이름 | 누가 |
|---|---|---|
| 판정 재료 | `crm_security.crm_office_timing_core`(사무실 조회 본문 · 같은 칸) | 서버 안에서만 |
| 판정 | `crm_security.crm_office_alerts_compute_v1()` | pg_cron 10분마다(`crm-office-alerts`) · 밖에서 실행 불가 |
| 결과표 | `crm_security.office_alert_runs`(회차 · 기준값 · 건수 · 오류) · `crm_security.office_alerts`(건별) | 최근 6회만 보관 |
| 읽기 | `public.crm_office_alerts_v1(p_rule, p_offset, p_limit≤2000)` | 로그인한 CRM 사용자: 관리자 = 전체 · 그 밖 = 본인 담당 건 |
| 바로 판정 | `public.crm_office_alerts_refresh_v1()` | 관리자만 |

기준값 = `public.crm_settings` 'ops_rules'(운영 기준 화면), 없으면 화면 기본값: 배정 30분 · 첫 연락 2시간 · 견적 후 7일 · 정체 30일 · 연락 주기 7일.

## 규칙(rule)
| rule | 대상 | 조건 |
|---|---|---|
| `assign_overdue` | 견적문의 | 미배정 · 전환/종결 아님 · 접수 뒤 30분 넘음 |
| `first_contact_overdue` | 견적문의 | 목록 '첫 연락 전' · 배정(없으면 접수) 뒤 2시간 넘음 · approx |
| `close_reason_missing` · `hold_reason_missing` | 견적문의 | 종결 / 보류인데 사유 없음 |
| `quote_followup_overdue` | 영업건 | 진행 중 · 견적 발송일 있음 · 반응 기록 · 발송 뒤 실제 연결 없음 · 7일 넘음 · approx |
| `stale` | 영업건 | 진행 중 · 마지막 영업 활동(시스템 기록 제외) 뒤 30일 이상 · 다음 할 일 날짜가 아직 안 온 건 제외(2026-11-08 대표 결정) |
| `inactive` | 영업건 | 같은 조건으로 7일 이상 30일 미만(연락 주기 알림 · 정체 아님) |
| `next_action_overdue` | 영업건 | 진행 중 · 다음 할 일 날짜 지남 |
| `lost_reason_missing` · `hold_reason_missing` | 영업건 | 실주 / 대기 단계인데 사유 없음 |
| `request_overdue` | 관리자 요청 | 열림 · 기한 지남 |

`legacy=true` = Live(2026-10-01) 전 이관 자료이거나 활동 기록 없이 등록일로 센 건 → 하나씩 알리지 말고 숫자만.
`approx=true` = 화면만 볼 수 있는 기록(같은 현장 다른 문의 연락 등)을 합치지 못한 근사.
결과 칸: rule · object_type · id · owner_user_id · basis_at · due_at · over_minutes · legacy · approx(고객 이름 · 연락처 · 현장명 · 메모 없음).

## 읽는 쪽
- 응답 `run.age_minutes` 가 20분을 넘으면 판정이 멈춘 것(예약 · 오류) — `last_run.error` 를 본다.
- 성공한 마지막 회차만 내려 준다(실패한 회차는 `last_run` 에만).
- 지금은 로그인한 계정으로 읽는다. 로그인 없이 읽으려면 사무실 전용 CRM 계정(읽기 역할)을 따로 만드는 일이 다음 단계(대표 결정).

## 잔디 알림(B안 · 2026-11-10 · `sql/office-alerts-notify-v1-20261110.sql`)
- 10분 판정 바로 뒤 `crm_security.crm_office_alerts_notify_v1()` 가 **새로 기준을 넘긴 일만** 잔디 토픽으로 보낸다(서버 pg_net · PC 불필요).
- 보내는 것: 규칙 이름 · 건수 · 담당 이름 · 지난 시간 · 모바일 열기 링크(`mobile.html?open=inq:<id>` · `deal:<id>`). 고객 이름 · 연락처 · 현장명 · 메모는 보내지 않는다. 한 번에 오래된 순 10건까지 카드로(`max_items`).
- 이관 자료(legacy)는 보내지 않는다. 같은 건은 한 번만 — 해소됐다가 다시 넘기면 다시 보낸다(`office_alert_notified`).
- 조용한 시간(기본 20시~8시, 서울)에는 보내지 않고 모아 두었다가 아침 첫 판정 때 보낸다.
- 웹훅 주소는 저장소에 없다. 대표가 SQL 편집기에서 `crm_security.office_notify_settings` 에 넣고 켠다(파일 끝 '켜기' 참고). 밖에서는 읽을 수 없다.
- 기록: `crm_security.office_notify_log`(30일).

## 운영 적용
1. Supabase 대시보드 Database → Extensions 에서 `pg_cron` 켜기(꺼져 있으면 예약 없이 설치되고, 판정은 `crm_office_alerts_refresh_v1()` 를 부를 때만 돈다)
2. `sql/office-timing-v1-20261108.sql` Run → `sql/office-alerts-v1-20261110.sql` Run(대표)
3. 확인: `select started_at, ok, error, counts from crm_security.office_alert_runs order by started_at desc limit 3;` · `select jobname, schedule, active from cron.job where jobname='crm-office-alerts';`
