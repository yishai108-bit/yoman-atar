// בדיקות בדפדפן (Playwright, רוחב 400 כמו טלפון): טעינה, לשוניות, טופס בדיקה, ליקויים, הדפסה, תזכורות
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { launch, openApp, ROOT } = require("./helpers");
const fixture = require("./fixture");
const SHOTS = path.join(ROOT, "dist", "shots");
fs.mkdirSync(SHOTS, { recursive: true });
let browser;
test.before(async () => { browser = await launch(); });
test.after(async () => { await browser.close(); });
const noOverflow = async page => { const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); assert.ok(o <= 0, "גלילה אופקית: " + o + "px"); };

test("נטען בלי שגיאות JS, ברוחב 400 בלי גלילה אופקית, הדאשבורד מציג את המספרים", async () => {
  const { page, errors, ctx } = await openApp(browser, { mock: { seed: fixture } });
  assert.deepStrictEqual(errors, []);
  await noOverflow(page);
  const t = await page.textContent("#view");
  assert.ok(t.includes("נבדקו השבוע") && t.includes("1/3"), "1 מתוך 3 נבדקו השבוע: " + t.slice(0, 200));
  assert.ok(t.includes("מיול 2") && t.includes("טיפול 500 שעות"));
  assert.ok(t.includes("אלירן"));
  assert.strictEqual(await page.textContent("#badgeDefects"), "1");
  assert.strictEqual(await page.textContent("#siteLabel"), "לוגיסטיקה", "בלי שם אתר קבוע בכותרת");
  assert.ok(t.includes("אתר שני"), "האתר של כל כלי מוצג");
  // סינון לפי אתר כשיש יותר מאחד
  await page.click('#siteFilters [data-site="אתר שני"]'); const t2 = await page.textContent("#view"); assert.ok(t2.includes("0/1") && !t2.includes("מיול 1")); await page.click('#siteFilters [data-site=""]');
  await page.screenshot({ path: path.join(SHOTS, "01-week.png") });
  for (const v of ["eq", "defects", "history", "remind"]){ await page.click(`.tab[data-view=${v}]`); await page.waitForTimeout(100); await noOverflow(page); await page.screenshot({ path: path.join(SHOTS, "02-" + v + ".png") }); }
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});

test("מאגר ריק: הודעה ברורה וכפתור הוספה, בלי שגיאות", async () => {
  const { page, errors, ctx } = await openApp(browser, { mock: { seed: {} } });
  assert.deepStrictEqual(errors, []);
  assert.ok((await page.textContent("#view")).includes("עדיין אין כלים"));
  await page.click("#view [data-go=eq]");
  assert.ok((await page.textContent("#view")).includes("הרשימה ריקה"));
  await page.screenshot({ path: path.join(SHOTS, "03-empty.png") });
  await ctx.close();
});

test("הוספת נגרר חדש נשמרת במאגר ומופיעה ברשימה", async () => {
  const { page, errors, ctx } = await openApp(browser, { mock: { seed: {} } });
  await page.click(".tab[data-view=eq]"); await page.click("#btnAddEq");
  await page.click('.sheet [data-kind="trailer"]');
  await page.fill("#eName", "נגרר חדש"); await page.fill("#ePlate", "11-222-33");
  await page.click("#eSave"); assert.ok((await page.textContent("#toast")).includes("מאיזה אתר"), "אתר חובה");
  await page.fill("#eSite", "אתר חדש"); await page.fill("#x_licenseExp", "2027-03-01");
  await page.click("#eSave"); await page.waitForTimeout(200);
  const writes = await page.evaluate(() => window.__MOCK_WRITES__);
  assert.ok(writes.some(w => w[0] === "set" && w[1].startsWith("equipment/")));
  const t = await page.textContent("#view"); assert.ok(t.includes("נגרר חדש") && t.includes("11-222-33") && t.includes("אתר חדש") && t.includes("לא נבדק השבוע"));
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});

