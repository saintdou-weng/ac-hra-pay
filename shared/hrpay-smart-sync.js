/* AC-HRA-PAY Smart Incremental Sync v2.0 (2026-10-09)
 * Manifest + month/hash bucket sync (same model as AC HRA Portal).
 * v2.0
 *  - sync state (last synced hashes, row fingerprints, tombstones, progress) lives in IndexedDB
 *    (HRPayKV "sync:<tool>"); the old localStorage copy is migrated once and deleted
 *  - every bucket that uploads successfully is recorded immediately; an interrupted run resumes
 *    and only sends the remaining buckets (needs GAS v3.9.23 "smartBuckets"; older GAS still works)
 *  - 90 s timeout per bucket request; a failed bucket is retried alone (5 s / 15 s / 45 s, 3 times)
 *    and the run continues with the other buckets instead of aborting
 *  - SAFETY: deletions are pushed only for buckets with an explicit local tombstone, and a tombstone
 *    is only created when the sync state is complete and the user changed data on this device.
 *    Empty / incomplete state → add & update only, never delete. A bucket missing locally without
 *    a tombstone is restored from the cloud.
 * v1.5: three-way pull, readOnly pulls, page-language status text.
 */
(function(g) {
  'use strict';
  if (g.HRPaySmartSync) return;
  var VERSION = '2.0',
    STATE_PREFIX = 'ac_hrpay_smart_sync_v1_',   // legacy localStorage prefix (migrated)
    REQUEST_TIMEOUT_MS = 90000,
    MANIFEST_TIMEOUT_MS = 45000,
    RETRY_DELAYS = [5000, 15000, 45000],
    BATCH_MAX_BYTES = 1200000,
    BATCH_MAX_BUCKETS = 6,
    PARALLEL = 3,
    PASSIVE = /^(startup-reconcile|reconcile|resume|pageshow|network-restored|benefits-auto|auto)?$/,
    nativeFetch = g.fetch ? g.fetch.bind(g) : null;

  /* ── minimal IndexedDB KV (shared with shared/hrpay-kv.js; defined here too so this file works alone) ── */
  var KV = g.HRPayKV || (function() {
    var DB = 'ac_hrpay_kv', STN = 'kv', dbp = null, mem = Object.create(null);
    function open() {
      if (dbp) return dbp;
      dbp = new Promise(function(res) {
        try {
          if (!g.indexedDB) return res(null);
          var rq = g.indexedDB.open(DB, 1);
          rq.onupgradeneeded = function() { var d = rq.result; if (!d.objectStoreNames.contains(STN)) d.createObjectStore(STN); };
          rq.onsuccess = function() { res(rq.result); };
          rq.onerror = rq.onblocked = function() { res(null); };
        } catch (_) { res(null); }
      });
      return dbp;
    }
    function run(mode, fn) {
      return open().then(function(db) {
        if (!db) return { ok: false };
        return new Promise(function(res) {
          try {
            var t = db.transaction(STN, mode), r = fn(t.objectStore(STN)), out = { ok: true };
            if (r) r.onsuccess = function() { out.value = r.result; };
            t.oncomplete = function() { res(out); };
            t.onerror = t.onabort = function() { res({ ok: false }); };
          } catch (_) { res({ ok: false }); }
        });
      });
    }
    function set(k, v) { mem[k] = v; return run('readwrite', function(s) { return s.put(v, k); }).then(function(r) { return !!r.ok; }); }
    function get(k, legacy) {
      if (Object.prototype.hasOwnProperty.call(mem, k)) return Promise.resolve(mem[k]);
      return run('readonly', function(s) { return s.get(k); }).then(function(r) {
        if (r.ok && r.value !== undefined) { mem[k] = r.value; return r.value; }
        var raw = null; try { raw = legacy ? localStorage.getItem(legacy) : null; } catch (_) {}
        if (raw == null) return null;
        var v = raw; try { v = JSON.parse(raw); } catch (_) {}
        mem[k] = v;
        return set(k, v).then(function(ok) { if (ok) { try { localStorage.removeItem(legacy); } catch (_) {} } return v; });
      });
    }
    function remove(k) { delete mem[k]; return run('readwrite', function(s) { return s.delete(k); }); }
    var api = { get: get, set: set, remove: remove };
    g.HRPayKV = g.HRPayKV || api;
    return api;
  })();

  function now() {
    return new Date().toISOString();
  }

  function isEn() {
    try {
      if (typeof LANG !== 'undefined') return LANG === 'en' || LANG === 'km';
    } catch (_) {}
    try {
      var l = localStorage.getItem('hrpay_lang');
      return l === 'en' || l === 'km';
    } catch (_) {}
    return false;
  }

  function L(zh, en) {
    return isEn() ? en : zh;
  }

  // run async jobs with limited parallelism, keep order of results irrelevant
  function pool(items, limit, fn) {
    var i = 0,
      active = 0,
      done = 0,
      failed = null;
    return new Promise(function(resolve, reject) {
      if (!items.length) return resolve();
      function next() {
        if (failed) return;
        if (done === items.length) return resolve();
        while (active < limit && i < items.length) {
          (function(idx) {
            active++;
            Promise.resolve().then(function() {
              return fn(items[idx], idx);
            }).then(function() {
              active--;
              done++;
              next();
            }, function(e) {
              failed = e;
              reject(e);
            });
          })(i++);
        }
      }
      next();
    });
  }

  function enc(v) {
    return encodeURIComponent(String(v == null ? '' : v));
  }

  function text(v) {
    return String(v == null ? '' : v);
  }

  function status(fn, msg, type) {
    try {
      if (fn) fn(msg, type || 'busy');
    } catch (_) {}
  }

  function stable(v) {
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    if (typeof v === 'object') return '{' + Object.keys(v).sort().filter(function(k) {
      return !/^_smart/.test(k) && !/^(updatedAt|createdAt|savedAt|timestamp|cloudUpdatedAt|lastCloudUpdatedAt)$/.test(k);
    }).map(function(k) {
      return JSON.stringify(k) + ':' + stable(v[k]);
    }).join(',') + '}';
    return JSON.stringify(text(v));
  }

  function fnv(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ('00000000' + (h >>> 0).toString(16)).slice(-8);
  }

  function hash(str) {
    try {
      if (g.crypto && g.crypto.subtle && g.TextEncoder) {
        return g.crypto.subtle.digest('SHA-256', new g.TextEncoder().encode(str)).then(function(b) {
          return Array.prototype.map.call(new Uint8Array(b), function(x) {
            return x.toString(16).padStart(2, '0');
          }).join('').slice(0, 24);
        });
      }
    } catch (_) {}
    return Promise.resolve(fnv(str) + '_' + str.length.toString(36));
  }

  function normDate(v) {
    if (!v) return '';
    var s = text(v).trim(),
      m = s.match(/(20\d{2})[-\/.](\d{1,2})(?:[-\/.](\d{1,2}))?/);
    if (m) return m[1] + '-' + ('0' + (+m[2])).slice(-2) + (m[3] ? '-' + ('0' + (+m[3])).slice(-2) : '');
    m = s.match(/(\d{1,2})[-\/.](\d{1,2})[-\/.](20\d{2})/);
    return m ? m[3] + '-' + ('0' + (+m[1])).slice(-2) + '-' + ('0' + (+m[2])).slice(-2) : '';
  }
  var DATE_FIELDS = ['_syncPeriod', 'period', 'periodKey', 'key', 'date', 'recordDate', 'reportDate', 'effectiveDate', 'effDate', 'start', 'startDate', 'endDate', 'incidentDate', 'joinDate', 'payMonth', 'month', 'snapshotDate'];

  function recordDate(r) {
    for (var i = 0; i < DATE_FIELDS.length; i++) {
      var d = normDate(r && r[DATE_FIELDS[i]]);
      if (d) return d;
    }
    return '';
  }

  function semanticKey(r) {
    if (!r || typeof r !== 'object') return stable(r);
    for (var i = 0; i < ['_syncId', '_k', 'id', 'uuid', 'recordId', 'employeeId', 'empId'].length; i++) {
      var k = ['_syncId', '_k', 'id', 'uuid', 'recordId', 'employeeId', 'empId'][i];
      if (r[k] !== undefined && r[k] !== null && r[k] !== '') return k + ':' + text(r[k]);
    }
    var d = recordDate(r),
      parts = [];
    ['type', 'kind', 'dept', 'department', 'section', 'name', 'reason'].forEach(function(k) {
      if (r[k] !== undefined && r[k] !== null && r[k] !== '') parts.push(k + '=' + text(r[k]));
    });
    if (d) parts.unshift('date=' + d);
    return parts.length ? parts.join('|') : stable(r);
  }

  function bucketKey(r) {
    if (r && r._syncBucket) return String(r._syncBucket);
    var d = recordDate(r);
    if (d) return 'm:' + d.slice(0, 7);
    return 'h:' + ('0' + (parseInt(fnv(semanticKey(r)), 16) % 32).toString(16)).slice(-2);
  }

  function stamp(x) {
    for (var i = 0; i < ['updatedAt', 'savedAt', 'modifiedAt', 'createdAt', 'timestamp', 'date', 'effDate', 'effectiveDate'].length; i++) {
      var v = x && x[['updatedAt', 'savedAt', 'modifiedAt', 'createdAt', 'timestamp', 'date', 'effDate', 'effectiveDate'][i]];
      if (v) {
        var n = new Date(v).getTime();
        if (!isNaN(n)) return n;
      }
    }
    return 0;
  }

  function newer(a, b) {
    var aa = stamp(a),
      bb = stamp(b);
    if (aa !== bb) return aa > bb ? a : b;
    return stable(a).length >= stable(b).length ? a : b;
  }

  function mergeRows(a, b) {
    var map = {},
      order = [];
    (a || []).concat(b || []).forEach(function(r) {
      var k = semanticKey(r);
      if (!Object.prototype.hasOwnProperty.call(map, k)) order.push(k);
      map[k] = map[k] ? newer(map[k], r) : r;
    });
    return order.map(function(k) {
      return map[k];
    });
  }

  function sortRows(rows) {
    return (rows || []).slice().sort(function(a, b) {
      var ka = semanticKey(a),
        kb = semanticKey(b);
      return ka < kb ? -1 : ka > kb ? 1 : stable(a) < stable(b) ? -1 : 1;
    });
  }

  function buildBuckets(records) {
    var groups = {};
    (records || []).forEach(function(r) {
      var k = bucketKey(r);
      (groups[k] || (groups[k] = [])).push(r);
    });
    var out = {},
      jobs = Object.keys(groups).sort().map(function(k) {
        var rows = sortRows(groups[k]);
        return hash(stable(rows)).then(function(h) {
          out[k] = {
            key: k,
            records: rows,
            count: rows.length,
            hash: h
          };
        });
      });
    return Promise.all(jobs).then(function() {
      return out;
    });
  }

  function fp6(x) {
    return fnv(x).slice(0, 6);
  }

  function fpRows(rows) {
    return (rows || []).map(function(r) {
      var sk = semanticKey(r);
      return fp6(sk) + fp6(sk + '\u0001' + stable(r));
    }).join('');
  }

  function baseMap(str) {
    var m = {};
    str = String(str || '');
    for (var i = 0; i + 12 <= str.length; i += 12) m[str.slice(i, i + 6)] = str.slice(i + 6, i + 12);
    return m;
  }

  function rowFp(r) {
    var sk = semanticKey(r);
    return fp6(sk + '\u0001' + stable(r));
  }

  // three-way row merge; base = fingerprints of last synced copy of this bucket (may be empty for old state)
  function mergeThreeWay(localRows, remoteRows, baseStr, stats) {
    var base = baseMap(baseStr),
      hasBase = !!baseStr,
      L = {},
      R = {},
      order = [];
    localRows.forEach(function(r) {
      var k = semanticKey(r);
      if (!(k in L) && !(k in R)) order.push(k);
      L[k] = r;
    });
    remoteRows.forEach(function(r) {
      var k = semanticKey(r);
      if (!(k in L) && !(k in R)) order.push(k);
      R[k] = r;
    });
    var out = [];
    order.forEach(function(k) {
      var l = L[k],
        r = R[k],
        b = hasBase ? base[fp6(k)] : undefined;
      if (l && r) {
        if (stable(l) === stable(r)) return out.push(l);
        if (b && rowFp(l) === b) return out.push(r); // only cloud edited this row
        if (b && rowFp(r) === b) return out.push(l); // only this device edited this row
        var sl = stamp(l),
          sr = stamp(r);
        if (sl !== sr) return out.push(sl > sr ? l : r);
        if (stats) stats.conflicts++;
        return out.push(l);
      }
      if (l) {
        if (b && rowFp(l) === b) return; // deleted in cloud, unchanged here
        return out.push(l);
      }
      if (r) {
        if (b && rowFp(r) === b) return; // deleted on this device, unchanged in cloud
        return out.push(r);
      }
    });
    return out;
  }

  function jsonFetch(url, opts) {
    if (!nativeFetch) return Promise.reject(new Error('Browser fetch unavailable'));
    opts = opts || {};
    var controller = null,
      timer = null,
      limit = opts.timeoutMs || REQUEST_TIMEOUT_MS,
      next = Object.assign({}, opts);
    delete next.timeoutMs;
    if (typeof g.AbortController === 'function' && !opts.signal) {
      controller = new g.AbortController();
      next.signal = controller.signal;
      timer = g.setTimeout(function() {
        controller.abort();
      }, limit);
    }
    return nativeFetch(url, next).then(function(r) {
      return r.text().then(function(raw) {
        var j;
        try {
          j = JSON.parse(raw);
        } catch (_) {
          throw new Error('Cloud returned non-JSON: ' + raw.slice(0, 120));
        }
        if (!r.ok || (j && j.ok === false)) throw new Error((j && j.error) || ('HTTP ' + r.status));
        return j;
      });
    }).catch(function(e) {
      if (controller && controller.signal.aborted) throw new Error(L('雲端回應逾時（' + Math.round(limit / 1000) + ' 秒），請稍後重試', 'Cloud request timed out after ' + Math.round(limit / 1000) + ' seconds. Please retry.'));
      throw e;
    }).finally(function() {
      if (timer !== null) g.clearTimeout(timer);
    });
  }

  function dataOf(j) {
    return (j && j.data !== undefined) ? j.data : j;
  }

  function legacyPull(url, tool, opts, onStatus) {
    return jsonFetch(url + '?action=pull&tool=' + enc(tool)).then(function(j) {
      var env = dataOf(j) || {},
        rows = [];
      if (typeof opts.legacyToRecords === 'function') rows = opts.legacyToRecords(env) || [];
      else {
        var p = env.data || env;
        rows = p.records || p.recs || [];
      }
      return {
        records: Array.isArray(rows) ? rows : [],
        meta: env.data || env || {}
      };
    });
  }

  function merge(opts, a, b) {
    return typeof opts.mergeRecords === 'function' ? opts.mergeRecords(a, b) : mergeRows(a, b);
  }

  /* ── state in IndexedDB ── */
  function blankState() { return { v: 2, hashes: {}, counts: {}, rows: {}, metaHash: '', tombstones: {}, complete: false, progress: null, updatedAt: '' }; }
  function loadState(key) {
    return KV.get('sync:' + key, STATE_PREFIX + key).then(function(st) {
      var b = blankState();
      if (!st || typeof st !== 'object') return b;
      try { st = JSON.parse(JSON.stringify(st)); } catch (_) {}   // work on a copy; only saveState() changes the stored state
      Object.keys(b).forEach(function(k) { if (st[k] !== undefined && st[k] !== null) b[k] = st[k]; });
      // v1.x state migrated from localStorage: it had hashes from a full sync → treat as complete
      if (st.v !== 2 && st.hashes && Object.keys(st.hashes).length) b.complete = true;
      return b;
    }, function() { return blankState(); });
  }
  function saveState(key, st) {
    st.v = 2; st.updatedAt = now();
    var copy = st; try { copy = JSON.parse(JSON.stringify(st)); } catch (_) {}
    return KV.set('sync:' + key, copy).catch(function() { return false; });
  }
  function emitProgress(tool, phase, done, total, extra) {
    try { g.dispatchEvent(new CustomEvent('hrpay-sync-progress', { detail: Object.assign({ tool: tool, phase: phase, done: done, total: total }, extra || {}) })); } catch (_) {}
  }
  function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }
  function retryable(e) {
    var m = String(e && e.message || e || '');
    if (e && e.noRetry) return false;
    return /timed out|逾時|Failed to fetch|NetworkError|network|non-JSON|HTTP 5\d\d|HTTP 429|busy|Busy|too many times|Service|Exception: |Internal error|load failed|abort/i.test(m);
  }
  // one request, retried alone on timeouts / network / busy (5 s, 15 s, 45 s)
  function withRetry(fn, label, onStatus) {
    var attempt = 0;
    function go() {
      return fn().catch(function(e) {
        if (attempt >= RETRY_DELAYS.length || !retryable(e)) throw e;
        var d = RETRY_DELAYS[attempt++];
        status(onStatus, L('重試 ', 'Retry ') + attempt + '/3 · ' + label + ' · ' + Math.round(d / 1000) + 's', 'warn');
        return sleep(d).then(go);
      });
    }
    return go();
  }
  function manifest(url, tool) {
    return withRetry(function() {
      return jsonFetch(url + (url.indexOf('?') >= 0 ? '&' : '?') + 'action=smartManifest&tool=' + enc(tool), { timeoutMs: MANIFEST_TIMEOUT_MS });
    }, 'manifest').then(dataOf);
  }
  function post(url, body, timeoutMs) {
    return jsonFetch(url, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), timeoutMs: timeoutMs || REQUEST_TIMEOUT_MS }).then(dataOf);
  }
  function isUserChange(reason) { return !PASSIVE.test(String(reason || '')); }
  // "local change marker": written by HRPayAutoSync the moment the user adds / edits / deletes on this device.
  // A bucket that disappeared locally is treated as a deletion ONLY with this marker (or a user-change sync
  // reason) AND a complete sync state; otherwise it is restored from the cloud, never deleted.
  function loadDirty(key) { return KV.get('dirty:' + key, null).then(function(d) { return d && typeof d === 'object' ? d : null; }, function() { return null; }); }
  function clearDirty(key, startedAt) {
    return loadDirty(key).then(function(d) { if (d && (!d.at || d.at <= startedAt)) return KV.remove('dirty:' + key); });
  }
  function ctxReason(opts) { var c = (opts && opts.context) || g.__HRPAY_SYNC_CONTEXT || {}; return String(c.reason || ''); }

  /* ── PUSH ── */
  function push(opts) {
    opts = opts || {};
    var url = text(opts.url).trim(), tool = text(opts.tool).trim(), onStatus = opts.onStatus;
    if (!url || !tool) return Promise.reject(new Error('GAS URL/tool missing'));
    status(onStatus, L('智慧同步：比對雲端差異…', 'Smart sync: comparing with cloud…'), 'busy');
    return manifest(url, tool).then(function(remote) {
      remote = remote || {};
      var records = sortRows(opts.records || []);
      if (!remote.exists && remote.legacy) {
        status(onStatus, L('首次升級：合併既有雲端資料…', 'First upgrade: merging existing cloud data…'), 'busy');
        return legacyPull(url, tool, opts, onStatus).then(function(old) {
          return smartPush(opts, merge(opts, records, old.records || []), remote, true);
        });
      }
      return smartPush(opts, records, remote, false).then(function(r) {
        if (!r || !r.needsPull || opts.autoMerge === false) return r;
        return pull({ url: url, tool: tool, stateKey: opts.stateKey, localRecords: records, legacyToRecords: opts.legacyToRecords, mergeRecords: opts.mergeRecords, onStatus: onStatus, context: opts.context })
          .then(function(p) {
            if (!p || !p.ok || p.cancelled) return p;
            return manifest(url, tool).then(function(fresh) {
              return smartPush(Object.assign({}, opts, { records: p.records }), sortRows(p.records), fresh || {}, false).then(function(r2) {
                r2.records = p.records;
                return Promise.resolve(opts.apply ? opts.apply(p.records, p.meta || {}) : null).then(function() { return r2; });
              });
            });
          });
      });
    });
  }

  function smartPush(opts, records, remote, migrated) {
    var tool = opts.tool, url = text(opts.url).trim(), key = opts.stateKey || tool, onStatus = opts.onStatus;
    var ctx = opts.context || g.__HRPAY_SYNC_CONTEXT || {}, reason = String(ctx.reason || ''), startedAt = Date.now();
    var caps = remote.caps || [], batchApi = caps.indexOf('smartBuckets') >= 0;
    return Promise.all([buildBuckets(records), hash(stable(opts.meta || {})), loadState(key), loadDirty(key)]).then(function(parts) {
      var local = parts[0], metaHash = parts[1], st = parts[2], dirty = parts[3];
      var userChange = isUserChange(reason) || !!(dirty && isUserChange(dirty.reason));
      opts = Object.assign({}, opts, { _startedAt: startedAt });
      var lastH = migrated ? {} : (st.hashes || {}), remoteH = migrated ? {} : (remote.hashes || {}), remoteMetaHash = migrated ? '' : (remote.metaHash || '');
      var stateComplete = !migrated && st.complete === true && Object.keys(lastH).length > 0;
      var changed = [], deleted = [], remoteChanged = [], conflicts = [], newTomb = [], keys = {};
      Object.keys(local).concat(Object.keys(remoteH)).forEach(function(k) { keys[k] = 1; });
      Object.keys(keys).forEach(function(k) {
        var lh = local[k] && local[k].hash || '', rh = remoteH[k] || '', bh = lastH[k] || '';
        if (lh && rh && lh === rh) { st.hashes[k] = rh; st.counts[k] = local[k].count; if (!st.rows[k]) st.rows[k] = fpRows(local[k].records); delete st.tombstones[k]; return; }
        if (lh && !rh) { if (!bh || lh !== bh) changed.push(k); else remoteChanged.push(k); return; }   // new here | cloud removed it
        if (!lh && rh) {
          if (bh && rh === bh) {
            if (st.tombstones[k]) deleted.push(k);           // explicit local deletion record
            else if (stateComplete && userChange && records.length) newTomb.push(k);
            else remoteChanged.push(k);                       // no tombstone → restore from cloud, never delete
          } else remoteChanged.push(k);
          return;
        }
        if (!bh) { conflicts.push(k); return; }
        var lc = lh !== bh, rc = rh !== bh;
        if (lc && !rc) changed.push(k); else if (!lc && rc) remoteChanged.push(k); else conflicts.push(k);
      });
      // guard: a user change that removes many buckets at once looks like an incomplete local copy
      if (newTomb.length) {
        var baseN = Object.keys(lastH).length;
        if (!/delete/i.test(reason + ' ' + (dirty && dirty.reason || '')) && newTomb.length > Math.max(4, Math.ceil(baseN * 0.4))) {
          console.warn('[HRPaySmartSync] ' + newTomb.length + ' buckets missing locally — treated as incomplete local data, not deleted');
          newTomb.forEach(function(k) { remoteChanged.push(k); });
        } else {
          newTomb.forEach(function(k) { st.tombstones[k] = { at: now(), reason: reason || 'change' }; deleted.push(k); });
        }
      }
      if (!migrated && (remoteChanged.length || conflicts.length)) {
        status(onStatus, L('雲端有新變更，先自動下載合併', 'Cloud has new changes; downloading first'), 'warn');
        return saveState(key, st).then(function() { return { ok: false, needsPull: true, remoteChanged: remoteChanged, conflicts: conflicts, recordCount: records.length }; });
      }
      var metaChanged = metaHash !== remoteMetaHash || migrated;
      if (!changed.length && !deleted.length && !metaChanged) {
        st.complete = true; st.metaHash = remoteMetaHash; st.progress = null;
        return saveState(key, st).then(function() { return clearDirty(key, startedAt); }).then(function() {
          status(onStatus, L('雲端已是最新，不需重傳', 'Cloud is up to date; nothing to upload'), 'ok');
          return { ok: true, skipped: true, unchanged: records.length };
        });
      }
      return saveState(key, st).then(function() {
        return batchApi ? pushBatched(opts, st, local, remoteH, changed, deleted, metaHash, records, migrated)
                        : pushLegacy(opts, st, local, remote, remoteH, changed, deleted, metaHash, records, migrated);
      });
    });
  }

  // GAS v3.9.23+: buckets are committed one by one on the server; state is saved after every batch reply
  function pushBatched(opts, st, local, remoteH, changed, deleted, metaHash, records, migrated) {
    var tool = opts.tool, url = text(opts.url).trim(), key = opts.stateKey || tool, onStatus = opts.onStatus;
    var batches = [], cur = [], size = 0;
    changed.forEach(function(k) {
      var sz = stable(local[k].records).length;
      if (cur.length && (cur.length >= BATCH_MAX_BUCKETS || size + sz > BATCH_MAX_BYTES)) { batches.push(cur); cur = []; size = 0; }
      cur.push(k); size += sz;
    });
    if (cur.length) batches.push(cur);
    var sent = 0, savedN = 0, failed = [], conflicts = [], total = changed.length;
    st.progress = { phase: 'upload', done: 0, total: total, startedAt: now() };
    emitProgress(tool, 'upload', 0, total);
    var chain = Promise.resolve();
    batches.forEach(function(batch) {
      chain = chain.then(function() {
        var body = { action: 'smartBuckets', tool: tool, buckets: batch.map(function(k) { return { bucket: k, hash: local[k].hash, count: local[k].count, baseHash: migrated ? '' : (remoteH[k] || ''), records: local[k].records }; }) };
        return withRetry(function() { return post(url, body, REQUEST_TIMEOUT_MS); }, batch.join(','), onStatus).then(function(d) {
          d = d || {};
          (d.saved || []).forEach(function(x) {
            var k = x.bucket; if (!local[k]) return;
            st.hashes[k] = local[k].hash; st.counts[k] = local[k].count; st.rows[k] = fpRows(local[k].records); delete st.tombstones[k];
            sent += local[k].count; savedN++;
          });
          (d.conflicts || []).forEach(function(x) { conflicts.push(x.bucket || x); });
          st.progress = { phase: 'upload', done: savedN, total: total, startedAt: st.progress.startedAt };
          emitProgress(tool, 'upload', savedN, total);
          status(onStatus, L('上傳 ', 'Uploaded ') + savedN + '/' + total, 'busy');
          return saveState(key, st);   // ← resume point: a rerun only sends what is left
        }, function(e) {
          batch.forEach(function(k) { failed.push(k); });
          console.warn('[HRPaySmartSync] batch failed after retries', batch, e);
          status(onStatus, L('區塊上傳失敗（稍後自動重試）：', 'Bucket upload failed (will retry later): ') + batch.join(', '), 'warn');
        });
      });
    });
    return chain.then(function() {
      if (total && failed.length >= total && !deleted.length) {   // nothing got through (offline / GAS down): keep state, try again later
        st.complete = false; st.progress = { phase: 'incomplete', failed: failed, at: now() };
        emitProgress(tool, 'incomplete', 0, total, { failed: failed.length });
        return saveState(key, st).then(function() { return { ok: false, failedBuckets: failed, uploaded: 0, recordCount: records.length }; });
      }
      var counts = {}, rc;
      Object.keys(st.hashes).forEach(function(k) { counts[k] = st.counts[k] || 0; });
      rc = Object.keys(counts).reduce(function(n, k) { return n + (Number(counts[k]) || 0); }, 0);
      var finalBody = { action: 'smartBuckets', tool: tool, final: true,
        deletes: deleted.map(function(k) { return { bucket: k, baseHash: st.hashes[k] || '' }; }),
        meta: Object.assign({}, opts.meta || {}, { _smartMetaHash: metaHash }), summary: opts.summary || {},
        changedKeys: changed.filter(function(k) { return failed.indexOf(k) < 0; }).concat(deleted),
        context: opts.context || g.__HRPAY_SYNC_CONTEXT || {} };
      return withRetry(function() { return post(url, finalBody, REQUEST_TIMEOUT_MS); }, 'commit', onStatus).then(function(d) {
        d = d || {};
        (d.deleted || []).forEach(function(k) { delete st.hashes[k]; delete st.counts[k]; delete st.rows[k]; delete st.tombstones[k]; });
        (d.conflicts || []).forEach(function(x) { conflicts.push(x.bucket || x); });
        var ok = !failed.length && !conflicts.length;
        st.metaHash = metaHash; st.complete = ok; st.progress = ok ? null : { phase: 'incomplete', failed: failed, conflicts: conflicts, at: now() };
        emitProgress(tool, ok ? 'done' : 'incomplete', savedN, total, { failed: failed.length });
        return saveState(key, st).then(function() { return ok ? clearDirty(key, opts._startedAt || 0) : null; }).then(function() {
          status(onStatus, ok ? L('完成｜上傳 ' + sent + (d.deleted && d.deleted.length ? '｜刪除 ' + d.deleted.length + ' 區塊' : '') + '｜保留其他雲端歷史', 'Done · uploaded ' + sent + (d.deleted && d.deleted.length ? ' · deleted ' + d.deleted.length + ' bucket(s)' : '') + ' · other cloud history kept')
            : L('部分完成：' + failed.length + ' 區塊待重試' + (conflicts.length ? '｜' + conflicts.length + ' 區塊雲端較新' : ''), 'Partly done: ' + failed.length + ' bucket(s) to retry' + (conflicts.length ? ' · ' + conflicts.length + ' newer in cloud' : '')), ok ? 'ok' : 'warn');
          return { ok: ok, recordCount: rc, uploaded: sent, changedBuckets: savedN, deletedBuckets: (d.deleted || []).length, failedBuckets: failed, conflicts: conflicts, needsPull: !!conflicts.length, migrated: !!migrated, timestamp: d.timestamp || now() };
        });
      });
    });
  }

  // older GAS (≤ v3.9.22): stage every bucket, then one commit; each bucket request still retried alone
  function pushLegacy(opts, st, local, remote, remoteH, changed, deleted, metaHash, records, migrated) {
    var tool = opts.tool, url = text(opts.url).trim(), key = opts.stateKey || tool, onStatus = opts.onStatus;
    var uploadId = 'pay_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8), sent = 0, done = 0, failed = [];
    emitProgress(tool, 'upload', 0, changed.length);
    return pool(changed, PARALLEL, function(k) {
      var b = local[k];
      return withRetry(function() { return post(url, { action: 'smartBucket', tool: tool, uploadId: uploadId, bucket: k, hash: b.hash, count: b.count, records: b.records }); }, k, onStatus)
        .then(function() { sent += b.count; done++; emitProgress(tool, 'upload', done, changed.length); status(onStatus, L('上傳 ', 'Uploaded ') + done + '/' + changed.length, 'busy'); },
              function(e) { failed.push(k); console.warn('[HRPaySmartSync] bucket failed', k, e); });
    }).then(function() {
      if (failed.length) {
        status(onStatus, L('區塊上傳失敗（稍後自動重試）：', 'Bucket upload failed (will retry later): ') + failed.join(', '), 'warn');
        return { ok: false, failedBuckets: failed, uploaded: sent };
      }
      var hashes = {}, counts = {};
      Object.keys(local).forEach(function(k) { hashes[k] = local[k].hash; counts[k] = local[k].count; });
      Object.keys(remoteH).forEach(function(k) { if (!hashes[k] && deleted.indexOf(k) < 0) { hashes[k] = remoteH[k]; counts[k] = Number((remote.counts || {})[k]) || 0; } });
      var rc = Object.keys(counts).reduce(function(n, k) { return n + (Number(counts[k]) || 0); }, 0);
      return withRetry(function() {
        return post(url, { action: 'smartCommit', tool: tool, uploadId: uploadId, baseHashes: remoteH, baseMetaHash: remote.metaHash || '', hashes: hashes, counts: counts, recordCount: rc,
          meta: Object.assign({}, opts.meta || {}, { _smartMetaHash: metaHash }), summary: opts.summary || {}, context: opts.context || g.__HRPAY_SYNC_CONTEXT || {} });
      }, 'commit', onStatus).then(function(d) {
        var rows = {};
        Object.keys(hashes).forEach(function(k) { rows[k] = local[k] ? fpRows(local[k].records) : (st.rows[k] || ''); });
        st.hashes = hashes; st.counts = counts; st.rows = rows; st.metaHash = metaHash; st.complete = true; st.progress = null;
        deleted.forEach(function(k) { delete st.tombstones[k]; });
        emitProgress(tool, 'done', changed.length, changed.length);
        return saveState(key, st).then(function() { return clearDirty(key, opts._startedAt || 0); }).then(function() {
          status(onStatus, L('完成｜上傳 ' + sent + (deleted.length ? '｜刪除 ' + deleted.length + ' 區塊' : ''), 'Done · uploaded ' + sent + (deleted.length ? ' · deleted ' + deleted.length + ' bucket(s)' : '')), 'ok');
          return { ok: true, recordCount: rc, uploaded: sent, changedBuckets: changed.length, deletedBuckets: deleted.length, migrated: !!migrated, timestamp: (d && (d.timestamp || d.updatedAt)) || now() };
        });
      });
    });
  }

  /* ── PULL ── */
  function pull(opts) {
    opts = opts || {};
    var url = text(opts.url).trim(), tool = text(opts.tool).trim(), key = opts.stateKey || tool, localRows = sortRows(opts.localRecords || []), onStatus = opts.onStatus;
    if (!url || !tool) return Promise.reject(new Error('GAS URL/tool missing'));
    status(onStatus, L('智慧下載：比對雲端差異…', 'Smart download: comparing with cloud…'), 'busy');
    return manifest(url, tool).then(function(remote) {
      remote = remote || {};
      if (!remote.exists && remote.legacy) {
        return legacyPull(url, tool, opts, onStatus).then(function(old) {
          var merged = merge(opts, localRows, old.records || []);
          return Promise.resolve(opts.apply ? opts.apply(merged, old.meta || {}) : null).then(function() {
            return smartPush(Object.assign({}, opts, { records: merged }), merged, remote, true).then(function(m) {
              return { ok: true, records: merged, downloaded: (old.records || []).length, migrated: true, pushResult: m };
            });
          });
        });
      }
      if (!remote.exists) { status(onStatus, L('雲端尚無資料', 'No cloud data yet'), 'warn'); return { ok: false, noCloud: true, records: localRows }; }
      return Promise.all([buildBuckets(localRows), opts.readOnly ? Promise.resolve(blankState()) : loadState(key), opts.readOnly ? Promise.resolve(null) : loadDirty(key)]).then(function(parts) {
        var local = parts[0], st = parts[1], dirty = parts[2], reasonNow = ctxReason(opts);
        // an empty device (new browser / cleared cache) downloads everything and never keeps "deletions"
        if (!localRows.length) { st.hashes = {}; st.rows = {}; st.tombstones = {}; st.complete = false; }
        var lastH = Object.assign({}, st.hashes || {}), lastRows = Object.assign({}, st.rows || {}), tomb = st.tombstones || {}, remoteH = remote.hashes || {};   // base copies (state is updated while downloading)
        var stateComplete = !opts.readOnly && st.complete === true && Object.keys(lastH).length > 0 && localRows.length > 0;
        var userChange = isUserChange(reasonNow) || !!(dirty && isUserChange(dirty.reason)), newTomb = [];
        var out = {}, downloaded = 0, unchanged = 0, pending = 0, pendingDelete = 0, failed = [], stats = { conflicts: 0 }, keys = {}, toFetch = [];
        Object.keys(remoteH).concat(Object.keys(local)).forEach(function(k) { keys[k] = 1; });
        Object.keys(keys).sort().forEach(function(k) {
          var lb = local[k], rh = remoteH[k] || '', bh = lastH[k] || '';
          if (lb && rh && lb.hash === rh) { out[k] = lb.records; unchanged += lb.count; st.hashes[k] = rh; st.rows[k] = fpRows(lb.records); delete tomb[k]; return; }
          if (!rh) {                                    // not in cloud
            if (lb && bh && lb.hash === bh) { delete st.hashes[k]; delete st.rows[k]; return; }   // deleted in cloud, unchanged here
            if (lb) { out[k] = lb.records; pending += lb.count; }
            return;
          }
          if (!lb && tomb[k] && bh && rh === bh) { pendingDelete++; return; }   // deleted here with a tombstone
          if (!lb && bh && rh === bh && stateComplete && userChange) { newTomb.push(k); return; }   // deleted here just now (decided below)
          if (lb && bh && rh === bh) { out[k] = lb.records; pending += lb.count; return; }   // only this device changed
          toFetch.push(k);                               // cloud newer / missing here without tombstone → download
        });
        if (newTomb.length) {
          var baseN = Object.keys(lastH).length, why = reasonNow + ' ' + (dirty && dirty.reason || '');
          if (!/delete/i.test(why) && newTomb.length > Math.max(4, Math.ceil(baseN * 0.4))) {
            console.warn('[HRPaySmartSync] ' + newTomb.length + ' buckets missing locally — restored from cloud, not deleted');
            newTomb.forEach(function(k) { toFetch.push(k); });
          } else {
            newTomb.forEach(function(k) { tomb[k] = { at: now(), reason: (dirty && dirty.reason) || reasonNow || 'change' }; pendingDelete++; });
          }
        }
        var done = 0;
        emitProgress(tool, 'download', 0, toFetch.length);
        return pool(toFetch, PARALLEL, function(k) {
          var lb = local[k], rh = remoteH[k] || '', bh = lastH[k] || '';
          return withRetry(function() { return jsonFetch(url + '?action=smartBucket&tool=' + enc(tool) + '&bucket=' + enc(k), { timeoutMs: REQUEST_TIMEOUT_MS }); }, k, onStatus).then(function(j) {
            var bd = dataOf(j) || {}, rows = bd.records || [];
            if (bd.hash && bd.hash !== rh) throw Object.assign(new Error(L('下載期間雲端有變動，請重試', 'Cloud changed during download; retry.')), { noRetry: true });
            downloaded += rows.length; done++;
            emitProgress(tool, 'download', done, toFetch.length);
            status(onStatus, L('下載 ', 'Downloaded ') + done + '/' + toFetch.length + ' · ' + k, 'busy');
            st.hashes[k] = rh; st.rows[k] = fpRows(rows); delete tomb[k];
            if (!lb || (bh && lb.hash === bh)) { out[k] = rows; return; }
            out[k] = opts.mergeRecords ? merge(opts, lb.records, rows) : mergeThreeWay(lb.records, rows, lastRows[k], stats);
          }).catch(function(e) {
            failed.push(k);                              // keep local copy, keep old state → retried next time
            if (lb) out[k] = lb.records;
            console.warn('[HRPaySmartSync] download failed', k, e);
          });
        }).then(function() {
          var merged = sortRows(Object.keys(out).reduce(function(a, k) { return a.concat(out[k] || []); }, []));
          var contentChanged = stable(merged) !== stable(localRows);
          return Promise.resolve(contentChanged && opts.apply ? opts.apply(merged, remote.meta || {}) : null).then(function() {
            st.tombstones = tomb; st.metaHash = remote.metaHash || '';
            st.complete = !failed.length;
            emitProgress(tool, failed.length ? 'incomplete' : 'done', done, toFetch.length, { failed: failed.length });
            return (opts.readOnly ? Promise.resolve() : saveState(key, st)).then(function() {
              var conflicts = stats.conflicts;
              status(onStatus, L('完成｜下載 ' + downloaded + '｜未變 ' + unchanged + (pending ? '｜本機待上傳 ' + pending : '') + (pendingDelete ? '｜本機待刪除 ' + pendingDelete + ' 區塊' : '') + (failed.length ? '｜' + failed.length + ' 區塊待重試' : '') + (conflicts ? '｜衝突 ' + conflicts + '（保留本機版本）' : ''),
                'Done · downloaded ' + downloaded + ' · unchanged ' + unchanged + (pending ? ' · pending upload ' + pending : '') + (pendingDelete ? ' · pending delete ' + pendingDelete + ' bucket(s)' : '') + (failed.length ? ' · ' + failed.length + ' bucket(s) to retry' : '') + (conflicts ? ' · ' + conflicts + ' conflict(s), kept this device' : '')), (conflicts || failed.length) ? 'warn' : 'ok');
              return { ok: true, partial: !!failed.length, failedBuckets: failed, records: merged, downloaded: downloaded, unchanged: unchanged, pendingUpload: pending, pendingDelete: pendingDelete, conflicts: conflicts, meta: remote.meta || {} };
            });
          });
        });
      });
    });
  }

  var queues = {};
  function queued(fn, opts) {
    var key = (opts && opts.stateKey) || (opts && opts.tool) || 'default';
    var job = (queues[key] || Promise.resolve()).catch(function() {}).then(function() { return fn(opts); });
    queues[key] = job;
    return job;
  }
  g.HRPaySmartSync = {
    version: VERSION,
    push: function(o) { return queued(push, o); },
    pull: function(o) { return queued(pull, o); },
    // "clear local cache": forget sync memory so the next open downloads everything (and deletes nothing)
    resetState: function(tool) { try { localStorage.removeItem(STATE_PREFIX + tool); } catch (_) {} KV.remove('dirty:' + tool); return KV.remove('sync:' + tool); },
    // called by HRPayAutoSync when the user changes data on this device (add / edit / delete / import)
    markChange: function(tool, reason) { if (!tool || !isUserChange(reason)) return Promise.resolve(false); return KV.set('dirty:' + tool, { reason: String(reason || 'change'), at: Date.now() }); },
    // explicit tombstones for whole buckets (optional helper for pages)
    tombstone: function(tool, records) { return loadState(tool).then(function(st) { (records || []).forEach(function(r) { st.tombstones[bucketKey(r)] = { at: now(), reason: 'delete' }; }); return saveState(tool, st); }); },
    state: function(tool) { return loadState(tool); },
    buildBuckets: buildBuckets, mergeRows: mergeRows, semanticKey: semanticKey, bucketKey: bucketKey, stable: stable
  };
})(window);
