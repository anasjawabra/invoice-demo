import React, { useState } from 'react';
import { AmountInput, Field, Notice } from './editorBits';
import { parseRate, setAdvanced } from './editorLogic';

/** «افتراضات متقدمة»: the collection-rate assumption and the billing target. They feed ONLY the billing-sufficiency factor — never the target, the allocation, the forecast or any headline measure. */
export default function TabAdvanced({ ctx }) {
  const { tx, content, update, canEdit, reason } = ctx;
  const dis = !canEdit; const adv = content.advanced || {};
  const [text, setText] = useState(null); const [bad, setBad] = useState(false);
  const shown = text ?? (adv.collectionRate != null ? String(Math.round(adv.collectionRate * 10000) / 100) : '');
  const commit = () => { if (text === null) return; const p = parseRate(text); if (p.invalid) { setBad(true); return; } setBad(false); setText(null); update((c) => setAdvanced(c, { collectionRate: p.rate })); };
  return (
    <div className="pe-tab">
      <Notice kind="info" title={tx('adv.noteTitle')}>{tx('adv.note')}</Notice>
      <Field label={tx('adv.collectionRate')} htmlFor="pe-rate" hint={tx('adv.collectionRateHint')} error={bad ? tx('adv.rateInvalid') : null}>
        <span className="pe-pct">
          <input id="pe-rate" className="input pe-pct__in" dir="ltr" inputMode="decimal" disabled={dis} title={dis ? reason : undefined} aria-invalid={bad ? 'true' : undefined} value={shown} placeholder="—"
            onChange={(e) => { setText(e.target.value); setBad(false); }} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }} />
          <span className="pe-pct__sign" aria-hidden="true">%</span>
        </span>
      </Field>
      <Field label={`${tx('adv.billingTarget')} (${tx('unit.million')})`} htmlFor="pe-billing" hint={tx('adv.billingTargetHint')}>
        <AmountInput id="pe-billing" value={adv.billingTarget ?? null} disabled={dis} disabledReason={reason} label={tx('adv.billingTarget')} onCommit={(v) => update((c) => setAdvanced(c, { billingTarget: v }))} />
      </Field>
    </div>
  );
}
