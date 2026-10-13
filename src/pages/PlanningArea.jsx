// «التخطيط المالي والاستراتيجي» — the Strategic Dashboard, reduced to ONE question: how far are we from this year's collection goal?
//   What is our collection goal?  ·  How are we progressing month by month?  ·  How much remains?  ·  What monthly pace is needed in the remaining months?
// One reporting period (the selected year, up to the reporting date), one invoice scope, approved exclusions only, one optional Amanah — the same for every figure and for the chart.
// The calculations are in src/data/collectionGoal.js. There are no scenarios, forecasts, assistants, registers or configuration screens here.
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRevenue } from '../context/RevenueContext';
import { useAuth } from '../context/AuthContext';
import { useAsync } from '../utils/useAsync';
import { useAr } from '../utils/useAr';
import { actorName } from '../utils/actor';
import { AsyncBlock } from '../components/strategic/AsyncState';
import CollectionChart from '../components/strategic/CollectionChart';
import { MetricTile } from '../components/revenue/RevenueUI';
import { amanahFilterOptions, DATA_START } from '../data/revenueLedger';
import { EXCLUSION_RULES, DEFAULT_TARGETS, normalizeConfig } from '../data/revenueMetrics';
import { fmtDateText } from '../data/clock';
import { computeGoal, reportingDateFor, loadGoalStore, saveGoalStore, savePlan, rebasePlan, planKey } from '../data/collectionGoal';

const pct = (v) => `${(v * 100).toFixed(1)}%`;

