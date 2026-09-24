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
  function open() {
    if (!root.Phase1?.profile || !root.SB) return;
    if (dialog?.open) return;
    const uid = root.Phase1.profile.auth_uid;
    const previousFocus = root.document.activeElement;
    const element = root.document.createElement('dialog');
    dialog = element;
    element.className = 'account-password';
    element.setAttribute('aria-labelledby', 'account-password-title');
    element.innerHTML = '<form><h2 id="account-password-title">비밀번호 변경</h2>' +
      '<p>다른 곳에서 쓰지 않는 비밀번호를 12자 이상 입력하세요. 문자와 기호를 그대로 사용할 수 있습니다.</p>' +
      '<label for="account-password-current">현재 비밀번호</label><input id="account-password-current" type="password" autocomplete="current-password" required>' +
      '<label for="account-password-new">새 비밀번호</label><input id="account-password-new" type="password" autocomplete="new-password" required>' +
      '<label for="account-password-confirm">새 비밀번호 확인</label><input id="account-password-confirm" type="password" autocomplete="new-password" required>' +
      '<p class="account-password-status" role="status" aria-live="polite"></p>' +
      '<div class="account-password-actions"><button type="button">취소</button><button type="submit">비밀번호 변경</button></div></form>';
    const form = element.querySelector('form');
    const fields = Array.from(element.querySelectorAll('input'));
    const close = element.querySelector('button[type="button"]');
    const submit = element.querySelector('button[type="submit"]');
    const status = element.querySelector('[role="status"]');
    let busy = false;
    const clear = () => fields.forEach(field => { field.value = ''; });
    const identity = () => root.Phase1?.profile?.auth_uid;
    const invalidated = () => { clear(); element.close(); };
    element.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
    element.addEventListener('close', () => {
      clear();
      root.removeEventListener('phase1:identity-cleared', invalidated);
      element.remove();
      if (dialog === element) dialog = null;
      if (previousFocus?.isConnected) previousFocus.focus();
    }, {once: true});
    root.addEventListener('phase1:identity-cleared', invalidated);
    close.onclick = () => { if (!busy) element.close(); };
    form.onsubmit = async event => {
      event.preventDefault();
      if (busy) return;
      if (identity() !== uid) { invalidated(); return; }
      busy = true;
      close.disabled = submit.disabled = true;
      status.textContent = '변경 중입니다…';
      try {
        await change(root.SB, identity, fields[0].value, fields[1].value, fields[2].value);
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
  if (typeof module === 'object' && module.exports) module.exports = {validate, change, errorText};
  else root.CRMPassword = Object.freeze({open});
})(typeof window === 'object' ? window : globalThis);
