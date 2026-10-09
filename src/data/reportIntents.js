// ============================================================================
// Request interpreter for the unified «التقارير الذكية» conversation. RULE-BASED (keywords + the shared period / Amanah / source
// parsers) — not a language model, and the UI says so. It turns a sentence into a report SPEC and lists which context fields the
// sentence changed, so the visible filter chips can update. Fields the sentence does not mention are kept (follow-ups preserve
// the existing filters).
//
// spec = { title, preset, scope:{from,to,amanah,source,scopeType,muni,status}, compare:'none'|'prev_month'|'prev_year',
//          depth:'summary'|'detailed', sections:[...] }
// ============================================================================
import { normAr, parsePeriod, parseDayRange, monthsInOrder, parseAmanah as parseAmanahStrict, parseSource, sourcesMentioned, periodMentions } from './assistantRouter';
import { amanahOptionsOf, REVENUE_SOURCE_KEYS } from './revenueLedger';
import { startOfYear, startOfMonth, addDaysIso, isSingleMonth, daysBetweenIso, fmtRangeText } from './clock';
import { checkRange, rangeMessage } from './dateRange';
import { detectPreset } from './periodPresets';
import { SECTION_ORDER, SECTION_META } from './reportModel';
import { sourceAr, sourceEn } from './insightsEngine';
import { findUnapplied, stripUnapplied } from './requestGuard';

