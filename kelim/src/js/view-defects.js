// לשונית «ליקויים»: פתוחים עד סגירה, היסטוריה של סגורים
import { state, saveDefect, eqById } from "./store.js";
import { esc, fmtDate, isoDate, toast, daysUntil } from "./util.js";
import { openSheet, closeSheet } from "./sheet.js";

let filter = "open";
export function renderDefects(root, nav){
  const all = state.defects.slice().sort((a, b) => (b.openedAt + b.id).localeCompare(a.openedAt + a.id));
  const open = all.filter(d => d.status !== "closed"), closed = all.filter(d => d.status === "closed");
  const list = filter === "open" ? open : closed;
  let h = `<div class="filters"><button type="button" data-f="open" aria-pressed="${filter === "open"}">פתוחים (${open.length})</button><button type="button" data-f="closed" aria-pressed="${filter === "closed"}">נסגרו (${closed.length})</button></div>`;
  if (filter === "open" && open.length) h += `<p class="note warn" style="margin:0 0 10px">לפי הנוהל: ליקוי מדווחים מיידית למנהל האתר ועוקבים עד סגירה. ליקוי בטיחותי = הכלי לא עובד עד תיקון.</p>`;
  if (!list.length) h += `<div class="empty">${filter === "open" ? "אין ליקויים פתוחים. כל סעיף שמסומן X בטופס בדיקה נפתח כאן אוטומטית." : "עוד לא נסגרו ליקויים."}</div>`;
  h += `<div class="list">`;
  for (const d of list){
    const eq = eqById(d.eqId); const late = d.due && d.status !== "closed" && daysUntil(d.due) < 0;
    h += `<div class="defrow ${d.severity === "down" ? "down" : ""} ${d.status === "closed" ? "closed" : ""}"><div class="t1">${esc(eq ? eq.name : "כלי שנמחק")} · ${esc(d.text)}</div>
      <div class="t2">${d.note ? esc(d.note) + " · " : ""}נפתח ${fmtDate(d.openedAt)}${d.owner ? " · אחראי: " + esc(d.owner) : ""}${d.due ? " · יעד " + fmtDate(d.due) + (late ? " <b style='color:var(--clay)'>(באיחור)</b>" : "") : ""}${d.status === "closed" ? " · <b style='color:var(--sage)'>נסגר " + fmtDate(d.closedAt) + "</b>" + (d.fixNote ? ": " + esc(d.fixNote) : "") : ""}</div>
      <div class="act">${d.severity === "down" && d.status !== "closed" ? '<span class="chip c-bad">מושבת</span>' : ""}${d.status !== "closed" ? `<button type="button" class="ghost small" data-close="${d.id}" ${state.canWrite ? "" : "disabled"}>סגירה</button>` : `<button type="button" class="link" data-reopen="${d.id}" ${state.canWrite ? "" : "disabled"}>פתיחה מחדש</button>`}</div></div>`;
  }
  h += `</div>`;
  root.innerHTML = h;
  root.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { filter = b.dataset.f; renderDefects(root, nav); });
  root.querySelectorAll("[data-close]").forEach(b => b.onclick = () => closeDefect(b.dataset.close));
  root.querySelectorAll("[data-reopen]").forEach(b => b.onclick = async () => { const d = state.defects.find(x => x.id === b.dataset.reopen); try { await saveDefect({ ...d, status: "open", closedAt: "", fixNote: "" }); toast("נפתח מחדש"); } catch { toast("נכשל", "bad"); } });
}
export function closeDefect(id){
  const d = state.defects.find(x => x.id === id); if (!d) return;
  const sh = openSheet(`<h2>סגירת ליקוי</h2><p class="note" style="margin-bottom:12px"><b>${esc(d.text)}</b>${d.note ? "<br>" + esc(d.note) : ""}</p>
    <div class="grid2"><div class="f"><label>תאריך סגירה</label><input type="date" id="cDate" value="${isoDate()}"></div><div class="f"><label>מי טיפל</label><input type="text" id="cBy" value="${esc(d.owner || "")}" placeholder="מוסך / שם"></div></div>
    <div class="f"><label>מה נעשה</label><textarea id="cNote" placeholder="תוקן / הוחלף / אושר כשיר"></textarea></div>
    <button type="button" class="add" id="cSave">סגירה</button>`);
  sh.querySelector("#cSave").onclick = async () => {
    try { await saveDefect({ ...d, status: "closed", closedAt: sh.querySelector("#cDate").value || isoDate(), closedBy: sh.querySelector("#cBy").value.trim(), fixNote: sh.querySelector("#cNote").value.trim() }); closeSheet(); toast("הליקוי נסגר"); }
    catch { toast("השמירה נכשלה", "bad"); }
  };
}
