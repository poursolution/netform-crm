'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const personal = require('../../personal-state-compat/20260906/build.cjs');
const bundle = require('./build.cjs');

async function scalar(db, sql, params = []) {
  return (await db.query(sql, params)).rows[0];
}

async function personalRollbackForLocalFixture() {
  const db = await personal.setup();
  try {
    const before = await personal.capture(db);
    const oldReadDefinition = (await scalar(db, `SELECT pg_get_functiondef(
      'public.crm_read_scoped_v2(uuid,integer,uuid,uuid)'::regprocedure) AS definition`)).definition;
    const signatures = [
      'public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)',
      'public.crm_read_scoped_v2(uuid,integer,uuid,uuid)',
      'crm_security.crm_write_command_v2_frozen_20260906(uuid,text,uuid,integer,jsonb)',
      'crm_security.crm_inquiry_unassign_command_v1(uuid,uuid,jsonb)'
    ];
    const functions = [];
    for (const signature of signatures) {
      const row = await scalar(db, `SELECT oid,pg_get_functiondef(oid) AS definition
        FROM pg_proc WHERE oid=$1::regprocedure`, [signature]);
      functions.push({
        signature,
        oid: row.oid,
        definition_md5: crypto.createHash('md5').update(row.definition).digest('hex')
      });
    }
    await db.exec(personal.approval + require('node:fs').readFileSync(
      require('node:path').join(personal.dir, 'candidate.sql'), 'utf8'));
    const after = await personal.capture(db);
    return personal.rollback(before, after, oldReadDefinition, { functions });
  } finally {
    await db.close();
  }
}

test('cumulative reachable bundle is one guarded transaction in each direction', () => {
  const apply = bundle.compose('apply');
  const rollback = bundle.compose('rollback');
  assert.equal((apply.match(/^BEGIN;$/gm) || []).length, 1);
  assert.equal((apply.match(/^COMMIT;$/gm) || []).length, 1);
  assert.equal((rollback.match(/^BEGIN;$/gm) || []).length, 1);
  assert.equal((rollback.match(/^COMMIT;$/gm) || []).length, 1);
  assert.ok(apply.indexOf('APPLY personal_state') < apply.indexOf('APPLY inquiry_followup'));
  assert.ok(rollback.indexOf('ROLLBACK inquiry_followup') < rollback.indexOf('ROLLBACK personal_state'));
  for (const stage of bundle.stages) {
    const applySource = fs.readFileSync(path.join(bundle.__root || path.resolve(__dirname, '../../..'), stage.apply), 'utf8');
    const rollbackSource = fs.readFileSync(path.join(bundle.__root || path.resolve(__dirname, '../../..'), stage.rollback), 'utf8');
    assert.ok(apply.includes(bundle.unwrap(applySource.replace(/\r\n?/g, '\n'), `apply:${stage.id}`)), `${stage.id} apply guard/body changed`);
    assert.ok(rollback.includes(bundle.unwrap(rollbackSource.replace(/\r\n?/g, '\n'), `rollback:${stage.id}`)), `${stage.id} rollback guard/body changed`);
  }
  assert.doesNotMatch(apply, /ymfbmpnizxvqsamnczow|n8n/i);
  assert.doesNotMatch(rollback, /ymfbmpnizxvqsamnczow|n8n/i);
});

test('late-stage apply failure rolls every earlier candidate layer back', async () => {
  const db = await personal.setup();
  const before = await personal.capture(db);
  try {
    await db.exec(`CREATE FUNCTION crm_security.crm_inquiry_followup_command_v1(uuid,uuid,jsonb)
      RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;
      REVOKE EXECUTE ON FUNCTION crm_security.crm_inquiry_followup_command_v1(uuid,uuid,jsonb)
      FROM PUBLIC,anon,authenticated,service_role;`);
    let failure;
    try {
      await db.exec(bundle.compose('apply', { localPersonalCandidate: true }));
    } catch (error) {
      failure = error;
      await db.exec('ROLLBACK');
    }
    assert.match(String(failure && failure.message), /inquiry followup prerequisite drift/);
    await db.exec('DROP FUNCTION crm_security.crm_inquiry_followup_command_v1(uuid,uuid,jsonb)');
    assert.deepEqual(await personal.capture(db), before);
    assert.equal((await scalar(db, "SELECT to_regclass('crm_security.user_opportunity_state') IS NULL AS ok")).ok, true);
    assert.equal((await scalar(db, "SELECT to_regclass('crm_security.quote_versions') IS NULL AS ok")).ok, true);
    assert.equal((await scalar(db, "SELECT to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') IS NULL AS ok")).ok, true);
  } finally {
    await db.close();
  }
});

test('cumulative apply reaches the 21-operation private-helper state and reverse rollback restores baseline', async () => {
  await bundle.build();
  const localPersonalRollback = await personalRollbackForLocalFixture();
  const db = await personal.setup();
  const before = await personal.capture(db);
  try {
    await db.exec(bundle.compose('apply', { localPersonalCandidate: true }));
    const constraint = await scalar(db, `SELECT pg_get_constraintdef(oid,true) AS definition
      FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass
      AND conname='command_receipts_operation_check'`);
    for (const operation of bundle.finalOperations) assert.match(constraint.definition, new RegExp(`'${operation}'`));
    for (const signature of bundle.finalHelpers) {
      const row = await scalar(db, `SELECT to_regprocedure($1) IS NOT NULL AS present,
        has_function_privilege('authenticated',$1,'EXECUTE') AS exposed`, [signature]);
      assert.deepEqual(row, { present: true, exposed: false });
    }
    for (const relation of bundle.finalRelations) {
      const row = await scalar(db, `SELECT to_regclass($1) IS NOT NULL AS present,
        has_table_privilege('authenticated',$1,'SELECT,INSERT,UPDATE,DELETE') AS exposed`, [relation]);
      assert.deepEqual(row, { present: true, exposed: false });
    }
    assert.equal((await scalar(db, `SELECT has_function_privilege('authenticated',
      'public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') AS allowed`)).allowed, true);
    assert.equal((await scalar(db, `SELECT has_function_privilege('authenticated',
      'public.crm_operational_source_v1(text,uuid,integer)','EXECUTE') AS allowed`)).allowed, true);

    await db.exec(bundle.compose('rollback', { localPersonalRollback }));
    assert.deepEqual(await personal.capture(db), before);
    for (const signature of bundle.finalHelpers) {
      assert.equal((await scalar(db, 'SELECT to_regprocedure($1) IS NULL AS gone', [signature])).gone, true);
    }
    for (const relation of bundle.finalRelations) {
      assert.equal((await scalar(db, 'SELECT to_regclass($1) IS NULL AS gone', [relation])).gone, true);
    }
    for (const schema of bundle.archiveSchemas) {
      assert.equal((await scalar(db, 'SELECT to_regnamespace($1) IS NOT NULL AS archived', [schema])).archived, true);
    }
  } finally {
    await db.close();
  }
});
