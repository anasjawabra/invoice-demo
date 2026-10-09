// Decisions and follow-up: proposals awaiting review, and the register of committed actions with owner, due date, status, outcome and history.
// Only users with review permission can approve, assign or change; nothing is assigned automatically; every change is logged.
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAr } from '../../utils/useAr';
import { fmtMoney } from '../../utils/money';
import { fmtEvidence } from '../../data/reportFormat';
import { STATUSES, STATUS_LABEL, PRIORITY_LABEL, createAction, updateAction, rejectProposal, pendingProposals, isOverdue } from '../../data/actionRegister';

const tx = (v, ar) => (v == null ? '' : typeof v === 'string' ? v : ar ? v.ar : v.en);

function Evidence({ ev, ar, lang }) {
  if (!ev) return null;
  return (
    <div className="muted" style={{ fontSize: 12 }}>
      <div>{tx(ev.text, ar)}{ev.scope ? ` — ${ev.scope}` : ''}</div>
      {ev.figures?.length > 0 && <div className="rv-insight__ev">{ev.figures.map((e, i) => <span key={i}>{tx(e.k, ar)}: <b dir="ltr">{fmtEvidence(e, lang)}</b></span>)}</div>}
    </div>
  );
}
const impactText = (ei, ar, lang) => (!ei || ei.amount == null ? '—' : `${fmtMoney(ei.amount, { lang })} (${ei.kind === 'upper_bound' ? (ar ? 'سقف أعلى' : 'upper bound') : (ar ? 'تقدير' : 'estimate')})`);

