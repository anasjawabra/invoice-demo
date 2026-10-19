// «التخطيط المالي والاستراتيجي» — where the year stands against its targets (meeting 19 Oct):
//   الميزانية المبلغة للأبواب الثلاثة الأولى (fixed, communicated by the Ministry of Finance at the start of the year) · نسبة التغطية = المحصّل ÷ الميزانية ·
//   المستهدفات (entered by a person: coverage, collection rate, billing; coverage × budget = the revenue target, split by month) · أين نحن من الخطة (target · estimate · actual, probability, focus, reasons).
// There are NO spending figures here: spending belongs to the Financial Copilot. One fiscal year (up to the reporting date), one entity or the whole Ministry.
// Calculations: src/data/collectionGoal.js (progress), planTargets.js (targets), planForecast.js (the demonstration estimate); the budget figures are illustrative (src/data/appropriations.js).
import React, { useMemo, useState } from 'react';
import { useRevenue } from '../context/RevenueContext';
import { useAuth } from '../context/AuthContext';
import { useAsync } from '../utils/useAsync';
import { useAr } from '../utils/useAr';
import { actorName } from '../utils/actor';
import { AsyncBlock } from '../components/strategic/AsyncState';
import EntityMap, { PctBadge } from '../components/strategic/EntityMap';
import TargetsPanel from '../components/strategic/TargetsPanel';
import PlanForecast from '../components/strategic/PlanForecast';
import { MetricTile } from '../components/revenue/RevenueUI';
import { amanahFilterOptions, DATA_START } from '../data/revenueLedger';
import { EXCLUSION_RULES, normalizeConfig } from '../data/revenueMetrics';
import { fmtDateText } from '../data/clock';
import { computeGoal, reportingDateFor } from '../data/collectionGoal';
import { sourceAr, sourceEn } from '../data/insightsEngine';
import { loadTargetStore, targetsOf, totalTargets } from '../data/planTargets';
import { appropriationOf, appropriationTotal, appropriationKeys, HQ_KEY, APPROPRIATION_YEAR } from '../data/appropriations';

const pct = (v) => (Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : '—');
const UNASSIGNED = 'Unassigned';

