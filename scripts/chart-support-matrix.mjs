// The HONEST support matrix of the chart library (docs/chart-library.md §6) — computed, not written. For EVERY catalog type it records, from running the code on synthetic data:
//   screen renderer registered · the catalog preview and a representative block drawn in Arabic AND English (no refusal) · the table text · the PDF print document (the same SVG) · the PowerPoint mode
//   (native / vector image / shaded table) · the data it depends on (needs / companion datasets) · and where it is ACTUALLY offered in the platform (which page's real chart the picker accepts it for).
// A type is only called «implemented» / «data-dependent» when every proof passes; a type no real chart of the demo can take is «unavailable-in-demo». tests/chart-integration.test.mjs asserts all of it;
// `npm run chart:matrix` prints the markdown table that §6 of the document holds.
import { loadStore } from '../server/store.js';
import { snapshot } from '../server/engine.js';
import { list } from '../server/lists.js';
import { chartDistributions } from '../server/distributions.js';
import { nonCollectionAnalysis } from '../server/noncollection.js';
import { buildReportModel, SECTION_ORDER } from '../src/data/reportModel.js';
import { buildDashboardChartBlocks } from '../src/data/dashboardReport.js';
import { defaultSpec } from '../src/data/reportIntents.js';
import { DEFAULT_TARGETS } from '../src/data/revenueMetrics.js';
import { chartBlocks } from '../src/data/chartIds.js';
import { CHART_TYPES, chartPreview, chartOptions, typeById } from '../src/data/chartCatalog.js';
import { DRAW_KINDS, chartSvg } from '../src/utils/chartKinds.js';
import { chartTableText } from '../src/data/reportFormat.js';
import { pptxModeOf, PPTX_SUPPORT } from '../src/utils/pptxCharts.js';
import { buildPdfHtml } from '../src/utils/pdfReport.js';
import { WORD_SUPPORT } from '../src/utils/chartExportData.js';
import { exportBlocks } from './chart-export-fixtures.mjs';
import { buildCharts } from '../src/components/analysis/nc/ncModel.js';
import { ncChartEnrichment } from '../src/components/analysis/nc/ncCharts.js';
import { exclusionsReasonChart } from '../src/data/exclusionsChart.js';
import { EXCLUSION_REASONS } from '../src/data/iim.js';
import { rankedBlock } from '../src/components/invoices/listLogic.js';
import { summaryBlock } from '../src/components/invoices/summaryChart.js';
import { setPlansForTest } from '../src/data/plans/planStore.js';
import { seededStore } from '../src/data/plans/planFixtures.js';
setPlansForTest(seededStore()); // the targets of the reports come from the configured reference plan: the seed plan is the 2026 reference (what a fresh data service holds)

