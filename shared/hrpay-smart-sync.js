/* AC-HRA-PAY Smart Incremental Sync v1.0
 * Mirrors the AC HRA Portal v26 manifest/bucket sync model.
 * - compare a small cloud manifest first
 * - upload/download changed month/hash buckets only
 * - retain cloud-only history during push
 * - one-time safe migration from legacy full snapshots
 * - local pending changes are preserved and merged
 */
/* v1.5 (2026-09-29 audit fix)
 * - three-way pull: a bucket changed only on this device is kept (no cloud merge-back),
 *   a bucket deleted only on this device is not re-downloaded (no "resurrection")
 * - buckets upload/download 3 at a time (faster), commit timeout 90 s
 * - readOnly pulls (NSSF / Seniority reading payroll/employee) never touch the owner page's sync state
 * - status text follows the page language (zh / en)
 * - resetState(tool) for "clear local cache"
 */
(function(g) {
  'use strict';
  if (g.HRPaySmartSync) return;
  var VERSION = '1.5',
    STATE_PREFIX = 'ac_hrpay_smart_sync_v1_',
    REQUEST_TIMEOUT_MS = 30000,
    COMMIT_TIMEOUT_MS = 90000,
    PARALLEL = 3,
    nativeFetch = g.fetch ? g.fetch.bind(g) : null;

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

  function readState(tool) {
    try {
      return JSON.parse(localStorage.getItem(STATE_PREFIX + tool) || 'null');
    } catch (_) {
      return null;
    }
  }

  // row fingerprints of the last synced cloud copy (6-char key hash + 6-char content hash per row, ~12 bytes/row)
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

  function writeState(tool, v) {
    try {
      localStorage.setItem(STATE_PREFIX + tool, JSON.stringify(v));
    } catch (_) {
      // storage nearly full: keep the essential bucket hashes, drop row fingerprints
      try {
        var slim = Object.assign({}, v);
        delete slim.rows;
        localStorage.setItem(STATE_PREFIX + tool, JSON.stringify(slim));
      } catch (__) {}
    }
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

  function manifest(url, tool) {
    return jsonFetch(url + (url.indexOf('?') >= 0 ? '&' : '?') + 'action=smartManifest&tool=' + enc(tool)).then(dataOf);
  }

  function post(url, body, timeoutMs) {
    return jsonFetch(url, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(body),
      timeoutMs: timeoutMs
    }).then(dataOf);
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

  function push(opts) {
    opts = opts || {};
    var url = text(opts.url).trim(),
      tool = text(opts.tool).trim(),
      records = sortRows(opts.records || []),
      onStatus = opts.onStatus;
    if (!url || !tool) return Promise.reject(new Error('GAS URL/tool missing'));
    status(onStatus, L('智慧同步：比對雲端差異…', 'Smart sync: comparing with cloud…'), 'busy');
    return manifest(url, tool).then(function(remote) {
      remote = remote || {};
      if (!remote.exists && remote.legacy) {
        status(onStatus, L('首次升級：合併既有雲端資料…', 'First upgrade: merging existing cloud data…'), 'busy');
        return legacyPull(url, tool, opts, onStatus).then(function(old) {
          return smartPush(opts, merge(opts, records, old.records || []), remote, onStatus, true);
        });
      }
      return smartPush(opts, records, remote, onStatus, false).then(function(r) {
        if (!r || !r.needsPull || opts.autoMerge === false) return r;
        var ctx = opts.context || g.__HRPAY_SYNC_CONTEXT || {},
          reason = String(ctx.reason || '');
        // v1.5: the three-way pull keeps this device's deletions, so a delete may safely auto-merge newer cloud data first.
        return pull({
          url: url,
          tool: tool,
          stateKey: opts.stateKey,
          localRecords: records,
          legacyToRecords: opts.legacyToRecords,
          mergeRecords: opts.mergeRecords,
          onStatus: onStatus
        }).then(function(p) {
          if (!p || !p.ok || p.cancelled) return p;
          return manifest(url, tool).then(function(fresh) {
            var n = Object.assign({}, opts, {
              records: p.records
            });
            return smartPush(n, p.records, fresh || {}, onStatus, false).then(function(r) {
              r.records = p.records;
              return Promise.resolve(opts.apply ? opts.apply(p.records, p.meta || {}) : null).then(function() {
                return r;
              });
            });
          });
        });
      });
    });
  }

  function smartPush(opts, records, remote, onStatus, migrated) {
    var tool = opts.tool,
      url = text(opts.url).trim();
    return Promise.all([buildBuckets(records), hash(stable(opts.meta || {}))]).then(function(parts) {
      var local = parts[0],
        metaHash = parts[1],
        last = readState(opts.stateKey || tool) || {},
        lastH = last.hashes || {},
        remoteH = remote.hashes || {},
        remoteMetaHash = remote.metaHash || '',
        changed = [],
        deleted = [],
        remoteChanged = [],
        conflicts = [],
        ctx = opts.context || g.__HRPAY_SYNC_CONTEXT || {},
        allowDelete = /delete/i.test(String((opts.context || g.__HRPAY_SYNC_CONTEXT || {}).reason || ''));
      if (migrated) {
        lastH = {};
        remoteH = {};
        remoteMetaHash = '';
      }
      var keys = {};
      Object.keys(local).concat(Object.keys(remoteH)).forEach(function(k) {
        keys[k] = 1;
      });
      Object.keys(keys).forEach(function(k) {
        var lh = local[k] && local[k].hash || '',
          rh = remoteH[k] || '',
          bh = lastH[k] || '';
        if (lh && rh && lh === rh) return;
        if (!bh) {
          if (lh && !rh) changed.push(k);
          else if (!lh && rh) remoteChanged.push(k);
          else if (lh && rh && lh !== rh) conflicts.push(k);
          return;
        }
        var lc = lh !== bh,
          rc = rh !== bh;
        if (lc && !rc) {
          if (lh) changed.push(k);
          else if (rh) {
            // bucket removed on this device and untouched in cloud since last sync -> propagate the removal.
            // Safety: if this device has NO data at all (wiped/cleared cache) only an explicit delete may remove cloud data.
            if (allowDelete || records.length) deleted.push(k);
            else remoteChanged.push(k);
          }
        } else if (!lc && rc) remoteChanged.push(k);
        else if (lc && rc && lh !== rh) conflicts.push(k);
      });
      if (!migrated && (remoteChanged.length || conflicts.length)) {
        status(onStatus, L('雲端有新變更，先自動下載合併', 'Cloud has new changes; downloading first'), 'warn');
        return {
          ok: false,
          needsPull: true,
          remoteChanged: remoteChanged,
          conflicts: conflicts,
          recordCount: records.length
        };
      }
      var uploadId = 'pay_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
        sent = 0,
        chain = Promise.resolve();
      var upDone = 0;
      chain = pool(changed, PARALLEL, function(k) {
        var b = local[k];
        return post(url, {
          action: 'smartBucket',
          tool: tool,
          uploadId: uploadId,
          bucket: k,
          hash: b.hash,
          count: b.count,
          records: b.records
        }).then(function() {
          sent += b.count;
          upDone++;
          status(onStatus, L('上傳變更 ', 'Uploading ') + upDone + '/' + changed.length + ' · ' + k, 'busy');
        });
      });
      return chain.then(function() {
        var hashes = {},
          counts = {};
        Object.keys(local).forEach(function(k) {
          hashes[k] = local[k].hash;
          counts[k] = local[k].count;
        });
        Object.keys(remoteH).forEach(function(k) {
          if (!hashes[k] && deleted.indexOf(k) < 0) {
            hashes[k] = remoteH[k];
            counts[k] = Number((remote.counts || {})[k]) || 0;
          }
        });
        var rc = Object.keys(counts).reduce(function(n, k) {
            return n + (Number(counts[k]) || 0);
          }, 0),
          meta = Object.assign({}, opts.meta || {}, {
            _smartMetaHash: metaHash
          });
        var metaChanged = metaHash !== remoteMetaHash || migrated || changed.length || deleted.length;
        var lastRows = last.rows || {},
          rowsState = {};
        if (!metaChanged && !changed.length && !deleted.length) {
          Object.keys(remoteH).forEach(function(k) {
            if (local[k] && local[k].hash === remoteH[k]) rowsState[k] = fpRows(local[k].records);
            else if (lastRows[k]) rowsState[k] = lastRows[k];
          });
          writeState(opts.stateKey || tool, {
            hashes: remoteH,
            counts: remote.counts || {},
            metaHash: remoteMetaHash,
            rows: rowsState,
            updatedAt: now()
          });
          status(onStatus, L('雲端已是最新，不需重傳', 'Cloud is up to date; nothing to upload'), 'ok');
          return {
            ok: true,
            skipped: true,
            unchanged: records.length
          };
        }
        return post(url, {
          action: 'smartCommit',
          tool: tool,
          uploadId: uploadId,
          baseHashes: remoteH,
          baseMetaHash: remoteMetaHash,
          hashes: hashes,
          counts: counts,
          recordCount: rc,
          meta: meta,
          summary: opts.summary || {},
          context: opts.context || g.__HRPAY_SYNC_CONTEXT || {}
        }, COMMIT_TIMEOUT_MS).then(function(d) {
          var out = {
            ok: true,
            recordCount: rc,
            uploaded: sent,
            unchanged: Math.max(0, records.length - sent),
            changedBuckets: changed.length,
            deletedBuckets: deleted.length,
            migrated: !!migrated,
            timestamp: (d && (d.timestamp || d.updatedAt)) || now()
          };
          Object.keys(hashes).forEach(function(k) {
            if (local[k]) rowsState[k] = fpRows(local[k].records);
            else if (lastRows[k]) rowsState[k] = lastRows[k];
          });
          writeState(opts.stateKey || tool, {
            hashes: hashes,
            counts: counts,
            metaHash: metaHash,
            rows: rowsState,
            updatedAt: out.timestamp
          });
          status(onStatus, L('完成｜上傳 ' + sent + (deleted.length ? '｜刪除 ' + deleted.length + ' 區塊' : '') + '｜保留其他雲端歷史', 'Done · uploaded ' + sent + (deleted.length ? ' · deleted ' + deleted.length + ' bucket(s)' : '') + ' · other cloud history kept'), 'ok');
          return out;
        });
      });
    });
  }

  function pull(opts) {
    opts = opts || {};
    var url = text(opts.url).trim(),
      tool = text(opts.tool).trim(),
      localRows = sortRows(opts.localRecords || []),
      onStatus = opts.onStatus;
    if (!url || !tool) return Promise.reject(new Error('GAS URL/tool missing'));
    status(onStatus, L('智慧下載：比對雲端差異…', 'Smart download: comparing with cloud…'), 'busy');
    return manifest(url, tool).then(function(remote) {
      remote = remote || {};
      if (!remote.exists && remote.legacy) {
        return legacyPull(url, tool, opts, onStatus).then(function(old) {
          var merged = merge(opts, localRows, old.records || []);
          return Promise.resolve(opts.apply ? opts.apply(merged, old.meta || {}) : null).then(function() {
            var o = Object.assign({}, opts, {
              records: merged
            });
            return smartPush(o, merged, remote, onStatus, true).then(function(m) {
              return {
                ok: true,
                records: merged,
                downloaded: (old.records || []).length,
                migrated: true,
                pushResult: m
              };
            });
          });
        });
      }
      if (!remote.exists) {
        status(onStatus, L('雲端尚無資料', 'No cloud data yet'), 'warn');
        return {
          ok: false,
          noCloud: true,
          records: localRows
        };
      }
      return buildBuckets(localRows).then(function(local) {
        // readOnly = another page only wants to READ this tool's data: ignore and never write sync memory
        // an empty device (new browser / cleared cache) always downloads everything
        var last = (opts.readOnly || !localRows.length) ? {} : (readState(opts.stateKey || tool) || {}),
          lastH = last.hashes || {},
          lastRows = last.rows || {},
          rowsState = {},
          stats = {
            conflicts: 0
          },
          remoteH = remote.hashes || {},
          out = {},
          downloaded = 0,
          unchanged = 0,
          pending = 0,
          pendingDelete = 0,
          keys = {};
        Object.keys(remoteH).concat(Object.keys(local)).forEach(function(k) {
          keys[k] = 1;
        });
        var list = Object.keys(keys).sort(),
          toFetch = [];
        list.forEach(function(k) {
          var lb = local[k],
            rh = remoteH[k] || '',
            bh = lastH[k] || '';
          if (lb && rh && lb.hash === rh) {
            out[k] = lb.records;
            unchanged += lb.count;
            rowsState[k] = fpRows(lb.records);
            return;
          }
          if (!rh) {
            // cloud has no bucket: deleted in cloud (local unchanged since last sync) or new local data
            if (lb && bh && lb.hash === bh) return;
            if (lb) {
              out[k] = lb.records;
              pending += lb.count;
            }
            return;
          }
          if (bh && rh === bh) {
            // cloud unchanged since last sync -> only this device changed: keep local, never merge cloud back
            if (lastRows[k]) rowsState[k] = lastRows[k];
            if (lb) {
              out[k] = lb.records;
              pending += lb.count;
            } else pendingDelete++;
            return;
          }
          toFetch.push(k);
        });
        var fetched = 0;
        var chain = pool(toFetch, PARALLEL, function(k) {
          var lb = local[k],
            rh = remoteH[k] || '',
            bh = lastH[k] || '';
          return jsonFetch(url + '?action=smartBucket&tool=' + enc(tool) + '&bucket=' + enc(k)).then(function(j) {
            var bd = dataOf(j) || {},
              rows = bd.records || [];
            if (bd.hash && bd.hash !== rh) throw new Error(L('下載期間雲端有變動，請重試', 'Cloud changed during download; retry.'));
            downloaded += rows.length;
            fetched++;
            status(onStatus, L('下載變更 ', 'Downloading ') + fetched + '/' + toFetch.length + ' · ' + k, 'busy');
            rowsState[k] = fpRows(rows);
            if (!lb || (bh && lb.hash === bh)) {
              out[k] = rows; // only the cloud changed
              return;
            }
            // both sides changed: row-level three-way merge against the last synced copy
            out[k] = opts.mergeRecords ? merge(opts, lb.records, rows) : mergeThreeWay(lb.records, rows, lastRows[k], stats);
          });
        });
        return chain.then(function() {
          var merged = sortRows(Object.keys(out).reduce(function(a, k) {
            return a.concat(out[k] || []);
          }, []));
          var contentChanged = stable(merged) !== stable(localRows);
          return Promise.resolve(contentChanged && opts.apply ? opts.apply(merged, remote.meta || {}) : null).then(function() {
            if (!opts.readOnly) writeState(opts.stateKey || tool, {
              hashes: remoteH,
              counts: remote.counts || {},
              metaHash: remote.metaHash || '',
              rows: rowsState,
              updatedAt: now()
            });
            var conflicts = stats.conflicts;
            status(onStatus, L('完成｜下載 ' + downloaded + '｜未變 ' + unchanged + (pending ? '｜本機待上傳 ' + pending : '') + (pendingDelete ? '｜本機待刪除 ' + pendingDelete + ' 區塊' : '') + (conflicts ? '｜衝突 ' + conflicts + '（保留本機版本）' : ''),
              'Done · downloaded ' + downloaded + ' · unchanged ' + unchanged + (pending ? ' · pending upload ' + pending : '') + (pendingDelete ? ' · pending delete ' + pendingDelete + ' bucket(s)' : '') + (conflicts ? ' · ' + conflicts + ' conflict(s), kept this device' : '')), conflicts ? 'warn' : 'ok');
            return {
              ok: true,
              records: merged,
              downloaded: downloaded,
              unchanged: unchanged,
              pendingUpload: pending,
              pendingDelete: pendingDelete,
              conflicts: conflicts,
              meta: remote.meta || {}
            };
          });
        });
      });
    });
  }
  var queues = {};

  function queued(fn, opts) {
    var key = (opts && opts.stateKey) || (opts && opts.tool) || 'default';
    var job = (queues[key] || Promise.resolve()).catch(function() {}).then(function() {
      return fn(opts);
    });
    queues[key] = job;
    return job;
  }
  g.HRPaySmartSync = {
    version: VERSION,
    push: function(o) {
      return queued(push, o);
    },
    pull: function(o) {
      return queued(pull, o);
    },
    resetState: function(tool) {
      try {
        localStorage.removeItem(STATE_PREFIX + tool);
      } catch (_) {}
    },
    buildBuckets: buildBuckets,
    mergeRows: mergeRows,
    semanticKey: semanticKey,
    bucketKey: bucketKey,
    stable: stable
  };
})(window);