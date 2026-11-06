// The measure sections of a plan's detail page — ONE summary of the headline measures, the conditional notices, the position, the cumulative chart, the forecast + required pace, and the deviation breakdown.
// Pure presentation of ONE planning basis + its forecast + planMeasures (spec §5). There is NO tolerance badge, NO «وفق الخطة / متقدم / متأخر» label, NO probability block and NO deviation-% headline (the deviation % lives
// in a tooltip). The unavailable states always carry their reason; a missing figure is «غير متاح», never 0.
import React from 'react';
import { useAr } from '../../utils/useAr';
import { MetricTile } from '../revenue/RevenueUI';
import PageChart from '../charts/PageChart';
import { fmtDateText } from '../../data/clock';
import { pct, signedMoney, signedPct } from '../strategic/planFormat';
import { PLAN_STATE_TEXT, NO_MUNICIPAL_TARGET, EQUAL_ASSUMPTION, RESTRICTED_LABEL, UNALLOCATED_MUNI_KEY, planMonthLabel } from '../../data/plans/planBasis';
import { pickL, upcomingLabel, SYSTEM_PLAN } from './planUi';
import { carriedForwardNote } from '../../data/plans/planDefaults';
import { scheduleRows, upcomingTiles } from '../../data/plans/planSchedule';

const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const NA = { ar: 'غير متاح', en: 'Not available' };
/** the text of every figure that needs the period to have started (an UPCOMING plan: no actual, planned-to-date, achievement, deviation, forecast or required pace — never 0) */
export const BEFORE_START = { ar: 'غير متاح قبل بدء الفترة', en: 'Not available before the period starts' };
/** the illustrative-target note of a system plan whose target carries a 2026 budget forward (null for any other plan) */
export function illustrativeNote(view) {
  const b = view?.content?.target?.basis; if (!view?.isSystem) return null;
  const bl = view?.content?.baseline; if (bl && bl.note) return bl.note; // the remaining-2026 plan: its own frozen note
  const from = b?.carriedFromYear; const year = Number(String(view.period?.start || '').slice(0, 4)) || undefined;
  return from ? carriedForwardNote(year, from, Math.round((b.coverage || 0) * 100)) : { ar: 'بيانات توضيحية', en: 'Illustrative data' };
}

/** the first printed reason of a state: the measure reasons, then the basis state text */
function reasonText(m, lang) {
  const r = (m?.reasons || [])[0];
  if (r) return lang === 'en' ? r.en : r.ar;
  const t = PLAN_STATE_TEXT[m?.state]; return t ? pickL(t, lang) : '';
}

