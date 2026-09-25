-- 데이터 정본 사전 → DB 컬럼 주석 (2026-09-25). 데이터·권한·동작 변화 없음(COMMENT만).
-- 정본 문서: docs/data-dictionary.md
comment on column public.deals.origin_business is '정본: 원천 브랜드(고객을 처음 만난 브랜드). 사업 전환 후에도 불변. 브랜드 실적 귀속 기준.';
comment on column public.deals.current_business is '정본: 현재 진행 사업(브랜드). 변경 이력은 business_history.';
comment on column public.deals.service_type is '정본: 서비스 유형(시공영업/컨설팅/설계·감리). 브랜드 값과 섞지 말 것.';
comment on column public.deals.brand is '구형(이관 원본). 새 계산 금지 — origin_business/current_business 사용.';
comment on column public.deals.origin_channel is '구형·오염: 실측상 브랜드명이 들어 있음(2026-09-25). 채널·브랜드 분석에 쓰지 말 것.';
comment on column public.deals.origin_inquiry_id is '정본: 문의→영업 계보. 전환 명령(crm_inquiry_pipeline_promote_command_v1)이 기록.';
comment on column public.deals.lifecycle_status is '진행 여부. 종료 단계(won/lost/badfit_lead/badfit_pipe/nocontact)면 반드시 closed (deals_closed_stage_consistent).';
comment on column public.inquiries.deal_id is '폐기: 문의→영업 계보는 deals.origin_inquiry_id가 정본. 이 컬럼으로 전환율 계산 금지.';
comment on column public.inquiries.opportunity_id is '폐기: 문의→영업 계보는 deals.origin_inquiry_id가 정본. 이 컬럼으로 전환율 계산 금지.';
do $c$ declare f regprocedure; begin
 for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
          where n.nspname='public' and p.proname='apply_business_change' loop
  execute format('comment on function %s is %L', f,
   '구형·사용 금지: current_business·brand·service_type을 같은 값으로 덮어 서비스 유형 축을 파괴함. 전송 허용 목록에 없음.');
 end loop;
end $c$;
