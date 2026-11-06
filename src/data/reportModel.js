// ============================================================================
// Report model — the ONE structure that is both rendered in the conversation and exported (Word / Excel / PowerPoint), so the
// exported figures, filters and content are exactly the displayed ones. Pure: built from the shared snapshots only.
//
// Block types: text · kpis · relations · table · chart · insights · callout · list
// Tables hold RAW numbers (money in SAR); the renderer / exporters show every money column in ONE unit (stated in the header)
// and Excel also gets the exact SAR. Charts hold SAR series and use one unit per chart.
// ============================================================================
import { isSingleMonth } from './clock';
import { PRESETS, detectPreset } from './periodPresets';
import { buildSmartReport } from './smartReport';
import { buildInsights, sourceAr, sourceEn } from './insightsEngine';
import { fairComparison } from './amanahComparison';
import { CATEGORY_LABELS, EXCLUSION_RULES, compareSnapshots } from './revenueMetrics';
import { fmtMoney, unitOfValues, unitLabel, scaled, fmtInt } from '../utils/money';
import { BRIDGE_LABELS } from './bridgeLabels';
import { amanahFilterOptions } from './revenueLedger';
import { grossToNetChart, collectedShareChart, cumulativeChart, agingChart } from './financialCharts';
import { ncSections, ncHeadline, NC_TITLE, isNcAnalysis } from './ncReportModel';
import { muniLabel, amanahOfMuniKey, MUNICIPALITY_DIRECT, MUNICIPALITY_OPTION_NONE, MUNICIPALITY_UNRESOLVED } from './municipalityModel';
import { PRODUCTS } from './iim';
import { assignChartIds } from './chartIds';
import { asGeoScope, allAuthorizedLabel, allMunicipalitiesLabel, describeAccess } from './reportAccess';
import { geoScopeKey } from './geoScope';
import { notifiedBudgetFor } from './plans/notifiedBudget';
import { KSA_PROVINCES } from './ksaProvinces';
import { bandCell } from './regional/collectionBands';
import { dimOf, mergeAlts, putAlt, sankeyAlt, pointsAlt, treeAlt, histogramAlt, boxAlt, bulletRateAlt, bulletAmountAlt, breakdownAlt, muniChartRows, M_NET, M_COLLECTED, M_EXCLUDED } from './chartAlts';

export const SECTION_ORDER = ['executive', 'trends', 'amanah', 'sources', 'aging', 'exclusions', 'gaps', 'noncollection', 'status', 'quality', 'bases', 'channels'];
export const SECTION_META = {
  executive: { ar: 'الملخص التنفيذي', en: 'Executive summary', purpose: { ar: 'ما الوضع الآن؟ العلاقات المالية بين الإجمالي والاستبعادات والصافي والمحصّل.', en: 'What is the situation? The relationships between gross, exclusions, net and collected.' } },
  trends: { ar: 'الاتجاه الشهري', en: 'Monthly trend', purpose: { ar: 'الأداء شهراً بشهر ومقابل العام السابق: فواتير كل شهر (أساس الإصدار) منفصلة عن الإيرادات المحصلة خلال الشهر (أساس الدفع).', en: 'Month-by-month performance and against last year: invoices of each month (issue basis) separate from receipts during the month (payment basis).' } },
  amanah: { ar: 'الأمانات والبلديات', en: 'Amanahs & municipalities', purpose: { ar: 'أين الأداء الأقوى والأضعف؟ الإجمالي = مجموع المحصّل ÷ مجموع الصافي لا متوسط النسب.', en: 'Where is performance strongest and weakest? The total is Σ collected ÷ Σ net, not an average of rates.' } },
  sources: { ar: 'مصادر الإيراد', en: 'Revenue sources', purpose: { ar: 'الأداء بحسب الاستثمار والغرامات والرسوم والتراخيص والإيواء والتبغ والأراضي البيضاء والمبيعات.', en: 'Performance by Furas investment, fines, fees, licences, accommodation, tobacco, white lands and sales.' } },
  aging: { ar: 'المتأخرات والتقادم', en: 'Outstanding & aging', purpose: { ar: 'رصيد قائم في التاريخ المرجعي لكل ما صدر حتى ذلك التاريخ، موزع بحسب العمر بعد الاستحقاق.', en: 'A standing balance at the reference date for everything issued up to it, by age past due.' } },
  exclusions: { ar: 'الاستبعادات وأسبابها', en: 'Exclusions & reasons', purpose: { ar: 'ما أُخرج من إجمالي المفوتر ولماذا؛ كل فاتورة تُخصم مرة واحدة تحت سببها الرئيسي.', en: 'What was taken out of gross billed and why; each invoice is deducted once under its primary reason.' } },
  gaps: { ar: 'فجوات التحصيل وأولويات المتابعة', en: 'Collection gaps & priorities', purpose: { ar: 'أكبر فرص رفع التحصيل: فجوة كل خلية أمانة × مصدر مقابل مستهدف تجريبي.', en: 'The biggest opportunities: each Amanah × source cell against a demo target.' } },
  noncollection: { ar: 'تحليل أسباب عدم التحصيل', en: 'Non-collection analysis', purpose: { ar: 'لماذا بقيت الفواتير غير مسددة؟ موقف السداد والاستحقاق منفصلان عن الاستبعاد والإجراء وجودة البيانات والسبب الموثَّق؛ ما لا يوثّقه المصدر «غير موثق» ولا يُستنتج.', en: 'Why are invoices still unpaid? Payment and due position kept apart from exclusion, process, data quality and the documented reason; what the source does not document is “not documented” and never inferred.' } },
  status: { ar: 'الفواتير وحالة الدفع', en: 'Invoices & payment status', purpose: { ar: 'عدد كل حالة ومبلغها؛ مجموع الحالات يساوي مجموع الفواتير.', en: 'The count and amount of each state; the states add up to the total.' } },
  quality: { ar: 'اكتمال البيانات والمطابقة', en: 'Completeness & reconciliation', purpose: { ar: 'هل يمكن الوثوق بالأرقام؟ فحوص المطابقة ومشاكل الاكتمال والقياسات غير المتاحة.', en: 'Can the numbers be trusted? Reconciliation checks, completeness issues and unavailable measures.' } },
  bases: { ar: 'أساس القياس', en: 'Measurement basis', purpose: { ar: 'يفصل المحصّل على فواتير الفترة عن الإيرادات المحصلة بتاريخ الدفع خلال الفترة.', en: 'Keeps collected on period invoices apart from receipts dated in the period.' } },
  channels: { ar: 'قنوات الدفع', en: 'Payment channels', purpose: { ar: 'من أين تأتي الإيرادات المحصلة (سداد، تحويل، بطاقة، محفظة، تنفيذ).', en: 'Where receipts come from (SADAD, transfer, card, wallet, enforcement).' } }
};
const CHANNEL = { sadad: ['سداد', 'SADAD'], voluntary: ['سداد طوعي', 'Voluntary'], enforcement: ['تنفيذ', 'Enforcement'], transfer: ['تحويل بنكي', 'Bank transfer'], card: ['بطاقة', 'Card'], wallet: ['محفظة المنشأة', 'Facility wallet'] };
const STATUS = { collected: { ar: 'محصّلة بالكامل', en: 'Collected in full' }, ...CATEGORY_LABELS };
const RULE = { cancelled: ['ملغاة في المصدر', 'Cancelled in the source'] };
const ratio = (a, b) => (b > 0 ? a / b : null);
const prevYear = (m) => `${Number(m.slice(0, 4)) - 1}${m.slice(4)}`;

export const PRESET_LABEL = { ...Object.fromEntries(PRESETS.map((p) => [p.key, [p.ar, p.en]])), custom: ['فترة مخصصة', 'Custom period'] };

