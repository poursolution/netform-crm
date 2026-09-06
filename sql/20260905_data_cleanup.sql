-- Data cleanup: canonical Site membership, not destructive record merging.
-- Requires organizations/deals/inquiries/contacts and inquiry_control_center migration.
-- Browser uses authenticated RPC directly; no unimplemented crm-write route can ACK this.
begin;
create table if not exists public.crm_cleanup_sites (
 id uuid primary key default gen_random_uuid(), name text not null, created_at timestamptz not null default now()
);
create table if not exists public.crm_cleanup_links (
 entity_type text not null check(entity_type in ('organization','deal','inquiry','contact')),
 entity_id text not null, site_id uuid not null references public.crm_cleanup_sites(id),
 primary key(entity_type,entity_id)
);
create table if not exists public.crm_cleanup_reviews (
 id uuid primary key, pair_key text not null unique, action text not null,
 source jsonb not null, target jsonb not null, source_name text, target_name text,
 note text not null, actor text not null, created_at timestamptz not null default now(),
 snapshot jsonb not null, move_date date
);
-- Append-only audit: includes earlier defer/separate decisions if reviewed again.
create table if not exists public.crm_cleanup_audit (
 id bigint generated always as identity primary key, review jsonb not null, created_at timestamptz not null default now()
);
create table if not exists public.crm_cleanup_contact_moves (
 id uuid primary key, source jsonb not null, target jsonb not null,
 person_key text,
 from_site text not null,to_site text not null,moved_on date not null,
 confirmed_by text not null,note text not null,created_at timestamptz not null default now()
);
alter table public.crm_cleanup_contact_moves add column if not exists person_key text;
alter table public.crm_cleanup_sites enable row level security;
alter table public.crm_cleanup_links enable row level security;
alter table public.crm_cleanup_reviews enable row level security;
alter table public.crm_cleanup_audit enable row level security;
alter table public.crm_cleanup_contact_moves enable row level security;
revoke all on public.crm_cleanup_sites,public.crm_cleanup_links,public.crm_cleanup_reviews,
 public.crm_cleanup_audit,public.crm_cleanup_contact_moves from anon,authenticated;

create or replace function public.crm_cleanup_actor() returns text
language plpgsql security definer set search_path=pg_catalog,public as $$
declare n text;
begin
 if auth.uid() is null then raise exception '로그인이 필요합니다';end if;
 select u.name into n from public.users u
 where lower(u.email)=lower(auth.jwt()->>'email') and u.active
 and lower(u.role::text) in ('admin','owner','exec','executive','lead','manager','관리자','대표');
 if n is null then raise exception '데이터 정리는 관리자 권한이 필요합니다';end if;
 return n;
end $$;

