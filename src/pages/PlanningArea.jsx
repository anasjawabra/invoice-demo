// «التخطيط المالي والاستراتيجي» — management area 2. Objectives & targets → revenue and expenditure plan → actual vs plan → forecasts, gaps and
// funding → what-if scenarios → initiatives and decisions. The dashboard's figures are the BASELINE through shared calculations; only a compact
// summary is shown here. Actuals, approved budgets, targets, forecasts and user scenarios are kept in separate places and never mixed.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRevenue } from '../context/RevenueContext';
import { useAsync } from '../utils/useAsync';
import { useAuth } from '../context/AuthContext';
import { useAr } from '../utils/useAr';
import { fmtMoney, fmtInt, unitOfValues, scaled } from '../utils/money';
import FilterChips from '../components/strategic/FilterChips';
import ScenarioPanel from '../components/strategic/ScenarioPanel';
import ActionRegister from '../components/strategic/ActionRegister';
import AssistantPanel from '../components/strategic/AssistantPanel';
import ObjectivesPanel from '../components/strategic/ObjectivesPanel';
import PlanBar from '../components/strategic/PlanBar';
import { PlanTable, VarianceBlock, ForecastGaps } from '../components/strategic/PlanOutlook';
import { AsyncBlock, Skeleton } from '../components/strategic/AsyncState';
import { targetAchievementFrom, monthlyTargetSeries, monthsBetween, compareSnapshots, previousScope } from '../data/revenueMetrics';
import { forecastReceipts, targetVsForecast } from '../data/revenueOutlook';
import { requiredPace, runScenario, scenarioBase, financeProjection, monthsBetweenDates, DEFAULT_SCENARIO } from '../data/strategicCalc';
import { buildProposals } from '../data/proposals';
import { loadRegister, saveRegister, createAction } from '../data/actionRegister';
import { loadPlans, savePlans, newPlan } from '../data/planStore';
import { generateFinance, budgetExecution, operatingCoverage, financeCompatible } from '../data/syntheticFinance';
import { buildCommandModel } from '../data/commandModel';
import { exportModelToDocx, exportModelToXlsx, exportModelToPptx } from '../utils/exportReportModel';
import { buildDecisionCards } from '../data/revenueInsights';
import { PLANNING_PROMPTS } from '../data/strategicAssistant';
import { amanahOptionsOf } from '../data/revenueLedger';

const NAV = [['objectives', 'الأهداف والمستهدفات', 'Objectives & targets'], ['plan', 'خطط الإيرادات والنفقات', 'Revenue & expenditure plan'], ['variance', 'الفعلي مقابل الخطة', 'Actual vs plan'], ['outlook', 'التوقعات والفجوات', 'Forecasts & gaps'], ['scenario', 'السيناريوهات', 'Scenarios'], ['decisions', 'المبادرات والقرارات', 'Initiatives & decisions']];
const pct = (v, na) => (v == null ? na : `${(v * 100).toFixed(1)}%`);

