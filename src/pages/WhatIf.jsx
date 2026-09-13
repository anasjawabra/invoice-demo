import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  ArcElement, RadialLinearScale, Filler, Tooltip, Legend
} from 'chart.js';
import { Bar, Line, Doughnut, Radar } from 'react-chartjs-2';
import { useI18n } from '../context/I18nContext';
import { fmtMoney } from '../data/mock';
import { KSA_PROVINCES, KSA_PROVINCES_VIEWBOX } from '../data/ksaProvinces';
import {
  LEVER_BOUNDS, simulate, evaluateTarget, leverWaterfall, leverScorecard
} from '../data/whatIfModel';
import { buildStrategicContext, runInsightEngine, runScenarioInsights, insightText, insightTitle, CATEGORY_COLOR } from '../data/insightEngine';
import AgentThinking from '../components/ai/AgentThinking';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, RadialLinearScale, Filler, Tooltip, Legend);

const pick = (lang, en, ar, zh) => (lang === 'ar' ? ar : lang === 'zh' ? zh : en);
const provinceName = (p, lang) => (lang === 'ar' ? p.nameAr : p.nameEn);

const LEVER_LABEL = {
  invoicingGrowthPct: { label: { en: 'Invoicing growth', ar: 'نمو الفوترة', zh: '开票增长' }, unit: '%' },
  collectionRateDeltaPts: { label: { en: 'Collection rate improvement', ar: 'تحسين معدل التحصيل', zh: '收缴率提升' }, unit: 'pt' },
  exclusionsRecoveredPct: { label: { en: 'Exclusions recovered', ar: 'استرداد المستبعدات', zh: '已恢复的排除金额' }, unit: '%' }
};
function leverName(key, lang) {
  const l = LEVER_LABEL[key].label;
  return lang === 'ar' ? l.ar : lang === 'zh' ? l.zh : l.en;
}
const LEVER_COLOR = {
  invoicingGrowthPct: 'rgba(0, 90, 150, 0.75)',
  collectionRateDeltaPts: 'rgba(0, 102, 4, 0.75)',
  exclusionsRecoveredPct: 'rgba(202, 160, 0, 0.8)'
};

const EXCL_KEYS = ['duplicate', 'appeal', 'invalid_debtor', 'enforcement'];
const EXCL_LABEL = {
  duplicate: { en: 'Duplicate invoices', ar: 'فواتير مكررة', zh: '重复发票' },
  appeal: { en: 'Under appeal / dispute', ar: 'تحت الاعتراض / النزاع', zh: '申诉/争议中' },
  invalid_debtor: { en: 'Struck-off registry / deceased debtor', ar: 'سجل مشطوب / مدين متوفى', zh: '注销登记/债务人已故' },
  enforcement: { en: 'Referred to enforcement', ar: 'محالة للتنفيذ', zh: '已移交强制执行' }
};
const exclLabel = (k, lang) => (lang === 'ar' ? EXCL_LABEL[k].ar : lang === 'zh' ? EXCL_LABEL[k].zh : EXCL_LABEL[k].en);

function rateColor(rate) {
  return rate >= 70 ? 'rgba(0, 102, 4, 0.8)' : rate >= 40 ? 'rgba(202, 160, 0, 0.85)' : 'rgba(175, 8, 24, 0.8)';
}
function badgeClassFor(category) {
  const c = CATEGORY_COLOR[category];
  return c === 'gray' ? 'badge' : `badge badge--${c}`;
}
function ragFor(pct, good = 95, ok = 70) {
  return pct >= good ? 'green' : pct >= ok ? 'gold' : 'red';
}
function ragLabel(color, lang) {
  const map = {
    green: { en: 'On track', ar: 'على المسار', zh: '进展正常' },
    gold: { en: 'Needs attention', ar: 'يحتاج متابعة', zh: '需要关注' },
    red: { en: 'Critical', ar: 'حرج', zh: '严重' }
  };
  return lang === 'ar' ? map[color].ar : lang === 'zh' ? map[color].zh : map[color].en;
}

