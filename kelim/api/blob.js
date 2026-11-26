// צילומים: POST /api/blob (גוף בינארי, x-type = סוג התמונה) → {id,url};  GET /_blob/<id> מחזיר את התמונה.
const crypto = require("crypto");
const { put, get, ACCESS, guard, json } = require("./_lib.js");
const TYPES = ["image/jpeg", "image/png", "image/webp"];
module.exports = async (req, res) => {
  if (!guard(req, res)) return;
  try {
    if (req.method === "POST"){
      const type = TYPES.includes(req.headers["x-type"]) ? req.headers["x-type"] : "image/jpeg";
      let buf = req.body;
      if (!Buffer.isBuffer(buf)){ const chunks = []; for await (const c of req) chunks.push(c); buf = Buffer.concat(chunks); }
      if (!buf.length || buf.length > 4000000) return json(res, 400, { error: "size" });
      const id = crypto.randomBytes(12).toString("hex");
      await put("ph/" + id, buf, { access: ACCESS, addRandomSuffix: false, contentType: type });
      return json(res, 200, { id, url: "/_blob/" + id, sizeBytes: buf.length, contentType: type });
    }
    const id = String((req.query && req.query.id) || "");
    if (!/^[a-f0-9]{24}$/.test(id)) return json(res, 404, { error: "not found" });
    const r = await get("ph/" + id, { access: ACCESS });
    if (!r || !r.stream) return json(res, 404, { error: "not found" });
    const buf = Buffer.from(await new Response(r.stream).arrayBuffer());
    res.statusCode = 200; res.setHeader("content-type", (r.blob && r.blob.contentType) || "image/jpeg"); res.setHeader("cache-control", "private, max-age=86400");
    res.end(buf);
  } catch (e){ return json(res, 500, { error: "server" }); }
};
