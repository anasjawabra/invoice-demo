// Cartesian chart kinds — stacked / 100 % columns and bars, area, stacked area, combo (two value axes), pareto, histogram, box, scatter, bubble, bullet.
// Contract: docs/chart-library.md §2 and «Cartesian renderers». Registers drawers into chartDraw.js and the matching info / summary / table formats into reportFormat.js.
// Rules kept from chartDraw.js: zero baseline for bars · a missing value is a gap / «—», never zero · every axis names its OWN unit (an amount and a rate are never drawn on one axis) ·
// Arabic is mirrored as a whole (logical left-to-right coordinates, mirrored by the context helpers) · no clipped labels (wrapped, rotated or cut — full text in the tooltip) · exact SAR in tooltips ·
// data-i / data-j drill hooks (i = index into block.labels / groups / points, j = series) · role=img + one-sentence aria-label + <title>/<desc> (done by finish()).
import { registerDraw, drawKit } from './chartDraw';
import { registerChartFormat } from '../data/reportFormat';
import { chartUnit, unitLabel, fmtSar, fmtInt } from './money';

const { esc, f, tw, PALETTE, INK, MUTE, GRID, AXIS, DEC, TOTAL, colorOf, niceScale, wrapText, cutStr, finish, onColor, mix, legendPlan, catLayout, catDraw, marker } = drawKit;

const fin = (c, h, body, extra) => finish(c, Math.ceil(h), body, extra); // whole-pixel heights
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const Lx = (c) => (a, e) => (c.ar ? a : e);
const MAXROWS = 60; // horizontal charts draw at most this many rows; the rest is named («+N more») and stays in the data table
const pctS = (v) => `${(v * 100).toFixed(1)}%`;
const pctT = (v) => `${+(v * 100).toFixed(1)}%`;
const plainNum = (v) => (Number.isInteger(v) ? v.toLocaleString('en-US') : Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 }));
const sumKnown = (arr) => arr.reduce((t, v) => t + (isNum(v) ? v : 0), 0);
const NAMES = {
  stacked_col: ['مخطط أعمدة مكدّسة', 'Stacked column chart'], stacked100_col: ['مخطط أعمدة مكدّسة 100%', '100 % stacked column chart'], stacked100_hbar: ['مخطط أشرطة أفقية مكدّسة 100%', '100 % stacked bar chart'],
  area: ['مخطط مساحي', 'Area chart'], stacked_area: ['مخطط مساحي مكدّس', 'Stacked area chart'], combo: ['مخطط مركّب (أعمدة وخط بمحورين)', 'Combination chart (bars and line, two axes)'], pareto: ['مخطط باريتو', 'Pareto chart'],
  histogram: ['مدرّج تكراري', 'Histogram'], box: ['مخطط صندوقي', 'Box plot'], scatter: ['مخطط انتشار', 'Scatter chart'], bubble: ['مخطط فقاعات', 'Bubble chart'], bullet: ['مخطط رصاصي', 'Bullet chart']
};

// ---------- one value axis: the unit / format of ONE measure ----------
function axisSpec(kind, vals, lang, title) {
  const ar = lang === 'ar'; const t = (def) => title || def;
  if (kind === 'rate') { const ti = t(ar ? 'النسبة المئوية (%)' : 'Rate (%)'); return { kind, title: ti.includes('%') ? ti : `${ti} (%)`, unitText: '%', tick: pctT, fmt: pctS, unit: { key: 'pct', div: 1 } }; }
  if (kind === 'count') return { kind, title: t(ar ? 'العدد' : 'Count'), unitText: '', tick: plainNum, fmt: (v) => fmtInt(v), unit: { key: 'count', div: 1 }, plain: true };
  if (kind === 'days') return { kind, title: t(ar ? 'الأيام' : 'Days'), unitText: ar ? 'يوم' : 'days', tick: plainNum, fmt: (v) => `${plainNum(v)} ${ar ? 'يوم' : 'days'}`, unit: { key: 'days', div: 1 }, plain: true };
  const cu = chartUnit(vals.length ? vals : [0], lang);
  return { kind: 'amount', title: title ? `${title} — ${unitLabel(cu.unit, lang)}` : cu.title, unitText: unitLabel(cu.unit, lang), tick: cu.tick, fmt: cu.fmt, exact: (v) => fmtSar(v, lang), unit: cu.unit };
}
const toInfo = (sp) => ({ cu: { unit: sp.unit, title: sp.title, tick: sp.tick, fmt: sp.fmt }, unitText: sp.unitText, plain: !!sp.plain, rate: sp.kind === 'rate' });
const tipV = (sp, v) => { if (!isNum(v)) return '—'; const a = sp.fmt(v); const e = sp.exact ? sp.exact(v) : ''; return e && e !== a ? `${a} (${e})` : a; }; // value + exact SAR where it is an amount
const withBasis = (c, sp) => { const bs = c.b.basis === 'monthly' || c.b.basis === 'cumulative' ? c.b.basis : null; return bs && sp.kind !== 'rate' ? { ...sp, title: `${c.basisWord(bs)} — ${sp.title}` } : sp; };
const fixCount = (sc, sp) => { // a count axis shows whole numbers only
  if (sp.kind !== 'count' || sc.step >= 1) return sc;
  const hi = Math.max(1, Math.ceil(sc.hi)); const ticks = []; for (let v = Math.min(0, Math.floor(sc.lo)); v <= hi; v += 1) ticks.push(v);
  return { lo: ticks[0], hi, step: 1, ticks, span: hi - ticks[0] || 1 };
};
// scale that does NOT have to include zero (points / box plots — not bars)
function niceFree(min, max, n = 5) {
  if (!isNum(min) || !isNum(max)) { min = 0; max = 1; }
  if (min === max) { const d = Math.abs(min) * 0.1 || 1; min -= d; max += d; }
  const raw = (max - min) / n; const p = 10 ** Math.floor(Math.log10(raw)); const fr = raw / p; const step = (fr <= 1 ? 1 : fr <= 2 ? 2 : fr <= 2.5 ? 2.5 : fr <= 5 ? 5 : 10) * p;
  const lo = Math.floor(min / step + 1e-9) * step; const hi = Math.ceil(max / step - 1e-9) * step; const ticks = []; for (let v = lo; v <= hi + step * 1e-6; v += step) ticks.push(Number(v.toPrecision(12)));
  return { lo, hi, step, ticks, span: hi - lo || 1 };
}
const PCT_SCALE = { lo: 0, hi: 1, step: 0.2, ticks: [0, 0.2, 0.4, 0.6, 0.8, 1], span: 1 };
const rangeOf = (vals) => (vals.length ? [Math.min(...vals), Math.max(...vals)] : [0, 1]);

// ---------- small drawing helpers (logical left-to-right coordinates; the context mirrors for Arabic) ----------
const mx = (c, x) => (c.ar ? c.w - x : x);
const poly = (c, pts, fill, a = {}) => `<polygon points="${pts.map((p) => `${f(mx(c, p[0]))},${f(p[1])}`).join(' ')}" fill="${fill}"${a.op != null ? ` fill-opacity="${a.op}"` : ''}${a.stroke ? ` stroke="${a.stroke}" stroke-width="${a.sw || 1}"` : ''}${a.title ? `><title>${esc(a.title)}</title></polygon>` : '/>'}`;
const hit = (c, x, y, w, h, title) => `<rect x="${f(mx(c, x) - (c.ar ? w : 0))}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="#fff" fill-opacity="0"><title>${esc(title)}</title></rect>`; // an invisible tooltip target for what has no visible mark (a zero, a gap)
const segments = (arr) => { const out = []; let cur = []; arr.forEach((p) => { if (p) cur.push(p); else if (cur.length) { out.push(cur); cur = []; } }); if (cur.length) out.push(cur); return out; };
const head = (c, x, y, text, a = {}) => { const maxC = Math.max(8, Math.floor((a.maxW || c.w - 12) / 6.4)); const t = cutStr(text, maxC); return c.text(x, y, t.s, { size: 11.5, fill: MUTE, weight: 600, align: a.align, title: t.cut ? text : null }); };
function noteBlock(c, notes, size = 11) { // footer captions, wrapped, in their own band
  const maxChars = Math.max(12, Math.floor((c.w - 28) / (size * 0.56))); const lines = [];
  notes.filter(Boolean).forEach((n) => { const t = typeof n === 'string' ? { text: n } : n; const wr = wrapText(t.text, maxChars, 3); wr.lines.forEach((ln) => lines.push({ ln, fill: t.fill, full: wr.cut ? t.text : null, weight: t.weight })); });
  const lh = size + 4;
  return { h: lines.length ? lines.length * lh + 8 : 0, lines: lines.length, draw: (y0) => lines.map((l, k) => c.text(14, y0 + 4 + (k + 1) * lh - 4, l.ln, { size, fill: l.fill || MUTE, align: 's', weight: l.weight, title: l.full })).join('') };
}
function notice(c, title, lines) { // the chart is not drawn: say why
  const maxChars = Math.floor((c.w - 60) / 7); const all = lines.flatMap((l) => wrapText(l, maxChars, 3).lines); const h = 60 + all.length * 22;
  const body = `${c.rect(14, 14, c.w - 28, h - 24, '#FEF3F2', { stroke: DEC, sw: 1.6, rx: 6 })}${c.text(c.w / 2, 40, title, { size: 14, weight: 700, fill: DEC, align: 'm' })}${all.map((ln, k) => c.text(c.w / 2, 64 + k * 22, ln, { size: 12.5, align: 'm' })).join('')}`;
  return fin(c, h, body, ' data-state="invalid"');
}
const labelsOn = (c) => c.b.showLabels !== false;
const bsOf = (c) => (c.b.basis === 'monthly' || c.b.basis === 'cumulative' ? c.b.basis : null);

