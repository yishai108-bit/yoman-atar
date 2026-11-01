// «חשמל לפי ממיר» (גרסה 58): מעקב עבודת החשמל לפי ממיר ותחנה, בכרטיס משלו; מגרסה 59 הממירים מסומנים גם על המפה (20-work-map.js).
// לכל ממיר: סטרינגים מחוברים מתוך N, מנתק מותקן, AC מחובר לתחנה, תקשורת. לכל תחנה: הוצבה, מ״ג מחובר, LV מחובר.
// כל עדכון הוא תמונת מצב של פריט אחד (elec/): המצב הנוכחי = העדכון האחרון לכל פריט; ההיסטוריה נשמרת.
import { $, actorName, ask, closer, esc, fmtD, fmtDT, logAct, ls, popup, shared, toast } from "./core.js";
import { fmtN } from "./01-stock.js";
import { SITE } from "./08-settings.js";
import { foldSum } from "./12-ui-cleanup.js";
import { ROLE } from "./18-identity.js";
import { genElec, siteElecFor } from "./site-elec.js";
import { renderWorkMap } from "./20-work-map.js";

export const INV_STEPS=[["disc","מנתק מותקן"],["ac","AC מחובר לתחנה"],["com","תקשורת מחוברת"]];
export const ST_STEPS=[["place","הוצבה"],["mv","מ״ג מחובר"],["lv","LV מחובר"]];
const COL={dc:"#2F80ED",disc:"#FFAA00",ac:"#5B9A3C",com:"#7E57C2"};

/* ---------- המבנה ---------- */
export function elecDoc(){ return shared.ELECCFG||null; }
// סדר עדיפות: מספרים בהגדרות (gen), מבנה מתיקיית הפרויקט (struct, גרסה 62), המבנה המובנה של האתר
export function currentElec(){ const d=elecDoc(); if(d&&d.gen){ const E=genElec(d.gen); if(E) return E; } if(d&&d.struct&&validStruct(d.struct)) return d.struct; return siteElecFor(SITE&&SITE.name); }
const validStruct=s=>Array.isArray(s.stations)&&s.stations.length>0&&s.stations.every(st=>st&&Array.isArray(st.icbs)&&st.icbs.every(c=>c&&Array.isArray(c.inv)&&c.inv.every(x=>Array.isArray(x)&&x.length===2&&Number(x[1])>0)));
// רשימה שטוחה של פריטים: תחנות וממירים, בסדר התצוגה
export function elecItems(E){
  const out=[]; if(!E) return out;
  E.stations.forEach(s=>{ out.push({id:s.id,kind:"st",name:s.name,side:s.side,st:s}); s.icbs.forEach(c=>c.inv.forEach(([id,n])=>out.push({id,kind:"inv",name:"ממיר "+id,strings:n,icb:c.id,st:s}))); });
  return out;
}
export const elecSummary=E=>{ const it=elecItems(E); const inv=it.filter(x=>x.kind==="inv"); return inv.length?E.stations.length+" תחנות · "+inv.length+" ממירים · "+fmtN(inv.reduce((s,x)=>s+x.strings,0))+" סטרינגים":""; };
export async function saveElecCfg(doc){
  doc={...doc,ts:Date.now(),by:actorName()};
  if(shared.DB) await shared.DB.doc("settings/elec").set(doc); else { shared.ELECCFG=doc; ls.set("eleccfg",JSON.stringify(doc)); renderElec(); renderWorkMap(); }
}

