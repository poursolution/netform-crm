# Pipeline 비수주 종료 로컬 후보

상태: `LOCAL_CHAIN_CANDIDATE_AFTER_TRANSITION_NOT_APPLIED`

외부 `close` 이름은 유지하되 내부 의미를 `lost / badfit / nocontact` 비수주 종료로 한정한다. `won`, 금액, 준공, expansion Pool은 이 후보에서 fail-closed 한다.

PC의 최종 구조화 종료 payload와 모바일 legacy 종료 payload는 Adapter에서 `{from,outcome,closed_date,category,detail,reason_source,note}`로 정규화한다. `badfit_lead`는 DB CHECK의 `badfit`으로만 정규화하고 read에서는 outcome과 기존 stage를 함께 유지한다. 서버는 종료 전 stage를 덮지 않아 실주 단계 분석 근거를 보존한다.

한 transaction에서 Deal outcome/lifecycle/context/version, 열린 Next 완료, stage history, 종료 Activity, private close event/audit/receipt를 처리한다. 모바일의 선행 Activity/Next 완료와 PC의 후행 Activity는 UI overlay에서 parent `close`에 흡수하여 서버 write를 정확히 1회로 만든다.

새 테이블은 unexposed `crm_security`에 두고 모든 client role 권한을 revoke한다. 공개 실행점은 authenticated 전용 `public.crm_write_command_v2` 하나다. Staging/Production/n8n 변경은 없다.

Rollback은 기능 SQL과 private table을 제거하되 이미 발생한 business/history/audit를 되돌리지 않는다. close event와 receipt는 private archive로 보존한다.
