import React, { useMemo, useState } from 'react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';
import UIIcon from '../components/UIIcon';
import DirectionalIcon from '../components/DirectionalIcon';
import { useNavigate } from 'react-router-dom';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { useI18n } from '../context/I18nContext';
import { INVOICES, fmtMoney, gfsForInvoice, SANAD_ENFORCEMENT } from '../data/mock';
import { computeRevenueByYear } from '../data/reportAnalytics';
import { KSA_PROVINCES_VIEWBOX, KSA_PROVINCES } from '../data/ksaProvinces';
import ProvinceMap from '../components/ProvinceMap';
import { useTheme } from '../context/ThemeContext';
import { chartColor, chartLegend, chartTooltip, getChartTheme } from '../utils/chartTheme';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

// GFS revenue-category colors, keyed by the same codes gfsForInvoice() returns.
const GFS_COLOR = {
  '1421901': 'var(--purple)', // Investment Fees (Foras)
  '1438001': 'var(--orange)', // Penalties & Fines (Mumathil)
  '142113': 'var(--blue)', // Municipal Fees (Baladi)
  '142162': 'var(--teal)' // Commercial License Fees (Amanah Internal Reports)
};

// Amanah -> owning province, derived once from KSA_PROVINCES.
const AMANAH_TO_PROVINCE = Object.fromEntries(
  KSA_PROVINCES.flatMap((p) => p.amanahKeys.map((key) => [key, p.iso]))
);

// The four exclusion categories confirmed across the Mini-BRD and the raw
// meeting transcript: under appeal/dispute, struck-off registry or deceased
// debtor, duplicate, and referred to enforcement. Excluded invoices never
// count toward net-invoiced (the collection-rate denominator) or as
// collected, regardless of what their workflow status says.
function exclusionReasons(inv) {
  const reasons = [];
  if (inv.status === 'duplicate') reasons.push('duplicate');
  if (inv.hasOpenObjection) reasons.push('appeal');
  if (inv.debtorInvalid) reasons.push('invalid_debtor');
  if (inv.collectedVia === 'enforcement') reasons.push('enforcement');
  return reasons;
}
const isExcluded = (inv) => exclusionReasons(inv).length > 0;

const EXCL_LABEL_KEY = {
  duplicate: 'dash_excl_duplicate',
  appeal: 'dash_excl_appeal',
  invalid_debtor: 'dash_excl_invalid_debtor',
  enforcement: 'dash_excl_enforcement'
};
const EXCL_COLOR = { duplicate: 'gold', appeal: 'orange', invalid_debtor: 'red', enforcement: 'indigo' };

function badgeForColor(c) {
  const map = { teal: 'badge--teal', indigo: 'badge--indigo', gold: 'badge--gold', green: 'badge--green', red: 'badge--red', orange: 'badge--orange', blue: 'badge--blue', purple: 'badge--purple' };
  return map[c] || '';
}

// Actual-vs-target ring gauge — same "70% target" benchmark used everywhere
// else in this dashboard, just drawn as a ring (matching the style of the
// official ministry collection-rate infographics) instead of a linear bar.
function RingGauge({ pct, target = 70, size = 84 }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const cx = 50;
  const cy = 50;
  const r = 40;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  const color = pct >= 70 ? 'var(--green)' : pct >= 40 ? 'var(--gold)' : 'var(--red)';
  const tickAngle = (target / 100) * 2 * Math.PI - Math.PI / 2;
  const tx1 = cx + 31 * Math.cos(tickAngle);
  const ty1 = cy + 31 * Math.sin(tickAngle);
  const tx2 = cx + 49 * Math.cos(tickAngle);
  const ty2 = cy + 49 * Math.sin(tickAngle);
  return (
    <svg viewBox="0 0 100 100" width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--line-strong)" strokeWidth="10" />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <line x1={tx1} y1={ty1} x2={tx2} y2={ty2} stroke="var(--txt-mute)" strokeWidth="2" />
      <text x={cx} y={cy + 6} textAnchor="middle" fontSize="20" fontWeight="700" fill="var(--heading)">{Math.round(clamped)}%</text>
    </svg>
  );
}

