/* ================= משימות פתוחות (22-tasks.js, גרסה 60): ממצא או משימה שמישהו צריך לסגור =================
   מה ש-Bilton קורא לו «משימות פתוחות» ואצלנו היה הודעת וואטסאפ: ממצא בשטח (שולחן עקום, חסר מהדק, בור לא מכוסה)
   עם מיקום במפה (שדה ושורות, או ממיר), אחראי, תאריך יעד וצילום; מי שסוגר רושם את שמו, ואפשר צילום של הסגירה.
   אוסף tasks/: מסמך אחד למשימה, והסגירה מעדכנת אותו (status, doneTs, doneBy). מונה «פתוחות» בלשונית ביצוע ובכרטיס,
   והמשימות הפתוחות עם מיקום מצוירות על «מה בוצע במפה» (20-work-map.js). בלי קטגוריות, בלי חומרה, בלי בונה טפסים. */
import { $, actorName, alertSheet, ask, closer, esc, fmtD, fmtDT, logAct, ls, popup, shared, toast } from "./core.js";
import { fmtN } from "./01-stock.js";
import { sigPad } from "./03-kit.js";
import { isoOf, isoText } from "./11-daylog.js";
import { foldSum } from "./12-ui-cleanup.js";
import { ROLE } from "./18-identity.js";
import { locText, mountLocation, renderWorkMap } from "./20-work-map.js";
import { currentElec, elecItems } from "./21-elec.js";

export const TASK_MAX_PHOTO=1.5e6;
const todayIso=()=>isoOf(Date.now());
export const taskList=()=>shared.demoStock?[]:(shared.TASKS||[]);
export const isOpen=t=>t&&t.status!=="done";
export const isLate=t=>isOpen(t)&&!!t.due&&t.due<todayIso();
export const taskWhere=t=>{ const parts=[]; if(t.item){ const it=elecItems(currentElec()).find(x=>x.id===t.item); parts.push(it?it.name:t.item); } const l=locText(t); if(l) parts.push(l); return parts.join(" · "); };
// סיכום לכרטיס, ללשונית ולדוח השבועי
export function taskStats(list){
  list=list||taskList(); const open=list.filter(isOpen), late=open.filter(isLate), wk=Date.now()-7*864e5;
  return {open:open.length,late:late.length,doneWeek:list.filter(t=>!isOpen(t)&&t.doneTs>wk).length,newWeek:list.filter(t=>t.ts>wk).length,total:list.length};
}
const photoSrc=(t,k)=>t[(k||"photo")+"Asset"]?"/_blob/"+t[(k||"photo")+"Asset"]:(t[(k||"photo")+"Url"]||"");
// צילום: מקטינים ל-1600px לפני השמירה (כמו תוכנית), לאחסון הקבצים או כ-data URL כשאין
async function shrinkPhoto(file){
  try{ const im=await createImageBitmap(file); const k=Math.min(1,1600/Math.max(im.width,im.height)); const c=document.createElement("canvas"); c.width=Math.round(im.width*k); c.height=Math.round(im.height*k); const x=c.getContext("2d"); x.fillStyle="#fff"; x.fillRect(0,0,c.width,c.height); x.drawImage(im,0,0,c.width,c.height); return await new Promise(r=>c.toBlob(r,"image/jpeg",.82)); }
  catch(e){ return file; }
}
export async function storePhoto(file){
  if(!file) return {};
  const blob=await shrinkPhoto(file);
  if(shared.ASSETS){ const a=await shared.ASSETS.upload(blob); return {asset:a.id,url:a.url||""}; }
  if(blob.size>TASK_MAX_PHOTO) throw new Error("big");
  return {asset:"",url:await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(blob); })};
}
async function saveTask(doc){
  if(shared.DB) await shared.DB.doc("tasks/"+doc.id).set(doc);
  else { shared.TASKS=(shared.TASKS||[]).filter(t=>t.id!==doc.id).concat(doc); ls.set("tasks",JSON.stringify(shared.TASKS)); renderTasks(); renderWorkMap(); }
}
// שמות לאחראי: צוות, קבלנים, מי שקיבל ניפוקים, מי שדיווח
export function assigneeNames(){
  const S=new Set();
  (shared.CREW||[]).forEach(c=>{ if(c.active!==false&&c.name) S.add(c.name); if(c.contractor) S.add(c.contractor); });
  (shared.demoStock?[]:shared.progress||[]).forEach(p=>{ if(p.who) S.add(p.who); });
  (shared.demoStock?[]:shared.issues||[]).forEach(s=>{ if(s.who) S.add(s.who); });
  (shared.demoStock?[]:shared.ELEC||[]).forEach(r=>{ if(r.who) S.add(r.who); });
  taskList().forEach(t=>{ if(t.who) S.add(t.who); });
  return [...S].filter(Boolean);
}
const dl=(id,arr)=>'<datalist id="'+id+'">'+[...new Set(arr)].filter(Boolean).map(v=>'<option value="'+esc(v)+'"></option>').join("")+'</datalist>';
const photoField=(id,label)=>'<div class="f"><label>'+label+'</label><div class="shots tk-shots"><div class="shot" id="'+id+'Box"><i class="ic ic-cam big"></i>צילום<input type="file" accept="image/*" capture="environment" id="'+id+'" aria-label="'+label+'"></div></div></div>';
function wirePhoto(scrim,id,onFile){
  const inp=scrim.querySelector("#"+id), box=scrim.querySelector("#"+id+"Box");
  inp.onchange=()=>{ const f=inp.files&&inp.files[0]; onFile(f||null); box.querySelectorAll("img,.tag").forEach(n=>n.remove()); if(!f) return; const img=new Image(); img.src=URL.createObjectURL(f); img.alt=""; const tag=document.createElement("div"); tag.className="tag"; tag.textContent="צולם"; box.appendChild(img); box.appendChild(tag); };
}

