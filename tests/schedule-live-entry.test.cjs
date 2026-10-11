'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const install = require('./pc-inquiry-fixture.cjs');
const schedule = require('../schedule-contract.js');
const response = require('../inquiry-response-contract.js');
const flow = require('../inquiry-schedule-flow.js');
const save = require('../pc-inquiry-save.js');
const ContactEntry = require('../contact-entry.js');
const modules = ['schedule-contract', 'schedule-flow', 'inquiry-schedule-flow', 'inquiry-response-contract', 'pc-inquiry-save', 'contact-entry'];

function entry(file) {
  const html = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].map(m => ({attrs: m[1], body: m[2]}));
  const activation = scripts.filter(s => /\bCRM_SCHEDULE_V1\s*=/.test(s.body));
  assert.equal(activation.length, 1, `${file}: one explicit activation`);
  assert.equal(activation[0].body.trim(), 'window.CRM_SCHEDULE_V1=true;');
  const position = scripts.indexOf(activation[0]);
  assert.match(scripts[position + 1].attrs, /src="\.\/schedule-contract\.js\?v=schedule-live1"/);
  for (const name of modules) {
    const references = scripts.filter(s => s.attrs.includes(`./${name}.js?`));
    assert.equal(references.length, 1, `${file}: one ${name} dependency`);
    assert(references[0].attrs.includes(`./${name}.js?v=schedule-live1"`), `${file}: refreshed ${name}`);
    assert(scripts.indexOf(references[0]) > position, `${file}: activation precedes ${name}`);
  }
  return activation[0].body;
}

function setup(file, listPatch) {
  const root = {crypto, addEventListener() {}}, id = crypto.randomUUID();
  const f = install(root, id), records = new Map();
  // The fixture must not provide activation: execute the actual production entry configuration.
  delete root.CRM_SCHEDULE_V1;
  vm.runInNewContext(entry(file), {window: root});
  const rpc = root.Phase1.rpc;
  root.Phase1.rpc = async (name, args) => {
    const result = await rpc(name, args);
    return name === 'crm_schedule_list_v1' && listPatch ? {...result, ...listPatch} : result;
  };
  const owner = () => `${root.Phase1.profile.auth_uid}:${root.Phase1.profile.user_id}`;
  root.MobileSaveJournal = {
    session: () => 'test-session', assertSession: s => assert.equal(s, 'test-session'),
    owner, assertOwner: value => assert.equal(value, owner()),
    read: (kind, key) => records.has(key) ? structuredClone(records.get(key)) : null,
    write: (kind, key, value) => records.set(key, structuredClone(value)),
    drop: (kind, key) => records.delete(key)
  };
  root.InquiryFlow = {
    kindOf: result => ['부재', '번호오류'].includes(result) ? 'attempt' : ['연결됨', '고객 회신'].includes(result) ? 'connected' : '',
    take() {}
  };
  root.InquiryCommand = {needsProgress: q => q.status === '배정완료'};
  root.itemPatch = () => ({});
  root.saveLocal = () => {};
  root.ScheduleContract = schedule(root);
  root.InquiryResponseContract = response(root);
  root.InquiryScheduleFlow = flow(root);
  root.PCInquirySave = save(root);
  const q = {id, status: '배정완료', raw: {}};
  const row = {id: crypto.randomUUID(), inquiry_id: id, title: '기존 방문', action_type: '방문', due_on: '2026-11-20', due_at: '2026-11-20T00:00:00+09:00', status: 'open', date_basis: 'internal_plan', completed_at: null};
  f.rows.push(row);
  q.nextActionObj = {id: row.id, text: row.title, due: row.due_on, type: row.action_type, date_basis: row.date_basis};
  const existing = root.PCInquirySave.existing(q);
  const form = {ch: '전화', res: '연결됨', memo: '이번에 확인한 내용', mode: 'keep'};
  const plan = ContactEntry.plan(form, {existing, today: '2026-10-11', scheduleV1: true});
  assert.equal(plan.ok, true, plan.error);
  const options = {plan, existing, ch: form.ch, result: form.res, contact_result: form.res, text: form.memo};
  return {f, root, q, row, records, options, form, run: () => root.PCInquirySave.save(q, options, form, file === 'mobile.html' ? 'mobile-d' : 'detail')};
}

for (const file of ['crm.html', 'mobile.html']) {
  test(`${file}: explicit activation reaches shared save without replacing or completing existing work`, async () => {
    const {f, root, q, row, records, run} = setup(file), before = structuredClone(row);
    assert.equal(root.ScheduleContract.enabled(), true);
    assert.equal(await run(), true);
    assert.equal(f.logs.size, 1);
    assert.equal(f.responses.size, 1);
    assert.equal(f.schedules.size, 0);
    assert.deepEqual(f.rows, [before]);
    assert.equal(q.nextActionObj.id, row.id);
    assert.equal(q.status, '전화응대 완료');
    assert.equal(records.size, 0);
  });
  for (const field of ['enabled', 'writable']) {
    test(`${file}: ${field}=false from server blocks contact and schedule despite permissive release metadata`, async () => {
      const {f, root, q, run} = setup(file, {[field]: false});
      assert.equal(root.ScheduleContract.enabled(), true);
      await assert.rejects(run);
      assert(f.calls.length > 0);
      assert(f.calls.every(x => x.name === 'crm_schedule_list_v1'));
      assert.equal(f.logs.size, 0);
      assert.equal(f.responses.size, 0);
      assert.equal(f.schedules.size, 0);
      assert.equal(q.status, '배정완료');
    });
  }
  test(`${file}: wrong actor or target read evidence blocks writes`, async () => {
    for (const field of ['actor_auth_uid', 'target_id']) {
      const {f, q, run} = setup(file, {[field]: crypto.randomUUID()});
      await assert.rejects(run);
      assert(f.calls.every(x => x.name === 'crm_schedule_list_v1'));
      assert.equal(f.logs.size, 0);
      assert.equal(q.status, '배정완료');
    }
  });
  test(`${file}: later flag off or missing release capability remains fail closed`, async () => {
    for (const condition of ['flag', 'capability']) {
      const {f, root, run} = setup(file);
      if (condition === 'flag') root.CRM_SCHEDULE_V1 = false;
      else root.CRMRelease.has = () => false;
      await assert.rejects(run, /서버 저장 연결/);
      assert.equal(f.calls.length, 0);
    }
  });
  test(`${file}: unverified contact ACK cannot update status, schedule or erase input`, async () => {
    const {f, q, row, records, run} = setup(file), before = structuredClone(row);
    f.badAck = true;
    await assert.rejects(run, /저장 근거/);
    assert.equal(f.responses.size, 0);
    assert.equal(f.schedules.size, 0);
    assert.deepEqual(f.rows, [before]);
    assert.equal(q.status, '배정완료');
    assert.equal(records.size, 1);
  });
}
