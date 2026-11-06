// PageChart — a chart of a PLATFORM page (not a report) with the shared toolbar. It wraps <ChartFrame> and adds what a page needs and a report does not:
//  - the page keeps ONE `view` (usePageChartView / the saved analysis version) and passes it down with `onViewChange`;
//  - drill-down (`onPick`) keeps working on whatever type was chosen where the marks can be mapped back to the page's own marks (chartDrill.js); on a type that cannot (a treemap, a
//    scatter, a flow …) the chart is not clickable and says so in one quiet line — never a click target that does nothing.
import React, { useMemo } from 'react';
import { useL } from '../../utils/bi';
import ChartFrame from './ChartFrame';
import './chartPages.css';
import { chartConfigOf } from '../../data/reportView';
import { displayFor } from './chartPickerLogic';
import { drillable, translateSelect, selectedToDisplay } from './chartDrill';

export default function PageChart({ block, view, onViewChange, picker = 'full', onPick = null, selected = null, table = true, className = '', chartId: idProp }) {
  const { lang: ctxLang } = useL(); const lang = ctxLang === 'en' ? 'en' : 'ar';
  const chartId = idProp || block.id;
  const saved = chartConfigOf(view, chartId);
  const disp = useMemo(() => displayFor(block, saved || {}, lang), [block, saved, lang]);
  const can = !!onPick && drillable(block, disp);
  const onSelect = can ? (s) => { const t = translateSelect(block, disp, s); if (t) onPick(t); } : null;
  const sel = can && selected ? selectedToDisplay(block, disp, selected) : null;
  return (
    <>
      <ChartFrame block={block} chartId={chartId} view={view} onViewChange={onViewChange} lang={lang} picker={picker} onSelect={onSelect} selected={sel} table={table} className={className} />
      {!!onPick && !can && <p className="muted pc-nodrill" role="note">{lang === 'ar' ? 'هذا النوع من الرسم لا يفتح الفواتير بالنقر؛ اختر الأشرطة أو الأعمدة للتعمق.' : 'This chart type does not open the invoices on click; choose bars or columns to drill down.'}</p>}
    </>
  );
}
