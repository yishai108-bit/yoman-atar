/* ================= הקמת אתר מתיקיית הפרויקט (גרסה 62) =================
   הלקוח מעלה את כל תיקיית הפרויקט כמו שהיא: ZIP אחד, או תיקייה מהמחשב. האפליקציה ממיינת (setup-scan.js),
   מראה מה נמצא, מה חסר ומה דולג, ומקימה בלחיצה אחת: מבנה החשמל, יעד פאנלים, כתב כמויות, כמויות לשולחן, סטטוס ותוכניות.
   כלום לא נכתב לפני «הקם את האתר». מה שכבר קיים במופע לא מוחלף בלי סימון מפורש. מחירים ו-CBA לא נקלטים.
   ייצוא וואטסאפ שבתיקייה עובר לקליטת התעודות הרגילה (אדם מאשר כל תעודה). */
import { $, actorName, closer, esc, logAct, ls, popup, render, shared, toast } from "./core.js";
import { fmtN, openImport, renderStock } from "./01-stock.js";
import { KIT_SOURCE_DEFAULT, SITE, hebrewNames, loadScript, openBomImport, parseSchletterBom, saveSite } from "./08-settings.js";
import { openKitEditor, saveKit } from "./03-kit.js";
import { openBoqImport, parseEboq, saveBoq } from "./13-purchasing.js";
import { parseStatusWorkbook, renderStatus } from "./16-status.js";
import { ROLE } from "./18-identity.js";
import { currentLayout, openLayout, renderPlans, renderWorkMap } from "./20-work-map.js";
import { currentElec, elecDoc, openElecSetup, renderElec, saveElecCfg } from "./21-elec.js";
import { classify, parseCableList, parseDcConfig, projectNameFrom, skippedSummary, sniffSheet } from "./setup-scan.js";

const XLSX_URL = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
const ZIP_URL = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
const MAX_SHEET = 15e6, MAX_INLINE = 1.5e6;

/* ---------- קריאת המקור: ZIP או תיקייה ---------- */
// כל רשומה: {path, size, read(type)} — type: "uint8array" | "string" | "blob"
async function entriesOf(files){
  const out = [], chats = [];
  for (const f of files){
    if (/\.zip$/i.test(f.name)){
      if (!window.JSZip) await loadScript(ZIP_URL);
      const z = await JSZip.loadAsync(f);
      const list = Object.values(z.files).filter(x => !x.dir);
      // ZIP שהוא ייצוא וואטסאפ בעצמו (צ׳אט + תמונות בשורש): לקליטת התעודות, לא למיון
      if (list.some(x => /(^|\/)(_chat\.txt|whatsapp chat[^/]*\.txt)$/i.test(x.name)) && list.filter(x => /\.(jpe?g|png|webp)$/i.test(x.name)).length >= list.length / 2){ chats.push({ path: f.name, name: f.name, size: f.size, file: f }); continue; }
      list.forEach(x => out.push({ path: x.name, size: (x._data && x._data.uncompressedSize) || 0, read: t => x.async(t) }));
    } else {
      const path = f.webkitRelativePath || f.name;
      out.push({ path, size: f.size, file: f, read: t => t === "blob" ? Promise.resolve(f) : t === "string" ? f.text() : f.arrayBuffer().then(b => new Uint8Array(b)) });
    }
  }
  return { entries: out, chats };
}

