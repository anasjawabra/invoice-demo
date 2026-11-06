// «الأداء حسب المنطقة» — the ONE regional component of /insights: a compact «خريطة / جدول» toggle (ONLY the selected view is mounted), a compact metric selector, ONE legend, the «بدون إسناد جغرافي» card.
// Both views read the SAME `regionalMetric` result (value · colour class · legend · card · table column), so switching the view or the metric can never make them disagree; the view and the metric survive each other.
// A region (map) or a row (table) opens the page's ONE details panel through `onSelect`; the optional heatmap and the full comparison are opened from the «⋯» menu.
import React, { useMemo, useReducer, useRef, useState } from 'react';
import { useAr } from '../../utils/useAr';
import InfoTip from '../invoices/InfoTip';
import { useMediaQuery, useDismiss } from '../filters/overlay';
import { regionalMetric, LEVEL_LABELS } from '../../data/regional/regionalPerformance';
import { REGIONAL_METRICS, REASONS, metricOptionText } from '../../data/regional/regionalLegend';
import { regionalReducer, initialRegionalState } from './insightsUi';
import { RegionalLegend, RegionCard, RegionalMap, RegionalTable, UnattributedCard, ThresholdList } from './RegionalParts';

const pick = (o, lang) => (o == null ? '' : typeof o === 'string' ? o : (lang === 'ar' ? o.ar : o.en) || o.en || '');
export { metricOptionText };

