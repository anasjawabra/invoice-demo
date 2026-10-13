// Geographic reading of the Strategic Dashboard: one map of the Kingdom's regions coloured by a chosen measure, a region selector and the figures of the selection.
// Every region is the sum of its Amanahs (src/data/ksaProvinces.js); the Ministry headquarters, the housing sector and the payments of «غير محدد الأمانة» have no region and are listed beside the map.
// Pure presentation: the rows come from the dashboard so the map, the tiles and the chart carry the same figures.
import React, { useMemo, useState } from 'react';
import ProvinceMap from '../revenue/ProvinceMap';
import { KSA_PROVINCES, KSA_PROVINCES_VIEWBOX } from '../../data/ksaProvinces';

const pct = (v) => (Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : '—');
// percentages use the traffic-light colours: red (far below) · orange · yellow · green · blue (target reached / best band); amounts use one blue scale
export const PCT_COLORS = ['#e53935', '#f4903b', '#fde85c', '#4caf2f', '#4a9be8'];
export const PCT_CUTS = { share: [0.5, 0.65, 0.8, 1], coverage: [0.25, 0.3, 0.35, 0.4] };
export const pctColor = (kind, v) => (Number.isFinite(v) ? PCT_COLORS[PCT_CUTS[kind].filter((c) => v >= c).length] : null);
// a percentage with its colour chip
export const PctBadge = ({ kind, v, text }) => { const c = pctColor(kind, v); return <span dir="ltr" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{c && <i aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 3, background: c, display: 'inline-block', border: '1px solid rgba(0,0,0,.15)' }} />}{text}</span>; };
const BLUES = ['#dbeafe', '#93c5fd', '#3b82f6', '#1d4ed8', '#1e3a8a'];
const NONE = 'var(--surface-2, #e5e7eb)';

// the measures: value of one entity group, how it is written, and the tier limits (fractions for ratios, shares of the largest region for amounts)
const sumOf = (rs, f) => rs.reduce((t, r) => t + f(r), 0);
const MEASURES = [
  { id: 'share', ratio: true, cuts: PCT_CUTS.share, value: (rs) => { const rv = sumOf(rs, (r) => r.a?.revAdjusted || 0); return rv > 0 ? sumOf(rs, (r) => r.collected) / rv : null; } },
  { id: 'collected', ratio: false, value: (rs) => { const x = sumOf(rs, (r) => r.collected); return x > 0 ? x : null; } },
  { id: 'spent', ratio: false, value: (rs) => { const x = sumOf(rs, (r) => r.a?.expSpent || 0); return x > 0 ? x : null; } },
  { id: 'coverage', ratio: true, cuts: PCT_CUTS.coverage, value: (rs) => { const sp = sumOf(rs, (r) => r.a?.expSpent || 0); return sp > 0 ? sumOf(rs, (r) => r.cut) / sp : null; } }
];

