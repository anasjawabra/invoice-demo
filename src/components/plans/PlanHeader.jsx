// The top of the ONE plan page (docs/revenue-plans-spec.md §10): the concise plan SELECTOR («خطط الإيرادات» — name · period · scope · owner · «افتراضية» / «الخطة الافتراضية للنظام · توضيحية», no performance figures, plus «خطة جديدة»),
// the HEADER (title · creation date · «حفظ الخطة» primary · «تعديل الخطة» · a ⋯ menu: «حفظ كخطة جديدة» · «تعيين كافتراضية» · «تعيين كافتراضية للنظام» (administrators) · «تعيين كخطة مرجعية للتقارير») and the «تغييرات غير محفوظة» bar of the working copy.
// No state chip, no version block, no status, no owner / last-editor / scope / period line, no approval wording anywhere.
import React, { useEffect, useRef, useState } from 'react';
import { useAr } from '../../utils/useAr';
import { fmtDateText } from '../../data/clock';
import PlanModal from './PlanModal';
import InfoTip from '../invoices/InfoTip';
import { pickL, userText, scopeText, periodText, entityNameOf, selectorRows, PERSONAL_DEFAULT, SYSTEM_DEFAULT, SYSTEM_PLAN, upcomingLabel, savedContentOf } from './planUi';
import { DEMO_TODAY } from '../../data/clock';

const dateOfIso = (iso, lang) => (iso ? fmtDateText(String(iso).slice(0, 10), lang) : '—');

/** the listbox of the selector: name · period · scope · owner and the default flags — NO performance figures */
export function PlanOptions({ rows, total = rows.length, selectedId, isNew, onPick, today = DEMO_TODAY }) {
  const { L, lang } = useAr();
  return (
    <ul className="pln-options" role="listbox" id="plan-options" aria-label={L('الخطط', 'Plans')}>
      {rows.map((r) => {
        const content = r.content; const sel = !isNew && r.plan.id === selectedId;
        return (
          <li key={r.plan.id} role="option" aria-selected={sel} data-plan={r.plan.id}>
            <button type="button" className={`pln-option${sel ? ' is-selected' : ''}`} onClick={() => onPick(r.plan.id)}>
              <span className="pln-option__name"><b>{r.name}</b>
                {r.flags.personal && <span className="pl-chip pl-chip--info" data-chip="personal-default">{pickL(PERSONAL_DEFAULT, lang)}</span>}
                {r.flags.global && <span className="pl-chip pl-chip--warn" data-chip="system-default">{pickL(SYSTEM_DEFAULT, lang)}</span>}
                {r.flags.illustrative && <span className="pl-chip pl-chip--plain" data-chip="system-plan">{pickL(SYSTEM_PLAN, lang)}</span>}
                {content.period?.start > today && <span className="pl-chip pl-chip--info" data-chip="upcoming">{pickL(upcomingLabel(content.period.start, (d) => fmtDateText(d, lang)), lang)}</span>}
                {sel && <span className="pl-chip pl-chip--plain">{L('المختارة', 'Selected')}</span>}</span>
              <span className="pl-sub2">{pickL(periodText(content.period, (d) => fmtDateText(d, lang)), lang)} · {pickL(scopeText(content.scope, entityNameOf), lang)}</span>
              <span className="pl-sub2">{L('المالك', 'Owner')}: {pickL(r.plan.isSystem && !r.plan.createdBy ? { ar: 'النظام', en: 'System' } : userText(r.plan.createdBy), lang)}</span>
            </button>
          </li>
        );
      })}
      {rows.length === 0 && <li className="rv-empty" role="presentation">{total ? L('لا خطط تطابق البحث.', 'No plans match the search.') : L('لا توجد خطط محفوظة بعد.', 'There are no saved plans yet.')}</li>}
    </ul>
  );
}

