-- B5: one acknowledged transaction for reassignment, audit and handover.
-- Prerequisites: work-request-handover-20261007.sql, deal-owner and approval v1.
begin;
create table if not exists crm_security.deal_reassignment_receipts(
 actor_id uuid not null, request_id uuid not null, payload jsonb not null,
 ack jsonb not null, created_at timestamptz not null default now(),
 primary key(actor_id,request_id)
);
alter table crm_security.deal_reassignment_receipts enable row level security;
revoke all on crm_security.deal_reassignment_receipts from public,anon,authenticated;
create or replace function public.crm_deal_reassign_handover_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 a record; d public.deals%rowtype; u public.users%rowtype;
 rid uuid; did uuid; old_receipt crm_security.deal_reassignment_receipts%rowtype;
 owner_result jsonb; request_result jsonb; approval_result jsonb; ack jsonb;
 v_from text; v_to text; v_reason text; v_attr text; v_keep text;
 v_at timestamptz:=clock_timestamp(); aid uuid; cancelled jsonb; transferred jsonb;
begin
 select * into a from crm_security.actor();
 if not found or a.permission_role<>'admin' then raise exception '담당 변경은 관리자만 할 수 있습니다' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 begin rid:=(p->>'request_id')::uuid; did:=(p->>'deal_id')::uuid;
 exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 v_from:=btrim(coalesce(p->>'from','')); v_to:=btrim(coalesce(p->>'to',''));
 v_reason:=btrim(coalesce(p->>'reason','')); v_attr:=coalesce(p->>'attribution','keep');
 if rid is null or did is null or length(v_to) not between 1 and 40 or length(v_reason) not between 1 and 300
   or length(coalesce(p->>'memo',''))>600 or v_attr not in ('keep','request') then raise exception '담당자·사유·인계 메모를 확인해 주세요' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(a.user_id::text||rid::text,0));
 select * into old_receipt from crm_security.deal_reassignment_receipts where actor_id=a.user_id and request_id=rid;
 if found then
  if old_receipt.payload is distinct from p then raise exception '다른 변경 내용에 같은 요청 번호를 사용할 수 없습니다' using errcode='22023'; end if;
  return old_receipt.ack;
 end if;
 select * into d from public.deals where id=did for update;
 if not found or not crm_security.can_deal(did,true) then raise exception '영업건에 접근할 수 없습니다' using errcode='42501'; end if;
 if coalesce(nullif(btrim(d.assignee_name),''),'미배정') is distinct from coalesce(nullif(v_from,''),'미배정') then
  raise exception '담당자가 이미 변경되었습니다. 새로고침 후 확인해 주세요' using errcode='40001';
 end if;
 select * into u from public.users where active and btrim(name)=v_to;
 if not found or (select count(*) from public.users where active and btrim(name)=v_to)<>1 then
  raise exception '활성 담당자 계정을 확인해 주세요' using errcode='22023';
 end if;
 if d.owner_id=u.user_id then raise exception '현재 담당자와 같습니다' using errcode='22023'; end if;
 select o.performance_owner into v_keep from public.crm_deal_owners o where o.deal_id=did::text;
 -- Existing attribution stays frozen; never infer historical attribution for an ownerless import.
 if v_keep is not null or exists(select 1 from public.users x where x.user_id=d.owner_id) then
  if v_keep is null then select x.name into v_keep from public.users x where x.user_id=d.owner_id; end if;
  owner_result:=public.crm_deal_owner_reassign_v1(jsonb_build_object('deal_id',did,'from',coalesce(nullif(v_from,''),'미배정'),
     'to',v_to,'reason',v_reason,'attribution',v_attr,'keep_owner',v_keep));
 else
  insert into public.crm_deal_owner_events(deal_id,action,from_owner,to_owner,reason,attribution,before,after,actor,actor_name,at)
   values(did::text,'reassign',null,v_to,v_reason,v_attr,null,null,a.user_id,a.display_name,v_at);
 end if;
 update public.deals set owner_id=u.user_id,assignee_name=u.name,assignee_email=u.email,
  version=coalesce(version,0)+1,updated_at=v_at where id=did;
 -- Transfer only open tasks explicitly assigned to the verified former owner.
 -- Independent/unassigned tasks, deadlines, completion and source evidence stay intact.
 with prior as materialized (
  select n.id,n.assignee_name from public.next_actions n
  where n.deal_id=did and n.status='open'
    and nullif(btrim(n.assignee_name),'')=nullif(btrim(d.assignee_name),'')
    and exists(select 1 from public.users x where x.user_id=d.owner_id and btrim(x.name)=btrim(d.assignee_name))
    and (select count(*) from public.users x where btrim(x.name)=btrim(d.assignee_name))=1
  order by n.id for update
 ), changed as (
  update public.next_actions n set assignee_name=u.name,updated_at=v_at
  from prior t where n.id=t.id
  returning n.id,t.assignee_name as previous_assignee,n.assignee_name
 ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'from',previous_assignee,'to',assignee_name) order by id),'[]'::jsonb)
   into transferred from changed;
 -- Keep superseded handovers in history, but stop asking the previous recipient to accept them.
 perform pg_advisory_xact_lock(hashtextextended('handover:'||did::text,0));
 with changed as (
  update crm_security.work_requests set status='cancelled',result='다시 재배정됨',closed_at=v_at,updated_at=v_at
  where target_type='deal' and target_id=did::text and (kind='handover' or (kind='support' and label='재배정 인계'))
    and status in ('sent','seen','working') returning id
 ) select coalesce(jsonb_agg(id),'[]'::jsonb) into cancelled from changed;
 if u.user_id<>a.user_id then
  request_result:=public.crm_work_request_handover_v1(jsonb_build_object('target_type','deal','target_id',did,
   'site',coalesce(d.list_name,''),'brand',coalesce(d.brand,''),'to_scope','user','to_name',u.name,
   'asks',jsonb_build_array('인계 메모 확인','남은 할 일 확인','인수 확인'),
   'due_at',((v_at at time zone 'Asia/Seoul')::date+3+time '23:59') at time zone 'Asia/Seoul','due_label','3일 안',
   'memo',coalesce(nullif(v_from,''),'미배정')||' → '||u.name||' · '||a.display_name||' 재배정 · '||v_reason||E'\n이전 담당: '||coalesce(nullif(v_from,''),'미배정')||
     E'\n인계 메모: '||coalesce(nullif(p->>'memo',''),'없음')));
 end if;
 if v_attr='request' then
  if v_keep is null then raise exception '기존 실적 귀속을 확인한 뒤 귀속 변경을 요청해 주세요' using errcode='22023'; end if;
  approval_result:=public.crm_approval_request_v1(jsonb_build_object('type','owner_change','deal_id',did,
   'title',left(coalesce(d.list_name,'')||' '||v_keep||' → '||u.name,120),'reason',v_reason,
   'payload',jsonb_build_object('from_owner',v_keep,'to_owner',u.name)));
 end if;
 insert into public.activities(deal_id,organization_id,actor_name,type,detail,occurred_at)
 values(did,d.organization_id,a.display_name,'담당자변경',jsonb_build_object('note',coalesce(nullif(v_from,''),'미배정')||' → '||u.name,
  'result',v_reason,'from_owner_id',d.owner_id,'to_owner_id',u.user_id,'request_id',rid,'cancelled_handovers',cancelled,
  'transferred_next_actions',transferred),v_at) returning id into aid;
 ack:=jsonb_build_object('ok',true,'deal_id',did,'owner_id',u.user_id,'assignee',u.name,'version',coalesce(d.version,0)+1,
   'owner',owner_result->'owner','request',request_result->'request','approval',approval_result->'request','activity_id',aid,'server_at',v_at,
   'transferred_next_actions',transferred);
 insert into crm_security.deal_reassignment_receipts values(a.user_id,rid,p,ack,v_at);
 return ack;
end $fn$;
revoke all on function public.crm_deal_reassign_handover_v1(jsonb) from public,anon;
grant execute on function public.crm_deal_reassign_handover_v1(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
