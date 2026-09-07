begin;
set local lock_timeout='5s';
set local statement_timeout='90s';
set local search_path=pg_catalog;

alter function crm_security.crm_expansion_quote_convert_command_v1(uuid,uuid,integer,jsonb)
  rename to crm_expansion_quote_convert_pre_legacy_won_20260907;
revoke execute on function crm_security.crm_expansion_quote_convert_pre_legacy_won_20260907(uuid,uuid,integer,jsonb)
  from public,anon,authenticated,service_role;

create function crm_security.crm_expansion_quote_convert_command_v1(
  p_request_id uuid,p_object_id uuid,p_expected_version integer,p_payload jsonb
) returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare source_row public.deals%rowtype; inner_expected integer:=p_expected_version;
begin
  if auth.uid() is null then raise exception 'forbidden' using errcode='42501'; end if;
  if p_expected_version=0 and not exists(select 1 from crm_security.expansion_pool x where x.source_deal_id=p_object_id) then
    select * into source_row from public.deals where id=p_object_id for update;
    if not found or not crm_security.can_deal(p_object_id,true)
       or source_row.outcome is distinct from 'won' or source_row.stage_code is distinct from 'won'
       or source_row.lifecycle_status is distinct from 'closed'
       or coalesce(source_row.won_amount,0)<=0 or source_row.completion_date is null
    then raise exception 'legacy won source is not convertible' using errcode='PT409'; end if;
    insert into crm_security.expansion_pool(source_deal_id,site_id,owner_id,source_work_summary,source_won_amount,
      completion_date,next_contact_at,candidate_work_items,relationship_state,expansion_status,created_at,updated_at,version)
    values(source_row.id,source_row.site_id,source_row.owner_id,source_row.work_summary,source_row.won_amount,
      source_row.completion_date,source_row.completion_date+30,'["타공종 확인"]'::jsonb,
      '기존고객','추가 니즈 확인',clock_timestamp(),clock_timestamp(),1)
    on conflict(source_deal_id) do nothing;
    inner_expected:=1;
  elsif p_expected_version=0 then
    inner_expected:=1;
  end if;
  return crm_security.crm_expansion_quote_convert_pre_legacy_won_20260907(
    p_request_id,p_object_id,inner_expected,p_payload
  );
end
$fn$;
revoke execute on function crm_security.crm_expansion_quote_convert_command_v1(uuid,uuid,integer,jsonb)
  from public,anon,authenticated,service_role;

create or replace function public.crm_write_command_v2(
  p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb
) returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
begin
  if p_operation='expansion_quote_convert' then
    return crm_security.crm_expansion_quote_convert_command_v1(p_request_id,p_object_id,p_expected_version,p_payload);
  end if;
  return crm_security.crm_write_command_v2_pre_expansion_convert_20260907(
    p_request_id,p_operation,p_object_id,p_expected_version,p_payload
  );
end
$fn$;
revoke execute on function public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) to authenticated;

create or replace function public.crm_expansion_context(p jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $fn$
declare source_id uuid; a record; events_value jsonb; dispatches jsonb;
begin
  if jsonb_typeof(p) is distinct from 'object'
     or exists(select 1 from jsonb_object_keys(p) k where k<>'source_opportunity_id')
     or not p ? 'source_opportunity_id' or jsonb_typeof(p->'source_opportunity_id') is distinct from 'string'
  then raise exception 'invalid expansion context payload' using errcode='22023'; end if;
  begin source_id:=(p->>'source_opportunity_id')::uuid;
  exception when invalid_text_representation then raise exception 'invalid expansion context identity' using errcode='22023'; end;
  if auth.uid() is null then raise exception 'forbidden' using errcode='42501'; end if;
  select * into a from crm_security.actor();
  if not found or a.permission_role not in ('rep','branch','admin') or not crm_security.can_deal(source_id,false)
     or not exists(select 1 from public.deals d where d.id=source_id and d.outcome='won' and d.stage_code='won' and d.lifecycle_status='closed')
  then raise exception 'forbidden' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',e.event_id,'source_opportunity_id',e.source_deal_id,
    'kind',case e.kind when 'note' then '접촉·니즈 기록' when 'status_change' then '상태 변경'
      when 'next_contact_change' then '다음 접촉일 변경' when 'pipeline_convert' then 'Pipeline 전환'
      else '상태·다음 접촉일 변경' end,
    'note',case e.kind when 'note' then e.note when 'status_change' then e.before_status||' → '||e.after_status
      when 'next_contact_change' then '다음 접촉 '||e.before_next_contact_at||' → '||e.after_next_contact_at
      when 'pipeline_convert' then e.before_status||' → Pipeline 전환'
      else e.before_status||' → '||e.after_status||' · 다음 접촉 '||e.after_next_contact_at end,
    'actor',e.actor_name,'created_at',e.occurred_at,'occurred_at',e.occurred_at
  ) order by e.occurred_at,e.event_id),'[]'::jsonb) into events_value
  from crm_security.expansion_pool_events e where e.source_deal_id=source_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',m.id,'dispatch_id',m.id,'source_opportunity_id',m.deal_id,'status',m.status,
    'sent_at',m.occurred_at,'recipient',m.recipient_phone,'quote_title',m.template_title,
    'quote_version_id',q.id,'quote_version_no',m.quote_version_no,'quote_attachment_id',m.quote_attachment_id
  ) order by m.occurred_at desc,m.id),'[]'::jsonb) into dispatches
  from crm_security.message_outcomes m
  join crm_security.quote_versions q on q.deal_id=m.deal_id and q.version_no=m.quote_version_no
  where m.deal_id=source_id and m.status='sent' and m.quote_attachment_id is not null;
  return jsonb_build_object('contract_version',1,'ok',true,'source_opportunity_id',source_id,
    'events',events_value,'dispatches',dispatches,'dispatch_completeness','verified_message_outcomes');
end
$fn$;
revoke execute on function public.crm_expansion_context(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.crm_expansion_context(jsonb) to authenticated;
commit;
