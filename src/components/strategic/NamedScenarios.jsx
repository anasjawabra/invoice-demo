// Named scenarios of the active plan (up to four): save the editor's levers under a name, rename, duplicate, delete (with confirmation) and
// compare them side by side with the actual baseline. They live apart from the plan's versions and from approved plans; none of these actions
// changes the plan, its status or its saved versions, and a saved scenario is never an approved one.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAr } from '../../utils/useAr';
import { fmtRiyadh } from '../../data/clock';
import { fmtMoney, unitOfValues } from '../../utils/money';
import { runScenario, scenarioBase, DEFAULT_SCENARIO } from '../../data/strategicCalc';
import { MAX_SCENARIOS, NAME_MAX, listScenarios, listScenarioLog, logScenario, addScenario, renameScenario, updateScenario, duplicateScenario, deleteScenario, changedLevers, cleanScenario } from '../../data/namedScenarios';
import { LEVERS } from './ScenarioPanel';

const ERRORS = {
  limit: { ar: `بلغت الحد الأقصى: ${MAX_SCENARIOS} سيناريوهات لكل خطة. احذف سيناريو أو حدّث أحدها.`, en: `Limit reached: ${MAX_SCENARIOS} scenarios per plan. Delete one or update an existing one.` },
  name_empty: { ar: 'أدخل اسماً للسيناريو.', en: 'Enter a name for the scenario.' },
  name_long: { ar: `الاسم أطول من ${NAME_MAX} حرفاً.`, en: `The name is longer than ${NAME_MAX} characters.` },
  name_dup: { ar: 'يوجد سيناريو بهذا الاسم في هذه الخطة؛ اختر اسماً مختلفاً.', en: 'A scenario with this name already exists in this plan; choose a different name.' },
  missing: { ar: 'السيناريو غير موجود.', en: 'The scenario no longer exists.' }
};

