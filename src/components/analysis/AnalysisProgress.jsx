import React, { useEffect, useRef } from 'react';
import { useL } from '../../utils/bi';
import { describeScope } from '../../data/revenueInsights';

const STATUS_LABEL = {
  queued: { en: 'Queued', ar: 'في الانتظار' },
  running: { en: 'Running', ar: 'قيد التنفيذ' },
  completed: { en: 'Completed', ar: 'اكتمل' },
  completed_with_limitations: { en: 'Completed with data limitations', ar: 'اكتمل مع قيود في البيانات' },
  failed: { en: 'Failed', ar: 'فشل' },
  cancelled: { en: 'Cancelled', ar: 'أُلغي' }
};

const STAGE_STATE_LABEL = {
  upcoming: { en: 'Upcoming', ar: 'قادمة' },
  active: { en: 'In progress', ar: 'جارية' },
  completed: { en: 'Done', ar: 'تمت' },
  failed: { en: 'Failed', ar: 'فشلت' },
  skipped: { en: 'Skipped', ar: 'تم تخطيها' },
  cancelled: { en: 'Cancelled', ar: 'أُلغيت' },
  not_run: { en: 'Not run', ar: 'لم تُنفّذ' }
};

export const isTerminal = (task) => ['completed', 'completed_with_limitations', 'failed', 'cancelled'].includes(task.status);

function StageIcon({ status, index }) {
  if (status === 'completed') return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
  if (status === 'failed') return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>;
  if (status === 'skipped' || status === 'not_run') return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="M6 12h12" /></svg>;
  if (status === 'cancelled') return <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>;
  if (status === 'active') return <span className="ap-spin" aria-hidden="true" />;
  return <span className="ap-num">{index + 1}</span>;
}

export function summarizeProgress(task) {
  const total = task.stages.length;
  const done = task.stages.filter((s) => s.status === 'completed' || s.status === 'skipped').length;
  const activeIdx = task.stages.findIndex((s) => s.status === 'active');
  const active = activeIdx >= 0 ? task.stages[activeIdx] : null;
  return { total, done, activeIdx, active };
}

const CHIP_LABEL = {
  queued: { en: 'Preparing analysis', ar: 'جارٍ تحضير التحليل' },
  running: { en: 'Preparing analysis', ar: 'جارٍ تحضير التحليل' },
  completed: { en: 'Completed', ar: 'اكتمل' },
  completed_with_limitations: { en: 'Completed with limitations', ar: 'اكتمل مع قيود' },
  failed: { en: 'Failed', ar: 'فشل' },
  cancelled: { en: 'Cancelled', ar: 'أُلغي' }
};