/* ---------- ניתוח: מה יש בתיקייה ---------- */
async function analyze(files, prog){
  prog(5, "פותח את הקבצים…");
  const { entries, chats } = await entriesOf(files);
  const byPath = new Map(entries.map(e => [e.path.replace(/\\/g, "/"), e]));
  const cls = classify(entries.map(e => ({ path: e.path, size: e.size })));
  const R = { cls, byPath, chats: chats.concat(cls.chats.filter(c => c.kind === "zip").map(c => ({ ...c, entry: byPath.get(c.path) }))), sheets: [], elec: null, boq: null, bom: null, status: null, project: null, cba: [] };
  const sheets = cls.sheets.filter(s => !s.old && (Number(s.size) || 0) <= MAX_SHEET);
  if (sheets.length) await loadScript(XLSX_URL);
  let i = 0;
  for (const s of sheets){
    prog(10 + Math.round(80 * (i++) / sheets.length), "קורא " + s.name);
    const e = byPath.get(s.path); let wb;
    try { wb = /\.csv$/i.test(s.path) ? XLSX.read(await e.read("string"), { type: "string" }) : XLSX.read(await e.read("uint8array"), { type: "array" }); }
    catch (err){ R.sheets.push({ path: s.path, name: s.name, kind: "error" }); continue; }
    for (const sn of wb.SheetNames.slice(0, 8)){
      const ws = wb.Sheets[sn]; const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false });
      const kind = sniffSheet(rows, { file: s.name, sheet: sn });
      if (!R.project) R.project = projectNameFrom(rows);
      R.sheets.push({ path: s.path, name: s.name, sheet: sn, kind: kind || "unknown" });
      try {
        if (kind === "dc-config" && !R.elec){ const E = parseDcConfig(rows); if (E){ E.src = s.name; R.elec = E; } }
        else if (kind === "eboq"){ const B = parseEboq(XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" })); if (B && (!R.boq || R.boq.kind !== "eboq" || B.lines.length > R.boq.lines.length)) R.boq = { ...B, kind: "eboq", source: "EBOQ · " + s.name }; }
        else if (kind === "cable-list" && (!R.boq || R.boq.kind === "cable")){ const B = parseCableList(rows); if (B && (!R.boq || B.lines.length > R.boq.lines.length)) R.boq = { ...B, kind: "cable", source: "כמויות תכנון · " + s.name + " · " + sn }; }
        else if (kind === "bom-schletter" && !R.bom){ const B = parseSchletterBom(rows); if (B && B.lines.length){ B.source = "BOM שלטר (" + s.name.replace(/\.xlsx?$/i, "") + ")"; R.bom = B; } }
        else if (kind === "status" && !R.status){ const wb2 = XLSX.read(await e.read("uint8array"), { type: "array", cellDates: true }); const A = parseStatusWorkbook(wb2); if (A && A.length) R.status = { acts: A, source: s.name }; }
        else if (kind === "cba") R.cba.push(s.name);
      } catch (err){ /* גיליון שלא נקרא נשאר «לא זוהה» */ }
    }
  }
  prog(95, "מסכם…");
  return R;
}

