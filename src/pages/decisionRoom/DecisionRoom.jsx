import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend } from 'chart.js';
import { useI18n } from '../../context/I18nContext';
import { INVOICES } from '../../data/mock';
import { KSA_PROVINCES } from '../../data/ksaProvinces';
import {
  computeCFOModel, buildIllustrativeModel, computePeriod, PERIOD_MODES, DEFAULT_ASSUMPTIONS, SCENARIO_PRESETS,
  DEFAULT_HEALTH_WEIGHTS, rankAmanahs, worstAmanahByMetric, computeAgingBuckets, anchorToday,
  computeRevenueBridge, computeCollectionSensitivity, computeExpenseSensitivity, computeRevenueSensitivity,
  computeTargetTrendComparison, computePlanVsActual
} from '../../data/cfoModel';
import '../../styles/decision-room.css';

import ExecutiveOverviewTab from './tabs/ExecutiveOverviewTab';
import StrategicTargetsTab from './tabs/StrategicTargetsTab';
import RevenuePlanningTab from './tabs/RevenuePlanningTab';
import ExpensePlanningTab from './tabs/ExpensePlanningTab';
import InvoiceCollectionTab from './tabs/InvoiceCollectionTab';
import FundingCoverageTab from './tabs/FundingCoverageTab';
import ScenarioPlanningTab from './tabs/ScenarioPlanningTab';
import DecisionRoomTab from './tabs/DecisionRoomTab';
import ExecutionMonitoringTab from './tabs/ExecutionMonitoringTab';
import ReportsBoardPackTab from './tabs/ReportsBoardPackTab';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

const MONTH_LABELS = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
  zh: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
};
const PERIOD_MODE_KEY = { toYearEnd: 'pln_period_toYearEnd', annual: 'pln_period_annual', quarterly: 'pln_period_quarterly', monthly: 'pln_period_monthly', months: 'pln_period_months', custom: 'pln_period_custom' };
const HEALTH_BAND_BADGE = { strong: 'badge--green', watch: 'badge--gold', atRisk: 'badge--red' };

const TABS = [
  'executive-overview', 'strategic-targets', 'revenue-planning', 'invoice-collection', 'expense-planning',
  'funding-coverage', 'scenario-planning', 'decision-room', 'execution-monitoring', 'reports-board-pack'
];
const TAB_LABEL_KEY = {
  'executive-overview': 'cfo_tab_overview', 'strategic-targets': 'cfo_tab_targets', 'revenue-planning': 'cfo_tab_revenue',
  'invoice-collection': 'cfo_tab_invcoll', 'expense-planning': 'cfo_tab_expense', 'funding-coverage': 'cfo_tab_funding',
  'scenario-planning': 'cfo_tab_scenario', 'decision-room': 'cfo_tab_decision', 'execution-monitoring': 'cfo_tab_execution',
  'reports-board-pack': 'cfo_tab_reports'
};

