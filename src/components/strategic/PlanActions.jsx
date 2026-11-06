// Section 5 · «أين نركز» — the ranked ACTIONABLE table (replaces the narrative). One row = an entity × revenue source (× municipality for a municipal scope) holding the balances that can be acted on this year
// (class B overdue up to 180 days + class C falling due by year-end). Ranked by the entity's contribution to the gap, then the actionable amount. Balances older than 180 days (a decision, not a push) and
// balances with a standing blocker are SEPARATE groups, never added to the actionable amount. The reason is built from record COUNTS (no cause is claimed); the recommended action is a rule-based dictionary text;
// the expected impact is «غير متاح» (no recovery data). Every row links to /collection with the exact filters (needs the uncollected-invoices module). The rows never overlap (the service's lines are disjoint).
import React from 'react';
import { Link } from 'react-router-dom';
import { useAr } from '../../utils/useAr';
import { drillUrl, EXPECTED_IMPACT_WHY, ACTION_COLUMNS } from '../../data/planningActionsView';
import { pct } from './planFormat';

const sumOf = (a, k) => a.reduce((t, x) => t + (x[k] || 0), 0);
const B = (ar) => (o) => (o == null ? '' : ar ? o.ar : o.en);

function DrillLink({ drill, allowed, reason, label }) {
  const to = drillUrl(drill);
  if (!to) return <span className="pl-na">—</span>;
  if (!allowed) return <span className="pl-linkoff" aria-disabled="true" title={reason}>{label} <span className="pl-sub2">{reason}</span></span>;
  return <Link className="pl-drill" to={to}>{label}</Link>;
}

