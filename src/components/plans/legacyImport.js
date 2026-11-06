// LEGACY IMPORT — pure helpers behind the dismissible notice «لديك مستهدف محفوظ على هذا الجهاز» (docs/revenue-plans-spec.md §2 «Legacy»).
// An older browser may still hold the retired target record (see src/data/plans/legacyStore.js). When this browser holds such a record for a year and the shared plans hold no plan imported from that SAME record
// (the server's own duplicate rule: legacy.versionId + legacy.savedAt + legacy.year), the plan page offers «استيراد كخطة». The value is only READ: importing never deletes or modifies it.
import { legacyYears } from '../../data/plans/legacyStore';
import { legacyRecord } from '../../data/plans/planDefaults';
import { requestProblems } from './planUi';

const bi = (ar, en) => ({ ar, en });
const same = (a, b) => (a ?? null) === (b ?? null);

/** the plan already imported from this legacy record (same version id, saved-at and year), or null */
export function importedFrom(plans, record) {
  const p = (plans || []).find((x) => x && x.legacy && x.legacy.versionId === record.versionId && same(x.legacy.savedAt, record.savedAt) && x.legacy.year === record.year);
  return p ? { planId: p.id, name: p.name } : null;
}
/** the years of `store` that can still be imported → [{ year, record }] (empty when nothing is saved on this device, or each record already has its plan) */
export function legacyImportCandidates(store, plans) {
  return legacyYears(store).map((year) => ({ year, record: legacyRecord(store, year) })).filter((c) => !importedFrom(plans, c.record));
}
/** who may import: the import creates a Ministry-scope plan, so it needs all-entities access and a role that is not read-only (the server enforces the same) */
export const canImportLegacy = (capabilities) => !!capabilities && !!capabilities.canCreateMinistry && !capabilities.readOnly;

export const LEGACY_TEXT = {
  notice: (year) => bi(`لديك مستهدف محفوظ على هذا الجهاز (${year}) — يمكن استيراده كخطة جديدة`, `You have a target saved on this device (${year}) — it can be imported as a new plan`),
  import: bi('استيراد كخطة', 'Import as a plan'),
  importing: bi('جارٍ الاستيراد…', 'Importing…'),
  dismiss: bi('إخفاء', 'Dismiss'),
  keep: bi('لا يُحذف المستهدف المحفوظ على هذا الجهاز ولا يتغيّر.', 'The target saved on this device is not deleted or changed.'),
  done: (name) => bi(`تم استيراد المستهدف كخطة جديدة «${name}» — تظهر الآن في قائمة الخطط.`, `The target was imported as a new plan "${name}" — it now appears in the plan list.`),
  open: bi('فتح الخطة', 'Open the plan'),
  already: (name) => bi(`سبق استيراد هذا المستهدف كخطة «${name}».`, `This target was already imported as the plan "${name}".`),
  failed: bi('تعذّر الاستيراد', 'The import failed')
};

/**
 * Run ONE import: `importer(year, store)` is plansClient.importLegacyPlan; `refresh()` re-reads the shared plans so the new plan appears in the selector (and the notice disappears). The browser value is only passed on, never written.
 * → { kind:'ok', plan } | { kind:'already', plan:{id,name}|null } (409 legacy_already_imported) | { kind:'failed', problems:[{ar,en}] } (400 / 403 / 422 … shown plainly)
 */
export async function runLegacyImport({ year, store, record, plans, importer, refresh }) {
  try { const r = await importer(year, store); await refresh(); return { kind: 'ok', plan: r && r.plan ? r.plan : null }; }
  catch (e) {
    if (e && e.code === 'legacy_already_imported') { await refresh(); const p = e.plan ? { id: e.plan.planId, name: e.plan.name } : importedFrom(plans, record); return { kind: 'already', plan: p ? { id: p.id || p.planId, name: p.name } : null }; }
    return { kind: 'failed', problems: requestProblems(e) };
  }
}
