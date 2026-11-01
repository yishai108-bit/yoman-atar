// «משימות פתוחות» (גרסה 60): פתיחה עם מיקום ואחראי, סיכות על המפה, סגירה עם שם, מונה בלשונית, דוח שבועי, גיבוי;
// ואישור שלב בדיווח ביצוע עם חתימת המאשר (ראיה).
const test = require("node:test");
const assert = require("node:assert");
const { launch, openApp } = require("./helpers");
const fixture = require("./fixture");

const D = n => Date.now() - n * 864e5;
const iso = t => new Date(t).toISOString().slice(0, 10);
// משימות סינתטיות: פתוחה בשורות 3–4 במערב, פתוחה באיחור על ממיר 1.8, סגורה השבוע
const tasks = {
  t1: { id: "t1", ts: D(2), dateText: "30.10.2026", title: "שולחן עקום", areaId: "west", area: "מערב", rows: [3, 4], who: "קבלן קונסטרוקציה", due: iso(D(3)), by: "בודק", status: "open" },
  t2: { id: "t2", ts: D(6), dateText: "26.10.2026", title: "חסר מהדק בממיר", item: "1.8", who: "קבלן חשמל", due: iso(D(-1)), by: "בודק", status: "open" },
  t3: { id: "t3", ts: D(5), dateText: "27.10.2026", title: "בור פתוח ליד הדרך", areaId: "east", area: "מזרח", who: "קבלן עפר", by: "בודק", status: "done", doneTs: D(1), doneBy: "בודק", doneNote: "כוסה" },
};

let browser;
test.before(async () => { browser = await launch(); });
test.after(async () => { await browser.close(); });

test("בלי משימות: הכרטיס ריק, אין מונה בלשונית, 400px בלי גלילה אופקית", async () => {
  const { page, ctx, errors } = await openApp(browser, { mock: { seed: fixture } });
  assert.deepStrictEqual(errors, []);
  const r = await page.evaluate(() => ({ big: document.querySelector("#tkBig").textContent, badge: document.querySelector("#tabOverN").hidden, empty: !!document.querySelector("#tkList .empty"), key: document.querySelector("#wmTaskKey").hidden, overflow: document.documentElement.scrollWidth - window.innerWidth }));
  assert.strictEqual(r.big, "0"); assert.strictEqual(r.badge, true); assert.strictEqual(r.empty, true); assert.strictEqual(r.key, true);
  assert.ok(r.overflow <= 0, "גלילה אופקית: " + r.overflow + "px");
  await ctx.close();
});