export default function PlanningArea() {
  const rev = useRevenue(); const { user } = useAuth();
  const { L, ar, lang, short, sar } = useAr();
  const today = rev.cfg.cutoff; const todayYear = Number(today.slice(0, 4));
  const years = useMemo(() => { const out = []; for (let y = todayYear; y >= Number(DATA_START.slice(0, 4)); y -= 1) out.push(y); return out; }, [todayYear]);
  const [year, setYear] = useState(todayYear);
  const [amanah, setAmanah] = useState('all');
  const [retry, setRetry] = useState(0);
  const amanahOptions = useMemo(() => amanahFilterOptions().filter((a) => !rev.org.amanahKeys || rev.org.amanahKeys.includes(a.key)), [rev.org]);
  const [store, setStore] = useState(loadGoalStore);
  const key = planKey(year, amanah); const saved = store.plans[key] || null;
  const [rateText, setRateText] = useState(() => String(Math.round(DEFAULT_TARGETS.collectionRate.value * 100)));
  useEffect(() => { setRateText(String(Math.round((saved?.rate ?? DEFAULT_TARGETS.collectionRate.value) * 100))); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps -- a different year or Amanah starts from its saved goal (or the default)
  const rateNum = Number(rateText); const rateValid = Number.isFinite(rateNum) && rateNum >= 1 && rateNum <= 100;
  const canEdit = rev.canReview; const by = actorName(user, lang) || 'user';
  const [toast, setToast] = useState('');

  // ONE data request set for the selected year and Amanah: invoices issued from 1 January to the reporting date; only APPROVED exclusions (rules the business has approved); payments counted up to the same date.
  const reporting = reportingDateFor(year, today);
  const approvedCfg = useMemo(() => normalizeConfig({ ...rev.cfg, rules: Object.fromEntries(EXCLUSION_RULES.map((r) => [r.id, r.approval === 'approved'])) }), [rev.cfg]);
  const DATA = useAsync(async () => {
    if (!reporting) return null;
    const scope = { from: `${year}-01-01`, to: reporting, amanah, source: 'all', scopeType: 'all', muni: 'all', status: 'all' };
    const [snap, ser] = await Promise.all([
      rev.data.snapshot(scope, { cfg: approvedCfg }),
      rev.data.series({ ...scope, issuedFrom: scope.from, issuedTo: reporting }, { cfg: approvedCfg, capped: true })
    ]);
    const T = snap.totals; const R = snap.receivedInPeriod || {};
    // cancelled invoices and rule exclusions stay SEPARATE figures; only rules the business approved are applied (approvedCfg)
    return { gross: T.gross, cancelled: T.cancelled, cancelledCount: T.cancelledCount, ruleExclusions: T.exclusionsRules, monthly: ser.values, invoices: snap.population.issuedInPeriod, paidByDate: R.total, paidOnPriorYears: R.fromPriorInvoices };
  }, [rev.data, year, amanah, reporting, approvedCfg, retry]);

  const g = useMemo(() => (DATA.data ? computeGoal({ year, today, rate: rateValid ? rateNum / 100 : null, gross: DATA.data.gross, cancelled: DATA.data.cancelled, ruleExclusions: DATA.data.ruleExclusions, monthlyCollected: DATA.data.monthly, plan: saved }) : null), [DATA.data, year, today, rateNum, rateValid, saved]);
  const dateText = (iso) => fmtDateText(iso, lang);
  const amanahName = amanah === 'all' ? L('كل الأمانات', 'All Amanahs') : (() => { const a = amanahFilterOptions().find((x) => x.key === amanah); return a ? (ar ? a.ar : a.en) : amanah; })();

  const commit = (fn, msg) => { const next = fn(store); setStore(next); saveGoalStore(next); setToast(msg); };
  const planArgs = () => ({ year, amanah, rate: rateNum / 100, annualTarget: g.target, adjustedTotal: g.adjustedTotal, at: new Date().toISOString(), by });
  const doSave = () => commit((s) => savePlan(s, planArgs()), L('حُفظت مسودة الخطة الشهرية (غير معتمدة): أشهرها ثابتة ولا تتغير عند تغيّر المفوتر أو الاستبعادات.', 'The draft monthly plan is saved (not approved): its months stay fixed when billed amounts or exclusions change.'));
  const doRebase = () => commit((s) => rebasePlan(s, { ...planArgs(), today }), L('حُدّثت مسودة الخطة: الأشهر المنتهية كما هي، والهدف الجديد موزّع بالتساوي على بقية الأشهر.', 'The draft plan is updated: closed months are unchanged, the new target is spread evenly over the remaining months.'));
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(''), 6000); return () => clearTimeout(t); }, [toast]);

  const ok = g && g.state === 'ok';
  const noTarget = g && g.state === 'no_target';
  const D = DATA.data;
  const whatIf = EXCLUSION_RULES.some((r) => r.approval !== 'approved' && !r.locked && rev.cfg.rules[r.id]); // the rule registry has an unapproved rule switched on as a what-if
  const planned = ok ? g.plan.cumulative : [];
  const closedYear = ok && year < todayYear; // a closed year's saved plan is never updated

  const basis = (ok || noTarget) && D ? (
    <div className="muted cg-basis">
      <div>{L(`الفترة: ${dateText(`${year}-01-01`)} – ${dateText(g.reportingDate)} (تاريخ التقرير) · ${amanahName} · فواتير صدرت في ${year}.`, `Period: ${dateText(`${year}-01-01`)} – ${dateText(g.reportingDate)} (reporting date) · ${amanahName} · invoices issued in ${year}.`)}</div>
      <div>{L(`إجمالي الفواتير المعدّل ${short(g.adjustedTotal)} = المفوتر ${short(g.gross)} − الفواتير الملغاة ${short(g.cancelled)} (${D.cancelledCount}) − استبعادات القواعد المعتمدة ${short(g.ruleExclusions)}.`, `Adjusted total ${short(g.adjustedTotal)} = billed ${short(g.gross)} − cancelled invoices ${short(g.cancelled)} (${D.cancelledCount}) − approved-rule exclusions ${short(g.ruleExclusions)}.`)}</div>
      <div><span className="rv-tag rv-tag--warn">{L('تصنيف غير محسوم', 'Classification unresolved')}</span> {L('الفواتير الملغاة بند خصم مستقل ولم تؤكد المتطلبات أنها «استبعاد معتمد»؛ تُخصم لأن الفاتورة الملغاة لا تُطالَب، وتُعرض منفصلة ليتمكن صاحب القرار من تأكيد هذا التصنيف.', 'Cancelled invoices are a separate deduction; the requirements do not confirm them as an "approved exclusion". They are deducted because a cancelled invoice is not claimed, and shown separately so the business can confirm the classification.')}</div>
      <div>{L('الإيرادات المحصلة = مدفوعات تحصيل على فواتير هذه السنة فقط (بتاريخ الدفع حتى تاريخ التقرير، وبحد أقصى قيمة الفاتورة)، وهو نفس أساس نسبة التحصيل.', 'Collected revenue = Tahseel payments on this year\'s invoices only (by payment date up to the reporting date, capped at the invoice amount) — the same basis as the collection rate.')}
        {D.paidByDate > 0 && <> {L(`للمقارنة: إجمالي المدفوعات بتاريخ الدفع في الفترة ${short(D.paidByDate)}، منها ${short(D.paidOnPriorYears)} على فواتير سنوات سابقة؛ أساس مختلف لا يدخل في هذه النسبة.`, `For comparison: all payments by payment date in the period total ${short(D.paidByDate)}, of which ${short(D.paidOnPriorYears)} are on prior-year invoices — a different basis, not used in this rate.`)}</>}</div>
      {whatIf && <div><span className="rv-tag rv-tag--warn">{L('تنبيه', 'Note')}</span> {L('سجل القواعد يطبّق قاعدة غير معتمدة كاحتمال تجريبي في الصفحات الأخرى؛ هذه الشاشة تستخدم القواعد المعتمدة فقط، فقد تختلف أرقام «صافي المفوتر» هناك.', 'The rule registry has an unapproved rule switched on as a what-if on other pages; this screen uses approved rules only, so net billed there may differ.')}</div>}
    </div>
  ) : null;

  return (
    <div className="st-page" dir={ar ? 'rtl' : 'ltr'}>
      <header className="st-head">
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>{L('التخطيط المالي والاستراتيجي', 'Financial and strategic planning')}</h1>
          <div className="muted" style={{ fontSize: 13 }}>{L('هدف التحصيل السنوي: أين نحن، وما المتبقي، وما المطلوب في بقية السنة.', 'The annual collection goal: where we are, what remains, and the pace needed for the rest of the year.')}</div>
        </div>
      </header>

      <div className="card card-pad cg-controls">
        <label className="cg-field" htmlFor="cg-year">{L('السنة', 'Year')}
          <select id="cg-year" className="input" value={year} onChange={(e) => setYear(Number(e.target.value))}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>
        </label>
        <label className="cg-field" htmlFor="cg-amanah">{L('الأمانة', 'Amanah')}
          <select id="cg-amanah" className="input" value={amanah} onChange={(e) => setAmanah(e.target.value)}>
            <option value="all">{L('كل الأمانات', 'All Amanahs')}</option>
            {amanahOptions.map((a) => <option key={a.key} value={a.key}>{ar ? a.ar : a.en}</option>)}
          </select>
        </label>
        <label className="cg-field" htmlFor="cg-rate">{L('نسبة التحصيل المستهدفة سنوياً (%)', 'Annual target collection rate (%)')}
          <input id="cg-rate" type="number" className="input" min="1" max="100" step="1" value={rateText} onChange={(e) => setRateText(e.target.value)} aria-invalid={!rateValid} aria-describedby="cg-rate-note" />
        </label>
        <div className="cg-equiv" id="cg-rate-note" role="status">
          {!rateValid ? <span className="rv-neg">{L('أدخل نسبة بين 1 و100.', 'Enter a rate between 1 and 100.')}</span> : ok ? <>{L('المبلغ المستهدف المكافئ', 'Equivalent target amount')}: <b dir="ltr">{short(g.target)}</b> <span className="muted">({rateNum}% × {short(g.adjustedTotal)} {L('إجمالي الفواتير المعدّل حتى', 'adjusted total to')} {dateText(g.reportingDate)})</span></> : <span className="muted">{L('يُحتسب بعد إدخال نسبة صالحة وتوفر قاعدة صالحة لاحتساب نسبة التحصيل.', 'Calculated once a valid rate is entered and a valid base for the collection rate exists.')}</span>}
          <div className="muted" style={{ fontSize: 12 }}>{L('النسبة مُدخل تجريبي إلى أن تُعتمد. المستهدف مبني على الفوترة الحالية (الفواتير الصادرة حتى تاريخ التقرير)، وليس على الفوترة المتوقعة لكامل السنة.', 'The rate is a demo input until it is approved. The target is based on current billing (invoices issued up to the reporting date), not on expected full-year billing.')}</div>
        </div>
      </div>

      {toast && <div className="rv-callout" role="status">{toast}</div>}

      <AsyncBlock state={DATA} onRetry={() => setRetry((n) => n + 1)} height={260}>
        {g && g.state === 'no_denominator' && (
          <div className="rv-callout rv-callout--warn" role="status">
            <b>{L('لا توجد قاعدة صالحة لاحتساب نسبة التحصيل.', 'There is no valid base for calculating the collection rate.')}</b>
            <div style={{ fontSize: 13, marginTop: 4 }}>{L(`الفترة ${dateText(`${year}-01-01`)} – ${dateText(g.reportingDate)} · ${amanahName}: المفوتر ${short(g.gross)} − الملغاة ${short(g.cancelled)} − استبعادات القواعد المعتمدة ${short(g.ruleExclusions)} = ${short(g.adjustedTotal)}. لا تُعرض نسبة ولا هدف ولا رسم دون قاعدة صالحة، ولا يُعدّ التحصيل الصفري نجاحاً.`, `Period ${dateText(`${year}-01-01`)} – ${dateText(g.reportingDate)} · ${amanahName}: billed ${short(g.gross)} − cancelled ${short(g.cancelled)} − approved-rule exclusions ${short(g.ruleExclusions)} = ${short(g.adjustedTotal)}. No rate, target or chart is shown without a valid base, and zero collection is never shown as success.`)}</div>
          </div>
        )}
        {noTarget && (
          <>
            {basis}
            <div className="rv-callout rv-callout--warn" role="status">
              <b>{L('لم يتم تحديد مستهدف تحصيل صالح.', 'No valid collection target has been set.')}</b>
              <div style={{ fontSize: 13, marginTop: 4 }}>{L('أدخل نسبة مستهدفة بين 1 و100 لاحتساب المبلغ المستهدف والمتبقي والمخطط. لا يُعرض «تم تحقيق المستهدف» دون مستهدف موجب صالح.', 'Enter a target rate between 1 and 100 to calculate the target amount, the remainder and the plan. "Target reached" is never shown without a valid positive target.')}</div>
            </div>
            <div className="rv-tiles cg-tiles">
              <MetricTile label={L(`الإيرادات المحصلة حتى ${dateText(g.reportingDate)}`, `Collected revenue to ${dateText(g.reportingDate)}`)} value={short(g.collected)} sub={L('منذ بداية السنة — حتى تاريخ التقرير', 'year to date — to the reporting date')} />
              <MetricTile label={L('نسبة التحصيل الحالية', 'Current collection rate')} value={pct(g.collectionRate)} sub={L('الإيرادات المحصلة ÷ إجمالي الفواتير المعدّل', 'Collected revenue ÷ adjusted total')} />
              <MetricTile label={L('المبلغ المستهدف تحصيله', 'Target collection amount')} value={L('غير محدد', 'Not set')} sub={L('لا يوجد مستهدف صالح', 'no valid target')} />
            </div>
          </>
        )}
        {ok && (
          <>
            {basis}

            <div className="rv-tiles cg-tiles">
              <MetricTile label={L('المبلغ المستهدف تحصيله (سنوي)', 'Target collection amount (annual)')} value={short(g.target)} sub={L(`${Math.round(g.rate * 100)}% من إجمالي الفواتير المعدّل`, `${Math.round(g.rate * 100)}% of the adjusted total`)} />
              <MetricTile label={L(`الإيرادات المحصلة حتى ${dateText(g.reportingDate)}`, `Collected revenue to ${dateText(g.reportingDate)}`)} value={short(g.collected)} sub={L('منذ بداية السنة — حتى تاريخ التقرير', 'year to date — to the reporting date')} />
              <MetricTile label={L('نسبة التحصيل الحالية', 'Current collection rate')} value={pct(g.collectionRate)} tone={g.achieved ? 'good' : undefined} sub={L(`الإيرادات المحصلة ÷ إجمالي الفواتير المعدّل (الهدف ${Math.round(g.rate * 100)}%)`, `Collected revenue ÷ adjusted total (target ${Math.round(g.rate * 100)}%)`)} />
              <MetricTile label={L('المتبقي للوصول إلى الهدف', 'Remaining to reach the target')} value={short(g.remaining)} tone={g.achieved ? 'good' : 'warn'} sub={g.achieved ? L('تم تحقيق المستهدف', 'Target reached') : L('الهدف السنوي − الإيرادات المحصلة', 'Annual target − collected revenue')} />
            </div>

            <div className="card st-card cg-chart">
              <b>{L('الإيرادات المحصلة التراكمية بالأشهر: المخطط مقابل الفعلي', 'Cumulative collected revenue by month: plan versus actual')}</b>
              <CollectionChart year={year} planned={planned} actual={g.actual} plannedLabel={L('المخطط (تراكمي)', 'Plan (cumulative)')} actualLabel={L('الفعلي (تراكمي)', 'Actual (cumulative)')} label={L('رسم الإيرادات المحصلة التراكمية: المخطط مقابل الفعلي', 'Chart of cumulative collected revenue: plan versus actual')} />
              <table className="sr-only"><caption>{L('الإيرادات المحصلة التراكمية بالأشهر', 'Cumulative collected revenue by month')}</caption>
                <thead><tr><th>{L('الشهر', 'Month')}</th><th>{L('المخطط', 'Plan')}</th><th>{L('الفعلي', 'Actual')}</th></tr></thead>
                <tbody>{planned.map((p, i) => <tr key={i}><td>{i + 1}</td><td>{sar(p)}</td><td>{g.actual[i] == null ? '—' : sar(g.actual[i])}</td></tr>)}</tbody></table>
              <div className="cg-plan">
                {g.plan.source === 'assumed'
                  ? <span><b>{L('افتراض تخطيطي:', 'Planning assumption:')}</b> {L('لا توجد خطة شهرية معتمدة، فالمستهدف موزّع بالتساوي على 12 شهراً (افتراض بلا أساس موسمي). الفعلي يُعرض حتى تاريخ التقرير فقط.', 'There is no approved monthly plan, so the target is spread evenly over 12 months (an assumption with no seasonal basis). Actual is shown only up to the reporting date.')}</span>
                  : <span>{L(`مسودة خطة محفوظة (${dateText(g.plan.savedAt.slice(0, 10))}) بهدف سنوي ${short(g.plan.annualTarget)}؛ حفظها لا يعني اعتمادها — لم يعتمدها أحد بعد. أشهرها ثابتة ولا تتغير تلقائياً.`, `Draft plan saved (${dateText(g.plan.savedAt.slice(0, 10))}) with an annual target of ${short(g.plan.annualTarget)}. Saving is not approval — nobody has approved it. Its months stay fixed and are never changed automatically.`)}</span>}
                {g.plan.drift && <div className="rv-callout rv-callout--warn" role="status" style={{ marginTop: 8 }}>{L(`تغيّر الهدف المحتسب منذ حفظ الخطة: المحفوظ ${short(g.plan.drift.saved)}، والحالي ${short(g.plan.drift.live)} (تغيّر المفوتر أو الاستبعادات أو النسبة). الرسم يعرض الخطة المحفوظة.`, `The calculated target has changed since the plan was saved: saved ${short(g.plan.drift.saved)}, now ${short(g.plan.drift.live)} (billed amounts, exclusions or the rate changed). The chart shows the saved plan.`)}
                  {canEdit && !closedYear && rateValid && <> <button type="button" className="btn btn-sm" onClick={doRebase}>{L('تحديث المسودة', 'Update the draft')}</button></>}</div>}
                {g.plan.source === 'assumed' && canEdit && rateValid && <> <button type="button" className="btn btn-sm" onClick={doSave}>{L('حفظ مسودة الخطة (تثبيت الأشهر)', 'Save as draft plan (fix the months)')}</button></>}
                {!canEdit && <div className="muted" style={{ fontSize: 12 }}>{L('دورك للقراءة فقط: لا يمكنك حفظ مسودة الخطة.', 'Your role is read-only: you cannot save a draft plan.')}</div>}
              </div>
            </div>

            <div className="card st-card cg-explain" role="region" aria-label={L('تقدم الإيرادات المحصلة مقابل الخطة', 'Progress against the plan')}>
              <b>{L('أين نحن من الخطة؟', 'Where are we against the plan?')}</b>
              {g.achieved && g.target > 0 ? (
                <p>{L(`تم تحقيق المستهدف: حُصّل ${short(g.collected)} من هدف ${short(g.target)}${g.exceededBy > 0 ? ` (بزيادة ${short(g.exceededBy)})` : ''}.`, `The target is reached: ${short(g.collected)} collected against a target of ${short(g.target)}${g.exceededBy > 0 ? ` (${short(g.exceededBy)} above it)` : ''}.`)}</p>
              ) : (
                <>
                  <p>{L(`حتى ${dateText(g.reportingDate)} حُصّل ${short(g.collected)} مقابل ${short(g.plannedToDate)} مخطط حتى هذا التاريخ، أي ${g.versusPlan >= 0 ? 'متقدم عن الخطة' : 'متأخر عن الخطة'} بمقدار ${short(Math.abs(g.versusPlan))}.`, `To ${dateText(g.reportingDate)}, ${short(g.collected)} was collected against ${short(g.plannedToDate)} planned to this date: ${g.versusPlan >= 0 ? 'ahead of' : 'behind'} the plan by ${short(Math.abs(g.versusPlan))}.`)}</p>
                  {g.yearEnded
                    ? <p>{L(`انتهت السنة دون تحقيق الهدف؛ الفجوة ${short(g.remaining)}.`, `The year ended without reaching the target; the gap is ${short(g.remaining)}.`)}</p>
                    : <p>{L(`المتبقي للهدف ${short(g.remaining)} خلال ${g.pace.monthsLeft.toFixed(1)} شهراً تقريباً (الشهر الحالي بنسبة أيامه المتبقية)، أي متوسط تحصيل مطلوب ${short(g.pace.requiredPerMonth)} شهرياً، مقابل ${short(g.pace.plannedPerMonth)} شهرياً في الخطة.`, `${short(g.remaining)} remains to the target over about ${g.pace.monthsLeft.toFixed(1)} months (the current month counted by its remaining days): an average of ${short(g.pace.requiredPerMonth)} per month is needed, against ${short(g.pace.plannedPerMonth)} per month in the plan.`)}</p>}
                </>
              )}
              <div className="muted" style={{ fontSize: 12 }}>{L('لا تُعرض إجراءات مقترحة لأن بيانات الفواتير وحدها لا تبيّن سبب الفجوة. ', 'No actions are suggested: the invoice data alone does not show why there is a gap. ')}<Link className="xref" to="/collection">{L('عرض الفواتير المتبقية (قائمة التحصيل)', 'Open the remaining invoices (collection worklist)')}</Link></div>
            </div>
          </>
        )}
      </AsyncBlock>
    </div>
  );
}
