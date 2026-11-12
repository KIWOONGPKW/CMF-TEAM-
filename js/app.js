/* CMF Freight Quotation System - 화면(UI) */
(function () {
  'use strict';
  var C = window.CMF, Store = C.Store;
  var main = document.getElementById('main');

  // ---------------- 상태 ----------------
  var S = {
    view: 'dashboard', db: null, dataMeta: null, settings: Object.assign({}, C.DEFAULT_SETTINGS),
    form: null, result: null, selectedKey: null, current: null, remark: '',
    pendingUpload: null, uploads: [], quotes: [],
    rateTab: 'CARRIER_RATE', rateFilter: '', rateStatus: 'ALL', remarkFilter: '', remarkType: 'ALL',
    histFilter: '', histStatus: 'ALL'
  };
  function newForm() {
    return {
      direction: 'EXPORT', pol: '', pod: '', containers: [{ type: '20GP', qty: 1 }], incoterms: '', quoteDate: C.today(),
      carrier: '', customer: '', cargo: '', grossWeightKg: '', dg: false, reefer: false, reeferTemp: '', door: false,
      blCount: Number(S.settings.DEFAULT_BL_COUNT || 1), storageDays: '', includeOrigin: true, includeDest: false
    };
  }
  S.form = newForm();

  var INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];
  var MAIN_TYPES = ['20GP', '40GP', '40HC', '45HC', '20RF', '40RF', '40RH', '20OT', '40OT', '20FR', '40FR', '20TK'];
  var ZERO_DEC = ['KRW', 'JPY', 'VND', 'IDR', 'MNT'];
  var STATUS_BADGE = { DRAFT: 'b-gray', REVIEW_REQUIRED: 'b-warn', APPROVED: 'b-ok' };

  // ---------------- 유틸 ----------------
  function h(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function fmt(n, cur) {
    if (n == null || n === '' || isNaN(n)) return '';
    var d = ZERO_DEC.indexOf(cur) >= 0 ? 0 : 2;
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d === 0 ? 2 : 2 });
  }
  function totalsText(t, sep) {
    var ks = Object.keys(t || {}).sort(C.currencyOrder);
    if (!ks.length) return '-';
    return ks.map(function (k) { return k + ' ' + fmt(t[k], k); }).join(sep || '<br>');
  }
  function toast(msg) {
    var el = document.getElementById('toast'); el.textContent = msg; el.classList.remove('hidden');
    clearTimeout(toast._t); toast._t = setTimeout(function () { el.classList.add('hidden'); }, 2600);
  }
  function modal(html, bind) {
    var m = document.getElementById('modal'), box = document.getElementById('modalBox');
    box.innerHTML = html; m.classList.remove('hidden');
    function close() { m.classList.add('hidden'); box.innerHTML = ''; }
    box.querySelectorAll('[data-close]').forEach(function (b) { b.onclick = close; });
    if (bind) bind(box, close);
  }
  function confirmBox(title, body, okLabel, onOk) {
    modal('<h3>' + h(title) + '</h3><div style="margin-bottom:16px;line-height:1.6">' + body + '</div>' +
      '<div class="row" style="justify-content:flex-end"><button class="btn" data-close>취소</button><button class="btn primary" id="mOk">' + h(okLabel || '확인') + '</button></div>',
      function (box, close) { box.querySelector('#mOk').onclick = function () { close(); onOk(); }; });
  }
  // 파일 저장: Claude 미리보기 안에서는 downloads 기능, 그 외(GitHub Pages·로컬)는 일반 다운로드
  var dlNs = null;
  if (window.claude && typeof window.claude.use === 'function') {
    try { window.claude.use('downloads').then(function (ns) { dlNs = ns; }).catch(function () {}); } catch (e) {}
  }
  function download(bytes, name) {
    if (dlNs) {
      dlNs.save({ filename: name, data: bytes.slice(0) }).then(function () { toast('저장: ' + name); })
        .catch(function (e) { if (!e || e.code !== 'declined') toast('다운로드할 수 없습니다 (' + ((e && e.code) || 'error') + ')'); });
      return;
    }
    var blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }
  function localTime(iso) {
    var d = new Date(iso); if (isNaN(d)) return iso || '';
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function safeName(s) { return String(s || '').replace(/[\\/:*?"<>|\s]+/g, '_').replace(/_+/g, '_').slice(0, 40); }
  function rateState(r, today) {
    if (r.VALID_TO && r.VALID_TO < today) return 'EXPIRED';
    if (r.VALID_FROM && r.VALID_FROM > today) return 'UPCOMING';
    return 'VALID';
  }
  function stateBadge(st) {
    return st === 'EXPIRED' ? '<span class="badge b-bad">만료</span>' : st === 'UPCOMING' ? '<span class="badge b-info">예정</span>' : '<span class="badge b-ok">유효</span>';
  }
  function lineStatusBadge(l) {
    if (!l.include) return '<span class="badge b-gray">견적 제외</span>';
    return { OK: '<span class="badge b-ok">확정</span>', INCLUDED: '<span class="badge b-info">운임 포함</span>', PENDING: '<span class="badge b-bad">확인 필요</span>' }[l.status] || l.status;
  }
  function optionStatus(o) {
    var b = [];
    if (o.missingTypes.length) b.push('<span class="badge b-bad">운임 확인 필요</span>');
    if (o.legalHold) b.push('<span class="badge b-bad">법적 검토</span>');
    if (o.pendingCount) b.push('<span class="badge b-warn">미확정 ' + o.pendingCount + '</span>');
    if (o.reviewRequired && !o.legalHold) b.push('<span class="badge b-warn">검토 필요</span>');
    if (!b.length) b.push('<span class="badge b-ok">산출 완료</span>');
    return b.join(' ');
  }
  function selectedOption() {
    if (!S.result) return null;
    return S.result.options.filter(function (o) { return o.key === S.selectedKey; })[0] || null;
  }
  function dbForEngine() { return Object.assign({}, S.db || {}, { settings: S.settings }); }

  // ---------------- 영속화 ----------------
  function persistDb() { return Promise.all([Store.set('db', S.db), Store.set('dataMeta', S.dataMeta), Store.set('settings', S.settings)]); }
  function loadAll() {
    return Promise.all([Store.get('db'), Store.get('dataMeta'), Store.get('settings'), Store.all('uploads'), Store.all('quotes')]).then(function (r) {
      S.db = r[0] || null; S.dataMeta = r[1] || null;
      if (r[2]) S.settings = Object.assign({}, C.DEFAULT_SETTINGS, r[2]);
      S.uploads = (r[3] || []).sort(function (a, b) { return a.uploadedAt < b.uploadedAt ? 1 : -1; });
      S.quotes = (r[4] || []).sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
      S.form.blCount = Number(S.settings.DEFAULT_BL_COUNT || 1);
    });
  }

  // ---------------- 라우팅 ----------------
  function go(view) { S.view = view; render(); window.scrollTo(0, 0); }
  document.getElementById('nav').addEventListener('click', function (e) {
    var a = e.target.closest('a[data-view]'); if (a) go(a.dataset.view);
  });
  function render() {
    document.querySelectorAll('#nav a').forEach(function (a) { a.classList.toggle('active', a.dataset.view === S.view); });
    var fn = VIEWS[S.view] || VIEWS.dashboard;
    main.innerHTML = fn();
    if (AFTER[S.view]) AFTER[S.view]();
    var badge = document.getElementById('dataBadge');
    if (S.dataMeta) badge.innerHTML = '운임 DB: ' + h(S.dataMeta.fileName) + '<br>' + h(localTime(S.dataMeta.uploadedAt)) + ' 등록<br>요율 ' + (S.db.CARRIER_RATE || []).length + '건';
    else badge.innerHTML = '운임 데이터 미등록';
  }

  function noDataCard() {
    return '<div class="card empty"><div style="font-size:15px;font-weight:600;color:var(--ink);margin-bottom:6px">등록된 운임 데이터가 없습니다</div>' +
      '<div style="margin-bottom:14px">운임 Excel을 업로드하거나, 샘플 데이터로 화면을 먼저 확인해 보세요.</div>' +
      '<div class="row" style="justify-content:center"><button class="btn primary" data-act="goUpload">데이터 업로드</button>' +
      '<button class="btn" data-act="loadSample">샘플 데이터 불러오기</button></div></div>';
  }

  // ---------------- 화면들 ----------------
  var VIEWS = {}, AFTER = {};

  VIEWS.dashboard = function () {
    var today = C.today(), month = today.slice(0, 7);
    var q = S.quotes;
    var monthCnt = q.filter(function (x) { return (x.date || '').slice(0, 7) === month; }).length;
    var review = q.filter(function (x) { return x.status === 'REVIEW_REQUIRED'; });
    var approved = q.filter(function (x) { return x.status === 'APPROVED'; }).length;
    var rates = (S.db && S.db.CARRIER_RATE) || [];
    var warnDays = Number(S.settings.EXPIRY_WARN_DAYS || 7);
    var valid = 0, expired = 0, soon = [];
    rates.forEach(function (r) {
      var st = rateState(r, today);
      if (st === 'EXPIRED') expired++; else if (st === 'VALID') { valid++; if (C.daysBetween(today, r.VALID_TO) <= warnDays) soon.push(r); }
    });
    var html = '<h1>Dashboard</h1><p class="sub">' + h(today) + ' 기준 견적·운임 데이터 현황</p>';
    if (!S.db) html += noDataCard();
    html += '<div class="grid g4" style="margin-bottom:18px">' +
      kpi('전체 견적', q.length, '이번 달 ' + monthCnt + '건') +
      kpi('검토 필요 견적', review.length, '미확정 비용·법적 검토 포함') +
      kpi('승인 완료', approved, 'APPROVED') +
      kpi('유효 운임', valid, '만료 ' + expired + '건 / 만료 임박 ' + soon.length + '건') + '</div>';
    html += '<div class="card"><div class="row" style="margin-bottom:10px"><h2 class="mb0">최근 견적</h2><button class="btn sm right" data-act="newQuote">+ 새 견적</button></div>' +
      (q.length ? quoteTable(q.slice(0, 6), false) : '<div class="empty">아직 저장된 견적이 없습니다.</div>') + '</div>';
    html += '<div class="card"><h2>검토 필요 / 미확정 견적</h2>' +
      (review.length ? quoteTable(review.slice(0, 6), false) : '<div class="empty">검토가 필요한 견적이 없습니다.</div>') + '</div>';
    if (soon.length) {
      html += '<div class="card"><h2>만료 임박 운임 (' + warnDays + '일 이내)</h2><div class="scroll"><table class="t"><tr><th>선사</th><th>구간</th><th>TYPE</th><th class="n">O/F</th><th>만료일</th></tr>' +
        soon.slice(0, 15).map(function (r) {
          return '<tr><td>' + h(r.CARRIER) + '</td><td>' + h(r.DIRECTION) + ' ' + h(r.POL) + ' → ' + h(r.POD) + '</td><td>' + h(r.CONTAINER_TYPE) + '</td><td class="n">' + h(r.CURRENCY) + ' ' + fmt(r.OCEAN_FREIGHT, r.CURRENCY) + '</td><td>' + h(r.VALID_TO) + ' (D-' + C.daysBetween(today, r.VALID_TO) + ')</td></tr>';
        }).join('') + '</table></div></div>';
    }
    return html;
  };
  function kpi(label, value, hint) { return '<div class="kpi"><div class="label">' + h(label) + '</div><div class="value">' + h(value) + '</div><div class="hint">' + h(hint) + '</div></div>'; }

  function quoteTable(list, actions) {
    return '<div class="scroll"><table class="t"><tr><th>견적번호</th><th>일자</th><th>고객</th><th>구간</th><th>컨테이너</th><th>선사</th><th class="n">견적 금액</th><th>상태</th>' + (actions ? '<th></th>' : '') + '</tr>' +
      list.map(function (x) {
        return '<tr><td class="nw"><button class="link" data-act="openQuote" data-no="' + h(x.no) + '">' + h(x.no) + '</button></td><td class="nw">' + h(x.date) + '</td><td>' + h(x.customer || '-') + '</td>' +
          '<td>' + h(x.request.direction === 'EXPORT' ? '수출' : '수입') + ' ' + h(x.request.pol) + ' → ' + h(x.request.pod) + '</td><td>' + h(C.containerSummary(x.request)) + '</td>' +
          '<td class="nw">' + h(x.option.carrier) + '</td><td class="n">' + totalsText(x.option.sellTotals) + (x.option.pendingCount ? '<div class="small">+ 미확정 ' + x.option.pendingCount + '</div>' : '') + '</td>' +
          '<td><span class="badge ' + (STATUS_BADGE[x.status] || 'b-gray') + '">' + h(x.status) + '</span></td>' +
          (actions ? '<td><div class="row" style="flex-wrap:nowrap"><button class="btn sm" data-act="openQuote" data-no="' + h(x.no) + '">열기</button>' +
            '<button class="btn sm" data-act="copyQuote" data-no="' + h(x.no) + '">복사</button>' +
            '<button class="btn sm" data-act="dlCustomer" data-no="' + h(x.no) + '">고객용 Excel</button>' +
            '<button class="btn sm" data-act="dlInternal" data-no="' + h(x.no) + '">내부용</button></div></td>' : '') + '</tr>';
      }).join('') + '</table></div>';
  }

  // ----- New Quotation -----
  function portOptions() {
    var set = {};
    ((S.db && S.db.CARRIER_RATE) || []).forEach(function (r) { set[r.POL] = 1; set[r.POD] = 1; });
    var pi = C.buildPortIndex((S.db && S.db.PORT) || []);
    return Object.keys(set).sort().map(function (c) { return '<option value="' + h(c) + '">' + h(C.portName(c, pi)) + '</option>'; }).join('');
  }
  function carriers() {
    var set = {};
    ((S.db && S.db.CARRIER_RATE) || []).forEach(function (r) { set[r.CARRIER] = 1; });
    return Object.keys(set).sort();
  }
  VIEWS.quote = function () {
    var f = S.form;
    var html = '<h1>New Quotation</h1><p class="sub">필수 조건을 입력하면 등록된 운임·LOCAL CHARGE·PORT REMARK로 선사별 견적을 계산합니다.' +
      (S.current ? ' <span class="badge b-info">편집 중: ' + h(S.current.no) + '</span> <button class="link" data-act="newQuote">새 견적으로 시작</button>' : '') + '</p>';
    if (!S.db) return html + noDataCard();
    html += '<div class="card"><h2>필수 입력</h2><div class="grid g4">' +
      '<div><label class="f req">수출 / 수입</label><div class="seg"><button data-act="dir" data-v="EXPORT" class="' + (f.direction === 'EXPORT' ? 'on' : '') + '">수출 EXPORT</button><button data-act="dir" data-v="IMPORT" class="' + (f.direction === 'IMPORT' ? 'on' : '') + '">수입 IMPORT</button></div></div>' +
      '<div><label class="f req">POL (선적항)</label><input type="text" list="portList" data-f="pol" value="' + h(f.pol) + '" placeholder="예: KRPUS, BUSAN, 부산"></div>' +
      '<div><label class="f req">POD (도착항)</label><input type="text" list="portList" data-f="pod" value="' + h(f.pod) + '" placeholder="예: VNHPH, HAIPHONG"></div>' +
      '<div><label class="f">Incoterms</label><select data-f="incoterms"><option value="">선택</option>' + INCOTERMS.map(function (x) { return '<option' + (f.incoterms === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></div>' +
      '</div><datalist id="portList">' + portOptions() + '</datalist>' +
      '<div class="grid g2 mt"><div><label class="f req">Container Type × Quantity</label><div id="ctrRows">' +
      f.containers.map(function (c, i) {
        return '<div class="ctr-row"><select data-ci="' + i + '" data-cf="type">' + MAIN_TYPES.map(function (t) { return '<option' + (c.type === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select>' +
          '<input type="number" min="1" step="1" data-ci="' + i + '" data-cf="qty" value="' + h(c.qty) + '">' +
          '<button class="btn sm" data-act="delCtr" data-i="' + i + '" title="삭제"' + (f.containers.length === 1 ? ' disabled' : '') + '>✕</button></div>';
      }).join('') + '</div><button class="btn sm" data-act="addCtr">+ 컨테이너 추가</button></div>' +
      '<div class="grid g2"><div><label class="f">견적 기준일</label><input type="date" data-f="quoteDate" value="' + h(f.quoteDate) + '"></div>' +
      '<div><label class="f">Carrier</label><select data-f="carrier"><option value="">자동 비교 (전체 선사)</option>' + carriers().map(function (c) { return '<option' + (f.carrier === c ? ' selected' : '') + '>' + h(c) + '</option>'; }).join('') + '</select></div>' +
      '<div><label class="f">B/L 건수</label><input type="number" min="1" step="1" data-f="blCount" value="' + h(f.blCount) + '"></div>' +
      '<div><label class="f">견적 범위</label><div style="padding-top:6px"><label class="chk"><input type="checkbox" data-f="includeOrigin"' + (f.includeOrigin ? ' checked' : '') + '> Origin charges</label> &nbsp; <label class="chk"><input type="checkbox" data-f="includeDest"' + (f.includeDest ? ' checked' : '') + '> Destination charges</label></div></div>' +
      '</div></div></div>';
    html += '<div class="card"><h2>선택 입력</h2><div class="grid g4">' +
      '<div><label class="f">Quotation Customer</label><input type="text" data-f="customer" value="' + h(f.customer) + '" placeholder="고객사명"></div>' +
      '<div><label class="f">Cargo Description</label><input type="text" data-f="cargo" value="' + h(f.cargo) + '"></div>' +
      '<div><label class="f">Gross Weight (KG)</label><input type="number" min="0" data-f="grossWeightKg" value="' + h(f.grossWeightKg) + '" placeholder="PER_KG 비용 계산용"></div>' +
      '<div><label class="f">보관/사용 일수</label><input type="number" min="0" data-f="storageDays" value="' + h(f.storageDays) + '" placeholder="PER_DAY 비용 계산용"></div>' +
      '</div><div class="row mt" style="gap:22px">' +
      '<label class="chk"><input type="checkbox" data-f="dg"' + (f.dg ? ' checked' : '') + '> Dangerous Goods (위험물)</label>' +
      '<label class="chk"><input type="checkbox" data-f="reefer"' + (f.reefer ? ' checked' : '') + '> Reefer</label>' +
      '<span class="row" style="gap:6px"><span class="small">설정 온도</span><input type="text" style="width:110px" data-f="reeferTemp" value="' + h(f.reeferTemp) + '" placeholder="예: -18℃"></span>' +
      '<label class="chk"><input type="checkbox" data-f="door"' + (f.door ? ' checked' : '') + '> Door Delivery</label>' +
      '</div><p class="small mt mb0">통관·보험·내륙운송, 마진 자동 적용, 고객별 단가는 Phase 2 범위입니다. (판매가는 Cost Breakdown에서 항목별로 직접 입력 가능)</p></div>';
    html += '<div id="formErr"></div><div class="row"><button class="btn primary" data-act="calc" style="padding:10px 26px">견적 계산</button>' +
      '<button class="btn" data-act="resetForm">입력 초기화</button></div>';
    if (S.result) html += '<div class="card mt">' + compareInner() + '</div>';
    return html;
  };

  // ----- Carrier Comparison -----
  function compareInner() {
    var r = S.result, req = r.request;
    var html = '<div class="row" style="margin-bottom:8px"><h2 class="mb0">선사별 비교 - ' + h(req.direction) + ' ' + h(req.pol) + ' → ' + h(req.pod) + ' / ' + h(C.containerSummary(req)) + '</h2></div>';
    (r.globalMessages || []).forEach(function (m) { html += msgBox(m); });
    if (!r.options.length) {
      if (r.expiredRates.length) html += '<div class="small">만료 요율: ' + r.expiredRates.map(function (x) { return h(x.CARRIER + ' ' + x.CONTAINER_TYPE + ' (~' + x.VALID_TO + ')'); }).join(', ') + '</div>';
      return html;
    }
    var types = req.containers.map(function (c) { return c.type; });
    html += '<p class="small" style="margin-top:0">정렬 기준: ' + h(r.sortBasis) + ' · 통화가 다른 금액은 합산하지 않습니다.</p>';
    html += '<div class="scroll"><table class="t"><tr><th>#</th><th>Carrier</th><th>Routing</th><th class="c">T/T</th><th>Free Time</th>' +
      types.map(function (t) { return '<th class="n">O/F ' + h(t) + '</th>'; }).join('') +
      '<th>Validity</th><th>Included / Excluded</th><th class="n">총원가</th><th>상태</th><th></th></tr>';
    r.options.forEach(function (o, i) {
      var sel = o.key === S.selectedKey;
      html += '<tr class="' + (sel ? 'sel' : '') + '"><td>' + (i + 1) + '</td><td class="nw"><b>' + h(o.carrier) + '</b></td>' +
        '<td>' + h(o.routing || '-') + (o.via ? '<div class="small">via ' + h(o.via) + '</div>' : '') + '</td>' +
        '<td class="c">' + (o.transitDays != null ? h(o.transitDays) + '일' : '-') + '</td><td>' + h(o.freeTime || '-') + '</td>' +
        types.map(function (t) { var rr = o.rates[t]; return '<td class="n">' + (rr ? h(rr.CURRENCY) + ' ' + fmt(rr.OCEAN_FREIGHT, rr.CURRENCY) : '<span class="badge b-bad">운임 확인 필요</span>') + '</td>'; }).join('') +
        '<td class="nw">~' + h(o.rateValidTo || '-') + '</td>' +
        '<td class="small">' + (o.includedCharges.length ? '포함: ' + h(o.includedCharges.join(', ')) + '<br>' : '') + (o.excludedText ? '불포함: ' + h(o.excludedText) : '') + '</td>' +
        '<td class="n"><b>' + totalsText(o.totals) + '</b></td><td>' + optionStatus(o) + '</td>' +
        '<td><button class="btn sm ' + (sel ? 'primary' : '') + '" data-act="selectOpt" data-key="' + h(o.key) + '">' + (sel ? '선택됨' : '선택') + '</button></td></tr>';
    });
    html += '</table></div>';
    if (r.excluded.length) html += '<p class="small">제외된 요율: ' + r.excluded.map(function (e) { return h(e.carrier + ' ' + e.type + ' - ' + e.reason); }).join(' / ') + '</p>';
    if (r.expiredRates.length) html += '<p class="small">만료되어 제외된 요율 ' + r.expiredRates.length + '건: ' + r.expiredRates.slice(0, 8).map(function (x) { return h(x.CARRIER + ' ' + x.CONTAINER_TYPE + ' ~' + x.VALID_TO); }).join(', ') + '</p>';
    html += '<div class="row mt"><button class="btn primary" data-act="toBreakdown"' + (S.selectedKey ? '' : ' disabled') + '>선택한 선사로 비용 Breakdown 보기 →</button></div>';
    return html;
  }
  VIEWS.compare = function () {
    var html = '<h1>Carrier Comparison</h1><p class="sub">동일 조건에서 선사별 해상운임과 총원가를 비교합니다.</p>';
    if (!S.result) return html + '<div class="card empty">먼저 New Quotation에서 견적을 계산하세요. <button class="link" data-act="goQuote">견적 입력으로 이동</button></div>';
    return html + '<div class="card">' + compareInner() + '</div>';
  };

  function msgBox(m) {
    return '<div class="msg m-' + h(m.type) + '"><b>' + (m.legal ? '[법적 검토] ' : '') + h(m.title) + '</b>' + h(m.message || '') + '</div>';
  }

  // ----- Cost Breakdown -----
  VIEWS.breakdown = function () {
    var html = '<h1>Cost Breakdown</h1><p class="sub">비용별 산출 근거, 적용 단가, 수량, 통화, 견적 포함 여부를 확인하고 판매가를 입력합니다.</p>';
    var o = selectedOption();
    if (!o) return html + '<div class="card empty">선택된 견적이 없습니다. <button class="link" data-act="goQuote">견적 입력으로 이동</button></div>';
    var req = S.result.request;
    var status = S.current && S.current.status === 'APPROVED' ? 'APPROVED' : o.status;
    html += '<div class="card"><div class="row" style="align-items:flex-start">' +
      '<div class="kv" style="flex:1;min-width:300px">' +
      '<div>견적번호</div><div><b>' + h(S.current ? S.current.no : '(저장 시 자동 생성)') + '</b> <span class="badge ' + (STATUS_BADGE[status] || 'b-gray') + '">' + h(status) + '</span>' + (S.current && S.current.approvedBy ? ' <span class="small">승인: ' + h(S.current.approvedBy) + '</span>' : '') + '</div>' +
      '<div>구간</div><div>' + h(req.direction) + ' · ' + h(req.polName) + ' (' + h(req.pol) + ') → ' + h(req.podName) + ' (' + h(req.pod) + ')</div>' +
      '<div>컨테이너</div><div>' + h(C.containerSummary(req)) + ' · B/L ' + h(req.blCount) + '건' + (req.incoterms ? ' · ' + h(req.incoterms) : '') + '</div>' +
      '<div>선사</div><div>' + h(o.carrier) + ' · ' + h(o.routing || '-') + (o.via ? ' via ' + h(o.via) : '') + (o.transitDays != null ? ' · T/T ' + h(o.transitDays) + '일' : '') + '</div>' +
      '<div>유효기간</div><div>운임 ~' + h(o.rateValidTo || '-') + ' · 견적 유효 ~' + h(o.quoteValidUntil) + ' (기준일 ' + h(req.quoteDate) + ')</div>' +
      '<div>고객</div><div>' + h(req.customer || '-') + '</div></div>' +
      '<div class="row" style="flex-direction:column;align-items:stretch;gap:8px;min-width:200px">' +
      '<button class="btn primary" data-act="saveQuote">견적 저장</button>' +
      '<button class="btn green" data-act="approve">담당자 승인 (APPROVED)</button>' +
      '<button class="btn" data-act="dlCustomerCur">고객 제출용 Excel</button>' +
      '<button class="btn" data-act="dlInternalCur">내부 검토용 Excel</button>' +
      (S.result.fromHistory ? '<button class="btn" data-act="recalc">현재 운임 DB로 재계산</button>' : '') +
      '</div></div></div>';
    if (S.result.fromHistory) html += '<div class="msg m-INFORMATION"><b>저장된 견적</b>견적 생성 당시 적용된 운임 데이터로 표시됩니다. 최신 운임으로 바꾸려면 [현재 운임 DB로 재계산]을 누르세요.</div>';
    if (o.legalHold && status !== 'APPROVED') html += '<div class="msg m-REVIEW_REQUIRED"><b>최종 확정 제한</b>법적 검토가 필요한 항목이 있어 담당자 승인 전에는 견적을 확정할 수 없습니다. 고객용 Excel은 DRAFT로 표시됩니다.</div>';
    if (o.pendingCount) html += '<div class="msg m-WARNING"><b>견적 불완전 - 미확정 ' + o.pendingCount + '건</b>' + o.pendingItems.map(function (l) { return h(l.name + (l.containerType ? ' ' + l.containerType : '') + ': ' + l.note); }).join(' / ') + '</div>';
    o.messages.forEach(function (m) { html += msgBox(m); });

    html += '<div class="card"><div class="row" style="margin-bottom:10px"><h2 class="mb0">비용 내역</h2><span class="small right">판매 단가를 바꾸면 고객용 견적서에 반영됩니다 (원가·이익은 고객용에 노출 안 됨)</span>' +
      '<button class="btn sm" data-act="resetSell">판매가 = 원가로 초기화</button></div><div class="scroll"><table class="t">' +
      '<tr><th class="c">포함</th><th>Code</th><th>비용명</th><th>Type</th><th>단위</th><th class="n">수량</th><th>통화</th><th class="n">원가 단가</th><th class="n">원가 금액</th><th class="n">판매 단가</th><th class="n">판매 금액</th><th>상태</th><th>산출 근거 / 비고</th><th>출처</th></tr>';
    ['OCEAN', 'ORIGIN', 'DEST', 'SPECIAL'].forEach(function (sec) {
      var lines = o.lines.filter(function (l) { return l.section === sec; });
      if (!lines.length) return;
      html += '<tr class="sec"><td colspan="14">' + h(C.SECTION_LABEL[sec]) + '</td></tr>';
      lines.forEach(function (l) {
        var idx = o.lines.indexOf(l);
        var ok = l.status === 'OK';
        html += '<tr class="' + (l.include ? '' : 'muted') + '"><td class="c"><input type="checkbox" data-line="' + idx + '" data-lf="include"' + (l.include ? ' checked' : '') + (sec === 'OCEAN' ? ' disabled' : '') + '></td>' +
          '<td>' + h(l.code) + '</td><td>' + h(l.name) + '</td><td>' + h(l.containerType) + '</td><td>' + h(C.UNIT_LABEL[l.unit] || l.unit) + '</td>' +
          '<td class="n">' + (l.qty == null ? '-' : h(l.qty)) + '</td><td>' + h(l.currency || '-') + '</td>' +
          '<td class="n">' + (l.unit === 'PERCENTAGE' && ok ? fmt(l.unitPrice, l.currency) : fmt(l.unitPrice, l.currency) || '-') + '</td>' +
          '<td class="n">' + (ok ? fmt(l.amount, l.currency) : '-') + '</td>' +
          '<td class="n">' + (ok ? '<input class="sell-in" type="number" step="any" data-line="' + idx + '" data-lf="sell" value="' + h(l.sellUnitPrice) + '">' : '-') + '</td>' +
          '<td class="n">' + (ok ? fmt(l.sellAmount, l.currency) : '-') + '</td>' +
          '<td>' + lineStatusBadge(l) + '</td><td class="small">' + h([l.basis, l.note].filter(Boolean).join(' / ')) + '</td>' +
          '<td class="small">' + (l.source ? h(l.source.sheet) + ' 행' + h(l.source.row) : '') + '</td></tr>';
      });
    });
    html += '</table></div>';
    var curs = Object.keys(o.totals).concat(Object.keys(o.sellTotals)).filter(function (c, i, a) { return a.indexOf(c) === i; }).sort(C.currencyOrder);
    html += '<h2 class="mt">통화별 합계</h2><div class="totals">' + curs.map(function (c) {
      var ct = o.totals[c] || 0, st = o.sellTotals[c] || 0, p = st - ct;
      return '<div class="total-box"><div class="cur">' + h(c) + ' 판매 합계</div><div class="amt">' + fmt(st, c) + '</div>' +
        '<div class="amt2">원가 ' + fmt(ct, c) + ' · 이익 ' + fmt(p, c) + (st ? ' (' + (p / st * 100).toFixed(1) + '%)' : '') + '</div></div>';
    }).join('') + '</div>';
    if (o.pendingCount) html += '<p class="small">※ 확인 필요 항목 ' + o.pendingCount + '건은 합계에 포함되지 않았습니다 (견적서에 TBA로 표시).</p>';
    html += '</div>';
    html += '<div class="card"><h2>견적서 비고 (고객용 Remarks에 표시)</h2><textarea data-f2="remark" placeholder="예: Booking은 Cut-off 3일 전까지 요청 바랍니다.">' + h(S.remark) + '</textarea></div>';
    return html;
  };

  // ----- History -----
  VIEWS.history = function () {
    var f = S.histFilter.toLowerCase();
    var list = S.quotes.filter(function (q) {
      if (S.histStatus !== 'ALL' && q.status !== S.histStatus) return false;
      if (!f) return true;
      return [q.no, q.customer, q.request.pol, q.request.pod, q.option.carrier, C.containerSummary(q.request)].join(' ').toLowerCase().indexOf(f) >= 0;
    });
    return '<h1>Quotation History</h1><p class="sub">저장된 견적을 검색하고 수정·복사·Excel 재다운로드합니다. 견적 생성 당시 적용된 운임이 함께 보존됩니다.</p>' +
      '<div class="card"><div class="row" style="margin-bottom:12px"><input type="text" style="max-width:320px" data-hf="histFilter" value="' + h(S.histFilter) + '" placeholder="견적번호, 고객, 항구, 선사 검색">' +
      '<select style="max-width:200px" data-hf="histStatus">' + ['ALL', 'DRAFT', 'REVIEW_REQUIRED', 'APPROVED'].map(function (s) { return '<option' + (S.histStatus === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' +
      '<span class="small right">' + list.length + '건</span></div>' +
      (list.length ? quoteTable(list, true) : '<div class="empty">조건에 맞는 견적이 없습니다.</div>') + '</div>';
  };

  // ----- Rate Database -----
  var RATE_COLS = {
    CARRIER_RATE: ['DIRECTION', 'CARRIER', 'POL', 'POD', 'CONTAINER_TYPE', 'OCEAN_FREIGHT', 'CURRENCY', 'TRANSIT_DAYS', 'ROUTING', 'VIA', 'FREE_TIME', 'VALID_FROM', 'VALID_TO', 'INCLUDED_CHARGES', 'DG_ACCEPT', 'REMARK'],
    ORIGIN_CHARGE: ['CHARGE_CODE', 'CHARGE_NAME', 'PORT_CODE', 'CARRIER', 'CONTAINER_TYPE', 'DIRECTION', 'CHARGE_AMOUNT', 'CURRENCY', 'CHARGE_UNIT', 'VALID_FROM', 'VALID_TO', 'INCLUDED_IN_OF', 'CHARGE_CONDITION', 'REMARK'],
    PORT: ['UNLOCODE', 'PORT_NAME', 'ALIASES']
  };
  RATE_COLS.DEST_CHARGE = RATE_COLS.ORIGIN_CHARGE;
  function cellText(k, v, rec) {
    if (Array.isArray(v)) return v.join(', ');
    if (typeof v === 'number' && (k === 'OCEAN_FREIGHT' || k === 'CHARGE_AMOUNT')) return fmt(v, rec.CURRENCY);
    return v == null ? '' : v;
  }
  VIEWS.rates = function () {
    var html = '<h1>Rate Database</h1><p class="sub">등록된 선사별 운임표와 LOCAL CHARGE를 조회합니다. 수정은 [현재 DB Excel 다운로드] → 수정 → 재업로드로 진행합니다 (업로드 이력·버전 보존).</p>';
    if (!S.db) return html + noDataCard();
    var today = C.today(), tab = S.rateTab, cols = RATE_COLS[tab];
    var f = S.rateFilter.toLowerCase();
    var list = (S.db[tab] || []).filter(function (r) {
      if (tab !== 'PORT' && S.rateStatus !== 'ALL' && rateState(r, today) !== S.rateStatus) return false;
      if (!f) return true;
      return cols.map(function (k) { return cellText(k, r[k], r); }).join(' ').toLowerCase().indexOf(f) >= 0;
    });
    html += '<div class="card"><div class="tabs">' + ['CARRIER_RATE', 'ORIGIN_CHARGE', 'DEST_CHARGE', 'PORT'].map(function (t) {
      return '<button data-act="rateTab" data-t="' + t + '" class="' + (tab === t ? 'on' : '') + '">' + h(C.SHEETS[t].title) + ' (' + (S.db[t] || []).length + ')</button>';
    }).join('') + '</div>' +
      '<div class="row" style="margin-bottom:12px"><input type="text" style="max-width:320px" data-rf="rateFilter" value="' + h(S.rateFilter) + '" placeholder="선사, 항구, 코드 검색">' +
      (tab !== 'PORT' ? '<select style="max-width:160px" data-rf="rateStatus">' + [['ALL', '전체'], ['VALID', '유효'], ['EXPIRED', '만료'], ['UPCOMING', '예정']].map(function (s) { return '<option value="' + s[0] + '"' + (S.rateStatus === s[0] ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select>' : '') +
      '<span class="small">' + list.length + '건</span><button class="btn sm right" data-act="exportDb">현재 DB Excel 다운로드</button></div>' +
      '<div class="scroll"><table class="t"><tr><th>행</th>' + (tab !== 'PORT' ? '<th>상태</th>' : '') + cols.map(function (k) { return '<th>' + h(k) + '</th>'; }).join('') + '</tr>' +
      list.slice(0, 500).map(function (r) {
        return '<tr><td class="small">' + h(r._row) + '</td>' + (tab !== 'PORT' ? '<td>' + stateBadge(rateState(r, today)) + '</td>' : '') +
          cols.map(function (k) { var num = k === 'OCEAN_FREIGHT' || k === 'CHARGE_AMOUNT'; return '<td' + (num ? ' class="n"' : '') + '>' + h(cellText(k, r[k], r)) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</table></div>' + (list.length > 500 ? '<p class="small">상위 500건만 표시합니다. 검색으로 좁혀 보세요.</p>' : '') +
      (tab === 'PORT' ? '<p class="small">PORT 시트에 없는 항구도 기본 항구표(BUSAN/PUSAN/KRPUS 등 주요 항만)로 정규화됩니다.</p>' : '') + '</div>';
    return html;
  };

  // ----- Remark Management -----
  var RT_BADGE = { AUTO_CHARGE: 'b-info', WARNING: 'b-warn', REVIEW_REQUIRED: 'b-bad', INFORMATION: 'b-gray' };
  VIEWS.remarks = function () {
    var html = '<h1>Remark Management</h1><p class="sub">PORT별 특이사항과 자동 비용 적용 규칙입니다. 등록·수정은 Excel의 PORT_REMARK 시트에서 합니다.</p>';
    if (!S.db) return html + noDataCard();
    var today = C.today(), f = S.remarkFilter.toLowerCase();
    var list = (S.db.PORT_REMARK || []).filter(function (r) {
      if (S.remarkType !== 'ALL' && r.REMARK_TYPE !== S.remarkType) return false;
      return !f || [r.PORT_CODE, r.CARRIER, r.TITLE, r.MESSAGE, r.CHARGE_CODE].join(' ').toLowerCase().indexOf(f) >= 0;
    });
    html += '<div class="card"><div class="row" style="margin-bottom:12px"><input type="text" style="max-width:300px" data-rf="remarkFilter" value="' + h(S.remarkFilter) + '" placeholder="항구, 선사, 제목 검색">' +
      '<select style="max-width:200px" data-rf="remarkType">' + ['ALL'].concat(C.REMARK_TYPES).map(function (s) { return '<option' + (S.remarkType === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select><span class="small">' + list.length + '건</span></div>' +
      '<div class="scroll"><table class="t"><tr><th>행</th><th>유형</th><th>PORT</th><th>역할</th><th>선사</th><th>TYPE</th><th>화물조건</th><th>방향</th><th>제목 / 내용</th><th>자동 비용</th><th>법적검토</th><th>유효기간</th></tr>' +
      list.map(function (r) {
        var exp = r.VALID_TO && r.VALID_TO < today;
        return '<tr class="' + (exp ? 'muted' : '') + '"><td class="small">' + h(r._row) + '</td><td><span class="badge ' + RT_BADGE[r.REMARK_TYPE] + '">' + h(r.REMARK_TYPE) + '</span></td>' +
          '<td>' + h(r.PORT_CODE) + '</td><td>' + h(r.PORT_ROLE) + '</td><td>' + h(r.CARRIER) + '</td><td>' + h(r.CONTAINER_TYPE) + '</td><td>' + h(r.CARGO_CONDITION) + '</td><td>' + h(r.DIRECTION) + '</td>' +
          '<td><b>' + h(r.TITLE) + '</b><div class="small">' + h(r.MESSAGE || '') + '</div></td>' +
          '<td class="small">' + (r.REMARK_TYPE === 'AUTO_CHARGE' ? h(r.CHARGE_CODE) + ' ' + (r.CHARGE_AMOUNT == null ? '<span class="badge b-bad">금액 미확정</span>' : h(r.CURRENCY) + ' ' + fmt(r.CHARGE_AMOUNT, r.CURRENCY)) + ' / ' + h(C.UNIT_LABEL[r.CHARGE_UNIT] || '') : '') + '</td>' +
          '<td>' + (r.LEGAL_REVIEW === 'Y' ? '<span class="badge b-bad">Y</span>' : '') + '</td>' +
          '<td class="small">' + h((r.VALID_FROM || '') + ' ~ ' + (r.VALID_TO || '')) + (exp ? ' (만료)' : '') + '</td></tr>';
      }).join('') + '</table></div>' +
      '<p class="small mt mb0">AUTO_CHARGE: 조건 충족 시 비용 자동 추가 (금액 공란이면 "확인 필요") · WARNING: 화면·견적서 주의사항 · REVIEW_REQUIRED: 담당자 검토 필요 · INFORMATION: 참고 · LEGAL_REVIEW=Y: 승인 전 확정 불가</p></div>';
    return html;
  };

  // ----- Upload -----
  VIEWS.upload = function () {
    var html = '<h1>데이터 업로드</h1><p class="sub">운임 Excel(.xlsx)을 올리면 필수값·중복·통화·유효기간을 검증한 뒤 등록합니다. 항구명(BUSAN/PUSAN/KRPUS)과 컨테이너명(40HQ/40HC)은 자동 정규화됩니다.</p>';
    html += '<div class="grid g2"><div class="card"><h2>1. Excel 업로드</h2><div class="drop" id="drop">여기로 .xlsx 파일을 끌어 놓거나 <b>클릭해서 선택</b>하세요<input type="file" id="fileIn" accept=".xlsx,.xlsm" style="display:none"></div></div>' +
      '<div class="card"><h2>템플릿</h2><p class="small" style="margin-top:0">시트: CARRIER_RATE, ORIGIN_CHARGE, DEST_CHARGE, PORT_REMARK, SETTINGS, PORT (+ Phase 2용 EXTRA_COST, INCOTERMS, CUSTOMER). 첫 시트 [사용안내]에 컬럼 설명이 있습니다.</p>' +
      '<div class="row"><button class="btn" data-act="dlTemplate" data-sample="0">빈 템플릿 다운로드</button><button class="btn" data-act="dlTemplate" data-sample="1">샘플 포함 템플릿</button>' +
      '<button class="btn" data-act="loadSample">샘플 데이터 바로 등록</button></div></div></div>';
    var pu = S.pendingUpload;
    if (pu) {
      var p = pu.parsed;
      var errs = p.issues.filter(function (i) { return i.level === 'error'; }), warns = p.issues.filter(function (i) { return i.level === 'warning'; });
      html += '<div class="card"><h2>2. 검증 결과 - ' + h(pu.fileName) + '</h2><div class="grid g4" style="margin-bottom:14px">' +
        C.SHEET_ORDER.filter(function (s) { return C.SHEETS[s].phase === 1; }).map(function (s) { return kpi(s, p.summary[s], C.SHEETS[s].title + ' 등록 대상'); }).join('') +
        kpi('오류', errs.length, '오류 행은 등록에서 제외') + kpi('경고', warns.length, '등록은 되지만 확인 권장') + '</div>';
      if (p.issues.length) {
        html += '<div class="scroll" style="max-height:340px;overflow-y:auto"><table class="t"><tr><th>구분</th><th>시트</th><th>행</th><th>컬럼</th><th>내용</th></tr>' +
          p.issues.slice(0, 400).map(function (i) {
            return '<tr><td><span class="badge ' + (i.level === 'error' ? 'b-bad' : 'b-warn') + '">' + (i.level === 'error' ? '오류' : '경고') + '</span></td><td>' + h(i.sheet) + '</td><td>' + h(i.row) + '</td><td>' + h(i.field || '') + '</td><td>' + h(i.message) + '</td></tr>';
          }).join('') + '</table></div>';
      } else html += '<div class="msg m-OK"><b>문제 없음</b>모든 행이 검증을 통과했습니다.</div>';
      html += '<div class="row mt"><button class="btn primary" data-act="commitUpload"' + (p.ok ? '' : ' disabled') + '>' + (S.db ? '기존 데이터 덮어쓰고 등록' : '등록') + '</button><button class="btn" data-act="cancelUpload">취소</button>' +
        (p.ok ? '' : '<span class="small" style="color:var(--bad)">CARRIER_RATE에 유효한 행이 없어 등록할 수 없습니다.</span>') + '</div></div>';
    }
    html += '<div class="card"><h2>업로드 이력 / 버전</h2>' + (S.uploads.length ? '<div class="scroll"><table class="t"><tr><th>버전</th><th>등록일시</th><th>파일</th><th class="n">운임</th><th class="n">Origin</th><th class="n">Dest</th><th class="n">Remark</th><th class="n">오류/경고</th><th></th></tr>' +
      S.uploads.map(function (u) {
        var cur = S.dataMeta && S.dataMeta.version === u.id;
        return '<tr class="' + (cur ? 'sel' : '') + '"><td>' + h(u.id) + (cur ? ' <span class="badge b-ok">사용 중</span>' : '') + '</td><td>' + h(localTime(u.uploadedAt)) + '</td><td>' + h(u.fileName) + '</td>' +
          '<td class="n">' + u.summary.CARRIER_RATE + '</td><td class="n">' + u.summary.ORIGIN_CHARGE + '</td><td class="n">' + u.summary.DEST_CHARGE + '</td><td class="n">' + u.summary.PORT_REMARK + '</td>' +
          '<td class="n">' + u.errorCount + ' / ' + u.warningCount + '</td><td>' + (cur ? '' : '<button class="btn sm" data-act="restoreVer" data-id="' + h(u.id) + '">이 버전으로 복원</button>') + '</td></tr>';
      }).join('') + '</table></div>' : '<div class="empty">업로드 이력이 없습니다.</div>') + '</div>';
    return html;
  };
  AFTER.upload = function () {
    var drop = document.getElementById('drop'), fi = document.getElementById('fileIn');
    drop.onclick = function () { fi.click(); };
    fi.onchange = function () { if (fi.files[0]) handleFile(fi.files[0]); };
    drop.ondragover = function (e) { e.preventDefault(); drop.classList.add('over'); };
    drop.ondragleave = function () { drop.classList.remove('over'); };
    drop.ondrop = function (e) { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); };
  };
  function handleFile(file) {
    if (!/\.xls[xm]$/i.test(file.name)) { toast('.xlsx 파일만 업로드할 수 있습니다.'); return; }
    file.arrayBuffer().then(C.readWorkbook).then(function (wb) {
      S.pendingUpload = { fileName: file.name, parsed: C.parseWorkbook(wb) };
      render();
    }).catch(function (e) { toast('읽기 실패: ' + e.message); });
  }
  function commitParsed(fileName, parsed) {
    var id = 'V' + new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    var hasSettings = parsed.summary.SETTINGS > 0;
    var settings = hasSettings ? Object.assign({}, C.DEFAULT_SETTINGS, parsed.settings) : S.settings;
    var up = { id: id, fileName: fileName, uploadedAt: new Date().toISOString(), summary: parsed.summary, errorCount: parsed.errorCount, warningCount: parsed.warningCount, data: parsed.data, settings: hasSettings ? settings : null };
    S.db = parsed.data; S.settings = settings;
    S.dataMeta = { version: id, fileName: fileName, uploadedAt: up.uploadedAt, summary: parsed.summary };
    return Promise.all([persistDb(), Store.putItem('uploads', up)]).then(function () {
      S.uploads.unshift(up); S.pendingUpload = null; S.result = null; S.selectedKey = null;
      toast('운임 데이터 등록 완료 (요율 ' + parsed.summary.CARRIER_RATE + '건)');
    });
  }

  // ----- Settings -----
  var SETTING_FIELDS = [
    ['COMPANY_NAME', '회사명 (영문, 견적서 상단)'], ['COMPANY_NAME_KR', '회사명 (한글)'], ['COMPANY_ADDRESS', '주소'],
    ['COMPANY_TEL', '대표 전화'], ['COMPANY_EMAIL', '대표 메일'], ['QUOTE_PREFIX', '견적번호 접두어'],
    ['QUOTE_VALID_DAYS', '견적 유효일수'], ['DEFAULT_BL_COUNT', '기본 B/L 건수'], ['EXPIRY_WARN_DAYS', '운임 만료 임박 경고 일수'],
    ['FX_USD_KRW', '참고 환율 USD/KRW (정렬 참고용, 합계 미합산)'], ['FX_DATE', '환율 기준일'], ['FX_SOURCE', '환율 출처']
  ];
  VIEWS.settings = function () {
    return '<h1>Settings</h1><p class="sub">회사 정보, 견적 유효일수, 참고 환율, 견적서 Terms를 관리합니다. Excel SETTINGS 시트로 올려도 됩니다.</p>' +
      '<div class="card"><div class="grid g3">' + SETTING_FIELDS.map(function (f) {
        return '<div><label class="f">' + h(f[1]) + '</label><input type="text" data-sf="' + f[0] + '" value="' + h(S.settings[f[0]]) + '"></div>';
      }).join('') + '</div><div class="mt"><label class="f">Terms & Conditions (견적서 하단)</label><textarea data-sf="TERMS" style="min-height:120px">' + h(S.settings.TERMS) + '</textarea></div>' +
      '<p class="small">기본 마진·고객별 단가·환율 자동 적용은 Phase 2 범위입니다. 환율은 기록·정렬 참고용이며 USD와 KRW를 합산하지 않습니다.</p>' +
      '<div class="row"><button class="btn primary" data-act="saveSettings">설정 저장</button></div></div>' +
      '<div class="card"><h2>데이터 관리</h2><p class="small" style="margin-top:0">데이터는 이 브라우저(IndexedDB)에만 저장됩니다. 다른 PC와 공유하려면 운임 Excel을 각자 업로드하세요 (Phase 3: 중앙 DB).</p>' +
      '<button class="btn" data-act="wipe" style="color:var(--bad)">이 브라우저의 모든 데이터 삭제</button></div>';
  };

  // ---------------- 동작 ----------------
  function calc() {
    var r = C.calculateQuote(dbForEngine(), S.form);
    var box = document.getElementById('formErr');
    if (r.errors.length) {
      if (box) box.innerHTML = '<div class="msg m-REVIEW_REQUIRED"><b>입력 확인</b>' + r.errors.map(h).join('<br>') + '</div>';
      return;
    }
    S.result = r;
    S.selectedKey = r.options.length ? r.options[0].key : null;
    render();
    var card = main.querySelector('.card.mt'); if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function currentQuoteRecord() {
    var o = selectedOption(); if (!o) return null;
    return {
      no: S.current && S.current.no, date: S.result.request.quoteDate, customer: S.result.request.customer,
      request: S.result.request, form: JSON.parse(JSON.stringify(S.form)), option: o, remark: S.remark,
      comparison: S.result.options.map(function (x) { return { carrier: x.carrier, routing: x.routing, via: x.via, totals: x.totals, pendingCount: x.pendingCount, missingTypes: x.missingTypes }; }),
      sortBasis: S.result.sortBasis, excluded: S.result.excluded, dataVersion: S.dataMeta ? S.dataMeta.version : (S.current && S.current.dataVersion) || '',
      settings: S.settings
    };
  }
  function saveQuote(newStatus, approver) {
    var rec = currentQuoteRecord(); if (!rec) return Promise.resolve(null);
    var now = new Date().toISOString();
    var noP = rec.no ? Promise.resolve(rec.no) : Store.nextQuoteNo(S.settings.QUOTE_PREFIX, rec.date);
    return noP.then(function (no) {
      rec.no = no;
      if (S.result.fromHistory && S.current) rec.dataVersion = S.current.dataVersion;
      rec.status = newStatus || rec.option.status;
      rec.approvedBy = newStatus === 'APPROVED' ? approver : '';
      rec.approvedAt = newStatus === 'APPROVED' ? localTime(now) : '';
      rec.createdAt = (S.current && S.current.no === no && S.current.createdAt) || now;
      rec.updatedAt = now;
      return Store.putItem('quotes', rec).then(function () {
        S.current = { no: no, status: rec.status, approvedBy: rec.approvedBy, approvedAt: rec.approvedAt, createdAt: rec.createdAt, dataVersion: rec.dataVersion };
        S.quotes = S.quotes.filter(function (q) { return q.no !== no; }); S.quotes.unshift(rec);
        return rec;
      });
    });
  }
  function openQuote(no, asCopy) {
    var q = S.quotes.filter(function (x) { return x.no === no; })[0]; if (!q) return;
    S.form = Object.assign(newForm(), JSON.parse(JSON.stringify(q.form || {})));
    if (asCopy) {
      S.current = null; S.remark = q.remark || ''; S.form.quoteDate = C.today();
      S.result = null; S.selectedKey = null;
      go('quote');
      if (S.db) calc();
      toast(q.no + ' 조건을 복사했습니다. 오늘 기준으로 다시 계산했습니다.');
      return;
    }
    S.current = { no: q.no, status: q.status, approvedBy: q.approvedBy, approvedAt: q.approvedAt, createdAt: q.createdAt, dataVersion: q.dataVersion };
    S.remark = q.remark || '';
    var opt = JSON.parse(JSON.stringify(q.option));
    S.result = { request: q.request, options: [opt], excluded: q.excluded || [], expiredRates: [], globalMessages: [], sortBasis: q.sortBasis, fromHistory: true };
    S.selectedKey = opt.key;
    go('breakdown');
  }
  function quoteForExcel(rec) {
    return { no: rec.no, date: rec.date, request: rec.request, status: rec.status, remark: rec.remark, approvedBy: rec.approvedBy, approvedAt: rec.approvedAt };
  }
  function fileBase(rec) { return [rec.no, safeName(rec.customer), rec.request.pol + '-' + rec.request.pod].filter(Boolean).join('_'); }
  function dlCustomer(rec) { download(C.buildCustomerQuotation(quoteForExcel(rec), rec.option, rec.settings || S.settings), fileBase(rec) + '.xlsx'); }
  function dlInternal(rec) { download(C.buildInternalQuotation(quoteForExcel(rec), rec.option, rec.settings || S.settings, { excluded: rec.excluded || [] }), fileBase(rec) + '_INTERNAL.xlsx'); }

  function loadSample() {
    var buf = C.buildTemplateWorkbook(true);
    return C.readWorkbook(buf).then(function (wb) {
      var parsed = C.parseWorkbook(wb);
      var doIt = function () { commitParsed('CMF_SAMPLE_DATA.xlsx', parsed).then(function () { go('quote'); }); };
      if (S.db) confirmBox('샘플 데이터 등록', '현재 운임 데이터를 샘플 데이터로 덮어씁니다. (기존 데이터는 업로드 이력에서 복원 가능)', '덮어쓰기', doIt);
      else doIt();
    });
  }

  main.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
    var act = el.dataset.act;
    switch (act) {
      case 'goUpload': go('upload'); break;
      case 'goQuote': go('quote'); break;
      case 'loadSample': loadSample(); break;
      case 'newQuote': S.form = newForm(); S.result = null; S.selectedKey = null; S.current = null; S.remark = ''; go('quote'); break;
      case 'dir':
        S.form.direction = el.dataset.v;
        S.form.includeOrigin = el.dataset.v === 'EXPORT'; S.form.includeDest = el.dataset.v === 'IMPORT';
        render(); break;
      case 'addCtr': S.form.containers.push({ type: '40HC', qty: 1 }); render(); break;
      case 'delCtr': S.form.containers.splice(+el.dataset.i, 1); render(); break;
      case 'resetForm': S.form = newForm(); S.result = null; render(); break;
      case 'calc': calc(); break;
      case 'selectOpt': S.selectedKey = el.dataset.key; render(); break;
      case 'toBreakdown': go('breakdown'); break;
      case 'recalc':
        S.result = null; go('quote'); calc(); toast('현재 운임 DB로 다시 계산했습니다. 저장하면 같은 견적번호로 갱신됩니다.'); break;
      case 'resetSell': {
        var o = selectedOption(); o.lines.forEach(function (l) { l.sellUnitPrice = l.unitPrice; }); C.recomputeTotals(o); render(); break;
      }
      case 'saveQuote':
        saveQuote().then(function (rec) { if (rec) { toast('저장됨: ' + rec.no + ' (' + rec.status + ')'); render(); } }); break;
      case 'approve': {
        var op = selectedOption(); if (!op) break;
        modal('<h3>담당자 승인</h3><p class="small" style="margin-top:0">승인하면 견적 상태가 APPROVED로 바뀌고 고객용 견적서의 DRAFT 표시가 사라집니다.</p>' +
          '<label class="f req">승인자</label><input type="text" id="apName" placeholder="이름">' +
          (op.legalHold ? '<label class="chk mt"><input type="checkbox" id="apLegal"> 법적 검토(위험물 승인·제재·규제) 완료를 확인했습니다</label>' : '') +
          (op.pendingCount ? '<label class="chk mt"><input type="checkbox" id="apPending"> 미확정 ' + op.pendingCount + '건은 TBA로 제출하는 것을 확인했습니다</label>' : '') +
          '<div id="apErr" class="small" style="color:var(--bad);margin-top:8px"></div>' +
          '<div class="row mt" style="justify-content:flex-end"><button class="btn" data-close>취소</button><button class="btn green" id="apOk">승인</button></div>',
          function (box, close) {
            box.querySelector('#apOk').onclick = function () {
              var name = box.querySelector('#apName').value.trim();
              var err = !name ? '승인자 이름을 입력하세요.' :
                (op.legalHold && !box.querySelector('#apLegal').checked) ? '법적 검토 완료 확인이 필요합니다.' :
                  (op.pendingCount && !box.querySelector('#apPending').checked) ? '미확정 항목 처리 확인이 필요합니다.' : '';
              if (err) { box.querySelector('#apErr').textContent = err; return; }
              close();
              saveQuote('APPROVED', name).then(function (rec) { toast(rec.no + ' 승인 완료'); render(); });
            };
          });
        break;
      }
      case 'dlCustomerCur': saveQuote(S.current && S.current.status === 'APPROVED' ? 'APPROVED' : null, S.current && S.current.approvedBy).then(function (rec) { if (rec) { dlCustomer(rec); render(); } }); break;
      case 'dlInternalCur': saveQuote(S.current && S.current.status === 'APPROVED' ? 'APPROVED' : null, S.current && S.current.approvedBy).then(function (rec) { if (rec) { dlInternal(rec); render(); } }); break;
      case 'openQuote': openQuote(el.dataset.no, false); break;
      case 'copyQuote': openQuote(el.dataset.no, true); break;
      case 'dlCustomer': case 'dlInternal': {
        var q = S.quotes.filter(function (x) { return x.no === el.dataset.no; })[0];
        if (q) (act === 'dlCustomer' ? dlCustomer : dlInternal)(q); break;
      }
      case 'rateTab': S.rateTab = el.dataset.t; render(); break;
      case 'exportDb': download(exportDbWorkbook(), 'CMF_RATE_DB_' + (S.dataMeta ? S.dataMeta.version : C.today()) + '.xlsx'); break;
      case 'dlTemplate': download(C.buildTemplateWorkbook(el.dataset.sample === '1'), el.dataset.sample === '1' ? 'CMF_RATE_TEMPLATE_SAMPLE.xlsx' : 'CMF_RATE_TEMPLATE.xlsx'); break;
      case 'cancelUpload': S.pendingUpload = null; render(); break;
      case 'commitUpload': {
        var pu = S.pendingUpload;
        var doCommit = function () { commitParsed(pu.fileName, pu.parsed).then(render); };
        if (S.db) confirmBox('기존 데이터 덮어쓰기', '현재 등록된 운임 데이터(' + h(S.dataMeta.fileName) + ', 요율 ' + (S.db.CARRIER_RATE || []).length + '건)를 <b>' + h(pu.fileName) + '</b>(요율 ' + pu.parsed.summary.CARRIER_RATE + '건)로 교체합니다.<br>' +
          (pu.parsed.errorCount ? '오류 ' + pu.parsed.errorCount + '건의 행은 제외됩니다.<br>' : '') + '이전 버전은 업로드 이력에서 복원할 수 있습니다.', '덮어쓰기', doCommit);
        else doCommit();
        break;
      }
      case 'restoreVer': {
        var u = S.uploads.filter(function (x) { return x.id === el.dataset.id; })[0]; if (!u) break;
        confirmBox('버전 복원', h(u.id) + ' (' + h(u.fileName) + ') 데이터로 되돌립니다.', '복원', function () {
          S.db = u.data; if (u.settings) S.settings = Object.assign({}, C.DEFAULT_SETTINGS, u.settings);
          S.dataMeta = { version: u.id, fileName: u.fileName, uploadedAt: u.uploadedAt, summary: u.summary };
          S.result = null; persistDb().then(function () { toast('복원 완료'); render(); });
        });
        break;
      }
      case 'saveSettings':
        main.querySelectorAll('[data-sf]').forEach(function (i) { S.settings[i.dataset.sf] = i.value; });
        Store.set('settings', S.settings).then(function () { toast('설정 저장됨'); }); break;
      case 'wipe':
        confirmBox('모든 데이터 삭제', '이 브라우저에 저장된 운임 데이터, 업로드 이력, 견적 이력이 모두 삭제됩니다. 되돌릴 수 없습니다.', '삭제', function () {
          var req = window.indexedDB ? window.indexedDB.deleteDatabase('cmf-quotation') : null;
          var done = function () { location.reload(); };
          if (req) { req.onsuccess = done; req.onerror = done; req.onblocked = done; } else done();
        });
        break;
    }
  });

  main.addEventListener('change', function (e) {
    var t = e.target;
    if (t.dataset.f) { S.form[t.dataset.f] = t.type === 'checkbox' ? t.checked : t.value; return; }
    if (t.dataset.ci != null) {
      var c = S.form.containers[+t.dataset.ci];
      c[t.dataset.cf] = t.dataset.cf === 'qty' ? t.value : t.value; return;
    }
    if (t.dataset.line != null) {
      var o = selectedOption(), l = o.lines[+t.dataset.line];
      if (t.dataset.lf === 'include') l.include = t.checked;
      if (t.dataset.lf === 'sell') l.sellUnitPrice = t.value === '' ? l.unitPrice : Number(t.value);
      C.recomputeTotals(o);
      if (S.current && S.current.status === 'APPROVED') S.current.status = o.status; // 수정 시 승인 해제
      render(); return;
    }
    if (t.dataset.hf) { S[t.dataset.hf] = t.value; render(); restoreFocus(t.dataset.hf, 'hf'); return; }
    if (t.dataset.rf) { S[t.dataset.rf] = t.value; render(); restoreFocus(t.dataset.rf, 'rf'); return; }
  });
  main.addEventListener('input', function (e) {
    var t = e.target;
    if (t.dataset.f2 === 'remark') { S.remark = t.value; return; }
    if (t.dataset.f && t.type !== 'checkbox') { S.form[t.dataset.f] = t.value; return; }
    if (t.dataset.ci != null) { S.form.containers[+t.dataset.ci][t.dataset.cf] = t.value; return; }
    if ((t.dataset.hf || t.dataset.rf) && t.type === 'text') {
      var key = t.dataset.hf || t.dataset.rf; S[key] = t.value;
      clearTimeout(main._ft); main._ft = setTimeout(function () { render(); restoreFocus(key, t.dataset.hf ? 'hf' : 'rf'); }, 250);
    }
  });
  main.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && S.view === 'quote' && e.target.matches('input[type=text],input[type=number],input[type=date]')) {
      var t = e.target;
      if (t.dataset.f) S.form[t.dataset.f] = t.value;
      calc();
    }
  });
  function restoreFocus(key, kind) {
    var el = main.querySelector('[data-' + kind + '="' + key + '"]');
    if (el && el.type === 'text') { el.focus(); var v = el.value; el.value = ''; el.value = v; }
  }

  function exportDbWorkbook() {
    // 현재 DB를 업로드 템플릿과 같은 형식으로 내보내기 (수정 후 재업로드용)
    var sheets = [];
    C.SHEET_ORDER.forEach(function (name) {
      var def = C.SHEETS[name];
      var rows = [def.fields.map(function (f) { return { v: f.key, s: 'header' }; })];
      var data = name === 'SETTINGS'
        ? Object.keys(S.settings).map(function (k) { return { KEY: k, VALUE: S.settings[k] }; })
        : ((S.db && S.db[name]) || []);
      data.forEach(function (rec) {
        rows.push(def.fields.map(function (f) {
          var v = rec[f.key];
          if (v == null || v === '' || v === 'ALL' && (f.type === 'carrierOrAll' || f.type === 'containerOrAll' || f.type === 'directionAll' || f.type === 'condition')) return null;
          if (f.type === 'portRole' && v === 'ANY') return null;
          if (Array.isArray(v)) return v.length ? { v: v.join(','), s: 'text' } : null;
          if (f.type === 'date') return { v: v, s: 'date', date: true };
          if (typeof v === 'number') return { v: v, s: 'numRight' };
          return { v: v, s: 'text' };
        }));
      });
      sheets.push({ name: name, rows: rows, freeze: 1, cols: def.fields.map(function (f) { return f.key === 'VALUE' || f.key === 'MESSAGE' ? 60 : Math.max(12, f.key.length + 3); }) });
    });
    return C.writeWorkbook(sheets, { title: 'CMF Rate DB' });
  }

  // ---------------- 시작 ----------------
  loadAll().then(function () { render(); }).catch(function (e) { console.error(e); render(); });
})();
