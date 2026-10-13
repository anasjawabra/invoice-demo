// «تحليل مصادر الإيرادات» — the first part of the dashboard: where collection concentrates, who needs follow-up, the biggest deviations and whether performance is improving,
// from entities and revenue sources down to municipalities. Everything comes from the national snapshot of the selected period and the like-for-like previous period (src/data/revenueAnalysis.js),
// so entities, sources and the Ministry reconcile with the headline indicators. Colours: ONE scale for every percentage (EntityMap: red · orange · yellow · green = 100 % · blue), neutral grey for shares.
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRevenue } from '../../context/RevenueContext';
import { useAsync } from '../../utils/useAsync';
import { useAr } from '../../utils/useAr';
import { AsyncBlock } from '../strategic/AsyncState';
import ProvinceMap from '../revenue/ProvinceMap';
import { PCT_COLORS, PCT_CUTS, pctColor, PctBadge } from '../strategic/EntityMap';
import { KSA_PROVINCES, KSA_PROVINCES_VIEWBOX } from '../../data/ksaProvinces';
import { loadComparison } from '../../data/comparison';
import { buildAnalysis, focusBreakdown, mapValue, trendOf, direction, concentration, needsFollowUp, entityLabel, sourceLabel, MAP_MEASURES } from '../../data/revenueAnalysis';
import { fmtDateText } from '../../data/clock';

const NONE = 'var(--surface-2, #e5e7eb)';
const pct = (v, d = 1) => (Number.isFinite(v) ? `${(v * 100).toFixed(d)}%` : '—');
// a signed figure is wrapped in a Unicode isolate so its sign stays attached to the number inside Arabic text
const isolate = (t) => `\u2066${t}\u2069`;
const spct = (v) => (Number.isFinite(v) ? isolate(`${v >= 0 ? '+' : '−'}${(Math.abs(v) * 100).toFixed(1)}%`) : '—');
const spp = (v) => (Number.isFinite(v) ? isolate(`${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}`) : '—');
const colorOf = (ratio) => (Number.isFinite(ratio) ? PCT_COLORS[PCT_CUTS.filter((c) => ratio >= c).length] : NONE);
const Chip = ({ ratio, children }) => { const c = Number.isFinite(ratio) ? colorOf(ratio) : null; return <span className="ra-chip" dir="ltr">{c && <i aria-hidden="true" style={{ background: c }} />}{children}</span>; };

