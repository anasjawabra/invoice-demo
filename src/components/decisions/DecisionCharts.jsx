// The 2–3 focused charts of «غرفة القرارات»: the largest unpaid overdue exposure (by entity / by revenue source) · collected against the plan to date (ONLY where an approved comparable plan exists) ·
// the aging of the overdue balance. Each is a shared-spec block (ReportChart) labelled with unit, period, cutoff and basis; choosing a bar filters the items below (onMark).
// A chart the data cannot support is shown as unavailable with the reason, never as zero.
import React, { useState } from 'react';
import { useAr } from '../../utils/useAr';
import ReportChart from '../smart/ReportChart';
import { markFrom } from './decisionUi';

function Unavailable({ title, reason }) {
  const { L } = useAr();
  return (
    <section className="dr-chart dr-chart--na" aria-label={title}>
      <h4 className="rv-sec-title rc-title">{title}</h4>
      <p className="muted" role="status"><b>{L('غير متاح', 'Not available')}</b> — {reason}</p>
    </section>
  );
}

export default function DecisionCharts({ charts, mark, onMark }) {
  const { L, lang } = useAr();
  const [by, setBy] = useState('amanah');
  if (!charts) return null;
  const R = charts.overdueRank; const useSource = by === 'source' && !!R.source;
  const rankBlock = useSource ? R.source : R.amanah; const rankKey = useSource ? 'rank-source' : 'rank-amanah';
  const pick = (key, block) => (sel) => { const m = markFrom(key, block, sel); if (m) onMark(m); };
  const selected = (key) => (mark && mark.chart === key ? { i: mark.i } : null);
  const U = charts.unavailable || {};
  return (
    <section className="dr-charts" aria-label={L('رسوم الغرفة', 'Room charts')}>
      <p className="muted dr-charts__hint">{L('اختر عموداً في الرسم لتصفية البنود أدناه بالجهة أو المصدر أو الفئة المقابلة.', 'Choose a bar to filter the items below by the matching entity, source or category.')}</p>
      <div className="dr-charts__grid">
        {rankBlock ? (
          <section className="dr-chart" aria-label={rankBlock.title}>
            {R.source && (
              <div className="dr-seg" role="group" aria-label={L('تجميع الرسم', 'Group the chart by')}>
                <button type="button" className="dr-seg__b" aria-pressed={!useSource} onClick={() => setBy('amanah')}>{L('حسب الأمانة', 'By entity')}</button>
                <button type="button" className="dr-seg__b" aria-pressed={useSource} onClick={() => setBy('source')}>{L('حسب مصدر الإيراد', 'By revenue source')}</button>
              </div>
            )}
            <ReportChart block={rankBlock} lang={lang} onSelect={pick(rankKey, rankBlock)} selected={selected(rankKey)} />
          </section>
        ) : <Unavailable title={L('أكبر المتأخرات غير المسدّدة', 'Largest unpaid overdue')} reason={U.overdueRank || L('لا بيانات.', 'No data.')} />}
        {charts.planVsActual
          ? <section className="dr-chart" aria-label={charts.planVsActual.title}><ReportChart block={charts.planVsActual} lang={lang} onSelect={pick('plan', charts.planVsActual)} selected={selected('plan')} /></section>
          : <Unavailable title={L('المحصّل مقابل المخطط حتى تاريخه', 'Collected against the plan to date')} reason={U.planVsActual || L('لا مخطط قابل للمقارنة.', 'No comparable plan.')} />}
        {charts.aging
          ? <section className="dr-chart" aria-label={charts.aging.title}><ReportChart block={charts.aging} lang={lang} onSelect={pick('aging', charts.aging)} selected={selected('aging')} /></section>
          : <Unavailable title={L('الرصيد المتأخر حسب عمر التأخر', 'Overdue balance by age past due')} reason={U.aging || L('لا بيانات.', 'No data.')} />}
      </div>
    </section>
  );
}
