(function (root) {
  'use strict';
  /* 관리자 계정 관리 (2026-09-24): 관리자가 직원 비밀번호를 재설정한다.
     서버 RPC(crm_admin_reset_password_v1)가 admin permission_role을 다시 검증하고
     감사 로그를 남기며 대상의 기존 세션을 무효화한다. */
  const h = v => root.esc(String(v ?? ''));
  function isAdmin() { return root.Phase1?.profile?.permission_role === 'admin'; }
  function validate(password, confirmation) {
    if (typeof password !== 'string' || Array.from(password).length < 8) throw Error('PASSWORD_SHORT');
    if (Array.from(password).length > 72) throw Error('PASSWORD_LONG');
    if (password !== confirmation) throw Error('PASSWORD_MISMATCH');
  }
  const messages = {
    PASSWORD_SHORT: '임시 비밀번호를 8자 이상으로 입력해 주세요.',
    PASSWORD_LONG: '비밀번호는 72자 이하여야 합니다.',
    PASSWORD_MISMATCH: '확인 입력이 일치하지 않습니다.',
    forbidden: '관리자 권한이 확인되지 않습니다.',
    'invalid new password': '임시 비밀번호는 8~72자여야 합니다.',
    'target not eligible': '이 계정은 재설정 대상이 아닙니다(비활성 또는 로그인 미연결).',
    'use self password change': '본인 비밀번호는 상단 "비밀번호 변경"에서 바꿔 주세요.'
  };
  const errorText = e => messages[e?.message] || messages[e?.code] || '재설정 완료를 확인하지 못했습니다. 다시 시도해 주세요.';
  let dialog;
  function rowHtml(x) {
    const meta = [x.role, x.email || '로그인 미연결', x.last_sign_in_at ? '마지막 로그인 ' + String(x.last_sign_in_at).slice(0, 10) : '로그인 기록 없음'];
    const able = x.linked && x.active && !x.self;
    return '<div class="aa-row" data-user="' + h(x.user_id) + '" data-name="' + h(x.name) + '">' +
      '<div class="aa-who"><b>' + h(x.name) + (x.self ? ' (본인)' : '') + (x.active ? '' : ' · 비활성') + '</b><small>' + meta.map(h).join(' · ') + '</small></div>' +
      (able ? '<button type="button" data-aa-open>비밀번호 재설정</button>' : '<span class="aa-na">' + (x.self ? '본인은 비밀번호 변경 사용' : '재설정 불가') + '</span>') +
      '<form class="aa-form" hidden><input type="password" autocomplete="new-password" placeholder="임시 비밀번호 (8자 이상)" aria-label="' + h(x.name) + ' 임시 비밀번호"><input type="password" autocomplete="new-password" placeholder="확인" aria-label="' + h(x.name) + ' 임시 비밀번호 확인"><button type="submit">저장</button><button type="button" data-aa-cancel>취소</button></form>' +
      '<p class="aa-status" role="status" aria-live="polite"></p></div>';
  }
  async function open() {
    if (!isAdmin() || !root.Phase1 || dialog?.open) return;
    const previousFocus = root.document.activeElement;
    const element = root.document.createElement('dialog');
    dialog = element;
    element.className = 'account-password account-admin';
    element.setAttribute('aria-labelledby', 'account-admin-title');
    element.innerHTML = '<div class="aa-box"><header><h2 id="account-admin-title">직원 계정 관리</h2><button type="button" data-aa-close>닫기</button></header>' +
      '<p>임시 비밀번호를 지정하면 해당 직원의 기존 로그인은 즉시 해제됩니다. 재설정 이력은 서버에 기록되며, 직원에게 로그인 후 "비밀번호 변경"으로 본인 비밀번호를 바꾸도록 안내하세요.</p>' +
      '<div class="aa-list"><p class="aa-status">계정 목록을 불러오는 중…</p></div></div>';
    const invalidated = () => element.close();
    element.addEventListener('close', () => {
      root.removeEventListener('phase1:identity-cleared', invalidated);
      element.remove();
      if (dialog === element) dialog = null;
      if (previousFocus?.isConnected) previousFocus.focus();
    }, { once: true });
    root.addEventListener('phase1:identity-cleared', invalidated);
    root.document.body.appendChild(element);
    element.showModal();
    element.querySelector('[data-aa-close]').onclick = () => element.close();
    const list = element.querySelector('.aa-list');
    try {
      const result = await root.Phase1.rpc('crm_admin_list_accounts_v1');
      if (!result?.ok || result.policy !== 'admin-accounts-v1' || !Array.isArray(result.items)) throw Error('CONTRACT');
      list.innerHTML = result.items.map(rowHtml).join('') || '<p class="aa-status">계정이 없습니다.</p>';
    } catch (e) {
      list.innerHTML = '<p class="aa-status">' + h(errorText(e)) + '</p>';
      return;
    }
    list.onclick = e => {
      const openBtn = e.target.closest('[data-aa-open]');
      if (openBtn) { const row = openBtn.closest('.aa-row'); row.querySelector('.aa-form').hidden = false; openBtn.hidden = true; row.querySelector('input').focus(); }
      const cancel = e.target.closest('[data-aa-cancel]');
      if (cancel) { const row = cancel.closest('.aa-row'); const form = row.querySelector('.aa-form'); form.hidden = true; form.querySelectorAll('input').forEach(i => { i.value = ''; }); row.querySelector('[data-aa-open]').hidden = false; row.querySelector('.aa-status').textContent = ''; }
    };
    list.querySelectorAll('.aa-form').forEach(form => {
      form.onsubmit = async e => {
        e.preventDefault();
        if (!isAdmin()) { element.close(); return; }
        const row = form.closest('.aa-row'), status = row.querySelector('.aa-status'), fields = form.querySelectorAll('input'), submit = form.querySelector('[type="submit"]');
        try {
          validate(fields[0].value, fields[1].value);
          submit.disabled = true; status.textContent = '재설정 중입니다…';
          const ack = await root.Phase1.rpc('crm_admin_reset_password_v1', { p_target_user_id: row.dataset.user, p_new_password: fields[0].value });
          if (!ack?.ok || ack.policy !== 'admin-password-reset-v1' || String(ack.target_user_id) !== row.dataset.user) throw Error('CONTRACT');
          status.textContent = row.dataset.name + ' 비밀번호를 재설정했습니다. 기존 로그인은 해제되었습니다.';
          form.hidden = true;
        } catch (err) {
          status.textContent = errorText(err);
        } finally {
          fields.forEach(f => { f.value = ''; });
          submit.disabled = false;
        }
      };
    });
  }
  if (typeof module === 'object' && module.exports) module.exports = { validate, errorText };
  else root.AccountAdmin = Object.freeze({ open, isAdmin });
})(typeof window === 'object' ? window : globalThis);
