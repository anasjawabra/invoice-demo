// The conversation layer in FRONT of the report interpreter (reportIntents.interpret). It recognises what a person says ABOUT THE LAST RESULT —
// «change the chart», «show only the table», «turn this into a presentation», «compare by municipality», «summarise» — and about attached files.
// Everything else (a new report, a period, an Amanah, a source…) is left to interpret(), unchanged.
// Like interpret() it is RULE-BASED (keywords in Arabic and English), not a language model, and it never guesses: when the request needs a
// result that does not exist yet it says so and offers what can be done.
//
// interpretChat(text, ctx) → null (not mine) | one of
//   { type:'attach' , groupTerm }                    files are attached: read, match with the system, answer
//   { type:'chart'  , kind }                         change the chart type of the latest result
//   { type:'only'   , only }                         show only tables / charts / indicators
//   { type:'export' , format }                       produce a file of the latest result
//   { type:'regroup', term }                         the latest result is an attachment analysis: group by another column
//   { type:'section', text }                         the latest result is a system report: add the section (rewritten sentence for interpret())
//   { type:'summary' }                               a short written summary of the latest result
//   { type:'need'   , question, options }            the request needs a result / chart that does not exist: say so
export const norm = (t) => String(t || '').toLowerCase().replace(/[ً-ٰٟ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ـ/g, '').replace(/[؟?!.,،؛:]/g, ' ').replace(/\s+/g, ' ').trim();
const has = (s, re) => re.test(s);

const FORMATS = [
  ['pptx', /(?:^|\s)(?:powerpoint|power point|pptx?|presentation|slides?|deck|عرض تقديمي|عرض|شرايح|شرائح|بوربوينت|باوربوينت|سلايدات?)(?=\s|$)/],
  ['docx', /(?:^|\s)(?:word|docx|doc|وورد|ورد|مستند|document)(?=\s|$)/],
  ['pdf', /(?:^|\s)(?:pdf|بي دي اف|بيدياف)(?=\s|$)/],
  ['xlsx', /(?:^|\s)(?:excel|xlsx|اكسل|اكسيل|spreadsheet)(?=\s|$)/],
  ['csv', /(?:^|\s)(?:csv|سي اس في)(?=\s|$)/]
];
export const FORMAT_NAME = { pptx: { ar: 'عرض تقديمي PowerPoint', en: 'PowerPoint presentation' }, docx: { ar: 'مستند Word', en: 'Word document' }, pdf: { ar: 'ملف PDF', en: 'PDF file' }, xlsx: { ar: 'جدول Excel', en: 'Excel workbook' }, csv: { ar: 'ملف CSV', en: 'CSV file' } };
const EXPORT_VERB = /(?:^|\s)(?:(?:حول|صدر|نزل|حمل|جهز|اعمل|اطبع|احفظ|ارسل)(?:ه|ها|لي)?|اعطني|اعطيني|اريد|ابغي|ابغى|ابي|turn|convert|export|download|give me|save|generate|make|create|prepare|put|print|as an?|into|to a|in)(?=\s|$)/;
const FILLER = new Set(('هذا هذه هذي ذلك النتيجه النتايج النتائج التقرير تقرير الملف ملف ملفا في الى الي الي إلى على ك ب ل و او ثم لي لنا it this that the report result results to as into a an file in of for me please من هذا ما سبق السابق الاخير الاخيره الحالي الحاليه كل').split(/\s+/));
const residue = (s, extra = []) => s.split(' ').filter((w) => w && !FILLER.has(w) && !extra.includes(w) && !EXPORT_VERB.test(w) && !FORMATS.some(([, re]) => re.test(` ${w} `)));

const CHART_NOUN = /(?:^|\s)(?:[كبل]|بال|كال)?(?:ال)?(?:رسم|رسوم|شارت|مخطط|مخططات)(?:\s+البياني)?(?=\s|$)|(?:^|\s)(?:charts?|graphs?|plot|visuali[sz]ation)(?=\s|$)/;
const CHART_KIND = [
  ['pie', /(?:^|\s)(?:دائري|دايري|دائره|فطيره|فطيرة|pie|donut|doughnut)(?=\s|$)/],
  ['line', /(?:^|\s)(?:خطي|خط|خطيه|line|lines|trend line)(?=\s|$)/],
  ['hbar', /(?:^|\s)(?:افقي[هة]?|horizontal)(?=\s|$)/],
  ['bar', /(?:^|\s)(?:اعمده|عمودي|اعمدة|اعمدته|bar|bars|column|columns)(?=\s|$)/]
];
export const CHART_NAME = { bar: { ar: 'أعمدة', en: 'bar' }, hbar: { ar: 'أعمدة أفقية', en: 'horizontal bar' }, line: { ar: 'خطي', en: 'line' }, pie: { ar: 'دائري', en: 'pie' } };

const DIMS = [
  ['municipality', /(?:ال)?بلديه|البلديات|municipalit(?:y|ies)/, { ar: 'حسب البلدية', en: 'by municipality' }],
  ['amanah', /(?:ال)?امانه|الامانات|امانات|جهه|الجهات|amanahs?|entity|entities/, { ar: 'حسب الأمانة', en: 'by Amanah' }],
  ['source', /(?:ال)?مصدر|المصادر|مصادر|source|sources/, { ar: 'حسب مصدر الإيراد', en: 'by revenue source' }],
  ['month', /(?:ال)?شهر|الاشهر|اشهر|شهريا|month|months|monthly/, { ar: 'الاتجاه الشهري', en: 'monthly trend' }],
  ['status', /(?:ال)?حال[هة]|الحالات|status/, { ar: 'حسب حالة الدفع', en: 'by payment status' }]
];
const BY = /(?:^|\s)(?:حسب|بحسب|على اساس|لكل|بين|عبر|by|per|across|group(?:ed)? by|break ?down by|compare by|split by)(?=\s|$)/;
const dimRewrite = { municipality: 'قارن حسب البلدية', amanah: 'قارن حسب الامانة', source: 'حسب مصدر الايراد', month: 'الاتجاه الشهري', status: 'حسب حالة الدفع' };

const need = (ar, en, options = []) => ({ type: 'need', question: { ar, en }, options });
const NO_RESULT = (what) => need(`لا توجد نتيجة بعد لأ${what.ar}. اطلب تقريراً من بيانات النظام أو أرفق ملفاً أولاً.`, `There is no result yet to ${what.en}. Ask for a report from the system data or attach a file first.`, [
  { label: { ar: 'تقرير الإيرادات هذا الشهر', en: 'This month’s revenue report' }, text: 'أنشئ تقرير الإيرادات لهذا الشهر حتى اليوم' }, { label: { ar: 'مقارنة الأمانات', en: 'Compare Amanahs' }, text: 'قارن أداء التحصيل بين الأمانات' }]);

// ctx: { hasResult, resultKind: 'report' | 'attachments' | null, hasCharts, hasTables, pendingFiles: n }
export function interpretChat(text, ctx = {}) {
  const raw = String(text || ''); const s = norm(raw); const tokens = s ? s.split(' ') : [];
  const groupTermOf = () => { for (const [k, re] of DIMS) if (BY.test(s) && re.test(s)) return k === 'municipality' ? 'بلدية' : k === 'amanah' ? 'امانة' : k === 'source' ? 'مصدر' : k === 'month' ? 'شهر' : 'حالة'; return null; };

  // ---- files attached to this message: the request is about them (the text, if any, steers the grouping)
  if (ctx.pendingFiles > 0) return { type: 'attach', groupTerm: groupTermOf() };

  if (!s) return null;

  // ---- ask for a file of the latest result
  const fmt = FORMATS.find(([, re]) => re.test(` ${s} `));
  if (fmt && has(s, EXPORT_VERB) && residue(s).length <= 2 && !CHART_NOUN.test(s)) {
    if (!ctx.hasResult) return NO_RESULT({ ar: 'حوّلها إلى ملف', en: 'turn into a file' });
    return { type: 'export', format: fmt[0] };
  }

  // ---- change the chart
  const ONLYW = /(?:^|\s)(?:فقط|بس|only|just)(?=\s|$)/;
  if (CHART_NOUN.test(s) && tokens.length <= 12 && !ONLYW.test(s)) {
    const kind = CHART_KIND.find(([, re]) => re.test(s));
    const verbish = /(?:غير|بدل|حول|اجعل|خلي|اعرض|اظهر|ورني|show|change|switch|make|turn|use|convert|as|to|الى|الي|ك)(?=\s|$)/.test(s) || /^(?:ك|بشكل)/.test(s);
    if (kind && (verbish || tokens.length <= 4)) {
      if (!ctx.hasResult) return NO_RESULT({ ar: 'غيّر رسمها', en: 'change the chart of' });
      if (!ctx.hasCharts) return need('النتيجة الحالية لا تحتوي رسماً بيانياً لأغيّره. يمكنني إضافة قسم يحتوي رسماً.', 'The current result has no chart to change. I can add a section that has one.', [{ label: { ar: 'أضف الاتجاه الشهري', en: 'Add the monthly trend' }, text: 'أضف الاتجاه الشهري' }, { label: { ar: 'أضف مقارنة الأمانات', en: 'Add the Amanah comparison' }, text: 'أضف مقارنة الأمانات' }]);
      return { type: 'chart', kind: kind[0] };
    }
    if (!kind && /(?:غير|بدل|حول|اجعل|خلي|change|switch|make|turn|convert)/.test(s)) return need('أي نوع رسم تريد؟', 'Which chart type do you want?', [{ label: { ar: 'أعمدة', en: 'Bars' }, text: 'غيّر الرسم إلى أعمدة' }, { label: { ar: 'خطي', en: 'Line' }, text: 'غيّر الرسم إلى خطي' }, { label: { ar: 'دائري', en: 'Pie' }, text: 'غيّر الرسم إلى دائري' }]);
  }

  // ---- only the table / only the charts / only the indicators
  const onlyWord = has(s, /(?:^|\s)(?:[كب]?(?:ال)?(?:جدول|جداول)|tables?)(?=\s|$)/) ? 'tables' : has(s, /(?:^|\s)(?:الرسوم|الرسم|رسوم|مخططات|charts?|graphs?)(?=\s|$)/) ? 'charts' : has(s, /(?:^|\s)(?:المؤشرات|مؤشرات|kpis?|indicators|المقاييس|بطاقات)(?=\s|$)/) ? 'kpis' : null;
  if (onlyWord && tokens.length <= 7 && (has(s, /(?:^|\s)(?:فقط|بس|only|just)(?=\s|$)/) || has(s, /^(?:اعرض|اظهر|ورني|وريني|show|display|present|حول|حوله|ك|كجدول|as)/) || /^(?:كجدول|بجدول|بشكل جدول)/.test(s)) && !has(s, /(?:تقرير|report|امانه|مصدر|شهر|ايراد|تحصيل)/)) {
    if (!ctx.hasResult) return NO_RESULT({ ar: 'أعرضها', en: 'show' });
    return { type: 'only', only: onlyWord };
  }
  if (has(s, /(?:^|\s)(?:اعرض|اظهر|show|display)\s*(?:كل شيء|الكل|everything|all|full)(?=\s|$)/) && ctx.hasResult && tokens.length <= 5) return { type: 'only', only: 'all' };

  // ---- summarise the latest result in words
  if (tokens.length <= 6 && has(s, /(?:^|\s)(?:لخص|لخصها|لخصه|لخص لي|اختصر|summari[sz]e|tl dr|tldr|sum up|in a nutshell|explain this|اشرح|اشرحها|اشرح لي)(?=\s|$)/)) {
    if (!ctx.hasResult) return NO_RESULT({ ar: 'ألخّصها', en: 'summarise' });
    return { type: 'summary' };
  }

  // ---- regroup / compare by another dimension
  if (BY.test(s) && tokens.length <= 9) {
    const dim = DIMS.find(([, re]) => re.test(s));
    if (dim && ctx.hasResult && !has(s, /(?:تقرير|report)/) && !has(s, /(?:\b20\d{2}\b|يناير|فبراير|مارس|ابريل|مايو|يونيو|يوليو|اغسطس|سبتمبر|اكتوبر|نوفمبر|ديسمبر)/)) {
      if (ctx.resultKind === 'attachments') return { type: 'regroup', term: groupTermOf() };
      return { type: 'section', dim: dim[0], text: dimRewrite[dim[0]] };
    }
  }
  return null;
}