/* ---------- טופס: משימה חדשה / עריכה ---------- */
export function openTaskForm(preset){
  preset=preset||{}; const t=preset.id?preset:null; let photo=null;
  const E=currentElec(), items=E?elecItems(E):[];
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="משימה"><div class="grab"></div><h2>'+(t?"עריכת משימה":"משימה חדשה")+'</h2>'
    +(t?'':'<div class="note-card">ממצא או עבודה שמישהו צריך לסגור: מה, איפה, מי, עד מתי. נשאר ברשימה ובמפה עד שסוגרים.</div>')
    +'<div class="f"><label for="tkTitle">מה</label><input type="text" id="tkTitle" maxlength="120" placeholder="למשל: שולחן עקום, חסרים 2 מהדקים, בור פתוח ליד הדרך" value="'+esc(t?t.title:preset.title||"")+'"></div>'
    +'<div class="f" id="tkLoc"></div>'
    +(items.length?'<div class="f"><label for="tkItem">ממיר / תחנה (לא חובה)</label><select id="tkItem"><option value="">בלי</option>'+E.stations.map(s=>'<optgroup label="'+esc(s.name)+'"><option value="'+esc(s.id)+'">'+esc(s.name)+'</option>'+s.icbs.map(c=>c.inv.map(([id])=>'<option value="'+esc(id)+'">ממיר '+esc(id)+'</option>').join("")).join("")+'</optgroup>').join("")+'</select></div>':'')
    +'<div class="f"><label for="tkWho">אחראי</label><input type="text" id="tkWho" list="tkWhoL" autocomplete="off" placeholder="מי סוגר את זה" value="'+esc(t?t.who||"":preset.who||"")+'">'+dl("tkWhoL",assigneeNames())+'</div>'
    +'<div class="f"><label for="tkDue">עד מתי</label><input type="date" id="tkDue" value="'+esc(t?t.due||"":preset.due||"")+'"></div>'
    +(t?'':photoField("tkPhoto","צילום (לא חובה)"))
    +'<div class="f"><label for="tkNote">פירוט</label><textarea id="tkNote" placeholder="מה בדיוק, ומה צריך כדי לסגור">'+esc(t?t.note||"":"")+'</textarea></div>'
    +'<div class="f"><label for="tkBy">מי פתח</label><input type="text" id="tkBy" autocomplete="off" placeholder="השם שלך" value="'+esc(t?t.by||"":ls.get("issuer")||"")+'"></div>'
    +'<div class="acts"><button class="save" id="tkSave" type="button">'+(t?"שמור":"פתח משימה")+'</button><button class="cancel" type="button">ביטול</button></div></div>');
  const close=closer(scrim); const q=s=>scrim.querySelector(s); q(".cancel").onclick=close;
  const loc=mountLocation(q("#tkLoc"),t||preset);
  const sel=q("#tkItem"); if(sel) sel.value=(t?t.item:preset.item)||"";
  if(!t) wirePhoto(scrim,"tkPhoto",f=>{ photo=f; });
  q("#tkSave").onclick=async()=>{
    const title=q("#tkTitle").value.trim(); if(!title){ toast("מה המשימה?"); q("#tkTitle").focus(); return; }
    const by=q("#tkBy").value.trim(); if(!by){ toast("מי פתח? צריך שם."); q("#tkBy").focus(); return; } ls.set("issuer",by);
    const b=q("#tkSave"); b.disabled=true; b.textContent="שומר…";
    const l=loc.get(); const doc={...(t||{id:"tk"+Date.now().toString(36)+Math.random().toString(36).slice(2,5),ts:Date.now(),status:"open",source:"app",photoAsset:"",photoUrl:""}),
      title,note:q("#tkNote").value.trim(),who:q("#tkWho").value.trim(),due:q("#tkDue").value||"",by,item:sel?sel.value:"",areaId:l.areaId||"",area:l.area||"",rows:l.rows||null};
    if(!t) doc.dateText=fmtD(doc.ts);
    try{ if(photo){ const p=await storePhoto(photo); doc.photoAsset=p.asset; doc.photoUrl=p.url; } }
    catch(e){ b.disabled=false; b.textContent=t?"שמור":"פתח משימה"; toast(e&&e.message==="big"?"בלי אחסון קבצים אפשר לשמור צילום עד 1.5MB.":"הצילום לא נשמר. אפשר לשמור בלי."); photo=null; return; }
    try{ await saveTask(doc); }catch(e){ b.disabled=false; b.textContent=t?"שמור":"פתח משימה"; toast("השמירה נכשלה."); return; }
    if(shared.demoStock){ shared.demoStock=false; ls.set("demoDoneS","1"); }
    logAct("task",t?"edit":"add",(t?"משימה עודכנה: ":"משימה: ")+title+(doc.who?" · "+doc.who:"")+(taskWhere(doc)?" · "+taskWhere(doc):"")+(doc.due?" · עד "+isoText(doc.due):""),doc.id,by);
    close(); toast(t?"המשימה עודכנה.":"המשימה נפתחה."); renderTasks(); renderWorkMap();
  };
}

