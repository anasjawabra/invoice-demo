// DueBar — the due position of the unpaid invoices (overdue · not yet due · due date unavailable) as ONE compact stacked bar over the NET unpaid amount.
// Every segment is a button: it selects that due state (the page turns it into filters.dueState); the segments add up to the stated total.
import React from 'react';
import { useL } from '../../utils/bi';
import { dueLabel, dueSegments } from './listLogic';

export default function DueBar({ due, selected = null, onSelect, onReset, loading = false, title, caption }) {
  const { L, ar, count: nf, short, sar } = useL();
  const d = dueSegments(due);
  const nonEmpty = d.segments.filter((s) => s.amount > 0);
  return (
    <section className={`card card-pad il-card il-due${selected ? ' il-due--sel' : ''}`} aria-label={title} data-il="due">
      <header className="il-card__head"><h3 className="il-card__title">{title}</h3></header>
      {caption && <p className="il-card__cap muted">{caption}</p>}
      {loading && !due ? <div className="il-skel il-skel--short" aria-busy="true" />
        : !d.available ? <p className="il-na" role="status">{L('Not available for this selection.', 'غير متاح لهذا الاختيار.')}</p>
          : d.total <= 0 ? <p className="il-na" role="status">{L('No unpaid amounts with a due position in this selection.', 'لا توجد مبالغ غير مسدّدة ذات موقف استحقاق في هذا الاختيار.')}</p>
            : (
              <>
                <div className="il-stack" role="group" aria-label={L('Due position of the net unpaid amount', 'موقف الاستحقاق لصافي غير المحصّل')}>
                  {nonEmpty.map((s) => (
                    <button key={s.key} type="button" className={`il-seg il-seg--${s.key}${selected === s.key ? ' is-selected' : ''}`} style={{ flexGrow: s.amount }} aria-pressed={selected === s.key}
                      title={`${dueLabel(s.key, ar)}: ${sar(s.amount)} · ${s.share.toFixed(1)}% · ${nf(s.count)} ${L('invoices', 'فاتورة')}`}
                      aria-label={`${dueLabel(s.key, ar)}: ${short(s.amount)}, ${s.share.toFixed(1)}%, ${nf(s.count)} ${L('invoices', 'فاتورة')}`}
                      onClick={() => (selected === s.key ? onReset() : onSelect(s.key))}>
                      {s.share >= 12 ? <span dir="ltr">{s.share.toFixed(0)}%</span> : null}
                    </button>
                  ))}
                </div>
                <ul className="il-legend">
                  {d.segments.map((s) => (
                    <li key={s.key} className={selected && selected !== s.key ? 'is-dim' : ''}>
                      <i className={`il-dot il-dot--${s.key}`} aria-hidden="true" />
                      <span className="il-legend__l">{dueLabel(s.key, ar)}</span>
                      {s.amount > 0 || s.count > 0
                        ? <span className="il-legend__v"><b dir="ltr" title={sar(s.amount)}>{short(s.amount)}</b> <span className="muted">· {nf(s.count)} {L('invoices', 'فاتورة')} · <bdi>{s.share == null ? '—' : `${s.share.toFixed(1)}%`}</bdi>{s.excludedCount > 0 ? <> · {L(`+${nf(s.excludedCount)} excluded`, `+${nf(s.excludedCount)} مستبعدة`)}</> : null}</span></span>
                        : <span className="il-legend__v muted">{L('none', 'لا شيء')}</span>}
                    </li>
                  ))}
                </ul>
                <p className="il-card__cap muted">{L('Total', 'الإجمالي')}: <b dir="ltr" title={sar(d.total)}>{short(d.total)}</b> · {nf(d.count)} {L('invoices', 'فاتورة')}</p>
                {selected && <div className="il-card__foot"><span className="il-sel" role="status">{L('Selected', 'المحدّد')}: <b>{dueLabel(selected, ar)}</b><button type="button" className="btn btn-sm btn-ghost" onClick={onReset}>{L('Reset', 'إلغاء التحديد')}</button></span></div>}
              </>
            )}
    </section>
  );
}