/* ---------- מצב ---------- */
// המצב הנוכחי של כל פריט: העדכון האחרון (לפי ts) לכל פריט
export function elecState(reports){
  const S={}; (reports||[]).slice().sort((a,b)=>a.ts-b.ts).forEach(r=>{ if(r&&r.item) S[r.item]=r; }); return S;
}
const invDone=(r,it)=>r&&Number(r.strings)>=it.strings&&r.disc&&r.ac&&r.com;
export function elecTotals(E,S){
  const it=elecItems(E), inv=it.filter(x=>x.kind==="inv");
  const t={inv:inv.length,strings:inv.reduce((s,x)=>s+x.strings,0),connected:0,dcFull:0,disc:0,ac:0,com:0,done:0,started:0};
  inv.forEach(x=>{ const r=S[x.id]; if(!r) return; const n=Math.min(x.strings,Number(r.strings)||0); t.connected+=n; if(n>0||r.disc||r.ac||r.com) t.started++; if(n>=x.strings) t.dcFull++; if(r.disc) t.disc++; if(r.ac) t.ac++; if(r.com) t.com++; if(invDone(r,x)) t.done++; });
  return t;
}
// «מה עוד לא בוצע»: קבוצות של ממירים לפי מה שחסר, בטקסט מכווץ (1.10–1.18)
export function elecPending(E,S){
  const inv=elecItems(E).filter(x=>x.kind==="inv"); const out=[];
  const grp=(k,test,text)=>{ const ids=inv.filter(x=>test(S[x.id]||{},x)).map(x=>x.id); if(ids.length) out.push({k,ids,n:ids.length,text:text+": "+rangeText(ids,inv.map(x=>x.id))}); };
  grp("none",(r,x)=>!(Number(r.strings)>0)&&!r.disc&&!r.ac&&!r.com,"עוד לא התחילו");
  grp("dc",(r,x)=>Number(r.strings)>0&&Number(r.strings)<x.strings,"סטרינגים בחיבור");
  grp("disc",(r,x)=>Number(r.strings)>=x.strings&&!r.disc,"DC גמור, בלי מנתק");
  grp("ac",(r,x)=>r.disc&&!r.ac,"מנתק יש, AC לא מחובר");
  grp("com",(r,x)=>r.ac&&!r.com,"AC מחובר, בלי תקשורת");
  E.stations.forEach(s=>{ const r=S[s.id]||{}; const miss=ST_STEPS.filter(([k])=>!r[k]).map(([,l])=>l); if(miss.length) out.push({k:"st",ids:[s.id],n:1,text:s.name+": "+miss.join(", ")}); });
  return out;
}
// רצפים לפי סדר הרשימה: ["1.2","1.3","1.4","1.9"] → "1.2–1.4, 1.9"
export function rangeText(ids,order){
  const idx=new Map(order.map((id,i)=>[id,i])); const s=ids.slice().sort((a,b)=>idx.get(a)-idx.get(b)); const runs=[]; let a=null,prev=null;
  s.forEach(id=>{ const i=idx.get(id); if(a!==null&&i===idx.get(prev)+1&&id.split(".")[0]===prev.split(".")[0]){ prev=id; return; } if(a!==null) runs.push([a,prev]); a=id; prev=id; });
  if(a!==null) runs.push([a,prev]);
  return runs.map(([x,y])=>x===y?x:x+"–"+y).join(", ");
}

