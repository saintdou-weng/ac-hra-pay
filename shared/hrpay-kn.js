/* HRA-PAY 費用卡大字卡 v1（2026-11-25 Paul：卡片點進去要有用的資訊——先列人數、各部門金額，再看歷史比較和圖表；一張卡幾個分頁，像員工頁）
   用在 summary_center.html（總覽）：💵 Payroll／💰 Advance／🍱 Meal B1／B2 四張 KPI，和費用加總三張（已勾選合計／薪資現金／餐費）。
   每張卡：
   · 上方：金額、人數、平均每人、跟上月比（▲▼）、核對（逐人加總＝總表 → ✅ 經計算核對正確／差多少）
   · 分頁 📈 走勢：近 12 個月金額長條＋人數
   · 分頁 🏢 部門：各部門金額、人數、平均，最下面合計
   · 分頁 👥 明細：金額最高的 15 人（工號、姓名、部門）
   · 分頁 🗒 歷史：近 12 個月清單（金額、人數、平均、跟前月比）
   只讀頁面上已載入的 Projection（MOD／pick），不改資料。 */
(function(){
  'use strict';
  if(window.__hrpayKn)return;window.__hrpayKn=1;
  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function n(v){v=Number(v);return isFinite(v)?v:0;}
  function $m(v){return '$'+n(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});}
  function $0(v){return '$'+Math.round(n(v)).toLocaleString('en-US');}
  var PARTS={payroll:{m:'payroll',ph:'final',f:'netPay',l:'Payroll 實領',c:'#0ea5e9'},advance:{m:'advance',ph:'advance',f:'advanceAmount',l:'Advance 預支',c:'#8b5cf6'},
    meal1:{m:'meal',b:1,f:'mealFee',l:'Meal B1',c:'#f59e0b'},meal2:{m:'meal',b:2,f:'mealFee',l:'Meal B2',c:'#f97316'}};
  function defOf(el){
    var k=el.closest('#kpis .kpi'),c=el.closest('#cost-grid .cost-box');
    if(k){var i=[].indexOf.call(k.parentElement.children,k);return [{t:'💵 Payroll 實領合計',ic:'💵',p:['payroll']},{t:'💰 Advance 首期發放',ic:'💰',p:['advance']},{t:'🍱 Meal B1（1–15）',ic:'🍱',p:['meal1']},{t:'🍱 Meal B2（16–月底）',ic:'🍱',p:['meal2']}][i]||null;}
    if(c){var j=[].indexOf.call(c.parentElement.children,c);var opts={};document.querySelectorAll('[data-cost]').forEach(function(x){opts[x.dataset.cost]=x.checked;});
      return [{t:'💰 已勾選項目合計 Selected Total',ic:'💰',p:['payroll','advance','meal1','meal2'].filter(function(x){return opts[x]!==false;})},{t:'💵 薪資現金發放 Salary Cash',ic:'💵',p:['payroll','advance']},{t:'🍱 餐費合計 Meal Total',ic:'🍱',p:['meal1','meal2']}][j]||null;}
    return null;}
  function get(part,P){var d=PARTS[part];try{return window.pick(d.m,P,d.ph||null,d.b||null);}catch(e){return null;}}
  /* 一期的資料：每個項目的列、總表金額、逐人加總 */
  function agg(def,P){var o={P:P,parts:[],amt:0,ids:{},rows:[],have:0};
    def.p.forEach(function(k){var d=PARTS[k],it=get(k,P);if(!it){o.parts.push({k:k,miss:true});return;}o.have++;
      var rows=it.rows||[],sum=rows.reduce(function(s,r){return s+n(r[d.f]);},0),tot=it.totals&&it.totals[d.f]!=null?n(it.totals[d.f]):sum;
      o.parts.push({k:k,tot:tot,sum:sum,cnt:rows.length});o.amt+=tot;rows.forEach(function(r){var id=String(r.employeeId||r.id||r.name||'');o.ids[id]=1;o.rows.push({id:id,name:r.name||'',dept:r.dept||r.department||'—',v:n(r[d.f]),k:k});});});
    o.ppl=Object.keys(o.ids).length;return o;}
  function months(){var s={};try{Object.keys((typeof MOD!=='undefined'?MOD:window.MOD)||{}).forEach(function(m){var x=(typeof MOD!=='undefined'?MOD:window.MOD)[m];if(x)Object.keys(x.items).forEach(function(k){var p=x.items[k].period;if(/^\d{4}-\d{2}$/.test(p))s[p]=1;});});}catch(e){}return Object.keys(s).sort();}
  function delta(a,b){if(a==null||b==null||!b)return '';var d=a-b,p=d/b*100;return '<span style="color:'+(d>0?'#dc2626':'#059669')+';font-weight:700">'+(d>=0?'▲ +':'▼ −')+$0(Math.abs(d))+'（'+(d>=0?'+':'')+p.toFixed(1)+'%）</span>';}
  function chart(items,o){o=o||{};if(!items.length)return '';var W=340,H=o.h||130,pt=18,pb=20,vs=items.map(function(x){return x.v;}).filter(function(v){return v!=null;});if(!vs.length)return '';
    var mx=Math.max.apply(null,vs)*1.1||1,bw=W/items.length,out='';
    items.forEach(function(x,i){if(x.v==null)return;var X=i*bw+bw*.15,h=Math.max(1,(H-pt-pb)*x.v/mx),Y=H-pb-h;
      out+='<rect x="'+X.toFixed(1)+'" y="'+Y.toFixed(1)+'" width="'+(bw*.7).toFixed(1)+'" height="'+h.toFixed(1)+'" rx="2" fill="'+(x.cur?'#4f46e5':(o.c||'#60a5fa'))+'"/>';
      out+='<text x="'+(X+bw*.35).toFixed(1)+'" y="'+(Y-3).toFixed(1)+'" font-size="'+(x.cur?9:7.5)+'" text-anchor="middle" fill="'+(x.cur?'#312e81':'#475569')+'" font-weight="'+(x.cur?700:400)+'">'+esc(x.t!=null?x.t:x.v)+'</text>';
      out+='<text x="'+(X+bw*.35).toFixed(1)+'" y="'+(H-6)+'" font-size="8" text-anchor="middle" fill="'+(x.cur?'#312e81':'#64748b')+'">'+esc(x.k)+'</text>';});
    return '<div class="hkn-ch"><div class="hkn-st">'+esc(o.title||'')+'</div><svg viewBox="0 0 '+W+' '+H+'" width="100%" preserveAspectRatio="none" style="display:block;height:'+H+'px">'+out+'</svg></div>';}
  function kfmt(v){v=n(v);return v>=10000?(v/1000).toFixed(0)+'k':v>=1000?(v/1000).toFixed(1)+'k':Math.round(v);}
  function bars(list,o){o=o||{};if(!list.length)return '';var mx=Math.max.apply(null,list.map(function(x){return Math.abs(x.v);}))||1;
    return list.map(function(x){return '<div class="hkn-br"><span class="n">'+esc(x.n)+(x.s?'<small>'+esc(x.s)+'</small>':'')+'</span><span class="t"><i style="width:'+Math.max(3,Math.round(Math.abs(x.v)/mx*100))+'%;background:'+(x.c||o.c||'#60a5fa')+'"></i></span><span class="v">'+esc(x.vt!=null?x.vt:$0(x.v))+'</span></div>';}).join('')+
      (o.total?'<div class="hkn-br hkn-tot"><span class="n">'+esc(o.total[0])+'</span><span class="t"></span><span class="v">'+esc(o.total[1])+'</span></div>':'');}
  function build(el){
    if(typeof window.pick!=='function'||!(typeof MOD!=='undefined'?MOD:window.MOD))return null;var def=defOf(el);if(!def||!def.p.length)return null;
    var P=(document.getElementById('sel-period')||{}).value||'';if(!P)return null;
    var A=agg(def,P);var isY=/^\d{4}$/.test(P);
    var ms=months(),i=ms.indexOf(P),prev=!isY&&i>0?agg(def,ms[i-1]):null;
    var top='',num='',grp='',ppl='',his='';
    /* 上方：金額＋比較＋核對 */
    var chk=A.parts.filter(function(p){return !p.miss;}).map(function(p){var d=Math.abs(p.tot-p.sum);return {p:p,d:d};}),bad=chk.filter(function(x){return x.d>0.5;}),miss=A.parts.filter(function(p){return p.miss;});
    top='<div class="hkn"><div class="hkn-hero"><div class="hkn-big">'+$m(A.amt)+'</div><div class="hkn-l">'+esc(def.t)+' · '+esc(P)+'</div>'+
      '<div class="hkn-kv"><div><b>'+A.ppl+'</b><span>人'+(isY?'次':'')+'</span></div><div><b>'+(A.ppl?$m(A.amt/A.ppl):'—')+'</b><span>平均每人</span></div>'+(prev&&prev.have?'<div><b>'+$0(prev.amt)+'</b><span>上月 '+esc(ms[i-1])+'</span></div>':'')+'</div>'+
      (prev&&prev.have?'<div class="hkn-cmp">跟上月比：'+delta(A.amt,prev.amt)+'　人數 '+(A.ppl-prev.ppl>=0?'+':'')+(A.ppl-prev.ppl)+'</div>':'')+
      (def.p.length>1?'<div class="hkn-parts">'+A.parts.map(function(p){var d=PARTS[p.k];return '<span style="border-color:'+d.c+'"><i style="background:'+d.c+'"></i>'+esc(d.l)+' '+(p.miss?'<b style="color:#d97706">缺資料</b>':'<b>'+$0(p.tot)+'</b>')+'</span>';}).join('')+'</div>':'')+
      '<div class="hkn-ok '+(bad.length?'bad':miss.length?'warn':'')+'">'+(bad.length?'🔴 逐人加總跟總表差 '+bad.map(function(x){return PARTS[x.p.k].l+' '+$m(x.d);}).join('、'):miss.length?'🟡 缺 '+miss.map(function(p){return PARTS[p.k].l;}).join('、')+'（缺資料不等於 $0）':'✅ 經計算核對正確：逐人加總＝總表 '+$m(A.amt))+'</div></div></div>';
    /* 走勢 */
    var span=isY?ms.filter(function(m){return m.indexOf(P)===0;}):ms.slice(Math.max(0,i-11),i+1);
    var ser=span.map(function(m){var x=agg(def,m);return {m:m,a:x.have?x.amt:null,p:x.ppl,full:x.have===def.p.length};});
    num='<div class="hkn">'+chart(ser.map(function(x){return {k:String(+x.m.slice(5))+'月',v:x.a,t:x.a==null?'':kfmt(x.a),cur:x.m===P};}),{title:'📈 '+(isY?P+' 各月金額':'近 12 個月金額')+'（紫色＝本期）'})+
      chart(ser.map(function(x){return {k:String(+x.m.slice(5))+'月',v:x.a==null?null:x.p,cur:x.m===P};}),{title:'👥 人數',c:'#34d399',h:100})+
      (def.p.length>1?'<div class="hkn-st">🧩 本期組成</div>'+bars(A.parts.filter(function(p){return !p.miss;}).map(function(p){var d=PARTS[p.k];return {n:d.l,s:p.cnt+' 人',v:p.tot,c:d.c};}),{total:['合計',$m(A.amt)]}):'')+'</div>';
    /* 部門 */
    var dp={};A.rows.forEach(function(r){var k=r.dept||'—';if(!dp[k])dp[k]={v:0,ids:{}};dp[k].v+=r.v;dp[k].ids[r.id]=1;});
    var dl=Object.keys(dp).map(function(k){var c=Object.keys(dp[k].ids).length;return {n:k,v:dp[k].v,s:c+' 人 · 平均 '+$0(dp[k].v/(c||1))};}).sort(function(a,b){return b.v-a.v;});
    var rowsSum=A.rows.reduce(function(s,r){return s+r.v;},0);
    grp='<div class="hkn"><div class="hkn-st">🏢 各部門金額（'+dl.length+' 個部門）</div>'+bars(dl.slice(0,30),{total:['合計（逐人加總）',$m(rowsSum)]})+(dl.length>30?'<div class="hkn-note">只列金額最高的 30 個部門</div>':'')+'</div>';
    /* 明細 */
    var pp={};A.rows.forEach(function(r){if(!pp[r.id])pp[r.id]={id:r.id,name:r.name,dept:r.dept,v:0};pp[r.id].v+=r.v;});
    var pl=Object.keys(pp).map(function(k){return pp[k];}).sort(function(a,b){return b.v-a.v;});
    ppl='<div class="hkn"><div class="hkn-st">👥 金額最高的 15 人（共 '+pl.length+' 人）</div>'+bars(pl.slice(0,15).map(function(x){return {n:(x.id?x.id+' ':'')+x.name,s:x.dept,v:x.v,vt:$m(x.v),c:'#a78bfa'};}))+
      '<div class="hkn-note">要看每個人的完整資料，到對應模組（Payroll／Advance／Meal）的名單點那一列。</div></div>';
    /* 歷史 */
    his='<div class="hkn"><div class="hkn-st">🗒 最近幾期</div><div class="hkn-tb">'+ser.slice().reverse().map(function(x,k,arr){var pv=arr[k+1];return '<div class="'+(x.m===P?'on':'')+'"><span>'+esc(x.m)+(x.full||x.a==null?'':' <small style="color:#d97706">缺部分</small>')+'</span><b>'+(x.a==null?'—':$0(x.a))+'</b><small>'+(x.a==null?'':x.p+' 人')+'</small><small>'+(pv&&pv.a!=null&&x.a!=null?delta(x.a,pv.a).replace(/（.*?）/,''):'')+'</small></div>';}).join('')+'</div></div>';
    return {icon:def.ic,title:def.t.replace(/^\S+\s/,''),chips:[P,$0(A.amt),A.ppl+' 人'],top:top,panes:[['num','📈 走勢',num],['grp','🏢 部門',grp],['ppl','👥 明細',ppl],['his','🗒 歷史',his]]};
  }
  var css='.hkn{padding:10px 14px 16px;color:#0f172a}.hkn-hero{border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;background:#f8fafc}.hkn-big{font-size:34px;font-weight:800;line-height:1.1}.hkn-l{font-size:13px;color:#475569;font-weight:600;margin-top:3px}'
   +'.hkn-kv{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:8px}.hkn-kv div{display:flex;flex-direction:column}.hkn-kv b{font-size:17px}.hkn-kv span{font-size:11px;color:#64748b}.hkn-cmp{font-size:13px;margin-top:6px}'
   +'.hkn-parts{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.hkn-parts span{border:1px solid;border-radius:999px;padding:3px 9px;font-size:12px;display:inline-flex;align-items:center;gap:5px}.hkn-parts i{width:8px;height:8px;border-radius:50%;display:inline-block}'
   +'.hkn-ok{margin-top:8px;font-size:12.5px;font-weight:700;color:#047857;background:#ecfdf5;border-radius:8px;padding:6px 9px}.hkn-ok.warn{color:#92400e;background:#fffbeb}.hkn-ok.bad{color:#991b1b;background:#fef2f2}'
   +'.hkn-st{font-size:13px;font-weight:700;margin:12px 0 6px;color:#1e293b}.hkn-ch{border:1px solid #e2e8f0;border-radius:12px;padding:4px 8px 6px;margin:8px 0;background:#fff}.hkn-ch .hkn-st{margin:4px 0 2px;font-size:12px}'
   +'.hkn-br{display:grid;grid-template-columns:minmax(90px,40%) 1fr auto;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid #f1f5f9;font-size:13px}.hkn-br .n{font-weight:600;line-height:1.2;word-break:break-word}.hkn-br .n small{display:block;font-weight:400;color:#64748b;font-size:10.5px}'
   +'.hkn-br .t{height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden}.hkn-br .t i{display:block;height:100%;border-radius:4px}.hkn-br .v{font-weight:700;text-align:right;min-width:64px}.hkn-tot{border-top:2px solid #cbd5e1;border-bottom:0}.hkn-tot .n,.hkn-tot .v{color:#4f46e5}'
   +'.hkn-note{font-size:11.5px;color:#64748b;margin-top:6px}.hkn-tb>div{display:grid;grid-template-columns:1fr auto auto auto;gap:10px;padding:6px 8px;border-bottom:1px solid #f1f5f9;font-size:13px;align-items:baseline}.hkn-tb>div.on{background:#eef2ff;border-radius:8px}.hkn-tb small{color:#64748b;font-size:11px}';
  try{var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);}catch(e){}
  window.acKeynoteCardEl=function(el){try{return el.closest('#kpis .kpi,#cost-grid .cost-box');}catch(e){return null;}};
  window.acKeynoteCard=function(el){try{return build(el);}catch(e){try{console.warn('hrpay-kn',e);}catch(_){}return null;}};
})();