test("טופס בדיקה לכלי: חובה לסמן את כל הסעיפים, X דורש פירוט, השמירה פותחת ליקוי ומעדכנת שעות", async () => {
  const { page, errors, ctx } = await openApp(browser, { mock: { seed: fixture } });
  await page.click("#btnNewCheck");
  // הבוחר: מי שעוד לא נבדק ראשון
  const first = await page.textContent(".sheet .rec:first-child .ttl"); assert.notStrictEqual(first, "מיול 1");
  await page.click('.sheet [data-pick="eq_mule2"]');
  assert.ok((await page.textContent(".sheet h2")).includes("טרקטור משא"));
  assert.strictEqual(await page.inputValue("#cHours"), "520");
  assert.strictEqual(await page.inputValue("#cSite"), "אתר בדיקה", "האתר של הכלי ממלא את הטופס, ואפשר לשנות");
  await page.fill("#cSite", "");
  await page.screenshot({ path: path.join(SHOTS, "04-form-top.png") });
  await page.fill("#cName", "ישראל ישראלי");
  await page.click("#cSave"); assert.ok((await page.textContent("#toast")).includes("מאיזה אתר"), "אתר חובה בטופס");
  await page.fill("#cSite", "אתר בדיקה");
  await page.click("#cSave"); // בלי סימונים
  assert.ok((await page.textContent("#toast")).includes("11 סעיפים"));
  await page.click("#allOk");
  assert.strictEqual(await page.textContent("#progT"), "11/11 סומנו");
  assert.strictEqual(await page.getAttribute('[data-sum="ok"]', "aria-pressed"), "true");
  await page.click('.chk[data-key="horn"] .x');
  assert.strictEqual(await page.getAttribute('[data-sum="repair"]', "aria-pressed"), "true", "סיכום מתעדכן אוטומטית ל«נדרש תיקון»");
  assert.strictEqual(await page.isHidden("#defBlock"), false);
  await page.fill("#cHours", "531");
  await page.click("#cSave"); // X בלי פירוט
  assert.ok((await page.textContent("#toast")).includes("X בלי פירוט"));
  await page.fill('.chk[data-key="horn"] .nt', "צופר לא עובד");
  await page.fill("#cDef", "צופר לא עובד, להחליף"); await page.fill("#cOwner", "מוסך");
  // חתימה באצבע
  const box = await page.locator("#sig").boundingBox();
  await page.mouse.move(box.x + 20, box.y + 60); await page.mouse.down(); await page.mouse.move(box.x + 120, box.y + 40, { steps: 5 }); await page.mouse.move(box.x + 200, box.y + 80, { steps: 5 }); await page.mouse.up();
  await page.screenshot({ path: path.join(SHOTS, "05-form-summary.png") });
  await page.click("#cSave"); await page.waitForTimeout(300);
  const writes = await page.evaluate(() => window.__MOCK_WRITES__);
  assert.ok(writes.some(w => w[1].startsWith("checks/")), "הטופס נשמר");
  assert.ok(writes.some(w => w[1].startsWith("defects/")), "ליקוי נפתח");
  assert.ok(writes.some(w => w[1] === "equipment/eq_mule2"), "שעות הכלי עודכנו");
  const store = await page.evaluate(() => Object.fromEntries([...window.__MOCK_STORE__.entries()]));
  const ck = Object.entries(store).find(([k]) => k.startsWith("checks/ck_") && !fixture.checks[k.split("/")[1]])[1];
  assert.strictEqual(ck.items.horn, "bad"); assert.strictEqual(ck.notes.horn, "צופר לא עובד"); assert.strictEqual(ck.summary, "repair"); assert.strictEqual(ck.hours, 531);
  assert.ok(ck.signature.startsWith("data:image/png")); assert.strictEqual(ck.inspector, "ישראל ישראלי"); assert.strictEqual(ck.site, "אתר בדיקה");
  assert.strictEqual(store["equipment/eq_mule2"].hours, 531);
  const df = Object.entries(store).find(([k]) => k.startsWith("defects/df_") && store[k].item === "horn")[1];
  assert.strictEqual(df.text, "בדיקת צופר"); assert.strictEqual(df.status, "open"); assert.strictEqual(df.owner, "מוסך");
  // אחרי השמירה נפתח הטופס השמור עם כפתור הדפסה
  assert.ok((await page.textContent(".sheet")).includes("הדפסה / PDF"));
  await page.screenshot({ path: path.join(SHOTS, "06-saved-check.png") });
  await page.keyboard.press("Escape"); await page.click(".scrim", { position: { x: 5, y: 5 } }).catch(() => {});
  // הדאשבורד: עכשיו 2/3 נבדקו, 2 ליקויים
  await page.click(".tab[data-view=week]");
  const t = await page.textContent("#view"); assert.ok(t.includes("2/3"), t.slice(0, 150));
  assert.strictEqual(await page.textContent("#badgeDefects"), "2");
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});