/* ---------- הכרטיס ---------- */
let built=false;
function buildDom(){
  const box=$("#elBody"); if(!box||built) return; built=true;
  box.innerHTML='<div class="sb-lead"><span class="sb-big num" id="elBig">0</span><span class="sb-cap">סטרינגים מחוברים</span></div><div class="sb-sub" id="elSub"></div>'
    +'<div id="elStations"></div>'
    +'<div class="sb-keys"><span><i style="background:'+COL.dc+'"></i>סטרינגים</span><span><i style="background:'+COL.disc+'"></i>מנתק</span><span><i style="background:'+COL.ac+'"></i>AC</span><span><i style="background:'+COL.com+'"></i>תקשורת</span><span><i style="border:1.5px solid #E40033;background:#fff"></i>עודכן בשבוע האחרון</span></div>'
    +'<div class="sechead" style="margin-top:10px"><span>מה עוד לא בוצע</span><span id="elPendN"></span></div><div class="wm-pend" id="elPend"></div><div class="hint" id="elSrc" style="margin-top:8px"></div>';
}
export function renderElec(){
  const card=$("#elecCard"); if(!card) return; buildDom();
  const E=currentElec(), reps=(shared.demoStock?[]:shared.ELEC||[]);
  $("#elEmpty").hidden=!!E; $("#elBody").hidden=!E; $("#elSetup").hidden=ROLE!=="owner";
  if(!E){ foldSum("elec",""); return; }
  const S=elecState(reps), T=elecTotals(E,S), recent=t=>t>Date.now()-7*864e5;
  $("#elBig").textContent=fmtN(T.connected)+" / "+fmtN(T.strings);
  $("#elSub").innerHTML="ממירים מתוך <b>"+T.inv+"</b>: DC מלא <b>"+T.dcFull+"</b> · מנתק <b>"+T.disc+"</b> · AC <b>"+T.ac+"</b> · תקשורת <b>"+T.com+"</b>"+(T.done?" · גמורים <b>"+T.done+"</b>":"");
  const box=$("#elStations"); box.innerHTML="";
  E.stations.forEach(s=>{
    const r=S[s.id]||{};
    const head=document.createElement("button"); head.type="button"; head.className="el-st"+(ST_STEPS.every(([k])=>r[k])?" done":"")+(r.ts&&recent(r.ts)?" recent":"");
    head.innerHTML='<b>'+esc(s.name)+(s.side?' <small>'+esc(s.side)+'</small>':'')+'</b><span class="el-flags">'+ST_STEPS.map(([k,l])=>'<i class="'+(r[k]?"on":"")+'">'+l+'</i>').join("")+'</span>';
    head.onclick=()=>openElecItem(s.id); box.appendChild(head);
    s.icbs.forEach(c=>{
      const lab=document.createElement("div"); lab.className="el-icb"; const tot=c.inv.reduce((a,[,n])=>a+n,0), con=c.inv.reduce((a,[id,n])=>a+Math.min(n,Number((S[id]||{}).strings)||0),0);
      lab.innerHTML=(E.src==="gen"?"":"ICB "+esc(c.id)+" · ")+c.inv.length+" ממירים · <b>"+fmtN(con)+"</b> / "+fmtN(tot)+" סטרינגים"; box.appendChild(lab);
      const grid=document.createElement("div"); grid.className="el-grid";
      c.inv.forEach(([id,n])=>{ const r=S[id]||{}; const k=Math.min(n,Number(r.strings)||0); const b=document.createElement("button"); b.type="button"; b.className="el-inv"+(invDone(r,{strings:n})?" done":k>0||r.disc||r.ac||r.com?" on":"")+(r.ts&&recent(r.ts)?" recent":""); b.dataset.inv=id;
        b.setAttribute("aria-label","ממיר "+id+": "+k+" מתוך "+n+" סטרינגים"+(r.disc?", מנתק":"")+(r.ac?", AC":"")+(r.com?", תקשורת":""));
        b.innerHTML='<b>'+esc(id)+'</b><span class="el-bar"><i style="width:'+Math.round(100*k/n)+'%;background:'+COL.dc+'"></i></span><span class="el-n">'+k+'/'+n+'</span><span class="el-dots">'+INV_STEPS.map(([s])=>'<i style="'+(r[s]?"background:"+COL[s]+";border-color:"+COL[s]:"")+'"></i>').join("")+'</span>';
        b.onclick=()=>openElecItem(id); grid.appendChild(b); });
      box.appendChild(grid);
    });
  });
  const P=elecPending(E,S); const pb=$("#elPend"); pb.innerHTML="";
  $("#elPendN").textContent=P.length?"":"הכול בוצע";
  P.forEach(p=>{ const d=document.createElement("button"); d.type="button"; d.className="slip wm-pd el-"+p.k; d.innerHTML="<b>"+(p.k==="st"?"תחנה":p.n+" ממירים")+"</b><span>"+esc(p.text)+"</span>"; d.onclick=()=>openElecItem(p.ids[0]); pb.appendChild(d); });
  $("#elSrc").textContent=(E.src==="gen"?"לפי המספרים בהגדרות":"לפי "+E.src)+" · "+elecSummary(E)+(ROLE==="owner"?" · שינוי בכפתור «מבנה החשמל»":"");
  foldSum("elec",fmtN(T.connected)+" / "+fmtN(T.strings)+" סטרינגים");
}

