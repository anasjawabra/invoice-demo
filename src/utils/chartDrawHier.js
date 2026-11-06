// Hierarchy / flow chart kinds: donut · treemap · sunburst · sankey — see docs/chart-library.md («Hierarchy and flow renderers»). Registers into chartDraw.js (drawers) and reportFormat.js (info / summary / table).
// Rules on top of chartDraw.js's: parts of ONE whole only (nonnegative; a tree must be additive, a flow must reconcile) — otherwise the chart is REFUSED with the «No data» drawing (+ the reason, data-refused="…"), never drawn wrong ·
// zero draws no mark (listed in legend/table) · null is unknown, never zero · the unit is named once · tooltips carry the exact SAR, the share of the parent and of the total · colour is never the only carrier (labels, legend, table).
import { registerDraw, drawKit } from './chartDraw';
import { registerChartFormat } from '../data/reportFormat';
import { chartUnit, unitLabel, fmtSar } from './money';
import { flattenTree, treeProblem, treeFromSeries, sankeyProblem, sankeyColumns, treeDepth } from '../data/chartTree';

const { finish, unitHead, wrapText, cutStr, esc, f, tw, mix, onColor, rampAt, PALETTE, ROLE, INK, MUTE, AXIS } = drawKit;
const fin = (c, h, body, extra) => finish(c, Math.ceil(h), body, extra); // whole-pixel heights
const HPAL = [...PALETTE, '#C11574', '#475467']; // the report palette + two more hues; colour is never the only carrier (every mark has a label, a legend row or a table row)
const OTHER_COL = '#98A2B3';
const TAU = Math.PI * 2;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const plainNum = (v) => (Number.isInteger(v) ? v.toLocaleString('en-US') : Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 }));
const exactNum = (v) => (v == null || !isNum(v) ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 }));
const pct = (v, t) => (t > 0 && isNum(v) ? `${((v / t) * 100).toFixed(1)}%` : '—');
const T = (lang) => (a, e) => (lang === 'ar' ? a : e);
const noMouse = (s) => s.replace('<text ', '<text pointer-events="none" ');
const halo = (s) => s.replace('<text ', '<text pointer-events="none" paint-order="stroke" stroke="#fff" stroke-width="3" stroke-linejoin="round" ');
const showL = (b) => b.showLabels !== false; const showG = (b) => b.showLegend !== false;

// ---------- unit resolution / summary / table (registerChartFormat) ----------
function infoFor(vals, b, lang) {
  if (b.plain) return { cu: { unit: { key: 'plain', div: 1 }, title: b.valueTitle || (lang === 'ar' ? 'القيمة' : 'Value'), tick: plainNum, fmt: plainNum }, unitText: '', plain: true };
  const cu = chartUnit(vals.filter(isNum), lang); return { cu, unitText: unitLabel(cu.unit, lang) };
}
function treeSource(b) {
  if (b.tree && typeof b.tree === 'object') return { tree: b.tree, missing: [] };
  if (Array.isArray(b.labels) && Array.isArray(b.series) && b.series[0] && Array.isArray(b.series[0].values)) return treeFromSeries(b.labels, b.series[0].values, b.title || '');
  return { tree: null, missing: [] };
}
const donutParts = (b) => (b.series?.[0]?.values || []).map((v, i) => ({ i, label: String(b.labels?.[i] ?? ''), v: isNum(v) ? v : null }));
const donutValues = (b) => { const p = donutParts(b).filter((x) => x.v != null && x.v >= 0); const t = p.reduce((s, x) => s + x.v, 0); return [t, ...p.map((x) => x.v)]; };
const treeValues = (b) => { const rows = flattenTree(treeSource(b).tree); return rows.length ? [rows[0].value, ...rows.filter((e) => e.leaf).map((e) => e.value)] : []; };
const flowTotals = (b) => { const o = new Map(); const i = new Map(); (b.links || []).forEach((l) => { if (isNum(l.value)) { o.set(l.from, (o.get(l.from) || 0) + l.value); i.set(l.to, (i.get(l.to) || 0) + l.value); } }); return [...(b.links || []).map((l) => l.value), ...o.values(), ...i.values()]; };

const largestOf = (rows) => rows.reduce((m, e) => (e.value != null && (!m || e.value > m.value) ? e : m), null);
function treeSummary(name, b, lang) {
  const ar = lang === 'ar'; const { tree } = treeSource(b); const rows = flattenTree(tree); const { cu, unitText } = infoFor(treeValues(b), b, lang);
  if (!rows.length) return `${name}: ${b.title ? `${b.title}. ` : ''}${ar ? 'لا بيانات.' : 'no data.'}`;
  const leaves = rows.filter((e) => e.leaf && e.depth > 0); const groups = rows.filter((e) => !e.leaf && e.depth === 1); const top = largestOf(rows.filter((e) => e.depth === 1)); const tot = rows[0].value;
  const unit = unitText ? ` ${unitText}` : '';
  return `${name}: ${b.title ? `${b.title}. ` : ''}${ar ? `${groups.length || leaves.length} ${groups.length ? 'مجموعة' : 'بنداً'}${groups.length ? ` و${leaves.length} بنداً` : ''}، الإجمالي ${tot == null ? '—' : cu.tick(tot)}${unit}${top ? `؛ الأكبر: ${top.label} (${pct(top.value, tot)})` : ''}.` : `${groups.length || leaves.length} ${groups.length ? 'groups' : 'items'}${groups.length ? `, ${leaves.length} items` : ''}, total ${tot == null ? '—' : cu.tick(tot)}${unit}${top ? `; largest: ${top.label} (${pct(top.value, tot)})` : ''}.`}`;
}
function treeTable(b, lang) {
  const ar = lang === 'ar'; const { tree, missing } = treeSource(b); const rows = flattenTree(tree); const plain = !!b.plain;
  const D = Math.max(1, ...rows.map((e) => e.depth)); const levels = Array.isArray(b.levels) ? b.levels : [];
  const headers = [...Array.from({ length: D }, (_, k) => levels[k] || (ar ? `المستوى ${k + 1}` : `Level ${k + 1}`)), plain ? (b.valueTitle || (ar ? 'القيمة' : 'Value')) : (ar ? 'المبلغ (ريال)' : 'Amount (SAR)'), ar ? 'الحصة من المستوى الأعلى' : 'Share of parent', ar ? 'الحصة من الإجمالي' : 'Share of total'];
  const tot = rows[0]?.value; const val = (v) => (plain ? (v == null ? '—' : plainNum(v)) : exactNum(v));
  const out = rows.map((e) => { const cells = Array.from({ length: D }, (_, k) => (e.depth === 0 ? (k === 0 ? (e.label || (ar ? 'الإجمالي' : 'Total')) : '') : k < e.depth ? e.path[k] : '')); const par = e.parent >= 0 ? rows[e.parent].value : e.value; return [...cells, val(e.value), pct(e.value, par), pct(e.value, tot)]; });
  missing.forEach((m) => out.push([m.label, ...Array(D - 1).fill(''), '—', '—', '—']));
  return { headers, rows: out };
}
const KN = { donut: ['مخطط حلقي', 'Donut chart'], treemap: ['خريطة شجرية', 'Treemap'], sunburst: ['مخطط شمسي', 'Sunburst chart'], sankey: ['مخطط تدفق (سانكي)', 'Sankey flow chart'] };

