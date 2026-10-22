/* AC-HRA-PAY 智慧匯入中心 v1.0（2026-10-23）
 * 首頁和每一頁最上面同一顆「⇧ 智慧匯入」：Excel／CSV、Outlook .msg／.eml（自動取附件）、zip（自動解開）丟同一個地方，
 * 系統依檔名、分頁名、表頭判斷是哪個模組（判不出來才請你選一次），再用「該模組頁自己的匯入功能」匯入：
 *   - 本頁的模組直接在本頁匯入；其他模組在畫面上開一個小視窗（就是那個模組頁），匯入時該模組原本的確認視窗照常出現。
 *   - 合併、去重、月份判斷、差異確認，全部和在模組頁上匯入一模一樣；匯入後由模組自己的雙向智慧同步上雲（只傳有變的部分）。
 * 同一個檔（內容 SHA-256 相同）再丟＝標示「已匯入過」、預設不勾，不會重匯；也可以打勾強制重匯。
 * 匯完等雲端確認，再問「✈️ 發摘要」／「✅ 核可」：開模組頁的 Telegram 視窗並預選期間，先預覽再由你按發送（不會自動發）。
 * Telegram 群組收件匣：HR Pay 群組裡丟的檔案由機器人存到雲端，這裡會列出「群組收到的檔案」，用同一個匯入器匯入。
 * 照片／PDF：目前 HRA-PAY 沒有模組收照片或 PDF，會先列出並說明，不會匯錯。
 */