/* ---------- פריט: מצב והיסטוריה ---------- */
export function openElecItem(id){
  const E=currentElec(); const it=elecItems(E).find(x=>x.id===id); if(!it) return;
  const reps=(shared.demoStock?[]:shared.ELEC||[]).filter(r=>r.item===id).sort((a,b)=>b.ts-a.ts); const r=reps[0]||{};
  const rows=it.kind==="inv"
    ?[['<i style="background:'+COL.dc+'"></i>',"סטרינגים מחוברים",fmtN(Math.min(it.strings,Number(r.strings)||0))+" / "+it.strings,Number(r.strings)>=it.strings],...INV_STEPS.map(([k,l])=>['<i style="background:'+COL[k]+'"></i>',l,r[k]?"בוצע":"עוד לא",!!r[k]])]
    :ST_STEPS.map(([k,l])=>['<i style="background:'+COL.ac+'"></i>',l,r[k]?"בוצע":"עוד לא",!!r[k]]);
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="'+esc(it.name)+'"><div class="grab"></div><h2>'+esc(it.name)+'</h2><div class="hint">'+esc([it.st.name,it.st.side,it.kind==="inv"&&E.src!=="gen"?"ICB "+it.icb:"",it.kind==="inv"?it.strings+" סטרינגים · "+fmtN(it.strings*(E.stringPanels||27))+" פאנלים":""].filter(Boolean).join(" · "))+'</div>'
    +'<div class="wm-zoom" style="margin-top:10px">'+rows.map(([i,l,v,on])=>'<div class="zm-row'+(on?" done":"")+'">'+i+'<span>'+esc(l)+'</span><span class="num">'+esc(v)+'</span><span class="d"></span></div>').join("")
    +(r.ts?'<div class="hint" style="margin-top:6px">עודכן '+esc(fmtDT(r.dateText)||fmtD(r.ts))+(r.who?' · '+esc(r.who):'')+(r.by?' · '+esc(r.by):'')+(r.note?' · '+esc(r.note):'')+'</div>':'<div class="hint" style="margin-top:6px">עוד לא דווח.</div>')+'</div>'
    +(reps.length>1?'<div class="sechead" style="margin-top:10px"><span>היסטוריה</span><span>'+reps.length+' עדכונים</span></div><div class="zm-reps">'+reps.slice(0,12).map(x=>'<div class="zm-rep"><span class="num">'+esc(fmtDT(x.dateText)||fmtD(x.ts))+'</span><span>'+esc(stateText(x,it))+(x.by?' · '+esc(x.by):'')+'</span></div>').join("")+'</div>':'')
    +'<div class="acts">'+(ROLE!=="viewer"?'<button class="save" type="button" id="eiUpd">עדכון מצב</button>':'')+'<button class="cancel" type="button">סגור</button></div></div>');
  const close=closer(scrim); scrim.querySelector(".cancel").onclick=close;
  const u=scrim.querySelector("#eiUpd"); if(u) u.onclick=()=>{ close(); openElecReport(id); };
}
export function stateText(r,it){
  if(it.kind==="st") return ST_STEPS.filter(([k])=>r[k]).map(([,l])=>l).join(", ")||"כלום עדיין";
  return (Number(r.strings)||0)+" / "+it.strings+" סטרינגים"+INV_STEPS.filter(([k])=>r[k]).map(([,l])=>" · "+l).join("");
}

