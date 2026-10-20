-- 영업건 요청 항목별 처리 v1 (2026-10-20 대표 "이거 클로드가 해" · design_handoff_mobile_all 모바일 v5 '확인할 것 · 요청에서')
-- 영업건(deal)에 걸린 첫 연락 · 후속 연락 요청을 '이번 응대 기록'을 근거로 항목별로 처리한다.
--   · 부재 · 번호 오류 = 요청은 진행 중(working) · reply_note '연락 시도 n회 · 미연결' — 보낸 사람 화면에 '시도 n · 미연결'
--   · 연결됨 · 회신 받음 + 확인 항목 일부 = 진행 중 · reply_note '일부 처리 k/m · 확인: … · 남음: …'
--   · 연결됨 · 회신 받음 + 확인 항목 전부(첫 연락 자체는 연결로 충족) + 다음 행동 · 날짜 = 완료(done)
-- 근거: 받는 담당자 본인이 이 영업건에 이틀 안에 남긴 응대 기록(public.activities) — 연결 여부(meaningful_contact)가 결과와 맞아야 한다.
-- 같은 operation_id 는 한 번만 처리(되풀이 = 처음 응답). 기록은 crm_security.work_request_objective_events 에 덧붙인다(문의 쪽과 같은 표).
-- 새 표 없음 · 다시 실행해도 안전. 운영 적용은 대표 Run.
begin;
create or replace function public.crm_work_request_deal_contact_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 a record; r crm_security.work_requests%rowtype; saved crm_security.work_request_objective_events%rowtype; act record;
 rid uuid; oid uuid; aid uuid; did uuid; v_email text; v_result text; v_attempt boolean; v_req jsonb; v_conf jsonb; v_left jsonb;
 nt text; nd date; rev integer; tries integer; complete boolean; note text; ack jsonb;
 at_time timestamptz:=clock_timestamp(); today date:=(clock_timestamp() at time zone 'Asia/Seoul')::date;
