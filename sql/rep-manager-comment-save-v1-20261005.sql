-- 관리자 한마디 저장 · 읽기 v1 (2026-10-05 관리팀 KPI v7 · 대표 "요청 버튼은 담당자 오늘 업무로 연결")
-- 관리팀 KPI 의 요청 · 영업사원 관리의 코칭은 담당자 × 주(월요일) 한 줄(crm_security.rep_manager_comments)에 쌓인다.
-- 운영 확인(2026-10-05): 이 표는 있지만 0줄 — 쓰는 전송 명령(rep_manager_comment)이 화면에 연결돼 있지 않아 보낸 PC 에만 남았고,
-- 지금의 읽기 함수도 이 표를 내려 주지 않는다. 그래서 저장 · 읽기 함수를 따로 둔다.
--   · 저장: 로그인한 관리자(admin · branch)만. 같은 사람 · 같은 주면 덮어쓴다(화면이 기존 내용 뒤에 한 줄을 붙여 보낸다).
--   · 읽기: 관리자는 전원, 그 밖은 본인 것만. 최근 n주(기본 2).
-- 쓰는 것: crm_security.rep_manager_comments 한 줄. 다른 표는 건드리지 않는다.

create or replace function public.crm_rep_manager_comment_save_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 a record; v_rep text; v_rep_id uuid; v_week date; v_comment text; v_status text; v_at timestamptz:=clock_timestamp(); r crm_security.rep_manager_comments%rowtype;
begin
 select * into a from crm_security.actor();
 if not found or a.permission_role not in ('admin','branch') then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 v_rep:=nullif(btrim(coalesce(p->>'rep_name','')),'');
 v_comment:=nullif(btrim(coalesce(p->>'comment','')),'');
 v_status:=coalesce(nullif(p->>'status',''),'open');
 begin v_week:=nullif(p->>'week_start','')::date; exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 if v_rep is null or v_week is null or v_comment is null or length(v_rep)>40 or length(v_comment)>6000 or v_status not in ('open','done') then
  raise exception 'invalid payload' using errcode='22023';
 end if;
 if extract(isodow from v_week)<>1 or v_week>(v_at at time zone 'Asia/Seoul')::date+7 then raise exception '주 시작일(월요일)이 올바르지 않습니다' using errcode='22023'; end if;
 select u.user_id into v_rep_id from public.users u where u.name=v_rep and u.active order by u.created_at limit 1;
 if v_rep_id is null then raise exception '담당자를 찾을 수 없습니다' using errcode='22023'; end if;
 insert into crm_security.rep_manager_comments as c(rep_user_id,week_start,comment,status,created_by_auth_uid,created_by_user_id,completed_at,created_at,updated_at)
  values(v_rep_id,v_week,v_comment,v_status,a.auth_uid,a.user_id,case when v_status='done' then v_at end,v_at,v_at)
 on conflict (rep_user_id,week_start) do update set comment=excluded.comment,status=excluded.status,
  created_by_auth_uid=excluded.created_by_auth_uid,created_by_user_id=excluded.created_by_user_id,
  completed_at=case when excluded.status='done' then coalesce(c.completed_at,v_at) end,updated_at=v_at
 returning * into r;
 return jsonb_build_object('ok',true,'comment',jsonb_build_object('rep_name',v_rep,'week_start',r.week_start,'comment',r.comment,'status',r.status,
  'created_by',a.display_name,'completed_at',r.completed_at,'updated_at',r.updated_at),'server_at',v_at);
end $fn$;
revoke all on function public.crm_rep_manager_comment_save_v1(jsonb) from public, anon;
grant execute on function public.crm_rep_manager_comment_save_v1(jsonb) to authenticated;

create or replace function public.crm_rep_manager_comment_list_v1(p jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare a record; v_weeks integer; v_from date;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 begin v_weeks:=coalesce(nullif(p->>'weeks','')::integer,2); exception when others then v_weeks:=2; end;
 v_weeks:=greatest(1,least(v_weeks,12));
 v_from:=((now() at time zone 'Asia/Seoul')::date - (v_weeks*7+6));
 return jsonb_build_object('ok',true,'comments',coalesce((
  select jsonb_agg(jsonb_build_object('rep_name',u.name,'week_start',c.week_start,'comment',c.comment,'status',c.status,
    'created_by',w.name,'completed_at',c.completed_at,'updated_at',c.updated_at) order by c.updated_at desc)
  from crm_security.rep_manager_comments c
   join public.users u on u.user_id=c.rep_user_id
   left join public.users w on w.user_id=c.created_by_user_id
  where c.week_start>=v_from and (a.permission_role in ('admin','branch') or c.rep_user_id=a.user_id)),'[]'::jsonb));
end $fn$;
revoke all on function public.crm_rep_manager_comment_list_v1(jsonb) from public, anon;
grant execute on function public.crm_rep_manager_comment_list_v1(jsonb) to authenticated;
