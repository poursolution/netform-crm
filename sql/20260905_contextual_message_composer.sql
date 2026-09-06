-- Deal 상세의 Contextual Message Composer가 사용하는 메시지 문맥·견적 참조 필드.
-- 브라우저는 crm-write의 message_log 분기만 호출하며 테이블에 직접 접근하지 않는다.
begin;

alter table public.crm_message_logs
  add column if not exists site_id text,
  add column if not exists message_context text not null default 'deal',
  add column if not exists quote_version_no integer,
  add column if not exists quote_attachment_id text,
  add column if not exists attachment_refs jsonb not null default '[]'::jsonb;

alter table public.crm_message_logs
  drop constraint if exists crm_message_logs_purpose_check;

alter table public.crm_message_logs
  add constraint crm_message_logs_purpose_check check (
    purpose is null or purpose in (
      '관계 유지','공사 일정 확인','견적 후속','자료 제공','재활성','대기 종료','확장 영업','명절 인사',
      '견적 발송 안내','견적 확인 요청','추가자료 안내','견적 수정 안내','가격·조건 확인','견적 후속 연락','일정 확인'
    )
  );

alter table public.crm_message_logs
  drop constraint if exists crm_message_logs_message_context_check;

alter table public.crm_message_logs
  add constraint crm_message_logs_message_context_check
  check (message_context in ('deal','campaign'));

alter table public.crm_message_logs
  drop constraint if exists crm_message_logs_quote_version_no_check;

alter table public.crm_message_logs
  add constraint crm_message_logs_quote_version_no_check
  check (quote_version_no is null or quote_version_no > 0);

create index if not exists crm_message_logs_site_created_idx
  on public.crm_message_logs(site_id,created_at desc)
  where site_id is not null;

create or replace function public.crm_message_log(p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare mid uuid; oid uuid; st text; ch text; kind text; refs jsonb;
begin
  oid := (p->>'opportunity_id')::uuid;
  st := coalesce(nullif(p->>'status',''),'cancelled');
  ch := p->>'channel';
  kind := coalesce(nullif(p->>'template_kind',''),'info');
  refs := coalesce(p->'attachment_refs','[]'::jsonb);

  if st not in ('sent','failed','cancelled') then raise exception 'invalid message status'; end if;
  if ch not in ('sms','kakao') then raise exception 'invalid message channel'; end if;
  if kind not in ('info','promo','mixed') then raise exception 'invalid template kind'; end if;
  if jsonb_typeof(refs) <> 'array' then raise exception 'attachment_refs must be a JSON array'; end if;

  insert into public.crm_message_logs (
    opportunity_id, site_id, person_key, channel, sender, recipient_phone,
    template_key, template_title, template_kind, template_grade, purpose, body, stage_code,
    message_context, quote_version_no, quote_attachment_id, attachment_refs,
    status, success, next_action_created, sent_at, failed_at, write_id
  ) values (
    oid, nullif(p->>'site_id',''), nullif(p->>'person_key',''), ch,
    nullif(p->>'sender',''), nullif(p->>'recipient_phone',''),
    nullif(p->>'template_key',''), nullif(p->>'template_title',''), kind,
    case when coalesce(nullif(p->>'template_grade',''),'suggested') in ('approved','suggested','custom')
      then coalesce(nullif(p->>'template_grade',''),'suggested') else 'suggested' end,
    nullif(p->>'purpose',''), coalesce(p->>'body',''), nullif(p->>'stage_code',''),
    case when coalesce(nullif(p->>'message_context',''),'deal') in ('deal','campaign')
      then coalesce(nullif(p->>'message_context',''),'deal') else 'deal' end,
    nullif(p->>'quote_version_no','')::integer,
    nullif(p->>'quote_attachment_id',''), refs,
    st, st='sent', coalesce((p->>'next_action_created')::boolean,false),
    case when st='sent' then coalesce(nullif(p->>'sent_at','')::timestamptz,now()) end,
    case when st='failed' then coalesce(nullif(p->>'failed_at','')::timestamptz,now()) end,
    nullif(p->>'write_id','')
  )
  on conflict (write_id) do update set
    status=excluded.status,
    success=excluded.success,
    sent_at=excluded.sent_at,
    failed_at=excluded.failed_at
  returning id into mid;

  if st='sent' then
    update public.deals
       set last_outbound_at=coalesce(nullif(p->>'sent_at','')::timestamptz,now()),
           outbound_attempts=coalesce(outbound_attempts,0)+1,
           updated_at=now()
     where id=oid;
  end if;

  return jsonb_build_object(
    'ok',true,
    'message_id',mid,
    'status',st,
    'message_context',coalesce(nullif(p->>'message_context',''),'deal'),
    'quote_version_no',nullif(p->>'quote_version_no','')::integer
  );
end $$;

grant execute on function public.crm_message_log(jsonb) to service_role;

commit;

