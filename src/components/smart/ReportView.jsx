// Renders a report MODEL (src/data/reportModel.js) inside the conversation. Nothing here recomputes a figure: tables show the model's
// numbers in the ONE unit stated in each header, charts use one unit per chart.
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useL } from '../../utils/bi';
import { fmtMoney, fmtSar } from '../../utils/money';
import { tableToText, chartInfo, fillTokens, fmtEvidence } from '../../data/reportFormat';
import FinancialRelations from '../revenue/FinancialRelations';
import { fmtRiyadh } from '../../data/clock';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const COLORS = ['rgba(45, 95, 139, 0.8)', 'rgba(27, 131, 84, 0.8)', 'rgba(255, 193, 7, 0.85)', 'rgba(175, 8, 24, 0.7)'];

function Insight({ it }) {
  const { B, lang, ar } = useL(); const L = (a, e) => (ar ? a : e);
  const KIND = { fact: L('حقيقة محسوبة', 'Computed fact'), comparison: L('مقارنة فترات', 'Period comparison'), outlier: L('رصد إحصائي', 'Statistical flag'), estimate: L('تقدير — راجع الافتراضات', 'Estimate — see assumptions'), quality: L('جودة البيانات', 'Data quality') };
  const SEV = { info: L('معلومة', 'Info'), watch: L('للمتابعة', 'Watch'), action: L('يستدعي إجراء', 'Action') };
  return (
    <article className={`rv-insight rv-insight--${it.severity}`}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}><b>{B(it.title)}</b><span className="rv-tag">{KIND[it.kind]}</span><span className={`rv-tag ${it.severity === 'action' ? 'rv-tag--bad' : it.severity === 'watch' ? 'rv-tag--warn' : ''}`}>{SEV[it.severity]}</span></div>
      <div>{fillTokens(B(it.body), it.tokens, lang)}</div>
      {it.evidence.length > 0 && <div className="rv-insight__ev">{it.evidence.map((e, i) => <span key={i}>{B(e.k)}: <b dir="ltr">{fmtEvidence(e, lang)}</b></span>)}</div>}
      <div className="muted" style={{ fontSize: 12 }}>{L('الأساس', 'Basis')}: {B(it.basis)}</div>
      {it.caveat && <div className="muted" style={{ fontSize: 12 }}>{L('تحفظ', 'Caveat')}: {B(it.caveat)}</div>}
      {it.drill && <div><Link className="btn btn-sm btn-ghost" to={it.drill.to}>{B(it.drill.label)} {lang === 'ar' ? '←' : '→'}</Link></div>}
    </article>
  );
}

function Table({ b }) {
  const { lang, ar } = useL(); const L = (a, e) => (ar ? a : e);
  const t = useMemo(() => tableToText(b, lang), [b, lang]);
  return (
    <div>
      {b.title && <h4 className="rv-sec-title" style={{ fontSize: 14 }}>{b.title}{t.unitText ? <small className="muted"> — {L('المبالغ بوحدة', 'amounts in')}: {t.unitText}</small> : null}</h4>}
      <div className="table-wrap">
        <table className="table" aria-label={b.title}>
          <thead><tr>{t.headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
          <tbody>
            {t.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} dir={j === 0 ? 'auto' : 'ltr'} title={b.headers[j].kind === 'money' && typeof b.rows[i][j] === 'number' ? fmtSar(b.rows[i][j]) : undefined}>{c}</td>)}</tr>)}
            {!t.rows.length && <tr><td colSpan={t.headers.length}><div className="rv-empty">{L('لا بيانات في هذا الاختيار.', 'No data in this selection.')}</div></td></tr>}
            {t.total && t.rows.length > 0 && <tr style={{ fontWeight: 900 }}>{t.total.map((c, j) => <td key={j} dir={j === 0 ? 'auto' : 'ltr'}>{c}</td>)}</tr>}
          </tbody>
        </table>
      </div>
      {b.note && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{b.note}</div>}
    </div>
  );
}