// ---------- vertical frame: category axis at the bottom, one or two value axes, legend band, caption band ----------
function frameV(c, o) {
  const { w } = c; const n = Math.max(1, o.n ?? o.labels.length); const { sc, ax } = o; const sc2 = o.sc2 || null; const ax2 = o.ax2 || null;
  const lenOf = (s, a) => Math.max(...s.ticks.map((t) => a.tick(t).length)) * 6.6 + 16;
  const ms = lenOf(sc, ax); const me = sc2 ? lenOf(sc2, ax2) : 14; const pw = Math.max(40, w - ms - me); const band = pw / n;
  let cat = o.cat || catLayout(o.labels, band);
  if (cat.mode === 'rot') { // a rotated first label must not run past the chart edge: cut it to the room it has
    const maxC = Math.max(6, Math.floor((ms + band / 2 - 4) / (cat.size * 0.56 * 0.77)));
    if (cat.cl.some((x) => x.s.length > maxC)) { const cl = o.labels.map((l) => cutStr(l, Math.min(26, maxC))); cat = { ...cat, cl, height: Math.min(120, Math.max(...cl.map((x) => x.s.length)) * cat.size * 0.56 * 0.66 + 16) }; }
  }
  const leg = o.items && o.items.length ? legendPlan(c, o.items, w - 28) : { h: 0, draw: () => '' };
  const two = !!sc2 && tw(ax.title, 11.5) + tw(ax2.title, 11.5) + 28 > w; const top = 22 + (two ? 32 : 16); const noteH = o.note ? o.note.h : 0;
  const ex = o.catExtra || 0; const fixed = top + cat.height + ex + leg.h + 10 + noteH; const ph = c.height(fixed, o.natH || 240); const H = fixed + ph;
  const yOf = (v) => top + ph - ((v - sc.lo) / sc.span) * ph; const yOf2 = sc2 ? (v) => top + ph - ((v - sc2.lo) / sc2.span) * ph : null; const xc = (i) => ms + i * band + band / 2;
  let grid = head(c, 6, 15, ax.title, { maxW: sc2 && !two ? w / 2 - 12 : w - 12, align: 's' });
  sc.ticks.forEach((t) => { const y = yOf(t); grid += c.line(ms, y, ms + pw, y, t === 0 ? AXIS : GRID, { sw: t === 0 ? 1.4 : 1 }) + c.num(ms - 7, y + 4, ax.tick(t), { size: 11, fill: MUTE, align: 'e' }); });
  if (sc2) {
    grid += head(c, w - 6, two ? 31 : 15, ax2.title, { maxW: two ? w - 12 : w / 2 - 12, align: 'e' });
    sc2.ticks.forEach((t) => { const y = yOf2(t); grid += c.line(ms + pw, y, ms + pw + 4, y, AXIS) + c.num(ms + pw + 7, y + 4, ax2.tick(t), { size: 11, fill: MUTE, align: 's' }); });
    grid += c.line(ms + pw, top, ms + pw, top + ph, AXIS);
  }
  const axisY = top + ph; const legY = axisY + cat.height + ex + 6;
  return { ms, me, pw, band, cat, leg, top, ph, H, yOf, yOf2, xc, xs: o.labels.map((_, i) => xc(i)), grid, axisY, legY, noteY: legY + leg.h + 2, y0: yOf(0) };
}
const closeV = (c, fr, out, labels, note) => fin(c, fr.H, out + catDraw(c, fr.cat, labels, fr.xs, fr.axisY) + fr.leg.draw(fr.legY) + (note ? note.draw(fr.noteY) : ''));

// ---------- horizontal frame: one row per label (label column at the start side), value axis below ----------
function frameH(c, o) {
  const { w } = c; const n = Math.max(1, o.n); const { sc, ax } = o; const ml = o.ml ?? Math.max(80, Math.min(190, w * 0.3)); const mr = o.mr ?? 18; const pw = Math.max(40, w - ml - mr);
  const leg = o.items && o.items.length ? legendPlan(c, o.items, w - 28) : { h: 0, draw: () => '' }; const top = 30; const noteH = o.note ? o.note.h : 0;
  const fixed = top + 28 + leg.h + noteH + 6; const ph = c.height(fixed, n * o.rowH); const rh = ph / n; const xOf = (v) => ml + ((v - sc.lo) / sc.span) * pw; const H = fixed + ph;
  let grid = head(c, 6, 15, ax.title, { align: 's' });
  sc.ticks.forEach((t) => { const x = xOf(t); grid += c.line(x, top, x, top + ph, t === 0 ? AXIS : GRID, { sw: t === 0 ? 1.4 : 1 }) + c.num(x, top + ph + 15, ax.tick(t), { size: 11, fill: MUTE, align: 'm' }); });
  const legY = top + ph + 30;
  return { ml, mr, pw, top, ph, rh, xOf, x0: xOf(Math.max(sc.lo, Math.min(0, sc.hi))), H, grid, leg, legY, noteY: legY + leg.h + 2 };
}
function rowLabel(c, fr, i, text, a = {}) {
  const wr = wrapText(text, Math.max(4, Math.floor((fr.ml - 14) / 6.2)), 2); const cy = fr.top + i * fr.rh + fr.rh / 2;
  return wr.lines.map((ln, li) => c.text(fr.ml - 8, cy + 4 + (li - (wr.lines.length - 1) / 2) * 13, ln, { size: a.size || 11.5, align: 'e', weight: a.weight, title: text, d: { k: 'label', i } })).join('');
}
const moreNote = (c, hidden) => (hidden > 0 ? (c.ar ? `+ ${hidden} أخرى (في جدول البيانات)` : `+ ${hidden} more (in the data table)`) : null);

// ======================================================================================================
// stacked columns · 100 % stacked columns · 100 % stacked bars
// ======================================================================================================
function stackVals(b) { const s = b.series || []; const vals = s.flatMap((x) => x.values || []).filter(isNum); (b.labels || []).forEach((_, i) => vals.push(sumKnown(s.map((x) => x.values?.[i])))); return vals; }
const stackSpec = (b, lang) => axisSpec(b.valueKind && b.valueKind !== 'rate' ? b.valueKind : 'amount', stackVals(b), lang, b.valueTitle);
function stackPlan(b, pct) {
  const series = b.series || []; let neg = false;
  const cats = (b.labels || []).map((label, i) => {
    const vals = series.map((s) => (isNum(s.values?.[i]) ? s.values[i] : null)); const known = vals.filter((v) => v != null); const total = known.reduce((t, v) => t + v, 0);
    const missing = vals.map((v, k) => (v == null ? k : -1)).filter((k) => k >= 0); const allPos = known.every((v) => v >= 0); if (!allPos) neg = true;
    const empty = known.length === 0 || (pct && total === 0); let posAcc = 0; let negAcc = 0;
    const segs = vals.map((v, k) => { if (v == null || empty) return null; const sv = pct ? v / total : v; let lo; let hi; if (sv >= 0) { lo = posAcc; posAcc += sv; hi = posAcc; } else { hi = negAcc; negAcc += sv; lo = negAcc; } return { k, v, sv, lo, hi, share: allPos && total > 0 ? v / total : null }; });
    return { i, label, vals, known, total, missing, allPos, empty, segs, posTop: posAcc, negBot: negAcc };
  });
  return { cats, neg };
}
const stackTip = (c, ax, cat, s, name) => `${cat.label} — ${name}: ${tipV(ax, s.v)}${s.share != null ? ` · ${pctS(s.share)}` : ''}${cat.missing.length ? ` · ${c.ar ? 'بيانات ناقصة' : 'incomplete data'}` : ''}`;
function stackInvalid(c) { const L = Lx(c); return notice(c, L('لا يمكن رسم مخطط 100% المكدّس', 'A 100 % stacked chart cannot be drawn'), [L('توجد قيم سالبة؛ حصة الجزء من الإجمالي تتطلب أجزاء غير سالبة.', 'Negative values exist; a share of the total needs nonnegative parts.')]); }

function stackCol(c, pct) {
  const { b, lang } = c; const L = Lx(c); const labels = b.labels || []; const series = b.series || []; const n = labels.length; const plan = stackPlan(b, pct);
  if (!n || !series.length || !plan.cats.some((x) => x.known.length)) return c.noData();
  if (pct && plan.neg) return stackInvalid(c);
  const ax = withBasis(c, stackSpec(b, lang)); const axV = pct ? axisSpec('rate', [], lang, L('حصة كل فئة من إجمالي الفئة (%)', 'Share of each category total (%)')) : ax;
  const sc = pct ? PCT_SCALE : niceScale(Math.min(0, ...plan.cats.map((x) => x.negBot)), Math.max(0, ...plan.cats.map((x) => x.posTop)));
  const items = series.map((s, k) => ({ label: c.serLabel(s), color: colorOf(s, k), kind: 'rect' }));
  const fr = frameV(c, { sc, ax: axV, labels, items }); let out = fr.grid; const bw = Math.max(2, Math.min(64, fr.band * 0.72));
  const segW = Math.max(0, ...plan.cats.flatMap((x) => x.segs.filter(Boolean).map((s) => tw(pct ? pctT(s.sv) : ax.tick(s.v), 10.5) * 1.15))); const segOk = segW <= bw - 4; // labels are all-or-nothing, so a chart never mixes labelled and unlabelled bars
  const totOk = plan.cats.every((x) => !x.known.length || tw(ax.tick(x.total), 11) * 1.1 <= fr.band + 2);
  plan.cats.forEach((cat) => {
    const cx = fr.xc(cat.i); const x = cx - bw / 2;
    if (!cat.known.length) { out += c.text(cx, fr.y0 - 4, '—', { size: 11, align: 'm', fill: MUTE, title: `${cat.label}: ${L('لا بيانات', 'no data')}` }); return; }
    if (cat.empty) { out += c.text(cx, fr.y0 - 4, '—', { size: 11, align: 'm', fill: MUTE, title: `${cat.label}: ${L('الإجمالي 0 — الحصة غير معرّفة (ليست 0%)', 'total is 0 — shares are not defined (not 0 %)')}` }); return; }
    if (cat.segs.some((s) => s && s.v === 0)) out += hit(c, x, fr.yOf(cat.posTop), bw, Math.max(4, fr.yOf(cat.negBot) - fr.yOf(cat.posTop)), `${cat.label}: ${cat.segs.map((s) => (s ? `${c.serLabel(series[s.k])} ${tipV(ax, s.v)}` : '')).filter(Boolean).join(' · ')}`);
    cat.segs.forEach((s) => {
      if (!s || s.v === 0) return; const yT = fr.yOf(s.hi); const yB = fr.yOf(s.lo); const hgt = Math.max(1, yB - yT); const col = colorOf(series[s.k], s.k);
      out += c.rect(x, yT, bw, hgt, col, { stroke: '#fff', sw: 1, title: stackTip(c, ax, cat, s, c.serLabel(series[s.k])), d: { i: cat.i, j: s.k } });
      const txt = pct ? pctT(s.sv) : ax.tick(s.v); if (labelsOn(c) && segOk && hgt >= 13) out += c.num(cx, yT + hgt / 2 + 4, txt, { size: 10.5, align: 'm', fill: onColor(col), weight: 600 });
    });
    if (!cat.known.some((v) => v !== 0) && !pct) out += c.num(cx, fr.y0 - 4, '0', { size: 10.5, align: 'm', title: `${cat.label}: 0` });
    if (cat.missing.length) out += c.text(cx, fr.yOf(cat.posTop) - 4, '—', { size: 11, align: 'm', fill: MUTE, title: `${cat.label}: ${L('بيانات ناقصة', 'incomplete data')} (${cat.missing.map((k) => c.serLabel(series[k])).join('، ')})` });
    else if (!pct && labelsOn(c) && totOk && cat.allPos && cat.total > 0) { const txt = ax.tick(cat.total); out += c.num(cx, fr.yOf(cat.posTop) - 5, txt, { size: 11, align: 'm', weight: 700, title: `${cat.label}: ${L('الإجمالي', 'Total')} ${tipV(ax, cat.total)}` }); }
  });
  return closeV(c, fr, out, labels);
}

