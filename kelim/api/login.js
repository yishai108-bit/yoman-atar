// POST /api/login {code}  → עוגייה לחצי שנה.  GET → האם כבר מחובר.
const { code, token, authed, json } = require("./_lib.js");
const fails = { n: 0, since: 0 };
module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 200, { ok: authed(req), needsCode: !!code() });
  const now = Date.now(); if (now - fails.since > 600000){ fails.n = 0; fails.since = now; }
  if (fails.n >= 20) return json(res, 429, { error: "wait" });
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const given = String(body.code || "").trim();
  if (!code() || given === code()){
    res.setHeader("set-cookie", "kelim=" + token() + "; Path=/; Max-Age=15552000; HttpOnly; Secure; SameSite=Lax");
    return json(res, 200, { ok: true });
  }
  fails.n++; await new Promise(r => setTimeout(r, 500));
  return json(res, 401, { error: "code" });
};