/** the plan selector: a button showing the selected plan that opens a searchable list (a dialog, so it works the same on a phone). */
export function PlanSelector({ plans, defaults, selectedId, selectedName, isNew, onSelect, onNew, canNew = true, newReason = null, today = DEMO_TODAY }) {
  const { L, lang } = useAr(); const [open, setOpen] = useState(false); const [q, setQ] = useState('');
  const rows = selectorRows(plans, defaults, { query: q, lang });
  const close = () => { setOpen(false); setQ(''); };
  return (
    <div className="pln-selector" id="plan-selector">
      <span className="pln-selector__label" id="plan-selector-label">{L('خطط الإيرادات', 'Revenue plans')}</span>
      <button type="button" className="btn pln-selector__btn" aria-haspopup="dialog" aria-expanded={open} aria-labelledby="plan-selector-label plan-selector-value" onClick={() => setOpen(true)}>
        <b id="plan-selector-value">{isNew ? L('خطة جديدة', 'New plan') : selectedName || '—'}</b><span aria-hidden="true">▾</span>
      </button>
      <button type="button" className="btn btn-sm" id="plan-new" onClick={onNew} disabled={!canNew} title={canNew ? undefined : pickL(newReason, lang)}>{L('خطة جديدة', 'New plan')}</button>
      {open && (
        <PlanModal title={L('خطط الإيرادات', 'Revenue plans')} subtitle={L('اختر خطة لتحميل إعداداتها المحفوظة وإعادة التحليل.', 'Choose a plan to load its saved configuration and re-run the analysis.')} onClose={close} size="md">
          <div className="pln-form">
            <input className="pln-input" type="search" data-autofocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('ابحث بالاسم أو المالك', 'Search by name or owner')} aria-label={L('بحث في الخطط', 'Search plans')} />
            <PlanOptions rows={rows} total={plans.length} selectedId={selectedId} isNew={isNew} today={today} onPick={(id) => { close(); onSelect(id); }} />
            <button type="button" className="btn btn-primary" onClick={() => { close(); onNew(); }} disabled={!canNew} title={canNew ? undefined : pickL(newReason, lang)}>{L('خطة جديدة', 'New plan')}</button>
          </div>
        </PlanModal>
      )}
    </div>
  );
}

