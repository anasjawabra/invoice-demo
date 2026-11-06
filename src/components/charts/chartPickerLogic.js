// PURE logic of the chart picker / customize panel / export disclosure (no React, no DOM) — the components in this folder only draw what this module decides.
// Everything here is built on the catalog (src/data/chartCatalog.js): `chartOptions` says which types fit a chart, `evaluateChart` validates a request and returns the display block, the
// `changes` that will be visible and the `ignored` knobs that do not apply. Nothing here recomputes a figure; a presentation change never reads the data service.
import { CHART_TYPES, PURPOSES, chartOptions, evaluateChart, chartDimensions, typeIdOf, typeById, patchConfig, normalizeConfig, defaultConfig } from '../../data/chartCatalog';

export const PURPOSE_NAMES = {
  comparison: { ar: 'المقارنة', en: 'Comparison' }, trend: { ar: 'الاتجاه', en: 'Trend' }, composition: { ar: 'التركيب', en: 'Composition' },
  distribution: { ar: 'التوزيع', en: 'Distribution' }, relationship: { ar: 'العلاقة', en: 'Relationship' }
};
export const pickText = (o, lang) => (o ? (lang === 'ar' ? o.ar : o.en) || o.en || o.ar || '' : '');
export const typeName = (id, lang) => { const t = typeById(id); return t ? (lang === 'ar' ? t.ar : t.en) : String(id || ''); };
export const sameCfg = (a, b) => JSON.stringify(normalizeConfig(a)) === JSON.stringify(normalizeConfig(b));
// the keys of a config that differ from the block's own default (what setChartConfig would store): «no change» is the empty config
export function effectiveCfg(block, cfg) { const c = normalizeConfig(cfg); const d = normalizeConfig(defaultConfig(block)); const out = {}; for (const k of Object.keys(c)) if (c[k] !== d[k]) out[k] = c[k]; return out; }
export const sameEffective = (block, a, b) => sameCfg(effectiveCfg(block, a), effectiveCfg(block, b));
export const hasCfg = (cfg) => !!cfg && Object.keys(normalizeConfig(cfg)).length > 0;

/* ------------------------------------------------------------------ config helpers */
// a copy of `cfg` with one key set (null / undefined / 'auto' remove it: «not set» = the renderer's or the report's own rule)
export function withKey(cfg, key, value) { const c = { ...(cfg || {}) }; if (value === null || value === undefined || value === 'auto') delete c[key]; else c[key] = value; return c; }
// the config that asks for a type: the kind changes, the modifiers of the OLD kind are dropped (patchConfig), the data choices (sort / Top N / dimension…) stay
export const cfgForType = (cfg, id) => patchConfig(cfg || {}, { kind: id });
// the block shown for a saved config (the same rule as applyView: an invalid request leaves the block as it is)
export function displayFor(block, cfg, lang) {
  if (!block || !hasCfg(cfg)) return block;
  const c = normalizeConfig(cfg); const r = evaluateChart(block, c.kind || typeIdOf(block), c, { lang });
  return r.ok ? r.block : block;
}

/* ------------------------------------------------------------------ the picker */
// → { recommended, current, groups:[{purpose, name, items}], more:[{purpose, name, items}], items, byId }
// item = { id, name:{ar,en}, use:{ar,en}, purpose, more, available, reason, changes, block, previewSpec, current, recommended, export, cfg }
// `block` = the user's OWN data drawn as that type (null when the type does not fit: the UI then draws `previewSpec`, greyed, with `reason`).
export function pickerModel(block, cfg, lang) {
  const o = chartOptions(block, { lang }); const av = new Map(o.available.map((a) => [a.id, a])); const un = new Map(o.unavailable.map((u) => [u.id, u]));
  const disp = displayFor(block, cfg, lang); const current = typeIdOf(disp || block || {});
  const items = CHART_TYPES.map((t) => {
    let ev = null; let used = cfgForType(cfg, t.id);
    if (av.has(t.id)) { ev = evaluateChart(block, t.id, used, { lang }); if (!ev.ok) { used = { kind: t.id }; ev = evaluateChart(block, t.id, used, { lang }); } }
    const ok = !!ev && ev.ok;
    return {
      id: t.id, name: { ar: t.ar, en: t.en }, use: { ar: t.useAr, en: t.useEn }, purpose: t.purpose, more: !!t.more,
      available: ok, reason: ok ? null : (un.get(t.id) && un.get(t.id).reason) || (ev && ev.reason) || null, changes: ok ? ev.changes : [], block: ok ? ev.block : null,
      previewSpec: t.previewSpec, current: t.id === current, recommended: t.id === o.recommended, export: t.export, cfg: ok ? used : null
    };
  });
  const group = (more) => PURPOSES.map((p) => ({ purpose: p.id, name: PURPOSE_NAMES[p.id] || { ar: p.ar, en: p.en }, items: items.filter((i) => i.purpose === p.id && i.more === more) })).filter((g) => g.items.length);
  return { recommended: o.recommended, current, groups: group(false), more: group(true), items, byId: Object.fromEntries(items.map((i) => [i.id, i])) };
}
// the recommended type applied from a clean config; null when the saved block already is the recommended one (then «reset» simply removes the saved entry)
export function recommendedConfig(block, lang) { const r = chartOptions(block, { lang }).recommended; return r === typeIdOf(block) ? {} : { kind: r }; }

