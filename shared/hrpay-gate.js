/* DEL-GUARD BEGIN — 雲端刪除要 Paul 核可＋進頁／切分頁自動同步 v1.0（2026-11-06）
 * 共用於 HRA-PAY、HRA Portal、GASCheck、GA-EXP、VRT ERP（PSJERP）；原始檔在 psjhr/tools/del-guard.js，各平台貼在第一個載入的 js 最前面。
 *
 * 1) 任何會刪除或覆蓋雲端資料的請求（delete／drop／清除、區塊筆數變少、smartCommit 少了區塊、deletes[]、
 *    刪除標記 _deleted、force 強制覆蓋…）先攔下來：雲端資料保留不動，私訊 Paul（VRTHRBOT），
 *    Paul 在 VRT HR 按「✅ 核可」後，這台裝置下一次同步才真的刪。按「❌ 不核可」就一直不刪。
 * 2) 一進平台、切換分頁，就自動同步（下載＋上傳）到完成為止；本來就只下載有變的區塊，已下載過的不重下。
 * 只攔「刪」，新增和修改照常上傳。
 */
(function (g) {
  'use strict';
  if (g.__delGuard) return; g.__delGuard = 1;
  /* 2026-11-07 Paul 指示停用：誤把正常同步當成刪除、一直私訊要核可。整段不再執行（攔截、私訊、橫幅、進頁自動同步都停）。 */
  return;
  var doc = g.document;
  var PSJHR_GAS = 'https://script.google.com/macros/s/AKfycbx9Pdt5vu_AcTHCrlLH4lcVONXS_VoE47SEjDUn7Iv27C2CRgoADRLpalVIJQHWBcqK/exec';
  var PSJHR_KEY = '12345';
  var APPROVE_PAGE = 'https://saintdou-weng.github.io/psjhr/#delok/';
  var path = String(g.location && g.location.pathname || '');
  var PLAT = /ac-hra-pay/i.test(path) ? 'HRA-PAY' : /ac-hra-portal/i.test(path) ? 'HRA Portal' : /ac-gascheck/i.test(path) ? 'GASCheck' : /ac-ga-exp/i.test(path) ? 'GA-EXP' : /psjerp/i.test(path) ? 'VRT ERP' : /psjhr/i.test(path) ? 'VRT HR' : (g.location && g.location.host) || 'web';
  var PAGE = (path.split('/').pop() || 'index.html') + (g.location && g.location.hash ? g.location.hash.split('?')[0].slice(0, 30) : '');
  var LS = { get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } }, set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} } };
  var realFetch = g.fetch ? g.fetch.bind(g) : null;
  if (!realFetch) return;

  /* ---------- 小工具 ---------- */
  function hash(s) { var h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909); return (h2 >>> 0).toString(36) + (h1 >>> 0).toString(36); }
  function stable(v) { if (v == null || typeof v !== 'object') return JSON.stringify(v); if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']'; return '{' + Object.keys(v).sort().filter(function (k) { return !/^(k|key|ts|t|_t|nonce|uploadId|token|cb|callback|_)$/i.test(k); }).map(function (k) { return JSON.stringify(k) + ':' + stable(v[k]); }).join(',') + '}'; }
  function parseBody(b) {
    if (b == null) return {};
    try {
      if (typeof b === 'string') { var s = b.trim(); if (s[0] === '{') return JSON.parse(s); if (/(^|&)payload=/.test(s)) { var p = new URLSearchParams(s); return JSON.parse(p.get('payload') || '{}'); } if (/=/.test(s)) { var o = {}; new URLSearchParams(s).forEach(function (v, k) { o[k] = v; }); if (o.payload) { try { return JSON.parse(o.payload); } catch (_) {} } return o; } return {}; }
      if (typeof URLSearchParams !== 'undefined' && b instanceof URLSearchParams) { var o2 = {}; b.forEach(function (v, k) { o2[k] = v; }); if (o2.payload) { try { return JSON.parse(o2.payload); } catch (_) {} } return o2; }
      if (typeof FormData !== 'undefined' && b instanceof FormData) { var o3 = {}; b.forEach(function (v, k) { if (typeof v === 'string') o3[k] = v; }); if (o3.payload) { try { return JSON.parse(o3.payload); } catch (_) {} } return o3; }
    } catch (_) {}
    return {};
  }
  function queryOf(url) { var o = {}; try { new URL(url, g.location.href).searchParams.forEach(function (v, k) { o[k] = v; }); } catch (_) {} return o; }
  function isGas(url) { return /script\.google(usercontent)?\.com\/macros\//.test(url); }
  function isMine(url) { return url.indexOf(PSJHR_GAS) === 0; }

  /* ---------- 雲端區塊基準：從 smartManifest 回應記下每個區塊的筆數 ---------- */
  var MAN = LS.get('dg_man_v1', {});
  function saveMan() { LS.set('dg_man_v1', MAN); }
  function learnManifest(tool, j) {
    if (!tool || !j || typeof j !== 'object') return;
    var d = j.data && typeof j.data === 'object' ? j.data : j; var m = d.manifest && typeof d.manifest === 'object' ? d.manifest : d;
    var hashes = m.hashes || m.bucketHashes || null, counts = m.counts || m.bucketCounts || null;
    if (!hashes && Array.isArray(m.buckets)) { hashes = {}; counts = {}; m.buckets.forEach(function (b) { if (b && (b.bucket || b.key)) { var k = b.bucket || b.key; hashes[k] = b.hash || ''; counts[k] = Number(b.count); } }); }
    if (!hashes || typeof hashes !== 'object') return;
    var c = {}; Object.keys(hashes).forEach(function (k) { var n = counts && counts[k]; c[k] = (n === 0 || n) && !isNaN(Number(n)) ? Number(n) : null; });
    MAN[PLAT + '|' + tool] = { at: Date.now(), counts: c }; saveMan();
  }

  /* ---------- 判斷：這個請求會不會刪雲端資料 ---------- */
  var EXPLICIT = /^(delete|deletebatch|tempdelete|warndelete|voidpo|recordarchive|erp_drop|img_del|hr_drop|hr_photo_del|remove|purge|clear|reset|drop|wipe)/i;
  var EXPLICIT_END = /(delete|_drop|_del|remove|purge|clear|reset|archive|wipe)$/i;
  function recordsOf(o) { var out = []; ['records', 'rows', 'items', 'data'].forEach(function (k) { if (Array.isArray(o[k])) out = out.concat(o[k]); }); return out; }
  function idOf(r) { if (!r || typeof r !== 'object') return ''; return String(r.id || r._id || r.key || r._k || r.uid || r.recordId || r.no || ''); }
  function classify(url, method, p) {
    var a = String(p.action || p.type || p.op || '').trim(); var tool = String(p.tool || p.module || p.sheet || p.key || '');
    var why = [], parts = [];
    if (!a) return null;
    if (/^(smartManifest|smartBucketsRead|hr_manifest|hr_get|erp_manifest|erp_get|ping|status|list|get|read|load)/i.test(a) && !/delete|drop|clear/i.test(a)) return null;
    if (EXPLICIT.test(a) || EXPLICIT_END.test(a)) { why.push(a); parts.push(a, stable(p)); }
    if (p.force === true || p.force === 1 || p.force === '1' || p.force === 'true' || p.overwriteConfirmed) { why.push('強制覆蓋 force'); parts.push('force', a, tool); }
    if (Array.isArray(p.deletes) && p.deletes.length) { var dk = p.deletes.map(function (x) { return typeof x === 'object' ? (x.bucket || x.key || stable(x)) : String(x); }).sort(); why.push('刪除區塊 ' + dk.slice(0, 6).join(',') + (dk.length > 6 ? '…' : '')); parts.push('deletes', tool, dk.join(',')); }
    if (Array.isArray(p.removeBuckets) && p.removeBuckets.length) { var rb = p.removeBuckets.map(String).sort(); why.push('移除區塊 ' + rb.slice(0, 6).join(',')); parts.push('removeBuckets', tool, rb.join(',')); }
    if (p.seed === true || p.seed === 1) { why.push('整份重建 seed'); parts.push('seed', tool); }
    var man = MAN[PLAT + '|' + tool];
    if (/^smartCommit$/i.test(a) && p.hashes && man) { var gone = Object.keys(man.counts).filter(function (k) { return !(k in p.hashes); }).sort(); if (gone.length) { why.push('雲端少了區塊 ' + gone.slice(0, 6).join(',') + (gone.length > 6 ? '…' : '')); parts.push('commitDrop', tool, gone.join(',')); } }
    var buckets = Array.isArray(p.buckets) ? p.buckets : (/^smartBucket$/i.test(a) && p.bucket && !p.read ? [p] : []);
    buckets.forEach(function (b) {
      if (!b || typeof b !== 'object') return; var k = String(b.bucket || b.key || ''); var recs = recordsOf(b); var cnt = b.count != null ? Number(b.count) : recs.length;
      var tomb = recs.filter(function (r) { return r && (r._deleted === true || r.deleted === true || r._del === true || r.__deleted === true); }).map(idOf).filter(Boolean).sort();
      if (tomb.length) { why.push('刪除 ' + tomb.length + ' 筆（' + k + '）'); parts.push('tomb', tool, k, tomb.join(',')); }
      var was = man && man.counts[k];
      if (was != null && !isNaN(cnt) && cnt < was) { why.push(k + ' 筆數 ' + was + '→' + cnt); parts.push('shrink', tool, k, was + '>' + cnt); }
    });
    if (Array.isArray(p.changes)) { var del = p.changes.filter(function (c) { return c && (c.deleted === true || c._deleted === true || c.op === 'delete'); }).map(function (c) { return idOf(c) || idOf(c.record || c.data); }).sort(); if (del.length) { why.push('刪除 ' + del.length + ' 筆'); parts.push('changesDel', tool, del.join(',')); } }
    if (!why.length) return null;
    var sig = hash(PLAT + '|' + parts.join('|'));
    return { sig: sig, action: a, tool: tool, why: why.join('；').slice(0, 300) };
  }

  /* ---------- 核可狀態：讀 VRT HR 雲端設定裡 Paul 的決定 ---------- */
  var OK = LS.get('dg_ok_v1', { at: 0, map: {} });
  var refreshing = null;
  function refreshOK(force) {
    if (!force && Date.now() - (OK.at || 0) < 90000) return Promise.resolve(OK.map);
    if (refreshing) return refreshing;
    refreshing = realFetch(PSJHR_GAS + '?k=' + PSJHR_KEY + '&action=hr_get&key=config&offset=0&limit=5', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
      var rows = (j && j.rows) || []; var map = {};
      rows.forEach(function (a) { var data = Array.isArray(a) ? a[3] : a && a.data; try { var c = JSON.parse(data || '{}'); if (c && c.delok) map = c.delok; } catch (_) {} });
      OK = { at: Date.now(), map: map }; LS.set('dg_ok_v1', OK); return map;
    }).catch(function () { return OK.map; }).then(function (m) { refreshing = null; return m; });
    return refreshing;
  }
  var REQ = LS.get('dg_req_v1', {});   // sig → {at, why, sent}
  function saveReq() { var cut = Date.now() - 30 * 864e5; Object.keys(REQ).forEach(function (k) { if ((REQ[k].at || 0) < cut) delete REQ[k]; }); LS.set('dg_req_v1', REQ); }
  function b64(s) { try { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); } catch (_) { return ''; } }
  function ask(c) {
    var r = REQ[c.sig];
    if (r && r.sent && Date.now() - r.sent < 12 * 3600e3) return;   // 同一件事 12 小時內只私訊一次
    REQ[c.sig] = { at: (r && r.at) || Date.now(), why: c.why, tool: c.tool, action: c.action, sent: Date.now() }; saveReq();
    var info = { sig: c.sig, p: PLAT, pg: PAGE, a: c.action, t: c.tool, w: c.why.slice(0, 220), at: new Date().toISOString().slice(0, 16).replace('T', ' ') };
    var link = APPROVE_PAGE + b64(JSON.stringify(info));
    var text = '🛡 雲端刪除要你核可\n平台：' + PLAT + '（' + PAGE + '）\n動作：' + c.action + (c.tool ? '｜' + c.tool : '') + '\n內容：' + c.why + '\n\n核可前雲端資料保留不動；核可後下一次同步才會刪。';
    realFetch(PSJHR_GAS, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ api: 'psjhr', k: PSJHR_KEY, action: 'hr_tg', to: 'paul', text: text, buttons: [[['🛡 打開核可（✅／❌）', link]]] }) }).catch(function () { REQ[c.sig].sent = 0; saveReq(); });
  }
  function fakeResponse(c, st) {
    var msg = st === 'no' ? 'Paul 不核可刪除，雲端資料保留' : '刪除雲端資料要 Paul 核可（已私訊），核可前雲端保留';
    var body = JSON.stringify({ ok: false, success: false, pendingApproval: true, approval: st || 'pending', error: msg, message: msg, msg: msg, sig: c.sig });
    try { return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } }); } catch (_) { return { ok: true, status: 200, json: function () { return Promise.resolve(JSON.parse(body)); }, text: function () { return Promise.resolve(body); } }; }
  }

  /* ---------- 畫面提示 ---------- */
  function banner() {
    if (!doc.body) return; var pend = Object.keys(REQ).filter(function (k) { var d = OK.map[k]; return !d || d.st !== 'ok'; });
    var el = doc.getElementById('dg-banner');
    if (!pend.length) { if (el) el.remove(); return; }
    if (!el) { el = doc.createElement('div'); el.id = 'dg-banner'; el.style.cssText = 'position:fixed;left:8px;bottom:62px;z-index:2147482999;max-width:min(520px,calc(100vw - 16px));background:#fff7ed;color:#7c2d12;border:1px solid #fdba74;border-radius:12px;padding:8px 10px;font:13px/1.4 system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.15)'; doc.body.appendChild(el); el.onclick = function () { el.style.display = 'none'; setTimeout(function () { el.style.display = ''; }, 600000); }; }
    var no = pend.filter(function (k) { return OK.map[k] && OK.map[k].st === 'no'; }).length;
    el.textContent = '🛡 ' + (pend.length - no) + ' 筆雲端刪除等 Paul 核可，核可前雲端資料保留' + (no ? '；' + no + ' 筆 Paul 不核可（雲端保留，請重新下載）' : '') + '（點一下先收起）';
  }

  /* ---------- 攔截 fetch ---------- */
  g.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (!isGas(url) || isMine(url) && !/hr_drop|hr_photo_del/.test(String(init && init.body || ''))) return realFetch(input, init).then(function (res) { sniff(url, init, res); return res; });
    var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    var p = Object.assign({}, queryOf(url), method === 'GET' ? {} : parseBody(init && init.body));
    var c = null; try { c = classify(url, method, p); } catch (_) { c = null; }
    if (!c) return realFetch(input, init).then(function (res) { sniff(url, init, res, p); return res; });
    return refreshOK(false).then(function (map) {
      var d = map[c.sig];
      if (d && d.st === 'ok') { return realFetch(input, init).then(function (res) { if (REQ[c.sig]) { REQ[c.sig].done = Date.now(); delete REQ[c.sig]; saveReq(); } banner(); return res; }); }
      if (!(d && d.st === 'no')) ask(c);
      else if (!REQ[c.sig]) { REQ[c.sig] = { at: Date.now(), why: c.why, sent: Date.now() }; saveReq(); }
      setTimeout(banner, 50); console.warn('[del-guard] blocked until Paul approves', c);
      return fakeResponse(c, d && d.st);
    });
  };
  function sniff(url, init, res, p) {
    try {
      p = p || Object.assign({}, queryOf(url), parseBody(init && init.body)); var a = String(p.action || '');
      if (!/^smartManifest$/i.test(a) || !res || !res.clone) return;
      res.clone().json().then(function (j) { learnManifest(String(p.tool || ''), j); }).catch(function () {});
    } catch (_) {}
  }

  /* ---------- 進頁／切分頁自動同步到完成 ---------- */
  var KEYS = {};
  function wrapAuto(name) {
    var cur = g[name]; var hooked = null;
    function hook(v) { if (!v || v.__dg) return v; var inst = v.install; if (typeof inst === 'function') v.install = function (o) { try { var k = o && (o.key || o.tool || o.stateKey); if (k) KEYS[name + '|' + k] = { api: name, key: k }; } catch (_) {} return inst.apply(this, arguments); }; v.__dg = 1; return v; }
    try { Object.defineProperty(g, name, { configurable: true, get: function () { return hooked; }, set: function (v) { hooked = hook(v); } }); if (cur) hooked = hook(cur); } catch (_) {}
  }
  ['HRPayAutoSync', 'HRAAutoSync', 'GAAutoSync'].forEach(wrapAuto);
  var lastKick = 0;
  function kick(reason) {
    if (Date.now() - lastKick < 45000) return; lastKick = Date.now();
    var tries = 0;
    (function once() {
      var ps = [];
      Object.keys(KEYS).forEach(function (id) { var k = KEYS[id], api = g[k.api]; if (api && typeof api.run === 'function') { try { ps.push(Promise.resolve(api.run(k.key, reason))); } catch (_) {} } });
      try { if (g.GC && g.GC.sync && typeof g.GC.sync.reconcile === 'function') Object.keys(MAN).forEach(function (mk) { var t = mk.split('|'); if (t[0] === PLAT && t[1]) ps.push(Promise.resolve(g.GC.sync.reconcile(t[1], reason))); }); } catch (_) {}
      if (!ps.length) return;
      Promise.all(ps.map(function (x) { return x.then(function (r) { return r !== false && !(r && r.ok === false && !r.pendingApproval && !r.unmounted); }, function () { return false; }); })).then(function (oks) {
        if (oks.every(Boolean) || ++tries >= 6) return; setTimeout(once, 20000);   // 沒完成就每 20 秒再跑，最多 6 次
      });
    })();
  }
  function onTabClick(e) {
    var t = e.target && e.target.closest && e.target.closest('[role=tab],[data-tab],.tab,.tabs button,.tab-btn,nav button,.nav button,.seg button,[onclick*="Tab("],[onclick*="tab("]');
    if (t) setTimeout(function () { lastKick = Math.min(lastKick, Date.now() - 30000); kick('tab-open'); }, 300);
  }
  function boot() { refreshOK(true).then(banner); doc.addEventListener('click', onTabClick, true); g.addEventListener('hashchange', function () { kick('tab-open'); }); setTimeout(function () { kick('page-open'); }, 4000); setInterval(function () { refreshOK(false).then(banner); }, 120000); }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
  g.DelGuard = { classify: classify, refresh: function () { return refreshOK(true); }, pending: function () { return REQ; }, platform: PLAT };
})(window);
/* DEL-GUARD END */
/* AC-HRA-PAY 平台入口密碼 v1.0（2026-10-24）
 * 每一頁最先載入：沒輸入過密碼的瀏覽器先看到密碼畫面，輸入正確後這台裝置記住 30 天。
 * 程式碼只存密碼的 SHA-256，不存明碼。這是「門鎖」：擋住一般拿到網址的人，不是銀行等級的保護。
 */
