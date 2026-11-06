// Assistant answer text. Pure: derived ONLY from the completed analysis task's
// output (shared snapshot / forecast / etc.). Every numeric answer states its
// scope and data cutoff. No KPI is hard-coded here.
import { compareSnapshots, formatRatio, CATEGORY_LABELS, NONCOLLECTION_CATEGORIES } from './revenueMetrics';
import { describeScope, pickBi } from './revenueInsights';
import { planPositionSentence } from './revenueOutlook';
import { REVENUE_SOURCES } from './revenueLedger';
import { fmtBn, fmtSar } from '../utils/money';

const cnt = (n) => Number(n || 0).toLocaleString('en-US');

export function scopeLine(scope, cutoff, lang) {
  const ar = lang === 'ar';
  return `${describeScope(scope, lang)} — ${ar ? 'قطع البيانات' : 'data cutoff'} ${cutoff}`;
}

export function answerFor(intent, out, { lang = 'en' } = {}) {
  const ar = lang === 'ar';
  const L = (en, a) => (ar ? a : en);
  const M = (n) => fmtBn(n || 0, { lang });
  const snap = out.snapshot;
  if (!snap) return { text: L('No analysis output is available.', 'لا يوجد ناتج تحليل.'), facts: [] };
  const T = snap.totals;
  const head = scopeLine(snap.scope, snap.cutoff, lang);
  const facts = [];
  let text = '';
  const demo = L('Illustrative demo data.', 'بيانات توضيحية.');

  // previous-period comparison (only when the previous period is inside the data coverage)
  let cmp = null;
  try {
    cmp = out.prevSnapshot ? compareSnapshots(out.currAtEnd || snap, out.prevSnapshot) : null;
  } catch { cmp = null; }
  const ppSentence = (() => {
    if (!cmp || !cmp.comparable || !cmp.collectedOverNetPp.calculable) return L('No like-for-like comparison with the previous period is available (it is outside the data coverage or not calculable).', 'لا تتوفر مقارنة مماثلة مع الفترة السابقة (خارج نطاق التغطية أو غير قابلة للاحتساب).');
    const v = cmp.collectedOverNetPp.value;
    return L(`Versus the previous period of equal length: ${v >= 0 ? '+' : ''}${v.toFixed(1)} percentage points on collected ÷ net billed (each period measured at its own end date — same age).`, `مقارنة بالفترة السابقة المماثلة: ${v >= 0 ? '+' : ''}${v.toFixed(1)} نقطة مئوية في المحصّل ÷ صافي المفوتر (كل فترة تُقاس عند نهايتها — العمر نفسه).`);
  })();

  if (intent === 'overview' || intent === 'target_coverage' || intent === 'amanah_compare') {
    const ratioN = formatRatio(T.collectedOverNet, lang);
    const basisEn = `Invoices issued in the period; collections up to ${snap.basis?.collectionsAsOf || snap.cutoff}${snap.basis?.collectionsMode === 'period_end' ? ' (the period end, like-for-like)' : ''}`;
    const basisAr = `الفواتير الصادرة في الفترة، والتحصيل حتى ${snap.basis?.collectionsAsOf || snap.cutoff}${snap.basis?.collectionsMode === 'period_end' ? ' (نهاية الفترة، مقارنة مماثلة)' : ''}`;
    text = L(
      `${head}. Gross billed ${M(T.gross)} = exclusions ${M(T.exclusions)} + net billed ${M(T.net)}; net billed ${M(T.net)} = collected ${M(T.collected)} + uncollected ${M(T.outstanding)}. Collection rate = collected ÷ net billed = ${ratioN}. Basis: ${basisEn}. Receipts dated in the period on invoices of any issue period are a separate indicator: ${M(snap.receivedInPeriod.total)}. ${ppSentence} ${demo}`,
      `${head}. إجمالي المفوتر ${M(T.gross)} = الاستبعادات ${M(T.exclusions)} + صافي المفوتر ${M(T.net)}؛ وصافي المفوتر ${M(T.net)} = المحصّل ${M(T.collected)} + غير المحصّل ${M(T.outstanding)}. نسبة التحصيل = المحصّل ÷ صافي المفوتر = ${ratioN}. الأساس: ${basisAr}. الإيرادات المحصلة حسب تاريخ الدفع داخل الفترة على فواتير أي فترة إصدار مؤشر مستقل: ${M(snap.receivedInPeriod.total)}. ${ppSentence} ${demo}`
    );
    if (intent === 'target_coverage') {
      const ach = out.achievement;
      const src = ach?.sourceLine ? ` ${pickBi(ach.sourceLine, lang)}.` : '';
      const dw = ach && ach.deviation != null ? (ach.deviation > 0 ? { en: 'above', ar: 'أعلى من' } : ach.deviation < 0 ? { en: 'below', ar: 'أقل من' } : { en: 'equal to', ar: 'مساوٍ لـ' }) : null;
      if (ach?.unavailable) text += ' ' + L(`The target is unavailable, so no achievement is shown: ${ach.unavailableText?.en || ach.unavailable}`, `المستهدف غير متاح فلا يُعرض تحقق: ${ach.unavailableText?.ar || ach.unavailable}`);
      else if (ach?.scopeCaveat) text += ' ' + L(`The plan target does not describe this narrower scope, so target achievement is not shown for it.${src}`, `مستهدف الخطة لا يصف هذا النطاق الأضيق، لذا لا يُعرض تحقق المستهدف له.${src}`);
      else if (ach) text += ' ' + L(`Achievement against the plan to date is ${formatRatio(ach.achievement, lang)} (receipts ${M(ach.receiptsYtd)} ÷ planned to date ${M(ach.targetYtd || 0)}); the deviation is ${M(Math.abs(ach.deviation ?? 0))} ${dw ? dw.en : ''} the plan to date.${src}${ach.targetScope === 'available' ? ' Target scope: total of the entities available to you.' : ''} This is not the annual goal set on the Strategic Dashboard.`, `نسبة الإنجاز مقابل المخطط حتى تاريخه ${formatRatio(ach.achievement, lang)} (الإيرادات المحصلة ${M(ach.receiptsYtd)} ÷ المخطط حتى تاريخه ${M(ach.targetYtd || 0)})؛ والانحراف ${M(Math.abs(ach.deviation ?? 0))} ${dw ? dw.ar : ''} المخطط حتى تاريخه.${src}${ach.targetScope === 'available' ? ' نطاق المستهدف: إجمالي الجهات المتاحة لك.' : ''} وهذا غير هدف التحصيل السنوي المحدد في لوحة تخطيط إيرادات التحصيل.`);
    }
    if (intent === 'amanah_compare') {
      const rows = snap.byAmanah.filter((g) => g.net > 0);
      const best = [...rows].sort((a, b) => (b.collectedOverNet.value ?? -1) - (a.collectedOverNet.value ?? -1))[0];
      const worst = [...rows].sort((a, b) => (a.collectedOverNet.value ?? 2) - (b.collectedOverNet.value ?? 2))[0];
      const biggest = [...snap.byAmanah].sort((a, b) => b.outstanding - a.outstanding)[0];
      if (best && worst) text += ' ' + L(`By Amanah: highest collected ÷ net ${pickBi(best.label, 'en')} (${formatRatio(best.collectedOverNet, 'en', 0)}, n=${cnt(best.count)}); lowest ${pickBi(worst.label, 'en')} (${formatRatio(worst.collectedOverNet, 'en', 0)}, n=${cnt(worst.count)}). Largest outstanding balance: ${pickBi(biggest.label, 'en')} (${M(biggest.outstanding)}). Small populations make rates volatile — rank by amount and evidence, not by rate alone.`, `حسب الأمانة: أعلى محصّل ÷ صافي ${pickBi(best.label, 'ar')} (${formatRatio(best.collectedOverNet, 'ar', 0)}، n=${cnt(best.count)})؛ وأدنى ${pickBi(worst.label, 'ar')} (${formatRatio(worst.collectedOverNet, 'ar', 0)}، n=${cnt(worst.count)}). أكبر رصيد متبقٍ: ${pickBi(biggest.label, 'ar')} (${M(biggest.outstanding)}). المجموعات الصغيرة تجعل النسب متقلبة — رتّب بالمبلغ والدليل وليس بالنسبة وحدها.`);
    }
    facts.push({ k: L('Gross billed', 'إجمالي المفوتر'), v: M(T.gross) }, { k: L('Exclusions', 'الاستبعادات'), v: M(T.exclusions) }, { k: L('Net billed', 'صافي المفوتر'), v: M(T.net) }, { k: L('Collected', 'المحصّل'), v: M(T.collected) }, { k: L('Uncollected', 'غير المحصّل'), v: M(T.outstanding) }, { k: L('Collection rate', 'نسبة التحصيل'), v: ratioN });
  } else if (intent === 'noncollection') {
    const nc = snap.noncollection;
    const parts = NONCOLLECTION_CATEGORIES.filter((c) => nc[c].count && c !== 'excluded').map((c) => `${pickBi(CATEGORY_LABELS[c], lang)}: ${cnt(nc[c].count)} / ${M(nc[c].amount)}`);
    text = L(
      `${head}. Uncollected ${M(T.outstanding)} (= net billed ${M(T.net)} − collected ${M(T.collected)}). By invoice state — ${parts.join('; ') || 'none'}. These are states read from the records. The data does not record why a payer has not paid, so the cause of non-payment could not be established; possible reasons (cash-flow, dispute, administrative delay) are hypotheses to verify. Approved exclusions (${M(T.exclusions)}) are removed from the denominator and are not declared uncollectible. ${demo}`,
      `${head}. غير المحصّل ${M(T.outstanding)} (= صافي المفوتر ${M(T.net)} − المحصّل ${M(T.collected)}). حسب حالة الفاتورة — ${parts.join('؛ ') || 'لا شيء'}. هذه حالات مقروءة من السجلات. لا تسجل البيانات سبب عدم سداد الدافع، لذا تعذّر إثبات السبب؛ والأسباب المحتملة (سيولة، نزاع، تأخر إداري) فرضيات تحتاج تحققاً. الاستبعادات المعتمدة (${M(T.exclusions)}) خارج المقام ولا تُعدّ غير قابلة للتحصيل. ${demo}`
    );
    facts.push({ k: L('Uncollected', 'غير المحصّل'), v: M(T.outstanding) }, { k: L('Overdue', 'متأخرة'), v: M(nc.overdue.amount + nc.partial.amount) }, { k: L('Under objection', 'قيد الاعتراض'), v: M(nc.objection.amount) });
  } else if (intent === 'exclusions') {
    const cats = Object.entries(snap.exclusionsByCategory).map(([k, e]) => `${k.replace(/_/g, ' ')}: ${cnt(e.count)} / ${M(e.amount)}`);
    text = L(
      `${head}. Exclusions total ${M(T.exclusions)}: cancelled ${M(T.cancelled)} (${cnt(T.cancelledCount)} invoices) + approved rules ${M(T.exclusionsRules)} (${cnt(T.excludedCount)} invoices${cats.length ? ` — ${cats.join('; ')}` : ''}). Each is deducted once from gross billed ${M(T.gross)}, leaving net billed ${M(T.net)}; they are not deducted again from net billed or uncollected, and several reasons on one invoice never deduct twice. Collection rate = collected ÷ net billed = ${formatRatio(T.collectedOverNet, 'en')}. Exclusion does not mean uncollectible. ${snap.quality.pendingExclusions.length} candidate(s) await review and stay in net billed until approved. Objection and enforcement referral are not exclusions. ${demo}`,
      `${head}. إجمالي الاستبعادات ${M(T.exclusions)}: ملغى ${M(T.cancelled)} (${cnt(T.cancelledCount)} فاتورة) + قواعد استبعاد معتمدة ${M(T.exclusionsRules)} (${cnt(T.excludedCount)} فاتورة${cats.length ? ` — ${cats.join('؛ ')}` : ''}). يُخصم كل منها مرة واحدة من إجمالي المفوتر ${M(T.gross)} فيبقى صافي المفوتر ${M(T.net)}؛ ولا تُخصم مجدداً من الصافي أو غير المحصّل، وتعدد أسباب الاستبعاد لنفس الفاتورة لا يكرر الخصم. نسبة التحصيل = المحصّل ÷ صافي المفوتر = ${formatRatio(T.collectedOverNet, 'ar')}. الاستبعاد لا يعني عدم القابلية للتحصيل. ${snap.quality.pendingExclusions.length} مرشح بانتظار المراجعة ويبقى ضمن صافي المفوتر حتى الاعتماد. الاعتراض والإحالة للتنفيذ ليسا استبعاداً. ${demo}`
    );
    facts.push({ k: L('Exclusions (total)', 'الاستبعادات (الإجمالي)'), v: M(T.exclusions) }, { k: L('of which cancelled', 'منها ملغى'), v: M(T.cancelled) }, { k: L('of which approved rules', 'منها قواعد معتمدة'), v: M(T.exclusionsRules) }, { k: L('Pending review', 'بانتظار المراجعة'), v: String(snap.quality.pendingExclusionCount) });
  } else if (intent === 'forecast') {
    const f = out.forecast; const tp = out.targetPos;
    if (!f?.ready) {
      text = `${head}. ${pickBi(f?.reasonNotReady || { en: 'The forecast is not available for this scope.', ar: 'التنبؤ غير متاح لهذا النطاق.' }, lang)}`;
    } else {
      // ONE forecast (planning review 0d): the planning page's baseline — complete months only, the rest of the cut-off month by days, no range and no probability; the target is the planning page's (illustrative until approved)
      const win = f.method.window?.months || [];
      const tgtEn = tp && tp.annualTarget != null ? `For reference, the annual revenue target of the plan (${pickBi(tp.targetSourceLine || { en: 'plan', ar: 'الخطة' }, 'en')}; an input independent of the forecast) is ${M(tp.annualTarget)} against a projected full year of ${M(tp.projectedTotal)} (${tp.forecastAchievementPct != null ? `${(tp.forecastAchievementPct * 100).toFixed(1)}% of the target` : ''}). ${planPositionSentence(tp, M, 'en')} ` : tp ? `${planPositionSentence(tp, M, 'en')} ` : '';
      const tgtAr = tp && tp.annualTarget != null ? `للمرجع، المستهدف السنوي للإيراد في الخطة (${pickBi(tp.targetSourceLine || { en: 'plan', ar: 'الخطة' }, 'ar')}؛ مُدخل مستقل عن التنبؤ) ${M(tp.annualTarget)} مقابل سنة متوقعة ${M(tp.projectedTotal)} (${tp.forecastAchievementPct != null ? `${(tp.forecastAchievementPct * 100).toFixed(1)}% من المستهدف` : ''}). ${planPositionSentence(tp, M, 'ar')} ` : tp ? `${planPositionSentence(tp, M, 'ar')} ` : '';
      text = L(
        `${head}. Forecast of receipts for ${f.horizon.months[0]} to ${f.horizon.months[f.horizon.months.length - 1]}: ${M(f.fiscalYear.projectedRemainder)}. Method ${f.method.id}: ${pickBi(f.method.label, 'en')}${win.length ? ` (window ${win[0]} to ${win[win.length - 1]})` : ''}; the rest of the current month is added by days. ${pickBi(f.method.alignment, 'en')}. No range and no probability of reaching the target are given: the history cannot validate them. ${f.backtest ? `Measured backtest n=${f.backtest.n}${f.backtest.mape != null ? `, MAPE ${(f.backtest.mape * 100).toFixed(0)}%` : ''} (small sample).` : 'No measured backtest is possible, so no accuracy is claimed.'} ${tgtEn}${demo}`,
        `${head}. التنبؤ بالإيرادات المحصلة من ${f.horizon.months[0]} إلى ${f.horizon.months[f.horizon.months.length - 1]}: ${M(f.fiscalYear.projectedRemainder)}. المنهج ${f.method.id}: ${pickBi(f.method.label, 'ar')}${win.length ? ` (النافذة ${win[0]} إلى ${win[win.length - 1]})` : ''}؛ ويُضاف المتبقي من الشهر الحالي بالأيام. ${pickBi(f.method.alignment, 'ar')}. لا يُقدَّم نطاق ولا احتمالية لبلوغ المستهدف: فالسجل لا يتيح التحقق منهما. ${f.backtest ? `اختبار رجعي مقاس n=${f.backtest.n}${f.backtest.mape != null ? `، متوسط الخطأ النسبي ${(f.backtest.mape * 100).toFixed(0)}%` : ''} (عينة صغيرة).` : 'لا يمكن إجراء اختبار رجعي مقاس لذا لا تُدّعى نسبة دقة.'} ${tgtAr}${demo}`
      );
      facts.push({ k: L('Forecast (rest of year)', 'التنبؤ (بقية السنة)'), v: M(f.fiscalYear.projectedRemainder) }, { k: L('Method', 'المنهج'), v: f.method.id });
    }
  } else if (intent === 'invoice') {
    const x = out.result?.extra;
    const rec = out.invoice?.rec;
    const MI = (n) => fmtSar(n || 0);
    if (!rec || !x) text = L('That invoice is not available in your access scope.', 'هذه الفاتورة غير متاحة ضمن نطاق صلاحيتك.');
    else {
      const d = out.invoice.derived;
      const cl = { c: { primary: out.invoice.cls } };
      text = L(
        `Invoice ${rec.id} (${rec.amanahEn}, ${REVENUE_SOURCES[rec.revenueSource].en}): billed ${MI(rec.grossAmount)} per the source header, collected ${MI(d?.collected || 0)}, outstanding ${MI(d?.outstanding || 0)}; due ${rec.dueDate}; state: ${cl ? (cl.c.primary === 'collected' ? 'collected' : pickBi(CATEGORY_LABELS[cl.c.primary], 'en')) : '—'}. ${rec.amountCheck?.status === 'conflict' ? `Amount conflict: header ${MI(rec.amountCheck.headerAmount)} vs line items ${MI(rec.amountCheck.lineTotal)} (+VAT ${MI(rec.amountCheck.vatDeclared || 0)}) — unresolved and not corrected.` : rec.amountCheck?.status === 'not_checkable' ? 'No line-item evidence, so the amount could not be cross-checked.' : 'Header amount agrees with line items.'} ${rec.exclusion ? `Exclusion record: ${rec.exclusion.category.replace(/_/g, ' ')} (${rec.exclusion.reviewStatus}).` : ''} Source: ${demo}`,
        `الفاتورة ${rec.id} (${rec.amanahAr}، ${REVENUE_SOURCES[rec.revenueSource].ar}): المفوتر ${MI(rec.grossAmount)} وفق رأس المصدر، المحصّل ${MI(d?.collected || 0)}، المتبقي ${MI(d?.outstanding || 0)}؛ الاستحقاق ${rec.dueDate}؛ الحالة: ${cl ? (cl.c.primary === 'collected' ? 'محصّلة' : pickBi(CATEGORY_LABELS[cl.c.primary], 'ar')) : '—'}. ${rec.amountCheck?.status === 'conflict' ? `تعارض مبلغ: الرأس ${MI(rec.amountCheck.headerAmount)} مقابل البنود ${MI(rec.amountCheck.lineTotal)} (+ضريبة ${MI(rec.amountCheck.vatDeclared || 0)}) — غير محسوم ولم يُصحَّح.` : rec.amountCheck?.status === 'not_checkable' ? 'لا توجد بنود تفصيلية لذا تعذّر التحقق من المبلغ.' : 'مبلغ الرأس يتفق مع البنود.'} ${rec.exclusion ? `سجل استبعاد: ${rec.exclusion.category.replace(/_/g, ' ')} (${rec.exclusion.reviewStatus}).` : ''} المصدر: ${demo}`
      );
    }
  } else {
    text = out.result?.executiveSummary ? pickBi(out.result.executiveSummary, lang) : '';
  }
  return { text, facts };
}
