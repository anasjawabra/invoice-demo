// Saved plan versions side by side. SAVED results (frozen when the version was saved) are never mixed with RECALCULATED results
// (the same scenario run on today's data): each figure carries its own label, and a recalculation is an explicit action.
import React, { useState } from 'react';
import { useAr } from '../../utils/useAr';
import { fmtMoney } from '../../utils/money';
import { fmtRiyadh, fmtRangeText } from '../../data/clock';
import { LEVERS } from './ScenarioPanel';

const pct = (v) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`);

export default function VersionCompare({ plan, versionContext, onRecompute }) {
  const { L, B, ar, lang } = useAr();
  const vs = plan.versions;
  const [a, setA] = useState(vs[0]?.version); const [b, setB] = useState(vs[1]?.version ?? vs[0]?.version);
  const [re, setRe] = useState({}); const [busy, setBusy] = useState('');
  if (vs.length < 1) return null;
  const va = vs.find((v) => v.version === a) || vs[0]; const vb = vs.find((v) => v.version === b) || vs[0];
  const recompute = async (v) => { setBusy(`v${v.version}`); try { const r = await onRecompute(v); setRe((x) => ({ ...x, [v.version]: r })); } finally { setBusy(''); } };
  const col = (v) => `v${v.version}`;
  const lever = (v, k) => (v.scenario?.[k] ?? '—');
  const money = (x) => (x == null ? '—' : fmtMoney(x, { lang }));
  const diff = (x, y) => JSON.stringify(x) !== JSON.stringify(y);
  const ctxLine = (v) => (v.context ? `${fmtRangeText(v.context.period.from, v.context.period.to, ar ? 'ar' : 'en')} · ${v.context.scope?.label || ''} · ${L('قطع البيانات', 'cut-off')} ${v.context.cutoff}` : L('لم يُحفظ سياق الاحتساب (إصدار قديم)', 'No calculation context was stored (older version)'));
  const Sel = ({ id, value, set, label }) => (<label htmlFor={id} className="rv-inline">{label}<select id={id} className="select" value={value} onChange={(e) => set(Number(e.target.value))}>{vs.map((v) => <option key={v.version} value={v.version}>{col(v)} · {fmtRiyadh(v.at)}</option>)}</select></label>);
  const Recalc = ({ v }) => {
    const r = re[v.version]; const saved = v.summary || {};
    return (
      <td>
        <button type="button" className="btn btn-sm" disabled={busy === col(v)} onClick={() => recompute(v)}>{busy === col(v) ? L('جارٍ الاحتساب…', 'Calculating…') : L('إعادة الاحتساب بالبيانات الحالية', 'Recalculate on current data')}</button>
        {r && <div className="rv-callout" role="status" style={{ marginTop: 6 }}><span className="st-tag st-tag--forecast">{L('محسوب الآن', 'recalculated now')}</span> {L('نسبة التحصيل', 'rate')} <b dir="ltr">{pct(r.rate)}</b> · {L('المحصّل', 'collected')} <b dir="ltr">{money(r.collected)}</b> · {L('قطع البيانات', 'cut-off')} {r.cutoff}
          <div className="muted" style={{ fontSize: 12 }}>{diff(saved.rate, r.rate) || diff(saved.collected, r.collected) ? L('تختلف عن المحفوظ: البيانات أو الإعداد تغيّرا منذ الحفظ.', 'Differs from the saved figures: the data or the configuration changed since saving.') : L('تطابق المحفوظ.', 'Matches the saved figures.')} {L('يُعاد احتساب النسبة والمحصّل فقط؛ الميزان التمويلي يبقى كما حُفظ.', 'Only the rate and collected are recalculated; the funding balance stays as saved.')}</div></div>}
      </td>
    );
  };
  return (
    <div className="card st-card" aria-label={L('مقارنة الإصدارات المحفوظة', 'Compare saved versions')}>
      <b>{L('مقارنة إصدارين محفوظين', 'Compare two saved versions')}</b>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><Sel id="vc-a" value={va.version} set={setA} label={L('الأول', 'First')} /><Sel id="vc-b" value={vb.version} set={setB} label={L('الثاني', 'Second')} /></div>
      <div className="st-table-wrap" tabIndex={0}>
        <table className="table"><caption className="sr-only">{L('مقارنة الإصدارين', 'Comparison of the two versions')}</caption>
          <thead><tr><th>{L('البند', 'Item')}</th><th>{col(va)}</th><th>{col(vb)}</th></tr></thead>
          <tbody>
            <tr><td>{L('السياق المحفوظ', 'Stored context')}</td><td>{ctxLine(va)}</td><td>{ctxLine(vb)}</td></tr>
            {LEVERS.map((lv) => (<tr key={lv.k} className={diff(lever(va, lv.k), lever(vb, lv.k)) ? 'rv-diff' : ''}><td>{B(lv)}</td><td dir="ltr">{lever(va, lv.k)}</td><td dir="ltr">{lever(vb, lv.k)}</td></tr>))}
            <tr><td colSpan={3}><span className="st-tag st-tag--actual">{L('نتائج محفوظة وقت الحفظ', 'saved results (frozen at save time)')}</span></td></tr>
            {[['rate', L('نسبة التحصيل (سيناريو)', 'Collection rate (scenario)'), pct], ['collected', L('المحصّل (سيناريو)', 'Collected (scenario)'), money], ['balance', L('الميزان التمويلي المتوقع', 'Projected funding balance'), money]].map(([k, label, f]) => (
              <tr key={k} className={diff(va.summary?.[k], vb.summary?.[k]) ? 'rv-diff' : ''}><td>{label}</td><td dir="ltr">{f(va.summary?.[k])}</td><td dir="ltr">{f(vb.summary?.[k])}</td></tr>
            ))}
            <tr><td>{L('إعادة الاحتساب', 'Recalculation')}</td><Recalc v={va} /><Recalc v={vb} /></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
