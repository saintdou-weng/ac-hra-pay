/* 表格搜尋＋手機排版 v1.0（2026-11-06）— HRA-PAY、HRA Portal、VRT HR（PSJHR）內嵌頁共用
 * 1) 右下角「🔍」：打工號或姓名，頁面上所有表格只留符合的列（工號打 78 也找得到 0078；沒有完全相同的工號才改成包含）。
 *    表格重畫（換月份、匯入）後自動再篩一次；清空就全部顯示。
 * 2) 手機（寬度 < 760px）：表格太寬就自己左右滑、第一欄不准佔超過四成寬；
 *    最上面那排（標題、語言切換、按鈕）放不下就自動換行，不會跑出畫面外。
 * 只改畫面，不動資料、不改任何計算。
 */
(function (g) {
  'use strict';
  if (g.__tableFind) return; g.__tableFind = 1;
  var doc = g.document;
  function lang() { try { var l = localStorage.getItem('ac_hra_lang') || localStorage.getItem('hra_lang') || localStorage.getItem('hrpay_lang') || doc.documentElement.lang || ''; return /^en/i.test(l) ? 'en' : /^km/i.test(l) ? 'km' : 'zh'; } catch (_) { return 'zh'; } }
  function L(zh, en, km) { var l = lang(); return l === 'en' ? en : l === 'km' ? km : zh; }
  var css = '' +
    '#tf-btn{position:fixed;right:14px;bottom:14px;z-index:2147483000;border:0;border-radius:22px;padding:10px 14px;font:600 15px system-ui,sans-serif;background:#0f766e;color:#fff;box-shadow:0 4px 14px rgba(0,0,0,.25);cursor:pointer}' +
    '#tf-bar{position:fixed;left:8px;right:8px;bottom:12px;z-index:2147483001;display:none;gap:6px;align-items:center;background:#fff;border:1px solid #cbd5e1;border-radius:14px;padding:8px;box-shadow:0 6px 20px rgba(0,0,0,.22);max-width:560px;margin:0 auto}' +
    '#tf-bar.on{display:flex}#tf-bar input{flex:1;min-width:0;font:16px system-ui,sans-serif;padding:8px 10px;border:1px solid #94a3b8;border-radius:10px}' +
    '#tf-bar span{font:13px system-ui,sans-serif;color:#475569;white-space:nowrap}#tf-bar button{border:0;background:#e2e8f0;border-radius:10px;padding:8px 10px;font:15px system-ui,sans-serif;cursor:pointer}' +
    'tr.tf-hide{display:none!important}tr.tf-hit>td{background:rgba(250,204,21,.18)!important}' +
    '@media (max-width:760px){' +
    ' .tf-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:100%}' +
    ' table{font-size:12.5px}' +
    ' table th:first-child,table td:first-child{max-width:40vw;white-space:normal!important;word-break:break-word;overflow-wrap:anywhere}' +
    ' .tf-flexwrap{flex-wrap:wrap!important;row-gap:6px}' +
    ' .tf-shrink{min-width:0!important;max-width:100%!important}' +
    ' input,select,textarea,button{max-width:100%!important;box-sizing:border-box!important}' +
    ' img,video,canvas,svg{max-width:100%}' +
    ' .tf-fit{max-width:100%!important;box-sizing:border-box!important;min-width:0!important}' +
    ' html,body{max-width:100%;overflow-x:hidden}' +
    '}';
  var st = doc.createElement('style'); st.id = 'tf-css'; st.textContent = css;
  var q = '', bar = null, inp = null, cnt = null, btn = null;
  function norm(s) { return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase(); }
  function rowsOf(t) { var b = t.tBodies && t.tBodies.length ? Array.prototype.slice.call(t.tBodies).reduce(function (a, x) { return a.concat(Array.prototype.slice.call(x.rows)); }, []) : Array.prototype.slice.call(t.rows).slice(1); return b; }
  function apply() {
    var tables = doc.querySelectorAll('table'); var shown = 0, total = 0; var qq = norm(q); var digits = /^\d+$/.test(qq) ? qq.replace(/^0+/, '') : null;
    for (var i = 0; i < tables.length; i++) {
      var rows = rowsOf(tables[i]); if (rows.length < 2) continue;
      var exact = [];
      if (digits) for (var r = 0; r < rows.length; r++) { var cs = rows[r].cells; for (var c = 0; c < cs.length; c++) { var tx = norm(cs[c].textContent); if (tx && /^\d+$/.test(tx) && tx.replace(/^0+/, '') === digits) { exact.push(rows[r]); break; } } }
      for (var k = 0; k < rows.length; k++) {
        var row = rows[k]; if (row.querySelector('th') && !row.querySelector('td')) continue; total++;
        var hit = !qq || (digits && exact.length ? exact.indexOf(row) >= 0 : norm(row.textContent).indexOf(qq) >= 0);
        row.classList.toggle('tf-hide', !hit); row.classList.toggle('tf-hit', !!qq && hit); if (hit) shown++;
      }
    }
    if (cnt) cnt.textContent = qq ? shown + ' / ' + total : '';
  }
  var pend = 0; function later() { if (pend) return; pend = setTimeout(function () { pend = 0; if (q) apply(); mobile(); }, 250); }
  function mobile() {
    if ((g.innerWidth || 1000) >= 760) return;
    var tables = doc.querySelectorAll('table');
    for (var i = 0; i < tables.length; i++) {
      var t = tables[i], p = t.parentElement; if (!p || p.classList.contains('tf-wrap')) continue;
      var cs = g.getComputedStyle(p); if (/(auto|scroll)/.test(cs.overflowX)) continue;
      if (t.scrollWidth > p.clientWidth + 4) { var w = doc.createElement('div'); w.className = 'tf-wrap'; p.insertBefore(w, t); w.appendChild(t); }
    }
    // 上面那排（標題、語言、按鈕）超出畫面就換行
    var vw = doc.documentElement.clientWidth; var els = doc.querySelectorAll('header,nav,header *,nav *,body>div,body>div>div,body>div>div>div,.topbar,.toolbar');
    for (var j = 0; j < els.length && j < 400; j++) {
      var el = els[j]; var r = el.getBoundingClientRect(); if (r.top > 260 || r.height === 0 || r.height > 160) continue;
      var d = g.getComputedStyle(el).display; if (!/flex/.test(d)) continue;
      if (el.scrollWidth > el.clientWidth + 2 || r.right > vw + 2) { el.classList.add('tf-flexwrap'); Array.prototype.forEach.call(el.children, function (ch) { ch.classList.add('tf-shrink'); }); }
    }
    // 其他超出畫面寬度的東西（固定寬度的輸入框、區塊）縮到畫面內；表格已經包在可左右滑的框裡，不動
    var all = doc.body.querySelectorAll('*');
    for (var k = 0; k < all.length && k < 6000; k++) {
      var x = all[k]; if (x.closest && (x.closest('.tf-wrap') || x.closest('table') || x.closest('#tf-bar'))) continue;
      var rr = x.getBoundingClientRect(); if (!rr.width || rr.right <= vw + 1 || rr.left < -1) continue;
      var dd = g.getComputedStyle(x); if (/(auto|scroll)/.test(dd.overflowX)) continue;
      if (/flex/.test(dd.display)) x.classList.add('tf-flexwrap');
      x.classList.add('tf-fit');
    }
  }
  function ui() {
    if (!doc.body || doc.getElementById('tf-btn')) return;
    if (!doc.getElementById('tf-css')) (doc.head || doc.documentElement).appendChild(st);
    btn = doc.createElement('button'); btn.id = 'tf-btn'; btn.type = 'button'; btn.textContent = '🔍'; btn.title = L('搜尋工號／姓名', 'Search ID / name', 'ស្វែងរកលេខ / ឈ្មោះ');
    bar = doc.createElement('div'); bar.id = 'tf-bar';
    bar.innerHTML = '<input type="search" inputmode="search" autocomplete="off"><span></span><button type="button">✕</button>';
    inp = bar.querySelector('input'); cnt = bar.querySelector('span'); inp.placeholder = L('工號或姓名…', 'Employee ID or name…', 'លេខបុគ្គលិក ឬ ឈ្មោះ…');
    btn.onclick = function () { bar.classList.add('on'); btn.style.display = 'none'; inp.focus(); };
    bar.querySelector('button').onclick = function () { q = ''; inp.value = ''; apply(); bar.classList.remove('on'); btn.style.display = ''; };
    inp.oninput = function () { q = inp.value; apply(); };
    doc.body.appendChild(btn); doc.body.appendChild(bar);
    try { new MutationObserver(function (m) { for (var i = 0; i < m.length; i++) { var t = m[i].target; if (t && (t.id === 'tf-bar' || (t.closest && t.closest('#tf-bar')))) continue; later(); return; } }).observe(doc.body, { childList: true, subtree: true }); } catch (_) {}
    g.addEventListener('resize', later); mobile(); setTimeout(mobile, 1200);
  }
  if (doc.body) ui(); else doc.addEventListener('DOMContentLoaded', ui);
  // 頁面整個重畫 <body>（切換語言）時補回來
  setInterval(function () { if (doc.body && !doc.getElementById('tf-btn')) ui(); }, 1500);
  g.TableFind = { set: function (v) { q = String(v || ''); if (inp) inp.value = q; apply(); }, apply: apply };
})(window);
