/* ================= מעקב ביצוע במפה (20-work-map.js): מה בוצע ומה לא, לפי שדה ושורה, מדיווחי ביצוע עם מיקום =================
   אותו רעיון כמו «האתר לפי שלבים» ביומן חשמל (הצד של קבלן החשמל), כאן בצד של מנהל הפרויקט: שלושת שלבי השולחן
   (קונסטרוקציה, פאנלים, אישור מפקח) נצבעים על שורות השדה רק מדיווחי ביצוע שנרשם להם מיקום (שדה + שורות).
   דיווח בלי מיקום נספר בכמויות (כמו עד היום) אבל לא במפה, ומופיע ברשימת «בלי מיקום» עם כפתור למקם אותו.
   מבנה האתר (settings/layout): מהמפה של האתר (site-maps.js) כשיש, מתוכנית שנקראה בעזרת AI, או ממספרים בהגדרות.
   «תוכניות»: קבצי התוכניות של האתר (PDF / תמונה) במופע, לפתיחה בלחיצה; תמונת תוכנית יכולה גם להזין את מבנה האתר. */
import { $, actorName, ask, closer, esc, fmtD, fmtDT, logAct, ls, popup, shared, toast } from "./core.js";
import { fmtN } from "./01-stock.js";
import { STAGES, openProgress, stageOf } from "./04-contractors.js";
import { saveFile } from "./08-settings.js";
import { isoOf, isoText } from "./11-daylog.js";
import { foldSum } from "./12-ui-cleanup.js";
import { ROLE } from "./18-identity.js";
import { siteMap } from "./19-site-build.js";

const COL={con:"#FFAA00",pan:"#3199CC",ok:"#9AC339"}, ORDER=["con","pan","ok"];
const PLAN_W=620;
export const PLAN_PROMPT='בתמונה תוכנית של אתר סולארי (מבט מלמעלה): שדות של שולחנות פאנלים בשורות. בנה ממנה מבנה סכמתי למעקב ביצוע. קואורדינטות x ו-y מ-0 עד 1000 על פני התמונה (0,0 בפינה השמאלית העליונה). החזר רק JSON, בלי הסברים: {"fence":[x,y,w,h] או null,"fields":[{"name":"<שם השדה / הבלוק כפי שמופיע, אחרת מערב/מזרח או A, B…>","x":0,"y":0,"w":0,"h":0,"rows":<מספר שורות השולחנות בשדה>,"tables":<שולחנות בשורה טיפוסית>}]}. שדה = גוש שורות רציף; דרך רחבה בין גושים מפרידה שדות.';

