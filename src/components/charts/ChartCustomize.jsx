// «تخصيص» — the customize panel of one chart (collapsed until asked for). It edits a DRAFT config; the chart above it already shows the draft (through evaluateChart), the box «ما سيتغيّر» states
// what the draft changes in how the figures are presented, and «تطبيق» saves it into the view. Only the controls that evaluateChart accepts for THIS chart are offered (see customizeModel);
// a value the chart cannot take is shown disabled with its reason, and the controls that do not apply at all are listed once, collapsed, with the reason.
import React, { useMemo } from 'react';
import { customizeModel, withKey, changeLines, SAME_NUMBERS, pickText } from './chartPickerLogic';

const T = (lang, ar, en) => (lang === 'ar' ? ar : en);

function Seg({ ctl, lang, onPick, idp }) {
  const gid = `${idp}-${ctl.key}`;
  return (
    <div className="cc-ctl" role="group" aria-labelledby={`${gid}-l`}>
      <div className="cc-ctl__l" id={`${gid}-l`}>{pickText(ctl.label, lang)}</div>
      <div className="cc-seg">
        {ctl.options.map((o) => (
          <button key={String(o.value)} type="button" className={`cc-opt${o.current ? ' is-on' : ''}${o.enabled ? '' : ' is-off'}`} aria-pressed={!!o.current} aria-disabled={!o.enabled || undefined}
            aria-describedby={!o.enabled && o.why ? `${gid}-${String(o.value)}-w` : undefined} onClick={() => { if (o.enabled && !o.current) onPick(ctl.key, o.value); }}>
            {pickText(o.label, lang)}
          </button>
        ))}
      </div>
      {ctl.notes.length > 0 && (
        <ul className="cc-notes">{ctl.notes.map((n) => <li key={String(n.value)} id={`${gid}-${String(n.value)}-w`}><b>{pickText(n.label, lang)}:</b> {pickText(n.text, lang)}</li>)}</ul>
      )}
    </div>
  );
}

// props: { block, cfg (the draft), lang, dirty, onDraft(cfg), onApply(), onCancel(), onReset(), id }
export default function ChartCustomize({ block, cfg, lang, dirty, onDraft, onApply, onCancel, onReset, id }) {
  const m = useMemo(() => customizeModel(block, cfg, lang), [block, cfg, lang]);
  const pick = (key, value) => onDraft(withKey(cfg, key, value));
  const lines = changeLines(m.changes, lang);
  return (
    <div className="cc" id={id} role="region" aria-label={T(lang, 'تخصيص الرسم', 'Customize the chart')}>
      <div className="cc-grid">{m.controls.map((c) => <Seg key={c.key} ctl={c} lang={lang} onPick={pick} idp={`${id || 'cc'}`} />)}</div>
      {!m.ok && <p className="cc-warn" role="alert">{T(lang, 'هذا الاختيار غير مقبول لهذا الرسم؛ يبقى الرسم كما هو.', 'This combination is not accepted for this chart; it stays as it is.')}</p>}
      <div className="cp-change" role="group" aria-label={T(lang, 'ما سيتغيّر', 'What will change')}>
        <b>{T(lang, 'ما سيتغيّر', 'What will change')}</b>
        {!dirty ? <p>{T(lang, 'لا تغيير بعد.', 'Nothing changed yet.')}</p> : lines.length ? <ul>{lines.map((l, i) => <li key={`${l.key}${i}`}>{l.text}</li>)}</ul> : <p>{pickText(SAME_NUMBERS, lang)}</p>}
      </div>
      {m.notApplicable.length > 0 && (
        <details className="cc-na"><summary>{T(lang, 'خيارات لا تنطبق على هذا الرسم', 'Options that do not apply to this chart')} ({m.notApplicable.length})</summary>
          <ul>{m.notApplicable.map((n) => <li key={n.key}><b>{pickText(n.label, lang)}:</b> {pickText(n.reason, lang)}</li>)}</ul>
        </details>
      )}
      <div className="cc-foot">
        <button type="button" className="btn btn-sm btn-primary" disabled={!dirty || !m.ok} onClick={onApply}>{T(lang, 'تطبيق', 'Apply')}</button>
        <button type="button" className="btn btn-sm" onClick={onCancel}>{T(lang, 'إلغاء', 'Cancel')}</button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={onReset}>{T(lang, 'إعادة إلى الموصى به', 'Reset to recommended')}</button>
      </div>
    </div>
  );
}
