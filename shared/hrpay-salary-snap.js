/* HRA-PAY 年度調薪：每年一份薪資快照（2026-11-24 Paul）
 * · 匯入人事的 salary adjust report（生產部／管理部簽呈裡的 Excel，例：2026年度管理部考核調薪建議）。
 *   每個工作表有兩組薪資欄（Basic … Total）：前一組＝當年薪資、後一組＝調後薪資；年份看 "Salary Report 2026"／"2026薪資總額"。
 * · 同一個檔案（SHA-256）不重複匯入；中斷了，下次從沒完成的工作表接著做（進度存在 snapFiles）。
 * · 外籍、Isay 那邊算薪的人（船務／會計、管理層、機密名單工號）一律不進 HRA-PAY（不存、不上雲）。
 * · 存在本頁 STATE.snaps（雲端 tool 'salary'，kind snaps／snapFiles），智慧同步只傳有變的分桶。
 * · 年度調薪頁「當年薪資」讀快照：調後底薪＝公告底薪（2027：正式 $212、試用期 $210），個別調薪另外加。
 * · 快照是固定月薪（底薪＋工齡＋技能＋職位＋語言＋交通住宿＋全勤），不是實發，所以停工扣 50% 的月份不會影響。
 */
(function(){'use strict';
var KEYMAP=[[/^basic$|^底薪$/i,'basic'],[/^seniority$|^工齡$/i,'seniority'],[/^skill$|^技能$|技術/i,'skill'],[/^position$|^職位$|職務/i,'position'],[/^language$|^語言$/i,'language'],[/housing|transport|房屋|交通|住宿/i,'housing'],[/motivation|attend|全勤/i,'attendance'],[/^total$|薪資總額|合計/i,'total']];
var PARTS=['basic','seniority','skill','position','language','housing','attendance','total'];
var PART_ZH={basic:'底薪',seniority:'工齡',skill:'技能',position:'職位',language:'語言',housing:'交通住宿',attendance:'全勤',total:'合計'};
var RE_EXPAT=/expat|外籍|foreign|taiwan|台籍|台幹|陸籍|china|chinese|philippin|菲籍|malaysia/i;
var RE_ACC=/ship|account|finance|船務|會計|財務|acco\b/i;
var RE_MGMT=/\bmanager\b|經理|director|協理|廠長|副總|\bGM\b|chairman|董事/i;
function S(){return window.STATE||(typeof STATE!=='undefined'?STATE:null)}
function zh(){try{return (typeof LANG==='undefined'||LANG!=='en')}catch(e){return true}}
function t2(a,b){return zh()?a:b}
function n(v){if(v==null||v==='')return 0;var x=parseFloat(String(v).replace(/[$,\s]/g,''));return isFinite(x)?x:0}
function e_(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function m(v){return '$'+(Math.round(n(v)*100)/100).toLocaleString('en-US',{maximumFractionDigits:2})}
function now(){return new Date().toISOString()}
function d10(v){if(v==null||v==='')return '';if(v instanceof Date&&!isNaN(v))return new Date(v.getTime()-v.getTimezoneOffset()*6e4).toISOString().slice(0,10);if(typeof v==='number'&&v>20000&&v<80000){var d=new Date(Math.round((v-25569)*864e5));return d.toISOString().slice(0,10)}var s=String(v).trim();var mm=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);if(mm)return mm[1]+'-'+('0'+mm[2]).slice(-2)+'-'+('0'+mm[3]).slice(-2);return s.slice(0,10)}
function live(a){return (a||[]).filter(function(r){return r&&!r.deleted})}
function snaps(){var st=S();return st?live(st.snaps):[]}
function files(){var st=S();return st?live(st.snapFiles):[]}
function confIds(){var st=S();var v=st&&st.settings&&st.settings.confidentialIds;return String(v||'').split(/[\s,，;；]+/).map(function(x){return x.trim()}).filter(Boolean)}
/* 不進 HRA-PAY 的原因（空字串＝可以進） */
function excludeWhy(r){var txt=[r.dept,r.section,r.position,r.nationality].join(' ');if(confIds().indexOf(String(r.empId))>=0)return t2('機密名單','Confidential list');if(RE_EXPAT.test(txt))return t2('外籍','Expat');if(RE_ACC.test(txt))return t2('船務／會計（Isay）','Shipping / accounting (Isay)');if(RE_MGMT.test(String(r.position||'')))return t2('管理層','Management');return ''}
window.HRPaySnapExclude=excludeWhy;
async function sha(buf){try{var h=await crypto.subtle.digest('SHA-256',buf);return Array.from(new Uint8Array(h)).map(function(b){return b.toString(16).padStart(2,'0')}).join('')}catch(e){var x=0,u=new Uint8Array(buf);for(var i=0;i<u.length;i+=7)x=(x*31+u[i])>>>0;return 'f'+u.length+'_'+x}}
/* ── 解析一個工作表 ── */
function parseSheet(ws,sheetName){
  var A=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:null});if(!A.length)return null;
  var hdr=-1;for(var i=0;i<Math.min(A.length,12);i++){var r=A[i]||[];var basics=r.filter(function(c){return /^\s*(basic|底薪)\s*$/i.test(String(c||''))}).length;var hasId=r.some(function(c){return /factory\s*id|工號/i.test(String(c||''))});if(basics>=2&&hasId){hdr=i;break}}
  if(hdr<0)return null;
  var H=A[hdr].map(function(c){return String(c==null?'':c).replace(/\s+/g,' ').trim()});
  var near=[A[hdr-1]||[],A[hdr+1]||[],A[hdr-2]||[]].map(function(r){return r.map(function(c){return String(c==null?'':c).replace(/\s+/g,' ').trim()})});
  var label=function(j){return [H[j]].concat(near.map(function(r){return r[j]||''})).join(' | ')};
  /* 薪資組：每個 Basic 開始，到 Total 結束 */
  var groups=[];H.forEach(function(h,j){if(/^(basic|底薪)$/i.test(h)){var g={start:j,cols:{}};for(var k=j;k<Math.min(H.length,j+12);k++){var lab=H[k]||(near[1]&&near[1][k])||'';var key=null;for(var q=0;q<KEYMAP.length;q++)if(KEYMAP[q][0].test(lab)){key=KEYMAP[q][1];break}if(key&&g.cols[key]==null)g.cols[key]=k;if(key==='total'){g.end=k;break}}groups.push(g)}});
  groups=groups.filter(function(g){return g.end!=null});
  if(groups.length!==2)return {skip:true,why:groups.length>2?t2('多年度總表（非調薪表）','multi-year roster, not an adjust report'):t2('找不到兩組薪資欄','two pay groups not found'),sheet:sheetName};
  /* 年份 */
  function yearOf(g){for(var j=g.start;j<=g.end;j++){var mm=label(j).match(/(20\d\d)/);if(mm)return +mm[1]}return null}
  var y0=yearOf(groups[0]),y1=yearOf(groups[1]);if(y0&&!y1)y1=y0+1;if(y1&&!y0)y0=y1-1;if(!y0)return {skip:true,why:t2('看不出年份','year not found'),sheet:sheetName};
  /* 其他欄 */
  var col=function(re,before){for(var j=0;j<H.length;j++){if(before!=null&&j>=before)break;if(re.test(label(j)))return j}return -1};
  var cId=col(/factory\s*id|工號/i),cEnS=col(/english\s*sure/i),cDept=col(/department|部門/i,groups[0].start),cSec=col(/section|組別/i,groups[0].start),cPos=col(/^position|崗位|職稱/i,groups[0].start),cJoin=col(/join\s*date|入職/i),cSex=col(/^sex|性別/i),cNat=col(/national|國籍/i);
  var between=function(re){for(var j=groups[0].end+1;j<groups[1].start;j++)if(re.test(label(j)))return j;return -1};
  var cAdj=between(/adjust amount|調動金額|調薪/i),cAdjD=between(/adjust date|調動日期/i),cEval=between(/evaluator|評核/i),cMark=between(/mark|總分|分數/i),cCom=between(/comment|意見|說明/i);
  var rows=[],skipped=[];
  for(var i2=hdr+1;i2<A.length;i2++){var r2=A[i2]||[];var id=r2[cId];if(id==null||id==='')continue;var ids=String(id).trim();if(!/^\d{1,6}$/.test(ids))continue;
    var pay=function(g){var o={};PARTS.forEach(function(p){o[p]=g.cols[p]!=null?n(r2[g.cols[p]]):0});if(!o.total)o.total=PARTS.slice(0,7).reduce(function(s,p){return s+o[p]},0);return o};
    var b=pay(groups[0]),a=pay(groups[1]);if(!b.total&&!a.total)continue;
    var name=cEnS>=0?[r2[cEnS],r2[cEnS+1]].filter(function(x){return x!=null&&x!==''}).join(' ').replace(/\s+/g,' ').trim():'';
    var rec={empId:ids,name:name,dept:cDept>=0?String(r2[cDept]||'').trim():'',section:cSec>=0?String(r2[cSec]||'').trim():'',position:cPos>=0?String(r2[cPos]||'').trim():'',joinDate:cJoin>=0?d10(r2[cJoin]):'',sex:cSex>=0?String(r2[cSex]||''):'',nationality:cNat>=0?String(r2[cNat]||''):'',before:b,after:a,adjust:cAdj>=0?n(r2[cAdj]):0,adjustDate:cAdjD>=0?d10(r2[cAdjD]):'',evaluator:cEval>=0?String(r2[cEval]||''):'',marks:cMark>=0&&r2[cMark]!=null?n(r2[cMark]):null,comment:cCom>=0?String(r2[cCom]||'').trim():''};
    var why=excludeWhy(rec);if(why){skipped.push({empId:ids,name:name,why:why});continue}
    rows.push(rec)}
  return {sheet:sheetName,fromYear:y0,year:y1,rows:rows,skipped:skipped};
}
/* ── 匯入（多檔、去重、續傳） ── */
var BUSY=false;
async function importFiles(fileList){
  if(BUSY){toast2(t2('匯入進行中…','Import running…'));return}
  if(!window.XLSX){toast2('XLSX ✗');return}
  var st=S();if(!st)return;st.snaps=st.snaps||[];st.snapFiles=st.snapFiles||[];BUSY=true;paint();
  var report=[];
  try{
    for(var f of Array.from(fileList||[])){
      var buf=await f.arrayBuffer(),h=await sha(buf),fk='SF|'+h;
      var fr=st.snapFiles.find(function(x){return x._k===fk&&!x.deleted});
      if(fr&&fr.done){report.push('⏭ '+f.name+t2('：已經匯入過，不重複','：already imported, skipped'));continue}
      if(!fr){fr={_k:fk,name:f.name,size:f.size,sheets:{},done:false,at:now(),updatedAt:now()};st.snapFiles.push(fr)}
      var wb=XLSX.read(buf,{type:'array'}); /* 日期用 Excel 序號換算，避免時區差一天 */var added=0,skippedP=0,years=new Set();
      for(var sn of wb.SheetNames){
        if(fr.sheets[sn]&&fr.sheets[sn].done)continue; /* 中斷過：做過的工作表不再做 */
        if(/all\s*staff|總表|roster|general|summary/i.test(sn)){fr.sheets[sn]={done:true,skip:true,why:t2('全廠總表／彙總，不是調薪表','roster / summary, not an adjust sheet')};continue}
        var p=parseSheet(wb.Sheets[sn],sn);
        if(!p||p.skip){fr.sheets[sn]={done:true,skip:true,why:p?p.why:''};continue}
        p.rows.forEach(function(r){var k='SN|'+p.year+'|'+r.empId;var cur=st.snaps.find(function(x){return x._k===k});var rec=Object.assign({_k:k,year:p.year,fromYear:p.fromYear,src:f.name+' / '+sn,fileKey:fk,updatedAt:now()},r);if(cur)Object.assign(cur,rec,{deleted:false});else st.snaps.push(rec);added++;years.add(p.year)});
        skippedP+=p.skipped.length;
        fr.sheets[sn]={done:true,rows:p.rows.length,skipped:p.skipped.length,year:p.year,fromYear:p.fromYear};fr.updatedAt=now();
        await persist('snap-'+sn); /* 每做完一張表就存一次：中斷了下次從下一張接 */
      }
      fr.done=true;fr.updatedAt=now();fr.rows=Object.values(fr.sheets).reduce(function(s,x){return s+(x.rows||0)},0);fr.years=[...years];
      await persist('snap-file');
      report.push('✅ '+f.name+'：'+t2(added+' 人存入快照（'+[...years].join('、')+'）'+(skippedP?'，'+skippedP+' 人不進 HRA-PAY（外籍／Isay／管理層）':''),added+' people saved ('+[...years].join(', ')+')'+(skippedP?', '+skippedP+' not in HRA-PAY (expat / Isay / management)':'')));
    }
    try{if(typeof scheduleSync==='function')scheduleSync('snap-import')}catch(e){}
  }catch(err){report.push('⚠ '+(err&&err.message||err));console.error(err)}
  finally{BUSY=false}
  toast2(report.join('\n')||t2('沒有檔案','No file'));LAST=report;try{if(window.renderRaise)renderRaise()}catch(e){}
}
var LAST=[];
function toast2(s){try{if(typeof toast==='function')return toast(s)}catch(e){}alert(s)}
function paint(){var b=document.getElementById('snapBusy');if(b)b.textContent=BUSY?t2('匯入中…','Importing…'):''}
/* ── 查快照 ── */
function recFor(year,id){return snaps().find(function(r){return +r.year===+year&&String(r.empId)===String(id)})||null}
/* 某年的固定月薪：先看隔年調薪表的「調前」，再看當年調薪表的「調後」 */
function payOfYear(X,id){var a=recFor(+X+1,id);if(a&&a.before&&a.before.total)return Object.assign({src:a.src,kind:'before'},a.before);var b=recFor(X,id);if(b&&b.after&&b.after.total)return Object.assign({src:b.src,kind:'after'},b.after);return null}
function years(){var s=new Set();snaps().forEach(function(r){if(r.fromYear)s.add(+r.fromYear);s.add(+r.year)});return [...s].sort()}
/* 年度調薪頁用：當年（y-1）薪資＋公告底薪 */
function basicFor(y,status){var b=null;try{b=typeof basicRowForYear==='function'?basicRowForYear(y):null}catch(e){}var reg=b&&n(b.regular)?n(b.regular):(+y===2027?212:null),pro=b&&n(b.probation)?n(b.probation):(+y===2027?210:null);return status==='probation'?(pro!=null?pro:reg):reg}
window.HRPaySnap={
  importFiles:importFiles,payOfYear:payOfYear,recFor:recFor,years:years,
  current:function(y,e,statusEff){var p=payOfYear(+y-1,e.empId);if(!p)return null;var nb=basicFor(y,statusEff);var up=nb!=null?Math.max(0,nb-n(p.basic)):0;return {total:n(p.total),basic:n(p.basic),newBasic:nb,baseUp:up,src:p.src}},
  count:function(){return snaps().length}
};
/* ── 年度調薪頁：快照面板（匯入＋跨年比較） ── */
var Q='';
function panel(y,inScopeIds){
  var ys=years(),fs=files(),ids=inScopeIds||null;
  var rowsBy={};ys.forEach(function(X){var tot=0,hc=0,adjN=0,adjS=0;snaps().forEach(function(r){});var seen={};snaps().forEach(function(r){var id=String(r.empId);if(seen[id])return;var p=payOfYear(X,id);if(!p)return;seen[id]=1;hc++;tot+=n(p.total)});snaps().filter(function(r){return +r.year===X}).forEach(function(r){if(n(r.adjust)>0){adjN++;adjS+=n(r.adjust)}});rowsBy[X]={hc:hc,tot:tot,avg:hc?tot/hc:0,adjN:adjN,adjS:adjS}});
  var maxT=Math.max.apply(null,[1].concat(ys.map(function(X){return rowsBy[X].tot})));
  var cur=+y-1;
  var h='<div class="panel" id="snapPanel"><div class="panel-head"><h2>🗂 '+t2('每年薪資快照','Yearly pay snapshots')+' <span class="badge b-regular">'+snaps().length+'</span></h2><div class="grow"></div><span class="hint" id="snapBusy"></span><label class="btn small primary" style="cursor:pointer">⬆ '+t2('匯入 salary adjust report','Import salary adjust report')+'<input type="file" accept=".xlsx,.xls" multiple style="display:none" onchange="HRPaySnap.importFiles(this.files);this.value=\'\'"></label></div>';
  h+='<div class="panel-body" style="padding-top:0"><div class="notice">💡 '+t2('丟生產部／管理部簽呈裡的調薪 Excel（可一次多個）。每個檔案只會匯入一次；中斷了再丟一次會從沒做完的工作表接著做。外籍、Isay 那邊算薪的人、管理層不會存進 HRA-PAY。<b>當年薪資</b>＝'+cur+' 年的固定月薪（快照），不是實發，所以停工扣半薪的月份不會算進來。','Drop the adjust-report Excels (several at once). Each file is imported once; if interrupted, drop it again and it continues from the unfinished sheet. Expats, Isay-paid staff and management are never stored here. <b>Current pay</b> = '+cur+' fixed monthly pay from the snapshot (not actual pay), so stoppage half-pay months never count.')+'</div>';
  if(fs.length)h+='<div class="hint" style="margin-top:6px">'+fs.map(function(f){return (f.done?'✅ ':'⏸ ')+e_(f.name)+' · '+(f.rows||0)+t2(' 人',' ppl')+(f.years&&f.years.length?' · '+f.years.join('/'):'')+(f.done?'':t2('（沒做完，再丟一次會接著做）',' (unfinished — drop again to resume)'))}).join('<br>')+'</div>';
  if(LAST.length)h+='<div class="hint" style="margin-top:6px;white-space:pre-line">'+e_(LAST.join('\n'))+'</div>';
  h+='</div>';
  if(ys.length){
    h+='<div class="table-wrap"><table><thead><tr><th>'+t2('年度','Year')+'</th><th class="num">'+t2('人數','People')+'</th><th>'+t2('固定月薪合計','Fixed monthly pay')+'</th><th class="num">'+t2('平均','Avg')+'</th><th class="num">'+t2('當年個別調薪','Individual raises')+'</th></tr></thead><tbody>'+
      ys.slice().reverse().map(function(X){var r=rowsBy[X],pct=r.tot/maxT*100,isCur=X===cur,isNext=X===+y;return '<tr style="'+(isCur?'background:#ecfdf5;font-weight:700':'')+'"><td class="mono">'+X+(isCur?' <span class="badge b-regular">'+t2('當年','current')+'</span>':isNext?' <span class="badge b-override">'+t2('調後','after')+'</span>':' <span class="badge b-resigned">'+t2('歷史','history')+'</span>')+'</td><td class="num">'+r.hc+'</td><td><div style="display:flex;align-items:center;gap:8px"><div style="flex:1;max-width:320px;height:12px;background:#eef2f7;border-radius:6px;overflow:hidden"><div style="width:'+pct.toFixed(1)+'%;height:100%;background:'+(isCur?'#10b981':isNext?'#f59e0b':'#94a3b8')+'"></div></div><b>'+m(r.tot)+'</b></div></td><td class="num">'+m(r.avg)+'</td><td class="num">'+(r.adjN?r.adjN+t2(' 人 ',' ppl ')+m(r.adjS):'—')+'</td></tr>'}).join('')+'</tbody></table></div>';
    h+='<div class="panel-body"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b>👤 '+t2('個人歷年','One person across years')+'</b><input class="control" style="max-width:220px" placeholder="'+t2('工號或姓名','ID or name')+'" value="'+e_(Q)+'" oninput="HRPaySnapQ(this.value)"></div><div id="snapPeople" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px;margin-top:8px">'+people(ys)+'</div></div>';
  }else h+='<div class="panel-body"><div class="empty">'+t2('還沒有快照，先匯入調薪 Excel。','No snapshots yet — import an adjust-report Excel.')+'</div></div>';
  return h+'</div>';
}
function people(ys){var q=Q.trim().toLowerCase();if(!q)return '<div class="hint">'+t2('輸入工號或姓名，看這個人每年的固定月薪和調薪原因。','Type an ID or name to see that person’s pay each year and raise reasons.')+'</div>';
  var seen={},list=[];snaps().forEach(function(r){var id=String(r.empId);if(seen[id])return;if(id.indexOf(q)>=0||String(r.name||'').toLowerCase().indexOf(q)>=0){seen[id]=1;list.push(r)}});
  return list.slice(0,24).map(function(r){var pts=ys.map(function(X){var p=payOfYear(X,r.empId);return {X:X,v:p?n(p.total):null}}).filter(function(p){return p.v!=null});var mx=Math.max.apply(null,[1].concat(pts.map(function(p){return p.v})));
    var notes=snaps().filter(function(x){return String(x.empId)===String(r.empId)&&(n(x.adjust)||x.comment)}).sort(function(a,b){return a.year-b.year}).map(function(x){return '<div class="hint">'+x.year+'：'+(n(x.adjust)?'+'+m(x.adjust)+' ':'')+e_(x.comment||'')+'</div>'}).join('');
    return '<div style="border:1px solid var(--line,#e2e8f0);border-radius:10px;padding:8px 10px;background:#fff"><div><b>'+e_(r.name)+'</b> <span class="mono hint">'+e_(r.empId)+'</span></div><div class="hint">'+e_([r.dept,r.section,r.position].filter(Boolean).join(' · '))+'</div><div style="display:flex;align-items:flex-end;gap:6px;height:70px;margin:6px 0">'+pts.map(function(p,i){var prev=i?pts[i-1].v:null,up=prev!=null?p.v-prev:0;return '<div style="flex:1;text-align:center"><div style="font-size:10px;color:'+(up>0?'#059669':up<0?'#dc2626':'#64748b')+'">'+(i&&up?(up>0?'+':'')+Math.round(up):'')+'</div><div title="'+p.X+' '+m(p.v)+'" style="height:'+Math.max(4,p.v/mx*48)+'px;background:#60a5fa;border-radius:4px 4px 0 0"></div><div style="font-size:10px">'+p.X+'</div><div style="font-size:10px;font-weight:700">'+Math.round(p.v)+'</div></div>'}).join('')+'</div>'+notes+'</div>'}).join('')||'<div class="hint">'+t2('找不到','Not found')+'</div>'}
