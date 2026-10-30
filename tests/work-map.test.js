// «מה בוצע במפה» (גרסה 57): מבנה האתר מהמפה / ממספרים, דיווחי ביצוע עם מיקום נצבעים לפי שורות, בלי מיקום נספרים בלבד; כרטיס «תוכניות».
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { launch, openApp, ROOT } = require("./helpers");
const fixture = require("./fixture");
const { build, forSite } = require("../tools/build");

const D = n => Date.now() - n * 864e5;
// דיווחים סינתטיים: שניים עם מיקום במערב, אחד בלי מיקום
const progress = {
  p1: { id: "p1", ts: D(3), dateText: "27.10.2026", who: "קבלן", tables: 12, stage: "con", areaId: "west", area: "מערב", rows: [3, 4], by: "בודק" },
  p2: { id: "p2", ts: D(1), dateText: "29.10.2026", who: "קבלן", tables: 7, stage: "pan", areaId: "west", area: "מערב", by: "בודק" },
  p3: { id: "p3", ts: D(2), dateText: "28.10.2026", who: "קבלן", tables: 5, stage: "con", by: "בודק" },
};
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==", "base64");

let browser;
test.before(async () => { browser = await launch(); });
test.after(async () => { await browser.close(); });

test("עין תמר: מבנה האתר נגזר ממפת השולחנות: שני חצאים, 23 שורות פיזיות ממוספרות מלמטה, 258 שולחנות", async () => {
  const { page, ctx, errors } = await openApp(browser, { mock: { seed: fixture } });
  assert.deepStrictEqual(errors, []);
  const L = await page.evaluate(() => { const L = currentLayout(); return { src: L.src, fields: L.fields.map(f => ({ id: f.id, name: f.name, rows: f.rows.length, first: f.rows[0].n, last: f.rows[f.rows.length - 1].n, tables: f.rows.reduce((s, r) => s + r.tables, 0) })), sum: layoutSummary(L) }; });
  assert.strictEqual(L.src, "map");
  assert.deepStrictEqual(L.fields.map(f => f.id), ["west", "east"]);
  const east = L.fields[1], west = L.fields[0];
  assert.strictEqual(east.rows, 23); assert.strictEqual(east.first, 1); assert.strictEqual(east.last, 23);
  assert.strictEqual(west.first, 3, "השורות התחתונות הן רק במזרח, אז מערב מתחיל בשורה 3"); assert.strictEqual(west.last, 23);
  assert.strictEqual(east.tables + west.tables, 258);
  assert.match(L.sum, /2 שדות · 44 שורות · 258 שולחנות/);
  await ctx.close();
});

