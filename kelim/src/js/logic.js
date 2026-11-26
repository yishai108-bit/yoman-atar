// חישובים טהורים (בלי DOM ובלי מאגר): מצב כלי, כיסוי שבועי, ליקויים מתוך טופס, ICS. נבדקים ישירות ב-node.
import { DEFAULT_INTERVAL, SERVICE_SOON, EXPIRY_WARN_DAYS, EXPIRIES, itemText } from "./forms.js";
import { daysUntil, inWeek, isoDate, pad2, parseDate, addDays } from "./util.js";

// הבדיקה האחרונה של כלי
export function lastCheck(checks, eqId){
  return checks.filter(c => c.eqId === eqId).sort((a, b) => (b.date + (b.createdAt || "")).localeCompare(a.date + (a.createdAt || "")))[0] || null;
}
// שעות המנוע הידועות: הגבוה מבין הכלי עצמו והבדיקות
export function currentHours(eq, checks){
  let h = Number(eq.hours) || 0;
  for (const c of checks) if (c.eqId === eq.id && Number(c.hours) > h) h = Number(c.hours);
  return h;
}
// טיפול מוסך: {next, left, state: ok|soon|due}
export function serviceState(eq, checks){
  if (eq.kind !== "tool") return null;
  const interval = Number(eq.interval) || DEFAULT_INTERVAL;
  const last = Number(eq.lastServiceHours) || 0;
  const hours = currentHours(eq, checks);
  const next = last + interval;
  const left = next - hours;
  return { hours, next, left, interval, last, state: left <= 0 ? "due" : left <= SERVICE_SOON ? "soon" : "ok" };
}
// תפוגות רישיון/ביטוח/תסקיר: רשימת {key,label,date,days,state: ok|soon|expired}
export function expiryStates(eq, today = isoDate()){
  return EXPIRIES.filter(e => eq[e.key]).map(e => {
    const days = daysUntil(eq[e.key], today);
    return { ...e, date: eq[e.key], days, state: days < 0 ? "expired" : days <= EXPIRY_WARN_DAYS ? "soon" : "ok" };
  });
}
// מצב כולל של כלי לדאשבורד
export function equipmentStatus(eq, checks, defects, today = isoDate()){
  const last = lastCheck(checks, eq.id);
  const open = defects.filter(d => d.eqId === eq.id && d.status !== "closed");
  const svc = serviceState(eq, checks);
  const exps = expiryStates(eq, today);
  const checkedThisWeek = !!last && inWeek(last.date, today);
  const down = open.some(d => d.severity === "down") || (last && last.summary === "down" && open.length > 0);
  let level = "ok";
  if (down || (svc && svc.state === "due") || exps.some(e => e.state === "expired")) level = "bad";
  else if (open.length || !checkedThisWeek || (svc && svc.state === "soon") || exps.some(e => e.state === "soon")) level = "warn";
  return { eq, last, open, svc, exps, checkedThisWeek, down, level };
}
// ליקויים חדשים מתוך טופס שמור: סעיף X אחד = ליקוי אחד (בלי לשכפל ליקוי פתוח על אותו סעיף)
export function defectsFromCheck(check, existingOpen){
  const out = [];
  for (const [key, v] of Object.entries(check.items || {})){
    if (v !== "bad") continue;
    if (existingOpen.some(d => d.eqId === check.eqId && d.item === key && d.status !== "closed")) continue;
    out.push({ eqId: check.eqId, kind: check.kind, checkId: check.id, item: key, text: itemText(check.kind, key),
      note: (check.notes || {})[key] || "", openedAt: check.date, status: "open", severity: check.summary === "down" ? "down" : "repair",
      owner: check.owner || "", due: check.due || "" });
  }
  return out;
}
// סיכום הטופס נגזר מהסעיפים אם הבודק לא בחר
export function suggestSummary(items){ return Object.values(items || {}).some(v => v === "bad") ? "repair" : "ok"; }
export function countItems(items){ let ok = 0, bad = 0, none = 0; for (const v of Object.values(items || {})) v === "ok" ? ok++ : v === "bad" ? bad++ : none++; return { ok, bad, none }; }

