-- B7: retain original memos; derive structured events in the same transaction.
begin;
create table if not exists crm_security.activity_context_events(
 activity_id uuid not null,deal_id uuid not null,kind text not null,
 value jsonb not null,occurred_at timestamptz,
 primary key(activity_id,kind),
 check(kind in ('wait','decision','block','block_clear','progress','defect','check'))
);
create index if not exists activity_context_by_deal on crm_security.activity_context_events(deal_id,occurred_at,activity_id);
alter table crm_security.activity_context_events enable row level security;
revoke all on crm_security.activity_context_events from public,anon,authenticated,service_role;

create or replace function crm_security.parse_activity_context(note text,at_value timestamptz)
returns table(kind text,value jsonb) language plpgsql immutable set search_path='' as $$
declare n text:=regexp_replace(coalesce(note,''),'\s*\[연결 [^\]]*\]','','g');
 m text[];p text[];day text:=coalesce(to_char(at_value at time zone 'Asia/Seoul','YYYY-MM-DD'),'');
 conf text[]:=array['확인됨','추정','미확인'];
begin
 m:=regexp_match(n,'대기 이유: ([^(\n]+?) \(([0-9]{4}-[0-9]{2}-[0-9]{2})까지\)');
 if m is not null then kind:='wait';value:=jsonb_build_object('reason',trim(m[1]),'until',m[2],'at',coalesce(to_char(at_value at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),''));return next;end if;
 m:=regexp_match(n,'^\[(결정 일정|막힌 곳 해제|막힌 곳|진척|하자|확인)\]\s*([^\n]*)$');
 if m is null then return;end if;
 select array_agg(trim(v) order by ord) into p from unnest(string_to_array(m[2],'|')) with ordinality x(v,ord);
 if m[1]='결정 일정' and coalesce(p[1],'')<>'' then
  kind:='decision';value:=jsonb_build_object('type',p[1],'date',coalesce(nullif(p[2],''),'미정'),'conf',case when p[3]=any(conf) then p[3] else '미확인' end,'src',coalesce(p[4],''),'at',day);return next;
 elsif m[1]='막힌 곳 해제' then kind:='block_clear';value:=jsonb_build_object('at',day);return next;
 elsif m[1]='막힌 곳' then
  kind:='block';value:=jsonb_build_object('who',case when p[1]=any(array['고객','내부 · 견적팀','내부 · 자료 부족']) then p[1] else '고객' end,'st',coalesce(p[2],''),'owner',coalesce(p[3],''),'due',coalesce(nullif(p[4],'없음'),''),'step',case when p[5]=any(array['요청','자료 확인','보완 요청','검토','발행']) then p[5] else '' end,'at',day);return next;
 elsif m[1]='진척' and coalesce(p[1],'')<>'' then
  kind:='progress';value:=jsonb_build_object('type',p[1],'date',coalesce(nullif(p[2],''),day),'at',day,'manual',true);return next;
 elsif m[1]='하자' and coalesce(p[1],'')<>'' then
  kind:='defect';value:=jsonb_build_object('text',p[1],'recv',regexp_replace(coalesce(p[2],''),'^접수\s*',''),'owner',regexp_replace(coalesce(p[3],''),'^담당\s*',''),'due',regexp_replace(coalesce(p[4],''),'^약속\s*',''),'state',case when p[5]~'해결$' and p[5]!~'미해결' then '해결' else '미해결' end,'at',day);return next;
 elsif m[1]='확인' and p[1]=any(array['주소','예상 금액','공사 예정','결정권자']) then
  kind:='check';value:=jsonb_build_object('key',p[1],'conf',case when p[2]=any(conf) then p[2] else '미확인' end,'src',coalesce(p[3],''),'date',coalesce(nullif(p[4],''),day));return next;
 end if;
end $$;
revoke all on function crm_security.parse_activity_context(text,timestamptz) from public,anon,authenticated,service_role;

