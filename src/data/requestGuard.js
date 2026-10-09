// Parts of a request that the report builder cannot apply. They are never dropped silently: the interpreter asks about them
// (or, for actions outside reporting, says so) before any report is generated. Patterns run on the NORMALISED text
// (lower-case, hamza/ta-marbuta/alef-maqsura folded, no diacritics, punctuation as spaces — see `norm` in reportIntents.js).
// Each item: { key, re, ar, en } — `ar`/`en` name what could not be applied.

const SUPPORTED_DIM = '(?:ال)?(?:مصدر|مصادر|امانه|امانات|شهر|اشهر|حاله|حالات|بلديه|بلديات|فتره|ربع|سنه|عام|ايراد|ايرادات|نوع الايراد|مصادر الايراد)|(?:the )?(?:revenue )?(?:sources?|amanahs?|months?|status(?:es)?|municipalit(?:y|ies)|period|quarters?|years?)';

export const UNAPPLIED = [
  { key: 'top_n', re: /(?:اكبر|اعلي|اعلى|افضل|اسوا|اقل|اصغر)\s+\d+|\b(?:top|bottom|largest|biggest|highest|lowest|best|worst)\s+\d+/g, ar: 'ترتيب أو اقتصار على «الأعلى/الأكبر n»', en: 'a top-N ranking' },
  { key: 'group_by', re: new RegExp(`(?:حسب|بحسب|\\bby\\b|\\bper\\b|broken down by|grouped by|group (?:it )?by|sort(?:ed)? by|order(?:ed)? by|مقسم[هة]? (?:حسب|على)|مصنف[هة]? حسب|مرتب[هة]? حسب|ترتيب حسب)\\s+(?!${SUPPORTED_DIM})[\\u0621-\\u064Aa-z]+`, 'g'), ar: 'تجميع أو ترتيب بحقل غير مدعوم', en: 'grouping or sorting by a field that is not supported' },
  { key: 'threshold', re: /(?:تتجاوز|يتجاوز|اكثر من|اقل من|اعلي من|اعلى من|فوق|تحت|\babove\b|\bover\b|\bbelow\b|\bunder\b|\bmore than\b|\bless than\b|\bgreater than\b|\bexceed(?:s|ing)?\b|\bat least\b|\bat most\b)\s*(?:ال)?\s*(?:\d[\d,.]*|مليون|مليار|الف|ملايين)\s*(?:الف|مليون|مليار|k|m|bn|sar|ريال)?/g, ar: 'حدّ مبلغ أو عدد', en: 'an amount or count threshold' },
  { key: 'currency', re: /(?:بال)?(?:دولار|يورو|جنيه|دينار|\busd\b|\beur\b|\bgbp\b|\bdollars?\b|\beuros?\b|\bpounds?\b)/g, ar: 'عرض المبالغ بعملة غير الريال', en: 'amounts in a currency other than SAR' },
  { key: 'entity', re: /(?:^|\s)(?:لل?|ب)?(?:دافع|دافعين|دافعي|مستثمر|مستثمرين|عميل|عملاء|موظف|موظفين|حامل|حاملي|شركه|شركات|مواطن|حي|احياء|مدين|مدينين)(?=\s|$)|\b(?:payers?|customers?|investors?|employees?|holders?|compan(?:y|ies)|districts?|neighbou?rhoods?|residents?|debtors?)\b/g, ar: 'تقرير على مستوى دافع أو جهة أو حيّ بعينه', en: 'a report about a specific payer, entity or district' },
  { key: 'exclude', re: /(?:ما عدا|باستثناء|عدا|استثني|\bexcluding\b|\bexcept\b|\bexcept for\b|\bwithout\b|\bapart from\b)\s+(?!(?:ال)?(?:مقارنه|مرشحات|فلاتر|فلتر)|comparison|filters?)[ء-يa-z]+/g, ar: 'استبعاد جهة أو بند بالاسم', en: 'excluding a named entity or item' },
  { key: 'forecast', re: /(?:توقعات?|تنبؤ\w*|متوقع\w*|\bforecasts?\b|\bprojections?\b|\bpredict\w*|\bwhat will\b|\bwill be\b)/g, ar: 'التوقّع المستقبلي (غير متاح في التقارير الذكية؛ يوجد في التخطيط)', en: 'a forecast (not available in Smart Reports; it lives in Planning)' },
  { key: 'sub_period', re: /(?<!منذ )(?<!من )(?<!since )(?<!from )(?:(?:نهايه|منتصف|اواخر|اوائل|بدايه)\s+(?:ال)?(?:عام|سنه|شهر|ربع)|\b(?:end of|middle of|mid|beginning of|start of)\s+(?:the\s+)?(?:last |this |previous )?(?:year|month|quarter))/g, ar: 'جزء من فترة (بداية/نهاية/منتصف)', en: 'part of a period (start / end / middle)' },
  { key: 'duration', re: /(?:ال)?(?:اسبوع|يوم|اسبوعين|يومين|اسابيع|ايام)\s*(?:ال)?(?:ماضيين|ماضيان|ماضيه|ماضي|اخيرين|اخيره|سابق|سابقين)|قبل\s*(?:\d+|ثلاث|اربع|خمس|ست|سبع|ثماني|تسع|عشر|[ء-ي]+)\s*(?:سنوات|اعوام|سنه|عام|شهور|اشهر|اسابيع|ايام|اسبوعين|شهرين|سنتين|عامين)|\b(?:\d+|two|three|four|five|six|several|a few)\s+(?:years?|months?|weeks?|days?)\s+ago\b|\b(?:last|past|previous)\s+(?:\d+|two|three|four|few)?\s*(?:weeks?|days?)\b/g, ar: 'فترة نسبية غير مدعومة (أسابيع/أيام/سنوات سابقة)', en: 'a relative period that is not supported (weeks, days, years ago)' },
  { key: 'weekday', re: /(?:^|\s)(?:يوم\s+)?(?:ال)?(?:احد|اثنين|ثلاثاء|اربعاء|خميس|جمعه|سبت)(?=\s|$)|\b(?:on\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\b/g, ar: 'يوم محدد من الأسبوع (التقارير على مستوى الفترة لا اليوم)', en: 'a specific weekday (reports work on periods, not weekdays)' },
  { key: 'action', re: /(?:^|\s)(?:ارسل|ارسال|ترسل|ابعث|بالبريد|بالايميل)(?=\s|$)|\b(?:send|email|e-mail|mail|translate|schedule|print|share)\b|(?:^|\s)(?:ترجم|ترجمه|جدول|جدوله|اطبع|شارك|احفظ)(?=\s|$)|(?:كل|every)\s+(?:اسبوع|شهر|يوم|week|month|day)\b/g, ar: 'إجراء خارج إعداد التقارير (إرسال، ترجمة، جدولة، طباعة)', en: 'an action outside report building (send, translate, schedule, print)', action: true }
];

// → [{ key, ar, en, span, action }] — every unsupported part found in the normalised text
export function findUnapplied(s) {
  const hits = [];
  for (const u of UNAPPLIED) { u.re.lastIndex = 0; let m; while ((m = u.re.exec(s)) !== null) { hits.push({ key: u.key, ar: u.ar, en: u.en, span: m[0].trim(), index: m.index, action: !!u.action }); if (m[0].length === 0) u.re.lastIndex += 1; } }
  return hits;
}
// the request WITHOUT the parts that cannot be applied, taken from the user's own words (not the normalised copy) and tidied of dangling prepositions
const DANGLING = new Set(['ل', 'ب', 'و', 'في', 'عن', 'على', 'مع', 'for', 'of', 'by', 'in', 'on', 'with', 'than', 'to', 'and', 'or']);
export function stripUnapplied(raw, hits, norm) {
  const drop = new Set(hits.flatMap((h) => h.span.split(/\s+/)).filter(Boolean));
  const words = String(raw).split(/\s+/).filter((w) => { const n = norm(w); return !(drop.has(n) || drop.has(n.replace(/^(?:لل|[لبوف])/, '')) || drop.has(`ال${n.replace(/^(?:لل|[لبوف])/, '')}`)); });
  while (words.length && DANGLING.has(norm(words[words.length - 1]))) words.pop();
  const out = []; words.forEach((w, i) => { const n = norm(w); if (DANGLING.has(n) && n.length <= 2 && DANGLING.has(norm(words[i + 1] ?? 'x'))) return; if (n.length === 1 && n !== 'و') return; out.push(w); });
  return out.join(' ').trim();
}