/* ---------- סגירה ---------- */
export function openTaskClose(t){
  let photo=null;
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="סגירת משימה"><div class="grab"></div><h2>סגירת משימה</h2><div class="note-card"><b>'+esc(t.title)+'</b>'+(taskWhere(t)?'<br>'+esc(taskWhere(t)):'')+(t.who?'<br>אחראי: '+esc(t.who):'')+'</div>'
    +photoField("tcPhoto","צילום של מה שנסגר (לא חובה)")
    +'<div class="f"><label for="tcNote">מה נעשה</label><input type="text" id="tcNote" maxlength="200" placeholder="למשל: הוחלפו 2 מהדקים"></div>'
    +'<div class="f"><label for="tcBy">מי סגר</label><input type="text" id="tcBy" autocomplete="off" placeholder="השם שלך" value="'+esc(ls.get("issuer")||"")+'"></div>'
    +'<div class="acts"><button class="save" id="tcSave" type="button" style="background:var(--sage)">סגור משימה</button><button class="cancel" type="button">ביטול</button></div></div>');
  const close=closer(scrim); const q=s=>scrim.querySelector(s); q(".cancel").onclick=close;
  wirePhoto(scrim,"tcPhoto",f=>{ photo=f; });
  q("#tcSave").onclick=async()=>{
    const by=q("#tcBy").value.trim(); if(!by){ toast("מי סגר? צריך שם."); q("#tcBy").focus(); return; } ls.set("issuer",by);
    const b=q("#tcSave"); b.disabled=true; b.textContent="שומר…";
    const doc={...t,status:"done",doneTs:Date.now(),doneBy:by,doneNote:q("#tcNote").value.trim(),doneAsset:"",doneUrl:""};
    try{ if(photo){ const p=await storePhoto(photo); doc.doneAsset=p.asset; doc.doneUrl=p.url; } }catch(e){ toast("הצילום לא נשמר; המשימה נסגרת בלעדיו."); }
    try{ await saveTask(doc); }catch(e){ b.disabled=false; b.textContent="סגור משימה"; toast("השמירה נכשלה."); return; }
    logAct("task","edit","משימה נסגרה: "+t.title+(doc.doneNote?" · "+doc.doneNote:""),t.id,by);
    close(); toast("המשימה נסגרה."); renderTasks(); renderWorkMap();
  };
}
async function reopen(t){
  if(!(await ask("לפתוח מחדש את «"+t.title+"»?","פתח מחדש","var(--amber)"))) return;
  const doc={...t,status:"open",reopenedTs:Date.now(),reopenedBy:actorName()};
  try{ await saveTask(doc); }catch(e){ toast("השמירה נכשלה."); return; }
  logAct("task","edit","משימה נפתחה מחדש: "+t.title,t.id); renderTasks(); renderWorkMap();
}
async function remove(t){
  if(!(await ask("למחוק את המשימה «"+t.title+"»?"))) return;
  try{ if(shared.DB) await shared.DB.doc("tasks/"+t.id).delete(); else { shared.TASKS=(shared.TASKS||[]).filter(x=>x.id!==t.id); ls.set("tasks",JSON.stringify(shared.TASKS)); renderTasks(); renderWorkMap(); } }catch(e){ toast("המחיקה נכשלה."); return; }
  logAct("task","delete","נמחקה משימה: "+t.title,t.id,null,t);
}