// a text for the box «ما سيتغيّر»: one line per change; the fixed sentence when nothing but the drawing changes
export const SAME_NUMBERS = { ar: 'الأرقام نفسها، العرض فقط.', en: 'Same numbers, presentation only.' };
export function changeLines(changes, lang) { return (changes || []).map((c) => ({ key: c.key, text: pickText(c, lang) })); }
export const pptxLine = (exp, lang) => {
  const m = exp && exp.pptx;
  if (m === 'native') return lang === 'ar' ? 'في PowerPoint: رسم أصلي قابل للتحرير.' : 'In PowerPoint: a native, editable chart.';
  if (m === 'table') return lang === 'ar' ? 'في PowerPoint: جدول أصلي مظلّل.' : 'In PowerPoint: a native shaded table.';
  return lang === 'ar' ? 'في PowerPoint: صورة — البيانات في الجدول.' : 'In PowerPoint: a picture — the data is in the table.';
};

// keyboard: the neighbour of option `idx` in a physical direction, from the rectangles of the options in DOM order (works for the 2-3 column grid in RTL and LTR).
export function nextIndexByRects(rects, idx, dir) {
  const n = rects.length; if (!n) return -1; if (dir === 'home') return 0; if (dir === 'end') return n - 1;
  const r = rects[idx] || rects[0]; const cx = (r.left + r.right) / 2; const cy = (r.top + r.bottom) / 2; const half = Math.max(1, (r.bottom - r.top) / 2);
  const mid = (q) => [(q.left + q.right) / 2, (q.top + q.bottom) / 2]; let best = -1; let bestScore = Infinity;
  rects.forEach((q, i) => {
    if (i === idx) return; const [qx, qy] = mid(q); const dx = qx - cx; const dy = qy - cy; const sameRow = Math.abs(dy) < half;
    let score = null;
    if (dir === 'left' && sameRow && dx < 0) score = -dx; else if (dir === 'right' && sameRow && dx > 0) score = dx;
    else if (dir === 'up' && dy < -half) score = -dy * 1000 + Math.abs(dx); else if (dir === 'down' && dy > half) score = dy * 1000 + Math.abs(dx);
    if (score !== null && score < bestScore) { best = i; bestScore = score; }
  });
  return best < 0 ? idx : best;
}
// the arrow key → a physical direction (the page language only changes which way the grid flows, not what an arrow key means on screen)
export const KEY_DIR = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Home: 'home', End: 'end' };

/* ------------------------------------------------------------------ customize */
const BAR_FAMILY = new Set(['bar', 'hbar', 'stacked_col', 'stacked_hbar', 'stacked100_col', 'stacked100_hbar']);
const FAM = { bar: ['v', 'grouped', 'amount'], hbar: ['h', 'grouped', 'amount'], stacked_col: ['v', 'stacked', 'amount'], stacked_hbar: ['h', 'stacked', 'amount'], stacked100_col: ['v', 'stacked', 'share'], stacked100_hbar: ['h', 'stacked', 'share'] };
const SHARE_OK = new Set(['bar', 'hbar', 'line', 'line_markers', 'area', 'stacked_col', 'stacked_hbar', 'stacked100_col', 'stacked100_hbar']);
const DIMS = [['amanah', 'الأمانة', 'Amanah'], ['municipality', 'البلدية', 'Municipality'], ['source', 'مصدر الإيراد', 'Revenue source'], ['product', 'المنتج', 'Product']];
export const DIMENSION_NEEDS_TEXT = { ar: 'يحتاج إصداراً جديداً من التقرير', en: 'needs a new report version' };
const L2 = (ar, en) => ({ ar, en });
const ignoredMsg = (r, key) => { const i = r && r.ignored && r.ignored.find((x) => x.key === key); return i ? L2(i.ar, i.en) : null; };

