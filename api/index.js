// Vercel serverless entry for the data service. EVERY /api/** request (single- or multi-segment: /api/health, /api/auth/login, /api/plans/references …) is sent here by the rewrite in vercel.json
// (`/api/:path*` → `/api`); the handler routes by the ORIGINAL request URL, exactly as `npm start` and the Vite dev server do. (A `api/[...path].js` catch-all file only matched ONE segment on Vercel, so sign-in and all
// nested routes returned Vercel's own 404 — that is why this file and the rewrite exist.)
// The handler and the whole data service are bundled into ./_handler.mjs by `npm run build` (the server code uses extensionless imports, so it cannot run as raw ESM).
// The demo world is generated in memory per function instance (deterministic, compact: a few milliseconds); records uploaded in one session are therefore not shared between instances.
import { handleApi } from './_handler.mjs';

export default async function handler(req, res) { await handleApi(req, res); }
export const config = { maxDuration: 30 };
