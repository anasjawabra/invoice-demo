// Follow-up suggestions drawn from WHAT THE REPORT CONTAINS (not a fixed list): the Amanah and source with the largest uncollected balance, the analyses still missing, the comparison if there is none.
// Each suggestion is an ordinary request the interpreter already understands; nothing here computes a figure. At most four.
const tableOf = (model, id) => model.sections.flatMap((s) => s.blocks).find((b) => b.type === 'table' && b.id === id) || null;
const topRow = (t, col = 6) => (t && t.rows.length ? t.rows.slice().sort((a, b) => (Number(b[col]) || 0) - (Number(a[col]) || 0))[0] : null);

export function suggestionsFor(model, spec) {
  if (!model || model.empty) return [];
  const out = []; const has = (k) => model.sections.some((s) => s.key === k);
  const oneAmanah = spec && spec.scope && spec.scope.amanah !== 'all'; const oneSource = spec && spec.scope && spec.scope.source !== 'all';
  if (!oneAmanah) { const r = topRow(tableOf(model, 'amanah')); if (r && Number(r[6]) > 0) out.push({ ar: `اعرض ${r[0]} فقط`, en: `Show ${r[0]} only`, why: { ar: 'الأعلى غير محصّل في التقرير', en: 'largest uncollected in the report' } }); }
  if (!oneSource) { const r = topRow(tableOf(model, 'sources')); if (r && Number(r[6]) > 0) out.push({ ar: `اعرض ${r[0]} فقط`, en: `Show ${r[0]} only`, why: { ar: 'الأعلى غير محصّل في التقرير', en: 'largest uncollected in the report' } }); }
  const missing = [['trends', 'أضف الاتجاه الشهري', 'Add the monthly trend'], ['aging', 'أضف تحليل المتأخرات والأعمار', 'Add the overdue and aging analysis'], ['exclusions', 'أضف تحليل الاستبعادات', 'Add the exclusions analysis'], ['amanah', 'أضف مقارنة الأمانات', 'Add the Amanah comparison'], ['sources', 'أضف مصادر الإيراد', 'Add the revenue sources']].filter(([k]) => !has(k));
  for (const [, ar, en] of missing.slice(0, 2)) out.push({ ar, en });
  if (model.compare === 'none') out.push({ ar: 'قارن بالعام الماضي', en: 'Compare with last year' });
  out.push({ ar: 'حوّله إلى عرض تقديمي', en: 'Turn it into a presentation' });
  const seen = new Set(); return out.filter((s) => (seen.has(s.ar) ? false : seen.add(s.ar))).slice(0, 4);
}
