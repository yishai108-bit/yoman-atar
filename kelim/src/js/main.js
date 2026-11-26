// נקודת הכניסה: חיבור למאגר, לשוניות, ניווט, תגיות
import { state, connect, onChange } from "./store.js";
import { $, $$ } from "./util.js";
import { renderWeek } from "./view-week.js";
import { renderEq } from "./view-eq.js";
import { renderDefects } from "./view-defects.js";
import { renderHistory } from "./view-history.js";
import { renderRemind } from "./view-remind.js";
import { openSettings } from "./settings.js";
import { openCheckChooser } from "./view-check.js";
import { equipmentStatus } from "./logic.js";
import { installCloud } from "./cloud.js";

if (__CLOUD__) installCloud();   // לינק רגיל (Vercel): אותו ממשק מאגר, בלי Claude

export const APP_VERSION = 5;
const VIEWS = { week: renderWeek, eq: renderEq, defects: renderDefects, history: renderHistory, remind: renderRemind };
let current = "week", arg = null;

export function nav(view, a){
  if (!VIEWS[view]) return; current = view; arg = a || null;
  $$("#tabs .tab").forEach(t => t.setAttribute("aria-selected", t.dataset.view === view));
  render(); arg = null;
}
function render(){
  const root = $("#view"); if (!root) return;
  if (!state.ready){ root.innerHTML = '<div class="empty">טוען…</div>'; return; }
  VIEWS[current](root, nav, arg);
  const open = state.defects.filter(d => d.status !== "closed").length;
  badge("#badgeDefects", open);
  const notChecked = state.equipment.filter(e => e.active !== false).filter(e => !equipmentStatus(e, state.checks, state.defects).checkedThisWeek).length;
  badge("#badgeWeek", notChecked);
  const nb = $("#netBar");
  if (state.offline){ nb.hidden = false; $("#netMsg").textContent = state.db ? "המאגר לא נענה; הנתונים אולי לא עדכניים." : (__CLOUD__ ? "אין חיבור למאגר הנתונים; בדקו את הקליטה ונסו שוב." : "אין חיבור למאגר הנתונים; פותחים את הכלי מתוך Claude."); } else nb.hidden = true;
}
function badge(sel, n){ const b = $(sel); if (!b) return; b.hidden = !n; b.textContent = n; }

function boot(){
  $("#verLabel").textContent = "v" + APP_VERSION;
  $$("#tabs .tab").forEach(t => t.onclick = () => nav(t.dataset.view));
  $("#btnSettings").onclick = openSettings;
  onChange(() => { $("#app").classList.remove("skel"); render(); });
  render();
  connect().catch(() => { state.ready = true; state.offline = true; render(); });
  // קישור ישיר לטופס: #check או #check/<מזהה כלי>
  const route = () => {
    const m = /^#check(?:\/([^/]+))?/.exec(location.hash || ""); if (!m) return;
    history.replaceState(null, "", location.pathname + location.search);
    const go = () => openCheckChooser(m[1]);
    if (state.ready) go(); else { const off = onChange(() => { if (state.ready){ off(); go(); } }); }
  };
  window.addEventListener("hashchange", route); route();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
window.__kelim = { state, nav };