// grouped bars: this period's collected by issue month against the like-for-like previous period (neutral colours: it is a trend, not a rating).
// Every month is a button: press it to read its figures; the full numbers are also in a table.
function TrendBars({ rows, L, short, label }) {
  const { lang } = useAr();
  const [sel, setSel] = useState(null);
  if (!rows.length) return <div className="muted" style={{ fontSize: 12 }}>{L('لا توجد أشهر لعرض الاتجاه.', 'No months to show a trend.')}</div>;
  const max = Math.max(...rows.flatMap((r) => [r.collected, r.prevCollected || 0]), 1); const W = 560; const H = 150; const bw = W / rows.length;
  const mText = (m) => fmtDateText(`${m}-01`, lang).replace(/^\d+\s*/, '');
  const chosen = rows.find((r) => r.month === sel) || null;
  const ch = chosen && chosen.prevCollected != null ? chosen.collected - chosen.prevCollected : null; const chPct = chosen && chosen.prevCollected > 0 ? chosen.collected / chosen.prevCollected - 1 : null;
  const sg = (v) => { if (v == null) return '—'; const sign = v > 0 ? '+' : v < 0 ? '−' : ''; const m = short(Math.abs(v)).match(/^([\d.,]+)\s*(.*)$/); return m ? `${isolate(`${sign}${m[1]}`)} ${m[2]}`.trim() : `${sign}${short(Math.abs(v))}`; };
  return (
    <div className="ra-trend">
      <svg viewBox={`0 0 ${W} ${H + 22}`} role="group" aria-label={label} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <line x1="0" y1={H} x2={W} y2={H} stroke="var(--line-strong, #9ca3af)" />
        {rows.map((r, i) => { const x = i * bw; const h1 = (r.collected / max) * (H - 6); const h2 = ((r.prevCollected || 0) / max) * (H - 6); const on = sel === r.month; return (
          <g key={r.month} role="button" tabIndex={0} aria-pressed={on} aria-label={`${mText(r.month)}: ${short(r.collected)}`} style={{ cursor: 'pointer', outline: 'none' }}
            onClick={() => setSel(on ? null : r.month)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(on ? null : r.month); } }}>
            <rect x={x} y="0" width={bw} height={H + 22} fill={on ? 'rgba(74,155,232,.16)' : 'transparent'} />
            {r.prevCollected != null && <rect x={x + bw * 0.12} y={H - h2} width={bw * 0.36} height={h2} fill="var(--line-strong, #9ca3af)" opacity="0.7"><title>{`${mText(r.prevMonth)}: ${short(r.prevCollected)}`}</title></rect>}
            <rect x={x + bw * 0.52} y={H - h1} width={bw * 0.36} height={h1} fill="#4a9be8"><title>{`${mText(r.month)}: ${short(r.collected)}`}</title></rect>
            <text x={x + bw / 2} y={H + 15} textAnchor="middle" style={{ fontSize: 11, fontWeight: on ? 700 : 400, fill: 'var(--txt-mute, #6b7280)' }}>{r.month.slice(5)}</text>
          </g>); })}
      </svg>
      {chosen ? (
        <div className="ra-trend__detail" role="status">
          <b>{mText(chosen.month)}</b>
          <dl className="cg-geo__dl">
            <dt>{L('المحصّل (هذه الفترة)', 'Collected (this period)')}</dt><dd dir="ltr">{short(chosen.collected)}</dd>
            <dt>{L(`المحصّل في ${chosen.prevMonth ? mText(chosen.prevMonth) : 'الفترة المماثلة'}`, `Collected in ${chosen.prevMonth ? mText(chosen.prevMonth) : 'the like-for-like period'}`)}</dt><dd dir="ltr">{chosen.prevCollected == null ? '—' : short(chosen.prevCollected)}</dd>
            <dt>{L('التغير', 'Change')}</dt><dd>{ch == null ? '—' : `${sg(ch)}${chPct == null ? '' : ` · ${spct(chPct)}`}`}</dd>
            <dt>{L('صافي المفوتر', 'Net billed')}</dt><dd dir="ltr">{short(chosen.net)}</dd>
            <dt>{L('معدل التحصيل (الآن / سابقاً)', 'Collection rate (now / before)')}</dt><dd dir="ltr">{pct(chosen.rate)} / {pct(chosen.prevRate)}</dd>
          </dl>
        </div>
      ) : <div className="muted" style={{ fontSize: 12 }}>{L('اضغط على أي شهر لقراءة أرقامه.', 'Press any month to read its figures.')}</div>}
      <details className="ra-trend__table">
        <summary>{L('عرض كل الأرقام', 'Show all the figures')}</summary>
        <div className="st-table-wrap" tabIndex={0}>
          <table className="table" aria-label={label}>
            <thead><tr><th>{L('شهر الإصدار', 'Issue month')}</th><th>{L('المحصّل', 'Collected')}</th><th>{L('الفترة المماثلة', 'Like-for-like')}</th><th>{L('التغير', 'Change')}</th><th>{L('معدل التحصيل', 'Collection rate')}</th></tr></thead>
            <tbody>{rows.map((r) => { const c = r.prevCollected == null ? null : r.collected - r.prevCollected; return (
              <tr key={r.month} className={sel === r.month ? 'is-on' : ''}><td><button type="button" className="rv-link" onClick={() => setSel(r.month)}>{mText(r.month)}</button></td><td dir="ltr">{short(r.collected)}</td><td dir="ltr">{r.prevCollected == null ? '—' : short(r.prevCollected)}</td><td dir="ltr">{c == null ? '—' : sg(c)}</td><td dir="ltr">{pct(r.rate)}</td></tr>); })}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export default function RevenueAnalysis() {
  const rev = useRevenue(); const { L, ar, lang, short } = useAr();
  const s = rev.scopeEff; const today = rev.cfg.cutoff;
  const [retry, setRetry] = useState(0);
  const [measure, setMeasure] = useState('collected');
  const [source, setSource] = useState(null);
  const [iso, setIso] = useState(null); const [entity, setEntity] = useState(null);
  const [hover, setHover] = useState(null);
  const [heat, setHeat] = useState('rate');
  const [devType, setDevType] = useState('all');
  const [openNote, setOpenNote] = useState(null);
  const [panel, setPanel] = useState('details'); // the lower sections are tabs, so the page stays short

  // the national snapshot of the selected period and the like-for-like previous period (the entity and source filters below are the analysis's own focus)
  const DATA = useAsync(async () => {
    const sc = { from: s.from, to: s.to, amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all' };
    const cur = await rev.data.snapshot(sc);
    const cmp = await loadComparison(rev.data, sc, rev.cfg, cur);
    return { cur, prev: cmp.prev, comparable: !!cmp.comparison?.comparable, basis: cmp.comparison?.basis };
  }, [rev.data, s.from, s.to, rev.cfg, rev.currentScopeKey, retry]);

  const A = useMemo(() => (DATA.data ? buildAnalysis({ cur: DATA.data.cur, prev: DATA.data.prev, comparable: DATA.data.comparable, today }) : null), [DATA.data, today]);
  const regions = useMemo(() => KSA_PROVINCES.map((p) => ({ ...p, keys: A ? p.amanahKeys.filter((k) => A.entityKeys.includes(k)) : [] })).filter((p) => p.keys.length), [A]);
  const region = regions.find((p) => p.iso === iso) || null;
  const focusKeys = entity ? [entity] : region ? region.keys : [];
  const F = useMemo(() => (A ? focusBreakdown(A, focusKeys) : null), [A, entity, iso]); // eslint-disable-line react-hooks/exhaustive-deps
  const name = (k) => { const l = entityLabel(k); return ar ? l.ar.replace(/^أمانة\s*/, 'أمانة ') : l.en; };
  const sname = (k) => { const l = sourceLabel(k); return ar ? l.ar : l.en; };
  const rname = (p) => (ar ? p.nameAr : p.nameEn);
  const sgn = (v) => { if (!Number.isFinite(v)) return '—'; const sign = v > 0 ? '+' : v < 0 ? '−' : ''; const m = short(Math.abs(v)).match(/^([\d.,]+)\s*(.*)$/); return m ? `${isolate(`${sign}${m[1]}`)} ${m[2]}`.trim() : `${sign}${short(Math.abs(v))}`; };
  const back = () => { setIso(null); setEntity(null); setSource(null); };
  const focused = !!(iso || entity || source);

  const compLabel = (b) => (b === 'same_period_last_year' ? L('الفترة نفسها من العام الماضي', 'the same period last year') : L('الفترة السابقة المماثلة', 'the previous like-for-like period'));
  const dateText = (d) => fmtDateText(d, lang);

  /* ---- the map ---- */
  const measureLabel = { collected: L('المحصّل (اللون: معدل التحصيل)', 'Collected (colour: collection rate)'), attainment: L('نسبة تحقيق الاعتماد مقابل الإيراد', 'Attainment of the revenue appropriation'), deviation: L('الانحراف عن المستهدف المتناسب مع الوقت', 'Deviation from the time-proportional target'), change: L('التغير عن الفترة المماثلة', 'Change vs the like-for-like period') };
  const reading = {
    collected: L('المكتوب: المحصّل على فواتير الفترة · اللون: معدل التحصيل = المحصّل ÷ صافي المفوتر', 'Written: collected on the period’s invoices · colour: collection rate = collected ÷ net billed'),
    attainment: L('المدفوعات المستلمة بتاريخ الدفع ÷ الاعتماد مقابل الإيراد (للعام المالي حتى تاريخه، وللمصادر كلها فقط)', 'Payments received (payment date) ÷ revenue appropriation (fiscal year to date, all sources only)'),
    deviation: L('المكتوب: المدفوعات − المستهدف المتناسب مع الزمن المنقضي (توزيع متساوٍ بتوجيه الأعمال، لا خطة معتمدة) · اللون: المدفوعات ÷ المتناسب', 'Written: payments − the target spread evenly over elapsed time (business direction, no approved plan) · colour: payments ÷ proportional target'),
    change: L('المكتوب: التغير بالقيمة · اللون: المحصّل الحالي ÷ المحصّل في الفترة المماثلة (100% = لا تغيّر)', 'Written: change in value · colour: collected now ÷ collected in the like-for-like period (100% = no change)')
  };
  const whyNo = { no_invoices: L('لا توجد فواتير', 'no invoices'), no_comparison: L('لا مقارنة مماثلة', 'no like-for-like period'), new: L('جديد: لا تحصيل في الفترة المماثلة', 'new: nothing collected last period'), no_previous: L('لا بيانات سابقة', 'no previous data'), no_source_target: L('لا مستهدف لكل مصدر', 'no per-source target'), target_period: L('المستهدف سنوي: اختر السنة المالية حتى تاريخه', 'the target is annual: choose the fiscal year to date'), no_appropriation: L('لا اعتماد لهذه الجهة', 'no appropriation'), no_expected: L('لا مستهدف متناسب', 'no proportional target') };
  const textOf = (v) => { if (!v.available) return '—'; if (measure === 'collected') return short(v.value).replace(/\s*(ريال|SAR|riyals?)$/i, ''); if (measure === 'attainment') return pct(v.pct, 0); if (measure === 'deviation') return sgn(v.value).replace(/\s*(ريال|SAR|riyals?)$/i, ''); return spct(v.pct); };
  const valOf = (keys) => (A ? mapValue(A, keys, measure, source) : { available: false });
  const hoverRegion = regions.find((p) => p.iso === hover) || null;
  const tipRegion = hoverRegion || region;

  /* ---- summary band ---- */
  const dir = A ? direction(A) : null; const con = A ? concentration(A) : null; const follow = A ? needsFollowUp(A) : [];
  const topDev = A ? A.deviations.slice(0, 3) : [];
  const trendFocusEntity = entity || (region && region.keys.length === 1 ? region.keys[0] : null);
  const trendRows = A ? trendOf(A, trendFocusEntity, source) : []; // the ONE trend chart follows the entity and source in focus

  /* ---- deviations list (filtered by the focus) ---- */
  const inFocus = (d) => (!focusKeys.length || !d.entity || focusKeys.includes(d.entity)) && (!source || d.source === source); // a source focus keeps only items of that source (the target belongs to the entity as a whole)
  const devAll = A ? A.deviations.filter((d) => inFocus(d) && (devType === 'all' || d.type === devType)) : [];
  const levelLabel = { entity: L('جهة', 'Entity'), source: L('مصدر', 'Source'), entity_source: L('جهة › مصدر', 'Entity › source') };
  const typeLabel = { change: L('التغير عن الفترة المماثلة', 'Change vs like-for-like'), share: L('التغير في المساهمة', 'Change in contribution'), target: L('الانحراف عن المستهدف', 'Deviation from target') };
  const pathOf = (d) => (d.level === 'source' ? sname(d.source) : d.level === 'entity' ? name(d.entity) : `${name(d.entity)} › ${sname(d.source)}`);
  const pickDev = (d) => { setPanel('details'); if (d.entity) { const p = regions.find((r) => r.keys.includes(d.entity)); setIso(p ? p.iso : null); setEntity(d.entity); } if (d.source) setSource(d.source); };

  /* ---- analytic notes: rule-based, each with its supporting figures; a reason is never asserted without evidence ---- */
  const notes = useMemo(() => {
    if (!A) return [];
    const out = []; const T = A.total;
    if (con && con.entities.rows.length) out.push({ id: 'conc', ar: `${con.entities.rows.length} جهات تمثل ${pct(con.entities.share, 0)} من المحصّل، ومصدر ${sname(con.sources.rows[0].key)} وحده ${pct(con.sources.rows[0].share, 0)}.`, en: `${con.entities.rows.length} entities hold ${pct(con.entities.share, 0)} of collection, and ${sname(con.sources.rows[0].key)} alone ${pct(con.sources.rows[0].share, 0)}.`, focus: {}, ev: con.entities.rows.map((e) => [name(e.key), `${short(e.collected)} · ${pct(e.share)}`]) });
    if (A.comparable && T.changePct != null) { const dc = T.decomposition; out.push({ id: 'total', ar: `المحصّل ${T.change >= 0 ? 'ارتفع' : 'انخفض'} ${spct(T.changePct)} (${sgn(T.change)}) عن ${compLabel(DATA.data.basis)}${dc ? `؛ أثر حجم الفوترة الصافية ${sgn(dc.volume)} وأثر معدل التحصيل ${sgn(dc.rate)} (تفكيك حسابي وليس تفسيراً للسبب).` : '.'}`, en: `Collected ${T.change >= 0 ? 'rose' : 'fell'} ${spct(T.changePct)} (${sgn(T.change)}) vs ${compLabel(DATA.data.basis)}${dc ? `; billing-volume effect ${sgn(dc.volume)}, collection-rate effect ${sgn(dc.rate)} (arithmetic split, not a cause).` : '.'}`, focus: {}, ev: [[L('المحصّل الآن', 'Collected now'), short(T.collected)], [L('المحصّل في الفترة المماثلة', 'Collected in the like-for-like period'), short(T.prevCollected)], [L('معدل التحصيل الآن / سابقاً', 'Collection rate now / before'), `${pct(T.rate)} / ${pct(T.prevRate)}`]] }); }
    const ed = A.deviations.filter((d) => d.type === 'change' && d.level === 'entity');
    const worst = ed.filter((d) => d.value < 0)[0]; const best = ed.filter((d) => d.value > 0)[0];
    for (const [d, key] of [[worst, 'worst'], [best, 'best']]) { if (!d) continue; const e = A.entities.find((x) => x.key === d.entity); const dc = e.decomposition;
      out.push({ id: key, ar: `${key === 'worst' ? 'أكبر تراجع' : 'أكبر ارتفاع'} بالقيمة: ${name(e.key)} (${sgn(d.value)}، ${spct(d.pct)})${dc ? `؛ أثر الفوترة ${sgn(dc.volume)} وأثر معدل التحصيل ${sgn(dc.rate)}.` : '.'}${key === 'worst' ? ' يحتاج فحصاً: أي مصادرها تغيّر؟' : ''}`, en: `${key === 'worst' ? 'Largest fall' : 'Largest rise'} in value: ${name(e.key)} (${sgn(d.value)}, ${spct(d.pct)})${dc ? `; billing effect ${sgn(dc.volume)}, collection-rate effect ${sgn(dc.rate)}.` : '.'}${key === 'worst' ? ' Needs checking: which of its sources moved?' : ''}`, focus: { entity: e.key }, ev: Object.entries(e.sources).sort((a, b) => Math.abs(b[1].change || 0) - Math.abs(a[1].change || 0)).slice(0, 5).map(([k, x]) => [sname(k), `${sgn(x.change)} · ${spct(x.changePct)}`]) }); }
    const sh = A.deviations.find((d) => d.type === 'share');
    if (sh) out.push({ id: 'share', ar: `تغيّرت مساهمة ${sname(sh.source)} في ${name(sh.entity)} من ${pct(sh.from)} إلى ${pct(sh.to)} (${spp(sh.value)} نقطة).`, en: `The contribution of ${sname(sh.source)} in ${name(sh.entity)} moved from ${pct(sh.from)} to ${pct(sh.to)} (${spp(sh.value)} pp).`, focus: { entity: sh.entity, source: sh.source }, ev: [[L('المصدر', 'Source'), sname(sh.source)], [L('الجهة', 'Entity'), name(sh.entity)], [L('المساهمة الآن', 'Contribution now'), pct(sh.to)], [L('المساهمة سابقاً', 'Contribution before'), pct(sh.from)]] });
    if (A.ministryTarget) { const m = A.ministryTarget; out.push({ id: 'target', ar: `المدفوعات المستلمة تعادل ${pct(m.attainment, 0)} من الاعتماد مقابل الإيراد، والمتناسب مع الوقت المنقضي ${pct(m.expected / m.appropriation, 0)}؛ الفرق ${sgn(m.deviation)} (${spct(m.deviationPct)}). التوزيع متساوٍ بتوجيه الأعمال وليس خطة مرحلية معتمدة، فلا يُعدّ الفرق تأخراً مؤكداً.`, en: `Payments received equal ${pct(m.attainment, 0)} of the revenue appropriation against ${pct(m.expected / m.appropriation, 0)} proportional to elapsed time; the gap is ${sgn(m.deviation)} (${spct(m.deviationPct)}). The spread is even by business direction, not an approved milestone plan, so the gap is not confirmed lateness.`, focus: {}, ev: [[L('الاعتماد', 'Appropriation'), short(m.appropriation)], [L('المدفوعات المستلمة', 'Payments received'), short(m.pay)], [L('المتناسب مع الوقت', 'Time-proportional target'), short(m.expected)]] }); }
    if (follow.length) { const f = follow[0]; out.push({ id: 'follow', ar: `${f.level === 'entity' ? name(f.entity) : `${name(f.entity)} › ${sname(f.source)}`}: معدل التحصيل ${pct(f.rate, 0)} مقابل ${pct(A.total.rate, 0)} للوزارة، وغير المحصّل ${short(f.uncollected)}.`, en: `${f.level === 'entity' ? name(f.entity) : `${name(f.entity)} › ${sname(f.source)}`}: collection rate ${pct(f.rate, 0)} against ${pct(A.total.rate, 0)} for the Ministry, with ${short(f.uncollected)} uncollected.`, focus: { entity: f.entity, source: f.source }, ev: follow.map((x) => [x.level === 'entity' ? name(x.entity) : `${name(x.entity)} › ${sname(x.source)}`, `${pct(x.rate, 0)} · ${short(x.uncollected)}`]) }); }
    const un = A.entities.find((e) => e.key === 'Unassigned');
    if (un && un.collected > 0) out.push({ id: 'unassigned', ar: `${short(un.collected)} (${pct(un.share)}) من المحصّل لا يُنسب لأمانة لأن مكين لم يطابق فواتيره؛ يظهر في إجمالي الوزارة ولا على الخريطة.`, en: `${short(un.collected)} (${pct(un.share)}) of collection cannot be assigned to an Amanah because Makeen did not match its invoices; it is in the Ministry total, not on the map.`, focus: { entity: 'Unassigned' }, ev: Object.entries(un.sources).map(([k, x]) => [sname(k), short(x.collected)]) });
    return out;
  }, [A, ar, DATA.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const muniRows = useMemo(() => {
    if (!A || !entity) return [];
    const key = (g) => g.key; const prev = new Map((A.prev?.byMunicipality || []).map((g) => [key(g), g]));
    return (A.cur.byMunicipality || []).filter((g) => g.amanah === entity && g.municipality).map((g) => { const p = A.comparable ? prev.get(g.key) : null; return { key: g.key, label: ar ? g.municipality.ar : g.municipality.en, collected: g.collected, net: g.net, rate: g.net > 0 ? g.collected / g.net : null, prev: p ? p.collected : null, change: p ? g.collected - p.collected : null, changePct: p && p.collected > 0 ? g.collected / p.collected - 1 : null }; }).sort((a, b) => b.collected - a.collected);
  }, [A, entity, ar]);

  const heatCols = A ? A.sourceKeys : [];
  const heatRows = A ? A.entities.filter((e) => e.net > 0 || e.hasPrev).sort((a, b) => b.collected - a.collected) : [];
  const heatCell = (e, k) => { const x = e.sources[k]; if (!x) return { text: '—', color: NONE, title: L('لا فواتير', 'no invoices') };
    if (heat === 'rate') return x.rate == null ? { text: '—', color: NONE } : { text: pct(x.rate, 0), color: colorOf(x.rate), ratio: x.rate };
    if (heat === 'change') { if (!A.comparable) return { text: '—', color: NONE, title: whyNo.no_comparison }; if (!(x.prevCollected > 0)) return { text: x.collected > 0 ? L('جديد', 'new') : '—', color: NONE, title: whyNo.new }; const r = x.collected / x.prevCollected; return { text: spct(r - 1), color: colorOf(r), ratio: r }; }
    return { text: x.share == null ? '—' : pct(x.share, 0), color: x.share == null ? NONE : `rgba(100,116,139,${0.12 + Math.min(x.share, 1) * 0.7})`, neutral: true }; };

  if (rev.loading && !DATA.data) return null;
  return (
    <section className="ra" aria-label={L('تحليل مصادر الإيرادات', 'Revenue-source analysis')}>
      <AsyncBlock state={DATA} onRetry={() => setRetry((n) => n + 1)} height={300}>
        {A && (
          <>
            <div className="ra-head">
              <div>
                <h2 className="rv-sec-title" style={{ margin: 0 }}>{L('تحليل مصادر الإيرادات والجهات', 'Revenue sources and entities')}</h2>
                <div className="muted" style={{ fontSize: 12 }}>{L(`الفترة ${dateText(DATA.data.cur.scope.from)} – ${dateText(DATA.data.cur.scope.to)}`, `Period ${dateText(DATA.data.cur.scope.from)} – ${dateText(DATA.data.cur.scope.to)}`)}{A.comparable ? L(` · المقارنة بـ ${compLabel(DATA.data.basis)} (${dateText(DATA.data.prev.scope.from)} – ${dateText(DATA.data.prev.scope.to)})`, ` · compared with ${compLabel(DATA.data.basis)} (${dateText(DATA.data.prev.scope.from)} – ${dateText(DATA.data.prev.scope.to)})`) : L(' · لا توجد فترة مماثلة ضمن البيانات: لا تُعرض مقارنات.', ' · no like-for-like period in the data: no comparisons shown.')}</div>
              </div>
            </div>

            {/* the four answers */}
            {/* the analysis's own filters: always visible, so the entity and source in focus are never hidden */}
            <div className="card st-card ra-filters" role="group" aria-label={L('مرشحات التحليل', 'Analysis filters')}>
              <label className="cg-field" htmlFor="ra-entity">{L('الجهة', 'Entity')}
                <select id="ra-entity" className="input" value={entity ? `e:${entity}` : iso ? `r:${iso}` : ''} onChange={(e) => { const v = e.target.value; if (!v) { setIso(null); setEntity(null); } else if (v.startsWith('r:')) { setIso(v.slice(2)); setEntity(null); } else { const k = v.slice(2); const p = regions.find((r) => r.keys.includes(k)); setIso(p ? p.iso : null); setEntity(k); } }}>
                  <option value="">{L('الوزارة — كل الجهات', 'The Ministry — all entities')}</option>
                  <optgroup label={L('المناطق', 'Regions')}>{regions.map((p) => <option key={p.iso} value={`r:${p.iso}`}>{rname(p)}</option>)}</optgroup>
                  <optgroup label={L('الأمانات والجهات', 'Amanahs and entities')}>{A.entityKeys.map((k) => <option key={k} value={`e:${k}`}>{name(k)}</option>)}</optgroup>
                </select>
              </label>
              <label className="cg-field" htmlFor="ra-source">{L('مصدر الإيراد', 'Revenue source')}
                <select id="ra-source" className="input" value={source || ''} onChange={(e) => setSource(e.target.value || null)}>
                  <option value="">{L('كل المصادر', 'All sources')}</option>
                  {A.sourceKeys.map((k) => <option key={k} value={k}>{sname(k)}</option>)}
                </select>
              </label>
              <div className="ra-filters__state" role="status">
                {focused ? <>{L('الاختيار الحالي:', 'Current choice:')} <b>{entity ? name(entity) : region ? rname(region) : L('كل الجهات', 'all entities')}{source ? ` · ${sname(source)}` : ''}</b></> : <span className="muted">{L('العرض العام: كل الجهات وكل المصادر.', 'Overall view: all entities and all sources.')}</span>}
                <span className="muted" style={{ fontSize: 12 }}> {L('(الفترة من مرشحات الصفحة أعلاه)', '(the period comes from the page filters above)')}</span>
              </div>
              {focused && <button type="button" className="btn btn-sm" onClick={back}>{L('✕ العودة إلى العرض العام', '✕ Back to the overall view')}</button>}
            </div>

            <div className="ra-answers">
              <div className="card st-card ra-ans">
                <b>{L('أين يتركز التحصيل؟', 'Where does collection concentrate?')}</b>
                <div className="ra-big">{pct(con.entities.share, 0)}</div>
                <div className="muted" style={{ fontSize: 12 }}>{L(`من المحصّل في ${con.entities.rows.length} جهات`, `of collection in ${con.entities.rows.length} entities`)}</div>
                <ul className="ra-list">{con.entities.rows.slice(0, 3).map((e) => <li key={e.key}><button type="button" className="rv-link" onClick={() => { const p = regions.find((r) => r.keys.includes(e.key)); setIso(p ? p.iso : null); setEntity(e.key); }}>{name(e.key)}</button><span dir="ltr">{pct(e.share, 0)}</span></li>)}</ul>
                <div className="ra-tags">{con.sources.rows.slice(0, 3).map((x) => <button key={x.key} type="button" className="rv-tag" onClick={() => setSource(x.key)}>{sname(x.key)} {pct(x.share, 0)}</button>)}</div>
              </div>
              <div className="card st-card ra-ans">
                <b>{L('ما يحتاج إلى متابعة', 'Needs follow-up')}</b>
                <div className="ra-big">{follow.length}</div>
                <div className="muted" style={{ fontSize: 12 }}>{L('جهات أو مصادر معدل تحصيلها دون المعدل العام بفارق مادي', 'entities or sources collecting materially below the overall rate')}</div>
                <ul className="ra-list">{follow.slice(0, 3).map((f, i) => <li key={i}><button type="button" className="rv-link" onClick={() => pickDev({ entity: f.entity, source: f.source, level: f.level })}>{f.level === 'entity' ? name(f.entity) : `${name(f.entity)} › ${sname(f.source)}`}</button><Chip ratio={f.rate}>{pct(f.rate, 0)}</Chip></li>)}</ul>
                {!follow.length && <div className="muted" style={{ fontSize: 12 }}>{L('لا شيء بفارق مادي.', 'Nothing with a material gap.')}</div>}
              </div>
              <div className="card st-card ra-ans">
                <b>{L('أكبر الانحرافات المؤثرة', 'Largest material deviations')}</b>
                {topDev.length ? <ul className="ra-list ra-list--dev">{topDev.map((d) => <li key={d.id}><button type="button" className="rv-link" onClick={() => pickDev(d)}>{pathOf(d)}</button><span className="muted" style={{ fontSize: 11 }}>{typeLabel[d.type]}</span><b>{d.type === 'share' ? `${spp(d.value)} ${L('نقطة', 'pp')}` : `${sgn(d.value)}${d.pct != null ? ` · ${spct(d.pct)}` : ''}`}</b></li>)}</ul> : <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{L('لا انحرافات مادية، أو لا مقارنة متاحة.', 'No material deviation, or no comparison available.')}</div>}
              </div>
              <div className="card st-card ra-ans">
                <b>{L('هل الأداء يتحسن أم يتراجع؟', 'Is performance improving or declining?')}</b>
                {dir.state === 'unknown' ? <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{L('لا توجد فترة مماثلة للمقارنة.', 'No like-for-like period to compare with.')}</div> : (
                  <>
                    <div className="ra-big"><Chip ratio={dir.state === 'improving' ? 1.0 : dir.state === 'declining' ? 0.3 : dir.state === 'mixed' ? 0.8 : null}>{{ improving: L('يتحسن', 'Improving'), declining: L('يتراجع', 'Declining'), mixed: L('مختلط', 'Mixed'), stable: L('مستقر', 'Stable') }[dir.state]}</Chip></div>
                    <div className="muted" style={{ fontSize: 12 }}>{L(`المحصّل ${spct(dir.changePct)} (${sgn(dir.change)}) ومعدل التحصيل ${dir.pp == null ? '—' : `${spp(dir.pp)} نقطة`} عن ${compLabel(DATA.data.basis)}`, `Collected ${spct(dir.changePct)} (${sgn(dir.change)}) and collection rate ${dir.pp == null ? '—' : `${spp(dir.pp)} pp`} vs ${compLabel(DATA.data.basis)}`)}</div>
                  </>
                )}
                <div className="muted" style={{ fontSize: 12 }}>{L('الاتجاه بحسب شهر الإصدار', 'Trend by issue month')}: <b>{trendFocusEntity ? name(trendFocusEntity) : L('الوزارة', 'the Ministry')}{source ? ` · ${sname(source)}` : ''}</b></div>
                <TrendBars rows={trendRows} L={L} short={short} label={L('المحصّل بحسب شهر الإصدار مقابل الفترة المماثلة', 'Collected by issue month against the like-for-like period')} />
                {region && region.keys.length > 1 && !entity && <div className="muted" style={{ fontSize: 11 }}>{L('اختر أمانة داخل المنطقة لعرض اتجاهها منفردة.', 'Choose an Amanah in the region to see its own trend.')}</div>}
              </div>
            </div>
            <div className="ra-kpis">
              <div className="ra-kpi"><span>{L('معدل التحصيل', 'Collection rate')}</span><b><PctBadge v={A.total.rate} text={pct(A.total.rate)} /></b><small className="muted">{L('المحصّل ÷ صافي المفوتر (فواتير الفترة)', 'collected ÷ net billed (the period’s invoices)')}</small></div>
              <div className="ra-kpi"><span>{L('نسبة تحقيق الاعتماد مقابل الإيراد', 'Attainment of the revenue appropriation')}</span><b>{A.ministryTarget ? <PctBadge v={A.ministryTarget.attainment} text={pct(A.ministryTarget.attainment)} /> : '—'}</b><small className="muted">{A.ministryTarget ? L('المدفوعات المستلمة ÷ الاعتماد (للعام المالي حتى تاريخه)', 'payments received ÷ appropriation (fiscal year to date)') : L('تُحسب للعام المالي حتى تاريخه فقط', 'calculated for the fiscal year to date only')}</small></div>
              <div className="ra-kpi"><span>{L('الانحراف عن المتناسب مع الوقت', 'Deviation from the time-proportional target')}</span><b>{A.ministryTarget ? <Chip ratio={A.ministryTarget.paceRatio}>{sgn(A.ministryTarget.deviation)}</Chip> : '—'}</b><small className="muted">{L('توزيع متساوٍ بتوجيه الأعمال', 'even spread by business direction')}</small></div>
            </div>

            {/* the map and the focus */}
            <div className="card st-card ra-map">
              <div className="cg-geo__head">
                <b>{L('الخريطة التفاعلية: قارن الجهات ثم افتح تفاصيلها', 'Interactive map: compare entities, then open their details')}</b>
                <div className="cg-geo__tabs" role="group" aria-label={L('المقياس', 'Measure')}>{MAP_MEASURES.map((m) => <button key={m} type="button" className={`btn btn-sm ${m === measure ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={m === measure} onClick={() => setMeasure(m)}>{{ collected: L('المحصّل', 'Collected'), attainment: L('نسبة تحقيق المستهدف', 'Target attainment'), deviation: L('الانحراف', 'Deviation'), change: L('التغير عن الفترة المماثلة', 'Change vs like-for-like') }[m]}</button>)}</div>
              </div>
              <div className="cg-geo__tabs" role="group" aria-label={L('مصدر الإيراد', 'Revenue source')}>
                <button type="button" className={`btn btn-sm ${!source ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={!source} onClick={() => setSource(null)}>{L('كل المصادر', 'All sources')}</button>
                {A.sourceKeys.map((k) => <button key={k} type="button" className={`btn btn-sm ${source === k ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={source === k} onClick={() => setSource(source === k ? null : k)}>{sname(k)}</button>)}
              </div>
              <div className="muted" style={{ fontSize: 12 }}>{measureLabel[measure]} — {reading[measure]}{source ? ` — ${L('المصدر', 'Source')}: ${sname(source)}` : ''}</div>
              <div className="ra-map__body">
                <div className="ra-map__svg">
                  <ProvinceMap provinces={regions} viewBox={KSA_PROVINCES_VIEWBOX} selectedIso={iso}
                    fillFor={(p) => { const v = valOf(p.keys); return v.available ? colorOf(v.ratio) : NONE; }}
                    onSelect={(x) => { setIso(x); setEntity(null); setPanel('details'); }} onHover={setHover}
                    labelFor={(p) => ({ name: rname(p), value: textOf(valOf(p.keys)) })}
                    titleFor={(p) => { const v = valOf(p.keys); return `${rname(p)} — ${measureLabel[measure]}: ${v.available ? textOf(v) : whyNo[v.reason] || '—'}`; }} />
                  <div className="cg-geo__legend" aria-label={L('مفتاح الألوان', 'Colour key')}>
                    {PCT_COLORS.map((c, i) => <span key={c}><i style={{ background: c }} /><bdi>{i === 0 ? L(`أقل من ${PCT_CUTS[0] * 100}%`, `Below ${PCT_CUTS[0] * 100}%`) : i === 4 ? L(`${PCT_CUTS[3] * 100}% فأكثر`, `${PCT_CUTS[3] * 100}% and above`) : L(`من ${PCT_CUTS[i - 1] * 100}% إلى أقل من ${PCT_CUTS[i] * 100}%`, `${PCT_CUTS[i - 1] * 100}% to under ${PCT_CUTS[i] * 100}%`)}</bdi></span>)}
                    <span><i style={{ background: NONE }} /><bdi>{L('لا بيانات / غير متاح (ليس صفراً)', 'no data / n/a (not zero)')}</bdi></span>
                  </div>
                  <div className="muted" style={{ fontSize: 11 }}>{L('100% = المرجع (معدل التحصيل الكامل، أو الاعتماد، أو الفترة المماثلة) = أخضر. المنطقة = مجموع أماناتها. جهات بلا منطقة: قطاع الإسكان و«غير محدد الأمانة».', '100% = the reference (full collection, the appropriation, or the like-for-like period) = green. A region is the sum of its Amanahs. Entities with no region: housing sector and Unassigned.')}</div>
                </div>
                <div className="ra-map__side">
                  <div className="cg-geo__card" role="status" aria-live="polite">
                    {tipRegion ? (() => { const v = valOf(tipRegion.keys); const f = focusBreakdown(A, tipRegion.keys); const top = [...f.sources].sort((a, b) => b.collected - a.collected)[0]; return (
                      <>
                        <div className="muted" style={{ fontSize: 12 }}>{hoverRegion ? L('ملخص عند المرور', 'Hover summary') : L('المنطقة المختارة', 'Selected region')}</div>
                        <b style={{ fontSize: 17 }}>{rname(tipRegion)}</b>
                        <dl className="cg-geo__dl">
                          <dt>{measureLabel[measure]}</dt><dd dir="ltr">{v.available ? <Chip ratio={v.ratio}>{textOf(v)}</Chip> : <span className="muted">{whyNo[v.reason]}</span>}</dd>
                          <dt>{L('المحصّل', 'Collected')}</dt><dd dir="ltr">{short(f.total.collected)}</dd>
                          <dt>{L('معدل التحصيل', 'Collection rate')}</dt><dd dir="ltr"><PctBadge v={f.total.rate} text={pct(f.total.rate)} /></dd>
                          <dt>{L('التغير عن المماثلة', 'Change vs like-for-like')}</dt><dd dir="ltr">{f.total.changePct == null ? '—' : <Chip ratio={1 + f.total.changePct}>{spct(f.total.changePct)}</Chip>}</dd>
                          <dt>{L('حصتها من تحصيل الوزارة', 'Share of Ministry collection')}</dt><dd dir="ltr">{pct(f.shareOfMinistry)}</dd>
                          {top && <><dt>{L('أكبر مصدر', 'Largest source')}</dt><dd>{sname(top.key)} · {pct(top.share, 0)}</dd></>}
                        </dl>
                        {!hoverRegion && <div className="muted" style={{ fontSize: 12 }}>{L('التفاصيل أدناه.', 'Details below.')}</div>}
                      </>); })() : <div className="muted" style={{ fontSize: 13 }}>{L('مرّر على منطقة لعرض ملخصها، واضغط عليها لفتح تفاصيلها ومصادر إيراداتها واتجاه أدائها.', 'Hover over a region for its summary; press it to open its details, revenue sources and trend.')}</div>}
                  </div>
                  {['Housing Sector', 'Unassigned'].filter((k) => A.entityKeys.includes(k)).map((k) => { const v = valOf([k]); return (
                    <button key={k} type="button" className={`cg-geo__card cg-geo__card--plain ra-side${entity === k ? ' is-on' : ''}`} onClick={() => { setIso(null); setEntity(entity === k ? null : k); }}>
                      <b>{name(k)}</b><span className="muted" style={{ fontSize: 12 }}>{L('بلا منطقة جغرافية', 'no region')}</span>
                      <span dir="ltr">{v.available ? <Chip ratio={v.ratio}>{textOf(v)}</Chip> : <span className="muted">{whyNo[v.reason]}</span>}</span>
                    </button>); })}
                </div>
              </div>
            </div>

            <div className="sr-tabs" role="tablist" aria-label={L('تفاصيل التحليل', 'Analysis details')}>
              {[['details', L('تفاصيل الجهة والمصادر', 'Entity and source details')], ['deviations', L(`الانحرافات (${A.deviations.length})`, `Deviations (${A.deviations.length})`)], ['matrix', L('المصفوفة الحرارية', 'Heat matrix')], ['notes', L('الملخص التحليلي', 'Analytic summary')]].map(([k, l]) => <button key={k} id={`ra-tab-${k}`} type="button" role="tab" aria-selected={panel === k} aria-controls={`ra-panel-${k}`} className={`sr-tab ${panel === k ? 'is-active' : ''}`} onClick={() => setPanel(k)}>{l}</button>)}
            </div>

            {/* the focus: details, sources, municipalities, trend */}
            {panel === 'details' && <div className="card st-card ra-focus" role="tabpanel" id="ra-panel-details" aria-labelledby="ra-tab-details">
              <div className="cg-geo__head">
                <div>
                  <b>{entity ? name(entity) : region ? rname(region) : L('الوزارة — كل الجهات', 'The Ministry — all entities')}{source ? ` · ${sname(source)}` : ''}</b>
                  <div className="muted" style={{ fontSize: 12 }}>{L('كل ما يلي يتبع الجهة والمصدر المختارين أعلاه.', 'Everything below follows the entity and source chosen above.')}</div>
                </div>
                <div className="ra-actions">
                  {region && region.keys.length > 1 && !entity && <label className="rv-inline">{L('أمانة', 'Amanah')} <select className="input" value="" onChange={(e) => setEntity(e.target.value || null)} aria-label={L('اختر أمانة داخل المنطقة', 'Choose an Amanah in the region')}><option value="">{L('كل أمانات المنطقة', 'All Amanahs of the region')}</option>{region.keys.map((k) => <option key={k} value={k}>{name(k)}</option>)}</select></label>}
                  {focused && <button type="button" className="btn btn-sm" onClick={() => { rev.setAmanah(focusKeys.length === 0 ? 'all' : focusKeys.length === 1 ? focusKeys[0] : focusKeys); rev.setSource(source || 'all'); }}>{L('تطبيق على اللوحة كلها', 'Apply to the whole dashboard')}</button>}
                  {focusKeys.length > 0 && <Link className="btn btn-sm btn-ghost" to={`/invoices${source ? `?src=${source}` : ''}`}>{L('فتح الفواتير', 'Open the invoices')}</Link>}
                </div>
              </div>
              {(() => { const t = F.total; const dc = t.decomposition; return (
                <div className="ra-kpis">
                  <div className="ra-kpi"><span>{L('المحصّل', 'Collected')}</span><b dir="ltr">{short(t.collected)}</b><small className="muted">{L('حصته من تحصيل الوزارة', 'share of Ministry collection')} {pct(F.shareOfMinistry)}</small></div>
                  <div className="ra-kpi"><span>{L('معدل التحصيل', 'Collection rate')}</span><b><PctBadge v={t.rate} text={pct(t.rate)} /></b><small className="muted">{t.prevRate != null ? L(`سابقاً ${pct(t.prevRate)}`, `before ${pct(t.prevRate)}`) : ''}</small></div>
                  <div className="ra-kpi"><span>{L('التغير عن الفترة المماثلة', 'Change vs like-for-like')}</span><b dir="ltr">{t.changePct == null ? '—' : <Chip ratio={1 + t.changePct}>{spct(t.changePct)} · {sgn(t.change)}</Chip>}</b><small className="muted">{dc ? L(`أثر الفوترة ${sgn(dc.volume)} · أثر معدل التحصيل ${sgn(dc.rate)}`, `billing ${sgn(dc.volume)} · collection-rate ${sgn(dc.rate)}`) : ''}</small></div>
                  <div className="ra-kpi"><span>{L('نسبة تحقيق الاعتماد', 'Appropriation attainment')}</span><b>{F.target && !source ? <PctBadge v={F.target.attainment} text={pct(F.target.attainment)} /> : '—'}</b><small className="muted">{source ? L('لا مستهدف لكل مصدر', 'no per-source target') : F.target ? L(`انحراف عن المتناسب ${sgn(F.target.deviation)}`, `deviation from proportional ${sgn(F.target.deviation)}`) : L('غير متاحة لهذه الفترة/الجهة', 'not available for this period/entity')}</small></div>
                </div>); })()}
              <div className="ra-two ra-two--one">
                <div>
                  <b>{L('مصادر الإيراد', 'Revenue sources')}</b>
                  <div className="st-table-wrap" tabIndex={0}>
                    <table className="table" aria-label={L('مصادر الإيراد', 'Revenue sources')}>
                      <thead><tr><th>{L('المصدر', 'Source')}</th><th>{L('المحصّل', 'Collected')}</th><th>{L('نسبته من تحصيل الجهة', 'Share of the entity’s collection')}</th><th>{L('معدل التحصيل', 'Collection rate')}</th><th>{L('التغير (قيمة)', 'Change (value)')}</th><th>{L('التغير %', 'Change %')}</th><th>{L('تغير المساهمة (نقطة)', 'Contribution shift (pp)')}</th></tr></thead>
                      <tbody>{[...F.sources].sort((a, b) => b.collected - a.collected).map((x) => (
                        <tr key={x.key} className={source === x.key ? 'is-on' : ''}>
                          <td><button type="button" className="rv-link" onClick={() => setSource(source === x.key ? null : x.key)}>{sname(x.key)}</button></td>
                          <td dir="ltr">{short(x.collected)}</td><td dir="ltr">{pct(x.share)}</td>
                          <td dir="ltr"><PctBadge v={x.rate} text={pct(x.rate)} /></td>
                          <td dir="ltr">{x.change == null ? '—' : sgn(x.change)}</td>
                          <td dir="ltr">{x.isNew ? L('جديد', 'new') : x.changePct == null ? '—' : <Chip ratio={1 + x.changePct}>{spct(x.changePct)}</Chip>}</td>
                          <td dir="ltr">{x.shiftPp == null ? '—' : spp(x.shiftPp)}</td>
                        </tr>))}</tbody>
                    </table>
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>{L('لا مستهدف لكل مصدر: الاعتماد مقابل الإيراد للجهة كلها ولا يُوزَّع على المصادر. المقارنة بالفترة المماثلة والمساهمة هما أساس القراءة.', 'There is no per-source target: the appropriation belongs to the entity as a whole and is not split across sources. The like-for-like comparison and the contribution are the basis of reading.')}</div>
                </div>
              </div>
              {entity && muniRows.length > 0 && (
                <div>
                  <b>{L('البلديات', 'Municipalities')}</b>
                  <div className="st-table-wrap" tabIndex={0}>
                    <table className="table" aria-label={L('البلديات', 'Municipalities')}>
                      <thead><tr><th>{L('البلدية', 'Municipality')}</th><th>{L('المحصّل', 'Collected')}</th><th>{L('معدل التحصيل', 'Collection rate')}</th><th>{L('التغير (قيمة)', 'Change (value)')}</th><th>{L('التغير %', 'Change %')}</th></tr></thead>
                      <tbody>{muniRows.map((m) => <tr key={m.key}><td>{m.label}</td><td dir="ltr">{short(m.collected)}</td><td dir="ltr"><PctBadge v={m.rate} text={pct(m.rate)} /></td><td dir="ltr">{m.change == null ? '—' : sgn(m.change)}</td><td dir="ltr">{m.changePct == null ? '—' : <Chip ratio={1 + m.changePct}>{spct(m.changePct)}</Chip>}</td></tr>)}</tbody>
                    </table>
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>{L('البلديات من بيانات الفواتير نفسها؛ لا تفصيل بالمصدر ولا مستهدف على مستوى البلدية، ولا تُرسم على الخريطة لعدم وجود حدودها في البيانات.', 'Municipalities come from the same invoice data; there is no source split or target at municipality level, and they are not drawn on the map because their boundaries are not in the data.')}</div>
                </div>
              )}
              {entity && !muniRows.length && <div className="muted" style={{ fontSize: 12 }}>{L('لا تتوفر بيانات بلديات لهذه الجهة.', 'No municipality data for this entity.')}</div>}
            </div>}

            {/* deviations, ranked by value */}
            {panel === 'deviations' && <div className="card st-card" role="tabpanel" id="ra-panel-deviations" aria-labelledby="ra-tab-deviations">
              <div className="cg-geo__head">
                <div>
                  <b>{L('الانحرافات مرتبة بأثرها المالي', 'Deviations ranked by financial impact')}</b>
                  <div className="muted" style={{ fontSize: 12 }}>{L('الترتيب بالقيمة؛ النسبة بجانبها كي لا تطغى نسب كبيرة لمصادر صغيرة. ثلاثة أنواع منفصلة: التغير عن الفترة المماثلة، والتغير في المساهمة، والانحراف عن المستهدف المتناسب مع الوقت.', 'Ranked by value; the % sits beside it so large percentages of small sources do not dominate. Three separate kinds: change vs the like-for-like period, change in contribution, and deviation from the time-proportional target.')}</div>
                </div>
                <div className="cg-geo__tabs" role="group" aria-label={L('نوع الانحراف', 'Kind of deviation')}>
                  {['all', 'change', 'share', 'target'].map((k) => <button key={k} type="button" className={`btn btn-sm ${devType === k ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={devType === k} onClick={() => setDevType(k)}>{k === 'all' ? L('الكل', 'All') : typeLabel[k]}</button>)}
                </div>
              </div>
              {devAll.length ? (
                <div className="st-table-wrap" tabIndex={0}>
                  <table className="table" aria-label={L('الانحرافات', 'Deviations')}>
                    <thead><tr><th>#</th><th>{L('النوع', 'Kind')}</th><th>{L('المستوى', 'Level')}</th><th>{L('الجهة / المصدر', 'Entity / source')}</th><th>{L('القيمة', 'Value')}</th><th>{L('النسبة', '%')}</th><th>{L('الحجم', 'Size')}</th></tr></thead>
                    <tbody>{devAll.slice(0, 12).map((d, i) => { const w = devAll[0].weight || 1; const ratio = d.type === 'target' ? 1 + d.pct : d.type === 'change' && d.pct != null ? 1 + d.pct : null; return (
                      <tr key={d.id}>
                        <td>{i + 1}</td><td>{typeLabel[d.type]}</td><td>{levelLabel[d.level]}</td>
                        <td><button type="button" className="rv-link" onClick={() => pickDev(d)}>{pathOf(d)}</button></td>
                        <td dir="ltr">{d.type === 'share' ? `${spp(d.value)} ${L('نقطة', 'pp')} (${pct(d.from, 0)} → ${pct(d.to, 0)})` : sgn(d.value)}</td>
                        <td dir="ltr">{d.type === 'share' ? '—' : d.isNew ? L('جديد', 'new') : <Chip ratio={ratio}>{spct(d.pct)}</Chip>}</td>
                        <td><span className="rv-sizebar" role="img" aria-label={short(d.weight)}><i style={{ width: `${Math.max(3, (d.weight / w) * 100)}%` }} /></span> <small className="muted" dir="ltr">{short(d.weight)}</small></td>
                      </tr>); })}</tbody>
                  </table>
                </div>
              ) : <div className="rv-empty" style={{ padding: 12 }}>{A.comparable || A.targetAvailable ? L('لا انحرافات مادية في هذا الاختيار.', 'No material deviation in this selection.') : L('لا مقارنة ولا مستهدف لهذه الفترة: لا تُعرض انحرافات.', 'No comparison and no target for this period: no deviations are shown.')}</div>}
            </div>}

            {/* the heat matrix */}
            {panel === 'matrix' && <div className="card st-card" role="tabpanel" id="ra-panel-matrix" aria-labelledby="ra-tab-matrix">
              <div className="cg-geo__head">
                <div>
                  <b>{L('مصفوفة حرارية: الجهات × مصادر الإيراد', 'Heat matrix: entities × revenue sources')}</b>
                  <div className="muted" style={{ fontSize: 12 }}>{L('اضغط خلية لاختيار الجهة والمصدر. الرمادي المتدرج للمساهمة (ليست تقييماً)؛ ألوان التقييم لمعدل التحصيل وللتغير (100% = أخضر).', 'Press a cell to choose entity and source. Graded grey is contribution (not a rating); the rating colours are for collection rate and change (100% = green).')}</div>
                </div>
                <div className="cg-geo__tabs" role="group" aria-label={L('مقياس المصفوفة', 'Matrix measure')}>
                  {[['rate', L('معدل التحصيل', 'Collection rate')], ['change', L('التغير عن الفترة المماثلة', 'Change vs like-for-like')], ['share', L('مساهمة المصدر في الجهة', 'Contribution to the entity')]].map(([k, l]) => <button key={k} type="button" className={`btn btn-sm ${heat === k ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={heat === k} onClick={() => setHeat(k)}>{l}</button>)}
                </div>
              </div>
              <div className="ra-heat" role="region" aria-label={L('المصفوفة الحرارية', 'Heat matrix')}>
                <div className="ra-heat__grid" style={{ gridTemplateColumns: `minmax(120px, 1.4fr) repeat(${heatCols.length}, minmax(64px, 1fr))` }}>
                  <div className="ra-heat__h" />{heatCols.map((k) => <div key={k} className="ra-heat__h"><button type="button" className="rv-link" onClick={() => setSource(source === k ? null : k)}>{sname(k)}</button></div>)}
                  {heatRows.map((e) => (
                    <React.Fragment key={e.key}>
                      <div className="ra-heat__r"><button type="button" className="rv-link" onClick={() => { const p = regions.find((r) => r.keys.includes(e.key)); setIso(p ? p.iso : null); setEntity(e.key); }}>{name(e.key)}</button></div>
                      {heatCols.map((k) => { const c = heatCell(e, k); const on = entity === e.key && source === k; return (
                        <button key={k} type="button" className={`ra-heat__c${on ? ' is-on' : ''}`} style={{ background: c.color, color: c.neutral ? 'var(--heading, #111827)' : c.ratio != null && c.ratio >= 0.5 && c.ratio < 0.75 ? '#111827' : undefined }} title={`${name(e.key)} › ${sname(k)}: ${c.text}${c.title ? ` (${c.title})` : ''}`}
                          onClick={() => { const p = regions.find((r) => r.keys.includes(e.key)); setIso(p ? p.iso : null); setEntity(e.key); setSource(k); }}><span dir="ltr">{c.text}</span></button>); })}
                    </React.Fragment>))}
                </div>
              </div>
            </div>}

            {/* the analytic summary */}
            {panel === 'notes' && <div className="card st-card ra-notes" role="tabpanel" id="ra-panel-notes" aria-labelledby="ra-tab-notes">
              <b>{L('ملخص تحليلي من البيانات', 'Analytic summary from the data')}</b>
              <div className="muted" style={{ fontSize: 12 }}>{L('كل ملاحظة محسوبة من الأرقام أعلاه؛ لا تُنسب أسباب دون دليل، وما يحتاج فحصاً مذكور كذلك.', 'Every note is computed from the figures above; no reason is asserted without evidence, and what needs checking is said so.')}</div>
              <ul className="ra-notes__list">
                {notes.map((n) => (
                  <li key={n.id}>
                    <div>{ar ? n.ar : n.en}</div>
                    <div className="ra-notes__act">
                      <button type="button" className="btn btn-sm btn-ghost" aria-expanded={openNote === n.id} onClick={() => setOpenNote(openNote === n.id ? null : n.id)}>{openNote === n.id ? L('إخفاء الأرقام الداعمة', 'Hide supporting figures') : L('عرض الأرقام الداعمة', 'Show supporting figures')}</button>
                      {(n.focus.entity || n.focus.source) && <button type="button" className="btn btn-sm btn-ghost" onClick={() => pickDev({ entity: n.focus.entity, source: n.focus.source })}>{L('فتح في الخريطة والتفاصيل', 'Open in the map and details')}</button>}
                    </div>
                    {openNote === n.id && <table className="table ra-notes__ev"><tbody>{n.ev.map(([k, v], i) => <tr key={i}><td>{k}</td><td dir="ltr">{v}</td></tr>)}</tbody></table>}
                  </li>))}
              </ul>
            </div>}

            <div className="muted ra-limits" style={{ fontSize: 12 }}>
              <b>{L('حدود التحليل:', 'Limits of the analysis:')}</b>{' '}
              {L('المحصّل هنا على فواتير الفترة في تاريخ المرجع (تعريف اللوحة)، وهو غير «المدفوعات المستلمة» المستخدمة لنسبة تحقيق الاعتماد. لا مستهدفات لكل مصدر، لذا لا يُوزَّع الاعتماد عليها. الاعتماد مقابل الإيراد متوفر للعام المالي 2026 على مستوى الجهة فقط (أرقام توضيحية). البلديات بلا حدود جغرافية في البيانات فلا تُرسم. قطاع الإسكان و«غير محدد الأمانة» بلا منطقة فلا تظهران على الخريطة. المقارنة تعتمد فترتين متكافئتين زمنياً.', 'Collected here is on the period’s invoices at the reference date (the dashboard definition) and differs from the payments received used for the appropriation attainment. There are no per-source targets, so the appropriation is not split across them. The revenue appropriation exists for fiscal year 2026 at entity level only (illustrative figures). Municipalities have no boundaries in the data and are not drawn. The housing sector and Unassigned have no region and are not on the map. Comparisons use two periods of equal elapsed time.')}
              {A.checks.ok ? '' : ` ${L('تنبيه: إجماليات الجهات والمصادر لا تطابق المؤشرات الرئيسية.', 'Warning: entity and source totals do not match the headline indicators.')}`}
            </div>
          </>
        )}
      </AsyncBlock>
    </section>
  );
}