// → { display, typeId, controls:[{key, label, kind:'seg', value, options:[{value,label,enabled,why,changes}], notes:[text]}], notApplicable:[{key,label,reason}], changes, ignored }
// A control appears only when at least one of its other values is accepted by `evaluateChart`; a value that is not accepted is shown disabled with its reason; the controls that do not apply at all are listed once, with the reason, as «not applicable here».
export function customizeModel(block, cfg, lang) {
  const c0 = normalizeConfig(cfg); const cur = evaluateChart(block, c0.kind || typeIdOf(block), c0, { lang }); const display = cur.ok ? cur.block : block; const typeId = typeIdOf(display);
  const dflt = defaultConfig(block); const fam = FAM[typeId] || null;
  const ev = (key, value) => { const next = withKey(c0, key, value); return { next, r: evaluateChart(block, next.kind || typeIdOf(block), next, { lang }) }; };
  const controls = []; const notApplicable = [];
  const build = (key, label, value, defs, ignoreKey, { alwaysShow = false } = {}) => {
    const options = defs.map(([v, ar, en]) => {
      if (v === value) return { value: v, label: L2(ar, en), enabled: true, current: true, why: null, changes: [] };
      const { r } = ev(key, v); const ign = ignoreKey ? ignoredMsg(r, ignoreKey) : null; const enabled = r.ok && !ign;
      return { value: v, label: L2(ar, en), enabled, current: false, why: enabled ? null : (!r.ok ? r.reason : ign), changes: enabled ? r.changes : [] };
    });
    const any = options.some((o) => !o.current && o.enabled);
    const notes = options.filter((o) => !o.enabled && o.why).map((o) => ({ value: o.value, label: o.label, text: o.why }));
    if (any || alwaysShow) controls.push({ key, label, kind: 'seg', value, options, notes });
    else if (notes.length) notApplicable.push({ key, label, reason: notes[0].text });
  };
  if (fam && BAR_FAMILY.has(typeId)) {
    build('orientation', L2('الاتجاه', 'Orientation'), fam[0], [['v', 'عمودي', 'Vertical'], ['h', 'أفقي', 'Horizontal']], null);
    build('grouping', L2('التجميع', 'Grouping'), fam[1], [['grouped', 'جنباً إلى جنب', 'Grouped'], ['stacked', 'مكدّس', 'Stacked']], null);
  }
  if (SHARE_OK.has(typeId)) build('mode', L2('المقياس', 'Measure'), fam ? fam[2] : (c0.mode || 'amount'), [['amount', 'مبلغ', 'Amount'], ['share', 'نسبة (حصة)', 'Share (%)']], 'percentage');
  if (display.basis === 'cumulative' || (display.dim && display.dim.dimension === 'month') || c0.cumulative !== undefined || display.basis === 'monthly') build('cumulative', L2('الأساس', 'Basis'), display.basis === 'cumulative' ? true : false, [[false, 'شهري', 'Monthly'], [true, 'تراكمي', 'Cumulative']], 'cumulative');
  build('sort', L2('الترتيب', 'Sorting'), c0.sort || 'none', [['none', 'كما هو', 'As is'], ['desc', 'تنازلي', 'Descending'], ['asc', 'تصاعدي', 'Ascending'], ['label', 'أبجدي', 'A–Z']], 'sort');
  const nCat = (display.labels || []).length;
  const topDefs = [[null, 'الكل', 'All'], ...[5, 10, 15].filter((n) => n < nCat).map((n) => [n, `الأعلى ${n} + أخرى`, `Top ${n} + Other`])];
  if (topDefs.length > 1) build('topN', L2('عدد الفئات', 'Categories shown'), c0.topN || null, topDefs, 'topn');
  const tri = [['auto', 'تلقائي', 'Auto'], [true, 'إظهار', 'Show'], [false, 'إخفاء', 'Hide']];
  build('labels', L2('تسميات القيم', 'Data labels'), c0.labels === undefined ? 'auto' : c0.labels, tri, null, { alwaysShow: true });
  build('legend', L2('وسيلة الإيضاح', 'Legend'), c0.legend === undefined ? 'auto' : c0.legend, tri, null, { alwaysShow: true });
  const dimNow = c0.dimension || (block && block.dim && block.dim.dimension) || null;
  if (dimNow && DIMS.some((d) => d[0] === dimNow)) {
    const held = new Set(chartDimensions(block).map((d) => d.id));
    const options = DIMS.map(([id, ar, en]) => {
      if (id === dimNow) return { value: id, label: L2(ar, en), enabled: true, current: true, why: null, changes: [] };
      if (!held.has(id)) return { value: id, label: L2(ar, en), enabled: false, current: false, why: L2(DIMENSION_NEEDS_TEXT.ar, DIMENSION_NEEDS_TEXT.en), changes: [] };
      const { r } = ev('dimension', id); const ign = ignoredMsg(r, 'dimension'); const enabled = r.ok && !ign;
      return { value: id, label: L2(ar, en), enabled, current: false, why: enabled ? null : (!r.ok ? r.reason : ign), changes: enabled ? r.changes : [] };
    });
    controls.push({ key: 'dimension', label: L2('التقسيم حسب', 'Break down by'), kind: 'seg', value: dimNow, options, notes: options.filter((o) => !o.enabled && o.why).map((o) => ({ value: o.value, label: o.label, text: o.why })) });
  }
  return { display, typeId, ok: cur.ok, controls, notApplicable, changes: cur.changes || [], ignored: cur.ignored || [], base: dflt };
}

