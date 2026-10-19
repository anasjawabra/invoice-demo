// «المستهدفات» (IIM-14): the targets a person enters for the year — coverage, collection rate and billing per الأمانة / الجهة, and the split of the revenue target by month.
// Coverage target × the communicated budget (chapters 1–3) = the revenue target. Edits are saved on this device with «آخر تعديل» and re-run «أين نحن من الخطة» at once.
import React, { useState } from 'react';
import { setTargets, resetTargets, applyOverallCoverage, targetsOf, saveTargetStore } from '../../data/planTargets';

const pct1 = (v) => (Number.isFinite(v) ? `${(v * 100).toFixed(1)}` : '');
const num = (e) => { const x = Number(String(e).replace(/[^\d.]/g, '')); return Number.isFinite(x) ? x : NaN; };

function PctInput({ value, onCommit, label, disabled }) {
  const [text, setText] = useState(null);
  const shown = text ?? pct1(value);
  const commit = () => { if (text == null) return; const v = num(text); if (Number.isFinite(v) && v >= 0) onCommit(v / 100); setText(null); };
  return <input className="input tg-num" dir="ltr" inputMode="decimal" aria-label={label} disabled={disabled} value={shown} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />;
}

export default function TargetsPanel({ year, entityRows, store, setStore, selectedKey, selectedRow, total, canEdit, by, L, ar, short, nameOf, dateText, appropriationOf }) {
  const [overall, setOverall] = useState('');
  const commit = (next) => { setStore(next); saveTargetStore(next); };
  const opts = { at: new Date().toISOString(), by };
  const set = (key, patch) => commit(setTargets(store, year, key, patch, opts));
  const months = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(2000, i, 1)).toLocaleString(ar ? 'ar' : 'en', { month: 'short', timeZone: 'UTC' }));
  const editable = selectedKey !== 'all'; const t = editable ? selectedRow : null;
  const lastSaved = entityRows.map((r) => r.savedAt).filter(Boolean).sort().pop();

  return (
    <section className="card st-card tg-panel" aria-label={L('المستهدفات', 'Targets')}>
      <div className="tg-head">
        <b>{L('المستهدفات', 'Targets')}</b>
        <span className="muted" style={{ fontSize: 12 }}>{lastSaved ? `${L('آخر تعديل', 'Last edited')}: ${dateText(lastSaved.slice(0, 10))}` : L('لم تُعدَّل المستهدفات بعد: القيم الحالية افتراضية (تعادل الاعتماد مقابل الإيراد).', 'Not edited yet: the values are defaults (they equal the revenue appropriation).')}</span>
      </div>
      <div className="muted" style={{ fontSize: 13 }}>{L('مستهدف نسبة التغطية × الميزانية المبلغة للأبواب الثلاثة الأولى = المستهدف السنوي للإيراد. غيّر أي مستهدف في أي وقت (مثلًا بعد تعديل معتمد) فيُعاد حساب التقدير والاحتمالية والتوصيات فورًا.', 'Coverage target × the communicated budget of chapters 1–3 = the annual revenue target. Change any target at any time (for example after an approved change): the estimate, probability and recommendations are recalculated at once.')}</div>

      <div className="tg-overall">
        <label className="cg-field" htmlFor="tg-overall">{L('مستهدف نسبة التغطية للوزارة (إجمالي)', 'Coverage target for the Ministry (overall)')}
          <span className="tg-inline"><input id="tg-overall" className="input tg-num" dir="ltr" inputMode="decimal" placeholder={pct1(total.coverage)} value={overall} disabled={!canEdit} onChange={(e) => setOverall(e.target.value)} /> %
            <button type="button" className="btn btn-sm" disabled={!canEdit || !(num(overall) >= 0)} onClick={() => { const v = num(overall); if (Number.isFinite(v)) { commit(applyOverallCoverage(store, year, v / 100, entityRows, opts)); setOverall(''); } }}>{L('تطبيق', 'Apply')}</button></span>
        </label>
        <div className="tg-derived" role="status" aria-live="polite">
          <div>{L('الميزانية المبلغة (الأبواب 1–3)', 'Communicated budget (chapters 1–3)')}: <b dir="ltr">{short(total.budget)}</b></div>
          <div>{L('المستهدف السنوي للإيراد = التغطية × الميزانية', 'Annual revenue target = coverage × budget')}: <b dir="ltr">{short(total.revenueTarget)}</b> <span className="muted">({pct1(total.coverage)}%)</span></div>
        </div>
      </div>

      <div className="st-table-wrap" tabIndex={0}>
        <table className="table tg-table" aria-label={L('مستهدفات الأمانات والجهات', 'Targets by Amanah / entity')}>
          <thead><tr>
            <th>{L('الأمانة / الجهة', 'Amanah / entity')}</th><th>{L('الميزانية المبلغة', 'Budget')}</th><th>{L('مستهدف نسبة التغطية %', 'Coverage target %')}</th><th>{L('المستهدف المشتق', 'Derived target')}</th>
            <th>{L('مستهدف نسبة التحصيل %', 'Collection-rate target %')}</th><th>{L('مستهدف الفوترة (مليون)', 'Billing target (M)')}</th><th>{L('آخر تعديل', 'Last edited')}</th>
          </tr></thead>
          <tbody>
            {entityRows.map((r) => {
              const hasRev = r.budget > 0 && (r.revenueTarget > 0 || (appropriationOf(r.key)?.revAdjusted || 0) > 0);
              return (
                <tr key={r.key} className={selectedKey === r.key ? 'is-on' : undefined}>
                  <td>{nameOf(r.key)}</td>
                  <td dir="ltr" className="num">{short(r.budget)}</td>
                  <td className="num">{hasRev ? <PctInput value={r.coverage} label={`${L('مستهدف نسبة التغطية', 'Coverage target')} — ${nameOf(r.key)}`} disabled={!canEdit} onCommit={(v) => set(r.key, { coverage: v, billing: null })} /> : <span className="muted">—</span>}</td>
                  <td dir="ltr" className="num">{r.revenueTarget > 0 ? short(r.revenueTarget) : '—'}</td>
                  <td className="num">{hasRev ? <PctInput value={r.collectionRate} label={`${L('مستهدف نسبة التحصيل', 'Collection-rate target')} — ${nameOf(r.key)}`} disabled={!canEdit} onCommit={(v) => set(r.key, { collectionRate: v, billing: null })} /> : <span className="muted">—</span>}</td>
                  <td className="num">{hasRev ? <input className="input tg-num tg-wide" dir="ltr" inputMode="decimal" disabled={!canEdit} aria-label={`${L('مستهدف الفوترة', 'Billing target')} — ${nameOf(r.key)}`} defaultValue={Math.round(r.billing / 1e6)} key={`${r.key}-${Math.round(r.billing)}`} onBlur={(e) => { const v = num(e.target.value); if (Number.isFinite(v) && v >= 0 && Math.round(v) !== Math.round(r.billing / 1e6)) set(r.key, { billing: v * 1e6 }); }} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} /> : <span className="muted">—</span>}</td>
                  <td className="muted" style={{ fontSize: 12 }}>{r.savedAt ? dateText(r.savedAt.slice(0, 10)) : '—'}{r.source === 'saved' && canEdit && <> <button type="button" className="rv-link" onClick={() => commit(resetTargets(store, year, r.key))}>{L('استعادة الافتراضي', 'Reset')}</button></>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!canEdit && <div className="muted" style={{ fontSize: 12 }}>{L('دورك للقراءة فقط: لا يمكنك تعديل المستهدفات.', 'Your role is read-only: you cannot edit targets.')}</div>}

      <div className="tg-months">
        <b>{L('التوزيع الشهري للمستهدف', 'Monthly split of the target')}{editable ? ` — ${nameOf(selectedKey)}` : ` — ${L('الوزارة', 'The Ministry')}`}</b>
        {!editable && <div className="muted" style={{ fontSize: 12 }}>{L('اختر جهة من القائمة أعلاه لتعديل توزيعها الشهري؛ توزيع الوزارة هو مجموع الجهات.', 'Choose an entity above to edit its monthly split; the Ministry split is the sum of its entities.')}</div>}
        <div className="tg-grid">
          {months.map((mn, i) => {
            const w = (editable ? t.weights : total.weights)[i];
            return (
              <label key={mn} className="tg-cell">{mn}
                {editable
                  ? <span className="tg-inline"><PctInput value={w} label={`${L('وزن الشهر', 'Month weight')} ${mn}`} disabled={!canEdit} onCommit={(v) => { const ws = [...t.weights]; ws[i] = v; set(selectedKey, { weights: ws }); }} />%</span>
                  : <span dir="ltr">{pct1(w)}%</span>}
                <small className="muted" dir="ltr">{short((editable ? t.monthly : total.monthly)[i])}</small>
              </label>
            );
          })}
        </div>
        {editable && <div className="muted" style={{ fontSize: 12 }}>{L('تُعاد قيم الأشهر إلى مجموع 100% تلقائيًا عند الحفظ.', 'Month values are rescaled to total 100 % when saved.')}</div>}
      </div>
    </section>
  );
}
void targetsOf;