// `access` (optional) = the GeoScope the report was built for. Under a restricted scope «all Amanahs / all municipalities» read as «everything your access allows» and a chip names the authorized scope (so a file never claims a wider one).
export function contextChips(spec, { lang, snapshot, snapshotMeta, labelOfAmanah, labelOfMuni, prevScope = null, compare = 'none', access = null, planTarget = null, budgetChip = null }) {
  const ar = lang === 'ar'; const L = (a, e) => (ar ? a : e); const sc = spec.scope;
  const acc = access ? asGeoScope(access) : null; const restricted = !!acc && !acc.all;
  const src = sc.source === 'all' ? L('كل المصادر', 'All sources') : (ar ? sourceAr(sc.source) : sourceEn(sc.source));
  const asOf = snapshot?.basis?.collectionsAsOf || snapshot?.cutoff;
  const st = { all: L('كل الحالات', 'All statuses'), collected: L('محصّلة', 'Collected'), open: L('قائمة', 'Open'), overdue: L('متأخرة', 'Overdue'), partial: L('محصّلة جزئياً', 'Partial'), not_due: L('لم يحن استحقاقها', 'Not yet due'), cancelled: L('ملغاة', 'Cancelled'), excluded: L('مستبعدة', 'Excluded') }[sc.status || 'all'] || sc.status;
  const chips = [
    { k: 'period', label: L('الفترة', 'Period'), value: `${sc.from} → ${sc.to}${(() => { const pk = detectPreset(sc.from, sc.to, snapshot?.cutoff || sc.to); return pk && PRESET_LABEL[pk] ? ` (${PRESET_LABEL[pk][ar ? 0 : 1]})` : ''; })()}` },
    { k: 'amanah', label: L('الأمانة / الجهة', 'Amanah'), value: sc.amanah === 'all' ? (restricted ? allAuthorizedLabel(acc, lang) : L('كل الأمانات والجهات', 'All Amanahs')) : [].concat(sc.amanah).map(labelOfAmanah).join(L('، ', ', ')) },
    { k: 'muni', label: L('البلدية', 'Municipality'), value: sc.muni === 'all' ? (restricted ? allMunicipalitiesLabel(acc, sc.amanah, lang) : L('كل البلديات', 'All municipalities')) : labelOfMuni(sc.muni) },
    ...(restricted ? [{ k: 'access', label: L('نطاق الصلاحية', 'Access scope'), value: L(`أُعدّ ضمن صلاحية المستخدم: ${describeAccess(acc, 'ar')}`, `Prepared within the user’s access: ${describeAccess(acc, 'en')}`) }] : []),
    { k: 'source', label: L('مصدر الإيراد', 'Revenue source'), value: src },
    { k: 'status', label: L('حالة الفاتورة', 'Invoice status'), value: st },
    ...(sc.scopeType && sc.scopeType !== 'all' ? [{ k: 'scopeType', label: L('النطاق', 'Scope'), value: sc.scopeType === 'internal' ? L('داخلي', 'Internal') : L('مركزي', 'Central') }] : []),
    { k: 'basis', label: L('أساس التقرير', 'Reporting basis'), value: L(`فواتير صادرة في الفترة؛ التحصيل حتى ${asOf}${snapshot?.basis?.collectionsMode === 'period_end' ? ' (نهاية الفترة)' : ''}`, `Invoices issued in the period; collections up to ${asOf}${snapshot?.basis?.collectionsMode === 'period_end' ? ' (the period end)' : ''}`) },
    ...(compare !== 'none' && prevScope ? [{ k: 'compare', label: L('المقارنة', 'Comparison'), value: `${prevScope.from} → ${prevScope.to}${compare === 'prev_month' && !isSingleMonth(sc) ? L(' (الفترة السابقة المساوية في الطول)', ' (preceding period of equal length)') : ''}` }] : [{ k: 'compare', label: L('المقارنة', 'Comparison'), value: L('بدون مقارنة', 'No comparison') }]),
    ...(planTarget ? [{ k: 'plan', label: L('الخطة المرجعية للمستهدف', 'Target source plan'), value: planTarget }] : []),
    ...(planTarget && budgetChip ? [{ k: 'budget', label: budgetChip.label, value: budgetChip.value }] : []), // «الميزانية المبلّغة لعام <year>» of the reference plan's year (or why it is unavailable) — carried to every export with the plan chip
    { k: 'data', label: L('البيانات', 'Data'), value: L(`تجريبية اصطناعية${snapshotMeta?.size === 'compact' ? ` — عينة مضغوطة (${(snapshotMeta.counts?.invoicesTotal ?? 0).toLocaleString('en-US')} فاتورة)` : ''}`, `Synthetic demo data${snapshotMeta?.size === 'compact' ? ` — compact sample (${(snapshotMeta.counts?.invoicesTotal ?? 0).toLocaleString('en-US')} invoices)` : ''}`) }
  ];
  return chips;
}

/**
 * The notified-budget chip of a report that prints a target figure: the communicated budget (chapters 1–3) of the REFERENCE PLAN's year for the report's target scope — «الميزانية المبلّغة لعام <year>: <amount>» —
 * or «الميزانية المبلّغة: غير متوفرة …» (never 0, never another year's figure). Only when the reference plan resolved (the year and scope come from it). → { label, value } | null
 */
export function notifiedBudgetChip(targets, { lang = 'ar' } = {}) {
  const ref = targets?.reference; if (!ref || ref.state !== 'ok' || !ref.period) return null;
  const ar = lang === 'ar'; const pick = (o) => (o == null ? '' : ar ? o.ar : o.en);
  const vs = targets.viewScope || { amanah: 'all', muni: 'all' }; const viewer = Array.isArray(targets.scopeEntityKeys) && targets.scopeEntityKeys.length ? targets.scopeEntityKeys : null;
  const scope = ref.planScopeKind === 'entities' ? { kind: 'entities', entityKeys: targets.planEntityKeys || (vs.amanah !== 'all' ? [vs.amanah] : viewer || []) } : { kind: 'ministry' };
  const nb = notifiedBudgetFor({ view: { period: ref.period, scope }, viewScope: vs, entityKeys: viewer });
  if (nb.state !== 'ok') return { label: pick(nb.label), value: `${nb.year ? `${nb.year} — ` : ''}${pick(nb.subLabel) || (ar ? 'غير متوفرة' : 'not available')}` };
  return { label: pick(nb.label), value: `${fmtMoney(nb.amount, { lang })}${nb.restricted ? ` — ${pick(nb.scopeLabel)}` : ''}${nb.annualOfPartYear ? ` — ${pick(nb.subLabel)}` : ''}` };
}

