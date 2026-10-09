-- Existing coaching/comment row; no new table, column, read scope, or notifications.
-- New PC clients must pass the original editor snapshot. Legacy v1 remains compatible.
begin;
create or replace function public.crm_rep_manager_comment_save_v2(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare a record; rep text; owner_id uuid; owners integer; wk date; body text; state text;
 expected_at timestamptz; at_time timestamptz:=clock_timestamp(); r crm_security.rep_manager_comments%rowtype;
begin
 select * into a from crm_security.actor();
 if not found or a.permission_role not in ('admin','branch') then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' or not(p?'expected') then raise exception 'invalid coaching base' using errcode='22023'; end if;
 rep:=nullif(btrim(p->>'rep_name'),''); body:=nullif(btrim(p->>'comment'),''); state:=p->>'status';
 begin wk:=(p->>'week_start')::date; exception when others then raise exception 'invalid week' using errcode='22023'; end;
 if rep is null or length(rep)>40 or body is null or length(body)>6000 or state is null or state not in ('open','done') or wk is null
  or extract(isodow from wk)<>1 or wk>(at_time at time zone 'Asia/Seoul')::date+7 then raise exception 'invalid payload' using errcode='22023'; end if;
 select count(*) into owners from public.users u where u.name=rep and u.active;
 if owners<>1 then raise exception '담당자 계정 확인 필요' using errcode='22023'; end if;
 select u.user_id into owner_id from public.users u where u.name=rep and u.active;
 if p->'expected'='null'::jsonb then
  insert into crm_security.rep_manager_comments(rep_user_id,week_start,comment,status,created_by_auth_uid,created_by_user_id,completed_at,created_at,updated_at)
   values(owner_id,wk,body,state,a.auth_uid,a.user_id,case when state='done' then at_time end,at_time,at_time)
   on conflict(rep_user_id,week_start) do nothing returning * into r;
 else
  if jsonb_typeof(p->'expected') is distinct from 'object' or jsonb_typeof(p#>'{expected,updated_at}') is distinct from 'string'
   or jsonb_typeof(p#>'{expected,comment}') is distinct from 'string' or (p#>>'{expected,status}') is null
   or (p#>>'{expected,status}') not in ('open','done') then raise exception 'invalid coaching base' using errcode='22023'; end if;
  begin expected_at:=(p#>>'{expected,updated_at}')::timestamptz;
   if not isfinite(expected_at) then raise exception 'invalid timestamp'; end if;
  exception when others then raise exception 'invalid coaching base' using errcode='22023'; end;
  update crm_security.rep_manager_comments c set comment=body,status=state,created_by_auth_uid=a.auth_uid,created_by_user_id=a.user_id,
   completed_at=case when state='done' then coalesce(c.completed_at,at_time) end,
   updated_at=greatest(clock_timestamp(),c.updated_at+interval '1 microsecond')
   where c.rep_user_id=owner_id and c.week_start=wk and c.updated_at=expected_at
    and c.comment=p#>>'{expected,comment}' and c.status=p#>>'{expected,status}' returning * into r;
 end if;
 if r.rep_user_id is null then raise exception 'COACHING_CONFLICT: 다른 저장 내용이 있습니다. 입력을 보관한 뒤 다시 조회해 주세요' using errcode='PT409'; end if;
 return jsonb_build_object('ok',true,'comment',jsonb_build_object('rep_name',rep,'week_start',r.week_start,'comment',r.comment,'status',r.status,
  'created_by',a.display_name,'completed_at',r.completed_at,'updated_at',r.updated_at),'server_at',r.updated_at);
end $fn$;
revoke all on function public.crm_rep_manager_comment_save_v2(jsonb) from public,anon,service_role;
grant execute on function public.crm_rep_manager_comment_save_v2(jsonb) to authenticated;
commit;