/* ---------- פרטי משימה ---------- */
export function openTask(id){
  const t=taskList().find(x=>x.id===id); if(!t) return;
  const open=isOpen(t), late=isLate(t), p=photoSrc(t), d=photoSrc(t,"done");
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="משימה"><div class="grab"></div><h2>'+esc(t.title)+'</h2>'
    +'<div class="tk-st '+(open?(late?"late":"open"):"done")+'">'+(open?(late?"פתוחה · באיחור":"פתוחה"):"נסגרה "+esc(fmtD(t.doneTs))+(t.doneBy?" · "+esc(t.doneBy):""))+'</div>'
    +'<div class="kv-list">'+[["איפה",taskWhere(t)],["אחראי",t.who],["עד מתי",t.due?isoText(t.due):""],["נפתחה",(fmtDT(t.dateText)||fmtD(t.ts))+(t.by?" · "+t.by:"")],["פירוט",t.note],["מה נעשה",t.doneNote]].filter(([,v])=>v).map(([k,v])=>'<div class="kv"><span>'+k+'</span><b>'+esc(v)+'</b></div>').join("")+'</div>'
    +(p?'<div class="tk-photo"><div class="hint">צילום בפתיחה</div><img src="'+esc(p)+'" alt="צילום המשימה"></div>':'')
    +(d?'<div class="tk-photo"><div class="hint">צילום בסגירה</div><img src="'+esc(d)+'" alt="צילום הסגירה"></div>':'')
    +'<div class="acts" style="flex-wrap:wrap">'+(ROLE!=="viewer"?(open?'<button class="save" id="tdClose" type="button" style="background:var(--sage)">סגור משימה</button><button class="ghost" id="tdEdit" type="button">ערוך</button>':'<button class="ghost" id="tdReopen" type="button">פתח מחדש</button>'):'')+(ROLE==="owner"?'<button class="cancel danger" id="tdDel" type="button">מחק</button>':'')+'<button class="cancel" type="button">סגור</button></div></div>');
  const close=closer(scrim); const q=s=>scrim.querySelector(s); q(".cancel:not(.danger)").onclick=close;
  const c=q("#tdClose"); if(c) c.onclick=()=>{ close(); openTaskClose(t); };
  const e=q("#tdEdit"); if(e) e.onclick=()=>{ close(); openTaskForm(t); };
  const r=q("#tdReopen"); if(r) r.onclick=()=>{ close(); reopen(t); };
  const x=q("#tdDel"); if(x) x.onclick=()=>{ close(); remove(t); };
}
// רשימה בחלון (למשל: כל המשימות בשורה אחת במפה)
export function openTaskList(title,list){
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="משימות"><div class="grab"></div><h2>'+esc(title)+'</h2><div class="stock" id="tlList"></div><div class="acts"><button class="cancel" type="button" style="flex:1">סגור</button></div></div>');
  const close=closer(scrim); scrim.querySelector(".cancel").onclick=close; const box=scrim.querySelector("#tlList");
  list.forEach(t=>{ const b=slipFor(t); b.onclick=()=>{ close(); openTask(t.id); }; box.appendChild(b); });
}
function slipFor(t){
  const b=document.createElement("button"); b.type="button"; const open=isOpen(t), late=isLate(t);
  b.className="slip tk-slip "+(open?(late?"late":"open"):"done");
  b.innerHTML='<b>'+esc(t.title)+'</b><span class="sigok tk-badge">'+(open?(late?"באיחור":"פתוחה"):"נסגרה")+'</span><span>'+esc([taskWhere(t),t.who,open?(t.due?"עד "+isoText(t.due):""):fmtD(t.doneTs)+(t.doneBy?" · "+t.doneBy:"")].filter(Boolean).join(" · "))+'</span>';
  return b;
}