function stackRow(c, pct) {
  const { b, lang } = c; const L = Lx(c); const labels = b.labels || []; const series = b.series || []; const plan = stackPlan(b, pct); const n = Math.min(labels.length, MAXROWS); const hidden = labels.length - n;
  if (!labels.length || !series.length || !plan.cats.some((x) => x.known.length)) return c.noData();
  if (pct && plan.neg) return stackInvalid(c);
  const ax = withBasis(c, stackSpec(b, lang)); const axV = pct ? axisSpec('rate', [], lang, L('حصة كل صف من إجمالي الصف (%)', 'Share of each row total (%)')) : ax;
  const sc = pct ? PCT_SCALE : niceScale(Math.min(0, ...plan.cats.map((x) => x.negBot)), Math.max(0, ...plan.cats.map((x) => x.posTop)));
  const items = series.map((s, k) => ({ label: c.serLabel(s), color: colorOf(s, k), kind: 'rect' })); const note = noteBlock(c, [moreNote(c, hidden)]);
  const mr = pct ? 18 : Math.max(50, tw(ax.tick(Math.max(...plan.cats.map((x) => x.posTop))), 12) + 18);
  const fr = frameH(c, { n, rowH: 30, sc, ax: axV, items, note, mr }); let out = fr.grid; const barH = Math.max(6, Math.min(24, fr.rh * 0.66));
  plan.cats.slice(0, n).forEach((cat) => {
    const cy = fr.top + cat.i * fr.rh + fr.rh / 2; const y = cy - barH / 2; out += rowLabel(c, fr, cat.i, cat.label);
    if (!cat.known.length) { out += c.text(fr.x0 + 6, cy + 4, '—', { size: 11, fill: MUTE, title: `${cat.label}: ${L('لا بيانات', 'no data')}` }); return; }
    if (cat.empty) { out += c.text(fr.x0 + 6, cy + 4, '—', { size: 11, fill: MUTE, title: `${cat.label}: ${L('الإجمالي 0 — الحصة غير معرّفة (ليست 0%)', 'total is 0 — shares are not defined (not 0 %)')}` }); return; }
    if (cat.segs.some((s) => s && s.v === 0)) out += hit(c, fr.xOf(cat.negBot), y, Math.max(4, fr.xOf(cat.posTop) - fr.xOf(cat.negBot)), barH, `${cat.label}: ${cat.segs.map((s) => (s ? `${c.serLabel(series[s.k])} ${tipV(ax, s.v)}` : '')).filter(Boolean).join(' · ')}`);
    cat.segs.forEach((s) => {
      if (!s || s.v === 0) return; const xa = fr.xOf(s.lo); const xb = fr.xOf(s.hi); const wd = Math.max(1, xb - xa); const col = colorOf(series[s.k], s.k);
      out += c.rect(xa, y, wd, barH, col, { stroke: '#fff', sw: 1, title: stackTip(c, ax, cat, s, c.serLabel(series[s.k])), d: { i: cat.i, j: s.k } });
      const txt = pct ? pctT(s.sv) : ax.tick(s.v); if (labelsOn(c) && barH >= 12 && tw(txt, 10.5) * 1.15 <= wd - 4) out += c.num(xa + wd / 2, cy + 4, txt, { size: 10.5, align: 'm', fill: onColor(col), weight: 600 });
    });
    if (!cat.known.some((v) => v !== 0) && !pct) out += c.num(fr.x0 + 6, cy + 4, '0', { size: 10.5, title: `${cat.label}: 0` });
    if (cat.missing.length) out += c.text(fr.xOf(cat.posTop) + 6, cy + 4, '—', { size: 11, fill: MUTE, title: `${cat.label}: ${L('بيانات ناقصة', 'incomplete data')} (${cat.missing.map((k) => c.serLabel(series[k])).join('، ')})` });
    else if (!pct && labelsOn(c) && cat.allPos && cat.total > 0) out += c.num(fr.xOf(cat.posTop) + 6, cy + 4, ax.tick(cat.total), { size: 11, align: 's', weight: 700, title: `${cat.label}: ${L('الإجمالي', 'Total')} ${tipV(ax, cat.total)}` });
  });
  return fin(c, fr.H, out + fr.leg.draw(fr.legY) + note.draw(fr.noteY));
}
const stackOrient = (c, dflt) => (c.b.orientation === 'h' ? true : c.b.orientation === 'v' ? false : dflt);
registerDraw('stacked_col', (c) => (stackOrient(c, false) ? stackRow(c, false) : stackCol(c, false)));
registerDraw('stacked100_col', (c) => (stackOrient(c, false) ? stackRow(c, true) : stackCol(c, true)));
registerDraw('stacked100_hbar', (c) => (stackOrient(c, true) ? stackRow(c, true) : stackCol(c, true)));

// ======================================================================================================
// area · stacked area
// ======================================================================================================
const areaSpec = (b, lang, stacked) => axisSpec(b.valueKind || 'amount', stacked ? stackVals(b) : (b.series || []).flatMap((s) => s.values || []).filter(isNum), lang, b.valueTitle);
function areaChart(c, stacked) {
  const { b, lang } = c; const L = Lx(c); const labels = b.labels || []; const series = b.series || []; const n = labels.length;
  if (!n || !series.some((s) => (s.values || []).some(isNum))) return c.noData();
  if (stacked && series.some((s) => (s.values || []).some((v) => isNum(v) && v < 0))) return notice(c, L('لا يمكن رسم مخطط مساحي مكدّس', 'A stacked area chart cannot be drawn'), [L('توجد قيم سالبة؛ المساحة المكدّسة تتطلب أجزاء غير سالبة تجمع إلى كل واحد.', 'Negative values exist; stacked areas need nonnegative parts of one whole.')]);
  const ax = withBasis(c, areaSpec(b, lang, stacked));
  const valid = labels.map((_, i) => series.every((s) => isNum(s.values?.[i]))); // stacked: an index with any missing part breaks the whole stack (its total would be understated)
  const layers = []; let acc = labels.map(() => 0);
  series.forEach((s, k) => {
    const lo = []; const hi = [];
    labels.forEach((_, i) => { const v = s.values?.[i]; const ok = isNum(v) && (!stacked || valid[i]); if (!ok) { lo.push(null); hi.push(null); return; } if (stacked) { lo.push(acc[i]); hi.push(acc[i] + v); } else { lo.push(Math.min(0, v)); hi.push(Math.max(0, v)); } });
    if (stacked) acc = acc.map((a, i) => (isNum(hi[i]) ? hi[i] : a));
    layers.push({ k, s, lo, hi });
  });
  const allB = layers.flatMap((l) => [...l.lo, ...l.hi]).filter(isNum); const sc = fixCount(niceScale(Math.min(...allB), Math.max(...allB)), ax);
  const items = series.map((s, k) => ({ label: c.serLabel(s), color: colorOf(s, k), kind: 'rect' }));
  const fr = frameV(c, { sc, ax, labels, items }); let out = fr.grid; const half = Math.min(14, fr.band * 0.4);
  layers.forEach((l) => {
    const col = colorOf(l.s, l.k); const name = c.serLabel(l.s); const val = (i) => (stacked ? l.hi[i] - l.lo[i] : l.s.values[i]);
    const up = l.hi.map((v, i) => (isNum(v) ? { i, x: fr.xc(i), yu: stacked ? fr.yOf(v) : fr.yOf(l.s.values[i]), yl: stacked ? fr.yOf(l.lo[i]) : fr.yOf(0) } : null));
    segments(up).forEach((sg) => {
      if (sg.length > 1) {
        out += poly(c, [...sg.map((p) => [p.x, p.yu]), ...[...sg].reverse().map((p) => [p.x, p.yl])], col, { op: stacked ? 0.88 : 0.22, stroke: stacked ? '#fff' : null, sw: 1 });
        if (!stacked) out += c.path(sg.map((p) => [p.x, p.yu]), col);
      } else { const p = sg[0]; out += c.rect(p.x - half, Math.min(p.yu, p.yl), half * 2, Math.max(1, Math.abs(p.yl - p.yu)), col, { op: stacked ? 0.88 : 0.3, stroke: col, sw: 1 }); }
    });
    up.forEach((p) => {
      if (!p) return; const v = val(p.i); const share = stacked ? sumKnown(series.map((s) => s.values[p.i])) : 0;
      const tip = `${labels[p.i]} — ${name}: ${tipV(ax, v)}${stacked && share > 0 ? ` · ${pctS(v / share)}` : ''}`;
      out += marker(c, b.markers === true ? l.k : 0, p.x, p.yu, 3.6, b.markers === true ? col : col, { stroke: b.markers === true ? '#fff' : 'none', sw: 1, op: b.markers === true ? null : 0, title: tip, d: { i: p.i, j: l.k } });
    });
    if (!stacked && labelsOn(c)) { const lastI = up.reduce((m, p, i) => (p ? i : m), -1); const lastP = up[lastI]; if (lastP) out += c.num(lastP.x, lastP.yu - 9, ax.tick(val(lastI)), { size: 10.5, align: 'm', fill: col === '#FDB022' ? '#8A5A00' : col, weight: 600 }); }
  });
  if (!stacked) layers.forEach((l) => labels.forEach((lab, i) => { if (!isNum(l.s.values?.[i]) && series.some((s) => isNum(s.values?.[i]))) { const col = colorOf(l.s, l.k); const x = fr.xc(i); out += c.line(x - 6, fr.y0 - 3, x + 6, fr.y0 - 3, col, { sw: 2, dash: '3 2' }) + hit(c, x - 8, fr.y0 - 10, 16, 14, `${lab} — ${c.serLabel(l.s)}: — (${L('لا بيانات — ليست صفراً', 'no data — not zero')})`); } })); // a gap in one series is marked at the baseline (a dashed tick in its colour)
  labels.forEach((lab, i) => { if (stacked ? !valid[i] : !series.some((s) => isNum(s.values?.[i]))) out += c.text(fr.xc(i), fr.y0 - 4, '—', { size: 11, align: 'm', fill: MUTE, title: `${lab}: ${L('بيانات ناقصة (ليست صفراً)', 'missing data (not zero)')}` }); });
  if (stacked && labelsOn(c)) { const li = valid.lastIndexOf(true); if (li >= 0) out += c.num(fr.xc(li), fr.yOf(acc[li]) - 6, ax.tick(acc[li]), { size: 11, align: 'm', weight: 700, title: `${labels[li]}: ${L('الإجمالي', 'Total')} ${tipV(ax, acc[li])}` }); }
  return closeV(c, fr, out, labels);
}
registerDraw('area', (c) => areaChart(c, false));
registerDraw('stacked_area', (c) => areaChart(c, true));

