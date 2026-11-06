import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useAccess } from '../../../context/AuthContext';
import { referenceViewFor } from '../../../data/plans/planStore';
import { normalizeContent } from '../../../data/plans/planRules';
import { viewScopeOf } from '../../../data/plans/planAccess';
import { municipalitiesOf } from '../../../data/amanahHierarchy';
import { Icon, Notice, Overlay, useTx } from './editorBits';
import { TAB_IDS, allocationTableModel, effectiveEdit, entityName, hardErrors, muniName, saveChecksOf, setEntityAmount, setMuniAmount, workingCopy } from './editorLogic';
import TabBasics from './TabBasics';
import TabTarget from './TabTarget';
import TabAllocation from './TabAllocation';
import TabMonthly from './TabMonthly';
import TabAdvanced from './TabAdvanced';
import PreviewDialog from './PreviewDialog';
import ValidationPanel from './ValidationPanel';
import './planEditor.css';

const TABS = { basics: TabBasics, target: TabTarget, allocation: TabAllocation, monthly: TabMonthly, advanced: TabAdvanced };

/**
 * The revenue-plan EDITOR (side panel on desktop, full sheet on mobile) — spec §10: it edits a CLIENT WORKING COPY only and never talks to the server. The page (D1) owns saving, naming, the unsaved bar and every API call.
 * Props: { open, plan (the saved plan record or null), content (the working copy), baseContent (the saved content or null), onContentChange(nextNormalizedContent), viewScope:{amanah,muni}, initialTab, readOnlyReason (null | {ar,en}), onClose }.
 * Every edit — and every applied preview — calls onContentChange with the full NORMALIZED content. Optional hooks: `access` { geoScope, readOnly } (tests), `referenceView`, `validation` ({message?, errors?, checks?} from a refused save).
 */
export default function PlanEditor(props) {
  if (!props.open || !props.content) return null;
  return <EditorShell {...props} />;
}

