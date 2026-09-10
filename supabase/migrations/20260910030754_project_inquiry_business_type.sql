begin;
set local search_path = pg_catalog;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

-- The browser reads inquiry_core through a layered private fragment chain.
-- Patch the active base projection while keeping origin brand and customer type.
do $patch$
declare
  function_oid oid := to_regprocedure('crm_security.crm_operational_source_fragment_pre_inquiry_response_20260906(text,uuid,integer)');
  function_def text;
  source_marker constant text := 'i.brand,i.inquiry_type,i.work_type';
  target_marker constant text := 'i.brand,i.inquiry_type,i.business_type,i.work_type';
  marker_count integer;
begin
  if function_oid is null then
    raise exception 'active inquiry source fragment missing';
  end if;

  function_def := pg_get_functiondef(function_oid);
  if position(target_marker in function_def) > 0 then
    return;
  end if;

  marker_count := (length(function_def) - length(replace(function_def, source_marker, ''))) / length(source_marker);
  if marker_count <> 1 then
    raise exception 'inquiry_core projection marker drift: % matches', marker_count;
  end if;

  execute replace(function_def, source_marker, target_marker);
end
$patch$;

do $verify$
declare
  function_oid oid := to_regprocedure('crm_security.crm_operational_source_fragment_pre_inquiry_response_20260906(text,uuid,integer)');
  function_def text;
  function_row record;
  current_def text;
  action_def text;
  progress_def text;
begin
  select p.*, n.nspname
    into function_row
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where p.oid = function_oid;

  function_def := pg_get_functiondef(function_oid);
  if position('i.brand,i.inquiry_type,i.business_type,i.work_type' in function_def) = 0 then
    raise exception 'business_type inquiry_core projection missing';
  end if;
  current_def := pg_get_functiondef('crm_security.crm_operational_source_fragment_v1(text,uuid,integer)'::regprocedure);
  action_def := pg_get_functiondef('crm_security.crm_operational_source_fragment_pre_inquiry_action_check_20260906(text,uuid,integer)'::regprocedure);
  progress_def := pg_get_functiondef('crm_security.crm_operational_source_fragment_pre_inquiry_stage_progress_20260906(text,uuid,integer)'::regprocedure);
  if position('crm_operational_source_fragment_pre_inquiry_action_check_20260906' in current_def) = 0
     or position('crm_operational_source_fragment_pre_inquiry_stage_progress_20260906' in action_def) = 0
     or position('crm_operational_source_fragment_pre_inquiry_response_20260906' in progress_def) = 0 then
    raise exception 'active operational inquiry projection chain drift';
  end if;
  if pg_get_userbyid(function_row.proowner) <> 'postgres'
     or not function_row.prosecdef
     or function_row.provolatile <> 's'
     or function_row.proconfig is distinct from array['search_path=""']
     or has_function_privilege('public', function_oid, 'EXECUTE')
     or has_function_privilege('anon', function_oid, 'EXECUTE')
     or has_function_privilege('authenticated', function_oid, 'EXECUTE')
     or has_function_privilege('service_role', function_oid, 'EXECUTE') then
    raise exception 'operational source fragment ACL/config drift';
  end if;
end
$verify$;

commit;
