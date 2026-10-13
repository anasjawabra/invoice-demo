// ============================================================================
// Analysis task runner.
//
// A task is a list of REAL stage functions executed in order over the shared
// revenue layer. Progress is derived from execution state only:
//   * stage status (upcoming / active / completed / failed / skipped / cancelled)
//   * measurable units (records validated, cases reviewed) when a stage really
//     iterates over a countable set
// There is no timer-driven percentage and no estimated completion time. When
// `paceMs` > 0 the runner waits that long between stages purely so a viewer can
// read them on instant in-browser demo data; this is disclosed in `state.paced`.
//
// Task states: queued, running, completed, completed_with_limitations,
// failed, cancelled.
// ============================================================================
import { normalizeConfig, normalizeScope, scopeKey, previousScope, targetAchievementFrom, DEFAULT_TARGETS } from '../data/revenueMetrics';
import { forecastReceipts, targetVsForecast } from '../data/revenueOutlook';
import { buildDecisionCards, buildAnalysisResult, bi, money, mAr, worklistRows, anomalyRows, describeScope } from '../data/revenueInsights';
import { caseSummary } from '../data/enforcementMatching';
import { explainChange } from '../data/changeExplanation';
import { loadComparison } from '../data/comparison';

// The task runner never sees invoices: every figure comes from the data service through `ctx.data`
// ({ snapshot, bridge, series, worklist, anomalies, invoice, contracts }).
const countFmt = (n) => Number(n || 0).toLocaleString('en-US');
const scopeOnly = (sc) => ({ from: sc.from, to: sc.to, amanah: sc.amanah, source: sc.source, scopeType: sc.scopeType, muni: sc.muni, status: sc.status });
const getSnapshot = async (ctx) => { if (!ctx.snapshot) ctx.snapshot = await ctx.data.snapshot(scopeOnly(ctx.scope)); return ctx.snapshot; };
const runForecast = (ctx, o) => forecastReceipts(ctx.data, scopeOnly(ctx.scope), ctx.cfg, o);
const getBridge = async (ctx) => { if (!ctx.bridge) ctx.bridge = await ctx.data.bridge({ amanah: ctx.scope.amanah, source: ctx.scope.source, scopeType: ctx.scope.scopeType, muni: ctx.scope.muni, status: ctx.scope.status, from: '2000-01-01', to: ctx.cfg.cutoff }); return ctx.bridge; };

export const TASK_STATUS = ['queued', 'running', 'completed', 'completed_with_limitations', 'failed', 'cancelled'];

