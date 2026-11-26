// מאגר הנתונים של גרסת הענן, מעל Vercel Blob (חנות פרטית).
// כל כתיבה היא קובץ נפרד (db/ops/<זמן>-<אקראי>.json), כך ששני אנשים ששומרים באותו רגע לא דורסים זה את זה.
// מדי פעם הכתיבות הישנות נאספות לתמונת מצב אחת (db/snap/<זמן>.json).
const COLLS = ["equipment", "checks", "defects", "services", "settings"];
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const COMPACT_AT = 25, KEEP_MS = 60000, MAX_DOC = 300000;

function emptyState(){ const s = {}; for (const c of COLLS) s[c] = {}; return s; }
function apply(state, op){
  if (!COLLS.includes(op.coll) || !ID_RE.test(op.id || "")) return;
  if (op.doc == null) delete state[op.coll][op.id]; else state[op.coll][op.id] = op.doc;
}
const tsOf = name => Number((/(\d{13})/.exec(name.split("/").pop()) || [])[1] || 0);

// blob: { list(prefix) -> [pathname], read(pathname) -> text|null, write(pathname, text), remove([pathname]) }
function makeDb(blob, now = () => Date.now()){
  async function load(){
    const names = await blob.list("db/");
    const snaps = names.filter(n => n.startsWith("db/snap/")).sort();
    const snapName = snaps[snaps.length - 1] || null, snapTs = snapName ? tsOf(snapName) : 0;
    const ops = names.filter(n => n.startsWith("db/ops/") && tsOf(n) > snapTs).sort();
    const [snapText, ...opTexts] = await Promise.all([snapName ? blob.read(snapName) : null, ...ops.map(n => blob.read(n))]);
    const base = emptyState();
    if (snapText){ const s = JSON.parse(snapText); for (const c of COLLS) base[c] = s[c] || {}; }
    const state = JSON.parse(JSON.stringify(base));
    const parsed = opTexts.map(t => { try { return t ? JSON.parse(t) : null; } catch { return null; } });
    parsed.forEach(o => o && apply(state, o));
    if (ops.length >= COMPACT_AT){
      const cut = now() - KEEP_MS; const old = ops.map((n, i) => [n, parsed[i]]).filter(([n]) => tsOf(n) < cut);
      if (old.length >= COMPACT_AT - 5){
        try {
          old.forEach(([, o]) => o && apply(base, o));
          await blob.write("db/snap/" + tsOf(old[old.length - 1][0]) + ".json", JSON.stringify(base));
          await blob.remove([...old.map(([n]) => n), ...snaps]);
        } catch {}
      }
    }
    return state;
  }
  async function write(ops){
    if (!Array.isArray(ops) || !ops.length || ops.length > 20) throw Object.assign(new Error("bad ops"), { status: 400 });
    for (const o of ops){
      if (!o || !COLLS.includes(o.coll) || !ID_RE.test(o.id || "")) throw Object.assign(new Error("bad op"), { status: 400 });
      if (o.doc != null && (typeof o.doc !== "object" || JSON.stringify(o.doc).length > MAX_DOC)) throw Object.assign(new Error("bad doc"), { status: 400 });
    }
    let t = now();
    for (const o of ops)
      await blob.write("db/ops/" + (t++) + "-" + Math.random().toString(36).slice(2, 10) + ".json", JSON.stringify({ coll: o.coll, id: o.id, doc: o.doc == null ? null : o.doc }));
  }
  return { load, write };
}
module.exports = { makeDb, COLLS };
