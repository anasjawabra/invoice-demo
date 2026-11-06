// «خطط الإيرادات» — the ONE plan page (/planning/:planId; /planning redirects to the effective default plan). docs/revenue-plans-spec.md §10.
//   selector (saved plans) · header (name · creation date · «حفظ الخطة» · «تعديل الخطة» · ⋯) · [unsaved-changes bar] · view-scope filter (Amanah + municipality, URL state, never writes the plan)
//   · ONE summary · conditional notices · position · cumulative chart · forecast + required pace · contribution (entity / municipality) · «أين نركز» · factors.
// EVERYTHING below the header is computed from ONE plan content: the SAVED plan, or — while the person has unsaved edits — the client WORKING COPY as a live preview (nothing is stored until «حفظ الخطة»). The analysis is the
// core of src/data/plans/planBasis.js + planForecast.js + planMeasures.js; the three percentages and the signed deviation are the ones defined in the spec; there is no tolerance badge and no probability block.
import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useRevenue } from '../context/RevenueContext';
import { useAccess } from '../context/AuthContext';
import { useAsync } from '../utils/useAsync';
import { useAr } from '../utils/useAr';
import { usePageChartView } from '../components/charts/usePageChartView';
import { useUrlFilters } from '../components/filters';
import { usePlans } from '../data/plans/usePlans';
import { refreshPlans } from '../data/plans/planStore';
import { scopeEntityKeys, viewScopeOf, entityUniverse } from '../data/plans/planAccess';
import { planningBasisFromPlan } from '../data/plans/planBasis';
import { forecastPlan } from '../data/planForecast';
import { planMeasures } from '../data/plans/planMeasures';
import { periodValid } from '../data/plans/planMath';
import { notifiedBudgetFor } from '../data/plans/notifiedBudget';
import { loadPlanInputsForPlan, approvedConfigOf, visibleEntityKeys } from '../data/planInputs';
import { actionView, sourceBars } from '../data/planningActionsView';
import { fmtDateText } from '../data/clock';
import { DATA_START } from '../data/revenueLedger';
import * as plansClient from '../api/plansClient';
import { planCumulativeBlock, planDeviationBlock, planBreakdown, planBulletRows, planBulletBlock } from '../components/plans/planCharts';
import { planFactorsFor } from '../components/plans/planFactors';
import { PlanSelector, PlanHeader, UnsavedBar } from '../components/plans/PlanHeader';
import PlanViewScope from '../components/plans/PlanViewScope';
import LegacyImportNotice from '../components/plans/LegacyImportNotice';
import { PlanSummary, PlanNotices, PlanPositionBlock, PlanCumulativeSection, PlanScheduleSection, PlanForecastSection, PlanBreakdownSection } from '../components/plans/PlanSections';
import { SaveNameDialog, ConfirmDialog } from '../components/plans/PlanDialogs';
import useUnsavedGuard from '../components/plans/useUnsavedGuard';
import { savedContentOf, viewOf, displayName, isDirty, newPlanContent, saveMode, canEditPlan, clientSaveProblems, requestProblems, entityNameOf, pickL, bi, isConflict, userText, municipalOnlyViewer } from '../components/plans/planUi';
import { reviewDataDate } from './Plans';
import { submitUpdate } from '../components/plans/planActions';
import PlanActions from '../components/strategic/PlanActions';
import PlanFactors from '../components/strategic/PlanFactors';
import '../components/strategic/planning.css';
import '../styles/plans.css';

const PlanEditor = lazy(() => import('../components/plans/editor/PlanEditor.jsx')); // built by the editor agent; rendered only when opened
const stable = (v) => JSON.stringify(v);

/** the loaded inputs carry the identity of the view they were loaded for; the data depends only on scope / period / view scope / cut-off, so a working copy with the same scope re-uses it under its own version id */
export function restamp(D, view) {
  if (!D || !D.meta) return D;
  const id = { planId: view.planId, versionId: view.versionId };
  return { ...D, meta: { ...D.meta, ...id }, actual: D.actual ? { ...D.actual, meta: { ...D.actual.meta, ...id } } : D.actual, history: D.history ? { ...D.history, ...id } : D.history };
}