const tick = () => new Promise((r) => setTimeout(r, 0));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- Stage library ---------- */
const S = {
  scope: (extra) => ({
    id: 'scope',
    label: bi('Understand the request and scope', 'فهم الطلب والنطاق'),
    active: bi('Resolving period, Amanah, revenue source and access scope', 'تحديد الفترة والأمانة ومصدر الإيراد ونطاق الصلاحية'),
    async run(ctx, h) {
      const sc = ctx.scope;
      if (sc.from > sc.to) throw new Error('invalid_period');
      const inv = !!ctx.params?.invoiceId;
      const snap = inv ? null : await getSnapshot(ctx);
      const accessible = snap ? snap.population.ledgerInScope : 1;
      const issuedN = snap ? snap.population.issuedInPeriod : 1;
      if (snap) h.detail(bi(`${countFmt(accessible)} record(s) accessible; ${countFmt(issuedN)} invoice(s) issued in the selected period`, `${countFmt(accessible)} سجلاً متاحاً؛ ${countFmt(issuedN)} فاتورة صادرة في الفترة المحددة`));
      if (!issuedN && !ctx.params?.invoiceId && !ctx.params?.enforceNum) {
        h.warn(bi('No invoices are issued in this scope (check the period, filters and access permissions).', 'لا توجد فواتير صادرة في هذا النطاق (تحقق من الفترة والمرشحات والصلاحيات).'), { limitation: true });
        ctx.empty = true;
      }
      if (extra) await extra(ctx, h);
    }
  }),
  retrieve: {
    id: 'retrieve',
    label: bi('Read the data', 'قراءة البيانات'),
    active: bi('Validating required fields, duplicates and amounts in the data service', 'التحقق من الحقول المطلوبة والتكرار والمبالغ في خدمة البيانات'),
    async run(ctx, h) {
      if (ctx.failAt === 'retrieve:0') throw new Error('injected_failure');
      const snap = await getSnapshot(ctx);
      const q = snap.quality;
      const checked = snap.population.issuedInPeriod;
      h.units(checked, checked);
      ctx.validation = { checked, duplicates: [], invalid: q.missingFieldCount || 0 };
      if (q.missingFieldCount) h.warn(bi(`${countFmt(q.missingFieldCount)} record(s) have mandatory fields missing; they stay in the calculations and are flagged.`, `${countFmt(q.missingFieldCount)} سجلاً بحقول إلزامية ناقصة؛ تبقى في الحسابات وتُعلَّم.`), { limitation: true });
      if (q.amountConflictCount) h.warn(bi(`${countFmt(q.amountConflictCount)} amount conflict(s) between header and line items (e.g. ${q.amountConflicts.slice(0, 4).join(', ')}).`, `${countFmt(q.amountConflictCount)} تعارض في المبالغ بين رأس الفاتورة وبنودها (مثل ${q.amountConflicts.slice(0, 4).join('، ')}).`), { limitation: true });
      h.detail(bi(`${countFmt(checked)} invoice(s) checked`, `تم فحص ${countFmt(checked)} فاتورة`));
    }
  },
  calculate: {
    id: 'calculate',
    label: bi('Calculate indicators', 'حساب المؤشرات'),
    active: bi('Computing gross, exclusions, net, collected and outstanding with the shared metric layer', 'احتساب الإجمالي والاستبعادات والصافي والمحصّل والمتبقي بطبقة المؤشرات المشتركة'),
    async run(ctx, h) {
      const snap = await getSnapshot(ctx);
      const t = snap.totals;
      // Reconciliation: every breakdown must sum to the total.
      const sumA = snap.byAmanah.reduce((s, g) => s + g.gross, 0);
      const sumS = snap.bySource.reduce((s, g) => s + g.gross, 0);
      if (Math.abs(sumA - t.gross) > 0.5 || Math.abs(sumS - t.gross) > 0.5) throw new Error('reconciliation_failed');
      if (!snap.equation?.ok) throw new Error('reconciliation_failed'); // gross = exclusions + net; net = collected + uncollected; per Amanah / source / scope type too
      if (Math.abs(t.gross - t.exclusions - t.net) > 0.5 || Math.abs(t.net - t.collected - t.outstanding) > 0.5) throw new Error('reconciliation_failed');
      // the numeric bridge (unpaid report → net uncollected) must land exactly on the snapshot stock
      await getBridge(ctx);
      if (Math.abs(ctx.bridge.check) > 0.5 || Math.abs(ctx.bridge.net - snap.stock.netUncollected) > 0.5) throw new Error('reconciliation_failed');
      if (!ctx.params?.invoiceId) {
        const cmp = await loadComparison(ctx.data, scopeOnly(ctx.scope), ctx.cfg, snap);
        ctx.prevSnapshot = cmp.prev; ctx.currAtEnd = cmp.curr;
        if (ctx.params?.q === 'why_decline') ctx.explanation = await explainChange(ctx.data, ctx.scope, ctx.cfg, { curr: cmp.curr, prev: cmp.prev });
      }
      h.detail(bi('Breakdowns and the net-uncollected bridge reconcile to the totals', 'التفصيلات وجسر الرصيد القائم تتطابق مع الإجماليات'));
      if (!t.collectedOverNet.calculable) h.warn(bi('Collected ÷ net billed is not calculable (net billed is zero).', 'المحصّل ÷ صافي المفوتر غير قابل للاحتساب (صافي المفوتر صفر).'), { limitation: true });
      ctx.targets = ctx.targets || DEFAULT_TARGETS;
      const through = ctx.scope.to < ctx.cfg.cutoff ? ctx.scope.to : ctx.cfg.cutoff;
      const fy = await ctx.data.series({ ...scopeOnly(ctx.scope), from: `${ctx.targets.fiscalYear}-01-01`, to: through }, { asOf: through });
      ctx.achievement = targetAchievementFrom(fy, ctx.scope, ctx.cfg, ctx.targets);
      if (ctx.achievement.scopeCaveat) h.warn(bi('The annual target is national; it is not allocated to this narrower scope, so target achievement is shown for context only.', 'المستهدف السنوي وطني وغير موزع على هذا النطاق الأضيق، لذا يُعرض تحقق المستهدف للسياق فقط.'), { limitation: true });
    }
  },
  match: {
    id: 'match',
    label: bi('Match invoices', 'مطابقة الفواتير'),
    active: bi('Collapsing report lines to one row per invoice and linking them to the invoice-details report', 'تجميع بنود التقرير في صف واحد لكل فاتورة وربطها ببيان تفاصيل الفواتير'),
    async run(ctx, h) {
      const b = await getBridge(ctx);
      h.units(b.invoiceCountInReport - b.unmatched.count, b.invoiceCountInReport);
      await tick(); h.check();
      h.detail(bi(`${countFmt(b.lineCount)} report line(s) → ${countFmt(b.invoiceCountInReport)} invoice(s); repeated invoice value removed (${money(b.inflation)})`, `${countFmt(b.lineCount)} بنداً في التقرير ← ${countFmt(b.invoiceCountInReport)} فاتورة؛ أُزيلت القيمة المكررة (${mAr(b.inflation)})`));
      if (b.unmatched.count) h.warn(bi(`${b.unmatched.count} report invoice(s) worth ${money(b.unmatched.amount)} could not be matched to the details report. They are shown separately and are neither deducted nor added to the net.`, `${b.unmatched.count} فاتورة في التقرير بقيمة ${mAr(b.unmatched.amount)} تعذّرت مطابقتها مع بيان التفاصيل. تُعرض منفصلة ولا تُخصم ولا تُضاف إلى الصافي.`), { limitation: true });
      else if (b.unmatched.scopedOut) h.warn(bi('Report-only invoices carry no Amanah, so they are not attributed to this narrower scope (shown in the national view).', 'فواتير التقرير غير المطابقة لا تحمل أمانة لذا لا تُنسب لهذا النطاق الأضيق (تظهر في العرض الوطني).'), { limitation: false });
    }
  },
  exclusionsReview: {
    id: 'exclusions',
    label: bi('Check cancelled invoices and exclusions', 'التحقق من الملغى والاستبعادات'),
    active: bi('Checking approved exclusions, pending candidates and enforcement links', 'فحص الاستبعادات المعتمدة والمرشحين المعلقين وروابط الإنفاذ'),
    async run(ctx, h) {
      const snap = await getSnapshot(ctx);
      const pending = snap.quality.pendingExclusionCount;
      const cases = ctx.cases || [];
      const states = cases.map((c) => caseSummary(c).state);
      ctx.caseStates = states;
      h.units(0, cases.length || 1);
      for (let i = 0; i < cases.length; i += 1) { h.units(i + 1, cases.length); if (i % 3 === 2) { await tick(); h.check(); } }
      const T = snap.totals;
      if (T.cancelledCount) h.detail(bi(`${T.cancelledCount} cancelled invoice(s) · ${money(T.cancelled)}; ${T.overlapCount} also carry an exclusion reason (deducted once, as cancelled)`, `${T.cancelledCount} فاتورة ملغاة · ${mAr(T.cancelled)}؛ منها ${T.overlapCount} لها سبب استبعاد أيضاً (تُخصم مرة واحدة كملغاة)`));
      if (snap.unapprovedRulesApplied.length) h.warn(bi(`Exclusion rules applied without business approval: ${snap.unapprovedRulesApplied.join(', ')} (${money(T.exclusionsUnapproved)}). The result is shown as "unapproved".`, `قواعد استبعاد مطبّقة دون اعتماد: ${snap.unapprovedRulesApplied.join('، ')} (${mAr(T.exclusionsUnapproved)}). تُعرض النتيجة بوصفها "غير معتمدة".`), { limitation: true });
      if (pending) h.warn(bi(`${pending} exclusion candidate(s) are not yet approved and stay in net billed.`, `${pending} مرشح استبعاد غير معتمد بعد ويبقى ضمن صافي المفوتر.`), { limitation: false });
      if (!cases.length) h.skipNote(bi('No enforcement cases available.', 'لا توجد قضايا إنفاذ متاحة.'));
      h.detail(bi(`${Object.keys(snap.exclusionsByCategory).length} exclusion categor(ies) applied; ${states.filter((s) => s !== 'linked').length} enforcement order(s) not fully matched to invoices`, `${Object.keys(snap.exclusionsByCategory).length} فئة استبعاد مطبّقة؛ ${states.filter((s) => s !== 'linked').length} أمر إنفاذ غير مطابق بالكامل مع الفواتير`));
    }
  },
  gaps: (label) => ({
    id: 'gaps',
    label: label || bi('Analyze the results', 'تحليل النتائج'),
    active: bi('Classifying noncollection by state and collecting supporting invoices', 'تصنيف عدم التحصيل حسب الحالة وجمع الفواتير الداعمة'),
    async run(ctx, h) {
      const snap = await getSnapshot(ctx);
      const [wl, an] = await Promise.all([ctx.data.worklist(scopeOnly(ctx.scope), 100), ctx.data.anomalies(scopeOnly(ctx.scope), 100)]);
      ctx.worklistTotal = wl.total;
      ctx.worklist = worklistRows(wl);
      ctx.anomalies = anomalyRows(an);
      ctx.references = wl.rows.slice(0, 8).map((r) => ({ id: r.id, outstanding: r.outstanding, category: r.category }));
      ctx.cards = buildDecisionCards(snap, { enforcementCases: ctx.cases || [] });
      h.detail(bi(`${countFmt(wl.total)} outstanding invoice(s) in the collection worklist (top ${ctx.worklist.length} ranked); ${countFmt(an.total)} in the data-quality worklist`, `${countFmt(wl.total)} فاتورة متبقية في قائمة التحصيل (أعلى ${ctx.worklist.length} مرتبة)؛ ${countFmt(an.total)} في قائمة جودة البيانات`));
    }
  }),
  prepare: (kind) => ({
    id: 'prepare',
    label: bi('Prepare recommendations', 'إعداد التوصيات'),
    active: bi('Separating facts, calculated results, hypotheses and recommendations', 'فصل الحقائق والنتائج المحسوبة والفرضيات والتوصيات'),
    async run(ctx, h) {
      ctx.result = buildAnalysisResult(kind, {
        snapshot: ctx.snapshot,
        bridge: ctx.bridge || null,
        references: ctx.references || [],
        forecast: ctx.forecast || null,
        targetPos: ctx.targetPos || null,
        achievement: ctx.achievement || null,
        cards: ctx.cards || [],
        enforcementCases: ctx.cases || [],
        invoiceId: ctx.params?.invoiceId || null,
        limitations: ctx.extraLimitations || []
      });
      if (ctx.extra) ctx.result.extra = ctx.extra;
      h.detail(bi('Findings ready', 'النتائج جاهزة'));
    }
  })
};

