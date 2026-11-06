// «أين نركز» — the PURE view of the planning action lines (server/planningActions.js, POST /api/plan-actions): the ranked, actionable table; the separate groups (blocked · older than 180 days · the rest);
// the bars of the actionable balance by revenue source; the reason text built from the evidence COUNTS (never a cause); and the drill URL to /collection with the exact filters of a line.
//   · the service guarantees DISJOINT lines (one invoice, one line): nothing here adds a line to another or counts an invoice twice;
//   · the ranking is the page's: the entity's contribution to the gap first (positive gaps, largest first), then the actionable amount (classes B + C); entities ahead of plan / without a gap come after;
//   · class A (blocked) and class D (older than 180 days: a decision, not a push) are NEVER added into the actionable amount — they are separate groups;
//   · the expected impact is «غير متاح» (no recovery is estimated); the service sends `expectedImpact: null`.
const bi = (ar, en) => ({ ar, en });
const pick = (o, lang) => (o == null ? '' : typeof o === 'string' ? o : (lang === 'en' ? o.en : o.ar) || o.en || '');
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const sum = (a, f) => a.reduce((t, x) => t + (f(x) || 0), 0);
export const ACTIONABLE_CLASSES = ['B', 'C'];
export const EXPECTED_IMPACT_NA = bi('غير متاح', 'Not available');
export const EXPECTED_IMPACT_WHY = bi('لا تتوفر بيانات استرداد تتحقق من أي مبلغ متوقع، فلا يُقدَّر أثر.', 'No recovery data exists to validate an expected amount, so no impact is estimated.');
export const ACTION_COLUMNS = ['priority', 'entity', 'municipality', 'source', 'gap', 'actionable', 'dueByYearEnd', 'oldest', 'reason', 'action', 'expectedImpact', 'drill'];

const cellKey = (x) => `${x.entity.key}|${x.municipality?.key || ''}|${x.source.key}`;

/** «متأخر ≤ 180 يوماً: 466 م في 29 فاتورة (أقدمها 214 يوماً)» — a rule sentence from the evidence counts and amounts; no causal claim */
export function reasonOf(line, { money, count, lang = 'ar' }) {
  const n = (c) => count(c);
  if (line.class === 'B') {
    const part = line.partial?.count ? (lang === 'ar' ? `؛ منها ${n(line.partial.count)} جزئية السداد` : `; ${n(line.partial.count)} partly paid`) : '';
    return lang === 'ar' ? `متأخر حتى 180 يوماً: ${money(line.remaining)} في ${n(line.count)} فاتورة (أقدمها ${n(line.oldestDaysOverdue)} يوماً)${part}` : `Overdue up to 180 days: ${money(line.remaining)} in ${n(line.count)} invoices (oldest ${n(line.oldestDaysOverdue)} days)${part}`;
  }
  if (line.class === 'C') return lang === 'ar' ? `يستحق قبل نهاية السنة: ${money(line.remaining)} في ${n(line.count)} فاتورة` : `Falls due by year-end: ${money(line.remaining)} in ${n(line.count)} invoices`;
  if (line.class === 'D') return lang === 'ar' ? `متأخر أكثر من 180 يوماً: ${money(line.remaining)} في ${n(line.count)} فاتورة (أقدمها ${n(line.oldestDaysOverdue)} يوماً)` : `Overdue more than 180 days: ${money(line.remaining)} in ${n(line.count)} invoices (oldest ${n(line.oldestDaysOverdue)} days)`;
  if (line.class === 'A') {
    const bl = (line.blockers || []).map((b) => `${pick(b, lang)}: ${money(b.amount)} (${n(b.count)})`).join(lang === 'ar' ? '؛ ' : '; ');
    return lang === 'ar' ? `عائق قائم على ${money(line.remaining)} في ${n(line.count)} فاتورة${bl ? ` — ${bl}` : ''}` : `A standing blocker on ${money(line.remaining)} in ${n(line.count)} invoices${bl ? ` — ${bl}` : ''}`;
  }
  if (line.class === 'E') return lang === 'ar' ? `يستحق بعد نهاية السنة: ${money(line.remaining)} في ${n(line.count)} فاتورة` : `Falls due after year-end: ${money(line.remaining)} in ${n(line.count)} invoices`;
  return lang === 'ar' ? `تاريخ الاستحقاق غير متاح: ${money(line.remaining)} في ${n(line.count)} فاتورة` : `Due date unavailable: ${money(line.remaining)} in ${n(line.count)} invoices`;
}