create or replace function public.crm_cleanup_record(r jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare t text;v jsonb;
begin
 t=case r->>'type' when 'organization' then 'organizations' when 'deal' then 'deals'
 when 'inquiry' then 'inquiries' when 'contact' then 'contacts' else null end;
 if t is null or nullif(r->>'id','') is null then raise exception '유효한 원본 ID가 필요합니다';end if;
 execute format('select to_jsonb(x) from public.%I x where x.id::text=$1',t) into v using r->>'id';
 if v is null then raise exception '원본이 없거나 ID가 변경되었습니다. 새로고침하세요';end if;
 return v;
end $$;

-- Complete selected scope. Child histories stay attached to their existing IDs.
create or replace function public.crm_cleanup_name(r jsonb) returns text
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v jsonb;n text;
begin
 v=public.crm_cleanup_record(r);
 select o.name into n from public.organizations o where o.id::text=v->>'organization_id';
 return coalesce(nullif(v->>'site',''),nullif(v->>'site_name',''),nullif(v->>'apartment_name',''),
  nullif(v->>'current_site',''),n,nullif(v->>'name',''),'미기록');
end $$;

create or replace function public.crm_cleanup_scope(r jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v jsonb;items jsonb;more jsonb;s uuid;orgs text[];deals text[];t text;
begin
 v=public.crm_cleanup_record(r);
 items=jsonb_build_array(jsonb_build_object('type',r->>'type','id',r->>'id','data',v));
 select site_id into s from public.crm_cleanup_links where entity_type=r->>'type' and entity_id=r->>'id';
 if s is not null then
  select coalesce(jsonb_agg(jsonb_build_object('type',l.entity_type,'id',l.entity_id,
   'data',public.crm_cleanup_record(jsonb_build_object('type',l.entity_type,'id',l.entity_id)))),'[]')
  into more from public.crm_cleanup_links l where l.site_id=s;
  items=items||more;
 end if;
 select array_agg(distinct x->>'id') into orgs from jsonb_array_elements(items) x where x->>'type'='organization';
 if coalesce(cardinality(orgs),0)>0 then
  foreach t in array array['deals','inquiries','contacts'] loop
   execute format('select coalesce(jsonb_agg(jsonb_build_object(''type'',$2,''id'',x.id::text,''data'',to_jsonb(x))),''[]''::jsonb) from public.%I x where to_jsonb(x)->>''organization_id''=any($1)',t)
   into more using orgs,case t when 'deals' then 'deal' when 'inquiries' then 'inquiry' else 'contact' end;
   items=items||more;
  end loop;
 end if;
 select array_agg(distinct x->>'id') into deals from jsonb_array_elements(items) x where x->>'type'='deal';
 foreach t in array array['notes','crm_quote_versions','crm_attachments'] loop
  if to_regclass('public.'||t) is not null then
   execute format('select coalesce(jsonb_agg(jsonb_build_object(''type'',$3,''id'',x.id::text,''data'',to_jsonb(x))),''[]''::jsonb) from public.%I x where coalesce(to_jsonb(x)->>''opportunity_id'',to_jsonb(x)->>''deal_id'')=any($1) or to_jsonb(x)->>''organization_id''=any($2)',t)
   into more using deals,orgs,t;
   items=items||more;
  end if;
 end loop;
 select coalesce(jsonb_agg(x order by x->>'type',x->>'id'),'[]') into items
 from (select distinct value as x from jsonb_array_elements(items)) z;
 return items;
end $$;

create or replace function public.crm_cleanup_counts(items jsonb) returns jsonb
language sql stable set search_path=pg_catalog,public as $$
 select jsonb_object_agg(t,case when t in ('notes','crm_quote_versions','crm_attachments') and to_regclass('public.'||t) is null then null
 else (select count(distinct x->>'id') from jsonb_array_elements(items) x where x->>'type'=t) end)
 from unnest(array['organization','deal','inquiry','contact','notes','crm_quote_versions','crm_attachments']) t
$$;

create or replace function public.crm_cleanup_preview(p jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare a jsonb;b jsonb;items jsonb;links jsonb;sa jsonb;sb jsonb;decision jsonb;finger text;act text=p->>'action';pa text;pb text;
begin
 perform public.crm_cleanup_actor();
 pa=(p#>>'{source,type}')||':'||(p#>>'{source,id}');pb=(p#>>'{target,type}')||':'||(p#>>'{target,id}');
 if pa=pb then raise exception '서로 다른 두 원본을 선택하세요';end if;
 if p->>'pair_key' is distinct from least(pa,pb)||'|'||greatest(pa,pb) then raise exception '후보 식별값이 올바르지 않습니다';end if;
 if length(btrim(coalesce(p->>'note','')))<2 then raise exception '확인 사유를 입력하세요';end if;
 if act not in ('site_merge','site_link','deal_review','inquiry_merge','inquiry_activity','contact_move','separate','different_person','defer') then raise exception '지원하지 않는 처리';end if;
 sa=public.crm_cleanup_record(p->'source');sb=public.crm_cleanup_record(p->'target');
 if act in ('site_merge','site_link') and (p#>>'{source,type}'='contact' or p#>>'{target,type}'='contact') then raise exception '사람 중복으로 현장을 통합할 수 없습니다';end if;
 if act in ('inquiry_merge','inquiry_activity') then
  if p#>>'{source,type}'<>'inquiry' or p#>>'{target,type}'<>'inquiry' then raise exception '문의끼리만 연결할 수 있습니다';end if;
  if coalesce(sa->>'duplicate_resolution','') in ('merged','activity') or coalesce(sb->>'duplicate_resolution','') in ('merged','activity') then raise exception '이미 병합된 문의입니다';end if;
  if nullif(sa->>'deleted_at','') is not null or nullif(sb->>'deleted_at','') is not null then raise exception '휴지통 문의는 먼저 복원하세요';end if;
  if exists(select 1 from public.deals d where coalesce(to_jsonb(d)->>'origin_inquiry_id',to_jsonb(d)->>'inquiry_id')=p#>>'{source,id}')
   or coalesce(sa->>'opportunity_id',sa->>'deal_id',sa->>'converted_opportunity_id','')<>''
   or coalesce(sa->>'inquiry_status','') in ('영업전환','전환완료') then
   raise exception '영업기회에 연결된 문의입니다. 병합 대신 같은 현장 연결을 사용하세요';end if;
 end if;
 if act='deal_review' and (p#>>'{source,type}'<>'deal' or p#>>'{target,type}'<>'deal') then raise exception '영업기회끼리만 검토할 수 있습니다';end if;
 if act='contact_move' and (nullif(p->>'move_date','') is null or (p->>'move_date')::date>current_date) then raise exception '확인된 과거 또는 오늘 이동일이 필요합니다';end if;
 if act='contact_move' then
  pa=regexp_replace(coalesce(sa->>'manager_mobile',sa->>'mobile',sa#>>'{contact,managerMobile}',''),'\D','','g');
  pb=regexp_replace(coalesce(sb->>'manager_mobile',sb->>'mobile',sb#>>'{contact,managerMobile}',''),'\D','','g');
  if pa !~ '^01[0-9]{8,9}$' or pa<>pb then raise exception '서버의 관리소장 휴대전화가 일치하지 않습니다. 연락처를 먼저 확인하세요';end if;
 end if;
 a=public.crm_cleanup_scope(p->'source');b=public.crm_cleanup_scope(p->'target');
 select jsonb_agg(x order by x->>'type',x->>'id') into items from (select distinct value x from jsonb_array_elements(a||b)) z;
 select coalesce(jsonb_agg(to_jsonb(l) order by l.entity_type,l.entity_id),'[]') into links from public.crm_cleanup_links l
 where exists(select 1 from jsonb_array_elements(items) x where x->>'type'=l.entity_type and x->>'id'=l.entity_id);
 select to_jsonb(r)-'snapshot' into decision from public.crm_cleanup_reviews r where r.pair_key=p->>'pair_key';
 finger=md5(items::text||links::text||p::text||coalesce(decision,'{}'::jsonb)::text||public.crm_cleanup_name(p->'source')||public.crm_cleanup_name(p->'target'));
 return jsonb_build_object('ok',true,'request_id',gen_random_uuid(),'fingerprint',finger,
  'source_name',public.crm_cleanup_name(p->'source'),
  'target_name',public.crm_cleanup_name(p->'target'),
  'source_record',sa,'target_record',sb,
  'source_counts',public.crm_cleanup_counts(a),'target_counts',public.crm_cleanup_counts(b),'counts',public.crm_cleanup_counts(items),
  'summary',case when act in ('site_merge','site_link') then '정리 후 Site 1개 · 영업기회 각각 유지'
    when act in ('inquiry_merge','inquiry_activity') then '활성 문의 1개 · 두 원본과 상담·응대 이력 보존'
    when act='contact_move' then '현장 각각 유지 · 확인한 사람 이동 이력만 연결'
    when act='deal_review' then '영업기회 중복 검토 기록 · 금액·Stage·활동은 변경하지 않음'
    else '판단 이력만 기록 · 원본 변경 없음' end,
  'warning','금액은 합산 저장하지 않습니다. 첨부파일·견적Version·활동은 원래 ID에 보존되고 기준 Site에서 함께 조회합니다.');
end $$;

create or replace function public.crm_cleanup_apply(p jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor text;fresh jsonb;base jsonb=p-'fingerprint'-'request_id';items jsonb;x jsonb;sid uuid;oldsites uuid[];review jsonb;rid uuid=(p->>'request_id')::uuid;act text=p->>'action';
begin
 actor=public.crm_cleanup_actor();
 -- Serialize cleanup, and hold originals stable through snapshot comparison + write.
 perform pg_advisory_xact_lock(20260905,912);
 if exists(select 1 from public.crm_cleanup_audit where review->>'id'=rid::text) then return jsonb_build_object('ok',true,'id',rid);end if;
 lock table public.organizations,public.deals,public.inquiries,public.contacts in share row exclusive mode;
 fresh=public.crm_cleanup_preview(base);
 if fresh->>'fingerprint' is distinct from p->>'fingerprint' then raise exception '원본이 변경되었습니다. 다시 비교·미리보기하세요';end if;
 items=public.crm_cleanup_scope(p->'source')||public.crm_cleanup_scope(p->'target');
 if act in ('site_merge','site_link') then
  select site_id into sid from public.crm_cleanup_links where entity_type=p#>>'{target,type}' and entity_id=p#>>'{target,id}';
  if sid is null then insert into public.crm_cleanup_sites(name) values(fresh->>'target_name') returning id into sid;end if;
  select array_agg(distinct l.site_id) into oldsites from public.crm_cleanup_links l where exists(select 1 from jsonb_array_elements(items) e where e->>'type'=l.entity_type and e->>'id'=l.entity_id);
  update public.crm_cleanup_links set site_id=sid where site_id=any(oldsites);
  for x in select distinct value from jsonb_array_elements(items) loop
   -- Contact identities are not merged; only their original Site membership is linked.
   if x->>'type' in ('organization','deal','inquiry','contact') then
    insert into public.crm_cleanup_links(entity_type,entity_id,site_id) values(x->>'type',x->>'id',sid)
    on conflict(entity_type,entity_id) do update set site_id=excluded.site_id;
   end if;
  end loop;
 elsif act in ('inquiry_merge','inquiry_activity') then
  update public.inquiries set duplicate_of_inquiry_id=p#>>'{target,id}',duplicate_resolution=case act when 'inquiry_merge' then 'merged' else 'activity' end,duplicate_reviewed_at=now()
  where id::text=p#>>'{source,id}';
 elsif act='contact_move' then
  insert into public.crm_cleanup_contact_moves(id,source,target,person_key,from_site,to_site,moved_on,confirmed_by,note)
  values(rid,p->'source',p->'target','mobile:'||regexp_replace(coalesce(fresh#>>'{source_record,manager_mobile}',fresh#>>'{source_record,mobile}',fresh#>>'{source_record,contact,managerMobile}',''),'\D','','g'),fresh->>'source_name',fresh->>'target_name',(p->>'move_date')::date,actor,p->>'note');
 end if;
 insert into public.crm_cleanup_reviews(id,pair_key,action,source,target,source_name,target_name,note,actor,snapshot,move_date)
 values(rid,p->>'pair_key',act,p->'source',p->'target',fresh->>'source_name',fresh->>'target_name',p->>'note',actor,jsonb_build_object('items',items,'preview',fresh),nullif(p->>'move_date','')::date)
 on conflict(pair_key) do update set id=excluded.id,action=excluded.action,source=excluded.source,target=excluded.target,
 source_name=excluded.source_name,target_name=excluded.target_name,note=excluded.note,actor=excluded.actor,snapshot=excluded.snapshot,move_date=excluded.move_date,created_at=now()
 returning to_jsonb(crm_cleanup_reviews.*) into review;
 insert into public.crm_cleanup_audit(review) values(review);
 return jsonb_build_object('ok',true,'id',rid,'site_id',sid);
end $$;

create or replace function public.crm_cleanup_state() returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 perform public.crm_cleanup_actor();
 return jsonb_build_object('ok',true,
 'sites',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.crm_cleanup_sites s),
 'links',(select coalesce(jsonb_agg(to_jsonb(l)),'[]') from public.crm_cleanup_links l),
 'reviews',(select coalesce(jsonb_agg(to_jsonb(r)-'snapshot' order by created_at desc),'[]') from public.crm_cleanup_reviews r),
 'moves',(select coalesce(jsonb_agg(to_jsonb(m) order by moved_on),'[]') from public.crm_cleanup_contact_moves m));
end $$;
revoke all on function public.crm_cleanup_actor(),public.crm_cleanup_record(jsonb),public.crm_cleanup_name(jsonb),public.crm_cleanup_scope(jsonb),public.crm_cleanup_counts(jsonb),public.crm_cleanup_preview(jsonb),public.crm_cleanup_apply(jsonb),public.crm_cleanup_state() from public,anon,authenticated;
grant execute on function public.crm_cleanup_preview(jsonb),public.crm_cleanup_apply(jsonb),public.crm_cleanup_state() to authenticated;

-- crm-api must pass its existing authorized bundle through this projection.
-- Original organization/deal/inquiry IDs remain intact for all child histories.
create or replace function public.crm_cleanup_bundle(p_bundle jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare result jsonb=p_bundle;arr jsonb;archived jsonb='[]';r jsonb;k text;typ text;sid uuid;nm text;q jsonb;
begin
 foreach k in array array['deals','inquiries'] loop
  arr='[]';typ=case k when 'deals' then 'deal' else 'inquiry' end;
  for r in select value from jsonb_array_elements(coalesce(p_bundle->k,'[]')) loop
   sid=null;nm=null;
   select l.site_id,s.name into sid,nm from public.crm_cleanup_links l join public.crm_cleanup_sites s on s.id=l.site_id
   where (l.entity_type=typ and l.entity_id=r->>'id') or (l.entity_type='organization' and l.entity_id=r->>'organization_id')
   order by (l.entity_type=typ) desc limit 1;
   if sid is not null then r=r||jsonb_build_object('cleanup_site_id',sid,'cleanup_site_name',nm);end if;
   if k='inquiries' then
    select jsonb_build_object('duplicate_resolution',i.duplicate_resolution,'duplicate_of_inquiry_id',i.duplicate_of_inquiry_id) into q
    from public.inquiries i where i.id::text=r->>'id';
    r=r||coalesce(q,'{}');
    if r->>'duplicate_resolution' in ('merged','activity') then archived=archived||jsonb_build_array(r);continue;end if;
   end if;
   arr=arr||jsonb_build_array(r);
  end loop;
  result=jsonb_set(result,array[k],arr);
 end loop;
 return result||jsonb_build_object('inquiryCleanupArchived',archived,'cleanup_events',
  (select coalesce(jsonb_agg(to_jsonb(r)-'snapshot'),'[]') from public.crm_cleanup_reviews r),'cleanup_moves',
  (select coalesce(jsonb_agg(to_jsonb(m) order by moved_on),'[]') from public.crm_cleanup_contact_moves m));
end $$;
revoke all on function public.crm_cleanup_bundle(jsonb) from public,anon,authenticated;
grant execute on function public.crm_cleanup_bundle(jsonb) to service_role;
commit;
