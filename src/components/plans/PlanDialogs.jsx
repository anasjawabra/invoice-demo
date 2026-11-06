// The dialogs of the plan page (docs/revenue-plans-spec.md §10):
//   SaveNameDialog      «اسم الخطة» + «تعيين كخطة افتراضية لي» + حفظ / إلغاء — for a NEW plan, «حفظ كخطة جديدة», the system plan, or a plan the person may not edit. Validates the name and the configuration BEFORE the request,
//                       keeps every entered value when the save fails (the server's messages are shown as validation lines) and, on success, tells the page which plan was created so it can stay selected.
//   ConfirmDialog       «تعيين كخطة مرجعية للتقارير» (a calendar year) · «تعيين كافتراضية» · «تعيين كخطة افتراضية للنظام» (the GLOBAL default; administrators) · leaving with unsaved changes.
// Mutations go through src/api/plansClient.js (the server enforces access, validation and concurrency — nothing is stored client-side). `api` can be injected (tests).
import React, { useMemo, useState } from 'react';
import { useAr } from '../../utils/useAr';
import PlanModal from './PlanModal';
import * as plansClient from '../../api/plansClient';
import { refreshPlans } from '../../data/plans/planStore';
import { nameProblem, clientSaveProblems, requestProblems, pickL, isConflict, userText } from './planUi';
import { submitCreate } from './planActions';

const client = (api) => api || plansClient;

function Problems({ items, lang }) { return items.length ? <ul className="pln-problems" role="alert" id="plan-save-problems">{items.map((p, i) => <li key={i}>{pickL(p.text || p, lang)}</li>)}</ul> : null; }

/**
 * props: content (the working copy to save) · plans (visible plans, for the unique-name rule) · defaultName · copyOf (plan id | null) · context { geoScope, readOnly } for the pre-checks · reason (why a new plan is saved) · onClose · onSaved(plan)
 */
export function SaveNameDialog({ content, plans = [], defaultName = '', copyOf = null, context = {}, reason = null, askDefault = true, onClose, onSaved, api = null }) {
  const { L, lang } = useAr();
  const [name, setName] = useState(defaultName); const [setDefault, setSetDefault] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(null); const [touched, setTouched] = useState(false); const [tried, setTried] = useState(false);
  const nProblem = useMemo(() => nameProblem(name, plans), [name, plans]);
  const cfg = useMemo(() => clientSaveProblems({ ...content, name: name.trim() }, context), [content, name]); // eslint-disable-line react-hooks/exhaustive-deps
  const problems = [...(touched && nProblem ? [{ text: nProblem.text }] : []), ...(tried ? cfg : []), ...(error ? requestProblems(error).map((t) => ({ text: t })) : [])];
  const submit = async () => {
    setTouched(true); setTried(true);
    setBusy(true); setError(null);
    const r = await submitCreate({ api: client(api), name, content, setDefault, copyOf, plans, ctx: context, refresh: refreshPlans }); // nothing is sent while the name or the configuration is invalid; every entered value stays
    if (r.ok) onSaved?.(r.plan); else { setBusy(false); if (r.kind === 'server') setError(r.error); }
  };
  return (
    <PlanModal title={L('حفظ الخطة', 'Save the plan')} subtitle={reason ? pickL(reason, lang) : L('تُحفظ كخطة باسمك وتبقى هي الخطة المختارة.', 'It is saved as a plan of yours and stays the selected plan.')} onClose={busy ? undefined : onClose} dismissible={!busy} size="sm"
      footer={<><button type="button" className="btn" onClick={onClose} disabled={busy}>{L('إلغاء', 'Cancel')}</button><button type="button" className="btn btn-primary" id="plan-save-confirm" onClick={submit} disabled={busy}>{busy ? L('جارٍ الحفظ…', 'Saving…') : L('حفظ', 'Save')}</button></>}>
      <div className="pln-form" id="plan-save-form">
        <label className="pln-field"><span>{L('اسم الخطة', 'Plan name')}</span><input className="pln-input" data-autofocus value={name} maxLength={80} onChange={(e) => setName(e.target.value)} onBlur={() => setTouched(true)} aria-invalid={touched && !!nProblem} /></label>
        {askDefault && <label className="pln-check"><input type="checkbox" checked={setDefault} onChange={(e) => setSetDefault(e.target.checked)} /> {L('تعيين كخطة افتراضية لي', 'Set as my default plan')}</label>}
        <Problems items={problems} lang={lang} />
      </div>
    </PlanModal>
  );
}

