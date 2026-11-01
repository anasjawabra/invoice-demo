import fs from 'node:fs';
import { loadStore } from '../server/store.js';
import { snapshot } from '../server/engine.js';
import { buildReportModel, SECTION_ORDER } from '../src/data/reportModel.js';
import { defaultSpec } from '../src/data/reportIntents.js';
import { DEFAULT_TARGETS } from '../src/data/revenueMetrics.js';
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const today = '2026-10-25'; const st = loadStore(today, { size: 'compact' }); const cfg = { cutoff: today };
const scope = { from: '2026-01-01', to: today, amanah: 'all', source: 'all' };
const current = snapshot(st, { scope, cfg }); const previous = snapshot(st, { scope: { ...scope, from: '2025-01-01', to: '2025-10-25' }, cfg });
const models = [];
for (const lang of ['en', 'ar']) for (const depth of ['summary', 'detailed']) {
  const model = buildReportModel({ spec: { ...defaultSpec(today), sections: depth === 'detailed' ? SECTION_ORDER : ['executive','sources','amanah'], depth, compare: 'prev_year' }, lang, out: { snapshot: current, forecast: { ready: false, reasonNotReady: { ar: 'التاريخ لا يكفي', en: 'History is insufficient' } }, targetPos: null, achievement: null, cards: [], anomalies: [] }, prev: previous, compare: 'prev_year', prevScope: { from: '2025-01-01', to: '2025-10-25' }, cash: { months: current.byMonth.map((x) => x.month), values: current.byMonth.map((x) => x.collected) }, bridge: null, targets: DEFAULT_TARGETS, meta: { size: 'compact', counts: { invoicesTotal: st.n } } });
  model.generatedAt = '2026-10-25T08:00:00.000Z'; models.push({ id: `${lang}-${depth}`, model });
}
for (const lang of ['en','ar']) models.push({ id: `${lang}-empty`, model: { lang, title: lang === 'ar' ? 'تقرير دون بيانات مطابقة' : 'Report with no matching data', subtitle: '2026-01-01 / 2026-10-25', label: 'Demo data', cutoff: today, generatedAt: '2026-10-25T08:00:00.000Z', context: [{ label: lang === 'ar' ? 'النطاق' : 'Scope', value: lang === 'ar' ? 'لا توجد بيانات مطابقة' : 'No matching data' }], headline: [{ type: 'text', text: lang === 'ar' ? 'لا توجد بيانات مطابقة. لا يمكن تفسير القيم المفقودة على أنها صفر.' : 'No data matches the selection. Missing values must not be interpreted as zero.' }], sections: [] } });
fs.writeFileSync(`${out}/models.json`, JSON.stringify(models, null, 2)); console.log(`Prepared ${models.length} bilingual summary, detailed and empty models`);
