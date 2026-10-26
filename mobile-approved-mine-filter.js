/* 내 현장 필터 선택창 — 디자인 모듈 (승인 B 규격, 모양은 filter-design.css)
   render(model) → HTML 문자열만 돌려준다.
   서버 쓰기·네트워크·계정/자료 접근·이벤트 연결·필터 계산은 기능 담당 쪽에서 한다.
   model = {brands:[string], stages:[{key,label}], draft:{brand,stage,openOnly}, error:string}
   draft.brand / draft.stage 의 빈 문자열은 '전체'. */
(function (root) {
  'use strict';

  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"'`]/g, function (c) { return ESC[c]; }); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function str(v) { return v == null ? '' : String(v); }

  var CLOSE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  function chip(name, field, value, text, checked) {
    return '<label class="amf-chip"><input type="radio" name="' + esc(name) + '" value="' + esc(value) + '"'
      + ' data-mine-filter-field="' + esc(field) + '"' + (checked ? ' checked' : '') + '>'
      + '<span>' + esc(text) + '</span></label>';
  }

  function render(model) {
    var m = model || {};
    var d = m.draft || {};
    var brand = str(d.brand), stage = str(d.stage);
    var brands = arr(m.brands), stages = arr(m.stages);
    var error = str(m.error);

    var brandChips = chip('amf-brand', 'brand', '', '전체', brand === ''), brandShown = 0;
    for (var i = 0; i < brands.length; i++) {
      var b = str(brands[i]);
      if (b === '') continue;
      brandChips += chip('amf-brand', 'brand', b, b, brand === b);
      brandShown++;
    }
    var brandEmpty = brandShown === 0;

    var stageChips = chip('amf-stage', 'stage', '', '전체', stage === '');
    for (var j = 0; j < stages.length; j++) {
      var s = stages[j] || {};
      var key = str(s.key);
      if (key === '') continue;
      stageChips += chip('amf-stage', 'stage', key, s.label == null ? key : s.label, stage === key);
    }

    return ''
      + '<div class="approved-mine-filter" data-mine-filter-root>'
      +   '<div class="amf-scrim" data-mine-filter-action="cancel" aria-hidden="true"></div>'
      +   '<section class="amf-card" role="dialog" aria-modal="true" aria-labelledby="amf-title" aria-describedby="amf-hint" tabindex="-1" data-mine-filter-dialog>'
      +     '<div class="amf-grip" aria-hidden="true"></div>'
      +     '<header class="amf-head">'
      +       '<h2 class="amf-title" id="amf-title">필터</h2>'
      +       '<button type="button" class="amf-reset" data-mine-filter-action="reset">초기화</button>'
      +       '<button type="button" class="amf-close" data-mine-filter-action="cancel" aria-label="닫기">' + CLOSE_ICON + '</button>'
      +     '</header>'
      +     '<p class="amf-hint" id="amf-hint">적용을 눌러야 목록에 반영돼요. 검색어는 그대로 함께 적용돼요.</p>'
      +     '<div class="amf-body">'
      +       (error ? '<div class="amf-alert" role="alert">' + esc(error) + '</div>' : '')
      +       '<fieldset class="amf-group">'
      +         '<legend class="amf-legend">브랜드</legend>'
      +         '<div class="amf-chips">' + brandChips + '</div>'
      +         (brandEmpty ? '<p class="amf-empty">선택할 수 있는 브랜드가 없어요.</p>' : '')
      +       '</fieldset>'
      +       '<fieldset class="amf-group">'
      +         '<legend class="amf-legend">단계</legend>'
      +         '<div class="amf-chips">' + stageChips + '</div>'
      +       '</fieldset>'
      +       '<div class="amf-group">'
      +         '<label class="amf-switch">'
      +           '<span class="amf-switch-text">진행 중만 보기</span>'
      +           '<input type="checkbox" role="switch" data-mine-filter-field="openOnly"' + (d.openOnly === true ? ' checked' : '') + '>'
      +           '<span class="amf-switch-ui" aria-hidden="true"></span>'
      +         '</label>'
      +       '</div>'
      +     '</div>'
      +     '<footer class="amf-foot">'
      +       '<button type="button" class="amf-btn amf-btn-line" data-mine-filter-action="cancel">취소</button>'
      +       '<button type="button" class="amf-btn amf-btn-primary" data-mine-filter-action="apply">적용</button>'
      +     '</footer>'
      +   '</section>'
      + '</div>';
  }

  root.MobileApprovedMineFilter = {
    version: 'mine-filter-design-20261026b',
    rootClass: 'approved-mine-filter',
    render: render,
    escape: esc
  };
})(typeof self !== 'undefined' ? self : this);
