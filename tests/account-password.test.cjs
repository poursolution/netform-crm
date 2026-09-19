'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {change, validate, errorText} = require('../account-password.js');
const old = 'old-password-example';
const next = '  New passphrase!  ';
function fixture() {
  const calls = [];
  let uid = 'test-user';
  const client = {auth: {
    async getUser() {return {data: {user: {id: uid}}};},
    async updateUser(data) {calls.push(data); return {data: {user: {id: uid}}};}
  }};
  return {client, calls, identity: () => uid, switchUser: () => {uid = 'other-user';}};
}
test('password change preserves spaces, symbols, and current password', async () => {
  const f = fixture();
  assert.equal(await change(f.client, f.identity, old, next, next), true);
  assert.deepEqual(f.calls, [{password: next, current_password: old}]);
});
test('reject invalid input before any authentication request', async () => {
  const f = fixture();
  f.client.auth.getUser = () => {throw Error('must not call');};
  for (const [current, password, confirmation, message] of [
    ['', next, next, 'CURRENT_REQUIRED'], [old, 'short', 'short', 'PASSWORD_SHORT'],
    [old, '010-1234-5678', '010-1234-5678', 'PASSWORD_PHONE'],
    [old, old, old, 'PASSWORD_UNCHANGED'], [old, next, next.trim(), 'PASSWORD_MISMATCH']
  ]) await assert.rejects(change(f.client, f.identity, current, password, confirmation), {message});
  assert.equal(f.calls.length, 0);
});
test('reject absent session, revoked session, and wrong account', async () => {
  const f = fixture();
  await assert.rejects(change(f.client, () => null, old, next, next), /AUTH_REQUIRED/);
  f.client.auth.getUser = async () => ({error: {code: 'session_not_found'}});
  await assert.rejects(change(f.client, f.identity, old, next, next), /AUTH_REQUIRED/);
  f.client.auth.getUser = async () => ({data: {user: {id: 'someone-else'}}});
  await assert.rejects(change(f.client, f.identity, old, next, next), /AUTH_REQUIRED/);
  assert.equal(f.calls.length, 0);
});
test('account switch during verification prevents password mutation', async () => {
  const f = fixture();
  f.client.auth.getUser = async () => {f.switchUser(); return {data: {user: {id: 'test-user'}}};};
  await assert.rejects(change(f.client, f.identity, old, next, next), /AUTH_REQUIRED/);
  assert.equal(f.calls.length, 0);
});
test('server rejection never reports success or exposes raw server details', async () => {
  const f = fixture();
  f.client.auth.updateUser = async () => ({error: {code: 'weak_password', message: 'private payload'}});
  await assert.rejects(change(f.client, f.identity, old, next, next), e => e.code === 'weak_password');
  assert.match(errorText({code: 'weak_password'}), /보안 기준/);
  assert.doesNotMatch(errorText({message: 'private payload'}), /private payload/);
});
test('reject mismatched acknowledgement and identity switch after request', async () => {
  const f = fixture();
  f.client.auth.updateUser = async () => ({data: {user: {id: 'wrong-user'}}});
  await assert.rejects(change(f.client, f.identity, old, next, next), /IDENTITY_CHANGED/);
  f.client.auth.updateUser = async () => {f.switchUser(); return {data: {user: {id: 'test-user'}}};};
  await assert.rejects(change(f.client, f.identity, old, next, next), /IDENTITY_CHANGED/);
});