create or replace function crm_security.index_activity_context()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 delete from crm_security.activity_context_events where activity_id=new.id;
 insert into crm_security.activity_context_events(activity_id,deal_id,kind,value,occurred_at)
 select new.id,new.deal_id,t.kind,t.value,new.occurred_at
 from crm_security.parse_activity_context(new.detail->>'note',new.occurred_at) t where new.deal_id is not null;
 return new;
end $$;
revoke all on function crm_security.index_activity_context() from public,anon,authenticated,service_role;
drop trigger if exists crm_index_activity_context on public.activities;
create trigger crm_index_activity_context after insert or update of detail,occurred_at,deal_id on public.activities
 for each row execute function crm_security.index_activity_context();
insert into crm_security.activity_context_events(activity_id,deal_id,kind,value,occurred_at)
 select a.id,a.deal_id,t.kind,t.value,a.occurred_at from public.activities a
 cross join lateral crm_security.parse_activity_context(a.detail->>'note',a.occurred_at) t
 where a.deal_id is not null on conflict(activity_id,kind) do update
 set deal_id=excluded.deal_id,value=excluded.value,occurred_at=excluded.occurred_at;

create or replace function public.crm_activity_context_v1(p jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare ids uuid[];d uuid;e record;ctx jsonb;decisions jsonb;defects jsonb;result jsonb:='{}';
begin
 if not exists(select 1 from crm_security.actor()) then raise exception 'forbidden' using errcode='42501';end if;
 if jsonb_typeof(p->'deal_ids') is distinct from 'array' or jsonb_array_length(p->'deal_ids')>200 then raise exception 'invalid payload' using errcode='22023';end if;
 begin select array_agg(distinct v::uuid) into ids from jsonb_array_elements_text(p->'deal_ids') x(v);
 exception when others then raise exception 'invalid identity' using errcode='22023';end;
 foreach d in array coalesce(ids,array[]::uuid[]) loop
  -- Inaccessible/missing IDs are omitted, never represented as an empty history.
  if not exists(select 1 from public.deals where id=d) or not crm_security.can_deal(d,false) then continue;end if;
  ctx:='{"dec":[],"blk":null,"blkAt":"","prg":[],"def":[],"chk":{},"wait":null}'::jsonb;decisions:='{}';defects:='{}';
  for e in select x.* from crm_security.activity_context_events x
   join public.activities a on a.id=x.activity_id and a.deal_id=x.deal_id
   where x.deal_id=d order by x.occurred_at nulls first,x.activity_id loop
   case e.kind
    when 'wait' then ctx:=jsonb_set(ctx,'{wait}',e.value);
    when 'decision' then decisions:=decisions||jsonb_build_object(e.value->>'type',e.value);
    when 'block' then ctx:=ctx||jsonb_build_object('blk',e.value,'blkAt',e.value->>'at');
    when 'block_clear' then ctx:=ctx||jsonb_build_object('blk',null,'blkAt',e.value->>'at');
    when 'progress' then ctx:=jsonb_set(ctx,'{prg}',(ctx->'prg')||jsonb_build_array(e.value));
    when 'defect' then defects:=defects||jsonb_build_object(e.value->>'text',e.value);
    when 'check' then ctx:=jsonb_set(ctx,array['chk',e.value->>'key'],e.value-'key');
    else null;
   end case;
  end loop;
  ctx:=ctx||jsonb_build_object('dec',(select coalesce(jsonb_agg(v order by v->>'date'),'[]'::jsonb) from jsonb_each(decisions) x(k,v)),
   'def',(select coalesce(jsonb_agg(v order by v->>'at',k),'[]'::jsonb) from jsonb_each(defects) x(k,v)));
  result:=result||jsonb_build_object(d::text,ctx);
 end loop;
 return jsonb_build_object('ok',true,'items',result);
end $$;
revoke all on function public.crm_activity_context_v1(jsonb) from public,anon;
grant execute on function public.crm_activity_context_v1(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
