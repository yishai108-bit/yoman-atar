// לשונית «כלים»: רשימת כלים ונגררים, הוספה/עריכה, שעות מנוע, טיפולי מוסך, תפוגות
import { state, saveEquipment, deleteEquipment, saveService, eqById, siteList, sites } from "./store.js";
import { esc, fmtDate, isoDate, fmtNum, toast } from "./util.js";
import { KINDS, EXPIRIES, DEFAULT_INTERVAL, SUMMARY_LABEL } from "./forms.js";
import { equipmentStatus, serviceState } from "./logic.js";
import { openSheet, closeSheet, confirmBox } from "./sheet.js";
import { openCheckChooser } from "./view-check.js";

export function renderEq(root, nav, focusId){
  const list = state.equipment.slice().sort((a, b) => (a.kind + a.name).localeCompare(b.kind + b.name, "he"));
  let h = `<button type="button" class="add" id="btnAddEq" ${state.canWrite ? "" : "disabled"}>＋ הוספת כלי או נגרר</button>`;
  if (!list.length) h += `<div class="empty">הרשימה ריקה. מוסיפים כל כלי (טרקטור משא / מיול) וכל נגרר בבעלות BELECTRIC באתר, עם מס׳ רישוי, שעות מנוע ותאריכי רישיון/ביטוח/תסקיר.</div>`;
  for (const kind of ["tool", "trailer"]){
    const items = list.filter(e => e.kind === kind); if (!items.length) continue;
    h += `<div class="sechead"><span>${KINDS[kind].plural}</span><span>${items.length}</span></div><div class="list">`;
    for (const eq of items){
      const s = equipmentStatus(eq, state.checks, state.defects);
      const meta = [];
      if (eq.site) meta.push(`<span>${esc(eq.site)}</span>`);
      if (eq.plate) meta.push(`<span class="num">${esc(eq.plate)}</span>`);
      if (eq.model) meta.push(`<span>${esc(eq.model)}</span>`);
      if (s.svc) meta.push(`<span class="num">${fmtNum(s.svc.hours)} שעות</span><span>${s.svc.state === "due" ? "טיפול חלף" : "טיפול בעוד " + fmtNum(s.svc.left) + " שעות"}</span>`);
      if (s.open.length) meta.push(`<span style="color:var(--clay);font-weight:700">${s.open.length} ליקויים</span>`);
      if (eq.active === false) meta.push(`<span>לא פעיל</span>`);
      h += `<button type="button" class="rec ${eq.active === false ? "" : s.level}" data-eq="${eq.id}"><div class="ttl">${esc(eq.name)}</div><div class="meta">${meta.join("")}</div>
        <div class="side"><span class="chip ${s.checkedThisWeek ? "c-ok" : "c-warn"}">${s.checkedThisWeek ? "נבדק השבוע" : "לא נבדק השבוע"}</span></div></button>`;
    }
    h += `</div>`;
  }
  root.innerHTML = h;
  root.querySelector("#btnAddEq").onclick = () => editEquipment(null);
  root.querySelectorAll("[data-eq]").forEach(b => b.onclick = () => showEquipment(b.dataset.eq, nav));
  if (focusId && eqById(focusId)) showEquipment(focusId, nav);
}

