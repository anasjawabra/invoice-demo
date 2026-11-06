// «ملخص الأداء» — at most THREE findings, each answering a different question (docs/insights-redesign-spec.md §3). Pure: no React, no I/O, NO plan / target. No KPI narration (the KPI strip says the totals).
//   (a) change   the most significant change in collected against the comparison period (largest increase OR decrease by AMOUNT; the % beside it; «جديد» when nothing was collected before)
//   (b) gap      the largest UNCOLLECTED balance (invoice-based: net invoiced − collected, on the invoices of the selected period) — the basis is stated in the sentence and in `basis`
//   A finding that cites a band carries `status` (collectionBands.js: the SAME classification as the map / table / card / panel): (a) the size of the change, (b) the entity's collection rate band.
//   (c) priority the highest-priority issue of the existing prioritisation (Decision Room items, PLAN-category items excluded) — reviewPriorities.buildReviewPriorities picks it
// A finding is ABSENT (listed in `absent` with a coded reason and a sentence) when its inputs are unavailable — never fabricated, never 0.
//
//   buildPerformanceSummary({ dataset, items = null, canSeeDecisions = false }) → { max:3, findings:[finding], absent:[{ id, reason, message{ar,en} }] }
//   finding = { id:'change'|'gap'|'priority', title{ar,en}, sentence{ar,en}, subject:{ level:'region'|'entity'|'source'|'scope', key, name{ar,en}, regionIso? }, figure:{ label{ar,en}, value:{ ar:{sign,number,unit,text,direction}, en:{…} }, secondary:{ label{ar,en}, value:{ar,en}|null, newItem? }|null },
//               basis?:{ kind:'prior_period'|'uncollected'|'decision_room', ... }, status?, action:{ kind:'select'|'open_item', label{ar,en}, target:{ level, key } | { to } } }
import { formatValue } from './regionalLegend';
import { buildReviewPriorities } from './reviewPriorities';
import { statusOf } from './collectionBands';
import { pickUnit } from '../../utils/money';

const bi = (ar, en) => ({ ar, en });
const EPS = 1e-9;
export const SUMMARY_MAX = 3;
export const VIEW_ACTION = bi('عرض', 'View');
const ABSENT = {
  no_comparison: bi('لا فترة مماثلة سابقة ضمن تغطية البيانات، فلا يُحسب التغير.', 'No comparable previous period inside the data coverage, so no change is computed.'),
  no_material_change: bi('لا تغير جوهري في المحصّل عن الفترة المماثلة.', 'No material change in collected against the comparable period.'),
  no_data: bi('لا بيانات في هذا النطاق.', 'No data in this scope.'),
  no_uncollected: bi('لا رصيد غير محصّل في هذا النطاق.', 'There is no uncollected balance in this scope.'),
  no_access: bi('غرفة القرارات غير متاحة لدورك.', 'The Decision Room is not available for your role.'),
  no_items: bi('لا بنود تدعمها البيانات في هذا النطاق.', 'The data supports no findings in this scope.')
};
const money = (v, signed = true) => { const f = formatValue('collected', v, { signed, scale: pickUnit(Math.abs(v)) }); const e = formatValue('collected', v, { signed, lang: 'en', scale: pickUnit(Math.abs(v)) }); return { ar: f, en: e }; };

