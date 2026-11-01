// דוח «מה יוקם» מזיפ של תיקיית פרויקט, בלי לכתוב לשום מאגר. אותו מיון ואותם מפענחים כמו בחלון ההקמה באפליקציה.
//   node tools/zip-setup.js "1. Electrical.zip"          דוח בעברית
//   node tools/zip-setup.js "1. Electrical.zip" --json   כל מה שזוהה, כ-JSON
// הזיפ והדוח מכילים נתוני לקוח: לא לריפו.
const fs = require("fs");
const path = require("path");

async function scanZip(buf, opts){
  const JSZip = require("jszip"), XLSX = require("xlsx");
  const S = await import(path.join(__dirname, "..", "src", "js", "setup-scan.js"));
  const z = await JSZip.loadAsync(buf);
  const entries = Object.values(z.files).filter(f => !f.dir).map(f => ({ path: f.name, size: f._data && f._data.uncompressedSize || 0 }));
  const c = S.classify(entries);
  const found = { classify: c, sheets: [], elec: null, boq: null, projectName: null, chats: c.chats.map(x => x.path) };
  for (const sh of c.sheets){
    if (sh.old) continue;
    let wb; try { wb = XLSX.read(await z.file(sh.path).async("uint8array"), { type: "array" }); } catch (e){ found.sheets.push({ path: sh.path, kind: "error" }); continue; }
    for (const name of wb.SheetNames.slice(0, 8)){
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: false });
      const kind = S.sniffSheet(rows, { file: sh.name, sheet: name });
      if (!found.projectName) found.projectName = S.projectNameFrom(rows);
      if (kind === "dc-config" && !found.elec){ const E = S.parseDcConfig(rows); if (E){ E.src = sh.name; found.elec = E; } }
      if (kind === "cable-list" && !found.boq){ const B = S.parseCableList(rows); if (B){ B.source = sh.name + " · " + name; found.boq = B; } }
      found.sheets.push({ path: sh.path, sheet: name, kind: kind || "unknown" });
    }
  }
  return found;
}

function report(f){
  const n = x => Number(x || 0).toLocaleString("he-IL");
  const c = f.classify, L = [];
  L.push("קבצים בזיפ: " + n(c.total));
  if (f.projectName) L.push("שם הפרויקט בקבצים: " + f.projectName);
  L.push("", "## מה יוקם");
  if (f.elec){ const t = f.elec.totals; L.push("- מבנה החשמל (" + f.elec.src + "): " + t.stations + " תחנות · " + t.icbs + " כניסות ICB · " + t.inverters + " ממירים · " + n(t.strings) + " סטרינגים × " + f.elec.stringPanels + " = " + n(t.panels) + " פאנלים" + (t.moduleW ? " · " + t.moduleW + "W · " + n(t.kwp) + " kWp" : ""));
    f.elec.stations.forEach(s => s.icbs.forEach(ic => L.push("  - " + s.name + " · ICB " + ic.id + ": " + ic.inv.map(([id, k]) => id + "(" + k + ")").join(" ")))); }
  if (f.boq) L.push("- כתב כמויות תכנוני (" + f.boq.source + "): " + f.boq.lines.length + " פריטים, בלי מחירים");
  L.push("- תוכניות (העדכנית בלבד מכל תוכנית): " + c.plans.length);
  c.plans.forEach(p => L.push("  - [" + p.kind + "] " + p.title + (p.rev ? " · " + p.rev : "") + (p.versions > 1 ? " (" + p.versions + " גרסאות)" : "")));
  if (f.chats.length) L.push("- ייצוא וואטסאפ: " + f.chats.length + " (קליטת תעודות אחרי ההקמה)");
  L.push("", "## גיליונות");
  f.sheets.forEach(s => L.push("- " + s.path + (s.sheet ? " · " + s.sheet : "") + ": " + s.kind));
  L.push("", "## דולגו");
  const S = { old: c.superseded.length };
  L.push("- גרסאות ישנות / תיקיית Old: " + c.superseded.length);
  const by = {}; c.skipped.forEach(s => { by[s.why] = (by[s.why] || 0) + 1; });
  Object.entries(by).forEach(([k, v]) => L.push("- " + k + ": " + v));
  if (c.docs.length) L.push("- Word: " + c.docs.length); if (c.images.length) L.push("- תמונות: " + c.images.length);
  return L.join("\n");
}
module.exports = { scanZip, report };

if (require.main === module){
  const file = process.argv[2];
  if (!file){ console.error("שימוש: node tools/zip-setup.js <zip> [--json]"); process.exit(1); }
  scanZip(fs.readFileSync(file)).then(f => {
    if (process.argv.includes("--json")) process.stdout.write(JSON.stringify(f, null, 1) + "\n"); else console.log(report(f));
  }).catch(e => { console.error(e); process.exit(1); });
}
