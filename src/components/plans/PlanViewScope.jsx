// The VIEW-scope filter of the plan page (docs/revenue-plans-spec.md §9): «الأمانة / الجهة» and — once an Amanah with subordinate municipalities is chosen — the «البلدية» dropdown right beside it. It reuses the platform's filter bar
// (LocalFilterToolbar → FilterBar: a change of the parent clears the dependent field and announces it; the municipality field is the same dependent searchable select as the shared scope bar). Options come ONLY from
// planAccess.viewScopeOf (the entities / municipalities the viewer is authorised for). The state lives in the URL (?amanah=&muni=), it NEVER writes the plan, and the field is hidden for an entity without municipalities.
import React, { useMemo } from 'react';
import { LocalFilterToolbar } from '../filters';
import { useAr } from '../../utils/useAr';
import { entityNameOf, bi } from './planUi';
import { municipalitiesOf } from '../../data/amanahHierarchy';

export function viewScopeFields({ vsc, ministry = true, restrictedLabel = null }) {
  const all = restrictedLabel || (ministry ? bi('الوزارة (كل الجهات)', 'The Ministry (all entities)') : bi('كل جهات الخطة', 'All entities of the plan'));
  const fields = [{ key: 'amanah', type: 'select', primary: true, searchable: vsc.amanahOptions.length > 12, label: bi('الأمانة / الجهة', 'Amanah / entity'), options: [{ value: 'all', label: all }, ...vsc.amanahOptions.map((k) => ({ value: k, label: entityNameOf(k) }))] }];
  if (vsc.showMunicipality) {
    fields.push({
      key: 'muni', type: 'select', primary: true, searchable: true, className: 'ft-field--muni', dependsOn: 'amanah', label: bi('البلدية', 'Municipality'),
      options: [{ value: 'all', label: bi('كل البلديات التابعة للأمانة', 'All the Amanah’s municipalities') }, ...vsc.municipalityOptions.map((m) => ({ value: m.muniId, label: m.name }))],
      clearedNotice: bi('أُزيلت البلدية لأن الأمانة تغيّرت', 'The municipality was cleared because the Amanah changed')
    });
  }
  return fields;
}

export default function PlanViewScope({ vsc, values, onChange, ministry = true, restrictedLabel = null }) {
  const { L } = useAr();
  const fields = useMemo(() => viewScopeFields({ vsc, ministry, restrictedLabel }), [vsc, ministry, restrictedLabel]);
  if (fields.length === 1 && fields[0].options.length <= 2 && !vsc.amanahOptions.some((k) => municipalitiesOf(k).length > 0)) return null; // one entity and no municipalities to choose: nothing to show
  return (
    <div id="plan-view-scope">
      <LocalFilterToolbar fields={fields} values={{ amanah: values.amanah, muni: values.muni }} defaults={{ amanah: 'all', muni: 'all' }} label={L('نطاق العرض', 'View scope')}
        onChange={onChange} onClear={() => onChange({ amanah: 'all', muni: 'all' })} />
    </div>
  );
}
