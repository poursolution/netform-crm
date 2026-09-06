'use strict';

// Opt-in Staging-only negative-role harness. Successful execution means every
// attempted mutation was rejected before a receipt/domain mutation could be
// committed, and owner/admin read-back stayed byte-for-byte equivalent for the
// compared business fields. With no opt-in it performs zero network I/O.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const adapter = require('../sql/operational-full-local-candidate/20260906/operational-adapter.candidate.js');

const REF = 'rprechiaglyjaydkmxsu';
const PRODUCTION_REF = 'ymfbmpnizxvqsamnczow';
const ORIGIN = `https://${REF}.supabase.co`;
const RUN = 'stg-e2e-20260906t125239z-fc70f2d2';
const ROOT = path.resolve(__dirname, '..');
const RUN_DIR = path.join(ROOT, 'docs', 'operational-cutover-20260906', 'staging-fixture-runs', RUN);
const DEFAULT_PLAN = path.join(RUN_DIR, 'fixture-plan.json');
const BROWSER_PROOF = path.join(RUN_DIR, 'browser-mutation-proof.json');
const PENDING_AUDIT = path.join(RUN_DIR, 'cleanup-pending-audit.json');
const REQUIRED = [
  'CRM_RUN_OPERATIONAL_ROLE_DENIAL_STAGING',
  'STAGING_PROJECT_REF',
  'STAGING_CONFIRM_PROJECT_REF',
  'STAGING_SUPABASE_URL',
  'STAGING_PUBLISHABLE_KEY',
  'STAGING_SYNTHETIC_AUTH_FILE',
  'STAGING_ROLE_DENIAL_PROOF_FILE'
];
const DENIED_ROLES = ['OTHER_REP', 'CONSULT', 'GYEONGNAM'];

