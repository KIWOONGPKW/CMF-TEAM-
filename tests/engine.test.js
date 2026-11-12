// 핵심 계산 로직 자동화 테스트 - 실행: node --test tests/
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const N = require('../js/normalize.js');
const S = require('../js/schema.js');
const E = require('../js/engine.js');
const X = require('../js/xlsx-lite.js');
const B = require('../js/excel-builders.js');

const TODAY = '2026-11-12';
const rate = (o) => Object.assign({ _sheet: 'CARRIER_RATE', _row: 2, DIRECTION: 'EXPORT', POL: 'KRPUS', POD: 'VNHPH', CURRENCY: 'USD', ROUTING: 'DIRECT', VIA: null, VALID_FROM: '2026-11-01', VALID_TO: '2026-12-31', INCLUDED_CHARGES: [], DG_ACCEPT: 'Y' }, o);
const chg = (o) => Object.assign({ _sheet: 'ORIGIN_CHARGE', _row: 2, PORT_CODE: 'KRPUS', CARRIER: 'ALL', CONTAINER_TYPE: 'ALL', DIRECTION: 'ALL', CURRENCY: 'KRW', VALID_FROM: '2026-01-01', VALID_TO: '2026-12-31', INCLUDED_IN_OF: 'N', CHARGE_CONDITION: 'ALL' }, o);
const base = { direction: 'EXPORT', pol: 'KRPUS', pod: 'VNHPH', quoteDate: TODAY };
const line = (opt, code, type) => opt.lines.find((l) => l.code === code && (type === undefined || l.containerType === type));

test('정규화: 항구명 BUSAN/PUSAN/KRPUS/부산 → KRPUS', () => {
  for (const s of ['BUSAN', 'pusan', 'KRPUS', '부산', 'Busan, Korea', 'KR PUS']) assert.equal(N.normalizePort(s).code, 'KRPUS', s);
  assert.equal(N.normalizePort('Ho Chi Minh').code, 'VNSGN');
  assert.equal(N.normalizePort('XXYYY').known, false);
});

test('정규화: 컨테이너 40HQ/40HC/40\'HC → 40HC, 20DC → 20GP', () => {
  assert.equal(N.normalizeContainer('40HQ').code, '40HC');
  assert.equal(N.normalizeContainer("40'HC").code, '40HC');
  assert.equal(N.normalizeContainer('20DC').code, '20GP');
  assert.equal(N.normalizeContainer('40 reefer').code, '40RF');
  assert.equal(N.teuOf('40HC'), 2);
  assert.equal(N.teuOf('20GP'), 1);
});

test('정규화: 날짜 (Excel 일련번호, 점/슬래시, 잘못된 날짜)', () => {
  assert.equal(N.normalizeDate(46327), '2026-11-01');
  assert.equal(N.normalizeDate('2026.11.01'), '2026-11-01');
  assert.equal(N.normalizeDate('2026/2/30'), null);
});

test('운임 검색: 유효기간 내 운임만 사용, 만료 시 임의 계산하지 않음', () => {
  const db = { CARRIER_RATE: [rate({ CARRIER: 'A', CONTAINER_TYPE: '20GP', OCEAN_FREIGHT: 100, VALID_TO: '2026-10-31' })] };
  const r = E.calculateQuote(db, Object.assign({}, base, { containers: [{ type: '20GP', qty: 1 }] }));
  assert.equal(r.options.length, 0);
  assert.equal(r.expiredRates.length, 1);
  assert.match(r.globalMessages[0].title, /운임 확인 필요/);
});

