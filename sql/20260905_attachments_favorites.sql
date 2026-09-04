-- CRM field files and user-specific quick sites.
-- Apply with the service-role migration account. Browsers never receive the
-- service key and upload file bytes only through a short-lived signed URL.
begin;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values (
  'crm-site-files','crm-site-files',false,20971520,
  array[
    'image/jpeg','image/png','image/webp','image/heic','image/heif',
    'application/pdf',
    'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create table if not exists public.crm_attachments (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.deals(id) on delete cascade,
  bucket text not null default 'crm-site-files',
  object_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null default 0 check (size_bytes between 0 and 20971520),
  category text not null check (category in ('현장사진','견적자료','도면','회의자료','계약관련','기타')),
  tags text[] not null default '{}',
  memo text,
  uploaded_by text,
  status text not null default 'pending' check (status in ('pending','ready','failed')),
  write_id text unique,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists crm_attachments_opportunity_created_idx
  on public.crm_attachments(opportunity_id,created_at desc);

create table if not exists public.crm_user_opportunity_state (
  user_key text not null,
  opportunity_id uuid not null references public.deals(id) on delete cascade,
  favorite boolean not null default false,
  last_viewed_at timestamptz,
  last_worked_at timestamptz,
  view_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_key,opportunity_id)
);
create index if not exists crm_user_state_recent_idx
  on public.crm_user_opportunity_state(user_key,last_viewed_at desc,last_worked_at desc);

alter table public.crm_attachments enable row level security;
alter table public.crm_user_opportunity_state enable row level security;
revoke all on public.crm_attachments,public.crm_user_opportunity_state from anon,authenticated;
grant select,insert,update on public.crm_attachments,public.crm_user_opportunity_state to service_role;

create or replace function public.crm_attachment_prepare_meta(p jsonb)
returns jsonb language plpgsql security definer set search_path=public,storage as $$
declare
  oid uuid;
  aid uuid;
  fname text;
  path_value text;
  category_value text;
  mime_value text;
begin
  oid := (p->>'opportunity_id')::uuid;
  aid := coalesce(nullif(p->>'attachment_id','')::uuid,gen_random_uuid());
  fname := trim(coalesce(p->>'file_name',''));
  category_value := coalesce(nullif(p->>'category',''),'기타');
  mime_value := coalesce(nullif(p->>'mime_type',''),'application/octet-stream');
  if fname='' then raise exception 'file_name is required'; end if;
  if coalesce((p->>'size_bytes')::bigint,0) > 20971520 then raise exception 'file too large'; end if;
  if category_value not in ('현장사진','견적자료','도면','회의자료','계약관련','기타') then
    raise exception 'invalid attachment category';
  end if;
  perform 1 from public.deals where id=oid;
  if not found then raise exception 'opportunity not found'; end if;
  path_value := coalesce(nullif(p->>'object_path',''),oid::text||'/'||aid::text||'/'||regexp_replace(fname,'[^[:alnum:]._-]+','_','g'));
  insert into public.crm_attachments(
    id,opportunity_id,bucket,object_path,file_name,mime_type,size_bytes,
    category,tags,memo,uploaded_by,status,write_id,created_at
  ) values (
    aid,oid,'crm-site-files',path_value,fname,mime_value,coalesce((p->>'size_bytes')::bigint,0),
    category_value,coalesce(array(select jsonb_array_elements_text(coalesce(p->'tags','[]'::jsonb))),'{}'),
    nullif(p->>'memo',''),nullif(p->>'uploaded_by',''),'pending',nullif(p->>'write_id',''),now()
  ) on conflict (write_id) do update set memo=excluded.memo
  returning id,object_path into aid,path_value;
  return jsonb_build_object('ok',true,'attachment_id',aid,'bucket','crm-site-files','object_path',path_value);
end $$;

create or replace function public.crm_attachment_complete(p jsonb)
returns jsonb language plpgsql security definer set search_path=public,storage as $$
declare a public.crm_attachments%rowtype;
begin
  select * into a from public.crm_attachments where id=(p->>'attachment_id')::uuid for update;
  if not found then raise exception 'attachment metadata not found'; end if;
  if not exists(select 1 from storage.objects o where o.bucket_id=a.bucket and o.name=a.object_path) then
    raise exception 'uploaded object not found';
  end if;
  update public.crm_attachments set status='ready',completed_at=now() where id=a.id returning * into a;
  return jsonb_build_object('ok',true,'attachment',jsonb_build_object(
    'id',a.id,'opportunity_id',a.opportunity_id,'object_path',a.object_path,
    'file_name',a.file_name,'mime_type',a.mime_type,'size_bytes',a.size_bytes,
    'category',a.category,'tags',a.tags,'memo',a.memo,'uploaded_by',a.uploaded_by,
    'status',a.status,'created_at',a.created_at
  ));
end $$;

create or replace function public.crm_attachment_mark_failed(p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare affected integer;
begin
  update public.crm_attachments set status='failed'
   where id=(p->>'attachment_id')::uuid and status='pending';
  get diagnostics affected=row_count;
  return jsonb_build_object('ok',affected>0,'updated',affected);
end $$;

create or replace function public.crm_deal_attachments(p_opportunity_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',a.id,'file_name',a.file_name,'mime_type',a.mime_type,'size_bytes',a.size_bytes,
    'category',a.category,'tags',a.tags,'memo',a.memo,'uploaded_by',a.uploaded_by,
    'status',a.status,'object_path',a.object_path,'created_at',a.created_at
  ) order by a.created_at desc),'[]'::jsonb)
  from public.crm_attachments a
  where a.opportunity_id=p_opportunity_id and a.status='ready';
