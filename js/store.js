/* CMF Freight Quotation System - 브라우저 저장소 (IndexedDB, 사용 불가 시 메모리)
 *  stores: kv (현재 운임 DB·설정·카운터), uploads (업로드 이력/버전), quotes (견적 이력)
 *  향후 Supabase/PostgreSQL로 바꿀 때 이 파일의 함수만 교체하면 됨
 */
(function (root) {
  'use strict';
  var DB_NAME = 'cmf-quotation', DB_VER = 1;
  var mem = { kv: {}, uploads: {}, quotes: {} };
  var dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise(function (resolve) {
      try {
        if (!root.indexedDB) return resolve(null);
        var rq = root.indexedDB.open(DB_NAME, DB_VER);
        rq.onupgradeneeded = function () {
          var db = rq.result;
          if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
          if (!db.objectStoreNames.contains('uploads')) db.createObjectStore('uploads', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('quotes')) db.createObjectStore('quotes', { keyPath: 'no' });
        };
        rq.onsuccess = function () { resolve(rq.result); };
        rq.onerror = function () { resolve(null); };
        rq.onblocked = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
    return dbp;
  }
  function clone(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }

  /** db가 있으면 idbOp(objectStore) 요청 실행, 없으면 memOp() */
  function run(store, mode, idbOp, memOp) {
    return open().then(function (db) {
      if (!db) return memOp();
      return new Promise(function (resolve, reject) {
        try {
          var t = db.transaction(store, mode), req = idbOp(t.objectStore(store)), out;
          req.onsuccess = function () { out = req.result; };
          t.oncomplete = function () { resolve(out); };
          t.onerror = function () { reject(t.error); };
          t.onabort = function () { reject(t.error); };
        } catch (e) { reject(e); }
      });
    });
  }

  var Store = {
    isMemory: function () { return open().then(function (db) { return !db; }); },
    get: function (key) {
      return run('kv', 'readonly', function (os) { return os.get(key); }, function () { return clone(mem.kv[key]); });
    },
    set: function (key, val) {
      return run('kv', 'readwrite', function (os) { return os.put(clone(val), key); }, function () { mem.kv[key] = clone(val); });
    },
    putItem: function (store, item) {
      return run(store, 'readwrite', function (os) { return os.put(clone(item)); }, function () { mem[store][item.id || item.no] = clone(item); });
    },
    getItem: function (store, key) {
      return run(store, 'readonly', function (os) { return os.get(key); }, function () { return clone(mem[store][key]); });
    },
    all: function (store) {
      return run(store, 'readonly', function (os) { return os.getAll(); },
        function () { return Object.keys(mem[store]).map(function (k) { return clone(mem[store][k]); }); })
        .then(function (v) { return v || []; });
    },
    remove: function (store, key) {
      return run(store, 'readwrite', function (os) { return os.delete(key); }, function () { delete mem[store][key]; });
    },
    /** 견적번호: PREFIX-YYYYMMDD-001 (일자별 순번) */
    nextQuoteNo: function (prefix, dateStr) {
      var d = dateStr.replace(/-/g, '');
      var key = 'seq:' + d;
      return Store.get(key).then(function (n) {
        n = (n || 0) + 1;
        return Store.set(key, n).then(function () { return (prefix || 'CMFQ') + '-' + d + '-' + String(n).padStart(3, '0'); });
      });
    }
  };
  root.CMF = root.CMF || {};
  root.CMF.Store = Store;
})(typeof self !== 'undefined' ? self : this);
