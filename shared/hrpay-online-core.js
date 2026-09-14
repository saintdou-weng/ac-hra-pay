/* AC-HRA-PAY 3.9.18 — Excel source, reviewed online adjustments. No eval. */
(function(root){
 'use strict';
 const clone=x=>x==null?x:JSON.parse(JSON.stringify(x));
 const plain=r=>Object.fromEntries(Object.entries(r||{}).filter(([k])=>!k.startsWith('_')));
 const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
 const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
 const id=r=>String(r.id==null?'':r.id).trim();
 const esc=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const round=(v,d=2)=>Math.sign(v)*Math.round((Math.abs(v)+Number.EPSILON*8)*10**d)/10**d;
 const now=()=>new Date().toISOString();
 function diff(a,b){return [...new Set([...Object.keys(a||{}),...Object.keys(b||{})])].filter(k=>!k.startsWith('_')&&!equal(a&&a[k],b&&b[k])).map(k=>({field:k,before:a&&a[k],after:b&&b[k]}));}
 function changed(before,after,reason){
   if(!reason||!reason.trim())throw Error('請填修改原因 / Change reason required / សូមបញ្ចូលមូលហេតុ');
   const r=clone(after),d=diff(plain(before),plain(after));
   r._source=clone(before&&before._source||{file:'Existing / 原有資料',at:now(),record:plain(before||{})});
   r._history=[...(before&&before._history||[]),{at:now(),reason:reason.trim(),changes:d}];
   r._online=true; r._reviewed=true; delete r._pending;
   return r;
 }
 function unique(rows){const m=new Map();for(const r of rows||[]){const k=id(r);if(!k)throw Error('工號不可空白 / Missing ID');if(m.has(k)&&!equal(plain(m.get(k)),plain(r)))throw Error('同檔工號重複而資料不同 / Conflicting duplicate ID: '+k);m.set(k,clone(r));}return [...m.values()];}
 // Reimport is a three-way comparison: previous source, effective local row, new source.
 function importPlan(oldRows,incoming,deleted={}){
   const next=unique(incoming),old=new Map((oldRows||[]).map(r=>[id(r),r])),conflicts=[],rows=[],changes=[];
   for(const n of next){const k=id(n),o=old.get(k);old.delete(k);
     if(deleted[k]){conflicts.push({id:k,kind:'deleted',before:deleted[k],incoming:n});continue;}
     if(!o){rows.push(n);changes.push({id:k,kind:'add'});continue;}
     const base=o._source&&o._source.record||plain(o),local=plain(o),fresh=plain(n);
     const sameFormula=!o._excel||!n._excel||equal(o._excel.cells,n._excel.cells);
     if(equal(base,fresh)&&sameFormula){const kept=clone(o);if(!kept._excel&&n._excel)kept._excel=clone(n._excel);if(!kept._source)kept._source=clone(n._source);rows.push(kept);continue;}
     if(!o._source||o._online||!equal(base,local)){conflicts.push({id:k,kind:!o._source?'legacy':'online',before:o,incoming:n});continue;}
     rows.push(n);changes.push({id:k,kind:'update',diff:diff(local,fresh)});
   }
   for(const [k,o]of old){conflicts.push({id:k,kind:'absent',before:o,incoming:null});}
   return {rows,conflicts,changes};
 }
 function resolvePlan(plan,choices){const rows=clone(plan.rows);for(const c of plan.conflicts){const pick=choices[c.id]||'keep';let r=pick==='excel'?c.incoming:c.kind==='deleted'?null:c.before;if(r){r=clone(r);if(pick==='excel'){r._history=[...(c.before&&c.before._history||[]),{at:now(),reason:'Confirmed Excel replacement / 確認採用 Excel',changes:diff(plain(c.before),plain(r))}];}rows.push(r);}}return unique(rows);}
 function sourceRows(rows,file){return rows.map(r=>({...clone(r),_source:{file,at:now(),record:plain(r)}}));}
 const col=n=>{let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
 const dec=a=>{const m=a.replace(/\$/g,'').match(/^([A-Z]+)(\d+)$/);if(!m)throw Error('Unsupported cell '+a);let c=0;for(const x of m[1])c=c*26+x.charCodeAt(0)-64;return {c:c-1,r:+m[2]};};
 function range(a,b){const s=dec(a),e=dec(b),out=[];if((e.r-s.r+1)*(e.c-s.c+1)>200)throw Error('Large range requires Excel');for(let r=s.r;r<=e.r;r++)for(let c=s.c;c<=e.c;c++)out.push(col(c)+r);return out;}
 function parse(formula){
   let p=0;const tokens=[],s=String(formula).replace(/^=/,'');
   const re=/\s+|"(?:[^"]|"")*"|(?:\d+(?:\.\d*)?|\.\d+)(?:E[+-]?\d+)?|\$?[A-Z]+\$?\d+|[A-Z_][A-Z0-9_.]*|<=|>=|<>|[+\-*/^%(),:=<>&]/gy;
   while(p<s.length){re.lastIndex=p;const m=re.exec(s);if(!m)throw Error('公式需在 Excel 計算 / Unsupported formula: '+s.slice(p,p+30));p=re.lastIndex;if(!/^\s+$/.test(m[0]))tokens.push(m[0]);}p=0;
   const peek=()=>tokens[p],take=()=>tokens[p++],need=t=>{if(take()!==t)throw Error('Formula syntax: expected '+t);};
   function atom(){let t=take(),v;if(t==='+'||t==='-')return {op:'unary',sign:t,a:atom()};if(t==='('){v=expr(0);need(')');}
     else if(t&&t.startsWith('"'))v={value:t.slice(1,-1).replace(/""/g,'"')};
     else if(t&&/^(?:\d|\.)/.test(t))v={value:Number(t)};
     else if(t&&/^\$?[A-Z]+\$?\d+$/.test(t)){v={ref:t.replace(/\$/g,'')};if(peek()===':'){take();v={range:range(v.ref,take())};}}
     else if(t==='TRUE'||t==='FALSE')v={value:t==='TRUE'};
     else if(t&&peek()==='('){take();const args=[];if(peek()!==')'){do{if(peek()===',')take();args.push(expr(0));}while(peek()===',');}need(')');v={fn:t,args};}
     else throw Error('Unsupported formula token '+t);
     while(peek()==='%'){take();v={op:'/',a:v,b:{value:100}};}return v;
   }
   const prec={'=':1,'<>':1,'<':1,'>':1,'<=':1,'>=':1,'&':2,'+':3,'-':3,'*':4,'/':4,'^':5};
   function expr(min){let a=atom();while(prec[peek()]>=min){const op=take(),b=expr(prec[op]+1);a={op,a,b};}return a;}
   const ast=expr(0);if(p!==tokens.length)throw Error('Formula trailing tokens');return ast;
 }
 function refs(ast,out=new Set()){if(ast.ref)out.add(ast.ref);if(ast.range)ast.range.forEach(r=>out.add(r));if(ast.a)refs(ast.a,out);if(ast.b)refs(ast.b,out);(ast.args||[]).forEach(a=>refs(a,out));return out;}
 const num=v=>{if(v===null||v===''||v===undefined)return 0;const n=Number(v);if(!Number.isFinite(n))throw Error('Invalid numeric input '+v);return n;};
 function calc(ast,get){
   if('value'in ast)return ast.value;if(ast.ref)return get(ast.ref);if(ast.range)return ast.range.map(get);
   if(ast.op){const a=calc(ast.a,get);if(ast.op==='unary')return (ast.sign==='-'?-1:1)*num(a);const b=calc(ast.b,get);
     if(ast.op==='&')return String(a)+String(b);if(['=','<>'].includes(ast.op)){const same=typeof a==='string'||typeof b==='string'?String(a).toLowerCase()===String(b).toLowerCase():a===b;return ast.op==='='?same:!same;}
     const x=num(a),y=num(b);switch(ast.op){case'+':return x+y;case'-':return x-y;case'*':return x*y;case'/':if(!y)throw Error('除數不可為 0 / Division by zero');return x/y;case'^':return x**y;case'<':return x<y;case'>':return x>y;case'<=':return x<=y;case'>=':return x>=y;}
   }
   if(ast.fn==='IF')return calc(ast.args[calc(ast.args[0],get)?1:2]||{value:false},get);
   if(ast.fn==='OR')return ast.args.some(a=>!!calc(a,get));if(ast.fn==='AND')return ast.args.every(a=>!!calc(a,get));
   const args=ast.args.map(a=>calc(a,get)),flat=args.flat();
   switch(ast.fn){case'SUM':return flat.reduce((s,x)=>s+(typeof x==='number'?x:0),0);case'MIN':return Math.min(...flat.map(num));case'MAX':return Math.max(...flat.map(num));case'ROUND':return round(num(args[0]),num(args[1]));case'ROUNDDOWN':return Math.trunc(num(args[0])*10**num(args[1]))/10**num(args[1]);case'INT':return Math.floor(num(args[0]));case'ABS':return Math.abs(num(args[0]));case'COUNT':return flat.filter(x=>typeof x==='number').length;default:throw Error('需人工確認 / Unsupported function '+ast.fn);}
 }
 const outCols={baseTotal:'K',achieve:'L',cut5:'M',incentive:'N',annualLeavePaid:'R',advDeduction:'S',suspend:'T',leaveHour:'U',leavePersonal:'V',daySwap:'W',travel:'X',bonus:'Y',nightWork:'Z',holidayPay:'AA',regOT:'AB',nightOT:'AC',sundayPay:'AD',otTotal:'AE',debt:'AF',subtotal:'AG',nssf:'AH',union:'AI',tax:'AJ',totalSalary:'AK',basicPay:'BX',seniority:'BY',position:'BZ',skill:'CA',language:'CB'};
 const fields=[
  ['E','b','基本薪 USD / Basic / ប្រាក់គោល','rate'],['F','b','年資加給 USD / Seniority allowance / អតីតភាព','rate'],['G','b','技術 USD / Skill / បច្ចេកទេស','rate'],['H','b','職務 USD / Position / មុខងារ','rate'],['I','b','語言 USD / Language / ភាសា','rate'],
  ['J','a','計薪天數 / Paid days / ថ្ងៃបើកប្រាក់','days'],['T','a','停工天數 / Shutdown days / ថ្ងៃព្យួរការងារ','period'],['U','a','時假小時 / Hourly leave / ម៉ោងច្បាប់','period'],['V','a','事假小時 / Personal leave / ម៉ោងឈប់','period'],['W','a','換休天數 / Day swap / ថ្ងៃប្តូរ','period'],['Z','a','夜班天數 / Night days / ថ្ងៃយប់','period'],['AA','a','假日天數 / Holiday days / ថ្ងៃបុណ្យ','period'],['AB','a','普通 OT 小時 / OT hours / ម៉ោងបន្ថែម','period'],['AC','a','夜間 OT 小時 / Night OT / ម៉ោងយប់','period'],['AD','a','周日天數 / Sunday days / ថ្ងៃអាទិត្យ','period'],['M','a','工作扣款 USD / Work penalty / ប្រាក់កាត់','period'],['N','b','獎勵 USD / Incentive / ប្រាក់លើកទឹកចិត្ត','period'],['AH','b','員工 NSSF 扣款（原表帶號）USD / Employee NSSF / កាត់ ប.ស.ស.','nssf']
 ];
 function capturePay(ws,b){
   if(!ws['AK'+b]?.f)return null;
   const a=b-1,cells={},labels={},outputs={};fields.forEach(([c,row,label,kind])=>labels[c+(row==='a'?a:b)]={label,kind});
   labels['C'+(a-1)]={label:'到職日期 / Join date / ថ្ងៃចូល',kind:'date'};
   labels.AQ1={label:'交通津貼計算日期 / Allowance cutoff / ថ្ងៃគណនា',kind:'date'};
   labels.AN1={label:'薪資稅換算 KHR/USD / Tax FX / អត្រាពន្ធ',kind:'rate'};
   function add(key){if(cells[key])return;if(Object.keys(cells).length>300)throw Error('Formula dependency too large');const source=ws[key]||{v:0},meta=labels[key];const c=cells[key]={v:source.v==null?0:source.v};if(source.f)c.sourceFormula=source.f;
     if(meta){Object.assign(c,meta,{input:true});return;}
     if(!source.f){c.input=true;return;}
     if(/[!\[\]]/.test(source.f)){c.input=true;c.external=true;return;}
     try{const ast=parse(source.f);if([...source.f.matchAll(/([A-Z][A-Z0-9_.]*)\(/g)].some(m=>!['IF','OR','AND','SUM','MIN','MAX','ROUND','ROUNDDOWN','INT','ABS','COUNT'].includes(m[1])))throw Error('manual');c.f=source.f;for(const dep of refs(ast))add(dep);}
     catch(e){c.input=true;c.external=true;delete c.f;}
   }
   for(const [k,c]of Object.entries(outCols)){outputs[k]=c+b;add(c+b);}
   for(const key of Object.keys(labels))add(key);
   const extraLabels={R:'年假給付 USD / Annual leave pay',S:'預付金額 USD（來源符號）/ Advance',X:'交通津貼 USD / Travel',Y:'全勤獎金 USD / Attendance bonus',AJ:'薪資稅 USD（來源符號）/ Salary tax',AI:'工會費 USD（來源符號）/ Union',AF:'補扣金額 USD / Arrears',L:'達標獎金 USD / Achievement',EQ:'效率獎金基準 / Efficiency',EO:'效率係數 / Efficiency factor',ES:'效率倍率 / Efficiency multiplier',DV:'工會費 KHR / Union KHR'};
   for(const [c,label]of Object.entries(extraLabels)){const n=cells[c+b];if(n?.input&&!n.label)n.label=label;}
   // Advance formula uses row A basic rate; keep both rates editable and in step.
   add('E'+a);
   if(!cells['AK'+b]?.f||Object.values(cells).some(c=>c.external&&c.sourceFormula&&!/[!\[\]]/.test(c.sourceFormula)))return null;
   return {version:1,row:b,cells,outputs,overrides:{}};
 }
 function evaluate(model,overrides={}){
   const values={},busy=new Set(),inputs={...(model.overrides||{}),...overrides};
   function get(key){if(key in values)return values[key];if(busy.has(key))throw Error('Circular formula '+key);const c=model.cells[key];if(!c)throw Error('Missing cell '+key);busy.add(key);let v;
     if(key in inputs){if(inputs[key]===null||inputs[key]==='')throw Error('待填 / Required: '+(c.label||key));v=inputs[key];}
     else v=c.f?calc(parse(c.f),get):c.v;
     if(typeof v==='number'&&!Number.isFinite(v))throw Error('Invalid calculation '+key);busy.delete(key);return values[key]=v;
   }
   const result={};for(const [field,key]of Object.entries(model.outputs))result[field]=num(get(key));return {result,values};
 }
 function recalcPay(row,overrides){if(!row._excel)throw Error('請重新匯入 Excel 以取得個別公式 / Reimport Excel for formulas');for(const [key,value]of Object.entries(overrides||{})){const c=row._excel.cells[key];if(value!==null&&c&&['rate','days','period'].includes(c.kind)&&Number(value)<0)throw Error('天數、時數及薪資率不可為負數 / Negative input: '+(c.label||key));if(c?.kind==='days'&&Number(value)>31)throw Error('計薪天數超過本月範圍 / Paid days exceed month');}const m=clone(row._excel);Object.assign(m.overrides,overrides);const b=m.row;if(('E'+b)in overrides)m.overrides['E'+(b-1)]=overrides['E'+b];const {result,values}=evaluate(m),r={...clone(row),...result,_excel:m};
   for(const k of ['advDeduction','nssf','union','tax'])r[k]=Math.abs(r[k]);r.advGiven=Math.abs(result.advDeduction);
   r.workDays=num(values['J'+(b-1)]??m.overrides['J'+(b-1)]??m.cells['J'+(b-1)].v);for(const [k,c]of [['basicRate','E'],['seniorityRate','F'],['skillRate','G'],['positionRate','H'],['languageRate','I']])r[k]=num(values[c+b]??m.overrides[c+b]??m.cells[c+b].v);
   return r;
 }
 function draftPay(row){const r=clone(row);delete r._source;delete r._history;r._online=true;r._pending=true;r._reviewed=false;r._draftFrom=id(row);if(r._excel){const m=r._excel,b=m.row;m.overrides={};for(const [key,c]of Object.entries(m.cells))if(c.input){m.overrides[key]=c.v;if(c.kind==='days')m.overrides[key]=null;else if(c.kind==='period'||c.kind==='nssf')m.overrides[key]=0;}
     // Clear one-off amounts and attendance-driven inputs, retaining source formulas.
     for(const c of ['L','N','R','S','AF','DM','EQ','EP','DV']){const key=c+b;if(m.cells[key]&&m.cells[key].input)m.overrides[key]=0;}
   }
   for(const k of Object.keys(outCols))r[k]=0;r.workDays=0;r.advGiven=0;return r;
 }
 function mealAmount(days,fx=4000){if(!(Number(fx)>0))throw Error('匯率必須大於 0 / Invalid exchange rate');const used=new Set();let riel=0;for(const d of days){if(used.has(+d.d))throw Error('日期重複 / Duplicate day '+d.d);used.add(+d.d);for(const k of ['present','ot']){const v=num(d[k]);if(v<0)throw Error('每日金額不可為負數 / Negative daily amount');riel+=v;}}return {riel,usd:riel/Number(fx)};}
 function rosterPlan(rows,roster,start,end){const active=new Map(),excluded=[],issues=[];for(const p of roster){const k=id(p);if(!k||active.has(k)){issues.push('重複或缺工號 / Duplicate or missing ID: '+k);continue;}if(!p.join){issues.push(k+' 缺到職日 / Missing join date');continue;}if(p.join>end)continue;if(p.resignDate&&p.resignDate<start){excluded.push(k);continue;}active.set(k,p);}
   const current=new Map(rows.map(r=>[id(r),r])),add=[],update=[];for(const [k,p]of active){const old=current.get(k);if(!old)add.push(p);else{const name=old.nameLat!==undefined?'nameLat':'name';const after={...old,[name]:p.name||old[name],dept:p.section||p.dept||old.dept};if(diff(plain(old),plain(after)).length)update.push({before:old,after});}}
   const remove=rows.filter(r=>excluded.includes(id(r))),missing=rows.filter(r=>!active.has(id(r))&&!excluded.includes(id(r)));
   return {add,update,remove,missing,issues};
 }
 // Source checks use the attached workbooks' cached amounts and formulas.
 function validMonth(k){return /^20\d{2}-(0[1-9]|1[0-2])$/.test(k);}
 function validateBackup(data,mod){
   if(!data||Array.isArray(data)||typeof data!=='object'||!Object.keys(data).length)throw Error('備份內容為空或格式不正確 / Invalid empty backup');
   const out=clone(data);
   for(const [key,e]of Object.entries(out)){
     const month=key.slice(0,7);if(!validMonth(month)||(mod==='meal'?!/^20\d{2}-\d{2}:[12]$/.test(key):key!==month)||!e||Array.isArray(e)||typeof e!=='object')throw Error('備份期間格式錯誤 / Invalid period: '+key);
     if((e.periodKey&&e.periodKey!==key)||(e.key&&e.key!==key))throw Error('備份內外期間不一致 / Period mismatch: '+key);
     const check=rows=>{if(!Array.isArray(rows))throw Error('缺少人員陣列 / Missing records: '+key);for(const r of rows){if(!r||typeof r!=='object'||Array.isArray(r))throw Error('Invalid row');for(const [f,v]of Object.entries(plain(r)))if(['totalSalary','usd','riel','workDays','basicPay','nssf','tax'].includes(f)&&v!=null&&(typeof v!=='number'||!Number.isFinite(v)))throw Error('金額欄位格式錯誤 / Invalid number: '+key+' '+f);}return unique(rows);};
     if(mod==='payroll'){if(!Array.isArray(e.advanceRecords)&&!Array.isArray(e.payrollRecords))throw Error('不是 Payroll 備份 / Not a payroll backup');for(const s of ['advance','payroll'])if(e[s+'Records']!=null)e[s+'Records']=check(e[s+'Records']);}
     else if(mod==='employee'){e.rows=check(e.rows);}
     else {if(!e.meal&&!e.att)throw Error('不是 Meal Fee 備份 / Not a meal backup');if(e.year!=null&&+e.year!==+month.slice(0,4)||e.month!=null&&+e.month!==+month.slice(5)||e.batch!=null&&+e.batch!==+key.slice(-1))throw Error('餐費備份年月不一致 / Meal period mismatch');for(const s of ['meal','att'])if(e[s]){e[s].rows=check(e[s].rows);for(const r of e[s].rows)if(r.days){mealAmount(r.days,4000);for(const d of r.days)if(!Number.isInteger(+d.d)||+d.d<1||+d.d>new Date(+month.slice(0,4),+month.slice(5),0).getDate())throw Error('餐費日期不正確 / Invalid meal date');}}}
   }return out;
 }
 function normalizeAttendance(data){
   const d=clone(data);d.rows=unique(d.rows);const max=new Date(d.year,d.month,0).getDate();
   if(!validMonth(d.year+'-'+String(d.month).padStart(2,'0'))||!d.dayList?.length||new Set(d.dayList.map(Number)).size!==d.dayList.length)throw Error('考勤年月或日期重複 / Invalid attendance period');
   for(const day of d.dayList)if(!Number.isInteger(+day)||day<1||day>max)throw Error('考勤日期超出月份 / Attendance date outside month');
   for(const r of d.rows){mealAmount(r.days,4000);if(r.days.some(x=>!d.dayList.includes(+x.d)))throw Error('考勤日期與表頭不符 / Attendance date mismatch');if(!Number.isFinite(r.usd))throw Error('考勤缺少 USD 合計 / Missing source USD total');}
   const hasFirst=d.dayList.some(x=>x<=15),hasSecond=d.dayList.some(x=>x>15);d.notes=d.notes||[];
   if(hasFirst&&hasSecond){const second=d.dayList.filter(x=>x>15);if(d.rows.some(r=>r.days.some(x=>x.d>15&&(Number(x.present)||Number(x.ot)))))throw Error('考勤跨上／下半月且有金額，請由 Excel 分成兩份並保留各自 USD Total，再匯入。 / Split nonzero cross-batch attendance in Excel with separate USD totals.');d.notes.push('表內 '+second.join(',')+' 日全員為 0，屬下半月空白欄，未併入本批 / Zero next-batch columns excluded');d.dayList=d.dayList.filter(x=>x<=15);for(const r of d.rows)r.days=r.days.filter(x=>x.d<=15);}
   d.startDay=Math.min(...d.dayList);d.endDay=Math.max(...d.dayList);return d;
 }
 function mergeAttendanceSource(previous,incoming){
   const d=normalizeAttendance(incoming),att=clone(previous||{rows:[],dayList:[],sources:[]});att.rows=att.rows||[];att.dayList=att.dayList||[];
   const sourceRows=att.rows.map(r=>Object.assign(clone(r),clone(r._source?.record||plain(r))));
   // Upgrade the previously imported, all-zero 16th column without changing totals.
   const zeroExtra=att.dayList.filter(day=>day>15&&d.startDay<=15&&sourceRows.every(r=>(r.days||[]).filter(x=>x.d===day).every(x=>!num(x.present)&&!num(x.ot))));
   att.dayList=att.dayList.filter(x=>!zeroExtra.includes(x));for(const r of sourceRows)r.days=(r.days||[]).filter(x=>!zeroExtra.includes(x.d));
   const segments={};for(const [k,v]of Object.entries(att.usdSegments||{})){const ds=k.slice(2).split(',').map(Number).filter(x=>!zeroExtra.includes(x));if(ds.length)segments['d:'+ds.sort((a,b)=>a-b).join(',')]=clone(v);}
   if(!Object.keys(segments).length&&att.dayList.length)segments['d:'+att.dayList.join(',')]=Object.fromEntries(sourceRows.map(r=>[id(r),num(r.usd)]));
   const newDays=new Set(d.dayList),segKey='d:'+d.dayList.slice().sort((a,b)=>a-b).join(','),replaced=[];
   for(const key of Object.keys(segments)){const days=key.slice(2).split(',').map(Number);if(!days.some(x=>newDays.has(x)))continue;if(!days.every(x=>newDays.has(x)))throw Error('日期區段重疊，不能重複加總來源 USD。請匯入原區段的修正版，或完整涵蓋舊區段的新檔。 / Partial overlap: use the same segment or a full replacement.');replaced.push(key);}
   const segment={};for(const k of replaced){for(const [employee,usd]of Object.entries(segments[k]))segment[employee]=num(segment[employee])+num(usd);delete segments[k];}
   const idx=new Map(sourceRows.map(r=>[id(r),r]));
   for(const n of d.rows){const old=idx.get(id(n)),r=old||{id:id(n),days:[]},days=new Map((r.days||[]).map(x=>[+x.d,clone(x)]));for(const x of n.days)days.set(+x.d,clone(x));Object.assign(r,{name:n.name||r.name,dept:n.dept||r.dept,division:n.division||r.division||'',group:n.group||r.group||'',days:[...days.values()].sort((a,b)=>a.d-b.d)});segment[id(n)]=n.usd;idx.set(id(n),r);}
   segments[segKey]=segment;att.usdSegments=segments;att.rows=[...idx.values()].map(r=>{r.riel=(r.days||[]).reduce((s,x)=>s+num(x.present)+num(x.ot),0);r.usd=Object.values(segments).reduce((s,m)=>s+num(m[id(r)]),0);for(const f of ['_source','_history','_online','_reviewed','_pending'])delete r[f];return r;});
   att.dayList=[...new Set([...att.dayList,...d.dayList])].sort((a,b)=>a-b);att.startDay=Math.min(...att.dayList);att.endDay=Math.max(...att.dayList);att.notes=[...new Set([...(att.notes||[]),...(d.notes||[])])];return att;
 }
 function mealReconciliation(meal,att,fx=4000){
   if(!(fx>0))throw Error('Invalid FX');const mm=new Map((meal?.rows||[]).map(r=>[id(r),r])),am=new Map((att?.rows||[]).map(r=>[id(r),r]));
   const rows=[...new Set([...mm.keys(),...am.keys()])].map(k=>{const m=mm.get(k),a=am.get(k),md=new Map((m?.days||[]).map(d=>[+d.d,d])),ad=new Map((a?.days||[]).map(d=>[+d.d,d]));const days=[...new Set([...md.keys(),...ad.keys()])].sort((a,b)=>a-b).filter(day=>{const x=md.get(day),y=ad.get(day);return !x||!y||Math.abs(num(x.present)-num(y.present))>1e-6||Math.abs(num(x.ot)-num(y.ot))>1e-6;});const khr=num(m?.riel)-num(a?.riel),usd=num(m?.usd)-num(a?.usd);return {id:k,name:m?.name||a?.name||'',dept:m?.dept||a?.dept||'',kind:!m?'attendanceOnly':!a?'mealOnly':Math.abs(khr)>1e-6||days.length?'dailyDifference':Math.abs(usd)>=.005?'sourceUSD':'matched',mealKHR:num(m?.riel),attKHR:num(a?.riel),mealUSD:num(m?.usd),attUSD:num(a?.usd),khr,usd,commonUSD:khr/fx,days};});
   const totals=rows.reduce((s,r)=>{for(const f of ['mealKHR','attKHR','mealUSD','attUSD','khr','usd','commonUSD'])s[f]=(s[f]||0)+r[f];return s;},{mealKHR:0,attKHR:0,mealUSD:0,attUSD:0,khr:0,usd:0,commonUSD:0});return {rows,totals,fx,mealCount:mm.size,attCount:am.size};
 }
 function advanceCheck(row){if(!row._excel)return {id:id(row),unknown:true};const m=row._excel,b=m.row,get=c=>num(m.overrides?.[c]??m.cells[c]?.v),basic=get('E'+b),days=get('J'+(b-1)),hour=get('U'+(b-1))+get('V'+(b-1)),reference=round(basic/26*days-basic/208*hour,1);return {id:id(row),basic,days,unpaidHours:hour,skill:get('G'+b),reference,actual:num(row.totalSalary),difference:num(row.totalSalary)-reference};}

 root.HRPayOnline={validMonth,validateBackup,normalizeAttendance,mergeAttendanceSource,mealReconciliation,advanceCheck,clone,plain,equal,id,esc,round,now,diff,changed,unique,importPlan,resolvePlan,sourceRows,capturePay,evaluate,recalcPay,draftPay,mealAmount,rosterPlan,parse,calc};
 if(typeof module==='object'&&module.exports)module.exports=root.HRPayOnline;
})(typeof window!=='undefined'?window:globalThis);
