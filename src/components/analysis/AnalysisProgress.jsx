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

export default function AnalysisProgress({ task, variant = 'modal', stale = false, onCancel, onBackground, onClose, onView }) {
  const { L, B, ar, lang } = useL();
  if (!task) return null;
  const { total, done, active } = summarizeProgress(task);
  const terminal = isTerminal(task);
  const lastDone = [...task.stages].reverse().find((s) => s.status === 'completed');
  const label = STATUS_LABEL[task.status];
  const stageUnits = active?.units && active.units.total > 0 ? active.units : null;
  const pct = stageUnits ? Math.round((stageUnits.done / stageUnits.total) * 100) : null;
  const warnings = task.warnings || [];
  const failed = task.stages.find((s) => s.status === 'failed');

  const failMsg = failed ? ({
    invalid_period: L('The period is invalid (start is after end). Nothing was calculated.', 'الفترة غير صالحة (البداية بعد النهاية). لم يُحسب شيء.'),
    reconciliation_failed: L('Totals did not reconcile with their breakdowns, so results were withheld.', 'لم تتطابق الإجماليات مع تفصيلاتها، لذلك حُجبت النتائج.'),
    invoice_not_accessible: L('The invoice is not available in your access scope.', 'الفاتورة غير متاحة ضمن نطاق صلاحيتك.'),
    case_not_found: L('The enforcement case was not found.', 'لم يُعثر على قضية الإنفاذ.'),
    baseline_unavailable: L('Not enough history to build the independent baseline, so the scenario cannot be calculated.', 'لا يوجد سجل كافٍ لبناء خط الأساس المستقل، لذا تعذّر احتساب السيناريو.'),
    injected_failure: L('A processing step failed.', 'فشلت خطوة معالجة.')
  }[failed.error] || L('A processing step failed. No results were produced.', 'فشلت خطوة معالجة. لم تُنتج نتائج.')) : null;

  return (
    <div className={`ap ap--${variant} ap--${task.status}`} role="group" aria-label={B(task.title)} data-task-status={task.status}>
      {variant !== 'dock' && (
        <div className="ap__emblem" aria-hidden="true">
          <div className={`ap__orb${task.status === 'running' || task.status === 'queued' ? ' ap__orb--live' : ''}`}>
            {task.status === 'failed' ? (
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 7v6M12 17h.01" /><circle cx="12" cy="12" r="9" /></svg>
            ) : task.status === 'cancelled' ? (
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><rect x="7" y="7" width="10" height="10" rx="2" /></svg>
            ) : terminal ? (
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4L12 3z" /><path d="M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" /></svg>
            )}
          </div>
        </div>
      )}

      <div className="ap__body">
        <div className="ap__eyebrow">
          <span>{L('AI revenue analysis', 'تحليل الإيرادات بالذكاء الاصطناعي')}</span>
          <span className={`ap__chip ap__chip--${task.status}`}>{B(label)}</span>
        </div>
        <div className="ap__title">{B(task.title)}</div>
        <div className="ap__context" dir="auto">{describeScope(task.scope, lang)}</div>

        {!terminal && (
          <div className="ap__current" aria-live="polite">
            {active ? B(active.detail) : lastDone ? `${L('Completed', 'اكتملت')}: ${B(lastDone.label)}` : L('Waiting to start…', 'بانتظار البدء…')}
          </div>
        )}

        {/* Overall: completed-stage count only; no fabricated percentage. */}
        <div className="ap__segments" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label={L(`${done} of ${total} stages completed`, `${done} من ${total} مراحل اكتملت`)}>
          {task.stages.map((s) => <i key={s.id} className={`ap__seg ap__seg--${s.status}`} />)}
        </div>
        <div className="ap__count">
          {L(`${done} of ${total} stages completed`, `اكتملت ${done} من ${total} مراحل`)}
          {active && <span> · {L('Active', 'النشطة')}: {B(active.label)}</span>}
        </div>
        {stageUnits && !terminal && (
          <div className="ap__units" aria-live="polite">
            <div className="ap__unitbar"><i style={{ width: `${pct}%` }} /></div>
            <span dir="ltr">{stageUnits.done} / {stageUnits.total} {L('records', 'سجلات')} · {pct}%</span>
          </div>
        )}

        <ol className="ap__stages">
          {task.stages.map((s, i) => (
            <li key={s.id} className={`ap__stage ap__stage--${s.status}`} aria-current={s.status === 'active' ? 'step' : undefined}>
              <span className="ap__stageicon"><StageIcon status={s.status} index={i} /></span>
              <span className="ap__stagetext">
                <b>{B(s.label)}</b>
                <small>{s.status === 'skipped' && s.skipNote ? B(s.skipNote) : s.status === 'completed' && s.detail ? B(s.detail) : s.status === 'active' ? B(s.active) : B(STAGE_STATE_LABEL[s.status])}</small>
              </span>
              <em className="ap__stagestate">{B(STAGE_STATE_LABEL[s.status])}</em>
            </li>
          ))}
        </ol>

        {warnings.length > 0 && (
          <ul className="ap__warnings" aria-label={L('Data warnings', 'تنبيهات البيانات')}>
            {warnings.slice(0, variant === 'inline' ? 2 : 6).map((w, i) => (
              <li key={i}><span aria-hidden="true">!</span>{B(w.text)}</li>
            ))}
            {warnings.length > (variant === 'inline' ? 2 : 6) && <li className="ap__more">+{warnings.length - (variant === 'inline' ? 2 : 6)} {L('more', 'أخرى')}</li>}
          </ul>
        )}
        {failMsg && <div className="ap__fail" role="alert">{failMsg}</div>}
        {task.status === 'cancelled' && <div className="ap__fail ap__fail--soft">{L('Cancelled by the user. No results were produced; completed stages above were not saved as findings.', 'ألغاها المستخدم. لم تُنتج نتائج؛ ولم تُحفظ المراحل المكتملة أعلاه كنتائج.')}</div>}
        {stale && terminal && <div className="ap__stale">{L('Filters or data changed after this analysis ran — re-run it before relying on it.', 'تغيّرت المرشحات أو البيانات بعد تشغيل هذا التحليل — أعد تشغيله قبل الاعتماد عليه.')}</div>}

        <div className="ap__foot">
          <span className="ap__demo" title={task.paced ? L('Stage display is paced for readability; the calculations themselves run on in-browser illustrative data.', 'عرض المراحل مُبطَّأ للقراءة؛ أما الحسابات فتجري على بيانات توضيحية داخل المتصفح.') : ''}>
            {L('Demo mode · simulated execution on illustrative data', 'وضع العرض · تنفيذ محاكى على بيانات توضيحية')}
          </span>
          <span className="ap__actions">
            {!terminal && onBackground && variant === 'modal' && task.kind !== 'invoice' && (
              <button type="button" className="ap__btn" onClick={onBackground}>{L('Run in background', 'تشغيل في الخلفية')}</button>
            )}
            {!terminal && task.cancellable && onCancel && (
              <button type="button" className="ap__btn ap__btn--danger" onClick={onCancel}>{L('Cancel', 'إلغاء')}</button>
            )}
            {terminal && task.result && onView && (
              <button type="button" className="ap__btn ap__btn--primary" onClick={onView}>{L('View results', 'عرض النتائج')}</button>
            )}
            {terminal && onClose && (
              <button type="button" className="ap__btn" onClick={onClose}>{L('Close', 'إغلاق')}</button>
            )}
          </span>
        </div>
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
    <div className="ap-overlay" role="dialog" aria-modal="true" aria-label="AI analysis progress" onMouseDown={(e) => { if (e.target === e.currentTarget && isTerminal(task)) onClose?.(); }}>
      <div ref={ref} tabIndex={-1} className="ap-dialog">
        <AnalysisProgress task={task} variant="modal" stale={stale} onCancel={onCancel} onBackground={onBackground} onClose={onClose} onView={onView} />
      </div>
    </div>
  );
}