/* ---------- מבנה האתר ---------- */
const num=v=>Number.isFinite(Number(v))?Number(v):NaN;
const validId=v=>{ v=v==null?"":String(v).trim(); return /^[A-Za-z0-9_\-.:~֐-׿]{1,40}$/.test(v)?v:""; };
// שורות שוות בתוך מלבן: שורה 1 למטה (כמו בשטח), שולחנות לשורה קבוע
function evenRows(f,n,tables){ const out=[]; const h=f.h/n; for(let i=0;i<n;i++){ const y=f.y+f.h-(i+1)*h; out.push({n:i+1,x:f.x,y:y+h*.2,w:f.w,h:h*.6,tables}); } return out; }
// מתוכנית (JSON מה-AI או מהטקסט): שדות עם מספר שורות ושולחנות לשורה, בקואורדינטות 0..1000 → רוחב ציור קבוע
export function normLayout(raw){
  if(!raw||typeof raw!=="object") return null;
  const box=o=>{ const x=num(o.x),y=num(o.y),w=num(o.w),h=num(o.h); return [x,y,w,h].every(Number.isFinite)&&w>0&&h>0?{x,y,w,h}:null; };
  const fields=(Array.isArray(raw.fields)?raw.fields:[]).map((f,i)=>{ const b=box(f||{}); if(!b) return null;
    return {...b,id:validId(f.id)||"f"+(i+1),name:String(f.name||"שדה "+String.fromCharCode(65+i)).slice(0,30),rows:Math.max(1,Math.min(80,Math.round(num(f.rows)||Math.max(2,b.h/20)))),tables:Math.max(1,Math.min(60,Math.round(num(f.tables)||1)))}; }).filter(Boolean).slice(0,40);
  if(!fields.length) return null;
  const used=new Set(); fields.forEach(f=>{ let id=f.id,n=1; while(used.has(id)) id=f.id+"~"+(++n); f.id=id; used.add(id); });
  let fx,fy,fw,fh; const fb=Array.isArray(raw.fence)&&raw.fence.length===4&&raw.fence.map(num);
  if(fb&&fb.every(Number.isFinite)&&fb[2]>0&&fb[3]>0) [fx,fy,fw,fh]=fb;
  else { const xs=fields.flatMap(f=>[f.x,f.x+f.w]), ys=fields.flatMap(f=>[f.y,f.y+f.h]); fx=Math.min(...xs); fy=Math.min(...ys); fw=Math.max(...xs)-fx||1; fh=Math.max(...ys)-fy||1; }
  const M=16, k=(PLAN_W-2*M)/fw, X=x=>M+(x-fx)*k, Y=y=>M+(y-fy)*k;
  const F=fields.map(f=>{ const g={id:f.id,name:f.name,x:X(f.x),y:Y(f.y),w:f.w*k,h:f.h*k}; g.rows=evenRows(g,f.rows,f.tables); return g; });
  return {w:PLAN_W,h:Math.round(fh*k+2*M),fields:F,src:"plan"};
}
// ממספרים: שדות × שורות × שולחנות בשורה, בשתי עמודות
export function genLayout(g){
  const fields=Math.max(1,Math.min(12,Math.round(num(g&&g.fields)||1))), rows=Math.max(1,Math.min(80,Math.round(num(g&&g.rows)||10))), tables=Math.max(1,Math.min(60,Math.round(num(g&&g.tables)||10)));
  const names=String(g&&g.names||"").split(/[,،\n]/).map(s=>s.trim()).filter(Boolean);
  const M=16, cols=fields>1?2:1, gut=24, fw=(PLAN_W-2*M-(cols-1)*gut)/cols, fh=rows*14+8;
  const F=[]; for(let i=0;i<fields;i++){ const c=i%cols,r=Math.floor(i/cols); const f={id:"f"+(i+1),name:names[i]||"שדה "+String.fromCharCode(65+i),x:M+c*(fw+gut),y:M+r*(fh+gut),w:fw,h:fh}; f.rows=evenRows(f,rows,tables); F.push(f); }
  const rowsN=Math.ceil(fields/cols);
  return {w:PLAN_W,h:Math.round(M*2+rowsN*fh+(rowsN-1)*gut),fields:F,src:"gen"};
}
// ממפת השולחנות של האתר (site-maps.js): השורות האמיתיות, ממוספרות מלמטה לכל האתר (שורה 1 בתחתית, כמו בשטח),
// ושני חצאים (מערב / מזרח) כשיש דרך באמצע שחוצה את רוב השורות. שולחנות בשורה = הספירה במפה.
export function layoutFromTables(map){
  const T=map&&Array.isArray(map.tables)?map.tables.filter(t=>Array.isArray(t)&&t.length>=4):[]; if(T.length<4) return null;
  const rowsY=[...new Set(T.map(t=>t[1]))].sort((a,b)=>b-a);   // מלמטה למעלה
  const gapAt={}; let withGap=0;
  rowsY.forEach(y=>{ const r=T.filter(t=>t[1]===y).sort((a,b)=>a[0]-b[0]); let g=0,c=null; for(let i=1;i<r.length;i++){ const d=r[i][0]-(r[i-1][0]+r[i-1][2]); if(d>g){ g=d; c=r[i-1][0]+r[i-1][2]+d/2; } } if(g>6){ gapAt[y]=c; withGap++; } });
  const split=withGap>=rowsY.length*.6;
  const gapOf=y=>{ if(gapAt[y]!=null) return gapAt[y]; let best=null,bd=Infinity; for(const k in gapAt){ const d=Math.abs(k-y); if(d<bd){ bd=d; best=gapAt[k]; } } return best; };
  const west=t=>!split||t[0]+t[2]/2<gapOf(t[1]);
  // מספר השורה הוא של כל האתר (שורה פיזית אחת חוצה את שני החצאים): שורה 1 = הנמוכה ביותר במפה
  const rowNo=new Map(rowsY.map((y,i)=>[y,i+1]));
  const mk=(id,name,sel)=>{ const S=T.filter(sel); if(!S.length) return null;
    const ys=[...new Set(S.map(t=>t[1]))].sort((a,b)=>b-a);
    const rows=ys.map(y=>{ const r=S.filter(t=>t[1]===y); const x0=Math.min(...r.map(t=>t[0])),x1=Math.max(...r.map(t=>t[0]+t[2])),h=Math.max(...r.map(t=>t[3])); return {n:rowNo.get(y),x:x0,y,w:x1-x0,h,tables:r.length}; });
    const x=Math.min(...rows.map(r=>r.x)),x1=Math.max(...rows.map(r=>r.x+r.w)),y=Math.min(...rows.map(r=>r.y)),y1=Math.max(...rows.map(r=>r.y+r.h));
    return {id,name,x,y,w:x1-x,h:y1-y,rows}; };
  const F=split?[mk("west","מערב",west),mk("east","מזרח",t=>!west(t))].filter(Boolean):[mk("field","השדה",()=>true)];
  return {w:map.w||Math.max(...T.map(t=>t[0]+t[2]))+20,h:map.h||Math.max(...T.map(t=>t[1]+t[3]))+20,fields:F,src:"map"};
}
export function layoutDoc(){ return shared.LAYOUT||null; }
// המבנה בתוקף: מסמך שמור (מתוכנית / מספרים), אחרת המפה המובנית של האתר, אחרת אין
export function currentLayout(){
  const d=layoutDoc();
  if(d&&d.layout){ const L=normLayout(d.layout); if(L){ L.planId=d.planId||""; return L; } }
  if(d&&d.gen) return genLayout(d.gen);
  return layoutFromTables(siteMap());
}
export const layoutSummary=L=>L?L.fields.length+" שדות · "+L.fields.reduce((a,f)=>a+f.rows.length,0)+" שורות · "+fmtN(L.fields.reduce((a,f)=>a+f.rows.reduce((s,r)=>s+r.tables,0),0))+" שולחנות":"";
export const layoutSrcText=L=>!L?"אין עדיין מבנה אתר":L.src==="map"?"לפי מפת השולחנות של האתר":L.src==="plan"?"לפי תוכנית שנקראה":"לפי המספרים בהגדרות";
export async function saveLayout(doc){
  doc={...doc,ts:Date.now(),by:actorName()};
  if(shared.DB) await shared.DB.doc("settings/layout").set(doc); else { shared.LAYOUT=doc; ls.set("layout",JSON.stringify(doc)); renderWorkMap(); }
}