test("משימות קיימות: מונה «פתוחות» בלשונית ובכרטיס, באיחור, סיכות על המפה (שורה וממיר), פירוט שורה, דוח שבועי וגיבוי", async () => {
  const { page, ctx, errors } = await openApp(browser, { mock: { seed: { ...fixture, tasks } } });
  assert.deepStrictEqual(errors, []);
  const r = await page.evaluate(() => {
    const S = taskStats(); const L = currentLayout(); const cv = document.querySelector("#wmCv"); const g = { s: (cv.clientWidth || 360) / L.w, zoom: false, W: cv.clientWidth || 360 };
    const EM = elecMarks(L, g); const M = taskMarks(L, g, EM);
    const D = wrData(new Date().toISOString().slice(0, 10)); const B = backupObject();
    return { S, badge: document.querySelector("#tabOverN").textContent, badgeLate: document.querySelector("#tabOverN").classList.contains("late"), big: document.querySelector("#tkBig").textContent, sub: document.querySelector("#tkSub").textContent,
      chips: [...document.querySelectorAll("#tkChips .chip2")].map(c => c.textContent.replace(/\s+/g, " ").trim()), slips: [...document.querySelectorAll("#tkList .tk-slip")].map(e => e.className + "|" + e.querySelector("b").textContent),
      marks: M.map(m => ({ key: m.key, n: m.list.length, late: m.late, x: Math.round(m.x), y: Math.round(m.y) })), keyShown: !document.querySelector("#wmTaskKey").hidden, wmSub: document.querySelector("#wmSub").textContent,
      fold: document.querySelector("#sum_tasks").textContent, wr: { open: D.tasks.open.map(t => t.id), late: D.tasks.late, doneWeek: D.tasks.doneWeek, flag: D.flags.some(f => /משימות פתוחות עברו/.test(f)) }, html: wrHtml("mgr", D).includes("שולחן עקום"), text: wrText("mgr", D),
      backup: (B.tasks || []).length, overflow: document.documentElement.scrollWidth - window.innerWidth };
  });
  assert.deepStrictEqual({ open: r.S.open, late: r.S.late, doneWeek: r.S.doneWeek }, { open: 2, late: 1, doneWeek: 1 });
  assert.strictEqual(r.badge, "2"); assert.strictEqual(r.badgeLate, true); assert.strictEqual(r.big, "2"); assert.match(r.sub, /1 באיחור/); assert.match(r.fold, /2 פתוחות · 1 באיחור/);
  assert.deepStrictEqual(r.chips, ["פתוחות 2", "באיחור 1", "נסגרו 1", "הכול 3"]);
  // ברירת המחדל: פתוחות בלבד, באיחור קודם (לפי תאריך היעד)
  assert.strictEqual(r.slips.length, 2); assert.match(r.slips[0], /late\|שולחן עקום/); assert.match(r.slips[1], /open\|חסר מהדק בממיר/);
  // שתי סיכות: שורה 3–4 במערב (אמצע = 3.5 → שורה 4), וליד ממיר 1.8
  assert.strictEqual(r.marks.length, 2, JSON.stringify(r.marks));
  assert.ok(r.marks.some(m => m.key === "r:west:4" && m.n === 1 && m.late), JSON.stringify(r.marks));
  assert.ok(r.marks.some(m => m.key === "i:1.8" && m.n === 1 && !m.late), JSON.stringify(r.marks));
  assert.strictEqual(r.keyShown, true); assert.match(r.wmSub, /2 משימות פתוחות במפה/);
  assert.deepStrictEqual(r.wr.open, ["t1", "t2"]); assert.strictEqual(r.wr.late, 1); assert.strictEqual(r.wr.doneWeek, 1); assert.strictEqual(r.wr.flag, true); assert.strictEqual(r.html, true);
  assert.match(r.text, /משימות פתוחות: 2 \(1 באיחור\)/);
  assert.strictEqual(r.backup, 3);
  assert.ok(r.overflow <= 0, "גלילה אופקית: " + r.overflow + "px");
  // הגדלת מערב ובחירת שורה 4: המשימה מופיעה בפירוט השורה; לחיצה פותחת אותה
  await page.evaluate(() => { const b = [...document.querySelectorAll("#wmPend .slip")].find(x => /מערב/.test(x.textContent)); b.click(); });
  await page.waitForTimeout(200);
  await page.evaluate(() => { const L = currentLayout(); window.__sel = null; });
  const rowTask = await page.evaluate(() => { const cv = document.querySelector("#wmCv"); const L = currentLayout(); const f = L.fields[0];
    // לחיצה על שורה 4 בהגדלה: מחשבים את מיקומה כמו הציור (שורות מלמטה למעלה)
    const rowH = Math.min(22, Math.max(12, Math.floor(300 / f.rows.length))); const i = f.rows.findIndex(r => r.n === 4); const y = 30 + (f.rows.length - 1 - i) * rowH + rowH * .31; const rect = cv.getBoundingClientRect();
    cv.dispatchEvent(new MouseEvent("click", { clientX: rect.left + rect.width / 2, clientY: rect.top + y, bubbles: true }));
    return [...document.querySelectorAll("#wmZoom [data-task]")].map(b => b.textContent); });
  assert.ok(rowTask.some(t => /שולחן עקום/.test(t)), JSON.stringify(rowTask));
  await page.click("#wmZoom [data-task]"); await page.waitForTimeout(150);
  assert.match(await page.evaluate(() => document.querySelector(".scrim .sheet h2").textContent), /שולחן עקום/);
  assert.match(await page.evaluate(() => document.querySelector(".scrim .tk-st").textContent), /באיחור/);
  await ctx.close();
});