function MoreMenu({ items }) {
  const { L } = useAr(); const [open, setOpen] = useState(false); const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', key); };
  }, [open]);
  return (
    <div className="pln-more" ref={ref}>
      <button type="button" className="btn" id="plan-more" aria-haspopup="menu" aria-expanded={open} aria-label={L('المزيد', 'More')} onClick={() => setOpen((o) => !o)}>⋯</button>
      {open && (
        <ul className="pln-menu" role="menu" id="plan-menu">
          {items.map((it) => (
            <li key={it.id} role="none"><button type="button" role="menuitem" className="pln-menu__item" id={`plan-menu-${it.id}`} disabled={it.disabled} onClick={() => { setOpen(false); it.run(); }}>{it.label}{it.disabled && it.reason && <span className="pl-sub2">{it.reason}</span>}</button></li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The compact header (docs/revenue-plans-spec.md §10): the plan TITLE, the plan's creation date beneath it (the immutable `createdAt` — editing never changes it) and the actions «حفظ الخطة» · «تعديل الخطة» · ⋯.
 * No owner, last editor, scope, period, status or explanatory paragraph here: scope and period live in the view-scope filter and the editor, the owner / last editor stay in the stored metadata. An unavailable action shows its
 * concise reason in an accessible help control (InfoTip) beside it.
 * props: name · plan (saved record | null) · isNew · saveGate { mode, reason } · editGate { allowed, reason } · dirty · busy · canReference · canSystemDefault (the ⋯ menu offers «تعيين كخطة افتراضية للنظام» — shown ONLY to the reference-plan authority) · isGlobalDefault · isPersonalDefault · onSave · onSaveAsNew · onEdit · onSetDefault · onSetReference · onSetSystemDefault
 */
export function PlanHeader({ name, plan, isNew, saveGate, editGate, dirty, busy, canReference, canSystemDefault = false, isGlobalDefault = false, isPersonalDefault, onSave, onSaveAsNew, onEdit, onSetDefault, onSetReference, onSetSystemDefault }) {
  const { L, lang } = useAr();
  const items = [
    { id: 'saveas', label: L('حفظ كخطة جديدة', 'Save as a new plan'), run: onSaveAsNew, disabled: saveGate.mode === 'none', reason: saveGate.mode === 'none' ? pickL(saveGate.reason, lang) : null },
    { id: 'default', label: isPersonalDefault ? L('خطتي الافتراضية الحالية', 'My current default plan') : L('تعيين كافتراضية', 'Set as my default'), run: onSetDefault, disabled: isNew || isPersonalDefault, reason: isNew ? L('احفظ الخطة أولاً', 'Save the plan first') : null },
    ...(canSystemDefault ? [{ id: 'sysdefault', label: isGlobalDefault ? L('الخطة الافتراضية الحالية للنظام', 'The current system default plan') : L('تعيين كخطة افتراضية للنظام', 'Set as the system default plan'), run: onSetSystemDefault, disabled: isNew || dirty || isGlobalDefault, reason: isNew ? L('احفظ الخطة أولاً', 'Save the plan first') : dirty ? L('احفظ التغييرات أولاً', 'Save the changes first') : null }] : []),
    ...(canReference ? [{ id: 'reference', label: L('تعيين كخطة مرجعية للتقارير', 'Set as the reference plan for reports'), run: onSetReference, disabled: isNew || dirty, reason: isNew ? L('احفظ الخطة أولاً', 'Save the plan first') : dirty ? L('احفظ التغييرات أولاً', 'Save the changes first') : null }] : [])
  ];
  const created = plan?.createdAt ? dateOfIso(plan.createdAt, lang) : null;
  const saveReason = saveGate.reason ? pickL(saveGate.reason, lang) : null; const editReason = !editGate.allowed && editGate.reason ? pickL(editGate.reason, lang) : null;
  return (
    <header className="card pl-section pln-header" id="plan-header">
      <div className="pln-header__top">
        <div className="pln-header__title">
          <h1 className="page-title" style={{ margin: 0 }} id="plan-title">{name || L('خطة جديدة', 'New plan')}</h1>
          {created && <div className="pln-created" id="plan-created">{L('تاريخ الإنشاء', 'Created')}: <time dateTime={String(plan.createdAt).slice(0, 10)}>{created}</time></div>}
        </div>
        <div className="pln-header__actions">
          <span className="pln-act">
            <button type="button" className="btn btn-primary" id="plan-save" onClick={onSave} disabled={saveGate.mode === 'none' || busy}>{busy ? L('جارٍ الحفظ…', 'Saving…') : L('حفظ الخطة', 'Save plan')}</button>
            {saveReason && <InfoTip label={saveReason}>{saveReason}</InfoTip>}
          </span>
          <span className="pln-act">
            <button type="button" className="btn" id="plan-edit" onClick={onEdit} disabled={!editGate.allowed}>{L('تعديل الخطة', 'Edit plan')}</button>
            {editReason && <InfoTip label={editReason}>{editReason}</InfoTip>}
          </span>
          <MoreMenu items={items} />
        </div>
      </div>
    </header>
  );
}

/** the bar of the working copy: the analysis below is a LIVE PREVIEW of the unsaved edits */
export function UnsavedBar({ isNew, onSave, onDiscard, busy, saveDisabled }) {
  const { L } = useAr();
  return (
    <div className="pln-unsaved" id="plan-unsaved" role="status">
      <span><b>{L('تغييرات غير محفوظة', 'Unsaved changes')}</b> — {isNew ? L('الخطة الجديدة لم تُحفظ؛ الأرقام أدناه معاينة حية لها.', 'The new plan is not saved; the figures below are a live preview of it.') : L('الأرقام أدناه معاينة حية للتعديلات؛ لم يُخزَّن شيء بعد.', 'The figures below are a live preview of your edits; nothing is stored yet.')}</span>
      <span className="pln-unsaved__act"><button type="button" className="btn btn-sm btn-primary" id="plan-unsaved-save" onClick={onSave} disabled={busy || saveDisabled}>{L('حفظ الخطة', 'Save plan')}</button><button type="button" className="btn btn-sm" id="plan-unsaved-discard" onClick={onDiscard} disabled={busy}>{L('تجاهل', 'Discard')}</button></span>
    </div>
  );
}

export { savedContentOf };
