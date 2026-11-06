// Decides WHAT goes on which slide of the PowerPoint deck. The MAIN deck is concise and findings-focused:
//   title → executive summary (the indicators ONCE) → scope and basis → one slide per chart / finding (native chart + 1–3 evidence bullets) → key insights → recommendations / findings →
//   notes and limits → data and assumptions (provenance);
// then the APPENDIX (a divider, a contents slide and titled «Appendix A.n» tables): every table and every chart's data table in full, long tables continued with their header repeated, nothing dropped.
// The slide parts themselves (placeholders, text, cards, tables, chart frames) come from pptxTemplate.js; the native chart parts from pptxCharts.js.
import { tableToText, chartInfo, chartSummary, fillTokens, fmtEvidence } from '../data/reportFormat';
import { chartPlan } from './pptxCharts';
import { chartExportTable, isLegacyChart } from './chartExportData';
import { chartRender, DRAW_KINDS } from './chartKinds'; // also registers every chart-library kind into the shared renderer
import { evidenceNew } from './chartEvidence';
import { GEOM, Y0, YMAX, COLORS_T as COLORS, resetIds, textBox, richBox, parasHeight, tableFrame, tableRowHeights, layoutCols, chartFrame, pictureFrame, textHeight } from './pptxTemplate';

const TAIL = new Set(['recommendations', 'findings', 'forecast', 'assumptions']); // sections of text only: they become bullet slides, not chart / table slides
const MAIN_INSIGHTS = 6; // insights shown on the main slides; ALL of them (with figures, basis and caveat) are in the appendix
const pick = (o, lang) => (o == null ? '' : typeof o === 'string' ? o : (lang === 'ar' ? o.ar : o.en) || o.en || '');

/** model → { slides, title, subtitle, note } for assembleDeck.
 *  helpers: { ctxRows: [[label, value]…] (the report context incl. cut-off and preparation time), dataLine, stamp (version · generated · cut-off, or ''), relationsRows(block) → [[a, b]…] } */
