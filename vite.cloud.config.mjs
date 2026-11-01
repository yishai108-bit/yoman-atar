// בנייה לאירוח עצמאי (Vercel + Supabase): src/cloud.html (נוצר מ-src/index.html ב-tools/build.js --cloud) → dist/cloud/index.html.
// אותו קוד כמו ה-artifact, בתוספת js/cloud/ (כניסה, בחירת אתר, שכבת החיבור ל-Supabase). קובץ HTML אחד + manifest ואייקונים.
import { viteSingleFile } from "vite-plugin-singlefile";
const ROOT = new URL("./", import.meta.url).pathname;
export default {
  root: ROOT + "src",
  plugins: [viteSingleFile({ removeViteModuleLoader: true })],
  build: { outDir: ROOT + "dist/cloud", emptyOutDir: true, minify: false, cssMinify: false, target: "es2020", modulePreload: false, reportCompressedSize: false,
    rollupOptions: { input: ROOT + "src/cloud.html" } },
  clearScreen: false,
  logLevel: "warn",
};