test("דיווחים עם מיקום נצבעים לפי שורות, בלי מיקום נספרים בלבד, ורשימת «לא בוצע» נבנית מהשורות", async () => {
  const { page, ctx, errors } = await openApp(browser, { mock: { seed: { ...fixture, progress } } });
  assert.deepStrictEqual(errors, []);
  const r = await page.evaluate(() => {
    const L = currentLayout(), P = placeReports(L, shared.progress); const w = L.fields[0];
    const cap = n => w.rows.find(r => r.n === n).tables;
    return { fill: L.fill, unplaced: P.unplaced.map(p => p.id), placed: P.placed, con3: P.F.west[3].con, con4: P.F.west[4].con, cap3: cap(3), cap4: cap(4), pan23: P.F.west[23].pan, pan22: P.F.west[22].pan, cap23: cap(23), pan3: P.F.west[3].pan,
      big: document.querySelector("#wmBig").textContent, sub: document.querySelector("#wmSub").textContent, unp: document.querySelector("#wmUnp").textContent,
      pend: [...document.querySelectorAll("#wmPend .slip")].map(e => e.textContent), sum: document.querySelector("#sum_work").textContent,
      list: [...document.querySelectorAll("#conProg .slip span")].map(e => e.textContent), cvw: document.querySelector("#wmCv").width,
      overflow: document.documentElement.scrollWidth - window.innerWidth };
  });
  assert.deepStrictEqual(r.unplaced, ["p3"]); assert.strictEqual(r.placed, 2);
  // סדר הבנייה בעין תמר מלמעלה: 12 שולחנות קונסטרוקציה בשורות 3–4 ממלאים את 4 ואז את 3; 7 פאנלים בלי שורות מתחילים בשורה 23
  assert.strictEqual(r.fill, "top");
  assert.strictEqual(r.con4, r.cap4); assert.strictEqual(r.con3, 12 - r.cap4, "העודף מעבר לקיבולת השורות נשאר על השורה האחרונה שמולאה ומסומן כחריגה");
  assert.ok(r.con3 > r.cap3);
  assert.strictEqual(r.pan23, Math.min(7, r.cap23)); assert.strictEqual(r.pan22, Math.max(0, 7 - r.cap23)); assert.strictEqual(r.pan3, 0);
  assert.match(r.big, /^\d+ \/ 44$/); assert.match(r.sub, /קונסטרוקציה 7 · פאנלים 7 · אושרו 0 · מתוך 2 דיווחים/);
  assert.match(r.unp, /1 דיווחי ביצוע בלי מיקום/); assert.match(r.sum, /1 בלי מיקום/);
  assert.ok(r.pend.some(t => /מזרח/.test(t) && /שורות 1–23: עוד לא התחילו/.test(t)), r.pend.join(" | "));
  assert.ok(r.pend.some(t => /מערב/.test(t) && /שורות 5–21: עוד לא התחילו/.test(t)), r.pend.join(" | "));
  assert.ok(r.list.some(t => /מערב · שורות 3–4/.test(t)), "המיקום מופיע ברשימת הדיווחים");
  assert.ok(r.cvw > 0); assert.ok(r.overflow <= 0, "גלילה אופקית: " + r.overflow + "px");
  await ctx.close();
});

test("דיווח ביצוע חדש: בוחרים שדה ושורות (גם מהמפה), והמיקום נשמר על הדיווח; «מקם» משלים דיווח ישן", async () => {
  const { page, ctx } = await openApp(browser, { mock: { seed: { ...fixture, progress } } });
  await page.click("#btnProgress"); await page.waitForTimeout(300);
  assert.deepStrictEqual(await page.evaluate(() => [...document.querySelectorAll("#lcF .chip2")].map(c => c.textContent)), ["בלי מיקום", "מערב", "מזרח"]);
  await page.click('#lcF [data-f="east"]'); await page.waitForTimeout(350);
  // לחיצה על שורה במפה המוגדלת (התחתונה = שורה 1), ואז הקלדת טווח
  await page.evaluate(() => document.querySelector("#lcCv").scrollIntoView({ block: "center" })); await page.waitForTimeout(100);
  const bb = await (await page.$("#lcCv")).boundingBox();
  await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height - 14); await page.waitForTimeout(200);
  assert.strictEqual(await page.inputValue("#lcRows"), "1");
  await page.fill("#lcRows", "3–5"); await page.fill("#pgBy", "בודק"); await page.click("#pgSave"); await page.waitForTimeout(400);
  const saved = await page.evaluate(() => [...window.__MOCK_STORE__.entries()].filter(([k]) => k.startsWith("progress/pg")).map(([, v]) => ({ areaId: v.areaId, area: v.area, rows: v.rows, tables: v.tables })));
  assert.deepStrictEqual(saved, [{ areaId: "east", area: "מזרח", rows: [3, 5], tables: 5 }]);
  assert.ok((await page.evaluate(() => document.querySelector("#wmSub").textContent)).includes("מתוך 3 דיווחים"));
  // מיקום בדיעבד לדיווח p3
  await page.click("#wmPlace"); await page.waitForTimeout(250);
  await page.click("#upList .slip"); await page.waitForTimeout(250);
  await page.click('#plLoc [data-f="west"]'); await page.fill("#plLoc #lcRows", "7"); await page.click("#plSave"); await page.waitForTimeout(400);
  const p3 = await page.evaluate(() => window.__MOCK_STORE__.get("progress/p3"));
  assert.strictEqual(p3.areaId, "west"); assert.deepStrictEqual(p3.rows, [7, 7]); assert.strictEqual(p3.tables, 5);
  assert.strictEqual(await page.evaluate(() => document.querySelector("#wmUnp").hidden), true);
  await ctx.close();
});

