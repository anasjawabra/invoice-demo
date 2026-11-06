// Builds the MOMAH-template PowerPoint decks for visual inspection and structure checks. Run: npm run make:deck <outDir>
//   report-ar / report-en        a detailed report with every section (trends, Amanah, sources, aging, exclusions …), built in its own language, with model.meta (version · generated · cut-off)
//   cross-ar-en / cross-en-ar    the SAME report re-expressed in the other language from its build inputs (the way the export dialog does it: model._inputs, non-enumerable)
//   noinputs-ar                  a report model WITHOUT _inputs and WITHOUT meta (a saved report that only has its own language)
//   samples-ar / samples-en      synthetic blocks for every chart kind: waterfall (incl. one crossing zero), stacked_hbar, heatmap with gaps, cumulative line with a dashed target, pie, null gaps, a plain-number chart
import fs from 'node:fs';
import { loadStore } from '../server/store.js';
import { snapshot } from '../server/engine.js';
import { buildReportModel, SECTION_ORDER } from '../src/data/reportModel.js';
import { defaultSpec } from '../src/data/reportIntents.js';
import { DEFAULT_TARGETS } from '../src/data/revenueMetrics.js';
import { buildTemplatePptx } from '../src/utils/exportReportModel.js';
import { setPlansForTest } from '../src/data/plans/planStore.js';
import { seededStore } from '../src/data/plans/planFixtures.js';
setPlansForTest(seededStore()); // the targets of the reports come from the configured reference plan: the seed plan is the 2026 reference (what a fresh data service holds)

process.env.DEMO_SIZE = 'compact';
const TODAY = '2026-10-09'; const st = loadStore(TODAY); const cfg = { cutoff: TODAY };
const YTD = { from: '2026-01-01', to: TODAY, amanah: 'all', source: 'all' };
const cYtd = snapshot(st, { scope: YTD, cfg });
const prev = snapshot(st, { scope: { from: '2025-01-01', to: '2025-10-09', amanah: 'all', source: 'all' }, cfg });
const mkOut = (snap) => ({ snapshot: snap, forecast: { ready: false, reasonNotReady: { ar: 'التاريخ لا يكفي', en: 'history too short' } }, targetPos: null, achievement: null, cards: [], anomalies: [] });
const meta = { size: 'compact', counts: { invoicesTotal: st.n } };
const cash = { months: cYtd.byMonth.map((x) => x.month), values: cYtd.byMonth.map((x) => x.collected) };
const inputsFor = (lang) => ({ spec: { ...defaultSpec(TODAY), sections: SECTION_ORDER, depth: 'detailed', compare: 'prev_year' }, lang, out: mkOut(cYtd), prev, compare: 'prev_year', prevScope: { from: '2025-01-01', to: '2025-10-09' }, cash, bridge: null, targets: DEFAULT_TARGETS, meta });
const withInputs = (inputs) => { const m = buildReportModel(inputs); Object.defineProperty(m, '_inputs', { value: inputs, enumerable: false }); return m; };
const tpl = (lang) => fs.readFileSync(new URL(`../public/templates/momah-${lang}.pptx`, import.meta.url));
const outDir = process.argv[2] || '.test-build/decks'; fs.mkdirSync(outDir, { recursive: true });
const write = async (name, model) => { fs.writeFileSync(`${outDir}/${name}.pptx`, await buildTemplatePptx(model, tpl(model.lang))); console.log(`${outDir}/${name}.pptx`); };
const stamp = (m, version) => { m.meta = { version, generatedAt: m.generatedAt, cutoff: m.cutoff }; return m; };

for (const lang of ['ar', 'en']) await write(`report-${lang}`, stamp(withInputs(inputsFor(lang)), 3));
// the other direction: the same figures re-expressed from the build inputs (exactly inLanguage() of src/components/smart/ExportDialog.jsx)
for (const [from, to] of [['ar', 'en'], ['en', 'ar']]) { const m = withInputs(inputsFor(from)); await write(`cross-${from}-${to}`, stamp(buildReportModel({ ...m._inputs, lang: to }), 2)); }
{ const m = buildReportModel(inputsFor('ar')); await write('noinputs-ar', m); } // no _inputs, no meta: the version stamp is simply absent