export default function Dashboard() {
  const { t, lang, isRtl } = useI18n();
  const { theme } = useTheme();
  const nav = useNavigate();
  const chartColors = useMemo(() => getChartTheme(theme), [theme]);

  // Period filter — same real selectable-range pattern used throughout the
  // app (fiscal year, previous month, trailing 3/6/12 months, custom range).
  const anchorToday = useMemo(() => INVOICES.reduce((max, i) => (i.date > max ? i.date : max), INVOICES[0].date), []);
  const currentYear = anchorToday.slice(0, 4);

  const addMonths = (dateStr, delta) => {
    const d = new Date(`${dateStr}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + delta);
    return d.toISOString().slice(0, 10);
  };

  const availableYears = useMemo(() => [...new Set(INVOICES.map((i) => i.date.slice(0, 4)))].sort(), []);

  const [dateFilter, setDateFilter] = useState({ mode: 'all', year: '', from: '', to: '' });

  // Amanah/city filter — independent of the period filter, defaults to "all
  // cities" per the standing rule that no scope filter on this dashboard
  // should default to anything narrower than everything.
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

  const { rangeStart, rangeEnd } = useMemo(() => {
    switch (dateFilter.mode) {
      case 'prevMonth': {
        const d = new Date(`${anchorToday}T00:00:00Z`);
        const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)).toISOString().slice(0, 10);
        const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0)).toISOString().slice(0, 10);
        return { rangeStart: start, rangeEnd: end };
      }
      case '3m':
        return { rangeStart: addMonths(anchorToday, -3), rangeEnd: anchorToday };
      case '6m':
        return { rangeStart: addMonths(anchorToday, -6), rangeEnd: anchorToday };
      case '1y':
        return { rangeStart: addMonths(anchorToday, -12), rangeEnd: anchorToday };
      case 'year':
        return dateFilter.year
          ? { rangeStart: `${dateFilter.year}-01-01`, rangeEnd: `${dateFilter.year}-12-31` }
          : { rangeStart: null, rangeEnd: null };
      case 'custom':
        return { rangeStart: dateFilter.from || null, rangeEnd: dateFilter.to || null };
      default:
        return { rangeStart: null, rangeEnd: null };
    }
  }, [dateFilter, anchorToday]);

  const inRange = (dateStr) => (!rangeStart || dateStr >= rangeStart) && (!rangeEnd || dateStr <= rangeEnd);
  const filteredInvoices = useMemo(
    () => INVOICES.filter((i) => inRange(i.date) && (amanahFilter === 'all' || i.amanahEn === amanahFilter)),
    [rangeStart, rangeEnd, amanahFilter]
  );

  // ---------- Core KPIs: net-invoiced, collection rate, uncollected (current-year only), excluded ----------
  const kpi = useMemo(() => {
    const gross = filteredInvoices.reduce((s, i) => s + i.amount, 0);
    const excludedInvoices = filteredInvoices.filter(isExcluded);
    const excludedValue = excludedInvoices.reduce((s, i) => s + i.amount, 0);
    const netList = filteredInvoices.filter((i) => !isExcluded(i));
    const netInvoiced = gross - excludedValue;
    const collected = netList.filter((i) => i.status === 'approved');
    const collectedValue = collected.reduce((s, i) => s + i.amount, 0);
    // "Uncollected" is restricted to invoices ISSUED in the current year —
    // reconciles accrual invoicing with the Ministry's cash-basis KPI.
    const uncollected = netList.filter((i) => i.status !== 'approved' && i.date.slice(0, 4) === currentYear);
    const uncollectedValue = uncollected.reduce((s, i) => s + i.amount, 0);
    const collectionRate = netInvoiced ? Math.round((collectedValue / netInvoiced) * 1000) / 10 : 0;
    return {
      gross,
      excludedCount: excludedInvoices.length,
      excludedValue,
      netInvoiced,
      collectedCount: collected.length,
      collectedValue,
      uncollectedCount: uncollected.length,
      uncollectedValue,
      collectionRate
    };
  }, [filteredInvoices, currentYear]);

  const exclusionBreakdown = useMemo(() => {
    const cats = { duplicate: { count: 0, value: 0 }, appeal: { count: 0, value: 0 }, invalid_debtor: { count: 0, value: 0 }, enforcement: { count: 0, value: 0 } };
    for (const inv of filteredInvoices) {
      for (const r of exclusionReasons(inv)) {
        cats[r].count += 1;
        cats[r].value += inv.amount;
      }
    }
    return cats;
  }, [filteredInvoices]);

  // Revenue by source, this year vs. last — real invoice data already spans
  // both years, grouped by the same GFS classification used everywhere else
  // in this file (map coloring, province drill-down), not a separate dataset.
  const revenueByYear = useMemo(() => computeRevenueByYear(INVOICES), []);

  // ---------- Amanah-level indicator table (map/table wishlist item; table chosen) ----------
  const byAmanah = useMemo(() => {
    const groups = new Map();
    for (const inv of filteredInvoices) {
      const key = inv.amanahEn || 'other';
      const label = lang === 'zh' ? inv.amanah : lang === 'ar' ? inv.amanahAr : inv.amanahEn;
      const g = groups.get(key) || { key, label: label || key, count: 0, gross: 0, collected: 0 };
      g.count += 1;
      g.gross += inv.amount;
      if (inv.status === 'approved') g.collected += inv.amount;
      groups.set(key, g);
    }
    return [...groups.values()]
      .map((g) => ({ ...g, rate: g.gross ? Math.round((g.collected / g.gross) * 100) : 0 }))
      .sort((a, b) => b.gross - a.gross);
  }, [filteredInvoices, lang]);

  const amanahChartData = useMemo(() => ({
    labels: byAmanah.map((g) => g.label),
    datasets: [
      { label: t('dash_th_gross'), data: byAmanah.map((g) => g.gross), backgroundColor: chartColor('info', 0.75), borderRadius: 4 },
      { label: t('dash_amanah_chart_collected'), data: byAmanah.map((g) => g.collected), backgroundColor: chartColor('success', 0.75), borderRadius: 4 }
    ]
  }), [byAmanah, t]);

  const exclusionChartData = useMemo(() => ({
    labels: Object.keys(EXCL_LABEL_KEY).map((k) => t(EXCL_LABEL_KEY[k])),
    datasets: [{
      data: Object.keys(EXCL_LABEL_KEY).map((k) => exclusionBreakdown[k].value),
      backgroundColor: [chartColor('warning', 0.85), chartColor('orange', 0.85), chartColor('danger', 0.85), chartColor('info', 0.85)],
      borderWidth: 0
    }]
  }), [exclusionBreakdown, t]);

  const barOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: chartLegend(theme, { position: 'bottom', rtl: isRtl, labels: { boxWidth: 12, font: { size: 11 } } }),
      tooltip: chartTooltip(theme, isRtl)
    },
    scales: {
      x: { reverse: isRtl, ticks: { color: chartColors.text, font: { size: 11 } }, grid: { display: false } },
      y: { beginAtZero: true, ticks: { color: chartColors.text, callback: (v) => fmtMoney(v) }, grid: { color: chartColors.grid } }
    }
  }), [chartColors, isRtl, theme]);

  const doughnutOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: chartLegend(theme, { position: 'bottom', rtl: isRtl, labels: { boxWidth: 12, font: { size: 11 } } }),
      tooltip: chartTooltip(theme, isRtl, {
        callbacks: { label: (ctx) => `${ctx.label}: ${fmtMoney(ctx.parsed)} SAR` }
      })
    }
  }), [isRtl, theme]);

  // ---------- Provincial collection map: real KSA province boundaries, aggregated straight from filteredInvoices, click for filtered detail ----------
  const byProvince = useMemo(() => {
    const stats = new Map(KSA_PROVINCES.map((p) => [p.iso, {
      count: 0, gross: 0, collected: 0, violationCount: 0, enforcementCount: 0, enforcementValue: 0, revenue: new Map()
    }]));
    for (const inv of filteredInvoices) {
      const iso = AMANAH_TO_PROVINCE[inv.amanahEn];
      if (!iso) continue;
      const s = stats.get(iso);
      s.count += 1;
      s.gross += inv.amount;
      if (inv.status === 'approved') s.collected += inv.amount;
      if (inv.violationNumber) s.violationCount += 1;
      if (inv.collectedVia === 'enforcement') { s.enforcementCount += 1; s.enforcementValue += inv.amount; }
      const gfs = gfsForInvoice(inv);
      if (gfs) {
        const entry = s.revenue.get(gfs.code) || { code: gfs.code, name: gfs.name, nameEn: gfs.nameEn, nameAr: gfs.nameAr, value: 0 };
        entry.value += inv.amount;
        s.revenue.set(gfs.code, entry);
      }
    }
    return KSA_PROVINCES.map((p) => {
      const s = stats.get(p.iso);
      const revenue = [...s.revenue.values()].sort((a, b) => b.value - a.value);
      return {
        ...p,
        hasData: p.amanahKeys.length > 0,
        count: s.count,
        gross: s.gross,
        collected: s.collected,
        uncollected: s.gross - s.collected,
        rate: s.gross ? Math.round((s.collected / s.gross) * 100) : 0,
        violationCount: s.violationCount,
        enforcementCount: s.enforcementCount,
        enforcementValue: s.enforcementValue,
        revenue,
        dominantRevenue: revenue[0] || null
      };
    });
  }, [filteredInvoices]);

  const [mapMetric, setMapMetric] = useState('rate');
  const [selectedProvinceIso, setSelectedProvinceIso] = useState(null);
  const selectedProvince = useMemo(() => byProvince.find((p) => p.iso === selectedProvinceIso) || null, [byProvince, selectedProvinceIso]);

  // Auto-flag the worst-performing province (below the red collection-rate threshold) for the alert banner.
  const worstProvince = useMemo(() => {
    const candidates = byProvince.filter((p) => p.hasData && p.count > 0 && p.rate < 40);
    return candidates.length ? candidates.sort((a, b) => a.rate - b.rate)[0] : null;
  }, [byProvince]);

  const maxProvinceGross = useMemo(() => Math.max(...byProvince.filter((p) => p.hasData).map((p) => p.gross), 1), [byProvince]);
  const maxViolationCount = useMemo(() => Math.max(...byProvince.map((p) => p.violationCount), 1), [byProvince]);
  const maxEnforcementCount = useMemo(() => Math.max(...byProvince.map((p) => p.enforcementCount), 1), [byProvince]);

  const provinceFill = (p) => {
    // Structurally-supported provinces with zero invoices under the CURRENT
    // filter (period + amanah/city) must render identically to true no-data
    // provinces — otherwise a filtered-out province with rate=0 looks like a
    // genuine worst-performer, which is exactly the map-contrast confusion
    // fixed earlier this session for the metric-specific floors below.
    if (!p.hasData || p.count === 0) return chartColor('neutral', 0.10);
    if (mapMetric === 'gross') return chartColor('info', Number((0.15 + (p.gross / maxProvinceGross) * 0.65).toFixed(2)));
    if (mapMetric === 'revenue') return p.dominantRevenue ? GFS_COLOR[p.dominantRevenue.code] : chartColor('neutral', 0.10);
    if (mapMetric === 'violations') return chartColor('danger', Number((0.04 + (p.violationCount / maxViolationCount) * 0.76).toFixed(2)));
    if (mapMetric === 'enforcement') return chartColor('info', Number((0.04 + (p.enforcementCount / maxEnforcementCount) * 0.76).toFixed(2)));
    return p.rate >= 70 ? 'var(--green)' : p.rate >= 40 ? 'var(--gold)' : 'var(--red)';
  };

  const provinceName = (p) => (lang === 'ar' ? p.nameAr : p.nameEn);

  // ---------- Risk-ranked worklist: value + age, user-adjustable weights (the two always sum to 100%) ----------
  const [valueWeight, setValueWeight] = useState(50);
  const ageWeight = 100 - valueWeight;
  const ageDays = (dateStr) => Math.max(0, Math.round((new Date(`${anchorToday}T00:00:00Z`) - new Date(`${dateStr}T00:00:00Z`)) / 86400000));

  const worklist = useMemo(() => {
    if (!filteredInvoices.length) return [];
    const maxAmount = Math.max(...filteredInvoices.map((i) => i.amount), 1);
    const maxAge = Math.max(...filteredInvoices.map((i) => ageDays(i.date)), 1);
    return filteredInvoices
      .map((inv) => {
        const nv = inv.amount / maxAmount;
        const na = ageDays(inv.date) / maxAge;
        const score = Math.round((valueWeight / 100) * nv * 100 + (ageWeight / 100) * na * 100);
        return { ...inv, ageInDays: ageDays(inv.date), score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }, [filteredInvoices, valueWeight, anchorToday]);

  // ---------- Investment-invoice / Furas contract-linkage flag ----------
  const investmentInvoices = useMemo(() => filteredInvoices.filter((i) => i.source === 'Foras'), [filteredInvoices]);
  const flaggedNoContract = useMemo(() => investmentInvoices.filter((i) => i.hasContract === false), [investmentInvoices]);

  // ---------- Decisions Awaiting You: prioritized action recommendations synthesized from the data above ----------
  const scrollToMap = () => document.getElementById('provincial-map-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const scrollToSanad = () => document.getElementById('sanad-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Two distinct lenses on "where to act" — biggest recovery opportunity (SAR value) vs
  // worst collection performance (rate) — not always the same province.
  const provinceInsight = useMemo(() => {
    const dataProvinces = byProvince.filter((p) => p.hasData && p.count > 0);
    if (!dataProvinces.length) return null;
    const worst = [...dataProvinces].sort((a, b) => a.rate - b.rate)[0];
    const biggest = [...dataProvinces].sort((a, b) => b.uncollected - a.uncollected)[0];
    if (!biggest.uncollected) return null;
    return { worst, biggest, same: worst.iso === biggest.iso };
  }, [byProvince]);

  // The "needs attention" banner above the map must track whichever metric is
  // currently selected — showing the rate-based Eastern Province alert while
  // the user is looking at Violations or Enforcement Cases (which highlight
  // entirely different provinces) is exactly the confusing mismatch reported
  // against this map before, just from a new angle.
  const violationsTop = useMemo(() => {
    const cands = byProvince.filter((p) => p.hasData && p.count > 0 && p.violationCount > 0);
    if (!cands.length) return null;
    return [...cands].sort((a, b) => b.violationCount - a.violationCount)[0];
  }, [byProvince]);

  const enforcementTop = useMemo(() => {
    const cands = byProvince.filter((p) => p.hasData && p.count > 0 && p.enforcementCount > 0);
    if (!cands.length) return null;
    return [...cands].sort((a, b) => b.enforcementCount - a.enforcementCount)[0];
  }, [byProvince]);

  const grossTop = useMemo(() => {
    const cands = byProvince.filter((p) => p.hasData && p.count > 0);
    if (!cands.length) return null;
    return [...cands].sort((a, b) => b.gross - a.gross)[0];
  }, [byProvince]);

  const decisions = useMemo(() => {
    const list = [];
    const dataProvinces = byProvince.filter((p) => p.hasData && p.count > 0);

    if (dataProvinces.length) {
      const lowestRate = [...dataProvinces].sort((a, b) => a.rate - b.rate)[0];
      list.push({
        key: 'rate',
        priority: lowestRate.rate < 40 ? 'high' : 'medium',
        title: `${provinceName(lowestRate)} — ${t('dash_decisions_rate_title')}`,
        rationale: `${t('dash_decisions_rate_a')} ${lowestRate.rate}% ${t('dash_decisions_rate_b')} ${dataProvinces.length} ${t('dash_decisions_rate_c')} ${fmtMoney(lowestRate.uncollected)} SAR ${t('dash_decisions_rate_d')}`,
        beforeLabel: `${lowestRate.rate}%`,
        afterLabel: '70%',
        action: () => { setMapMetric('rate'); setSelectedProvinceIso(lowestRate.iso); scrollToMap(); }
      });

      const biggestGap = [...dataProvinces].sort((a, b) => b.uncollected - a.uncollected)[0];
      if (biggestGap.uncollected > 0) {
        list.push({
          key: 'gap',
          priority: 'high',
          title: `${provinceName(biggestGap)} — ${t('dash_decisions_gap_title')}`,
          rationale: `${t('dash_decisions_gap_a')} ${fmtMoney(biggestGap.uncollected)} ${t('dash_decisions_gap_b')} ${fmtMoney(biggestGap.gross)} ${t('dash_decisions_gap_c')}`,
          beforeLabel: `${fmtMoney(biggestGap.uncollected)} SAR`,
          afterLabel: '0 SAR',
          action: () => { setMapMetric('gross'); setSelectedProvinceIso(biggestGap.iso); scrollToMap(); }
        });
      }
    }

    list.push({
      key: 'sanad',
      priority: 'high',
      title: t('dash_decisions_sanad_title'),
      rationale: `${fmtMoney(SANAD_ENFORCEMENT.ordersUnlinked)} ${t('dash_decisions_sanad_a')} ${fmtMoney(SANAD_ENFORCEMENT.ordersUnlinkedValue)} ${t('dash_decisions_sanad_b')}`,
      beforeLabel: '0%',
      afterLabel: '100%',
      action: scrollToSanad
    });

    if (flaggedNoContract.length) {
      const inv = flaggedNoContract[0];
      const beneficiary = lang === 'zh' ? inv.entity : lang === 'ar' ? inv.entityAr : inv.entityEn;
      list.push({
        key: 'invest',
        priority: 'medium',
        title: `${beneficiary} — ${t('dash_decisions_invest_title')}`,
        rationale: `${t('dash_decisions_invest_a')} ${inv.id} ${t('dash_decisions_invest_b')} ${fmtMoney(inv.amount)} ${t('dash_decisions_invest_c')}`,
        action: () => nav(`/invoices?co=${inv.co}`)
      });
    }

    return list;
  }, [byProvince, flaggedNoContract, lang, t]);

  return (
    <div className="grid" style={{ gap: 'var(--spacing-lg)' }}>
      <h1 className="sr-only">{t('dashboard')}</h1>
      <div className="card card-pad filter-toolbar">
        <span style={{ fontWeight: 700, fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>{t('dash_period_label')}</span>
        <div className="filter-toolbar__chips">
          {[
            ['all', 'dash_period_alltime'],
            ['prevMonth', 'dash_period_prev_month'],
            ['3m', 'dash_period_3m'],
            ['6m', 'dash_period_6m'],
            ['1y', 'dash_period_1y']
          ].map(([key, labelKey]) => (
            <button
              key={key}
              type="button"
              className={`btn btn-sm ${dateFilter.mode === key ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setDateFilter({ mode: key, year: '', from: '', to: '' })}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
        <select
          className="select"
          aria-label={t('dash_period_year_placeholder')}
          style={{ height: 32, width: 'auto', paddingInline: 'var(--spacing-md)', fontSize: 'var(--text-xs)' }}
          value={dateFilter.mode === 'year' ? dateFilter.year : ''}
          onChange={(e) => setDateFilter({ mode: 'year', year: e.target.value, from: '', to: '' })}
        >
          <option value="" disabled>{t('dash_period_year_placeholder')}</option>
          {availableYears.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <button
          type="button"
          className={`btn btn-sm ${dateFilter.mode === 'custom' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setDateFilter((f) => ({ mode: 'custom', year: '', from: f.from || '', to: f.to || '' }))}
        >
          {t('dash_period_custom')}
        </button>
        {dateFilter.mode === 'custom' && (
          <div className="filter-toolbar__range">
            <input
              type="date"
              className="input"
              aria-label={t('pln_period_from')}
              style={{ height: 32, width: 'auto', paddingInline: 'var(--spacing-md)', fontSize: 'var(--text-xs)' }}
              value={dateFilter.from}
              max={dateFilter.to || undefined}
              onChange={(e) => setDateFilter((f) => ({ ...f, mode: 'custom', from: e.target.value }))}
            />
            <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>{t('dash_period_to')}</span>
            <input
              type="date"
              className="input"
              aria-label={t('pln_period_to')}
              style={{ height: 32, width: 'auto', paddingInline: 'var(--spacing-md)', fontSize: 'var(--text-xs)' }}
              value={dateFilter.to}
              min={dateFilter.from || undefined}
              onChange={(e) => setDateFilter((f) => ({ ...f, mode: 'custom', to: e.target.value }))}
            />
          </div>
        )}
        <span className="muted" style={{ fontSize: 'var(--text-xs)', marginInlineStart: 'auto' }}>
          {rangeStart || rangeEnd ? `${rangeStart || '…'} → ${rangeEnd || '…'}` : t('dash_period_alltime')}
        </span>
      </div>

      <div className="card card-pad filter-toolbar">
        <span style={{ fontWeight: 700, fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>{t('dash_amanah_filter_label')}</span>
        <select
          className="select"
          aria-label={t('dash_amanah_filter_label')}
          style={{ height: 32, width: 'auto', minWidth: 220, paddingInline: 'var(--spacing-md)', fontSize: 'var(--text-xs)' }}
          value={amanahFilter}
          onChange={(e) => setAmanahFilter(e.target.value)}
        >
          <option value="all">{t('dash_amanah_filter_all')}</option>
          {amanahOptions.map((o) => (
            <option key={o.key} value={o.key}>{amanahLabel(o)}</option>
          ))}
        </select>
        {amanahFilter !== 'all' && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAmanahFilter('all')}>
            {t('dash_amanah_filter_all')}
          </button>
        )}
      </div>

      {/* Core KPI strip */}
      <div className="grid grid-6">
        <div className="card card-pad">
          <div className="kpi__value">{fmtMoney(kpi.gross)}</div>
          <div className="kpi__label">{t('dash_kpi_gross')}</div>
        </div>
        <div className="card card-pad" style={{ borderInlineStart: '4px solid var(--red)' }}>
          <div className="kpi__value">{fmtMoney(kpi.excludedValue)}</div>
          <div className="kpi__label">{t('dash_kpi_excluded')}</div>
        </div>
        <div className="card card-pad">
          <div className="kpi__value">{fmtMoney(kpi.netInvoiced)}</div>
          <div className="kpi__label">{t('dash_kpi_net_invoiced')}</div>
        </div>
        <div className="card card-pad" style={{ borderInlineStart: '4px solid var(--green)' }}>
          <div className="kpi__value">{fmtMoney(kpi.collectedValue)}</div>
          <div className="kpi__label">{t('dash_kpi_collected')}</div>
        </div>
        <div className="card card-pad" style={{ borderInlineStart: '4px solid var(--green)' }} data-tooltip={t('kpi_rate_info')} aria-label={t('kpi_rate_info')} tabIndex={0}>
          <div className="kpi__value">{kpi.collectionRate}%</div>
          <div className="kpi__label">{t('dash_kpi_collection_rate')}</div>
        </div>
        <div className="card card-pad" style={{ borderInlineStart: '4px solid var(--red)' }}>
          <div className="kpi__value">{fmtMoney(kpi.uncollectedValue)}</div>
          <div className="kpi__label">{t('dash_kpi_uncollected')}</div>
        </div>
      </div>

      {/* Decisions Awaiting You */}
      <div className="card card-pad">
        <div className="page-head" style={{ marginBottom: 'var(--spacing-md)' }}>
          <div>
            <div className="page-title" style={{ fontSize: 'var(--text-md)' }}>{t('dash_decisions_title')}</div>
            <div className="page-sub">{t('dash_decisions_sub')}</div>
          </div>
        </div>
        <div className="grid" style={{ gap: 'var(--spacing-md)' }}>
          {decisions.map((d) => (
            <div key={d.key} className="card card-pad" style={{ borderInlineStart: `4px solid var(--${d.priority === 'high' ? 'red' : 'gold'})` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--spacing-lg)', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <span className={`badge ${d.priority === 'high' ? 'badge--red' : 'badge--gold'}`}>
                    {d.priority === 'high' ? t('dash_decisions_priority_high') : t('dash_decisions_priority_medium')}
                  </span>
                  <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', marginTop: 'var(--spacing-xs)' }}>{d.title}</div>
                  <div className="muted" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--spacing-xs)', lineHeight: 1.6 }}>{d.rationale}</div>
                </div>
                {d.beforeLabel && (
                  <div style={{ textAlign: 'center', flexShrink: 0 }}>
                    <div className="muted" style={{ fontSize: 'var(--text-2xs)' }}>{t('dash_decisions_now')} → {t('dash_decisions_after')}</div>
                    <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }} dir="ltr">{d.beforeLabel} → {d.afterLabel}</div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--spacing-md)' }}>
                <span className="badge" style={{ background: 'var(--surface-muted)', color: 'var(--txt-mute)', borderColor: 'var(--line-strong)' }}>
                  {t('dash_decisions_pending')}
                </span>
                <button className="btn btn-sm btn-primary" type="button" onClick={d.action}>
                  {t('dash_decisions_cta')} <DirectionalIcon />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Exclusion breakdown */}
      <div className="card card-pad">
        <div className="page-head" style={{ marginBottom: 'var(--spacing-md)' }}>
          <div>
            <div className="page-title" style={{ fontSize: 'var(--text-md)' }}>{t('dash_excl_title')}</div>
            <div className="page-sub">{t('dash_excl_sub')}</div>
          </div>
        </div>
        <div className="grid grid-4">
          {Object.keys(EXCL_LABEL_KEY).map((key) => (
            <div key={key} className="card card-pad" style={{ borderInlineStart: `4px solid var(--${EXCL_COLOR[key]})` }}>
              <div className="kpi__value">{exclusionBreakdown[key].count}</div>
              <div className="kpi__label">{t(EXCL_LABEL_KEY[key])}</div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, marginTop: 'var(--spacing-xs)' }}>{fmtMoney(exclusionBreakdown[key].value)} SAR</div>
            </div>
          ))}
        </div>
        <div className="hr" />
        <div className="page-sub" style={{ marginBottom: 'var(--spacing-md)' }}>{t('dash_excl_by_value')}</div>
        <div style={{ height: 200, maxWidth: 340 }}>
          <Doughnut data={exclusionChartData} options={doughnutOptions} />
        </div>
      </div>

      {/* Revenue by source — year over year */}
      <div className="card card-pad">
        <div className="page-head" style={{ marginBottom: 'var(--spacing-md)' }}>
          <div>
            <div className="page-title" style={{ fontSize: 'var(--text-md)' }}>{t('dash_revenue_year_title')}</div>
            <div className="page-sub">{t('dash_revenue_year_sub')}</div>
          </div>
        </div>
        <div className="table-wrap" tabIndex={0}>
          <table className="table" aria-label={t('dash_revenue_year_title')}>
            <thead>
              <tr>
                <th>{t('dash_revenue_year_th_category')}</th>
                <th dir="ltr">{revenueByYear[0]?.priorYear}</th>
                <th dir="ltr">{revenueByYear[0]?.latestYear}</th>
                <th>{t('dash_revenue_year_th_growth')}</th>
              </tr>
            </thead>
            <tbody>
              {revenueByYear.map((r) => (
                <tr key={r.code}>
                  <td>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: GFS_COLOR[r.code], display: 'inline-block', marginInlineEnd: 'var(--spacing-xs)' }} />
                    {lang === 'zh' ? r.name : lang === 'ar' ? r.nameAr : r.nameEn}
                  </td>
                  <td dir="ltr">{fmtMoney(r.prior.collected)} SAR</td>
                  <td dir="ltr">{fmtMoney(r.latest.collected)} SAR</td>
                  <td dir="ltr">
                    {r.growthPct == null ? '—' : (
                      <span className={`badge ${r.growthPct >= 0 ? 'badge--green' : 'badge--red'}`}>{r.growthPct >= 0 ? '+' : ''}{r.growthPct}%</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: 'var(--text-2xs)', marginTop: 'var(--spacing-md)' }}>{t('dash_revenue_year_note')}</p>
      </div>

      {/* Amanah-level indicators */}
      <div className="grid grid-2">
        <div className="card card-pad">
          <div className="page-head" style={{ marginBottom: 'var(--spacing-md)' }}>
            <div>
              <div className="page-title" style={{ fontSize: 'var(--text-md)' }}>{t('dash_amanah_title')}</div>
              <div className="page-sub">{t('dash_amanah_sub')}</div>
            </div>
            <button className="btn btn-sm btn-ghost" type="button" onClick={() => nav('/invoices')}>
              {t('link_details')} <DirectionalIcon />
            </button>
          </div>
          <div className="table-wrap" tabIndex={0}>
            <table className="table" aria-label="Amanah-level indicators">
              <thead>
                <tr>
                  <th>{t('th_amanah')}</th>
                  <th>{t('th_id')}#</th>
                  <th>{t('dash_th_gross')}</th>
                  <th>{t('dash_th_rate')}</th>
                </tr>
              </thead>
              <tbody>
                {byAmanah.map((g) => (
                  <tr key={g.key}>
                    <td>{g.label}</td>
                    <td dir="ltr">{g.count}</td>
                    <td dir="ltr">{fmtMoney(g.gross)} SAR</td>
                    <td>
                      <span className={`badge ${g.rate >= 70 ? 'badge--green' : g.rate >= 40 ? 'badge--gold' : 'badge--red'}`}>{g.rate}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card chart-box">
          <div className="page-head" style={{ marginBottom: 'var(--spacing-md)' }}>
            <div>
              <div className="page-title" style={{ fontSize: 'var(--text-md)' }}>{t('dash_th_gross')} / {t('dash_amanah_chart_collected')}</div>
              <div className="page-sub">{t('dash_amanah_sub')}</div>
            </div>
          </div>
          <div style={{ height: 280 }}>
            <Bar data={amanahChartData} options={barOptions} />
          </div>
        </div>
      </div>

      {/* Target achievement — ring gauges, one per Amanah, actual rate vs the 70% target */}
      <div className="card card-pad">
        <div className="page-head" style={{ marginBottom: 'var(--spacing-md)' }}>
          <div>
            <div className="page-title" style={{ fontSize: 'var(--text-md)' }}>{t('dash_amanah_target_title')}</div>
            <div className="page-sub">{t('dash_amanah_target_sub')}</div>
          </div>
          <span className="badge" style={{ background: 'var(--surface-muted)', color: 'var(--txt-mute)', borderColor: 'var(--line-strong)' }}>
            {t('dash_map_target_label')}
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-2xl)', justifyContent: 'center' }}>
          {byAmanah.map((g) => (
            <div key={g.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-xs)', width: 104 }}>
              <RingGauge pct={g.rate} target={70} size={88} />
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textAlign: 'center', lineHeight: 1.3 }}>{g.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Provincial collection map */}
      <div className="card card-pad" id="provincial-map-card">
        <div className="page-head" style={{ marginBottom: 'var(--spacing-xs)' }}>
          <div>
            <div className="page-title" style={{ fontSize: 'var(--text-md)' }}>{t('dash_map_title')}</div>
            <div className="page-sub">{t('dash_map_sub')}</div>
          </div>
        </div>

        {mapMetric === 'rate' && worstProvince && (
          <div
            className="card"
            style={{
              padding: 'var(--spacing-md) var(--spacing-lg)',
              marginBottom: 'var(--spacing-md)',
              background: 'var(--danger-soft)',
              border: '1px solid var(--danger)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--spacing-md)',
              flexWrap: 'wrap'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', fontSize: 'var(--text-xs)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', display: 'inline-block', flexShrink: 0 }} />
              <strong>{t('dash_map_alert_prefix')}</strong> {provinceName(worstProvince)} — {t('dash_th_rate')} {worstProvince.rate}%
            </span>
            <button
              className="btn btn-sm btn-ghost"
              type="button"
              onClick={() => setSelectedProvinceIso(worstProvince.iso)}
            >
              {t('dash_map_alert_open')} <DirectionalIcon />
            </button>
          </div>
        )}

        {mapMetric === 'violations' && violationsTop && (
          <div
            className="card"
            style={{ padding: 'var(--spacing-md) var(--spacing-lg)', marginBottom: 'var(--spacing-md)', background: 'var(--danger-soft)', border: '1px solid var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', fontSize: 'var(--text-xs)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', display: 'inline-block', flexShrink: 0 }} />
              <strong>{t('dash_map_alert_violations_prefix')}</strong> {provinceName(violationsTop)} — {violationsTop.violationCount} {t('dash_map_alert_unit_violations')}
            </span>
            <button className="btn btn-sm btn-ghost" type="button" onClick={() => setSelectedProvinceIso(violationsTop.iso)}>
              {t('dash_map_alert_open')} <DirectionalIcon />
            </button>
          </div>
        )}

        {mapMetric === 'enforcement' && enforcementTop && (
          <div
            className="card"
            style={{ padding: 'var(--spacing-md) var(--spacing-lg)', marginBottom: 'var(--spacing-md)', background: 'var(--info-soft)', border: '1px solid var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', fontSize: 'var(--text-xs)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--blue)', display: 'inline-block', flexShrink: 0 }} />
              <strong>{t('dash_map_alert_enforcement_prefix')}</strong> {provinceName(enforcementTop)} — {enforcementTop.enforcementCount} {t('dash_map_alert_unit_enforcement')}
            </span>
            <button className="btn btn-sm btn-ghost" type="button" onClick={() => setSelectedProvinceIso(enforcementTop.iso)}>
              {t('dash_map_alert_open')} <DirectionalIcon />
            </button>
          </div>
        )}

        {mapMetric === 'gross' && grossTop && (
          <div
            className="card"
            style={{ padding: 'var(--spacing-md) var(--spacing-lg)', marginBottom: 'var(--spacing-md)', background: 'var(--info-soft)', border: '1px solid var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', fontSize: 'var(--text-xs)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--blue)', display: 'inline-block', flexShrink: 0 }} />
              <strong>{t('dash_map_alert_gross_prefix')}</strong> {provinceName(grossTop)} — {fmtMoney(grossTop.gross)} SAR
            </span>
            <button className="btn btn-sm btn-ghost" type="button" onClick={() => setSelectedProvinceIso(grossTop.iso)}>
              {t('dash_map_alert_open')} <DirectionalIcon />
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-md)' }}>
          {[
            ['rate', 'dash_map_metric_rate'],
            ['gross', 'dash_map_metric_gross'],
            ['revenue', 'dash_map_metric_revenue'],
            ['violations', 'dash_map_metric_violations'],
            ['enforcement', 'dash_map_metric_enforcement']
          ].map(([key, labelKey]) => (
            <button
              key={key}
              type="button"
              className={`btn btn-sm ${mapMetric === key ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setMapMetric(key)}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
          {mapMetric === 'rate' && (
            <>
              <span className="badge badge--green">{t('dash_map_legend_high')}</span>
              <span className="badge badge--gold">{t('dash_map_legend_mid')}</span>
              <span className="badge badge--red">{t('dash_map_legend_low')}</span>
            </>
          )}
          {mapMetric === 'gross' && <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>{t('dash_map_legend_gross')}</span>}
          {mapMetric === 'violations' && <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>{t('dash_map_legend_violations')}</span>}
          {mapMetric === 'enforcement' && <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>{t('dash_map_legend_enforcement')}</span>}
          {mapMetric === 'revenue' && Object.entries(GFS_COLOR).map(([code, color]) => {
            const sample = byProvince.flatMap((p) => p.revenue).find((r) => r.code === code);
            if (!sample) return null;
            const label = lang === 'zh' ? sample.name : lang === 'ar' ? sample.nameAr : sample.nameEn;
            return (
              <span key={code} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--spacing-xs)', fontSize: 'var(--text-xs)' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />
                {label}
              </span>
            );
          })}
          <span className="badge" style={{ background: 'var(--surface-muted)', color: 'var(--txt-mute)', borderColor: 'var(--line-strong)' }}>
            {t('dash_map_legend_none')}
          </span>
        </div>

        {mapMetric === 'rate' && provinceInsight && (
          <div className="card" style={{ padding: 'var(--spacing-md) var(--spacing-lg)', marginBottom: 'var(--spacing-md)', background: 'var(--info-soft)', border: '1px solid var(--secondary)' }}>
            {provinceInsight.same ? (
              <div style={{ fontSize: 'var(--text-xs)', lineHeight: 1.6 }}>
                <strong>{provinceName(provinceInsight.biggest)}</strong> {t('dash_map_insight_same')}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 'var(--spacing-2xl)', flexWrap: 'wrap', alignItems: 'baseline' }}>
                <span style={{ fontSize: 'var(--text-xs)' }}>
                  <span className="muted">{t('dash_map_insight_biggest')}:</span>{' '}
                  <strong>{provinceName(provinceInsight.biggest)}</strong>{' '}
                  <span dir="ltr">({fmtMoney(provinceInsight.biggest.uncollected)} SAR)</span>
                </span>
                <span style={{ fontSize: 'var(--text-xs)' }}>
                  <span className="muted">{t('dash_map_insight_worst')}:</span>{' '}
                  <strong>{provinceName(provinceInsight.worst)}</strong>{' '}
                  <span dir="ltr">({provinceInsight.worst.rate}%)</span>
                </span>
                <span className="muted" style={{ fontSize: 'var(--text-xs)', width: '100%' }}>{t('dash_map_insight_diff')}</span>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <div className="card" style={{ padding: 'var(--spacing-lg)', minHeight: 240 }}>
            {selectedProvince ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="page-title" style={{ fontSize: 'var(--text-sm)' }}>{provinceName(selectedProvince)}</div>
                  <button className="btn btn-sm btn-ghost btn-icon" type="button" onClick={() => setSelectedProvinceIso(null)} aria-label="Close"><UIIcon icon={Cancel01Icon} size={18} /></button>
                </div>
                {selectedProvince.hasData ? (
                  <div className="grid" style={{ gap: 'var(--spacing-xl)', marginTop: 'var(--spacing-lg)' }}>
                    {/* Executive summary */}
                    <div>
                      <div className="muted" style={{ fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: 'var(--spacing-xs)' }}>{t('dash_map_exec_summary')}</div>
                      <div className="grid" style={{ gap: 'var(--spacing-xs)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--spacing-xs) var(--spacing-md)', border: '1px solid var(--line)', borderRadius: 6 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', fontSize: 'var(--text-xs)' }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: selectedProvince.rate >= 70 ? 'var(--green)' : selectedProvince.rate >= 40 ? 'var(--gold)' : 'var(--red)', display: 'inline-block', flexShrink: 0 }} />
                            {t('dash_th_rate')}
                          </span>
                          <span style={{ fontWeight: 700, fontSize: 'var(--text-xs)' }} dir="ltr">{selectedProvince.rate}%</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--spacing-xs) var(--spacing-md)', border: '1px solid var(--line)', borderRadius: 6 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', fontSize: 'var(--text-xs)' }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: selectedProvince.uncollected > 0 ? 'var(--red)' : 'var(--green)', display: 'inline-block', flexShrink: 0 }} />
                            {t('dash_map_exec_uncollected')}
                          </span>
                          <span style={{ fontWeight: 700, fontSize: 'var(--text-xs)' }} dir="ltr">{fmtMoney(selectedProvince.uncollected)} SAR</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--spacing-xs) var(--spacing-md)', border: '1px solid var(--line)', borderRadius: 6 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', fontSize: 'var(--text-xs)' }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: selectedProvince.enforcementCount > 0 ? 'var(--red)' : 'var(--green)', display: 'inline-block', flexShrink: 0 }} />
                            {t('dash_map_stat_enforcement')}
                          </span>
                          <span style={{ fontWeight: 700, fontSize: 'var(--text-xs)' }} dir="ltr">{selectedProvince.enforcementCount}</span>
                        </div>
                      </div>
                    </div>

                    {/* Invoiced breakdown bar */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--spacing-xs)' }}>
                        <span className="muted" style={{ fontSize: 'var(--text-xs)', fontWeight: 700 }}>{t('dash_map_bar_title')}</span>
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700 }} dir="ltr">{fmtMoney(selectedProvince.gross)} SAR</span>
                      </div>
                      <div style={{ height: 10, borderRadius: 5, overflow: 'hidden', display: 'flex', background: 'var(--surface-muted)' }}>
                        <div style={{ width: `${selectedProvince.rate}%`, background: 'var(--green)' }} />
                        <div style={{ width: `${100 - selectedProvince.rate}%`, background: 'var(--gold)' }} />
                      </div>
                      <div style={{ display: 'flex', gap: 'var(--spacing-lg)', marginTop: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--spacing-xs)', fontSize: 'var(--text-2xs)' }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--green)', display: 'inline-block' }} />
                          {t('dash_amanah_chart_collected')} {fmtMoney(selectedProvince.collected)} SAR
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--spacing-xs)', fontSize: 'var(--text-2xs)' }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--gold)', display: 'inline-block' }} />
                          {t('dash_map_bar_uncollected')} {fmtMoney(selectedProvince.uncollected)} SAR
                        </span>
                      </div>
                    </div>

                    {/* Collection rate vs 70% target */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--spacing-xs)' }}>
                        <span className="muted" style={{ fontSize: 'var(--text-xs)', fontWeight: 700 }}>{t('dash_map_target_title')}</span>
                        <span className={`badge ${selectedProvince.rate >= 70 ? 'badge--green' : 'badge--red'}`} style={{ fontSize: 'var(--text-2xs)' }} dir="ltr">
                          {selectedProvince.rate >= 70 ? '+' : ''}{selectedProvince.rate - 70}
                        </span>
                      </div>
                      <div style={{ position: 'relative', height: 10, borderRadius: 5, background: 'var(--surface-muted)', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(selectedProvince.rate, 100)}%`, height: '100%', background: selectedProvince.rate >= 70 ? 'var(--green)' : 'var(--red)' }} />
                        <div style={{ position: 'absolute', insetInlineStart: '70%', top: 0, bottom: 0, width: 2, background: 'var(--heading)' }} />
                      </div>
                      <div className="muted" style={{ fontSize: 'var(--text-2xs)', marginTop: 'var(--spacing-xs)' }}>{t('dash_map_target_label')}</div>
                    </div>

                    {/* Quick stats */}
                    <div style={{ display: 'flex', gap: 'var(--spacing-xl)' }}>
                      <div style={{ flex: 1 }}>
                        <div className="muted" style={{ fontSize: 'var(--text-2xs)' }}>{t('dash_map_stat_count')}</div>
                        <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }} dir="ltr">{selectedProvince.count}</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="muted" style={{ fontSize: 'var(--text-2xs)' }}>{t('dash_map_stat_violations')}</div>
                        <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }} dir="ltr">{selectedProvince.violationCount}</div>
                      </div>
                    </div>

                    {selectedProvince.revenue.length > 0 && (
                      <div>
                        <div className="muted" style={{ fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: 'var(--spacing-xs)' }}>{t('dash_map_revenue_mix')}</div>
                        <div className="grid" style={{ gap: 'var(--spacing-xs)' }}>
                          {selectedProvince.revenue.map((r) => (
                            <div key={r.code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--spacing-xs)', fontSize: 'var(--text-xs)' }}>
                                <span style={{ width: 9, height: 9, borderRadius: '50%', background: GFS_COLOR[r.code], display: 'inline-block' }} />
                                {lang === 'zh' ? r.name : lang === 'ar' ? r.nameAr : r.nameEn}
                              </span>
                              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700 }} dir="ltr">{fmtMoney(r.value)} SAR</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="muted" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--spacing-lg)' }}>{t('dash_map_no_data')}</div>
                )}
              </>
            ) : (
              <>
                <div className="muted" style={{ fontSize: 'var(--text-xs)' }}>{t('dash_map_select_prompt')}</div>
                <div className="muted" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--spacing-xs)', lineHeight: 1.6 }}>{t('dash_map_select_hint')}</div>
              </>
            )}
          </div>

          <ProvinceMap
            provinces={byProvince}
            viewBox={KSA_PROVINCES_VIEWBOX}
            fillFor={provinceFill}
            selectedIso={selectedProvinceIso}
            onSelect={setSelectedProvinceIso}
            titleFor={(p) => `${provinceName(p)}${p.hasData && p.count > 0 ? ` — ${p.rate}%` : ''}`}
          />
        </div>

        <div className="muted" style={{ fontSize: 'var(--text-2xs)', textAlign: 'center', marginTop: 'var(--spacing-md)' }}>
          Boundaries: geoBoundaries.org (OpenStreetMap contributors), ODbL 1.0
        </div>
      </div>

      {/* Risk-ranked worklist */}
      <div className="card card-pad">
        <div className="page-head" style={{ marginBottom: 'var(--spacing-xs)' }}>
          <div>
            <div className="page-title" style={{ fontSize: 'var(--text-md)' }}>{t('dash_worklist_title')}</div>
            <div className="page-sub">{t('dash_worklist_sub')}</div>
          </div>
        </div>
        <div className="grid" style={{ gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-lg)', flexWrap: 'wrap' }}>
            <span className="muted" style={{ fontSize: 'var(--text-xs)', fontWeight: 700, minWidth: 110 }}>{t('dash_worklist_slider_value')} {valueWeight}%</span>
            <input
              type="range"
              min="0"
              max="100"
              value={valueWeight}
              onChange={(e) => setValueWeight(Number(e.target.value))}
              style={{ flex: 1, minWidth: 160, accentColor: 'var(--primary)' }}
              aria-label={t('dash_worklist_slider_value')}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-lg)', flexWrap: 'wrap' }}>
            <span className="muted" style={{ fontSize: 'var(--text-xs)', fontWeight: 700, minWidth: 110 }}>{t('dash_worklist_slider_age')} {ageWeight}%</span>
            <input
              type="range"
              min="0"
              max="100"
              value={ageWeight}
              onChange={(e) => setValueWeight(100 - Number(e.target.value))}
              style={{ flex: 1, minWidth: 160, accentColor: 'var(--warning)' }}
              aria-label={t('dash_worklist_slider_age')}
            />
          </div>
        </div>
        <div className="table-wrap" tabIndex={0}>
          <table className="table" aria-label="Risk-ranked worklist">
            <thead>
              <tr>
                <th>{t('th_id')}</th>
                <th>{t('th_beneficiary')}</th>
                <th>{t('th_amanah')}</th>
                <th>{t('th_amount')}</th>
                <th>{t('dash_worklist_th_age')}</th>
                <th>{t('dash_worklist_th_score')}</th>
              </tr>
            </thead>
            <tbody>
              {worklist.map((inv) => {
                const beneficiary = lang === 'zh' ? inv.entity : lang === 'ar' ? inv.entityAr : inv.entityEn;
                const amanah = lang === 'zh' ? inv.amanah : lang === 'ar' ? inv.amanahAr : inv.amanahEn;
                return (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 700 }} dir="ltr">{inv.id}</td>
                    <td>{beneficiary}</td>
                    <td>{amanah}</td>
                    <td dir="ltr">{fmtMoney(inv.amount)} SAR</td>
                    <td dir="ltr">{inv.ageInDays}</td>
                    <td>
                      <span className={`badge ${inv.score >= 70 ? 'badge--red' : inv.score >= 40 ? 'badge--orange' : 'badge--green'}`}>{inv.score}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-2">
        {/* Sanad matching snapshot */}
        <div className="card card-pad" id="sanad-panel">
          <div className="page-title" style={{ fontSize: 'var(--text-md)' }}>{t('dash_sanad_title')}</div>
          <div className="page-sub">{t('dash_sanad_sub')}</div>
          <div className="hr" />
          <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 120 }}>
              <div className="kpi__value">{fmtMoney(SANAD_ENFORCEMENT.recordsReviewed)}</div>
              <div className="kpi__label">{t('dash_sanad_stat_reviewed')}</div>
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <div className="kpi__value" style={{ color: 'var(--red)' }}>{SANAD_ENFORCEMENT.missingInvoicePct}%</div>
              <div className="kpi__label">{t('dash_sanad_stat_missing')}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap', marginTop: 'var(--spacing-md)' }}>
            <div style={{ flex: 1, minWidth: 120 }}>
              <div className="kpi__value">{fmtMoney(SANAD_ENFORCEMENT.ordersIssued)}</div>
              <div className="kpi__label">{t('dash_sanad_stat_orders')}</div>
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <div className="kpi__value" style={{ color: 'var(--red)' }}>
                {fmtMoney(SANAD_ENFORCEMENT.ordersUnlinked)}<span style={{ fontSize: 'var(--text-xs)', fontWeight: 700 }}> / {fmtMoney(SANAD_ENFORCEMENT.ordersIssued)}</span>
              </div>
              <div className="kpi__label">{t('dash_sanad_stat_unlinked')}</div>
            </div>
          </div>
          <div className="muted" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--spacing-md)', lineHeight: 1.6 }}>{t('dash_sanad_note_orders')}</div>
          <div style={{ marginTop: 'var(--spacing-lg)' }}>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => nav('/sanad-orders')}>
              {t('dash_sanad_view_enforcement_invoices')} <DirectionalIcon />
            </button>
          </div>
        </div>

        {/* Investment / Furas contract-linkage flag */}
        <div className="card card-pad">
          <div className="page-title" style={{ fontSize: 'var(--text-md)' }}>{t('dash_invest_title')}</div>
          <div className="page-sub">{t('dash_invest_sub')}</div>
          <div className="hr" />
          <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap', marginBottom: 'var(--spacing-md)' }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <div className="kpi__value">{investmentInvoices.length - flaggedNoContract.length}</div>
              <div className="kpi__label">{t('dash_invest_ok')}</div>
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <div className="kpi__value" style={{ color: flaggedNoContract.length ? 'var(--red)' : undefined }}>{flaggedNoContract.length}</div>
              <div className="kpi__label">{t('dash_invest_flagged')}</div>
            </div>
          </div>
          {flaggedNoContract.map((inv) => {
            const beneficiary = lang === 'zh' ? inv.entity : lang === 'ar' ? inv.entityAr : inv.entityEn;
            return (
              <div key={inv.id} className="card" style={{ padding: 'var(--spacing-md)', background: 'var(--danger-soft)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 'var(--text-xs)' }} dir="ltr">{inv.id}</span>
                  <span className="badge badge--red">{fmtMoney(inv.amount)} SAR</span>
                </div>
                <div className="muted" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--spacing-xs)' }}>{beneficiary}</div>
              </div>
            );
          })}
          <div style={{ marginTop: 'var(--spacing-lg)' }}>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => nav('/investment-invoices')}>
              {lang === 'ar' ? 'تصفّح الفواتير الاستثمارية غير المرتبطة' : lang === 'zh' ? '浏览未关联的投资类发票' : 'Browse unlinked investment invoices'} <DirectionalIcon />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
