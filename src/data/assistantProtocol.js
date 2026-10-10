// ============================================================================
// Assistant answer protocol (10 steps). Pure.
//
//  1 question  2 period/scope/filters  3 sources & freshness  4 metric definition
//  5 calculation through the metric layer  6 matching / duplicates / exclusions check
//  7 facts vs hypotheses  8 explanation with evidence  9 suitable action  10 limits
//
// The language model never produces a total: every number below was computed by
// the shared metric layer in the analysis task that ran before this is called.
// An answer separates: calculated FACT · documented CAUSE · HYPOTHESIS to verify ·
// RECOMMENDATION, and carries period, scope, number, short definition, source and
// update date, and a link to the detail.
// ============================================================================
import { answerFor } from './assistantAnswers';
import { describeScope, pickBi } from './revenueInsights';
import { formatRatio, CATEGORY_LABELS } from './revenueMetrics';
import { fmtBn } from '../utils/money';
import { REVENUE_SOURCES } from './revenueLedger';

const BI = (ar, en) => ({ ar, en });
const cnt = (n) => Number(n || 0).toLocaleString('en-US');

export const AGING_BUCKETS = [
  { key: '0', from: -Infinity, to: 0, label: BI('لم يحن استحقاقه', 'Not yet due') },
  { key: '1-30', from: 1, to: 30, label: BI('1–30 يوماً', '1–30 days') },
  { key: '31-90', from: 31, to: 90, label: BI('31–90 يوماً', '31–90 days') },
  { key: '91-180', from: 91, to: 180, label: BI('91–180 يوماً', '91–180 days') },
  { key: '180+', from: 181, to: Infinity, label: BI('أكثر من 180 يوماً', 'Over 180 days') }
];

// Ageing from the DUE date (when there is one). Not-yet-due amounts are their own bucket, never arrears.
export function agingOf(snapshot) {
  // the data service returns the ageing buckets of the standing balance (computed from the due date)
  return AGING_BUCKETS.map((b, i) => ({ ...b, amount: snapshot.stock.aging[i]?.amount || 0, count: snapshot.stock.aging[i]?.count || 0 }));
}

// Concentration that respects size: amount AND the share of that entity's own net billed.
export function concentrationBy(snapshot, key) {
  const groups = key === 'amanah' ? snapshot.stock.byAmanah : snapshot.stock.bySource;
  const total = groups.reduce((s, g) => s + g.outstanding, 0);
  return groups.filter((g) => g.outstanding > 0).map((g) => ({
    key: g.key, label: g.label || null, outstanding: g.outstanding, shareOfTotal: total > 0 ? g.outstanding / total : 0,
    shareOfOwnNet: g.net > 0 ? g.outstanding / g.net : null, count: g.count
  })).sort((a, b) => b.outstanding - a.outstanding);
}

