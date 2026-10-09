// ============================================================================
// Automated insights — rule-based analytics over the shared snapshot (no language model, no hidden data).
// Every insight carries: the supporting figures (raw numbers + how to format them), the comparison basis, a drill-down,
// and a caveat. Nothing here claims a cause: states are read from the records, hypotheses are labelled as such.
// `kind`: 'fact' (read from the records) · 'comparison' (period vs period) · 'outlier' (statistical) · 'estimate' (forecast / target gap,
// needs its assumptions) · 'quality' (data completeness).
// ============================================================================
const bi = (ar, en) => ({ ar, en });

export const SEVERITY = { info: 0, watch: 1, action: 2 };

function reasonTotals(snapshot) {
  const m = new Map();
  for (const r of snapshot.matrix?.amanahReasons || []) m.set(r.reason, (m.get(r.reason) || 0) + r.amount);
  return m;
}
const labelOf = (g) => g.label || { ar: g.key, en: g.key };

export function buildInsights({ snapshot, prev = null, comparison = null, forecast = null, targets = null }) {
  const T = snapshot.totals; const out = [];
  const rate = T.collectedOverNet; const comparable = !!(comparison && comparison.comparable && prev);
  const priorBasis = comparable ? bi(`نفس الفترة من العام السابق (${prev.scope.from} ← ${prev.scope.to})، وكل فترة تُقاس عند نهايتها فتتساوى المدة المنقضية`, `Same period last year (${prev.scope.from} → ${prev.scope.to}), each period measured at its own end so the elapsed time is equal`) : null;
  const period = `${snapshot.scope.from} → ${snapshot.scope.to}`;
  const demoNote = bi('بيانات تجريبية اصطناعية.', 'Synthetic demo data.');

  /* ---------- 1. period summary (always) ---------- */
  const summary = {
    title: bi('ملخص الفترة', 'Period summary'),
    text: bi(
      `في الفترة ${period} صدرت ${T.count.toLocaleString('en-US')} فاتورة بإجمالي مفوتر يتحلل إلى استبعادات وصافي مفوتر؛ والصافي يتحلل إلى محصّل وغير محصّل. نسبة التحصيل ${rate.calculable ? `${(rate.value * 100).toFixed(1)}%` : 'غير متاحة'}${comparable && comparison.collectedOverNetPp.calculable ? `، وهي ${comparison.collectedOverNetPp.value >= 0 ? 'أعلى' : 'أدنى'} بـ ${Math.abs(comparison.collectedOverNetPp.value).toFixed(1)} نقطة مئوية من نفس الفترة في العام السابق` : '، ولا توجد مقارنة مماثلة متاحة'}.`,
      `For ${period}, ${T.count.toLocaleString('en-US')} invoices were issued: gross billed splits into exclusions and net billed, and net billed splits into collected and uncollected. Collection rate is ${rate.calculable ? `${(rate.value * 100).toFixed(1)}%` : 'not available'}${comparable && comparison.collectedOverNetPp.calculable ? `, ${Math.abs(comparison.collectedOverNetPp.value).toFixed(1)} percentage points ${comparison.collectedOverNetPp.value >= 0 ? 'above' : 'below'} the same period last year` : '; no like-for-like comparison is available'}.`
    ),
    evidence: [
      { k: bi('إجمالي المفوتر', 'Gross billed'), v: T.gross, fmt: 'money' }, { k: bi('الاستبعادات', 'Exclusions'), v: T.exclusions, fmt: 'money' }, { k: bi('صافي المفوتر', 'Net billed'), v: T.net, fmt: 'money' },
      { k: bi('المحصّل', 'Collected'), v: T.collected, fmt: 'money' }, { k: bi('غير المحصّل', 'Uncollected'), v: T.outstanding, fmt: 'money' }, { k: bi('نسبة التحصيل', 'Collection rate'), v: rate.calculable ? rate.value : null, fmt: 'ratio' }
    ],
    basis: bi(`فواتير صادرة ${period}؛ التحصيل حتى ${snapshot.basis?.collectionsAsOf || snapshot.cutoff}`, `Invoices issued ${period}; collections up to ${snapshot.basis?.collectionsAsOf || snapshot.cutoff}`),
    drill: { to: '/invoices', label: bi('عرض الفواتير', 'Open the invoices') }, caveat: demoNote
  };

  /* ---------- 2. collection-rate change vs the equivalent prior period ---------- */
  if (comparable && comparison.collectedOverNetPp.calculable) {
    const pp = comparison.collectedOverNetPp.value; const pr = prev.totals.collectedOverNet;
    out.push({
      id: 'rate_change', kind: 'comparison', severity: Math.abs(pp) >= 3 ? 'watch' : 'info',
      title: bi(pp >= 0 ? 'تحسّن نسبة التحصيل مقارنة بالعام السابق' : 'تراجع نسبة التحصيل مقارنة بالعام السابق', pp >= 0 ? 'Collection rate improved versus last year' : 'Collection rate fell versus last year'),
      body: bi(`نسبة التحصيل ${(rate.value * 100).toFixed(1)}% مقابل ${(pr.value * 100).toFixed(1)}% (${pp >= 0 ? '+' : ''}${pp.toFixed(1)} نقطة). هذا قياس للفرق وليس تفسيراً لسببه.`, `Rate ${(rate.value * 100).toFixed(1)}% vs ${(pr.value * 100).toFixed(1)}% (${pp >= 0 ? '+' : ''}${pp.toFixed(1)} pp). This measures the difference; it does not explain it.`),
      evidence: [{ k: bi('نسبة التحصيل الحالية', 'Current rate'), v: rate.value, fmt: 'ratio' }, { k: bi('نسبة الفترة المماثلة', 'Prior-period rate'), v: pr.value, fmt: 'ratio' }, { k: bi('الفرق (نقطة)', 'Change (pp)'), v: pp, fmt: 'pp' }, { k: bi('صافي المفوتر الحالي', 'Current net billed'), v: T.net, fmt: 'money' }, { k: bi('صافي مفوتر الفترة المماثلة', 'Prior net billed'), v: prev.totals.net, fmt: 'money' }],
      basis: priorBasis, drill: { to: '/insights?view=reports&report=amanah', label: bi('أداء الأمانات حسب المصدر', 'Amanah performance by source') }, caveat: bi('فروق المحصّل بين فترتين قد تعكس اختلاف حجم الفواتير ومواعيدها لا الأداء وحده.', 'Differences can reflect invoice size and timing, not performance alone.')
    });
  } else {
    out.push({ id: 'no_comparison', kind: 'comparison', severity: 'info', title: bi('لا توجد مقارنة مماثلة لهذه الفترة', 'No like-for-like comparison for this period'), body: bi('الفترة المماثلة من العام السابق خارج نطاق البيانات أو بلا فواتير؛ لا تُعرض مقارنة بفترة غير مكافئة.', 'The same period last year is outside the data or empty; no comparison against an unequal period is shown.'), evidence: [], basis: bi('—', '—'), drill: null, caveat: null });
  }

  /* ---------- 3. biggest collection gaps (Amanah × source) vs the demo target ---------- */
  const target = targets?.collectionRate?.value ?? null;
  if (target != null) {
    const gaps = (snapshot.matrix?.amanahSource || [])
      .filter((r) => r.net >= T.net * 0.01)
      .map((r) => ({ ...r, gap: Math.max(0, r.net * target - r.collected), rate: r.net > 0 ? r.collected / r.net : null }))
      .filter((r) => r.gap > 0).sort((a, b) => b.gap - a.gap).slice(0, 3);
    gaps.forEach((g, i) => {
      const am = snapshot.byAmanah.find((x) => x.key === g.amanah);
      out.push({
        id: `gap_${i}`, kind: 'estimate', severity: i === 0 ? 'action' : 'watch',
        title: bi(`فرصة متابعة: ${labelOf(am || { key: g.amanah }).ar} — ${sourceAr(g.source)}`, `Follow-up opportunity: ${labelOf(am || { key: g.amanah }).en} — ${sourceEn(g.source)}`),
        body: bi(`نسبة التحصيل ${(g.rate * 100).toFixed(1)}% مقابل مستهدف تجريبي ${(target * 100).toFixed(0)}%. الفجوة التقديرية ${'{gap}'} هي ما يلزم تحصيله للوصول للمستهدف على صافي هذه الخلية.`, `Rate ${(g.rate * 100).toFixed(1)}% vs a demo target of ${(target * 100).toFixed(0)}%. The estimated gap {gap} is what must be collected to reach the target on this cell's net billed.`),
        evidence: [{ k: bi('صافي المفوتر', 'Net billed'), v: g.net, fmt: 'money' }, { k: bi('المحصّل', 'Collected'), v: g.collected, fmt: 'money' }, { k: bi('غير المحصّل', 'Uncollected'), v: g.outstanding, fmt: 'money' }, { k: bi('الفجوة التقديرية', 'Estimated gap'), v: g.gap, fmt: 'money' }, { k: bi('الفواتير', 'Invoices'), v: g.count, fmt: 'count' }],
        gapValue: g.gap, tokens: { gap: g.gap }, basis: bi('خلية أمانة × مصدر ضمن الفترة؛ المستهدف مُدخل تجريبي غير معتمد', 'Amanah × source cell in the period; the target is an unapproved demo input'),
        drill: { to: `/invoices?amanah=${encodeURIComponent(g.amanah)}&src=${g.source}`, label: bi('فواتير هذه الخلية', 'Invoices of this cell') }, caveat: bi('تقدير مبني على مستهدف تجريبي؛ لا يعني أن المبلغ قابل للتحصيل كله.', 'An estimate against a demo target; it does not mean the full amount is collectible.')
      });
    });
  }

  /* ---------- 4. unusually low Amanah (weighted z-score) ---------- */
  {
    const rows = snapshot.byAmanah.filter((g) => g.net >= T.net * 0.01 && g.collectedOverNet.calculable);
    if (rows.length >= 4) {
      const W = rows.reduce((t, g) => t + g.net, 0); const mean = rows.reduce((t, g) => t + g.net * g.collectedOverNet.value, 0) / W;
      const sd = Math.sqrt(rows.reduce((t, g) => t + g.net * (g.collectedOverNet.value - mean) ** 2, 0) / W);
      const low = rows.map((g) => ({ g, z: sd > 0 ? (g.collectedOverNet.value - mean) / sd : 0 })).filter((x) => x.z <= -1.5).sort((a, b) => a.z - b.z).slice(0, 2);
      low.forEach(({ g, z }, i) => out.push({
        id: `outlier_${i}`, kind: 'outlier', severity: 'watch',
        title: bi(`نسبة تحصيل منخفضة بشكل غير معتاد: ${labelOf(g).ar}`, `Unusually low collection rate: ${labelOf(g).en}`),
        body: bi(`نسبتها ${(g.collectedOverNet.value * 100).toFixed(1)}% مقابل متوسط مرجّح ${(mean * 100).toFixed(1)}% بانحراف معياري ${z.toFixed(1)}. هذا رصد إحصائي وليس تفسيراً.`, `Rate ${(g.collectedOverNet.value * 100).toFixed(1)}% vs a weighted mean of ${(mean * 100).toFixed(1)}% (z = ${z.toFixed(1)}). A statistical flag, not an explanation.`),
        evidence: [{ k: bi('نسبة التحصيل', 'Collection rate'), v: g.collectedOverNet.value, fmt: 'ratio' }, { k: bi('المتوسط المرجّح', 'Weighted mean'), v: mean, fmt: 'ratio' }, { k: bi('صافي المفوتر', 'Net billed'), v: g.net, fmt: 'money' }, { k: bi('غير المحصّل', 'Uncollected'), v: g.outstanding, fmt: 'money' }],
        basis: bi(`الأمانات ذات صافي ≥ 1% من الإجمالي (${rows.length} أمانة) في ${period}`, `Amanahs with net ≥ 1% of the total (${rows.length}) in ${period}`),
        drill: { to: `/invoices?amanah=${encodeURIComponent(g.key)}`, label: bi('فواتير الأمانة', "The Amanah's invoices") }, caveat: bi('عينة صغيرة قد تنتج انحرافات عشوائية.', 'Small samples can produce random deviations.')
      }));
    }
  }

  /* ---------- 5. exclusions: rate, change, dominant reason ---------- */
  if (T.exclusions > 0) {
    const reasons = reasonTotals(snapshot); const top = [...reasons.entries()].sort((a, b) => b[1] - a[1])[0];
    const er = T.exclusionRate; const pe = comparable ? prev.totals.exclusionRate : null;
    const dpp = er.calculable && pe?.calculable ? (er.value - pe.value) * 100 : null;
    out.push({
      id: 'exclusions', kind: comparable ? 'comparison' : 'fact', severity: dpp != null && Math.abs(dpp) >= 2 ? 'watch' : 'info',
      title: bi('الاستبعادات من إجمالي المفوتر', 'Exclusions out of gross billed'),
      body: bi(`الاستبعادات ${(er.value * 100).toFixed(1)}% من إجمالي المفوتر${dpp != null ? ` (${dpp >= 0 ? '+' : ''}${dpp.toFixed(1)} نقطة عن الفترة المماثلة)` : ''}. أكبر سبب: ${top ? reasonAr(top[0]) : '—'} (${top ? ((top[1] / T.exclusions) * 100).toFixed(0) : 0}% منها). تُخصم كل فاتورة مرة واحدة.`, `Exclusions are ${(er.value * 100).toFixed(1)}% of gross billed${dpp != null ? ` (${dpp >= 0 ? '+' : ''}${dpp.toFixed(1)} pp vs the equivalent period)` : ''}. Largest reason: ${top ? reasonEn(top[0]) : '—'} (${top ? ((top[1] / T.exclusions) * 100).toFixed(0) : 0}%). Each invoice is deducted once.`),
      evidence: [{ k: bi('الاستبعادات', 'Exclusions'), v: T.exclusions, fmt: 'money' }, { k: bi('منها ملغى', 'of which cancelled'), v: T.cancelled, fmt: 'money' }, { k: bi('منها قواعد معتمدة', 'of which approved rules'), v: T.exclusionsRules, fmt: 'money' }, { k: bi('نسبة الاستبعاد', 'Exclusion rate'), v: er.value, fmt: 'ratio' }, ...(pe?.calculable ? [{ k: bi('نسبة الفترة المماثلة', 'Prior-period rate'), v: pe.value, fmt: 'ratio' }] : [])],
      basis: priorBasis || bi(`الفترة ${period}`, `Period ${period}`), drill: { to: '/insights?view=reports&report=exclusions', label: bi('مصفوفة الاستبعاد حسب الأمانة والسبب', 'Exclusions by Amanah and reason') }, caveat: bi('الاستبعاد ليس حكماً بعدم القابلية للتحصيل؛ قواعد غير معتمدة تؤثر في جزء منه.', 'Exclusion does not mean uncollectible; unapproved rules affect part of it.')
    });
  }

  /* ---------- 6. aging concentration ---------- */
  {
    const ag = snapshot.stock.aging; const tot = snapshot.stock.netUncollected;
    const old = (ag[3]?.amount || 0) + (ag[4]?.amount || 0);
    if (tot > 0) out.push({
      id: 'aging', kind: 'fact', severity: old / tot >= 0.3 ? 'action' : 'info',
      title: bi('تقادم الرصيد غير المحصّل', 'Aging of the uncollected balance'),
      body: bi(`${((old / tot) * 100).toFixed(0)}% من الرصيد القائم متأخر أكثر من 90 يوماً. المتأخر ${(snapshot.stock.overdue / tot * 100).toFixed(0)}% من الرصيد؛ والباقي لم يحن استحقاقه.`, `${((old / tot) * 100).toFixed(0)}% of the standing balance is more than 90 days overdue. Overdue is ${(snapshot.stock.overdue / tot * 100).toFixed(0)}% of the balance; the rest is not yet due.`),
      evidence: [{ k: bi('الرصيد القائم', 'Standing balance'), v: tot, fmt: 'money' }, { k: bi('متأخر أكثر من 90 يوماً', 'More than 90 days overdue'), v: old, fmt: 'money' }, { k: bi('متأخر', 'Overdue'), v: snapshot.stock.overdue, fmt: 'money' }, { k: bi('لم يحن', 'Not yet due'), v: snapshot.stock.notYetDue, fmt: 'money' }],
      basis: bi(`رصيد قائم في ${snapshot.cutoff} لكل ما صدر حتى ذلك التاريخ (لا يتأثر بفترة الإصدار)`, `Standing balance at ${snapshot.cutoff} for everything issued up to then (independent of the issue period)`),
      drill: { to: '/collection', label: bi('قائمة التحصيل', 'Collection worklist') }, caveat: bi('لا تسجل البيانات سبب عدم السداد.', 'The data does not record why a payer has not paid.')
    });
  }

  /* ---------- 7. data completeness ---------- */
  {
    const un = snapshot.byAmanah.find((g) => g.key === 'Unassigned'); const q = snapshot.quality;
    const share = un && T.net > 0 ? un.net / T.net : 0;
    if (share > 0.01 || q.pendingExclusionCount > 0 || q.amountConflictCount > 0) out.push({
      id: 'quality', kind: 'quality', severity: share > 0.05 ? 'watch' : 'info',
      title: bi('اكتمال البيانات والمطابقة', 'Data completeness and reconciliation'),
      body: bi(`${(share * 100).toFixed(1)}% من صافي المفوتر غير محدد الأمانة (لم يُطابق في مكين ولم يُخمَّن)، و${q.pendingExclusionCount.toLocaleString('en-US')} استبعاد بانتظار المراجعة، و${q.amountConflictCount.toLocaleString('en-US')} تعارض في المبالغ.`, `${(share * 100).toFixed(1)}% of net billed has no Amanah (not matched in Makeen and not guessed), ${q.pendingExclusionCount.toLocaleString('en-US')} exclusions await review and ${q.amountConflictCount.toLocaleString('en-US')} amounts conflict.`),
      evidence: [{ k: bi('صافي مفوتر غير محدد الأمانة', 'Net billed without Amanah'), v: un?.net || 0, fmt: 'money' }, { k: bi('استبعادات قيد المراجعة', 'Exclusions pending review'), v: q.pendingExclusionCount, fmt: 'count' }, { k: bi('تعارضات المبالغ', 'Amount conflicts'), v: q.amountConflictCount, fmt: 'count' }, { k: bi('سجلات بحقول ناقصة', 'Records with missing fields'), v: q.missingFieldCount, fmt: 'count' }],
      basis: bi(`الفترة ${period}`, `Period ${period}`), drill: { to: '/risk', label: bi('جودة البيانات والمخاطر', 'Data quality & risk') }, caveat: null
    });
  }

  /* ---------- 8. two reporting bases ---------- */
  {
    const r = snapshot.receivedInPeriod;
    if (r.total > 0) out.push({
      id: 'bases', kind: 'fact', severity: 'info',
      title: bi('المحصّل على فواتير الفترة ≠ المقبوض خلال الفترة', 'Collected on period invoices ≠ received during the period'),
      body: bi(`المقبوض حسب تاريخ الدفع خلال الفترة ${'{recv}'}، منه ${'{prior}'} على فواتير صدرت قبلها. أما «المحصّل» فهو ما سُدد من فواتير الفترة نفسها ${'{coll}'}. لا يُخلط المؤشران ولا يُقسم أحدهما على مقام الآخر.`, `Receipts dated in the period are {recv}, of which {prior} on invoices issued before it. “Collected” is what was paid against the period's own invoices: {coll}. The two are never mixed or divided by each other's denominator.`),
      evidence: [{ k: bi('المقبوض خلال الفترة (تاريخ الدفع)', 'Received in period (payment date)'), v: r.total, fmt: 'money' }, { k: bi('منه على فواتير الفترة', 'on period invoices'), v: r.fromPeriodInvoices, fmt: 'money' }, { k: bi('منه على فواتير سابقة', 'on earlier invoices'), v: r.fromPriorInvoices, fmt: 'money' }, { k: bi('المحصّل على فواتير الفترة', 'Collected on period invoices'), v: T.collected, fmt: 'money' }],
      tokens: { recv: r.total, prior: r.fromPriorInvoices, coll: T.collected },
      basis: bi('أساسان مختلفان: تاريخ الدفع مقابل تاريخ إصدار الفاتورة', 'Two different bases: payment date vs invoice issue date'), drill: { to: '/insights?view=reports&report=trends', label: bi('تقرير الاتجاهات وأساس القياس', 'Trends and basis report') }, caveat: null
    });
  }

  /* ---------- 9. forecast (only when the history supports it) ---------- */
  const fc = { available: !!forecast?.ready, reason: forecast && !forecast.ready ? forecast.reasonNotReady : null };
  if (forecast?.ready) {
    const lo = forecast.horizon.low.reduce((a, b) => a + b, 0); const hi = forecast.horizon.high.reduce((a, b) => a + b, 0); const pt = forecast.horizon.point.reduce((a, b) => a + b, 0);
    out.push({
      id: 'forecast', kind: 'estimate', severity: 'info',
      title: bi('تقدير المقبوضات للأشهر القادمة (تقدير وليس حقيقة)', 'Receipts estimate for the coming months (an estimate, not a fact)'),
      body: bi(`النقطة ${'{pt}'} ضمن نطاق ${'{lo}'} – ${'{hi}'} للأشهر ${forecast.horizon.months.join('، ')}. اتجاه خطي على المقبوضات الأساسية بعد عزل الاستثنائي منها؛ مستقل عن المستهدف.`, `Point {pt} within {lo} – {hi} for ${forecast.horizon.months.join(', ')}. A linear trend on the underlying receipts after separating exceptional ones; independent of the target.`),
      evidence: [{ k: bi('تقدير النقطة', 'Point estimate'), v: pt, fmt: 'money' }, { k: bi('الحد الأدنى', 'Low'), v: lo, fmt: 'money' }, { k: bi('الحد الأعلى', 'High'), v: hi, fmt: 'money' }],
      tokens: { pt, lo, hi }, basis: bi('المقبوضات الشهرية (تاريخ الدفع) لنطاق التحليل', 'Monthly receipts (payment date) of the analysis scope'),
      drill: { to: '/planning#outlook', label: bi('تفاصيل التنبؤ وافتراضاته', 'Forecast details and assumptions') }, caveat: bi('يعتمد على اتجاه تاريخي قصير في بيانات تجريبية؛ لا يعكس أحداثاً مستقبلية.', 'Based on a short synthetic history; it does not anticipate future events.')
    });
  }

  out.sort((a, b) => SEVERITY[b.severity] - SEVERITY[a.severity]);
  return { summary, insights: out, forecast: fc };
}

