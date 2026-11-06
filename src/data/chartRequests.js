// Conversational chart requests — PURE (no React). docs/chart-library.md «Conversational chart requests».
// Reads a typed request about the charts of the CURRENT result («اعرضها كأعمدة», “Show this as a donut chart.”, «اعرض توزيع غير المحصل حسب البلديات»,
// «اخف القيم», “top 5 with Other”, «ارجع للرسم الموصى به», …), finds WHICH chart it is about and returns what to do. Like the rest of the chat layer it is RULE-BASED
// (keywords, Arabic + English, spelling variants), not a language model, and it never guesses between charts: several plausible charts → a question, nothing fits → the reason.
//
//   interpretChartRequest(q, { model, view, lang, base? }) → null                                                         not a chart request: let the other interpreters run
//     | { type:'apply', chartId, chartTitle, patch, kind, note:{ar,en}, changes:[{key,ar,en}], ignored?, noop?, reset? }       one chart, ready to apply (viewAfterRequest)
//     | { type:'ask', question:{ar,en}, options:[{label:{ar,en}, text}] }                                                      several charts fit: one option per chart, `text` re-sendable
//     | { type:'unsuitable', reason:{ar,en}, alternatives:[{typeId, label:{ar,en}, text}] }                                    the data does not fit (reason from evaluateChart), ≤ 4 ready alternatives
//     | { type:'need', question:{ar,en} }                                                                                     nothing to act on (no chart, no such chart, nothing to reset)
//   viewAfterRequest(view, result, model) → the new view (setChartConfig / resetChart); the same view for every other result type
//
// `model` = the result as displayed (lr.model) or the saved model; `base` (optional) = the SAVED model, when the caller has it: with it the new config is evaluated on the saved block
// (exact, including what an earlier request already changed); without it the request is evaluated on the displayed block.
// Titles of the report are DATA: they are only compared with the words of the request (never read as instructions).
import { normText } from './textNorm';
import { resolveEntities } from './requestEntities';
import { assignChartIds, chartBlocks } from './chartIds';
import { CHART_TYPES, typeById, typeIdOf, evaluateChart, chartOptions, recommendedKind, patchConfig, normalizeConfig, chartDimensions } from './chartCatalog';
import { resolveType, DIMENSION_NEEDS } from './chartConfig';
import { setChartConfig, resetChart, chartConfigOf } from './reportView';

const T = (ar, en) => ({ ar, en });
const AR_RE = /[؀-ۿ]/;

