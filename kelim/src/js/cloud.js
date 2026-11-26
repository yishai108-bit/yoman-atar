// גרסת הענן (לינק רגיל, בלי Claude): מספק את אותו window.claude שהארטיפקט נותן,
// מעל נקודות הקצה ב-api/ (מאגר, צילומים, קוד כניסה). נכנס רק בבנייה build:cloud.
const POLL_MS = 20000;
export function installCloud(){
  if (window.claude) return;
  let data = null, gen = 0, inFlight = 0, loginP = null;
  const subs = new Set();

  function login(){
    if (loginP) return loginP;
    loginP = new Promise(resolve => {
      const box = document.createElement("div");
      box.id = "codeGate";
      box.style.cssText = "position:fixed;inset:0;z-index:9999;background:#fff;display:flex;align-items:center;justify-content:center;padding:24px";
      box.innerHTML = `<form style="width:100%;max-width:340px;text-align:center">
        <div style="font-weight:700;font-size:1.3rem;color:#E40033;letter-spacing:.04em">BELECTRIC</div>
        <h2 style="margin:6px 0 14px;font-size:1.1rem">בקרת כלים ונגררים</h2>
        <label for="gateCode" style="display:block;margin-bottom:6px">קוד כניסה</label>
        <input id="gateCode" inputmode="numeric" autocomplete="off" style="width:100%;font-size:1.4rem;text-align:center;padding:12px;border:1px solid #c9cccf;border-radius:10px;direction:ltr">
        <p id="gateMsg" style="min-height:1.4em;color:#E40033;margin:8px 0"></p>
        <button type="submit" class="add" style="width:100%">כניסה</button>
        <p style="color:#666B6E;font-size:.85rem;margin-top:12px">את הקוד מקבלים ממי ששלח את הקישור.</p></form>`;
      document.body.appendChild(box);
      const inp = box.querySelector("#gateCode"), msg = box.querySelector("#gateMsg"); inp.focus();
      box.querySelector("form").onsubmit = async ev => {
        ev.preventDefault(); msg.textContent = "";
        try {
          const r = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: inp.value.trim() }) });
          if (r.ok){ box.remove(); loginP = null; resolve(); }
          else msg.textContent = r.status === 429 ? "יותר מדי ניסיונות; נסו שוב בעוד כמה דקות" : "הקוד לא נכון";
        } catch { msg.textContent = "אין חיבור; נסו שוב"; }
      };
    });
    return loginP;
  }
  async function api(path, opts){
    for (;;){
      const r = await fetch(path, { credentials: "same-origin", cache: "no-store", ...opts });
      if (r.status === 401){ await login(); continue; }
      if (!r.ok) throw Object.assign(new Error("http " + r.status), { code: "unavailable" });
      return r.json();
    }
  }
  const docSnap = (coll, id) => { const body = data && data[coll] ? data[coll][id] : undefined;
    return { id, exists: body !== undefined, data: () => body === undefined ? undefined : JSON.parse(JSON.stringify(body)) }; };
  const collSnap = coll => { const docs = Object.keys((data && data[coll]) || {}).sort().map(id => docSnap(coll, id)); return { docs, size: docs.length, empty: !docs.length }; };
  const fire = s => s.next(s.id ? docSnap(s.coll, s.id) : collSnap(s.coll));
  const notify = () => subs.forEach(s => { try { fire(s); } catch {} });
  async function pull(){
    const g = gen;
    try {
      const d = await api("/api/db");
      if (g !== gen || inFlight) return;           // נכתב משהו בינתיים; התשובה הזו כבר ישנה
      data = d; notify();
    } catch (e){ if (!data) subs.forEach(s => s.error && s.error(e)); }
  }
  async function send(coll, id, doc){
    gen++; inFlight++;
    try {
      await api("/api/db", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ops: [{ coll, id, doc }] }) });
      if (data){ if (!data[coll]) data[coll] = {}; if (doc == null) delete data[coll][id]; else data[coll][id] = doc; }
    } finally { inFlight--; }
    notify();
  }
  const sub = (coll, id, next, error) => { const s = { coll, id, next, error }; subs.add(s); if (data) setTimeout(() => subs.has(s) && fire(s), 0); return () => subs.delete(s); };
  const docRef = (coll, id) => ({ id, path: coll + "/" + id,
    async get(){ if (!data) await pull(); return docSnap(coll, id); },
    set: body => send(coll, id, JSON.parse(JSON.stringify(body))),
    update: body => send(coll, id, { ...((data && data[coll] && data[coll][id]) || {}), ...JSON.parse(JSON.stringify(body)) }),
    delete: () => send(coll, id, null),
    onSnapshot: (next, error) => sub(coll, id, next, error) });
  const db = {
    doc(path){ const [coll, id] = path.split("/"); return docRef(coll, id); },
    collection(coll){ return { doc: id => docRef(coll, id), onSnapshot: (next, error) => sub(coll, null, next, error) }; },
  };
  const assets = {
    async upload(blob){ return api("/api/blob", { method: "POST", headers: { "content-type": "application/octet-stream", "x-type": blob.type || "image/jpeg" }, body: blob }); },
  };
  let started = false;
  function start(){
    if (started) return; started = true;
    pull();
    setInterval(() => { if (!document.hidden) pull(); }, POLL_MS);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) pull(); });
  }
  window.claude = { use: async name => { if (name === "db"){ start(); return db; } if (name === "assets") return assets; return null; } };
}