/* ---------- דיווחים → שורות ---------- */
export const rowsOf=p=>Array.isArray(p&&p.rows)&&p.rows.length===2&&p.rows.every(n=>Number.isFinite(Number(n)))?[Math.min(...p.rows.map(Number)),Math.max(...p.rows.map(Number))]:null;
export const locText=p=>p&&p.areaId?(p.area||p.areaId)+(rowsOf(p)?" · שורות "+rowsOf(p)[0]+(rowsOf(p)[1]!==rowsOf(p)[0]?"–"+rowsOf(p)[1]:""):""):"";
// לכל שדה ושורה: כמה שולחנות דווחו בכל שלב, במילוי מלמטה (שורה 1) למעלה, או בתוך טווח השורות שנרשם
export function placeReports(L,prog,untilTs){
  const F={}; const unplaced=[]; let placed=0;
  if(!L) return {F,unplaced:prog.slice(),placed:0};
  L.fields.forEach(f=>{ F[f.id]={}; f.rows.forEach(r=>{ F[f.id][r.n]={con:0,pan:0,ok:0,last:{}}; }); });
  prog.slice().sort((a,b)=>a.ts-b.ts).forEach(p=>{
    if(untilTs&&p.ts>untilTs) return;
    const f=p.areaId&&L.fields.find(x=>x.id===p.areaId); if(!f){ unplaced.push(p); return; }
    const k=stageOf(p), rr=rowsOf(p), rows=f.rows.filter(r=>!rr||(r.n>=rr[0]&&r.n<=rr[1])); if(!rows.length){ unplaced.push(p); return; }
    let left=Number(p.tables)||0; placed++;
    for(const r of rows){ const cell=F[f.id][r.n]; const room=Math.max(0,r.tables-cell[k]); const g=Math.min(room,left); if(g>0){ cell[k]+=g; cell.last[k]=p.ts; left-=g; } if(left<=0) break; }
    if(left>0&&rows.length){ const cell=F[f.id][rows[rows.length-1].n]; cell[k]+=left; cell.last[k]=p.ts; }   // יותר ממה שיש בשורות: נשאר על השורה האחרונה (יוצג כחריגה)
  });
  return {F,unplaced,placed};
}
// רשימת «לא בוצע»: רצפי שורות לפי מצב, לכל שדה
export function pendingRuns(L,F){
  const out=[]; if(!L) return out;
  const runs=(f,test)=>{ const r=[]; let s=null,prev=null; f.rows.forEach(row=>{ const ok=test(F[f.id][row.n],row); if(ok){ if(s===null) s=row.n; prev=row.n; } else if(s!==null){ r.push([s,prev]); s=null; } }); if(s!==null) r.push([s,prev]); return r; };
  const fmt=rs=>rs.map(([a,b])=>a===b?String(a):a+"–"+b).join(", ");
  const nT=(f,rs)=>f.rows.filter(r=>rs.some(([a,b])=>r.n>=a&&r.n<=b)).reduce((s,r)=>s+r.tables,0);
  L.fields.forEach(f=>{
    const none=runs(f,c=>c.con<=0&&c.pan<=0&&c.ok<=0), noPan=runs(f,(c,r)=>c.con>=r.tables&&c.pan<r.tables), noOk=runs(f,(c,r)=>c.pan>=r.tables&&c.ok<r.tables);
    if(none.length) out.push({f,k:"none",rows:none,text:"שורות "+fmt(none)+": עוד לא התחילו",tables:nT(f,none)});
    if(noPan.length) out.push({f,k:"pan",rows:noPan,text:"שורות "+fmt(noPan)+": קונסטרוקציה גמורה, מחכות לפאנלים",tables:nT(f,noPan)});
    if(noOk.length) out.push({f,k:"ok",rows:noOk,text:"שורות "+fmt(noOk)+": פאנלים עליהן, מחכות לאישור מפקח",tables:nT(f,noOk)});
  });
  return out;
}

/* ---------- ציור ---------- */
let focus=null, sel=null, built=false;
function geom(cv,L,f){
  // כל המפה, או שדה אחד מוגדל: שורות ברוחב מלא
  const W=cv.clientWidth||360; if(f){ const rowH=Math.min(22,Math.max(12,Math.floor(300/f.rows.length))); const h=f.rows.length*rowH+40; return {W,H:h,rowH,zoom:true,f,rows:f.rows.map((r,i)=>({r,x:44,y:30+(f.rows.length-1-i)*rowH,w:W-60,h:rowH*.62}))}; }
  const s=W/L.w; return {W,H:Math.round(L.h*s)+8,s,zoom:false};
}
function paint(cv,L,F,opts){
  const dpr=Math.min(2.5,window.devicePixelRatio||1); const g=geom(cv,L,focus&&L.fields.find(x=>x.id===focus)); const ctx=cv.getContext("2d");
  cv.width=Math.round(g.W*dpr); cv.height=Math.round(g.H*dpr); cv.style.height=g.H+"px"; ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle="#fff"; ctx.fillRect(0,0,g.W,g.H); ctx.font="700 11px Alef, Heebo, Arial"; ctx.textBaseline="middle";
  const bar=(x,y,w,h,cell,tables,n,big)=>{
    ctx.fillStyle="#ECEDED"; ctx.fillRect(x,y,w,h);
    ORDER.forEach(k=>{ const fr=Math.min(1,cell[k]/tables); if(fr>0){ ctx.fillStyle=COL[k]; ctx.fillRect(x,y,w*fr,h); } });
    if(cell.con>tables||cell.pan>tables||cell.ok>tables){ ctx.strokeStyle="#B30027"; ctx.lineWidth=1.5; ctx.strokeRect(x-.5,y-.5,w+1,h+1); }
    const recent=Object.values(cell.last).some(t=>t>Date.now()-7*864e5);
    if(recent){ ctx.strokeStyle="#E40033"; ctx.lineWidth=1.5; ctx.strokeRect(x-1,y-1,w+2,h+2); }
    if(sel&&sel.n===n&&sel.f===(big?g.f.id:sel.f)){ ctx.strokeStyle="#121212"; ctx.lineWidth=2; ctx.strokeRect(x-2,y-2,w+4,h+4); }
  };
  if(g.zoom){ const f=g.f; ctx.fillStyle="#3F4447"; ctx.textAlign="right"; ctx.fillText(f.name+" · "+f.rows.length+" שורות",g.W-8,14);
    g.rows.forEach(({r,x,y,w,h})=>{ const cell=F[f.id][r.n]; bar(x,y,w,h,cell,r.tables,r.n,true); ctx.fillStyle="#666B6E"; ctx.textAlign="right"; ctx.fillText(String(r.n),g.W-14,y+h/2); ctx.textAlign="left"; ctx.fillStyle="#9A9EA1"; ctx.font="600 10px Alef, Heebo, Arial"; ctx.fillText(fmtN(r.tables),x-40,y+h/2); ctx.font="700 11px Alef, Heebo, Arial"; });
    return g; }
  const s=g.s; ctx.setLineDash([3,3]); ctx.strokeStyle="#C9CBCC"; ctx.lineWidth=1;
  L.fields.forEach(f=>{ ctx.strokeRect(f.x*s-3,f.y*s-3,f.w*s+6,f.h*s+6); ctx.fillStyle="#3F4447"; ctx.textAlign="center"; ctx.setLineDash([]); ctx.fillText(f.name,(f.x+f.w/2)*s,Math.max(8,f.y*s-10)); ctx.setLineDash([3,3]);
    f.rows.forEach(r=>{ const cell=F[f.id][r.n]; const h=Math.max(2.5,r.h*s*.7); bar(r.x*s,r.y*s+(r.h*s-h)/2,r.w*s,h,cell,r.tables,r.n,false); });
    ctx.setLineDash([]); ctx.fillStyle="#9A9EA1"; ctx.font="600 9px Alef, Heebo, Arial"; ctx.textAlign="left";
    const every=f.rows.length>14?5:1; f.rows.forEach(r=>{ if(r.n===1||r.n%every===0) ctx.fillText(String(r.n),(r.x+r.w)*s+3,(r.y+r.h/2)*s); }); ctx.font="700 11px Alef, Heebo, Arial"; ctx.setLineDash([3,3]); });
  ctx.setLineDash([]); return g;
}
export function pickRow(L,g,x,y){
  if(g.zoom){ let best=null,bd=Infinity; g.rows.forEach(({r,y:ry,h})=>{ const d=Math.abs(y-(ry+h/2)); if(d<bd){ bd=d; best=r; } }); return best?{f:g.f,r:best}:null; }
  const s=g.s; const f=L.fields.find(f=>x>=f.x*s-6&&x<=(f.x+f.w)*s+6&&y>=f.y*s-6&&y<=(f.y+f.h)*s+6); if(!f) return null;
  let best=null,bd=Infinity; f.rows.forEach(r=>{ const d=Math.abs(y-(r.y+r.h/2)*s); if(d<bd){ bd=d; best=r; } }); return {f,r:best};
}
// מפה קטנה לבחירת מיקום בטופס הדיווח: לחיצה על שדה בוחרת אותו, לחיצה על שורה (במצב מוגדל) מסמנת שורה / טווח
export function drawMini(cv,L,F,areaId,rows,zoomField){
  const keep=[focus,sel]; focus=zoomField||null; sel=null; const g=paint(cv,L,F,{});
  const ctx=cv.getContext("2d"); const dpr=Math.min(2.5,window.devicePixelRatio||1); ctx.setTransform(dpr,0,0,dpr,0,0);
  const f=areaId&&L.fields.find(x=>x.id===areaId);
  if(f){ ctx.strokeStyle="#121212"; ctx.lineWidth=2;
    if(g.zoom){ g.rows.forEach(({r,x,y,w,h})=>{ if(rows&&r.n>=rows[0]&&r.n<=rows[1]) ctx.strokeRect(x-2,y-2,w+4,h+4); }); }
    else { ctx.strokeRect(f.x*g.s-5,f.y*g.s-5,f.w*g.s+10,f.h*g.s+10); if(rows) f.rows.forEach(r=>{ if(r.n>=rows[0]&&r.n<=rows[1]){ ctx.strokeRect(r.x*g.s-2,r.y*g.s-1,r.w*g.s+4,r.h*g.s+2); } }); } }
  [focus,sel]=keep; return g;
}

