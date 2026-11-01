// הגרסה לאירוח עצמאי (Vercel + Supabase): כניסה, מסך חברה, בחירת אתר, האפליקציה מול שכבת החיבור, הרשאת צופה.
// Supabase מדומה (tests/mock-supabase.js); הבנייה dist/cloud/index.html נוצרת כאן אם צריך.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { launch, ROOT } = require("./helpers.js");
const { buildCloud, CLOUD_DIR } = require("../tools/build.js");

const FILE = path.join(CLOUD_DIR, "index.html");
const MOCK = fs.readFileSync(path.join(__dirname, "mock-supabase.js"), "utf8");
const ISO = t => new Date(t).toISOString().slice(0, 10);
const D = n => Date.now() + n * 864e5;
const SEED = {
  users: [{ id: "u1", email: "yishai@test.local", password: "secret12", name: "ישי" }],
  sites: [{ id: "s1", slug: "ein-tamar", name: "אתר הקמה עין תמר" }, { id: "s2", slug: "moledet", name: "אתר הקמה מולדת" }],
  members: [{ site_id: "s1", user_id: "u1", role: "owner" }, { site_id: "s2", user_id: "u1", role: "viewer" }],
  docs: [
    { site_id: "s1", coll: "settings", id: "site", data: { name: "אתר הקמה עין תמר", company: "BELECTRIC", panelsPerTable: 81, ts: 1 } },
    { site_id: "s1", coll: "status", id: "a1", data: { id: "a1", name: "פאנלים מותקנים", total: 18630, workDays: 120, order: 4, daily: [{ date: "2026-10-20", actual: 4000 }, { date: "2026-10-27", actual: 4910 }], ts: 2 } },
    { site_id: "s1", coll: "tasks", id: "t1", data: { id: "t1", ts: D(-3), status: "open", title: "להחליף ממיר 1.8", item: "1.8", who: "תום", due: ISO(D(-1)), by: "ישי" } },
    { site_id: "s1", coll: "tasks", id: "t2", data: { id: "t2", ts: D(-5), status: "done", title: "לנקות שורה 3", who: "תום", doneTs: D(-1), doneBy: "תום" } },
    { site_id: "s1", coll: "log", id: "lg1", data: { id: "lg1", ts: D(-1), kind: "task", action: "add", summary: "משימה", who: "ישי" } },
    { site_id: "s2", coll: "settings", id: "site", data: { name: "אתר הקמה מולדת", company: "BELECTRIC", panelsPerTable: 81, ts: 1 } },
  ],
};

async function open(browser, { query = "", width = 400, seed = SEED } = {}){
  const ctx = await browser.newContext({ viewport: { width, height: 860 }, deviceScaleFactor: 1, locale: "he-IL" });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", e => errors.push(String(e)));
  await page.route(/^https?:\/\//, r => r.abort());
  await page.addInitScript(`window.__SB_URL="https://fake.supabase.co";window.__SB_KEY="anon";window.__SB__=${JSON.stringify(seed)};\n${MOCK}`);
  await page.goto("file://" + FILE + query);
  await page.waitForTimeout(400);
  return { page, ctx, errors };
}

test.before(() => { if (!fs.existsSync(FILE)) buildCloud(); });

test("כניסה: מסך בלי גלילה אופקית ב-400px, סיסמה שגויה, ואז רשימת האתרים עם % ומשימות", async () => {
  const browser = await launch();
  try {
    const { page, ctx, errors } = await open(browser);
    assert.ok(await page.isVisible("#cfLogin"), "מסך הכניסה");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= 400), "בלי גלילה אופקית");
    await page.fill("#cfEmail", "yishai@test.local"); await page.fill("#cfPass", "wrong1234"); await page.click("#cfGo");
    await page.waitForSelector("#cfErr:not([hidden])");
    assert.match(await page.textContent("#cfErr"), /לא נכונים/);
    await page.fill("#cfPass", "secret12"); await page.click("#cfGo");
    await page.waitForSelector("#cfSites");
    await page.waitForFunction(() => /%/.test(document.querySelector('[data-slug="ein-tamar"] .cs-pct').textContent), null, { timeout: 4000 });
    const et = await page.textContent('[data-slug="ein-tamar"]');
    assert.match(et, /48%/); assert.match(et, /8,910 מתוך 18,630 פאנלים/); assert.match(et, /1 משימות פתוחות · 1 באיחור/); assert.match(et, /בעלים/);
    const md = await page.textContent('[data-slug="moledet"]');
    assert.match(md, /—/); assert.match(md, /אין משימות פתוחות/); assert.match(md, /צפייה/);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= 400));
    // בחירת אתר טוענת מחדש עם ?site=
    await page.click('[data-slug="ein-tamar"]');
    await page.waitForFunction(() => location.search.includes("site=ein-tamar") && document.querySelector("#tkBig"), null, { timeout: 8000 });
    await page.waitForTimeout(500);
    assert.deepEqual(errors, []);
    await ctx.close();
  } finally { await browser.close(); }
});