export function buildReportModel({ spec, lang = 'ar', out, prev = null, compare = 'none', prevScope = null, cash = null, bridge = null, targets, cases = [], meta = null, generatedAt = new Date(), ncAnalysis = null, dist = null, access = null }) {
  const ar = lang === 'ar'; const L = (a, e) => (ar ? a : e); const B = (o) => (o == null ? '' : typeof o === 'string' ? o : (ar ? o.ar : o.en) || o.en || '');
  const snapshot = out.snapshot; const T = snapshot.totals; const comparable = !!prev && prev.totals.count > 0;
  const comparison = comparable ? compareSnapshots(snapshot, prev) : null;
  const labelOfAmanah = (k) => B(snapshot.byAmanah.find((g) => g.key === k)?.label) || (() => { const a = amanahFilterOptions().find((x) => x.key === k); return a ? (ar ? a.ar : a.en) : k; })(); // never a raw key (an Amanah with no invoices in the selection still has a name)
  const labelOfMuni = (k) => muniLabel(k, lang); // the reference name, or the explicit group («مباشر على الأمانة», «بلا بلدية (غير محددة في المصدر)»); never an internal id
  // the reference plan the target figures of this report come from (name + version, the target's view scope; or why there is none): printed on the report and carried to every export, only when a target figure is part of it
  const planSrc = out.achievement?.unavailableText || out.achievement?.sourceLine || out.targetPos?.targetUnavailable || out.targetPos?.targetSourceLine || null;
  const planTarget = planSrc ? B(planSrc) : null;
  const budgetChip = planTarget ? notifiedBudgetChip(targets, { lang }) : null;
  const chips = contextChips(spec, { lang, snapshot, snapshotMeta: meta, labelOfAmanah, labelOfMuni, prevScope, compare, access, planTarget, budgetChip });
  const insightsRes = buildInsights({ snapshot, prev: comparable ? prev : null, comparison, forecast: out.forecast, targets });
  const legacy = buildSmartReport({ snapshot, bridge: out.bridge || bridge, forecast: out.forecast, targetPos: out.targetPos, achievement: out.achievement, cards: out.cards || [], anomalies: out.anomalies || [], cases, focus: spec.sections.includes('exclusions') ? 'noncollection' : spec.sections.includes('amanah') ? 'amanah' : 'revenue', lang, request: '' });
  // the relations block and the exports read the same typed contract as the Dashboard: amounts + the two rates + the cancelled share of exclusions
  const ctxTotals = { count: T.count, gross: T.gross, exclusions: T.exclusions, cancelled: T.cancelled, net: T.net, collected: T.collected, outstanding: T.outstanding, collectedOverNet: T.collectedOverNet, exclusionRate: T.exclusionRate };

  const tbl = (id, title, headers, rows, { total = null, note = null } = {}) => ({ type: 'table', id, title, headers, rows, total, note });
  // a row opens the uncollected-invoices list for the same period and scope (a multi-Amanah selection leaves the Amanah to the row); the report's own period travels with the link
  const drill = (over) => { const sc = spec.scope; const q = new URLSearchParams({ from: sc.from, to: sc.to }); const am = over.amanah ?? (Array.isArray(sc.amanah) || sc.amanah === 'all' ? null : sc.amanah); const so = over.src ?? (sc.source === 'all' ? null : sc.source); const mu = over.muni ?? (sc.muni && sc.muni !== 'all' ? sc.muni : null); if (am) q.set('amanah', am); if (so) q.set('src', so); if (mu && am && amanahOfMuniKey(mu) === am) q.set('muni', mu); return `/collection?${q.toString()}`; };
  const H = (label, kind = 'text') => ({ label, kind });
  const prevRate = (key, by) => { const g = (prev?.[by] || []).find((x) => x.key === key); return g && g.net > 0 ? g.collected / g.net : null; };

  /* ---- chart semantics (`dim`) and companion datasets (`alts`): built from THIS snapshot (and the optional distributions payload fetched for the same scope), saved with the model — docs/chart-library.md «Chart data» ---- */
  const oneAmanahScope = typeof spec.scope.amanah === 'string' && spec.scope.amanah !== 'all';
  const srcLabel = (k) => (ar ? sourceAr(k) : sourceEn(k));
  const EXPLICIT_MUNI = { direct_amanah: B(MUNICIPALITY_DIRECT), not_specified: B(MUNICIPALITY_OPTION_NONE), needs_review: B(MUNICIPALITY_UNRESOLVED) };
  const NEEDS_DIST = { ar: 'يتطلب بيانات على مستوى الفاتورة تُجلب عند إنشاء التقرير (غير مرفقة بهذا النموذج).', en: 'Needs invoice-level data fetched when the report is generated (not attached to this model).' };
  const rowsAm = () => snapshot.byAmanah.map((g) => ({ key: g.key, label: B(g.label), net: g.net, collected: g.collected, outstanding: g.outstanding }));
  const rowsSrc = () => snapshot.bySource.map((g) => ({ key: g.key, label: srcLabel(g.key), net: g.net, collected: g.collected, outstanding: g.outstanding }));
  const rowsProd = () => snapshot.byProduct.map((g) => ({ key: g.key, label: B(PRODUCTS[g.key]) || g.key, net: g.net, collected: g.collected, outstanding: g.outstanding }));
  const rowsMuni = () => snapshot.byMunicipality.map((g) => ({ key: g.key, status: g.status, amanah: g.amanah, label: oneAmanahScope ? muniLabel(g.key, lang) : `${muniLabel(g.key, lang)} — ${B(g.amanahLabel)}`, net: g.net, collected: g.collected, outstanding: g.outstanding }));
  const byAmanahTitle = L('صافي المفوتر والمحصّل حسب الأمانة', 'Net billed and collected by Amanah'); const bySourceTitle = L('صافي المفوتر والمحصّل حسب مصدر الإيراد', 'Net billed and collected by revenue source');
  const byMuniTitle = L('صافي المفوتر والمحصّل حسب البلدية', 'Net billed and collected by municipality'); const byProductTitle = L('صافي المفوتر والمحصّل حسب المنتج', 'Net billed and collected by product');
  const NC_MEASURES = [{ key: 'net', kind: 'amount', label: L('صافي المفوتر', 'Net billed'), field: 'net' }, { key: 'collected', kind: 'amount', label: L('المحصّل', 'Collected'), field: 'collected' }];
  const bd = (dimension, rows, title, otherLabel, total = T.net) => breakdownAlt({ dimension, rows, lang, title, otherLabel, measures: NC_MEASURES, total });
  const distAmountOk = !!dist?.amount && dist.amount.n === T.count; // the payload must describe THIS population (same count as the snapshot)
  const ageCount = (b0) => snapshot.stock.aging.slice(b0).reduce((t, a) => t + a.count, 0);
  const distStandingOk = !!dist?.overdueStanding && dist.overdueStanding.n + (dist.overdueStanding.dueUnknown?.count || 0) === ageCount(1) && (dist.overdueStanding.notDue?.count || 0) === snapshot.stock.aging[0].count;
  const muniAlt = () => { const rs = muniChartRows(rowsMuni(), { single: oneAmanahScope, top: oneAmanahScope ? 15 : 12, fields: ['net', 'collected'], explicitLabel: EXPLICIT_MUNI, otherLabel: { ar: 'بلديات أخرى', en: 'Other municipalities' }, lang }); return bd('municipality', rs, byMuniTitle, { ar: 'بلديات أخرى', en: 'Other municipalities' }); };
  const reasonRows = () => { const m = new Map(); for (const r of snapshot.matrix.amanahReasons) m.set(r.reason, (m.get(r.reason) || 0) + r.amount); return [...m.entries()].map(([k, amount]) => ({ key: k, amount, label: k === 'cancelled' ? RULE.cancelled[ar ? 0 : 1] : (EXCLUSION_RULES.find((x) => x.id === k)?.label[ar ? 'ar' : 'en'] || k) })); };
  const flowAlts = () => putAlt('sankey', sankeyAlt(T, { reasons: reasonRows(), lang }));
  const amountDistAlts = (by) => [
    putAlt('histogram', distAmountOk ? histogramAlt(dist.amount, { lang, valueKind: 'amount', popAr: 'الفواتير الصادرة في الفترة ضمن النطاق', popEn: 'Invoices issued in the period within the scope' }) : null, NEEDS_DIST),
    putAlt('box', distAmountOk ? boxAlt(by === 'source' ? dist.amount.box.bySource : dist.amount.box.byAmanah, { lang, valueKind: 'amount', labelOf: by === 'source' ? srcLabel : labelOfAmanah, entityAr: by === 'source' ? 'مصدر إيراد' : 'أمانة', entityEn: by === 'source' ? 'revenue source' : 'Amanah', dimension: by === 'source' ? 'source' : 'amanah', title: by === 'source' ? L('مبالغ الفواتير حسب مصدر الإيراد', 'Invoice amounts by revenue source') : L('مبالغ الفواتير حسب الأمانة', 'Invoice amounts by Amanah') }) : null, NEEDS_DIST)
  ];
  const wrap = (blk, extra) => (blk ? { ...blk, ...extra } : null);

  /* ---- sections ---- */
  const sections = {};
  const headline = () => {
    const rate = T.collectedOverNet; const u = unitOfValues([T.gross, T.exclusions, T.net, T.collected, T.outstanding]);
    const m = (v) => fmtMoney(v, { lang, unit: u });
    return [
      { type: 'kpis', unit: u, items: [
        { label: L('إجمالي المفوتر', 'Gross billed'), value: m(T.gross), raw: T.gross, sub: L('قبل الاستبعادات', 'before exclusions') },
        { label: L('الاستبعادات', 'Exclusions'), value: m(T.exclusions), raw: T.exclusions, sub: L(`نسبة الاستبعاد ${T.exclusionRate.calculable ? (T.exclusionRate.value * 100).toFixed(1) + '%' : 'غير متاحة'}`, `Exclusion rate ${T.exclusionRate.calculable ? (T.exclusionRate.value * 100).toFixed(1) + '%' : 'not available'}`) },
        { label: L('صافي المفوتر', 'Net billed'), value: m(T.net), raw: T.net, sub: L('بعد الاستبعادات', 'after exclusions') },
        { label: L('المحصّل', 'Collected'), value: m(T.collected), raw: T.collected, sub: L('من الصافي', 'of net billed') },
        { label: L('غير المحصّل', 'Uncollected'), value: m(T.outstanding), raw: T.outstanding, sub: L('من فواتير الفترة', 'on the period’s invoices') },
        { label: L('نسبة التحصيل', 'Collection rate'), value: rate.calculable ? `${(rate.value * 100).toFixed(1)}%` : L('غير متاحة', 'Not available'), raw: rate.calculable ? rate.value : null, sub: comparable && comparison.collectedOverNetPp.calculable ? L(`${comparison.collectedOverNetPp.value >= 0 ? '+' : ''}${comparison.collectedOverNetPp.value.toFixed(1)} نقطة مئوية عن المقارنة`, `${comparison.collectedOverNetPp.value >= 0 ? '+' : ''}${comparison.collectedOverNetPp.value.toFixed(1)} pp vs comparison`) : L('من الصافي', 'of net billed') },
        { label: L('الفواتير', 'Invoices'), value: `${fmtInt(T.count)} ${L('فاتورة', 'invoices')}`, raw: T.count, sub: L('صدرت في الفترة', 'issued in the period') }
      ] },
    ];
  };
  sections.executive = () => {
    return [
      { type: 'text', text: insightsRes.summary.text[ar ? 'ar' : 'en'] },
      ...[wrap(grossToNetChart(T, lang), mergeAlts([flowAlts()])), wrap(collectedShareChart(T, lang), mergeAlts([bulletRateAlt({ targets, T, scope: spec.scope, snapScope: snapshot.scope, lang })]))].filter(Boolean), // gross → exclusions → net, then collected / uncollected of net (they replace the repeated relations block; the exclusions section keeps the relations text)
      ...(comparable ? [tbl('compare', L('المقارنة بالفترة المماثلة', 'Comparison with the equivalent period'), [H(L('المؤشر', 'Measure')), H(L('الفترة الحالية', 'Current'), 'money'), H(L('فترة المقارنة', 'Comparison'), 'money'), H(L('التغير', 'Change'), 'pct')], [
        [L('إجمالي المفوتر', 'Gross billed'), T.gross, prev.totals.gross, ratio(T.gross - prev.totals.gross, prev.totals.gross)],
        [L('الاستبعادات', 'Exclusions'), T.exclusions, prev.totals.exclusions, ratio(T.exclusions - prev.totals.exclusions, prev.totals.exclusions)],
        [L('صافي المفوتر', 'Net billed'), T.net, prev.totals.net, ratio(T.net - prev.totals.net, prev.totals.net)],
        [L('المحصّل', 'Collected'), T.collected, prev.totals.collected, ratio(T.collected - prev.totals.collected, prev.totals.collected)],
        [L('غير المحصّل', 'Uncollected'), T.outstanding, prev.totals.outstanding, ratio(T.outstanding - prev.totals.outstanding, prev.totals.outstanding)]
      ], { note: L(`كل فترة تُقاس عند نهايتها (المدة المنقضية نفسها): ${prevScope.from} → ${prevScope.to}. نسبة التحصيل ${(T.collectedOverNet.value * 100).toFixed(1)}% مقابل ${prev.totals.collectedOverNet.calculable ? (prev.totals.collectedOverNet.value * 100).toFixed(1) + '%' : 'غير متاحة'}.`, `Each period is measured at its own end (equal elapsed time): ${prevScope.from} → ${prevScope.to}. Collection rate ${(T.collectedOverNet.value * 100).toFixed(1)}% vs ${prev.totals.collectedOverNet.calculable ? (prev.totals.collectedOverNet.value * 100).toFixed(1) + '%' : 'not available'}.`) })] : (compare !== 'none' ? [{ type: 'callout', tone: 'warn', text: L('لا توجد مقارنة مكافئة: فترة المقارنة خارج نطاق البيانات أو بلا فواتير.', 'No equivalent comparison: the comparison period is outside the data or empty.') }] : [])),
      { type: 'insights', title: L('أبرز النتائج والرؤى', 'Key findings and insights'), items: insightsRes.insights.slice(0, spec.depth === 'detailed' ? 12 : 4) },
      ...(!insightsRes.forecast.available ? [{ type: 'callout', tone: 'info', text: L(`التنبؤ غير معروض: ${insightsRes.forecast.reason ? B(insightsRes.forecast.reason) : 'التاريخ داخل هذا النطاق لا يكفي لتقدير موثوق.'}`, `Forecast not shown: ${insightsRes.forecast.reason ? B(insightsRes.forecast.reason) : 'the history inside this scope is not long enough for a reliable estimate.'}`) }] : [])
    ];
  };
  sections.trends = () => {
    const months = snapshot.byMonth; const cashBy = new Map((cash?.months || []).map((m, i) => [m, cash.values[i]])); const priorBy = new Map((prev?.byMonth || []).map((m) => [m.month, m]));
    const today = snapshot.cutoff.slice(0, 7);
    const rows = months.map((m) => { const pm = priorBy.get(prevYear(m.month)); return [`${m.month}${m.month === today ? L(' (حتى اليوم)', ' (to date)') : ''}`, m.count, m.gross, m.exclusions, m.net, m.collected, m.outstanding, ratio(m.collected, m.net), pm ? ratio(pm.collected, pm.net) : null, cashBy.has(m.month) ? cashBy.get(m.month) : null]; });
    return [
      { type: 'callout', tone: 'info', text: L('أساسان لا يُخلطان: صافي المفوتر والمحصّل لكل شهر إصدار ويُقاسان في التاريخ المرجعي؛ أما «الإيرادات المحصلة خلال الشهر» فنقد بتاريخ الدفع ويشمل فواتير أشهر سابقة.', 'Two bases, never mixed: net billed and collected are per invoice-issue month measured at the reference date; “received during the month” is cash by payment date and includes earlier months’ invoices.') },
      { type: 'chart', kind: 'bar', basis: 'monthly', dim: dimOf('month', { ordered: true, measures: [M_NET, M_COLLECTED, { key: 'received', kind: 'amount' }] }), ...mergeAlts([bulletAmountAlt({ targets, snapshot, scope: spec.scope, lang })]), title: L('صافي المفوتر والمحصّل والإيرادات المحصلة بتاريخ الدفع بحسب الشهر', 'Net billed, collected and received by month'), labels: months.map((m) => m.month), series: [{ label: L('صافي مفوتر الشهر', 'Net billed (issued in the month)'), values: months.map((m) => m.net) }, { label: L('المحصّل على فواتير الشهر', 'Collected on those invoices'), values: months.map((m) => m.collected) }, { label: L('الإيرادات المحصلة خلال الشهر (تاريخ الدفع)', 'Received during the month (payment date)'), values: months.map((m) => cashBy.get(m.month) ?? null) }] },
      ...[cumulativeChart(months, lang)].filter(Boolean),
      tbl('trend', L('الاتجاه الشهري', 'Monthly trend'), [H(L('شهر الإصدار', 'Issue month')), H(L('الفواتير', 'Invoices'), 'count'), H(L('إجمالي المفوتر', 'Gross billed'), 'money'), H(L('الاستبعادات', 'Exclusions'), 'money'), H(L('صافي المفوتر', 'Net billed'), 'money'), H(L('المحصّل', 'Collected'), 'money'), H(L('غير المحصّل', 'Uncollected'), 'money'), H(L('نسبة التحصيل', 'Collection rate'), 'pct'), ...(comparable ? [H(L('نفس الشهر العام السابق', 'Same month last year'), 'pct')] : []), H(L('الإيرادات المحصلة في الشهر (تاريخ الدفع)', 'Received in the month (payment date)'), 'money')],
        rows.map((r) => (comparable ? r : [...r.slice(0, 8), r[9]])),
        { total: [L('الإجمالي', 'Total'), T.count, T.gross, T.exclusions, T.net, T.collected, T.outstanding, ratio(T.collected, T.net), ...(comparable ? [ratio(prev.totals.collected, prev.totals.net)] : []), snapshot.receivedInPeriod.total], note: L('تجمع الأشهر إلى الفترة. لا تُجمع التقارير التراكمية. عمود العام السابق بالمدة المنقضية نفسها.', 'Months add up to the period. Cumulative reports are never summed. The prior-year column uses the same elapsed time.') })
    ];
  };
  sections.amanah = () => {
    const am = snapshot.byAmanah.slice().sort((a, b) => b.net - a.net); const mu = snapshot.byMunicipality.slice().sort((a, b) => b.net - a.net);
    const row = (label, g, withPrev) => [label, g.count, g.gross, g.exclusions, g.net, g.collected, g.outstanding, ratio(g.collected, g.net), ratio(g.exclusions, g.gross), ...(withPrev ? [prevRate(g.key, 'byAmanah')] : [])];
    const heads = (first, withPrev) => [H(first), H(L('الفواتير', 'Invoices'), 'count'), H(L('إجمالي المفوتر', 'Gross billed'), 'money'), H(L('الاستبعادات', 'Exclusions'), 'money'), H(L('صافي المفوتر', 'Net billed'), 'money'), H(L('المحصّل', 'Collected'), 'money'), H(L('غير المحصّل', 'Uncollected'), 'money'), H(L('نسبة التحصيل', 'Collection rate'), 'pct'), H(L('نسبة الاستبعاد', 'Exclusion rate'), 'pct'), ...(withPrev ? [H(L('نسبة العام السابق', 'Last year rate'), 'pct')] : [])];
    const totalRow = (withPrev) => [L('الإجمالي', 'Total'), T.count, T.gross, T.exclusions, T.net, T.collected, T.outstanding, ratio(T.collected, T.net), ratio(T.exclusions, T.gross), ...(withPrev ? [ratio(prev?.totals.collected, prev?.totals.net)] : [])];
    const srcs = [...new Set(snapshot.matrix.amanahSource.map((r) => r.source))];
    const cell = (a, s) => snapshot.matrix.amanahSource.find((r) => r.amanah === a && r.source === s);
    const amTop = am.slice(0, 12);
    // municipality table: EVERY invoice is in exactly one row of its Amanah (a reference municipality, «بلا بلدية (غير محددة في المصدر)», «مباشر على الأمانة» or «تحتاج مراجعة»), so the rows add up to the total (asserted below)
    const MUNI_ORDER = { direct_amanah: 0, not_specified: 1, needs_review: 2, unmapped_source_value: 2, conflict: 2, mapped: 3 };
    const muniRows = snapshot.byMunicipality.slice().sort((a, b) => (MUNI_ORDER[a.status] ?? 3) - (MUNI_ORDER[b.status] ?? 3) || b.net - a.net);
    const oneAmanah = typeof spec.scope.amanah === 'string' && spec.scope.amanah !== 'all';
    const sumRows = (rs) => rs.reduce((t, g) => { for (const f of ['count', 'gross', 'exclusions', 'net', 'collected', 'outstanding']) t[f] += g[f] || 0; return t; }, { count: 0, gross: 0, exclusions: 0, net: 0, collected: 0, outstanding: 0 });
    let muniOut; // [{ label, g, key|null, amanah|null }]
    if (oneAmanah || muniRows.length <= 40) muniOut = muniRows.map((g) => ({ label: `${muniLabel(g.key, lang)} — ${B(g.amanahLabel)}`, g, key: g.key, amanah: g.amanah }));
    else { // national scope: the three explicit groups summed over all Amanahs, then the largest municipalities, then the rest — still every invoice once
      const grp = (st, L0) => { const rs = muniRows.filter((g) => (st === 'needs_review' ? ['needs_review', 'unmapped_source_value', 'conflict'].includes(g.status) : g.status === st)); return rs.length ? [{ label: `${B(L0)} — ${L(`كل الأمانات (${rs.length})`, `all Amanahs (${rs.length})`)}`, g: sumRows(rs), key: null, amanah: null }] : []; };
      const mapped = muniRows.filter((g) => g.status === 'mapped'); const topM = mapped.slice(0, 25); const rest = mapped.slice(25);
      muniOut = [...grp('direct_amanah', MUNICIPALITY_DIRECT), ...grp('not_specified', MUNICIPALITY_OPTION_NONE), ...grp('needs_review', MUNICIPALITY_UNRESOLVED), ...topM.map((g) => ({ label: `${muniLabel(g.key, lang)} — ${B(g.amanahLabel)}`, g, key: g.key, amanah: g.amanah })), ...(rest.length ? [{ label: L(`بلديات أخرى (${rest.length})`, `Other municipalities (${rest.length})`), g: sumRows(rest), key: null, amanah: null }] : [])];
    }
    const muniSum = sumRows(muniOut.map((x) => x.g));
    const muniReconciles = Math.abs(muniSum.net - T.net) <= 0.5 && muniSum.count === T.count; // asserted in tests/municipality-downstream.test.mjs; a mismatch is stated in the table note, never hidden
    const muniTable = Object.assign(tbl('muni', L('حسب البلدية', 'By municipality'), heads(L('البلدية', 'Municipality'), false), muniOut.map((x) => row(x.label, x.g, false)), { total: totalRow(false), note: (muniReconciles ? '' : L('⚠ مجموع الصفوف لا يطابق الإجمالي. ', '⚠ The rows do not add up to the total. ')) + L('كل فاتورة في صف واحد فقط ضمن أمانتها: بلدية من المرجع، أو «بلا بلدية (غير محددة في المصدر)» (لم يذكر المصدر بلدية)، أو «مباشر على الأمانة»، أو «تحتاج مراجعة». مجموع الصفوف = مجموع الأمانات؛ لا تُنسب فاتورة إلى بلدية من عنوان المدين ولا عشوائياً. توزيع البلديات في هذه العينة اصطناعي ويُحاكي حقول المصدر.', 'Every invoice is in exactly one row inside its Amanah: a reference municipality, “No municipality (not specified in source)” (the source named none), “Issued directly by the Amanah”, or “Needs review”. The rows add up to the Amanah totals; an invoice is never assigned to a municipality from the payer’s address or at random. The municipality split in this sample is synthetic and simulates the source fields.') }), { links: muniOut.map((x) => (x.key ? drill({ amanah: x.amanah, muni: x.key }) : null)) });
    const amanahAlts = () => {
      const ent = oneAmanahScope ? { ar: 'بلدية', en: 'municipality', dimension: 'municipality' } : { ar: 'أمانة', en: 'Amanah', dimension: 'amanah' };
      const treeIn = { muniRows: snapshot.byMunicipality.map((g) => ({ amanah: g.amanah, key: g.key, net: g.net })), total: T.net, lang, labelAmanah: labelOfAmanah, labelMuni: (k) => muniLabel(k, lang), labelSource: srcLabel, maxMuni: oneAmanahScope ? 12 : 3, scopeLabel: L('إجمالي النطاق', 'Scope total') };
      const tree = (distAmountOk && treeAlt({ ...treeIn, cells: dist.tree })) || treeAlt(treeIn); // the 3-level tree when the payload reconciles with this snapshot, else the 2-level tree the snapshot itself holds
      return mergeAlts([pointsAlt(oneAmanahScope ? rowsMuni() : rowsAm(), { lang, entity: ent }), tree, ...amountDistAlts('amanah'), putAlt('bySource', bd('source', rowsSrc(), bySourceTitle, { ar: 'مصادر أخرى', en: 'Other sources' })), putAlt('byMunicipality', muniAlt()), putAlt('byProduct', bd('product', rowsProd(), byProductTitle, { ar: 'منتجات أخرى', en: 'Other products' }))]);
    };
    // «حسب المنطقة»: the SAME regional aggregation as the dashboard's «الأداء حسب المنطقة» (the verified region → Amanah mapping over the snapshot's own Amanah rows, i.e. the page filters and the authorised entities); the Housing Sector and any Amanah outside the mapping
    // stay in their own «بدون إسناد جغرافي» row, so the rows add up to the total (the KPI figures). Here: amounts, the collection rate, the change against the comparable period and the collection-performance band (invoice-based: collected ÷ net invoiced, from SUMMED amounts).
    const regionTable = () => {
      const byA = snapshot.byAmanah; const pA = comparable ? (prev?.byAmanah || []) : [];
      const sum = (rows, f) => rows.reduce((t, g) => t + (g[f] || 0), 0);
      const mapped = new Set(KSA_PROVINCES.flatMap((p) => p.amanahKeys));
      const groups = [...KSA_PROVINCES.map((p) => ({ label: ar ? p.nameAr : p.nameEn, keys: p.amanahKeys })), { label: L('بدون إسناد جغرافي', 'No geographic attribution'), unmapped: true, keys: byA.map((g) => g.key).filter((k) => !mapped.has(k)) }]
        .map((g) => ({ ...g, cur: byA.filter((x) => g.keys.includes(x.key)), old: pA.filter((x) => g.keys.includes(x.key)) })).filter((g) => g.cur.length);
      if (!groups.length) return null;
      // the BAND column («نطاق أداء التحصيل»): the dashboard's own classification (regional/collectionBands.js) of the collection rate = Σ collected ÷ Σ net of the row's Amanahs — never an average of Amanah rates
      const bandOf = (collected, net) => bandCell({ collected, net }).text[ar ? 'ar' : 'en'];
      const rowOf = (g) => { const net = sum(g.cur, 'net'); const col = sum(g.cur, 'collected'); const pc = sum(g.old, 'collected'); const pn = sum(g.old, 'net'); return [g.label, g.cur.length, net, col, ratio(col, net), ...(comparable ? [pn > 0 ? pc / pn : null, pc > 0 ? col / pc - 1 : null] : []), bandOf(col, net)]; };
      return tbl('region', L('حسب المنطقة', 'By region'), [H(L('المنطقة', 'Region')), H(L('الأمانات', 'Amanahs'), 'count'), H(L('صافي المفوتر', 'Net billed'), 'money'), H(L('المحصّل', 'Collected'), 'money'), H(L('نسبة التحصيل', 'Collection rate'), 'pct'), ...(comparable ? [H(L('نسبة التحصيل في الفترة المماثلة', 'Collection rate, comparison period'), 'pct'), H(L('التغير في المحصّل', 'Change in collected'), 'pct')] : []), H(L('نطاق أداء التحصيل', 'Collection-performance band'))],
        groups.sort((a, b) => sum(b.cur, 'collected') - sum(a.cur, 'collected')).map(rowOf),
        { total: [L('الإجمالي', 'Total'), byA.length, T.net, T.collected, ratio(T.collected, T.net), ...(comparable ? [ratio(prev.totals.collected, prev.totals.net), prev.totals.collected > 0 ? T.collected / prev.totals.collected - 1 : null] : []), bandOf(T.collected, T.net)], note: L('المنطقة تجمع الأمانات المصرّح بها ضمن مرشحات التقرير؛ ليست أمانة واحدة. الجهات التي بلا منطقة موثّقة (كقطاع الإسكان) في صف «بدون إسناد جغرافي» وتُحتسب في الإجمالي.', 'A region aggregates the authorised Amanahs inside the report filters; it is not one Amanah. Entities without a verified region (such as the Housing Sector) are in the «No geographic attribution» row and counted in the total.') + ' ' + L('نطاق أداء التحصيل: نسبة التحصيل = المحصّل ÷ صافي المفوتر مجمّعًا من المبالغ (لا متوسط نسب الأمانات): أحمر أقل من 40% · برتقالي 40% إلى أقل من 60% · أصفر 60% إلى أقل من 80% · أخضر 80% فأكثر · غير متاح = لا صافي مفوتر صالح.', 'Collection-performance band: collection rate = collected ÷ net invoiced from summed amounts (never an average of Amanah rates): red below 40% · orange 40% to under 60% · yellow 60% to under 80% · green 80% and above · not available = no valid net invoiced.') });
    };
    const regionBlock = regionTable();
    const blocks = [
      { type: 'chart', kind: 'hbar', ranked: true, otherLabel: L('أمانات أخرى', 'Other Amanahs'), dim: dimOf('amanah', { measures: [M_NET, M_COLLECTED] }), ...amanahAlts(), title: L('صافي المفوتر والمحصّل حسب الأمانة', 'Net billed and collected by Amanah'), labels: amTop.map((g) => B(g.label)), series: [{ label: L('صافي المفوتر', 'Net billed'), values: amTop.map((g) => g.net) }, { label: L('المحصّل', 'Collected'), values: amTop.map((g) => g.collected) }], note: am.length > amTop.length ? L(`الأعلى ${amTop.length} من ${am.length} أمانة بحسب صافي المفوتر؛ الجدول الكامل أدناه.`, `Top ${amTop.length} of ${am.length} Amanahs by net billed; the full table is below.`) : null },
      ...(srcs.length >= 2 && am.length >= 2 ? [{ type: 'chart', kind: 'heatmap', valueKind: 'rate', dim: dimOf('amanah', { measures: [{ key: 'rate', kind: 'rate' }] }), title: L('نسبة التحصيل: الأمانة × مصدر الإيراد', 'Collection rate: Amanah × revenue source'), labels: srcs.map((x) => (ar ? sourceAr(x) : sourceEn(x))), series: amTop.map((g) => ({ label: B(g.label), values: srcs.map((x) => { const c = cell(g.key, x); return c && c.net > 0 ? c.collected / c.net : null; }) })), note: L('الخلية الفارغة «—» = لا فواتير أو لا صافي مفوتر (ليست صفراً). النسبة = المحصّل ÷ صافي المفوتر لكل خلية.', 'An empty «—» cell = no invoices or no net billed (not zero). Rate = collected ÷ net billed for each cell.') }] : []),
      tbl('amanah', L('حسب الأمانة / الجهة', 'By Amanah'), heads(L('الأمانة / الجهة', 'Amanah'), comparable), am.map((g) => row(B(g.label), g, comparable)), { total: totalRow(comparable), note: L('«غير محدد الأمانة» فواتير لم تُحدَّد لها أمانة في المصدر وتُعرض مستقلة دون توزيع.', '“Amanah not determined” = invoices whose source names no Amanah; shown apart, never spread over the others.') }),
      ...(regionBlock ? [regionBlock] : []),
      muniTable,
      tbl('fair', L('مقارنة عادلة: الأداء المعدّل بمزيج الإيرادات', 'Fair comparison: performance adjusted for revenue mix'), [H(L('الأمانة / الجهة', 'Amanah')), H(L('الفواتير', 'Invoices'), 'count'), H(L('صافي المفوتر', 'Net billed'), 'money'), H(L('معدل التحصيل', 'Collection rate'), 'pct'), H(L('المتوقع بحسب المزيج', 'Expected by mix'), 'pct'), H(L('الفرق (نقطة مئوية)', 'Index (pp)')), H(L('المتأخر من الصافي', 'Overdue share'), 'pct'), H(L('حصة من غير المحصّل', 'Share of uncollected'), 'pct')],
        fairComparison(snapshot).filter((r) => r.net > 0).sort((x, y) => (x.smallSample - y.smallSample) || ((y.index ?? -999) - (x.index ?? -999))).map((r) => [B(r.label) + (r.smallSample ? L(' (عينة صغيرة)', ' (small sample)') : ''), r.count, r.net, r.rate, r.expectedRate, r.index == null ? '—' : `${r.index >= 0 ? '+' : ''}${r.index.toFixed(1)}`, r.overdueShare, r.gapShare]),
        { note: L('المؤشر = معدل الأمانة − المعدل المتوقع إذا حقق كل مصدر من مصادرها معدله العام؛ يعزل أثر اختلاف المزيج وحجم الفواتير. الأمانات الأقل من 10 فواتير موسومة «عينة صغيرة» ولا تُرتَّب فوق غيرها.', 'Index = Amanah rate − the rate expected if each of its sources achieved that source’s overall rate; it removes the effect of different mixes and volumes. Amanahs with fewer than 10 invoices are flagged “small sample” and not ranked above others.') }),
      tbl('amanah_source_net', L('صافي المفوتر: الأمانة / الجهة × المصدر', 'Net billed: Amanah × source'), [H(L('الأمانة / الجهة', 'Amanah')), ...srcs.map((s) => H(ar ? sourceAr(s) : sourceEn(s), 'money')), H(L('الإجمالي', 'Total'), 'money')], am.map((g) => [B(g.label), ...srcs.map((s) => cell(g.key, s)?.net ?? null), g.net]), { total: [L('الإجمالي', 'Total'), ...srcs.map((s) => snapshot.matrix.amanahSource.filter((r) => r.source === s).reduce((t, r) => t + r.net, 0)), T.net] }),
      tbl('amanah_source_rate', L('نسبة التحصيل: الأمانة / الجهة × المصدر', 'Collection rate: Amanah × source'), [H(L('الأمانة / الجهة', 'Amanah')), ...srcs.map((s) => H(ar ? sourceAr(s) : sourceEn(s), 'pct')), H(L('الإجمالي', 'Total'), 'pct')], am.map((g) => [B(g.label), ...srcs.map((s) => { const c = cell(g.key, s); return c ? ratio(c.collected, c.net) : null; }), ratio(g.collected, g.net)]), { total: [L('الإجمالي', 'Total'), ...srcs.map((s) => { const rs = snapshot.matrix.amanahSource.filter((r) => r.source === s); return ratio(rs.reduce((t, r) => t + r.collected, 0), rs.reduce((t, r) => t + r.net, 0)); }), ratio(T.collected, T.net)] })
    ];
    blocks.find((b) => b.id === 'amanah').links = am.map((g) => drill({ amanah: g.key }));
    return blocks;
  };
  sections.sources = () => {
    const src = snapshot.bySource.slice().sort((a, b) => b.net - a.net);
    const blocks = [
      { type: 'chart', kind: 'hbar', ranked: true, otherLabel: L('مصادر أخرى', 'Other sources'), dim: dimOf('source', { measures: [M_NET, M_COLLECTED] }),
        ...mergeAlts([pointsAlt(rowsSrc(), { lang, entity: { ar: 'مصدر إيراد', en: 'revenue source', dimension: 'source' } }), ...amountDistAlts('source'), putAlt('byAmanah', bd('amanah', rowsAm(), byAmanahTitle, { ar: 'أمانات أخرى', en: 'Other Amanahs' })), putAlt('byProduct', bd('product', rowsProd(), byProductTitle, { ar: 'منتجات أخرى', en: 'Other products' }))]),
        title: L('صافي المفوتر والمحصّل حسب مصدر الإيراد', 'Net billed and collected by revenue source'), labels: src.map((g) => (ar ? sourceAr(g.key) : sourceEn(g.key))), series: [{ label: L('صافي المفوتر', 'Net billed'), values: src.map((g) => g.net) }, { label: L('المحصّل', 'Collected'), values: src.map((g) => g.collected) }] },
      tbl('sources', L('حسب مصدر الإيراد', 'By revenue source'), [H(L('مصدر الإيراد', 'Revenue source')), H(L('الفواتير', 'Invoices'), 'count'), H(L('إجمالي المفوتر', 'Gross billed'), 'money'), H(L('الاستبعادات', 'Exclusions'), 'money'), H(L('صافي المفوتر', 'Net billed'), 'money'), H(L('المحصّل', 'Collected'), 'money'), H(L('غير المحصّل', 'Uncollected'), 'money'), H(L('نسبة التحصيل', 'Collection rate'), 'pct'), ...(comparable ? [H(L('نسبة العام السابق', 'Last year rate'), 'pct')] : []), H(L('نسبة الاستبعاد', 'Exclusion rate'), 'pct')],
        src.map((g) => [ar ? sourceAr(g.key) : sourceEn(g.key), g.count, g.gross, g.exclusions, g.net, g.collected, g.outstanding, ratio(g.collected, g.net), ...(comparable ? [prevRate(g.key, 'bySource')] : []), ratio(g.exclusions, g.gross)]),
        { total: [L('الإجمالي', 'Total'), T.count, T.gross, T.exclusions, T.net, T.collected, T.outstanding, ratio(T.collected, T.net), ...(comparable ? [ratio(prev.totals.collected, prev.totals.net)] : []), ratio(T.exclusions, T.gross)] }),
      { type: 'callout', tone: 'info', text: L('غير متاح في هذا الديمو: التحصيل الفعلي من «تحصيل» (غير مربوط)، مستهدفات التحصيل المعتمدة لكل أمانة، اعتمادات الأبواب 1–3 لكل أمانة، سبب عدم السداد، وتاريخ سداد الدافع. لا تُقدَّر.', 'Not available in this demo: actual Tahseel collections (not connected), approved per-Amanah collection targets, per-Amanah budgets of chapters 1–3, the reason a payer did not pay, and payer payment history. They are not estimated.') }
    ];
    blocks.find((b) => b.id === 'sources').links = src.map((g) => drill({ src: g.key }));
    return blocks;
  };
  sections.aging = () => {
    const S = snapshot.stock; const sum = S.aging.reduce((t, a) => t + a.amount, 0);
    return [
      { type: 'callout', tone: 'info', text: L(`رصيد قائم وليس غير محصّل الفترة: كل ما صدر حتى ${snapshot.cutoff} ولم يُسدَّد بغض النظر عن فترة الإصدار (ضمن تصفية الأمانة والمصدر والبلدية).`, `A standing balance, not the period’s uncollected: everything issued up to ${snapshot.cutoff} and still owing, whatever the issue period (within the Amanah, source and municipality filters).`) },
      ...[wrap(agingChart(S.aging, lang, B), mergeAlts([
        putAlt('histogram', distStandingOk ? histogramAlt(dist.overdueStanding, { lang, valueKind: 'days', popAr: 'الرصيد القائم عند التاريخ المرجعي — الفواتير المتأخرة غير المحصّلة', popEn: 'The standing balance at the reference date — overdue uncollected invoices', extraAr: ` لم يحن استحقاق ${fmtInt(dist.overdueStanding.notDue.count)} فاتورة (خارج هذا الرسم)${dist.overdueStanding.dueUnknown?.count ? `، وتاريخ استحقاق ${fmtInt(dist.overdueStanding.dueUnknown.count)} غير متاح` : ''}.`, extraEn: ` ${fmtInt(dist.overdueStanding.notDue.count)} invoices are not yet due (not in this chart)${dist.overdueStanding.dueUnknown?.count ? `; ${fmtInt(dist.overdueStanding.dueUnknown.count)} have no due date` : ''}.` }) : null, NEEDS_DIST),
        putAlt('box', distStandingOk ? boxAlt(dist.overdueStanding.box.byAmanah, { lang, valueKind: 'days', labelOf: labelOfAmanah, entityAr: 'أمانة', entityEn: 'Amanah', dimension: 'amanah', title: L('أيام التأخر حسب الأمانة', 'Days overdue by Amanah') }) : null, NEEDS_DIST),
        putAlt('byAmanah', breakdownAlt({ dimension: 'amanah', rows: S.byAmanah.map((g) => ({ key: g.key, label: B(g.label), outstanding: g.outstanding })), lang, title: L('الرصيد غير المحصّل القائم حسب الأمانة', 'Standing uncollected balance by Amanah'), otherLabel: { ar: 'أمانات أخرى', en: 'Other Amanahs' }, measures: [{ key: 'uncollected', kind: 'amount', label: L('غير المحصّل', 'Uncollected'), field: 'outstanding' }], additive: true, whole: { label: L('الرصيد القائم', 'Standing balance'), value: S.netUncollected } })),
        putAlt('bySource', breakdownAlt({ dimension: 'source', rows: S.bySource.map((g) => ({ key: g.key, label: srcLabel(g.key), outstanding: g.outstanding })), lang, title: L('الرصيد غير المحصّل القائم حسب مصدر الإيراد', 'Standing uncollected balance by revenue source'), otherLabel: { ar: 'مصادر أخرى', en: 'Other sources' }, measures: [{ key: 'uncollected', kind: 'amount', label: L('غير المحصّل', 'Uncollected'), field: 'outstanding' }], additive: true, whole: { label: L('الرصيد القائم', 'Standing balance'), value: S.netUncollected } }))
      ]))].filter(Boolean),
      tbl('aging', L('التقادم', 'Aging'), [H(L('العمر بعد الاستحقاق', 'Age past due')), H(L('الفواتير', 'Invoices'), 'count'), H(L('غير المحصّل', 'Uncollected'), 'money'), H(L('الحصة', 'Share'), 'pct')], S.aging.map((a) => [B(a.label), a.count, a.amount, ratio(a.amount, sum)]), { total: [L('الرصيد القائم', 'Standing balance'), S.invoiceCount, S.netUncollected, 1] }),
      tbl('aging_amanah', L('أكبر الأرصدة حسب الأمانة', 'Largest balances by Amanah'), [H(L('الأمانة / الجهة', 'Amanah')), H(L('غير المحصّل القائم', 'Standing uncollected'), 'money'), H(L('الحصة', 'Share'), 'pct')], S.byAmanah.slice(0, 8).map((g) => [B(g.label), g.outstanding, ratio(g.outstanding, S.netUncollected)]))
    ];
  };
  sections.exclusions = () => {
    const ids = ['cancelled', ...EXCLUSION_RULES.map((r) => r.id)]; const R = Object.fromEntries(EXCLUSION_RULES.map((r) => [r.id, [r.label.ar, r.label.en]]));
    const cols = ids.filter((k) => snapshot.matrix.amanahReasons.some((r) => r.reason === k));
    const by = new Map(); for (const r of snapshot.matrix.amanahReasons) { const a = by.get(r.amanah) || { total: 0, cells: {} }; a.cells[r.reason] = r.amount; a.total += r.amount; by.set(r.amanah, a); }
    const rows = [...by.entries()].sort((a, b) => b[1].total - a[1].total).map(([k, v]) => [labelOfAmanah(k), ...cols.map((c) => v.cells[c] ?? null), v.total]);
    return [
      { type: 'relations', totals: ctxTotals },
      ...(cols.length >= 1 && T.exclusions > 0 ? (() => { const byReason = cols.map((c) => ({ c, amount: snapshot.matrix.amanahReasons.filter((r) => r.reason === c).reduce((t, r) => t + r.amount, 0) })).filter((x) => x.amount > 0).sort((x, y) => y.amount - x.amount); return byReason.length ? [{ type: 'chart', kind: 'hbar', ranked: true, otherLabel: L('أسباب أخرى', 'Other reasons'), dim: dimOf('reason', { measures: [M_EXCLUDED], additive: true, whole: { label: L('الاستبعادات', 'Exclusions'), value: T.exclusions } }),
        ...mergeAlts([flowAlts(), putAlt('byAmanah', breakdownAlt({ dimension: 'amanah', rows: [...by.entries()].map(([k, v]) => ({ key: k, label: labelOfAmanah(k), value: v.total })), lang, title: L('الاستبعادات حسب الأمانة', 'Exclusions by Amanah'), otherLabel: { ar: 'أمانات أخرى', en: 'Other Amanahs' }, measures: [{ key: 'excluded', kind: 'amount', label: L('المبلغ المستبعد', 'Excluded amount'), field: 'value' }], additive: true, whole: { label: L('الاستبعادات', 'Exclusions'), value: T.exclusions } }))]),
        title: L('الاستبعادات حسب السبب', 'Exclusions by reason'), labels: byReason.map((x) => (x.c === 'cancelled' ? RULE.cancelled[ar ? 0 : 1] : R[x.c]?.[ar ? 0 : 1] || x.c)), series: [{ label: L('المبلغ المستبعد', 'Excluded amount'), values: byReason.map((x) => x.amount) }], note: L('كل فاتورة تُحتسب مرة واحدة تحت سببها الفعلي.', 'Each invoice is counted once, under its effective reason.') }] : []; })() : []),
      tbl('exclusions', L('الفواتير المستثناة حسب الأمانة والسبب', 'Excluded invoices by Amanah and reason'), [H(L('الأمانة / الجهة', 'Amanah')), ...cols.map((c) => H((RULE[c] || R[c] || [c, c])[ar ? 0 : 1], 'money')), H(L('إجمالي الاستبعادات', 'Total exclusions'), 'money')], rows,
        { total: [L('الإجمالي', 'Total'), ...cols.map((c) => snapshot.matrix.amanahReasons.filter((r) => r.reason === c).reduce((t, r) => t + r.amount, 0)), T.exclusions], note: L('تظهر كل فاتورة مرة واحدة تحت سببها الرئيسي (الملغاة لها الأسبقية) فيساوي الإجمالي الاستبعادات ولا يتكرر الخصم عند تعدد الأسباب.', 'Each invoice appears once under its primary reason (cancelled takes precedence), so the total equals the exclusions and several reasons never deduct twice.') }),
      { type: 'callout', tone: 'info', text: L(`الاستبعاد ليس حكماً بعدم القابلية للتحصيل. قواعد معتمدة: ${snapshot.exclusionsApproval.approvedAmount > 0 ? fmtMoney(snapshot.exclusionsApproval.approvedAmount, { lang }) : '0'}؛ قواعد غير معتمدة: ${fmtMoney(snapshot.exclusionsApproval.unapprovedAmount, { lang })}.`, `Exclusion does not mean uncollectible. Approved rules: ${snapshot.exclusionsApproval.approvedAmount > 0 ? fmtMoney(snapshot.exclusionsApproval.approvedAmount, { lang }) : '0'}; unapproved rules: ${fmtMoney(snapshot.exclusionsApproval.unapprovedAmount, { lang })}.`) }
    ];
  };
  sections.gaps = () => {
    const target = targets.collectionRate.value;
    const rows = snapshot.matrix.amanahSource.map((r) => ({ ...r, gap: Math.max(0, r.net * target - r.collected) })).filter((r) => r.gap > 0).sort((a, b) => b.gap - a.gap).slice(0, 12);
    return [
      { type: 'callout', tone: 'warn', text: L(`تقدير مقابل مستهدف تجريبي: نسبة ${(target * 100).toFixed(0)}% مُدخل غير معتمد. الفجوة = صافي المفوتر × المستهدف − المحصّل، وليست مبلغاً مؤكد التحصيل.`, `An estimate against a demo target: ${(target * 100).toFixed(0)}% is an unapproved input. Gap = net billed × target − collected; it is not a known-collectible amount.`) },
      tbl('gaps', L('أكبر فجوات التحصيل', 'Largest collection gaps'), [H(L('الأمانة / الجهة', 'Amanah')), H(L('المصدر', 'Source')), H(L('الفواتير', 'Invoices'), 'count'), H(L('صافي المفوتر', 'Net billed'), 'money'), H(L('نسبة التحصيل', 'Collection rate'), 'pct'), H(L('غير المحصّل', 'Uncollected'), 'money'), H(L('الفجوة للمستهدف', 'Gap to target'), 'money')],
        rows.map((r) => [labelOfAmanah(r.amanah), ar ? sourceAr(r.source) : sourceEn(r.source), r.count, r.net, ratio(r.collected, r.net), r.outstanding, r.gap]), { note: L('أولويات الفواتير الفردية (المبلغ والتقادم والقابلية للمتابعة) في قائمة الفواتير غير المحصّلة.', 'Invoice-level priorities (amount, aging, actionability) are in the collection worklist.') })
    ];
  };
  sections.status = () => [
    tbl('status', L('الفواتير حسب الحالة', 'Invoices by status'), [H(L('الحالة', 'Status')), H(L('الفواتير', 'Invoices'), 'count'), H(L('حصة العدد', 'Share of invoices'), 'pct'), H(L('إجمالي المفوتر', 'Gross billed'), 'money'), H(L('الاستبعادات', 'Exclusions'), 'money'), H(L('صافي المفوتر', 'Net billed'), 'money'), H(L('المحصّل', 'Collected'), 'money'), H(L('غير المحصّل', 'Uncollected'), 'money')],
      snapshot.byStatus.slice().sort((a, b) => b.count - a.count).map((g) => [B(STATUS[g.key]) || g.key, g.count, ratio(g.count, T.count), g.gross, g.exclusions, g.net, g.collected, g.outstanding]),
      { total: [L('الإجمالي', 'Total'), T.count, 1, T.gross, T.exclusions, T.net, T.collected, T.outstanding], note: L('لكل فاتورة حالة واحدة (الإلغاء والاستبعاد لهما الأسبقية). لا تُحتسب مدفوعات الفواتير الملغاة/المستبعدة محصّلة. الأعداد أعداد فواتير ولا تُحوَّل لوحدة المبالغ.', 'Each invoice has exactly one status (cancelled and excluded take precedence). Payments on cancelled/excluded invoices are not collected. Counts are invoice counts, never converted to the money unit.') })
  ];
  sections.quality = () => {
    const eq = snapshot.equation; const q = snapshot.quality;
    const checks = [
      [L('إجمالي المفوتر = الاستبعادات + صافي المفوتر', 'Gross billed = exclusions + net billed'), eq.total.grossEqExclusionsPlusNet],
      [L('صافي المفوتر = المحصّل + غير المحصّل', 'Net billed = collected + uncollected'), eq.total.netEqCollectedPlusUncollected],
      [L('الإجمالي ≥ الصافي ≥ المحصّل ≥ 0', 'Gross ≥ net ≥ collected ≥ 0'), eq.total.ordered && eq.total.nonNegative],
      [L('كل أمانة ومصدر ونوع نطاق يحقق العلاقات نفسها', 'Every Amanah, source and scope type satisfies the same identities'), eq.amanahCheck && eq.sourceCheck && eq.scopeCheck],
      [L('الأمانات والبلديات والمصادر والأشهر والحالات تجمع كل منها إلى الإجمالي', 'Amanahs, municipalities, sources, months and statuses each add up to the total'), eq.amanahSumsToTotal && eq.municipalitiesSumToTotal && eq.sourceSumsToTotal && eq.monthsSumToTotal && eq.statusSumsToTotal],
      [L('جدولا أمانة × مصدر وأمانة × سبب يجمعان إلى الإجماليات', 'Amanah × source and Amanah × reason tables add up'), eq.matrixSumsToTotal],
      ...(bridge ? [[L('جسر تقرير غير المسدد يصل إلى الرصيد القائم', 'Unpaid-report bridge lands on the standing balance'), bridge.check === 0]] : [])
    ];
    return [
      tbl('checks', L('فحوص المطابقة', 'Reconciliation checks'), [H(L('الفحص', 'Check')), H(L('النتيجة', 'Result'))], checks.map(([t, ok]) => [t, ok ? L('✓ متحقق', '✓ passed') : L('✗ غير متحقق', '✗ failed')])),
      ...(bridge ? [tbl('bridge', L('جسر المطابقة: من تقرير غير المسدد إلى الرصيد القائم', 'Reconciliation bridge: unpaid report → standing balance'), [H(L('الخطوة', 'Step')), H(L('الفواتير', 'Invoices'), 'count'), H(L('المبلغ', 'Amount'), 'money')], bridge.steps.map((x) => [BRIDGE_LABELS[x.key] ? B(BRIDGE_LABELS[x.key]) : x.key, x.count ?? null, x.amount]), { total: [L('الرصيد القائم', 'Standing balance'), null, bridge.net], note: L(`فرق الجسر: ${bridge.check}. الرصيد القائم رصيد في ${bridge.detailsDate} لكل ما صدر حتى ذلك التاريخ.`, `Bridge difference: ${bridge.check}. A balance at ${bridge.detailsDate} for everything issued up to then.`) })] : []),
      tbl('issues', L('مشاكل اكتمال البيانات', 'Completeness issues'), [H(L('المشكلة', 'Issue')), H(L('القيمة', 'Value'), 'text')], [
        [L('استبعادات بانتظار المراجعة', 'Exclusions awaiting review'), fmtInt(q.pendingExclusionCount)], [L('فواتير مبلغها يتعارض مع البنود', 'Invoices whose amount conflicts with the item lines'), fmtInt(q.amountConflictCount)], [L('سجلات بحقول إلزامية ناقصة', 'Records with missing mandatory fields'), fmtInt(q.missingFieldCount)], [L('فواتير استثمار بلا عقد مرتبط', 'Investment invoices with no linked contract'), fmtInt(q.contractIssueCount)]]),
      { type: 'callout', tone: 'info', text: L('تعريفات تحتاج اعتماداً: قواعد الاستبعاد (INC-1 وEXE-1 وEFA-1 وNOC-1 وSTY-1 وOBJ-1)؛ هل تُستبعد «الاعتراضات»؛ أسبقية الإلغاء؛ أيام السماح؛ مستهدف نسبة التحصيل المعتمد. الأرقام القائمة على قواعد غير معتمدة موسومة.', 'Definitions to confirm: exclusion rules (INC-1, EXE-1, EFA-1, NOC-1, STY-1, OBJ-1); whether “objections” are excluded; cancelled-vs-excluded precedence; grace days; the approved collection-rate target. Figures resting on unapproved rules are labelled.') }
    ];
  };
  sections.bases = () => {
    const r = snapshot.receivedInPeriod;
    return [tbl('bases', L('أساس القياس', 'Measurement bases'), [H(L('المقياس', 'Measure')), H(L('الأساس', 'Basis')), H(L('المبلغ', 'Amount'), 'money')], [
      [L('المحصّل على فواتير الفترة', 'Collected on the period’s invoices'), L('تاريخ إصدار الفاتورة ضمن الفترة؛ المدفوعات حتى التاريخ المرجعي', 'Invoice issue date in the period; payments up to the reference date'), T.collected],
      [L('الإيرادات المحصلة بتاريخ الدفع خلال الفترة', 'Received during the period'), L('تاريخ الدفع ضمن الفترة لأي فاتورة', 'Payment date in the period, any invoice'), r.total],
      [L('— منه على فواتير الفترة نفسها', '— of which on the period’s own invoices'), '', r.fromPeriodInvoices], [L('— منه على فواتير فترات سابقة', '— of which on earlier invoices'), '', r.fromPriorInvoices],
      [L('مدفوعات على فواتير مستبعدة/ملغاة (لا تُحتسب محصّلة)', 'Receipts on excluded / cancelled invoices (not counted as collected)'), L('تاريخ الدفع ضمن الفترة', 'Payment date in the period'), r.onExcluded]
    ], { note: L('لا يُقسم أي رقم على مقام الآخر. لا يُحتسب إلغاء أو استبعاد إلا إذا سرى في التاريخ المرجعي أو قبله.', 'Neither figure is divided by the other’s denominator. A cancellation or exclusion counts only if effective on or before the reference date.') })];
  };
  sections.channels = () => {
    const rows = Object.entries(snapshot.receivedInPeriod.byChannel || {}).sort((a, b) => b[1] - a[1]); const tot = rows.reduce((t, [, v]) => t + v, 0);
    return [tbl('channels', L('قنوات الدفع', 'Payment channels'), [H(L('القناة', 'Channel')), H(L('الإيرادات المحصلة في الفترة (تاريخ الدفع)', 'Received in period (payment date)'), 'money'), H(L('الحصة', 'Share'), 'pct')], rows.map(([k, v]) => [(CHANNEL[k] || [k, k])[ar ? 0 : 1], v, ratio(v, tot)]), { total: [L('الإجمالي (دون مدفوعات الفواتير المستبعدة)', 'Total (excluding payments on excluded invoices)'), tot, 1] })];
  };

  // «تحليل أسباب عدم التحصيل»: the sections come from src/data/ncReportModel.js (the SAME builder as the standalone export) and read the structured analysis `ncAnalysis`
  const ncWithDist = ncAnalysis && dist && !ncAnalysis.distributions ? { ...ncAnalysis, distributions: dist } : ncAnalysis; // the same distributions payload (same scope) feeds the analysis' overdue-days histogram and box plot
  sections.noncollection = () => ncSections(ncWithDist, lang);
  const wantNc = spec.sections.includes('noncollection');
  const keys = SECTION_ORDER.filter((k) => spec.sections.includes(k) && (k !== 'noncollection' || ncAnalysis || spec.sections.length === 1)); // without the analysis the section is left out of a multi-section report (a lone request shows that it is unavailable)
  const ncOnly = wantNc && keys.length === 1 && keys[0] === 'noncollection' && isNcAnalysis(ncAnalysis);
  const out2 = keys.flatMap((k) => (k === 'noncollection' ? sections.noncollection() : [{ key: k, title: SECTION_META[k][ar ? 'ar' : 'en'], purpose: SECTION_META[k].purpose[ar ? 'ar' : 'en'], blocks: sections[k]() }]));

  // findings that complete the report (from the older smart report: records-based findings, risks, forecast limits, recommendations, assumptions)
  const tail = [];
  if (spec.depth === 'detailed' || keys.includes('executive')) { // recommendations belong to the headline report; single-topic reports stay focused
    tail.push({ key: 'recommendations', title: L('التوصيات المدعومة بالأدلة (مقترحات)', 'Evidence-supported recommendations (proposals)'), purpose: '', blocks: [{ type: 'list', items: legacy.recommendations.slice(0, spec.depth === 'detailed' ? 8 : 3).map((r) => `[${r.priority}] ${r.text}`) }] });
  }
  if (spec.depth === 'detailed') {
    tail.push({ key: 'findings', title: L('نتائج من السجلات (محسوبة) وتعارضات', 'Findings from the records (calculated) and conflicts'), purpose: '', blocks: [{ type: 'list', items: legacy.discoveries }, { type: 'list', items: legacy.risks.map((r) => `[${r.priority}] ${r.title} — ${r.rationale}`) }] });
    tail.push({ key: 'forecast', title: L('التنبؤ وحدوده (توضيحي — مبني على بيانات تجريبية)', 'Forecast and its limits (illustrative — based on demo data)'), purpose: '', blocks: [{ type: 'callout', tone: 'warn', text: L('هذا التنبؤ مبني على بيانات تجريبية اصطناعية ومُدخلات مستهدف غير معتمدة؛ هو توضيح للوظيفة وليس توقعاً معتمداً ولا يُبنى عليه قرار.', 'This forecast rests on synthetic demo data and unapproved target inputs; it illustrates the function and is not an approved projection. No decision should rest on it.') }, { type: 'list', items: legacy.predictions.map((p) => `${p.prediction} (${legacy.labels.confidence}: ${p.confidence}; ${legacy.labels.timeframe}: ${p.timeframe})`) }] });
  }
  tail.push({ key: 'assumptions', title: L('البيانات والافتراضات', 'Data and assumptions'), purpose: '', blocks: [{ type: 'list', items: [
    L('البيانات اصطناعية وليست بيانات الوزارة الفعلية، وعدد الفواتير لا يمثل الحجم التشغيلي.', 'The data is synthetic, not the Ministry’s actual data, and the invoice count does not represent operational volume.'),
    L('لكل جدول ورسم وحدة مبلغ واحدة؛ والمبلغ الدقيق بالريال في التلميحات والتصدير.', 'Each table and chart uses one amount unit; exact SAR amounts are in tooltips and exports.'),
    ...legacy.assumptions.slice(0, 5)
  ] }] });

  const muniOnTitle = spec.scope.muni && spec.scope.muni !== 'all' && !snapshot.scope?.muniInvalid ? ` — ${labelOfMuni(spec.scope.muni)}` : ''; // the report is named after the municipality's REFERENCE name (never an internal id)
  const title = ((spec.title && typeof spec.title === 'object' ? spec.title[lang] : spec.title) || (ncOnly ? NC_TITLE[lang] : L('تقرير الإيرادات والتحصيل', 'Revenue and collection report'))) + muniOnTitle;
  return assignChartIds({
    id: `rpt-${generatedAt.getTime()}`, title, subtitle: chips.find((c) => c.k === 'period').value,
    generatedAt: generatedAt.toISOString(), cutoff: snapshot.cutoff, lang, depth: spec.depth, compare, synthetic: true, context: chips,
    ...(access && !asGeoScope(access).all ? { access: { scopeKey: geoScopeKey(asGeoScope(access)), summary: { ar: describeAccess(access, 'ar'), en: describeAccess(access, 'en') } } } : {}), // the authorized scope this model was built for (restricted users only)
    totals: ctxTotals, empty: !(T.count > 0), equationOk: !!snapshot.equation.ok, headline: ncOnly ? ncHeadline(ncAnalysis, lang) : keys.length && keys.every((k) => k === 'quality') ? [] : headline(), sections: [...out2, ...tail], // F-21: the billing/collection KPI strip is not the headline of a data-quality report; a non-collection analysis has its own (net unpaid · overdue · not yet due · reason not documented)
    summaryText: ncOnly ? out2[0].blocks.filter((b) => b.type === 'text').map((b) => b.text).join(' ') : insightsRes.summary.text[ar ? 'ar' : 'en']
  });
}

export { scaled, unitLabel, unitOfValues };