/* ---------- הכרטיס «מה בוצע במפה» ---------- */
function buildDom(){
  const box=$("#wmBody"); if(!box||built) return; built=true;
  box.innerHTML='<div class="sb-lead"><span class="sb-big num" id="wmBig">0</span><span class="sb-cap" id="wmCap">שורות עם פאנלים</span></div><div class="sb-sub" id="wmSub"></div>'
    +'<div class="wm-cvw"><canvas id="wmCv" aria-label="מפת השדות לפי שורות: קונסטרוקציה, פאנלים, אישור מפקח. לחיצה על שדה מגדילה אותו; לחיצה על שורה מראה מה דווח בה"></canvas></div>'
    +'<div class="sb-keys"><span><i style="background:#ECEDED;border:1px solid #C9CBCC"></i>מתוכנן</span><span><i style="background:'+COL.con+'"></i>קונסטרוקציה</span><span><i style="background:'+COL.pan+'"></i>פאנלים</span><span><i style="background:'+COL.ok+'"></i>אושר ע״י מפקח</span><span><i style="border:1.5px solid #E40033;background:#fff"></i>דווח בשבוע האחרון</span></div>'
    +'<div class="wm-zoom" id="wmZoom" hidden></div><div class="wm-unp" id="wmUnp" hidden></div><div class="sechead" style="margin-top:10px"><span>מה עוד לא בוצע</span><span id="wmPendN"></span></div><div class="wm-pend" id="wmPend"></div><div class="hint" id="wmSrc" style="margin-top:8px"></div>';
  const cv=$("#wmCv");
  cv.onclick=e=>{ const L=currentLayout(); if(!L) return; const r=cv.getBoundingClientRect(); const g=geom(cv,L,focus&&L.fields.find(x=>x.id===focus)); const hit=pickRow(L,g,e.clientX-r.left,e.clientY-r.top);
    if(!hit){ if(focus){ focus=null; sel=null; renderWorkMap(); } return; }
    if(!focus){ focus=hit.f.id; sel=null; } else sel={f:hit.f.id,n:hit.r.n};
    renderWorkMap(); };
  addEventListener("resize",()=>{ clearTimeout(buildDom.t); buildDom.t=setTimeout(renderWorkMap,80); });
}
export function renderWorkMap(){
  const card=$("#workCard"); if(!card) return; buildDom();
  const L=currentLayout(), prog=(shared.demoStock?[]:shared.progress||[]);
  $("#wmEmpty").hidden=!!L; $("#wmBody").hidden=!L; $("#wmSetup").hidden=!!L||ROLE!=="owner";
  if(!L){ foldSum("work",""); return; }
  if(focus&&!L.fields.some(f=>f.id===focus)){ focus=null; sel=null; }
  const {F,unplaced,placed}=placeReports(L,prog);
  const rowsAll=L.fields.flatMap(f=>f.rows.map(r=>({f,r,c:F[f.id][r.n]})));
  const done=k=>rowsAll.filter(x=>x.c[k]>=x.r.tables).length, sum=k=>rowsAll.reduce((s,x)=>s+Math.min(x.r.tables,x.c[k]),0);
  $("#wmBig").textContent=fmtN(done("pan"))+" / "+fmtN(rowsAll.length);
  $("#wmSub").innerHTML="שולחנות ממוקמים במפה: קונסטרוקציה <b>"+fmtN(sum("con"))+"</b> · פאנלים <b>"+fmtN(sum("pan"))+"</b> · אושרו <b>"+fmtN(sum("ok"))+"</b>"+(placed?" · מתוך "+placed+" דיווחים עם מיקום":"");
  const g=paint($("#wmCv"),L,F,{});
  // הגדלה: פירוט השורה שנבחרה
  const z=$("#wmZoom"); z.hidden=!focus;
  if(focus){ const f=L.fields.find(x=>x.id===focus); const r=sel&&f.rows.find(x=>x.n===sel.n);
    const reps=prog.filter(p=>p.areaId===f.id&&(!r||!rowsOf(p)||(r.n>=rowsOf(p)[0]&&r.n<=rowsOf(p)[1]))).sort((a,b)=>b.ts-a.ts);
    const cell=r?F[f.id][r.n]:null;
    z.innerHTML='<div class="zm-head"><b>'+esc(f.name)+(r?" · שורה "+r.n+" · "+fmtN(r.tables)+" שולחנות":" · לחצו על שורה לפירוט")+'</b><button class="linkbtn" type="button" id="wmBack">חזרה למפה ‹</button></div>'
      +(cell?'<div class="zm-ph">'+ORDER.map(k=>{ const st=STAGES.find(s=>s[0]===k); const v=cell[k]; return '<div class="zm-row'+(v>=r.tables?" done":v>0?" on":"")+'"><i style="background:'+COL[k]+'"></i><span>'+esc(st?st[1]:k)+'</span><span class="num">'+fmtN(v)+' / '+fmtN(r.tables)+'</span><span class="d">'+(cell.last[k]?esc(fmtD(cell.last[k])):v>0?"":"עוד לא")+'</span></div>'; }).join("")+'</div>':"")
      +(reps.length?'<div class="zm-reps">'+reps.slice(0,12).map(p=>{ const st=STAGES.find(s=>s[0]===stageOf(p)); return '<div class="zm-rep"><span class="num">'+esc(fmtDT(p.dateText)||fmtD(p.ts))+'</span><span>'+fmtN(p.tables)+' שולחנות · '+esc(st?st[1]:"")+(rowsOf(p)?' · שורות '+rowsOf(p)[0]+(rowsOf(p)[1]!==rowsOf(p)[0]?'–'+rowsOf(p)[1]:''):'')+(p.who?' · '+esc(p.who):'')+(p.note?' · '+esc(p.note):'')+'</span></div>'; }).join("")+(reps.length>12?'<div class="hint">מוצגים 12 האחרונים מתוך '+reps.length+'.</div>':'')+'</div>':'<div class="hint" style="margin-top:6px">אין עדיין דיווחים שמוקמו כאן.</div>')
      +(ROLE!=="viewer"?'<button class="ghost" type="button" id="wmHere" style="width:100%;margin-top:8px">דיווח ביצוע כאן</button>':'');
    $("#wmBack").onclick=()=>{ focus=null; sel=null; renderWorkMap(); };
    const hb=$("#wmHere"); if(hb) hb.onclick=()=>openProgress({areaId:f.id,rows:r?[r.n,r.n]:null}); }
  // דיווחים בלי מיקום
  const u=$("#wmUnp"); u.hidden=!unplaced.length;
  if(unplaced.length) u.innerHTML='<span><b>'+unplaced.length+'</b> דיווחי ביצוע בלי מיקום: נספרים בכמויות, לא במפה.</span>'+(ROLE!=="viewer"?'<button class="linkbtn" type="button" id="wmPlace">מקם ›</button>':'');
  const pb=$("#wmPlace"); if(pb) pb.onclick=()=>openUnplaced(L,unplaced);
  // מה עוד לא בוצע
  const pend=pendingRuns(L,F); const pe=$("#wmPend"); pe.innerHTML="";
  if(!pend.length) pe.innerHTML='<div class="empty" style="padding:8px 0">'+(placed?"כל השורות במפה אושרו.":"עוד לא דווח ביצוע עם מיקום. בדיווח הבא בוחרים שדה ושורות, והמפה מתחילה להיצבע.")+'</div>';
  pend.forEach(x=>{ const b=document.createElement("button"); b.type="button"; b.className="slip wm-pd "+x.k; b.innerHTML='<b>'+esc(x.f.name)+' <small style="color:var(--ink3)">'+fmtN(x.tables)+' שולחנות</small></b><span>'+esc(x.text)+'</span>'; b.onclick=()=>{ focus=x.f.id; sel={f:x.f.id,n:x.rows[0][0]}; renderWorkMap(); $("#wmCv").scrollIntoView({block:"nearest",behavior:"smooth"}); }; pe.appendChild(b); });
  $("#wmPendN").textContent=pend.length?fmtN(pend.reduce((s,x)=>s+x.tables,0))+" שולחנות":"";
  $("#wmSrc").textContent=layoutSrcText(L)+" · "+layoutSummary(L)+(ROLE==="owner"?" · שינוי בהגדרות ← מבנה האתר":"");
  foldSum("work",fmtN(done("pan"))+" / "+fmtN(rowsAll.length)+" שורות"+(unplaced.length?" · "+unplaced.length+" בלי מיקום":""));
}

