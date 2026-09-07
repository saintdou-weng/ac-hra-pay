/* AC-HRA-PAY v3.9.14: source-preserving mobile reports. No payroll mutations. */
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
function fx(rows,p){const rate=num(p&&p.exchangeRate)>0?num(p.exchangeRate):sourceRate(rows);return {rate,source:num(p&&p.exchangeRate)>0?'本期設定 Period setting':'E-Form KHR ÷ USD',confirmed:!!rate};}
function usd(v,rate){return rate>0?'$'+money(num(v)/rate):'待填匯率 FX required';}
function benefits(rows,module,period,p){
  const isN=module==='nssf',paid=rows.filter(r=>isN||r.eligible),rate=fx(rows,p).rate;
  const sum=(rs,k)=>rs.reduce((s,r)=>s+num(r[k]),0),total=sum(paid,'amount'),avg=paid.length?total/paid.length:0;
  const cash=v=>isN?usd(v,rate):'$'+money(v);
  let text=(isN?'🛡 <b>NSSF 社會保險</b>':'🌿 <b>Seniority 半年年資</b>')+'\n📅 '+esc(period)+' · 👥 '+paid.length+' 人 Staff\n💵 <b>'+cash(total)+'</b> · 人均 Avg '+cash(avg);
  if(isN){text+='\n🟠 職災 Risk '+cash(sum(paid,'risk'))+'\n🔵 醫療 Health '+cash(sum(paid,'health'))+'\n🟣 退休金 Pension '+cash(sum(paid,'pension'))+'\n🏭 工廠負擔 100% · 員工扣款 $0.00';
    text+='\n💱 '+(rate?'1 USD = '+rate.toLocaleString('en-US')+' KHR · '+esc(fx(rows,p).source):'請先設定本期匯率 FX required')+'\n原額 Source: KHR '+total.toLocaleString('en-US');
  }else{text+='\n📆 平均給付 Avg days '+(paid.length?sum(paid,'days')/paid.length:0).toFixed(2)+' 天\n🧮 平均月薪 Avg wage $'+money(paid.length?sum(paid,'averageSalary')/paid.length:0)+'\n正式工 Permanent · '+num(p.months)+' 個月 / '+num(p.divisor)+' × 實際給付天數';}
  const block=(label,rs)=>{const a=sum(rs,'amount');return '\n\n🏷 <b>'+esc(label)+'</b>\n👥 '+rs.length+' 人 · '+pct(rs.length,paid.length)+' · 💵 '+cash(a)+'\n人均 Avg '+cash(rs.length?a/rs.length:0)+(isN?'':' · 平均天數 '+(sum(rs,'days')/rs.length).toFixed(2));};
  text+='\n\n<b>🏭 各部門 Department</b>';
  groups(paid,r=>dept(r.dept)).forEach(([d,rs])=>text+=block(d,rs));
  if(paid.some(r=>present(r.section))){text+='\n\n<b>🧵 各組 Section（同一批人，不重複加總）</b>';groups(paid,r=>dept(r.dept)+' / '+(present(r.section)?dept(r.section):'待確認 Unknown')).forEach(([d,rs])=>text+=block(d,rs));}
  const missing=paid.filter(r=>!present(r.dept)).length;if(missing)text+='\n\n⚠️ '+missing+' 人缺部門：請配對同月份名冊／Payroll。';
  if(isN)text+='\n<i>USD = 各筆原額 ÷ 本期匯率；先加總原額再換算，分組顯示四捨五入可能差 $0.01。</i>';
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
  let text='👥 <b>員工人力概況 Workforce Summary</b>\n📅 '+esc(label||key)+' · 👥 <b>'+n+' 人</b>\n\n🩷 女 Female '+f+' ('+pct(f,n)+') · 🟦 男 Male '+m+' ('+pct(m,n)+')'+(n-f-m?'\n⚪ 性別未知 '+(n-f-m):'');
  text+='\n🟠 平均年齡 Age '+avg(ages)+' 歲 · 🟣 平均工齡 Tenure '+avg(ten)+' 年';
  const dist=(icon,title,pairs)=>'\n\n'+icon+' <b>'+title+'</b>\n'+pairs.map(([k,v])=>esc(k)+' '+v+' ('+pct(v,n)+')').join(' · ');
  text+=dist('🎂','年齡 Age',[['<25',ages.filter(x=>x<25).length],['25–34',ages.filter(x=>x>=25&&x<35).length],['35–44',ages.filter(x=>x>=35&&x<45).length],['45+',ages.filter(x=>x>=45).length],['未知',n-ages.length]]);
  text+=dist('⏳','工齡 Tenure',[['<1年',ten.filter(x=>x<1).length],['1–2年',ten.filter(x=>x>=1&&x<3).length],['3–4年',ten.filter(x=>x>=3&&x<5).length],['5+年',ten.filter(x=>x>=5).length],['未知',n-ten.length]]);
  text+=dist('📋','聘用 Employment',groups(rows,employment).map(([k,v])=>[k,v.length]));
  text+=dist('🏠','本地／外地 Origin',groups(rows,r=>!present(r.province)?'未知':/sihanouk|preah\s*sihanouk|ព្រះសីហនុ|西哈努克/i.test(r.province)?'本地 Local':'外地 Out-area').map(([k,v])=>[k,v.length]));
  text+=dist('🌏','國籍 Nationality',groups(rows,r=>!present(r.nationality)?'未知':/cambod|khmer|កម្ពុជា|ខ្មែរ|柬埔寨/i.test(r.nationality)?'柬籍 Cambodian':'外籍 Foreign').map(([k,v])=>[k,v.length]));
  const women=rows.filter(r=>r.gender==='F'),preg=women.filter(r=>bool(r.pregnant)===true),pc=women.filter(r=>bool(r.pregnant)!=null).length;
  const mat=r=>/maternity|產假|សម្រាកលំហែមាតុភាព/i.test(str(r.status)+' '+str(r.workStatus)+' '+str(r.empStatus))||bool(r.maternity)===true;
  const mc=women.filter(r=>bool(r.maternity)!=null||mat(r)).length;
  text+='\n\n🤰 <b>孕產 Pregnancy / maternity（女性資料）</b>\n懷孕 '+preg.length+' 已登記 · 未提供 '+(women.length-pc)+'\n產假 '+women.filter(mat).length+' 已登記 · 未提供 '+(women.length-mc);
  const join=rows.filter(r=>{const d=str(r.join||r.joinDate);return d&&d>=start&&d<=end;}).length;
  const resign=rows.filter(r=>{const d=str(r.resignDate||r.leaveDate);return d&&d>=start&&d<=end;}).length;
  const rc=rows.filter(r=>Object.prototype.hasOwnProperty.call(r,'resignDate')&&str(r.resignDate)).length;
  text+='\n\n🟢 本期新進 Joiners '+join+'（依到職日）\n🔴 已登記離職 Resigned '+resign+(rc?'':' · 無完整離職來源');
  if(previous){const before=new Set(previous.rows.map(id)),now=new Set(rows.map(id));text+='\n🔄 名冊變動 vs '+esc(previous.key)+'：新增 '+rows.filter(r=>!before.has(id(r))).length+'／移出 '+previous.rows.filter(r=>!now.has(id(r))).length+'（移出不等於離職）';}
  const edu=groups(rows,r=>present(r.education)?str(r.education):'未提供 Unknown');text+=dist('🎓','學歷 Education',edu.map(([k,v])=>[k,v.length]));
  const blocks=(rs,keyFn)=>groups(rs,keyFn).map(([d,list],i)=>{const ff=list.filter(r=>r.gender==='F').length,mm=list.filter(r=>r.gender==='M').length;return '\n\n'+['🟦','🟩','🟨','🟪','🟧'][i%5]+' <b>'+esc(d)+'</b>\n👥 '+list.length+' 人 ('+pct(list.length,n)+') · 女 '+ff+'／男 '+mm+(list.length-ff-mm?'／未知 '+(list.length-ff-mm):'');}).join('');
  text+='\n\n🏭 <b>部門 Departments</b>'+blocks(rows,r=>dept(r.dept));
  text+='\n\n🧵 <b>各組 Sections（同批人員，不再加總）</b>'+blocks(rows,r=>dept(r.dept)+' / '+(present(r.section)?dept(r.section):'組別未提供'));
  text+='\n\n<i>百分比以本期人數為分母；本地依原表 Province 籍貫判定，非現住址。缺值保留未知，不推測正式工、懷孕或離職。</i>';
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
g.HRPayReporting={str,num,esc,money,pct,present,dept,id,groups,sourceRate,fx,usd,benefits,matchDepartments,workforce,warning,employment};
})(typeof window!=='undefined'?window:globalThis);
