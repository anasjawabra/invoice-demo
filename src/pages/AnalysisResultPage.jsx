import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useRevenue } from '../context/RevenueContext';
import { useL } from '../utils/bi';
import { RecordHeader, RecordState } from '../components/record/RecordPage';
import AnalysisResultView from '../components/analysis/AnalysisResultView';
import { useReturnTarget } from '../utils/returnContext';

// An analysis result as a full page (it used to open in a long side drawer). The result lives in this browser session only: after a refresh it is gone and says so.
export default function AnalysisResultPage() {
  const { taskId: raw } = useParams(); const taskId = decodeURIComponent(raw || '');
  const { tasks, isStale } = useRevenue();
  const { L, B } = useL();
  const ret = useReturnTarget({ path: '/insights', label: L('Dashboards and reports', 'لوحة المعلومات والتقارير') });
  const task = tasks.find((t) => t.id === taskId);
  const crumbs = [{ label: L('Dashboards and reports', 'لوحة المعلومات والتقارير'), to: '/insights' }, { label: L('Analysis result', 'نتيجة التحليل') }];
  if (!task || !task.result) {
    return (
      <div className="rp"><RecordHeader crumbs={crumbs} title={L('Analysis result', 'نتيجة التحليل')} ret={ret} />
        <div className="rp-state rp-state--bad" role="alert">
          <h2 className="rp-h2">{L('This result is no longer available', 'هذه النتيجة لم تعد متاحة')}</h2>
          <p>{L('Analysis results are kept only for the current browser session (they are not saved). Run the analysis again from the page that started it.', 'تُحفظ نتائج التحليل لجلسة المتصفح الحالية فقط (ولا تُخزَّن). شغّل التحليل مجدداً من الصفحة التي بدأته.')}</p>
          <Link className="btn btn-sm btn-primary" to={ret.path}>{ret.label}</Link>
        </div>
      </div>
    );
  }
  return (
    <div className="rp">
      <RecordHeader crumbs={[...crumbs.slice(0, 1), { label: B(task.title) }]} ret={ret} kind={L('Analysis result', 'نتيجة التحليل')} title={B(task.title)} />
      <section className="rp-section"><AnalysisResultView result={task.result} task={task} stale={isStale(task)} /></section>
    </div>
  );
}
