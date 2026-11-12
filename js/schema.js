/* CMF Freight Quotation System - Excel 데이터 시트 정의 및 검증 */
(function (root, factory) {
  var N = (typeof module === 'object' && module.exports) ? require('./normalize.js') : root.CMF;
  var m = factory(N);
  if (typeof module === 'object' && module.exports) module.exports = m;
  else { root.CMF = root.CMF || {}; Object.assign(root.CMF, m); }
})(typeof self !== 'undefined' ? self : this, function (N) {
  'use strict';

  // type 설명은 README의 "데이터 구조" 참고
  var CHARGE_FIELDS = [
    { key: 'CHARGE_CODE', type: 'upper', req: true, desc: '비용 코드 (예: THC, DOC, WFG, SEAL, CFS)' },
    { key: 'CHARGE_NAME', type: 'text', req: true, desc: '비용명 (견적서 표기)' },
    { key: 'PORT_CODE', type: 'port', req: true, desc: '적용 항구 (UN/LOCODE 또는 항구명)' },
    { key: 'CARRIER', type: 'carrierOrAll', req: false, desc: '선사 (공란/ALL = 항구 공통 요율)' },
    { key: 'CONTAINER_TYPE', type: 'containerOrAll', req: false, desc: '컨테이너 (공란/ALL = 전체)' },
    { key: 'DIRECTION', type: 'directionAll', req: false, desc: 'EXPORT / IMPORT / ALL(공란)' },
    { key: 'CHARGE_AMOUNT', type: 'number', req: true, desc: '금액 (PERCENTAGE는 % 값, 예 5 = 5%)' },
    { key: 'CURRENCY', type: 'currency', req: true, desc: '통화 (USD, KRW 등)' },
    { key: 'CHARGE_UNIT', type: 'unit', req: true, desc: 'PER_CONTAINER / PER_BL / PER_SHIPMENT / PER_TEU / PER_DAY / PER_KG / PERCENTAGE' },
    { key: 'VALID_FROM', type: 'date', req: true, desc: '유효 시작일' },
    { key: 'VALID_TO', type: 'date', req: true, desc: '유효 종료일' },
    { key: 'INCLUDED_IN_OF', type: 'yn', req: false, dflt: 'N', desc: 'Y = 해상운임에 포함 (별도 청구 안 함)' },
    { key: 'CHARGE_CONDITION', type: 'condition', req: false, desc: 'ALL / DRY / DG / NON_DG / REEFER / DOOR' },
    { key: 'REMARK', type: 'text', req: false, desc: '비고' }
  ];

  var SHEETS = {
    CARRIER_RATE: {
      title: '선사별 해상운임', phase: 1, required: true,
      fields: [
        { key: 'RATE_ID', type: 'text', req: false, desc: '요율 ID (선택)' },
        { key: 'DIRECTION', type: 'direction', req: true, desc: 'EXPORT / IMPORT' },
        { key: 'CARRIER', type: 'carrier', req: true, desc: '선사명 (예: HMM, SM LINE, MSC)' },
        { key: 'POL', type: 'port', req: true, desc: '선적항' },
        { key: 'POD', type: 'port', req: true, desc: '도착항' },
        { key: 'CONTAINER_TYPE', type: 'container', req: true, desc: '20GP / 40GP / 40HC / 20RF / 40RF 등' },
        { key: 'OCEAN_FREIGHT', type: 'number', req: true, desc: '해상운임 (컨테이너 1대당)' },
        { key: 'CURRENCY', type: 'currency', req: true, desc: '통화' },
        { key: 'TRANSIT_DAYS', type: 'number', req: false, desc: 'T/T (일)' },
        { key: 'ROUTING', type: 'routing', req: false, desc: 'DIRECT / T/S' },
        { key: 'VIA', type: 'text', req: false, desc: '환적항 (T/S일 때)' },
        { key: 'FREE_TIME', type: 'text', req: false, desc: '예: DEM 7 / DET 7' },
        { key: 'VALID_FROM', type: 'date', req: true, desc: '유효 시작일' },
        { key: 'VALID_TO', type: 'date', req: true, desc: '유효 종료일' },
        { key: 'INCLUDED_CHARGES', type: 'codeList', req: false, desc: '운임에 포함된 비용코드 (쉼표 구분, 예: BAF,LSS)' },
        { key: 'EXCLUDED_CHARGES', type: 'text', req: false, desc: '운임 불포함 안내 문구' },
        { key: 'DG_ACCEPT', type: 'yn', req: false, dflt: 'Y', desc: '위험물 수용 여부 (N이면 DG 견적에서 제외)' },
        { key: 'REMARK', type: 'text', req: false, desc: '비고' }
      ]
    },
    ORIGIN_CHARGE: { title: '출발지 LOCAL CHARGE', phase: 1, fields: CHARGE_FIELDS },
    DEST_CHARGE: { title: '도착지 LOCAL CHARGE', phase: 1, fields: CHARGE_FIELDS },
    PORT_REMARK: {
      title: 'PORT별 특이사항', phase: 1,
      fields: [
        { key: 'REMARK_ID', type: 'text', req: false, desc: 'ID (선택)' },
        { key: 'PORT_CODE', type: 'portOrAll', req: true, desc: '적용 항구 (ALL = 전체)' },
        { key: 'PORT_ROLE', type: 'portRole', req: false, desc: 'POL / POD / ANY(공란)' },
        { key: 'CARRIER', type: 'carrierOrAll', req: false, desc: '선사 (공란 = 전체)' },
        { key: 'CONTAINER_TYPE', type: 'containerOrAll', req: false, desc: '컨테이너 (공란 = 전체)' },
        { key: 'CARGO_CONDITION', type: 'condition', req: false, desc: 'ALL / DRY / DG / NON_DG / REEFER / DOOR' },
        { key: 'DIRECTION', type: 'directionAll', req: false, desc: 'EXPORT / IMPORT / ALL' },
        { key: 'REMARK_TYPE', type: 'remarkType', req: true, desc: 'AUTO_CHARGE / WARNING / REVIEW_REQUIRED / INFORMATION' },
        { key: 'TITLE', type: 'text', req: true, desc: '제목' },
        { key: 'MESSAGE', type: 'text', req: false, desc: '상세 내용 (견적서/화면 표시)' },
        { key: 'LEGAL_REVIEW', type: 'yn', req: false, dflt: 'N', desc: 'Y = 제재·규제·위험물 승인 등 법적 검토 필요 (승인 전 확정 불가)' },
        { key: 'CHARGE_CODE', type: 'upper', req: false, desc: 'AUTO_CHARGE 비용코드' },
        { key: 'CHARGE_NAME', type: 'text', req: false, desc: 'AUTO_CHARGE 비용명' },
        { key: 'CHARGE_AMOUNT', type: 'number', req: false, desc: '금액 (공란 = 금액 미확정 → 확인 필요)' },
        { key: 'CURRENCY', type: 'currency', req: false, desc: '통화' },
        { key: 'CHARGE_UNIT', type: 'unit', req: false, desc: '과금 단위' },
        { key: 'VALID_FROM', type: 'date', req: false, desc: '유효 시작일 (공란 = 제한 없음)' },
        { key: 'VALID_TO', type: 'date', req: false, desc: '유효 종료일 (공란 = 제한 없음)' }
      ]
    },
    SETTINGS: {
      title: '설정', phase: 1,
      fields: [
        { key: 'KEY', type: 'upper', req: true, desc: '설정 키' },
        { key: 'VALUE', type: 'text', req: false, desc: '값' },
        { key: 'DESCRIPTION', type: 'text', req: false, desc: '설명' }
      ]
    },
    PORT: {
      title: '항구 마스터 (UN/LOCODE 별칭)', phase: 1,
      fields: [
        { key: 'UNLOCODE', type: 'upper', req: true, desc: 'UN/LOCODE 5자리' },
        { key: 'PORT_NAME', type: 'text', req: true, desc: '대표 항구명' },
        { key: 'ALIASES', type: 'text', req: false, desc: '별칭 (쉼표 구분)' }
      ]
    },
    EXTRA_COST: {
      title: '기타 비용 (Phase 2)', phase: 2,
      fields: [
        { key: 'COST_CODE', type: 'upper', req: true }, { key: 'COST_NAME', type: 'text', req: true },
        { key: 'COST_TYPE', type: 'upper', req: false, desc: 'CUSTOMS / TRUCKING / INSURANCE / DOC / WAREHOUSE / CFS / HANDLING / OTHER' },
        { key: 'FROM_AREA', type: 'text', req: false }, { key: 'TO_AREA', type: 'text', req: false },
        { key: 'CONTAINER_TYPE', type: 'containerOrAll', req: false }, { key: 'AMOUNT', type: 'number', req: false },
        { key: 'CURRENCY', type: 'currency', req: false }, { key: 'CHARGE_UNIT', type: 'unit', req: false },
        { key: 'VALID_FROM', type: 'date', req: false }, { key: 'VALID_TO', type: 'date', req: false }, { key: 'REMARK', type: 'text', req: false }
      ]
    },
    INCOTERMS: {
      title: 'Incoterms 규칙 (Phase 2)', phase: 2,
      fields: [
        { key: 'INCOTERM', type: 'upper', req: true }, { key: 'COST_GROUP', type: 'upper', req: true },
        { key: 'PAYER', type: 'upper', req: true, desc: 'SELLER / BUYER' }, { key: 'REMARK', type: 'text', req: false }
      ]
    },
    CUSTOMER: {
      title: '고객 (Phase 2)', phase: 2,
      fields: [
        { key: 'CUSTOMER_CODE', type: 'upper', req: true }, { key: 'CUSTOMER_NAME', type: 'text', req: true },
        { key: 'CONTACT', type: 'text', req: false }, { key: 'EMAIL', type: 'text', req: false },
        { key: 'DEFAULT_CURRENCY', type: 'currency', req: false }, { key: 'REMARK', type: 'text', req: false }
      ]
    }
  };
  var SHEET_ORDER = ['CARRIER_RATE', 'ORIGIN_CHARGE', 'DEST_CHARGE', 'PORT_REMARK', 'SETTINGS', 'PORT', 'EXTRA_COST', 'INCOTERMS', 'CUSTOMER'];

  var DEFAULT_SETTINGS = {
    COMPANY_NAME: 'CMF Co., Ltd.',
    COMPANY_NAME_KR: '주식회사 씨엠에프',
    COMPANY_ADDRESS: '8F, Yonsei Bongrae Building, 36 Chilpae-ro, Jung-gu, Seoul, Korea',
    COMPANY_TEL: '',
    COMPANY_EMAIL: '',
    QUOTE_PREFIX: 'CMFQ',
    QUOTE_VALID_DAYS: '14',
    DEFAULT_BL_COUNT: '1',
    EXPIRY_WARN_DAYS: '7',
    FX_USD_KRW: '',
    FX_DATE: '',
    FX_SOURCE: '',
    TERMS: '1. Rates are subject to space and equipment availability at the time of booking.\n' +
      '2. Rates are subject to change without prior notice due to carrier GRI / surcharges.\n' +
      '3. Duties, taxes, inspection fees and demurrage/detention beyond free time are not included unless stated.\n' +
      '4. Items marked "TBA" are subject to confirmation.'
  };

  function normHeader(h) {
    return String(h == null ? '' : h).toUpperCase().trim().replace(/[^A-Z0-9가-힣]+/g, '_').replace(/^_|_$/g, '');
  }
  var HEADER_ALIASES = {
    'AMOUNT': 'CHARGE_AMOUNT', 'UNIT': 'CHARGE_UNIT', 'CONDITION': 'CHARGE_CONDITION', 'TYPE': 'CONTAINER_TYPE',
    'CNTR_TYPE': 'CONTAINER_TYPE', 'O_F': 'OCEAN_FREIGHT', 'OF': 'OCEAN_FREIGHT', 'T_T': 'TRANSIT_DAYS', 'TRANSIT_TIME': 'TRANSIT_DAYS',
    'PORT': 'PORT_CODE', 'INCLUDED_IN_OCEAN_FREIGHT': 'INCLUDED_IN_OF', 'DIRECT_T_S': 'ROUTING', 'VALIDITY_FROM': 'VALID_FROM', 'VALIDITY_TO': 'VALID_TO'
  };

  function isBlank(v) { return v == null || (typeof v === 'string' && v.trim() === ''); }

  function parseValue(field, raw, ctx) {
    // returns {value, error, warning}
    var t = field.type;
    if (isBlank(raw)) {
      if (field.req) return { error: '필수값 누락' };
      if (t === 'yn') return { value: field.dflt || 'N' };
      if (t === 'directionAll') return { value: 'ALL' };
      if (t === 'carrierOrAll' || t === 'containerOrAll') return { value: 'ALL' };
      if (t === 'condition') return { value: 'ALL' };
      if (t === 'portRole') return { value: 'ANY' };
      if (t === 'codeList') return { value: [] };
      return { value: null };
    }
    var s = typeof raw === 'string' ? raw.trim() : raw;
    switch (t) {
      case 'text': return { value: String(s) };
      case 'upper': return { value: String(s).toUpperCase().trim() };
      case 'number': {
        var n = typeof s === 'number' ? s : Number(String(s).replace(/[,\s]/g, '').replace(/^[$₩]/, ''));
        if (!isFinite(n)) return { error: '숫자가 아님: ' + s };
        if (n < 0) return { value: n, warning: '음수 금액' };
        return { value: n };
      }
      case 'date': {
        var d = N.normalizeDate(s);
        return d ? { value: d } : { error: '날짜 형식 오류: ' + s };
      }
      case 'direction': {
        var dir = N.normalizeDirection(s, false);
        return dir ? { value: dir } : { error: 'EXPORT/IMPORT 중 하나여야 함: ' + s };
      }
      case 'directionAll': {
        var da = N.normalizeDirection(s, true);
        return da ? { value: da } : { error: 'EXPORT/IMPORT/ALL 중 하나여야 함: ' + s };
      }
      case 'port': case 'portOrAll': {
        if (t === 'portOrAll' && /^(ALL|\*|ANY)$/i.test(String(s))) return { value: 'ALL' };
        var p = N.normalizePort(s, ctx.portIndex);
        if (!p.known && !/^[A-Z]{2}[A-Z0-9]{3}$/.test(p.code)) return { value: p.code, warning: '등록되지 않은 항구명 (PORT 시트에 UN/LOCODE 추가 권장): ' + s };
        return { value: p.code, warning: p.known ? null : '항구 마스터에 없는 코드: ' + p.code };
      }
      case 'container': case 'containerOrAll': {
        var c = N.normalizeContainer(s);
        if (c.code === 'ALL') return t === 'containerOrAll' ? { value: 'ALL' } : { error: '컨테이너 TYPE 지정 필요' };
        return c.known ? { value: c.code } : { value: c.code, warning: '알 수 없는 컨테이너 TYPE: ' + s };
      }
      case 'currency': {
        var cu = N.normalizeCurrency(s);
        if (!cu.valid) return { error: '통화 코드 오류 (3자리 ISO 코드): ' + s };
        return cu.known ? { value: cu.code } : { value: cu.code, warning: '확인되지 않은 통화 코드: ' + cu.code };
      }
      case 'carrier': return { value: N.normalizeCarrier(s) };
      case 'carrierOrAll': { var ca = N.normalizeCarrier(s); return { value: ca || 'ALL' }; }
      case 'yn': { var yn = N.normalizeYN(s, field.dflt || 'N'); return yn ? { value: yn } : { error: 'Y/N 값이어야 함: ' + s }; }
      case 'unit': { var u = N.normalizeUnit(s); return u ? { value: u } : { error: '과금 단위 오류: ' + s }; }
      case 'condition': { var co = N.normalizeCondition(s); return co ? { value: co } : { error: '조건 값 오류: ' + s }; }
      case 'remarkType': { var rt = N.normalizeRemarkType(s); return rt ? { value: rt } : { error: 'REMARK_TYPE 오류: ' + s }; }
      case 'routing': {
        var r = String(s).toUpperCase().replace(/\s/g, '');
        if (r === 'DIRECT' || r === 'DIR' || r === '직항' || r === 'D') return { value: 'DIRECT' };
        if (r === 'T/S' || r === 'TS' || r === 'TRANSHIPMENT' || r === '환적') return { value: 'T/S' };
        return { value: String(s).toUpperCase(), warning: 'ROUTING은 DIRECT 또는 T/S 권장' };
      }
      case 'portRole': {
        var pr = String(s).toUpperCase().trim();
        if (pr === 'POL' || pr === 'POD' || pr === 'ANY' || pr === 'ALL') return { value: pr === 'ALL' ? 'ANY' : pr };
        return { error: 'PORT_ROLE은 POL/POD/ANY' };
      }
      case 'codeList':
        return { value: String(s).toUpperCase().split(/[,;/|\s]+/).filter(Boolean) };
    }
    return { value: s };
  }

  function overlap(a, b) {
    var af = a.VALID_FROM || '0000-00-00', at = a.VALID_TO || '9999-12-31';
    var bf = b.VALID_FROM || '0000-00-00', bt = b.VALID_TO || '9999-12-31';
    return af <= bt && bf <= at;
  }

  var DUP_KEYS = {
    CARRIER_RATE: ['DIRECTION', 'CARRIER', 'POL', 'POD', 'CONTAINER_TYPE', 'ROUTING', 'VIA'],
    ORIGIN_CHARGE: ['CHARGE_CODE', 'PORT_CODE', 'CARRIER', 'CONTAINER_TYPE', 'DIRECTION', 'CHARGE_CONDITION'],
    DEST_CHARGE: ['CHARGE_CODE', 'PORT_CODE', 'CARRIER', 'CONTAINER_TYPE', 'DIRECTION', 'CHARGE_CONDITION'],
    SETTINGS: ['KEY'], PORT: ['UNLOCODE']
  };

  /**
   * 워크북(시트명 → 2차원 배열) 검증·변환
   * @returns {data, issues, summary}
   */
  function parseWorkbook(sheets, opts) {
    opts = opts || {};
    var todayStr = opts.today || N.today();
    var issues = [];
    var data = {};
    var found = {};
    // 시트명 매칭 (대소문자/공백 무시)
    Object.keys(sheets).forEach(function (name) {
      var k = normHeader(name);
      if (SHEETS[k]) found[k] = sheets[name];
    });
    if (!found.CARRIER_RATE) issues.push({ sheet: 'CARRIER_RATE', row: '-', level: 'error', message: 'CARRIER_RATE 시트가 없습니다. 템플릿 시트명을 확인하세요.' });

    // PORT 먼저 처리 → 항구 인덱스
    var order = ['PORT'].concat(SHEET_ORDER.filter(function (s) { return s !== 'PORT'; }));
    var portIndex = N.buildPortIndex([]);
    order.forEach(function (sheetName) {
      var def = SHEETS[sheetName];
      var rows = found[sheetName];
      data[sheetName] = [];
      if (!rows) return;
      // 헤더 행 찾기: 첫 10행 중 필수 필드가 가장 많이 매칭되는 행
      var headerRowIdx = -1, best = 0;
      for (var i = 0; i < Math.min(rows.length, 10); i++) {
        var hs = (rows[i] || []).map(function (h) { var x = normHeader(h); return HEADER_ALIASES[x] || x; });
        var cnt = def.fields.filter(function (f) { return hs.indexOf(f.key) >= 0; }).length;
        if (cnt > best) { best = cnt; headerRowIdx = i; }
      }
      if (headerRowIdx < 0) { issues.push({ sheet: sheetName, row: '-', level: 'error', message: '헤더 행을 찾을 수 없습니다.' }); return; }
      var headers = (rows[headerRowIdx] || []).map(function (h) { var x = normHeader(h); return HEADER_ALIASES[x] || x; });
      def.fields.forEach(function (f) {
        if (f.req && headers.indexOf(f.key) < 0) issues.push({ sheet: sheetName, row: headerRowIdx + 1, level: 'error', message: '필수 컬럼 누락: ' + f.key });
      });
      var ctx = { portIndex: portIndex };
      for (var r = headerRowIdx + 1; r < rows.length; r++) {
        var row = rows[r] || [];
        if (row.every(isBlank)) continue;
        var rec = { _row: r + 1, _sheet: sheetName };
        var rowErr = false;
        def.fields.forEach(function (f) {
          var ci = headers.indexOf(f.key);
          var raw = ci >= 0 ? row[ci] : null;
          var res = parseValue(f, raw, ctx);
          if (res.error) { rowErr = true; issues.push({ sheet: sheetName, row: r + 1, field: f.key, level: 'error', message: res.error }); }
          if (res.warning) issues.push({ sheet: sheetName, row: r + 1, field: f.key, level: 'warning', message: res.warning });
          rec[f.key] = res.value;
        });
        if (rec.VALID_FROM && rec.VALID_TO && rec.VALID_FROM > rec.VALID_TO) {
          rowErr = true; issues.push({ sheet: sheetName, row: r + 1, field: 'VALID_TO', level: 'error', message: '유효기간 종료일이 시작일보다 빠름' });
        }
        if (!rowErr && rec.VALID_TO && rec.VALID_TO < todayStr && (sheetName === 'CARRIER_RATE' || /CHARGE$/.test(sheetName))) {
          issues.push({ sheet: sheetName, row: r + 1, field: 'VALID_TO', level: 'warning', message: '유효기간 만료 (' + rec.VALID_TO + ') - 견적에 사용되지 않음' });
        }
        if (sheetName === 'PORT_REMARK' && !rowErr && rec.REMARK_TYPE === 'AUTO_CHARGE') {
          if (!rec.CHARGE_CODE || !rec.CHARGE_NAME || !rec.CHARGE_UNIT) { rowErr = true; issues.push({ sheet: sheetName, row: r + 1, level: 'error', message: 'AUTO_CHARGE는 CHARGE_CODE / CHARGE_NAME / CHARGE_UNIT 필수' }); }
          else if (rec.CHARGE_AMOUNT != null && !rec.CURRENCY) { rowErr = true; issues.push({ sheet: sheetName, row: r + 1, level: 'error', message: 'AUTO_CHARGE 금액이 있으면 CURRENCY 필수' }); }
          else if (rec.CHARGE_AMOUNT == null) issues.push({ sheet: sheetName, row: r + 1, level: 'warning', message: 'AUTO_CHARGE 금액 미확정 - 견적에서 "확인 필요"로 표시됨' });
        }
        if (sheetName === 'PORT' && !rowErr && !/^[A-Z]{2}[A-Z0-9]{3}$/.test(rec.UNLOCODE)) {
          rowErr = true; issues.push({ sheet: sheetName, row: r + 1, field: 'UNLOCODE', level: 'error', message: 'UN/LOCODE는 5자리 (예: KRPUS)' });
        }
        if (!rowErr) data[sheetName].push(rec);
      }
      if (sheetName === 'PORT') { portIndex = N.buildPortIndex(data.PORT); }
      // 중복 검증
      var keys = DUP_KEYS[sheetName];
      if (keys) {
        var groups = {};
        data[sheetName].forEach(function (rec) {
          var k = keys.map(function (kk) { return rec[kk] == null ? '' : rec[kk]; }).join('|');
          (groups[k] = groups[k] || []).push(rec);
        });
        var dupRows = {};
        Object.keys(groups).forEach(function (k) {
          var accepted = [];
          groups[k].forEach(function (rec) {
            var hit = accepted.filter(function (a) { return sheetName === 'SETTINGS' || sheetName === 'PORT' || overlap(a, rec); })[0];
            if (hit) {
              dupRows[rec._row] = true;
              issues.push({ sheet: sheetName, row: rec._row, level: 'error', message: '중복 요율 (행 ' + hit._row + '과 동일 조건·유효기간 겹침) - 이 행은 등록 제외' });
            } else accepted.push(rec);
          });
        });
        data[sheetName] = data[sheetName].filter(function (rec) { return !dupRows[rec._row]; });
      }
    });
    if (!found.ORIGIN_CHARGE) issues.push({ sheet: 'ORIGIN_CHARGE', row: '-', level: 'warning', message: 'ORIGIN_CHARGE 시트 없음 - 출발지 비용 없이 산출됨' });
    if (!found.DEST_CHARGE) issues.push({ sheet: 'DEST_CHARGE', row: '-', level: 'warning', message: 'DEST_CHARGE 시트 없음 - 도착지 비용 없이 산출됨' });

    var settings = {};
    Object.keys(DEFAULT_SETTINGS).forEach(function (k) { settings[k] = DEFAULT_SETTINGS[k]; });
    (data.SETTINGS || []).forEach(function (s) { if (s.KEY) settings[s.KEY] = s.VALUE == null ? '' : String(s.VALUE); });

    var summary = {};
    SHEET_ORDER.forEach(function (s) { summary[s] = (data[s] || []).length; });
    var errorCount = issues.filter(function (i) { return i.level === 'error'; }).length;
    return {
      data: data, settings: settings, issues: issues, summary: summary,
      errorCount: errorCount, warningCount: issues.length - errorCount,
      ok: !!found.CARRIER_RATE && data.CARRIER_RATE.length > 0
    };
  }

  return { SHEETS: SHEETS, SHEET_ORDER: SHEET_ORDER, DEFAULT_SETTINGS: DEFAULT_SETTINGS, parseWorkbook: parseWorkbook };
});
