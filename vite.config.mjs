// סביבת פיתוח מקומית: npm run dev → http://localhost:5173
// מגיש את האפליקציה כפי שהיא נבנית מ-src/ (אותה בנייה של tools/build.js), עם window.claude מדומה
// (tests/mock-claude.js) ונתוני הדוגמה הסינתטיים של הבדיקות. כל שמירה בקובץ ב-src/ טוענת את הדף מחדש.
// פרמטרים בכתובת: ?role=editor|viewer  ?empty=1 (בלי נתונים)  ?site=moledet|beer-tuvia
// זה שלב 1 של המעבר ל-Vite. הקובץ שמתפרסם עדיין נבנה ב-tools/build.js, זהה בייט-לבייט.
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const SRC = new URL("./src/", import.meta.url).pathname;

function yomanDev(){
  return {
    name: "yoman-dev",
    configureServer(server){
      server.watcher.add(SRC);
      server.watcher.on("change", f => { if (f.startsWith(SRC)) server.ws.send({ type: "full-reload" }); });
      server.middlewares.use(async (req, res, next) => {
        const u = new URL(req.url, "http://x");
        if (u.pathname !== "/" && u.pathname !== "/index.html") return next();
        try {
          for (const k of Object.keys(require.cache)) if (k.includes("/tools/build.js") || k.includes("/tests/fixture.js")) delete require.cache[k];
          const { build, forSite } = require("./tools/build.js");
          let html = build();
          const site = u.searchParams.get("site");
          if (site){ const sites = JSON.parse(fs.readFileSync(SRC + "sites.json", "utf8")); if (sites[site]) html = forSite(html, sites[site]); }
          const mock = { role: u.searchParams.get("role") || "owner", seed: u.searchParams.get("empty") ? {} : require("./tests/fixture.js") };
          const inject = "<script>window.__MOCK__=" + JSON.stringify(mock) + ";</script><script>" + fs.readFileSync(new URL("./tests/mock-claude.js", import.meta.url), "utf8") + "</script>";
          html = html.replace("<head>", "<head>" + inject);
          html = await server.transformIndexHtml(req.url, html);
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(html);
        } catch (e){ next(e); }
      });
    },
  };
}

export default { plugins: [yomanDev()], server: { open: false }, clearScreen: false };
