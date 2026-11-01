// «הקמה מתיקיית הפרויקט» (גרסה 62): מיון הקבצים, מפענחי DC CONFIG ורשימת כבלים, וזרימה מלאה בדפדפן:
// זיפ סינתטי → מה נמצא → «הקם את האתר» → מבנה חשמל, יעד פאנלים, כתב כמויות ותוכניות במאגר. בלי נתוני חברה.
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const fs = require("fs");
const JSZip = require("jszip");
const XLSX = require("xlsx");
const { launch, openApp, ROOT } = require("./helpers");

const scan = () => import(path.join(ROOT, "src", "js", "setup-scan.js"));

/* ---------- נתונים סינתטיים ---------- */
// DC CONFIG: תחנה 1 עם 11 ממירים בשתי כניסות (1.10 כתוב כמספר 1.1, כמו באקסל), תחנה 2 עם 4 ממירים
function dcRows(){
  const ids = [1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.1, 1.11, 2.1, 2.2, 2.3, 2.4];
  const str = [10, 10, 11, 10, 10, 10, 11, 11, 10, 12, 10, 9, 9, 10, 9];
  const W = 4 + ids.length, row = () => new Array(W).fill(null);
  const icb = row(); icb[4] = "ICB 1.1"; icb[10] = "ICB 1.2"; icb[15] = "ICB 2.1";
  const inv = row(); inv[2] = "Inv Num"; ids.forEach((v, i) => { inv[4 + i] = v; });
  const pv = n => { const r = row(); r[2] = "Mppt " + n; r[3] = "PV " + n; ids.forEach((v, i) => { r[4 + i] = 24; }); return r; };
  const tot = row(); tot[2] = "Total Strings"; tot[3] = str.reduce((a, b) => a + b, 0); str.forEach((v, i) => { tot[4 + i] = v; });
  const kw = row(); kw[2] = "ModulE Type [kWp]"; ids.forEach((v, i) => { kw[4 + i] = 0.6; });
  const lab = row(); lab[0] = "אורך סטרינג"; lab[1] = 24;
  return { rows: [row(), icb, inv, pv(1), pv(2), tot, kw, lab], strings: str.reduce((a, b) => a + b, 0) };
}
function cableRows(){
  return [["EBOQ"], [], [null, "Demo"], [null, "SERVICE", "TYPE", "תיאור", "Unit", "QUANTITY [m]", "מחיר למ'", "מחיר כולל"],
    [null, "DC", "String 6mm2 +", "String to INV", "m", 1000],
    [null, "DC", "String 6mm2 -", "String to INV", "m", 1000],
    [null, "AC LV", "NA2XY 1X300", "Dis to MVS", "m", 2500, 18, 45000],
    [null, null, "Copper PVC 25", "Grounding", "m", 300, 11, 3300],
    [null, null, "CAT7", null, "m", null, null, "בהמשך"]];
}
const xlsxOf = (rows, name) => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name || "Sheet1"); return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }); };
const PDF = s => Buffer.from("%PDF-1.4\n% " + s + "\n%%EOF\n");
async function projectZip(){
  const z = new JSZip(), P = "Demo Site/";
  z.file(P + "Calculation/Demo-DC CONFIG.xlsx", xlsxOf(dcRows().rows));
  z.file(P + "Calculation/Cable list.xlsx", xlsxOf(cableRows(), "שלב א"));
  z.file(P + "Calculation/Loads.xlsx", xlsxOf([["Load", "kW"], ["Lights", 2]]));
  z.file(P + "DMO_E_20_Cable Plan_rev02.pdf", PDF("e20 r2"));
  z.file(P + "DMO_E_20_Cable Plan_rev01.pdf", PDF("e20 r1"));
  z.file(P + "DMO_E_20_Cable Plan_revP01.pdf", PDF("e20 p1"));
  z.file(P + "Old/DMO_E_30_Comm Plan_rev00.pdf", PDF("e30 old"));
  z.file(P + "DMO_M_90_Layout_rev00.pdf", PDF("m90"));
  z.file(P + "DWG/DMO_E_20.dwg", "dwg");
  z.file(P + "DWG/DMO_E_20.bak", "bak");
  z.file(P + "Thumbs.db", "x");
  const chat = new JSZip(); chat.file("_chat.txt", "[01/10/2026, 09:00:00] בודק: ‎<attached: 0001-PHOTO.jpg>\n"); chat.file("0001-PHOTO.jpg", Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  z.file(P + "WhatsApp Chat - תעודות.zip", await chat.generateAsync({ type: "nodebuffer" }));
  return z.generateAsync({ type: "nodebuffer" });
}

/* ---------- יחידה ---------- */
test("מיון: הגרסה העדכנית מכל תוכנית, Old ו-CAD מדולגים, וואטסאפ מזוהה", async () => {
  const S = await scan();
  const c = S.classify([
    { path: "P/A_E_20_Plan_rev05.pdf", size: 10 }, { path: "P/A_E_20_Plan_rev04.pdf", size: 10 }, { path: "P/A_E_20_Plan_revP02.pdf", size: 10 },
    { path: "P/Calc/Ein_E_120_Sizing_rev01.pdf", size: 9 }, { path: "P/A_E_120_Sizing_rev01.pdf", size: 8 },
    { path: "P/Old/A_E_40_Trench_rev07.pdf", size: 5 }, { path: "P/MV/חד קווי - גרסה 1 - 15.2.26.pdf", size: 1 }, { path: "P/MV/חד קווי - גרסה 4 - 5.4.26.pdf", size: 1 },
    { path: "P/DWG/x.dwg", size: 1 }, { path: "P/Thumbs.db", size: 1 }, { path: "P/WhatsApp Chat - g.zip", size: 1 }, { path: "P/c.xlsx", size: 1 }, { path: "P/r.docx", size: 1 },
  ]);
  const plans = Object.fromEntries(c.plans.map(p => [p.key, p.path]));
  assert.strictEqual(plans["E_20"], "P/A_E_20_Plan_rev05.pdf");
  assert.strictEqual(plans["E_120"], "P/A_E_120_Sizing_rev01.pdf");                 // שוויון גרסה: הקרוב לשורש
  assert.ok(Object.values(plans).includes("P/MV/חד קווי - גרסה 4 - 5.4.26.pdf"));
  assert.ok(!c.plans.some(p => /Old\//.test(p.path)), "תוכנית מתיקיית Old נקלטה");
  assert.strictEqual(c.plans.length, 3);
  assert.strictEqual(c.superseded.length, 5);
  assert.strictEqual(c.chats.length, 1); assert.strictEqual(c.sheets.length, 1); assert.strictEqual(c.docs.length, 1);
  assert.deepStrictEqual(c.skipped.map(s => s.why).sort(), ["cad", "system"]);
  assert.strictEqual(c.plans.find(p => p.key === "E_20").rev, "rev05");
  assert.strictEqual(c.plans.find(p => p.key === "E_20").kind, "חשמל");
});

test("DC CONFIG: תחנות, כניסות וממירים בסדר הנכון גם כש-1.10 כתוב 1.1", async () => {
  const S = await scan(); const { rows, strings } = dcRows();
  assert.strictEqual(S.sniffSheet(rows, { file: "x.xlsx" }), "dc-config");
  const E = S.parseDcConfig(rows);
  assert.deepStrictEqual(E.stations.map(s => s.id), ["S1", "S2"]);
  assert.deepStrictEqual(E.stations[0].icbs.map(c => c.id), ["1.1", "1.2"]);
  assert.deepStrictEqual(E.stations[0].icbs[1].inv.map(([id]) => id), ["1.7", "1.8", "1.9", "1.10", "1.11"]);
  assert.deepStrictEqual(E.stations[0].icbs[1].inv[3], ["1.10", 12]);
  assert.deepStrictEqual(E.stations[1].icbs[0].inv.map(([id]) => id), ["2.1", "2.2", "2.3", "2.4"]);
  assert.strictEqual(E.stringPanels, 24);
  assert.deepStrictEqual(E.totals, { stations: 2, icbs: 3, inverters: 15, strings, panels: strings * 24, moduleW: 600, kwp: Math.round(strings * 24 * 600) / 1000 });
});

test("רשימת כבלים: בלי עמודות מחיר; גיליון עם שתי עמודות כמות לא נקרא", async () => {
  const S = await scan();
  assert.strictEqual(S.sniffSheet(cableRows()), "cable-list");
  const B = S.parseCableList(cableRows());
  assert.strictEqual(B.lines.length, 4);                                              // CAT7 בלי כמות לא נכנס
  assert.deepStrictEqual(B.lines.map(l => [l.code, l.name, l.qty, l.unit, l.group]), [["1", "String 6mm2 +", 1000, "מטר", "DC"], ["2", "String 6mm2 -", 1000, "מטר", "DC"], ["3", "NA2XY 1X300", 2500, "מטר", "AC LV"], ["4", "Copper PVC 25", 300, "מטר", "AC LV"]]);
  assert.ok(!JSON.stringify(B).includes("45000") && !JSON.stringify(B).includes("3300"), "מחיר נקלט");
  const two = [[null, "SERVICE", "TYPE", "Unit", "QUANTITY 22kV", "QUANTITY 33kV"], [null, "DC", "String", "m", 10, 10]];
  assert.strictEqual(S.sniffSheet(two), null);
  assert.strictEqual(S.parseCableList(two), null);
  assert.strictEqual(S.sniffSheet([["CBA"], ["Package", "Price"]], { file: "Demo CBA.xlsx" }), "cba");
  assert.strictEqual(S.projectNameFrom([[null, "*Project Name:", "Demo Site", "*Location:"]]), "Demo Site");
});

/* ---------- בדפדפן ---------- */
// צילומי מסך של החלון (מסך אחר מסך, כמו בטלפון), רק עם SHOTS=<תיקייה>
async function sheetShots(page, name){
  const h = await page.evaluate(() => { const s = document.querySelector(".sheet.zs"); return { all: s.scrollHeight, view: s.clientHeight }; });
  for (let i = 0, y = 0; y < h.all && i < 4; i++, y += h.view - 40){
    await page.evaluate(y => { document.querySelector(".sheet.zs").scrollTop = y; }, y);
    await page.waitForTimeout(100);
    await page.screenshot({ path: path.join(process.env.SHOTS, name + "-" + (i + 1) + ".png") });
  }
  await page.evaluate(() => { document.querySelector(".sheet.zs").scrollTop = 0; });
}

let browser;
test.before(async () => { browser = await launch(); });
test.after(async () => { await browser.close(); });

test("אתר חדש: הכרטיס מציע הקמה מתיקייה, הזיפ ממוין, ובלחיצה אחת האתר מוקם (400px)", async () => {
  const zip = await projectZip();
  // אתר חדש שאינו עין תמר: אין לו מבנה חשמל ומפה מובנים
  const { page, ctx, errors } = await openApp(browser, { mock: { seed: { settings: { site: { name: "אתר הדגמה", company: "DEMO", panelsPerTable: 24 } } }, assets: true }, libs: true });
  assert.deepStrictEqual(errors, []);
  const card = await page.evaluate(() => ({ shown: !document.querySelector("#onbCard").hidden, btn: !!document.querySelector("#onbZip"), steps: document.querySelectorAll("#onbSteps .step").length, overflow: document.documentElement.scrollWidth - window.innerWidth }));
  assert.strictEqual(card.shown, true, "כרטיס «אתר חדש» לא מוצג באתר ריק");
  assert.strictEqual(card.btn, true); assert.strictEqual(card.steps, 5);
  assert.ok(card.overflow <= 0, "גלילה אופקית: " + card.overflow);
  await page.click("#onbZip");
  await page.setInputFiles("#zsZip", { name: "Demo Site.zip", mimeType: "application/zip", buffer: zip });
  await page.waitForSelector("#zsItems", { timeout: 15000 });
  const rv = await page.evaluate(() => ({
    items: [...document.querySelectorAll(".zs-item")].map(l => ({ t: l.querySelector("b").textContent, on: l.querySelector("input").checked, d: l.querySelector(".zs-t span").textContent })),
    sum: document.querySelector(".imp-sum").textContent.replace(/\s+/g, " "), chat: !!document.querySelector(".note-card") && /וואטסאפ/.test(document.querySelector("#zsBody").textContent),
    miss: [...document.querySelectorAll(".zs-miss li b")].map(b => b.textContent), skip: document.querySelector(".zs-skip summary").textContent,
    plans: [...document.querySelectorAll(".zs-plans .dlines div")].map(d => [...d.children].map(c => c.textContent).join(" ")), go: document.querySelector("#zsGo").textContent,
    overflow: document.documentElement.scrollWidth - window.innerWidth, sheetOverflow: (s => s.scrollWidth - s.clientWidth)(document.querySelector(".sheet.zs")) }));
  assert.deepStrictEqual(rv.items.map(i => i.t), ["מבנה החשמל", "יעד פאנלים", "כתב כמויות תכנוני", "תוכניות"]);
  assert.ok(rv.items.every(i => i.on), "פריט חדש לא מסומן");
  assert.match(rv.items[0].d, /2 תחנות · 3 כניסות ICB · 15 ממירים · 152 סטרינגים/);
  assert.match(rv.items[1].d, /3,648 פאנלים · 600W/);
  assert.match(rv.items[2].d, /4 פריטים · בלי מחירים/);
  assert.match(rv.items[3].d, /2 העדכניות/);
  assert.deepStrictEqual(rv.plans.map(t => t.replace(/\s+/g, " ").trim()), ["DMO M 90 Layout rev00", "DMO E 20 Cable Plan rev02"]);
  assert.ok(rv.chat, "ייצוא וואטסאפ לא זוהה");
  assert.ok(rv.miss.some(m => /BOM/.test(m)) && rv.miss.some(m => /שדות/.test(m)), "חסרים: " + rv.miss);
  assert.ok(!rv.miss.some(m => /מלאי פתיחה/.test(m)), "יש וואטסאפ, מלאי פתיחה לא חסר");
  assert.match(rv.skip, /דולגו \d+ קבצים/);
  assert.strictEqual(rv.go, "הקם את האתר");
  assert.ok(rv.overflow <= 0 && rv.sheetOverflow <= 1, "גלילה אופקית בחלון: " + rv.overflow + "/" + rv.sheetOverflow);
  if (process.env.SHOTS) await sheetShots(page, "zip-setup-review");
  await page.click("#zsGo");
  await page.waitForSelector(".zs-done", { timeout: 15000 });
  if (process.env.SHOTS) await sheetShots(page, "zip-setup-done");
  const st = await page.evaluate(() => { const S = window.__MOCK_STORE__; const get = k => S.get(k); const plans = [...S.keys()].filter(k => k.startsWith("plans/")).map(k => S.get(k));
    return { elec: get("settings/elec"), panels: get("status/st_panels"), boq: get("settings/boq"), site: get("settings/site"), plans, assets: window.__MOCK_ASSETS__,
      done: [...document.querySelectorAll(".zs-done li")].map(l => l.textContent), chatBtn: !!document.querySelector("#zsChat"), next: document.querySelectorAll(".zs-next .slip").length,
      log: [...S.keys()].filter(k => k.startsWith("log/")).map(k => S.get(k).summary).find(s => /תיקיית הפרויקט/.test(s)) || "" }; });
  assert.strictEqual(st.elec.struct.stations.length, 2);
  assert.strictEqual(st.elec.struct.stations[0].icbs[1].inv[3][0], "1.10");
  assert.strictEqual(st.elec.struct.stringPanels, 24);
  assert.strictEqual(st.panels.total, 3648); assert.strictEqual(st.panels.name, "פאנלים");
  assert.strictEqual(st.boq.lines.length, 4); assert.ok(!JSON.stringify(st.boq).includes("45000"));
  assert.strictEqual(st.site.name, "אתר הדגמה");                                         // שם שהוגדר נשמר (השדה מתמלא בשם הקיים)
  assert.deepStrictEqual(st.plans.map(p => [p.name, p.kind, p.rev, !!p.asset]).sort(), [["DMO E 20 Cable Plan", "חשמל", "rev02", true], ["DMO M 90 Layout", "קונסטרוקציה", "rev00", true]]);
  assert.strictEqual(st.assets.length, 2); assert.ok(st.assets.every(a => a.type === "application/pdf"));
  assert.deepStrictEqual(st.done, ["מבנה החשמל: 15 ממירים", "יעד פאנלים: 3,648", "כתב כמויות: 4 פריטים", "תוכניות: 2"]);
  assert.ok(st.chatBtn, "אין כפתור לקליטת התעודות מהוואטסאפ"); assert.ok(st.next >= 2);
  assert.match(st.log, /מבנה החשמל: 15 ממירים/);
  // אחרי הסגירה: כרטיס החשמל מציג את המבנה מהתיקייה
  await page.click("#zsClose");
  await page.waitForTimeout(200);
  const el = await page.evaluate(() => ({ body: !document.querySelector("#elBody").hidden, src: document.querySelector("#elSrc").textContent, inv: document.querySelectorAll("#elStations .el-inv").length, plans: document.querySelectorAll("#plansList .slip").length }));
  assert.strictEqual(el.body, true); assert.strictEqual(el.inv, 15); assert.match(el.src, /Demo-DC CONFIG\.xlsx/); assert.strictEqual(el.plans, 2);
  // הרצה שנייה של אותו זיפ: מה שכבר קיים לא מסומן, תוכניות לא מוכפלות
  await page.evaluate(() => openZipSetup());
  await page.setInputFiles("#zsZip", { name: "Demo Site.zip", mimeType: "application/zip", buffer: zip });
  await page.waitForSelector("#zsItems", { timeout: 15000 });
  const again = await page.evaluate(() => [...document.querySelectorAll(".zs-item")].map(l => [l.querySelector("b").textContent, l.querySelector("input").checked, !!l.querySelector(".zs-warn"), l.querySelector(".zs-t span").textContent]));
  assert.deepStrictEqual(again.map(([t, on, w]) => [t, on, w]), [["מבנה החשמל", false, true], ["יעד פאנלים", false, true], ["כתב כמויות תכנוני", false, true], ["תוכניות", false, false]]);
  assert.strictEqual(again[3][3], "כולן כבר במופע");
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});

test("עורך: אין כפתור הקמה בהגדרות, והחלון לא נפתח", async () => {
  const { page, ctx, errors } = await openApp(browser, { mock: { seed: {}, role: "editor" } });
  const r = await page.evaluate(() => { openSettings(); const b = document.querySelector("#stZip2"); const hidden = !b || b.hidden; document.querySelector(".scrim").remove(); openZipSetup(); return { hidden, opened: !!document.querySelector(".sheet.zs"), card: document.querySelector("#onbCard").hidden }; });
  assert.deepStrictEqual(r, { hidden: true, opened: false, card: true });
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});
