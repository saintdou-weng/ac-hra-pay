/* AC-HRA-PAY Smart Incremental Sync v1.0
 * Mirrors the AC HRA Portal v26 manifest/bucket sync model.
 * - compare a small cloud manifest first
 * - upload/download changed month/hash buckets only
 * - retain cloud-only history during push
 * - one-time safe migration from legacy full snapshots
 * - local pending changes are preserved and merged
 */
(function(g){
  'use strict';
  if(g.HRPaySmartSync)return;
  var VERSION='1.1', STATE_PREFIX='ac_hrpay_smart_sync_v1_', nativeFetch=g.fetch?g.fetch.bind(g):null;
  function now(){return new Date().toISOString();}
  function enc(v){return encodeURIComponent(String(v==null?'':v));}
  function text(v){return String(v==null?'':v);}
  function status(fn,msg,type){try{if(fn)fn(msg,type||'busy');}catch(_){} }
  function stable(v){
    if(v===null||v===undefined)return 'null';
    if(typeof v==='number'||typeof v==='boolean'||typeof v==='string')return JSON.stringify(v);
    if(Array.isArray(v))return '['+v.map(stable).join(',')+']';
    if(typeof v==='object')return '{'+Object.keys(v).sort().filter(function(k){
      return !/^_smart/.test(k)&&!/^(updatedAt|createdAt|savedAt|timestamp|cloudUpdatedAt|lastCloudUpdatedAt)$/.test(k);
    }).map(function(k){return JSON.stringify(k)+':'+stable(v[k]);}).join(',')+'}';
    return JSON.stringify(text(v));
  }
  function fnv(str){var h=2166136261>>>0;for(var i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return('00000000'+(h>>>0).toString(16)).slice(-8);}
  function hash(str){
    try{if(g.crypto&&g.crypto.subtle&&g.TextEncoder){return g.crypto.subtle.digest('SHA-256',new g.TextEncoder().encode(str)).then(function(b){return Array.prototype.map.call(new Uint8Array(b),function(x){return x.toString(16).padStart(2,'0');}).join('').slice(0,24);});}}catch(_){}
    return Promise.resolve(fnv(str)+'_'+str.length.toString(36));
  }
  function normDate(v){
    if(!v)return '';var s=text(v).trim(),m=s.match(/(20\d{2})[-\/.](\d{1,2})(?:[-\/.](\d{1,2}))?/);
    if(m)return m[1]+'-'+('0'+(+m[2])).slice(-2)+(m[3]?'-'+('0'+(+m[3])).slice(-2):'');
    m=s.match(/(\d{1,2})[-\/.](\d{1,2})[-\/.](20\d{2})/);return m?m[3]+'-'+('0'+(+m[1])).slice(-2)+'-'+('0'+(+m[2])).slice(-2):'';
  }
  var DATE_FIELDS=['_syncPeriod','period','periodKey','key','date','recordDate','reportDate','effectiveDate','effDate','start','startDate','endDate','incidentDate','joinDate','payMonth','month','snapshotDate'];
  function recordDate(r){for(var i=0;i<DATE_FIELDS.length;i++){var d=normDate(r&&r[DATE_FIELDS[i]]);if(d)return d;}return '';}
  function semanticKey(r){
    if(!r||typeof r!=='object')return stable(r);
    for(var i=0;i<['_syncId','_k','id','uuid','recordId','employeeId','empId'].length;i++){var k=['_syncId','_k','id','uuid','recordId','employeeId','empId'][i];if(r[k]!==undefined&&r[k]!==null&&r[k]!=='')return k+':'+text(r[k]);}
    var d=recordDate(r), parts=[];['type','kind','dept','department','section','name','reason'].forEach(function(k){if(r[k]!==undefined&&r[k]!==null&&r[k]!=='')parts.push(k+'='+text(r[k]));});
    if(d)parts.unshift('date='+d);return parts.length?parts.join('|'):stable(r);
  }
  function bucketKey(r){if(r&&r._syncBucket)return String(r._syncBucket);var d=recordDate(r);if(d)return 'm:'+d.slice(0,7);return 'h:'+('0'+(parseInt(fnv(semanticKey(r)),16)%32).toString(16)).slice(-2);}
  function stamp(x){for(var i=0;i<['updatedAt','savedAt','modifiedAt','createdAt','timestamp','date','effDate','effectiveDate'].length;i++){var v=x&&x[['updatedAt','savedAt','modifiedAt','createdAt','timestamp','date','effDate','effectiveDate'][i]];if(v){var n=new Date(v).getTime();if(!isNaN(n))return n;}}return 0;}
  function newer(a,b){var aa=stamp(a),bb=stamp(b);if(aa!==bb)return aa>bb?a:b;return stable(a).length>=stable(b).length?a:b;}
  function mergeRows(a,b){var map={},order=[];(a||[]).concat(b||[]).forEach(function(r){var k=semanticKey(r);if(!Object.prototype.hasOwnProperty.call(map,k))order.push(k);map[k]=map[k]?newer(map[k],r):r;});return order.map(function(k){return map[k];});}
  function sortRows(rows){return(rows||[]).slice().sort(function(a,b){var ka=semanticKey(a),kb=semanticKey(b);return ka<kb?-1:ka>kb?1:stable(a)<stable(b)?-1:1;});}
  function buildBuckets(records){var groups={};(records||[]).forEach(function(r){var k=bucketKey(r);(groups[k]||(groups[k]=[])).push(r);});var out={},jobs=Object.keys(groups).sort().map(function(k){var rows=sortRows(groups[k]);return hash(stable(rows)).then(function(h){out[k]={key:k,records:rows,count:rows.length,hash:h};});});return Promise.all(jobs).then(function(){return out;});}
  function readState(tool){try{return JSON.parse(localStorage.getItem(STATE_PREFIX+tool)||'null');}catch(_){return null;}}
  function writeState(tool,v){try{localStorage.setItem(STATE_PREFIX+tool,JSON.stringify(v));}catch(_){} }
  function jsonFetch(url,opts){if(!nativeFetch)return Promise.reject(new Error('Browser fetch unavailable'));return nativeFetch(url,opts||{}).then(function(r){return r.text().then(function(raw){var j;try{j=JSON.parse(raw);}catch(_){throw new Error('Cloud returned non-JSON: '+raw.slice(0,120));}if(!r.ok||(j&&j.ok===false))throw new Error((j&&j.error)||('HTTP '+r.status));return j;});});}
  function dataOf(j){return(j&&j.data!==undefined)?j.data:j;}
  function manifest(url,tool){return jsonFetch(url+(url.indexOf('?')>=0?'&':'?')+'action=smartManifest&tool='+enc(tool)).then(dataOf);}
  function post(url,body){return jsonFetch(url,{method:'POST',redirect:'follow',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body)}).then(dataOf);}
  function legacyPull(url,tool,opts,onStatus){return jsonFetch(url+'?action=pull&tool='+enc(tool)).then(function(j){var env=dataOf(j)||{},rows=[];if(typeof opts.legacyToRecords==='function')rows=opts.legacyToRecords(env)||[];else{var p=env.data||env;rows=p.records||p.recs||[];}return{records:Array.isArray(rows)?rows:[],meta:env.data||env||{}};});}
  function merge(opts,a,b){return typeof opts.mergeRecords==='function'?opts.mergeRecords(a,b):mergeRows(a,b);}
  function push(opts){
    opts=opts||{};var url=text(opts.url).trim(),tool=text(opts.tool).trim(),records=sortRows(opts.records||[]),onStatus=opts.onStatus;if(!url||!tool)return Promise.reject(new Error('GAS URL/tool missing'));
    status(onStatus,'智慧同步：比對雲端差異…','busy');
    return manifest(url,tool).then(function(remote){remote=remote||{};if(!remote.exists&&remote.legacy){status(onStatus,'首次升級：合併既有雲端資料…','busy');return legacyPull(url,tool,opts,onStatus).then(function(old){return smartPush(opts,merge(opts,records,old.records||[]),remote,onStatus,true);});}return smartPush(opts,records,remote,onStatus,false).then(function(r){if(!r||!r.needsPull||opts.autoMerge===false)return r;return pull({url:url,tool:tool,localRecords:records,legacyToRecords:opts.legacyToRecords,mergeRecords:opts.mergeRecords,onStatus:onStatus}).then(function(p){if(!p||!p.ok||p.cancelled)return p;return manifest(url,tool).then(function(fresh){var n=Object.assign({},opts,{records:p.records});return smartPush(n,p.records,fresh||{},onStatus,false);});});});});
  }
  function smartPush(opts,records,remote,onStatus,migrated){var tool=opts.tool,url=text(opts.url).trim();return Promise.all([buildBuckets(records),hash(stable(opts.meta||{}))]).then(function(parts){
    var local=parts[0],metaHash=parts[1],last=readState(tool)||{},lastH=last.hashes||{},remoteH=remote.hashes||{},remoteMetaHash=remote.metaHash||'',changed=[],remoteChanged=[],conflicts=[];if(migrated){lastH={};remoteH={};remoteMetaHash='';}
    var keys={};Object.keys(local).concat(Object.keys(remoteH)).forEach(function(k){keys[k]=1;});Object.keys(keys).forEach(function(k){var lh=local[k]&&local[k].hash||'',rh=remoteH[k]||'',bh=lastH[k]||'';if(lh&&rh&&lh===rh)return;if(!bh){if(lh&&!rh)changed.push(k);else if(!lh&&rh)remoteChanged.push(k);else if(lh&&rh&&lh!==rh)conflicts.push(k);return;}var lc=lh!==bh,rc=rh!==bh;if(lc&&!rc){if(lh)changed.push(k);}else if(!lc&&rc)remoteChanged.push(k);else if(lc&&rc&&lh!==rh)conflicts.push(k);});
    if(!migrated&&(remoteChanged.length||conflicts.length)){status(onStatus,'雲端有新變更，先自動下載合併','warn');return{ok:false,needsPull:true,remoteChanged:remoteChanged,conflicts:conflicts,recordCount:records.length};}
    var uploadId='pay_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8),sent=0,chain=Promise.resolve();changed.forEach(function(k,idx){chain=chain.then(function(){var b=local[k];status(onStatus,'上傳變更 '+(idx+1)+'/'+changed.length+' · '+k,'busy');return post(url,{action:'smartBucket',tool:tool,uploadId:uploadId,bucket:k,hash:b.hash,count:b.count,records:b.records}).then(function(){sent+=b.count;});});});
    return chain.then(function(){var hashes={},counts={};Object.keys(local).forEach(function(k){hashes[k]=local[k].hash;counts[k]=local[k].count;});Object.keys(remoteH).forEach(function(k){if(!hashes[k]){hashes[k]=remoteH[k];counts[k]=Number((remote.counts||{})[k])||0;}});var rc=Object.keys(counts).reduce(function(n,k){return n+(Number(counts[k])||0);},0),meta=Object.assign({},opts.meta||{},{_smartMetaHash:metaHash});var metaChanged=metaHash!==remoteMetaHash||migrated||changed.length;if(!metaChanged&&!changed.length){writeState(tool,{hashes:remoteH,counts:remote.counts||{},metaHash:remoteMetaHash,updatedAt:now()});status(onStatus,'雲端已是最新，不需重傳','ok');return{ok:true,skipped:true,unchanged:records.length};}
      return post(url,{action:'smartCommit',tool:tool,uploadId:uploadId,hashes:hashes,counts:counts,recordCount:rc,meta:meta,summary:opts.summary||{},context:opts.context||g.__HRPAY_SYNC_CONTEXT||{}}).then(function(d){var out={ok:true,recordCount:rc,uploaded:sent,unchanged:Math.max(0,records.length-sent),changedBuckets:changed.length,migrated:!!migrated,timestamp:(d&&(d.timestamp||d.updatedAt))||now()};writeState(tool,{hashes:hashes,counts:counts,metaHash:metaHash,updatedAt:out.timestamp});status(onStatus,'完成｜上傳 '+sent+'｜保留雲端歷史','ok');return out;});});
  });}
  function pull(opts){opts=opts||{};var url=text(opts.url).trim(),tool=text(opts.tool).trim(),localRows=sortRows(opts.localRecords||[]),onStatus=opts.onStatus;if(!url||!tool)return Promise.reject(new Error('GAS URL/tool missing'));status(onStatus,'智慧下載：比對雲端差異…','busy');return manifest(url,tool).then(function(remote){remote=remote||{};if(!remote.exists&&remote.legacy){return legacyPull(url,tool,opts,onStatus).then(function(old){var merged=merge(opts,localRows,old.records||[]);return Promise.resolve(opts.apply?opts.apply(merged,old.meta||{}):null).then(function(){var o=Object.assign({},opts,{records:merged});return smartPush(o,merged,remote,onStatus,true).then(function(m){return{ok:true,records:merged,downloaded:(old.records||[]).length,migrated:true,pushResult:m};});});});}if(!remote.exists){status(onStatus,'雲端尚無資料','warn');return{ok:false,noCloud:true,records:localRows};}
      return buildBuckets(localRows).then(function(local){var last=readState(tool)||{},lastH=last.hashes||{},remoteH=remote.hashes||{},out={},downloaded=0,unchanged=0,pending=0,keys={};Object.keys(remoteH).concat(Object.keys(local)).forEach(function(k){keys[k]=1;});var list=Object.keys(keys).sort(),chain=Promise.resolve();list.forEach(function(k,idx){chain=chain.then(function(){var lb=local[k],rh=remoteH[k]||'';if(lb&&rh&&lb.hash===rh){out[k]=lb.records;unchanged+=lb.count;return;}if(lb&&!rh){out[k]=lb.records;pending+=lb.count;return;}if(!rh)return;status(onStatus,'下載變更 '+(idx+1)+'/'+list.length+' · '+k,'busy');return jsonFetch(url+'?action=smartBucket&tool='+enc(tool)+'&bucket='+enc(k)).then(function(j){var bd=dataOf(j)||{},rows=bd.records||[];downloaded+=rows.length;out[k]=(lb&&lb.hash!==rh)?merge(opts,lb.records,rows):rows;});});});return chain.then(function(){var merged=sortRows(Object.keys(out).reduce(function(a,k){return a.concat(out[k]||[]);},[]));return Promise.resolve(opts.apply?opts.apply(merged,remote.meta||{}):null).then(function(){writeState(tool,{hashes:remoteH,counts:remote.counts||{},metaHash:remote.metaHash||'',updatedAt:now()});status(onStatus,'完成｜下載 '+downloaded+'｜未變 '+unchanged+(pending?'｜本機待上傳 '+pending:''),'ok');return{ok:true,records:merged,downloaded:downloaded,unchanged:unchanged,pendingUpload:pending,meta:remote.meta||{}};});});});
    });}
  g.HRPaySmartSync={version:VERSION,push:push,pull:pull,buildBuckets:buildBuckets,mergeRows:mergeRows,semanticKey:semanticKey,bucketKey:bucketKey,stable:stable};
})(window);
