-- 본사 영업사원 관리 · 주차별 관리자 코멘트
-- 브라우저는 crm-write를 통해서만 이 RPC를 호출한다.

create extension if not exists pgcrypto;

create table if not exists public.crm_rep_manager_comments (
  id uuid primary key default gen_random_uuid(),
  rep_name text not null,
  week_start date not null,
  comment text not null,
  status text not null default 'open' check (status in ('open','done')),
  created_by text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rep_name,week_start)
);

alter table public.crm_rep_manager_comments enable row level security;
revoke all on public.crm_rep_manager_comments from anon, authenticated;
grant select, insert, update on public.crm_rep_manager_comments to service_role;

create or replace function public.crm_rep_manager_comment_upsert(p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  row_id uuid;
  rep_value text := nullif(trim(p->>'rep_name'),'');
  week_value date := nullif(p->>'week_start','')::date;
  comment_value text := nullif(trim(p->>'comment'),'');
  status_value text := coalesce(nullif(p->>'status',''),'open');
begin
  if rep_value is null or week_value is null or comment_value is null then
    raise exception 'rep_name, week_start and comment are required';
  end if;
  if status_value not in ('open','done') then
    raise exception 'status must be open or done';
  end if;

  insert into public.crm_rep_manager_comments (
    rep_name,week_start,comment,status,created_by,completed_at,updated_at
  ) values (
    rep_value,week_value,comment_value,status_value,nullif(p->>'created_by',''),
    case when status_value='done' then coalesce(nullif(p->>'completed_at','')::timestamptz,now()) end,
    coalesce(nullif(p->>'updated_at','')::timestamptz,now())
  ) on conflict (rep_name,week_start) do update set
    comment=excluded.comment,
    status=excluded.status,
    created_by=coalesce(excluded.created_by,crm_rep_manager_comments.created_by),
    completed_at=excluded.completed_at,
    updated_at=excluded.updated_at
  returning id into row_id;

  return jsonb_build_object('ok',true,'id',row_id,'rep_name',rep_value,
    'week_start',week_value,'status',status_value);
end $$;

create or replace function public.crm_rep_manager_comments_json()
returns jsonb language sql security definer set search_path=public stable as $$
  select coalesce(jsonb_agg(to_jsonb(c) order by c.week_start desc,c.rep_name),'[]'::jsonb)
  from public.crm_rep_manager_comments c
  where c.week_start >= current_date - interval '90 days'
$$;

grant execute on function public.crm_rep_manager_comment_upsert(jsonb) to service_role;
grant execute on function public.crm_rep_manager_comments_json() to service_role;

-- n8n crm-write: rep_manager_comment → crm_rep_manager_comment_upsert(payload)
-- crm-api bundle: rep_manager_comments → crm_rep_manager_comments_json()
