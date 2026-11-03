/* AC-HRA-PAY v3.9.28 | Paul 2026-11-03：NSSF（職災、健保）公司付；退休金、所得稅照政府規定（員工退休金 2% 從薪資扣）。
   NSSF 依月份生效的上下限＋薪資防呆（交通 $7＋$2.50、最低工資）
   NSSF 第 3135/26 號通知（部際部長令 234/26）：自 2026-11 計薪月起，繳費工資下限 600,000៛、上限 1,500,000៛
   （舊制 400,000／1,200,000）；費率不變：職災 0.8%、健保 2.6%（公司付）、退休金公司 2%＋員工 2%。
   10 月以前的月份照舊制，不回溯。退休金 2027-10 起推估各 4%（推估，正式公告後再確認）。
   最低工資（成衣／鞋類）：2025 $208、2026 $210、2027 $212（2026-09-30 公告；試用期少 $2）。
   交通／住宿：2026-04 起 $7＋$2.50＝$9.50（計薪滿 15 天）。 */
(function(g){'use strict';
const BANDS=[
  {from:'2000-01',min:400000,max:1200000,pen:.02,health:.026,risk:.008,src:'舊制 / Old rule'},
  {from:'2026-11',min:600000,max:1500000,pen:.02,health:.026,risk:.008,src:'NSSF 第 3135/26 號通知 / NSSF notice 3135/26'},
  {from:'2027-10',min:600000,max:1500000,pen:.04,health:.026,risk:.008,src:'退休金第二階段（推估）/ Pension phase 2 (projected)',proj:true}];
const MINW={2023:200,2024:204,2025:208,2026:210,2027:212};
const TRANS={from:'2026-04',base:7,extra:2.5,minDays:15};
const GROUPS=[['g1','< 60 萬៛','< 600k៛'],['g2','60–120 萬៛','600k–1.2M៛'],['g3','120–150 萬៛','1.2M–1.5M៛'],['g4','> 150 萬៛','> 1.5M៛']];
const ls=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v==null?d:v;}catch(e){return d;}};
const ym=v=>String(v||'').slice(0,7);
const r2=v=>Math.round((+v||0)*100)/100;
function bandAt(p){p=ym(p);let b=BANDS[0];for(const x of BANDS)if(p&&x.from<=p)b=x;return b;}
function prevBand(p){const i=BANDS.indexOf(bandAt(p));return i>0?BANDS[i-1]:BANDS[0];}
function fx(){const v=+ls('hrpay_nssf_fx',0);return v>0?v:4050;}
function base(khr,b){return Math.min(b.max,Math.max(b.min,Math.round(+khr||0)));}
function group(khr){khr=+khr||0;return khr<600000?'g1':khr<=1200000?'g2':khr<=1500000?'g3':'g4';}
function employeeUSD(grossUSD,p,rate,b){rate=rate||fx();b=b||bandAt(p);return r2(base(grossUSD*rate,b)*b.pen/rate);}
function minWageAt(p){const y=ym(p).slice(0,4);const o=ls('hrpay_minwage',{});return o[y]!=null?+o[y]:MINW[y]!=null?MINW[y]:null;}
function grossOf(r){return (+r.subtotal||0)+(+r.otTotal||0)+Math.abs(+r.advDeduction||0);}
/* r：HRA-PAY 正式薪資一筆（subtotal 小計、otTotal 加班、advDeduction 預支、nssf 員工扣款、travel 交通住宿、basicRate 底薪、workDays 計薪天） */
function checkPay(r,p,o){o=o||{};const out=[];p=ym(p);const g=grossOf(r),nssf=Math.abs(+r.nssf||0);
  if(g>0&&!o.over60){const b=bandAt(p),exp=employeeUSD(g,p,0,b),pb=prevBand(p),old=employeeUSD(g,p,0,pb);
    if(nssf<0.005)out.push({k:'nssf0',sev:'warn',zh:'沒扣員工退休金 2%（依規定員工要扣，滿 60 歲才免）',en:'No employee pension 2% deducted (required by law unless aged 60+)'});
    else if(Math.abs(nssf-exp)>0.06){const stale=pb!==b&&Math.abs(nssf-old)<=0.06;out.push({k:'nssf',sev:'crit',exp,zh:`NSSF 扣 $${nssf.toFixed(2)}，${p} 規定應為 $${exp.toFixed(2)}${stale?'（還在用舊上下限 40–120 萬៛）':''}`,en:`NSSF deducted $${nssf.toFixed(2)}; ${p} rule gives $${exp.toFixed(2)}${stale?' (still the old 400k–1.2M floor/ceiling)':''}`});}}
  if(p>=TRANS.from&&(+r.workDays||0)>=TRANS.minDays&&r.travel!=null&&(+r.travel||0)<TRANS.base+TRANS.extra-0.005)out.push({k:'trans',sev:'warn',zh:`交通／住宿 $${(+r.travel||0).toFixed(2)}，少於 $${TRANS.base}＋$${TRANS.extra}`,en:`Transport/housing $${(+r.travel||0).toFixed(2)} is below $${TRANS.base} + $${TRANS.extra}`});
  const mw=minWageAt(p),br=+r.basicRate||0;if(mw!=null&&br>0&&br<mw-2-0.005)out.push({k:'minw',sev:'crit',zh:`底薪 $${br} 低於 ${p.slice(0,4)} 最低工資 $${mw}（試用期 $${mw-2}）`,en:`Basic $${br} is below the ${p.slice(0,4)} minimum wage $${mw} (probation $${mw-2})`});
  return out;}