/* ---------- הכרטיס ---------- */
let filter="open";
export function renderTasks(){
  const card=$("#tasksCard"); if(!card) return;
  const list=taskList(), S=taskStats(list);
  const badge=$("#tabOverN"); if(badge){ badge.hidden=!S.open; badge.textContent=S.open?String(S.open):""; badge.classList.toggle("late",S.late>0); }
  $("#tkBig").textContent=fmtN(S.open);
  $("#tkSub").innerHTML=S.total?(S.late?'<b style="color:var(--clay)">'+S.late+' באיחור</b> · ':'')+'נפתחו השבוע <b>'+S.newWeek+'</b> · נסגרו השבוע <b>'+S.doneWeek+'</b>':"";
  const chips=$("#tkChips"); chips.innerHTML=[["open","פתוחות",S.open],["late","באיחור",S.late],["done","נסגרו",S.total-S.open],["all","הכול",S.total]].map(([k,l,n])=>'<button type="button" class="chip2" data-k="'+k+'" aria-pressed="'+(filter===k)+'">'+l+' <span class="num">'+n+'</span></button>').join("");
  chips.onclick=e=>{ const b=e.target.closest("[data-k]"); if(!b) return; filter=b.dataset.k; renderTasks(); };
  const rows=list.filter(t=>filter==="all"||(filter==="open"?isOpen(t):filter==="late"?isLate(t):!isOpen(t))).sort((a,b)=>{ if(isOpen(a)!==isOpen(b)) return isOpen(a)?-1:1; if(isOpen(a)){ const da=a.due||"9", db=b.due||"9"; if(da!==db) return da<db?-1:1; } return (b.doneTs||b.ts)-(a.doneTs||a.ts); });
  const box=$("#tkList"); box.innerHTML="";
  if(!list.length) box.innerHTML='<div class="empty">אין עדיין משימות. ממצא בשטח (שולחן עקום, חסר חומר, בור פתוח) נפתח כאן עם מיקום ואחראי, ונשאר במפה עד שסוגרים.</div>';
  else if(!rows.length) box.innerHTML='<div class="empty" style="padding:8px 0">'+(filter==="open"?"אין משימות פתוחות.":filter==="late"?"אין משימות באיחור.":"עוד לא נסגרו משימות.")+'</div>';
  rows.slice(0,30).forEach(t=>{ const b=slipFor(t); b.onclick=()=>openTask(t.id); box.appendChild(b); });
  if(rows.length>30){ const m=document.createElement("div"); m.className="hint"; m.textContent="מוצגות 30 מתוך "+rows.length+"."; box.appendChild(m); }
  foldSum("tasks",S.open?S.open+" פתוחות"+(S.late?" · "+S.late+" באיחור":""):list.length?"הכול סגור":"");
}

export function __init(){
  shared.TASKS=[];
  try{ shared.TASKS=JSON.parse(ls.get("tasks")||"[]"); }catch(e){ shared.TASKS=[]; }
  const a=$("#btnAddTask"); if(a) a.onclick=()=>openTaskForm();
}
