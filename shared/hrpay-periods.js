/* AC-HRA-PAY v3.9.15: one calendar definition; UTC date-only arithmetic. */
(function(g){
  'use strict';
  const pad=n=>String(n).padStart(2,'0');
  function date(s){const m=String(s||'').match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);if(!m)return null;const d=new Date(Date.UTC(+m[1],+m[2]-1,+(m[3]||1)));return d.getUTCFullYear()===+m[1]&&d.getUTCMonth()===+m[2]-1&&d.getUTCDate()===+(m[3]||1)?d:null;}
  const iso=d=>d.toISOString().slice(0,10);
  function add(s,n){const d=date(s);if(!d)return '';d.setUTCDate(d.getUTCDate()+n);return iso(d);}
  function bounds(s,u){const d=date(s);if(!d)return null;const y=d.getUTCFullYear(),m=d.getUTCMonth();let a=new Date(+d),b;
    if(u==='week')a.setUTCDate(a.getUTCDate()-(a.getUTCDay()+6)%7);
    else if(u==='month')a=new Date(Date.UTC(y,m,1));
    else if(u==='quarter')a=new Date(Date.UTC(y,Math.floor(m/3)*3,1));
    else if(u==='half')a=new Date(Date.UTC(y,m, d.getUTCDate()<=15?1:16));
    else if(u==='year')a=new Date(Date.UTC(y,0,1));
    if(u==='year')b=new Date(Date.UTC(y+1,0,1));
    else if(u==='quarter')b=new Date(Date.UTC(y,Math.floor(m/3)*3+3,1));
    else if(u==='month'||(u==='half'&&a.getUTCDate()===16))b=new Date(Date.UTC(y,m+1,1));
    else {b=new Date(+a);b.setUTCDate(b.getUTCDate()+(u==='week'?7:u==='half'?15:1));}
    return {start:iso(a),end:iso(b)};
  }
  function key(s,u){const d=date(s),b=bounds(s,u);if(!d||!b)return '';if(u==='day')return b.start;if(u==='week'){const t=date(add(b.start,3)),y=t.getUTCFullYear();const first=bounds(y+'-01-04','week').start;return y+'-W'+pad(Math.round((date(b.start)-date(first))/604800000)+1);}if(u==='year')return b.start.slice(0,4);if(u==='quarter')return b.start.slice(0,4)+'-Q'+(Math.floor(d.getUTCMonth()/3)+1);if(u==='half')return b.start.slice(0,7)+':'+(d.getUTCDate()<=15?1:2);return b.start.slice(0,7);}
  function label(s,u){const b=bounds(s,u);return !b?'':u==='week'?key(s,u)+' · '+b.start+' – '+add(b.end,-1):key(s,u);}
  function contains(s,anchor,u){const b=bounds(anchor,u);return !!(date(s)&&b&&s.slice(0,10)>=b.start&&s.slice(0,10)<b.end);}
  function options(dates,u){const m=new Map();dates.filter(s=>date(s)).sort().forEach(s=>{const b=bounds(s,u),k=key(s,u);if(!m.has(k))m.set(k,{value:b.start,key:k,label:label(s,u)});});return [...m.values()];}
  function clipEvent(e,anchor,u){const b=bounds(anchor,u);if(!b||!date(e.start)||!(+e.days>0))return null;const total=+e.days,begin=date(e.start).getTime(),lo=Math.max(begin,date(b.start).getTime()),hi=Math.min(begin+total*86400000,date(b.end).getTime()),days=(hi-lo)/86400000;if(days<=0)return null;return Object.assign({},e,{sourceStart:e.sourceStart||e.start,sourceDays:e.sourceDays||total,sourceEnd:e.sourceEnd||e.end||'',end:iso(new Date(begin+Math.ceil((hi-begin)/86400000)*86400000-86400000)),start:iso(new Date(lo)),days,personDays:(+e.personDays||(+e.shutPPL||0)*total)*days/total});}
  g.HRPayPeriods={date,add,bounds,key,label,contains,options,clipEvent};
})(typeof window==='undefined'?globalThis:window);
