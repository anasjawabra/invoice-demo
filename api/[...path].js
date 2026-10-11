// Vercel serverless entry for the data service: every /api/* request is answered by the same handler that `npm start` and the Vite dev server use.
// The handler and the whole data service are bundled into ./_handler.mjs by `npm run build` (the server code uses extensionless imports, so it cannot run as raw ESM).
// The demo world is generated in memory per function instance (deterministic, compact: a few milliseconds); records uploaded in one session are therefore not shared between instances.
import { handleApi } from './_handler.mjs';

export default async function handler(req, res) { await handleApi(req, res); }
export const config = { maxDuration: 30 };
