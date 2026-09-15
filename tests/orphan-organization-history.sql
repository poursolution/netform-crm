-- Harness prepends BEGIN and API candidate SQL; all fixtures and DDL rolled back.
create temp table orphan_test_ids as select gen_random_uuid() admin_id,gen_random_uuid() admin_auth,gen_random_uuid() rep_id,gen_random_uuid() rep_auth,gen_random_uuid() org_id;
insert into public.users(user_id,name,role,auth_uid) select admin_id,'ORPHAN TEST ADMIN','admin',admin_auth from orphan_test_ids union all select rep_id,'ORPHAN TEST REP','rep',rep_auth from orphan_test_ids;
insert into crm_security.access_review(user_id,reviewed_auth_uid,source_role,permission_role,approved,reviewed_by,expires_at)
select u.user_id,u.auth_uid,u.role,u.role,true,'rollback-only orphan test',now()+interval '5 minutes' from public.users u cross join orphan_test_ids t where u.user_id in(t.admin_id,t.rep_id);
insert into public.organizations(id,name) select org_id,'ORPHAN TEST ORGANIZATION' from orphan_test_ids;
insert into public.notes(organization_id,body,posted_at) select org_id,'ORPHAN TEST '||i,'2023-01-01'::timestamptz+i*interval '1 day' from orphan_test_ids cross join generate_series(1,3) i;
select set_config('request.jwt.claim.sub',admin_auth::text,true),set_config('test.orphan_org',org_id::text,true) from orphan_test_ids;
select set_config('test.expected_org_ids',coalesce(jsonb_agg(o.id order by o.id),'[]'::jsonb)::text,true)
from public.organizations o where not exists(select 1 from public.deals d where d.organization_id=o.id)
and exists(select 1 from public.notes n where n.organization_id=o.id and crm_security.can_read_legacy_note(n.deal_id,n.organization_id));
set local role authenticated;
do $$ declare page jsonb;cursor_id uuid;ids jsonb:='[]';sorted_ids jsonb;iterations integer:=0;begin
 loop
  page:=public.crm_orphan_organization_history(null,cursor_id,2);
  iterations:=iterations+1;
  if iterations>1000 then raise exception 'list pagination loop';end if;
  if jsonb_array_length(page->'items')>2 then raise exception 'list limit exceeded';end if;
  ids:=ids||coalesce((select jsonb_agg(x->'id') from jsonb_array_elements(page->'items') x),'[]');
  exit when not (page->>'has_more')::boolean;
  if (page->>'next_cursor') is null or (cursor_id is not null and (page->>'next_cursor')::uuid<=cursor_id) then raise exception 'list cursor invalid';end if;
  cursor_id:=(page->>'next_cursor')::uuid;
 end loop;
 select coalesce(jsonb_agg(x order by x),'[]') into sorted_ids from jsonb_array_elements(ids) x;
 if sorted_ids<>current_setting('test.expected_org_ids')::jsonb then raise exception 'list missing or duplicate organizations';end if;
 if not (ids @> jsonb_build_array(current_setting('test.orphan_org'))) then raise exception 'fixture absent from list';end if;
end $$;
do $$ declare a jsonb;b jsonb;c jsonb; begin
 a:=public.crm_orphan_organization_history(current_setting('test.orphan_org')::uuid,null,2);
 if jsonb_array_length(a->'items')<>2 or not (a->>'has_more')::boolean then raise exception 'first page failed';end if;
 b:=public.crm_orphan_organization_history(current_setting('test.orphan_org')::uuid,(a->>'next_cursor')::uuid,2);
 if jsonb_array_length(b->'items')<>1 or (b->>'has_more')::boolean then raise exception 'second page failed';end if;
 if exists(select 1 from jsonb_array_elements(a->'items') x join jsonb_array_elements(b->'items') y on x->>'id'=y->>'id') then raise exception 'duplicate pages';end if;
 c:=public.crm_orphan_organization_history(current_setting('test.orphan_org')::uuid,null,0);
 if jsonb_array_length(c->'items')<>1 then raise exception 'limit clamp failed';end if;
 if a->'items'->0->>'occurred_at' not like '2023-%' then raise exception 'original date lost';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',rep_auth::text,true) from orphan_test_ids;
set local role authenticated;
do $$ begin
 begin perform public.crm_orphan_organization_history();raise exception 'rep leak';exception when insufficient_privilege then null;end;
 begin perform public.crm_orphan_organization_history(current_setting('test.orphan_org')::uuid);raise exception 'rep detail leak';exception when insufficient_privilege then null;end;
end $$;
reset role;
update crm_security.access_review set permission_role='branch' where user_id=(select rep_id from orphan_test_ids);
do $$ begin if not exists(select 1 from crm_security.actor() where permission_role='branch') then raise exception 'branch fixture invalid';end if;end $$;
set local role authenticated;
do $$ begin
 begin perform public.crm_orphan_organization_history();raise exception 'branch list leak';exception when insufficient_privilege then null;end;
 begin perform public.crm_orphan_organization_history(current_setting('test.orphan_org')::uuid);raise exception 'branch detail leak';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role authenticated;
do $$ begin begin perform public.crm_orphan_organization_history();raise exception 'no identity leak';exception when insufficient_privilege then null;end;end $$;
reset role;
set local role anon;
do $$ begin begin perform public.crm_orphan_organization_history();raise exception 'anon leak';exception when insufficient_privilege then null;end;end $$;
reset role;
rollback;
select 'PASS: admin full list ID reconciliation/cursors, note pages, original date, limit clamp, rep and branch list/detail denied, missing identity and anon denied; all rolled back' result;
