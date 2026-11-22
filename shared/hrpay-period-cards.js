/* AC-HRA-PAY v3.9.34（2026-11-22）
   A. 卡片互動微變色（全平台頁面）：電腦滑鼠移入、手機手指按下時，卡片底色＋邊框柔和變色（淺藍／淺綠／粉紅／粉橘…輪替），
      電腦 150ms ease-out；手機只在按下時變色、放開就恢復（觸控裝置不會殘留 hover 顏色）。
   B. 薪資頁「期間報表」卡片版（只在 payroll.html 有 #rp-tbody 時啟用）：
      月卡／年卡＋點卡片跳出明細（KPI、近 12 個月趨勢可點、部門排行、底部月份膠囊、左右滑動切換），
      做法學 VRT 生產平台的卡片連動。原本的表格保留，可用「📋 表格」切回。
   只讀資料、只加顯示，不改任何計算、上傳、下載、核可。 */
(function (g) {
  'use strict';
  if (g.__hpPeriodCards) return; g.__hpPeriodCards = 1;
  var doc = g.document;
  var TINTS = [
    ['#eff6ff', '#93c5fd', 'rgba(96,165,250,.14)'],   // 淺藍
    ['#ecfdf5', '#6ee7b7', 'rgba(52,211,153,.14)'],   // 淺綠
    ['#fdf2f8', '#f9a8d4', 'rgba(244,114,182,.14)'],  // 粉紅
    ['#fff7ed', '#fdba74', 'rgba(251,146,60,.14)'],   // 粉橘
    ['#f5f3ff', '#c4b5fd', 'rgba(167,139,250,.14)'],  // 淺紫
    ['#f0fdfa', '#5eead4', 'rgba(45,212,191,.14)']    // 薄荷
  ];
  var TINT_SEL = 'a.card,.hp-pc,.hp-yc,[data-tint],.rounded-xl[onclick],.rounded-2xl[onclick]';

  function css() {
    if (doc.getElementById('hp-pc-css')) return;
    var t = '';
    TINTS.forEach(function (c, i) {
      var n = ':nth-child(6n+' + (i + 1) + ')';
      t += '.hp-tint' + n + '{--hp-tbg:' + c[0] + ';--hp-tbd:' + c[1] + ';--hp-tov:' + c[2] + '}';
    });
    t += '' +
      /* A 微變色 */
      '.hp-tint{transition:background-color 150ms ease-out,border-color 150ms ease-out,box-shadow 150ms ease-out}' +
      '@media (hover:hover) and (pointer:fine){.hp-tint:hover{background-color:var(--hp-tbg)!important;border-color:var(--hp-tbd)!important}}' +
      '@media (hover:none),(pointer:coarse){' +
            'a.card.hp-tint:hover{transform:none!important;box-shadow:none!important;border-color:var(--line,#e2e8f0)!important}' +
      'a.card.hp-tint:hover::before{opacity:0!important}' +
      '.hp-tint:active{background-color:var(--hp-tbg)!important;border-color:var(--hp-tbd)!important;transition:none}' +
      '}' +
      '.hp-darkzone .hp-tint:hover,.hp-darkzone .hp-tint:active{background-image:linear-gradient(var(--hp-tov),var(--hp-tov))!important;background-color:transparent!important}' +
      /* B 期間卡片 */
      '.hp-pv{display:flex;background:#f1f5f9;border-radius:8px;padding:2px}.hp-pv button{border:0;background:none;font-size:12px;padding:5px 10px;border-radius:6px;color:#64748b;cursor:pointer}.hp-pv button.on{background:#fff;color:#0369a1;font-weight:700;box-shadow:0 1px 2px rgba(0,0,0,.08)}' +
      '.hp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;padding:12px}' +
      '@media (max-width:520px){.hp-grid{grid-template-columns:1fr 1fr;gap:8px;padding:10px}}' +
      '.hp-pc,.hp-yc{position:relative;text-align:left;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:12px;cursor:pointer;font:inherit;color:#0f172a;-webkit-tap-highlight-color:transparent;min-width:0}' +
      '.hp-pc.act,.hp-yc.act{box-shadow:0 0 0 2px #0284c7 inset}' +
      '.hp-h{display:flex;justify-content:space-between;align-items:center;gap:6px}.hp-lb{font-weight:800;font-size:14px;white-space:nowrap}' +
      '.hp-chip{font-size:10px;font-weight:700;border-radius:999px;padding:2px 7px;white-space:nowrap}' +
      '.hp-ok{background:#dcfce7;color:#166534}.hp-adv{background:#fef3c7;color:#92400e}.hp-none{background:#f1f5f9;color:#64748b}' +
      '.hp-big{font:800 20px/1.15 ui-monospace,SFMono-Regular,Menlo,monospace;margin:8px 0 2px;color:#0369a1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.hp-sub{font-size:11.5px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.hp-bar{height:6px;background:#e2e8f0;border-radius:6px;margin-top:8px;overflow:hidden}.hp-bar>i{display:block;height:100%;border-radius:6px;background:#38bdf8}.hp-bar>i.a{background:#fbbf24}' +
      '.hp-chg{font-size:11px;font-weight:700;margin-top:6px;white-space:nowrap}' +
      '.hp-mini{display:flex;align-items:flex-end;gap:2px;height:28px;margin-top:8px}.hp-mini>i{flex:1;background:#bae6fd;border-radius:2px 2px 0 0;min-height:2px}.hp-mini>i.a{background:#fde68a}.hp-mini>i.z{background:#f1f5f9}' +
      /* 明細視窗 */
      '.hp-mask{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:2147482000;display:flex;align-items:flex-end;justify-content:center}' +
      '@media (min-width:760px){.hp-mask{align-items:center}}' +
      '.hp-sh{background:#f8fafc;width:100%;max-width:640px;max-height:92vh;border-radius:20px 20px 0 0;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 -10px 30px rgba(0,0,0,.25);animation:hpUp .22s ease-out}' +
      '@media (min-width:760px){.hp-sh{border-radius:20px}}@keyframes hpUp{from{transform:translateY(30px);opacity:0}to{transform:none;opacity:1}}' +
      '.hp-top,.hp-pills{flex:none}.hp-body{flex:1;min-height:0}.hp-top{background:#0f172a;color:#fff;padding:14px 16px;display:flex;align-items:center;gap:8px}.hp-top b{font-size:19px}.hp-top small{display:block;opacity:.7;font-size:12px;margin-top:2px}' +
      '.hp-top button{width:40px;height:40px;border-radius:50%;border:0;background:rgba(255,255,255,.12);color:#fff;font-size:18px;cursor:pointer}' +
      '.hp-body{overflow:auto;padding:12px 14px 6px;-webkit-overflow-scrolling:touch}' +
      '.hp-k{display:grid;grid-template-columns:1fr 1fr;gap:8px}.hp-kc{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:10px 12px;border-left:4px solid var(--c,#0ea5e9)}' +
      '.hp-kc b{display:block;font:800 19px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hp-kc span{font-size:11.5px;color:#64748b}' +
      '.hp-sec{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:10px 12px;margin-top:10px}.hp-sec h4{margin:0 0 8px;font-size:13px;color:#334155}' +
      '.hp-tr{display:flex;align-items:flex-end;gap:4px;height:110px}.hp-tr button{flex:1;border:0;background:none;padding:0;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:3px;cursor:pointer;min-width:0}' +
      '.hp-tr em.v{visibility:hidden;font-weight:700;color:#0369a1}.hp-tr button.on em.v{visibility:visible}@media (min-width:760px){.hp-tr em.v{visibility:visible;font-size:9px}}.hp-tr i{display:block;width:100%;background:#7dd3fc;border-radius:4px 4px 0 0;min-height:3px}.hp-tr i.a{background:#fcd34d}.hp-tr button.on i{background:#0284c7}.hp-tr button.on i.a{background:#d97706}.hp-tr em{font-style:normal;font-size:9.5px;color:#64748b;white-space:nowrap}' +
      '.hp-dr{display:grid;grid-template-columns:minmax(70px,34%) 1fr 100px;gap:8px;align-items:center;font-size:12px;margin:5px 0}.hp-dr .t{height:10px;background:#e2e8f0;border-radius:6px;overflow:hidden}.hp-dr .t i{display:block;height:100%;background:#38bdf8;border-radius:6px}' +
      '.hp-dr .n{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#334155}.hp-dr .v{font:700 11.5px ui-monospace,monospace;white-space:nowrap}' +
      '.hp-go{display:block;width:100%;margin:12px 0 4px;border:0;border-radius:12px;padding:12px;background:#0369a1;color:#fff;font-weight:700;font-size:14px;cursor:pointer}' +
      '.hp-pills{display:flex;gap:8px;overflow-x:auto;padding:10px 12px;background:#fff;border-top:1px solid #e2e8f0;scrollbar-width:none}.hp-pills::-webkit-scrollbar{display:none}' +
      '.hp-pills button{flex:none;border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:8px 14px;font-size:13px;font-weight:600;color:#334155;cursor:pointer}.hp-pills button.on{background:#4f46e5;border-color:#4f46e5;color:#fff}' +
      '.hp-note{font-size:11.5px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:7px 10px;margin-top:8px}';
    var s = doc.createElement('style'); s.id = 'hp-pc-css'; s.textContent = t; (doc.head || doc.documentElement).appendChild(s);
  }

  /* A：幫卡片加上微變色 class（之後畫出來的卡片也會補上） */
  function tintScan(root) {
    try {
      Array.prototype.forEach.call((root || doc).querySelectorAll(TINT_SEL), function (el) { if (!el.classList.contains('hp-tint')) el.classList.add('hp-tint'); });
    } catch (_) {}
  }

  /* ───────── B：期間報表卡片 ───────── */
  var ok = function () { return typeof STORE !== 'undefined' && typeof periodStats === 'function' && doc.getElementById('rp-tbody'); };
  var VIEW = 'card'; try { VIEW = localStorage.getItem('hp_period_view') || 'card'; } catch (_) {}
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var money = function (n) { return '$' + (typeof fmt === 'function' ? fmt(n) : (Math.round(n * 100) / 100).toLocaleString()); };
  var short = function (n) { n = Math.abs(n); return '$' + (n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : Math.round(n)); };
  var tt = function (zh, en) { return typeof T === 'function' ? T(zh, en) : zh; };
  var keys = function () { return sortedPeriods(); };                 // 舊 → 新
  var lab = function (k) { return typeof labelFromKey === 'function' ? labelFromKey(k) : k; };
  var capMode = function () { return typeof COST_MODE !== 'undefined' && COST_MODE === 'cap'; };
  function st(k) { var s = periodStats(STORE[k]); s.k = k; s.adv = !s.hasPay && s.hasAdv; s.val = capMode() ? s.total / (s.head || 1) : s.total; s.pc = s.total / (s.head || 1); return s; }
  function rowsOf(e) {
    var pay = e.payrollRecords || [], adv = e.advanceRecords || [], src = typeof COST_SRC !== 'undefined' ? COST_SRC : 'pay';
    var r = src === 'adv' ? adv : src === 'both' ? pay.concat(adv) : (pay.length ? pay : adv);
    var d = doc.getElementById('cost-dept'); d = d ? d.value : ''; return d ? r.filter(function (x) { return x.dept === d; }) : r;
  }
  function chg(cur, prev, sameType) {
    if (!prev || !sameType || !(prev.val > 0)) return '<div class="hp-chg" style="color:#94a3b8">— ' + tt('不比較', 'n/a') + '</div>';
    var p = (cur.val - prev.val) / prev.val * 100, a = Math.abs(p), c = a <= 5 ? '#16a34a' : a <= 15 ? '#ca8a04' : '#dc2626', l = a <= 5 ? '🟢' : a <= 15 ? '🟡' : '🔴';
    return '<div class="hp-chg" style="color:' + c + '">' + l + ' ' + (p >= 0 ? '▲ +' : '▼ ') + p.toFixed(1) + '% ' + tt('vs 上月', 'vs prev') + '</div>';
  }
  var wrapTable = function () { var tb = doc.getElementById('rp-tbody'); return tb && tb.closest('.overflow-x-auto'); };

  function mountUi() {
    var tw = wrapTable(); if (!tw) return null;
    var box = doc.getElementById('hp-pcards');
    if (!box) {
      box = doc.createElement('div'); box.id = 'hp-pcards'; tw.parentNode.insertBefore(box, tw);
      var cnt = doc.getElementById('rp-count');
      if (cnt && !doc.getElementById('hp-pv')) {
        var pv = doc.createElement('div'); pv.id = 'hp-pv'; pv.className = 'hp-pv no-print';
        pv.innerHTML = '<button type="button" data-v="card">🗂 ' + tt('卡片', 'Cards') + '</button><button type="button" data-v="table">📋 ' + tt('表格', 'Table') + '</button>';
        cnt.parentNode.insertBefore(pv, cnt.nextSibling);
        pv.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; VIEW = b.getAttribute('data-v'); try { localStorage.setItem('hp_period_view', VIEW); } catch (_) {} render(); });
      }
    }
    return { box: box, tw: tw };
  }

  function render() {
    if (!ok()) return;
    var u = mountUi(); if (!u) return;
    var pv = doc.getElementById('hp-pv');
    if (pv) Array.prototype.forEach.call(pv.children, function (b) { b.classList.toggle('on', b.getAttribute('data-v') === VIEW); });
    u.tw.style.display = VIEW === 'card' ? 'none' : '';
    u.box.style.display = VIEW === 'card' ? '' : 'none';
    if (VIEW !== 'card') return;
    var ks = keys(), mode = typeof REPORT_MODE !== 'undefined' ? REPORT_MODE : 'month';
    if (!ks.length) { u.box.innerHTML = '<div style="padding:24px;text-align:center;color:#94a3b8;font-size:13px">' + tt('尚無資料', 'No data') + '</div>'; return; }
    var S = ks.map(st), act = (typeof ACTIVE !== 'undefined' && ACTIVE) ? ACTIVE.periodKey : '';
    if (mode === 'month') {
      var mxP = Math.max.apply(null, S.filter(function (s) { return !s.adv; }).map(function (s) { return s.val; }).concat([1]));
      var mxA = Math.max.apply(null, S.filter(function (s) { return s.adv; }).map(function (s) { return s.val; }).concat([1]));
      var html = S.map(function (s, i) {
        var prev = S[i - 1], same = prev && prev.adv === s.adv;
        var chip = s.hasPay ? '<span class="hp-chip hp-ok">' + tt('正式', 'Final') + '</span>' : s.hasAdv ? '<span class="hp-chip hp-adv">' + tt('只有預付', 'Advance only') + '</span>' : '<span class="hp-chip hp-none">—</span>';
        return '<button type="button" class="hp-pc' + (s.k === act ? ' act' : '') + '" data-k="' + s.k + '">' +
          '<div class="hp-h"><span class="hp-lb">' + esc(lab(s.k)) + '</span>' + chip + '</div>' +
          '<div class="hp-big">' + money(s.val) + '</div>' +
          '<div class="hp-sub">👥 ' + s.head + ' · ' + tt('人均', 'Avg') + ' ' + short(s.pc) + '</div>' +
          '<div class="hp-bar"><i class="' + (s.adv ? 'a' : '') + '" style="width:' + Math.max(3, Math.round(s.val / (s.adv ? mxA : mxP) * 100)) + '%"></i></div>' +
          chg(s, prev, same) + '</button>';
      }).reverse().join('');
      u.box.innerHTML = '<div class="hp-grid">' + html + '</div>';
    } else {
      var Y = years(S), ys = Object.keys(Y).sort().reverse(), mxY = Math.max.apply(null, ys.map(function (y) { return Y[y].total; }).concat([1]));
      u.box.innerHTML = '<div class="hp-grid">' + ys.map(function (y) {
        var v = Y[y], pv2 = Y[String(+y - 1)], avgM = v.total / (v.n || 1), mm = 1;
        for (var m = 1; m <= 12; m++) { var s0 = v.m[m]; if (s0 && s0.val > mm) mm = s0.val; }
        var bars = ''; for (var m2 = 1; m2 <= 12; m2++) { var s1 = v.m[m2]; bars += s1 ? '<i class="' + (s1.adv ? 'a' : '') + '" style="height:' + Math.max(8, Math.round(s1.val / mm * 100)) + '%"></i>' : '<i class="z" style="height:8%"></i>'; }
        var yoy = pv2 && pv2.n ? (avgM - pv2.total / pv2.n) / (pv2.total / pv2.n) * 100 : null;
        return '<button type="button" class="hp-yc" data-y="' + y + '"><div class="hp-h"><span class="hp-lb">' + y + '</span><span class="hp-chip hp-none">' + v.n + ' ' + tt('個月', 'mo') + '</span></div>' +
          '<div class="hp-big">' + short(v.total) + '</div><div class="hp-sub">' + tt('月平均', 'Mo avg') + ' ' + short(avgM) + ' · 👥 ' + Math.round(v.head / (v.n || 1)) + '</div>' +
          '<div class="hp-mini">' + bars + '</div>' +
          (yoy == null ? '<div class="hp-chg" style="color:#94a3b8">— ' + tt('無去年可比', 'no prior year') + '</div>' : '<div class="hp-chg" style="color:' + (Math.abs(yoy) <= 5 ? '#16a34a' : Math.abs(yoy) <= 15 ? '#ca8a04' : '#dc2626') + '">' + (yoy >= 0 ? '▲ +' : '▼ ') + yoy.toFixed(1) + '% ' + tt('月平均 vs 去年', 'mo avg vs prior yr') + '</div>') +
          '</button>';
      }).join('') + '</div>';
    }
    tintScan(u.box);
  }
  function years(S) { var Y = {}; S.forEach(function (s) { var y = s.k.slice(0, 4), m = +s.k.slice(5, 7); var v = Y[y] || (Y[y] = { n: 0, total: 0, head: 0, m: {} }); v.n++; v.total += s.val; v.head += s.head; v.m[m] = s; }); return Y; }

  /* 明細視窗 */
  var cur = null, curY = null;
  function close() { var m = doc.getElementById('hp-mask'); if (m) m.remove(); doc.removeEventListener('keydown', onKey); }
  function onKey(e) { if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft') step(-1); else if (e.key === 'ArrowRight') step(1); }
  function step(d) { if (curY) { var ys = Object.keys(years(keys().map(st))).sort(), i = ys.indexOf(curY) + d; if (i >= 0 && i < ys.length) openYear(ys[i]); return; } var ks = keys(), j = ks.indexOf(cur) + d; if (j >= 0 && j < ks.length) openMonth(ks[j]); }
  function shell(title, sub, body, pills) {
    var m = doc.getElementById('hp-mask'), keepScroll = 0;
    if (!m) {
      m = doc.createElement('div'); m.id = 'hp-mask'; m.className = 'hp-mask no-print';
      m.addEventListener('click', function (e) {
        if (e.target === m) return close();
        var b = e.target.closest('[data-act]'); if (!b) return;
        var a = b.getAttribute('data-act'), v = b.getAttribute('data-v');
        if (a === 'x') close(); else if (a === 'p') step(-1); else if (a === 'n') step(1);
        else if (a === 'm') openMonth(v); else if (a === 'y') openYear(v);
        else if (a === 'go') { close(); if (typeof jumpPeriod === 'function') jumpPeriod(v); }
      });
      var sx = null; m.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
      m.addEventListener('touchend', function (e) { if (sx == null) return; var dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 70 && !e.target.closest('.hp-pills,.hp-tr')) step(dx < 0 ? 1 : -1); sx = null; }, { passive: true });
      doc.body.appendChild(m); doc.addEventListener('keydown', onKey);
    } else { var ob = m.querySelector('.hp-body'); keepScroll = 0; if (ob) ob.scrollTop = 0; }
    m.innerHTML = '<div class="hp-sh" role="dialog"><div class="hp-top"><div style="flex:1;min-width:0"><b>' + esc(title) + '</b><small>' + sub + '</small></div>' +
      '<button type="button" data-act="p" aria-label="prev">‹</button><button type="button" data-act="n" aria-label="next">›</button><button type="button" data-act="x" aria-label="close">✕</button></div>' +
      '<div class="hp-body">' + body + '</div><div class="hp-pills">' + pills + '</div></div>';
    var on = m.querySelector('.hp-pills .on'); if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' });
  }
  function kc(label, val, color, extra) { return '<div class="hp-kc" style="--c:' + color + '"><span>' + label + '</span><b>' + val + '</b>' + (extra ? '<span>' + extra + '</span>' : '') + '</div>'; }
  /* 長條高度：從最低值的 6 成起算，差異看得出來（標籤上有實際金額） */
  function hgt(v, mn, mx) { var base = Math.max(0, mn * 0.6); return Math.max(6, Math.round((v - base) / ((mx - base) || 1) * 72)); }
  function pct(a, b) { if (!(b > 0)) return null; return (a - b) / b * 100; }
  function pctTxt(p) { return p == null ? '—' : (p >= 0 ? '+' : '') + p.toFixed(1) + '%'; }
  function openMonth(k) {
    if (!STORE[k]) return; cur = k; curY = null;
    var ks = keys(), i = ks.indexOf(k), s = st(k), prev = i > 0 ? st(ks[i - 1]) : null, ly = STORE[(+k.slice(0, 4) - 1) + k.slice(4)] ? st((+k.slice(0, 4) - 1) + k.slice(4)) : null;
    var same = prev && prev.adv === s.adv, pM = same ? pct(s.val, prev.val) : null, pY = ly && ly.adv === s.adv ? pct(s.val, ly.val) : null;
    var col = function (p) { return p == null ? '#94a3b8' : Math.abs(p) <= 5 ? '#16a34a' : Math.abs(p) <= 15 ? '#ca8a04' : '#dc2626'; };
    var WD = typeof WORK_DAYS !== 'undefined' ? WORK_DAYS : 26, WH = typeof WORK_HRS !== 'undefined' ? WORK_HRS : 8;
    var body = '<div class="hp-k">' +
      kc(capMode() ? tt('人均月成本', 'Per-capita / mo') : tt('月成本', 'Monthly cost'), money(s.val), '#0ea5e9', s.adv ? tt('只有預付（未含月結）', 'Advance only') : tt('正式薪資', 'Final payroll')) +
      kc(tt('人數', 'Headcount'), s.head, '#6366f1', prev ? (s.head - prev.head >= 0 ? '+' : '') + (s.head - prev.head) + ' ' + tt('vs 上月', 'vs prev') : '') +
      kc(tt('vs 上月', 'vs prev month'), '<span style="color:' + col(pM) + '">' + pctTxt(pM) + '</span>', col(pM), same ? (s.val - prev.val >= 0 ? '+' : '−') + short(s.val - prev.val) : tt('預付／正式不比較', 'different file type')) +
      kc(tt('vs 去年同月', 'vs same month LY'), '<span style="color:' + col(pY) + '">' + pctTxt(pY) + '</span>', col(pY), ly ? lab(ly.k) + ' ' + short(ly.val) : tt('沒有去年資料', 'no data')) +
      '</div>';
    if (s.adv) body += '<div class="hp-note">⚠️ ' + tt('這個月只有預付薪資檔，金額只有約半個月，不能跟正式月份直接比較；月結檔上傳後會自動更新。', 'Advance file only — about half a month; not comparable with final months.') + '</div>';
    body += '<div class="hp-sec"><h4>🕐 ' + tt('時間換算', 'Time units') + '</h4><div class="hp-k">' +
      kc(tt('每小時', 'Hourly'), money(s.val / (WD * WH)), '#14b8a6') + kc(tt('每日', 'Daily'), money(s.val / WD), '#14b8a6') +
      kc(tt('每週', 'Weekly'), money(s.val / 4.33), '#14b8a6') + kc(tt('年化', 'Yearly'), short(s.val * 12), '#14b8a6') + '</div></div>';
    /* 近 12 個月趨勢（可點） */
    var from = Math.max(0, i - 11), seg = ks.slice(from, Math.max(i + 1, Math.min(ks.length, from + 12))), SS = seg.map(st), mx = Math.max.apply(null, SS.map(function (x) { return x.val; }).concat([1])), mn = Math.min.apply(null, SS.map(function (x) { return x.val; }));
    body += '<div class="hp-sec"><h4>📈 ' + tt('近 12 個月（點長條切換月份；黃色＝只有預付）', 'Last 12 months (tap to switch; amber = advance only)') + '</h4><div class="hp-tr">' +
      SS.map(function (x) { return '<button type="button" data-act="m" data-v="' + x.k + '" class="' + (x.k === k ? 'on' : '') + '" title="' + esc(lab(x.k)) + ' ' + money(x.val) + '"><em class="v">' + short(x.val) + '</em><i class="' + (x.adv ? 'a' : '') + '" style="height:' + hgt(x.val, mn, mx) + '%"></i><em>' + x.k.slice(2, 4) + '/' + x.k.slice(5, 7) + '</em></button>'; }).join('') + '</div></div>';
    /* 部門排行 */
    var dm = {}; rowsOf(STORE[k]).forEach(function (r) { var d = r.dept || 'Other', v = dm[d] || (dm[d] = { n: 0, t: 0 }); v.n++; v.t += Math.abs(typeof N === 'function' ? N(r.totalSalary) : +r.totalSalary || 0); });
    var dl = Object.keys(dm).map(function (d) { return [d, dm[d]]; }).sort(function (a, b) { return b[1].t - a[1].t; }), dmx = dl.length ? dl[0][1].t : 1;
    if (dl.length) body += '<div class="hp-sec"><h4>🏭 ' + tt('部門成本排行', 'Departments by cost') + '（' + dl.length + '）</h4>' + dl.slice(0, 10).map(function (a) {
      return '<div class="hp-dr"><span class="n">' + esc(a[0]) + '</span><span class="t"><i style="width:' + Math.max(3, Math.round(a[1].t / dmx * 100)) + '%"></i></span><span class="v">' + short(a[1].t) + ' · ' + a[1].n + '</span></div>';
    }).join('') + (dl.length > 10 ? '<div class="hp-sub" style="margin-top:4px">… ' + tt('其他', 'others') + ' ' + (dl.length - 10) + '</div>' : '') + '</div>';
    body += '<button type="button" class="hp-go" data-act="go" data-v="' + k + '">📊 ' + tt('切換到這個月份，看完整分析', 'Open this month in full analysis') + '</button>';
    var pills = ks.slice().reverse().map(function (x) { return '<button type="button" data-act="m" data-v="' + x + '" class="' + (x === k ? 'on' : '') + '">' + esc(lab(x)) + '</button>'; }).join('');
    shell(lab(k), (ks.length - i) + ' / ' + ks.length + ' · ' + (s.adv ? tt('只有預付', 'Advance only') : tt('正式', 'Final')), body, pills);
  }
  function openYear(y) {
    var S = keys().map(st), Y = years(S), v = Y[y]; if (!v) return; cur = null; curY = y;
    var ys = Object.keys(Y).sort(), pv = Y[String(+y - 1)], avgM = v.total / (v.n || 1), pY = pv && pv.n ? pct(avgM, pv.total / pv.n) : null, mx = 1;
    var mn = Infinity; for (var m = 1; m <= 12; m++) if (v.m[m]) { if (v.m[m].val > mx) mx = v.m[m].val; if (v.m[m].val < mn) mn = v.m[m].val; }
    var body = '<div class="hp-k">' + kc(tt('年度合計', 'Year total'), short(v.total), '#0ea5e9', v.n + ' ' + tt('個月', 'months')) + kc(tt('月平均', 'Monthly avg'), short(avgM), '#6366f1') +
      kc(tt('平均人數', 'Avg headcount'), Math.round(v.head / (v.n || 1)), '#a855f7') + kc(tt('月平均 vs 去年', 'Mo avg vs prior yr'), pctTxt(pY), pY == null ? '#94a3b8' : Math.abs(pY) <= 5 ? '#16a34a' : Math.abs(pY) <= 15 ? '#ca8a04' : '#dc2626', pv ? (+y - 1) + ' ' + tt('月平均', 'mo avg') + ' ' + short(pv.total / pv.n) : tt('沒有去年資料', 'no data')) + '</div>';
    body += '<div class="hp-sec"><h4>📅 ' + tt('各月份（點長條看該月明細；黃色＝只有預付）', 'Months (tap for detail; amber = advance only)') + '</h4><div class="hp-tr">';
    for (var m2 = 1; m2 <= 12; m2++) { var s = v.m[m2]; body += s ? '<button type="button" data-act="m" data-v="' + s.k + '"><em class="v">' + short(s.val) + '</em><i class="' + (s.adv ? 'a' : '') + '" style="height:' + hgt(s.val, mn, mx) + '%"></i><em>' + m2 + '月</em></button>' : '<button type="button" disabled style="cursor:default"><em>&nbsp;</em><i style="height:3%;background:#f1f5f9"></i><em>' + m2 + '月</em></button>'; }
    body += '</div></div>';
    if (Object.keys(v.m).some(function (mm) { return v.m[mm].adv; })) body += '<div class="hp-note">⚠️ ' + tt('有月份只有預付檔（黃色），年度合計會偏低。', 'Some months are advance-only (amber); the year total is understated.') + '</div>';
    var pills = ys.slice().reverse().map(function (x) { return '<button type="button" data-act="y" data-v="' + x + '" class="' + (x === y ? 'on' : '') + '">' + x + '</button>'; }).join('');
    shell(y + ' ' + tt('年', ''), (ys.indexOf(y) + 1) + ' / ' + ys.length, body, pills);
  }

  function hook() {
    if (!ok()) return false;
    if (!g.__hpPcHooked) {
      g.__hpPcHooked = 1;
      try { var orig = renderReport; renderReport = function () { var r = orig.apply(this, arguments); try { render(); } catch (e) { console.warn('[period cards]', e); } return r; }; } catch (e) { console.warn('[period cards hook]', e); }
      doc.addEventListener('click', function (e) {
        var c = e.target.closest && e.target.closest('#hp-pcards .hp-pc,#hp-pcards .hp-yc'); if (!c) return;
        if (c.hasAttribute('data-k')) openMonth(c.getAttribute('data-k')); else openYear(c.getAttribute('data-y'));
      });
    }
    render(); return true;
  }

  function init() {
    css(); tintScan();
    /* iOS 需要有 touch 監聽，:active 才會在手指按下時生效 */
    doc.addEventListener('touchstart', function () {}, { passive: true });
    var pend = false; try { new MutationObserver(function () { if (pend) return; pend = true; g.requestAnimationFrame(function () { pend = false; tintScan(); }); }).observe(doc.body, { childList: true, subtree: true }); } catch (_) {}
    if (!hook()) { var n = 0, t = setInterval(function () { if (hook() || ++n > 20) clearInterval(t); }, 500); }
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
  g.HRPayPeriodCards = { render: render, openMonth: function (k) { openMonth(k); }, openYear: function (y) { openYear(y); } };
})(window);