/* ---------- עדכון מצב ---------- */
export function openElecReport(preId){
  const E=currentElec(); if(!E){ toast("אין עדיין מבנה חשמל לאתר."); return; }
  const items=elecItems(E); let it=items.find(x=>x.id===preId)||items.find(x=>x.kind==="inv")||items[0];
  const reps=(shared.demoStock?[]:shared.ELEC||[]); const whos=[...new Set(reps.slice().sort((a,b)=>b.ts-a.ts).map(r=>r.who).filter(Boolean))];
  const today=new Date(); const iso=today.getFullYear()+"-"+String(today.getMonth()+1).padStart(2,"0")+"-"+String(today.getDate()).padStart(2,"0");
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="עדכון מצב חשמל"><div class="grab"></div><h2>עדכון מצב: חשמל</h2>'
    +'<div class="note-card">מסמנים את <b>המצב הנוכחי</b> של הממיר או התחנה, לא תוספת. מה שכבר סומן נשאר מסומן.</div>'
    +'<div class="f"><label for="erItem">ממיר / תחנה</label><select id="erItem">'+E.stations.map(s=>'<optgroup label="'+esc(s.name)+'"><option value="'+esc(s.id)+'">'+esc(s.name)+(s.side?" · "+esc(s.side):"")+'</option>'+s.icbs.map(c=>c.inv.map(([id,n])=>'<option value="'+esc(id)+'">ממיר '+esc(id)+' · '+n+' סטרינגים</option>').join("")).join("")+'</optgroup>').join("")+'</select></div>'
    +'<div id="erState"></div>'
    +'<div class="f"><label for="erWho">קבלן חשמל</label><input type="text" id="erWho" list="erWhoList" placeholder="שם הקבלן" autocomplete="off" value="'+esc(whos[0]||"")+'"><datalist id="erWhoList">'+whos.map(w=>'<option value="'+esc(w)+'"></option>').join("")+'</datalist></div>'
    +'<div class="f"><label for="erDate">תאריך</label><input type="date" id="erDate" value="'+iso+'"></div>'
    +'<div class="f"><label for="erBy">מי דיווח</label><input type="text" id="erBy" placeholder="השם שלך" autocomplete="off" value="'+esc(ls.get("issuer")||"")+'"></div>'
    +'<div class="f"><label for="erNote">הערה</label><input type="text" id="erNote" placeholder="למשל: חסרים מהדקים"></div>'
    +'<div class="acts"><button class="save" id="erSave" type="button">שמור עדכון</button><button class="cancel" id="erCancel" type="button">ביטול</button></div></div>');
  const close=closer(scrim); const q=s=>scrim.querySelector(s);
  let strings=0, flags={};
  const drawState=()=>{
    const S=elecState(reps); const r=S[it.id]||{}; strings=Math.min(it.strings||0,Number(r.strings)||0); flags={};
    const steps=it.kind==="inv"?INV_STEPS:ST_STEPS; steps.forEach(([k])=>{ flags[k]=!!r[k]; });
    q("#erState").innerHTML=(it.kind==="inv"?'<div class="f"><label>סטרינגים מחוברים מתוך '+it.strings+'</label><div class="stepper"><button type="button" id="erMinus" aria-label="פחות">−</button><div class="val"><input type="text" inputmode="numeric" id="erStr" value="'+strings+'" aria-label="סטרינגים מחוברים"><small>סטרינגים</small></div><button type="button" id="erPlus" aria-label="יותר">+</button></div><button class="ghost" type="button" id="erAll" style="width:100%;margin-top:6px">הכול מחובר ('+it.strings+')</button></div>':'')
      +'<div class="f"><label>'+(it.kind==="inv"?"מה בוצע בממיר":"מה בוצע בתחנה")+'</label><div class="chips" id="erFlags" style="margin-bottom:0">'+steps.map(([k,l])=>'<button type="button" class="chip2" data-k="'+k+'" aria-pressed="'+flags[k]+'">'+l+'</button>').join("")+'</div></div>';
    if(it.kind==="inv"){ const setS=n=>{ n=Math.max(0,Math.min(it.strings,Math.round(Number(n)||0))); strings=n; q("#erStr").value=n; }; q("#erMinus").onclick=()=>setS(strings-1); q("#erPlus").onclick=()=>setS(strings+1); q("#erStr").onchange=e=>setS(e.target.value); q("#erAll").onclick=()=>setS(it.strings); }
    q("#erFlags").onclick=e=>{ const b=e.target.closest("[data-k]"); if(!b) return; flags[b.dataset.k]=!flags[b.dataset.k]; b.setAttribute("aria-pressed",String(flags[b.dataset.k])); };
  };
  q("#erItem").value=it.id; q("#erItem").onchange=e=>{ it=items.find(x=>x.id===e.target.value)||it; drawState(); }; drawState();
  q("#erCancel").onclick=close;
  q("#erSave").onclick=async()=>{
    const by=q("#erBy").value.trim(); if(!by){ toast("מי דיווח? צריך שם."); q("#erBy").focus(); return; } ls.set("issuer",by);
    const dv=q("#erDate").value; let ts=Date.now(), dateText=fmtD(ts); if(dv){ const d=new Date(dv+"T12:00:00"); if(!isNaN(d)){ ts=d.getTime(); dateText=fmtD(ts); } }
    const b=q("#erSave"); b.disabled=true; b.textContent="שומר…";
    const id="el"+Date.now(); const doc={id,ts,dateText,item:it.id,kind:it.kind,who:q("#erWho").value.trim(),by,note:q("#erNote").value.trim(),source:"app",...flags};
    if(it.kind==="inv") doc.strings=strings;
    try{ if(shared.DB) await shared.DB.doc("elec/"+id).set(doc); else { shared.ELEC=(shared.ELEC||[]).concat(doc); ls.set("elec",JSON.stringify(shared.ELEC)); } }
    catch(e){ b.disabled=false; b.textContent="שמור עדכון"; toast("השמירה נכשלה."); return; }
    if(shared.demoStock){ shared.demoStock=false; ls.set("demoDoneS","1"); }   // כתיבה אמיתית ראשונה מסיימת את מצב ההדגמה, כמו במלאי
    logAct("elec","add","חשמל · "+it.name+": "+stateText(doc,it)+(doc.who?" · "+doc.who:""),id,by);
    close(); toast("העדכון נשמר."); renderElec(); renderWorkMap();
  };
}

