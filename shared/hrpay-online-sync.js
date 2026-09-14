/* Persist formula provenance, deletion notices and period metadata via existing buckets. */
(function(){
 'use strict';
 const H=window.HRPayOnline,mod=document.currentScript.dataset.module;
 const entries=()=>mod==='employee'?SNAPS:STORE;
 function meta(e){const m=H.clone(e);delete m.advanceRecords;delete m.payrollRecords;delete m.mergedRecords;delete m.rows;for(const k of ['updatedAt','createdAt','savedAt','advanceDate','payrollDate'])delete m[k];if(m.meal)delete m.meal.rows;if(m.att)delete m.att.rows;return m;}
 function canonical(v){if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));return v;}
 function append(out,e){const key=e.periodKey||e.key,period=String(key).slice(0,7),text=JSON.stringify(canonical(meta(e)));for(let i=0;i<text.length;i+=24000)out.push({_syncId:'online-meta:'+mod+':'+key+':'+i/24000,_syncPeriod:period,_syncBucket:'m:'+period+':online:'+key,kind:'onlineMeta',key,part:i/24000,count:Math.ceil(text.length/24000),text:text.slice(i,i+24000)});return out;}
 function decode(rows){const g={};for(const r of rows||[])if(r.kind==='onlineMeta'){const x=g[r.key]||(g[r.key]={count:r.count,parts:{}});x.parts[r.part]=r.text;}const out={};for(const [k,g0]of Object.entries(g)){if(Object.keys(g0.parts).length!==g0.count)throw Error('雲端線上記錄不完整 / Incomplete online metadata: '+k);out[k]=JSON.parse(Array.from({length:g0.count},(_,i)=>g0.parts[i]).join(''));}return out;}
 function wrappedRecords(fn){return function(){const out=fn.apply(this,arguments);for(const r of out)if(r.kind==='meta'&&r.data){r.data=H.clone(r.data);delete r.data._onlineDeleted;delete r.data._draftFrom;}for(const e of Object.values(entries()))append(out,e);return out;};}
 function preserve(e,local){if(!local)return e;for(const k of ['_onlineDeleted','_draftFrom'])if(e[k]===undefined&&local[k]!==undefined)e[k]=H.clone(local[k]);return e;}
 function applyWrapper(fn){return async function(rows){const extra=decode(rows),prior=H.clone(entries());await fn.call(this,rows.filter(r=>r.kind!=='onlineMeta'));for(const [k,e]of Object.entries(entries())){if(extra[k]){const data=extra[k];if(mod==='meal'){const mr=e.meal?.rows,ar=e.att?.rows;Object.assign(e,data);if(mr)e.meal={...e.meal,rows:mr};if(ar)e.att={...e.att,rows:ar};}else Object.assign(e,data);}else preserve(e,prior[k]);await idbSave(e);}if(mod==='payroll'){buildPeriodSelect();renderAll();}else renderAll();};}
 if(mod==='payroll'){payrollCloudRecords=wrappedRecords(payrollCloudRecords);payrollApplyCloud=applyWrapper(payrollApplyCloud);}
 else if(mod==='meal'){
   const original=mealBatchToSync;mealBatchToSync=function(e){const out=original(e);for(const x of out)if(x.kind==='meta'){x.data=H.clone(x.data);delete x.data._onlineDeleted;delete x.data._draftFrom;}return append(out,e);};mealApplyCloud=applyWrapper(mealApplyCloud);
 }else{
   const original=employeeSnapToSync;employeeSnapToSync=function(e){const out=original(e);for(const x of out)if(x.kind==='meta'){x.data=H.clone(x.data);delete x.data._onlineDeleted;delete x.data._draftFrom;}return append(out,e);};employeeApplyCloud=applyWrapper(employeeApplyCloud);
 }
 // Restore validates the complete file before any write and reviews each changed person.
 const restoreName=mod==='payroll'?'importJSON':mod==='meal'?'importMealJSON':'importEmployeeJSON';
 window[restoreName]=async function(input){const file=input.files?.[0];if(!file)return;input.value='';try{
   const data=H.validateBackup(JSON.parse(await file.text()),mod),keys=Object.keys(data),start=H.clone(entries());
   const count=e=>mod==='payroll'?(e.advanceRecords?.length||0)+(e.payrollRecords?.length||0):mod==='meal'?(e.meal?.rows?.length||0)+(e.att?.rows?.length||0):e.rows?.length||0;
   const result=await HRPayOnlineUI.review('備份還原確認 / Restore backup / ស្តារទិន្នន័យ',`<p>${H.esc(file.name)}</p><p>已有期間預設保留。選「核對匯入」後逐人查看差異；未列入備份的類型及其他月份保留。<br>Review each changed employee before restoring. / ពិនិត្យមុនស្តារទិន្នន័យ។</p><table><tr><th>期間 / Period</th><th>現有 / Current</th><th>備份 / Backup</th><th>處理 / Action</th></tr>${keys.map(k=>`<tr><td>${H.esc(k)}</td><td>${count(entries()[k]||{})}</td><td>${count(data[k])}</td><td><select data-choice="${H.esc(k)}">${entries()[k]?'<option value="keep">保留現況 / Keep current</option>':''}<option value="excel">核對匯入 / Review import / ពិនិត្យនាំចូល</option></select></td></tr>`).join('')}</table>`);if(!result)return;
   const prepared=[];
   for(const k of keys)if(result.choices[k]==='excel'){
     const current=start[k],inc=data[k],e=H.clone(current||inc),parts=mod==='payroll'?['advance','payroll']:mod==='meal'?['meal','att']:['rows'];
     for(const part of parts){const incoming=mod==='payroll'?inc[part+'Records']:mod==='meal'?inc[part]?.rows:inc.rows;if(!incoming)continue;
       const rows=await H.acceptImport(HRPayOnlineUI.getRows(current,part),incoming,file.name,e,part,'backup');if(!rows)return;
       if(mod==='meal'){const old=e[part];e[part]={...H.clone(inc[part]),rows};if(current&&part==='att'){delete e[part].usdSegments;e[part].dayList=[...new Set(rows.flatMap(r=>(r.days||[]).map(d=>+d.d)))].sort((a,b)=>a-b);e[part].sources=[...new Set([...(old?.sources||[]),...(inc[part].sources||[])])];}}
       else HRPayOnlineUI.setRows(e,rows,part);
     }
     if(mod==='payroll'){e.periodKey=k;e.label=labelFromKey(k);}else{e.key=k;if(mod==='meal'){e.year=+k.slice(0,4);e.month=+k.slice(5,7);e.batch=+k.slice(-1);}}
     e._restoreLog=[...(e._restoreLog||[]),{at:H.now(),file:file.name,reason:'Reviewed JSON import / 確認備份匯入'}];prepared.push(e);
   }
   for(const e of prepared){const k=e.periodKey||e.key;if(!H.equal(entries()[k],start[k]))throw Error('核對期間資料已更新，請重新還原 / Data changed during review: '+k);}
   for(const e of prepared)await HRPayOnlineUI.save(e,'restore');HRPayOnlineUI.open();
 }catch(e){toast('還原失敗 / Restore failed: '+e.message,'error');}};

 window.HRPayOnlineSync={decode,meta};
})();
