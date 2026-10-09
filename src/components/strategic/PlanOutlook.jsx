// Planning sections 2–4: the plan (targets and budget by month), actual-vs-plan variance, and forecasts / gaps / funding outlook.
// Actual results, approved budgets, targets, forecasts and user scenarios are separate columns / series and are never added together.
import React from 'react';
import { Link } from 'react-router-dom';
import { useAr } from '../../utils/useAr';
import { fmtMoney, unitOfValues, unitLabel, scaled } from '../../utils/money';
import UnitBar from './UnitBar';
import OutlookChart from '../revenue/OutlookChart';
import { plannedByMonth, budgetExecution, FINANCE_STATUS } from '../../data/syntheticFinance';
import { sourceAr, sourceEn } from '../../data/insightsEngine';

const pct = (v, na = '—') => (v == null ? na : `${(v * 100).toFixed(1)}%`);
const NA = (L) => L('غير متاح', 'n/a');

export function PlanTable({ fyMonths, outlook, fin, financeOk, narrowed, year, targets }) {
  const { L, B, lang } = useAr();
  const plan = plannedByMonth(year); const revT = outlook.target;
  const u = unitOfValues([...revT.filter((v) => v != null), ...plan.map((p) => p.planned)]);
  return (
    <div className="card st-card">
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><span className="st-tag st-tag--target">{L('مستهدف تجريبي', 'Demo target')}</span></div>
      <div className="st-table-wrap" tabIndex={0}><table className="table" aria-label={L('الخطة الشهرية', 'Monthly plan')}>
        <thead><tr><th>{L('الشهر', 'Month')}</th><th>{L('مستهدف المقبوضات', 'Receipts target')} ({unitLabel(u, lang)})</th><th>{L('تنبؤ المقبوضات (تقدير)', 'Receipts forecast (estimate)')}</th><th>{L('الميزانية المعتمدة للإنفاق', 'Approved expenditure budget')} ({unitLabel(u, lang)})</th></tr></thead>
        <tbody>{fyMonths.map((m, i) => <tr key={m}><td dir="ltr">{m}</td><td dir="ltr">{revT[i] == null ? NA(L) : scaled(revT[i], u)}</td><td dir="ltr">{outlook.forecast[i] == null ? '—' : `${scaled(outlook.forecast[i], u)}`}</td><td dir="ltr">{financeOk ? scaled(plan[i].planned, u) : NA(L)}</td></tr>)}
          <tr style={{ fontWeight: 700 }}><td>{L('السنة', 'Year')}</td><td dir="ltr">{narrowed ? NA(L) : scaled(targets.collectionAmountAnnual.value, u)}</td><td /><td dir="ltr">{financeOk ? scaled(plan.reduce((t, p) => t + p.planned, 0), u) : NA(L)}</td></tr></tbody></table></div>
      <div className="muted" style={{ fontSize: 12 }}>{narrowed ? L('المستهدف السنوي وطني؛ لا يُعرض لنطاق أضيق.', 'The annual target is national; it is not shown for a narrower scope.') : L('منحنى المستهدف الشهري مُدخل تجريبي؛ اعتماد المنحنى الرسمي معلّق.', 'The monthly target curve is a demo input; the official curve is pending.')} {!financeOk && L('الميزانية متاحة وطنياً لكل المصادر فقط (البيانات غير متاحة لهذا النطاق).', 'The budget is available nationally for all sources only (not available for this scope).')}</div>
    </div>
  );
}