export function buildPerformanceSummary({ dataset, items = null, canSeeDecisions = false } = {}) {
  const findings = []; const absent = [];
  const skip = (id, reason) => absent.push({ id, reason, message: ABSENT[reason] });
  const hasData = !!dataset && dataset.total.cur.count > 0;

  /* (a) the most significant change */
  if (!hasData) skip('change', 'no_data');
  else if (!dataset.comparison.comparable) skip('change', 'no_comparison');
  else {
    const cands = [...dataset.regions.filter((r) => r.entityCount > 1), ...dataset.entities].filter((r) => r.prev).map((r) => ({ r, d: r.cur.collected - r.prev.collected }));
    const prevTotal = dataset.total.prev?.collected || 0; const floor = Math.max(1, (prevTotal || dataset.total.cur.collected || 0) * 0.002);
    const top = cands.filter((x) => Math.abs(x.d) >= floor).sort((a, b) => Math.abs(b.d) - Math.abs(a.d) || (a.r.key < b.r.key ? -1 : 1))[0];
    if (!top) skip('change', 'no_material_change');
    else {
      const { r, d } = top; const p = r.prev.collected; const pct = p > EPS ? d / p : null; const up = d > 0;
      const amount = money(d); const absAmount = money(Math.abs(d), false); const level = r.level === 'region' ? 'region' : 'entity';
      const pctText = pct != null ? { ar: formatValue('changeCollected', pct, { lang: 'ar' }), en: formatValue('changeCollected', pct, { lang: 'en' }) } : null;
      const pctAbs = pct != null ? { ar: formatValue('collectionRate', Math.abs(pct), { lang: 'ar' }), en: formatValue('collectionRate', Math.abs(pct), { lang: 'en' }) } : null;
      const compare = dataset.comparison.basis === 'same_period_last_year' ? bi('الفترة نفسها من العام الماضي', 'the same period last year') : bi('الفترة السابقة المماثلة', 'the previous like-for-like period');
      const chStatus = pct != null ? statusOf('changeCollected', pct) : null;
      findings.push({
        id: 'change', title: up ? bi('أكبر ارتفاع في المحصّل', 'Largest increase in collected') : bi('أكبر تراجع في المحصّل', 'Largest decrease in collected'),
        sentence: bi(`${r.label.ar}: المحصّل ${up ? 'ارتفع' : 'انخفض'} ${absAmount.ar.text}${pctAbs ? ` (${pctAbs.ar.text})` : ' (جديد: لا تحصيل في الفترة المماثلة)'} عن ${compare.ar}.`, `${r.label.en}: collected ${up ? 'rose' : 'fell'} ${absAmount.en.text}${pctAbs ? ` (${pctAbs.en.text})` : ' (new: nothing collected in the comparison period)'} against ${compare.en}.`),
        subject: { level, key: r.key, name: r.label, ...(r.regionIso ? { regionIso: r.regionIso } : {}) },
        figure: { label: bi('التغير في المحصّل', 'Change in collected'), value: { ar: amount.ar, en: amount.en }, secondary: pctText ? { label: bi('نسبة التغير', 'Change rate'), value: { ar: pctText.ar, en: pctText.en } } : { label: bi('نسبة التغير', 'Change rate'), value: null, newItem: true } },
        ...(chStatus ? { status: chStatus } : {}),
        basis: { kind: 'prior_period', comparison: compare, previous: dataset.comparison.previous },
        action: { kind: 'select', label: VIEW_ACTION, target: { level, key: r.key } }
      });
    }
  }

  /* (b) the largest gap — invoice-based: the largest uncollected balance (net invoiced − collected) on the invoices of the selected period */
  if (!hasData) skip('gap', 'no_data');
  else {
    const top = dataset.entities.filter((e) => e.cur.uncollected > EPS).sort((a, b) => b.cur.uncollected - a.cur.uncollected || (a.key < b.key ? -1 : 1))[0];
    if (!top) skip('gap', 'no_uncollected');
    else {
      const amount = money(top.cur.uncollected, false); const shareOf = top.cur.uncollected / Math.max(dataset.total.cur.uncollected, EPS);
      const rate = top.cur.net > EPS ? top.cur.collected / top.cur.net : null; const rateStatus = rate != null ? statusOf('rate', rate) : null;
      const rateText = rate != null ? { ar: formatValue('collectionRate', rate, { lang: 'ar' }), en: formatValue('collectionRate', rate, { lang: 'en' }) } : null;
      findings.push({
        id: 'gap', title: bi('أكبر رصيد غير محصّل', 'Largest uncollected balance'),
        sentence: bi(`${top.label.ar}: أكبر رصيد غير محصّل ${amount.ar.text} (${(shareOf * 100).toFixed(1)}% من غير المحصّل). الأساس: صافي المفوتر − المحصّل على فواتير الفترة المختارة.`, `${top.label.en}: the largest uncollected balance, ${amount.en.text} (${(shareOf * 100).toFixed(1)}% of the uncollected). Basis: net invoiced − collected on the invoices of the selected period.`),
        subject: { level: 'entity', key: top.key, name: top.label, ...(top.regionIso ? { regionIso: top.regionIso } : {}) },
        figure: { label: bi('غير المحصّل (الصافي − المحصّل)', 'Uncollected (net − collected)'), value: { ar: amount.ar, en: amount.en }, secondary: { label: bi('نسبة التحصيل', 'Collection rate'), value: rateText } },
        ...(rateStatus ? { status: rateStatus } : {}),
        basis: { kind: 'uncollected', text: bi('صافي المفوتر − المحصّل، على فواتير الفترة المختارة', 'Net invoiced − collected, on the invoices of the selected period') },
        action: { kind: 'select', label: VIEW_ACTION, target: { level: 'entity', key: top.key } }
      });
    }
  }

  /* (c) the highest-priority issue (the existing prioritisation) */
  const R = buildReviewPriorities({ items, canSeeDecisions, limit: 1 });
  if (!R.allowed) skip('priority', 'no_access');
  else if (!R.cases.length) skip('priority', 'no_items');
  else {
    const c = R.cases[0];
    findings.push({
      id: 'priority', title: bi('أعلى مسألة أولوية', 'Highest-priority issue'),
      sentence: bi(`${c.title.ar}${c.measure.text.ar ? ` — ${c.measure.label.ar} ${c.measure.text.ar}` : ''}.`, `${c.title.en}${c.measure.text.en ? ` — ${c.measure.label.en} ${c.measure.text.en}` : ''}.`),
      subject: { level: c.entity.level, key: c.entity.key, name: c.entity.name },
      figure: { label: c.measure.label, value: { ar: { text: c.measure.text.ar }, en: { text: c.measure.text.en } }, secondary: null },
      basis: { kind: 'decision_room', itemKey: c.key, priority: c.priority, category: c.category },
      action: { kind: 'open_item', label: VIEW_ACTION, target: { to: c.inspectTarget.to, key: c.key } }
    });
  }
  return { max: SUMMARY_MAX, findings: findings.slice(0, SUMMARY_MAX), absent };
}