function donutModel(b) {
  const parts = donutParts(b); const pos = parts.filter((p) => p.v > 0).sort((x, y) => y.v - x.v || x.i - y.i); const total = pos.reduce((t, p) => t + p.v, 0);
  return { parts, pos, total, rest: parts.filter((p) => p.v === 0 || p.v == null) };
}
registerChartFormat('donut', {
  info: (b, lang) => infoFor(donutValues(b), b, lang),
  summary: (b, lang) => { const ar = lang === 'ar'; const { cu, unitText } = infoFor(donutValues(b), b, lang); const m = donutModel(b); const top = m.pos[0]; const unit = unitText ? ` ${unitText}` : ''; return `${KN.donut[ar ? 0 : 1]}: ${b.title ? `${b.title}. ` : ''}${ar ? `${m.parts.length} أجزاء، الإجمالي ${cu.tick(m.total)}${unit}${top ? `؛ الأكبر: ${top.label} (${pct(top.v, m.total)})` : ''}.` : `${m.parts.length} parts, total ${cu.tick(m.total)}${unit}${top ? `; largest: ${top.label} (${pct(top.v, m.total)})` : ''}.`}`; },
  table: (b, lang) => {
    const ar = lang === 'ar'; const m = donutModel(b); const plain = !!b.plain; const val = (v) => (plain ? (v == null ? '—' : plainNum(v)) : exactNum(v)); const grouped = m.pos.length > 8; const other = b.otherLabel || (ar ? 'أخرى' : 'Other');
    const headers = [ar ? 'الجزء' : 'Part', plain ? (b.valueTitle || (ar ? 'القيمة' : 'Value')) : (ar ? 'المبلغ (ريال)' : 'Amount (SAR)'), ar ? 'الحصة' : 'Share', ...(grouped ? [ar ? 'يظهر في المخطط ضمن' : 'Shown in the chart as'] : [])];
    const rows = [...m.pos.map((p, k) => [p.label, val(p.v), pct(p.v, m.total), ...(grouped ? [k < 7 ? p.label : other] : [])]), ...m.rest.map((p) => [p.label, val(p.v), p.v == null ? '—' : pct(p.v, m.total), ...(grouped ? [''] : [])])];
    return { headers, rows };
  }
});
['treemap', 'sunburst'].forEach((kind) => registerChartFormat(kind, {
  info: (b, lang) => infoFor(treeValues(b), b, lang),
  summary: (b, lang) => treeSummary(KN[kind][lang === 'ar' ? 0 : 1], b, lang),
  table: (b, lang) => treeTable(b, lang)
}));
registerChartFormat('sankey', {
  info: (b, lang) => infoFor(flowTotals(b), b, lang),
  summary: (b, lang) => {
    const ar = lang === 'ar'; const { cu, unitText } = infoFor(flowTotals(b), b, lang); const nodes = b.nodes || []; const links = b.links || []; const name = (id) => nodes.find((n) => n.id === id)?.label ?? id;
    const big = links.reduce((m, l) => (isNum(l.value) && (!m || l.value > m.value) ? l : m), null); const unit = unitText ? ` ${unitText}` : '';
    return `${KN.sankey[ar ? 0 : 1]}: ${b.title ? `${b.title}. ` : ''}${ar ? `${nodes.length} عقدة و${links.length} تدفقاً${big ? `؛ الأكبر: من ${name(big.from)} إلى ${name(big.to)} ${cu.tick(big.value)}${unit}` : ''}.` : `${nodes.length} nodes, ${links.length} flows${big ? `; largest: ${name(big.from)} → ${name(big.to)} ${cu.tick(big.value)}${unit}` : ''}.`}`;
  },
  table: (b, lang) => {
    const ar = lang === 'ar'; const nodes = b.nodes || []; const name = (id) => String(nodes.find((n) => n.id === id)?.label ?? id); const plain = !!b.plain;
    return { headers: [ar ? 'من' : 'From', ar ? 'إلى' : 'To', plain ? (b.valueTitle || (ar ? 'القيمة' : 'Value')) : (ar ? 'المبلغ (ريال)' : 'Amount (SAR)')], rows: (b.links || []).map((l) => [name(l.from), name(l.to), plain ? (l.value == null ? '—' : plainNum(l.value)) : exactNum(l.value)]) };
  }
});

