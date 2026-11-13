/* AC-HRA-PAY v3.9.27: source-preserving mobile reports. No payroll mutations. (v3.9.27：員工人力概況改圖表＋對齊表) */
(function(g){'use strict';
const str=v=>String(v==null?'':v).trim(), num=v=>Number.isFinite(Number(v))?Number(v):0;
const esc=v=>str(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const money=v=>num(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const pct=(n,d)=>d?(100*n/d).toFixed(1)+'%':'—';
const present=v=>!!str(v)&&!['—','-','unknown','other','n/a'].includes(str(v).toLowerCase());
function dept(v){const s=str(v).replace(/\s+/g,' ');const m=s.match(/^(?:sewing\s*)?line\s*0*(\d+)$/i);return m?'Line '+Number(m[1]):s||'待確認 Unknown';}
function id(r){return str(r.empId||r.id||r.employeeId).toUpperCase();}
function groups(rows,key){const out=new Map();rows.forEach(r=>{const k=key(r);if(!out.has(k))out.set(k,[]);out.get(k).push(r);});return [...out.entries()].sort((a,b)=>b[1].length-a[1].length||a[0].localeCompare(b[0]));}
function sourceRate(rows){const rates=rows.filter(r=>num(r.salaryUSD)>0&&num(r.salaryKHR)>0).map(r=>num(r.salaryKHR)/num(r.salaryUSD));if(!rates.length)return 0;const rate=rates.slice().sort((a,b)=>a-b)[Math.floor(rates.length/2)];return rates.every(x=>Math.abs(x-rate)<=Math.max(.05,rate*.0001))?Math.round(rate*10000)/10000:0;}
const DEFAULT_KHR_PER_USD=4000;
function fx(rows,p){const configured=num(p&&p.exchangeRate),source=sourceRate(rows),rate=configured>0?configured:source||DEFAULT_KHR_PER_USD;return {rate,source:configured>0?(p&&p.exchangeRateSource||'本期設定 Period setting'):source?'E-Form KHR ÷ USD':'系統預設 Default (可修改 Editable)',confirmed:rate>0,isDefault:!(configured>0)&&!source};}
function usd(v,rate){return rate>0?'$'+money(num(v)/rate):'待填匯率 FX required';}
function benefits(rows,module,period,p){
  // v3.9.21 compact card: totals first, one aligned line per department (Telegram <pre>), no walls of text
  const isN=module==='nssf',paid=rows.filter(r=>isN||r.eligible),fxInfo=fx(rows,p),rate=fxInfo.rate;
  const sum=(rs,k)=>rs.reduce((s,r)=>s+num(r[k]),0),total=sum(paid,'amount'),avg=paid.length?total/paid.length:0;
  const toUsd=v=>isN?(rate>0?num(v)/rate:0):num(v),cash=v=>isN?usd(v,rate):'$'+money(v);
  const pad=(v,w,right)=>{v=String(v);if(v.length>w)v=v.slice(0,w-1)+'…';return right?v.padStart(w,' '):v.padEnd(w,' ');};
  const table=(list,nameW)=>{const W=nameW||14;let out=pad('Dept',W)+' '+pad('Staff',5,1)+' '+pad('%',5,1)+' '+pad('USD',9,1)+'\n'+'-'.repeat(W+22)+'\n';
    list.forEach(([d,rs])=>{out+=pad(d,W)+' '+pad(rs.length,5,1)+' '+pad(paid.length?(100*rs.length/paid.length).toFixed(1):'0.0',5,1)+' '+pad(money(toUsd(sum(rs,'amount'))),9,1)+'\n';});
    return out+'-'.repeat(W+22)+'\n'+pad('TOTAL',W)+' '+pad(paid.length,5,1)+' '+pad('100.0',5,1)+' '+pad(money(toUsd(total)),9,1);};
  let text=(isN?'🛡 <b>NSSF 社會保險</b>':'🌿 <b>Seniority 半年年資</b>')+' · '+esc(period)+
    '\n👥 <b>'+paid.length+'</b> 人 Staff · 💵 <b>'+cash(total)+'</b> · 人均 Avg '+cash(avg);
  if(isN){
    text+='\n🟠 職災 Risk '+cash(sum(paid,'risk'))+' · 🔵 醫療 Health '+cash(sum(paid,'health'))+'\n🟣 退休金 Pension '+cash(sum(paid,'pension'))+' · 🏭 工廠 100% · 員工扣款 $0'+
      '\n💱 1 USD = '+rate.toLocaleString('en-US')+' KHR'+(fxInfo.isDefault?' (預設 Default)':'')+' · 原額 KHR '+total.toLocaleString('en-US');
  }else{
    text+='\n📆 平均天數 Avg days '+(paid.length?sum(paid,'days')/paid.length:0).toFixed(2)+' · 🧮 平均月薪 Avg wage $'+money(paid.length?sum(paid,'averageSalary')/paid.length:0)+
      '\n📐 正式工 Permanent · '+num(p.months)+' 個月 / '+num(p.divisor)+' × 給付天數';
  }
  const deps=groups(paid,r=>dept(r.dept));
  text+='\n\n<b>🏭 各部門 Department</b>\n<pre>'+esc(table(deps))+'</pre>';
  if(paid.some(r=>present(r.section))){
    const secs=groups(paid,r=>dept(r.dept)+'/'+(present(r.section)?dept(r.section):'?'));
    if(secs.length<=25)text+='\n<b>🧵 各組 Section</b>（同批人員 same staff）\n<pre>'+esc(table(secs,16))+'</pre>';
    else text+='\n🧵 各組 '+secs.length+' 組明細見核可文件 Sections in the report';
  }
  const missing=paid.filter(r=>!present(r.dept)).length;
  if(missing)text+='\n⚠️ '+missing+' 人缺部門 missing dept：請在「組別配對」補齊';
  if(isN)text+='\n<i>USD = KHR ÷ 匯率；先總額再換算，分組可能差 $0.01</i>';
  return text;
}

function matchDepartments(rows,roster,payroll,period){
  const unique=list=>{const m=new Map();list.forEach(r=>{const k=id(r);if(!k)return;if(m.has(k))m.set(k,null);else m.set(k,r);});return m;};
  const rm=unique(roster||[]),pm=unique(payroll||[]);let matched=0,missing=0;
  const result=rows.map(r=>{if(r.period!==period||r.kind!=='employee'||r.deleted)return r;const a=rm.get(id(r)),b=pm.get(id(r));let next={...r};
    if(!present(next.dept)){const value=a&&present(a.dept)?a.dept:b&&present(b.dept)?b.dept:'';if(value)next.dept=dept(value);}
    if(!present(next.section)&&a&&present(a.section))next.section=dept(a.section);
    if(!present(next.dept))missing++;
    if(next.dept!==r.dept||next.section!==r.section){matched++;next.departmentSource=period+' '+(a?'Employee HR':'Payroll');}
    return next;
  });return {rows:result,matched,missing};
}
function endDate(key){const m=str(key).match(/^(\d{4})(?:-(\d{2}))?/);if(!m)return '';return new Date(Date.UTC(+m[1],+(m[2]||12),0)).toISOString().slice(0,10);}
function elapsed(start,end){if(!/^\d{4}-\d{2}-\d{2}$/.test(str(start))||start>end)return null;const n=(Date.parse(end+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/(365.2425*86400000);return Number.isFinite(n)?n:null;}
function bool(v){const s=str(v).toLowerCase();if(['yes','y','true','1','是','មាន'].includes(s))return true;if(['no','n','false','0','否','គ្មាន'].includes(s))return false;return null;}
function employment(r){const s=[r.contractType,r.workStatus,r.empStatus,r.status].map(str).join(' ').toLowerCase();if(/probation|試用|សាកល្បង/.test(s))return '試用 Probation';if(/regular|permanent|formal|udc|正式|正職|អចិន្ត្រៃយ៍/.test(s))return '正式 Permanent';if(/contract|fixed|temporary|\bfdc\b|合約|合同|契約|កិច្ចសន្យា/.test(s))return '合約 Contract';return '未知 Unknown';}
function workforce(rows,key,label,previous){
  const end=endDate(key),start=key.length===4?key+'-01-01':key.slice(0,7)+'-01';
  const f=rows.filter(r=>r.gender==='F').length,m=rows.filter(r=>r.gender==='M').length,n=rows.length;
  const ages=rows.map(r=>{const a=elapsed(str(r.birth||r.dob),end);return a==null?(num(r.age)>0?num(r.age):null):a;}).filter(v=>v!=null&&v>=14&&v<100);
  const ten=rows.map(r=>elapsed(str(r.join||r.joinDate),end)).filter(v=>v!=null);
  const avg=a=>a.length?(a.reduce((s,v)=>s+v,0)/a.length).toFixed(1):'未知';
  /* v3.9.27（Paul 2026-11-13）：改成「圖表＋列表」——每個分類用橫條圖（條＋人數＋％在前、名稱在後，一眼看比例），
     部門／各組用和伙食、NSSF 送核摘要一樣的對齊表（Staff／％／女／男），男女用 🚺🚹 人形圖示與 10 格比例列。不再一項一段文字。 */
  const pl=(v,w)=>String(v).padStart(w,' '),pr=(v,w)=>{v=String(v);if(v.length>w)v=v.slice(0,w-1)+'…';return v.padEnd(w,' ');};
  const bar=(v,max)=>{const k=max>0?Math.round(v/max*10):0,kk=v>0&&k<1?1:k;return '█'.repeat(kk)+'░'.repeat(10-kk);};
  const chart=(icon,title,pairs,top)=>{pairs=pairs.filter(x=>x[1]>0);if(!pairs.length)return '';
    if(pairs.length===1)return '\n'+icon+' <b>'+title+'</b>：'+esc(pairs[0][0])+' '+pairs[0][1]+' (100%)';
    let rest=0;if(top&&pairs.length>top){rest=pairs.slice(top).reduce((a,x)=>a+x[1],0);pairs=pairs.slice(0,top);if(rest)pairs.push(['其他 Other',rest]);}
    const max=Math.max(...pairs.map(x=>x[1])),w=String(max).length;
    return '\n\n'+icon+' <b>'+title+'</b>\n<pre>'+esc(pairs.map(([k,v])=>bar(v,max)+' '+pl(v,w)+' '+pl(pct(v,n),6)+' '+k).join('\n'))+'</pre>';};
  const gk=Math.max(f&&m?1:0,Math.min(f&&m?9:10,Math.round(n?f/n*10:0)));
  const join=rows.filter(r=>{const d=str(r.join||r.joinDate);return d&&d>=start&&d<=end;}).length;
  const resign=rows.filter(r=>{const d=str(r.resignDate||r.leaveDate);return d&&d>=start&&d<=end;}).length;
  const rc=rows.filter(r=>Object.prototype.hasOwnProperty.call(r,'resignDate')&&str(r.resignDate)).length;
  let text='👥 <b>員工人力概況 Workforce Summary</b>\n📅 '+esc(label||key)+' · 👥 <b>'+n+' 人</b>\n━━━━━━━━━━━━'+
    '\n🚺 女 Female <b>'+f+'</b> ('+pct(f,n)+') · 🚹 男 Male <b>'+m+'</b> ('+pct(m,n)+')'+(n-f-m?' · ⚪ 未知 '+(n-f-m):'')+
    '\n'+'🚺'.repeat(gk)+'🚹'.repeat(10-gk)+
    '\n🟠 平均年齡 Avg age <b>'+avg(ages)+'</b> 歲 · 🟣 平均工齡 Avg tenure <b>'+avg(ten)+'</b> 年'+
    '\n🟢 新進 Joiners <b>+'+join+'</b> · 🔴 離職 Resigned <b>−'+resign+'</b>'+(rc?'':'（無離職來源 no source）');
  if(previous){const before=new Set(previous.rows.map(id)),now=new Set(rows.map(id));text+='\n🔄 名冊 Roster vs '+esc(previous.key)+'：新增 +'+rows.filter(r=>!before.has(id(r))).length+' · 移出 −'+previous.rows.filter(r=>!now.has(id(r))).length;}
  const women=rows.filter(r=>r.gender==='F'),preg=women.filter(r=>bool(r.pregnant)===true),pc=women.filter(r=>bool(r.pregnant)!=null).length;
  const mat=r=>/maternity|產假|សម្រាកលំហែមាតុភាព/i.test(str(r.status)+' '+str(r.workStatus)+' '+str(r.empStatus))||bool(r.maternity)===true;
  text+='\n🤰 懷孕 Pregnant <b>'+preg.length+'</b> · 🍼 產假 Maternity <b>'+women.filter(mat).length+'</b>'+(women.length-pc?'（未提供 not recorded '+(women.length-pc)+'）':'');
  const byCount=g2=>g2.map(([k,v])=>[k,v.length]).sort((a,b)=>b[1]-a[1]);
  text+=chart('🎂','年齡 Age',[['<25',ages.filter(x=>x<25).length],['25–34',ages.filter(x=>x>=25&&x<35).length],['35–44',ages.filter(x=>x>=35&&x<45).length],['45+',ages.filter(x=>x>=45).length],['未知 Unknown',n-ages.length]]);
  text+=chart('⏳','工齡 Tenure（年 yrs）',[['<1',ten.filter(x=>x<1).length],['1–2',ten.filter(x=>x>=1&&x<3).length],['3–4',ten.filter(x=>x>=3&&x<5).length],['5+',ten.filter(x=>x>=5).length],['未知 Unknown',n-ten.length]]);
  text+=chart('📋','聘用 Employment',byCount(groups(rows,employment)));
  text+=chart('🏠','本地／外地 Origin',byCount(groups(rows,r=>!present(r.province)?'未知 Unknown':/sihanouk|preah\s*sihanouk|ព្រះសីហនុ|西哈努克/i.test(r.province)?'本地 Local':'外地 Out-area')));
  text+=chart('🌏','國籍 Nationality',byCount(groups(rows,r=>!present(r.nationality)?'未知 Unknown':/cambod|khmer|កម្ពុជា|ខ្មែរ|柬埔寨/i.test(r.nationality)?'柬籍 Cambodian':'外籍 Foreign')));
  text+=chart('🎓','學歷 Education',byCount(groups(rows,r=>present(r.education)?str(r.education):'未提供 Unknown')),6);
  /* 部門／各組：和伙食、NSSF 送核摘要同一種對齊表 */
  const table=(list,W)=>{const ln='-'.repeat(W+17);let out=pr('Dept',W)+' '+pl('No.',4)+' '+pl('%',5)+' '+pl('F',3)+' '+pl('M',3)+'\n'+ln+'\n';
    list.forEach(([d,rs])=>{const ff=rs.filter(r=>r.gender==='F').length,mm=rs.filter(r=>r.gender==='M').length;out+=pr(d,W)+' '+pl(rs.length,4)+' '+pl(n?(100*rs.length/n).toFixed(1):'0.0',5)+' '+pl(ff,3)+' '+pl(mm,3)+'\n';});
    return out+ln+'\n'+pr('TOTAL',W)+' '+pl(n,4)+' '+pl('100.0',5)+' '+pl(f,3)+' '+pl(m,3);};   /* 寬 31 字，手機不換行 */
  const lineNo=k=>{const x=/^Line (\d+)$/.exec(k);return x?+x[1]:null;};
  const order=list=>list.sort((a,b)=>{const x=lineNo(a[0]),y=lineNo(b[0]);if(x!=null&&y!=null)return x-y;if(x!=null)return -1;if(y!=null)return 1;return b[1].length-a[1].length||a[0].localeCompare(b[0]);});
  text+='\n\n🏭 <b>部門 Departments</b> · 人數／％／女／男\n<pre>'+esc(table(groups(rows,r=>dept(r.dept)).sort((a,b)=>b[1].length-a[1].length),14))+'</pre>';
  if(rows.some(r=>present(r.section))){
    const secName=r=>present(r.section)?dept(r.section):dept(r.dept)+' (—)',dup={};
    groups(rows,r=>dept(r.dept)+'|'+secName(r)).forEach(([k])=>{const sn=k.split('|')[1];dup[sn]=(dup[sn]||0)+1;});
    const secs=order(groups(rows,r=>{const sn=secName(r);return dup[sn]>1?sn+' ('+dept(r.dept).slice(0,5)+')':sn;}));
    if(secs.length<=30)text+='\n🧵 <b>各組 Sections</b>（同批人員 same staff）\n<pre>'+esc(table(secs,14))+'</pre>';
    else text+='\n🧵 各組 Sections：'+secs.length+' 組，明細見平台 see platform';
  }
  text+='\n<i>％＝占本期人數；本地＝原表 Province 籍貫。缺值列「未知」，不推測。</i>';
  return text;
}
function warning(list,all,label,expired){
  const identity=r=>str(r.empId)?'id:'+str(r.empId).toUpperCase():'name:'+str(r.empName)+'|'+dept(r.empDept);
  const level=v=>/小|small/i.test(v)?'🟡 小過 Small':/大|big/i.test(v)?'🔴 大過 Big':/final|最後/i.test(v)?'🔴 最後警告 Final':/verbal|口頭/i.test(v)?'🟠 口頭 Verbal':str(v)||'未知';
  const active=r=>/已核可|approved/i.test(str(r.status))&&!expired(r);
  let text='⚠️ <b>員工警告 Warning Summary</b>\n📅 '+esc(label)+'\n📋 '+list.length+' 件 · 👥 '+new Set(list.map(identity)).size+' 人 · 待處理 '+list.filter(r=>/待|pending|verified/i.test(str(r.status))).length;
  groups(list,r=>dept(r.empDept)).forEach(([d,rs])=>text+='\n🏷 '+esc(d)+' · '+new Set(rs.map(identity)).size+' 人／'+rs.length+' 件');
  text+='\n\n<b>🧾 逐人逐筆 Details</b>';
  list.slice().sort((a,b)=>str(a.incidentDate).localeCompare(str(b.incidentDate))).forEach((r,i)=>{
    const history=all.filter(x=>identity(x)===identity(r)),period=list.filter(x=>identity(x)===identity(r)),valid=history.filter(active);
    text+='\n\n<b>'+String(i+1).padStart(2,'0')+' · '+esc(r.empName||'未填姓名')+' ['+esc(r.empId||'無工號')+']</b>\n🏷 '+esc(dept(r.empDept))+' · 🕐 '+esc(r.incidentDate||'未提供')+(r.incidentTime?' '+esc(r.incidentTime):'（時分未提供）')+'\n'+esc(level(r.level))+' · '+esc(r.status||'未知')+'\n本期 '+period.length+' 次 · 歷史 '+history.length+' 次 · 目前有效 '+valid.length+' 次\n有效：小 '+valid.filter(x=>/small|小/i.test(x.level)).length+'／大或最後 '+valid.filter(x=>/big|final|大|最後/i.test(x.level)).length+'\n📝 原因 Reason：'+esc(r.reason||'未提供');
  });return text+'\n\n<i>次數按工號；歷史含退件／失效，現有效只計已核可且未到期，不把小過自行換成大過。</i>';
}
g.HRPayReporting={str,num,esc,money,pct,present,dept,id,groups,sourceRate,fx,usd,benefits,matchDepartments,workforce,warning,employment,DEFAULT_KHR_PER_USD};
})(typeof window!=='undefined'?window:globalThis);
