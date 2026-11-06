// ONE SVG drawing for every report-model chart block — used on screen (ReportChart.jsx, responsive via viewBox), by the PDF/print export and, rasterised, by the Word export,
// so what is read on screen is what is printed.  Kinds: bar · hbar · line · pie · waterfall · stacked_hbar · heatmap  (block contract: scratch/_agent-brief.md).
// Rules: bars/waterfall totals start at zero · a zero draws no mark but is labelled 0 · a missing value (null) is a gap / hatched «—», never zero · the chart's ONE unit is named once
// (axis/legend title) and tick labels carry no currency · Arabic charts are mirrored as a whole (first category at the right, value axis at the right, legend right-to-left) · no clipped
// labels (wrapped, rotated or cut with the full text in the tooltip) · legends sit in their own band below the plot · role=img + a one-sentence aria-label + <title>/<desc>.
import { chartInfo, chartSummary } from '../data/reportFormat';
import { fmtSar } from './money';

export const PALETTE = ['#194185', '#1B8354', '#FDB022', '#B42318', '#6941C6', '#0E9384'];
const ROLE = { net: '#194185', gross: '#194185', total: '#194185', collected: '#1B8354', uncollected: '#E58A00', exclusions: '#B42318', cash: '#6941C6', target: '#6941C6' };
const colorOf = (s, k) => ROLE[s?.role] || PALETTE[k % PALETTE.length];
const INK = '#1D2939'; const MUTE = '#667085'; const GRID = '#E4E7EC'; const AXIS = '#98A2B3';
const DEC = '#B42318'; const INC = '#1B8354'; const TOTAL = '#194185';
export const FONT_EXPORT = 'Tahoma, Arial, sans-serif';

