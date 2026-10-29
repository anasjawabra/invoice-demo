import { localize } from '../../utils/zh';
import { localizedObject } from '../../utils/zh';
import UISymbol from '../UISymbol';
// Pieces of the Decision Room: one expandable item (what, how much, evidence, cause, recommendation, the person's actions and the history).
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAr } from '../../utils/useAr';
import { CATEGORIES, LANES, ROLES, BASES } from '../../data/decisionRoom';
import { STATUSES, ALLOWED, REASON_REQUIRED, dueDateOf } from '../../data/decisionStore';
import { fmtDateText } from '../../data/clock';

const CAUSE = { confirmed: { ar: 'مثبت', en: 'Established' }, hypothesis: { ar: 'فرضية', en: 'Hypothesis' }, unknown: { ar: 'غير مسجل', en: 'Not recorded' } };
const ERR = { reason_required: { ar: 'السبب إلزامي للتأجيل والرفض.', en: 'A reason is required to defer or reject.' }, not_allowed: { ar: 'هذا الانتقال غير مسموح في دورة الحالة.', en: 'This change is not allowed in the lifecycle.' }, owner_required: { ar: 'اختر المسؤول.', en: 'Choose an owner.' }, due_required: { ar: 'حدّد تاريخ الاستحقاق.', en: 'Set a due date.' }, text_required: { ar: 'اكتب الملاحظة.', en: 'Write the note.' }, no_permission: { ar: 'دورك للقراءة فقط.', en: 'Your role is read-only.' } };
export const scoreTone = (s) => (s >= 0.6 ? 'high' : s >= 0.35 ? 'mid' : 'low');

export function useFmt() {
  const { L, ar, lang, short, count } = useAr();
  const B = (o) => (localizedObject(o, lang));
  const fig = (f) => {
    if (f.value == null || (typeof f.value === 'number' && !Number.isFinite(f.value))) return L('غير متاح', 'n/a');
    if (f.kind === 'money') return short(f.value);
    if (f.kind === 'pct') return `${(f.value * 100).toFixed(1)}%`;
    if (f.kind === 'pp') return `${f.value >= 0 ? '+' : '−'}${Math.abs(f.value).toFixed(1)}`;
    return count(f.value);
  };
  return { L, ar, lang, short, count, B, fig };
}