test("טופס נגרר: 23 סעיפים ב-5 קבוצות, סיכום «מושבת» פותח ליקוי חמור", async () => {
  const { page, errors, ctx } = await openApp(browser, { mock: { seed: fixture } });
  await page.click("#btnNewCheck"); await page.click('.sheet [data-pick="eq_tr1"]');
  assert.strictEqual(await page.locator(".sheet .chk").count(), 23);
  assert.strictEqual(await page.locator("#cHours").count(), 0, "לנגרר אין שעות מנוע");
  await page.fill("#cName", "בודק"); await page.click("#allOk");
  await page.click('.chk[data-key="cable"] .x'); await page.fill('.chk[data-key="cable"] .nt', "כבל ביטחון חתוך");
  await page.click('[data-sum="down"]');
  await page.click("#cSave"); await page.waitForTimeout(300);
  const store = await page.evaluate(() => Object.fromEntries([...window.__MOCK_STORE__.entries()]));
  const df = Object.values(store).find(d => d.item === "cable"); assert.strictEqual(df.severity, "down"); assert.strictEqual(df.text, "כבל ביטחון תקין");
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});

test("ליקויים: סגירה עם פירוט מעבירה ל«נסגרו», ופתיחה מחדש מחזירה", async () => {
  const { page, errors, ctx } = await openApp(browser, { mock: { seed: fixture } });
  await page.click(".tab[data-view=defects]");
  let t = await page.textContent("#view"); assert.ok(t.includes("פתוחים (1)") && t.includes("נסגרו (1)") && t.includes("צמיג אחורי"));
  await page.click('[data-close="df_1"]'); await page.fill("#cBy", "מוסך רם"); await page.fill("#cNote", "הוחלף צמיג"); await page.click("#cSave"); await page.waitForTimeout(150);
  t = await page.textContent("#view"); assert.ok(t.includes("פתוחים (0)") && t.includes("אין ליקויים פתוחים"));
  await page.click('[data-f="closed"]'); t = await page.textContent("#view"); assert.ok(t.includes("הוחלף צמיג"));
  await page.screenshot({ path: path.join(SHOTS, "07-defects-closed.png") });
  await page.click('[data-reopen="df_1"]'); await page.waitForTimeout(150);
  await page.click('[data-f="open"]'); t = await page.textContent("#view"); assert.ok(t.includes("פתוחים (1)"));
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});

test("כלים: פרטי כלי, רישום טיפול מוסך מאפס את הספירה", async () => {
  const { page, errors, ctx } = await openApp(browser, { mock: { seed: fixture } });
  await page.click(".tab[data-view=eq]"); await page.click('[data-eq="eq_mule2"]');
  let t = await page.textContent(".sheet"); assert.ok(t.includes("חלף מועד הטיפול ב-20 שעות"));
  await page.screenshot({ path: path.join(SHOTS, "08-equipment.png") });
  await page.click("[data-x=service]"); await page.fill("#sHours", "525"); await page.fill("#sGarage", "מוסך מורשה"); await page.click("#sSave"); await page.waitForTimeout(200);
  const store = await page.evaluate(() => Object.fromEntries([...window.__MOCK_STORE__.entries()]));
  assert.strictEqual(store["equipment/eq_mule2"].lastServiceHours, 525);
  assert.ok(Object.keys(store).some(k => k.startsWith("services/")));
  await page.click('[data-eq="eq_mule2"]'); t = await page.textContent(".sheet"); assert.ok(t.includes("טיפול הבא ב-775"), t.slice(0, 300));
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});