const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const f = (n) => (Number.isFinite(n) ? +n.toFixed(2) : 0);
const iso = (s) => `⁦${s}⁩`; // a number inside Arabic text keeps its own left-to-right order
const MINUS = '−';
const tw = (s, size = 11) => String(s ?? '').length * size * 0.56; // text-width estimate (Arabic and Latin alike)
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
const onColor = (hex) => (lum(hex) > 0.62 ? INK : '#fff');
const mix = (a, b, t) => { const pa = parseInt(a.slice(1), 16); const pb = parseInt(b.slice(1), 16); const ch = (s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t); return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('')}`; };
const RAMP = ['#EAF2FB', '#7FB0DC', '#12306B']; // one-hue sequential ramp: lightness alone carries the order (colour-blind safe)
const rampAt = (t) => { const x = Math.min(1, Math.max(0, t)) * 2; return x <= 1 ? mix(RAMP[0], RAMP[1], x) : mix(RAMP[1], RAMP[2], x - 1); };
const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i += 1) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h.toString(36); };

// ---------- scale ----------
function niceScale(min, max, n = 5) {
  let lo = Math.min(0, min); let hi = Math.max(0, max); if (hi === lo) hi = lo + 1;
  const raw = (hi - lo) / n; const p = 10 ** Math.floor(Math.log10(raw)); const fr = raw / p;
  const step = (fr <= 1 ? 1 : fr <= 2 ? 2 : fr <= 2.5 ? 2.5 : fr <= 5 ? 5 : 10) * p;
  lo = Math.floor(lo / step + 1e-9) * step; hi = Math.ceil(hi / step - 1e-9) * step;
  const ticks = []; for (let v = lo; v <= hi + step * 1e-6; v += step) ticks.push(Number(v.toPrecision(12)));
  return { lo, hi, step, ticks, span: hi - lo || 1 };
}
// ---------- text wrapping ----------
function wrapText(str, maxChars, maxLines) {
  const words = String(str ?? '').split(/\s+/).filter(Boolean); const lines = []; let cur = ''; let cut = false;
  for (let w0 of words) {
    if (w0.length > maxChars) { w0 = `${w0.slice(0, Math.max(1, maxChars - 1))}…`; cut = true; }
    if (cur && (cur.length + 1 + w0.length) > maxChars) { lines.push(cur); cur = w0; } else cur = cur ? `${cur} ${w0}` : w0;
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { const keep = lines.slice(0, maxLines); const last = keep[maxLines - 1]; keep[maxLines - 1] = `${last.length >= maxChars ? last.slice(0, maxChars - 1) : last}…`; return { lines: keep, cut: true }; }
  return { lines: lines.length ? lines : [''], cut };
}
const cutStr = (s, n) => { const x = String(s ?? ''); return x.length > n ? { s: `${x.slice(0, n - 1)}…`, cut: true } : { s: x, cut: false }; };

// ---------- drawing context (logical left-to-right coordinates; mirrored for Arabic) ----------
function makeCtx(b, o) {
  const ar = o.lang === 'ar'; const w = o.w; const info = chartInfo(b, o.lang);
  const dirOf = (num) => (num ? 'ltr' : ar ? 'rtl' : 'ltr');
  const c = { b, ar, w, lang: o.lang, o, info, cu: info.cu, font: o.font || FONT_EXPORT };
  const px = (x, wd = 0) => (ar ? w - x - wd : x);
  // drill-down hooks (harmless in PDF / PowerPoint): data-i / data-j (+ data-key from block.keys) on a mark; with `interactive` the mark is also a focusable button
  c.dat = (a) => {
    const d = a && a.d; if (!d) return '';
    const key = d.key ?? (b.keys ? b.keys[d.i] : null);
    let t = ` data-k="${d.k || 'mark'}"${d.i != null ? ` data-i="${d.i}"` : ''}${d.j != null ? ` data-j="${d.j}"` : ''}${key != null ? ` data-key="${esc(key)}"` : ''}`;
    if (o.interactive && d.act !== false) t += ` tabindex="0" role="button" class="rc-mark" aria-label="${esc(a.lbl || a.title || '')}"`;
    return t;
  };
  c.rect = (x, y, wd, ht, fill, a = {}) => `<rect x="${f(px(x, wd))}" y="${f(y)}" width="${f(wd)}" height="${f(ht)}" fill="${fill}"${a.rx ? ` rx="${a.rx}"` : ''}${a.stroke ? ` stroke="${a.stroke}" stroke-width="${a.sw || 1}"` : ''}${a.dash ? ` stroke-dasharray="${a.dash}"` : ''}${a.op != null ? ` fill-opacity="${a.op}"` : ''}${c.dat(a)}${a.title ? `><title>${esc(a.title)}</title></rect>` : '/>'}`;
  c.line = (x1, y1, x2, y2, stroke, a = {}) => `<line x1="${f(px(x1))}" y1="${f(y1)}" x2="${f(px(x2))}" y2="${f(y2)}" stroke="${stroke}" stroke-width="${a.sw || 1}"${a.dash ? ` stroke-dasharray="${a.dash}"` : ''}/>`;
  c.circle = (x, y, r, fill, a = {}) => `<circle cx="${f(px(x))}" cy="${f(y)}" r="${r}" fill="${fill}"${a.stroke ? ` stroke="${a.stroke}" stroke-width="${a.sw || 1.8}"` : ''}${a.title ? `><title>${esc(a.title)}</title></circle>` : '/>'}`;
  c.path = (pts, stroke, a = {}) => `<path d="${pts.map((p, i) => `${i ? 'L' : 'M'}${f(px(p[0]))},${f(p[1])}`).join(' ')}" fill="none" stroke="${stroke}" stroke-width="${a.sw || 2.4}" stroke-linejoin="round" stroke-linecap="round"${a.dash ? ` stroke-dasharray="${a.dash}"` : ''}/>`;
  // align: 's' text starts at x and runs toward the end side · 'e' ends at x · 'm' centred.  num: a number/percent — always laid out left-to-right.
  c.text = (x, y, s, a = {}) => {
    const size = a.size || 11; const dir = dirOf(a.num || !/[\u0600-\u06FF]/.test(s)); // numbers, ranges and Latin text read left-to-right even in an Arabic chart
     const edge = a.align === 'm' ? 'm' : (a.align === 'e') === ar ? 'l' : 'r'; // physical edge held at x: 's' = left edge in LTR / right edge in Arabic; 'e' the other way round
    const anchor = edge === 'm' ? 'middle' : (dir === 'ltr') === (edge === 'l') ? 'start' : 'end';
    const X = f(px(x)); const rot = a.rot ? (ar ? -a.rot : a.rot) : 0;
    return `<text x="${X}" y="${f(y)}" text-anchor="${anchor}"${dir === 'rtl' ? ' direction="rtl"' : ''} font-size="${size}" fill="${a.fill || INK}"${a.weight ? ` font-weight="${a.weight}"` : ''} font-family="${c.font}"${rot ? ` transform="rotate(${rot} ${X} ${f(y)})"` : ''}${c.dat({ ...a, lbl: a.title || s })}>${esc(s)}${a.title ? `<title>${esc(a.title)}</title>` : ''}</text>`;
  };
  c.num = (x, y, s, a = {}) => c.text(x, y, s, { ...a, num: true });
  c.height = (fixed, natural) => (o.h ? Math.max(90, o.h - fixed) : natural);
  c.noData = () => finish(c, 140, `<text x="${w / 2}" y="70" text-anchor="middle" font-size="14" fill="${MUTE}" font-family="${c.font}">${ar ? 'لا بيانات' : 'No data'}</text>`);
  const basis = b.basis === 'monthly' || b.basis === 'cumulative' ? b.basis : null;
  c.basisWord = (bs) => (bs === 'monthly' ? (ar ? 'شهري' : 'Monthly') : bs === 'cumulative' ? (ar ? 'تراكمي' : 'Cumulative') : '');
  c.axisTitle = () => (basis && !info.rate ? `${c.basisWord(basis)} — ${c.cu.title}` : c.cu.title);
  c.serLabel = (s) => { const bs = s.basis || basis; const word = c.basisWord(bs); if (!word) return s.label; const l = String(s.label); return l.includes('تراكمي') || l.includes('شهري') || /monthly|cumulative/i.test(l) ? l : `${l} · ${word}`; };
  c.tip = (label, sname, v) => `${label}${sname ? ` — ${sname}` : ''}: ${v == null ? '—' : c.cu.fmt(v)}${v != null && !info.plain && !info.rate ? ` (${fmtSar(v, o.lang)})` : ''}`;
  return c;
}
function finish(c, h, body, extra = '') {
  const { b, w, o } = c; const sum = chartSummary(b, o.lang);
  const dim = o.responsive ? ' style="width:100%;height:auto;display:block;overflow:visible"' : ` width="${w}" height="${h}"`;
  const bg = o.responsive ? '' : `<rect width="${w}" height="${h}" fill="#fff"/>`;
  return { w, h, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"${dim} direction="ltr" role="${o.interactive ? 'group' : 'img'}" aria-label="${esc(sum)}" data-kind="${esc(b.kind || 'bar')}"${extra}><title>${esc(b.title || sum)}</title><desc>${esc(sum)}</desc>${bg}${body}</svg>` };
}
const unitHead = (c, y = 15) => (c.info.plain && !c.b.valueTitle ? '' : c.text(6, y, c.axisTitle(), { size: 11.5, fill: MUTE, weight: 600 }));

