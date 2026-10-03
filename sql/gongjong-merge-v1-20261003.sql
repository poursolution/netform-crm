-- 공종 분석 전용 병합. 운영 설치 전 검토용 SQL.
-- 원본 Deal/계약실적은 삭제/이동하지 않는다. 원본 견적들을 기존 Deal의
-- 견적 Version으로 보존하고 공종 분석에서만 source를 중복 집계하지 않는다.
-- 기존 공종 권한/버전 함수 재사용. 타 메뉴/공통 read/write dispatcher 변경 없음.
begin;
create table if not exists crm_security.gongjong_merges (
 source_id uuid primary key references public.deals(id),
 target_id uuid not null references public.deals(id),
 actor_user_id uuid not null,
 request_id uuid not null unique,
 payload jsonb not null,
 source_snapshot jsonb not null,
 quote_snapshots jsonb not null,
 ack jsonb not null,
 created_at timestamptz not null default now(),
 check(source_id<>target_id)
);
create index if not exists gongjong_merges_target_idx on crm_security.gongjong_merges(target_id);
alter table crm_security.gongjong_merges enable row level security;
revoke all on crm_security.gongjong_merges from public,anon,authenticated;

create or replace function public.crm_gongjong_links_v1(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare actor record;
begin
 if auth.uid() is null then raise exception 'forbidden' using errcode='42501'; end if;
 select * into actor from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 return jsonb_build_object('ok',true,'links',coalesce((select jsonb_agg(m.ack order by m.created_at)
  from crm_security.gongjong_merges m
  where crm_security.can_deal(m.source_id,false) and crm_security.can_deal(m.target_id,false)),'[]'::jsonb));
end $fn$;
revoke all on function public.crm_gongjong_links_v1(jsonb) from public,anon;
grant execute on function public.crm_gongjong_links_v1(jsonb) to authenticated;

create or replace function public.crm_gongjong_merge_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare actor record; src public.deals%rowtype; dst public.deals%rowtype;
 sid uuid; tid uuid; rid uuid; saved crm_security.gongjong_merges%rowtype;
 snapshots jsonb; snap jsonb; v integer; qid uuid; result jsonb; total integer:=0;
 amount_value numeric; items jsonb; source_site text; target_site text;
begin
 if auth.uid() is null then raise exception 'forbidden' using errcode='42501'; end if;
 perform 1 from public.users u where u.auth_uid=auth.uid() for share;
 perform 1 from crm_security.access_review r where r.reviewed_auth_uid=auth.uid() for share;
 select * into actor from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' or not(p ?& array['source_id','target_id','request_id','source_version','target_version','work_items','primary_work'])
 or exists(select 1 from jsonb_object_keys(p) k where k not in ('source_id','target_id','request_id','source_version','target_version','work_items','primary_work')) then
  raise exception 'invalid payload' using errcode='22023';
 end if;
 sid:=(p->>'source_id')::uuid;tid:=(p->>'target_id')::uuid;rid:=(p->>'request_id')::uuid;items:=p->'work_items';
 if sid is null or tid is null or sid=tid or rid is null then raise exception 'invalid pair' using errcode='22023'; end if;
 perform 1 from crm_security.object_scope s where s.user_id=actor.user_id and s.deal_id in (sid,tid) order by s.deal_id for share;
 -- Common ordering with other deal writers avoids pair inversions/deadlocks.
 perform 1 from public.deals d where d.id in(sid,tid) order by d.id for update;
 if not crm_security.can_deal(sid,true) or not crm_security.can_deal(tid,true) then raise exception 'forbidden' using errcode='42501'; end if;
 select * into src from public.deals where id=sid;
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 select * into dst from public.deals where id=tid;
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if actor.permission_role='rep' and (src.owner_id is distinct from actor.user_id or dst.owner_id is distinct from actor.user_id) then raise exception 'forbidden' using errcode='42501'; end if;
 select * into saved from crm_security.gongjong_merges where request_id=rid;
 if found then
  if saved.actor_user_id<>actor.user_id or saved.payload<>p then raise exception 'REQUEST_ID_REUSE' using errcode='PT409'; end if;
  return saved.ack;
 end if;
 if src.version is distinct from (p->>'source_version')::integer or dst.version is distinct from (p->>'target_version')::integer then raise exception '최신 기록이 바뀌었습니다. 다시 확인해주세요.' using errcode='PT409'; end if;
 if exists(select 1 from crm_security.gongjong_merges where source_id in(sid,tid) or target_id=sid) then raise exception '이미 합쳐진 영업건입니다. 목록을 새로 확인해주세요.' using errcode='PT409'; end if;
 source_site:=nullif(to_jsonb(src)->>'site_id','');target_site:=nullif(to_jsonb(dst)->>'site_id','');
 if source_site is null or target_site is distinct from source_site then raise exception '동일한 현장 ID 연결을 먼저 확인해주세요.' using errcode='22023'; end if;
 -- Partial composite-work overlap cannot discard the source's other works.
 if jsonb_typeof(items) is distinct from 'array' or jsonb_array_length(items)=0 or jsonb_typeof(dst.work_items) is distinct from 'array'
 or not(items <@ dst.work_items) then raise exception '기존 건에 없는 세부 공종이 있습니다. 합치기 대신 각각 확인해주세요.' using errcode='22023'; end if;
 -- Operational classification must never erase or combine recognized performance.
 if exists(select 1 from crm_security.contract_sales where deal_id in(sid,tid))
 or coalesce(to_jsonb(src)->>'contract_signed','false')='true' or coalesce(to_jsonb(dst)->>'contract_signed','false')='true'
 or nullif(to_jsonb(src)->>'contract_date','') is not null or nullif(to_jsonb(dst)->>'contract_date','') is not null then
  raise exception '계약 기록이 있는 건은 합치지 않습니다. 계약실적을 별도로 검토해주세요.' using errcode='22023';
 end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.version_no),'[]'::jsonb) into snapshots from public.crm_quote_versions q where q.opportunity_id=sid;
 -- Snapshot current quotation even when no version row exists yet.
 amount_value:=coalesce(nullif(to_jsonb(src)->>'quote_amount','')::numeric,0);
 if amount_value<=0 then amount_value:=coalesce(nullif(to_jsonb(src)->>'amount','')::numeric,0);end if;
 if jsonb_array_length(snapshots)=0 then
  if amount_value<=0 then raise exception '금액 확인 후 견적 버전으로 합쳐주세요.' using errcode='22023'; end if;
  snapshots:=jsonb_build_array(jsonb_build_object('amount',amount_value,'reason','영업기회 현재 견적','created_at',now()));
 elsif amount_value>0 and (snapshots->-1->>'amount')::numeric<>amount_value then
  snapshots:=snapshots||jsonb_build_array(jsonb_build_object('amount',amount_value,'reason','영업기회 현재 견적','created_at',now()));
 end if;
 -- Existing scoped function checks work payload and writes the original audit trail.
 perform public.crm_work_set_scoped_v2(sid,p->>'primary_work',items,'공종 분석: 같은 공사 확인 후 견적 버전으로 합침',src.version,null);
 select coalesce(max(q.version_no),0) into v from public.crm_quote_versions q where q.opportunity_id=tid;
 for snap in select value from jsonb_array_elements(snapshots) loop
  v:=v+1;total:=total+1;
  insert into public.crm_quote_versions(opportunity_id,version_no,amount,reason,created_by,created_at,write_id)
  values(tid,v,(snap->>'amount')::numeric,'공종 분석 병합 · 원본 '||sid::text||' · '||coalesce(snap->>'reason','견적 보존'),actor.display_name,coalesce((snap->>'created_at')::timestamptz,now()),'gongjong:'||rid::text||':'||total::text)
  returning id into qid;
 end loop;
 -- Keep target amounts, attribution, stage, ledger and source originals intact.
 update public.deals set version=version+1 where id=tid;
 result:=jsonb_build_object('ok',true,'source_id',sid,'target_id',tid,'quote_version_id',qid,'quote_count',total,'request_id',rid,'source_version',src.version+1,'target_version',dst.version+1);
 insert into crm_security.gongjong_merges(source_id,target_id,actor_user_id,request_id,payload,source_snapshot,quote_snapshots,ack)
 values(sid,tid,actor.user_id,rid,p,to_jsonb(src),snapshots,result);
 return result;
end $fn$;
revoke all on function public.crm_gongjong_merge_v1(jsonb) from public,anon;
grant execute on function public.crm_gongjong_merge_v1(jsonb) to authenticated;
commit;