// ======================================================================================================
// combo: bars + lines on two value axes
// ======================================================================================================
function comboPlan(b, lang) {
  const series = b.series || []; let pri = series.filter((s) => s.axis !== 'secondary'); let sec = series.filter((s) => s.axis === 'secondary'); const a2 = b.axis2 || {};
  let k1 = b.valueKind || 'amount'; let t1 = b.valueTitle; const k2 = a2.kind || 'rate'; const t2 = a2.title; let kk2 = k2; let tt2 = t2;
  if (!pri.length && sec.length) { pri = sec; sec = []; k1 = k2; t1 = t2; kk2 = null; }
  const vals = (arr) => arr.flatMap((s) => s.values || []).filter(isNum);
  return { pri, sec, ax1: axisSpec(k1, vals(pri), lang, t1), ax2: sec.length ? axisSpec(kk2, vals(sec), lang, tt2) : null };
}
function comboChart(c) {
  const { b, lang } = c; const L = Lx(c); const labels = b.labels || []; const series = b.series || []; const n = labels.length; const { pri, sec, ax1: a1, ax2: a2 } = comboPlan(b, lang);
  if (!n || !series.some((s) => (s.values || []).some(isNum))) return c.noData();
  const ax1 = withBasis(c, a1); const axisOf = (s) => (sec.includes(s) ? 2 : 1); const spec = (s) => (axisOf(s) === 2 ? a2 : ax1);
  const range = (arr) => { const v = arr.flatMap((s) => s.values || []).filter(isNum); return v.length ? [Math.min(...v), Math.max(...v)] : [0, 1]; };
  const sc1 = fixCount(niceScale(...range(pri)), ax1); const sc2 = a2 ? fixCount(niceScale(...range(sec)), a2) : null;
  const isLine = (s) => s.type === 'line'; const bars = series.filter((s) => !isLine(s)); const lines = series.filter(isLine); const nb = bars.length;
  const axisWord = (s) => (!a2 ? '' : axisOf(s) === 1 ? ` · ${L('المحور الأيمن', 'left axis')}` : ` · ${L('المحور الأيسر', 'right axis')}`);
  const items = series.map((s, k) => ({ label: `${c.serLabel(s)} · ${isLine(s) ? L('خط', 'line') : L('أعمدة', 'bars')}${axisWord(s)}`, color: colorOf(s, k), kind: isLine(s) ? 'line' : 'rect', shape: isLine(s) ? lines.indexOf(s) : null }));
  const fr = frameV(c, { sc: sc1, ax: ax1, sc2, ax2: a2, labels, items }); let out = fr.grid; const yv = (s) => (axisOf(s) === 2 ? fr.yOf2 : fr.yOf);
  const bw = nb ? Math.max(2, Math.min(40, (fr.band * 0.8) / nb)) : 0; const showAll = nb * n <= 36;
  bars.forEach((s, bi) => {
    const k = series.indexOf(s); const col = colorOf(s, k); const sp = spec(s); const y0 = yv(s)(0);
    labels.forEach((lab, i) => {
      const v = s.values?.[i]; const x = fr.xc(i) - (nb * bw) / 2 + bi * bw; const mid = x + bw / 2; const tipHead = `${lab} — ${c.serLabel(s)}`;
      if (!isNum(v)) { out += c.text(mid, y0 - 4, '—', { size: 10.5, align: 'm', fill: MUTE, title: `${tipHead}: —` }); return; }
      if (v === 0) { out += c.num(mid, y0 - 4, '0', { size: 10.5, align: 'm', title: `${tipHead}: ${tipV(sp, 0)}` }); return; }
      const y = yv(s)(v); out += c.rect(x + 1, Math.min(y, y0), Math.max(1, bw - 2), Math.max(1, Math.abs(y0 - y)), col, { rx: 2, title: `${tipHead}: ${tipV(sp, v)}`, d: { i, j: k } });
      const txt = sp.tick(v); if (labelsOn(c) && showAll && tw(txt, 10.5) <= bw + 3) out += c.num(mid, v > 0 ? y - 4 : y + 12, txt, { size: 10.5, align: 'm', weight: 500 });
    });
  });
  lines.forEach((s, li) => {
    const k = series.indexOf(s); const col = colorOf(s, k); const sp = spec(s); const Y = yv(s);
    const pts = (s.values || []).map((v, i) => (isNum(v) ? [fr.xc(i), Y(v), v, i] : null));
    segments(pts).forEach((sg) => { if (sg.length > 1) out += c.path(sg, col, { dash: s.dashed ? '7 5' : null }); });
    const lastI = pts.reduce((m, p, i) => (p ? i : m), -1);
    pts.forEach((p, i) => {
      if (!p) { out += c.text(fr.xc(i), fr.y0 - 4, '—', { size: 10.5, align: 'm', fill: MUTE, title: `${labels[i]} — ${c.serLabel(s)}: —` }); return; }
      out += marker(c, li, p[0], p[1], 4.2, s.dashed ? '#fff' : col, { stroke: col, title: `${labels[i]} — ${c.serLabel(s)}: ${tipV(sp, p[2])}`, d: { i, j: k } });
      if (labelsOn(c) && i === lastI) out += c.num(p[0], p[1] - 10, sp.tick(p[2]), { size: 10.5, align: 'm', fill: col === '#FDB022' ? '#8A5A00' : col, weight: 600 });
    });
  });
  return closeV(c, fr, out, labels);
}
registerDraw('combo', comboChart);

// ======================================================================================================
// pareto
// ======================================================================================================
function paretoPlan(b) {
  const s = (b.series || [])[0] || { values: [] }; const labels = b.labels || [];
  const items = labels.map((l, i) => ({ l, i, v: isNum(s.values?.[i]) ? s.values[i] : null }));
  const other = b.otherLabel != null && b.otherLabel !== '' ? items.find((x) => x.l === b.otherLabel) || null : null;
  const main = items.filter((x) => x !== other && x.v != null).sort((a, z) => z.v - a.v || a.i - z.i); const missing = items.filter((x) => x !== other && x.v == null);
  const order = [...main, ...missing, ...(other ? [other] : [])]; const total = sumKnown(order.map((x) => x.v)); let run = 0;
  order.forEach((x) => { if (x.v == null) { x.cum = null; x.share = null; return; } run += x.v; x.share = total > 0 ? x.v / total : null; x.cum = total > 0 ? Math.min(1, run / total) : null; });
  const reach = order.findIndex((x) => x.cum != null && x.cum >= 0.8 - 1e-9);
  return { order, total, neg: items.some((x) => x.v != null && x.v < 0), other, reach, mainCount: main.length };
}
function paretoChart(c) {
  const { b, lang } = c; const L = Lx(c); const s = (b.series || [])[0]; const plan = paretoPlan(b); const n = plan.order.length;
  if (!s || !n || !plan.order.some((x) => x.v != null)) return c.noData();
  if (plan.neg) return notice(c, L('لا يمكن رسم مخطط باريتو', 'A Pareto chart cannot be drawn'), [L('توجد قيم سالبة؛ باريتو يتطلب قيماً غير سالبة.', 'Negative values exist; a Pareto chart needs nonnegative values.')]);
  const ax = withBasis(c, axisSpec(b.valueKind || 'amount', plan.order.map((x) => x.v).filter(isNum), lang, b.valueTitle)); const ax2 = axisSpec('rate', [], lang, L('النسبة التراكمية من الإجمالي (%)', 'Cumulative share of total (%)'));
  const sc = fixCount(niceScale(0, Math.max(...plan.order.map((x) => x.v ?? 0))), ax); const col = colorOf(s, 0); const lcol = PALETTE[4];
  const items = [{ label: c.serLabel(s), color: col, kind: 'rect' }, { label: `${ax2.title}`, color: lcol, kind: 'line', shape: 0 }];
  const reachTxt = plan.total > 0 && plan.reach >= 0 ? (plan.other && plan.order[plan.reach] === plan.other ? L(`لا يُبلغ 80% إلا بإضافة مجموعة «${plan.other.l}»`, `80 % is reached only with the «${plan.other.l}» group`) : L(`${plan.reach + 1} من ${plan.mainCount} بنداً تبلغ 80% من الإجمالي`, `${plan.reach + 1} of ${plan.mainCount} items reach 80 % of the total`)) : null;
  const note = noteBlock(c, [reachTxt, plan.total === 0 ? L('الإجمالي 0 — لا تُحسب الحصص التراكمية.', 'The total is 0 — cumulative shares are not defined.') : null, plan.order.some((x) => x.v == null) ? L('البنود ذات «—» بلا بيانات وهي خارج حساب الإجمالي.', 'Items marked «—» have no data and are outside the total.') : null]);
  const labels = plan.order.map((x) => x.l); const fr = frameV(c, { sc, ax, sc2: PCT_SCALE, ax2, labels, items, note }); let out = fr.grid; const bw = Math.max(2, Math.min(52, fr.band * 0.72));
  const y80 = fr.yOf2(0.8); out += c.line(fr.ms, y80, fr.ms + fr.pw, y80, MUTE, { dash: '6 4', sw: 1.2 }) + c.num(fr.ms + fr.pw - 4, y80 - 4, '80%', { size: 10.5, align: 'e', fill: MUTE, weight: 600 });
  plan.order.forEach((x, pos) => {
    const cx = fr.xc(pos); const tipHead = `${x.l}`;
    if (x.v == null) { out += c.text(cx, fr.y0 - 4, '—', { size: 10.5, align: 'm', fill: MUTE, title: `${tipHead}: —` }); return; }
    const tip = `${tipHead}: ${tipV(ax, x.v)}${x.share != null ? ` · ${pctS(x.share)} · ${L('تراكمي', 'cumulative')} ${pctS(x.cum)}` : ''}`;
    if (x.v === 0) out += c.num(cx, fr.y0 - 4, '0', { size: 10.5, align: 'm', title: tip });
    else { const y = fr.yOf(x.v); out += c.rect(cx - bw / 2, Math.min(y, fr.y0), bw, Math.max(1, Math.abs(fr.y0 - y)), x === plan.other ? mix(col, '#FFFFFF', 0.55) : col, { rx: 2, title: tip, d: { i: x.i, j: 0 }, stroke: x === plan.other ? col : null, sw: 1, dash: x === plan.other ? '4 2' : null }); if (labelsOn(c) && n <= 20 && tw(ax.tick(x.v), 10.5) <= bw + 6) out += c.num(cx, y - 4, ax.tick(x.v), { size: 10.5, align: 'm', weight: 500 }); }
  });
  const pts = plan.order.map((x, pos) => (x.cum != null ? [fr.xc(pos), fr.yOf2(x.cum), x, pos] : null));
  segments(pts).forEach((sg) => { if (sg.length > 1) out += c.path(sg, lcol); });
  pts.forEach((p) => { if (!p) return; out += marker(c, 0, p[0], p[1], 3.8, lcol, { stroke: '#fff', sw: 1.2, title: `${p[2].l}: ${L('تراكمي', 'cumulative')} ${pctS(p[2].cum)}`, d: { i: p[2].i, j: 1 } }); if (labelsOn(c) && p[3] === plan.reach) out += c.num(p[0], p[1] - 9, pctT(p[2].cum), { size: 10.5, align: 'm', fill: lcol, weight: 600 }); });
  return closeV(c, fr, out, labels, note); // category labels follow the SORTED order
}
registerDraw('pareto', paretoChart);