// ---------- legend (own band below the plot; wraps to several rows, never over marks) ----------
function legendPlan(c, items, maxW) {
  if (c.b.showLegend === false) return { h: 0, draw: () => '' }; // block.showLegend:false → the legend band is dropped
  const rows = []; let cur = []; let x = 0;
  items.forEach((it) => { const lab = cutStr(it.label, 60); const wd = 24 + tw(lab.s, 11.5) + 18; if (x + wd > maxW && cur.length) { rows.push(cur); cur = []; x = 0; } cur.push({ ...it, lab, x, wd }); x += wd; });
  if (cur.length) rows.push(cur);
  return {
    h: rows.length ? rows.length * 20 + 8 : 0,
    draw: (y0) => rows.map((row, r) => row.map((it) => {
      const y = y0 + r * 20 + 10; const x = 14 + it.x; let m = '';
      if (it.kind === 'line' || it.kind === 'dash') m = c.line(x, y - 3.5, x + 18, y - 3.5, it.color, { sw: 2.6, dash: it.kind === 'dash' ? '5 3' : null }) + (it.shape != null ? marker(c, it.shape, x + 9, y - 3.5, 3.6, it.kind === 'dash' ? '#fff' : it.color, { stroke: it.color }) : c.circle(x + 9, y - 3.5, 3, it.kind === 'dash' ? '#fff' : it.color, it.kind === 'dash' ? { stroke: it.color } : {}));
      else if (it.kind === 'hatch') m = `<rect x="${f(c.ar ? c.w - x - 12 : x)}" y="${y - 10}" width="12" height="12" fill="url(#${it.pat})" stroke="${AXIS}" stroke-width=".8"/>`;
      else m = c.rect(x, y - 10, 12, 12, it.color, { rx: 2 });
      return m + c.text(x + (it.kind === 'line' || it.kind === 'dash' ? 24 : 18), y, it.lab.s, { size: 11.5, fill: INK, title: it.lab.cut || it.title ? (it.title || it.label) : null });
    }).join('')).join('')
  };
}

// ---------- category axis labels (wrap → rotate → thin; the full text stays in the tooltip) ----------
function catLayout(labels, band, size = 11, maxLines = 3) {
  const cw = size * 0.56; const room = Math.floor((band - 8) / cw); const maxChars = Math.max(3, room);
  const wr = labels.map((l) => wrapText(l, maxChars, maxLines));
  if (room >= 3 && !wr.some((x) => x.cut)) return { mode: 'h', wr, size, height: Math.max(...wr.map((x) => x.lines.length)) * (size + 3) + 10, step: 1 };
  const cl = labels.map((l) => cutStr(l, 26)); const longest = Math.max(...cl.map((x) => x.s.length));
  return { mode: 'rot', cl, size, height: Math.min(120, longest * cw * 0.66 + 16), step: band >= 15 ? 1 : Math.ceil(15 / band) };
}
function catDraw(c, lay, labels, xs, y, above = false, pick = true) {
  let out = '';
  labels.forEach((full, i) => {
    if (i % lay.step) return; const x = xs[i];
    if (lay.mode === 'h') { const lines = lay.wr[i].lines; lines.forEach((ln, li) => { out += c.text(x, above ? y - (lines.length - li) * (lay.size + 3) + 2 : y + 13 + li * (lay.size + 3), ln, { size: lay.size, align: 'm', title: full, d: pick ? { k: 'label', i } : null }); }); }
    else out += above ? c.text(x, y - 4, lay.cl[i].s, { size: lay.size, align: 's', rot: -40, title: full, d: pick ? { k: 'label', i } : null }) : c.text(x, y + 12, lay.cl[i].s, { size: lay.size, align: 'e', rot: -40, title: full, d: pick ? { k: 'label', i } : null });
  });
  return out;
}

// ---------- shared column frame: bar · line · waterfall ----------
function colFrame(c, vals, items, n, labels) {
  const { cu, w } = c; const sc = niceScale(Math.min(...vals), Math.max(...vals));
  const tickStr = sc.ticks.map((t) => cu.tick(t)); const ms = Math.max(...tickStr.map((s) => s.length)) * 6.6 + 16; const me = 14;
  const pw = w - ms - me; const band = pw / Math.max(1, n); const cat = catLayout(labels, band);
  const leg = legendPlan(c, items, w - 28); const top = 38; const fixed = top + cat.height + leg.h + 10; const ph = c.height(fixed, 240);
  const H = fixed + ph; const yOf = (v) => top + ph - ((v - sc.lo) / sc.span) * ph; const xc = (i) => ms + i * band + band / 2;
  let grid = unitHead(c);
  sc.ticks.forEach((t, i) => { const y = yOf(t); grid += c.line(ms, y, ms + pw, y, t === 0 ? AXIS : GRID, { sw: t === 0 ? 1.4 : 1 }) + c.num(ms - 7, y + 4, tickStr[i], { size: 11, fill: MUTE, align: 'e' }); });
  return { sc, ms, pw, band, cat, leg, top, ph, H, yOf, xc, grid, y0: yOf(0), xs: labels.map((_, i) => xc(i)), axisY: top + ph, legY: top + ph + cat.height + 6 };
}
// point marker with a distinct SHAPE per series (circle · square · triangle · diamond) so colour is never the only carrier; a.op = fill opacity (0 → an invisible hover/drill target)
function marker(c, shape, x, y, r, fill, a = {}) {
  const X = f(c.ar ? c.w - x : x); const Y = f(y); const s = ((shape % 4) + 4) % 4;
  const at = ` fill="${fill}"${a.op != null ? ` fill-opacity="${a.op}"` : ''} stroke="${a.stroke || fill}" stroke-width="${a.sw || 1.8}"${c.dat(a)}`; const tt = a.title ? `<title>${esc(a.title)}</title>` : '';
  if (s === 0) return `<circle cx="${X}" cy="${Y}" r="${r}"${at}>${tt}</circle>`;
  const pts = s === 1 ? [[-0.9, -0.9], [0.9, -0.9], [0.9, 0.9], [-0.9, 0.9]] : s === 2 ? [[0, -1.2], [1.1, 0.85], [-1.1, 0.85]] : [[0, -1.25], [1.25, 0], [0, 1.25], [-1.25, 0]];
  return `<polygon points="${pts.map((p) => `${f(X + p[0] * r)},${f(Y + p[1] * r)}`).join(' ')}"${at}>${tt}</polygon>`;
}
const valueLabel = (c, x, y, v, a = {}) => c.b.showLabels === false ? '' : c.num(x, y, c.cu.tick(v), { size: a.size || 10.5, align: 'm', fill: a.fill || INK, weight: a.weight || 500 });

