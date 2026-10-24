/* AC-HRA-PAY Auto Incremental Sync v1.2 — 2026-08-26
 * SAFE reliability update; public API remains backward compatible with v1.1.
 *
 * Preserved behavior:
 * - local-first page load
 * - startup / network restore / app resume reconcile
 * - cloud pull first, then smart incremental push
 * - pending sync survives offline/reload through localStorage
 * - manual Upload / Download buttons remain untouched
 *
 * Reliability additions:
 * - Excel/file import + Telegram summary/review/approval start cloud sync immediately
 *   (normal add/edit remains debounced to avoid repeated uploads)
 * - small visible sync-state badge beside the cloud buttons
 * - explicit Pending / Syncing / Synced / Offline / Retry states
 * - no-data startup checks are not treated as a failed pending upload
 */
/* v1.4 (2026-09-29 audit fix)
 * - a pending "delete" is never overwritten by a later add/edit (deletion no longer lost)
 * - tab focus / pageshow checks at most once per 5 minutes when nothing is pending (less upload traffic)
 * - badge text follows the page language
 */
/* v2.0 (2026-10-09, v3.9.23)
 * - pending queue (待傳清單) moved from localStorage to IndexedDB (HRPayKV "auto:<key>");
 *   the old localStorage "hrpay:auto2:<key>" entry is migrated once and deleted
 * - badge shows live progress "同步中 3/10" from the smart-sync per-bucket events
 * - a partially finished upload stays pending and the next run only sends the remaining buckets
 */
