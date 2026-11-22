/* AC-HRA-PAY v3.9.35（2026-11-22）薪資頁「期間報表」卡片版（只在 payroll.html 有 #rp-tbody 時啟用）
   月卡／年卡；點卡片開明細，明細分 4 個分頁：📊 概要｜🏭 部門｜📈 趨勢｜👥 人員（點部門會帶到該部門的人員）。
   - 沒有資料的月份（0 人）不列；每人平均不到 $20 的月份標「金額異常」，不拿來比較、不放進趨勢圖。
   - 明細視窗加 data-noswipe：在視窗裡左右滑只換月份，不會讓後面的頁面跳到別的分頁。
   卡片微變色交給共用 ui-fx.js（卡片標 data-fx="card"）。原本的表格保留，可用「📋 表格」切回。只讀資料、只加顯示。 */
(function (g) {
  'use strict';
  if (g.__hpPeriodCards) return; g.__hpPeriodCards = 1;
  var doc = g.document;

  function css() {
    if (doc.getElementById('hp-pc-css')) return;
    var t = '' +
      '.hp-pv{display:flex;background:#f1f5f9;border-radius:8px;padding:2px}.hp-pv button{border:0;background:none;font-size:12px;padding:5px 10px;border-radius:6px;color:#64748b;cursor:pointer}.hp-pv button.on{background:#fff;color:#0369a1;font-weight:700;box-shadow:0 1px 2px rgba(0,0,0,.08)}' +
      '.hp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;padding:12px}' +
      '@media (max-width:520px){.hp-grid{grid-template-columns:1fr 1fr;gap:8px;padding:10px}}' +
      '.hp-pc,.hp-yc{position:relative;text-align:left;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:12px;cursor:pointer;font:inherit;color:#0f172a;-webkit-tap-highlight-color:transparent;min-width:0}' +
      '.hp-pc.act,.hp-yc.act{box-shadow:0 0 0 2px #0284c7 inset}.hp-pc.bad{background:#f8fafc}.hp-pc.bad .hp-big{color:#94a3b8}' +
      '.hp-h{display:flex;justify-content:space-between;align-items:center;gap:6px}.hp-lb{font-weight:800;font-size:14px;white-space:nowrap}' +
      '.hp-chip{font-size:10px;font-weight:700;border-radius:999px;padding:2px 7px;white-space:nowrap}' +
      '.hp-ok{background:#dcfce7;color:#166534}.hp-adv{background:#fef3c7;color:#92400e}.hp-none{background:#f1f5f9;color:#64748b}.hp-bad{background:#fee2e2;color:#991b1b}' +
      '.hp-big{font:800 20px/1.15 ui-monospace,SFMono-Regular,Menlo,monospace;margin:8px 0 2px;color:#0369a1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.hp-sub{font-size:11.5px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.hp-bar{height:6px;background:#e2e8f0;border-radius:6px;margin-top:8px;overflow:hidden}.hp-bar>i{display:block;height:100%;border-radius:6px;background:#38bdf8}.hp-bar>i.a{background:#fbbf24}' +
      '.hp-chg{font-size:11px;font-weight:700;margin-top:6px;white-space:nowrap}' +
      '.hp-mini{display:flex;align-items:flex-end;gap:2px;height:28px;margin-top:8px}.hp-mini>i{flex:1;background:#bae6fd;border-radius:2px 2px 0 0;min-height:2px}.hp-mini>i.a{background:#fde68a}.hp-mini>i.z{background:#f1f5f9}' +
      '.hp-skip{font-size:11.5px;color:#94a3b8;padding:0 12px 12px}' +
      /* 明細視窗 */
      '.hp-mask{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:2147482000;display:flex;align-items:flex-end;justify-content:center}' +
      '@media (min-width:760px){.hp-mask{align-items:center}}' +
      '.hp-sh{background:#f8fafc;width:100%;max-width:660px;height:90vh;max-height:90vh;border-radius:20px 20px 0 0;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 -10px 30px rgba(0,0,0,.25);animation:hpUp .22s ease-out}' +
      '@media (min-width:760px){.hp-sh{border-radius:20px;height:auto;max-height:88vh}}@keyframes hpUp{from{transform:translateY(30px);opacity:0}to{transform:none;opacity:1}}' +
      '.hp-top,.hp-tabs,.hp-pills{flex:none}.hp-body{flex:1;min-height:0;overflow:auto;padding:12px 14px 14px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}' +
      '.hp-top{background:#0f172a;color:#fff;padding:12px 14px;display:flex;align-items:center;gap:8px}.hp-top b{font-size:19px}.hp-top small{display:block;opacity:.7;font-size:12px;margin-top:2px}' +
      '.hp-top button{width:40px;height:40px;border-radius:50%;border:0;background:rgba(255,255,255,.12);color:#fff;font-size:18px;cursor:pointer;flex:none}' +
      '.hp-tabs{display:flex;background:#fff;border-bottom:1px solid #e2e8f0;overflow-x:auto;scrollbar-width:none}.hp-tabs::-webkit-scrollbar{display:none}' +
      '.hp-tabs button{flex:1;border:0;background:none;padding:11px 8px;font-size:13.5px;font-weight:600;color:#64748b;white-space:nowrap;cursor:pointer;border-bottom:3px solid transparent}.hp-tabs button.on{color:#4338ca;border-bottom-color:#4f46e5}' +
      '.hp-k{display:grid;grid-template-columns:1fr 1fr;gap:8px}.hp-kc{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:10px 12px;border-left:4px solid var(--c,#0ea5e9)}' +
      '.hp-kc b{display:block;font:800 19px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hp-kc span{font-size:11.5px;color:#64748b}' +
      '.hp-sec{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:10px 12px;margin-top:10px}.hp-sec h4{margin:0 0 8px;font-size:13px;color:#334155}' +
      '.hp-tr{display:flex;align-items:flex-end;gap:4px;height:120px}.hp-tr button{flex:1;border:0;background:none;padding:0;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:3px;cursor:pointer;min-width:0}' +
      '.hp-tr em.v{visibility:hidden;font-weight:700;color:#0369a1}.hp-tr button.on em.v{visibility:visible}@media (min-width:760px){.hp-tr em.v{visibility:visible;font-size:9px}}' +
      '.hp-tr i{display:block;width:100%;background:#7dd3fc;border-radius:4px 4px 0 0;min-height:3px}.hp-tr i.a{background:#fcd34d}.hp-tr button.on i{background:#0284c7}.hp-tr button.on i.a{background:#d97706}.hp-tr em{font-style:normal;font-size:9.5px;color:#64748b;white-space:nowrap}' +
      '.hp-dr{display:grid;grid-template-columns:minmax(80px,38%) 1fr 104px;gap:8px;align-items:center;font-size:12.5px;padding:7px 4px;border-radius:10px;cursor:pointer;border:0;background:none;width:100%;text-align:left;font-family:inherit;color:inherit}' +
      '.hp-dr:active{background:#eef2ff}.hp-dr .t{height:10px;background:#e2e8f0;border-radius:6px;overflow:hidden}.hp-dr .t i{display:block;height:100%;background:#38bdf8;border-radius:6px}' +
      '.hp-dr .n{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#334155}.hp-dr .v{font:700 11.5px ui-monospace,monospace;white-space:nowrap;text-align:right}.hp-dr .v small{display:block;font-weight:400;color:#64748b}' +
      '.hp-pr{display:grid;grid-template-columns:22px 1fr auto;gap:8px;align-items:center;padding:8px 2px;border-bottom:1px solid #f1f5f9;font-size:13px}.hp-pr:last-child{border-bottom:0}.hp-pr .nm{min-width:0}.hp-pr .nm b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hp-pr .nm small{color:#64748b;font-size:11.5px}.hp-pr .am{font:700 13px ui-monospace,monospace;color:#0369a1}' +
      '.hp-fil{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:8px}.hp-fil input{flex:1;min-width:120px;border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;font-size:14px}.hp-fil .hp-chip{font-size:12px;padding:5px 10px;cursor:pointer;border:0}' +
      '.hp-link{display:block;margin:14px auto 2px;border:0;background:none;color:#0369a1;font-size:12.5px;text-decoration:underline;cursor:pointer}' +
      '.hp-pills{display:flex;gap:8px;overflow-x:auto;padding:10px 12px;background:#fff;border-top:1px solid #e2e8f0;scrollbar-width:none}.hp-pills::-webkit-scrollbar{display:none}' +
      '.hp-pills button{flex:none;border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:8px 14px;font-size:13px;font-weight:600;color:#334155;cursor:pointer}.hp-pills button.on{background:#4f46e5;border-color:#4f46e5;color:#fff}' +
      /* 手機上儀表板的大數字（$70,696.86 這類）不再被切掉 */
      '@media (max-width:520px){.jmono.text-3xl,.jmono.text-2xl,.font-mono.text-3xl,.font-mono.text-2xl{font-size:clamp(17px,5.6vw,24px)!important;white-space:nowrap}}' +
      '.hp-note{font-size:11.5px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:7px 10px;margin-top:8px}';
    var s = doc.createElement('style'); s.id = 'hp-pc-css'; s.textContent = t; (doc.head || doc.documentElement).appendChild(s);
  }

  var ok = function () { return typeof STORE !== 'undefined' && typeof periodStats === 'function' && doc.getElementById('rp-tbody'); };
  var VIEW = 'card'; try { VIEW = localStorage.getItem('hp_period_view') || 'card'; } catch (_) {}
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var money = function (n) { return '$' + (typeof fmt === 'function' ? fmt(n) : (Math.round(n * 100) / 100).toLocaleString()); };
  var short = function (n) { var a = Math.abs(n); return (n < 0 ? '−' : '') + '$' + (a >= 1e6 ? (a / 1e6).toFixed(2) + 'M' : a >= 1e3 ? (a / 1e3).toFixed(1) + 'k' : Math.round(a)); };
  var tt = function (zh, en) { return typeof T === 'function' ? T(zh, en) : zh; };
  var lab = function (k) { return typeof labelFromKey === 'function' ? labelFromKey(k) : k; };
  var capMode = function () { return typeof COST_MODE !== 'undefined' && COST_MODE === 'cap'; };
  var NUM = function (v) { return typeof N === 'function' ? N(v) : (+v || 0); };
  var BAD_PC = 20;   /* 每人平均不到 $20 → 金額異常（多半是舊檔欄位不同或只匯入了零星資料） */

  /* 部門小圖示 */
  function icon(d) {
    var s = String(d || '').toLowerCase();
    if (/sew|line|車縫|leader/.test(s)) return '🧵'; if (/cut|裁/.test(s)) return '✂️'; if (/qc|qa|quality|品/.test(s)) return '🔍';
    if (/pack|包裝|fold/.test(s)) return '📦'; if (/iron|燙/.test(s)) return '♨️'; if (/ware|store|倉|stock/.test(s)) return '🏬';
    if (/mainten|mechanic|機修|repair/.test(s)) return '🔧'; if (/secur|guard|保安|警衛/.test(s)) return '🛡'; if (/hr|admin|人事|行政|account|finance|財/.test(s)) return '💼';
    if (/office|辦公/.test(s)) return '🗂'; if (/clean|清潔/.test(s)) return '🧹'; if (/driver|司機|car/.test(s)) return '🚗'; if (/canteen|kitchen|cook|餐/.test(s)) return '🍳';
    if (/embroid|print|繡|印/.test(s)) return '🎨'; if (/sample|樣/.test(s)) return '🧪'; if (/ie|plan|生管|pc/.test(s)) return '📐'; if (/nurse|clinic|醫/.test(s)) return '🩺';
    return '🏷';
  }
  function gIcon(r) { var x = String(r.gender || r.sex || '').trim().toLowerCase(); return /^(f|female|ស្រី|女)/.test(x) ? '🚺' : /^(m|male|ប្រុស|男)/.test(x) ? '🚹' : '👤'; }

  function keys() { return sortedPeriods(); }                                   /* 舊 → 新（全部） */
  function st(k) { var s = periodStats(STORE[k]); s.k = k; s.adv = !s.hasPay && s.hasAdv; s.pc = s.total / (s.head || 1); s.val = capMode() ? s.pc : s.total; s.empty = !(s.head > 0) || !(s.total > 0); s.bad = !s.empty && s.pc < BAD_PC; s.good = !s.empty && !s.bad; return s; }
  function allS() { return keys().map(st); }
  function listS() { return allS().filter(function (s) { return !s.empty; }); }    /* 有資料的月份 */
  function rowsOf(e) {
    var pay = e.payrollRecords || [], adv = e.advanceRecords || [], src = typeof COST_SRC !== 'undefined' ? COST_SRC : 'pay';
    var r = src === 'adv' ? adv : src === 'both' ? pay.concat(adv) : (pay.length ? pay : adv);
    var d = doc.getElementById('cost-dept'); d = d ? d.value : ''; return d ? r.filter(function (x) { return x.dept === d; }) : r;
  }
  function prevGood(S, i) { for (var j = i - 1; j >= 0; j--) if (S[j].good && S[j].adv === S[i].adv) return S[j]; return null; }
  function col(p) { return p == null ? '#94a3b8' : Math.abs(p) <= 5 ? '#16a34a' : Math.abs(p) <= 15 ? '#ca8a04' : '#dc2626'; }
  function pct(a, b) { return b > 0 ? (a - b) / b * 100 : null; }
  function pctTxt(p) { return p == null ? '—' : (p >= 0 ? '+' : '') + p.toFixed(1) + '%'; }
  function chgHtml(s, prev) {
    if (!s.good) return '<div class="hp-chg" style="color:#94a3b8">— ' + tt('不比較', 'n/a') + '</div>';
    if (!prev) return '<div class="hp-chg" style="color:#94a3b8">— ' + tt('沒有可比月份', 'no prior') + '</div>';
    var p = pct(s.val, prev.val), a = Math.abs(p);
    return '<div class="hp-chg" style="color:' + col(p) + '">' + (a <= 5 ? '🟢' : a <= 15 ? '🟡' : '🔴') + ' ' + (p >= 0 ? '▲ +' : '▼ ') + p.toFixed(1) + '% ' + tt('vs ', 'vs ') + esc(lab(prev.k).replace(/ \d{4}$/, '')) + '</div>';
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
    var all = allS(), S = all.filter(function (s) { return !s.empty; }), nEmpty = all.length - S.length, mode = typeof REPORT_MODE !== 'undefined' ? REPORT_MODE : 'month';
    if (!S.length) { u.box.innerHTML = '<div style="padding:24px;text-align:center;color:#94a3b8;font-size:13px">' + tt('尚無資料', 'No data') + '</div>'; return; }
    var act = (typeof ACTIVE !== 'undefined' && ACTIVE) ? ACTIVE.periodKey : '';
    if (mode === 'month') {
      var mx = function (adv) { return Math.max.apply(null, S.filter(function (s) { return s.good && s.adv === adv; }).map(function (s) { return s.val; }).concat([1])); }, mxP = mx(false), mxA = mx(true);
      var html = S.map(function (s, i) {
        var chip = s.bad ? '<span class="hp-chip hp-bad">⚠️ ' + tt('異常', 'Check') + '</span>' : s.hasPay ? '<span class="hp-chip hp-ok">' + tt('正式', 'Final') + '</span>' : '<span class="hp-chip hp-adv">' + tt('只有預付', 'Advance only') + '</span>';
        return '<button type="button" data-fx="card" class="hp-pc' + (s.k === act ? ' act' : '') + (s.bad ? ' bad' : '') + '" data-k="' + s.k + '">' +
          '<div class="hp-h"><span class="hp-lb">' + esc(lab(s.k)) + '</span>' + chip + '</div>' +
          '<div class="hp-big">' + money(s.val) + '</div>' +
          '<div class="hp-sub">👥 ' + s.head + ' · ' + tt('人均', 'Avg') + ' ' + short(s.pc) + '</div>' +
          '<div class="hp-bar"><i class="' + (s.adv ? 'a' : '') + '" style="width:' + (s.good ? Math.max(3, Math.round(s.val / (s.adv ? mxA : mxP) * 100)) : 2) + '%"></i></div>' +
          chgHtml(s, prevGood(S, i)) + '</button>';
      }).reverse().join('');
      u.box.innerHTML = '<div class="hp-grid">' + html + '</div>' + (nEmpty ? '<div class="hp-skip">' + tt('已略過 ' + nEmpty + ' 個沒有資料的月份', nEmpty + ' empty months hidden') + '</div>' : '');
    } else {
      var Y = years(S), ys = Object.keys(Y).sort().reverse();
      u.box.innerHTML = '<div class="hp-grid">' + ys.map(function (y) {
        var v = Y[y], pv2 = Y[String(+y - 1)], avgM = v.n ? v.total / v.n : 0, mm = 1;
        for (var m = 1; m <= 12; m++) { var s0 = v.m[m]; if (s0 && s0.good && s0.val > mm) mm = s0.val; }
        var bars = ''; for (var m2 = 1; m2 <= 12; m2++) { var s1 = v.m[m2]; bars += s1 && s1.good ? '<i class="' + (s1.adv ? 'a' : '') + '" style="height:' + Math.max(8, Math.round(s1.val / mm * 100)) + '%"></i>' : '<i class="z" style="height:8%"></i>'; }
        var yoy = pv2 && pv2.n ? pct(avgM, pv2.total / pv2.n) : null;
        return '<button type="button" data-fx="card" class="hp-yc" data-y="' + y + '"><div class="hp-h"><span class="hp-lb">' + y + '</span><span class="hp-chip hp-none">' + v.n + ' ' + tt('個月', 'mo') + (v.bad ? ' · ⚠️' + v.bad : '') + '</span></div>' +
          '<div class="hp-big">' + short(v.total) + '</div><div class="hp-sub">' + tt('月平均', 'Mo avg') + ' ' + short(avgM) + ' · 👥 ' + Math.round(v.head / (v.n || 1)) + '</div>' +
          '<div class="hp-mini">' + bars + '</div>' +
          (yoy == null ? '<div class="hp-chg" style="color:#94a3b8">— ' + tt('無去年可比', 'no prior year') + '</div>' : '<div class="hp-chg" style="color:' + col(yoy) + '">' + (yoy >= 0 ? '▲ +' : '▼ ') + yoy.toFixed(1) + '% ' + tt('月平均 vs 去年', 'mo avg vs prior yr') + '</div>') +
          '</button>';
      }).join('') + '</div>';
    }
  }
  /* 年度只算「正常」月份；異常月份另外計數 */
  function years(S) { var Y = {}; S.forEach(function (s) { var y = s.k.slice(0, 4), m = +s.k.slice(5, 7); var v = Y[y] || (Y[y] = { n: 0, total: 0, head: 0, bad: 0, m: {} }); v.m[m] = s; if (s.good) { v.n++; v.total += s.val; v.head += s.head; } else v.bad++; }); Object.keys(Y).forEach(function (y) { if (!Y[y].n && !Y[y].bad) delete Y[y]; }); return Y; }

  /* ───── 明細視窗 ───── */
  var cur = null, curY = null, TAB = 'sum', DEPT = '', Q = '';
  function close() { var m = doc.getElementById('hp-mask'); if (m) m.remove(); doc.removeEventListener('keydown', onKey); }
  function onKey(e) { if (/INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) return; if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft') step(-1); else if (e.key === 'ArrowRight') step(1); }
  /* 2026-11-23 Paul：換月份／年份要接得順，不要整張重新彈出來閃一下。
     左右（‹ ›、左右滑、← →）＝推入；上下（捲到底再往下、滾輪、手指往上推）＝舊的往上推走、新的從下面接上，像 PDF 連續頁。動畫用共用的 vrtFx（music.js），沒載就單純換。 */
  function kfn() { var f = g.vrtFx; if (!f) { try { f = g.top.vrtFx; } catch (e) {} } return f; }
  function step(d, ax) {
    var f = kfn(), m = doc.getElementById('hp-mask'), old = m && m.querySelector('.hp-sh'), before = cur + '|' + curY, sn = null;
    if (ax === 'y' && f && f.snap && old) { try { sn = f.snap(old); } catch (e) {} }
    step0(d);
    var nw = doc.querySelector('#hp-mask .hp-sh');
    if ((cur + '|' + curY) !== before && nw && f) { try { f(nw, ax === 'y' ? -d : d, 0, ax, sn); } catch (e) {} } else if (sn && sn.parentNode) sn.parentNode.removeChild(sn);
  }
  function step0(d) {
    if (curY) { var ys = Object.keys(years(listS())).sort(), i = ys.indexOf(curY) + d; if (i >= 0 && i < ys.length) openYear(ys[i]); return; }
    var ks = listS().map(function (s) { return s.k; }), j = ks.indexOf(cur) + d; if (j >= 0 && j < ks.length) openMonth(ks[j]);
  }
  function shell(title, sub, tabs, body, pills) {
    var m = doc.getElementById('hp-mask');
    if (!m) {
      m = doc.createElement('div'); m.id = 'hp-mask'; m.className = 'hp-mask no-print'; m.setAttribute('data-noswipe', ''); m.setAttribute('data-keynote', 'off');
      m.addEventListener('click', function (e) {
        if (e.target === m) return close();
        var b = e.target.closest('[data-act]'); if (!b) return;
        var a = b.getAttribute('data-act'), v = b.getAttribute('data-v');
        if (a === 'x') close(); else if (a === 'p') step(-1); else if (a === 'n') step(1);
        else if (a === 'm') { openMonth(v); } else if (a === 'y') openYear(v);
        else if (a === 'tab') { TAB = v; if (v !== 'ppl') DEPT = ''; openMonth(cur); }
        else if (a === 'dept') { TAB = 'ppl'; DEPT = v; Q = ''; openMonth(cur); }
        else if (a === 'nodept') { DEPT = ''; openMonth(cur); }
        else if (a === 'go') { close(); if (typeof jumpPeriod === 'function') jumpPeriod(v); }
      });
      m.addEventListener('input', function (e) { if (e.target.id === 'hp-q') { Q = e.target.value; var list = m.querySelector('#hp-plist'); if (list) list.innerHTML = peopleHtml(cur); } });
      var sx = null, sy = null; m.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
      m.addEventListener('touchend', function (e) { if (sx == null) return; var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5 && !e.target.closest('.hp-pills,.hp-tabs,.hp-tr,input')) step(dx < 0 ? 1 : -1); sx = null; }, { passive: true });
      /* 連續往下：內容已經捲到底再往下（滾輪或手指往上推）＝下一期；在最上面再往上＝上一期 */
      var wl = 0, atEnd = false, atTop = false;
      function edge() { var b = m.querySelector('.hp-body'); if (!b) return [true, true]; return [b.scrollTop <= 1, b.scrollTop + b.clientHeight >= b.scrollHeight - 2]; }
      m.addEventListener('wheel', function (e) { if (e.target.closest && e.target.closest('.hp-pills,.hp-tr')) return; var now = Date.now(); if (now - wl < 520) return; var ed = edge(); if (e.deltaY > 30 && ed[1]) { wl = now; step(-1, 'y'); } else if (e.deltaY < -30 && ed[0]) { wl = now; step(1, 'y'); }   /* 下方那排是新→舊，所以「往下」＝往舊的一期（step -1） */ }, { passive: true });
      m.addEventListener('touchstart', function () { var ed = edge(); atTop = ed[0]; atEnd = ed[1]; }, { passive: true });
      m.addEventListener('touchend', function (e) { var t = e.changedTouches[0]; if (!t || m.__sy == null) return; var dy = t.clientY - m.__sy, dx = t.clientX - m.__sx; if (Math.abs(dy) > 80 && Math.abs(dy) > Math.abs(dx) * 1.5 && !(e.target.closest && e.target.closest('.hp-pills,.hp-tabs,input'))) { if (dy < 0 && atEnd) step(-1, 'y'); else if (dy > 0 && atTop) step(1, 'y'); } }, { passive: true });
      m.addEventListener('touchstart', function (e) { m.__sx = e.touches[0].clientX; m.__sy = e.touches[0].clientY; }, { passive: true });
      doc.body.appendChild(m); doc.addEventListener('keydown', onKey);
    }
    m.innerHTML = '<div class="hp-sh" role="dialog"><div class="hp-top"><div style="flex:1;min-width:0"><b>' + esc(title) + '</b><small>' + sub + '</small></div>' +
      '<button type="button" data-act="p" aria-label="prev">‹</button><button type="button" data-act="n" aria-label="next">›</button><button type="button" data-act="x" aria-label="close">✕</button></div>' +
      (tabs ? '<div class="hp-tabs">' + tabs + '</div>' : '') + '<div class="hp-body">' + body + '</div><div class="hp-pills">' + pills + '</div></div>';
    /* 只有第一次打開才從下面彈上來；之後換分頁／換期間不重播（不然每點一次就閃一次） */
    if (m.__opened) { var shx = m.querySelector('.hp-sh'); if (shx) shx.style.animation = 'none'; } m.__opened = 1;
    var on = m.querySelector('.hp-pills .on'); if (on) { var ps = on.parentElement; ps.scrollLeft = on.offsetLeft - ps.clientWidth / 2 + on.offsetWidth / 2; }
  }
  function kc(label, val, color, extra) { return '<div class="hp-kc" style="--c:' + color + '"><span>' + label + '</span><b>' + val + '</b>' + (extra ? '<span>' + extra + '</span>' : '') + '</div>'; }
  function hgt(v, mn, mx) { var base = Math.max(0, mn * 0.6); return Math.max(6, Math.round((v - base) / ((mx - base) || 1) * 72)); }
  function deptList(k) {
    var dm = {}; rowsOf(STORE[k]).forEach(function (r) { var d = r.dept || 'Other', v = dm[d] || (dm[d] = { n: 0, t: 0 }); v.n++; v.t += Math.abs(NUM(r.totalSalary)); });
    return Object.keys(dm).map(function (d) { return [d, dm[d]]; }).sort(function (a, b) { return b[1].t - a[1].t; });
  }
  function peopleHtml(k) {
    var q = Q.trim().toLowerCase(), rs = rowsOf(STORE[k]).filter(function (r) { return (!DEPT || (r.dept || 'Other') === DEPT) && (!q || [r.id, r.nameLat, r.nameKh, r.name, r.dept].join(' ').toLowerCase().indexOf(q) >= 0); })
      .sort(function (a, b) { return Math.abs(NUM(b.totalSalary)) - Math.abs(NUM(a.totalSalary)); });
    if (!rs.length) return '<div class="hp-sub" style="padding:14px;text-align:center">' + tt('沒有符合的人員', 'No match') + '</div>';
    var more = rs.length > 80 ? '<div class="hp-sub" style="padding:8px 2px">' + tt('只列前 80 人，可用搜尋找其他人', 'First 80 shown — use search') + '（' + rs.length + '）</div>' : '';
    return rs.slice(0, 80).map(function (r) {
      return '<div class="hp-pr"><span>' + gIcon(r) + '</span><span class="nm"><b>' + esc(r.nameLat || r.name || r.nameKh || '—') + '</b><small>' + esc(r.id || '') + ' · ' + icon(r.dept) + ' ' + esc(r.dept || '—') + '</small></span><span class="am">' + money(Math.abs(NUM(r.totalSalary))) + '</span></div>';
    }).join('') + more;
  }
  function openMonth(k) {
    if (!STORE[k]) return; if (cur !== k) { DEPT = ''; Q = ''; } cur = k; curY = null;
    var S = listS(), ks = S.map(function (x) { return x.k; }), i = ks.indexOf(k), s = S[i] || st(k), prev = i >= 0 ? prevGood(S, i) : null;
    var lyk = (+k.slice(0, 4) - 1) + k.slice(4), ly = STORE[lyk] ? st(lyk) : null; if (ly && !(ly.good && ly.adv === s.adv)) ly = null;
    var pM = s.good && prev ? pct(s.val, prev.val) : null, pY = s.good && ly ? pct(s.val, ly.val) : null;
    var WD = typeof WORK_DAYS !== 'undefined' ? WORK_DAYS : 26, WH = typeof WORK_HRS !== 'undefined' ? WORK_HRS : 8, dl = deptList(k);
    var tabs = [['sum', '📊 ' + tt('概要', 'Summary')], ['dept', '🏭 ' + tt('部門', 'Depts') + ' ' + dl.length], ['trend', '📈 ' + tt('趨勢', 'Trend')], ['ppl', '👥 ' + tt('人員', 'Staff') + ' ' + s.head]]
      .map(function (t) { return '<button type="button" data-act="tab" data-v="' + t[0] + '" class="' + (TAB === t[0] ? 'on' : '') + '">' + t[1] + '</button>'; }).join('');
    var body = '';
    if (TAB === 'sum') {
      body = '<div class="hp-k">' +
        kc(capMode() ? tt('人均月成本', 'Per-capita / mo') : tt('月成本', 'Monthly cost'), money(s.val), '#0ea5e9', s.bad ? tt('⚠️ 金額異常', '⚠️ check data') : s.adv ? tt('只有預付（未含月結）', 'Advance only') : tt('正式薪資', 'Final payroll')) +
        kc('👥 ' + tt('人數', 'Headcount'), s.head, '#6366f1', tt('人均', 'Avg') + ' ' + money(s.pc)) +
        kc(tt('vs 上一個可比月份', 'vs prior month'), '<span style="color:' + col(pM) + '">' + pctTxt(pM) + '</span>', col(pM), prev && s.good ? lab(prev.k) + ' ' + short(prev.val) : tt('沒有可比月份', 'none')) +
        kc(tt('vs 去年同月', 'vs same month LY'), '<span style="color:' + col(pY) + '">' + pctTxt(pY) + '</span>', col(pY), ly ? lab(ly.k) + ' ' + short(ly.val) : tt('沒有去年資料', 'no data')) + '</div>';
      if (s.bad) body += '<div class="hp-note">⚠️ ' + tt('這個月每人平均只有 ' + money(s.pc) + '，不像正常薪資（多半是舊檔欄位不同，或只匯入零星資料）。不拿來比較，也不放進趨勢圖；需要的話請重新匯入原檔。', 'Per-capita is only ' + money(s.pc) + ' — probably an old file with different columns; excluded from comparisons.') + '</div>';
      else if (s.adv) body += '<div class="hp-note">⚠️ ' + tt('這個月只有預付薪資檔，金額約半個月，只跟其他「只有預付」的月份比較；月結檔上傳後會自動更新。', 'Advance file only — compared only with other advance-only months.') + '</div>';
      body += '<div class="hp-sec"><h4>🕐 ' + tt('時間換算', 'Time units') + '</h4><div class="hp-k">' +
        kc(tt('每小時', 'Hourly'), money(s.val / (WD * WH)), '#14b8a6') + kc(tt('每日', 'Daily'), money(s.val / WD), '#14b8a6') +
        kc(tt('每週', 'Weekly'), money(s.val / 4.33), '#14b8a6') + kc(tt('年化', 'Yearly'), short(s.val * 12), '#14b8a6') + '</div></div>';
      if (dl.length) body += '<div class="hp-sec"><h4>🏆 ' + tt('成本最高的 3 個部門（點了看人員）', 'Top 3 departments (tap for staff)') + '</h4>' + dl.slice(0, 3).map(function (a) { return deptRow(a, dl[0][1].t); }).join('') + '</div>';
      body += '<button type="button" class="hp-link" data-act="go" data-v="' + k + '">⤵ ' + tt('主畫面也切到這個月（會關閉這個視窗）', 'Switch the main page to this month') + '</button>';
    } else if (TAB === 'dept') {
      body = '<div class="hp-sec" style="margin-top:0"><h4>🏭 ' + tt('部門成本排行（點部門看該部門人員）', 'Departments by cost (tap for staff)') + '</h4>' + (dl.length ? dl.map(function (a) { return deptRow(a, dl[0][1].t); }).join('') : '<div class="hp-sub">—</div>') + '</div>';
    } else if (TAB === 'trend') {
      var G = S.filter(function (x) { return x.good && x.adv === s.adv; }), gi = G.map(function (x) { return x.k; }).indexOf(k), end = gi >= 0 ? gi + 1 : G.length, seg = G.slice(Math.max(0, end - 12), end);
      if (gi < 0 && s.good) seg = G.slice(-12);
      var mx2 = Math.max.apply(null, seg.map(function (x) { return x.val; }).concat([1])), mn2 = Math.min.apply(null, seg.map(function (x) { return x.val; }).concat([mx2]));
      body = '<div class="hp-sec" style="margin-top:0"><h4>📈 ' + (s.adv ? tt('只有預付的月份', 'Advance-only months') : tt('正式月份', 'Final months')) + tt('（點長條換月份）', ' (tap a bar)') + '</h4>' +
        (seg.length ? '<div class="hp-tr">' + seg.map(function (x) { return '<button type="button" data-act="m" data-v="' + x.k + '" class="' + (x.k === k ? 'on' : '') + '" title="' + esc(lab(x.k)) + ' ' + money(x.val) + '"><em class="v">' + short(x.val) + '</em><i class="' + (x.adv ? 'a' : '') + '" style="height:' + hgt(x.val, mn2, mx2) + '%"></i><em>' + x.k.slice(2, 4) + '/' + x.k.slice(5, 7) + '</em></button>'; }).join('') + '</div>' : '<div class="hp-sub">—</div>') + '</div>' +
        '<div class="hp-sec"><h4>📋 ' + tt('逐月數字', 'Month by month') + '</h4>' + seg.slice().reverse().map(function (x, j, arr) { var p2 = arr[j + 1] ? pct(x.val, arr[j + 1].val) : null; return '<button type="button" class="hp-dr" data-act="m" data-v="' + x.k + '"><span class="n">' + (x.k === k ? '▶ ' : '') + esc(lab(x.k)) + '</span><span class="t"><i style="width:' + Math.max(3, Math.round(x.val / mx2 * 100)) + '%"></i></span><span class="v">' + short(x.val) + '<small style="color:' + col(p2) + '">' + pctTxt(p2) + ' · 👥' + x.head + '</small></span></button>'; }).join('') + '</div>';
      if (!s.good) body = '<div class="hp-note">⚠️ ' + tt('這個月金額異常，不放進趨勢圖。', 'Excluded from trend.') + '</div>' + body;
    } else {
      body = '<div class="hp-fil"><input id="hp-q" type="search" placeholder="🔎 ' + tt('搜尋姓名／工號／部門', 'Search name / ID / dept') + '" value="' + esc(Q) + '">' + (DEPT ? '<button type="button" class="hp-chip hp-ok" data-act="nodept">' + icon(DEPT) + ' ' + esc(DEPT) + ' ✕</button>' : '') + '</div>' +
        '<div class="hp-sec" style="margin-top:0" id="hp-plist">' + peopleHtml(k) + '</div>';
    }
    var pills = S.slice().reverse().map(function (x) { return '<button type="button" data-act="m" data-v="' + x.k + '" class="' + (x.k === k ? 'on' : '') + '">' + (x.bad ? '⚠️ ' : '') + esc(lab(x.k)) + '</button>'; }).join('');
    shell(lab(k), (i >= 0 ? (S.length - i) + ' / ' + S.length + ' · ' : '') + (s.bad ? tt('金額異常', 'Check data') : s.adv ? tt('只有預付', 'Advance only') : tt('正式', 'Final')), tabs, body, pills);
  }
  function deptRow(a, mx) { return '<button type="button" class="hp-dr" data-act="dept" data-v="' + esc(a[0]) + '"><span class="n">' + icon(a[0]) + ' ' + esc(a[0]) + '</span><span class="t"><i style="width:' + Math.max(3, Math.round(a[1].t / (mx || 1) * 100)) + '%"></i></span><span class="v">' + short(a[1].t) + '<small>👥 ' + a[1].n + ' · ' + tt('人均', 'avg') + ' ' + short(a[1].t / (a[1].n || 1)) + '</small></span></button>'; }
  function openYear(y) {
    var S = listS(), Y = years(S), v = Y[y]; if (!v) return; cur = null; curY = y;
    var ys = Object.keys(Y).sort(), pv = Y[String(+y - 1)], avgM = v.n ? v.total / v.n : 0, pY = pv && pv.n ? pct(avgM, pv.total / pv.n) : null, mx = 1, mn = Infinity;
    for (var m = 1; m <= 12; m++) { var q = v.m[m]; if (q && q.good) { if (q.val > mx) mx = q.val; if (q.val < mn) mn = q.val; } }
    var body = '<div class="hp-k">' + kc(tt('年度合計', 'Year total'), short(v.total), '#0ea5e9', v.n + ' ' + tt('個正常月份', 'valid months')) + kc(tt('月平均', 'Monthly avg'), short(avgM), '#6366f1') +
      kc('👥 ' + tt('平均人數', 'Avg headcount'), Math.round(v.head / (v.n || 1)), '#a855f7') + kc(tt('月平均 vs 去年', 'Mo avg vs prior yr'), pctTxt(pY), col(pY), pv && pv.n ? (+y - 1) + ' ' + tt('月平均', 'mo avg') + ' ' + short(pv.total / pv.n) : tt('沒有去年資料', 'no data')) + '</div>';
    body += '<div class="hp-sec"><h4>📅 ' + tt('各月份（點長條看該月；黃色＝只有預付）', 'Months (tap for detail; amber = advance only)') + '</h4><div class="hp-tr">';
    for (var m2 = 1; m2 <= 12; m2++) { var s = v.m[m2]; body += s ? '<button type="button" data-act="m" data-v="' + s.k + '"><em class="v">' + (s.good ? short(s.val) : '⚠️') + '</em><i class="' + (s.adv ? 'a' : '') + '" style="height:' + (s.good ? hgt(s.val, mn, mx) : 4) + '%;' + (s.good ? '' : 'background:#e2e8f0') + '"></i><em>' + m2 + '月</em></button>' : '<button type="button" disabled style="cursor:default"><em class="v">&nbsp;</em><i style="height:3%;background:#f1f5f9"></i><em>' + m2 + '月</em></button>'; }
    body += '</div></div>';
    if (v.bad) body += '<div class="hp-note">⚠️ ' + tt(v.bad + ' 個月份金額異常，沒有算進年度合計。', v.bad + ' months with abnormal amounts are excluded.') + '</div>';
    if (Object.keys(v.m).some(function (mm) { return v.m[mm].good && v.m[mm].adv; })) body += '<div class="hp-note">⚠️ ' + tt('有月份只有預付檔（黃色），年度合計會偏低。', 'Some months are advance-only (amber); the year total is understated.') + '</div>';
    var pills = ys.slice().reverse().map(function (x) { return '<button type="button" data-act="y" data-v="' + x + '" class="' + (x === y ? 'on' : '') + '">' + x + '</button>'; }).join('');
    shell(y + ' ' + tt('年', ''), (ys.indexOf(y) + 1) + ' / ' + ys.length, '', body, pills);
  }

  function hook() {
    if (!ok()) return false;
    if (!g.__hpPcHooked) {
      g.__hpPcHooked = 1;
      try { var orig = renderReport; renderReport = function () { var r = orig.apply(this, arguments); try { render(); } catch (e) { console.warn('[period cards]', e); } return r; }; } catch (e) { console.warn('[period cards hook]', e); }
      doc.addEventListener('click', function (e) {
        var c = e.target.closest && e.target.closest('#hp-pcards .hp-pc,#hp-pcards .hp-yc'); if (!c) return;
        if (c.hasAttribute('data-k')) { TAB = 'sum'; openMonth(c.getAttribute('data-k')); } else openYear(c.getAttribute('data-y'));
      });
    }
    render(); return true;
  }
  function init() { css(); if (!hook()) { var n = 0, t = setInterval(function () { if (hook() || ++n > 20) clearInterval(t); }, 500); } }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
  g.HRPayPeriodCards = { render: render, openMonth: function (k, tab) { if (tab) TAB = tab; openMonth(k); }, openYear: function (y) { openYear(y); } };
})(window);