/* ---------- מבנה החשמל (בעלים) ---------- */
export function openElecSetup(){
  const d=elecDoc()||{}, g=d.gen||{stations:2,inv:10,strings:18}; const builtIn=d.struct&&validStruct(d.struct)?{src:"תיקיית הפרויקט: "+d.struct.src}:siteElecFor(SITE&&SITE.name);
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="מבנה החשמל"><div class="grab"></div><h2>מבנה החשמל</h2><div class="note-card">'+(builtIn?"לאתר הזה יש מבנה מתוכנית החשמל ("+esc(builtIn.src)+"). אפשר להחליף אותו במספרים, ולחזור אליו עם «נקה».":"אין עדיין מבנה חשמל מתוכנית. קובעים אותו במספרים: תחנות, ממירים לתחנה, סטרינגים לממיר.")+'</div>'
    +'<div class="f"><label for="esSt">תחנות (סקידים)</label><input type="text" inputmode="numeric" id="esSt" value="'+esc(g.stations)+'"></div>'
    +'<div class="f"><label for="esInv">ממירים לתחנה</label><input type="text" inputmode="numeric" id="esInv" value="'+esc(g.inv)+'"></div>'
    +'<div class="f"><label for="esStr">סטרינגים לממיר</label><input type="text" inputmode="numeric" id="esStr" value="'+esc(g.strings)+'"></div>'
    +'<div class="acts"><button class="save" id="esSave" type="button">שמור מבנה</button>'+(d.gen?'<button class="ghost" id="esClear" type="button">נקה</button>':'')+'<button class="cancel" type="button">סגור</button></div></div>');
  const close=closer(scrim); const q=s=>scrim.querySelector(s); q(".cancel").onclick=close;
  q("#esSave").onclick=async()=>{ const gen={stations:Number(q("#esSt").value),inv:Number(q("#esInv").value),strings:Number(q("#esStr").value)}; if(!genElec(gen)){ toast("צריך מספרים חיוביים."); return; }
    try{ await saveElecCfg({...(d.struct?{struct:d.struct}:{}),gen}); }catch(e){ toast("השמירה נכשלה."); return; } logAct("settings","edit","מבנה חשמל: "+gen.stations+" תחנות × "+gen.inv+" ממירים × "+gen.strings+" סטרינגים","settings/elec"); close(); toast("המבנה נשמר."); };
  const c=q("#esClear"); if(c) c.onclick=async()=>{ if(!await ask("לנקות את המבנה מהמספרים?"+(builtIn?" המבנה המובנה יחזור.":""),"נקה")) return; try{ await saveElecCfg(d.struct?{struct:d.struct}:{}); }catch(e){ toast("השמירה נכשלה."); return; } close(); };
}

export function __init(){
  shared.ELEC=[]; shared.ELECCFG=null;
  try{ shared.ELEC=JSON.parse(ls.get("elec")||"[]"); }catch(e){ shared.ELEC=[]; }
  try{ const v=ls.get("eleccfg"); if(v) shared.ELECCFG=JSON.parse(v); }catch(e){}
  const s=$("#elSetup"); if(s) s.onclick=openElecSetup;
  const a=$("#btnElecReport"); if(a) a.onclick=()=>openElecReport();
}
