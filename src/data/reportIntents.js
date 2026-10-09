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
import { startOfYear, startOfMonth, addDaysIso, isSingleMonth, daysBetweenIso } from './clock';
import { checkRange, rangeMessage } from './dateRange';
import { SECTION_ORDER, SECTION_META } from './reportModel';
import { sourceAr, sourceEn } from './insightsEngine';

const norm = (t) => String(t || '').toLowerCase().replace(/[ً-ٰٟ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ـ/g, '').replace(/[؟?!.,،؛:]/g, ' ').replace(/\s+/g, ' ').trim();
const has = (s, re) => re.test(s);

// Arabic names are written many ways («أمانة محافظة جدة» / «أمانة جدة» / «جدة»): drop the administrative prefix before matching
function parseAmanah(text) {
  const hits = new Set(parseAmanahStrict(text));
  for (const a of amanahOptionsOf()) { const core = (a.ar || '').replace(/^أمانة\s*(منطقة|محافظة|مدينة)?\s*/, '').trim(); const short = core.replace(/^المنطقة\s+/, ''); if ((core.length > 2 && text.includes(core)) || (short !== core && short.length > 2 && text.includes(short))) hits.add(a.key); }
  for (const [re, key] of AMANAH_ALIASES) if (re.test(text) && amanahOptionsOf().some((a) => a.key === key)) hits.add(key); // short everyday names
  return [...hits];
}
const AMANAH_ALIASES = [[/(?:^|\s)مكة(?:\s|$)|مكه/, 'Makkah Amanah'], [/(?:^|\s)(?:أمانة\s+)?المدينة(?:\s|$)/, 'Al Madinah Amanah']];
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
  ['channels', /(قنوات الدفع|قنوات السداد|قنوات)/],
  ['budget', /(الميزانيه|الميزانيات|المصروفات|المصاريف|الانفاق|النفقات|نغطي|تغطيه|تغطي|\bbudget\b|\bexpenditure\b|\bspending\b)/]
];
// English wording for the same sections (kept apart so the Arabic table stays readable)
const SECTION_WORDS_EN = [['sources', /\b(by|per) (revenue )?source|revenue sources/], ['amanah', /\b(by|per) amanah|compare amanahs|amanahs? performance/], ['aging', /\baging\b|\boverdue (balances|amounts|debts)\b|arrears/], ['exclusions', /\bexclusions?\b/], ['trends', /\b(monthly )?trend\b|month by month/], ['gaps', /\b(collection )?gaps\b|priorities/], ['status', /payment status|invoice status breakdown/], ['quality', /data quality|reconciliation/], ['channels', /payment channels/]];

export const SUPPORTED_HELP = {
  ar: ['الفترة: «هذا الشهر حتى اليوم»، «الشهر الماضي»، «السنة حتى اليوم»، «الربع الأول»، «مارس»', 'الأمانة والبلدية: «اعرض أمانة الرياض فقط»، «بلدية الرياض الشمالية»', 'المصدر: الاستثمار (فرص)، الغرامات، الرسوم البلدية، التراخيص، الإيواء، التبغ، الأراضي البيضاء', 'الحالة: «الفواتير المتأخرة فقط»، «الفواتير المحصّلة»، «الملغاة»', 'المقارنة: «قارن بالشهر الماضي»، «قارن بالعام الماضي»', 'الأقسام: مصادر الإيراد، الأمانات، المتأخرات، الاستبعادات، الاتجاه الشهري، فجوات التحصيل، حالة الدفع، جودة البيانات', 'التعميق: «حوّله إلى تقرير تفصيلي»، «أضف توزيع مصادر الإيراد»'],
  en: ['Period: “this month to date”, “last month”, “year to date”, “Q1”, “March”', 'Amanah / municipality: “show Riyadh Amanah only”', 'Source: Furas investment, fines, municipal fees, licences, accommodation, tobacco, white lands', 'Status: “overdue invoices only”, “collected”, “cancelled”', 'Comparison: “compare with last month / last year”', 'Sections: sources, Amanahs, aging, exclusions, monthly trend, gaps, payment status, data quality', 'Depth: “make it a detailed report”, “add the source breakdown”']
};