function colBars(c, kind) {
  const { b } = c; const labels = b.labels; const series = b.series; const n = labels.length; const ns = series.length;
  const vals = series.flatMap((s) => s.values).filter((v) => v != null && Number.isFinite(v)); if (!vals.length) return c.noData();
  const items = series.map((s, k) => ({ label: c.serLabel(s), color: colorOf(s, k), kind: kind === 'line' ? (s.dashed ? 'dash' : 'line') : 'rect', shape: kind === 'line' && b.markers === true ? k : null }));
  const fr = colFrame(c, vals, items, n, labels); let out = fr.grid;
  const showAll = ns * n <= 36 || kind === 'line';
  if (kind === 'bar') {
    const bw = Math.min(44, (fr.band * 0.8) / ns); const gw = bw * ns;
    labels.forEach((lab, i) => series.forEach((s, k) => {
      const v = s.values[i]; const x = fr.xc(i) - gw / 2 + k * bw; const mid = x + bw / 2; const col = colorOf(s, k);
      if (v == null || !Number.isFinite(v)) { out += c.text(mid, fr.y0 - 4, '—', { size: 10.5, align: 'm', fill: MUTE, title: c.tip(lab, c.serLabel(s), null) }); return; }
      if (v === 0) { out += c.num(mid, fr.y0 - 4, '0', { size: 10.5, align: 'm', fill: INK, title: c.tip(lab, c.serLabel(s), 0) }); return; }
      const y = fr.yOf(v);
      out += c.rect(x + 1, Math.min(y, fr.y0), Math.max(1, bw - 2), Math.max(1, Math.abs(fr.y0 - y)), col, { rx: 2, title: c.tip(lab, c.serLabel(s), v), d: { i, j: k } });
      const txt = c.cu.tick(v);
      if (showAll && tw(txt, 10.5) <= bw + 3) out += valueLabel(c, mid, v > 0 ? y - 4 : y + 12, v);
    }));
  } else {
    series.forEach((s, k) => {
      const col = colorOf(s, k); const pts = s.values.map((v, i) => (v == null || !Number.isFinite(v) ? null : [fr.xc(i), fr.yOf(v), v, i]));
      let seg = []; const segs = [seg]; pts.forEach((p) => { if (!p) { if (seg.length) { seg = []; segs.push(seg); } } else seg.push(p); });
      segs.forEach((sg) => { if (sg.length > 1) out += c.path(sg, col, { dash: s.dashed ? '7 5' : null }); });
      const lastIdx = pts.reduce((m, p, i) => (p ? i : m), -1); const labelAll = n <= 8 && ns <= 2;
      pts.forEach((p, i) => {
        if (!p) return;
        if (b.markers === true || b.markers === false) { // markers:true → one shape per series; markers:false → lines only (an isolated point keeps its mark; every point stays a hover / drill target); absent → the circles below, unchanged
          const alone = !pts[i - 1] && !pts[i + 1]; const shown = b.markers === true || alone;
          out += marker(c, b.markers === true ? k : 0, p[0], p[1], b.markers === true ? 4.2 : 3.8, shown ? (s.dashed ? '#fff' : col) : col, { stroke: shown ? col : 'none', op: shown ? null : 0, title: c.tip(labels[i], c.serLabel(s), p[2]), d: { i, j: k } });
        } else out += c.circle(p[0], p[1], 3.8, s.dashed ? '#fff' : col, { stroke: col, title: c.tip(labels[i], c.serLabel(s), p[2]) });
        if (labelAll || i === lastIdx) out += valueLabel(c, p[0], p[1] - 9, p[2], { fill: col === '#FDB022' ? '#8A5A00' : col, weight: 600 });
      });
    });
  }
  out += catDraw(c, fr.cat, labels, fr.xs, fr.axisY) + fr.leg.draw(fr.legY);
  return finish(c, fr.H, out);
}

