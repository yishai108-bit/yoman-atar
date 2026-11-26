// גרסת הענן (לינק רגיל): מאגר מעל Blob, קוד כניסה, והטופס מקצה לקצה מול נקודות הקצה האמיתיות (Blob מדומה בזיכרון).
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");

// Blob מדומה: נטען במקום @vercel/blob לפני שנקודות הקצה נטענות
const mem = new Map();
const fakeBlob = {
  async put(p, body, o){ mem.set(p, { body: Buffer.isBuffer(body) ? body : Buffer.from(String(body)), type: o.contentType }); return { pathname: p }; },
  async list({ prefix }){ return { blobs: [...mem.keys()].filter(k => k.startsWith(prefix)).map(pathname => ({ pathname })), hasMore: false }; },
  async del(names){ for (const n of [].concat(names)) mem.delete(n); },
  async get(p){ const b = mem.get(p); if (!b) return null; return { statusCode: 200, stream: new Response(b.body).body, blob: { contentType: b.type } }; },
};
require.cache[require.resolve("@vercel/blob")] = { id: "fake", filename: "fake", loaded: true, exports: fakeBlob };
process.env.KELIM_CODE = "246810";
const { makeDb } = require("../api/_store.js");
const handlers = { "/api/db": require("../api/db.js"), "/api/login": require("../api/login.js"), "/api/blob": require("../api/blob.js") };

function memStore(){ const m = new Map(); return { m, list: async p => [...m.keys()].filter(k => k.startsWith(p)), read: async n => m.get(n) ?? null, write: async (n, t) => { m.set(n, t); }, remove: async ns => ns.forEach(n => m.delete(n)) }; }

test("מאגר הענן: כתיבות במקביל לא דורסות זו את זו, מחיקה, ודחיסה לתמונת מצב בלי לאבד נתונים", async () => {
  const s = memStore(); let t = 1700000000000; const db = makeDb(s, () => t);
  await Promise.all([db.write([{ coll: "checks", id: "a", doc: { n: 1 } }]), db.write([{ coll: "checks", id: "b", doc: { n: 2 } }])]);
  let st = await db.load(); assert.deepStrictEqual(Object.keys(st.checks).sort(), ["a", "b"]);
  t += 10; await db.write([{ coll: "checks", id: "a", doc: null }, { coll: "settings", id: "main", doc: { interval: 250 } }]);
  st = await db.load(); assert.deepStrictEqual(Object.keys(st.checks), ["b"]); assert.strictEqual(st.settings.main.interval, 250);
  for (let i = 0; i < 30; i++){ t += 10; await db.write([{ coll: "equipment", id: "e" + i, doc: { i } }]); }
  t += 120000; await db.write([{ coll: "equipment", id: "last", doc: { i: 99 } }]);
  st = await db.load();
  assert.strictEqual(Object.keys(st.equipment).length, 31);
  const names = [...s.m.keys()];
  assert.strictEqual(names.filter(n => n.startsWith("db/snap/")).length, 1, "נוצרה תמונת מצב אחת");
  assert.strictEqual(names.filter(n => n.startsWith("db/ops/")).length, 1, "נשארה רק הכתיבה הטרייה");
  st = await db.load(); assert.strictEqual(Object.keys(st.equipment).length, 31); assert.deepStrictEqual(Object.keys(st.checks), ["b"]);
  await assert.rejects(db.write([{ coll: "evil", id: "x", doc: {} }])); await assert.rejects(db.write([{ coll: "checks", id: "../x", doc: {} }]));
});

test("לינק רגיל: בלי קוד אין נתונים; עם הקוד ממלאים טופס, הוא נשמר בשרת ונשאר אחרי רענון", async () => {
  execFileSync("npm", ["run", "build:cloud"], { cwd: ROOT, stdio: "ignore" });
  const html = fs.readFileSync(path.join(ROOT, "dist", "cloud", "index.html"));
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, "http://x");
    let p = u.pathname; req.query = Object.fromEntries(u.searchParams);
    const m = /^\/_blob\/([^/]+)$/.exec(p); if (m){ p = "/api/blob"; req.query.id = m[1]; }
    if (!handlers[p]){ res.setHeader("content-type", "text/html; charset=utf-8"); return res.end(html); }
    const chunks = []; for await (const c of req) chunks.push(c); const buf = Buffer.concat(chunks);
    req.body = (req.headers["content-type"] || "").includes("json") ? JSON.parse(buf.toString() || "{}") : buf;
    handlers[p](req, res);
  });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const base = "http://localhost:" + server.address().port;
  const { chromium } = require("playwright");
  const browser = await chromium.launch();
  try {
    assert.strictEqual((await fetch(base + "/api/db")).status, 401, "בלי קוד אין גישה לנתונים");
    const ctx = await browser.newContext({ viewport: { width: 400, height: 860 }, locale: "he-IL", hasTouch: true });
    const page = await ctx.newPage(); const errors = [];
    page.on("pageerror", e => errors.push(String(e)));
    await page.route(/^https:\/\//, r => r.abort());
    await page.goto(base + "/");
    await page.waitForSelector("#codeGate");
    await page.fill("#gateCode", "111111"); await page.click("#codeGate button"); await page.waitForFunction(() => document.querySelector("#gateMsg").textContent.includes("לא נכון"));
    await page.fill("#gateCode", "246810"); await page.click("#codeGate button");
    await page.waitForSelector("#btnNewCheck");
    assert.strictEqual(await page.locator("#codeGate").count(), 0);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); assert.ok(over <= 0, "גלילה אופקית");
    await page.click("#btnNewCheck"); await page.click('.sheet [data-new="tool"]');
    await page.fill("#cEqName", "מיול ענן"); await page.fill("#cPlate", "12-345-67"); await page.fill("#cSite", "אתר א"); await page.fill("#cName", "בודק"); await page.fill("#cHours", "100");
    await page.setInputFiles("#cPhoto", { name: "p.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64") });
    await page.waitForSelector("#photos img");
    await page.click("#allOk"); await page.click("#cSave"); await page.waitForTimeout(600);
    assert.ok([...mem.keys()].some(k => k.startsWith("ph/")), "הצילום נשמר בשרת");
    await page.reload(); await page.waitForSelector("#btnNewCheck");
    const t = await page.textContent("#view"); assert.ok(t.includes("1/1") && t.includes("מיול ענן"), "הטופס נשאר אחרי רענון: " + t.slice(0, 160));
    const ph = [...mem.keys()].find(k => k.startsWith("ph/")).slice(3);
    const img = await page.evaluate(async id => { const r = await fetch("/_blob/" + id); return [r.status, r.headers.get("content-type")]; }, ph);
    assert.strictEqual(img[0], 200); assert.ok(/^image\//.test(img[1]));
    await page.click(".tab[data-view=remind]"); assert.ok((await page.inputValue("#shareUrl")).startsWith(base), "הקישור לשיתוף הוא הכתובת הרגילה");
    assert.deepStrictEqual(errors, []);
    await ctx.close();
  } finally { await browser.close(); server.close(); }
});
