// מדמה את הלקוח של Supabase (supabase-js) לבדיקות של הגרסה לאירוח עצמאי (src/js/cloud/).
// רק מה שהאפליקציה משתמשת בו: auth (סיסמה, session ב-localStorage כדי לשרוד טעינה מחדש), from().select/eq/gt/order/range/limit,
// upsert, delete().match, channel().on().subscribe, storage.from().upload. הנתונים: window.__SB__ = { users:[{email,password,id,name}],
// sites:[{id,slug,name}], members:[{site_id,user_id,role}], docs:[{site_id,coll,id,data}] }. כתיבות נאספות ב-window.__SB_WRITES__.
(function(){
  const S = window.__SB__ || {}; if (!S.users) return;
  const users = S.users, sites = S.sites || [], members = S.members || [], docs = (S.docs || []).map(d => ({ ...d, updated_at: d.updated_at || new Date(0).toISOString() }));
  const writes = []; window.__SB_WRITES__ = writes; window.__SB_DOCS__ = docs;
  const LSK = "__fake_sb_session";
  const sessionOf = u => ({ access_token: "t_" + u.id, user: { id: u.id, email: u.email, user_metadata: { name: u.name } } });
  const getSession = () => { try { const j = localStorage.getItem(LSK); return j ? JSON.parse(j) : null; } catch (e) { return null; } };
  let authCb = null;
  const auth = {
    async getSession(){ return { data: { session: getSession() }, error: null }; },
    async signInWithPassword({ email, password }){ const u = users.find(x => x.email === email && x.password === password);
      if (!u) return { data: { session: null, user: null }, error: { message: "Invalid login credentials" } };
      const s = sessionOf(u); localStorage.setItem(LSK, JSON.stringify(s)); return { data: { session: s, user: s.user }, error: null }; },
    async signOut(){ localStorage.removeItem(LSK); authCb && authCb("SIGNED_OUT", null); return { error: null }; },
    onAuthStateChange(cb){ authCb = cb; return { data: { subscription: { unsubscribe(){ authCb = null; } } } }; },
    async resetPasswordForEmail(){ return { data: {}, error: null }; },
    async updateUser(){ return { data: {}, error: null }; },
  };
  const uid = () => { const s = getSession(); return s ? s.user.id : null; };
  const roleOf = site_id => { const m = members.find(x => x.site_id === site_id && x.user_id === uid()); return m ? m.role : null; };
  const canRead = d => !!roleOf(d.site_id) && !(d.coll === "settings" && ["cba", "prices"].includes(d.id) && roleOf(d.site_id) !== "owner");
  const canWrite = d => { const r = roleOf(d.site_id); return r === "owner" || (r === "editor" && d.coll !== "settings"); };

  function query(table){
    const q = { table, filters: [], order: null, range: null, lim: 0, op: "select", payload: null };
    const run = async () => {
      if (!uid()) return { data: null, error: { message: "JWT expired" } };
      if (table === "members"){
        const rows = members.filter(m => m.user_id === uid()).map(m => ({ role: m.role, site_id: m.site_id, site: sites.find(s => s.id === m.site_id) || null }));
        return { data: rows, error: null };
      }
      if (table !== "docs") return { data: [], error: null };
      if (q.op === "upsert"){
        const rows = Array.isArray(q.payload) ? q.payload : [q.payload];
        for (const r of rows){ if (!canWrite(r)) return { data: null, error: { message: "new row violates row-level security policy for table \"docs\"" } };
          const i = docs.findIndex(d => d.site_id === r.site_id && d.coll === r.coll && d.id === r.id); const row = { ...r, updated_at: new Date().toISOString() };
          if (i >= 0) docs[i] = row; else docs.push(row); writes.push(["upsert", r.coll + "/" + r.id]); }
        return { data: rows, error: null };
      }
      let rows = docs.filter(canRead);
      for (const [f, op, v] of q.filters) rows = rows.filter(r => op === "eq" ? r[f] === v : op === "gt" ? r[f] > v : true);
      if (q.op === "delete"){ for (const r of rows){ if (!canWrite(r)) return { data: null, error: { message: "row-level security" } }; docs.splice(docs.indexOf(r), 1); writes.push(["delete", r.coll + "/" + r.id]); } return { data: rows, error: null }; }
      if (q.order){ const [f, asc] = q.order; const key = r => f === "ts" ? Number(r.data && r.data.ts) || 0 : r[f]; rows = rows.slice().sort((a, b) => { const x = key(a), y = key(b); const c = x < y ? -1 : x > y ? 1 : 0; return asc ? c : -c; }); }
      if (q.range) rows = rows.slice(q.range[0], q.range[1] + 1);
      if (q.lim) rows = rows.slice(0, q.lim);
      return { data: rows.map(r => ({ ...r })), error: null };
    };
    const api = {
      select(){ return api; }, eq(f, v){ q.filters.push([f, "eq", v]); return api; }, gt(f, v){ q.filters.push([f, "gt", v]); return api; },
      order(f, o){ q.order = [f, !(o && o.ascending === false)]; return api; }, range(a, b){ q.range = [a, b]; return api; }, limit(n){ q.lim = n; return api; },
      upsert(p){ q.op = "upsert"; q.payload = p; return api; }, delete(){ q.op = "delete"; return api; }, match(m){ for (const k in m) q.filters.push([k, "eq", m[k]]); return api; },
      then(res, rej){ return run().then(res, rej); },
    };
    return api;
  }
  const channels = [];
  window.__SB_EMIT__ = (coll) => channels.forEach(c => c.handlers.forEach(h => h({ eventType: "UPDATE", new: { coll }, old: null })));
  const client = {
    auth, from: query,
    channel(name){ const c = { name, handlers: [], on(ev, opts, h){ c.handlers.push(h); return c; }, subscribe(cb){ cb && cb("SUBSCRIBED"); channels.push(c); return c; } }; return c; },
    removeChannel(c){ const i = channels.indexOf(c); if (i >= 0) channels.splice(i, 1); },
    storage: { from(){ return { async upload(path, blob){ writes.push(["upload", path, blob && blob.size]); return { data: { path }, error: null }; } }; } },
  };
  window.__createSupabase = () => client;
})();
