// הדפסה / PDF: הטופס במבנה המקורי, דף לכל בדיקה, לקלסר ולישיבה הלוגיסטית
import { state, eqById } from "./store.js";
import { esc, fmtDate, fmtNum, weekStart, weekEnd, isoDate, toast } from "./util.js";
import { KINDS, SUMMARY } from "./forms.js";

export function formHtml(c, eq){
  const k = KINDS[c.kind]; const blank = !c.id; const tool = c.kind === "tool";
  const hdr = tool
    ? [["תפקיד הבודק", c.role], ["שם הבודק", c.inspector], ["תאריך", blank ? "" : fmtDate(c.date)], ["אתר", c.site], ["שעות מנוע", blank ? "" : fmtNum(c.hours)], ["מס׳ רישוי", c.plate]]
    : [["שם האתר", c.site], ["תאריך", blank ? "" : fmtDate(c.date)], ["מספר רישוי", c.plate], ["שם הבודק", c.inspector], ["", ""], ["", ""]];
  let h = `<section class="pform"><div class="ph"><div class="brand">BELECTRIC<small>לוגיסטיקה</small></div><div style="font-size:9pt;color:#666">${esc(eq ? eq.name : c.eqName || "")}</div></div>
    <h1>${esc(k.formTitle)}</h1>
    <div class="hdr">${hdr.map(([l, v]) => l ? `<div><b>${l}:</b> ${esc(v || "")}</div>` : "<div style='border:0'></div>").join("")}</div>`;
  if (tool) h += `<div class="legend">סמן V או X לפי הממצאים ופרט בהערות לתיקון (V – תקין, X – לא תקין, יש לפרט).</div>`;
  h += `<table><thead><tr>${tool ? `<th>${esc(k.sub)}</th><th style="width:14mm;text-align:center">V או X</th><th class="notes">הערות</th>` : `<th>סעיף לבדיקה</th><th style="width:12mm;text-align:center">תקין</th><th style="width:14mm;text-align:center">לא תקין</th><th class="notes">הערות</th>`}</tr></thead><tbody>`;
  for (const g of k.groups){
    if (g.title) h += `<tr class="grp"><td colspan="${tool ? 3 : 4}">${esc(g.title)}</td></tr>`;
    for (const it of g.items){
      const v = (c.items || {})[it.key]; const note = esc((c.notes || {})[it.key] || "");
      h += tool ? `<tr><td>${esc(it.text)}</td><td class="vx ${v || ""}">${v === "ok" ? "V" : v === "bad" ? "X" : ""}</td><td class="notes">${note}</td></tr>`
        : `<tr><td>${esc(it.text)}</td><td class="vx ok">${v === "ok" ? "☑" : "☐"}</td><td class="vx bad">${v === "bad" ? "☒" : "☐"}</td><td class="notes">${note}</td></tr>`;
    }
  }
  h += `</tbody></table>
    <div style="font-weight:700;font-size:10.5pt">סיכום הבדיקה</div>
    <div class="sum">${SUMMARY.map(s => `<div class="box ${c.summary === s.key ? "on" : ""}">${c.summary === s.key ? "☑" : "☐"} ${s.text}</div>`).join("")}</div>
    <div class="lines"><div><b>פירוט ליקויים:</b> ${esc(c.defectsText || "")}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><span><b>אחראי לטיפול:</b> ${esc(c.owner || "")}</span><span><b>תאריך יעד:</b> ${c.due ? fmtDate(c.due) : ""}</span></div></div>
    <div class="psig"><b>חתימת הבודק:</b> ${c.signature ? `<img src="${c.signature}" alt="חתימה">` : `<span style="display:inline-block;width:50mm;border-bottom:1px solid #444">&nbsp;</span>`}</div>`;
  if (k.notes.length) h += `<div class="notes-list"><b>דגשים:</b>${k.notes.map(n => `<div>• ${esc(n)}</div>`).join("")}</div>`;
  if ((c.photos || []).length) h += `<div class="photos">${c.photos.map(p => `<img src="/_blob/${esc(p)}" alt="צילום">`).join("")}</div>`;
  h += `<div class="ft"><span>בקרת כלים ונגררים · BELECTRIC לוגיסטיקה</span><span>${blank ? "" : "נשמר במערכת " + fmtDate((c.createdAt || "").slice(0, 10) || c.date) + " · הודפס " + fmtDate(isoDate())}</span></div></section>`;
  return h;
}
function run(html){
  const area = document.getElementById("printArea"); area.innerHTML = html;
  const done = () => { area.innerHTML = ""; window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done);
  // תמונות (חתימה, צילומים) צריכות להיטען לפני ההדפסה
  const imgs = [...area.querySelectorAll("img")].filter(i => !i.complete);
  Promise.all(imgs.map(i => new Promise(r => { i.onload = i.onerror = r; }))).then(() => setTimeout(() => { try { window.print(); } catch { toast("ההדפסה לא נפתחה", "bad"); } }, 50));
}
export function printChecks(ids){ const cs = ids.map(id => state.checks.find(c => c.id === id)).filter(Boolean); if (!cs.length){ toast("אין מה להדפיס", "bad"); return; } run(cs.map(c => formHtml(c, eqById(c.eqId))).join("")); }
export function printWeek(ref = isoDate()){
  const cs = state.checks.filter(c => c.date >= weekStart(ref) && c.date <= weekEnd(ref)).sort((a, b) => ((eqById(a.eqId) || {}).name || "").localeCompare((eqById(b.eqId) || {}).name || "", "he") || a.date.localeCompare(b.date));
  if (!cs.length){ toast("אין בדיקות השבוע", "bad"); return; } printChecks(cs.map(c => c.id));
}
export function printBlank(kind){ run(formHtml({ kind, site: state.settings.site || "", items: {}, notes: {} }, null)); }
