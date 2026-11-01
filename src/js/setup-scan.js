// הקמת אתר מתיקיית פרויקט (גרסה 62): מיון הקבצים וזיהוי מה כל אחד מהם, בלי DOM ובלי מאגר.
// משמש את חלון ההקמה באפליקציה (23-zip-setup.js) ואת tools/zip-setup.js (דוח מהזיפ, לפני שמעלים).
// העיקרון: קורא ישירות רק פורמטים מוכרים (DC CONFIG, רשימת כבלים, BOM של שלטר, EBOQ, קובץ סטטוס, ייצוא וואטסאפ);
// כל השאר נרשם כ«לא זוהה» ולא נכתב. מחירים לא נקראים לעולם: עמודות מחיר מדולגות, קובץ CBA לא נקלט אוטומטית.

/* ---------- סוגי קבצים ---------- */
const EXT = p => { const m = String(p).toLowerCase().match(/\.([a-z0-9]{1,6})$/); return m ? m[1] : ""; };
const BASE = p => String(p).split("/").pop();
const SYSTEM = /^(thumbs\.db|desktop\.ini|\.ds_store)$/i;
const CAD = new Set(["dwg", "dxf", "bak", "dwl", "dwl2", "tmp", "log", "err", "xgslab", "xglcad", "rvt", "skp", "pvsyst", "pan", "ond", "db"]);
const SHEET = new Set(["xlsx", "xlsm", "xls", "csv"]);
const IMAGE = new Set(["jpg", "jpeg", "png", "webp", "heic"]);

