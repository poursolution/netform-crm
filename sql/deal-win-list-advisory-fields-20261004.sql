-- 성과 분석 v3 · 기술자문 탭(design_handoff_performance_v3): 공종 · 기술자문 계약일 · 상태를 읽기 함수에 더한다.
-- 바뀌는 것: public.crm_deal_win_list_v1 의 advisory 줄에 칸 5개 추가(work_name · work_type · contract_date · advisory_status · settle_state). 자료는 건드리지 않는다(읽기 전용 함수 · stable).
-- settle_state = 기술자문 계약일 없음 → before(계약 전) / 정산액 ≥ 기술자문료(> 0) → settled(정산 완료) / 그 밖 → progress(진행 중). 정산 금액 자체는 내려보내지 않는다.
-- 나머지 본문 · 권한(authenticated 실행)은 sql/deal-win-type-v1-20261004.sql 과 같다. 다시 실행해도 같은 결과.
create or replace function public.crm_deal_win_list_v1(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare a record;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 return jsonb_build_object('ok',true,
  'rows',coalesce((select jsonb_agg(to_jsonb(w) order by w.award_date desc,w.deal_id) from public.crm_deal_wins w where w.win_status='confirmed'),'[]'::jsonb),
  'advisory',coalesce((select jsonb_agg(jsonb_build_object(
     'advisory_id',ad.advisory_id,'site_name',ad.site_name,'contractor',ad.contractor,
     'decision',att.decision,'origin_business',att.origin_business,'source_deal_id',att.source_deal_id,
     'performance_owner',att.performance_owner,'bid_amount',att.bid_amount,'bid_confirmed_at',att.bid_confirmed_at,
     'advisory_fee',ad.advisory_fee,'pour_amount',ad.pour_amount,
     'work_name',ad.work_name,'work_type',ad.work_type,'contract_date',ad.contract_date,'advisory_status',ad.status,
     'settle_state',case when ad.contract_date is null then 'before'
                         when coalesce(ad.advisory_fee,0)>0 and coalesce(ad.settled,0)>=ad.advisory_fee then 'settled'
                         else 'progress' end) order by att.bid_confirmed_at desc,ad.advisory_id)
    from crm_security.advisory_attribution att join public.advisory_deals ad on ad.advisory_id=att.advisory_id
    where att.decision='confirmed'),'[]'::jsonb));
end $fn$;
revoke all on function public.crm_deal_win_list_v1(jsonb) from public, anon;
grant execute on function public.crm_deal_win_list_v1(jsonb) to authenticated;
