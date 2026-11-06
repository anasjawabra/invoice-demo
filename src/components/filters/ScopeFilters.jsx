// ScopeFilters — the filter toolbar bound to the SHARED revenue scope (RevenueContext: scope, setPreset, setCustomRange, setAmanah, setSource, setMuni, setStatus, setScopeType, setProduct, setMainClass, resetScope).
//   <ScopeFilters {...FILTER_PAGES.collected} search={{ value, onChange, label, placeholder }} actions={<button/>} resultCount="٢٣ فاتورة" onChange={(patch)=>setPage(0)} />
// Props
//   primary, secondary : arrays of keys  period | amanah | municipality | source | status | duePosition | invoiceOrigin | product | mainClass | comparison | extra  (see filterConfig.js)
//   dateBasis          : 'issue' | 'payment' | 'contract' | 'order' → the date basis line of the period control
//   search             : { value, onChange, label?, placeholder? } — the page's own search box (kept in the toolbar's search slot)
//   actions            : node(s) at the end of the toolbar (export, new …) · resultCount: node near the table · extra: node(s) of the page's own primary controls
//   comparison         : { value, onChange, options?, default? } needed for the 'comparison' key (not part of the shared scope)
//   extraChips / onClearLocal : chips + reset of the page's own filters so «مسح الفلاتر» clears them too
//   hideStatuses       : status values not offered · onChange(patch): called after a scope change (e.g. to go back to page 1)
//   ignoreKeys         : shared-scope keys the page overrides itself (e.g. the product page fixes `product`): no «hidden filter» chip for them
//   local              : { defs, values, onChange(patch), primary:[keys], secondary:[keys] } — the page's OWN filter fields (same field-definition shape as LocalFilterToolbar), rendered by the
//                        same toolbar: `primary` keys take the place of the 'extra' slot of the configuration, `secondary` keys are appended to «المزيد من الفلاتر». Their values live in the page.
// Behaviour: amanah options are limited to the signed-in account's own geographic access (usePickerAccess → access.geoScope); municipalities depend on the Amanah (cleared + announced when it changes);
// a scope filter that is active but NOT shown on this page appears as a removable chip (nothing silently narrows the figures); «مسح الفلاتر» = resetScope.
import React, { useEffect, useMemo, useState } from 'react';
import { useRevenue } from '../../context/RevenueContext';
import { useL } from '../../utils/bi';
import { fmtDateText } from '../../data/clock';
import FilterBar from './FilterBar';
import DataInfo from './DataInfo';
import { buildScopeDefs, scopeToValues, applyScopePatch } from './filterConfig';
import { dateBasisLabel, defaultOf, defaultValueText, deriveChips, isDefaultValue, pick, permittedAmanahOptions } from './filterLogic';
import { usePickerAccess } from '../../data/useReportAccess';
import { sanitizeScopeValues, SANITIZE_NOTICE } from '../../data/reportAccess';

const SHARED_KEYS = ['period', 'amanah', 'municipality', 'source', 'status', 'invoiceOrigin', 'product', 'mainClass'];

