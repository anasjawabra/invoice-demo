// «أين نحن من الخطة» (IIM-15): the target (the plan), the estimate (a simple projection from the demo actuals) and the actual — by month; the probability of reaching the target;
// where to focus; the reasons for reaching or missing it; and the deviation from the target in value and %. The estimate is a DEMONSTRATION: labelled «تقدير تجريبي – للعرض التوضيحي».
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import UnitLines from './UnitLines';
import { forecastYear, focusRanking } from '../../data/planForecast';
import { fmtMonthText } from '../../data/clock';

const pc = (v, d = 1) => (Number.isFinite(v) ? `${(v * 100).toFixed(d)}%` : '—');
const sgn = (v) => (v > 0 ? '+' : v < 0 ? '−' : '');

export default function PlanForecast({ year, g, selected, monthlyCollected, billedMonthly, standingUncollected, cells, targetRate, L, ar, lang, short, sourceName, nameOf }) {
  const m = g.reportingMonth;
  const dayFraction = useMemo(() => { const d = Number(g.reportingDate.slice(8, 10)); const dim = new Date(Date.UTC(year, m, 0)).getUTCDate(); return d / dim; }, [g.reportingDate, year, m]);
  const F = useMemo(() => forecastYear({ target: selected.revenueTarget, cumTarget: selected.cumulative, monthlyCollected, reportingMonth: m, yearEnded: g.yearEnded, dayFraction, billedMonthly, standingUncollected }), [selected, monthlyCollected, m, g.yearEnded, dayFraction, billedMonthly, standingUncollected]);
  const focus = useMemo(() => focusRanking(cells, targetRate, 5), [cells, targetRate]);
  const labels = Array.from({ length: 12 }, (_, i) => fmtMonthText(`${year}-${String(i + 1).padStart(2, '0')}`, lang).replace(/\s?\d{4}$/, ''));
  const estSeries = F.estCum.map((v, k) => (k >= m - 1 ? v : null)); // the estimate starts at the last actual point
  const prob = F.probability;
  const tone = prob == null ? 'neutral' : prob >= 0.7 ? 'good' : prob >= 0.35 ? 'warn' : 'bad';
  const reasonText = (r) => {
    switch (r.code) {
      case 'achieved': return L('تم تحصيل المستهدف السنوي بالفعل.', 'The annual target has already been collected.');
      case 'run_rate': return L(`وتيرة التحصيل الحالية (${short(r.avg)} شهريًا) أعلى من المطلوب (${short(r.required)} شهريًا) لبلوغ المستهدف.`, `The current pace (${short(r.avg)} a month) is above the ${short(r.required)} a month still needed.`);
      case 'balance_covers': return L(`الرصيد غير المحصّل والفوترة المتوقعة يغطيان المستهدف (حتى ${short(r.maxTotal)}).`, `The balance still owed plus expected billing covers the target (up to ${short(r.maxTotal)}).`);
      case 'billing_insufficient': return L(`حتى مع تحصيل 100% من الرصيد القائم والفوترة المتوقعة لن يتحقق المستهدف لأن الفوترة غير كافية: الحد الأقصى الممكن ${short(r.maxTotal)}، والفجوة ${short(r.gap)}.`, `Even with 100% collection of the balance owed and the billing still expected the target cannot be reached because billing is insufficient: the most possible is ${short(r.maxTotal)}, a gap of ${short(r.gap)}.`);
      case 'pace_short': return L(`وتيرة التحصيل الحالية (${short(r.avg)} شهريًا) أقل من المطلوب (${short(r.required)} شهريًا)؛ التقدير يبلغ السنة بفجوة ${short(r.gap)}.`, `The current pace (${short(r.avg)} a month) is below the ${short(r.required)} a month needed; the estimate ends the year short by ${short(r.gap)}.`);
      default: return '';
    }
  };
  const reach = F.reasons.filter((r) => r.kind === 'reach'); const miss = F.reasons.filter((r) => r.kind === 'miss');
  return (
    <section className="card st-card cg-explain pf-panel" aria-label={L('أين نحن من الخطة', 'Where are we against the plan')}>
      <div className="pf-head">
        <b>{L('أين نحن من الخطة', 'Where are we against the plan')}</b>
        <span className="rv-tag rv-tag--warn" title={L('إسقاط بسيط قابل للشرح من أرقام العرض التجريبي: متوسط التحصيل الشهري لآخر ثلاثة أشهر مغلقة؛ ويُعاد التقدير كل شهر عند وصول الفعلي.', 'A simple, explainable projection from the demo figures: the average monthly collection of the last three closed months; it is re-estimated every month when the actuals arrive.')}>{L('تقدير تجريبي – للعرض التوضيحي', 'Trial estimate — for demonstration')}</span>
      </div>
      <UnitLines labels={labels} height={270} label={L('المستهدف والتقدير والفعلي تراكميًا بالأشهر', 'Target, estimate and actual, cumulative by month')}
        series={[{ label: L('المستهدف (الخطة)', 'Target (plan)'), values: F.targetCum, style: { borderColor: 'rgba(25, 65, 133, 0.9)', backgroundColor: 'rgba(25, 65, 133, 0.9)', borderWidth: 2, borderDash: [6, 4] } }, { label: L('التقدير (AI)', 'Estimate (AI)'), values: estSeries, style: { borderColor: 'rgba(181, 71, 8, 0.95)', backgroundColor: 'rgba(181, 71, 8, 0.95)', borderWidth: 2, borderDash: [2, 3] } }, { label: L('الفعلي', 'Actual'), values: F.actualCum.map((v) => (v == null ? null : v)), style: { borderColor: '#1B8354', backgroundColor: '#1B8354', borderWidth: 3 } }]} />
      <table className="sr-only"><caption>{L('المستهدف والتقدير والفعلي', 'Target, estimate and actual')}</caption>
        <thead><tr><th>{L('الشهر', 'Month')}</th><th>{L('المستهدف', 'Target')}</th><th>{L('التقدير', 'Estimate')}</th><th>{L('الفعلي', 'Actual')}</th></tr></thead>
        <tbody>{labels.map((lb, i) => <tr key={lb}><td>{lb}</td><td>{short(F.targetCum[i])}</td><td>{short(F.estCum[i])}</td><td>{F.actualCum[i] == null ? '—' : short(F.actualCum[i])}</td></tr>)}</tbody></table>

      <div className="rv-tiles pf-tiles">
        <div className={`rv-tile rv-tile--${tone}`}>
          <div className="rv-tile__label">{L('احتمالية تحقيق المستهدف', 'Probability of reaching the target')}</div>
          <div className="rv-tile__value" dir="ltr">{prob == null ? '—' : pc(prob, 0)}</div>
          <div className="rv-tile__sub">{L(`تقدير نهاية السنة ${short(F.forecast)} مقابل مستهدف ${short(selected.revenueTarget)}`, `Year-end estimate ${short(F.forecast)} against a target of ${short(selected.revenueTarget)}`)}</div>
        </div>
        <div className={`rv-tile rv-tile--${F.deviation >= 0 ? 'good' : 'bad'}`}>
          <div className="rv-tile__label">{L('الانحراف عن المستهدف حتى تاريخه', 'Deviation from the target to date')}</div>
          <div className="rv-tile__value" dir="ltr">{sgn(F.deviation)}{short(Math.abs(F.deviation))}</div>
          <div className="rv-tile__sub" dir="ltr">{F.deviationPct == null ? '—' : `${sgn(F.deviationPct)}${pc(Math.abs(F.deviationPct))}`} · {L(`الفعلي ${short(F.collected)} مقابل المخطط ${short(F.plannedToDate)}`, `Actual ${short(F.collected)} against ${short(F.plannedToDate)} planned`)}</div>
        </div>
      </div>

      <div className="pf-cols">
        <div>
          <b>{L('أين نركز', 'Where to focus')}</b>
          {focus.length ? <ol className="pf-list">{focus.map((c) => (
            <li key={`${c.amanah}|${c.source}`}>{L(`التركيز على ${sourceName(c.source)} في ${nameOf(c.amanah)}: رصيد غير محصّل ${short(c.outstanding)}${c.rate != null ? ` ونسبة تحصيل ${pc(c.rate)}` : ''}.`, `Focus on ${sourceName(c.source)} in ${nameOf(c.amanah)}: ${short(c.outstanding)} uncollected${c.rate != null ? `, collection rate ${pc(c.rate)}` : ''}.`)}</li>
          ))}</ol> : <div className="muted" style={{ fontSize: 13 }}>{L('لا رصيد غير محصّل يستدعي التركيز في هذا الاختيار.', 'No uncollected balance calls for focus in this selection.')}</div>}
          <div className="muted" style={{ fontSize: 12 }}><Link to="/collection">{L('عرض الفواتير غير المحصّلة', 'Open the uncollected invoices')}</Link></div>
        </div>
        <div>
          <b>{miss.length ? L('مبررات عدم تحقيق المستهدف', 'Reasons the target may be missed') : L('مبررات تحقيق المستهدف', 'Reasons the target will be reached')}</b>
          <ul className="pf-list">{(miss.length ? miss : reach).map((r) => <li key={r.code}>{reasonText(r)}</li>)}</ul>
        </div>
      </div>
      <div className="muted" style={{ fontSize: 12 }}>{L('يُعاد التقدير كل شهر عند وصول الفعلي. وهو عرض توضيحي لأسلوب العمل وليس نموذجًا معتمدًا.', 'The estimate is redone every month when the actuals arrive. It illustrates the method; it is not an approved model.')}</div>
    </section>
  );
}