// ---------- waterfall ----------
function waterfall(c) {
  const { b, ar, cu } = c; const labels = b.labels; const vals = b.series[0]?.values || []; const n = labels.length;
  const totals = Array.isArray(b.totals) ? b.totals : vals.map((_, i) => i === 0 || i === n - 1);
  if (!vals.some((v) => v != null && Number.isFinite(v))) return c.noData();
  let run = 0; let started = false; let bad = null; const bars = [];
  vals.forEach((v, i) => {
    if (v == null || !Number.isFinite(v)) { bars.push({ i, missing: true }); return; }
    if (totals[i]) { if (started && !bad && Math.abs(v - run) > Math.max(1, Math.abs(run) * 1e-9)) bad = { i, expected: run, actual: v }; bars.push({ i, total: true, from: 0, to: v, v }); run = v; } else { bars.push({ i, from: run, to: run + v, v, delta: true }); run += v; }
    started = true;
  });
  if (bad) { // the figures do not reconcile: say so instead of drawing a misleading chart
    const diff = bad.actual - bad.expected; const L = (a, e) => (ar ? a : e);
    const money = (v) => (ar ? `${iso(cu.tick(v))} ${c.info.unitText}` : cu.fmt(v)); const exact = `${diff < 0 ? MINUS : ''}${iso(Math.abs(diff).toLocaleString('en-US', { maximumFractionDigits: 2 }))} ${ar ? 'ريال' : 'SAR'}`;
    const lines = [L('تنبيه: الأرقام لا تتطابق — لم يُرسم المخطط', 'Warning: the figures do not reconcile — the chart is not drawn'),
      `${L('الإجمالي المعروض', 'Total shown')} — \u2068${labels[bad.i]}\u2069: ${money(bad.actual)}`, `${L('المتوقع (الإجمالي السابق + التغيرات)', 'Expected (previous total + changes)')}: ${money(bad.expected)}`, `${L('الفرق', 'Difference')}: ${exact}`];
    const body = `${c.rect(14, 14, c.w - 28, 112, '#FEF3F2', { stroke: DEC, sw: 1.6, rx: 6 })}${lines.map((ln, k) => c.text(c.w / 2, 40 + k * 24, ln, { size: k ? 12.5 : 14, weight: k ? 400 : 700, fill: k ? INK : DEC, align: 'm' })).join('')}`;
    return finish(c, 140, body, ' data-recon="fail"');
  }
  const kinds = [...(bars.some((x) => x.total) ? [{ label: ar ? 'إجمالي' : 'Total', color: TOTAL, kind: 'rect' }] : []), ...(bars.some((x) => x.delta && x.v < 0) ? [{ label: ar ? 'خصم / تخفيض' : 'Reduction', color: DEC, kind: 'rect' }] : []), ...(bars.some((x) => x.delta && x.v > 0) ? [{ label: ar ? 'زيادة' : 'Increase', color: INC, kind: 'rect' }] : [])];
  const levels = bars.flatMap((x) => (x.missing ? [] : [x.from, x.to]));
  const fr = colFrame(c, levels, kinds, n, labels); let out = fr.grid; const bw = Math.min(84, fr.band * 0.58);
  const signed = (v) => `\u2066${v > 0 ? `+${cu.tick(v)}` : v < 0 ? `${MINUS}${cu.tick(-v)}` : cu.tick(0)}\u2069`; // isolated left-to-right: the sign stays on the left of the number inside Arabic text
  bars.forEach((x, j) => {
    const cx = fr.xc(x.i); const lab = labels[x.i];
    if (x.missing) { out += c.text(cx, fr.y0 - 4, '—', { align: 'm', fill: MUTE, title: lab }); return; }
    const col = x.total ? TOTAL : x.v < 0 ? DEC : INC; const yA = fr.yOf(x.from); const yB = fr.yOf(x.to); const top = Math.min(yA, yB); const hgt = Math.abs(yA - yB);
    if (x.v === 0) out += c.line(cx - bw / 2, yB, cx + bw / 2, yB, col, { sw: 1.5 });
    else out += c.rect(cx - bw / 2, top, bw, Math.max(1, hgt), col, { rx: 2, d: { i: x.i }, title: `${lab}: ${x.delta ? (x.v < 0 ? MINUS : '+') + cu.fmt(Math.abs(x.v)) : cu.fmt(x.v)}` });
    const below = x.delta && x.v < 0; const txt = x.total ? cu.tick(x.v) : signed(x.v);
    out += c.num(cx, below ? top + hgt + 14 : top - 5, txt, { size: 12, align: 'm', weight: 700, fill: x.total ? INK : col });
    const nxt = bars[j + 1]; if (nxt && !nxt.missing) out += c.line(cx + bw / 2, yB, fr.xc(nxt.i) - bw / 2, yB, MUTE, { dash: '3 3' });
  });
  out += catDraw(c, fr.cat, labels, fr.xs, fr.axisY) + fr.leg.draw(fr.legY);
  return finish(c, fr.H, out, ' data-recon="ok"');
}