window.HRPaySnapQ=function(v){Q=v;var b=document.getElementById('snapPeople');if(b)b.innerHTML=people(years())};
window.HRPaySnapPanel=panel;
})();
/* 考核出勤：列出考核年度的停工（讀 HRA-PAY 停工頁的本機資料 ac_hra_shutdown）。停工日不算缺勤；組長、助理停工照常上班。 */
(function(){
function t2(a,b){try{return (typeof LANG==='undefined'||LANG!=='en')?a:b}catch(e){return a}}
function load(){return new Promise(function(res){try{var r=indexedDB.open('ac_hra_shutdown');r.onsuccess=function(){var db=r.result;try{var q=db.transaction('events','readonly').objectStore('events').get('all');q.onsuccess=function(){res((q.result&&q.result.events)||[]);db.close()};q.onerror=function(){res([])}}catch(e){res([])}};r.onerror=function(){res([])};r.onupgradeneeded=function(){try{r.transaction.abort()}catch(e){}res([])}}catch(e){res([])}})}
window.HRPayStopNote=async function(year,elId){var el=document.getElementById(elId);if(!el)return;var ev=(await load()).filter(function(e){return String(e.start||'').slice(0,4)===String(year)});
 if(!ev.length){el.innerHTML='';return}var days=ev.reduce(function(s,e){return s+(+e.days||0)},0);
 var list=ev.map(function(e){return e.start.slice(5)+(e.end&&e.end!==e.start?'～'+e.end.slice(5):'')+(e.lines?' '+e.lines:e.shutLine&&e.ttlLine&&e.shutLine>=e.ttlLine?t2(' 全廠',' all lines'):'')}).join('、');
 el.innerHTML='<div class="notice" style="margin:0 0 10px">🛑 '+t2(year+' 年停工 '+ev.length+' 次、共 '+days+' 天（'+list+'）。考核出勤時：<b>停工日不算缺勤</b>；大組長、組長、助理停工時照常上班，要算出勤。當年薪資用正常固定月薪，不用扣過停工 50% 的月份。',year+': '+ev.length+' stoppages, '+days+' days ('+list+'). For attendance: <b>stoppage days are not absence</b>; leaders and assistants work during stoppages and count as present. Current pay uses normal fixed pay, never the half-pay months.')+'</div>'};
})();
