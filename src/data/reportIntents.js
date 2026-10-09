// ============================================================================
// Request interpreter for the unified «التقارير الذكية» conversation. RULE-BASED (keywords + the shared period / Amanah / source
// parsers) — not a language model, and the UI says so. It turns a sentence into a report SPEC and lists which context fields the
// sentence changed, so the visible filter chips can update. Fields the sentence does not mention are kept (follow-ups preserve
// the existing filters).
//
// spec = { title, preset, scope:{from,to,amanah,source,scopeType,muni,status}, compare:'none'|'prev_month'|'prev_year',
//          depth:'summary'|'detailed', sections:[...] }
// ============================================================================
import { parsePeriod, parseAmanah as parseAmanahStrict, parseSource } from './assistantRouter';
import { amanahOptionsOf } from './revenueLedger';
import { startOfYear, startOfMonth, addDaysIso } from './clock';
import { SECTION_ORDER, SECTION_META } from './reportModel';
import { sourceAr, sourceEn } from './insightsEngine';

const norm = (t) => String(t || '').toLowerCase().replace(/[ً-ٰٟ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ـ/g, '').replace(/[؟?!.,،؛:]/g, ' ').replace(/\s+/g, ' ').trim();
const has = (s, re) => re.test(s);

// Arabic names are written many ways («أمانة محافظة جدة» / «أمانة جدة» / «جدة»): drop the administrative prefix before matching
function parseAmanah(text) {
  const hits = new Set(parseAmanahStrict(text));
  for (const a of amanahOptionsOf()) { const core = (a.ar || '').replace(/^أمانة\s*(منطقة|محافظة|مدينة)?\s*/, '').trim(); if (core.length > 2 && text.includes(core)) hits.add(a.key); }
  return [...hits];
}
export const defaultSpec = (today) => ({ title: '', preset: 'ytd', scope: { from: startOfYear(today), to: today, amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all' }, compare: 'none', depth: 'summary', sections: ['executive'] });

const DETAILED = ['executive', 'trends', 'amanah', 'sources', 'aging', 'exclusions', 'gaps', 'status', 'quality'];
const MONTHLY_TEMPLATE = ['executive', 'sources', 'amanah', 'exclusions', 'gaps'];

const SECTION_WORDS = [
  ['sources', /(مصادر الايراد|حسب المصدر|توزيع (ال)?مصادر|توزيع الايرادات|مصدر الايراد|اداء المصادر)/],
  ['amanah', /(بين الامانات|اداء الامانات|مقارنه الامانات|حسب الامانه|حسب الامانات|توزيع الامانات|الامانات والبلديات|حسب البلديه|الامانات)/],
  ['aging', /(المتاخرات|التقادم|الاعمار|اعمار الديون|اعمار|المتاخره)/],
  ['exclusions', /(الاستبعاد|الاستبعادات|المستبعد|اسباب عدم التحصيل|عدم التحصيل)/],
  ['trends', /(الاتجاه|الترند|شهرا بشهر|الاتجاه الشهري|تطور|حسب الشهر)/],
  ['gaps', /(فجوات|الفجوه|اولويات|فرص التحصيل|اولويه المتابعه)/],
  ['status', /(حاله الدفع|حالات الفواتير|حاله الفاتوره|عدد الفواتير|حسب الحاله)/],
  ['quality', /(جوده البيانات|اكتمال|مطابقه|تعارضات)/],
  ['bases', /(اساس القياس|اساسين|اساس التقرير)/],
  ['channels', /(قنوات الدفع|قنوات السداد|قنوات)/]
];

export const SUPPORTED_HELP = {
  ar: ['الفترة: «هذا الشهر حتى اليوم»، «الشهر الماضي»، «السنة حتى اليوم»، «الربع الأول»، «مارس»', 'الأمانة والبلدية: «اعرض أمانة الرياض فقط»، «بلدية الرياض الشمالية»', 'المصدر: الاستثمار (فرص)، الغرامات، الرسوم البلدية، التراخيص، الإيواء، التبغ، الأراضي البيضاء', 'الحالة: «الفواتير المتأخرة فقط»، «الفواتير المحصّلة»، «الملغاة»', 'المقارنة: «قارن بالشهر الماضي»، «قارن بالعام الماضي»', 'الأقسام: مصادر الإيراد، الأمانات، المتأخرات، الاستبعادات، الاتجاه الشهري، فجوات التحصيل، حالة الدفع، جودة البيانات', 'التعميق: «حوّله إلى تقرير تفصيلي»، «أضف توزيع مصادر الإيراد»'],
  en: ['Period: “this month to date”, “last month”, “year to date”, “Q1”, “March”', 'Amanah / municipality: “show Riyadh Amanah only”', 'Source: Furas investment, fines, municipal fees, licences, accommodation, tobacco, white lands', 'Status: “overdue invoices only”, “collected”, “cancelled”', 'Comparison: “compare with last month / last year”', 'Sections: sources, Amanahs, aging, exclusions, monthly trend, gaps, payment status, data quality', 'Depth: “make it a detailed report”, “add the source breakdown”']
};

const STATUS_WORDS = [['overdue', /المتاخر/], ['collected', /(المحصله|المحصل بالكامل|المسدده)/], ['cancelled', /(الملغاه|الملغيه|الملغاة)/], ['excluded', /(المستبعده|المستبعدة)/], ['partial', /(الجزئيه|المسدده جزئيا|محصله جزئيا)/], ['not_due', /(لم يحن|غير المستحقه)/], ['open', /(غير المسدده|القائمه|المفتوحه|غير المحصله)/]];
const DIRECTION = [['North', /(شمال|الشماليه)/], ['Central', /(وسط|الوسطي|المركزيه)/], ['South', /(جنوب|الجنوبيه)/]];

function periodPreset(from, to, today) {
  if (from === startOfYear(today) && to === today) return 'ytd';
  if (from === startOfMonth(today) && to === today) return 'month';
  return 'custom';
}
export function previousMonthScope(scope, today) {
  // same elapsed days of the previous calendar month (clamped), so a partial month is compared with an equivalent partial month
  const y = Number(scope.from.slice(0, 4)); const m = Number(scope.from.slice(5, 7)); const day = Number(scope.to.slice(8, 10));
  const py = m === 1 ? y - 1 : y; const pm = m === 1 ? 12 : m - 1; const dim = new Date(Date.UTC(py, pm, 0)).getUTCDate();
  const mm = String(pm).padStart(2, '0');
  const sameMonth = scope.from.slice(0, 7) === scope.to.slice(0, 7);
  return { from: `${py}-${mm}-01`, to: sameMonth ? `${py}-${mm}-${String(Math.min(day, dim)).padStart(2, '0')}` : `${py}-${mm}-${String(dim).padStart(2, '0')}` };
}

export function interpret(text, prev, today, { amanahLabel = (k) => k, base: baseSpec = null } = {}) {
  const s = norm(text); const raw = String(text || '');
  const base = prev ? JSON.parse(JSON.stringify(prev)) : JSON.parse(JSON.stringify(baseSpec || defaultSpec(today)));
  const spec = base; const changes = []; const note = (key, label, value) => changes.push({ key, label, value });
  if (!s) return { kind: 'empty', spec, changes };

  // ---- one focused clarification when the request is materially ambiguous
  const amHits = parseAmanah(raw);
  if (!prev && has(s, /^(قارن|مقارنه)( بالشهر الماضي| بالعام الماضي| بالفتره السابقه)?$/)) return { kind: 'clarify', spec, changes: [], question: { ar: 'ماذا تريد أن أقارن؟ لا يوجد تقرير حالي أبني عليه المقارنة.', en: 'What should I compare? There is no current report to build the comparison on.' }, options: [{ label: { ar: 'أداء التحصيل بين الأمانات', en: 'Collection performance between Amanahs' }, text: 'قارن أداء التحصيل بين الأمانات' }, { label: { ar: 'تقرير هذا الشهر مقارناً بالشهر الماضي', en: 'This month’s report compared with last month' }, text: 'أنشئ تقرير الإيرادات لهذا الشهر حتى اليوم قارن بالشهر الماضي' }] };
  if (amHits.length > 1 && has(s, /فقط/)) return { kind: 'clarify', spec, changes: [], question: { ar: 'ذكرتَ أكثر من أمانة مع «فقط». أيها تريد؟', en: 'You named more than one Amanah with “only”. Which one?' }, options: amHits.slice(0, 4).map((k) => ({ label: { ar: amanahLabel(k), en: amanahLabel(k) }, text: `اعرض أمانة ${amanahLabel(k).replace(/^أمانة\s*(منطقة\s*)?/, '')} فقط` })) };
  // ---- reset
  const reset = has(s, /(ابدا من جديد|ازل (كل )?المرشحات|الغ(ي)? (كل )?المرشحات|بدون مرشحات|كل المرشحات)/);
  if (reset) { const d = defaultSpec(today); spec.scope = d.scope; spec.preset = d.preset; spec.compare = 'none'; note('reset', 'reset', null); }

  // ---- comparison (extracted first so «الشهر الماضي» in «قارن بالشهر الماضي» is NOT read as the report period)
  let t = raw; let compareNew = null;
  if (has(s, /(قارن|مقارنه|بالمقارنه|مقابل)/)) {
    if (has(s, /(الشهر الماضي|الشهر السابق|الشهر اللي قبل)/)) { compareNew = 'prev_month'; t = t.replace(/(الشهر الماضي|الشهر السابق)/g, ' '); }
    else if (has(s, /(العام الماضي|السنه الماضيه|العام السابق|السنه السابقه|نفس الفتره)/)) { compareNew = 'prev_year'; t = t.replace(/(العام الماضي|السنة الماضية|العام السابق|السنة السابقة)/g, ' '); }
    else if (has(s, /^(قارن|مقارنه)( بالفتره السابقه)?$/) || has(s, /قارن (ذلك|هذا|التقرير)/)) compareNew = 'prev_year';
  }
  if (has(s, /(بدون مقارنه|الغ(ي)? المقارنه|احذف المقارنه)/)) compareNew = 'none';
  if (compareNew && compareNew !== spec.compare) { spec.compare = compareNew; note('compare', 'compare', compareNew); }

  // ---- period
  const iso = raw.match(/(20\d{2}-\d{2}-\d{2})\s*(?:→|الى|إلى|to|-|–|حتى)\s*(20\d{2}-\d{2}-\d{2})/);
  let per = null;
  if (iso) per = { from: iso[1], to: iso[2] > today ? today : iso[2], label: 'custom' };
  else per = parsePeriod(t, today);
  if (per && (per.from !== spec.scope.from || per.to !== spec.scope.to)) { spec.scope.from = per.from; spec.scope.to = per.to; spec.preset = periodPreset(per.from, per.to, today); note('period', 'period', `${per.from} → ${per.to}`); }

  // ---- Amanah / municipality
  if (has(s, /(كل الامانات|جميع الامانات|كل امانه)/) && spec.scope.amanah !== 'all') { spec.scope.amanah = 'all'; spec.scope.muni = 'all'; note('amanah', 'amanah', 'all'); }
  const am = parseAmanah(raw);
  const onlyOne = am.length === 1 ? am[0] : null;
  if (am.length >= 1 && has(s, /(الامانه|امانه|فقط|بلديه|امانات)/) && !(am.length > 1 && has(s, /بين الامانات/))) {
    const val = am.length === 1 ? am[0] : am;
    if (JSON.stringify(val) !== JSON.stringify(spec.scope.amanah)) { spec.scope.amanah = val; spec.scope.muni = 'all'; note('amanah', 'amanah', val); }
  }
  if (has(s, /بلديه/) && !has(s, /(كل البلديات|جميع البلديات)/)) {
    const ent = typeof spec.scope.amanah === 'string' && spec.scope.amanah !== 'all' ? spec.scope.amanah : onlyOne;
    const dir = DIRECTION.find(([, re]) => re.test(s));
    if (ent && dir) { const key = `${ent}|${dir[0]}`; if (spec.scope.muni !== key) { spec.scope.amanah = ent; spec.scope.muni = key; note('muni', 'muni', key); } }
  }
  if (has(s, /(كل البلديات|جميع البلديات)/) && spec.scope.muni !== 'all') { spec.scope.muni = 'all'; note('muni', 'muni', 'all'); }

  // ---- source
  if (has(s, /(كل المصادر|جميع المصادر|كل مصادر الايراد)/) && spec.scope.source !== 'all') { spec.scope.source = 'all'; note('source', 'source', 'all'); }
  const src = parseSource(raw);
  if (src && src !== spec.scope.source && !has(s, /(توزيع|حسب).{0,12}(مصدر|المصادر)/)) { spec.scope.source = src; note('source', 'source', src); }

  // ---- status and scope type (only with an explicit "invoices … only" phrasing, so «المتأخرات حسب المصدر» stays a report SECTION)
  const statusPhrase = has(s, /(الفواتير|فواتير)/) || has(s, /فقط/);
  if (statusPhrase) {
    const st = STATUS_WORDS.find(([, re]) => re.test(s));
    if (st && st[0] !== spec.scope.status) { spec.scope.status = st[0]; note('status', 'status', st[0]); }
    if (has(s, /(كل الحالات|جميع الحالات)/) && spec.scope.status !== 'all') { spec.scope.status = 'all'; note('status', 'status', 'all'); }
    const sc = has(s, /داخلي/) ? 'internal' : has(s, /مركزي/) ? 'central' : null;
    if (sc && sc !== spec.scope.scopeType) { spec.scope.scopeType = sc; note('scopeType', 'scopeType', sc); }
  }

  // ---- depth and sections
  const isQuestion = has(norm(raw + ' '), /^(كم|ما|ماذا|هل|لماذا|كيف|اين|اي|من)\b/) || /[؟?]\s*$/.test(raw);
  const createVerb = has(s, /(انشئ|جهز|اعد|اعمل|ابني|حضر|اطلب|اريد|ابغى|ابي|اعطني|اعرض لي)/) && has(s, /تقرير/);
  const monthlyLike = has(s, /(مشابه|مماثل|كالتقارير|التقارير المرفقه|تقرير شهري|تقريرا شهريا)/);
  const detailedWord = has(s, /(تفصيلي|مفصل|شامل|بالتفصيل)/);
  const summaryWord = has(s, /(ملخص|موجز|مختصر|باختصار)/);
  const picked = SECTION_WORDS.filter(([, re]) => re.test(s)).map(([k]) => k);
  if (has(s, /عدم التحصيل/) && !picked.includes('status')) picked.push('status');
  if (has(s, /المتاخرات/) && has(s, /(حسب مصدر|مصدر الايراد)/)) { if (!picked.includes('aging')) picked.push('aging'); if (!picked.includes('sources')) picked.push('sources'); }
  const addVerb = has(s, /(اضف|اضافه|ضيف|زد|اعرض ايضا|^مع )/);
  let sections = spec.sections.slice();
  if (monthlyLike) {
    sections = MONTHLY_TEMPLATE.slice(); spec.depth = 'summary';
    if (!iso && !per) { spec.scope.from = startOfMonth(today); spec.scope.to = today; spec.preset = 'month'; note('period', 'period', `${spec.scope.from} → ${spec.scope.to}`); }
    if (spec.compare === 'none') { spec.compare = 'prev_year'; note('compare', 'compare', 'prev_year'); }
  } else if (detailedWord) { sections = DETAILED.slice(); if (spec.depth !== 'detailed') note('depth', 'depth', 'detailed'); spec.depth = 'detailed'; }
  else if (picked.length) sections = addVerb && prev ? [...new Set([...sections, ...picked])] : picked.slice();
  else if (summaryWord || (isQuestion && !prev) || !prev || createVerb || (isQuestion && !changes.length)) sections = ['executive'];
  sections = SECTION_ORDER.filter((k) => sections.includes(k));
  if (!sections.length) sections = ['executive'];
  const sectionsChanged = JSON.stringify(sections) !== JSON.stringify(prev?.sections);
  if (prev && sectionsChanged) { const added = sections.filter((k) => !(prev.sections || []).includes(k)); if (added.length) note('sections', 'sections', added.join(',')); }
  spec.sections = sections;
  if (!detailedWord && (summaryWord || createVerb || !prev) && !monthlyLike) spec.depth = 'summary';
  const startNew = createVerb || reset || !prev;

  const recognized = changes.length > 0 || picked.length > 0 || createVerb || monthlyLike || detailedWord || summaryWord || isQuestion;
  if (!recognized) return { kind: 'unsupported', spec: prev || spec, changes: [] };
  return { kind: isQuestion && !createVerb ? 'question' : 'report', spec, changes, sectionsChanged, startNew };
}

const STATUS_LABELS = { all: { ar: 'كل الحالات', en: 'All statuses' }, collected: { ar: 'محصّلة', en: 'Collected' }, open: { ar: 'قائمة', en: 'Open' }, overdue: { ar: 'متأخرة', en: 'Overdue' }, partial: { ar: 'جزئية', en: 'Partial' }, not_due: { ar: 'لم تستحق', en: 'Not due' }, cancelled: { ar: 'ملغاة', en: 'Cancelled' }, excluded: { ar: 'مستبعدة', en: 'Excluded' } };
export function describeChange(c, lang, { amanahLabel = (k) => k, spec } = {}) {
  const ar = lang === 'ar'; const L = (a, e) => (ar ? a : e);
  const lab = { sections: L('أُضيف قسم', 'Section added'), period: L('الفترة', 'Period'), amanah: L('الأمانة', 'Amanah'), muni: L('البلدية', 'Municipality'), source: L('المصدر', 'Source'), status: L('حالة الفاتورة', 'Invoice status'), scopeType: L('النطاق', 'Scope'), compare: L('المقارنة', 'Comparison'), depth: L('مستوى التفصيل', 'Depth'), reset: L('المرشحات', 'Filters') }[c.key];
  const v = c.key === 'amanah' ? (c.value === 'all' ? L('كل الأمانات', 'All Amanahs') : [].concat(c.value).map(amanahLabel).join('، '))
    : c.key === 'compare' ? ({ prev_month: L('الشهر الماضي (المدة المنقضية نفسها)', 'Last month (same elapsed days)'), prev_year: L('نفس الفترة من العام السابق', 'Same period last year'), none: L('بدون', 'None') }[c.value])
      : c.key === 'sections' ? String(c.value).split(',').map((k) => SECTION_META[k]?.[ar ? 'ar' : 'en'] || k).join('، ') : c.key === 'depth' ? L('تفصيلي', 'Detailed') : c.key === 'reset' ? L('أُعيدت إلى الافتراضي', 'Reset to default') : c.key === 'muni' ? (c.value === 'all' ? L('كل البلديات', 'All municipalities') : String(c.value).split('|').pop())
        : c.key === 'source' ? (c.value === 'all' ? L('كل المصادر', 'All sources') : (ar ? sourceAr(c.value) : sourceEn(c.value)))
          : c.key === 'status' ? (STATUS_LABELS[c.value]?.[ar ? 'ar' : 'en'] || String(c.value)) : String(c.value);
  return `${lab}: ${v}`;
}
export { addDaysIso };