// ---------- horizontal bars ----------
function hbar(c) {
  const { b, cu, w } = c; const labels = b.labels; const series = b.series; const n = labels.length; const ns = series.length;
  const vals = series.flatMap((s) => s.values).filter((v) => v != null && Number.isFinite(v)); if (!vals.length) return c.noData();
  const sc = niceScale(Math.min(...vals), Math.max(...vals)); const tickStr = sc.ticks.map((t) => cu.tick(t));
  const labW = Math.min(Math.max(...labels.map((l) => Math.min(String(l).length, 34))) * 6.2 + 18, w * 0.38, 210); const ml = Math.max(70, labW); const mr = Math.max(46, tw(cu.tick(Math.max(...vals)), 10.5) + 14);
  const pw = w - ml - mr; const maxChars = Math.floor((ml - 14) / 6.2);
  const barH = ns > 1 ? 13 : 18; const rowH = Math.max(26, ns * (barH + 2) + 12); const items = series.map((s, k) => ({ label: c.serLabel(s), color: colorOf(s, k), kind: 'rect' }));
  const leg = ns > 1 ? legendPlan(c, items, w - 28) : { h: 0, draw: () => '' }; const top = 30; const fixed = top + 26 + leg.h + 6; const ph = c.height(fixed, n * rowH); const rh = ph / Math.max(1, n);
  const H = fixed + ph; const xOf = (v) => ml + ((v - sc.lo) / sc.span) * pw; const x0 = xOf(0); let out = unitHead(c);
  sc.ticks.forEach((t, i) => { const x = xOf(t); out += c.line(x, top, x, top + ph, t === 0 ? AXIS : GRID, { sw: t === 0 ? 1.4 : 1 }) + c.num(x, top + ph + 15, tickStr[i], { size: 11, fill: MUTE, align: 'm' }); });
  labels.forEach((lab, i) => {
    const wr = wrapText(lab, maxChars, 2); const cy = top + i * rh + rh / 2; const lh = 13; const y1 = cy - ((wr.lines.length - 1) * lh) / 2 + 4;
    wr.lines.forEach((ln, li) => { out += c.text(ml - 8, y1 + li * lh, ln, { size: 11.5, align: 'e', title: lab, d: { k: 'label', i } }); });
    const gh = ns * barH + (ns - 1) * 2; const yTop = cy - gh / 2;
    series.forEach((s, k) => {
      const v = s.values[i]; const y = yTop + k * (barH + 2); const col = colorOf(s, k);
      if (v == null || !Number.isFinite(v)) { out += c.text(x0 + 6, y + barH - 3, '—', { size: 11, fill: MUTE, title: c.tip(lab, c.serLabel(s), null) }); return; }
      if (v === 0) { out += c.num(x0 + 6, y + barH - 3, '0', { size: 10.5, title: c.tip(lab, c.serLabel(s), 0) }); return; }
      const xe = xOf(v); out += c.rect(Math.min(x0, xe), y, Math.max(1, Math.abs(xe - x0)), barH, col, { rx: 2, title: c.tip(lab, c.serLabel(s), v) + (b.tips && b.tips[i] ? ` · ${b.tips[i]}` : ''), d: { i, j: k } }); // optional block.tips[i]: extra hover text of a bar (e.g. share of the total · invoice count)
      const txt = cu.tick(v); const fits = xe + 6 + tw(txt, 10.5) <= w - 4;
      if (b.showLabels !== false) out += fits ? c.num(v > 0 ? xe + 5 : xe - 5, y + barH - 3, txt, { size: 10.5, align: v > 0 ? 's' : 'e', weight: 500 }) : c.num(xe - 5, y + barH - 3, txt, { size: 10.5, align: 'e', fill: onColor(col), weight: 600 });
    });
  });
  return finish(c, H, out + leg.draw(top + ph + 26 + 4));
}

// ---------- stacked horizontal bar (parts of a whole, with share %) ----------
function stacked(c) {
  const { b, cu, w } = c; const labels = b.labels; const series = b.series; const n = labels.length;
  const totals = labels.map((_, i) => series.reduce((t, s) => t + (Number.isFinite(s.values[i]) ? s.values[i] : 0), 0));
  if (!series.some((s) => s.values.some((v) => v != null && Number.isFinite(v)))) return c.noData();
  const sc = niceScale(0, Math.max(...totals)); const ml = n === 1 ? Math.min(150, Math.max(90, labels[0].length * 6.4 + 16)) : Math.min(180, w * 0.3); const mr = Math.max(56, tw(cu.tick(Math.max(...totals)), 12) + 16); const pw = w - ml - mr; const xOf = (v) => ml + (v / sc.span) * pw;
  const pct = (v, t) => (t > 0 ? `${((v / t) * 100).toFixed(1)}%` : '—');
  const items = series.map((s, k) => ({ label: n === 1 ? `${c.serLabel(s)} — ${cu.tick(s.values[0] ?? 0)} (${pct(s.values[0] ?? 0, totals[0])})` : c.serLabel(s), color: colorOf(s, k), kind: 'rect', title: c.serLabel(s) }));
  const leg = legendPlan(c, items, w - 28); const top = 30; const barH = 34; const rowH = 92; const fixed = top + 28 + leg.h + 6; const ph = n * rowH; const H = fixed + ph;
  let out = unitHead(c); const tickStr = sc.ticks.map((t) => cu.tick(t));
  sc.ticks.forEach((t, i) => { const x = xOf(t); out += c.line(x, top, x, top + ph, t === 0 ? AXIS : GRID, { sw: t === 0 ? 1.4 : 1 }) + c.num(x, top + ph + 15, tickStr[i], { size: 11, fill: MUTE, align: 'm' }); });
  labels.forEach((lab, r) => {
    const y = top + r * rowH + 36; const wr = wrapText(lab, Math.floor((ml - 14) / 6.2), 2);
    wr.lines.forEach((ln, li) => { out += c.text(ml - 8, y + barH / 2 + 4 + (li - (wr.lines.length - 1) / 2) * 13, ln, { size: 12, align: 'e', weight: 600, title: lab }); });
    let acc = 0; const taken = [[], [], []]; // outside labels above the bar, staggered so none overlap
    series.forEach((s, k) => {
      const v = s.values[r]; const col = colorOf(s, k); const name = c.serLabel(s);
      if (v == null || !Number.isFinite(v)) return; const x = xOf(acc); const wd = (v / sc.span) * pw; const txt = `${cu.tick(v)} · ${pct(v, totals[r])}`; acc += v;
      if (v > 0) out += c.rect(x, y, Math.max(1, wd), barH, col, { stroke: '#fff', sw: 1.5, d: { i: r, j: k }, title: `${lab} — ${name}: ${cu.fmt(v)} (${pct(v, totals[r])})` });
      const inside = v > 0 && wd >= tw(txt, 11.5) + 12;
      if (inside) { out += c.num(x + wd / 2, y + barH / 2 + 4, txt, { size: 11.5, align: 'm', fill: onColor(col), weight: 600 }); return; }
      const half = tw(txt, 11) / 2 + 4; const cx = Math.min(w - half - 6, Math.max(half + 6, x + wd / 2)); let lv = taken.findIndex((arr) => arr.every(([a, z]) => cx + half < a || cx - half > z)); if (lv < 0) lv = 2;
      taken[lv].push([cx - half, cx + half]); const ly = y - 8 - lv * 15;
      out += c.line(x + wd / 2, y + (v > 0 ? 2 : 0), cx, ly + 3, MUTE, { sw: 0.8 }) + c.num(cx, ly, txt, { size: 11, align: 'm', fill: INK, weight: 600 });
    });
    out += c.num(xOf(acc) + 8, y + barH / 2 + 4, cu.tick(totals[r]), { size: 12.5, align: 's', weight: 700 });
  });
  return finish(c, H, out + leg.draw(top + ph + 28 + 2));
}

