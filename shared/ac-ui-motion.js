/* AC UI Motion v1.0（2026-11-22）— 只加滑鼠／捲動動效，不碰資料、按鈕功能、核可、上傳下載。
   1 懸停回饋：按鈕上移 2px、陰影加深、顏色加深 8%（150ms ease-out）。用 CSS「translate」屬性，不覆蓋按鈕原本的 transform。
   2 游標聚光燈：只套在「深色背景」的卡片網格（自動偵測；淺色頁不會出現）。
   3 3D 傾斜：首頁模組卡片（a.card、[data-tilt]）最大 8°、透視 1000px、放大 1.02，離開 300ms 復位。卡片不套用規則 1。
   4 頁首吸頂：捲動 > 80px 後頁首變半透明毛玻璃＋細陰影（深色頁首自動用深色半透明）；高頁首（首頁）收合到約 64px。
   5 回到頂部：捲動超過一屏後右下角淡入 48px 圓鈕，500ms 平滑回頂，到頂淡出；右下角已有浮動按鈕時自動往上排開。
   觸控裝置（沒有滑鼠懸停）只啟用 4、5；系統設定「減少動態效果」時不做動畫。 */
(function (g) {
  'use strict';
  if (g.__acUiMotion) return; g.__acUiMotion = 1;
  var doc = g.document, mm = function (q) { try { return g.matchMedia(q).matches; } catch (_) { return false; } };
  var HOVER = mm('(hover:hover) and (pointer:fine)'), REDUCE = mm('(prefers-reduced-motion: reduce)');
  var CARD = 'a.card,[data-tilt]';

  var css = '' +
    /* 1 懸停回饋（按鈕與一般互動元件；卡片除外） */
    '@media (hover:hover) and (pointer:fine){' +
    'html :is(button,.btn,[role="button"],input[type="button"],input[type="submit"],label[for]):not(:disabled):not([aria-disabled="true"]):not(.uim-off){cursor:pointer;transition:translate 150ms ease-out,box-shadow 150ms ease-out,filter 150ms ease-out,background-color 150ms ease-out,color 150ms ease-out,border-color 150ms ease-out,opacity 150ms ease-out}' +
    'html :is(button,.btn,[role="button"],input[type="button"],input[type="submit"]):not(:disabled):not([aria-disabled="true"]):not(.uim-off):hover{translate:0 -2px;box-shadow:0 6px 14px -4px rgba(15,23,42,.28);filter:brightness(.92)}' +
    'html :is(' + CARD + ') :is(button,.btn,[role="button"]):hover{translate:none}' +
    '}' +
    /* 3 3D 傾斜卡片（覆蓋原本的上移，避免 transform 衝突） */
    '.uim-tilt{transform-style:preserve-3d;will-change:transform}' +
    'html .uim-tilt.uim-tilt:hover{transform:none}' +
    '.uim-tilt.uim-back{transition:transform 300ms ease-out,box-shadow .18s,border-color .18s!important}' +
    '.uim-tilt.uim-live{transition:transform 90ms linear,box-shadow .18s,border-color .18s!important}' +
    /* 2 游標聚光燈（深色卡片網格） */
    '.uim-spot{position:relative;--uim-x:-999px;--uim-y:-999px}' +
    '.uim-spot::before{content:"";position:absolute;inset:0;pointer-events:none;z-index:0;border-radius:inherit;background:radial-gradient(240px circle at var(--uim-x) var(--uim-y),rgba(255,255,255,.15),transparent 70%);opacity:0;transition:opacity .2s}' +
    '.uim-spot.uim-on::before{opacity:1}' +
    '.uim-spot>*{position:relative;z-index:1}' +
    '.uim-spot>*::after{content:"";position:absolute;inset:-1px;border-radius:inherit;pointer-events:none;padding:1px;background:radial-gradient(240px circle at var(--uim-cx,-999px) var(--uim-cy,-999px),rgba(255,255,255,.55),transparent 70%);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;opacity:0;transition:opacity .2s}' +
    '.uim-spot.uim-on>*::after{opacity:1}' +
    /* 4 頁首吸頂（只在捲動後加樣式；原本的 sticky 與按鈕不動） */
    'header.uim-hdr{transition:background-color 200ms ease,box-shadow 200ms ease,padding 200ms ease,backdrop-filter 200ms ease}' +
    'header.uim-hdr.uim-scrolled{box-shadow:0 1px 0 rgba(15,23,42,.06),0 6px 16px -8px rgba(15,23,42,.18)!important;-webkit-backdrop-filter:saturate(1.4) blur(12px);backdrop-filter:saturate(1.4) blur(12px)}' +
    'header.uim-hdr.uim-light.uim-scrolled{background:rgba(255,255,255,.78)!important}' +
    'header.uim-hdr.uim-dark.uim-scrolled{background:rgba(15,42,74,.82)!important}' +
    'header.uim-hdr.uim-tall.uim-scrolled{padding-top:10px!important;padding-bottom:10px!important;min-height:64px}' +
    'header.uim-hdr.uim-tall.uim-scrolled p{max-height:0;opacity:0;margin:0!important;overflow:hidden}' +
    'header.uim-hdr.uim-tall p{transition:max-height 200ms ease,opacity 200ms ease,margin 200ms ease;max-height:3em}' +
    /* 5 回到頂部 */
    '#uim-top{position:fixed;right:24px;bottom:24px;width:48px;height:48px;border-radius:50%;border:0;z-index:9990;display:flex;align-items:center;justify-content:center;background:#0f2a4a;color:#fff;font:700 20px/1 system-ui,sans-serif;box-shadow:0 6px 18px rgba(15,23,42,.28);cursor:pointer;opacity:0;visibility:hidden;translate:0 8px;transition:opacity 200ms ease,visibility 200ms,translate 200ms ease,box-shadow 150ms ease-out,filter 150ms ease-out}' +
    '#uim-top.uim-show{opacity:.92;visibility:visible;translate:0 0}' +
    '@media (hover:hover){#uim-top.uim-show:hover{translate:0 -3px;opacity:1;box-shadow:0 10px 22px rgba(15,23,42,.32)}}' +
    '@media print{#uim-top{display:none!important}}' +
    '@media (prefers-reduced-motion: reduce){#uim-top,header.uim-hdr,header.uim-hdr p{transition:none!important}}';

  function addCss() { if (doc.getElementById('uim-css')) return; var s = doc.createElement('style'); s.id = 'uim-css'; s.textContent = css; (doc.head || doc.documentElement).appendChild(s); }

  /* 共用 rAF 節流 */
  function raf(fn) { var busy = false, last; return function (e) { last = e; if (busy) return; busy = true; g.requestAnimationFrame(function () { busy = false; fn(last); }); }; }

  function lum(c) { var m = String(c || '').match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/); if (!m) return null; if (m[4] !== undefined && +m[4] < .9) return null;  /* 半透明遮罩不算底色 */ return (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255; }
  function bgLum(el) {
    for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
      var cs = getComputedStyle(n), l = lum(cs.backgroundColor);
      if (l !== null) return l;
      var gm = /gradient/.test(cs.backgroundImage) && cs.backgroundImage.match(/rgba?\([^)]+\)/);
      if (gm) { var l2 = lum(gm[0]); if (l2 !== null) return l2; }
    }
    return 1;
  }

  /* 3 傾斜 */
  function tilt() {
    if (!HOVER || REDUCE) return;
    var list = doc.querySelectorAll(CARD);
    Array.prototype.forEach.call(list, function (el) {
      if (el.__uimTilt) return; el.__uimTilt = 1; el.classList.add('uim-tilt');
      var move = raf(function (e) {
        var r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
        var px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
        el.classList.remove('uim-back'); el.classList.add('uim-live');
        el.style.transform = 'perspective(1000px) rotateX(' + (-py * 16).toFixed(2) + 'deg) rotateY(' + (px * 16).toFixed(2) + 'deg) scale(1.02)';
      });
      el.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse') move(e); });
      el.addEventListener('pointerleave', function () { el.classList.remove('uim-live'); el.classList.add('uim-back'); el.style.transform = ''; });
    });
  }

  /* 2 聚光燈：只找深色背景、至少 3 張卡片的網格 */
  function spotlight() {
    if (!HOVER || REDUCE) return;
    var grids = doc.querySelectorAll('.grid,[data-spotlight]');
    Array.prototype.forEach.call(grids, function (gEl) {
      if (gEl.__uimSpot || gEl.children.length < 3 || !gEl.offsetParent) return;  /* 隱藏中的（視窗內）不套用 */
      if (!gEl.hasAttribute('data-spotlight') && bgLum(gEl) > 0.35) return;     // 淺色網格不套用
      gEl.__uimSpot = 1; gEl.classList.add('uim-spot');
      var upd = raf(function (e) {
        var r = gEl.getBoundingClientRect();
        gEl.style.setProperty('--uim-x', (e.clientX - r.left) + 'px'); gEl.style.setProperty('--uim-y', (e.clientY - r.top) + 'px');
        Array.prototype.forEach.call(gEl.children, function (c) { var cr = c.getBoundingClientRect(); c.style.setProperty('--uim-cx', (e.clientX - cr.left) + 'px'); c.style.setProperty('--uim-cy', (e.clientY - cr.top) + 'px'); });
      });
      gEl.addEventListener('pointermove', function (e) { if (e.pointerType !== 'mouse') return; gEl.classList.add('uim-on'); upd(e); });
      gEl.addEventListener('pointerleave', function () { gEl.classList.remove('uim-on'); });
    });
  }

  /* 4 頁首＋5 回到頂部：同一個 rAF 捲動監聽 */
  var hdr = null, topBtn = null, scrolled = false, anim = 0;
  function header() {
    hdr = doc.querySelector('body > header, header'); if (!hdr) return;
    hdr.classList.add('uim-hdr');
    var txt = lum(getComputedStyle(hdr).color);
    hdr.classList.add((txt !== null && txt > 0.6) || bgLum(hdr) < 0.35 ? 'uim-dark' : 'uim-light');
    if (hdr.getBoundingClientRect().height > 72 && g.innerWidth >= 768 && parseFloat(getComputedStyle(hdr).paddingTop) >= 16) hdr.classList.add('uim-tall');  /* 只收合「頁首本身有大留白」的（首頁），模組頁頁首本來就矮 */
  }
  function placeTop() {
    if (!topBtn) return;
    var b = 24, x = g.innerWidth - 48, prev = topBtn.style.pointerEvents;
    topBtn.style.pointerEvents = 'none';
    for (var tries = 0; tries < 4; tries++) {
      var y = g.innerHeight - b - 24, hit = (doc.elementsFromPoint ? doc.elementsFromPoint(x, y) : []).filter(function (n) { return n !== topBtn && n !== doc.documentElement && n !== doc.body && getComputedStyle(n).position === 'fixed' && !/toast/i.test(n.id + ' ' + n.className); })[0];
      if (!hit) break;
      b = Math.round(g.innerHeight - hit.getBoundingClientRect().top + 12);
    }
    topBtn.style.pointerEvents = prev; topBtn.style.bottom = b + 'px';
  }
  function toTop() {
    var start = g.pageYOffset || doc.documentElement.scrollTop, t0 = null, D = REDUCE ? 1 : 500;
    if (anim) g.cancelAnimationFrame(anim);
    var step = function (ts) { if (t0 === null) t0 = ts; var p = Math.min(1, (ts - t0) / D), e = 1 - Math.pow(1 - p, 3); g.scrollTo(0, Math.round(start * (1 - e))); if (p < 1) anim = g.requestAnimationFrame(step); else anim = 0; };
    anim = g.requestAnimationFrame(step);
  }
  function backTop() {
    if (doc.getElementById('uim-top')) return;
    topBtn = doc.createElement('button'); topBtn.id = 'uim-top'; topBtn.type = 'button'; topBtn.className = 'no-print uim-off';
    topBtn.setAttribute('aria-label', '回到頂部 Back to top'); topBtn.title = '回到頂部 Back to top'; topBtn.textContent = '↑';
    topBtn.addEventListener('click', toTop); doc.body.appendChild(topBtn);
  }
  var onScroll = raf(function () {
    var y = g.pageYOffset || doc.documentElement.scrollTop || 0;
    if (hdr) { if (!scrolled && y > 80) { scrolled = true; hdr.classList.add('uim-scrolled'); } else if (scrolled && y < 20) { scrolled = false; hdr.classList.remove('uim-scrolled'); } }
    if (topBtn) { var show = y > g.innerHeight; if (show && !topBtn.classList.contains('uim-show')) placeTop(); topBtn.classList.toggle('uim-show', show); }
  });

  function init() {
    if (!doc.body) return;
    addCss(); header(); backTop(); tilt(); spotlight(); onScroll();
    g.addEventListener('scroll', onScroll, { passive: true });
    g.addEventListener('resize', raf(function () { onScroll(); if (topBtn && topBtn.classList.contains('uim-show')) placeTop(); }), { passive: true });
    /* 卡片之後才畫出來的頁面：晚一點再掃一次 */
    setTimeout(function () { tilt(); spotlight(); }, 1500);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
  g.ACUiMotion = { rescan: function () { tilt(); spotlight(); } };
})(window);
