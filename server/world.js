// ============================================================================
// DEMO WORLD GENERATOR (columnar) — «بيانات تجريبية».
//
// Synthetic data INSPIRED by the scale and shape of the January–March 2026 monthly
// revenue reports (SAR millions per month, per Amanah, per revenue source, 2026 vs
// 2025) and by the column structure of the sample extract (invoice header repeated
// on every item row, status vocabulary, revenue-account taxonomy, payment dates).
// It is NOT the Ministry's data, not an official forecast; no real person or
// establishment is copied; no sample rows are reused.
//
// DETERMINISM — generateWorld(today) is a pure function of (SEED, today, scale).
// Every invoice, payment plan, cancellation and exclusion is drawn from its OWN
// random stream keyed by (month, source, entity, index), never from a shared
// sequence, and invoice ids come from a per-year serial that also advances for
// invoices that are not visible yet. So moving `today` forward only (a) reveals
// invoices issued on the new days and (b) reveals planned payments / cancellations
// / approvals dated up to the new today. Everything already visible keeps its id,
// amount and history. Nothing is dated after `today`; future contract installments
// live only in the contract schedule (never invoices, collections or arrears).
//
// STORAGE — one typed-array column per field (a few hundred bytes per invoice would
// not fit a browser, ~70 bytes does). Amounts are SAR; the display unit is applied
// at render time only (utils/money.js).
// ============================================================================
import { grpOf, ENTITIES, N_AMANAH, ENT_HOUSING, ENT_UNASSIGNED, ITEM_INDEX, SOURCE_INDEX, RULE_BIT, F, GRP, withGrp, withExt, CH_WALLET, dayNum, isoOf } from '../src/data/catalog.js';
import { PARAMS } from '../src/data/sourceAssumptions.js';
import { invoiceIdOf, sadadOf } from './names.js';
import { toSciNotation } from '../src/data/sanadSource.js';

export const SEED = 20261008;
export const GEN_START = '2024-10-01'; // opening history so early-2025 receipts include payments on late-2024 invoices