test("באתר: הכותרת מהמאגר, המשימות נטענות, שמירה עוברת ל-upsert, היומן ממוין, קבצים ל-Storage, מסך חברה מהכותרת", async () => {
  const browser = await launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 1, locale: "he-IL" });
    const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
    await page.route(/^https?:\/\//, r => r.abort());
    await page.addInitScript(`window.__SB_URL="https://fake.supabase.co";window.__SB_KEY="anon";window.__SB__=${JSON.stringify(SEED)};localStorage.setItem("demoDoneS","1");localStorage.setItem("demoDone","1");localStorage.setItem("__fake_sb_session",JSON.stringify({access_token:"t",user:{id:"u1",email:"yishai@test.local",user_metadata:{name:"ישי"}}}));\n${MOCK}`);
    await page.goto("file://" + FILE + "?site=ein-tamar");
    await page.waitForFunction(() => window.shared && window.shared.DB && window.shared.TASKS && window.shared.TASKS.length === 2, null, { timeout: 8000 });
    assert.equal(await page.textContent("#siteName"), "BELECTRICאתר הקמה עין תמר");
    assert.equal(await page.textContent("#tkBig"), "1");
    assert.equal(await page.textContent("#tabOverN"), "1");
    assert.equal(await page.evaluate(() => document.body.classList.contains("r-owner")), true);
    assert.equal(await page.evaluate(() => window.blobUrl("ein-tamar/a.jpg")), "https://fake.supabase.co/storage/v1/object/public/assets/ein-tamar/a.jpg");
    // כתיבה: המטמון והמסך מתעדכנים, והשורה נכתבת ל-docs
    await page.evaluate(() => window.shared.DB.doc("tasks/t3").set({ id: "t3", ts: Date.now(), status: "open", title: "בדיקה", who: "ישי", by: "ישי" }));
    await page.waitForFunction(() => document.querySelector("#tkBig").textContent === "2");
    const w = await page.evaluate(() => window.__SB_WRITES__);
    assert.deepEqual(w, [["upsert", "tasks/t3"]]);
    // update ממזג, delete מוחק
    await page.evaluate(() => window.shared.DB.doc("tasks/t3").update({ who: "תום" }));
    assert.equal(await page.evaluate(() => window.__SB_DOCS__.find(d => d.id === "t3").data.who), "תום");
    assert.equal(await page.evaluate(() => window.__SB_DOCS__.find(d => d.id === "t3").data.title), "בדיקה");
    await page.evaluate(() => window.shared.DB.doc("tasks/t3").delete());
    await page.waitForFunction(() => document.querySelector("#tkBig").textContent === "1");
    // יומן פעולות: שאילתה עם orderBy/limit
    const logs = await page.evaluate(async () => { const s = await window.shared.DB.collection("log").orderBy("ts", "desc").limit(400).get(); return s.docs.map(d => d.id); });
    assert.ok(logs.includes("lg1"));
    // קובץ: עולה ל-Storage ומקבל כתובת ציבורית
    const up = await page.evaluate(async () => window.shared.ASSETS.upload(new Blob(["x"], { type: "image/jpeg" })));
    assert.match(up.id, /^ein-tamar\/.+\.jpg$/); assert.match(up.url, /^https:\/\/fake\.supabase\.co\/storage\/v1\/object\/public\/assets\/ein-tamar\//);
    // זמן אמת: אירוע על tasks טוען מחדש את האוסף
    await page.evaluate(() => { window.__SB_DOCS__.push({ site_id: "s1", coll: "tasks", id: "t4", data: { id: "t4", ts: Date.now(), status: "open", title: "מהשרת", who: "" } }); window.__SB_EMIT__("tasks"); });
    await page.waitForFunction(() => document.querySelector("#tkBig").textContent === "2", null, { timeout: 3000 });
    // מי מחובר: כפתור מסך חברה ויציאה; לחיצה על שם האתר פותחת את מסך החברה
    await page.click("#whoChip"); await page.waitForSelector("#wSites");
    assert.ok(await page.isVisible("#wOut"));
    await page.click("#wSites"); await page.waitForSelector("#cfSites");
    assert.equal(await page.getAttribute('[data-slug="ein-tamar"]', "aria-current"), "true");
    await page.click("#cfBack"); assert.equal(await page.$("#cfSites"), null);
    await page.click("#siteName"); await page.waitForSelector("#cfSites");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= 400));
    assert.deepEqual(errors, []);
    await ctx.close();
  } finally { await browser.close(); }
});

test("צופה במולדת: בלי כפתורי עריכה, כתיבה נדחית בשרת", async () => {
  const browser = await launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 400, height: 860 }, locale: "he-IL" });
    const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
    await page.route(/^https?:\/\//, r => r.abort());
    await page.addInitScript(`window.__SB_URL="https://fake.supabase.co";window.__SB_KEY="anon";window.__SB__=${JSON.stringify(SEED)};localStorage.setItem("demoDoneS","1");localStorage.setItem("demoDone","1");localStorage.setItem("__fake_sb_session",JSON.stringify({access_token:"t",user:{id:"u1",email:"yishai@test.local",user_metadata:{name:"ישי"}}}));\n${MOCK}`);
    await page.goto("file://" + FILE + "?site=moledet");
    await page.waitForFunction(() => window.shared && window.shared.DB && document.body.classList.contains("r-viewer"), null, { timeout: 8000 });
    assert.equal(await page.textContent("#siteName"), "BELECTRICאתר הקמה מולדת");
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("#btnAddTask")).display), "none");
    const r = await page.evaluate(() => window.shared.DB.doc("tasks/x").set({ id: "x", ts: 1, status: "open", title: "לא" }).then(() => "ok", e => e.code));
    assert.equal(r, "invalid_argument");
    assert.deepEqual(errors, []);
    await ctx.close();
  } finally { await browser.close(); }
});