export default function EntityMap({ rows, hqRow, L, ar, short, nameOf, selected, onSelect, asOfText, cutDateText }) {
  const [measureId, setMeasureId] = useState('share');
  const measure = MEASURES.find((m) => m.id === measureId);
  const byKey = useMemo(() => new Map(rows.map((r) => [r.key, r])), [rows]);
  const regions = useMemo(() => KSA_PROVINCES.map((p) => ({ ...p, rows: p.amanahKeys.map((k) => byKey.get(k)).filter(Boolean) })), [byKey]);
  const shown = regions.filter((p) => p.rows.length);
  const [iso, setIso] = useState(null);
  const region = shown.find((p) => p.iso === iso) || null;
  const regionName = (p) => (ar ? p.nameAr : p.nameEn);

  const values = shown.map((p) => measure.value(p.rows));
  const max = Math.max(...values.filter((v) => v != null), 0);
  const cuts = measure.ratio ? measure.cuts : [0.2, 0.4, 0.6, 0.8].map((f) => f * max);
  const colorOf = (v) => (v == null ? NONE : (measure.ratio ? PCT_COLORS : BLUES)[cuts.filter((c) => v >= c).length]);
  const fmt = (v) => (v == null ? '—' : measure.ratio ? pct(v) : short(v));
  const legend = [...(measure.ratio ? PCT_COLORS : BLUES).map((c, i) => ({ c, text: i === 0 ? `< ${fmt(cuts[0])}` : i === 4 ? `≥ ${fmt(cuts[3])}` : `${fmt(cuts[i - 1])} – ${fmt(cuts[i])}` })), { c: NONE, text: L('غير متاح', 'n/a') }];

  const labels = { share: L('نسبة المحصّل من الاعتماد', 'Share of the appropriation collected'), collected: L('المحصّل', 'Collected'), spent: L('المنصرف التراكمي', 'Cumulative spending'), coverage: L('تغطية المنصرف بالتحصيل', 'Spending covered by collection') };
  // the figures of the selection: one region, or all regions together (never the headquarters, which has no region)
  const sel = region ? region.rows : shown.flatMap((p) => p.rows);
  const rv = sumOf(sel, (r) => r.a?.revAdjusted || 0); const col = sumOf(sel, (r) => r.collected); const sp = sumOf(sel, (r) => r.a?.expSpent || 0); const cut = sumOf(sel, (r) => r.cut);
  const detail = [
    [L('الاعتماد مقابل الإيراد (بعد التعديل)', 'Revenue appropriation (adjusted)'), rv > 0 ? short(rv) : '—'],
    [L('المحصّل', 'Collected'), short(col)],
    [L('نسبة المحصّل من الاعتماد', 'Share collected'), rv > 0 ? <PctBadge kind="share" v={col / rv} text={pct(col / rv)} /> : '—'],
    [L('المتبقي للتحصيل', 'Remaining to collect'), rv > 0 ? short(Math.max(rv - col, 0)) : '—'],
    [L('المنصرف التراكمي (الأبواب 1–3)', 'Cumulative spending (chapters 1–3)'), sp > 0 ? short(sp) : '—'],
    [L('تغطية المنصرف بالتحصيل', 'Spending covered by collection'), sp > 0 ? <PctBadge kind="coverage" v={cut / sp} text={pct(cut / sp)} /> : '—']
  ];
  const side = [hqRow, byKey.get('Housing Sector'), byKey.get('Unassigned')].filter(Boolean);

  return (
    <div className="card st-card cg-geo">
      <div className="cg-geo__head">
        <div>
          <b>{L('قراءة جغرافية: أين التحصيل وأين المنصرف؟', 'Geographic reading: where is collection and where is spending?')}</b>
          <div className="muted" style={{ fontSize: 12 }}>{L('اختر مقياساً ثم منطقة على الخريطة لقراءة تفاصيلها. المنطقة = مجموع أماناتها.', 'Choose a measure, then a region on the map. A region is the sum of its Amanahs.')}</div>
        </div>
        <div className="cg-geo__tabs" role="group" aria-label={L('المقياس', 'Measure')}>
          {MEASURES.map((m) => <button key={m.id} type="button" className={`btn btn-sm ${m.id === measureId ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={m.id === measureId} onClick={() => setMeasureId(m.id)}>{labels[m.id]}</button>)}
        </div>
      </div>
      <div className="cg-geo__body">
        <div className="cg-geo__side">
          <label className="cg-field" htmlFor="cg-region">{L('اختيار المنطقة', 'Region')}
            <select id="cg-region" className="input" value={iso || ''} onChange={(e) => setIso(e.target.value || null)}>
              <option value="">{L('كل المناطق', 'All regions')}</option>
              {shown.map((p) => <option key={p.iso} value={p.iso}>{regionName(p)}</option>)}
            </select>
          </label>
          <div className="cg-geo__card" role="status">
            <div className="muted" style={{ fontSize: 12 }}>{region ? L('منطقة', 'Region') : L('مرجع المقارنة · دون الديوان', 'Reference · without headquarters')}</div>
            <b style={{ fontSize: 18 }}>{region ? regionName(region) : L('إجمالي المناطق', 'All regions')}</b>
            <dl className="cg-geo__dl">{detail.map(([k, v]) => <React.Fragment key={k}><dt>{k}</dt><dd dir="ltr">{v}</dd></React.Fragment>)}</dl>
            {region && region.rows.length > 1 && (
              <div className="cg-geo__amanahs">{region.rows.map((r) => <button key={r.key} type="button" className={`rv-link${r.key === selected ? ' is-on' : ''}`} onClick={() => onSelect?.(r.key)}>{nameOf(r.key)}: {fmt(measure.value([r]))}</button>)}</div>
            )}
            <div className="muted" style={{ fontSize: 12 }}>{L(`التغطية محسوبة حتى ${cutDateText}؛ المنصرف حتى ${asOfText}.`, `Coverage is calculated to ${cutDateText}; spending is to ${asOfText}.`)}</div>
          </div>
          {side.map((r) => (
            <div key={r.key} className="cg-geo__card cg-geo__card--plain">
              <b>{r.key === 'Unassigned' ? L('غير محدد الأمانة', 'Unassigned') : nameOf(r.key)}</b>
              <div className="muted" style={{ fontSize: 12 }}>{L('نطاق مستقل عن المناطق', 'Not part of any region')}</div>
              <dl className="cg-geo__dl">
                {r.a?.revAdjusted > 0 && <><dt>{L('الاعتماد مقابل الإيراد', 'Revenue appropriation')}</dt><dd dir="ltr">{short(r.a.revAdjusted)}</dd></>}
                {(r.collected > 0 || r.a?.revAdjusted > 0) && <><dt>{L('المحصّل', 'Collected')}</dt><dd dir="ltr">{short(r.collected)}</dd></>}
                {r.a && <><dt>{L('المنصرف التراكمي', 'Cumulative spending')}</dt><dd dir="ltr">{short(r.a.expSpent)}</dd></>}
                {r.a?.revAdjusted > 0 && r.a.expSpent > 0 && <><dt>{L('تغطية المنصرف بالتحصيل', 'Spending covered')}</dt><dd dir="ltr"><PctBadge kind="coverage" v={r.cut / r.a.expSpent} text={pct(r.cut / r.a.expSpent)} /></dd></>}
              </dl>
            </div>
          ))}
        </div>
        <div className="cg-geo__map">
          <b>{labels[measureId]}</b>
          <ProvinceMap provinces={shown} viewBox={KSA_PROVINCES_VIEWBOX} selectedIso={iso}
            fillFor={(p) => colorOf(measure.value(p.rows))} onSelect={setIso}
            titleFor={(p) => `${regionName(p)} — ${labels[measureId]}: ${fmt(measure.value(p.rows))}`} />
          <div className="cg-geo__legend" aria-label={L('مفتاح الألوان', 'Colour key')}>{legend.map((x) => <span key={x.text}><i style={{ background: x.c }} /><bdi dir="ltr">{x.text}</bdi></span>)}</div>
          <table className="sr-only"><caption>{labels[measureId]}</caption><thead><tr><th>{L('المنطقة', 'Region')}</th><th>{labels[measureId]}</th></tr></thead>
            <tbody>{shown.map((p) => <tr key={p.iso}><td>{regionName(p)}</td><td>{fmt(measure.value(p.rows))}</td></tr>)}</tbody></table>
        </div>
      </div>
    </div>
  );
}