// ===== ICS / יומן גוגל =====
const icsEsc = s => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const fold = line => { const out = []; let s = line; while (s.length > 70){ out.push(s.slice(0, 70)); s = " " + s.slice(70); } out.push(s); return out.join("\r\n"); };
const stamp = (d = new Date()) => d.getUTCFullYear() + pad2(d.getUTCMonth() + 1) + pad2(d.getUTCDate()) + "T" + pad2(d.getUTCHours()) + pad2(d.getUTCMinutes()) + pad2(d.getUTCSeconds()) + "Z";
const local = (dateStr, hhmm) => dateStr.replace(/-/g, "") + "T" + hhmm.replace(":", "") + "00";
const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
// התאריך הבא (כולל היום) שנופל על יום בשבוע dow
export function nextDow(dow, from = isoDate()){ const d = parseDate(from); const diff = (dow - d.getDay() + 7) % 7; return addDays(from, diff); }
// אירוע: {uid,title,desc,date,time,minutes,weeklyDow?,allDay?}
export function icsEvent(ev, now = new Date()){
  const L = ["BEGIN:VEVENT", "UID:" + ev.uid + "@kelim.belectric", "DTSTAMP:" + stamp(now), "SUMMARY:" + icsEsc(ev.title)];
  if (ev.allDay){ L.push("DTSTART;VALUE=DATE:" + ev.date.replace(/-/g, "")); L.push("DTEND;VALUE=DATE:" + addDays(ev.date, 1).replace(/-/g, "")); }
  else {
    const [h, m] = ev.time.split(":").map(Number); const end = pad2(Math.floor((h * 60 + m + (ev.minutes || 30)) / 60) % 24) + ":" + pad2((h * 60 + m + (ev.minutes || 30)) % 60);
    L.push("DTSTART;TZID=Asia/Jerusalem:" + local(ev.date, ev.time)); L.push("DTEND;TZID=Asia/Jerusalem:" + local(ev.date, end));
  }
  if (ev.weeklyDow !== undefined && ev.weeklyDow !== null) L.push("RRULE:FREQ=WEEKLY;BYDAY=" + BYDAY[ev.weeklyDow]);
  if (ev.desc) L.push("DESCRIPTION:" + icsEsc(ev.desc));
  L.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsEsc(ev.title), "TRIGGER:-PT15M", "END:VALARM", "END:VEVENT");
  return L.map(fold).join("\r\n");
}
export function icsCalendar(events, now = new Date()){
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//BELECTRIC//בקרת כלים ונגררים//HE", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    ...events.map(e => icsEvent(e, now)), "END:VCALENDAR"].join("\r\n") + "\r\n";
}
// קישור «הוסף ליומן גוגל» (נפתח בדפדפן; אין צורך בחיבור)
export function gcalLink(ev){
  const p = new URLSearchParams({ action: "TEMPLATE", text: ev.title, ctz: "Asia/Jerusalem", details: ev.desc || "" });
  if (ev.allDay) p.set("dates", ev.date.replace(/-/g, "") + "/" + addDays(ev.date, 1).replace(/-/g, ""));
  else { const [h, m] = ev.time.split(":").map(Number); const t = h * 60 + m + (ev.minutes || 30); p.set("dates", local(ev.date, ev.time) + "/" + local(ev.date, pad2(Math.floor(t / 60) % 24) + ":" + pad2(t % 60))); }
  if (ev.weeklyDow !== undefined && ev.weeklyDow !== null) p.set("recur", "RRULE:FREQ=WEEKLY;BYDAY=" + BYDAY[ev.weeklyDow]);
  return "https://calendar.google.com/calendar/render?" + p.toString();
}
// כל התזכורות של האתר: בדיקה שבועית + תפוגות (שבועיים לפני) + טיפולים שמתקרבים (ליום הבדיקה הבא)
export function reminderEvents(settings, equipment, checks, today = isoDate()){
  const dow = settings.weeklyDow ?? 0, time = settings.weeklyTime || "07:30";
  const site = (settings.site || "").trim();
  const evs = [{ uid: "weekly-" + (site || "belectric"), title: "בדיקה שבועית לכלים ונגררים – " + (site || "BELECTRIC"), desc: "למלא טופס לכל כלי ונגרר בבעלות BELECTRIC, לצלם ולשמור בקלסר. ליקוי = דיווח מיידי.",
    date: nextDow(dow, today), time, minutes: 60, weeklyDow: dow }];
  for (const eq of equipment){
    if (eq.active === false) continue;
    for (const e of expiryStates(eq, today)){
      if (e.days === null || e.days < 0) continue;
      const remind = addDays(e.date, -EXPIRY_WARN_DAYS);
      evs.push({ uid: "exp-" + eq.id + "-" + e.key, title: "לעדכן את אלירן: " + e.label + " של " + eq.name + " פג ב-" + e.date.split("-").reverse().join("."),
        desc: "מס׳ רישוי " + (eq.plate || "—") + ". לפי הנוהל: הודעה לקצין הרכב לפחות שבועיים מראש.", date: remind >= today ? remind : today, allDay: true });
    }
    const svc = serviceState(eq, checks);
    if (svc && svc.state !== "ok") evs.push({ uid: "svc-" + eq.id + "-" + svc.next, title: "טיפול מוסך " + svc.next + " שעות – " + eq.name + (svc.state === "due" ? " (עבר)" : ""),
      desc: "שעות מנוע כעת " + svc.hours + ". לעדכן את דנה / מחמוד ולתאם מוסך מורשה.", date: svc.state === "due" ? today : nextDow(dow, today), time, minutes: 30 });
  }
  return evs;
}