export function VarianceBlock({ ach, achAvail, fin, financeOk, fyReceiptsYtd }) {
  const { L, B, lang } = useAr();
  const ex = financeOk ? budgetExecution(fin) : null;
  const rows = [];
  if (achAvail) rows.push([L('المقبوضات مقابل المستهدف التراكمي', 'Receipts vs cumulative target'), ach.receiptsYtd, ach.targetYtd, ach.receiptsYtd - ach.targetYtd, ach.targetYtd > 0 ? ach.receiptsYtd / ach.targetYtd : null, L('فعلي مقابل مستهدف غير معتمد', 'actual vs unapproved target')]);
  if (ex) { rows.push([L('الصرف النقدي مقابل الميزانية المتناسبة (كل الأبواب)', 'Cash payments vs prorated budget (all chapters)'), ex.total.paid, ex.total.budgetToDate, ex.total.paid - ex.total.budgetToDate, ex.total.execution, L('فعلي اصطناعي مقابل ميزانية اصطناعية', 'synthetic actual vs synthetic budget')]); }
  const u = unitOfValues(rows.flatMap((r) => [r[1], r[2], Math.abs(r[3])]));
  return (
    <div className="st-grid">
      <div className="card st-card">
        <b>{L('الفعلي مقابل المستهدف والميزانية (من بداية السنة)', 'Actual vs target and budget (year to date)')}</b>
        {rows.length ? <div className="st-table-wrap" tabIndex={0}><table className="table" aria-label={L('الانحرافات', 'Variances')}><thead><tr><th>{L('المقارنة', 'Comparison')}</th><th>{L('الفعلي', 'Actual')} ({unitLabel(u, lang)})</th><th>{L('المرجع', 'Reference')} ({unitLabel(u, lang)})</th><th>{L('الانحراف', 'Variance')}</th><th>{L('النسبة', 'Ratio')}</th><th>{L('الأساس', 'Basis')}</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}><td>{r[0]}</td><td dir="ltr">{scaled(r[1], u)}</td><td dir="ltr">{scaled(r[2], u)}</td><td dir="ltr" style={{ color: r[3] < 0 ? 'var(--danger)' : 'var(--green)' }}>{r[3] >= 0 ? '+' : ''}{scaled(r[3], u)}</td><td dir="ltr">{pct(r[4])}</td><td className="muted" style={{ fontSize: 12 }}>{r[5]}</td></tr>)}</tbody></table></div>
          : <div className="rv-empty" style={{ padding: 14 }}><b>{L('البيانات غير متاحة', 'Data not available')}</b><div style={{ fontSize: 13 }}>{L('لا مستهدف وطني ولا ميزانية لهذا النطاق.', 'No national target or budget for this scope.')}</div></div>}
        <div className="muted" style={{ fontSize: 12 }}>{L('انحراف الإيرادات (مقبوضات) وانحراف الإنفاق (صرف نقدي) على أساسين مختلفين ولا يُجمعان في رقم واحد.', 'Revenue variance (receipts) and expenditure variance (cash payments) are on different bases and are not combined into one figure.')}</div>
      </div>
      <div className="card st-card">
        <b>{L('تنفيذ الميزانية حسب الباب', 'Budget execution by chapter')}</b>
        {ex ? <div className="st-table-wrap" tabIndex={0}><table className="table" aria-label={L('تنفيذ الميزانية', 'Budget execution')}><thead><tr><th>{L('الباب', 'Chapter')}</th><th>{L('الميزانية المتناسبة', 'Prorated budget')}</th><th>{L('الالتزام', 'Commitment')}</th><th>{L('المستحق', 'Accrued')}</th><th>{L('المصروف', 'Paid')}</th><th>{L('صرف ÷ ميزانية', 'Paid ÷ budget')}</th></tr></thead>
          <tbody>{ex.rows.map((r) => { const uu = unitOfValues(ex.rows.flatMap((x) => [x.budgetToDate, x.commitments, x.accrued, x.paid])); return <tr key={r.key}><td>{B(r.label)}</td><td dir="ltr">{scaled(r.budgetToDate, uu)}</td><td dir="ltr">{scaled(r.commitments, uu)}</td><td dir="ltr">{scaled(r.accrued, uu)}</td><td dir="ltr">{scaled(r.paid, uu)}</td><td dir="ltr">{pct(r.execution)}</td></tr>; })}</tbody></table></div>
          : <div className="rv-empty" style={{ padding: 14 }}><b>{L('البيانات غير متاحة لهذا النطاق', 'Data not available for this scope')}</b></div>}
        <div className="muted" style={{ fontSize: 12 }}>{ex ? `${B(FINANCE_STATUS)}. ` : ''}{L('الالتزام ≥ المستحق ≥ المصروف: ثلاثة مفاهيم لا تُجمع.', 'Commitment ≥ accrued ≥ paid: three concepts that are not added together.')}</div>
      </div>
    </div>
  );
}

