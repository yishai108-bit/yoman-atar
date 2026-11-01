// שכבת חשמל במפה (גרסה 59): הממירים והתחנות של עין תמר מצוירים על «מה בוצע במפה» לפי מיקומם בתוכנית, בצבע המצב; לחיצה פותחת ממיר; הצגה/הסתרה; אתר בלי מפה בלי שכבה.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { launch, openApp, ROOT } = require("./helpers");
const fixture = require("./fixture");
const { build, forSite } = require("../tools/build");

const D = n => Date.now() - n * 864e5;
const elec = {
  e1: { id: "e1", ts: D(5), dateText: "26.10.2026", item: "1.8", kind: "inv", strings: 6, who: "קבלן חשמל", by: "בודק" },
  e2: { id: "e2", ts: D(2), dateText: "29.10.2026", item: "1.8", kind: "inv", strings: 12, disc: true, who: "קבלן חשמל", by: "בודק" },
  e3: { id: "e3", ts: D(1), dateText: "30.10.2026", item: "2.3", kind: "inv", strings: 19, disc: true, ac: true, com: true, who: "קבלן חשמל", by: "בודק" },
  e4: { id: "e4", ts: D(1), dateText: "30.10.2026", item: "S1", kind: "st", place: true, who: "קבלן חשמל", by: "בודק" },
  e5: { id: "e5", ts: D(12), dateText: "19.10.2026", item: "2.4", kind: "inv", strings: 9, who: "קבלן חשמל", by: "בודק" },
  e6: { id: "e6", ts: D(12), dateText: "19.10.2026", item: "S2", kind: "st", place: true, mv: true, lv: true, who: "קבלן חשמל", by: "בודק" },
};
// הסימונים בגיאומטריית המפה השלמה, עם מיקום במסך
const MARKS = `(() => { const L = currentLayout(), cv = document.querySelector("#wmCv"), b = cv.getBoundingClientRect(); const g = { s: cv.clientWidth / L.w, zoom: false }; return elecMarks(L, g).map(m => ({ id: m.id, kind: m.kind, k: m.k, fr: m.fr, recent: m.recent, x: m.x, y: m.y, sx: b.left + m.x, sy: b.top + m.y, W: cv.clientWidth, H: cv.clientHeight })); })()`;

let browser;
test.before(async () => { browser = await launch(); });
test.after(async () => { await browser.close(); });

test("עין תמר: 37 ממירים ו-2 תחנות ממוקמים על המפה בתוך השדות, בצבע לפי המצב האחרון; המקרא מוצג", async () => {
  const { page, ctx, errors } = await openApp(browser, { mock: { seed: { ...fixture, elec } } });
  assert.deepStrictEqual(errors, []);
  const M = await page.evaluate(MARKS);
  assert.strictEqual(M.length, 39); assert.strictEqual(M.filter(m => m.kind === "inv").length, 37);
  assert.strictEqual(new Set(M.map(m => m.id)).size, 39);
  assert.ok(M.every(m => m.x >= 0 && m.x <= m.W && m.y >= 0 && m.y <= m.H), "סימון מחוץ לקנבס");
  const F = await page.evaluate(() => { const L = currentLayout(), s = document.querySelector("#wmCv").clientWidth / L.w; return { westR: (L.fields[0].x + L.fields[0].w) * s, eastL: L.fields[1].x * s, westTopY: L.fields[0].y * s, westBotY: (L.fields[0].y + L.fields[0].h) * s }; });
  const by = id => M.find(m => m.id === id);
  // 1.8 ממזרח לדרך (בחצי המזרחי) אף שהוא של תחנה 1; 1.12 בדרום-מערב; 1.1 בצפון-מערב; תחנה 1 בקצה המערבי
  assert.ok(by("1.8").x > F.eastL && by("1.8").x > by("1.1").x, "1.8 בחצי המזרחי");
  assert.ok(by("1.1").x < F.westR && by("1.12").x < F.westR, "1.1 ו-1.12 במערב");
  assert.ok(by("1.1").y < by("1.4").y && by("1.4").y < by("1.12").y, "שורה גבוהה יותר = למעלה");
  assert.ok(by("S1").x < by("1.12").x && by("S2").x > by("2.12").x - 1, "התחנות בקצוות");
  assert.ok(by("S1").y > F.westTopY && by("S1").y < F.westBotY);
  // מצב: 1.8 מנתק (האחרון קובע), 2.3 גמור, 2.4 סטרינגים חלקי 9/18, S1 בתהליך, S2 גמורה, 1.3 עוד לא
  assert.deepStrictEqual([by("1.8").k, by("2.3").k, by("2.4").k, by("S1").k, by("S2").k, by("1.3").k], ["disc", "com", "dc", "disc", "com", "none"]);
  assert.strictEqual(by("2.4").fr, 0.5); assert.strictEqual(by("1.8").recent, true); assert.strictEqual(by("2.4").recent, false);
  const leg = await page.evaluate(() => ({ hidden: document.querySelector("#wmEl").hidden, text: document.querySelector("#wmEl").textContent, keys: document.querySelectorAll("#wmEl span").length }));
  assert.strictEqual(leg.hidden, false); assert.strictEqual(leg.keys, 6); assert.match(leg.text, /עוד לא.*סטרינגים.*מנתק.*AC.*גמור.*תחנה.*הסתר חשמל/);
  await ctx.close();
});