(function(g) {
  'use strict';
  if (g.HRPayAutoSync) return;

  var VERSION = '2.0',
    RESUME_MIN_MS = 5 * 60 * 1000,
    C = {};
  var PFX = 'hrpay:auto2:';

  function online() {
    try {
      return !('onLine' in navigator) || navigator.onLine;
    } catch (_) {
      return true;
    }
  }

  // ---- pending queue: memory first, persisted in IndexedDB (never blocks, never throws) ----
  var P = Object.create(null), LOADED = Object.create(null);
  function kv() { return g.HRPayKV || null; }
  function load(k) {
    if (LOADED[k]) return LOADED[k];
    var store = kv();
    if (!store) {
      LOADED[k] = Promise.resolve(null);
      return LOADED[k];
    }
    LOADED[k] = store.get('auto:' + k, PFX + k).then(function(v) {
      if (!(k in P)) P[k] = v || null;          // a write made while loading wins
      return P[k];
    }, function() { if (!(k in P)) P[k] = null; return P[k]; });
    return LOADED[k];
  }

  function read(k) {
    return (k in P) ? P[k] : null;
  }

  function write(k, v) {
    P[k] = v;
    var store = kv();
    if (store) store.set('auto:' + k, v);
    else try { localStorage.setItem(PFX + k, JSON.stringify(v)); } catch (_) {}
  }

  function clear(k) {
    P[k] = null;
    var store = kv();
    if (store) store.remove('auto:' + k);
    try { localStorage.removeItem(PFX + k); } catch (_) {}
  }

  // keep the stronger reason: a pending delete must survive later edits
  function keepReason(oldReason, newReason) {
    if (/delete/i.test(String(oldReason || '')) && !/delete/i.test(String(newReason || ''))) return oldReason;
    return newReason || oldReason;
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

  function mergeExtra(a, b) {
    var o = {};
    Object.keys(a || {}).forEach(function(k) {
      o[k] = a[k];
    });
    Object.keys(b || {}).forEach(function(k) {
      if (b[k] !== undefined && b[k] !== null && b[k] !== '') o[k] = b[k];
    });
    return o;
  }

  function hhmm() {
    try {
      return new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch (_) {
      return '';
    }
  }

  function reasonDelay(reason, requested) {
    var r = String(reason || '').toLowerCase();
    var d = (requested == null ? 900 : Number(requested));
    if (!isFinite(d) || d < 0) d = 900;
    // User-facing commits should begin before a mobile tab/app can be suspended.
    if (/^(import|telegram|telegram-summary|telegram-review|approval|review|restore|file-change|file-delete|delete)$/.test(r)) return Math.min(d, 60);
    if (/^(batch-save|batch-delete)$/.test(r)) return Math.min(d, 250);
    return d;
  }

  function ensureBadge(s) {
    if (!g.document) return null;
    var id = 'hrpay-auto-sync-state-' + s.key;
    var el = document.getElementById(id);
    if (el) return el;
    var up = document.getElementById('btn-cloud-up'),
      down = document.getElementById('btn-cloud-down');
    var anchor = down || up;
    if (!anchor || !anchor.parentNode) return null;
    el = document.createElement('span');
    el.id = id;
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.style.cssText = 'display:inline-flex;align-items:center;white-space:nowrap;font-size:11px;line-height:1;padding:5px 8px;border-radius:999px;background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0;margin-left:6px;vertical-align:middle;';
    try {
      anchor.insertAdjacentElement('afterend', el);
    } catch (_) {
      anchor.parentNode.appendChild(el);
    }
    return el;
  }

  function stateText(state, detail) {
    var en = isEn(),
      d = detail ? ' ' + detail : '';
    if (state === 'dirty') return en ? '☁ Pending sync' : '☁ 待同步';
    if (state === 'syncing') return (en ? '☁ Syncing…' : '☁ 同步中…') + d;
    if (state === 'synced') return (en ? '✅ Cloud synced' : '✅ 雲端已同步') + d;
    if (state === 'offline') return en ? '☁ Offline – will upload' : '☁ 離線待傳';
    if (state === 'retry') return (en ? '⚠ Cloud retry pending' : '⚠ 雲端待重試') + d;
    if (state === 'checked') return (en ? '☁ Checked' : '☁ 已檢查') + d;
    return en ? '☁ Auto sync' : '☁ 自動同步';
  }

  function setState(s, state, detail) {
    s.state = state;
    s.stateDetail = detail || '';
    var el = ensureBadge(s);
    if (el) {
      el.textContent = stateText(state, detail);
      var bg = '#f1f5f9',
        fg = '#64748b',
        bd = '#e2e8f0';
      if (state === 'syncing') {
        bg = '#eff6ff';
        fg = '#2563eb';
        bd = '#bfdbfe';
      } else if (state === 'synced' || state === 'checked') {
        bg = '#ecfdf5';
        fg = '#047857';
        bd = '#a7f3d0';
      } else if (state === 'dirty') {
        bg = '#fffbeb';
        fg = '#b45309';
        bd = '#fde68a';
      } else if (state === 'offline' || state === 'retry') {
        bg = '#fff7ed';
        fg = '#c2410c';
        bd = '#fed7aa';
      }
      el.style.background = bg;
      el.style.color = fg;
      el.style.borderColor = bd;
      el.title = 'AC-HRA-PAY Auto Sync · ' + stateText(state, detail);
    }
    try {
      g.dispatchEvent(new CustomEvent('hrpay-autosync-state', {
        detail: {
          key: s.key,
          state: state,
          detail: detail || '',
          at: Date.now()
        }
      }));
    } catch (_) {}
  }

  function install(opts) {
    opts = opts || {};
    var key = String(opts.key || '').trim();
    if (!key) throw new Error('HRPayAutoSync key required');
    if (C[key]) {
      C[key].opts = opts;
      ensureBadge(C[key]);
      return C[key];
    }
    var s = C[key] = {
      key: key,
      opts: opts,
      busy: false,
      timer: null,
      queued: null,
      lastRun: 0,
      state: 'idle',
      stateDetail: ''
    };
    ensureBadge(s);
    s.loaded = load(key);
    g.addEventListener('hrpay-sync-status', function(ev) {
      var d = ev && ev.detail || {};
      if (s.busy && (d.type === 'warn' || d.type === 'error') && d.msg) s.lastMsg = String(d.msg).replace(/\s+/g, ' ').slice(0, 80);
    });
    g.addEventListener('hrpay-sync-progress', function(ev) {
      var d = ev && ev.detail || {};
      if (!s.busy || !d.total || (d.phase !== 'upload' && d.phase !== 'download')) return;
      var en = isEn(), lab = d.phase === 'upload' ? (en ? 'up ' : '上傳 ') : (en ? 'down ' : '下載 ');
      setState(s, 'syncing', lab + d.done + '/' + d.total);
      s.progress = { phase: d.phase, done: d.done, total: d.total, tool: d.tool, at: Date.now() };
    });

    function canSync() {
      try {
        return typeof s.opts.canSync === 'function' ? !!s.opts.canSync() : true;
      } catch (_) {
        return false;
      }
    }

    // a failed / partial run retries by itself (2 → 4 → 8 → 15 min); only the remaining buckets are sent
    function armRetry() {
      if (s.retryTimer) clearTimeout(s.retryTimer);
      s.retryWait = Math.min((s.retryWait || 60000) * 2, 15 * 60 * 1000);
      s.retryTimer = setTimeout(function() {
        s.retryTimer = null;
        var p = read(key);
        if (p && online()) run(p.reason || 'retry', p.extra || {});
      }, s.retryWait);
    }

    async function run(reason, extra) {
      reason = reason || 'reconcile';
      extra = extra || {};
      if (s.busy) {
        s.queued = {
          reason: keepReason(s.queued && s.queued.reason, reason),
          extra: mergeExtra(s.queued && s.queued.extra, extra)
        };
        return false;
      }
      try { await s.loaded; } catch (_) {}
      if (s.busy) {
        s.queued = {
          reason: keepReason(s.queued && s.queued.reason, reason),
          extra: mergeExtra(s.queued && s.queued.extra, extra)
        };
        return false;
      }
      var priorPending = read(key);
      if (!online() || !canSync()) {
        write(key, {
          reason: keepReason(priorPending && priorPending.reason, reason),
          extra: extra,
          at: Date.now()
        });
        setState(s, online() ? 'retry' : 'offline');
        return false;
      }
      s.busy = true;
      s.lastRun = Date.now();
      s.progress = null;
      s.lastMsg = '';
      setState(s, 'syncing');
      try {
        // Deletion must push the local removal first. Pull-first would re-create the just-deleted cloud record.
        // Normal add/edit/import remains pull-first to preserve cloud-only/newer data.
        var isDelete = /delete/i.test(String(reason || ''));
        if (!isDelete && typeof s.opts.pull === 'function') {
          var pctx = { key: key, reason: String(reason || ''), at: Date.now() };
          g.__HRPAY_SYNC_CONTEXT = pctx;   // pull knows this run comes from a user change (keeps a local deletion)
          try {
            await s.opts.pull({
              silent: true,
              auto: true,
              reason: reason
            });
          } catch (e) {
            if (s.opts.log !== false) console.warn('[HRPayAutoSync pull ' + key + ']', e);
          } finally {
            if (g.__HRPAY_SYNC_CONTEXT === pctx) g.__HRPAY_SYNC_CONTEXT = null;
          }
        }
        var ok = true;
        if (typeof s.opts.push === 'function') {
          var po = mergeExtra({
            silent: true,
            auto: true,
            reason: reason
          }, extra);
          var ctx = {
            key: key,
            reason: String(reason || ''),
            at: Date.now()
          };
          g.__HRPAY_SYNC_CONTEXT = ctx;
          try {
            var r = await s.opts.push(po);
            ok = (r !== false);
          } finally {
            if (g.__HRPAY_SYNC_CONTEXT === ctx) g.__HRPAY_SYNC_CONTEXT = null;
          }
        }
        if (ok) {
          clear(key);
          s.retryWait = 0;
          if (s.retryTimer) { clearTimeout(s.retryTimer); s.retryTimer = null; }
          setState(s, 'synced', hhmm());
        } else if (!priorPending && /^(startup-reconcile|reconcile|resume|pageshow|network-restored)$/.test(String(reason || ''))) {
          // Empty/no-cloud module during a passive check is not a failed upload.
          clear(key);
          setState(s, 'checked', hhmm());
        } else {
          write(key, {
            reason: keepReason(priorPending && priorPending.reason, reason),
            extra: extra,
            progress: s.progress || null,
            at: Date.now()
          });
          setState(s, 'retry', (s.progress && s.progress.total ? s.progress.done + '/' + s.progress.total + ' ' : '') + (s.lastMsg || ''));
          armRetry();
        }
        return ok;
      } catch (e) {
        write(key, {
          reason: keepReason(priorPending && priorPending.reason, reason),
          extra: extra,
          at: Date.now()
        });
        setState(s, 'retry', String(e && e.message || s.lastMsg || '').replace(/\s+/g, ' ').slice(0, 80));
        armRetry();
        if (s.opts.log !== false) console.warn('[HRPayAutoSync ' + key + ']', e);
        return false;
      } finally {
        s.busy = false;
        if (s.queued) {
          var q = s.queued;
          s.queued = null;
          schedule(q.reason, q.extra, 250);
        }
      }
    }

    function schedule(reason, extra, delay) {
      reason = reason || 'change';
      extra = extra || {};
      var old = read(key) || {};
      // record "the user changed data on this device" for the smart sync (deletions need it)
      try { if (s.opts.tool && g.HRPaySmartSync && g.HRPaySmartSync.markChange) g.HRPaySmartSync.markChange(s.opts.tool, reason); } catch (_) {}
      reason = keepReason(old.reason, reason);
      write(key, {
        reason: reason,
        extra: mergeExtra(old.extra, extra),
        at: Date.now()
      });
      setState(s, online() ? 'dirty' : 'offline');
      if (s.timer) clearTimeout(s.timer);
      var wait = reasonDelay(reason, delay);
      s.timer = setTimeout(function() {
        s.timer = null;
        var p = read(key) || {};
        run(p.reason || reason, mergeExtra(p.extra, extra));
      }, wait);
      return true;
    }

    s.run = run;
    s.refreshBadge = function() {
      setState(s, s.state, s.stateDetail);
    };
    s.schedule = schedule;
    var startup = function() {
      setTimeout(function() {
        s.loaded.then(function() {
          var p = read(key) || {};
          if (p.reason) setState(s, online() ? 'dirty' : 'offline');
          run(p.reason || 'startup-reconcile', p.extra || {});
        });
      }, Number(opts.startDelay) || 450);
    };
    if (document.readyState === 'complete' || document.readyState === 'interactive') startup();
    else window.addEventListener('load', startup, {
      once: true
    });
    window.addEventListener('online', function() {
      var p = read(key) || {};
      setTimeout(function() {
        run(p.reason || 'network-restored', p.extra || {});
      }, 120);
    });
    // passive checks when the tab regains focus: only if something is pending or 5 minutes passed
    function passiveDue() {
      return !!read(key) || (Date.now() - (s.lastRun || 0)) > RESUME_MIN_MS;
    }
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden && online() && passiveDue()) {
        var p = read(key) || {};
        setTimeout(function() {
          run(p.reason || 'resume', p.extra || {});
        }, 150);
      }
    });
    window.addEventListener('pageshow', function(e) {
      if (e && e.persisted && online() && passiveDue()) {
        var p = read(key) || {};
        setTimeout(function() {
          run(p.reason || 'pageshow', p.extra || {});
        }, 150);
      }
    });
    return s;
  }

  function schedule(key, reason, extra, delay) {
    var s = C[key];
    if (!s) {
      load(key);
      write(key, {
        reason: reason || 'change',
        extra: extra || {},
        at: Date.now()
      });
      return false;
    }
    return s.schedule(reason, extra, delay);
  }

  function run(key, reason, extra) {
    var s = C[key];
    return s ? s.run(reason, extra) : Promise.resolve(false);
  }

  function refreshBadges() {
    Object.keys(C).forEach(function(k) {
      try {
        if (C[k].state && C[k].state !== 'idle') C[k].refreshBadge();
      } catch (_) {}
    });
  }

  function clearPending(key) {
    clear(key);
  }

  function pending(key) {
    return read(key);
  }

  function pendingAsync(key) {
    return load(key).then(function() { return read(key); });
  }

  function state(key) {
    var s = C[key];
    return s ? {
      state: s.state,
      detail: s.stateDetail,
      lastRun: s.lastRun,
      progress: s.progress || null
    } : null;
  }

  g.HRPayAutoSync = {
    version: VERSION,
    install: install,
    schedule: schedule,
    markDirty: schedule,
    run: run,
    flush: run,
    pending: pending,
    pendingAsync: pendingAsync,
    clearPending: clearPending,
    refreshBadges: refreshBadges,
    state: state
  };
})(window);