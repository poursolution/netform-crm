-- 초기 이관 롤백: 백필로 들어간 서명 1건짜리 원장만 제거한다.
-- 백필 이후 사용자가 변경·취소를 얹은 딜(version>1 / sequence>1 존재)은 실사용 기록이므로 보존한다.
BEGIN;
DELETE FROM crm_security.contract_sales_events e
 USING crm_security.contract_sales h
 WHERE e.deal_id=h.deal_id
   AND e.sequence=1
   AND e.kind='signed'
   AND e.reason LIKE '과거 수주 초기 이관%'
   AND h.version=1
   AND NOT h.cancelled
   AND NOT EXISTS(SELECT 1 FROM crm_security.contract_sales_events x WHERE x.deal_id=e.deal_id AND x.sequence>1);
DELETE FROM crm_security.contract_sales h
 WHERE NOT EXISTS(SELECT 1 FROM crm_security.contract_sales_events e WHERE e.deal_id=h.deal_id);
COMMIT;
