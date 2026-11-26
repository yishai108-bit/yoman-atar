// בדיקות יחידה לחישובים (node בלבד, בלי דפדפן)
const test = require("node:test");
const assert = require("node:assert");
const fixture = require("./fixture");
let L, F;
test.before(async () => { L = await import("../src/js/logic.js"); F = await import("../src/js/forms.js"); });
const list = o => Object.values(o);

test("הטפסים: 11 סעיפים לכלי, 23 לנגרר, מפתחות ייחודיים", () => {
  const t = F.allItems("tool"), r = F.allItems("trailer");
  assert.strictEqual(t.length, 11); assert.strictEqual(r.length, 23);
  assert.strictEqual(new Set(t.map(i => i.key)).size, 11); assert.strictEqual(new Set(r.map(i => i.key)).size, 23);
  assert.strictEqual(F.KINDS.trailer.groups.length, 5);
  assert.ok(F.KINDS.tool.notes[0].includes("250 שעות"));
});
test("טיפול מוסך: 1230 שעות אחרי טיפול ב-1000 = נותרו 20 (soon); 520 אחרי 250 = עבר (due)", () => {
  const eqs = fixture.equipment, checks = list(fixture.checks);
  const a = L.serviceState(eqs.eq_mule1, checks); assert.strictEqual(a.next, 1250); assert.strictEqual(a.left, 20); assert.strictEqual(a.state, "soon");
  const b = L.serviceState(eqs.eq_mule2, checks); assert.strictEqual(b.next, 500); assert.strictEqual(b.state, "due");
  assert.strictEqual(L.serviceState(eqs.eq_tr1, checks), null);
});
test("שעות מנוע: הבדיקה מעדכנת את הכלי כלפי מעלה בלבד", () => {
  const eq = { ...fixture.equipment.eq_mule1, hours: 1000 };
  assert.strictEqual(L.currentHours(eq, list(fixture.checks)), 1230);
  assert.strictEqual(L.currentHours({ ...eq, hours: 1300 }, list(fixture.checks)), 1300);
});
test("תפוגות: 10 ימים = soon, שלושה ימים אחורה = expired", () => {
  const e1 = L.expiryStates(fixture.equipment.eq_mule1); assert.strictEqual(e1.find(x => x.key === "licenseExp").state, "soon"); assert.strictEqual(e1.find(x => x.key === "insuranceExp").state, "ok");
  const e2 = L.expiryStates(fixture.equipment.eq_mule2); assert.strictEqual(e2.find(x => x.key === "insuranceExp").state, "expired");
});
test("מצב כלי: מיול 1 נבדק השבוע עם ליקוי פתוח = warn; מיול 2 טיפול עבר = bad", () => {
  const checks = list(fixture.checks), defects = list(fixture.defects);
  const s1 = L.equipmentStatus(fixture.equipment.eq_mule1, checks, defects); assert.strictEqual(s1.checkedThisWeek, true); assert.strictEqual(s1.open.length, 1); assert.strictEqual(s1.level, "warn");
  const s2 = L.equipmentStatus(fixture.equipment.eq_mule2, checks, defects); assert.strictEqual(s2.checkedThisWeek, false); assert.strictEqual(s2.level, "bad");
  const s3 = L.equipmentStatus(fixture.equipment.eq_tr1, checks, defects); assert.strictEqual(s3.checkedThisWeek, false); assert.strictEqual(s3.open.length, 0);
});
test("ליקויים מטופס: X = ליקוי, בלי לשכפל ליקוי פתוח על אותו סעיף", () => {
  const check = { id: "ck_x", eqId: "eq_mule1", kind: "tool", date: "2026-11-26", summary: "down", items: { tires: "bad", horn: "bad", fluids: "ok" }, notes: { horn: "לא עובד" } };
  const ds = L.defectsFromCheck(check, list(fixture.defects));
  assert.strictEqual(ds.length, 1); assert.strictEqual(ds[0].item, "horn"); assert.strictEqual(ds[0].text, "בדיקת צופר"); assert.strictEqual(ds[0].severity, "down"); assert.strictEqual(ds[0].note, "לא עובד");
  assert.strictEqual(L.suggestSummary(check.items), "repair"); assert.strictEqual(L.suggestSummary({ a: "ok" }), "ok");
  assert.deepStrictEqual(L.countItems(check.items), { ok: 1, bad: 2, none: 0 });
});
test("ICS: אירוע שבועי חוזר ביום ראשון 07:30 בשעון ישראל, עם RRULE והתראה", () => {
  const ev = { uid: "weekly-x", title: "בדיקה שבועית, כלים; נגררים", desc: "שורה 1\nשורה 2", date: "2026-11-29", time: "07:30", minutes: 60, weeklyDow: 0 };
  const ics = L.icsCalendar([ev], new Date("2026-11-26T10:00:00Z"));
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0"));
  assert.ok(ics.includes("DTSTART;TZID=Asia/Jerusalem:20261129T073000")); assert.ok(ics.includes("DTEND;TZID=Asia/Jerusalem:20261129T083000"));
  assert.ok(ics.includes("RRULE:FREQ=WEEKLY;BYDAY=SU")); assert.ok(ics.includes("SUMMARY:בדיקה שבועית\\, כלים\; נגררים")); assert.ok(ics.includes("DESCRIPTION:שורה 1\\nשורה 2"));
  assert.ok(ics.includes("TRIGGER:-PT15M")); assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.ok(ics.split("\r\n").every(l => l.length <= 75), "שורות עד 75 תווים");
  const all = L.icsEvent({ uid: "e", title: "t", date: "2026-12-01", allDay: true }); assert.ok(all.includes("DTSTART;VALUE=DATE:20261201")); assert.ok(all.includes("DTEND;VALUE=DATE:20261202"));
});
test("קישור יומן גוגל: תבנית עם dates, ctz ו-recur", () => {
  const u = new URL(L.gcalLink({ title: "בדיקה", date: "2026-11-29", time: "07:30", minutes: 60, weeklyDow: 0 }));
  assert.strictEqual(u.origin + u.pathname, "https://calendar.google.com/calendar/render");
  assert.strictEqual(u.searchParams.get("action"), "TEMPLATE"); assert.strictEqual(u.searchParams.get("dates"), "20261129T073000/20261129T083000");
  assert.strictEqual(u.searchParams.get("ctz"), "Asia/Jerusalem"); assert.strictEqual(u.searchParams.get("recur"), "RRULE:FREQ=WEEKLY;BYDAY=SU");
  assert.strictEqual(L.nextDow(0, "2026-11-26"), "2026-11-29"); assert.strictEqual(L.nextDow(4, "2026-11-26"), "2026-11-26");
});
test("תזכורות האתר: שבועי + תפוגה שבועיים לפני + טיפול שמתקרב; כלי לא פעיל לא נכלל", () => {
  const evs = L.reminderEvents(fixture.settings.main, list(fixture.equipment), list(fixture.checks));
  assert.strictEqual(evs[0].weeklyDow, 0); assert.ok(evs[0].title.includes("BELECTRIC"), "בלי אתר ברירת מחדל");
  assert.ok(L.reminderEvents({ site: "אתר א" }, [], [])[0].title.includes("אתר א"));
  assert.ok(evs.some(e => e.uid === "exp-eq_mule1-licenseExp" && e.allDay && e.title.includes("אלירן")));
  assert.ok(!evs.some(e => e.uid === "exp-eq_mule2-insuranceExp"), "ביטוח שפג לא מקבל תזכורת עתידית");
  assert.ok(evs.some(e => e.uid.startsWith("svc-eq_mule1")) && evs.some(e => e.uid.startsWith("svc-eq_mule2") && e.title.includes("(עבר)")));
  assert.ok(!evs.some(e => e.uid.includes("eq_old")));
});
