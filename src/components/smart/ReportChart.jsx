// A report-model chart block drawn on screen. It uses THE SAME SVG drawing as the PDF / Word exports (src/utils/chartDraw.js), so screen == export;
// the SVG is responsive (the drawing width follows the container, text stays readable on narrow screens), every mark has a tooltip (<title>), and a
// «show as table» fold gives the same numbers as a table (accessibility). Props: { block, lang?, table? = true, className?, onSelect?, selected? }.
// Drill-down: with `onSelect({ kind:'mark'|'label', i, j, key, label, seriesIndex })` every bar / cell / step / label becomes a focusable button (Enter or Space as well as a click);
// `selected` = { i, j? } marks the chosen element. The export drawings carry the same data-i / data-j attributes but are never interactive.
// Slots for the chart toolbar (src/components/charts/ChartFrame.jsx): `head` sits on the title line (it must not add height), `extra` sits between the title and the drawing (the customize panel).
// `ChartSvg` is the drawing alone (no title, note or table): the picker draws thumbnails and the larger preview with it.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useL } from '../../utils/bi';
import { chartRender } from '../../utils/chartKinds';
import { chartTableText } from '../../data/reportFormat';

const SCREEN_FONT = "'IBM Plex Sans Arabic', Tahoma, Arial, sans-serif";
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function ChartTable({ block, lang }) {
  const t = useMemo(() => chartTableText(block, lang), [block, lang]);
  return (
    <div className="table-wrap" tabIndex={0}>
      <table className="table rv-table rc-table" aria-label={block.title}>
        <thead><tr>{t.headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
        <tbody>{t.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} dir={j === 0 ? 'auto' : 'ltr'}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function ChartSvg({ block, lang: langProp, w: fixedW = 0, h, className = '', onSelect = null, selected = null, label }) {
  const { lang: ctxLang } = useL(); const lang = langProp || ctxLang;
  const ref = useRef(null); const [w, setW] = useState(fixedW || 760);
  useEffect(() => {
    if (fixedW) return undefined;
    const el = ref.current; if (!el) return undefined;
    const set = () => { const x = Math.round(el.clientWidth / 20) * 20; if (x > 0) setW(x); };
    set(); if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(set); ro.observe(el); return () => ro.disconnect();
  }, [fixedW]);
  const interactive = typeof onSelect === 'function';
  const svg = useMemo(() => chartRender(block, { lang, w: fixedW || clamp(w, 300, 960), h, responsive: true, font: SCREEN_FONT, interactive }).svg, [block, lang, w, fixedW, h, interactive]);
  const pick = (el) => {
    const host = el && el.closest ? el.closest('[data-i]') : null; if (!host || !interactive || host.getAttribute('role') !== 'button') return;
    const i = Number(host.getAttribute('data-i')); const j = host.hasAttribute('data-j') ? Number(host.getAttribute('data-j')) : null;
    onSelect({ kind: host.getAttribute('data-k') || 'mark', i, j, key: host.getAttribute('data-key'), label: block.labels[i], seriesIndex: j == null ? 0 : j });
  };
  const onKeyDown = (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.getAttribute && e.target.getAttribute('role') === 'button') { e.preventDefault(); pick(e.target); } };
  useEffect(() => { // the chosen element is outlined (the drawing is rebuilt on a resize, so this runs after every render of the SVG)
    const el = ref.current; if (!el) return; el.querySelectorAll('.is-selected').forEach((n) => n.classList.remove('is-selected'));
    if (!selected) return;
    el.querySelectorAll('[data-i]').forEach((n) => { if (Number(n.getAttribute('data-i')) === selected.i && (selected.j == null || Number(n.getAttribute('data-j')) === selected.j)) n.classList.add('is-selected'); });
  }, [svg, selected]);
  return <div ref={ref} className={`rc-svg${interactive ? ' rc-svg--act' : ''} ${className}`} dir="ltr" aria-label={label} onClick={interactive ? (e) => pick(e.target) : undefined} onKeyDown={interactive ? onKeyDown : undefined} dangerouslySetInnerHTML={{ __html: svg }} />;
}

export default function ReportChart({ block, lang: langProp, table = true, className = '', onSelect = null, selected = null, head = null, extra = null }) {
  const { lang: ctxLang } = useL(); const lang = langProp || ctxLang; const ar = lang === 'ar';
  return (
    <figure className={`rc-fig ${className}`} data-chart-kind={block.kind || 'bar'} data-chart-id={block.id || undefined}>
      {(block.title || head) && <div className="rc-head">{block.title ? <h4 className="rv-sec-title rc-title">{block.title}</h4> : <span />}{head}</div>}
      {extra}
      <ChartSvg block={block} lang={lang} onSelect={onSelect} selected={selected} />
      {block.note && <figcaption className="rc-note muted">{block.note}</figcaption>}
      {table && (
        <details className="rc-tablefold">
          <summary>{ar ? 'عرض جدول البيانات' : 'View data table'}</summary>
          <ChartTable block={block} lang={lang} />
        </details>
      )}
    </figure>
  );
}
