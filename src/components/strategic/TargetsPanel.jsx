// «المستهدفات» — the FIRST section of the planning page: the targets a person sets for the year, per الأمانة / الجهة, next to what has been collected.
//   مستهدف نسبة التغطية × الميزانية المبلغة (الأبواب 1–3) = المستهدف السنوي للإيراد
//   مستهدف نسبة التحصيل (محصّل ÷ صافي المفوتر)   → مستهدف الفوترة = المستهدف ÷ نسبة التحصيل (مشتق، لا يُكتب)
// Only the coverage target and the collection-rate target are typed, so the three can never contradict each other. One unit (million riyals) in the table.
// Edits are saved on this device with «آخر تعديل» and re-run every figure and the map at once.
import React, { useState } from 'react';
import { setTargets, resetTargets, applyOverallCoverage, saveTargetStore, targetError } from '../../data/planTargets';
import { PctBadge } from './EntityMap';

const pct1 = (v) => (Number.isFinite(v) ? `${(v * 100).toFixed(1)}` : '');
const pct = (v) => (Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : '—');
const num = (e) => { const x = Number(String(e).replace(/[^\d.]/g, '')); return Number.isFinite(x) ? x : NaN; };
const mil = (v) => (Number.isFinite(v) && v !== 0 ? (v / 1e6).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—');
const milZ = (v) => (Number.isFinite(v) ? (v / 1e6).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—'); // a collected amount of zero is shown as 0, not as «no data»

function PctInput({ value, onCommit, label, disabled }) {
  const [text, setText] = useState(null);
  const shown = text ?? pct1(value);
  const commit = () => { if (text == null) return; const v = num(text); if (Number.isFinite(v)) onCommit(v / 100); setText(null); };
  return <input className="input tg-num" dir="ltr" inputMode="decimal" aria-label={label} disabled={disabled} value={shown} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />;
}

export default function TargetsPanel({ year, entityRows, store, setStore, selectedKey, total, canEdit, by, collectedByKey = {}, collectedTotal = 0, unassignedCollected = 0, L, ar, short, nameOf, dateText }) {
  const [overall, setOverall] = useState('');
  const [error, setError] = useState('');
  const commit = (next) => { setStore(next); saveTargetStore(next); setError(''); };
  const opts = { at: new Date().toISOString(), by };
  const ERR = { coverage: L('مستهدف التغطية رقم لا يقل عن صفر.', 'The coverage target must be a number, zero or more.'), collection_rate: L('نسبة التحصيل بين 0 و100%: لا يمكن تحصيل أكثر من صافي المفوتر.', 'The collection rate must be above 0 and at most 100%: more than the net billed cannot be collected.') };
  const set = (key, patch) => { const e = targetError(patch); if (e) { setError(ERR[e]); return; } commit(setTargets(store, year, key, patch, opts)); };
  const months = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(2000, i, 1)).toLocaleString(ar ? 'ar' : 'en', { month: 'short', timeZone: 'UTC' }));
  const editable = selectedKey !== 'all'; const t = editable ? entityRows.find((r) => r.key === selectedKey) : null;
  const sum = editable && t ? t : total; // the selection: one entity, or the Ministry
  const lastSaved = entityRows.map((r) => r.savedAt).filter(Boolean).sort().pop();
  const edited = entityRows.some((r) => r.source === 'saved');
  const withTarget = entityRows.filter((r) => r.revenueTarget > 0 || r.budget > 0).slice().sort((a, b) => b.revenueTarget - a.revenueTarget);
  const rowsShown = withTarget.filter((r) => r.revenueTarget > 0); const noRevenue = withTarget.filter((r) => !(r.revenueTarget > 0));
  const stat = (label_, value, sub) => <div className="tg-stat"><div className="tg-stat__l">{label_}</div><div className="tg-stat__v" dir="ltr">{value}</div><div className="tg-stat__s">{sub}</div></div>;

  return (
    <section className="card st-card tg-panel tg-top" id="targets" aria-label={L('المستهدفات', 'Targets')}>
      <div className="tg-head">
        <div>
          <h2 className="tg-title">{L('المستهدفات', 'Targets')} <span className="muted tg-title__sub">· {editable && t ? nameOf(selectedKey) : L('الوزارة (كل الجهات)', 'The Ministry (all entities)')} · {year}</span></h2>
          <div className="muted" style={{ fontSize: 12 }}>{edited ? <>{L('معدَّلة', 'Edited')} · {L('آخر تعديل', 'last edited')}: {lastSaved ? dateText(lastSaved.slice(0, 10)) : '—'}</> : L('افتراضية: تساوي الاعتماد مقابل الإيراد؛ لم يُعدَّل شيء بعد.', 'Default: equal to the revenue appropriation; nothing has been edited yet.')}</div>
        </div>
      </div>

      <div className="tg-stats">
        {stat(L('المستهدف السنوي للإيراد', 'Annual revenue target'), short(sum.revenueTarget), L('= مستهدف التغطية × الميزانية', '= coverage target × budget'))}
        {stat(L('مستهدف نسبة التغطية', 'Coverage target'), pct(sum.coverage), L(`الميزانية المبلغة ${short(sum.budget)}`, `communicated budget ${short(sum.budget)}`))}
        {stat(L('مستهدف نسبة التحصيل', 'Collection-rate target'), pct(sum.collectionRate), L('محصّل ÷ صافي المفوتر', 'collected ÷ net billed'))}
        {stat(L('مستهدف الفوترة', 'Billing target'), short(sum.billing), L('= المستهدف ÷ نسبة التحصيل', '= target ÷ collection rate'))}
      </div>

      {canEdit && (
        <div className="tg-overall">
          <label className="cg-field" htmlFor="tg-overall">{L('مستهدف تغطية واحد لكل الوزارة', 'One coverage target for the whole Ministry')}
            <span className="tg-inline"><input id="tg-overall" className="input tg-num" dir="ltr" inputMode="decimal" placeholder={pct1(total.coverage)} value={overall} onChange={(e) => setOverall(e.target.value)} /> %
              <button type="button" className="btn btn-sm" disabled={!(num(overall) >= 0)} onClick={() => { const v = num(overall); if (Number.isFinite(v)) { commit(applyOverallCoverage(store, year, v / 100, entityRows, opts)); setOverall(''); } }}>{L('تطبيق', 'Apply')}</button></span>
          </label>
          <div className="muted" style={{ fontSize: 12 }}>{L('يوزّع المستهدف على الجهات بنسبة مستهدفاتها الحالية. أو عدّل التغطية ونسبة التحصيل لأي جهة في الجدول.', 'Spreads the target over the entities in proportion to their current targets. Or edit the coverage and collection rate of any entity in the table.')}</div>
        </div>
      )}
      {!canEdit && <div className="muted" style={{ fontSize: 12 }}>{L('دورك للقراءة فقط: لا يمكنك تعديل المستهدفات.', 'Your role is read-only: you cannot edit targets.')}</div>}
      {error && <div className="rv-callout rv-callout--warn" role="alert">{error}</div>}

      <div className="st-table-wrap" tabIndex={0}>
        <table className="table tg-table" aria-label={L('المستهدفات والمحصّل لكل أمانة / جهة (مليون ريال)', 'Targets and collected by Amanah / entity (million SAR)')}>
          <caption className="muted" style={{ textAlign: 'start', fontSize: 12 }}>{L('المبالغ بمليون ريال. المحصّل حتى تاريخ التقرير بتاريخ الدفع. نسبة التحقق = المحصّل ÷ المستهدف السنوي. قد يختلف المجموع بمقدار 1 من تقريب الأرقام.', 'Amounts in million SAR. Collected to the reporting date, by payment date. Achievement = collected ÷ annual target. A total may differ by 1 from rounding.')}</caption>
          <thead><tr>
            <th>{L('الأمانة / الجهة', 'Amanah / entity')}</th><th>{L('الميزانية المبلغة', 'Budget')}</th><th>{L('مستهدف التغطية %', 'Coverage target %')}</th><th>{L('مستهدف الإيراد', 'Revenue target')}</th>
            <th>{L('مستهدف التحصيل %', 'Collection-rate target %')}</th><th>{L('مستهدف الفوترة', 'Billing target')}</th><th>{L('المحصّل حتى اليوم', 'Collected to date')}</th><th>{L('نسبة التحقق', 'Achievement')}</th>
          </tr></thead>
          <tbody>
            {rowsShown.map((r) => {
              const col = collectedByKey[r.key] || 0; const ach = r.revenueTarget > 0 ? col / r.revenueTarget : null;
              return (
                <tr key={r.key} className={selectedKey === r.key ? 'is-on' : undefined}>
                  <td>{nameOf(r.key)}{r.source === 'saved' && canEdit && <> <button type="button" className="rv-link" onClick={() => commit(resetTargets(store, year, r.key))}>{L('استعادة الافتراضي', 'Reset')}</button></>}</td>
                  <td dir="ltr" className="num">{mil(r.budget)}</td>
                  <td className="num"><PctInput value={r.coverage} label={`${L('مستهدف التغطية', 'Coverage target')} — ${nameOf(r.key)}`} disabled={!canEdit} onCommit={(v) => set(r.key, { coverage: v })} /></td>
                  <td dir="ltr" className="num">{mil(r.revenueTarget)}</td>
                  <td className="num"><PctInput value={r.collectionRate} label={`${L('مستهدف التحصيل', 'Collection-rate target')} — ${nameOf(r.key)}`} disabled={!canEdit} onCommit={(v) => set(r.key, { collectionRate: v })} /></td>
                  <td dir="ltr" className="num">{mil(r.billing)}</td>
                  <td dir="ltr" className="num">{milZ(col)}</td>
                  <td className="num">{ach == null ? '—' : <PctBadge kind="share" v={ach} text={pct(ach)} />}</td>
                </tr>
              );
            })}
            {noRevenue.map((r) => (
              <tr key={r.key} className="tg-row--muted">
                <td>{nameOf(r.key)}</td><td dir="ltr" className="num">{mil(r.budget)}</td><td colSpan={5} className="muted">{L('لا مستهدف إيراد (ميزانية فقط)', 'No revenue target (budget only)')}</td><td />
              </tr>
            ))}
            {unassignedCollected > 0 && (
              <tr className="tg-row--muted"><td>{L('غير محدد الأمانة', 'Unassigned')}</td><td /><td colSpan={5} className="muted">{L('مدفوعات لم تُطابق أمانة: بلا مستهدف', 'Payments not matched to an Amanah: no target')}</td><td dir="ltr" className="num">{mil(unassignedCollected)}</td></tr>
            )}
            <tr className="tg-row--total">
              <td>{L('إجمالي الوزارة', 'The Ministry')}</td><td dir="ltr" className="num">{mil(total.budget)}</td><td dir="ltr" className="num">{pct(total.coverage)}</td><td dir="ltr" className="num">{mil(total.revenueTarget)}</td>
              <td dir="ltr" className="num">{pct(total.collectionRate)}</td><td dir="ltr" className="num">{mil(total.billing)}</td><td dir="ltr" className="num">{milZ(collectedTotal)}</td>
              <td className="num">{total.revenueTarget > 0 ? <PctBadge kind="share" v={collectedTotal / total.revenueTarget} text={pct(collectedTotal / total.revenueTarget)} /> : '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <details className="tg-months">
        <summary><b>{L('التوزيع الشهري للمستهدف', 'Monthly split of the target')}{editable && t ? ` — ${nameOf(selectedKey)}` : ` — ${L('الوزارة', 'The Ministry')}`}</b></summary>
        {!editable && <div className="muted" style={{ fontSize: 12 }}>{L('اختر جهة من القائمة أعلاه لتعديل توزيعها الشهري؛ توزيع الوزارة هو مجموع الجهات.', 'Choose an entity above to edit its monthly split; the Ministry split is the sum of its entities.')}</div>}
        <div className="tg-grid">
          {months.map((mn, i) => {
            const w = (editable && t ? t.weights : total.weights)[i];
            return (
              <label key={mn} className="tg-cell">{mn}
                {editable && t
                  ? <span className="tg-inline"><PctInput value={w} label={`${L('وزن الشهر', 'Month weight')} ${mn}`} disabled={!canEdit} onCommit={(v) => { const ws = [...t.weights]; ws[i] = v; set(selectedKey, { weights: ws }); }} />%</span>
                  : <span dir="ltr">{pct1(w)}%</span>}
                <small className="muted" dir="ltr">{short((editable && t ? t.monthly : total.monthly)[i])}</small>
              </label>
            );
          })}
        </div>
        {editable && <div className="muted" style={{ fontSize: 12 }}>{L('تُعاد قيم الأشهر إلى مجموع 100% تلقائيًا عند الحفظ.', 'Month values are rescaled to total 100 % when saved.')}</div>}
      </details>
    </section>
  );
}