export default function ActionRegister({ register, setRegister, proposals, canEdit, user, today, scopeText }) {
  const { L, ar, lang } = useAr();
  const [open, setOpen] = useState(null); // proposal id being approved
  const [form, setForm] = useState({ owner: '', dueDate: '', priority: 'medium', note: '' });
  const [manual, setManual] = useState(false);
  const [mf, setMf] = useState({ title: '', issue: '', action: '', owner: '', dueDate: '', priority: 'medium', impact: '' });
  const [filter, setFilter] = useState('open');
  const [outcome, setOutcome] = useState(null); // action id
  const [of, setOf] = useState({ amount: '', note: '' });
  const pend = useMemo(() => pendingProposals(register, proposals), [register, proposals]);
  const by = user?.name || user?.email || L('مستخدم', 'user');
  const shown = register.actions.filter((a) => (filter === 'all' ? true : filter === 'open' ? a.status === 'approved' || a.status === 'in_progress' : a.status === filter));
  const lock = !canEdit; const lockTitle = lock ? L('يتطلب صلاحية المراجعة', 'Requires review permission') : '';

  const approve = (p) => { setRegister((r) => createAction(r, { by, proposal: p, fields: { owner: form.owner, dueDate: form.dueDate || null, priority: form.priority } })); setOpen(null); setForm({ owner: '', dueDate: '', priority: 'medium', note: '' }); };
  const reject = (p) => { const reason = window.prompt(L('سبب الرفض (اختياري):', 'Reason for rejecting (optional):')) ?? null; if (reason === null) return; setRegister((r) => rejectProposal(r, p, by, reason)); };
  const addManual = () => {
    if (!mf.title.trim()) return;
    setRegister((r) => createAction(r, { by, fields: { title: mf.title.trim(), issue: mf.issue.trim(), action: mf.action.trim(), owner: mf.owner, dueDate: mf.dueDate || null, priority: mf.priority, expectedImpact: mf.impact ? { amount: Number(mf.impact), kind: 'estimate', note: L('مُدخل يدوياً', 'entered manually') } : null, evidence: { text: L(`أُدخل يدوياً أثناء مراجعة ${scopeText}`, `Entered manually while reviewing ${scopeText}`), figures: [] } } }));
    setMf({ title: '', issue: '', action: '', owner: '', dueDate: '', priority: 'medium', impact: '' }); setManual(false);
  };

  return (
    <div className="st-grid" style={{ gridTemplateColumns: '1fr' }}>
      <div className="card st-card">
        <div className="st-section__title" style={{ fontSize: 16 }}>{L('مقترحات بانتظار المراجعة', 'Proposals awaiting review')} <small>{pend.length}</small></div>
        <div className="muted" style={{ fontSize: 12.5 }}>{L('مقترحات محسوبة من بيانات المرشحات الحالية. ليست قرارات ولا مسندة لأحد حتى يعتمدها مراجع ويحدد المسؤول وتاريخ الاستحقاق.', 'Proposals computed from the current filters. They are not decisions and not assigned to anyone until a reviewer approves them and sets the owner and due date.')}</div>
        {lock && <div className="rv-callout rv-callout--warn">{L('صلاحيتك للعرض فقط: الاعتماد والإسناد والتعديل يتطلب صلاحية المراجعة.', 'You have read-only access: approving, assigning and editing need review permission.')}</div>}
        {!pend.length && <div className="rv-empty">{L('لا مقترحات معلّقة لهذا الاختيار.', 'No pending proposals for this selection.')}</div>}
        {pend.map((p) => (
          <article key={p.id} className={`rv-insight rv-insight--${p.priority === 'high' ? 'action' : p.priority === 'medium' ? 'watch' : ''}`}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}><b>{tx(p.title, ar)}</b><span className="st-tag">{tx(PRIORITY_LABEL[p.priority], ar)}</span><span className="st-tag st-tag--warn">{L('مقترح — لم يُعتمد', 'proposed — not approved')}</span></div>
            <div>{tx(p.issue, ar)}</div>
            <div><b>{L('الإجراء المقترح', 'Recommended action')}:</b> {tx(p.action, ar)}</div>
            <Evidence ev={p.evidence} ar={ar} lang={lang} />
            <div className="muted" style={{ fontSize: 12 }}>{L('الأثر المتوقع', 'Expected impact')}: <b dir="ltr">{impactText(p.expectedImpact, ar, lang)}</b> · {tx(p.expectedImpact?.note, ar)} · {L('جهة مقترحة للمراجع', 'Suggested unit for the reviewer')}: {tx(p.suggestedUnit, ar)} · {tx(p.timeframe, ar)}</div>
            {p.drill && <div>{p.drill.to.startsWith('#') ? null : <Link className="btn btn-sm btn-ghost" to={p.drill.to}>{tx(p.drill.label, ar)} {ar ? '←' : '→'}</Link>}</div>}
            {open === p.id ? (
              <div className="st-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
                <div className="st-field"><label htmlFor={`o-${p.id}`}>{L('المسؤول (يحدده المراجع)', 'Owner (set by the reviewer)')}</label><input id={`o-${p.id}`} className="input" value={form.owner} placeholder={L('اسم الجهة أو الشخص', 'Entity or person')} onChange={(e) => setForm({ ...form, owner: e.target.value })} /></div>
                <div className="st-field"><label htmlFor={`d-${p.id}`}>{L('تاريخ الاستحقاق', 'Due date')}</label><input id={`d-${p.id}`} type="date" className="input" min={today} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
                <div className="st-field"><label htmlFor={`p-${p.id}`}>{L('الأولوية', 'Priority')}</label><select id={`p-${p.id}`} className="select" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{tx(v, ar)}</option>)}</select></div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'end' }}><button type="button" className="btn btn-primary btn-sm" onClick={() => approve(p)}>{L('اعتماد كإجراء', 'Approve as an action')}</button><button type="button" className="btn btn-sm btn-ghost" onClick={() => setOpen(null)}>{L('إلغاء', 'Cancel')}</button></div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 6 }}><button type="button" className="btn btn-sm btn-primary" disabled={lock} title={lockTitle} onClick={() => { setOpen(p.id); setForm({ owner: '', dueDate: '', priority: p.priority, note: '' }); }}>{L('مراجعة واعتماد…', 'Review and approve…')}</button><button type="button" className="btn btn-sm btn-ghost" disabled={lock} title={lockTitle} onClick={() => reject(p)}>{L('رفض', 'Reject')}</button></div>
            )}
          </article>
        ))}
      </div>

      <div className="card st-card" id="action-register">
        <div className="st-section__title" style={{ fontSize: 16 }}>{L('سجل الإجراءات', 'Action register')} <small>{register.actions.length}</small></div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {[['open', L('مفتوحة', 'Open')], ['all', L('الكل', 'All')], ['done', L('مكتملة', 'Done')], ['cancelled', L('ملغاة', 'Cancelled')]].map(([k, t]) => <button key={k} type="button" className={`btn btn-sm ${filter === k ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>{t}</button>)}
          <button type="button" className="btn btn-sm" disabled={lock} title={lockTitle} onClick={() => setManual((v) => !v)}>＋ {L('إجراء يدوي', 'Manual action')}</button>
        </div>
        {manual && (
          <div className="st-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div className="st-field"><label htmlFor="m-title">{L('العنوان', 'Title')}</label><input id="m-title" className="input" value={mf.title} onChange={(e) => setMf({ ...mf, title: e.target.value })} /></div>
            <div className="st-field"><label htmlFor="m-issue">{L('المشكلة/الفرصة', 'Issue or opportunity')}</label><input id="m-issue" className="input" value={mf.issue} onChange={(e) => setMf({ ...mf, issue: e.target.value })} /></div>
            <div className="st-field"><label htmlFor="m-act">{L('الإجراء الموصى به', 'Recommended action')}</label><input id="m-act" className="input" value={mf.action} onChange={(e) => setMf({ ...mf, action: e.target.value })} /></div>
            <div className="st-field"><label htmlFor="m-owner">{L('المسؤول', 'Owner')}</label><input id="m-owner" className="input" value={mf.owner} onChange={(e) => setMf({ ...mf, owner: e.target.value })} /></div>
            <div className="st-field"><label htmlFor="m-due">{L('تاريخ الاستحقاق', 'Due date')}</label><input id="m-due" type="date" className="input" min={today} value={mf.dueDate} onChange={(e) => setMf({ ...mf, dueDate: e.target.value })} /></div>
            <div className="st-field"><label htmlFor="m-pr">{L('الأولوية', 'Priority')}</label><select id="m-pr" className="select" value={mf.priority} onChange={(e) => setMf({ ...mf, priority: e.target.value })}>{Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{tx(v, ar)}</option>)}</select></div>
            <div className="st-field"><label htmlFor="m-imp">{L('الأثر المتوقع (SAR، اختياري)', 'Expected impact (SAR, optional)')}</label><input id="m-imp" type="number" className="input" min="0" value={mf.impact} onChange={(e) => setMf({ ...mf, impact: e.target.value })} /></div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'end' }}><button type="button" className="btn btn-primary btn-sm" disabled={!mf.title.trim()} onClick={addManual}>{L('إضافة', 'Add')}</button></div>
          </div>
        )}
        {!shown.length && <div className="rv-empty">{register.actions.length ? L('لا إجراءات بهذه الحالة.', 'No actions in this state.') : L('لا إجراءات بعد. اعتمد مقترحاً أو أضف إجراءً يدوياً؛ ما يُسجَّل هنا محفوظ في هذا المتصفح فقط.', 'No actions yet. Approve a proposal or add one manually; what is recorded here is stored in this browser only.')}</div>}
        {shown.map((a) => {
          const late = isOverdue(a, today);
          return (
            <article key={a.id} className="rv-insight">
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <b>{tx(a.title, ar)}</b><span className="st-tag">{a.id}</span><span className="st-tag">{tx(PRIORITY_LABEL[a.priority], ar)}</span>{late && <span className="st-tag st-tag--scenario">{L('متأخر عن الاستحقاق', 'Past due')}</span>}
                {a.source === 'manual' && <span className="st-tag">{L('يدوي', 'manual')}</span>}
              </div>
              {a.issue && <div>{tx(a.issue, ar)}</div>}
              {a.action && <div><b>{L('الإجراء', 'Action')}:</b> {tx(a.action, ar)}</div>}
              <Evidence ev={a.evidence} ar={ar} lang={lang} />
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13 }}>
                <span>{L('المسؤول', 'Owner')}: <b>{a.owner || L('غير مسند', 'unassigned')}</b></span>
                <span>{L('الاستحقاق', 'Due')}: <b dir="ltr">{a.dueDate || L('غير محدد', 'not set')}</b></span>
                <span>{L('الأثر المتوقع', 'Expected impact')}: <b dir="ltr">{impactText(a.expectedImpact, ar, lang)}</b></span>
                {a.outcome && <span>{L('النتيجة الفعلية', 'Actual outcome')}: <b dir="ltr">{a.outcome.amount != null ? fmtMoney(a.outcome.amount, { lang }) : '—'}</b> {a.outcome.note}</span>}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <label className="muted" htmlFor={`s-${a.id}`} style={{ fontSize: 12 }}>{L('الحالة', 'Status')}</label>
                <select id={`s-${a.id}`} className="select" value={a.status} disabled={lock} title={lockTitle} onChange={(e) => { const v = e.target.value; if (v === 'done') { setOutcome(a.id); setOf({ amount: '', note: '' }); } setRegister((r) => updateAction(r, a.id, { status: v }, by)); }}>{STATUSES.map((s) => <option key={s} value={s}>{tx(STATUS_LABEL[s], ar)}</option>)}</select>
                <input aria-label={L('المسؤول', 'Owner')} className="input" style={{ width: 150 }} placeholder={L('إسناد المسؤول', 'Assign owner')} disabled={lock} defaultValue={a.owner || ''} onBlur={(e) => { if ((e.target.value || '') !== (a.owner || '')) setRegister((r) => updateAction(r, a.id, { owner: e.target.value }, by)); }} />
                <input aria-label={L('تاريخ الاستحقاق', 'Due date')} type="date" className="input" disabled={lock} value={a.dueDate || ''} onChange={(e) => setRegister((r) => updateAction(r, a.id, { dueDate: e.target.value || null }, by))} />
                {a.drill && !a.drill.to.startsWith('#') && <Link className="btn btn-sm btn-ghost" to={a.drill.to}>{L('الدليل', 'Evidence')}</Link>}
              </div>
              {outcome === a.id && (
                <div className="st-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                  <div className="st-field"><label htmlFor={`oa-${a.id}`}>{L('المبلغ المحقق فعلاً (SAR، اختياري)', 'Amount actually achieved (SAR, optional)')}</label><input id={`oa-${a.id}`} type="number" className="input" min="0" value={of.amount} onChange={(e) => setOf({ ...of, amount: e.target.value })} /></div>
                  <div className="st-field"><label htmlFor={`on-${a.id}`}>{L('ملاحظة النتيجة', 'Outcome note')}</label><input id={`on-${a.id}`} className="input" value={of.note} onChange={(e) => setOf({ ...of, note: e.target.value })} /></div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'end' }}><button type="button" className="btn btn-sm btn-primary" onClick={() => { setRegister((r) => updateAction(r, a.id, { outcome: { amount: of.amount === '' ? null : Number(of.amount), note: of.note, at: new Date().toISOString() } }, by)); setOutcome(null); }}>{L('تسجيل النتيجة', 'Record outcome')}</button></div>
                </div>
              )}
              <details><summary className="muted" style={{ fontSize: 12 }}>{L(`سجل التغييرات (${a.history.length})`, `Change history (${a.history.length})`)}</summary>
                <ul className="res__list res__list--plain" style={{ fontSize: 12 }}>{a.history.slice().reverse().map((h, i) => <li key={i} dir="auto">{h.at.slice(0, 16).replace('T', ' ')} · {h.by} · {h.field}: {JSON.stringify(h.from)} → {JSON.stringify(h.to)} {h.note}</li>)}</ul>
              </details>
            </article>
          );
        })}
        {register.rejected.length > 0 && <details><summary className="muted" style={{ fontSize: 12 }}>{L(`مقترحات مرفوضة (${register.rejected.length})`, `Rejected proposals (${register.rejected.length})`)}</summary><ul className="res__list res__list--plain" style={{ fontSize: 12 }}>{register.rejected.map((r, i) => <li key={i}>{r.at.slice(0, 10)} · {r.by} · {tx(r.title, ar)} {r.reason ? `— ${r.reason}` : ''}</li>)}</ul></details>}
      </div>
    </div>
  );
}
