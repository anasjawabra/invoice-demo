// Deterministic names and invertible identifiers for the generated world.
// Identifiers are TEXT (12-digit SADAD, 10-digit subscription, 14-digit violation). They are bijections of the
// invoice's stable key x = (year-2020)*1e7 + serial, so they never change as the date advances AND can be searched
// without storing a Map of millions of strings (search decodes the number back to the invoice key).
import { mix, Rng, PAYER_POOL, HOUSING_PAYER_BASE, WL_PAYER_BASE } from './world.js';

const M12 = 1_000_000_000_000n; const M10 = 10_000_000_000n; const M14 = 100_000_000_000_000n;
const A12 = 19999991n; const B12 = 407700123456n % M12; const A10 = 19999993n; const B10 = 5171234567n; const A14 = 19999999n; const B14 = 31415926535897n % M14;
function inv(a, m) { let [t, nt, r, nr] = [0n, 1n, m, ((a % m) + m) % m]; while (nr !== 0n) { const q = r / nr; [t, nt] = [nt, t - q * nt]; [r, nr] = [nr, r - q * nr]; } return ((t % m) + m) % m; }
const I12 = inv(A12, M12); const I10 = inv(A10, M10); const I14 = inv(A14, M14);

export const keyOf = (idKey) => { const y = Math.floor(idKey / 1e8); return (y - 2020) * 1e7 + (idKey % 1e8); };
export const idKeyOf = (x) => (2020 + Math.floor(x / 1e7)) * 1e8 + (x % 1e7);
export const invoiceIdOf = (idKey) => `INV-${Math.floor(idKey / 1e8)}-${String(idKey % 1e8).padStart(7, '0')}`;
export function parseInvoiceId(s) { const m = /^INV-(\d{4})-(\d{7})$/.exec(String(s || '').trim()); return m ? Number(m[1]) * 1e8 + Number(m[2]) : null; }

export const sadadOf = (idKey) => String((BigInt(keyOf(idKey)) * A12 + B12) % M12).padStart(12, '0');
export const subscriptionOf = (idKey) => String((BigInt(keyOf(idKey)) * A10 + B10) % M10).padStart(10, '0');
export const violationOf = (idKey) => String((BigInt(keyOf(idKey)) * A14 + B14) % M14).padStart(14, '0');
function decode(num, I, B, M) { if (!/^\d+$/.test(num)) return null; const x = Number((((BigInt(num) - B) % M + M) % M * I) % M); return x < 3e8 ? idKeyOf(x) : null; }
export const idKeyFromSadad = (s) => decode(s, I12, B12, M12);
export const idKeyFromSubscription = (s) => decode(s, I10, B10, M10);
export const idKeyFromViolation = (s) => decode(s, I14, B14, M14);

