// ============================================================================
// Assistant question router. Pure and deterministic: it extracts an intent and
// a scope override from the user's text and never produces a number itself.
// Numbers always come from the shared metric layer via an analysis task.
// ============================================================================
import { amanahOptionsOf, UNAVAILABLE_REVENUE_SOURCES, DATA_CUTOFF, DATA_START } from './revenueLedger';
import { startOfYear, startOfMonth, prevMonthEnd, addDaysIso, lastCompleteMonths } from './clock';

const has = (s, words) => words.some((w) => s.includes(w));

export const INTENTS = ['uncollected', 'why_decline', 'overview', 'noncollection', 'exclusions', 'forecast', 'target_coverage', 'amanah_compare', 'invoice', 'enforcement', 'sources', 'report', 'unknown'];

const MONTH_RES = [
  [1, /\b(january|jan)\b/], [2, /\b(february|feb)\b/], [3, /\b(march|mar)\b/], [4, /\b(april|apr)\b/],
  [5, /\b(in|for|during|of)\s+may\b|\bmay\s+(2025|2026|collection|revenue|billing|invoices)/], [6, /\b(june|jun)\b/],
  [7, /\b(july|jul)\b/], [8, /\b(august|aug)\b/], [9, /\b(september|sept|sep)\b/], [10, /\b(october|oct)\b/],
  [11, /\b(november|nov)\b/], [12, /\b(december|dec)\b/]
];
const AR_MONTHS = { 'يناير': 1, 'فبراير': 2, 'مارس': 3, 'أبريل': 4, 'ابريل': 4, 'مايو': 5, 'يونيو': 6, 'يوليو': 7, 'أغسطس': 8, 'سبتمبر': 9, 'أكتوبر': 10, 'نوفمبر': 11, 'ديسمبر': 12 };

// Arabic spelling variants folded to one form (used wherever free text is matched)
export const normAr = (t) => String(t || '').toLowerCase().replace(/[\u064B-\u0670]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ـ/g, '').replace(/\s+/g, ' ').trim();
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);

