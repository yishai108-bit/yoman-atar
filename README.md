# יומן אתר

Field logistics app for the Ein Tamar solar site: stock from delivery notes, movements, counts, broken-panel log, WhatsApp export import.

- `public/` — the app (installable PWA), `manifest.webmanifest`, `sw.js`, `seed.json` (initial deliveries)
- `api/` — Vercel serverless functions: `db` (documents in Vercel Blob), `upload` (photos), `read` (Claude vision extraction)

## Environment variables (Vercel → Project → Settings → Environment Variables)

| Name | What |
|---|---|
| `SITE_PIN` | the code the crew types once to open the app |
| `ANTHROPIC_API_KEY` | key from console.anthropic.com — used only by `/api/read` |
| `BLOB_READ_WRITE_TOKEN` | created automatically when you add a **Blob** store under Project → Storage |

Redeploy after setting them.