// ======================================================================================================
// histogram
// ======================================================================================================
function histPlan(b, lang) {
  const bins = (b.bins || []).map((x, i) => ({ i, lo: isNum(x.lo) ? x.lo : null, hi: isNum(x.hi) ? x.hi : null, count: isNum(x.count) ? x.count : null, amount: isNum(x.amount) ? x.amount : null }));
  const yKind = b.valueKind === 'amount' && bins.some((x) => x.amount != null) ? 'amount' : 'count'; const xKind = b.binUnit === 'days' ? 'days' : 'amount';
  const edges = bins.flatMap((x) => [x.lo, x.hi]).filter(isNum); const ys = bins.map((x) => (yKind === 'amount' ? x.amount : x.count)); const ay = axisSpec(yKind, ys.filter(isNum), lang, b.valueTitle);
  const axx = axisSpec(xKind, edges, lang, b.xTitle); const finite = bins.every((x) => x.lo != null && x.hi != null); const contiguous = finite && bins.every((x, i) => i === 0 || Math.abs(x.lo - bins[i - 1].hi) <= 1e-9 * Math.max(1, Math.abs(x.lo)));
  const widths = bins.filter((x) => x.lo != null && x.hi != null).map((x) => x.hi - x.lo); const equal = !widths.length || Math.max(...widths) - Math.min(...widths) <= 0.01 * Math.max(...widths, 1e-12);
  return { bins, yKind, xKind, ys, ay, axx, contiguous, equal };
}
const binRange = (c, p, x, exact) => { const sp = p.axx; const t = exact ? (v) => (sp.exact ? sp.exact(v) : sp.fmt(v)) : sp.tick; const ar = c.ar; if (x.lo != null && x.hi != null) return `${t(x.lo)} – ${t(x.hi)}`; if (x.lo != null) return `≥ ${t(x.lo)}`; if (x.hi != null) return `< ${t(x.hi)}`; return ar ? 'غير محدد' : 'unspecified'; };
function histChart(c) {
  const { b, lang } = c; const L = Lx(c); const p = histPlan(b, lang); const n = p.bins.length;
  if (!n || !p.ys.some(isNum)) return c.noData();
  const scY = fixCount(niceScale(0, Math.max(...p.ys.filter(isNum))), p.ay);
  const note = noteBlock(c, [!p.equal ? L('عرض الفئات غير متساوٍ: ارتفاع العمود = قيمة الفئة نفسها لا الكثافة.', 'Bins have unequal widths: bar height is the value of the bin itself, not a density.') : null]);
  const fr = frameV(c, { sc: scY, ax: p.ay, n, labels: p.bins.map((x) => binRange(c, p, x, false)), cat: p.contiguous ? { height: 20, mode: 'edge' } : null, catExtra: 20, items: [], note }); let out = fr.grid;
  p.bins.forEach((x, i) => {
    const v = p.ys[i]; const x0 = fr.ms + i * fr.band; const range = binRange(c, p, x, true); const tipHead = `${range}`;
    const extra = p.yKind === 'amount' && x.count != null ? ` · ${L('العدد', 'count')}: ${fmtInt(x.count)}` : '';
    if (v == null) { out += c.text(x0 + fr.band / 2, fr.y0 - 4, '—', { size: 10.5, align: 'm', fill: MUTE, title: `${tipHead}: —` }); return; }
    if (v === 0) { out += hit(c, x0, fr.top, fr.band, fr.ph, `${tipHead}: ${tipV(p.ay, 0)}${extra}`); if (labelsOn(c) && n <= 30) out += c.num(x0 + fr.band / 2, fr.y0 - 4, '0', { size: 10.5, align: 'm' }); return; } // an empty bin stays on the axis, labelled 0
    const y = fr.yOf(v); out += c.rect(x0, Math.min(y, fr.y0), fr.band, Math.max(1, Math.abs(fr.y0 - y)), PALETTE[0], { stroke: '#fff', sw: 0.8, title: `${tipHead}: ${tipV(p.ay, v)}${extra}`, d: { i, j: 0 } });
    const txt = p.ay.tick(v); if (labelsOn(c) && n <= 30 && tw(txt, 10.5) <= fr.band + 2) out += c.num(x0 + fr.band / 2, v > 0 ? y - 4 : y + 12, txt, { size: 10.5, align: 'm', weight: 500 });
  });
  const ay = fr.axisY; let xAxis = '';
  if (p.contiguous) {
    const edges = [p.bins[0].lo, ...p.bins.map((x) => x.hi)]; const strs = edges.map((e) => p.axx.tick(e)); const wmax = Math.max(...strs.map((s) => tw(s, 11))) + 10; const step = Math.max(1, Math.ceil(wmax / fr.band));
    edges.forEach((e, k) => { if (k % step === 0) xAxis += c.line(fr.ms + k * fr.band, ay, fr.ms + k * fr.band, ay + 4, AXIS) + c.num(fr.ms + k * fr.band, ay + 16, strs[k], { size: 11, fill: MUTE, align: 'm' }); });
  } else xAxis += catDraw(c, fr.cat, p.bins.map((x) => binRange(c, p, x, false)), p.bins.map((_, i) => fr.ms + i * fr.band + fr.band / 2), ay);
  const xt = p.axx.title; const xTitleY = ay + fr.cat.height + 14;
  const xTitleSvg = c.text(fr.ms + fr.pw / 2, xTitleY, cutStr(xt, Math.floor(fr.pw / 6.4)).s, { size: 11.5, fill: MUTE, weight: 600, align: 'm', title: xt });
  return fin(c, fr.H, out + xAxis + xTitleSvg + fr.leg.draw(fr.legY) + note.draw(fr.noteY));
}
registerDraw('histogram', histChart);

// ======================================================================================================
// box plot
// ======================================================================================================
function boxPlan(b, lang) {
  const groups = (b.groups || []).map((g, i) => ({ i, g, label: g.label ?? '', n: isNum(g.n) ? g.n : 0 }));
  groups.forEach((x) => { const g = x.g; const st = [g.min, g.q1, g.median, g.q3, g.max]; const finite = st.every(isNum); const ordered = finite && g.min <= g.q1 && g.q1 <= g.median && g.median <= g.q3 && g.q3 <= g.max; x.out = Array.isArray(g.outliers) ? g.outliers.filter(isNum) : []; x.status = x.n < 5 ? 'few' : !ordered ? 'bad' : 'ok'; });
  const drawn = groups.filter((x) => x.status === 'ok'); const vals = drawn.flatMap((x) => [x.g.min, x.g.max, ...x.out]); const allVals = groups.flatMap((x) => [x.g.min, x.g.q1, x.g.median, x.g.q3, x.g.max, ...x.out]).filter(isNum);
  return { groups, drawn, hidden: groups.filter((x) => x.status !== 'ok'), vals, ax: axisSpec(b.valueKind || 'amount', allVals, lang, b.valueTitle) };
}
const boxCaption = (c, p) => { const L = Lx(c); const few = p.hidden.filter((x) => x.status === 'few'); const bad = p.hidden.filter((x) => x.status === 'bad'); return [few.length ? L(`لم تُرسم لقلة الملاحظات (أقل من 5): ${few.map((x) => `${x.label} (n=${x.n})`).join('، ')}`, `Not drawn — fewer than 5 observations: ${few.map((x) => `${x.label} (n=${x.n})`).join(', ')}`) : null, bad.length ? L(`لم تُرسم لعدم اتساق الإحصاءات: ${bad.map((x) => x.label).join('، ')}`, `Not drawn — inconsistent statistics: ${bad.map((x) => x.label).join(', ')}`) : null]; };
function boxChart(c) {
  const { b } = c; const L = Lx(c); const p = boxPlan(b, c.lang); const ax = p.ax;
  if (!p.groups.length) return c.noData();
  const cap = boxCaption(c, p);
  if (!p.drawn.length) return notice(c, L('لا تتوفر مجموعة بملاحظات كافية', 'No group has enough observations'), cap.filter(Boolean).concat(L('يلزم 5 ملاحظات على الأقل لرسم الصندوق.', 'At least 5 observations are needed to draw a box.')));
  const horiz = b.orientation === 'h' ? true : b.orientation === 'v' ? false : p.drawn.length > 8; const [lo, hi] = rangeOf(p.vals); const sc = fixCount(niceFree(lo, hi), ax);
  const anatomy = L('الصندوق: من الربيع الأول إلى الثالث · الخط الداخلي: الوسيط · الشعيرتان: أدنى وأعلى قيمة · الدوائر: قيم شاذة', 'Box: first to third quartile · inner line: median · whiskers: minimum and maximum · circles: outliers');
  const note = noteBlock(c, [anatomy, ...cap]); const fillc = mix(PALETTE[0], '#FFFFFF', 0.72); const tipOf = (x) => { const g = x.g; return `${x.label} (n=${x.n})\n${L('الأدنى', 'Min')}: ${tipV(ax, g.min)}\nQ1: ${tipV(ax, g.q1)}\n${L('الوسيط', 'Median')}: ${tipV(ax, g.median)}\nQ3: ${tipV(ax, g.q3)}\n${L('الأعلى', 'Max')}: ${tipV(ax, g.max)}${x.out.length ? `\n${L('قيم شاذة', 'Outliers')}: ${x.out.map((v) => tipV(ax, v)).join('، ')}` : ''}`; };
  if (!horiz) {
    const gs = p.drawn; const labels = gs.map((x) => x.label); const fr = frameV(c, { sc, ax, labels, items: [], note }); let out = fr.grid; const bw = Math.max(4, Math.min(60, fr.band * 0.55)); const cw = bw * 0.45;
    gs.forEach((x, pos) => {
      const cx = fr.xc(pos); const g = x.g; const tip = tipOf(x); const Y = fr.yOf;
      out += c.line(cx, Y(g.min), cx, Y(g.q1), INK, { sw: 1.4 }) + c.line(cx, Y(g.q3), cx, Y(g.max), INK, { sw: 1.4 }) + c.line(cx - cw / 2, Y(g.min), cx + cw / 2, Y(g.min), INK, { sw: 1.4 }) + c.line(cx - cw / 2, Y(g.max), cx + cw / 2, Y(g.max), INK, { sw: 1.4 });
      out += c.rect(cx - bw / 2, Y(g.q3), bw, Math.max(1.5, Y(g.q1) - Y(g.q3)), fillc, { stroke: PALETTE[0], sw: 1.6, title: tip, d: { i: x.i, j: 0 } }) + c.line(cx - bw / 2, Y(g.median), cx + bw / 2, Y(g.median), INK, { sw: 2.6 });
      x.out.forEach((v) => { out += marker(c, 0, cx, Y(v), 3.2, '#fff', { stroke: PALETTE[0], sw: 1.4, title: `${x.label}: ${L('قيمة شاذة', 'outlier')} ${tipV(ax, v)}`, d: { i: x.i, j: 1 } }); });
      if (labelsOn(c) && bw >= 28) out += c.num(cx + bw / 2 + 3, Y(g.median) + 4, ax.tick(g.median), { size: 10, align: 's', fill: MUTE });
    });
    return closeV(c, fr, out, labels, note);
  }
  const rows = p.drawn.slice(0, MAXROWS); const hiddenRows = p.drawn.length - rows.length; const note2 = noteBlock(c, [anatomy, ...cap, moreNote(c, hiddenRows)]);
  const fr = frameH(c, { n: rows.length, rowH: 28, sc, ax, items: [], note: note2 }); let out = fr.grid; const bh = Math.max(6, Math.min(20, fr.rh * 0.6));
  rows.forEach((x, pos) => {
    const cy = fr.top + pos * fr.rh + fr.rh / 2; const g = x.g; const X = fr.xOf; const tip = tipOf(x); out += rowLabel(c, fr, pos, x.label);
    out += c.line(X(g.min), cy, X(g.q1), cy, INK, { sw: 1.4 }) + c.line(X(g.q3), cy, X(g.max), cy, INK, { sw: 1.4 }) + c.line(X(g.min), cy - bh / 4, X(g.min), cy + bh / 4, INK, { sw: 1.4 }) + c.line(X(g.max), cy - bh / 4, X(g.max), cy + bh / 4, INK, { sw: 1.4 });
    out += c.rect(X(g.q1), cy - bh / 2, Math.max(1.5, X(g.q3) - X(g.q1)), bh, fillc, { stroke: PALETTE[0], sw: 1.6, title: tip, d: { i: x.i, j: 0 } }) + c.line(X(g.median), cy - bh / 2, X(g.median), cy + bh / 2, INK, { sw: 2.6 });
    x.out.forEach((v) => { out += marker(c, 0, X(v), cy, 3.2, '#fff', { stroke: PALETTE[0], sw: 1.4, title: `${x.label}: ${L('قيمة شاذة', 'outlier')} ${tipV(ax, v)}`, d: { i: x.i, j: 1 } }); });
  });
  return fin(c, fr.H, out + fr.leg.draw(fr.legY) + note2.draw(fr.noteY));
}
registerDraw('box', boxChart);