// ---------- shared drawing helpers ----------
const tipAmt = (c, v) => (c.info.plain ? c.cu.fmt(v) : `${c.cu.fmt(v)} (${fmtSar(v, c.lang)})`);
function refuse(c, code, ar, en) { // the «No data» drawing (never a wrong chart) with the reason underneath
  const L = (c.ar ? ar : en) || ''; const wr = wrapText(L, Math.max(20, Math.floor((c.w - 24) / 6.4)), 2).lines.filter(Boolean);
  const body = `<text x="${c.w / 2}" y="62" text-anchor="middle" font-size="14" fill="${MUTE}" font-family="${c.font}">${c.ar ? 'لا بيانات' : 'No data'}</text>${wr.map((ln, k) => `<text x="${c.w / 2}" y="${86 + k * 16}" text-anchor="middle" font-size="11.5" fill="${MUTE}" font-family="${c.font}"${c.ar ? ' direction="rtl"' : ''}>${esc(ln)}</text>`).join('')}`;
  return fin(c, 140 + (wr.length > 1 ? 16 : 0), body, ` data-refused="${code}"`);
}
const REASON = {
  negative: ['قيم سالبة — لا يصلح هذا النوع من المخططات', 'Negative values — this chart type cannot show them'],
  sum: ['المجموع لا يساوي مجموع الأجزاء — لم يُرسم المخطط', 'A total does not equal the sum of its parts — not drawn'],
  missing: ['قيمة غير متوفرة — لم يُرسم المخطط', 'A value is missing — not drawn'],
  imbalance: ['التدفق لا يتطابق عند إحدى العقد — لم يُرسم المخطط', 'The flow does not reconcile at a node — not drawn'],
  zero: ['', ''], empty: ['', ''], flat: ['لا مستوى تحت الإجمالي — لا شيء لعرضه', 'No level below the total — nothing to show']
};
const why = (code) => REASON[code] || ['البيانات لا تصلح لهذا المخطط', 'The data does not fit this chart'];

// ring sector path in logical coordinates (mirrored for Arabic)
function sector(c, cx, cy, r0, r1, a0, a1) {
  const { w, ar } = c; const P = (r, a) => `${f(ar ? w - (cx + r * Math.cos(a)) : cx + r * Math.cos(a))},${f(cy + r * Math.sin(a))}`; const sw = ar ? 0 : 1;
  if (a1 - a0 >= TAU - 1e-6) return `M${P(r1, a0)} A${r1},${r1} 0 1 ${sw} ${P(r1, a0 + Math.PI)} A${r1},${r1} 0 1 ${sw} ${P(r1, a0 + TAU)} Z M${P(r0, a0)} A${r0},${r0} 0 1 ${1 - sw} ${P(r0, a0 + Math.PI)} A${r0},${r0} 0 1 ${1 - sw} ${P(r0, a0 + TAU)} Z`;
  const big = a1 - a0 > Math.PI ? 1 : 0; return `M${P(r1, a0)} A${r1},${r1} 0 ${big} ${sw} ${P(r1, a1)} L${P(r0, a1)} A${r0},${r0} 0 ${big} ${1 - sw} ${P(r0, a0)} Z`;
}
// legend as a vertical list: swatch · name (cut, full text in the tooltip) · amount · share.  items: [{label, title, color, hollow, val}]
function legendList(c, items, x, y0, W, rowH = 26, max = 16) {
  const shown = items.slice(0, max); const vw = Math.max(...shown.map((it) => tw(it.val, 12.5)), 0) + 6; const nameChars = Math.max(5, Math.floor((W - 20 - vw - 8) / 6.2)); let out = '';
  shown.forEach((it, k) => {
    const y = y0 + k * rowH + 16; const nm = cutStr(it.label, nameChars);
    out += (it.hollow ? c.rect(x, y - 11, 12, 12, '#fff', { stroke: AXIS, sw: 1.2, rx: 2 }) : c.rect(x, y - 11, 12, 12, it.color, { rx: 2 })) + c.text(x + 18, y, nm.s, { size: 12.5, title: nm.cut || it.title ? (it.title || it.label) : null }) + c.num(x + W, y, it.val, { size: 12.5, align: 'e', fill: INK, weight: 500 });
  });
  const more = items.length - shown.length; if (more > 0) out += c.text(x + 18, y0 + shown.length * rowH + 16, c.ar ? `+ ${more} أخرى في الجدول` : `+ ${more} more in the table`, { size: 12, fill: MUTE });
  return { h: (shown.length + (more > 0 ? 1 : 0)) * rowH + 4, svg: out };
}
// legend as wrapping rows (several per line), own band below the plot
function legendFlow(c, items, maxW) {
  const rows = []; let cur = []; let x = 0;
  items.forEach((it) => { const lab = cutStr(it.label, 44); const wd = 24 + tw(lab.s, 11.5) + 14; if (x + wd > maxW && cur.length) { rows.push(cur); cur = []; x = 0; } cur.push({ ...it, lab, x }); x += wd; });
  if (cur.length) rows.push(cur);
  return { h: rows.length ? rows.length * 20 + 8 : 0, draw: (y0) => rows.map((row, r) => row.map((it) => { const y = y0 + r * 20 + 10; const x = 14 + it.x; return c.rect(x, y - 10, 12, 12, it.color, { rx: 2 }) + c.text(x + 18, y, it.lab.s, { size: 11.5, title: it.lab.cut || it.title ? (it.title || it.label) : null }); }).join('')).join('') };
}
function notePlan(c, notes) {
  const maxChars = Math.max(24, Math.floor((c.w - 24) / 6.1)); const lines = notes.filter(Boolean).flatMap((n) => wrapText(n, maxChars, 3).lines);
  return { h: lines.length ? lines.length * 15 + 8 : 0, draw: (y0) => lines.map((ln, k) => c.text(8, y0 + 12 + k * 15, ln, { size: 11, fill: MUTE })).join('') };
}