// Periods are relative to the REAL date (Asia/Riyadh) passed in as `cutoff`: "this month" = month start → today,
// "this year" = Jan 1 → today, a named month is the latest such month that is not in the future.
// A quarter / month that has not started yet (nothing to report) is returned as { notStarted: true, from, label } only when the caller asks
// for it (`reportFuture`), so it can tell the user; every other caller gets null instead of a reversed range (D-04).
export function parsePeriod(text, cutoff = DATA_CUTOFF, { reportFuture = false } = {}) {
  const s = normAr(text); // hamza / ta-marbuta / alef-maqsura folded, so «للشهر الماضي» and «الشهر الماضي» are read alike
  const year = Number(cutoff.slice(0, 4));
  const curMonth = Number(cutoff.slice(5, 7));
  const explicitYear = (s.match(/\b(20\d{2})\b/) || [])[1];
  const monthRange = (m) => {
    let y = explicitYear ? Number(explicitYear) : year;
    if (!explicitYear && m > curMonth) y -= 1; // a month later than the current one means the previous year's
    const to = lastDay(y, m); const from = `${y}-${String(m).padStart(2, '0')}-01`;
    if (from > cutoff) return reportFuture ? { from, to, label: `m${m}`, notStarted: true } : null;
    return { from, to: to > cutoff ? cutoff : to, label: `m${m}`, yearAssumed: !explicitYear };
  };
  const AL = '(?:ال|لل|ل|بال|ب)?'; // the article / preposition prefixes Arabic glues onto a noun
  if (new RegExp(`this month|current month|month to date|\\bmtd\\b|هذا ${AL}شهر|هالشهر|${AL}شهر (?:ال)?(?:حالي|جاري)|الشهر الحالي|الشهر الجاري`).test(s)) return { from: startOfMonth(cutoff), to: cutoff, label: 'month' };
  if (new RegExp(`last month|previous month|latest month|${AL}شهر (?:ال)?(?:ماضي|سابق|اخير)`).test(s)) { const e = prevMonthEnd(cutoff); return { from: startOfMonth(e), to: e, label: 'lastMonth' }; }
  if (/last 3 months|three months|اخر 3 اشهر|اخر ثلاثه اشهر/.test(s)) return { ...lastCompleteMonths(cutoff, 3), label: 'last3' };
  if (new RegExp(`year to date|ytd|fiscal year|this year|current year|السنه الماليه|هذا العام|هذه السنه|هالسنه|${AL}سنه (?:ال)?حاليه|${AL}عام (?:ال)?حالي|${AL}(?:سنه|عام) كامل|${AL}(?:سنه|عام) حتي اليوم|منذ بدايه (?:ال)?(?:سنه|عام)`).test(s)) return { from: startOfYear(cutoff), to: cutoff, label: 'ytd' };
  for (const [m, re] of MONTH_RES) if (re.test(s)) return monthRange(m);
  for (const [k, m] of Object.entries(AR_MONTHS)) if (s.includes(normAr(k))) return monthRange(m);
  const q = (n) => {
    const m0 = (n - 1) * 3 + 1; const y = explicitYear ? Number(explicitYear) : year; const to = lastDay(y, m0 + 2); const from = `${y}-${String(m0).padStart(2, '0')}-01`;
    if (from > cutoff) return reportFuture ? { from, to, label: `q${n}`, notStarted: true } : null; // the quarter has not started: no reversed range
    return { from, to: to > cutoff ? cutoff : to, label: `q${n}` };
  };
  if (/q1|first quarter|(?:ال|لل|ل)?ربع (?:ال)?اول/.test(s)) return q(1);
  if (/q2|second quarter|(?:ال|لل|ل)?ربع (?:ال)?ثاني/.test(s)) return q(2);
  if (/q3|third quarter|(?:ال|لل|ل)?ربع (?:ال)?ثالث/.test(s)) return q(3);
  if (/q4|fourth quarter|(?:ال|لل|ل)?ربع (?:ال)?رابع/.test(s)) return q(4);
  if (/all data|all time|since the start|كل البيانات/.test(s)) return { from: DATA_START, to: cutoff, label: 'all' };
  const numMonth = s.match(/(?:^|\s)(?:شهر|month)\s*(\d{1,2})(?!\d)/); if (numMonth && Number(numMonth[1]) >= 1 && Number(numMonth[1]) <= 12) return monthRange(Number(numMonth[1]));
  if (explicitYear) { // a bare year: the whole year up to the cut-off; before the data starts it is reported to the caller, never turned into a period
    const y = Number(explicitYear); const from = `${y}-01-01`; const to = `${y}-12-31`;
    if (to < DATA_START) return reportFuture ? { from, to, label: 'year', beforeData: true } : null;
    if (from > cutoff) return reportFuture ? { from, to, label: 'year', notStarted: true } : null;
    return { from: from < DATA_START ? DATA_START : from, to: to > cutoff ? cutoff : to, label: 'year' };
  }
  if (/(?:^|\s)(?:تقرير|ايرادات|الايرادات)?\s*اليوم(?:\s|$)|\btoday\b/.test(s) && !/(حتي|الي|until|up to|to)\s*(اليوم|today)/.test(s)) return { from: cutoff, to: cutoff, label: 'today' };
  return null;
}
// how many different months / quarters the text names (two of them in one request cannot be applied as ONE period)
export function periodMentions(text) {
  const s = normAr(text); const found = new Set();
  for (const [m, re] of MONTH_RES) if (re.test(s)) found.add(`m${m}`);
  for (const [k, m] of Object.entries(AR_MONTHS)) if (s.includes(normAr(k))) found.add(`m${m}`);
  [/q1|first quarter|(?:ال|لل|ل)?ربع (?:ال)?اول/, /q2|second quarter|(?:ال|لل|ل)?ربع (?:ال)?ثاني/, /q3|third quarter|(?:ال|لل|ل)?ربع (?:ال)?ثالث/, /q4|fourth quarter|(?:ال|لل|ل)?ربع (?:ال)?رابع/].forEach((re, i) => { if (re.test(s)) found.add(`q${i + 1}`); });
  return found.size;
}

export function parseAmanah(text) {
  const lower = text.toLowerCase();
  const hits = [];
  for (const a of amanahOptionsOf()) {
    const en = a.en.toLowerCase().replace(/ amanah$/, '');
    const ar = (a.ar || '').replace(/^أمانة\s*(منطقة\s*)?/, '').trim();
    if ((en && lower.includes(en)) || (ar && ar.length > 2 && text.includes(ar))) hits.push(a.key);
  }
  return [...new Set(hits)];
}

const SOURCE_PATTERNS = [
  ['investment', /invest|furas|lease|استثمار|فرص/],
  ['fines', /\bfines?\b|penalt|violation|غرام|مخالف|جزاء/],
  ['white_lands', /white.?land|الأراضي البيضاء|اراضي بيضاء/],
  ['tobacco', /tobacco|التبغ/],
  ['accommodation', /accommodation|إيواء|الايواء|الإيواء/],
  ['housing_sales', /housing|إسكان|الاسكان|مبيعات سكن/],
  ['municipal_fees', null], // matched on the normalised text below (not «بلديات / بلدية» = municipalities)
  ['licenses', /licen[cs]e|ترخيص|تراخيص|رخص/]
];
const MUNI_FEES = /municipal fees?|baladi|رسوم (?:ال)?بلديه|(?:^|\s)بلدي(?:\s|$)/;
// every revenue source named in the text (in table order); a request that names two cannot be applied as one filter
export function sourcesMentioned(text) {
  const s = text.toLowerCase();
  return SOURCE_PATTERNS.filter(([k, re]) => (k === 'municipal_fees' ? MUNI_FEES.test(normAr(text)) : re.test(s))).map(([k]) => k);
}
export function parseSource(text) { return sourcesMentioned(text)[0] || null; }

