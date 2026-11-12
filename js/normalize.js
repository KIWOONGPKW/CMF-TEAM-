/* CMF Freight Quotation System - 정규화 모듈 (항구 / 컨테이너 / 통화 / 날짜 / 코드값)
 * 브라우저: window.CMF.* 로 노출 / Node: module.exports
 */
(function (root, factory) {
  var m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m;
  else { root.CMF = root.CMF || {}; Object.assign(root.CMF, m); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- 항구 (UN/LOCODE) ----------
  // 기본 항구 별칭표. Excel의 PORT 시트로 추가/덮어쓰기 가능.
  var BASE_PORTS = [
    ['KRPUS', 'BUSAN', ['PUSAN', 'BUSAN NEW PORT', 'BUSAN NEWPORT', '부산', '부산항', '부산신항']],
    ['KRINC', 'INCHEON', ['INCHON', '인천', '인천항', '인천신항']],
    ['KRKAN', 'GWANGYANG', ['KWANGYANG', '광양', '광양항']],
    ['KRUSN', 'ULSAN', ['울산', '울산항']],
    ['KRPTK', 'PYEONGTAEK', ['PYONGTAEK', '평택', '평택항']],
    ['CNSHA', 'SHANGHAI', ['상해', '상하이']],
    ['CNNGB', 'NINGBO', ['닝보']],
    ['CNTAO', 'QINGDAO', ['칭다오', '청도']],
    ['CNTXG', 'XINGANG', ['TIANJIN', 'TIANJIN XINGANG', '천진', '톈진']],
    ['CNDLC', 'DALIAN', ['대련', '다롄']],
    ['CNXMN', 'XIAMEN', ['하문', '샤먼']],
    ['CNYTN', 'YANTIAN', []],
    ['CNSZX', 'SHENZHEN', ['심천', '선전']],
    ['HKHKG', 'HONG KONG', ['HONGKONG', '홍콩']],
    ['TWKHH', 'KAOHSIUNG', ['가오슝']],
    ['JPTYO', 'TOKYO', ['도쿄', '동경']],
    ['JPYOK', 'YOKOHAMA', ['요코하마']],
    ['JPOSA', 'OSAKA', ['오사카']],
    ['JPUKB', 'KOBE', ['고베']],
    ['JPNGO', 'NAGOYA', ['나고야']],
    ['JPHKT', 'HAKATA', ['FUKUOKA', '하카타', '후쿠오카']],
    ['VNHPH', 'HAIPHONG', ['HAI PHONG', '하이퐁']],
    ['VNSGN', 'HO CHI MINH', ['HOCHIMINH', 'HCMC', 'CAT LAI', 'CATLAI', '호치민']],
    ['THBKK', 'BANGKOK', ['방콕']],
    ['THLCH', 'LAEM CHABANG', ['LAEMCHABANG', '램차방']],
    ['SGSIN', 'SINGAPORE', ['싱가포르', '싱가폴']],
    ['MYPKG', 'PORT KLANG', ['PORTKLANG', 'KLANG', '포트클랑']],
    ['MYPGU', 'PASIR GUDANG', []],
    ['IDJKT', 'JAKARTA', ['TANJUNG PRIOK', '자카르타']],
    ['IDSUB', 'SURABAYA', ['수라바야']],
    ['PHMNL', 'MANILA', ['마닐라']],
    ['INNSA', 'NHAVA SHEVA', ['NHAVASHEVA', 'JNPT', '나바샤바']],
    ['INMAA', 'CHENNAI', ['MADRAS', '첸나이']],
    ['INCCU', 'KOLKATA', ['CALCUTTA', '콜카타']],
    ['INMUN', 'MUNDRA', ['문드라']],
    ['AEJEA', 'JEBEL ALI', ['JEBELALI', 'DUBAI', '제벨알리', '두바이']],
    ['SADMM', 'DAMMAM', ['담맘']],
    ['SAJED', 'JEDDAH', ['제다']],
    ['USLAX', 'LOS ANGELES', ['LA', '로스앤젤레스']],
    ['USLGB', 'LONG BEACH', ['LONGBEACH', '롱비치']],
    ['USNYC', 'NEW YORK', ['NEWYORK', '뉴욕']],
    ['USSAV', 'SAVANNAH', ['사바나']],
    ['USSEA', 'SEATTLE', ['시애틀']],
    ['USOAK', 'OAKLAND', ['오클랜드']],
    ['NLRTM', 'ROTTERDAM', ['로테르담']],
    ['DEHAM', 'HAMBURG', ['함부르크']],
    ['BEANR', 'ANTWERP', ['앤트워프']],
    ['GBFXT', 'FELIXSTOWE', ['펠릭스토우']],
    ['AUSYD', 'SYDNEY', ['시드니']],
    ['AUMEL', 'MELBOURNE', ['멜버른']],
    ['MNULN', 'ULAANBAATAR', ['울란바토르']]
  ];

  function cleanKey(s) {
    return String(s == null ? '' : s).toUpperCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function buildPortIndex(extraRows) {
    var idx = {}; var names = {};
    function add(code, name, aliases) {
      code = cleanKey(code).replace(/\s/g, '');
      if (!/^[A-Z]{2}[A-Z0-9]{3}$/.test(code)) return;
      names[code] = cleanKey(name) || names[code] || code;
      idx[code] = code;
      if (name) { idx[cleanKey(name)] = code; idx[cleanKey(name).replace(/\s/g, '')] = code; }
      (aliases || []).forEach(function (a) {
        var k = cleanKey(a); if (!k) return;
        idx[k] = code; idx[k.replace(/\s/g, '')] = code;
      });
    }
    BASE_PORTS.forEach(function (p) { add(p[0], p[1], p[2]); });
    (extraRows || []).forEach(function (r) {
      var aliases = String(r.ALIASES || '').split(/[,;/|]/);
      add(r.UNLOCODE, r.PORT_NAME, aliases);
    });
    return { idx: idx, names: names };
  }

  var defaultPortIndex = buildPortIndex([]);

  /** 항구명/코드 → UN/LOCODE. 결과 {code, known} */
  function normalizePort(input, portIndex) {
    var pi = portIndex || defaultPortIndex;
    var k = cleanKey(input);
    if (!k) return { code: '', known: false };
    if (pi.idx[k]) return { code: pi.idx[k], known: true };
    var nos = k.replace(/\s/g, '');
    if (pi.idx[nos]) return { code: pi.idx[nos], known: true };
    // "KR PUS" 형태
    if (/^[A-Z]{2}[A-Z0-9]{3}$/.test(nos)) return { code: nos, known: false };
    // "BUSAN, KOREA" 처럼 국가명이 붙은 경우 첫 토막으로 재시도
    var first = cleanKey(String(input).split(/[,(]/)[0]);
    if (first && first !== k && pi.idx[first]) return { code: pi.idx[first], known: true };
    return { code: k, known: false };
  }

  function portName(code, portIndex) {
    var pi = portIndex || defaultPortIndex;
    return pi.names[code] || code;
  }

  // ---------- 컨테이너 ----------
  var CONTAINER_ALIASES = {
    '20GP': ['20GP', '20DC', '20DV', '20DRY', '20ST', '20SD', '20FT', '20', '20G'],
    '40GP': ['40GP', '40DC', '40DV', '40DRY', '40ST', '40SD', '40FT', '40', '40G'],
    '40HC': ['40HC', '40HQ', '40DH', '40HCDV', '40HDRY', '40HIGHCUBE', '40H'],
    '45HC': ['45HC', '45HQ', '45G1', '45'],
    '20RF': ['20RF', '20RE', '20RH', '20REEFER', '20R'],
    '40RF': ['40RF', '40RE', '40RQ', '40REEFER', '40R'],
    '40RH': ['40RH', '40HR', '40RHC', '40HCRF', '40RFHC', '40REEFERHC'],
    '20OT': ['20OT', '20OPENTOP'],
    '40OT': ['40OT', '40OPENTOP'],
    '20FR': ['20FR', '20FLATRACK', '20FLAT'],
    '40FR': ['40FR', '40FLATRACK', '40FLAT'],
    '20TK': ['20TK', '20TANK', '20ISOTANK']
  };
  var CONTAINER_MAP = {};
  Object.keys(CONTAINER_ALIASES).forEach(function (t) {
    CONTAINER_ALIASES[t].forEach(function (a) { CONTAINER_MAP[a] = t; });
  });
  var CONTAINER_TYPES = Object.keys(CONTAINER_ALIASES);

  function normalizeContainer(input) {
    var k = String(input == null ? '' : input).toUpperCase().replace(/[\s'"`’\-_.]/g, '').replace(/FEET|FOOT/g, 'FT');
    if (!k) return { code: '', known: false };
    if (k === 'ALL' || k === '*') return { code: 'ALL', known: true };
    if (CONTAINER_MAP[k]) return { code: CONTAINER_MAP[k], known: true };
    return { code: k, known: false };
  }

  /** TEU 환산: 20' = 1, 40' = 2, 45' = 2.25 */
  function teuOf(type) {
    var s = String(type);
    if (s.indexOf('45') === 0) return 2.25;
    if (s.indexOf('40') === 0) return 2;
    return 1;
  }
  function isReeferType(type) { return /^(20RF|40RF|40RH)$/.test(type); }

  // ---------- 통화 ----------
  var KNOWN_CURRENCIES = ['USD', 'KRW', 'EUR', 'JPY', 'CNY', 'RMB', 'HKD', 'SGD', 'THB', 'VND', 'IDR', 'MYR', 'PHP',
    'INR', 'AED', 'SAR', 'GBP', 'AUD', 'CAD', 'TWD', 'MNT', 'NZD', 'CHF'];
  function normalizeCurrency(input) {
    var k = String(input == null ? '' : input).toUpperCase().replace(/\s/g, '');
    if (k === '₩' || k === '원' || k === 'WON') k = 'KRW';
    if (k === '$' || k === 'US$') k = 'USD';
    if (k === 'RMB') k = 'CNY';
    return { code: k, valid: /^[A-Z]{3}$/.test(k), known: KNOWN_CURRENCIES.indexOf(k) >= 0 };
  }

  // ---------- 날짜 ----------
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  /** Excel 일련번호 / 문자열 / Date → 'YYYY-MM-DD' (실패 시 null) */
  function normalizeDate(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date && !isNaN(v)) return ymd(v);
    if (typeof v === 'number' && isFinite(v)) {
      if (v > 20000000 && v < 30000000) { // 20261231 형식
        var s8 = String(Math.round(v));
        return normalizeDate(s8.slice(0, 4) + '-' + s8.slice(4, 6) + '-' + s8.slice(6, 8));
      }
      // Excel serial (1900 날짜 체계)
      var ms = Math.round((v - 25569) * 86400000);
      var d = new Date(ms);
      return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
    }
    var s = String(v).trim();
    var m = s.match(/^(\d{4})[-./년\s]+(\d{1,2})[-./월\s]+(\d{1,2})/);
    if (!m) m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (m) {
      var y = +m[1], mo = +m[2], da = +m[3];
      var dt = new Date(y, mo - 1, da);
      if (dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === da) return ymd(dt);
    }
    return null;
  }
  function addDays(dateStr, n) {
    var p = dateStr.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2] + n);
    return ymd(d);
  }
  function daysBetween(a, b) {
    var pa = a.split('-'), pb = b.split('-');
    return Math.round((Date.UTC(+pb[0], +pb[1] - 1, +pb[2]) - Date.UTC(+pa[0], +pa[1] - 1, +pa[2])) / 86400000);
  }
  function today() { return ymd(new Date()); }

  // ---------- 코드값 ----------
  function normalizeDirection(v, allowAll) {
    var k = String(v == null ? '' : v).toUpperCase().replace(/\s/g, '');
    if (!k) return allowAll ? 'ALL' : '';
    if (['EXPORT', 'EXP', 'E', 'EX', 'OUTBOUND', '수출'].indexOf(k) >= 0) return 'EXPORT';
    if (['IMPORT', 'IMP', 'I', 'IM', 'INBOUND', '수입'].indexOf(k) >= 0) return 'IMPORT';
    if (allowAll && ['ALL', '*', 'BOTH', '공통', '전체'].indexOf(k) >= 0) return 'ALL';
    return null;
  }
  function normalizeYN(v, dflt) {
    var k = String(v == null ? '' : v).toUpperCase().trim();
    if (!k) return dflt;
    if (['Y', 'YES', 'TRUE', '1', 'O', '포함', '예'].indexOf(k) >= 0 || v === true) return 'Y';
    if (['N', 'NO', 'FALSE', '0', 'X', '미포함', '아니오'].indexOf(k) >= 0 || v === false) return 'N';
    return null;
  }
  function normalizeCarrier(v) {
    var k = String(v == null ? '' : v).toUpperCase().replace(/\s+/g, ' ').trim();
    if (k === '*' || k === '공통' || k === 'COMMON' || k === 'ANY') return 'ALL';
    return k;
  }
  var CHARGE_UNITS = ['PER_CONTAINER', 'PER_BL', 'PER_SHIPMENT', 'PER_TEU', 'PER_DAY', 'PER_KG', 'PERCENTAGE'];
  var UNIT_ALIASES = {
    'CNTR': 'PER_CONTAINER', 'CONTAINER': 'PER_CONTAINER', 'PER CNTR': 'PER_CONTAINER', 'PERCNTR': 'PER_CONTAINER', 'VAN': 'PER_CONTAINER', 'PERCONTAINER': 'PER_CONTAINER',
    'BL': 'PER_BL', 'B/L': 'PER_BL', 'PERBL': 'PER_BL', 'PER B/L': 'PER_BL', 'PERB/L': 'PER_BL',
    'SHIPMENT': 'PER_SHIPMENT', 'SHPT': 'PER_SHIPMENT', 'PERSHIPMENT': 'PER_SHIPMENT', '건': 'PER_SHIPMENT',
    'TEU': 'PER_TEU', 'PERTEU': 'PER_TEU', 'DAY': 'PER_DAY', 'PERDAY': 'PER_DAY', '일': 'PER_DAY',
    'KG': 'PER_KG', 'PERKG': 'PER_KG', '%': 'PERCENTAGE', 'PERCENT': 'PERCENTAGE', 'PCT': 'PERCENTAGE'
  };
  function normalizeUnit(v) {
    var k = String(v == null ? '' : v).toUpperCase().trim();
    if (CHARGE_UNITS.indexOf(k) >= 0) return k;
    var k2 = k.replace(/_/g, ' ');
    if (UNIT_ALIASES[k2]) return UNIT_ALIASES[k2];
    var k3 = k.replace(/[\s_]/g, '');
    if (UNIT_ALIASES[k3]) return UNIT_ALIASES[k3];
    return null;
  }
  var CONDITIONS = ['ALL', 'DRY', 'DG', 'NON_DG', 'REEFER', 'DOOR'];
  function normalizeCondition(v) {
    var k = String(v == null ? '' : v).toUpperCase().replace(/[\s-]/g, '_').trim();
    if (!k || k === '*' || k === '전체') return 'ALL';
    if (k === 'NONDG' || k === 'GENERAL' || k === 'NON_HAZ') return 'NON_DG';
    if (k === 'HAZ' || k === 'HAZARDOUS' || k === 'IMO' || k === '위험물') return 'DG';
    if (k === 'RF' || k === 'REEF' || k === '냉동') return 'REEFER';
    if (CONDITIONS.indexOf(k) >= 0) return k;
    return null;
  }
  var REMARK_TYPES = ['AUTO_CHARGE', 'WARNING', 'REVIEW_REQUIRED', 'INFORMATION'];
  function normalizeRemarkType(v) {
    var k = String(v == null ? '' : v).toUpperCase().replace(/[\s-]/g, '_').trim();
    if (k === 'INFO') return 'INFORMATION';
    if (k === 'REVIEW') return 'REVIEW_REQUIRED';
    return REMARK_TYPES.indexOf(k) >= 0 ? k : null;
  }

  return {
    buildPortIndex: buildPortIndex, normalizePort: normalizePort, portName: portName,
    normalizeContainer: normalizeContainer, CONTAINER_TYPES: CONTAINER_TYPES, teuOf: teuOf, isReeferType: isReeferType,
    normalizeCurrency: normalizeCurrency, KNOWN_CURRENCIES: KNOWN_CURRENCIES,
    normalizeDate: normalizeDate, addDays: addDays, daysBetween: daysBetween, today: today,
    normalizeDirection: normalizeDirection, normalizeYN: normalizeYN, normalizeCarrier: normalizeCarrier,
    normalizeUnit: normalizeUnit, CHARGE_UNITS: CHARGE_UNITS, normalizeCondition: normalizeCondition, CONDITIONS: CONDITIONS,
    normalizeRemarkType: normalizeRemarkType, REMARK_TYPES: REMARK_TYPES
  };
});