/**
 * @param res    the service response (lines · cells · totals …) or null
 * @param o      { money(v), count(v), lang, sourceKey = null (a source chosen on the source bars narrows the table), topN = 8, expanded = false }
 */
export function actionView(res, { money = (v) => String(v), count = (v) => String(v), lang = 'ar', sourceKey = null, topN = 8, expanded = false } = {}) {
  if (!res || !Array.isArray(res.lines)) return { available: false, cells: [], hidden: 0, all: 0, groups: { blocked: [], aged: [] }, other: null, totals: null, level: 'entity', notes: [] };
  const linesByCell = new Map();
  for (const l of res.lines) { const k = cellKey(l); if (!linesByCell.has(k)) linesByCell.set(k, []); linesByCell.get(k).push(l); }
  const rows = [];
  for (const c of res.cells || []) {
    const lines = linesByCell.get(cellKey(c)) || [];
    const act = lines.filter((l) => ACTIONABLE_CLASSES.includes(l.class));
    const actionable = sum(act, (l) => l.remaining);
    if (!(actionable > 0)) continue;
    const b = act.find((l) => l.class === 'B') || null; const cc = act.find((l) => l.class === 'C') || null;
    const actions = []; for (const l of [b, cc]) { const t = l && l.recommendedAction; if (t && !actions.some((x) => x.key === t.key)) actions.push(t); }
    rows.push({
      id: c.id, entity: c.entity, municipality: c.municipality || null, source: c.source, actionable,
      overdue: b ? b.remaining : 0, dueSoon: cc ? cc.remaining : 0, count: sum(act, (l) => l.count),
      dueByYearEnd: sum(lines, (l) => l.dueByYearEnd), balance: c.remaining,
      oldest: Math.max(0, ...act.map((l) => l.oldestDaysOverdue || 0)), partial: sum(act, (l) => l.partial?.amount),
      entityGap: fin(c.contributionToGap?.entityGap) ? c.contributionToGap.entityGap : null, gapShare: fin(c.contributionToGap?.share) ? c.contributionToGap.share : null,
      reasons: act.map((l) => reasonOf(l, { money, count, lang })), actions, expectedImpact: EXPECTED_IMPACT_NA, drill: c.drillActionable, aged: c.aged || 0, blocked: c.blocked || 0
    });
  }
  // ranking: the entity's contribution to the gap (a positive gap, largest first) → the actionable amount → a stable order
  rows.sort((a, b) => {
    const ga = a.entityGap > 0 ? a.entityGap : -Infinity; const gb = b.entityGap > 0 ? b.entityGap : -Infinity;
    if (ga !== gb) return gb > ga ? 1 : -1;
    return b.actionable - a.actionable || (a.id < b.id ? -1 : 1);
  });
  const filtered = sourceKey ? rows.filter((r) => r.source.key === sourceKey) : rows;
  filtered.forEach((r, i) => { r.priority = i + 1; });
  const cells = expanded ? filtered : filtered.slice(0, topN);
  const grp = (cls) => res.lines.filter((l) => l.class === cls && (!sourceKey || l.source.key === sourceKey)).sort((a, b) => b.remaining - a.remaining || (a.id < b.id ? -1 : 1)).map((l) => ({ ...l, reason: reasonOf(l, { money, count, lang }) }));
  const t = res.totals || {};
  const other = { E: t.byClass?.E || { count: 0, remaining: 0 }, U: t.byClass?.U || { count: 0, remaining: 0 } };
  return {
    available: true, level: res.level || 'entity', cells, hidden: Math.max(0, filtered.length - cells.length), all: filtered.length,
    groups: { blocked: grp('A'), aged: grp('D') }, other, totals: t, notes: res.notes || [], rowsAll: rows,
    actionableTotal: sum(rows, (r) => r.actionable) // the sum of the table rows = totals.actionable.remaining (the service's disjoint lines)
  };
}

