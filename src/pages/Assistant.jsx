import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { useI18n } from '../context/I18nContext';
import { APPROVALS, COLLECTIONS, DEFAULT_ANSWER, INVOICES, KPIS, QA, RISKS, SOURCES, STATUS, TREND, fmtMoney } from '../data/mock';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend);

function mdToHtml(s = '') {
  // minimal markdown: **bold** + line breaks
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\n/g, '<br/>');
}

function fillTemplate(str, vars) {
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] != null ? vars[key] : ''));
}

function badgeColor(v) {
  if (v >= 80) return { bg: 'rgba(0, 102, 4,0.65)', border: 'rgba(0, 102, 4,1)' };
  if (v >= 50) return { bg: 'rgba(255, 193, 7,0.65)', border: 'rgba(255, 193, 7,1)' };
  return { bg: 'rgba(175, 8, 24,0.65)', border: 'rgba(175, 8, 24,1)' };
}

function InlineChart({ type }) {
  const { lang, isRtl, t, T } = useI18n();
  const ref = useRef(null);

  useEffect(() => {
    return () => ref.current?.destroy?.();
  }, []);

  const labels = useMemo(() => {
    if (lang === 'zh') return TREND.labels;
    if (lang === 'ar') return TREND.labelsAr;
    return TREND.labelsEn;
  }, [lang]);

  const common = useMemo(() => {
    const locale = lang === 'ar' ? 'ar' : lang === 'zh' ? 'zh-CN' : 'en-US';
    return {
      responsive: true,
      maintainAspectRatio: false,
      locale,
      plugins: {
        legend: { display: false, rtl: isRtl, labels: { color: '#4A4A4A', boxWidth: 10, usePointStyle: true, pointStyle: 'circle' } },
        tooltip: { rtl: isRtl, backgroundColor: '#FFFFFF', titleColor: '#000000', bodyColor: '#323232', borderColor: '#EAEAEA', borderWidth: 1 }
      },
      scales: {
        x: { reverse: isRtl, ticks: { color: '#4A4A4A' }, grid: { color: 'rgba(0,0,0,0.06)' } },
        y: { beginAtZero: true, ticks: { color: '#4A4A4A' }, grid: { color: 'rgba(0,0,0,0.06)' } }
      }
    };
  }, [isRtl, lang]);

  if (type === 'source') {
    const data = {
      labels: SOURCES.map((s) => s.name),
      datasets: [
        {
          data: SOURCES.map((s) => s.count),
          backgroundColor: ['rgba(38, 99, 75,0.65)', 'rgba(0, 90, 150,0.65)', 'rgba(0, 102, 4,0.65)', 'rgba(255, 193, 7,0.65)'],
          borderColor: ['rgba(38, 99, 75,1)', 'rgba(0, 90, 150,1)', 'rgba(0, 102, 4,1)', 'rgba(255, 193, 7,1)'],
          borderWidth: 1
        }
      ]
    };
    const opts = {
      responsive: true,
      maintainAspectRatio: false,
      locale: lang === 'ar' ? 'ar' : lang === 'zh' ? 'zh-CN' : 'en-US',
      plugins: {
        legend: { position: 'bottom', rtl: isRtl, labels: { color: '#4A4A4A', boxWidth: 10, usePointStyle: true, pointStyle: 'circle' } },
        tooltip: { rtl: isRtl, backgroundColor: '#FFFFFF', titleColor: '#000000', bodyColor: '#323232', borderColor: '#EAEAEA', borderWidth: 1 }
      }
    };
    return (
      <div style={{ height: 220 }}>
        <Doughnut ref={ref} data={data} options={opts} />
      </div>
    );
  }

  if (type === 'automation') {
    const data = {
      labels,
      datasets: [
        {
          label: t('chart_automation'),
          data: TREND.automation,
          borderColor: 'rgba(0, 90, 150, 0.95)',
          backgroundColor: 'rgba(0, 90, 150, 0.12)',
          tension: 0.35,
          pointRadius: 2,
          fill: true
        }
      ]
    };
    const opts = {
      ...common,
      scales: {
        x: { ...common.scales.x, reverse: isRtl },
        y: { ...common.scales.y, min: 80, max: 100, ticks: { color: '#4A4A4A', callback: (v) => `${v}%` } }
      }
    };
    return (
      <div style={{ height: 220 }}>
        <Line ref={ref} data={data} options={opts} />
      </div>
    );
  }

  if (type === 'riskBuckets') {
    const rlabels = t('risk_labels');
    const counts = [0, 0, 0, 0, 0];
    for (const r of RISKS) {
      const s = r.score;
      if (s <= 20) counts[0]++;
      else if (s <= 40) counts[1]++;
      else if (s <= 60) counts[2]++;
      else if (s <= 80) counts[3]++;
      else counts[4]++;
    }
    const data = {
      labels: Array.isArray(rlabels) ? rlabels : ['0-20', '21-40', '41-60', '61-80', '81-100'],
      datasets: [
        {
          data: counts,
          backgroundColor: ['rgba(0, 102, 4,0.35)', 'rgba(255, 193, 7,0.35)', 'rgba(200, 135, 0,0.35)', 'rgba(175, 8, 24,0.35)', 'rgba(175, 8, 24,0.60)'],
          borderColor: ['rgba(0, 102, 4,0.95)', 'rgba(255, 193, 7,0.95)', 'rgba(200, 135, 0,0.95)', 'rgba(175, 8, 24,0.95)', 'rgba(175, 8, 24,0.95)'],
          borderWidth: 1,
          borderRadius: 8
        }
      ]
    };
    return (
      <div style={{ height: 220 }}>
        <Bar ref={ref} data={data} options={{ ...common, scales: { ...common.scales, y: { ...common.scales.y, ticks: { ...common.scales.y.ticks, precision: 0 } } } }} />
      </div>
    );
  }

  if (type === 'collectionProb') {
    const sorted = [...COLLECTIONS].sort((a, b) => a.prob - b.prob);
    const data = {
      labels: sorted.map((c) => c.id),
      datasets: [
        {
          data: sorted.map((c) => c.prob),
          backgroundColor: sorted.map((c) => badgeColor(c.prob).bg),
          borderColor: sorted.map((c) => badgeColor(c.prob).border),
          borderWidth: 1,
          borderRadius: 8
        }
      ]
    };
    return (
      <div style={{ height: 220 }}>
        <Bar ref={ref} data={data} options={{ ...common, scales: { ...common.scales, y: { ...common.scales.y, max: 100, ticks: { color: '#4A4A4A', callback: (v) => `${v}%` } } } }} />
      </div>
    );
  }

  if (type === 'approvalsBar') {
    const data = {
      labels: APPROVALS.map((a) => a.id),
      datasets: [
        {
          data: APPROVALS.map((a) => a.amount),
          backgroundColor: 'rgba(38, 99, 75,0.5)',
          borderColor: 'rgba(38, 99, 75,1)',
          borderWidth: 1,
          borderRadius: 8
        }
      ]
    };
    return (
      <div style={{ height: 220 }}>
        <Bar ref={ref} data={data} options={{ ...common, scales: { ...common.scales, y: { ...common.scales.y, ticks: { color: '#4A4A4A', callback: (v) => fmtMoney(v) } } } }} />
      </div>
    );
  }

  if (type === 'invoiceStatus') {
    const counts = Object.keys(STATUS)
      .map((key) => ({ key, ...STATUS[key], count: INVOICES.filter((i) => i.status === key).length }))
      .filter((s) => s.count > 0);
    const colorMap = { blue: '#005A96', green: '#006604', red: '#AF0818', gold: '#FFC107', orange: '#C88700', grey: '#8B93A1' };
    const data = {
      labels: counts.map((s) => T(s, 'label')),
      datasets: [
        {
          data: counts.map((s) => s.count),
          backgroundColor: counts.map((s) => `${colorMap[s.color] || '#26634B'}CC`),
          borderColor: counts.map((s) => colorMap[s.color] || '#26634B'),
          borderWidth: 1,
          borderRadius: 8
        }
      ]
    };
    return (
      <div style={{ height: 220 }}>
        <Bar ref={ref} data={data} options={{ ...common, scales: { ...common.scales, y: { ...common.scales.y, ticks: { ...common.scales.y.ticks, precision: 0 } } } }} />
      </div>
    );
  }

  // recovery
  const data = {
    labels,
    datasets: [
      {
        label: t('chart_recovery'),
        data: TREND.recovery,
        borderColor: 'rgba(0, 102, 4, 0.95)',
        backgroundColor: 'rgba(0, 102, 4, 0.10)',
        tension: 0.35,
        pointRadius: 2,
        fill: true
      }
    ]
  };
  const opts = {
    ...common,
    scales: {
      x: { ...common.scales.x, reverse: isRtl },
      y: { ...common.scales.y, min: 70, max: 95, ticks: { color: '#4A4A4A', callback: (v) => `${v}%` } }
    }
  };

  return (
    <div style={{ height: 220 }}>
      <Line ref={ref} data={data} options={opts} />
    </div>
  );
}

