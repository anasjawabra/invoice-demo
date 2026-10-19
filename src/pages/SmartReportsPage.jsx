// «التقارير الذكية» as a main page of the application (/smart-reports): the conversational workspace on its own, no longer a tab of the dashboards page.
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useRevenue } from '../context/RevenueContext';
import { useAr } from '../utils/useAr';
import { Skeleton } from '../components/strategic/AsyncState';
import SmartReports from './SmartReports';

export default function SmartReportsPage() {
  const rev = useRevenue(); const { L } = useAr();
  const [sp, setSp] = useSearchParams();
  return (
    <div className="st-page">
      <header className="st-head">
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>{L('التقارير الذكية', 'Smart reports')}</h1>
          <div className="muted" style={{ fontSize: 13 }}>{L('اسأل أو اطلب تقريراً أو أرفق ملفات؛ وحسّن النتيجة بكلام عادي ثم نزّلها.', 'Ask, request a report or attach files; refine the result in plain words, then download it.')}</div>
        </div>
      </header>
      {!rev.ready ? <div role="status"><Skeleton height={220} /></div>
        : <SmartReports initialQuery={sp.get('q')} onQueryConsumed={() => { const n = new URLSearchParams(sp); n.delete('q'); setSp(n, { replace: true }); }} embedded />}
    </div>
  );
}
