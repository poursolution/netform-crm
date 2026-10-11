/* Approved component extraction only; no speech or business behavior.
 * Markup: source43/5_디자인규칙_화면/CRM Mobile.dc.html:191.
 * Idle colors: the same source:324 (memoBg/memoC/memoDot).
 * Placement and label: source43/CODEX_DESIGN_GUIDE.md:299 and
 * source43/Codex 모바일 디자인 가이드 · 예시.dc.html:366.
 * The old memoTap handler is intentionally not copied: it inferred result/tasks.
 */
window.MobileApprovedMicSource = Object.freeze({
  html: '<button data-ce="input-mic" style="flex:none;border:0;background:#f5f6f8;color:#15171c;border-radius:14px;min-height:48px;padding:10px 14px;display:flex;align-items:center;gap:10px;cursor:pointer;text-align:left"><span style="width:28px;height:28px;border-radius:14px;background:#3b6ce4;flex:none;display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5 11a7 7 0 0 0 14 0M12 18v3"></path></svg></span><span style="flex:1;font-size:13.5px;font-weight:600;line-height:1.45">누르고 말하기</span></button>',
  provenance: Object.freeze({
    source: 'source43/5_디자인규칙_화면/CRM Mobile.dc.html',
    markupLine: 191,
    idleColorLine: 324,
    placementSource: 'source43/CODEX_DESIGN_GUIDE.md:299',
    action: 'input-mic'
  })
});