test('복수 컨테이너: 20GP×2 + 40HC×3 정확 계산, PER_BL/PER_CONTAINER/PER_TEU 구분', () => {
  const db = {
    CARRIER_RATE: [rate({ CARRIER: 'A', CONTAINER_TYPE: '20GP', OCEAN_FREIGHT: 150 }), rate({ CARRIER: 'A', CONTAINER_TYPE: '40HC', OCEAN_FREIGHT: 250 })],
    ORIGIN_CHARGE: [
      chg({ CHARGE_CODE: 'THC', CHARGE_NAME: 'THC', CONTAINER_TYPE: '20GP', CHARGE_AMOUNT: 165000, CHARGE_UNIT: 'PER_CONTAINER' }),
      chg({ CHARGE_CODE: 'THC', CHARGE_NAME: 'THC', CONTAINER_TYPE: '40HC', CHARGE_AMOUNT: 210000, CHARGE_UNIT: 'PER_CONTAINER' }),
      chg({ CHARGE_CODE: 'DOC', CHARGE_NAME: 'DOC', CHARGE_AMOUNT: 50000, CHARGE_UNIT: 'PER_BL' }),
      chg({ CHARGE_CODE: 'WFG', CHARGE_NAME: 'WFG', CHARGE_AMOUNT: 4420, CHARGE_UNIT: 'PER_TEU' })
    ]
  };
  const r = E.calculateQuote(db, Object.assign({}, base, { containers: [{ type: '20GP', qty: 2 }, { type: '40HQ', qty: 3 }], blCount: 2 }));
  const o = r.options[0];
  assert.equal(o.totals.USD, 150 * 2 + 250 * 3);
  assert.equal(line(o, 'DOC').qty, 2); // B/L 2건 → 컨테이너 수와 무관
  assert.equal(line(o, 'WFG', '40HC').qty, 6); // 40HC 3대 = 6 TEU
  assert.equal(o.totals.KRW, 165000 * 2 + 210000 * 3 + 50000 * 2 + 4420 * 2 + 4420 * 6);
});

test('같은 TYPE 여러 행 입력 시 수량 합산', () => {
  const db = { CARRIER_RATE: [rate({ CARRIER: 'A', CONTAINER_TYPE: '20GP', OCEAN_FREIGHT: 100 })] };
  const r = E.calculateQuote(db, Object.assign({}, base, { containers: [{ type: '20GP', qty: 2 }, { type: '20DC', qty: 1 }] }));
  assert.equal(r.options[0].totals.USD, 300);
});

test('선사별 요율이 항구 공통 요율보다 우선', () => {
  const db = {
    CARRIER_RATE: [rate({ CARRIER: 'A', CONTAINER_TYPE: '20GP', OCEAN_FREIGHT: 100 }), rate({ CARRIER: 'B', CONTAINER_TYPE: '20GP', OCEAN_FREIGHT: 110 })],
    ORIGIN_CHARGE: [
      chg({ CHARGE_CODE: 'DOC', CHARGE_NAME: 'DOC', CHARGE_AMOUNT: 50000, CHARGE_UNIT: 'PER_BL' }),
      chg({ CHARGE_CODE: 'DOC', CHARGE_NAME: 'DOC', CARRIER: 'B', CHARGE_AMOUNT: 40000, CHARGE_UNIT: 'PER_BL' })
    ]
  };
  const r = E.calculateQuote(db, Object.assign({}, base, { containers: [{ type: '20GP', qty: 1 }] }));
  const a = r.options.find((o) => o.carrier === 'A'), b = r.options.find((o) => o.carrier === 'B');
  assert.equal(line(a, 'DOC').unitPrice, 50000);
  assert.equal(line(b, 'DOC').unitPrice, 40000);
});

test('해상운임에 포함된 LOCAL CHARGE는 이중 청구하지 않음 (INCLUDED_CHARGES / INCLUDED_IN_OF)', () => {
  const db = {
    CARRIER_RATE: [rate({ CARRIER: 'A', CONTAINER_TYPE: '20GP', OCEAN_FREIGHT: 100, INCLUDED_CHARGES: ['LSS'] })],
    ORIGIN_CHARGE: [
      chg({ CHARGE_CODE: 'LSS', CHARGE_NAME: 'LSS', CURRENCY: 'USD', CHARGE_AMOUNT: 25, CHARGE_UNIT: 'PER_TEU' }),
      chg({ CHARGE_CODE: 'SEAL', CHARGE_NAME: 'SEAL', CHARGE_AMOUNT: 10000, CHARGE_UNIT: 'PER_CONTAINER', INCLUDED_IN_OF: 'Y' })
    ]
  };
  const o = E.calculateQuote(db, Object.assign({}, base, { containers: [{ type: '20GP', qty: 2 }] })).options[0];
  assert.equal(line(o, 'LSS').status, 'INCLUDED');
  assert.equal(line(o, 'SEAL').status, 'INCLUDED');
  assert.deepEqual(o.totals, { USD: 200 });
});