export default function PlanActions({ view, status, error, canDrill, drillReason, srcName, onResetSource, expanded, onToggleExpanded, notCurrentYear, hasGaps, scopeName, onRetry }) {
  const { L, ar, short, count } = useAr(); const T = B(ar);
  const municipal = view?.level === 'municipality';
  const money = (v) => short(v);
  return (
    <section id="plan-actions" className="card pl-section" aria-labelledby="plan-actions-h">
      <h2 id="plan-actions-h" className="pl-h2">{L('أين نركز', 'Where to focus')}<small>{L('مرتبة حسب المساهمة في الفجوة ثم المبلغ القابل للمتابعة', 'ranked by contribution to the gap, then the actionable amount')}</small></h2>
      {notCurrentYear && <div className="rv-callout" role="status">{L('خطوط الإجراءات تخص رصيد اليوم الفعلي؛ اختر العام الحالي لعرضها.', 'The action lines describe today’s actual balance; choose the current year to see them.')}</div>}
      {!notCurrentYear && status === 'loading' && <div className="st-skel" style={{ height: 200 }} aria-busy="true" />}
      {!notCurrentYear && status === 'denied' && <div className="rv-callout rv-callout--warn" role="status">{L('لا صلاحية لوحدة التخطيط لعرض خطوط الإجراءات.', 'No access to the planning action lines.')}</div>}
      {!notCurrentYear && status === 'error' && <div className="rv-callout rv-callout--bad" role="alert"><b>{L('تعذّر تحميل خطوط الإجراءات', 'The action lines could not be loaded')}</b><div>{String(error?.message || '')}</div>{onRetry && <button type="button" className="btn btn-sm" onClick={onRetry}>{L('إعادة المحاولة', 'Retry')}</button>}</div>}

      {!notCurrentYear && view?.available && (
        <>
          <p className="pl-sub">{L('المبالغ أرصدة قائمة وليست إضافية إلى التوقع. لا يُقدَّر مبلغ قابل للاسترداد لعدم توفر بيانات تتحقق منه؛ ولا يُنسب سبب لا يدعمه سجل.', 'The amounts are standing balances, not additions to the forecast. No recoverable amount is estimated because no data can validate one, and no cause is named that a record does not support.')}</p>
          {!hasGaps && <p className="pl-sub" role="note">{L('لا فجوة عن الخطة تُرتَّب بها الجهات في هذا الاختيار؛ الترتيب بالمبلغ القابل للمتابعة.', 'No gap to the plan ranks the entities in this selection; the order is by the actionable amount.')}</p>}
          {srcName && <div className="pl-sel"><span>{L('مصدر الإيراد المختار:', 'Revenue source chosen:')} <b>{srcName}</b></span><button type="button" className="btn btn-sm btn-ghost" onClick={onResetSource}>{L('إلغاء', 'Clear')}</button></div>}
          {view.cells.length ? (
            <div className="pl-tablewrap" tabIndex={0} role="region" aria-label={L('جدول الأولويات', 'Priority table')}>
              <table className="pl-table pl-table--stack" data-no-stack="" data-columns={ACTION_COLUMNS.filter((c) => municipal || c !== 'municipality').join(' ')}>
                <caption className="sr-only">{L(`أين نركز — ${scopeName}`, `Where to focus — ${scopeName}`)}</caption>
                <thead><tr>
                  <th scope="col">{L('الأولوية', 'Priority')}</th>
                  <th scope="col">{L('الأمانة / الجهة', 'Amanah / entity')}</th>
                  {municipal && <th scope="col">{L('البلدية', 'Municipality')}</th>}
                  <th scope="col">{L('مصدر الإيراد', 'Revenue source')}</th>
                  <th scope="col">{L('الفجوة عن الخطة (الجهة)', 'Gap to plan (entity)')}</th>
                  <th scope="col">{L('المبلغ القابل للمتابعة', 'Actionable amount')}</th>
                  <th scope="col">{L('المستحق حتى نهاية السنة', 'Due by year-end')}</th>
                  <th scope="col">{L('أقدم تأخر (يوم)', 'Oldest overdue (days)')}</th>
                  <th scope="col">{L('السبب (من السجلات)', 'Reason (from the records)')}</th>
                  <th scope="col">{L('الإجراء المقترح', 'Recommended action')}</th>
                  <th scope="col">{L('الأثر المتوقع', 'Expected impact')}</th>
                  <th scope="col">{L('السجلات', 'Records')}</th>
                </tr></thead>
                <tbody>
                  {view.cells.map((r) => (
                    <tr key={r.id} data-line={r.id}>
                      <td className="pl-rank" data-label={L('الأولوية', 'Priority')}>{count(r.priority)}</td>
                      <td data-label={L('الأمانة / الجهة', 'Amanah / entity')}><b>{T(r.entity)}</b></td>
                      {municipal && <td data-label={L('البلدية', 'Municipality')}>{r.municipality ? T(r.municipality) : '—'}</td>}
                      <td data-label={L('مصدر الإيراد', 'Revenue source')}>{T(r.source)}</td>
                      <td className="n" data-label={L('الفجوة عن الخطة (الجهة)', 'Gap to plan (entity)')} dir="ltr">{r.entityGap != null && r.entityGap > 0 ? <>{short(r.entityGap)}<span className="pl-sub2">{r.gapShare != null ? `${pct(r.gapShare)} ${ar ? 'من الفجوة' : 'of the gap'}` : ''}</span></> : r.entityGap != null ? <span className="pl-na">{ar ? 'متقدم عن الخطة' : 'ahead of plan'}</span> : <span className="pl-na">—</span>}</td>
                      <td className="n" data-label={L('المبلغ القابل للمتابعة', 'Actionable amount')} dir="ltr"><b>{money(r.actionable)}</b><span className="pl-sub2">{r.overdue > 0 ? `${ar ? 'متأخر' : 'overdue'} ${money(r.overdue)}` : ''}{r.overdue > 0 && r.dueSoon > 0 ? ' · ' : ''}{r.dueSoon > 0 ? `${ar ? 'يستحق' : 'falling due'} ${money(r.dueSoon)}` : ''}</span><span className="pl-sub2">{count(r.count)} {ar ? 'فاتورة' : 'invoices'}</span></td>
                      <td className="n" data-label={L('المستحق حتى نهاية السنة', 'Due by year-end')} dir="ltr">{money(r.dueByYearEnd)}<span className="pl-sub2">{ar ? 'كل الأعمار' : 'all ages'}</span></td>
                      <td className="n" data-label={L('أقدم تأخر (يوم)', 'Oldest overdue (days)')} dir="ltr">{r.oldest > 0 ? count(r.oldest) : '—'}</td>
                      <td className="reason" data-label={L('السبب (من السجلات)', 'Reason (from the records)')}>{r.reasons.map((x, i) => <div key={i}>{x}</div>)}</td>
                      <td className="act" data-label={L('الإجراء المقترح', 'Recommended action')}>{r.actions.map((a) => <div key={a.key}>{T(a)}</div>)}</td>
                      <td data-label={L('الأثر المتوقع', 'Expected impact')}><span className="pl-na" title={T(EXPECTED_IMPACT_WHY)}>{T(r.expectedImpact)}</span></td>
                      <td data-label={L('السجلات', 'Records')}><DrillLink drill={r.drill} allowed={canDrill} reason={drillReason} label={L('فتح الفواتير ←', 'Open the invoices →')} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="rv-empty" role="status">{L('لا رصيد قابل للمتابعة في هذا الاختيار (لا متأخر حتى 180 يوماً ولا مستحق قبل نهاية السنة).', 'No actionable balance in this selection (nothing overdue up to 180 days and nothing falling due by year-end).')}</div>}
          <div className="pl-note">
            {L(`مجموع الصفوف المعروضة = المبلغ القابل للمتابعة ${short(view.actionableTotal)}؛ الصفوف لا تتداخل (فاتورة واحدة في صف واحد).`, `The rows add up to the actionable amount ${short(view.actionableTotal)}; the rows never overlap (one invoice, one row).`)}
            {view.hidden > 0 || expanded ? <> <button type="button" className="btn btn-sm btn-ghost" aria-expanded={!!expanded} onClick={onToggleExpanded}>{expanded ? L('عرض الأعلى فقط', 'Show the top only') : L(`عرض الكل (${count(view.all)})`, `View all (${count(view.all)})`)}</button></> : null}
          </div>

          {(view.groups.aged.length > 0 || view.groups.blocked.length > 0 || view.other.E.count > 0 || view.other.U.count > 0) && (
            <div className="pl-note" style={{ fontWeight: 600 }}>{L('مجموعات منفصلة — لا تدخل في المبلغ القابل للمتابعة:', 'Separate groups — not part of the actionable amount:')}</div>
          )}
          {view.groups.aged.length > 0 && (
            <details className="pl-group" id="plan-aged">
              <summary>{L('رصيد أقدم من 180 يوماً — يحتاج قراراً لا متابعة', 'Balance older than 180 days — needs a decision, not follow-up')} <span className="pl-num" dir="ltr">{short(sumOf(view.groups.aged, 'remaining'))}</span> <span className="pl-sub2">{count(sumOf(view.groups.aged, 'count'))} {ar ? 'فاتورة' : 'invoices'}</span></summary>
              <GroupTable lines={view.groups.aged} municipal={municipal} T={T} short={short} count={count} L={L} ar={ar} canDrill={canDrill} drillReason={drillReason} />
            </details>
          )}
          {view.groups.blocked.length > 0 && (
            <details className="pl-group" id="plan-blocked">
              <summary>{L('رصيد عليه عائق قائم — لا إحالة جديدة قبل حسم العائق', 'Balance with a standing blocker — no new referral before it is settled')} <span className="pl-num" dir="ltr">{short(sumOf(view.groups.blocked, 'remaining'))}</span> <span className="pl-sub2">{count(sumOf(view.groups.blocked, 'count'))} {ar ? 'فاتورة' : 'invoices'}</span></summary>
              <GroupTable lines={view.groups.blocked} municipal={municipal} T={T} short={short} count={count} L={L} ar={ar} canDrill={canDrill} drillReason={drillReason} />
            </details>
          )}
          {(view.other.E.count > 0 || view.other.U.count > 0) && (
            <p className="pl-note">{view.other.E.count > 0 ? L(`يستحق بعد نهاية السنة: ${short(view.other.E.remaining)} (${count(view.other.E.count)}). `, `Falling due after year-end: ${short(view.other.E.remaining)} (${count(view.other.E.count)}). `) : ''}{view.other.U.count > 0 ? L(`تاريخ الاستحقاق غير متاح: ${short(view.other.U.remaining)} (${count(view.other.U.count)}).`, `Due date unavailable: ${short(view.other.U.remaining)} (${count(view.other.U.count)}).`) : ''}</p>
          )}
          <details className="pl-group" id="plan-impact-why">
            <summary>{L('لماذا الأثر المتوقع «غير متاح»؟', 'Why is the expected impact “Not available”?')}</summary>
            <p className="pl-sub">{T(EXPECTED_IMPACT_WHY)}</p>
          </details>
        </>
      )}
    </section>
  );
}

function GroupTable({ lines, municipal, T, short, count, L, ar, canDrill, drillReason }) {
  return (
    <div className="pl-tablewrap" tabIndex={0}>
      <table className="pl-table pl-table--stack" data-no-stack="">
        <thead><tr><th scope="col">{L('الأمانة / الجهة', 'Amanah / entity')}</th>{municipal && <th scope="col">{L('البلدية', 'Municipality')}</th>}<th scope="col">{L('مصدر الإيراد', 'Revenue source')}</th><th scope="col">{L('الرصيد', 'Balance')}</th><th scope="col">{L('أقدم تأخر (يوم)', 'Oldest overdue (days)')}</th><th scope="col">{L('البيان', 'Detail')}</th><th scope="col">{L('الإجراء المقترح', 'Recommended action')}</th><th scope="col">{L('السجلات', 'Records')}</th></tr></thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id}>
              <td data-label={L('الأمانة / الجهة', 'Amanah / entity')}><b>{T(l.entity)}</b></td>
              {municipal && <td data-label={L('البلدية', 'Municipality')}>{l.municipality ? T(l.municipality) : '—'}</td>}
              <td data-label={L('مصدر الإيراد', 'Revenue source')}>{T(l.source)}</td>
              <td className="n" dir="ltr" data-label={L('الرصيد', 'Balance')}>{short(l.remaining)}<span className="pl-sub2">{count(l.count)} {ar ? 'فاتورة' : 'invoices'}</span></td>
              <td className="n" dir="ltr" data-label={L('أقدم تأخر (يوم)', 'Oldest overdue (days)')}>{l.oldestDaysOverdue > 0 ? count(l.oldestDaysOverdue) : '—'}</td>
              <td className="reason" data-label={L('البيان', 'Detail')}>{l.reason}</td>
              <td className="act" data-label={L('الإجراء المقترح', 'Recommended action')}>{T(l.recommendedAction)}</td>
              <td data-label={L('السجلات', 'Records')}><DrillLink drill={l.drill} allowed={canDrill} reason={drillReason} label={L('فتح الفواتير ←', 'Open the invoices →')} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