begin
 select * into a from crm_security.actor();
 if not found or a.permission_role not in ('admin','rep','branch','consultation') then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' or p-array['id','operation_id','activity_id','result','confirmed','next_text','next_due']<>'{}'::jsonb
  or jsonb_typeof(p->'confirmed') is distinct from 'array' then raise exception 'invalid payload' using errcode='22023'; end if;
 begin rid:=(p->>'id')::uuid; oid:=(p->>'operation_id')::uuid; aid:=(p->>'activity_id')::uuid; nd:=nullif(p->>'next_due','')::date;
 exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 if rid is null or oid is null or aid is null then raise exception 'invalid payload' using errcode='22023'; end if;
 v_result:=coalesce(p->>'result','');nt:=nullif(btrim(coalesce(p->>'next_text','')),'');v_conf:=p->'confirmed';
 if v_result not in ('연결됨','회신 받음','부재','번호 오류') or length(coalesce(nt,''))>200 then raise exception 'invalid payload' using errcode='22023'; end if;
 v_attempt:=v_result in ('부재','번호 오류');
 perform pg_advisory_xact_lock(hashtextextended('work-deal-contact:'||a.auth_uid::text||oid::text,0));
 select * into saved from crm_security.work_request_objective_events where actor_auth_uid=a.auth_uid and operation_id=oid;
 if found then
  if saved.payload is distinct from p then raise exception 'REQUEST_ID_REUSE' using errcode='22023'; end if;
  return saved.ack||jsonb_build_object('replayed',true);
 end if;
 select * into r from crm_security.work_requests where id=rid for update;
 if not found or r.target_type<>'deal' or r.to_scope<>'user' or r.to_user_id is distinct from a.user_id then
  raise exception '받는 담당자만 처리할 수 있습니다' using errcode='42501'; end if;
 if r.status not in ('sent','seen','working') then raise exception 'REQUEST_CLOSED: 이미 끝난 요청입니다' using errcode='22023'; end if;
 if r.kind not in ('first','follow') or jsonb_typeof(r.asks) is distinct from 'array' then
  raise exception 'REQUEST_UNSUPPORTED: 연락으로 처리하는 요청이 아닙니다 · PC 에서 확인해 주세요' using errcode='22023'; end if;
 begin did:=r.target_id::uuid; exception when others then raise exception 'invalid target' using errcode='22023'; end;
 if not crm_security.can_deal(did,true) then raise exception 'forbidden' using errcode='42501'; end if;
 select u.email into v_email from public.users u where u.user_id=a.user_id;
 select x.id,x.deal_id,x.actor_name,x.actor_email,x.occurred_at,x.detail into act from public.activities x where x.id=aid;
 if not found or act.deal_id is distinct from did or (act.actor_name is distinct from a.display_name and (v_email is null or act.actor_email is null or act.actor_email is distinct from v_email))
  or act.occurred_at<at_time-interval '2 days' or coalesce((act.detail->>'meaningful_contact')::boolean,false) is distinct from (not v_attempt) then
  raise exception 'REQUEST_CONTACT_PROOF_REQUIRED: 이 영업건의 응대 기록을 먼저 확인해 주세요' using errcode='22023'; end if;
 -- 확인 항목 = 요청 항목 중 '고객 첫 연락'(연결로 충족)을 뺀 것
 select coalesce(jsonb_agg(x order by o),'[]'::jsonb) into v_req from jsonb_array_elements_text(r.asks) with ordinality t(x,o) where btrim(x)<>'고객 첫 연락';
 if v_attempt and jsonb_array_length(v_conf)>0 then raise exception 'invalid confirmed' using errcode='22023'; end if;
 if exists(select 1 from jsonb_array_elements(v_conf) c where jsonb_typeof(c)<>'string' or not(v_req ? (c#>>'{}')))
  or (select count(distinct c) from jsonb_array_elements_text(v_conf) c)<>jsonb_array_length(v_conf) then raise exception 'invalid confirmed' using errcode='22023'; end if;
 select coalesce(jsonb_agg(x order by o),'[]'::jsonb) into v_left from jsonb_array_elements_text(v_req) with ordinality t(x,o) where not(v_conf ? x);
 if nd is not null and (nd<today or nd>today+366) then raise exception 'invalid next_due' using errcode='22023'; end if;
 complete:=not v_attempt and jsonb_array_length(v_left)=0 and nt is not null and nd is not null;
 select count(*) into tries from crm_security.work_request_objective_events e where e.request_id=rid and e.ack->>'kind'='deal-contact' and e.ack->>'attempt'='true';
 note:=case
  when v_attempt then '연락 시도 '||(tries+1)||'회 · 미연결 ('||v_result||')'
  when complete then '확인 완료'||case when jsonb_array_length(v_req)>0 then ' · '||(select string_agg(x,' · ') from jsonb_array_elements_text(v_req) x) else '' end
  when jsonb_array_length(v_left)=0 then '연결 · 다음 행동 · 날짜 필요'
  else '일부 처리 '||jsonb_array_length(v_conf)||'/'||jsonb_array_length(v_req)||' · 확인: '||coalesce((select string_agg(x,' · ') from jsonb_array_elements_text(v_conf) x),'없음')
   ||' · 남음: '||(select string_agg(x,' · ') from jsonb_array_elements_text(v_left) x) end;
 update crm_security.work_requests w set
  status=case when complete then 'done' else 'working' end,
  result=case when v_attempt then w.result else v_result end,
  next_text=case when v_attempt then w.next_text else coalesce(nt,w.next_text) end,
  next_due=case when v_attempt then w.next_due else coalesce(nd,w.next_due) end,
  reply_note=note,auto_done=false,seen_at=coalesce(w.seen_at,at_time),
  closed_at=case when complete then at_time else null end,
  replied_by_user_id=a.user_id,replied_by_name=a.display_name,updated_at=at_time
  where w.id=rid returning * into r;
 select coalesce(max(e.revision),0)+1 into rev from crm_security.work_request_objective_events e where e.request_id=rid;
 ack:=jsonb_build_object('ok',true,'contract_version',1,'kind','deal-contact','operation_id',oid,'request_id',rid,'revision',rev,
  'attempt',v_attempt,'result',v_result,'requested_asks',v_req,'confirmed',v_conf,'remaining',v_left,'request_complete',complete,'activity_id',aid,
  'request',crm_security.work_request_json(r,a.user_id,a.permission_role),'server_at',at_time);
 insert into crm_security.work_request_objective_events(request_id,revision,actor_auth_uid,actor_user_id,operation_id,payload,ack)
 values(rid,rev,a.auth_uid,a.user_id,oid,p,ack);
 return ack;
end $fn$;
revoke all on function public.crm_work_request_deal_contact_v1(jsonb) from public,anon,service_role;
grant execute on function public.crm_work_request_deal_contact_v1(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
