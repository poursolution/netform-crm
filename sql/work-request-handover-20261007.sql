-- B5: dedicated handover kind. Existing support/재배정 인계 rows remain unchanged.
begin;
alter table crm_security.work_requests drop constraint if exists work_requests_kind_check;
alter table crm_security.work_requests add constraint work_requests_kind_check
 check(kind in ('branch','first','quote','follow','award','contract','support','deadline','handover'));
create or replace function public.crm_work_request_create_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 a record; r crm_security.work_requests%rowtype; v_at timestamptz:=clock_timestamp();
 v_type text; v_id text; v_kind text; v_label text; v_scope text; v_to text; v_to_id uuid; v_due timestamptz; v_asks jsonb;
begin
 select * into a from crm_security.actor();
 if not found or a.permission_role<>'admin' then raise exception '요청은 관리자만 보낼 수 있습니다' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 v_type:=p->>'target_type'; v_id:=nullif(btrim(coalesce(p->>'target_id','')),''); v_kind:=p->>'kind';
 v_label:=nullif(btrim(coalesce(p->>'label','')),''); v_scope:=coalesce(nullif(p->>'to_scope',''),'user'); v_to:=nullif(btrim(coalesce(p->>'to_name','')),'');
 v_asks:=case when jsonb_typeof(p->'asks')='array' then p->'asks' else '[]'::jsonb end;
 begin v_due:=nullif(p->>'due_at','')::timestamptz; exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 if v_type not in ('inquiry','deal') or v_id is null or length(v_id)>80 or v_kind not in ('branch','first','quote','follow','award','contract','support','deadline','handover')
  or v_label is null or length(v_label)>40 or v_scope not in ('user','branch') or v_to is null or length(v_to)>40 or v_due is null
  or jsonb_array_length(v_asks)>8 or length(coalesce(p->>'memo',''))>1000 or length(coalesce(p->>'site',''))>200 then
  raise exception 'invalid payload' using errcode='22023';
 end if;
 if v_kind='handover' or (v_kind='support' and v_label='재배정 인계') then
  if v_type<>'deal' or v_scope<>'user' then raise exception '인계 대상은 영업건 담당자여야 합니다' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('handover:'||v_id,0));
  if not exists(select 1 from public.deals d join public.users u on u.user_id=d.owner_id
      where d.id::text=v_id and u.active and u.name=v_to) then
   raise exception '서버에 저장된 현재 담당자를 확인해 주세요' using errcode='40001';
  end if;
  if exists(select 1 from crm_security.work_requests w where w.target_type='deal' and w.target_id=v_id
     and (w.kind='handover' or (w.kind='support' and w.label='재배정 인계')) and w.status in ('sent','seen','working')) then
   raise exception '이미 답을 기다리는 같은 요청이 있습니다' using errcode='23505';
  end if;
 end if;
 if v_due<v_at - interval '1 minute' or v_due>v_at + interval '31 days' then raise exception '처리 기한이 올바르지 않습니다' using errcode='22023'; end if;
 if v_scope='user' then
  select u.user_id into v_to_id from public.users u where u.name=v_to and u.active order by u.created_at limit 1;
  if v_to_id is null and not exists(select 1 from crm_security.sales_directors d where d.name=v_to and d.active) then raise exception '받는 사람을 찾을 수 없습니다' using errcode='22023'; end if;
  if v_to_id=a.user_id then raise exception '내 담당 건은 요청 없이 바로 처리합니다' using errcode='22023'; end if;
 end if;
 begin
  insert into crm_security.work_requests(target_type,target_id,site,brand,kind,label,to_scope,to_user_id,to_name,asks,due_at,due_label,memo,requested_by_user_id,requested_by_name,created_at,updated_at)
   values(v_type,v_id,left(coalesce(p->>'site',''),200),left(coalesce(p->>'brand',''),40),v_kind,v_label,v_scope,v_to_id,v_to,v_asks,v_due,left(coalesce(p->>'due_label',''),40),coalesce(p->>'memo',''),a.user_id,a.display_name,v_at,v_at)
   returning * into r;
 exception when unique_violation then
  raise exception '이미 답을 기다리는 같은 요청이 있습니다' using errcode='23505';
 end;
 return jsonb_build_object('ok',true,'request',crm_security.work_request_json(r,a.user_id,a.permission_role),'server_at',v_at);
end $fn$;
revoke all on function public.crm_work_request_create_v1(jsonb) from public, anon;
grant execute on function public.crm_work_request_create_v1(jsonb) to authenticated;


-- Separate entry point doubles as a release gate: old servers never receive the new kind.
create or replace function public.crm_work_request_handover_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
begin
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 return public.crm_work_request_create_v1(p||jsonb_build_object('kind','handover','label','재배정 인계'));
end $fn$;
revoke all on function public.crm_work_request_handover_v1(jsonb) from public,anon;
grant execute on function public.crm_work_request_handover_v1(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