export function ItemRow({ it, D, open, onToggle }) {
  const { L, ar, lang, short, B, fig } = useFmt();
  const [owner, setOwner] = useState(it.state?.owner || it.role || 'finance'); const [due, setDue] = useState(it.state?.due || dueDateOf(D.today, it.dueDays || 30));
  const [reason, setReason] = useState(''); const [note, setNote] = useState(''); const [msg, setMsg] = useState('');
  const run = (r) => { setMsg(r.ok ? '' : B(ERR[r.error] || { ar: 'تعذّر التنفيذ.', en: 'Could not complete.' })); return r; };
  const next = (ALLOWED[it.status] || []);
  const dateText = (iso) => fmtDateText(String(iso).slice(0, 10), lang);
  const roleName = (k) => (ROLES[k] ? B(ROLES[k]) : k);
  return (
    <article className={`dr-item dr-item--${scoreTone(it.score)}${open ? ' is-open' : ''}`} aria-label={B(it.title)}>
      <button type="button" className="dr-item__head" aria-expanded={open} onClick={onToggle}>
        <span className={`dr-score dr-score--${scoreTone(it.score)}`} title={L('درجة الأولوية', 'Priority score')} dir="ltr">{it.resolvedByData ? '—' : it.score.toFixed(2)}</span>
        <span className="dr-item__main"><b>{B(it.title)}</b>
          <small>{B(CATEGORIES[it.category])}{it.amanah ? ` · ${localize(D.labels.amanah(it.amanah)[ar ? 'ar' : 'en'], lang)}` : ''}{it.source ? ` · ${localize(D.labels.source(it.source)[ar ? 'ar' : 'en'], lang)}` : ''}</small></span>
        <span className="dr-item__amt" dir="ltr">{it.amount != null ? short(it.amount) : '—'}</span>
        <span className={`dr-status dr-status--${it.status}`}>{B(STATUSES[it.status])}</span>
        <span className="dr-item__owner">{it.state?.owner ? <>{roleName(it.state.owner)}{it.state.due ? <small className={it.overdueAction ? 'is-late' : ''}> · {dateText(it.state.due)}</small> : null}</> : <small className="muted">{L('بلا مسؤول', 'No owner')}</small>}</span>
      </button>
      {open && (
        <div className="dr-item__body">
          {it.resolvedByData && <div className="rv-callout">{L('لم يعد الشرط قائماً في البيانات الحالية. يبقى السجل محفوظاً.', 'The condition no longer holds in the current data. The history is kept.')}</div>}
          {it.problem && <p className="dr-problem">{B(it.problem)}</p>}
          {it.figures.length > 0 && <dl className="dr-figs">{it.figures.map((f) => <div key={f.label.en}><dt>{B(f.label)}</dt><dd dir="ltr">{fig(f)}</dd></div>)}</dl>}
          {it.basis && <div className="muted dr-basis">{L('أساس القياس', 'Measured on')}: {B(BASES[it.basis])}{basisRange(it, D, lang) ? ` · ${basisRange(it, D, lang)}` : ''}</div>}
          {it.cause && <div className="dr-block"><b>{L('السبب', 'Cause')}</b> <span className={`rv-tag${it.cause.status === 'confirmed' ? '' : ' rv-tag--warn'}`}>{B(CAUSE[it.cause.status])}</span><div>{B(it.cause.text)}</div></div>}
          {it.recommendation && <div className="dr-block"><b>{L('التوصية', 'Recommendation')}</b><div>{B(it.recommendation)}</div>{it.decisionNeeded && <div className="dr-decision"><b>{L('القرار المطلوب', 'Decision needed')}:</b> {B(it.decisionNeeded)}</div>}</div>}
          {it.caveat && <div className="muted" style={{ fontSize: 12 }}>{B(it.caveat)}</div>}
          {it.evidence.length > 0 && <div className="dr-block"><b>{L('الأدلة', 'Evidence')}</b><ul className="dr-ev">{it.evidence.map((e) => <li key={e.to}><Link to={e.to}>{B(e.label)}</Link></li>)}</ul></div>}
          {it.why.length > 0 && <div className="dr-why"><b>{L('لماذا هذا الترتيب', 'Why this rank')}</b>{it.why.map((w) => <span key={w.k} className="sr-chip"><em>{B(w.label)}</em> <bdi>{B(w.text)}</bdi></span>)}</div>}
          <div className="muted dr-meta">{L('المسؤول المقترح', 'Proposed owner')}: {roleName(it.role)} · {L('الاستحقاق المقترح', 'Proposed due')}: {L(`خلال ${it.dueDays} يوماً`, `within ${it.dueDays} days`)}</div>

          {!it.resolvedByData && (D.canReview ? (
            <div className="dr-actions" role="group" aria-label={L('إجراءات البند', 'Item actions')}>
              <div className="dr-actions__row">
                <label className="cg-field" htmlFor={`o-${it.key}`}>{L('المسؤول', 'Owner')}
                  <select id={`o-${it.key}`} className="input" value={owner} onChange={(e) => setOwner(e.target.value)}>{Object.keys(ROLES).map((k) => <option key={k} value={k}>{B(ROLES[k])}</option>)}</select></label>
                <label className="cg-field" htmlFor={`d-${it.key}`}>{L('الاستحقاق', 'Due')}<input id={`d-${it.key}`} type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} /></label>
                <button type="button" className="btn btn-sm" onClick={() => run(D.assign(it, { owner, assignee: D.by, due }))}>{L('إسناد', 'Assign')}</button>
              </div>
              {next.length > 0 && (
                <div className="dr-actions__row">
                  <label className="cg-field" htmlFor={`r-${it.key}`}>{L('السبب (إلزامي للتأجيل والرفض)', 'Reason (required to defer or reject)')}<input id={`r-${it.key}`} className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
                  {next.map((to) => <button key={to} type="button" className={`btn btn-sm${to === 'completed' ? ' btn-primary' : ''}`} onClick={() => { const r = run(D.setStatus(it, to, reason)); if (r.ok) setReason(''); }}>{to === 'in_progress' ? L('تسجيل قرار: قيد التنفيذ', 'Decide: in progress') : to === 'completed' ? L('إكمال', 'Complete') : to === 'deferred' ? L('تأجيل', 'Defer') : L('رفض', 'Reject')}{REASON_REQUIRED.includes(to) ? '*' : ''}</button>)}
                </div>
              )}
              <div className="dr-actions__row">
                <label className="cg-field" htmlFor={`n-${it.key}`}>{L('ملاحظة', 'Note')}<input id={`n-${it.key}`} className="input" value={note} onChange={(e) => setNote(e.target.value)} /></label>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => { const r = run(D.note(it, note)); if (r.ok) setNote(''); }}>{L('إضافة ملاحظة', 'Add note')}</button>
              </div>
              {msg && <div className="rv-callout rv-callout--warn" role="alert">{msg}</div>}
            </div>
          ) : <div className="muted" style={{ fontSize: 12 }}>{L('دورك للقراءة فقط: لا يمكنك الإسناد أو القرار.', 'Your role is read-only: you cannot assign or decide.')}</div>)}

          {(it.state?.history || []).length > 0 && (
            <div className="dr-block"><b>{L('السجل', 'History')}</b>
              <ol className="dr-hist">{[...it.state.history].reverse().map((h, i) => <li key={i}><span className="muted">{dateText(h.at)} · {h.by}</span> — {h.action === 'assign' ? L(`إسناد إلى ${roleName(h.owner)}، الاستحقاق ${dateText(h.due)}`, `assigned to ${roleName(h.owner)}, due ${dateText(h.due)}`) : h.action === 'status' ? <>{L('الحالة', 'status')}: {B(STATUSES[h.from])}<UISymbol name="left" />{B(STATUSES[h.to])}{h.reason ? ` (${h.reason})` : ''}</> : h.text}</li>)}</ol>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
// the period is stated only where the amount IS measured on the selected period; the other bases state their own reference
function basisRange(it, D, lang) { return it.basis === 'period' ? `${fmtDateText(it.period.from, lang)} – ${fmtDateText(it.period.to, lang)}` : it.basis === 'standing' ? fmtDateText(D.today, lang) : it.basis === 'plan' ? String(D.today.slice(0, 4)) : ''; }
export { LANES };