test("לחיצה על ממיר במפה פותחת אותו; «הסתר חשמל» מסתיר את השכבה ואז הלחיצה מגדילה את השדה; ההעדפה נשמרת", async () => {
  const { page, ctx, errors } = await openApp(browser, { mock: { seed: { ...fixture, elec } } });
  await page.evaluate(() => document.querySelector("#wmCv").scrollIntoView({ block: "center" })); await page.waitForTimeout(100);
  let m = (await page.evaluate(MARKS)).find(x => x.id === "2.3");
  await page.mouse.click(m.sx, m.sy); await page.waitForSelector(".sheet[role=dialog] h2");
  assert.match(await page.textContent(".sheet[role=dialog] h2"), /ממיר 2\.3/);
  assert.match(await page.textContent(".sheet[role=dialog]"), /תחנה 2 · מזרח · ICB 2\.1 · 19 סטרינגים/);
  await page.click(".sheet[role=dialog] .cancel"); await page.waitForSelector(".sheet[role=dialog]", { state: "detached" });
  assert.strictEqual(await page.evaluate(() => document.querySelector("#wmZoom").hidden), true, "לחיצה על ממיר לא מגדילה שדה");
  // הסתרה
  await page.click("#wmElT"); await page.waitForTimeout(150);
  const off = await page.evaluate(() => ({ text: document.querySelector("#wmEl").textContent, ls: localStorage.getItem("yoman_wmElec") || localStorage.getItem("wmElec") || [...Object.keys(localStorage)].filter(k => /wmElec/.test(k)).map(k => localStorage.getItem(k)).join("") }));
  assert.match(off.text, /חשמל: 37 ממירים, אחד גמור.*הצג חשמל/); assert.match(off.ls, /0/);
  await page.evaluate(() => document.querySelector("#wmCv").scrollIntoView({ block: "center" })); await page.waitForTimeout(100);
  await page.mouse.click(m.sx, m.sy); await page.waitForTimeout(200);
  assert.strictEqual(await page.evaluate(() => document.querySelector(".sheet[role=dialog]")), null, "בלי שכבה אין חלון ממיר");
  assert.match(await page.evaluate(() => document.querySelector("#wmZoom").textContent), /מזרח · לחצו על שורה/);
  // חזרה: הצגה; בהגדלה רואים רק את ממירי השדה, עם תווית
  await page.click("#wmElT"); await page.waitForTimeout(150);
  const z = await page.evaluate(() => { const L = currentLayout(), cv = document.querySelector("#wmCv"), f = L.fields[1]; const rowH = Math.min(22, Math.max(12, Math.floor(300 / f.rows.length))); const W = cv.clientWidth; const g = { W, zoom: true, f, rows: f.rows.map((r, i) => ({ r, x: 44, y: 30 + (f.rows.length - 1 - i) * rowH, w: W - 60, h: rowH * .62 })) }; const M = elecMarks(L, g); return { n: M.length, inv: M.filter(m => m.kind === "inv").map(m => m.id), st: M.filter(m => m.kind === "st").map(m => m.id), inside: M.every(m => m.x >= 20 && m.x <= W && m.y >= 0 && m.y <= cv.clientHeight), hint: document.querySelector("#wmZoom").textContent }; });
  assert.strictEqual(z.n, 22); assert.deepStrictEqual(z.st, ["S2"]); assert.ok(z.inv.includes("1.8") && z.inv.includes("1.18") && !z.inv.includes("1.9"), z.inv.join(","));
  assert.ok(z.inside); assert.match(z.hint, /ממירים בשדה: 21/);
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});