export default function WhatIf() {
  const { t, lang, isRtl } = useI18n();
  const nav = useNavigate();

  // Single strategic context — baseline, provinces, exclusions, trend/forecast,
  // lever impacts — computed once from the live data and shared by every
  // chart, KPI tile, and insight detector on this page, so nothing can drift.
  const ctx = useMemo(() => buildStrategicContext(), []);
  const { base, provinces: provinceStats, excl, history, forecast, avgGrowth, band, coverageForecast, coverageBand, impacts } = ctx;
  const worst = useMemo(() => [...provinceStats].sort((a, b) => a.rate - b.rate).slice(0, 6), [provinceStats]);

  // ---------- Level 2 state: target + levers (existing scenario model) ----------
  const [targetType, setTargetType] = useState('opex');
  const [targetValue, setTargetValue] = useState(95);
  const [levers, setLevers] = useState({ invoicingGrowthPct: 0, collectionRateDeltaPts: 0, exclusionsRecoveredPct: 0 });

  const sim = useMemo(() => simulate(base, levers), [base, levers]);
  const evalResult = useMemo(() => evaluateTarget(base, sim, targetType, targetValue), [base, sim, targetType, targetValue]);
  const waterfall = useMemo(() => leverWaterfall(base, levers), [base, levers]);
  const scorecard = useMemo(() => leverScorecard(base), [base]);

  function setTargetTypeAndDefault(type) {
    setTargetType(type);
    setTargetValue(type === 'opex' ? 95 : base.opex);
  }
  function setLever(key, value) {
    setLevers((prev) => ({ ...prev, [key]: value }));
  }
  function resetLevers() {
    setLevers({ invoicingGrowthPct: 0, collectionRateDeltaPts: 0, exclusionsRecoveredPct: 0 });
  }

  // ---------- Level 1/3: overview, trend/forecast, composition, map ----------
  const coverageHistory = useMemo(() => history.map((v) => Math.round((v / base.opex) * 1000) / 10), [history, base.opex]);

  const [mapMetric, setMapMetric] = useState('rate');
  const [selectedIso, setSelectedIso] = useState(null);
  const maxGross = useMemo(() => Math.max(...provinceStats.map((p) => p.gross), 1), [provinceStats]);
  const provinceMap = useMemo(() => {
    const statsByIso = new Map(provinceStats.map((p) => [p.iso, p]));
    return KSA_PROVINCES.filter((p) => statsByIso.has(p.iso)).map((p) => ({ ...p, ...statsByIso.get(p.iso) }));
  }, [provinceStats]);
  const selectedProvince = useMemo(() => provinceMap.find((p) => p.iso === selectedIso) || null, [provinceMap, selectedIso]);

  function provinceFill(p) {
    if (mapMetric === 'gross') return `rgba(0, 90, 150, ${(0.15 + (p.gross / maxGross) * 0.65).toFixed(2)})`;
    return rateColor(p.rate).replace('0.8', (0.3 + (p.rate / 100) * 0.5).toFixed(2)).replace('0.85', (0.3 + (p.rate / 100) * 0.5).toFixed(2));
  }

  // ---------- Charts ----------
  const trendLabels = ['T-5', 'T-4', 'T-3', 'T-2', 'T-1', 'T0', 'T+1', 'T+2', 'T+3'];

  const collectedTrendData = useMemo(() => {
    const lowerBound = [null, null, null, null, null, history[5], ...forecast.map((v, i) => v - band[i])];
    const upperBound = [null, null, null, null, null, history[5], ...forecast.map((v, i) => v + band[i])];
    const historical = [...history, null, null, null];
    const proj = [null, null, null, null, null, history[5], ...forecast];
    return {
      labels: trendLabels,
      datasets: [
        { label: 'Lower', data: lowerBound, borderWidth: 0, pointRadius: 0, fill: false },
        { label: pick(lang, 'Forecast range', 'نطاق التوقع', '预测区间'), data: upperBound, borderWidth: 0, pointRadius: 0, backgroundColor: 'rgba(0, 90, 150, 0.14)', fill: '-1' },
        { label: pick(lang, 'Historical', 'تاريخي', '历史'), data: historical, borderColor: 'rgba(0, 102, 4, 0.85)', backgroundColor: 'rgba(0, 102, 4, 0.85)', tension: 0.3, pointRadius: 3, fill: false },
        { label: pick(lang, 'Forecast', 'توقع', '预测'), data: proj, borderColor: 'rgba(0, 90, 150, 0.9)', backgroundColor: 'rgba(0, 90, 150, 0.9)', borderDash: [6, 4], tension: 0.3, pointRadius: 3, fill: false }
      ]
    };
  }, [history, forecast, band, lang]);

  const coverageTrendData = useMemo(() => {
    const lowerBound = [null, null, null, null, null, coverageHistory[5], ...coverageForecast.map((v, i) => v - coverageBand[i])];
    const upperBound = [null, null, null, null, null, coverageHistory[5], ...coverageForecast.map((v, i) => v + coverageBand[i])];
    const historical = [...coverageHistory, null, null, null];
    const proj = [null, null, null, null, null, coverageHistory[5], ...coverageForecast];
    return {
      labels: trendLabels,
      datasets: [
        { label: 'Lower', data: lowerBound, borderWidth: 0, pointRadius: 0, fill: false },
        { label: pick(lang, 'Forecast range', 'نطاق التوقع', '预测区间'), data: upperBound, borderWidth: 0, pointRadius: 0, backgroundColor: 'rgba(202, 160, 0, 0.16)', fill: '-1' },
        { label: pick(lang, 'Historical', 'تاريخي', '历史'), data: historical, borderColor: 'rgba(0, 102, 4, 0.85)', backgroundColor: 'rgba(0, 102, 4, 0.85)', tension: 0.3, pointRadius: 3, fill: false },
        { label: pick(lang, 'Forecast', 'توقع', '预测'), data: proj, borderColor: 'rgba(202, 160, 0, 0.95)', backgroundColor: 'rgba(202, 160, 0, 0.95)', borderDash: [6, 4], tension: 0.3, pointRadius: 3, fill: false }
      ]
    };
  }, [coverageHistory, coverageForecast, coverageBand, lang]);

  const lineOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { filter: (item) => item.text !== 'Lower', font: { size: 10.5 } } }, tooltip: { rtl: isRtl } },
    scales: {
      x: { reverse: isRtl, ticks: { color: '#4A4A4A', font: { size: 10.5 } }, grid: { display: false } },
      y: { ticks: { color: '#4A4A4A', font: { size: 10.5 } }, grid: { color: 'rgba(0,0,0,0.06)' } }
    }
  }), [isRtl]);

  const gapGaugeData = useMemo(() => {
    const current = evalResult.current;
    const achieved = Math.min(current, targetValue);
    const remainder = Math.max(targetValue - current, 0);
    const surplus = Math.max(current - targetValue, 0);
    return {
      labels: [
        pick(lang, 'Achieved toward target', 'محقق من الهدف', '已达成部分'),
        pick(lang, 'Gap to target', 'الفجوة عن الهدف', '距目标差距'),
        pick(lang, 'Surplus above target', 'فائض فوق الهدف', '超出目标部分')
      ],
      datasets: [{ data: [achieved, remainder, surplus], backgroundColor: ['rgba(0, 102, 4, 0.85)', 'rgba(175, 8, 24, 0.75)', 'rgba(0, 90, 150, 0.75)'], borderWidth: 0 }]
    };
  }, [evalResult, targetValue, lang]);

  const compositionData = useMemo(() => ({
    labels: [pick(lang, 'Collected', 'محصَّل', '已收缴'), pick(lang, 'Uncollected', 'غير محصَّل', '未收缴')],
    datasets: [{ data: [base.collectedValue, base.uncollectedValue], backgroundColor: ['rgba(0, 102, 4, 0.85)', 'rgba(175, 8, 24, 0.75)'], borderWidth: 0 }]
  }), [base, lang]);

  const doughnutOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { font: { size: 10.5 }, boxWidth: 10 } }, tooltip: { rtl: isRtl } }
  }), [isRtl]);

  const exclusionChartData = useMemo(() => ({
    labels: EXCL_KEYS.map((k) => exclLabel(k, lang)),
    datasets: [{ data: EXCL_KEYS.map((k) => excl[k].value), backgroundColor: ['rgba(175, 8, 24, 0.7)', 'rgba(230, 126, 34, 0.75)', 'rgba(202, 160, 0, 0.8)', 'rgba(0, 90, 150, 0.75)'], borderRadius: 4 }]
  }), [excl, lang]);

  const barOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { rtl: isRtl, callbacks: { label: (ctx) => `${fmtMoney(ctx.parsed.x ?? ctx.parsed.y)} SAR` } } },
    scales: {
      x: { reverse: isRtl, ticks: { color: '#4A4A4A', font: { size: 10 } }, grid: { display: false } },
      y: { beginAtZero: true, ticks: { color: '#4A4A4A', font: { size: 10 }, callback: (v) => fmtMoney(v) }, grid: { color: 'rgba(0,0,0,0.06)' } }
    }
  }), [isRtl]);

  const leaderboardData = useMemo(() => ({
    labels: worst.map((p) => provinceName(p, lang)),
    datasets: [{ data: worst.map((p) => p.rate), backgroundColor: worst.map((p) => rateColor(p.rate)), borderRadius: 4 }]
  }), [worst, lang]);

  const leaderboardOptions = useMemo(() => ({
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { rtl: isRtl, callbacks: { label: (ctx) => `${ctx.parsed.x}%` } } },
    scales: {
      x: { min: 0, max: 100, ticks: { color: '#4A4A4A', font: { size: 10 }, callback: (v) => `${v}%` }, grid: { color: 'rgba(0,0,0,0.06)' } },
      y: { reverse: isRtl, ticks: { color: '#4A4A4A', font: { size: 10.5 } }, grid: { display: false } }
    }
  }), [isRtl]);

  const waterfallData = useMemo(() => ({
    labels: [pick(lang, 'Collected outcome', 'نتيجة التحصيل', '收缴结果')],
    datasets: [
      { label: pick(lang, 'Current baseline', 'الأساس الحالي', '当前基线'), data: [base.collectedValue], backgroundColor: 'rgba(120,120,120,0.55)' },
      ...waterfall.map((seg) => ({ label: leverName(seg.key, lang), data: [Math.max(seg.contribution, 0)], backgroundColor: LEVER_COLOR[seg.key] }))
    ]
  }), [base, waterfall, lang]);

  const waterfallOptions = useMemo(() => ({
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 10 } }, tooltip: { rtl: isRtl, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmtMoney(Math.round(ctx.parsed.x))} SAR` } } },
    scales: {
      x: { stacked: true, reverse: isRtl, ticks: { color: '#4A4A4A', font: { size: 10 }, callback: (v) => fmtMoney(v) }, grid: { color: 'rgba(0,0,0,0.06)' } },
      y: { stacked: true, ticks: { display: false }, grid: { display: false } }
    }
  }), [isRtl]);

  const radarData = useMemo(() => ({
    labels: [pick(lang, 'Impact', 'الأثر', '影响力'), pick(lang, 'Speed to implement', 'سرعة التنفيذ', '实施速度'), pick(lang, 'Confidence', 'مستوى الثقة', '置信度')],
    datasets: scorecard.map((s) => ({
      label: leverName(s.key, lang),
      data: [s.impact, s.speed, s.confidence],
      borderColor: LEVER_COLOR[s.key],
      backgroundColor: LEVER_COLOR[s.key].replace('0.75', '0.15').replace('0.8', '0.15'),
      pointBackgroundColor: LEVER_COLOR[s.key]
    }))
  }), [scorecard, lang]);

  const radarOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 10 } }, tooltip: { rtl: isRtl } },
    scales: { r: { min: 0, max: 100, ticks: { display: false }, pointLabels: { font: { size: 10.5 } }, grid: { color: 'rgba(0,0,0,0.08)' } } }
  }), [isRtl]);

  // ---------- Level 2 gated "scenario" AI analysis (existing) ----------
  const [phase, setPhase] = useState('idle');
  const [tick, setTick] = useState(0);

  // Every insight below is DETECTED, not scripted — see src/data/insightEngine.js.
  // The count, ranking, and even which findings appear at all is a direct
  // function of the live numbers; nothing here is a fixed sequence of steps.
  const scenarioInsights = useMemo(
    () => runScenarioInsights(base, levers, sim, evalResult, targetType, targetValue, impacts),
    [base, levers, sim, evalResult, targetType, targetValue, impacts]
  );

  useEffect(() => {
    if (phase !== 'analyzing') return undefined;
    const totalTicks = scenarioInsights.length * 2;
    if (tick >= totalTicks) {
      const id = window.setTimeout(() => setPhase('done'), 300);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => setTick((n) => n + 1), 550);
    return () => window.clearTimeout(id);
  }, [phase, tick, scenarioInsights.length]);
  const activeStepIndex = Math.min(Math.floor(tick / 2), scenarioInsights.length - 1);
  const activeRevealed = tick % 2 === 1;
  function runAnalysis() {
    setTick(0);
    setPhase('analyzing');
  }

  // ---------- Executive Briefing — strategic insight engine, independent of the sliders ----------
  const [advPhase, setAdvPhase] = useState('idle');
  const [advTick, setAdvTick] = useState(0);
  const strategicInsights = useMemo(() => runInsightEngine(ctx), [ctx]);

  useEffect(() => {
    if (advPhase !== 'analyzing') return undefined;
    const totalTicks = strategicInsights.length * 2;
    if (advTick >= totalTicks) {
      const id = window.setTimeout(() => setAdvPhase('done'), 300);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => setAdvTick((n) => n + 1), 550);
    return () => window.clearTimeout(id);
  }, [advPhase, advTick, strategicInsights.length]);
  const advActiveIndex = Math.min(Math.floor(advTick / 2), strategicInsights.length - 1);
  const advActiveRevealed = advTick % 2 === 1;
  function runAdvancedAnalysis() {
    setAdvTick(0);
    setAdvPhase('analyzing');
  }

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="page-head">
        <div>
          <div className="page-title">{pick(lang, 'Strategic Dashboard', 'اللوحة الاستراتيجية', '战略仪表盘')}</div>
          <div className="page-sub">
            {pick(lang, 'Strategic overview → forecast → drill-down → What-If modeling → AI recommendation, in one journey.', 'نظرة استراتيجية ← توقع ← تفصيل ← نمذجة افتراضية ← توصية الذكاء الاصطناعي، في رحلة واحدة.', '战略概览 → 预测 → 下钻分析 → 假设情景建模 → AI 建议，一站式呈现。')}
          </div>
        </div>
      </div>

      {/* ---------- Level 1: Strategic Overview — every metric carries a target + RAG status ---------- */}
      <div className="grid grid-5">
        <div className="card card-pad">
          <div className="kpi__value" dir="ltr">{fmtMoney(base.opex)}</div>
          <div className="kpi__label">{pick(lang, 'Opex Baseline (illustrative)', 'أساس المصروفات التشغيلية (توضيحي)', '运营支出基准（示意）')}</div>
        </div>
        <div className="card card-pad">
          <div className="kpi__value" dir="ltr">
            {fmtMoney(base.netInvoiced)}{' '}
            <span style={{ fontSize: 12, fontWeight: 800, color: history[5] >= history[4] ? 'var(--green)' : 'var(--red)' }}>
              {history[5] >= history[4] ? '▲' : '▼'}
            </span>
          </div>
          <div className="kpi__label">{pick(lang, 'Net Invoiced (vs prior period)', 'صافي الفوترة (مقابل الفترة السابقة)', '净开票额（较上期）')}</div>
        </div>
        {[
          { value: fmtMoney(base.collectedValue), label: pick(lang, 'Collected', 'إجمالي المحصَّل', '已收缴'), color: ragFor(base.collectionRate, 90, 70) },
          { value: `${base.collectionRate}%`, label: pick(lang, 'Collection Rate (target 70%)', 'معدل التحصيل (الهدف 70%)', '收缴率（目标70%）'), color: ragFor(base.collectionRate, 90, 70) },
          { value: `${base.opexCoveragePct}%`, label: pick(lang, 'Opex Coverage (target 100%)', 'تغطية المصروفات التشغيلية (الهدف 100%)', '运营支出覆盖率（目标100%）'), color: ragFor(base.opexCoveragePct, 100, 70) }
        ].map((tile) => (
          <div className="card card-pad" style={{ borderInlineStart: `4px solid var(--${tile.color === 'gold' ? 'gold' : tile.color})` }} key={tile.label}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="kpi__value" dir="ltr">{tile.value}</div>
              <span className={`badge badge--${tile.color}`} style={{ fontSize: 10 }}>{ragLabel(tile.color, lang)}</span>
            </div>
            <div className="kpi__label">{tile.label}</div>
          </div>
        ))}
      </div>

      {/* ---------- Executive Briefing — detected, not scripted ---------- */}
      <div className="card card-pad">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="page-title" style={{ fontSize: 16 }}>{pick(lang, 'Executive Briefing', 'الإحاطة التنفيذية', '高管简报')}</div>
            <div className="page-sub">{pick(lang, `${strategicInsights.length} findings detected live from the current data — outliers, concentration risk, trend shifts, and forecast shortfalls`, `${strategicInsights.length} ملاحظة مكتشفة مباشرة من البيانات الحالية — حالات شاذة، مخاطر تركّز، تحولات في الاتجاه، وقصور في التوقعات`, `从当前数据中实时检测到 ${strategicInsights.length} 项发现——异常值、集中度风险、趋势变化及预测缺口`)}</div>
          </div>
          {advPhase === 'idle' && (
            <button type="button" className="btn btn-primary btn-sm" onClick={runAdvancedAnalysis}>
              {pick(lang, 'Generate Briefing', 'إنشاء الإحاطة', '生成简报')}
            </button>
          )}
        </div>

        {advPhase === 'analyzing' && (
          <div className="ai-timeline" style={{ marginTop: 12 }}>
            {strategicInsights.slice(0, advActiveIndex + 1).map((ins, i) => {
              const isActive = i === advActiveIndex;
              const revealed = !isActive || advActiveRevealed;
              let cls = 'ai-step';
              cls += isActive ? (revealed ? ' ai-step--done' : ' ai-step--running') : ' ai-step--done';
              return (
                <div className={cls} key={ins.id}>
                  <div className="ai-step__tag">{i + 1}</div>
                  <div className="ai-step__title">{insightTitle(ins, lang)}</div>
                  <div className="ai-step__detail">{revealed ? <span>{insightText(ins, lang)}</span> : <AgentThinking />}</div>
                </div>
              );
            })}
          </div>
        )}

        {advPhase === 'done' && (
          <div className="ai-conclusion" style={{ marginTop: 12 }}>
            <div className="ai-conclusion__label">{t('ai_conclusion')}</div>
            <div className="ai-conclusion__text" style={{ fontWeight: 700, fontSize: 12.5, lineHeight: 1.7 }}>
              {strategicInsights.slice(0, 2).map((s) => insightText(s, lang)).join(' ')}
            </div>
            <div className="grid" style={{ gap: 8, marginTop: 12 }}>
              {strategicInsights.map((ins) => (
                <div key={ins.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 8, background: 'rgba(0,0,0,0.02)' }}>
                  <span className={badgeClassFor(ins.category)} style={{ flexShrink: 0 }}>{ins.severity}</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 12.5 }}>{insightTitle(ins, lang)}</div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{insightText(ins, lang)}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="ai-conclusion__action">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdvPhase('idle')}>
                {pick(lang, 'Close', 'إغلاق', '关闭')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ---------- Trend & forecast ---------- */}
      <div className="grid grid-2">
        <div className="card chart-box" style={{ height: 300 }}>
          <div className="page-title" style={{ fontSize: 15 }}>{pick(lang, 'Collected — Trend & Forecast', 'المحصَّل — الاتجاه والتوقع', '已收缴 — 趋势与预测')}</div>
          <div className="page-sub" style={{ fontSize: 11 }}>{pick(lang, 'Illustrative trend ending at today\'s real figure, projected forward', 'اتجاه توضيحي ينتهي عند الرقم الفعلي اليوم، مع إسقاط للأمام', '示意性趋势，终点为今日真实数值，并向前预测')}</div>
          <div style={{ height: 220 }}>
            <Line data={collectedTrendData} options={lineOptions} />
          </div>
        </div>
        <div className="card chart-box" style={{ height: 300 }}>
          <div className="page-title" style={{ fontSize: 15 }}>{pick(lang, 'Opex Coverage — Trend & Forecast', 'تغطية المصروفات التشغيلية — الاتجاه والتوقع', '运营支出覆盖率 — 趋势与预测')}</div>
          <div className="page-sub" style={{ fontSize: 11 }}>{pick(lang, `Assumes a constant ${fmtMoney(base.opex)} SAR opex baseline over the window`, `بافتراض ثبات أساس المصروفات التشغيلية عند ${fmtMoney(base.opex)} ريال خلال هذه الفترة`, `假设该期间运营支出基准保持在 ${fmtMoney(base.opex)} 里亚尔不变`)}</div>
          <div style={{ height: 220 }}>
            <Line data={coverageTrendData} options={lineOptions} />
          </div>
        </div>
      </div>

      {/* ---------- Composition + gap gauge ---------- */}
      <div className="grid grid-3">
        <div className="card chart-box" style={{ height: 280 }}>
          <div className="page-title" style={{ fontSize: 14 }}>{pick(lang, 'Progress to Target', 'التقدم نحو الهدف', '目标达成进度')}</div>
          <div style={{ height: 220 }}>
            <Doughnut data={gapGaugeData} options={doughnutOptions} />
          </div>
        </div>
        <div className="card chart-box" style={{ height: 280 }}>
          <div className="page-title" style={{ fontSize: 14 }}>{pick(lang, 'Net Invoiced Composition', 'تكوين صافي الفوترة', '净开票额构成')}</div>
          <div style={{ height: 220 }}>
            <Doughnut data={compositionData} options={doughnutOptions} />
          </div>
        </div>
        <div className="card chart-box" style={{ height: 280 }}>
          <div className="page-title" style={{ fontSize: 14 }}>{pick(lang, 'Exclusions by Category', 'المستبعدات حسب الفئة', '按类别划分的排除项')}</div>
          <div style={{ height: 220 }}>
            <Bar data={exclusionChartData} options={barOptions} />
          </div>
        </div>
      </div>

      {/* ---------- Level 3: Map + leaderboard drill-down ---------- */}
      <div className="grid grid-2">
        <div className="card card-pad">
          <div className="page-head" style={{ marginBottom: 8 }}>
            <div>
              <div className="page-title" style={{ fontSize: 15 }}>{pick(lang, 'Amanah / City Map', 'خريطة الأمانات / المدن', '阿马纳/城市地图')}</div>
              <div className="page-sub" style={{ fontSize: 11 }}>{pick(lang, 'Click a region for details', 'اضغط على منطقة لعرض التفاصيل', '点击区域查看详情')}</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" className={`btn btn-sm ${mapMetric === 'rate' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMapMetric('rate')}>
                {pick(lang, 'Rate', 'المعدل', '比率')}
              </button>
              <button type="button" className={`btn btn-sm ${mapMetric === 'gross' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMapMetric('gross')}>
                {pick(lang, 'Gross', 'الإجمالي', '总额')}
              </button>
            </div>
          </div>
          <svg viewBox={KSA_PROVINCES_VIEWBOX} style={{ width: '100%', height: 'auto', display: 'block' }}>
            {provinceMap.map((p) => (
              <path
                key={p.iso}
                d={p.path}
                fill={provinceFill(p)}
                stroke={selectedIso === p.iso ? 'var(--primary)' : 'rgba(42, 42, 42, 0.35)'}
                strokeWidth={selectedIso === p.iso ? 3 : 1}
                strokeLinejoin="round"
                style={{ cursor: 'pointer' }}
                onClick={() => setSelectedIso(p.iso === selectedIso ? null : p.iso)}
              >
                <title>{provinceName(p, lang)} — {p.rate}%</title>
              </path>
            ))}
          </svg>
          {selectedProvince && (
            <div className="card" style={{ marginTop: 10, padding: 10, background: 'rgba(0,0,0,0.02)' }}>
              <div style={{ fontWeight: 900 }}>{provinceName(selectedProvince, lang)}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }} dir="ltr">
                {fmtMoney(selectedProvince.gross)} SAR gross · {fmtMoney(selectedProvince.collected)} SAR collected · {selectedProvince.rate}% rate
              </div>
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => nav('/invoices')}>
                {isRtl ? `${pick(lang, 'View invoices', 'عرض الفواتير', '查看发票')} ←` : `${pick(lang, 'View invoices', 'عرض الفواتير', '查看发票')} →`}
              </button>
            </div>
          )}
        </div>

        <div className="card chart-box" style={{ height: 460 }}>
          <div className="page-title" style={{ fontSize: 15 }}>{pick(lang, 'Underperforming Amanahs', 'الأمانات الأقل أداءً', '表现落后的阿马纳')}</div>
          <div className="page-sub" style={{ fontSize: 11 }}>{pick(lang, 'Ranked by collection rate, lowest first', 'مرتبة حسب معدل التحصيل، من الأدنى', '按收缴率从低到高排序')}</div>
          <div style={{ height: 380 }}>
            <Bar data={leaderboardData} options={leaderboardOptions} />
          </div>
        </div>
      </div>

      {/* ---------- Level 2: What-If Modeling ---------- */}
      <div className="card card-pad">
        <div className="page-title" style={{ fontSize: 16 }}>{pick(lang, 'What-If Modeling', 'نمذجة السيناريوهات الافتراضية', '假设情景建模')}</div>
        <div className="page-sub">{pick(lang, 'Set a financial target, adjust the levers, and let the AI assess achievability and priority actions.', 'حدّد هدفًا ماليًا، عدّل المتغيرات، ودع الذكاء الاصطناعي يقيّم قابلية التحقيق والإجراءات ذات الأولوية.', '设定财务目标，调整变量，让 AI 评估可达成性并给出优先行动建议。')}</div>
        <div className="hr" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className={`btn btn-sm ${targetType === 'opex' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTargetTypeAndDefault('opex')}>
              {pick(lang, 'Opex Coverage %', 'نسبة تغطية المصروفات التشغيلية', '运营支出覆盖率 %')}
            </button>
            <button type="button" className={`btn btn-sm ${targetType === 'collections' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTargetTypeAndDefault('collections')}>
              {pick(lang, 'Collections Target (SAR)', 'هدف التحصيل (ريال)', '收缴目标（里亚尔）')}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
              {targetType === 'opex' ? pick(lang, 'Target coverage %', 'نسبة التغطية المستهدفة', '目标覆盖率 %') : pick(lang, 'Target SAR', 'المبلغ المستهدف (ريال)', '目标金额（里亚尔）')}
            </span>
            <input type="number" className="select" style={{ width: 160 }} value={targetValue} min={targetType === 'opex' ? 1 : 0} max={targetType === 'opex' ? 200 : undefined} onChange={(e) => setTargetValue(Number(e.target.value))} dir="ltr" />
          </div>
        </div>

        <div className="hr" />
        <div className="page-head" style={{ marginBottom: 6 }}>
          <div>
            <div className="page-title" style={{ fontSize: 14 }}>{pick(lang, 'Levers', 'المتغيرات', '可调变量')}</div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={resetLevers}>{pick(lang, 'Reset', 'إعادة تعيين', '重置')}</button>
        </div>
        <div className="grid" style={{ gap: 14 }}>
          {Object.keys(LEVER_BOUNDS).map((key) => {
            const b = LEVER_BOUNDS[key];
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span className="muted" style={{ fontSize: 12, fontWeight: 800, minWidth: 210 }}>
                  {leverName(key, lang)}: +{levers[key]}{LEVER_LABEL[key].unit}
                </span>
                <input type="range" min={b.min} max={b.max} step={b.step} value={levers[key]} onChange={(e) => setLever(key, Number(e.target.value))} style={{ flex: 1, minWidth: 160, accentColor: LEVER_COLOR[key] }} aria-label={leverName(key, lang)} />
              </div>
            );
          })}
        </div>

        <div className="grid grid-4" style={{ marginTop: 14 }}>
          <div className="card card-pad">
            <div className="kpi__value" dir="ltr">{fmtMoney(base.netInvoiced)} → {fmtMoney(Math.round(sim.netInvoiced))}</div>
            <div className="kpi__label">{pick(lang, 'Net Invoiced', 'صافي الفوترة', '净开票额')}</div>
          </div>
          <div className="card card-pad" style={{ borderInlineStart: '4px solid var(--green)' }}>
            <div className="kpi__value" dir="ltr">{base.collectionRate}% → {sim.collectionRate.toFixed(1)}%</div>
            <div className="kpi__label">{pick(lang, 'Collection Rate', 'معدل التحصيل', '收缴率')}</div>
          </div>
          <div className="card card-pad" style={{ borderInlineStart: '4px solid var(--green)' }}>
            <div className="kpi__value" dir="ltr">{fmtMoney(base.collectedValue)} → {fmtMoney(Math.round(sim.collectedValue))}</div>
            <div className="kpi__label">{pick(lang, 'Collected', 'إجمالي المحصَّل', '已收缴')}</div>
          </div>
          <div className="card card-pad" style={{ borderInlineStart: `4px solid ${evalResult.achievableNow ? 'var(--green)' : 'var(--red)'}` }}>
            <div className="kpi__value" dir="ltr">{base.opexCoveragePct}% → {sim.opexCoveragePct.toFixed(1)}%</div>
            <div className="kpi__label">{pick(lang, 'Opex Coverage', 'تغطية المصروفات التشغيلية', '运营支出覆盖率')}</div>
          </div>
        </div>

        <div className="grid grid-2" style={{ marginTop: 14 }}>
          <div className="card chart-box" style={{ height: 220 }}>
            <div className="page-title" style={{ fontSize: 13 }}>{pick(lang, 'Contribution Waterfall', 'مخطط الإسهامات', '贡献瀑布图')}</div>
            <div style={{ height: 160 }}>
              <Bar data={waterfallData} options={waterfallOptions} />
            </div>
          </div>
          <div className="card chart-box" style={{ height: 220 }}>
            <div className="page-title" style={{ fontSize: 13 }}>{pick(lang, 'Lever Scorecard', 'بطاقة تقييم المتغيرات', '变量评分卡')}</div>
            <div style={{ height: 160 }}>
              <Radar data={radarData} options={radarOptions} />
            </div>
          </div>
        </div>

        <div className="card card-pad" style={{ marginTop: 14, borderInlineStart: `4px solid ${evalResult.achievableNow ? 'var(--green)' : evalResult.achievableAtMax ? 'var(--gold)' : 'var(--red)'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 900 }}>
                {evalResult.achievableNow
                  ? pick(lang, '✓ Target achievable with current levers', '✓ الهدف قابل للتحقيق بالإعدادات الحالية', '✓ 当前设置即可达成目标')
                  : evalResult.achievableAtMax
                    ? pick(lang, '△ Achievable only at maximum lever settings', '△ قابل للتحقيق فقط عند أقصى إعدادات للمتغيرات', '△ 仅在变量最大设置下可达成')
                    : pick(lang, "✗ Not achievable within this model's range", '✗ غير قابل للتحقيق ضمن نطاق هذا النموذج', '✗ 在本模型范围内无法达成')}
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                {targetType === 'opex'
                  ? pick(lang, `Gap to target: ${evalResult.gap.toFixed(1)} pts · Max achievable: ${evalResult.maxAchievable}%`, `الفجوة عن الهدف: ${evalResult.gap.toFixed(1)} نقطة · أقصى ما يمكن تحقيقه: ${evalResult.maxAchievable}%`, `距目标差距：${evalResult.gap.toFixed(1)} 个百分点 · 最大可达成：${evalResult.maxAchievable}%`)
                  : pick(lang, `Gap to target: ${fmtMoney(Math.round(evalResult.gap))} SAR · Max achievable: ${fmtMoney(Math.round(evalResult.maxAchievable))} SAR`, `الفجوة عن الهدف: ${fmtMoney(Math.round(evalResult.gap))} ريال · أقصى ما يمكن تحقيقه: ${fmtMoney(Math.round(evalResult.maxAchievable))} ريال`, `距目标差距：${fmtMoney(Math.round(evalResult.gap))} 里亚尔 · 最大可达成：${fmtMoney(Math.round(evalResult.maxAchievable))} 里亚尔`)}
              </div>
            </div>
            {phase === 'idle' && (
              <button type="button" className="btn btn-primary btn-sm" onClick={runAnalysis}>
                {pick(lang, 'Run Scenario AI Analysis', 'تشغيل تحليل السيناريو بالذكاء الاصطناعي', '运行情景 AI 分析')}
              </button>
            )}
          </div>

          {phase === 'analyzing' && (
            <div className="ai-timeline" style={{ marginTop: 14 }}>
              {scenarioInsights.slice(0, activeStepIndex + 1).map((ins, i) => {
                const isActive = i === activeStepIndex;
                const revealed = !isActive || activeRevealed;
                let cls = 'ai-step';
                cls += isActive ? (revealed ? ' ai-step--done' : ' ai-step--running') : ' ai-step--done';
                return (
                  <div className={cls} key={ins.id}>
                    <div className="ai-step__tag">{i + 1}</div>
                    <div className="ai-step__title">{insightTitle(ins, lang)}</div>
                    <div className="ai-step__detail">{revealed ? <span>{insightText(ins, lang)}</span> : <AgentThinking />}</div>
                  </div>
                );
              })}
            </div>
          )}

          {phase === 'done' && (
            <div className="ai-conclusion" style={{ marginTop: 14 }}>
              <div className="ai-conclusion__label">{t('ai_conclusion')}</div>
              <div className="grid" style={{ gap: 8 }}>
                {scenarioInsights.map((ins) => (
                  <div key={ins.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 8, background: 'rgba(0,0,0,0.02)' }}>
                    <span className={badgeClassFor(ins.category)} style={{ flexShrink: 0 }}>{ins.severity}</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 12.5 }}>{insightTitle(ins, lang)}</div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{insightText(ins, lang)}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="ai-conclusion__action">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPhase('idle')}>
                  {pick(lang, 'Close', 'إغلاق', '关闭')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