/** kind: 'reference' (years + current reference years) · 'default' (the caller's own) · 'sysdefault' (the GLOBAL default plan every user opens) · 'leave' (unsaved changes) · 'discard' */
export function ConfirmDialog({ kind, view, years = [], currentReferenceYears = [], plan, onClose, onDone, onLeave, api = null }) {
  const { L, lang } = useAr(); const [busy, setBusy] = useState(false); const [error, setError] = useState(null); const [year, setYear] = useState(String(years[0] ?? ''));
  const nm = (lang === 'en' && (view?.nameEn || plan?.nameEn)) || view?.name || plan?.name || '';
  const title = kind === 'reference' ? L('تعيين كخطة مرجعية للتقارير', 'Set as the reference plan for reports') : kind === 'default' ? L('تعيين كافتراضية', 'Set as my default plan') : kind === 'sysdefault' ? L('تعيين كخطة افتراضية للنظام', 'Set as the system default plan')
    : kind === 'discard' ? L('تجاهل التغييرات', 'Discard the changes') : L('تغييرات غير محفوظة', 'Unsaved changes');
  const body = kind === 'reference' ? L(`تقرأ التقارير وغرفة القرارات والتقارير الذكية والمساعد هذه الخطة للعام المختار، لكل المستخدمين. لا يتأثر ذلك بخطتك الافتراضية الشخصية.`, `Reports, the Decision Room, Smart Reports and the assistant will read this plan for the chosen year, for every user. Your personal default plan does not affect it.`)
    : kind === 'default' ? L(`تُفتح «${nm}» تلقائياً عند دخولك صفحة الخطط. لا يتأثر بها مستخدم آخر ولا المراجع المؤسسية.`, `“${nm}” opens automatically when you enter the plans page. No other user and no organisation reference is affected.`)
      : kind === 'sysdefault' ? L(`تُفتح «${nm}» تلقائياً لكل المستخدمين عند دخولهم صفحة الخطط، ما عدا من اختار خطة افتراضية شخصية. لا يمنح ذلك أي صلاحية جديدة: يرى كل مستخدم الجهات والأرقام المسموحة له فقط، ولا يتأثر به المرجع المؤسسي للتقارير.`, `“${nm}” will open automatically for every user who enters the plans page, except those who chose a personal default plan. This grants no new permission: each user sees only the entities and figures they are already allowed to see, and the organisation reference for reports is not affected.`)
      : kind === 'discard' ? L('تُحذف التعديلات غير المحفوظة ويعود التحليل إلى الخطة المحفوظة.', 'The unsaved edits are dropped and the analysis returns to the saved plan.')
        : L('لديك تغييرات غير محفوظة ستضيع إن غادرت هذه الخطة. هل تريد المغادرة؟', 'You have unsaved changes that will be lost if you leave this plan. Leave anyway?');
  const run = async () => {
    if (kind === 'leave') { onLeave?.(); return; }
    if (kind === 'discard') { onDone?.(); return; }
    setBusy(true); setError(null);
    try {
      const c = client(api);
      const res = kind === 'reference' ? await c.setPlanReference(Number(year), plan.id) : kind === 'sysdefault' ? await c.setSystemDefault(plan.id) : await c.setPersonalDefault(plan.id);
      await refreshPlans(); onDone?.(res, kind);
    } catch (e) { setError(e); setBusy(false); }
  };
  return (
    <PlanModal title={title} subtitle={kind === 'leave' ? null : nm} onClose={busy ? undefined : onClose} dismissible={!busy} size="sm"
      footer={<><button type="button" className="btn" onClick={onClose} disabled={busy}>{kind === 'leave' ? L('البقاء هنا', 'Stay here') : L('إلغاء', 'Cancel')}</button>
        <button type="button" className={`btn ${kind === 'leave' ? '' : 'btn-primary'}`} data-autofocus id="plan-confirm" onClick={run} disabled={busy || (kind === 'reference' && !year)}>{busy ? L('جارٍ التنفيذ…', 'Working…') : kind === 'leave' ? L('مغادرة وتجاهل التغييرات', 'Leave and discard the changes') : title}</button></>}>
      <p style={{ margin: 0 }}>{body}</p>
      {kind === 'reference' && (<label className="pln-field"><span>{L('العام التقويمي', 'Calendar year')}</span>
        <select className="pln-input pln-input--sm" value={year} onChange={(e) => setYear(e.target.value)}>{years.map((y) => <option key={y} value={y}>{y}{currentReferenceYears.includes(y) ? L(' (مرجعية حالياً)', ' (currently the reference)') : ''}</option>)}</select></label>)}
      {error && <div className="rv-callout rv-callout--bad" role="alert">{isConflict(error) ? L('عُدِّلت الخطة قبل لحظات.', 'The plan was changed a moment ago.') : requestProblems(error).map((t) => pickL(t, lang)).join(' · ')}</div>}
    </PlanModal>
  );
}
export { userText };