// ---------- donut ----------
function donut(c) {
  const { b, w, ar, o } = c; const L = T(c.lang);
  if (!b.series?.[0] || !Array.isArray(b.series[0].values) || !b.series[0].values.length) return refuse(c, 'empty');
  if (b.series[0].values.some((v) => isNum(v) && v < 0)) return refuse(c, 'negative', ...why('negative'));
  const m = donutModel(b); if (!(m.total > 0)) return refuse(c, 'zero');
  const other = b.otherLabel || L('أخرى', 'Other');
  let slices = m.pos.map((p) => ({ ...p })); // at most 8 slices: the 7 largest + one explicit «Other» (the summed remainder, labelled; its members are in the tooltip and the table)
  if (m.pos.length > 8) { const tail = m.pos.slice(7); slices = [...m.pos.slice(0, 7), { i: null, label: other, v: tail.reduce((t, p) => t + p.v, 0), other: true, members: tail }]; }
  const col = (sl, k) => (sl.other ? OTHER_COL : HPAL[k % HPAL.length]);
  const narrow = w < 520; const legend = showG(b); const R = narrow ? Math.min(100, (w - 40) / 2) : Math.min(120, Math.max(80, w * 0.17)); const r0 = R * 0.62;
  const nRows = Math.min(16, slices.length + m.rest.length) + (slices.length + m.rest.length > 16 ? 1 : 0); const rowH = 26;
  let cx; let cy; let lx = 0; let ly = 0; let lw = 0; let H;
  if (!legend) { cx = w / 2; cy = 20 + R; H = 2 * R + 40; } else if (narrow) { cx = w / 2; cy = 20 + R; lx = 14; ly = 2 * R + 40; lw = w - 28; H = ly + nRows * rowH + 10; } else { lw = Math.min(320, w - 2 * R - 36 - 38); cx = Math.max(24, (w - (2 * R + 36 + lw)) / 2) + R; cy = 24 + R; lx = cx + R + 36; ly = Math.max(20, cy - (nRows * rowH) / 2); H = Math.max(2 * R + 48, ly + nRows * rowH + 14); }
  let out = ''; let a0 = -Math.PI / 2;
  slices.forEach((sl, k) => {
    const sweep = k === slices.length - 1 ? -Math.PI / 2 + TAU - a0 : (sl.v / m.total) * TAU; const a1 = a0 + sweep; const cl = col(sl, k);
    const tip = `${sl.label}${sl.other ? ` (${sl.members.length} ${L('بنود', 'items')}: ${sl.members.slice(0, 6).map((p) => p.label).join(L('، ', ', '))}${sl.members.length > 6 ? '…' : ''})` : ''}: ${tipAmt(c, sl.v)} · ${pct(sl.v, m.total)}`;
    out += `<path d="${sector(c, cx, cy, r0, R, a0, a1)}" fill="${cl}" fill-rule="evenodd" stroke="#fff" stroke-width="1.5" data-sweep="${sweep.toFixed(6)}"${c.dat({ d: sl.other ? { k: 'other', key: '__other', act: false } : { k: 'slice', i: sl.i }, title: tip })}><title>${esc(tip)}</title></path>`;
    const am = a0 + sweep / 2; const rm = (r0 + R) / 2; const txt = pct(sl.v, m.total);
    if (showL(b) && slices.length > 1 && rm * sweep >= tw(txt, 11) + 10) out += noMouse(c.num(cx + rm * Math.cos(am), cy + rm * Math.sin(am) + 4, txt, { size: 11, align: 'm', fill: onColor(cl), weight: 600 }));
    a0 = a1;
  });
  const cuT = c.info.unitText; const innerW = r0 * 2 - 12; const tot = c.cu.tick(m.total);
  out += c.num(cx, cy + (cuT ? 0 : 6), tot, { size: tw(tot, 22) > innerW ? 16 : 22, align: 'm', weight: 700, title: tipAmt(c, m.total) });
  out += c.text(cx, cy - (cuT ? 24 : 18), L('الإجمالي', 'Total'), { size: 10.5, align: 'm', fill: MUTE });
  if (cuT) out += c.text(cx, cy + 18, cutStr(cuT, Math.floor(innerW / 5.8)).s, { size: 10.5, align: 'm', fill: MUTE, title: cuT });
  if (legend) {
    const items = [...slices.map((sl, k) => ({ label: sl.label, title: sl.other ? `${sl.label}: ${sl.members.map((p) => p.label).join(L('، ', ', '))}` : null, color: col(sl, k), val: `${c.cu.tick(sl.v)} · ${pct(sl.v, m.total)}` })),
      ...m.rest.map((p) => ({ label: p.label, hollow: true, val: p.v == null ? '—' : `0 · ${pct(0, m.total)}` }))];
    out += legendList(c, items, lx, ly, lw, rowH).svg;
  }
  return fin(c, o.h && o.h > H ? o.h : H, out);
}

// ---------- tree tooltips (breadcrumb) ----------
function nodeTip(c, rows, e, total) {
  const L = T(c.lang); const par = e.parent >= 0 ? rows[e.parent] : null; const crumb = e.depth ? e.path.join(' › ') : (e.label || L('الإجمالي', 'Total'));
  return `${crumb}: ${tipAmt(c, e.value)}${par && par.depth > 0 ? ` · ${pct(e.value, par.value)} ${L('من المستوى الأعلى', 'of parent')}` : ''} · ${pct(e.value, total)} ${L('من الإجمالي', 'of total')}`;
}
const hook = (e, k) => ({ k, i: e.index, j: e.depth, key: e.key != null ? e.key : (e.depth ? e.path.join(' › ') : '__root') });
function treePrep(c) {
  const { b } = c; const L = T(c.lang); const src = treeSource(b);
  if (!src.tree) return { err: refuse(c, 'empty') };
  const prob = treeProblem(src.tree, isNum(b.tol) ? b.tol : 0.5);
  if (prob) return { err: refuse(c, prob.code === 'sum' ? 'not-additive' : prob.code, ...why(prob.code)) };
  const rows = flattenTree(src.tree); const total = rows[0].value; if (!(total > 0)) return { err: refuse(c, 'zero') };
  return { rows, total, missing: src.missing, L };
}
const topOf = (rows, e) => { let k = e; while (k.parent > 0) k = rows[k.parent]; return k; }; // the level-1 ancestor (a root-only tree: the root itself)

