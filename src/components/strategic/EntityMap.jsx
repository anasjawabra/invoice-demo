import { localize } from '../../utils/zh';
import { useI18n } from '../../context/I18nContext';
// Geographic reading of the planning page: one map of the Kingdom's regions coloured by how much of the TARGET each region has collected, a region selector and the figures of the selection.
// The target is the SAME one the targets table holds (edited targets included); every region is the sum of its Amanahs (src/data/ksaProvinces.js). The Ministry headquarters, the housing sector and the
// payments of «غير محدد الأمانة» have no region: they are listed beside the map, and a reconciliation table adds regions + those = the Ministry.
// Pure presentation: the rows come from the planning page so the map, the tiles and the table carry the same figures.
import React, { useMemo, useState } from 'react';
import ProvinceMap from '../revenue/ProvinceMap';
import { KSA_PROVINCES, KSA_PROVINCES_VIEWBOX } from '../../data/ksaProvinces';

const pct = (v) => (Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : '—');
// EVERY percentage in the application uses the same four colours: red < 40 % · orange 40–<60 % · yellow 60–<80 % · green 80 % and above (there is no tier above 100 %: the target is reached)
export const PCT_COLORS = ['#e53935', '#f4903b', '#fde85c', '#4caf2f'];
export const PCT_CUTS = [0.4, 0.6, 0.8];
export const pctColor = (_kind, v) => (Number.isFinite(v) ? PCT_COLORS[PCT_CUTS.filter((c) => v >= c).length] : null);
// a percentage with its colour chip; `v` colours the chip (pass the share of the TARGET reached when `text` is another figure)
export const PctBadge = ({ kind, v, text }) => { const c = pctColor(kind, v); return <span dir="ltr" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{c && <i aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 3, background: c, display: 'inline-block', border: '1px solid rgba(0,0,0,.15)' }} />}{text}</span>; };
const NONE = 'var(--surface-2, #e5e7eb)';

// the measures: both colour the region by its share of the target; `text` is the value written on it — the percentage (capped at «100%+») or the amount collected
const sumOf = (rs, f) => rs.reduce((t, r) => t + f(r), 0);
const shareOf = (rs) => { const t = sumOf(rs, (r) => r.target || 0); return t > 0 ? sumOf(rs, (r) => r.collected) / t : null; };
const MEASURES = [
  { id: 'share', pct: shareOf, amount: false },
  { id: 'collected', pct: shareOf, amount: (rs) => sumOf(rs, (r) => r.collected) }
];