function forbiddenEnvironment(env) {
  const findings = [];
  for (const [name, raw] of Object.entries(env)) {
    const value = String(raw || '');
    if (value.includes(PRODUCTION_REF)) findings.push(`${name}: production ref`);
    if (value && /n8n.*url|url.*n8n/i.test(name)) findings.push(`${name}: n8n URL setting`);
    for (const token of value.match(/https?:\/\/[^\s"'<>]+/gi) || []) {
      try {
        if (new URL(token).hostname.toLowerCase().includes('n8n')) findings.push(`${name}: n8n URL`);
      } catch {}
    }
  }
  for (const name of ['SUPABASE_SERVICE_ROLE_KEY', 'STAGING_SERVICE_ROLE_KEY', 'STAGING_SECRET_KEY', 'STAGING_DATABASE_URL']) {
    if (env[name]) findings.push(`${name}: privileged credential prohibited`);
  }
  return [...new Set(findings)];
}

function validateEnvironment(env) {
  assert.equal(env.CRM_RUN_OPERATIONAL_ROLE_DENIAL_STAGING, '1', 'explicit role-denial opt-in required');
  assert.equal(env.STAGING_PROJECT_REF, REF);
  assert.equal(env.STAGING_CONFIRM_PROJECT_REF, REF);
  const url = new URL(env.STAGING_SUPABASE_URL);
  assert.equal(url.origin, ORIGIN);
  assert.equal(url.pathname, '/');
  assert.equal(url.search, '');
  assert.equal(url.hash, '');
  assert.equal(url.username, '');
  assert.equal(url.password, '');
  assert.match(env.STAGING_PUBLISHABLE_KEY || '', /^sb_publishable_/, 'publishable key required');
  const authFile = path.resolve(env.STAGING_SYNTHETIC_AUTH_FILE);
  assert.ok(fs.statSync(authFile).isFile(), 'synthetic auth file missing');
  const proofFile = path.resolve(env.STAGING_ROLE_DENIAL_PROOF_FILE);
  assert.ok(proofFile.startsWith(RUN_DIR + path.sep), 'proof file must stay in the exact fixture run directory');
  assert.equal(fs.existsSync(proofFile), false, 'refuse to overwrite an existing proof');
  return { authFile, proofFile };
}

function noSecrets(value) {
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    for (const [key, child] of Object.entries(node)) {
      assert.doesNotMatch(key, /password|access[_-]?token|refresh[_-]?token|service[_-]?role|secret[_-]?key|database[_-]?url/i, `proof contains secret field ${key}`);
      walk(child);
    }
  };
  walk(value);
}

function entity(plan, scenarioId, kind, index = 1) {
  const row = plan.entities.find((item) => item.scenario_id === scenarioId && item.kind === kind && item.index === index);
  assert.ok(row, `missing ${scenarioId} ${kind} ${index}`);
  return row.id;
}

function stableDeal(row) {
  return {
    id: row.id,
    owner_id: row.owner_id,
    stage_code: row.stage_code,
    primary_work: row.primary_work,
    work_items: row.work_items,
    work_scope_type: row.work_scope_type,
    work_summary: row.work_summary,
    version: row.version
  };
}

function stableInquiry(row) {
  return {
    id: row.id,
    assigned_to: row.assigned_to,
    status: row.status,
    brand: row.brand,
    first_response_at: row.first_response_at,
    responded_at: row.responded_at,
    next_action_date: row.next_action_date
  };
}

async function run(env = process.env) {
  const missing = REQUIRED.filter((name) => !env[name]);
  const forbidden = forbiddenEnvironment(env);
  if (missing.length || forbidden.length) {
    return {
      status: 'SKIP_NOT_PASS',
      network_requests: 0,
      reason: missing.length ? `missing ${missing.join(', ')}` : `unsafe environment: ${forbidden.join(', ')}`
    };
  }
  assert.deepEqual(forbidden, []);
  const guard = validateEnvironment(env);
  const plan = JSON.parse(fs.readFileSync(DEFAULT_PLAN, 'utf8'));
  const browserProof = JSON.parse(fs.readFileSync(BROWSER_PROOF, 'utf8'));
  const pendingAudit = JSON.parse(fs.readFileSync(PENDING_AUDIT, 'utf8'));
  const secrets = JSON.parse(fs.readFileSync(guard.authFile, 'utf8'));
  assert.equal(plan.project_ref, REF);
  assert.equal(plan.run_id, RUN);
  assert.equal(browserProof.project_ref, REF);
  assert.equal(browserProof.run_id, RUN);
  assert.equal(browserProof.status, 'PASS');
  assert.equal(browserProof.scenario_pass, 35);
  assert.equal(browserProof.step_pass, 75);
  assert.equal(pendingAudit.project_ref, REF);
  assert.equal(pendingAudit.run_id, RUN);
  assert.equal(pendingAudit.status, 'PENDING_EXACT_FIXTURE_CLEANUP_APPROVAL');

  const sessions = {};
  const requests = [];
  const results = [];
  const requestIds = [];
  const dealId = entity(plan, 'frozen-opportunity-work', 'deal');
  const inquiryId = entity(plan, 'frozen-direct-assign-pc-mobile', 'inquiry');
  const startedAt = new Date().toISOString();

  function route(raw) {
    const url = new URL(raw, ORIGIN);
    assert.equal(url.origin, ORIGIN, 'cross-origin request prohibited');
    assert.match(url.pathname, /^\/(?:auth|rest)\/v1\//, 'only Staging Auth/REST paths are allowed');
    requests.push(url.pathname);
    return url;
  }

  async function api(raw, { method = 'POST', body, token } = {}) {
    const response = await fetch(route(raw), {
      method,
      redirect: 'error',
      signal: AbortSignal.timeout(30000),
      headers: {
        apikey: env.STAGING_PUBLISHABLE_KEY,
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    let data = null;
    try { data = await response.json(); } catch {}
    return { status: response.status, data };
  }

  const account = (kind) => {
    const expected = secrets.accounts.find((item) => item.kind === kind);
    assert.ok(expected, `missing synthetic ${kind}`);
    assert.ok(expected.email.endsWith('@example.invalid'));
    assert.ok(expected.password);
    return expected;
  };
  async function login(kind) {
    const expected = account(kind);
    const response = await api('/auth/v1/token?grant_type=password', { body: { email: expected.email, password: expected.password } });
    assert.equal(response.status, 200, `${kind} login failed`);
    const claims = JSON.parse(Buffer.from(response.data.access_token.split('.')[1], 'base64url').toString());
    assert.equal(claims.iss, `${ORIGIN}/auth/v1`);
    assert.equal(claims.sub, response.data.user.id);
    assert.equal(claims.role, 'authenticated');
    sessions[kind] = response.data;
  }
  const rpc = (kind, name, args) => api(`/rest/v1/rpc/${name}`, { body: args, token: sessions[kind].access_token });
  async function read(kind, args) {
    const response = await rpc(kind, 'crm_read_scoped_v2', args);
    assert.equal(response.status, 200, `${kind} read failed`);
    return response.data;
  }
  async function deny(kind, operation, objectId, expectedVersion, payload, surface) {
    const requestId = crypto.randomUUID();
    const command = adapter.normalize(operation, objectId, expectedVersion, payload);
    requestIds.push(requestId);
    const response = await rpc(kind, 'crm_write_command_v2', {
      p_request_id: requestId,
      p_operation: command.operation,
      p_object_id: command.object_id,
      p_expected_version: command.expected_version,
      p_payload: command.payload
    });
    assert.equal(response.status, 403, `${kind} ${operation} must return HTTP 403`);
    assert.equal(response.data?.code, '42501', `${kind} ${operation} must fail with SQLSTATE 42501`);
    results.push({ kind, operation, object_id: objectId, request_id: requestId, surface, status: 'PASS_DENIED_403_42501' });
  }

  let failure = null;
  try {
    for (const kind of ['INTERNAL_REP', 'ADMIN', ...DENIED_ROLES]) await login(kind);
    const dealBefore = stableDeal((await read('INTERNAL_REP', { p_deal_id: dealId, p_limit: 1 })).deals[0]);
    const inquiryBefore = stableInquiry((await read('ADMIN', { p_inquiry_id: inquiryId, p_limit: 1 })).inquiries[0]);
    assert.equal(dealBefore.id, dealId);
    assert.equal(inquiryBefore.id, inquiryId);
    assert.ok(Number.isInteger(dealBefore.version));

    for (const kind of DENIED_ROLES) {
      await deny(kind, 'opportunity_work_set', dealId, dealBefore.version, {
        opportunity_id: dealId,
        primary_work: dealBefore.primary_work,
        work_items: dealBefore.work_items,
        reason: `ROLE DENIAL ${kind}`
      }, 'crm.html');
      await deny(kind, 'inquiry_reclassify', inquiryId, 0, {
        inquiry_id: inquiryId,
        from_brand: '기술자문',
        to_brand: 'POUR솔루션',
        review_status: 'reclassified'
      }, 'crm.html');
    }

    const dealAfter = stableDeal((await read('INTERNAL_REP', { p_deal_id: dealId, p_limit: 1 })).deals[0]);
    const inquiryAfter = stableInquiry((await read('ADMIN', { p_inquiry_id: inquiryId, p_limit: 1 })).inquiries[0]);
    assert.deepEqual(dealAfter, dealBefore, 'denied role attempts changed the Deal');
    assert.deepEqual(inquiryAfter, inquiryBefore, 'denied role attempts changed the inquiry');
  } catch (error) {
    failure = error;
  } finally {
    for (const session of Object.values(sessions)) {
      try { await api('/auth/v1/logout?scope=local', { body: {}, token: session.access_token }); } catch {}
    }
  }

  const proof = {
    project_ref: REF,
    project_name: 'netform-crm-staging',
    run_id: RUN,
    mode: 'NEGATIVE_ROLE_MUTATION_DENIAL',
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    status: failure ? 'FAIL' : 'PASS',
    denied_roles: DENIED_ROLES,
    expected_denials: 6,
    pass: results.length,
    fail: failure ? 1 : 0,
    skip: 0,
    state_unchanged: !failure,
    request_ids: requestIds,
    results,
    http_requests: requests.length,
    attempted_mutations: requestIds.length,
    committed_mutations: 0,
    production_requests: 0,
    n8n_requests: 0,
    error_type: failure?.code || failure?.name || null
  };
  noSecrets(proof);
  fs.writeFileSync(guard.proofFile, JSON.stringify(proof, null, 2) + '\n');
  if (failure) throw failure;
  assert.equal(proof.pass, 6);
  return proof;
}

if (require.main === module) {
  run().then((result) => {
    console.log(JSON.stringify(result));
    if (result.status === 'SKIP_NOT_PASS') process.exitCode = 2;
  }).catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = { REF, RUN, REQUIRED, DENIED_ROLES, forbiddenEnvironment, validateEnvironment, noSecrets, entity, stableDeal, stableInquiry, run };
