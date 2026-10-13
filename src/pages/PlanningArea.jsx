// «التخطيط المالي والاستراتيجي» — the Strategic Dashboard, reduced to ONE question: how much of this year's revenue appropriation has been collected?
//   What must be collected (the «الاعتماد مقابل الإيراد» of chapters 1–3)?  ·  How much has been collected, month by month?  ·  How much remains?  ·  What was spent on chapters 1–3 (Ministry of Finance, cumulative)?
// One fiscal year (up to the reporting date), one entity or the whole Ministry, the same for every figure and for the chart. The calculations are in src/data/collectionGoal.js, the (illustrative) appropriation figures in
// src/data/appropriations.js. There are no scenarios, forecasts, assistants, registers or configuration screens here.
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
import { EXCLUSION_RULES, normalizeConfig } from '../data/revenueMetrics';
import { fmtDateText } from '../data/clock';
import { computeGoal, reportingDateFor, loadGoalStore, saveGoalStore, savePlan, rebasePlan, planKey } from '../data/collectionGoal';
import { appropriationOf, appropriationTotal, appropriationKeys, appropriationAsOfEnd, HQ_KEY, APPROPRIATION_YEAR, APPROPRIATION_AS_OF } from '../data/appropriations';

const pct = (v) => (Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : '—');
const UNASSIGNED = 'Unassigned';

