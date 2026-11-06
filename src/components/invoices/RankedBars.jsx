// RankedBars — ONE ranked horizontal-bar card for a facet of the invoice lists (collected by product · by invoice source · unpaid by revenue source / product).
// It reuses the shared report chart (kind «hbar» of ReportChart / chartDraw): hover = amount + share of the total + invoice count, a click selects the bar
// (onSelect(key) → the page turns it into a list filter), the selected bar is outlined, the others are dimmed, a second click or «reset» clears it.
// Optional `chartView` + `onChartView` (usePageChartView) add the compact «Change chart» control: the same facet as another compatible type (donut, treemap, pareto …); a click still filters
// wherever the drawn marks can be mapped back to a bar (chartDrill.js).
// Top five + «view all»; a missing facet is «unavailable», never zero; while loading a skeleton keeps the card height.
import React, { useMemo, useState } from 'react';
import { useL } from '../../utils/bi';
import ReportChart from '../smart/ReportChart';
import PageChart from '../charts/PageChart';
import { summaryBlock } from './summaryChart';
import { rankedBlock, shareText, TOP_N } from './listLogic';

export default function RankedBars({ id, title, caption, dim, items, measure, role, valueTitle, selectedKey = null, onSelect, onReset, loading = false, emptyText, actions = null, chartView = null, onChartView = null, shareLabel = null }) {
  const { L, ar, count: nf } = useL();
  const [expanded, setExpanded] = useState(false);
  const r = useMemo(() => rankedBlock({ dim, items, measure, role, title, valueTitle, ar, expanded, selectedKey, nf }), [dim, items, measure, role, title, valueTitle, ar, expanded, selectedKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = r.total;
  const block = useMemo(() => (r.block && onChartView ? summaryBlock(r.block, { id, dim, measure, total, ar }) : r.block), [r.block, onChartView, id, dim, measure, total, ar]);
  const pickBase = (t) => { const k = block.keys?.[t.i]; if (onSelect && k != null) onSelect(k); };
  const selItem = selectedKey != null && r.all ? r.all.find((x) => String(x.key) === String(selectedKey)) : null;
  const pickMark = (m) => { if (onSelect && m && m.key != null) onSelect(m.key); };
  return (
    <section className={`card card-pad il-card il-bars il-bars--${role === 'collected' ? 'collected' : 'unpaid'}${selectedKey != null ? ' il-bars--sel' : ''}`} aria-label={title} data-il={id}>
      <header className="il-card__head">
        <h3 className="il-card__title">{title}</h3>
        {actions}
      </header>
      {caption && <p className="il-card__cap muted">{caption}</p>}
      {loading && !items ? <div className="il-skel" aria-busy="true" aria-label={L('Loading…', 'جارٍ التحميل…')} />
        : !r.available ? <p className="il-na" role="status">{L('Not available for this selection.', 'غير متاح لهذا الاختيار.')}</p>
          : !r.block ? <p className="il-na" role="status">{emptyText || L('No amounts to rank in this selection.', 'لا توجد مبالغ للترتيب في هذا الاختيار.')}</p>
            : onChartView ? <PageChart block={block} view={chartView} onViewChange={onChartView} picker="compact" table={false} onPick={onSelect ? pickBase : null} selected={r.selectedIndex >= 0 ? { i: r.selectedIndex } : null} className="il-chart" />
              : <ReportChart block={r.block} table={false} onSelect={pickMark} selected={r.selectedIndex >= 0 ? { i: r.selectedIndex } : null} className="il-chart" />}
      <footer className="il-card__foot">
        {selItem && (
          <span className="il-sel" role="status">
            {L('Selected', 'المحدّد')}: <b dir="auto">{r.rows.find((x) => String(x.key) === String(selectedKey)) ? r.block.labels[r.selectedIndex] : String(selectedKey)}</b>
            <span className="muted"> · {shareText(selItem[measure], r.total)}{shareLabel ? ` ${shareLabel}` : ''}</span>
            <button type="button" className="btn btn-sm btn-ghost" onClick={onReset}>{L('Reset', 'إلغاء التحديد')}</button>
          </span>
        )}
        {r.available && (r.hiddenCount > 0 || (expanded && r.all.length > TOP_N)) && (
          <button type="button" className="btn btn-sm btn-ghost il-viewall" aria-expanded={expanded} onClick={() => setExpanded((x) => !x)}>
            {expanded ? L(`Show top ${TOP_N}`, `عرض أعلى ${nf(TOP_N)} فقط`) : L(`View all (${nf(r.all.length)})`, `عرض الكل (${nf(r.all.length)})`)}
          </button>
        )}
      </footer>
    </section>
  );
}