(function (g) {
  'use strict';
  if (g.HRPayHub) return;
  var doc = g.document;
  var VERSION = '1.0', LOG_KEY = 'hub:log', LIB_SRC = 'shared/hrpay-files.min.js?v=1', XLSX_SRC = 'shared/xlsx.full.min.js';
  var DEFAULT_GAS = 'https://script.google.com/macros/s/AKfycbwmmRduvOe5RdnR_iALwEIi_6lQaTq4SXH88jmoIjiHwTsTrW5qnlPTr8PSmOT7C2rdGg/exec';
  function gasUrl() { try { return (localStorage.getItem('hrpay_gas_url') || DEFAULT_GAS).trim(); } catch (_) { return DEFAULT_GAS; } }

  /* ── 模組表 ── kind：hrpay＝HRPayAutoSync 的頁；benefits＝Seniority／NSSF 共用頁；approval＝有群組核可 */
  var MODS = {
    payroll:  { ic: '💵', page: 'payroll.html',     kind: 'hrpay', key: 'payroll',  approval: true, zh: '薪資＋預支 Payroll',    en: 'Payroll + Advance',  km: 'ប្រាក់ខែ' },
    meal:     { ic: '🍱', page: 'meal_fee.html',    kind: 'hrpay', key: 'meal',     approval: true, zh: '餐費／考勤 Meal Fee',   en: 'Meal Fee / Attendance', km: 'ថ្លៃអាហារ' },
    otbonus:  { ic: '⏱', page: 'ot_bonus.html',    kind: 'hrpay', key: 'otbonus',  approval: true, zh: 'OT／獎金／Special OT', en: 'OT / Bonus / Special OT', km: 'ថែមម៉ោង' },
    seniority:{ ic: '🌿', page: 'seniority.html',   kind: 'benefits',               approval: true, zh: '半年年資 Seniority',    en: 'Seniority',          km: 'អតីតភាពការងារ' },
    nssf:     { ic: '🛡', page: 'nssf.html',        kind: 'benefits',               approval: true, zh: '社會保險 NSSF',         en: 'NSSF',               km: 'ប.ស.ស.' },
    employee: { ic: '👥', page: 'employee_hr.html', kind: 'hrpay', key: 'employee',                 zh: '員工名冊 Employee',     en: 'Employee master',    km: 'បុគ្គលិក' },
    transfer: { ic: '🔄', page: 'transfer.html',    kind: 'hrpay', key: 'transfer', approval: true, zh: '職位異動 Transfer',     en: 'Transfer',           km: 'ផ្លាស់ប្តូរតំណែង' },
    warning:  { ic: '⚠️', page: 'warning.html',     kind: 'hrpay', key: 'warning',  approval: true, zh: '警告 Warning',          en: 'Warning',            km: 'ការព្រមាន' },
    shutdown: { ic: '🛑', page: 'shutdown.html',    kind: 'hrpay', key: 'shutdown',                 zh: '停工 Shutdown',         en: 'Shutdown',           km: 'ការផ្អាកការងារ' }
  };
  var ORDER = ['employee', 'payroll', 'meal', 'otbonus', 'seniority', 'nssf', 'transfer', 'warning', 'shutdown'];

  /* ── 判斷規則：name＝檔名、sheet＝分頁名、head＝前 15 列文字（小寫）。name +3、sheet +2、head +2。
        自動採用：最高分 ≥3 且比第二名高 ≥1；否則請你選。依各模組頁匯入器實際認得的檔名／表頭寫。 */
  var RULES = {
    payroll:  { name: /payroll|advance|salary ?(list|sheet)|預支|預付|正式薪資|薪資/, sheet: /payroll|advance|summary/, head: /payroll summary|advance summary|total ?salary|basic ?pay|net ?pay/ },
    meal:     { name: /meal|餐費|attend|考勤|出勤/, sheet: /meal|attend|考勤/, head: /meal ?fee|staff ?no|លុយបាយ/ },
    otbonus:  { name: /(^|[^a-z])ot([^a-z]|$)|overtime|bonus|special ?ot|加班|獎金/, sheet: /overtime|bonus|\bot\b|special/, head: /normal ?overtime|night ?overtime|special ?overtime|special ?ot|sunday ?overtime|holiday ?overtime|escort|ចំនួនថែមម៉ោង|\bppl\b[^\n]*\bppl\b/ },
    seniority:{ name: /seniority|年資/, sheet: /seniority/, head: /seniority ?payment/ },
    nssf:     { name: /nssf|e-?form|social ?security|社保|社會保險/, sheet: /nssf|e-?form/, head: /nssf ?member ?id/ },
    employee: { name: /staff|employee|員工|名冊|roster|headcount/, sheet: /staff|employee|名冊|roster/, head: /english ?sur|khmer ?sur|vrt ?card|place ?of ?b|id ?no.{0,80}(name|姓名)/ },
    transfer: { name: /transfer|異動|調職|調薪|promotion|salary ?adjust|position ?change/, sheet: /transfer|異動|promotion/, head: /(new|old) ?position|新職務|原職務|skill ?allow|技能.{0,30}(職務|position)/ },
    warning:  { name: /warning|警告|disciplin/, sheet: /warning|警告|^\s*20\d{2}\s*$/, head: /warning ?(letter|level|type)|警告(單|等級)|offen[cs]e|\bverbal\b[^\n]*\b(small|big)\b/ },
    shutdown: { name: /shutdown|停工|suspen/, sheet: /shutdown|停工/, head: /shutdown|停工/ }
  };

  /* ── 語言 ── */
  function lang() {
    try { if (typeof LANG !== 'undefined' && LANG) return LANG === 'en' ? 'en' : LANG === 'km' ? 'km' : 'tc'; } catch (_) {}
    try { var l = localStorage.getItem('hrpay_lang'); if (l === 'en' || l === 'km') return l; } catch (_) {}
    return 'tc';
  }
  function L(zh, en, km) { var l = lang(); return l === 'en' ? en : l === 'km' ? (km || en) : zh; }
  function nm(t) { var m = MODS[t]; return m ? m.ic + ' ' + L(m.zh, m.en, m.km) : L('（不匯入）', '(skip)', '(រំលង)'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function extOf(n) { var m = String(n || '').toLowerCase().match(/\.([a-z0-9]+)$/); return m ? m[1] : ''; }
  function isExcel(e) { return /^(xlsx|xls|xlsm|xlsb|csv)$/.test(e); }
  function isPhoto(e) { return /^(jpe?g|png|webp|heic|heif|gif|bmp)$/.test(e); }
  function kb(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function hereTool() {
    var p = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    for (var k in MODS) if (MODS[k].page === p) return k;
    return '';
  }
  var HERE = hereTool();

  function loadScript(src, test) {
    if (test()) return Promise.resolve();
    return new Promise(function (res, rej) { var s = doc.createElement('script'); s.src = src; s.onload = function () { test() ? res() : rej(new Error(src)); }; s.onerror = function () { rej(new Error(L('元件載入失敗：', 'Could not load: ') + src)); }; doc.head.appendChild(s); });
  }
  function libs() { return loadScript(LIB_SRC, function () { return g.JSZip && g.MsgReader; }); }
  function xlsx() { return loadScript(XLSX_SRC, function () { return typeof g.XLSX !== 'undefined'; }); }
  async function hashOf(buf) {
    try { var d = await crypto.subtle.digest('SHA-256', buf); return Array.prototype.map.call(new Uint8Array(d), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); } catch (_) { return ''; }
  }
  function kv() { return g.HRPayKV; }
  async function logRead() { try { var v = kv() ? await kv().get(LOG_KEY, null) : null; return v && typeof v === 'object' ? v : {}; } catch (_) { return {}; } }
  async function logWrite(v) {
    var keys = Object.keys(v); if (keys.length > 800) keys.sort(function (a, b) { return (v[a].at || 0) - (v[b].at || 0); }).slice(0, keys.length - 800).forEach(function (k) { delete v[k]; });
    try { if (kv()) await kv().set(LOG_KEY, v); } catch (_) {}
  }

  /* ── 展開：zip → 裡面的檔；msg／eml → 附件 ── */
  async function expand(file, via, out, depth) {
    depth = depth || 0; var ext = extOf(file.name);
    if (depth > 3) { out.push({ file: file, via: via, unsupported: L('層數太深', 'Too deeply nested') }); return; }
    if (ext === 'zip') {
      await libs();
      var z = await g.JSZip.loadAsync(await file.arrayBuffer()), names = Object.keys(z.files).filter(function (n) { return !z.files[n].dir && !/(^|\/)(__MACOSX|\.DS_Store|thumbs\.db)/i.test(n); });
      if (!names.length) { out.push({ file: file, via: via, unsupported: L('空的 zip', 'Empty zip') }); return; }
      for (var i = 0; i < names.length; i++) {
        var blob = await z.files[names[i]].async('blob'), base = names[i].split('/').pop();
        await expand(new File([blob], base, { type: blob.type || '' }), (via ? via + ' › ' : '') + file.name, out, depth + 1);
      }
      return;
    }
    if (ext === 'msg') {
      await libs();
      var r = new g.MsgReader(await file.arrayBuffer()), data = r.getFileData() || {}, atts = Array.isArray(data.attachments) ? data.attachments : [], subject = String(data.subject || '').trim(), usable = 0;
      for (var a = 0; a < atts.length; a++) {
        var att = r.getAttachment(a); if (!att || !att.content) continue;
        var an = att.fileName || atts[a].fileName || ('attachment' + (a + 1)); if (atts[a].attachMimeTag === 'message/rfc822' && !extOf(an)) an += '.eml';
        var aext = extOf(an); if (!(isExcel(aext) || isPhoto(aext) || /^(zip|msg|eml|pdf)$/.test(aext))) continue;
        usable++;
        await expand(new File([att.content], an, { type: '' }), (via ? via + ' › ' : '') + file.name + (subject ? '「' + subject + '」' : ''), out, depth + 1);
      }
      if (!usable) out.push({ file: file, via: via, unsupported: L('這封信沒有可匯入的附件', 'No importable attachment in this message') + (subject ? '（' + subject + '）' : '') });
      return;
    }
    if (ext === 'eml') {
      var text = await file.text(), subj = (text.match(/^Subject:\s*(.*)$/mi) || [])[1] || '', got = 0, m;
      var re = /Content-Type:\s*([^;\r\n]+)[^]*?name="?([^"\r\n;]+)"?[^]*?Content-Transfer-Encoding:\s*base64[^]*?\r?\n\r?\n([A-Za-z0-9+\/=\r\n]+)/gi;
      while ((m = re.exec(text))) {
        var fname = m[2].replace(/=\?utf-8\?b\?([^?]+)\?=/i, function (_, b64) { try { return decodeURIComponent(escape(atob(b64))); } catch (e) { return _; } }), fext = extOf(fname);
        if (!(isExcel(fext) || isPhoto(fext) || /^(zip|msg|pdf)$/.test(fext))) continue;
        try { var bin = atob(m[3].replace(/\s+/g, '')), u8 = new Uint8Array(bin.length); for (var j = 0; j < bin.length; j++) u8[j] = bin.charCodeAt(j); got++;
          await expand(new File([u8], fname, { type: '' }), (via ? via + ' › ' : '') + file.name + (subj ? '「' + subj.trim() + '」' : ''), out, depth + 1); } catch (e) {}
      }
      if (!got) out.push({ file: file, via: via, unsupported: L('這封信沒有可匯入的附件', 'No importable attachment in this message') });
      return;
    }
    if (isExcel(ext)) { out.push({ file: file, via: via }); return; }
    if (isPhoto(ext) || ext === 'pdf') { out.push({ file: file, via: via, unsupported: L('HRA-PAY 目前沒有模組收照片／PDF（請丟 Excel）；需要的話給我樣本再加', 'No HRA-PAY module reads photos/PDF yet (use the Excel file)') }); return; }
    out.push({ file: file, via: via, unsupported: L('不支援的檔案類型', 'Unsupported file type') + ' .' + ext });
  }

  /* ── 判斷模組 ── */
  function readCtx(name, wb) {
    var ctx = { name: String(name || '').toLowerCase(), sheets: [], head: '' };
    if (!wb) return ctx;
    (wb.SheetNames || []).slice(0, 12).forEach(function (sn) {
      var rows = [];
      try { rows = g.XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '', raw: true, blankrows: false }); } catch (_) {}
      ctx.sheets.push(String(sn).toLowerCase());
      ctx.head += '\n' + rows.slice(0, 15).map(function (r) { return (r || []).slice(0, 40).map(function (v) { return String(v == null ? '' : v); }).join(' '); }).join('\n').toLowerCase().replace(/[\s　]+/g, ' ');
    });
    return ctx;
  }
  function score(ctx) {
    var out = [];
    Object.keys(RULES).forEach(function (t) {
      var r = RULES[t], s = 0;
      if (r.name && r.name.test(ctx.name)) s += 3;
      if (r.sheet && ctx.sheets.some(function (x) { return r.sheet.test(x); })) s += 2;
      if (r.head && r.head.test(ctx.head)) s += 2;
      if (s) out.push({ tool: t, score: s });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out;
  }
  function guessPeriod(name, head) {
    var s = String(name || '') + ' ' + String(head || '').slice(0, 1500), m;
    if ((m = s.match(/(20\d{2})[-_.\/ ]?(0[1-9]|1[0-2])(?!\d)/))) return m[1] + '-' + m[2];
    var MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    if ((m = s.toLowerCase().match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s_\-.,]*(20\d{2})/))) return m[2] + '-' + ('0' + (MON.indexOf(m[1]) + 1)).slice(-2);
    return '';
  }
  async function classify(entry) {
    var ext = extOf(entry.file.name), wb = null, ctx;
    if (isExcel(ext)) { try { await xlsx(); wb = g.XLSX.read(await entry.file.arrayBuffer(), { type: 'array', cellDates: false, raw: true, sheetRows: 40 }); } catch (e) { entry.unsupported = L('Excel 讀不出來：', 'Excel could not be read: ') + e.message; return; } }
    ctx = readCtx(entry.file.name, wb);
    var c = score(ctx);
    entry.cands = c;
    entry.period = guessPeriod(entry.file.name, ctx.head);
    if (c.length && c[0].score >= 3 && (!c[1] || c[0].score - c[1].score >= 1)) { entry.tool = c[0].tool; entry.auto = true; }
    else { entry.tool = ''; entry.ask = true; }
  }

  /* ══ 和模組頁對接（在本頁或在模組頁小視窗裡執行；w＝那一頁的 window） ══ */
  function ev(w, code) { try { return w.eval(code); } catch (_) { return undefined; } }
  function syncState(w, t) {
    var m = MODS[t];
    try {
      if (m.kind === 'benefits') {
        var app = w.HRPayBenefitsApp; if (!app || !app.cloud) return null;
        var c = app.cloud(), stuck = /offline|error/.test(c.state || ''), busyB = !!c.busy || (!!c.pending && !stuck);
        return { state: c.busy ? 'syncing' : (c.pending && stuck ? 'retry' : c.state), detail: c.detail || '', lastRun: c.last || 0, busy: busyB, pending: !!c.pending, ready: c.last > 0 && !c.busy && c.state !== 'checking' };
      }
      var A = w.HRPayAutoSync; if (!A || !A.state) return null;
      var s = A.state(m.key); if (!s) return null;
      return { state: s.state, detail: s.detail || '', lastRun: s.lastRun || 0, busy: /syncing|dirty/.test(s.state), ready: s.lastRun > 0 && /^(synced|checked|retry|offline)$/.test(s.state) };
    } catch (_) { return null; }
  }
  async function waitReady(w, t, ms) {
    var t0 = Date.now(); ms = ms || 90000;
    while (Date.now() - t0 < ms) { var s = syncState(w, t); if (s && s.ready) return true; await sleep(300); }
    return false;
  }
  // 匯入後等模組自己的同步完成（有變更才會同步；沒有變更就不等）
  async function waitUploaded(w, t, since, ms) {
    var t0 = Date.now(), seenBusy = false, stable = 0; ms = ms || 6 * 60 * 1000;
    while (Date.now() - t0 < ms) {
      var s = syncState(w, t);
      if (s) {
        if (s.busy) { seenBusy = true; stable = 0; }
        else if (s.lastRun > since || seenBusy) { if (++stable >= 3) return s; }
        else if (!seenBusy && Date.now() - t0 > 4000) return { state: 'nochange' };
      }
      await sleep(400);
    }
    return { state: 'timeout' };
  }
  function wrapFiles(w, files) { return files.map(function (f) { return new w.File([f], f.name, { type: f.type || '', lastModified: f.lastModified || Date.now() }); }); }
  function txt(el) { return el ? String(el.innerText || el.textContent || '').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim() : ''; }
  async function runImporter(w, t, files) {
    var m = MODS[t], fs = wrapFiles(w, files), d = w.document;
    if (m.kind === 'benefits') {
      var app = w.HRPayBenefitsApp, msgs = [];
      for (var i = 0; i < fs.length; i++) {
        var stEl = d.getElementById('status'); if (stEl) stEl.textContent = '';
        try {
          await app.importFile(fs[i]);
          var said = txt(d.getElementById('status'));
          // 模組的確認視窗按「取消」＝沒有匯入（不記成已匯入）
          if (/匯入完成|Import complete|នាំចូលរួចរាល់/.test(said)) msgs.push('✓ ' + fs[i].name + ' — ' + said);
          else msgs.push('– ' + fs[i].name + ' — ' + L('已取消，未匯入', 'cancelled, not imported', 'បានបោះបង់'));
        } catch (e) { msgs.push('✕ ' + fs[i].name + ' — ' + (e && e.message || e)); }
      }
      return { text: msgs.join('\n'), ok: msgs.some(function (x) { return x.charAt(0) === '✓'; }), okNames: msgs.filter(function (x) { return x.charAt(0) === '✓'; }).map(function (x) { return x.slice(2).split(' — ')[0]; }) };
    }
    // 一個檔一個檔交給模組頁原本的匯入器，逐檔判斷成功／取消（只有成功的才記成「已匯入過」）
    var lines = [], okNames = [];
    for (var k = 0; k < fs.length; k++) {
      var f1 = fs[k], good = false, said = '';
      try {
        if (t === 'transfer') {
          await w.onFiles([f1]);
          said = txt(d.getElementById('import-report')); good = /^✅/.test(said);
        } else {
          var st0 = d.getElementById('smart-status'); if (st0) st0.textContent = '';
          await w.smartImport({ files: [f1], value: '' });
          var rp = d.getElementById('smart-report'); said = txt(d.getElementById('smart-status'));
          good = /^✅/.test(said); said += rp && txt(rp) ? '\n' + txt(rp) : '';
        }
      } catch (e) { said = (e && e.message) || String(e); }
      lines.push((good ? '✓ ' : '✕ ') + f1.name + (said ? ' — ' + said.replace(/\n+/g, ' · ').slice(0, 300) : ''));
      if (good) okNames.push(f1.name);
    }
    return { text: lines.join('\n'), ok: okNames.length > 0, okNames: okNames };
  }
  function periodNow(w, t) {
    var m = MODS[t];
    if (m.kind === 'benefits') { try { return w.HRPayBenefitsApp.active(); } catch (_) { return ''; } }
    var code = {
      payroll: 'ACTIVE&&ACTIVE.periodKey', meal: 'ACTIVE&&ACTIVE.key', otbonus: 'ACTIVE&&(ACTIVE.period||(ACTIVE.year&&ACTIVE.month?ACTIVE.year+"-"+String(ACTIVE.month).padStart(2,"0"):""))',
      employee: 'ACTIVE&&(ACTIVE.key||ACTIVE.period)', shutdown: '', warning: '', transfer: ''
    }[t];
    var v = code ? ev(w, 'typeof ACTIVE!=="undefined"&&(' + code + ')') : '';
    return String(v || '').slice(0, 7);
  }

  /* ── 開 Telegram 視窗並預選（模組頁上執行）mode：summary | approval ── */
  function pickOption(sel, period) {
    if (!sel || !period) return false;
    var opts = Array.prototype.slice.call(sel.options || []).filter(function (o) { return !o.disabled; });
    var hit = opts.filter(function (o) { return o.value === period; })[0] || opts.filter(function (o) { return String(o.value).indexOf(period) === 0; }).pop() || opts.filter(function (o) { return String(o.value).indexOf(period) >= 0; })[0];
    if (!hit) return false;
    sel.value = hit.value; sel.dispatchEvent(new Event('change', { bubbles: true })); return true;
  }
  async function openTelegram(t, mode, period) {
    var w = g, d = doc, m = MODS[t];
    if (!m) return;
    await waitReady(w, t, 30000);
    var review = mode === 'approval';
    try {
      if (m.kind === 'benefits') {
        var app = w.HRPayBenefitsApp;
        if (period && app && app.active() !== period) { try { app.setActive(period); } catch (_) {} }
        var b = d.getElementById('btn-send'); if (b) b.click();
        await sleep(600);
        var sm = d.getElementById('send-mode'); if (sm) { sm.value = review ? 'approval' : 'summary'; sm.dispatchEvent(new Event('change', { bubbles: true })); sm.dispatchEvent(new Event('input', { bubbles: true })); }
        return;
      }
      if (t === 'payroll') {
        var which = 'pay';
        try { var e = ev(w, 'STORE')[period]; if (e && !(e.payrollRecords || []).length && (e.advanceRecords || []).length) which = 'adv'; } catch (_) {}
        w.sendSummaryTG(which);
      } else if (t === 'transfer') w.openTg();
      else if (typeof w.openTgModal === 'function') w.openTgModal();
      await sleep(400);
      ['tg-period', 'tg-snap', 'tg-key'].forEach(function (id) { pickOption(d.getElementById(id), period); });
      if (typeof w.setTgMode === 'function' && (review || t === 'transfer' || t === 'warning')) w.setTgMode(review ? 'review' : 'summary');
      if (typeof w.previewTg === 'function') try { w.previewTg(); } catch (_) {}
    } catch (e) { try { console.warn('[HRPayHub] telegram preset', e); } catch (_) {} }
  }
  function tgLink(t, mode, period) { return MODS[t].page + '?tg=' + mode + (period ? '&period=' + encodeURIComponent(period) : ''); }

  /* ══ 匯入中心視窗 ══ */
  var items = [], busy = false, modal = null, inbox = [], embedRoot = null;
  function css() {
    if (doc.getElementById('hph-css')) return;
    var s = doc.createElement('style'); s.id = 'hph-css';
    s.textContent =
      '.hph-bar{display:inline-flex;gap:6px;align-items:center;flex-wrap:nowrap;flex-shrink:0}' +
      '.hph-bar button{border:0;border-radius:9px;padding:7px 12px;font:700 12px/1.1 system-ui,"Noto Sans TC",sans-serif;cursor:pointer;white-space:nowrap}' +
      '.hph-b-imp{background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;box-shadow:0 2px 6px rgba(37,99,235,.35)}' +
      '.hph-b-rep{background:#f1f5f9;color:#0f172a;border:1px solid #cbd5e1!important}' +
      '.hph-badge{display:inline-block;min-width:16px;padding:1px 5px;margin-left:4px;border-radius:9px;background:#f59e0b;color:#111;font-size:10px}' +
      '.hph-float{position:fixed;top:8px;right:10px;z-index:2147483000}' +
      '.hph-mask{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:2147483100;display:flex;align-items:flex-start;justify-content:center;padding:4vh 10px;overflow:auto}' +
      '.hph-card{background:#fff;color:#0f172a;border-radius:16px;width:min(860px,100%);box-shadow:0 20px 50px rgba(0,0,0,.3);font:13px/1.5 system-ui,"Noto Sans TC",sans-serif}' +
      '.hph-hd{display:flex;align-items:center;gap:8px;padding:14px 18px;border-bottom:1px solid #e2e8f0}.hph-hd b{font-size:15px}.hph-hd .x{margin-left:auto;border:0;background:#f1f5f9;border-radius:8px;padding:5px 10px;cursor:pointer}' +
      '.hph-bd{padding:14px 18px}' +
      '.hph-drop{border:2px dashed #93c5fd;border-radius:14px;background:#eff6ff;padding:18px;text-align:center;cursor:pointer}.hph-drop.on{background:#dbeafe;border-color:#2563eb}' +
      '.hph-drop b{font-size:15px;color:#1e3a8a}.hph-drop small{display:block;color:#475569;margin-top:6px}' +
      '.hph-sec{margin-top:12px;font-weight:700;color:#334155}' +
      '.hph-list{margin-top:6px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden}' +
      '.hph-row{display:grid;grid-template-columns:22px 1fr minmax(150px,220px);gap:8px;align-items:center;padding:8px 10px;border-top:1px solid #f1f5f9}.hph-row:first-child{border-top:0}' +
      '.hph-row .fn{min-width:0}.hph-row .fn b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hph-row .fn small{color:#64748b;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.hph-row select{width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:5px;font-size:12px;background:#fff}' +
      '.hph-tag{font-size:11px;border-radius:999px;padding:1px 7px;margin-left:4px}.t-ask{background:#fef3c7;color:#92400e}.t-old{background:#e2e8f0;color:#334155}.t-bad{background:#fee2e2;color:#991b1b}.t-auto{background:#dcfce7;color:#166534}' +
      '.hph-act{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.hph-act button,.hph-res button,.hph-res a{border:0;border-radius:9px;padding:8px 14px;font-weight:700;cursor:pointer;font-size:12px;text-decoration:none;display:inline-block}' +
      '.hph-go{background:#2563eb;color:#fff}.hph-go:disabled{opacity:.5;cursor:default}.hph-sub{background:#f1f5f9;color:#0f172a}' +
      '.hph-res{margin-top:12px;border-radius:12px;border:1px solid #e2e8f0;padding:10px 12px}.hph-res .m{font-weight:700}.hph-res pre{white-space:pre-wrap;font:11px/1.4 ui-monospace,monospace;color:#475569;max-height:120px;overflow:auto;margin:6px 0}' +
      '.hph-res .ok{color:#15803d}.hph-res .bad{color:#b91c1c}.b-sum{background:#0ea5e9;color:#fff}.b-apr{background:#16a34a;color:#fff}.b-open{background:#f1f5f9;color:#0f172a}' +
      '.hph-ov{position:fixed;inset:0;z-index:2147483200;background:rgba(15,23,42,.55);display:flex;flex-direction:column;padding:2vh 2vw}' +
      '.hph-ov .top{background:#1e3a8a;color:#fff;border-radius:12px 12px 0 0;padding:9px 14px;font:700 13px system-ui,"Noto Sans TC",sans-serif;display:flex;gap:8px;align-items:center}' +
      '.hph-ov iframe{flex:1;border:0;background:#fff;border-radius:0 0 12px 12px;width:100%}' +
      '.hph-emb{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px 16px;margin:14px 0}.hph-emb .hph-drop{padding:16px}' +
      '@media(max-width:560px){.hph-row{grid-template-columns:22px 1fr}.hph-row select{grid-column:2}.hph-float{top:auto;bottom:12px;right:10px}}';
    doc.head.appendChild(s);
  }

  function dropHtml() {
    return '<div class="hph-drop" data-drop><b>⇧ ' + esc(L('把檔案拖進來，或點這裡選檔', 'Drop files here, or tap to choose', 'ទម្លាក់ឯកសារ ឬចុចដើម្បីជ្រើស')) + '</b>' +
      '<small>' + esc(L('Excel／CSV、Outlook .msg／.eml（自動取附件）、zip（自動解開）都可以一次丟。系統自己判斷是哪個模組，判不出來才問。同一個檔再丟＝0 新增。',
        'Excel/CSV, Outlook .msg/.eml (attachments taken) and zip (unpacked) together. The module is detected automatically; you are asked only when unsure. The same file again = 0 new.',
        'Excel/CSV, .msg/.eml, zip ។ ប្រព័ន្ធកំណត់ម៉ូឌុលដោយស្វ័យប្រវត្តិ។')) + '</small>' +
      '<input type="file" multiple hidden data-file accept=".xlsx,.xls,.xlsm,.xlsb,.csv,.msg,.eml,.zip,.pdf,image/*"></div>';
  }
  function bindDrop(root) {
    var dz = root.querySelector('[data-drop]'), fi = root.querySelector('[data-file]');
    if (!dz || dz._hph) return; dz._hph = true;
    dz.addEventListener('click', function () { fi.value = ''; fi.click(); });
    fi.addEventListener('change', function () { var f = Array.prototype.slice.call(fi.files || []); if (f.length) api.addFiles(f); });
    ['dragenter', 'dragover'].forEach(function (k) { dz.addEventListener(k, function (e) { e.preventDefault(); e.stopPropagation(); dz.classList.add('on'); }); });
    ['dragleave', 'drop'].forEach(function (k) { dz.addEventListener(k, function (e) { e.preventDefault(); e.stopPropagation(); dz.classList.remove('on'); }); });
    dz.addEventListener('drop', function (e) { var f = Array.prototype.slice.call(e.dataTransfer && e.dataTransfer.files || []); if (f.length) api.addFiles(f); });
  }
  function bodyHtml() {
    var h = dropHtml();
    if (inbox.length) {
      h += '<div class="hph-sec">📥 ' + esc(L('群組收到的檔案（尚未匯入）', 'Files received in the group (not imported yet)', 'ឯកសារពីក្រុម')) + ' · ' + inbox.length + '</div><div class="hph-list">' +
        inbox.map(function (x, i) { return '<label class="hph-row"><input type="checkbox" data-inbox="' + i + '" checked><span class="fn"><b>' + esc(x.name) + '</b><small>' + esc((x.from || '') + ' · ' + (x.at || '') + ' · ' + kb(x.size || 0)) + '</small></span><span></span></label>'; }).join('') +
        '</div><div class="hph-act"><button class="hph-sub" data-act="inbox">📥 ' + esc(L('把勾選的群組檔案加入下方清單', 'Add the ticked group files to the list below', 'បន្ថែម')) + '</button></div>';
    }
    if (items.length) {
      h += '<div class="hph-sec">' + esc(L('準備匯入', 'Ready to import', 'រៀបចំនាំចូល')) + ' · ' + items.length + '</div><div class="hph-list">' + items.map(function (it, i) {
        var tag = it.unsupported ? '<span class="hph-tag t-bad">' + esc(L('不匯入', 'skipped', 'រំលង')) + '</span>' : it.before ? '<span class="hph-tag t-old">' + esc(L('已匯入過 ', 'imported before ', 'បាននាំចូល ') + it.before) + '</span>' : it.ask ? '<span class="hph-tag t-ask">' + esc(L('請選模組', 'choose module', 'ជ្រើស')) + '</span>' : it.auto ? '<span class="hph-tag t-auto">' + esc(L('自動判斷', 'auto', 'ស្វ័យប្រវត្តិ')) + '</span>' : '';
        var sel = it.unsupported ? '<small style="color:#991b1b">' + esc(it.unsupported) + '</small>' :
          '<select data-tool="' + i + '"><option value="">' + esc(L('— 選擇模組 —', '— choose module —', '— ជ្រើស —')) + '</option>' + ORDER.map(function (t) { return '<option value="' + t + '"' + (it.tool === t ? ' selected' : '') + '>' + esc(nm(t)) + '</option>'; }).join('') + '</select>';
        return '<label class="hph-row"><input type="checkbox" data-pick="' + i + '"' + (it.pick ? ' checked' : '') + (it.unsupported ? ' disabled' : '') + '><span class="fn"><b>' + esc(it.file.name) + tag + '</b><small>' + esc((it.via ? it.via + ' · ' : '') + kb(it.file.size) + (it.period ? ' · ' + it.period : '')) + '</small></span>' + sel + '</label>';
      }).join('') + '</div><div class="hph-act"><button class="hph-go" data-act="go"' + (busy ? ' disabled' : '') + '>⇧ ' + esc(L('開始匯入勾選的檔案', 'Import the ticked files', 'នាំចូល')) + '</button><button class="hph-sub" data-act="clear">' + esc(L('清空清單', 'Clear list', 'សម្អាត')) + '</button></div>';
    }
    h += '<div data-results></div>';
    return h;
  }
  function render() {
    [modal && modal.querySelector('.hph-bd'), embedRoot && embedRoot.querySelector('[data-body]')].forEach(function (host) {
      if (!host) return;
      var keep = host.querySelector('[data-results]'), saved = keep ? keep.innerHTML : '';
      host.innerHTML = bodyHtml();
      host.querySelector('[data-results]').innerHTML = saved;
      bindDrop(host); bindList(host);
    });
  }
  function bindList(host) {
    host.querySelectorAll('[data-pick]').forEach(function (c) { c.onchange = function () { items[+c.dataset.pick].pick = c.checked; }; });
    host.querySelectorAll('[data-tool]').forEach(function (s) { s.onchange = function () { var it = items[+s.dataset.tool]; it.tool = s.value; it.ask = !s.value; if (s.value && !it.before) it.pick = true; render(); }; });
    var go = host.querySelector('[data-act=go]'); if (go) go.onclick = function () { api.importPicked(); };
    var cl = host.querySelector('[data-act=clear]'); if (cl) cl.onclick = function () { items = []; render(); };
    var ib = host.querySelector('[data-act=inbox]'); if (ib) ib.onclick = function () { addInboxPicked(host); };
  }
  function results(html, append) {
    [modal && modal.querySelector('[data-results]'), embedRoot && embedRoot.querySelector('[data-results]')].forEach(function (r) { if (r) r.innerHTML = append ? r.innerHTML + html : html; });
  }
  function openModal() {
    css();
    if (modal) { modal.style.display = 'flex'; render(); refreshInbox(); return; }
    modal = doc.createElement('div'); modal.className = 'hph-mask';
    modal.innerHTML = '<div class="hph-card" role="dialog" aria-modal="true"><div class="hph-hd"><b>⇧ ' + esc(L('智慧匯入', 'Smart import', 'នាំចូលឆ្លាតវៃ')) + '</b><span style="color:#64748b;font-size:12px">' + esc(L('一個入口，自動分到各模組', 'One entry — sorted to each module automatically', 'ច្រកតែមួយ')) + '</span><button class="x" data-x>✕</button></div><div class="hph-bd"></div></div>';
    modal.addEventListener('click', function (e) { if (e.target === modal || e.target.hasAttribute('data-x')) { if (!busy) modal.style.display = 'none'; } });
    doc.body.appendChild(modal);
    render(); refreshInbox();
  }

  /* ── 加入檔案 ── */
  async function addFiles(files, extra) {
    var leaves = [];
    for (var i = 0; i < files.length; i++) {
      try { await expand(files[i], extra && extra.via || '', leaves, 0); } catch (e) { leaves.push({ file: files[i], unsupported: (e && e.message) || String(e) }); }
    }
    var log = await logRead();
    for (var j = 0; j < leaves.length; j++) {
      var it = leaves[j];
      if (extra && extra.inboxId) it.inboxId = extra.inboxId;
      if (!it.unsupported) {
        it.hash = await hashOf(await it.file.arrayBuffer());
        if (items.some(function (x) { return x.hash && x.hash === it.hash; })) continue;   // 同一批重複
        await classify(it);
        var prev = it.hash && log[it.hash];
        if (prev) { it.before = new Date(prev.at).toLocaleDateString(); if (!it.tool) it.tool = prev.tool; it.ask = !it.tool; }
        it.pick = !it.unsupported && !it.before && !!it.tool;
      }
      items.push(it);
    }
    if (!modal || modal.style.display === 'none') { if (!embedRoot) openModal(); }
    render();
  }

  /* ── 匯入：依模組分組，一個模組一次 ── */
  var overlay = null;
  function openOverlay(t) {
    closeOverlay();
    overlay = doc.createElement('div'); overlay.className = 'hph-ov';
    overlay.innerHTML = '<div class="top">⇧ ' + esc(L('正在匯入：', 'Importing: ', 'កំពុងនាំចូល: ') + nm(t)) + '<span style="font-weight:400;opacity:.85;margin-left:6px">' + esc(L('如果模組跳出確認視窗，請在下面回答；完成後會自動關閉', 'If the module asks something, answer it below; this closes by itself when done', 'ឆ្លើយខាងក្រោម')) + '</span></div><iframe title="import"></iframe>';
    doc.body.appendChild(overlay);
    var f = overlay.querySelector('iframe'); f.src = MODS[t].page + '?hub=1&t=' + Date.now();
    return f;
  }
  function closeOverlay() { if (overlay) { try { overlay.querySelector('iframe').src = 'about:blank'; } catch (_) {} overlay.remove(); overlay = null; } }
  async function frameWindow(f, t) {
    var t0 = Date.now();
    while (Date.now() - t0 < 60000) {
      var w = null; try { w = f.contentWindow; } catch (_) {}
      if (w && w.document && w.document.readyState === 'complete' && syncState(w, t)) return w;
      await sleep(300);
    }
    throw new Error(L('模組頁打不開', 'The module page did not open'));
  }
  async function importTool(t, list) {
    var w = g, local = t === HERE, f = null, since, res, up;
    if (!local) { f = openOverlay(t); w = await frameWindow(f, t); }
    await waitReady(w, t, 90000);
    since = Date.now();
    res = await runImporter(w, t, list.map(function (x) { return x.file; }));
    up = await waitUploaded(w, t, since);
    var period = periodNow(w, t) || (list.filter(function (x) { return x.period; }).pop() || {}).period || '';
    if (!local) closeOverlay();
    return { tool: t, files: list, text: res.text, ok: res.ok, okNames: res.okNames || [], sync: up, period: period };
  }
  async function importPicked() {
    if (busy) return;
    var picked = items.filter(function (x) { return x.pick && !x.unsupported; });
    var missing = picked.filter(function (x) { return !x.tool; });
    if (missing.length) { results('<div class="hph-res bad">' + esc(L('有檔案還沒選模組：', 'Choose a module for: ', 'ជ្រើសម៉ូឌុល: ') + missing.map(function (x) { return x.file.name; }).join('、')) + '</div>'); return; }
    if (!picked.length) { results('<div class="hph-res">' + esc(L('沒有勾選要匯入的檔案（已匯入過的預設不勾，要重匯請打勾）', 'Nothing ticked (files imported before are unticked; tick to re-import)', 'មិនបានជ្រើស')) + '</div>'); return; }
    busy = true; render(); results('');
    var groups = {}; picked.forEach(function (x) { (groups[x.tool] = groups[x.tool] || []).push(x); });
    var order = ORDER.filter(function (t) { return groups[t]; }), log = await logRead(), done = [];
    for (var i = 0; i < order.length; i++) {
      var t = order[i];
      results('<div class="hph-res" data-run="' + t + '"><span class="m">⏳ ' + esc(nm(t)) + '</span> ' + esc(L('匯入中…', 'importing…', 'កំពុងនាំចូល…')) + '</div>', true);
      var r;
      try { r = await importTool(t, groups[t]); }
      catch (e) { closeOverlay(); r = { tool: t, files: groups[t], text: (e && e.message) || String(e), ok: false, sync: { state: 'error' } }; }
      done.push(r);
      var okList = groups[t].filter(function (x) { return (r.okNames || []).indexOf(x.file.name) >= 0; });
      okList.forEach(function (x) { log[x.hash] = { tool: t, name: x.file.name, at: Date.now() }; x.before = new Date().toLocaleDateString(); x.pick = false; });
      await logWrite(log);
      var inboxIds = okList.filter(function (x) { return x.inboxId; }).map(function (x) { return x.inboxId; });
      if (inboxIds.length && r.ok) inboxDone(inboxIds, t, r);
      showResult(r);
    }
    busy = false; render();
    done.forEach(showResult);
    if (g.HomeSync && g.HomeSync.refreshLang) try { g.HomeSync.refreshLang(); } catch (_) {}
  }
  function syncLabel(s) {
    var st = s && s.state;
    if (st === 'synced') return '☁ ' + L('已上傳雲端', 'uploaded to cloud', 'បានផ្ទុក');
    if (st === 'checked' || st === 'nochange') return '☁ ' + L('雲端已是最新（沒有新變更）', 'cloud already up to date (no new changes)', 'ទាន់សម័យ');
    if (st === 'empty') return '☁ ' + L('已上傳雲端', 'uploaded to cloud', 'បានផ្ទុក');
    if (st === 'timeout') return '⚠ ' + L('上傳還在進行，稍後模組會自動續傳', 'upload still running — the module resumes it automatically', 'កំពុងបន្ត');
    return '⚠ ' + L('雲端待重試（模組會自動重試）', 'cloud retry pending (the module retries automatically)', 'រង់ចាំ') + (s && s.detail ? ' · ' + s.detail : '');
  }
  function showResult(r) {
    var m = MODS[r.tool], host = [modal && modal.querySelector('[data-results]'), embedRoot && embedRoot.querySelector('[data-results]')];
    var html = '<div class="hph-res" data-done="' + r.tool + '"><div class="m ' + (r.ok ? 'ok' : 'bad') + '">' + (r.ok ? '✅ ' : '⚠ ') + esc(nm(r.tool)) + ' · ' + r.files.length + ' ' + esc(L('個檔', 'file(s)', 'ឯកសារ')) + (r.period ? ' · ' + esc(r.period) : '') + '</div>' +
      '<div style="font-size:12px;color:#334155">' + esc(syncLabel(r.sync)) + '</div><pre>' + esc(String(r.text || '').slice(0, 1200)) + '</pre>';
    if (r.ok) {
      html += '<div style="margin:6px 0 2px;font-weight:600;color:#0f172a">' + esc(L('要不要發到群組？（會先開預覽，由你按發送）', 'Send to the group? (a preview opens first; you press Send)', 'ផ្ញើទៅក្រុម?')) + '</div><div class="hph-act" style="margin-top:4px">' +
        '<a class="b-sum" href="' + esc(tgLink(r.tool, 'summary', r.period)) + '">✈️ ' + esc(L('發摘要', 'Send summary', 'ផ្ញើសង្ខេប')) + '</a>' +
        (m.approval ? '<a class="b-apr" href="' + esc(tgLink(r.tool, 'approval', r.period)) + '">✅ ' + esc(L('送核可', 'Request approval', 'ស្នើអនុម័ត')) + '</a>' : '') +
        '<a class="b-open" href="' + esc(m.page) + '">' + esc(L('開啟模組', 'Open module', 'បើក')) + '</a></div>';
    }
    html += '</div>';
    host.forEach(function (h) {
      if (!h) return;
      var old = h.querySelector('[data-run="' + r.tool + '"]') || h.querySelector('[data-done="' + r.tool + '"]');
      if (old) old.outerHTML = html; else h.insertAdjacentHTML('beforeend', html);
      // same page: let the links open the modal here instead of reloading
      if (r.tool === HERE) h.querySelectorAll('[data-done="' + r.tool + '"] a.b-sum,[data-done="' + r.tool + '"] a.b-apr').forEach(function (a) {
        a.onclick = function (e) { e.preventDefault(); if (modal) modal.style.display = 'none'; openTelegram(r.tool, a.classList.contains('b-apr') ? 'approval' : 'summary', r.period); };
      });
    });
  }

  /* ══ Telegram 群組收件匣（GAS） ══ */
  async function gasGet(params) {
    var u = gasUrl(); if (!u) throw new Error('GAS');
    var r = await fetch(u + (u.indexOf('?') >= 0 ? '&' : '?') + params + '&t=' + Date.now(), { cache: 'no-store' });
    var j = await r.json(); if (!j || j.ok === false) throw new Error(j && j.error || 'GAS'); return j.data || j;
  }
  async function gasPost(body) {
    var r = await fetch(gasUrl(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
    var j = await r.json(); if (!j || j.ok === false) throw new Error(j && j.error || 'GAS'); return j.data || j;
  }
  async function refreshInbox() {
    try { var d = await gasGet('action=inboxList'); inbox = Array.isArray(d.items) ? d.items.filter(function (x) { return !x.done; }) : []; }
    catch (_) { inbox = []; }
    updateBadges(); render();
  }
  function updateBadges() {
    doc.querySelectorAll('[data-hph-badge]').forEach(function (b) { b.textContent = inbox.length ? String(inbox.length) : ''; b.style.display = inbox.length ? '' : 'none'; });
  }
  async function addInboxPicked(host) {
    var picks = Array.prototype.slice.call(host.querySelectorAll('[data-inbox]')).filter(function (c) { return c.checked; }).map(function (c) { return inbox[+c.dataset.inbox]; });
    for (var i = 0; i < picks.length; i++) {
      var x = picks[i];
      try {
        var d = await gasGet('action=inboxFile&id=' + encodeURIComponent(x.id));
        var bin = atob(d.b64 || ''), u8 = new Uint8Array(bin.length); for (var j = 0; j < bin.length; j++) u8[j] = bin.charCodeAt(j);
        await addFiles([new File([u8], d.name || x.name, { type: d.mime || '' })], { via: '📥 ' + L('群組', 'group', 'ក្រុម') + (x.from ? ' · ' + x.from : ''), inboxId: x.id });
      } catch (e) { results('<div class="hph-res bad">' + esc(x.name + ' — ' + ((e && e.message) || e)) + '</div>', true); }
    }
  }
  function inboxDone(ids, t, r) { gasPost({ action: 'inboxDone', ids: ids, tool: t, period: r.period || '', note: String(r.text || '').slice(0, 300) }).then(refreshInbox, function () {}); }

  /* ══ 頁首按鈕：每頁最上面（有固定頁首就放進頁首，沒有就固定在右上角） ══ */
  function barHtml() {
    var b = '<button class="hph-b-imp" type="button" data-hph-open title="' + esc(L('Excel／msg／zip 丟這裡，自動分到各模組', 'Drop Excel/msg/zip here — sorted to each module', '')) + '">⇧ ' + esc(L('智慧匯入', 'Smart import', 'នាំចូល')) + '<span class="hph-badge" data-hph-badge style="display:none"></span></button>';
    if (HERE && g.HRPayReport) b += '<button class="hph-b-rep" type="button" data-hph-report>📝 ' + esc(L('報告', 'Report', 'របាយការណ៍')) + '</button>';
    return b;
  }
  function mountBar() {
    css();
    if (doc.getElementById('hph-bar')) return;
    var bar = doc.createElement('span'); bar.id = 'hph-bar'; bar.className = 'hph-bar no-print'; bar.innerHTML = barHtml();
    var header = doc.querySelector('header'), area = null;
    if (header) {
      var sp = header.querySelector('.flex-1');
      area = (sp && sp.nextElementSibling) || header.querySelector('.hbtns,.hright') || header.querySelector(':scope > div > .ml-auto, :scope > .ml-auto') || header.querySelector('.row');
      // 頁首固定在最上面（原本沒固定的頁也固定），按鈕永遠看得到
      try { if (getComputedStyle(header).position === 'static') { header.style.position = 'sticky'; header.style.top = '0'; header.style.zIndex = '60'; } } catch (_) {}
    }
    if (area) area.insertBefore(bar, area.firstChild);
    else if (header) (header.firstElementChild || header).appendChild(bar);
    else { bar.classList.add('hph-float'); doc.body.appendChild(bar); }
    bindBar(bar);
  }
  function bindBar(bar) {
    bar.querySelector('[data-hph-open]').onclick = function () { openModal(); };
    var rb = bar.querySelector('[data-hph-report]'); if (rb) rb.onclick = function () { g.HRPayReport.open(HERE); };
    updateBadges();
  }
  // 頁面重畫（例如切換語言）把頁首整個換掉時，自動補回按鈕
  function keepBar() {
    try { new MutationObserver(function () { if (!doc.getElementById('hph-bar')) mountBar(); }).observe(doc.body, { childList: true, subtree: false }); } catch (_) {}
    var lastLang = lang();
    setInterval(function () { if (!doc.getElementById('hph-bar')) mountBar(); var l = lang(); if (l !== lastLang) { lastLang = l; refreshLang(); } }, 1000);
  }
  function mountEmbed(el) {
    css(); embedRoot = el; el.classList.add('hph-emb');
    el.innerHTML = '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px"><b style="font-size:15px">⇧ ' + esc(L('智慧匯入', 'Smart import', 'នាំចូលឆ្លាតវៃ')) + '</b><span style="color:#64748b;font-size:12px">' + esc(L('一個入口，自動分到各模組；匯完問要不要發摘要／核可', 'One entry, sorted automatically; then choose to send a summary / approval', '')) + '</span><span class="hph-badge" data-hph-badge style="display:none"></span></div><div data-body></div>';
    render(); refreshInbox();
  }
  function refreshLang() {
    var b = doc.getElementById('hph-bar'); if (b) { b.innerHTML = barHtml(); bindBar(b); }
    if (embedRoot) mountEmbed(embedRoot); render(); updateBadges();
  }

  /* ── 網址 ?tg=summary|approval&period=YYYY-MM：開 Telegram 視窗並預選（不會自動發送） ── */
  function handleDeepLink() {
    var q = new URLSearchParams(location.search), mode = q.get('tg');
    if (!mode || !HERE) return;
    openTelegram(HERE, mode === 'approval' ? 'approval' : 'summary', q.get('period') || '');
    try { history.replaceState(null, '', location.pathname); } catch (_) {}
  }

  var api = {
    version: VERSION, MODS: MODS, RULES: RULES, here: HERE,
    open: openModal, addFiles: addFiles, importPicked: importPicked, mountEmbed: mountEmbed, refreshLang: refreshLang,
    openTelegram: openTelegram, items: function () { return items; }, busy: function () { return busy; }, refreshInbox: refreshInbox,
    _classify: function (name, wb) { return score(readCtx(name, wb)); }
  };
  g.HRPayHub = api;
  function boot() {
    if (/[?&]hub=1/.test(location.search)) return;          // 在匯入小視窗裡：不加按鈕
    mountBar(); keepBar(); handleDeepLink();
    if (!doc.getElementById('home-import')) refreshInbox();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 50); }); else setTimeout(boot, 50);
})(window);