/* ------------------------------------------------------------------ RNG (counter based, allocation free) */
export function mix(a, b = 0, c = 0, d = 0) {
  let h = (0x9e3779b9 ^ SEED) | 0;
  h = Math.imul(h ^ (a | 0), 0x85ebca6b); h ^= h >>> 13;
  h = Math.imul(h ^ (b | 0), 0xc2b2ae35); h ^= h >>> 16;
  h = Math.imul(h ^ (c | 0), 0x27d4eb2f); h ^= h >>> 15;
  h = Math.imul(h ^ (d | 0), 0x165667b1); h ^= h >>> 13;
  return h >>> 0;
}
export class Rng {
  constructor(seed = 1) { this.s = seed >>> 0; }
  reset(seed) { this.s = seed >>> 0; return this; }
  next() { let t = (this.s += 0x6d2b79f5) >>> 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  gauss() { let u = 0; let v = 0; while (u === 0) u = this.next(); while (v === 0) v = this.next(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  lognormal(sigma) { return Math.exp(sigma * this.gauss() - (sigma * sigma) / 2); }
  expo(mean) { return -Math.log(1 - this.next()) * mean; }
  int(n) { return Math.floor(this.next() * n); }
}
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const pad = (n, w) => String(n).padStart(w, '0');

/* ------------------------------------------------------------------ Store */
const COLS = {
  idKey: Float64Array, issue: Int32Array, due: Int32Array, gross: Float64Array, adjAmt: Float64Array, adjDay: Int32Array,
  ent: Uint8Array, muni: Uint8Array, scope: Uint8Array, src: Uint8Array, item: Uint8Array, lines: Uint8Array,
  payStart: Int32Array, payCount: Uint8Array, cancelDay: Int32Array, exMask: Uint16Array, exAppr: Uint16Array, exRev: Uint8Array,
  flags: Uint16Array, contract: Int32Array, inst: Uint16Array, cstat: Uint8Array, crSt: Uint8Array, exec: Int16Array,
  efaa: Uint8Array, alink: Uint8Array, payer: Uint16Array, owner: Uint16Array
};
const PCOLS = { pInv: Int32Array, pDay: Int32Array, pAmt: Float64Array, pCh: Uint8Array };

export class Store {
  constructor(cap = 1 << 16) {
    this.n = 0; this.cap = cap; this.pn = 0; this.pcap = cap;
    for (const [k, T] of Object.entries(COLS)) this[k] = new T(cap);
    for (const [k, T] of Object.entries(PCOLS)) this[k] = new T(cap);
    this.nGen = 0; // generated (id-sorted) region [0, nGen); the rest are fixtures / uploads
    this.fixtures = new Map(); // idx -> original record object (anchors, uploads)
    this.fixtureById = new Map();
    this.contracts = []; this.requests = []; this.crView = new Map(); this.meta = {};
  }
  grow() {
    const nc = this.cap * 2;
    for (const [k, T] of Object.entries(COLS)) { const a = new T(nc); a.set(this[k]); this[k] = a; }
    this.cap = nc;
  }
  growPay() {
    const nc = this.pcap * 2;
    for (const [k, T] of Object.entries(PCOLS)) { const a = new T(nc); a.set(this[k]); this[k] = a; }
    this.pcap = nc;
  }
  addInvoice() { if (this.n >= this.cap) this.grow(); return this.n++; }
  addPayment(inv, day, amt, ch) { if (this.pn >= this.pcap) this.growPay(); const p = this.pn++; this.pInv[p] = inv; this.pDay[p] = day; this.pAmt[p] = amt; this.pCh[p] = ch; return p; }
  // make room for fixtures / uploaded rows after generation (no doubling copy later)
  reserve(extra, extraPay = extra * 3) {
    const nc = this.n + extra;
    for (const [k, T] of Object.entries(COLS)) { const a = new T(nc); a.set(this[k].subarray(0, this.n)); this[k] = a; }
    this.cap = nc;
    const pc = this.pn + extraPay;
    for (const [k, T] of Object.entries(PCOLS)) { const a = new T(pc); a.set(this[k].subarray(0, this.pn)); this[k] = a; }
    this.pcap = pc;
  }
  trim() {
    for (const k of Object.keys(COLS)) this[k] = this[k].slice(0, this.n);
    for (const k of Object.keys(PCOLS)) this[k] = this[k].slice(0, this.pn);
    this.cap = this.n; this.pcap = this.pn;
  }
}

/* ------------------------------------------------------------------ Calibration tables */
// Entity weights (January 2026 table shapes, SAR M) in ENTITIES order for the 17 Amanahs.
const W = {
  //          Riy   Jed   Eas   Mak   Mad   Asr   Tai  Qas  Ahs  Jaz  Tab  Hai  NBd  Naj  Haf  Bah  Jwf
  investment: [164, 136, 177, 17, 118, 91, 15, 28, 11, 25, 20, 8, 11, 9, 6, 6, 8],
  fines: [117, 325, 36, 51, 34, 48, 32, 10, 9, 11, 13, 8, 2, 4, 3, 3, 3],
  accommodation: [26, 12, 8, 50, 31, 1, 1, 1, 1, 1, 3, 0.5, 0.1, 0.3, 0.2, 0.1, 0.2],
  tobacco: [11.6, 5.3, 3.9, 0.5, 0.8, 0.7, 1, 0.2, 0.7, 0.6, 0.6, 0.2, 0.15, 0.3, 0.1, 0.1, 0.2],
  fees: [106, 47, 39, 20, 19, 15, 10, 15, 11, 8, 5, 6, 3, 4, 4, 3, 5],
  other: [425, 525, 264, 139, 203, 156, 59, 54, 33, 46, 42, 23, 16, 18, 13, 12, 16]
};
// January collection ratios per Amanah (report) -> relative payment propensity
const RATIO = [0.67, 0.43, 0.43, 0.79, 0.73, 0.30, 0.62, 0.74, 0.74, 0.56, 0.54, 0.72, 0.54, 0.64, 0.65, 0.57, 0.67];
const collectFactor = (e) => (e >= N_AMANAH ? 0.9 : clamp(RATIO[e] / 0.56, 0.55, 1.25));

// Monthly gross billing per source for 2026 (SAR M, index = month). January follows the report (710 / 306 / 136 / 27 / 15 / housing 2,184); the
// remaining months are an ASSUMED seasonal pattern. Investment is contract-driven, not listed.
export const BASE_MONTHLY = {
  fines: [710, 450, 570, 520, 480, 500, 540, 560, 530, 560, 540, 600],
  fees: [306, 200, 250, 260, 240, 250, 270, 280, 260, 270, 260, 300],
  accommodation: [136, 118, 114, 125, 130, 140, 150, 150, 135, 120, 118, 125],
  tobacco: [27, 21, 20, 23, 22, 24, 25, 25, 23, 22, 21, 24],
  other: [15, 40, 130, 60, 50, 80, 60, 50, 70, 60, 50, 200],
  housing: [2184, 237, 55, 120, 160, 140, 150, 170, 160, 150, 140, 200], // WHITE-LAND fees of the Housing sector (annual billing wave in January, report: 2,184 -> 2,418 -> 2,470 cumulative)
  housingSales: [0.3, 2.5, 3.8, 4, 4.2, 4, 4.5, 4.5, 4.2, 4, 4, 5] // residential sales (report: 0.3 -> 2.8 -> 6.6 cumulative)
};
const YEAR_FACTOR = { 2024: 0.74, 2025: 0.86, 2026: 1.0, 2027: 1.08, 2028: 1.15 };
const yearFactor = (y) => YEAR_FACTOR[y] ?? Math.pow(1.07, y - 2026);
const HOUSING_FACTOR = { 2024: 0.4, 2025: 0.55, 2026: 1.0 };
const housingFactor = (y) => HOUSING_FACTOR[y] ?? Math.pow(1.05, y - 2026);

// Per-source behaviour. `avg` is the mean invoice value (SAR): many small/medium invoices (lognormal tail), few large ones.
// `pay` eventual payment probability, `lag` mean lateness in days, `due` payment term in days, `lineMean` mean item rows per invoice.
export const SRC = {
  fines: { avg: 14000, sigma: 1.15, pay: 0.58, lag: 55, due: 30, src: 'fines', vat: 0 },
  fees: { avg: 11000, sigma: 1.1, pay: 0.82, lag: 4, due: 15, src: 'municipal_fees', vat: 0.15 },
  accommodation: { avg: 24000, sigma: 1.0, pay: 0.99, lag: 1, due: 4, src: 'accommodation', vat: 0.15 }, // disclosure platform: invoices are settled within days (reports: 96-97% collected)
  tobacco: { avg: 7500, sigma: 0.95, pay: 0.9, lag: 4, due: 10, src: 'tobacco', vat: 0.15 }, // reports: 78-82% collected
  other: { avg: 26000, sigma: 1.1, pay: 1.0, lag: 1, due: 5, src: 'municipal_fees', vat: 0.15 },
  white_lands: { avg: PARAMS.white_lands.avgDeedFee, sigma: 1.2, pay: PARAMS.white_lands.payProbability, lag: 90, due: PARAMS.white_lands.dueDays, src: 'white_lands', vat: 0 },
  housing_sales: { avg: 880000, sigma: 0.9, pay: 0.5, lag: 110, due: 30, src: 'housing_sales', vat: 0.15 }
};
export const INTERNAL_SHARE = 0.3; // municipal fees reported through the Amanah internal reports (licences)
export const CONTRACT_COUNT = 640;
const CONTRACT_MIX = [{ months: 1, w: 0.7 }, { months: 3, w: 0.18 }, { months: 6, w: 0.06 }, { months: 12, w: 0.06 }];
const CONTRACT_ANNUAL_AVG = 10.5e6;
export const PAYER_POOL = 6000;
export const HOUSING_PAYER_BASE = 10000; // residential buyers 10000..29999
export const WL_PAYER_BASE = 30000; // white-land owners 30000..59999
export const EXCEPTIONAL = [
  ['2025-02-24', 0, 280e6, '2025-04-29'], ['2025-05-19', 2, 380e6, '2025-06-24'], ['2025-10-08', 4, 300e6, '2025-11-12'],
  ['2026-02-17', 0, 410e6, '2026-04-27'], ['2026-05-13', 1, 450e6, '2026-06-11'], ['2026-09-15', 2, 520e6, '2026-10-20'], ['2027-03-10', 0, 480e6, '2027-04-14']
];

function pickIdx(rng, weights) { const t = weights.reduce((s, x) => s + x, 0); let x = rng.next() * t; for (let i = 0; i < weights.length; i += 1) { x -= weights[i]; if (x <= 0) return i; } return weights.length - 1; }

/* ------------------------------------------------------------------ Payments plan */
// returns [{day, amt, ch}] — ALL planned payments (callers drop the ones after `today`)
const plan = []; // reused
function planPayment(r, dueDay, amount, pay, lagMean) {
  plan.length = 0;
  if (r.next() > pay) return plan;
  let lag = r.next() < 0.3 ? -Math.floor(r.next() * 5) : Math.round(r.expo(lagMean));
  lag = Math.min(lag, 240);
  const day = dueDay + lag;
  if (r.next() < 0.09) {
    const first = Math.round(amount * (0.35 + r.next() * 0.35));
    plan.push({ day, amt: first, ch: 0 });
    if (r.next() < 0.6) plan.push({ day: day + 10 + r.int(60), amt: amount - first, ch: 0 });
    return plan;
  }
  plan.push({ day, amt: amount, ch: r.next() < 0.08 ? 3 : 0 });
  return plan;
}

// White-land fee invoices: a published invoice has a LastTimeToPay; part of the owners pay within weeks of publication, most of the rest
// never pay (the reports show 11-22% collected in the first quarter), a few pay long after.
function planWhiteLand(r, issueN, dueN, amount) {
  plan.length = 0;
  const A = PARAMS.white_lands;
  if (r.next() > A.payProbability) return plan;
  let day;
  if (r.next() < A.earlyPayShare) day = issueN + 3 + r.int(22);
  else { const lag = r.next() < 0.6 ? r.int(30) - 5 : 30 + Math.round(r.expo(70)); day = dueN + Math.min(lag, 300); }
  if (r.next() < 0.08) {
    const first = Math.round(amount * (0.3 + r.next() * 0.4));
    plan.push({ day, amt: first, ch: 0 });
    if (r.next() < 0.5) plan.push({ day: day + 15 + r.int(80), amt: amount - first, ch: 0 });
    return plan;
  }
  plan.push({ day, amt: amount, ch: r.next() < 0.05 ? 3 : 0 });
  return plan;
}

/* ------------------------------------------------------------------ The world */
const worldCache = new Map();

export function generateWorld(today, { scale = 1 } = {}) {
  const key = `${today}|${scale}`;
  if (worldCache.has(key)) return worldCache.get(key);
  const t0 = Date.now();
  const todayN = dayNum(today);
  const startN = dayNum(GEN_START);
  const st = new Store(Math.max(1024, Math.round(1.9e6 * scale)));
  const serialByYear = new Map();
  const rI = new Rng(); const rC = new Rng();
  const fixedAvg = (a) => a / scale; // fewer, proportionally larger invoices when scale < 1
  // compact demo: sources with few, large invoices keep a readable number of records (billed totals are unaffected — only the granularity changes)
  const COMPACT_BOOST = { white_lands: 14, housing_sales: 30, tobacco: 4, accommodation: 3 };
  const avgFor = (a, key) => a / (scale < 1 ? Math.min(1, scale * (COMPACT_BOOST[key] || 1)) : scale);

  const nextSerial = (y) => { const n = (serialByYear.get(y) || 0) + 1; serialByYear.set(y, n); return n; };
  const monthsList = [];
  { const f = GEN_START.slice(0, 7); const l = today.slice(0, 7); let y = Number(f.slice(0, 4)); let m = Number(f.slice(5, 7)); while (`${y}-${pad(m, 2)}` <= l) { monthsList.push([y, m]); m += 1; if (m > 12) { m = 1; y += 1; } } }
  const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

  /* ---------- writer ---------- */
  function writeInvoice(o) {
    const i = st.addInvoice();
    st.idKey[i] = o.idKey; st.issue[i] = o.issue; st.due[i] = o.due; st.gross[i] = o.gross;
    st.adjAmt[i] = 0; st.adjDay[i] = 0;
    st.ent[i] = o.ent; st.muni[i] = o.muni; st.scope[i] = o.scope; st.src[i] = o.src; st.item[i] = o.item; st.lines[i] = o.lines;
    st.payStart[i] = st.pn; let pc = 0;
    for (const p of o.pay) { if (p.day <= todayN) { st.addPayment(i, p.day, p.amt, p.ch); pc += 1; } }
    st.payCount[i] = pc;
    st.cancelDay[i] = o.cancelDay && o.cancelDay <= todayN ? o.cancelDay : 0;
    let exMask = o.exMask || 0; let exAppr = o.exAppr || 0;
    if (exMask && !(exMask & (exMask - 1))) { // ~7 % of single-reason invoices also carry a SECOND reason (same approval state): the metric layer must still deduct them once
      const h = Math.imul((o.idKey % 2147483629) | 0, 0x9e3779b1) >>> 0;
      if (h % 100 < 7) { const pool = [2, 8, 16, 32, 64].filter((b) => b !== exMask); const extra = pool[(h >>> 8) % pool.length]; exMask |= extra; if (exAppr & o.exMask) exAppr |= extra; }
    }
    st.exMask[i] = exMask; st.exAppr[i] = exAppr; st.exRev[i] = o.exRev || 0;
    st.flags[i] = o.flags || 0;
    st.contract[i] = o.contract ?? -1; st.inst[i] = o.inst || 0; st.cstat[i] = o.cstat || 0; st.crSt[i] = o.crSt || 0; st.exec[i] = -1;
    st.efaa[i] = o.efaa || 0; st.alink[i] = o.alink ?? (o.scope === 1 ? 0 : 1); st.payer[i] = o.payer; st.owner[i] = 0;
    return i;
  }

  // exclusion evidence for an invoice that will NEVER be paid (decided from the plan, not from today)
  function pickExclusions(r, src, ent, issueN, forever) {
    let mask = 0; let appr = 0; let efaa = 0; let flags = 0; let rev = 20 + r.int(50);
    const approve = (bit, certain) => { mask |= bit; if (certain || r.next() < 0.55) { if (issueN + rev <= todayN) appr |= bit; } };
    if (!forever) return { mask, appr, efaa, flags, rev, noContract: false };
    if (src === 'fines') {
      const roll = r.next();
      if (roll < 0.06) { approve(RULE_BIT['OBJ-1']); flags |= F.OBJECTION; efaa = 3; }
      else if (roll < 0.26) { approve(RULE_BIT['INC-1']); flags |= F.MISSING_ID; efaa = 4; }
      else if (roll < 0.34) { mask |= RULE_BIT['EXE-1']; efaa = 5; }
      else if (roll < 0.56) { approve(RULE_BIT['EFA-1']); efaa = 0; }
    } else if (src === 'investment') {
      const p = ent === 1 || ent === 5 ? 0.3 : 0.04;
      if (r.next() < p) { approve(RULE_BIT['NOC-1']); return { mask, appr, efaa, flags, rev, noContract: true }; }
    } else if (src !== 'housing_sales' && r.next() < 0.08) approve(RULE_BIT['INC-1']);
    return { mask, appr, efaa, flags, rev, noContract: false };
  }

  /* ===================== A. Non-contract sources: month × source × entity ===================== */
  const SRC_KEYS = ['fines', 'fees', 'accommodation', 'tobacco', 'other'];
  const SRC_ID = { fines: 1, fees: 2, accommodation: 3, tobacco: 4, other: 5 };
  const feesItems = ['inspection_fees', 'waste_collection', 'excavation_permits', 'ad_boards'].map((k) => ITEM_INDEX[k]);
  const licItems = ['commercial_license', 'commercial_license', 'signboard_license', 'building_permit', 'health_certificate'].map((k) => ITEM_INDEX[k]);
  const finesItems = ['building_violations', 'signage_violations', 'health_violations'].map((k) => ITEM_INDEX[k]);
  const linesFor = (r) => { const x = r.next(); return x < 0.77 ? 1 : x < 0.89 ? 2 : x < 0.95 ? 3 : 4 + r.int(3); };

  // contract schedule is needed month by month, so build contracts first (parameters only)
  const contracts = st.contracts;
  const horizonN = todayN + 370;
  const nContracts = Math.max(8, Math.round(CONTRACT_COUNT * scale));
  const instByMonth = new Map(); // 'YYYY-MM' -> [[contractIdx, instIdx], ...]
  for (let c = 0; c < nContracts; c += 1) {
    const r = rC.reset(mix(101, c));
    const ent = pickIdx(r, W.investment);
    const startY = 2020 + Math.floor(r.next() * 6.9);
    const startMonth = 1 + r.int(12); const startDay = 1 + r.int(27);
    const start = dayNum(`${startY}-${pad(startMonth, 2)}-${pad(startDay, 2)}`);
    const term = 4 + r.int(9);
    let mixRoll = r.next() * CONTRACT_MIX.reduce((s, x) => s + x.w, 0); let mixMonths = 1;
    for (const m of CONTRACT_MIX) { mixRoll -= m.w; if (mixRoll <= 0) { mixMonths = m.months; break; } }
    const anchor = r.next() < 0.8 ? 1 : 1 + r.int(12);
    const dueDay = 1 + r.int(27);
    const annual = fixedAvg(CONTRACT_ANNUAL_AVG) * ((CONTRACT_COUNT * scale) / nContracts) * r.lognormal(0.95); // total contract value stays that of the full population when fewer contracts are generated
    const payer = r.int(PAYER_POOL); const muni = r.int(3); const item = ITEM_INDEX[['land_lease', 'ad_sites', 'commercial_units'][r.int(3)]];
    const crRoll = r.next(); const crSt = crRoll < 0.9 ? 1 : crRoll < 0.94 ? 2 : crRoll < 0.97 ? 3 : 4;
    const status = r.next() < 0.06 ? 'موقوف' : 'ساري';
    const end = start + Math.round(term * 365);
    const ct = { future: start > todayN, idx: c, contractNo: `CT-${startY}-${pad(c * 7 + 13, 4)}`, ent, muni, payer, item, start, end, intervalMonths: mixMonths, anchor, dueDay, annual: Math.round(annual), crNo: `10${pad(Math.floor(mix(7, c) / 43), 8).slice(-8)}`, crSt, status, dues: [], invs: [], totalValue: 0 };
    let y = startY; let m = startMonth; let no = 0;
    for (let g = 0; g < 600; g += 1) {
      if ((((m - anchor) % mixMonths) + mixMonths) % mixMonths === 0) {
        const dueN = dayNum(`${y}-${pad(m, 2)}-${pad(dueDay, 2)}`);
        if (dueN - 10 >= start && dueN <= end) { // the first invoice is issued 10 days before its due date, never before the contract exists
          const yearsIn = Math.floor((dueN - start) / 365);
          const amount = Math.round(((annual * mixMonths) / 12) * Math.pow(1.03, yearsIn) / 10) * 10;
          no += 1; ct.totalValue += amount;
          if (dueN - 10 >= startN - 10 && dueN <= horizonN) {
            const d = { no, due: dueN, amount, inv: -1 };
            ct.dues.push(d);
            const issueN = dueN - 10;
            if (issueN >= startN && issueN <= todayN + 40) { const ym = isoOf(issueN).slice(0, 7); if (!instByMonth.has(ym)) instByMonth.set(ym, []); instByMonth.get(ym).push([c, ct.dues.length - 1]); }
          }
        }
      }
      m += 1; if (m > 12) { m = 1; y += 1; }
      if (dayNum(`${y}-${pad(m, 2)}-01`) > horizonN) break;
    }
    if (ct.dues.length) { let rem = ct.totalValue; for (const d of ct.dues) { rem -= d.amount; d.balance = Math.max(0, rem); } }
    contracts.push(ct);
  }

  const wlEnforce = []; // never-paid white-land invoices followed in the white-lands comprehensive enforcement file
  const plannedByInv = new Map(); // contract invoices: planned outcome for the Sanad rule (idx -> {paid, firstDay, due})

  for (const [y, mo] of monthsList) {
    const ym = `${y}-${pad(mo, 2)}`; const mi = mo - 1; const dim = daysIn(y, mo);
    // ---- fines, fees, accommodation, tobacco, other
    for (const sk of SRC_KEYS) {
      const cfg = SRC[sk]; const wl = W[sk]; const wTotal = wl.reduce((s, x) => s + x, 0);
      for (let e = 0; e < N_AMANAH; e += 1) {
        const r = rC.reset(mix(1, y * 12 + mo, SRC_ID[sk], e));
        const noise = r.lognormal(0.14);
        const G = BASE_MONTHLY[sk][mi] * 1e6 * yearFactor(y) * (wl[e] / wTotal) * noise;
        const avg = avgFor(cfg.avg, sk);
        // compact demo (scale < 1): a cell worth less than ONE (large) invoice yields an invoice with probability G/avg whose value is ~avg, so expected totals are preserved
        const single = scale < 1 && G < avg;
        if (!single && G < avg * 0.12) continue;
        let N = Math.floor(G / avg); if (r.next() < G / avg - N) N += 1; N = Math.max(single ? 0 : 1, N);
        if (N === 0) continue;
        const rS = single ? new Rng(mix(6, y * 12 + mo, SRC_ID[sk], e)) : null;
        const Gc = single ? avg * rS.lognormal(cfg.sigma) : G;
        // the Amanah's collection propensity applies to billing driven by inspections and fees; disclosure platforms (accommodation, tobacco) settle on their own cycle
        const monthPay = sk === 'accommodation' || sk === 'tobacco' ? clamp(1 + 0.03 * r.gauss(), 0.94, 1.04) : collectFactor(e) * clamp(1 + 0.1 * r.gauss(), 0.8, 1.2);
        // two-pass: lognormal weights, then scale so the cell sums to G (cell total matches the report scale)
        let sumW = 0; const rW = new Rng(mix(2, y * 12 + mo, SRC_ID[sk], e));
        for (let k = 0; k < N; k += 1) sumW += rW.lognormal(cfg.sigma);
        rW.reset(mix(2, y * 12 + mo, SRC_ID[sk], e));
        for (let k = 0; k < N; k += 1) {
          const wgt = rW.lognormal(cfg.sigma);
          const ri = rI.reset(mix(3, y * 12 + mo, SRC_ID[sk] * 32 + e, k));
          const gross = Math.max(100, Math.round((Gc * wgt) / sumW / 10) * 10);
          const day = sk === 'other' ? Math.min(dim, 24 + ri.int(5)) : 1 + ri.int(dim);
          const issueN = dayNum(`${ym}-${pad(day, 2)}`);
          const serial = nextSerial(y);
          // tobacco: an amended disclosure replaces the original one. Decided from its own stream BEFORE the visibility check,
          // so the serial it consumes never depends on `today` (ids stay stable as days advance).
          const rr = sk === 'tobacco' ? new Rng(mix(12, y * 12 + mo, SRC_ID[sk] * 32 + e, k)) : null;
          const replaced = !!rr && rr.next() < PARAMS.tobacco.replacedShare;
          const replSerial = replaced ? nextSerial(y) : 0;
          if (issueN > todayN) continue;
          const dueN = issueN + cfg.due;
          const internal = sk === 'fees' && ri.next() < INTERNAL_SHARE;
          const srcKey = internal ? 'licenses' : cfg.src;
          const itemIdx = sk === 'fines' ? finesItems[ri.int(3)] : internal ? licItems[ri.int(licItems.length)] : sk === 'fees' ? feesItems[ri.int(4)] : sk === 'accommodation' ? ITEM_INDEX.hotel_occupancy : sk === 'tobacco' ? ITEM_INDEX.tobacco_fee : ITEM_INDEX.misc_revenue;
          const srcFinal = srcKey;
          const payProb = clamp(cfg.pay * (sk === 'other' ? 1 : monthPay), 0, 1);
          const lagM = cfg.lag * (sk === 'fines' || sk === 'housing' ? 1 / Math.max(0.6, monthPay) : 1);
          let pl = planPayment(ri, dueN, gross, payProb, lagM).map((p) => ({ ...p }));
          // tobacco / accommodation: part of the invoice may be settled from the facility wallet on the issue day (FROM_WALLET)
          if (sk === 'tobacco' && !replaced && ri.next() < PARAMS.tobacco.walletShare) {
            const w = Math.min(gross, Math.round(gross * (0.3 + 0.7 * ri.next())));
            if (w >= gross - 1) pl = [{ day: issueN, amt: gross, ch: CH_WALLET }];
            else pl = [{ day: issueN, amt: w, ch: CH_WALLET }, ...planPayment(ri, dueN, gross - w, payProb, lagM).map((p) => ({ ...p }))];
          }
          if (replaced) pl = [];
          const forever = pl.length === 0;
          let cancelDay = 0;
          let replIssue = 0;
          if (replaced) { replIssue = issueN + 1 + rr.int(6); cancelDay = replIssue; } else if (forever && ri.next() < 0.2) cancelDay = issueN + 3 + ri.int(55);
          const ex = pickExclusions(ri, sk === 'fines' ? 'fines' : srcFinal, e, issueN, forever && !replaced);
          let exMask = ex.mask; let exAppr = ex.appr;
          if (cancelDay && !replaced && !exMask && ri.next() < 0.03) { exMask |= RULE_BIT['INC-1']; if (issueN + 20 <= todayN) exAppr |= RULE_BIT['INC-1']; }
          let flags = ex.flags | (ri.next() < 0.006 ? F.AMT_CONFLICT : 0) | (replaced ? withGrp(GRP.TB_REPLACED) : 0);
          let efaa = 0;
          if (sk === 'fines') efaa = ex.efaa || (pl.length ? 1 : 2);
          const makeenMiss = !internal && ri.next() < 0.04;
          const muniIdx = ri.int(3); const payerIdx = ri.int(PAYER_POOL);
          writeInvoice({
            idKey: y * 1e8 + serial, issue: issueN, due: dueN, gross, ent: e, muni: muniIdx, scope: internal ? 1 : 0, src: SOURCE_INDEX[srcFinal], item: itemIdx,
            lines: linesFor(ri), pay: pl, cancelDay, exMask, exAppr, exRev: ex.rev, flags, efaa, payer: payerIdx, alink: internal ? 0 : makeenMiss ? 2 : 1
          });
          if (makeenMiss) st.ent[st.n - 1] = ENT_UNASSIGNED; // Makeen could not match the invoice: the Amanah is NOT guessed
          if (replaced && replIssue <= todayN) {
            const g2 = Math.max(100, Math.round((gross * (0.9 + 0.2 * rr.next())) / 10) * 10);
            const due2 = replIssue + cfg.due;
            const pl2 = planPayment(rr, due2, g2, payProb, lagM).map((p) => ({ ...p }));
            writeInvoice({
              idKey: y * 1e8 + replSerial, issue: replIssue, due: due2, gross: g2, ent: makeenMiss ? ENT_UNASSIGNED : e, muni: muniIdx, scope: 0, src: SOURCE_INDEX[srcFinal], item: itemIdx,
              lines: 1, pay: pl2, flags: withGrp(GRP.TB_REPLACEMENT), efaa: 0, payer: payerIdx, alink: makeenMiss ? 2 : 1
            });
          }
        }
      }
    }
    // ---- housing sector, white-land fees: one invoice per owner of a deed; annual billing wave in January, small supplementary invoices after
    {
      const A = PARAMS.white_lands; const cfg = SRC.white_lands;
      const r = rC.reset(mix(1, y * 12 + mo, 9, ENT_HOUSING));
      const G = BASE_MONTHLY.housing[mi] * 1e6 * housingFactor(y) * r.lognormal(0.1);
      const avgDeed = avgFor(cfg.avg, 'white_lands');
      const singleW = scale < 1 && G < avgDeed;
      let ND = Math.max(1, Math.round(G / avgDeed));
      if (singleW) ND = new Rng(mix(7, y * 12 + mo, 9, ENT_HOUSING)).next() < G / avgDeed ? 1 : 0;
      const Gw = singleW ? avgDeed * new Rng(mix(8, y * 12 + mo, 9, ENT_HOUSING)).lognormal(cfg.sigma) : G;
      let sumW = 0; const rW = new Rng(mix(2, y * 12 + mo, 9, ENT_HOUSING));
      for (let k = 0; k < ND; k += 1) sumW += rW.lognormal(cfg.sigma);
      rW.reset(mix(2, y * 12 + mo, 9, ENT_HOUSING));
      for (let k = 0; k < ND; k += 1) {
        const deedFee = (Gw * rW.lognormal(cfg.sigma)) / sumW;
        const rd = new Rng(mix(13, y * 12 + mo, k));
        const roll = rd.next();
        const owners = roll < A.ownerSplit[0] ? 1 : roll < A.ownerSplit[0] + A.ownerSplit[1] ? 2 : 3;
        let shares = []; let sh = 0;
        for (let j = 0; j < owners; j += 1) { const x = owners === 1 ? 1 : 0.6 + rd.next(); shares.push(x); sh += x; }
        shares = shares.map((x) => x / sh);
        const day = mi === 0 ? 1 + rd.int(15) : 1 + rd.int(dim);
        const issueN = dayNum(`${ym}-${pad(day, 2)}`);
        const extRoll = rd.next(); const extDays = A.extensionDays[rd.int(A.extensionDays.length)];
        const ext = extRoll < A.extensionShare * A.extensionApproved ? 1 : extRoll < A.extensionShare * (A.extensionApproved + 0.3) ? 2 : extRoll < A.extensionShare ? 3 : 0;
        const dueN = issueN + cfg.due + (ext === 1 ? extDays : 0);
        const ent = ENT_HOUSING;
        for (let j = 0; j < owners; j += 1) {
          const serial = nextSerial(y); // consumed for every owner whether or not the invoice is visible yet
          if (issueN > todayN) continue;
          const ri = rI.reset(mix(3, y * 12 + mo, 9 * 32 + ENT_HOUSING, k * 4 + j));
          const gross = Math.max(1000, Math.round((deedFee * shares[j]) / 10) * 10);
          const pl = planWhiteLand(ri, issueN, dueN, gross).map((p) => ({ ...p }));
          const never = pl.length === 0;
          const objection = never && ri.next() < A.objectionShare / 0.72;
          const cancelDay = never && !objection && ri.next() < 0.06 ? issueN + 20 + ri.int(120) : 0;
          const grp = owners === 1 ? 0 : j === 0 ? (owners === 2 ? GRP.WL_HEAD2 : GRP.WL_HEAD3) : j === 1 ? GRP.WL_OWN2 : GRP.WL_OWN3;
          const flags = withGrp(grp) | withExt(ext) | (objection ? F.OBJECTION : 0);
          const i = writeInvoice({
            idKey: y * 1e8 + serial, issue: issueN, due: dueN, gross, ent, muni: 3, scope: 0, src: SOURCE_INDEX.white_lands, item: ITEM_INDEX.white_land_fee, lines: 1,
            pay: pl, cancelDay, exMask: objection ? RULE_BIT['OBJ-1'] : 0, flags, payer: WL_PAYER_BASE + ri.int(30000), alink: 1
          });
          if (never && !cancelDay && !objection && ri.next() < A.enforcementShare / 0.7) wlEnforce.push({ i, opened: dueN + 200 + ri.int(60) });
        }
      }
    }
    // ---- housing sector, residential sales (small)
    {
      const cfg = SRC.housing_sales; const r = rC.reset(mix(1, y * 12 + mo, 10, ENT_HOUSING));
      const G = BASE_MONTHLY.housingSales[mi] * 1e6 * housingFactor(y) * r.lognormal(0.1);
      const avg = avgFor(cfg.avg, 'housing_sales');
      const singleH = scale < 1 && G < avg;
      const N = singleH ? (new Rng(mix(7, y * 12 + mo, 10, ENT_HOUSING)).next() < G / avg ? 1 : 0) : Math.max(1, Math.round(G / avg));
      const Gh = singleH ? avg * new Rng(mix(8, y * 12 + mo, 10, ENT_HOUSING)).lognormal(cfg.sigma) : G;
      let sumW = 0; const rW = new Rng(mix(2, y * 12 + mo, 10, ENT_HOUSING));
      for (let k = 0; k < N; k += 1) sumW += rW.lognormal(cfg.sigma);
      rW.reset(mix(2, y * 12 + mo, 10, ENT_HOUSING));
      for (let k = 0; k < N; k += 1) {
        const wgt = rW.lognormal(cfg.sigma);
        const ri = rI.reset(mix(3, y * 12 + mo, 10 * 32 + ENT_HOUSING, k));
        const gross = Math.max(1000, Math.round((Gh * wgt) / sumW / 10) * 10);
        const day = 1 + ri.int(dim);
        const issueN = dayNum(`${ym}-${pad(day, 2)}`);
        const serial = nextSerial(y);
        if (issueN > todayN) continue;
        const dueN = issueN + cfg.due;
        const pl = planPayment(ri, dueN, gross, cfg.pay, cfg.lag).map((p) => ({ ...p }));
        const cancelDay = pl.length === 0 && ri.next() < 0.15 ? issueN + 5 + ri.int(50) : 0;
        writeInvoice({ idKey: y * 1e8 + serial, issue: issueN, due: dueN, gross, ent: ENT_HOUSING, muni: 0, scope: 0, src: SOURCE_INDEX.housing_sales, item: ri.next() < 0.7 ? ITEM_INDEX.housing_sales : ITEM_INDEX.housing_fees, lines: 1, pay: pl, cancelDay, payer: HOUSING_PAYER_BASE + ri.int(20000), alink: 1 });
      }
    }
    // ---- contract installments issued this month
    const list = instByMonth.get(ym) || [];
    for (const [c, di] of list) {
      const ct = contracts[c]; const d = ct.dues[di];
      const issueN = d.due - 10;
      if (issueN < startN) continue;
      const ri = rI.reset(mix(4, c, d.no, 0));
      const serial = nextSerial(y);
      if (issueN > todayN) continue;
      const payP = clamp(0.62 * collectFactor(ct.ent) * (0.9 + 0.2 * ri.next()), 0, 1);
      const pl = planPayment(ri, d.due, d.amount, payP, 38).map((p) => ({ ...p }));
      const forever = pl.length === 0;
      const ex = pickExclusions(ri, 'investment', ct.ent, issueN, forever);
      const unmatched = !ex.noContract && ri.next() < 0.04;
      const linked = !ex.noContract && !unmatched;
      const planFirst = pl.length ? pl[0].day : 0; const planSum = pl.reduce((s, p) => s + p.amt, 0);
      const i = writeInvoice({
        idKey: y * 1e8 + serial, issue: issueN, due: d.due, gross: d.amount, ent: ct.ent, muni: ct.muni, scope: 0, src: SOURCE_INDEX.investment, item: ct.item,
        lines: linesFor(ri) > 2 ? 2 : linesFor(ri), pay: pl, exMask: ex.mask, exAppr: ex.appr, exRev: ex.rev,
        flags: F.CONTRACT_INV | (ri.next() < 0.004 ? F.AMT_CONFLICT : 0), contract: linked ? c : -1, inst: d.no,
        cstat: ex.noContract ? 3 : unmatched ? 2 : 1, payer: ct.payer, alink: ri.next() < 0.04 ? 2 : 1
      });
      if (st.alink[i] === 2) st.ent[i] = ENT_UNASSIGNED;
      if (linked) { d.inv = i; ct.invs.push(i); }
      plannedByInv.set(i, { planSum, planFirst, due: d.due, amount: d.amount });
    }
    // ---- exceptional large receipts
    EXCEPTIONAL.forEach(([issue, ent, amount, paidOn], k) => {
      if (issue.slice(0, 7) !== ym) return;
      const issueN = dayNum(issue); const serial = nextSerial(y);
      if (issueN > todayN) return;
      const ri = rI.reset(mix(5, k));
      const amt = amount * Math.max(scale, 0.05);
      const dueN = issueN + 30;
      const i = writeInvoice({ idKey: y * 1e8 + serial, issue: issueN, due: dueN, gross: Math.round(amt), ent, muni: 1, scope: 0, src: SOURCE_INDEX.investment, item: ITEM_INDEX.land_lease, lines: 2, pay: [{ day: dayNum(paidOn), amt: Math.round(amt), ch: 3 }], flags: F.CONTRACT_INV | F.EXCEPTIONAL, contract: -1, cstat: 1, payer: ri.int(PAYER_POOL) });
      void i;
    });
  }
  // contracts that are not signed yet took part in the loop above ONLY so that invoice serials never depend on `today`; they are invisible
  for (let c = 0; c < contracts.length; c += 1) if (contracts[c]?.future) contracts[c] = null;
  st.nGen = st.n;

  /* ===================== D. Sanad execution requests (contract level) + CR extraction ===================== */
  let reqCount = 0;
  for (const ct of contracts) {
    if (!ct || ct.invs.length < 2) continue;
    const r = rC.reset(mix(6, ct.idx));
    // problem installments are decided from the PLANNED outcome (not from today)
    const problem = ct.invs.filter((i) => { const p = plannedByInv.get(i); return p && (p.planSum < p.amount * 0.5 || (p.planFirst && p.planFirst > p.due + 120)); });
    if (problem.length < 2 || r.next() > 0.55) continue;
    const opened = st.due[problem[1]] + 45 + r.int(30);
    if (opened > todayN) continue;
    const amount = Math.round(problem.reduce((s, i) => s + st.gross[i], 0) * (0.8 + r.next() * 0.4) / 100) * 100;
    const identified = r.next() < 0.4;
    const method = r.next() < 0.5 ? 0 : 1; // 0 structured, 1 OCR
    const confidence = method === 1 ? Math.round((0.7 + r.next() * 0.28) * 100) / 100 : 1;
    const stRoll = r.next();
    const req = { idx: reqCount, enforceNum: `EN-${3100 + ct.idx * 11}`, system: 'sanad', ent: ct.ent, amount, openedDay: opened, contractIdx: ct.idx, contractNo: ct.contractNo, status: stRoll < 0.5 ? 'قيد التنفيذ' : stRoll < 0.75 ? 'موقوف' : 'مغلق', identified: [], crNo: ct.crNo, method, confidence, debtor: ct.payer };
    if (identified) req.identified = problem.slice(0, 1 + r.int(3));
    st.requests.push(req); reqCount += 1;
    st.crView.set(ct.crNo, { crNo: ct.crNo, status: ct.crSt, name: ct.payer });
    for (const i of ct.invs) {
      st.crSt[i] = ct.crSt;
      if ([2, 3, 4].includes(ct.crSt) && st.payCount[i] === 0 && !st.cancelDay[i] && !(st.exMask[i] & RULE_BIT['CR-1'])) st.exMask[i] |= RULE_BIT['CR-1']; // evidence only: pending review, never auto-excluded
    }
    for (const i of req.identified) st.exec[i] = req.idx;
  }
  /* ===================== E. Sanad enforcement orders against ALL invoice types =====================
     An enforcement order is not tied to contracts: it can cover ONE or SEVERAL invoices of ANY revenue source. Sanad supplies the order and
     whatever invoice references it has (often incomplete or wrong); the order PDF lists the rest. The generator builds a fixed set of order
     archetypes so every matching situation exists in the demo world. The order set is drawn only from invoices that were already 150+ days
     overdue and never paid at ORDER_GEN_CUTOFF, so it does not depend on `today` (only whether an order is open yet does).
     `covers` is the hidden truth (used only to write the sample PDFs and in tests); the client sees `refs` (what Sanad supplies) and the amount. */
  {
    const ORDER_GEN_CUTOFF = dayNum('2026-08-31');
    const elig = [];
    for (let i = 0; i < st.n; i += 1) {
      if (st.exec[i] >= 0 || grpOf(st.flags[i]) !== 0 || st.cancelDay[i] || st.payCount[i] > 0 || st.exMask[i] !== 0 || st.adjDay[i] !== 0 || (st.flags[i] & F.OBJECTION)) continue;
      if (st.due[i] + 150 > ORDER_GEN_CUTOFF || st.scope[i] !== 0) continue;
      elig.push(i);
    }
    const used = new Set(); const serialOf = (i) => st.idKey[i] % 1e8;
    const bySerial = new Map(); for (let i = 0; i < st.n; i += 1) { const k = serialOf(i); if (!bySerial.has(k)) bySerial.set(k, []); bySerial.get(k).push(i); }
    const ARCH = ['single', 'multi_exact', 'multi_partial_refs', 'multi_no_refs', 'multi_typo_ref', 'serial_ambiguous', 'amount_discrepancy', 'duplicate_across_orders'];
    const target = scale < 1 ? 16 : Math.min(4000, Math.round(elig.length * 0.01));
    const pickMore = (lead, n, differentSrc = true) => {
      const out = [lead]; const seenSrc = new Set([st.src[lead]]);
      for (const j of elig) { if (out.length >= n) break; if (used.has(j) || out.includes(j) || st.ent[j] !== st.ent[lead]) continue; if (differentSrc && seenSrc.has(st.src[j]) && elig.length > 60) continue; out.push(j); seenSrc.add(st.src[j]); }
      return out;
    };
    let firstSingle = null;
    for (let k = 0; k < target; k += 1) {
      const arch = ARCH[k % ARCH.length]; const r = rC.reset(mix(15, k));
      let lead = -1;
      for (let t = 0; t < elig.length && lead < 0; t += 1) { const j = elig[(k * 37 + t * 11 + 3) % elig.length]; if (used.has(j)) continue; if (arch === 'serial_ambiguous' && !(bySerial.get(serialOf(j)) || []).some((x) => x !== j && st.idKey[x] !== st.idKey[j])) continue; lead = j; }
      if (lead < 0) continue;
      let covers; let hidden = [];
      if (arch === 'single' || arch === 'serial_ambiguous') covers = [lead];
      else if (arch === 'duplicate_across_orders') { covers = firstSingle != null ? pickMore(lead, 2).filter((x) => x !== firstSingle) : pickMore(lead, 2); if (firstSingle != null) covers = [firstSingle, ...covers.slice(0, 1)]; }
      else if (arch === 'amount_discrepancy') { const m = pickMore(lead, 3); covers = m.slice(0, 2); hidden = m.slice(2); }
      else if (arch === 'multi_exact' || arch === 'multi_partial_refs') covers = pickMore(lead, 3);
      else covers = pickMore(lead, 2);
      covers = [...new Set(covers)]; if (covers.length < (arch === 'single' || arch === 'serial_ambiguous' ? 1 : 2)) continue;
      const all = [...covers, ...hidden]; const owner = arch === 'duplicate_across_orders' && firstSingle != null ? st.payer[firstSingle] : st.payer[lead]; // a duplicate reference is the SAME debtor's invoice named by two orders
      const lastDue = Math.max(...all.map((i) => st.due[i])); const opened = Math.min(ORDER_GEN_CUTOFF + 40, lastDue + 160 + r.int(30));
      if (opened > todayN) { all.forEach((i) => used.add(i)); continue; }
      all.forEach((i) => { used.add(i); if (arch !== 'duplicate_across_orders' || i !== firstSingle) st.payer[i] = owner; });
      const amount = all.reduce((sum, i) => sum + st.gross[i], 0);
      const idOfi = (i) => invoiceIdOf(st.idKey[i]); const est_idKey = (i) => st.idKey[i];
      const typo = (id) => `${id.slice(0, 9)}${String(Number(id.slice(9)) + 4000000).padStart(7, '0')}`; // a wrong number that matches no invoice (a digit slip that lands on another real invoice is covered by the debtor check)
      let refs = []; let identified = [];
      if (arch === 'single' || arch === 'multi_exact' || arch === 'duplicate_across_orders') { refs = covers.map((i) => ({ kind: 'invoice_no', value: idOfi(i) })); identified = covers.filter((i) => st.exec[i] < 0); }
      else if (arch === 'multi_partial_refs') { refs = [{ kind: 'invoice_no', value: idOfi(covers[0]) }]; identified = [covers[0]]; }
      else if (arch === 'multi_no_refs') refs = [];
      else if (arch === 'multi_typo_ref') { refs = [{ kind: 'invoice_no', value: idOfi(covers[0]) }, { kind: 'invoice_no', value: typo(idOfi(covers[1])) }]; identified = [covers[0]]; }
      else if (arch === 'serial_ambiguous') refs = [{ kind: 'invoice_serial', value: String(serialOf(lead)).padStart(7, '0') }];
      else if (arch === 'amount_discrepancy') { refs = covers.map((i) => ({ kind: 'invoice_no', value: idOfi(i) })); identified = covers.slice(); }
      // statuses: the first single-invoice order is CLOSED so that an invoice named again by a later order carries one closed and one open order;
      // a closure reason is supplied for some closed orders only (never a payment reason: a closed order says nothing about payment)
      const roll = r.next(); const roll2 = r.next();
      const status = arch === 'single' && firstSingle == null ? 'مغلق' : arch === 'duplicate_across_orders' ? (roll < 0.7 ? 'قيد التنفيذ' : 'موقوف') : roll < 0.5 ? 'قيد التنفيذ' : roll2 < 0.5 ? 'موقوف' : 'مغلق';
      const closeReason = status === 'مغلق' ? [null, 'withdrawn_by_authority', 'order_expired', 'replaced_by_other_order'][Math.floor(roll2 * 3.999) % 4] : null;
      const req = { idx: reqCount, enforceNum: `EN-${5000 + k * 13}`, system: 'sanad', ent: st.ent[lead], amount, openedDay: opened, contractIdx: -1, contractNo: null, status, identified, crNo: null, method: 0, confidence: 1, refs, covers, hidden, archetype: arch, debtor: owner, closeReason };
      st.requests.push(req); reqCount += 1;
      for (const i of identified) if (st.exec[i] < 0) st.exec[i] = req.idx;
      if (arch === 'single' && firstSingle == null) firstSingle = covers[0];
    }
    /* ----- E2. Human data entry: where the references really are -----
       An employee may type one number in the structured field and the rest in the description; type them only in the description; leave the
       fields empty and attach a document; mention a contract number in free text; or the order may touch invoices that are CANCELLED in the source.
       `refs` = the structured field; `description` / `notes` = free text; `attachments` = what Sanad lists as attached (not retrieved here).
       Only the structured field is the feed's own link (`identified`); references found in text or documents always need review. */
    {
      const E2 = ['attach_pdf', 'attach_docx', 'one_attached', 'contract_mention', 'same_serial_two_years', 'genuine_conflict', 'mixed_sources', 'desc_sadad', 'corrupted_structured', 'attach_unreadable', 'desc_multi', 'desc_only', 'cancelled_open', 'cancelled_closed']; // the scenarios the demo needs come first: the compact world has few eligible invoices
      const eligSet = new Set(elig); const partnerOk = (x) => eligSet.has(x) || (st.exec[x] < 0 && !st.cancelDay[x] && st.exMask[x] === 0 && grpOf(st.flags[x]) === 0 && st.due[x] + 150 <= ORDER_GEN_CUTOFF && st.scope[x] === 0); // the second invoice may be partly paid, it just must not be in another order or cancelled
      const cancelledPool = []; for (let i = 0; i < st.nGen; i += 1) if (st.cancelDay[i] && st.cancelDay[i] <= ORDER_GEN_CUTOFF && st.payCount[i] === 0 && st.exMask[i] === 0 && st.exec[i] < 0 && grpOf(st.flags[i]) === 0 && !used.has(i)) cancelledPool.push(i);
      const idOfi = (i) => invoiceIdOf(st.idKey[i]);
      const fmt = (id, v) => (v === 0 ? id : v === 1 ? id.toLowerCase() : v === 2 ? id.replace(/-/g, ' ') : id.replace('INV-', 'INV – ').replace(/-(\d{7})$/, ' / $1'));
      const contracts = st.contracts.filter(Boolean);
      let seq = 0;
      for (let rep = 0; rep < 2; rep += 1) for (let a = 0; a < E2.length; a += 1) {
        const arch = E2[a]; if (rep === 1 && (arch === 'desc_sadad' || arch === 'corrupted_structured' || arch === 'attach_unreadable' || arch === 'mixed_sources' || arch === 'one_attached' || arch === 'same_serial_two_years' || arch === 'genuine_conflict' || arch === 'attach_pdf' || arch === 'cancelled_closed' || arch === 'desc_multi')) continue; const k = rep * 20 + a; const r = rC.reset(mix(16, k)); const cancelled = arch.startsWith('cancelled');
        const pool = cancelled ? cancelledPool : elig; let lead = -1;
        for (let t = 0; t < pool.length && lead < 0; t += 1) { const j = pool[(k * 29 + t * 13 + 5) % pool.length]; if (used.has(j)) continue; if (arch === 'same_serial_two_years' && !(bySerial.get(serialOf(j)) || []).some((x) => x !== j && st.idKey[x] !== st.idKey[j] && partnerOk(x) && !used.has(x) && st.ent[x] === st.ent[j])) continue; if (!cancelled && !['same_serial_two_years', 'genuine_conflict', 'one_attached'].includes(arch) && !elig.some((x) => !used.has(x) && x !== j && st.ent[x] === st.ent[j])) continue; if (arch === 'genuine_conflict' && !elig.some((x) => !used.has(x) && x !== j && st.payer[x] !== st.payer[j] && st.ent[x] === st.ent[j])) continue; lead = j; }
        if (lead < 0) { continue; }
        let covers = [lead]; let other = -1;
        if (arch === 'cancelled_closed') covers = [lead];
        else if (arch === 'cancelled_open') { covers = [lead]; for (const j of cancelledPool) if (covers.length < 2 && !used.has(j) && j !== lead && st.ent[j] === st.ent[lead]) covers.push(j); }
        else if (arch === 'same_serial_two_years') { other = (bySerial.get(serialOf(lead)) || []).find((x) => x !== lead && st.idKey[x] !== st.idKey[lead] && partnerOk(x) && !used.has(x) && st.ent[x] === st.ent[lead]); covers = [lead, other]; } // two LEGITIMATE invoices: same serial, different years, same payer
        else if (arch === 'genuine_conflict') { covers = [lead]; other = elig.find((x) => !used.has(x) && x !== lead && st.payer[x] !== st.payer[lead] && st.ent[x] === st.ent[lead]); } // a referenced invoice that belongs to ANOTHER payer
        else if (arch === 'one_attached') covers = [lead]; // ONE invoice, named only in the attached document
        else { covers = pickMore(lead, arch === 'contract_mention' || arch === 'desc_sadad' || arch === 'corrupted_structured' ? 2 : 3, false); }
        covers = [...new Set(covers)]; if (!cancelled && arch !== 'genuine_conflict' && arch !== 'one_attached' && covers.length < 2) { continue; }
        const owner = st.payer[lead]; const lastDue = Math.max(...covers.map((i) => st.due[i])); const opened = Math.min(ORDER_GEN_CUTOFF + 40, lastDue + 160 + r.int(30));
        if (opened > todayN) { covers.forEach((i) => used.add(i)); continue; }
        covers.forEach((i) => { used.add(i); st.payer[i] = owner; }); if (arch === 'genuine_conflict' && other >= 0) used.add(other);
        const amount = covers.reduce((sum, i) => sum + st.gross[i], 0); const ids = covers.map(idOfi);
        let refs = []; let identified = []; let description = ''; let notes = ''; let attachments = []; let status = ['قيد التنفيذ', 'موقوف', 'قيد التنفيذ'][(k + 1) % 3];
        const enforceNum = `EN-${6000 + seq * 7}`; seq += 1;
        if (arch === 'desc_multi') { refs = [{ kind: 'invoice_no', value: ids[0] }]; identified = [covers[0]]; description = `إحالة للتنفيذ — الفاتورة الأولى في الحقل المخصص، وكذلك الفواتير: ${fmt(ids[1], 1)} و ${fmt(ids[2] || ids[1], 2)}. وللتأكيد نكرر ${fmt(ids[0], 3)}.`; }
        else if (arch === 'one_attached') { description = 'الفاتورة المحالة في المستند المرفق.'; attachments = [{ name: `${enforceNum}-attachment.pdf`, type: 'pdf' }]; }
        else if (arch === 'desc_sadad') { const sd = covers.map((i) => sadadOf(st.idKey[i])); description = `إلزام المنفذ ضده بسداد الفاتورة رقم ${sd[0]} و ${sd[1]}${sd[2] ? ` و ${sd[2]}` : ''} وفق السند التنفيذي.`; } // as in the real extract: numeric (12-digit) invoice numbers only in the description, nothing in the invoice-number field
        else if (arch === 'corrupted_structured') { const sd = covers.map((i) => sadadOf(st.idKey[i])); refs = [{ kind: 'invoice_no', value: toSciNotation(sd[0]) }]; description = `سداد فاتورة رقم ${sd[0]} بمبلغ ${st.gross[covers[0]].toFixed(2)} والفاتورة رقم ${sd[1]}.`; } // the structured value arrived as scientific notation (digits lost); the description still carries the full numbers
        else if (arch === 'desc_only') { description = `Referral to enforcement for invoices ${fmt(ids[0], 0)}, ${fmt(ids[1], 2)} and ${fmt(ids[2] || ids[1], 1)}. بدون تعبئة حقل المراجع.`; notes = `تمت المراجعة مع الجهة؛ المرجع ${fmt(ids[0], 1)}.`; }
        else if (arch === 'attach_pdf') { description = 'الفواتير المشمولة مذكورة في المستند المرفق.'; attachments = [{ name: `${enforceNum}-attachment.pdf`, type: 'pdf' }]; }
        else if (arch === 'attach_docx') { description = 'التفاصيل في ملف Word المرفق (جدول الفواتير).'; attachments = [{ name: `${enforceNum}-attachment.docx`, type: 'docx' }]; }
        else if (arch === 'mixed_sources') { refs = [{ kind: 'invoice_no', value: ids[0] }]; identified = [covers[0]]; description = `الفاتورة الأولى في الحقل المخصص، والفاتورة ${fmt(ids[1], 1)} في الوصف، والبقية في المستند المرفق.`; attachments = [{ name: `${enforceNum}-attachment.pdf`, type: 'pdf' }]; }
        else if (arch === 'same_serial_two_years') { refs = [{ kind: 'invoice_no', value: ids[0] }]; identified = [covers[0]]; description = `وكذلك الفاتورة ${ids[1]} (التسلسل نفسه، سنة مختلفة).`; attachments = [{ name: `${enforceNum}-attachment.pdf`, type: 'pdf' }]; }
        else if (arch === 'genuine_conflict') { refs = [{ kind: 'invoice_no', value: ids[0] }]; identified = [covers[0]]; description = `الفاتورة المحالة ${ids[0]} وكذلك ${other >= 0 ? idOfi(other) : ids[0]}.`; attachments = [{ name: `${enforceNum}-attachment.pdf`, type: 'pdf' }]; }
        else if (arch === 'attach_unreadable') { description = ''; attachments = [{ name: `${enforceNum}-scan.pdf`, type: 'pdf' }, { name: `${enforceNum}-legacy.doc`, type: 'doc' }]; }
        else if (arch === 'cancelled_open') { refs = covers.map((i) => ({ kind: 'invoice_no', value: idOfi(i) })); identified = covers.slice(); status = rep === 0 ? 'قيد التنفيذ' : 'موقوف'; description = 'أمر إنفاذ على فواتير ملغاة في المصدر — يحتاج مراجعة.'; }
        else if (arch === 'cancelled_closed') { refs = covers.map((i) => ({ kind: 'invoice_no', value: idOfi(i) })); identified = covers.slice(); status = 'مغلق'; }
        else if (arch === 'contract_mention') { refs = ids.map((id) => ({ kind: 'invoice_no', value: id })); identified = covers.slice(); const ctNo = rep === 0 && contracts.length ? contracts[Math.min(1, contracts.length - 1)].contractNo : 'CT-2099-0001'; description = `الفواتير أعلاه ضمن العقد رقم ${ctNo} (ذكر في الوصف فقط).`; }
        const closeReason = status === 'مغلق' ? [null, 'withdrawn_by_authority', 'order_expired'][k % 3] : null;
        const req = { idx: reqCount, enforceNum, system: 'sanad', ent: st.ent[lead], amount, openedDay: opened, contractIdx: -1, contractNo: null, status, identified, crNo: null, method: 0, confidence: 1, refs, description, notes, attachments, covers, hidden: [], archetype: arch, rep, debtor: owner, closeReason, conflictWith: other >= 0 ? other : null };
       
        st.requests.push(req); reqCount += 1;
        for (const i of identified) if (st.exec[i] < 0) st.exec[i] = req.idx;
      }
    }
  }
  // white-lands comprehensive enforcement file: its own track (not Sanad / Efaa); each order maps to invoices and the order amount is NOT added to the debt
  for (const w of wlEnforce) {
    if (w.opened > todayN) continue;
    const roll = mix(14, st.idKey[w.i] % 1000003) / 4294967296;
    const req = { idx: reqCount, enforceNum: `WLX-${String(st.idKey[w.i] % 1e8).padStart(7, '0')}`, system: 'white_lands', ent: ENT_HOUSING, amount: st.gross[w.i], openedDay: w.opened, contractIdx: -1, contractNo: null, status: roll < 0.55 ? 'قيد التنفيذ' : roll < 0.8 ? 'موقوف' : 'مغلق', identified: [w.i], crNo: null, method: 0, confidence: 1, debtor: st.payer[w.i] };
    st.requests.push(req); st.exec[w.i] = req.idx; reqCount += 1;
  }
  st.trim();
  st.meta = { today, scale, generatedFrom: GEN_START, seed: SEED, ms: Date.now() - t0, contracts: contracts.filter(Boolean).length, requests: reqCount };
  worldCache.set(key, st);
  if (worldCache.size > 3) worldCache.delete(worldCache.keys().next().value);
  return st;
}
export { ENTITIES };