test("הדפסה: הטופס השמור נבנה במבנה המקורי (כותרות, V/X, סיכום, חתימה, דגשים) וטופס ריק לשני הסוגים", async () => {
  const { page, errors, ctx } = await openApp(browser, { mock: { seed: fixture } });
  await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await page.click(".tab[data-view=history]"); await page.click('[data-open="ck_1"]'); await page.click("#pPrint"); await page.waitForTimeout(300);
  assert.strictEqual(await page.evaluate(() => window.__printed), 1);
  const html = await page.innerHTML("#printArea");
  assert.ok(html.includes("טופס טיפול בטרקטור משא / מיול") && html.includes("BELECTRIC") && html.includes("V או X"));
  assert.ok(html.includes('class="vx bad">X<') && html.includes("צמיג אחורי שמאלי שחוק") && html.includes("☑ נדרש תיקון") && html.includes("250 שעות"));
  assert.ok(html.includes("1,230") && html.includes("12-345-67"));
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  assert.strictEqual(await page.innerHTML("#printArea"), "", "אזור ההדפסה מתנקה");
  await page.keyboard.press("Escape"); await page.click(".scrim", { position: { x: 5, y: 5 } }).catch(() => {});
  await page.click("#blankTrailer"); await page.waitForTimeout(200);
  const blank = await page.innerHTML("#printArea");
  assert.ok(blank.includes("נגרר פתוח עד 750") && blank.includes("מערכת חיבור וגרירה") && (blank.match(/☐/g) || []).length >= 46);
  assert.ok(!blank.includes("הודפס"), "טופס ריק בלי חותמת זמן");
  // תצוגת הדפסה: דף A4 כמו שהדפדפן מדפיס
  await page.emulateMedia({ media: "print" });
  await page.screenshot({ path: path.join(SHOTS, "09-print-blank-trailer.png"), fullPage: true });
  await page.emulateMedia({ media: "screen" });
  await page.click("#blankTool"); await page.waitForTimeout(200);
  assert.ok((await page.innerHTML("#printArea")).includes("טופס טיפול בטרקטור משא"));
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});

test("הדפסת טפסי השבוע: רק הבדיקות של השבוע הנוכחי", async () => {
  const { page, errors, ctx } = await openApp(browser, { mock: { seed: fixture } });
  await page.evaluate(() => { window.print = () => {}; });
  await page.click("#btnPrintWeek"); await page.waitForTimeout(200);
  assert.strictEqual(await page.locator("#printArea .pform").count(), 1);
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});

test("תזכורות: קישור ליומן גוגל עם חזרה שבועית, קובץ ICS נשמר דרך downloads, קישור השיתוף מוצג", async () => {
  const { page, errors, ctx } = await openApp(browser, { mock: { seed: fixture } });
  await page.click(".tab[data-view=remind]");
  const href = await page.getAttribute('#view a[href*="calendar.google.com"]', "href");
  assert.ok(href.includes("recur=RRULE%3AFREQ%3DWEEKLY%3BBYDAY%3DSU") && href.includes("ctz=Asia%2FJerusalem"));
  await page.click("#icsWeekly"); await page.waitForTimeout(100);
  const saved = await page.evaluate(() => window.__MOCK_SAVED__);
  assert.strictEqual(saved.length, 1); assert.ok(saved[0].filename.endsWith(".ics")); assert.ok(saved[0].data.includes("RRULE:FREQ=WEEKLY;BYDAY=SU"));
  await page.click("#icsAll"); await page.waitForTimeout(100);
  const all = await page.evaluate(() => window.__MOCK_SAVED__[1].data); assert.ok(all.includes("אלירן") && all.includes("טיפול מוסך"));
  assert.strictEqual(await page.inputValue("#shareUrl"), "https://example.test/kelim");
  // שינוי יום הבדיקה נשמר בהגדרות
  await page.selectOption("#rDow", "4"); await page.waitForTimeout(150);
  const store = await page.evaluate(() => Object.fromEntries([...window.__MOCK_STORE__.entries()]));
  assert.strictEqual(store["settings/main"].weeklyDow, 4);
  assert.ok((await page.getAttribute('#view a[href*="calendar.google.com"]', "href")).includes("BYDAY%3DTH"));
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});

test("קישור ישיר לטופס (#check/<כלי>) פותח את הטופס מיד", async () => {
  const { page, errors, ctx } = await openApp(browser, { mock: { seed: fixture }, hash: "#check/eq_tr1" });
  await page.waitForSelector(".sheet .chk", { timeout: 3000 });
  assert.ok((await page.textContent(".sheet h2")).includes("נגרר"));
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});

test("צופה (viewer): קריאה בלבד, כפתורי השמירה מנוטרלים, בלי שגיאות", async () => {
  const { page, errors, ctx } = await openApp(browser, { mock: { seed: fixture, role: "viewer" } });
  await page.click(".tab[data-view=eq]");
  assert.strictEqual(await page.isDisabled("#btnAddEq"), true);
  await page.click('[data-eq="eq_mule1"]'); assert.strictEqual(await page.isDisabled(".sheet [data-x=check]"), true);
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});

test("בלי מאגר (use(db) → null): הכלי נטען עם פס «אין חיבור»", async () => {
  const { page, errors, ctx } = await openApp(browser, { mock: { noDb: true } });
  assert.strictEqual(await page.isHidden("#netBar"), false);
  assert.ok((await page.textContent("#netMsg")).includes("אין חיבור"));
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});
