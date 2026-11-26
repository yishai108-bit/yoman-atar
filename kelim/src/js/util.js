// עזרים: תאריכים (שבוע ישראלי א׳–ש׳), בריחת HTML, מזהים
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const uid = (p = "") => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const pad2 = n => String(n).padStart(2, "0");
// YYYY-MM-DD בזמן מקומי
export function isoDate(d = new Date()){ return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
export function parseDate(s){ if (!s) return null; const [y, m, d] = s.split("-").map(Number); if (!y || !m || !d) return null; return new Date(y, m - 1, d); }
export function fmtDate(s){ const d = parseDate(s); return d ? pad2(d.getDate()) + "." + pad2(d.getMonth() + 1) + "." + d.getFullYear() : "—"; }
export function fmtShort(s){ const d = parseDate(s); return d ? d.getDate() + "." + (d.getMonth() + 1) : "—"; }
export function addDays(s, n){ const d = parseDate(s); d.setDate(d.getDate() + n); return isoDate(d); }
export function daysUntil(s, today = isoDate()){ const a = parseDate(s), b = parseDate(today); if (!a || !b) return null; return Math.round((a - b) / 86400000); }
// תחילת השבוע (יום ראשון) של תאריך
export function weekStart(s = isoDate()){ const d = parseDate(s); d.setDate(d.getDate() - d.getDay()); return isoDate(d); }
export function weekEnd(s = isoDate()){ return addDays(weekStart(s), 6); }
export function inWeek(dateStr, ref = isoDate()){ return dateStr >= weekStart(ref) && dateStr <= weekEnd(ref); }
export const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
export function fmtNum(n){ return n === null || n === undefined || n === "" || isNaN(n) ? "—" : Number(n).toLocaleString("he-IL"); }
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function el(html){ const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; }
export function toast(msg, kind = ""){
  let t = $("#toast"); if (!t){ t = el('<div id="toast" role="status" aria-live="polite"></div>'); document.body.appendChild(t); }
  t.textContent = msg; t.className = "show " + kind; clearTimeout(t._h); t._h = setTimeout(() => t.className = "", 2600);
}
