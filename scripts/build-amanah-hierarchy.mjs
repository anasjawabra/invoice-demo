// Builds src/data/amanahHierarchy.js from the Amanah / municipality REFERENCE workbook (names only).
//   node scripts/build-amanah-hierarchy.mjs "<path>/الامانات والبلديات.xlsx"      → (re)writes src/data/amanahHierarchy.js
//   node scripts/build-amanah-hierarchy.mjs "<path>" --check                      → prints the hierarchy validation only, writes nothing
// The workbook has two columns, «الأمانه» (parent) and «الجهة» (subordinate entity) and NO official identifiers. It is a hierarchy REFERENCE, not evidence that any invoice belongs to a municipality.
//  * the workbook itself is never copied into the repository; only the (public) entity names and the hierarchy go into the generated module
//  * every parent is resolved to the project's ENTITIES with the project's Arabic normalisation (src/data/textNorm.js looseKey); a differently spelled parent is FLAGGED, not silently merged
//  * a row whose child equals its parent is the Amanah ITSELF (flag amanah_self) — it is NOT a municipality and never appears in a municipality list
//  * internal reference ids  MREF-<Amanah demo id>-<nnn>  are NOT official codes (the workbook has none): they number the municipalities of one Amanah in workbook order
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { ENTITIES, N_AMANAH } from '../src/data/catalog.js';
import { looseKey } from '../src/data/textNorm.js';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'src', 'data', 'amanahHierarchy.js');
const args = process.argv.slice(2); const file = args.find((a) => !a.startsWith('--')); const checkOnly = args.includes('--check');
if (!file) { console.error('usage: node scripts/build-amanah-hierarchy.mjs <workbook.xlsx> [--check]'); process.exit(2); }

const wb = XLSX.readFile(file);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null }).slice(1).filter((r) => r && r[0] != null && r[1] != null);
const s = (x) => String(x).replace(/\s+/g, ' ').trim();

// parents whose wording differs from the project's Amanah names (the Amanah is the same entity; the wording in the reference is the one used by the source data)
const PARENT_ALIASES = [
  { parentAr: 'أمانة العاصمة المقدسة', entityEn: 'Makkah Amanah', note: 'The reference names the Makkah Amanah «أمانة العاصمة المقدسة»; the project name is «أمانة منطقة مكة المكرمة». Same entity — to be confirmed by the data owner.' },
  { parentAr: 'أمانة منطقة المدينة المنورة', entityEn: 'Al Madinah Amanah', note: 'The reference writes «أمانة منطقة المدينة المنورة»; the project name is «أمانة المدينة المنورة». Same entity — to be confirmed by the data owner.' }
];
const entKeys = ENTITIES.slice(0, N_AMANAH).map((e, i) => ({ i, en: e.en, ar: e.ar, key: looseKey(e.ar) }));
const aliasKey = new Map(PARENT_ALIASES.map((a) => [looseKey(a.parentAr), a]));

function resolveParent(parentRaw) {
  const k = looseKey(parentRaw);
  if (/^وزار/.test(s(parentRaw)) || /^وزار/.test(k)) return { resolved: null, via: 'ministry_hq' };
  const exact = entKeys.find((e) => e.key === k);
  if (exact) return { resolved: exact, via: s(parentRaw) === exact.ar ? 'exact' : 'normalised' };
  const al = aliasKey.get(k);
  if (al) return { resolved: entKeys.find((e) => e.en === al.entityEn), via: 'alias', note: al.note };
  return { resolved: null, via: 'unresolved' };
}

