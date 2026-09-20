-- 과거 수주 건 계약 원장 초기 이관 (2026-09-20 대표 결정).
-- 원장 도입 시점에 백필을 하지 않아 수주 131건이 계약실적 0원으로 보이던 것을 해소한다.
-- 원장의 신뢰 원칙은 유지한다: 계약일·계약금액(양의 정수)·귀속 담당자가 모두 확인되는 건만 올리고,
-- 확인 불가 건은 개수만 남기고 건드리지 않는다 (추정 금액·추정 날짜로 원장을 오염시키지 않는다).
-- 계약일 우선순위: 계약 단계 기록(contract_date) → 준공일(completion_date) → 종결일(closed_at).
BEGIN;
DO $$
DECLARE
 r record; sig_date date; amount bigint;
 backfill_actor constant uuid:='00000000-0000-4000-8000-000000000001'; -- 시스템 백필 표식 (실사용자 아님)
 backfill_reason constant text:='과거 수주 초기 이관 · CRM 수주 스냅샷 기준(계약일·계약금액·담당자 확인분) · 2026-09-20 대표 승인';
 migrated integer:=0; already integer:=0; skipped_amount integer:=0; skipped_owner integer:=0; skipped_date integer:=0;
BEGIN
 FOR r IN
  SELECT d.id,d.owner_id,d.brand,d.won_amount,d.completion_date,d.closed_at,
   d.stage_contexts->'contract'->'fields'->>'contract_date' AS ctx_date,
   u.name AS owner_name,
   coalesce(s.site_name,o.name,nullif(d.list_fields->>'site_name',''),nullif(d.list_fields->>'name',''),'') AS site_label
  FROM public.deals d
  LEFT JOIN public.users u ON u.user_id=d.owner_id
  LEFT JOIN public.sites s ON s.site_id=d.site_id
  LEFT JOIN public.organizations o ON o.id=d.organization_id
  WHERE d.outcome='won'
  ORDER BY d.id
 LOOP
  IF EXISTS(SELECT 1 FROM crm_security.contract_sales h WHERE h.deal_id=r.id) THEN
   already:=already+1; CONTINUE; -- 이미 수기 기록된 계약은 그대로 정본
  END IF;
  IF r.won_amount IS NULL OR r.won_amount<=0 OR r.won_amount<>trunc(r.won_amount) OR r.won_amount>9007199254740991 THEN
   skipped_amount:=skipped_amount+1; CONTINUE;
  END IF;
  IF r.owner_id IS NULL OR r.owner_name IS NULL THEN
   skipped_owner:=skipped_owner+1; CONTINUE;
  END IF;
  sig_date:=CASE WHEN r.ctx_date~'^\d{4}-\d{2}-\d{2}$' THEN r.ctx_date::date
            ELSE coalesce(r.completion_date,r.closed_at::date) END;
  IF sig_date IS NULL OR sig_date>(now() AT TIME ZONE 'Asia/Seoul')::date THEN
   skipped_date:=skipped_date+1; CONTINUE;
  END IF;
  amount:=trunc(r.won_amount)::bigint;
  INSERT INTO crm_security.contract_sales
   VALUES(r.id,true,sig_date,amount,r.owner_id,r.owner_name,r.site_label,coalesce(r.brand,''),1,amount,false);
  INSERT INTO crm_security.contract_sales_events(deal_id,sequence,kind,effective_date,amount_delta,reason,actor_auth_uid)
   VALUES(r.id,1,'signed',sig_date,amount,backfill_reason,backfill_actor);
  migrated:=migrated+1;
 END LOOP;
 RAISE NOTICE 'contract_sales backfill: migrated=% already=% skipped_amount=% skipped_owner=% skipped_date=%',
  migrated,already,skipped_amount,skipped_owner,skipped_date;
END $$;
COMMIT;
