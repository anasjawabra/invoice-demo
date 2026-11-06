import React from 'react';
import { AmountInput, Chip, Icon, Notice } from './editorBits';
import { allocationTableModel, barStatus, entityName, milText, referenceDifference, riyalText, shareText } from './editorLogic';

/** the allocated / unallocated / excess bar — the three parts are written in TEXT (amount + share) and also coloured; the bar itself is decorative (aria-hidden), the legend carries the meaning */
export function AllocBar({ b, tx, lang, unallocatedLabel, scopeLabel }) {
  if (!b) return null;
  const total = Math.max(b.target || 0, b.allocated || 0) || 1; const within = Math.min(b.allocated, b.target || 0);
  const w = (x) => ({ inlineSize: `${((x / total) * 100).toFixed(2)}%` });
  const share = (x) => (b.target > 0 ? shareText(x / b.target) : '—');
  const unit = tx('unit.million');
  const status = barStatus(b);
  return (
    <div className="pe-allocbar">
      <div className="pe-allocbar__top">
        <Chip kind={status === 'complete' ? 'ok' : status === 'excess' ? 'bad' : 'warn'}>
          {status === 'complete' ? <><Icon name="check" size={13} /> {tx('alloc.complete')}</>
            : status === 'excess' ? <>{tx('alloc.chipExcess', { value: `${milText(b.excess)} ${unit}` })}</>
              : status === 'no_target' ? tx('alloc.noTarget')
                : <>{unallocatedLabel ? `${unallocatedLabel} ${milText(b.unallocated)} ${unit}` : tx('alloc.chipUnallocated', { value: `${milText(b.unallocated)} ${unit}` })}</>}
        </Chip>
        {scopeLabel && <span className="pe-note">{scopeLabel}</span>}
      </div>
      <div className="pe-bar" aria-hidden="true">
        <span className="pe-bar__seg pe-bar__seg--alloc" style={w(within)} />
        {b.excess > 0 && <span className="pe-bar__seg pe-bar__seg--excess" style={w(b.excess)} />}
        {b.unallocated > 0 && <span className="pe-bar__seg pe-bar__seg--free" style={w(b.unallocated)} />}
      </div>
      <ul className="pe-legend">
        <li><span className="pe-dot pe-dot--alloc" aria-hidden="true" />{tx('alloc.legendAllocated')}: <b dir="ltr" title={riyalText(b.allocated, lang)}>{milText(b.allocated)}</b> {unit} · {share(b.allocated)}</li>
        <li><span className="pe-dot pe-dot--free" aria-hidden="true" />{unallocatedLabel || tx('alloc.legendUnallocated')}: <b dir="ltr" title={riyalText(b.unallocated, lang)}>{milText(b.unallocated)}</b> {unit} · {share(b.unallocated)}</li>
        <li><span className="pe-dot pe-dot--excess" aria-hidden="true" />{tx('alloc.legendExcess')}: <b dir="ltr" title={riyalText(b.excess, lang)}>{milText(b.excess)}</b> {unit} · {share(b.excess)}</li>
      </ul>
    </div>
  );
}

const ORIGIN = (tx, o) => (o ? tx(`origin.${o}`) : '—');

/**
 * «التخصيص» — ONE table that follows the page's view scope: Ministry / all → the plan's Amanahs / entities; a specific Amanah with municipalities → ONLY that Amanah's authorised municipalities («تخصيص المستهدف حسب البلدية»),
 * the Amanah's amount read-only and the reconciliation Σ municipal + «غير موزع على البلديات» = the Amanah's target; an Amanah without municipalities keeps its own row. Switching the view scope never edits the plan.
 */
