/* AC-HRA-PAY English-mode cleaner v1.0 (2026-09-29)
 * Purpose: when a page is switched to English, no Chinese is left on screen.
 *  - bilingual labels such as "期間 Period", "匯出 Export", "上傳至雲端 Upload to cloud",
 *    "沿用上期／線上操作 · Carry forward · ចម្លង" show only their English part
 *  - Chinese-only labels are translated from the dictionary below
 *  - switching back to Chinese restores the original text exactly
 *  - the chosen language is remembered across all AC-HRA-PAY pages (localStorage "hrpay_lang",
 *    the same key the portal home page uses: tc / en / km). Khmer falls back to English on
 *    pages that only have Chinese / English.
 * Never touched: input values, textarea, <pre>, contenteditable, [data-noi18n], language buttons.
 * Data typed in Chinese only (e.g. a reason written in Chinese) is left as is.
 */
(function (g) {
  'use strict';
  if (g.HRPayI18n) return;
  var CJK = /[㐀-鿿豈-﫿　-〿！-＊，-～]/;
  var CJK_G = /[㐀-鿿豈-﫿　-〿！-＊，-～]/g;
  var LATIN = /[A-Za-z]/;
  var KHMER = /[ក-៿]/;

  // Chinese-only UI strings (exact text after trimming) → English
  var DICT = {
    '上傳': 'Upload', '下載': 'Download', '預支': 'Advance', '正式': 'Payroll', '線上維護': 'Online edit',
    '清除全部': 'Clear local', '無': 'None', '尚無資料': 'No data yet', '人': 'staff',
    'GAS 已連線': 'GAS connected', '月中上傳 · 立即觸發第一階段分析': 'Mid-month upload · runs stage-1 analysis',
    '月末上傳 · 觸發第二階段完整分析': 'Month-end upload · runs full stage-2 analysis',
    '支援非同步上傳：可先傳預付薪資，15天後再傳正式薪資': 'Files can arrive separately: upload Advance first, Payroll about 15 days later',
    '上傳至雲端': 'Upload to cloud', '從雲端下載': 'Download from cloud', '上傳至雲端 Sheet': 'Upload to cloud Sheet',
    '傳送預付薪資摘要至 Telegram': 'Send Advance summary to Telegram', '傳送正式薪資摘要至 Telegram': 'Send Payroll summary to Telegram',
    '傳送至 Telegram': 'Send to Telegram', '線上新增／修改／刪除': 'Online add / edit / delete', '清除所有資料': 'Clear local cache',
    '跨模組 Projection 交叉核對 · AC-HRA-PAY': 'Cross-module projection check · AC-HRA-PAY',
    '☁ 檢查雲端': '☁ Check cloud', '☁ 檢查中…': '☁ Checking…', '▶ 執行交叉核對': '▶ Run cross-check',
    '執行本月交叉核對': 'Run this month’s cross-check',
    '✅ 雲端已是最新 · 無重複下載': '✅ Cloud up to date · nothing re-downloaded',
    '☁ 比對雲端版本…': '☁ Comparing cloud versions…',
    'Payroll 實領': 'Payroll net pay', 'Advance 首期': 'Advance (1st payment)',
    '⚠ 資料未齊': '⚠ Data incomplete', '尚無 Payroll Projection': 'No Payroll projection yet',
    '📦 Projection 資料來源狀態': '📦 Projection data sources',
    '：尚無 Projection（請先到對應模組匯入 Excel）': ': no projection yet (import the Excel in that module first)',
    '（此尺度無來源資料）': '(no source data for this scale)',
    '可自行勾選要加總的項目。Payroll「實領」為 Payroll 檔最終實發；Advance 為首期預支／首期發放，因此勾選 Payroll + Advance 可看當月兩階段現金發放，再加 Meal B1/B2 可看含餐費的總現金支出。': 'Tick the items to add up. Payroll “net pay” is the final amount paid in the Payroll file; Advance is the first-phase payment, so Payroll + Advance shows both cash payments of the month; add Meal B1/B2 to see total cash including meal fees.',
    '這裡直接加總 Payroll Projection 的逐人欄位，不用總額反推。若舊 Projection 沒有分項欄位，會明示要求重新開啟 Payroll 產生新版 Projection，不把缺欄位當作 0。': 'Adds the per-person fields of the Payroll projection directly (no back-calculation from totals). If an old projection lacks component fields, you will be asked to reopen Payroll to regenerate it; missing fields are never treated as 0.',
    '本頁只做交叉核對，不重新計算薪資，也不會上傳任何資料。開頁／按「檢查雲端」會先比對小型雲端版本資訊；只有版本變更才下載完整 Projection，避免重複下載。': 'This page only cross-checks; it does not recalculate pay or upload anything. Opening the page / “Check cloud” compares a small version stamp first and downloads the full projection only when it changed.',
    '已核可': 'Approved', '待審核': 'Pending review', '待審查': 'Pending review', '待核可': 'Pending approval',
    '已退件': 'Rejected', '已退回': 'Returned', '已刪除': 'Deleted', '已失效': 'Expired', '有效': 'Active',
    '全部': 'All', '全廠': 'All factory', '部門': 'Department', '合計': 'Total', '小計': 'Subtotal',
    '編輯': 'Edit', '刪除': 'Delete', '儲存': 'Save', '取消': 'Cancel', '關閉': 'Close', '確認': 'Confirm',
    '新增': 'Add', '搜尋': 'Search', '匯出': 'Export', '匯入': 'Import', '預覽': 'Preview', '送出': 'Submit',
    '→ 判定為': '→ detected as', '預付薪資': 'Advance pay', '正式薪資': 'Payroll', '（依檔名判定）': '(by file name)', '（依Summary 標題判定）': '(by Summary title)',
    '📌 所選月份的預付與正式檔皆已齊全。': '📌 Both Advance and Payroll files are in for this month.',
    '查看詳情': 'View details', '每日工時成本 $/hr': 'Labour cost per hour $/hr', '無資料': 'No data', '人數': 'Headcount',
    '包含：Line N、Garment、Sewer、Service in Line 等生產線部門 · 部門表中以 🧵 標記': 'Includes production-line departments (Line N, Garment, Sewer, Service in Line) · marked 🧵 in the department table',
    '📤 Projection 已輸出（本機+雲端）': '📤 Projection exported (local + cloud)', 'Projection 已輸出（本機+雲端）': 'Projection exported (local + cloud)',
    'Special OT 為另行現金發放，預設不併入薪資；勾選後只在成本分析中外加，不改 Payroll 原始實領。': 'Special OT is paid separately in cash and is not included by default; ticking it adds it to the cost analysis only and never changes Payroll net pay.',
    '稽核公式 Audit Identity（已對 May-2026 全廠 517 人實檔驗證，零誤差）：': 'Audit identity (verified on the May-2026 file for all 517 staff, zero difference):',
    '= 基本薪合計 + 獎勵 + 年假給付 + 交通 + 獎金': '= Base total + Incentive + Annual-leave pay + Travel + Bonus',
    '+ 達標/不良扣5%/停工/時假/事假/換休/欠款': '+ Target / 5% defect cut / Suspension / Hourly leave / Personal leave / Day swap / Debt',
    '− 預支扣回': '− Advance deduction', '② 實領': '② Net pay', '實領': 'Net pay',
    '= 小計 + 加班假日合計 − NSSF − 工會費 − 薪資稅': '= Subtotal + OT & holiday total − NSSF − Union fee − Salary tax',
    '· 差異 > $1.50 且 > 0.3% 才標記為異常': '· Flagged only when the difference is > $1.50 and > 0.3%',
    'ℹ️ 加班假日合計（欄30）已內含平日加班（欄27），不重複相加；扣項自欄 33-35 讀取': 'ℹ️ OT & holiday total (col 30) already includes regular OT (col 27), so it is not added twice; deductions are read from cols 33-35',
    '狀態': 'Status', '計算值': 'Computed', '申報值': 'Stated', '申報薪資 Stated：': 'Stated:', '重算值 Computed：': 'Computed:', '差額：': 'Difference:',
    '（申報值高於重算值 (stated > computed)）': '(stated > computed)', '（申報值低於重算值 (stated < computed)）': '(stated < computed)',
    '搜尋 ID/姓名…': 'Search ID / name…', '搜尋工號/姓名': 'Search ID / name', '搜尋日期 / 星期…': 'Search date / weekday…', '查詢核可狀態': 'Check approval status',
    '公式：Total Salary × 4,080 KHR，限制 400,000–1,200,000 KHR，× 2% 退休金率': 'Formula: Total Salary × 4,080 KHR, capped at 400,000–1,200,000 KHR, × 2% pension rate',
    '總額': 'Total', '人均': 'Per capita', '日均': 'Daily avg', '週均': 'Weekly avg', '月': 'Month', '年化': 'Annualised', '顯示': 'Showing',
    '。數值為': '. Values are', '數值為': 'Values are', '部門加總': 'Department total', '總覽': 'Overview', '當月': 'This month', '當月實際': 'actual this month', '基準': 'Basis',
    '全廠': 'All factory', '部門': 'Department',
    '只使用已實際匯入的 Payroll 月份；3/6/12 月不足時不補 0、不猜值。': 'Only months with an imported Payroll file are used; if 3/6/12 months are not available, nothing is filled with 0 or guessed.',
    'Base、OT、Net 三條公式同時自檢；0 是有效值，不會因為是 0 就當成「沒抓到」。': 'Base, OT and Net formulas are self-checked together; 0 is a valid value and is never treated as “not found”.',
    '唯一鍵：Start + End + Seq；同一天不同事件可並存。': 'Unique key: Start + End + Seq; different events on the same day can coexist.',
    '一般 OT/Bonus：Type + Month + Department；Special OT：再加 Employee ID，並保留來源現金表各分項。': 'Normal OT/Bonus: Type + Month + Department; Special OT: plus Employee ID, keeping every component of the source cash sheet.',
    '唯一鍵：Period + Pay Type + Employee ID；儲存為 Upsert，不會重複累加。': 'Unique key: Period + Pay Type + Employee ID; saving updates in place and never double-counts.',
    '上一期': 'Previous', '下一期': 'Next', '備註': 'Note', '來源': 'Source', '時間': 'Time', '每月': 'Monthly', '年報': 'Yearly report', '月報': 'Monthly report',
    '缺檔不影響已匯入的部分，補傳後會自動重算並升級為 Stage 2。': 'A missing file does not affect what is imported; upload it later and the analysis is recalculated as Stage 2.',
    '無法判斷是預付還是正式，請用下方對應區塊手動上傳': 'Cannot tell whether this is Advance or Payroll — upload it in the matching box below',
    '無法辨識月份，請用下方對應區塊手動上傳': 'Cannot detect the month — upload it in the matching box below',
    '未找到員工記錄，請確認工作表格式': 'No employee rows found — check the sheet format',
    '來源欄位：實際固定薪分項使用 Payroll 隱藏計算欄 Basic/Seniority/Position/Skill/Language；OT 使用 Night/Holiday/Regular/Night OT/Sunday；Net 以 Subtotal + OT − NSSF − Union − Tax 驗證。若來源版型變動，這裡會先亮紅，不會把錯欄位默默當成 $0。': 'Source columns: actual fixed-pay parts use the hidden Payroll columns Basic/Seniority/Position/Skill/Language; OT uses Night/Holiday/Regular/Night OT/Sunday; Net is checked as Subtotal + OT − NSSF − Union − Tax. If the source layout changes this turns red instead of silently treating a wrong column as $0.',
    '搜尋 工號 / 姓名 / 部門 / 事由…': 'Search ID / name / department / reason…', '上一份快照': 'Previous snapshot', '下一份快照': 'Next snapshot',
    '搜尋 工號 / 姓名 / 部門 / 職務…': 'Search ID / name / department / position…', '離職日（如有）': 'Resign date (if any)',
    '搜尋 ID / 姓名 / 部門…': 'Search ID / name / department…',
    '口頭': 'Verbal', '小過': 'Minor', '中過': 'Medium', '大過': 'Major', '最後警告': 'Final warning', '停職': 'Suspension'
  };
  // Chinese fragments inside mixed sentences
  var FRAG = [
    [/^✅ (\d+) 個檔案全部匯入成功$/, function (m) { return '✅ All ' + m[1] + ' file(s) imported'; }],
    [/^⚠ (\d+)\/(\d+) 個成功，請看下方說明$/, function (m) { return '⚠ ' + m[1] + '/' + m[2] + ' imported — see details below'; }],
    [/^⏳ 解析 (\d+) 個檔案中…$/, function (m) { return '⏳ Reading ' + m[1] + ' file(s)…'; }],
    [/^預(\d+|—)$/, function (m) { return 'Adv ' + m[1]; }],
    [/^正(\d+|—)$/, function (m) { return 'Pay ' + m[1]; }],
    [/^(\d+)\s*部門$/, function (m) { return m[1] + ' departments'; }],
    [/^⚠ 缺 (.+)；缺資料不等於 \$0$/, function (m) { return '⚠ Missing ' + m[1].replace(/、/g, ', ') + '; missing data is not $0'; }],
    [/^(\d+)\s*人$/, function (m) { return m[1] + ' staff'; }],
    [/^(\d+)\s*筆$/, function (m) { return m[1] + ' records'; }]
  ];

  var origText = new WeakMap(), origAttr = new WeakMap(), missing = {};
  var SKIP = 'textarea,pre,script,style,[contenteditable="true"],[data-noi18n],[data-en],.lgbtn,.lang,[data-lang],[data-l],[onclick*="toggleLang"],[onclick*="setLang"],#hrpay-lang-fab';

  function lang() {
    try { if (typeof LANG !== 'undefined') return LANG; } catch (_) {}
    return g.__hrpayLang || 'zh';
  }
  function isEnMode() { var l = lang(); return l === 'en' || l === 'km'; }

  function cleanSide(s) { return s.replace(/^[\s·|｜/／:：\-–—]+|[\s·|｜/／:：\-–—]+$/g, ''); }

  // Khmer mixed into an English/Chinese label ("Payroll ប្រាក់ខែ") is dropped in English mode;
  // Khmer-only text (e.g. a Khmer name) is data and stays.
  function stripKhmer(x) {
    if (!KHMER.test(x) || !(LATIN.test(x) || CJK.test(x))) return x;
    var segs = x.split(/\s+\/\s+|\s+·\s+|\s*｜\s*/);
    if (segs.length > 1) {
      var keep = [];
      segs.forEach(function (z) {
        if (!KHMER.test(z)) return keep.push(z);
        var rest = z.replace(/[\u1780-\u17ff\u19e0-\u19ff][\u1780-\u17ff\u19e0-\u19ff\s.,;:!?\u17d4\u17d5\-–—()]*/g, ' ').replace(/\s{2,}/g, ' ').trim();
        // drop the Khmer segment when its leftover Latin just repeats text already shown ("… / Excel ជា…")
        if (!rest || keep.some(function (k) { return k.indexOf(rest) >= 0; })) return;
        keep.push(rest);
      });
      if (keep.length) return keep.join(x.indexOf(' / ') >= 0 ? ' / ' : ' · ');
    }
    return x.replace(/\s*[\/·|｜]?\s*[\u1780-\u17ff\u19e0-\u19ff][\u1780-\u17ff\u19e0-\u19ff\s.,;:!?\u17d4\u17d5\-–—()]*/g, ' ').replace(/\s{2,}/g, ' ').replace(/\s+([,;:.)])/g, '$1').replace(/[\s\/·|｜]+$/, '');
  }
  function toEn(text) {
    var raw = String(text), t = raw.trim();
    if (KHMER.test(t) && (LATIN.test(t) || CJK.test(t))) {
      var lead0 = raw.match(/^\s*/)[0], trail0 = raw.match(/\s*$/)[0], k = stripKhmer(t).trim();
      if (k !== t) { var r0 = toEn(k); return lead0 + r0.trim() + trail0; }
    }
    if (!CJK.test(t)) return raw;
    var lead = raw.match(/^\s*/)[0], trail = raw.match(/\s*$/)[0];
    if (Object.prototype.hasOwnProperty.call(DICT, t)) return lead + DICT[t] + trail;
    for (var i = 0; i < FRAG.length; i++) { var fm = t.match(FRAG[i][0]); if (fm) return lead + FRAG[i][1](fm) + trail; }
    // only full-width punctuation left (e.g. "Meal B1（1–15）") → ASCII punctuation
    var ascii = t.replace(/（/g, '(').replace(/）/g, ')').replace(/：/g, ': ').replace(/，/g, ', ').replace(/；/g, '; ').replace(/、/g, ', ').replace(/「|」/g, '"').replace(/。/g, '. ');
    if (!CJK.test(ascii)) return lead + ascii + trail;
    // leading symbols / emoji (kept)
    var pm = t.match(/^[^㐀-鿿A-Za-z0-9ក-៿（(【\[]*/), prefix = pm ? pm[0] : '', body = t.slice(prefix.length);
    if (Object.prototype.hasOwnProperty.call(DICT, body)) return lead + prefix + DICT[body] + trail;
    // "中文 / English", "中文｜English", "中文 · English · ខ្មែរ"
    var parts = body.split(/\s+[·|｜]\s+|\s+\/\s+|\s*｜\s*|\s+\/(?=[A-Za-z])/);
    if (parts.length > 1) {
      for (var p = 0; p < parts.length; p++) {
        var cand = cleanSide(parts[p]);
        if (cand && LATIN.test(cand) && !CJK.test(cand) && !KHMER.test(cand)) {
          var rest = parts.slice(p + 1).filter(function (x) { return x && !CJK.test(x) && !KHMER.test(x); });
          return lead + prefix + [cand].concat(rest).join(' · ') + trail;
        }
      }
    }
    if (parts.length > 1 && !toEn.depth) {
      toEn.depth = 1;
      try {
        var tr = parts.map(function (x) { return toEn(x).trim(); });
        if (!tr.some(function (x) { return CJK.test(x); })) return lead + prefix + tr.join(' · ') + trail;
      } finally { toEn.depth = 0; }
    }
    // Chinese first, English after:  "期間 Period", "💰 費用加總 Cost Total"
    var m1 = body.match(/^([㐀-鿿豈-﫿　-〿！-＊，-～\s·／/（）()]+)\s*([A-Za-z].*)$/);
    if (m1 && !CJK.test(m1[2])) return lead + prefix + cleanSide(m1[2]) + trail;
    // English first, Chinese after: "Summary Center 總覽核對中心", "Payroll 實領合計"
    var m2 = body.match(/^([A-Za-z0-9][^㐀-鿿]*?)\s+([㐀-鿿豈-﫿　-〿！-＊，-～（）()·\s]+)$/);
    if (m2 && LATIN.test(m2[1])) {
      var tail = m2[2].trim();
      if (Object.prototype.hasOwnProperty.call(DICT, tail)) return lead + prefix + m2[1] + ' ' + DICT[tail] + trail;
      return lead + prefix + cleanSide(m2[1]) + trail;
    }
    // English, Chinese, English: "Payroll 分項成本 Payroll Components" → last English part
    var m3 = body.match(/^(.*?)\s+[\u3400-\u9fff\uf900-\ufaff\u3000-\u303f\uff01-\uff0a\uff0c-\uff5e]+\s+([A-Za-z][^\u3400-\u9fff]*)$/);
    if (m3 && LATIN.test(m3[2])) return lead + prefix + cleanSide(m3[2]) + trail;
    // "(...中文...)" inside English text: drop the Chinese bracket
    var noBr = body.replace(/[（(][^()（）]*[㐀-鿿][^()（）]*[）)]/g, '').trim();
    if (noBr !== body && !CJK.test(noBr) && LATIN.test(noBr)) return lead + prefix + noBr + trail;
    // several short Chinese terms separated by spaces, each in the dictionary: "基準 當月實際"
    var toks = body.split(/\s+/);
    if (toks.length > 1) {
      var tt2 = toks.map(function (x) { return CJK.test(x) ? (Object.prototype.hasOwnProperty.call(DICT, x) ? DICT[x] : null) : x; });
      if (tt2.every(function (x) { return x !== null; })) return lead + prefix + tt2.join(' ') + trail;
    }
    // bilingual pairs in one line: "摘要 Summary＝檢查人 Checked by；核可 Approval＝申請人 Applicant"
    var runs = body.match(/[\u3400-\u9fff\uf900-\ufaff]+/g) || [], words = body.match(/[A-Za-z][A-Za-z.'-]*/g) || [];
    if (runs.length && words.length >= runs.length) {
      var stripped = body.replace(/[\u3400-\u9fff\uf900-\ufaff]+/g, ' ').replace(/＝/g, ' = ').replace(/；/g, '; ').replace(/，/g, ', ').replace(/：/g, ': ')
        .replace(/（/g, '(').replace(/）/g, ')').replace(/、/g, ', ').replace(/「|」/g, '"').replace(/\(\s*\)/g, '').replace(/\s+([,;:)])/g, '$1').replace(/\s{2,}/g, ' ').trim();
      if (!CJK.test(stripped) && LATIN.test(stripped)) return lead + prefix + stripped + trail;
    }
    missing[t] = (missing[t] || 0) + 1;
    return raw;
  }

  function skipEl(el) { try { return !el || (el.closest && el.closest(SKIP)); } catch (_) { return false; } }
  var SKIP_ATTR = SKIP.replace(',[data-en]', '');
  function skipAttrEl(el) { try { return !el || (el.closest && el.closest(SKIP_ATTR)); } catch (_) { return false; } }

  function fixNode(n, en) {
    if (n.nodeType !== 3) return;
    var el = n.parentElement;
    if (en) {
      var v = n.nodeValue;
      if (!v || !(CJK.test(v) || (KHMER.test(v) && LATIN.test(v))) || skipEl(el)) return;
      var e = toEn(v);
      if (e !== v) { origText.set(n, v); n.nodeValue = e; }
    } else if (origText.has(n)) {
      n.nodeValue = origText.get(n); origText.delete(n);
    }
  }
  var ATTRS = ['title', 'placeholder', 'aria-label'];
  function fixAttrs(el, en) {
    if (!el || el.nodeType !== 1) return;
    var saved = origAttr.get(el);
    ATTRS.forEach(function (a) {
      if (en) {
        var v = el.getAttribute(a);
        if (!v || !(CJK.test(v) || (KHMER.test(v) && LATIN.test(v))) || skipAttrEl(el)) return;
        var e = toEn(v);
        if (e !== v) { saved = saved || {}; saved[a] = v; origAttr.set(el, saved); el.setAttribute(a, e); }
      } else if (saved && saved[a] !== undefined) { el.setAttribute(a, saved[a]); delete saved[a]; }
    });
  }
  var busy = false;
  function apply(root) {
    root = root || document.body; if (!root) return;
    var en = isEnMode();
    busy = true;
    try {
      if (root.nodeType === 3) { fixNode(root, en); return; }
      fixAttrs(root, en);
      var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT), n;
      while ((n = w.nextNode())) { if (n.nodeType === 3) fixNode(n, en); else fixAttrs(n, en); }
      if (root === document.body) {
        var tt = document.title; if (en && CJK.test(tt)) { g.__hrpayTitleZh = tt; document.title = toEn(tt); }
        else if (!en && g.__hrpayTitleZh) { document.title = g.__hrpayTitleZh; g.__hrpayTitleZh = null; }
        document.documentElement.lang = en ? 'en' : 'zh-Hant';
      }
    } finally { busy = false; }
  }
  var queue = [], scheduled = false;
  function flush() {
    scheduled = false;
    var q = queue; queue = [];
    if (!isEnMode()) return;
    q.forEach(function (n) { if (n.isConnected) apply(n); });
  }
  function observe() {
    if (!g.MutationObserver || !document.body) return;
    new MutationObserver(function (list) {
      if (busy || !isEnMode()) return;
      list.forEach(function (m) {
        if (m.type === 'childList') m.addedNodes.forEach(function (n) { queue.push(n); });
        else if (m.type === 'characterData') queue.push(m.target);
        else if (m.type === 'attributes') queue.push(m.target);
      });
      if (queue.length && !scheduled) { scheduled = true; (g.requestAnimationFrame || setTimeout)(flush, 16); }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  function remember() {
    try { localStorage.setItem('hrpay_lang', isEnMode() ? (lang() === 'km' ? 'km' : 'en') : 'tc'); } catch (_) {}
  }
  function stored() { try { return localStorage.getItem('hrpay_lang') || localStorage.getItem('ac_hra_lang') || ''; } catch (_) { return ''; } }

  function refreshBadges() { try { if (g.HRPayAutoSync && HRPayAutoSync.refreshBadges) HRPayAutoSync.refreshBadges(); } catch (_) {} }

  function wrap() {
    if (typeof g.toggleLang === 'function' && !g.toggleLang.__hrpay) {
      var tl = g.toggleLang;
      g.toggleLang = function () { var r = tl.apply(this, arguments); remember(); refreshBadges(); apply(); return r; };
      g.toggleLang.__hrpay = true;
    }
    if (typeof g.setLang === 'function' && !g.setLang.__hrpay) {
      var sl = g.setLang;
      g.setLang = function () { var r = sl.apply(this, arguments); remember(); refreshBadges(); apply(); return r; };
      g.setLang.__hrpay = true;
    }
  }
  // pages without their own language switch (Summary Center) get a small 中/EN button
  function addFab() {
    if (!document.body || typeof g.toggleLang === 'function' || typeof g.setLang === 'function' || document.getElementById('hrpay-lang-fab')) return;
    var b = document.createElement('button');
    b.id = 'hrpay-lang-fab'; b.type = 'button'; b.textContent = '中 / EN';
    b.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:9999;padding:8px 12px;border-radius:999px;border:1px solid #cbd5e1;background:#fff;color:#0f2a4a;font:600 12px system-ui,sans-serif;box-shadow:0 4px 14px rgba(15,42,74,.15);cursor:pointer';
    b.onclick = function () { g.__hrpayLang = isEnMode() ? 'zh' : 'en'; remember(); refreshBadges(); apply(); };
    document.body.appendChild(b);
  }
  // native confirm / alert / prompt boxes: in English mode keep only the English lines
  function msgEn(msg) {
    if (!isEnMode() || msg == null) return msg;
    var lines = String(msg).split('\n'), hasLatinLine = lines.some(function (l) { return LATIN.test(l) && !CJK.test(l); });
    var out = lines.map(function (l) { return toEn(l); }).filter(function (l) { return !(hasLatinLine && CJK.test(l)); });
    return out.join('\n');
  }
  ['confirm', 'alert', 'prompt'].forEach(function (k) {
    var orig = g[k];
    if (typeof orig !== 'function' || orig.__hrpay) return;
    g[k] = function (msg) { var a = Array.prototype.slice.call(arguments); a[0] = msgEn(msg); return orig.apply(g, a); };
    g[k].__hrpay = true;
  });
  function start() {
    wrap(); addFab(); observe();
    var want = stored(), wantEn = (want === 'en' || want === 'km');
    setTimeout(function () {
      if (typeof g.setLang === 'function') {
        var target = want === 'km' ? 'km' : (wantEn ? 'en' : 'zh');
        if (lang() !== target && want) g.setLang(target);
      } else if (typeof g.toggleLang === 'function') {
        if (wantEn !== isEnMode()) g.toggleLang();
      } else if (wantEn) { g.__hrpayLang = 'en'; }
      apply();
    }, 60);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  g.HRPayI18n = { apply: apply, toEn: toEn, missing: function () { return Object.keys(missing); }, dict: DICT };
})(window);
