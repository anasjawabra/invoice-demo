// LocalFilterToolbar — the same toolbar for pages whose filters are NOT part of the shared revenue scope (contracts, enforcement, planning …).
//   <LocalFilterToolbar fields={[{ key:'status', label:{ar,en}, type:'select', options:[{value:'all',label:…},…], primary:true },
//                                 { key:'muni', label, type:'select', options:(values)=>[…], dependsOn:'amanah', clearedNotice:{ar,en}, group:'location' },
//                                 { key:'from', … }]}
//                       values={values} onChange={(patch)=>setValues(patch)} urlKeys={['status','amanah']}  // urlKeys: kept in the URL (replace history)
//                       search={{ value, onChange, label, placeholder }} actions={…} resultCount={…} lang="ar" />
// A field is primary when `primary: true` (≤ 3–4 per page), otherwise it sits in «المزيد من الفلاتر». Field types: select (searchable above 12 options) · multi · period · text.
// Without `values`/`onChange` and with `urlKeys` the state lives in the URL through useUrlFilters; with `values`+`onChange` the page owns the state (urlKeys then mirrors it).
// `defaults` overrides a field's default (otherwise 'all' / [] / ''). «مسح الفلاتر» appears only when a value differs from its default.
import React, { useEffect, useMemo } from 'react';
import FilterBar from './FilterBar';
import useUrlFilters from './useUrlFilters';
import { useL } from '../../utils/bi';
import { defaultOf, isEqualJson } from './filterLogic';

export default function LocalFilterToolbar({ fields, values: valuesProp, onChange: onChangeProp, urlKeys = [], defaults = {}, search, actions, resultCount, info, extraChips, ctx, label, lang: langProp, footer, onClear }) {
  const { ar } = useL(); const lang = langProp || (ar ? 'ar' : 'en');
  const defs = useMemo(() => fields.map((f) => ({ ...f, ...(f.key in defaults ? { default: defaults[f.key] } : {}) })), [fields, defaults]);
  const baseDefaults = useMemo(() => Object.fromEntries(defs.map((d) => [d.key, defaultOf(d)])), [defs]);
  const url = useUrlFilters({ keys: urlKeys, defaults: Object.fromEntries(urlKeys.map((k) => [k, baseDefaults[k]])) });
  const controlled = !!valuesProp;
  const values = controlled ? { ...baseDefaults, ...valuesProp } : { ...baseDefaults, ...url.values };
  // controlled pages mirror their url-kept keys into the address bar
  useEffect(() => { if (controlled && urlKeys.length) { const patch = {}; for (const k of urlKeys) if (!isEqualJson(url.values[k], values[k])) patch[k] = values[k]; if (Object.keys(patch).length) url.setValues(patch); } }, [controlled, JSON.stringify(urlKeys.map((k) => values[k]))]); // eslint-disable-line react-hooks/exhaustive-deps
  const onChange = (patch) => { if (controlled) onChangeProp(patch); else { url.setValues(patch); if (onChangeProp) onChangeProp(patch); } };
  return <FilterBar defs={defs} primary={defs.filter((d) => d.primary).map((d) => d.key)} values={values} onChange={onChange} onClear={onClear} ctx={ctx || {}} search={search} actions={actions} info={info} resultCount={resultCount} extraChips={extraChips} lang={lang} label={label} footer={footer} />;
}
