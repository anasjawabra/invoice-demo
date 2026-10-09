// What-if panel. A user-defined scenario is drawn separately from actuals, targets and forecasts. Levers are applied in a fixed order on a
// shared pool (see strategicCalc.js) so nothing is counted twice; resolving a case is never cash; billing is separate from collection.
import React, { useMemo } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useAr } from '../../utils/useAr';
import { chartUnit, fmtMoney, fmtSar, scaled, unitOfValues } from '../../utils/money';
import { runScenario, scenarioBase, SCENARIO_LIMITS, DEFAULT_SCENARIO } from '../../data/strategicCalc';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export const LEVERS = [
  { k: 'billing', ar: 'تغيّر الفوترة المتوقع', en: 'Expected billing change', unit: '%', step: 1, hint: { ar: 'يغيّر صافي المفوتر؛ ويُحصَّل الجديد بمعدل التحصيل الحالي فقط (الفوترة ليست تحصيلاً).', en: 'Changes net billed; the added billing is collected only at the current rate (billing is not collection).' }, cash: true },
  { k: 'resolve', ar: 'مراجعة الاستبعادات المعلّقة', en: 'Pending cases resolved', unit: '%', step: 5, hint: { ar: 'نسبة استبعادات المرشحين التي تُحسم. الحسم لا يعني نقداً محصّلاً.', en: 'Share of pending exclusion candidates that get decided. Deciding is not cash.' }, cash: false },
  { k: 'approve', ar: 'نسبة ما يُقبل استبعاده', en: '…of which approved as exclusions', unit: '%', step: 5, hint: { ar: 'المحسوم كاستبعاد يخفض صافي المفوتر فتتحرك النسبة حسابياً بلا نقد؛ وما عداه يبقى ضمن الصافي بلا تغيير في المبلغ.', en: 'Approved cases reduce net billed so the rate moves arithmetically with no cash; the rest stays in net unchanged.' }, cash: false },
  { k: 'dRate', ar: 'تغيير معدل التحصيل', en: 'Collection-rate change', unit: 'pp', step: 0.5, hint: { ar: 'بالنقاط المئوية من صافي المفوتر (وليس نسبة نسبية).', en: 'In percentage points of net billed (not a relative change).' }, cash: true },
  { k: 'recovery', ar: 'استرداد المتأخر القابل للتحصيل', en: 'Recovery of collectible overdue balances', unit: '%', step: 5, hint: { ar: 'من المتأخر والجزئي غير المتنازع عليه والذي لم يحصّله عامل معدل التحصيل.', en: 'Of undisputed overdue / partial balances not already collected by the rate lever.' }, cash: true },
  { k: 'slip', ar: 'تأخّر المقبوضات الإضافية عن تاريخ الخطة', en: 'Share of additional receipts arriving after the planning date', unit: '%', step: 5, hint: { ar: 'توقيت المقبوضات: ما يتأخر يُستبعد من مقبوضات الأفق ولا يُلغى.', en: 'Timing of receipts: what slips is excluded from the horizon receipts, not cancelled.' }, cash: true, funding: true },
  { k: 'expense', ar: 'تغيّر الإنفاق للأشهر المتبقية', en: 'Expected change in remaining expenditure', unit: '%', step: 1, hint: { ar: 'يطبَّق على الصرف المتوقع للأشهر المتبقية فقط ولا يغيّر الصرف الفعلي.', en: 'Applied to the projected payments of the remaining months only; actual payments are untouched.' }, cash: true, funding: true }
];

