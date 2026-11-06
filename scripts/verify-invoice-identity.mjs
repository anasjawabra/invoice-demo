// Uniqueness of the INVOICE COMPOSITE KEY on the demo world (all numbers are counts, no value is printed). Run: npm run verify:identity [compact|full]
import { loadStore } from '../server/store.js';
import { iimFields } from '../server/iimRow.js';
import { idOf, lookupRef } from '../server/engine.js';

process.env.DEMO_SIZE = process.argv[2] || process.env.DEMO_SIZE || 'compact';
const today = process.env.DEMO_TODAY || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
const st = loadStore(today); const n = st.n;
const byNo = new Map(); const byKey = new Map(); const byId = new Map(); const bySadad = new Map(); let incomplete = 0; const missing = {}; let noMuni = 0;
const noAcrossAmanah = new Set(); const noAcrossGfs = new Set();
for (let i = 0; i < n; i += 1) {
  if (st.owner[i] === 65535) continue; const im = iimFields(st, i);
  byNo.set(im.invoiceNo, (byNo.get(im.invoiceNo) || 0) + 1); byId.set(idOf(st, i), (byId.get(idOf(st, i)) || 0) + 1); bySadad.set(`${im.billerId}-${im.sadadNo}`, (bySadad.get(`${im.billerId}-${im.sadadNo}`) || 0) + 1);
  if (!im.municipalityId) noMuni += 1;
  if (!im.compositeKey) { incomplete += 1; for (const m of im.keyMissing) missing[m] = (missing[m] || 0) + 1; } else byKey.set(im.compositeKey, (byKey.get(im.compositeKey) || 0) + 1);
}
const rep = (m) => [...m.values()].filter((v) => v > 1).length;
const numbersRepeated = rep(byNo);
// numbers carried by more than one invoice, and what tells them apart
const shared = [...byNo.entries()].filter(([, v]) => v > 1).map(([k]) => k);
let diffAmanah = 0; let diffGfs = 0; let sameKey = 0;
if (shared.length) { const set = new Set(shared); const seen = new Map(); for (let i = 0; i < n; i += 1) { if (st.owner[i] === 65535) continue; const im = iimFields(st, i); if (!set.has(im.invoiceNo)) continue; (seen.get(im.invoiceNo) || seen.set(im.invoiceNo, []).get(im.invoiceNo)).push(im); }
  for (const arr of seen.values()) { if (new Set(arr.map((x) => x.amanahId)).size > 1) diffAmanah += 1; if (new Set(arr.map((x) => x.gfsCode)).size > 1) diffGfs += 1; if (new Set(arr.map((x) => x.compositeKey)).size < arr.length) sameKey += 1; } }
console.log(`world: ${process.env.DEMO_SIZE} · invoices ${n.toLocaleString('en-US')}`);
console.log(`invoice numbers: ${byNo.size.toLocaleString('en-US')} distinct · carried by >1 invoice: ${numbersRepeated} (of which differ by Amanah: ${diffAmanah}, by GFS code: ${diffGfs})`);
console.log(`internal ids (biller-sadad): ${byId.size.toLocaleString('en-US')} distinct · repeated: ${rep(byId)}`);
console.log(`composite keys: ${byKey.size.toLocaleString('en-US')} distinct · repeated: ${rep(byKey)} · incomplete (no key): ${incomplete} ${JSON.stringify(missing)} · without municipality id: ${noMuni}`);
let failed = 0; const ok = (name, c) => { if (!c) failed += 1; console.log(`${c ? 'PASS' : 'FAIL'}  ${name}`); };
ok('no two invoices share a composite key', rep(byKey) === 0 && sameKey === 0);
ok('an internal id still identifies exactly one invoice', rep(byId) === 0);
ok('every number shared by several invoices is told apart by the composite key', sameKey === 0);
// round trip: a composite key resolves back to its invoice; a shared bare number resolves to several, never to one
let rt = 0; let checked = 0; for (let i = 0; i < n && checked < 2000; i += 37) { if (st.owner[i] === 65535) continue; const im = iimFields(st, i); if (!im.compositeKey) continue; checked += 1; const r = lookupRef(st, im.compositeKey); if (r.status === 'unique' && r.indexes[0] === i) rt += 1; }
ok(`composite keys resolve back to their invoice (${rt}/${checked})`, rt === checked);
if (shared.length) { const r = lookupRef(st, shared[0]); ok('a shared bare number is ambiguous (never one invoice)', r.status === 'ambiguous' && r.indexes.length > 1); }
process.exit(failed ? 1 : 0);
