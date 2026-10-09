// The active plan: name, owner, period, scope, assumptions and VERSION. Saving freezes a version; an approved plan returns to draft when it changes.
// Plans live apart from actual data and from the unapproved targets: editing a plan or its scenario never changes either.
import React, { useState } from 'react';
import { useAr } from '../../utils/useAr';
import { fmtMoney } from '../../utils/money';
import { PLAN_STATUS, newPlan, saveVersion, patchPlan, editPlan, approvePlan, unsavedChanges } from '../../data/planStore';
import { fmtRiyadh } from '../../data/clock';
import { actorName } from '../../utils/actor';

export default function PlanBar({ store, setStore, plan, summary, scopeSnapshot, canEdit, user, onApplyScope, today }) {
  const { L, B, ar, lang } = useAr();
  const by = actorName(user, lang) || L('مستخدم', 'user');
  const [showVers, setShowVers] = useState(false); const [showHist, setShowHist] = useState(false);
  const setPlan = (fn) => setStore((s) => ({ ...s, plans: s.plans.map((p) => (p.id === plan.id ? fn(p) : p)) }));
  const lock = !canEdit; const lt = lock ? L('يتطلب صلاحية المراجعة', 'Requires review permission') : '';
  const create = () => { const name = window.prompt(L('اسم الخطة:', 'Plan name:'), L(`خطة ${today.slice(0, 4)} — جديدة`, `Plan ${today.slice(0, 4)} — new`)); if (!name) return; const p = newPlan({ by, name, scope: scopeSnapshot, period: { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` } }); setStore((s) => ({ ...s, plans: [p, ...s.plans], activeId: p.id })); };
  return (
    <div className="card st-card" role="region" aria-label={L('الخطة', 'Plan')}>
      <div className="st-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
        <div className="st-field"><label htmlFor="pl-sel">{L('الخطة', 'Plan')}</label><select id="pl-sel" className="select" value={plan.id} onChange={(e) => setStore((s) => ({ ...s, activeId: e.target.value }))}>{store.plans.map((p) => <option key={p.id} value={p.id}>{p.name} · v{p.version}</option>)}</select></div>
        <div className="st-field"><label htmlFor="pl-name">{L('اسم الخطة', 'Plan name')}</label><input id="pl-name" className="input" value={plan.name} disabled={lock} title={lt} onChange={(e) => setPlan((p) => editPlan(p, { name: e.target.value }, by))} /></div>
        <div className="st-field"><label htmlFor="pl-own">{L('مالك الخطة', 'Plan owner')}</label><input id="pl-own" className="input" value={plan.owner || ''} placeholder={L('غير مسند', 'unassigned')} disabled={lock} title={lt} onChange={(e) => setPlan((p) => editPlan(p, { owner: e.target.value }, by))} /></div>
        <div className="st-field"><label>{L('الفترة والنطاق', 'Period and scope')}</label><div style={{ fontSize: 13 }}><bdi dir="ltr">{plan.period.from} → {plan.period.to}</bdi><div className="muted" style={{ fontSize: 11.5 }}>{plan.scope?.label || L('كل الأمانات · كل المصادر', 'All Amanahs · all sources')}</div></div></div>
        <div className="st-field"><label>{L('الإصدار والحالة', 'Version and status')}</label><div><b>{plan.version ? `v${plan.version}` : L('غير محفوظ', 'unsaved')}</b> <span className={`st-tag ${plan.status === 'approved' ? 'st-tag--actual' : 'st-tag--warn'}`}>{B(PLAN_STATUS[plan.status])}{plan.approvedBy ? ` — ${plan.approvedBy}` : ''}</span>{unsavedChanges(plan) && <span className="st-tag st-tag--warn" role="status">{L('تعديلات غير محفوظة في إصدار', 'Changes not saved as a version')}</span>}</div></div>
      </div>
      <div className="st-field"><label htmlFor="pl-as">{L('افتراضات الخطة', 'Plan assumptions')}</label><textarea id="pl-as" className="input" rows={2} disabled={lock} title={lt} value={plan.assumptions} placeholder={L('اكتب الافتراضات الأساسية للخطة (مصدرها، حدودها).', 'Write the plan’s key assumptions (source, limits).')} onChange={(e) => setPlan((p) => editPlan(p, { assumptions: e.target.value }, by))} /></div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="btn btn-sm btn-primary" disabled={lock} title={lt} onClick={() => setPlan((p) => saveVersion(patchPlan({ ...p, owner: (p.owner || '').trim() || null }, { scope: scopeSnapshot }, by), { by, summary }))}>{L('حفظ كإصدار جديد', 'Save as a new version')}</button>
        <button type="button" className="btn btn-sm" disabled={lock || plan.status === 'approved' || !plan.version} title={lock ? lt : !plan.version ? L('احفظ إصداراً أولاً', 'Save a version first') : ''} onClick={() => setPlan((p) => approvePlan(p, by))}>{L('اعتماد الخطة', 'Approve the plan')}</button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={create} disabled={lock} title={lt}>＋ {L('خطة جديدة', 'New plan')}</button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => onApplyScope(plan)}>{L('تطبيق نطاق الخطة على المرشحات', 'Apply the plan scope to the filters')}</button>
        <button type="button" className="btn btn-sm btn-ghost" aria-expanded={showVers} onClick={() => setShowVers((v) => !v)}>{L(`الإصدارات (${plan.versions.length})`, `Versions (${plan.versions.length})`)}</button>
        <button type="button" className="btn btn-sm btn-ghost" aria-expanded={showHist} onClick={() => setShowHist((v) => !v)}>{L('سجل التغييرات', 'Change history')}</button>
      </div>
      <div className="muted" style={{ fontSize: 12 }}>{L('اعتماد الخطة يخص افتراضاتها فقط؛ لا يجعل أي مستهدف معتمداً ولا يغيّر أي بيانات فعلية.', 'Approving a plan concerns its assumptions only; it does not make any target approved and changes no actual data.')}</div>
      {showVers && (plan.versions.length ? <div className="st-table-wrap"><table className="table"><thead><tr><th>{L('الإصدار', 'Version')}</th><th>{L('التاريخ', 'Date')}</th><th>{L('بواسطة', 'By')}</th><th>{L('نسبة التحصيل (سيناريو)', 'Rate (scenario)')}</th><th>{L('المحصّل (سيناريو)', 'Collected (scenario)')}</th><th>{L('الميزان التمويلي المتوقع', 'Projected funding balance')}</th><th /></tr></thead><tbody>{plan.versions.map((v) => <tr key={v.version}><td>v{v.version}</td><td dir="ltr">{fmtRiyadh(v.at)}</td><td>{v.by}</td><td dir="ltr">{v.summary?.rate != null ? `${(v.summary.rate * 100).toFixed(1)}%` : '—'}</td><td dir="ltr">{v.summary?.collected != null ? fmtMoney(v.summary.collected, { lang }) : '—'}</td><td dir="ltr">{v.summary?.balance != null ? fmtMoney(v.summary.balance, { lang }) : L('غير متاح', 'n/a')}</td><td><button type="button" className="btn btn-sm btn-ghost" disabled={lock} onClick={() => setPlan((p) => editPlan(p, { scenario: { ...v.scenario }, planDate: v.planDate, assumptions: v.assumptions }, by))}>{L('استعادة كمسودة', 'Restore as draft')}</button></td></tr>)}</tbody></table></div> : <div className="muted" style={{ fontSize: 12.5 }}>{L('لا إصدارات محفوظة بعد.', 'No saved versions yet.')}</div>)}
      {showHist && <ul className="res__list res__list--plain" style={{ fontSize: 12 }}>{plan.history.slice(0, 30).map((h, i) => <li key={i}>{fmtRiyadh(h.at)} · {h.by} · {h.change} {h.note}</li>)}</ul>}
    </div>
  );
}