export function unavailableSourceMentioned(text) {
  const s = text.toLowerCase();
  if (/white.?land|الأراضي البيضاء|اراضي بيضاء/.test(s)) return UNAVAILABLE_REVENUE_SOURCES.find((x) => x.id === 'white_lands');
  if (/tobacco|التبغ/.test(s)) return UNAVAILABLE_REVENUE_SOURCES.find((x) => x.id === 'tobacco');
  if (/accommodation|إيواء|الايواء|الإيواء/.test(s)) return UNAVAILABLE_REVENUE_SOURCES.find((x) => x.id === 'accommodation');
  return null;
}

export function parseInvoiceId(text) {
  const m = text.match(/INV-\d{4}-\d{4,7}/i);
  return m ? m[0].toUpperCase() : null;
}

export function classify(text) {
  const s = text.toLowerCase();
  if (/inv-\d{4}-\d{4,7}/i.test(text)) return 'invoice';
  if (has(s, ['analyze uncollected', 'analyse uncollected', 'net uncollected', 'uncollected bridge', 'حلل غير المحصل', 'تحليل غير المحصل', 'صافي غير المحصل', 'جسر غير المحصل'])) return 'uncollected';
  if (has(s, ['why did collection', 'why has collection', 'why collection', 'collection fell', 'collection fall', 'collection drop', 'collection decline', 'collection decrease', 'لماذا انخفض', 'لماذا تراجع', 'ليه انخفض', 'انخفاض التحصيل', 'تراجع التحصيل'])) return 'why_decline';
  if (has(s, ['report', 'تقرير'])) return 'report';
  if (has(s, ['forecast', 'predict', 'projection', 'next month', 'rest of the year', 'تنبؤ', 'توقع'])) return 'forecast';
  if (has(s, ['coverage', 'target', 'budget', 'chapter', 'تغطية', 'مستهدف', 'هدف', 'ميزانية', 'الباب'])) return 'target_coverage';
  if (has(s, ['exclu', 'استبعاد', 'مستبعد'])) return 'exclusions';
  if (has(s, ['why', 'reason', 'noncollect', 'not collected', 'uncollected', 'outstanding', 'overdue', 'unpaid', 'لماذا', 'سبب', 'عدم التحصيل', 'متأخر', 'متبقي', 'غير محصل'])) return 'noncollection';
  if (has(s, ['sanad', 'efaa', 'enforcement', 'سند', 'إفاء', 'إنفاذ', 'تنفيذ'])) return 'enforcement';
  if (has(s, ['source', 'connected', 'integration', 'tahseel', 'data available', 'مصدر', 'مصادر', 'متصل', 'تكامل'])) return 'sources';
  if (has(s, ['compare', 'which amanah', 'worst', 'best', 'by amanah', 'ranking', 'قارن', 'أي أمانة', 'الأسوأ', 'الأفضل'])) return 'amanah_compare';
  if (has(s, ['collection', 'collected', 'billed', 'revenue', 'rate', 'kpi', 'performance', 'تحصيل', 'محصل', 'محصّل', 'مقبوض', 'إيراد', 'فوتر', 'معدل', 'أداء'])) return 'overview';
  return 'unknown';
}

// Returns { intent, scopePatch, notes, clarify } — never a number.
export function routeQuestion(text, { cutoff = DATA_CUTOFF } = {}) {
  const intent = classify(text);
  const period = parsePeriod(text, cutoff);
  const amanahHits = parseAmanah(text);
  const source = parseSource(text);
  const na = unavailableSourceMentioned(text);
  const invoiceId = intent === 'invoice' ? parseInvoiceId(text) : null;
  const scopePatch = {};
  if (period) { scopePatch.from = period.from; scopePatch.to = period.to; }
  if (amanahHits.length === 1) scopePatch.amanah = amanahHits[0];
  if (amanahHits.length > 1) scopePatch.amanah = amanahHits;
  if (source) scopePatch.source = source;
  const out = { intent, scopePatch, period, amanah: amanahHits, source, unavailableSource: na, invoiceId, clarify: null };

  if (intent === 'invoice' && !invoiceId) out.clarify = { kind: 'invoice_not_found' };
  if (intent === 'forecast' && (amanahHits.length || source)) out.clarify = null; // forecast can run on a narrower scope with a caveat
  return out;
}
