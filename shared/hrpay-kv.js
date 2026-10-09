/* AC-HRA-PAY KV store v1.1 (2026-10-09, v3.9.23)
 * One small IndexedDB key/value store shared by all HRA-PAY pages ("ac_hrpay_kv").
 * Replaces large localStorage entries (sync state, pending queue, projection caches) so the
 * 5 MB localStorage of saintdou-weng.github.io is never filled by HRA-PAY again.
 *  - get(key, legacyLocalStorageKey?)  → Promise(value | null); old localStorage copy is migrated once and removed
 *  - set(key, value)                   → Promise(true/false); never throws, never interrupts the caller
 *  - remove(key)                       → Promise
 *  - lsSet(key, value)                 → safe localStorage.setItem: on quota it stores the value in IndexedDB instead
 * Values are stored as-is (objects / strings).
 *
 * Storage shield (whole page): localStorage.setItem never throws any more. When the 5 MB
 * localStorage of saintdou-weng.github.io is full, the value is written to IndexedDB instead and
 * localStorage.getItem still returns it (kept in memory, reloaded from IndexedDB on next visit).
 * Startup sweep: old big HRA-PAY entries still in localStorage are moved to IndexedDB once.
 */
(function (g) {
  'use strict';
  if (g.HRPayKV && g.HRPayKV.version) return;
  var DB = 'ac_hrpay_kv', ST = 'kv', dbp = null, mem = Object.create(null);

  function open() {
    if (dbp) return dbp;
    dbp = new Promise(function (res) {
      try {
        if (!g.indexedDB) return res(null);
        var rq = g.indexedDB.open(DB, 1);
        rq.onupgradeneeded = function () { var d = rq.result; if (!d.objectStoreNames.contains(ST)) d.createObjectStore(ST); };
        rq.onsuccess = function () { var d = rq.result; d.onversionchange = function () { try { d.close(); } catch (_) {} dbp = null; }; res(d); };
        rq.onerror = function () { res(null); };
        rq.onblocked = function () { res(null); };
      } catch (_) { res(null); }
    });
    return dbp;
  }
  function run(mode, fn) {
    return open().then(function (db) {
      if (!db) return { ok: false };
      return new Promise(function (res) {
        try {
          var t = db.transaction(ST, mode), s = t.objectStore(ST), r = fn(s), out = { ok: true };
          if (r) r.onsuccess = function () { out.value = r.result; };
          t.oncomplete = function () { res(out); };
          t.onerror = t.onabort = function () { res({ ok: false }); };
        } catch (_) { res({ ok: false }); }
      });
    });
  }
  function lsGet(k) { try { return g.localStorage ? g.localStorage.getItem(k) : null; } catch (_) { return null; } }
  function lsDel(k) { try { if (g.localStorage) g.localStorage.removeItem(k); } catch (_) {} }

  function get(key, legacyKey) {
    if (Object.prototype.hasOwnProperty.call(mem, key)) return Promise.resolve(mem[key]);
    return run('readonly', function (s) { return s.get(key); }).then(function (r) {
      var v = r.ok ? r.value : undefined;
      if (v !== undefined) { mem[key] = v; return v; }
      var lk = legacyKey === undefined ? key : legacyKey, raw = lk ? lsGet(lk) : null;
      if (raw == null) return null;
      var val = raw;
      try { val = JSON.parse(raw); } catch (_) { val = raw; }
      mem[key] = val;
      return set(key, val).then(function (ok) { if (ok) lsDel(lk); return val; });   // migrate once, then free localStorage
    });
  }
  function set(key, value) {
    mem[key] = value;
    return run('readwrite', function (s) { return s.put(value, key); }).then(function (r) { return !!r.ok; }, function () { return false; });
  }
  function remove(key) {
    delete mem[key];
    lsDel(key);
    return run('readwrite', function (s) { return s.delete(key); }).then(function () { return true; }, function () { return false; });
  }
  function lsSet(key, value) {
    try { g.localStorage.setItem(key, value); return true; }
    catch (e) {
      lsDel(key);
      set(key, value);   // quota or blocked: keep it in IndexedDB instead, never break the caller
      return false;
    }
  }

  /* ── storage shield: setItem never throws; overflow goes to IndexedDB ("lsx:<key>") ── */
  var OVER = Object.create(null), OVER_INDEX = 'lsx:__index', hasOwn = Object.prototype.hasOwnProperty;
  function saveOverIndex() { set(OVER_INDEX, Object.keys(OVER)); }
  function installShield() {
    try {
      var S = g.Storage && g.Storage.prototype;
      if (!S || S.__acShield) return;
      var oSet = S.setItem, oGet = S.getItem, oRem = S.removeItem;
      var isLocal = function (st) { try { return st === g.localStorage; } catch (_) { return false; } };
      S.setItem = function (k, v) {
        k = String(k); v = String(v);
        try {
          oSet.call(this, k, v);
          if (isLocal(this) && hasOwn.call(OVER, k)) { delete OVER[k]; run('readwrite', function (s) { return s.delete('lsx:' + k); }); saveOverIndex(); }
        } catch (e) {
          if (!isLocal(this)) return;                       // sessionStorage full: just skip
          try { oRem.call(this, k); } catch (_) {}
          OVER[k] = v; set('lsx:' + k, v); saveOverIndex();
          try { console.warn('[storage] localStorage full → IndexedDB:', k, Math.round(v.length / 1024) + 'K'); } catch (_) {}
        }
      };
      S.getItem = function (k) {
        var r = oGet.call(this, k);
        if (r === null && isLocal(this) && hasOwn.call(OVER, String(k))) return OVER[String(k)];
        return r;
      };
      S.removeItem = function (k) {
        oRem.call(this, k);
        k = String(k);
        if (isLocal(this) && hasOwn.call(OVER, k)) { delete OVER[k]; run('readwrite', function (s) { return s.delete('lsx:' + k); }); saveOverIndex(); }
      };
      S.__acShield = true;
      run('readonly', function (s) { return s.get(OVER_INDEX); }).then(function (r) {
        var list = r.ok && Array.isArray(r.value) ? r.value : [];
        list.forEach(function (k) {
          run('readonly', function (s) { return s.get('lsx:' + k); }).then(function (x) {
            if (x.ok && x.value != null && !hasOwn.call(OVER, k) && oGet.call(g.localStorage, k) === null) OVER[k] = String(x.value);
          });
        });
      });
    } catch (_) {}
  }

  /* ── one-time sweep: move big HRA-PAY entries out of localStorage ── */
  var SWEEP = [
    [/^ac_hrpay_smart_sync_v1_(.+)$/, 'sync:$1'],   // sync state (hashes / progress)
    [/^hrpay:auto2:(.+)$/, 'auto:$1'],               // pending queue
    [/^hrpay:result:.+$/, '$&'],                     // projection caches
    [/^hrpay:ot:projection:.+$/, '$&']               // OT projection signatures
  ];
  function sweep() {
    try {
      var ls = g.localStorage, keys = [];
      if (!ls) return;
      for (var i = 0; i < ls.length; i++) keys.push(ls.key(i));
      keys.forEach(function (k) {
        for (var j = 0; j < SWEEP.length; j++) {
          if (!SWEEP[j][0].test(k)) continue;
          var target = k.replace(SWEEP[j][0], SWEEP[j][1]), raw = lsGet(k), val = raw;
          if (raw == null) return;
          try { val = JSON.parse(raw); } catch (_) {}
          run('readonly', function (s) { return s.get(target); }).then(function (r) {
            if (r.ok && r.value !== undefined) { lsDel(k); return; }      // IndexedDB already has a newer copy
            set(target, val).then(function (ok) { if (ok) lsDel(k); });
          });
          return;
        }
      });
    } catch (_) {}
  }

  // projection / derived caches: always IndexedDB, old localStorage copy dropped; failure is skipped silently
  function cache(key, value) {
    lsDel(key);
    return set(key, value).catch(function () { return false; });
  }

  g.HRPayKV = { get: get, set: set, remove: remove, cache: cache, lsSet: lsSet, ready: open, version: '1.1' };
  g.hrpCache = function (key, value) { return cache(key, value); };
  installShield();
  setTimeout(sweep, 1500);
})(typeof window !== 'undefined' ? window : globalThis);
