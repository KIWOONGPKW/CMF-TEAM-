/* CMF Freight Quotation System - 경량 XLSX 읽기/쓰기 (외부 라이브러리 없음)
 *  - 읽기: ZIP 해제(DecompressionStream 'deflate-raw') → sharedStrings / sheet XML 파싱
 *  - 쓰기: 숫자/문자/수식/서식이 있는 실제 xlsx 생성 (ZIP stored 방식)
 */
(function (root, factory) {
  var m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m;
  else { root.CMF = root.CMF || {}; Object.assign(root.CMF, m); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------- 공통 ----------------
  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(buf) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  var enc = new TextEncoder(), dec = new TextDecoder('utf-8');

  function xmlEsc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  }
  function xmlUnesc(s) {
    return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&#x([0-9a-fA-F]+);/g, function (_, h) { return String.fromCodePoint(parseInt(h, 16)); })
      .replace(/&#(\d+);/g, function (_, d) { return String.fromCodePoint(+d); })
      .replace(/&amp;/g, '&')
      .replace(/_x([0-9A-F]{4})_/g, function (_, h) { return String.fromCharCode(parseInt(h, 16)); });
  }

  // ---------------- ZIP 읽기 ----------------
  async function inflateRaw(data) {
    var ds = new DecompressionStream('deflate-raw');
    var stream = new Blob([data]).stream().pipeThrough(ds);
    var ab = await new Response(stream).arrayBuffer();
    return new Uint8Array(ab);
  }
  async function unzip(u8) {
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    var eocd = -1;
    for (var i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('올바른 xlsx(zip) 파일이 아닙니다. .xls(구버전)라면 Excel에서 .xlsx로 다시 저장하세요.');
    var count = dv.getUint16(eocd + 10, true);
    var cdOff = dv.getUint32(eocd + 16, true);
    var files = {};
    var p = cdOff;
    for (var n = 0; n < count; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      var method = dv.getUint16(p + 10, true);
      var csize = dv.getUint32(p + 20, true);
      var nameLen = dv.getUint16(p + 28, true), extraLen = dv.getUint16(p + 30, true), commLen = dv.getUint16(p + 32, true);
      var lho = dv.getUint32(p + 42, true);
      var name = dec.decode(u8.subarray(p + 46, p + 46 + nameLen));
      var lNameLen = dv.getUint16(lho + 26, true), lExtraLen = dv.getUint16(lho + 28, true);
      var start = lho + 30 + lNameLen + lExtraLen;
      files[name] = { method: method, data: u8.subarray(start, start + csize) };
      p += 46 + nameLen + extraLen + commLen;
    }
    return {
      names: Object.keys(files),
      read: async function (name) {
        var f = files[name] || files[name.replace(/^\//, '')];
        if (!f) return null;
        var raw = f.method === 0 ? f.data : f.method === 8 ? await inflateRaw(f.data) : null;
        if (!raw) throw new Error('지원하지 않는 압축 방식: ' + f.method);
        return dec.decode(raw);
      }
    };
  }

  function attr(attrs, name) {
    var m = attrs.match(new RegExp('(?:^|\\s)' + name + '="([^"]*)"'));
    return m ? xmlUnesc(m[1]) : null;
  }
  function colIndex(ref) {
    var m = /^([A-Z]+)/.exec(ref); if (!m) return -1;
    var s = m[1], n = 0;
    for (var i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
    return n - 1;
  }
  function textOf(xml) {
    // <t>..</t> 들을 이어붙임 (윗주 rPh 제외)
    xml = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
    var out = '', re = /<t\b[^>]*>([\s\S]*?)<\/t>|<t\b[^>]*\/>/g, m;
    while ((m = re.exec(xml))) out += m[1] ? xmlUnesc(m[1]) : '';
    return out;
  }

  /** xlsx(ArrayBuffer|Uint8Array) → { 시트명: [[셀값,...],...] } */
  async function readWorkbook(buf) {
    var u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    var zip = await unzip(u8);
    var wb = await zip.read('xl/workbook.xml');
    if (!wb) throw new Error('xlsx 구조 오류: workbook.xml 없음');
    var relsXml = (await zip.read('xl/_rels/workbook.xml.rels')) || '';
    var rels = {}, m, re = /<Relationship\b([^>]*)\/?>/g;
    while ((m = re.exec(relsXml))) rels[attr(m[1], 'Id')] = attr(m[1], 'Target');
    var sst = [];
    var sstXml = await zip.read('xl/sharedStrings.xml');
    if (sstXml) { var sre = /<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g; while ((m = sre.exec(sstXml))) sst.push(m[1] ? textOf(m[1]) : ''); }
    var out = {}, order = [];
    var shre = /<sheet\b([^>]*)\/?>/g;
    var sheets = [];
    while ((m = shre.exec(wb))) sheets.push({ name: attr(m[1], 'name'), rid: attr(m[1], 'r:id') });
    for (var s = 0; s < sheets.length; s++) {
      var target = rels[sheets[s].rid]; if (!target) continue;
      var path = target.charAt(0) === '/' ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
      var xml = await zip.read(path); if (!xml) continue;
      out[sheets[s].name] = parseSheet(xml, sst);
      order.push(sheets[s].name);
    }
    Object.defineProperty(out, '_order', { value: order, enumerable: false });
    return out;
  }

  function parseSheet(xml, sst) {
    var rows = [];
    var sd = xml.match(/<sheetData\b[^>]*>([\s\S]*?)<\/sheetData>/);
    if (!sd) return rows;
    var rre = /<row\b([^>]*)>([\s\S]*?)<\/row>/g, rm, autoR = 0;
    while ((rm = rre.exec(sd[1]))) {
      var rn = attr(rm[1], 'r'); var ri = rn ? (+rn - 1) : autoR; autoR = ri + 1;
      var row = [];
      var cre = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, cm, autoC = 0;
      while ((cm = cre.exec(rm[2]))) {
        var ref = attr(cm[1], 'r'); var ci = ref ? colIndex(ref) : autoC; autoC = ci + 1;
        var t = attr(cm[1], 't'); var inner = cm[2] || '';
        var vm = inner.match(/<v\b[^>]*>([\s\S]*?)<\/v>/);
        var v = vm ? xmlUnesc(vm[1]) : null, val = null;
        if (t === 's') val = v == null ? null : sst[+v];
        else if (t === 'inlineStr') val = textOf(inner);
        else if (t === 'str') val = v;
        else if (t === 'b') val = v === '1';
        else if (t === 'e') val = null;
        else val = v == null || v === '' ? null : Number(v);
        row[ci] = val;
      }
      for (var k = 0; k < row.length; k++) if (row[k] === undefined) row[k] = null;
      rows[ri] = row;
    }
    for (var r = 0; r < rows.length; r++) if (!rows[r]) rows[r] = [];
    return rows;
  }

  // ---------------- ZIP 쓰기 (stored) ----------------
  function zipStore(entries) {
    var parts = [], central = [], offset = 0;
    entries.forEach(function (e) {
      var nameB = enc.encode(e.name);
      var data = typeof e.data === 'string' ? enc.encode(e.data) : e.data;
      var crc = crc32(data);
      var lh = new Uint8Array(30 + nameB.length); var ldv = new DataView(lh.buffer);
      ldv.setUint32(0, 0x04034b50, true); ldv.setUint16(4, 20, true); ldv.setUint16(6, 0x0800, true); ldv.setUint16(8, 0, true);
      ldv.setUint16(10, 0, true); ldv.setUint16(12, 0x21, true); ldv.setUint32(14, crc, true);
      ldv.setUint32(18, data.length, true); ldv.setUint32(22, data.length, true); ldv.setUint16(26, nameB.length, true); ldv.setUint16(28, 0, true);
      lh.set(nameB, 30);
      var ch = new Uint8Array(46 + nameB.length); var cdv = new DataView(ch.buffer);
      cdv.setUint32(0, 0x02014b50, true); cdv.setUint16(4, 20, true); cdv.setUint16(6, 20, true); cdv.setUint16(8, 0x0800, true);
      cdv.setUint16(10, 0, true); cdv.setUint16(12, 0, true); cdv.setUint16(14, 0x21, true); cdv.setUint32(16, crc, true);
      cdv.setUint32(20, data.length, true); cdv.setUint32(24, data.length, true); cdv.setUint16(28, nameB.length, true);
      cdv.setUint32(42, offset, true); ch.set(nameB, 46);
      parts.push(lh, data); central.push(ch);
      offset += lh.length + data.length;
    });
    var cdSize = central.reduce(function (a, c) { return a + c.length; }, 0);
    var end = new Uint8Array(22); var edv = new DataView(end.buffer);
    edv.setUint32(0, 0x06054b50, true); edv.setUint16(8, entries.length, true); edv.setUint16(10, entries.length, true);
    edv.setUint32(12, cdSize, true); edv.setUint32(16, offset, true);
    var all = parts.concat(central, [end]);
    var total = all.reduce(function (a, c) { return a + c.length; }, 0);
    var out = new Uint8Array(total), p = 0;
    all.forEach(function (c) { out.set(c, p); p += c.length; });
    return out;
  }

  // ---------------- 스타일 ----------------
  // 스타일 키 → cellXfs 인덱스
  var STYLE = {
    default: 0, header: 1, num: 2, text: 3, title: 4, date: 5, totalNum: 6, wrap: 7, small: 8, int: 9,
    label: 10, totalLabel: 11, section: 12, warn: 13, pending: 14, subtitle: 15, numRight: 16, textCenter: 17, num0: 18
  };
  var STYLES_XML =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00"/><numFmt numFmtId="165" formatCode="yyyy-mm-dd"/></numFmts>' +
    '<fonts count="7">' +
    '<font><sz val="10"/><name val="Arial"/><family val="2"/></font>' +
    '<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/><family val="2"/></font>' +
    '<font><b/><sz val="18"/><color rgb="FF1F5F5B"/><name val="Arial"/><family val="2"/></font>' +
    '<font><b/><sz val="10"/><name val="Arial"/><family val="2"/></font>' +
    '<font><sz val="9"/><color rgb="FF666666"/><name val="Arial"/><family val="2"/></font>' +
    '<font><b/><sz val="10"/><color rgb="FFB42318"/><name val="Arial"/><family val="2"/></font>' +
    '<font><b/><sz val="12"/><color rgb="FF1F5F5B"/><name val="Arial"/><family val="2"/></font>' +
    '</fonts>' +
    '<fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF1F5F5B"/><bgColor indexed="64"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFEEF3F1"/><bgColor indexed="64"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFFFF4E5"/><bgColor indexed="64"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFF7F7F7"/><bgColor indexed="64"/></patternFill></fill>' +
    '</fills>' +
    '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
    '<border><left style="thin"><color rgb="FFC9D1DC"/></left><right style="thin"><color rgb="FFC9D1DC"/></right><top style="thin"><color rgb="FFC9D1DC"/></top><bottom style="thin"><color rgb="FFC9D1DC"/></bottom><diagonal/></border>' +
    '</borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="19">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +                                                                  // 0 default
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' + // 1 header
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>' +                            // 2 num
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' + // 3 text
    '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +                                                      // 4 title
    '<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left"/></xf>' + // 5 date
    '<xf numFmtId="164" fontId="3" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>' + // 6 totalNum
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +     // 7 wrap
    '<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +                                                      // 8 small
    '<xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>' + // 9 int
    '<xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>' + // 10 label
    '<xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right"/></xf>' + // 11 totalLabel
    '<xf numFmtId="0" fontId="3" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>' +                         // 12 section
    '<xf numFmtId="0" fontId="5" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' + // 13 warn
    '<xf numFmtId="0" fontId="5" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right"/></xf>' + // 14 pending
    '<xf numFmtId="0" fontId="6" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +                                                      // 15 subtitle
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right"/></xf>' + // 16 numRight
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' + // 17 textCenter
    '<xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right"/></xf>' + // 18 num0
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>';

  function colName(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }

  /** 셀 값: 원시값 또는 {v, f, s, t} (s = STYLE 키) */
  function cellXml(ref, cell) {
    if (cell == null || cell === '') return '';
    var c = (typeof cell === 'object' && !(cell instanceof Date)) ? cell : { v: cell };
    var s = c.s != null ? (typeof c.s === 'number' ? c.s : STYLE[c.s] || 0) : 0;
    var sa = s ? ' s="' + s + '"' : '';
    var v = c.v;
    if (v instanceof Date) v = (Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()) / 86400000) + 25569;
    if (c.date && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) { var p = v.split('-'); v = Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000 + 25569; }
    if (c.f) {
      var cached = v == null ? '' : (typeof v === 'number' ? '<v>' + v + '</v>' : '');
      var tt = typeof v === 'string' ? ' t="str"' : '';
      return '<c r="' + ref + '"' + sa + tt + '><f>' + xmlEsc(c.f) + '</f>' + (typeof v === 'string' ? '<v>' + xmlEsc(v) + '</v>' : cached) + '</c>';
    }
    if (v == null || v === '') return s ? '<c r="' + ref + '"' + sa + '/>' : '';
    if (typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '"' + sa + '><v>' + v + '</v></c>';
    if (typeof v === 'boolean') return '<c r="' + ref + '"' + sa + ' t="b"><v>' + (v ? 1 : 0) + '</v></c>';
    return '<c r="' + ref + '"' + sa + ' t="inlineStr"><is><t xml:space="preserve">' + xmlEsc(v) + '</t></is></c>';
  }

  function sheetXml(sh) {
    var x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">';
    x += '<sheetViews><sheetView workbookViewId="0"' + (sh.showGrid === false ? ' showGridLines="0"' : '') + '>';
    if (sh.freeze) x += '<pane ySplit="' + sh.freeze + '" topLeftCell="A' + (sh.freeze + 1) + '" activePane="bottomLeft" state="frozen"/>';
    x += '</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>';
    if (sh.cols && sh.cols.length) {
      x += '<cols>' + sh.cols.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols>';
    }
    x += '<sheetData>';
    (sh.rows || []).forEach(function (row, ri) {
      if (!row) return;
      var cells = '';
      var ht = row._height ? ' ht="' + row._height + '" customHeight="1"' : '';
      row.forEach(function (cell, ci) { cells += cellXml(colName(ci) + (ri + 1), cell); });
      if (cells || ht) x += '<row r="' + (ri + 1) + '"' + ht + '>' + cells + '</row>';
    });
    x += '</sheetData>';
    if (sh.merges && sh.merges.length) x += '<mergeCells count="' + sh.merges.length + '">' + sh.merges.map(function (m) { return '<mergeCell ref="' + m + '"/>'; }).join('') + '</mergeCells>';
    if (sh.validations && sh.validations.length) {
      x += '<dataValidations count="' + sh.validations.length + '">' + sh.validations.map(function (d) {
        return '<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="' + d.ref + '"><formula1>"' + xmlEsc(d.list.join(',')) + '"</formula1></dataValidation>';
      }).join('') + '</dataValidations>';
    }
    x += '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>';
    if (sh.fitWidth) x += '<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/>';
    x += '</worksheet>';
    if (sh.fitWidth) x = x.replace('<sheetViews>', '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews>');
    return x;
  }

  /**
   * 워크북 생성
   * @param sheets [{name, rows:[[cell]], cols:[width], merges:['A1:C1'], freeze: n, validations:[{ref,list}]}]
   * @returns Uint8Array (xlsx)
   */
  function writeWorkbook(sheets, meta) {
    meta = meta || {};
    var files = [];
    files.push({
      name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        sheets.map(function (s, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
        '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
        '</Types>'
    });
    files.push({
      name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
        '</Relationships>'
    });
    var now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    files.push({
      name: 'docProps/core.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
        '<dc:title>' + xmlEsc(meta.title || 'CMF Quotation') + '</dc:title><dc:creator>CMF Freight Quotation System</dc:creator>' +
        '<dcterms:created xsi:type="dcterms:W3CDTF">' + now + '</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">' + now + '</dcterms:modified>' +
        '</cp:coreProperties>'
    });
    files.push({
      name: 'docProps/app.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>CMF Freight Quotation System</Application></Properties>'
    });
    files.push({
      name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="16000"/></bookViews><sheets>' +
        sheets.map(function (s, i) { return '<sheet name="' + xmlEsc(s.name.slice(0, 31)) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') +
        '</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>'
    });
    files.push({
      name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sheets.map(function (s, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') +
        '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '</Relationships>'
    });
    files.push({ name: 'xl/styles.xml', data: STYLES_XML });
    sheets.forEach(function (s, i) { files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: sheetXml(s) }); });
    return zipStore(files);
  }

  return { readWorkbook: readWorkbook, writeWorkbook: writeWorkbook, XSTYLE: STYLE, colName: colName };
});