// ---------- treemap (squarified, nested) ----------
function squarify(items, x, y, w, h) {
  const out = []; let rest = items.slice(); const worst = (row, s, side) => Math.max(...row.map((r) => Math.max((side * side * r.area) / (s * s), (s * s) / (side * side * r.area))));
  while (rest.length && w > 0 && h > 0) {
    const side = Math.min(w, h); let row = []; let s = 0; let best = Infinity;
    for (let i = 0; i < rest.length; i += 1) { const cand = [...row, rest[i]]; const cs = s + rest[i].area; const wr = worst(cand, cs, side); if (row.length && wr > best) break; row = cand; s = cs; best = wr; }
    rest = rest.slice(row.length);
    if (w >= h) { const cw = s / h; let yy = y; row.forEach((it) => { const hh = it.area / cw; out.push({ idx: it.idx, x, y: yy, w: cw, h: hh }); yy += hh; }); x += cw; w -= cw; } else { const rh = s / w; let xx = x; row.forEach((it) => { const ww = it.area / rh; out.push({ idx: it.idx, x: xx, y, w: ww, h: rh }); xx += ww; }); y += rh; h -= rh; }
  }
  return out;
}
export function treemapLayout(rows, W, H) { // exported for the tests: boxes in pre-order [{idx, x, y, w, h, group, hdr}]
  const boxes = [];
  const place = (idx, x, y, w, h) => {
    const e = rows[idx]; const kids = e.children.filter((k) => rows[k].value > 0).sort((p, q) => rows[q].value - rows[p].value || p - q); const box = { idx, x, y, w, h, group: kids.length > 0, hdr: 0 }; boxes.push(box);
    if (!kids.length) return;
    let ix = x; let iy = y; let iw = w; let ih = h;
    if (idx !== 0) { const pad = w >= 20 && h >= 20 ? 2 : 0; box.hdr = w >= 64 && h >= 44 ? 16 : 0; ix = x + pad; iw = w - 2 * pad; iy = y + (box.hdr || pad); ih = h - (box.hdr || pad) - pad; }
    const sum = kids.reduce((t, k) => t + rows[k].value, 0);
    squarify(kids.map((k) => ({ idx: k, area: (rows[k].value / sum) * iw * ih })), ix, iy, iw, ih).forEach((r) => place(r.idx, r.x, r.y, r.w, r.h));
  };
  place(0, 0, 0, W, H); return boxes;
}
function treemap(c) {
  const P = treePrep(c); if (P.err) return P.err; const { rows, total, missing, L } = P; const { b, w, o } = c;
  const maxD = rows.reduce((m, e) => Math.max(m, e.depth), 0); const leaves = rows.filter((e) => e.leaf && e.value > 0); const zeros = rows.filter((e) => e.leaf && e.depth > 0 && e.value === 0);
  const mode = b.colorBy === 'value' || b.colorBy === 'group' ? b.colorBy : (maxD >= 2 ? 'group' : 'value'); const tops = rows[0].children; const colOfTop = new Map(tops.map((i, k) => [i, HPAL[k % HPAL.length]]));
  const vals = leaves.map((e) => e.value); const vmin = Math.min(...vals); const vmax = Math.max(...vals);
  const leafFill = (e, k) => { if (mode === 'value') return rampAt(vmax === vmin ? 0.6 : 0.12 + 0.82 * ((e.value - vmin) / (vmax - vmin))); const base = colOfTop.get(topOf(rows, e).index) || HPAL[0]; return k % 2 ? mix(base, '#ffffff', 0.16) : base; };
  const narrow = w < 520; const nL = leaves.length; const plotNat = Math.min(540, (narrow ? Math.min(400, Math.max(280, w * 0.95)) : Math.min(470, Math.max(280, w * 0.52))) + (nL > 20 ? Math.min(120, (nL - 20) * 2.5) : 0));
  const notes = [zeros.length ? L(`${zeros.length} بنداً قيمته صفر لا يُرسم ويظهر في الجدول.`, `${zeros.length} item(s) equal to zero are not drawn; they are in the table.`) : '', missing.length ? L(`${missing.length} بنداً بلا بيانات (ليس صفراً): ${missing.slice(0, 4).map((x) => x.label).join('، ')}`, `${missing.length} item(s) without data (not zero): ${missing.slice(0, 4).map((x) => x.label).join(', ')}`) : ''];
  const np = notePlan(c, notes); const top = 30;
  let lg = { h: 0, draw: () => '' };
  if (showG(b)) {
    if (mode === 'group' && tops.length) lg = legendFlow(c, tops.map((i) => ({ label: `${rows[i].label} — ${drawKit.iso(`${c.cu.tick(rows[i].value)} (${pct(rows[i].value, total)})`)}`, title: rows[i].label, color: colOfTop.get(i) })), w - 28);
    else if (mode === 'value') lg = { h: 40, draw: (y0) => { const lw2 = Math.min(180, w - 28); const id = `tg${drawKit.hash(`${b.title}|${nL}`)}`; return `<defs><linearGradient id="${id}" x1="${c.ar ? 1 : 0}" y1="0" x2="${c.ar ? 0 : 1}" y2="0">${[0, 0.5, 1].map((t) => `<stop offset="${t}" stop-color="${rampAt(0.12 + 0.82 * t)}"/>`).join('')}</linearGradient></defs><rect x="${f(c.ar ? w - 14 - lw2 : 14)}" y="${y0 + 4}" width="${lw2}" height="10" fill="url(#${id})" stroke="${AXIS}" stroke-width=".6"/>${c.num(14, y0 + 28, c.cu.tick(vmin), { size: 11, align: 's', fill: MUTE })}${c.num(14 + lw2, y0 + 28, c.cu.tick(vmax), { size: 11, align: 'e', fill: MUTE })}`; } };
  }
  const fixed = top + lg.h + np.h + 14; const ph = c.height(fixed, plotNat); const px0 = 8; const pw = w - 16; const boxes = treemapLayout(rows, pw, ph);
  let out = unitHead(c) + c.text(w - 6, 15, `${L('الإجمالي', 'Total')} ${c.cu.tick(total)}`, { size: 11.5, fill: MUTE, align: 'e', weight: 600, title: tipAmt(c, total) });
  const gy = (y) => top + y; let k = 0;
  boxes.forEach((bx) => {
    if (bx.idx === 0 && bx.group) return; const e = rows[bx.idx]; const x = px0 + bx.x; const y = gy(bx.y); const tip = nodeTip(c, rows, e, total);
    if (bx.group) {
      const base = colOfTop.get(topOf(rows, e).index) || HPAL[0]; const gf = mode === 'group' ? mix(base, '#ffffff', 0.86) : '#F8FAFC';
      out += c.rect(x, y, bx.w, bx.h, gf, { stroke: mode === 'group' ? base : AXIS, sw: e.depth === 1 ? 1.6 : 1, title: tip, d: hook(e, 'group') });
      if (bx.hdr) { const sh = pct(e.value, total); const full = `${e.label} · ${sh}`; const maxC = Math.floor((bx.w - 10) / 6.1); const lab = full.length <= maxC ? full : cutStr(e.label, maxC).s; out += noMouse(c.text(x + 5, y + 12, lab, { size: 11, weight: 600, fill: INK, title: lab !== full ? full : null })); }
      return;
    }
    const fill = leafFill(e, k); k += 1; out += c.rect(x, y, bx.w, bx.h, fill, { stroke: '#fff', sw: 1.2, title: tip, d: hook(e, 'leaf') });
    if (showL(b) && bx.w >= 36 && bx.h >= 18) {
      const maxC = Math.floor((bx.w - 8) / 5.9); const wantShare = bx.h >= 32 && bx.w >= 38; const maxLines = Math.max(1, Math.floor((bx.h - 8) / 12.5) - (wantShare ? 1 : 0));
      if (maxC >= 4) { const wr = wrapText(e.label, maxC, Math.min(3, maxLines)); const fg = onColor(fill); let yy = y + 13; wr.lines.forEach((ln) => { out += noMouse(c.text(x + 4, yy, ln, { size: 10.5, fill: fg, weight: 600 })); yy += 12.5; }); if (wantShare) out += noMouse(c.num(x + 4, yy, pct(e.value, total), { size: 10.5, fill: fg })); }
    }
  });
  return fin(c, o.h && o.h > top + ph + lg.h + np.h + 14 ? o.h : top + ph + lg.h + np.h + 14, out + lg.draw(top + ph + 8) + np.draw(top + ph + 8 + lg.h));
}