function compare(grossUSD,p,rate){rate=rate||fx();const khr=grossUSD*rate,b=bandAt(p);const ob=b.from>='2026-11'?bandAt('2026-10'):b,nw=b.from>='2026-11'?b:bandAt('2026-11');
  return {khr:Math.round(khr),group:group(khr),oldBase:base(khr,ob),newBase:base(khr,nw),oldUSD:r2(base(khr,ob)*ob.pen/rate),newUSD:r2(base(khr,nw)*nw.pen/rate)};}
function lang(){try{return (document.documentElement.lang||'').startsWith('en')||(g.LANG==='en')?'en':'zh';}catch(e){return 'zh';}}
const T=(zh,en)=>lang()==='en'?en:zh;
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function bandLine(p){const b=bandAt(p),n=BANDS.find(x=>x.from>ym(p));return T(`${ym(p)} 適用：NSSF 繳費工資 ${b.min.toLocaleString()}–${b.max.toLocaleString()}៛，退休金員工 ${b.pen*100}%＋公司 ${b.pen*100}%，健保 2.6%、職災 0.8%（公司付）· ${b.src}`,`${ym(p)}: NSSF wage ${b.min.toLocaleString()}–${b.max.toLocaleString()}៛, pension ${b.pen*100}% employee + ${b.pen*100}% employer, health 2.6% and injury 0.8% (employer) · ${b.src}`)+(n?T(`；${n.from} 起改 ${n.min.toLocaleString()}–${n.max.toLocaleString()}៛、退休金各 ${n.pen*100}%${n.proj?'（推估）':''}`,`; from ${n.from}: ${n.min.toLocaleString()}–${n.max.toLocaleString()}៛, pension ${n.pen*100}% each${n.proj?' (projected)':''}`):'');}
/* 薪資頁（payroll.html，Tailwind）防呆面板 */
function payrollPanelHTML(recs,p){p=ym(p);if(!recs||!recs.length)return '';const rate=fx();const G={g1:0,g2:0,g3:0,g4:0};let dOld=0,dNew=0;const bad=[];
  recs.forEach(r=>{const g0=grossOf(r);if(g0>0){const c=compare(g0,p,rate);G[c.group]++;dOld+=c.oldUSD;dNew+=c.newUSD;}const w=checkPay(r,p);if(w.length)bad.push({r,w});});
  const mw=minWageAt(p),nextY=String(+p.slice(0,4)+1),mwN=minWageAt(nextY+'-01'),cnt=k=>bad.filter(x=>x.w.some(w=>w.k===k)).length;
  return `<div class="bg-white border ${bad.some(x=>x.w.some(w=>w.sev==='crit'))?'border-red-300':'border-emerald-200'} rounded-xl p-4 mb-4"><p class="text-sm font-semibold text-slate-800 mb-1">🛡️ ${T('NSSF／交通／最低工資 防呆','NSSF / transport / minimum-wage checks')} · ${esc(p)}</p>
  <p class="text-xs text-slate-600 mb-2">${esc(bandLine(p))}</p>
  <p class="text-xs text-slate-600 mb-2">${T('最低工資','Minimum wage')} ${p.slice(0,4)}：<b>${mw!=null?'$'+mw:T('未設定','not set')}</b>${mw!=null?T(`（試用期 $${mw-2}）`,` (probation $${mw-2})`):''} · ${nextY}：<b>${mwN!=null?'$'+mwN:T('公告後請填入','enter once announced')}</b> · ${T('交通／住宿 2026-04 起 $7＋$2.50＝$9.50（計薪滿 15 天）','Transport/housing from 2026-04: $7 + $2.50 = $9.50 (15+ paid days)')} · NSSF FX ${rate} <button class="underline text-sky-600" onclick="(function(){const v=prompt('NSSF 匯率 KHR/USD（當月 NSSF 公告）/ NSSF exchange rate',${rate});if(v&&+v>0){localStorage.setItem('hrpay_nssf_fx',JSON.stringify(+v));location.reload();}})()">${T('改','edit')}</button></p>
  <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">${GROUPS.map(([k,zh,en])=>`<div class="bg-slate-50 rounded-lg px-3 py-2"><div class="text-[10px] text-slate-500">${T(zh,en)}</div><div class="text-lg font-bold jmono">${G[k]}</div></div>`).join('')}</div>
  <p class="text-xs text-slate-600 mb-2">${T(`員工退休金 2% 合計：舊上下限 $${r2(dOld).toFixed(2)} → 新上下限 $${r2(dNew).toFixed(2)}（差 $${r2(dNew-dOld).toFixed(2)}；公司另付的退休金同額，健保／職災也照新基數）`,`Employee pension 2% total: old floor/ceiling $${r2(dOld).toFixed(2)} → new $${r2(dNew).toFixed(2)} (diff $${r2(dNew-dOld).toFixed(2)}; employer pension is the same amount, health/injury follow the new base too)`)}</p>
  ${bad.length?`<p class="text-xs font-semibold text-red-600 mb-1">⚠️ ${T('需要核對','To check')}：NSSF ${cnt('nssf')} · ${T('沒扣 NSSF','no NSSF')} ${cnt('nssf0')} · ${T('交通','transport')} ${cnt('trans')} · ${T('底薪','basic')} ${cnt('minw')} <span class="font-normal text-slate-400">${T('（滿 60 歲免繳退休金的人會出現在「沒扣 NSSF」，可略過）','(people aged 60+ are exempt from pension and appear under “no NSSF” — skip them)')}</span></p><details><summary class="text-xs text-sky-700 cursor-pointer">${T('看名單','Show list')} (${bad.length})</summary><div class="overflow-x-auto max-h-80"><table class="w-full text-xs"><thead><tr class="bg-slate-50"><th class="px-2 py-1 text-left">ID</th><th class="px-2 py-1 text-left">${T('姓名','Name')}</th><th class="px-2 py-1 text-left">${T('部門','Dept')}</th><th class="px-2 py-1 text-left">${T('問題','Issue')}</th></tr></thead><tbody>${bad.map(x=>`<tr class="border-b border-slate-50"><td class="px-2 py-1 jmono">${esc(x.r.id)}</td><td class="px-2 py-1">${esc(x.r.nameLat||x.r.name||'')}</td><td class="px-2 py-1">${esc(x.r.dept||'')}</td><td class="px-2 py-1 ${x.w.some(w=>w.sev==='crit')?'text-red-600':'text-amber-700'}">${x.w.map(w=>esc(T(w.zh,w.en))).join('<br>')}</td></tr>`).join('')}</tbody></table></div></details>`:`<p class="text-xs text-emerald-700">✅ ${T('本月每個人的 NSSF、交通、底薪都符合規定','Every NSSF deduction, transport amount and basic rate this month matches the rules')}</p>`}</div>`;}
