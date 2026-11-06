// The dashboard's ONE details panel («التفاصيل عند الطلب»): opened by a region (map or table row), an entity row, a summary finding or «عرض المقارنة الكاملة».
// A side sheet (a full-screen sheet on phones, Overlay.jsx) over `regionDetail(dataset, …)`: the level label, the selection chips with «إزالة التحديد» (narrows ONLY the panel — the page filters are never touched),
// the authorised entities of the region → their revenue sources (+ municipalities), the full increases / decreases, the monthly trend and the invoices link.
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Overlay from './Overlay';
import { Val, StatusChip } from './RegionalParts';
import UnitLines from '../strategic/UnitLines';
import { useAr } from '../../utils/useAr';
import { unitOfValues, unitLabel } from '../../utils/money';
import { fmtMonthText } from '../../data/clock';
import { regionDetail, factsOf, LEVEL_LABELS } from '../../data/regional/regionalPerformance';
import { formatValue, comparisonBasisText } from '../../data/regional/regionalLegend';
import { invoicesLinkFor } from './insightsUi';

const pick = (o, lang) => (o == null ? '' : typeof o === 'string' ? o : (lang === 'ar' ? o.ar : o.en) || o.en || '');
export const TOTAL_SEL = Object.freeze({ level: 'total', key: 'total' });

/** the chips of a panel selection: region › entity (or the unattributed bucket); none = the whole scope */
export function selectionChips(dataset, sel) {
  if (!sel || sel.level === 'total') return [];
  if (sel.level === 'unattributed') return [{ key: 'unattributed', level: 'unattributed', label: LEVEL_LABELS.unattributed, value: null, remove: TOTAL_SEL }];
  if (sel.level === 'region') { const r = dataset.regions.find((x) => x.key === sel.key); return r ? [{ key: 'region', level: 'region', label: LEVEL_LABELS.region, value: r.label, remove: TOTAL_SEL }] : []; }
  const e = dataset.entities.find((x) => x.key === sel.key); if (!e) return [];
  const reg = e.regionIso ? dataset.regions.find((x) => x.key === e.regionIso) : null; const out = [];
  if (reg) out.push({ key: 'region', level: 'region', label: LEVEL_LABELS.region, value: reg.label, remove: TOTAL_SEL });
  else if (dataset.unattributed && dataset.unattributed.entityKeys.includes(e.key)) out.push({ key: 'unattributed', level: 'unattributed', label: LEVEL_LABELS.unattributed, value: null, remove: TOTAL_SEL });
  out.push({ key: 'entity', level: 'entity', label: LEVEL_LABELS.entity, value: e.label, remove: reg ? { level: 'region', key: reg.key } : dataset.unattributed && dataset.unattributed.entityKeys.includes(e.key) ? { level: 'unattributed', key: 'unattributed' } : TOTAL_SEL });
  return out;
}

