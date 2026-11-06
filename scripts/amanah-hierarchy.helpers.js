/* ------------------------------------------------------------------ helpers (hand-written part of the module; appended by the generator from scripts/amanah-hierarchy.helpers.js) */
// «Municipality not specified in source» — the label of an invoice whose source gave an Amanah but no municipality (never inferred, never defaulted)
export const MUNICIPALITY_NOT_SPECIFIED = { ar: 'البلدية غير محددة في المصدر', en: 'Municipality not specified in source' };

const BY_AMANAH = new Map(); const SELF = new Map(); const BY_REF = new Map();
for (const e of HIERARCHY) {
  if (e.kind === 'municipality') {
    const m = { refId: e.ref, key: `${e.amanahKey}|${e.ref}`, amanahKey: e.amanahKey, order: e.order, ar: e.nameAr, en: e.nameAr /* the reference has Arabic names only: the English UI shows the Arabic reference name */, sourceNameAr: e.sourceNameAr, flags: e.flags, kind: 'municipality' };
    (BY_AMANAH.get(e.amanahKey) || BY_AMANAH.set(e.amanahKey, []).get(e.amanahKey)).push(m); BY_REF.set(e.ref, m);
  } else if (e.kind === 'amanah_self' && e.amanahKey) SELF.set(e.amanahKey, e);
}
export const MAX_MUNICIPALITIES = Math.max(0, ...[...BY_AMANAH.values()].map((v) => v.length));

/** the municipalities mapped under one Amanah in the reference (workbook order) — ONLY kind 'municipality'; the Amanah's own row is never included. Unknown Amanah (and the Housing Sector) → [] */
export const municipalitiesOf = (amanahKey) => (BY_AMANAH.get(amanahKey) || []).slice();
export const municipalityCountOf = (amanahKey) => (BY_AMANAH.get(amanahKey) || []).length;
/** one municipality by its internal reference id (MREF-…) or by its filter key (<Amanah key>|<MREF-…>) */
export const municipalityByRef = (refId) => BY_REF.get(refId) || null;
export const municipalityByKey = (key) => { const s = String(key ?? ''); const i = s.lastIndexOf('|'); const m = i < 0 ? null : BY_REF.get(s.slice(i + 1)); return m && m.key === s ? m : null; };
/** the reference row of the Amanah ITSELF (child == parent) — an Amanah that issues directly, NOT a municipality */
export const amanahSelfOf = (amanahKey) => SELF.get(amanahKey) || null;
/** the municipality of an Amanah whose reference name equals `name` after the project's Arabic normalisation (`norm` is passed in: this module imports nothing). null when it is not in the reference */
export function findMunicipality(amanahKey, name, norm = (x) => String(x ?? '').trim()) {
  const k = norm(name); if (!k) return null;
  return municipalitiesOf(amanahKey).find((m) => norm(m.ar) === k || norm(m.sourceNameAr) === k) || null;
}

/** the structural checks of the hierarchy (an empty list = valid). Used by tests/municipality.test.mjs and by the build script's report. */
export function hierarchyIssues() {
  const out = [];
  const refs = new Set(); const names = new Map();
  for (const e of HIERARCHY) {
    if (e.ref) { if (refs.has(e.ref)) out.push(`duplicate reference id ${e.ref}`); refs.add(e.ref); if (!/^MREF-\d{3}-\d{3}$/.test(e.ref)) out.push(`reference id ${e.ref} is malformed`); }
    if (e.kind === 'municipality' && !e.amanahKey) out.push(`municipality ${e.order} has no Amanah`);
    if (e.kind === 'municipality') { const k = e.sourceNameAr; if (names.has(k)) out.push(`municipality name «${k}» appears under two parents`); names.set(k, e.amanahKey); }
  }
  const nMuni = HIERARCHY.filter((e) => e.kind === 'municipality').length;
  if (nMuni !== HIERARCHY_META.municipalities) out.push(`municipality count ${nMuni} differs from the recorded ${HIERARCHY_META.municipalities}`);
  if (HIERARCHY.length !== HIERARCHY_META.rows) out.push(`row count ${HIERARCHY.length} differs from the recorded ${HIERARCHY_META.rows}`);
  for (const [a, n] of Object.entries(HIERARCHY_META.municipalitiesPerAmanah)) {
    if (municipalityCountOf(a) !== n) out.push(`${a}: ${municipalityCountOf(a)} municipalities, the reference has ${n}`);
    if (!amanahSelfOf(a)) out.push(`${a}: no self row`);
  }
  const selfRows = HIERARCHY.filter((e) => e.kind === 'amanah_self').length;
  if (selfRows !== HIERARCHY_META.selfRows) out.push(`self rows ${selfRows} differ from the recorded ${HIERARCHY_META.selfRows}`);
  if (HIERARCHY.filter((e) => e.kind === 'ministry_hq').length !== HIERARCHY_META.ministryRows) out.push('ministry row count differs');
  if (HIERARCHY.some((e) => e.kind === 'unclassified')) out.push('an unclassified row exists');
  return out;
}
/** the entries a reviewer must look at: spelling variants, the ministry row, the oddly formatted name, aliased parents */
export const flaggedEntries = () => HIERARCHY.filter((e) => e.flags.some((f) => f === 'spelling_variant' || f === 'ministry_hq' || f === 'name_format') || (e.kind === 'amanah_self' && e.flags.includes('parent_alias')));