/* ------------------------------------------------------------------ text: one fold for patterns and titles */
// normText + hamza seats, ظ → ض, doubled letters collapsed (never digits): «waterfall» = «waterfal», «Histogrm»-style typos of the doubled kind, «دائري» = «دايري»
export function fold(t) {
  let s = normText(String(t ?? '').replace(/٪/g, '%')).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’`ʿʾ‘]/g, '');
  s = s.replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ء/g, '').replace(/ظ/g, 'ض').replace(/[-_]/g, ' ').replace(/["“”«»„]/g, ' ').replace(/\s+/g, ' ').trim();
  return s.replace(/([^\d\s])\1+/g, '$1');
}
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const alt = (list) => list.map((p) => fold(p).split(' ').map(esc).join('\\s+')).join('|');
const PRE = '[وف]?(?:[بكل]?(?:ال)?|لل)'; // glued Arabic clitics: و ف · ب ك ل · ال · لل
const rxOf = (list, flags = 'g') => new RegExp(`(?:^|\\s)(${PRE})(${alt(list)})(?=\\s|$)`, flags);
const rxRaw = (src, flags = 'g') => new RegExp(src, flags);
function find(s, list) { // → [{pos, end, glued, pre, text}] — every whole-word occurrence, with the clitic glued to it
  const re = rxOf(list); const out = []; let m;
  while ((m = re.exec(s))) { const lead = m[0][0] === ' ' ? 1 : 0; out.push({ pos: m.index + lead, end: m.index + m[0].length, pre: m[1] || '', glued: /[بك]/.test(m[1] || ''), text: m[2] }); if (!m[0].length) re.lastIndex += 1; }
  return out;
}
const blank = (s, a, b) => `${s.slice(0, a)}${' '.repeat(Math.max(0, b - a))}${s.slice(b)}`;
const tokIndex = (s, pos) => (pos <= 0 ? 0 : s.slice(0, pos).trim().split(' ').filter(Boolean).length);

/* ------------------------------------------------------------------ lexicon */
const CH_SING = ['رسم', 'مخطط', 'شارت', 'شكل', 'chart', 'graph', 'plot', 'visual', 'visualization', 'figure', 'diagram'];
const CH_PLUR = ['رسوم', 'رسومات', 'مخططات', 'شارتات', 'اشكال', 'charts', 'graphs', 'plots', 'visuals', 'visualizations', 'figures', 'diagrams'];
const GLOBAL_Q = ['كل', 'جميع', 'كافه', 'all', 'every', 'each'];

const TYPE_LIST = [ // priority order (specific first); `id` is the catalog type id
  ['sunburst', ['سنبرست', 'سن برست', 'شمسي', 'شمسيه', 'شمس', 'sunburst', 'sunbursts', 'sun burst']],
  ['treemap', ['خريطه شجريه', 'شجري', 'شجريه', 'تري ماب', 'تريماب', 'treemap', 'treemaps', 'tree map', 'tree maps']],
  ['heatmap', ['خريطه حراريه', 'حراري', 'حراريه', 'heat map', 'heat maps', 'heatmap', 'heatmaps']],
  ['sankey', ['سانكي', 'ساكي', 'سنكي', 'sankey', 'sanky', 'تدفق', 'تدفقات', 'تدفقي', 'flow diagram', 'flow chart']],
  ['waterfall', ['شلال', 'شلالي', 'waterfall', 'waterfalls', 'water fall', 'جسر', 'جسري', 'bridge chart']],
  ['bubble', ['فقاعات', 'فقاعي', 'فقاعيه', 'فقاعه', 'bubble', 'bubbles']],
  ['histogram', ['مدرج تكراري', 'مدرج', 'هيستوغرام', 'هيستوجرام', 'هستوغرام', 'histogram', 'histograms', 'توزيع تكراري', 'frequency distribution']],
  ['box', ['صندوقي', 'صندوقيه', 'مخطط الصندوق', 'رسم الصندوق', 'box plot', 'boxplot', 'box plots', 'box and whisker', 'box whisker', 'box chart']],
  ['pareto', ['باريتو', 'باريطو', 'pareto']],
  ['bullet', ['رصاصه', 'رصاصي', 'رصاصيه', 'رصاص', 'bullet', 'bullet chart', 'تقدم مقابل المستهدف', 'الفعلي مقابل المستهدف', 'progress against target', 'progress vs target', 'actual vs target']],
  ['scatter', ['تشتت', 'تشتتي', 'مبعثر', 'تبعثر', 'scatter', 'scatterplot', 'scatter plot', 'xy plot', 'نقطي', 'نقاط', 'رسم النقاط', 'نقاط متفرقه']],
  ['combo', ['مركب', 'مركبه', 'combo', 'combination', 'combined']],
  ['area', ['مساحي', 'مساحيه', 'مساحه', 'area', 'areas']],
  ['line', ['خطي', 'خطيه', 'خط', 'line', 'lines', 'trend line']],
  ['donut', ['حلقي', 'حلقيه', 'حلقه', 'دونات', 'دونت', 'دوناتس', 'donut', 'donuts', 'doughnut', 'doughnuts']],
  ['pie', ['دائري', 'دايري', 'دائره', 'دايره', 'دائريه', 'فطيره', 'pie', 'pies']]
];
const COLS = ['اعمده', 'عمود', 'column', 'columns'];
const BARS = ['bar', 'bars', 'bar chart', 'bar graph'];
const HBARS = ['اشرطه افقيه', 'اشرطه', 'شريطي', 'شريطيه', 'شريط', 'horizontal bar', 'horizontal bars', 'hbar'];
const STACKED = ['مكدس', 'مكدسه', 'مكدسين', 'stacked', 'stack', 'stacking'];
const GROUPED = ['مجمع', 'مجمعه', 'متجاور', 'متجاوره', 'جنبا الي جنب', 'grouped', 'clustered', 'cluster', 'side by side'];
const ORI_H = ['افقي', 'افقيه', 'افقيا', 'horizontal', 'horizontally', 'sideways'];
const ORI_V = ['عمودي', 'عموديه', 'عموديا', 'vertical', 'vertically', 'upright'];
const MARKERS = ['markers', 'marker', 'points', 'dots', 'بنقاط', 'نقاط', 'بعلامات', 'علامات', 'بدوائر', 'دوائر'];
const MARKER_ALONE = ['markers', 'marker', 'بعلامات'];
const SEP = ['الي', 'to', 'into', 'as', 'using', 'على شكل', 'بشكل', 'in the form of', 'in form of', 'like', 'with a']; // words that introduce the target form

const MODE_SHARE = ['كنسبه', 'كنسب', 'بنسبه', 'بنسب', 'بالنسبه', 'نسبه مئويه', 'نسب مئويه', 'بالنسبه المئويه', 'كنسبه مئويه', 'نسبي', 'كحصه', 'كحصص', 'بحصص', 'حصه من الاجمالي', 'حصص', 'بالمئه', 'نسبه من', 'percent', 'percentage', 'percentages', 'as percent', 'as a percentage', 'share', 'shares', 'as share', 'as a share', 'proportion', 'proportions', 'as %', 'in %', 'in percent', '% share'];
const MODE_AMOUNT = ['بالمبلغ', 'بالمبالغ', 'كمبلغ', 'كمبالغ', 'بالقيم المطلقه', 'as amount', 'as amounts', 'in amounts', 'actual amounts', 'absolute', 'in sar', 'in riyals', 'not percent', 'not percentage', 'instead of percent', 'بدل النسبه', 'بدلا من النسبه', 'وليس نسبه'];
const NOT_MODE = ['نسبه التحصيل', 'نسبه المحصل', 'معدل التحصيل', 'collection rate', 'collection ratio', 'rate of collection'];
const CUM_TRUE = ['تراكمي', 'تراكميا', 'تراكميه', 'cumulative', 'cumulatively', 'running total', 'running totals'];
const CUM_FALSE = ['غير تراكمي', 'ليس تراكمي', 'وليس تراكمي', 'بدل التراكمي', 'بدلا من التراكمي', 'بدل تراكمي', 'not cumulative', 'non cumulative', 'noncumulative', 'instead of cumulative', 'rather than cumulative', 'شهريا', 'بشكل شهري', 'monthly values', 'القيم الشهريه', 'month by month', 'per month'];
const SORT_DESC = ['تنازلي', 'تنازليا', 'الاكبر اولا', 'الاعلي اولا', 'من الاكبر', 'من الاعلي', 'descending', 'desc', 'largest first', 'biggest first', 'highest first', 'high to low', 'largest to smallest', 'from largest', 'from the largest', 'from highest', 'highest to lowest'];
const SORT_ASC = ['تصاعدي', 'تصاعديا', 'الاصغر اولا', 'الاقل اولا', 'من الاصغر', 'من الاقل', 'ascending', 'asc', 'smallest first', 'lowest first', 'low to high', 'smallest to largest', 'from smallest', 'from the smallest', 'lowest to highest'];
const SORT_LABEL = ['ابجدي', 'ابجديا', 'الترتيب الابجدي', 'alphabetical', 'alphabetically', 'a to z', 'by name', 'حسب الاسم', 'بالاسم', 'name order'];
const SORT_VERB = ['رتب', 'رتبه', 'رتبها', 'ترتيب', 'مرتب', 'مرتبه', 'sort', 'sorted', 'order', 'ordered', 'rank', 'ranked', 'ranking'];
const TOP_WORDS = ['اعلي', 'افضل', 'اكبر', 'اول', 'اكثر', 'top', 'first', 'largest', 'biggest', 'highest', 'best', 'leading'];
const NUM_WORDS = { واحد: 1, اثنين: 2, اثنان: 2, ثلاثه: 3, ثلاث: 3, اربعه: 4, اربع: 4, خمسه: 5, خمس: 5, سته: 6, ست: 6, سبعه: 7, سبع: 7, ثمانيه: 8, ثمان: 8, تسعه: 9, تسع: 9, عشره: 10, عشر: 10, عشرين: 20, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15, twenty: 20 };
const HIDE_V = ['اخف', 'اخفي', 'اخفاء', 'ازل', 'ازاله', 'احذف', 'احذفي', 'الغ', 'الغاء', 'شيل', 'شيلي', 'امسح', 'اطفئ', 'hide', 'remove', 'drop', 'delete', 'turn off', 'disable', 'without', 'no', 'بدون', 'من غير', 'بلا', 'ما ابي', 'مو لازم'];
const SHOW_V = ['اظهر', 'اظهري', 'اعرض', 'اضف', 'ابرز', 'فعل', 'show', 'display', 'add', 'turn on', 'enable', 'with', 'مع', 'include', 'ضع', 'وضح'];
const LABEL_N = ['القيم', 'قيم', 'الارقام', 'ارقام', 'الاعداد', 'التسميات', 'التسميه', 'تسميات', 'عناوين البيانات', 'الملصقات', 'ملصقات', 'labels', 'label', 'values', 'value labels', 'data labels', 'numbers'];
const LEGEND_N = ['المفتاح', 'مفتاح', 'دليل', 'مفتاح الرسم', 'دليل الرسم', 'الدليل', 'وسيله الايضاح', 'الاسطوره', 'legend', 'the key', 'key'];
const REC_W = ['الموصي به', 'الموصي', 'الموصيه', 'الانسب', 'الافضل', 'recommended', 'suggested', 'best fit'];
const RESET_V = ['اعد', 'ارجع', 'رجع', 'ارجعه', 'ارجعها', 'اعده', 'اعدها', 'استرجع', 'استعد', 'reset', 'restore', 'revert', 'undo', 'go back', 'back to'];
const RESET_N = ['الاصلي', 'الاصل', 'الافتراضي', 'الافتراضيه', 'الاولي', 'default', 'original', 'initial', 'as before', 'كما كان', 'اصله', 'اصلها', 'الحاله الاصليه', 'الشكل الاصلي'];
const COMPARE_W = ['مقارنه', 'قارن', 'قارني', 'compare', 'comparison', 'comparing', 'versus', 'vs', 'against', 'مقابل'];
const DIST_W = ['توزيع', 'توزع', 'يتوزع', 'distribution', 'distributed', 'breakdown', 'split', 'composition', 'مساهمه', 'contribution', 'share of', 'تفصيل', 'تقسيم'];
const BY_W = ['حسب', 'بحسب', 'على حسب', 'لكل', 'عبر', 'by', 'per', 'across', 'grouped by', 'group by', 'broken down by', 'break down by', 'split by', 'compared by', 'compare by', 'for each', 'in each', 'among', 'over', 'على'];
const FORMAT_RE = rxRaw(`(?:^|\\s)(?:powerpoint|pptx?|presentation|slides?|deck|pdf|docx?|word|excel|xlsx|csv|spreadsheet|${alt(['بوربوينت', 'باوربوينت', 'عرض تقديمي', 'شرايح', 'شرائح', 'اكسل', 'اكسيل', 'وورد', 'ورد', 'بي دي اف', 'سلايدات'])})(?=\\s|$)`, '');
const TABLE_RE = rxOf(['جدول', 'جداول', 'table', 'tables', 'tabular'], '');
const REPORT_RE = rxOf(['تقرير', 'تقارير', 'report', 'reports', 'ملخص', 'summary'], '');
const PERIOD_RE = rxRaw(`(?:\\b20\\d\\d\\b|(?:^|\\s)(?:${alt(['يناير', 'فبراير', 'مارس', 'ابريل', 'مايو', 'يونيو', 'يوليو', 'اغسطس', 'سبتمبر', 'اكتوبر', 'نوفمبر', 'ديسمبر', 'january', 'february', 'march', 'april', 'june', 'july', 'august', 'september', 'october', 'november', 'december', 'الشهر الماضي', 'هذا الشهر', 'الشهر الحالي', 'الشهر السابق', 'هذه السنه', 'السنه الماضيه', 'العام الماضي', 'هذا العام', 'الربع', 'اخر اسبوع', 'اليوم', 'امس', 'last month', 'this month', 'previous month', 'current month', 'this year', 'last year', 'quarter', 'today', 'yesterday', 'ytd', 'year to date'])})(?=\\s|$))`, '');
const QUESTION_RE = rxRaw(`^(?:${alt(['ما هو', 'ما هي', 'ماهو', 'ماهي', 'ما الفرق', 'الفرق بين', 'ايش الفرق', 'وش الفرق', 'difference between', 'ماذا', 'لماذا', 'كيف', 'متي', 'من هو', 'what is', 'what are', 'what does', 'why', 'how does', 'how do', 'who', 'explain', 'اشرح', 'define'])})(?=\\s|$)`, '');

// the dimensions of a breakdown (current `dim.dimension` of a chart, or an `alts` it holds) and the topic words that name a chart by its subject
const DIM_LIST = [
  ['municipality', ['بلديه', 'بلديات', 'municipality', 'municipalities', 'municipal']],
  ['amanah', ['امانه', 'امانات', 'amanah', 'amanahs', 'amanat', 'amana']],
  ['source', ['مصدر', 'مصادر', 'مصدر الايراد', 'مصادر الايراد', 'source', 'sources', 'revenue source', 'revenue sources']],
  ['product', ['منتج', 'منتجات', 'product', 'products']],
  ['aging', ['عمر', 'اعمار', 'تقادم', 'aging', 'ageing', 'age', 'ages', 'بعد الاستحقاق', 'past due age']],
  ['reason', ['سبب', 'اسباب', 'reason', 'reasons']],
  ['month', ['شهري', 'شهريه', 'شهور', 'اشهر', 'monthly', 'months']]
];
const MONTH_BY = ['شهر', 'month', 'months', 'monthly', 'شهور', 'اشهر']; // after «حسب / by» the plain word counts as well
const TOPIC_EXTRA = [ // topics that are not a breakdown dimension
  ['exclusions', ['استبعاد', 'استبعادات', 'exclusion', 'exclusions', 'excluded']],
  ['cumulative', ['تراكمي', 'cumulative']]
];
const MEASURES = [ // request words → the measure keys of dim.measures they name (the unpaid part is written first so «غير المحصل» is not read as «المحصل»)
  ['uncollected', ['غير المحصل', 'غير محصل', 'غير المسدد', 'غير مسدد', 'غير المدفوع', 'غير المحصله', 'المتبقي', 'uncollected', 'unpaid', 'outstanding', 'not collected', 'remaining balance'], ['uncollected', 'overdue', 'notDue', 'dueUnknown']],
  ['overdue', ['المتاخر', 'المتاخرات', 'متاخر', 'متاخرات', 'overdue', 'past due', 'late'], ['overdue', 'uncollected']],
  ['rate', ['نسبه التحصيل', 'معدل التحصيل', 'collection rate', 'collection ratio'], ['rate']],
  ['excluded', ['المستبعد', 'الاستبعادات', 'exclusions', 'excluded amount'], ['excluded']],
  ['net', ['صافي المفوتر', 'صافي', 'المفوتر', 'net billed', 'net', 'billed'], ['net']],
  ['collected', ['المحصل', 'محصل', 'collected', 'received'], ['collected', 'received']]
];

/* ------------------------------------------------------------------ the type names and the phrases that ask for them (a phrase parses back to its type: tested) */
const PHRASE = { // [ar, en]
  bar: ['كأعمدة', 'as a column chart'], hbar: ['كأشرطة أفقية', 'as a horizontal bar chart'], stacked_col: ['كأعمدة مكدسة', 'as a stacked column chart'], stacked_hbar: ['كأشرطة أفقية مكدسة', 'as a stacked horizontal bar chart'],
  stacked100_col: ['كأعمدة مكدسة 100%', 'as a 100 % stacked column chart'], stacked100_hbar: ['كأشرطة أفقية مكدسة 100%', 'as a 100 % stacked horizontal bar chart'],
  line: ['كرسم خطي', 'as a line chart'], line_markers: ['كرسم خطي بعلامات', 'as a line chart with markers'], area: ['كرسم مساحي', 'as an area chart'], stacked_area: ['كرسم مساحي مكدس', 'as a stacked area chart'],
  combo: ['كأعمدة وخط', 'as columns and a line'], waterfall: ['كرسم شلال', 'as a waterfall chart'], pie: ['كرسم دائري', 'as a pie chart'], donut: ['كرسم حلقي', 'as a donut chart'],
  treemap: ['كخريطة شجرية', 'as a treemap'], sunburst: ['كرسم شمسي', 'as a sunburst chart'], heatmap: ['كخريطة حرارية', 'as a heat map'], scatter: ['كرسم تشتت', 'as a scatter plot'],
  bubble: ['كرسم فقاعات', 'as a bubble chart'], histogram: ['كمدرج تكراري', 'as a histogram'], box: ['كرسم صندوقي', 'as a box plot'], pareto: ['كرسم باريتو', 'as a Pareto chart'],
  bullet: ['كرسم رصاصة', 'as a bullet chart'], sankey: ['كرسم سانكي', 'as a Sankey chart']
};
const DIM_PHRASE = { municipality: ['البلديات', 'municipality'], amanah: ['الأمانات', 'Amanah'], source: ['مصادر الإيراد', 'revenue source'], product: ['المنتجات', 'product'], aging: ['العمر', 'age'], reason: ['الأسباب', 'reason'], month: ['الشهر', 'month'] };
const DIM_NAME = { municipality: T('البلدية', 'municipality'), amanah: T('الأمانة', 'Amanah'), source: T('مصدر الإيراد', 'revenue source'), product: T('المنتج', 'product'), aging: T('العمر', 'age'), reason: T('السبب', 'reason'), month: T('الشهر', 'month') };

const BARFAM = new Set(['bar', 'hbar', 'stacked_col', 'stacked_hbar', 'stacked100_col', 'stacked100_hbar']);
const COMPOSITION = new Set(['pie', 'donut', 'treemap', 'sunburst', 'sankey', 'pareto', 'waterfall', 'heatmap', 'histogram', 'box', 'scatter', 'bubble', 'bullet']);
const NO_DIM_PATCH = new Set(['histogram', 'box', 'scatter', 'bubble', 'bullet', 'sankey', 'heatmap', 'waterfall']);
const GROUPS = [['line', 'line_markers'], ['area', 'stacked_area'], ['bar', 'stacked_col', 'stacked100_col'], ['hbar', 'stacked_hbar', 'stacked100_hbar']];
const sameFamily = (a, b) => a === b || GROUPS.some((g) => g.includes(a) && g.includes(b));
const nameOf = (id, l) => (typeById(id) ? typeById(id)[l] : id);

/* ------------------------------------------------------------------ parse: the words of the request → an intent + how it names its chart */
const STOP = new Set(fold(`اعرض اعرضه اعرضها اظهر ورني وريني حول حوله حولها غير غيره غيرها بدل بدلها اجعل اجعله اجعلها خلي خليه خليها ابغي ابغى ابي اريد هذا هذه هذي ذلك هذول
  الرسم رسم المخطط مخطط الشكل شكل في على الى الي من عن مع و او ثم لي لنا show display make turn change convert switch use using the a an this that it its as to into in of for by with and or please me my these those them
  حسب بحسب كل جميع بين ما هو هي هل can you could would شكرا لو سمحت اعمل سوي رجاء`).split(' '));

for (const x of [...CH_SING, ...CH_PLUR]) STOP.add(fold(x));
function numberOf(tok) { if (!tok) return null; if (/^\d+$/.test(tok)) return Number(tok); return NUM_WORDS[tok] ?? NUM_WORDS[tok.replace(/^ال/, '')] ?? null; }

export function parseChartPhrase(raw, { titles = [] } = {}) {
  const text0 = String(raw ?? '');
  // 1. quoted segments that name a chart of the report are removed (they are a reference, not words to interpret)
  const quotes = []; const unmatched = []; let rest = text0.replace(/"([^"]+)"|“([^”]+)”|«([^»]+)»|„([^“”]+)[“”]/g, (_m, a, b, c, d) => { const seg = a || b || c || d || ''; const k = fold(seg); const hit = k && titles.some((t) => { const tk = fold(t); return tk === k || (k.length >= 6 && (tk.includes(k) || k.includes(tk))); }); if (hit) { quotes.push(seg); return ' '; } if (k.split(' ').length >= 3) unmatched.push(seg); return ` ${seg} `; });
  let s = fold(rest); if (!s) return null;
  const tokens = s.split(' ');
  const it = { typeId: null, fam: null, orientation: null, grouping: null, mode: null, cumulative: null, sort: null, topN: null, labels: null, legend: null, dimension: null };
  const ref = { quotes, unmatched, sortExplicit: false, onlyOrOther: false, ordinal: null, last: false, chartNoun: false, plural: false, global: false, pronoun: false, hardTopics: [], softTopics: [], measures: [], compare: false, dist: false, srcOcc: [], byDim: null, titleWords: [] };
  const flags = { table: false, reset: false, recommended: false, format: false, report: false, period: false, question: false, tooLong: tokens.length > 28 };
  flags.question = QUESTION_RE.test(s); flags.table = TABLE_RE.test(s); flags.format = FORMAT_RE.test(s); flags.report = REPORT_RE.test(s); flags.period = PERIOD_RE.test(s);
  let w = s; // working copy: what is recognised is blanked, what remains feeds the title overlap

  // 2. chart nouns, plurals, globals, ordinals
  const nounHits = find(s, CH_SING); const plurHits = find(s, CH_PLUR);
  ref.chartNoun = nounHits.length > 0 || plurHits.length > 0; ref.plural = plurHits.length > 0;
  const nounTok = [...nounHits, ...plurHits].map((h) => tokIndex(s, h.pos));
  const globalWord = find(s, GLOBAL_Q).filter((h) => nounTok.some((i) => { const t = tokIndex(s, h.pos); return t < i && i - t <= 2; }));
  const kollaha = /(?:^|\s)(?:كلها|جميعها|all of them|all)(?=\s|$)/.test(s) && ref.plural;
  ref.global = (ref.plural || globalWord.length > 0 || kollaha);
  ref.pronoun = tokens.some((t) => /^(?:اعرض|رتب|اظهر|خل|خلي|اجعل|حول|غير|اعمل|ورني|وريني|ابغا|ابغى)(?:ه|ها|هم|هن)$/.test(t) || ['هذا', 'هذه', 'هذي', 'it', 'this', 'them', 'these', 'that', 'those', 'ذلك'].includes(t));
  const ORD = { 1: ['الاول', 'اول', 'الاولي', 'first', '1st'], 2: ['الثاني', 'الثانيه', 'ثاني', 'second', '2nd'], 3: ['الثالث', 'الثالثه', 'third', '3rd'], 4: ['الرابع', 'الرابعه', 'fourth', '4th'], 5: ['الخامس', 'الخامسه', 'fifth', '5th'], 6: ['السادس', 'السادسه', 'sixth', '6th'], 7: ['السابع', 'السابعه', 'seventh', '7th'], 8: ['الثامن', 'الثامنه', 'eighth', '8th'], 9: ['التاسع', 'التاسعه', 'ninth', '9th'], 10: ['العاشر', 'العاشره', 'tenth', '10th'] };
  const LASTW = ['الاخير', 'الاخيره', 'اخر', 'last', 'final', 'latest'];
  const CHW = `(?:${alt([...CH_SING])})`; const PREC = `(?:${PRE})`;
  for (const [n, list] of Object.entries(ORD)) {
    const re1 = new RegExp(`(?:^|\\s)${PREC}${CHW}\\s+(?:${alt(list)})(?=\\s|$)`); const re2 = new RegExp(`(?:^|\\s)(?:${alt(list)})\\s+${PREC}${CHW}(?=\\s|$)`);
    const m = re1.exec(s) || re2.exec(s); if (m) { ref.ordinal = Number(n); s = blank(s, m.index, m.index + m[0].length); w = blank(w, m.index, m.index + m[0].length); break; }
  }
  if (!ref.ordinal) {
    const m = new RegExp(`(?:^|\\s)${PREC}${CHW}\\s+(?:رقم\\s+|no\\.?\\s+|number\\s+|#\\s*)?(\\d{1,2})(?=\\s|$)`).exec(s) || new RegExp(`(?:^|\\s)(?:${alt(['chart', 'graph'])})\\s*#\\s*(\\d{1,2})(?=\\s|$)`).exec(s);
    if (m) { ref.ordinal = Number(m[1]); s = blank(s, m.index, m.index + m[0].length); w = blank(w, m.index, m.index + m[0].length); }
  }
  if (!ref.ordinal) {
    const m = new RegExp(`(?:^|\\s)${PREC}${CHW}\\s+(?:${alt(LASTW)})(?=\\s|$)`).exec(s) || new RegExp(`(?:^|\\s)(?:${alt(LASTW)})\\s+${PREC}${CHW}(?=\\s|$)`).exec(s);
    if (m) { ref.last = true; s = blank(s, m.index, m.index + m[0].length); w = blank(w, m.index, m.index + m[0].length); }
  }
  if (ref.ordinal || ref.last || quotes.length) ref.global = false;

  // 3. reset
  const rv = find(s, RESET_V); const rn = find(s, RESET_N); const rec = find(s, REC_W);
  if (rv.length && (rn.length || rec.length || ref.chartNoun || ref.ordinal || ref.last || quotes.length || ref.pronoun)) { flags.reset = true; flags.recommended = rec.length > 0; for (const h of [...rv, ...rn, ...rec]) { w = blank(w, h.pos, h.end); } }
  else if (rn.length && /(?:^|\s)(?:اعرض|show|display)/.test(s) && (ref.chartNoun || ref.ordinal || ref.pronoun)) { flags.reset = true; flags.recommended = rec.length > 0; }
  else if (rec.length && (ref.chartNoun || ref.ordinal || ref.pronoun) && /(?:^|\s)(?:اعرض|show|display|ارجع|use|الي)/.test(s)) { flags.reset = true; flags.recommended = true; }

  // 4. type words (combinations first; their words are blanked so a part is not read twice)
  const occ = []; // { kind:'named'|'bars'|'columns'|'stacked'|'grouped'|'orient', id|val, pos, glued }
  const take = (re, fn) => { let m; re.lastIndex = 0; while ((m = re.exec(s))) { const lead = m[0][0] === ' ' ? 1 : 0; const o = fn(m, m.index + lead); if (o) occ.push(o); s = blank(s, m.index, m.index + m[0].length); w = blank(w, m.index, m.index + m[0].length); re.lastIndex = 0; if (!m[0].length) break; } };
  const STK = alt(STACKED); const PCT = `(?:100\\s*%|100\\s+percent|percent|percentage|بالمئه|مئوي|مئويه|نسبي|نسبيه|بالنسبه|بنسبه)`; const AREA = alt(['مساحي', 'مساحيه', 'مساحه', 'area']);
  take(new RegExp(`(?:^|\\s)(${PRE})(?:${STK})(?:\\s+\\S+){0,3}?\\s+(?:ب)?${PCT}(?=\\s|$)`, 'g'), (m, pos) => ({ kind: 'named', id: 'stacked100_col', pos, glued: /[بك]/.test(m[1] || '') }));
  take(new RegExp(`(?:^|\\s)(${PRE})(?:${STK})\\s+(?:ب)?100(?=\\s|$)`, 'g'), (m, pos) => ({ kind: 'named', id: 'stacked100_col', pos, glued: /[بك]/.test(m[1] || '') }));
  take(new RegExp(`(?:^|\\s)(?:100\\s*%|100\\s+percent|percent)(?:\\s+\\S+){0,3}?\\s+(${PRE})(?:${STK})(?=\\s|$)`, 'g'), (m, pos) => ({ kind: 'named', id: 'stacked100_col', pos, glued: false }));
  take(new RegExp(`(?:^|\\s)(${PRE})(?:${STK})(?:\\s+\\S+){0,2}?\\s+(?:${PRE})(?:${AREA})(?=\\s|$)`, 'g'), (m, pos) => ({ kind: 'named', id: 'stacked_area', pos, glued: /[بك]/.test(m[1] || '') }));
  take(new RegExp(`(?:^|\\s)(${PRE})(?:${AREA})(?:\\s+\\S+){0,2}?\\s+(?:${STK})(?=\\s|$)`, 'g'), (m, pos) => ({ kind: 'named', id: 'stacked_area', pos, glued: /[بك]/.test(m[1] || '') }));
  take(new RegExp(`(?:^|\\s)(${PRE})(?:${alt(COLS)}|${alt(BARS)})\\s+(?:(?:و|مع|and|with|plus|\\+)\\s*)?(?:a\\s+)?(?:${alt(['خط', 'خطي', 'line'])})(?=\\s|$)`, 'g'), (m, pos) => ({ kind: 'named', id: 'combo', pos, glued: /[بك]/.test(m[1] || '') }));
  take(new RegExp(`(?:^|\\s)(${PRE})(?:${alt(['خطي', 'خطيه', 'خط', 'line', 'lines'])})(?:\\s+\\S+){0,3}?\\s+(?:${alt(MARKERS)})(?=\\s|$)`, 'g'), (m, pos) => ({ kind: 'named', id: 'line_markers', pos, glued: /[بك]/.test(m[1] || '') }));
  for (const h of find(s, MARKER_ALONE)) { occ.push({ kind: 'named', id: 'line_markers', pos: h.pos, glued: h.glued }); s = blank(s, h.pos, h.end); w = blank(w, h.pos, h.end); }
  // distribution of amounts / invoices = a histogram (but «توزيع غير المحصل حسب …» is a breakdown, not a histogram)
  take(new RegExp(`(?:^|\\s)(${PRE})(?:${alt(['توزيع المبالغ', 'توزيع مبالغ', 'توزيع قيم الفواتير', 'توزيع الفواتير', 'توزيع اعمار الفواتير', 'توزيع ايام التاخر', 'distribution of amounts', 'distribution of invoice amounts', 'distribution of invoices', 'amount distribution', 'invoice distribution', 'distribution of days'])})(?=\\s|$)`, 'g'), (m, pos) => ({ kind: 'named', id: 'histogram', pos, glued: false }));
  for (const [id, list] of TYPE_LIST) { for (const h of find(s, list)) { occ.push({ kind: 'named', id, pos: h.pos, glued: h.glued }); s = blank(s, h.pos, h.end); w = blank(w, h.pos, h.end); } }
  // typo tolerance for the names (one edit away): «histogrm», «treemaap», «sankee»
  for (const tk of s.split(' ').filter((x) => x.length >= (AR_RE.test(x) ? 6 : 5))) {
    const base = tk.replace(new RegExp(`^${PRE}`), '');
    for (const [id, list] of TYPE_LIST) if (list.some((p) => { const f = fold(p); return f.length >= (AR_RE.test(f) ? 6 : 5) && !f.includes(' ') && lev1(f, base); })) { const pos = s.indexOf(tk); occ.push({ kind: 'named', id, pos, glued: /^[بك]/.test(tk), fuzzy: true }); s = blank(s, pos, pos + tk.length); w = blank(w, pos, pos + tk.length); break; }
  }
  for (const h of find(s, HBARS)) { occ.push({ kind: 'bars', pos: h.pos, glued: h.glued }); occ.push({ kind: 'orient', val: 'h', pos: h.pos, glued: false }); s = blank(s, h.pos, h.end); w = blank(w, h.pos, h.end); }
  for (const h of find(s, COLS)) { occ.push({ kind: 'columns', pos: h.pos, glued: h.glued }); s = blank(s, h.pos, h.end); w = blank(w, h.pos, h.end); }
  for (const h of find(s, BARS)) { occ.push({ kind: 'bars', pos: h.pos, glued: h.glued }); s = blank(s, h.pos, h.end); w = blank(w, h.pos, h.end); }
  for (const h of find(s, STACKED)) { occ.push({ kind: 'stacked', pos: h.pos, glued: false }); s = blank(s, h.pos, h.end); w = blank(w, h.pos, h.end); }
  for (const h of find(s, GROUPED).filter((x) => !/^\s*(?:by|حسب|بحسب)(?:\s|$)/.test(s.slice(x.end)))) { occ.push({ kind: 'grouped', pos: h.pos, glued: false }); s = blank(s, h.pos, h.end); w = blank(w, h.pos, h.end); }
  for (const h of find(s, ORI_H)) { occ.push({ kind: 'orient', val: 'h', pos: h.pos, glued: false }); s = blank(s, h.pos, h.end); w = blank(w, h.pos, h.end); }
  for (const h of find(s, ORI_V)) { occ.push({ kind: 'orient', val: 'v', pos: h.pos, glued: false }); s = blank(s, h.pos, h.end); w = blank(w, h.pos, h.end); }
  occ.sort((a, b) => a.pos - b.pos);

  // which words are the TARGET form and which only describe the chart that is meant («حوّل رسم الشلال إلى أعمدة», “convert the bar chart to a line”):
  // a type word glued with ك / ب, or after «إلى / to / as / using …», is the target; with no separator and two type words the later one is
  let sepPos = -1; { const sm = rxOf(SEP, 'g').exec(s); if (sm) sepPos = sm.index; }
  const isType = (o) => o.kind === 'named' || o.kind === 'bars' || o.kind === 'columns';
  // «أعمدة مكدسة 100%» is ONE form: a column / bar word right before a named combination belongs to it; the same type named twice is one type
  for (let i = occ.length - 1; i >= 0; i -= 1) {
    const o = occ[i];
    if ((o.kind === 'columns' || o.kind === 'bars') && occ.some((n) => n.kind === 'named' && ['stacked100_col', 'stacked_area', 'line_markers', 'combo'].includes(n.id) && n.pos > o.pos && tokIndex(s, n.pos) - tokIndex(s, o.pos) <= 3 && !(sepPos > o.pos && sepPos < n.pos))) occ.splice(i, 1);
    else if (o.kind === 'named' && occ.some((n, j) => j > i && n.kind === 'named' && n.id === o.id)) occ.splice(i, 1);
  }
  const typeOcc = occ.filter(isType);
  let tgtTypes = typeOcc.filter((o) => o.glued || (sepPos >= 0 && o.pos > sepPos));
  if (!tgtTypes.length && typeOcc.length >= 2) tgtTypes = [typeOcc[typeOcc.length - 1]];
  if (!tgtTypes.length) tgtTypes = typeOcc;
  const srcTypes = typeOcc.filter((o) => !tgtTypes.includes(o));
  // an orientation / stacking word right next to a source type describes the source («the horizontal bar chart»)
  const srcMods = occ.filter((o) => !isType(o) && srcTypes.some((x) => Math.abs(tokIndex(s, x.pos) - tokIndex(s, o.pos)) <= 2) && !tgtTypes.some((x) => Math.abs(tokIndex(s, x.pos) - tokIndex(s, o.pos)) <= 1));
  const tgt = occ.filter((o) => !srcTypes.includes(o) && !srcMods.includes(o));
  ref.srcOcc = [...srcTypes, ...srcMods.filter((o) => o.kind === 'orient')];
  const named = tgt.find((o) => o.kind === 'named');
  if (named) it.typeId = named.id;
  else if (tgt.some((o) => o.kind === 'columns')) it.typeId = 'bar';
  const wantBars = tgt.some((o) => o.kind === 'bars'); const wantStacked = tgt.some((o) => o.kind === 'stacked'); const wantGrouped = tgt.some((o) => o.kind === 'grouped');
  const ori = tgt.filter((o) => o.kind === 'orient').map((o) => o.val).pop() || null; if (ori) it.orientation = ori;
  if (tgt.some((o) => o.kind === 'columns') && !ori) it.orientation = 'v';
  if (wantStacked) it.grouping = 'stacked'; if (wantGrouped) it.grouping = 'grouped';
  if (!it.typeId && (wantBars || wantStacked || wantGrouped)) it.fam = wantBars ? 'bars' : wantStacked ? 'stacked' : 'grouped';
  if (it.typeId && !['bar', 'stacked100_col'].includes(it.typeId)) it.grouping = null; // «stacked pie» is not a thing: the modifier only belongs to the bar family
  if (it.typeId === 'stacked100_col') it.grouping = null;

  // 5. modifiers
  const cutMode = () => { for (const h of find(s, NOT_MODE)) { s = blank(s, h.pos, h.end); w = blank(w, h.pos, h.end); } };
  cutMode();
  const mshare = find(s, MODE_SHARE); const mamt = find(s, MODE_AMOUNT);
  if (mamt.length) { it.mode = 'amount'; for (const h of mamt) { s = blank(s, h.pos, h.end); w = blank(w, h.pos, h.end); } }
  else if (mshare.length) { it.mode = 'share'; for (const h of mshare) { s = blank(s, h.pos, h.end); w = blank(w, h.pos, h.end); } }
  // cumulative / monthly: the definite adjective after a chart noun («الرسم التراكمي») names a chart; anything else is a request
  const cf = find(s, CUM_FALSE); if (cf.length) { it.cumulative = false; for (const h of cf) { s = blank(s, h.pos, h.end); w = blank(w, h.pos, h.end); } }
  for (const h of find(s, CUM_TRUE)) {
    const ti = tokIndex(s, h.pos); const defArt = /^(?:ال|وال|بال)/.test(tokens[ti] || '') || /(?:^|\s)the\s*$/.test(s.slice(0, h.pos)); const adj = nounTok.some((i) => ti > i && ti - i <= 2 || i > ti && i - ti <= 1);
    if (defArt && adj) { ref.hardTopics.push('cumulative'); } else if (it.cumulative == null) it.cumulative = true;
    s = blank(s, h.pos, h.end); w = blank(w, h.pos, h.end);
  }
  // sort
  const sd = find(s, SORT_DESC); const sa = find(s, SORT_ASC); const sl = find(s, SORT_LABEL); const sv = find(s, SORT_VERB);
  if (sd.length) it.sort = 'desc'; else if (sa.length) it.sort = 'asc'; else if (sl.length) it.sort = 'label'; else if (sv.length) it.sort = 'desc';
  ref.sortExplicit = sd.length + sa.length + sl.length > 0;
  ref.onlyOrOther = find(s, ['فقط', 'بس', 'only', 'just', 'اخري', 'اخرى', 'other', 'others', 'with other']).length > 0;
  for (const h of [...sd, ...sa, ...sl, ...sv]) { s = blank(s, h.pos, h.end); w = blank(w, h.pos, h.end); }
  // Top N
  { const TW = alt(TOP_WORDS); const re1 = new RegExp(`(?:^|\\s)(?:${PRE})(?:${TW})\\s+(\\d+|[a-z\\u0600-\\u06ff]+)(?=\\s|$)`, 'g'); const re2 = new RegExp(`(?:^|\\s)(\\d+)\\s+(?:${PRE})(?:${TW})(?=\\s|$)`, 'g'); let m;
    while ((m = re1.exec(s))) { const n = numberOf(m[1]); if (n) { it.topN = n; s = blank(s, m.index, m.index + m[0].length - (/^\d+$/.test(m[1]) ? 0 : 0)); w = blank(w, m.index, m.index + m[0].length); re1.lastIndex = 0; break; } }
    if (!it.topN) while ((m = re2.exec(s))) { const n = numberOf(m[1]); if (n) { it.topN = n; s = blank(s, m.index, m.index + m[0].length); w = blank(w, m.index, m.index + m[0].length); break; } } }
  // labels / legend
  const nearVerb = (nounHit, verbs) => find(s, verbs).some((v) => { const a = tokIndex(s, v.pos); const b = tokIndex(s, nounHit.pos); return b >= a && b - a <= 3; });
  for (const nh of find(s, LEGEND_N)) { if (nearVerb(nh, HIDE_V)) it.legend = false; else if (nearVerb(nh, SHOW_V)) it.legend = true; else continue; s = blank(s, nh.pos, nh.end); w = blank(w, nh.pos, nh.end); }
  for (const nh of find(s, LABEL_N)) { if (nearVerb(nh, HIDE_V)) it.labels = false; else if (nearVerb(nh, SHOW_V)) it.labels = true; else continue; s = blank(s, nh.pos, nh.end); w = blank(w, nh.pos, nh.end); }
  if (it.labels != null || it.legend != null) for (const h of [...find(s, HIDE_V), ...find(s, SHOW_V)]) { w = blank(w, h.pos, h.end); }

  // 6. breakdown dimension («حسب البلديات», “by Amanah”) and topic words
  ref.compare = find(s, COMPARE_W).length > 0; ref.dist = find(s, DIST_W).length > 0;
  const byHits = find(s, BY_W).filter((h) => !(h.text === 'على' || h.text === 'over'));
  const onHits = find(s, ['على', 'over']);
  const allDimHits = [];
  for (const [id, list] of DIM_LIST) for (const h of find(s, id === 'month' ? [...list, ...MONTH_BY.filter((x) => !list.includes(x))] : list)) allDimHits.push({ id, ...h, strong: id !== 'month' || list.some((x) => fold(x) === h.text) });
  allDimHits.sort((a, b) => a.pos - b.pos);
  for (const dh of allDimHits) {
    const ti = tokIndex(s, dh.pos);
    const afterBy = byHits.some((b) => { const bi = tokIndex(s, b.pos); return ti > bi && ti - bi <= 3; }) || (ref.dist && onHits.some((b) => { const bi = tokIndex(s, b.pos); return ti > bi && ti - bi <= 2; }));
    const nextToNoun = nounTok.some((i) => Math.abs(ti - i) <= 2);
    if (afterBy && !ref.byDim) { ref.byDim = dh.id; it.dimension = dh.id; w = blank(w, dh.pos, dh.end); }
    else if (dh.strong) { (nextToNoun ? ref.hardTopics : ref.softTopics).push(dh.id); w = blank(w, dh.pos, dh.end); }
  }
  for (const [id, list] of TOPIC_EXTRA) if (id !== 'cumulative') for (const h of find(s, list)) { const ti = tokIndex(s, h.pos); (nounTok.some((i) => Math.abs(ti - i) <= 2) ? ref.hardTopics : ref.softTopics).push(id); w = blank(w, h.pos, h.end); }
  // measures (the unpaid forms first; their words are then blanked so «غير المحصل» is not also «المحصل»)
  { let sm = s; for (const [id, list] of MEASURES) { const hs = find(sm, list); if (hs.length) { ref.measures.push(id); for (const h of hs) { sm = blank(sm, h.pos, h.end); w = blank(w, h.pos, h.end); } } } }
  // words that remain (title overlap)
  ref.titleWords = w.split(' ').filter((x) => x.length >= 3 && !STOP.has(x) && !/^\d+$/.test(x)).map((x) => x.replace(/^(?:وال|بال|لل|ال)/, ''));
  if (ref.titleWords.length > 12) ref.titleWords = [];

  return { it, ref, flags, s, w, tokens, hasTypeWord: !!(it.typeId || it.fam) };
}
function lev1(a, b) { // true when the two words are at most one edit apart (one substitution, one insertion / deletion, or two letters swapped); short words (< 6) only the swap
  if (a === b) return true; const la = a.length; const lb = b.length; if (Math.abs(la - lb) > 1) return false;
  let i = 0; while (i < la && i < lb && a[i] === b[i]) i += 1;
  const swapped = la === lb && a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  if (Math.min(la, lb) < 6) return swapped;
  if (la === lb) return a.slice(i + 1) === b.slice(i + 1) || swapped;
  return la > lb ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

// does the request ask for anything about a chart? (a type, a modifier, a reset, or a breakdown with a chart word)
function isChartRequest(p) {
  const { it, ref, flags } = p;
  if (flags.question || flags.tooLong) return false;
  const named = ref.ordinal || ref.last || ref.quotes.length > 0;
  if (flags.format) return false; // «صدّر الرسم PDF» belongs to the export layer
  if (flags.reset) return true;
  const typeLike = !!(it.typeId || it.fam === 'bars');
  if (flags.report && !named) return false; // a new report, not a change of a chart
  if (flags.period && !named && !(ref.chartNoun && typeLike && ref.pronoun)) return false;
  if (flags.table && !typeLike) return false; // «as a table» / «الجدول» belongs to the tables-only command
  if (typeLike) return true;
  const needsRef = it.orientation || it.mode || it.cumulative != null || it.sort || it.topN || it.fam || it.grouping;
  const hasRef = ref.chartNoun || named || ref.pronoun;
  if (it.labels != null || it.legend != null) return true;
  if (needsRef) {
    if (hasRef) return true;
    // a bare direction («sort ascending») or «top 5 … only / with other» is about the current result; «أعلى 5 أمانات» alone is a new request
    const bare = !it.orientation && !it.mode && it.cumulative == null && !it.fam && !it.grouping;
    return bare && ((!!it.sort && ref.sortExplicit && !it.topN) || (!!it.topN && ref.onlyOrOther));
  }
  if (it.dimension) return !!(ref.chartNoun || named || ref.dist || ref.pronoun);
  return false;
}

/* ------------------------------------------------------------------ re-sendable text */
const reqLangOf = (q, lang) => (AR_RE.test(String(q || '')) ? 'ar' : /[a-z]/i.test(String(q || '')) ? 'en' : (lang === 'en' ? 'en' : 'ar'));
function emit(intent, title, l, extra = {}) { // a full request that names ONE chart and parses back to the same intent
  const typeId = extra.typeId || null; const parts = [];
  const q = (x) => `"${x}"`;
  if (l === 'ar') {
    parts.push(`${extra.verb || 'اعرض'} ${q(title)}`);
    const id = typeId || intent.typeId;
    if (id && PHRASE[id]) parts.push(PHRASE[id][0]);
    else if (intent.fam === 'bars') parts.push('كأشرطة'); else if (intent.fam === 'stacked') parts.push('مكدسة'); else if (intent.fam === 'grouped') parts.push('مجمعة');
    if (intent.grouping === 'stacked' && !['stacked_col', 'stacked_hbar', 'stacked100_col', 'stacked100_hbar', 'stacked_area'].includes(id) && intent.fam !== 'stacked') parts.push('مكدسة'); if (intent.grouping === 'grouped' && intent.fam !== 'grouped') parts.push('مجمعة');
    if (intent.orientation === 'h' && !/أفقي/.test(parts.join(' '))) parts.push('أفقيا'); if (intent.orientation === 'v' && id !== 'bar') parts.push('عموديا');
    if (intent.mode === 'share') parts.push('كنسبة مئوية'); if (intent.mode === 'amount') parts.push('بالمبلغ');
    if (intent.cumulative === true) parts.push('تراكميا'); if (intent.cumulative === false) parts.push('شهريا');
    if (intent.sort === 'desc') parts.push('مرتبة تنازليا'); if (intent.sort === 'asc') parts.push('مرتبة تصاعديا'); if (intent.sort === 'label') parts.push('مرتبة ابجديا');
    if (intent.topN) parts.push(`أعلى ${intent.topN}`);
    if (intent.labels === false) parts.push('بدون قيم'); if (intent.labels === true) parts.push('مع القيم');
    if (intent.legend === false) parts.push('بدون مفتاح'); if (intent.legend === true) parts.push('مع المفتاح');
    if (intent.dimension && DIM_PHRASE[intent.dimension]) parts.push(`حسب ${DIM_PHRASE[intent.dimension][0]}`);
    return parts.join(' ');
  }
  parts.push(`${extra.verb || 'Show'} ${q(title)}`);
  const id = typeId || intent.typeId;
  if (id && PHRASE[id]) parts.push(PHRASE[id][1]);
  else if (intent.fam === 'bars') parts.push('as bars'); else if (intent.fam === 'stacked') parts.push('stacked'); else if (intent.fam === 'grouped') parts.push('grouped');
  if (intent.grouping === 'stacked' && !['stacked_col', 'stacked_hbar', 'stacked100_col', 'stacked100_hbar', 'stacked_area'].includes(id) && intent.fam !== 'stacked') parts.push('stacked'); if (intent.grouping === 'grouped' && intent.fam !== 'grouped') parts.push('grouped');
  if (intent.orientation === 'h' && !/horizontal/.test(parts.join(' '))) parts.push('horizontal'); if (intent.orientation === 'v' && id !== 'bar') parts.push('vertical');
  if (intent.mode === 'share') parts.push('as a percentage'); if (intent.mode === 'amount') parts.push('as amounts');
  if (intent.cumulative === true) parts.push('cumulative'); if (intent.cumulative === false) parts.push('not cumulative');
  if (intent.sort === 'desc') parts.push('sorted descending'); if (intent.sort === 'asc') parts.push('sorted ascending'); if (intent.sort === 'label') parts.push('sorted alphabetically');
  if (intent.topN) parts.push(`top ${intent.topN}`);
  if (intent.labels === false) parts.push('without labels'); if (intent.labels === true) parts.push('with labels');
  if (intent.legend === false) parts.push('without legend'); if (intent.legend === true) parts.push('with legend');
  if (intent.dimension && DIM_PHRASE[intent.dimension]) parts.push(`by ${DIM_PHRASE[intent.dimension][1]}`);
  return parts.join(' ');
}

/* ------------------------------------------------------------------ evaluating a request on one chart */
function patchFor(b, it, useDim, saved) {
  const cur = typeIdOf(b); const p = {}; const invalid = (ar, en) => ({ invalid: T(ar, en) });
  if (it.typeId) p.kind = it.typeId;
  else if (it.fam || it.orientation || it.grouping) {
    const wantsFam = !!it.fam;
    if (!BARFAM.has(cur) && wantsFam) {
      if (it.grouping === 'stacked' && (cur === 'area' || cur === 'stacked_area')) p.kind = 'stacked_area';
      else { const o = it.orientation || (recommendedKind(saved || b) === 'hbar' ? 'h' : 'v'); p.kind = o === 'h' ? 'hbar' : 'bar'; }
    } else if (!BARFAM.has(cur) && it.grouping) {
      if (it.grouping === 'stacked' && cur === 'area') p.kind = 'stacked_area';
      else if (it.grouping === 'grouped' && cur === 'stacked_area') p.kind = 'area';
      else return invalid('التكديس والتجميع يخصّان الأعمدة والمساحات؛ هذا الرسم من نوع آخر.', 'Stacking and grouping apply to bars and areas; this chart is of another type.');
    } else if (!BARFAM.has(cur) && it.orientation && !['box', 'combo'].includes(cur)) {
      return invalid('الاتجاه الأفقي/العمودي يخصّ الأعمدة والأشرطة؛ هذا الرسم من نوع آخر.', 'Horizontal / vertical applies to bars and columns; this chart is of another type.');
    }
  }
  const fin = p.kind || it.typeId; const barish = !fin || BARFAM.has(fin) || fin === 'bar' || fin === 'stacked100_col';
  if (it.orientation && (barish || ['box', 'combo'].includes(fin || cur))) p.orientation = it.orientation;
  if (it.grouping && (barish || ['stacked_area', 'area'].includes(fin || cur))) { if (!['stacked_area', 'area'].includes(fin || cur)) p.grouping = it.grouping; }
  if (it.mode && !(fin && COMPOSITION.has(fin)) && !COMPOSITION.has(cur)) p.mode = it.mode;
  if (it.cumulative != null) p.cumulative = it.cumulative;
  if (it.sort) p.sort = it.sort;
  if (it.topN) p.topN = it.topN;
  if (it.labels != null) p.labels = it.labels;
  if (it.legend != null) p.legend = it.legend;
  if (useDim && it.dimension && !NO_DIM_PATCH.has(fin || cur)) p.dimension = it.dimension;
  return { patch: p };
}
const IGN_KEY = { sort: 'sort', topN: 'topn', cumulative: 'cumulative', mode: 'percentage', dimension: 'dimension' };
const sigOfResult = (r) => `${r.typeId}|${(r.changes || []).map((x) => `${x.key}:${x.en}`).join(';')}|${r.block?.showLabels}|${r.block?.showLegend}|${r.block?.dim?.dimension}`;
const sigOfShown = (b) => `${typeIdOf(b)}||${b.showLabels}|${b.showLegend}|${b.dim?.dimension}`;

function evalOne(c, ctx, it, useDim) {
  const base = ctx.baseOf(c.id); const baseMode = !!base; const block = base || c; const cur = typeIdOf(c);
  const pf = patchFor(c, it, useDim, block);
  const stored = baseMode ? (chartConfigOf(ctx.view, c.id) || {}) : {};
  if (pf.invalid) return { chart: c, ok: false, reason: pf.invalid, cur };
  const patch = pf.patch; const merged = patchConfig(stored, patch);
  const r = evaluateChart(block, merged.kind, merged, { lang: ctx.lang });
  if (!r.ok) return { chart: c, ok: false, reason: r.reason, cur, patch, merged };
  const rc = baseMode ? evaluateChart(block, stored.kind, stored, { lang: ctx.lang }) : null;
  const curSig = rc && rc.ok ? sigOfResult(rc) : sigOfShown(c);
  const requested = Object.keys(patch).filter((k) => IGN_KEY[k]).map((k) => IGN_KEY[k]);
  const ignoredKeys = (r.ignored || []).map((x) => x.key); const droppedAll = requested.length > 0 && requested.every((k) => ignoredKeys.includes(k));
  const sig = sigOfResult(r);
  if (sig === curSig) {
    if (droppedAll) return { chart: c, ok: false, reason: (r.ignored.find((x) => requested.includes(x.key)) || r.ignored[0]), cur, patch, merged, ignoredOnly: true };
    return { chart: c, ok: true, noop: true, typeId: r.typeId, changes: [], ignored: r.ignored || [], patch, merged, cur, result: r };
  }
  if (droppedAll && r.typeId === cur) return { chart: c, ok: false, reason: (r.ignored.find((x) => requested.includes(x.key)) || r.ignored[0]), cur, patch, merged, ignoredOnly: true };
  // the changes to announce: those the new config adds to what was already shown
  const before = new Set(rc && rc.ok ? rc.changes.map((x) => `${x.key}:${x.en}`) : []);
  const changes = (r.changes || []).filter((x) => !before.has(`${x.key}:${x.en}`)).map((x) => (x.key === 'dimension' && patch.dimension ? { key: 'dimension', ar: `البُعد: ${DIM_NAME[patch.dimension]?.ar || patch.dimension} (من أرقام التقرير المحفوظة نفسها).`, en: `Dimension: ${DIM_NAME[patch.dimension]?.en || patch.dimension} (from the same saved report figures).` } : x));
  return { chart: c, ok: true, noop: false, typeId: r.typeId, changes, ignored: (r.ignored || []).filter((x) => requested.includes(x.key)), patch, merged, cur, result: r };
}

/* ------------------------------------------------------------------ choosing the chart */
const measureKeys = (b) => new Set([...(Array.isArray(b.dim?.measures) ? b.dim.measures.map((m) => m.key) : []), ...(b.series || []).map((s) => s.role).filter(Boolean)]);
const MEAS_MAP = Object.fromEntries(MEASURES.map(([id, , keys]) => [id, keys]));
function topicMatch(b, topic) {
  const dim = b.dim?.dimension;
  switch (topic) {
    case 'month': return dim === 'month' && b.basis !== 'cumulative';
    case 'cumulative': return b.basis === 'cumulative';
    case 'exclusions': return measureKeys(b).has('excluded') || /استبعاد|exclusion/i.test(b.title || '');
    case 'reason': return dim === 'reason' && !measureKeys(b).has('excluded');
    default: return dim === topic;
  }
}
const srcMatch = (b, o) => {
  const cur = typeIdOf(b);
  if (o.kind === 'named') return sameFamily(cur, o.id) || (o.id === 'pie' && cur === 'pie') || (o.id === 'heatmap' && cur === 'heatmap');
  if (o.kind === 'bars') return BARFAM.has(cur);
  if (o.kind === 'columns') return ['bar', 'stacked_col', 'stacked100_col'].includes(cur);
  if (o.kind === 'orient') return o.val === 'h' ? ['hbar', 'stacked_hbar', 'stacked100_hbar'].includes(cur) : ['bar', 'stacked_col', 'stacked100_col', 'line', 'area'].includes(cur);
  return true;
};
const stem = (x) => x.replace(/^(?:وال|بال|لل|ال)/, '');
const titleTokens = (t) => new Set(fold(t).split(' ').map(stem).filter((x) => x.length >= 3));

function describeChange(it, r, title, l) {
  const bits = [];
  const tn = r.typeId ? nameOf(r.typeId, l) : '';
  if (r.typeId && r.typeId !== r.cur) bits.push(l === 'ar' ? `النوع: «${tn}»` : `type: ${tn}`);
  else if (it.orientation || it.grouping || it.mode) bits.push(l === 'ar' ? `الشكل: «${tn}»` : `form: ${tn}`);
  if (it.sort) bits.push(l === 'ar' ? (it.sort === 'desc' ? 'ترتيب تنازلي' : it.sort === 'asc' ? 'ترتيب تصاعدي' : 'ترتيب أبجدي') : (it.sort === 'desc' ? 'sorted descending' : it.sort === 'asc' ? 'sorted ascending' : 'sorted alphabetically'));
  if (it.topN) bits.push(l === 'ar' ? `أعلى ${it.topN} مع «أخرى»` : `top ${it.topN} plus Other`);
  if (it.cumulative === true) bits.push(l === 'ar' ? 'تراكمي' : 'cumulative'); if (it.cumulative === false) bits.push(l === 'ar' ? 'شهري' : 'monthly');
  if (it.labels != null) bits.push(l === 'ar' ? (it.labels ? 'إظهار القيم' : 'إخفاء القيم') : (it.labels ? 'labels shown' : 'labels hidden'));
  if (it.legend != null) bits.push(l === 'ar' ? (it.legend ? 'إظهار المفتاح' : 'إخفاء المفتاح') : (it.legend ? 'legend shown' : 'legend hidden'));
  if (it.dimension && r.patch?.dimension) bits.push(l === 'ar' ? `البُعد: ${DIM_NAME[it.dimension]?.ar || it.dimension}` : `dimension: ${DIM_NAME[it.dimension]?.en || it.dimension}`);
  return bits;
}
function applyNote(it, r, title) {
  const out = {};
  for (const l of ['ar', 'en']) {
    const bits = describeChange(it, r, title, l); const parts = [];
    parts.push(l === 'ar' ? `عدّلتُ «${title}»${bits.length ? ` (${bits.join('، ')})` : ''}.` : `Updated “${title}”${bits.length ? ` (${bits.join(', ')})` : ''}.`);
    if (r.changes.length) parts.push(r.changes.map((x) => x[l]).join(' '));
    if (r.ignored.length) parts.push((l === 'ar' ? 'لم يُطبَّق: ' : 'Not applied: ') + r.ignored.map((x) => x[l]).join(' '));
    out[l] = parts.join(' ');
  }
  return T(out.ar, out.en);
}
const noopNote = (it, r, title) => T(`«${title}» معروض بهذا الشكل بالفعل (${nameOf(r.typeId, 'ar')}).`, `“${title}” is already shown this way (${nameOf(r.typeId, 'en')}).`);

function alternativesFor(block, shown, it, wantId, title, l, lang) {
  const o = chartOptions(block, { lang }); const cur = typeIdOf(shown || block); const purpose = wantId ? typeById(wantId)?.purpose : null;
  const pool = o.available.filter((a) => a.id !== cur && a.id !== wantId && !(a.typeId && a.typeId === cur));
  pool.sort((a, b) => {
    const pa = purpose && typeById(a.id)?.purpose === purpose ? 0 : 1; const pb = purpose && typeById(b.id)?.purpose === purpose ? 0 : 1; if (pa !== pb) return pa - pb;
    const ra = a.id === o.recommended ? 0 : 1; const rb = b.id === o.recommended ? 0 : 1; if (ra !== rb) return ra - rb;
    return CHART_TYPES.findIndex((t) => t.id === a.id) - CHART_TYPES.findIndex((t) => t.id === b.id);
  });
  const out = pool.slice(0, 3).map((a) => { const t = typeById(a.id); return { typeId: a.id, label: T(t.ar, t.en), text: emit({}, title, l, { typeId: a.typeId || a.id }) }; });
  out.push({ typeId: 'table', label: T('عرض الجدول', 'View the data table'), text: l === 'ar' ? 'اعرض الجداول فقط' : 'show only the tables' });
  return out.slice(0, 4);
}

export function interpretChartRequest(q, { model, view, lang, base } = {}) {
  try { return interpretInner(q, { model, view, lang, base }); } catch (e) { if (typeof process !== 'undefined' && process.env && process.env.CHART_REQ_DEBUG) throw e; return null; }
}

function interpretInner(q, { model, view, lang, base }) {
  const text = String(q ?? '').trim(); if (!text) return null;
  const dm = model ? assignChartIds(model) : null; const given = dm ? chartBlocks(dm) : [];
  const bm0 = base ? new Map(chartBlocks(assignChartIds(base)).map((b) => [b.id, b])) : null;
  // with the SAVED model (`base`) the charts are read as they are SHOWN under the current view (what the person sees: its type, dimension, title); without it `model` is taken as shown
  const shownOf = (c) => {
    const b0 = bm0 && bm0.get(c.id); const stored = chartConfigOf(view, c.id); if (!b0) return c;
    if (!stored || !Object.keys(normalizeConfig(stored)).length) return { ...b0, id: c.id };
    const r = evaluateChart(b0, stored.kind, stored, { lang: model && (model.lang === 'ar' || model.lang === 'en') ? model.lang : (lang === 'en' ? 'en' : 'ar') });
    return { ...(r.ok ? r.block : b0), id: c.id };
  };
  const charts = given.map(shownOf);
  const p = parseChartPhrase(text, { titles: [...charts.map((c) => c.title || ''), ...given.map((c) => c.title || '')] });
  if (!p || !isChartRequest(p)) return null;
  if (!p.ref.ordinal && !p.ref.last && !p.ref.quotes.length) { // a request that names a particular Amanah («قارن الرياض وجدة كأعمدة») asks for NEW figures: the report interpreter's
    try { if (resolveEntities(text.replace(/"[^"]*"|“[^”]*”|«[^»]*»/g, ' ')).amanahs.length) return null; } catch (e) { /* entity index unavailable: carry on */ }
  }
  if (p.ref.unmatched.length && !p.ref.quotes.length) return { type: 'need', question: T('لم أجد رسماً بهذا العنوان في النتيجة الحالية.', 'I could not find a chart with that title in the current result.') };
  const { it, ref, flags } = p; const L = reqLangOf(text, lang); const ml = model && (model.lang === 'ar' || model.lang === 'en') ? model.lang : (lang === 'en' ? 'en' : 'ar');
  const bm = bm0;
  const ctx = { view: view || null, lang: ml, baseOf: (id) => (bm ? bm.get(id) || null : null) };
  const need = (ar, en) => ({ type: 'need', question: T(ar, en) });
  const hasNamedRef = !!(ref.ordinal || ref.last || ref.quotes.length);

  // ---- global («كل الرسوم»): the legacy command handles what it knows; a form it would misread (a donut is not a pie) goes chart by chart
  if (ref.global && !flags.reset) {
    const t = it.typeId; const legacyKnows = ((!!t && ['bar', 'line', 'pie'].includes(t) && !it.fam) || (!t && it.fam === 'bars' && it.orientation !== 'h')) && !it.grouping && !it.mode && it.sort == null && !it.topN && it.cumulative == null && it.labels == null && it.legend == null && !it.dimension;
    const legacyHbar = !t && it.fam === 'bars' && it.orientation === 'h' && !it.grouping;
    if (legacyKnows || legacyHbar) return null;
    if (!charts.length) return need('النتيجة الحالية لا تحتوي رسماً بيانياً.', 'The current result has no chart.');
    return globalAsk(charts, it, ctx, L);
  }
  if (flags.reset && ref.global && !hasNamedRef) return null;
  if (!dm) return need('لا توجد نتيجة بعد لأغيّر رسمها. اطلب تقريراً أو أرفق ملفاً أولاً.', 'There is no result yet whose chart I could change. Ask for a report or attach a file first.');
  if (!charts.length) return need('النتيجة الحالية لا تحتوي رسماً بيانياً لأغيّره. يمكنني إضافة قسم يحتوي رسماً.', 'The current result has no chart to change. I can add a section that has one.');

  // ---- which charts could it be (hard references first)
  let pool = charts;
  const list = () => charts.map((c, i) => `${i + 1}) ${c.title || c.id}`).join('  ');
  if (ref.ordinal) { const c = charts[ref.ordinal - 1]; if (!c) return need(`يوجد ${charts.length} رسم فقط في هذه النتيجة: ${list()}`, `There are only ${charts.length} chart(s) in this result: ${list()}`); pool = [c]; }
  else if (ref.last) pool = [charts[charts.length - 1]];
  else if (ref.quotes.length) {
    const keys = ref.quotes.map(fold); pool = charts.filter((c, i) => [c.title || '', given[i]?.title || ''].some((t) => { const tk = fold(t); return keys.some((k) => tk === k || (k.length >= 6 && (tk.includes(k) || k.includes(tk)))); }));
    if (!pool.length) return need('لم أجد رسماً بهذا العنوان في النتيجة الحالية.', 'I could not find a chart with that title in the current result.');
  }
  const hardNote = hasNamedRef;
  if (!hardNote) {
    for (const o of ref.srcOcc.filter((x) => x.kind !== 'orient')) { const f = pool.filter((c) => srcMatch(c, o)); if (!f.length) return need('لا يوجد رسم بهذا الوصف في النتيجة الحالية.', 'No chart in the current result matches that description.'); pool = f; }
    for (const o of ref.srcOcc.filter((x) => x.kind === 'orient')) { const f = pool.filter((c) => srcMatch(c, o)); if (f.length) pool = f; }
    for (const tp of ref.hardTopics) { const f = pool.filter((c) => topicMatch(c, tp)); if (!f.length) return need('لا يوجد رسم بهذا الموضوع في النتيجة الحالية.', 'No chart in the current result is about that subject.'); pool = f; }
  }

  // ---- reset
  if (flags.reset) return resetResult(pool, charts, hardNote || ref.hardTopics.length > 0 || ref.srcOcc.length > 0, ctx, flags, L, it);

  // ---- soft selectors narrow the pool (only when something matches)
  const narrow = (pred) => { const f = pool.filter(pred); if (f.length && f.length < pool.length) pool = f; };
  if (!hardNote) for (const tp of ref.softTopics) narrow((c) => topicMatch(c, tp));
  // a breakdown dimension: charts already by that dimension, else charts that hold it
  let dimTier = null; const holds = (c, d) => { const b = ctx.baseOf(c.id) || c; return b.dim?.dimension === d || chartDimensions(b).some((x) => x.id === d); };
  if (it.dimension) {
    const t1 = pool.filter((c) => c.dim?.dimension === it.dimension); const t2 = pool.filter((c) => c.dim?.dimension !== it.dimension && holds(c, it.dimension));
    const hasOther = !!(it.typeId || it.fam || it.orientation || it.grouping || it.mode || it.sort || it.topN || it.cumulative != null || it.labels != null || it.legend != null);
    if (!hasOther) { if (t2.length) { pool = t2; dimTier = 2; } else if (t1.length) { pool = t1; dimTier = 1; } else dimTier = 3; }
    else if (t1.length) { pool = t1; dimTier = 1; } else if (t2.length) { pool = t2; dimTier = 2; } else dimTier = 3;
  }
  if (it.dimension && dimTier === 3) {
    const have = [...new Set(charts.flatMap((c) => chartDimensions(ctx.baseOf(c.id) || c).map((x) => x.id)))].filter((d) => DIM_PHRASE[d]);
    const dn = DIM_NAME[it.dimension] || T(it.dimension, it.dimension);
    const alts = [{ typeId: null, label: T(`أضف مقارنة حسب ${dn.ar}`, `Add a comparison by ${dn.en}`), text: L === 'ar' ? `قارن حسب ${DIM_PHRASE[it.dimension]?.[0] || dn.ar}` : `compare by ${DIM_PHRASE[it.dimension]?.[1] || dn.en}` }];
    for (const d of have.slice(0, 3)) alts.push({ typeId: null, label: T(`حسب ${DIM_NAME[d]?.ar || d}`, `By ${DIM_NAME[d]?.en || d}`), text: emit({ dimension: d }, pool[0]?.title || '', L) });
    return { type: 'unsuitable', reason: T(`هذه النتيجة لا تحمل أرقاماً حسب ${dn.ar}. ${DIMENSION_NEEDS.ar}`, `This result does not hold figures by ${dn.en}. ${DIMENSION_NEEDS.en}`), alternatives: alts.slice(0, 4) };
  }
  if (!hardNote && ref.measures.length) { const sc = (c) => ref.measures.filter((m) => (MEAS_MAP[m] || []).some((k) => measureKeys(c).has(k))).length; const best = Math.max(...pool.map(sc)); if (best > 0) { const f = pool.filter((c) => sc(c) === best); if (f.length < pool.length) pool = f; } }
  if (!hardNote && (ref.compare || it.grouping === 'grouped') && !ref.srcOcc.length) narrow((c) => (c.series || []).length >= 2 && ['bar', 'hbar'].includes(typeIdOf(c)));
  if (!hardNote && ref.titleWords.length >= 2 && pool.length > 1) {
    const sc = (c) => { const tt = titleTokens(c.title || ''); return ref.titleWords.filter((x) => tt.has(x)).length; }; const best = Math.max(...pool.map(sc));
    if (best >= 2) { const f = pool.filter((c) => sc(c) === best); if (f.length < pool.length) pool = f; }
  }

  // ---- evaluate each candidate
  const useDim = dimTier === 2;
  const evals = pool.map((c) => evalOne(c, ctx, it, useDim && (c.dim?.dimension !== it.dimension)));
  const okAll = evals.filter((e) => e.ok); const real = okAll.filter((e) => !e.noop);
  if (real.length === 1) return applyResult(real[0], it, ctx);
  if (real.length > 1) return askResult(real, it, L, ctx);
  if (okAll.length) { // everything that fits is already in that state
    const e = okAll[0]; return { type: 'apply', chartId: e.chart.id, chartTitle: e.chart.title || '', patch: {}, kind: e.typeId, noop: true, note: noopNote(it, e, e.chart.title || e.chart.id), changes: [], ...(okAll.length > 1 ? { also: okAll.slice(1).map((x) => x.chart.id) } : {}) };
  }
  return unsuitableResult(evals, it, pool, ctx, L);
}

function applyResult(e, it, ctx) {
  const c = e.chart; const title = c.title || c.id;
  return { type: 'apply', chartId: c.id, chartTitle: title, patch: e.patch, kind: e.typeId, note: applyNote(it, { ...e, cur: e.cur }, title), changes: e.changes, ...(e.ignored.length ? { ignored: e.ignored } : {}) };
}
function askResult(real, it, L, ctx) {
  const want = real[0].typeId && real.every((e) => e.typeId === real[0].typeId) && it.typeId ? real[0].typeId : null;
  const what = want ? nameOf(want, 'ar') : null; const whatEn = want ? nameOf(want, 'en') : null;
  return {
    type: 'ask',
    question: T(what ? `يمكن عرض أكثر من رسم في النتيجة بشكل «${what}». أيّها تقصد؟` : 'ينطبق ذلك على أكثر من رسم في النتيجة. أيّها تقصد؟', whatEn ? `More than one chart in the result can be shown as “${whatEn}”. Which one do you mean?` : 'That could apply to more than one chart in the result. Which one do you mean?'),
    options: real.map((e) => ({ label: T(e.chart.title || e.chart.id, e.chart.title || e.chart.id), text: emit(it, e.chart.title || e.chart.id, L) }))
  };
}
function globalAsk(charts, it, ctx, L) {
  const evals = charts.map((c) => evalOne(c, ctx, it, false)).filter((e) => e.ok && !e.noop);
  if (!evals.length) return { type: 'unsuitable', reason: T('لا يناسب أي رسم في هذه النتيجة هذا الطلب.', 'No chart in this result fits that request.'), alternatives: [{ typeId: 'table', label: T('عرض الجدول', 'View the data table'), text: L === 'ar' ? 'اعرض الجداول فقط' : 'show only the tables' }] };
  const q = askResult(evals, it, L, ctx);
  return { ...q, question: T('أطبّق هذا التغيير على رسم واحد في كل مرة، حتى لا يفقد رسمٌ معناه. أيّ رسم تريد؟', 'I apply this to one chart at a time so that no chart loses its meaning. Which chart do you want?') };
}
// the catalog type the request describes: the named type, or the bar-family member its orientation / stacking / percentage words pick
function wantedTypeId(it) {
  const id = it.typeId || (it.fam || it.orientation || it.grouping ? (it.orientation === 'h' ? 'hbar' : 'bar') : null);
  return id ? resolveType({ kind: id, ...(it.orientation ? { orientation: it.orientation } : {}), ...(it.grouping ? { grouping: it.grouping } : {}), ...(it.mode ? { mode: it.mode } : {}) }, {}) : null;
}
function unsuitableResult(evals, it, pool, ctx, L) {
  // the reason: the most common one among the charts asked about (a waterfall's or heat map's own reason only when nothing else is left)
  const blocked = evals.filter((e) => !e.ok);
  const generic = (r) => !!r && /مطابقة حسابية|reconciliation|مصفوفة|matrix|ليست فئات وسلاسل|not categories/.test(`${r.ar} ${r.en}`);
  const pickFrom = blocked.some((e) => !generic(e.reason)) ? blocked.filter((e) => !generic(e.reason)) : blocked;
  const count = new Map(); for (const e of pickFrom) count.set(e.reason.en, (count.get(e.reason.en) || 0) + 1);
  const topEn = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]; const rep = pickFrom.find((e) => e.reason.en === topEn) || blocked[0];
  const title = rep.chart.title || rep.chart.id; const wantId = wantedTypeId(it); const tn = wantId ? { ar: nameOf(wantId, 'ar'), en: nameOf(wantId, 'en') } : null;
  const many = pool.length > 1;
  const reason = T(
    `${many ? 'لا يناسب أيٌّ من الرسوم المقصودة هذا الطلب. مثلاً ' : ''}${tn ? `لا أستطيع عرض «${title}» بشكل «${tn.ar}»: ` : `لا أستطيع تطبيق ذلك على «${title}»: `}${rep.reason.ar}`,
    `${many ? 'None of the charts in question fits that request. For example ' : ''}${tn ? `I can’t show “${title}” as ${tn.en}: ` : `I can’t apply that to “${title}”: `}${rep.reason.en}`
  );
  const block = ctx.baseOf(rep.chart.id) || rep.chart;
  return { type: 'unsuitable', reason, alternatives: alternativesFor(block, rep.chart, it, wantId, title, L, ctx.lang) };
}
function resetResult(pool, charts, targeted, ctx, flags, L, it) {
  const changed = pool.filter((c) => { const cfg = chartConfigOf(ctx.view, c.id); return (cfg && Object.keys(normalizeConfig(cfg)).length) || !!c.config; });
  const mk = (c) => {
    const block = ctx.baseOf(c.id); let patch = {}; let kind = block ? typeIdOf(block) : typeIdOf(c);
    if (flags.recommended && block) { const rk = recommendedKind(block, { lang: ctx.lang }); if (rk !== typeIdOf(block)) { patch = { kind: rk }; kind = rk; } }
    const title = c.title || c.id;
    return { type: 'apply', chartId: c.id, chartTitle: title, patch, kind, reset: !patch.kind, note: flags.recommended ? T(`أعدتُ «${title}» إلى الرسم الموصى به (${nameOf(kind, 'ar')}).`, `Put “${title}” back to the recommended chart (${nameOf(kind, 'en')}).`) : T(`أعدتُ «${title}» إلى شكله الأصلي.`, `Put “${title}” back to its original form.`), changes: [] };
  };
  if (targeted && pool.length === 1) { const c = pool[0]; if (!changed.length && !flags.recommended) return { type: 'apply', chartId: c.id, chartTitle: c.title || '', patch: {}, kind: typeIdOf(c), noop: true, note: T(`«${c.title}» لم يتغيّر عن شكله الأصلي.`, `“${c.title}” has not been changed from its original form.`), changes: [] }; return mk(c); }
  const set = targeted ? pool : changed;
  if (!set.length) return { type: 'need', question: T('لم يُعدَّل أي رسم في هذه النتيجة، فلا شيء لأعيده.', 'No chart in this result has been changed, so there is nothing to put back.') };
  if (set.length === 1) return mk(set[0]);
  return { type: 'ask', question: T('أي رسم تريد إعادته إلى الشكل الأصلي؟', 'Which chart do you want to put back to its original form?'), options: set.map((c) => ({ label: T(c.title || c.id, c.title || c.id), text: L === 'ar' ? `أعد "${c.title}" إلى ${flags.recommended ? 'الرسم الموصى به' : 'الشكل الأصلي'}` : `Reset "${c.title}" to ${flags.recommended ? 'the recommended chart' : 'its original form'}` })) };
}

/* ------------------------------------------------------------------ applying the result to the view */
export function viewAfterRequest(view, result, model) {
  if (!result || result.type !== 'apply' || !result.chartId || result.noop) return view;
  if (result.reset) return resetChart(view, result.chartId);
  const cur = chartConfigOf(view, result.chartId) || {};
  const merged = patchConfig(cur, result.patch || {});
  // with the SAVED model at hand, keys equal to the chart's own default are not stored; a displayed model (it carries `view`) is never used for that
  const block = model && !model.view ? chartBlocks(assignChartIds(model)).find((b) => b.id === result.chartId) : undefined;
  if (block && resolveType(merged, block) === typeIdOf(block)) { // the type words only picked the chart's own form again: store nothing for them
    const { kind: _k, orientation: _o, grouping: _g, ...rest } = merged; return setChartConfig(view, result.chartId, rest, block);
  }
  return setChartConfig(view, result.chartId, merged, block);
}