export default function PlanningArea() {
  const rev = useRevenue(); const { user } = useAuth();
  const { L, B, ar, lang } = useAr();
  const today = rev.cfg.cutoff; const { snapshot, prevSnapshot, comparison, data, cfg, targets } = rev; const s = rev.scopeEff; const T = snapshot?.totals;
  const [assistOpen, setAssistOpen] = useState(false);
  const [register, setRegister] = useState(loadRegister);
  const [store, setStore] = useState(loadPlans);
  const [exporting, setExporting] = useState(''); const [retry, setRetry] = useState(0); const [toast, setToast] = useState('');
  const canEdit = rev.canReview; const by = user?.name || user?.email || 'user';
  useEffect(() => { saveRegister(register); }, [register]);
  useEffect(() => { savePlans(store); }, [store]);
  const scopeBase = useMemo(() => ({ amanah: s.amanah, source: s.source, scopeType: s.scopeType, muni: s.muni, status: s.status }), [s.amanah, s.source, s.scopeType, s.muni, s.status]);
  const labelOfAmanah = useCallback((k) => { const a = amanahOptionsOf().find((x) => x.key === k); return a ? (ar ? a.ar : a.en) : k; }, [ar]);
  const scopeLabel = useMemo(() => `${s.amanah === 'all' ? L('كل الأمانات', 'All Amanahs') : [].concat(s.amanah).map(labelOfAmanah).join('، ')} · ${s.source === 'all' ? L('كل المصادر', 'All sources') : s.source}`, [s, L, labelOfAmanah]);
  const scopeSnapshot = useMemo(() => ({ ...scopeBase, label: scopeLabel }), [scopeBase, scopeLabel]);

  // there is always an active plan; a first draft is created from the current scope (no owner assigned)
  useEffect(() => { if (!store.plans.length) { const p = newPlan({ by, name: L(`خطة السنة المالية ${today.slice(0, 4)} (مسودة)`, `Fiscal year ${today.slice(0, 4)} plan (draft)`), scope: scopeSnapshot, period: { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` } }); setStore((st) => ({ ...st, plans: [p], activeId: p.id })); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const plan = store.plans.find((p) => p.id === store.activeId) || store.plans[0] || null;
  const setPlan = useCallback((fn) => setStore((st) => ({ ...st, plans: st.plans.map((p) => (p.id === (st.activeId || st.plans[0]?.id) ? fn(p) : p)) })), []);
  const scenario = plan?.scenario || DEFAULT_SCENARIO; const planDate = plan?.planDate || `${today.slice(0, 4)}-12-31`;
  const setScenario = (sc) => setPlan((p) => ({ ...p, scenario: sc }));
  const setPlanDate = (d) => setPlan((p) => ({ ...p, planDate: d < today ? today : d }));

  const fy = targets.fiscalYear; const financeOk = financeCompatible(s, rev.org); const fin = useMemo(() => generateFinance(today), [today]);
  const narrowed = s.amanah !== 'all' || s.source !== 'all' || s.scopeType !== 'all' || s.muni !== 'all' || !!rev.org?.amanahKeys;
  const X = useAsync(async () => {
    const through = s.to < today ? s.to : today; const fcScope = { ...scopeBase, from: `${fy}-01-01`, to: today };
    const fyFull = await data.series(fcScope, { asOf: today });
    const fyThrough = through === today ? fyFull : await data.series({ ...fcScope, to: through }, { asOf: through });
    const achievement = targetAchievementFrom(fyThrough, s, cfg, targets);
    const forecast = await forecastReceipts(data, scopeBase, cfg, { targets });
    return { fyFull, achievement, forecast };
  }, [data, JSON.stringify(scopeBase), s.to, cfg, targets, retry]);
  const x = X.data; const ach = x?.achievement; const achAvail = !!ach && !ach.scopeCaveat && ach.annualTarget != null;

  const scopeText = snapshot ? `${snapshot.scope.from} → ${snapshot.scope.to}` : '';
  const proposals = useMemo(() => (snapshot && T.count > 0 ? buildProposals({ snapshot, prev: prevSnapshot, comparison, targets, cases: rev.cases, scopeText }) : []), [snapshot, prevSnapshot, comparison, targets, rev.cases, scopeText]); // eslint-disable-line react-hooks/exhaustive-deps
  const pace = useMemo(() => (x ? requiredPace({ achievement: ach, series: x.fyFull, today, planDate }) : { available: false }), [x, ach, today, planDate]);
  const scenRes = useMemo(() => (snapshot && T.net > 0 ? runScenario(scenarioBase(snapshot), scenario, targets.collectionRate.value) : null), [snapshot, scenario, targets]); // eslint-disable-line react-hooks/exhaustive-deps
  const funding = useMemo(() => {
    if (!financeOk || !x) return { available: false };
    const ex = budgetExecution(fin); const pm = fin.chapters[0].months.map((_, i) => fin.chapters.reduce((t, c) => t + c.months[i].paid, 0));
    return financeProjection({ receiptsYtd: x.fyFull.values.reduce((t, v) => t + v, 0), paymentsYtd: ex.total.paid, series: x.fyFull, paymentsByMonth: pm, forecast: x.forecast, monthsLeft: monthsBetweenDates(today, planDate), scenarioDeltaCash: scenRes?.deltaCollected || 0, scenario });
  }, [financeOk, x, fin, today, planDate, scenRes, scenario]);
  const gaps = useMemo(() => { if (!snapshot) return []; const tr = targets.collectionRate.value; const lab = new Map(snapshot.byAmanah.map((g) => [g.key, g.label])); return (snapshot.matrix?.amanahSource || []).map((r) => ({ ...r, gap: Math.max(0, r.net * tr - r.collected), label: lab.get(r.amanah) || r.amanah })).filter((r) => r.gap > 0).sort((a, b) => b.gap - a.gap).slice(0, 6); }, [snapshot, targets]);

  const ex = financeOk ? budgetExecution(fin) : null; const cov = financeOk && x ? operatingCoverage(fin, x.fyFull.values.reduce((t, v) => t + v, 0)) : null;
  const actuals = useMemo(() => (snapshot ? ({
    collection_rate: T.collectedOverNet.calculable ? T.collectedOverNet.value * 100 : null, exclusion_rate: T.exclusionRate.calculable ? T.exclusionRate.value * 100 : null,
    overdue_share: T.net > 0 ? (T.overdueOutstanding / T.net) * 100 : null, receipts_ytd: achAvail ? ach.receiptsYtd : null,
    budget_execution: ex?.total.execution != null ? ex.total.execution * 100 : null, coverage: cov?.ratio != null ? cov.ratio * 100 : null
  }) : {}), [snapshot, T, achAvail, ach, ex, cov]); // eslint-disable-line react-hooks/exhaustive-deps
  const systemRows = [
    { id: 'sys-rate', title: L('رفع نسبة التحصيل إلى المستهدف', 'Raise the collection rate to the target'), metric: 'collection_rate', target: targets.collectionRate.value * 100, status: targets.collectionRate.status === 'approved' ? 'approved' : 'proposed', owner: null, due: `${fy}-12-31`, note: L('مُدخل تجريبي — يُعدَّل من الحقل أدناه', 'demo input — edit in the field below') },
    { id: 'sys-rec', title: L('المقبوضات التراكمية منذ بداية السنة', 'Cumulative receipts since the start of the year'), metric: 'receipts_ytd', target: achAvail ? ach.targetYtd : null, status: 'proposed', owner: null, due: today, note: achAvail ? L(`جزء من مستهدف سنوي ${fmtMoney(ach.annualTarget, { lang })} (غير معتمد)`, `part of an annual target of ${fmtMoney(ach.annualTarget, { lang })} (unapproved)`) : L('المستهدف السنوي وطني؛ غير متاح لهذا النطاق', 'The annual target is national; not available for this scope') }
  ];
  const editTarget = (k, v) => rev.setTargets((t) => ({ ...t, [k]: { ...t[k], value: v, status: 'demo' } }));

  /* ---------- assistant (planning tasks only) ---------- */
  const live = useRef({}); live.current = { rev, scopeBase, s, register, proposals, targets, lang, today, labelOfAmanah, cfg, data };
  const ctxFactory = useCallback(() => {
    const c = live.current; const sc0 = { from: c.s.from, to: c.s.to, ...c.scopeBase }; const atEnd = { cfg: { ...c.cfg, collectionsAsOf: 'periodEnd' } };
    return {
      mode: 'planning', lang: c.lang, today: c.today, scope: sc0, targets: c.targets, register: c.register, proposals: c.proposals, labelOfAmanah: c.labelOfAmanah, compare: compareSnapshots,
      fetchSnap: (sc) => c.data.snapshot({ ...sc }),
      fetchPrev: async (sc) => { const pv = previousScope({ from: sc.from, to: sc.to }); const r = await c.data.snapshot({ ...sc, from: pv.from, to: pv.to }, atEnd); return r.totals.count > 0 ? r : null; },
      getAchievement: async (sc) => { const fc = { ...sc, from: `${c.targets.fiscalYear}-01-01`, to: c.today }; const through = sc.to < c.today ? sc.to : c.today; const series = await c.data.series({ ...fc, to: through }, { asOf: through }); return targetAchievementFrom(series, sc, c.cfg, c.targets); },
      applyFilters: (o) => { if (o.from) c.rev.setCustomRange(o.from, o.to); if (o.amanah) c.rev.setAmanah(o.amanah); if (o.source) c.rev.setSource(o.source); }
    };
  }, []);
  const onAssistAction = (ac) => { if (ac.kind === 'scenario') { setScenario({ ...DEFAULT_SCENARIO, ...scenario, ...ac.patch }); setAssistOpen(false); document.getElementById('scenario')?.scrollIntoView({ behavior: 'smooth' }); } if (ac.kind === 'export') doExport('docx'); };

  async function doExport(kind) {
    if (!snapshot || exporting || !plan) return; setExporting(kind);
    try {
      const sc = { from: s.from, to: s.to, ...scopeBase }; const cash = await data.series(sc, { asOf: s.to < today ? s.to : today });
      const out = { snapshot, forecast: x?.forecast, targetPos: null, achievement: ach, coverage: null, cards: buildDecisionCards(snapshot, { enforcementCases: rev.cases }), anomalies: [] };
      const objectivesRows = [...systemRows, ...store.objectives];
      const model = buildCommandModel({ lang, today, spec: { preset: rev.scope.preset, scope: { ...sc } }, out, prev: comparison?.comparable ? prevSnapshot : null, prevScope: prevSnapshot?.scope, cash, bridge: null, targets, cases: rev.cases, meta: rev.meta, fair: null, achievement: ach, pace, forecast: x?.forecast, scenario, planDate, register, plan, objectivesRows, actuals, funding, fin, financeOk, fyReceiptsYtd: x ? x.fyFull.values.reduce((t, v) => t + v, 0) : null });
      if (kind === 'docx') await exportModelToDocx(model); if (kind === 'xlsx') exportModelToXlsx(model); if (kind === 'pptx') await exportModelToPptx(model);
    } catch (e) { setToast(L(`تعذّر التصدير: ${e.message}`, `Export failed: ${e.message}`)); } finally { setExporting(''); }
  }
  const proposeFromScenario = () => {
    const parts = [['dRate', L('معدل التحصيل', 'collection rate'), true], ['recovery', L('استرداد المتأخر', 'overdue recovery')], ['resolve', L('حسم الحالات', 'pending cases')], ['billing', L('الفوترة', 'billing')], ['expense', L('الإنفاق', 'expenditure')]].filter(([k]) => Number(scenario[k]));
    const p = { id: `scenario:${plan?.id}:${Date.now()}`, title: L('تنفيذ سيناريو: ', 'Pursue scenario: ') + parts.map(([k, n, pp]) => `${n} ${scenario[k] > 0 ? '+' : ''}${scenario[k]}${pp ? ' نقطة' : '%'}`).join('، '), issue: L(`سيناريو من الخطة «${plan?.name}» (الإصدار ${plan?.version || 'غير محفوظ'}) ضمن ${scopeText}.`, `A scenario of plan “${plan?.name}” (version ${plan?.version || 'unsaved'}) within ${scopeText}.`), action: L('تحويل افتراضات السيناريو إلى مبادرة بمسؤول وتاريخ ونتيجة تُقاس.', 'Turn the scenario assumptions into an initiative with an owner, date and a measurable outcome.'), priority: 'medium', evidence: { text: L('سيناريو افتراضي وليس تنبؤاً.', 'A hypothetical scenario, not a forecast.'), scope: scopeText, figures: [] }, expectedImpact: null, drill: null };
    setRegister((r) => createAction(r, { by, proposal: p })); setToast(L('أُضيفت المبادرة إلى السجل بحالة «معتمد — بانتظار البدء» بلا مسؤول؛ حدّده وتاريخ الاستحقاق.', 'Added to the register as “Approved — not started” with no owner; set the owner and due date.')); document.getElementById('decisions')?.scrollIntoView({ behavior: 'smooth' });
  };
  const applyPlanScope = (p) => { rev.setCustomRange(p.period.from, p.period.to < today ? p.period.to : today); rev.setAmanah(p.scope?.amanah || 'all'); rev.setSource(p.scope?.source || 'all'); rev.setScopeType(p.scope?.scopeType || 'all'); rev.setMuni(p.scope?.muni || 'all'); };
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(''), 6000); return () => clearTimeout(t); }, [toast]);

  if (!rev.ready || !plan) return <div className="st-page" role="status"><Skeleton height={80} /><Skeleton height={220} /></div>;
  const kpiUnit = unitOfValues([T.net, T.collected, T.outstanding]); const kp = (v) => fmtMoney(v, { lang, unit: kpiUnit });
  const fyMonths = monthsBetween(`${fy}-01-01`, `${fy}-12-28`);
  const outlook = (() => {
    if (!x) return { actual: fyMonths.map(() => null), target: fyMonths.map(() => null), forecast: fyMonths.map(() => null), low: fyMonths.map(() => null), high: fyMonths.map(() => null) };
    const map = new Map(x.fyFull.months.map((m, i) => [m, x.fyFull.values[i]])); const fc = new Map();
    if (x.forecast?.ready) x.forecast.horizon.months.forEach((mo, i) => fc.set(mo, { p: x.forecast.horizon.point[i], lo: x.forecast.horizon.low[i], hi: x.forecast.horizon.high[i] }));
    return { actual: fyMonths.map((m) => (map.has(m) ? map.get(m) : null)), target: narrowed ? fyMonths.map(() => null) : monthlyTargetSeries(targets, fyMonths), forecast: fyMonths.map((m) => (fc.has(m) ? fc.get(m).p : null)), low: fyMonths.map((m) => (fc.has(m) ? fc.get(m).lo : null)), high: fyMonths.map((m) => (fc.has(m) ? fc.get(m).hi : null)) };
  })();
  const tvf = x?.forecast?.ready ? targetVsForecast(x.forecast, targets) : null;
  const scenarioOn = JSON.stringify(scenario) !== JSON.stringify(DEFAULT_SCENARIO);
  const summaryForVersion = { rate: scenRes?.scenario.rate ?? null, collected: scenRes?.scenario.collected ?? null, balance: funding.available ? funding.scenario.balance : null };

  return (
    <div className="st-page" dir={ar ? 'rtl' : 'ltr'}>
      <header className="st-head">
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>{L('التخطيط المالي والاستراتيجي', 'Financial and strategic planning')}</h1>
          <div className="muted" style={{ fontSize: 13 }}>{L('ما أهدافنا؟ هل نحقق المستهدف؟ ما التوقع والفجوة؟ ماذا يتغير في السيناريوهات؟ ومن يتولى كل مبادرة؟', 'What are our objectives? Are we meeting the target? What is the outlook and the gap? What changes in scenarios? Who owns each initiative?')}</div>
          <div className="st-fresh" style={{ marginTop: 6 }}>
            <span className="st-tag st-tag--actual">{L('بيانات حتى', 'Data to')} <bdi>{snapshot.cutoff}</bdi> ({L('الرياض', 'Riyadh')})</span>
            <span className="st-tag st-tag--warn">{L('بيانات تجريبية اصطناعية', 'Synthetic demo data')}{rev.meta?.size === 'compact' ? ` — ${L('عينة مضغوطة', 'compact sample')} ${fmtInt(rev.meta.counts?.invoicesTotal)}` : ''}</span>
            {financeOk && <span className="st-tag st-tag--warn">{L('الميزانية والإنفاق: اصطناعية', 'Budget and expenditure: synthetic')}</span>}
            {rev.loading && <span className="st-tag" role="status">{L('جارٍ التحديث…', 'Updating…')}</span>}
          </div>
        </div>
        <div className="st-head__actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setAssistOpen(true)}>{L('مساعد التخطيط', 'Planning assistant')}</button>
          {[['docx', 'Word'], ['xlsx', 'Excel'], ['pptx', 'PowerPoint']].map(([k, n]) => <button key={k} type="button" className="btn btn-sm" disabled={!!exporting || T.count === 0} onClick={() => doExport(k)}>{exporting === k ? L('جارٍ التصدير…', 'Exporting…') : `${L('ملخص الخطة', 'Plan summary')} ${n}`}</button>)}
        </div>
      </header>

      <PlanBar store={store} setStore={setStore} plan={plan} summary={summaryForVersion} scopeSnapshot={scopeSnapshot} canEdit={canEdit} user={user} onApplyScope={applyPlanScope} today={today} />
      <FilterChips />
      <nav className="st-nav" aria-label={L('أقسام التخطيط', 'Planning sections')}>{NAV.map(([id, a, e]) => <a key={id} href={`#${id}`}>{L(a, e)}</a>)}</nav>
      {toast && <div className="rv-callout" role="status">{toast}</div>}

      {T.count === 0 ? <div className="rv-empty" role="status"><b>{L('لا فواتير في هذا الاختيار.', 'There are no invoices in this selection.')}</b><div>{L('البيانات غير متاحة؛ وسّع الفترة أو أزل مرشحاً.', 'No data — widen the period or remove a filter.')}</div></div> : (<>
      <div className="card st-card" aria-label={L('ملخص خط الأساس', 'Baseline summary')}>
        <div className="st-fresh"><b>{L('خط الأساس من لوحة المعلومات', 'Baseline from the dashboard')}</b> <span className="st-tag st-tag--actual">{L('فعلي', 'actual')}</span>
          <span>{L('صافي المفوتر', 'Net billed')} <b dir="ltr">{kp(T.net)}</b></span><span>{L('المحصّل', 'Collected')} <b dir="ltr">{kp(T.collected)}</b></span><span>{L('غير المحصّل', 'Uncollected')} <b dir="ltr">{kp(T.outstanding)}</b></span><span>{L('نسبة التحصيل', 'Rate')} <b dir="ltr">{pct(T.collectedOverNet.calculable ? T.collectedOverNet.value : null, L('غير متاحة', 'n/a'))}</b></span>
          <Link to="/insights">{L('لوحة المعلومات', 'Dashboard')}</Link></div>
      </div>

      <section id="objectives" className="st-section" aria-label={L('الأهداف والمستهدفات', 'Objectives and targets')}>
        <h2 className="st-section__title">{L('الأهداف الاستراتيجية والمستهدفات', 'Strategic objectives and targets')} <span className="st-tag st-tag--target">{L('مستهدف', 'target')}</span><small>{L('لا مستهدفات معتمدة في البيانات؛ ما يُعرض مُدخل ينتظر اعتماداً', 'no approved targets exist in the data; what is shown awaits approval')}</small></h2>
        <ObjectivesPanel store={store} setStore={setStore} actuals={actuals} systemRows={systemRows} canEdit={canEdit} user={user} today={today} />
        <div className="st-grid">
          <div className="card st-card"><b>{L('مدخلات المستهدف (غير معتمدة)', 'Target inputs (unapproved)')}</b>
            <div className="st-field"><label htmlFor="t-rate">{L('مستهدف معدل التحصيل (%)', 'Collection-rate target (%)')}</label><input id="t-rate" type="number" className="input" min="1" max="100" step="1" disabled={!canEdit} value={Math.round(targets.collectionRate.value * 100)} onChange={(e) => { const v = Number(e.target.value); if (v >= 1 && v <= 100) editTarget('collectionRate', v / 100); }} /></div>
            <div className="st-field"><label htmlFor="t-amt">{L('المستهدف السنوي للمقبوضات (مليار SAR)', 'Annual receipts target (SAR billion)')}</label><input id="t-amt" type="number" className="input" min="0.1" step="0.5" disabled={!canEdit} value={targets.collectionAmountAnnual.value / 1e9} onChange={(e) => { const v = Number(e.target.value); if (v > 0) editTarget('collectionAmountAnnual', v * 1e9); }} /></div>
            <div className="muted" style={{ fontSize: 12 }}>{B(targets.collectionRate.provenance)} {!canEdit && L('(للعرض فقط — تتطلب صلاحية المراجعة)', '(read-only — needs review permission)')}</div></div>
          <div className="card st-card"><b>{L('الوتيرة المطلوبة', 'Required pace')} <span className="st-tag st-tag--target">{L('محسوبة من مستهدف غير معتمد', 'from an unapproved target')}</span></b>
            <AsyncBlock state={X} onRetry={() => setRetry((n) => n + 1)} height={90}>
              {pace.available ? <div className="rv-tile__value" dir="ltr">{pace.perMonth != null ? fmtMoney(pace.perMonth, { lang }) : L('غير متاح', 'n/a')}<span className="muted" style={{ fontSize: 12 }}> / {L('شهر', 'month')}</span></div> : <div className="rv-empty" style={{ padding: 12 }}><b>{L('البيانات غير متاحة', 'Data not available')}</b><div style={{ fontSize: 12.5 }}>{L('المستهدف السنوي وطني؛ أزل مرشحات الأمانة والمصدر.', 'The annual target is national; clear the Amanah and source filters.')}</div></div>}
              {pace.available && <div className="muted" style={{ fontSize: 12.5 }}>{L(`المتبقي ${fmtMoney(pace.remaining, { lang })} حتى ${planDate} (${pace.monthsLeft.toFixed(1)} شهر)${pace.recentAvgMonthly != null ? `؛ متوسط آخر 3 أشهر مكتملة ${fmtMoney(pace.recentAvgMonthly, { lang })}` : ''}.`, `Remaining ${fmtMoney(pace.remaining, { lang })} to ${planDate} (${pace.monthsLeft.toFixed(1)} months)${pace.recentAvgMonthly != null ? `; average of the last 3 complete months ${fmtMoney(pace.recentAvgMonthly, { lang })}` : ''}.`)}</div>}
            </AsyncBlock></div>
        </div>
      </section>

      <section id="plan" className="st-section" aria-label={L('خطط الإيرادات والنفقات', 'Revenue and expenditure plan')}>
        <h2 className="st-section__title">{L('خطط الإيرادات والنفقات', 'Revenue and expenditure plans')}<small>{L(`الخطة «${plan.name}» · الإصدار ${plan.version || 'غير محفوظ'}`, `Plan “${plan.name}” · version ${plan.version || 'unsaved'}`)}</small></h2>
        <AsyncBlock state={X} onRetry={() => setRetry((n) => n + 1)} height={200}><PlanTable fyMonths={fyMonths} outlook={outlook} fin={fin} financeOk={financeOk} narrowed={narrowed} year={fy} targets={targets} /></AsyncBlock>
      </section>

      <section id="variance" className="st-section" aria-label={L('الفعلي مقابل الخطة', 'Actual vs plan')}>
        <h2 className="st-section__title">{L('الفعلي مقابل الميزانية والمستهدف', 'Actual versus budget and target')} <span className="st-tag st-tag--actual">{L('فعلي', 'actual')}</span></h2>
        <AsyncBlock state={X} onRetry={() => setRetry((n) => n + 1)} height={160}>{x && <VarianceBlock ach={ach} achAvail={achAvail} fin={fin} financeOk={financeOk} />}</AsyncBlock>
        {financeOk && cov && <div className="card st-card"><b>{L('تغطية الإنفاق التشغيلي (أبواب 1–3)', 'Operating-expenditure coverage (chapters 1–3)')}</b> <span className="st-tag st-tag--warn">{L('تجريبية', 'synthetic')}</span><div className="rv-tile__value" dir="ltr">{pct(cov.ratio, L('غير متاحة', 'n/a'))}</div><div className="muted" style={{ fontSize: 12 }}>{B(cov.basis)}</div></div>}
        {!financeOk && <div className="rv-callout">{L('تغطية النفقات وتنفيذ الميزانية: البيانات غير متاحة لهذا النطاق؛ الأساس المحاسبي والنطاق يجب أن يتطابقا مع الإيرادات (وطني، كل المصادر).', 'Expenditure coverage and budget execution: data not available for this scope; the accounting basis and scope must match revenue (national, all sources).')}</div>}
      </section>

      <section id="outlook" className="st-section" aria-label={L('التوقعات والفجوات', 'Forecasts and gaps')}>
        <h2 className="st-section__title">{L('التوقعات والفجوات', 'Forecasts and gaps')}</h2>
        <AsyncBlock state={X} onRetry={() => setRetry((n) => n + 1)} height={260}><ForecastGaps outlook={outlook} fyMonths={fyMonths} forecast={x?.forecast} tvf={tvf} gaps={gaps} snapshot={snapshot} funding={funding} scenarioOn={scenarioOn} canShowFunding={financeOk} /></AsyncBlock>
      </section>

      <section id="scenario" className="st-section" aria-label={L('السيناريوهات', 'Scenarios')}>
        <h2 className="st-section__title">{L('سيناريوهات «ماذا لو»', 'What-if scenarios')} <span className="st-tag st-tag--scenario">{L('سيناريو المستخدم', 'user scenario')}</span><small>{L('جزء من الخطة النشطة؛ لا يغيّر أي بيانات فعلية ولا المستهدفات', 'part of the active plan; changes no actual data and no targets')}</small></h2>
        <ScenarioPanel snapshot={snapshot} targets={targets} scenario={scenario} setScenario={setScenario} planDate={planDate} setPlanDate={setPlanDate} today={today} canEdit={canEdit} financeOk={financeOk} onSaveToRegister={proposeFromScenario} />
      </section>

      <section id="decisions" className="st-section" aria-label={L('المبادرات والقرارات', 'Initiatives and decisions')}>
        <h2 className="st-section__title">{L('المبادرات والقرارات ومتابعة التنفيذ', 'Initiatives, decisions and follow-up')}</h2>
        <ActionRegister register={register} setRegister={setRegister} proposals={proposals} canEdit={canEdit} user={user} today={today} scopeText={scopeText} />
      </section>
      </>)}

      {!assistOpen && <button type="button" className="st-fab" onClick={() => setAssistOpen(true)} aria-label={L('فتح مساعد التخطيط', 'Open the planning assistant')}>{L('مساعد التخطيط', 'Planning assistant')}</button>}
      <AssistantPanel open={assistOpen} onClose={() => setAssistOpen(false)} ctxFactory={ctxFactory} onAction={onAssistAction} prompts={PLANNING_PROMPTS} title={L('مساعد التخطيط', 'Planning assistant')} />
    </div>
  );
}
