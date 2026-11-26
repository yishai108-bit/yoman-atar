// נתוני דוגמה סינתטיים לבדיקות ולפיתוח (לא נתוני אתר אמיתיים)
const today = new Date(); const iso = d => d.toISOString().slice(0, 10);
const daysAgo = n => { const d = new Date(today); d.setDate(d.getDate() - n); return iso(d); };
const daysAhead = n => { const d = new Date(today); d.setDate(d.getDate() + n); return iso(d); };
const dow = today.getDay(); // כדי שבדיקה «השבוע» תיפול בשבוע הנוכחי: 0 ימים אחורה אם ראשון
module.exports = {
  settings: { main: { interval: 250, weeklyDow: 0, weeklyTime: "07:30", shareUrl: "https://example.test/kelim" } },
  equipment: {
    eq_mule1: { id: "eq_mule1", kind: "tool", site: "אתר בדיקה", name: "מיול 1", plate: "12-345-67", model: "Kubota RTV", hours: 1230, interval: 250, lastServiceHours: 1000, lastServiceDate: daysAgo(40), licenseExp: daysAhead(10), insuranceExp: daysAhead(200), testExp: "", active: true },
    eq_mule2: { id: "eq_mule2", kind: "tool", site: "אתר בדיקה", name: "מיול 2", plate: "23-456-78", model: "", hours: 520, interval: 250, lastServiceHours: 250, lastServiceDate: daysAgo(90), licenseExp: daysAhead(120), insuranceExp: daysAgo(3), testExp: "", active: true },
    eq_tr1: { id: "eq_tr1", kind: "trailer", site: "אתר שני", name: "נגרר כלים", plate: "34-567-89", model: "", active: true, licenseExp: daysAhead(300) },
    eq_old: { id: "eq_old", kind: "trailer", name: "נגרר ישן", plate: "", active: false },
  },
  checks: {
    ck_1: { id: "ck_1", eqId: "eq_mule1", eqName: "מיול 1", kind: "tool", date: daysAgo(dow), inspector: "בודק דוגמה", role: "לוגיסטיקה", site: "אתר בדיקה", hours: 1230, plate: "12-345-67", createdAt: new Date().toISOString(),
      items: { fluids: "ok", leaks: "ok", tires: "bad", dash: "ok", mirrors: "ok", horn: "ok", lights: "ok", brakes: "ok", belts: "ok", clean: "ok", exhaust: "ok" }, notes: { tires: "צמיג אחורי שמאלי שחוק" }, summary: "repair", defectsText: "צמיג אחורי שמאלי שחוק", owner: "מוסך", due: daysAhead(5), signature: "", photos: [] },
    ck_2: { id: "ck_2", eqId: "eq_tr1", eqName: "נגרר כלים", kind: "trailer", date: daysAgo(dow + 7), inspector: "בודק דוגמה", role: "לוגיסטיקה", site: "אתר בדיקה", hours: "", plate: "34-567-89", createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
      items: Object.fromEntries(["license", "plate", "vin", "coupler", "lock", "cable", "jockey", "l_park", "l_brake", "l_right", "l_left", "l_plate", "plug", "t_press", "t_tread", "t_cuts", "t_nuts", "frame", "floor", "sides", "hooks", "axles", "clean"].map(k => [k, "ok"])), notes: {}, summary: "ok", defectsText: "", owner: "", due: "", signature: "", photos: [] },
  },
  defects: {
    df_1: { id: "df_1", eqId: "eq_mule1", kind: "tool", checkId: "ck_1", item: "tires", text: "בדיקה ויזואלית של הצמיגים לגילוי צמיגים שחוקים / לקויים / קרועים / בלויים", note: "צמיג אחורי שמאלי שחוק", openedAt: daysAgo(dow), status: "open", severity: "repair", owner: "מוסך", due: daysAhead(5) },
    df_0: { id: "df_0", eqId: "eq_tr1", kind: "trailer", checkId: "", item: "l_left", text: "איתות שמאלי", note: "נורה שרופה", openedAt: daysAgo(20), status: "closed", severity: "repair", closedAt: daysAgo(18), closedBy: "חשמלאי", fixNote: "הוחלפה נורה" },
  },
  services: {},
};