// ======================================================================================================
// scatter · bubble
// ======================================================================================================
function xyPlan(b, lang, bubble) {
  const pts = (b.points || []).map((p, i) => ({ ...p, i })); const ok = pts.filter((p) => isNum(p.x) && isNum(p.y) && (!bubble || (isNum(p.size) && p.size >= 0)));
  const ax = axisSpec(b.xKind || 'amount', ok.map((p) => p.x), lang, b.xTitle); const ay = axisSpec(b.yKind || 'amount', ok.map((p) => p.y), lang, b.yTitle); const as = bubble ? axisSpec(b.sizeKind || 'amount', ok.map((p) => p.size), lang, b.sizeTitle) : null;
  return { pts, ok, skipped: pts.length - ok.length, ax, ay, as };
}
const niceRef = (v) => { if (!(v > 0)) return 0; const p = 10 ** Math.floor(Math.log10(v)); const fr = v / p; return (fr >= 5 ? 5 : fr >= 2 ? 2 : 1) * p; };
function xyChart(c, bubble) {
  const { b, lang, w } = c; const L = Lx(c); const p = xyPlan(b, lang, bubble); const { ax, ay, as } = p;
  if (!p.ok.length) return c.noData();
  const [x0, x1] = rangeOf(p.ok.map((q) => q.x)); const [y0, y1] = rangeOf(p.ok.map((q) => q.y)); const scx = fixCount(niceFree(x0, x1), ax); const scy = fixCount(niceFree(y0, y1), ay);
  const ms = Math.max(...scy.ticks.map((t) => ay.tick(t).length)) * 6.6 + 16; const mr = 22; const pw = Math.max(80, w - ms - mr); const top = 32;
  const maxSize = bubble ? Math.max(...p.ok.map((q) => q.size)) : 0; const rmax = Math.max(8, Math.min(30, pw / 12)); const rOf = (s) => (maxSize > 0 ? Math.max(3, rmax * Math.sqrt(s / maxSize)) : 3);
  const refs = bubble && maxSize > 0 ? [...new Set([niceRef(maxSize), niceRef(maxSize / 3), niceRef(maxSize / 10)].filter((v) => v > 0 && v <= maxSize * 1.0001))].sort((a, z) => z - a) : [];
  const legH = bubble && refs.length ? 2 * rmax + 40 : 0; const cause = L('العلاقة لا تعني السببية', 'A relationship is not causation');
  const note = noteBlock(c, [{ text: cause, fill: INK, weight: 600 }, bubble ? L('مساحة الفقاعة تتناسب مع قيمة الحجم.', 'Bubble area is proportional to the size value.') : null, p.skipped ? L(`${p.skipped} نقطة بلا قيمة لأحد المحورين${bubble ? ' أو الحجم' : ''} — لم تُرسم (ليست صفراً).`, `${p.skipped} point(s) missing a value${bubble ? ' (axis or size)' : ''} are not drawn (not zero).`) : null]);
  const fixed = top + 54 + legH + note.h + 8; const ph = c.height(fixed, Math.max(220, Math.min(420, pw * 0.62))); const H = fixed + ph;
  const X = (v) => ms + ((v - scx.lo) / scx.span) * pw; const Y = (v) => top + ph - ((v - scy.lo) / scy.span) * ph;
  let out = head(c, 6, 15, ay.title, { align: 's' });
  scy.ticks.forEach((t) => { const y = Y(t); out += c.line(ms, y, ms + pw, y, GRID) + c.num(ms - 7, y + 4, ay.tick(t), { size: 11, fill: MUTE, align: 'e' }); });
  const xs = scx.ticks.map((t) => ax.tick(t)); const xw = Math.max(...xs.map((s) => tw(s, 11))) + 12; const xstep = Math.max(1, Math.ceil(xw / (pw / Math.max(1, scx.ticks.length - 1))));
  scx.ticks.forEach((t, k) => { const x = X(t); out += c.line(x, top, x, top + ph, GRID); if (k % xstep === 0) out += c.num(x, top + ph + 15, xs[k], { size: 11, fill: MUTE, align: 'm' }); });
  out += c.line(ms, top + ph, ms + pw, top + ph, AXIS, { sw: 1.4 }) + c.line(ms, top, ms, top + ph, AXIS, { sw: 1.4 });
  out += head(c, ms + pw / 2, top + ph + 34, ax.title, { align: 'm', maxW: pw });
  const col = PALETTE[0]; const order = [...p.ok].sort((a, z) => (bubble ? z.size - a.size : 0)); const placed = []; const lh = 11;
  const labelFor = new Set(bubble ? [...p.ok].sort((a, z) => z.size - a.size).slice(0, Math.min(6, p.ok.length)).map((q) => q.i) : (p.ok.length <= 10 ? p.ok.map((q) => q.i) : [p.ok.reduce((m, q) => (q.y > m.y ? q : m)).i, p.ok.reduce((m, q) => (q.y < m.y ? q : m)).i, p.ok.reduce((m, q) => (q.x > m.x ? q : m)).i, p.ok.reduce((m, q) => (q.x < m.x ? q : m)).i]));
  const lblSvg = []; const tipOf = (q) => `${q.label ?? ''}\n${ax.title.split(' — ')[0]}: ${tipV(ax, q.x)}\n${ay.title.split(' — ')[0]}: ${tipV(ay, q.y)}${bubble ? `\n${(b.sizeTitle || L('الحجم', 'Size'))}: ${tipV(as, q.size)}` : ''}`;
  order.forEach((q) => {
    const px_ = X(q.x); const py_ = Y(q.y); const r = bubble ? rOf(q.size) : 4.6; const zero = bubble && q.size === 0;
    out += marker(c, 0, px_, py_, r, zero ? '#fff' : col, { stroke: zero ? col : '#fff', sw: zero ? 1.6 : 1.2, op: zero ? null : bubble ? 0.55 : 0.85, title: tipOf(q), d: { i: q.i, key: q.key } });
    if (bubble && !zero) out += marker(c, 0, px_, py_, r, 'none', { stroke: col, sw: 1.2 });
    if (labelsOn(c) && labelFor.has(q.i) && q.label) {
      const t = cutStr(q.label, 20); const wd = tw(t.s, 10.5) + 2;
      const cands = [[px_ + r + 3, py_ + 4, 's', px_ + r + 3, px_ + r + 3 + wd], [px_ - r - 3, py_ + 4, 'e', px_ - r - 3 - wd, px_ - r - 3], [px_, py_ - r - 4, 'm', px_ - wd / 2, px_ + wd / 2], [px_, py_ + r + 12, 'm', px_ - wd / 2, px_ + wd / 2]];
      for (const [lx, ly, al, a0, a1] of cands) { const yy0 = ly - lh; const yy1 = ly + 3; if (a0 < ms || a1 > ms + pw || yy0 < top || yy1 > top + ph) continue; if (placed.some((z) => a0 < z[1] + 2 && a1 > z[0] - 2 && yy0 < z[3] && yy1 > z[2])) continue; placed.push([a0, a1, yy0, yy1]); lblSvg.push(c.text(lx, ly, t.s, { size: 10.5, align: al, fill: INK, title: t.cut ? q.label : null })); break; }
    }
  });
  out += lblSvg.join('');
  let y = top + ph + 54;
  if (bubble && refs.length) {
    const sz = (b.sizeTitle || L('الحجم', 'Size')); out += head(c, 14, y + 8, `${sz}${as.unitText ? ` — ${as.unitText}` : ''}`, { align: 's', maxW: w - 28 });
    let lx = 14; refs.forEach((rv) => { const r = rOf(rv); out += c.circle(lx + r, y + 18 + rmax, r, 'none', { stroke: MUTE, sw: 1.2 }) + c.num(lx + 2 * r + 5, y + 22 + rmax, as.tick(rv), { size: 11, align: 's', fill: INK, title: tipV(as, rv) }); lx += 2 * r + 12 + tw(as.tick(rv), 11) + 14; });
    y += legH;
  }
  return fin(c, H, out + note.draw(y));
}
registerDraw('scatter', (c) => xyChart(c, false));
registerDraw('bubble', (c) => xyChart(c, true));