/* ---------- בחירת מיקום בטופס דיווח הביצוע ---------- */
// מחזיר {get(): {areaId, area, rows} | {}} ומצייר לתוך box. אין מבנה אתר → הסבר קצר בלבד.
export function mountLocation(box,preset){
  const L=currentLayout(); preset=preset||{};
  if(!L){ box.innerHTML='<label>מיקום</label><div class="hint">אין עדיין מבנה אתר, אז הדיווח נספר בכמויות בלי מפה.'+(ROLE==="owner"?' מבנה האתר נקבע בהגדרות.':'')+'</div>'; return {get:()=>({})}; }
  const {F}=placeReports(L,shared.demoStock?[]:shared.progress||[]);
  let areaId=preset.areaId&&L.fields.some(f=>f.id===preset.areaId)?preset.areaId:"", rows=rowsOf(preset)||null;
  box.innerHTML='<label>איפה</label><div class="chips" id="lcF" style="margin-bottom:6px"><button type="button" class="chip2" data-f="" aria-pressed="'+(!areaId)+'">בלי מיקום</button>'+L.fields.map(f=>'<button type="button" class="chip2" data-f="'+esc(f.id)+'" aria-pressed="'+(f.id===areaId)+'">'+esc(f.name)+'</button>').join("")+'</div>'
    +'<div id="lcRowsF" hidden><input type="text" id="lcRows" inputmode="numeric" placeholder="שורות, למשל 12 או 12–14" value="'+(rows?rows[0]+(rows[1]!==rows[0]?"–"+rows[1]:""):"")+'" aria-label="שורות"><div class="hint">שורה 1 למטה, כמו בשטח. לחיצה על שורה במפה מסמנת אותה; לחיצה שנייה סוגרת טווח.</div></div>'
    +'<div class="wm-mini"><canvas id="lcCv"></canvas></div><div class="hint" id="lcHint"></div>';
  const cv=box.querySelector("#lcCv"); const parse=v=>{ const m=/(\d{1,3})(?:\s*(?:[-–]|עד)\s*(\d{1,3}))?/.exec(String(v||"")); if(!m) return null; const a=Number(m[1]),b=m[2]?Number(m[2]):a; return a>0?[Math.min(a,b),Math.max(a,b)]:null; };
  const sync=()=>{ box.querySelectorAll("#lcF .chip2").forEach(c=>c.setAttribute("aria-pressed",String(c.dataset.f===areaId))); box.querySelector("#lcRowsF").hidden=!areaId;
    box.querySelector("#lcHint").textContent=areaId?"":"בלי מיקום הדיווח נספר בכמויות, אבל לא נצבע במפה.";
    if(cv.clientWidth) drawMini(cv,L,F,areaId,rows,areaId||null); };
  box.querySelector("#lcF").onclick=e=>{ const b=e.target.closest("[data-f]"); if(!b) return; areaId=b.dataset.f; rows=null; box.querySelector("#lcRows").value=""; sync(); };
  box.querySelector("#lcRows").oninput=e=>{ rows=parse(e.target.value); sync(); };
  cv.onclick=e=>{ const r=cv.getBoundingClientRect(); const g=geom(cv,L,areaId&&L.fields.find(x=>x.id===areaId)); const hit=pickRow(L,g,e.clientX-r.left,e.clientY-r.top); if(!hit) return;
    if(!areaId||hit.f.id!==areaId){ areaId=hit.f.id; rows=null; box.querySelector("#lcRows").value=""; }
    else { const n=hit.r.n; rows=!rows?[n,n]:rows[0]===rows[1]&&rows[0]!==n?[Math.min(rows[0],n),Math.max(rows[0],n)]:[n,n]; box.querySelector("#lcRows").value=rows[0]+(rows[1]!==rows[0]?"–"+rows[1]:""); }
    sync(); };
  setTimeout(sync,30); setTimeout(sync,300);
  return {get:()=>{ const f=L.fields.find(x=>x.id===areaId); return f?{areaId:f.id,area:f.name,rows:rows||null}:{areaId:"",area:"",rows:null}; }};
}
// מיקום בדיעבד לדיווחים שנשמרו בלי מיקום
function openUnplaced(L,list){
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="דיווחים בלי מיקום"><div class="grab"></div><h2>דיווחים בלי מיקום</h2><div class="hint" style="margin-bottom:8px">לחיצה על דיווח פותחת בחירת שדה ושורות. הכמות והתאריך לא משתנים.</div><div class="stock" id="upList"></div><div class="acts"><button class="cancel" type="button" style="flex:1">סגור</button></div></div>');
  const close=closer(scrim); scrim.querySelector(".cancel").onclick=close; const box=scrim.querySelector("#upList");
  list.slice().sort((a,b)=>b.ts-a.ts).forEach(p=>{ const st=STAGES.find(s=>s[0]===stageOf(p)); const b=document.createElement("button"); b.type="button"; b.className="slip";
    b.innerHTML='<b>'+fmtN(p.tables)+' שולחנות · '+esc(st?st[1]:"")+'</b><span>'+esc(fmtDT(p.dateText)||fmtD(p.ts))+(p.who?' · '+esc(p.who):'')+(p.note?' · '+esc(p.note):'')+'</span>';
    b.onclick=()=>{ close(); openPlace(p); }; box.appendChild(b); });
}
export function openPlace(p){
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="מיקום לדיווח"><div class="grab"></div><h2>איפה זה היה?</h2><div class="note-card">'+fmtN(p.tables)+' שולחנות · '+esc((STAGES.find(s=>s[0]===stageOf(p))||[])[1]||"")+' · '+esc(fmtDT(p.dateText)||fmtD(p.ts))+(p.note?'<br><small>'+esc(p.note)+'</small>':'')+'</div><div class="f" id="plLoc"></div><div class="acts"><button class="save" id="plSave" type="button">שמור מיקום</button><button class="cancel" type="button">ביטול</button></div></div>');
  const close=closer(scrim); scrim.querySelector(".cancel").onclick=close; const loc=mountLocation(scrim.querySelector("#plLoc"),p);
  scrim.querySelector("#plSave").onclick=async()=>{ const l=loc.get(); if(!l.areaId){ toast("איזה שדה?"); return; } const doc={...p,...l};
    try{ if(shared.DB) await shared.DB.doc("progress/"+p.id).set(doc); else { const i=shared.progress.findIndex(x=>x.id===p.id); if(i>=0) shared.progress[i]=doc; ls.set("progress",JSON.stringify(shared.progress)); renderWorkMap(); } }catch(e){ toast("השמירה נכשלה."); return; }
    logAct("progress","edit","מיקום לדיווח ביצוע: "+locText(doc),p.id); close(); toast("המיקום נשמר."); };
}

