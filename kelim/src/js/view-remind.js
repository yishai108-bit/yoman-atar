// לשונית «תזכורות»: אירוע חוזר ליומן גוגל (קישור / ICS), תפוגות וטיפולים קרובים, קישור לטופס המילוי
import { state, saveSettings } from "./store.js";
import { esc, DAYS, fmtDate, toast } from "./util.js";
import { reminderEvents, gcalLink, icsCalendar } from "./logic.js";

export function renderRemind(root){
  const s = state.settings; const evs = reminderEvents(s, state.equipment, state.checks);
  const weekly = evs[0], others = evs.slice(1);
  const share = s.shareUrl || "";
  let h = `<div class="card"><h2>בדיקה שבועית חוזרת <small>יומן גוגל</small></h2>
    <div class="grid2"><div class="f"><label>יום</label><select id="rDow" ${state.canWrite ? "" : "disabled"}>${DAYS.map((d, i) => `<option value="${i}" ${i === (s.weeklyDow ?? 0) ? "selected" : ""}>יום ${d}</option>`).join("")}</select></div><div class="f"><label>שעה</label><input type="time" id="rTime" value="${esc(s.weeklyTime || "07:30")}" ${state.canWrite ? "" : "disabled"}></div></div>
    <p class="note">אירוע חוזר כל שבוע, שעה אחת, עם התראה 15 דקות לפני: «${esc(weekly.title)}».</p>
    <div class="row2" style="margin-top:10px"><a class="ghost" href="${esc(gcalLink(weekly))}" target="_blank" rel="noopener">📅 הוספה ליומן גוגל</a><button type="button" class="ghost" id="icsWeekly">⬇ קובץ ליומן (ICS)</button></div></div>`;
  h += `<div class="card"><h2>תפוגות וטיפולים קרובים <small>${others.length}</small></h2>`;
  h += others.length ? `<div class="list">${others.map(e => `<div class="rec warn" style="cursor:default"><div class="ttl" style="font-size:.9rem">${esc(e.title)}</div><div class="meta"><span class="num">${fmtDate(e.date)}</span><span>${esc(e.desc || "")}</span></div><div class="side"><a class="ghost small" href="${esc(gcalLink(e))}" target="_blank" rel="noopener">📅 ליומן</a></div></div>`).join("")}</div>
      <div class="row2" style="margin-top:10px"><button type="button" class="ghost" id="icsAll">⬇ כל התזכורות כקובץ ICS</button></div>`
    : `<p class="note">אין כרגע תפוגות בטווח שבועיים או טיפולים שמתקרבים. התזכורות נוצרות אוטומטית מתאריכי הרישיון/ביטוח/תסקיר ומשעות המנוע של כל כלי.</p>`;
  h += `</div>`;
  h += `<div class="card"><h2>קישור לטופס המילוי השבועי</h2>
    <p class="note">הקישור פותח את הכלי הזה בטלפון; כפתור «בדיקה שבועית חדשה» הוא הטופס. אפשר לשלוח ללוגיסטיקן או למנהל האתר.</p>
    ${share ? `<div class="copy" style="margin-top:8px"><input type="text" id="shareUrl" value="${esc(share)}" readonly><button type="button" class="ghost small" id="copyShare">העתקה</button></div>
      <div class="row2" style="margin-top:8px"><a class="ghost" href="https://wa.me/?text=${encodeURIComponent("טופס בדיקה שבועית לכלים ונגררים – " + (s.site || "") + "\n" + share)}" target="_blank" rel="noopener">שליחה בוואטסאפ</a></div>`
    : `<p class="note warn">הקישור יופיע כאן אחרי הפרסום (נשמר בהגדרות).</p>`}</div>`;
  root.innerHTML = h;
  const save = async () => { try { await saveSettings({ weeklyDow: Number(root.querySelector("#rDow").value), weeklyTime: root.querySelector("#rTime").value || "07:30" }); } catch { toast("לא נשמר", "bad"); } };
  root.querySelector("#rDow").onchange = save; root.querySelector("#rTime").onchange = save;
  root.querySelector("#icsWeekly").onclick = () => downloadIcs("בדיקה-שבועית-כלים.ics", icsCalendar([weekly]));
  const all = root.querySelector("#icsAll"); if (all) all.onclick = () => downloadIcs("תזכורות-כלים-ונגררים.ics", icsCalendar(evs));
  const cp = root.querySelector("#copyShare"); if (cp) cp.onclick = async () => { try { await navigator.clipboard.writeText(share); toast("הועתק"); } catch { root.querySelector("#shareUrl").select(); toast("לא ניתן להעתיק אוטומטית, סמן והעתק", "bad"); } };
}
export async function downloadIcs(filename, text){
  if (state.downloads){ try { await state.downloads.save({ filename, data: text }); return; } catch (e){ if (e && e.code === "not_granted") return; } }
  try {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/calendar;charset=utf-8" })); a.download = filename; a.rel = "noopener"; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); if (a.parentNode) a.parentNode.removeChild(a); }, 2000);
  } catch { toast("ההורדה לא נפתחה", "bad"); }
}
