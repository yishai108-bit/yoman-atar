// לשונית «בדיקות»: כל הטפסים שנשמרו, צפייה והדפסה
import { state, eqById, deleteCheck } from "./store.js";
import { esc, fmtDate, fmtNum, toast } from "./util.js";
import { KINDS, SUMMARY_LABEL, itemText } from "./forms.js";
import { countItems } from "./logic.js";
import { openSheet, closeSheet, confirmBox } from "./sheet.js";
import { printChecks, printBlank } from "./print.js";

export function renderHistory(root, nav, openId){
  const list = state.checks.slice().sort((a, b) => (b.date + (b.createdAt || "")).localeCompare(a.date + (a.createdAt || "")));
  let h = `<div class="row2"><button type="button" class="ghost" id="blankTool">🖨 טופס ריק · כלי</button><button type="button" class="ghost" id="blankTrailer">🖨 טופס ריק · נגרר</button></div>`;
  if (!list.length) h += `<div class="empty">עוד לא נשמרו בדיקות. כל טופס שנשמר נשאר כאן, מודפס לקלסר ומצטרף לביקורת הרבעונית של אלירן.</div>`;
  let month = "";
  for (const c of list){
    const m = c.date.slice(0, 7); if (m !== month){ month = m; h += `<div class="sechead"><span>${monthName(m)}</span></div><div class="list" style="margin-bottom:10px">`; }
    const eq = eqById(c.eqId); const n = countItems(c.items);
    h += `<button type="button" class="rec ${c.summary === "ok" ? "ok" : c.summary === "down" ? "bad" : "warn"}" data-open="${c.id}"><div class="ttl">${esc(eq ? eq.name : c.eqName || "—")}</div>
      <div class="meta"><span class="num">${fmtDate(c.date)}</span><span>${esc(c.inspector || "")}</span><span>${n.ok} תקין${n.bad ? " · <b style='color:var(--clay)'>" + n.bad + " לא תקין</b>" : ""}</span>${c.hours ? `<span class="num">${fmtNum(c.hours)} שעות</span>` : ""}</div>
      <div class="side"><span class="chip ${c.summary === "ok" ? "c-ok" : c.summary === "down" ? "c-bad" : "c-warn"}">${SUMMARY_LABEL[c.summary] || ""}</span></div></button>`;
    const next = list[list.indexOf(c) + 1]; if (!next || next.date.slice(0, 7) !== m) h += `</div>`;
  }
  root.innerHTML = h;
  root.querySelector("#blankTool").onclick = () => printBlank("tool");
  root.querySelector("#blankTrailer").onclick = () => printBlank("trailer");
  root.querySelectorAll("[data-open]").forEach(b => b.onclick = () => showCheck(b.dataset.open));
  if (openId && state.checks.find(c => c.id === openId)) showCheck(openId);
}
const monthName = m => { const [y, mo] = m.split("-"); return ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"][Number(mo) - 1] + " " + y; };

export function showCheck(id){
  const c = state.checks.find(x => x.id === id); if (!c) return;
  const eq = eqById(c.eqId); const k = KINDS[c.kind];
  let h = `<h2>${esc(eq ? eq.name : c.eqName || "")} <small style="font-size:.8rem;color:var(--ink3)">${fmtDate(c.date)}</small></h2>
    <p class="note">${k.formTitle}<br>בודק: <b>${esc(c.inspector || "—")}</b>${c.role ? " (" + esc(c.role) + ")" : ""} · אתר: ${esc(c.site || "")}${c.plate ? " · מס׳ רישוי <span class=num>" + esc(c.plate) + "</span>" : ""}${k.hasHours ? " · שעות מנוע <b class=num>" + fmtNum(c.hours) + "</b>" : ""}</p>
    <table class="t" style="margin:10px 0"><tbody>`;
  for (const g of k.groups){
    if (g.title) h += `<tr><th colspan="3">${g.title}</th></tr>`;
    for (const it of g.items){ const v = (c.items || {})[it.key]; h += `<tr><td class="vmark ${v === "ok" ? "ok" : v === "bad" ? "bad" : ""}">${v === "ok" ? "V" : v === "bad" ? "X" : "–"}</td><td>${esc(it.text)}</td><td style="color:var(--ink3)">${esc((c.notes || {})[it.key] || "")}</td></tr>`; }
  }
  h += `</tbody></table>
    <p class="note"><b>סיכום:</b> <span class="chip ${c.summary === "ok" ? "c-ok" : c.summary === "down" ? "c-bad" : "c-warn"}">${SUMMARY_LABEL[c.summary] || "—"}</span>${c.defectsText ? "<br><b>פירוט ליקויים:</b> " + esc(c.defectsText) : ""}${c.owner ? "<br><b>אחראי לטיפול:</b> " + esc(c.owner) : ""}${c.due ? " · <b>תאריך יעד:</b> " + fmtDate(c.due) : ""}</p>
    ${c.signature ? `<p class="note"><b>חתימת הבודק:</b><br><img src="${c.signature}" alt="חתימה" style="height:60px;border-bottom:1px solid var(--line)"></p>` : ""}
    ${(c.photos || []).length ? `<div class="photos">${c.photos.map(p => `<a href="/_blob/${esc(p)}" target="_blank" rel="noopener"><img src="/_blob/${esc(p)}" alt="צילום"></a>`).join("")}</div>` : ""}
    <button type="button" class="add" id="pPrint">🖨 הדפסה / PDF לקלסר</button>
    <div class="row2"><button type="button" class="del" id="pDel" ${state.canWrite ? "" : "disabled"}>מחיקת הטופס</button></div>`;
  const sh = openSheet(h);
  sh.querySelector("#pPrint").onclick = () => printChecks([c.id]);
  sh.querySelector("#pDel").onclick = async () => { if (await confirmBox("למחוק את הטופס מ-" + fmtDate(c.date) + "? הליקויים שנפתחו ממנו נשארים.", { ok: "מחק", danger: true })){ try { await deleteCheck(c.id); closeSheet(); toast("נמחק"); } catch { toast("נכשל", "bad"); } } };
}
