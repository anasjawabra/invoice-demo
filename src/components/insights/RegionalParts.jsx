// The parts of «الأداء حسب المنطقة»: the value text, the legend, the tooltip card, the map, the table and the «بدون إسناد جغرافي» card.
// All of them read ONE `regionalMetric` result (src/data/regional/regionalPerformance.js): the SAME row feeds the map fill, the legend class, the card, the table cell and the accessible name.
import React, { useMemo } from 'react';
import ProvinceMap from '../revenue/ProvinceMap';
import { KSA_PROVINCES, KSA_PROVINCES_VIEWBOX } from '../../data/ksaProvinces';
import { REASONS } from '../../data/regional/regionalLegend';
import { LEVEL_LABELS } from '../../data/regional/regionalPerformance';
import { RULE_TABLE, NA_COLORS } from '../../data/regional/collectionBands';
import { fillOf, inkOn, legendItems, directionMark, sortRows, HATCH_ID } from './insightsUi';

const pick = (o, lang) => (o == null ? '' : typeof o === 'string' ? o : (lang === 'ar' ? o.ar : o.en) || o.en || '');
const NA = (lang) => (lang === 'ar' ? 'غير متاح' : 'Not available');

/* ---------------------------------------------------------------- value text */
/** a metric value: ▲/▼ + sign + number in an LTR isolate, then its unit; an unavailable value is «غير متاح» + the short reason — never 0 */
export function Val({ text, lang, reason, strong = false, noMark = false }) {
  if (!text || text.number === '—') return <span className="ins-na">{NA(lang)}{reason ? <small> — {pick(reason, lang)}</small> : null}</span>;
  const mark = noMark ? '' : directionMark(text.direction); const glue = text.unit === '%';
  return (
    <span className={`ins-val${strong ? ' ins-val--strong' : ''}${text.direction ? ` ins-val--${text.direction}` : ''}`}>
      <bdi dir="ltr">{mark ? <span className="ins-val__mark" aria-hidden="true">{mark} </span> : null}{text.sign}{text.number}{glue ? '%' : ''}</bdi>{text.unit && !glue ? <span className="ins-val__unit"> {text.unit}</span> : null}
    </span>
  );
}
/** the band status as a chip: the class colour + the glyph (▼▼ ▼ ◐ ✓ ○ ▲) + the text label — colour is never the only cue. An unavailable figure is hatched/gray with its own label. */
export function StatusChip({ status, lang, size = 'md' }) {
  if (!status) return null;
  const label = pick(status.label, lang); const fill = status.available ? status.color : null;
  return (
    <span className={`ins-st ins-st--${status.cls}${size === 'sm' ? ' ins-st--sm' : ''}`} data-cls={status.cls} style={fill ? { background: fill, color: inkOn(fill) } : undefined}>
      <i className="ins-st__g" aria-hidden="true">{status.glyph}</i><span className="ins-st__t">{label}</span>
    </span>
  );
}
/** a table / card cell: a status cell is the chip, every other cell is a value */
export function CellVal({ col, cell, lang, strong, noMark = false }) {
  if (col.kind === 'status') return <StatusChip status={cell.status} lang={lang} />;
  return <Val text={cell.text} lang={lang} reason={cell.text.label} strong={strong} noMark={noMark} />;
}
/** the colour square beside a value (the table / card chip): the band colour (with its glyph), or the hatch when unavailable */
export function Swatch({ fill, glyph = null }) { return <i className={`ins-sw${fill ? '' : ' ins-sw--na'}`} aria-hidden="true" style={fill ? { background: fill, color: inkOn(fill) } : undefined}>{glyph}</i>; }

/** the accessible sentence of a region: name — metric: value — status (or why there is none) */
export function rowTitle(res, row, lang) {
  const ml = pick(res.metric.label, lang);
  const st = row.status; const stText = st ? `${st.glyph} ${pick(st.label, lang)}${st.available ? '' : (st.message ? ` (${pick(st.message, lang)})` : '')}` : '';
  return `${pick(row.label, lang)} — ${ml}: ${row.available ? row.text.text : `${NA(lang)}${row.reasonLabel ? ` (${pick(row.reasonLabel, lang)})` : ''}`} — ${stText}`;
}

