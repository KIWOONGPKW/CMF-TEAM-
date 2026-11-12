/* CMF Freight Quotation System - Excel 양식 생성 (운임 DB 템플릿 / 고객 제출용 견적서 / 내부 검토용 견적서) */
(function (root, factory) {
  var isNode = typeof module === 'object' && module.exports;
  var deps = isNode ? Object.assign({}, require('./normalize.js'), require('./schema.js'), require('./engine.js'), require('./xlsx-lite.js')) : root.CMF;
  var m = factory(deps);
  if (isNode) module.exports = m;
  else { root.CMF = root.CMF || {}; Object.assign(root.CMF, m); }
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  // ---------------- 샘플 데이터 (테스트용, 실제 운임 아님) ----------------
  var SAMPLE = {
    CARRIER_RATE: [
      ['R001', 'EXPORT', 'SAMPLE-A', 'KRPUS', 'VNHPH', '20GP', 150, 'USD', 5, 'DIRECT', '', 'DEM 7 / DET 7', '2026-11-01', '2026-12-31', '', 'THC, DOC, WFG 별도', 'Y', '샘플 데이터'],
      ['R002', 'EXPORT', 'SAMPLE-A', 'KRPUS', 'VNHPH', '40HC', 250, 'USD', 5, 'DIRECT', '', 'DEM 7 / DET 7', '2026-11-01', '2026-12-31', '', 'THC, DOC, WFG 별도', 'Y', '샘플 데이터'],
      ['R003', 'EXPORT', 'SAMPLE-B', 'KRPUS', 'VNHPH', '20GP', 130, 'USD', 9, 'T/S', 'HONG KONG', 'DEM 5 / DET 5', '2026-11-01', '2026-12-31', 'LSS', 'THC, DOC 별도', 'N', 'LSS 포함 운임'],
      ['R004', 'EXPORT', 'SAMPLE-B', 'KRPUS', 'VNHPH', '40HC', 230, 'USD', 9, 'T/S', 'HONG KONG', 'DEM 5 / DET 5', '2026-11-01', '2026-12-31', 'LSS', 'THC, DOC 별도', 'N', 'LSS 포함 운임'],
      ['R005', 'EXPORT', 'SAMPLE-C', 'KRPUS', 'VNHPH', '20GP', 160, 'USD', 6, 'DIRECT', '', 'DEM 10 / DET 10', '2026-11-01', '2026-12-31', '', '', 'Y', '40HC 운임 미등록 (확인 필요 예시)'],
      ['R006', 'EXPORT', 'SAMPLE-A', 'BUSAN', 'SHANGHAI', '20GP', 50, 'USD', 2, 'DIRECT', '', 'DEM 7 / DET 7', '2026-11-01', '2026-12-31', '', '', 'Y', ''],
      ['R007', 'EXPORT', 'SAMPLE-A', 'BUSAN', 'SHANGHAI', '40HQ', 100, 'USD', 2, 'DIRECT', '', 'DEM 7 / DET 7', '2026-11-01', '2026-12-31', '', '', 'Y', '40HQ → 40HC 자동 정규화 예시'],
      ['R008', 'EXPORT', 'SAMPLE-A', 'KRPUS', 'INNSA', '20GP', 600, 'USD', 18, 'T/S', 'SINGAPORE', 'DEM 14 / DET 14', '2026-11-01', '2026-12-31', '', '', 'N', 'DG 불가'],
      ['R009', 'EXPORT', 'SAMPLE-A', 'KRPUS', 'INNSA', '40HC', 900, 'USD', 18, 'T/S', 'SINGAPORE', 'DEM 14 / DET 14', '2026-11-01', '2026-12-31', '', '', 'N', 'DG 불가'],
      ['R010', 'EXPORT', 'SAMPLE-B', 'KRINC', 'VNHPH', '20GP', 180, 'USD', 6, 'DIRECT', '', 'DEM 7 / DET 7', '2026-11-01', '2026-12-31', '', '', 'Y', ''],
      ['R011', 'EXPORT', 'SAMPLE-A', 'KRPUS', 'VNSGN', '20GP', 170, 'USD', 7, 'DIRECT', '', 'DEM 7 / DET 7', '2026-10-01', '2026-10-31', '', '', 'Y', '만료 운임 예시'],
      ['R012', 'IMPORT', 'SAMPLE-A', 'CNSHA', 'KRPUS', '20GP', 80, 'USD', 2, 'DIRECT', '', 'DEM 5 / DET 5', '2026-11-01', '2026-12-31', '', '', 'Y', ''],
      ['R013', 'IMPORT', 'SAMPLE-A', 'CNSHA', 'KRPUS', '40HC', 150, 'USD', 2, 'DIRECT', '', 'DEM 5 / DET 5', '2026-11-01', '2026-12-31', '', '', 'Y', ''],
      ['R014', 'EXPORT', 'SAMPLE-A', 'KRPUS', 'VNHPH', '40RF', 1200, 'USD', 5, 'DIRECT', '', 'DEM 3 / DET 3', '2026-11-01', '2026-12-31', '', '', 'Y', 'Reefer']
    ],
    ORIGIN_CHARGE: [
      ['THC', 'Terminal Handling Charge', 'KRPUS', '', '20GP', 'EXPORT', 165000, 'KRW', 'PER_CONTAINER', '2026-01-01', '2026-12-31', 'N', '', ''],
      ['THC', 'Terminal Handling Charge', 'KRPUS', '', '40HC', 'EXPORT', 210000, 'KRW', 'PER_CONTAINER', '2026-01-01', '2026-12-31', 'N', '', ''],
      ['THC', 'Terminal Handling Charge', 'KRPUS', '', '40RF', 'EXPORT', 260000, 'KRW', 'PER_CONTAINER', '2026-01-01', '2026-12-31', 'N', '', ''],
      ['DOC', 'Documentation Fee', 'KRPUS', '', '', 'EXPORT', 50000, 'KRW', 'PER_BL', '2026-01-01', '2026-12-31', 'N', '', '항구 공통'],
      ['DOC', 'Documentation Fee', 'KRPUS', 'SAMPLE-B', '', 'EXPORT', 40000, 'KRW', 'PER_BL', '2026-01-01', '2026-12-31', 'N', '', '선사 지정 요율 우선 적용 예시'],
      ['WFG', 'Wharfage', 'KRPUS', '', '', 'EXPORT', 4420, 'KRW', 'PER_TEU', '2026-01-01', '2026-12-31', 'N', '', ''],
      ['SEAL', 'Seal Charge', 'KRPUS', '', '', 'EXPORT', 10000, 'KRW', 'PER_CONTAINER', '2026-01-01', '2026-12-31', 'N', '', ''],
      ['LSS', 'Low Sulphur Surcharge', 'KRPUS', '', '', 'EXPORT', 25, 'USD', 'PER_TEU', '2026-11-01', '2026-12-31', 'N', '', 'SAMPLE-B는 운임 포함'],
      ['DGS', 'DG Surcharge', 'KRPUS', '', '', 'EXPORT', 150, 'USD', 'PER_CONTAINER', '2026-01-01', '2026-12-31', 'N', 'DG', '위험물일 때만'],
      ['THC', 'Terminal Handling Charge', 'KRINC', '', '20GP', 'EXPORT', 160000, 'KRW', 'PER_CONTAINER', '2026-01-01', '2026-12-31', 'N', '', ''],
      ['DOC', 'Documentation Fee', 'KRINC', '', '', 'EXPORT', 50000, 'KRW', 'PER_BL', '2026-01-01', '2026-10-31', 'N', '', '만료 비용 예시'],
      ['THC', 'Terminal Handling Charge', 'CNSHA', '', '20GP', 'IMPORT', 850, 'CNY', 'PER_CONTAINER', '2026-01-01', '2026-12-31', 'N', '', ''],
      ['THC', 'Terminal Handling Charge', 'CNSHA', '', '40HC', 'IMPORT', 1250, 'CNY', 'PER_CONTAINER', '2026-01-01', '2026-12-31', 'N', '', ''],
      ['DOC', 'Documentation Fee', 'CNSHA', '', '', 'IMPORT', 450, 'CNY', 'PER_BL', '2026-01-01', '2026-12-31', 'N', '', '']
    ],
    DEST_CHARGE: [
      ['THC', 'Terminal Handling Charge', 'VNHPH', '', '20GP', 'EXPORT', 120, 'USD', 'PER_CONTAINER', '2026-01-01', '2026-12-31', 'N', '', ''],
      ['THC', 'Terminal Handling Charge', 'VNHPH', '', '40HC', 'EXPORT', 180, 'USD', 'PER_CONTAINER', '2026-01-01', '2026-12-31', 'N', '', ''],
      ['DOC', 'Documentation Fee', 'VNHPH', '', '', 'EXPORT', 40, 'USD', 'PER_BL', '2026-01-01', '2026-12-31', 'N', '', ''],
      ['CIC', 'Container Imbalance Charge', 'VNHPH', 'SAMPLE-A', '', 'EXPORT', 50, 'USD', 'PER_CONTAINER', '2026-01-01', '2026-12-31', 'N', '', 'SAMPLE-A만'],
      ['THC', 'Terminal Handling Charge', 'KRPUS', '', '20GP', 'IMPORT', 165000, 'KRW', 'PER_CONTAINER', '2026-01-01', '2026-12-31', 'N', '', ''],
      ['THC', 'Terminal Handling Charge', 'KRPUS', '', '40HC', 'IMPORT', 210000, 'KRW', 'PER_CONTAINER', '2026-01-01', '2026-12-31', 'N', '', ''],
      ['DOC', 'D/O Fee', 'KRPUS', '', '', 'IMPORT', 50000, 'KRW', 'PER_BL', '2026-01-01', '2026-12-31', 'N', '', ''],
      ['CCF', 'Container Cleaning Fee', 'KRPUS', '', '20GP', 'IMPORT', 25000, 'KRW', 'PER_CONTAINER', '2026-01-01', '2026-12-31', 'N', '', '']
    ],
    PORT_REMARK: [
      ['PR01', 'VNHPH', 'POD', 'SAMPLE-A', '', '', 'EXPORT', 'AUTO_CHARGE', 'Emergency Bunker Surcharge', 'SAMPLE-A 하이퐁향 EBS 부과', '', 'EBS', 'Emergency Bunker Surcharge', 25, 'USD', 'PER_CONTAINER', '2026-11-01', '2026-12-31'],
      ['PR02', 'VNHPH', 'POD', '', '', '', 'EXPORT', 'AUTO_CHARGE', 'Port Infrastructure Fee', '하이퐁 항만 인프라 사용료', '', 'PIF', 'Port Infrastructure Fee', '', '', 'PER_SHIPMENT', '', ''],
      ['PR03', 'VNHPH', 'POD', '', '', '', '', 'WARNING', 'Haiphong 혼잡', '하이퐁 터미널 혼잡으로 반입 지연 가능', '', '', '', '', '', '', '', ''],
      ['PR04', 'INNSA', 'POD', '', '', '', 'EXPORT', 'WARNING', 'India IGM Cut-off', '인도향은 IGM 제출 마감 엄수 - Cut-off 확인', '', '', '', '', '', '', '', ''],
      ['PR05', 'ALL', 'ANY', '', '', 'REEFER', '', 'INFORMATION', 'Reefer 설정 온도 확인', 'Booking 시 Set Temp / Ventilation 명시', '', '', '', '', '', '', '', ''],
      ['PR06', 'CNSHA', 'POL', '', '', '', 'IMPORT', 'REVIEW_REQUIRED', '원산지 증명 확인', '한-중 FTA 원산지증명서 발급 여부 확인 후 진행', '', '', '', '', '', '', '', ''],
      ['PR07', 'INNSA', 'POD', '', '', 'DG', '', 'WARNING', 'India DG 규제', '인도 DG 수입 규정(PESO 등) 확인 필요', 'Y', '', '', '', '', '', '', '']
    ],
    SETTINGS: [
      ['COMPANY_NAME', 'CMF Co., Ltd.', '견적서 상단 회사명 (영문)'],
      ['COMPANY_NAME_KR', '주식회사 씨엠에프', '회사명 (한글)'],
      ['COMPANY_ADDRESS', '8F, Yonsei Bongrae Building, 36 Chilpae-ro, Jung-gu, Seoul, Korea', '주소'],
      ['COMPANY_TEL', '', '대표 전화'],
      ['COMPANY_EMAIL', '', '대표 메일'],
      ['QUOTE_PREFIX', 'CMFQ', '견적번호 접두어 (예: CMFQ-20261112-001)'],
      ['QUOTE_VALID_DAYS', 14, '견적 유효일수 (운임 유효기간보다 길면 운임 만료일 적용)'],
      ['DEFAULT_BL_COUNT', 1, '기본 B/L 건수'],
      ['EXPIRY_WARN_DAYS', 7, '운임 만료 임박 경고 일수'],
      ['FX_USD_KRW', '', '선사 비교 정렬 참고용 환율 (합계에는 합산하지 않음)'],
      ['FX_DATE', '', '환율 기준일'],
      ['FX_SOURCE', '', '환율 출처'],
      ['TERMS', C.DEFAULT_SETTINGS.TERMS, '견적서 Terms & Conditions (줄바꿈 가능)']
    ],
    PORT: [
      ['VNDAD', 'DA NANG', '다낭, DANANG'],
      ['KRPUS', 'BUSAN', 'PUSAN, 부산, 부산신항']
    ]
  };

  var DROPDOWNS = {
    DIRECTION: ['EXPORT', 'IMPORT'], CONTAINER_TYPE: C.CONTAINER_TYPES, CHARGE_UNIT: C.CHARGE_UNITS,
    INCLUDED_IN_OF: ['Y', 'N'], DG_ACCEPT: ['Y', 'N'], LEGAL_REVIEW: ['Y', 'N'], CHARGE_CONDITION: C.CONDITIONS,
    CARGO_CONDITION: C.CONDITIONS, REMARK_TYPE: C.REMARK_TYPES, ROUTING: ['DIRECT', 'T/S'], PORT_ROLE: ['POL', 'POD', 'ANY']
  };

  /** 운임 DB 업로드용 템플릿 (withSample=true면 샘플 데이터 포함) */
  function buildTemplateWorkbook(withSample) {
    var sheets = [];
    var guide = [
      [{ v: 'CMF Freight Quotation System - 운임 데이터 템플릿', s: 'title' }],
      [{ v: '각 시트의 1행(헤더)은 수정하지 마세요. 2행부터 데이터를 입력하고 웹페이지의 [데이터 업로드]에서 이 파일을 올리면 됩니다.', s: 'small' }],
      [{ v: '항구는 UN/LOCODE(KRPUS) 또는 항구명(BUSAN, PUSAN, 부산) 모두 가능 / 컨테이너는 40HQ·40HC 등 자동 정규화 / 날짜는 YYYY-MM-DD', s: 'small' }],
      [{ v: withSample ? '※ SAMPLE-A/B/C 운임은 화면 테스트용 가상 데이터입니다. 실제 운임으로 교체 후 사용하세요.' : '', s: 'small' }],
      [],
      [{ v: '시트', s: 'header' }, { v: '컬럼', s: 'header' }, { v: '필수', s: 'header' }, { v: '설명', s: 'header' }]
    ];
    C.SHEET_ORDER.forEach(function (name) {
      var def = C.SHEETS[name];
      def.fields.forEach(function (f, i) {
        guide.push([{ v: i === 0 ? name + '\n(' + def.title + ')' : '', s: 'text' }, { v: f.key, s: 'text' }, { v: f.req ? '필수' : '', s: 'textCenter' }, { v: f.desc || '', s: 'text' }]);
      });
    });
    sheets.push({ name: '사용안내', rows: guide, cols: [26, 22, 7, 80], showGrid: false });

    C.SHEET_ORDER.forEach(function (name) {
      var def = C.SHEETS[name];
      var header = def.fields.map(function (f) { return { v: f.key, s: 'header' }; });
      var rows = [header];
      var sample = withSample ? (SAMPLE[name] || []) : (name === 'SETTINGS' ? SAMPLE.SETTINGS : []);
      sample.forEach(function (r) {
        rows.push(r.map(function (v, ci) {
          var f = def.fields[ci];
          if (v === '' || v == null) return null;
          if (f && f.type === 'date') return { v: v, s: 'date', date: true };
          if (typeof v === 'number') return { v: v, s: 'numRight' };
          return { v: v, s: 'text' };
        }));
      });
      var validations = [];
      def.fields.forEach(function (f, ci) {
        if (DROPDOWNS[f.key]) validations.push({ ref: C.colName(ci) + '2:' + C.colName(ci) + '2000', list: DROPDOWNS[f.key] });
      });
      sheets.push({
        name: name, rows: rows, freeze: 1, validations: validations,
        cols: def.fields.map(function (f) { return f.key === 'TERMS' || f.key === 'MESSAGE' || f.key === 'VALUE' ? 60 : Math.max(12, f.key.length + 3); })
      });
    });
    return C.writeWorkbook(sheets, { title: 'CMF Rate Template' });
  }

  var ZERO_DEC = ['KRW', 'JPY', 'VND', 'IDR', 'MNT'];
  function numStyle(cur) { return ZERO_DEC.indexOf(cur) >= 0 ? 'num0' : 'num'; }
  function fmtNum(n) { return n == null ? '' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }); }

  /** 고객 제출용 견적서 (원가/마진/출처 미노출) */
  function buildCustomerQuotation(quote, option, settings) {
    settings = settings || C.DEFAULT_SETTINGS;
    var req = quote.request;
    var rows = [], merges = [];
    var draft = quote.status !== 'APPROVED';
    function push(r) { rows.push(r); return rows.length; } // 1-based row number

    push([{ v: settings.COMPANY_NAME || '', s: 'title' }]); rows[0]._height = 28;
    push([{ v: [settings.COMPANY_NAME_KR, settings.COMPANY_ADDRESS].filter(Boolean).join('  |  '), s: 'small' }]);
    push([{ v: [settings.COMPANY_TEL ? 'TEL ' + settings.COMPANY_TEL : '', settings.COMPANY_EMAIL ? 'E-MAIL ' + settings.COMPANY_EMAIL : ''].filter(Boolean).join('  |  '), s: 'small' }]);
    push([]);
    var tr = push([{ v: 'QUOTATION' + (draft ? '  (DRAFT)' : ''), s: 'subtitle' }]);
    merges.push('A' + tr + ':I' + tr);
    push([]);
    var routing = option.routing === 'T/S' ? 'T/S' + (option.via ? ' via ' + option.via : '') : (option.routing || '-');
    var info = [
      ['Quotation No.', quote.no, 'Date', { v: quote.date, date: true }],
      ['Customer', req.customer || '-', 'Valid Until', { v: option.quoteValidUntil, date: true }],
      ['POL', req.polName + ' (' + req.pol + ')', 'POD', req.podName + ' (' + req.pod + ')'],
      ['Service', (req.direction === 'EXPORT' ? 'EXPORT' : 'IMPORT') + ' FCL', 'Incoterms', req.incoterms || '-'],
      ['Equipment', C.containerSummary(req), 'Carrier', option.carrier],
      ['Routing', routing, 'Transit Time', option.transitDays != null ? option.transitDays + ' days' : '-'],
      ['Free Time', option.freeTime || '-', 'Cargo', [req.cargo, req.dg ? 'DG' : '', req.reefer ? 'REEFER ' + (req.reeferTemp || '') : ''].filter(Boolean).join(' / ') || '-']
    ];
    info.forEach(function (it) {
      var r = rows.length + 1;
      var v4 = it[3] && it[3].date ? { v: it[3].v, s: 'date', date: true } : { v: it[3], s: 'text' };
      push([{ v: it[0], s: 'label' }, { v: it[1], s: 'text' }, { v: null, s: 'text' }, { v: null, s: 'text' }, null,
        { v: it[2], s: 'label' }, v4, { v: null, s: 'text' }, { v: null, s: 'text' }]);
      merges.push('B' + r + ':D' + r, 'G' + r + ':I' + r);
    });
    push([]);
    var hr = push(['No', 'Description', 'Type', 'Unit', "Q'ty", 'Currency', 'Unit Price', 'Amount', 'Remark'].map(function (h) { return { v: h, s: 'header' }; }));
    rows[hr - 1]._height = 20;
    var first = hr + 1;
    var no = 0;
    ['OCEAN', 'ORIGIN', 'DEST', 'SPECIAL'].forEach(function (sec) {
      var lines = option.lines.filter(function (l) { return l.section === sec && l.include; });
      if (!lines.length) return;
      var sr = push([{ v: C.SECTION_LABEL[sec], s: 'section' }].concat([1, 2, 3, 4, 5, 6, 7, 8].map(function () { return { v: null, s: 'section' }; })));
      merges.push('A' + sr + ':I' + sr);
      lines.forEach(function (l) {
        no++;
        var r = rows.length + 1;
        var unitLabel = C.UNIT_LABEL[l.unit] || l.unit;
        var cells = [{ v: no, s: 'int' }, { v: l.code === 'O/F' ? 'Ocean Freight' : l.name + ' (' + l.code + ')', s: 'text' }, { v: l.containerType || '', s: 'textCenter' }, { v: unitLabel, s: 'textCenter' }];
        if (l.status === 'OK') {
          var su = l.sellUnitPrice == null || l.sellUnitPrice === '' ? l.unitPrice : Number(l.sellUnitPrice);
          cells.push({ v: l.qty, s: l.qty % 1 ? 'num' : 'int' }, { v: l.currency, s: 'textCenter' }, { v: su, s: numStyle(l.currency) },
            { f: 'E' + r + '*G' + r, v: C.round2(su * l.qty), s: numStyle(l.currency) }, { v: l.unit === 'PERCENTAGE' ? l.basis : '', s: 'text' });
        } else if (l.status === 'INCLUDED') {
          cells.push({ v: null, s: 'int' }, { v: null, s: 'textCenter' }, { v: null, s: 'num' }, { v: 'INCLUDED', s: 'textCenter' }, { v: 'Included in Ocean Freight', s: 'text' });
        } else {
          cells.push({ v: l.qty == null ? null : l.qty, s: 'int' }, { v: l.currency || null, s: 'textCenter' }, { v: 'TBA', s: 'pending' }, { v: 'TBA', s: 'pending' }, { v: 'Subject to confirmation', s: 'text' });
        }
        push(cells);
      });
    });
    var last = rows.length;
    push([]);
    var curs = Object.keys(option.sellTotals || {}).sort(C.currencyOrder);
    curs.forEach(function (cur) {
      var r = rows.length + 1;
      push([null, null, null, null, null, { v: 'TOTAL', s: 'totalLabel' }, { v: cur, s: 'totalLabel' },
        { f: 'SUMIF($F$' + first + ':$F$' + last + ',"' + cur + '",$H$' + first + ':$H$' + last + ')', v: option.sellTotals[cur], s: 'totalNum' }, null]);
    });
    if (curs.length > 1) push([{ v: '※ Totals are shown separately by currency.', s: 'small' }]);
    if (option.pendingCount) push([{ v: '※ Items marked "TBA" are not included in the total and will be advised upon confirmation.', s: 'small' }]);
    push([]);

    var remarks = [];
    if (option.excludedText) remarks.push('Excluded: ' + option.excludedText);
    (option.messages || []).forEach(function (m) {
      if (m.source && m.source.sheet === 'PORT_REMARK' && (m.type === 'WARNING' || m.type === 'INFORMATION') && !/^\[자동 추가\]/.test(m.title)) {
        remarks.push(m.title + (m.message ? ': ' + m.message : ''));
      }
    });
    if (quote.remark) remarks.push(quote.remark);
    if (remarks.length) {
      push([{ v: 'Remarks', s: 'subtitle' }]);
      remarks.forEach(function (t) { var r = push([{ v: '- ' + t, s: 'wrap' }]); merges.push('A' + r + ':I' + r); });
      push([]);
    }
    push([{ v: 'Terms & Conditions', s: 'subtitle' }]);
    String(settings.TERMS || '').split(/\r?\n/).forEach(function (t) {
      if (!t.trim()) return; var r = push([{ v: t, s: 'wrap' }]); merges.push('A' + r + ':I' + r);
    });
    push([]);
    push([null, null, null, null, null, null, { v: 'Issued by ' + (settings.COMPANY_NAME || ''), s: 'small' }]);

    return C.writeWorkbook([{ name: 'Quotation', rows: rows, merges: merges, cols: [13, 34, 9, 8, 8, 12, 14, 16, 28], showGrid: false, fitWidth: true }],
      { title: 'Quotation ' + quote.no });
  }

  var STATUS_KR = { OK: '확정', INCLUDED: '운임 포함', PENDING: '확인 필요', EXCLUDED: '제외' };

  /** 내부 검토용 견적서 (원가/판매가/이익/출처/검토 항목 포함) */
  function buildInternalQuotation(quote, option, settings, result) {
    settings = settings || C.DEFAULT_SETTINGS;
    var req = quote.request;
    var rows = [];
    rows.push([{ v: '내부 검토용 견적 - ' + quote.no + ' (고객 제출 금지)', s: 'subtitle' }]);
    rows.push([{ v: '상태: ' + quote.status + (quote.approvedBy ? ' / 승인: ' + quote.approvedBy + ' ' + (quote.approvedAt || '') : ''), s: 'small' }]);
    rows.push([{ v: req.direction + ' ' + req.pol + ' → ' + req.pod + ' / ' + C.containerSummary(req) + ' / ' + option.carrier + ' / 견적기준일 ' + req.quoteDate + ' / 운임유효 ~' + (option.rateValidTo || '-'), s: 'small' }]);
    var fx = settings.FX_USD_KRW ? '참고 환율 USD/KRW ' + settings.FX_USD_KRW + ' (기준일 ' + (settings.FX_DATE || '-') + ', 출처 ' + (settings.FX_SOURCE || '-') + ') - 합계 미적용' : '환율 미적용 (통화별 별도 합계)';
    rows.push([{ v: fx, s: 'small' }]);
    rows.push([]);
    var hdr = ['구분', 'Code', '비용명', 'Type', '단위', '수량', '통화', '원가 단가', '원가 금액', '판매 단가', '판매 금액', '이익', '상태', '견적 포함', '산출 근거', '출처'];
    rows.push(hdr.map(function (h) { return { v: h, s: 'header' }; }));
    var first = rows.length + 1;
    option.lines.forEach(function (l) {
      var r = rows.length + 1;
      var ok = l.status === 'OK';
      var su = ok ? (l.sellUnitPrice == null || l.sellUnitPrice === '' ? l.unitPrice : Number(l.sellUnitPrice)) : null;
      rows.push([
        { v: C.SECTION_LABEL[l.section], s: 'text' }, { v: l.code, s: 'text' }, { v: l.name, s: 'text' }, { v: l.containerType, s: 'textCenter' },
        { v: C.UNIT_LABEL[l.unit] || l.unit, s: 'textCenter' }, { v: l.qty, s: 'num' }, { v: l.currency, s: 'textCenter' },
        { v: l.unitPrice, s: 'num' }, ok ? { f: 'F' + r + '*H' + r, v: l.amount, s: 'num' } : { v: null, s: 'num' },
        { v: su, s: 'num' }, ok ? { f: 'F' + r + '*J' + r, v: C.round2(su * l.qty), s: 'num' } : { v: null, s: 'num' },
        ok ? { f: 'K' + r + '-I' + r, v: C.round2(su * l.qty - l.amount), s: 'num' } : { v: null, s: 'num' },
        { v: STATUS_KR[l.status] || l.status, s: l.status === 'PENDING' ? 'pending' : 'textCenter' }, { v: l.include ? 'Y' : 'N', s: 'textCenter' },
        { v: [l.basis, l.note].filter(Boolean).join(' / '), s: 'text' },
        { v: l.source ? l.source.sheet + ' 행' + l.source.row + (l.source.id ? ' (' + l.source.id + ')' : '') : '', s: 'text' }
      ]);
    });
    var last = rows.length;
    rows.push([]);
    var curs = Object.keys(option.totals || {}).concat(Object.keys(option.sellTotals || {})).filter(function (c, i, a) { return a.indexOf(c) === i; }).sort(C.currencyOrder);
    rows.push(['', '', '', '', '', '', { v: '통화', s: 'header' }, null, { v: '원가 합계', s: 'header' }, null, { v: '판매 합계', s: 'header' }, { v: '이익', s: 'header' }, { v: 'Margin %', s: 'header' }]);
    curs.forEach(function (cur) {
      var r = rows.length + 1;
      var cond = '$G$' + first + ':$G$' + last + ',"' + cur + '",$N$' + first + ':$N$' + last + ',"Y"';
      var ct = option.totals[cur] || 0, st = option.sellTotals[cur] || 0;
      rows.push(['', '', '', '', '', '', { v: cur, s: 'totalLabel' }, null,
        { f: 'SUMIFS($I$' + first + ':$I$' + last + ',' + cond + ')', v: ct, s: 'totalNum' }, null,
        { f: 'SUMIFS($K$' + first + ':$K$' + last + ',' + cond + ')', v: st, s: 'totalNum' },
        { f: 'K' + r + '-I' + r, v: C.round2(st - ct), s: 'totalNum' },
        { f: 'IF(K' + r + '=0,0,L' + r + '/K' + r + '*100)', v: st ? C.round2((st - ct) / st * 100) : 0, s: 'totalNum' }]);
    });
    rows.push([]);
    rows.push([{ v: '검토 / 경고 사항', s: 'subtitle' }]);
    var merges = [];
    function note(text, style) { rows.push([{ v: text, s: style }]); merges.push('A' + rows.length + ':P' + rows.length); }
    if (option.legalHold) note('[법적 검토 필요] 담당자 승인 전 견적 확정 불가', 'warn');
    (option.pendingItems || []).forEach(function (l) { note('[확인 필요] ' + l.name + (l.containerType ? ' ' + l.containerType : '') + ' - ' + l.note, 'warn'); });
    (option.messages || []).forEach(function (m) { note('[' + m.type + (m.legal ? '/LEGAL' : '') + '] ' + m.title + (m.message ? ' - ' + m.message : ''), 'wrap'); });
    if (result && result.excluded && result.excluded.length) result.excluded.forEach(function (e) { note('[제외 요율] ' + e.carrier + ' ' + e.type + ' - ' + e.reason, 'wrap'); });
    return C.writeWorkbook([{ name: '내부검토', rows: rows, merges: merges, freeze: 6, cols: [22, 8, 28, 8, 7, 8, 7, 12, 14, 12, 14, 12, 10, 8, 36, 22] }], { title: 'Internal ' + quote.no });
  }

  return { buildTemplateWorkbook: buildTemplateWorkbook, buildCustomerQuotation: buildCustomerQuotation, buildInternalQuotation: buildInternalQuotation, SAMPLE: SAMPLE, fmtNum: fmtNum, STATUS_KR: STATUS_KR };
});
