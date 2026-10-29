import { localize } from '../../utils/zh';
import UISymbol from '../UISymbol';
// Renders a report MODEL (src/data/reportModel.js) inside the conversation. Nothing here recomputes a figure: tables show the model's
// numbers in the ONE unit stated in each header, charts use one unit per chart.
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend } from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';
import { useL } from '../../utils/bi';
import { fmtMoney, fmtSar } from '../../utils/money';
import { tableToText, chartInfo, fillTokens, fmtEvidence } from '../../data/reportFormat';
import FinancialRelations from '../revenue/FinancialRelations';
import { fmtRiyadh, fmtRangeText } from '../../data/clock';
import { useTheme } from '../../context/ThemeContext';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend);

const COLORS = ['#1B8354', '#175CD3', '#B54708', '#B42318'];

function Insight({ it }) {
  const { B, lang, ar } = useL(); const L = (a, e) => (ar ? a : localize(e, lang));
  const KIND = { fact: L('حقيقة محسوبة', 'Computed fact'), comparison: L('مقارنة فترات', 'Period comparison'), outlier: L('رصد إحصائي', 'Statistical flag'), estimate: L('تقدير — راجع الافتراضات', 'Estimate — see assumptions'), quality: L('جودة البيانات', 'Data quality') };
  const SEV = { info: L('معلومة', 'Info'), watch: L('للمتابعة', 'Watch'), action: lang === 'zh' ? '需处理' : L('يستدعي إجراء', 'Action') };
  return (
    <article className={`rv-insight rv-insight--${it.severity}`}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}><b>{B(it.title)}</b><span className="rv-tag">{KIND[it.kind]}</span><span className={`rv-tag ${it.severity === 'action' ? 'rv-tag--bad' : it.severity === 'watch' ? 'rv-tag--warn' : ''}`}>{SEV[it.severity]}</span></div>
      <div>{fillTokens(B(it.body), it.tokens, lang)}</div>
      {it.evidence.length > 0 && <div className="rv-insight__ev">{it.evidence.map((e, i) => <span key={i}>{B(e.k)}: <b dir="ltr">{fmtEvidence(e, lang)}</b></span>)}</div>}
      <div className="muted" style={{ fontSize: 12 }}>{L('الأساس', 'Basis')}: {B(it.basis)}</div>
      {it.caveat && <div className="muted" style={{ fontSize: 12 }}>{L('تحفظ', 'Caveat')}: {B(it.caveat)}</div>}
      {it.drill && <div><Link className="btn btn-sm btn-ghost" to={it.drill.to}>{B(it.drill.label)} {lang === 'ar' ? <UISymbol name="left" /> : <UISymbol name="right" />}</Link></div>}
    </article>
  );
}

