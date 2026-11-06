// usePageChartView(page) → [view, onViewChange]: the chart presentation of a page, remembered per user (pageChartView.js). `onViewChange(newView, meta)` is what <ChartFrame> calls.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRevenue } from '../../context/RevenueContext';
import { userKeyOf } from '../../data/reportStore';
import { pageViewStore } from './pageChartView';
import { emptyView } from '../../data/reportView';

export function usePageChartView(page) {
  const rev = useRevenue(); const uk = userKeyOf(rev.user);
  const [view, setView] = useState(() => pageViewStore().load(uk, page));
  const key = useRef(`${uk}|${page}`);
  useEffect(() => { const k = `${uk}|${page}`; if (key.current !== k) { key.current = k; setView(pageViewStore().load(uk, page)); } }, [uk, page]);
  const onViewChange = useCallback((next) => { const v = next || emptyView(); setView(v); pageViewStore().save(uk, page, v); }, [uk, page]);
  return [view, onViewChange];
}
