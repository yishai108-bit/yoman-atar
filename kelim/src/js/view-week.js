// לשונית «השבוע»: מה נבדק, מה לא, ליקויים פתוחים, טיפולים ותפוגות
import { state, sites } from "./store.js";
import { esc, fmtDate, weekStart, weekEnd, fmtShort, isoDate, fmtNum } from "./util.js";
import { equipmentStatus } from "./logic.js";
import { KINDS, SUMMARY_LABEL } from "./forms.js";
import { openCheckChooser } from "./view-check.js";
import { editEquipment } from "./view-eq.js";
import { printWeek } from "./print.js";

export function statuses(){ const today = isoDate(); return state.equipment.filter(e => e.active !== false).map(e => equipmentStatus(e, state.checks, state.defects, today)); }

let siteFilter = "";
export function renderWeek(root, nav){
  const allSites = sites(); if (siteFilter && !allSites.includes(siteFilter)) siteFilter = "";
  const st = statuses().filter(s => !siteFilter || (s.eq.site || "") === siteFilter);
  const openDefects = state.defects.filter(d => d.status !== "closed");
  const checked = st.filter(s => s.checkedThisWeek), notChecked = st.filter(s => !s.checkedThisWeek);
  const svcAlerts = st.filter(s => s.svc && s.svc.state !== "ok");
  const expAlerts = st.flatMap(s => s.exps.filter(e => e.state !== "ok").map(e => ({ ...e, eq: s.eq })));
  const weekChecks = state.checks.filter(c => c.date >= weekStart() && c.date <= weekEnd());
  let h = allSites.length > 1 ? `<div class="filters" id="siteFilters"><button type="button" data-site="" aria-pressed="${!siteFilter}">כל האתרים</button>${allSites.map(s => `<button type="button" data-site="${esc(s)}" aria-pressed="${siteFilter === s}">${esc(s)}</button>`).join("")}</div>` : "";
  h += `<div class="sechead"><span>שבוע ${fmtShort(weekStart())}–${fmtShort(weekEnd())}</span><span>${st.length} ${st.length === 1 ? "פריט" : "פריטים"} בבעלות BELECTRIC</span></div>`;
  if (!st.length && !allSites.length){
    h += `<button type="button" class="add" id="btnNewCheck" ${state.canWrite ? "" : "disabled"}>📋 בדיקה שבועית חדשה</button>
      <div class="empty">ממלאים את הטופס בטלפון: בוחרים כלי או נגרר, מסמנים V/X לכל סעיף, חותמים ושומרים. הכלי נוסף לרשימה מתוך הטופס הראשון שלו.<br>אפשר גם להוסיף כלים מראש, עם שעות מנוע ותאריכי תוקף.</div>
      <div class="row2"><button type="button" class="ghost" id="btnFirstEq" ${state.canWrite ? "" : "disabled"}>＋ הוספת כלי או נגרר</button><button type="button" class="ghost" data-go="history">🖨 טופס ריק להדפסה</button></div>`;
    root.innerHTML = h; root.querySelector("#btnNewCheck").onclick = () => openCheckChooser(); root.querySelector("#btnFirstEq").onclick = () => editEquipment(null); root.querySelector("[data-go]").onclick = () => nav("history"); return;
  }
  h += `<div class="stats">
    <div class="stat ${notChecked.length ? "warn" : "ok"}"><div class="v num">${checked.length}/${st.length}</div><div class="k">נבדקו השבוע</div></div>
    <div class="stat ${openDefects.length ? "bad" : "ok"}"><div class="v num">${openDefects.length}</div><div class="k">ליקויים פתוחים</div></div>
    <div class="stat ${svcAlerts.some(s => s.svc.state === "due") || expAlerts.some(e => e.state === "expired") ? "bad" : (svcAlerts.length + expAlerts.length) ? "warn" : "ok"}"><div class="v num">${svcAlerts.length + expAlerts.length}</div><div class="k">טיפולים ותפוגות</div></div>
  </div>`;
  h += `<button type="button" class="add" id="btnNewCheck">📋 בדיקה שבועית חדשה</button>
    <div class="row2"><button type="button" class="ghost" id="btnPrintWeek" ${weekChecks.length ? "" : "disabled"}>🖨 הדפסת טפסי השבוע (${weekChecks.length})</button><button type="button" class="ghost" data-go="remind">🔔 תזכורת ליומן</button></div>`;
  if (notChecked.length){
    h += `<div class="sechead"><span>עוד לא נבדקו השבוע</span><span>${notChecked.length}</span></div><div class="list">`;
    for (const s of notChecked) h += row(s, `<button type="button" class="ghost small" data-check="${s.eq.id}">למלא טופס</button>`);
    h += `</div>`;
  }
  if (svcAlerts.length || expAlerts.length){
    h += `<div class="sechead"><span>טיפולים ותפוגות</span></div><div class="list">`;
    for (const s of svcAlerts) h += `<div class="rec ${s.svc.state === "due" ? "bad" : "warn"}" style="cursor:default"><div class="ttl">${esc(s.eq.name)} · טיפול ${fmtNum(s.svc.next)} שעות</div>
      <div class="meta"><span>שעות מנוע כעת <b class="num">${fmtNum(s.svc.hours)}</b></span><span>${s.svc.state === "due" ? "חלף המועד ב-" + fmtNum(-s.svc.left) + " שעות" : "נותרו " + fmtNum(s.svc.left) + " שעות"}</span><span>לעדכן את דנה / מחמוד ולתאם מוסך</span></div>
      <div class="side"><button type="button" class="ghost small" data-eq="${s.eq.id}">פרטים</button></div></div>`;
    for (const e of expAlerts) h += `<div class="rec ${e.state === "expired" ? "bad" : "warn"}" style="cursor:default"><div class="ttl">${esc(e.eq.name)} · ${e.label}</div>
      <div class="meta"><span>${e.state === "expired" ? "פג ב-" + fmtDate(e.date) : "פג ב-" + fmtDate(e.date) + " (עוד " + e.days + " ימים)"}</span><span>לעדכן את אלירן, קצין הרכב: <a href="tel:0548963036">054-8963036</a></span></div>
      <div class="side"><button type="button" class="ghost small" data-eq="${e.eq.id}">פרטים</button></div></div>`;
    h += `</div>`;
  }
  if (checked.length){
    h += `<div class="sechead"><span>נבדקו השבוע</span><span>${checked.length}</span></div><div class="list">`;
    for (const s of checked) h += row(s, `<button type="button" class="ghost small" data-open="${s.last.id}">הטופס</button>`);
    h += `</div>`;
  }
  root.innerHTML = h;
  root.querySelectorAll("[data-site]").forEach(b => b.onclick = () => { siteFilter = b.dataset.site; renderWeek(root, nav); });
  root.querySelector("#btnNewCheck").onclick = () => openCheckChooser();
  const pw = root.querySelector("#btnPrintWeek"); if (pw) pw.onclick = () => printWeek();
  root.querySelectorAll("[data-go]").forEach(b => b.onclick = () => nav(b.dataset.go));
  root.querySelectorAll("[data-check]").forEach(b => b.onclick = e => { e.stopPropagation(); openCheckChooser(b.dataset.check); });
  root.querySelectorAll("[data-eq]").forEach(b => b.onclick = e => { e.stopPropagation(); nav("eq", b.dataset.eq); });
  root.querySelectorAll("[data-open]").forEach(b => b.onclick = e => { e.stopPropagation(); nav("history", b.dataset.open); });
}
function row(s, action){
  const k = KINDS[s.eq.kind];
  const meta = [`<span>${k.label}${s.eq.site ? " · " + esc(s.eq.site) : ""}${s.eq.plate ? " · <span class=num>" + esc(s.eq.plate) + "</span>" : ""}</span>`];
  if (s.last) meta.push(`<span>בדיקה אחרונה ${fmtDate(s.last.date)} · ${SUMMARY_LABEL[s.last.summary] || ""}</span>`); else meta.push(`<span>עוד לא נבדק</span>`);
  if (s.open.length) meta.push(`<span style="color:var(--clay);font-weight:700">${s.open.length} ליקויים פתוחים</span>`);
  if (s.svc && s.eq.kind === "tool") meta.push(`<span class="num">${fmtNum(s.svc.hours)} שעות</span>`);
  return `<div class="rec ${s.level}" style="cursor:default"><div class="ttl">${esc(s.eq.name)}</div><div class="meta">${meta.join("")}</div><div class="side">${action}</div></div>`;
}