/* ------------------------------------------------------------------------------------------------ the frozen BASELINE of a derived plan */
/** «الأساس حتى 6 نوفمبر 2026» — the annual target, the collections to the cut-off, the remaining requirement and (only when any) the surplus, from the plan's FROZEN baseline; visibly separate from the planned collections of the plan period. */
export function PlanBaselineBlock({ view }) {
  const { L, lang, short, sar } = useAr(); const b = view?.content?.baseline; if (!b || b.kind !== 'remaining_of_annual') return null;
  const day = fmtDateText(b.cutoff, lang); const Row = ({ id, k, v }) => (<div id={id}><dt>{k}</dt><dd className="pl-num" dir="ltr" title={sar(v)}>{short(v)}</dd></div>);
  return (
    <div className="pln-baseline" id="plan-baseline" role="group" aria-labelledby="plan-baseline-h">
      <h3 className="pl-h3" id="plan-baseline-h">{L(`الأساس حتى ${day}`, `Baseline to ${day}`)}<small>{L('مجمّد عند إنشاء الخطة — منفصل عن التحصيل المخطط لفترة الخطة', 'frozen when the plan was created — separate from the planned collections of the plan period')}</small></h3>
      <dl className="pln-baseline__grid">
        <Row id="plan-baseline-annual" k={L('المستهدف السنوي 2026', '2026 annual target')} v={b.annualTarget} />
        <Row id="plan-baseline-actual" k={L(`المحصّل حتى ${day}`, `Collected to ${day}`)} v={b.actualToCutoff} />
        <Row id="plan-baseline-remaining" k={L('المطلوب تحصيله (المتبقي)', 'Remaining requirement')} v={b.remaining} />
        {b.surplus > 0 && <Row id="plan-baseline-surplus" k={L('الفائض (جهات تجاوزت مخصصها)', 'Surplus (entities above their allocation)')} v={b.surplus} />}
      </dl>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------ the NOTIFIED BUDGET (one compact figure of the summary) */
/** «الميزانية المبلّغة لعام <year>» — the communicated budget of chapters 1–3 of the plan's year (notifiedBudget.js): a compact row, visibly NOT a performance tile and never the collection target; unavailable ≠ 0 */
export function NotifiedBudget({ budget }) {
  const { lang, short, sar } = useAr(); if (!budget) return null;
  const ok = budget.state === 'ok';
  return (
    <div className="pln-budget" id="plan-notified-budget" data-state={budget.state} data-year={budget.year ?? ''} role="group" aria-label={pickL(budget.label, lang)}>
      <span className="pln-budget__k" id="plan-notified-budget-label">{pickL(budget.label, lang)}</span>
      {budget.year != null && <span className="pl-chip pl-chip--plain" data-chip="budget-year">{budget.year}</span>}
      {ok && <b className="pln-budget__v pl-num" dir="ltr" id="plan-notified-budget-value" title={sar(budget.amount)}>{short(budget.amount)}</b>}
      {budget.scopeLabel && <span className="pl-sub2" id="plan-notified-budget-scope">{pickL(budget.scopeLabel, lang)}</span>}
      {budget.subLabel && <span className="pl-sub2" id="plan-notified-budget-sub">{pickL(budget.subLabel, lang)}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------ the ONE summary */
export function PlanSummary({ measures, view, plan, budget = null, basis = null }) {
  const { L, lang, short, sar } = useAr(); const m = measures; if (!m) return null;
  const cut = m.dates.reportingCutoff ? fmtDateText(m.dates.reportingCutoff, lang) : '';
  const noMuni = m.state === 'no_municipal_target';
  const masked = !!(view?.content?.target?.masked || plan?.masked);
  const future = m.state === 'future_period'; const completed = m.state === 'completed';
  const upNote = illustrativeNote(view); const startLabel = future ? upcomingLabel(view?.period?.start, (d) => fmtDateText(d, lang)) : null;
  const tNA = noMuni || (masked && plan?.municipalOnlyEntityKeys?.length && !fin(m.target)) ? pickL(NO_MUNICIPAL_TARGET, lang) : L('لا مستهدف', 'No target');
  // an UPCOMING plan: ONE status + the four planning measures (target · planned first month(s) · required daily) — what cannot be computed before the start is folded into the status line, never repeated as empty cards
  const tiles = future && basis ? upcomingTiles(basis, { derived: !!view?.content?.baseline }) : [];
  if (future && (tiles.length || !fin(m.target))) {
    return (
      <section id="plan-summary" className="card pl-section" aria-labelledby="plan-summary-h">
        <h2 id="plan-summary-h" className="pl-h2">{L('ملخص الأداء', 'Performance summary')}{m.viewLabel && <small>{pickL(m.viewLabel, lang)}</small>}</h2>
        <div className="pln-upcoming" id="plan-upcoming" role="status">
          <span className="pl-chip pl-chip--info" data-chip="upcoming"><b>{pickL(startLabel, lang)}</b></span>
          {upNote && <span className="pl-chip pl-chip--warn" data-chip="illustrative"><b>{pickL(SYSTEM_PLAN, lang)}</b></span>}
          <span className="pl-sub2" id="plan-upcoming-line">{L(`لا محصّل ولا انحراف ولا أداء مقابل المخطط قبل بدء الفترة؛ تظهر هذه المقاييس تلقائياً بعد ${fmtDateText(view?.period?.start, lang)}.`, `No collected, deviation or performance-against-plan figures before the period starts; they appear automatically from ${fmtDateText(view?.period?.start, lang)}.`)}</span>
          {upNote && <span className="pl-sub2" id="plan-illustrative-note">{pickL(upNote, lang)}</span>}
        </div>
        <PlanBaselineBlock view={view} />
        {tiles.length ? (
          <div className="pl-pos pln-summary" id="plan-upcoming-tiles">
            {tiles.map((t) => (<MetricTile key={t.id} id={`plan-tile-${t.id}`} label={pickL(t.label, lang)} value={fin(t.value) ? <span title={sar(t.value)}>{short(t.value)}</span> : '—'} sub={pickL(t.sub, lang)} />))}
          </div>
        ) : <p className="pl-sub" role="status" id="plan-no-target"><b>{tNA}</b></p>}
        <NotifiedBudget budget={budget} />
      </section>
    );
  }
  return (
    <section id="plan-summary" className="card pl-section" aria-labelledby="plan-summary-h">
      <h2 id="plan-summary-h" className="pl-h2">{L('ملخص الأداء', 'Performance summary')}{m.viewLabel && <small>{pickL(m.viewLabel, lang)}</small>}</h2>
      {(future || upNote) && (
        <div className="pln-upcoming" id="plan-upcoming" role="status">
          {future && <span className="pl-chip pl-chip--info" data-chip="upcoming"><b>{pickL(startLabel, lang)}</b></span>}
          {upNote && <span className="pl-chip pl-chip--warn" data-chip="illustrative"><b>{pickL(SYSTEM_PLAN, lang)}</b></span>}
          {future && <span className="pl-sub2">{L('لا محصّل ولا مخطط حتى تاريخه ولا انحراف ولا توقع قبل بدء الفترة؛ المستهدف والتخصيص والجدول الشهري معروضة كما هي.', 'No collected, planned-to-date, deviation or forecast figures before the period starts; the target, allocation and monthly schedule are shown as they are.')}</span>}
          {upNote && <span className="pl-sub2" id="plan-illustrative-note">{pickL(upNote, lang)}</span>}
        </div>
      )}
      <PlanBaselineBlock view={view} />
      <div className="pl-pos pln-summary">
        <MetricTile id="plan-target" label={L('المستهدف', 'Target')} value={fin(m.target) && m.target > 0 ? <span title={sar(m.target)}>{short(m.target)}</span> : '—'}
          sub={fin(m.target) && m.target > 0 ? (masked ? pickL(RESTRICTED_LABEL, lang) : `${L('مستهدف الفترة كاملة', 'The full-period target')}${upNote ? ` · ${L('توضيحي', 'illustrative')}` : ''}`) : <b>{tNA}</b>} />
        <MetricTile id="plan-actual" label={future ? L('المحصّل', 'Collected') : L(`المحصّل حتى ${cut}`, `Collected to ${cut}`)} value={fin(m.actual) ? <span title={sar(m.actual)}>{short(m.actual)}</span> : '—'}
          sub={fin(m.achievementToDate)
            ? <><span>{L('نسبة تحقيق المستهدف حتى تاريخه', 'Target achievement to date')}: </span><b className="pl-num" dir="ltr" title={L('المحصّل ÷ المستهدف الكامل للفترة، بلا سقف 100%', 'Collected ÷ the full-period target, not capped at 100%')}>{pct(m.achievementToDate)}</b></>
            : <span>{future ? pickL(BEFORE_START, lang) : noMuni ? pickL(NO_MUNICIPAL_TARGET, lang) : `${L('نسبة تحقيق المستهدف حتى تاريخه', 'Target achievement to date')}: ${pickL(NA, lang)}`}</span>} />
        <div className="rv-tile" id="plan-vs-plan">
          <div className="rv-tile__label"><span>{L('الأداء مقابل المخطط حتى تاريخه', 'Performance against the plan to date')}</span></div>
          {fin(m.deviation.amount) ? (
            <>
              <div className="rv-tile__value" dir="ltr" title={`${L('الانحراف = المحصّل − المخطط حتى تاريخه', 'Deviation = collected − planned to date')}${fin(m.deviation.pct) ? ` — ${L('الانحراف %', 'Deviation %')} ${signedPct(m.deviation.pct)}` : ''} · ${sar(m.deviation.amount)}`}>{signedMoney(m.deviation.amount, short)}</div>
              <div className="rv-tile__sub">{fin(m.vsPlanRatio) ? <><span>{L('نسبة الإنجاز مقابل المخطط', 'Achievement against plan')}: </span><b className="pl-num" dir="ltr" title={L('المحصّل ÷ المخطط حتى تاريخه', 'Collected ÷ planned to date')}>{pct(m.vsPlanRatio)}</b></> : <span>{L('نسبة الإنجاز مقابل المخطط', 'Achievement against plan')}: {pickL(NA, lang)}{m.vsPlanReason === 'planned_zero' ? ` — ${L('المخطط حتى تاريخه صفر', 'planned to date is zero')}` : ''}</span>}</div>
              <div className="rv-tile__sub">{L('الفرق الموقّع = المحصّل − المخطط حتى تاريخه', 'Signed difference = collected − planned to date')}</div>
            </>
          ) : (<><div className="rv-tile__value" dir="ltr">—</div><div className="rv-tile__sub">{future ? pickL(BEFORE_START, lang) : noMuni ? pickL(NO_MUNICIPAL_TARGET, lang) : reasonText(m, lang) || pickL(NA, lang)}</div></>)}
        </div>
        <div className="rv-tile pl-sep" id="plan-expected">
          <div className="rv-tile__label"><span>{completed ? L('النتيجة النهائية للفترة', 'Final result of the period') : L('المتوقع تحصيله بنهاية الفترة', 'Expected collected by the end of the period')}</span></div>
          {completed && m.final ? (
            <>
              <div className="rv-tile__value" dir="ltr" title={sar(m.actual)}>{short(m.actual)}</div>
              <div className="rv-tile__sub"><span>{L('نسبة التحقق النهائية', 'Final achievement')}: </span><b className="pl-num" dir="ltr">{pct(m.final.pct)}</b></div>
              <div className="rv-tile__sub">{pickL(m.final.label, lang)}</div>
            </>
          ) : m.expected.state === 'ok' ? (
            <>
              <div className="rv-tile__value" dir="ltr" title={sar(m.expected.amount)}>{short(m.expected.amount)}</div>
              <div className="rv-tile__sub">{fin(m.expected.pct)
                ? <><span>{pickL(m.expected.label, lang) || L('نسبة تحقيق المستهدف المتوقعة بنهاية الفترة', 'Expected target achievement by the end of the period')}: </span><b className="pl-num" dir="ltr" title={L('المتوقع ÷ المستهدف الكامل — ليست احتمالية ولا سقف 100%', 'Expected ÷ the full-period target — not a probability, not capped at 100%')}>{pct(m.expected.pct)}</b></>
                : <span>{L('نسبة تحقيق المستهدف المتوقعة بنهاية الفترة', 'Expected target achievement by the end of the period')}: {noMuni ? pickL(NO_MUNICIPAL_TARGET, lang) : pickL(NA, lang)}</span>}</div>
              {fin(m.expected.gap) && m.expected.gapKind && <div className="rv-tile__sub" data-gap={m.expected.gapKind}><b>{pickL(m.expected.gapLabel, lang)}</b>: <span className="pl-num" dir="ltr">{short(Math.abs(m.expected.gap))}</span></div>}
            </>
          ) : (<><div className="rv-tile__value" dir="ltr">—</div><div className="rv-tile__sub">{future ? pickL(BEFORE_START, lang) : reasonText(m, lang) || pickL(NA, lang)}</div></>)}
        </div>
      </div>
      <NotifiedBudget budget={budget} />
    </section>
  );
}

/* ------------------------------------------------------------------------------------------------ conditional notices */
const SHOWN = new Set(['stale_data', 'no_municipal_target', 'zero_target', 'above_target', 'period_end', 'data_gap']);
/** ONLY the conditional notices (stale data · restricted / municipal scope · no target · year-end / above target). No always-on chip row. */
export function PlanNotices({ basis, extra = [] }) {
  const { L, lang } = useAr(); if (!basis) return null;
  const chips = [];
  if (basis.restricted || basis.scopeKind === 'available') chips.push({ key: 'scope', tone: 'info', k: L('النطاق', 'Scope'), v: pickL(basis.scopeLabel || RESTRICTED_LABEL, lang) });
  for (const n of (basis.notices || []).filter((x) => SHOWN.has(x.code))) chips.push({ key: n.code, tone: n.tone || 'info', v: lang === 'en' ? n.en : n.ar });
  for (const n of extra) chips.push({ key: n.code, tone: n.tone || 'info', v: lang === 'en' ? n.en : n.ar });
  if (!chips.length) return null;
  return (
    <section id="plan-context" className="pl-ctx" aria-label={L('تنبيهات الأرقام', 'Notices about the figures')}>
      <ul className="pl-ctxrow">{chips.map((c) => (<li key={c.key} className={`pl-chip pl-chip--${c.tone}`} data-notice={c.key}>{c.k && <span className="pl-chip__k">{c.k}</span>}<b>{c.v}</b></li>))}</ul>
    </section>
  );
}

/* ------------------------------------------------------------------------------------------------ position */
export function PlanPositionBlock({ basis, measures }) {
  const { L, lang, short, sar, count } = useAr(); if (!basis) return null;
  const cut = basis.reportingCutoff; const d = measures?.dates || {};
  const planned = basis.plannedToDate; const T = basis.target?.value || 0;
  if (basis.state === 'future_period') return null; // an UPCOMING plan: the position (collected · planned to date · remaining) cannot exist yet — it is folded into the ONE status line of the summary, never a card of its own
  return (
    <section id="plan-position" className="card pl-section" aria-labelledby="plan-position-h">
      <h2 id="plan-position-h" className="pl-h2">{L('الموقف حتى تاريخه', 'Position to date')}{cut && <small>{L(`مقابل الخطة حتى ${fmtDateText(cut, lang)}`, `against the plan to ${fmtDateText(cut, lang)}`)}</small>}</h2>
      <dl className="pln-pos">
        <div id="plan-cutoff"><dt>{L('تاريخ الإغلاق المستخدم في الأرقام', 'Cut-off date of the figures')}</dt><dd className="pl-num" dir="ltr">{cut ? fmtDateText(cut, lang) : '—'}</dd></div>
        <div id="plan-planned"><dt>{L('المخطط حتى تاريخه', 'Planned to date')}</dt>
          <dd><span className="pl-num" dir="ltr" title={fin(planned) ? sar(planned) : undefined}>{fin(planned) ? short(planned) : '—'}</span>
            {basis.profile?.assumption && <span className="pl-sub2 pln-assume" data-assumption="equal">{pickL(EQUAL_ASSUMPTION, lang)}{basis.partialMonth ? L(' — الشهر الأخير بالتناسب على أيامه', ' — the last month prorated by its days') : ''}</span>}
            {!basis.profile?.assumption && basis.partialMonth && <span className="pl-sub2">{L('الشهر الأخير بالتناسب على أيامه', 'The last month prorated by its days')}</span>}
            {!fin(planned) && <span className="pl-sub2">{basis.state === 'no_municipal_target' ? pickL(NO_MUNICIPAL_TARGET, lang) : L('لا مخطط: لا مستهدف أو لم تبدأ الفترة', 'No plan figure: no target or the period has not started')}</span>}</dd></div>
        <div id="plan-remaining"><dt>{L('المتبقي من المستهدف', 'Remaining of the target')}</dt>
          <dd><span className="pl-num" dir="ltr">{fin(basis.remainingTarget) && T > 0 ? short(basis.remainingTarget) : '—'}</span>{basis.flags?.aboveTarget && <span className="pl-sub2">{L(`تحقق المستهدف — تجاوز بمقدار ${short(basis.exceededBy)}`, `Target reached — exceeded by ${short(basis.exceededBy)}`)}</span>}</dd></div>
        <div><dt>{L('الأيام المتبقية في الفترة', 'Days left in the period')}</dt><dd className="pl-num" dir="ltr">{basis.remaining ? count(basis.remaining.days) : '—'}</dd></div>
      </dl>
    </section>
  );
}

/* ------------------------------------------------------------------------------------------------ cumulative chart */
export function PlanCumulativeSection({ basis, chart, view, onViewChange }) {
  const { L, lang } = useAr(); if (!basis || !chart) return null;
  const future = basis.state === 'future_period';
  return (
    <section id="plan-cumulative" className="card pl-section" aria-labelledby="plan-cumulative-h">
      <h2 id="plan-cumulative-h" className="pl-h2">{future ? L('المخطط التراكمي للفترة', 'Cumulative plan of the period') : L('المحصّل التراكمي مقابل المخطط والمتوقع', 'Cumulative actual, planned and forecast')}{future && <small>{L('الخطة (وتوقع الفترة إن توفّر) — لا فعلي قبل بدء الفترة', 'The plan (and the period forecast when available) — no actual before the period starts')}</small>}{basis.reportingCutoff && <small>{L(`الفعلي حتى ${fmtDateText(basis.reportingCutoff, lang)}`, `actual to ${fmtDateText(basis.reportingCutoff, lang)}`)}</small>}</h2>
      <div className="pl-chart"><PageChart block={chart} view={view} onViewChange={onViewChange} picker={false} table /></div>
    </section>
  );
}

/* ------------------------------------------------------------------------------------------------ forecast + required pace */
const PACE_WHY = {
  period_ended: ['لا وتيرة مطلوبة: انتهت الفترة.', 'No required pace: the period has ended.'], target_reached: ['لا وتيرة مطلوبة: تحقق المستهدف.', 'No required pace: the target has been reached.'],
  no_target: ['لا وتيرة مطلوبة: لا مستهدف.', 'No required pace: there is no target.'], zero_target: ['لا وتيرة مطلوبة: لا مستهدف.', 'No required pace: there is no target.'], target_missing: ['لا وتيرة مطلوبة: لا مستهدف.', 'No required pace: there is no target.'],
  not_started: ['لا وتيرة مطلوبة: لم تبدأ الفترة.', 'No required pace: the period has not started.'], no_municipal_target: ['لا وتيرة مطلوبة: لم يُحدد مستهدف لهذه البلدية.', 'No required pace: no target has been set for this municipality.'],
  no_actual: ['لا بيانات فعلية لحساب الوتيرة.', 'No actual data to compute the pace.']
};
/** the required / recent pace block — shared by the running and the upcoming period (the required pace needs only the target and the days of the period) */
function PaceBlock({ basis, forecast }) {
  const { L, lang, short, count } = useAr(); const B = (o) => (o == null ? '' : lang === 'en' ? o.en : o.ar); const fc = forecast || {}; const ok = fc.state === 'ok';
  const req = basis.pace?.required || { state: 'none' }; const rate = ok ? fc.monthlyRate : null; const dec = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—');
  const why = PACE_WHY[req.reason] ? PACE_WHY[req.reason][lang === 'en' ? 1 : 0] : ''; const up = req.upcoming === true;
  return (
    <div className="pl-block" id="plan-pace" aria-label={L('الوتيرة', 'Pace')}>
      <div className="pl-h3">{up ? L('الوتيرة المطلوبة للتحصيل', 'The required collection pace') : L('الوتيرة: المطلوبة مقابل الحالية', 'Pace: required against recent')}</div>
      {req.state === 'ok' ? (
        <div className="pl-pace">
          <div id="plan-pace-monthly"><div className="pl-pace__k">{L('المطلوبة شهرياً', 'Required per month')}</div><div className="pl-pace__v" dir="ltr">{short(req.monthly)}</div><div className="pl-pace__s">{L(`${up ? 'المستهدف' : 'المتبقي من المستهدف'} ${short(basis.remainingTarget)} ÷ ${dec(req.remainingMonths)} شهراً (بالأيام)`, `${up ? 'target' : 'remaining target'} ${short(basis.remainingTarget)} ÷ ${dec(req.remainingMonths)} months (by days)`)}</div></div>
          <div id="plan-pace-daily"><div className="pl-pace__k">{L('المطلوبة يومياً', 'Required per day')}</div><div className="pl-pace__v" dir="ltr">{short(req.daily)}</div><div className="pl-pace__s">{L(`÷ ${count(req.remainingDays)} يوماً ${up ? 'في الفترة' : 'متبقياً'} حتى ${basis.period?.end}`, `÷ ${count(req.remainingDays)} days ${up ? 'in the period' : 'left'} to ${basis.period?.end}`)}</div></div>
          {(ok || !up) && <div><div className="pl-pace__k">{L('الحالية (آخر 3 أشهر مكتملة)', 'Recent (last 3 complete months)')}</div><div className="pl-pace__v" dir="ltr">{fin(rate) ? short(rate) : '—'}</div><div className="pl-pace__s">{ok ? B(fc.method?.window?.label) : fc.message ? B(fc.message) : ''}</div></div>}
          {ok && fin(fc.requiredVsRate) && <div><div className="pl-pace__k">{L('الزيادة اللازمة في الوتيرة', 'Increase needed in the pace')}</div><div className="pl-pace__v" dir="ltr">{dec(fc.requiredVsRate)}×</div><div className="pl-pace__s">{L('المطلوب ÷ الحالي', 'required ÷ recent')}</div></div>}
        </div>
      ) : (
        <div className="pl-pace__s" role="status">{why}{ok && fin(rate) && <> {L(`الوتيرة الحالية ${short(rate)} شهرياً (${B(fc.method?.window?.label)}).`, `Recent pace ${short(rate)} a month (${B(fc.method?.window?.label)}).`)}</>}</div>
      )}
    </div>
  );
}

/** target · planned schedule · forecast — three DISTINCT, labelled things of an upcoming plan (the forecast is the evidence, never the schedule and never the target) */
function ThreeThings({ basis, forecast }) {
  const { L, lang, short, sar } = useAr(); const B = (o) => (o == null ? '' : lang === 'en' ? o.en : o.ar); const T = basis.target?.value; const months = basis.months || [];
  const mname = (ym) => B(planMonthLabel(ym)).replace(/\s\d{4}$/, '');
  const sched = months.length <= 3 ? months.map((m) => `${mname(m.ym)} ${short(m.planned)}`).join(' + ') + ` = ${short(months.reduce((t, m) => t + (m.planned || 0), 0))}` : L(`موزَّع على ${months.length} شهراً — الجدول أدناه`, `spread over ${months.length} months — see the schedule below`);
  return (
    <dl className="pln-three" id="plan-three" aria-label={L('المستهدف والجدول والتوقع', 'Target, schedule and forecast')}>
      <div id="plan-three-target"><dt>{L('المستهدف — ما يجب تحصيله', 'Target — what must be collected')}</dt><dd className="pl-num" dir="ltr" title={sar(T)}>{short(T)}</dd></div>
      <div id="plan-three-schedule"><dt>{L('الجدول المخطط — كيف يُوزَّع المستهدف', 'Planned schedule — how the target is distributed')}</dt><dd className="pl-num" dir="ltr">{sched}</dd></div>
      <div id="plan-three-forecast"><dt>{L('التوقع — ما يشير إليه السجل الحديث', 'Forecast — what the recent evidence suggests')}</dt>
        <dd className="pl-num" dir="ltr" title={sar(forecast.forecastTotal)}>{short(forecast.forecastTotal)}</dd>
        <dd className="pl-sub2" dir="auto">{L(`${(forecast.expectedAchievementPct * 100).toFixed(1)}% من المستهدف (نسبة تحقيق متوقعة — ليست احتمالاً)`, `${(forecast.expectedAchievementPct * 100).toFixed(1)}% of the target (expected achievement — not a probability)`)}{fin(forecast.gap) && forecast.gapKind && forecast.gapKind !== 'none' ? ` · ${B(forecast.gapLabel)}: ${short(Math.abs(forecast.gap))}` : ''}</dd></div>
    </dl>
  );
}

export function PlanForecastSection({ basis, forecast, measures }) {
  const { L, lang, short, count } = useAr(); if (!basis || !forecast) return null;
  const B = (o) => (o == null ? '' : lang === 'en' ? o.en : o.ar); const ok = forecast.state === 'ok';
  const fmt = (d) => fmtDateText(d, lang);
  if (basis.state === 'future_period') {
    const upOk = ok && forecast.upcoming === true; const hasPace = basis.pace?.required?.state === 'ok';
    return (
      <section id="plan-outlook" className="card pl-section" aria-labelledby="plan-outlook-h">
        <h2 id="plan-outlook-h" className="pl-h2">{upOk ? L('المستهدف والجدول والتوقع للفترة', 'Target, schedule and forecast of the period') : L('الوتيرة المطلوبة للفترة', 'The required pace of the period')}</h2>
        {upOk && <ThreeThings basis={basis} forecast={forecast} />}
        {upOk && <p className="pl-sub" id="plan-forecast-composition">{L(`المتوقع للفترة ${short(forecast.forecastTotal)} = الوتيرة الحالية ${short(forecast.monthlyRate)} شهرياً × ${forecast.remaining.months.toFixed(2)} شهراً (${count(forecast.remaining.days)} يوماً، بالأيام). لا يشمل أي تحصيل قبل ${fmt(basis.period.start)}.`, `Expected for the period ${short(forecast.forecastTotal)} = the recent pace ${short(forecast.monthlyRate)} a month × ${forecast.remaining.months.toFixed(2)} months (${count(forecast.remaining.days)} days, by days). It includes no collection before ${fmt(basis.period.start)}.`)}</p>}
        {!upOk && forecast.message && <div className="rv-callout" role="status" id="plan-outlook-unsupported">{B(forecast.message)}</div>}
        {hasPace && <PaceBlock basis={basis} forecast={forecast} />}
        {upOk && (
          <p className="pl-note" id="plan-forecast-dates" role="note">{L(`تواريخ الأرقام: بيانات حتى ${fmt(forecast.reportingCutoff)} · آخر شهر مكتمل في الأساس ${forecast.lastCompleteMonth ? B(planMonthLabel(forecast.lastCompleteMonth)) : '—'} · بداية الفترة ${fmt(basis.period.start)} · أُنشئ التوقع ${forecast.forecastGeneratedAt ? forecast.forecastGeneratedAt.slice(0, 10) : '—'}. هذا توقع حديث الوتيرة ولا يُغيّر المستهدف ولا الجدول.`, `Dates of the figures: data to ${fmt(forecast.reportingCutoff)} · last complete month in the baseline ${forecast.lastCompleteMonth ? B(planMonthLabel(forecast.lastCompleteMonth)) : '—'} · period start ${fmt(basis.period.start)} · forecast generated ${forecast.forecastGeneratedAt ? forecast.forecastGeneratedAt.slice(0, 10) : '—'}. A recent-run-rate forecast; it changes neither the target nor the schedule.`)}</p>
        )}
      </section>
    );
  }
  return (
    <section id="plan-outlook" className="card pl-section" aria-labelledby="plan-outlook-h">
      <h2 id="plan-outlook-h" className="pl-h2">{L('التوقع بنهاية الفترة والوتيرة المطلوبة للتحصيل', 'Forecast to the end of the period and the required collection pace')}</h2>
      {forecast.state === 'completed' && basis.outcome && <div className={`pl-notice pl-notice--${basis.outcome.achieved ? 'good' : 'warn'}`} role="status"><b>{L('انتهت الفترة: ', 'The period has ended: ')}</b>{B(basis.outcome.label)}. {L('لا وتيرة مطلوبة ولا توقع بعد نهاية الفترة.', 'No required pace and no forecast after the period ends.')}</div>}
      {forecast.state === 'insufficient_history' && <div className="rv-callout rv-callout--warn" role="status">{B(forecast.message)}</div>}
      {['incompatible_input', 'stale_input', 'no_data', 'no_target', 'future_period', 'invalid_view_scope'].includes(forecast.state) && <div className="rv-callout" role="status">{B(forecast.message || PLAN_STATE_TEXT[forecast.state])}</div>}
      {ok && (
        <p className="pl-sub" id="plan-forecast-composition">{L(`المتوقع بنهاية الفترة ${short(forecast.forecastTotal)} = المحصّل حتى تاريخه ${short(forecast.actualToDate)} + المتوقع في ما تبقى ${short(forecast.expectedRemaining)}`, `Expected by the end of the period ${short(forecast.forecastTotal)} = collected to date ${short(forecast.actualToDate)} + expected in the rest of the period ${short(forecast.expectedRemaining)}`)}{forecast.targetState === 'no_municipal_target' ? ` — ${B(NO_MUNICIPAL_TARGET)}` : ''}</p>
      )}
      {ok && forecast.bridge && (
        <div className="pl-block pl-block--soft" id="plan-bridge">
          <div className="pl-h3">{L('من أين تأتي فجوة نهاية الفترة؟', 'Where does the end-of-period gap come from?')}</div>
          <div className="pl-bridge" dir="auto">
            <span>{L('الفجوة المتوقعة', 'Expected gap')} <b className="pl-num" dir="ltr">{short(forecast.bridge.gap)}</b></span> <span aria-hidden="true">=</span>
            <span>{L('دون المخطط حتى الآن', 'below the plan so far')} <b className="pl-num" dir="ltr">{short(forecast.bridge.behindAtCutoff)}</b></span> <span aria-hidden="true">+</span>
            <span>{L('جزء من المتبقي من الخطة لا يغطيه المتوقع', 'the part of the remaining plan the expected collections do not cover')} <b className="pl-num" dir="ltr">{short(forecast.bridge.uncoveredRemainingPlan)}</b></span>
          </div>
        </div>
      )}
      <PaceBlock basis={basis} forecast={forecast} />
    </section>
  );
}

/* ------------------------------------------------------------------------------------------------ the planned SCHEDULE by month (shared by every plan) */
/** the monthly schedule: month · days in the plan · planned (a partial month by its days) · cumulative plan — and, for a month that has started, the actual and the deviation of the COMPLETE months. Σ planned = the target to the riyal. */
export function PlanScheduleSection({ basis }) {
  const { L, lang, short, sar, count } = useAr(); const sc = scheduleRows(basis); if (!sc.rows.length) return null;
  const B = (o) => (o == null ? '' : lang === 'en' ? o.en : o.ar); const { rows, totals } = sc; const assumed = !!basis.profile?.assumption;
  return (
    <section id="plan-schedule" className="card pl-section" aria-labelledby="plan-schedule-h">
      <h2 id="plan-schedule-h" className="pl-h2">{L('الجدول الشهري المخطط', 'The planned monthly schedule')}<small>{L('كيف يُوزَّع المستهدف على أشهر الفترة', 'how the target is distributed over the months of the period')}</small></h2>
      <div className="pl-tablewrap" tabIndex={0} role="region" aria-label={L('الجدول الشهري المخطط', 'The planned monthly schedule')}>
        <table className="pl-table pln-break" id="plan-schedule-table">
          <caption className="sr-only">{L('الجدول الشهري المخطط', 'The planned monthly schedule')}</caption>
          <thead><tr><th scope="col">{L('الشهر', 'Month')}</th><th scope="col">{L('أيام الفترة في الشهر', 'Days of the period in the month')}</th><th scope="col">{L('المخطط', 'Planned')}</th><th scope="col">{L('حصته من المستهدف', 'Share of the target')}</th><th scope="col">{L('المخطط التراكمي', 'Cumulative plan')}</th>
            {sc.hasActual && <th scope="col">{L('المحصّل', 'Collected')}</th>}{sc.hasActual && <th scope="col">{L('الانحراف (شهر مكتمل)', 'Deviation (complete month)')}</th>}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ym} data-month={r.ym} className={r.partial ? 'pln-partial' : ''}>
                <th scope="row">{B(r.label)}{r.partial && <span className="pl-sub2">{B(r.range)}</span>}</th>
                <td className="n" dir="ltr">{r.partial ? `${count(r.days)} / ${count(r.monthDays)}` : count(r.days)}</td>
                <td className="n" dir="ltr">{fin(r.planned) ? <span title={sar(r.planned)}>{short(r.planned)}</span> : '—'}</td>
                <td className="n" dir="ltr">{fin(r.share) ? `${(r.share * 100).toFixed(1)}%` : '—'}</td>
                <td className="n" dir="ltr">{fin(r.plannedCum) ? short(r.plannedCum) : '—'}</td>
                {sc.hasActual && <td className="n" dir="ltr">{fin(r.actual) ? short(r.actual) : <span className="pl-na">—</span>}</td>}
                {sc.hasActual && <td className="n" dir="ltr">{fin(r.deviation) ? signedMoney(r.deviation, short) : <span className="pl-na">—</span>}</td>}
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="pln-total"><th scope="row">{L('إجمالي الفترة', 'Period total')}</th><td className="n" dir="ltr">{count(totals.days)}</td><td className="n" dir="ltr" title={sar(totals.planned)}>{short(totals.planned)}{totals.reconciles ? ' ✓' : ''}</td><td className="n" dir="ltr">100%</td><td />{sc.hasActual && <td className="n" dir="ltr">{fin(totals.actual) ? short(totals.actual) : '—'}</td>}{sc.hasActual && <td />}</tr></tfoot>
        </table>
      </div>
      <p className="pl-note" role="note" id="plan-schedule-note">{assumed ? `${B(EQUAL_ASSUMPTION)}. ` : ''}{sc.partial ? L('الشهر الجزئي يُوزَّع بنسبة أيامه من أيام الشهر (وزن اليوم)، ومجموع الأشهر = المستهدف إلى الريال.', 'A partial month is weighted by its days over the days of the month; the months add up to the target to the riyal.') : L('مجموع الأشهر = المستهدف إلى الريال.', 'The months add up to the target to the riyal.')} {L('هذا الجدول هو توزيع المستهدف وليس توقعاً.', 'This is how the target is distributed, not a forecast.')}</p>
    </section>
  );
}

/* ------------------------------------------------------------------------------------------------ deviation by entity / municipality (+ the revenue-source bars and the bullets) */
/** an error inside ONE visual (a chart that cannot be drawn) removes only that visual — a quiet line in its place — never the page */
class VisualBoundary extends React.Component {
  constructor(p) { super(p); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e) { console.error('[plans] a visual failed to draw:', e); }
  componentDidUpdate(prev) { if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false }); }
  render() { return this.state.failed ? <p className="pl-sub" role="status" data-visual-failed={this.props.id}>{this.props.message}</p> : this.props.children; }
}

/** the balance by revenue SOURCE (the actionable balance of the action lines — NOT a deviation: the plan has no source-level target). Clicking a bar chooses the source of the «أين نركز» table. */
function PlanSourceBars({ sources, status, view, onViewChange, srcSel, onPickSource, onResetSource, onRetry }) {
  const { L } = useAr();
  const pickSource = (t) => { const k = sources?.block?.keys?.[t.i]; if (k && onPickSource) onPickSource(k); };
  return (
    <div className="pl-block" id="plan-source-bars" data-status={status}>
      <p className="pl-sub" role="note" id="plan-source-note">{L('لا مستهدف لمصدر الإيراد، فلا انحراف على مستوى المصدر ولا تُوزَّع الخطة على المصادر؛ المعروض هو الرصيد القابل للمتابعة (أرصدة قائمة) من خطوط الإجراءات.', 'There is no revenue-source target, so there is no source-level deviation and the plan is never allocated to sources; what is shown is the actionable balance (standing balances) from the action lines.')}</p>
      {status === 'loading' ? <div className="st-skel" style={{ height: 160 }} aria-busy="true" role="status" aria-label={L('جارٍ التحميل', 'Loading')} />
        : sources ? (
          <>
            <PageChart block={sources.block} view={view} onViewChange={onViewChange} picker="compact" table onPick={onPickSource ? pickSource : null} selected={srcSel && sources.block.keys.indexOf(srcSel) >= 0 ? { i: sources.block.keys.indexOf(srcSel) } : null} />
            {onPickSource && <p className="pl-note" role="note">{L('اضغط شريطاً لتصفية جدول «أين نركز» على ذلك المصدر.', 'Click a bar to filter the “Where to focus” table to that source.')}</p>}
            {srcSel && <div className="pl-sel" id="plan-source-sel"><span>{L('مصدر مختار لجدول الإجراءات:', 'Source chosen for the action table:')} <b>{sources.items.find((x) => x.key === srcSel)?.name || srcSel}</b></span><button type="button" className="btn btn-sm btn-ghost" onClick={onResetSource}>{L('إلغاء', 'Clear')}</button></div>}
          </>
        ) : status === 'error' ? <p className="pl-sub" role="alert">{L('تعذّر تحميل خطوط الإجراءات.', 'The action lines could not be loaded.')} {onRetry && <button type="button" className="btn btn-sm" onClick={onRetry}>{L('إعادة المحاولة', 'Retry')}</button>}</p>
          : status === 'denied' ? <p className="pl-sub" role="status">{L('لا صلاحية لوحدة التخطيط لعرض خطوط الإجراءات.', 'No access to the planning action lines.')}</p>
            : <p className="pl-sub" role="status">{L('لا رصيد قابل للمتابعة في هذا الاختيار.', 'No actionable balance in this selection.')}</p>}
    </div>
  );
}

/** the bullet comparison per entity / municipality: collected · planned to date · the plan-period target on ONE axis (% of that target, not capped); a row without a target is listed as not drawn */
function PlanBullets({ data, block, view, onViewChange, expanded, onToggleExpanded }) {
  const { L, lang } = useAr(); if (!data || (!data.available && !data.missing.length)) return null;
  const W = data.words; const isMuni = data.kind === 'municipality';
  return (
    <div className="pl-block" id="plan-bullets">
      {!block && <div className="pl-h3">{pickL(W.title, lang)}</div>}
      {block ? <PageChart block={block} view={view} onViewChange={onViewChange} picker={false} table /> : <p className="pl-sub" role="status">{data.reason ? pickL(data.reason, lang) : ''}</p>}
      {data.hidden > 0 || expanded ? <button type="button" className="btn btn-sm btn-ghost" aria-expanded={!!expanded} onClick={onToggleExpanded}>{expanded ? L('عرض الأكبر مستهدفاً فقط', 'Show the largest targets only') : L(`عرض كل ${isMuni ? 'البلديات' : 'الجهات'} (${data.total})`, `Show all ${isMuni ? 'municipalities' : 'entities'} (${data.total})`)}</button> : null}
      {block && data.hidden > 0 && !expanded && <p className="pl-note" role="note">{L(`الأكبر مستهدفاً: ${data.rows.filter((r) => !r.scope).length} من ${data.total}.`, `The largest targets: ${data.rows.filter((r) => !r.scope).length} of ${data.total}.`)}</p>}
      {data.missing.length > 0 && <p className="pl-note" id="plan-bullets-missing" role="note">{L(`بلا مستهدف فلا يُرسم: ${data.missing.join('، ')}`, `No target, so not drawn: ${data.missing.join(', ')}`)}</p>}
    </div>
  );
}

export function PlanBreakdownSection({ basis, dev, bd, view, onViewChange, onPickRow, selectedKey, expanded, onToggleExpanded, nameOfRow, sources = null, sourceStatus = 'idle', srcSel = null, onPickSource = null, onResetSource, onRetrySources, bullets = null, bulletBlock = null, bulletsExpanded = false, onToggleBulletsExpanded }) {
  const { L, lang, short, sar } = useAr(); if (!basis) return null;
  const isMuni = bd.kind === 'municipality';
  const pick = (t) => { const k = dev?.block?.keys?.[t.i]; if (k && onPickRow) onPickRow(k); };
  const title = isMuni ? L('المساهمة في الفجوة حسب البلدية', 'Contribution to the gap by municipality') : L('المساهمة في الفجوة حسب الجهة', 'Contribution to the gap by entity');
  const showTable = bd.rows.length > 0 && (isMuni || basis.viewScope?.amanah === 'all' || bd.rows.length > 1);
  const showSources = !!sourceStatus && sourceStatus !== 'idle' && (sourceStatus !== 'ready' || !!sources); // the source bars exist only while the period runs (the action lines are requested then): omitted before the start, never an empty card
  if (basis.state === 'future_period') {
    const total = bd.totals?.target; const share = (t) => (fin(t) && fin(total) && total > 0 ? `${((t / total) * 100).toFixed(1)}%` : '—');
    const ttl = isMuni ? L('تخصيص المستهدف حسب البلدية', 'Target allocation by municipality') : L('تخصيص المستهدف حسب الجهة', 'Target allocation by entity');
    const ms = (basis.months || []).length <= 3 ? basis.months || [] : []; // a short plan: each entity's planned amount of every month too (allocation × schedule); a long plan keeps target + share
    const mAmt = (key, i) => { const e = (basis.entities || []).find((x) => x.key === key); return e && Array.isArray(e.monthly) && fin(e.monthly[i]) ? e.monthly[i] : null; };
    const mLabel = (m) => pickL(planMonthLabel(m.ym), lang).replace(/\s\d{4}$/, '');
    return (
      <section id="plan-contribution" className="card pl-section" aria-labelledby="plan-contribution-h">
        <h2 id="plan-contribution-h" className="pl-h2">{ttl}<small>{L('المستهدف وحصة كل جهة وجدولها الشهري', 'the target, each entity’s share and its monthly schedule')}</small></h2>
        <div className="pl-tablewrap" tabIndex={0} role="region" aria-label={ttl}>
          <table className="pl-table pln-break" id="plan-breakdown-table">
            <caption className="sr-only">{ttl}</caption>
            <thead><tr><th scope="col">{isMuni ? L('البلدية', 'Municipality') : L('الجهة', 'Entity')}</th><th scope="col">{L('المستهدف', 'Target')}</th><th scope="col">{L('حصتها من المستهدف', 'Share of the target')}</th>{ms.map((m) => <th scope="col" key={m.ym}>{L('المخطط', 'Planned')} {mLabel(m)}</th>)}</tr></thead>
            <tbody>{bd.rows.map((r) => (<tr key={r.key} data-row={r.key}><th scope="row">{r.label}</th><td className="n" dir="ltr">{fin(r.target) ? <span title={sar(r.target)}>{short(r.target)}</span> : <span className="pl-na">{r.noTarget ? pickL(NO_MUNICIPAL_TARGET, lang) : '—'}</span>}</td><td className="n" dir="ltr">{share(r.target)}</td>{ms.map((m, i) => <td className="n" dir="ltr" key={m.ym}>{fin(mAmt(r.key, i)) ? short(mAmt(r.key, i)) : '—'}</td>)}</tr>))}</tbody>
            {bd.totals && <tfoot><tr className="pln-total"><th scope="row">{isMuni ? L('إجمالي الأمانة', 'Amanah total') : L('إجمالي الخطة', 'Plan total')}</th><td className="n" dir="ltr">{fin(total) ? short(total) : '—'}</td><td />{ms.map((m) => <td className="n" dir="ltr" key={m.ym}>{fin(m.planned) ? short(m.planned) : '—'}</td>)}</tr></tfoot>}
          </table>
        </div>
      </section>
    );
  }
  return (
    <section id="plan-contribution" className="card pl-section" aria-labelledby="plan-contribution-h">
      <h2 id="plan-contribution-h" className="pl-h2">{title}<small>{isMuni ? L('البلديات ثم «غير موزع على البلديات»', 'municipalities, then “not distributed to municipalities”') : L('الجهات مرتبة بالمبلغ', 'entities ranked by amount')}{showSources ? L(' — ثم مصادر الإيراد والمقارنة بالمستهدف', ' — then revenue sources and the comparison with the target') : bullets?.available ? L(' — ثم المقارنة بالمستهدف', ' — then the comparison with the target') : ''}</small></h2>
      <div className="pln-contrib" id="plan-contrib">
      <div className="pl-block" id="plan-entity-bars">
        {dev?.available ? (
          <>
            <PageChart block={dev.block} view={view} onViewChange={onViewChange} picker="compact" table onPick={onPickRow ? pick : null} selected={selectedKey && dev.block.keys.indexOf(selectedKey) >= 0 ? { i: dev.block.keys.indexOf(selectedKey) } : null} />
            <p className="pl-note" role="note">{L(`مجموع الأشرطة${dev.other ? ' (مع «أخرى»)' : ''} = الانحراف الكلي ${short(dev.sum)}${dev.reconciles ? ' ✓' : ''}. اضغط شريطاً لتصفية الصفحة على ذلك الصف.`, `The bars${dev.other ? ' (with “Other”)' : ''} add up to the total deviation ${short(dev.sum)}${dev.reconciles ? ' ✓' : ''}. Click a bar to filter the page to that row.`)}</p>
            {dev.folded.length > 0 || expanded ? <button type="button" className="btn btn-sm btn-ghost" aria-expanded={!!expanded} onClick={onToggleExpanded}>{expanded ? L('عرض الأعلى فقط', 'Show the top only') : L(`عرض الكل (${dev.shown.length + dev.folded.length})`, `Show all (${dev.shown.length + dev.folded.length})`)}</button> : null}
          </>
        ) : <p className="pl-sub" role="status">{dev?.reason ? (lang === 'en' ? dev.reason.en : dev.reason.ar) : ''}</p>}
      </div>
      {showSources && <VisualBoundary id="sources" resetKey={`${sourceStatus}|${sources ? sources.items.length : 0}|${lang}`} message={L('تعذّر رسم مصادر الإيراد.', 'The revenue-source chart could not be drawn.')}><PlanSourceBars sources={sources} status={sourceStatus} view={view} onViewChange={onViewChange} srcSel={srcSel} onPickSource={onPickSource} onResetSource={onResetSource} onRetry={onRetrySources} /></VisualBoundary>}
      </div>
      <VisualBoundary id="bullets" resetKey={`${bullets ? bullets.rows.length : 0}|${bulletsExpanded}|${lang}`} message={L('تعذّر رسم المقارنة بالمستهدف.', 'The comparison with the target could not be drawn.')}><PlanBullets data={bullets} block={bulletBlock} view={view} onViewChange={onViewChange} expanded={bulletsExpanded} onToggleExpanded={onToggleBulletsExpanded} /></VisualBoundary>
      {showTable && (
        <div className="pl-tablewrap" tabIndex={0} role="region" aria-label={title}>
          <table className="pl-table pln-break" id="plan-breakdown-table">
            <caption className="sr-only">{title}</caption>
            <thead><tr>
              <th scope="col">{isMuni ? L('البلدية', 'Municipality') : L('الجهة', 'Entity')}</th><th scope="col">{L('المستهدف', 'Target')}</th><th scope="col">{L('المحصّل', 'Collected')}</th><th scope="col">{L('المخطط حتى تاريخه', 'Planned to date')}</th>
              <th scope="col">{L('الانحراف', 'Deviation')}</th><th scope="col">{L('نسبة الإنجاز مقابل المخطط', 'Achievement against plan')}</th><th scope="col">{L('نسبة تحقيق المستهدف', 'Target achievement')}</th>
            </tr></thead>
            <tbody>
              {bd.rows.map((r) => (
                <tr key={r.key} data-row={r.key} className={`${r.key === UNALLOCATED_MUNI_KEY ? 'pln-unalloc' : ''}${r.noTarget ? ' pln-notarget' : ''}${selectedKey === r.key ? ' is-selected' : ''}`}>
                  <th scope="row">{r.label}{r.excess && <span className="pl-sub2">{L('زيادة على مخصص الأمانة', 'exceeds the Amanah allocation')}</span>}</th>
                  <td className="n" dir="ltr">{fin(r.target) ? <span title={sar(r.target)}>{short(r.target)}</span> : r.noTarget ? <span className="pl-na" dir="auto">{pickL(NO_MUNICIPAL_TARGET, lang)}</span> : <span className="pl-na">—</span>}</td>
                  <td className="n" dir="ltr">{fin(r.actual) ? <span title={sar(r.actual)}>{short(r.actual)}</span> : '—'}</td>
                  <td className="n" dir="ltr">{fin(r.planned) ? short(r.planned) : <span className="pl-na">{r.noTarget ? L('غير متاح', 'N/A') : '—'}</span>}</td>
                  <td className="n" dir="ltr">{fin(r.deviation) ? signedMoney(r.deviation, short) : <span className="pl-na">{r.noTarget ? L('غير متاح', 'N/A') : '—'}</span>}</td>
                  <td className="n" dir="ltr">{fin(r.vsPlanRatio) ? pct(r.vsPlanRatio) : <span className="pl-na">{r.noTarget ? L('غير متاح', 'N/A') : '—'}</span>}</td>
                  <td className="n" dir="ltr">{fin(r.achievement) ? pct(r.achievement) : <span className="pl-na">{r.noTarget ? L('غير متاح', 'N/A') : '—'}</span>}</td>
                </tr>
              ))}
            </tbody>
            {bd.totals && (
              <tfoot><tr className="pln-total">
                <th scope="row">{isMuni ? L('إجمالي الأمانة', 'Amanah total') : L('إجمالي الخطة', 'Plan total')}</th>
                <td className="n" dir="ltr">{fin(bd.totals.target) ? short(bd.totals.target) : '—'}</td><td className="n" dir="ltr">{fin(bd.totals.actual) ? short(bd.totals.actual) : '—'}</td>
                <td className="n" dir="ltr">{fin(bd.totals.planned) ? short(bd.totals.planned) : '—'}</td><td className="n" dir="ltr">{fin(bd.totals.deviation) ? signedMoney(bd.totals.deviation, short) : '—'}</td><td /><td />
              </tr></tfoot>
            )}
          </table>
        </div>
      )}
      {isMuni && bd.reconcile && (
        <p className="pl-note pln-reconcile" id="plan-reconcile" role="note">
          {L(`التسوية: مجموع البلديات + «غير موزع على البلديات» = الأمانة — المستهدف ${short(bd.reconcile.target.sum)} ${bd.reconcile.target.ok ? '=' : '≠'} ${fin(bd.reconcile.target.amanah) ? short(bd.reconcile.target.amanah) : '—'}${bd.reconcile.target.ok ? ' ✓' : ''}`, `Reconciliation: municipalities + “not distributed to municipalities” = the Amanah — target ${short(bd.reconcile.target.sum)} ${bd.reconcile.target.ok ? '=' : '≠'} ${fin(bd.reconcile.target.amanah) ? short(bd.reconcile.target.amanah) : '—'}${bd.reconcile.target.ok ? ' ✓' : ''}`)}
          {' · '}{L(`المحصّل ${short(bd.reconcile.actual.sum)} ${bd.reconcile.actual.ok ? '=' : '≠'} ${fin(bd.reconcile.actual.amanah) ? short(bd.reconcile.actual.amanah) : '—'}${bd.reconcile.actual.ok ? ' ✓' : ''}`, `collected ${short(bd.reconcile.actual.sum)} ${bd.reconcile.actual.ok ? '=' : '≠'} ${fin(bd.reconcile.actual.amanah) ? short(bd.reconcile.actual.amanah) : '—'}${bd.reconcile.actual.ok ? ' ✓' : ''}`)}
          {bd.reconcile.excess > 0 ? ` — ${L(`زيادة على مخصص الأمانة ${short(bd.reconcile.excess)}`, `exceeds the Amanah allocation by ${short(bd.reconcile.excess)}`)}` : ''}
        </p>
      )}
      {isMuni && <p className="pl-note" role="note">{L('«غير موزع على البلديات»: ما لم يُخصَّص لبلدية من مستهدف الأمانة، والتحصيل الذي لا يُنسب إلى بلدية مرجعية (صادر من الأمانة مباشرة أو بلدية غير محددة أو قيمة غير مطابقة). كل سجل في صف واحد فقط.', '“Not distributed to municipalities”: the part of the Amanah target not given to a municipality, and the collections not attributed to a reference municipality (issued directly by the Amanah, not specified, or unmatched). Each record sits in one row only.')}</p>}
    </section>
  );
}
