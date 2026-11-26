// GET  /api/db          כל הנתונים: { equipment:{id:doc}, checks, defects, services, settings }
// POST /api/db {ops:[{coll,id,doc|null}]}   כתיבה או מחיקה
const { db, guard, json } = require("./_lib.js");
module.exports = async (req, res) => {
  if (!guard(req, res)) return;
  try {
    if (req.method === "POST"){
      const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
      await db.write(body.ops);
      return json(res, 200, { ok: true });
    }
    return json(res, 200, await db.load());
  } catch (e){ return json(res, e.status || 500, { error: e.status ? e.message : "server" }); }
};