// A compact progress card: the name of the analysis (never «analysis in progress» on a finished report), one status chip, only the stages that really ran or are running,
// a count of material issues with the details behind a fold. No orb, no demo-mode footer, no percentage that is not a count of real work.
export default function AnalysisProgress({ task, variant = 'modal', stale = false, onCancel, onBackground, onClose, onView }) {
  const { L, B, lang } = useL();
  if (!task) return null;
  const terminal = isTerminal(task);
  const ran = task.stages.filter((s) => s.status !== 'skipped' && s.status !== 'not_run');
  const done = ran.filter((s) => s.status === 'completed').length;
  const active = task.stages.find((s) => s.status === 'active');
  const stageUnits = active?.units && active.units.total > 0 ? active.units : null;
  const issues = task.warnings || [];
  const failed = task.stages.find((s) => s.status === 'failed');
  const failMsg = failed ? ({
    invalid_period: L('The period is invalid (start is after end). Nothing was calculated.', 'الفترة غير صالحة (البداية بعد النهاية). لم يُحسب شيء.'),
    reconciliation_failed: L('Totals did not reconcile with their breakdowns, so results were withheld.', 'لم تتطابق الإجماليات مع تفصيلاتها، لذلك حُجبت النتائج.'),
    invoice_not_accessible: L('The invoice is not available in your access scope.', 'الفاتورة غير متاحة ضمن نطاق صلاحيتك.'),
    case_not_found: L('The enforcement case was not found.', 'لم يُعثر على قضية الإنفاذ.'),
    baseline_unavailable: L('Not enough history to build the independent baseline, so the scenario cannot be calculated.', 'لا يوجد سجل كافٍ لبناء خط الأساس المستقل، لذا تعذّر احتساب السيناريو.'),
    injected_failure: L('A processing step failed.', 'فشلت خطوة معالجة.')
  }[failed.error] || L('A processing step failed. No results were produced.', 'فشلت خطوة معالجة. لم تُنتج نتائج.')) : null;
  const name = B(task.resultTitle || task.title);
  const shown = ran.length ? ran : task.stages.slice(0, 1);

  return (
    <div className={`pg pg--${variant} pg--${task.status}`} role="group" aria-label={name} data-task-status={task.status}>
      <div className="pg__head">
        <div className="pg__titles"><div className="pg__title">{name}</div><div className="pg__ctx" dir="auto">{describeScope(task.scope, lang)}</div></div>
        <span className={`pg__chip pg__chip--${task.status}`} role="status">{B(CHIP_LABEL[task.status])}</span>
      </div>
      <ol className="pg__stages">
        {shown.map((s, i) => (
          <li key={s.id} className={`pg__stage pg__stage--${s.status}`} aria-current={s.status === 'active' ? 'step' : undefined}>
            <span className="pg__ico"><StageIcon status={s.status} index={i} /></span>
            <span className="pg__txt"><b>{B(s.label)}</b>{(s.status === 'completed' && s.detail) ? <small>{B(s.detail)}</small> : s.status === 'active' ? <small>{B(s.active)}{stageUnits ? ` · ${stageUnits.done} / ${stageUnits.total}` : ''}</small> : null}</span>
          </li>
        ))}
      </ol>
      {terminal && <div className="pg__count">{L(`${done} of ${ran.length} stages completed`, `اكتملت ${done} من ${ran.length} مراحل`)}</div>}
      {issues.length > 0 && (
        <details className="pg__issues">
          <summary>{L(`${issues.length} material issue(s)`, `${issues.length} ملاحظة جوهرية`)}</summary>
          <ul>{issues.map((w, i) => <li key={i}>{B(w.text)}</li>)}</ul>
        </details>
      )}
      {failMsg && <div className="pg__fail" role="alert">{failMsg}</div>}
      {task.status === 'cancelled' && <div className="pg__fail pg__fail--soft">{L('Cancelled. No results were produced.', 'أُلغي التحليل. لم تُنتج نتائج.')}</div>}
      {stale && terminal && <div className="pg__stale">{L('Filters or data changed after this analysis ran — run it again before relying on it.', 'تغيّرت التصفية أو البيانات بعد تشغيل هذا التحليل — أعد تشغيله قبل الاعتماد عليه.')}</div>}
      <div className="pg__actions">
        {!terminal && onBackground && variant === 'modal' && task.kind !== 'invoice' && <button type="button" className="btn btn-sm" onClick={onBackground}>{L('Run in background', 'تشغيل في الخلفية')}</button>}
        {!terminal && task.cancellable && onCancel && <button type="button" className="btn btn-sm" onClick={onCancel}>{L('Cancel', 'إلغاء')}</button>}
        {terminal && task.result && onView && <button type="button" className="btn btn-sm btn-primary" onClick={onView}>{L('View results', 'عرض النتائج')}</button>}
        {terminal && onClose && <button type="button" className="btn btn-sm" onClick={onClose}>{L('Close', 'إغلاق')}</button>}
      </div>
    </div>
  );
}

/* Modal wrapper for short, explicitly initiated analysis tasks. */
export function AnalysisModal({ task, stale, onCancel, onBackground, onClose, onView }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!task) return undefined;
    const prev = document.activeElement;
    ref.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') { if (isTerminal(task)) onClose?.(); else onBackground?.(); } };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!task) return null;
  return (
    <div className="ap-overlay" role="dialog" aria-modal="true" aria-label="Analysis progress" onMouseDown={(e) => { if (e.target === e.currentTarget && isTerminal(task)) onClose?.(); }}>
      <div ref={ref} tabIndex={-1} className="ap-dialog">
        <AnalysisProgress task={task} variant="modal" stale={stale} onCancel={onCancel} onBackground={onBackground} onClose={onClose} onView={onView} />
      </div>
    </div>
  );
}