const TOP = 10;
// A report table you can work with: click a header to sort (view only — exports keep the report's own order), «show all» for long tables, and a row that carries a link opens the invoices behind it.
function Table({ b }) {
  const { lang, ar } = useL(); const L = (a, e) => (ar ? a : localize(e, lang));
  const t = useMemo(() => tableToText(b, lang), [b, lang]);
  const [sort, setSort] = useState(null); const [all, setAll] = useState(false);
  const order = useMemo(() => {
    const idx = b.rows.map((_, i) => i); if (!sort) return idx;
    const num = b.headers[sort.col].kind !== 'text';
    return idx.sort((x, y) => { const p = b.rows[x][sort.col]; const q = b.rows[y][sort.col]; const r = num ? (Number(p) || 0) - (Number(q) || 0) : String(p ?? '').localeCompare(String(q ?? ''), lang); return (sort.dir === 'asc' ? r : -r) || x - y; });
  }, [b, sort, ar, lang]);
  const shown = all || order.length <= TOP + 2 ? order : order.slice(0, TOP);
  const click = (j) => setSort((s) => (s && s.col === j ? (s.dir === 'desc' ? { col: j, dir: 'asc' } : null) : { col: j, dir: b.headers[j].kind === 'text' ? 'asc' : 'desc' }));
  const aria = (j) => (sort && sort.col === j ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none');
  return (
    <div>
      {b.title && <h4 className="rv-sec-title" style={{ fontSize: 14 }}>{b.title}{t.unitText ? <small className="muted"> — {L('المبالغ بوحدة', 'amounts in')}: {t.unitText}</small> : null}</h4>}
      <div className="table-wrap" tabIndex={0}>
        <table className="table rv-table" aria-label={b.title}>
          <thead><tr>{t.headers.map((h, i) => <th key={i} aria-sort={aria(i)}><button type="button" className="rv-sort" onClick={() => click(i)} title={L('اضغط للفرز', 'Click to sort')}>{h}{sort && sort.col === i ? <UISymbol name={sort.dir === 'asc' ? 'up' : 'down'} /> : null}</button></th>)}</tr></thead>
          <tbody>
            {shown.map((i) => { const r = t.rows[i]; const link = b.links?.[i]; return (
              <tr key={i} className={link ? 'rv-row--link' : undefined}>{r.map((c, j) => <td key={j} dir={j === 0 ? 'auto' : 'ltr'} title={b.headers[j].kind === 'money' && typeof b.rows[i][j] === 'number' ? fmtSar(b.rows[i][j], lang) : undefined}>{j === 0 && link ? <Link to={link} title={L('افتح الفواتير غير المحصّلة لهذا الصف', 'Open the uncollected invoices for this row')}>{c}</Link> : c}</td>)}</tr>
            ); })}
            {!t.rows.length && <tr><td colSpan={t.headers.length}><div className="rv-empty">{L('لا بيانات في هذا الاختيار.', 'No data in this selection.')}</div></td></tr>}
            {t.total && t.rows.length > 0 && <tr style={{ fontWeight: 700 }}>{t.total.map((c, j) => <td key={j} dir={j === 0 ? 'auto' : 'ltr'}>{c}</td>)}</tr>}
          </tbody>
        </table>
      </div>
      {order.length > TOP + 2 && <button type="button" className="btn btn-sm btn-ghost" onClick={() => setAll((v) => !v)}>{all ? L(`عرض أعلى ${TOP} فقط`, `Show the top ${TOP} only`) : L(`عرض كل الصفوف (${order.length})`, `Show all ${order.length} rows`)}</button>}
      {b.note && <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{b.note}</div>}
    </div>
  );
}

function Chart({ b }) {
  const { lang, isRtl } = useL();
  const { theme } = useTheme();
  const ink = theme === 'dark' ? '#D2D6DB' : '#4D5761';
  const font = { family: isRtl ? 'IBM Plex Sans Arabic' : localize('IBM Plex Sans', lang), size: 12 };
  const kind = b.kind || 'bar'; const { cu } = useMemo(() => chartInfo(b, lang), [b, lang]);
  const data = useMemo(() => {
    if (kind === 'pie') { const s = b.series[0]; return { labels: b.labels, datasets: [{ label: s.label, data: s.values, backgroundColor: b.labels.map((_, i) => COLORS[i % COLORS.length]) }] }; }
    return { labels: b.labels, datasets: b.series.map((s, i) => ({ label: s.label, data: s.values, backgroundColor: COLORS[i % COLORS.length], borderColor: COLORS[i % COLORS.length], borderWidth: kind === 'line' ? 2.5 : 0, pointRadius: kind === 'line' ? 3 : 0, tension: 0.2, borderRadius: kind === 'line' ? 0 : 4 })) };
  }, [b, kind]);
  const value = (c) => (kind === 'hbar' ? c.parsed.x : kind === 'pie' ? c.parsed : c.parsed.y);
  const tip = { rtl: isRtl, titleFont: font, bodyFont: font, callbacks: { label: (c) => `${kind === 'pie' ? c.label : c.dataset.label}: ${value(c) == null ? '—' : cu.fmt(value(c))}`, afterLabel: (c) => (b.plain || value(c) == null ? '' : fmtSar(value(c), lang)) } };
  const legend = { position: 'bottom', rtl: isRtl, labels: { boxWidth: 12, font, color: ink } };
  const options = useMemo(() => (kind === 'pie'
    ? { responsive: true, maintainAspectRatio: false, plugins: { legend, tooltip: tip } }
    : kind === 'hbar'
      ? { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend, tooltip: tip }, scales: { y: { reverse: false, grid: { display: false }, ticks: { font, color: ink } }, x: { beginAtZero: true, position: isRtl ? 'top' : localize('bottom', lang), reverse: isRtl, title: { display: true, text: cu.title, font, color: ink }, ticks: { font, color: ink, callback: (v) => cu.tick(v) } } } }
      : { responsive: true, maintainAspectRatio: false, plugins: { legend, tooltip: tip }, scales: { x: { reverse: isRtl, grid: { display: false }, ticks: { font, color: ink } }, y: { beginAtZero: true, title: { display: true, text: cu.title, font, color: ink }, ticks: { font, color: ink, callback: (v) => cu.tick(v) } } } }), [cu, isRtl, kind, ink, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const Cmp = kind === 'line' ? Line : kind === 'pie' ? Pie : Bar;
  return (
    <div>
      {b.title && <h4 className="rv-sec-title" style={{ fontSize: 14 }}>{b.title}</h4>}
      <div className="rv-chart" style={{ height: kind === 'pie' ? 300 : 260 }} role="img" aria-label={b.title}><Cmp key={kind} role="presentation" data={data} options={options} /></div>
    </div>
  );
}

function Block({ b }) {
  const { ar, lang } = useL(); const L = (a, e) => (ar ? a : localize(e, lang)); // eslint-disable-line no-unused-vars
  if (b.type === 'text') return <p style={{ lineHeight: 1.9, fontSize: 14 }} dir="auto">{b.text}</p>;
  if (b.type === 'kpis') return (
    <div className="rv-tiles">{b.items.map((m) => <div key={m.label} className="rv-tile" title={typeof m.raw === 'number' ? /\bSAR\b|ريال|沙特里亚尔/.test(m.value) ? fmtSar(m.raw, lang) : String(m.value) : undefined}><div className="rv-tile__label">{m.label}</div><div className="rv-tile__value" dir="ltr" style={{ fontSize: 18 }}>{m.value}</div><div className="rv-tile__sub">{m.sub}</div></div>)}</div>
  );
  if (b.type === 'relations') return <div className="card card-pad"><FinancialRelations totals={b.totals} /></div>;
  if (b.type === 'table') return <Table b={b} />;
  if (b.type === 'chart') return <Chart b={b} />;
  if (b.type === 'insights') return <div style={{ display: 'grid', gap: 16 }}>{b.title && <h4 className="rv-sec-title" style={{ fontSize: 14 }}>{b.title}</h4>}{b.items.map((it) => <Insight key={it.id} it={it} />)}</div>;
  if (b.type === 'callout') return <div className={`rv-callout ${b.tone === 'warn' ? 'rv-callout--warn' : ''}`}>{b.text}</div>;
  if (b.type === 'list') return <ul className="res__list res__list--plain">{b.items.map((x, i) => <li key={i} dir="auto">{x}</li>)}</ul>;
  return null;
}

export default function ReportView({ model }) {
  const { ar, lang } = useL(); const L = (a, e) => (ar ? a : localize(e, lang));
  const hum = (v) => String(v ?? '').replace(/(\d{4}-\d{2}-\d{2}) → (\d{4}-\d{2}-\d{2})/g, (_, a, b) => fmtRangeText(a, b, lang));
  const ctx = (k) => model.context.find((c) => c.k === k)?.value;
  const summaryLine = [hum(ctx('period')), ctx('amanah'), ctx('source'), ctx('basis') ? hum(ctx('basis')) : null].filter(Boolean).join(' · ') || model.subtitle;
  const FOLD = ['assumptions', 'findings', 'forecast']; // secondary explanations are expandable
  return (
    <div className="sr-report" data-report-id={model.id}>
      <div className="sr-report__head">
        <h2 className="sr-report__title">{model.title}</h2>
        <p className="rv-line">{summaryLine}</p>
        <details className="rv-more">
          <summary>{L('تفاصيل التقرير', 'Report details')}</summary>
          <div className="sr-chips" aria-label={L('سياق التقرير', 'Report context')}>{model.context.filter((c) => c.k !== 'basis' && c.k !== 'data').map((c) => <span key={c.k} className="sr-chip"><em>{c.label}</em> <bdi>{hum(c.value)}</bdi></span>)}</div>
          <div className="sr-note"><b>{L('أساس التقرير', 'Basis')}:</b> {hum(model.context.find((c) => c.k === 'basis')?.value)} · <b>{L('البيانات', 'Data')}:</b> {model.context.find((c) => c.k === 'data')?.value} · {L('أُعدّ في', 'Prepared')} {fmtRiyadh(model.generatedAt)} ({L('بتوقيت الرياض', 'Riyadh time')})</div>
        </details>
      </div>
      {model.headline.map((b, i) => <Block key={`h${i}`} b={b} />)}
      {model.sections.map((sec) => FOLD.includes(sec.key) ? (
        <details key={sec.key} className="sr-section rv-more">
          <summary>{sec.title}</summary>
          <div style={{ display: 'grid', gap: 16, marginTop: 8 }}>{sec.blocks.map((b, i) => <Block key={i} b={b} />)}</div>
        </details>
      ) : (
        <section key={sec.key} className="sr-section" aria-label={sec.title}>
          <h3 className="sr-section__title">{sec.title}</h3>
          {sec.purpose && <div className="muted" style={{ fontSize: 13 }}>{sec.purpose}</div>}
          <div style={{ display: 'grid', gap: 16, marginTop: 8 }}>{sec.blocks.map((b, i) => <Block key={i} b={b} />)}</div>
        </section>
      ))}
    </div>
  );
}