export default function PlanningArea() {
  const rev = useRevenue(); const { user } = useAuth();
  const { L, ar, lang, short, sar } = useAr();
  const today = rev.cfg.cutoff; const todayYear = Number(today.slice(0, 4));
  const years = useMemo(() => { const out = []; for (let y = todayYear; y >= Number(DATA_START.slice(0, 4)); y -= 1) out.push(y); return out; }, [todayYear]);
  const [year, setYear] = useState(todayYear);
  const [amanah, setAmanah] = useState('all');
  const [retry, setRetry] = useState(0);
  const options = useMemo(() => amanahFilterOptions().filter((a) => !rev.org.amanahKeys || rev.org.amanahKeys.includes(a.key)), [rev.org]);
  const nameOf = (k) => { if (k === HQ_KEY) return L('ديوان عام الوزارة (المقر)', 'Ministry headquarters'); const a = amanahFilterOptions().find((x) => x.key === k); return a ? (ar ? a.ar : a.en) : k; };
  const [store, setStore] = useState(loadGoalStore);
  const key = planKey(year, amanah); const saved = store.plans[key] || null;
  const canEdit = rev.canReview; const by = actorName(user, lang) || 'user';
  const [toast, setToast] = useState('');

  // the entities with an appropriation that this user may see (a restricted organisation sees only its own Amanahs and never the headquarters)
  const visibleKeys = useMemo(() => appropriationKeys().filter((k) => (rev.org.amanahKeys ? rev.org.amanahKeys.includes(k) : true)), [rev.org]);
  const A = amanah === 'all' ? appropriationTotal(visibleKeys, year) : appropriationOf(amanah, year);

  // ONE data request set: the payments received from 1 January to the reporting date (payment-date basis, any invoice) — by Amanah for the table, month by month for the chart.
  // Payments on cancelled invoices and on invoices excluded under APPROVED rules are not counted (rules the business has not approved are never applied here).
  const reporting = reportingDateFor(year, today);
  const approvedCfg = useMemo(() => normalizeConfig({ ...rev.cfg, rules: Object.fromEntries(EXCLUSION_RULES.map((r) => [r.id, r.approval === 'approved'])) }), [rev.cfg]);
  const DATA = useAsync(async () => {
    if (!reporting) return null;
    const scope = { from: `${year}-01-01`, to: reporting, amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all' };
    // coverage compares spending with collection over the SAME period: payments from 1 January to the end of the last month the Ministry of Finance has closed
    const asOfEnd = appropriationAsOfEnd(); const sameCut = year === APPROPRIATION_YEAR && asOfEnd < reporting ? asOfEnd : reporting;
    const [snap, ser, snapCut] = await Promise.all([
      rev.data.snapshot(scope, { cfg: approvedCfg }),
      rev.data.series({ ...scope, amanah }, { cfg: approvedCfg }),
      sameCut === reporting ? null : rev.data.snapshot({ ...scope, to: sameCut }, { cfg: approvedCfg })
    ]);
    const R = snap.receivedInPeriod; const C = (snapCut || snap).receivedInPeriod;
    return { byAmanah: R.byAmanah || {}, total: R.total, monthly: ser.values, cutByAmanah: C.byAmanah || {}, cutTotal: C.total, cutDate: sameCut };
  }, [rev.data, year, amanah, reporting, approvedCfg, retry]);

  const g = useMemo(() => (DATA.data ? computeGoal({ year, today, target: A?.revAdjusted, monthlyCollected: DATA.data.monthly, plan: saved }) : null), [DATA.data, year, today, A, saved]);
  const dateText = (iso) => fmtDateText(iso, lang);
  const monthText = (ym) => fmtDateText(`${ym}-01`, lang).replace(/^\d+\s*/, '');
  const entityName = amanah === 'all' ? L('الوزارة (كل الجهات)', 'The Ministry (all entities)') : nameOf(amanah);

  const commit = (fn, msg) => { const next = fn(store); setStore(next); saveGoalStore(next); setToast(msg); };
  const planArgs = () => ({ year, amanah, annualTarget: g.target, at: new Date().toISOString(), by });
  const doSave = () => commit((s) => savePlan(s, planArgs()), L('حُفظت مسودة الخطة الشهرية (غير معتمدة): أشهرها ثابتة ولا تتغير عند تغيّر الاعتماد.', 'The draft monthly plan is saved (not approved): its months stay fixed when the appropriation changes.'));
  const doRebase = () => commit((s) => rebasePlan(s, { ...planArgs(), today }), L('حُدّثت مسودة الخطة: الأشهر المنتهية كما هي، والهدف الجديد موزّع بالتساوي على بقية الأشهر.', 'The draft plan is updated: closed months are unchanged, the new target is spread evenly over the remaining months.'));
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(''), 6000); return () => clearTimeout(t); }, [toast]);

  const ok = g && g.state === 'ok';
  const noTarget = g && g.state === 'no_target';
  const planned = ok ? g.plan.cumulative : [];
  const closedYear = ok && year < todayYear; // a closed year's saved plan is never updated

  // the table: every entity with the same figures as the tiles (the Ministry row is the sum of the rows shown)
  const rows = useMemo(() => {
    if (!DATA.data) return [];
    const recv = DATA.data.byAmanah;
    const cut = DATA.data.cutByAmanah;
    const list = visibleKeys.map((k) => { const a = appropriationOf(k, year); return { key: k, a, collected: recv[k] || 0, cut: cut[k] || 0 }; })
      .sort((x, y) => (y.a?.revAdjusted || 0) - (x.a?.revAdjusted || 0) || (y.a?.expAdjusted || 0) - (x.a?.expAdjusted || 0));
    if (!rev.org.amanahKeys || rev.org.amanahKeys.includes(UNASSIGNED)) list.push({ key: UNASSIGNED, a: null, collected: recv[UNASSIGNED] || 0, cut: cut[UNASSIGNED] || 0 });
    return list;
  }, [DATA.data, visibleKeys, year, rev.org]);
  const sum = (f) => rows.reduce((t, r) => t + (r.a ? r.a[f] : 0), 0);
  const totalCollected = rows.reduce((t, r) => t + r.collected, 0);
  const totalCut = rows.reduce((t, r) => t + r.cut, 0);
  const cover = (collectedCut, a) => (a && a.expSpent > 0 && collectedCut != null ? collectedCut / a.expSpent : null);
  const asOfText = monthText(APPROPRIATION_AS_OF);

  const basis = (ok || noTarget) ? (
    <div className="muted cg-basis">
      <div>{L(`العام المالي ${year}: ${dateText(`${year}-01-01`)} – ${dateText(g.reportingDate)} (تاريخ التقرير) · ${entityName}.`, `Fiscal year ${year}: ${dateText(`${year}-01-01`)} – ${dateText(g.reportingDate)} (reporting date) · ${entityName}.`)}</div>
      <div>{L('المستهدف = الاعتماد مقابل الإيراد بعد التعديل للأبواب 1–3، أي المبالغ المفترض تحصيلها خلال العام المالي. المحصّل = المدفوعات المستلمة عبر «تحصيل» في الفترة بتاريخ الدفع على أي فاتورة (دون الفواتير الملغاة والمستبعدة بقواعد معتمدة).', 'Target = the revenue appropriation after adjustment for chapters 1–3 — the amounts expected to be collected during the fiscal year. Collected = Tahseel payments received in the period by payment date on any invoice (cancelled invoices and invoices excluded under approved rules are left out).')}</div>
      <div><span className="rv-tag rv-tag--warn">{L('بيانات توضيحية', 'Illustrative data')}</span> {L('أرقام الاعتماد والمنصرف مُنشأة لهذا العرض على هيكل ملف الأداء المالي لوزارة المالية (الأبواب 1–3)، وليست أرقاماً رسمية؛ تُستبدل عند تحميل الملف الفعلي.', 'The appropriation and expenditure figures are generated for this demo on the structure of the Ministry of Finance financial-performance file (chapters 1–3); they are not official figures and are replaced when the actual file is loaded.')}</div>
    </div>
  ) : null;

  const cutCollected = DATA.data ? (amanah === 'all' ? DATA.data.cutTotal : DATA.data.cutByAmanah[amanah] || 0) : 0;
  const expenditure = A && DATA.data ? (
    <div className="card st-card cg-explain" role="region" aria-label={L('النفقات على الأبواب 1–3', 'Expenditure on chapters 1–3')}>
      <b>{L(`النفقات على الأبواب 1–3 — المنصرف التراكمي لدى وزارة المالية حتى ${asOfText}`, `Expenditure on chapters 1–3 — cumulative spending recorded by the Ministry of Finance to ${asOfText}`)}</b>
      <div className="rv-tiles cg-tiles">
        <MetricTile label={L('اعتماد النفقات بعد التعديل', 'Expenditure appropriation (adjusted)')} value={short(A.expAdjusted)} sub={L(`الأصلي ${short(A.expOriginal)}`, `original ${short(A.expOriginal)}`)} />
        <MetricTile label={L('المنصرف التراكمي', 'Cumulative spending')} value={short(A.expSpent)} sub={L(`حتى ${asOfText} — آخر شهر أغلقته وزارة المالية`, `to ${asOfText} — the last month closed by the Ministry of Finance`)} />
        <MetricTile label={L('نسبة الصرف', 'Spending rate')} value={pct(A.expSpent / A.expAdjusted)} sub={L('المنصرف ÷ الاعتماد بعد التعديل', 'Spending ÷ adjusted appropriation')} />
        <MetricTile label={L('المتبقي من الاعتماد', 'Appropriation remaining')} value={short(Math.max(A.expAdjusted - A.expSpent, 0))} sub={L('الاعتماد − المنصرف', 'Appropriation − spending')} />
        <MetricTile label={L('تغطية المنصرف بالتحصيل', 'Spending covered by collection')} value={pct(cover(cutCollected, A))} tone={cover(cutCollected, A) >= 1 ? 'good' : undefined} sub={L(`المحصّل حتى ${dateText(DATA.data.cutDate)} (${short(cutCollected)}) ÷ المنصرف التراكمي`, `Collected to ${dateText(DATA.data.cutDate)} (${short(cutCollected)}) ÷ cumulative spending`)} />
      </div>
      <div className="muted" style={{ fontSize: 12 }}>{L('التغطية = ما حُصّل (مدفوعات «تحصيل» الفعلية، لا الفوترة) من بداية العام حتى نهاية آخر شهر أغلقته وزارة المالية ÷ المنصرف التراكمي على الأبواب 1–3 في الفترة نفسها، فيُقارَن الرقمان على فترة واحدة. المنصرف يُحدَّث شهرياً من وزارة المالية فيتأخر عن بيانات الفواتير.', 'Coverage = what was actually collected (Tahseel payments, not billing) from the start of the year to the end of the last month closed by the Ministry of Finance ÷ cumulative spending on chapters 1–3 over the same period, so both figures cover one period. Spending is updated monthly by the Ministry of Finance, so it lags the invoice data.')}</div>
    </div>
  ) : null;

  return (
    <div className="st-page" dir={ar ? 'rtl' : 'ltr'}>
      <header className="st-head">
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>{L('التخطيط المالي والاستراتيجي', 'Financial and strategic planning')}</h1>
          <div className="muted" style={{ fontSize: 13 }}>{L('كم حُصّل من الاعتماد مقابل الإيراد، وما المتبقي، وكم صُرف على الأبواب 1–3.', 'How much of the revenue appropriation has been collected, what remains, and what was spent on chapters 1–3.')}</div>
        </div>
      </header>

      <div className="card card-pad cg-controls">
        <label className="cg-field" htmlFor="cg-year">{L('العام المالي', 'Fiscal year')}
          <select id="cg-year" className="input" value={year} onChange={(e) => setYear(Number(e.target.value))}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>
        </label>
        <label className="cg-field" htmlFor="cg-amanah">{L('الجهة', 'Entity')}
          <select id="cg-amanah" className="input" value={amanah} onChange={(e) => setAmanah(e.target.value)}>
            <option value="all">{L('الوزارة (كل الجهات)', 'The Ministry (all entities)')}</option>
            {options.map((a) => <option key={a.key} value={a.key}>{ar ? a.ar : a.en}</option>)}
          </select>
        </label>
        <div className="cg-equiv" role="status">
          {A ? <>{L('الاعتماد مقابل الإيراد (بعد التعديل)', 'Revenue appropriation (adjusted)')}: <b dir="ltr">{short(A.revAdjusted)}</b> <span className="muted">({L('الأصلي', 'original')} {short(A.revOriginal)})</span></> : <span className="muted">{L(`لا يتوفر اعتماد مقابل إيراد لهذا الاختيار في ${year}.`, `No revenue appropriation is available for this selection in ${year}.`)}</span>}
          <div className="muted" style={{ fontSize: 12 }}>{L(`الاعتمادات المحمّلة للعام المالي ${APPROPRIATION_YEAR} فقط.`, `Appropriations are loaded for fiscal year ${APPROPRIATION_YEAR} only.`)}</div>
        </div>
      </div>

      {toast && <div className="rv-callout" role="status">{toast}</div>}

      <AsyncBlock state={DATA} onRetry={() => setRetry((n) => n + 1)} height={260}>
        {noTarget && (
          <>
            {basis}
            <div className="rv-callout rv-callout--warn" role="status">
              <b>{L('لم يتم تحديد مستهدف تحصيل صالح.', 'No valid collection target has been set.')}</b>
              <div style={{ fontSize: 13, marginTop: 4 }}>{L(`لا يوجد اعتماد مقابل إيراد صالح (${entityName}) في ${year}، فلا توجد قاعدة صالحة لاحتساب نسبة التحصيل، ولا يُعدّ التحصيل الصفري أو غير المقابل باعتماد نجاحاً. «تم تحقيق المستهدف» لا تظهر دون مستهدف موجب صالح.`, `There is no valid revenue appropriation (${entityName}) in ${year}, so there is no valid base for the collection rate; zero collection, or collection with no appropriation, is never shown as success. "Target reached" is never shown without a valid positive target.`)}</div>
            </div>
            <div className="rv-tiles cg-tiles">
              <MetricTile label={L(`المحصّل حتى ${dateText(g.reportingDate)}`, `Collected to ${dateText(g.reportingDate)}`)} value={short(g.collected)} sub={L('منذ بداية السنة — بتاريخ الدفع', 'year to date — by payment date')} />
              <MetricTile label={L('المبلغ المستهدف تحصيله', 'Target collection amount')} value={L('غير محدد', 'Not set')} sub={L('لا يوجد اعتماد مقابل إيراد', 'no revenue appropriation')} />
            </div>
          </>
        )}
        {ok && (
          <>
            {basis}
            <div className="rv-tiles cg-tiles">
              <MetricTile label={L('الاعتماد مقابل الإيراد (المستهدف السنوي)', 'Revenue appropriation (annual target)')} value={short(g.target)} sub={L(`بعد التعديل — الأصلي ${short(A.revOriginal)}`, `adjusted — original ${short(A.revOriginal)}`)} />
              <MetricTile label={L(`المحصّل حتى ${dateText(g.reportingDate)}`, `Collected to ${dateText(g.reportingDate)}`)} value={short(g.collected)} sub={L('منذ بداية السنة — بتاريخ الدفع', 'year to date — by payment date')} />
              <MetricTile label={L('نسبة المحصّل من الاعتماد', 'Share of the appropriation collected')} value={pct(g.collectionRate)} tone={g.achieved ? 'good' : undefined} sub={L('المحصّل ÷ الاعتماد بعد التعديل', 'Collected ÷ adjusted appropriation')} />
              <MetricTile label={L('المتبقي للوصول إلى الاعتماد', 'Remaining to the appropriation')} value={short(g.remaining)} tone={g.achieved ? 'good' : 'warn'} sub={g.achieved ? L('تم تحقيق المستهدف', 'Target reached') : L('الاعتماد − المحصّل', 'Appropriation − collected')} />
            </div>

            <div className="card st-card cg-chart">
              <b>{L('المحصّل التراكمي بالأشهر: المخطط مقابل الفعلي', 'Cumulative collected by month: plan versus actual')}</b>
              <CollectionChart year={year} planned={planned} actual={g.actual} plannedLabel={L('المخطط (تراكمي)', 'Plan (cumulative)')} actualLabel={L('الفعلي (تراكمي)', 'Actual (cumulative)')} label={L('رسم المحصّل التراكمي: المخطط مقابل الفعلي', 'Chart of cumulative collected: plan versus actual')} />
              <table className="sr-only"><caption>{L('المحصّل التراكمي بالأشهر', 'Cumulative collected by month')}</caption>
                <thead><tr><th>{L('الشهر', 'Month')}</th><th>{L('المخطط', 'Plan')}</th><th>{L('الفعلي', 'Actual')}</th></tr></thead>
                <tbody>{planned.map((p, i) => <tr key={i}><td>{i + 1}</td><td>{sar(p)}</td><td>{g.actual[i] == null ? '—' : sar(g.actual[i])}</td></tr>)}</tbody></table>
              <div className="cg-plan">
                {g.plan.source === 'assumed'
                  ? <span><b>{L('التوزيع الشهري:', 'Monthly spread:')}</b> {L('المستهدف موزّع بالتساوي على 12 شهراً وفق توجيه الأعمال (لا توزيع موسمي). الفعلي يُعرض حتى تاريخ التقرير فقط، والخطة المحفوظة مسودة إلى أن تُعتمد.', 'The target is spread evenly over 12 months as the business directed (no seasonal spread). Actual is shown only up to the reporting date, and a saved plan stays a draft until it is approved.')}</span>
                  : <span>{L(`مسودة خطة محفوظة (${dateText(g.plan.savedAt.slice(0, 10))}) بهدف سنوي ${short(g.plan.annualTarget)}؛ حفظها لا يعني اعتمادها — لم يعتمدها أحد بعد. أشهرها ثابتة ولا تتغير تلقائياً.`, `Draft plan saved (${dateText(g.plan.savedAt.slice(0, 10))}) with an annual target of ${short(g.plan.annualTarget)}. Saving is not approval — nobody has approved it. Its months stay fixed and are never changed automatically.`)}</span>}
                {g.plan.drift && <div className="rv-callout rv-callout--warn" role="status" style={{ marginTop: 8 }}>{L(`تغيّر الاعتماد منذ حفظ الخطة: المحفوظ ${short(g.plan.drift.saved)}، والحالي ${short(g.plan.drift.live)}. الرسم يعرض الخطة المحفوظة.`, `The appropriation has changed since the plan was saved: saved ${short(g.plan.drift.saved)}, now ${short(g.plan.drift.live)}. The chart shows the saved plan.`)}
                  {canEdit && !closedYear && <> <button type="button" className="btn btn-sm" onClick={doRebase}>{L('تحديث المسودة', 'Update the draft')}</button></>}</div>}
                {g.plan.source === 'assumed' && canEdit && <> <button type="button" className="btn btn-sm" onClick={doSave}>{L('حفظ مسودة الخطة (تثبيت الأشهر)', 'Save as draft plan (fix the months)')}</button></>}
                {!canEdit && <div className="muted" style={{ fontSize: 12 }}>{L('دورك للقراءة فقط: لا يمكنك حفظ مسودة الخطة.', 'Your role is read-only: you cannot save a draft plan.')}</div>}
              </div>
            </div>

            <div className="card st-card cg-explain" role="region" aria-label={L('تقدم المحصّل مقابل الخطة', 'Progress against the plan')}>
              <b>{L('أين نحن من الخطة؟', 'Where are we against the plan?')}</b>
              {g.achieved ? (
                <p>{L(`تم تحقيق المستهدف: حُصّل ${short(g.collected)} من اعتماد ${short(g.target)}${g.exceededBy > 0 ? ` (بزيادة ${short(g.exceededBy)})` : ''}.`, `The target is reached: ${short(g.collected)} collected against an appropriation of ${short(g.target)}${g.exceededBy > 0 ? ` (${short(g.exceededBy)} above it)` : ''}.`)}</p>
              ) : (
                <>
                  <p>{L(`حتى ${dateText(g.reportingDate)} حُصّل ${short(g.collected)} مقابل ${short(g.plannedToDate)} مخطط حتى هذا التاريخ، أي ${g.versusPlan >= 0 ? 'متقدم عن الخطة' : 'متأخر عن الخطة'} بمقدار ${short(Math.abs(g.versusPlan))}.`, `To ${dateText(g.reportingDate)}, ${short(g.collected)} was collected against ${short(g.plannedToDate)} planned to this date: ${g.versusPlan >= 0 ? 'ahead of' : 'behind'} the plan by ${short(Math.abs(g.versusPlan))}.`)}</p>
                  {g.yearEnded
                    ? <p>{L(`انتهت السنة دون تحقيق الهدف؛ الفجوة ${short(g.remaining)}.`, `The year ended without reaching the target; the gap is ${short(g.remaining)}.`)}</p>
                    : <p>{L(`المتبقي للاعتماد ${short(g.remaining)} خلال ${g.pace.monthsLeft.toFixed(1)} شهراً تقريباً (الشهر الحالي بنسبة أيامه المتبقية)، أي متوسط تحصيل مطلوب ${short(g.pace.requiredPerMonth)} شهرياً، مقابل ${short(g.pace.plannedPerMonth)} شهرياً في الخطة.`, `${short(g.remaining)} remains to the appropriation over about ${g.pace.monthsLeft.toFixed(1)} months (the current month counted by its remaining days): an average of ${short(g.pace.requiredPerMonth)} per month is needed, against ${short(g.pace.plannedPerMonth)} per month in the plan.`)}</p>}
                </>
              )}
              <div className="muted" style={{ fontSize: 12 }}>{L('لا تُعرض إجراءات مقترحة لأن بيانات الفواتير وحدها لا تبيّن سبب الفجوة. ', 'No actions are suggested: the invoice data alone does not show why there is a gap. ')}<Link className="xref" to="/collection">{L('عرض الفواتير المتبقية (قائمة التحصيل)', 'Open the remaining invoices (collection worklist)')}</Link></div>
            </div>
          </>
        )}

        {(ok || noTarget) && expenditure}

        {(ok || noTarget) && year === APPROPRIATION_YEAR && rows.length > 0 && (
          <div className="card st-card">
            <b>{L(`الاعتماد مقابل الإيراد والمنصرف حسب الجهة — العام المالي ${year}`, `Revenue appropriation and spending by entity — fiscal year ${year}`)}</b>
            <div className="st-table-wrap" tabIndex={0}>
              <table className="table" aria-label={L('الاعتماد مقابل الإيراد والمنصرف حسب الجهة', 'Revenue appropriation and spending by entity')}>
                <thead><tr>
                  <th>{L('الجهة', 'Entity')}</th>
                  <th>{L('الاعتماد مقابل الإيراد (بعد التعديل)', 'Revenue appropriation (adjusted)')}</th>
                  <th>{L('المحصّل', 'Collected')}</th>
                  <th>{L('نسبة المحصّل', 'Share collected')}</th>
                  <th>{L('المتبقي للتحصيل', 'Remaining to collect')}</th>
                  <th>{L('اعتماد النفقات (بعد التعديل)', 'Expenditure appropriation (adjusted)')}</th>
                  <th>{L('المنصرف التراكمي', 'Cumulative spending')}</th>
                  <th>{L('نسبة الصرف', 'Spending rate')}</th>
                  <th>{L('تغطية المنصرف بالتحصيل', 'Spending covered by collection')}</th>
                </tr></thead>
                <tbody>
                  {rows.map((r) => { const rv = r.a?.revAdjusted || 0; return (
                    <tr key={r.key} aria-current={r.key === amanah ? 'true' : undefined} style={r.key === amanah ? { fontWeight: 600 } : undefined}>
                      <td>{r.key === UNASSIGNED ? L('غير محدد الأمانة (لم تُطابق في مكين)', 'Unassigned (not matched in Makeen)') : nameOf(r.key)}</td>
                      <td dir="ltr">{rv > 0 ? short(rv) : '—'}</td>
                      <td dir="ltr">{r.collected > 0 || rv > 0 ? short(r.collected) : '—'}</td>
                      <td dir="ltr">{rv > 0 ? pct(r.collected / rv) : '—'}</td>
                      <td dir="ltr">{rv > 0 ? short(Math.max(rv - r.collected, 0)) : '—'}</td>
                      <td dir="ltr">{r.a ? short(r.a.expAdjusted) : '—'}</td>
                      <td dir="ltr">{r.a ? short(r.a.expSpent) : '—'}</td>
                      <td dir="ltr">{r.a ? pct(r.a.expSpent / r.a.expAdjusted) : '—'}</td>
                      <td dir="ltr">{r.a && r.a.revAdjusted > 0 ? pct(cover(r.cut, r.a)) : '—'}</td>
                    </tr>); })}
                </tbody>
                <tfoot><tr>
                  <td><b>{rev.org.amanahKeys ? L('إجمالي ما يظهر', 'Total shown') : L('إجمالي الوزارة', 'Ministry total')}</b></td>
                  <td dir="ltr"><b>{short(sum('revAdjusted'))}</b></td>
                  <td dir="ltr"><b>{short(totalCollected)}</b></td>
                  <td dir="ltr"><b>{sum('revAdjusted') > 0 ? pct(totalCollected / sum('revAdjusted')) : '—'}</b></td>
                  <td dir="ltr"><b>{short(Math.max(sum('revAdjusted') - totalCollected, 0))}</b></td>
                  <td dir="ltr"><b>{short(sum('expAdjusted'))}</b></td>
                  <td dir="ltr"><b>{short(sum('expSpent'))}</b></td>
                  <td dir="ltr"><b>{sum('expAdjusted') > 0 ? pct(sum('expSpent') / sum('expAdjusted')) : '—'}</b></td>
                  <td dir="ltr"><b>{sum('expSpent') > 0 ? pct(totalCut / sum('expSpent')) : '—'}</b></td>
                </tr></tfoot>
              </table>
            </div>
            <div className="muted" style={{ fontSize: 12 }}>{L('المحصّل في الجهة «غير محدد الأمانة» لا يقابله اعتماد، لكنه داخل إجمالي الوزارة. ديوان عام الوزارة بلا إيراد خاص به: نفقات فقط، فلا تُحسب له تغطية، ويدخل منصرفه في إجمالي الوزارة. تغطية كل جهة محسوبة حتى نهاية آخر شهر مغلق لدى وزارة المالية.', 'Payments in «Unassigned» have no appropriation but are inside the Ministry total. The headquarters has no revenue of its own: spending only, so it has no coverage figure, and its spending is inside the Ministry total. Each entity’s coverage is calculated to the end of the last month closed by the Ministry of Finance.')}</div>
          </div>
        )}
      </AsyncBlock>
    </div>
  );
}
