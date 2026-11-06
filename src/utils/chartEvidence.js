// Up to three plain evidence lines for a chart-library block, computed from the block's OWN numbers (nothing inferred): they sit next to the chart on its PowerPoint slide.
// Wording rules: no causation claim for scatter / bubble, shares are stated against their stated whole, missing values are counted, never read as zero.
import { chartInfo } from '../data/reportFormat';
import { chartUnit } from './money';

const fin = (v) => v != null && Number.isFinite(Number(v));
const pct = (v, t) => (t > 0 ? `${((v / t) * 100).toFixed(1)}%` : '');
// a formatter for one measure kind: amounts in the unit of their own set, rates as %, days / counts as numbers
function fmtOf(kind, vals, lang) {
  if (kind === 'rate') return (v) => `${(v * 100).toFixed(1)}%`;
  if (kind === 'days') return (v) => `${+Number(v).toFixed(1)} ${lang === 'ar' ? 'يوماً' : 'd'}`;
  if (kind === 'count') return (v) => Math.round(v).toLocaleString('en-US');
  const cu = chartUnit(vals.filter(fin), lang); return (v) => cu.fmt(v);
}
const range = (vals) => { const v = vals.filter(fin); return v.length ? [Math.min(...v), Math.max(...v)] : null; };
const leaves = (n) => (n?.children?.length ? n.children.flatMap(leaves) : n && fin(n.value) ? [n] : []);

