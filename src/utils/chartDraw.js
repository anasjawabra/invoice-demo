import { localize } from './zh';
// Draws a report-model chart block (bar · hbar · line · pie) as SVG — used by the PDF export (printed page) and, rasterised, by the Word export.
// One drawing, one scale: every tick and label names a value the chart reaches; amounts use the ONE unit of the chart (see reportFormat.chartInfo).
import { chartInfo } from '../data/reportFormat';

export const PALETTE = ['#194185', '#1B8354', '#FDB022', '#B42318', '#6941C6', '#0E9384'];
const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cut = (t, n) => { const x = String(t ?? ''); return x.length > n ? `${x.slice(0, n - 1)}…` : x; };
function niceMax(v) { if (!(v > 0)) return 1; const p = 10 ** Math.floor(Math.log10(v)); const f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; }
const FONT = 'font-family="Tahoma, Arial, sans-serif"';

export function chartSvg(b, { lang = 'ar', w = 900, h = 420 } = {}) {
  const ar = lang === 'ar'; const { cu } = chartInfo(b, lang); const kind = b.kind || 'bar';
  const labels = ar && kind !== 'hbar' && kind !== 'pie' ? [...b.labels].reverse() : b.labels; // right-to-left reading order, as the on-screen chart
  const series = b.series.map((s) => ({ ...s, values: ar && kind !== 'hbar' && kind !== 'pie' ? [...s.values].reverse() : s.values }));
  const legend = (items, y) => {
    let x = 20; let out = '';
    for (const [i, it] of items.entries()) { const t = cut(it, 28); out += `<rect x="${x}" y="${y - 9}" width="11" height="11" fill="${PALETTE[i % PALETTE.length]}"/><text x="${x + 16}" y="${y}" font-size="12" fill="#333" ${FONT}>${esc(t)}</text>`; x += 30 + t.length * 6.5; }
    return out;
  };
  const head = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(b.title)}"><rect width="${w}" height="${h}" fill="#fff"/>`;
  const vals = series.flatMap((s) => s.values).filter((v) => v != null && Number.isFinite(v));
  if (!vals.length) return `${head}<text x="${w / 2}" y="${h / 2}" text-anchor="middle" font-size="14" fill="#666" ${FONT}>${ar ? 'لا بيانات' : localize('No data', lang)}</text></svg>`;

  if (kind === 'pie') {
    const s = series[0]; const pairs = s.values.map((v, i) => ({ v: Math.max(0, v || 0), l: b.labels[i] })).filter((p) => p.v > 0); const tot = pairs.reduce((t, p) => t + p.v, 0) || 1;
    const cx = 230; const cy = h / 2 - 6; const r = Math.min(170, h / 2 - 30); let a0 = -Math.PI / 2; let out = `${head}`;
    pairs.forEach((p, i) => {
      const a1 = a0 + (p.v / tot) * Math.PI * 2; const large = a1 - a0 > Math.PI ? 1 : 0;
      const x0 = cx + r * Math.cos(a0); const y0 = cy + r * Math.sin(a0); const x1 = cx + r * Math.cos(a1); const y1 = cy + r * Math.sin(a1);
      out += pairs.length === 1 ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${PALETTE[0]}"/>` : `<path d="M${cx},${cy} L${x0.toFixed(1)},${y0.toFixed(1)} A${r},${r} 0 ${large} 1 ${x1.toFixed(1)},${y1.toFixed(1)} Z" fill="${PALETTE[i % PALETTE.length]}" stroke="#fff" stroke-width="1.5"/>`;
      a0 = a1;
    });
    pairs.slice(0, 14).forEach((p, i) => { const y = 40 + i * 24; out += `<rect x="${cx + r + 40}" y="${y - 10}" width="12" height="12" fill="${PALETTE[i % PALETTE.length]}"/><text x="${cx + r + 58}" y="${y}" font-size="12.5" fill="#222" ${FONT}>${esc(cut(p.l, 26))} — ${esc(cu.tick(p.v))} (${((p.v / tot) * 100).toFixed(1)}%)</text>`; });
    return `${out}</svg>`;
  }

  const left = kind === 'hbar' ? 170 : 74; const right = 20; const top = 20; const bottom = kind === 'hbar' ? 70 : 96;
  const pw = w - left - right; const ph = h - top - bottom; const max = niceMax(Math.max(...vals, 0)); const min = Math.min(0, ...vals); const lo = min < 0 ? -niceMax(-min) : 0; const span = max - lo;
  let out = head;
  const ticks = 5;
  if (kind === 'hbar') {
    for (let i = 0; i <= ticks; i += 1) { const v = lo + (span * i) / ticks; const x = left + (pw * i) / ticks; out += `<line x1="${x}" y1="${top}" x2="${x}" y2="${top + ph}" stroke="#E4E7EC"/><text x="${x}" y="${top + ph + 18}" text-anchor="middle" font-size="11" fill="#555" ${FONT}>${esc(cu.tick(v))}</text>`; }
    const band = ph / Math.max(1, labels.length); const bw = Math.min(26, (band * 0.72) / series.length);
    labels.forEach((lab, i) => {
      const y0 = top + i * band + (band - bw * series.length) / 2;
      out += `<text x="${left - 8}" y="${top + i * band + band / 2 + 4}" text-anchor="end" font-size="11.5" fill="#222" ${FONT}>${esc(cut(lab, 24))}</text>`;
      series.forEach((s, k) => { const v = s.values[i]; if (v == null) return; const x0 = left + ((0 - lo) / span) * pw; const x1 = left + ((v - lo) / span) * pw; out += `<rect x="${Math.min(x0, x1).toFixed(1)}" y="${(y0 + k * bw).toFixed(1)}" width="${Math.max(1, Math.abs(x1 - x0)).toFixed(1)}" height="${(bw - 2).toFixed(1)}" fill="${PALETTE[k % PALETTE.length]}" rx="2"/>`; });
    });
    return `${out}${legend(series.map((s) => s.label), h - 14)}</svg>`;
  }
  for (let i = 0; i <= ticks; i += 1) { const v = lo + (span * i) / ticks; const y = top + ph - (ph * i) / ticks; out += `<line x1="${left}" y1="${y}" x2="${left + pw}" y2="${y}" stroke="#E4E7EC"/><text x="${left - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#555" ${FONT}>${esc(cu.tick(v))}</text>`; }
  out += `<text x="14" y="${top + ph / 2}" transform="rotate(-90 14 ${top + ph / 2})" text-anchor="middle" font-size="11" fill="#555" ${FONT}>${esc(cu.title)}</text>`;
  const band = pw / Math.max(1, labels.length); const yOf = (v) => top + ph - ((v - lo) / span) * ph; const zero = yOf(0);
  labels.forEach((lab, i) => {
    const cx = left + i * band + band / 2;
    out += `<text x="${cx}" y="${top + ph + 16}" text-anchor="end" transform="rotate(-30 ${cx} ${top + ph + 16})" font-size="11" fill="#222" ${FONT}>${esc(cut(lab, 18))}</text>`;
    if (kind === 'bar') { const bw = Math.min(40, (band * 0.78) / series.length); const x0 = cx - (bw * series.length) / 2; series.forEach((s, k) => { const v = s.values[i]; if (v == null) return; const y = yOf(v); out += `<rect x="${(x0 + k * bw).toFixed(1)}" y="${Math.min(y, zero).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${Math.max(1, Math.abs(zero - y)).toFixed(1)}" fill="${PALETTE[k % PALETTE.length]}" rx="2"/>`; }); }
  });
  if (kind === 'line') {
    series.forEach((s, k) => {
      const pts = s.values.map((v, i) => (v == null ? null : [left + i * band + band / 2, yOf(v)]));
      let d = ''; let pen = false; pts.forEach((p) => { if (!p) { pen = false; return; } d += `${pen ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)} `; pen = true; });
      out += `<path d="${d}" fill="none" stroke="${PALETTE[k % PALETTE.length]}" stroke-width="2.6" stroke-linejoin="round"/>`;
      pts.forEach((p) => { if (p) out += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.6" fill="${PALETTE[k % PALETTE.length]}"/>`; });
    });
  }
  return `${out}<line x1="${left}" y1="${zero}" x2="${left + pw}" y2="${zero}" stroke="#98A2B3"/>${legend(series.map((s) => s.label), h - 14)}</svg>`;
}

// SVG → PNG bytes (browser only; null where there is no canvas, e.g. in a test run — the Word file then carries the chart's data table alone)
export async function chartPng(b, { lang = 'ar', w = 900, h = 420 } = {}) {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null;
  try {
    const svg = chartSvg(b, { lang, w, h }); const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise((res) => c.toBlob(res, 'image/png')); if (!blob) return null;
    return { data: new Uint8Array(await blob.arrayBuffer()), w, h };
  } catch { return null; }
}