/* NSSF 頁（hrpay-benefits.js）：E-Form 名單逐人比對舊／新基數 */
function eformPanelHTML(rows,p,cfg){p=ym(p);const b=bandAt(p);const G={g1:0,g2:0,g3:0,g4:0};let oldT=0,newT=0;const ch=[];const ob=bandAt('2026-10'),nb=bandAt('2026-11');
  (rows||[]).forEach(r=>{const k=Math.round(+r.salaryKHR||0);G[group(k)]++;const o=base(k,ob),n=base(k,nb);oldT+=o;newT+=n;if(o!==n)ch.push({r,o,n});});
  const bad=cfg&&(Math.round(+cfg.minimum)!==b.min||Math.round(+cfg.maximum)!==b.max);const rateT=(b.pen*2+b.health+b.risk);
  return `<h2>🛡️ ${T('NSSF 新規定（2026-11 起）逐人比對','New NSSF rule (from 2026-11) — person by person')}</h2><p class="hint">${esc(bandLine(p))}</p>
  ${bad?`<div class="notice" style="border-color:#dc2626;color:#b91c1c">⚠️ ${T(`本期設定的上下限 ${(+cfg.minimum).toLocaleString()}–${(+cfg.maximum).toLocaleString()}៛ 和 ${p} 規定 ${b.min.toLocaleString()}–${b.max.toLocaleString()}៛ 不符，請到 ⚙ 設定改回（10 月以前用舊值，11 月起用新值）`,`This period’s floor/ceiling ${(+cfg.minimum).toLocaleString()}–${(+cfg.maximum).toLocaleString()}៛ differs from the ${p} rule ${b.min.toLocaleString()}–${b.max.toLocaleString()}៛ — fix it in ⚙ Settings (old values through October, new values from November)`)}</div>`:''}
  <div class="cards">${GROUPS.map(([k,zh,en])=>`<div class="card"><span>${T(zh,en)}</span><b>${G[k]}</b><small>${k==='g1'?T('基數由 40 萬改 60 萬','base 400k → 600k'):k==='g2'?T('基數不變','base unchanged'):k==='g3'?T('上限放寬，基數變高','ceiling raised, base goes up'):T('上限 120 萬改 150 萬','base 1.2M → 1.5M')}</small></div>`).join('')}</div>
  <p class="hint">${T(`繳費工資合計：舊 ${oldT.toLocaleString()}៛ → 新 ${newT.toLocaleString()}៛；全部費率 ${(rateT*100).toFixed(1)}% 的月繳約 ${Math.round(oldT*rateT).toLocaleString()}៛ → ${Math.round(newT*rateT).toLocaleString()}៛（差 ${Math.round((newT-oldT)*rateT).toLocaleString()}៛）`,`Contribution wage total: old ${oldT.toLocaleString()}៛ → new ${newT.toLocaleString()}៛; at ${(rateT*100).toFixed(1)}% all-in, monthly ≈ ${Math.round(oldT*rateT).toLocaleString()}៛ → ${Math.round(newT*rateT).toLocaleString()}៛ (diff ${Math.round((newT-oldT)*rateT).toLocaleString()}៛)`)}</p>
  ${ch.length?`<details><summary>${T('基數會變的人','People whose base changes')} (${ch.length})</summary><div class="table-wrap"><table><thead><tr><th>ID</th><th>${T('姓名','Name')}</th><th>${T('工資 ៛','Wage ៛')}</th><th>${T('舊基數','Old base')}</th><th>${T('新基數','New base')}</th><th>${T('差額','Diff')}</th></tr></thead><tbody>${ch.map(x=>`<tr><td>${esc(x.r.empId)}</td><td>${esc(x.r.name)}</td><td>${Math.round(+x.r.salaryKHR||0).toLocaleString()}</td><td>${x.o.toLocaleString()}</td><td>${x.n.toLocaleString()}</td><td>${(x.n-x.o).toLocaleString()}</td></tr>`).join('')}</tbody></table></div></details>`:''}`;}
g.HRPayNSSF={BANDS,MINW,TRANS,GROUPS,bandAt,prevBand,fx,base,group,employeeUSD,minWageAt,grossOf,checkPay,compare,bandLine,payrollPanelHTML,eformPanelHTML};
})(typeof window!=='undefined'?window:globalThis);