/* ---------- מה יוקם: פריטים לבחירה ---------- */
const hasStatusPanels = () => (shared.STATUS || []).some(a => /פאנל/.test(a.name || ""));
function itemsOf(R){
  const it = [], N = fmtN;
  const plansHave = new Set((shared.PLANS || []).map(p => (p.name || "") + "|" + (p.rev || "")));
  if (R.elec){ const t = R.elec.totals; const d = elecDoc(); const exists = !!(d && (d.struct || d.gen)) || !!currentElec();
    it.push({ k: "elec", title: "מבנה החשמל", detail: t.stations + " תחנות · " + t.icbs + " כניסות ICB · " + t.inverters + " ממירים · " + N(t.strings) + " סטרינגים", src: R.elec.src, exists }); }
  if (R.elec && !R.status && R.elec.totals.panels){ const t = R.elec.totals;
    it.push({ k: "target", title: "יעד פאנלים", detail: N(t.panels) + " פאנלים" + (t.moduleW ? " · " + t.moduleW + "W · " + N(t.kwp) + " kWp" : ""), src: R.elec.src, exists: hasStatusPanels() }); }
  if (R.boq) it.push({ k: "boq", title: R.boq.kind === "eboq" ? "כתב כמויות (EBOQ) והזמנות" : "כתב כמויות תכנוני", detail: N(R.boq.lines.length) + " פריטים" + (R.boq.kind === "eboq" ? " · " + N(R.boq.lines.filter(l => l.po).length) + " עם הזמנת רכש" : "") + " · בלי מחירים", src: R.boq.source.replace(/^[^·]+· /, ""), exists: (shared.boq || []).length > 0 });
  if (R.bom) it.push({ k: "bom", title: "כמויות לשולחן (BOM)", detail: N(R.bom.lines.length) + " פריטים" + (R.bom.types.length ? " · " + R.bom.types.length + " סוגי שולחנות · " + N(R.bom.types.reduce((s, t) => s + (Number(t.count) || 0), 0)) + " שולחנות" : ""), src: R.bom.source, exists: shared.kitSource !== KIT_SOURCE_DEFAULT || !!SITE.bomImported });
  if (R.status) it.push({ k: "status", title: "סטטוס התקדמות", detail: R.status.acts.length + " פעילויות", src: R.status.source, exists: (shared.STATUS || []).length > 0 });
  const plans = R.cls.plans.map(p => ({ ...p, dup: plansHave.has(p.title + "|" + (p.rev || "")) }));
  const fresh = plans.filter(p => !p.dup);
  if (plans.length){ const by = {}; fresh.forEach(p => { by[p.kind] = (by[p.kind] || 0) + 1; });
    it.push({ k: "plans", title: "תוכניות", detail: fresh.length ? N(fresh.length) + " העדכניות · " + Object.entries(by).map(([k, n]) => k + " " + n).join(" · ") : "כולן כבר במופע", list: plans, exists: false, none: !fresh.length }); }
  it.forEach(x => { x.on = !x.exists && !x.none; });
  return it;
}
// מה עוד חסר כדי שהמספרים יהיו מלאים, אחרי ההקמה (לפי מה שנבחר ומה שכבר קיים)
function missingOf(R, chosen){
  const on = k => chosen.some(x => x.k === k && x.on);
  const m = [];
  if (!on("bom") && shared.kitSource === KIT_SOURCE_DEFAULT && !SITE.bomImported) m.push({ k: "bom", l: "כמויות לשולחן (BOM של הקונסטרוקציה)", s: "מזה נגזר לכמה שולחנות המלאי מספיק", btn: "ייבוא BOM", act: () => openBomImport() });
  if (!currentLayout()) m.push({ k: "layout", l: "מבנה השדות והשורות", s: "למפת הביצוע. מתוכנית קונסטרוקציה או מהמספרים", btn: "מבנה האתר", act: () => openLayout() });
  if (!on("elec") && !currentElec()) m.push({ k: "elec", l: "מבנה החשמל", s: "טבלת DC CONFIG, או במספרים", btn: "מבנה החשמל", act: () => openElecSetup() });
  if (!on("boq") && !(shared.boq || []).length) m.push({ k: "boq", l: "כתב כמויות (EBOQ)", s: "מה הוזמן, מה הגיע ומה חסר", btn: "ייבוא EBOQ", act: () => openBoqImport() });
  if (!R.chats.length && !shared.deliveries.length) m.push({ k: "stock", l: "מלאי פתיחה", s: "ייצוא וואטסאפ של קבוצת תעודות המשלוח, כולל מדיה", btn: "ייבוא מוואטסאפ", act: () => openImport() });
  return m;
}