export default function RegionalPerformance({ dataset, initialView = 'map', initialMetric = 'collected', selected = null, onSelect, onOpenHeatmap, onOpenFull, loading = false }) {
  const { L, ar, lang } = useAr();
  const [st, dispatch] = useReducer(regionalReducer, { view: initialView, metric: initialMetric }, initialRegionalState);
  const [sort, setSort] = useState(null);
  const [menu, setMenu] = useState(false); const wrap = useRef(null); const trig = useRef(null);
  useDismiss(menu, wrap, () => setMenu(false), trig);
  const coarse = useMediaQuery('(pointer: coarse)');
  const res = useMemo(() => regionalMetric(dataset, st.metric, { lang, level: 'region' }), [dataset, st.metric, lang]); // the ONE result both views read
  const rowByIso = useMemo(() => new Map(res.rows.filter((r) => r.iso).map((r) => [r.iso, r])), [res]);
  const nameOf = (k) => { const e = dataset.entities.find((x) => x.key === k); return e ? pick(e.label, lang) : ''; };
  const unEntities = dataset.unattributed ? dataset.unattributed.entityKeys.map(nameOf).filter(Boolean) : [];
  const selRegion = selected ? (selected.level === 'region' ? selected.key : selected.level === 'entity' ? dataset.entities.find((e) => e.key === selected.key)?.regionIso : null) : null;
  const selKey = selected ? (selected.level === 'region' ? selected.key : selected.level === 'unattributed' ? 'unattributed' : selRegion) : null;
  const hoverRow = st.hover ? rowByIso.get(st.hover) : null;
  const cardRow = hoverRow || (selRegion ? rowByIso.get(selRegion) : null) || (selected?.level === 'unattributed' ? res.unattributed : null);
  const open = (r) => { if (r) onSelect({ level: r.level === 'unattributed' ? 'unattributed' : 'region', key: r.key }); };
  // the VALUE can be shown while the COLOUR is unavailable (e.g. «المحصّل» when no region has a valid net invoiced): then every region is hatched «غير متاح» with the reason — never red
  const allNa = res.rows.length > 0 && res.rows.every((r) => !r.available);
  const allStNa = !allNa && res.rows.length > 0 && res.rows.every((r) => !r.status.available);
  const naSrc = allNa ? res.rows[0] : allStNa ? res.rows[0].status : null;
  const naReason = naSrc ? (naSrc.message || pick(REASONS[naSrc.reason]?.message, lang)) : null;
  const naText = naSrc ? (typeof naReason === 'string' ? naReason : pick(naReason, lang)) : '';
  const naHead = allStNa ? pick(res.rows[0].status.label, lang) : L('غير متاح', 'Not available');
  const empty = res.rows.length === 0 && !res.unattributed;
  const headId = 'ins-reg-h';

  return (
    <section className="card st-card ins-regional" aria-labelledby={headId} aria-busy={loading ? 'true' : undefined}>
      <div className="ins-reg__head">
        <div>
          <h2 className="ins-h" id={headId} style={{ margin: 0 }}>{L('الأداء حسب المنطقة', 'Regional performance')}</h2>
          <small className="muted ins-level">{L(`المستوى: ${pick(LEVEL_LABELS.region, 'ar')} — تجمع الأمانات المصرّح لك بها`, `Level: ${pick(LEVEL_LABELS.region, 'en')} — aggregates the Amanahs you are authorised for`)}</small>
        </div>
        <div className="ins-reg__tools">
          <div className="ins-seg" role="group" aria-label={L('طريقة العرض', 'View')}>
            {[['map', L('خريطة', 'Map')], ['table', L('جدول', 'Table')]].map(([k, label]) => <button key={k} type="button" className={`ins-seg__b${st.view === k ? ' is-on' : ''}`} aria-pressed={st.view === k} onClick={() => dispatch({ type: 'view', view: k })}>{label}</button>)}
          </div>
          <label className="ins-metric"><span>{L('المقياس', 'Metric')}</span>
            <select className="input" value={st.metric} onChange={(e) => dispatch({ type: 'metric', metric: e.target.value })} aria-label={L('المقياس المعروض', 'Metric shown')}>
              {REGIONAL_METRICS.map((id) => <option key={id} value={id}>{metricOptionText(id, lang)}</option>)}
            </select>
          </label>
          <InfoTip label={L('شرح المقياس', 'About this metric')}><b>{pick(res.metric.label, lang)}</b><br />{pick(res.legend.caption, lang)}<br />{pick(res.metric.basis, lang)}<br /><b>{L('نطاقات أداء التحصيل (ثابتة، وليست ترتيبًا بين المناطق)', 'Collection-performance bands (fixed, not a ranking of the regions)')}</b><ThresholdList rule={res.metric.rule} lang={lang} /></InfoTip>
          <span className="ins-menu" ref={wrap}>
            <button type="button" ref={trig} className="btn btn-sm btn-ghost ins-menu__b" aria-haspopup="menu" aria-expanded={menu} aria-label={L('المزيد من الخيارات', 'More options')} onClick={() => setMenu((v) => !v)}>⋯</button>
            {menu ? (
              <div className="ins-menu__list" role="menu">
                <button type="button" role="menuitem" className="ins-menu__i" onClick={() => { setMenu(false); onOpenHeatmap(); }}>{L('مقارنة متقدمة: خريطة حرارية', 'Advanced comparison: heatmap')}</button>
                <button type="button" role="menuitem" className="ins-menu__i" onClick={() => { setMenu(false); onOpenFull(); }}>{L('عرض المقارنة الكاملة', 'Open the full comparison')}</button>
              </div>
            ) : null}
          </span>
        </div>
      </div>
      {empty ? <div className="rv-empty" role="status">{L('لا بيانات لمناطق في هذا النطاق.', 'No regional data in this scope.')}</div> : (
        <>
          {naSrc ? <div className="rv-callout rv-callout--warn ins-na-note" role="status"><b>{naHead}</b> — {naText}</div> : null}
          {st.view === 'map' ? (
            <div className="ins-map">
              <div className="ins-map__fig">
                <RegionalMap res={res} lang={lang} selectedIso={selRegion} hoverKey={st.hover}
                  onHover={(iso) => dispatch({ type: 'hover', key: iso })}
                  onSelect={(r) => { if (!r) return; if (coarse) dispatch({ type: 'hover', key: r.iso }); else open(r); }} />
                <RegionalLegend res={res} lang={lang} />
              </div>
              <div className="ins-map__side">
                <RegionCard res={res} row={cardRow} lang={lang} hovering={!!hoverRow} onDetails={cardRow ? () => open(cardRow) : null} />
                <UnattributedCard res={res} lang={lang} entityNames={unEntities} selected={selected?.level === 'unattributed'} onOpen={() => open(res.unattributed)} />
              </div>
            </div>
          ) : (
            <>
              <RegionalTable res={res} lang={lang} selectedKey={selKey} sort={sort} onSort={setSort} onSelect={open} entityNames={{ unattributed: unEntities.join(ar ? '، ' : ', ') }} />
              <RegionalLegend res={res} lang={lang} />
            </>
          )}
        </>
      )}
    </section>
  );
}