export function planDeck({ model, helpers }) {
  resetIds();
  const lang = model.lang === 'ar' ? 'ar' : 'en'; const ar = lang === 'ar'; const L = (a, e) => (ar ? a : e); const g = GEOM(lang);
  const footer = [helpers.dataLine, helpers.stamp].filter(Boolean).join(' · ');
  const slides = [];
  const content = (title, o = {}) => { const s = { title, kicker: o.kicker || '', shapes: [], charts: [], pics: [], y: Y0, layout: 2, base: title, n: 1, ...o }; slides.push(s); return s; };
  const contSlide = (s) => content(`${s.base} ${L('(تابع)', '(cont.)')}`, { kicker: s.kicker, base: s.base, n: s.n + 1, appendix: s.appendix });
  const fresh = (s) => content(s.base, { kicker: s.kicker, base: s.base, appendix: s.appendix });
  const room = (s) => YMAX - s.y;
  const gap = 0.14;
  // in an Arabic line every number, percentage and date stays left-to-right (an isolate), so «33.7%» and «2026-01» never reverse
  const ltrNums = (t) => (ar ? String(t).replace(/[<>]?[-−+]?\d+(?:[.,:\-]\d+)*%?/g, (m) => `\u2066${m}\u2069`) : t);

  /* ---------------------------------------------------------------- the appendix list (numbered first, so the main slides can point to their data table) */
  const sections = model.sections || [];
  const appendix = []; // { no, section, sectionKey, title, headers, rows, note, weights, kind }
  const numOf = new Map(); const label = (n) => (ar ? `أ-${n}` : `A.${n}`);
  const addApp = (sec, block, e) => { const no = label(appendix.length + 1); appendix.push({ no, section: sec?.title || '', sectionKey: sec?.key || '', purpose: sec?.purpose || '', block, ...e }); if (block) numOf.set(block, no); return no; };
  const tableEntry = (b) => { const t = tableToText(b, lang); return { title: `${b.title}${t.unitText ? ` — ${L('المبالغ بوحدة', 'amounts in')}: ${t.unitText}` : ''}`, headers: t.headers, rows: t.total ? [...t.rows, t.total] : t.rows, note: b.note, ...(b.sz ? { sz: b.sz } : {}) }; }; // a model may ask for a smaller font (a table with 12-digit invoice numbers and long labels)
  const chartEntry = (b) => {
    if (!isLegacyChart(b)) { const t = chartExportTable(b, lang); return { title: t.unitText ? `${b.title} — ${L('المبالغ بوحدة', 'amounts in')}: ${t.unitText}` : b.title, headers: t.headers, rows: t.rows, note: '' }; } // chart-library kinds: the kind's own registered table
    const { unitText, cu } = chartInfo(b, lang); return { title: unitText ? `${b.title} — ${L('المبالغ بوحدة', 'amounts in')}: ${unitText}` : b.title, headers: [L('البند', 'Item'), ...b.series.map((s) => s.label)], rows: b.labels.map((lab, i) => [lab, ...b.series.map((s) => (s.values[i] == null ? '—' : String(cu.tick(s.values[i]))))]), note: b.kind === 'waterfall' ? L('قيم الخطوات بإشاراتها: الإجماليات مستويات مطلقة والباقي تغيّرات.', 'Step values with their signs: totals are absolute levels, the rest are changes.') : '' }; };
  const insightEntry = (b) => ({ title: b.title || L('الرؤى', 'Insights'), headers: [L('الرؤية', 'Insight'), L('الشرح', 'Detail'), L('الأرقام الداعمة', 'Supporting figures'), L('الأساس', 'Basis'), L('تحفظ', 'Caveat')], weights: [2.1, 3.4, 2.6, 2.3, 2.1], sz: 9,
    rows: b.items.map((it) => [pick(it.title, lang), fillTokens(pick(it.body, lang), it.tokens, lang), (it.evidence || []).map((e) => `${pick(e.k, lang)}: ${fmtEvidence(e, lang)}`).join(' · '), pick(it.basis, lang), pick(it.caveat, lang) || '—']) });
  const isMainTable = (b) => b.type === 'table' && (b.id === 'compare' || b.main === true); // the comparison, and a table a model marks `main` (the non-collection priorities)
  const isExec = (x) => x.key === 'executive' || x.key === 'nc_executive'; // the executive section of a report / of the non-collection analysis
  for (const sec of sections) {
    if (TAIL.has(sec.key)) continue;
    for (const b of sec.blocks) {
      if (b.type === 'table' && !isMainTable(b)) addApp(sec, b, { kind: 'table', ...tableEntry(b) });
      else if (b.type === 'chart' && b.kind !== 'heatmap') addApp(sec, b, { kind: 'chart', ...chartEntry(b) });
      else if (b.type === 'relations') addApp(sec, b, { kind: 'relations', title: L('العلاقات المالية', 'Financial relationships'), headers: [L('العلاقة', 'Relationship'), L('الصيغة', 'Formula')], rows: helpers.relationsRows(b), weights: [1.6, 5] });
      else if (b.type === 'insights') addApp(sec, b, { kind: 'insights', ...insightEntry(b) });
    }
  }

  /* ---------------------------------------------------------------- table placement with pagination by predicted height */
  // places one table (heading, rows with the header repeated on each continuation, note) on slide s; returns the slide it ended on
  function addTable(s, t, { sz: sz0 = 10, fills = null } = {}) {
    const sz = t.sz || (t.headers.length > 7 ? 9 : sz0); const hd = `${t.no ? `${t.no}  ` : ''}${t.title}`;
    const colW = layoutCols({ w: g.w, headers: t.headers, rows: t.rows, sz, weights: t.weights }); // ONE column layout for every part of a continued table
    const rh = tableRowHeights({ w: g.w, headers: t.headers, rows: t.rows, sz, colW }); const hdH = (txt) => Math.max(0.3, textHeight(txt, g.w, 12, 0.08));
    const full = hdH(hd) + rh.head + rh.rows.reduce((a, b) => a + b, 0); let idx = 0; let part = 0;
    if (full > room(s) && s.y > Y0 + 0.05 && full <= YMAX - Y0) s = fresh(s); // a table that fits one clean slide starts on a fresh one
    do {
      const heading = part === 0 ? hd : `${hd} ${L('(تابع)', '(cont.)')}`; const hh = hdH(heading);
      let avail = room(s) - hh - rh.head - 0.12; let take = 0; let used = 0;
      while (idx + take < t.rows.length && used + rh.rows[idx + take] <= avail) { used += rh.rows[idx + take]; take += 1; }
      if (t.rows.length - (idx + take) === 1 && take > 2) take -= 1; // never leave a lone last row (the total) on a slide of its own
      const need = Math.min(3, t.rows.length - idx);
      if (take < need && s.y > Y0 + 0.05) { s = contSlide(s); continue; }
      if (take < 1 && t.rows.length) take = 1;
      const slice = t.rows.slice(idx, idx + take);
      if (part === 0) t.slideRef = s;
      s.shapes.push(textBox({ x: g.x0, y: s.y, w: g.w, h: hh, text: heading, lang, sz: 12, b: true, color: COLORS.teal })); s.y += hh;
      const fr = tableFrame({ x: g.x0, y: s.y, w: g.w, headers: t.headers, rows: slice, lang, sz, colW, fills: fills ? (i, j) => fills(idx + i, j) : null, numCols: t.numCols });
      s.shapes.push(fr.xml); s.y += fr.h + gap; idx += take; part += 1;
      if (idx < t.rows.length) s = contSlide(s);
    } while (idx < t.rows.length);
    if (t.note) { const h = textHeight(t.note, g.w, 9.5, 0.06); if (room(s) < h + 0.05) s = contSlide(s); s.shapes.push(textBox({ x: g.x0, y: s.y, w: g.w, h, text: t.note, lang, sz: 9.5, i: true, color: COLORS.grey })); s.y += h + gap; }
    return s;
  }
  // bullets (paragraph list) placed with pagination
  function addParas(s, paras, { w = g.w, x = g.x0 } = {}) {
    let buf = []; let used = 0;
    const flush = () => { if (!buf.length) return; s.shapes.push(richBox({ x, y: s.y, w, h: used + 0.05, paras: buf, lang })); s.y += used + gap; buf = []; used = 0; };
    for (const p of paras) {
      const h = parasHeight([p], w, lang);
      if (used + h > room(s) - 0.05 - gap && (buf.length || s.y > Y0 + 0.05)) { flush(); if (h > room(s) - 0.05 || room(s) < 0.6) s = contSlide(s); }
      buf.push(p); used += h;
    }
    flush(); return s;
  }
  const P = (text, o = {}) => ({ text, ...o });

  /* ---------------------------------------------------------------- 1. executive summary: the indicators once, as cards, with the summary sentence */
  const kpiBlocks = [...(model.headline || []), ...sections.flatMap((x) => x.blocks)].filter((b) => b.type === 'kpis');
  const execSec = sections.find(isExec);
  const execTexts = [...(model.headline || []), ...(execSec?.blocks || [])].filter((b) => b.type === 'text').map((b) => b.text);
  if (kpiBlocks.length || execTexts.length) {
    const s = content(execSec?.title || L('الملخص التنفيذي', 'Executive summary'));
    const items = kpiBlocks.flatMap((b) => b.items);
    if (items.length) {
      const cols = items.length <= 4 ? items.length : 4; const cw = (g.w - (cols - 1) * 0.2) / cols; const ch = 1.6; const rows = Math.ceil(items.length / cols);
      items.forEach((m, i) => {
        const col = i % cols; const row = Math.floor(i / cols); const cx = ar ? g.x0 + g.w - cw - col * (cw + 0.2) : g.x0 + col * (cw + 0.2); const cy = Y0 + row * (ch + 0.18);
        const vsz = Math.max(14, Math.min(28, Math.floor(((cw - 0.3) * 72) / Math.max(1, String(m.value).length * 0.56))));
        s.shapes.push(richBox({ x: cx, y: cy, w: cw, h: ch, lang, anchor: 'ctr', inset: 0.12, fillColor: 'FFFFFF', line: COLORS.line, name: 'Indicator', paras: [P(m.label, { sz: 12, color: COLORS.grey, after: 3 }), P(String(m.value), { sz: vsz, b: true, color: COLORS.teal, after: 3 }), P(m.sub || '', { sz: 10.5, color: COLORS.grey, after: 0 })] }));
      });
      s.y = Y0 + rows * (ch + 0.18) + 0.1;
    }
    if (execTexts.length) addParas(s, execTexts.map((t) => P(t, { sz: 13, after: 6 })));
  }

  /* ---------------------------------------------------------------- 2. scope and basis (ONE slide: the filters, the basis, the cut-off and the preparation time) */
  if (helpers.ctxRows?.length) addTable(content(L('النطاق والأساس', 'Scope and basis')), { title: L('سياق التقرير والتصفية', 'Report context and filters'), headers: [L('البند', 'Item'), L('القيمة', 'Value')], rows: helpers.ctxRows, weights: [1.5, 5], sz: 11, numCols: [] });

  /* ---------------------------------------------------------------- 3. one slide per chart / finding */
  const notes = new Map(); const addNote = (sec, text) => { const k = sec?.title || ''; if (!notes.has(k)) notes.set(k, []); notes.get(k).push(text); };
  const insightBlocks = [];
  for (const sec of sections) {
    if (TAIL.has(sec.key)) continue;
    const attach = [];
    sec.blocks.forEach((b, i) => {
      if (b.type === 'callout' && sec.blocks[i + 1]?.type === 'chart') { attach.push(b.text); return; }
      if (b.type === 'chart') { chartSlide(sec, b, attach.splice(0)); return; }
      if (b.type === 'callout') addNote(sec, b.text);
      else if (b.type === 'text' && !isExec(sec)) addNote(sec, b.text);
      else if (b.type === 'list') b.items.forEach((x) => addNote(sec, x));
      else if (b.type === 'insights') insightBlocks.push({ sec, b });
      else if (isMainTable(b)) { const s = content(b.title, { kicker: sec.title }); addTable(s, { ...tableEntry(b), title: b.title }); }
    });
    attach.splice(0).forEach((t) => addNote(sec, t));
    if (sec.purpose && !appendix.some((a) => a.sectionKey === sec.key)) addNote(sec, sec.purpose); // a section with no appendix table keeps its purpose line here
  }

  function evidenceFor(b, info) {
    if (!isLegacyChart(b)) return evidenceNew(b, lang).map(ltrNums);
    const f = (v) => info.cu.fmt(v); const out = []; const lbl = b.labels.map(String);
    const nn = (vals) => vals.map((v, i) => [v, i]).filter(([v]) => v != null && Number.isFinite(v));
    const pct = (v, t) => (t > 0 ? `${((v / t) * 100).toFixed(1)}%` : '');
    if (b.kind === 'waterfall') {
      const vals = b.series[0].values; const isT = (i) => (Array.isArray(b.totals) ? !!b.totals[i] : i === 0 || i === vals.length - 1);
      const first = vals.findIndex((v, i) => isT(i) && v != null); const t0 = first >= 0 ? vals[first] : 0;
      vals.forEach((v, i) => { if (v == null) return; if (!isT(i)) out.push(`${lbl[i]}: ${v < 0 ? '−' : '+'}${f(Math.abs(v))}${t0 > 0 ? ` (${pct(Math.abs(v), t0)} ${L('من', 'of')} ${lbl[first]})` : ''}`); });
      const last = vals.reduce((a, v, i) => (isT(i) && v != null ? i : a), -1); if (last > first) out.push(`${lbl[last]}: ${f(vals[last])}`);
    } else if (b.kind === 'stacked_hbar') {
      const tot = b.series.reduce((t, s) => t + (s.values[0] ?? 0), 0); b.series.forEach((s) => { if (s.values[0] != null) out.push(`${s.label}: ${f(s.values[0])} (${pct(s.values[0], tot)} ${L('من', 'of')} ${lbl[0]})`); });
    } else if (b.kind === 'line') {
      b.series.slice(0, 3).forEach((s) => { const p = nn(s.values); if (p.length >= 1) { const [fv, fi] = p[0]; const [lv, li] = p[p.length - 1]; out.push(`${s.label}: ${p.length > 1 ? `${lbl[fi]} ${f(fv)} → ${lbl[li]} ${f(lv)}` : `${lbl[li]} ${f(lv)}`}`); } });
    } else if (b.kind === 'pie') {
      const p = nn(b.series[0].values); const tot = p.reduce((t, [v]) => t + v, 0); const top = p.slice().sort((x, y) => y[0] - x[0])[0]; if (top) out.push(`${L('الأكبر', 'Largest')}: ${lbl[top[1]]} — ${f(top[0])} (${pct(top[0], tot)})`);
    } else if (b.kind === 'heatmap') {
      const cells = []; b.series.forEach((s) => s.values.forEach((v, j) => { if (v != null && Number.isFinite(v)) cells.push([v, s.label, lbl[j]]); })); const fmt = (v) => (b.valueKind === 'amount' ? f(v) : `${(v * 100).toFixed(1)}%`);
      if (cells.length) { const hi = cells.reduce((a, c) => (c[0] > a[0] ? c : a)); const lo = cells.reduce((a, c) => (c[0] < a[0] ? c : a)); out.push(`${L('الأعلى', 'Highest')}: ${hi[1]} × ${hi[2]} — ${fmt(hi[0])}`, `${L('الأدنى', 'Lowest')}: ${lo[1]} × ${lo[2]} — ${fmt(lo[0])}`); }
      const miss = b.series.reduce((t, s) => t + s.values.filter((v) => v == null).length, 0); if (miss) out.push(`${miss} ${L('خلية بلا بيانات (تظهر «—» ولا تُحتسب صفراً)', 'cells without data (shown «—», never as zero)')}`);
    } else { // bar / hbar
      b.series.slice(0, 2).forEach((s, k) => {
        const p = nn(s.values); if (!p.length) return; const hi = p.reduce((a, c) => (c[0] > a[0] ? c : a)); const lo = p.reduce((a, c) => (c[0] < a[0] ? c : a)); const sum = p.reduce((t, [v]) => t + v, 0);
        if (b.series.length === 1) { out.push(`${L('الأعلى', 'Highest')}: ${lbl[hi[1]]} — ${f(hi[0])}${p.length > 1 && sum > 0 ? ` (${pct(hi[0], sum)} ${L('من الإجمالي', 'of the total')})` : ''}`); if (p.length > 1) out.push(`${L('الأدنى', 'Lowest')}: ${lbl[lo[1]]} — ${f(lo[0])}`); if (p.length > 1) out.push(`${L('الإجمالي', 'Total')}: ${f(sum)}`); }
        else out.push(`${s.label}: ${L('الإجمالي', 'total')} ${f(sum)} · ${L('الأعلى', 'highest')} ${lbl[hi[1]]} (${f(hi[0])})`);
      });
    }
    return out.slice(0, 3).map(ltrNums);
  }

  function chartSlide(sec, b, callouts) {
    const s = content(b.title, { kicker: sec.title }); let info = null; try { info = chartInfo(b, lang); } catch { info = { cu: { fmt: String, tick: String, unit: { div: 1 } }, unitText: '' }; } const evid = evidenceFor(b, info);
    const no = numOf.get(b); const ref = no ? `${L('جدول البيانات الكامل: الملحق', 'Full data table: Appendix')} ${no}` : (b.kind === 'heatmap' ? L('الجدول أعلاه يحوي كل القيم.', 'The table above holds every value.') : '');
    const ctxTexts = [...callouts, ...(b.note ? [b.note] : [])];
    if (b.kind === 'heatmap') { heatSlide(s, b, info, evid, ctxTexts); return; }
    const plan = chartPlan(b, { lang, drawable: (kd) => DRAW_KINDS().includes(kd) });
    const isSeries = Array.isArray(b.labels) && Array.isArray(b.series); const crowd = isSeries && b.labels.length * Math.max(1, b.series.length) > 30; const hasData = plan.mode !== 'native' || plan.spec.series.some((x) => x.values.some((v) => v != null));
    // honesty notes: why the chart is a picture (and where its numbers are), the no-causation line of a scatter, a bridge that crossed zero …
    const planNotes = [...(plan.mode === 'image' && plan.why ? [pick(plan.why, lang)] : []), ...plan.notes.map((n) => pick(n, lang))];
    const mk = (esz, nsz) => [...evid.map((t) => P(t, { sz: esz, bullet: true, after: 5 })), ...[...ctxTexts, ...planNotes].map((t) => P(t, { sz: nsz, i: true, color: COLORS.grey, after: 4 })), ...(ref ? [P(ref, { sz: 9, color: COLORS.teal, after: 0 })] : [])];
    const chartH = b.kind === 'stacked_hbar' ? 3.2 : YMAX - Y0 - 0.1; let layout = 'side'; let paras = mk(13, 10.5); const sideW = 3.85;
    if (crowd || parasHeight(paras, sideW, lang) > chartH) { paras = mk(12, 10); if (crowd || parasHeight(paras, sideW, lang) > chartH) layout = 'stack'; }
    if (layout === 'stack') { // the chart across the slide, the text below it; text that still does not fit goes to the notes slide
      const textH = () => parasHeight(paras, g.w, lang);
      if (textH() > YMAX - Y0 - 2.9) paras = mk(11, 9.5);
      if (textH() > YMAX - Y0 - 2.9) { callouts.forEach((t) => addNote(sec, t)); if (b.note) addNote(sec, b.note); paras = mk(11, 9.5).filter((p) => !p.i); }
      const ch = Math.max(2.6, Math.min(4.2, YMAX - Y0 - textH() - 0.25));
      s.shapes.push(...drawChart(s, plan, b, { x: g.x0, y: Y0, w: g.w, h: ch, hasData }));
      s.shapes.push(richBox({ x: g.x0, y: Y0 + ch + 0.12, w: g.w, h: textH() + 0.05, paras, lang }));
    } else {
      const cw = g.w - sideW - 0.3; const cx = ar ? g.x0 + sideW + 0.3 : g.x0; const tx = ar ? g.x0 : g.x0 + cw + 0.3;
      s.shapes.push(...drawChart(s, plan, b, { x: cx, y: Y0, w: cw, h: chartH, hasData }));
      s.shapes.push(richBox({ x: tx, y: Y0 + 0.15, w: sideW, h: chartH - 0.2, paras, lang }));
    }
  }
  function summaryOf(bk) { try { return chartSummary(bk, lang); } catch { return bk.title || ''; } }
  // one chart block → its slide shapes: a native chart frame, or the renderer's picture (SVG + PNG fallback) — NEVER another chart type. A kind that nothing can draw leaves a clear line and its data table.
  function drawChart(s, plan, b, { x, y, w, h, hasData }) {
    if (!hasData) return [textBox({ x, y, w, h: 0.3, text: L('لا بيانات لعرض الرسم.', 'No data to chart.'), lang, sz: 11, color: COLORS.grey })];
    const descr = `${b.title} — ${L('الأرقام في الملحق', 'figures in the appendix')}`;
    if (plan.mode === 'native') {
      const rid = `rId${2 + s.charts.length}`; s.charts.push({ rid, spec: plan.spec });
      const out = [chartFrame({ x, y, w, h, rid, name: L('رسم', 'Chart'), descr })];
      const c = plan.spec.center; // a donut's total in its hole (a text box over the chart; the plot area has a fixed layout so the centre is known)
      if (c && c.fx != null) { const cw2 = Math.min(1.9, c.d * Math.min(w, h) * 0.5); out.push(richBox({ x: x + c.fx * w - cw2 / 2, y: y + c.fy * h - 0.34, w: cw2, h: 0.68, lang, anchor: 'ctr', name: 'Donut total', paras: [P(ltrNums(c.text), { sz: 18, b: true, color: COLORS.teal, align: 'ctr', after: 0 }), P(c.sub, { sz: 9, color: COLORS.grey, align: 'ctr', after: 0 })] })); }
      return out;
    }
    if (plan.mode === 'image') {
      const px = Math.max(520, Math.min(1100, Math.round((w * 72) / 0.85))); let r = null;
      try { r = chartRender(b, { lang, w: px, h: Math.round(px * (h / w)) }); } catch { r = null; } // the SAME SVG drawing the screen and the PDF use
      if (r?.svg) {
        const aspect = r.w / r.h; const dw = Math.min(w, h * aspect); const dh = dw / aspect; const dx = x + (w - dw) / 2;
        const k = s.pics.length; s.pics.push({ rPng: `rImgP${k}`, rSvg: `rImgS${k}`, svg: r.svg, w: r.w, h: r.h });
        return [pictureFrame({ x: dx, y, w: dw, h: dh, rPng: `rImgP${k}`, rSvg: `rImgS${k}`, name: L('صورة الرسم', 'Chart image'), descr: summaryOf(b) })];
      }
    }
    return [textBox({ x, y, w, h: 0.5, text: L('تعذّر رسم هذا المخطط في العرض؛ بياناته الكاملة في جدول الملحق.', 'This chart could not be drawn in the deck; its full data are in the appendix table.'), lang, sz: 11, color: COLORS.grey })];
  }
  // the heat map: a native table with shaded cells (lighter = lower, darker = higher), hatched «—» where there is no data
  function heatSlide(s, b, info, evid, ctxTexts) {
    const vals = b.series.flatMap((q) => q.values).filter((v) => v != null && Number.isFinite(v)); const mn = vals.length ? Math.min(...vals) : 0; const mx = vals.length ? Math.max(...vals) : 1; const span = mx - mn || 1;
    const fmt = (v) => (b.valueKind === 'amount' ? info.cu.tick(v) : `${(v * 100).toFixed(1)}%`);
    const rows = b.series.map((q) => [q.label, ...q.values.map((v) => (v == null || !Number.isFinite(v) ? '—' : fmt(v)))]);
    const fills = (i, j) => {
      if (j === 0) return { fill: `<a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>`, b: true, align: ar ? 'r' : 'l' };
      const v = b.series[i].values[j - 1];
      if (v == null || !Number.isFinite(v)) return { pattern: `<a:pattFill prst="wdUpDiag"><a:fgClr><a:srgbClr val="BFBFBF"/></a:fgClr><a:bgClr><a:srgbClr val="FFFFFF"/></a:bgClr></a:pattFill>`, color: '535353', align: 'ctr' };
      const t = (v - mn) / span; const w = Math.round(85000 * (1 - t));
      return { fill: `<a:solidFill><a:schemeClr val="dk2"><a:lumMod val="${100000 - w}"/><a:lumOff val="${w}"/></a:schemeClr></a:solidFill>`, color: t > 0.55 ? 'FFFFFF' : '000000', align: 'ctr' };
    };
    const wts = [2.4, ...b.labels.map(() => 1)];
    const tbl = { title: '', headers: [L('البند', 'Item'), ...b.labels.map(String)], rows, weights: wts, sz: 10, numCols: [] };
    const hint = L('الأفتح = الأقل والأغمق = الأعلى؛ الخلايا المخططة بلا بيانات.', 'Lighter = lower, darker = higher; hatched cells have no data.');
    const rh = tableRowHeights({ w: g.w, headers: tbl.headers, rows, sz: 10, weights: wts });
    const tH = rh.head + rh.rows.reduce((a, c) => a + c, 0);
    if (tH > YMAX - Y0 - 1.3) { addTable(s, { ...tbl, title: b.title }, { fills }); } else {
      const fr = tableFrame({ x: g.x0, y: Y0, w: g.w, headers: tbl.headers, rows, lang, sz: 10, weights: wts, fills, numCols: [] }); s.shapes.push(fr.xml); s.y = Y0 + fr.h + 0.18;
    }
    const paras = [...evid.map((t) => P(t, { sz: 12, bullet: true, after: 4 })), P(hint, { sz: 10, i: true, color: COLORS.grey, after: 3 }), ...ctxTexts.map((t) => P(t, { sz: 10, i: true, color: COLORS.grey, after: 3 }))];
    addParas(slides[slides.length - 1], paras);
  }

  /* ---------------------------------------------------------------- 4. key insights (the first MAIN_INSIGHTS; every one is in the appendix with its basis and caveat) */
  for (const { sec, b } of insightBlocks) {
    const items = b.items.slice(0, MAIN_INSIGHTS); const no = numOf.get(b);
    let s = content(b.title || L('أبرز النتائج والرؤى', 'Key findings and insights'), { kicker: sec.title });
    const paras = items.flatMap((it) => [P(pick(it.title, lang), { sz: 14, b: true, color: COLORS.teal, after: 2 }), P(fillTokens(pick(it.body, lang), it.tokens, lang), { sz: 12, after: 2 }), ...(it.evidence?.length ? [P(it.evidence.map((e) => `${pick(e.k, lang)}: ${fmtEvidence(e, lang)}`).join(' · '), { sz: 10, color: COLORS.grey, after: 9 })] : [])]);
    if (b.items.length > items.length) paras.push(P(L(`ويضم الملحق ${b.items.length - items.length} رؤى إضافية.`, `${b.items.length - items.length} further insights are in the appendix.`) + (no ? ` ${L('الملحق', 'Appendix')} ${no}` : ''), { sz: 10, i: true, color: COLORS.grey }));
    else if (no) paras.push(P(`${L('الأساس والتحفظات والأرقام الداعمة لكل رؤية: الملحق', 'Basis, caveats and supporting figures of each insight: Appendix')} ${no}`, { sz: 10, i: true, color: COLORS.grey }));
    addParas(s, paras);
  }

  /* ---------------------------------------------------------------- 5. recommendations / findings / forecast, then notes and limits, then data and assumptions */
  const listSection = (sec) => {
    const s = content(sec.title); const paras = [];
    for (const b of sec.blocks) { if (b.type === 'list') b.items.forEach((x) => paras.push(P(x, { sz: 12.5, bullet: true, after: 7 }))); else if (b.type === 'callout' || b.type === 'text') paras.push(P(b.text, { sz: 12.5, after: 7, ...(b.type === 'callout' ? { i: true } : {}) })); }
    if (paras.length) addParas(s, paras); else slides.pop();
  };
  for (const sec of sections.filter((x) => TAIL.has(x.key) && x.key !== 'assumptions' && x.key !== 'forecast')) listSection(sec);
  for (const sec of sections.filter((x) => x.key === 'forecast')) for (const b of sec.blocks) { if (b.type === 'list') b.items.forEach((x) => addNote(sec, x)); else if (b.text) addNote(sec, b.text); } // the forecast and its limits are limits: they join the notes slide
  if (notes.size) {
    const s = content(L('ملاحظات وحدود', 'Notes and limits')); const paras = [];
    for (const [sec, texts] of notes) { if (sec) paras.push(P(sec, { sz: 12.5, b: true, color: COLORS.teal, after: 3 })); texts.forEach((t) => paras.push(P(t, { sz: 11.5, bullet: true, after: 5 }))); }
    addParas(s, paras);
  }
  const assum = sections.find((x) => x.key === 'assumptions');
  { const s = content(assum?.title || L('البيانات والافتراضات', 'Data and assumptions')); const paras = [P(helpers.dataLine, { sz: 13, b: true, color: COLORS.teal, after: 6 })];
    if (helpers.stamp) paras.push(P(helpers.stamp, { sz: 11.5, color: COLORS.grey, after: 8 }));
    for (const b of assum?.blocks || []) { if (b.type === 'list') b.items.forEach((x) => paras.push(P(x, { sz: 12, bullet: true, after: 6 }))); else if (b.text) paras.push(P(b.text, { sz: 12, after: 6 })); }
    addParas(s, paras); }

  /* ---------------------------------------------------------------- 6. appendix: divider, contents, then the numbered tables grouped by section */
  const groups = []; for (const a of appendix) { const last = groups[groups.length - 1]; if (last && last.key === a.sectionKey && last.title === a.section) last.items.push(a); else groups.push({ key: a.sectionKey, title: a.section, purpose: a.purpose, items: [a] }); }
  const appTitle = L('الملحق أ', 'Appendix A');
  const startApp = slides.length;
  for (const grp of groups) {
    const appHead = grp.key === 'nc_appendix' ? grp.title : `${appTitle} · ${grp.title}`; // the non-collection appendix section is already titled «الملحق / Appendix»
    let s = content(appHead, { appendix: true, base: appHead });
    if (grp.purpose) { const h = textHeight(grp.purpose, g.w, 10.5, 0.06); s.shapes.push(textBox({ x: g.x0, y: s.y, w: g.w, h, text: grp.purpose, lang, sz: 10.5, i: true, color: COLORS.grey })); s.y += h + 0.1; }
    for (const a of grp.items) { s = addTable(s, a); a.slideStart = slides.indexOf(a.slideRef); }
  }
  const appStartIdx = startApp;
  // the divider and the contents go BEFORE the appendix slides
  // the contents: tables listed with the slide each one starts on; two columns per slide when there are many
  const cHead = [L('الرقم', 'No.'), L('الجدول', 'Table'), L('الشريحة', 'Slide')]; const cW = (g.w - 0.3) / 2; const cWts = [0.9, 5, 0.9]; const maxH = YMAX - Y0 - 0.1;
  const cols = []; let cur = []; let curH = 0;
  const probe = (rows) => tableRowHeights({ w: cW, headers: cHead, rows, sz: 10, weights: cWts, minRowH: 0.28 });
  const cRows = appendix.map((a) => [a.no, a.title, '']); const cHs = probe(cRows).rows; const headH = probe([]).head;
  cRows.forEach((r, i) => { if (cur.length && headH + curH + cHs[i] > maxH) { cols.push(cur); cur = []; curH = 0; } cur.push(i); curH += cHs[i]; });
  if (cur.length) cols.push(cur);
  const nContents = Math.max(1, Math.ceil(cols.length / 2));
  const dividerIdx = appStartIdx; const pageOf = (q) => q + nContents + 3 + 0 * dividerIdx; // title = 1, main slides, divider, contents, then the appendix slide index q (counted before the divider and contents were inserted)
  const divider = { title: L('الملحق', 'Appendix'), kicker: '', shapes: [], charts: [], layout: 5, titleSize: 54, footerColor: 'FFFFFF', y: Y0 };
  divider.shapes.push(richBox({ x: 1.7, y: 3.15, w: 9.9, h: 1.6, lang, name: 'Appendix note', paras: [P(L('الجداول الكاملة وراء الشرائح السابقة: لا يُحذف أي صف، وتتكرر رؤوس الجداول الطويلة عند استمرارها.', 'The complete tables behind the slides above: no row is dropped, and a long table repeats its header where it continues.'), { sz: 18, color: 'FFFFFF', after: 10 }), P(L(`${appendix.length} جدولاً في ${slides.length - appStartIdx} شريحة`, `${appendix.length} tables on ${slides.length - appStartIdx} slides`), { sz: 16, color: 'FFFFFF', b: true })] }));
  const contentSlides = [];
  for (let k = 0; k < nContents; k += 1) {
    const s = { title: `${L('محتويات الملحق', 'Appendix contents')}${nContents > 1 ? ` (${k + 1}/${nContents})` : ''}`, kicker: '', shapes: [], charts: [], layout: 2, y: Y0 };
    cols.slice(k * 2, k * 2 + 2).forEach((idxs, i, arr) => {
      const rows = idxs.map((q) => [appendix[q].no, appendix[q].title, String(pageOf(appendix[q].slideStart))]); const w = arr.length === 2 ? cW : g.w; const hx = ar ? g.x0 + g.w - w - i * (cW + 0.3) : g.x0 + i * (cW + 0.3);
      s.shapes.push(tableFrame({ x: hx, y: Y0, w, headers: cHead, rows, lang, sz: 10, weights: cWts, numCols: [2], minRowH: 0.28 }).xml);
    });
    contentSlides.push(s);
  }
  slides.splice(appStartIdx, 0, divider, ...contentSlides);

  slides.forEach((s) => { s.footer = footer; });
  return { slides, appendixCount: appendix.length };
}
