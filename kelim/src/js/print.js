// הדפסה / PDF: הטופס במבנה המקורי, דף לכל בדיקה, לקלסר ולישיבה הלוגיסטית
import { state, eqById } from "./store.js";
import { PRINT_CSS } from "./print-css.js";
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
// מסמך עצמאי של הטופס (נפתח בחלון חדש או יורד כקובץ): צילומים מוטמעים לפי כתובת מלאה כדי שייפתחו גם מחוץ לכלי
export function standaloneDoc(html, title){
  const abs = html.replace(/src="\/_blob\//g, 'src="' + location.origin + "/_blob/");
  return "<!doctype html><html lang=\"he\" dir=\"rtl\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>" + esc(title) + "</title><style>" + PRINT_CSS + "</style></head><body><div class=\"bar\"><button type=\"button\" onclick=\"window.print()\">🖨 הדפסה / שמירה כ-PDF</button><span>אפשר גם דרך תפריט הדפדפן: שיתוף ← הדפסה</span></div>" + abs + "</body></html>";
}
export const PRINT_MODE = { last: "" };
function run(html, title = "טופס בדיקה"){
  const doc = standaloneDoc(html, title);
  // 1. חלון חדש: לא כפוף למגבלת ההדפסה של מסגרת הארטיפקט
  let w = null; try { w = window.open("", "_blank"); } catch { w = null; }
  if (w && !w.closed){
    try { w.document.open(); w.document.write(doc); w.document.close(); w.focus(); PRINT_MODE.last = "window"; return; } catch {}
  }
  // 2. הורדת קובץ HTML (נפתח בדפדפן ומודפס משם)
  if (state.downloads){
    PRINT_MODE.last = "download";
    state.downloads.save({ filename: title.replace(/[\\/:*?"<>|]/g, "-") + ".html", data: doc }).then(() => toast("הקובץ ירד; פתח אותו והדפס / שמור כ-PDF")).catch(e => { if (!(e && e.code === "not_granted")) inPage(html); });
    return;
  }
  inPage(html);
}
function inPage(html){
  PRINT_MODE.last = "inpage";
  const area = document.getElementById("printArea"); area.innerHTML = html;
  const done = () => { area.innerHTML = ""; window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done);
  // תמונות (חתימה, צילומים) צריכות להיטען לפני ההדפסה
  const imgs = [...area.querySelectorAll("img")].filter(i => !i.complete);
  Promise.all(imgs.map(i => new Promise(r => { i.onload = i.onerror = r; }))).then(() => setTimeout(() => { try { window.print(); } catch { toast("ההדפסה לא נפתחה", "bad"); } }, 50));
}
export function printChecks(ids){ const cs = ids.map(id => state.checks.find(c => c.id === id)).filter(Boolean); if (!cs.length){ toast("אין מה להדפיס", "bad"); return; } run(cs.map(c => formHtml(c, eqById(c.eqId))).join(""), cs.length === 1 ? "טופס בדיקה " + ((eqById(cs[0].eqId) || {}).name || cs[0].eqName || "") + " " + fmtDate(cs[0].date) : "טפסי בדיקה " + fmtDate(cs[0].date) + " (" + cs.length + ")"); }
export function printWeek(ref = isoDate()){
  const cs = state.checks.filter(c => c.date >= weekStart(ref) && c.date <= weekEnd(ref)).sort((a, b) => ((eqById(a.eqId) || {}).name || "").localeCompare((eqById(b.eqId) || {}).name || "", "he") || a.date.localeCompare(b.date));
  if (!cs.length){ toast("אין בדיקות השבוע", "bad"); return; } printChecks(cs.map(c => c.id));
}
export function printBlank(kind){ run(formHtml({ kind, site: "", items: {}, notes: {} }, null), KINDS[kind].formTitle + " (ריק)"); }
