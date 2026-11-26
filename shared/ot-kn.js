/* OT／獎金／特殊加班 大字卡 v1（2026-11-26 Paul：按金額、人次這些卡要跳出相對應的資訊——列表、圖表、可以點、能連接；跟入離職同一個標準）
   用在 ot_bonus.html 儀表板上的 5 張卡：支出金額、人次、加班時數、每小時成本、人均支出。
   每張卡（依目前選的 類型／部門／時間單位／月份）：
   · 上方：這個數字、跟上一期比（▲▼）、跟去年同期比
   · 🏢 部門：各部門的這個數字（長條），點一條 → 展開那個部門的每一筆（類型、人次、時數、金額）
   · 📈 走勢：近 12 期長條（紫色＝本期）；下面每一期一列，點一列 → 展開那一期各部門
   · 🧾 明細：這一期全部的部門記錄
   只讀頁面已載入的 RECS，不改資料。 */
(function(){
  'use strict';
  if(window.__otKn)return;window.__otKn=1;
  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function n(v){v=Number(v);return isFinite(v)?v:0;}
  function money(v){return '$'+n(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});}
  function int0(v){return Math.round(n(v)).toLocaleString('en-US');}
  function G(name){try{return eval(name);}catch(e){return undefined;}}   /* 頁面用 let 宣告的全域（RECS、TYPE、UNIT…） */
  function hrs(r){try{return G('recordHours')(r);}catch(e){return n(r.hour);}}
  function pad(m){return ('0'+m).slice(-2);}
  var DEF={
    'k-exp':{ic:'💵',t:'支出金額',f:function(a){return a.exp;},fmt:money,sum:true,c:'#14b8a6'},
    'k-ppl':{ic:'👥',t:'人次',f:function(a){return a.ppl;},fmt:int0,sum:true,c:'#60a5fa'},
    'k-hr':{ic:'⏱',t:'加班時數',f:function(a){return a.hr;},fmt:int0,sum:true,c:'#0ea5e9'},
    'k-rate':{ic:'💲',t:'每小時成本',f:function(a){return a.hr?a.exp/a.hr:null;},fmt:function(v){return v==null?'—':'$'+n(v).toFixed(2);},c:'#f59e0b'},
    'k-avg':{ic:'🙋',t:'人均支出',f:function(a){return a.ppl?a.exp/a.ppl:null;},fmt:function(v){return v==null?'—':money(v);},c:'#10b981'}};
  function idOf(el){var c=el.closest('#pane-dash .grid > div');if(!c)return null;var p=c.querySelector('[id^="k-"]:not([id$="-s"]):not([id$="-label"])');return p&&DEF[p.id]?p.id:null;}
  function agg(rs){var a={exp:0,ppl:0,hr:0,n:rs.length};rs.forEach(function(r){a.exp+=n(r.expense);a.ppl+=n(r.ppl);a.hr+=hrs(r);});return a;}
  function typed(){try{return G('typedRecs')();}catch(e){return [];}}
  function keyOf(r,unit){var q=Math.floor((r.month-1)/3)+1;return unit==='year'?String(r.year):unit==='quarter'?r.year+'-Q'+q:r.year+'-'+pad(r.month);}
  function labelOf(k){var m=String(k).match(/^(\d{4})-(\d{2})$/);return m?m[1]+'-'+m[2]:k;}
  var BREG=[];
  function bars(list,def,o){o=o||{};if(!list.length)return '<div class="otk-note">沒有資料</div>';var mx=Math.max.apply(null,list.map(function(x){return Math.abs(n(x.v));}))||1;
    return list.map(function(x){var bi=x.rows?BREG.push({rows:x.rows,def:def,title:x.n})-1:-1;return '<div class="otk-br'+(bi>=0?' otk-bk':'')+(x.cur?' cur':'')+'"'+(bi>=0?' data-otb="'+bi+'"':'')+'><span class="n">'+(bi>=0?'<i class="otk-ar">▸</i>':'')+esc(x.n)+(x.s?'<small>'+esc(x.s)+'</small>':'')+'</span><span class="t"><i style="width:'+(x.v==null?0:Math.max(3,Math.round(Math.abs(n(x.v))/mx*100)))+'%;background:'+(x.cur?'#4f46e5':(o.c||def.c))+'"></i></span><span class="v">'+esc(x.vt!=null?x.vt:def.fmt(x.v))+'</span></div>';}).join('');}
  function recList(rs,def){var TL=G('typeLabel');return '<div class="otk-tb">'+rs.slice().sort(function(a,b){return n(b.expense)-n(a.expense);}).map(function(r){return '<div><span><b>'+esc(r.dept||'—')+'</b><small>'+esc(r.year+'-'+pad(r.month))+' · '+esc(TL?TL(r.type):r.type||'')+'</small></span><span>'+int0(r.ppl)+' 人次</span><span>'+int0(hrs(r))+' h</span><b>'+money(r.expense)+'</b></div>';}).join('')+'</div>';}
  function chart(items,o){if(!items.length)return '';var W=340,H=o.h||130,pt=18,pb=20,vs=items.map(function(x){return x.v;}).filter(function(v){return v!=null;});if(!vs.length)return '';var mx=Math.max.apply(null,vs)*1.12||1,bw=W/items.length,out='';
    items.forEach(function(x,i){if(x.v==null)return;var X=i*bw+bw*.15,h=Math.max(1,(H-pt-pb)*x.v/mx),Y=H-pb-h;out+='<rect x="'+X.toFixed(1)+'" y="'+Y.toFixed(1)+'" width="'+(bw*.7).toFixed(1)+'" height="'+h.toFixed(1)+'" rx="2" fill="'+(x.cur?'#4f46e5':o.c)+'"/><text x="'+(X+bw*.35).toFixed(1)+'" y="'+(Y-3).toFixed(1)+'" font-size="7.5" text-anchor="middle" fill="#475569">'+esc(x.t)+'</text><text x="'+(X+bw*.35).toFixed(1)+'" y="'+(H-6)+'" font-size="8" text-anchor="middle" fill="#64748b">'+esc(x.k)+'</text>';});
    return '<div class="otk-ch"><div class="otk-st">'+esc(o.title)+'</div><svg viewBox="0 0 '+W+' '+H+'" width="100%" preserveAspectRatio="none" style="display:block;height:'+H+'px">'+out+'</svg></div>';}
  function kfmt(v,def){if(v==null)return '';if(def===DEF['k-exp']){return v>=1000?(v/1000).toFixed(1)+'k':Math.round(v)+'';}return def.fmt(v).replace('$','');}
  function cmp(a,b,def){if(a==null||b==null||!b)return '—';var d=a-b,p=d/b*100;return '<span style="color:'+(d>0?'#dc2626':'#059669')+';font-weight:700">'+(d>=0?'▲ ':'▼ ')+def.fmt(Math.abs(d))+'（'+(d>=0?'+':'')+p.toFixed(1)+'%）</span>';}
  function build(el){
    var id=idOf(el);if(!id)return null;var def=DEF[id],unit=G('UNIT')||'month',ACT=G('ACTIVE'),TL=G('typeLabel'),TYPE=G('TYPE');
    var all=typed();if(!all.length)return null;
    var groups={};all.forEach(function(r){var k=keyOf(r,unit==='day'||unit==='week'?'month':unit);(groups[k]=groups[k]||[]).push(r);});
    var keys=Object.keys(groups).sort(),curK=(function(){try{var x=G('unitSpanRecs')();return x.length?keyOf(x[0],unit==='day'||unit==='week'?'month':unit):keys[keys.length-1];}catch(e){return keys[keys.length-1];}})();
    var rs=groups[curK]||[],A=agg(rs),val=def.f(A),ki=keys.indexOf(curK),prevK=keys[ki-1],prev=prevK?def.f(agg(groups[prevK])):null;
    var yoyK=/^\d{4}-\d{2}$/.test(curK)?(+curK.slice(0,4)-1)+curK.slice(4):/^\d{4}-Q\d$/.test(curK)?(+curK.slice(0,4)-1)+curK.slice(4):String(+curK-1),yoy=groups[yoyK]?def.f(agg(groups[yoyK])):null;
    var tName=TL?TL(TYPE):'';
    var top='<div class="otk"><div class="otk-hero"><div class="otk-big">'+esc(def.fmt(val))+'</div><div class="otk-l">'+def.ic+' '+esc(def.t)+' · '+esc(tName)+' · '+esc(labelOf(curK))+'</div>'+
      '<div class="otk-kv"><div><b>'+money(A.exp)+'</b><span>支出</span></div><div><b>'+int0(A.ppl)+'</b><span>人次</span></div><div><b>'+int0(A.hr)+'</b><span>時數</span></div><div><b>'+A.n+'</b><span>筆部門記錄</span></div></div>'+
      '<div class="otk-cmp">比上一期（'+esc(prevK?labelOf(prevK):'—')+'）：'+cmp(val,prev,def)+'<br>比去年同期（'+esc(groups[yoyK]?labelOf(yoyK):'—')+'）：'+cmp(val,yoy,def)+'</div>'+
      (unit==='day'||unit==='week'?'<div class="otk-note">畫面上方選的是「'+(unit==='day'?'日均':'週均')+'估算」，卡上的數字是月資料換算；這裡列的是整個月的原始數字。</div>':'')+'</div></div>';
    /* 部門 */
    var dp={};rs.forEach(function(r){(dp[r.dept||'—']=dp[r.dept||'—']||[]).push(r);});
    var dl=Object.keys(dp).map(function(k){var a=agg(dp[k]);return {n:k,v:def.f(a),s:int0(a.ppl)+' 人次 · '+int0(a.hr)+' h · '+money(a.exp),rows:dp[k]};}).sort(function(a,b){return n(b.v)-n(a.v);});
    var grp='<div class="otk"><div class="otk-st">🏢 各部門'+esc(def.t)+'（'+dl.length+' 個部門）· 點一條看那個部門的每一筆</div>'+bars(dl,def)+'</div>';
    /* 走勢 */
    var span=keys.slice(Math.max(0,ki-11),ki+1);
    var ser=span.map(function(k){var a=agg(groups[k]);return {k:k,v:def.f(a),a:a};});
    var num='<div class="otk">'+chart(ser.map(function(x){return {k:/^\d{4}-\d{2}$/.test(x.k)?(+x.k.slice(5))+'月':x.k.replace(/^\d{2}/,''),v:x.v,t:kfmt(x.v,def),cur:x.k===curK};}),{title:'📈 近 '+ser.length+' 期'+def.t+'（紫色＝本期）',c:def.c})+
      (id!=='k-ppl'?chart(ser.map(function(x){return {k:/^\d{4}-\d{2}$/.test(x.k)?(+x.k.slice(5))+'月':x.k,v:x.a.ppl,t:int0(x.a.ppl),cur:x.k===curK};}),{title:'👥 人次',c:'#a78bfa',h:100}):'')+
      '<div class="otk-st">🗒 每一期 · 點一列看那一期各部門</div>'+bars(ser.slice().reverse().map(function(x,i,arr){var pv=arr[i+1];return {n:labelOf(x.k),s:pv?'比前期 '+(x.v!=null&&pv.v?((x.v-pv.v)/pv.v*100>=0?'+':'')+((x.v-pv.v)/pv.v*100).toFixed(1)+'%':'—'):'',v:x.v,rows:groups[x.k],cur:x.k===curK};}),def,{c:'#93c5fd'})+'</div>';
    var det='<div class="otk"><div class="otk-st">🧾 '+esc(labelOf(curK))+' 全部部門記錄（'+rs.length+' 筆）</div>'+recList(rs,def)+'</div>';
    return {icon:def.ic,title:def.t,chips:[tName,labelOf(curK),def.fmt(val)],top:top,panes:[['grp','🏢 部門',grp],['num','📈 走勢',num],['det','🧾 明細',det]]};
  }
  document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('.otk-bk');if(!b)return;e.stopPropagation();var nx=b.nextElementSibling;if(nx&&nx.classList.contains('otk-bx')){nx.remove();b.classList.remove('open');return;}
    var it=BREG[+b.getAttribute('data-otb')];if(!it)return;var d=document.createElement('div');d.className='otk-bx';
    var byDept=it.rows.some(function(r){return r.dept!==it.rows[0].dept;});
    if(byDept){var dp={};it.rows.forEach(function(r){(dp[r.dept||'—']=dp[r.dept||'—']||[]).push(r);});d.innerHTML=bars(Object.keys(dp).map(function(k){var a=agg(dp[k]);return {n:k,v:it.def.f(a),s:int0(a.ppl)+' 人次 · '+money(a.exp),rows:dp[k]};}).sort(function(a,b){return n(b.v)-n(a.v);}),it.def);}
    else d.innerHTML=recList(it.rows,it.def);
    b.classList.add('open');b.parentNode.insertBefore(d,b.nextSibling);},true);
  var css='.otk{padding:10px 14px 16px;color:#0f172a}.otk-hero{border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;background:#f8fafc}.otk-big{font-size:34px;font-weight:800;line-height:1.1}.otk-l{font-size:13px;color:#475569;font-weight:600;margin-top:3px}'
   +'.otk-kv{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:8px}.otk-kv div{display:flex;flex-direction:column}.otk-kv b{font-size:16px}.otk-kv span{font-size:11px;color:#64748b}.otk-cmp{font-size:13px;margin-top:8px;line-height:1.7}.otk-note{font-size:11.5px;color:#64748b;margin-top:6px}'
   +'.otk-st{font-size:13px;font-weight:700;margin:12px 0 6px;color:#1e293b}.otk-ch{border:1px solid #e2e8f0;border-radius:12px;padding:4px 8px 6px;margin:8px 0;background:#fff}'
   +'.otk-br{display:grid;grid-template-columns:minmax(90px,40%) 1fr auto;gap:8px;align-items:center;padding:6px 4px;border-bottom:1px solid #f1f5f9;font-size:13px}.otk-br.cur{background:#eef2ff;border-radius:8px}.otk-br .n{font-weight:600;word-break:break-word}.otk-br .n small{display:block;font-weight:400;color:#64748b;font-size:10.5px}.otk-br .t{height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden}.otk-br .t i{display:block;height:100%;border-radius:4px}.otk-br .v{font-weight:700;text-align:right;min-width:60px}'
   +'.otk-bk{cursor:pointer;border-radius:8px}.otk-bk:hover{background:#f1f5f9}.otk-ar{font-style:normal;color:#6366f1;margin-right:4px;display:inline-block;transition:transform .15s}.otk-bk.open .otk-ar{transform:rotate(90deg)}.otk-bx{border-left:3px solid #c7d2fe;margin:2px 0 8px 6px;padding-left:6px}'
   +'.otk-tb>div{display:grid;grid-template-columns:1fr auto auto auto;gap:8px;padding:7px 4px;border-bottom:1px solid #f1f5f9;font-size:12.5px;align-items:center}.otk-tb small{display:block;color:#64748b;font-size:10.5px}';
  try{var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);}catch(e){}
  var prevEl=window.acKeynoteCardEl,prevCard=window.acKeynoteCard;
  window.acKeynoteCardEl=function(el){try{var c=el.closest('#pane-dash .grid > div');if(c&&idOf(c))return c;}catch(e){}return prevEl?prevEl(el):null;};
  window.acKeynoteCard=function(el,i,sib){try{var r=build(el);if(r)return r;}catch(e){try{console.warn('ot-kn',e);}catch(_){}}return prevCard?prevCard(el,i,sib):null;};
})();