export const TODAY = '2026-10-09';
export const SC = (extra = {}) => ({ from: '2026-01-01', to: TODAY, amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all', ...extra });
const out = (s) => ({ snapshot: s, forecast: { ready: false }, targetPos: null, achievement: null, cards: [], anomalies: [] });

let ST = null;
export const store = () => { if (!ST) { process.env.DEMO_SIZE = 'compact'; ST = loadStore(TODAY); } return ST; };
const cfg = { cutoff: TODAY };

/** the synthetic world of a scope: snapshot · distributions · non-collection analysis · the full report model in both languages */
export function world(scope = SC()) {
  const st = store(); const snap = snapshot(st, { scope, cfg }); const dist = chartDistributions(st, { scope, cfg }); const nc = nonCollectionAnalysis(st, { scope, cfg });
  const model = (lang) => buildReportModel({ spec: { ...defaultSpec(TODAY), scope, sections: SECTION_ORDER, depth: 'detailed' }, lang, out: out(snap), targets: DEFAULT_TARGETS, cases: [], meta: null, dist, ncAnalysis: nc });
  return { st, scope, snap, dist, nc, model };
}
const revOf = (w) => ({ snapshot: w.snap, prevSnapshot: null, comparison: null, cfg, targets: DEFAULT_TARGETS, cases: [], meta: null, scope: { preset: 'ytd' }, scopeEff: { from: w.scope.from, to: w.scope.to, amanah: w.scope.amanah, source: w.scope.source, scopeType: w.scope.scopeType, muni: w.scope.muni, status: w.scope.status } });

/** every page that holds a chart block and its picker, with the REAL blocks of the synthetic world → [{ page, label:{ar,en}, picker, blocks }] */
export function surfaces(w, lang) {
  const ar = lang === 'ar'; const res = [];
  const sr = chartBlocks(w.model(lang)); res.push({ page: 'smart_reports', label: { ar: 'التقارير الذكية', en: 'Smart Reports' }, picker: 'full', blocks: sr });
  const dash = Object.values(buildDashboardChartBlocks(revOf(w), w.dist, lang).blocks); res.push({ page: 'dashboard', label: { ar: 'لوحة المعلومات', en: 'Dashboard' }, picker: 'full', blocks: dash });
  const ncCh = buildCharts(w.nc, ar); const enr = ncChartEnrichment({ ...w.nc, distributions: w.dist }, lang);
  res.push({ page: 'nc_analysis', label: { ar: 'تحليل أسباب عدم التحصيل', en: 'Non-collection analysis' }, picker: 'full', blocks: Object.keys(enr).map((n) => ({ ...ncCh[n].block, ...enr[n] })) });
  const rows = EXCLUSION_REASONS.map((r) => ({ ...r, count: w.snap.ruleStats?.[r.ruleId]?.primaryCount || 0, amount: w.snap.ruleStats?.[r.ruleId]?.primaryAmount || 0 }));
  const ex = exclusionsReasonChart(rows, lang); res.push({ page: 'exclusions', label: { ar: 'إدارة الاستبعادات', en: 'Exclusions' }, picker: 'full', blocks: ex ? [ex] : [] });
  const f = list(w.st, { scope: w.scope, cfg, filters: {}, page: 0, pageSize: 1, facets: ['source'] }).facets?.source;
  const mkSummary = (id, measure, role, title) => { const r = rankedBlock({ dim: 'source', items: f, measure, role, title, valueTitle: title, ar, nf: String }); return r.block ? summaryBlock(r.block, { id, dim: 'source', measure, total: r.total, ar }) : null; };
  res.push({ page: 'invoice_summaries', label: { ar: 'ملخصات الفواتير (المحصّل / غير المحصّل)', en: 'Invoice summaries (collected / uncollected)' }, picker: 'compact', blocks: [mkSummary('source', 'collected', 'collected', ar ? 'المحصّل حسب مصدر الإيراد' : 'Collected by revenue source'), mkSummary('source', 'outstanding', 'uncollected', ar ? 'غير المحصّل حسب مصدر الإيراد' : 'Unpaid by revenue source')].filter(Boolean) });
  return res;
}

const normPptx = (m) => (m === 'native-table' ? 'table' : m);
const pdfModel = (lang, blocks) => ({ lang, title: 'Test', subtitle: '', context: [], headline: [], sections: [{ key: 's', title: 'S', purpose: '', blocks }], generatedAt: '2026-10-09T00:00:00Z', cutoff: TODAY, totals: {}, kind: 'matrix' });
const refused = (svg) => /data-refused=/.test(svg);

/** the representative block of a catalog type (a synthetic fixture drawn by the renderer's own sample sets) */
export const representative = (t, lang) => { const b = exportBlocks(lang)[t.kind]; return t.markers ? { ...b, markers: true } : b; };

/** → { types:[{ id, kind, rendererRegistered, previewDrawn, drawn:{ar,en}, table:{ar,en}, pdf:{ar,en}, pptx:{mode, expected}, word, needs, offeredOn:[page], status, unavailableWhy }], surfaces } */
export function buildMatrix() {
  const w = world(); const sf = { ar: surfaces(w, 'ar'), en: surfaces(w, 'en') };
  const offered = {}; const why = { ar: {}, en: {} };
  for (const lang of ['ar', 'en']) for (const s of sf[lang]) for (const b of s.blocks) {
    const o = chartOptions(b, { lang }); for (const a of o.available) { (offered[a.id] ||= new Set()).add(s.page); }
    if (!['waterfall', 'heatmap'].includes(b.kind)) for (const u of o.unavailable) (why[lang][u.id] ||= u.reason[lang]); // (a reconciliation / a matrix say «never converted» for everything: not the informative reason)
  }
  const types = CHART_TYPES.map((t) => {
    const r = { id: t.id, kind: t.kind, purpose: t.purpose, more: !!t.more, rendererRegistered: DRAW_KINDS().includes(t.kind), previewDrawn: false, drawn: {}, table: {}, pdf: {}, needs: t.needs, exportDeclared: t.export };
    const pv = chartPreview(t.id); r.previewDrawn = !!pv && chartSvg(pv, { lang: 'en' }).startsWith('<svg') && !refused(chartSvg(pv, { lang: 'en' }));
    for (const lang of ['ar', 'en']) {
      const b = representative(t, lang); const svg = chartSvg(b, { lang });
      r.drawn[lang] = svg.startsWith('<svg') && svg.includes(`data-kind="${t.kind}"`) && !refused(svg);
      const tt = chartTableText(b, lang); r.table[lang] = !!tt && Array.isArray(tt.headers) && tt.headers.length > 0 && Array.isArray(tt.rows) && tt.rows.length > 0;
      const html = buildPdfHtml(pdfModel(lang, [{ ...b, id: `m:${t.id}` }]), {}); r.pdf[lang] = html.includes(`data-kind="${t.kind}"`) && !refused(html);
    }
    r.pptx = { mode: normPptx(pptxModeOf(representative(t, 'en'), 'en')), expected: t.export.pptx, support: PPTX_SUPPORT[t.kind] };
    r.word = { declared: t.export.word, support: WORD_SUPPORT[t.kind] };
    r.offeredOn = [...(offered[t.id] || [])].sort();
    r.unavailableWhy = r.offeredOn.length ? null : (why.ar[t.id] && why.en[t.id] ? { ar: why.ar[t.id], en: why.en[t.id] } : null); // (each language's text from its own pass)
    r.dataDependency = t.needs && t.needs.alts ? `alts.${t.needs.alts}` : (t.needs && (t.needs.additive || t.needs.partsOfWhole) ? 'parts of one whole' : t.needs && t.needs.ordered ? 'ordered axis' : 'category × series');
    const proven = r.rendererRegistered && r.previewDrawn && r.drawn.ar && r.drawn.en && r.table.ar && r.table.en && r.pdf.ar && r.pdf.en && r.pptx.mode === r.pptx.expected && r.word.support === 'png';
    r.proven = proven;
    r.status = !proven ? 'not-proven' : !r.offeredOn.length ? 'unavailable-in-demo' : t.needs && t.needs.alts ? 'data-dependent' : 'implemented';
    return r;
  });
  return { types, surfaces: sf.en.map((s) => ({ page: s.page, label: s.label, picker: s.picker, charts: s.blocks.length })) };
}

const PAGE_NAME = { smart_reports: 'Smart Reports', dashboard: 'Dashboard', nc_analysis: 'Non-collection', exclusions: 'Exclusions', invoice_summaries: 'Invoice summaries' };
const EXPORT_WORD = { native: 'native', 'vector-image': 'vector-image', table: 'table' };
/** markdown for §6 of docs/chart-library.md (generated; do not edit by hand) */
export function matrixMarkdown(m) {
  const head = '| Type | Status | Data it depends on | Screen AR / EN | Table | PDF | PowerPoint | Offered in (real charts of the demo) |\n|---|---|---|---|---|---|---|---|';
  const yn = (a) => (a.ar && a.en ? 'yes' : 'NO');
  const rows = m.types.map((t) => `| \`${t.id}\` | **${t.status}** | ${t.dataDependency} | ${yn(t.drawn)} | ${yn(t.table)} | ${yn(t.pdf)} (vector) | ${EXPORT_WORD[t.pptx.mode] || t.pptx.mode} | ${t.offeredOn.length ? t.offeredOn.map((p) => PAGE_NAME[p] || p).join(', ') : '— (' + (t.unavailableWhy ? t.unavailableWhy.en : 'no real chart can take it') + ')'} |`);
  const counts = {}; for (const t of m.types) counts[t.status] = (counts[t.status] || 0) + 1;
  const pages = m.surfaces.map((s) => `${PAGE_NAME[s.page] || s.page}: ${s.charts} chart${s.charts === 1 ? '' : 's'}, picker ${s.picker}`).join(' · ');
  return `${head}\n${rows.join('\n')}\n\nCounts: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(' · ')} (${m.types.length} types). Pages measured: ${pages}.`;
}
if (typeof process !== 'undefined' && process.argv[1] && /chart-support-matrix\.mjs$/.test(process.argv[1])) console.log(matrixMarkdown(buildMatrix()));
