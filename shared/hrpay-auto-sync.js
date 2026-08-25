/* AC-HRA-PAY Auto Incremental Sync v1.0 — 2026-08-24
 * Local-first + background cloud reconcile, aligned with AC HRA Portal AutoSync.
 * - page opens from local data immediately; cloud check runs in background
 * - startup / network restore / app resume: pull changed cloud buckets, then push local pending changes
 * - local changes are debounced (~0.9s) so repeated edits do not trigger repeated uploads
 * - pending sync survives offline/reload through localStorage
 * - manual cloud buttons remain available as fallback
 */
(function(g){
  'use strict';
  if(g.HRPayAutoSync)return;
  var C={};
  function online(){try{return !('onLine' in navigator)||navigator.onLine;}catch(_){return true;}}
  function read(k){try{return JSON.parse(localStorage.getItem('hrpay:auto2:'+k)||'null');}catch(_){return null;}}
  function write(k,v){try{localStorage.setItem('hrpay:auto2:'+k,JSON.stringify(v));}catch(_){} }
  function clear(k){try{localStorage.removeItem('hrpay:auto2:'+k);}catch(_){} }
  function mergeExtra(a,b){var o={};Object.keys(a||{}).forEach(function(k){o[k]=a[k];});Object.keys(b||{}).forEach(function(k){if(b[k]!==undefined&&b[k]!==null&&b[k]!=='')o[k]=b[k];});return o;}
  function install(opts){
    opts=opts||{};var key=String(opts.key||'').trim();if(!key)throw new Error('HRPayAutoSync key required');
    if(C[key]){C[key].opts=opts;return C[key];}
    var s=C[key]={key:key,opts:opts,busy:false,timer:null,queued:null,lastRun:0};
    function canSync(){try{return typeof s.opts.canSync==='function'?!!s.opts.canSync():true;}catch(_){return false;}}
    async function run(reason,extra){
      reason=reason||'reconcile';extra=extra||{};
      if(s.busy){s.queued={reason:reason,extra:mergeExtra(s.queued&&s.queued.extra,extra)};return false;}
      if(!online()||!canSync()){write(key,{reason:reason,extra:extra,at:Date.now()});return false;}
      s.busy=true;s.lastRun=Date.now();
      try{
        if(typeof s.opts.pull==='function'){
          try{await s.opts.pull({silent:true,auto:true,reason:reason});}catch(e){if(s.opts.log!==false)console.warn('[HRPayAutoSync pull '+key+']',e);}
        }
        var ok=true;
        if(typeof s.opts.push==='function'){
          var po=mergeExtra({silent:true,auto:true,reason:reason},extra);
          var ctx={key:key,reason:String(reason||''),at:Date.now()};
          g.__HRPAY_SYNC_CONTEXT=ctx;
          try{var r=await s.opts.push(po);ok=(r!==false);}finally{if(g.__HRPAY_SYNC_CONTEXT===ctx)g.__HRPAY_SYNC_CONTEXT=null;}
        }
        if(ok)clear(key);else write(key,{reason:reason,extra:extra,at:Date.now()});
        return ok;
      }catch(e){
        write(key,{reason:reason,extra:extra,at:Date.now()});
        if(s.opts.log!==false)console.warn('[HRPayAutoSync '+key+']',e);
        return false;
      }finally{
        s.busy=false;
        if(s.queued){var q=s.queued;s.queued=null;schedule(q.reason,q.extra,250);}
      }
    }
    function schedule(reason,extra,delay){
      extra=extra||{};var old=read(key)||{};write(key,{reason:reason||'change',extra:mergeExtra(old.extra,extra),at:Date.now()});
      if(s.timer)clearTimeout(s.timer);
      s.timer=setTimeout(function(){s.timer=null;var p=read(key)||{};run(p.reason||reason||'change',mergeExtra(p.extra,extra));},delay==null?900:delay);
      return true;
    }
    s.run=run;s.schedule=schedule;
    var startup=function(){var p=read(key)||{};setTimeout(function(){run(p.reason||'startup-reconcile',p.extra||{});},Number(opts.startDelay)||450);};
    if(document.readyState==='complete'||document.readyState==='interactive')startup();
    else window.addEventListener('load',startup,{once:true});
    window.addEventListener('online',function(){var p=read(key)||{};setTimeout(function(){run(p.reason||'network-restored',p.extra||{});},150);});
    document.addEventListener('visibilitychange',function(){if(!document.hidden&&online()){var p=read(key)||{};setTimeout(function(){run(p.reason||'resume',p.extra||{});},180);}});
    window.addEventListener('pageshow',function(e){if(e&&e.persisted&&online()){var p=read(key)||{};setTimeout(function(){run(p.reason||'pageshow',p.extra||{});},180);}});
    return s;
  }
  function schedule(key,reason,extra,delay){var s=C[key];if(!s){write(key,{reason:reason||'change',extra:extra||{},at:Date.now()});return false;}return s.schedule(reason,extra,delay);}
  function run(key,reason,extra){var s=C[key];return s?s.run(reason,extra):Promise.resolve(false);}
  function pending(key){return read(key);}
  g.HRPayAutoSync={version:'1.1',install:install,schedule:schedule,markDirty:schedule,run:run,pending:pending};
})(window);