// ======================================================================================================
// bullet
// ======================================================================================================
function bulletPlan(b, lang) {
  const rows = (b.bullets || []).map((x, i) => ({ i, ...x, ranges: (Array.isArray(x.ranges) ? x.ranges.filter((r) => isNum(r.to)) : []).slice().sort((a, z) => a.to - z.to) }));
  const drawn = rows.filter((x) => isNum(x.target) && x.target > 0); const hidden = rows.filter((x) => !drawn.includes(x));
  const vals = drawn.flatMap((x) => [x.actual, x.target, ...x.ranges.map((r) => r.to)]).filter(isNum); const allVals = rows.flatMap((x) => [x.actual, x.target, ...x.ranges.map((r) => r.to)]).filter(isNum);
  return { rows, drawn, hidden, vals, ax: axisSpec(b.valueKind || 'amount', allVals, lang, b.valueTitle) };
}
const achieved = (x) => (isNum(x.actual) && isNum(x.target) && x.target > 0 ? x.actual / x.target : null);
function bulletChart(c) {
  const { b } = c; const L = Lx(c); const p = bulletPlan(b, c.lang); const ax = p.ax;
  const tl = (o) => (o == null ? '' : typeof o === 'string' ? o : L(o.ar, o.en)); const capOf = (x) => (x.caption == null ? null : tl(x.caption)); // optional, additive: a bilingual target name (b.targetLabel) and a per-row caption (x.caption) — a plan page names its OWN target (the plan-period target), never «approved»
  if (!p.rows.length) return c.noData();
  const cap = p.hidden.length ? L(`صفوف بلا مستهدف معتمد — لم تُرسم: ${p.hidden.map((x) => x.label).join('، ')}`, `Rows without an approved target are not drawn: ${p.hidden.map((x) => x.label).join(', ')}`) : null;
  if (!p.drawn.length) return notice(c, L('لا توجد صفوف بمستهدف معتمد', 'No row has an approved target'), [cap, L('لا يُرسم مخطط رصاصي دون مستهدف معتمد.', 'A bullet chart is not drawn without an approved target.')].filter(Boolean));
  const rows = p.drawn.slice(0, MAXROWS); const hiddenRows = p.drawn.length - rows.length; const [lo, hi] = rangeOf(p.vals); const sc = fixCount(niceScale(Math.min(0, lo), Math.max(0, hi)), ax);
  const bandNames = []; rows.forEach((x) => x.ranges.forEach((r, k) => { if (r.label && !bandNames.some((z) => z.label === r.label)) bandNames.push({ label: r.label, k, n: x.ranges.length }); }));
  const bandCol = (k, n) => mix('#B7BDC8', '#F2F4F7', n > 1 ? k / (n - 1) : 0.55);
  const items = [...bandNames.map((z) => ({ label: z.label, color: bandCol(z.k, z.n), kind: 'rect' })), { label: L('الفعلي', 'Actual'), color: TOTAL, kind: 'rect' }, { label: b.targetLabel ? tl(b.targetLabel) : L('المستهدف المعتمد', 'Approved target'), color: INK, kind: 'rect' }];
  const note = noteBlock(c, [cap, moreNote(c, hiddenRows)]); const fr = frameH(c, { n: rows.length, rowH: 56, sc, ax, items, note }); let out = fr.grid;
  rows.forEach((x, pos) => {
    const top = fr.top + pos * fr.rh; const bandH = Math.min(24, fr.rh * 0.42); const by = top + 6; const cy = by + bandH / 2; out += rowLabel(c, fr, pos, x.label, { weight: 600 });
    const track = x.ranges.length ? x.ranges : [{ to: sc.hi }];
    track.slice().reverse().forEach((r, ri) => { const k = track.length - 1 - ri; const to = Math.min(sc.hi, r.to); out += c.rect(fr.x0, by, Math.max(0, fr.xOf(to) - fr.x0), bandH, x.ranges.length ? bandCol(k, track.length) : '#F2F4F7', { title: x.ranges.length ? `${x.label} — ${r.label ?? ''}: ≤ ${tipV(ax, r.to)}` : null }); });
    const pct = achieved(x); const tip = `${x.label}\n${L('الفعلي', 'Actual')}: ${tipV(ax, x.actual)}\n${L('المستهدف', 'Target')}: ${tipV(ax, x.target)}\n${L('نسبة التحقق', 'Achieved')}: ${pct == null ? '—' : pctS(pct)}${capOf(x) ? `\n${capOf(x)}` : ''}`;
    if (isNum(x.actual)) { const xa = fr.xOf(x.actual); out += c.rect(Math.min(fr.x0, xa), cy - bandH / 6, Math.max(1.5, Math.abs(xa - fr.x0)), bandH / 3, TOTAL, { title: tip, d: { i: x.i, j: 0 } }); } else out += c.text(fr.x0 + 6, cy + 4, '—', { size: 11, fill: MUTE, title: tip });
    const xt = fr.xOf(x.target); out += c.line(xt, by + 1, xt, by + bandH - 1, INK, { sw: 3 }) + hit(c, xt - 4, by, 8, bandH, `${x.label} — ${L('المستهدف', 'Target')}: ${tipV(ax, x.target)}`);
    if (labelsOn(c)) out += c.num(fr.ml, by + bandH + 14, (capOf(x) || `${isNum(x.actual) ? ax.tick(x.actual) : '—'} / ${ax.tick(x.target)} = ${pct == null ? '—' : pctS(pct)}`), { size: 11, align: 's', fill: INK, weight: 600, title: tip });
  });
  return fin(c, fr.H, out + fr.leg.draw(fr.legY) + note.draw(fr.noteY));
}
registerDraw('bullet', bulletChart);

// ======================================================================================================
// formats: info (unit resolution) · summary (one sentence) · table (accessible data table)
// ======================================================================================================
const sentence = (kind, b, lang, body) => `${NAMES[kind][lang === 'ar' ? 0 : 1]}: ${b.title ? `${b.title}. ` : ''}${body}.`;
const unitTag = (sp) => (sp.unitText ? ` (${sp.unitText})` : '');
const bi = (ar) => (a, e) => (ar ? a : e); // bilingual picker
const cellOf = (sp, v) => (isNum(v) ? sp.tick(v) : '—');

// ----- stacked family -----
for (const kind of ['stacked_col', 'stacked100_col', 'stacked100_hbar']) {
  const pct = kind !== 'stacked_col';
  registerChartFormat(kind, {
    info: (b, lang) => toInfo(stackSpec(b, lang)),
    summary: (b, lang) => { const ar = lang === 'ar'; const l = bi(ar); const sp = stackSpec(b, lang); const plan = stackPlan(b, pct); const n = (b.labels || []).length; const m = (b.series || []).length; let best = null;
      plan.cats.forEach((x) => { if (!x.empty && x.known.length && (!best || x.total > best.total)) best = x; });
      return sentence(kind, b, lang, pct ? l(`${n} فئة و${m} سلسلة؛ كل فئة تساوي 100% من إجماليها، والمبالغ في التلميحات${unitTag(sp)}`, `${n} categories, ${m} series; each category is 100 % of its own total, amounts in the tooltips${unitTag(sp)}`) : l(`${n} فئة و${m} سلسلة${unitTag(sp)}${best ? `؛ الأعلى إجمالاً: ${best.label} ${sp.tick(best.total)}` : ''}`, `${n} categories, ${m} series${unitTag(sp)}${best ? `; highest total: ${best.label} ${sp.tick(best.total)}` : ''}`)); },
    table: (b, lang) => { const ar = lang === 'ar'; const l = bi(ar); const sp = stackSpec(b, lang); const plan = stackPlan(b, pct); const totalH = `${l('الإجمالي', 'Total')}${unitTag(sp)}`;
      return { headers: [l('البند', 'Item'), ...(b.series || []).map((s) => `${s.label}${unitTag(sp)}`), totalH], rows: plan.cats.map((x) => [x.label, ...x.vals.map((v) => (v == null ? '—' : pct && x.empty ? '—' : `${sp.tick(v)}${x.total > 0 && x.allPos ? ` (${pctS(v / x.total)})` : ''}`)), x.known.length === 0 || x.missing.length ? '—' : sp.tick(x.total)]) }; }
  });
}

// ----- area -----
registerChartFormat('area', {
  info: (b, lang) => toInfo(areaSpec(b, lang, false)),
  summary: (b, lang) => { const l = bi(lang === 'ar'); const sp = areaSpec(b, lang, false); const n = (b.labels || []).length; const m = (b.series || []).length; let best = null; (b.series || []).forEach((s) => (s.values || []).forEach((v, i) => { if (isNum(v) && (!best || v > best.v)) best = { v, l: b.labels[i], s: s.label }; }));
    return sentence('area', b, lang, l(`${n} نقطة و${m} سلسلة${unitTag(sp)}؛ المساحة عند القيمة صفر تبدأ والفجوة تعني لا بيانات${best ? `؛ الأعلى: ${best.l} ${sp.tick(best.v)}` : ''}`, `${n} points, ${m} series${unitTag(sp)}; the baseline is zero and a gap means no data${best ? `; highest: ${best.l} ${sp.tick(best.v)}` : ''}`)); }
});
registerChartFormat('stacked_area', {
  info: (b, lang) => toInfo(areaSpec(b, lang, true)),
  summary: (b, lang) => { const l = bi(lang === 'ar'); const sp = areaSpec(b, lang, true); const n = (b.labels || []).length; const m = (b.series || []).length; const tot = (b.labels || []).map((_, i) => ((b.series || []).every((s) => isNum(s.values?.[i])) ? sumKnown((b.series || []).map((s) => s.values[i])) : null)); let bx = -1; tot.forEach((t, i) => { if (t != null && (bx < 0 || t > tot[bx])) bx = i; });
    return sentence('stacked_area', b, lang, l(`${n} نقطة و${m} سلسلة مكدّسة${unitTag(sp)}${bx >= 0 ? `؛ أعلى إجمالي: ${b.labels[bx]} ${sp.tick(tot[bx])}` : ''}`, `${n} points, ${m} stacked series${unitTag(sp)}${bx >= 0 ? `; highest total: ${b.labels[bx]} ${sp.tick(tot[bx])}` : ''}`)); },
  table: (b, lang) => { const l = bi(lang === 'ar'); const sp = areaSpec(b, lang, true); const s = b.series || [];
    return { headers: [l('البند', 'Item'), ...s.map((x) => `${x.label}${unitTag(sp)}`), `${l('الإجمالي', 'Total')}${unitTag(sp)}`], rows: (b.labels || []).map((lab, i) => [lab, ...s.map((x) => cellOf(sp, x.values?.[i])), s.every((x) => isNum(x.values?.[i])) ? sp.tick(sumKnown(s.map((x) => x.values[i]))) : '—']) }; }
});

