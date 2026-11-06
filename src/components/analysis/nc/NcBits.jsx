// Small shared parts of the non-collection result page: the context every tab reads, the fact-kind / evidence vocabulary, a chart card with drill-down, and the one-line limitation notes.
import React, { createContext, useContext, useMemo } from 'react';
import ReportChart from '../../smart/ReportChart';
import PageChart from '../../charts/PageChart';
import { useL } from '../../../utils/bi';
import { FACT_KIND, EVIDENCE, encodeDrill } from './ncModel';

export const NcCtx = createContext(null);
export const useNc = () => useContext(NcCtx);

/** «source-reported · calculated · reviewer-confirmed · hypothesis · not documented» — a word, never a score */
export function FactTag({ kind }) {
  const { ar } = useL(); const k = FACT_KIND[kind] || FACT_KIND.calculated;
  return <span className={`nc-tag nc-tag--${k.cls}`}>{ar ? k.ar : k.en}</span>;
}
export function EvidenceText({ status }) {
  const { ar } = useL(); const e = EVIDENCE[status] || EVIDENCE.calculated;
  return <span className={`nc-ev nc-ev--${status}`}>{ar ? e.ar : e.en}</span>;
}

/** one quiet line placed next to the result it qualifies, with the way to the methodology tab */
export function LimitNote({ children }) {
  const { L } = useL(); const nc = useNc();
  return (
    <p className="nc-limit"><span aria-hidden="true">ⓘ</span> <span>{children}</span> {nc && <button type="button" className="nc-linkbtn" onClick={() => nc.goTab('quality')}>{L('Methodology', 'المنهجية')}</button>}</p>
  );
}

/** an amount in the readable unit with the exact SAR in the tooltip */
export function Money({ v, unit }) {
  const { money, sar, num } = useL();
  return <bdi dir="ltr" title={sar(v)}>{unit ? num(v, unit) : money(v)}</bdi>;
}

/** which mark of the chart produced the CURRENT drill-down (so the choice is outlined again after a return) */
export function findSelected(chart, current) {
  if (!current) return null; const bl = chart.block; const enc = encodeDrill(current);
  const heat = bl.kind === 'heatmap'; const stacked = bl.kind === 'stacked_hbar';
  const nI = heat ? bl.series.length : stacked ? 1 : bl.labels.length; const nJ = heat ? bl.labels.length : stacked ? bl.series.length : 1;
  for (let i = 0; i < nI; i += 1) for (let j = 0; j < nJ; j += 1) { const d = chart.pick({ kind: 'mark', i, j: heat || stacked ? j : 0 }); if (d && !d.unsupported && encodeDrill({ ...d, src: current.src }) === enc) return { i, j: heat || stacked ? j : null }; }
  return null;
}

/** a chart that opens the supporting invoices of the mark that is chosen; `hint` states what the click does, `note` is the denominator / limitation line.
 *  A chart that has a counterpart in the exported report (nc.enrich[name]) gets the shared chart toolbar: the type the person picks is kept with the saved version and carried into the exported file;
 *  clicking a mark still opens its invoices wherever the drawn marks can be mapped back (src/components/charts/chartDrill.js), otherwise the chart is not clickable and says so. */
export function ChartCard({ chart, name, note, className = '' }) {
  const { L, lang } = useL(); const nc = useNc();
  const selected = useMemo(() => findSelected(chart, nc.drill), [chart, nc.drill]);
  const onSelect = (s) => { const d = chart.pick(s); if (!d) return; if (d.unsupported) nc.notify(L(d.reason.en, d.reason.ar)); else nc.openDrill(d, 'chart'); };
  const en = nc.enrich && nc.enrich[name];
  const block = useMemo(() => (en ? { ...chart.block, ...en } : null), [chart.block, en]);
  return (
    <section className={`nc-chart ${className}`} aria-label={chart.block.title} data-chart={name}>
      {block ? <PageChart block={block} view={nc.chartView} onViewChange={nc.onChartView} picker="full" onPick={onSelect} selected={selected} />
        : <ReportChart block={chart.block} lang={lang} onSelect={onSelect} selected={selected} />}
      {note && <p className="nc-chart__note">{note}</p>}
    </section>
  );
}

/** the label of a bucket in the page language */
export const pickLabel = (o, ar) => (o ? (ar ? o.ar : o.en) : '');
