/* No fallback UI: a failed or delayed approved renderer leaves the app hidden. */
(function (root) {
  'use strict';
  const doc = root.document, html = doc.documentElement;
  const demo = new URLSearchParams(root.location.search).get('demo') === '1';
  const state = () => html.getAttribute('data-mobile-approved-view') || 'pending';
  const begin = () => html.setAttribute('data-mobile-approved-view', 'pending');
  function approvedDom() {
    const scr = doc.getElementById('scr');
    return !!(root.G && root.G.user && doc.body && doc.body.classList.contains('claude-shell') &&
      scr && scr.classList.contains('gs-screen') &&
      scr.querySelector(':scope > .approved-a, :scope > .approved-bc, :scope > .approved-i4, :scope > .approved-ej, :scope > .approved-f, :scope > .approved-h, :scope > .approved-gj, :scope > .approved-j1, :scope > .approved-quote, :scope > .approved-quote-extra, :scope > .approved-input'));
  }
  function loginDom() {
    return !demo && !root.DEMO && !(root.G && root.G.user) &&
      !!doc.querySelector('#scr > .login');
  }
  function ready() {
    if (!approvedDom()) { begin(); return false; }
    html.setAttribute('data-mobile-approved-view', 'approved');
    return true;
  }
  function login() {
    if (!loginDom()) { begin(); return false; }
    html.setAttribute('data-mobile-approved-view', 'login');
    return true;
  }
  begin();
  root.MobileApprovedBoot = Object.freeze({ begin, hold: begin, ready, login, state });
  root.addEventListener('phase1:identity-cleared', begin);
  // Revoke visibility if a stale renderer replaces the current approved root.
  // Never reveal on DOMContentLoaded: only the approved renderer may do that.
  const watch = () => {
    if (!doc.body) return;
    new MutationObserver(() => {
      const view = state();
      if ((view === 'approved' && !approvedDom()) || (view === 'login' && !loginDom())) begin();
    }).observe(doc.body, { childList: true, subtree: true });
  };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', watch);
  else watch();
})(window);