/* ---------- Task definitions ---------- */
export const TASK_KINDS = {
  revenue: {
    title: bi('Analyzing revenue performance', 'جارٍ تحليل أداء الإيرادات'),
    stages: () => [S.scope(), S.retrieve, S.match, S.exclusionsReview, S.calculate, S.gaps(), S.prepare('revenue')],
    modal: true
  },
  noncollection: {
    title: bi('Analyzing reasons for noncollection', 'جارٍ تحليل أسباب عدم التحصيل'),
    stages: () => [S.scope(), S.retrieve, S.match, S.exclusionsReview, S.calculate, S.gaps(), S.prepare('noncollection')],
    modal: true
  },
  exclusions: {
    title: bi('Reviewing exclusions', 'جارٍ مراجعة الاستبعادات'),
    stages: () => [S.scope(), S.retrieve, S.match, S.exclusionsReview, S.calculate, S.prepare('exclusions')],
    modal: true
  },
  invoice: {
    title: bi('Analyzing invoice', 'جارٍ تحليل الفاتورة'),
    stages: () => [
      S.scope(async (ctx, h) => {
        const id = ctx.params?.invoiceId;
        let det = null;
        try { det = await ctx.data.invoice(id); } catch (e) { if (e.name === 'AbortError' || e.cancelled) throw e; det = null; }
        if (!det?.rec) throw new Error('invoice_not_accessible');
        const rec = det.rec;
        ctx.invoice = rec; ctx.invoiceDetail = det;
        // An invoice analysis ignores the period filter: it is about one record.
        ctx.scope = { ...ctx.scope, from: '2000-01-01', to: ctx.cfg.cutoff };
        h.detail(bi(`Invoice ${id} located`, `تم تحديد الفاتورة ${id}`));
      }),
      {
        id: 'retrieve',
        label: bi('Retrieve invoice, payments and links', 'استرجاع الفاتورة والمدفوعات والروابط'),
        active: bi('Loading the invoice with its items, payments and links', 'تحميل الفاتورة مع بنودها ومدفوعاتها وروابطها'),
        async run(ctx, h) {
          const rec = ctx.invoice;
          h.units(1, 1);
          h.detail(bi(`${rec.id}: ${rec.lineItems.length} item(s), ${rec.payments.length} payment(s)`, `${rec.id}: ${rec.lineItems.length} بنداً، ${rec.payments.length} دفعة`));
        }
      },
      S.calculate,
      {
        id: 'invoice_evidence',
        label: bi('Check amounts, exclusions and links', 'فحص المبالغ والاستبعادات والروابط'),
        active: bi('Comparing header amount with line items and checking exclusion, contract and enforcement links', 'مقارنة مبلغ الفاتورة مع بنودها وفحص الاستبعاد والعقد والإنفاذ'),
        async run(ctx, h) {
          const rec = ctx.invoice;
          ctx.extra = { invoiceId: rec.id, derived: ctx.invoiceDetail?.derived, amountCheck: rec.amountCheck, exclusion: rec.exclusion, contract: rec.contract, enforcementLinks: rec.enforcementLinks, objection: rec.objection, missingFields: rec.missingFields };
          if (rec.amountCheck?.status === 'conflict') h.warn(bi(`Amount conflict on ${rec.id}: header ${money(rec.amountCheck.headerAmount)} vs line items ${money(rec.amountCheck.lineTotal)}.`, `تعارض مبلغ في ${rec.id}: ${money(rec.amountCheck.headerAmount)} مقابل ${money(rec.amountCheck.lineTotal)} للبنود.`), { limitation: true });
          if (rec.amountCheck?.status === 'not_checkable') h.warn(bi('No line-item evidence is available, so the amount could not be cross-checked.', 'لا تتوفر بنود تفصيلية للمطابقة لذا تعذّر التحقق من المبلغ.'), { limitation: true });
          h.detail(bi('Evidence collected', 'تم جمع الأدلة'));
        }
      },
      S.prepare('invoice')
    ],
    modal: true
  },
  forecast: {
    title: bi('Generating the independent forecast', 'جارٍ إعداد التنبؤ المستقل'),
    stages: () => [
      S.scope(),
      S.retrieve,
      S.calculate,
      {
        id: 'forecast_fit',
        label: bi('Fit trend and measure backtest', 'مُلاءمة الاتجاه وقياس الاختبار الرجعي'),
        active: bi('Fitting the trend on trailing receipts and running the one-step backtest; the target is not used', 'مُلاءمة الاتجاه على الإيرادات المحصلة السابقة وتشغيل الاختبار الرجعي؛ دون استخدام المستهدف'),
        async run(ctx, h) {
          ctx.forecast = await runForecast(ctx, { targets: ctx.targets || DEFAULT_TARGETS });
          if (!ctx.forecast.ready) h.warn(ctx.forecast.reasonNotReady, { limitation: true });
          if (ctx.forecast.exceptional.length) h.warn(bi(`${ctx.forecast.exceptional.length} exceptional large payment(s) removed from the fitted series and shown separately.`, `${ctx.forecast.exceptional.length} دفعة استثنائية كبيرة أُزيلت من السلسلة المُلائمة وتُعرض منفصلة.`), { limitation: false });
          if (!ctx.forecast.backtest) h.warn(bi('Too little history for a measured backtest; no accuracy figure will be shown.', 'السجل قصير جداً لاختبار رجعي مقاس؛ ولن تُعرض نسبة دقة.'), { limitation: true });
          h.detail(bi(ctx.forecast.ready ? 'Forecast fitted' : 'Forecast not available', ctx.forecast.ready ? 'تمت المُلاءمة' : 'التنبؤ غير متاح'));
        }
      },
      {
        id: 'forecast_compare',
        label: bi('Compare with target and prior versions', 'المقارنة مع المستهدف والنسخ السابقة'),
        active: bi('Placing the independent forecast beside the approved target without merging them', 'وضع التنبؤ المستقل بجانب المستهدف المعتمد دون دمجهما'),
        async run(ctx, h) {
          ctx.targetPos = ctx.forecast.ready ? targetVsForecast(ctx.forecast, ctx.targets || DEFAULT_TARGETS) : null;
          ctx.cards = buildDecisionCards(ctx.snapshot, { enforcementCases: ctx.cases || [] });
          h.detail(bi('Forecast and target kept separate', 'التنبؤ والمستهدف منفصلان'));
        }
      },
      S.prepare('forecast')
    ],
    modal: true
  },
  report: {
    title: bi('Generating the smart report', 'جارٍ إعداد التقرير الذكي'),
    stages: () => [S.scope(), S.retrieve, S.calculate, S.exclusionsReview, S.gaps(bi('Analyze noncollection and forecast limits', 'تحليل عدم التحصيل وحدود التنبؤ')), {
      id: 'report_forecast',
      label: bi('Attach forecast and limitations', 'إرفاق التنبؤ والقيود'),
      active: bi('Computing the independent forecast to state its limitations in the report', 'احتساب التنبؤ المستقل لبيان قيوده في التقرير'),
      async run(ctx, h) {
        ctx.forecast = await runForecast(ctx, { targets: ctx.targets || DEFAULT_TARGETS });
        ctx.targetPos = ctx.forecast.ready ? targetVsForecast(ctx.forecast, ctx.targets || DEFAULT_TARGETS) : null;
        if (!ctx.forecast.ready) h.warn(ctx.forecast.reasonNotReady, { limitation: true });
        h.detail(bi('Forecast attached', 'تم إرفاق التنبؤ'));
      }
    }, S.prepare('report')],
    modal: true
  }
};

