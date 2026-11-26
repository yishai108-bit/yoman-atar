// בונה את artifact/kelim.html (הקובץ שמתפרסם כארטיפקט) מ-src/ בעזרת Vite.
//   node tools/build.js           בונה וכותב את artifact/kelim.html
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "artifact", "kelim.html");

let cached = null;
function build(){
  if (cached) return cached;
  execFileSync(process.execPath, [path.join(path.dirname(require.resolve("vite/package.json")), "bin", "vite.js"), "build", "--logLevel", "error"], { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });
  cached = fs.readFileSync(path.join(ROOT, "dist", "build", "index.html"), "utf8");
  fs.writeFileSync(OUT, cached);
  return cached;
}
module.exports = { build, OUT };
if (require.main === module){ const h = build(); console.log("נכתב artifact/kelim.html · " + h.split("\n").length + " שורות · " + Math.round(h.length / 1024) + "KB"); }
