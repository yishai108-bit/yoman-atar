// הגדרות: שם האתר, מרווח טיפולים, קישור לשיתוף
import { state, saveSettings } from "./store.js";
import { esc, toast } from "./util.js";
import { openSheet, closeSheet } from "./sheet.js";
import { DEFAULT_INTERVAL } from "./forms.js";

export function openSettings(){
  const s = state.settings;
  const sh = openSheet(`<h2>הגדרות</h2>
    <div class="f"><label>שם האתר (מופיע בטופס)</label><input type="text" id="sSite" value="${esc(s.site || "")}" ${state.canWrite ? "" : "disabled"}></div>
    <div class="f"><label>טיפול מוסך כל (שעות מנוע) · ברירת מחדל לכלי חדש</label><input type="number" id="sInt" value="${esc(s.interval || DEFAULT_INTERVAL)}" inputmode="numeric" ${state.canWrite ? "" : "disabled"}></div>
    <div class="f"><label>קישור לכלי (לשיתוף ולטופס)</label><input type="text" id="sUrl" value="${esc(s.shareUrl || "")}" style="direction:ltr" placeholder="https://claude.ai/artifact/…" ${state.canWrite ? "" : "disabled"}></div>
    <p class="note">${state.me ? "מחובר: " + esc(state.me.name || "") : "לא מזוהה"} · ${state.canWrite ? "הרשאת כתיבה" : "קריאה בלבד"} · ${state.equipment.length} פריטים, ${state.checks.length} בדיקות, ${state.defects.filter(d => d.status !== "closed").length} ליקויים פתוחים</p>
    <button type="button" class="add" id="sSave" ${state.canWrite ? "" : "disabled"}>שמירה</button>`);
  sh.querySelector("#sSave").onclick = async () => {
    try { await saveSettings({ site: sh.querySelector("#sSite").value.trim(), interval: Number(sh.querySelector("#sInt").value) || DEFAULT_INTERVAL, shareUrl: sh.querySelector("#sUrl").value.trim() }); closeSheet(); toast("נשמר"); }
    catch { toast("לא נשמר", "bad"); }
  };
}