// ----- combo -----
registerChartFormat('combo', {
  info: (b, lang) => toInfo(comboPlan(b, lang).ax1),
  summary: (b, lang) => { const l = bi(lang === 'ar'); const { pri, sec, ax1, ax2 } = comboPlan(b, lang); const n = (b.labels || []).length; const sOf = (s) => `${s.label} ${s.type === 'line' ? l('(خط)', '(line)') : l('(أعمدة)', '(bars)')}`;
    return sentence('combo', b, lang, l(`${n} فئة؛ المحور الأول (${ax1.title}): ${pri.map(sOf).join('، ')}${ax2 ? `؛ المحور الثاني (${ax2.title}): ${sec.map(sOf).join('، ')}` : ''}`, `${n} categories; first axis (${ax1.title}): ${pri.map(sOf).join(', ')}${ax2 ? `; second axis (${ax2.title}): ${sec.map(sOf).join(', ')}` : ''}`)); },
  table: (b, lang) => { const l = bi(lang === 'ar'); const { sec, ax1, ax2 } = comboPlan(b, lang); const s = b.series || [];
    return { headers: [l('البند', 'Item'), ...s.map((x) => { const sp = sec.includes(x) ? ax2 : ax1; return `${x.label}${unitTag(sp) || ''}`; })], rows: (b.labels || []).map((lab, i) => [lab, ...s.map((x) => cellOf(sec.includes(x) ? ax2 : ax1, x.values?.[i]))]) }; }
});

// ----- pareto -----
registerChartFormat('pareto', {
  info: (b, lang) => toInfo(axisSpec(b.valueKind || 'amount', (b.series?.[0]?.values || []).filter(isNum), lang, b.valueTitle)),
  summary: (b, lang) => { const l = bi(lang === 'ar'); const sp = axisSpec(b.valueKind || 'amount', (b.series?.[0]?.values || []).filter(isNum), lang, b.valueTitle); const p = paretoPlan(b); const top = p.order.find((x) => x.v != null);
    return sentence('pareto', b, lang, l(`${p.order.length} بنداً مرتبة تنازلياً${unitTag(sp)}${top && top.share != null ? `؛ الأكبر: ${top.l} ${pctS(top.share)} من الإجمالي` : ''}${p.reach >= 0 && p.total > 0 ? `؛ يبلغ التراكمي 80% عند البند ${p.reach + 1}` : ''}`, `${p.order.length} items sorted descending${unitTag(sp)}${top && top.share != null ? `; largest: ${top.l} at ${pctS(top.share)} of the total` : ''}${p.reach >= 0 && p.total > 0 ? `; the cumulative share reaches 80 % at item ${p.reach + 1}` : ''}`)); },
  table: (b, lang) => { const l = bi(lang === 'ar'); const sp = axisSpec(b.valueKind || 'amount', (b.series?.[0]?.values || []).filter(isNum), lang, b.valueTitle); const p = paretoPlan(b);
    return { headers: [l('البند', 'Item'), `${b.series?.[0]?.label || l('القيمة', 'Value')}${unitTag(sp)}`, l('الحصة', 'Share'), l('الحصة التراكمية', 'Cumulative share')], rows: p.order.map((x) => [x.l, cellOf(sp, x.v), x.share == null ? '—' : pctS(x.share), x.cum == null ? '—' : pctS(x.cum)]) }; }
});

// ----- histogram -----
registerChartFormat('histogram', {
  info: (b, lang) => toInfo(histPlan(b, lang).ay),
  summary: (b, lang) => { const l = bi(lang === 'ar'); const p = histPlan(b, lang); const c = { ar: lang === 'ar' }; let best = null; p.bins.forEach((x, i) => { if (isNum(p.ys[i]) && (!best || p.ys[i] > best.v)) best = { v: p.ys[i], r: binRange(c, p, x, false) }; });
    return sentence('histogram', b, lang, l(`${p.bins.length} فئة (${p.axx.title})${best ? `؛ الأعلى: ${best.r} (${p.ay.tick(best.v)})` : ''}؛ الفئات الفارغة ظاهرة ولم تُحذف`, `${p.bins.length} bins (${p.axx.title})${best ? `; highest: ${best.r} (${p.ay.tick(best.v)})` : ''}; empty bins stay on the axis`)); },
  table: (b, lang) => { const l = bi(lang === 'ar'); const p = histPlan(b, lang); const c = { ar: lang === 'ar' }; const amt = p.yKind === 'amount';
    return { headers: [`${l('الفئة', 'Bin')} — ${p.axx.title}`, amt ? `${l('المبلغ', 'Amount')}${unitTag(p.ay)}` : l('العدد', 'Count'), ...(amt ? [l('العدد', 'Count')] : [])], rows: p.bins.map((x, i) => [binRange(c, p, x, false), cellOf(p.ay, p.ys[i]), ...(amt ? [x.count == null ? '—' : fmtInt(x.count)] : [])]) }; }
});

// ----- box -----
registerChartFormat('box', {
  info: (b, lang) => toInfo(boxPlan(b, lang).ax),
  summary: (b, lang) => { const l = bi(lang === 'ar'); const p = boxPlan(b, lang); let best = null; p.drawn.forEach((x) => { if (!best || x.g.median > best.g.median) best = x; });
    return sentence('box', b, lang, l(`${p.drawn.length} مجموعة مرسومة من ${p.groups.length}${unitTag(p.ax)}${best ? `؛ أعلى وسيط: ${best.label} ${p.ax.tick(best.g.median)}` : ''}${p.hidden.length ? `؛ ${p.hidden.length} مجموعة بأقل من 5 ملاحظات أو إحصاءات غير متسقة لم تُرسم` : ''}`, `${p.drawn.length} of ${p.groups.length} groups drawn${unitTag(p.ax)}${best ? `; highest median: ${best.label} ${p.ax.tick(best.g.median)}` : ''}${p.hidden.length ? `; ${p.hidden.length} group(s) with fewer than 5 observations or inconsistent statistics not drawn` : ''}`)); },
  table: (b, lang) => { const l = bi(lang === 'ar'); const p = boxPlan(b, lang); const u = unitTag(p.ax);
    return { headers: [l('المجموعة', 'Group'), 'n', `${l('الأدنى', 'Min')}${u}`, `Q1${u}`, `${l('الوسيط', 'Median')}${u}`, `Q3${u}`, `${l('الأعلى', 'Max')}${u}`, l('قيم شاذة', 'Outliers'), l('الحالة', 'Status')], rows: p.groups.map((x) => [x.label, String(x.n), cellOf(p.ax, x.g.min), cellOf(p.ax, x.g.q1), cellOf(p.ax, x.g.median), cellOf(p.ax, x.g.q3), cellOf(p.ax, x.g.max), String(x.out.length), x.status === 'ok' ? l('مرسومة', 'Drawn') : x.status === 'few' ? l('لم تُرسم (أقل من 5 ملاحظات)', 'Not drawn (fewer than 5 observations)') : l('لم تُرسم (إحصاءات غير متسقة)', 'Not drawn (inconsistent statistics)')]) }; }
});

// ----- scatter · bubble -----
for (const kind of ['scatter', 'bubble']) {
  const bubble = kind === 'bubble';
  registerChartFormat(kind, {
    info: (b, lang) => toInfo(xyPlan(b, lang, bubble).ay),
    summary: (b, lang) => { const l = bi(lang === 'ar'); const p = xyPlan(b, lang, bubble);
      return sentence(kind, b, lang, l(`${p.ok.length} نقطة؛ المحور الأفقي: ${p.ax.title}، المحور الرأسي: ${p.ay.title}${bubble ? `، مساحة الفقاعة: ${b.sizeTitle || p.as.title}` : ''}${p.skipped ? `؛ ${p.skipped} نقطة ناقصة لم تُرسم` : ''}؛ العلاقة لا تعني السببية`, `${p.ok.length} points; x axis: ${p.ax.title}, y axis: ${p.ay.title}${bubble ? `, bubble area: ${b.sizeTitle || p.as.title}` : ''}${p.skipped ? `; ${p.skipped} incomplete point(s) not drawn` : ''}; a relationship is not causation`)); },
    table: (b, lang) => { const l = bi(lang === 'ar'); const p = xyPlan(b, lang, bubble);
      return { headers: [l('النقطة', 'Point'), p.ax.title, p.ay.title, ...(bubble ? [`${b.sizeTitle || l('الحجم', 'Size')}${unitTag(p.as)}`] : [])], rows: p.pts.map((q) => [q.label ?? `#${q.i + 1}`, cellOf(p.ax, q.x), cellOf(p.ay, q.y), ...(bubble ? [cellOf(p.as, q.size)] : [])]) }; }
  });
}

// ----- bullet -----
registerChartFormat('bullet', {
  info: (b, lang) => toInfo(bulletPlan(b, lang).ax),
  summary: (b, lang) => { const l = bi(lang === 'ar'); const p = bulletPlan(b, lang); const ap = b.targetLabel ? '' : ' معتمد'; const ape = b.targetLabel ? 'a' : 'an approved'; /* a plan's own target is not «approved» */ const pc = p.drawn.map((x) => ({ x, a: achieved(x) })).filter((z) => z.a != null).sort((a, z) => z.a - a.a);
    return sentence('bullet', b, lang, l(`${p.drawn.length} صفاً بمستهدف${ap}${unitTag(p.ax)}${pc.length ? `؛ الأعلى تحققاً: ${pc[0].x.label} ${pctS(pc[0].a)}، الأدنى: ${pc[pc.length - 1].x.label} ${pctS(pc[pc.length - 1].a)}` : ''}${p.hidden.length ? `؛ ${p.hidden.length} صف بلا مستهدف${ap} لم يُرسم` : ''}`, `${p.drawn.length} rows with ${ape} target${unitTag(p.ax)}${pc.length ? `; best: ${pc[0].x.label} ${pctS(pc[0].a)}, lowest: ${pc[pc.length - 1].x.label} ${pctS(pc[pc.length - 1].a)}` : ''}${p.hidden.length ? `; ${p.hidden.length} row(s) without ${ape} target not drawn` : ''}`)); },
  table: (b, lang) => { const l = bi(lang === 'ar'); const p = bulletPlan(b, lang); const u = unitTag(p.ax);
    const cx = (o) => (o == null ? '—' : typeof o === 'string' ? o : l(o.ar, o.en)); const xh = Array.isArray(b.cellHeaders) ? b.cellHeaders : []; // optional extra columns (b.cellHeaders + x.cells): the amounts behind a % axis
    return { headers: [l('البند', 'Item'), `${l('الفعلي', 'Actual')}${u}`, `${l('المستهدف', 'Target')}${u}`, l('نسبة التحقق', '% achieved'), ...xh.map(cx)], rows: p.rows.map((x) => [x.label, cellOf(p.ax, x.actual), cellOf(p.ax, x.target), achieved(x) == null ? '—' : pctS(achieved(x)), ...xh.map((_, k) => cx(x.cells ? x.cells[k] : null))]) }; }
});

export { axisSpec, stackPlan, paretoPlan, histPlan, boxPlan, xyPlan, bulletPlan, comboPlan };
