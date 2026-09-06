'use strict';

// Exact-path Staging fixture cleanup through the Storage API. It never accepts
// a wildcard/prefix and never prints credentials or session tokens. The exact
// temporary SELECT/DELETE policies must be separately reviewed, applied and
// removed around this call.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const REF = 'rprechiaglyjaydkmxsu';
const PRODUCTION_REF = 'ymfbmpnizxvqsamnczow';
const ORIGIN = `https://${REF}.supabase.co`;
const RUN = process.env.STAGING_STORAGE_CLEANUP_RUN || 'stg-e2e-20260906t125239z-fc70f2d2';
const ROOT = path.resolve(__dirname, '..');
const RUN_DIR = path.join(ROOT, 'docs', 'operational-cutover-20260906', 'staging-fixture-runs', RUN);
const PLAN_FILE = path.join(RUN_DIR, 'storage-cleanup-plan.json');
const REQUIRED = [
  'CRM_REMOVE_EXACT_STAGING_STORAGE_OBJECT',
  'STAGING_PROJECT_REF',
  'STAGING_CONFIRM_PROJECT_REF',
  'STAGING_SUPABASE_URL',
  'STAGING_PUBLISHABLE_KEY',
  'STAGING_SYNTHETIC_AUTH_FILE',
  'STAGING_STORAGE_CLEANUP_PROOF_FILE'
];

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
  assert.equal(env.CRM_REMOVE_EXACT_STAGING_STORAGE_OBJECT, '1');
  assert.equal(env.STAGING_PROJECT_REF, REF);
  assert.equal(env.STAGING_CONFIRM_PROJECT_REF, REF);
  const url = new URL(env.STAGING_SUPABASE_URL);
  assert.equal(url.origin, ORIGIN);
  assert.equal(url.pathname, '/');
  assert.equal(url.search, '');
  assert.equal(url.hash, '');
  assert.match(env.STAGING_PUBLISHABLE_KEY || '', /^sb_publishable_/, 'publishable key required');
  const authFile = path.resolve(env.STAGING_SYNTHETIC_AUTH_FILE);
  assert.ok(fs.statSync(authFile).isFile(), 'synthetic auth file missing');
  const proofFile = path.resolve(env.STAGING_STORAGE_CLEANUP_PROOF_FILE);
  assert.ok(proofFile.startsWith(RUN_DIR + path.sep), 'proof file must stay in the exact fixture run directory');
  assert.equal(fs.existsSync(proofFile), false, 'refuse to overwrite an existing proof');
  return { authFile, proofFile };
}

function validatePlan(plan) {
  assert.equal(plan.project_ref, REF);
  assert.equal(plan.run_id, RUN);
  assert.equal(plan.status, 'PENDING_EXACT_FIXTURE_CLEANUP_APPROVAL');
  assert.equal(plan.bucket, 'crm-site-files');
  assert.match(plan.object_id, /^[0-9a-f-]{36}$/i);
  assert.match(plan.owner_id, /^[0-9a-f-]{36}$/i);
  assert.match(plan.object_path, /^deals\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/i);
  assert.equal(plan.object_path.includes('*'), false);
  assert.equal(plan.object_path.includes('..'), false);
  assert.equal(plan.broad_prefix_delete, false);
  assert.equal(plan.direct_sql_delete, false);
  return plan;
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
  const plan = validatePlan(JSON.parse(fs.readFileSync(PLAN_FILE, 'utf8')));
  const credentials = JSON.parse(fs.readFileSync(guard.authFile, 'utf8'));
  assert.equal(credentials.project_ref, REF);
  const account = credentials.accounts.find((row) => row.kind === 'INTERNAL_REP');
  assert.ok(account?.email && account?.password);
  assert.ok(account.email.endsWith('@example.invalid'));

  const requests = [];
  function route(raw) {
    const url = new URL(raw, ORIGIN);
    assert.equal(url.origin, ORIGIN, 'cross-origin request prohibited');
    assert.match(url.pathname, /^\/(?:auth|storage)\/v1\//, 'only Staging Auth/Storage paths are allowed');
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

  const login = await api('/auth/v1/token?grant_type=password', { body: { email: account.email, password: account.password } });
  assert.equal(login.status, 200, 'synthetic login failed');
  const session = login.data;
  assert.match(session.access_token || '', /^[^.]+\.[^.]+\.[^.]+$/);
  assert.equal(session.user.id, plan.owner_id, 'Storage object owner is not the reviewed synthetic actor');
  const parent = plan.object_path.slice(0, plan.object_path.lastIndexOf('/'));
  const fileName = plan.object_path.slice(plan.object_path.lastIndexOf('/') + 1);
  const listBody = { prefix: parent, limit: 100, offset: 0, search: fileName, sortBy: { column: 'name', order: 'asc' } };
  let before;
  let removed;
  let after;
  try {
    before = await api(`/storage/v1/object/list/${encodeURIComponent(plan.bucket)}`, { body: listBody, token: session.access_token });
    assert.equal(before.status, 200, 'exact Storage pre-delete list failed');
    const beforeMatches = (before.data || []).filter((item) => item.id === plan.object_id && item.name === fileName);
    assert.equal(beforeMatches.length, 1, 'exact Storage object must exist once before delete');

    removed = await api(`/storage/v1/object/${encodeURIComponent(plan.bucket)}`, {
      method: 'DELETE',
      body: { prefixes: [plan.object_path] },
      token: session.access_token
    });
    assert.equal(removed.status, 200, 'exact Storage API remove failed');
    assert.ok(Array.isArray(removed.data), 'Storage remove response must be an array');
    const removedMatches = removed.data.filter((item) => item.id === plan.object_id || item.name === plan.object_path);
    assert.equal(removedMatches.length, 1, 'Storage remove response did not identify the exact object');

    after = await api(`/storage/v1/object/list/${encodeURIComponent(plan.bucket)}`, { body: listBody, token: session.access_token });
    assert.equal(after.status, 200, 'exact Storage post-delete list failed');
    const afterMatches = (after.data || []).filter((item) => item.id === plan.object_id || item.name === fileName);
    assert.equal(afterMatches.length, 0, 'exact Storage object remains after delete');
  } finally {
    await api('/auth/v1/logout?scope=local', { body: {}, token: session.access_token }).catch(() => {});
  }

  const proof = {
    project_ref: REF,
    project_name: 'netform-crm-staging',
    run_id: RUN,
    status: 'REMOVED_VIA_STORAGE_API_VERIFIED_ZERO',
    bucket: plan.bucket,
    object_id: plan.object_id,
    object_path: plan.object_path,
    actor_auth_uid: plan.owner_id,
    remove_response_matches: 1,
    post_delete_matches: 0,
    http_requests: requests.length,
    production_requests: 0,
    n8n_requests: 0
  };
  noSecrets(proof);
  fs.writeFileSync(guard.proofFile, JSON.stringify(proof, null, 2) + '\n');
  return proof;
}

if (require.main === module) {
  run().then((result) => {
    console.log(JSON.stringify(result));
    if (result.status === 'SKIP_NOT_PASS') process.exitCode = 2;
  }).catch((error) => {
    console.error(`EXACT_STORAGE_CLEANUP_FAILED ${error.code || error.name || 'ERROR'} ${error.message || ''}`);
    process.exitCode = 1;
  });
}

module.exports = { REF, RUN, REQUIRED, forbiddenEnvironment, validateEnvironment, validatePlan, noSecrets, run };
