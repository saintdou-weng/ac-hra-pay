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
