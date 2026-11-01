// פותח את האפליקציה בדפדפן אמיתי (Playwright) עם window.claude מדומה.
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..");
const APP = process.env.APP_FILE || path.join(ROOT, "artifact", "yoman.html");
const MOCK = fs.readFileSync(path.join(__dirname, "mock-claude.js"), "utf8");

async function launch(){ return chromium.launch(); }

// mock: אפשרויות ל-mock-claude.js; width: רוחב המסך (ברירת מחדל 400, טלפון)
// libs: true → JSZip ו-SheetJS מוגשים מ-node_modules במקום מה-CDN (שאר הרשת חסומה)
const LIBS = { "jszip.min.js": "jszip/dist/jszip.min.js", "xlsx.full.min.js": "xlsx/dist/xlsx.full.min.js" };
async function openApp(browser, { mock = {}, width = 400, height = 860, file = APP, libs = false } = {}){
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, locale: "he-IL" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  // בלי רשת: פונטים ו-JSZip לא נחוצים לבדיקות
  await page.route(/^https?:\/\//, r => {
    const lib = libs && Object.keys(LIBS).find(k => r.request().url().endsWith("/" + k));
    return lib ? r.fulfill({ path: require.resolve(LIBS[lib]), contentType: "application/javascript" }) : r.abort();
  });
  await page.addInitScript(`window.__MOCK__=${JSON.stringify(mock)};\n${MOCK}`);
  await page.goto("file://" + file);
  await page.waitForFunction(() => document.querySelector("#app") && !document.querySelector("#app.skel"), null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(300);
  return { page, ctx, errors };
}

module.exports = { launch, openApp, APP, ROOT };