// ---------- sunburst ----------
function sunburst(c) {
  const P = treePrep(c); if (P.err) return P.err; const { rows, total, L } = P; const { b, w, o } = c;
  const maxD = treeDepth(b.tree); if (maxD < 1) return refuse(c, 'flat', ...why('flat'));
  const rings = Math.min(3, maxD); const tops = rows[0].children; const colOfTop = new Map(tops.map((i, k) => [i, HPAL[k % HPAL.length]]));
  const narrow = w < 600; const legend = showG(b); const R = narrow ? Math.min(165, (w - 28) / 2) : 165; const r0 = Math.max(36, R * 0.25); const th = (R - r0) / rings;
  const groups = tops.map((i) => rows[i]); const nRows = Math.min(16, groups.length) + (groups.length > 16 ? 1 : 0); const rowH = 26;
  let cx; let cy; let lx = 0; let ly = 0; let lw = 0; let H;
  if (!legend) { cx = w / 2; cy = 18 + R; H = 2 * R + 36; } else if (narrow) { cx = w / 2; cy = 18 + R; lx = 14; lw = w - 28; ly = 2 * R + 36; H = ly + nRows * rowH + 10; } else { lw = Math.min(320, w - 2 * R - 40 - 34); cx = Math.max(20, (w - (2 * R + 40 + lw)) / 2) + R; cy = 18 + R; lx = cx + R + 40; ly = Math.max(18, cy - (nRows * rowH) / 2); H = Math.max(2 * R + 36, ly + nRows * rowH + 10); }
  const notes = [maxD > 3 ? L('الطبقات تحت الحلقة الثالثة تظهر في الجدول فقط.', 'Levels below the third ring appear in the table only.') : '']; const np = notePlan(c, notes); let out = '';
  const inside = (x, y, a0, a1, ra, rb) => { const dx = x - cx; const dy = y - cy; const r = Math.hypot(dx, dy); if (r < ra || r > rb) return false; let d = Math.atan2(dy, dx) - a0; while (d < 0) d += TAU; while (d >= TAU) d -= TAU; return a1 - a0 >= TAU - 1e-6 || d <= a1 - a0; };
  const draw = (idx, a0, a1) => {
    const e = rows[idx]; const kids = e.children.filter((k) => rows[k].value > 0).sort((p, q) => rows[q].value - rows[p].value || p - q); let a = a0; const sk = kids.reduce((t, k2) => t + rows[k2].value, 0);
    kids.forEach((ki, n) => {
      const ch = rows[ki]; if (ch.depth > rings) return; const sweep = n === kids.length - 1 ? a1 - a : (ch.value / sk) * (a1 - a0); const b1 = a + sweep;
      const ra = r0 + (ch.depth - 1) * th; const rb = ra + th; const base = colOfTop.get(topOf(rows, ch).index) || HPAL[0]; const fill = mix(base, '#ffffff', [0, 0.28, 0.5][ch.depth - 1]); const tip = nodeTip(c, rows, ch, total);
      out += `<path d="${sector(c, cx, cy, ra, rb, a, b1)}" fill="${fill}" fill-rule="evenodd" stroke="#fff" stroke-width="1.2" data-sweep="${sweep.toFixed(6)}" data-ring="${ch.depth}"${c.dat({ d: hook(ch, 'slice'), title: tip })}><title>${esc(tip)}</title></path>`;
      if (showL(b)) { // a label only where its box lies inside the slice: name, shorter name, then the share
        const am = a + sweep / 2; const rm = (ra + rb) / 2; const mx = cx + rm * Math.cos(am); const my = cy + rm * Math.sin(am);
        const cands = [cutStr(ch.label, 16).s, pct(ch.value, total)].filter((s, q, arr) => s && arr.indexOf(s) === q);
        for (const s of cands) { const bw = tw(s, 10.5) + 4; const bh = 12; if ([[-1, -1], [1, -1], [-1, 1], [1, 1]].every(([sx, sy]) => inside(mx + (sx * bw) / 2, my + (sy * bh) / 2, a, b1, ra + 0.5, rb - 0.5))) { out += noMouse(c.text(mx, my + 4, s, { size: 10.5, align: 'm', fill: onColor(fill), weight: 600 })); break; } }
      }
      draw(ki, a, b1); a = b1;
    });
  };
  draw(0, -Math.PI / 2, -Math.PI / 2 + TAU);
  const tot = c.cu.tick(total); const iw = r0 * 2 - 10;
  out += c.num(cx, cy + (c.info.unitText ? 2 : 6), tot, { size: tw(tot, 16) > iw ? 12 : 16, align: 'm', weight: 700, title: `${rows[0].label || L('الإجمالي', 'Total')}: ${tipAmt(c, total)}` });
  if (c.info.unitText) out += c.text(cx, cy + 17, cutStr(c.info.unitText, Math.floor(iw / 5.6)).s, { size: 10, align: 'm', fill: MUTE, title: c.info.unitText });
  if (legend) out += legendList(c, groups.map((g) => ({ label: g.label, color: colOfTop.get(g.index), val: `${c.cu.tick(g.value)} · ${pct(g.value, total)}` })), lx, ly, lw, rowH).svg;
  const Hn = H + np.h; return fin(c, o.h && o.h > Hn ? o.h : Hn, out + np.draw(H));
}

