/* AC-HRA-PAY v3.9.29b（2026-11-13，Paul）：員工人力概況「彩色總覽圖」——發摘要時先發這張圖，再發文字。
   圓餅圖（男女／聘用／本地外地）、長條圖（年齡／工齡／學歷）、樹狀圖（各組人數）、折線圖（每月人數）。
   只畫圖、不改資料。回傳 canvas；toDataURL 後由 GAS sendPhoto 發到群組。 */
(function(g){'use strict';
const PAL=['#3b82f6','#22c55e','#f59e0b','#f97316','#a855f7','#ef4444','#14b8a6','#94a3b8','#eab308','#6366f1','#84cc16','#06b6d4'];
const PINK='#ec4899',BLUE='#3b82f6',INK='#0f172a',MUTE='#64748b',CARD='#ffffff',BG='#f1f5f9';
const FONT='"Noto Sans TC","Noto Sans Khmer","Khmer OS","Microsoft JhengHei","PingFang TC",system-ui,sans-serif';
function build(opt){
  const R=g.HRPayReporting,rows=opt.rows||[],n=rows.length,lang=opt.lang||'both';
  const L=(z,e,k)=>lang==='zh'?z:lang==='en'?e:lang==='enkm'?(k?e+' '+k:e):(z===e?z:z+' '+e);
  const str=v=>String(v==null?'':v).trim(),end=opt.end||new Date().toISOString().slice(0,10);
  const yrs=d=>{d=str(d);if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||d>end)return null;return (Date.parse(end+'T00:00:00Z')-Date.parse(d+'T00:00:00Z'))/31557600000;};
  const count=(list,fn)=>{const m=new Map();list.forEach(r=>{const k=fn(r);m.set(k,(m.get(k)||0)+1);});return [...m.entries()].sort((a,b)=>b[1]-a[1]);};
  const UNK=L('未知','Unknown','មិនដឹង');
  const f=rows.filter(r=>r.gender==='F').length,m=rows.filter(r=>r.gender==='M').length;
  const ages=rows.map(r=>{const a=yrs(r.birth||r.dob);return a==null?(Number(r.age)>0?Number(r.age):null):a;}).filter(v=>v!=null&&v>=14&&v<100);
  const ten=rows.map(r=>yrs(r.join||r.joinDate)).filter(v=>v!=null);
  const EMP={'正式 Permanent':L('正式','Permanent','អចិន្ត្រៃយ៍'),'合約 Contract':L('合約','Contract','កិច្ចសន្យា'),'試用 Probation':L('試用','Probation','សាកល្បង'),'未知 Unknown':UNK};
  const VAL={'國中':['國中','Lower secondary','មធ្យមសិក្សាបឋមភូមិ'],'國中以下':['國中以下','Primary or below','បឋមសិក្សា'],'高中(職)':['高中(職)','Upper secondary','មធ្យមសិក្សាទុតិយភូមិ'],'大學':['大學','University','សាកលវិទ្យាល័យ'],'專科':['專科','College','បរិញ្ញាបត្ររង'],'大學以上':['大學以上','Postgraduate','ក្រោយបរិញ្ញាបត្រ']};
  const emp=count(rows,r=>EMP[R.employment(r)]||UNK);
  const org=count(rows,r=>!R.present(r.province)?UNK:/sihanouk|ព្រះសីហនុ|西哈努克/i.test(r.province)?L('本地','Local','ក្នុងខេត្ត'):L('外地','Out-area','ក្រៅខេត្ត'));
  const edu=count(rows,r=>{const e=str(r.education);return R.present(e)?(VAL[e]?L(VAL[e][0],VAL[e][1],VAL[e][2]):e):UNK;});
  const ageB=[['<25',ages.filter(x=>x<25).length],['25–34',ages.filter(x=>x>=25&&x<35).length],['35–44',ages.filter(x=>x>=35&&x<45).length],['45+',ages.filter(x=>x>=45).length]];
  const tenB=[['<1',ten.filter(x=>x<1).length],['1–2',ten.filter(x=>x>=1&&x<3).length],['3–4',ten.filter(x=>x>=3&&x<5).length],['5+',ten.filter(x=>x>=5).length]];
  const secs=count(rows,r=>R.present(r.section)?R.dept(r.section):R.dept(r.dept));
  const trend=(opt.trend||[]).filter(t=>t&&t.n>0).slice(-12);
  /* ── 畫布 ── */
  const W=1080,P=28,GAP=18,cw=(W-P*2-GAP*2)/3;
  const H=150+330+GAP+330+GAP+Math.max(250,60+edu.slice(0,7).length*44)+GAP+440+(trend.length>=3?GAP+300:0)+60;
  const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
  x.fillStyle=BG;x.fillRect(0,0,W,H);x.textBaseline='middle';
  const T=(s,px,py,size,color,weight,align)=>{x.font=(weight||'400')+' '+size+'px '+FONT;x.fillStyle=color||INK;x.textAlign=align||'left';x.fillText(String(s),px,py);};
  const fit=(s,max,size,weight)=>{x.font=(weight||'400')+' '+size+'px '+FONT;s=String(s);if(x.measureText(s).width<=max)return s;while(s.length>1&&x.measureText(s+'…').width>max)s=s.slice(0,-1);return s+'…';};
  const card=(px,py,w,h,title)=>{x.fillStyle=CARD;rr(px,py,w,h,18);x.fill();if(title)T(fit(title,w-36,22,'700'),px+18,py+30,22,INK,'700');};
  function rr(px,py,w,h,r){x.beginPath();x.moveTo(px+r,py);x.arcTo(px+w,py,px+w,py+h,r);x.arcTo(px+w,py+h,px,py+h,r);x.arcTo(px,py+h,px,py,r);x.arcTo(px,py,px+w,py,r);x.closePath();}
  const pc=v=>n?(100*v/n).toFixed(1)+'%':'—';
  /* 標題 */
  x.fillStyle='#1e293b';rr(P,P,W-P*2,104,22);x.fill();
  T('👥 '+L('員工人力概況','Workforce Summary','សង្ខេបកម្លាំងពលកម្ម'),P+26,P+36,34,'#fff','800');
  T(String(opt.label||'')+(opt.scope?' · '+opt.scope:''),P+26,P+78,22,'#cbd5e1','500');
  T(n,W-P-150,P+46,60,'#fff','800','right');T(L('人','staff','នាក់'),W-P-26,P+56,24,'#cbd5e1','600','right');
  /* 圓餅圖 */
  const donut=(px,py,w,h,title,pairs,colors)=>{card(px,py,w,h,title);const cx=px+w/2,cy=py+140,r=82,tot=pairs.reduce((a,p)=>a+p[1],0)||1;let a0=-Math.PI/2;
    pairs.forEach((p,i)=>{const a1=a0+p[1]/tot*Math.PI*2;x.beginPath();x.moveTo(cx,cy);x.arc(cx,cy,r,a0,a1);x.closePath();x.fillStyle=colors[i%colors.length];x.fill();a0=a1;});
    x.beginPath();x.arc(cx,cy,50,0,Math.PI*2);x.fillStyle=CARD;x.fill();T(pc(pairs[0]?pairs[0][1]:0),cx,cy-9,22,INK,'800','center');if(pairs[0])T(fit(String(pairs[0][0]).split(' ')[0],84,14,'600'),cx,cy+15,14,colors[0],'700','center');
    pairs.slice(0,3).forEach((p,i)=>{const ly=py+246+i*26;x.fillStyle=colors[i%colors.length];rr(px+18,ly-9,18,18,4);x.fill();T(fit(p[0],w-170,18),px+44,ly,18,INK,'500');T(p[1]+' · '+pc(p[1]),px+w-18,ly,18,MUTE,'600','right');});};
  let y=150;
  donut(P,y,cw,330,'🚻 '+L('性別','Gender','ភេទ'),[[L('女','Female','ស្រី'),f],[L('男','Male','ប្រុស'),m]].concat(n-f-m?[[UNK,n-f-m]]:[]),[PINK,BLUE,'#94a3b8']);
  donut(P+cw+GAP,y,cw,330,'📋 '+L('聘用','Employment','ប្រភេទការងារ'),emp,PAL);
  donut(P+(cw+GAP)*2,y,cw,330,'🏠 '+L('本地／外地','Origin','ស្រុកកំណើត'),org,['#f59e0b','#22c55e','#94a3b8']);
  /* 直條圖 */
  y+=330+GAP;const hw=(W-P*2-GAP)/2;
  const bars=(px,py,w,h,title,pairs,colors)=>{card(px,py,w,h,title);const max=Math.max(1,...pairs.map(p=>p[1])),bw=(w-60)/pairs.length,base=py+h-56,top=py+108;   /* 留空給最高那條的數字，不壓到標題 */
    pairs.forEach((p,i)=>{const bh=(base-top)*p[1]/max,bx=px+30+i*bw+bw*0.18;x.fillStyle=colors[i%colors.length];rr(bx,base-bh,bw*0.64,Math.max(bh,3),8);x.fill();
      T(p[1],bx+bw*0.32,base-bh-28,22,INK,'800','center');T(pc(p[1]),bx+bw*0.32,base-bh-8,15,MUTE,'500','center');T(p[0],bx+bw*0.32,base+24,20,INK,'600','center');});};
  bars(P,y,hw,330,'🎂 '+L('年齡','Age','អាយុ'),ageB,PAL);
  bars(P+hw+GAP,y,hw,330,'⏳ '+L('工齡（年）','Tenure (yrs)','អតីតភាព (ឆ្នាំ)'),tenB,['#22c55e','#14b8a6','#3b82f6','#6366f1']);
  /* 橫條圖：學歷 */
  y+=330+GAP;const eh=Math.max(250,60+edu.slice(0,7).length*44);card(P,y,W-P*2,eh,'🎓 '+L('學歷','Education','កម្រិតវប្បធម៌'));
  {const list=edu.slice(0,7),max=Math.max(1,...list.map(p=>p[1])),lx=P+18,lw=300,bx=lx+lw+12,bwMax=W-P*2-lw-240;
    list.forEach((p,i)=>{const ry=y+74+i*44;T(fit(p[0],lw,20,'600'),lx,ry,20,INK,'600');x.fillStyle='#e2e8f0';rr(bx,ry-13,bwMax,26,8);x.fill();x.fillStyle=PAL[i%PAL.length];rr(bx,ry-13,Math.max(8,bwMax*p[1]/max),26,8);x.fill();T(p[1],bx+bwMax+70,ry,22,INK,'800','right');T(pc(p[1]),W-P-18,ry,18,MUTE,'600','right');});}
  /* 樹狀圖：各組人數 */
  y+=eh+GAP;card(P,y,W-P*2,440,'🧵 '+L('各組人數','Headcount by section','ចំនួនតាមក្រុម')+'（'+L('面積＝人數','area = headcount','ទំហំ = ចំនួន')+'）');
  {const minN=Math.max(6,Math.ceil(n*0.015));let list=secs.filter(p=>p[1]>=minN).slice(0,22);const shown=new Set(list.map(p=>p[0])),restArr=secs.filter(p=>!shown.has(p[0])),rest=restArr.reduce((a,p)=>a+p[1],0);if(rest)list.push([L('其他','Other','ផ្សេងៗ')+' ×'+restArr.length,rest]);
    const ci=new Map(list.map((p,i)=>[p[0],i]));
    const lay=(items,px,py,w,h)=>{if(!items.length)return;if(items.length===1){const p=items[0],col=PAL[ci.get(p[0])%PAL.length];x.fillStyle=col;rr(px+2,py+2,Math.max(w-4,2),Math.max(h-4,2),8);x.fill();
        const fs=w>130&&h>70?19:w>80?15:13,nm=String(p[0]);x.font='700 '+fs+'px '+FONT;
        if(w>30&&h>30){
          let lines=[nm];if(x.measureText(nm).width>w-10&&nm.includes(' ')&&h>58){const i=nm.lastIndexOf(' ',Math.ceil(nm.length/2)+3);lines=[nm.slice(0,i>0?i:nm.length),nm.slice(i>0?i+1:nm.length)].filter(Boolean);}
          const lh=fs+3,blockH=lines.length*lh+(h>44?fs+6:0),y0=py+h/2-blockH/2+lh/2;
          lines.forEach((ln,k)=>T(fit(ln,w-8,fs,'700'),px+w/2,y0+k*lh,fs,'#fff','700','center'));
          if(h>44)T(p[1],px+w/2,y0+lines.length*lh+3,fs+3,'#fff','800','center');}
        return;}
      const tot=items.reduce((a,p)=>a+p[1],0);let acc=0,k=0;while(k<items.length-1&&acc+items[k][1]<=tot/2){acc+=items[k][1];k++;}if(k===0){acc=items[0][1];k=1;}
      const a=items.slice(0,k),b=items.slice(k),fr=acc/tot;if(w>=h){lay(a,px,py,w*fr,h);lay(b,px+w*fr,py,w*(1-fr),h);}else{lay(a,px,py,w,h*fr);lay(b,px,py+h*fr,w,h*(1-fr));}};
    lay(list,P+14,y+56,W-P*2-28,370);}
  /* 折線圖：每月人數 */
  if(trend.length>=3){y+=440+GAP;card(P,y,W-P*2,300,'📈 '+L('每月人數','Monthly headcount','ចំនួនប្រចាំខែ'));
    const lo=Math.min(...trend.map(t=>t.n)),hi=Math.max(...trend.map(t=>t.n)),pad=Math.max(5,(hi-lo)*0.25),a=lo-pad,b=hi+pad,gx=P+60,gw=W-P*2-110,gy=y+80,gh=150;
    const X=i=>gx+gw*i/(trend.length-1),Y=v=>gy+gh*(1-(v-a)/(b-a));
    x.strokeStyle='#e2e8f0';x.lineWidth=1;[0,0.5,1].forEach(t=>{x.beginPath();x.moveTo(gx,gy+gh*t);x.lineTo(gx+gw,gy+gh*t);x.stroke();});
    x.beginPath();trend.forEach((t,i)=>{i?x.lineTo(X(i),Y(t.n)):x.moveTo(X(i),Y(t.n));});x.strokeStyle=BLUE;x.lineWidth=4;x.lineJoin='round';x.stroke();
    trend.forEach((t,i)=>{x.beginPath();x.arc(X(i),Y(t.n),7,0,Math.PI*2);x.fillStyle=i===trend.length-1?'#ef4444':BLUE;x.fill();T(t.n,X(i),Y(t.n)-22,18,INK,'800','center');T(String(t.key).slice(2),X(i),gy+gh+30,16,MUTE,'500','center');});}
  T('AC-HRA-PAY · VRT · '+new Date().toISOString().slice(0,10),W-P,H-28,16,MUTE,'500','right');
  return c;
}
g.HRPayChartImage={build};
})(typeof window!=='undefined'?window:globalThis);