test('통화별 금액 분리 및 견적 제외 비용은 합계 미합산', () => {
  const db = {
    CARRIER_RATE: [rate({ CARRIER: 'A', CONTAINER_TYPE: '20GP', OCEAN_FREIGHT: 100 })],
    ORIGIN_CHARGE: [chg({ CHARGE_CODE: 'THC', CHARGE_NAME: 'THC', CHARGE_AMOUNT: 165000, CHARGE_UNIT: 'PER_CONTAINER' })],
    DEST_CHARGE: [chg({ _sheet: 'DEST_CHARGE', PORT_CODE: 'VNHPH', CHARGE_CODE: 'THC', CHARGE_NAME: 'THC', CURRENCY: 'USD', CHARGE_AMOUNT: 120, CHARGE_UNIT: 'PER_CONTAINER' })]
  };
  const o = E.calculateQuote(db, Object.assign({}, base, { containers: [{ type: '20GP', qty: 1 }], includeOrigin: true, includeDest: false })).options[0];
  assert.deepEqual(o.totals, { USD: 100, KRW: 165000 }); // DEST 제외
  const dest = o.lines.find((l) => l.section === 'DEST');
  dest.include = true; E.recomputeTotals(o);
  assert.deepEqual(o.totals, { USD: 220, KRW: 165000 });
});

test('수출/수입 구분에 따라 비용 적용', () => {
  const db = {
    CARRIER_RATE: [rate({ CARRIER: 'A', CONTAINER_TYPE: '20GP', OCEAN_FREIGHT: 100 })],
    ORIGIN_CHARGE: [
      chg({ CHARGE_CODE: 'EXP', CHARGE_NAME: 'export only', DIRECTION: 'EXPORT', CHARGE_AMOUNT: 1, CHARGE_UNIT: 'PER_BL' }),
      chg({ CHARGE_CODE: 'IMP', CHARGE_NAME: 'import only', DIRECTION: 'IMPORT', CHARGE_AMOUNT: 1, CHARGE_UNIT: 'PER_BL' })
    ]
  };
  const o = E.calculateQuote(db, Object.assign({}, base, { containers: [{ type: '20GP', qty: 1 }] })).options[0];
  assert.ok(line(o, 'EXP'));
  assert.equal(line(o, 'IMP'), undefined);
});

test('미확정 비용(금액 공란 AUTO_CHARGE, PER_KG 중량 미입력)은 계산하지 않고 견적 불완전 표시', () => {
  const db = {
    CARRIER_RATE: [rate({ CARRIER: 'A', CONTAINER_TYPE: '20GP', OCEAN_FREIGHT: 100 })],
    ORIGIN_CHARGE: [chg({ CHARGE_CODE: 'KGF', CHARGE_NAME: 'per kg', CHARGE_AMOUNT: 10, CHARGE_UNIT: 'PER_KG' })],
    PORT_REMARK: [{ _sheet: 'PORT_REMARK', _row: 2, PORT_CODE: 'VNHPH', PORT_ROLE: 'POD', CARRIER: 'ALL', CONTAINER_TYPE: 'ALL', CARGO_CONDITION: 'ALL', DIRECTION: 'ALL', REMARK_TYPE: 'AUTO_CHARGE', TITLE: 'PIF', LEGAL_REVIEW: 'N', CHARGE_CODE: 'PIF', CHARGE_NAME: 'PIF', CHARGE_AMOUNT: null, CURRENCY: null, CHARGE_UNIT: 'PER_SHIPMENT' }]
  };
  const o = E.calculateQuote(db, Object.assign({}, base, { containers: [{ type: '20GP', qty: 1 }] })).options[0];
  assert.equal(line(o, 'KGF').status, 'PENDING');
  assert.equal(line(o, 'PIF').status, 'PENDING');
  assert.equal(o.pendingCount, 2);
  assert.equal(o.complete, false);
  assert.equal(o.status, 'REVIEW_REQUIRED');
  assert.deepEqual(o.totals, { USD: 100 });
  const o2 = E.calculateQuote(db, Object.assign({}, base, { containers: [{ type: '20GP', qty: 1 }], grossWeightKg: 1500 })).options[0];
  assert.equal(line(o2, 'KGF').amount, 15000);
});