export default function NamedScenarios({ snapshot, targets, planId, planName, store, commit, commitWith, scenario, canEdit, by, onLoad }) {
  const { L, B, lang } = useAr();
  const [name, setName] = useState(''); const [renaming, setRenaming] = useState(null); const [renameTo, setRenameTo] = useState('');
  const [confirmDel, setConfirmDel] = useState(null); const [msg, setMsg] = useState(null);
  const nameRef = useRef(null); const list = listScenarios(store, planId);
  const focusSoon = (fn) => window.setTimeout(fn, 0);
  // the delete button is replaced by the confirmation: move focus to its first answer once it is on screen
  useEffect(() => { if (confirmDel) focusSoon(() => document.getElementById('ns-del-yes')?.focus()); }, [confirmDel]);
  const base = useMemo(() => scenarioBase(snapshot), [snapshot]);
  const rate = targets.collectionRate.value;
  const editorOn = JSON.stringify(cleanScenario(scenario)) !== JSON.stringify(DEFAULT_SCENARIO);
  const cols = useMemo(() => {
    const run = (sc) => runScenario(base, cleanScenario(sc), rate);
    return [
      { id: 'base', label: L('الأساس (فعلي)', 'Baseline (actual)'), kind: 'base', res: run(DEFAULT_SCENARIO) },
      ...list.map((s) => ({ id: s.id, label: s.name, kind: 'saved', res: run(s.scenario), levers: changedLevers(s.scenario) })),
      { id: 'editor', label: L('المحرر الحالي (غير محفوظ)', 'Current editor (unsaved)'), kind: 'editor', res: run(scenario), levers: changedLevers(scenario) }
    ];
  }, [base, rate, list, scenario, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const unit = unitOfValues(cols.flatMap((c) => [c.res.scenario.net, c.res.scenario.collected, c.res.scenario.uncollected]));
  const m = (v) => fmtMoney(v, { lang, unit }); const pct = (v) => (v == null ? L('غير متاحة', 'n/a') : `${(v * 100).toFixed(1)}%`);
  const leverText = (levers) => (levers.length ? levers.map(([k, v]) => { const lv = LEVERS.find((x) => x.k === k); return `${B(lv)} ${v > 0 ? '+' : ''}${v}${lv.unit === 'pp' ? L(' نقطة', ' pp') : '%'}`; }).join(' · ') : L('بلا تغيير عن الأساس', 'no change from the baseline'));
  // each action is computed on the current store, committed only when it succeeds, and reports its outcome in the status line
  const run = (fn) => { const r = fn(store); if (r.ok) commit(r.st); return r; };

  const save = (e) => {
    e.preventDefault(); if (!canEdit) return;
    const r = run((st) => addScenario(st, planId, { name, scenario, by }));
    if (!r.ok) { setMsg({ ok: false, text: B(ERRORS[r.error]) }); return; }
    setMsg({ ok: true, text: L(`حُفظ السيناريو «${name.trim()}». هو سيناريو غير معتمد ولا يغيّر الخطة ولا إصداراتها المحفوظة.`, `Saved scenario “${name.trim()}”. It is an unapproved scenario and changes neither the plan nor its saved versions.`) });
    setName('');
  };
  const doRename = (s) => {
    const r = run((st) => renameScenario(st, planId, s.id, renameTo, by));
    if (!r.ok) { setMsg({ ok: false, text: B(ERRORS[r.error]) }); return; }
    setMsg({ ok: true, text: L(`أُعيدت تسمية السيناريو إلى «${renameTo.trim()}».`, `Scenario renamed to “${renameTo.trim()}”.`) }); setRenaming(null);
    focusSoon(() => document.getElementById(`ns-rename-${s.id}`)?.focus());
  };
  const doDuplicate = (s) => {
    const r = run((st) => duplicateScenario(st, planId, s.id, by, L('نسخة من', 'Copy of')));
    setMsg(r.ok ? { ok: true, text: L('أُنشئت نسخة من السيناريو.', 'A copy of the scenario was created.') } : { ok: false, text: B(ERRORS[r.error] || ERRORS.missing) });
  };
  const doDelete = (s) => {
    run((st) => deleteScenario(st, planId, s.id, by)); setConfirmDel(null);
    setMsg({ ok: true, text: L(`حُذف السيناريو «${s.name}». لم تتغير الخطة ولا إصداراتها.`, `Deleted scenario “${s.name}”. The plan and its versions are unchanged.`) });
    focusSoon(() => nameRef.current?.focus());
  };
  const doUpdate = (s) => { run((st) => updateScenario(st, planId, s.id, { scenario }, by)); setMsg({ ok: true, text: L(`حُدّث «${s.name}» بقيم المحرر الحالية.`, `“${s.name}” now holds the values in the editor.`) }); };

  return (
    <div className="card st-card" id="named-scenarios" aria-label={L('السيناريوهات المسمّاة', 'Named scenarios')}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>{L('السيناريوهات المسمّاة', 'Named scenarios')}</h3>
        <span className="st-tag st-tag--scenario">{L('سيناريو — غير معتمد', 'Scenario — not approved')}</span>
        <span className="muted" style={{ fontSize: 13 }}>{L(`${list.length} من ${MAX_SCENARIOS}`, `${list.length} of ${MAX_SCENARIOS}`)} · {planName}</span>
      </div>
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>{L('تُحفظ هنا منفصلة عن الخطة المعتمدة وإصداراتها المحفوظة وعن البيانات الفعلية. حفظ سيناريو أو تعديله أو حذفه لا يعني اعتماده ولا يغيّر الخطة.', 'Kept apart from the approved plan, its saved versions and the actual data. Saving, editing or deleting a scenario does not mean it is approved and does not change the plan.')}</p>

      <form onSubmit={save} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
        <div className="st-field" style={{ flex: '1 1 240px', margin: 0 }}>
          <label htmlFor="ns-name">{L('اسم السيناريو', 'Scenario name')}</label>
          <input id="ns-name" ref={nameRef} className="input" maxLength={NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit || list.length >= MAX_SCENARIOS} placeholder={L('مثال: تحسّن التحصيل', 'e.g. Better collection')} />
        </div>
        <button type="submit" className="btn btn-sm btn-primary" disabled={!canEdit || list.length >= MAX_SCENARIOS || !name.trim()}>{L('حفظ قيم المحرر كسيناريو', 'Save the editor values as a scenario')}</button>
      </form>
      {!canEdit && <div className="muted" style={{ fontSize: 12 }}>{L('يتطلب صلاحية المراجعة.', 'Requires review permission.')}</div>}
      {list.length >= MAX_SCENARIOS && <div className="muted" style={{ fontSize: 12 }}>{B(ERRORS.limit)}</div>}
      {!editorOn && list.length < MAX_SCENARIOS && <div className="muted" style={{ fontSize: 12 }}>{L('المحرر عند القيم الافتراضية؛ يمكنك حفظه كما هو أو تعديل الرافعات أولاً.', 'The editor is at its defaults; save it as is or change the levers first.')}</div>}
      <div role="status" style={{ fontSize: 13, minHeight: msg ? undefined : 0 }}>{msg && <span className={msg.ok ? '' : 'rv-callout rv-callout--bad'}>{msg.text}</span>}</div>

      {list.length === 0 ? <div className="rv-empty">{L('لا توجد سيناريوهات محفوظة لهذه الخطة بعد.', 'No scenarios are saved for this plan yet.')}</div> : (
        <ul className="res__list res__list--plain" style={{ display: 'grid', gap: 10, margin: 0, padding: 0, listStyle: 'none' }}>
          {list.map((s) => (
            <li key={s.id} className="card" style={{ padding: 12, display: 'grid', gap: 6 }}>
              {renaming === s.id ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
                  <div className="st-field" style={{ flex: '1 1 220px', margin: 0 }}><label htmlFor={`ns-rn-${s.id}`}>{L('الاسم الجديد', 'New name')}</label><input id={`ns-rn-${s.id}`} className="input" maxLength={NAME_MAX} value={renameTo} autoFocus onChange={(e) => setRenameTo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); doRename(s); } if (e.key === 'Escape') { setRenaming(null); focusSoon(() => document.getElementById(`ns-rename-${s.id}`)?.focus()); } }} /></div>
                  <button type="button" className="btn btn-sm btn-primary" disabled={!renameTo.trim()} onClick={() => doRename(s)}>{L('حفظ الاسم', 'Save name')}</button>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setRenaming(null); focusSoon(() => document.getElementById(`ns-rename-${s.id}`)?.focus()); }}>{L('إلغاء', 'Cancel')}</button>
                </div>
              ) : <div><b>{s.name}</b> <span className="st-tag st-tag--scenario">{L('غير معتمد', 'not approved')}</span></div>}
              <div className="muted" style={{ fontSize: 13 }}>{leverText(changedLevers(s.scenario))}</div>
              <div className="muted" style={{ fontSize: 12 }}>{L('آخر تحديث', 'Last updated')}: {fmtRiyadh(s.updatedAt)} · {s.updatedBy}</div>
              {confirmDel === s.id ? (
                <div className="rv-callout rv-callout--warn" role="alert" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setConfirmDel(null); focusSoon(() => document.getElementById(`ns-del-${s.id}`)?.focus()); } }}>
                  <span>{L(`حذف السيناريو «${s.name}» نهائياً؟ لا يمكن التراجع، ولا يتأثر شيء آخر.`, `Delete the scenario “${s.name}” permanently? This cannot be undone and nothing else is affected.`)}</span>
                  <button type="button" id="ns-del-yes" className="btn btn-sm btn-primary" onClick={() => doDelete(s)}>{L('نعم، احذف', 'Yes, delete')}</button>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setConfirmDel(null); focusSoon(() => document.getElementById(`ns-del-${s.id}`)?.focus()); }}>{L('إلغاء', 'Cancel')}</button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-sm" onClick={() => { onLoad(s); commitWith((st) => logScenario(st, planId, { action: 'loaded_in_editor', scenarioId: s.id, name: s.name, by })); setMsg({ ok: true, text: L(`حُمّل «${s.name}» في المحرر. تعديل المحرر يعيد الخطة المعتمدة إلى مسودة (الإصدار المحفوظ لا يتغير).`, `“${s.name}” was loaded into the editor. Editing the editor returns an approved plan to draft (the saved version does not change).`) }); }} disabled={!canEdit}>{L('تحميل في المحرر', 'Load in the editor')}</button>
                  <button type="button" className="btn btn-sm" onClick={() => doUpdate(s)} disabled={!canEdit}>{L('تحديث بقيم المحرر', 'Update from the editor')}</button>
                  <button type="button" id={`ns-rename-${s.id}`} className="btn btn-sm" onClick={() => { setRenaming(s.id); setRenameTo(s.name); }} disabled={!canEdit}>{L('إعادة تسمية', 'Rename')}</button>
                  <button type="button" className="btn btn-sm" onClick={() => doDuplicate(s)} disabled={!canEdit || list.length >= MAX_SCENARIOS}>{L('تكرار', 'Duplicate')}</button>
                  <button type="button" id={`ns-del-${s.id}`} className="btn btn-sm btn-ghost" onClick={() => setConfirmDel(s.id)} disabled={!canEdit}>{L('حذف', 'Delete')}</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {(() => {
        const log = listScenarioLog(store, planId); const A = { created: L('أُنشئ', 'created'), renamed: L('أُعيدت تسميته', 'renamed'), levers_updated: L('حُدّثت رافعاته', 'levers updated'), deleted: L('حُذف', 'deleted'), loaded_in_editor: L('حُمّل في المحرر', 'loaded in the editor') };
        return (
          <details className="rv-more" id="scenario-log"><summary>{L(`سجل السيناريوهات (${log.length}) — منفصل عن سجل الخطة`, `Scenario history (${log.length}) — separate from the plan's history`)}</summary>
            {log.length === 0 ? <div className="muted" style={{ fontSize: 13 }}>{L('لا أحداث بعد.', 'No events yet.')}</div> : <ul className="res__list res__list--plain" style={{ fontSize: 12 }}>{log.slice(0, 40).map((e, i) => <li key={i}>{fmtRiyadh(e.at)} · {e.by || '—'} · «{e.name}» {A[e.action] || e.action}{e.action === 'renamed' && e.detail?.from ? ` ← «${e.detail.from}»` : ''}</li>)}</ul>}
            <div className="muted" style={{ fontSize: 12 }}>{L('تسجيل السيناريو أو تعديله لا يكتب شيئاً في الخطة ولا في إصداراتها ولا في حالتها.', 'Scenario events never write into the plan, its versions or its status.')}</div>
          </details>
        );
      })()}
      <h3 style={{ margin: '4px 0 0', fontSize: 15 }}>{L('المقارنة جنباً إلى جنب', 'Side-by-side comparison')}</h3>
      <div className="st-table-wrap" tabIndex={0}>
        <table className="table" aria-label={L('مقارنة السيناريوهات المسمّاة بالأساس', 'Named scenarios compared with the baseline')}>
          <thead><tr><th scope="col">{L('المؤشر', 'Measure')}</th>{cols.map((c) => <th scope="col" key={c.id}>{c.label}{c.kind !== 'base' && <div><span className="st-tag st-tag--scenario">{L('سيناريو — غير معتمد', 'scenario — not approved')}</span></div>}</th>)}</tr></thead>
          <tbody>
            <tr><th scope="row">{L('الرافعات المغيّرة', 'Levers changed')}</th>{cols.map((c) => <td key={c.id} style={{ fontSize: 12 }}>{c.kind === 'base' ? L('— (البيانات الفعلية)', '— (actual data)') : leverText(c.levers)}</td>)}</tr>
            <tr><th scope="row">{L('صافي المفوتر', 'Net billed')}</th>{cols.map((c) => <td key={c.id} dir="ltr">{m(c.res.scenario.net)}</td>)}</tr>
            <tr><th scope="row">{L('المحصّل', 'Collected')}</th>{cols.map((c) => <td key={c.id} dir="ltr">{m(c.res.scenario.collected)}</td>)}</tr>
            <tr><th scope="row">{L('غير المحصّل', 'Uncollected')}</th>{cols.map((c) => <td key={c.id} dir="ltr">{m(c.res.scenario.uncollected)}</td>)}</tr>
            <tr><th scope="row">{L('نسبة التحصيل', 'Collection rate')}</th>{cols.map((c) => <td key={c.id} dir="ltr">{pct(c.res.scenario.rate)}</td>)}</tr>
            <tr><th scope="row">{L('الفرق في المحصّل عن الأساس', 'Collected vs baseline')}</th>{cols.map((c) => <td key={c.id} dir="ltr">{c.kind === 'base' ? '—' : `${c.res.deltaCollected >= 0 ? '+' : ''}${m(c.res.deltaCollected)}`}</td>)}</tr>
            <tr><th scope="row">{L('المتبقي لبلوغ المستهدف التجريبي', 'Remaining to the demo target')}</th>{cols.map((c) => <td key={c.id} dir="ltr">{c.res.target ? m(c.kind === 'base' ? c.res.target.baselineGap : c.res.target.scenarioGap) : L('غير متاحة', 'n/a')}</td>)}</tr>
          </tbody>
        </table>
      </div>
      <div className="muted" style={{ fontSize: 12 }}>{L(`كل مبلغ مكتوب مع وحدته. الفترة: ${snapshot.scope.from} → ${snapshot.scope.to}. المستهدف التجريبي غير معتمد. كل الأعمدة محسوبة بالطريقة نفسها على بيانات الفترة نفسها.`, `Every amount is written with its unit. Period: ${snapshot.scope.from} → ${snapshot.scope.to}. The demo target is not approved. Every column is computed the same way on the same period's data.`)}</div>
    </div>
  );
}