(function (g) {
  'use strict';
  var doc = g.document, KEY = 'hrpay_gate_v1', DAYS = 30;
  var HASH = '6051fc84a7a0d74c225fb18a496b09952da5642e60723ecae543298edd7d82d6';
  function ok() {
    try { var v = JSON.parse(localStorage.getItem(KEY) || 'null'); return !!(v && v.h === HASH && v.exp > Date.now()); } catch (_) { return false; }
  }
  function lang() { try { var l = localStorage.getItem('hrpay_lang'); return l === 'en' || l === 'km' ? l : 'tc'; } catch (_) { return 'tc'; } }
  function L(tc, en, km) { var l = lang(); return l === 'en' ? en : l === 'km' ? km : tc; }
  async function sha(t) {
    var d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
    return Array.prototype.map.call(new Uint8Array(d), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  g.HRPayGate = {
    lock: function () { try { localStorage.removeItem(KEY); } catch (_) {} location.reload(); },
    unlocked: ok
  };
  if (ok()) return;
  doc.documentElement.classList.add('hrpay-locked');
  var st = doc.createElement('style');
  st.textContent = 'html.hrpay-locked body>*:not(#hrpay-gate){visibility:hidden!important}' +
    '#hrpay-gate{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0f2a4a,#16375e);font:15px/1.5 system-ui,"Noto Sans TC",sans-serif;padding:16px}' +
    '#hrpay-gate form{background:#fff;color:#0f172a;border-radius:16px;padding:26px 24px;width:min(360px,100%);box-shadow:0 20px 50px rgba(0,0,0,.35);text-align:center}' +
    '#hrpay-gate h1{font-size:20px;margin:0 0 4px}#hrpay-gate p{color:#64748b;font-size:13px;margin:0 0 16px}' +
    '#hrpay-gate input{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:10px;padding:11px 12px;font-size:16px;text-align:center;letter-spacing:2px}' +
    '#hrpay-gate button{margin-top:12px;width:100%;border:0;border-radius:10px;padding:11px;background:#c9a227;color:#132;font-weight:800;font-size:15px;cursor:pointer}' +
    '#hrpay-gate .err{color:#b91c1c;font-size:13px;min-height:18px;margin-top:8px}';
  (doc.head || doc.documentElement).appendChild(st);
  function show() {
    if (doc.getElementById('hrpay-gate') || ok()) return;
    var box = doc.createElement('div'); box.id = 'hrpay-gate';
    box.innerHTML = '<form autocomplete="off"><h1>💼 AC-HRA-PAY</h1><p>' + L('請輸入平台密碼', 'Enter the platform password', 'សូមបញ្ចូលពាក្យសម្ងាត់') + '</p>' +
      '<input type="password" name="pw" autofocus aria-label="password"><button type="submit">' + L('進入', 'Enter', 'ចូល') + '</button><div class="err" role="alert"></div></form>';
    doc.body.appendChild(box);
    var f = box.querySelector('form'), inp = f.querySelector('input'), err = f.querySelector('.err');
    setTimeout(function () { try { inp.focus(); } catch (_) {} }, 50);
    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      var h = '';
      try { h = await sha(String(inp.value || '').trim()); } catch (_) {}
      if (h !== HASH) { err.textContent = L('密碼不對，請再試一次', 'Wrong password, please try again', 'ពាក្យសម្ងាត់មិនត្រឹមត្រូវ'); inp.select(); return; }
      try { localStorage.setItem(KEY, JSON.stringify({ h: HASH, exp: Date.now() + DAYS * 86400000 })); } catch (_) {}
      box.remove(); doc.documentElement.classList.remove('hrpay-locked');
    });
  }
  if (doc.body) show(); else doc.addEventListener('DOMContentLoaded', show);
  // a page that rebuilds <body> (language switch) must not drop the gate
  setInterval(function () { if (!ok() && doc.body && !doc.getElementById('hrpay-gate')) show(); }, 800);
})(window);

/* 表格搜尋＋手機排版（每頁都會載入閘門，所以從這裡帶進來） */
(function(){try{var d=document,s=d.createElement("script");s.src=(d.currentScript&&d.currentScript.src?d.currentScript.src.replace(/[^\/]*$/,""):"shared/")+"table-find.js?v=2";s.defer=true;(d.head||d.documentElement).appendChild(s)}catch(e){}})();