/* ---------- מבנה האתר (הגדרות) ---------- */
export function openLayout(){
  const d=layoutDoc()||{}, g={fields:1,rows:10,tables:10,names:"",...(d.gen||{})}, L=currentLayout(), hasMap=!!layoutFromTables(siteMap());
  const N=(id,l,v)=>'<div class="f"><label for="'+id+'">'+l+'</label><input type="number" inputmode="numeric" min="1" id="'+id+'" value="'+esc(v)+'"></div>';
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="מבנה האתר"><div class="grab"></div><h2>מבנה האתר</h2>'
    +'<div class="hint" style="margin:0 0 10px">המפה ב«מה בוצע במפה» ובדיווח הביצוע. <b>עכשיו: '+esc(layoutSrcText(L))+(L?" · "+esc(layoutSummary(L)):"")+'.</b> סדר עדיפות: תוכנית שנקראה, אחר כך המספרים כאן, אחר כך מפת השולחנות המובנית של האתר.</div>'
    +(d.layout?'<div class="note-card">המבנה הנוכחי נקרא מתוכנית'+(d.planId?' («'+esc((shared.PLANS||[]).find(p=>p.id===d.planId)?.name||d.planId)+'»)':'')+'. <button class="linkbtn" type="button" id="lyClearPlan" style="min-height:0;padding:0 4px">הסר ›</button></div>':'<div class="hint" style="margin-bottom:10px">קריאת מבנה מתוכנית: בכרטיס «תוכניות», על תמונת תוכנית, «קרא מבנה».</div>')
    +'<div class="f"><label><input type="checkbox" id="lyUseGen"'+(d.gen?" checked":"")+'> לקבוע את המבנה מהמספרים האלה</label></div>'
    +N("lyFields","שדות",g.fields)+N("lyRows","שורות בכל שדה",g.rows)+N("lyTables","שולחנות בשורה",g.tables)
    +'<div class="f"><label for="lyNames">שמות השדות (מופרדים בפסיק)</label><input type="text" id="lyNames" value="'+esc(g.names)+'" placeholder="מערב, מזרח"></div>'
    +(hasMap?'<div class="hint">לאתר הזה יש מפת שולחנות מובנית (השורות האמיתיות). בלי תוכנית ובלי סימון המספרים, היא המבנה.</div>':'')
    +'<div class="acts"><button class="save" id="lySave" type="button">שמור</button><button class="cancel" type="button">ביטול</button></div></div>');
  const close=closer(scrim); const q=s=>scrim.querySelector(s); q(".cancel").onclick=close;
  let plan=d.layout||null, planId=d.planId||"";
  const cp=q("#lyClearPlan"); if(cp) cp.onclick=()=>{ plan=null; planId=""; cp.parentElement.textContent="התוכנית תוסר בשמירה."; };
  if(ROLE!=="owner"){ q("#lySave").hidden=true; scrim.querySelectorAll("input").forEach(i=>i.disabled=true); }
  q("#lySave").onclick=async()=>{ const b=q("#lySave"); b.disabled=true;
    const gen=q("#lyUseGen").checked?{fields:+q("#lyFields").value,rows:+q("#lyRows").value,tables:+q("#lyTables").value,names:q("#lyNames").value.trim()}:null;
    const doc={...(gen?{gen}:{}),...(plan?{layout:plan,planId}:{})};
    try{ await saveLayout(doc); }catch(e){ b.disabled=false; toast("השמירה נכשלה."); return; }
    logAct("settings","edit","מבנה האתר: "+layoutSrcText(currentLayout())+" · "+layoutSummary(currentLayout()),"settings/layout"); close(); toast("מבנה האתר נשמר."); };
}

