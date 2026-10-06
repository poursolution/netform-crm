import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { projectSnapshot } from '../supabase/functions/technical-advisory-ingest/project.mjs';
import { normalizeProject } from '../supabase/functions/technical-advisory-ingest/normalize.mjs';
const lifecycle = readFileSync(new URL('../sql/technical-advisory-lifecycle.sql', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/migrations/20261006040000_advisory_project_observations.sql', import.meta.url), 'utf8');

test('atomic project storage preserves identity, history, replay guards and private access', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role; create schema crm_security;
      create table crm_security.advisory_snapshots(project_id text primary key,revision numeric(25,0),snapshot jsonb,received_at timestamptz default now());
      create table crm_security.advisory_snapshot_history(project_id text,revision numeric(25,0),snapshot jsonb,primary key(project_id,revision));
      create table crm_security.advisory_deal_links(project_id text primary key,deal_id uuid);
      create table public.deals(id uuid primary key,stage_code text,stage_group text,stage_raw text,lifecycle_status text,outcome text,amount bigint,won_amount bigint,completion_date date,closed_at timestamptz,stage_entered_at timestamptz,version int);
      create table crm_security.contract_sales_events(event_id int,amount_delta bigint);
      insert into crm_security.contract_sales_events values(1,1000000000);
      create function public.crm_advisory_ingest_v1(p_project_id text,p_revision text,p_snapshot jsonb) returns jsonb language plpgsql as $$
      declare rev numeric(25,0); existing jsonb;
      begin
        if coalesce(p_project_id,'')='' or length(p_project_id)>256 or p_revision is null or p_revision !~ '^[1-9][0-9]{0,24}$'
          or jsonb_typeof(p_snapshot) is distinct from 'object' or p_snapshot->>'source_project_id' is distinct from p_project_id
          or jsonb_typeof(p_snapshot->'contracts') is distinct from 'array' then raise exception 'INVALID_SNAPSHOT'; end if;
        rev:=p_revision::numeric;
        perform pg_advisory_xact_lock(hashtextextended('advisory:'||p_project_id,0));
        select snapshot into existing from crm_security.advisory_snapshot_history where project_id=p_project_id and revision=rev;
        if found and existing is distinct from p_snapshot then raise exception 'REVISION_CONFLICT'; end if;
        insert into crm_security.advisory_snapshot_history values(p_project_id,rev,p_snapshot) on conflict do nothing;
        insert into crm_security.advisory_snapshots(project_id,revision,snapshot) values(p_project_id,rev,p_snapshot)
        on conflict(project_id) do update set revision=excluded.revision,snapshot=excluded.snapshot,received_at=now()
        where excluded.revision>crm_security.advisory_snapshots.revision;
        return jsonb_build_object('ok',true); end $$;`);
    await db.exec(lifecycle);
    await db.exec(migration);
    const input = { projectId: 'synthetic', data: { aptName: '동일 현장', managerName: '원 담당', status: 'contract_writing' } };
    const call = async (rev, basic = projectSnapshot(input), snapshot = normalizeProject(input)) =>
      (await db.query('select public.crm_advisory_ingest_v3($1,$2,$3,$4,$5) ack', [input.projectId, rev, snapshot, basic.operations, basic])).rows[0].ack;
    const count = async () => Number((await db.query('select count(*) n from crm_security.advisory_project_history')).rows[0].n);
    // Old v2 deployment already stored this revision: adding basics must not mutate the contract snapshot.
    await db.query('select public.crm_advisory_ingest_v2($1,$2,$3,$4)', [input.projectId, '7', normalizeProject(input), projectSnapshot(input).operations]);
    const original = (await db.query('select * from crm_security.advisory_snapshot_history')).rows;
    assert.equal((await call('7')).project_result, 'STORED');
    assert.equal((await call('7')).project_result, 'ALREADY_CURRENT'); assert.equal(await count(), 1);
    assert.deepEqual((await db.query('select * from crm_security.advisory_snapshot_history')).rows, original);
    const changed = { ...projectSnapshot(input), current_source_manager: '새 담당' };
    await assert.rejects(call('7', changed), /PROJECT_REVISION_CONFLICT/);
    assert.equal(await count(), 1);
    assert.equal((await call('8', changed)).project_result, 'STORED');
    assert.equal((await call('6')).project_result, 'STALE_REVISION'); assert.equal(await count(), 2);
    assert.equal((await db.query('select snapshot from crm_security.advisory_project_snapshots')).rows[0].snapshot.current_source_manager, '새 담당');
    assert.equal((await call('8', changed)).operational_result, 'EXACT_DEAL_LINK_REQUIRED');
    delete input.data.managerName;
    assert.equal((await call('9')).project_result, 'STORED');
    assert.equal((await db.query('select snapshot from crm_security.advisory_project_snapshots')).rows[0].snapshot.current_source_manager, '새 담당', 'omitted fields do not clear known source values');
    await db.exec("insert into crm_security.advisory_deal_links values('synthetic','11111111-1111-4111-8111-111111111111')");
    assert.equal((await call('10')).operational_result, 'DEAL_MISSING');
    // Invalid identity cannot leave partial writes; identical names never merge different project IDs.
    await assert.rejects(call('9', { ...changed, source_project_id: 'wrong' }), /INVALID_PROJECT_OBSERVATION/);
    input.projectId = 'other-source'; assert.equal((await call('1')).project_result, 'STORED');
    assert.equal((await db.query('select count(*)::int n from crm_security.advisory_project_snapshots')).rows[0].n, 2);
    assert.equal((await db.query('select count(*)::int n from public.deals')).rows[0].n, 0);
    assert.deepEqual((await db.query('select * from crm_security.contract_sales_events')).rows, [{ event_id: 1, amount_delta: 1000000000 }]);
    for (const role of ['anon', 'authenticated']) {
      await db.exec('set role ' + role);
      await assert.rejects(call('2'), /permission denied/);
      await assert.rejects(db.query('select * from crm_security.advisory_project_snapshots'), /permission denied/);
      await db.exec('reset role');
    }
    const access = (await db.query("select has_function_privilege('service_role','public.crm_advisory_ingest_v3(text,text,jsonb,jsonb,jsonb)','execute') ok")).rows[0];
    assert.equal(access.ok, true);
    assert.ok((await db.query("select relrowsecurity from pg_class where relname in ('advisory_project_snapshots','advisory_project_history')")).rows.every(r => r.relrowsecurity));
  } finally { await db.close(); }
});