export default function EntityMap({ rows, hqRow, totals, L, ar, short, nameOf, selected, onSelect }) {
  const { lang } = useI18n();
  const [measureId, setMeasureId] = useState('share');
  const measure = MEASURES.find((m) => m.id === measureId);
  const byKey = useMemo(() => new Map(rows.map((r) => [r.key, r])), [rows]);
  const regions = useMemo(() => KSA_PROVINCES.map((p) => ({ ...p, rows: p.amanahKeys.map((k) => byKey.get(k)).filter(Boolean) })), [byKey]);
  const shown = regions.filter((p) => p.rows.length);
  const [iso, setIso] = useState(null);
  const region = shown.find((p) => p.iso === iso) || null;
  const regionName = (p) => (ar ? p.nameAr : localize(p.nameEn, lang));

  const colorOf = (v) => (v == null ? NONE : PCT_COLORS[PCT_CUTS.filter((c) => v >= c).length]);
  const textOf = (rs) => { const v = measure.pct(rs); if (v == null) return '—'; return measure.amount ? short(measure.amount(rs)).replace(/\s*(ريال|SAR|riyals?)$/i, '') : v >= 1 ? '100%+' : pct(v); };
  const pc = (x) => `${Math.round(x * 100)}%`;
  const legend = PCT_COLORS.map((c, i) => ({ c, text: i === 0 ? L(`أقل من ${pc(PCT_CUTS[0])}`, `Below ${pc(PCT_CUTS[0])}`) : i === PCT_COLORS.length - 1 ? L(`${pc(PCT_CUTS[i - 1])} فأكثر`, `${pc(PCT_CUTS[i - 1])} and above`) : L(`من ${pc(PCT_CUTS[i - 1])} إلى أقل من ${pc(PCT_CUTS[i])}`, `${pc(PCT_CUTS[i - 1])} to under ${pc(PCT_CUTS[i])}`) }));
  legend.push({ c: NONE, text: L('بلا مستهدف', 'No target') });

  const labels = { share: L('نسبة تحقق المستهدف (المحصّل ÷ المستهدف)', 'Target achievement (collected ÷ target)'), collected: L('المحصّل', 'Collected') };
  const reading = { share: L('اللون والرقم: نسبة تحقق المستهدف؛ الرقم لا يُكتب فوق 100%', 'Colour and figure: target achievement; the figure is not written above 100%'), collected: L('اللون: نسبته من المستهدف · المكتوب: المبلغ المحصّل', 'Colour: its share of the target · written: the amount collected') };
  // the figures of the selection: one region, or all regions together (never the headquarters, which has no region)
  const sel = region ? region.rows : shown.flatMap((p) => p.rows);
  const tg = sumOf(sel, (r) => r.target || 0); const col = sumOf(sel, (r) => r.collected);
  // with no region chosen the card is the MINISTRY (the same figures as the targets table and the tiles above); the regions alone are stated beneath it
  const card = region ? { tg, col } : { tg: totals?.target ?? tg, col: totals?.collected ?? col };
  const detail = [
    [L('المستهدف السنوي للإيراد', 'Annual revenue target'), card.tg > 0 ? short(card.tg) : '—'],
    [L('المحصّل', 'Collected'), short(card.col)],
    [L('نسبة تحقق المستهدف', 'Target achievement'), card.tg > 0 ? <PctBadge kind="share" v={card.col / card.tg} text={pct(card.col / card.tg)} /> : '—'],
    [L('المتبقي للتحصيل', 'Remaining to collect'), card.tg > 0 ? short(Math.max(card.tg - card.col, 0)) : '—']
  ];
  const side = [byKey.get('Housing Sector')].filter(Boolean);

  // regions + the entities outside any region = the Ministry (a remainder row appears only if something is not listed, so the table always reconciles)
  const regionsTg = sumOf(shown.flatMap((p) => p.rows), (r) => r.target || 0); const regionsCol = sumOf(shown.flatMap((p) => p.rows), (r) => r.collected);
  const outside = [...side, ...(hqRow ? [hqRow] : [])];
  const listedTg = regionsTg + sumOf(outside, (r) => r.target || 0); const listedCol = regionsCol + sumOf(outside, (r) => r.collected);
  const restTg = (totals?.target || 0) - listedTg; const restCol = (totals?.collected || 0) - listedCol;
  const recon = [
    [L('كل المناطق', 'All regions'), regionsTg, regionsCol],
    ...outside.map((r) => [nameOf(r.key), r.target || 0, r.collected || 0]),
    ...(Math.abs(restTg) > 1 || Math.abs(restCol) > 1 ? [[L('جهات أخرى', 'Other entities'), restTg, restCol]] : [])
  ];
  const mil = (v) => (v / 1e6).toLocaleString('en-US', { maximumFractionDigits: 0 });

  return (
    <div className="card st-card cg-geo">
      <div className="cg-geo__head">
        <div>
          <b>{L('قراءة جغرافية: أين التحصيل؟', 'Geographic reading: where is collection?')}</b>
          <div className="muted" style={{ fontSize: 12 }}>{L('اختر منطقة ثم أمانة منها لتصفية الصفحة كلها عليها. المنطقة = مجموع أماناتها، والمستهدف هو نفسه في جدول المستهدفات.', 'Choose a region, then one of its Amanahs, to filter the whole page to it. A region is the sum of its Amanahs, and the target is the one in the targets table.')}</div>
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
            <div className="muted" style={{ fontSize: 12 }}>{region ? L('منطقة', 'Region') : L('نفس أرقام جدول المستهدفات أعلاه', 'The same figures as the targets table above')}</div>
            <b style={{ fontSize: 18 }}>{region ? regionName(region) : L('إجمالي الوزارة', 'The Ministry')}</b>
            <dl className="cg-geo__dl">{detail.map(([k, v]) => <React.Fragment key={k}><dt>{k}</dt><dd dir="ltr">{v}</dd></React.Fragment>)}</dl>
            {!region && <div className="muted" style={{ fontSize: 12 }}>{L(`الخريطة تلوّن المناطق فقط: مستهدفها ${short(tg)} ومحصّلها ${short(col)}${tg > 0 ? ` (${pct(col / tg)})`.replace('(', '(') : ''}؛ والباقي (قطاع الإسكان وغير المحدد والديوان) في الجدول أدناه.`, `The map colours the regions only: their target ${short(tg)}, collected ${short(col)}${tg > 0 ? ` (${pct(col / tg)})` : ''}; the rest (housing sector, unassigned, headquarters) is in the table below.`)}</div>}
            {region && region.rows.length > 1 && (
              <div className="cg-geo__amanahs">{region.rows.map((r) => <button key={r.key} type="button" className={`rv-link${r.key === selected ? ' is-on' : ''}`} onClick={() => onSelect?.(r.key)}>{nameOf(r.key)}: {textOf([r])}</button>)}</div>
            )}
            {region && region.rows.length === 1 && <div className="cg-geo__amanahs"><button type="button" className={`rv-link${region.rows[0].key === selected ? ' is-on' : ''}`} onClick={() => onSelect?.(region.rows[0].key)}>{L('تصفية الصفحة على', 'Filter the page to')} {nameOf(region.rows[0].key)}</button></div>}
          </div>
          {side.map((r) => (
            <div key={r.key} className="cg-geo__card cg-geo__card--plain">
              <b>{nameOf(r.key)}</b>
              <div className="muted" style={{ fontSize: 12 }}>{L('نطاق مستقل عن المناطق', 'Not part of any region')}</div>
              <dl className="cg-geo__dl">
                {r.target > 0 && <><dt>{L('المستهدف السنوي للإيراد', 'Annual revenue target')}</dt><dd dir="ltr">{short(r.target)}</dd></>}
                {(r.collected > 0 || r.target > 0) && <><dt>{L('المحصّل', 'Collected')}</dt><dd dir="ltr">{short(r.collected)}</dd></>}
                {r.target > 0 && <><dt>{L('نسبة تحقق المستهدف', 'Target achievement')}</dt><dd dir="ltr"><PctBadge kind="share" v={r.collected / r.target} text={pct(r.collected / r.target)} /></dd></>}
                {!(r.target > 0) && <><dt>{L('المستهدف', 'Target')}</dt><dd>{L('لا مستهدف', 'none')}</dd></>}
              </dl>
            </div>
          ))}
        </div>
        <div className="cg-geo__map">
          <b>{labels[measureId]}</b>
          <div className="muted" style={{ fontSize: 12 }}>{reading[measureId]}</div>
          <ProvinceMap provinces={shown} viewBox={KSA_PROVINCES_VIEWBOX} selectedIso={iso}
            fillFor={(p) => colorOf(measure.pct(p.rows))} onSelect={setIso}
            labelFor={(p) => ({ name: regionName(p), value: textOf(p.rows) })}
            titleFor={(p) => `${regionName(p)} — ${labels[measureId]}: ${textOf(p.rows)}${measure.amount ? ` (${pct(measure.pct(p.rows))})` : ''}`} />
          <div className="cg-geo__legend" aria-label={L('مفتاح الألوان', 'Colour key')}>{legend.map((x) => <span key={x.text}><i style={{ background: x.c }} /><bdi>{x.text}</bdi></span>)}</div>
          <table className="sr-only"><caption>{labels[measureId]}</caption><thead><tr><th>{L('المنطقة', 'Region')}</th><th>{labels[measureId]}</th></tr></thead>
            <tbody>{shown.map((p) => <tr key={p.iso}><td>{regionName(p)}</td><td>{textOf(p.rows)}</td></tr>)}</tbody></table>
        </div>
      </div>
      {totals && (
        <div className="st-table-wrap" tabIndex={0}>
          <table className="table cg-recon" aria-label={L('مطابقة المناطق مع إجمالي الوزارة', 'Regions reconciled with the Ministry total')}>
            <caption className="muted" style={{ textAlign: 'start', fontSize: 12 }}>{L('المناطق + ما هو خارجها = إجمالي الوزارة (مليون ريال؛ قد يختلف المجموع بمقدار 1 من التقريب)', 'Regions + what is outside them = the Ministry total (million SAR; a total may differ by 1 from rounding)')}</caption>
            <thead><tr><th>{L('البند', 'Item')}</th><th>{L('المستهدف', 'Target')}</th><th>{L('المحصّل', 'Collected')}</th></tr></thead>
            <tbody>
              {recon.map(([k, tgv, colv]) => <tr key={k}><td>{k}</td><td dir="ltr" className="num">{tgv > 0 ? mil(tgv) : '—'}</td><td dir="ltr" className="num">{mil(colv)}</td></tr>)}
              <tr style={{ fontWeight: 700 }}><td>{L('إجمالي الوزارة', 'The Ministry')}</td><td dir="ltr" className="num">{mil(totals.target)}</td><td dir="ltr" className="num">{mil(totals.collected)}</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