export default function TabAllocation({ ctx }) {
  const { tx, lang, content, baseContent, update, canEdit, reason, access, viewScope, openPreview, referenceView, plan, edits } = ctx;
  const m = allocationTableModel({ content, baseContent, viewScope, geoScope: access.geoScope, lang });
  const dis = !canEdit; const why = dis ? reason : undefined; const unit = tx('unit.million');
  const diff = m.mode === 'entities' ? referenceDifference({ plan, content, referenceView }) : null;

  if (m.mode === 'municipalities') {
    const r = m.reconcile; const a = m.amanah;
    const bar = r ? { target: r.amanahAmount, allocated: r.allocated, unallocated: r.unallocated, excess: r.excess, hasTarget: r.amanahAmount > 0, complete: r.complete } : null;
    return (
      <div className="pe-tab">
        <h3 className="pe-h3" id="pe-alloc-h">{tx(m.titleKey)}</h3>
        <p className="pe-note">{tx('alloc.muniIntro', { amanah: a.name })}</p>
        {a.hidden ? <Notice kind="info">{tx('alloc.amanahHidden')}</Notice> : (
          <>
            <dl className="pe-recon" aria-label={tx('alloc.reconTitle')}>
              <div><dt>{tx('alloc.amanahTarget', { amanah: a.name })} <Chip kind="muted"><Icon name="lock" size={12} /> {tx('alloc.readOnlyHere')}</Chip></dt><dd dir="ltr" title={riyalText(r.amanahAmount, lang)}>{milText(r.amanahAmount)} {unit}</dd></div>
              <div><dt>{tx('alloc.muniSum')}</dt><dd dir="ltr" title={riyalText(r.allocated, lang)}>{milText(r.allocated)} {unit}</dd></div>
              <div><dt>{r.excess > 0 ? tx('alloc.legendExcess') : tx('alloc.muniUnallocated')}</dt><dd dir="ltr" title={riyalText(r.excess > 0 ? r.excess : r.unallocated, lang)}>{r.excess > 0 ? '+' : ''}{milText(r.excess > 0 ? r.excess : r.unallocated)} {unit}</dd></div>
            </dl>
            <p className="pe-recon__eq">{r.excess > 0 ? tx('alloc.reconExcess', { sum: milText(r.allocated), excess: milText(r.excess), amanah: milText(r.amanahAmount) }) : tx('alloc.reconEq', { sum: milText(r.allocated), rest: milText(r.unallocated), amanah: milText(r.amanahAmount) })}</p>
            {!a.hasAllocation && <Notice kind="warn">{tx('alloc.noAmanahAllocation', { amanah: a.name })}</Notice>}
            <AllocBar b={bar} tx={tx} lang={lang} unallocatedLabel={tx('alloc.muniUnallocated')} scopeLabel={tx('alloc.muniStatusScope')} />
            <div className="pe-actions">
              <button type="button" className="btn btn-sm" disabled={dis || !a.hasAllocation} title={dis ? why : !a.hasAllocation ? tx('alloc.noAmanahAllocation', { amanah: a.name }) : undefined} onClick={() => openPreview('municipal_remainder', { entityKey: m.entityKey })}>{tx('alloc.btnMuniRemainder')}</button>
            </div>
          </>
        )}
        <div className="pe-tablewrap">
          <table className="pe-table pe-table--stack">
            <caption className="sr-only">{tx(m.titleKey)}</caption>
            <thead><tr><th scope="col">{tx('alloc.colMuni')}</th><th scope="col">{tx('alloc.colAmount')} ({unit})</th><th scope="col">{tx('alloc.colShareOfAmanah')}</th><th scope="col">{tx('alloc.colOrigin')}</th><th scope="col"><span className="sr-only">{tx('common.actions')}</span></th></tr></thead>
            <tbody>
              {m.rows.map((row) => (
                <tr key={row.muniId} className={row.highlight ? 'is-highlight' : undefined} aria-current={row.highlight ? 'true' : undefined}>
                  <th scope="row" data-label={tx('alloc.colMuni')}>{row.name}{row.highlight && <Chip kind="info">{tx('alloc.filterMuni')}</Chip>}{row.changed && <Chip kind="warn" title={row.baseAmount == null ? tx('alloc.savedNone') : tx('alloc.savedWas', { value: milText(row.baseAmount) })}>{tx('alloc.changed')}</Chip>}</th>
                  <td data-label={`${tx('alloc.colAmount')} (${unit})`}>
                    <AmountInput compact id={`pe-m-${row.muniId}`} value={row.amount} disabled={dis} disabledReason={why} label={`${row.name} — ${tx('alloc.colAmount')}`} onCommit={(v) => edits.setMuni(m.entityKey, row.muniId, v)} />
                    {!row.hasTarget && <div className="pe-notarget">{tx('alloc.noMuniTarget')}</div>}
                  </td>
                  <td data-label={tx('alloc.colShareOfAmanah')} dir="ltr">{row.hasTarget ? shareText(row.share) : '—'}</td>
                  <td data-label={tx('alloc.colOrigin')}>{ORIGIN(tx, row.origin)}</td>
                  <td className="pe-td-act">{row.hasTarget && <button type="button" className="pe-iconbtn" disabled={dis} title={why || tx('alloc.clearRow')} aria-label={`${tx('alloc.clearRow')}: ${row.name}`} onClick={() => edits.setMuni(m.entityKey, row.muniId, null)}><Icon name="close" size={15} /></button>}</td>
                </tr>
              ))}
              {r && (
                <tr className="pe-tr-sum">
                  <th scope="row" data-label={tx('alloc.colMuni')}>{r.excess > 0 ? tx('alloc.legendExcess') : tx('alloc.muniUnallocated')}</th>
                  <td data-label={`${tx('alloc.colAmount')} (${unit})`} dir="ltr">{r.excess > 0 ? '+' : ''}{milText(r.excess > 0 ? r.excess : r.unallocated)}</td>
                  <td data-label={tx('alloc.colShareOfAmanah')} dir="ltr">{r.amanahAmount > 0 ? shareText((r.excess > 0 ? r.excess : r.unallocated) / r.amanahAmount) : '—'}</td>
                  <td data-label={tx('alloc.colOrigin')}>—</td><td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="pe-note">{tx('alloc.muniKeep')}</p>
      </div>
    );
  }

  const b = m.bar;
  const bl = content.baseline && Array.isArray(content.baseline.entities) ? content.baseline : null; // a DERIVED plan: the frozen baseline per entity, read-only
  const blRow = (k) => (bl ? bl.entities.find((e) => e.entityKey === k) || null : null);
  const blCell = (k, f) => { const r = blRow(k); return r ? milText(r[f]) : '—'; };
  return (
    <div className="pe-tab">
      <h3 className="pe-h3" id="pe-alloc-h">{tx(m.titleKey)}</h3>
      <p className="pe-note">{tx('alloc.entityIntro')}</p>
      {bl && <Notice kind="info" title={tx('alloc.derivedTitle')}>{tx('alloc.derivedNote', { cutoff: bl.cutoff })}</Notice>}
      {m.notice === 'amanah_outside_scope' && <Notice kind="warn">{tx('alloc.amanahOutside')}</Notice>}
      {m.single && <Notice kind="info">{m.muniHint ? tx('alloc.noMunicipalities') : tx('alloc.singleNote')}</Notice>}
      {m.masked ? <Notice kind="info" title={tx('alloc.maskedTitle')}>{tx('alloc.maskedNote')}</Notice> : <AllocBar b={b} tx={tx} lang={lang} />}
      <div className="pe-actions">
        <button type="button" className="btn btn-sm" disabled={dis || m.masked} title={why} onClick={() => openPreview('entity_remainder')}>{tx('alloc.btnRemainder')}</button>
        <button type="button" className="btn btn-sm" disabled={dis || m.masked} title={why} onClick={() => openPreview('entity_all')}>{tx('alloc.btnAll')}</button>
      </div>
      <div className="pe-tablewrap">
        <table className="pe-table pe-table--stack">
          <caption className="sr-only">{tx(m.titleKey)}</caption>
          <thead><tr><th scope="col">{tx('alloc.colEntity')}</th><th scope="col">{tx('alloc.colAmount')} ({unit})</th><th scope="col">{tx('alloc.colShare')}</th>{bl && <><th scope="col">{tx('alloc.colAnnual')}</th><th scope="col">{tx('alloc.colActual', { cutoff: bl.cutoff })}</th><th scope="col">{tx('alloc.colRemaining')}</th><th scope="col">{tx('alloc.colSurplus')}</th></>}<th scope="col">{tx('alloc.colOrigin')}</th><th scope="col"><span className="sr-only">{tx('common.actions')}</span></th></tr></thead>
          <tbody>
            {m.rows.map((row) => (
              <tr key={row.key} className={row.highlight ? 'is-highlight' : undefined} aria-current={row.highlight ? 'true' : undefined}>
                <th scope="row" data-label={tx('alloc.colEntity')}>{row.name}{row.outOfScope && <Chip kind="bad">{tx('alloc.outOfScope')}</Chip>}{row.changed && <Chip kind="warn" title={row.baseAmount == null ? tx('alloc.savedNone') : tx('alloc.savedWas', { value: milText(row.baseAmount) })}>{tx('alloc.changed')}</Chip>}</th>
                <td data-label={`${tx('alloc.colAmount')} (${unit})`}>
                  <AmountInput compact id={`pe-a-${row.key.replace(/\W+/g, '-')}`} value={row.amount} disabled={dis} disabledReason={why} label={`${row.name} — ${tx('alloc.colAmount')}`} onCommit={(v) => edits.setEntity(row.key, v)} />
                  {!row.hasRow && <div className="pe-notarget">{tx('alloc.noEntityRow')}</div>}
                </td>
                <td data-label={tx('alloc.colShare')} dir="ltr">{row.hasRow ? shareText(row.share) : '—'}</td>
                {bl && <>{['annual', 'actual', 'remaining', 'surplus'].map((f) => <td key={f} className="pe-ro" data-label={tx(`alloc.col${f[0].toUpperCase()}${f.slice(1)}`, { cutoff: bl.cutoff })} dir="ltr">{blCell(row.key, f)}</td>)}</>}
                <td data-label={tx('alloc.colOrigin')}>{ORIGIN(tx, row.origin)}</td>
                <td className="pe-td-act">{row.hasRow && <button type="button" className="pe-iconbtn" disabled={dis} title={why || tx('alloc.clearRow')} aria-label={`${tx('alloc.clearRow')}: ${row.name}`} onClick={() => edits.setEntity(row.key, null)}><Icon name="close" size={15} /></button>}</td>
              </tr>
            ))}
            {!m.single && b && (
              <tr className="pe-tr-sum">
                <th scope="row" data-label={tx('alloc.colEntity')}>{tx('alloc.totalAllocated')}</th>
                <td data-label={`${tx('alloc.colAmount')} (${unit})`} dir="ltr" title={riyalText(b.allocated, lang)}>{milText(b.allocated)}</td>
                <td data-label={tx('alloc.colShare')} dir="ltr">{b.target > 0 ? shareText(b.allocated / b.target) : '—'}</td>{bl && <>{[bl.annualTarget, bl.actualToCutoff, bl.remaining, bl.surplus].map((v, i) => <td key={i} className="pe-ro" dir="ltr">{milText(v)}</td>)}</>}<td data-label={tx('alloc.colOrigin')}>—</td><td />
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="pe-note">{tx('alloc.targetFixedNote')}</p>
      {diff && (
        <section className="pe-diff" aria-labelledby="pe-diff-h">
          <h4 id="pe-diff-h" className="pe-h4">{tx('alloc.diffTitle', { name: diff.referenceName })}</h4>
          <div className="pe-tablewrap">
            <table className="pe-table pe-table--stack">
              <thead><tr><th scope="col">{tx('alloc.colEntity')}</th><th scope="col">{tx('alloc.diffThis')}</th><th scope="col">{tx('alloc.diffRef')}</th><th scope="col">{tx('alloc.diffDelta')}</th></tr></thead>
              <tbody>{diff.rows.map((r) => (
                <tr key={r.entityKey}>
                  <th scope="row" data-label={tx('alloc.colEntity')}>{entityName(r.entityKey, lang)}</th>
                  <td data-label={tx('alloc.diffThis')} dir="ltr">{milText(r.entityPlan)}</td>
                  <td data-label={tx('alloc.diffRef')} dir="ltr">{r.reference == null ? '—' : milText(r.reference)}</td>
                  <td data-label={tx('alloc.diffDelta')} dir="ltr">{r.difference == null ? '—' : `${r.difference > 0 ? '+' : r.difference < 0 ? '−' : ''}${milText(Math.abs(r.difference))}`}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <p className="pe-note">{diff.note[lang]}</p>
        </section>
      )}
    </div>
  );
}