test('일부 TYPE 운임 미등록 시 "운임 확인 필요", 정렬은 누락 없는 선사 우선 → 총원가 낮은 순', () => {
  const db = {
    CARRIER_RATE: [
      rate({ CARRIER: 'CHEAP', CONTAINER_TYPE: '20GP', OCEAN_FREIGHT: 50 }),
      rate({ CARRIER: 'A', CONTAINER_TYPE: '20GP', OCEAN_FREIGHT: 150 }), rate({ CARRIER: 'A', CONTAINER_TYPE: '40HC', OCEAN_FREIGHT: 250 }),
      rate({ CARRIER: 'B', CONTAINER_TYPE: '20GP', OCEAN_FREIGHT: 130 }), rate({ CARRIER: 'B', CONTAINER_TYPE: '40HC', OCEAN_FREIGHT: 230 })
    ]
  };
  const r = E.calculateQuote(db, Object.assign({}, base, { containers: [{ type: '20GP', qty: 1 }, { type: '40HC', qty: 1 }] }));
  assert.deepEqual(r.options.map((o) => o.carrier), ['B', 'A', 'CHEAP']);
  const cheap = r.options[2];
  assert.deepEqual(cheap.missingTypes, ['40HC']);
  assert.equal(line(cheap, 'O/F', '40HC').status, 'PENDING');
});

test('위험물(DG): DG 불가 요율 제외, DG 조건 비용 추가, 법적 검토 → 확정 제한', () => {
  const db = {
    CARRIER_RATE: [rate({ CARRIER: 'A', CONTAINER_TYPE: '20GP', OCEAN_FREIGHT: 100, DG_ACCEPT: 'N' }), rate({ CARRIER: 'B', CONTAINER_TYPE: '20GP', OCEAN_FREIGHT: 120 })],
    ORIGIN_CHARGE: [chg({ CHARGE_CODE: 'DGS', CHARGE_NAME: 'DG', CURRENCY: 'USD', CHARGE_AMOUNT: 150, CHARGE_UNIT: 'PER_CONTAINER', CHARGE_CONDITION: 'DG' })]
  };
  const nonDg = E.calculateQuote(db, Object.assign({}, base, { containers: [{ type: '20GP', qty: 1 }] }));
  assert.equal(nonDg.options.length, 2);
  assert.equal(line(nonDg.options[0], 'DGS'), undefined);
  const dg = E.calculateQuote(db, Object.assign({}, base, { containers: [{ type: '20GP', qty: 1 }], dg: true }));
  assert.deepEqual(dg.options.map((o) => o.carrier), ['B']);
  assert.equal(dg.excluded[0].carrier, 'A');
  assert.equal(line(dg.options[0], 'DGS').amount, 150);
  assert.equal(dg.options[0].legalHold, true);
});

test('PERCENTAGE: 동일 통화 해상운임 기준으로 계산', () => {
  const db = {
    CARRIER_RATE: [rate({ CARRIER: 'A', CONTAINER_TYPE: '20GP', OCEAN_FREIGHT: 200 })],
    ORIGIN_CHARGE: [chg({ CHARGE_CODE: 'PCT', CHARGE_NAME: 'pct', CURRENCY: 'USD', CHARGE_AMOUNT: 5, CHARGE_UNIT: 'PERCENTAGE' }),
      chg({ CHARGE_CODE: 'PCK', CHARGE_NAME: 'pct krw', CURRENCY: 'KRW', CHARGE_AMOUNT: 5, CHARGE_UNIT: 'PERCENTAGE' })]
  };
  const o = E.calculateQuote(db, Object.assign({}, base, { containers: [{ type: '20GP', qty: 2 }] })).options[0];
  assert.equal(line(o, 'PCT').amount, 20);
  assert.equal(line(o, 'PCK').status, 'PENDING'); // KRW 해상운임 없음 → 계산 안 함
});

test('만료된 LOCAL CHARGE는 확인 필요로 표시', () => {
  const db = {
    CARRIER_RATE: [rate({ CARRIER: 'A', CONTAINER_TYPE: '20GP', OCEAN_FREIGHT: 100 })],
    ORIGIN_CHARGE: [chg({ CHARGE_CODE: 'DOC', CHARGE_NAME: 'DOC', CHARGE_AMOUNT: 50000, CHARGE_UNIT: 'PER_BL', VALID_TO: '2026-10-31' })]
  };
  const o = E.calculateQuote(db, Object.assign({}, base, { containers: [{ type: '20GP', qty: 1 }] })).options[0];
  assert.equal(line(o, 'DOC').status, 'PENDING');
  assert.match(line(o, 'DOC').note, /만료/);
});