export function evidenceNew(b, lang) {
  const L = (a, e) => (lang === 'ar' ? a : e); const k = b.kind; const out = [];
  try {
    if (['stacked_col', 'stacked100_col', 'stacked100_hbar', 'area', 'stacked_area', 'donut', 'combo', 'pareto'].includes(k) && b.series?.length) {
      const f = (v) => chartInfo(b, lang).cu.fmt(v); const lbl = b.labels.map(String);
      if (k === 'pareto') {
        const s = b.series[0].values.map((v, i) => [Number(v), lbl[i]]); const tot = s.reduce((t, [v]) => t + v, 0);
        const other = b.otherLabel != null ? String(b.otherLabel) : null; const ord = [...s.filter(([, l]) => l !== other).sort((x, y) => y[0] - x[0]), ...s.filter(([, l]) => l === other)];
        if (tot > 0) { let run = 0; let n80 = 0; for (const [v] of ord) { run += v; n80 += 1; if (run / tot >= 0.8) break; } out.push(`${L('الأكبر', 'Largest')}: ${ord[0][1]} — ${f(ord[0][0])} (${pct(ord[0][0], tot)})`, `${n80} ${L('من', 'of')} ${ord.length} ${L('بنداً تبلغ ٨٠٪ على الأقل من الإجمالي', 'items reach at least 80% of the total')} (${f(tot)})`); }
      } else if (k === 'donut') {
        const v = b.series[0].values.map((x, i) => [Number(x), lbl[i]]).filter(([x]) => fin(x)); const tot = v.reduce((t, [x]) => t + x, 0); const top = v.slice().sort((x, y) => y[0] - x[0])[0];
        out.push(`${L('الإجمالي', 'Total')}: ${f(tot)}`); if (top) out.push(`${L('الأكبر', 'Largest')}: ${top[1]} — ${f(top[0])} (${pct(top[0], tot)})`);
      } else if (k === 'combo') {
        const bars = b.series.filter((s) => s.type !== 'line'); const lines = b.series.filter((s) => s.type === 'line');
        bars.slice(0, 1).forEach((s) => { const p = s.values.map((x, i) => [x, i]).filter(([x]) => fin(x)); if (p.length) { const hi = p.reduce((a, c) => (c[0] > a[0] ? c : a)); out.push(`${s.label}: ${L('الأعلى', 'highest')} ${lbl[hi[1]]} (${f(hi[0])})`); } });
        lines.slice(0, 2).forEach((s) => { const p = s.values.map((x, i) => [x, i]).filter(([x]) => fin(x)); if (p.length > 1) { const sec = s.axis === 'secondary'; const ff = sec ? fmtOf(b.axis2?.kind || 'rate', p.map(([x]) => x), lang) : f; out.push(`${s.label}: ${lbl[p[0][1]]} ${ff(p[0][0])} → ${lbl[p[p.length - 1][1]]} ${ff(p[p.length - 1][0])}`); } });
      } else if (k === 'area' || k === 'stacked_area') {
        b.series.slice(0, 3).forEach((s) => { const p = s.values.map((x, i) => [x, i]).filter(([x]) => fin(x)); if (p.length > 1) out.push(`${s.label}: ${lbl[p[0][1]]} ${f(p[0][0])} → ${lbl[p[p.length - 1][1]]} ${f(p[p.length - 1][0])}`); });
      } else { // stacked / 100 % stacked: the largest category total and the largest part overall
        const tots = b.labels.map((_, i) => b.series.reduce((t, s) => t + (fin(s.values[i]) ? Number(s.values[i]) : 0), 0)); const hi = tots.reduce((a, v, i) => (v > tots[a] ? i : a), 0); const all = tots.reduce((t, v) => t + v, 0);
        out.push(`${L('أعلى إجمالي', 'Highest total')}: ${lbl[hi]} — ${f(tots[hi])}`);
        const parts = b.series.map((s) => [s.label, s.values.reduce((t, v) => t + (fin(v) ? Number(v) : 0), 0)]).sort((x, y) => y[1] - x[1]); if (all > 0 && parts[0]) out.push(`${L('الجزء الأكبر', 'Largest part')}: ${parts[0][0]} — ${f(parts[0][1])} (${pct(parts[0][1], all)} ${L('من الإجمالي', 'of the total')})`);
      }
    } else if (k === 'histogram' && b.bins?.length) {
      const tot = b.bins.reduce((t, x) => t + (fin(x.count) ? x.count : 0), 0); const hi = b.bins.reduce((a, x) => ((x.count ?? -1) > (a.count ?? -1) ? x : a), b.bins[0]);
      const sar = b.binUnit === 'sar'; const bf = sar ? fmtOf('amount', b.bins.flatMap((x) => [x.lo, x.hi]), lang) : (v) => String(+Number(v).toFixed(2));
      out.push(`${L('المشاهدات', 'Observations')}: ${tot.toLocaleString('en-US')} ${L('في', 'in')} ${b.bins.length} ${L('فئة', 'bins')}`, `${L('أكثر فئة', 'Fullest bin')}: ${fin(hi.lo) ? bf(hi.lo) : ''}${fin(hi.lo) && fin(hi.hi) ? '–' : ''}${fin(hi.hi) ? bf(hi.hi) : ''} — ${hi.count.toLocaleString('en-US')} (${pct(hi.count, tot)})`);
    } else if ((k === 'scatter' || k === 'bubble') && b.points?.length) {
      const pts = b.points.filter((p) => fin(p.x) && fin(p.y)); const xr = range(pts.map((p) => p.x)); const yr = range(pts.map((p) => p.y));
      const fx = fmtOf(b.xKind || 'amount', pts.map((p) => p.x), lang); const fy = fmtOf(b.yKind || 'amount', pts.map((p) => p.y), lang);
      out.push(`${pts.length} ${L('نقطة', 'points')}${b.points.length > pts.length ? ` (${b.points.length - pts.length} ${L('نقطة بلا قيمة لا تُرسم', 'without a value are not drawn')})` : ''}`);
      if (xr) out.push(`${b.xTitle || 'x'}: ${fx(xr[0])} – ${fx(xr[1])}`); if (yr) out.push(`${b.yTitle || 'y'}: ${fy(yr[0])} – ${fy(yr[1])}`);
    } else if (k === 'bullet' && b.bullets?.length) {
      const rows = b.bullets.filter((x) => fin(x.actual) && fin(x.target)); const f = fmtOf(b.valueKind || 'amount', rows.flatMap((x) => [x.actual, x.target]), lang); const met = rows.filter((x) => x.actual >= x.target).length;
      out.push(`${rows.length} ${L('بنداً بهدف معتمد', 'rows with an approved target')}: ${met} ${L('بلغ الهدف أو تجاوزه', 'at or above target')}, ${rows.length - met} ${L('دونه', 'below')}`);
      if (rows.length) { const lo = rows.reduce((a, x) => (x.actual / x.target < a.actual / a.target ? x : a)); out.push(`${L('أبعد عن الهدف', 'Furthest below target')}: ${lo.label} — ${f(lo.actual)} / ${f(lo.target)}`); }
    } else if (k === 'box' && b.groups?.length) {
      const g = b.groups.filter((x) => x.n >= 5); const f = fmtOf(b.valueKind || 'amount', g.flatMap((x) => [x.min, x.median, x.max]), lang);
      out.push(`${g.length} ${L('مجموعة مرسومة (٥ مشاهدات فأكثر)', 'groups drawn (5+ observations)')}${b.groups.length > g.length ? `, ${b.groups.length - g.length} ${L('بلا عدد كافٍ', 'without enough observations')}` : ''}`);
      if (g.length) { const hi = g.reduce((a, x) => (x.median > a.median ? x : a)); out.push(`${L('أعلى وسيط', 'Highest median')}: ${hi.label} — ${f(hi.median)}`); }
    } else if ((k === 'treemap' || k === 'sunburst') && b.tree) {
      const lv = leaves(b.tree); const tot = lv.reduce((t, x) => t + x.value, 0); const f = fmtOf('amount', lv.map((x) => x.value), lang); const top = lv.slice().sort((x, y) => y.value - x.value)[0];
      out.push(`${L('الإجمالي', 'Total')}: ${f(tot)}`); if (top) out.push(`${L('أكبر عنصر', 'Largest item')}: ${top.label} — ${f(top.value)} (${pct(top.value, tot)})`);
    } else if (k === 'sankey' && b.links?.length) {
      const nm = (id) => b.nodes?.find((n) => n.id === id)?.label ?? id; const f = fmtOf('amount', b.links.map((l) => l.value), lang); const top = b.links.reduce((a, l) => (l.value > a.value ? l : a), b.links[0]);
      out.push(`${b.links.length} ${L('تدفقاً', 'flows')}`, `${L('أكبر تدفق', 'Largest flow')}: ${nm(top.from)} → ${nm(top.to)} — ${f(top.value)}`);
    }
  } catch { /* evidence is optional: a block the helper cannot read simply shows fewer lines */ }
  return out.slice(0, 3);
}
