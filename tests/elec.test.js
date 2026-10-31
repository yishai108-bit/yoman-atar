// «חשמל לפי ממיר» (גרסה 58): מבנה החשמל מהתוכנית / ממספרים, עדכון מצב לממיר ולתחנה, «מה עוד לא בוצע», הרשאות, גיבוי.
const test = require("node:test");
const assert = require("node:assert");
const { launch, openApp } = require("./helpers");
const fixture = require("./fixture");
const { build, forSite } = require("../tools/build");
const path = require("path");
const fs = require("fs");

const D = n => Date.now() - n * 864e5;
// עדכונים סינתטיים: ממיר 1.8 פעמיים (האחרון קובע), ממיר 2.3 גמור, תחנה 1 הוצבה
const elec = {
  e1: { id: "e1", ts: D(5), dateText: "26.10.2026", item: "1.8", kind: "inv", strings: 6, disc: false, ac: false, com: false, who: "קבלן חשמל", by: "בודק" },
  e2: { id: "e2", ts: D(2), dateText: "29.10.2026", item: "1.8", kind: "inv", strings: 12, disc: true, ac: false, com: false, who: "קבלן חשמל", by: "בודק" },
  e3: { id: "e3", ts: D(1), dateText: "30.10.2026", item: "2.3", kind: "inv", strings: 19, disc: true, ac: true, com: true, who: "קבלן חשמל", by: "בודק" },
  e4: { id: "e4", ts: D(1), dateText: "30.10.2026", item: "S1", kind: "st", place: true, mv: false, lv: false, who: "קבלן חשמל", by: "בודק" },
};

let browser;
test.before(async () => { browser = await launch(); });
test.after(async () => { await browser.close(); });

test("עין תמר: מבנה החשמל מובנה מהתוכנית: 2 תחנות, 4 ICB, 37 ממירים, 690 סטרינגים; בלי עדכונים הכול «עוד לא התחילו»", async () => {
  const { page, ctx, errors } = await openApp(browser, { mock: { seed: fixture } });
  assert.deepStrictEqual(errors, []);
  const r = await page.evaluate(() => { const E = currentElec(); const it = elecItems(E); return { src: E.src, st: E.stations.length, icb: E.stations.reduce((s, x) => s + x.icbs.length, 0), inv: it.filter(x => x.kind === "inv").length, strings: it.filter(x => x.kind === "inv").reduce((s, x) => s + x.strings, 0), sum: elecSummary(E), big: document.querySelector("#elBig").textContent, tiles: document.querySelectorAll("#elecCard .el-inv").length, pend: [...document.querySelectorAll("#elPend .slip")].map(e => e.textContent), fold: document.querySelector("#sum_elec").textContent }; });
  assert.notStrictEqual(r.src, "gen"); assert.strictEqual(r.st, 2); assert.strictEqual(r.icb, 4); assert.strictEqual(r.inv, 37); assert.strictEqual(r.strings, 690);
  assert.match(r.sum, /2 תחנות · 37 ממירים · 690 סטרינגים/);
  assert.strictEqual(r.big, "0 / 690"); assert.strictEqual(r.tiles, 37);
  assert.ok(r.pend.some(t => /37 ממירים/.test(t) && /עוד לא התחילו: 1\.1–1\.18, 2\.1–2\.19/.test(t)), r.pend.join(" | "));
  assert.ok(r.pend.some(t => /תחנה 1: הוצבה, מ״ג מחובר, LV מחובר/.test(t)));
  assert.match(r.fold, /0 \/ 690 סטרינגים/);
  await ctx.close();
});

