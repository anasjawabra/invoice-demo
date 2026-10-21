// Builds public/samples/exclusion-upload-sample.xlsx: about 150 rows for the exclusion upload template (IIM-30), mixing valid rows with every kind of rejection.
// Run: npm run sample:exclusion  (bundled with esbuild, like the tests). The invoices are the demo's own, for the demo date below.
import fs from 'node:fs';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { loadStore } from '../server/store.js';
import { makeCtx, derive, idOf } from '../server/engine.js';
import { iimFields } from '../server/iimRow.js';
import { checkExclusionRows } from '../server/exclusionUpload.js';
import { isoOf, ENTITIES, RULE_BIT } from '../src/data/catalog.js';
import { MAIN } from '../src/data/iim.js';
import { buildTemplate, REJECTIONS } from '../src/data/exclusionUpload.js';

const TODAY = process.env.SAMPLE_TODAY || '2026-10-21';
const st = loadStore(TODAY); const ctx = makeCtx(st, { cfg: { cutoff: TODAY } });
const ENC = 'التعديات واستغلال المواقع (محضر التعدي)'; const ATT = 'إفادات الأمانات';
const payerOf = (i) => { const f = st.fixtures.get(i); return f ? f.entityAr || f.entity : (iimLike(i)); };
import { payerName } from '../server/names.js';
const iimLike = (i) => payerName(st.payer[i]).ar;

const open = []; const collected = [];
for (let i = 0; i < st.nGen; i += 1) {
  if (st.issue[i] > ctx.cutoffN || st.cancelDay[i]) continue;
  const D = derive(ctx, i, ctx.cutoffN); const im = iimFields(st, i);
  const row = { i, id: idOf(st, i), date: isoOf(st.issue[i]), amount: D.gross, amanah: ENTITIES[st.ent[i]].ar, name: payerOf(i), account: im.gfsCode, main: im.mainClass, ent: st.ent[i] };
  if (D.received >= D.billed && D.billed > 0) { if (collected.length < 12) collected.push(row); } else if (!D.excluded && !st.exMask[i] && st.ent[i] < 17 && im.gfsCode && D.outstanding > 0) open.push(row);
}
const valid = []; const invest = open.filter((r) => r.main === MAIN.investment); const other = open.filter((r) => r.main !== MAIN.investment);
for (const r of invest.slice(0, 18)) valid.push({ ...r, reason: ENC });
for (const r of other.slice(0, 36)) valid.push({ ...r, reason: ATT });
const usedIds = new Set(valid.map((v) => v.id)); const pool = open.filter((r) => !usedIds.has(r.id)); // the rest: one invoice per mismatching row
const bad = [];
const take = (n) => pool.splice(0, n);
for (const r of take(9)) bad.push({ ...r, amount: r.amount + 125, reason: ATT }); // amount mismatch
for (const r of take(8)) bad.push({ ...r, date: isoOf(st.issue[r.i] - 9), reason: ATT }); // date mismatch
for (const r of take(8)) bad.push({ ...r, account: '9999999', reason: ATT }); // account mismatch
for (const r of pool.filter((x) => x.main !== MAIN.investment).slice(0, 5)) bad.push({ ...r, reason: ENC }); // encroachment on a non-investment invoice
for (const r of valid.slice(18, 28)) bad.push({ ...r, amanah: ENTITIES[(r.ent + 3) % 17].ar }); // another Amanah
for (const r of collected) bad.push({ ...r, reason: ATT }); // already collected
for (let k = 0; k < 24; k += 1) { const base = open[k % open.length]; bad.push({ ...base, id: `${base.id.split('-')[0]}-${String(880000000000 + k * 7919).padStart(12, '0')}`, reason: ATT }); } // not in the system
for (const r of valid.slice(0, 5)) bad.push({ ...r, reason: 'سبب غير معروف' }); // invalid reason
for (const r of valid.slice(5, 8)) bad.push({ ...r, amanah: 'أمانة غير معروفة' }); // unknown Amanah
for (const r of valid.slice(0, 2)) bad.push({ ...r }); // the same invoice twice
const rows = [...valid, ...bad].map((r, k) => ({ invoiceNo: r.id, date: r.date, amount: r.amount, amanah: r.amanah, name: r.name, account: r.account, reason: r.reason, k }));
rows.sort((a, b) => (a.k * 7919) % 211 - (b.k * 7919) % 211); // mix valid and invalid rows
const buf = await buildTemplate(XLSX, JSZip, { sample: rows });
fs.writeFileSync(new URL('../public/samples/exclusion-upload-sample.xlsx', import.meta.url), buf);
// check it with the same validator the app uses
const parsed = rows.map((r, n) => ({ row: n + 2, invoiceNo: r.invoiceNo, date: r.date, amount: r.amount, amanah: r.amanah, name: r.name, account: r.account, reason: r.reason }));
const res = checkExclusionRows(st, { rows: parsed, cfg: { cutoff: TODAY } });
const by = {}; for (const r of res.rows) if (!r.ok) by[r.code] = (by[r.code] || 0) + 1;
console.log(`rows ${rows.length}: accepted ${res.accepted}, rejected ${res.rejected}`, by, `valid planned ${valid.length}`);
void RULE_BIT; void REJECTIONS;
if (process.env.DEBUG_SAMPLE) { const cnt = {}; for (const r of rows) cnt[r.invoiceNo] = (cnt[r.invoiceNo] || 0) + 1; console.log(Object.entries(cnt).filter(([, n]) => n > 1).slice(0, 5), open.length, invest.length, other.length, new Set(open.map((r) => r.id)).size); }