// ---------- heat-map (rows = series, columns = labels; null = hatched «—») ----------
function heatmap(c) {
  const { b, cu, w, ar } = c; const labels = b.labels; const rows = b.series; const n = labels.length; const m = rows.length; const rate = c.info.rate;
  const vals = rows.flatMap((s) => s.values).filter((v) => v != null && Number.isFinite(v)); if (!vals.length || !n || !m) return c.noData();
  const mn = Math.min(...vals); const mx = Math.max(...vals); const pat = `hx${hash(`${b.title}|${n}|${m}`)}`;
  const ml = Math.min(0.3 * w, Math.max(76, Math.min(...[Math.max(...rows.map((s) => String(s.label).length)) * 6 + 18, 190]))); const mr = 12; const pw = w - ml - mr; const cw = pw / n;
  const cat = catLayout(labels, cw, 11, 3); const cellH = m > 14 ? 24 : 32; const top = 30 + cat.height + 6;
  const lw = Math.min(200, w - 28); const stackLeg = w < 520; const legH = stackLeg ? 62 : 36; const ph = m * cellH; const H = top + ph + 14 + legH;
  const colorFor = (v) => rampAt(mx === mn ? 1 : (v - mn) / (mx - mn)); const maxChars = Math.floor((ml - 12) / 6);
  let out = unitHead(c, 15) + `<defs><pattern id="${pat}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#F2F4F7"/><line x1="0" y1="0" x2="0" y2="6" stroke="#98A2B3" stroke-width="1.4"/></pattern><linearGradient id="${pat}g" x1="${ar ? 1 : 0}" y1="0" x2="${ar ? 0 : 1}" y2="0">${[0, 0.5, 1].map((t) => `<stop offset="${t}" stop-color="${rampAt(t)}"/>`).join('')}</linearGradient></defs>`;
  const xs = labels.map((_, j) => ml + j * cw + cw / 2);
  out += catDraw(c, cat, labels, xs, top - 6, true, false);
  rows.forEach((s, i) => {
    const y = top + i * cellH; const wr = wrapText(s.label, maxChars, 2); const lh = 12;
    wr.lines.forEach((ln, li) => { out += c.text(ml - 8, y + cellH / 2 + 4 + (li - (wr.lines.length - 1) / 2) * lh, ln, { size: 11, align: 'e', title: s.label, d: { k: 'label', i } }); });
    labels.forEach((lab, j) => {
      const v = s.values[j]; const x = ml + j * cw; const wd = Math.max(1, cw - 2); const hh = cellH - 2;
      if (v == null || !Number.isFinite(v)) { out += `<rect x="${f(c.ar ? w - x - wd : x)}" y="${f(y)}" width="${f(wd)}" height="${f(hh)}" fill="url(#${pat})"${c.dat({ d: { i, j, act: false } })}><title>${esc(`${s.label} × ${lab}: ${ar ? 'لا بيانات (ليست صفراً)' : 'no data (not zero)'}`)}</title></rect>` + c.text(x + wd / 2, y + hh / 2 + 4, '—', { size: 12, align: 'm', fill: MUTE }); return; }
      const col = colorFor(v); const txt = cu.tick(v);
      out += c.rect(x, y, wd, hh, col, { d: { i, j }, title: `${s.label} × ${lab}: ${rate ? txt : c.tip('', '', v).replace(/^: /, '')}` });
      if (tw(txt, 10.5) <= wd - 2) out += c.num(x + wd / 2, y + hh / 2 + 4, txt, { size: cw >= 56 ? 11 : 9.5, align: 'm', fill: onColor(col), weight: 600 });
    });
  });
  const ly = top + ph + 20; // legend: ramp with min / max, and the hatched «no data» swatch
  out += `<rect x="${f(c.ar ? w - 14 - lw : 14)}" y="${ly}" width="${lw}" height="10" fill="url(#${pat}g)" stroke="${AXIS}" stroke-width=".6"/>`;
  // gradient direction follows reading direction: low at the start side
  out += c.num(14, ly + 24, cu.tick(mn), { size: 11, align: 's', fill: MUTE }) + c.num(14 + lw, ly + 24, cu.tick(mx), { size: 11, align: 'e', fill: MUTE });
  const nx = stackLeg ? 14 : 14 + lw + 24; const ny = stackLeg ? ly + 40 : ly; out += `<rect x="${f(c.ar ? w - nx - 12 : nx)}" y="${ny - 1}" width="12" height="12" fill="url(#${pat})" stroke="${AXIS}" stroke-width=".8"/>` + c.text(nx + 18, ny + 9, ar ? 'لا بيانات — ليست صفراً' : 'No data — not zero', { size: 11.5 });
  return finish(c, H, out);
}