export function buildProtocolAnswer(intent, out, ctx) {
  const lang = ctx.lang || 'en';
  const ar = lang === 'ar';
  const L = (en, a) => (ar ? a : en);
  const M = (n) => fmtBn(n || 0, { lang });
  const snap = out.snapshot;
  const base = answerFor(intent === 'uncollected' || intent === 'why_decline' ? 'overview' : intent, out, ctx);
  if (!snap) return { ...base, sections: [], steps: [], meta: null };
  const T = snap.totals; const S = snap.stock;
  const result = out.result || null;
  const scopeTxt = describeScope(snap.scope, lang);
  const bridge = out.bridge || null;
  const sections = [];
  let text = base.text;
  const facts = [...base.facts];

  const netU = { k: L('Net uncollected (standing balance)', 'الرصيد القائم'), v: M(S.netUncollected) };

  if (intent === 'uncollected') {
    const st = (k) => bridge?.steps.find((x) => x.key === k);
    const lines = [];
    if (bridge) {
      lines.push(L(`Unpaid report (de-duplicated, ${bridge.reportDate}): ${M(st('report').amount)}`, `تقرير غير المسدد (بعد إزالة التكرار، ${bridge.reportDate}): ${M(st('report').amount)}`));
      lines.push(L(`Reconciliation differences (payments / credit notes since the report): ${M(st('reconciliation').amount)}`, `فروقات المطابقة (سداد/إشعارات منذ التقرير): ${M(st('reconciliation').amount)}`));
      lines.push(L(`Cancelled within the group: ${M(st('cancelled').amount)}`, `الملغى ضمن المجموعة: ${M(st('cancelled').amount)}`));
      lines.push(L(`Approved exclusions, non-overlapping with cancelled: ${M(st('excluded').amount)} (of which under unapproved rules ${M(st('excluded').detail.unapprovedRules)})`, `المستبعد المعتمد دون تداخل مع الملغى: ${M(st('excluded').amount)} (منه وفق قواعد غير معتمدة ${M(st('excluded').detail.unapprovedRules)})`));
      if (st('newInvoices').amount) lines.push(L(`Issued after the report and still unpaid: +${M(st('newInvoices').amount)}`, `صادر بعد التقرير وما زال غير مسدد: +${M(st('newInvoices').amount)}`));
      if (st('internal').amount) lines.push(L(`Internal scope (Amanah reports): +${M(st('internal').amount)}`, `النطاق الداخلي (تقارير الأمانات): +${M(st('internal').amount)}`));
      lines.push(L(`Net uncollected: ${M(bridge.net)}`, `الرصيد القائم: ${M(bridge.net)}`));
    }
    const aging = agingOf(snap).filter((b) => b.amount > 0).map((b) => `${pickBi(b.label, lang)}: ${M(b.amount)}`).join('؛ ');
    const am = concentrationBy(snap, 'amanah').slice(0, 3).map((g) => `${pickBi(g.label || { ar: g.key, en: g.key }, lang)}: ${M(g.outstanding)}${g.shareOfOwnNet != null ? ` (${Math.round(g.shareOfOwnNet * 100)}% ${L('of its own net billed to date', 'من صافي مفوترها حتى تاريخه')})` : ''}`).join('; ');
    const src = concentrationBy(snap, 'source').slice(0, 4).map((g) => `${REVENUE_SOURCES[g.key] ? pickBi(REVENUE_SOURCES[g.key], lang) : g.key}: ${M(g.outstanding)}`).join('; ');
    text = L(
      `${scopeTxt}. Net uncollected is ${M(S.netUncollected)} at ${snap.cutoff} (a standing balance of everything issued up to the cutoff, whatever the selected issue period): overdue ${M(S.overdue)}, not yet due ${M(S.notYetDue)} (future installments are never arrears). Bridge — ${lines.join(' → ')}. By age (from the due date): ${aging || '—'}. By Amanah: ${am || '—'}. By revenue source: ${src || '—'}.`,
      `${scopeTxt}. الرصيد القائم ${M(S.netUncollected)} عند ${snap.cutoff} (رصيد قائم لكل ما صدر حتى القطع بغض النظر عن فترة الإصدار المحددة): متأخر ${M(S.overdue)} ولم يحن استحقاقه ${M(S.notYetDue)} (الأقساط المستقبلية ليست متأخرات). الجسر — ${lines.join(' ← ')}. حسب العمر (من تاريخ الاستحقاق): ${aging || '—'}. حسب الأمانة: ${am || '—'}. حسب مصدر الإيراد: ${src || '—'}.`
    );
    facts.length = 0;
    facts.push(netU, { k: L('Overdue', 'متأخر'), v: M(S.overdue) }, { k: L('Not yet due', 'لم يحن'), v: M(S.notYetDue) }, { k: L('Cancelled', 'الملغى'), v: M(T.cancelled) }, { k: L('Rule-excluded', 'المستبعد بقواعد'), v: M(T.exclusionsRules) });
  } else if (intent === 'why_decline') {
    const ex = out.explanation;
    if (!ex) {
      text = L(`${scopeTxt}. The change explanation was not computed for this question.`, `${scopeTxt}. لم يُحتسب تفسير التغير لهذا السؤال.`);
    } else if (!ex.comparable) {
      text = L(`${scopeTxt}. A like-for-like comparison is not available, so I cannot say whether collection fell. ${pickBi(ex.needsVerification[0], 'en')}`, `${scopeTxt}. لا تتوفر مقارنة مماثلة لذا لا أستطيع القول إن التحصيل انخفض. ${pickBi(ex.needsVerification[0], 'ar')}`);
    } else {
      const d = ex.deltaPp;
      text = L(
        `${scopeTxt}. Collected ÷ net billed moved ${d == null ? 'by an amount that is not calculable' : `${d >= 0 ? '+' : ''}${d.toFixed(1)} percentage points`} versus ${ex.scopePrev.basis === 'same_period_last_year' ? 'the same period last year' : 'the previous period of equal length'} (${ex.scopePrev.from} → ${ex.scopePrev.to}). Measurable factors: ${ex.factors.map((f) => pickBi(f.text, 'en')).join(' ')} ${pickBi(ex.maturityCaveat, 'en')} No causal evidence is recorded: the reason payers changed behaviour needs verification.`,
        `${scopeTxt}. تغيّر المحصّل ÷ صافي المفوتر ${d == null ? 'بمقدار غير قابل للاحتساب' : `${d >= 0 ? '+' : ''}${d.toFixed(1)} نقطة مئوية`} مقابل ${ex.scopePrev.basis === 'same_period_last_year' ? 'نفس الفترة من العام السابق' : 'الفترة السابقة المماثلة'} (${ex.scopePrev.from} ← ${ex.scopePrev.to}). عوامل قابلة للقياس: ${ex.factors.map((f) => pickBi(f.text, 'ar')).join(' ')} ${pickBi(ex.maturityCaveat, 'ar')} لا يوجد دليل سببي مسجل: سبب تغير سلوك الدافعين يحتاج تحققاً.`
      );
      sections.push({ kind: 'hypothesis', title: BI('يحتاج تحققاً', 'Needs verification'), items: ex.needsVerification });
      out.explanation = ex;
    }
  } else if (intent === 'overview' || intent === 'target_coverage' || intent === 'amanah_compare') {
    text += ' ' + L(`Net uncollected (a standing balance, not the same as net billed) is ${M(S.netUncollected)}.`, `الرصيد القائم (رصيد قائم وليس هو صافي المفوتر) ${M(S.netUncollected)}.`);
    facts.push(netU);
  }

  // ---- separate fact / documented cause / hypothesis / recommendation ----
  const nc = snap.noncollection;
  const causes = [];
  if (T.cancelledCount) causes.push(BI(`${cnt(T.cancelledCount)} فاتورة ملغاة في المصدر (${M(T.cancelled)}).`, `${cnt(T.cancelledCount)} invoice(s) cancelled in the source (${M(T.cancelled)}).`));
  for (const [rule, n] of Object.entries(snap.exclusionReasonCounts)) causes.push(BI(`${cnt(n)} فاتورة تحمل سبب الاستبعاد ${rule}.`, `${cnt(n)} invoice(s) carry exclusion reason ${rule}.`));
  if (nc.objection.count) causes.push(BI(`${cnt(nc.objection.count)} فاتورة قيد اعتراض مفتوح (${M(nc.objection.amount)}).`, `${cnt(nc.objection.count)} invoice(s) under open objection (${M(nc.objection.amount)}).`));
  { const en = snap.stock?.enforcement; if (en && en.everReferred.count) causes.push(BI(`${cnt(en.inExecution.count)} فاتورة لها أمر غير مغلق و${cnt(en.closedOnly.count)} سبقت إحالتها وأُغلقت أوامرها — الإنفاذ بُعد منفصل ولا يغيّر حالة السداد.`, `${cnt(en.inExecution.count)} invoice(s) with an order that is not closed, ${cnt(en.closedOnly.count)} referred before with all orders closed — enforcement is a separate dimension and does not change the payment state.`)); }
  if (nc.linkage_unresolved.count) causes.push(BI(`${cnt(nc.linkage_unresolved.count)} فاتورة بحالة أو ربط عقد غير محسوم (${M(nc.linkage_unresolved.amount)}).`, `${cnt(nc.linkage_unresolved.count)} invoice(s) with unresolved status or contract linkage (${M(nc.linkage_unresolved.amount)}).`));
  sections.unshift({ kind: 'fact', title: BI('حقيقة محسوبة', 'Calculated fact'), body: text });
  if (causes.length && intent !== 'why_decline') sections.push({ kind: 'cause', title: BI('سبب موثق في السجلات', 'Documented in the records'), items: causes });
  if (result?.hypotheses?.length) sections.push({ kind: 'hypothesis', title: BI('فرضية تحتاج تحققاً', 'Hypothesis to verify'), items: result.hypotheses.map((h) => h.text) });
  if (result?.recommendations?.length) sections.push({ kind: 'recommendation', title: BI('توصية', 'Recommendation'), items: result.recommendations.slice(0, 3).map((r) => r.text) });
  const limits = [...(result?.missing || []).map((m) => m.text), ...(result?.limitations || [])];
  if (snap.unapprovedRulesApplied.length) limits.unshift(BI(`قواعد استبعاد غير معتمدة مطبّقة (${snap.unapprovedRulesApplied.join('، ')}) — النتائج المتأثرة بها غير معتمدة.`, `Unapproved exclusion rules applied (${snap.unapprovedRulesApplied.join(', ')}) — affected results are unapproved.`));
  if (limits.length) sections.push({ kind: 'limits', title: BI('حدود التحليل', 'Limits of the analysis'), items: limits });

  const def = {
    overview: BI('نسبة التحصيل = المحصّل ÷ صافي المفوتر × 100؛ صافي المفوتر = إجمالي المفوتر − الاستبعادات = المحصّل + غير المحصّل', 'Collection rate = collected ÷ net billed × 100; net billed = gross billed − exclusions = collected + uncollected'),
    uncollected: BI('الرصيد القائم = رصيد غير مسدد بعد المطابقة − الملغى − المستبعد غير المتداخل', 'Net uncollected = unpaid balance after matching − cancelled − non-overlapping exclusions'),
    why_decline: BI('تغير المحصّل ÷ صافي المفوتر بنقاط مئوية مقابل فترة مماثلة', 'Change in collected ÷ net billed, percentage points vs a like-for-like period'),
    exclusions: BI('الاستبعادات = الملغى + فواتير ذات سبب استبعاد معتمد (سبب رئيسي واحد، تُخصم مرة واحدة من إجمالي المفوتر)', 'Exclusions = cancelled + invoices with an approved exclusion (one primary reason; deducted once from gross billed)')
  };
  const headline = intent === 'uncollected' ? M(S.netUncollected) : intent === 'why_decline' ? (out.explanation?.deltaPp != null ? `${out.explanation.deltaPp.toFixed(1)} pp` : '—') : formatRatio(T.collectedOverNet, lang);
  const meta = {
    period: `${snap.scope.from} → ${snap.scope.to}`,
    scope: scopeTxt,
    number: headline,
    definition: def[intent] || def.overview,
    source: BI('تحصيل · فرص · سند · إيفاء · CR View (بيانات تجريبية)', 'Tahseel · Furas · Sanad · Efaa · CR View (demo data)'),
    updatedAt: snap.cutoff,
    ruleVersion: snap.ruleSetVersion,
    link: intent === 'uncollected' ? '/insights' : '/noncollection'
  };

  const steps = [
    { n: 1, title: BI('تحديد السؤال', 'Identify the question'), detail: BI(`النية: ${intent}`, `Intent: ${intent}`) },
    { n: 2, title: BI('تحديد الفترة والنطاق والمرشحات', 'Resolve period, scope and filters'), detail: BI(scopeTxt, scopeTxt) },
    { n: 3, title: BI('التحقق من المصادر وحداثتها', 'Check sources and freshness'), detail: BI(`آخر تاريخ مرجعي للبيانات ${snap.cutoff}؛ بيانات تجريبية`, `Reference data date ${snap.cutoff}; demo data`) },
    { n: 4, title: BI('اختيار تعريف المؤشر', 'Select the metric definition'), detail: def[intent] || def.overview },
    { n: 5, title: BI('الحساب عبر طبقة المقاييس', 'Calculate through the metric layer'), detail: BI(`${cnt(snap.population.issuedInPeriod)} فاتورة صادرة في الفترة؛ ${cnt(S.invoiceCount)} فاتورة ضمن الرصيد القائم`, `${cnt(snap.population.issuedInPeriod)} invoice(s) issued in the period; ${cnt(S.invoiceCount)} in the standing balance`) },
    { n: 6, title: BI('التحقق من المطابقة والتكرار والاستبعادات', 'Check matching, duplicates and exclusions'), detail: BI(bridge ? `${bridge.invoiceCountInReport} فاتورة في التقرير بعد إزالة التكرار؛ غير مطابق ${cnt(bridge.unmatched.count)}؛ تداخل ملغى/مستبعد ${cnt(T.overlapCount)}` : `ملغى ${cnt(T.cancelledCount)}؛ مستبعد ${cnt(T.excludedCount)}؛ تداخل ${cnt(T.overlapCount)}`, bridge ? `${bridge.invoiceCountInReport} report invoice(s) after de-duplication; unmatched ${cnt(bridge.unmatched.count)}; cancelled/excluded overlap ${cnt(T.overlapCount)}` : `cancelled ${cnt(T.cancelledCount)}; excluded ${cnt(T.excludedCount)}; overlap ${cnt(T.overlapCount)}`) },
    { n: 7, title: BI('فصل الحقائق عن الفرضيات', 'Separate facts from hypotheses'), detail: BI(`${sections.filter((s) => s.kind === 'fact' || s.kind === 'cause').length} قسم حقائق/أسباب موثقة؛ ${(result?.hypotheses || []).length} فرضية`, `${sections.filter((s) => s.kind === 'fact' || s.kind === 'cause').length} fact/documented-cause section(s); ${(result?.hypotheses || []).length} hypothesis(es)`) },
    { n: 8, title: BI('تفسير النتيجة مع الأدلة', 'Explain the result with evidence'), detail: BI(`${(result?.references || []).length} فاتورة مرجعية قابلة للفتح`, `${(result?.references || []).length} reference invoice(s) you can open`) },
    { n: 9, title: BI('اقتراح إجراء مناسب', 'Propose a suitable action'), detail: BI(`${(result?.recommendations || []).length} توصية (الأثر حد أعلى حسابي وليس تنبؤاً)`, `${(result?.recommendations || []).length} recommendation(s) (impact is an arithmetic upper bound, not a prediction)`) },
    { n: 10, title: BI('إظهار حدود التحليل', 'State the limits'), detail: BI(`${limits.length} حد/نقص معروض`, `${limits.length} limit(s)/gap(s) shown`) }
  ];

  return { text, facts, sections, steps, meta, bridge, explanation: out.explanation || null };
}