$$;

create or replace function public.crm_favorite_set(p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare u text; oid uuid; fav boolean;
begin
  u := trim(coalesce(p->>'user_key',''));
  oid := (p->>'opportunity_id')::uuid;
  fav := coalesce((p->>'favorite')::boolean,false);
  if u='' then raise exception 'user_key is required'; end if;
  insert into public.crm_user_opportunity_state(user_key,opportunity_id,favorite,updated_at)
  values (u,oid,fav,now())
  on conflict (user_key,opportunity_id) do update set favorite=excluded.favorite,updated_at=now();
  return jsonb_build_object('ok',true,'opportunity_id',oid,'favorite',fav);
end $$;

create or replace function public.crm_opportunity_touch(p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare u text; oid uuid; kind_value text; at_value timestamptz;
begin
  u := trim(coalesce(p->>'user_key',''));
  oid := (p->>'opportunity_id')::uuid;
  kind_value := coalesce(nullif(p->>'touch_kind',''),'view');
  at_value := coalesce(nullif(p->>'touched_at','')::timestamptz,now());
  if u='' then raise exception 'user_key is required'; end if;
  if kind_value not in ('view','work') then raise exception 'invalid touch_kind'; end if;
  insert into public.crm_user_opportunity_state(
    user_key,opportunity_id,last_viewed_at,last_worked_at,view_count,updated_at
  ) values (
    u,oid,case when kind_value='view' then at_value end,
    case when kind_value='work' then at_value end,
    case when kind_value='view' then 1 else 0 end,now()
  ) on conflict (user_key,opportunity_id) do update set
    last_viewed_at=case when kind_value='view' then at_value else crm_user_opportunity_state.last_viewed_at end,
    last_worked_at=case when kind_value='work' then at_value else crm_user_opportunity_state.last_worked_at end,
    view_count=crm_user_opportunity_state.view_count+case when kind_value='view' then 1 else 0 end,
    updated_at=now();
  return jsonb_build_object('ok',true,'opportunity_id',oid,'touch_kind',kind_value,'touched_at',at_value);
end $$;

create or replace function public.crm_user_opportunity_states(p_user_key text)
returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'opportunity_id',s.opportunity_id,'favorite',s.favorite,
    'last_viewed_at',s.last_viewed_at,'last_worked_at',s.last_worked_at,
    'view_count',s.view_count
  ) order by greatest(s.last_viewed_at,s.last_worked_at) desc nulls last),'[]'::jsonb)
  from public.crm_user_opportunity_state s where s.user_key=p_user_key;
$$;

-- crm_bundle remains the canonical deal feed. Attachments are safe metadata;
-- signed download URLs must be created on demand by the authenticated workflow.
do $$
declare fn text;
begin
  select pg_get_functiondef('public.crm_bundle()'::regprocedure) into fn;
  if position('''attachments''' in fn)=0 then
    if position('''stageChecklist'', d.stage_checklist' in fn)=0 then
      raise exception 'crm_bundle stageChecklist anchor not found; apply sales execution migration first';
    end if;
    fn := replace(fn,
      '''stageChecklist'', d.stage_checklist',
      '''attachments'', public.crm_deal_attachments(d.id),
       ''stageChecklist'', d.stage_checklist'
    );
    execute fn;
  end if;
end $$;

grant execute on function public.crm_attachment_prepare_meta(jsonb) to service_role;
grant execute on function public.crm_attachment_complete(jsonb) to service_role;
grant execute on function public.crm_attachment_mark_failed(jsonb) to service_role;
grant execute on function public.crm_deal_attachments(uuid) to service_role;
grant execute on function public.crm_favorite_set(jsonb) to service_role;
grant execute on function public.crm_opportunity_touch(jsonb) to service_role;
grant execute on function public.crm_user_opportunity_states(text) to service_role;

commit;

select count(*) as ready_attachments from public.crm_attachments where status='ready';
select count(*) filter (where favorite) as favorites from public.crm_user_opportunity_state;