// synthetic chart blocks of every kind (the report model hands them over with the same fields)
const sampleModel = (lang) => {
  const ar = lang === 'ar'; const L = (a, e) => (ar ? a : e); const B = 1e9; const M = 1e6;
  const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
  const net = [2.61, 0.93, 1.12, 1.21, 0.89, 1.45, 1.02, 1.16, 0.88, 0.18].map((v) => v * B); let c = 0; const cum = net.map((v) => (c += v));
  const sec = (key, title, blocks) => ({ key, title, purpose: '', blocks });
  const base = buildReportModel(inputsFor(lang)); // context, headline, tail sections from a real model; the data sections are replaced by synthetic charts
  return { ...base, meta: { version: 1, generatedAt: base.generatedAt, cutoff: base.cutoff }, headline: base.headline, sections: [
    sec('executive', L('اختبار الرسوم', 'Chart kinds'), [
      { type: 'chart', kind: 'waterfall', title: L('من إجمالي المفوتر إلى صافي المفوتر', 'From gross invoiced to net invoiced'), labels: [L('إجمالي المفوتر', 'Gross invoiced'), L('الاستبعادات', 'Exclusions'), L('صافي المفوتر', 'Net invoiced')], series: [{ label: L('المبلغ', 'Amount'), values: [14.7 * B, -3.27 * B, 11.43 * B] }], totals: [true, false, true], note: L('صافي المفوتر = إجمالي المفوتر − الاستبعادات.', 'Net invoiced = gross invoiced − exclusions.') },
      { type: 'chart', kind: 'waterfall', title: L('جسر بزيادة ونقص (يعبر الصفر)', 'Bridge with increase and decrease (crosses zero)'), labels: ['A', 'B', 'C', 'D', 'E'], series: [{ label: L('المبلغ', 'Amount'), values: [5 * B, -2 * B, 1 * B, -6 * B, -2 * B] }], totals: [true, false, false, false, true] },
      { type: 'chart', kind: 'waterfall', title: L('جسر مع زيادة', 'Bridge with an increase'), labels: [L('البداية', 'Opening'), L('زيادة', 'Added'), L('نقص', 'Removed'), L('النهاية', 'Closing')], series: [{ label: L('المبلغ', 'Amount'), values: [4 * B, 1.5 * B, -0.8 * B, 4.7 * B] }], totals: [true, false, false, true] },
      { type: 'chart', kind: 'stacked_hbar', title: L('المحصّل وغير المحصّل من صافي المفوتر', 'Collected and uncollected share of net invoiced'), labels: [L('صافي المفوتر', 'Net invoiced')], series: [{ label: L('المحصّل', 'Collected'), values: [7.58 * B] }, { label: L('غير المحصّل', 'Uncollected'), values: [3.85 * B] }], note: L('غير المحصّل = صافي المفوتر − المحصّل.', 'Uncollected = net invoiced − collected.') }]),
    sec('trends', L('الاتجاه', 'Trend'), [
      { type: 'callout', tone: 'info', text: L('أساسان لا يُخلطان: صافي المفوتر لكل شهر إصدار؛ والتراكمي يجمع الأشهر من بداية الفترة.', 'Two bases never mixed: net per issue month; the cumulative line adds the months from the start of the period.') },
      { type: 'chart', kind: 'line', basis: 'cumulative', title: L('التراكمي: صافي المفوتر والمحصّل ومستهدف مدعوم', 'Cumulative net invoiced, collected and a supported target'), labels: months, series: [{ label: L('صافي المفوتر', 'Net invoiced'), values: cum }, { label: L('المحصّل', 'Collected'), values: cum.map((v) => v * 0.66) }, { label: L('مستهدف مدعوم', 'Supported target'), values: cum.map((v) => v * 0.8), dashed: true }] },
      { type: 'chart', kind: 'bar', basis: 'monthly', title: L('صافي المفوتر بحسب الشهر (قيمة مفقودة في الشهر الأخير)', 'Net invoiced by month (the last month is missing)'), labels: months, series: [{ label: L('صافي المفوتر', 'Net invoiced'), values: net }, { label: L('المحصّل نقداً', 'Cash received'), values: [...net.slice(0, 9).map((v) => v * 0.7), null] }] },
      { type: 'chart', kind: 'line', title: L('خط بفجوة (قيمة مفقودة في المنتصف)', 'A line with a gap'), labels: months.slice(0, 6), series: [{ label: 'S', values: [1 * M, 2 * M, null, 3 * M, 2.5 * M, 4 * M] }] }]),
    sec('amanah', L('الأمانات', 'Amanahs'), [
      { type: 'chart', kind: 'heatmap', valueKind: 'rate', title: L('نسبة التحصيل: الأمانة × مصدر الإيراد', 'Collection rate: Amanah × revenue source'), labels: [L('الاستثمار', 'Investment'), L('الغرامات', 'Fines'), L('الرسوم', 'Fees'), L('التراخيص', 'Licences'), L('الإيواء', 'Accommodation')], series: ['Riyadh', 'Makkah', 'Jeddah', 'Asir', 'Qassim'].map((n, i) => ({ label: n, values: [0.82 - i * 0.05, 0.4 + i * 0.1, i === 2 ? null : 0.66, 0.9 - i * 0.1, i % 2 ? null : 0.12] })), note: L('الخلية الفارغة «—» = لا فواتير (ليست صفراً).', 'An empty «—» cell = no invoices (not zero).') },
      { type: 'chart', kind: 'pie', title: L('حصص المصادر من صافي المفوتر', 'Source shares of net invoiced'), labels: [L('الاستثمار', 'Investment'), L('الغرامات', 'Fines'), L('الرسوم', 'Fees')], series: [{ label: L('صافي المفوتر', 'Net invoiced'), values: [6 * B, 3 * B, 2 * B] }] },
      { type: 'chart', kind: 'hbar', ranked: true, title: L('عدد الفواتير حسب الأمانة (أرقام عادية)', 'Invoice counts by Amanah (plain numbers)'), plain: true, valueTitle: L('عدد الفواتير', 'Invoices'), labels: ['Riyadh', 'Makkah', 'Jeddah', 'Asir', 'Qassim', 'Madinah', 'Eastern', 'Hail'], series: [{ label: L('فواتير', 'Invoices'), values: [1200, 980, 870, 400, 310, 290, 120, 0] }] },
      { type: 'chart', kind: 'bar', title: L('تقادم الرصيد غير المحصّل', 'Aging of the uncollected balance'), labels: ['0-30', '31-60', '61-90', '91-180', '> 180'], series: [{ label: L('غير المحصّل', 'Uncollected'), values: [0.69 * B, 0.4 * B, 0.7 * B, 2.3 * B, 4.2 * B] }] }])
  ] };
};
for (const lang of ['ar', 'en']) await write(`samples-${lang}`, sampleModel(lang));
