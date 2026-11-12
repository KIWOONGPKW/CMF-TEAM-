/* CMF Freight Quotation System - 견적 산출 엔진 (UI와 독립된 순수 계산 모듈)
 *
 * 원칙
 *  - 등록된 데이터에 있는 금액만 사용한다. 운임/비용이 없거나 만료되면 금액을 만들지 않고 PENDING(확인 필요)으로 둔다.
 *  - 통화별로 합계를 따로 낸다. 환율은 정렬 참고용으로만 쓰며 합계에 섞지 않는다.
 *  - 운임 포함(INCLUDED) / 견적 제외(EXCLUDED) 항목은 합계에 넣지 않는다.
 */
(function (root, factory) {
  var N = (typeof module === 'object' && module.exports) ? require('./normalize.js') : root.CMF;
  var m = factory(N);
  if (typeof module === 'object' && module.exports) module.exports = m;
  else { root.CMF = root.CMF || {}; Object.assign(root.CMF, m); }
})(typeof self !== 'undefined' ? self : this, function (N) {
  'use strict';

  var CONTAINER_UNITS = ['PER_CONTAINER', 'PER_TEU', 'PER_DAY'];
  var UNIT_LABEL = {
    PER_CONTAINER: 'CNTR', PER_TEU: 'TEU', PER_DAY: 'DAY', PER_BL: 'B/L',
    PER_SHIPMENT: 'SHPT', PER_KG: 'KG', PERCENTAGE: '%'
  };
  var SECTION_LABEL = { OCEAN: 'Ocean Freight', ORIGIN: 'Origin Local Charges', DEST: 'Destination Local Charges', SPECIAL: 'Additional Charges' };

  function round2(x) { return Math.round((x + Number.EPSILON) * 100) / 100; }
  function validOn(rec, date) {
    return (!rec.VALID_FROM || rec.VALID_FROM <= date) && (!rec.VALID_TO || date <= rec.VALID_TO);
  }
  function dirMatch(recDir, reqDir) { return !recDir || recDir === 'ALL' || recDir === reqDir; }
  function carrierMatch(recCarrier, carrier) { return !recCarrier || recCarrier === 'ALL' || recCarrier === carrier; }

  function condMatch(cond, req, ctype) {
    switch (cond || 'ALL') {
      case 'ALL': return true;
      case 'DG': return !!req.dg;
      case 'NON_DG': return !req.dg;
      case 'DOOR': return !!req.door;
      case 'REEFER': return ctype ? N.isReeferType(ctype) : !!req.reefer;
      case 'DRY': return ctype ? !N.isReeferType(ctype) : !req.reefer;
    }
    return false;
  }

  /** 입력값 정규화 및 검증 */
  function normalizeRequest(raw, db) {
    var portIndex = N.buildPortIndex((db && db.PORT) || []);
    var errors = [];
    var direction = N.normalizeDirection(raw.direction, false);
    if (!direction) errors.push('수출/수입 구분을 선택하세요.');
    var pol = N.normalizePort(raw.pol, portIndex), pod = N.normalizePort(raw.pod, portIndex);
    if (!pol.code) errors.push('POL을 입력하세요.');
    if (!pod.code) errors.push('POD를 입력하세요.');
    if (pol.code && pol.code === pod.code) errors.push('POL과 POD가 같습니다.');
    var map = {}, order = [];
    (raw.containers || []).forEach(function (c, i) {
      if (!c || (!c.type && !c.qty)) return;
      var t = N.normalizeContainer(c.type).code;
      var q = Number(c.qty);
      if (!t || t === 'ALL') { errors.push('컨테이너 TYPE을 선택하세요 (' + (i + 1) + '행).'); return; }
      if (!isFinite(q) || q <= 0 || Math.floor(q) !== q) { errors.push(t + ' 수량은 1 이상의 정수여야 합니다.'); return; }
      if (!map[t]) { map[t] = 0; order.push(t); }
      map[t] += q;
    });
    if (!order.length) errors.push('컨테이너 TYPE과 수량을 1개 이상 입력하세요.');
    var containers = order.map(function (t) { return { type: t, qty: map[t] }; });
    var quoteDate = N.normalizeDate(raw.quoteDate) || N.today();
    var settings = (db && db.settings) || {};
    var bl = Number(raw.blCount || settings.DEFAULT_BL_COUNT || 1);
    var gw = raw.grossWeightKg === '' || raw.grossWeightKg == null ? null : Number(raw.grossWeightKg);
    var days = raw.storageDays === '' || raw.storageDays == null ? null : Number(raw.storageDays);
    var anyReeferType = containers.some(function (c) { return N.isReeferType(c.type); });
    var req = {
      direction: direction, pol: pol.code, pod: pod.code, polKnown: pol.known, podKnown: pod.known,
      polName: N.portName(pol.code, portIndex), podName: N.portName(pod.code, portIndex),
      containers: containers, quoteDate: quoteDate,
      carrier: raw.carrier ? N.normalizeCarrier(raw.carrier) : '',
      dg: !!raw.dg, reefer: !!raw.reefer || anyReeferType, reeferTemp: raw.reeferTemp || '', door: !!raw.door,
      grossWeightKg: gw != null && isFinite(gw) && gw > 0 ? gw : null,
      storageDays: days != null && isFinite(days) && days > 0 ? days : null,
      blCount: isFinite(bl) && bl >= 1 ? Math.floor(bl) : 1,
      includeOrigin: raw.includeOrigin == null ? direction !== 'IMPORT' : !!raw.includeOrigin,
      includeDest: raw.includeDest == null ? direction === 'IMPORT' : !!raw.includeDest,
      incoterms: raw.incoterms || '', customer: raw.customer || '', cargo: raw.cargo || '', currency: raw.currency || ''
    };
    if (raw.reefer && !anyReeferType && containers.length) errors.push('Reefer 화물로 표시했지만 RF 컨테이너가 선택되지 않았습니다.');
    return { req: req, errors: errors };
  }

  function makeLine(o) {
    var line = {
      id: o.id, section: o.section, code: o.code, name: o.name, unit: o.unit, containerType: o.containerType || '',
      qty: o.qty, unitPrice: o.unitPrice, currency: o.currency || '', status: o.status, include: o.include !== false,
      note: o.note || '', basis: o.basis || '', source: o.source || null
    };
    line.amount = (line.status === 'OK' && line.unitPrice != null && line.qty != null) ? round2(line.unitPrice * line.qty) : null;
    line.sellUnitPrice = line.unitPrice;
    return line;
  }

  function src(rec) { return rec ? { sheet: rec._sheet, row: rec._row, id: rec.RATE_ID || rec.REMARK_ID || '' } : null; }

  /** 과금 단위 → 수량 계산. 수량을 알 수 없으면 null + 사유 */
  function quantityFor(unit, req, ctype, ctx) {
    var cnt = 0;
    if (ctype) req.containers.forEach(function (c) { if (c.type === ctype) cnt = c.qty; });
    switch (unit) {
      case 'PER_CONTAINER': return { qty: cnt, basis: ctype + ' × ' + cnt };
      case 'PER_TEU': { var teu = N.teuOf(ctype) * cnt; return { qty: teu, basis: ctype + ' ' + cnt + '대 = ' + teu + ' TEU' }; }
      case 'PER_DAY':
        if (!req.storageDays) return { qty: null, reason: '일수(보관/사용일) 입력 필요' };
        return { qty: req.storageDays * cnt, basis: req.storageDays + '일 × ' + ctype + ' ' + cnt + '대' };
      case 'PER_BL': return { qty: req.blCount, basis: 'B/L ' + req.blCount + '건' };
      case 'PER_SHIPMENT': return { qty: 1, basis: '1 Shipment' };
      case 'PER_KG':
        if (!req.grossWeightKg) return { qty: null, reason: 'Gross Weight 입력 필요' };
        return { qty: req.grossWeightKg, basis: req.grossWeightKg + ' KG' };
    }
    return { qty: null, reason: '알 수 없는 과금 단위' };
  }

  /** 단일 비용 행을 견적 라인으로 변환 */
  function chargeLine(rec, section, req, ctype, ctx, opt) {
    var unit = rec.CHARGE_UNIT;
    var code = rec.CHARGE_CODE, name = rec.CHARGE_NAME;
    var base = {
      id: section + ':' + code + ':' + (ctype || 'SHPT') + ':' + (opt.idSuffix || ''),
      section: section, code: code, name: name, unit: unit, containerType: ctype,
      currency: rec.CURRENCY, include: opt.include, source: src(rec)
    };
    if (opt.includedInOF) {
      base.status = 'INCLUDED'; base.qty = null; base.unitPrice = null;
      base.note = opt.includedReason || '해상운임에 포함';
      return makeLine(base);
    }
    if (rec.CHARGE_AMOUNT == null) {
      base.status = 'PENDING'; base.qty = null; base.unitPrice = null; base.note = '금액 미확정 - 확인 필요';
      return makeLine(base);
    }
    if (unit === 'PERCENTAGE') {
      var ofTotal = ctx.oceanTotals[rec.CURRENCY];
      if (ctx.oceanPending || ofTotal == null) {
        base.status = 'PENDING'; base.qty = null; base.unitPrice = null;
        base.note = rec.CHARGE_AMOUNT + '% - 동일 통화(' + rec.CURRENCY + ') 해상운임 확정 후 계산';
        return makeLine(base);
      }
      base.status = 'OK'; base.qty = 1; base.unitPrice = round2(ofTotal * rec.CHARGE_AMOUNT / 100);
      base.basis = 'O/F ' + rec.CURRENCY + ' ' + ofTotal + ' × ' + rec.CHARGE_AMOUNT + '%';
      return makeLine(base);
    }
    var q = quantityFor(unit, req, ctype, ctx);
    if (q.qty == null) {
      base.status = 'PENDING'; base.qty = null; base.unitPrice = rec.CHARGE_AMOUNT; base.note = q.reason;
      return makeLine(base);
    }
    base.status = 'OK'; base.qty = q.qty; base.unitPrice = rec.CHARGE_AMOUNT; base.basis = q.basis;
    return makeLine(base);
  }

  /**
   * LOCAL CHARGE 산출
   * 우선순위: (선사 지정 + 컨테이너 지정) > (선사 지정 + 전체) > (공통 + 컨테이너 지정) > (공통 + 전체)
   */
  function resolveCharges(table, section, port, carrier, req, ctx, include, rateIncluded) {
    var lines = [];
    var all = (table || []).filter(function (r) {
      return r.PORT_CODE === port && dirMatch(r.DIRECTION, req.direction) && carrierMatch(r.CARRIER, carrier);
    });
    var codes = [];
    all.forEach(function (r) { if (codes.indexOf(r.CHARGE_CODE) < 0) codes.push(r.CHARGE_CODE); });
    var types = req.containers.map(function (c) { return c.type; });

    function score(r, t) { return (r.CARRIER && r.CARRIER !== 'ALL' ? 2 : 0) + (r.CONTAINER_TYPE && r.CONTAINER_TYPE !== 'ALL' && r.CONTAINER_TYPE === t ? 1 : 0); }
    function typeOk(r, t) { return !r.CONTAINER_TYPE || r.CONTAINER_TYPE === 'ALL' || r.CONTAINER_TYPE === t; }
    function pick(rows, t) {
      var best = null, bs = -1;
      rows.forEach(function (r) {
        if (!typeOk(r, t) || !condMatch(r.CHARGE_CONDITION, req, t)) return;
        var s = score(r, t);
        if (s > bs) { bs = s; best = r; }
      });
      return best;
    }

    codes.forEach(function (code) {
      var rowsAll = all.filter(function (r) { return r.CHARGE_CODE === code; });
      var rowsValid = rowsAll.filter(function (r) { return validOn(r, req.quoteDate); });
      var shipmentPick = null, shipmentScore = -1;
      var expiredNoted = false;
      types.forEach(function (t) {
        var best = pick(rowsValid, t);
        if (!best) {
          var exp = pick(rowsAll, t);
          if (exp && !expiredNoted) {
            var isCtr = CONTAINER_UNITS.indexOf(exp.CHARGE_UNIT) >= 0;
            lines.push(makeLine({
              id: section + ':' + code + ':' + (isCtr ? t : 'SHPT') + ':EXP', section: section, code: code, name: exp.CHARGE_NAME,
              unit: exp.CHARGE_UNIT, containerType: isCtr ? t : '', qty: null, unitPrice: null, currency: exp.CURRENCY,
              status: 'PENDING', include: include, source: src(exp),
              note: '요율 유효기간 만료(' + exp.VALID_FROM + '~' + exp.VALID_TO + ') - 최신 요율 확인 필요'
            }));
            if (!isCtr) expiredNoted = true;
          }
          return;
        }
        if (CONTAINER_UNITS.indexOf(best.CHARGE_UNIT) >= 0) {
          var inc = best.INCLUDED_IN_OF === 'Y' || (rateIncluded.byType[t] || []).indexOf(code) >= 0;
          lines.push(chargeLine(best, section, req, t, ctx, {
            include: include, includedInOF: inc,
            includedReason: best.INCLUDED_IN_OF === 'Y' ? '해상운임 포함 (요율표 INCLUDED_IN_OF=Y)' : '해상운임 포함 (선사 운임 INCLUDED_CHARGES)'
          }));
        } else {
          var s = score(best, t);
          if (s > shipmentScore) { shipmentScore = s; shipmentPick = best; }
        }
      });
      if (shipmentPick) {
        var incS = shipmentPick.INCLUDED_IN_OF === 'Y' || rateIncluded.any.indexOf(code) >= 0;
        lines.push(chargeLine(shipmentPick, section, req, '', ctx, {
          include: include, includedInOF: incS,
          includedReason: shipmentPick.INCLUDED_IN_OF === 'Y' ? '해상운임 포함 (요율표 INCLUDED_IN_OF=Y)' : '해상운임 포함 (선사 운임 INCLUDED_CHARGES)'
        }));
      }
    });
    return lines;
  }

  /** PORT_REMARK 적용 */
  function applyRemarks(remarks, carrier, req, ctx, option) {
    var types = req.containers.map(function (c) { return c.type; });
    (remarks || []).forEach(function (r) {
      if (!validOn(r, req.quoteDate)) return;
      if (!dirMatch(r.DIRECTION, req.direction)) return;
      if (!carrierMatch(r.CARRIER, carrier)) return;
      var role = r.PORT_ROLE || 'ANY';
      var portOk = r.PORT_CODE === 'ALL' ||
        (role !== 'POD' && r.PORT_CODE === req.pol) || (role !== 'POL' && r.PORT_CODE === req.pod);
      if (!portOk) return;
      var matchTypes = types.filter(function (t) {
        return (!r.CONTAINER_TYPE || r.CONTAINER_TYPE === 'ALL' || r.CONTAINER_TYPE === t) && condMatch(r.CARGO_CONDITION, req, t);
      });
      if (!matchTypes.length) return;
      var legal = r.LEGAL_REVIEW === 'Y';
      if (legal) option.legalHold = true;
      var msg = { type: r.REMARK_TYPE, title: r.TITLE, message: r.MESSAGE || '', legal: legal, source: src(r) };
      if (r.REMARK_TYPE === 'AUTO_CHARGE') {
        var section = 'SPECIAL';
        var pseudo = {
          _sheet: r._sheet, _row: r._row, REMARK_ID: r.REMARK_ID, CHARGE_CODE: r.CHARGE_CODE, CHARGE_NAME: r.CHARGE_NAME,
          CHARGE_UNIT: r.CHARGE_UNIT, CHARGE_AMOUNT: r.CHARGE_AMOUNT, CURRENCY: r.CURRENCY || ''
        };
        if (CONTAINER_UNITS.indexOf(r.CHARGE_UNIT) >= 0) {
          matchTypes.forEach(function (t) {
            option.lines.push(chargeLine(pseudo, section, req, t, ctx, { include: true, idSuffix: 'R' + r._row }));
          });
        } else {
          option.lines.push(chargeLine(pseudo, section, req, '', ctx, { include: true, idSuffix: 'R' + r._row }));
        }
        msg.type = 'INFORMATION';
        msg.title = '[자동 추가] ' + r.TITLE;
        if (r.CHARGE_AMOUNT == null) { msg.type = 'REVIEW_REQUIRED'; option.reviewRequired = true; msg.message = (msg.message ? msg.message + ' ' : '') + '(금액 미확정 - 확인 필요)'; }
      }
      if (r.REMARK_TYPE === 'REVIEW_REQUIRED') option.reviewRequired = true;
      if (legal) option.reviewRequired = true;
      option.messages.push(msg);
    });
  }

  /** 통화별 합계 재계산 (화면에서 포함/제외·판매가 변경 시 호출) */
  function recomputeTotals(option) {
    var cost = {}, sell = {}, pending = 0, pendingItems = [];
    option.lines.forEach(function (l) {
      if (l.status === 'OK') {
        l.amount = round2(l.unitPrice * l.qty);
        var su = l.sellUnitPrice == null || l.sellUnitPrice === '' ? l.unitPrice : Number(l.sellUnitPrice);
        l.sellAmount = round2(su * l.qty);
      } else { l.sellAmount = null; }
      if (!l.include) return;
      if (l.status === 'OK') {
        cost[l.currency] = round2((cost[l.currency] || 0) + l.amount);
        sell[l.currency] = round2((sell[l.currency] || 0) + l.sellAmount);
      } else if (l.status === 'PENDING') { pending++; pendingItems.push(l); }
    });
    option.totals = cost; option.sellTotals = sell;
    option.pendingCount = pending; option.pendingItems = pendingItems;
    option.complete = pending === 0 && !option.missingTypes.length;
    option.status = (option.legalHold || option.reviewRequired || !option.complete) ? 'REVIEW_REQUIRED' : 'DRAFT';
    return option;
  }

  function currencyOrder(a, b) {
    var pr = { USD: 0, KRW: 1 };
    var pa = a in pr ? pr[a] : 2, pb = b in pr ? pr[b] : 2;
    return pa - pb || (a < b ? -1 : a > b ? 1 : 0);
  }

  /** 비교 정렬: 해상운임 누락 없는 선사 우선 → 총원가 낮은 순 */
  function compareOptions(fx) {
    return function (a, b) {
      var ma = a.missingTypes.length ? 1 : 0, mb = b.missingTypes.length ? 1 : 0;
      if (ma !== mb) return ma - mb;
      var ca = Object.keys(a.totals), cb = Object.keys(b.totals);
      var onlyUK = ca.concat(cb).every(function (c) { return c === 'USD' || c === 'KRW'; });
      if (fx && onlyUK) {
        var ra = (a.totals.USD || 0) * fx + (a.totals.KRW || 0), rb = (b.totals.USD || 0) * fx + (b.totals.KRW || 0);
        if (ra !== rb) return ra - rb;
      } else {
        var cur = ca.concat(cb).filter(function (c, i, arr) { return arr.indexOf(c) === i; }).sort(currencyOrder);
        for (var i = 0; i < cur.length; i++) {
          var va = a.totals[cur[i]] || 0, vb = b.totals[cur[i]] || 0;
          if (va !== vb) return va - vb;
        }
      }
      return a.pendingCount - b.pendingCount || (a.carrier < b.carrier ? -1 : 1);
    };
  }

  /**
   * 견적 산출 메인
   * @param db {CARRIER_RATE, ORIGIN_CHARGE, DEST_CHARGE, PORT_REMARK, PORT, settings}
   * @param raw 입력값
   */
  function calculateQuote(db, raw) {
    var nr = normalizeRequest(raw, db);
    var req = nr.req;
    var result = { request: req, errors: nr.errors, options: [], excluded: [], expiredRates: [], globalMessages: [] };
    if (nr.errors.length) return result;
    var settings = db.settings || {};
    var warnDays = Number(settings.EXPIRY_WARN_DAYS || 7);
    var validDays = Number(settings.QUOTE_VALID_DAYS || 14);
    var types = req.containers.map(function (c) { return c.type; });

    // 1) 해상운임 검색
    var routeRates = (db.CARRIER_RATE || []).filter(function (r) {
      return r.DIRECTION === req.direction && r.POL === req.pol && r.POD === req.pod &&
        types.indexOf(r.CONTAINER_TYPE) >= 0 && (!req.carrier || r.CARRIER === req.carrier);
    });
    var valid = [];
    routeRates.forEach(function (r) {
      if (!validOn(r, req.quoteDate)) { result.expiredRates.push(r); return; }
      if (req.dg && r.DG_ACCEPT === 'N') { result.excluded.push({ carrier: r.CARRIER, type: r.CONTAINER_TYPE, reason: '위험물(DG) 미수용 요율', source: src(r) }); return; }
      valid.push(r);
    });

    // 2) 선사 + 루팅 단위로 그룹
    var groups = {}, gorder = [];
    valid.forEach(function (r) {
      var key = r.CARRIER + '|' + (r.ROUTING || '') + '|' + (r.VIA || '');
      if (!groups[key]) { groups[key] = { carrier: r.CARRIER, routing: r.ROUTING || '', via: r.VIA || '', byType: {} }; gorder.push(key); }
      var cur = groups[key].byType[r.CONTAINER_TYPE];
      if (!cur || (cur.CURRENCY === r.CURRENCY && r.OCEAN_FREIGHT < cur.OCEAN_FREIGHT)) groups[key].byType[r.CONTAINER_TYPE] = r;
    });

    if (!gorder.length) {
      result.globalMessages.push({
        type: 'WARNING', title: '운임 확인 필요',
        message: '조건(' + req.direction + ' ' + req.pol + '→' + req.pod + ' ' + types.join('/') + (req.carrier ? ' ' + req.carrier : '') + ')에 맞는 유효한 해상운임이 없습니다.' +
          (result.expiredRates.length ? ' 만료된 요율 ' + result.expiredRates.length + '건이 있습니다 - 최신 운임을 등록하세요.' : '') +
          (result.excluded.length ? ' 위험물(DG) 미수용으로 제외된 요율 ' + result.excluded.length + '건 (' + result.excluded.map(function (e) { return e.carrier + ' ' + e.type; }).join(', ') + ').' : '')
      });
      return result;
    }

    gorder.forEach(function (key) {
      var g = groups[key];
      var option = {
        key: key, carrier: g.carrier, routing: g.routing, via: g.via, rates: g.byType, missingTypes: [],
        lines: [], messages: [], legalHold: false, reviewRequired: false
      };
      var oceanTotals = {}, oceanPending = false;
      var rateIncluded = { byType: {}, any: [] };
      var tts = [], frees = [], validTo = null, excludedTxt = [];
      req.containers.forEach(function (c) {
        var r = g.byType[c.type];
        if (!r) {
          option.missingTypes.push(c.type); oceanPending = true;
          option.lines.push(makeLine({
            id: 'OCEAN:OF:' + c.type, section: 'OCEAN', code: 'O/F', name: 'Ocean Freight', unit: 'PER_CONTAINER', containerType: c.type,
            qty: c.qty, unitPrice: null, currency: '', status: 'PENDING', note: '운임 확인 필요 (' + c.type + ' 유효 운임 없음)'
          }));
          return;
        }
        var line = makeLine({
          id: 'OCEAN:OF:' + c.type, section: 'OCEAN', code: 'O/F', name: 'Ocean Freight', unit: 'PER_CONTAINER', containerType: c.type,
          qty: c.qty, unitPrice: r.OCEAN_FREIGHT, currency: r.CURRENCY, status: 'OK', basis: c.type + ' × ' + c.qty,
          source: src(r)
        });
        option.lines.push(line);
        oceanTotals[r.CURRENCY] = round2((oceanTotals[r.CURRENCY] || 0) + line.amount);
        rateIncluded.byType[c.type] = r.INCLUDED_CHARGES || [];
        (r.INCLUDED_CHARGES || []).forEach(function (x) { if (rateIncluded.any.indexOf(x) < 0) rateIncluded.any.push(x); });
        if (r.TRANSIT_DAYS != null) tts.push(r.TRANSIT_DAYS);
        if (r.FREE_TIME && frees.indexOf(r.FREE_TIME) < 0) frees.push(r.FREE_TIME);
        if (r.EXCLUDED_CHARGES && excludedTxt.indexOf(r.EXCLUDED_CHARGES) < 0) excludedTxt.push(r.EXCLUDED_CHARGES);
        if (!validTo || r.VALID_TO < validTo) validTo = r.VALID_TO;
        var left = N.daysBetween(req.quoteDate, r.VALID_TO);
        if (left <= warnDays) option.messages.push({ type: 'WARNING', title: '운임 유효기간 임박', message: g.carrier + ' ' + c.type + ' 운임이 ' + r.VALID_TO + '에 만료됩니다 (D-' + left + ').', source: src(r) });
        if (r.REMARK) option.messages.push({ type: 'INFORMATION', title: g.carrier + ' ' + c.type + ' 운임 비고', message: r.REMARK, source: src(r) });
      });
      option.transitDays = tts.length ? Math.max.apply(null, tts) : null;
      option.freeTime = frees.join(' / ');
      option.rateValidTo = validTo;
      option.excludedText = excludedTxt.join(' / ');
      option.includedCharges = rateIncluded.any.slice();
      var qv = N.addDays(req.quoteDate, validDays - 1);
      option.quoteValidUntil = validTo && validTo < qv ? validTo : qv;
      if (option.missingTypes.length) option.messages.push({ type: 'WARNING', title: '운임 확인 필요', message: option.missingTypes.join(', ') + ' 유효 운임이 등록되어 있지 않습니다.' });

      var ctx = { oceanTotals: oceanTotals, oceanPending: oceanPending };
      option.lines = option.lines.concat(
        resolveCharges(db.ORIGIN_CHARGE, 'ORIGIN', req.pol, g.carrier, req, ctx, req.includeOrigin, rateIncluded),
        resolveCharges(db.DEST_CHARGE, 'DEST', req.pod, g.carrier, req, ctx, req.includeDest, rateIncluded)
      );
      applyRemarks(db.PORT_REMARK, g.carrier, req, ctx, option);

      if (req.dg) {
        option.legalHold = true; option.reviewRequired = true;
        option.messages.push({ type: 'REVIEW_REQUIRED', legal: true, title: '위험물(DG) 화물', message: '선사 DG 승인, MSDS 및 DG Declaration 확인 전 견적 확정 불가 (담당자 승인 필요)' });
      }
      if (req.reefer) option.messages.push({ type: 'INFORMATION', title: 'Reefer 화물', message: '설정 온도: ' + (req.reeferTemp || '미입력') + ' - Reefer 전원/PTI 비용 및 장비 가용 여부 확인' });
      var seen = {};
      option.messages = option.messages.filter(function (m) { var k = m.type + '|' + m.title + '|' + m.message; if (seen[k]) return false; seen[k] = true; return true; });
      recomputeTotals(option);
      var curs = Object.keys(option.totals);
      if (curs.length > 1) option.messages.push({ type: 'INFORMATION', title: '복수 통화', message: '통화별 합계를 따로 표시합니다 (' + curs.sort(currencyOrder).join(', ') + '). 환율 미적용 시 합산하지 않습니다.' });
      result.options.push(option);
    });

    var fx = Number(settings.FX_USD_KRW) || 0;
    result.options.sort(compareOptions(fx));
    result.sortBasis = fx ? '총원가 (USD×' + fx + ' 환산 참고, 기준일 ' + (settings.FX_DATE || '-') + ')' : '총원가 (USD 합계 → KRW 합계 순)';
    return result;
  }

  function containerSummary(req) {
    return req.containers.map(function (c) { return c.type + ' × ' + c.qty; }).join(' + ');
  }

  return {
    calculateQuote: calculateQuote, recomputeTotals: recomputeTotals, normalizeRequest: normalizeRequest,
    compareOptions: compareOptions, containerSummary: containerSummary, currencyOrder: currencyOrder,
    UNIT_LABEL: UNIT_LABEL, SECTION_LABEL: SECTION_LABEL, round2: round2
  };
});