const parentsSeen = new Map(); // parent text → { via, entityEn }
const counters = new Map(); // amanah en → next municipality number
const entries = [];
for (const [pRaw, cRaw] of rows) {
  const parentSrc = s(pRaw); const childSrc = s(cRaw);
  if (!parentsSeen.has(parentSrc)) parentsSeen.set(parentSrc, resolveParent(parentSrc));
  const pr = parentsSeen.get(parentSrc);
  const flags = []; let kind;
  if (pr.via === 'ministry_hq') { kind = 'ministry_hq'; flags.push('ministry_hq'); }
  else if (childSrc === parentSrc) { kind = 'amanah_self'; flags.push('amanah_self'); }
  else if (/بلدية/.test(childSrc)) kind = 'municipality';
  else kind = 'unclassified';
  if (pr.via === 'normalised') flags.push('spelling_variant'); // the parent is spelled differently from the project's Amanah name (same words after normalisation)
  if (pr.via === 'alias') flags.push('parent_alias');
  let nameAr = childSrc;
  if (kind === 'municipality' && !/^بلدية [^()]+$/.test(childSrc)) {
    flags.push('name_format'); // e.g. «(بلدية القوز(القنفذة» — the text is kept as it came in sourceNameAr; the display name only repairs the parentheses
    const m = /^\(\s*(بلدية [^()]+?)\s*\(\s*([^()]+?)\s*\)?$/.exec(childSrc);
    if (m) nameAr = `${m[1]} (${m[2]})`;
  }
  if (kind === 'ministry_hq') {
    // the ministry row's subordinate entity is the ministry itself, spelled with a typo in the reference («ولإسكان»): kept as written, flagged
    if (looseKey(childSrc) !== looseKey(parentSrc)) flags.push('spelling_variant');
  }
  const entityEn = pr.resolved ? pr.resolved.en : null;
  let ref = null;
  if (pr.resolved) {
    const id = String(pr.resolved.i + 1).padStart(3, '0');
    if (kind === 'municipality') { const n = (counters.get(entityEn) || 0) + 1; counters.set(entityEn, n); ref = `MREF-${id}-${String(n).padStart(3, '0')}`; }
    else if (kind === 'amanah_self') ref = `MREF-${id}-000`;
  } else if (kind === 'ministry_hq') ref = 'MREF-000-000';
  entries.push({ order: entries.length + 1, ref, amanahKey: entityEn, kind, nameAr, sourceNameAr: childSrc, parentSourceAr: parentSrc, flags });
}

/* ------------------------------------------------------------------ validation (printed; the counts are also stored in the module for tests) */
const issues = [];
const names = new Map();
for (const e of entries) { const k = looseKey(e.sourceNameAr); (names.get(k) || names.set(k, []).get(k)).push(e); }
const dupNames = [...names.values()].filter((v) => v.length > 1);
const childUnderTwo = []; { const m = new Map(); for (const e of entries) { if (e.kind !== 'municipality') continue; const k = looseKey(e.sourceNameAr); const set = m.get(k) || new Set(); set.add(e.amanahKey); m.set(k, set); } for (const [k, set] of m) if (set.size > 1) childUnderTwo.push(k); }
if (dupNames.length) issues.push(`duplicate names: ${dupNames.length}`);
if (childUnderTwo.length) issues.push(`child under two parents: ${childUnderTwo.length}`);
const unresolvedParents = [...parentsSeen].filter(([, v]) => v.via === 'unresolved').map(([k]) => k);
if (unresolvedParents.length) issues.push(`unresolved parents: ${unresolvedParents.join(' | ')}`);
const unclassified = entries.filter((e) => e.kind === 'unclassified'); if (unclassified.length) issues.push(`unclassified rows: ${unclassified.length}`);
const perAmanah = {}; for (const e of entries) if (e.amanahKey) { const p = perAmanah[e.amanahKey] || (perAmanah[e.amanahKey] = { municipalities: 0, self: 0 }); if (e.kind === 'municipality') p.municipalities += 1; if (e.kind === 'amanah_self') p.self += 1; }
const amanahsWithoutSelf = Object.entries(perAmanah).filter(([, v]) => v.self !== 1).map(([k]) => k);
if (amanahsWithoutSelf.length) issues.push(`Amanahs without exactly one self row: ${amanahsWithoutSelf.join(', ')}`);
const resolvedAmanahs = new Set(entries.map((e) => e.amanahKey).filter(Boolean));
const missingAmanahs = entKeys.filter((e) => !resolvedAmanahs.has(e.en)).map((e) => e.en);
if (missingAmanahs.length) issues.push(`project Amanahs absent from the reference: ${missingAmanahs.join(', ')}`);
const count = (f) => entries.filter(f).length;
const META = {
  source: 'الامانات والبلديات.xlsx (names only; NOT copied into the repository)',
  generatedBy: 'scripts/build-amanah-hierarchy.mjs',
  rows: entries.length,
  distinctParents: parentsSeen.size,
  amanahsResolved: resolvedAmanahs.size,
  ministryRows: count((e) => e.kind === 'ministry_hq'),
  selfRows: count((e) => e.kind === 'amanah_self'),
  municipalities: count((e) => e.kind === 'municipality'),
  municipalitiesRegularName: count((e) => e.kind === 'municipality' && !e.flags.includes('name_format')),
  nameFormatEntries: count((e) => e.flags.includes('name_format')),
  spellingVariantRows: count((e) => e.flags.includes('spelling_variant')),
  parentAliases: PARENT_ALIASES.map((a) => ({ parentAr: a.parentAr, amanahKey: a.entityEn, note: a.note })),
  municipalitiesPerAmanah: Object.fromEntries(Object.entries(perAmanah).map(([k, v]) => [k, v.municipalities])),
  duplicateNames: dupNames.length, childrenUnderTwoParents: childUnderTwo.length
};

console.log(`rows ${META.rows} · distinct parents ${META.distinctParents} (${META.amanahsResolved} resolved to project Amanahs, ${META.ministryRows} ministry row)`);
console.log(`self rows (the Amanah itself) ${META.selfRows} · municipalities ${META.municipalities} (${META.municipalitiesRegularName} regular «بلدية …» + ${META.nameFormatEntries} oddly formatted)`);
console.log(`parent spellings flagged: ${[...parentsSeen].filter(([, v]) => v.via === 'normalised').length} variant · ${[...parentsSeen].filter(([, v]) => v.via === 'alias').length} aliased name`);
console.log(`duplicate names ${META.duplicateNames} · children under two parents ${META.childrenUnderTwoParents}`);
console.log('municipalities per Amanah:', Object.entries(META.municipalitiesPerAmanah).map(([k, v]) => `${k}=${v}`).join(', '));
console.log(issues.length ? `ISSUES: ${issues.join(' ; ')}` : 'hierarchy valid');
if (issues.length) process.exit(1);
if (checkOnly) process.exit(0);

/* ------------------------------------------------------------------ the module */
const q = (v) => JSON.stringify(v);
const dataLines = entries.map((e) => `  { order: ${e.order}, ref: ${q(e.ref)}, amanahKey: ${q(e.amanahKey)}, kind: ${q(e.kind)}, nameAr: ${q(e.nameAr)}, sourceNameAr: ${q(e.sourceNameAr)}, parentSourceAr: ${q(e.parentSourceAr)}, flags: ${q(e.flags)} }`).join(',\n');
const helpers = fs.readFileSync(path.join(here, 'amanah-hierarchy.helpers.js'), 'utf8');
const body = `// GENERATED by scripts/build-amanah-hierarchy.mjs from the Amanah / municipality reference workbook — do not edit by hand (re-run the script).
// Names and hierarchy only (public entity names, no figures). The workbook has NO official identifiers: \`ref\` is an INTERNAL reference id (MREF-<Amanah demo id>-<nnn>,
// numbered in workbook order) and is NOT an official municipality code. It is a hierarchy REFERENCE, not evidence that an invoice belongs to a municipality.
//   kind: 'municipality' · 'amanah_self' (the Amanah itself — NOT a municipality) · 'ministry_hq' (the ministry headquarters row — no Amanah)
//   flags: spelling_variant (the reference spells the name differently) · ministry_hq · amanah_self · name_format (oddly formatted text; sourceNameAr keeps the original) · parent_alias (the reference uses another name for the same Amanah)

export const HIERARCHY_META = ${JSON.stringify(META, null, 2)};

export const HIERARCHY = [
${dataLines}
];

${helpers}`;
fs.writeFileSync(OUT, body);
console.log(`written ${path.relative(process.cwd(), OUT)} (${entries.length} entries)`);