export default function ScopeFilters({ primary = ['period', 'amanah', 'source'], secondary = [], dateBasis = 'issue', search, actions, resultCount, extra, comparison, extraChips = [], onClearLocal, hideStatuses = [], onChange, label, footer, local, ignoreKeys = [] }) {
  const rev = useRevenue(); const { ar, B } = useL(); const lang = ar ? 'ar' : 'en';
  const { scope, snapshot, meta, cfg } = rev; const today = cfg.cutoff;
  const { scope: access, ready: accessReady } = usePickerAccess(); // the user's geographic access: the Amanah / municipality lists below come ONLY from it
  const keys = useMemo(() => [...primary, ...secondary].filter((k) => k !== 'extra'), [primary, secondary]);
  const localDefs = local?.defs; const localKeys = useMemo(() => new Set((localDefs || []).map((d) => d.key)), [localDefs]);
  const barPrimary = useMemo(() => primary.flatMap((k) => (k === 'extra' ? (local?.primary || []) : [k])), [primary, local?.primary]); // eslint-disable-line react-hooks/exhaustive-deps
  const defs = useMemo(() => {
    const scopeDefs = buildScopeDefs(keys, { access, today, hideStatuses, comparison, dateBasis });
    if (!localDefs || !localDefs.length) return scopeDefs;
    const order = [...barPrimary, ...secondary, ...(local.secondary || [])];
    return [...scopeDefs, ...localDefs].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  }, [keys, access, today, hideStatuses.join('|'), comparison?.value, dateBasis, localDefs, barPrimary, secondary]); // eslint-disable-line react-hooks/exhaustive-deps
  const values = useMemo(() => ({ ...scopeToValues(scope), ...(comparison ? { comparison: comparison.value } : {}), ...(local?.values || {}) }), [scope, comparison?.value, local?.values]); // eslint-disable-line react-hooks/exhaustive-deps
  const [accessNote, setAccessNote] = useState('');

  // a stored Amanah the person is not (or no longer) allowed to see goes back to «all» (their own access) with a visible note
  // (the same for a value the URL / a stored selection injected: an Amanah or municipality outside the user's access is dropped and a notice says so — nothing is widened silently)
  useEffect(() => {
    if (!accessReady) return; // the session is still being re-validated: nothing is judged against an empty access
    const a = scope.amanah; const allowed = permittedAmanahOptions(access).map((x) => x.key);
    const bad = (Array.isArray(a) ? a : [a]).filter((x) => x !== 'all' && !allowed.includes(x));
    if (bad.length) { rev.setAmanah('all'); setAccessNote(ar ? 'أُعيد اختيار الأمانة لأنها خارج صلاحياتك' : 'The Amanah selection was reset because it is outside your access'); return; }
    const r = sanitizeScopeValues({ amanah: scope.amanah, muni: scope.muni }, access);
    if (r.dropped.includes('muni')) { rev.setMuni('all'); setAccessNote(ar ? SANITIZE_NOTICE.ar : SANITIZE_NOTICE.en); }
  }, [access, accessReady, scope.amanah, scope.muni]); // eslint-disable-line react-hooks/exhaustive-deps

  const setters = useMemo(() => ({ today, setPreset: rev.setPreset, setCustomRange: rev.setCustomRange, setAmanah: rev.setAmanah, setMuni: rev.setMuni, setSource: rev.setSource, setStatus: rev.setStatus, setScopeType: rev.setScopeType, setProduct: rev.setProduct, setMainClass: rev.setMainClass }), [today, rev.setPreset, rev.setCustomRange, rev.setAmanah, rev.setMuni, rev.setSource, rev.setStatus, rev.setScopeType, rev.setProduct, rev.setMainClass]);
  const handleChange = (patch) => {
    setAccessNote(''); if (rev.scopeNotice) rev.clearScopeNotice();
    const { comparison: cmp, ...rest } = patch;
    if (cmp !== undefined && comparison) comparison.onChange(cmp);
    const scopePatch = {}; const localPatch = {};
    for (const k of Object.keys(rest)) { if (localKeys.has(k)) localPatch[k] = rest[k]; else scopePatch[k] = rest[k]; }
    if (Object.keys(localPatch).length && local?.onChange) local.onChange(localPatch);
    applyScopePatch(scopePatch, setters);
    if (onChange) onChange(patch);
  };
  const handleClear = () => { rev.resetScope(); if (comparison) comparison.onChange(comparison.default ?? 'none'); if (onClearLocal) onClearLocal(); if (onChange) onChange({}); };

  // active scope filters this page does not show: nothing may narrow the figures invisibly
  const hidden = useMemo(() => {
    const shown = new Set(keys.map((k) => (k === 'duePosition' ? 'status' : k)));
    const missing = SHARED_KEYS.filter((k) => !shown.has(k) && !ignoreKeys.includes(k));
    const hdefs = buildScopeDefs(missing.filter((k) => k !== 'period'), { access, today, hideStatuses: [] });
    const chips = deriveChips(hdefs, scopeToValues(scope), { lang, valueText: (d, v) => defaultValueText({ ...d, options: typeof d.options === 'function' ? d.options(scopeToValues(scope)) : d.options }, v, lang) })
      .map((c) => ({ ...c, onRemove: () => applyScopePatch({ [c.key]: defaultOf(hdefs.find((d) => d.key === c.key)) }, setters) }));
    if (missing.includes('period')) { const pd = buildScopeDefs(['period'], { today })[0]; if (!isDefaultValue(pd, scopeToValues(scope).period)) chips.unshift({ key: 'period', label: pick({ ar: 'الفترة', en: 'Period' }, lang), value: `${fmtDateText(scope.from, lang)} – ${fmtDateText(scope.to, lang)}`, onRemove: () => rev.setPreset('ytd') }); }
    return chips;
  }, [scope, keys, access, today, lang, setters, ignoreKeys.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  const recon = snapshot?.equation;
  const info = (
    <DataInfo lang={lang} summary={ar ? `البيانات حتى ${fmtDateText(snapshot?.cutoff, 'ar')}` : `Data up to ${fmtDateText(snapshot?.cutoff, 'en')}`} rows={[
      { label: ar ? 'آخر تاريخ للبيانات (اليوم بتوقيت الرياض)' : 'Data cutoff (today, Riyadh)', value: fmtDateText(snapshot?.cutoff, lang) },
      { label: ar ? 'مصدر الأرقام' : 'Source of the figures', value: B(meta?.label) || (ar ? 'بيانات تجريبية' : 'Demo data') },
      { label: ar ? 'أساس التاريخ' : 'Date basis', value: dateBasisLabel(dateBasis, lang) },
      ...(dateBasis === 'issue' && snapshot?.basis ? [{ label: ar ? 'أساس التحصيل' : 'Collection basis', value: ar ? 'تُختار الفواتير بتاريخ الإصدار؛ ويُحتسب المحصّل بالمدفوعات حتى التاريخ المذكور' : 'Invoices are selected by issue date; collections count payments up to the stated date' }] : []),
      { label: ar ? 'فحوص المطابقة' : 'Reconciliation checks', value: recon ? (recon.ok ? (ar ? 'سليمة' : 'Passed') : (ar ? 'تعذّر التحقق لهذا الاختيار' : 'Failed for this selection')) : '', tone: recon && !recon.ok ? 'bad' : '' },
      { label: ar ? 'قواعد الاستبعاد' : 'Exclusion rules', value: snapshot?.ruleSetVersion },
      { label: ar ? 'نطاق التصفية' : 'Filter scope', value: ar ? 'تُحفظ التصفية لهذه الجلسة وتُشارك بين لوحة المعلومات والصفحات التشغيلية؛ للتخطيط نطاقه الخاص ولكل محادثة في التقارير الذكية نطاقها.' : 'Filters are kept for this session and shared by the dashboard and the operational pages; planning has its own scope and each Smart-report conversation its own.' },
      { label: ar ? 'فترة السماح' : 'Grace period', value: ar ? 'لا تُطبَّق حالياً (السياسة غير محسومة)' : 'None applied (the policy is not yet decided)' },
      ...(snapshot?.exclusionsApproval?.unapprovedAmount > 0 ? [{ label: ar ? 'استبعادات بقواعد غير معتمدة' : 'Exclusions under unapproved rules', value: String(Math.round(snapshot.exclusionsApproval.unapprovedAmount)) }] : [])
    ]} />
  );
  const alert = recon && !recon.ok ? <div className="rv-callout rv-callout--bad" role="alert">{ar ? 'تعذّر التحقق من علاقات المطابقة لهذا الاختيار' : 'The reconciliation checks failed for this selection'}</div> : null;
  const scopeNote = rev.scopeNotice ? pick(rev.scopeNotice, lang) : ''; // e.g. a stored municipality from the retired demo scheme was reset
  const note = accessNote || scopeNote ? <div className="ft-notice" role="status" aria-live="polite">{accessNote || scopeNote}</div> : null;

  return (
    <FilterBar defs={defs} primary={barPrimary.filter((k) => k !== 'extra')} values={values} onChange={handleChange} onClear={handleClear} ctx={{ today, dateBasis }} search={search} actions={actions} info={info}
      resultCount={resultCount} extraChips={[...hidden, ...extraChips]} extraNodes={extra} lang={lang} label={label} footer={<>{note}{alert}{footer}</>} />
  );
}