/* ---- payer names (fictional) ---- */
const NAME_A = [['شركة', 'Co.'], ['مؤسسة', 'Est.'], ['مجموعة', 'Group']];
const NAME_B = [['الأفق', 'Al-Ofuq'], ['النخبة', 'Al-Nukhba'], ['المدار', 'Al-Madar'], ['الريادة', 'Al-Riyada'], ['واحة', 'Waha'], ['بنيان', 'Bunyan'], ['الرؤية', 'Al-Ruaya'], ['السلام', 'Al-Salam'], ['آفاق', 'Afaq'], ['الجزيرة', 'Al-Jazira'], ['نماء', 'Namaa'], ['الواحة', 'Al-Waha'], ['السحاب', 'Al-Sahab'], ['الرمال', 'Al-Rimal'], ['الخليج', 'Al-Khaleej'], ['الصقر', 'Al-Saqr'], ['المنارة', 'Al-Manara'], ['الدرة', 'Al-Durra'], ['تلال', 'Tilal'], ['بوابة', 'Bawwaba'], ['الندى', 'Al-Nada'], ['القمة', 'Al-Qimma'], ['الشروق', 'Al-Shurooq'], ['الفجر', 'Al-Fajr']];
const NAME_C = [['للتطوير', 'Development'], ['للمقاولات', 'Contracting'], ['التجارية', 'Trading'], ['للاستثمار', 'Investment'], ['العقارية', 'Real Estate'], ['للخدمات', 'Services'], ['للإعلان', 'Advertising'], ['للتشغيل', 'Operations'], ['للتموين', 'Catering'], ['للنقل', 'Transport']];
let POOL = null;
export function payerPool() {
  if (POOL) return POOL;
  const r = new Rng(); POOL = [];
  for (let i = 0; i < PAYER_POOL; i += 1) {
    r.reset(mix(77, i));
    const a = NAME_A[r.int(NAME_A.length)]; const b = NAME_B[r.int(NAME_B.length)]; const c = NAME_C[r.int(NAME_C.length)];
    POOL.push({ ar: `${a[0]} ${b[0]} ${c[0]}`, en: `${b[1]} ${c[1]} ${a[1]}` });
  }
  return POOL;
}
export function payerName(idx) {
  if (idx >= WL_PAYER_BASE) { const n = String(idx - WL_PAYER_BASE + 1000).slice(-5); return { ar: `مالك أرض ${n}`, en: `Land owner ${n}` }; }
  if (idx >= HOUSING_PAYER_BASE) { const n = String(idx - HOUSING_PAYER_BASE + 1000).slice(-5); return { ar: `مشتري سكني ${n}`, en: `Residential buyer ${n}` }; }
  return payerPool()[idx % PAYER_POOL];
}
export const beneficiaryIdOf = (idx) => `10${String(mix(8, idx) % 100000000).padStart(8, '0')}`;
export const crNoOf = (c) => `10${String(Math.floor(mix(7, c) / 43)).padStart(8, '0').slice(-8)}`;

/* ---- source-record identifiers (deed, licence, disclosure, visit, facility, request): text, invertible bijections of the invoice key ---- */
const codec = (prefix, A, B, width) => {
  const M = 10n ** BigInt(width); const Ainv = inv(BigInt(A), M); const Bn = BigInt(B) % M;
  return {
    of: (idKey) => `${prefix}${String((BigInt(keyOf(idKey)) * BigInt(A) + Bn) % M).padStart(width, '0')}`,
    num: (idKey) => String((BigInt(keyOf(idKey)) * BigInt(A) + Bn) % M).padStart(width, '0'),
    decode: (s) => { const t = String(s || '').trim().toUpperCase(); if (!t.startsWith(prefix)) return null; const d = t.slice(prefix.length); if (!/^\d+$/.test(d) || d.length !== width) return null; const x = Number((((BigInt(d) - Bn) % M + M) % M * Ainv) % M); return x < 3e8 ? idKeyOf(x) : null; }
  };
};
export const DEED = codec('DEED-', 20000003, 3141592653, 10);
export const LICENCE = codec('LIC-', 20000009, 2718281828, 10);
export const DISCLOSURE = codec('DSC-', 20000011, 1618033988, 9);
export const VISIT = codec('VIS-', 20000017, 1414213562, 9);
export const SCHEDULE = codec('SCH-', 20000023, 1732050807, 9);
export const REQUEST = codec('RQ-', 20000029, 2236067977, 12);
export const facilityKeyOf = (payerIdx) => `FAC-${String(payerIdx).padStart(5, '0')}`;
export const parseFacilityKey = (s) => { const m = /^FAC-(\d{5})$/.exec(String(s || '').trim().toUpperCase()); return m ? Number(m[1]) : null; };
// fictional natural-person / identity values (never copied from any file)
export const personName = (seed) => { const A = ['أحمد', 'خالد', 'سعد', 'فهد', 'ناصر', 'عبدالله', 'محمد', 'سلطان', 'ماجد', 'بدر']; const B = ['الراشد', 'العنزي', 'الحربي', 'الدوسري', 'القحطاني', 'الشمري', 'المطيري', 'الزهراني', 'الغامدي', 'السبيعي']; const h = mix(81, seed); return { ar: `${A[h % 10]} ${B[(h >>> 8) % 10]} (تجريبي)`, en: `Demo person ${String(h % 100000).padStart(5, '0')}` }; };
export const nationalIdOf = (seed) => `1${String(mix(82, seed) % 1e9).padStart(9, '0')}`;
export const mobileOf = (seed) => `05${String(mix(83, seed) % 1e8).padStart(8, '0')}`;
export const hash = (...a) => mix(90, ...a);
