'use strict';

// Executes the actual adapter and both actual clients. All fetches and storage
// are synthetic in-process; this suite never connects to a CRM server.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const rootDir = path.resolve(__dirname, '..');
const adapter = require(path.join(rootDir, 'operational-adapter.js'));
const adapterSource = fs.readFileSync(path.join(rootDir, 'operational-adapter.js'), 'utf8');
const ID = '11111111-1111-4111-8111-111111111111';
const AUTH = '22222222-2222-4222-8222-222222222222';
const USER = '33333333-3333-4333-8333-333333333333';
const CONTACT = '44444444-4444-4444-8444-444444444444';
const AUDIT = '55555555-5555-4555-8555-555555555555';
const OTHER = '66666666-6666-4666-8666-666666666666';
const REQUEST = '77777777-7777-4777-8777-777777777777';
const SECOND = '88888888-8888-4888-8888-888888888888';
const REF = 'ymfbmpnizxvqsamnczow';
const consentKeys = ['sms_consent', 'kakao_consent', 'consent_at', 'opt_out_at', 'send_blocked', 'send_blocked_reason'];
const CONTACT_RPC = 'crm_contact_command_v1';
const plain = value => JSON.parse(JSON.stringify(value));
const has = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const payload = patch => ({
  opportunity_id: ID, site_id: null, person_key: 'mobile:01012345678',
  site_name: '합성 검증 현장', manager_name: '합성 담당자',
  manager_mobile: '010-1234-5678', manager_role: '관리소장', ...patch
});
const granted = () => ({
  sms_consent: true, kakao_consent: true, consent_at: '2026-10-01T00:00:00.000Z',
  opt_out_at: null, send_blocked: false, send_blocked_reason: null
});
const refused = () => ({
  sms_consent: false, kakao_consent: false, consent_at: null,
  opt_out_at: '2026-10-02T00:00:00.000Z', send_blocked: true, send_blocked_reason: '고객 요청'
});
function command(patch, extra = {}) {
  return {...adapter.normalize('contact_upsert', ID, 7, payload(patch), CONTACT_RPC),
    request_id: REQUEST, auth_uid: AUTH, user_id: USER, ...extra};
}
function receipt(cmd, consent = granted(), extra = {}) {
  return {contract_version: 1, ok: true, request_id: cmd.request_id,
    operation: cmd.operation, object_id: cmd.object_id, replayed: false,
    actor_auth_uid: cmd.auth_uid, actor_user_id: cmd.user_id,
    contact_id: CONTACT, person_key: cmd.payload.person_key,
    previous_version: cmd.expected_version, version: cmd.expected_version + 1,
    audit_event_id: AUDIT, server_at: '2026-10-11T03:00:00.000Z',
    contact_consent_contract: 'preserve-omitted-v1', consent: plain(consent), ...extra};
}
function storage() {
  const values = new Map();
  return {get length() {return values.size;}, key: i => [...values.keys()][i] ?? null,
    getItem: key => values.get(String(key)) ?? null,
    setItem: (key, value) => values.set(String(key), String(value)),
    removeItem: key => values.delete(String(key))};
}
function response(body, status = 200) {
  return {ok: status >= 200 && status < 300, status,
    json: async () => plain(body), clone: () => response(body, status)};
}
async function harness(file, options = {}) {
  const calls = [], receipts = new Map(), events = new Map(), missing = [];
  let mutations = 0, effective = plain(options.effective || granted());
  let session = {user: {id: AUTH}, access_token: 'SYNTHETIC_ONLY'};
  let applicationUser = USER;
  let dropOnce = !!options.dropOnce;
  const configuration = {project_ref: REF, url: `https://${REF}.supabase.co`,
    publishable_key: 'SYNTHETIC_PUBLISHABLE_KEY', accounts: []};
  const context = {
    console, URL, AbortController, setTimeout, clearTimeout, crypto,
    Event: class {constructor(type) {this.type = type;}},
    CustomEvent: class {constructor(type, data) {this.type = type; this.detail = data?.detail;}},
    location: {hostname: '127.0.0.1', origin: 'http://127.0.0.1:4179', href: 'http://127.0.0.1:4179/'},
    navigator: {}, XMLHttpRequest: class {open() {}}, BroadcastChannel: undefined,
    localStorage: storage(), sessionStorage: storage(), PHASE1_CONFIG: configuration,
    addEventListener(type, fn) {if (!events.has(type)) events.set(type, []); events.get(type).push(fn);},
    dispatchEvent(event) {for (const fn of events.get(event.type) || []) fn(event);},
    CRMRelease: {noteMissing: name => missing.push(name)},
    async fetch(url, init) {
      const endpoint = new URL(url).pathname.split('/').at(-1);
      const args = JSON.parse(init.body || '{}');
      calls.push({endpoint, args: plain(args), body: init.body, headers: plain(init.headers)});
      if (endpoint === 'crm_profile_scoped_v2') return response({contract_version: 2,
        auth_uid: session.user.id, user_id: applicationUser, source_role: 'sales', allowed_modes: ['rep', 'admin']});
      assert(['crm_contact_command_v1', 'crm_write_command_v2'].includes(endpoint), 'Unexpected external path: ' + endpoint);
      if (options.onCommand) {
        const answer = await options.onCommand({endpoint, args, init, calls});
        if (answer) return answer;
      }
      if (options.missing) return response({code: 'PGRST202', message: 'Function unavailable in synthetic server'}, 404);
      if (options.conflict) return response({code: 'VERSION_CONFLICT', message: 'Version changed'}, 409);
      const existing = receipts.get(args.p_request_id);
      if (existing) return response({...existing, replayed: true});
      const cmd = {operation: args.p_operation, object_id: args.p_object_id,
        request_id: args.p_request_id, expected_version: args.p_expected_version,
        payload: args.p_payload, auth_uid: session.user.id, user_id: applicationUser};
      let ack;
      if (cmd.operation === 'contact_upsert') {
        // This is only the fake server fixture. Client production logic is never
        // replaced: both the queue's routing and ACK validation run verbatim.
        for (const key of consentKeys) if (has(cmd.payload, key)) effective[key] = cmd.payload[key];
        ack = receipt(cmd, effective);
        if (options.oldReceipt) {delete ack.contact_consent_contract; delete ack.consent;}
      } else {
        assert.equal(cmd.operation, 'opportunity_work_set');
        ack = {contract_version: 1, ok: true, request_id: cmd.request_id,
          operation: cmd.operation, object_id: cmd.object_id, replayed: false,
          actor_auth_uid: cmd.auth_uid, actor_user_id: cmd.user_id,
          previous_version: cmd.expected_version, version: cmd.expected_version + 1,
          audit_event_id: AUDIT};
      }
      if (options.ackEdit) options.ackEdit(ack, cmd);
      receipts.set(cmd.request_id, plain(ack)); mutations++;
      if (dropOnce) {dropOnce = false; throw Error('SYNTHETIC_ACK_LOST');}
      return response(ack);
    },
    supabase: {createClient() {return {
      auth: {getSession: async () => ({data: {session}}), onAuthStateChange() {}, signOut: async () => {}},
      rpc() {throw Error('Unexpected SDK RPC bypass');},
      channel() {const inert = {on() {return inert;}, subscribe() {return inert;}, unsubscribe: async () => {}}; return inert;}
    };}}
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(adapterSource, context, {filename: 'operational-adapter.js'});
  // Emulate the previous assets' missing capability at their public boundary.
  // The remaining actual client code is unchanged; no alternative test queue.
  if (options.legacyAdapter) {
    const current = context.OperationalAdapter;
    context.OperationalAdapter = Object.freeze({operations: current.operations,
      normalize() {throw Error('LEGACY_NORMALIZE_MUST_NOT_RUN');}, validateAck: current.validateAck});
  }
  let transportSource = fs.readFileSync(path.join(rootDir, file), 'utf8');
  if (options.legacyEnqueue) {
    const currentCall = /const writeRpc=root\.OperationalAdapter\.toRpc\(\{operation\}\);\s*const normalized=root\.OperationalAdapter\.normalize\(operation,objectId,expectedVersion,payload,writeRpc\);/;
    assert(currentCall.test(transportSource), 'Locate the real enqueue handshake before simulating its old four-argument caller');
    transportSource = transportSource.replace(currentCall,
      'const normalized=root.OperationalAdapter.normalize(operation,objectId,expectedVersion,payload);');
  }
  vm.runInContext(transportSource, context, {filename: file});
  const phase = context.Phase1;
  phase.createClient(configuration.url, configuration.publishable_key);
  await phase.admit(session);
  return {context, phase, calls, receipts, missing, effective: () => plain(effective), mutations: () => mutations,
    commands: () => calls.filter(call => call.endpoint !== 'crm_profile_scoped_v2'),
    async login(auth = OTHER, user = OTHER) {
      phase.beginLogin(); session = {user: {id: auth}, access_token: 'OTHER_SYNTHETIC_ONLY'};
      applicationUser = user; await phase.admit(session);
    }};
}

test('contact normalization preserves omission, including JSON serialization', () => {
  const normalized = adapter.normalize('contact_upsert', ID, 7, payload(), CONTACT_RPC);
  for (const key of consentKeys) {
    assert.equal(has(normalized.payload, key), false, key);
    assert.equal(has(plain(normalized.payload), key), false, key + ' serialized');
  }
  assert.equal(normalized.payload.manager_mobile, '01012345678');
});

test('explicit false and nullable clears remain submitted; boolean null/undefined/string reject', () => {
  const patch = {sms_consent: false, kakao_consent: false, send_blocked: false,
    consent_at: null, opt_out_at: null, send_blocked_reason: null};
  const normalized = adapter.normalize('contact_upsert', ID, 7, payload(patch), CONTACT_RPC);
  for (const key of consentKeys) assert.equal(normalized.payload[key], patch[key], key);
  for (const key of ['sms_consent', 'kakao_consent', 'send_blocked']) {
    for (const value of [null, undefined, 'false', 0]) {
      assert.throws(() => adapter.normalize('contact_upsert', ID, 7, payload({[key]: value}), CONTACT_RPC), /INVALID_CONTACT_CONSENT/);
    }
  }
});

test('sparse timestamps do not require resubmitting stored values or inject defaults', () => {
  for (const patch of [{sms_consent: true}, {send_blocked: true},
    {consent_at: '2026-10-11T12:00:00+09:00'}, {opt_out_at: null}, {send_blocked_reason: null}]) {
    const out = adapter.normalize('contact_upsert', ID, 7, payload(patch), CONTACT_RPC).payload;
    for (const key of consentKeys) assert.equal(has(out, key), has(patch, key), key);
  }
  assert.equal(command({consent_at: '  '}).payload.consent_at, null);
  assert.throws(() => command({consent_at: 'not-a-date'}), /INVALID_CONTACT_CONSENT/);
  assert.throws(() => command({sms_consent: true, consent_at: null}), /INVALID_CONTACT_CONSENT/);
  assert.throws(() => command({send_blocked: true, opt_out_at: null}), /INVALID_CONTACT_CONSENT/);
  assert.throws(() => command({kakao_consent: true, opt_out_at: '2026-10-11T00:00:00Z'}), /INVALID_CONTACT_CONSENT/);
});

test('ACK accepts valid effective consent for omitted keys and compares submitted keys only', () => {
  const sparse = command();
  assert.equal(adapter.validateAck(receipt(sparse, granted()), sparse).ok, true);
  assert.equal(adapter.validateAck(receipt(sparse, refused()), sparse).ok, true);
  const explicitFalse = command({sms_consent: false});
  assert.equal(adapter.validateAck(receipt(explicitFalse, {...granted(), sms_consent: false}), explicitFalse).ok, true);
  assert.throws(() => adapter.validateAck(receipt(explicitFalse, granted()), explicitFalse), /ACK_CONTRACT_MISMATCH/);
  const explicitNull = command({send_blocked_reason: null});
  assert.throws(() => adapter.validateAck(receipt(explicitNull, refused()), explicitNull), /ACK_CONTRACT_MISMATCH/);
  const time = command({consent_at: '2026-10-01T09:00:00+09:00'});
  assert.equal(adapter.validateAck(receipt(time, granted()), time).ok, true, 'Equivalent instants are equal');
  assert.throws(() => adapter.validateAck(receipt(time, {...granted(), consent_at: '2026-10-02T00:00:00Z'}), time), /ACK_CONTRACT_MISMATCH/);
});

test('ACK marker and all six nested typed consent fields are mandatory', () => {
  const cmd = command(), good = receipt(cmd);
  for (const marker of [undefined, null, '', 'old-v0']) {
    assert.throws(() => adapter.validateAck({...good, contact_consent_contract: marker}, cmd), /ACK_CONTRACT_MISMATCH/);
  }
  for (const key of consentKeys) {
    const ack = plain(good); delete ack.consent[key];
    assert.throws(() => adapter.validateAck(ack, cmd), /ACK_CONTRACT_MISMATCH/, 'Missing ' + key);
  }
  for (const [key, value] of [['sms_consent', null], ['kakao_consent', 'true'], ['send_blocked', 0],
    ['consent_at', 'invalid'], ['opt_out_at', 3], ['send_blocked_reason', {}]]) {
    const ack = receipt(cmd, {...granted(), [key]: value});
    assert.throws(() => adapter.validateAck(ack, cmd), /ACK_CONTRACT_MISMATCH/, 'Invalid ' + key);
  }
  for (const consent of [null, [], true]) assert.throws(() => adapter.validateAck({...good, consent}, cmd), /ACK_CONTRACT_MISMATCH/);
});

test('ACK rejects contradictory effective states and conflicting legacy top-level flags', () => {
  const cmd = command();
  for (const state of [{...granted(), consent_at: null}, {...granted(), send_blocked: true},
    {...granted(), opt_out_at: '2026-10-02T00:00:00Z'}, {...refused(), opt_out_at: null}]) {
    assert.throws(() => adapter.validateAck(receipt(cmd, state), cmd), /ACK_CONTRACT_MISMATCH/);
  }
  assert.throws(() => adapter.validateAck(receipt(cmd, granted(), {sms_consent: false}), cmd), /ACK_CONTRACT_MISMATCH/);
});

test('contact RPC selection is separate; all other connected commands keep the common write contract', () => {
  assert.equal(adapter.toRpc(command()), 'crm_contact_command_v1');
  for (const operation of adapter.operations.filter(name => name !== 'contact_upsert')) {
    assert.equal(adapter.toRpc({operation}), 'crm_write_command_v2', operation);
  }
  assert.throws(() => adapter.toRpc({operation: 'invented'}), /OP_NOT_CONNECTED/);
});

test('contact normalization requires the transport to opt in to the exact contact storage contract', () => {
  for (const rpc of [undefined, null, '', 'crm_write_command_v2', 'crm_contact_command_v2', true, {name: CONTACT_RPC}]) {
    assert.throws(() => adapter.normalize('contact_upsert', ID, 7, payload(), rpc), /CONTACT_STORAGE_CONTRACT_REQUIRED/);
  }
  assert.equal(adapter.normalize('contact_upsert', ID, 7, payload(), CONTACT_RPC).operation, 'contact_upsert');
  assert.equal(adapter.normalize('favorite_set', ID, 0, {favorite: true}).payload.favorite, true,
    'The new contact handshake does not break unrelated existing four-argument callers');
});

for (const file of ['transport.js', 'pc-manager-transport.js']) {
  test(file + ': actual queue routes sparse contact to the new RPC, other writes to the existing RPC', async () => {
    const h = await harness(file);
    const q = h.phase.queue.enqueue('contact_upsert', ID, 7, payload(), REQUEST);
    await h.phase.queue.flush();
    assert.equal(h.phase.queue.list()[0].status, 'done');
    const sent = h.commands()[0];
    assert.equal(sent.endpoint, 'crm_contact_command_v1');
    assert.equal(sent.args.p_request_id, q.request_id);
    for (const key of consentKeys) assert.equal(has(sent.args.p_payload, key), false, key);
    assert.deepEqual(h.effective(), granted(), 'Name/phone edits preserve effective consent');
    h.phase.queue.enqueue('opportunity_work_set', ID, 8,
      {primary_work: '옥상', work_items: ['옥상'], reason: '합성 입력 확인'}, SECOND);
    await h.phase.queue.flush();
    assert.equal(h.commands()[1].endpoint, 'crm_write_command_v2');
    assert.equal(h.phase.queue.list()[1].status, 'done');
    assert.equal(h.context.Phase1.blocked.length, 0);
  });

  test(file + ': explicit consent revocation/clears reach server unchanged and require matching ACK', async () => {
    const patch = {sms_consent: false, kakao_consent: false, consent_at: null,
      opt_out_at: '2026-10-11T12:00:00+09:00', send_blocked: true, send_blocked_reason: '고객 요청'};
    const h = await harness(file);
    h.phase.queue.enqueue('contact_upsert', ID, 7, payload(patch), REQUEST);
    await h.phase.queue.flush();
    for (const key of consentKeys) assert.equal(h.commands()[0].args.p_payload[key], patch[key]);
    assert.deepEqual(h.effective(), patch);
    assert.equal(h.phase.queue.list()[0].status, 'done');
  });

  test(file + ': missing new server rejects without legacy fallback or completed queue entry', async () => {
    const h = await harness(file, {missing: true});
    h.phase.queue.enqueue('contact_upsert', ID, 7, payload(), REQUEST);
    await assert.rejects(h.phase.queue.flush(), error => error.code === 'PGRST202');
    assert.equal(h.phase.queue.list()[0].status, 'rejected');
    assert.equal(h.phase.queue.list()[0].ack, undefined);
    assert.deepEqual(h.commands().map(row => row.endpoint), ['crm_contact_command_v1']);
    assert.equal(h.mutations(), 0);
    await h.phase.queue.flush();
    assert.equal(h.commands().length, 1, 'Rejected command is not silently re-sent');
  });

  test(file + ': unmarked old receipt stays uncertain even on replay; not re-labelled locally', async () => {
    const h = await harness(file, {oldReceipt: true});
    const oldPayload = {...adapter.normalize('contact_upsert', ID, 7, payload(), CONTACT_RPC).payload,
      sms_consent: false, kakao_consent: false, consent_at: null,
      opt_out_at: null, send_blocked: false, send_blocked_reason: null};
    const oldCommand = {request_id: REQUEST, operation: 'contact_upsert', object_id: ID,
      expected_version: 7, payload: oldPayload, auth_uid: AUTH, user_id: USER, status: 'uncertain', tries: 1};
    h.phase.storage.setItem('command-queue', JSON.stringify([oldCommand]));
    for (let i = 0; i < 2; i++) await assert.rejects(h.phase.queue.flush(), /ACK_CONTRACT_MISMATCH/);
    const saved = h.phase.queue.list()[0];
    assert.equal(saved.status, 'uncertain'); assert.equal(saved.ack, undefined);
    assert.equal(saved.error, 'ACK_CONTRACT_MISMATCH');
    assert.deepEqual(plain(saved.payload), oldPayload, 'Do not turn old explicit false into new omission');
    assert.equal(has(h.receipts.get(REQUEST), 'contact_consent_contract'), false);
    assert.equal(h.mutations(), 1, 'Receipt replay cannot create another operation');
    assert.equal(h.commands()[0].body, h.commands()[1].body);
    assert(h.commands().every(row => row.endpoint === 'crm_contact_command_v1'));
  });

  test(file + ': lost ACK retries identical request ID/payload and accepts only marked replay', async () => {
    const h = await harness(file, {dropOnce: true});
    h.phase.queue.enqueue('contact_upsert', ID, 7, payload({sms_consent: false}), REQUEST);
    await assert.rejects(h.phase.queue.flush(), /SYNTHETIC_ACK_LOST/);
    assert.equal(h.phase.queue.list()[0].status, 'uncertain');
    await h.phase.queue.flush();
    const row = h.phase.queue.list()[0];
    assert.equal(row.status, 'done'); assert.equal(row.ack.replayed, true); assert.equal(row.tries, 2);
    assert.equal(row.ack.contact_consent_contract, 'preserve-omitted-v1');
    assert.equal(h.commands()[0].body, h.commands()[1].body);
    assert.equal(h.mutations(), 1);
    assert.throws(() => h.phase.queue.enqueue('contact_upsert', ID, 8, payload(), REQUEST), /LOCAL_REQUEST_ID_REUSE/);
  });

  test(file + ': wrong actor, version, or explicit consent acknowledgement never completes', async () => {
    for (const mutate of [ack => {ack.actor_auth_uid = OTHER;}, ack => {ack.actor_user_id = OTHER;},
      ack => {ack.version++;}, ack => {ack.previous_version--;}, ack => {ack.person_key = 'mobile:01099999999';},
      ack => {ack.consent.sms_consent = true;}]) {
      const h = await harness(file, {ackEdit: mutate});
      h.phase.queue.enqueue('contact_upsert', ID, 7, payload({sms_consent: false}), REQUEST);
      await assert.rejects(h.phase.queue.flush(), /ACK_CONTRACT_MISMATCH/);
      assert.equal(h.phase.queue.list()[0].status, 'uncertain');
      assert.equal(h.phase.queue.list()[0].ack, undefined);
    }
    const h = await harness(file, {conflict: true});
    h.phase.queue.enqueue('contact_upsert', ID, 7, payload(), REQUEST);
    await assert.rejects(h.phase.queue.flush(), error => error.code === 'VERSION_CONFLICT');
    assert.equal(h.phase.queue.list()[0].status, 'conflict');
    assert.equal(h.mutations(), 0);
  });

  test(file + ': identity change clears old queued consent and ignores a delayed ACK', async () => {
    let release, started;
    const gate = new Promise(resolve => {release = resolve;});
    const seen = new Promise(resolve => {started = resolve;});
    const h = await harness(file, {onCommand: async ({args}) => {
      const cmd = {...command(), request_id: args.p_request_id, payload: args.p_payload};
      started(); await gate; return response(receipt(cmd));
    }});
    h.phase.queue.enqueue('contact_upsert', ID, 7, payload(), REQUEST);
    const flushing = h.phase.queue.flush();
    await seen; await h.login(); release();
    await assert.rejects(flushing, /IDENTITY_CHANGED/);
    assert.equal(h.phase.profile.auth_uid, OTHER);
    assert.deepEqual(plain(h.phase.queue.list()), []);
    assert.equal(h.commands().length, 1);
  });

  test(file + ': wrong-owner queued receipt is rejected before issuing a contact command', async () => {
    const h = await harness(file);
    const row = h.phase.queue.enqueue('contact_upsert', ID, 7, payload(), REQUEST);
    row.auth_uid = OTHER;
    h.phase.storage.setItem('command-queue', JSON.stringify([row]));
    await assert.rejects(h.phase.queue.flush(), /QUEUE_IDENTITY_MISMATCH/);
    assert.equal(h.commands().length, 0);
    assert.equal(h.phase.queue.list()[0].status, 'pending');
  });

  test(file + ': same auth UID with stale internal user ID is blocked before sending or mutating the queue', async () => {
    const h = await harness(file);
    const row = h.phase.queue.enqueue('contact_upsert', ID, 7, payload(), REQUEST);
    row.user_id = OTHER;
    h.phase.storage.setItem('command-queue', JSON.stringify([row]));
    await assert.rejects(h.phase.queue.flush(), /QUEUE_IDENTITY_MISMATCH/);
    assert.equal(h.commands().length, 0);
    assert.equal(h.mutations(), 0);
    const after = h.phase.queue.list()[0];
    assert.equal(after.auth_uid, AUTH); assert.equal(after.user_id, OTHER);
    assert.equal(after.status, 'pending'); assert.equal(after.tries, 0); assert.equal(after.ack, undefined);
  });

  test(file + ': old four-argument enqueue with new adapter rejects before queue creation or RPC', async () => {
    const h = await harness(file, {legacyEnqueue: true});
    assert.throws(() => h.phase.queue.enqueue('contact_upsert', ID, 7, payload(), REQUEST), /CONTACT_STORAGE_CONTRACT_REQUIRED/);
    assert.deepEqual(plain(h.phase.queue.list()), []);
    assert.equal(h.commands().length, 0); assert.equal(h.mutations(), 0);
    await h.phase.queue.flush(); assert.equal(h.commands().length, 0);
  });

  test(file + ': new enqueue with old adapter lacking toRpc rejects before normalization, queue or RPC', async () => {
    const h = await harness(file, {legacyAdapter: true});
    assert.throws(() => h.phase.queue.enqueue('contact_upsert', ID, 7, payload(), REQUEST), /toRpc.*not a function/);
    assert.deepEqual(plain(h.phase.queue.list()), []);
    assert.equal(h.commands().length, 0); assert.equal(h.mutations(), 0);
    await h.phase.queue.flush(); assert.equal(h.commands().length, 0);
  });
}
