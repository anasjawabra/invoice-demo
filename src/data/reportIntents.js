// ============================================================================
// Request interpreter for the unified «التقارير الذكية» conversation. RULE-BASED (keywords + the shared period / Amanah / source
// parsers) — not a language model, and the UI says so. It turns a sentence into a report SPEC and lists which context fields the
// sentence changed, so the visible filter chips can update. Fields the sentence does not mention are kept (follow-ups preserve
// the existing filters).
//
// spec = { title, preset, scope:{from,to,amanah,source,scopeType,muni,status}, compare:'none'|'prev_month'|'prev_year',
//          depth:'summary'|'detailed', sections:[...] }
//
// interpret() → { kind:'report'|'question'|'clarify'|'unsupported'|'empty', spec, changes, ... }
//   changes     [{ key, label, value, endsAtCutoff?, naturalEnd? }]  what the sentence set (period / amanah / muni / source / status / compare / sections…)
//               · a first request that NAMES a period or says «all Amanahs» always lists it, even when it equals the default, so the user sees how it was read
//               · period change with endsAtCutoff:true = the period was cut at the data cutoff (e.g. «2026» = 1 Jan → today, not 31 Dec); naturalEnd = the later date it would have ended
//   confirm     [{ key, ar, en }] risky readings the UI shows for confirmation before generating
//   clarify     { kind:'clarify', question:{ar,en}, options:[{label:{ar,en}, text}], problems?:[…], unknownTerms?:[…], unapplied?:[…] }
//               EVERY constraint that cannot be resolved (unknown / near-miss / ambiguous Amanah, municipality or source; a period or status that matches nothing)
//               is asked about with a precise question and clickable options that keep the rest of the request. It is never dropped and never widened
//               (an unknown Amanah never becomes «all Amanahs»). `problems` lists them: { kind, phrase, candidates? } (kinds in requestEntities.js,
//               plus period_invalid, status_unknown, status_ambiguous, status_multiple).
//   ACCESS (options.access = the user's GeoScope for the smart_reports module; options.allowedAmanahs = the legacy organisation list): «all Amanahs / all municipalities» mean all AUTHORIZED ones; an entity outside the
//               access is answered with an access message (amanah_forbidden / muni_forbidden) that names only what the person typed and offers only authorized options; no access at all → kind 'unsupported' with that message;
//               a base / previous spec holding a value outside the access is sanitised and reported in `accessNotice`.
//   interpretation  { amanah:'all'|[keys], genericAmanahs:boolean, muni, source, status, period:{from,to,endsAtCutoff}, resolved:[{kind,input,key,via}] } (added field; informational)
// ============================================================================
import { normAr, parsePeriod, parseDayRange, monthsInOrder, parseAmanah as parseAmanahStrict, periodMentions } from './assistantRouter';
import { amanahOptionsOf, REVENUE_SOURCE_KEYS } from './revenueLedger';
import { startOfYear, startOfMonth, addDaysIso, isSingleMonth, daysBetweenIso, fmtRangeText, fmtDateText } from './clock';
import { checkRange, rangeMessage } from './dateRange';
import { detectPreset } from './periodPresets';
import { SECTION_ORDER, SECTION_META } from './reportModel';
import { sourceAr, sourceEn } from './insightsEngine';
import { findUnapplied, stripUnapplied } from './requestGuard';
import { normText, cleanRaw } from './textNorm';
import { resolveEntities, replaceSpan, applyEdits, entityVocabulary, amanahCore } from './requestEntities';
import { municipalityRecord, municipalityRecordsOf } from './requestMunicipalities';
import { muniLabel, MUNICIPALITY_DIRECT, MUNICIPALITY_OPTION_NONE } from './municipalityModel';
import { parseExtraPeriod, naturalEndOf, canonMonths } from './requestPeriods';
import { asGeoScope, isNoAccess, sanitizeScopeValues, REOPEN_MSG, SANITIZE_NOTICE, describeAccess, allAuthorizedLabel, allMunicipalitiesLabel } from './reportAccess';

const norm = (t) => normText(canonMonths(t)); // ONE normalisation (textNorm.js): digits, tashkeel, tatweel, alef / ya / ta-marbuta forms, case
const has = (s, re) => re.test(s);