export function EditorShell({ plan = null, content: contentProp, baseContent = null, onContentChange, viewScope, initialTab = 'basics', readOnlyReason = null, onClose, access: accessProp, referenceView: refProp, validation = null }) {
  const { tx, lang, ar } = useTx();
  const acc = useAccess();
  const access = useMemo(() => accessProp || { geoScope: acc.effectiveScope ? acc.effectiveScope('planning') : acc.geoScope, readOnly: !!acc.readOnly }, [accessProp, acc]);
  const content = useMemo(() => workingCopy(contentProp), [contentProp]);
  const ref = useRef(content); ref.current = content;
  const [tab, setTab] = useState(TAB_IDS.includes(initialTab) ? initialTab : 'basics');
  const [dialog, setDialog] = useState(null); // { kind, entityKey }
  const tabRefs = useRef({});

  const ea = effectiveEdit({ readOnlyReason, plan }); const canEdit = ea.canEdit; const reason = ea.reason ? ea.reason[lang] : null;
  const hard = useMemo(() => hardErrors(content, { access: { ...access, readOnly: false } }), [content, access]);
  const checks = useMemo(() => saveChecksOf(content, { plan, access: { ...access, readOnly: false } }), [content, plan, access]);

  // every edit goes up as the full normalised content; consecutive edits in one tick compose through the ref
  const update = useCallback((fn, opts = {}) => {
    const raw = fn(ref.current); const next = normalizeContent(raw);
    if (opts.keepName) next.name = raw.name; // a name being typed keeps its spaces (the page trims on save)
    ref.current = next; onContentChange?.(next);
  }, [onContentChange]);
  const edits = useMemo(() => ({ setEntity: (k, v) => update((c) => setEntityAmount(c, k, v)), setMuni: (e, m, v) => update((c) => setMuniAmount(c, e, m, v)) }), [update]);

  const year = Number((content.period?.start || '').slice(0, 4)) || null;
  const referenceView = refProp !== undefined ? refProp : (year ? safeReference(year) : null);
  const vs = viewScopeOf(viewScope, { geoScope: access.geoScope });
  const municipalView = allocationTableModel({ content, baseContent, viewScope, geoScope: access.geoScope, lang }).mode === 'municipalities';
  const openPreview = (kind, extra = {}) => setDialog({ kind, entityKey: extra.entityKey || (kind === 'municipal_remainder' ? vs.amanah : null) });
  const goAction = (kind) => { setTab(kind.startsWith('monthly') ? 'monthly' : 'allocation'); openPreview(kind, { entityKey: kind === 'municipal_remainder' ? vs.amanah : null }); };

  const ctx = { tx, lang, ar, plan, content, baseContent, update, canEdit, reason, access, viewScope, openPreview, referenceView, edits };
  const Active = TABS[tab] || TabBasics;
  const onTabKey = (e) => {
    const i = TAB_IDS.indexOf(tab); let n = null; const rtl = lang === 'ar';
    if (e.key === 'ArrowRight') n = i + (rtl ? -1 : 1); else if (e.key === 'ArrowLeft') n = i + (rtl ? 1 : -1); else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = TAB_IDS.length - 1;
    if (n === null) return; e.preventDefault(); const id = TAB_IDS[(n + TAB_IDS.length) % TAB_IDS.length]; setTab(id); tabRefs.current[id]?.focus();
  };
  const tabLabel = (id) => (id === 'allocation' && municipalView ? tx('tab.allocationMuni') : tx(`tab.${id}`));
  const muniLabel = vs.muni !== 'all' ? muniName(municipalitiesOf(vs.amanah).find((m) => m.refId === vs.muni), lang) : tx('editor.allMunis');

  return (
    <>
      <Overlay variant="panel" size="xl" title={tx('editor.title')} subtitle={<bdi>{content.name || tx('editor.untitled')}</bdi>} onClose={onClose} className="pe-panel"
        footer={(
          <>
            {canEdit && hard.errors.length > 0 && (
              <div className="pe-errlist" role="alert" aria-label={tx('foot.hardErrors')}>
                <b>{tx('foot.hardErrors')}</b>
                <ul>{hard.errors.map((e, i) => <li key={`${e.code}-${e.path}-${i}`}>{e[lang] || e.ar}{e.code === 'month_outside_period' && e.params?.ym ? ` (${e.params.ym})` : ''}</li>)}</ul>
              </div>
            )}
            <div className="pe-foot">
              <div className="pe-foot__status">{tx('foot.liveNote')}</div>
              <div className="pe-foot__btns"><button type="button" className="btn btn-primary" onClick={onClose}>{tx('foot.close')}</button></div>
            </div>
          </>
        )}>
        {!canEdit && <Notice kind="warn" title={tx('editor.readOnlyTitle')} className="pe-banner"><Icon name="lock" size={14} /> {reason}</Notice>}
        {!vs.isDefault && <Notice kind="info" className="pe-banner">{tx('editor.viewScope', { amanah: entityName(vs.amanah, lang), muni: muniLabel })}</Notice>}
        {(canEdit || validation) && <ValidationPanel checks={canEdit ? checks.checks : []} serverValidation={validation} tx={tx} lang={lang} canEdit={canEdit} onGoto={setTab} onAction={goAction} />}
        <div className="pe-tabs" role="tablist" aria-label={tx('editor.tabs')} onKeyDown={onTabKey}>
          {TAB_IDS.map((id) => (
            <button key={id} ref={(el) => { tabRefs.current[id] = el; }} type="button" role="tab" id={`pe-tab-${id}`} aria-selected={tab === id ? 'true' : 'false'} aria-controls={`pe-panel-${id}`} tabIndex={tab === id ? 0 : -1} data-autofocus={tab === id ? '' : undefined}
              className={`pe-tab-btn${tab === id ? ' is-active' : ''}`} onClick={() => setTab(id)}>{tabLabel(id)}</button>
          ))}
        </div>
        <div role="tabpanel" id={`pe-panel-${tab}`} aria-labelledby={`pe-tab-${tab}`} className="pe-tabpanel"><Active ctx={ctx} /></div>
      </Overlay>
      {dialog && <PreviewDialog kind={dialog.kind} entityKey={dialog.entityKey} content={content} tx={tx} lang={lang} onClose={() => setDialog(null)} onApply={(next) => { update(() => next); setDialog(null); }} />}
    </>
  );
}

function safeReference(year) { try { return referenceViewFor(year); } catch { return null; } }