test("לחיצה על שדה מגדילה, לחיצה על שורה מראה מה דווח בה; צופה רואה בלי כפתורי עריכה", async () => {
  const { page, ctx } = await openApp(browser, { mock: { seed: { ...fixture, progress } } });
  await page.evaluate(() => document.querySelector("#wmCv").scrollIntoView({ block: "center" })); await page.waitForTimeout(100);
  const hit = await page.evaluate(() => { const L = currentLayout(), cv = document.querySelector("#wmCv"), s = cv.clientWidth / L.w, f = L.fields[0], r = f.rows[0]; const b = cv.getBoundingClientRect(); return { x: b.left + (r.x + r.w / 2) * s, y: b.top + (r.y + r.h / 2) * s }; });
  await page.mouse.click(hit.x, hit.y); await page.waitForTimeout(200);
  assert.match(await page.evaluate(() => document.querySelector("#wmZoom").textContent), /מערב · לחצו על שורה/);
  await page.evaluate(() => document.querySelector("#wmCv").scrollIntoView({ block: "center" })); await page.waitForTimeout(100);
  const bb = await (await page.$("#wmCv")).boundingBox();
  await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height - 14); await page.waitForTimeout(200);   // השורה התחתונה של מערב = 3
  const z = await page.evaluate(() => document.querySelector("#wmZoom").textContent);
  assert.match(z, /מערב · שורה 3 ·/); assert.match(z, /קונסטרוקציה הושלמה/); assert.match(z, /27\.10/); assert.match(z, /דיווח ביצוע כאן/);
  await page.click("#wmBack"); await page.waitForTimeout(150);
  assert.strictEqual(await page.evaluate(() => document.querySelector("#wmZoom").hidden), true);
  await ctx.close();
  const v = await openApp(browser, { mock: { role: "viewer", seed: { ...fixture, progress } } });
  const rv = await v.page.evaluate(() => ({ place: !!document.querySelector("#wmPlace"), setup: document.querySelector("#wmSetup").hidden, add: getComputedStyle(document.querySelector("#btnAddPlan")).display }));
  assert.strictEqual(rv.place, false); assert.strictEqual(rv.setup, true);
  await v.ctx.close();
});

test("אתר בלי מפה (מולדת): מצב ריק עם «מבנה האתר»; הבעלים קובע מספרים והמפה נבנית מהם ב-400px", async () => {
  const sites = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "sites.json"), "utf8"));
  const dir = path.join(ROOT, "tests", "out"); fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "moledet-work-map.html"); fs.writeFileSync(file, forSite(build(), sites["moledet"]));
  const { page, errors, ctx } = await openApp(browser, { file, mock: { seed: fixture } });
  assert.deepStrictEqual(errors, []);
  assert.deepStrictEqual(await page.evaluate(() => ({ empty: document.querySelector("#wmEmpty").hidden, setup: document.querySelector("#wmSetup").hidden, body: document.querySelector("#wmBody").hidden })), { empty: false, setup: false, body: true });
  await page.click("#wmSetup"); await page.waitForTimeout(250);
  await page.check("#lyUseGen"); await page.fill("#lyFields", "2"); await page.fill("#lyRows", "12"); await page.fill("#lyTables", "9"); await page.fill("#lyNames", "צפון, דרום");
  await page.click("#lySave"); await page.waitForTimeout(400);
  const r = await page.evaluate(() => ({ doc: window.__MOCK_STORE__.get("settings/layout").gen, body: document.querySelector("#wmBody").hidden, src: document.querySelector("#wmSrc").textContent, names: currentLayout().fields.map(f => f.name), overflow: document.documentElement.scrollWidth - window.innerWidth }));
  assert.deepStrictEqual(r.doc, { fields: 2, rows: 12, tables: 9, names: "צפון, דרום" });
  assert.strictEqual(r.body, false); assert.match(r.src, /לפי המספרים בהגדרות · 2 שדות · 24 שורות · 216 שולחנות/);
  assert.deepStrictEqual(r.names, ["צפון", "דרום"]); assert.ok(r.overflow <= 0, "גלילה אופקית: " + r.overflow + "px");
  // דיווח עם מיקום בשדה שנוצר מהמספרים
  await page.click("#btnProgress"); await page.waitForTimeout(300);
  await page.click('#lcF [data-f="f2"]'); await page.fill("#lcRows", "1–2"); await page.fill("#pgBy", "בודק"); await page.click("#pgSave"); await page.waitForTimeout(400);
  assert.match(await page.evaluate(() => document.querySelector("#wmSub").textContent), /קונסטרוקציה 5/);
  await ctx.close();
});