test("עדכון מצב מהכרטיס צובע את הממיר במפה מיד (מהמאגר) ובלי מאגר (מקומי)", async () => {
  for (const nodb of [false, true]) {
    const { page, ctx, errors } = await openApp(browser, { mock: nodb ? { noDb: true } : { seed: fixture } });
    const before = (await page.evaluate(MARKS)).find(x => x.id === "1.3");
    assert.strictEqual(before.k, "none");
    await page.evaluate(() => document.querySelector("#elecCard").scrollIntoView({ block: "center" }));
    await page.click('#elecCard .el-inv[data-inv="1.3"]'); await page.waitForSelector("#eiUpd"); await page.click("#eiUpd"); await page.waitForSelector("#erSave");
    await page.fill("#erStr", "18"); await page.dispatchEvent("#erStr", "change"); await page.click('#erFlags [data-k="disc"]'); await page.click('#erFlags [data-k="ac"]');
    await page.fill("#erWho", "קבלן חשמל"); await page.fill("#erBy", "בודק"); await page.click("#erSave");
    await page.waitForSelector("#erSave", { state: "detached" });
    await page.waitForFunction(() => shared.ELEC.length === 1);
    await page.waitForTimeout(150);
    const after = (await page.evaluate(MARKS)).find(x => x.id === "1.3");
    assert.strictEqual(after.k, "ac", "nodb=" + nodb); assert.strictEqual(after.fr, 1); assert.strictEqual(after.recent, true);
    assert.deepStrictEqual(errors, []);
    await ctx.close();
  }
});

test("מולדת (בלי מפת שולחנות): אין שכבת חשמל ואין מקרא, גם אחרי מבנה ממספרים; המפה הקטנה בטופס הדיווח נקייה", async () => {
  const sites = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "sites.json"), "utf8"));
  const dir = path.join(ROOT, "tests", "out"); fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "moledet-elec-map.html"); fs.writeFileSync(file, forSite(build(), sites["moledet"]));
  const { page, errors, ctx } = await openApp(browser, { file, mock: { seed: { ...fixture, settings: { ...(fixture.settings || {}), layout: { gen: { fields: 2, rows: 12, tables: 9, names: "צפון, דרום" } }, elec: { gen: { stations: 2, inv: 10, strings: 18 } } } } } });
  assert.deepStrictEqual(errors, []);
  const r = await page.evaluate(() => { const L = currentLayout(); return { src: L && L.src, marks: elecMarks(L, { s: 1, zoom: false }).length, leg: document.querySelector("#wmEl").hidden, tiles: document.querySelectorAll("#elecCard .el-inv").length }; });
  assert.strictEqual(r.src, "gen"); assert.strictEqual(r.marks, 0); assert.strictEqual(r.leg, true); assert.strictEqual(r.tiles, 20);
  await ctx.close();
  // עין תמר: המפה הקטנה בטופס דיווח הביצוע בלי השכבה (paint עם elec:false)
  const et = await openApp(browser, { mock: { seed: { ...fixture, elec } } });
  await et.page.click("#btnProgress"); await et.page.waitForSelector("#lcCv");
  const ok = await et.page.evaluate(() => { const L = currentLayout(); return typeof drawMini === "function" && elecMarks(L, { s: 1, zoom: false }).length === 39; });
  assert.ok(ok);
  await et.ctx.close();
});