// ---------- sankey ----------
function sankey(c) {
  const { b, w, ar, o } = c; const L = T(c.lang); const nodes = b.nodes; const links = b.links;
  const prob = sankeyProblem(nodes, links, isNum(b.tol) ? b.tol : 0.5); if (prob) return refuse(c, prob.code === 'imbalance' ? 'not-reconciled' : prob.code, ...(prob.code === 'imbalance' ? why('imbalance') : why(prob.code === 'negative' ? 'negative' : prob.code === 'missing' ? 'missing' : 'x')));
  const colMap = sankeyColumns(nodes, links); const colIds = [...new Set(nodes.map((n) => colMap.get(n.id)))].sort((p, q) => p - q);
  const ns = nodes.map((n, i) => ({ ...n, i, ci: colIds.indexOf(colMap.get(n.id)), inV: 0, outV: 0 }));
  const byId = new Map(ns.map((n) => [n.id, n])); const ls = links.map((l, i) => ({ ...l, i, s: byId.get(l.from), t: byId.get(l.to) }));
  ls.forEach((l) => { l.s.outV += l.value; l.t.inV += l.value; }); ns.forEach((n) => { n.value = Math.max(n.inV, n.outV); n.color = ROLE[n.role] || HPAL[n.i % HPAL.length]; });
  const drawn = ns.filter((n) => n.value > 0); if (!drawn.length) return refuse(c, 'zero'); const nc = colIds.length;
  const cols = colIds.map((_, ci) => drawn.filter((n) => n.ci === ci)); const dl = ls.filter((l) => l.value > 0);
  // order inside each column: barycentre sweeps (stable: ties keep the previous order)
  const frac = (n) => (n.pos + 0.5) / cols[n.ci].length; cols.forEach((col) => col.forEach((n, q) => { n.pos = q; }));
  const sweep = (ci, dir) => { const col = cols[ci]; const key = new Map(col.map((n) => { const ls2 = dl.filter((l) => (dir > 0 ? l.t === n : l.s === n)); const sw = ls2.reduce((t, l) => t + l.value, 0); return [n, sw ? ls2.reduce((t, l) => t + frac(dir > 0 ? l.s : l.t) * l.value, 0) / sw : frac(n)]; })); col.sort((p, q) => key.get(p) - key.get(q) || p.pos - q.pos); col.forEach((n, q) => { n.pos = q; }); };
  for (let it = 0; it < 4; it += 1) { for (let ci = 1; ci < nc; ci += 1) sweep(ci, 1); for (let ci = nc - 2; ci >= 0; ci -= 1) sweep(ci, -1); }
  // geometry
  const narrow = w < 520; const nodeW = narrow ? 10 : 14; const top = 32; const maxCnt = Math.max(...cols.map((q) => q.length)); const gap = maxCnt > 12 ? 3 : 12; const MINH = 4; const MINW = 1.5;
  const maxLab = (ci) => Math.max(0, ...cols[ci].map((n) => Math.min(24, String(n.label).length))); const labW = (ci) => Math.min(w * 0.3, Math.max(64, maxLab(ci) * 6.7 + 26));
  const ML = labW(0); const MR = labW(nc - 1); const step = (w - ML - MR - nodeW) / Math.max(1, nc - 1); const X = (ci) => ML + ci * step;
  const notes = [ns.filter((n) => n.value === 0).length ? L(`${ns.filter((n) => n.value === 0).length} عقدة قيمتها صفر لا تُرسم وتظهر في الجدول.`, `${ns.filter((n) => n.value === 0).length} zero-value node(s) are not drawn; flows are in the table.`) : '']; const np = notePlan(c, notes);
  const plotNat = Math.max(Math.min(520, Math.max(230, maxCnt * 44 + 30)), maxCnt * (MINH + gap) + 20); const ph = c.height(top + np.h + 14, plotNat);
  const thick = (l, ky) => Math.max(MINW, l.value * ky);
  const nodeH = (n, ky) => Math.max(MINH, n.value * ky, dl.filter((l) => l.s === n).reduce((t, l) => t + thick(l, ky), 0), dl.filter((l) => l.t === n).reduce((t, l) => t + thick(l, ky), 0));
  const feasible = (ky) => cols.every((col) => col.reduce((t, n) => t + nodeH(n, ky), 0) + gap * (col.length - 1) <= ph);
  let lo = 0; let hi = ph / Math.max(1e-9, Math.max(...cols.map((col) => col.reduce((t, n) => t + n.value, 0)))); for (let it = 0; it < 48; it += 1) { const mid = (lo + hi) / 2; if (feasible(mid)) lo = mid; else hi = mid; } const ky = lo;
  cols.forEach((col) => { col.forEach((n) => { n.h = nodeH(n, ky); }); const colH = col.reduce((t, n) => t + n.h, 0) + gap * (col.length - 1); let y = (ph - colH) / 2; col.forEach((n) => { n.y = Math.max(0, y); y = n.y + n.h + gap; }); });
  const settle = (col) => { let y = 0; col.forEach((n) => { if (n.y < y) n.y = y; y = n.y + n.h + gap; }); let yb = ph; for (let q = col.length - 1; q >= 0; q -= 1) { const n = col[q]; if (n.y + n.h > yb) n.y = yb - n.h; yb = n.y - gap; } };
  for (let it = 0; it < 8; it += 1) {
    for (let ci = 1; ci < nc; ci += 1) { cols[ci].forEach((n) => { const ins = dl.filter((l) => l.t === n); const sw = ins.reduce((t, l) => t + l.value, 0); if (sw) n.y += (ins.reduce((t, l) => t + (l.s.y + l.s.h / 2) * l.value, 0) / sw - (n.y + n.h / 2)) * 0.6; }); settle(cols[ci]); }
    for (let ci = nc - 2; ci >= 0; ci -= 1) { cols[ci].forEach((n) => { const outs = dl.filter((l) => l.s === n); const sw = outs.reduce((t, l) => t + l.value, 0); if (sw) n.y += (outs.reduce((t, l) => t + (l.t.y + l.t.h / 2) * l.value, 0) / sw - (n.y + n.h / 2)) * 0.6; }); settle(cols[ci]); }
  }
  dl.forEach((l) => { l.th = thick(l, ky); });
  drawn.forEach((n) => { let oy = 0; dl.filter((l) => l.s === n).sort((p, q) => (p.t.y + p.t.h / 2) - (q.t.y + q.t.h / 2) || p.i - q.i).forEach((l) => { l.sy = n.y + oy; oy += l.th; }); let iy = 0; dl.filter((l) => l.t === n).sort((p, q) => (p.s.y + p.s.h / 2) - (q.s.y + q.s.h / 2) || p.i - q.i).forEach((l) => { l.ty = n.y + iy; iy += l.th; }); });
  const mxp = (x) => (ar ? w - x : x); let out = unitHead(c);
  dl.forEach((l) => {
    const x0 = X(l.s.ci) + nodeW; const x1 = X(l.t.ci); const xm = (x0 + x1) / 2; const sy = top + l.sy; const ty = top + l.ty; const th = l.th; const fromT = l.s.label; const toT = l.t.label;
    const tip = `${L(`من ${fromT} إلى ${toT}`, `${fromT} → ${toT}`)}: ${tipAmt(c, l.value)} · ${pct(l.value, l.s.outV)} ${L('من تدفق المصدر', 'of the source outflow')} · ${pct(l.value, l.t.inV)} ${L('من وارد الوجهة', 'of the target inflow')}`;
    const d = `M${f(mxp(x0))},${f(sy)} C${f(mxp(xm))},${f(sy)} ${f(mxp(xm))},${f(ty)} ${f(mxp(x1))},${f(ty)} L${f(mxp(x1))},${f(ty + th)} C${f(mxp(xm))},${f(ty + th)} ${f(mxp(xm))},${f(sy + th)} ${f(mxp(x0))},${f(sy + th)} Z`;
    out += `<path d="${d}" fill="${l.t.color}" fill-opacity="0.34" stroke="${l.t.color}" stroke-opacity="0.5" stroke-width="0.5" data-v="${l.value}" data-w="${th.toFixed(3)}"${l.value * ky < MINW ? ' data-min="1"' : ''}${c.dat({ d: { k: 'link', i: l.i, key: `${l.from}>${l.to}` }, title: tip })}><title>${esc(tip)}</title></path>`;
  });
  const blocks = [];
  drawn.forEach((n) => {
    const x = X(n.ci); const tip = `${n.label}: ${tipAmt(c, n.value)}${n.inV && n.outV ? ` · ${L('الوارد', 'in')} ${c.cu.tick(n.inV)} = ${L('الصادر', 'out')} ${c.cu.tick(n.outV)}` : ''}`;
    out += c.rect(x, top + n.y, nodeW, n.h, n.color, { title: tip, d: { k: 'node', i: n.i, key: String(n.id) } });
    if (!showL(b)) return;
    const edgeL = n.ci === 0; const room = edgeL ? ML - 12 : n.ci === nc - 1 ? MR - 12 : Math.max(60, step - nodeW - 10); const maxC = Math.max(5, Math.floor(room / 6.7)); const amt = c.cu.tick(n.value);
    let lines; let one = null; if (n.h >= 30) lines = [...wrapText(n.label, maxC, 2).lines, amt]; else { one = cutStr(n.label, Math.max(4, maxC - amt.length - 2)).s; lines = [one]; }
    blocks.push({ n, lines, one, amt, edgeL, x, cy: top + n.y + n.h / 2, hh: lines.length * 13, tip, ci: n.ci });
  });
  cols.forEach((_, ci) => { const bl = blocks.filter((q) => q.ci === ci).sort((p, q) => p.cy - q.cy); let prev = -Infinity; bl.forEach((q) => { const t0 = Math.max(q.cy - q.hh / 2, prev + 2); q.y0 = t0; prev = t0 + q.hh; }); const over = (bl.length ? bl[bl.length - 1].y0 + bl[bl.length - 1].hh : 0) - (top + ph); if (over > 0) bl.forEach((q) => { q.y0 -= over; }); });
  blocks.forEach((q) => {
    const lastCol = q.ci === nc - 1; const ax = q.edgeL ? q.x - 6 : q.x + nodeW + 6; const mid = !q.edgeL && !lastCol;
    if (q.one != null) { // one line: the name, then the amount as its own left-to-right run (mixed Arabic + digits in one string would scramble)
      const nw = tw(q.one, 11.5) + 6; const t1 = c.text(ax, q.y0 + 11, q.one, { size: 11.5, weight: 500, align: q.edgeL ? 'e' : 's' }); const t2 = c.num(q.edgeL ? ax - nw : ax + nw, q.y0 + 11, q.amt, { size: 11, weight: 700, align: q.edgeL ? 'e' : 's' });
      out += mid ? halo(t1) + halo(t2) : noMouse(t1) + noMouse(t2); return;
    }
    q.lines.forEach((ln, k) => { const isAmt = k === q.lines.length - 1 && q.lines.length > 1; const t = c.text(ax, q.y0 + 11 + k * 13, ln, { size: isAmt ? 11 : 11.5, weight: isAmt ? 700 : 500, align: q.edgeL ? 'e' : 's', num: isAmt, title: null }); out += mid ? halo(t) : noMouse(t); });
  });
  const H = top + ph + np.h + 14; return fin(c, o.h && o.h > H ? o.h : H, out + np.draw(top + ph + 6));
}

registerDraw('donut', donut); registerDraw('treemap', treemap); registerDraw('sunburst', sunburst); registerDraw('sankey', sankey);