/* ---------- labels ---------- */
const SRC_AR = { investment: 'الاستثمار (فرص)', fines: 'الغرامات والجزاءات', municipal_fees: 'الرسوم البلدية', licenses: 'رسوم التراخيص', accommodation: 'إشغال مرافق الإيواء', tobacco: 'رسم تقديم منتجات التبغ', white_lands: 'رسوم الأراضي البيضاء', housing_sales: 'المبيعات السكنية' };
const SRC_EN = { investment: 'Investment (Furas)', fines: 'Fines & penalties', municipal_fees: 'Municipal fees', licenses: 'Licence fees', accommodation: 'Accommodation facilities', tobacco: 'Tobacco fee', white_lands: 'White-land fees', housing_sales: 'Residential sales' };
export const sourceAr = (k) => SRC_AR[k] || k; export const sourceEn = (k) => SRC_EN[k] || k;
const RS_AR = { cancelled: 'ملغاة في المصدر', 'DUP-1': 'فاتورة مكررة', 'CR-1': 'سجل تجاري مشطوب', 'DEC-1': 'مدين متوفى', 'NOC-1': 'بلا عقد', 'INC-1': 'بيانات غير مكتملة', 'EXE-1': 'منفذ ضده', 'EFA-1': 'خارج إيفاء', 'OBJ-1': 'قيد الاعتراض' };
const RS_EN = { cancelled: 'Cancelled in the source', 'DUP-1': 'Duplicate invoice', 'CR-1': 'Struck-off registration', 'DEC-1': 'Deceased debtor', 'NOC-1': 'No contract', 'INC-1': 'Incomplete data', 'EXE-1': 'Executed against', 'EFA-1': 'Outside Efaa', 'OBJ-1': 'Under objection' };
const reasonAr = (k) => RS_AR[k] || k; const reasonEn = (k) => RS_EN[k] || k;