/* ---------- כתיבה ---------- */
async function apply(R, items, siteName, step){
  const on = k => items.some(x => x.k === k && x.on);
  const done = [], fail = [];
  const T = async (label, fn) => { try { const r = await fn(); if (r) done.push(r); } catch (e){ fail.push(label); } };
  if (on("elec")) await T("מבנה החשמל", async () => { step("מבנה החשמל"); await saveElecCfg({ struct: { src: R.elec.src, stringPanels: R.elec.stringPanels, stations: R.elec.stations }, from: "zip" }); return "מבנה החשמל: " + R.elec.totals.inverters + " ממירים"; });
  if (on("target")) await T("יעד פאנלים", async () => { step("יעד פאנלים");
    const ex = (shared.STATUS || []).find(a => /פאנל/.test(a.name || ""));
    const doc = { ...(ex || {}), id: ex ? ex.id : "st_panels", name: ex ? ex.name : "פאנלים", order: ex ? ex.order : 4, total: R.elec.totals.panels, workDays: ex ? ex.workDays || 0 : 0, daily: ex ? ex.daily || [] : [], source: "תיקיית הפרויקט · " + R.elec.src, ts: Date.now() };
    if (shared.DB) await shared.DB.doc("status/" + doc.id).set(doc); else { shared.STATUS = (shared.STATUS || []).filter(x => x.id !== doc.id).concat(doc); ls.set("status", JSON.stringify(shared.STATUS)); }
    return "יעד פאנלים: " + fmtN(doc.total); });
  if (on("boq")) await T("כתב כמויות", async () => { step("כתב כמויות"); await saveBoq(R.boq.lines, R.boq.source); return "כתב כמויות: " + fmtN(R.boq.lines.length) + " פריטים"; });
  if (on("status")) await T("סטטוס", async () => { step("סטטוס התקדמות");
    for (const a of R.status.acts){ const ex = (shared.STATUS || []).find(x => x.name === a.name); const doc = { ...(ex || {}), ...a, id: ex ? ex.id : a.id, ts: Date.now() };
      if (shared.DB) await shared.DB.doc("status/" + doc.id).set(doc); else shared.STATUS = (shared.STATUS || []).filter(x => x.id !== doc.id).concat(doc); }
    if (!shared.DB) ls.set("status", JSON.stringify(shared.STATUS));
    return "סטטוס: " + R.status.acts.length + " פעילויות"; });
  if (on("bom")) await T("כמויות לשולחן", async () => { step("כמויות לשולחן");
    const types = R.bom.types.length ? R.bom.types.map(t => ({ id: t.id, label: t.label, count: t.count, customized: true })) : shared.kitTypes;
    const tot = types.reduce((s, t) => s + (Number(t.count) || 0), 0) || 1;
    const nm = await hebrewNames(R.bom.lines);
    const lines = R.bom.lines.map((l, i) => { const h = nm[i] || { heb: l.name, kit: false }; return { code: l.code, no: l.no, name: h.heb + " (מק״ט " + l.code + ")", def: !!h.kit, per: Object.fromEntries(types.map(t => [t.id, Math.round(l.calc / tot * 10) / 10])), carton: 0 }; }).filter(l => l.def);
    shared.kitTypes = types; await saveKit(lines, R.bom.source, "כמויות לשולחן מתיקיית הפרויקט · " + lines.length + " פריטים · " + R.bom.source);
    return "כמויות לשולחן: " + lines.length + " פריטים לקיט"; });
  // האתר: שם, וסימון שה-BOM יובא
  await T("הגדרות האתר", async () => { const was = SITE.name, name = siteName || SITE.name;
    await saveSite({ name, company: SITE.company, panelsPerTable: SITE.panelsPerTable, bomImported: !!SITE.bomImported || on("bom") });
    return name !== was ? "שם האתר: " + name : null; });
  if (on("plans")){
    const list = items.find(x => x.k === "plans").list.filter(p => !p.dup); let n = 0, saved = 0, big = 0;
    for (const p of list){
      step("תוכנית " + (++n) + " מתוך " + list.length);
      try {
        const e = R.byPath.get(p.path); const blob = await e.read("blob");
        const file = new File([blob], p.name, { type: "application/pdf" });
        const id = "pl" + Date.now().toString(36) + n;
        const doc = { id, name: p.title, kind: p.kind, rev: p.rev || "", mime: "application/pdf", size: file.size, ts: Date.now(), by: actorName(), asset: "", url: "", src: "zip", path: p.path };
        if (shared.ASSETS){ const a = await shared.ASSETS.upload(file); doc.asset = a.id; doc.url = a.url || ""; }
        else if (file.size <= MAX_INLINE){ doc.url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); }); }
        else { big++; continue; }
        if (shared.DB) await shared.DB.doc("plans/" + id).set(doc); else { shared.PLANS = (shared.PLANS || []).concat(doc); ls.set("plans", JSON.stringify(shared.PLANS)); }
        saved++;
      } catch (err){ fail.push("תוכנית " + p.title); }
    }
    if (saved) done.push("תוכניות: " + saved);
    if (big) fail.push(big + " תוכניות גדולות מ-1.5MB (אין כאן אחסון קבצים)");
  }
  if (done.length && shared.demoStock){ shared.demoStock = false; ls.set("demoDoneS", "1"); }
  logAct("settings", "add", "הקמה מתיקיית הפרויקט: " + done.join(" · ") + (fail.length ? " · לא נשמרו: " + fail.join(", ") : ""), "setup");
  return { done, fail };
}