test("זרימה: פתיחת משימה עם שדה ושורות ואחראי, סגירה עם שם, פתיחה מחדש; עורך יכול, צופה לא", async () => {
  const { page, ctx, errors } = await openApp(browser, { mock: { seed: fixture, role: "editor" } });
  await page.click("#btnAddTask"); await page.waitForTimeout(250);
  await page.fill("#tkTitle", "חסרים 2 מהדקים");
  await page.click('#lcF [data-f="east"]'); await page.waitForTimeout(200); await page.fill("#lcRows", "12–13");
  await page.fill("#tkWho", "קבלן קונסטרוקציה"); await page.fill("#tkDue", "2026-12-01"); await page.fill("#tkNote", "שולחן שלישי מהדרך"); await page.fill("#tkBy", "בודק");
  await page.click("#tkSave"); await page.waitForTimeout(400);
  assert.deepStrictEqual(errors, []);
  const saved = await page.evaluate(() => [...window.__MOCK_STORE__.entries()].filter(([k]) => k.startsWith("tasks/")).map(([, v]) => ({ title: v.title, areaId: v.areaId, rows: v.rows, who: v.who, due: v.due, status: v.status, by: v.by })));
  assert.deepStrictEqual(saved, [{ title: "חסרים 2 מהדקים", areaId: "east", rows: [12, 13], who: "קבלן קונסטרוקציה", due: "2026-12-01", status: "open", by: "בודק" }]);
  assert.strictEqual(await page.evaluate(() => document.querySelector("#tabOverN").textContent), "1");
  assert.ok((await page.evaluate(() => shared.logs.map(l => l.summary))).some(s => /משימה: חסרים 2 מהדקים · קבלן קונסטרוקציה · מזרח · שורות 12–13 · עד 1\.12/.test(s)));
  // סגירה
  await page.click("#tkList .tk-slip"); await page.waitForTimeout(200);
  await page.click("#tdClose"); await page.waitForTimeout(200);
  await page.fill("#tcNote", "הוחלפו"); await page.fill("#tcBy", "בודקת"); await page.click("#tcSave"); await page.waitForTimeout(400);
  const after = await page.evaluate(() => { const v = [...window.__MOCK_STORE__.values()].find(x => x.title === "חסרים 2 מהדקים"); return { status: v.status, doneBy: v.doneBy, doneNote: v.doneNote, hasTs: !!v.doneTs, badge: document.querySelector("#tabOverN").hidden, fold: document.querySelector("#sum_tasks").textContent, listOpen: document.querySelectorAll("#tkList .tk-slip").length }; });
  assert.deepStrictEqual(after, { status: "done", doneBy: "בודקת", doneNote: "הוחלפו", hasTs: true, badge: true, fold: "הכול סגור", listOpen: 0 });
  // «נסגרו» מציג אותה; פתיחה מחדש
  await page.click('#tkChips [data-k="done"]'); await page.waitForTimeout(100);
  await page.click("#tkList .tk-slip"); await page.waitForTimeout(150); await page.click("#tdReopen"); await page.waitForTimeout(150); await page.click(".scrim:last-of-type .save"); await page.waitForTimeout(300);
  assert.strictEqual(await page.evaluate(() => [...window.__MOCK_STORE__.values()].find(x => x.title === "חסרים 2 מהדקים").status), "open");
  await ctx.close();
  // צופה: אין כפתור הוספה ואין כפתורי סגירה
  const v = await openApp(browser, { mock: { seed: { ...fixture, tasks }, role: "viewer" } });
  const vis = await v.page.evaluate(() => { const b = document.querySelector("#btnAddTask"); return { addShown: !!b && getComputedStyle(b).display !== "none" }; });
  assert.strictEqual(vis.addShown, false);
  await v.page.click("#tkList .tk-slip"); await v.page.waitForTimeout(150);
  assert.strictEqual(await v.page.evaluate(() => !!document.querySelector("#tdClose") || !!document.querySelector("#tdEdit") || !!document.querySelector("#tdDel")), false);
  await v.ctx.close();
});

test("אישור מפקח בדיווח ביצוע: שדה החתימה מופיע רק בשלב «אושר», החתימה ושם המאשר נשמרים, והרשימה מסמנת «חתום»", async () => {
  const { page, ctx, errors } = await openApp(browser, { mock: { seed: fixture } });
  await page.click("#btnProgress"); await page.waitForTimeout(250);
  assert.strictEqual(await page.evaluate(() => document.querySelector("#pgSigF").hidden), true);
  await page.click('#pgStage [data-s="ok"]'); await page.waitForTimeout(150);
  assert.strictEqual(await page.evaluate(() => document.querySelector("#pgSigF").hidden), false);
  await page.fill("#pgApprover", "מפקח א"); await page.fill("#pgBy", "בודק");
  // חתימה: קו על הקנבס
  await page.evaluate(() => document.querySelector("#pgSig").scrollIntoView({ block: "center" })); await page.waitForTimeout(100);
  const bb = await (await page.$("#pgSig canvas")).boundingBox();
  await page.mouse.move(bb.x + 20, bb.y + 40); await page.mouse.down(); await page.mouse.move(bb.x + 120, bb.y + 80, { steps: 6 }); await page.mouse.up();
  await page.click("#pgSave"); await page.waitForTimeout(400);
  assert.deepStrictEqual(errors, []);
  const r = await page.evaluate(() => { const v = [...window.__MOCK_STORE__.entries()].filter(([k]) => k.startsWith("progress/")).map(([, v]) => v)[0]; return { stage: v.stage, approver: v.approver, sig: String(v.sigData || "").slice(0, 15), ev: [...document.querySelectorAll("#conProg .pg-ev i")].map(e => e.textContent), log: shared.logs[0] && shared.logs[0].summary }; });
  assert.strictEqual(r.stage, "ok"); assert.strictEqual(r.approver, "מפקח א"); assert.strictEqual(r.sig, "data:image/png;"); assert.deepStrictEqual(r.ev, ["חתום"]);
  assert.match(r.log, /אישר: מפקח א · חתום/);
  // לחיצה על הדיווח פותחת את הראיה
  await page.evaluate(() => { document.querySelector("#conProg").closest(".card").classList.remove("folded"); document.querySelector("#conProg .slip").click(); }); await page.waitForTimeout(150);
  assert.ok(await page.evaluate(() => !!document.querySelector(".scrim img.sigimg")));
  await ctx.close();
});
