/* DEL-GUARD BEGIN — 人按刪除才要 Paul 核可 v2.0（2026-11-07）
 * 共用於 VRT HR、HRA-PAY、HRA Portal、GASCheck、GA-EXP、VRT ERP；原始檔在 psjhr/tools/del-guard.js，各平台貼在第一個載入的 js 最前面。
 * v1.0（11/6）把正常同步也當成刪除、一直私訊 Paul，11/7 停用；v2.0 照 Paul 的規則重做：
 *  1) 只攔「有人按了刪除」：刪除類動作（delete、deleteBatch、warnDelete、img_del、hr_photo_del…）
 *     且在按鍵／確認視窗 8 秒內送出。系統匯入、同步、重新匯入（hr_drop／erp_drop）、整理區塊、自動去重一律不攔。
 *  2) 私訊 Paul 一則：哪個平台哪一頁、誰按的、要刪哪幾筆（姓名／工號／房號／日期），附核可連結（按鈕＋文字連結）。
 *  3) Paul 在 VRT HR 核可頁按 ✅ → 這台裝置自動把那次刪除重送出去；按 ❌ → 雲端保留。
 *  4) 等核可期間，那幾筆的「刪除記號」不會被同步上雲（雲端保留原資料）。
 */
(function (g) {
  'use strict';
  if (g.__delGuard) return; g.__delGuard = 2;
  var doc = g.document;
  var PSJHR_GAS = 'https://script.google.com/macros/s/AKfycbx9Pdt5vu_AcTHCrlLH4lcVONXS_VoE47SEjDUn7Iv27C2CRgoADRLpalVIJQHWBcqK/exec';
  var PSJHR_KEY = '12345';
  var APPROVE_PAGE = 'https://saintdou-weng.github.io/psjhr/#delok/';
  var path = String(g.location && g.location.pathname || '');
  var PLAT = /ac-hra-pay/i.test(path) ? 'HRA-PAY' : /ac-hra-portal/i.test(path) ? 'HRA Portal' : /ac-gascheck/i.test(path) ? 'GASCheck' : /ac-ga-exp/i.test(path) ? 'GA-EXP' : /psjerp/i.test(path) ? 'VRT ERP' : /psjhr/i.test(path) ? 'VRT HR' : (g.location && g.location.hostname || 'web');
  var PAGE = (path.split('/').pop() || 'index.html') + (g.location && g.location.hash ? g.location.hash.split('?')[0].slice(0, 30) : '');
  var LS = { get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } }, set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} } };
  var realFetch = g.fetch ? g.fetch.bind(g) : null;
  if (!realFetch) return;
  /* v1 留下的待核可紀錄與提示全部清掉 */
  try { ['dg_req_v1', 'dg_man_v1'].forEach(function (k) { localStorage.removeItem(k); }); } catch (_) {}

  /* ---------- 人是不是剛按了東西（按鍵、確認視窗）---------- */
  var lastUser = 0;
  function markUser() { lastUser = Date.now(); }
  if (doc) { doc.addEventListener('click', markUser, true); doc.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') markUser(); }, true); doc.addEventListener('touchend', markUser, true); }
  if (typeof g.confirm === 'function') { var rc = g.confirm.bind(g); g.confirm = function (m) { var r = rc(m); if (r) markUser(); return r; }; }
  function byUser() { return Date.now() - lastUser < 8000; }

  /* ---------- 小工具 ---------- */
  function hash(s) { var h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909); return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36); }
  function parseBody(b) {
    if (b == null) return {};
    try {
      if (typeof b === 'string') { var s = b.trim(); if (s[0] === '{') return JSON.parse(s); var o = {}; new URLSearchParams(s).forEach(function (v, k) { o[k] = v; }); if (o.payload) { try { return JSON.parse(o.payload); } catch (_) {} } return o; }
      if (typeof URLSearchParams !== 'undefined' && b instanceof URLSearchParams) { var o2 = {}; b.forEach(function (v, k) { o2[k] = v; }); if (o2.payload) { try { return JSON.parse(o2.payload); } catch (_) {} } return o2; }
      if (typeof FormData !== 'undefined' && b instanceof FormData) { var o3 = {}; b.forEach(function (v, k) { if (typeof v === 'string') o3[k] = v; }); if (o3.payload) { try { return JSON.parse(o3.payload); } catch (_) {} } return o3; }
    } catch (_) {}
    return {};
  }
  function queryOf(url) { var o = {}; try { new URL(url, g.location.href).searchParams.forEach(function (v, k) { o[k] = v; }); } catch (_) {} return o; }
  function isGas(url) { return /script\.google(usercontent)?\.com\/macros\//.test(url); }
  function b64(s) { try { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); } catch (_) { return ''; } }
  function nowTxt() { var d = new Date(); function p(n) { return ('0' + n).slice(-2); } return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }

  /* ---------- 只認「刪除類」動作；hr_drop／erp_drop 是重新匯入時的替換，不算 ---------- */
  var USER_DEL = /^(delete|deletebatch|deleterecord|deleterow|tempdelete|warndelete|voidpo|recordarchive|img_del|hr_photo_del|remove|removerecord|purge|wipe)$/i;
  function idsOf(p) {
    var out = [];
    ['id', 'recordId', 'rowId', 'sk', 'key', 'no', 'empId', 'employeeId'].forEach(function (k) { if (p[k] != null && p[k] !== '' && typeof p[k] !== 'object') out.push(String(p[k])); });
    ['ids', 'keys', 'rows', 'items'].forEach(function (k) { var v = p[k]; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (_) { v = v.split(','); } } if (Array.isArray(v)) v.forEach(function (x) { out.push(String(x && typeof x === 'object' ? (x.id || x.key || x.sk || '') : x)); }); });
    return out.filter(Boolean).filter(function (x, i, a) { return a.indexOf(x) === i; });
  }

  /* ---------- 找出要刪的是誰／什麼（從頁面已載入的資料找）---------- */
  var NAME_KEYS = ['name', 'empName', 'employeeName', 'fullName', 'title', 'item', 'itemName', 'location'];
  var ID_KEYS = ['idNo', 'employeeId', 'empId', 'empNo', 'staffId', 'code', 'poNo', 'style'];
  var MORE_KEYS = ['roomNo', 'room', 'department', 'dept', 'type', 'reason', 'amount'];
  var DATE_KEYS = ['date', 'period', 'month', 'issueDate', 'createdAt', 'timestamp'];
  function summarize(r) {
    if (!r || typeof r !== 'object') return '';
    var bits = [];
    function first(keys) { for (var i = 0; i < keys.length; i++) { var v = r[keys[i]]; if (v != null && v !== '' && typeof v !== 'object') return String(v).slice(0, 40); } return ''; }
    var n = first(NAME_KEYS), id = first(ID_KEYS), more = first(MORE_KEYS), dt = first(DATE_KEYS);
    if (n) bits.push(n); if (id && id !== n) bits.push(id); if (more) bits.push(more); if (dt) bits.push(dt.slice(0, 10));
    return bits.join(' · ');
  }
  function findLocal(ids) {
    var want = {}; ids.forEach(function (x) { want[x] = 1; });
    var found = {}, roots = [];
    try { if (g.state && typeof g.state.db === 'function') roots.push(g.state.db()); } catch (_) {}
    ['DB', 'STATE', 'S', 'DATA', 'APP'].forEach(function (k) { try { if (g[k] && typeof g[k] === 'object') roots.push(g[k]); } catch (_) {} });
    var seen = 0;
    roots.forEach(function (root) {
      Object.keys(root).forEach(function (k) {
        var arr = root[k]; if (!Array.isArray(arr)) return;
        for (var i = 0; i < arr.length && seen < 200000; i++, seen++) {
          var r = arr[i]; if (!r || typeof r !== 'object') continue;
          var rid = String(r.id || r._id || r.key || r._k || r.sk || '');
          if (rid && want[rid] && !found[rid]) found[rid] = summarize(r);
        }
      });
    });
    return found;
  }
  function describe(p, ids) {
    var loc = findLocal(ids), lines = [];
    ids.forEach(function (id) { lines.push(loc[id] ? loc[id] : '（編號 ' + id + '）'); });
    if (!ids.length) { var s = summarize(p); lines.push(s || '（沒有帶編號）'); }
    return lines;
  }

  /* ---------- 誰按的：每台裝置第一次刪除時問一次名字 ---------- */
  function who() {
    var w = LS.get('dg_who', '');
    if (!w) { try { w = (g.prompt && g.prompt('刪除要 Paul 核可，請輸入你的名字（之後這台裝置不會再問）\nYour name (asked once on this device):', '') || '').trim(); } catch (_) { w = ''; } if (w) LS.set('dg_who', w); }
    return w || ('未具名裝置 ' + (LS.get('dg_dev', '') || (function () { var d = Math.random().toString(36).slice(2, 6).toUpperCase(); LS.set('dg_dev', d); return d; })()));
  }

  /* ---------- 判斷 ---------- */
  function classify(url, method, p) {
    var a = String(p.action || p.type || p.op || '').trim();
    if (!a || !USER_DEL.test(a)) return null;
    if (!byUser()) return null;                                   // 不是人按的（自動去重、排程、同步）→ 不攔
    var tool = String(p.tool || p.module || p.sheet || '');
    var ids = idsOf(p);
    var sig = hash(PLAT + '|' + a + '|' + tool + '|' + ids.slice().sort().join(',') + '|' + (ids.length ? '' : JSON.stringify(p).slice(0, 300)));
    return { sig: sig, action: a, tool: tool, ids: ids };
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
    }).catch(function () { return OK.map; }).then(function (m) { refreshing = null; settle(); return m; });
    return refreshing;
  }
  var REQ = LS.get('dg_req_v2', {});   // sig → {at, ids, tool, action, url, method, body, who, items}
  function saveReq() { var cut = Date.now() - 30 * 864e5; Object.keys(REQ).forEach(function (k) { if ((REQ[k].at || 0) < cut) delete REQ[k]; }); LS.set('dg_req_v2', REQ); }
  function pendingIds() { var s = {}; Object.keys(REQ).forEach(function (k) { var d = OK.map[k]; if (d && d.st === 'ok') return; (REQ[k].ids || []).forEach(function (id) { s[id] = 1; }); }); return s; }

  /* 核可了 → 把當時那次刪除重送；不核可 → 留著（刪除記號一直不上雲） */
  function settle() {
    Object.keys(REQ).forEach(function (sig) {
      var r = REQ[sig], d = OK.map[sig];
      if (!d || d.st !== 'ok' || r.replayed) return;
      r.replayed = Date.now(); saveReq();
      var init = { method: r.method || 'POST', redirect: 'follow' }; if (r.body != null && init.method !== 'GET') { init.body = r.body; init.headers = { 'Content-Type': r.ct || 'text/plain;charset=utf-8' }; }
      realFetch(r.url, init).then(function () { delete REQ[sig]; saveReq(); banner(); }).catch(function () { r.replayed = 0; saveReq(); });
    });
    banner();
  }

  function ask(c, url, method, body) {
    var items = describe(c.p || {}, c.ids), by = who(), at = nowTxt();
    var sb = null, ct = 'text/plain;charset=utf-8';
    if (typeof body === 'string') sb = body;
    else if (body != null && typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) { sb = body.toString(); ct = 'application/x-www-form-urlencoded'; }
    else if (body != null && typeof FormData !== 'undefined' && body instanceof FormData) { var u = new URLSearchParams(); body.forEach(function (v, k) { if (typeof v === 'string') u.append(k, v); }); sb = u.toString(); ct = 'application/x-www-form-urlencoded'; }
    else if (body != null) sb = JSON.stringify(c.p);
    REQ[c.sig] = { at: Date.now(), ids: c.ids, tool: c.tool, action: c.action, url: url, method: method, body: sb, ct: ct, who: by, items: items };
    saveReq();
    var w = by + ' 要刪 ' + items.length + ' 筆：' + items.slice(0, 4).join('；') + (items.length > 4 ? '…' : '');
    var info = { sig: c.sig, p: PLAT, pg: PAGE, a: c.action, t: c.tool, w: w.slice(0, 200), at: at };
    var link = APPROVE_PAGE + b64(JSON.stringify(info));
    var text = '🗑 刪除申請（要你核可）\n' +
      '平台：' + PLAT + '（' + PAGE + '）\n' +
      '誰按的：' + by + '\n' +
      '時間：' + at + '\n' +
      '要刪 ' + items.length + ' 筆：\n' + items.slice(0, 15).map(function (x) { return '• ' + x; }).join('\n') + (items.length > 15 ? '\n…另 ' + (items.length - 15) + ' 筆' : '') +
      '\n\n核可前雲端資料保留不動。打開下面連結按 ✅ 核可／❌ 不核可：\n' + link;
    realFetch(PSJHR_GAS, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ api: 'psjhr', k: PSJHR_KEY, action: 'hr_tg', to: 'paul', text: text, buttons: [[['✅／❌ 打開核可', link]]] }) }).catch(function () {});
    try { (g.toast || g.showToast || function (m) { console.warn(m); })('🗑 已送 Paul 核可，核可後自動刪除；核可前雲端保留'); } catch (_) {}
  }
  function fakeResponse(c, st) {
    var msg = st === 'no' ? 'Paul 不核可刪除，雲端資料保留' : '刪除要 Paul 核可（已私訊），核可後自動刪除；核可前雲端保留';
    var body = JSON.stringify({ ok: false, success: false, pendingApproval: true, approval: st || 'pending', error: msg, message: msg, msg: msg, sig: c.sig });
    try { return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } }); } catch (_) { return { ok: true, status: 200, json: function () { return Promise.resolve(JSON.parse(body)); }, text: function () { return Promise.resolve(body); } }; }
  }

  /* ---------- 等核可期間：同步上傳時，把那幾筆的刪除記號先拿掉（雲端保留原資料）---------- */
  function stripPending(p) {
    var pend = pendingIds(); if (!Object.keys(pend).length) return null;
    var changed = false;
    function fix(b) {
      if (!b || typeof b !== 'object') return;
      ['records', 'rows', 'items'].forEach(function (k) {
        if (!Array.isArray(b[k])) return;
        var keep = b[k].filter(function (r) { var del = r && (r._deleted === true || r._deleted === 'true' || r.deleted === true); var id = r && String(r.id || r._id || r.key || r._k || ''); return !(del && pend[id]); });
        if (keep.length !== b[k].length) { b[k] = keep; changed = true; if (b.count != null) b.count = keep.length; }
      });
    }
    if (Array.isArray(p.buckets)) p.buckets.forEach(fix); else fix(p);
    return changed ? p : null;
  }

  /* ---------- 畫面提示（只算真的有人按刪除、還沒核可的）---------- */
  function banner() {
    if (!doc || !doc.body) return;
    var pend = Object.keys(REQ).filter(function (k) { var d = OK.map[k]; return !d || d.st !== 'ok'; });
    var el = doc.getElementById('dg-banner');
    if (!pend.length) { if (el) el.remove(); return; }
    if (!el) { el = doc.createElement('div'); el.id = 'dg-banner'; el.style.cssText = 'position:fixed;left:8px;bottom:62px;z-index:2147482999;max-width:min(520px,calc(100vw - 16px));background:#fff7ed;color:#7c2d12;border:1px solid #fdba74;border-radius:12px;padding:8px 10px;font:13px/1.4 system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.15)'; doc.body.appendChild(el); el.onclick = function () { el.style.display = 'none'; setTimeout(function () { el.style.display = ''; }, 600000); }; }
    var no = pend.filter(function (k) { return OK.map[k] && OK.map[k].st === 'no'; }).length;
    el.textContent = '🗑 ' + (pend.length - no) + ' 個刪除等 Paul 核可（核可前雲端保留）' + (no ? '；' + no + ' 個 Paul 不核可' : '') + '（點一下收起）';
  }

  /* ---------- 攔截 fetch ---------- */
  g.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (!isGas(url) || url.indexOf(PSJHR_GAS) === 0 && !/hr_photo_del/.test(String(init && init.body || ''))) return realFetch(input, init);
    var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    var body = init && init.body;
    var p = Object.assign({}, queryOf(url), method === 'GET' ? {} : parseBody(body));
    var c = null; try { c = classify(url, method, p); } catch (_) { c = null; }
    if (!c) {
      /* 同步上傳：拿掉等核可那幾筆的刪除記號 */
      if (method !== 'GET' && typeof body === 'string' && /"_deleted"\s*:\s*(true|"true")/.test(body)) {
        try { var np = stripPending(p); if (np) init = Object.assign({}, init, { body: JSON.stringify(np) }); } catch (_) {}
      }
      return realFetch(input, init);
    }
    c.p = p;
    return refreshOK(false).then(function (map) {
      var d = map[c.sig];
      if (d && d.st === 'ok') return realFetch(input, init).then(function (res) { delete REQ[c.sig]; saveReq(); banner(); return res; });
      if (!(d && d.st === 'no') && !REQ[c.sig]) ask(c, url, method, body);
      setTimeout(banner, 50);
      return fakeResponse(c, d && d.st);
    });
  };

  /* 只有這台裝置真的有等核可的刪除，才去讀 Paul 的決定（平常不多打任何請求） */
  function boot() { if (Object.keys(REQ).length) refreshOK(true); else banner(); setInterval(function () { if (Object.keys(REQ).length) refreshOK(false); }, 120000); }
  if (doc && doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
  g.DelGuard = { classify: classify, refresh: function () { return refreshOK(true); }, pending: function () { return REQ; }, platform: PLAT, version: 2 };
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