/** bars of the ACTIONABLE balance (classes B + C) by revenue source — NOT a deviation: there is no source-level target, so no source deviation exists */
export function sourceBars(res, { lang = 'ar', selectedKey = null } = {}) {
  if (!res || !Array.isArray(res.lines)) return null;
  const m = new Map();
  for (const l of res.lines) { if (!ACTIONABLE_CLASSES.includes(l.class)) continue; const cur = m.get(l.source.key) || { key: l.source.key, name: pick(l.source, lang), overdue: 0, dueSoon: 0, count: 0 }; if (l.class === 'B') cur.overdue += l.remaining; else cur.dueSoon += l.remaining; cur.count += l.count; m.set(l.source.key, cur); }
  const items = [...m.values()].map((x) => ({ ...x, total: x.overdue + x.dueSoon })).filter((x) => x.total > 0).sort((a, b) => b.total - a.total || (a.key < b.key ? -1 : 1));
  if (!items.length) return null;
  const L = (a, e) => (lang === 'ar' ? a : e);
  return {
    items, total: sum(items, (x) => x.total),
    block: {
      type: 'chart', id: 'plan:sources', kind: 'hbar', ranked: true, unit: 'SAR', title: L('الرصيد القابل للمتابعة حسب مصدر الإيراد', 'Actionable balance by revenue source'),
      labels: items.map((x) => x.name), series: [{ label: L('قابل للمتابعة (متأخر حتى 180 يوماً + يستحق قبل نهاية السنة)', 'Actionable (overdue up to 180 days + due by year-end)'), values: items.map((x) => x.total) }], keys: items.map((x) => x.key),
      tips: items.map((x) => L(`متأخر ${Math.round(x.overdue).toLocaleString('en-US')} · يستحق ${Math.round(x.dueSoon).toLocaleString('en-US')} ريال · ${x.count} فاتورة`, `overdue ${Math.round(x.overdue).toLocaleString('en-US')} · falling due ${Math.round(x.dueSoon).toLocaleString('en-US')} SAR · ${x.count} invoices`)),
      cutoff: res.asOf || res.cutoff, selectedKey,
      note: L('أرصدة قائمة وليست انحرافاً: لا مستهدف لمصدر الإيراد فلا انحراف على مستوى المصدر، ولا تُوزَّع الخطة على المصادر.', 'Standing balances, not a deviation: there is no revenue-source target, so no source-level deviation exists and the plan is never allocated to sources.')
    }
  };
}

/* ---------------------------------------------------------------------------------------------------------- drill plumbing */
/** the /collection URL of a service drill ({ route, scope, filters:{ state, allPeriods, planLine:{ cls, blocker? } } }): the shared scope in the query, the plan line as `planLine=B,C` (+ `planBlocker`) */
export function drillUrl(drill) {
  if (!drill || !drill.route) return null;
  const p = new URLSearchParams(); const s = drill.scope || {};
  if (s.amanah && s.amanah !== 'all') p.set('amanah', s.amanah);
  if (s.source && s.source !== 'all') p.set('src', s.source);
  if (s.muni && s.muni !== 'all') p.set('muni', s.muni);
  if (s.from && s.to) { p.set('from', s.from); p.set('to', s.to); }
  const pl = drill.filters?.planLine;
  if (pl) { p.set('planLine', [].concat(pl.cls ?? []).join(',')); if (pl.blocker) p.set('planBlocker', pl.blocker); }
  if (drill.filters?.allPeriods) p.set('allPeriods', '1');
  return `${drill.route}?${p.toString()}`;
}
/** the inverse, for the /collection page: the `planLine` filter object of the query (or null) */
export function planLineFromQuery(get) {
  const raw = get('planLine'); if (!raw) return null;
  const cls = raw.split(',').map((x) => x.trim().toUpperCase()).filter((x) => ['A', 'B', 'C', 'D', 'E', 'U'].includes(x));
  if (!cls.length) return null;
  const blocker = get('planBlocker'); return { cls: cls.length === 1 ? cls[0] : cls, ...(blocker ? { blocker } : {}) };
}
export const PLAN_LINE_LABEL = {
  B: bi('متأخر حتى 180 يوماً', 'Overdue up to 180 days'), C: bi('يستحق قبل نهاية السنة', 'Due by year-end'), D: bi('متأخر أكثر من 180 يوماً', 'Overdue more than 180 days'), A: bi('عائق قائم', 'Blocked'), E: bi('يستحق بعد نهاية السنة', 'Due after year-end'), U: bi('تاريخ الاستحقاق غير متاح', 'Due date unavailable')
};
/** the chip text of an active plan-line filter on /collection */
export function planLineText(pl, lang = 'ar') {
  if (!pl) return '';
  const cls = [].concat(pl.cls ?? []);
  const key = cls.length === 2 && cls.includes('B') && cls.includes('C') ? bi('قابل للمتابعة: متأخر حتى 180 يوماً + يستحق قبل نهاية السنة', 'Actionable: overdue up to 180 days + due by year-end') : null;
  return key ? pick(key, lang) : cls.map((c) => pick(PLAN_LINE_LABEL[c], lang)).join(lang === 'ar' ? ' + ' : ' + ');
}