/** the band table of a rule, printed (the info control): glyph · class name · range, then the source */
export function ThresholdList({ rule, lang }) {
  const T = RULE_TABLE[rule]; if (!T) return null;
  return (
    <span className="ins-thr">
      <span className="ins-thr__t">{pick(T.measure, lang)}</span>
      <ul className="ins-thr__l">
        {T.classes.map((c) => <li key={c.cls}><i className="ins-sw" style={{ background: c.color, color: inkOn(c.color) }} aria-hidden="true">{c.glyph}</i> <b>{pick(c.name, lang)}</b> — {pick(c.label, lang)}</li>)}
        <li><i className="ins-sw ins-sw--na" aria-hidden="true">{T.na.glyph}</i> <b>{pick(T.na.name, lang)}</b> — {pick(T.na.label, lang)}</li>
      </ul>
      <small className="muted">{pick(T.source, lang)}</small>
    </span>
  );
}

/* ---------------------------------------------------------------- legend */
export function RegionalLegend({ res, lang }) {
  const items = useMemo(() => legendItems(res), [res]);
  const L = res.legend; const ar = lang === 'ar';
  const unitText = pick(L.unit.label, lang);
  return (
    <div className="ins-legend" role="group" aria-label={ar ? 'مفتاح الألوان' : 'Colour key'} data-metric={res.metric.id}>
      <div className="ins-legend__title"><b>{pick(L.bandsTitle, lang)}</b> <span className="muted">— {pick(res.metric.label, lang)} ({unitText})</span></div>
      <div className="ins-legend__cap">{pick(L.caption, lang)}</div>
      <ul className="ins-legend__list">
        {items.map((it) => (
          <li key={it.index} data-cls={it.cls}><i className="ins-sw" style={{ background: it.color, color: inkOn(it.color) }} aria-hidden="true">{it.glyph}</i><span><b>{pick(it.name, lang)}</b> <small className="muted"><bdi>{pick(it.label, lang)}</bdi></small></span></li>
        ))}
        <li data-cls="na"><i className="ins-sw ins-sw--na" aria-hidden="true">{L.na.glyph}</i><span>{pick(L.notAvailable, lang)}</span></li>
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------- the card (hover / keyboard focus / selection) */
export function RegionCard({ res, row, lang, hovering = false, onDetails }) {
  const ar = lang === 'ar';
  if (!row) return <div className="ins-card ins-card--empty" role="status" aria-live="polite"><small className="muted">{ar ? 'مرّر على منطقة أو اضغط عليها لعرض قيمتها وحالتها.' : 'Hover or press a region to see its value and status.'}</small></div>;
  const fill = fillOf(res.metric.id, row.color); const st = row.status;
  const supporting = res.columns.filter((c) => !c.primary && c.kind !== 'status' && row.cells[c.id]);
  const lvl = row.level === 'region' ? LEVEL_LABELS.region : row.level === 'unattributed' ? LEVEL_LABELS.unattributed : LEVEL_LABELS.entity;
  const whyValue = !row.available ? pick(row.message || REASONS[row.reason]?.message, lang) : '';
  const whyStatus = !st.available && st.message ? pick(st.message, lang) : '';
  return (
    <div className="ins-card" role="status" aria-live="polite">
      <small className="muted">{hovering ? (ar ? 'ملخص' : 'Summary') : (ar ? 'المحدد' : 'Selected')} · {pick(lvl, lang)}{row.level === 'region' ? ` · ${ar ? `${row.entityCount} ${row.entityCount === 1 ? 'أمانة' : 'أمانات'} مصرّح بها` : `${row.entityCount} authorised ${row.entityCount === 1 ? 'Amanah' : 'Amanahs'}`}` : ''}</small>
      <b className="ins-card__name">{pick(row.label, lang)}</b>
      <div className="ins-card__main"><Swatch fill={fill} glyph={fill ? row.color.glyph : null} /><span className="ins-card__metric">{pick(res.metric.short, lang)}</span><Val text={row.text} lang={lang} reason={row.reasonLabel} strong noMark={!!fill} /></div>
      <div className="ins-card__st"><StatusChip status={st} lang={lang} /></div>
      {whyValue ? <div className="ins-card__why">{whyValue}</div> : null}
      {whyStatus && whyStatus !== whyValue ? <div className="ins-card__why">{whyStatus}</div> : null}
      {supporting.length ? <dl className="ins-card__dl">{supporting.map((c) => (<React.Fragment key={c.id}><dt>{pick(c.label, lang)}</dt><dd><CellVal col={c} cell={row.cells[c.id]} lang={lang} /></dd></React.Fragment>))}</dl> : null}
      {onDetails ? <button type="button" className="btn btn-sm ins-card__go" onClick={onDetails}>{ar ? 'تفاصيل' : 'Details'}</button> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- the map */
const BOX = new Map(KSA_PROVINCES.map((p) => { const n = [...p.path.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((x) => [Number(x[1]), Number(x[2])]); const xs = n.map((a) => a[0]); const ys = n.map((a) => a[1]); return [p.iso, { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }]; }));
/** the SHORT label of a region on the map: «الشرقية», «Eastern» */
export const shortRegionName = (p, lang) => (lang === 'ar' ? p.nameAr.replace(/^المنطقة\s+/, '') : p.nameEn.replace(/\s+Province$/, ''));
/** a label is drawn only where it fits inside the region's own bounding box (small regions are read from the card / table instead) */
export function labelFits(p, lang) { const b = BOX.get(p.iso); const w = (shortRegionName(p, lang).length + 3) * (lang === 'ar' ? 10 : 9.5) * 1.5; /* + the status glyph and its space */ return !!b && b.w >= w && b.h >= 44; }

/** a status glyph alone (▼▼ ▼ ◐ ✓ ○) is drawn on a region too small for its name, so the class is readable without colour */
export function glyphFits(p) { const b = BOX.get(p.iso); return !!b && b.w >= 34 && b.h >= 26; }

export function RegionalMap({ res, lang, selectedIso, hoverKey, onHover, onSelect }) {
  const ar = lang === 'ar'; const byIso = useMemo(() => new Map(res.rows.filter((r) => r.iso).map((r) => [r.iso, r])), [res]);
  const hatch = (
    <pattern id={HATCH_ID} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="9" height="9" fill={NA_COLORS.base} /><line x1="0" y1="0" x2="0" y2="9" stroke={NA_COLORS.stroke} strokeWidth="2.2" /></pattern>
  );
  const fillFor = (p) => { const r = byIso.get(p.iso); return (r && fillOf(res.metric.id, r.color)) || `url(#${HATCH_ID})`; }; // the fill is the performance CLASS colour; hatch = unavailable comparison
  return (
    <ProvinceMap provinces={KSA_PROVINCES} viewBox={KSA_PROVINCES_VIEWBOX} selectedIso={selectedIso} defs={hatch} label={ar ? `خريطة ${pick(res.metric.label, lang)} حسب المنطقة` : `${pick(res.metric.label, lang)} by region`}
      isInert={(p) => !byIso.has(p.iso)} fillFor={fillFor} titleFor={(p) => rowTitle(res, byIso.get(p.iso), lang)} onSelect={(iso) => onSelect(byIso.get(iso))} onHover={(iso) => onHover(iso)}
      labelFor={(p) => { const r = byIso.get(p.iso); if (!r) return null; const fits = labelFits(p, lang); const gl = glyphFits(p); if (!fits && !gl) return null; const f = fillOf(res.metric.id, r.color) || NA_COLORS.base; const ink = inkOn(f); const g = r.status.glyph; return { name: fits ? `${g} ${shortRegionName(p, lang)}` : g, ink, halo: ink === '#FFFFFF' ? 'rgba(0,0,0,.35)' : 'rgba(255,255,255,.65)' }; }} />
  );
}

/* ---------------------------------------------------------------- «بدون إسناد جغرافي» */
export function UnattributedCard({ res, lang, entityNames = [], selected = false, onOpen }) {
  const row = res.unattributed; const ar = lang === 'ar'; if (!row) return null;
  const fill = fillOf(res.metric.id, row.color);
  return (
    <div className={`ins-unattr${selected ? ' is-selected' : ''}`}>
      <div className="ins-unattr__head"><b>{pick(row.label, lang)}</b>{onOpen ? <button type="button" className="btn btn-sm btn-ghost" onClick={onOpen} aria-label={`${ar ? 'تفاصيل' : 'Details'}: ${pick(row.label, lang)}`}>{ar ? 'تفاصيل' : 'Details'}</button> : null}</div>
      <div className="ins-unattr__v"><Swatch fill={fill} glyph={fill ? row.color.glyph : null} /><span className="ins-card__metric">{pick(res.metric.short, lang)}</span><Val text={row.text} lang={lang} reason={row.reasonLabel} strong noMark={!!fill} /><StatusChip status={row.status} lang={lang} size="sm" /></div>
      {entityNames.length ? <small className="muted">{entityNames.join(ar ? '، ' : ', ')}</small> : null}
      <small className="muted">{pick(row.note, lang)}</small>
      <small className="ins-unattr__tot">{ar ? 'إجمالي النطاق' : 'Scope total'}: <Val text={res.total.text} lang={lang} reason={res.total.reasonLabel} /> <span className="muted">· {ar ? 'المناطق + بدون إسناد جغرافي = الإجمالي' : 'regions + no geographic attribution = total'}</span></small>
    </div>
  );
}

/* ---------------------------------------------------------------- the table */
export function RegionalTable({ res, lang, selectedKey, sort, onSort, onSelect, entityNames = {} }) {
  const ar = lang === 'ar';
  const first = res.columns[0]; const sortId = sort?.col || first.id; const dir = sort?.dir || 'desc';
  const rows = useMemo(() => (sort ? sortRows(res.rows, sortId, dir) : res.rows), [res, sort, sortId, dir]);
  const ariaSort = (id) => (id === sortId && sort ? (dir === 'asc' ? 'ascending' : 'descending') : 'none');
  const Row = ({ r, kind }) => {
    const sel = selectedKey === r.key;
    return (
      <tr className={`${sel ? 'is-selected' : ''}${kind ? ` ins-row--${kind}` : ''}`} onClick={() => onSelect(r)} data-key={r.key}>
        <th scope="row"><button type="button" className="ins-rowbtn" aria-current={sel ? 'true' : undefined} onClick={(e) => { e.stopPropagation(); onSelect(r); }}>{pick(r.label, lang)}</button>{r.level === 'unattributed' && entityNames[r.key] ? <small className="muted ins-sub">{entityNames[r.key]}</small> : null}</th>
        <td className="num">{r.entityCount}</td>
        {res.columns.map((c) => { const cell = r.cells[c.id]; const primary = c.primary; const fill = primary ? fillOf(res.metric.id, r.color) : null; return (
          <td key={c.id} className={`num${primary ? ' ins-cell--primary' : ''}${c.kind === 'status' ? ' ins-cell--status' : ''}`}>{primary ? <Swatch fill={fill} glyph={fill ? r.color.glyph : null} /> : null}<CellVal col={c} cell={cell} lang={lang} strong={primary} noMark={primary && !!fill} /></td>); })}
      </tr>
    );
  };
  const Total = () => (
    <tr className="ins-row--total"><th scope="row">{pick(res.total.label, lang)}</th><td className="num">{res.total.entityCount}</td>{res.columns.map((c) => <td key={c.id} className="num"><CellVal col={c} cell={res.total.cells[c.id]} lang={lang} /></td>)}</tr>
  );
  return (
    <div className="rv-table-wrap ins-table-wrap" tabIndex={0}>
      <table className="rv-table ins-table" aria-label={`${pick(res.metric.label, lang)} — ${pick(LEVEL_LABELS.region, lang)}`}>
        <caption className="sr-only">{pick(res.metric.label, lang)} ({pick(res.legend.unit.label, lang)})</caption>
        <thead>
          <tr>
            <th scope="col">{pick(LEVEL_LABELS.region, lang)}</th>
            <th scope="col" className="num">{ar ? 'الأمانات' : 'Amanahs'}</th>
            {res.columns.map((c) => (
              <th key={c.id} scope="col" className="num" aria-sort={ariaSort(c.id)}>
                <button type="button" className="ins-sortbtn" onClick={() => onSort({ col: c.id, dir: sortId === c.id && sort && dir === 'desc' ? 'asc' : 'desc' })} title={ar ? 'ترتيب حسب القيمة' : 'Sort by value'}>{pick(c.label, lang)}{c.kind === 'money' ? <small className="muted"> ({pick(res.moneyUnit, lang)})</small> : null}<span aria-hidden="true" className="ins-sortbtn__i">{c.id === sortId && sort ? (dir === 'asc' ? '▲' : '▼') : ''}</span></button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => <Row key={r.key} r={r} />)}
          {res.unattributed ? <Row r={res.unattributed} kind="unattr" /> : null}
        </tbody>
        <tfoot><Total /></tfoot>
      </table>
    </div>
  );
}