export const defaultSpec = (today) => ({ title: '', preset: 'ytd', scope: { from: startOfYear(today), to: today, amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all' }, compare: 'none', depth: 'summary', sections: ['executive'] });

const DETAILED = ['executive', 'trends', 'amanah', 'sources', 'aging', 'exclusions', 'gaps', 'status', 'quality'];
const MONTHLY_TEMPLATE = ['executive', 'sources', 'amanah', 'exclusions', 'gaps'];

const SECTION_WORDS = [
  ['sources', /(مصادر الايراد|حسب المصدر|توزيع (ال)?مصادر|توزيع الايرادات|مصدر الايراد|اداء المصادر|(?:^|\s)و?المصادر(?:\s|$))/],
  ['amanah', /(بين الامانات|اداء الامانات|مقارنه الامانات|حسب الامانه|حسب الامانات|توزيع الامانات|الامانات والبلديات|حسب البلديه|الامانات|(?:^|\s)و(?:ال)?امانه(?=\s|$)|لكل امانه|حسب امانه)/], // «…حسب المصدر والأمانة والاتجاه» lists the Amanah section too
  ['aging', /(المتاخرات|التقادم|الاعمار|اعمار الديون|اعمار|المتاخره)/],
  ['exclusions', /(الاستبعاد|الاستبعادات|المستبعد)/],
  ['noncollection', /(اسباب عدم (?:ال)?(?:تحصيل|سداد)|عدم (?:ال)?(?:تحصيل|سداد)|لماذا (?:لم|لا) (?:يتم )?(?:تسدد|تحصل|يسدد|سداد|تحصيل)|لماذا (?:ما )?(?:زالت|لازالت|مازالت) (?:ال)?فواتير غير (?:ال)?(?:مسدده|محصله))/], // «حلل أسباب عدم التحصيل»: the structured analysis (src/data/ncReportModel.js), never the exclusions section
  ['trends', /(الاتجاه|الترند|شهرا بشهر|الاتجاه الشهري|تطور|حسب الشهر)/],
  ['gaps', /(فجوات|الفجوه|اولويات|فرص التحصيل|اولويه المتابعه)/],
  ['status', /(حاله الدفع|حالات الفواتير|حاله الفاتوره|عدد الفواتير|حسب الحاله)/],
  ['quality', /(جوده (?:ال)?بيانات|اكتمال|مطابقه|تعارضات)/],
  ['bases', /(اساس القياس|اساسين|اساس التقرير)/],
  ['channels', /(قنوات الدفع|قنوات السداد|قنوات)/]
];
// «why are invoices unpaid» is a question about non-collection, not a request to FILTER the invoices to the unpaid ones (the status step reads the sentence without it)
const NC_EN = /non[\s-]?collection|why (?:are|is|do|did|have|has|were)\b[^?]{0,60}\b(?:unpaid|uncollected|not (?:been )?(?:paid|collected))|(?:reasons?|causes?) (?:for|of|behind) (?:the )?(?:non[\s-]?payment|unpaid|uncollected)|(?:unpaid|uncollected) (?:invoices? )?(?:reasons?|causes?)/;
// English wording for the same sections (kept apart so the Arabic table stays readable)
const SECTION_WORDS_EN = [['sources', /\b(by|per) (revenue )?source|revenue sources/], ['amanah', /\b(by|per) amanah|compare amanahs|amanahs? performance|\bamanahs\b|\bamanat\b|\bamanaat\b/], ['aging', /\baging\b|\boverdue (balances|amounts|debts)\b|arrears/], ['exclusions', /\bexclusions?\b/], ['noncollection', NC_EN], ['trends', /\b(monthly )?trend\b|month by month/], ['gaps', /\b(collection )?gaps\b|priorities/], ['status', /payment status|invoice status breakdown/], ['quality', /data quality|reconciliation/], ['channels', /payment channels/]];

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
plus together with along also ثم مع إلى وكذلك جيزان مكه ميكا mecca makka medina madina jizan hail baha jouf qassim qasim hofuf ahsa hasa hafar first quarter before month versus about equal معا سوية
مقسم مقسمه مقسمة مقسما مقسمين موزع موزعه موزعة مجزأ مجزاً مصنف مصنفه مصنفة مبوب مبوبه مبوبة مفصل مفصلة تقسيم تقسيمه توزيع تصنيف تفصيل split splits divided breakdown broken grouped segmented categorised categorized
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
  entityVocabulary().forEach((w) => set.add(w)); // every Amanah / city / source / direction spelling the entity resolver understands
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
export function unknownTerms(raw, ignore = null) { // `ignore`: normalised words the entity resolver already consumed (a recognised spelling variant is never «unknown»)
  const set = knownWords(); const toks = norm(raw).replace(/[()\[\]«»“”"]/g, ' ').split(' ').filter(Boolean).flatMap((t) => (/[a-z][-_][a-z]/.test(t) ? t.split(/[-_]/).filter(Boolean) : [t])); const out = []; // «Al-Ahsa» = two words
  const skip = (t) => t.length < 3 || /^[\d\-/.:]+$/.test(t) || /^20\d{2}/.test(t) || /^inv-/.test(t);
  const flag = (t) => { if (!skip(t) && !(ignore && ignore.has(t)) && !isKnown(t, set) && !out.includes(t)) out.push(t); };
  toks.forEach((t, i) => {
    if (CUE.has(t) || CUE.has(t.replace(/^[وفلب]/, ''))) { let k = i + 1; while (k < toks.length && SKIP.has(toks[k])) k += 1; for (let n = 0; n < 3 && k + n < toks.length; n += 1) flag(toks[k + n]); } // the next few words: the noun phrase the cue introduces
    if (/^(?:لل|ل|ب)[\u0621-\u064A]{3,}$/.test(t)) flag(t); // an attached «for / with» + noun («للمستثمر», «بالدولار»)
  });
  return out;
}

export const SUPPORTED_HELP = {
  ar: ['الفترة: «هذا الشهر حتى اليوم»، «الشهر الماضي»، «السنة حتى اليوم»، «الربع الأول»، «مارس»', 'الأمانة والبلدية: «اعرض أمانة الرياض فقط»، «بلدية القوز في أمانة جدة»', 'المصدر: الاستثمار، الغرامات، الرسوم البلدية، التراخيص، الإيواء، التبغ، الأراضي البيضاء', 'الحالة: «الفواتير المتأخرة فقط»، «الفواتير المحصّلة»، «الملغاة»', 'المقارنة: «قارن بالشهر الماضي»، «قارن بالعام الماضي»', 'الأقسام: مصادر الإيراد، الأمانات، المتأخرات، الاستبعادات، الاتجاه الشهري، فجوات التحصيل، حالة الدفع، جودة البيانات', 'التعميق: «حوّله إلى تقرير تفصيلي»، «أضف توزيع مصادر الإيراد»'],
  en: ['Period: “this month to date”, “last month”, “year to date”, “Q1”, “March”', 'Amanah / municipality: “show Riyadh Amanah only”', 'Source: investment, fines, municipal fees, licences, accommodation, tobacco, white lands', 'Status: “overdue invoices only”, “collected”, “cancelled”', 'Comparison: “compare with last month / last year”', 'Sections: sources, Amanahs, aging, exclusions, monthly trend, gaps, payment status, data quality', 'Depth: “make it a detailed report”, “add the source breakdown”']
};

const STATUS_WORDS = [['overdue', /المتاخر|(?:^|\s)متاخر|\boverdue\b|\bpast due\b|\blate (?:invoices|payments)\b/], ['open', /(غير المسدده|غير المحصله|غير المدفوعه|\bunpaid\b|\buncollected\b|\boutstanding\b|\bnot (?:yet )?paid\b)/], ['partial', /(الجزئيه|المسدده جزئيا|محصله جزئيا|المدفوعه جزئيا|\bpartial(ly paid)?\b)/], ['collected', /(المحصله|المحصل بالكامل|(?<!غير )المسدده|المدفوعه|\bcollected invoices\b|\bpaid invoices\b|\bsettled\b|\bfully paid\b)/], ['cancelled', /(الملغاه|الملغيه|الملغاة|\bcancell?ed\b)/], ['excluded', /(المستبعده|المستبعدة|\bexcluded invoices\b)/], ['partial', /(الجزئيه|المسدده جزئيا|محصله جزئيا|المدفوعه جزئيا|\bpartial(ly paid)?\b)/], ['not_due', /(لم يحن|غير المستحقه|\bnot (yet )?due\b)/], ['open', /(غير المسدده|القائمه|المفتوحه|غير المحصله|\bopen invoices\b)/]];
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

// ---- statuses: every distinct status named (a higher-priority phrase hides the words inside it), the subsumed ones dropped
function statusesIn(s) {
  let rest = s; const out = [];
  for (const [k, re] of STATUS_WORDS) { const g = new RegExp(re.source, 'g'); if (g.test(rest)) { if (!out.includes(k)) out.push(k); rest = rest.replace(new RegExp(re.source, 'g'), ' '); } }
  let r = out.slice();
  if (r.includes('overdue')) r = r.filter((k) => k !== 'open'); // an overdue invoice is open: «المتأخرة غير المحصلة» is overdue
  if (r.includes('partial')) r = r.filter((k) => k !== 'open' && k !== 'collected'); // a part-paid invoice is open and partly collected: «partial» says it
  return r;
}
const STATUS_ADJ = { overdue: { ar: 'المتأخرة', en: 'overdue' }, open: { ar: 'القائمة', en: 'open' }, partial: { ar: 'الجزئية', en: 'partial' }, collected: { ar: 'المحصّلة', en: 'collected' }, not_due: { ar: 'غير المستحقة بعد', en: 'not yet due' }, cancelled: { ar: 'الملغاة', en: 'cancelled' }, excluded: { ar: 'المستبعدة', en: 'excluded' } };
// the unknown adjective right next to «invoices / الفواتير» when it names no status («الفواتير الغريبة», «frozen invoices»)
function unknownStatusWord(raw, s) {
  const set = knownWords(); const stop = /^(?:the|all|my|our|new|old|these|those|every|each|any|some|many|few|more|most|total|number|count|of|for|in|on|by|with|and|or|your|their)$/;
  let m = s.match(/(?:^|\s)(?:ال)?فواتير\s+(?:ال)?([ء-ي]{3,})/); let w = m && m[1];
  if (!w) { m = s.match(/\b([a-z]{3,})\s+invoices\b/); w = m && m[1]; if (w && stop.test(w)) w = null; }
  if (!w || /داخلي|مركزي/.test(w) || isKnown(w, set) || isKnown(`ال${w}`, set)) return null;
  const word = raw.split(/\s+/).find((x) => norm(x).replace(/^ال/, '') === w.replace(/^ال/, '')) || w;
  return { phrase: word, norm: w };
}
function statusClarify(kind, data, raw) {
  const arReq = /[؀-ۿ]/.test(raw); const toks = raw.split(/\s+/);
  const isStatusTok = (x) => { const n = norm(x); return STATUS_WORDS.some(([, re]) => re.test(n)) || /^(?:و?غير|and|or|و|او)$/.test(n); };
  const without = (extra) => toks.filter((x) => !isStatusTok(x) && norm(x) !== extra).join(' ').trim();
  const withStatus = (base, k) => (arReq ? `${base} ${STATUS_ADJ[k].ar}` : /\binvoices\b/i.test(base) ? base.replace(/\binvoices\b/i, `${STATUS_ADJ[k].en} invoices`) : `${STATUS_ADJ[k].en} invoices ${base}`).trim();
  const opts = (keys, base, swap) => keys.map((k) => ({ label: { ar: `فواتير ${STATUS_ADJ[k].ar}`, en: `${STATUS_ADJ[k].en[0].toUpperCase()}${STATUS_ADJ[k].en.slice(1)} invoices` }, text: swap ? swap(k) : withStatus(base, k) }));
  const names = (keys, lang) => keys.map((k) => STATUS_ADJ[k][lang]).join(lang === 'ar' ? '، ' : ', ');
  if (kind === 'multiple') return { question: { ar: `ذكرتَ أكثر من حالة للفواتير (${names(data, 'ar')}). المرشّح يقبل حالة واحدة في كل تقرير. أيها تريد؟`, en: `You named more than one invoice status (${names(data, 'en')}). The filter takes one status per report. Which one do you want?` }, options: opts(data, without('')) };
  if (kind === 'due') return { question: { ar: '«مستحقة / due» لا تطابق حالة واحدة: قد تعني الفواتير القائمة أو المتأخرة أو التي لم يحن موعدها. أيها تقصد؟', en: '“Due” does not match one status: it can mean open, overdue or not-yet-due invoices. Which do you mean?' }, options: opts(data, '', (k) => toks.map((x) => (/^(?:due|مستحق\S*|المستحق\S*)$/.test(norm(x)) ? (arReq ? STATUS_ADJ[k].ar : STATUS_ADJ[k].en) : x)).join(' ')) };
  if (kind === 'pending') return { question: { ar: '«معلّقة / pending» لا تطابق حالة واحدة: قد تعني الفواتير القائمة (غير المسدّدة) أو التي لم يحن موعد استحقاقها. أيها تقصد؟', en: '“Pending” does not match one status: it can mean open (unpaid) invoices or invoices that are not yet due. Which do you mean?' }, options: opts(data, '', (k) => raw.split(/\s+/).map((x) => (/^(?:pending|معلق\S*|المعلق\S*)$/.test(norm(x)) ? (arReq ? STATUS_ADJ[k].ar : STATUS_ADJ[k].en) : x)).join(' ')) };
  const all = ['overdue', 'open', 'partial', 'collected', 'cancelled'];
  return { question: { ar: `لا توجد حالة فاتورة باسم «${data.phrase}». الحالات المتاحة: ${names(Object.keys(STATUS_ADJ), 'ar')}. أي حالة تريد؟`, en: `There is no invoice status called “${data.phrase}”. Available: ${names(Object.keys(STATUS_ADJ), 'en')}. Which status do you want?` }, options: opts(all, '', (k) => toks.map((x) => (norm(x).replace(/^ال/, '') === data.norm.replace(/^ال/, '') ? (arReq ? STATUS_ADJ[k].ar : STATUS_ADJ[k].en) : x)).join(' ')) };
}

// ---- a named Amanah / municipality / source that cannot be resolved: ONE precise question + clickable options that keep the rest of the request
const FIRST_AMANAHS = ['Riyadh Amanah', 'Jeddah Amanah', 'Eastern Province Amanah', 'Makkah Amanah', 'Al Madinah Amanah'];
function entityClarify(p, ent, raw, amanahLabel) {
  const arReq = /[؀-ۿ]/.test(raw); const T = ent.tokens; const amOf = (k) => amanahOptionsOf().find((a) => a.key === k);
  const amText = (k, listItem) => { const a = amOf(k); return arReq ? (listItem ? amanahCore(a) : `أمانة ${amanahCore(a)}`) : (listItem ? a.en.replace(/ Amanah$/, '') : a.en); };
  const amOpt = (k, listItem) => { const a = amOf(k); return { label: { ar: a.ar, en: a.en }, text: replaceSpan(T, p.span, `${p.connector || ''} ${amText(k, listItem)}`.trim()) }; };
  const withoutOpt = p.listItem ? [{ label: { ar: 'تابع بدونها', en: 'Continue without it' }, text: replaceSpan(T, p.span, '') }] : [];
  const others = (keys) => keys.filter((k) => !(p.named || []).includes(k) && (!ent.allowed || ent.allowed.includes(k)));
  const allOpt = { label: { ar: 'كل الأمانات', en: 'All Amanahs' }, text: replaceSpan(T, p.span, arReq ? 'كل الأمانات' : 'all Amanahs') };
  // ---- municipalities (reference hierarchy): every option is a re-worded request that names the municipality AND its Amanah, so it re-reads to exactly one filter value
  const allowed = ent.allowed || null; const okK = (k) => !allowed || allowed.includes(k); const AC = ent.access || null;
  const muniOk = (m) => !AC || AC.okMuni(m.amanah, m.refId); const groupOk = (k, tok) => !AC || AC.okGroup(k, tok); const entire = (k) => !AC || AC.entire(k);
  const AM_NOUN = /^(?:امانه|amanah|amana|of|the)$/; const outside = (a) => a.span[0] < p.span[0] || a.span[0] >= p.span[1];
  const amSpan = (a) => { let lo = a.span[0]; while (lo > 0 && AM_NOUN.test(T[lo - 1].n) && !(lo - 1 >= p.span[0] && lo - 1 < p.span[1])) lo -= 1; return [lo, a.span[1]]; }; // the Amanah's own noun goes with its name
  const dropOthers = ent.amanahs.filter(outside).map((a) => ({ span: amSpan(a), text: '' }));
  const mRec = (id) => municipalityRecord(id); const core = (m) => m.ar.replace(/^بلدية\s+/, '');
  const mText = (m) => (arReq ? `${m.ar} ${amText(m.amanah)}` : `municipality ${core(m)} of ${amText(m.amanah)}`);
  const mOpt = (m, qual) => ({ label: { ar: qual ? `${m.ar} — ${amOf(m.amanah).ar}` : m.ar, en: qual ? `${m.ar} — ${amOf(m.amanah).en}` : m.ar }, text: applyEdits(T, [{ span: p.span, text: mText(m) }, ...dropOthers]) });
  const gText = (tok, k) => `${arReq ? (tok === 'DIRECT' ? 'مباشر على الأمانة' : 'بلا بلدية') : (tok === 'DIRECT' ? 'issued directly by the Amanah' : 'no municipality')} ${amText(k)}`;
  const gOpt = (tok, k) => ({ label: tok === 'DIRECT' ? MUNICIPALITY_DIRECT : MUNICIPALITY_OPTION_NONE, text: applyEdits(T, [{ span: p.span, text: gText(tok, k) }, ...dropOthers]) });
  const wholeOpt = (k) => ({ label: entire(k) ? { ar: `أمانة ${amanahCore(amOf(k))} كلها`, en: `The whole ${amOf(k).en}` } : { ar: `أمانة ${amanahCore(amOf(k))} (ضمن صلاحيتك)`, en: `${amOf(k).en} (within your access)` }, text: ent.amanahs.some((a) => a.key === k && outside(a)) ? replaceSpan(T, p.span, '') : replaceSpan(T, p.span, amText(k)) });
  const ownersAr = (ms) => [...new Set(ms.map((m) => amOf(m.amanah).ar))].join('، '); const ownersEn = (ms) => [...new Set(ms.map((m) => amOf(m.amanah).en))].join(', ');
  const permitted = (allowed || FIRST_AMANAHS).filter((k) => amOf(k)).slice(0, 3);
  // a permission problem: the options drop EVERY Amanah / municipality phrase of the request and name one permitted Amanah instead
  const permSpans = (() => { const sp = [...ent.amanahs.map(amSpan), ...ent.problems.filter((x) => /^muni/.test(x.kind)).map((x) => x.span), ...(ent.muni ? [ent.muni.span] : [])].sort((a, b) => a[0] - b[0]); const out = []; for (const x of sp) { const last = out[out.length - 1]; if (last && x[0] <= last[1]) last[1] = Math.max(last[1], x[1]); else out.push([...x]); } return out; })();
  const permOpts = [...permitted.map((k) => ({ label: entire(k) ? { ar: `أمانة ${amanahCore(amOf(k))} كلها`, en: `The whole ${amOf(k).en}` } : { ar: `أمانة ${amanahCore(amOf(k))} (ضمن صلاحيتك)`, en: `${amOf(k).en} (within your access)` }, text: applyEdits(T, permSpans.map((sp, i) => ({ span: sp, text: i === 0 ? amText(k) : '' }))) })),
    ...(allowed && allowed.length > 1 ? [{ label: { ar: 'كل ما تتيحه صلاحيتي', en: 'Everything my access allows' }, text: applyEdits(T, permSpans.map((sp, i) => ({ span: sp, text: i === 0 ? (arReq ? 'كل الأمانات' : 'all Amanahs') : '' }))) }] : [])];
  const names = (keys, lang) => keys.map((k) => (lang === 'ar' ? amOf(k).ar : amOf(k).en)).join(lang === 'ar' ? '، ' : ', ');
  const tidy = (x) => x.replace(/^(?:and|or|plus|with|و|او|مع)\s+/i, '').replace(/\s+(?:and|or|plus|with|و|او|مع)$/i, '').replace(/\s+/g, ' ').trim();
  const q = (ar, en, options) => ({ question: { ar, en }, options: options.slice(0, 6).map((o) => ({ ...o, text: tidy(o.text) })) });
  switch (p.kind) {
    case 'amanah_unknown': return q(`لا توجد أمانة باسم «${p.phrase}» ضمن الأمانات المتاحة. لن أحوّل الطلب إلى «كل الأمانات» من تلقاء نفسي. اختر أمانة، أو اطلب «كل الأمانات» صراحةً.`, `There is no Amanah named “${p.phrase}” among the available ones. I will not turn the request into “all Amanahs” on my own. Pick an Amanah, or ask for “all Amanahs” explicitly.`, [...others(allowed || FIRST_AMANAHS).slice(0, 4).map((k) => amOpt(k, p.listItem)), ...(p.listItem ? withoutOpt : [allOpt])]);
    case 'amanah_fuzzy': return q(`لم أجد أمانة باسم «${p.phrase}». هل تقصد ${names(p.candidates, 'ar')}؟`, `I found no Amanah named “${p.phrase}”. Did you mean ${names(p.candidates, 'en')}?`, [...p.candidates.map((k) => amOpt(k, p.listItem)), ...(p.listItem ? withoutOpt : [allOpt])]);
    case 'amanah_ambiguous': return q(`«${p.phrase}» ينطبق على أكثر من أمانة (${names(p.candidates, 'ar')}). أيها تقصد؟`, `“${p.phrase}” matches more than one Amanah (${names(p.candidates, 'en')}). Which one do you mean?`, p.candidates.map((k) => amOpt(k)));
    case 'muni_unknown': {
      const A = p.amanah && amOf(p.amanah); const near = (p.candidates || []).map(mRec).filter(Boolean);
      if (p.noMunis) return q(`لا بلديات تحت ${A ? A.ar : 'هذه الجهة'} في المرجع، فلا توجد بلدية أُطبّق عليها «${p.phrase}». هل تريد الجهة كلها؟`, `${A ? A.en : 'This entity'} has no municipalities in the reference, so “${p.phrase}” cannot be applied. Do you want the whole entity?`, A ? [wholeOpt(p.amanah)] : []);
      return q(`لا توجد بلدية باسم «${p.phrase}»${A ? ` ضمن بلديات ${A.ar} في المرجع` : ' في المرجع'}.${near.length ? ` هل تقصد ${near.map((m) => m.ar).join(' أو ')}؟` : ''} لن أوسّع الطلب إلى الأمانة كلها من تلقاء نفسي.`,
        `There is no municipality named “${p.phrase}”${A ? ` among the municipalities of ${A.en} in the reference` : ' in the reference'}.${near.length ? ` Did you mean ${near.map((m) => m.ar).join(' or ')}?` : ''} I will not widen the request to the whole Amanah on my own.`,
        [...near.map((m) => mOpt(m, !A || m.amanah !== p.amanah)), ...(A ? [wholeOpt(p.amanah), ...['DIRECT', 'NOT_SPECIFIED'].filter((t) => groupOk(p.amanah, t)).map((t) => gOpt(t, p.amanah))] : [])]);
    }
    case 'muni_ambiguous': {
      const cs = p.candidates.map(mRec).filter(Boolean);
      return q(`«${p.phrase}» تنطبق على أكثر من بلدية: ${cs.map((m) => `${m.ar} (${amOf(m.amanah).ar})`).join('، ')}. أيها تقصد؟`, `“${p.phrase}” fits more than one municipality: ${cs.map((m) => `${m.ar} (${amOf(m.amanah).en})`).join(', ')}. Which one do you mean?`, cs.map((m) => mOpt(m, true)));
    }
    case 'muni_other_amanah': {
      const cs = p.candidates.map(mRec).filter(Boolean); const A = amOf(p.amanah);
      return q(`«${p.phrase}» ليست من بلديات ${A.ar} في المرجع، وهي تتبع ${ownersAr(cs)}${p.implied ? ' (والأمانة المختارة حالياً هي ' + A.ar + ')' : ''}. لن أطبّق بلدية على أمانة لا تتبعها. أيهما تريد؟`,
        `“${p.phrase}” is not one of the municipalities of ${A.en} in the reference; it belongs to ${ownersEn(cs)}${p.implied ? ` (the Amanah currently chosen is ${A.en})` : ''}. I will not apply a municipality to an Amanah it does not belong to. Which do you want?`, [...cs.map((m) => mOpt(m, true)), wholeOpt(p.amanah)]);
    }
    case 'muni_amanah_missing': case 'muni_amanah_ambiguous': {
      const grp = p.group; const gl = grp === 'DIRECT' ? MUNICIPALITY_DIRECT : MUNICIPALITY_OPTION_NONE;
      if (!grp) { const cs = (p.refs || []).map(mRec).filter(Boolean); return q(`ذكرتَ أكثر من أمانة مع بلدية «${p.phrase}». المرشّح يقبل أمانة واحدة وبلدية واحدة. بلدية أي أمانة تريد؟`, `You named more than one Amanah with the municipality “${p.phrase}”. The filter takes one Amanah and one municipality. Which Amanah’s municipality do you want?`, cs.map((m) => mOpt(m, true))); }
      const cands = ((p.candidates || []).length ? p.candidates : (allowed || FIRST_AMANAHS).slice(0, 5)).filter((k) => okK(k) && groupOk(k, grp));
      if (!cands.length) return q(`لا تملك صلاحية الوصول إلى «${gl.ar}» ضمن أي أمانة في نطاقك الحالي، فلا أُعدّ تقريراً عنها. يمكنك طلب تقرير ضمن صلاحياتك الحالية.`, `You don't have access to “${gl.en}” in any Amanah of your current scope, so I will not prepare a report on it. You can ask for a report within your current access.`, permOpts);
      return q(`ذكرتَ «${gl.ar}» دون أمانة واحدة محددة. هذه المجموعة تخص أمانة واحدة في كل مرة. أي أمانة تريد؟`, `You asked for “${gl.en}” without one specific Amanah. This group belongs to one Amanah at a time. Which Amanah do you want?`, cands.filter((k) => amOf(k)).map((k) => gOpt(grp, k)));
    }
    case 'muni_name_missing': {
      const A = amOf(p.amanah); const all = municipalityRecordsOf(p.amanah).filter(muniOk); const ex = all.slice(0, 3); // the count and the examples are the AUTHORIZED municipalities only
      return q(`${A.ar} لها ${all.length} بلدية في المرجع. اكتب اسم البلدية${ex.length ? ` (مثل «${ex.map((m) => m.ar).join('» أو «')}»)` : ''} أو اختر مجموعة، أو اعرض الأمانة كلها.`, `${A.en} has ${all.length} municipalities in the reference. Write the municipality name${ex.length ? ` (for example “${ex.map((m) => m.ar).join('” or “')}”)` : ''}, choose a group, or show the whole Amanah.`, [wholeOpt(p.amanah), ...['DIRECT', 'NOT_SPECIFIED'].filter((t) => groupOk(p.amanah, t)).map((t) => gOpt(t, p.amanah))]);
    }
    case 'muni_multiple': {
      const cs = p.candidates.map(mRec).filter(Boolean); const same = new Set(cs.map((m) => m.amanah)).size === 1;
      return q(`ذكرتَ أكثر من بلدية (${cs.map((m) => m.ar).join('، ')}). المرشّح يقبل بلدية واحدة في كل تقرير. أيها تريد؟`, `You named more than one municipality (${cs.map((m) => m.ar).join(', ')}). The filter takes one municipality per report. Which one do you want?`, [...cs.map((m) => mOpt(m, !same)), ...(p.amanah ? [wholeOpt(p.amanah)] : [])]);
    }
    case 'muni_forbidden': case 'amanah_forbidden': { // an ACCESS message: it names only what the person typed — no total, no candidate, no count, no resolved name
      const grp = p.group ? (p.group === 'DIRECT' ? MUNICIPALITY_DIRECT : MUNICIPALITY_OPTION_NONE) : null;
      const what = { ar: p.kind === 'amanah_forbidden' ? `الأمانة «${p.phrase}»` : grp ? `فواتير «${grp.ar}» لهذه الأمانة` : `البلدية «${p.phrase}»`, en: p.kind === 'amanah_forbidden' ? `the Amanah “${p.phrase}”` : grp ? `the “${grp.en}” invoices of this Amanah` : `the municipality “${p.phrase}”` };
      return q(`لا تملك صلاحية الوصول إلى ${what.ar}، فلا أُعدّ تقريراً عنها ولا أعرض أي أرقام أو معلومات تخصها. يمكنك طلب تقرير ضمن صلاحياتك الحالية.`, `You don't have access to ${what.en}, so I will not prepare a report on it or show any figures or details about it. You can ask for a report within your current permissions.`, permOpts);
    }
    case 'source_unknown': case 'source_unavailable': {
      const srcOpt = (k) => ({ label: { ar: sourceAr(k), en: sourceEn(k) }, text: replaceSpan(T, p.span, arReq ? sourceAr(k) : sourceEn(k)) });
      const near = (p.candidates || []).length ? p.candidates : ['fines', 'municipal_fees', 'investment', 'licenses']; const hint = (p.candidates || []).length;
      return q(p.kind === 'source_unavailable' ? `«${p.phrase}» ليس مصدر إيراد في هذا النظام. المصادر: ${REVENUE_SOURCE_KEYS.map(sourceAr).join('، ')}. أي مصدر تريد؟` : `لا يوجد مصدر إيراد باسم «${p.phrase}»${hint ? '. هل تقصد أحد هذه؟' : `. المصادر: ${REVENUE_SOURCE_KEYS.map(sourceAr).join('، ')}. أي مصدر تريد؟`}`,
        p.kind === 'source_unavailable' ? `“${p.phrase}” is not a revenue source in this system. Sources: ${REVENUE_SOURCE_KEYS.map(sourceEn).join(', ')}. Which source do you want?` : `There is no revenue source named “${p.phrase}”${hint ? '. Did you mean one of these?' : `. Sources: ${REVENUE_SOURCE_KEYS.map(sourceEn).join(', ')}. Which source do you want?`}`, [...near.map(srcOpt), { label: { ar: 'كل المصادر', en: 'All sources' }, text: replaceSpan(T, p.span, arReq ? 'كل المصادر' : 'all sources') }]);
    }
    case 'source_ambiguous': return q(`«${p.phrase}» تنطبق على أكثر من مصدر إيراد (${p.candidates.map(sourceAr).join('، ')}). أي مصدر تقصد؟`, `“${p.phrase}” fits more than one revenue source (${p.candidates.map(sourceEn).join(', ')}). Which source do you mean?`, p.candidates.map((k) => ({ label: { ar: sourceAr(k), en: sourceEn(k) }, text: replaceSpan(T, p.span, arReq ? sourceAr(k) : sourceEn(k)) })));
    default: return q('لم أستطع تحديد جزء من الطلب. هل تعيد صياغته؟', 'I could not resolve a part of the request. Could you rephrase it?', []);
  }
}

export function interpret(text, prev, today, { amanahLabel = (k) => k, base: baseSpec = null, noOffer = false, allowedAmanahs = null, access = null } = {}) {
  const raw = canonMonths(cleanRaw(text)); const s = norm(raw); // digits, tashkeel, tatweel, Levant month names folded once
  const base = prev ? JSON.parse(JSON.stringify(prev)) : JSON.parse(JSON.stringify(baseSpec || defaultSpec(today)));
  const spec = base; const changes = []; const note = (key, label, value) => changes.push({ key, label, value });
  if (!s) return { kind: 'empty', spec, changes };
  // ---- access: no access at all → a clear message; a base / previous spec holding a value outside the access is sanitised (reported, never silently widened)
  const geo = access ? asGeoScope(access) : null; let accessNotice = null;
  if (geo && isNoAccess(geo)) return { kind: 'unsupported', spec: prev || spec, changes: [], question: REOPEN_MSG.none, noAccess: true };
  if (geo && !geo.all) { const r = sanitizeScopeValues({ amanah: spec.scope.amanah, muni: spec.scope.muni }, geo); if (r.dropped.length) { spec.scope.amanah = r.amanah; spec.scope.muni = r.muni; accessNotice = SANITIZE_NOTICE; } }

  // ---- a part of the request that cannot be applied is asked about BEFORE anything is generated (never dropped silently)
  const unapplied = findUnapplied(s);
  if (unapplied.length) {
    const actionOnly = unapplied.every((u) => u.action); const names = [...new Set(unapplied.map((u) => u.key))].map((k) => unapplied.find((u) => u.key === k));
    const spans = [...new Set(unapplied.map((u) => u.span))].join('، ');
    const rest = stripUnapplied(raw, unapplied, norm);
    const offer = !actionOnly && !noOffer && rest.length >= 3 && ['report', 'question'].includes(interpret(rest, prev, today, { amanahLabel, base: baseSpec, noOffer: true, allowedAmanahs, access }).kind);
    return { kind: actionOnly ? 'unsupported' : 'clarify', spec: prev || spec, changes: [], unapplied: names.map((u) => u.key),
      question: { ar: `لا أستطيع تطبيق ${names.map((u) => u.ar).join(' و')} (${spans}) على التقرير.${actionOnly ? ' يمكنك تصدير أي تقرير بصيغة Word أو Excel أو PowerPoint من أعلى التقرير.' : ' هل أتابع بدونه، أم تعيد صياغة الطلب؟'}`, en: `I cannot apply ${names.map((u) => u.en).join(' and ')} (${spans}) to the report.${actionOnly ? ' You can export any report as Word, Excel or PowerPoint from the top of the report.' : ' Shall I continue without it, or will you rephrase the request?'}` },
      options: offer ? [{ label: { ar: 'تابع بدونه', en: 'Continue without it' }, text: rest }] : [] };
  }
  // ---- one focused clarification when the request is materially ambiguous
  const prevAmanah = typeof spec.scope.amanah === 'string' && spec.scope.amanah !== 'all' ? spec.scope.amanah : null;
  const ent = resolveEntities(raw, { isKnown: (tok) => isKnown(tok, knownWords()), prevAmanah, allowedAmanahs, access });
  const amHits = [...new Set(ent.amanahs.map((a) => a.key))];
  if (!prev && has(s, /^(قارن|مقارنه)( بالشهر الماضي| بالعام الماضي| بالفتره السابقه)?$/)) return { kind: 'clarify', spec, changes: [], question: { ar: 'ماذا تريد أن أقارن؟ لا يوجد تقرير حالي أبني عليه المقارنة.', en: 'What should I compare? There is no current report to build the comparison on.' }, options: [{ label: { ar: 'أداء التحصيل بين الأمانات', en: 'Collection performance between Amanahs' }, text: 'قارن أداء التحصيل بين الأمانات' }, { label: { ar: 'تقرير هذا الشهر مقارناً بالشهر الماضي', en: 'This month’s report compared with last month' }, text: 'أنشئ تقرير الإيرادات لهذا الشهر حتى اليوم قارن بالشهر الماضي' }] };
  if (amHits.length > 1 && has(s, /فقط/)) return { kind: 'clarify', spec, changes: [], question: { ar: 'ذكرتَ أكثر من أمانة مع «فقط». أيها تريد؟', en: 'You named more than one Amanah with “only”. Which one?' }, options: amHits.slice(0, 4).map((k) => ({ label: { ar: amanahLabel(k), en: amanahLabel(k) }, text: `اعرض أمانة ${amanahLabel(k).replace(/^أمانة\s*(منطقة\s*)?/, '')} فقط` })) };
  // an Amanah / municipality / source that is named but resolves to nothing (or to several things) is ASKED about, with options that keep the rest of the request — never dropped, never widened to «all»
  // (a bare «fees» is the softest problem: when the sentence also holds a word nothing recognises, that word is asked about first)
  const firstProblem = ent.problems.find((p) => p.kind !== 'source_ambiguous') || (noOffer || !unknownTerms(raw, new Set(ent.consumed)).length ? ent.problems[0] : null);
  if (firstProblem) return { kind: 'clarify', spec: prev || spec, changes: [], ...entityClarify(firstProblem, ent, raw, amanahLabel), problems: ent.problems.map((p) => ({ kind: p.kind, phrase: p.phrase, candidates: p.candidates })) };
  // ---- «remove the source / status / municipality filter»
  if (has(s, /\b(?:remove|clear|drop)\s+(?:the\s+)?source(?:\s+filter)?\b|(?:ازل|امسح|احذف|الغ|الغي)\s+(?:ال)?(?:مرشح|فلتر)\s+(?:ال)?مصدر|(?:بدون|دون)\s+(?:ال)?مصدر/) && spec.scope.source !== 'all') { spec.scope.source = 'all'; note('source', 'source', 'all'); }
  if (has(s, /\b(?:remove|clear|drop)\s+(?:the\s+)?status(?:\s+filter)?\b|(?:ازل|امسح|احذف|الغ|الغي)\s+(?:ال)?(?:مرشح|فلتر)\s+(?:ال)?حاله/) && spec.scope.status !== 'all') { spec.scope.status = 'all'; note('status', 'status', 'all'); }
  if (has(s, /\b(?:remove|clear|drop)\s+(?:the\s+)?municipality(?:\s+filter)?\b|(?:ازل|امسح|احذف|الغ|الغي)\s+(?:ال)?(?:مرشح|فلتر)\s+(?:ال)?بلديه/) && spec.scope.muni !== 'all') { spec.scope.muni = 'all'; note('muni', 'muni', 'all'); }
  // ---- «remove the Amanah filter»
  if (has(s, /\b(?:remove|clear|drop)\s+(?:the\s+)?amanah(?:\s+filter)?\b|(?:ازل|امسح|احذف|الغ|الغي)\s+(?:ال)?(?:مرشح|فلتر)\s+(?:ال)?امانه|(?:بدون|دون)\s+(?:ال)?امانه/) && spec.scope.amanah !== 'all') { spec.scope.amanah = 'all'; spec.scope.muni = 'all'; note('amanah', 'amanah', 'all'); }
  // ---- reset
  const reset = has(s, /(ابدا من جديد|(?:ازل|امسح|احذف|صفر|الغ(?:ي)?) (?:كل )?(?:ال)?(?:مرشحات|فلاتر|فلتر|تصفيه)|بدون مرشحات|بدون تصفيه|كل التصفية|\b(?:reset|clear|remove) (?:all )?(?:the )?filters\b)/);
  if (reset) { const d = defaultSpec(today); spec.scope = d.scope; spec.preset = d.preset; spec.compare = 'none'; note('reset', 'reset', null); }

  // ---- comparison. Only the OBJECT of «قارن / مقارنة … / compare with …» is a comparison; a period word elsewhere in the sentence
  // («تقرير الشهر الماضي مقارنة بالعام الماضي») is the report period.
  const CMP_MONTH = /(?:ب|مع)?(?:ال)?شهر\s*(?:ال)?(?:ماضي|سابق|اللي فات|الي فات|الفايت)|(?:the\s+)?(?:last|previous)\s+month|the\s+month\s+before|الشهر اللي قبل/;
  const CMP_YEAR = /(?:ب|مع)?(?:ال)?(?:عام|سنه)\s*(?:ال)?(?:ماضي|سابق)|(?:the\s+)?(?:last|previous)\s+year|same period last year|نفس الفتره/;
  let t = s; let compareNew = null; let cmpPeriod = null; let cmpInferred = false;
  const trig = s.match(/(?:^|\s)(?:و)?(?:ال)?(قارن|مقارنه|بالمقارنه|مقابل|compare|compared|versus|vs|(?:افضل|احسن|اسوا|اعلي|اقل|اكثر|تحسن|تراجع|ارتفع|انخفض) (?:من|عن)|(?:ارتفع|انخفض|زاد|نقص|تحسن|تراجع)(?: [^ ]+){1,2} (?:من|عن)|(?:better|worse|higher|lower|more|less) than)(?=\s|$)/);
  if (trig && amHits.length < 2) {
    const before = s.slice(0, trig.index); const after = s.slice(trig.index + trig[0].length);
    if (CMP_MONTH.test(after)) { compareNew = 'prev_month'; t = `${before} ${after.replace(CMP_MONTH, ' ')}`; }
    else if (CMP_YEAR.test(after)) { compareNew = 'prev_year'; t = `${before} ${after.replace(CMP_YEAR, ' ')}`; }
    else if (!before.replace(/تقرير|report|لل?/g, ' ').trim() && monthsInOrder(after).length >= 2) { // «مقارنة أغسطس بيوليو»: the first month is the report, the second the month before it
      const [m1, m2] = monthsInOrder(after); const yr = (after.match(/\b(20\d{2})\b/) || [])[1] || ''; const p1 = parsePeriod(`شهر ${m1} ${yr}`, today); const p2 = parsePeriod(`شهر ${m2} ${yr}`, today);
      if (p1 && p2 && isSingleMonth(p1) && previousMonthScope(p1, today).from === p2.from) { compareNew = 'prev_month'; cmpInferred = true; t = `شهر ${m1} ${yr}`; }
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
    const ex = parseExtraPeriod(t, today); // ranges of months / quarters / years, «last quarter», and periods that do not exist (Q5, month 13, 31 Feb)
    if (ex?.problem) return { kind: 'clarify', spec: prev || spec, changes: [], question: { ar: ex.problem.ar, en: ex.problem.en }, options: ex.problem.options || PERIOD_OPTIONS, problems: [{ kind: 'period_invalid', phrase: t }] };
    if (ex?.period?.beforeData) return { kind: 'clarify', spec, changes: [], question: { ar: rangeMessage('before_data', 'ar', { today }), en: rangeMessage('before_data', 'en', { today }) }, options: PERIOD_OPTIONS };
    if (ex?.period) per = ex.period;
    else if (!compareNew && !cmpPeriod && periodMentions(t) >= 2) return { kind: 'clarify', spec, changes: [], question: { ar: 'ذكرتَ أكثر من فترة في طلب واحد. أي فترة تريد؟ (يمكنك طلب المقارنة بين شهرين متتاليين: «تقرير سبتمبر مقارنة بأغسطس»)', en: 'You named more than one period in one request. Which one do you want? (You can compare two consecutive months: “September report compared with August”.)' }, options: PERIOD_OPTIONS };
    if (!per) per = parsePeriod(t, today, { reportFuture: true });
    if (per && per.beforeData) return { kind: 'clarify', spec, changes: [], question: { ar: rangeMessage('before_data', 'ar', { today }), en: rangeMessage('before_data', 'en', { today }) }, options: PERIOD_OPTIONS };
  }
  if (per && per.notStarted) { // D-04: a period that has not started is never turned into a reversed range
    const nm = QUARTER_NAMES[per.label] || null;
    const what = nm ? { ar: nm.ar, en: nm.en } : per.label === 'range' ? { ar: 'الفترة المطلوبة', en: 'The period you asked for' } : { ar: 'الشهر المطلوب', en: 'The month you asked for' };
    return { kind: 'clarify', spec, changes: [], question: { ar: `${what.ar} لم يبدأ بعد (يبدأ ${per.from}، وآخر بيانات ${today}). أي فترة تريد؟`, en: `${what.en} has not started yet (it starts ${per.from}; the latest data is ${today}). Which period do you want?` }, options: PERIOD_OPTIONS };
  }
  // F-05 guard: a period phrase that was recognised as a period but could not be applied is never ignored silently
  if (UNRESOLVED_PERIOD.test(s) || (FUTURE_DAY.test(s) && has(s, /تقرير|ايراد|تحصيل|فاتور|\b(?:report|revenue|collection|invoices?)\b/)) || (!per && !compareNew && UNAPPLIED_PERIOD.test(s))) return { kind: 'clarify', spec, changes: [], question: { ar: 'فهمتُ أنك تقصد فترة زمنية لكنني لا أستطيع تحديدها من هذه الصياغة. الفترات المدعومة: هذا الشهر، الشهر الماضي، السنة حتى اليوم، الربع الأول…، اسم شهر، أو «2026-01-01 إلى 2026-03-31». أي فترة تريد؟', en: 'I understood that you mean a period but cannot resolve it from this wording. Supported: this month, last month, year to date, Q1…, a month name, or “2026-01-01 to 2026-03-31”. Which period do you want?' }, options: PERIOD_OPTIONS };
  let cutoffEnd = null; // the period's natural end when the data cutoff cuts it short («2026» = 1 Jan → today, not 31 Dec)
  if (per && !per.notStarted) {
    const moved = per.from !== spec.scope.from || per.to !== spec.scope.to;
    if (moved) { spec.scope.from = per.from; spec.scope.to = per.to; spec.preset = periodPreset(per.from, per.to, today); }
    if (moved || !prev) { // a first request that names a period lists it even when it equals the default, so the reading is visible
      cutoffEnd = naturalEndOf(per, today, t); note('period', 'period', `${per.from} → ${per.to}`);
      if (cutoffEnd) Object.assign(changes[changes.length - 1], { endsAtCutoff: true, naturalEnd: cutoffEnd });
    }
  }
  if (cmpPeriod) { // «… مقارنة بأغسطس»: a named month is supported only when it is exactly the month before the report month
    const cur = { from: spec.scope.from, to: spec.scope.to };
    if (!cmpPeriod.notStarted && isSingleMonth(cur) && previousMonthScope(cur, today).from === cmpPeriod.from) compareNew = 'prev_month';
    else return { kind: 'clarify', spec: prev || spec, changes: [], question: { ar: 'المقارنة بفترة محددة بالاسم غير مدعومة إلا إذا كانت الشهر السابق مباشرة. المتاح: المقارنة بالشهر الماضي أو بنفس الفترة من العام الماضي.', en: 'Comparing with a named period is supported only when it is the month right before the report month. Available: last month, or the same period last year.' }, options: [{ label: { ar: 'مقارنة بالشهر الماضي', en: 'Compare with last month' }, text: 'قارن بالشهر الماضي' }, { label: { ar: 'مقارنة بالعام الماضي', en: 'Compare with last year' }, text: 'قارن بالعام الماضي' }] };
  }
  if (compareNew && trig && /(?:ارتفع|انخفض|زاد|نقص|تحسن|تراجع|افضل|احسن|اسوا|better|worse|higher|lower|did|how)/.test(s)) cmpInferred = true; // a comparison read out of a question rather than asked for
  if (compareNew && compareNew !== spec.compare) { spec.compare = compareNew; note('compare', 'compare', compareNew); }

  // ---- Amanah / municipality
  if (has(s, /(كل الامانات|جميع الامانات|كل امانه|\b(all|every) amanahs?\b)/) && spec.scope.amanah !== 'all') { spec.scope.amanah = 'all'; spec.scope.muni = 'all'; note('amanah', 'amanah', 'all'); }
  const srcs = ent.sources.map((x) => x.key);
  if (srcs.length >= 2 && !has(s, /(توزيع|حسب).{0,12}(مصدر|المصادر)|by source/)) return { kind: 'clarify', spec: prev || spec, changes: [], question: { ar: 'ذكرتَ أكثر من مصدر إيراد في طلب واحد. أي مصدر تريد؟ (أو اطلب «توزيع الإيرادات حسب المصدر»)', en: 'You named more than one revenue source in one request. Which one do you want? (Or ask for “revenue by source”.)' }, options: [...srcs.slice(0, 3).map((k) => ({ label: { ar: sourceAr(k), en: sourceEn(k) }, text: `تقرير ${sourceAr(k)}` })), { label: { ar: 'توزيع حسب المصدر', en: 'Breakdown by source' }, text: 'تقرير الإيرادات حسب مصدر الإيراد' }] };
  if (has(s, /(^|\s)(?:ال)?مبيعات(\s|$)/) && !srcs.length) return { kind: 'clarify', spec: prev || spec, changes: [], question: { ar: 'هل تقصد «مبيعات الإسكان»؟ المبيعات ليست مصدراً مستقلاً في هذا النظام.', en: 'Do you mean “housing sales”? Sales is not a separate revenue source in this system.' }, options: [{ label: { ar: 'تقرير مبيعات الإسكان', en: 'Housing sales report' }, text: 'تقرير مبيعات الإسكان' }] };
  const am = amHits;
  const cmpAmanahs = am.length >= 2 && (!!trig || has(s, /(comparison|compared|between|بين)/)); // «قارن الرياض بجدة»
  // several named Amanahs are ALWAYS applied together (a list needs no connector word); the UI shows the reading for confirmation
  if (am.length >= 1 && !has(s, /بين الامانات/)) {
    const val = am.length === 1 ? am[0] : am;
    if (JSON.stringify(val) !== JSON.stringify(spec.scope.amanah)) { spec.scope.amanah = val; spec.scope.muni = 'all'; note('amanah', 'amanah', val); }
  }
  // «all Amanahs» asked for explicitly in a first request is listed in the reading even though it equals the default, so the user sees it was understood
  if (!prev && !am.length && (ent.genericAmanahs || has(s, /(كل الامانات|جميع الامانات|\b(all|every) amanahs?\b)/)) && !changes.some((c) => c.key === 'amanah')) note('amanah', 'amanah', 'all');
  if (ent.muni && !has(s, /(كل البلديات|جميع البلديات)/)) { // a municipality (or an explicit group) is read under ONE Amanah: the one named, the one already chosen, or the parent the reference gives it
    const key = ent.muni.key; const amKey = ent.muni.amanah;
    if (spec.scope.muni !== key || spec.scope.amanah !== amKey) {
      if (spec.scope.amanah !== amKey && !changes.some((c) => c.key === 'amanah')) note('amanah', 'amanah', amKey);
      spec.scope.amanah = amKey; spec.scope.muni = key; note('muni', 'muni', key);
    }
  }
  if (has(s, /(كل البلديات|جميع البلديات)/) && spec.scope.muni !== 'all') { spec.scope.muni = 'all'; note('muni', 'muni', 'all'); }

  // ---- source
  if (has(s, /(كل المصادر|جميع المصادر|كل مصادر الايراد)/) && spec.scope.source !== 'all') { spec.scope.source = 'all'; note('source', 'source', 'all'); }
  const src = srcs[0] || null;
  if (src && src !== spec.scope.source && !has(s, /(توزيع|حسب).{0,12}(مصدر|المصادر)/)) { spec.scope.source = src; note('source', 'source', src); }

  // ---- status and scope type (only with an explicit "invoices … only" phrasing, so «المتأخرات حسب المصدر» stays a report SECTION)
  const statusPhrase = has(s, /(الفواتير|فواتير|invoices)/) || has(s, /فقط|\bonly\b/) || has(s, /(كل الحالات|جميع الحالات|all statuses)/);
  if (statusPhrase) {
    const found = statusesIn(s.replace(new RegExp(NC_EN.source, 'g'), ' ')); // every DISTINCT status named (a higher-priority phrase hides the words inside it: «غير المحصلة» is open, not collected)
    if (found.length > 1) return { kind: 'clarify', spec: prev || spec, changes: [], ...statusClarify('multiple', found, raw), problems: [{ kind: 'status_multiple', candidates: found }] };
    if (!found.length && has(s, /\b(?:pending)\b|معلق/)) return { kind: 'clarify', spec: prev || spec, changes: [], ...statusClarify('pending', ['open', 'not_due'], raw), problems: [{ kind: 'status_ambiguous', phrase: 'pending', candidates: ['open', 'not_due'] }] };
    if (!found.length && has(s, /\bdue\b|(?:^|\s)(?:ال)?مستحق/)) return { kind: 'clarify', spec: prev || spec, changes: [], ...statusClarify('due', ['open', 'overdue', 'not_due'], raw), problems: [{ kind: 'status_ambiguous', phrase: 'due', candidates: ['open', 'overdue', 'not_due'] }] };
    const odd = !found.length ? unknownStatusWord(raw, s) : null;
    if (odd) return { kind: 'clarify', spec: prev || spec, changes: [], ...statusClarify('unknown', odd, raw), problems: [{ kind: 'status_unknown', phrase: odd.phrase }] };
    const st = found.length ? [found[0]] : null;
    if (st && st[0] !== spec.scope.status) { spec.scope.status = st[0]; note('status', 'status', st[0]); }
    if (has(s, /(كل الحالات|جميع الحالات)/) && spec.scope.status !== 'all') { spec.scope.status = 'all'; note('status', 'status', 'all'); }
    const sc = has(s, /داخلي/) ? 'internal' : has(s, /مركزي/) ? 'central' : null;
    if (sc && sc !== spec.scope.scopeType) { spec.scope.scopeType = sc; note('scopeType', 'scopeType', sc); }
  }

  // ---- depth and sections
  const isQuestion = has(norm(raw + ' '), /^(كم|ما|ماذا|هل|لماذا|كيف|اين|وين|وش|ايش|اي|من(?!\s+(?:\d|شهر(?=\s|$)|(?:ال)?ربع(?=\s|$)|يناير|فبراير|مارس|ابريل|مايو|يونيو|يوليو|اغسطس|سبتمبر|اكتوبر|نوفمبر|ديسمبر))|احسب|what|how|which|when|why|is|are|did|do|does|was|were|can|could)(?=\s|$)/) || /[؟?]\s*$/.test(raw);
  const createVerb = (has(s, /(انشئ|جهز|اعد|اعمل|ابني|حضر|اطلب|اريد|ابغى|ابي|اعطني|اعرض لي)/) && has(s, /تقرير/)) || (has(s, /\b(create|prepare|generate|make|build|show me|give me|i want|i need)\b/) && has(s, /\breport\b/));
  const monthlyLike = has(s, /(مشابه|مماثل|كالتقارير|التقارير المرفقه|تقرير شهري|تقريرا شهريا)/);
  const detailedWord = has(s, /(تفصيلي|مفصل|شامل|بالتفصيل|\bdetailed\b|\bfull report\b)/);
  const summaryWord = has(s, /(ملخص|موجز|مختصر|باختصار|\bsummary\b|\bbrief\b)/);
  const picked = [...SECTION_WORDS, ...SECTION_WORDS_EN].filter(([, re]) => re.test(s)).map(([k]) => k);
  if (has(s, /عدم التحصيل/) && picked.includes('exclusions') && !picked.includes('status')) picked.push('status'); // «…عدم التحصيل والاستبعادات» keeps the older exclusions + status pair; the non-collection analysis alone stays a single section
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
    const unk = unknownTerms(raw, new Set(ent.consumed));
    if (unk.length) {
      const rawWords = raw.split(/\s+/); const kept = rawWords.filter((w) => !unk.includes(norm(w))).join(' ').trim();
      const offer = kept.length >= 3 && ['report', 'question'].includes(interpret(kept, prev, today, { amanahLabel, base: baseSpec, noOffer: true, allowedAmanahs, access }).kind);
      const shown = unk.map((t) => rawWords.find((w) => norm(w) === t) || t).join('، ');
      return { kind: 'clarify', spec: prev || spec, changes: [], unknownTerms: unk,
        question: { ar: `لم أتعرف على «${shown}» ضمن ما أستطيع تطبيقه (الفترة، الأمانة، المصدر، الحالة، المقارنة). هل أتابع بدونه، أم تعيد صياغة الطلب؟`, en: `I did not recognise “${shown}” among what I can apply (period, Amanah, source, status, comparison). Shall I continue without it, or will you rephrase?` },
        options: offer ? [{ label: { ar: 'تابع بدونه', en: 'Continue without it' }, text: kept }] : [] };
    }
  }
  // DEMO SAFETY: requests in the categories where fresh runs still produced silent misreads are CONFIRMED by the user before the report is generated
  // (the UI shows the interpreted scope with «confirm / edit / cancel»). The interpreter only flags them; it never blocks a clear, standard request.
  const confirm = []; const strictAm = new Set(parseAmanahStrict(raw)); const changed = (k) => changes.some((c) => c.key === k);
  if (changed('amanah') && Array.isArray(spec.scope.amanah) && spec.scope.amanah.length > 1) confirm.push({ key: 'multi_amanah', ar: 'عدة أمانات في طلب واحد', en: 'several Amanahs in one request' });
  if (changed('amanah') && am.some((k) => !strictAm.has(k))) confirm.push({ key: 'variant_name', ar: 'اسم أمانة مكتوب بصيغة بديلة أو مختصرة', en: 'an Amanah name written in a variant or short form' });
  if (changed('period') && (iso || dayRange || /منذ|\bsince\b|(?:ال)?(?:عام|سنه)\s*(?:ال)?(?:ماضي|سابق)|\blast year\b|\bso far\b/.test(t))) confirm.push({ key: 'period_variant', ar: 'فترة مكتوبة بصيغة غير قياسية', en: 'a period written in a non-standard way' });
  if (changed('compare') && cmpInferred) confirm.push({ key: 'inferred_comparison', ar: 'مقارنة مستنتجة من صياغة الطلب', en: 'a comparison inferred from the wording' });
  if (ent.muni?.inferredAmanah && changed('muni')) confirm.push({ key: 'muni_amanah_inferred', ar: 'الأمانة مأخوذة من تبعية البلدية في المرجع', en: 'the Amanah is taken from the municipality’s parent in the reference' });
  if (prev && changes.length >= 3) confirm.push({ key: 'multi_change', ar: 'عدة تعديلات في طلب متابعة واحد', en: 'several changes in one follow-up' });
  const interpretation = { amanah: spec.scope.amanah, genericAmanahs: !am.length && (ent.genericAmanahs || changes.some((c) => c.key === 'amanah' && c.value === 'all')), muni: spec.scope.muni, source: spec.scope.source, status: spec.scope.status, period: { from: spec.scope.from, to: spec.scope.to, endsAtCutoff: !!cutoffEnd, ...(cutoffEnd ? { naturalEnd: cutoffEnd } : {}) },
    resolved: [...ent.amanahs.map((a) => ({ kind: 'amanah', input: a.text, key: a.key, via: a.via })), ...ent.sources.map((x) => ({ kind: 'source', input: x.text, key: x.key, via: x.via })), ...(ent.muni ? [{ kind: 'municipality', input: ent.muni.phrase, key: ent.muni.key, via: ent.muni.via, group: ent.muni.group, name: ent.muni.name, inferredAmanah: ent.muni.inferredAmanah }] : [])] };
  if (geo && !geo.all) interpretation.access = { restricted: true, summary: { ar: describeAccess(geo, 'ar'), en: describeAccess(geo, 'en') } };
  return { kind: isQuestion && !createVerb ? 'question' : 'report', spec, changes, sectionsChanged, startNew, confirm, interpretation, ...(accessNotice ? { accessNotice } : {}) };
}

const STATUS_LABELS = { all: { ar: 'كل الحالات', en: 'All statuses' }, collected: { ar: 'محصّلة', en: 'Collected' }, open: { ar: 'قائمة', en: 'Open' }, overdue: { ar: 'متأخرة', en: 'Overdue' }, partial: { ar: 'جزئية', en: 'Partial' }, not_due: { ar: 'لم تستحق', en: 'Not due' }, cancelled: { ar: 'ملغاة', en: 'Cancelled' }, excluded: { ar: 'مستبعدة', en: 'Excluded' } };
export function describeChange(c, lang, { amanahLabel = (k) => k, spec, access = null } = {}) {
  const ar = lang === 'ar'; const L = (a, e) => (ar ? a : e); const restricted = !!access && !asGeoScope(access).all; // «all» reads as «everything your access allows» under a restricted access
  const lab = { sections: L('أُضيف قسم', 'Section added'), period: L('الفترة', 'Period'), amanah: L('الأمانة', 'Amanah'), muni: L('البلدية', 'Municipality'), source: L('المصدر', 'Source'), status: L('حالة الفاتورة', 'Invoice status'), scopeType: L('النطاق', 'Scope'), compare: L('المقارنة', 'Comparison'), depth: L('مستوى التفصيل', 'Depth'), reset: L('التصفية', 'Filters') }[c.key];
  const v = c.key === 'amanah' ? (c.value === 'all' ? (restricted ? allAuthorizedLabel(access, lang) : L('كل الأمانات', 'All Amanahs')) : [].concat(c.value).map(amanahLabel).join('، '))
    : c.key === 'compare' ? ({ prev_month: spec && !isSingleMonth(spec.scope) ? L('الفترة السابقة المساوية في الطول', 'Preceding period of equal length') : L('الشهر الماضي (المدة المنقضية نفسها)', 'Last month (same elapsed days)'), prev_year: L('نفس الفترة من العام السابق', 'Same period last year'), none: L('بدون', 'None') }[c.value])
      : c.key === 'period' && /^\d{4}-\d{2}-\d{2} → \d{4}-\d{2}-\d{2}$/.test(String(c.value)) ? `${fmtRangeText(String(c.value).slice(0, 10), String(c.value).slice(-10), ar ? 'ar' : 'en')}${c.endsAtCutoff ? L(` (حتى تاريخ آخر بيانات، وليس حتى ${fmtDateText(c.naturalEnd, 'ar')})`, ` (up to the data cutoff, not to ${fmtDateText(c.naturalEnd, 'en')})`) : ''}`
      : c.key === 'sections' ? String(c.value).split(',').map((k) => SECTION_META[k]?.[ar ? 'ar' : 'en'] || k).join('، ') : c.key === 'depth' ? L('تفصيلي', 'Detailed') : c.key === 'reset' ? L('أُعيدت إلى الافتراضي', 'Reset to default') : c.key === 'muni' ? (c.value === 'all' && restricted ? allMunicipalitiesLabel(access, spec?.scope?.amanah, lang) : muniLabel(c.value, ar ? 'ar' : 'en'))
        : c.key === 'source' ? (c.value === 'all' ? L('كل المصادر', 'All sources') : (ar ? sourceAr(c.value) : sourceEn(c.value)))
          : c.key === 'status' ? (STATUS_LABELS[c.value]?.[ar ? 'ar' : 'en'] || String(c.value)) : String(c.value);
  return `${lab}: ${v}`;
}
export { addDaysIso };