/* ---------- Runner ---------- */
let seq = 0;

export function describeTaskContext(scope, lang = 'en') {
  return describeScope(normalizeScope(scope), lang);
}

export function createTaskState(kind, { scope, params = {}, key = null, background = false, paceMs = 0 }) {
  const def = TASK_KINDS[kind];
  const stages = def.stages().map((s) => ({ id: s.id, label: s.label, active: s.active, status: 'upcoming', detail: null, units: null, warnings: [], skipNote: null }));
  seq += 1;
  return {
    id: `task-${seq}`,
    key: key || `${kind}|${scopeKey(scope)}|${JSON.stringify(params)}`,
    kind,
    title: def.title,
    scope: normalizeScope(scope),
    params,
    scopeKey: scopeKey(scope),
    status: 'queued',
    stages,
    warnings: [],
    startedAt: null,
    finishedAt: null,
    cancellable: true,
    background,
    paced: paceMs > 0,
    mode: 'demo',
    modal: def.modal,
    result: null,
    error: null,
    dataVersion: null
  };
}

export async function runTask(state, { data, cases, decisions, cfg, targets, onUpdate, signal, paceMs = 0, failAt = null, dataVersion = null }) {
  const def = TASK_KINDS[state.kind];
  const stageDefs = def.stages();
  const ctx = {
    data, cases, decisions, cfg: normalizeConfig(cfg), targets: targets || DEFAULT_TARGETS,
    scope: normalizeScope(state.scope), params: state.params || {}, failAt
  };
  const task = { ...state, status: 'running', startedAt: ctx.cfg.cutoff, dataVersion, stages: state.stages.map((s) => ({ ...s })) };
  const emit = () => onUpdate && onUpdate({ ...task, stages: task.stages.map((s) => ({ ...s, warnings: [...s.warnings] })), warnings: [...task.warnings] });
  emit();

  const abortCheck = () => { if (signal?.aborted) { const e = new Error('cancelled'); e.cancelled = true; throw e; } };

  for (let i = 0; i < stageDefs.length; i += 1) {
    const sd = stageDefs[i];
    const st = task.stages[i];
    if (ctx.empty && i > 0) { st.status = 'skipped'; st.skipNote = bi('Skipped: no records in scope.', 'تم التخطي: لا توجد سجلات في النطاق.'); emit(); continue; }
    st.status = 'active';
    st.detail = sd.active;
    emit();
    const helpers = {
      detail: (d) => { st.detail = d; emit(); },
      units: (done, total) => { st.units = { done, total }; emit(); },
      warn: (text, opts = {}) => { const w = { text, limitation: !!opts.limitation }; st.warnings.push(w); task.warnings.push({ ...w, stage: sd.id }); emit(); },
      skipNote: (n) => { st.skipNote = n; },
      check: abortCheck
    };
    try {
      abortCheck();
      await sd.run(ctx, helpers);
      abortCheck();
      st.status = st.skipNote && !st.units ? 'skipped' : 'completed';
      st.units = st.units ? { done: st.units.total, total: st.units.total } : null;
      emit();
      if (paceMs > 0 && i < stageDefs.length - 1) await wait(paceMs);
    } catch (err) {
      if (err.cancelled || err.name === 'AbortError') {
        st.status = 'cancelled';
        for (let j = i + 1; j < task.stages.length; j += 1) task.stages[j].status = 'not_run';
        task.status = 'cancelled';
        task.finishedAt = ctx.cfg.cutoff;
        emit();
        return task;
      }
      st.status = 'failed';
      st.error = String(err.message || err);
      for (let j = i + 1; j < task.stages.length; j += 1) task.stages[j].status = 'not_run';
      task.status = 'failed';
      task.error = { stage: sd.id, message: st.error };
      task.finishedAt = ctx.cfg.cutoff;
      emit();
      return task;
    }
  }

  const skipped = task.stages.some((s) => s.status === 'skipped');
  const limited = task.warnings.some((w) => w.limitation) || skipped;
  task.status = limited ? 'completed_with_limitations' : 'completed';
  task.result = ctx.result || null;
  task.snapshotTotals = ctx.snapshot ? { gross: ctx.snapshot.totals.gross, net: ctx.snapshot.totals.net, collected: ctx.snapshot.totals.collected, outstanding: ctx.snapshot.totals.outstanding } : null;
  task.finishedAt = ctx.cfg.cutoff;
  task.out = { prevSnapshot: ctx.prevSnapshot, currAtEnd: ctx.currAtEnd, explanation: ctx.explanation, invoice: ctx.invoiceDetail, result: ctx.result || null, bridge: ctx.bridge, snapshot: ctx.snapshot, forecast: ctx.forecast, targetPos: ctx.targetPos, achievement: ctx.achievement, cards: ctx.cards, worklist: ctx.worklist, anomalies: ctx.anomalies, match: ctx.match, case: ctx.case };
  emit();
  return task;
}
