create or replace function private.capture_technical_advisory_backup()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_payload jsonb := to_jsonb(new);
  v_key text;
begin
  v_key := 'advisory:' || new.advisory_id::text || ':' || md5(v_payload::text);

  insert into private.technical_advisory_ingest_backup(
    request_key, payload, advisory_id
  ) values (v_key, v_payload, new.advisory_id)
  on conflict (request_key) do update
    set last_seen_at = now(),
        attempts = private.technical_advisory_ingest_backup.attempts + 1,
        payload = excluded.payload;

  return new;
end;
$function$;

revoke all on function private.capture_technical_advisory_backup()
from public, anon, authenticated;
grant execute on function private.capture_technical_advisory_backup()
to service_role;

drop trigger if exists trg_advisory_deals_private_backup on public.advisory_deals;
create trigger trg_advisory_deals_private_backup
after insert or update on public.advisory_deals
for each row execute function private.capture_technical_advisory_backup();