export function showEquipment(id, nav){
  const eq = eqById(id); if (!eq) return;
  const s = equipmentStatus(eq, state.checks, state.defects);
  const k = KINDS[eq.kind];
  let h = `<h2>${esc(eq.name)} <small style="font-size:.8rem;color:var(--ink3)">${k.label}${eq.site ? " · " + esc(eq.site) : ""}${eq.plate ? " · " + esc(eq.plate) : ""}</small></h2>`;
  if (eq.model || eq.note) h += `<p class="note">${esc(eq.model || "")}${eq.model && eq.note ? " · " : ""}${esc(eq.note || "")}</p>`;
  if (s.svc){
    const pct = Math.max(0, Math.min(100, Math.round((s.svc.hours - s.svc.last) / s.svc.interval * 100)));
    h += `<div class="card" style="margin-top:10px"><h2>שעות מנוע וטיפול מוסך <small>כל ${fmtNum(s.svc.interval)} שעות</small></h2>
      <div style="display:flex;justify-content:space-between;font-size:.9rem"><span>כעת <b class="num">${fmtNum(s.svc.hours)}</b></span><span>טיפול הבא ב-<b class="num">${fmtNum(s.svc.next)}</b></span></div>
      <div class="svcbar ${s.svc.state}"><b style="width:${pct}%"></b></div>
      <div class="note ${s.svc.state === "due" ? "bad" : s.svc.state === "soon" ? "warn" : ""}">${s.svc.state === "due" ? "חלף מועד הטיפול ב-" + fmtNum(-s.svc.left) + " שעות. אין להמשיך לעבוד בכלי לפני טיפול במוסך מורשה; לעדכן את דנה / מחמוד." : s.svc.state === "soon" ? "נותרו " + fmtNum(s.svc.left) + " שעות לטיפול. לתאם מוסך ולעדכן את דנה / מחמוד." : "נותרו " + fmtNum(s.svc.left) + " שעות לטיפול הבא."}
      ${eq.lastServiceDate ? "<br>טיפול אחרון: " + fmtDate(eq.lastServiceDate) + " ב-" + fmtNum(eq.lastServiceHours || 0) + " שעות" + (eq.lastGarage ? " (" + esc(eq.lastGarage) + ")" : "") : "<br>עוד לא נרשם טיפול מוסך."}</div>
      <div class="row2" style="margin:10px 0 0"><button type="button" class="ghost" data-x="service" ${state.canWrite ? "" : "disabled"}>🔧 רישום טיפול מוסך</button><button type="button" class="ghost" data-x="hours" ${state.canWrite ? "" : "disabled"}>⏱ עדכון שעות</button></div></div>`;
  }
  const exps = EXPIRIES.map(e => ({ ...e, v: eq[e.key], st: s.exps.find(x => x.key === e.key) }));
  h += `<div class="card"><h2>רישיון, ביטוח, תסקיר <small>שבועיים מראש לאלירן</small></h2><table class="t"><tbody>`;
  for (const e of exps) h += `<tr><td>${e.label}</td><td class="num">${e.v ? fmtDate(e.v) : "—"}</td><td>${e.st ? `<span class="chip ${e.st.state === "expired" ? "c-bad" : e.st.state === "soon" ? "c-warn" : "c-ok"}">${e.st.state === "expired" ? "פג" : e.st.state === "soon" ? "עוד " + e.st.days + " ימים" : "בתוקף"}</span>` : ""}</td></tr>`;
  h += `</tbody></table></div>`;
  const open = s.open;
  h += `<div class="card"><h2>ליקויים פתוחים <small>${open.length}</small></h2>`;
  h += open.length ? `<ul class="note" style="margin:0;padding-inline-start:18px">${open.map(d => `<li>${esc(d.text)}${d.note ? " – " + esc(d.note) : ""} <span style="color:var(--ink3)">(${fmtDate(d.openedAt)})</span></li>`).join("")}</ul>` : `<p class="note">אין ליקויים פתוחים.</p>`;
  h += `</div>`;
  const hist = state.checks.filter(c => c.eqId === eq.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  h += `<div class="card"><h2>בדיקות אחרונות <small>${state.checks.filter(c => c.eqId === eq.id).length}</small></h2>`;
  h += hist.length ? `<table class="t"><tbody>${hist.map(c => `<tr><td class="num">${fmtDate(c.date)}</td><td>${esc(c.inspector || "")}</td><td><span class="chip ${c.summary === "ok" ? "c-ok" : c.summary === "down" ? "c-bad" : "c-warn"}">${SUMMARY_LABEL[c.summary] || ""}</span></td><td><button type="button" class="link" data-open="${c.id}">פתח</button></td></tr>`).join("")}</tbody></table>` : `<p class="note">עוד לא נבדק.</p>`;
  h += `</div>`;
  h += `<button type="button" class="add" data-x="check" ${state.canWrite ? "" : "disabled"}>📋 טופס בדיקה שבועית</button>
    <div class="row2"><button type="button" class="ghost" data-x="edit" ${state.canWrite ? "" : "disabled"}>✎ עריכת פרטים</button><button type="button" class="del" data-x="del" ${state.canWrite ? "" : "disabled"}>מחיקה</button></div>`;
  const sh = openSheet(h);
  sh.querySelector("[data-x=check]").onclick = () => { closeSheet(); openCheckChooser(eq.id); };
  sh.querySelector("[data-x=edit]").onclick = () => editEquipment(eq);
  sh.querySelector("[data-x=del]").onclick = async () => { if (await confirmBox("למחוק את «" + eq.name + "» מהרשימה? הבדיקות שנשמרו לא נמחקות.", { ok: "מחק", danger: true })){ try { await deleteEquipment(eq.id); toast("נמחק"); } catch (e){ toast("המחיקה נכשלה", "bad"); } } };
  const sv = sh.querySelector("[data-x=service]"); if (sv) sv.onclick = () => recordService(eq);
  const hr = sh.querySelector("[data-x=hours]"); if (hr) hr.onclick = () => updateHours(eq);
  sh.querySelectorAll("[data-open]").forEach(b => b.onclick = () => { closeSheet(); nav("history", b.dataset.open); });
}

export function editEquipment(eq){
  const isNew = !eq; eq = eq || { kind: "tool", site: sites().length === 1 ? sites()[0] : "", name: "", plate: "", model: "", hours: "", interval: DEFAULT_INTERVAL, lastServiceHours: "", lastServiceDate: "", licenseExp: "", insuranceExp: "", testExp: "", note: "", active: true };
  const h = `<h2>${isNew ? "כלי או נגרר חדש" : "עריכת פרטים"}</h2>
    <div class="f"><label>סוג</label><div class="opts"><button type="button" class="opt" data-kind="tool" aria-pressed="${eq.kind === "tool"}">כלי<small>טרקטור משא / מיול</small></button><button type="button" class="opt" data-kind="trailer" aria-pressed="${eq.kind === "trailer"}">נגרר<small>פתוח עד 750 ק״ג</small></button></div></div>
    <div class="f"><label>אתר</label><input type="text" id="eSite" value="${esc(eq.site || "")}" list="siteOpts" placeholder="באיזה אתר הכלי נמצא">${siteList("siteOpts")}</div>
    <div class="f"><label>שם / כינוי באתר</label><input type="text" id="eName" value="${esc(eq.name)}" placeholder="למשל: מיול 2, נגרר כלים"></div>
    <div class="grid2"><div class="f"><label>מס׳ רישוי</label><input type="text" id="ePlate" value="${esc(eq.plate)}" inputmode="numeric" style="direction:ltr"></div><div class="f"><label>דגם / יצרן</label><input type="text" id="eModel" value="${esc(eq.model || "")}"></div></div>
    <div id="toolFields" ${eq.kind === "tool" ? "" : "hidden"}>
      <div class="grid3"><div class="f"><label>שעות מנוע כעת</label><input type="number" id="eHours" value="${esc(eq.hours)}" inputmode="numeric" min="0"></div>
      <div class="f"><label>טיפול כל (שעות)</label><input type="number" id="eInterval" value="${esc(eq.interval || DEFAULT_INTERVAL)}" inputmode="numeric" min="1"></div>
      <div class="f"><label>טיפול אחרון בשעות</label><input type="number" id="eLastSvc" value="${esc(eq.lastServiceHours)}" inputmode="numeric" min="0"></div></div>
      <div class="f"><label>תאריך הטיפול האחרון</label><input type="date" id="eLastSvcDate" value="${esc(eq.lastServiceDate || "")}"></div>
    </div>
    <h3>תוקף (לעדכן את אלירן שבועיים מראש)</h3>
    <div class="grid3">${EXPIRIES.map(e => `<div class="f"><label>${e.label}</label><input type="date" id="x_${e.key}" value="${esc(eq[e.key] || "")}"></div>`).join("")}</div>
    <div class="f"><label>הערה</label><input type="text" id="eNote" value="${esc(eq.note || "")}" placeholder="מיקום קבוע, מפעיל, מה שצריך לדעת"></div>
    ${isNew ? "" : `<div class="f"><label><input type="checkbox" id="eActive" ${eq.active !== false ? "checked" : ""} style="width:auto;min-height:0;margin-inline-end:8px">פעיל באתר (נכלל בבדיקה השבועית)</label></div>`}
    <button type="button" class="add" id="eSave">שמירה</button>`;
  const sh = openSheet(h);
  let kind = eq.kind;
  sh.querySelectorAll("[data-kind]").forEach(b => b.onclick = () => { kind = b.dataset.kind; sh.querySelectorAll("[data-kind]").forEach(x => x.setAttribute("aria-pressed", x.dataset.kind === kind)); sh.querySelector("#toolFields").hidden = kind !== "tool"; });
  sh.querySelector("#eSave").onclick = async () => {
    const name = sh.querySelector("#eName").value.trim(); if (!name){ toast("צריך שם", "bad"); sh.querySelector("#eName").focus(); return; }
    const num = id => { const v = sh.querySelector(id).value.trim(); return v === "" ? "" : Number(v); };
    const site = sh.querySelector("#eSite").value.trim(); if (!site){ toast("צריך לכתוב מאיזה אתר", "bad"); sh.querySelector("#eSite").focus(); return; }
    const out = { ...eq, kind, site, name, plate: sh.querySelector("#ePlate").value.trim(), model: sh.querySelector("#eModel").value.trim(), note: sh.querySelector("#eNote").value.trim(),
      hours: kind === "tool" ? num("#eHours") : "", interval: kind === "tool" ? (num("#eInterval") || DEFAULT_INTERVAL) : "", lastServiceHours: kind === "tool" ? num("#eLastSvc") : "", lastServiceDate: kind === "tool" ? sh.querySelector("#eLastSvcDate").value : "",
      active: isNew ? true : sh.querySelector("#eActive").checked };
    for (const e of EXPIRIES) out[e.key] = sh.querySelector("#x_" + e.key).value;
    try { await saveEquipment(out); closeSheet(); toast(isNew ? "נוסף לרשימה" : "נשמר"); } catch (e){ toast("השמירה נכשלה: " + (e.message || e), "bad"); }
  };
}
function recordService(eq){
  const svc = serviceState(eq, state.checks);
  const sh = openSheet(`<h2>רישום טיפול מוסך · ${esc(eq.name)}</h2>
    <div class="grid2"><div class="f"><label>תאריך</label><input type="date" id="sDate" value="${isoDate()}"></div><div class="f"><label>שעות מנוע בטיפול</label><input type="number" id="sHours" value="${svc ? svc.hours : ""}" inputmode="numeric"></div></div>
    <div class="f"><label>מוסך</label><input type="text" id="sGarage" value="${esc(eq.lastGarage || "")}" placeholder="שם המוסך המורשה"></div>
    <div class="f"><label>מה בוצע</label><textarea id="sNote" placeholder="שמנים, פילטרים, בלמים..."></textarea></div>
    <p class="note">הטיפול הבא ייקבע ל-${fmtNum((svc ? svc.hours : 0) + (Number(eq.interval) || DEFAULT_INTERVAL))} שעות לפי השעות שתרשום.</p>
    <button type="button" class="add" id="sSave">שמירה</button>`);
  sh.querySelector("#sSave").onclick = async () => {
    const hours = Number(sh.querySelector("#sHours").value), date = sh.querySelector("#sDate").value;
    if (!date || isNaN(hours)){ toast("צריך תאריך ושעות", "bad"); return; }
    try {
      await saveService({ eqId: eq.id, date, hours, garage: sh.querySelector("#sGarage").value.trim(), note: sh.querySelector("#sNote").value.trim() });
      await saveEquipment({ ...eq, lastServiceHours: hours, lastServiceDate: date, lastGarage: sh.querySelector("#sGarage").value.trim(), hours: Math.max(Number(eq.hours) || 0, hours) });
      closeSheet(); toast("הטיפול נרשם");
    } catch (e){ toast("השמירה נכשלה", "bad"); }
  };
}
function updateHours(eq){
  const sh = openSheet(`<h2>עדכון שעות מנוע · ${esc(eq.name)}</h2><div class="f"><label>שעות מנוע כעת</label><input type="number" id="uHours" value="${serviceState(eq, state.checks).hours}" inputmode="numeric"></div><button type="button" class="add" id="uSave">שמירה</button>`);
  sh.querySelector("#uSave").onclick = async () => { const v = Number(sh.querySelector("#uHours").value); if (isNaN(v)){ toast("מספר לא תקין", "bad"); return; } try { await saveEquipment({ ...eq, hours: v }); closeSheet(); toast("עודכן"); } catch { toast("השמירה נכשלה", "bad"); } };
}