/* ---------- גרסאות של אותה תוכנית ---------- */
// מספר התוכנית בשם הקובץ: PRJ_E_20_..., Site Name_E_120_... → "E_20" / "E_120". בלי מספר: השם בלי סימוני גרסה.
export function drawingKey(name){
  const b = BASE(name).replace(/\.[a-z0-9]{1,6}$/i, "");
  const m = b.match(/(?:^|[_\s-])([A-Z])_(\d+(?:\.\d+)?)(?=[_\s-]|$)/);
  if (m) return m[1] + "_" + m[2];
  return b.replace(/[\s_-]*rev\s*[a-z]?\s*\d*\b/ig, "")
    .replace(/[\s_-]*גרסה\s*\d+.*$/, "")
    .replace(/\(\s*\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?\s*\)/g, "")
    .replace(/(?<=\D)-\d{1,2}$/, "")
    .replace(/[\s._-]+$/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}
// דירוג גרסה: rev05 > rev00 > revP02 > בלי סימון. «גרסה 4» כמו rev04.
export function revRank(name){
  const b = BASE(name);
  let m = b.match(/rev\s*\.?\s*(\d+)(?![\d])/i); if (m && !/rev\s*\.?\s*p/i.test(b.slice(m.index, m.index + m[0].length))) return 1000 + Number(m[1]);
  m = b.match(/rev\s*\.?\s*p\s*0?(\d+)/i); if (m) return 100 + Number(m[1]);
  m = b.match(/גרסה\s*(\d+)/); if (m) return 1000 + Number(m[1]);
  return 0;
}
export function revText(name){
  const b = BASE(name);
  let m = b.match(/rev\s*\.?\s*(p?\s*\d+)/i); if (m) return "rev" + m[1].replace(/\s+/g, "").toUpperCase().replace(/^P/, "P");
  m = b.match(/גרסה\s*\d+/); return m ? m[0] : "";
}
const OLD_DIR = /(^|\/)(old|ישן|ישנים|archive|superseded|backup)(\/|$)/i;
// תחום התוכנית: לפי האות במספר התוכנית, אחר כך לפי שם התיקייה
export function planKind(path){
  const k = drawingKey(path), L = /^[A-Z]_/.test(k) ? k[0] : "";
  if (L === "E") return "חשמל";
  if (L === "M" || L === "S") return "קונסטרוקציה";
  if (L === "C") return "אזרחי";
  const p = String(path).toLowerCase();
  if (/electr|חשמל|lv board|mv board|sld|cable|grounding|inverter/.test(p)) return "חשמל";
  if (/struct|mechan|construction|קונסטרוקציה|racks?\b|pile/.test(p)) return "קונסטרוקציה";
  if (/civil|אזרחי|road|drain|fence|גדר|topo/.test(p)) return "אזרחי";
  return "כללי";
}
// שם לתצוגה: בלי סיומת, בלי גרסה, בלי קו תחתון
export function planName(path){
  return BASE(path).replace(/\.[a-z0-9]{1,6}$/i, "").replace(/[\s_-]*rev\s*\.?\s*p?\s*\d+\s*_?$/i, "").replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

/* ---------- מיון התיקייה ---------- */
// entries: [{path, size}] (תיקיות מסוננות מראש). מחזיר את מה שצריך לקרוא ואת מה שמדלגים, עם סיבה.
export function classify(entries){
  const out = { plans: [], superseded: [], sheets: [], chats: [], images: [], docs: [], skipped: [], total: 0 };
  const pdfs = [];
  for (const e of entries || []){
    const path = String(e.path || "").replace(/\\/g, "/"), name = BASE(path), ext = EXT(path);
    if (!name || path.endsWith("/")) continue;
    out.total++;
    if (SYSTEM.test(name) || name.startsWith("~$") || name.startsWith("._") || /(^|\/)__MACOSX\//.test(path)){ out.skipped.push({ path, why: "system" }); continue; }
    if (ext === "pdf"){ if (OLD_DIR.test(path)) out.superseded.push({ path, by: "" }); else pdfs.push({ ...e, path, name }); continue; }
    if (SHEET.has(ext)){ out.sheets.push({ ...e, path, name, old: OLD_DIR.test(path) }); continue; }
    if (ext === "zip"){ (/whatsapp|וואטסאפ|ווטסאפ/i.test(name) ? out.chats : out.skipped).push(/whatsapp|וואטסאפ|ווטסאפ/i.test(name) ? { ...e, path, name, kind: "zip" } : { path, why: "zip" }); continue; }
    if (ext === "txt" && /whatsapp|_chat\.txt$/i.test(name)){ out.chats.push({ ...e, path, name, kind: "txt" }); continue; }
    if (IMAGE.has(ext)){ out.images.push({ ...e, path, name }); continue; }
    if (ext === "docx" || ext === "doc"){ out.docs.push({ ...e, path, name }); continue; }
    if (CAD.has(ext) || /^atmp|^savea/i.test(name)){ out.skipped.push({ path, why: "cad" }); continue; }
    out.skipped.push({ path, why: "other" });
  }
  // לכל תוכנית: הגרסה הגבוהה ביותר. תיקיית Old (ישן, archive) לא נקלטת בכלל. שוויון: הכי קרוב לשורש.
  const groups = new Map();
  for (const p of pdfs){ const k = planKind(p.path) + "|" + drawingKey(p.path); (groups.get(k) || groups.set(k, []).get(k)).push(p); }
  for (const list of groups.values()){
    const score = p => [revRank(p.path), -p.path.split("/").length, Number(p.size) || 0];
    list.sort((a, b) => { const x = score(a), y = score(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return y[i] - x[i]; return a.path < b.path ? -1 : 1; });
    const [best, ...rest] = list;
    out.plans.push({ ...best, kind: planKind(best.path), rev: revText(best.path), title: planName(best.path), key: drawingKey(best.path), versions: list.length });
    rest.forEach(p => out.superseded.push({ path: p.path, by: best.path }));
  }
  const kindOrder = ["קונסטרוקציה", "חשמל", "אזרחי", "כללי"];
  out.plans.sort((a, b) => kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind) || a.title.localeCompare(b.title, "en", { numeric: true }));
  return out;
}

/* ---------- זיהוי גיליון ---------- */
const clean = v => String(v == null ? "" : v).replace(/\s+/g, " ").trim();
const num = v => { if (typeof v === "number") return v; const m = clean(v).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/); return m ? Number(m[0]) : NaN; };
// rows: מערך שורות (SheetJS header:1, raw:true). מחזיר סוג אחד: dc-config / cable-list / bom-schletter / eboq / status / cba / null
export function sniffSheet(rows, ctx){
  const R = (rows || []).slice(0, 60).map(r => (r || []).map(clean));
  const has = re => R.some(r => r.some(c => re.test(c)));
  const name = String((ctx && ctx.file) || "") + " " + String((ctx && ctx.sheet) || "");
  if (/\bcba\b|cost break ?down/i.test(name) || has(/^cba$|cost breakdown/i)) return "cba";
  if (R.some(r => r.some(c => /^inv(erter)?\.?\s*(num|no|#|number)/i.test(c))) && has(/^total strings?$/i)) return "dc-config";
  if (has(/item number/i) && has(/total amount|calculated amount/i)) return "bom-schletter";
  if (has(/item number/i) && has(/^ספק$/)) return "eboq";
  if (R.slice(0, 16).some(r => r[0] === "כמות כללית" && r[1])) return "status";
  if (cableHeader(R) >= 0) return "cable-list";
  return null;
}
const cableHeader = R => R.findIndex(r => r.some(c => /^type$/i.test(c)) && r.filter(c => /quantity|כמות/i.test(c)).length === 1 && r.some(c => /^unit$|יחידה/i.test(c)));

/* ---------- DC CONFIG: תחנות, כניסות (ICB), ממירים, סטרינגים ---------- */
// שורת «Inv Num» נותנת את סדר הממירים; שורת «ICB x.y» מעליה (תאים ממוזגים) קובעת לאיזו כניסה שייך כל טור;
// «Total Strings» נותנת סטרינגים לממיר. מספרי ממירים נכתבים כמספר עשרוני (1.10 נקרא 1.1), לכן הם נבנים מחדש לפי הסדר.
export function parseDcConfig(rows){
  const R = (rows || []).map(r => r || []);
  const find = re => { for (let i = 0; i < R.length; i++){ const j = R[i].findIndex(c => re.test(clean(c))); if (j >= 0) return [i, j]; } return [-1, -1]; };
  const [ri, ci] = find(/^inv(erter)?\.?\s*(num|no|#|number)/i), [si, sci] = find(/^total strings?$/i);
  if (ri < 0 || si < 0) return null;
  const cols = []; for (let j = ci + 1; j < R[ri].length; j++){ const v = R[ri][j]; if (v !== null && v !== undefined && clean(v) !== "") cols.push(j); }
  const strCol = j => num(R[si][j]);
  const invCols = cols.filter(j => Number.isFinite(strCol(j)) && strCol(j) > 0);
  if (!invCols.length) return null;
  // ICB לפי עמודה: השורות מעל שורת הממירים, תא «ICB …» חל עד התא הבא
  let icbAt = [];
  for (let i = Math.max(0, ri - 4); i < ri; i++){ const hits = []; R[i].forEach((c, j) => { const m = clean(c).match(/^(?:icb|ICB)\s*([\d.]+)$/i); if (m) hits.push([j, m[1]]); }); if (hits.length) icbAt = hits; }
  const icbOf = j => { let id = ""; for (const [jj, v] of icbAt) if (jj <= j) id = v; return id; };
  // תחנה: החלק השלם של מספר הממיר (או של ה-ICB)
  const rawStation = j => { const v = R[ri][j]; const s = typeof v === "number" ? String(Math.floor(v)) : clean(v).split(".")[0]; return s && /^\d+$/.test(s) ? s : (icbOf(j).split(".")[0] || "1"); };
  const stations = new Map(); const seq = new Map();
  for (const j of invCols){
    const st = rawStation(j); const n = (seq.get(st) || 0) + 1; seq.set(st, n);
    const icb = icbOf(j) || st;
    if (!stations.has(st)) stations.set(st, new Map());
    const icbs = stations.get(st); if (!icbs.has(icb)) icbs.set(icb, []);
    icbs.get(icb).push([st + "." + n, Math.round(strCol(j))]);
  }
  // נתונים כלליים: אורך סטרינג, הספק פאנל, סך פאנלים (תאים «תווית | ערך» בכל מקום בגיליון)
  const label = re => { for (const r of R) for (let j = 0; j < r.length - 1; j++) if (re.test(clean(r[j]))){ for (let k = j + 1; k < Math.min(r.length, j + 3); k++){ const v = num(r[k]); if (Number.isFinite(v)) return v; } } return NaN; };
  let stringPanels = label(/אורך סטרינג|string length|modules? per string/i);
  if (!Number.isFinite(stringPanels)){ const vals = []; R.forEach((r, i) => { if (i > ri && i < si) invCols.forEach(j => { const v = num(r[j]); if (Number.isFinite(v) && v > 1) vals.push(v); }); }); stringPanels = vals.length ? mode(vals) : 27; }
  let moduleW = label(/^הספק$|module power|wp per module/i);
  const kwpRow = R.findIndex(r => r.some(c => /module\s*type\s*\[?kwp/i.test(clean(c))));
  if (!Number.isFinite(moduleW) && kwpRow >= 0){ const v = num(R[kwpRow][invCols[0]]); if (Number.isFinite(v)) moduleW = v < 5 ? Math.round(v * 1000) : v; }
  const out = { src: "", stringPanels, stations: [] };
  [...stations.entries()].sort((a, b) => Number(a[0]) - Number(b[0])).forEach(([st, icbs]) => {
    out.stations.push({ id: "S" + st, name: "תחנה " + st, side: "", icbs: [...icbs.entries()].map(([id, inv]) => ({ id, inv })) });
  });
  const strings = out.stations.reduce((s, x) => s + x.icbs.reduce((a, c) => a + c.inv.reduce((q, [, n]) => q + n, 0), 0), 0);
  out.totals = { stations: out.stations.length, icbs: out.stations.reduce((s, x) => s + x.icbs.length, 0), inverters: invCols.length, strings, panels: strings * stringPanels, moduleW: Number.isFinite(moduleW) ? moduleW : 0 };
  out.totals.kwp = out.totals.moduleW ? Math.round(out.totals.panels * out.totals.moduleW) / 1000 : 0;
  return out;
}
const mode = a => { const c = new Map(); a.forEach(v => c.set(v, (c.get(v) || 0) + 1)); return [...c.entries()].sort((x, y) => y[1] - x[1])[0][0]; };

/* ---------- רשימת כבלים / כתב כמויות תכנוני ---------- */
// כותרת: SERVICE · TYPE · תיאור · Unit · QUANTITY. עמודות מחיר מדולגות תמיד. גיליון עם כמה עמודות כמות (למשל 22kV/33kV) לא נקרא.
export function parseCableList(rows){
  const R = (rows || []).map(r => (r || []).map(v => v));
  const hi = cableHeader(R.slice(0, 60).map(r => r.map(clean))); if (hi < 0) return null;
  const H = R[hi].map(c => clean(c).toLowerCase());
  const col = re => H.findIndex(h => re.test(h));
  const cSvc = col(/^service$|^שירות$|^מערכת$/), cType = col(/^type$/), cDesc = col(/תיאור|description/), cUnit = col(/^unit$|יחידה/), cQty = col(/quantity|כמות/);
  const lines = []; let svc = "";
  for (let i = hi + 1; i < R.length; i++){
    const r = R[i]; const v = j => j >= 0 && j < r.length ? clean(r[j]) : "";
    if (v(cSvc)) svc = v(cSvc);
    const type = v(cType); const qty = num(r[cQty]);
    if (!type || !Number.isFinite(qty) || qty <= 0) continue;
    const u = v(cUnit).toLowerCase();
    const unit = /^m$|^מ'?$|meter|מטר/.test(u) ? "מטר" : /pcs|יח/.test(u) ? "יח'" : /set|סט/.test(u) ? "סט" : u || "יח'";
    const desc = v(cDesc);
    lines.push({ name: type, en: type, code: "", qty: Math.round(qty * 100) / 100, unit, cat: /fire|אש|כיבוי/i.test(svc + " " + type) ? "safety" : "electrical", supplier: "", group: svc, note: desc });
  }
  lines.forEach((l, i) => { l.code = String(i + 1); });
  return lines.length ? { lines } : null;
}

/* ---------- שם האתר מהקבצים ---------- */
// «Project Name: X» בגיליון, אחרת null (האתר כבר קיים עם שם; לא מנחשים)
export function projectNameFrom(rows){
  for (const r of (rows || []).slice(0, 30)) for (let j = 0; j < (r || []).length - 1; j++){
    if (/^\*?\s*project name\s*:?$/i.test(clean(r[j]))){ for (let k = j + 1; k < Math.min(r.length, j + 3); k++){ const v = clean(r[k]); if (v && !/:$/.test(v)) return v; } }
  }
  return null;
}

/* ---------- סיכום לתצוגה ---------- */
export const WHY_HE = { system: "קובצי מערכת", cad: "שרטוטי CAD וקובצי עבודה (DWG, BAK)", zip: "קובצי ZIP פנימיים", other: "סוג קובץ אחר" };
export function skippedSummary(c){
  const by = {}; (c.skipped || []).forEach(s => { by[s.why] = (by[s.why] || 0) + 1; });
  const out = Object.entries(by).map(([k, n]) => ({ k, n, label: WHY_HE[k] || k }));
  if (c.superseded && c.superseded.length) out.unshift({ k: "old", n: c.superseded.length, label: "גרסאות ישנות של אותה תוכנית" });
  if (c.docs && c.docs.length) out.push({ k: "docs", n: c.docs.length, label: "מסמכי Word" });
  if (c.images && c.images.length) out.push({ k: "img", n: c.images.length, label: "תמונות בודדות" });
  return out;
}
