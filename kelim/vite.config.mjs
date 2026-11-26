// Vite: פיתוח (npm run dev → http://localhost:5173) ובנייה לקובץ HTML אחד (npm run build → dist/kelim.html).
// הקוד ב-src/: index.html, style.css ו-js/ (מודולים; הכניסה js/main.js).
// בפיתוח: window.claude מדומה (tests/mock-claude.js) עם נתוני דוגמה. פרמטרים: ?role=owner|editor|viewer ?empty=1
import fs from "node:fs";
import { createRequire } from "node:module";
import { viteSingleFile } from "vite-plugin-singlefile";
const require = createRequire(import.meta.url);
const ROOT = new URL("./", import.meta.url).pathname;

function devMock(){
  return {
    name: "kelim-dev-mock",
    apply: "serve",
    transformIndexHtml(html, ctx){
      const u = new URL(ctx.originalUrl || "/", "http://x");
      delete require.cache[require.resolve("./tests/fixture.js")];
      const mock = { role: u.searchParams.get("role") || "owner", seed: u.searchParams.get("empty") ? {} : require("./tests/fixture.js") };
      const inject = "<script>window.__MOCK__=" + JSON.stringify(mock) + ";</script><script>" + fs.readFileSync(ROOT + "tests/mock-claude.js", "utf8") + "</script>";
      return html.replace("<head>", "<head>" + inject);
    },
  };
}

const CLOUD = process.env.KELIM_CLOUD === "1";   // npm run build:cloud → dist/cloud (לינק רגיל ב-Vercel)
export default {
  define: { __CLOUD__: JSON.stringify(CLOUD) },
  root: ROOT + "src",
  plugins: [devMock(), viteSingleFile({ removeViteModuleLoader: true })],
  build: { outDir: ROOT + (CLOUD ? "dist/cloud" : "dist/build"), emptyOutDir: true, minify: false, cssMinify: false, target: "es2020", modulePreload: false, reportCompressedSize: false },
  server: { open: false },
  clearScreen: false,
  logLevel: "warn",
};
