import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';
import { useI18n } from '../context/I18nContext';
import { DEFAULT_ANSWER, QA, SOURCES, TREND } from '../data/mock';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Legend);

function mdToHtml(s = '') {
  // minimal markdown: **bold** + line breaks
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\n/g, '<br/>');
}

function InlineChart({ type }) {
  const { lang, isRtl, t } = useI18n();
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
        legend: { rtl: isRtl, labels: { color: '#4A4A4A', boxWidth: 10, usePointStyle: true, pointStyle: 'circle' } },
        tooltip: { rtl: isRtl, backgroundColor: '#FFFFFF', titleColor: '#000000', bodyColor: '#323232', borderColor: '#EAEAEA', borderWidth: 1 }
      },
      scales: {
        x: { reverse: isRtl, ticks: { color: '#4A4A4A' }, grid: { color: 'rgba(0,0,0,0.06)' } },
        y: { ticks: { color: '#4A4A4A' }, grid: { color: 'rgba(0,0,0,0.06)' } }
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
  const { t, lang } = useI18n();
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
    if (lang === 'zh') return ['本月回收率多少？', '本月处理金额多少？', '自动化率达到多少？'];
    if (lang === 'ar') return ['ما هو معدل التحصيل؟', 'ما هو إجمالي المبالغ المعالجة هذا الشهر؟', 'كم بلغت نسبة الأتمتة؟'];
    return ["What is this month's collection rate?", 'How much was processed this month?', 'What is the automation rate?'];
  }, [lang]);

  function findAnswer(text) {
    const input = (text || '').trim();
    if (!input) return { answer: DEFAULT_ANSWER[lang] || DEFAULT_ANSWER.en, chart: null };

    const lower = input.toLowerCase();
    const hit = QA.find((x) => x.match.some((m) => lower.includes(m.toLowerCase())));
    if (!hit) return { answer: DEFAULT_ANSWER[lang] || DEFAULT_ANSWER.en, chart: null };

    const answer = hit[lang] || hit.en || hit.zh;
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

          <div className="hr" />

          <div style={{ fontWeight: 900, fontSize: 14 }}>{t('ast_usecases')}</div>
          <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
            <span className="badge">{t('uc_06')}</span>
            <span className="badge">{t('uc_07')}</span>
            <span className="badge">{t('uc_08')}</span>
            <span className="badge">{t('uc_10')}</span>
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
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