// ---------- pie ----------
function pie(c) {
  const { b, cu, w, ar, o } = c; const s = b.series[0]; if (!s) return c.noData();
  const all = s.values.map((v, i) => ({ v: Number.isFinite(v) ? Math.max(0, v) : 0, l: b.labels[i], miss: v == null })); const tot = all.reduce((t, p) => t + p.v, 0);
  const shown = all.slice(0, 14); const hidden = all.length - shown.length; const r = Math.min(150, Math.max(70, (w - 40) * 0.2)); const cx = 20 + r; const H = o.h || Math.max(2 * r + 70, shown.length * 24 + 70);
  const cy = 34 + r; let out = unitHead(c); const legendX = cx + r + 34;
  if (tot > 0) {
    let a0 = -Math.PI / 2; const pos = all.filter((p) => p.v > 0);
    pos.forEach((p) => {
      const idx = all.indexOf(p); const a1 = a0 + (p.v / tot) * Math.PI * 2; const col = PALETTE[idx % PALETTE.length]; const tip = `${p.l}: ${cu.fmt(p.v)} (${((p.v / tot) * 100).toFixed(1)}%)`;
      if (pos.length === 1) out += c.circle(cx, cy, r, col, { title: tip });
      else { const pt = (a) => `${f(c.ar ? w - (cx + r * Math.cos(a)) : cx + r * Math.cos(a))},${f(cy + r * Math.sin(a))}`; out += `<path d="M${f(ar ? w - cx : cx)},${f(cy)} L${pt(a0)} A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} ${ar ? 0 : 1} ${pt(a1)} Z" fill="${col}" stroke="#fff" stroke-width="1.5"${c.dat({ d: { i: idx }, title: tip })}><title>${esc(tip)}</title></path>`; }
      a0 = a1;
    });
  } else out += c.circle(cx, cy, r, '#F2F4F7', { stroke: AXIS }) + c.num(cx, cy + 4, '0', { size: 16, align: 'm', fill: MUTE });
  shown.forEach((p, i) => { const y = 44 + i * 24; out += c.rect(legendX, y - 10, 12, 12, PALETTE[i % PALETTE.length], { rx: 2 }) + c.text(legendX + 18, y, `${cutStr(p.l, 30).s} — ${iso(p.miss ? '—' : `${cu.tick(p.v)} (${tot > 0 ? ((p.v / tot) * 100).toFixed(1) : '0.0'}%)`)}`, { size: 12.5, title: p.l }); });
  if (hidden > 0) out += c.text(legendX + 18, 44 + shown.length * 24, ar ? `+ ${hidden} أخرى` : `+ ${hidden} more`, { size: 12, fill: MUTE });
  return finish(c, H, out);
}

const DRAW = { bar: (c) => colBars(c, 'bar'), line: (c) => colBars(c, 'line'), hbar, pie, waterfall, stacked_hbar: stacked, heatmap };

// ---- extension point for the chart library (docs/chart-library.md): other modules register more kinds without editing this file.
// A drawer is `(c) => finish(c, height, svgBody)` where `c` is the context from makeCtx. The primitives below are the SAME helpers the built-in kinds use.
export const DRAW_KINDS = () => Object.keys(DRAW);
export function registerDraw(kind, fn) { DRAW[kind] = fn; }
export const drawKit = { marker, legendPlan, catLayout, catDraw, makeCtx, finish, unitHead, colFrame, niceScale, wrapText, cutStr, esc, f, iso, tw, mix, rampAt, onColor, colorOf, hash, PALETTE, ROLE, INK, MUTE, GRID, AXIS, DEC, INC, TOTAL, MINUS, RAMP };

export function chartRender(b, { lang = 'ar', w = 900, h, font, responsive = false, interactive = false } = {}) {
  const c = makeCtx(b, { lang, w, h, font, responsive, interactive }); const kind = DRAW[b.kind] ? b.kind : 'bar';
  return (DRAW[kind] || DRAW.bar)(c);
}
export function chartSvg(b, opts = {}) { return chartRender(b, opts).svg; }

// SVG → PNG bytes (browser only; null where there is no canvas, e.g. in a test run — the Word file then carries the chart's data table alone)
export async function chartPng(b, { lang = 'ar', w = 900, h } = {}) {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null;
  try {
    const r = chartRender(b, { lang, w, h }); const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(r.svg)}`;
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const c = document.createElement('canvas'); c.width = r.w * 2; c.height = r.h * 2; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise((res) => c.toBlob(res, 'image/png')); if (!blob) return null;
    return { data: new Uint8Array(await blob.arrayBuffer()), w: r.w, h: r.h };
  } catch { return null; }
}