export default function PlanningArea() {
  const rev = useRevenue(); const { user } = useAuth();
  const { L, ar, lang, short } = useAr();
  const today = rev.cfg.cutoff; const todayYear = Number(today.slice(0, 4));
  const years = useMemo(() => { const out = []; for (let y = todayYear; y >= Number(DATA_START.slice(0, 4)); y -= 1) out.push(y); return out; }, [todayYear]);
  const [year, setYear] = useState(todayYear);
  const [amanah, setAmanah] = useState('all');
  const [retry, setRetry] = useState(0);
  const options = useMemo(() => amanahFilterOptions().filter((a) => !rev.org.amanahKeys || rev.org.amanahKeys.includes(a.key)), [rev.org]);
  const nameOf = (k) => { if (k === HQ_KEY) return L('ديوان عام الوزارة (المقر)', 'Ministry headquarters'); const a = amanahFilterOptions().find((x) => x.key === k); return a ? (ar ? a.ar : a.en) : k; };
  const [tstore, setTstore] = useState(loadTargetStore);
  const canEdit = rev.canReview; const by = actorName(user, lang) || 'user';

  // the entities with a budget row that this user may see (a restricted organisation sees only its own Amanahs and never the headquarters)
  const visibleKeys = useMemo(() => appropriationKeys().filter((k) => (rev.org.amanahKeys ? rev.org.amanahKeys.includes(k) : true)), [rev.org]);
  const A = amanah === 'all' ? appropriationTotal(visibleKeys, year) : appropriationOf(amanah, year);
  const targetRate = rev.targets?.collectionRate?.value ?? 0.6;

  // the targets of every visible entity (defaults reproduce the revenue appropriation) and of the selection
  const entityRows = useMemo(() => visibleKeys.map((k) => targetsOf(tstore, year, k, appropriationOf(k, year))), [visibleKeys, tstore, year]);
  const total = useMemo(() => totalTargets(entityRows), [entityRows]);
  const selectedRow = amanah === 'all' ? null : entityRows.find((r) => r.key === amanah) || null;
  const selected = amanah === 'all' ? { ...total, savedAt: entityRows.map((r) => r.savedAt).filter(Boolean).sort().pop() || null } : selectedRow;

  // ONE data request set: the payments received from 1 January to the reporting date (payment-date basis, any invoice) — by Amanah, month by month — and the billing / balance of the selection.
  const reporting = reportingDateFor(year, today);
  const approvedCfg = useMemo(() => normalizeConfig({ ...rev.cfg, rules: Object.fromEntries(EXCLUSION_RULES.map((r) => [r.id, r.approval === 'approved'])) }), [rev.cfg]);
  const DATA = useAsync(async () => {
    if (!reporting) return null;
    const scope = { from: `${year}-01-01`, to: reporting, amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all' };
    const [snap, ser, entSnap] = await Promise.all([
      rev.data.snapshot(scope, { cfg: approvedCfg }),
      rev.data.series({ ...scope, amanah }, { cfg: approvedCfg }),
      amanah === 'all' ? null : rev.data.snapshot({ ...scope, amanah }, { cfg: approvedCfg })
    ]);
    const S = entSnap || snap; const R = snap.receivedInPeriod;
    const m = Number(reporting.slice(5, 7)); const netBy = new Map(S.byMonth.map((x) => [x.month, x.net]));
    return { byAmanah: R.byAmanah || {}, total: R.total, monthly: ser.values, billedMonthly: Array.from({ length: m }, (_, k) => netBy.get(`${year}-${String(k + 1).padStart(2, '0')}`) || 0), standing: S.stock.netUncollected, cells: S.matrix.amanahSource };
  }, [rev.data, year, amanah, reporting, approvedCfg, retry]);

  const g = useMemo(() => (DATA.data ? computeGoal({ year, today, target: selected?.revenueTarget, monthlyCollected: DATA.data.monthly, plan: selected?.revenueTarget > 0 ? { annualTarget: selected.revenueTarget, months: selected.cumulative, savedAt: selected.savedAt } : null }) : null), [DATA.data, year, today, selected]);
  const dateText = (iso) => fmtDateText(iso, lang);
  const entityName = amanah === 'all' ? L('الوزارة (كل الجهات)', 'The Ministry (all entities)') : nameOf(amanah);
  const ok = g && g.state === 'ok'; const noTarget = g && g.state === 'no_target';
  const noBudget = year !== APPROPRIATION_YEAR; // budgets are loaded for one fiscal year only
  const budget = A?.expAdjusted || 0;
  const coverage = ok && budget > 0 ? g.collected / budget : null;

  // the table behind the map: every entity with the same figures as the tiles (the Ministry row is the sum of the rows shown)
  const rows = useMemo(() => {
    if (!DATA.data) return [];
    const recv = DATA.data.byAmanah;
    const tgt = new Map(entityRows.map((r) => [r.key, r.revenueTarget])); // the SAME target as the targets table (edited targets included)
    const list = visibleKeys.map((k) => { const a = appropriationOf(k, year); return { key: k, a, target: tgt.get(k) || 0, collected: recv[k] || 0 }; })
      .sort((x, y) => y.target - x.target || (y.a?.expAdjusted || 0) - (x.a?.expAdjusted || 0));
    if (!rev.org.amanahKeys || rev.org.amanahKeys.includes(UNASSIGNED)) list.push({ key: UNASSIGNED, a: null, target: 0, collected: recv[UNASSIGNED] || 0 });
    return list;
  }, [DATA.data, visibleKeys, year, rev.org, entityRows]);

  const basis = (ok || noTarget) ? (
    <div className="muted cg-basis">
      <div>{L(`العام المالي ${year}: ${dateText(`${year}-01-01`)} – ${dateText(g.reportingDate)} (تاريخ التقرير) · ${entityName}.`, `Fiscal year ${year}: ${dateText(`${year}-01-01`)} – ${dateText(g.reportingDate)} (reporting date) · ${entityName}.`)}</div>
      <div>{L('الميزانية المبلغة ثابتة للعام (تبلّغها وزارة المالية في بدايته). نسبة التغطية = المحصّل ÷ الميزانية. المستهدف السنوي للإيراد = مستهدف نسبة التغطية × الميزانية. المحصّل = المدفوعات المستلمة بتاريخ الدفع (لا الفوترة).', 'The communicated budget is fixed for the year (the Ministry of Finance announces it at the start). Coverage = collected ÷ budget. The annual revenue target = the coverage target × the budget. Collected = payments received by payment date (not billing).')}</div>
      <div><span className="rv-tag rv-tag--warn">{L('بيانات توضيحية', 'Illustrative data')}</span> {L('أرقام الميزانية مُنشأة لهذا العرض على هيكل ملف الأداء المالي لوزارة المالية ولا تمثل أرقامًا فعلية.', 'The budget figures are created for this demo on the structure of the Ministry of Finance performance file; they are not actual figures.')}</div>
    </div>
  ) : null;

  return (
    <div className="st-page" dir={ar ? 'rtl' : 'ltr'}>
      <header className="st-head">
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>{L('التخطيط المالي والاستراتيجي', 'Financial and strategic planning')}</h1>
          <div className="muted" style={{ fontSize: 13 }}>{L('أين نحن من الخطة: التغطية والمستهدفات والتقدير.', 'Where we stand against the plan: coverage, targets and the estimate.')}</div>
        </div>
      </header>

      <div className="muted cg-defs" role="note">{L('نسبة التغطية = المحصّل ÷ الميزانية المبلغة · نسبة تحقق المستهدف = المحصّل ÷ المستهدف · نسبة التحصيل = المحصّل ÷ صافي المفوتر.', 'Coverage ratio = collected ÷ communicated budget · target achievement = collected ÷ target · collection rate = collected ÷ net billed.')}</div>
      <div className="card card-pad cg-controls">
        <label className="cg-field" htmlFor="cg-year">{L('العام المالي', 'Fiscal year')}
          <select id="cg-year" className="input" value={year} onChange={(e) => setYear(Number(e.target.value))}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>
        </label>
        <label className="cg-field" htmlFor="cg-amanah">{L('الأمانة / الجهة', 'Amanah / entity')}
          <select id="cg-amanah" className="input" value={amanah} onChange={(e) => setAmanah(e.target.value)}>
            <option value="all">{L('الوزارة (كل الجهات)', 'The Ministry (all entities)')}</option>
            {options.map((a) => <option key={a.key} value={a.key}>{ar ? a.ar : a.en}</option>)}
          </select>
        </label>
        <div className="cg-equiv" role="status">
          {A ? <>{L('الميزانية المبلغة للأبواب الثلاثة الأولى', 'Communicated budget, chapters 1–3')}: <b dir="ltr">{short(A.expAdjusted)}</b></> : <span className="muted">{L(`لا تتوفر ميزانية مبلغة لـ ${entityName} في ${year}.`, `No communicated budget is available for ${entityName} in ${year}.`)}</span>}
          <div className="muted" style={{ fontSize: 12 }}>{L(`الميزانيات المحمّلة للعام المالي ${APPROPRIATION_YEAR} فقط.`, `Budgets are loaded for fiscal year ${APPROPRIATION_YEAR} only.`)}</div>
        </div>
      </div>

      <AsyncBlock state={DATA} onRetry={() => setRetry((n) => n + 1)} height={260}>
        {(ok || noTarget) && !noBudget && (
          <TargetsPanel year={year} entityRows={entityRows} store={tstore} setStore={setTstore} selectedKey={amanah} total={total} canEdit={canEdit} by={by}
            collectedByKey={DATA.data?.byAmanah || {}} collectedTotal={DATA.data?.total || 0} unassignedCollected={DATA.data?.byAmanah?.[UNASSIGNED] || 0}
            L={L} ar={ar} short={short} nameOf={nameOf} dateText={dateText} />
        )}
        {noBudget && (
          <div className="rv-callout rv-callout--warn" role="status">
            <b>{L(`لا ميزانية مبلغة محمّلة للعام ${year}.`, `No communicated budget is loaded for ${year}.`)}</b>
            <div style={{ fontSize: 13, marginTop: 4 }}>{L(`المستهدفات تعتمد على الميزانية، فلا مستهدفات ولا خريطة لهذا العام. يُعرض المحصّل الفعلي فقط؛ اختر ${APPROPRIATION_YEAR} للتخطيط.`, `Targets depend on the budget, so there are no targets or map for this year. Only the actual collection is shown; choose ${APPROPRIATION_YEAR} to plan.`)}</div>
          </div>
        )}
        {noTarget && !noBudget && (
          <>
            {basis}
            <div className="rv-callout rv-callout--warn" role="status">
              <b>{L('لم يتم تحديد مستهدف تحصيل صالح.', 'No valid collection target has been set.')}</b>
              <div style={{ fontSize: 13, marginTop: 4 }}>{L(`لا يوجد مستهدف إيراد صالح (${entityName}) في ${year}: حدّد مستهدف نسبة التغطية في جدول المستهدفات أعلاه. ولا يُعدّ التحصيل الصفري أو غير المقابل بمستهدف نجاحًا.`, `There is no valid revenue target (${entityName}) in ${year}: set a coverage target in the targets table above. Zero collection, or collection with no target, is not a success.`)}</div>
            </div>
          </>
        )}
        {noTarget && (
          <div className="rv-tiles cg-tiles">
            <MetricTile label={L(`المحصّل حتى ${dateText(g.reportingDate)}`, `Collected to ${dateText(g.reportingDate)}`)} value={short(g.collected)} sub={L('منذ بداية السنة — بتاريخ الدفع', 'year to date — by payment date')} />
            {!noBudget && <MetricTile label={L('المستهدف السنوي للإيراد', 'Annual revenue target')} value={L('غير محدد', 'Not set')} sub={L('لا مستهدف تغطية صالح', 'no valid coverage target')} />}
          </div>
        )}
        {ok && (
          <>
            {basis}
            <div className="rv-tiles cg-tiles">
              <MetricTile label={L('الميزانية المبلغة للأبواب الثلاثة الأولى', 'Communicated budget, chapters 1–3')} value={short(budget)} sub={L('ثابتة للعام — تبلّغها وزارة المالية', 'fixed for the year — from the Ministry of Finance')} />
              <MetricTile label={L(`المحصّل حتى ${dateText(g.reportingDate)}`, `Collected to ${dateText(g.reportingDate)}`)} value={short(g.collected)} sub={L('منذ بداية السنة — بتاريخ الدفع', 'year to date — by payment date')} />
              <MetricTile label={L('نسبة التغطية', 'Coverage ratio')} value={<PctBadge kind="coverage" v={selected.coverage > 0 && coverage != null ? coverage / selected.coverage : null} text={pct(coverage)} />} sub={L(`المحصّل ÷ الميزانية المبلغة — المستهدف ${pct(selected.coverage)} (اللون = نسبة تحقق مستهدف التغطية)`, `Collected ÷ communicated budget — target ${pct(selected.coverage)} (colour = share of the coverage target reached)`)} />
              <MetricTile label={L('المستهدف السنوي للإيراد', 'Annual revenue target')} value={short(g.target)} sub={L(`= مستهدف التغطية ${pct(selected.coverage)} × الميزانية`, `= coverage target ${pct(selected.coverage)} × budget`)} />
              <MetricTile label={L('المتبقي للوصول إلى المستهدف', 'Remaining to the target')} value={short(g.remaining)} tone={g.achieved ? 'good' : 'warn'} sub={g.achieved ? L('تم تحقيق المستهدف', 'Target reached') : L('المستهدف − المحصّل', 'Target − collected')} />
            </div>
          </>
        )}

        {ok && DATA.data && (
          <PlanForecast year={year} g={g} selected={selected} monthlyCollected={DATA.data.monthly} billedMonthly={DATA.data.billedMonthly} standingUncollected={DATA.data.standing} cells={DATA.data.cells}
            targetRate={selected.collectionRate ?? targetRate} L={L} ar={ar} lang={lang} short={short} sourceName={(k) => (ar ? sourceAr(k) : sourceEn(k))} nameOf={nameOf} />
        )}

        {(ok || noTarget) && !noBudget && rows.length > 0 && (
          <EntityMap rows={rows.filter((r) => r.key !== HQ_KEY)} hqRow={rows.find((r) => r.key === HQ_KEY)} totals={{ target: total.revenueTarget, collected: DATA.data?.total || 0 }} L={L} ar={ar} short={short} nameOf={nameOf} selected={amanah} onSelect={setAmanah} />
        )}
      </AsyncBlock>
    </div>
  );
}
