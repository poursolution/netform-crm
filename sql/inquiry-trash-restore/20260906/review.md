# I11/I12 inquiry trash and restore local candidate

판정: `DERIVED_SAFE_LOCAL_CANDIDATE`, Staging 미적용.

- 현재 도달 가능한 PC Control Center의 휴지통 이동과 복원만 한 쌍으로 연결한다. 완전삭제는 포함하지 않는다.
- 외부 op/ACK는 `inquiry_trash`, `inquiry_restore`를 유지한다. client actor/time/purge/protection은 정본으로 쓰지 않는다.
- admin + 현재 inquiry scope만 허용한다. 서버가 원래 status/assigned UUID/time snapshot, 삭제 시각, 30일 purge 시각, direct/reverse Deal 계보 보호를 확정한다.
- Actual inquiry 영업 상태와 담당자는 휴지통 이동 때 변경하지 않는다. private audit의 최신 trash/restore 사건이 현재 휴지통 상태이며 scoped read가 기존 UI 별칭만 제한 투영한다.
- PC는 기존 `inqCtlPartition()`으로 활성/휴지통을 나누고, 모바일은 삭제된 문의를 Today/관리 목록에서 제외한다.
- 동일 request/payload replay는 원 ACK, 다른 payload 재사용과 잘못된 현재 상태는 409다.

적용 순서는 `inquiry-hold/20260906` 뒤다. live schema/ACL guard와 Staging JWT/PC 단건·일괄 trash/restore/replay/read-back/mobile exclusion 검증 전에는 PASS로 계산하지 않는다.
