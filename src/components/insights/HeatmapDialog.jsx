// The OPTIONAL advanced comparison (opened from the regional component's «⋯» menu, never in the default flow): Amanahs × revenue sources as a heat matrix, from the SAME page dataset
// (page scope, authorised entities). Colour is never the only cue: every cell prints its value. A cell opens the details panel of its Amanah.
import React, { useMemo, useState } from 'react';
import Overlay from './Overlay';
import { useAr } from '../../utils/useAr';
import { heatmapModel, HEAT_MEASURES, inkOn, legendItems } from './insightsUi';
import { REASONS } from '../../data/regional/regionalLegend';

const pick = (o, lang) => (o == null ? '' : typeof o === 'string' ? o : (lang === 'ar' ? o.ar : o.en) || o.en || '');

export default function HeatmapDialog({ dataset, open, onClose, onSelectEntity }) {
  const { L, lang } = useAr(); const [measure, setMeasure] = useState('rate');
  const m = useMemo(() => (open ? heatmapModel(dataset, measure, lang) : null), [open, dataset, measure, lang]);
  if (!open || !m) return null;
  const names = { rate: L('نسبة التحصيل', 'Collection rate'), change: L('التغير في المحصّل (%)', 'Change in collected (%)'), share: L('مساهمة المصدر في الأمانة', 'Source share of the Amanah') };
  const legend = m.legend ? legendItems({ legend: m.legend, metric: { id: m.metricId } }) : null;
  return (
    <Overlay open onClose={onClose} title={L('مقارنة متقدمة: الأمانات × مصادر الإيراد', 'Advanced comparison: Amanahs × revenue sources')} closeLabel={L('إغلاق', 'Close')} id="ins-heat" className="ins-ov__box--wide">
      <div className="ins-heat">
        <div className="ins-seg" role="group" aria-label={L('مقياس المصفوفة', 'Matrix measure')}>
          {HEAT_MEASURES.map((k) => <button key={k} type="button" className={`ins-seg__b${measure === k ? ' is-on' : ''}`} aria-pressed={measure === k} onClick={() => setMeasure(k)}>{names[k]}</button>)}
        </div>
        <small className="muted">{L('من بيانات الصفحة نفسها (المرشحات والجهات المصرّح بها). الرمادي المتدرج للمساهمة وليس تقييماً.', 'From the same page data (filters and authorised entities). Graded grey is a share, not a rating.')}</small>
        {m.rows.length === 0 ? <div className="rv-empty" role="status">{L('لا بيانات.', 'No data.')}</div> : (
          <div className="rv-table-wrap" tabIndex={0}>
            <table className="rv-table ins-heat__t" aria-label={names[measure]}>
              <thead><tr><th scope="col">{L('الأمانة', 'Amanah')}</th>{m.cols.map((c) => <th key={c.key} scope="col" className="num">{pick(c.label, lang)}</th>)}</tr></thead>
              <tbody>{m.rows.map((r) => (
                <tr key={r.key}><th scope="row"><button type="button" className="ins-rowbtn" onClick={() => onSelectEntity(r.key)}>{pick(r.label, lang)}</button></th>
                  {m.cols.map((c) => { const x = r.cells[c.key]; return x.available
                    ? <td key={c.key} className="num ins-heat__c" style={{ background: x.fill, color: inkOn(x.fill.startsWith('#') ? x.fill : '#E5E7EB') }}><bdi dir="ltr">{x.glyph ? <span aria-hidden="true">{x.glyph} </span> : null}{x.text.sign}{x.text.number}{x.text.unit === '%' ? '%' : ''}</bdi></td>
                    : <td key={c.key} className="num ins-heat__c ins-heat__c--na" title={pick(REASONS[x.reason]?.short, lang)}><span className="ins-na">{x.reason === 'new' ? L('جديد', 'new') : '—'}</span></td>; })}
                </tr>))}</tbody>
            </table>
          </div>
        )}
        {legend ? <ul className="ins-legend__list">{legend.map((it) => <li key={it.index}><i className="ins-sw" style={{ background: it.color, color: inkOn(it.color) }} aria-hidden="true">{it.glyph}</i><span><b>{pick(it.name, lang)}</b> <small className="muted"><bdi>{pick(it.label, lang)}</bdi></small></span></li>)}<li><i className="ins-sw ins-sw--na" aria-hidden="true" /><span>{L('غير متاح (ليس صفراً)', 'Not available (not zero)')}</span></li></ul> : null}
      </div>
    </Overlay>
  );
}