test("עדכוני מצב: האחרון לכל פריט קובע; הסיכומים, האריחים ו«מה עוד לא בוצע» נגזרים מהמצב", async () => {
  const { page, ctx, errors } = await openApp(browser, { mock: { seed: { ...fixture, elec } } });
  assert.deepStrictEqual(errors, []);
  const r = await page.evaluate(() => {
    const E = currentElec(), S = elecState(shared.ELEC), T = elecTotals(E, S), P = elecPending(E, S);
    const tile = id => { const b = document.querySelector('#elecCard .el-inv[data-inv="' + id + '"]'); return { cls: b.className, n: b.querySelector(".el-n").textContent, w: b.querySelector(".el-bar i").style.width, label: b.getAttribute("aria-label") }; };
    return { s18: S["1.8"].strings, T, P: P.map(p => [p.k, p.n, p.text]), t18: tile("1.8"), t23: tile("2.3"), t11: tile("1.1"), big: document.querySelector("#elBig").textContent, sub: document.querySelector("#elSub").textContent, st1: document.querySelector("#elStations .el-st").textContent, st1on: document.querySelectorAll("#elStations .el-st:first-child .el-flags i.on").length };
  });
  assert.strictEqual(r.s18, 12, "העדכון האחרון של 1.8 קובע (12, לא 6)");
  assert.strictEqual(r.T.connected, 31); assert.strictEqual(r.T.dcFull, 1); assert.strictEqual(r.T.disc, 2); assert.strictEqual(r.T.ac, 1); assert.strictEqual(r.T.com, 1); assert.strictEqual(r.T.done, 1); assert.strictEqual(r.T.started, 2);
  assert.strictEqual(r.big, "31 / 690");
  assert.match(r.sub, /DC מלא 1 · מנתק 2 · AC 1 · תקשורת 1 · גמורים 1/);
  assert.match(r.t18.n, /^12\/19$/); assert.strictEqual(r.t18.w, "63%"); assert.match(r.t18.cls, /\bon\b/); assert.match(r.t18.cls, /\brecent\b/); assert.match(r.t18.label, /מנתק/);
  assert.match(r.t23.cls, /\bdone\b/); assert.strictEqual(r.t23.w, "100%");
  assert.doesNotMatch(r.t11.cls, /\bon\b|\bdone\b/);
  const none = r.P.find(p => p[0] === "none"); assert.strictEqual(none[1], 35); assert.match(none[2], /1\.1–1\.7, 1\.9–1\.18, 2\.1–2\.2, 2\.4–2\.19/);
  assert.deepStrictEqual(r.P.find(p => p[0] === "dc").slice(1), [1, "סטרינגים בחיבור: 1.8"]);
  assert.ok(!r.P.some(p => p[0] === "disc"), "אין ממיר עם DC גמור בלי מנתק");
  assert.ok(r.P.some(p => p[0] === "st" && /תחנה 1: מ״ג מחובר, LV מחובר/.test(p[2])));
  assert.strictEqual(r.st1on, 1, "תחנה 1: רק «הוצבה» מסומן");
  await ctx.close();
});

test("עדכון מצב מהמסך: לחיצה על ממיר → «עדכון מצב» → סטרינגים ומנתק → נשמר ב-elec/ ומופיע באריח; תחנה דרך הבורר", async () => {
  const { page, ctx, errors } = await openApp(browser, { mock: { seed: fixture } });
  await page.evaluate(() => document.querySelector("#elecCard").scrollIntoView({ block: "center" }));
  await page.click('#elecCard .el-inv[data-inv="1.3"]');
  await page.waitForSelector("#eiUpd");
  assert.match(await page.textContent(".sheet h2"), /ממיר 1\.3/);
  await page.click("#eiUpd");
  await page.waitForSelector("#erSave");
  assert.strictEqual(await page.inputValue("#erItem"), "1.3");
  await page.fill("#erStr", "7"); await page.dispatchEvent("#erStr", "change");
  await page.click("#erPlus");
  await page.click('#erFlags [data-k="disc"]');
  await page.fill("#erWho", "קבלן חשמל"); await page.fill("#erBy", "בודק");
  await page.click("#erSave");
  await page.waitForSelector("#erSave", { state: "detached" });
  await page.waitForFunction(() => shared.ELEC.length === 1 && document.querySelector('#elecCard .el-inv[data-inv="1.3"] .el-n').textContent === "8/18");
  const r = await page.evaluate(() => { const b = document.querySelector('#elecCard .el-inv[data-inv="1.3"]'); return { docs: shared.ELEC.map(x => ({ item: x.item, strings: x.strings, disc: x.disc, ac: x.ac, kind: x.kind, who: x.who })), n: b.querySelector(".el-n").textContent, big: document.querySelector("#elBig").textContent, log: (shared.logs || []).map(l => l.summary).find(s => /חשמל/.test(s)) }; });
  assert.deepStrictEqual(r.docs, [{ item: "1.3", strings: 8, disc: true, ac: false, kind: "inv", who: "קבלן חשמל" }]);
  assert.strictEqual(r.n, "8/18"); assert.strictEqual(r.big, "8 / 690");
  assert.match(r.log || "", /ממיר 1\.3: 8 \/ 18 סטרינגים · מנתק מותקן/);
  // תחנה 2: הוצבה + מ״ג, דרך «+ עדכון מצב» והבורר
  await page.click("#btnElecReport"); await page.waitForSelector("#erSave");
  await page.selectOption("#erItem", "S2");
  await page.waitForSelector('#erFlags [data-k="place"]');
  assert.strictEqual(await page.$("#erStr"), null, "לתחנה אין סטרינגים");
  await page.click('#erFlags [data-k="place"]'); await page.click('#erFlags [data-k="mv"]');
  await page.click("#erSave"); await page.waitForSelector("#erSave", { state: "detached" });
  await page.waitForFunction(() => shared.ELEC.some(x => x.item === "S2") && document.querySelectorAll("#elStations .el-st:nth-of-type(2) .el-flags i.on").length === 2);
  const s = await page.evaluate(() => ({ st: shared.ELEC.find(x => x.item === "S2"), on: document.querySelectorAll("#elStations .el-st:nth-of-type(2) .el-flags i.on").length, pend: [...document.querySelectorAll("#elPend .slip")].map(e => e.textContent) }));
  assert.strictEqual(s.st.kind, "st"); assert.strictEqual(s.st.place, true); assert.strictEqual(s.st.mv, true); assert.strictEqual(s.st.lv, false); assert.strictEqual(s.st.strings, undefined);
  assert.ok(s.pend.some(t => /תחנה 2: LV מחובר$/.test(t)), s.pend.join(" | "));
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});

