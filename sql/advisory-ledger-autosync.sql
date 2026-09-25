-- 기술자문 계약 → 계약실적 반영: 미반영 큐 조회 RPC (2026-09-25 적용 완료 · v2)
-- 매핑: 스냅샷 crm_deal_id 우선, 없으면 site_id 단일 딜. 문서ID로 멱등.
-- 레거시(모두싸인) 문서는 금액·계약일이 원본에 없어 관리자가 계약서를 보고 두 값만 확정 →
-- 반영은 검증된 crm_contract_sales_write_v1 경로(관리자 UI '기술자문 반영' 모달)에서 건별 ACK.
create or replace function public.crm_advisory_ledger_pending_v1()
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
begin
 if not exists(select 1 from crm_security.actor() a where a.permission_role='admin') then
  raise exception 'forbidden' using errcode='42501';
 end if;
 return (
  with signed as (
   select a.site_id, a.site_name,
          c.value->>'source_document_id' as document_id,
          nullif(c.value->>'document_amount','')::bigint as amount,
          coalesce(nullif(c.value->>'recognized_contract_date',''),
                   nullif(c.value->>'source_printed_contract_date',''),
                   left(c.value->>'completion_observed_at',10)) as effective_date,
          c.value->>'current_source_manager' as source_manager,
          c.value->>'document_url' as document_url,
          nullif(c.value->>'crm_deal_id','') as snap_deal_id
   from public.advisory_deals a
   join crm_security.advisory_record_links l on l.advisory_id=a.advisory_id
   join crm_security.advisory_snapshots s on s.project_id=l.project_id
   cross join lateral jsonb_array_elements(s.snapshot->'contracts') c
   where c.value->>'source_document_id'=l.document_id
     and c.value->>'source_status' in ('completed','document_all_signed')
  ), mapped as (
   select sg.*,
          coalesce(sg.snap_deal_id::uuid,
            (select d.id from public.deals d where d.site_id=sg.site_id
             and (select count(*) from public.deals d2 where d2.site_id=sg.site_id)=1)) as deal_id,
          (select count(*) from public.deals d where d.site_id=sg.site_id) as deal_count
   from signed sg
  )
  select jsonb_build_object('ok',true,'items',coalesce((select jsonb_agg(jsonb_build_object(
    'document_id',m.document_id,'site_name',m.site_name,'amount',m.amount,
    'effective_date',m.effective_date,'source_manager',m.source_manager,
    'document_url',m.document_url,
    'deal_id',m.deal_id,'deal_count',m.deal_count,
    'expected_version',coalesce((select cs.version from crm_security.contract_sales cs
                                 where cs.deal_id=m.deal_id),0),
    'has_row',exists(select 1 from crm_security.contract_sales cs where cs.deal_id=m.deal_id)
   ) order by m.effective_date)
   from mapped m
   where not exists (select 1 from crm_security.contract_sales_events e
                     where e.reason like '%문서 '||m.document_id||'%')
  ),'[]'::jsonb)));
end $fn$;
revoke all on function public.crm_advisory_ledger_pending_v1() from public, anon;
grant execute on function public.crm_advisory_ledger_pending_v1() to authenticated;
