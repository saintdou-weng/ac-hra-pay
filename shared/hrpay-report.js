/* AC-HRA-PAY 參考報告（Word）v1.0（2026-10-23）
 * 每一頁頁首「📝 報告」：月報／季報／年報（停工、警告、職位異動另有週報），中英或英柬兩語並列，
 * 版面仿 VRT PROD sewing 週報（ac-report-doc.js + docx.iife.js）。只產生 Word 檔供參考，不會發到群組。
 * 內容：管理摘要（月報＝與 Telegram 同一套摘要卡）＋期間比較（vs 上期）＋近 6 期趨勢＋部門／明細表＋資料依據＋簽名欄。
 */
(function (g) {
  'use strict';
  if (g.HRPayReport) return;
  var doc = g.document, P = function () { return g.HRPayPeriods; };
  function lang() { try { if (typeof LANG !== 'undefined' && LANG) return LANG === 'en' ? 'en' : LANG === 'km' ? 'km' : 'tc'; } catch (_) {} try { var l = localStorage.getItem('hrpay_lang'); if (l === 'en' || l === 'km') return l; } catch (_) {} return 'tc'; }
  function L(zh, en, km) { var l = lang(); return l === 'en' ? en : l === 'km' ? (km || en) : zh; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function n(v) { var x = Number(v); return isFinite(x) ? x : 0; }
  function r2(v) { return Math.round(n(v) * 100) / 100; }
  function ev(code) { try { return (0, eval)(code); } catch (_) { return undefined; } }   // 讀本頁的全域變數（STORE、RECS…）
  function has(name) { return ev('typeof ' + name + '!=="undefined"') === true; }
  function fmt(v, f) {
    v = n(v);
    if (f === 'usd') return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (f === 'khr') return Math.round(v).toLocaleString('en-US') + ' ៛';
    if (f === 'h') return v.toLocaleString('en-US', { maximumFractionDigits: 1 });
    if (f === 'd') return v.toLocaleString('en-US', { maximumFractionDigits: 1 });
    return Math.round(v).toLocaleString('en-US');
  }
  function stripHtml(s) { return String(s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'); }
  function ym(d) { return String(d || '').slice(0, 7); }
  function monthsIn(range) { var out = [], d = range.start.slice(0, 7) + '-01'; while (d < range.end) { out.push(d.slice(0, 7)); var y = +d.slice(0, 4), m = +d.slice(5, 7); m++; if (m > 12) { m = 1; y++; } d = y + '-' + ('0' + m).slice(-2) + '-01'; } return out; }
  function inRange(date, range) { var s = String(date || '').slice(0, 10); if (s.length === 7) s += '-01'; return s >= range.start && s < range.end; }
  function groupSum(rows, keyFn, fields) {
    var m = {}; rows.forEach(function (r) { var k = keyFn(r) || 'Other', o = m[k] || (m[k] = { _k: k, _n: 0 }); o._n++; fields.forEach(function (f) { o[f] = n(o[f]) + n(r[f]); }); });
    return Object.keys(m).sort().map(function (k) { return m[k]; });
  }
  function K(zh, en, km, v, f) { return { zh: zh, en: en, km: km || en, v: v, f: f || 'n' }; }

  /* ══ 各模組資料提供者（在本頁執行，用本頁原本的資料與摘要函式） ══ */
  var PROV = {};

  PROV.payroll = {
    title: ['薪資報告', 'Payroll Report', 'របាយការណ៍ប្រាក់ខែ'],
    dates: function () { var S = ev('STORE') || {}; return Object.keys(S).filter(function (k) { return /^\d{4}-\d{2}/.test(k); }).map(function (k) { return k.slice(0, 7) + '-01'; }); },
    entries: function (range) { var S = ev('STORE') || {}; return Object.keys(S).sort().filter(function (k) { return inRange(k.slice(0, 7), range); }).map(function (k) { return S[k]; }); },
    pay: function (e) { try { return (e.payrollRecords || []).length ? ev('buildPayrollProjection')(e) : null; } catch (_) { return null; } },
    adv: function (e) { try { return (e.advanceRecords || []).length ? ev('buildAdvanceProjection')(e) : null; } catch (_) { return null; } },
    kpis: function (range) {
      var es = this.entries(range), self = this, hc = 0, net = 0, basic = 0, ot = 0, bonus = 0, ahc = 0, adv = 0, ms = 0;
      es.forEach(function (e) { var p = self.pay(e), a = self.adv(e); if (p) { ms++; hc += p.totals.count; net += p.totals.netPay; basic += p.totals.basic; ot += p.totals.otPay; bonus += n(p.totals.bonus) + n(p.totals.incentive); } if (a) { ahc += a.totals.count; adv += a.totals.advanceAmount; } });
      return [K('正式薪資人數', 'Payroll headcount', 'ចំនួនបុគ្គលិក', ms > 1 ? hc / ms : hc), K('實發總額', 'Net pay total', 'ប្រាក់ខែសរុប', net, 'usd'), K('底薪', 'Basic pay', 'ប្រាក់គោល', basic, 'usd'), K('加班費', 'OT pay', 'ប្រាក់ថែមម៉ោង', ot, 'usd'), K('獎金＋績效', 'Bonus + incentive', 'ប្រាក់រង្វាន់', bonus, 'usd'), K('預支人數', 'Advance headcount', 'បុរេប្រទាន', ms > 1 && ahc ? ahc / Math.max(1, es.length) : ahc), K('預支金額', 'Advance amount', 'ប្រាក់បុរេប្រទាន', adv, 'usd')];
    },
    summary: function (range) {
      var es = this.entries(range); if (range.unit !== 'month' || !es.length) return null;
      var out = [], f = ev('buildSummaryTableText'); if (typeof f !== 'function') return null;
      ['pay', 'adv'].forEach(function (w) { try { var r = f(w, es[0].periodKey); if (r && r.text) out.push(stripHtml(r.text)); } catch (_) {} });
      return out.join('\n\n') || null;
    },
    detail: function (range) {
      var rows = [], self = this; this.entries(range).forEach(function (e) { var p = self.pay(e); if (p) rows = rows.concat(p.rows); });
      var gsum = groupSum(rows, function (r) { return r.dept; }, ['netPay', 'basic', 'otPay', 'bonus']);
      if (!gsum.length) return null;
      return { widths: [2900, 1300, 1900, 1800, 1800], head: [['部門', 'Dept', 'ផ្នែក'], ['人次', 'Count', 'ចំនួន'], ['實發', 'Net pay', 'ប្រាក់ខែ'], ['底薪', 'Basic', 'គោល'], ['加班費', 'OT', 'ថែមម៉ោង']],
        rows: gsum.map(function (o) { return [o._k, fmt(o._n), fmt(o.netPay, 'usd'), fmt(o.basic, 'usd'), fmt(o.otPay, 'usd')]; }) };
    },
    source: function (range) { return this.entries(range).map(function (e) { return [e.periodKey, e.payrollFile, e.advanceFile].filter(Boolean).join(' · '); }).join('\n'); }
  };

  PROV.meal = {
    title: ['餐費報告', 'Meal Fee Report', 'របាយការណ៍ថ្លៃអាហារ'],
    dates: function () { var S = ev('STORE') || {}; return Object.keys(S).map(function (k) { var p = k.split(':'); return p[0] + (p[1] === '2' ? '-16' : '-01'); }); },
    entries: function (range) { var S = ev('STORE') || {}; return Object.keys(S).sort().filter(function (k) { return inRange(k.slice(0, 7), range); }).map(function (k) { return S[k]; }); },
    proj: function (e) { try { return ev('projectionOf')(e); } catch (_) { return null; } },
    kpis: function (range) {
      var usd = 0, khr = 0, hc = 0, b = 0, days = 0, self = this;
      this.entries(range).forEach(function (e) { var p = self.proj(e); if (!p) return; b++; usd += p.totals.mealFee; khr += p.totals.mealRiel; hc = Math.max(hc, p.totals.headcount); p.rows.forEach(function (r) { days += n(r.mealDays); }); });
      return [K('批次數', 'Batches', 'ជំនាន់', b), K('最多人數（單批）', 'Max headcount (one batch)', 'ចំនួនអតិបរមា', hc), K('用餐人天', 'Meal person-days', 'ថ្ងៃ-មនុស្ស', days), K('餐費 USD', 'Meal fee USD', 'ថ្លៃអាហារ USD', usd, 'usd'), K('餐費 KHR', 'Meal fee KHR', 'ថ្លៃអាហារ KHR', khr, 'khr')];
    },
    summary: function (range) {
      if (range.unit !== 'month') return null; var f = ev('buildTgSummaryTable'), S = ev('STORE') || {}; if (typeof f !== 'function') return null;
      return Object.keys(S).sort().filter(function (k) { return k.slice(0, 7) === range.key; }).map(function (k) { try { var r = f(k); return r && r.text ? stripHtml(r.text) : ''; } catch (_) { return ''; } }).filter(Boolean).join('\n\n') || null;
    },
    detail: function (range) {
      var rows = [], self = this; this.entries(range).forEach(function (e) { var p = self.proj(e); if (p) rows = rows.concat(p.rows); });
      var gs = groupSum(rows, function (r) { return r.dept; }, ['mealFee', 'mealRiel', 'mealDays']); if (!gs.length) return null;
      return { widths: [3100, 1400, 1700, 1700, 1800], head: [['部門', 'Dept', 'ផ្នែក'], ['人次', 'Count', 'ចំនួន'], ['用餐天數', 'Meal days', 'ថ្ងៃ'], ['USD', 'USD', 'USD'], ['KHR', 'KHR', 'KHR']],
        rows: gs.map(function (o) { return [o._k, fmt(o._n), fmt(o.mealDays, 'd'), fmt(o.mealFee, 'usd'), fmt(o.mealRiel, 'khr')]; }) };
    }
  };

  PROV.otbonus = {
    title: ['加班／獎金報告', 'OT / Bonus Report', 'របាយការណ៍ថែមម៉ោង'],
    recs: function (range) { var R = ev('RECS') || []; return R.filter(function (r) { return !r.deleted && inRange(r.year + '-' + ('0' + r.month).slice(-2), range); }); },
    dates: function () { return (ev('RECS') || []).map(function (r) { return r.year + '-' + ('0' + r.month).slice(-2) + '-01'; }); },
    kpis: function (range) {
      var rs = this.recs(range), by = function (t, f) { return rs.filter(function (r) { return r.type === t; }).reduce(function (s, r) { return s + n(r[f]); }, 0); };
      return [K('一般加班人次', 'OT person-count', 'ថែមម៉ោង', by('ot', 'ppl')), K('一般加班時數', 'OT hours', 'ម៉ោង', by('ot', 'hour'), 'h'), K('一般加班費用', 'OT expense', 'ចំណាយ', by('ot', 'expense'), 'usd'), K('獎金', 'Bonus', 'ប្រាក់រង្វាន់', by('bonus', 'expense'), 'usd'), K('Special OT 人次', 'Special OT count', 'Special OT', by('special', 'ppl')), K('Special OT 金額', 'Special OT amount', 'Special OT', by('special', 'expense'), 'usd')];
    },
    summary: function (range) {
      var f = ev('buildTgSummaryTable'); if (typeof f !== 'function') return null;
      var key = range.unit === 'month' ? range.key : range.unit === 'quarter' ? range.key : range.unit === 'year' ? range.key : null; if (!key) return null;
      return ['ot', 'bonus', 'special'].map(function (t) { try { var r = f(t, key); return r && r.text ? stripHtml(r.text) : ''; } catch (_) { return ''; } }).filter(Boolean).join('\n\n') || null;
    },
    detail: function (range) {
      var gs = groupSum(this.recs(range), function (r) { return r.dept; }, ['ppl', 'hour', 'expense']); if (!gs.length) return null;
      return { widths: [3500, 1800, 2000, 2400], head: [['部門', 'Dept', 'ផ្នែក'], ['人次', 'Count', 'ចំនួន'], ['時數', 'Hours', 'ម៉ោង'], ['金額', 'Amount', 'ទឹកប្រាក់']], rows: gs.map(function (o) { return [o._k, fmt(o.ppl), fmt(o.hour, 'h'), fmt(o.expense, 'usd')]; }) };
    }
  };

  PROV.employee = {
    title: ['人力名冊報告', 'Workforce Report', 'របាយការណ៍កម្លាំងពលកម្ម'],
    snaps: function (range) { var S = ev('SNAPS') || {}; return Object.keys(S).sort().filter(function (k) { return inRange(k.slice(0, 7), range); }); },
    dates: function () { return Object.keys(ev('SNAPS') || {}).map(function (k) { return k.slice(0, 7) + '-01'; }); },
    last: function (range) { var ks = this.snaps(range); return ks.length ? (ev('SNAPS') || {})[ks[ks.length - 1]] : null; },
    kpis: function (range) {
      var s = this.last(range), rows = s ? s.rows : [], depts = {};
      rows.forEach(function (r) { depts[r.dept || 'Other'] = 1; });
      return [K('在冊人數（期末）', 'Headcount (end of period)', 'ចំនួនបុគ្គលិក', rows.length), K('男', 'Male', 'ប្រុស', rows.filter(function (r) { return /^m/i.test(r.gender || ''); }).length), K('女', 'Female', 'ស្រី', rows.filter(function (r) { return /^f/i.test(r.gender || ''); }).length), K('部門數', 'Departments', 'ផ្នែក', Object.keys(depts).length)];
    },
    summary: function (range) { var ks = this.snaps(range), f = ev('buildTgText'); if (!ks.length || typeof f !== 'function') return null; try { var r = f(ks[ks.length - 1], ''); return r && r.text ? stripHtml(r.text) : null; } catch (_) { return null; } },
    detail: function (range) {
      var s = this.last(range); if (!s) return null;
      var gs = groupSum(s.rows.map(function (r) { return { dept: r.dept, f: /^f/i.test(r.gender || '') ? 1 : 0 }; }), function (r) { return r.dept; }, ['f']);
      return { widths: [4300, 2700, 2700], head: [['部門', 'Dept', 'ផ្នែក'], ['人數', 'Headcount', 'ចំនួន'], ['女性', 'Female', 'ស្រី']], rows: gs.map(function (o) { return [o._k, fmt(o._n), fmt(o.f)]; }) };
    }
  };

  PROV.shutdown = {
    title: ['停工報告', 'Shutdown Report', 'របាយការណ៍ផ្អាកការងារ'], week: true,
    evs: function (range) { var E = ev('EVENTS') || [], p = P(); return E.map(function (e) { return p.clipEvent(e, range.start, range.unit); }).filter(Boolean); },
    dates: function () { var p = P(); return (ev('EVENTS') || []).reduce(function (a, e) { for (var i = 0; i < Math.ceil(n(e.days)); i++) a.push(p.add(e.start, i)); return a; }, []); },
    kpis: function (range) { var es = this.evs(range); return [K('停工事件', 'Shutdown events', 'ព្រឹត្តិការណ៍', es.length), K('停工天數', 'Shutdown days', 'ថ្ងៃ', es.reduce(function (s, e) { return s + n(e.days); }, 0), 'd'), K('停工人天', 'Person-days', 'ថ្ងៃ-មនុស្ស', es.reduce(function (s, e) { return s + n(e.personDays); }, 0), 'd'), K('最多停工人數', 'Max people stopped', 'មនុស្សអតិបរមា', es.reduce(function (s, e) { return Math.max(s, n(e.shutPPL)); }, 0))]; },
    summary: function (range) { var f = ev('buildTgText'); if (typeof f !== 'function') return null; try { var r = f(range.unit, range.start); return r && r.text ? stripHtml(r.text) : null; } catch (_) { return null; } },
    detail: function (range) { var es = this.evs(range); if (!es.length) return null; return { widths: [2000, 2000, 1400, 1500, 1500, 1300], head: [['開始', 'Start', 'ចាប់ផ្តើម'], ['結束', 'End', 'បញ្ចប់'], ['天數', 'Days', 'ថ្ងៃ'], ['停工人數', 'People', 'មនុស្ស'], ['人天', 'Person-days', 'ថ្ងៃ-មនុស្ស'], ['線', 'Lines', 'ខ្សែ']], rows: es.map(function (e) { return [e.start, e.end || '', fmt(e.days, 'd'), fmt(e.shutPPL), fmt(e.personDays, 'd'), (e.shutLine || '') + (e.ttlLine ? '/' + e.ttlLine : '')]; }) }; }
  };

  PROV.warning = {
    title: ['警告報告', 'Warning Report', 'របាយការណ៍ការព្រមាន'], week: true,
    recs: function (range) { return (ev('RECS') || []).filter(function (r) { return !r.deleted && inRange(r.incidentDate, range); }); },
    dates: function () { return (ev('RECS') || []).map(function (r) { return String(r.incidentDate || '').slice(0, 10); }); },
    kpis: function (range) { var rs = this.recs(range), lv = function (re) { return rs.filter(function (r) { return re.test(String(r.level || '')); }).length; }, act = rs.filter(function (r) { return !/reject|退件|deleted|刪除/i.test(String(r.status || '')); });
      return [K('警告件數', 'Warnings', 'ការព្រមាន', rs.length), K('人數', 'Employees', 'បុគ្គលិក', Object.keys(rs.reduce(function (m, r) { m[r.empId] = 1; return m; }, {})).length), K('口頭警告', 'Verbal', 'ពាក្យសំដី', lv(/^verbal$/i)), K('小過／中過', 'Small / Medium', 'តូច／មធ្យម', lv(/^(small|medium)$/i)), K('大過／最後警告／停職', 'Big / Final / Suspend', 'ធំ／ចុងក្រោយ／ផ្អាក', lv(/^(big|final|suspend)$/i))]; },
    summary: function (range) { var f = ev('buildTgText'), p = P(); if (typeof f !== 'function') return null; try { var r = f(range.unit, p.key(range.start, range.unit)); return r && r.text ? stripHtml(r.text) : null; } catch (_) { return null; } },
    detail: function (range) { var rs = this.recs(range); if (!rs.length) return null; return { widths: [1500, 1300, 2000, 1700, 900, 2300], head: [['日期', 'Date', 'កាលបរិច្ឆេទ'], ['工號', 'ID', 'លេខ'], ['姓名', 'Name', 'ឈ្មោះ'], ['部門', 'Dept', 'ផ្នែក'], ['等級', 'Level', 'កម្រិត'], ['事由', 'Reason', 'មូលហេតុ']], rows: rs.map(function (r) { return [r.incidentDate, r.empId, r.empName || '', r.empDept || '', String(r.level || ''), String(r.reason || '').slice(0, 60)]; }) }; }
  };

  PROV.transfer = {
    title: ['職位異動報告', 'Transfer Report', 'របាយការណ៍ផ្លាស់ប្តូរ'], week: true,
    recs: function (range) { return (ev('RECS') || []).filter(function (r) { return !r.deleted && inRange(r.effDate, range); }); },
    dates: function () { return (ev('RECS') || []).map(function (r) { return String(r.effDate || '').slice(0, 10); }); },
    kpis: function (range) { var rs = this.recs(range), c = function (re) { return rs.filter(function (r) { return re.test(String(r.kind || '')); }).length; }; return [K('異動件數', 'Changes', 'ការផ្លាស់ប្តូរ', rs.length), K('調部門', 'Department moves', 'ផ្លាស់ផ្នែក', rs.filter(function (r) { return r.newDept && r.origDept && r.newDept !== r.origDept; }).length), K('調職務', 'Position changes', 'ផ្លាស់តំណែង', rs.filter(function (r) { return r.newPos && r.origPos && r.newPos !== r.origPos; }).length), K('調薪', 'Salary changes', 'ប្រាក់ខែ', c(/salary|pay|薪/i)), K('已核可', 'Approved', 'អនុម័ត', rs.filter(function (r) { return /approv|核可/i.test(String(r.status || '')); }).length)]; },
    summary: function (range) { var f = ev('buildTgSummaryTable'), p = P(); if (typeof f !== 'function') return null; try { var r = f('sum', range.unit === 'month' ? range.key : p.key(range.start, range.unit), '', range.unit); return r && r.text ? stripHtml(r.text) : null; } catch (_) { return null; } },
    detail: function (range) { var rs = this.recs(range); if (!rs.length) return null; return { widths: [1400, 1200, 1800, 2700, 2600], head: [['生效日', 'Effective', 'កាលបរិច្ឆេទ'], ['工號', 'ID', 'លេខ'], ['姓名', 'Name', 'ឈ្មោះ'], ['原 → 新部門／職務', 'From → to (dept / position)', 'ពី → ទៅ'], ['事由', 'Reason', 'មូលហេតុ']], rows: rs.map(function (r) { return [r.effDate, r.empId, r.name || '', (r.origDept || '') + (r.origPos ? ' ' + r.origPos : '') + ' → ' + (r.newDept || '') + (r.newPos ? ' ' + r.newPos : ''), String(r.reason || '').slice(0, 50)]; }) }; }
  };

  function benefits(isN) {
    return {
      title: isN ? ['社會保險 NSSF 報告', 'NSSF Report', 'របាយការណ៍ ប.ស.ស.'] : ['半年年資報告', 'Seniority Report', 'របាយការណ៍អតីតភាព'],
      app: function () { return g.HRPayBenefitsApp; },
      dates: function () { var a = this.app(); return a ? Array.from(new Set(a.getRecords().filter(function (r) { return !r.deleted && r.kind === 'employee'; }).map(function (r) { return r.period + '-01'; }))) : []; },
      periodsIn: function (range) { var a = this.app(); return a ? Array.from(new Set(a.getRecords().filter(function (r) { return !r.deleted && r.kind === 'employee' && inRange(r.period, range); }).map(function (r) { return r.period; }))).sort() : []; },
      kpis: function (range) {
        var a = this.app(), t = { headcount: 0, female: 0, amount: 0, risk: 0, health: 0, pension: 0 };
        this.periodsIn(range).forEach(function (p) { var s = a.stats(p); Object.keys(t).forEach(function (k) { t[k] += n(s[k]); }); });
        return isN ? [K('投保人次', 'Insured count', 'ចំនួន', t.headcount), K('女性', 'Female', 'ស្រី', t.female), K('職災保險', 'Occupational risk', 'ហានិភ័យ', t.risk, 'khr'), K('醫療保險', 'Health care', 'សុខភាព', t.health, 'khr'), K('退休金', 'Pension', 'សោធន', t.pension, 'khr'), K('合計', 'Total', 'សរុប', t.amount, 'khr')]
          : [K('發放人數', 'Paid headcount', 'ចំនួន', t.headcount), K('女性', 'Female', 'ស្រី', t.female), K('年資金額', 'Seniority amount', 'ទឹកប្រាក់', t.amount, 'usd')];
      },
      summary: function (range) { var a = this.app(); if (!a || range.unit !== 'month' || a.active() !== range.key) return null; try { return stripHtml(a.summaryText()); } catch (_) { return null; } },
      detail: function (range) {
        var a = this.app(), rows = []; this.periodsIn(range).forEach(function (p) { rows = rows.concat(a.stats(p).rows || []); });
        var gs = groupSum(rows, function (r) { return r.dept || r.group || r.section; }, ['amount']); if (!gs.length) return null;
        return { widths: [4300, 2400, 3000], head: [['部門／組別', 'Dept / group', 'ផ្នែក'], ['人次', 'Count', 'ចំនួន'], [isN ? '金額 KHR' : '金額 USD', isN ? 'Amount KHR' : 'Amount USD', 'ទឹកប្រាក់']], rows: gs.map(function (o) { return [o._k, fmt(o._n), fmt(o.amount, isN ? 'khr' : 'usd')]; }) };
      }
    };
  }
  PROV.nssf = benefits(true);
  PROV.seniority = benefits(false);

  /* ══ 期間 ══ */
  var UNITS = { week: ['週報', 'Weekly', 'ប្រចាំសប្តាហ៍'], month: ['月報', 'Monthly', 'ប្រចាំខែ'], quarter: ['季報', 'Quarterly', 'ប្រចាំត្រីមាស'], year: ['年報', 'Annual', 'ប្រចាំឆ្នាំ'] };
  function rangeOf(anchor, unit) { var b = P().bounds(anchor, unit); return { start: b.start, end: b.end, unit: unit, key: P().key(anchor, unit), label: P().label(anchor, unit) }; }
  function prevRange(r) { return rangeOf(P().add(r.start, -1), r.unit); }
  function options(t, unit) { var pv = PROV[t], ds = (pv.dates() || []).filter(Boolean); return P().options(ds, unit).reverse(); }

  /* ══ 組報告 ══ */
  function pick(a, ln) { return ln === 'en-km' ? [a.en, a.km] : [a.zh, a.en]; }
  function tri(arr, ln) { return ln === 'en-km' ? [arr[1], arr[2]] : [arr[0], arr[1]]; }
  function buildModel(t, opt) {
    var pv = PROV[t], ln = opt.lang, r = rangeOf(opt.anchor, opt.unit), pr = prevRange(r), now = new Date();
    var ks = pv.kpis(r), kp = pv.kpis(pr), sections = [];
    var MOD = g.HRPayHub && g.HRPayHub.MODS[t] || {};
    // 1 管理摘要
    var bullets = ks.map(function (k, i) {
      var p = kp[i], diff = n(k.v) - n(p && p.v), pct = n(p && p.v) ? Math.round(diff / n(p.v) * 1000) / 10 : null;
      var tail = p && n(p.v) ? (diff >= 0 ? ' ▲ ' : ' ▼ ') + fmt(Math.abs(diff), k.f) + (pct != null ? ' (' + (pct >= 0 ? '+' : '') + pct + '%)' : '') : '';
      var lab = pick(k, ln); return [lab[0] + '：' + fmt(k.v, k.f) + tail, lab[1] + ': ' + fmt(k.v, k.f) + tail, diff > 0 ? '2E75B6' : diff < 0 ? 'C00000' : '7F7F7F'];
    });
    sections.push({ title: tri(['管理摘要', 'Management summary', 'សេចក្តីសង្ខេប'], ln), bullets: bullets });
    var sum = ln === 'zh-en' ? pv.summary(r) : null;
    if (sum) sections.push({ title: tri(['群組摘要卡（與 Telegram 相同內容）', 'Group summary card (same as Telegram)', 'កាតសង្ខេប'], ln), paragraphs: sum.split('\n').filter(function (x) { return x.trim(); }).slice(0, 80).map(function (x) { return [x, '']; }) });
    // 期間比較
    sections.push({ title: tri(['期間比較', 'Period comparison', 'ការប្រៀបធៀប'], ln), table: { widths: [3700, 2000, 2000, 2000], head: [tri(['項目', 'Item', 'ធាតុ'], ln), [r.key, r.key], [pr.key, pr.key], tri(['變化', 'Change', 'ការប្រែប្រួល'], ln)],
      rows: ks.map(function (k, i) { var p = kp[i], d = n(k.v) - n(p && p.v); return [pick(k, ln), fmt(k.v, k.f), fmt(p && p.v, k.f), (d > 0 ? '+' : d < 0 ? '−' : '') + fmt(Math.abs(d), k.f)]; }) } });
    // 近 6 期趨勢
    var trend = [], cur = r; for (var i = 0; i < 6; i++) { trend.unshift(cur); cur = prevRange(cur); }
    var head = [tri(['期間', 'Period', 'រយៈពេល'], ln)].concat(ks.slice(0, 4).map(function (k) { return pick(k, ln); }));
    sections.push({ title: tri(['近 6 期趨勢', 'Trend — last 6 periods', 'និន្នាការ ៦ រយៈពេលចុងក្រោយ'], ln), table: { widths: [1900].concat(ks.slice(0, 4).map(function () { return Math.floor(7800 / Math.min(4, ks.length)); })), head: head,
      rows: trend.map(function (x) { var kk = pv.kpis(x); return [x.key].concat(kk.slice(0, 4).map(function (k) { return fmt(k.v, k.f); })); }), rowOpts: trend.map(function (x, j) { return j === trend.length - 1 ? { fill: 'blue', bold: true } : {}; }) } });
    // 明細
    if (opt.details) {
      var d = pv.detail(r);
      if (d) sections.push({ title: tri(['部門／明細', 'Breakdown / details', 'លម្អិត'], ln), table: { widths: d.widths, head: d.head.map(function (h) { return tri(h, ln); }), rows: d.rows } });
      else sections.push({ title: tri(['部門／明細', 'Breakdown / details', 'លម្អិត'], ln), table: { empty: tri(['本期沒有資料', 'No data for this period', 'គ្មានទិន្នន័យ'], ln) } });
    }
    // 資料依據
    var notes = [tri(['資料來源：AC-HRA-PAY 平台本機資料（已與雲端同步）', 'Source: AC-HRA-PAY platform data (synced with the cloud)', 'ប្រភព៖ AC-HRA-PAY'], ln), tri(['本報告供參考，未發送至群組；正式核可以群組核可紀錄為準', 'For reference only — not sent to the group; approvals follow the group approval record', 'សម្រាប់ជាឯកសារយោងប៉ុណ្ណោះ'], ln)];
    if (pv.source) { var src = pv.source(r); if (src) notes.push([src, '']); }
    if (opt.note) notes.push([opt.note, '']);
    var ZH = '一二三四五六七八';
    sections.forEach(function (sec, i) { sec.title = ln === 'en-km' ? [(i + 1) + '. ' + sec.title[0], (i + 1) + '. ' + sec.title[1]] : [ZH.charAt(i) + '、' + sec.title[0], (i + 1) + '. ' + sec.title[1]]; });
    sections.push({ title: tri(['資料依據與說明', 'Basis and notes', 'មូលដ្ឋាន'], ln), paragraphs: notes });
    var title = tri(pv.title, ln), typ = tri(UNITS[r.unit], ln);
    return { lang: ln, title: title, typeName: typ, periodLabel: r.label, periodPrefix: ln === 'en-km' ? 'Period' : '期間 Period', generatedAt: now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2) + '-' + ('0' + now.getDate()).slice(-2) + ' ' + ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2),
      sections: sections, company: ln === 'en-km' ? 'VANTAGE RIVER TEXTILES CO., LTD.' : 'VANTAGE RIVER TEXTILES CO., LTD.　萬泰紡織有限公司',
      signature: ln === 'en-km' ? { prepared: ['Prepared by', 'អ្នករៀបចំ'], reviewed: ['Reviewed by', 'អ្នកពិនិត្យ'], approved: ['Approved by', 'អ្នកអនុម័ត'] } : true, footerText: 'Vantage River Textiles Co., Ltd.　AC-HRA-PAY · ' + (MOD.en || t), fileName: 'VRT_' + (MOD.en || t).replace(/[^A-Za-z0-9]+/g, '_') + '_' + r.key + '_' + typ[ln === 'en-km' ? 0 : 1].replace(/[^A-Za-z]+/g, '') + '.docx' };
  }
  async function generate(t, opt) {
    var model = buildModel(t, opt);
    var docx = await g.ACReportDoc.loadDocx(['shared/docx.iife.js?v=8.5.0']);
    var d = g.ACReportDoc.build(docx, model), blob = await docx.Packer.toBlob(d);
    if (opt.download !== false) g.ACReportDoc.download(blob, model.fileName);
    return { blob: blob, model: model };
  }

  /* ══ 報告視窗 ══ */
  function loadScript(src, test) { if (test()) return Promise.resolve(); return new Promise(function (res, rej) { var s = doc.createElement('script'); s.src = src; s.onload = function () { test() ? res() : rej(new Error(src)); }; s.onerror = function () { rej(new Error(src)); }; doc.head.appendChild(s); }); }
  var box = null;
  async function open(t) {
    if (!PROV[t]) return;
    await loadScript('shared/hrpay-periods.js?v=3.9.25', function () { return !!g.HRPayPeriods; });
    await loadScript('shared/ac-report-doc.js?v=1', function () { return !!g.ACReportDoc; });
    if (box) box.remove();
    var pv = PROV[t], units = (pv.week ? ['week'] : []).concat(['month', 'quarter', 'year']);
    box = doc.createElement('div'); box.className = 'hph-mask';
    box.innerHTML = '<div class="hph-card" role="dialog" aria-modal="true" style="width:min(560px,100%)"><div class="hph-hd"><b>📝 ' + esc(L('參考報告（Word）', 'Reference report (Word)', 'របាយការណ៍ (Word)')) + '</b><button class="x" data-x>✕</button></div><div class="hph-bd">' +
      '<div style="color:#475569;font-size:12px;margin-bottom:10px">' + esc(L('只產生 Word 檔給你參考／列印，不會發到群組。', 'Creates a Word file for reference / printing only — nothing is sent to the group.', 'សម្រាប់ជាឯកសារយោង មិនផ្ញើទៅក្រុមទេ។')) + '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
      '<label>' + esc(L('類型', 'Type', 'ប្រភេទ')) + '<select data-unit style="width:100%;padding:6px;border:1px solid #cbd5e1;border-radius:8px">' + units.map(function (u) { return '<option value="' + u + '"' + (u === 'month' ? ' selected' : '') + '>' + esc(L(UNITS[u][0], UNITS[u][1], UNITS[u][2])) + '</option>'; }).join('') + '</select></label>' +
      '<label>' + esc(L('期間', 'Period', 'រយៈពេល')) + '<select data-period style="width:100%;padding:6px;border:1px solid #cbd5e1;border-radius:8px"></select></label>' +
      '<label>' + esc(L('語言', 'Languages', 'ភាសា')) + '<select data-lang style="width:100%;padding:6px;border:1px solid #cbd5e1;border-radius:8px"><option value="zh-en">中文＋English</option><option value="en-km">English＋ខ្មែរ</option></select></label>' +
      '<label style="display:flex;align-items:center;gap:6px;margin-top:18px"><input type="checkbox" data-details checked> ' + esc(L('附部門／明細表', 'Include breakdown table', 'ភ្ជាប់តារាង')) + '</label></div>' +
      '<label style="display:block;margin-top:10px">' + esc(L('補充說明（可空白）', 'Notes (optional)', 'កំណត់សម្គាល់')) + '<textarea data-note rows="2" style="width:100%;padding:6px;border:1px solid #cbd5e1;border-radius:8px"></textarea></label>' +
      '<div class="hph-act"><button class="hph-go" data-go>📝 ' + esc(L('產生 Word', 'Create Word file', 'បង្កើត Word')) + '</button><span data-msg style="align-self:center;font-size:12px;color:#475569"></span></div></div></div>';
    doc.body.appendChild(box);
    if (lang() !== 'tc') box.querySelector('[data-lang]').value = 'en-km';
    var unitSel = box.querySelector('[data-unit]'), perSel = box.querySelector('[data-period]'), msg = box.querySelector('[data-msg]');
    function fill() { var o = options(t, unitSel.value); perSel.innerHTML = o.length ? o.map(function (x) { return '<option value="' + x.value + '">' + esc(x.label) + '</option>'; }).join('') : '<option value="">' + esc(L('沒有資料', 'No data', 'គ្មាន')) + '</option>'; }
    unitSel.onchange = fill; fill();
    box.addEventListener('click', function (e) { if (e.target === box || e.target.hasAttribute('data-x')) box.remove(); });
    box.querySelector('[data-go]').onclick = async function () {
      if (!perSel.value) { msg.textContent = L('這個類型沒有資料', 'No data for this type', 'គ្មានទិន្នន័យ'); return; }
      msg.textContent = '⏳ ' + L('產生中…', 'Creating…', 'កំពុងបង្កើត…');
      try { var r = await generate(t, { unit: unitSel.value, anchor: perSel.value, lang: box.querySelector('[data-lang]').value, details: box.querySelector('[data-details]').checked, note: box.querySelector('[data-note]').value.trim() });
        msg.textContent = '✅ ' + r.model.fileName; } catch (e) { msg.textContent = '⚠ ' + ((e && e.message) || e); }
    };
  }
  g.HRPayReport = { version: '1.0', open: open, generate: generate, buildModel: buildModel, providers: PROV, options: options };
})(window);
