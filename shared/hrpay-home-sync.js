/* Home Cloud Sync v1.0 (2026-10-15) — shared by AC-HRA-PAY (index.html) and AC HRA Portal (hra_portal_v2.html)
 * 首頁「全部同步／勾選同步」：每個模組用它自己的頁面（隱藏 iframe）跑一次雙向智慧同步，
 * 規則完全和模組頁的自動同步一樣（先下載合併、再只上傳變更、不會亂刪），只是從首頁一次做完。
 *
 *   HomeSync.mount(containerEl, {
 *     modules:[{id, page, key, kind:'hrpay'|'hra'|'benefits', name:{tc,en,km}}],
 *     lang:()=> 'tc'|'en'|'km', theme:'light'|'dark', storeKey:'…'
 *   });
 *   HomeSync.runAll() / HomeSync.runSelected() / HomeSync.refreshLang()
 */
(function (w) {
  'use strict';
  if (w.HomeSync) return;
  var doc = w.document, OPT = null, ROOT = null, RUNNING = false, STOP = false;
  var TIMEOUT = 8 * 60 * 1000, SETTLE = 1500;
  var T = {
    title: ['☁ 雲端同步', '☁ Cloud Sync', '☁ សមកាលកម្មពពក'],
    hint: ['雙向智慧同步：先下載雲端新資料合併，再上傳本機變更；只傳有變的部分，不會刪掉雲端資料。',
      'Two-way smart sync: downloads new cloud data first, then uploads local changes only. Cloud data is never wiped.',
      'សមកាលកម្មពីរទិស៖ ទាញយកទិន្នន័យថ្មីពីពពកមុន បន្ទាប់មកផ្ញើតែការផ្លាស់ប្តូរ។'],
    all: ['☁ 全部同步', '☁ Sync all', '☁ ទាំងអស់'],
    sel: ['☑ 同步勾選', '☑ Sync selected', '☑ ដែលបានជ្រើស'],
    pickAll: ['全選', 'All', 'ទាំងអស់'], pickNone: ['全不選', 'None', 'គ្មាន'],
    stop: ['■ 停止', '■ Stop', '■ ឈប់'],
    none: ['請先勾選要同步的模組', 'Select at least one module', 'សូមជ្រើសម៉ូឌុល'],
    busy: ['同步進行中，請稍候', 'Sync is running, please wait', 'កំពុងធ្វើសមកាលកម្ម'],
    wait: ['⏳ 等待', '⏳ Waiting', '⏳ រង់ចាំ'],
    open: ['🔄 開啟模組…', '🔄 Opening…', '🔄 កំពុងបើក…'],
    sync: ['🔄 同步中', '🔄 Syncing', '🔄 កំពុងធ្វើ'],
    synced: ['✅ 已同步', '✅ Synced', '✅ រួចរាល់'],
    checked: ['✅ 已檢查・無變更', '✅ Checked · no change', '✅ បានពិនិត្យ'],
    empty: ['⚪ 雲端與本機都沒有資料', '⚪ No data yet', '⚪ គ្មានទិន្នន័យ'],
    retry: ['⚠ 待重試', '⚠ Retry pending', '⚠ រង់ចាំព្យាយាមម្តងទៀត'],
    offline: ['📴 離線', '📴 Offline', '📴 គ្មានអ៊ីនធឺណិត'],
    timeout: ['⚠ 逾時（下次開啟會續傳）', '⚠ Timed out (resumes next time)', '⚠ អស់ពេល'],
    stopped: ['⏹ 已停止', '⏹ Stopped', '⏹ បានឈប់'],
    fail: ['⚠ 無法開啟模組', '⚠ Module did not open', '⚠ មិនអាចបើក'],
    done: ['同步完成：{ok} 個成功', 'Sync finished: {ok} OK', 'រួចរាល់៖ {ok}'],
    doneBad: ['同步完成：{ok} 個成功、{bad} 個需注意（看紅字）', 'Finished: {ok} OK, {bad} need attention', 'រួចរាល់៖ {ok} / {bad}'],
    last: ['上次', 'Last', 'ចុងក្រោយ']
  };
  var OK_STATES = { synced: 1, checked: 1, empty: 1 };
  function li() { var l = OPT && OPT.lang ? OPT.lang() : 'tc'; return l === 'en' ? 1 : l === 'km' ? 2 : 0; }
  function tx(k, vars) { var s = (T[k] || [k])[li()] || T[k][0]; Object.keys(vars || {}).forEach(function (v) { s = s.split('{' + v + '}').join(vars[v]); }); return s; }
  function nm(m) { var n = m.name || {}, l = ['tc', 'en', 'km'][li()]; return n[l] || n.en || n.tc || m.id; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(OPT.storeKey + ':' + k) || 'null'); localStorage.setItem(OPT.storeKey + ':' + k, JSON.stringify(v)); } catch (_) { return null; } }
  function hhmm(d) { d = d ? new Date(d) : new Date(); var p = function (n) { return ('0' + n).slice(-2); }; return p(d.getMonth() + 1) + '/' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }

  function css() {
    if (doc.getElementById('hs-css')) return;
    var s = doc.createElement('style'); s.id = 'hs-css';
    s.textContent =
      '.hs{border-radius:14px;padding:14px 16px;margin:14px 0;font-size:13px;line-height:1.45}' +
      '.hs.light{background:#fff;border:1px solid #e2e8f0;color:#1e293b}' +
      '.hs.dark{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);color:#e2e8f0}' +
      '.hs-top{display:flex;flex-wrap:wrap;align-items:center;gap:8px;justify-content:space-between}' +
      '.hs-title{font-weight:700;font-size:14px}' +
      '.hs-btns{display:flex;flex-wrap:wrap;gap:6px}' +
      '.hs button{border:0;border-radius:8px;padding:7px 12px;font-size:12px;font-weight:700;cursor:pointer}' +
      '.hs button:disabled{opacity:.5;cursor:default}' +
      '.hs .b-all{background:#2563eb;color:#fff}.hs .b-sel{background:#0f766e;color:#fff}.hs .b-stop{background:#dc2626;color:#fff}' +
      '.hs .b-mini{background:transparent;padding:3px 6px;font-weight:600;text-decoration:underline;color:inherit;opacity:.75}' +
      '.hs-hint{font-size:11px;opacity:.7;margin:6px 0 8px}' +
      '.hs-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:4px 14px}' +
      '.hs-row{display:flex;align-items:center;gap:8px;padding:5px 2px;border-bottom:1px dashed rgba(148,163,184,.3);min-width:0}' +
      '.hs-row input{width:16px;height:16px;flex-shrink:0}' +
      '.hs-name{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.hs-st{font-size:11px;white-space:nowrap;text-align:right;max-width:58%;overflow:hidden;text-overflow:ellipsis}' +
      '.hs-st.ok{color:#16a34a}.hs.dark .hs-st.ok{color:#4ade80}.hs-st.bad{color:#dc2626;font-weight:700}.hs.dark .hs-st.bad{color:#f87171}' +
      '.hs-st.run{color:#2563eb;font-weight:700}.hs.dark .hs-st.run{color:#93c5fd}.hs-st.old{opacity:.6}' +
      '.hs-sum{margin-top:8px;font-weight:700;font-size:12px}' +
      '@media(max-width:520px){.hs-list{grid-template-columns:1fr}.hs button{padding:7px 10px}}';
    doc.head.appendChild(s);
  }

  function render() {
    if (!ROOT) return;
    var sel = store('sel') || {}, last = store('last') || {};
    var h = '<div class="hs-top"><div class="hs-title">' + esc(tx('title')) + '</div><div class="hs-btns">' +
      '<button class="b-all" data-hs="all">' + esc(tx('all')) + '</button>' +
      '<button class="b-sel" data-hs="sel">' + esc(tx('sel')) + '</button>' +
      '<button class="b-stop" data-hs="stop" style="display:none">' + esc(tx('stop')) + '</button></div></div>' +
      '<div class="hs-hint">' + esc(tx('hint')) + ' <button class="b-mini" data-hs="pickAll">' + esc(tx('pickAll')) + '</button>' +
      '<button class="b-mini" data-hs="pickNone">' + esc(tx('pickNone')) + '</button></div><div class="hs-list">';
    OPT.modules.forEach(function (m) {
      var on = sel[m.id] !== false, l = last[m.id];
      var st = l ? '<span class="hs-st old ' + (OK_STATES[l.s] ? 'ok' : 'bad') + '">' + esc(tx('last')) + ' ' + esc(l.t) + ' ' + esc(tx(l.s).replace(/^\S+\s/, '')) + '</span>' : '<span class="hs-st"></span>';
      h += '<label class="hs-row"><input type="checkbox" data-id="' + esc(m.id) + '"' + (on ? ' checked' : '') + '><span class="hs-name">' + esc(nm(m)) + '</span>' +
        st.replace('class="hs-st', 'id="hs-st-' + esc(m.id) + '" class="hs-st') + '</label>';
    });
    h += '</div><div class="hs-sum" id="hs-sum"></div>';
    ROOT.innerHTML = h;
    ROOT.querySelectorAll('input[type=checkbox]').forEach(function (c) {
      c.onchange = function () { var s = store('sel') || {}; s[c.dataset.id] = c.checked; store('sel', s); };
    });
    ROOT.querySelector('[data-hs=all]').onclick = function () { api.runAll(); };
    ROOT.querySelector('[data-hs=sel]').onclick = function () { api.runSelected(); };
    ROOT.querySelector('[data-hs=stop]').onclick = function () { STOP = true; };
    ROOT.querySelector('[data-hs=pickAll]').onclick = function () { pick(true); };
    ROOT.querySelector('[data-hs=pickNone]').onclick = function () { pick(false); };
    busyUi(RUNNING);
  }
  function pick(v) { var s = {}; OPT.modules.forEach(function (m) { s[m.id] = v; }); store('sel', s); render(); }
  function busyUi(on) {
    if (!ROOT) return;
    ['all', 'sel'].forEach(function (k) { var b = ROOT.querySelector('[data-hs=' + k + ']'); if (b) b.disabled = on; });
    var s = ROOT.querySelector('[data-hs=stop]'); if (s) s.style.display = on ? '' : 'none';
    ROOT.querySelectorAll('input[type=checkbox]').forEach(function (c) { c.disabled = on; });
  }
  function setRow(id, cls, text) {
    var e = doc.getElementById('hs-st-' + id); if (!e) return;
    e.className = 'hs-st ' + (cls || ''); e.textContent = text; e.title = text;
  }
  function say(msg) { var e = doc.getElementById('hs-sum'); if (e) e.textContent = msg; if (OPT.onLog) try { OPT.onLog(msg); } catch (_) {} }

  // read the module page's own sync status inside the iframe
  function probe(cw, m) {
    try {
      if (m.kind === 'benefits') {
        var app = cw.HRPayBenefitsApp; if (!app || !app.cloud) return null;
        var c = app.cloud(); if (!c) return null;
        var map = { synced: 'synced', empty: 'empty', error: 'retry', offline: 'offline', pending: 'retry', syncing: 'syncing', checking: 'syncing' };
        return { state: c.busy ? 'syncing' : (map[c.state] || 'syncing'), detail: c.detail || '', lastRun: c.last || 0, final: !c.busy && c.last > 0 && c.state !== 'checking' };
      }
      var A = m.kind === 'hra' ? cw.HRAAutoSync : cw.HRPayAutoSync; if (!A || !A.state) return null;
      var s = A.state(m.key); if (!s) return null;
      return { state: s.state, detail: s.detail || '', lastRun: s.lastRun || 0, final: s.lastRun > 0 && /^(synced|checked|retry|offline)$/.test(s.state) };
    } catch (_) { return null; }
  }
  function runOne(m) {
    return new Promise(function (res) {
      var f = doc.createElement('iframe'), t0 = Date.now(), sig = '', since = 0, timer = null, ended = false;
      f.setAttribute('aria-hidden', 'true'); f.setAttribute('tabindex', '-1'); f.title = 'sync ' + m.id;
      f.style.cssText = 'position:fixed;left:-20000px;top:0;width:1280px;height:900px;border:0;opacity:0;pointer-events:none';
      f.src = m.page + (m.page.indexOf('?') >= 0 ? '&' : '?') + 'homesync=' + Date.now();
      function end(state, detail) {
        if (ended) return; ended = true; clearInterval(timer);
        setTimeout(function () { try { f.src = 'about:blank'; f.remove(); } catch (_) {} }, 400);
        res({ state: state, detail: detail || '' });
      }
      setRow(m.id, 'run', tx('open'));
      doc.body.appendChild(f);
      timer = setInterval(function () {
        if (STOP) return end('stopped');
        if (Date.now() - t0 > TIMEOUT) return end('timeout');
        var cw = null; try { cw = f.contentWindow; } catch (_) {}
        if (!cw) return;
        var st = probe(cw, m);
        if (!st) { if (Date.now() - t0 > 60000) end('fail'); return; }
        if (!st.final) { sig = ''; setRow(m.id, 'run', tx('sync') + (st.detail && st.state === 'syncing' ? ' · ' + st.detail : '…')); return; }
        var now = st.state + '|' + st.lastRun;
        if (now !== sig) { sig = now; since = Date.now(); return; }
        if (Date.now() - since >= SETTLE) end(st.state, st.detail);
      }, 400);
    });
  }
  async function run(list) {
    if (RUNNING) { say(tx('busy')); return false; }
    if (!list.length) { say(tx('none')); return false; }
    RUNNING = true; STOP = false; busyUi(true); say('');
    list.forEach(function (m) { setRow(m.id, '', tx('wait')); });
    var last = store('last') || {}, ok = 0, bad = 0;
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (STOP) { setRow(m.id, 'bad', tx('stopped')); continue; }
      var r = await runOne(m);
      var good = !!OK_STATES[r.state];
      if (good) ok++; else bad++;
      var label = tx(r.state) + (r.state === 'synced' && r.detail ? '' : (r.detail && !good ? ' · ' + r.detail : ''));
      setRow(m.id, good ? 'ok' : 'bad', label + ' ' + hhmm().slice(6));
      last[m.id] = { s: r.state, t: hhmm() }; store('last', last);
      if (OPT.onModuleDone) try { OPT.onModuleDone(m, r); } catch (_) {}
    }
    RUNNING = false; busyUi(false);
    say(bad ? tx('doneBad', { ok: ok, bad: bad }) : tx('done', { ok: ok }));
    if (OPT.onDone) try { OPT.onDone({ ok: ok, bad: bad }); } catch (_) {}
    return !bad;
  }
  var api = {
    version: '1.0',
    mount: function (el, opt) { OPT = opt; OPT.storeKey = OPT.storeKey || 'home-sync'; ROOT = el; css(); el.className = 'hs ' + (opt.theme || 'light'); render(); return api; },
    runAll: function () { return run(OPT.modules.slice()); },
    runSelected: function () { var s = store('sel') || {}; return run(OPT.modules.filter(function (m) { return s[m.id] !== false; })); },
    refreshLang: function () { if (!RUNNING) render(); },
    running: function () { return RUNNING; }
  };
  w.HomeSync = api;
})(window);
