(function (root) {
  'use strict';
  /* 관리자 계정 관리 (2026-09-24): 관리자가 직원 비밀번호를 재설정한다.
     서버 RPC(crm_admin_reset_password_v1)가 admin permission_role을 다시 검증하고
     감사 로그를 남기며 대상의 기존 세션을 무효화한다.
     v2 (2026-10-05 design_handoff_accounts): 가운데 창 · 역할 알약 · 한 줄 표 · [+ 계정 추가] · 미연결 [계정 연결] ·
     재설정 확인 → 임시 비밀번호(화면이 만들어 한 번만 보여 준다) · [···] 비활성화. 끄기: G.accountAdminV2Off=true → 예전 창.
     계정 추가 · 연결 · 비활성화는 서버 함수(sql/admin-accounts-v2-20261005.sql)가 설치된 뒤에만 열린다. */
  const h = v => (root.esc ? root.esc(String(v ?? '')) : String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  function isAdmin() { return root.Phase1?.profile?.permission_role === 'admin'; }
  function validate(password, confirmation) {
    if (typeof password !== 'string' || Array.from(password).length < 8) throw Error('PASSWORD_SHORT');
    if (Array.from(password).length > 72) throw Error('PASSWORD_LONG');
    /* 휴대폰 번호 모양(숫자만)은 임시 비밀번호로도 막는다(2026-10-01 컨설턴트 P0-6 — 직원 다수가 임시 번호를 그대로 쓰고 있었다) */
    if (/^[+\d\s()-]+$/.test(password)) throw Error('PASSWORD_PHONE');
    if (password !== confirmation) throw Error('PASSWORD_MISMATCH');
  }
  const messages = {
    PASSWORD_SHORT: '임시 비밀번호를 8자 이상으로 입력해 주세요.',
    PASSWORD_PHONE: '전화번호처럼 숫자만으로 된 비밀번호는 쓸 수 없습니다. 글자를 섞어 주세요.',
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
  /* 예전 창(끄기 스위치 뒤) */
  async function openV1() {
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

  /* ── v2: 시안(직원 계정 관리 v2.dc.html) 그대로 ── */
  const RL = { admin: '관리자', rep: '영업사원', dual: '대표 · 겸직', lead: '팀장', branch: '지사', b2b: 'B2B' };
  const AV = ['#15171c', '#7048e8', '#3b6ce4', '#1f9d55', '#e8590c', '#9aa0ab'];
  const TABS = [['all', '전체'], ['admin', '관리자'], ['dual', '대표 · 겸직'], ['rep', '영업 · 팀장'], ['branch', '지사']];
  const KINDS = [['rep', '영업사원'], ['lead', '팀장'], ['branch', '지사'], ['admin', '관리자'], ['dual', '대표 · 겸직']];
  const TEAMS = ['본사 영업', '경남지사', 'B2B'];
  const NOT_YET = '서버 적용 뒤에 열립니다';
  const messages2 = {
    'invalid payload': '이름 · 이메일 · 역할을 확인해 주세요.',
    'email already used': '이미 쓰고 있는 이메일입니다.',
    'name already used': '같은 이름의 직원이 이미 있습니다. 퇴사자라면 아래 비활성 목록에서 다시 활성화해 주세요.',
    'cannot change own account': '본인 계정은 여기서 바꿀 수 없습니다.',
    NAME_REQUIRED: '이름을 입력해 주세요.',
    EMAIL_INVALID: '이메일 주소를 확인해 주세요.',
    CRYPTO: '이 브라우저에서는 임시 비밀번호를 만들 수 없습니다.',
    CONTRACT_UNAVAILABLE: NOT_YET + '.', PGRST202: NOT_YET + '.'
  };
  const errorText2 = (e, ctx) => (ctx === 'create' && e?.message === 'target not eligible' ? '이미 로그인이 연결됐거나 비활성인 직원입니다.' : '') ||
    messages2[e?.message] || messages2[e?.code] || messages[e?.message] || messages[e?.code] ||
    (ctx === 'load' ? '계정 목록을 불러오지 못했습니다. 창을 닫고 다시 열어 주세요.' : '완료를 확인하지 못했습니다. 다시 시도해 주세요.');
  /* 임시 비밀번호: 화면에서 무작위로 만든다(헷갈리는 0 O 1 I L 제외) — 서버에는 해시만 남고, 이 창을 닫으면 다시 볼 수 없다 */
  function tempPassword() {
    const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', c = root.crypto;
    if (!c || typeof c.getRandomValues !== 'function') throw Error('CRYPTO');
    const out = [];
    while (out.length < 8) { const b = c.getRandomValues(new Uint8Array(16)); for (let i = 0; i < b.length && out.length < 8; i++) if (b[i] < 248) out.push(A[b[i] % 31]); }
    return 'NF-' + out.slice(0, 4).join('') + '-' + out.slice(4).join('');
  }
  const b2bOwner = () => { try { return (root.InquiryB2BTab && root.InquiryB2BTab.OWNER) || '조재연'; } catch (e) { return '조재연'; } };
  const prof = n => { try { return (typeof root.repProfile === 'function' && root.repProfile(n)) || {}; } catch (e) { return {}; } };
  const loginMail = n => { try { return root.Phase1?.loginEmail?.(n) || ''; } catch (e) { return ''; } };
  /* 역할 꼬리표 · 소속: 서버에 적어 둔 값(계정 추가 때 고른 것)이 먼저, 없으면 화면 인원 명단에서 */
  function kindOf(x) {
    if (x.kind && RL[x.kind]) return x.kind === 'rep' && /B2B/i.test(x.team || '') ? 'b2b' : x.kind;
    if (x.role === 'admin') return 'admin';
    if (x.role === 'dual') return 'dual';
    const p = prof(x.name);
    if (x.permission_role === 'branch' || p.team === 'gyeongnam') return 'branch';
    if (x.name === b2bOwner()) return 'b2b';
    if (p.title === '팀장') return 'lead';
    return 'rep';
  }
  function teamOf(x) {
    if (x.active === false) return '비활성';
    if (x.team) return x.team;
    const p = prof(x.name), t = p.title || '';
    if (x.name === b2bOwner()) return 'B2B팀 · 협약문의';
    if (p.team === 'gyeongnam') return '경남지사';
    if (p.role === 'ceo') return t || '대표';
    if (p.role === 'operations') return t || '영업관리';
    if (p.team === 'head_office') return '본사 영업' + (t && t !== '본사영업' ? ' · ' + t : '');
    return '';
  }
  function ymd(v) { const d = new Date(v); return isNaN(d) ? '' : d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate(); }
  let dialog2;
  async function openV2() {
    if (!isAdmin() || !root.Phase1 || dialog2?.open) return;
    const doc = root.document, previousFocus = doc.activeElement, el = doc.createElement('dialog');
    dialog2 = el;
    el.className = 'aa2';
    el.setAttribute('aria-labelledby', 'aa2-title');
    const S = { items: [], loaded: false, err: '', server2: false, role: 'all', q: '', open: null, stage: null, rowErr: '', adding: false, link: null, form: { name: '', email: '', kind: 'rep', team: TEAMS[0] }, formErr: '', busy: false, temps: {}, fresh: {}, showOff: false };
    el.innerHTML = '<header class="aa2-head"><div class="aa2-h1"><b id="aa2-title">직원 계정 관리</b><span class="aa2-count" data-aa2-count></span><i class="aa2-sp"></i><button type="button" class="aa2-btn aa2-dark aa2-addbtn" data-aa2="add">+ 계정 추가</button><button type="button" class="aa2-x" data-aa2="close" aria-label="닫기">×</button></div>' +
      '<div class="aa2-h2"><div class="aa2-tabs" data-aa2-tabs></div><i class="aa2-sp"></i><input type="search" class="aa2-search" data-aa2-search placeholder="이름 · 이메일 검색" aria-label="이름 · 이메일 검색" autocomplete="off"></div></header>' +
      '<div class="aa2-add" data-aa2-addbox hidden></div>' +
      '<div class="aa2-cols aa2-thead"><span>이름</span><span>역할</span><span>로그인 이메일</span><span>마지막 로그인</span><span></span></div>' +
      '<div class="aa2-list" data-aa2-list></div><div class="aa2-foot" data-aa2-foot></div>';
    const $ = q => el.querySelector(q);
    const can = name => S.server2 && (!root.CRMRelease || root.CRMRelease.has(name));
    const active = () => S.items.filter(x => x.active !== false);
    const pool = () => (S.showOff ? S.items : active());
    const match = (x, k) => { const kind = kindOf(x); return k === 'all' || kind === k || (k === 'rep' && kind === 'lead'); };
    const find = id => S.items.find(x => String(x.user_id) === String(id));
    const closeRow = () => { S.open = null; S.stage = null; S.rowErr = ''; };
    const btn = (act, label, cls, off) => '<button type="button" class="aa2-btn' + (cls || '') + '" data-aa2="' + act + '"' + (off ? ' disabled title="' + NOT_YET + '"' : '') + '>' + label + '</button>';
    const acts = (yes, label, red) => '<div class="aa2-pacts"><button type="button" class="aa2-btn" data-aa2="cancel">취소</button><button type="button" class="aa2-btn ' + (red ? 'aa2-red' : 'aa2-dark') + '" data-aa2="' + yes + '"' + (S.busy ? ' disabled' : '') + '>' + label + '</button></div>';
    function panel(x) {
      const id = String(x.user_id), n = '<b>' + h(x.name) + '</b>';
      let body = '';
      if (S.stage === 'confirm') body = '<span class="aa2-ptxt">' + n + '의 지금 로그인이 바로 끊기고 임시 비밀번호가 만들어집니다. 재설정 이력은 서버에 남습니다.</span>' + acts('doReset', '재설정하기', true);
      else if (S.stage === 'issued') {
        const mapped = loginMail(x.name);
        body = '<div class="aa2-issued"><span class="aa2-plabel">임시 비밀번호</span><b class="aa2-pw" data-aa2-pw>' + h(S.temps[id] || '') + '</b><button type="button" class="aa2-btn" data-aa2="copy">복사</button><i class="aa2-sp"></i><button type="button" class="aa2-link" data-aa2="cancel">닫기</button></div>' +
          '<span class="aa2-pnote">이 창을 닫으면 다시 볼 수 없습니다 · 직원에게 전달하고 로그인 후 \'비밀번호 변경\'을 안내하세요</span>' +
          (x.email && mapped !== x.email ? '<span class="aa2-pnote" data-aa2-loginhint>로그인 화면의 이름 칸에 이메일 <b>' + h(x.email) + '</b> 을 넣어 로그인합니다</span>' : '');
      } else if (S.stage === 'off') body = '<span class="aa2-ptxt">' + n + ' 계정을 비활성화합니다. 지금 로그인이 바로 끊기고 다시 로그인할 수 없습니다. 기록과 실적 귀속은 그대로 남습니다(삭제하지 않음).</span>' + acts('doOff', '비활성화', true);
      else if (S.stage === 'on') body = '<span class="aa2-ptxt">' + n + ' 계정을 다시 활성화합니다. ' + (x.linked ? '로그인을 다시 쓸 수 있게 됩니다.' : '로그인은 [계정 연결] 뒤에 쓸 수 있습니다.') + '</span>' + acts('doOn', '다시 활성화', false);
      return '<div class="aa2-panel">' + body + (S.rowErr ? '<span class="aa2-err" role="alert">' + h(S.rowErr) + '</span>' : '') + '</div>';
    }
    function rowHtml2(x, i) {
      const id = String(x.user_id), k = kindOf(x), off = x.active === false, op = S.open === id, team = teamOf(x);
      const last = x.last_sign_in_at ? ymd(x.last_sign_in_at) : (S.fresh[id] ? '방금 만듦 · 첫 로그인 전' : '로그인 기록 없음');
      let act;
      if (x.self) act = '<span class="aa2-na">본인은 비밀번호 변경 사용</span>';
      else if (off) act = btn('on', '다시 활성화', '', !can('crm_admin_set_active_v1'));
      else if (!x.linked) act = btn('link', '계정 연결', ' aa2-dark', !can('crm_admin_create_account_v1'));
      else if (S.temps[id]) act = btn('show', '임시 비밀번호 보기');
      else act = btn('reset', '비밀번호 재설정');
      const more = x.self || off ? '' : '<button type="button" class="aa2-more" data-aa2="more" aria-label="' + h(x.name) + ' 비활성화"' + (can('crm_admin_set_active_v1') ? ' title="비활성화"' : ' disabled title="' + NOT_YET + '"') + '>···</button>';
      return '<div class="aa2-item' + (off ? ' off' : '') + '" data-id="' + h(id) + '"><div class="aa2-cols aa2-row' + (op ? ' open' : '') + '">' +
        '<div class="aa2-who"><span class="aa2-av" style="background:' + AV[i % AV.length] + '">' + h(Array.from(String(x.name || '?'))[0]) + '</span><div><b>' + h(x.name) + '</b>' + (team ? '<span>' + h(team) + '</span>' : '') + '</div></div>' +
        '<span class="aa2-tag aa2-k-' + k + '">' + RL[k] + '</span>' +
        '<span class="aa2-mail' + (x.email ? '' : ' none') + '">' + h(x.email || '로그인 미연결') + '</span>' +
        '<span class="aa2-last' + (x.last_sign_in_at ? '' : ' none') + '">' + h(last) + '</span>' +
        '<div class="aa2-act">' + act + more + '</div></div>' + (op ? panel(x) : '') + '</div>';
    }
    function drawList() {
      const box = $('[data-aa2-list]');
      if (!S.loaded) { box.innerHTML = '<p class="aa2-msg">' + h(S.err || '계정 목록을 불러오는 중…') + '</p>'; return; }
      const q = S.q.trim().toLowerCase(), all = pool();
      const rows = all.filter(x => match(x, S.role) && (!q || String(x.name || '').toLowerCase().includes(q) || String(x.email || '').toLowerCase().includes(q)));
      box.innerHTML = rows.map(x => rowHtml2(x, all.indexOf(x))).join('') || '<p class="aa2-msg">' + (q ? '검색 결과가 없습니다.' : '해당하는 계정이 없습니다.') + '</p>';
    }
    function drawAdd() {
      const box = $('[data-aa2-addbox]');
      box.hidden = !S.adding;
      if (!S.adding) { box.innerHTML = ''; return; }
      const f = S.form, L = S.link, lockMail = !!(L && loginMail(L.name));
      box.innerHTML = '<b class="aa2-addt">' + (L ? '계정 연결 · ' + h(L.name) : '새 계정') + '</b><div class="aa2-fields">' +
        '<label>이름 *<input data-aa2-f="name" value="' + h(f.name) + '"' + (L ? ' readonly' : '') + ' maxlength="40" autocomplete="off"></label>' +
        '<label>이메일 *<input data-aa2-f="email" type="email" value="' + h(f.email) + '"' + (lockMail ? ' readonly' : '') + ' maxlength="120" placeholder="name@crm.netform.co.kr" autocomplete="off"></label>' +
        '<label>역할 *<select data-aa2-f="kind">' + KINDS.map(([k, l]) => '<option value="' + k + '"' + (f.kind === k ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label>' +
        '<label>소속<select data-aa2-f="team">' + TEAMS.map(t => '<option' + (f.team === t ? ' selected' : '') + '>' + t + '</option>').join('') + '</select></label></div>' +
        '<div class="aa2-addfoot"><span class="aa2-addnote' + (S.formErr ? ' err' : '') + '" role="status" aria-live="polite">' + h(S.formErr || (S.busy ? '만드는 중입니다…' : '만들면 임시 비밀번호가 나옵니다 · 첫 로그인 때 비밀번호 변경 강제')) + '</span><button type="button" class="aa2-btn" data-aa2="addCancel">취소</button><button type="button" class="aa2-btn aa2-dark" data-aa2="create"' + (S.busy ? ' disabled' : '') + '>계정 만들기</button></div>';
    }
    function draw() {
      const A = active(), P = pool(), offN = S.items.length - A.length, add = $('[data-aa2="add"]');
      $('[data-aa2-count]').textContent = S.loaded ? A.length + '명 · 로그인 연결 ' + A.filter(x => x.linked).length + '명' : '';
      $('[data-aa2-tabs]').innerHTML = TABS.map(([k, l]) => '<button type="button" class="aa2-tab' + (S.role === k ? ' on' : '') + '" data-aa2="role" data-k="' + k + '" aria-pressed="' + (S.role === k) + '">' + l + ' <span>' + P.filter(x => match(x, k)).length + '</span></button>').join('');
      add.disabled = !can('crm_admin_create_account_v1');
      add.title = add.disabled && S.loaded ? NOT_YET : '';
      drawAdd(); drawList();
      $('[data-aa2-foot]').innerHTML = '<span>본인 비밀번호는 오른쪽 위 내 이름 → 비밀번호 변경 · 퇴사자는 [···] → 비활성화(기록은 유지)</span>' + (offN ? '<button type="button" class="aa2-link" data-aa2="toggleOff">' + (S.showOff ? '비활성 숨기기' : '비활성 ' + offN + '명 보기') + '</button>' : '');
    }
    async function load() {
      try {
        const r = await root.Phase1.rpc('crm_admin_list_accounts_v1');
        if (!r?.ok || r.policy !== 'admin-accounts-v1' || !Array.isArray(r.items)) throw Error('CONTRACT');
        S.items = r.items; S.loaded = true; S.err = '';
        /* 새 서버 함수가 설치됐는지는 목록 응답으로 안다(임시 비밀번호 표시 칸이 같이 온다) */
        S.server2 = r.items.some(x => Object.prototype.hasOwnProperty.call(x, 'must_change'));
      } catch (e) { if (!S.loaded) S.err = errorText2(e, 'load'); }
      if (el.isConnected) draw();
    }
    async function submitAdd() {
      if (S.busy || !isAdmin()) return;
      const f = S.form, L = S.link, name = String(L ? L.name : f.name).trim(), email = String(f.email).trim().toLowerCase();
      let made = null;
      try {
        if (!name) throw Error('NAME_REQUIRED');
        if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) throw Error('EMAIL_INVALID');
        const pw = tempPassword();
        validate(pw, pw);
        S.busy = true; S.formErr = ''; drawAdd();
        const p = { name, email, kind: f.kind, team: f.team, temp_password: pw };
        if (L) p.link_user_id = L.user_id;
        const ack = await root.Phase1.rpc('crm_admin_create_account_v1', { p });
        if (!ack?.ok || ack.policy !== 'admin-account-create-v1' || !ack.user_id) throw Error('CONTRACT');
        made = String(ack.user_id);
        S.temps[made] = pw; S.fresh[made] = true;
      } catch (e) { S.formErr = errorText2(e, 'create'); }
      S.busy = false;
      if (!made) { if (el.isConnected) drawAdd(); return; }
      S.adding = false; S.link = null; S.role = 'all'; S.q = ''; $('[data-aa2-search]').value = ''; S.open = made; S.stage = 'issued'; S.rowErr = '';
      await load();
      el.querySelector('.aa2-item[data-id="' + made + '"]')?.scrollIntoView({ block: 'nearest' });
    }
    async function rowAction(a, x) {
      if (S.busy || !isAdmin()) return;
      const id = String(x.user_id);
      S.busy = true; S.rowErr = ''; drawList();
      try {
        if (a === 'doReset') {
          const pw = tempPassword();
          validate(pw, pw);
          const ack = await root.Phase1.rpc('crm_admin_reset_password_v1', { p_target_user_id: id, p_new_password: pw });
          if (!ack?.ok || ack.policy !== 'admin-password-reset-v1' || String(ack.target_user_id) !== id) throw Error('CONTRACT');
          S.temps[id] = pw; S.stage = 'issued';
        } else {
          const on = a === 'doOn';
          const ack = await root.Phase1.rpc('crm_admin_set_active_v1', { p: { user_id: id, active: on } });
          if (!ack?.ok || ack.policy !== 'admin-account-active-v1' || String(ack.user_id) !== id || ack.active !== on) throw Error('CONTRACT');
          if (!on) delete S.temps[id];
          closeRow();
          S.busy = false;
          await load();
          return;
        }
      } catch (e) { S.rowErr = errorText2(e); }
      S.busy = false;
      if (el.isConnected) drawList();
    }
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-aa2]');
      if (!b || b.disabled) return;
      const a = b.dataset.aa2, item = b.closest('.aa2-item'), x = item && find(item.dataset.id), id = x && String(x.user_id);
      if (a === 'close') return el.close();
      if (a === 'role') { S.role = b.dataset.k; return draw(); }
      if (a === 'toggleOff') { S.showOff = !S.showOff; return draw(); }
      if (a === 'add') { const openBlank = !S.adding || !!S.link; S.adding = openBlank; S.link = null; S.formErr = ''; S.form = { name: '', email: '', kind: 'rep', team: TEAMS[0] }; drawAdd(); if (openBlank) $('[data-aa2-f="name"]')?.focus(); return; }
      if (a === 'addCancel') { S.adding = false; S.link = null; S.formErr = ''; return drawAdd(); }
      if (a === 'create') return submitAdd();
      if (!x) return;
      if (a === 'link') {
        const k = kindOf(x);
        S.adding = true; S.link = x; S.formErr = ''; closeRow();
        S.form = { name: x.name, email: loginMail(x.name), kind: k === 'b2b' ? 'rep' : k, team: k === 'branch' ? '경남지사' : k === 'b2b' ? 'B2B' : '본사 영업' };
        draw();
        $('[data-aa2-addbox]').scrollIntoView({ block: 'nearest' });
        $(S.form.email ? '[data-aa2="create"]' : '[data-aa2-f="email"]')?.focus();
        return;
      }
      if (a === 'cancel') { closeRow(); return drawList(); }
      if (a === 'reset' || a === 'show' || a === 'more' || a === 'on') {
        const stage = { reset: 'confirm', show: 'issued', more: 'off', on: 'on' }[a];
        if (S.open === id && S.stage === stage) closeRow(); else { S.open = id; S.stage = stage; S.rowErr = ''; }
        return drawList();
      }
      if (a === 'doReset' || a === 'doOff' || a === 'doOn') return rowAction(a, x);
      if (a === 'copy') {
        const text = S.temps[id] || '', done = t => { b.textContent = t; root.setTimeout(() => { if (b.isConnected) b.textContent = '복사'; }, 1600); };
        const pick = () => { const node = item.querySelector('[data-aa2-pw]'), r = doc.createRange(), sel = root.getSelection(); r.selectNodeContents(node); sel.removeAllRanges(); sel.addRange(r); done('선택됨 · Ctrl+C'); };
        try { root.navigator.clipboard.writeText(text).then(() => done('복사됨'), pick); } catch (err) { pick(); }
      }
    });
    const sync = e => {
      const t = e.target;
      if (t.matches?.('[data-aa2-search]')) { S.q = t.value; drawList(); return; }
      const f = t.dataset?.aa2F;
      if (f) S.form[f] = t.value;
    };
    el.addEventListener('input', sync);
    el.addEventListener('change', sync);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches?.('input[data-aa2-f]')) { e.preventDefault(); submitAdd(); } });
    const invalidated = () => el.close();
    el.addEventListener('close', () => {
      /* 임시 비밀번호는 창을 닫는 순간 지운다 */
      Object.keys(S.temps).forEach(k => { delete S.temps[k]; });
      root.removeEventListener('phase1:identity-cleared', invalidated);
      el.remove();
      if (dialog2 === el) dialog2 = null;
      if (previousFocus?.isConnected) previousFocus.focus();
    }, { once: true });
    root.addEventListener('phase1:identity-cleared', invalidated);
    doc.body.appendChild(el);
    el.tabIndex = -1;
    el.showModal();
    el.focus();
    draw();
    await load();
  }
  function open() { return root.G?.accountAdminV2Off ? openV1() : openV2(); }
  if (typeof module === 'object' && module.exports) module.exports = { validate, errorText, tempPassword, kindOf };
  else root.AccountAdmin = Object.freeze({ open, isAdmin });
})(typeof window === 'object' ? window : globalThis);
