(function (root) {
  'use strict';
  function validate(current, password, confirmation) {
    if (!current) throw Error('CURRENT_REQUIRED');
    if (typeof password !== 'string' || Array.from(password).length < 12) throw Error('PASSWORD_SHORT');
    if (/^[+\d\s()-]+$/.test(password)) throw Error('PASSWORD_PHONE');
    if (password === current) throw Error('PASSWORD_UNCHANGED');
    if (password !== confirmation) throw Error('PASSWORD_MISMATCH');
  }
  async function change(client, identity, current, password, confirmation) {
    validate(current, password, confirmation);
    const uid = identity();
    if (!uid) throw Error('AUTH_REQUIRED');
    const verified = await client.auth.getUser();
    if (verified.error || verified.data?.user?.id !== uid || identity() !== uid) throw Error('AUTH_REQUIRED');
    const result = await client.auth.updateUser({password, current_password: current});
    if (result.error) throw result.error;
    if (identity() !== uid || result.data?.user?.id !== uid) throw Error('IDENTITY_CHANGED');
    return true;
  }
  const messages = {
    CURRENT_REQUIRED: '현재 비밀번호를 입력해 주세요.',
    PASSWORD_SHORT: '새 비밀번호를 12자 이상으로 입력해 주세요.',
    PASSWORD_PHONE: '휴대폰 번호나 숫자만으로 된 비밀번호는 사용할 수 없습니다.',
    PASSWORD_UNCHANGED: '현재 비밀번호와 다른 비밀번호를 입력해 주세요.',
    PASSWORD_MISMATCH: '새 비밀번호와 확인 입력이 일치하지 않습니다.',
    AUTH_REQUIRED: '로그인 상태를 확인할 수 없습니다. 다시 로그인한 후 시도해 주세요.',
    IDENTITY_CHANGED: '로그인 계정이 바뀌었습니다. 현재 계정으로 다시 확인해 주세요.',
    weak_password: '서버의 비밀번호 보안 기준을 충족하지 않습니다. 더 긴 비밀번호를 사용해 주세요.',
    same_password: '현재 비밀번호와 다른 비밀번호를 입력해 주세요.',
    invalid_credentials: '현재 비밀번호를 확인해 주세요.',
    invalid_current_password: '현재 비밀번호를 확인해 주세요.',
    reauthentication_needed: '본인 확인을 위해 로그아웃 후 다시 로그인하고 변경해 주세요.',
    reauthentication_not_valid: '본인 확인을 위해 로그아웃 후 다시 로그인하고 변경해 주세요.',
    over_request_rate_limit: '요청이 많습니다. 잠시 후 다시 시도해 주세요.'
  };
  function errorText(error) {
    return messages[error?.code] || messages[error?.message] || '변경 완료를 확인하지 못했습니다. 입력값을 확인하고 다시 시도해 주세요.';
  }
  let dialog;
  /* 강제 모드(2026-10-05 직원 계정 관리 v2): 관리자가 내준 임시 비밀번호로 로그인한 계정은 본인 비밀번호로 바꿔야 창이 닫힌다.
     서버(crm_my_credential_state_v1)가 '바꿔야 함' 표시를 들고 있고, 실제로 비밀번호가 바뀐 뒤에만 풀어 준다. */
  function open(options) {
    if (!root.Phase1?.profile || !root.SB) return;
    if (dialog?.open) return;
    const force = !!(options && options.force === true);
    let changed = false;
    const uid = root.Phase1.profile.auth_uid;
    const previousFocus = root.document.activeElement;
    const element = root.document.createElement('dialog');
    dialog = element;
    element.className = 'account-password' + (force ? ' account-password-force' : '');
    element.setAttribute('aria-labelledby', 'account-password-title');
    element.innerHTML = '<form><h2 id="account-password-title">' + (force ? '비밀번호를 먼저 바꿔 주세요' : '비밀번호 변경') + '</h2>' +
      (force ? '<p>임시 비밀번호로 로그인했습니다. 계속 쓰려면 지금 본인 비밀번호로 바꿔 주세요. 현재 비밀번호 칸에는 받은 임시 비밀번호를 넣고, 새 비밀번호는 다른 곳에서 쓰지 않는 12자 이상으로 정합니다.</p>'
        : '<p>다른 곳에서 쓰지 않는 비밀번호를 12자 이상 입력하세요. 문자와 기호를 그대로 사용할 수 있습니다.</p>') +
      '<label for="account-password-current">현재 비밀번호</label><input id="account-password-current" type="password" autocomplete="current-password" required>' +
      '<label for="account-password-new">새 비밀번호</label><input id="account-password-new" type="password" autocomplete="new-password" required>' +
      '<label for="account-password-confirm">새 비밀번호 확인</label><input id="account-password-confirm" type="password" autocomplete="new-password" required>' +
      '<p class="account-password-status" role="status" aria-live="polite"></p>' +
      '<div class="account-password-actions"><button type="button">' + (force ? '로그아웃' : '취소') + '</button><button type="submit">비밀번호 변경</button></div></form>';
    const form = element.querySelector('form');
    const fields = Array.from(element.querySelectorAll('input'));
    const close = element.querySelector('button[type="button"]');
    const submit = element.querySelector('button[type="submit"]');
    const status = element.querySelector('[role="status"]');
    let busy = false;
    const clear = () => fields.forEach(field => { field.value = ''; });
    const identity = () => root.Phase1?.profile?.auth_uid;
    const invalidated = () => { clear(); element.close(); };
    element.addEventListener('cancel', event => { if (busy || (force && !changed)) event.preventDefault(); });
    element.addEventListener('close', () => {
      clear();
      root.removeEventListener('phase1:identity-cleared', invalidated);
      element.remove();
      if (dialog === element) dialog = null;
      if (previousFocus?.isConnected) previousFocus.focus();
    }, {once: true});
    root.addEventListener('phase1:identity-cleared', invalidated);
    close.onclick = () => {
      if (busy) return;
      /* 강제 모드에서 바꾸지 않고 나가는 길은 로그아웃뿐 */
      if (force && !changed) { if (typeof root.authSignOut === 'function') root.authSignOut(); else if (typeof root.doSignOut === 'function') root.doSignOut(); else element.close(); return; }
      element.close();
    };
    form.onsubmit = async event => {
      event.preventDefault();
      if (busy) return;
      if (identity() !== uid) { invalidated(); return; }
      busy = true;
      close.disabled = submit.disabled = true;
      status.textContent = '변경 중입니다…';
      try {
        await change(root.SB, identity, fields[0].value, fields[1].value, fields[2].value);
        changed = true;
        if (force) { try { await root.Phase1.rpc('crm_my_credential_state_v1'); } catch (ignore) { /* 다음 로그인 때 서버가 다시 확인해 푼다 */ } }
        if (!element.open) return;
        status.textContent = '비밀번호를 변경했습니다. 다음 로그인부터 새 비밀번호를 사용하세요.';
        fields.forEach(field => { field.disabled = true; });
        submit.hidden = true;
        close.textContent = '닫기';
      } catch (error) {
        if (element.open) status.textContent = errorText(error);
      } finally {
        clear();
        busy = false;
        close.disabled = false;
        submit.disabled = false;
      }
    };
    root.document.body.appendChild(element);
    element.showModal();
    fields[0].focus();
  }
  /* 로그인 직후: 임시 비밀번호를 아직 쓰고 있으면 변경 창을 강제로 띄운다(서버 함수가 없으면 조용히 넘어간다) */
  async function checkForced() {
    try {
      if (!root.Phase1?.profile || typeof root.Phase1.rpc !== 'function' || !root.SB) return;
      const state = await root.Phase1.rpc('crm_my_credential_state_v1');
      if (state?.ok === true && state.must_change === true) open({force: true});
    } catch (ignore) { /* 미설치 · 통신 실패는 로그인 흐름을 막지 않는다 */ }
  }
  if (typeof module === 'object' && module.exports) module.exports = {validate, change, errorText};
  else {
    root.CRMPassword = Object.freeze({open, checkForced});
    if (typeof root.addEventListener === 'function') root.addEventListener('phase1:profile', () => { root.setTimeout(checkForced, 600); });
    if (root.Phase1?.profile) root.setTimeout(checkForced, 600);
  }
})(typeof window === 'object' ? window : globalThis);