export default function RegionDetailPanel({ dataset, sel, onSelect, onClose, invoicesAllowed = true }) {
  const { L, ar, lang } = useAr();
  const open = !!sel;
  const eff = useMemo(() => (sel && regionDetail(dataset, sel, { lang }) ? sel : TOTAL_SEL), [dataset, sel, lang]);
  const d = useMemo(() => (open ? regionDetail(dataset, eff, { lang }) : null), [open, dataset, eff, lang]);
  if (!open || !d) return null;
  const chips = selectionChips(dataset, eff); const f = d.row.facts; const comparable = d.comparable; const ST = d.statuses;
  const total = eff.level === 'total';
  const title = total ? L('المقارنة الكاملة', 'Full comparison') : eff.level === 'unattributed' ? pick(LEVEL_LABELS.unattributed, lang) : pick(d.label, lang);
  const levelLabel = total ? L('النطاق كله', 'The whole scope') : pick(d.levelLabel, lang);
  const money = [f.collected, f.net, f.uncollected, ...d.sources.map((s) => s.cur.collected), ...d.increases.map((c) => Math.abs(c.change)), ...d.decreases.map((c) => Math.abs(c.change))].filter(Number.isFinite);
  const scale = unitOfValues(money); const unitText = unitLabel(scale, lang);
  const M = (v) => formatValue('collected', v, { lang, scale }); const S = (v) => formatValue('collected', v, { lang, scale, signed: true });
  const P = (v) => formatValue('collectionRate', v, { lang }); const C = (v) => formatValue('changeCollected', v, { lang }); const PP = (v) => formatValue('changeRate', v, { lang });
  const link = invoicesAllowed ? invoicesLinkFor({ level: eff.level, key: eff.key, row: d.row }) : null;
  const entityRows = d.entities.filter((e) => e.cur.count > 0 || (e.prev && e.prev.count > 0));
  const cmpB = comparisonBasisText(dataset.comparison); const compareLbl = pick(cmpB.label, lang);
  const trendSeries = d.trend.length ? [{ label: L('المحصّل', 'Collected'), values: d.trend.map((t) => t.collected) }, ...(comparable ? [{ label: L('المحصّل في الفترة المماثلة', 'Collected, comparison period'), values: d.trend.map((t) => t.prevCollected) }] : [])] : null;
  const Fig = ({ label, children }) => (<div className="ins-fig"><span>{label}</span><b>{children}</b></div>);
  const changeRow = (c) => (
    <li key={`${c.kind}-${c.key}`}><span className="ins-chg__n">{pick(c.label, lang)} <small className="muted">· {c.kind === 'entity' ? pick(LEVEL_LABELS.entity, lang) : L('مصدر', 'Source')}</small></span><span className="ins-chg__v"><Val text={S(c.change)} lang={lang} /> <small className="muted">{c.isNew ? L('جديد', 'new') : c.changePct == null ? '' : <Val text={C(c.changePct)} lang={lang} />}</small></span></li>
  );

  return (
    <Overlay open side onClose={onClose} title={title} closeLabel={L('إغلاق', 'Close')} id="ins-detail">
      <div className="ins-det">
        <div className="ins-det__lvl"><span className="rv-tag">{L('المستوى', 'Level')}: {levelLabel}</span>{eff.level === 'region' ? <small className="muted"> {L(`تجمع ${d.row.entityCount} ${d.row.entityCount === 1 ? 'أمانة مصرّحاً بها' : 'أمانات مصرّحاً بها'}`, `aggregates ${d.row.entityCount} authorised ${d.row.entityCount === 1 ? 'Amanah' : 'Amanahs'}`)}</small> : null}</div>
        <div className="ins-det__chips" role="group" aria-label={L('التحديد الحالي في اللوحة', 'Current selection in this panel')}>
          {chips.map((c) => (<span key={c.key} className="ins-chipx"><span>{pick(c.label, lang)}{c.value ? `: ${pick(c.value, lang)}` : ''}</span><button type="button" className="ins-chipx__x" aria-label={`${L('إزالة', 'Remove')}: ${pick(c.label, lang)}${c.value ? ` ${pick(c.value, lang)}` : ''}`} onClick={() => onSelect(c.remove)}>×</button></span>))}
          <button type="button" className="btn btn-sm btn-ghost" disabled={total} onClick={() => onSelect(TOTAL_SEL)}>{L('إزالة التحديد', 'Clear selection')}</button>
        </div>
        <small className="muted">{L('يغيّر هذا التحديد اللوحة فقط، ولا يغيّر مرشحات الصفحة.', 'This selection changes the panel only; the page filters are not changed.')}</small>

        <div className="ins-figs">
          <Fig label={L('المحصّل (فواتير الفترة)', 'Collected (period invoices)')}><Val text={M(f.collected)} lang={lang} /></Fig>
          <Fig label={L('صافي المفوتر', 'Net invoiced')}><Val text={M(f.net)} lang={lang} /></Fig>
          <Fig label={L('غير المحصّل', 'Uncollected')}><Val text={M(f.uncollected)} lang={lang} /></Fig>
          <Fig label={L('نسبة التحصيل', 'Collection rate')}>{f.rate == null ? <Val lang={lang} text={null} /> : <Val text={P(f.rate)} lang={lang} />}<StatusChip status={ST.rate} lang={lang} size="sm" /></Fig>
          <Fig label={L(`التغير في المحصّل عن ${compareLbl} (%)`, `Change in collected vs ${compareLbl} (%)`)}>{comparable && f.changePct != null ? <Val text={C(f.changePct)} lang={lang} /> : <Val text={null} lang={lang} reason={comparable ? L('جديد', 'new') : L('لا مقارنة', 'no comparison')} />}<StatusChip status={ST.changeCollected} lang={lang} size="sm" /></Fig>
          <Fig label={L(`التغير في نسبة التحصيل عن ${compareLbl} (نقطة مئوية)`, `Change in collection rate vs ${compareLbl} (pp)`)}>{comparable && f.changePp != null ? <Val text={PP(f.changePp)} lang={lang} /> : <Val text={null} lang={lang} reason={L('لا مقارنة', 'no comparison')} />}<StatusChip status={ST.changeRate} lang={lang} size="sm" /></Fig>
        </div>
        <small className="muted">{L(`الوحدة: ${unitText}`, `Unit: ${unitText}`)}</small>

        {entityRows.length > 0 && eff.level !== 'entity' ? (
          <section className="ins-det__sec" aria-label={L('الأمانات المصرّح بها ومصادر إيراداتها', 'Authorised Amanahs and their revenue sources')}>
            <h3>{L('الأمانات ومصادر إيراداتها', 'Amanahs and their revenue sources')}</h3>
            <ul className="ins-ent">
              {entityRows.map((e) => { const ef = factsOf(e, dataset); return (
                <li key={e.key}>
                  <details>
                    <summary><span className="ins-ent__n">{pick(e.label, lang)}</span><span className="ins-ent__v"><Val text={M(ef.collected)} lang={lang} /> <small className="muted">· <Val text={ef.rate == null ? null : P(ef.rate)} lang={lang} /></small></span></summary>
                    <div className="ins-ent__body">
                      <table className="rv-table ins-mini" aria-label={`${L('مصادر الإيراد', 'Revenue sources')}: ${pick(e.label, lang)}`}>
                        <thead><tr><th scope="col">{L('المصدر', 'Source')}</th><th scope="col" className="num">{L('المحصّل', 'Collected')}</th><th scope="col" className="num">{L('نسبة التحصيل', 'Rate')}</th></tr></thead>
                        <tbody>{e.sources.filter((s) => s.cur.count > 0).map((s) => <tr key={s.key}><th scope="row">{pick(s.label, lang)}</th><td className="num"><Val text={M(s.cur.collected)} lang={lang} /></td><td className="num"><Val text={s.cur.net > 0 ? P(s.cur.rate) : null} lang={lang} /></td></tr>)}</tbody>
                      </table>
                      {e.municipalities.length ? (
                        <table className="rv-table ins-mini" aria-label={`${L('البلديات', 'Municipalities')}: ${pick(e.label, lang)}`}>
                          <thead><tr><th scope="col">{pick(LEVEL_LABELS.municipality, lang)}</th><th scope="col" className="num">{L('المحصّل', 'Collected')}</th><th scope="col" className="num">{L('نسبة التحصيل', 'Rate')}</th></tr></thead>
                          <tbody>{e.municipalities.map((m) => <tr key={m.key}><th scope="row">{pick(m.label, lang)}</th><td className="num"><Val text={M(m.cur.collected)} lang={lang} /></td><td className="num"><Val text={m.cur.net > 0 ? P(m.cur.rate) : null} lang={lang} /></td></tr>)}</tbody>
                        </table>
                      ) : null}
                      <div className="ins-ent__act">
                        <button type="button" className="btn btn-sm" onClick={() => onSelect({ level: 'entity', key: e.key })}>{L('حصر اللوحة في هذه الأمانة', 'Narrow the panel to this Amanah')}</button>
                        {invoicesAllowed ? <Link className="btn btn-sm btn-ghost" to={invoicesLinkFor({ level: 'entity', key: e.key })}>{L('الفواتير', 'Invoices')}</Link> : null}
                      </div>
                    </div>
                  </details>
                </li>); })}
            </ul>
          </section>
        ) : null}

        {d.sources.length > 0 ? (
          <section className="ins-det__sec">
            <h3>{eff.level === 'entity' ? L('مصادر الإيراد', 'Revenue sources') : L('مصادر الإيراد (مجمّعة)', 'Revenue sources (combined)')}</h3>
            <div className="rv-table-wrap" tabIndex={0}>
              <table className="rv-table ins-mini" aria-label={L('مصادر الإيراد', 'Revenue sources')}>
                <thead><tr><th scope="col">{L('المصدر', 'Source')}</th><th scope="col" className="num">{L('المحصّل', 'Collected')}</th><th scope="col" className="num">{L('الحصة', 'Share')}</th><th scope="col" className="num">{L('نسبة التحصيل', 'Rate')}</th><th scope="col" className="num">{L('التغير', 'Change')}</th></tr></thead>
                <tbody>{d.sources.map((s) => (<tr key={s.key}><th scope="row">{pick(s.label, lang)}</th><td className="num"><Val text={M(s.cur.collected)} lang={lang} /></td><td className="num"><Val text={s.share == null ? null : P(s.share)} lang={lang} /></td><td className="num"><Val text={s.cur.net > 0 && s.cur.count > 0 ? P(s.cur.rate) : null} lang={lang} /></td><td className="num">{s.isNew ? <span className="ins-na">{L('جديد', 'new')}</span> : <Val text={s.change == null ? null : S(s.change)} lang={lang} />}</td></tr>))}</tbody>
              </table>
            </div>
          </section>
        ) : null}

        {eff.level === 'entity' && d.municipalities.length > 0 ? (
          <section className="ins-det__sec" aria-label={L('البلديات', 'Municipalities')}>
            <h3>{L('البلديات', 'Municipalities')}</h3>
            <div className="rv-table-wrap" tabIndex={0}>
              <table className="rv-table ins-mini" aria-label={L('البلديات', 'Municipalities')}>
                <thead><tr><th scope="col">{pick(LEVEL_LABELS.municipality, lang)}</th><th scope="col" className="num">{L('المحصّل', 'Collected')}</th><th scope="col" className="num">{L('نسبة التحصيل', 'Rate')}</th></tr></thead>
                <tbody>{d.municipalities.map((m) => <tr key={m.key}><th scope="row">{pick(m.label, lang)}</th><td className="num"><Val text={M(m.cur.collected)} lang={lang} /></td><td className="num"><Val text={m.cur.net > 0 ? P(m.cur.rate) : null} lang={lang} /></td></tr>)}</tbody>
              </table>
            </div>
          </section>
        ) : null}

        <section className="ins-det__sec" aria-label={L('الزيادات والانخفاضات', 'Increases and decreases')}>
          <h3>{L('الزيادات والانخفاضات', 'Increases and decreases')}</h3>
          {!comparable ? <div className="muted" role="note">{L('لا فترة مماثلة سابقة ضمن تغطية البيانات: لا تُحسب التغيرات.', 'No comparable previous period inside the data coverage: changes are not computed.')}</div> : (
            <>
              <small className="muted">{L(`المحصّل مقارنةً مع ${compareLbl}`, `Collected against ${compareLbl}`)}</small>
              <div className="ins-chg">
                <div><h4>{L('الزيادات', 'Increases')} ({d.increases.length})</h4>{d.increases.length ? <ul className="ins-chg__list">{d.increases.map(changeRow)}</ul> : <small className="muted">{L('لا زيادات.', 'No increases.')}</small>}</div>
                <div><h4>{L('الانخفاضات', 'Decreases')} ({d.decreases.length})</h4>{d.decreases.length ? <ul className="ins-chg__list">{d.decreases.map(changeRow)}</ul> : <small className="muted">{L('لا انخفاضات.', 'No decreases.')}</small>}</div>
              </div>
            </>
          )}
        </section>

        <section className="ins-det__sec" aria-label={L('الاتجاه الشهري', 'Monthly trend')}>
          <h3>{L('الاتجاه الشهري', 'Monthly trend')}</h3>
          <small className="muted">{L('المحصّل على فواتير كل شهر إصدار، حتى تاريخ القطع. الوحدة تظهر على المحور.', 'Collected on the invoices of each issue month, up to the cut-off. The unit is on the axis.')}</small>
          {trendSeries ? <UnitLines labels={d.trend.map((t) => fmtMonthText(t.month, lang))} series={trendSeries} height={220} label={L('الاتجاه الشهري للمحصّل', 'Monthly trend of collected')} /> : <div className="muted" role="note">{L('لا بيانات شهرية.', 'No monthly data.')}</div>}
          {d.trend.length ? (
            <details className="ins-trendtable"><summary>{L('عرض الاتجاه كجدول', 'Show the trend as a table')}</summary>
              <table className="rv-table ins-mini" aria-label={L('الاتجاه الشهري', 'Monthly trend')}><thead><tr><th scope="col">{L('الشهر', 'Month')}</th><th scope="col" className="num">{L('المحصّل', 'Collected')}</th>{comparable ? <th scope="col" className="num">{L('الفترة المماثلة', 'Comparison')}</th> : null}</tr></thead>
                <tbody>{d.trend.map((t) => <tr key={t.month}><th scope="row">{fmtMonthText(t.month, lang)}</th><td className="num"><Val text={M(t.collected)} lang={lang} /></td>{comparable ? <td className="num"><Val text={t.prevCollected == null ? null : M(t.prevCollected)} lang={lang} /></td> : null}</tr>)}</tbody></table>
            </details>
          ) : null}
        </section>

        {link ? <div className="ins-det__foot"><Link className="btn btn-sm" to={link}>{L('فتح الفواتير', 'Open the invoices')} {ar ? '←' : '→'}</Link></div> : null}
      </div>
    </Overlay>
  );
}