/* ------------------------------------------------------------------ messages (the view message appended to the conversation) */
export function changeNote(title, fromId, toId, lang, changes = []) {
  const f = typeName(fromId, lang); const t = typeName(toId, lang); const nm = title ? `«${title}»` : '';
  const tail = changes.length ? ` ${changes.map((c) => pickText(c, lang)).join(' ')}` : ` ${pickText(SAME_NUMBERS, lang)}`;
  return lang === 'ar' ? `غيّرتُ عرض الرسم ${nm}: من ${f} إلى ${t}.${tail}` : `Changed the chart ${nm}: from ${f} to ${t}.${tail}`;
}
export function customizeNote(title, lang, changes = []) {
  const nm = title ? `«${title}»` : ''; const tail = changes.length ? ` ${changes.map((c) => pickText(c, lang)).join(' ')}` : ` ${pickText(SAME_NUMBERS, lang)}`;
  return lang === 'ar' ? `عدّلتُ عرض الرسم ${nm}.${tail}` : `Adjusted how the chart ${nm} is shown.${tail}`;
}
export function resetNote(title, lang) { const nm = title ? `«${title}»` : ''; return lang === 'ar' ? `أعدتُ الرسم ${nm} إلى العرض الموصى به. الأرقام نفسها.` : `Chart ${nm} is back to the recommended view. Same numbers.`; }
// the charts the global «make them …» command left alone, with the reason of each (at most `max`)
export function skippedLine(list, lang, max = 3) {
  const l = (list || []).filter((x) => x && x.reason); if (!l.length) return '';
  const shown = l.slice(0, max).map((x) => `${x.title ? `«${x.title}»` : ''} — ${pickText(x.reason, lang).replace(/[.\u3002]+\s*$/, '')}`.trim());
  const rest = l.length - shown.length; const more = rest > 0 ? (lang === 'ar' ? ` (+${rest} أخرى)` : ` (+${rest} more)`) : '';
  return (lang === 'ar' ? 'لم يتغيّر: ' : 'Left as they were: ') + shown.join(lang === 'ar' ? '؛ ' : '; ') + more + '.';
}

/* ------------------------------------------------------------------ export disclosure */
// → { total, native, picture, table, fallbacks:[{chartId, title, typeId, name, mode, note}] } from `exportPlan(model, view)`
export function exportSummary(plan, lang) {
  const p = Array.isArray(plan) ? plan : []; const fb = p.filter((e) => e.pptx !== 'native');
  return {
    total: p.length, native: p.filter((e) => e.pptx === 'native').length, picture: p.filter((e) => e.pptx === 'vector-image').length, table: p.filter((e) => e.pptx === 'table').length,
    fallbacks: fb.map((e) => ({ chartId: e.chartId, title: e.title, typeId: e.typeId, name: typeName(e.typeId, lang), mode: e.pptx, note: e.pptx === 'table' ? pickText({ ar: 'جدول مظلّل أصلي', en: 'native shaded table' }, lang) : pickText({ ar: 'صورة — البيانات في الجدول', en: 'picture — the data is in the table' }, lang), why: pickText(e.note, lang) }))
  };
}
