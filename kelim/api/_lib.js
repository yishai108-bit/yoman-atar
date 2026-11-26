// משותף לנקודות הקצה: חיבור ל-Vercel Blob ובדיקת קוד הכניסה (עוגייה).
const crypto = require("crypto");
const { put, list, del, get } = require("@vercel/blob");
const { makeDb } = require("./_store.js");

const ACCESS = "private";
const blob = {
  async list(prefix){ const out = []; let cursor; do { const r = await list({ prefix, cursor, limit: 1000 }); out.push(...r.blobs.map(b => b.pathname)); cursor = r.hasMore ? r.cursor : null; } while (cursor); return out; },
  async read(pathname){ const r = await get(pathname, { access: ACCESS, useCache: false }); if (!r || !r.stream) return null; return await new Response(r.stream).text(); },
  async write(pathname, text){ await put(pathname, text, { access: ACCESS, addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" }); },
  async remove(names){ if (names.length) await del(names); },
};
const db = makeDb(blob);

const code = () => (process.env.KELIM_CODE || "").trim();
const token = () => crypto.createHash("sha256").update("kelim|" + code()).digest("hex");
function cookies(req){ const o = {}; for (const p of (req.headers.cookie || "").split(";")){ const i = p.indexOf("="); if (i > 0) o[p.slice(0, i).trim()] = p.slice(i + 1).trim(); } return o; }
function authed(req){ if (!code()) return true; const c = cookies(req).kelim || ""; const t = token(); return c.length === t.length && crypto.timingSafeEqual(Buffer.from(c), Buffer.from(t)); }
function guard(req, res){ if (authed(req)) return true; res.statusCode = 401; res.setHeader("content-type", "application/json"); res.end('{"error":"code"}'); return false; }
function json(res, status, body){ res.statusCode = status; res.setHeader("content-type", "application/json; charset=utf-8"); res.setHeader("cache-control", "no-store"); res.end(JSON.stringify(body)); }
module.exports = { db, put, get, ACCESS, code, token, authed, guard, json };