function monthLabelAt(periodStart, offset, lang) {
  const d = new Date(`${periodStart}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + offset);
  const labels = MONTH_LABELS[lang] || MONTH_LABELS.en;
  return `${labels[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export default function DecisionRoom() {
  const { t, lang, isRtl } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'executive-overview';
  const setActiveTab = (tab) => setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set('tab', tab); return next; });
  const jumpToTargets = () => setActiveTab('strategic-targets');

  // ---------- Period + Amanah scope (page-global) ----------
  const [periodMode, setPeriodMode] = useState('annual');
  const [months, setMonths] = useState(6);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const { periodStart, periodEnd } = useMemo(
    () => computePeriod(periodMode, { months, from: customFrom, to: customTo }),
    [periodMode, months, customFrom, customTo]
  );
  const monthLabels = useMemo(() => {
    const totalMonths = Math.max(1, Math.ceil((new Date(periodEnd) - new Date(periodStart)) / (1000 * 60 * 60 * 24 * 30.44)) + 1);
    return Array.from({ length: totalMonths + 1 }, (_, i) => monthLabelAt(periodStart, i, lang));
  }, [periodStart, periodEnd, lang]);

  const [amanahFilter, setAmanahFilter] = useState('all');
  const amanahOptions = useMemo(() => {
    const seen = new Map();
    for (const inv of INVOICES) {
      if (!inv.amanahEn || seen.has(inv.amanahEn)) continue;
      seen.set(inv.amanahEn, { key: inv.amanahEn, en: inv.amanahEn, ar: inv.amanahAr, zh: inv.amanah });
    }
    return [...seen.values()].sort((a, b) => a.en.localeCompare(b.en));
  }, []);
  const amanahLabel = (o) => (lang === 'zh' ? o.zh : lang === 'ar' ? o.ar : o.en);
  const scopedInvoices = useMemo(
    () => INVOICES.filter((i) => amanahFilter === 'all' || i.amanahEn === amanahFilter),
    [amanahFilter]
  );

  // ---------- Planning assumptions (session-only state) ----------
  const [assumptions, setAssumptions] = useState(DEFAULT_ASSUMPTIONS);
  const [scenarioKey, setScenarioKey] = useState('base');
  const [savedScenarios, setSavedScenarios] = useState([]);
  const [rankCriterion, setRankCriterion] = useState('revenue');
  const [healthWeights, setHealthWeights] = useState(DEFAULT_HEALTH_WEIGHTS);

  const baseArgs = useMemo(() => ({ invoices: scopedInvoices, periodStart, periodEnd, healthWeights }), [scopedInvoices, periodStart, periodEnd, healthWeights]);

  // ---------- Data Mode: Live (real invoices) vs. Illustrative 2026 Baseline ----------
  // A separate, explicitly-opt-in mode for the user-supplied prototype
  // baseline (see decisionRoomDemoData.ILLUSTRATIVE_BASELINE_2026) — never
  // mixed with real data. buildIllustrativeModel() returns the SAME shape
  // computeCFOModel() does, so every tab below renders either one with zero
  // changes to its own code.
  const [dataMode, setDataMode] = useState('live'); // 'live' | 'illustrative'
  const isIllustrative = dataMode === 'illustrative';

  // ---------- THE single recalculation point ----------
  // Every downstream number on every tab is derived from this one memo.
  // Change any assumption -> this invalidates -> everything recomputes,
  // regardless of which tab happens to be open right now.
  const model = useMemo(
    () => (isIllustrative ? buildIllustrativeModel({ assumptions, healthWeights }) : computeCFOModel({ ...baseArgs, assumptions })),
    [isIllustrative, baseArgs, assumptions, healthWeights]
  );

  const scenarioModels = useMemo(() => (isIllustrative ? {
    base: buildIllustrativeModel({ assumptions: SCENARIO_PRESETS.base, healthWeights }),
    conservative: buildIllustrativeModel({ assumptions: SCENARIO_PRESETS.conservative, healthWeights }),
    optimistic: buildIllustrativeModel({ assumptions: SCENARIO_PRESETS.optimistic, healthWeights }),
    current: model
  } : {
    base: computeCFOModel({ ...baseArgs, assumptions: SCENARIO_PRESETS.base }),
    conservative: computeCFOModel({ ...baseArgs, assumptions: SCENARIO_PRESETS.conservative }),
    optimistic: computeCFOModel({ ...baseArgs, assumptions: SCENARIO_PRESETS.optimistic }),
    current: model
  }), [isIllustrative, baseArgs, healthWeights, model]);

  // Real aging buckets (Invoice & Collection tab) — always from real
  // invoices regardless of Data Mode, since this dataset has no
  // illustrative-baseline invoice population to bucket.
  const agingBuckets = useMemo(() => computeAgingBuckets(scopedInvoices, anchorToday()), [scopedInvoices]);

  const revenueBridge = useMemo(() => computeRevenueBridge({ ...baseArgs, assumptions }), [baseArgs, assumptions]);
  const collectionSensitivity = useMemo(() => computeCollectionSensitivity({ ...baseArgs, assumptions }), [baseArgs, assumptions]);
  const expenseSensitivity = useMemo(() => computeExpenseSensitivity({ ...baseArgs, assumptions }), [baseArgs, assumptions]);
  const revenueSensitivity = useMemo(() => computeRevenueSensitivity({ ...baseArgs, assumptions }), [baseArgs, assumptions]);
  const targetComparison = useMemo(() => computeTargetTrendComparison(model, scenarioModels), [model, scenarioModels]);
  const planVsActual = useMemo(() => computePlanVsActual(model), [model]);

  const byProvinceForMap = useMemo(() => {
    const byIso = new Map(KSA_PROVINCES.map((p) => [p.iso, p]));
    return model.perAmanah.map((s) => ({ ...byIso.get(s.iso), ...s }));
  }, [model.perAmanah]);
  const [mapSelectedIso, setMapSelectedIso] = useState(null);
  const [mapMetric, setMapMetric] = useState('summary');
  const selectedAmanah = useMemo(() => byProvinceForMap.find((p) => p.iso === mapSelectedIso) || null, [byProvinceForMap, mapSelectedIso]);
  const attentionAmanah = useMemo(() => worstAmanahByMetric(model.perAmanah, mapMetric), [model.perAmanah, mapMetric]);
  const rankedAmanahs = useMemo(
    () => rankAmanahs(model.perAmanah.filter((p) => p.count > 0), rankCriterion),
    [model.perAmanah, rankCriterion]
  );
  const jumpToProvince = (iso) => { setMapSelectedIso(iso); setActiveTab('decision-room'); };

  // Bucket rollup for Payment Prioritization — turns the raw per-item list
  // into a forecast-oriented view (each bucket's total weighed against this
  // period's expected collections).
  const paymentBuckets = useMemo(() => {
    const byBucket = { immediate: [], nearTerm: [], planned: [], flexible: [] };
    for (const r of model.paymentPriority) byBucket[r.bucket].push(r);
    const summarize = (rows) => ({
      rows,
      total: rows.reduce((s, r) => s + r.amount, 0),
      realCount: rows.filter((r) => r.real).length,
      demoCount: rows.filter((r) => !r.real).length
    });
    const summary = Object.fromEntries(Object.entries(byBucket).map(([k, rows]) => [k, summarize(rows)]));
    const nearTermTotal = summary.immediate.total + summary.nearTerm.total;
    const nearTermSharePct = model.expectedCollections ? Math.round((nearTermTotal / model.expectedCollections) * 100) : 0;
    return { summary, nearTermTotal, nearTermSharePct };
  }, [model.paymentPriority, model.expectedCollections]);

  const scenarioSelect = (key) => { setAssumptions(SCENARIO_PRESETS[key]); setScenarioKey(key); };
  const onAssumptionsChange = (next) => { setAssumptions(next); setScenarioKey('custom'); };
  const resetToActual = () => { setAssumptions(DEFAULT_ASSUMPTIONS); setScenarioKey('base'); };
  const saveScenario = (name) => {
    setSavedScenarios((prev) => [...prev, {
      id: `${Date.now()}`, name, assumptions: { ...assumptions }, periodStart, periodEnd, amanahFilter,
      createdAt: new Date().toISOString(), resultSummary: { netPosition: model.netPosition, health: model.health.score }
    }]);
  };
  const loadScenario = (s) => { setAssumptions(s.assumptions); setScenarioKey('custom'); };
  const deleteScenario = (id) => setSavedScenarios((prev) => prev.filter((s) => s.id !== id));

  // ---------- CFO Action Plan (recommendations -> editable owner/timeline) ----------
  const [actionPlan, setActionPlan] = useState({});
  const setActionField = (id, field, value) => setActionPlan((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  // Live mode shows SAR Billion (3 decimals, so a ~25M SAR figure reads as
  // "0.025" rather than rounding away) — per explicit earlier feedback that
  // raw-digit SAR figures are awkward at ministry-planning scale.
  // Illustrative mode shows SAR Million instead, per that baseline's own
  // explicit "do NOT display as billions" instruction — the two data modes
  // are at genuinely different real-world scales, so each gets the unit
  // that reads naturally at its own scale.
  const money = isIllustrative
    ? (n) => `${(n / 1e6).toFixed(1)} ${t('pln_unit_million')}`
    : (n) => `${(n / 1e9).toFixed(3)} ${t('pln_unit_billion')}`;
  const recSentence = (r) => `${t(`cfo_risk_${r.riskCategory}`)} — ${t(`cfo_action_${r.action}`)} (${money(r.impactSAR)})`;

  const tabProps = {
    t, lang, isRtl, money, model, assumptions, scenarioKey, onJumpToTargets: jumpToTargets,
    onAssumptionsChange, healthWeights, onHealthWeightsChange: setHealthWeights,
    scenarioSelect, resetToActual, savedScenarios, saveScenario, loadScenario, deleteScenario,
    dataMode, isIllustrative, scopedInvoices, agingBuckets,
    scenarioModels, revenueBridge, collectionSensitivity, expenseSensitivity, revenueSensitivity,
    targetComparison, planVsActual, monthLabels,
    byProvinceForMap, onJumpToProvince: jumpToProvince,
    mapSelectedIso, setMapSelectedIso, mapMetric, setMapMetric, selectedAmanah, attentionAmanah,
    rankedAmanahs, rankCriterion, setRankCriterion,
    paymentBuckets, actionPlan, setActionField, recSentence
  };

  return (
    <div className="grid dr-page" style={{ gap: 14 }}>
      {/* Header + period/Amanah scope */}
      <div className="card card-pad">
        <div className="page-head" style={{ marginBottom: 6 }}>
          <div>
            <div className="page-title" style={{ fontSize: 18 }}>{t('cfo_title')}</div>
            <div className="page-sub">{t('cfo_sub')}</div>
          </div>
          <span className={`badge ${HEALTH_BAND_BADGE[model.health.band]}`}>{model.health.score} · {t(`cfo_health_${model.health.band}`)}</span>
        </div>

        {/* Data Mode toggle: real invoice data vs. the illustrative 2026
            prototype baseline — never mixed, always visibly labeled. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <span className="muted" style={{ fontSize: 12 }}>{t('cfo_datamode_label')}</span>
          <button type="button" className={`btn btn-sm ${dataMode === 'live' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setDataMode('live')}>{t('cfo_datamode_live')}</button>
          <button type="button" className={`btn btn-sm ${isIllustrative ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setDataMode('illustrative')}>{t('cfo_datamode_illustrative')}</button>
          {isIllustrative && <span className="badge badge--gold">{t('dr_demo_badge')}</span>}
        </div>

        {/* Persistent target summary — visible across every tab. */}
        <div className="banner" style={{ marginBottom: 10, fontSize: 12.5 }}>
          <b>{t('cfo_targetcard_title')}:</b> {money(model.expectedCollections)} · {model.expenseCoverage == null ? '—' : `${model.expenseCoverage}%`} {t('cfo_sustainability_coverage')}
        </div>

        <label className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>{t('pln_period_label')}</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {PERIOD_MODES.map((mode) => (
            <button key={mode} type="button" className={`btn btn-sm ${periodMode === mode ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPeriodMode(mode)}>
              {t(PERIOD_MODE_KEY[mode])}
            </button>
          ))}
        </div>
        {periodMode === 'months' && (
          <div style={{ maxWidth: 160, marginBottom: 10 }}>
            <input className="input" type="number" min="1" max="60" value={months} onChange={(e) => setMonths(Number(e.target.value) || 1)} />
          </div>
        )}
        {periodMode === 'custom' && (
          <div className="grid grid-2" style={{ maxWidth: 400, marginBottom: 10 }}>
            <input className="input" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            <input className="input" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <select className="select" style={{ height: 32, width: 'auto', minWidth: 220, paddingInline: 10, fontSize: 12.5 }} value={amanahFilter} onChange={(e) => setAmanahFilter(e.target.value)}>
            <option value="all">{t('dash_amanah_filter_all')}</option>
            {amanahOptions.map((o) => <option key={o.key} value={o.key}>{amanahLabel(o)}</option>)}
          </select>
          <span className="muted" style={{ fontSize: 11.5 }}>{periodStart} → {periodEnd}</span>
        </div>
      </div>

      {/* Second-level tab bar */}
      <nav className="dr-subtabbar" aria-label={t('cfo_title')}>
        {TABS.map((tab) => (
          <button key={tab} type="button" className={`tab dr-subtab${activeTab === tab ? ' active' : ''}`} onClick={() => setActiveTab(tab)}>
            <span className="tab__text">{t(TAB_LABEL_KEY[tab])}</span>
          </button>
        ))}
      </nav>

      {activeTab === 'executive-overview' && <ExecutiveOverviewTab {...tabProps} />}
      {activeTab === 'strategic-targets' && (
        <StrategicTargetsTab
          t={t} money={money} model={model} isIllustrative={isIllustrative} assumptions={assumptions} onAssumptionsChange={onAssumptionsChange}
          scenarioKey={scenarioKey} onScenarioSelect={scenarioSelect} onReset={resetToActual}
          savedScenarios={savedScenarios} onSaveScenario={saveScenario} onLoadScenario={loadScenario} onDeleteScenario={deleteScenario}
          targetComparison={targetComparison} healthWeights={healthWeights} onHealthWeightsChange={setHealthWeights}
        />
      )}
      {activeTab === 'revenue-planning' && <RevenuePlanningTab {...tabProps} />}
      {activeTab === 'invoice-collection' && <InvoiceCollectionTab {...tabProps} />}
      {activeTab === 'expense-planning' && <ExpensePlanningTab {...tabProps} />}
      {activeTab === 'funding-coverage' && <FundingCoverageTab {...tabProps} />}
      {activeTab === 'scenario-planning' && <ScenarioPlanningTab {...tabProps} />}
      {activeTab === 'decision-room' && <DecisionRoomTab {...tabProps} />}
      {activeTab === 'execution-monitoring' && (
        <ExecutionMonitoringTab
          t={t} money={money} assumptions={assumptions} scenarioKey={scenarioKey} onJumpToTargets={jumpToTargets}
          monthLabels={monthLabels} planVsActual={planVsActual} actionPlan={actionPlan} recommendations={model.recommendations}
        />
      )}
      {activeTab === 'reports-board-pack' && <ReportsBoardPackTab {...tabProps} />}
    </div>
  );
}