export default function PlanDetail() {
  const { planId } = useParams(); const isNew = planId === 'new';
  const rev = useRevenue(); const access = useAccess(); const snap = usePlans(); const navigate = useNavigate(); const [sp, setSp] = useSearchParams();
  const { L, ar, lang, short } = useAr();
  const today = rev.cfg.cutoff; const todayYear = Number(today.slice(0, 4)); const latestData = reviewDataDate(today) || today;
  const geo = access.effectiveScope('planning');
  const vis = useMemo(() => visibleEntityKeys({ geoScope: geo }), [geo]); // eslint-disable-line react-hooks/exhaustive-deps
  const entityKeys = vis.restricted ? vis.keys : null;
  const approvedCfg = useMemo(() => approvedConfigOf(rev.cfg), [rev.cfg]);
  const readOnly = !!access.readOnly; const canSetReference = !!snap.capabilities?.canSetReference; const canSystemDefault = snap.capabilities?.canSetSystemDefault ?? canSetReference; // the same authority as the reference plan: all-entities access and a role that is not read-only
  const [chartView, onChartView] = usePageChartView('planning');

  // ---- the plan, its saved content and the WORKING COPY (null = the saved plan is shown as it is)
  const plan = isNew ? null : snap.plans.find((p) => p.id === planId) || null;
  const initialNew = useMemo(() => newPlanContent({ year: todayYear }), [todayYear]);
  const saved = isNew ? initialNew : savedContentOf(plan);
  const [work, setWork] = useState(null);
  useEffect(() => { setWork(null); setProblems([]); setConflict(null); }, [planId]); // eslint-disable-line react-hooks/exhaustive-deps
  const content = work || saved;
  const dirty = isNew ? true : isDirty(saved, work);
  const view = useMemo(() => (content ? viewOf(plan, content, { working: dirty }) : null), [plan, content, dirty]);
  const canEdit = canEditPlan(plan, { geoScope: geo, readOnly });
  const gate = saveMode(plan, { canEdit, readOnly, isNew });
  const masked = !!plan?.masked;
  const editGate = readOnly ? { allowed: false, reason: bi('دورك للقراءة فقط ولا يسمح بتعديل الخطط', 'Your role is read-only and cannot change plans') }
    : masked ? { allowed: false, reason: bi('نطاق صلاحيتك لا يغطي كل جهات هذه الخطة، فلا يمكنك تعديلها', 'Your access scope does not cover every entity of this plan, so you cannot edit it') } : { allowed: true, reason: null };

  // ---- view scope (Amanah + municipality) — the URL, normalised against what the viewer may see
  const planKeys = useMemo(() => (view ? scopeEntityKeys(view.scope, entityUniverse()) : []), [view?.scope]); // eslint-disable-line react-hooks/exhaustive-deps
  const url = useUrlFilters({ keys: ['amanah', 'muni'], defaults: { amanah: 'all', muni: 'all' } });
  const vsc = useMemo(() => viewScopeOf({ amanah: url.values.amanah, muni: url.values.muni }, { geoScope: geo, universe: planKeys }), [url.values.amanah, url.values.muni, geo, planKeys]);
  useEffect(() => { if (vsc.invalidReason) url.setValues({ amanah: vsc.amanah, muni: vsc.muni }); }, [vsc.invalidReason]); // eslint-disable-line react-hooks/exhaustive-deps
  // a municipal-only viewer of ONE Amanah: the plan-level view has no target for them (the Amanah total is hidden), so the page opens on their Amanah, where the target is the Σ of their municipal allocations
  const onlyKey = masked && municipalOnlyViewer(plan) && vis.keys.length === 1 ? vis.keys[0] : null;
  useEffect(() => { if (onlyKey && url.values.amanah === 'all') url.setValues({ amanah: onlyKey }); }, [onlyKey, url.values.amanah]); // eslint-disable-line react-hooks/exhaustive-deps
  const viewScope = vsc.isDefault ? null : { amanah: vsc.amanah, muni: vsc.muni };
  const onScope = (patch) => { const next = { amanah: patch.amanah ?? url.values.amanah, muni: patch.muni ?? url.values.muni }; if ('amanah' in patch && patch.amanah !== url.values.amanah && !('muni' in patch)) next.muni = 'all'; url.setValues(next); };

  // ---- the data (depends on scope · period · view scope · cut-off ONLY) and the analysis
  const [retry, setRetry] = useState(0);
  const dataKey = view && periodValid(view.period) ? `${stable(view.scope)}|${view.period.start}|${view.period.end}|${vsc.amanah}|${vsc.muni}|${entityKeys ? entityKeys.join(',') : '*'}|${latestData}` : null;
  const DATA = useAsync(async () => (dataKey ? loadPlanInputsForPlan(rev, { view, reporting: latestData, approvedCfg, entityKeys, viewScope, upcomingHistory: true }) : null), [rev.data, dataKey, retry]); // eslint-disable-line react-hooks/exhaustive-deps
  const dataFresh = !!DATA.data && DATA.data.meta?.scopeKey != null && !DATA.loading;
  const D = useMemo(() => (view && DATA.data ? restamp(DATA.data, view) : null), [DATA.data, view]);
  const basis = useMemo(() => (view ? planningBasisFromPlan({ view, today, latestDataDate: latestData, entityKeys, actual: dataFresh && D ? D.actual : null, viewScope }) : null), [view, D, dataFresh, today, latestData, entityKeys, vsc.amanah, vsc.muni]); // eslint-disable-line react-hooks/exhaustive-deps
  const forecast = useMemo(() => (basis ? forecastPlan(basis, { history: dataFresh && D ? D.history : null }) : null), [basis, D, dataFresh]);
  const measures = useMemo(() => (basis ? planMeasures(basis, forecast) : null), [basis, forecast]);
  // «الميزانية المبلّغة» of the SELECTED plan's year (never today's date), for the view scope and the viewer's authorised entities — recomputed whenever the plan, its scope or the view changes
  const budget = useMemo(() => (view ? notifiedBudgetFor({ view, viewScope, entityKeys, municipalOnlyKeys: plan?.municipalOnlyEntityKeys || null }) : null), [view, vsc.amanah, vsc.muni, entityKeys, plan?.municipalOnlyEntityKeys]); // eslint-disable-line react-hooks/exhaustive-deps
  const nameOfRow = (k) => entityNameOf(k);
  const names = (k) => (lang === 'en' ? entityNameOf(k).en : entityNameOf(k).ar);

  const [devAll, setDevAll] = useState(false); const [bulAll, setBulAll] = useState(false); const [actAll, setActAll] = useState(false); const [retryAct, setRetryAct] = useState(0);
  const [srcSel, setSrcSel] = useState(null); // the revenue source chosen on the source bars: narrows the «أين نركز» table; cleared whenever the plan / period / view scope changes
  const dev = useMemo(() => (basis ? planDeviationBlock(basis, { lang, nameOf: names, topN: devAll ? Infinity : 10, selected: vsc.muni !== 'all' ? vsc.muni : null }) : null), [basis, lang, devAll, vsc.muni]); // eslint-disable-line react-hooks/exhaustive-deps
  const bd = useMemo(() => planBreakdown(basis, { lang, nameOf: names }), [basis, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  // the bullets (collected · planned to date · the plan-period target, % of that target) over the SAME basis rows; none before the period starts
  const bulData = useMemo(() => (basis ? planBulletRows(basis, { lang, nameOf: names, top: 5, all: bulAll, derived: !!view?.content?.baseline, fmtDate: (d) => fmtDateText(d, lang) }) : null), [basis, lang, bulAll, view?.content?.baseline]); // eslint-disable-line react-hooks/exhaustive-deps
  const bulBlock = useMemo(() => { try { return bulData ? planBulletBlock(basis, { lang, data: bulData, money: short }) : null; } catch (e) { console.error('[plans] the bullets could not be built:', e); return null; } }, [basis, bulData, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const cumBlock = useMemo(() => (basis && (measures?.calculable || basis.state === 'future_period') ? planCumulativeBlock(basis, forecast, { lang }) : null), [basis, forecast, measures, lang]); // an UPCOMING plan draws its plan line only

  // ---- the action lines (planning module): gaps come from THIS content's basis
  const canPlan = access.can('planning'); const canDrill = access.can('invoices_uncollected');
  const inPeriod = !!view && today >= view.period.start && today <= view.period.end;
  const gaps = useMemo(() => {
    const g = {}; if (!basis) return g;
    if (basis.rowsKind === 'entity' && vsc.amanah === 'all') { for (const e of basis.entities || []) if (e.hasTarget && e.plannedToDate != null && e.actual != null) g[e.key] = e.plannedToDate - e.actual; }
    else if (vsc.amanah !== 'all' && basis.plannedToDate != null && basis.actualToDate != null) g[vsc.amanah] = basis.plannedToDate - basis.actualToDate;
    return g;
  }, [basis, vsc.amanah]);
  const gapsKey = JSON.stringify(Object.entries(gaps).map(([k, v]) => [k, Math.round(v)]));
  const ACT = useAsync(async () => {
    if (!dataFresh || !inPeriod || !canPlan || !view) return null;
    const amanah = vsc.amanah !== 'all' ? vsc.amanah : view.scope.kind === 'entities' ? view.scope.entityKeys : entityKeys || 'all';
    return rev.data.planActions({ from: '2000-01-01', to: today, amanah, source: 'all', scopeType: 'all', muni: vsc.muniFilterValue || 'all', status: 'all' }, { entityGaps: gaps, groupBy: vsc.amanah !== 'all' ? 'municipality' : 'entity' });
  }, [rev.data, dataFresh, inPeriod, canPlan, dataKey, gapsKey, retryAct]); // eslint-disable-line react-hooks/exhaustive-deps
  const actStatus = !inPeriod ? 'idle' : !canPlan ? 'denied' : ACT.error && !ACT.data ? (/403|forbidden/i.test(String(ACT.error?.message || ACT.error?.status)) ? 'denied' : 'error') : (ACT.loading && !ACT.data) || !dataFresh ? 'loading' : 'ready';
  const sbars = useMemo(() => { try { return sourceBars(ACT.data, { lang, selectedKey: srcSel }); } catch (e) { console.error('[plans] the source bars could not be built:', e); return null; } }, [ACT.data, lang, srcSel]); // a failing visual never blanks the page
  useEffect(() => { setSrcSel(null); }, [planId, dataKey, gapsKey]); // a chosen source belongs to the view it was chosen in
  const srcKey = srcSel && sbars?.items.some((x) => x.key === srcSel) ? srcSel : null; // a source that is no longer in the bars filters nothing
  const aview = useMemo(() => actionView(ACT.data, { money: short, count: (n) => String(n), lang, expanded: actAll, sourceKey: srcKey }), [ACT.data, lang, actAll, srcKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const factors = useMemo(() => planFactorsFor({ basis, forecast, inputs: dataFresh ? D : null, actions: ACT.data, advanced: content?.advanced }), [basis, forecast, D, dataFresh, ACT.data, content]);
  const drillReason = L('يلزم الوصول إلى وحدة «الفواتير غير المحصّلة» لفتح السجلات', 'Access to the “Uncollected invoices” module is required to open the records');

  // ---- unsaved-changes guard, save flow, editor
  const guard = useUnsavedGuard({ dirty: dirty && !!view, navigate });
  const [dialog, setDialog] = useState(null); const [busy, setBusy] = useState(false); const [problems, setProblems] = useState([]); const [conflict, setConflict] = useState(null); const [notice, setNotice] = useState(null);
  const flash = (text) => { setNotice(text); setTimeout(() => setNotice((n) => (n === text ? null : n)), 5000); };
  const ctx = { geoScope: geo, readOnly };
  const afterCreate = (p) => { setDialog(null); setWork(null); flash(L('تم حفظ الخطة وهي الآن المختارة.', 'The plan was saved and is now the selected plan.')); guardless(`/planning/${encodeURIComponent(p.id)}`); };
  const guardless = (to) => { guard.proceed(); navigate(to); };
  const openNaming = (opts = {}) => setDialog({ kind: 'name', ...opts });
  const doUpdate = async () => {
    setBusy(true); setProblems([]); setConflict(null);
    const r = await submitUpdate({ api: plansClient, plan, content, ctx, refresh: refreshPlans });
    setBusy(false);
    if (r.ok) { setWork(null); flash(L('تم حفظ الخطة.', 'The plan was saved.')); }
    else if (r.kind === 'conflict') setConflict(r.error);
    else setProblems(r.problems);
  };
  const onSave = () => {
    if (gate.mode === 'update') doUpdate();
    else openNaming({ defaultName: isNew ? content.name : (lang === 'ar' ? `${content.name} — نسخة` : `${(plan?.nameEn || content.name)} — copy`), copyOf: plan?.id || null, reason: gate.reason });
  };
  const onSaveAsNew = () => openNaming({ defaultName: lang === 'ar' ? `${content.name} — نسخة` : `${(plan?.nameEn || content.name)} — copy`, copyOf: plan?.id || null, reason: null });

  const editing = sp.get('edit') === '1' || (typeof window !== 'undefined' && window.location.hash === '#plan-targets');
  const setEditing = (on) => setSp((cur) => { const n = new URLSearchParams(cur); if (on) n.set('edit', '1'); else n.delete('edit'); return n; }, { replace: true });
  useEffect(() => { if (typeof window !== 'undefined' && window.location.hash === '#plan-targets' && editGate.allowed) setSp((cur) => { const n = new URLSearchParams(cur); n.set('edit', '1'); return n; }, { replace: true }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const onContentChange = useCallback((next) => setWork(isNew ? next : (isDirty(saved, next) ? next : null)), [isNew, saved]);

  const selectPlan = (id) => { if (id === planId) return; guard.request(`/planning/${encodeURIComponent(id)}`); };
  const newPlan = () => { if (isNew) return; guard.request('/planning/new'); };
  const refYears = view ? (() => { const out = []; for (let y = Number(view.period.start.slice(0, 4)); y <= Number(view.period.end.slice(0, 4)); y += 1) out.push(y); return out; })() : [];
  const refYearsNow = Object.entries(snap.references || {}).filter(([, r]) => r?.planId === plan?.id).map(([y]) => Number(y));
  const isPersonalDefault = !!plan && snap.defaults?.userDefaultPlanId === plan.id; const isGlobalDefault = !!plan && (snap.defaults?.globalDefaultPlanId || snap.defaults?.systemDefaultPlanId) === plan.id;
  const titleName = !isNew && plan && !dirty ? displayName(plan, lang) : content?.name;

  // ---- states before the plan exists
  if (snap.status === 'loading' || snap.status === 'idle') return <div className="pl-page st-page" role="status" aria-busy="true"><div className="card pl-section"><div className="st-skel" style={{ height: 220 }} /></div></div>;
  if (snap.status === 'forbidden') return <div className="pl-page st-page"><div className="rv-callout rv-callout--warn" role="alert">{L('لا صلاحية لوحدة التخطيط لعرض الخطط.', 'No access to the planning module to see plans.')}</div></div>;
  if (!isNew && (!plan || !content)) {
    return (
      <div className="pl-page st-page pln-page" dir={ar ? 'rtl' : 'ltr'}>
        <div className="rv-callout rv-callout--warn" role="alert" id="plan-missing"><b>{L('الخطة غير متاحة', 'The plan is not available')}</b>
          <div>{snap.status === 'error' ? L('تعذّر تحميل الخطط.', 'The plans could not be loaded.') : L('لم تُوجد هذه الخطة أو لم تعد متاحة لك.', 'This plan does not exist or is no longer available to you.')}</div>
          <Link className="btn btn-sm" to="/planning">{L('إلى الخطة الافتراضية', 'Go to the default plan')}</Link></div>
      </div>
    );
  }
  const saveGate = gate;

  return (
    <div className="pl-page st-page pln-page" dir={ar ? 'rtl' : 'ltr'} id="plan-page">
      <PlanSelector plans={snap.plans} defaults={snap.defaults} selectedId={planId} selectedName={plan ? displayName(plan, lang) : ''} isNew={isNew} today={today} onSelect={selectPlan} onNew={newPlan} canNew={!readOnly} newReason={bi('دورك للقراءة فقط', 'Your role is read-only')} />
      <PlanHeader name={titleName} plan={plan} isNew={isNew} saveGate={saveGate} editGate={editGate} dirty={dirty} busy={busy}
        canReference={canSetReference && !isNew} canSystemDefault={canSystemDefault && !isNew} isGlobalDefault={isGlobalDefault} isPersonalDefault={isPersonalDefault}
        onSave={onSave} onSaveAsNew={onSaveAsNew} onEdit={() => setEditing(true)} onSetDefault={() => setDialog({ kind: 'default' })} onSetReference={() => setDialog({ kind: 'reference' })} onSetSystemDefault={() => setDialog({ kind: 'sysdefault' })} />
      <LegacyImportNotice plans={snap.plans} capabilities={snap.capabilities} />
      {notice && <div className="pl-notice pl-notice--good" role="status" id="plan-flash">{notice}</div>}
      {dirty && <UnsavedBar isNew={isNew} busy={busy} saveDisabled={saveGate.mode === 'none'} onSave={onSave} onDiscard={() => (isNew ? navigate('/planning') : setDialog({ kind: 'discard' }))} />}
      {problems.length > 0 && <div className="rv-callout rv-callout--bad" role="alert" id="plan-save-problems-page"><b>{L('لم تُحفظ الخطة', 'The plan was not saved')}</b><ul className="pln-problems">{problems.map((p, i) => <li key={i}>{pickL(p, lang)}</li>)}</ul><div className="pl-note">{L('بقيت قيمك كما أدخلتها.', 'Your values were kept as you entered them.')}</div></div>}
      {conflict && (
        <div className="rv-callout rv-callout--warn" role="alert" id="plan-conflict"><b>{L('عُدِّلت هذه الخطة بعد تحميلك لها', 'This plan was changed after you loaded it')}</b>
          <div>{L(`آخر محرّر: ${pickL(userText(conflict.lastEditedBy), 'ar')}. لم يُستبدل شيء؛ تعديلاتك ما زالت هنا.`, `Last editor: ${pickL(userText(conflict.lastEditedBy), 'en')}. Nothing was overwritten; your edits are still here.`)}</div>
          <span className="pln-unsaved__act"><button type="button" className="btn btn-sm" onClick={() => { setWork(null); setConflict(null); }}>{L('تجاهل تعديلاتي وتحميل المحفوظ', 'Discard my edits and load the saved plan')}</button><button type="button" className="btn btn-sm btn-primary" onClick={() => { setConflict(null); onSaveAsNew(); }}>{L('حفظ تعديلاتي كخطة جديدة', 'Save my edits as a new plan')}</button></span></div>
      )}
      <PlanViewScope vsc={vsc} values={url.values} onChange={onScope} ministry={view.scope.kind === 'ministry'} restrictedLabel={vis.restricted && view.scope.kind === 'ministry' ? bi('إجمالي الجهات المتاحة لك', 'Total of the entities available to you') : null} />

      <PlanSummary measures={measures} view={view} plan={plan} basis={basis} budget={budget} />
      <PlanNotices basis={basis} />
      {DATA.error && !DATA.data ? <div className="rv-callout rv-callout--bad" role="alert"><b>{L('تعذّر تحميل البيانات الفعلية', 'The actual data could not be loaded')}</b> <button type="button" className="btn btn-sm" onClick={() => setRetry((n) => n + 1)}>{L('إعادة المحاولة', 'Retry')}</button></div> : null}
      {!dataFresh && !DATA.error && basis?.state !== 'invalid_period' ? <div className="card pl-section" role="status" aria-busy="true" aria-label={L('جارٍ التحميل', 'Loading')}><div className="st-skel" style={{ height: 160 }} /></div> : (
        <>
          <PlanPositionBlock basis={basis} measures={measures} />
          <PlanCumulativeSection basis={basis} chart={cumBlock} view={chartView} onViewChange={onChartView} />
          <PlanScheduleSection basis={basis} />
          <PlanForecastSection basis={basis} forecast={forecast} measures={measures} />
          {basis && (basis.entities || []).length > 0 && (
            <PlanBreakdownSection basis={basis} dev={dev} bd={bd} view={chartView} onViewChange={onChartView} selectedKey={vsc.muni !== 'all' ? vsc.muni : vsc.amanah !== 'all' && basis.rowsKind !== 'municipality' ? vsc.amanah : null}
              onPickRow={(k) => (basis.rowsKind === 'municipality' ? (k !== '__unallocated_muni__' ? onScope({ muni: k }) : null) : onScope({ amanah: k, muni: 'all' }))} expanded={devAll} onToggleExpanded={() => setDevAll((x) => !x)}
              sources={sbars} sourceStatus={actStatus} srcSel={srcKey} onPickSource={measures?.calculable ? (k) => setSrcSel((c) => (c === k ? null : k)) : null} onResetSource={() => setSrcSel(null)} onRetrySources={() => setRetryAct((n) => n + 1)}
              bullets={bulData} bulletBlock={bulBlock} bulletsExpanded={bulAll} onToggleBulletsExpanded={() => setBulAll((x) => !x)} />
          )}
          {measures?.calculable && (
            <PlanActions view={aview} status={actStatus} error={ACT.error} canDrill={canDrill} drillReason={drillReason} notCurrentYear={!inPeriod} srcName={srcKey ? sbars?.items.find((x) => x.key === srcKey)?.name || srcKey : null} onResetSource={() => setSrcSel(null)} expanded={actAll} onToggleExpanded={() => setActAll((x) => !x)}
              hasGaps={Object.keys(gaps).length > 0} scopeName={basis?.viewLabel ? pickL(basis.viewLabel, lang) : content.name} onRetry={() => setRetryAct((n) => n + 1)} />
          )}
          {measures?.calculable && basis?.state === 'ok' && <PlanFactors factors={factors} />}
        </>
      )}

      {editing && editGate.allowed && (
        <Suspense fallback={null}>
          <PlanEditor open plan={plan} content={content} baseContent={saved} onContentChange={onContentChange} viewScope={{ amanah: vsc.amanah, muni: vsc.muni }} initialTab={window.location.hash === '#plan-targets' ? 'target' : 'basics'} readOnlyReason={null} onClose={() => setEditing(false)} />
        </Suspense>
      )}
      {editing && !editGate.allowed && <div className="rv-callout rv-callout--warn" role="status">{pickL(editGate.reason, lang)}</div>}

      {dialog?.kind === 'name' && <SaveNameDialog content={content} plans={snap.plans} defaultName={dialog.defaultName} copyOf={dialog.copyOf} context={ctx} reason={dialog.reason} onClose={() => setDialog(null)} onSaved={afterCreate} />}
      {dialog?.kind === 'default' && <ConfirmDialog kind="default" plan={plan} view={view} onClose={() => setDialog(null)} onDone={() => { setDialog(null); flash(L('عُيّنت خطتك الافتراضية.', 'Your default plan was set.')); }} />}
      {dialog?.kind === 'sysdefault' && <ConfirmDialog kind="sysdefault" plan={plan} view={view} onClose={() => setDialog(null)} onDone={() => { setDialog(null); flash(L('عُيّنت الخطة الافتراضية للنظام لكل المستخدمين.', 'The system default plan was set for every user.')); }} />}
      {dialog?.kind === 'reference' && <ConfirmDialog kind="reference" plan={plan} view={view} years={refYears} currentReferenceYears={refYearsNow} onClose={() => setDialog(null)} onDone={() => { setDialog(null); flash(L('عُيّنت الخطة المرجعية للتقارير.', 'The reference plan for reports was set.')); }} />}
      {dialog?.kind === 'discard' && <ConfirmDialog kind="discard" view={view} onClose={() => setDialog(null)} onDone={() => { setWork(null); setDialog(null); setProblems([]); }} />}
      {guard.pending && <ConfirmDialog kind="leave" onClose={guard.stay} onLeave={guard.proceed} />}
    </div>
  );
}
