// בונה את artifact/yoman.html מ-src/ בעזרת Vite (vite.config.mjs): מודולים ב-src/js, נכנסים לקובץ HTML אחד.
//   node tools/build.js           בונה וכותב את artifact/yoman.html
//   node tools/build.js --check   בודק שהקובץ הקיים זהה לבנייה (בלי לכתוב)
//   node tools/build.js --sites   כותב גם dist/<אתר>.html לכל מופע לפי src/sites.json (הקבצים שמתפרסמים)
//   node tools/build.js --cloud   בונה את הגרסה לאירוח עצמאי (Vercel + Supabase) ל-dist/cloud/ (index.html + manifest + אייקונים)
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src");
const OUT = path.join(ROOT, "artifact", "yoman.html");

let cached = null;
function build(){
  if (cached) return cached;
  execFileSync(process.execPath, [path.join(path.dirname(require.resolve("vite/package.json")), "bin", "vite.js"), "build", "--logLevel", "error"], { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });
  return (cached = fs.readFileSync(path.join(ROOT, "dist", "build", "index.html"), "utf8"));
}
// עין תמר הוא הבסיס; לכל מופע מוחלפים רק הכותרת ושם האתר (בכותרת ובברירת המחדל של SITE)
const BASE = { title: "<title>יומן אתר</title>", name: "אתר הקמה עין תמר" };
function forSite(html, site, opts){
  const swap = (s, a, b, n) => { const parts = s.split(a); if (parts.length - 1 !== n) throw new Error("ציפיתי ל-" + n + " מופעים של " + a + ", נמצאו " + (parts.length - 1)); return parts.join(b); };
  html = swap(html, BASE.title, "<title>" + site.title + "</title>", 1);
  html = swap(html, "</b>" + BASE.name + "</span>", "</b>" + site.name + "</span>", 1);
  // בפיתוח ה-JS מוגש בנפרד מה-HTML, אז שם האתר מתחלף רק בכותרת ובראש הדף
  if (opts && opts.dev) return html;
  // ברירת המחדל של SITE: בשרשור «let SITE={name:"…"», אחרי Vite «SITE = { name: "…"»
  const re = new RegExp('(SITE\\s*=\\s*\\{\\s*name:\\s*")' + BASE.name + '"', "g");
  const n = (html.match(re) || []).length;
  if (n !== 1) throw new Error("ציפיתי למופע אחד של ברירת המחדל של SITE, נמצאו " + n);
  return html.replace(re, (m, a) => a + site.name + '"');
}
// הגרסה לאירוח עצמאי: אותו index.html, רק שהכניסה היא js/cloud/boot.js (שמייבא את main.js) וההבטחה window.__backend
// נוצרת לפני הקוד. נבנה ב-Vite עם vite.cloud.config.mjs; בסוף מוסיפים manifest, אייקונים ומטא של אפליקציה למסך הבית.
const CLOUD_DIR = path.join(ROOT, "dist", "cloud");
function buildCloud(){
  const idx = fs.readFileSync(path.join(SRC, "index.html"), "utf8");
  const tag = '<script type="module" src="./js/main.js"></script>';
  if (!idx.includes(tag)) throw new Error("לא מצאתי את תגית main.js ב-src/index.html");
  const cloud = idx.replace(tag, '<script>window.__backend=new Promise(function(r){window.__backendReady=r;});</script>\n<script type="module" src="./js/cloud/boot.js"></script>');
  const tmp = path.join(SRC, "cloud.html");
  fs.writeFileSync(tmp, cloud);
  try {
    execFileSync(process.execPath, [path.join(path.dirname(require.resolve("vite/package.json")), "bin", "vite.js"), "build", "--config", path.join(ROOT, "vite.cloud.config.mjs"), "--logLevel", "error"], { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });
  } finally { fs.unlinkSync(tmp); }
  let html = fs.readFileSync(path.join(CLOUD_DIR, "cloud.html"), "utf8");
  const head = '<link rel="manifest" href="./manifest.webmanifest"><link rel="apple-touch-icon" href="./apple-touch-icon.png"><link rel="icon" href="./icon-192.png" type="image/png">'
    + '<meta name="theme-color" content="#1D4E6B"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="default"><meta name="apple-mobile-web-app-title" content="יומן אתר">';
  // Vite מכניס את הקוד לתוך <head>, ו-"</head>" הראשון בקובץ הוא בתוך תבנית הדוח השבועי; לכן מוסיפים מיד אחרי <meta charset>
  const at = html.indexOf("<meta charset=utf8>"); if (at < 0) throw new Error("לא מצאתי את <meta charset> בבנייה");
  html = html.slice(0, at + "<meta charset=utf8>".length) + head + html.slice(at + "<meta charset=utf8>".length);
  fs.writeFileSync(path.join(CLOUD_DIR, "index.html"), html);
  fs.unlinkSync(path.join(CLOUD_DIR, "cloud.html"));
  for (const f of fs.readdirSync(path.join(SRC, "pwa"))) fs.copyFileSync(path.join(SRC, "pwa", f), path.join(CLOUD_DIR, f));
  return html;
}
module.exports = { build, buildCloud, forSite, OUT, CLOUD_DIR };

if (require.main === module){
  if (process.argv.includes("--cloud")){ const h = buildCloud(); console.log("נכתב dist/cloud/index.html · " + h.split("\n").length + " שורות"); if (process.argv.length <= 3) process.exit(0); }
  const out = build();
  if (process.argv.includes("--check")){
    const cur = fs.readFileSync(OUT, "utf8");
    if (cur !== out){ console.error("artifact/yoman.html לא זהה לבנייה מ-src/. להריץ: npm run build"); process.exit(1); }
    console.log("זהה לבנייה.");
  } else {
    fs.writeFileSync(OUT, out);
    console.log("נכתב " + path.relative(ROOT, OUT) + " · " + out.split("\n").length + " שורות");
  }
  if (process.argv.includes("--sites")){
    const sites = JSON.parse(fs.readFileSync(path.join(SRC, "sites.json"), "utf8"));
    fs.mkdirSync(path.join(ROOT, "dist"), { recursive: true });
    for (const [id, site] of Object.entries(sites)){ fs.writeFileSync(path.join(ROOT, "dist", id + ".html"), forSite(out, site)); console.log("dist/" + id + ".html"); }
  }
}
