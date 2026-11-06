// «التقارير الذكية» as a main page of the application (/smart-reports): the conversational workspace on its own, no longer a tab of the dashboards page.
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useRevenue } from '../context/RevenueContext';
import { Skeleton } from '../components/strategic/AsyncState';
import SmartReports from './SmartReports';

export default function SmartReportsPage() {
  const rev = useRevenue();
  const [sp, setSp] = useSearchParams();
  return (
    <div className="st-page">
      {!rev.ready ? <div role="status"><Skeleton height={220} /></div>
        : <SmartReports initialQuery={sp.get('q')} onQueryConsumed={() => { const n = new URLSearchParams(sp); n.delete('q'); setSp(n, { replace: true }); }} />}
    </div>
  );
}