const norm = (t) => String(t || '').toLowerCase().replace(/[ً-ٰٟ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ـ/g, '').replace(/[؟?!.,،؛:]/g, ' ').replace(/\s+/g, ' ').trim();
const has = (s, re) => re.test(s);

// Arabic names are written many ways («أمانة محافظة جدة» / «أمانة جدة» / «جدة»): drop the administrative prefix before matching
function parseAmanah(text) {
  const hits = new Set(parseAmanahStrict(text)); const nt = normAr(text);
  const mentions = (n) => { const m = normAr(n); return nt.includes(m) || (n.startsWith('ال') && n.length > 4 && nt.includes(normAr(`لل${n.slice(2)}`))); }; // spelling folded; «للقصيم» = ل + «القصيم»
  for (const a of amanahOptionsOf()) { const core = (a.ar || '').replace(/^أمانة\s*(منطقة|محافظة|مدينة)?\s*/, '').trim(); const short = core.replace(/^المنطقة\s+/, ''); if ((core.length > 2 && mentions(core)) || (short !== core && short.length > 2 && mentions(short))) hits.add(a.key); }
  for (const [re, key] of AMANAH_ALIASES) if (re.test(text) && amanahOptionsOf().some((a) => a.key === key)) hits.add(key); // short everyday names
  return [...hits];
}
const AMANAH_ALIASES = [[/(?:^|\s)[بلوف]?مك[ةه](?![\u0621-\u064A])|العاصم[ةه] المقدس[ةه]/, 'Makkah Amanah'], [/(?:^|\s)(?:أمانة\s+)?المدينة(?:\s|$)/, 'Al Madinah Amanah'], [/\beastern\b/i, 'Eastern Province Amanah'], [/\bha[' ’]?il\b/i, "Ha'il Amanah"], [/\bjizan\b/i, 'Jazan Amanah'], [/\b(?:mecca|makka)\b/i, 'Makkah Amanah'], [/\b(?:medina|madina)\b/i, 'Al Madinah Amanah'], [/\b(?:ahsa|al[- ]?hasa|hofuf)\b/i, 'Al-Ahsa Amanah'], [/\b(?:qassim|qasim|buraydah|buraidah)\b/i, 'Al-Qassim Amanah'], [/\b(?:hafar|hafr)\b/i, 'Hafr Al-Batin Amanah'], [/\b(?:ta[' ’]?if)\b/i, 'Taif Amanah'], [/\bbaha\b/i, 'Al Bahah Amanah'], [/\bjouf\b/i, 'Al Jawf Amanah']];
export const defaultSpec = (today) => ({ title: '', preset: 'ytd', scope: { from: startOfYear(today), to: today, amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all' }, compare: 'none', depth: 'summary', sections: ['executive'] });

const DETAILED = ['executive', 'trends', 'amanah', 'sources', 'aging', 'exclusions', 'gaps', 'status', 'quality'];
const MONTHLY_TEMPLATE = ['executive', 'sources', 'amanah', 'exclusions', 'gaps'];

const SECTION_WORDS = [
  ['sources', /(مصادر الايراد|حسب المصدر|توزيع (ال)?مصادر|توزيع الايرادات|مصدر الايراد|اداء المصادر|(?:^|\s)و?المصادر(?:\s|$))/],
  ['amanah', /(بين الامانات|اداء الامانات|مقارنه الامانات|حسب الامانه|حسب الامانات|توزيع الامانات|الامانات والبلديات|حسب البلديه|الامانات)/],
  ['aging', /(المتاخرات|التقادم|الاعمار|اعمار الديون|اعمار|المتاخره)/],
  ['exclusions', /(الاستبعاد|الاستبعادات|المستبعد|اسباب عدم التحصيل|عدم التحصيل)/],
  ['trends', /(الاتجاه|الترند|شهرا بشهر|الاتجاه الشهري|تطور|حسب الشهر)/],
  ['gaps', /(فجوات|الفجوه|اولويات|فرص التحصيل|اولويه المتابعه)/],
  ['status', /(حاله الدفع|حالات الفواتير|حاله الفاتوره|عدد الفواتير|حسب الحاله)/],
  ['quality', /(جوده (?:ال)?بيانات|اكتمال|مطابقه|تعارضات)/],
  ['bases', /(اساس القياس|اساسين|اساس التقرير)/],
  ['channels', /(قنوات الدفع|قنوات السداد|قنوات)/],
  ['budget', /(الميزانيه|الميزانيات|المصروفات|المصاريف|الانفاق|النفقات|نغطي|تغطيه|تغطي|\bbudget\b|\bexpenditure\b|\bspending\b)/]
];
// English wording for the same sections (kept apart so the Arabic table stays readable)
const SECTION_WORDS_EN = [['sources', /\b(by|per) (revenue )?source|revenue sources/], ['amanah', /\b(by|per) amanah|compare amanahs|amanahs? performance/], ['aging', /\baging\b|\boverdue (balances|amounts|debts)\b|arrears/], ['exclusions', /\bexclusions?\b/], ['trends', /\b(monthly )?trend\b|month by month/], ['gaps', /\b(collection )?gaps\b|priorities/], ['status', /payment status|invoice status breakdown/], ['quality', /data quality|reconciliation/], ['channels', /payment channels/]];

// ---- words the interpreter knows: anything else next to a request is reported, not ignored ----
// The vocabulary is built from the very patterns the interpreter applies (sections, statuses, directions) plus plain function words, amanah / source / month names.
const FUNCTION_WORDS = `تقرير تقارير تقريرا انشئ انشي جهز جهزلي اعد اعمل ابني حضر اطلب اريد ابغي ابغى ابي ابغا اعطني اعرض اعرضه اعرضها ورني وريني اظهر شوف نشوف خلنا خلني اضف اضافه ضيف زد ازل امسح احذف الغ الغي غير غيرها غيره حول حوله حوّله حوله اجعل اجعله اجعلها ركز ركّز ثم وثم والان الان الآن ايضا كذلك مجددا
هل ما ماذا كم كيف لماذا اين اي ايه من مع الي الى علي على عن في فيه فيها بين حتي حتى منذ خلال قبل بعد هذا هذه هذي ذلك تلك هو هي هم و او ام ثم لكن بل لا نعم فقط بس كل جميع كامل كاملة كاملا بدلا بدل منها منه عنها عنه نفس الشي الشيء الشيئ ضمن عند لدي لي لنا انا نحن انت لك له لها لهم
عام العام السنه سنه الشهر شهر شهرا اشهر الاشهر اسبوع الاسبوع يوم اليوم الربع ربع الاول الثاني الثالث الرابع الاخير الاخيره الاولي الثانيه الماضي الماضيه السابق السابقه الحالي الحاليه الجاري الجاريه القادم الفتره فتره فترة الفترة المقارنه مقارنه قارن بالمقارنه مقابل مقارنا مقارنة بدون دون
الايرادات الايراد ايرادات ايراد التحصيل تحصيل المحصل المحصله محصل المفوتر الفواتير فواتير الفاتوره فاتوره المتاخره المتاخرات متاخر المسدده المدفوعه المستبعده المستبعد الاستبعادات الاستبعاد الملغاه الجزئيه جزئيا القائمه المفتوحه الصادره صادره اجمالي صافي نسبه النسبه اداء الاداء وضع حاله الحاله حالات الحالات تفاصيل تفصيلي مفصل ملخص موجز مختصر شامل تنفيذي
الامانه الامانات امانه امانات امانة البلديه البلديات بلديه المصدر المصادر مصدر الايواء الاستثمار الغرامات الرسوم رسوم الاراضي البيضاء التراخيص الرخص التبغ الاسكان المبيعات السكنيه البلدي الفرص فرص
مركزي داخلي المركزي الداخلي شمال جنوب وسط الشمالي الجنوبي الوسطي بلدية الي
حتي اليوم اخر آخر اول الاخير الاخيرة كذا ربما ممكن لو اذا اذا ايضاً ايضا مثلا مثل
فات فايت الفايت اللي الذي التي الذين ثلاث ثلاثه ثلاثة اربع اربعه خمس خمسه ست ستة سبع ثمان تسع عشر اثنين اثنان شهرين سنتين العاصمه المقدسه المقدسة three two four five six seven twelve few couple
شهري شهريا شهرياً مشابه مرفقه مبيعات تحليل بدايه نهايه جزاء جزاءات الجزاءات مخالفات المخالفات مخالفه رخص ترخيص تراخيص بناء البناء fiscal time analysis so far summary executive
report reports create prepare generate make build show give want need please me my the a an of for in on at to from with and or by vs versus only just all every each this that these those it its is are was were be been do does did can could would should will what which when why how who whom
revenue revenues collection collections collected invoice invoices billed billing overdue open partial partially paid unpaid cancelled canceled excluded exclusion exclusions cancelled summary detailed brief full compare compared comparison than last previous past current month months quarter quarters year years week today yesterday ytd mtd qtd q1 q2 q3 q4 first second third fourth period date dates
amanah amanahs municipality municipalities source sources status trend trends aging gaps budget performance rate rates total net gross amount amounts figures numbers data about between during since until up
january february march april may june july august september october november december jan feb mar apr jun jul aug sep sept oct nov dec`;
const wordsOf = (src) => String(src).replace(/\\[a-zA-Z]/g, ' ').match(/[\u0621-\u064Aa-z0-9]{2,}/gi) || [];
let KNOWN = null;
function knownWords() {
  if (KNOWN) return KNOWN;
  const set = new Set();
  const add = (w) => { const n = norm(w); if (n) n.split(' ').forEach((x) => x && set.add(x)); };
  FUNCTION_WORDS.split(/\s+/).forEach(add);
  [...SECTION_WORDS, ...SECTION_WORDS_EN, ...STATUS_WORDS, ...DIRECTION].forEach(([, re]) => wordsOf(re.source).forEach(add));
  for (const a of amanahOptionsOf()) { [a.ar, a.en, String(a.key || '')].forEach((t) => String(t || '').split(/[\s\-/|]+/).forEach(add)); }
  for (const k of REVENUE_SOURCE_KEYS) { [sourceAr(k), sourceEn(k), k].forEach((t) => String(t || '').split(/[\s\-/_]+/).forEach(add)); }
  ['يناير', 'فبراير', 'مارس', 'ابريل', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'اغسطس', 'أغسطس', 'سبتمبر', 'اكتوبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'].forEach(add);
  KNOWN = set; return set;
}
const PREFIXES = ['', 'و', 'ف', 'ب', 'ل', 'ك', 'ال', 'وال', 'بال', 'لل', 'كال', 'فال', 'ول', 'وب', 'ولل', 'ولا', 'لا'];
function isKnown(tok, set) {
  if (set.has(tok)) return true;
  for (const p of PREFIXES) if (p && tok.startsWith(p) && tok.length - p.length >= 2 && (set.has(tok.slice(p.length)) || set.has(`ال${tok.slice(p.length)}`) || (p === 'لل' && set.has(`ال${tok.slice(2)}`)))) return true;
  if (/^[a-z]+$/.test(tok) && (set.has(tok.replace(/(?:es|s|ed|ing)$/, '')) || set.has(tok.replace(/(?:ies)$/, 'y')))) return true;
  return false;
}
// Unknown words that stand where a qualifier would: right after «report / for / of / about / in / on / عن / في / على / حول» or glued to «ل / ب».
// (Numbers, dates and 1-2 letter words are ignored; a verb or filler the vocabulary lacks elsewhere in the sentence is not reported.)
const CUE = new Set(['تقرير', 'تقريرا', 'تقارير', 'report', 'reports', 'for', 'of', 'about', 'regarding', 'concerning', 'on', 'in', 'عن', 'في', 'على', 'حول', 'بخصوص', 'لدي', 'خاص', 'خاصه', 'خاصة']);
const SKIP = new Set(['the', 'a', 'an', 'my', 'our', 'this', 'that', 'these', 'those', 'all', 'every', 'each', 'هذا', 'هذه', 'ال', 'كل', 'جميع']);
export function unknownTerms(raw) {
  const set = knownWords(); const toks = norm(raw).split(' ').filter(Boolean); const out = [];
  const skip = (t) => t.length < 3 || /^[\d\-/.:]+$/.test(t) || /^20\d{2}/.test(t) || /^inv-/.test(t);
  const flag = (t) => { if (!skip(t) && !isKnown(t, set) && !out.includes(t)) out.push(t); };
  toks.forEach((t, i) => {
    if (CUE.has(t) || CUE.has(t.replace(/^[وفلب]/, ''))) { let k = i + 1; while (k < toks.length && SKIP.has(toks[k])) k += 1; for (let n = 0; n < 3 && k + n < toks.length; n += 1) flag(toks[k + n]); } // the next few words: the noun phrase the cue introduces
    if (/^(?:لل|ل|ب)[\u0621-\u064A]{3,}$/.test(t)) flag(t); // an attached «for / with» + noun («للمستثمر», «بالدولار»)
  });
  return out;
}

export const SUPPORTED_HELP = {
  ar: ['الفترة: «هذا الشهر حتى اليوم»، «الشهر الماضي»، «السنة حتى اليوم»، «الربع الأول»، «مارس»', 'الأمانة والبلدية: «اعرض أمانة الرياض فقط»، «بلدية الرياض الشمالية»', 'المصدر: الاستثمار (فرص)، الغرامات، الرسوم البلدية، التراخيص، الإيواء، التبغ، الأراضي البيضاء', 'الحالة: «الفواتير المتأخرة فقط»، «الفواتير المحصّلة»، «الملغاة»', 'المقارنة: «قارن بالشهر الماضي»، «قارن بالعام الماضي»', 'الأقسام: مصادر الإيراد، الأمانات، المتأخرات، الاستبعادات، الاتجاه الشهري، فجوات التحصيل، حالة الدفع، جودة البيانات', 'التعميق: «حوّله إلى تقرير تفصيلي»، «أضف توزيع مصادر الإيراد»'],
  en: ['Period: “this month to date”, “last month”, “year to date”, “Q1”, “March”', 'Amanah / municipality: “show Riyadh Amanah only”', 'Source: Furas investment, fines, municipal fees, licences, accommodation, tobacco, white lands', 'Status: “overdue invoices only”, “collected”, “cancelled”', 'Comparison: “compare with last month / last year”', 'Sections: sources, Amanahs, aging, exclusions, monthly trend, gaps, payment status, data quality', 'Depth: “make it a detailed report”, “add the source breakdown”']
};

const STATUS_WORDS = [['overdue', /المتاخر|\boverdue\b/], ['open', /(غير المسدده|غير المحصله|غير المدفوعه)/], ['partial', /(الجزئيه|المسدده جزئيا|محصله جزئيا|\bpartial(ly paid)?\b)/], ['collected', /(المحصله|المحصل بالكامل|(?<!غير )المسدده|\bcollected invoices\b)/], ['cancelled', /(الملغاه|الملغيه|الملغاة|\bcancell?ed\b)/], ['excluded', /(المستبعده|المستبعدة|\bexcluded invoices\b)/], ['partial', /(الجزئيه|المسدده جزئيا|محصله جزئيا|\bpartial(ly paid)?\b)/], ['not_due', /(لم يحن|غير المستحقه|\bnot (yet )?due\b)/], ['open', /(غير المسدده|القائمه|المفتوحه|غير المحصله|\bopen invoices\b)/]];
const DIRECTION = [['North', /(شمال|الشماليه)/], ['Central', /(وسط|الوسطي|المركزيه)/], ['South', /(جنوب|الجنوبيه)/]];

const PERIOD_OPTIONS = [{ label: { ar: 'السنة حتى اليوم', en: 'Year to date' }, text: 'أنشئ تقرير الإيرادات للسنة حتى اليوم' }, { label: { ar: 'هذا الشهر حتى اليوم', en: 'This month to date' }, text: 'أنشئ تقرير الإيرادات لهذا الشهر حتى اليوم' }, { label: { ar: 'الشهر الماضي', en: 'Last month' }, text: 'أنشئ تقرير الإيرادات للشهر الماضي' }];
// wording that names a period but that parsePeriod cannot resolve («قبل شهرين»، «آخر 6 أشهر»، «الأسبوع الماضي»، "last 6 months")
const UNAPPLIED_PERIOD = /قبل\s*(?:\d+|شهرين|اسبوعين|عامين|سنتين)|اخر\s*\d+\s*(?:شهر|اشهر|اسبوع|اسابيع|ايام|يوم|سنوات|سنه)|(?:ال)?(?:اسبوع|يوم|ربع|عام|سنه|شهر)\s*(?:ال)?(?:قادم|مقبل)|(?:ال)?(?:اسبوع|يوم|ربع|عام|سنه)\s*(?:ال)?(?:ماضي|سابق|حالي)|(?:last|previous|past|next)\s*(?:\d+|two|three|four|few|couple of)?\s*(?:week|weeks|day|days|months?|year|years|quarter)|(?:ال)?نصف (?:ال)?(?:اول|ثاني|سنه|عام)|(?:ال)?ربع (?:ال)?اخير|\byesterday\b|(?:^|\s)(?:امس|البارحه)(?:\s|$)/;
// wording that names a period the parsers cannot turn into a date range: seasons, Hijri months, half-years, relative days (a year next to it must not make it a plain year)
const UNRESOLVED_PERIOD = /(?:^|\s)(?:ال|لل|ل)?(?:رمضان|شعبان|شوال|محرم|رجب|ذو الحجه|ذو القعده|جمادي|ربيع (?:ال)?(?:اول|ثاني|الاخر)|صيف|شتاء|خريف|ربيع)(?=\s|$)|(?:ال)?نصف (?:ال)?(?:اول|ثاني)|\bh[12]\b|\b(?:winter|summer|spring|autumn)\b(?:\s+(?:months?|season))?|\bfall\s+(?:months?|season)\b|\b(?:first|second)\s+half\b|\bhalf[- ]year\b/;
// «tomorrow / the day after tomorrow» next to a revenue request: the data has no future days, so it is asked about, not answered with the default period
const FUTURE_DAY = /\bday after tomorrow\b|\btomorrow\b|(?:^|\s)(?:بعد غد|غدا|بكره)(?=\s|$)/;
const QUARTER_NAMES = { q1: { ar: 'الربع الأول', en: 'The first quarter' }, q2: { ar: 'الربع الثاني', en: 'The second quarter' }, q3: { ar: 'الربع الثالث', en: 'The third quarter' }, q4: { ar: 'الربع الرابع', en: 'The fourth quarter' } };
function periodPreset(from, to, today) { return detectPreset(from, to, today); }
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

export function interpret(text, prev, today, { amanahLabel = (k) => k, base: baseSpec = null, noOffer = false } = {}) {
  const s = norm(text); const raw = String(text || '');
  const base = prev ? JSON.parse(JSON.stringify(prev)) : JSON.parse(JSON.stringify(baseSpec || defaultSpec(today)));
  const spec = base; const changes = []; const note = (key, label, value) => changes.push({ key, label, value });
  if (!s) return { kind: 'empty', spec, changes };

  // ---- a part of the request that cannot be applied is asked about BEFORE anything is generated (never dropped silently)
  const unapplied = findUnapplied(s);
  if (unapplied.length) {
    const actionOnly = unapplied.every((u) => u.action); const names = [...new Set(unapplied.map((u) => u.key))].map((k) => unapplied.find((u) => u.key === k));
    const spans = [...new Set(unapplied.map((u) => u.span))].join('، ');
    const rest = stripUnapplied(raw, unapplied, norm);
    const offer = !actionOnly && !noOffer && rest.length >= 3 && ['report', 'question'].includes(interpret(rest, prev, today, { amanahLabel, base: baseSpec, noOffer: true }).kind);
    return { kind: actionOnly ? 'unsupported' : 'clarify', spec: prev || spec, changes: [], unapplied: names.map((u) => u.key),
      question: { ar: `لا أستطيع تطبيق ${names.map((u) => u.ar).join(' و')} (${spans}) على التقرير.${actionOnly ? ' يمكنك تصدير أي تقرير بصيغة Word أو Excel أو PowerPoint من أعلى التقرير.' : ' هل أتابع بدونه، أم تعيد صياغة الطلب؟'}`, en: `I cannot apply ${names.map((u) => u.en).join(' and ')} (${spans}) to the report.${actionOnly ? ' You can export any report as Word, Excel or PowerPoint from the top of the report.' : ' Shall I continue without it, or will you rephrase the request?'}` },
      options: offer ? [{ label: { ar: 'تابع بدونه', en: 'Continue without it' }, text: rest }] : [] };
  }
  // ---- one focused clarification when the request is materially ambiguous
  const amHits = parseAmanah(raw);
  if (!prev && has(s, /^(قارن|مقارنه)( بالشهر الماضي| بالعام الماضي| بالفتره السابقه)?$/)) return { kind: 'clarify', spec, changes: [], question: { ar: 'ماذا تريد أن أقارن؟ لا يوجد تقرير حالي أبني عليه المقارنة.', en: 'What should I compare? There is no current report to build the comparison on.' }, options: [{ label: { ar: 'أداء التحصيل بين الأمانات', en: 'Collection performance between Amanahs' }, text: 'قارن أداء التحصيل بين الأمانات' }, { label: { ar: 'تقرير هذا الشهر مقارناً بالشهر الماضي', en: 'This month’s report compared with last month' }, text: 'أنشئ تقرير الإيرادات لهذا الشهر حتى اليوم قارن بالشهر الماضي' }] };
  if (amHits.length > 1 && has(s, /فقط/)) return { kind: 'clarify', spec, changes: [], question: { ar: 'ذكرتَ أكثر من أمانة مع «فقط». أيها تريد؟', en: 'You named more than one Amanah with “only”. Which one?' }, options: amHits.slice(0, 4).map((k) => ({ label: { ar: amanahLabel(k), en: amanahLabel(k) }, text: `اعرض أمانة ${amanahLabel(k).replace(/^أمانة\s*(منطقة\s*)?/, '')} فقط` })) };
  // an Amanah that is named but is not one of the available ones is never replaced by «all Amanahs» silently
  if (!amHits.length) {
    const unk = raw.match(/(?:^|\s)أمان[ةه]\s+(?:(?:منطقة|محافظة|مدينة)\s+)?(?!(?:كل|جميع|فقط|ال?مختار)(?:\s|$))([\u0621-\u064A]+)/) || raw.match(/\b(?!(?:the|all|every|each|an?|any|this|that|my|one|same|other|which|of|by)\b)([A-Za-z]+)\s+amanah\b/i);
    if (unk) return { kind: 'clarify', spec: prev || spec, changes: [], question: { ar: `لا توجد أمانة باسم «${unk[1]}» ضمن الأمانات المتاحة. اختر أمانة من القائمة أو اطلب «كل الأمانات».`, en: `There is no Amanah named “${unk[1]}” among the available ones. Pick one from the list or ask for “all Amanahs”.` }, options: amanahOptionsOf().slice(0, 4).map((a) => ({ label: { ar: a.ar, en: a.en }, text: `أنشئ تقرير ${a.ar}` })) };
  }
  // ---- «remove the source / status / municipality filter»
  if (has(s, /\b(?:remove|clear|drop)\s+(?:the\s+)?source(?:\s+filter)?\b|(?:ازل|امسح|احذف|الغ|الغي)\s+(?:ال)?(?:مرشح|فلتر)\s+(?:ال)?مصدر|(?:بدون|دون)\s+(?:ال)?مصدر/) && spec.scope.source !== 'all') { spec.scope.source = 'all'; note('source', 'source', 'all'); }
  if (has(s, /\b(?:remove|clear|drop)\s+(?:the\s+)?status(?:\s+filter)?\b|(?:ازل|امسح|احذف|الغ|الغي)\s+(?:ال)?(?:مرشح|فلتر)\s+(?:ال)?حاله/) && spec.scope.status !== 'all') { spec.scope.status = 'all'; note('status', 'status', 'all'); }
  if (has(s, /\b(?:remove|clear|drop)\s+(?:the\s+)?municipality(?:\s+filter)?\b|(?:ازل|امسح|احذف|الغ|الغي)\s+(?:ال)?(?:مرشح|فلتر)\s+(?:ال)?بلديه/) && spec.scope.muni !== 'all') { spec.scope.muni = 'all'; note('muni', 'muni', 'all'); }
  // ---- «remove the Amanah filter»
  if (has(s, /\b(?:remove|clear|drop)\s+(?:the\s+)?amanah(?:\s+filter)?\b|(?:ازل|امسح|احذف|الغ|الغي)\s+(?:ال)?(?:مرشح|فلتر)\s+(?:ال)?امانه|(?:بدون|دون)\s+(?:ال)?امانه/) && spec.scope.amanah !== 'all') { spec.scope.amanah = 'all'; spec.scope.muni = 'all'; note('amanah', 'amanah', 'all'); }
  // ---- reset
  const reset = has(s, /(ابدا من جديد|(?:ازل|امسح|احذف|صفر|الغ(?:ي)?) (?:كل )?(?:ال)?(?:مرشحات|فلاتر|فلتر)|بدون مرشحات|كل المرشحات|\b(?:reset|clear|remove) (?:all )?(?:the )?filters\b)/);
  if (reset) { const d = defaultSpec(today); spec.scope = d.scope; spec.preset = d.preset; spec.compare = 'none'; note('reset', 'reset', null); }

  // ---- comparison. Only the OBJECT of «قارن / مقارنة … / compare with …» is a comparison; a period word elsewhere in the sentence
  // («تقرير الشهر الماضي مقارنة بالعام الماضي») is the report period.
  const CMP_MONTH = /(?:ب|مع)?(?:ال)?شهر\s*(?:ال)?(?:ماضي|سابق|اللي فات|الي فات|الفايت)|(?:the\s+)?(?:last|previous)\s+month|الشهر اللي قبل/;
  const CMP_YEAR = /(?:ب|مع)?(?:ال)?(?:عام|سنه)\s*(?:ال)?(?:ماضي|سابق)|(?:the\s+)?(?:last|previous)\s+year|same period last year|نفس الفتره/;
  let t = s; let compareNew = null; let cmpPeriod = null;
  const trig = s.match(/(?:^|\s)(?:و)?(?:ال)?(قارن|مقارنه|بالمقارنه|مقابل|compare|compared|versus|vs|(?:افضل|احسن|اسوا|اعلي|اقل|اكثر|تحسن|تراجع|ارتفع|انخفض) (?:من|عن)|(?:ارتفع|انخفض|زاد|نقص|تحسن|تراجع)(?: [^ ]+){1,2} (?:من|عن)|(?:better|worse|higher|lower|more|less) than)(?=\s|$)/);
  if (trig && amHits.length < 2) {
    const before = s.slice(0, trig.index); const after = s.slice(trig.index + trig[0].length);
    if (CMP_MONTH.test(after)) { compareNew = 'prev_month'; t = `${before} ${after.replace(CMP_MONTH, ' ')}`; }
    else if (CMP_YEAR.test(after)) { compareNew = 'prev_year'; t = `${before} ${after.replace(CMP_YEAR, ' ')}`; }
    else if (!before.replace(/تقرير|report|لل?/g, ' ').trim() && monthsInOrder(after).length >= 2) { // «مقارنة أغسطس بيوليو»: the first month is the report, the second the month before it
      const [m1, m2] = monthsInOrder(after); const yr = (after.match(/\b(20\d{2})\b/) || [])[1] || ''; const p1 = parsePeriod(`شهر ${m1} ${yr}`, today); const p2 = parsePeriod(`شهر ${m2} ${yr}`, today);
      if (p1 && p2 && isSingleMonth(p1) && previousMonthScope(p1, today).from === p2.from) { compareNew = 'prev_month'; t = `شهر ${m1} ${yr}`; }
      else { const cp = parsePeriod(after, today, { reportFuture: true }); if (cp) { cmpPeriod = cp; t = before; } }
    }
    else if (/^(قارن|مقارنه)( بالفتره السابقه)?$/.test(s) || /قارن (ذلك|هذا|التقرير)/.test(s)) compareNew = 'prev_year';
    else { const cp = parsePeriod(after, today, { reportFuture: true }); if (cp) { cmpPeriod = cp; t = before; } }
  }
  if (has(s, /(بدون مقارنه|الغ(ي)? المقارنه|احذف المقارنه)/)) compareNew = 'none';

  // ---- period
  const iso = raw.match(/(20\d{2}-\d{2}-\d{2})\s*(?:→|الى|إلى|to|-|–|حتى)\s*(20\d{2}-\d{2}-\d{2})/);
  const dayRange = iso ? null : parseDayRange(raw, today);
  let per = null;
  if (iso || dayRange) {
    const r = checkRange(iso ? { from: iso[1], to: iso[2] } : dayRange, { today });
    if (!r.ok) return { kind: 'clarify', spec, changes: [], question: { ar: rangeMessage(r.code, 'ar', { today }), en: rangeMessage(r.code, 'en', { today }) }, options: PERIOD_OPTIONS };
    per = { from: r.from, to: r.to, label: 'custom' };
  }
  else {
    if (!compareNew && !cmpPeriod && periodMentions(t) >= 2) return { kind: 'clarify', spec, changes: [], question: { ar: 'ذكرتَ أكثر من فترة في طلب واحد. أي فترة تريد؟ (يمكنك طلب المقارنة بين شهرين متتاليين: «تقرير سبتمبر مقارنة بأغسطس»)', en: 'You named more than one period in one request. Which one do you want? (You can compare two consecutive months: “September report compared with August”.)' }, options: PERIOD_OPTIONS };
    per = parsePeriod(t, today, { reportFuture: true });
    if (per && per.beforeData) return { kind: 'clarify', spec, changes: [], question: { ar: rangeMessage('before_data', 'ar', { today }), en: rangeMessage('before_data', 'en', { today }) }, options: PERIOD_OPTIONS };
  }
  if (per && per.notStarted) { // D-04: a period that has not started is never turned into a reversed range
    const nm = QUARTER_NAMES[per.label] || null;
    const what = nm ? { ar: nm.ar, en: nm.en } : { ar: 'الشهر المطلوب', en: 'The month you asked for' };
    return { kind: 'clarify', spec, changes: [], question: { ar: `${what.ar} لم يبدأ بعد (يبدأ ${per.from}، وآخر بيانات ${today}). أي فترة تريد؟`, en: `${what.en} has not started yet (it starts ${per.from}; the latest data is ${today}). Which period do you want?` }, options: PERIOD_OPTIONS };
  }
  // F-05 guard: a period phrase that was recognised as a period but could not be applied is never ignored silently
  if (UNRESOLVED_PERIOD.test(s) || (FUTURE_DAY.test(s) && has(s, /تقرير|ايراد|تحصيل|فاتور|\b(?:report|revenue|collection|invoices?)\b/)) || (!per && !compareNew && UNAPPLIED_PERIOD.test(s))) return { kind: 'clarify', spec, changes: [], question: { ar: 'فهمتُ أنك تقصد فترة زمنية لكنني لا أستطيع تحديدها من هذه الصياغة. الفترات المدعومة: هذا الشهر، الشهر الماضي، السنة حتى اليوم، الربع الأول…، اسم شهر، أو «2026-01-01 إلى 2026-03-31». أي فترة تريد؟', en: 'I understood that you mean a period but cannot resolve it from this wording. Supported: this month, last month, year to date, Q1…, a month name, or “2026-01-01 to 2026-03-31”. Which period do you want?' }, options: PERIOD_OPTIONS };
  if (per && (per.from !== spec.scope.from || per.to !== spec.scope.to)) { spec.scope.from = per.from; spec.scope.to = per.to; spec.preset = periodPreset(per.from, per.to, today); note('period', 'period', `${per.from} → ${per.to}`); }
  if (cmpPeriod) { // «… مقارنة بأغسطس»: a named month is supported only when it is exactly the month before the report month
    const cur = { from: spec.scope.from, to: spec.scope.to };
    if (!cmpPeriod.notStarted && isSingleMonth(cur) && previousMonthScope(cur, today).from === cmpPeriod.from) compareNew = 'prev_month';
    else return { kind: 'clarify', spec: prev || spec, changes: [], question: { ar: 'المقارنة بفترة محددة بالاسم غير مدعومة إلا إذا كانت الشهر السابق مباشرة. المتاح: المقارنة بالشهر الماضي أو بنفس الفترة من العام الماضي.', en: 'Comparing with a named period is supported only when it is the month right before the report month. Available: last month, or the same period last year.' }, options: [{ label: { ar: 'مقارنة بالشهر الماضي', en: 'Compare with last month' }, text: 'قارن بالشهر الماضي' }, { label: { ar: 'مقارنة بالعام الماضي', en: 'Compare with last year' }, text: 'قارن بالعام الماضي' }] };
  }
  if (compareNew && compareNew !== spec.compare) { spec.compare = compareNew; note('compare', 'compare', compareNew); }

  // ---- Amanah / municipality
  if (has(s, /(كل الامانات|جميع الامانات|كل امانه|\b(all|every) amanahs?\b)/) && spec.scope.amanah !== 'all') { spec.scope.amanah = 'all'; spec.scope.muni = 'all'; note('amanah', 'amanah', 'all'); }
  const srcs = sourcesMentioned(raw);
  if (srcs.length >= 2 && !has(s, /(توزيع|حسب).{0,12}(مصدر|المصادر)|by source/)) return { kind: 'clarify', spec: prev || spec, changes: [], question: { ar: 'ذكرتَ أكثر من مصدر إيراد في طلب واحد. أي مصدر تريد؟ (أو اطلب «توزيع الإيرادات حسب المصدر»)', en: 'You named more than one revenue source in one request. Which one do you want? (Or ask for “revenue by source”.)' }, options: [...srcs.slice(0, 3).map((k) => ({ label: { ar: sourceAr(k), en: sourceEn(k) }, text: `تقرير ${sourceAr(k)}` })), { label: { ar: 'توزيع حسب المصدر', en: 'Breakdown by source' }, text: 'تقرير الإيرادات حسب مصدر الإيراد' }] };
  if (has(s, /(^|\s)(?:ال)?مبيعات(\s|$)/) && !srcs.length) return { kind: 'clarify', spec: prev || spec, changes: [], question: { ar: 'هل تقصد «مبيعات الإسكان»؟ المبيعات ليست مصدراً مستقلاً في هذا النظام.', en: 'Do you mean “housing sales”? Sales is not a separate revenue source in this system.' }, options: [{ label: { ar: 'تقرير مبيعات الإسكان', en: 'Housing sales report' }, text: 'تقرير مبيعات الإسكان' }] };
  const am = parseAmanah(raw);
  const onlyOne = am.length === 1 ? am[0] : null;
  const cmpAmanahs = am.length >= 2 && (!!trig || has(s, /(comparison|compared|between|بين)/)); // «قارن الرياض بجدة»
  if (am.length >= 1 && (am.length === 1 ? !has(s, /بين الامانات/) : (cmpAmanahs || has(s, /(فقط|الامانات|^اعرض|^عرض|\bshow\b|\band\b|\bor\b|(?:^|\s)و[\u0621-\u064A]|مقابل|\bvs\b)/)) && !has(s, /بين الامانات/))) {
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
  const isQuestion = has(norm(raw + ' '), /^(كم|ما|ماذا|هل|لماذا|كيف|اين|اي|من|احسب|what|how|which|when|why|is|are|did|do|does|was|were|can|could)(?=\s|$)/) || /[؟?]\s*$/.test(raw);
  const createVerb = (has(s, /(انشئ|جهز|اعد|اعمل|ابني|حضر|اطلب|اريد|ابغى|ابي|اعطني|اعرض لي)/) && has(s, /تقرير/)) || (has(s, /\b(create|prepare|generate|make|build|show me|give me|i want|i need)\b/) && has(s, /\breport\b/));
  const monthlyLike = has(s, /(مشابه|مماثل|كالتقارير|التقارير المرفقه|تقرير شهري|تقريرا شهريا)/);
  const detailedWord = has(s, /(تفصيلي|مفصل|شامل|بالتفصيل|\bdetailed\b|\bfull report\b)/);
  const summaryWord = has(s, /(ملخص|موجز|مختصر|باختصار|\bsummary\b|\bbrief\b)/);
  const picked = [...SECTION_WORDS, ...SECTION_WORDS_EN].filter(([, re]) => re.test(s)).map(([k]) => k);
  if (has(s, /عدم التحصيل/) && !picked.includes('status')) picked.push('status');
  if (cmpAmanahs && !picked.includes('amanah')) picked.push('amanah'); // «قارن الرياض بجدة» → the Amanah comparison table for those two
  if (has(s, /المتاخرات/) && has(s, /(حسب مصدر|مصدر الايراد)/)) { if (!picked.includes('aging')) picked.push('aging'); if (!picked.includes('sources')) picked.push('sources'); }
  const addVerb = has(s, /(اضف|اضافه|ضيف|زد|اعرض ايضا|^مع |^و(?:ال)?(?:مصادر|اتجاه|متاخر|استبعاد)|\badd\b|\balso\b|\binclude\b)/);
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
  const domainQuestion = has(s, /(تحصيل|حصل|محصل|فاتور|ايراد|مفوتر|مستحق|متاخر|استبعاد|امانه|امانات|ميزاني|مصروف|انفاق|نفقات|نسبه|اداء|وضع|مبلغ|مبالغ|مصدر|collection|revenue|invoice|billed|overdue|exclusion|performance|doing|status|amanah|budget|rate|\bgaps?\b)/);
  const reportNoun = has(s, /(تقرير|تقريرا|report)/); // «تقرير الشهر الماضي» is a report request even when nothing needs to change
  // a question that is not about revenue («ما أفضل مطعم في جدة؟») is declined even when a place name in it looks like an Amanah
  if (isQuestion && !domainQuestion && !reportNoun && !createVerb && !picked.length && !(prev && changes.some((c) => c.key === 'period'))) return { kind: 'unsupported', spec: prev || spec, changes: [] };
  const recognized = changes.length > 0 || picked.length > 0 || createVerb || reportNoun || monthlyLike || detailedWord || summaryWord || (isQuestion && domainQuestion);
  if (!recognized) return { kind: 'unsupported', spec: prev || spec, changes: [] };
  // an unknown word where a qualifier would stand is never ignored: ask, and offer to continue without it
  if (!noOffer) {
    const unk = unknownTerms(raw);
    if (unk.length) {
      const rawWords = raw.split(/\s+/); const kept = rawWords.filter((w) => !unk.includes(norm(w))).join(' ').trim();
      const offer = kept.length >= 3 && ['report', 'question'].includes(interpret(kept, prev, today, { amanahLabel, base: baseSpec, noOffer: true }).kind);
      const shown = unk.map((t) => rawWords.find((w) => norm(w) === t) || t).join('، ');
      return { kind: 'clarify', spec: prev || spec, changes: [], unknownTerms: unk,
        question: { ar: `لم أتعرف على «${shown}» ضمن ما أستطيع تطبيقه (الفترة، الأمانة، المصدر، الحالة، المقارنة). هل أتابع بدونه، أم تعيد صياغة الطلب؟`, en: `I did not recognise “${shown}” among what I can apply (period, Amanah, source, status, comparison). Shall I continue without it, or will you rephrase?` },
        options: offer ? [{ label: { ar: 'تابع بدونه', en: 'Continue without it' }, text: kept }] : [] };
    }
  }
  return { kind: isQuestion && !createVerb ? 'question' : 'report', spec, changes, sectionsChanged, startNew };
}

const STATUS_LABELS = { all: { ar: 'كل الحالات', en: 'All statuses' }, collected: { ar: 'محصّلة', en: 'Collected' }, open: { ar: 'قائمة', en: 'Open' }, overdue: { ar: 'متأخرة', en: 'Overdue' }, partial: { ar: 'جزئية', en: 'Partial' }, not_due: { ar: 'لم تستحق', en: 'Not due' }, cancelled: { ar: 'ملغاة', en: 'Cancelled' }, excluded: { ar: 'مستبعدة', en: 'Excluded' } };
export function describeChange(c, lang, { amanahLabel = (k) => k, spec } = {}) {
  const ar = lang === 'ar'; const L = (a, e) => (ar ? a : e);
  const lab = { sections: L('أُضيف قسم', 'Section added'), period: L('الفترة', 'Period'), amanah: L('الأمانة', 'Amanah'), muni: L('البلدية', 'Municipality'), source: L('المصدر', 'Source'), status: L('حالة الفاتورة', 'Invoice status'), scopeType: L('النطاق', 'Scope'), compare: L('المقارنة', 'Comparison'), depth: L('مستوى التفصيل', 'Depth'), reset: L('المرشحات', 'Filters') }[c.key];
  const v = c.key === 'amanah' ? (c.value === 'all' ? L('كل الأمانات', 'All Amanahs') : [].concat(c.value).map(amanahLabel).join('، '))
    : c.key === 'compare' ? ({ prev_month: spec && !isSingleMonth(spec.scope) ? L('الفترة السابقة المساوية في الطول', 'Preceding period of equal length') : L('الشهر الماضي (المدة المنقضية نفسها)', 'Last month (same elapsed days)'), prev_year: L('نفس الفترة من العام السابق', 'Same period last year'), none: L('بدون', 'None') }[c.value])
      : c.key === 'period' && /^\d{4}-\d{2}-\d{2} → \d{4}-\d{2}-\d{2}$/.test(String(c.value)) ? fmtRangeText(String(c.value).slice(0, 10), String(c.value).slice(-10), ar ? 'ar' : 'en')
      : c.key === 'sections' ? String(c.value).split(',').map((k) => SECTION_META[k]?.[ar ? 'ar' : 'en'] || k).join('، ') : c.key === 'depth' ? L('تفصيلي', 'Detailed') : c.key === 'reset' ? L('أُعيدت إلى الافتراضي', 'Reset to default') : c.key === 'muni' ? (c.value === 'all' ? L('كل البلديات', 'All municipalities') : String(c.value).split('|').pop())
        : c.key === 'source' ? (c.value === 'all' ? L('كل المصادر', 'All sources') : (ar ? sourceAr(c.value) : sourceEn(c.value)))
          : c.key === 'status' ? (STATUS_LABELS[c.value]?.[ar ? 'ar' : 'en'] || String(c.value)) : String(c.value);
  return `${lab}: ${v}`;
}
export { addDaysIso };