export function ForecastGaps({ outlook, fyMonths, forecast, tvf, gaps, snapshot, funding, scenarioOn, canShowFunding }) {
  const { L, B, ar, lang } = useAr();
  const uG = unitOfValues(gaps.flatMap((g) => [g.net, g.outstanding, g.gap]));
  return (
    <>
      <div className="card st-card">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><span className="st-tag st-tag--actual">{L('فعلي', 'actual')}</span><span className="st-tag st-tag--target">{L('مستهدف', 'target')}</span><span className="st-tag st-tag--forecast">{L('تنبؤ', 'forecast')}</span></div>
        <OutlookChart labels={fyMonths} actual={outlook.actual} target={outlook.target} forecast={outlook.forecast} low={outlook.low} high={outlook.high} scenario={null} height={280} />
        <div className="muted" style={{ fontSize: 13 }}>
          {forecast?.ready
            ? L(`التنبؤ (تقدير مستقل عن المستهدف): ${B(forecast.method?.label) || 'اتجاه خطي'} على المقبوضات الشهرية الأساسية بعد عزل الاستثنائي منها. النطاق الإرشادي يعبّر عن عدم اليقين وليس ضماناً، ولا يتوقع أحداثاً مستقبلية. ${tvf ? `الإجمالي المتوقع للسنة ${fmtMoney(tvf.projectedTotal, { lang })}.` : ''}`, `Forecast (an estimate independent of the target): ${B(forecast.method?.label) || 'linear trend'} on underlying monthly receipts after separating exceptional ones. The indicative range expresses uncertainty, not a guarantee, and does not anticipate future events. ${tvf ? `Projected full year ${fmtMoney(tvf.projectedTotal, { lang })}.` : ''}`)
            : L(`التنبؤ غير معروض: ${B(forecast?.reasonNotReady) || 'التاريخ داخل هذا النطاق لا يكفي'}. يُستخدم أدناه توقع توضيحي صريح الوسم عند الحاجة.`, `Forecast not shown: ${B(forecast?.reasonNotReady) || 'the history in this scope is not long enough'}. Where needed a clearly labelled illustrative projection is used below.`)}
        </div>
      </div>
      <div className="st-grid">
        <div className="card st-card">
          <b>{L('أكبر فجوات التحصيل (أمانة × مصدر)', 'Largest collection gaps (Amanah × source)')}</b>
          {gaps.length ? <div className="st-table-wrap" tabIndex={0}><table className="table" aria-label={L('فجوات التحصيل', 'Collection gaps')}><thead><tr><th>{L('الأمانة', 'Amanah')}</th><th>{L('المصدر', 'Source')}</th><th>{L('غير المحصّل', 'Uncollected')} ({unitLabel(uG, lang)})</th><th>{L('الفجوة للمستهدف*', 'Gap to target*')}</th><th><span className="sr-only">{L('إجراء', 'Action')}</span></th></tr></thead>
            <tbody>{gaps.map((g) => <tr key={`${g.amanah}|${g.source}`}><td>{B(g.label)}</td><td>{ar ? sourceAr(g.source) : sourceEn(g.source)}</td><td dir="ltr">{scaled(g.outstanding, uG)}</td><td dir="ltr">{scaled(g.gap, uG)}</td><td><Link className="btn btn-sm btn-ghost" to={`/invoices?amanah=${encodeURIComponent(g.amanah)}&src=${g.source}`}>{L('الفواتير', 'Invoices')}</Link></td></tr>)}</tbody></table></div> : <div className="rv-empty" style={{ padding: 12 }}>{L('لا فجوات مقابل المستهدف التجريبي في هذا الاختيار.', 'No gaps against the demo target in this selection.')}</div>}
          <div className="muted" style={{ fontSize: 12 }}>{L('* تقدير مقابل المستهدف التجريبي، وليس مبلغاً مؤكد التحصيل.', '* an estimate against the demo target, not a confirmed collectible amount.')}</div>
        </div>
        <div className="card st-card">
          <b>{L('توقع التمويل لنهاية الفترة (مقبوضات − مدفوعات)', 'Funding outlook to the planning date (receipts − payments)')}</b>
          {canShowFunding && funding?.available ? (() => { const u = unitOfValues([funding.base.receipts, funding.base.payments, funding.scenario.receipts, funding.scenario.payments, Math.abs(funding.base.balance), Math.abs(funding.scenario.balance)]); return (
            <>
              <span className="st-tag st-tag--warn">{funding.method === 'forecast' ? L('يستند إلى تنبؤ + إنفاق اصطناعي', 'based on the forecast + synthetic expenditure') : L('توضيحي: متوسط آخر 3 أشهر + إنفاق اصطناعي', 'illustrative: last-3-month average + synthetic expenditure')}</span>
              <div className="st-table-wrap" tabIndex={0}><table className="table"><thead><tr><th><span className="sr-only">{L('إجراء', 'Action')}</span></th><th>{L('الأساس', 'Baseline')} ({unitLabel(u, lang)})</th>{scenarioOn && <th>{L('السيناريو', 'Scenario')}</th>}</tr></thead><tbody>
                <tr><td>{L('المقبوضات المتوقعة للسنة', 'Projected receipts for the year')}</td><td dir="ltr">{scaled(funding.base.receipts, u)}</td>{scenarioOn && <td dir="ltr">{scaled(funding.scenario.receipts, u)}</td>}</tr>
                <tr><td>{L('المدفوعات المتوقعة للسنة', 'Projected payments for the year')}</td><td dir="ltr">{scaled(funding.base.payments, u)}</td>{scenarioOn && <td dir="ltr">{scaled(funding.scenario.payments, u)}</td>}</tr>
                <tr style={{ fontWeight: 700 }}><td>{L('الميزان التمويلي (فائض/عجز)', 'Funding balance (surplus/deficit)')}</td><td dir="ltr" style={{ color: funding.base.balance < 0 ? 'var(--danger)' : 'var(--green)' }}>{scaled(funding.base.balance, u)}</td>{scenarioOn && <td dir="ltr" style={{ color: funding.scenario.balance < 0 ? 'var(--danger)' : 'var(--green)' }}>{scaled(funding.scenario.balance, u)}</td>}</tr></tbody></table></div>
              <div className="muted" style={{ fontSize: 12 }}>{L('نقدي على الطرفين وطني؛ المدفوعات المتبقية بمتوسط آخر 3 أشهر. لا يمثل مركزاً مالياً رسمياً.', 'Cash on both sides, national; remaining payments at the last-3-month average. Not an official financial position.')}</div>
            </>); })()
            : <div className="rv-empty" style={{ padding: 14 }}><b>{L('البيانات غير متاحة', 'Data not available')}</b><div style={{ fontSize: 13 }}>{L('يتطلب نطاقاً وطنياً لكل المصادر وأساساً نقدياً متوافقاً وبيانات إنفاق (اصطناعية هنا).', 'Needs a national all-source scope, a compatible cash basis and expenditure data (synthetic here).')}</div></div>}
        </div>
      </div>
    </>
  );
}