export default function Assistant() {
  const { t, lang, T } = useI18n();
  const [q, setQ] = useState('');
  const [msgs, setMsgs] = useState(() => [
    { id: 'welcome', role: 'assistant', html: mdToHtml(DEFAULT_ANSWER[lang] || DEFAULT_ANSWER.en), chart: null }
  ]);

  useEffect(() => {
    // Update the initial helper message on language switch
    setMsgs((prev) => {
      const first = prev[0];
      if (!first || first.id !== 'welcome') return prev;
      return [{ ...first, html: mdToHtml(DEFAULT_ANSWER[lang] || DEFAULT_ANSWER.en) }, ...prev.slice(1)];
    });
  }, [lang]);

  const suggestions = useMemo(() => {
    if (lang === 'zh') return ['本月回收率多少？', '逾期账款情况如何？', '异常/欺诈拦截了多少？', '待审批账单有哪些？'];
    if (lang === 'ar') return ['ما هو معدل التحصيل؟', 'ما هي المديونيات المتعثرة؟', 'كم عدد الحالات المنحرفة؟', 'ما الفواتير المعلقة للموافقة؟'];
    return ["What is this month's collection rate?", 'What overdue receivables need attention?', 'How many anomalies were blocked?', 'What invoices are pending approval?'];
  }, [lang]);

  // Every value here is derived live from the same real arrays the rest of the
  // app renders from, so the assistant's answers can never drift out of sync
  // with what the Dashboard/Risk/Collection/Approvals/Invoices pages show.
  const stats = useMemo(() => {
    const recoveryKpi = KPIS.find((k) => k.id === 'recovery');
    const amountKpi = KPIS.find((k) => k.id === 'amount');
    const automationKpi = KPIS.find((k) => k.id === 'automation');
    const anomalyKpi = KPIS.find((k) => k.id === 'anomaly');
    const cycleKpi = KPIS.find((k) => k.id === 'cycle');

    const totalSourceCount = SOURCES.reduce((s, x) => s + x.count, 0);
    const pct = (id) => {
      const s = SOURCES.find((x) => x.id === id);
      return s ? Math.round((s.count / totalSourceCount) * 1000) / 10 : 0;
    };

    const lowCount = COLLECTIONS.filter((c) => c.prob < 40).length;
    const oldest = [...COLLECTIONS].sort((a, b) => b.overdue - a.overdue)[0];
    const debtTotal = COLLECTIONS.reduce((s, c) => s + c.amount, 0);

    const highRisk = RISKS.filter((r) => r.score >= 60).length;
    const midRisk = RISKS.filter((r) => r.score >= 40 && r.score < 60).length;
    const topRisk = [...RISKS].sort((a, b) => b.score - a.score)[0];
    const topRiskTag = topRisk ? (lang === 'zh' ? topRisk.types[0] : lang === 'ar' ? topRisk.typesAr[0] : topRisk.typesEn[0]) : '';

    const apvTotal = APPROVALS.reduce((s, a) => s + a.amount, 0);
    const apvTop = [...APPROVALS].sort((a, b) => b.amount - a.amount)[0];

    const statusCount = (key) => INVOICES.filter((i) => i.status === key).length;

    return {
      recovery: recoveryKpi?.value,
      recoveryDelta: recoveryKpi?.delta,
      recoveryTarget: recoveryKpi?.target,
      lowCount,
      amountB: amountKpi?.value.toFixed(2),
      amountDelta: amountKpi?.delta,
      processedCount: fmtMoney(KPIS.find((k) => k.id === 'processed')?.value || 0),
      makinPct: pct('momtathil'),
      tahseelPct: pct('forsah'),
      anomalyTotal: anomalyKpi?.value,
      riskListCount: RISKS.length,
      highRisk,
      midRisk,
      topRiskEntity: topRisk ? T(topRisk, 'entity') : '',
      topRiskId: topRisk?.id,
      topRiskTag,
      topRiskScore: topRisk?.score,
      automation: automationKpi?.value,
      automationTarget: automationKpi?.target,
      automationStart: TREND.automation[0],
      debtCount: COLLECTIONS.length,
      debtTotalK: Math.round(debtTotal / 1000),
      oldestEntity: oldest ? T(oldest, 'entity') : '',
      oldestId: oldest?.id,
      oldestDays: oldest?.overdue,
      oldestProb: oldest?.prob,
      apvCount: APPROVALS.length,
      apvTotalM: Math.round((apvTotal / 1000000) * 100) / 100,
      apvTopEntity: apvTop ? T(apvTop, 'entity') : '',
      apvTopId: apvTop?.id,
      apvTopAmount: fmtMoney(apvTop?.amount || 0),
      invTotal: INVOICES.length,
      stApproved: statusCount('approved'),
      stPending: statusCount('pending'),
      stReview: statusCount('review'),
      stDuplicate: statusCount('duplicate'),
      stAnomaly: statusCount('anomaly'),
      avgHours: Math.round((cycleKpi?.value || 0) * 24)
    };
  }, [lang, T]);

  function findAnswer(text) {
    const input = (text || '').trim();
    if (!input) return { answer: DEFAULT_ANSWER[lang] || DEFAULT_ANSWER.en, chart: null };

    const lower = input.toLowerCase();
    const hit = QA.find((x) => x.match.some((m) => lower.includes(m.toLowerCase())));
    if (!hit) return { answer: DEFAULT_ANSWER[lang] || DEFAULT_ANSWER.en, chart: null };

    const template = hit[lang] || hit.en || hit.zh;
    const answer = fillTemplate(template, stats);
    return { answer, chart: hit.chart };
  }

  function ask(text) {
    const trimmed = (text || '').trim();
    if (!trimmed) return;

    const now = Date.now().toString(16);
    const userId = `u_${now}`;
    const botId = `a_${now}`;

    setMsgs((prev) => [
      ...prev,
      { id: userId, role: 'user', html: mdToHtml(trimmed), chart: null },
      { id: botId, role: 'assistant', html: '', chart: null, typing: true }
    ]);

    setQ('');

    const { answer, chart } = findAnswer(trimmed);
    const html = mdToHtml(answer);

    // typing animation
    const plain = html.replace(/<br\/>/g, '\n').replace(/<[^>]+>/g, '');
    let i = 0;

    const tick = () => {
      i += Math.max(1, Math.ceil(plain.length / 42));
      const slice = plain.slice(0, i);
      const safe = mdToHtml(slice);

      setMsgs((prev) => prev.map((m) => (m.id === botId ? { ...m, html: safe, chart } : m)));

      if (i >= plain.length) {
        setMsgs((prev) => prev.map((m) => (m.id === botId ? { ...m, html, chart, typing: false } : m)));
        return;
      }
      window.setTimeout(tick, 28);
    };

    window.setTimeout(tick, 220);
  }

  useEffect(() => {
    // auto scroll to bottom
    const el = document.getElementById('chat_scroll');
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [msgs]);

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="page-head">
        <div>
          <div className="page-title">{t('assistant')}</div>
          <div className="page-sub">{t('ast_sub')}</div>
        </div>
        <span className="badge badge--green">{t('ast_online')}</span>
      </div>

      <div className="chat-shell">
        <div className="card chat-side">
          <div style={{ fontWeight: 900, fontSize: 14 }}>{t('ast_rec_q')}</div>
          <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>{t('ast_rec_sub')}</div>
          <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
            {suggestions.map((s) => (
              <button key={s} className="btn" type="button" onClick={() => ask(s)}>
                {s}
              </button>
            ))}
          </div>

        </div>

        <div className="card chat-main">
          <div id="chat_scroll" className="chat-list" aria-label="Chat messages">
            {msgs.map((m) => (
              <div key={m.id} className={`msg msg--${m.role}`}>
                <div dangerouslySetInnerHTML={{ __html: m.html || (m.typing ? '…' : '') }} />
                {m.chart ? (
                  <div className="msg-chart">
                    <InlineChart type={m.chart} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <form
            className="chat-input"
            onSubmit={(e) => {
              e.preventDefault();
              ask(q);
            }}
          >
            <input
              className="input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('ast_placeholder')}
              aria-label={t('ast_placeholder')}
            />
            <button className="btn btn-primary" type="submit">
              {t('ast_send')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