/* ---------- תוכניות ---------- */
const KINDS=["קונסטרוקציה","חשמל","אזרחי","כללי"];
export function renderPlans(){
  const box=$("#plansList"); if(!box) return; const P=(shared.PLANS||[]).slice().sort((a,b)=>b.ts-a.ts); box.innerHTML="";
  if(!P.length){ box.innerHTML='<div class="empty">אין עדיין תוכניות במופע. «+ תוכנית» מעלה PDF או תמונה, והיא נפתחת מכאן בלחיצה.</div>'; foldSum("plans",""); return; }
  P.forEach(p=>{ const b=document.createElement("button"); b.type="button"; b.className="slip";
    b.innerHTML='<b>'+esc(p.name)+(p.rev?' <small style="color:var(--ink3)">'+esc(p.rev)+'</small>':'')+'</b><span>'+esc(p.kind||"")+(p.kind?' · ':'')+(/pdf/i.test(p.mime||"")?"PDF":"תמונה")+' · '+esc(fmtD(p.ts))+(p.by?' · '+esc(p.by):'')+'</span>';
    b.onclick=()=>openPlan(p); box.appendChild(b); });
  foldSum("plans",P.length+" תוכניות");
}
const planUrl=p=>p.asset?"/_blob/"+p.asset:(p.url||"");
async function planBlob(p){ const r=await fetch(planUrl(p)); if(!r.ok) throw new Error("fetch"); return await r.blob(); }
export function openPlan(p){
  const img=!/pdf/i.test(p.mime||"");
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="תוכנית"><div class="grab"></div><h2>'+esc(p.name)+'</h2><div class="hint">'+esc([p.kind,p.rev,fmtD(p.ts),p.by].filter(Boolean).join(" · "))+'</div>'
    +(img?'<div class="wm-plan"><img src="'+esc(planUrl(p))+'" alt="'+esc(p.name)+'"></div>':'<div class="note-card">קובץ PDF. «פתח» שומר/פותח אותו במכשיר.</div>')
    +'<div class="acts" style="flex-wrap:wrap"><button class="save" id="plOpen" type="button">'+(img?"שמור במכשיר":"פתח")+'</button>'+(img&&ROLE==="owner"?'<button class="ghost" id="plRead" type="button">קרא מבנה</button>':'')+(ROLE==="owner"?'<button class="cancel danger" id="plDel" type="button">מחק</button>':'')+'<button class="cancel" type="button">סגור</button></div><div class="hint" id="plSt"></div></div>');
  const close=closer(scrim); const q=s=>scrim.querySelector(s); q(".cancel:not(.danger)").onclick=close;
  q("#plOpen").onclick=async()=>{ try{ const b=await planBlob(p); await saveFile(p.name+(/\.\w{2,4}$/.test(p.name)?"":img?".jpg":".pdf"),b); }catch(e){ toast("הקובץ לא נפתח."); } };
  const rd=q("#plRead"); if(rd) rd.onclick=async()=>{ if(!shared.SAMPLE){ toast("קריאה אוטומטית לא זמינה כאן."); return; } rd.disabled=true; q("#plSt").textContent="קורא את התוכנית…";
    try{ const b=await planBlob(p); const im=await createImageBitmap(b); const k=Math.min(1,1600/Math.max(im.width,im.height)); const c=document.createElement("canvas"); c.width=Math.round(im.width*k); c.height=Math.round(im.height*k); const x=c.getContext("2d"); x.fillStyle="#fff"; x.fillRect(0,0,c.width,c.height); x.drawImage(im,0,0,c.width,c.height);
      const jpg=await new Promise(r=>c.toBlob(r,"image/jpeg",.85)); const out=await shared.SAMPLE.json(PLAN_PROMPT,{images:jpg}); const L=normLayout(out);
      if(!L){ q("#plSt").textContent="לא נמצאו שדות בתוכנית. אפשר להשתמש במספרים בהגדרות."; rd.disabled=false; return; }
      if(!(await ask("נמצאו "+layoutSummary(L)+". לקבוע את זה כמבנה האתר?","קבע","var(--pv)","המבנה הקודם מוחלף. דיווחים שמוקמו לפי שמות שדות אחרים יופיעו כ«בלי מיקום»."))){ rd.disabled=false; q("#plSt").textContent=""; return; }
      const d=layoutDoc()||{}; await saveLayout({...(d.gen?{gen:d.gen}:{}),layout:out,planId:p.id}); logAct("settings","edit","מבנה האתר מתוכנית «"+p.name+"»: "+layoutSummary(L),"settings/layout"); close(); toast("מבנה האתר נקבע מהתוכנית."); }
    catch(e){ q("#plSt").textContent="הקריאה נכשלה. אפשר לנסות שוב או להשתמש במספרים."; rd.disabled=false; } };
  const del=q("#plDel"); if(del) del.onclick=async()=>{ if(!(await ask("למחוק את התוכנית «"+p.name+"»?"))) return; try{ if(shared.DB) await shared.DB.doc("plans/"+p.id).delete(); else { shared.PLANS=(shared.PLANS||[]).filter(x=>x.id!==p.id); ls.set("plans",JSON.stringify(shared.PLANS)); renderPlans(); } }catch(e){ toast("המחיקה נכשלה."); return; } logAct("settings","delete","נמחקה תוכנית "+p.name,p.id); close(); };
}
export function openAddPlan(){
  let kind=KINDS[0], file=null;
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="תוכנית חדשה"><div class="grab"></div><h2>תוכנית חדשה</h2>'
    +'<div class="f"><label>קובץ</label><label class="pbtn" for="apFile" id="apPick">בחירת PDF או תמונה</label><input type="file" id="apFile" accept="image/*,application/pdf" hidden></div>'
    +'<div class="f"><label for="apName">שם</label><input type="text" id="apName" placeholder="למשל: מפת קונסטרוקציה EIT_M_90"></div>'
    +'<div class="f"><label>תחום</label><div class="chips" id="apKind" style="margin-bottom:0">'+KINDS.map(k=>'<button type="button" class="chip2" data-k="'+k+'" aria-pressed="'+(k===kind)+'">'+k+'</button>').join("")+'</div></div>'
    +'<div class="f"><label for="apRev">גרסה / מהדורה</label><input type="text" id="apRev" placeholder="rev00"></div>'
    +'<div class="acts"><button class="save" id="apSave" type="button">שמור תוכנית</button><button class="cancel" type="button">ביטול</button></div></div>');
  const close=closer(scrim); const q=s=>scrim.querySelector(s); q(".cancel").onclick=close;
  q("#apKind").onclick=e=>{ const b=e.target.closest("[data-k]"); if(!b) return; kind=b.dataset.k; scrim.querySelectorAll("#apKind .chip2").forEach(c=>c.setAttribute("aria-pressed",String(c===b))); };
  q("#apFile").onchange=()=>{ file=q("#apFile").files[0]||null; if(file){ q("#apPick").textContent=file.name+" · "+Math.round(file.size/1024)+'K'; if(!q("#apName").value) q("#apName").value=file.name.replace(/\.\w{2,4}$/,""); } };
  q("#apSave").onclick=async()=>{ const name=q("#apName").value.trim(); if(!file){ toast("איזה קובץ?"); return; } if(!name){ toast("שם?"); return; }
    const b=q("#apSave"); b.disabled=true; b.textContent="שומר…"; const id="pl"+Date.now().toString(36);
    const doc={id,name,kind,rev:q("#apRev").value.trim(),mime:file.type||(/\.pdf$/i.test(file.name)?"application/pdf":"image/jpeg"),size:file.size,ts:Date.now(),by:actorName(),asset:"",url:""};
    try{ if(shared.ASSETS){ const a=await shared.ASSETS.upload(file); doc.asset=a.id; doc.url=a.url||""; }
      else if(file.size<=1.5e6){ doc.url=await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); }); }
      else throw new Error("big"); }
    catch(e){ b.disabled=false; b.textContent="שמור תוכנית"; toast(e&&e.message==="big"?"בלי אחסון קבצים אפשר לשמור כאן רק קובץ עד 1.5MB.":"העלאת הקובץ נכשלה."); return; }
    try{ if(shared.DB) await shared.DB.doc("plans/"+id).set(doc); else { shared.PLANS=(shared.PLANS||[]).concat(doc); ls.set("plans",JSON.stringify(shared.PLANS)); renderPlans(); } }
    catch(e){ b.disabled=false; b.textContent="שמור תוכנית"; toast("השמירה נכשלה."); return; }
    logAct("settings","add","תוכנית: "+name+" · "+kind+(doc.rev?" · "+doc.rev:""),id); close(); toast("התוכנית נשמרה."); };
}

export function __init(){
  shared.LAYOUT=null; shared.PLANS=[];
  try{ const v=ls.get("layout"); if(v) shared.LAYOUT=JSON.parse(v); }catch(e){}
  try{ const v=ls.get("plans"); if(v) shared.PLANS=JSON.parse(v); }catch(e){}
  const ap=$("#btnAddPlan"); if(ap) ap.onclick=openAddPlan;
  const st=$("#wmSetup"); if(st) st.onclick=openLayout;
}