function Chart({ b }) {
  const { lang, isRtl } = useL();
  const { cu } = useMemo(() => chartInfo(b, lang), [b, lang]);
  const data = useMemo(() => ({ labels: b.labels, datasets: b.series.map((s, i) => ({ label: s.label, data: s.values, backgroundColor: COLORS[i % COLORS.length], borderRadius: 3 })) }), [b]);
  const options = useMemo(() => ({ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', rtl: isRtl, labels: { boxWidth: 12, font: { size: 11 } } }, tooltip: { rtl: isRtl, callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.y == null ? '—' : cu.fmt(c.parsed.y)}`, afterLabel: (c) => (c.parsed.y == null ? '' : fmtSar(c.parsed.y)) } } }, scales: { x: { reverse: isRtl, grid: { display: false }, ticks: { font: { size: 11 } } }, y: { beginAtZero: true, title: { display: true, text: cu.title, font: { size: 11 } }, ticks: { callback: (v) => cu.tick(v) } } } }), [cu, isRtl]);
  return (
    <div>
      {b.title && <h4 className="rv-sec-title" style={{ fontSize: 14 }}>{b.title}</h4>}
      <div className="rv-chart" style={{ height: 260 }} role="img" aria-label={b.title}><Bar data={data} options={options} /></div>
    </div>
  );
}

function Block({ b }) {
  const { ar } = useL(); const L = (a, e) => (ar ? a : e); // eslint-disable-line no-unused-vars
  if (b.type === 'text') return <p style={{ lineHeight: 1.9, fontSize: 14 }} dir="auto">{b.text}</p>;
  if (b.type === 'kpis') return (
    <div className="rv-tiles">{b.items.map((m) => <div key={m.label} className="rv-tile" title={m.raw != null && typeof m.raw === 'number' && m.raw > 1 ? fmtSar(m.raw) : undefined}><div className="rv-tile__label">{m.label}</div><div className="rv-tile__value" dir="ltr" style={{ fontSize: 18 }}>{m.value}</div><div className="rv-tile__sub">{m.sub}</div></div>)}</div>
  );
  if (b.type === 'relations') return <div className="card card-pad"><FinancialRelations totals={b.totals} /></div>;
  if (b.type === 'table') return <Table b={b} />;
  if (b.type === 'chart') return <Chart b={b} />;
  if (b.type === 'insights') return <div style={{ display: 'grid', gap: 14 }}>{b.title && <h4 className="rv-sec-title" style={{ fontSize: 14 }}>{b.title}</h4>}{b.items.map((it) => <Insight key={it.id} it={it} />)}</div>;
  if (b.type === 'callout') return <div className={`rv-callout ${b.tone === 'warn' ? 'rv-callout--warn' : ''}`}>{b.text}</div>;
  if (b.type === 'list') return <ul className="res__list res__list--plain">{b.items.map((x, i) => <li key={i} dir="auto">{x}</li>)}</ul>;
  return null;
}

export default function ReportView({ model }) {
  const { ar } = useL(); const L = (a, e) => (ar ? a : e);
  return (
    <div className="sr-report" data-report-id={model.id}>
      <div className="sr-report__head">
        <h3 className="sr-report__title">{model.title}</h3>
        <div className="muted" style={{ fontSize: 12 }}>{model.subtitle} · {L('أُعدّ في', 'Prepared')} {fmtRiyadh(model.generatedAt)} ({L('بتوقيت الرياض', 'Riyadh time')})</div>
        <div className="sr-chips" aria-label={L('سياق التقرير', 'Report context')}>{model.context.filter((c) => c.k !== 'basis' && c.k !== 'data').map((c) => <span key={c.k} className="sr-chip"><em>{c.label}</em> <bdi>{c.value}</bdi></span>)}</div>
        <div className="sr-note"><b>{L('أساس التقرير', 'Basis')}:</b> {model.context.find((c) => c.k === 'basis')?.value} · <b>{L('البيانات', 'Data')}:</b> {model.context.find((c) => c.k === 'data')?.value}</div>
      </div>
      {model.headline.map((b, i) => <Block key={`h${i}`} b={b} />)}
      {model.sections.map((sec) => (
        <section key={sec.key} className="sr-section" aria-label={sec.title}>
          <h4 className="sr-section__title">{sec.title}</h4>
          {sec.purpose && <div className="muted" style={{ fontSize: 12.5 }}>{sec.purpose}</div>}
          <div style={{ display: 'grid', gap: 14, marginTop: 8 }}>{sec.blocks.map((b, i) => <Block key={i} b={b} />)}</div>
        </section>
      ))}
    </div>
  );
}