test('판매가 변경 시 판매 합계/이익 재계산, 원가는 유지', () => {
  const db = { CARRIER_RATE: [rate({ CARRIER: 'A', CONTAINER_TYPE: '20GP', OCEAN_FREIGHT: 100 })] };
  const o = E.calculateQuote(db, Object.assign({}, base, { containers: [{ type: '20GP', qty: 3 }] })).options[0];
  o.lines[0].sellUnitPrice = 130; E.recomputeTotals(o);
  assert.equal(o.totals.USD, 300);
  assert.equal(o.sellTotals.USD, 390);
});

test('입력 검증: POL=POD, 수량 0, 컨테이너 없음', () => {
  const r = E.calculateQuote({}, { direction: 'EXPORT', pol: 'BUSAN', pod: 'KRPUS', containers: [{ type: '20GP', qty: 0 }] });
  assert.ok(r.errors.some((e) => /같습니다/.test(e)));
  assert.ok(r.errors.some((e) => /정수/.test(e)));
});

test('업로드 검증: 필수값 누락·통화 오류·중복 요율·기간 역전 행 제외', () => {
  const H = ['RATE_ID', 'DIRECTION', 'CARRIER', 'POL', 'POD', 'CONTAINER_TYPE', 'OCEAN_FREIGHT', 'CURRENCY', 'VALID_FROM', 'VALID_TO'];
  const p = S.parseWorkbook({
    CARRIER_RATE: [H,
      ['1', 'EXPORT', 'A', 'BUSAN', 'HAIPHONG', '20GP', 100, 'USD', '2026-11-01', '2026-11-30'],
      ['2', 'EXPORT', 'A', 'PUSAN', 'VNHPH', '20DC', 90, 'USD', '2026-11-15', '2026-12-15'], // 1번과 기간 겹침 → 중복
      ['3', 'EXPORT', 'B', 'BUSAN', 'HAIPHONG', '20GP', '', 'USD', '2026-11-01', '2026-11-30'], // 운임 누락
      ['4', 'EXPORT', 'C', 'BUSAN', 'HAIPHONG', '20GP', 100, 'US', '2026-11-01', '2026-11-30'], // 통화 오류
      ['5', 'EXPORT', 'D', 'BUSAN', 'HAIPHONG', '20GP', 100, 'USD', '2026-12-01', '2026-11-01'], // 기간 역전
      ['6', 'EXPORT', 'A', 'BUSAN', 'HAIPHONG', '20GP', 110, 'USD', '2026-12-01', '2026-12-31'] // 기간 안 겹침 → 정상
    ]
  }, { today: TODAY });
  assert.deepEqual(p.data.CARRIER_RATE.map((r) => r.RATE_ID), ['1', '6']);
  assert.equal(p.data.CARRIER_RATE[0].POL, 'KRPUS');
  assert.equal(p.errorCount, 4);
});

test('Excel 왕복: 템플릿 생성 → 읽기 → 검증 → 견적 → 견적서 생성', async () => {
  const buf = B.buildTemplateWorkbook(true);
  const wb = await X.readWorkbook(buf);
  const p = S.parseWorkbook(wb, { today: TODAY });
  assert.equal(p.errorCount, 0);
  assert.equal(p.summary.CARRIER_RATE, 14);
  const db = Object.assign({ settings: p.settings }, p.data);
  const r = E.calculateQuote(db, { direction: 'EXPORT', pol: 'BUSAN', pod: 'HAIPHONG', containers: [{ type: '20GP', qty: 2 }, { type: '40HC', qty: 3 }], quoteDate: TODAY });
  assert.equal(r.options.length, 3);
  const o = r.options.find((x) => x.carrier === 'SAMPLE-A');
  const q = { no: 'T-1', date: TODAY, request: r.request, status: 'DRAFT' };
  const cust = await X.readWorkbook(B.buildCustomerQuotation(q, o, p.settings));
  const flat = cust.Quotation.flat().map(String).join('|');
  assert.ok(flat.includes('Ocean Freight'));
  assert.ok(flat.includes('TBA'));
  assert.ok(!flat.includes('원가'), '고객용 견적서에 원가 노출 금지');
  const internal = await X.readWorkbook(B.buildInternalQuotation(q, o, p.settings, r));
  assert.ok(internal['내부검토'].flat().map(String).join('|').includes('원가 단가'));
});
