import React, { useEffect, useRef } from 'react';
import { useRevenue } from '../../context/RevenueContext';
import { useL } from '../../utils/bi';
import AnalysisProgress, { AnalysisModal, isTerminal, summarizeProgress } from './AnalysisProgress';
import AnalysisResultView from './AnalysisResultView';

/* Persistent task panel: lists running / finished analyses so longer tasks can
   continue in the background and results stay reachable. */
function TaskDock() {
  const { tasks, cancelTask, dismissTask, openTask, viewResult, modalTaskId, resultTaskId } = useRevenue();
  const { L, B } = useL();
  const [open, setOpen] = React.useState(false);
  const visible = tasks.filter((t) => t.background || isTerminal(t) || t.status === 'running');
  const shown = visible.filter((t) => (t.background || isTerminal(t)) && !t.inline && t.id !== modalTaskId && t.id !== resultTaskId);
  const running = shown.filter((t) => !isTerminal(t)).length;
  // Stay out of the way when only finished tasks are listed; open itself when work is running in the background.
  React.useEffect(() => { if (running > 0) setOpen(true); }, [running]);
  if (!shown.length) return null;
  return (
    <aside className="dock" aria-label={L('Analysis tasks', 'مهام التحليل')}>
      <button type="button" className="dock__head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className={`dock__dot${running ? ' dock__dot--live' : ''}`} aria-hidden="true" />
        <b>{L('Analysis tasks', 'مهام التحليل')}</b>
        <span className="dock__n">{running ? L(`${running} running`, `${running} قيد التنفيذ`) : shown.length}</span>
      </button>
      {open && (
        <ul className="dock__list">
          {shown.map((t) => {
            const { total, done, active } = summarizeProgress(t);
            return (
              <li key={t.id} className={`dock__item dock__item--${t.status}`}>
                <div className="dock__row">
                  <b>{B(t.title)}</b>
                  <span className={`ap__chip ap__chip--${t.status}`}>{t.status === 'completed_with_limitations' ? L('Completed · limits', 'اكتمل · قيود') : t.status === 'running' ? L('Running', 'قيد التنفيذ') : t.status === 'queued' ? L('Queued', 'في الانتظار') : t.status === 'failed' ? L('Failed', 'فشل') : t.status === 'cancelled' ? L('Cancelled', 'أُلغي') : L('Completed', 'اكتمل')}</span>
                </div>
                <div className="dock__sub">
                  {isTerminal(t) ? L(`${done} of ${total} stages completed`, `اكتملت ${done} من ${total}`) : `${L('Active', 'النشطة')}: ${active ? B(active.label) : '—'} · ${done}/${total}`}
                </div>
                <div className="ap__segments ap__segments--mini">{t.stages.map((s) => <i key={s.id} className={`ap__seg ap__seg--${s.status}`} />)}</div>
                <div className="dock__acts">
                  {!isTerminal(t) && <button type="button" className="ap__btn" onClick={() => openTask(t.id)}>{L('Details', 'التفاصيل')}</button>}
                  {!isTerminal(t) && <button type="button" className="ap__btn ap__btn--danger" onClick={() => cancelTask(t.id)}>{L('Cancel', 'إلغاء')}</button>}
                  {isTerminal(t) && t.result && <button type="button" className="ap__btn ap__btn--primary" onClick={() => viewResult(t.id)}>{L('View results', 'عرض النتائج')}</button>}
                  {isTerminal(t) && !t.result && <button type="button" className="ap__btn" onClick={() => openTask(t.id)}>{L('Details', 'التفاصيل')}</button>}
                  {isTerminal(t) && <button type="button" className="ap__btn" onClick={() => dismissTask(t.id)} aria-label={L('Dismiss', 'إخفاء')}>×</button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

function ResultDrawer() {
  const { tasks, resultTaskId, closeResult, isStale } = useRevenue();
  const { L, B } = useL();
  const task = tasks.find((t) => t.id === resultTaskId);
  const ref = useRef(null);
  useEffect(() => {
    if (!task) return undefined;
    const prev = document.activeElement;
    ref.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') closeResult(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!task) return null;
  return (
    <div className="ap-overlay ap-overlay--side" onMouseDown={(e) => { if (e.target === e.currentTarget) closeResult(); }}>
      <aside ref={ref} tabIndex={-1} className="resdrawer" role="dialog" aria-modal="true" aria-label={B(task.title)}>
        <header className="resdrawer__head">
          <div><div className="ap__eyebrow"><span>{L('Analysis result', 'نتيجة التحليل')}</span></div><b>{B(task.title)}</b></div>
          <button type="button" className="ap__btn" onClick={closeResult}>{L('Close', 'إغلاق')}</button>
        </header>
        <div className="resdrawer__body">
          <AnalysisResultView result={task.result} task={task} stale={isStale(task)} />
        </div>
      </aside>
    </div>
  );
}

export default function AnalysisHost() {
  const { tasks, modalTaskId, cancelTask, sendToBackground, closeModal, viewResult, isStale } = useRevenue();
  const task = tasks.find((t) => t.id === modalTaskId);
  return (
    <>
      <AnalysisModal
        task={task}
        stale={task ? isStale(task) : false}
        onCancel={() => task && cancelTask(task.id)}
        onBackground={() => task && sendToBackground(task.id)}
        onClose={closeModal}
        onView={() => task && viewResult(task.id)}
      />
      <ResultDrawer />
      <TaskDock />
    </>
  );
}

export { AnalysisProgress };