test("תוכנית שנקראה מ-JSON קובעת את המבנה (מעל המפה המובנית), והסרה מחזירה למפה", async () => {
  const layout = { fence: [0, 0, 1000, 600], fields: [{ name: "A", x: 20, y: 20, w: 450, h: 560, rows: 15, tables: 8 }, { name: "B", x: 530, y: 20, w: 450, h: 560, rows: 15, tables: 8 }] };
  const { page, ctx } = await openApp(browser, { mock: { seed: { ...fixture, settings: { layout: { layout, planId: "" } } } } });
  const r = await page.evaluate(() => { const L = currentLayout(); return { src: L.src, n: L.fields.map(f => f.name), rows: L.fields[0].rows.length, t: L.fields[0].rows[0].tables, text: document.querySelector("#wmSrc").textContent }; });
  assert.deepStrictEqual(r, { src: "plan", n: ["A", "B"], rows: 15, t: 8, text: r.text }); assert.match(r.text, /לפי תוכנית שנקראה · 2 שדות · 30 שורות · 240 שולחנות/);
  assert.strictEqual(await page.evaluate(() => normLayout({ fields: [] })), null);
  await page.evaluate(() => openLayout()); await page.waitForTimeout(200);
  await page.click("#lyClearPlan"); await page.click("#lySave"); await page.waitForTimeout(400);
  assert.strictEqual(await page.evaluate(() => currentLayout().src), "map");
  await ctx.close();
});

test("תוכניות: העלאת תמונה (בלי אחסון קבצים נשמרת כ-data URL), פתיחה מהרשימה, מחיקה לבעלים", async () => {
  const { page, ctx, errors } = await openApp(browser, { mock: { seed: fixture } });
  assert.match(await page.evaluate(() => document.querySelector("#plansList").textContent), /אין עדיין תוכניות/);
  await page.click("#btnAddPlan"); await page.waitForTimeout(250);
  await page.setInputFiles("#apFile", { name: "EIT_M_90.png", mimeType: "image/png", buffer: PNG });
  assert.strictEqual(await page.inputValue("#apName"), "EIT_M_90");
  await page.click('#apKind [data-k="קונסטרוקציה"]'); await page.fill("#apRev", "rev00"); await page.click("#apSave"); await page.waitForTimeout(400);
  const docs = await page.evaluate(() => [...window.__MOCK_STORE__.entries()].filter(([k]) => k.startsWith("plans/")).map(([, v]) => ({ name: v.name, kind: v.kind, rev: v.rev, mime: v.mime, data: v.url.startsWith("data:image/png") })));
  assert.deepStrictEqual(docs, [{ name: "EIT_M_90", kind: "קונסטרוקציה", rev: "rev00", mime: "image/png", data: true }]);
  assert.match(await page.evaluate(() => document.querySelector("#plansList").textContent), /EIT_M_90 rev00קונסטרוקציה · תמונה/);
  assert.strictEqual(await page.evaluate(() => document.querySelector("#sum_plans").textContent), "1 תוכניות");
  await page.click("#plansList .slip"); await page.waitForTimeout(250);
  assert.deepStrictEqual(await page.evaluate(() => ({ img: !!document.querySelector(".wm-plan img"), read: !!document.querySelector("#plRead"), del: !!document.querySelector("#plDel") })), { img: true, read: true, del: true });
  await page.click("#plDel"); await page.waitForTimeout(150); await page.click(".scrim:last-of-type .save"); await page.waitForTimeout(400);
  assert.strictEqual(await page.evaluate(() => [...window.__MOCK_STORE__.keys()].filter(k => k.startsWith("plans/")).length), 0);
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});
