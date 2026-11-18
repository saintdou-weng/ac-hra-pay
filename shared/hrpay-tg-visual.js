/* AC-HRA-PAY v3.9.32（2026-11-18）：Telegram 摘要／核可共用視覺元件
   學 HRA 出勤日報、GASCheck 清潔週報：色條、燈號、數字靠右（<code>）、累計、核對行，加一張彩色圖。
   只負責「顯示」：不讀寫資料、不碰核可／上傳／下載。 */
(function(g){'use strict';
const V={};
V.SEP='━━━━━━━━━━━━';
V.esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
V.num=v=>{const n=Number(String(v==null?'':v).replace(/[^0-9.\-]/g,''));return isFinite(n)?n:0;};
V.money=n=>(Math.round(V.num(n)*100)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
V.int=n=>Math.round(V.num(n)).toLocaleString('en-US');
V.row=(val,w,label)=>'<code>'+String(val).padStart(w,' ')+'</code> '+label;
/* 進度色條：ratio 0–1 */
V.bar=(ratio,n,full,empty)=>{n=n||10;const k=Math.max(0,Math.min(n,Math.round((ratio||0)*n)));return (full||'🟩').repeat(k)+(empty||'⬜').repeat(n-k);};
/* 比例色條：[{v,icon}] */
V.share=(parts,n)=>{n=n||10;const tot=parts.reduce((s,p)=>s+(p.v||0),0);if(!tot)return '⬜'.repeat(n);let out='',used=0;
  parts.forEach((p,i)=>{let k=i===parts.length-1?n-used:Math.round((p.v||0)/tot*n);if(p.v>0&&k<1&&used<n)k=1;k=Math.max(0,Math.min(n-used,k));used+=k;out+=p.icon.repeat(k);});return out;};
/* 與上期比：±5% 綠、5–15% 黃、>15% 紅（沿用 GA-EXP 費用規則） */
V.change=(cur,prev)=>{if(!(prev>0))return '';const p=(cur-prev)/prev*100;const l=Math.abs(p)<=5?'🟢':Math.abs(p)<=15?'🟡':'🔴';return l+' '+(p>=0?'+':'')+p.toFixed(1)+'%';};
/* 金額核對燈號：差額 ≤ ok 綠、≤ warn 黃、其餘紅 */
V.check=(diff,ok,warn)=>{const d=Math.abs(diff);return d<=ok?'🟢':d<=warn?'🟡':'🔴';};

/* ── 彩色圖：KPI 卡＋（左）圓環＋（右）橫條，回傳 PNG dataURL ── */
const FONT='"Noto Sans TC","Microsoft JhengHei","PingFang TC","Noto Sans Khmer",system-ui,sans-serif';
V.PAL=['#3b82f6','#f59e0b','#22c55e','#a855f7','#ef4444','#14b8a6','#f97316','#6366f1','#84cc16','#06b6d4','#eab308','#94a3b8'];
V.chart=function(opt){
  const W=1080,P=30,bars=(opt.bars&&opt.bars.items)||[],donut=(opt.donut&&opt.donut.items||[]).filter(x=>x.value>0),kpis=opt.kpis||[];
  const barH=40,listH=Math.max(bars.length*barH+70,donut.length?400:0);
  const H=130+(kpis.length?150:0)+listH+(opt.foot?60:30);
  const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
  x.fillStyle='#f1f5f9';x.fillRect(0,0,W,H);
  const hdr=x.createLinearGradient(0,0,W,0);hdr.addColorStop(0,opt.color||'#ea580c');hdr.addColorStop(1,opt.color2||'#f59e0b');
  x.fillStyle=hdr;x.fillRect(0,0,W,110);
  x.fillStyle='#fff';x.font='bold 40px '+FONT;x.fillText(opt.title||'',P,52);
  x.font='24px '+FONT;x.fillText(opt.subtitle||'',P,90);
  let y=130;
  if(kpis.length){const gap=16,cw=(W-P*2-gap*(kpis.length-1))/kpis.length;
    kpis.forEach((k,i)=>{const cx=P+i*(cw+gap);x.fillStyle='#fff';rr(x,cx,y,cw,126,16);x.fill();
      x.fillStyle=k.color||'#0f172a';x.fillRect(cx,y+14,6,98);
      x.fillStyle='#0f172a';let fs=40;x.font='bold '+fs+'px '+FONT;while(fs>22&&x.measureText(String(k.value)).width>cw-34){fs-=2;x.font='bold '+fs+'px '+FONT;}x.fillText(String(k.value),cx+22,y+60);
      x.fillStyle='#64748b';x.font='21px '+FONT;x.fillText(String(k.label),cx+22,y+100);});
    y+=150;}
  const leftW=donut.length?380:0;
  if(donut.length){x.fillStyle='#fff';rr(x,P,y,leftW-16,listH-10,16);x.fill();
    x.fillStyle='#0f172a';x.font='bold 24px '+FONT;x.fillText(opt.donut.title||'',P+18,y+38);
    const cx=P+(leftW-16)/2,cy=y+170,R=110,tot=donut.reduce((s,d)=>s+d.value,0);let a=-Math.PI/2;
    donut.forEach((d,i)=>{const b=a+d.value/tot*Math.PI*2;x.beginPath();x.moveTo(cx,cy);x.arc(cx,cy,R,a,b);x.closePath();x.fillStyle=d.color||V.PAL[i%12];x.fill();a=b;});
    x.beginPath();x.arc(cx,cy,R*0.55,0,Math.PI*2);x.fillStyle='#fff';x.fill();
    x.fillStyle='#0f172a';x.font='bold 30px '+FONT;x.textAlign='center';x.fillText(opt.donut.center||String(tot),cx,cy+10);x.textAlign='left';
    donut.forEach((d,i)=>{const ly=y+310+i*30;x.fillStyle=d.color||V.PAL[i%12];x.fillRect(P+18,ly-16,18,18);
      x.fillStyle='#0f172a';x.font='20px '+FONT;x.fillText(d.label+'  '+(d.text||d.value)+'（'+Math.round(d.value/tot*100)+'%）',P+46,ly);});}
  if(bars.length){const bx=P+leftW,bw=W-P-bx;x.fillStyle='#fff';rr(x,bx,y,bw,listH-10,16);x.fill();
    x.fillStyle='#0f172a';x.font='bold 24px '+FONT;x.fillText(opt.bars.title||'',bx+18,y+38);
    const mx=Math.max(...bars.map(b=>b.value),1),labW=200,valW=150,trackW=bw-36-labW-valW;
    bars.forEach((b,i)=>{const by=y+60+i*barH;x.fillStyle='#334155';x.font='19px '+FONT;x.fillText(clip(x,String(b.label),labW-8),bx+18,by+22);
      x.fillStyle='#e2e8f0';rr(x,bx+18+labW,by+6,trackW,22,11);x.fill();
      x.fillStyle=b.color||V.PAL[i%12];rr(x,bx+18+labW,by+6,Math.max(8,trackW*b.value/mx),22,11);x.fill();
      x.fillStyle='#0f172a';x.font='bold 19px '+FONT;x.fillText(String(b.text||b.value),bx+18+labW+trackW+10,by+23);});}
  if(opt.foot){x.fillStyle='#475569';x.font='20px '+FONT;x.fillText(opt.foot,P,H-24);}
  return c.toDataURL('image/png');
};
function rr(x,a,b,w,h,r){x.beginPath();x.moveTo(a+r,b);x.arcTo(a+w,b,a+w,b+h,r);x.arcTo(a+w,b+h,a,b+h,r);x.arcTo(a,b+h,a,b,r);x.arcTo(a,b,a+w,b,r);x.closePath();}
function clip(x,s,w){if(x.measureText(s).width<=w)return s;while(s.length>1&&x.measureText(s+'…').width>w)s=s.slice(0,-1);return s+'…';}
g.HRPayTGV=V;
})(typeof window!=='undefined'?window:globalThis);
