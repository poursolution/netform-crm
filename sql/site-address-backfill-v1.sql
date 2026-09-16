-- One-time, idempotent canonical Site address recovery from unambiguous linked inquiries.
-- Conflicting, short, non-address-like and already populated Sites are excluded.
create table if not exists crm_security.site_address_backfill_events (
 site_id uuid primary key references public.sites(site_id) on delete restrict,
 previous_address text,
 recovered_address text not null,
 supporting_record_count integer not null check(supporting_record_count>0),
 method text not null default 'single_normalized_inquiry_address_v1',
 recovered_at timestamptz not null default statement_timestamp()
);
alter table crm_security.site_address_backfill_events enable row level security;
revoke all on table crm_security.site_address_backfill_events from public,anon,authenticated;

with address_variants as (
 select q.site_id,pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(q.address),'\s+',' ','g')) normalized_address,
  min(pg_catalog.btrim(q.address)) display_address,count(*)::integer supporting_record_count
 from public.inquiries q
 where q.site_id is not null and nullif(pg_catalog.btrim(q.address),'') is not null
 group by q.site_id,pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(q.address),'\s+',' ','g'))
), single_address as (
 select site_id,min(display_address) recovered_address,sum(supporting_record_count)::integer supporting_record_count
 from address_variants group by site_id having count(*)=1
), eligible as (
 select s.site_id,s.address previous_address,a.recovered_address,a.supporting_record_count
 from public.sites s join single_address a on a.site_id=s.site_id
 where nullif(pg_catalog.btrim(s.address),'') is null
  and pg_catalog.length(pg_catalog.regexp_replace(a.recovered_address,'[^0-9a-zA-Z가-힣]','','g'))>=5
  and a.recovered_address ~ '[0-9]'
  and a.recovered_address ~ '(시|도|군|구|읍|면|동|로|길)'
)
insert into crm_security.site_address_backfill_events(site_id,previous_address,recovered_address,supporting_record_count)
select site_id,previous_address,recovered_address,supporting_record_count from eligible
on conflict(site_id) do nothing;

update public.sites s set address=e.recovered_address
from crm_security.site_address_backfill_events e
where s.site_id=e.site_id and nullif(pg_catalog.btrim(s.address),'') is null;
