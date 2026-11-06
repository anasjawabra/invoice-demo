// Credential primitives of the identity core (Node crypto only): scrypt password hashing, HMAC-signed tokens, one-time codes.
// NOTHING here logs or returns a secret; callers never put a hash, salt, password, code or signing key into a payload, audit entry or error.
import { scryptSync, randomBytes, createHmac, createHash, timingSafeEqual } from 'node:crypto';

const COST = { N: 16384, r: 8, p: 1, keylen: 64 };
export const ALGO = `scrypt:N${COST.N}r${COST.r}p${COST.p}`;
let costOverride = null; // tests may lower the cost (resetForTests option); never set in production
export const setScryptCostForTests = (n) => { costOverride = n ? { ...COST, N: n } : null; };
const parseAlgo = (algo) => { const m = /^scrypt:N(\d+)r(\d+)p(\d+)$/.exec(String(algo || '')); return m ? { N: +m[1], r: +m[2], p: +m[3], keylen: COST.keylen } : null; };
const algoOf = (c) => `scrypt:N${c.N}r${c.r}p${c.p}`;

/** → { hash (hex), salt (hex), algo } with a fresh random 16-byte salt */
export function hashPassword(password) {
  const c = costOverride || COST; const salt = randomBytes(16);
  const hash = scryptSync(String(password), salt, c.keylen, { N: c.N, r: c.r, p: c.p, maxmem: 128 * c.N * c.r * 2 });
  return { hash: hash.toString('hex'), salt: salt.toString('hex'), algo: algoOf(c) };
}
export function verifyPassword(password, credential) {
  const c = credential && parseAlgo(credential.algo); if (!c || !credential.hash || !credential.salt) return false;
  try {
    const got = scryptSync(String(password), Buffer.from(credential.salt, 'hex'), c.keylen, { N: c.N, r: c.r, p: c.p, maxmem: 128 * c.N * c.r * 2 });
    const want = Buffer.from(credential.hash, 'hex'); return want.length === got.length && timingSafeEqual(want, got);
  } catch { return false; }
}

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const fromB64u = (s) => Buffer.from(String(s), 'base64url');
const sign = (secret, data) => createHmac('sha256', secret).update(data).digest();
/** token = base64url(JSON{uid,tv,exp}) . base64url(HMAC-SHA256) — carries nothing else */
export function signToken(secret, payload) { const body = b64u(JSON.stringify({ uid: payload.uid, tv: payload.tv, exp: payload.exp })); return `${body}.${b64u(sign(secret, body))}`; }
/** → { uid, tv, exp } | null  (bad shape, bad signature or expired) */
export function verifyToken(secret, token, nowMs = Date.now()) {
  if (typeof token !== 'string' || token.length > 2048) return null; const i = token.indexOf('.'); if (i <= 0 || token.indexOf('.', i + 1) >= 0) return null;
  const body = token.slice(0, i); const sig = fromB64u(token.slice(i + 1)); const want = sign(secret, body);
  if (sig.length !== want.length || !timingSafeEqual(sig, want)) return null;
  try { const p = JSON.parse(fromB64u(body).toString('utf8')); if (!p || typeof p.uid !== 'string' || !Number.isInteger(p.tv) || typeof p.exp !== 'number' || p.exp <= nowMs) return null; return { uid: p.uid, tv: p.tv, exp: p.exp }; } catch { return null; }
}

export const randomId = (prefix) => `${prefix}-${randomBytes(6).toString('hex')}`;
export const randomSecret = () => randomBytes(32).toString('hex');
export const sha256 = (s) => createHash('sha256').update(String(s)).digest('hex');
/** an activation code like 7KQ2-M9XD-4TPW (60 bits, unambiguous alphabet); only its sha256 is stored */
export function newActivationCode() {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; const b = randomBytes(12); let s = '';
  for (let i = 0; i < 12; i++) { s += A[b[i] % A.length]; if (i % 4 === 3 && i < 11) s += '-'; }
  return s;
}
export const normalizeCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const hashCode = (c) => sha256(`activation|${normalizeCode(c)}`);
