// מצב האפליקציה ומאגר הנתונים (db של הארטיפקט). האוספים:
//   equipment/<id>  כלי או נגרר: {id, kind, site, name, plate, model, hours, interval, lastServiceHours, lastServiceDate, licenseExp, insuranceExp, testExp, active, note}
//   checks/<id>     טופס בדיקה שמור: {id, eqId, kind, date, inspector, role, site, hours, plate, items:{key:"ok"|"bad"}, notes:{key:text}, summary, defectsText, owner, due, signature, photos:[assetId], createdAt, by}
//   defects/<id>    ליקוי עד סגירה: {id, eqId, kind, checkId, item, text, note, openedAt, status, severity, owner, due, closedAt, closedBy, fixNote, photos}
//   services/<id>   טיפול מוסך: {id, eqId, date, hours, garage, note}
//   settings/main   {site, interval, weeklyDow, weeklyTime}
import { uid } from "./util.js";
import { DEFAULT_INTERVAL } from "./forms.js";

export const state = {
  db: null, user: null, assets: null, downloads: null,
  me: null, canWrite: true, ready: false, offline: false,
  equipment: [], checks: [], defects: [], services: [],
  settings: { interval: DEFAULT_INTERVAL, weeklyDow: 0, weeklyTime: "07:30" },
};
const listeners = new Set();
export function onChange(fn){ listeners.add(fn); return () => listeners.delete(fn); }
export function emit(){ for (const fn of listeners) fn(); }

const COLLS = ["equipment", "checks", "defects", "services"];
export async function connect(){
  const claude = window.claude;
  if (!claude || typeof claude.use !== "function"){ state.ready = true; state.offline = true; emit(); return; }
  const [db, user, assets, downloads] = await Promise.all([claude.use("db"), claude.use("user"), claude.use("assets"), claude.use("downloads")]);
  state.db = db; state.user = user; state.assets = assets; state.downloads = downloads;
  if (user){ try { state.me = await user.me(); const w = await user.can("data.write"); if (w === false) state.canWrite = false; } catch {} }
  if (!db){ state.ready = true; state.offline = true; emit(); return; }
  let pending = COLLS.length + 1;
  const timer = setTimeout(() => { if (!state.ready){ state.ready = true; state.offline = true; emit(); } }, 10000);
  const arrived = () => { if (--pending <= 0 && !state.ready){ clearTimeout(timer); state.ready = true; state.offline = false; emit(); } else if (state.ready) emit(); };
  for (const c of COLLS){
    let first = true;
    db.collection(c).onSnapshot(snap => {
      state[c] = snap.docs.filter(d => d.exists).map(d => ({ ...d.data(), id: d.id }));
      if (first){ first = false; arrived(); } else emit();
    }, () => { if (first){ first = false; arrived(); } });
  }
  let firstS = true;
  db.doc("settings/main").onSnapshot(snap => {
    if (snap.exists) state.settings = { ...state.settings, ...snap.data() };
    if (firstS){ firstS = false; arrived(); } else emit();
  }, () => { if (firstS){ firstS = false; arrived(); } });
}
function need(){ if (!state.db) throw new Error("אין חיבור למאגר"); if (!state.canWrite) throw new Error("אין הרשאת כתיבה"); return state.db; }
const clean = o => JSON.parse(JSON.stringify(o));
// כתיבה אופטימית: מעדכנים את המצב המקומי מיד, ואם המאגר נכשל – מחזירים
async function write(coll, doc){
  const db = need();
  const list = state[coll]; const i = list.findIndex(x => x.id === doc.id); const prev = i >= 0 ? list[i] : null;
  if (i >= 0) list[i] = doc; else list.push(doc); emit();
  try { await db.collection(coll).doc(doc.id).set(clean(doc)); }
  catch (e){ if (prev) list[i] = prev; else list.splice(list.indexOf(doc), 1); emit(); throw e; }
}
export async function saveEquipment(eq){ if (!eq.id) eq.id = uid("eq_"); eq.updatedAt = new Date().toISOString(); await write("equipment", eq); return eq; }
export async function deleteEquipment(id){ const db = need(); state.equipment = state.equipment.filter(e => e.id !== id); emit(); await db.collection("equipment").doc(id).delete(); }
export async function saveCheck(check){ if (!check.id) check.id = uid("ck_"); if (!check.createdAt) check.createdAt = new Date().toISOString(); if (state.me) check.by = state.me.id; await write("checks", check); return check; }
export async function deleteCheck(id){ const db = need(); state.checks = state.checks.filter(e => e.id !== id); emit(); await db.collection("checks").doc(id).delete(); }
export async function saveDefect(d){ if (!d.id) d.id = uid("df_"); await write("defects", d); return d; }
export async function saveService(s){ if (!s.id) s.id = uid("sv_"); await write("services", s); return s; }
export async function saveSettings(patch){ const db = need(); state.settings = { ...state.settings, ...patch }; emit(); await db.doc("settings/main").set(clean(state.settings)); }
export const eqById = id => state.equipment.find(e => e.id === id) || null;
// האתרים שאנשים כבר כתבו (לכלים ולטפסים), להשלמה אוטומטית
export const sites = () => [...new Set([...state.equipment.map(e => e.site), ...state.checks.map(c => c.site)].map(s => (s || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "he"));
export const siteList = id => `<datalist id="${id}">${sites().map(s => `<option value="${s.replace(/"/g, "&quot;")}">`).join("")}</datalist>`;