export default function ScenarioPanel({ snapshot, targets, scenario, setScenario, planDate, setPlanDate, today, onSaveToRegister, canEdit, financeOk = false, children = null }) {
  const { L, B, ar, lang, isRtl } = useAr();
  const base = useMemo(() => scenarioBase(snapshot), [snapshot]);
  const res = useMemo(() => runScenario(base, scenario, targets.collectionRate.value), [base, scenario, targets]);
  const T = snapshot.totals;
  const unit = unitOfValues([base.N, res.scenario.net, res.target?.scenarioCollectedNeeded || 0]);
  const m = (v) => fmtMoney(v, { lang, unit }); const mAuto = (v) => fmtMoney(v, { lang });
  const pct = (v) => (v == null ? L('غير متاحة', 'Not available') : `${(v * 100).toFixed(1)}%`);
  const cu = useMemo(() => chartUnit([res.baseline.collected, res.scenario.collected, res.baseline.uncollected, res.scenario.uncollected, res.target?.scenarioCollectedNeeded || 0], lang), [res, lang]);
  const data = useMemo(() => ({
    labels: [L('المحصّل', 'Collected'), L('غير المحصّل', 'Uncollected'), L('المطلوب لبلوغ المستهدف التجريبي', 'Needed for the demo target')],
    datasets: [
      { label: L('الأساس (فعلي)', 'Baseline (actual)'), data: [res.baseline.collected, res.baseline.uncollected, res.target?.baselineCollectedNeeded ?? null], backgroundColor: 'rgba(27,131,84,.75)', borderRadius: 4 },
      { label: L('سيناريو المستخدم', 'User scenario'), data: [res.scenario.collected, res.scenario.uncollected, res.target?.scenarioCollectedNeeded ?? null], backgroundColor: 'rgba(240, 68, 56,.8)', borderRadius: 4 }
    ]
  }), [res, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const options = useMemo(() => ({ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', rtl: isRtl, labels: { boxWidth: 12, font: { size: 11 } } }, tooltip: { rtl: isRtl, callbacks: { label: (c) => `${c.dataset.label}: ${cu.fmt(c.parsed.y)}`, afterLabel: (c) => fmtSar(c.parsed.y, lang) } } }, scales: { x: { reverse: isRtl, grid: { display: false } }, y: { beginAtZero: true, title: { display: true, text: cu.title, font: { size: 11 } }, ticks: { callback: (v) => cu.tick(v) } } } }), [cu, isRtl]);
  const changed = JSON.stringify(res.inputs) !== JSON.stringify(DEFAULT_SCENARIO);
  const set = (k, v) => setScenario({ ...scenario, [k]: v === '' ? '' : Number(v) });
  const gap = res.target;

  if (!(T.net > 0)) return <div className="rv-empty">{L('البيانات غير متاحة: لا صافي مفوتر في هذا الاختيار، فلا يمكن بناء سيناريو.', 'No data: there is no net billed in this selection, so a scenario cannot be built.')}</div>;
  return (
    <div className="st-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
      <div className="card st-card">
        <div><span className="st-tag st-tag--scenario">{L('سيناريو يحدده المستخدم', 'User-defined scenario')}</span> <span className="muted" style={{ fontSize: 12 }}>{L('افتراضي — ليس تنبؤاً', 'hypothetical — not a forecast')}</span></div>
        {LEVERS.filter((lv) => financeOk || !lv.funding).map((lv) => {
          const [lo, hi] = SCENARIO_LIMITS[lv.k]; const val = scenario[lv.k];
          return (
            <div key={lv.k} className="st-field">
              <label htmlFor={`sc-${lv.k}`} title={B(lv.hint)}>{B(lv)} <small className="muted">({lo} … {hi} {lv.unit === 'pp' ? L('نقطة', 'pp') : '%'})</small>{!lv.cash && <span className="st-tag st-tag--warn" style={{ marginInlineStart: 6 }}>{L('غير نقدي', 'non-cash')}</span>}{lv.funding && <span className="st-tag" style={{ marginInlineStart: 6 }}>{L('يؤثر على التمويل فقط', 'funding only')}</span>}</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input id={`sc-${lv.k}-r`} type="range" min={lo} max={hi} step={lv.step} value={Number.isFinite(Number(val)) ? Number(val) : 0} onChange={(e) => set(lv.k, e.target.value)} aria-label={B(lv)} />
                <input id={`sc-${lv.k}`} type="number" className="input" style={{ width: 84 }} min={lo} max={hi} step={lv.step} value={val} onChange={(e) => set(lv.k, e.target.value)} />
              </div>
              <details className="rv-more"><summary>{L('ما معنى هذا؟', 'What does this mean?')}</summary><div className="muted" style={{ fontSize: 12 }}>{B(lv.hint)}</div></details>
            </div>
          );
        })}
        <div className="st-field"><label htmlFor="sc-plan">{L('تاريخ التخطيط (مسموح بتاريخ مستقبلي؛ لا معاملات فعلية بعد اليوم)', 'Planning date (future allowed; no actual transactions after today)')}</label><input id="sc-plan" type="date" className="input" min={today} value={planDate} onChange={(e) => setPlanDate(e.target.value || today)} /></div>
        {res.warnings.map((w, i) => <div key={i} className="rv-callout rv-callout--warn" role="alert" style={{ fontSize: 13 }}>{ar ? w.ar : w.en}</div>)}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-sm btn-ghost" disabled={!changed} onClick={() => setScenario({ ...DEFAULT_SCENARIO })}>{L('إعادة الضبط', 'Reset')}</button>
          <button type="button" className="btn btn-sm" disabled={!changed || !canEdit} title={canEdit ? '' : L('يتطلب صلاحية المراجعة', 'Requires review permission')} onClick={onSaveToRegister}>{L('إنشاء مقترح من السيناريو', 'Create a proposal from this scenario')}</button>
        </div>
      </div>

      <div className="card st-card">
        <div className="st-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          <div className="rv-tile"><div className="rv-tile__label">{L('المحصّل', 'Collected')}</div><div className="rv-tile__value" dir="ltr" title={fmtSar(res.scenario.collected, lang)}>{m(res.scenario.collected)}</div><div className="rv-tile__sub">{L('الأساس', 'baseline')} {m(res.baseline.collected)} · <b dir="ltr">{res.deltaCollected >= 0 ? '+' : ''}{scaled(res.deltaCollected, unit)}</b></div></div>
          <div className="rv-tile"><div className="rv-tile__label">{L('غير المحصّل', 'Uncollected (remaining)')}</div><div className="rv-tile__value" dir="ltr" title={fmtSar(res.scenario.uncollected, lang)}>{m(res.scenario.uncollected)}</div><div className="rv-tile__sub">{L('الأساس', 'baseline')} {m(res.baseline.uncollected)}</div></div>
          <div className="rv-tile"><div className="rv-tile__label">{L('نسبة التحصيل', 'Collection rate')}</div><div className="rv-tile__value" dir="ltr">{pct(res.scenario.rate)}</div><div className="rv-tile__sub">{L('الأساس', 'baseline')} {pct(res.baseline.rate)} · <b dir="ltr">{res.scenario.rate != null && res.baseline.rate != null ? `${((res.scenario.rate - res.baseline.rate) * 100) >= 0 ? '+' : ''}${((res.scenario.rate - res.baseline.rate) * 100).toFixed(1)} ${L('نقطة', 'pp')}` : '—'}</b></div></div>
          <div className="rv-tile"><div className="rv-tile__label">{L('المتبقي للوصول إلى المستهدف التجريبي', 'Remaining to reach the demo target')}</div><div className="rv-tile__value" dir="ltr">{gap ? m(gap.scenarioGap) : L('غير متاحة', 'n/a')}</div><div className="rv-tile__sub">{gap ? `${L('الأساس', 'baseline')} ${m(gap.baselineGap)} · ${L('مستهدف', 'target')} ${(gap.rate * 100).toFixed(0)}%` : ''}</div></div>
        </div>
        <div className="rv-chart" style={{ height: 240 }} role="img" aria-label={L('مقارنة الأساس بالسيناريو', 'Baseline versus scenario')}><Bar role="presentation" data={data} options={options} /></div>
        <div className="muted" style={{ fontSize: 12 }}>{L('كل المبالغ بوحدة واحدة في الرسم', 'One unit in the chart')}: {cu.title.split('—')[1]?.trim()}. {L('فترة التحليل', 'Analysis period')}: {snapshot.scope.from} → {snapshot.scope.to}.</div>
        <div className="st-table-wrap" tabIndex={0}><table className="table" aria-label={L('مساهمة كل رافعة', 'Contribution of each lever')}>
          <thead><tr><th>{L('الرافعة', 'Lever')}</th><th>{L('النوع', 'Type')}</th><th>{L('أثر على صافي المفوتر', 'Effect on net billed')}</th><th>{L('أثر نقدي على المحصّل', 'Cash effect on collected')}</th></tr></thead>
          <tbody>
            <tr><td>{L('تغيّر الفوترة', 'Billing change')}</td><td>{L('فوترة', 'Billing')}</td><td dir="ltr">{scaled(res.steps[0].dNet, unit)}</td><td dir="ltr">{scaled(res.steps[0].dCollected, unit)}</td></tr>
            <tr><td>{L('حسم الحالات المعلقة', 'Pending cases')}</td><td>{L('غير نقدي', 'Non-cash')}</td><td dir="ltr">{scaled(res.steps[1].dNet, unit)}</td><td dir="ltr">0</td></tr>
            <tr><td>{L('معدل التحصيل', 'Collection rate')}</td><td>{L('نقدي', 'Cash')}</td><td dir="ltr">0</td><td dir="ltr">{scaled(res.steps[2].dCollected, unit)}</td></tr>
            <tr><td>{L('استرداد المتأخر', 'Overdue recovery')}</td><td>{L('نقدي', 'Cash')}</td><td dir="ltr">0</td><td dir="ltr">{scaled(res.steps[3].dCollected, unit)}</td></tr>
            <tr style={{ fontWeight: 700 }}><td>{L('الإجمالي', 'Total')}</td><td /><td dir="ltr">{scaled(res.scenario.net - res.baseline.net, unit)}</td><td dir="ltr">{scaled(res.deltaCollected, unit)}</td></tr>
          </tbody>
        </table></div>
        <div className="muted" style={{ fontSize: 12 }}>{L(`المبالغ بوحدة: ${fmtMoney(0, { lang, unit }).replace('0 ', '')}.`, `Amounts in: ${fmtMoney(0, { lang, unit }).replace('0 ', '')}.`)} {res.nonCash.netReduction > 0 && L(`الحسم كاستبعاد يخفض الصافي بـ ${mAuto(res.nonCash.netReduction)} فيرفع النسبة ${res.nonCash.rateEffectPp?.toFixed(1)} نقطة حسابياً دون أي نقد.`, `Exclusions reduce net by ${mAuto(res.nonCash.netReduction)} and lift the rate by ${res.nonCash.rateEffectPp?.toFixed(1)} pp arithmetically with no cash.`)}</div>
        {children}
        <details><summary>{L('الافتراضات والحدود', 'Assumptions and limits')}</summary>
          <ul className="res__list res__list--plain">
            <li>{L(`المجموعة المرجعية: صافي مفوتر ${mAuto(base.N)}، محصّل ${mAuto(base.C)}، غير محصّل ${mAuto(base.U)}؛ منه متأخر/جزئي قابل للتحصيل ${mAuto(base.pool)}؛ استبعادات قيد القرار (سقف) ${mAuto(base.pending)}.`, `Base: net ${mAuto(base.N)}, collected ${mAuto(base.C)}, uncollected ${mAuto(base.U)}; collectible overdue/partial ${mAuto(base.pool)}; pending exclusion candidates (cap) ${mAuto(base.pending)}.`)}</li>
            <li>{L('ترتيب التطبيق: الفوترة ← الحسم ← معدل التحصيل ← استرداد المتأخر؛ كل خطوة محدودة بما تبقى غير محصّل فلا يُحتسب مبلغ مرتين.', 'Order: billing → pending cases → rate → overdue recovery; each step is limited to what remains uncollected, so nothing is counted twice.')}</li>
            <li>{L('مستهدف معدل التحصيل مُدخل تجريبي غير معتمد؛ ولا يُستخدم تنبؤ في هذا السيناريو.', 'The collection-rate target is an unapproved demo input; no forecast is used inside this scenario.')}</li>
            <li>{L('تاريخ التخطيط وصفي: لا يولّد أي معاملة بعد اليوم.', 'The planning date is descriptive: it creates no transaction after today.')}</li>
          </ul>
        </details>
      </div>
    </div>
  );
}
