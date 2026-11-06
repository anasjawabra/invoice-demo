// FilterBar — the generic engine behind ScopeFilters and LocalFilterToolbar: field definitions + values → toolbar, More panel, chips, drawer, clear.
//   <FilterBar defs primary={['period','amanah']} values defaults? onChange={(patch)=>…} ctx={{ today }} search={{ value, onChange, label, placeholder }}
//              actions info resultCount extraChips={[{ key,label,value,onRemove }]} onClear lang />
// * primary controls apply immediately; secondary ones (everything not in `primary`) live in «المزيد من الفلاتر» with draft + Apply; on mobile ALL controls live in the drawer (draft + Apply).
// * a change of a parent (def.dependsOn) clears the dependent field and announces it (aria-live).
// * «مسح الفلاتر» shows only when something differs from its default (or `extraChips` exist) and sets every field back to its default via onClear / onChange.
import React, { useCallback, useMemo, useState } from 'react';
import FilterToolbar from './FilterToolbar';
import MoreFilters, { FieldControl, FieldsForm } from './MoreFilters';
import ActiveFilterChips from './ActiveFilterChips';
import { useMediaQuery } from './overlay';
import { activeKeys, cascadePatch, clearedNoticeText, defaultOf, defaultValueText, deriveChips, isDefaultValue, isEqualJson, periodText, pick } from './filterLogic';

export default function FilterBar({ defs, primary = [], values, onChange, onClear, ctx = {}, search, actions, info, resultCount, extraChips = [], extraNodes = null, lang = 'ar', label, chipValueText, chipsFor = 'secondary', footer = null }) {
  const ar = lang === 'ar'; const mobile = useMediaQuery();
  const [notice, setNotice] = useState(''); const [drawer, setDrawer] = useState(false); const [draft, setDraft] = useState(values); const [dnote, setDnote] = useState('');
  const prim = useMemo(() => primary.map((k) => defs.find((d) => d.key === k)).filter(Boolean), [defs, primary]);
  const sec = useMemo(() => defs.filter((d) => !primary.includes(d.key)), [defs, primary]);
  const nActive = activeKeys(defs, values, ctx).length + extraChips.length;
  const commit = useCallback((patch) => {
    const r = cascadePatch(defs, values, patch); const full = { ...patch };
    for (const k of r.cleared) full[k] = r.values[k];
    setNotice(clearedNoticeText(defs, r.cleared, lang)); onChange(full);
  }, [defs, values, onChange, lang]);
  const clearAll = () => { setNotice(''); if (onClear) onClear(); else onChange(Object.fromEntries(defs.map((d) => [d.key, defaultOf(d)]))); };
  const chips = deriveChips(defs, values, { lang, ctx, exclude: mobile || chipsFor === 'all' ? [] : prim.map((d) => d.key), valueText: chipValueText || ((d, v) => defaultValueText({ ...d, options: typeof d.options === 'function' ? d.options(values) : d.options }, v, lang)) })
    .map((c) => ({ ...c, onRemove: () => commit({ [c.key]: defaultOf(defs.find((d) => d.key === c.key)) }) }));
  // a period that lives in «المزيد من الفلاتر» (the page has no period control in the toolbar) stays visible as a chip once the panel closes
  const secPeriod = sec.find((d) => d.type === 'period');
  if (secPeriod && !isDefaultValue(secPeriod, values[secPeriod.key], ctx)) chips.unshift({ key: secPeriod.key, label: pick(secPeriod.label, lang), value: periodText(values[secPeriod.key], lang), onRemove: () => commit({ [secPeriod.key]: defaultOf(secPeriod) }) });
  const chipRow = <ActiveFilterChips chips={[...chips, ...extraChips]} notice={notice} onDismissNotice={() => setNotice('')} lang={lang} />;

  const openDrawer = () => { setDraft(values); setDnote(''); setDrawer(true); };
  const draftChange = (patch) => { const r = cascadePatch(defs, draft, patch); setDraft(r.values); setDnote(clearedNoticeText(defs, r.cleared, lang)); };
  const applyDraft = () => { const patch = {}; for (const d of defs) if (!isEqualJson(draft[d.key], values[d.key])) patch[d.key] = draft[d.key]; setDrawer(false); if (Object.keys(patch).length) { setNotice(dnote); onChange(patch); } };
  const periodIdx = prim.findIndex((d) => d.type === 'period');
  const primaryNodes = prim.map((d, i) => (
    <React.Fragment key={d.key}>
      <FieldControl def={d} values={values} onChange={commit} lang={lang} ctx={ctx} id={`ft-${d.key}`} />
      {i === periodIdx && info ? <div className="ft-info-slot">{info}</div> : null}
    </React.Fragment>
  ));
  return (
    <FilterToolbar lang={lang} label={label} mobile={mobile} primary={<>{primaryNodes}{extraNodes}</>} search={search ? <SearchBox {...search} lang={lang} /> : null}
      more={sec.length ? <MoreFilters defs={sec} allDefs={defs} values={values} ctx={ctx} lang={lang} onApply={(patch, note) => { setNotice(note || ''); onChange(patch); }} /> : null}
      info={periodIdx >= 0 && !mobile ? null : info} actions={actions} showClear={nActive > 0} onClear={clearAll} chips={chipRow} resultCount={resultCount}
      activeCount={nActive} footer={footer} drawerOpen={drawer} onDrawerOpen={openDrawer} onDrawerClose={() => setDrawer(false)}
      drawerBody={<><FieldsForm defs={defs} values={draft} onChange={draftChange} lang={lang} ctx={ctx} notice={dnote} idPrefix="ft-m" />{extraNodes}</>}
      drawerFooter={<><button type="button" className="btn btn-primary ft-btn" onClick={applyDraft}>{ar ? 'تطبيق' : 'Apply'}</button><button type="button" className="btn btn-ghost ft-btn" onClick={() => { setDrawer(false); clearAll(); }} disabled={nActive === 0}>{ar ? 'مسح الفلاتر' : 'Clear filters'}</button></>} />
  );
}

export function SearchBox({ value, onChange, label, placeholder, lang = 'ar', id = 'ft-search' }) {
  const ar = lang === 'ar';
  return (
    <div className="ft-field ft-field--search">
      <label className="ft-label" htmlFor={id}>{pick(label, lang) || (ar ? 'بحث' : 'Search')}</label>
      <div className="ft-searchwrap">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        <input id={id} className="ft-ctl ft-ctl--input ft-ctl--search" type="search" value={value || ''} placeholder={pick(placeholder, lang)} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}