/* ---------- החלון ---------- */
export function openZipSetup(){
  if (ROLE !== "owner"){ toast("הקמת אתר: בעלים בלבד."); return; }
  const scrim = popup('<div class="sheet zs" role="dialog" aria-modal="true" aria-label="הקמה מתיקיית הפרויקט"><div class="grab"></div><h2>הקמה מתיקיית הפרויקט</h2>'
    + '<div id="zsBody">'
    + '<p class="zs-lead">את כל התיקייה כמו שהיא: תוכניות, BOM, EBOQ, חישובי חשמל, סטטוס וייצוא וואטסאפ. האפליקציה ממיינת, מראה מה נמצא, ושום דבר לא נשמר לפני שמאשרים.</p>'
    + '<div class="pick zs-pick"><i class="ic ic-folder big" aria-hidden="true"></i>בחירת קובץ ZIP<small>אפשר כמה קבצים, למשל הפרויקט וייצוא הוואטסאפ</small><input type="file" id="zsZip" accept=".zip,application/zip,application/x-zip-compressed" multiple></div>'
    + '<label class="zs-folder" for="zsDir">או בחירת תיקייה מהמחשב<input type="file" id="zsDir" webkitdirectory directory multiple hidden></label>'
    + '</div>'
    + '<div class="acts"><button class="save" id="zsGo" type="button" hidden>הקם את האתר</button><button class="cancel" id="zsClose" type="button">סגור</button></div></div>');
  const close = closer(scrim); const q = s => scrim.querySelector(s), body = () => q("#zsBody");
  q("#zsClose").onclick = close;
  const prog = (pct, t) => { body().innerHTML = '<div class="prog" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><i style="width:' + pct + '%"></i></div><div class="prog-t"><span>' + esc(t) + '</span></div>'; };
  let R = null, items = [];
  const run = async files => {
    if (!files.length) return;
    try { R = await analyze(files, prog); }
    catch (e){ body().innerHTML = '<div class="empty">' + (e && /load/.test(e.message || "") ? "הספריות לקריאת ZIP ואקסל לא נטענו. צריך חיבור לאינטרנט." : "לא הצלחתי לפתוח את הקבצים. קובץ גדול מאוד נפתח טוב יותר מהמחשב.") + '</div>'; return; }
    items = itemsOf(R); review();
  };
  q("#zsZip").onchange = e => run([...e.target.files]);
  q("#zsDir").onchange = e => run([...e.target.files]);

  function review(){
    const c = R.cls, N = fmtN;
    const unknown = R.sheets.filter(s => s.kind === "unknown" || s.kind === "error");
    const unknownFiles = [...new Set(unknown.map(s => s.name))];
    const skipped = skippedSummary(c); const skippedN = skipped.reduce((s, x) => s + x.n, 0) + unknownFiles.length;
    const any = items.length || R.chats.length;
    const miss = missingOf(R, items);
    body().innerHTML =
      '<div class="imp-sum"><span>קבצים <b>' + N(c.total) + '</b></span><span>לשימוש <b>' + N(items.reduce((s, x) => s + (x.k === "plans" ? x.list.filter(p => !p.dup).length : 1), 0)) + '</b></span><span>דולגו <b>' + N(skippedN) + '</b></span></div>'
      + '<div class="f"><label for="zsName">שם האתר</label><input type="text" id="zsName" value="' + esc(SITE.custom ? SITE.name : (R.project ? "אתר הקמה " + R.project : SITE.name)) + '" autocomplete="off"></div>'
      + (any ? '<h3 class="zs-h">מה יוקם</h3><div class="zs-items" id="zsItems">' + items.map((x, i) =>
          '<label class="zs-item' + (x.none ? ' none' : '') + '"><input type="checkbox" data-i="' + i + '"' + (x.on ? ' checked' : '') + (x.none ? ' disabled' : '') + '>'
          + '<span class="zs-t"><b>' + esc(x.title) + '</b><span>' + esc(x.detail) + '</span>' + (x.src ? '<small>' + esc(x.src) + '</small>' : '') + (x.exists ? '<small class="zs-warn">כבר קיים במופע. סימון יחליף אותו.</small>' : '') + '</span></label>'
          + (x.k === "plans" ? '<details class="zs-plans"><summary>רשימת התוכניות (' + N(x.list.length) + ')</summary><div class="dlines">' + x.list.map(p => '<div><span>' + esc(p.title) + (p.dup ? ' <small>(כבר במופע)</small>' : '') + '</span><b>' + esc(p.rev || p.kind) + '</b></div>').join("") + '</div></details>' : '')).join("") + '</div>'
        : '<div class="empty">לא נמצא בתיקייה שום קובץ שאפשר להקים ממנו. בדוק שזו תיקיית הפרויקט, או התחל צעד אחר צעד.</div>')
      + (R.chats.length ? '<div class="note-card">נמצא ייצוא וואטסאפ (' + R.chats.length + '). התעודות נקלטות אחרי ההקמה, בקליטה הרגילה, כשאתה מאשר כל אחת.</div>' : '')
      + (R.cba.length ? '<div class="legend">קובץ CBA לא נקלט אוטומטית, כי יש בו מחירים. אפשר לייבא אותו ידנית בהגדרות.</div>' : '')
      + (miss.length ? '<h3 class="zs-h">לא נמצא בתיקייה</h3><ul class="zs-miss">' + miss.map(m => '<li><b>' + esc(m.l) + '</b> ' + esc(m.s) + '</li>').join("") + '</ul>' : '')
      + (skippedN ? '<details class="zs-skip"><summary>דולגו ' + N(skippedN) + ' קבצים</summary><ul>' + skipped.map(s => '<li>' + esc(s.label) + ': <b>' + N(s.n) + '</b></li>').join("") + (unknownFiles.length ? '<li>גיליונות שלא זוהו: <b>' + unknownFiles.length + '</b><br><small>' + unknownFiles.map(esc).join(" · ") + '</small></li>' : '') + '</ul></details>' : '');
    scrim.querySelectorAll("#zsItems input[type=checkbox]").forEach(cb => cb.onchange = () => { items[+cb.dataset.i].on = cb.checked; sync(); });
    const sync = () => { const b = q("#zsGo"); b.hidden = !any; b.disabled = !items.some(x => x.on) && !R.chats.length; b.textContent = items.some(x => x.on) ? "הקם את האתר" : "המשך לקליטת התעודות"; };
    sync();
    q("#zsGo").onclick = go;
  }

  async function go(){
    const b = q("#zsGo"); b.disabled = true; const name = (q("#zsName") || {}).value; const siteName = String(name || "").trim();
    let res = { done: [], fail: [] };
    if (items.some(x => x.on)){ prog(5, "שומר…"); res = await apply(R, items, siteName, t => { const p = q(".prog i"), s = q(".prog-t span"); if (s) s.textContent = t; if (p) p.style.width = Math.min(95, (parseFloat(p.style.width) || 5) + 6) + "%"; }); }
    try { render(); renderStock(); renderElec(); renderPlans(); renderStatus(); renderWorkMap(); } catch (e){}
    const miss = missingOf(R, items.map(x => ({ ...x, on: false })));
    body().innerHTML = (res.done.length ? '<h3 class="zs-h">האתר הוקם</h3><ul class="zs-done">' + res.done.map(d => '<li><i class="ic ic-check" aria-hidden="true"></i>' + esc(d) + '</li>').join("") + '</ul>' : '')
      + (res.fail.length ? '<div class="note-card zs-fail">לא נשמרו: ' + res.fail.map(esc).join(", ") + '. אפשר להריץ שוב; מה שכבר נשמר לא יוכפל.</div>' : '')
      + (R.chats.length ? '<button class="add" type="button" id="zsChat"><i class="ic ic-doc"></i>קליטת תעודות מהוואטסאפ</button>' : '')
      + (miss.length ? '<h3 class="zs-h">כדי שהמספרים יהיו מלאים</h3><div class="zs-next">' + miss.map((m, i) => '<button class="slip" type="button" data-m="' + i + '"><b>' + esc(m.l) + '</b><span>' + esc(m.s) + '</span><span class="zs-go">' + esc(m.btn) + ' ›</span></button>').join("") + '</div>' : '')
      + (items.some(x => x.k === "bom" && x.on) ? '<button class="ghost strong" type="button" id="zsKit" style="width:100%;margin-top:10px">בדיקת הכמויות לשולחן</button>' : '');
    b.hidden = true; q("#zsClose").textContent = "סיום";
    scrim.querySelectorAll("[data-m]").forEach(x => x.onclick = () => { close(); miss[+x.dataset.m].act(); });
    const ch = q("#zsChat"); if (ch) ch.onclick = async () => { const c = R.chats[0]; let f = c.file; if (!f && c.entry){ const bl = await c.entry.read("blob"); f = new File([bl], c.name || "whatsapp.zip", { type: "application/zip" }); } close(); openImport([f]); };
    const kb = q("#zsKit"); if (kb) kb.onclick = () => { close(); openKitEditor(); };
    if (res.done.length) toast("האתר הוקם מתיקיית הפרויקט.");
  }
}

export function __init(){
  const b = $("#onbZip"); if (b) b.onclick = openZipSetup;
}