test("צופה: רואה את הכרטיס, בלי «עדכון מצב» ובלי «מבנה החשמל»", async () => {
  const { page, ctx, errors } = await openApp(browser, { mock: { seed: { ...fixture, elec }, role: "viewer" } });
  assert.deepStrictEqual(errors, []);
  const r = await page.evaluate(() => ({ tiles: document.querySelectorAll("#elecCard .el-inv").length, add: document.querySelector("#btnElecReport").hidden || getComputedStyle(document.querySelector("#btnElecReport")).display === "none", setup: document.querySelector("#elSetup").hidden }));
  assert.strictEqual(r.tiles, 37); assert.ok(r.add); assert.ok(r.setup);
  await page.evaluate(() => document.querySelector("#elecCard").scrollIntoView({ block: "center" }));
  await page.click('#elecCard .el-inv[data-inv="1.8"]');
  await page.waitForSelector(".sheet h2");
  assert.strictEqual(await page.$("#eiUpd"), null);
  await ctx.close();
});

test("מולדת: אין מבנה חשמל מתוכנית → בעלים קובע מספרים (2 תחנות × 10 ממירים × 18) → 20 ממירים, 360 סטרינגים; «נקה» מחזיר לריק", async () => {
  const out = path.join(__dirname, "out"); fs.mkdirSync(out, { recursive: true });
  const f = path.join(out, "moledet-elec.html"); fs.writeFileSync(f, forSite(build(), "מולדת"));
  const { page, ctx, errors } = await openApp(browser, { mock: { seed: {} }, file: f });
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(await page.evaluate(() => currentElec()), null);
  assert.strictEqual(await page.evaluate(() => document.querySelector("#elEmpty").hidden), false);
  await page.evaluate(() => document.querySelector("#elecCard").scrollIntoView({ block: "center" }));
  await page.click("#elSetup"); await page.waitForSelector("#esSave");
  await page.fill("#esSt", "2"); await page.fill("#esInv", "10"); await page.fill("#esStr", "18");
  await page.click("#esSave"); await page.waitForSelector("#esSave", { state: "detached" });
  await page.waitForFunction(() => currentElec() && currentElec().src === "gen");
  const r = await page.evaluate(() => ({ sum: elecSummary(currentElec()), tiles: document.querySelectorAll("#elecCard .el-inv").length, big: document.querySelector("#elBig").textContent, src: document.querySelector("#elSrc").textContent }));
  assert.match(r.sum, /2 תחנות · 20 ממירים · 360 סטרינגים/); assert.strictEqual(r.tiles, 20); assert.strictEqual(r.big, "0 / 360"); assert.match(r.src, /לפי המספרים בהגדרות/);
  await page.click("#elSetup"); await page.waitForSelector("#esClear"); await page.click("#esClear");
  await page.waitForSelector(".sheet[role=alertdialog] .save"); await page.click(".sheet[role=alertdialog] .save");
  await page.waitForFunction(() => !currentElec());
  assert.strictEqual(await page.evaluate(() => document.querySelector("#elEmpty").hidden), false);
  await ctx.close();
});

test("גיבוי מלא כולל elec; ייצוא לאקסל כולל חשמל.csv", async () => {
  const { page, ctx, errors } = await openApp(browser, { mock: { seed: { ...fixture, elec } } });
  assert.deepStrictEqual(errors, []);
  const r = await page.evaluate(() => { const o = backupObject(); return { n: (o.elec || []).length, items: o.elec.map(x => x.item).sort() }; });
  assert.strictEqual(r.n, 4); assert.deepStrictEqual(r.items, ["1.8", "1.8", "2.3", "S1"]);
  const csv = await page.evaluate(() => csvOf(["תאריך", "פריט", "סטרינגים"], shared.ELEC.slice().sort((a, b) => a.ts - b.ts).map(x => [x.dateText, x.kind === "st" ? x.item : "ממיר " + x.item, x.kind === "inv" ? x.strings : ""])));
  assert.match(csv, /ממיר 1\.8/); assert.match(csv, /S1/);
  await ctx.close();
});
