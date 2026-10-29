import { localize } from '../../utils/zh';
import { useI18n } from '../../context/I18nContext';
// «المستهدفات» — the FIRST section of the planning page: the targets a person sets for the year, per الأمانة / الجهة, next to what has been collected.
//   مستهدف نسبة التغطية × الميزانية المبلغة (الأبواب 1–3) = المستهدف السنوي للإيراد
//   مستهدف نسبة التحصيل (محصّل ÷ صافي المفوتر)   → مستهدف الفوترة = المستهدف ÷ نسبة التحصيل (مشتق، لا يُكتب)
// v3 (21 Oct): ONE overall coverage target and ONE overall collection-rate target (independent), an optional overall billing target; the per-Amanah values are an optional override (off by default).
//   الفوترة المطلوبة = المستهدف ÷ مستهدف نسبة التحصيل (derived); a typed مستهدف الفوترة below it is flagged. One unit (million riyals) in the table.
// Edits are saved on this device with «آخر تعديل» and re-run every figure and the map at once.
import React, { useState } from 'react';
import { setTargets, resetTargets, setOverall, setOverride, overallOf, overrideOn, billingCheck, saveTargetStore, targetError } from '../../data/planTargets';
import { PctBadge } from './EntityMap';

const pct1 = (v) => (Number.isFinite(v) ? `${(v * 100).toFixed(1)}` : '');
const pct = (v) => (Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : '—');
const num = (e) => { const x = Number(String(e).replace(/[^\d.]/g, '')); return Number.isFinite(x) ? x : NaN; };
const mil = (v) => (Number.isFinite(v) && v !== 0 ? (v / 1e6).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—');
const milZ = (v) => (Number.isFinite(v) ? (v / 1e6).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—'); // a collected amount of zero is shown as 0, not as «no data»

function PctInput({ value, onCommit, label, disabled, id }) {
  const [text, setText] = useState(null);
  const shown = text ?? pct1(value);
  const commit = () => { if (text == null) return; const v = num(text); if (Number.isFinite(v)) onCommit(v / 100); setText(null); };
  return <input id={id} className="input tg-num" dir="ltr" inputMode="decimal" aria-label={label} disabled={disabled} value={shown} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />;
}

function MilInput({ value, onCommit, label, id }) {
  const [text, setText] = useState(null);
  const shown = text ?? (Number.isFinite(value) && value > 0 ? String(Math.round(value / 1e6)) : '');
  const commit = () => { if (text == null) return; const t = text.trim(); if (t === '') onCommit(null); else { const v = num(t); if (Number.isFinite(v)) onCommit(v * 1e6); } setText(null); };
  return <input id={id} className="input tg-num" dir="ltr" inputMode="decimal" aria-label={label} value={shown} placeholder="—" onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />;
}

export default function TargetsPanel({ year, entityRows, store, setStore, selectedKey, total, canEdit, by, collectedByKey = {}, collectedTotal = 0, L, ar, short, nameOf, dateText }) {
  const { lang } = useI18n();
  const [error, setError] = useState('');
  const commit = (next) => { setStore(next); saveTargetStore(next); setError(''); };
  const opts = { at: new Date().toISOString(), by };
  const ERR = { coverage: L('مستهدف التغطية رقم لا يقل عن صفر.', 'The coverage target must be a number, zero or more.'), collection_rate: L('نسبة التحصيل بين 0 و100%: لا يمكن تحصيل أكثر من صافي المفوتر.', 'The collection rate must be above 0 and at most 100%: more than the net billed cannot be collected.') };
  const ov = overallOf(store, year); const on = overrideOn(store, year);
  const setO = (patch) => { const e = targetError(patch); if (e) { setError(ERR[e]); return; } commit(setOverall(store, year, patch, opts)); };
  const set = (key, patch) => { const e = targetError(patch); if (e) { setError(ERR[e]); return; } commit(setTargets(store, year, key, patch, opts)); };
  const months = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(2000, i, 1)).toLocaleString(lang, { month: 'short', timeZone: 'UTC' }));
  const editable = selectedKey !== 'all'; const t = editable ? entityRows.find((r) => r.key === selectedKey) : null;
  const sum = editable && t ? t : total; // the selection: one entity, or the Ministry
  const lastSaved = [...entityRows.map((r) => r.savedAt), ov.savedAt].filter(Boolean).sort().pop();
  const edited = ov.source === 'saved' || entityRows.some((r) => r.source === 'saved');
  const withTarget = entityRows.filter((r) => r.revenueTarget > 0 || r.budget > 0).slice().sort((a, b) => b.revenueTarget - a.revenueTarget);
  const rowsShown = withTarget.filter((r) => r.revenueTarget > 0); const noRevenue = withTarget.filter((r) => !(r.revenueTarget > 0));
  const bc = billingCheck(ov.billing, total.requiredBilling);
  const stat = (label_, value, sub) => <div className="tg-stat"><div className="tg-stat__l">{label_}</div><div className="tg-stat__v" dir="ltr">{value}</div><div className="tg-stat__s">{sub}</div></div>;

  return (
    <section className="card st-card tg-panel tg-top" id="targets" aria-label={L('المستهدفات', 'Targets')}>
      <div className="tg-head">
        <div>
          <h2 className="tg-title">{L('المستهدفات', 'Targets')} <span className="muted tg-title__sub">· {editable && t ? nameOf(selectedKey) : L('الوزارة (كل الجهات)', 'The Ministry (all entities)')} · {year}</span></h2>
          <div className="muted" style={{ fontSize: 12 }}>{edited ? <>{L('معدَّلة', 'Edited')} · {L('آخر تعديل', 'last edited')}: {lastSaved ? dateText(lastSaved.slice(0, 10)) : '—'}</> : L('افتراضية توضيحية: تغطية 66% وتحصيل 68%؛ لم يُعدَّل شيء بعد.', 'Illustrative defaults: coverage 66%, collection 68%; nothing has been edited yet.')}</div>
        </div>
      </div>

      <div className="tg-stats">
        {stat(L('المستهدف السنوي للإيراد', 'Annual revenue target'), short(sum.revenueTarget), L('= مستهدف التغطية × الميزانية', '= coverage target × budget'))}
        {stat(L('مستهدف نسبة التغطية', 'Coverage target'), pct(sum.coverage), L(`من الميزانية المبلغة للأبواب الثلاثة (${short(sum.budget)})`, `of the communicated budget of the three chapters (${short(sum.budget)})`))}
        {stat(L('مستهدف نسبة التحصيل', 'Collection-rate target'), pct(sum.collectionRate), L('محصّل ÷ صافي المفوتر', 'collected ÷ net billed'))}
        {stat(L('الفوترة المطلوبة', 'Required billing'), short(sum.requiredBilling), L('= المستهدف ÷ مستهدف نسبة التحصيل', '= target ÷ collection-rate target'))}
        {!editable && ov.billing != null && stat(L('مستهدف الفوترة', 'Billing target'), short(ov.billing), bc?.below ? <span className="rv-tag rv-tag--warn">{L(`أقل من المطلوب بمقدار ${short(Math.abs(bc.gap))}`, `below the required billing by ${short(Math.abs(bc.gap))}`)}</span> : L('يغطي الفوترة المطلوبة', 'covers the required billing'))}
      </div>

      {canEdit && (
        <div className="tg-overall" role="group" aria-label={L('المستهدفات العامة', 'Overall targets')}>
          <label className="cg-field" htmlFor="tg-ov-cov">{L('مستهدف نسبة التغطية (عام)', 'Coverage target (overall)')}
            <span className="tg-inline"><PctInput id="tg-ov-cov" value={ov.coverage} label={L('مستهدف نسبة التغطية (عام)', 'Coverage target (overall)')} onCommit={(v) => setO({ coverage: v })} /> %</span>
            <small className="muted">{L('من الميزانية المبلغة للأبواب الثلاثة', 'of the communicated budget of the three chapters')}</small>
          </label>
          <label className="cg-field" htmlFor="tg-ov-col">{L('مستهدف نسبة التحصيل (عام)', 'Collection-rate target (overall)')}
            <span className="tg-inline"><PctInput id="tg-ov-col" value={ov.collectionRate} label={L('مستهدف نسبة التحصيل (عام)', 'Collection-rate target (overall)')} onCommit={(v) => setO({ collectionRate: v })} /> %</span>
            <small className="muted">{L('مستقل عن مستهدف التغطية', 'independent of the coverage target')}</small>
          </label>
          <label className="cg-field" htmlFor="tg-ov-bill">{L('مستهدف الفوترة (عام، اختياري)', 'Billing target (overall, optional)')}
            <span className="tg-inline"><MilInput id="tg-ov-bill" value={ov.billing} label={L('مستهدف الفوترة (مليون ريال)', 'Billing target (million SAR)')} onCommit={(v) => setO({ billing: v })} /> {L('مليون ريال', 'million SAR')}</span>
            <small className="muted">{L('اتركه فارغًا إن لم يُحدَّد', 'leave blank when not set')}</small>
          </label>
          <div className="tg-inline">{ov.source === 'saved' && <button type="button" className="btn btn-sm btn-ghost" onClick={() => commit(setOverall(store, year, { coverage: null, collectionRate: null, billing: null }, opts))}>{L('استعادة الافتراضي (66% / 68%)', 'Reset to the defaults (66% / 68%)')}</button>}</div>
        </div>
      )}
      {bc && ov.billing != null && (
        <div className={`rv-callout${bc.below ? ' rv-callout--warn' : ''}`} role="status">
          {bc.below
            ? <><b>{L('مستهدف الفوترة أقل من الفوترة المطلوبة', 'The billing target is below the required billing')}</b> — {L(`مستهدف الفوترة ${short(ov.billing)} مقابل الفوترة المطلوبة ${short(total.requiredBilling)} (نقص ${short(Math.abs(bc.gap))}): لا يكفي لبلوغ مستهدف الإيراد عند نسبة تحصيل ${pct(total.collectionRate)}.`, `Billing target ${short(ov.billing)} against a required billing of ${short(total.requiredBilling)} (short by ${short(Math.abs(bc.gap))}): not enough to reach the revenue target at a collection rate of ${pct(total.collectionRate)}.`)}</>
            : L(`مستهدف الفوترة ${short(ov.billing)} يغطي الفوترة المطلوبة ${short(total.requiredBilling)}.`, `The billing target ${short(ov.billing)} covers the required billing ${short(total.requiredBilling)}.`)}
        </div>
      )}
      <details className="tg-months" open={on || undefined}>
        <summary><b>{L('تخصيص حسب الأمانة', 'Customise by Amanah')}</b> <span className="muted" style={{ fontSize: 12 }}>{on ? L('مفعّل', 'on') : L('مغلق (افتراضي)', 'off (default)')}</span></summary>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={on} disabled={!canEdit} onChange={(e) => commit(setOverride(store, year, e.target.checked))} />
          <span>{L('السماح بقيم خاصة لكل أمانة / جهة (تحلّ محل المستهدفات العامة)', 'Allow own values per Amanah / entity (they replace the overall targets)')}</span>
        </label>
        <div className="muted" style={{ fontSize: 12 }}>{L('عند الإغلاق تُطبَّق المستهدفات العامة على كل الأمانات: يُوزَّع مستهدف الوزارة (التغطية × الميزانية المبلغة) على الجهات بنسبة اعتمادات إيرادها، ونسبة التحصيل العامة على كلٍّ منها.', 'When off, the overall targets apply to every Amanah: the Ministry target (coverage × the communicated budget) is spread over the entities in proportion to their revenue appropriation, and the overall collection rate applies to each.')}</div>
      </details>
      {!canEdit && <div className="muted" style={{ fontSize: 12 }}>{L('دورك للقراءة فقط: لا يمكنك تعديل المستهدفات.', 'Your role is read-only: you cannot edit targets.')}</div>}
      {error && <div className="rv-callout rv-callout--warn" role="alert">{error}</div>}

      <div className="st-table-wrap" tabIndex={0}>
        <table className="table tg-table" aria-label={L('المستهدفات والمحصّل لكل أمانة / جهة (مليون ريال)', 'Targets and collected by Amanah / entity (million SAR)')}>
          <caption className="muted" style={{ textAlign: 'start', fontSize: 12 }}>{L('المبالغ بمليون ريال. المحصّل حتى تاريخ التقرير بتاريخ الدفع. نسبة التحقق = المحصّل ÷ المستهدف السنوي. قد يختلف المجموع بمقدار 1 من تقريب الأرقام.', 'Amounts in million SAR. Collected to the reporting date, by payment date. Achievement = collected ÷ annual target. A total may differ by 1 from rounding.')}</caption>
          <thead><tr>
            <th>{L('الأمانة / الجهة', 'Amanah / entity')}</th><th>{L('الميزانية المبلغة', 'Budget')}</th><th>{L('مستهدف التغطية %', 'Coverage target %')}</th><th>{L('مستهدف الإيراد', 'Revenue target')}</th>
            <th>{L('مستهدف التحصيل %', 'Collection-rate target %')}</th><th>{L('الفوترة المطلوبة', 'Required billing')}</th><th>{L('المحصّل حتى اليوم', 'Collected to date')}</th><th>{L('نسبة التحقق', 'Achievement')}</th>
          </tr></thead>
          <tbody>
            {rowsShown.map((r) => {
              const col = collectedByKey[r.key] || 0; const ach = r.revenueTarget > 0 ? col / r.revenueTarget : null;
              return (
                <tr key={r.key} className={selectedKey === r.key ? 'is-on' : undefined}>
                  <td>{nameOf(r.key)}{on && r.source === 'saved' && canEdit && <> <button type="button" className="rv-link" onClick={() => commit(resetTargets(store, year, r.key))}>{L('استعادة الافتراضي', 'Reset')}</button></>}</td>
                  <td dir="ltr" className="num">{mil(r.budget)}</td>
                  <td className="num"><PctInput value={r.coverage} label={`${L('مستهدف التغطية', 'Coverage target')} — ${nameOf(r.key)}`} disabled={!canEdit || !on} onCommit={(v) => set(r.key, { coverage: v })} /></td>
                  <td dir="ltr" className="num">{mil(r.revenueTarget)}</td>
                  <td className="num"><PctInput value={r.collectionRate} label={`${L('مستهدف التحصيل', 'Collection-rate target')} — ${nameOf(r.key)}`} disabled={!canEdit || !on} onCommit={(v) => set(r.key, { collectionRate: v })} /></td>
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