const STATUS_WORDS = [['overdue', /المتاخر|\boverdue\b/], ['collected', /(المحصله|المحصل بالكامل|المسدده|\bcollected invoices\b)/], ['cancelled', /(الملغاه|الملغيه|الملغاة|\bcancell?ed\b)/], ['excluded', /(المستبعده|المستبعدة|\bexcluded invoices\b)/], ['partial', /(الجزئيه|المسدده جزئيا|محصله جزئيا|\bpartial(ly paid)?\b)/], ['not_due', /(لم يحن|غير المستحقه|\bnot (yet )?due\b)/], ['open', /(غير المسدده|القائمه|المفتوحه|غير المحصله|\bopen invoices\b)/]];
const DIRECTION = [['North', /(شمال|الشماليه)/], ['Central', /(وسط|الوسطي|المركزيه)/], ['South', /(جنوب|الجنوبيه)/]];

const PERIOD_OPTIONS = [{ label: { ar: 'السنة حتى اليوم', en: 'Year to date' }, text: 'أنشئ تقرير الإيرادات للسنة حتى اليوم' }, { label: { ar: 'هذا الشهر حتى اليوم', en: 'This month to date' }, text: 'أنشئ تقرير الإيرادات لهذا الشهر حتى اليوم' }, { label: { ar: 'الشهر الماضي', en: 'Last month' }, text: 'أنشئ تقرير الإيرادات للشهر الماضي' }];
// wording that names a period but that parsePeriod cannot resolve («قبل شهرين»، «آخر 6 أشهر»، «الأسبوع الماضي»، "last 6 months")
const UNAPPLIED_PERIOD = /قبل\s*(?:\d+|شهرين|اسبوعين|عامين|سنتين)|اخر\s*\d+\s*(?:شهر|اشهر|اسبوع|اسابيع|ايام|يوم|سنوات|سنه)|(?:ال)?(?:اسبوع|يوم|ربع|عام|سنه)\s*(?:ال)?(?:ماضي|سابق|قادم|حالي)|(?:last|previous|past|next)\s*\d*\s*(?:week|weeks|day|days|months|year|years|quarter)/;
const QUARTER_NAMES = { q1: { ar: 'الربع الأول', en: 'The first quarter' }, q2: { ar: 'الربع الثاني', en: 'The second quarter' }, q3: { ar: 'الربع الثالث', en: 'The third quarter' }, q4: { ar: 'الربع الرابع', en: 'The fourth quarter' } };
function periodPreset(from, to, today) {
  if (from === startOfYear(today) && to === today) return 'ytd';
  if (from === startOfMonth(today) && to === today) return 'month';
  return 'custom';
}
export function previousMonthScope(scope, today) {
  // D-05: «the previous month» only makes sense for a single-month selection; for any other selection the comparison is the
  // immediately preceding period of EQUAL LENGTH (and the report says so), never one calendar month against 282 days.
  if (!isSingleMonth(scope)) { const len = daysBetweenIso(scope.from, scope.to) + 1; const to = addDaysIso(scope.from, -1); return { from: addDaysIso(to, -(len - 1)), to }; }
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

  // ---- comparison. Only the OBJECT of «قارن / مقارنة … / compare with …» is a comparison; a period word elsewhere in the sentence
  // («تقرير الشهر الماضي مقارنة بالعام الماضي») is the report period.
  const CMP_MONTH = /(?:ب|مع)?(?:ال)?شهر\s*(?:ال)?(?:ماضي|سابق)|(?:the\s+)?(?:last|previous)\s+month|الشهر اللي قبل/;
  const CMP_YEAR = /(?:ب|مع)?(?:ال)?(?:عام|سنه)\s*(?:ال)?(?:ماضي|سابق)|(?:the\s+)?(?:last|previous)\s+year|same period last year|نفس الفتره/;
  let t = s; let compareNew = null; let cmpPeriod = null;
  const trig = s.match(/(?:^|\s)(قارن|مقارنه|بالمقارنه|مقابل|compare|compared|versus|vs)(?=\s|$)/);
  if (trig) {
    const before = s.slice(0, trig.index); const after = s.slice(trig.index + trig[0].length);
    if (CMP_MONTH.test(after)) { compareNew = 'prev_month'; t = `${before} ${after.replace(CMP_MONTH, ' ')}`; }
    else if (CMP_YEAR.test(after)) { compareNew = 'prev_year'; t = `${before} ${after.replace(CMP_YEAR, ' ')}`; }
    else if (/^(قارن|مقارنه)( بالفتره السابقه)?$/.test(s) || /قارن (ذلك|هذا|التقرير)/.test(s)) compareNew = 'prev_year';
    else { const cp = parsePeriod(after, today, { reportFuture: true }); if (cp) { cmpPeriod = cp; t = before; } }
  }
  if (has(s, /(بدون مقارنه|الغ(ي)? المقارنه|احذف المقارنه)/)) compareNew = 'none';

  // ---- period
  const iso = raw.match(/(20\d{2}-\d{2}-\d{2})\s*(?:→|الى|إلى|to|-|–|حتى)\s*(20\d{2}-\d{2}-\d{2})/);
  let per = null;
  if (iso) {
    const r = checkRange({ from: iso[1], to: iso[2] }, { today });
    if (!r.ok) return { kind: 'clarify', spec, changes: [], question: { ar: rangeMessage(r.code, 'ar', { today }), en: rangeMessage(r.code, 'en', { today }) }, options: PERIOD_OPTIONS };
    per = { from: r.from, to: r.to, label: 'custom' };
  }
  else per = parsePeriod(t, today, { reportFuture: true });
  if (per && per.notStarted) { // D-04: a period that has not started is never turned into a reversed range
    const nm = QUARTER_NAMES[per.label] || null;
    const what = nm ? { ar: nm.ar, en: nm.en } : { ar: 'الشهر المطلوب', en: 'The month you asked for' };
    return { kind: 'clarify', spec, changes: [], question: { ar: `${what.ar} لم يبدأ بعد (يبدأ ${per.from}، وآخر بيانات ${today}). أي فترة تريد؟`, en: `${what.en} has not started yet (it starts ${per.from}; the latest data is ${today}). Which period do you want?` }, options: PERIOD_OPTIONS };
  }
  // F-05 guard: a period phrase that was recognised as a period but could not be applied is never ignored silently
  if (!per && !compareNew && UNAPPLIED_PERIOD.test(s)) return { kind: 'clarify', spec, changes: [], question: { ar: 'فهمتُ أنك تقصد فترة زمنية لكنني لا أستطيع تحديدها من هذه الصياغة. الفترات المدعومة: هذا الشهر، الشهر الماضي، السنة حتى اليوم، الربع الأول…، اسم شهر، أو «2026-01-01 إلى 2026-03-31». أي فترة تريد؟', en: 'I understood that you mean a period but cannot resolve it from this wording. Supported: this month, last month, year to date, Q1…, a month name, or “2026-01-01 to 2026-03-31”. Which period do you want?' }, options: PERIOD_OPTIONS };
  if (per && (per.from !== spec.scope.from || per.to !== spec.scope.to)) { spec.scope.from = per.from; spec.scope.to = per.to; spec.preset = periodPreset(per.from, per.to, today); note('period', 'period', `${per.from} → ${per.to}`); }
  if (cmpPeriod) { // «… مقارنة بأغسطس»: a named month is supported only when it is exactly the month before the report month
    const cur = { from: spec.scope.from, to: spec.scope.to };
    if (!cmpPeriod.notStarted && isSingleMonth(cur) && previousMonthScope(cur, today).from === cmpPeriod.from) compareNew = 'prev_month';
    else return { kind: 'clarify', spec: prev || spec, changes: [], question: { ar: 'المقارنة بفترة محددة بالاسم غير مدعومة إلا إذا كانت الشهر السابق مباشرة. المتاح: المقارنة بالشهر الماضي أو بنفس الفترة من العام الماضي.', en: 'Comparing with a named period is supported only when it is the month right before the report month. Available: last month, or the same period last year.' }, options: [{ label: { ar: 'مقارنة بالشهر الماضي', en: 'Compare with last month' }, text: 'قارن بالشهر الماضي' }, { label: { ar: 'مقارنة بالعام الماضي', en: 'Compare with last year' }, text: 'قارن بالعام الماضي' }] };
  }
  if (compareNew && compareNew !== spec.compare) { spec.compare = compareNew; note('compare', 'compare', compareNew); }

  // ---- Amanah / municipality
  if (has(s, /(كل الامانات|جميع الامانات|كل امانه)/) && spec.scope.amanah !== 'all') { spec.scope.amanah = 'all'; spec.scope.muni = 'all'; note('amanah', 'amanah', 'all'); }
  const am = parseAmanah(raw);
  const onlyOne = am.length === 1 ? am[0] : null;
  const cmpAmanahs = am.length >= 2 && !!trig; // «قارن الرياض بجدة»
  if (am.length >= 1 && (am.length === 1 ? !has(s, /بين الامانات/) : (cmpAmanahs || has(s, /(فقط|الامانات|^اعرض|^عرض|\bshow\b)/)) && !has(s, /بين الامانات/))) {
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
  const statusPhrase = has(s, /(الفواتير|فواتير|invoices)/) || has(s, /فقط|\bonly\b/) || has(s, /(كل الحالات|جميع الحالات|all statuses)/);
  if (statusPhrase) {
    const st = STATUS_WORDS.find(([, re]) => re.test(s));
    if (st && st[0] !== spec.scope.status) { spec.scope.status = st[0]; note('status', 'status', st[0]); }
    if (has(s, /(كل الحالات|جميع الحالات)/) && spec.scope.status !== 'all') { spec.scope.status = 'all'; note('status', 'status', 'all'); }
    const sc = has(s, /داخلي/) ? 'internal' : has(s, /مركزي/) ? 'central' : null;
    if (sc && sc !== spec.scope.scopeType) { spec.scope.scopeType = sc; note('scopeType', 'scopeType', sc); }
  }

  // ---- depth and sections
  const isQuestion = has(norm(raw + ' '), /^(كم|ما|ماذا|هل|لماذا|كيف|اين|اي|من)\b/) || /[؟?]\s*$/.test(raw);
  const createVerb = (has(s, /(انشئ|جهز|اعد|اعمل|ابني|حضر|اطلب|اريد|ابغى|ابي|اعطني|اعرض لي)/) && has(s, /تقرير/)) || (has(s, /\b(create|prepare|generate|make|build|show me|give me|i want|i need)\b/) && has(s, /\breport\b/));
  const monthlyLike = has(s, /(مشابه|مماثل|كالتقارير|التقارير المرفقه|تقرير شهري|تقريرا شهريا)/);
  const detailedWord = has(s, /(تفصيلي|مفصل|شامل|بالتفصيل|\bdetailed\b|\bfull report\b)/);
  const summaryWord = has(s, /(ملخص|موجز|مختصر|باختصار|\bsummary\b|\bbrief\b)/);
  const picked = [...SECTION_WORDS, ...SECTION_WORDS_EN].filter(([, re]) => re.test(s)).map(([k]) => k);
  if (has(s, /عدم التحصيل/) && !picked.includes('status')) picked.push('status');
  if (cmpAmanahs && !picked.includes('amanah')) picked.push('amanah'); // «قارن الرياض بجدة» → the Amanah comparison table for those two
  if (has(s, /المتاخرات/) && has(s, /(حسب مصدر|مصدر الايراد)/)) { if (!picked.includes('aging')) picked.push('aging'); if (!picked.includes('sources')) picked.push('sources'); }
  const addVerb = has(s, /(اضف|اضافه|ضيف|زد|اعرض ايضا|^مع |^و(?=مصادر|الاتجاه|المتاخر|الاستبعاد)|\badd\b|\balso\b|\binclude\b)/);
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

  if (trig && !compareNew && !cmpPeriod && !picked.length && !changes.length && !prev) return { kind: 'clarify', spec, changes: [], question: { ar: 'ماذا تريد أن أقارن؟ لا يوجد تقرير حالي أبني عليه المقارنة.', en: 'What should I compare? There is no current report to build the comparison on.' }, options: [{ label: { ar: 'أداء التحصيل بين الأمانات', en: 'Collection performance between Amanahs' }, text: 'قارن أداء التحصيل بين الأمانات' }, { label: { ar: 'تقرير هذا الشهر مقارناً بالشهر الماضي', en: 'This month’s report compared with last month' }, text: 'أنشئ تقرير الإيرادات لهذا الشهر حتى اليوم قارن بالشهر الماضي' }] };
  const domainQuestion = has(s, /(تحصيل|محصل|فاتور|ايراد|مفوتر|مستحق|متاخر|استبعاد|امانه|امانات|ميزاني|مصروف|انفاق|نفقات|نسبه|اداء|وضع|مبلغ|مبالغ|مصدر|collection|revenue|invoice|billed|overdue|exclusion|performance|doing|status|amanah|budget|rate|\bgaps?\b)/);
  const reportNoun = has(s, /(تقرير|تقريرا|report)/); // «تقرير الشهر الماضي» is a report request even when nothing needs to change
  const recognized = changes.length > 0 || picked.length > 0 || createVerb || reportNoun || monthlyLike || detailedWord || summaryWord || (isQuestion && domainQuestion);
  if (!recognized) return { kind: 'unsupported', spec: prev || spec, changes: [] };
  return { kind: isQuestion && !createVerb ? 'question' : 'report', spec, changes, sectionsChanged, startNew };
}

const STATUS_LABELS = { all: { ar: 'كل الحالات', en: 'All statuses' }, collected: { ar: 'محصّلة', en: 'Collected' }, open: { ar: 'قائمة', en: 'Open' }, overdue: { ar: 'متأخرة', en: 'Overdue' }, partial: { ar: 'جزئية', en: 'Partial' }, not_due: { ar: 'لم تستحق', en: 'Not due' }, cancelled: { ar: 'ملغاة', en: 'Cancelled' }, excluded: { ar: 'مستبعدة', en: 'Excluded' } };
export function describeChange(c, lang, { amanahLabel = (k) => k, spec } = {}) {
  const ar = lang === 'ar'; const L = (a, e) => (ar ? a : e);
  const lab = { sections: L('أُضيف قسم', 'Section added'), period: L('الفترة', 'Period'), amanah: L('الأمانة', 'Amanah'), muni: L('البلدية', 'Municipality'), source: L('المصدر', 'Source'), status: L('حالة الفاتورة', 'Invoice status'), scopeType: L('النطاق', 'Scope'), compare: L('المقارنة', 'Comparison'), depth: L('مستوى التفصيل', 'Depth'), reset: L('المرشحات', 'Filters') }[c.key];
  const v = c.key === 'amanah' ? (c.value === 'all' ? L('كل الأمانات', 'All Amanahs') : [].concat(c.value).map(amanahLabel).join('، '))
    : c.key === 'compare' ? ({ prev_month: spec && !isSingleMonth(spec.scope) ? L('الفترة السابقة المساوية في الطول', 'Preceding period of equal length') : L('الشهر الماضي (المدة المنقضية نفسها)', 'Last month (same elapsed days)'), prev_year: L('نفس الفترة من العام السابق', 'Same period last year'), none: L('بدون', 'None') }[c.value])
      : c.key === 'sections' ? String(c.value).split(',').map((k) => SECTION_META[k]?.[ar ? 'ar' : 'en'] || k).join('، ') : c.key === 'depth' ? L('تفصيلي', 'Detailed') : c.key === 'reset' ? L('أُعيدت إلى الافتراضي', 'Reset to default') : c.key === 'muni' ? (c.value === 'all' ? L('كل البلديات', 'All municipalities') : String(c.value).split('|').pop())
        : c.key === 'source' ? (c.value === 'all' ? L('كل المصادر', 'All sources') : (ar ? sourceAr(c.value) : sourceEn(c.value)))
          : c.key === 'status' ? (STATUS_LABELS[c.value]?.[ar ? 'ar' : 'en'] || String(c.value)) : String(c.value);
  return `${lab}: ${v}`;
}
export { addDaysIso };
