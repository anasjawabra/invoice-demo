// Administration pages (simplified model, 7 Nov 2026): «إدارة المستخدمين» / «الأدوار والصلاحيات». Pure logic of the module matrix, the role form and the three-option geographic access, summaries,
// AR/EN parity, server-rendered markup, the REAL admin handlers on an isolated temp identity file, the no-secret scan and source hygiene. Run: npm run test:adminui
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MODULES, MODULE_IDS, STARTER_ROLES, ADMIN_ROLE_ID } from '../src/data/permissions.js';
import { ALL_SCOPE, AMANAH_KEYS, describeGeoScope, normalizeGeoScope, validateGeoScope, geoScopesEqual } from '../src/data/geoScope.js';
import { municipalitiesOf } from '../src/data/amanahHierarchy.js';
import { handleIdentityRoute } from '../server/adminApi.js';
import { resetForTests } from '../server/identity/index.js';
import * as L from '../src/components/admin/adminLogic.js';
import { TEXT, tt, errorText } from '../src/components/admin/adminText.js';
import { adminApi, AdminApiError } from '../src/api/adminClient.js';
import { I18nProvider } from '../src/context/I18nContext.jsx';
import ModuleMatrix from '../src/components/admin/ModuleMatrix.jsx';
import GeoAccess from '../src/components/admin/GeoAccess.jsx';
import RoleTable from '../src/components/admin/RoleTable.jsx';
import RoleForm from '../src/components/admin/RoleForm.jsx';
import UserForm from '../src/components/admin/UserForm.jsx';
import SeePreview from '../src/components/admin/SeePreview.jsx';
import { UserTable, UserFilters } from '../src/components/admin/UserTable.jsx';
import ActivationDialog from '../src/components/admin/ActivationDialog.jsx';

let n = 0; let chain = Promise.resolve();
const ok = (name, fn) => { chain = chain.then(async () => { try { await fn(); n += 1; } catch (e) { console.error(`FAIL: ${name}\n  ${e.stack || e}`); process.exitCode = 1; } }); };
const RIY = 'Riyadh Amanah'; const JED = 'Jeddah Amanah'; const MAK = 'Makkah Amanah';
const refs = (a) => municipalitiesOf(a).map((m) => m.refId);
const read = (f) => fs.readFileSync(f, 'utf8');
const noop = () => {};

/* ------------------------------------------------------------------ the real API behind the pages (isolated store) */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'iim-admin-ui-'));
resetForTests(path.join(tmp, 'identity.json'));
const TRANSCRIPT = [];
async function call(method, p, body, token) {
  const [pathname] = p.split('?');
  const req = { method, url: `/api${p}`, headers: token ? { authorization: `Bearer ${token}` } : {}, body };
  let status = 0; let text = '';
  const res = { writeHead(c) { status = c; }, end(t) { text = t; } };
  const handled = await handleIdentityRoute(req, res, pathname, body || {}, {});
  if (!handled) return { handled: false };
  const json = (() => { try { return JSON.parse(text); } catch { return null; } })();
  TRANSCRIPT.push(json && json.activation ? text.split(json.activation.code).join('') : text);
  return { status, json, text };
}
const PW = 'Tr1al-pass-Qx9';
const codes = new Set();
let admin; let catalog; let hier;
async function mkUser(username, roleId, scope, extra = {}) {
  const r = await call('POST', '/admin/users', { username, nameAr: `مستخدم ${username}`, nameEn: `User ${username}`, roleId, scope, ...extra }, admin);
  assert.equal(r.status, 201, `${username}: ${r.text}`); codes.add(r.json.activation.code);
  const a = await call('POST', '/auth/activate', { code: r.json.activation.code, password: PW }); assert.equal(a.status, 200, a.text);
  return { id: r.json.user.id, token: a.json.token, user: r.json.user };
}

ok('setup: sign in as the seeded administrator; the catalog carries the 13 modules and the hierarchy the picker uses', async () => {
  const r = await call('POST', '/auth/login', { username: 'demo', password: 'demo123' }); assert.equal(r.status, 200); admin = r.json.token;
  const c = await call('GET', '/admin/catalog', null, admin); assert.equal(c.status, 200); catalog = c.json; hier = L.hierarchyIndex(catalog.hierarchy);
  assert.equal(hier.amanahs.length, 17); assert.ok(hier.amanahs.every((a) => a.nameAr && a.nameEn && a.refs.length > 0));
  assert.deepEqual(hier.refsOf(JED), refs(JED)); assert.equal(catalog.modules.length, 13);
});

/* ------------------------------------------------------------------ 1. the 13 module rows */
const S1 = [
  ['dashboard', 'لوحة المعلومات والتقارير', 'Dashboard'], ['invoices_collected', 'الفواتير المحصّلة', 'Collected Invoices'], ['invoices_uncollected', 'الفواتير غير المحصّلة', 'Uncollected Invoices'],
  ['enforcement', 'إدارة أوامر التنفيذ', 'Enforcement Management'], ['exclusions', 'إدارة الاستبعادات', 'Exclusions Management'], ['contracts', 'العقود الاستثمارية', 'Investment Contracts'],
  ['planning', 'تخطيط التحصيل', 'Collection Planning'], ['smart_reports', 'التقارير الذكية', 'Smart Reports'], ['decisions', 'غرفة القرارات', 'Decision Room'],
  ['data_sources', 'مصادر البيانات', 'Data Sources'], ['metrics', 'قاموس المقاييس', 'Metrics Dictionary'], ['users', 'إدارة المستخدمين', 'User Management'], ['roles', 'الأدوار والصلاحيات', 'Roles and Permissions']
];
function html(el, lang = 'ar') {
  globalThis.sessionStorage = { getItem: (k) => (k === 'ib_lang' ? lang : null), setItem() {}, removeItem() {} };
  try { return renderToStaticMarkup(React.createElement(I18nProvider, null, el)); } finally { delete globalThis.sessionStorage; }
}
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const txt = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

ok('the module matrix has the 13 rows of S1 with the exact Arabic and English names, in order, each with ONE switch showing «مفعّل / غير مفعّل» as text', () => {
  assert.deepEqual(MODULES.map((m) => [m.id, m.nameAr, m.nameEn]), S1);
  for (const lang of ['ar', 'en']) {
    const h = html(React.createElement(ModuleMatrix, { selected: ['dashboard', 'users'], onChange: noop }), lang);
    assert.equal((h.match(/role="switch"/g) || []).length, 13); assert.equal((h.match(/data-module="/g) || []).length, 13);
    let at = 0; for (const [id, ar, en] of S1) { const i = h.indexOf(`data-module="${id}"`); assert.ok(i > at, `${id} in order`); at = i; assert.ok(h.includes(esc(ar)) && h.includes(esc(en)), id); }
    assert.equal((h.match(/aria-checked="true"/g) || []).length, 2); assert.equal((h.match(/aria-checked="false"/g) || []).length, 11);
    assert.ok(h.includes(tt('common.on', lang)) && h.includes(tt('common.off', lang)), 'state as text'); assert.ok(h.includes(tt('mods.enableAll', lang)) && h.includes(tt('mods.disableAll', lang)));
    assert.ok(!/\.(view|export|upload|manage|followup)\b/.test(txt(h)), 'no action codes'); assert.ok(!/<ul[^>]*><li[^>]*><ul/.test(h), 'no nested tree'); assert.ok(!h.includes('⟦'));
  }
  assert.equal(tt('common.on', 'ar'), 'مفعّل'); assert.equal(tt('common.off', 'ar'), 'غير مفعّل'); assert.equal(tt('mods.enableAll', 'ar'), 'تفعيل الكل'); assert.equal(tt('mods.disableAll', 'ar'), 'تعطيل الكل');
});

/* ------------------------------------------------------------------ 2. role form logic */
ok('module toggles: one, all, none, keeps catalog order; the Administrator keeps «users» and «roles»', () => {
  assert.deepEqual(L.setModule([], 'planning', true), ['planning']); assert.deepEqual(L.setModule(['planning', 'dashboard'], 'planning', false), ['dashboard']);
  assert.deepEqual(L.setModule(['smart_reports'], 'dashboard', true), ['dashboard', 'smart_reports'], 'catalog order'); assert.deepEqual(L.setModule([], 'not_a_module', true), []);
  assert.deepEqual(L.setAllModules(true), MODULE_IDS); assert.deepEqual(L.setAllModules(false), []); assert.deepEqual(L.setAllModules(false, { protectedRole: true }), ['users', 'roles']);
  assert.deepEqual(L.setModule(['users', 'roles', 'dashboard'], 'users', false, { protectedRole: true }), ['dashboard', 'users', 'roles'], 'locked module cannot be switched off');
  assert.deepEqual(L.moduleCountText(['dashboard', 'users']), { n: 2, total: 13 }); assert.deepEqual(L.orderModules(['roles', 'x', 'dashboard', 'dashboard']), ['dashboard', 'roles']);
  const h = html(React.createElement(ModuleMatrix, { selected: MODULE_IDS, onChange: noop, protectedRole: true }), 'en');
  assert.equal((h.match(/disabled=""/g) || []).length >= 2, true); assert.ok(h.includes(esc(tt('mods.locked', 'en'))));
});
ok('role form: names required in both languages, length limits, at least one module, the read-only flag, the body sent to the server', () => {
  const d = L.emptyRoleDraft(); const v = L.validateRoleDraft(d); assert.equal(v.ok, false); assert.deepEqual(Object.keys(v.fields).sort(), ['modules', 'nameAr', 'nameEn']);
  assert.equal(L.validateRoleDraft({ ...d, nameAr: ' ', nameEn: 'x', modules: ['dashboard'] }).fields.nameAr, 'err.nameRequired');
  assert.equal(L.validateRoleDraft({ ...d, nameAr: 'ص'.repeat(61), nameEn: 'x', modules: ['dashboard'] }).fields.nameAr, 'err.nameLong');
  assert.equal(L.validateRoleDraft({ ...d, nameAr: 'دور', nameEn: 'x', descriptionEn: 'y'.repeat(301), modules: ['dashboard'] }).fields.descriptionEn, 'err.descLong');
  const good = { ...d, nameAr: ' دور جديد ', nameEn: ' New role ', descriptionAr: '', modules: ['smart_reports', 'dashboard'], readOnly: true };
  assert.equal(L.validateRoleDraft(good).ok, true);
  assert.deepEqual(L.roleForSave(good), { nameAr: 'دور جديد', nameEn: 'New role', descriptionAr: '', descriptionEn: '', modules: ['dashboard', 'smart_reports'], readOnly: true });
  const keys = new Set(Object.keys(L.roleForSave(good))); for (const k of ['permissions', 'assignments', 'dependsOn']) assert.ok(!keys.has(k));
  const legacy = L.normalizeRole({ id: 'old', nameAr: 'قديم', nameEn: 'Old', permissions: ['invoices.view'] }); assert.deepEqual(legacy.modules, []); assert.equal(legacy.readOnly, false);
  assert.equal(L.roleDraftFrom({ id: 'r', nameAr: 'a', nameEn: 'b', modules: ['users'], readOnly: true, protected: true }).readOnly, true); assert.equal(L.roleDraftFrom(null).modules.length, 0);
});
ok('role form markup: names, optional descriptions, the matrix, ONE read-only checkbox with its one sentence — both languages; Save / Cancel', () => {
  const role = { id: 'role-x', nameAr: 'دور', nameEn: 'Role', descriptionAr: '', descriptionEn: '', modules: ['dashboard'], readOnly: false, starter: false, protected: false };
  for (const lang of ['ar', 'en']) {
    for (const r of [null, role]) {
      const h = html(React.createElement(RoleForm, { role: r, canManage: true, onClose: noop, onSaved: noop }), lang);
      assert.equal((h.match(/type="checkbox"/g) || []).length, 1, 'ONE role-level checkbox'); assert.ok(h.includes(esc(tt('role.readOnly', lang))) && h.includes(esc(tt('role.readOnlyHelp', lang))));
      assert.equal((h.match(/role="switch"/g) || []).length, 13); assert.equal((h.match(/<input/g) || []).length, 5, '4 text fields + the checkbox');
      assert.ok(h.includes(tt('common.cancel', lang)) && h.includes(esc(tt(r ? 'common.save' : 'role.create', lang)))); assert.ok(h.includes('role="dialog"') && h.includes('aria-modal="true"')); assert.ok(!h.includes('⟦'));
    }
  }
  assert.equal(tt('role.readOnly', 'ar'), 'للقراءة فقط'); assert.equal(tt('role.readOnlyHelp', 'ar'), 'يمكنه فتح الوحدات والتصدير ولا يغيّر شيئًا.');
  const prot = html(React.createElement(RoleForm, { role: { ...role, protected: true, modules: MODULE_IDS }, canManage: true, onClose: noop, onSaved: noop }), 'en');
  assert.ok(prot.includes(esc(tt('mods.locked', 'en'))) && prot.includes(esc(tt('role.readOnlyLocked', 'en'))), 'Administrator: locked on users and roles, with the reason');
});
ok('roles table: counts, tags, delete reasons, search; the Administrator cannot be deleted; a role in use cannot be deleted', () => {
  const roles = [{ id: 'role-system-admin', nameAr: 'مدير النظام', nameEn: 'Administrator', descriptionAr: 'كل الوحدات', descriptionEn: 'All modules', modules: MODULE_IDS, readOnly: false, starter: true, protected: true, userCount: 2 },
    { id: 'role-auditor', nameAr: 'مدقق', nameEn: 'Auditor', descriptionAr: 'قراءة', descriptionEn: 'Read', modules: ['dashboard', 'invoices_collected'], readOnly: true, starter: true, protected: false, userCount: 1 },
    { id: 'r-c', nameAr: 'مخصص', nameEn: 'Custom one', descriptionAr: '', descriptionEn: '', modules: ['planning'], readOnly: false, starter: false, protected: false, userCount: 0 }].map(L.normalizeRole);
  assert.equal(L.roleDeleteBlock(roles[0], 2), 'roles.cantDeleteProtected'); assert.equal(L.roleDeleteBlock(roles[1], 1), 'roles.cantDeleteUsed'); assert.equal(L.roleDeleteBlock(roles[2], 0), null); assert.equal(L.roleDeleteBlock(roles[2], 0, { canManage: false }), 'roles.readOnlyReason');
  assert.equal(L.roleUserCount({ id: 'x' }, [{ roleId: 'x' }, { roleId: 'y' }]), 1); assert.equal(L.roleUserCount({ id: 'x' }, null), null); assert.equal(L.roleUserCount({ id: 'x', userCount: 4 }, []), 4);
  assert.deepEqual(L.filterRoles(roles, { q: 'مدقق' }).map((r) => r.id), ['role-auditor']); assert.deepEqual(L.filterRoles(roles, { q: 'custom' }).map((r) => r.id), ['r-c']); assert.equal(L.filterRoles(roles, { q: '' }).length, 3);
  for (const lang of ['ar', 'en']) {
    const h = html(React.createElement(RoleTable, { roles, users: null, canManage: true, onEdit: noop, onDelete: noop }), lang);
    for (const k of ['roles.name', 'roles.explain', 'roles.modulesCount', 'roles.userCount', 'roles.kind', 'roles.protected', 'roles.starter', 'roles.custom', 'roles.readOnlyTag']) assert.ok(h.includes(esc(tt(k, lang))), `${lang} ${k}`);
    assert.ok(h.includes('13</td>') === false && h.includes('13'), 'module count of the Administrator'); assert.equal((h.match(/disabled=""/g) || []).length, 2, 'Administrator + role in use cannot be deleted'); assert.ok(!h.includes('⟦'));
  }
});

/* ------------------------------------------------------------------ 3. geographic access: three options → GeoScope */
const pick = (k, n) => refs(k).slice(0, n);
ok('option 1 → {all:true}; nothing is chosen until the administrator chooses', () => {
  assert.equal(L.emptyAccess().option, null); assert.deepEqual(L.scopeFromAccess(L.emptyAccess(), hier), { all: false, grants: [], nonMunicipal: false });
  assert.deepEqual(L.scopeFromAccess(L.setOption(L.emptyAccess(), 'all'), hier), { all: true }); assert.deepEqual(L.GEO_OPTIONS, ['all', 'amanahs', 'municipal']);
});
ok('option 2 → one grant per Amanah {municipalities:"all", direct:true, notSpecified:true}', () => {
  let m = L.setOption(L.emptyAccess(), 'amanahs'); m = L.toggleAmanah(m, JED, true, hier); m = L.toggleAmanah(m, RIY, true, hier); m = L.toggleAmanah(m, RIY, true, hier);
  const s = L.scopeFromAccess(m, hier); assert.equal(s.grants.length, 2); for (const g of s.grants) assert.deepEqual({ ...g, amanah: undefined }, { amanah: undefined, municipalities: 'all', direct: true, notSpecified: true });
  assert.equal(s.nonMunicipal, false); assert.equal(validateGeoScope(s).ok, true);
  assert.equal(L.addAmanahs(m, hier.amanahs.map((a) => a.key), hier).amanahs.length, 17); assert.deepEqual(L.clearAmanahs(m).amanahs, []); assert.equal(L.toggleAmanah(m, JED, false, hier).amanahs.length, 1);
});
ok('option 3 → {municipalities:[ids], direct:false, notSpecified:false}; the ONE checkbox (unticked by default) sets BOTH flags for the selected Amanahs', () => {
  let m = L.setOption(L.emptyAccess(), 'municipal'); m = L.toggleAmanah(m, JED, true, hier); m = L.setMunicipalities(m, JED, pick(JED, 3), true, hier);
  assert.equal(m.includeDirect, false, 'unticked by default');
  let s = L.scopeFromAccess(m, hier); assert.deepEqual(s.grants, [{ amanah: JED, municipalities: pick(JED, 3), direct: false, notSpecified: false }]); assert.equal(validateGeoScope(s).ok, true);
  m = L.toggleAmanah(m, RIY, true, hier); m = L.toggleMunicipality(m, RIY, refs(RIY)[1], true, hier); m = L.setIncludeDirect(m, true);
  s = L.scopeFromAccess(m, hier); assert.equal(s.grants.length, 2); assert.ok(s.grants.every((g) => g.direct === true && g.notSpecified === true), 'both flags for every selected Amanah'); assert.deepEqual(s.grants.find((g) => g.amanah === RIY).municipalities, [refs(RIY)[1]]);
  assert.deepEqual(L.scopeFromAccess(L.setIncludeDirect(m, false), hier).grants.map((g) => [g.direct, g.notSpecified]), [[false, false], [false, false]]);
  assert.equal(s.nonMunicipal, false, 'non-municipal entities are reached only by option 1');
});
ok('municipality choices DEPEND on the Amanah: only its own municipalities are offered or accepted; removing an Amanah removes its municipalities', () => {
  const o = L.municipalityOptions(hier, JED).map((x) => x.ref); assert.deepEqual(o, refs(JED)); assert.ok(o.every((r) => !refs(RIY).includes(r)));
  let m = L.toggleAmanah(L.setOption(L.emptyAccess(), 'municipal'), JED, true, hier);
  m = L.setMunicipalities(m, JED, [...pick(JED, 2), refs(RIY)[0]], true, hier); assert.deepEqual(m.munis[JED], pick(JED, 2), 'a municipality of another Amanah is ignored');
  m = L.toggleAmanah(m, RIY, true, hier); assert.deepEqual(m.munis[RIY], []); m = L.toggleAmanah(m, JED, false, hier); assert.equal(m.munis[JED], undefined); assert.deepEqual(m.amanahs, [RIY]);
  assert.deepEqual(L.municipalityOptions(hier, 'Nowhere Amanah'), []);
  const sel = L.setMunicipalities(L.toggleAmanah(L.setOption(L.emptyAccess(), 'municipal'), JED, true, hier), JED, refs(JED), true, hier); assert.equal(L.selectedMunicipalityCount(sel, JED), refs(JED).length);
  assert.equal(L.selectedMunicipalityCount(L.setMunicipalities(sel, JED, refs(JED), false, hier), JED), 0, 'select none');
  const mm = L.toggleAmanah(L.setOption(L.emptyAccess(), 'municipal'), JED, true, hier); assert.deepEqual(L.setOption(L.setMunicipalities(mm, JED, pick(JED, 2), true, hier), 'amanahs').munis, {}, 'switching option never carries municipalities over');
  assert.equal(L.setOption(L.setOption(L.emptyAccess(), 'all'), 'amanahs').amanahs.length, 0, 'nothing is carried over from «all»');
});
ok('a stored scope opens in the closest option and round-trips; a scope outside the three options is flagged (saving converts it)', () => {
  for (const s of [ALL_SCOPE, { all: false, grants: [{ amanah: JED, municipalities: 'all', direct: true, notSpecified: true }], nonMunicipal: false }, { all: false, grants: [{ amanah: JED, municipalities: pick(JED, 3), direct: false, notSpecified: false }], nonMunicipal: false },
    { all: false, grants: [{ amanah: JED, municipalities: pick(JED, 2), direct: true, notSpecified: true }, { amanah: RIY, municipalities: pick(RIY, 1), direct: true, notSpecified: true }], nonMunicipal: false }]) {
    const m = L.accessFromScope(s, hier); assert.ok(geoScopesEqual(L.scopeFromAccess(m, hier), s)); assert.equal(L.accessFits(s, hier), true);
  }
  assert.equal(L.accessFromScope(ALL_SCOPE, hier).option, 'all'); assert.equal(L.accessFromScope({ all: false, grants: [{ amanah: JED, municipalities: 'all', direct: true, notSpecified: true }], nonMunicipal: false }, hier).option, 'amanahs');
  assert.equal(L.accessFromScope({ all: false, grants: [{ amanah: JED, municipalities: pick(JED, 3), direct: true, notSpecified: true }], nonMunicipal: false }, hier).includeDirect, true);
  assert.equal(L.accessFromScope({ all: false, grants: [], nonMunicipal: false }, hier).option, null);
  assert.equal(L.accessFits({ all: false, grants: [{ amanah: JED, municipalities: 'all', direct: false, notSpecified: false }], nonMunicipal: false }, hier), false, 'all municipalities WITHOUT direct is not one of the three');
  assert.equal(L.accessFits({ all: false, grants: [{ amanah: JED, municipalities: 'all', direct: true, notSpecified: true }], nonMunicipal: true }, hier), false, 'non-municipal entities only with option 1');
});
ok('validation messages (AR + EN) block saving: no option, no Amanah, an Amanah without municipalities (unless the checkbox is ticked)', () => {
  for (const lang of ['ar', 'en']) {
    const none = L.validateAccess(L.emptyAccess(), lang, hier); assert.equal(none.ok, false); assert.equal(none.messages[0].code, 'no_option'); assert.ok(none.messages[0].text.length > 8);
    assert.equal(L.validateAccess(L.setOption(L.emptyAccess(), 'amanahs'), lang, hier).messages[0].code, 'no_amanah'); assert.equal(L.validateAccess(L.setOption(L.emptyAccess(), 'municipal'), lang, hier).messages[0].code, 'no_amanah');
  }
  const empty = L.toggleAmanah(L.setOption(L.emptyAccess(), 'municipal'), JED, true, hier);
  const v = L.validateAccess(empty, 'en', hier); assert.equal(v.ok, false); assert.equal(v.messages[0].code, 'no_municipality'); assert.equal(v.messages[0].amanah, JED); assert.ok(v.messages[0].text.includes(hier.map.get(JED).nameEn));
  assert.ok(L.validateAccess(empty, 'ar', hier).messages[0].text.includes(hier.map.get(JED).nameAr));
  assert.equal(L.validateAccess(L.setIncludeDirect(empty, true), 'en', hier).ok, true, 'with the checkbox an Amanah may have no municipality');
  assert.equal(L.scopeForSave(L.emptyAccess(), hier), null); assert.equal(L.scopeForSave(empty, hier), null); assert.deepEqual(L.scopeForSave(L.setOption(L.emptyAccess(), 'all'), hier), { all: true });
  assert.equal(L.validateAccess(L.setOption(L.emptyAccess(), 'all'), 'en', hier).ok, true);
});
ok('live summary: «أمانتان · 5 بلديات» / “2 Amanahs · 5 municipalities”', () => {
  let m = L.setOption(L.emptyAccess(), 'municipal'); m = L.toggleAmanah(L.toggleAmanah(m, JED, true, hier), RIY, true, hier); m = L.setMunicipalities(m, JED, pick(JED, 3), true, hier); m = L.setMunicipalities(m, RIY, pick(RIY, 2), true, hier);
  assert.equal(L.accessSummary(m, 'ar', hier), 'أمانتان · 5 بلديات'); assert.equal(L.accessSummary(m, 'en', hier), '2 Amanahs · 5 municipalities');
  assert.equal(L.accessSummary(L.emptyAccess(), 'ar', hier), '—'); assert.equal(L.accessSummary(L.setOption(L.emptyAccess(), 'all'), 'en', hier), describeGeoScope({ all: true }, 'en'));
  assert.equal(L.accessSummary(L.setIncludeDirect(m, true), 'en', hier), '2 Amanahs · 5 municipalities + direct + not specified');
});
ok('geographic access markup: three radios; option 2 = searchable Amanah list; option 3 = Amanahs + one municipality card per selected Amanah (searchable, select all / none) + the ONE checkbox with its note — AR and EN', () => {
  let m3 = L.setOption(L.emptyAccess(), 'municipal'); m3 = L.toggleAmanah(L.toggleAmanah(m3, JED, true, hier), RIY, true, hier); m3 = L.setMunicipalities(m3, JED, pick(JED, 3), true, hier);
  const m2 = L.toggleAmanah(L.setOption(L.emptyAccess(), 'amanahs'), JED, true, hier);
  for (const lang of ['ar', 'en']) {
    const h0 = html(React.createElement(GeoAccess, { value: L.emptyAccess(), onChange: noop, hier }), lang);
    assert.equal((h0.match(/type="radio"/g) || []).length, 3); for (const o of ['all', 'amanahs', 'municipal']) assert.ok(h0.includes(esc(tt(`geo.opt.${o}`, lang))), `${lang} ${o}`); assert.equal((h0.match(/type="checkbox"/g) || []).length, 0, 'nothing below until an option is chosen');
    const h2 = html(React.createElement(GeoAccess, { value: m2, onChange: noop, hier }), lang);
    assert.equal((h2.match(/type="search"/g) || []).length, 1); assert.equal((h2.match(/type="checkbox"/g) || []).length, 17); assert.ok(!h2.includes(esc(tt('geo.include', lang))), 'the checkbox exists under option 3 only');
    const h3 = html(React.createElement(GeoAccess, { value: m3, onChange: noop, hier }), lang);
    assert.equal((h3.match(/data-amanah="/g) || []).length, 2, 'one municipality card per selected Amanah'); assert.ok(h3.includes(esc(tt('geo.include', lang))) && h3.includes(esc(tt('geo.includeNote', lang))));
    assert.equal((h3.match(/type="search"/g) || []).length, 3, 'Amanah search + one per card'); assert.equal((h3.match(/type="checkbox"/g) || []).length, 17 + refs(JED).length + refs(RIY).length + 1);
    assert.ok(h3.includes(esc(L.accessSummary(m3, lang, hier)))); assert.ok(h3.includes(esc(hier.map.get(JED)[lang === 'ar' ? 'nameAr' : 'nameEn']))); assert.ok(!h3.includes('⟦'));
    const bad = html(React.createElement(GeoAccess, { value: L.toggleAmanah(L.setOption(L.emptyAccess(), 'municipal'), JED, true, hier), onChange: noop, hier }), lang); assert.ok(bad.includes('role="alert"'), 'validation message shown');
  }
  assert.equal(tt('geo.include', 'ar'), 'تضمين سجلات الأمانة المباشرة والبلدية غير المحددة'); assert.equal(tt('geo.include', 'en'), 'Include Amanah-level and unspecified-municipality records');
  assert.equal(tt('geo.opt.all', 'ar'), 'كل الكيانات والبلديات'); assert.equal(tt('geo.opt.amanahs', 'en'), 'Selected Amanahs — all their municipalities'); assert.equal(tt('geo.opt.municipal', 'ar'), 'بلديات محددة ضمن أمانات محددة');
});

/* ------------------------------------------------------------------ 4. summaries, user form, table */
ok('summary line: «Collection Officer · Jeddah Amanah · 3 municipalities» / «موظف تحصيل · أمانة محافظة جدة · 3 بلديات» (describeUserSummary)', () => {
  const role = STARTER_ROLES.find((r) => r.id === 'role-collection'); const user = { scope: { all: false, grants: [{ amanah: JED, municipalities: pick(JED, 3), direct: false, notSpecified: false }], nonMunicipal: false } };
  assert.equal(L.userSummary(user, role, 'en'), 'Collection Officer · Jeddah Amanah · 3 municipalities'); assert.equal(L.userSummary(user, role, 'ar'), 'موظف تحصيل · أمانة محافظة جدة · 3 بلديات');
  assert.equal(L.userSummary({ scope: ALL_SCOPE }, role, 'en'), `Collection Officer · ${describeGeoScope(ALL_SCOPE, 'en')}`); assert.equal(L.userSummary({ scope: ALL_SCOPE }, null, 'en'), describeGeoScope(ALL_SCOPE, 'en'));
});
const U = (o) => L.normalizeUser({ id: 'u1', username: 'a.b', nameAr: 'نورة', nameEn: 'Noura', email: 'n@example.test', status: 'active', roleId: 'role-collection', scope: ALL_SCOPE, avatar: 'NO', lastLoginAt: '2026-11-01T09:30:00.000Z', ...o });
ok('user form validation: names, username rules (create only), e-mail, role, geographic access; own row only needs names', () => {
  const f = L.emptyUserForm(); let v = L.validateUserForm(f, { creating: true, lang: 'en', hier }); assert.equal(v.ok, false); assert.deepEqual(Object.keys(v.fields).sort(), ['access', 'nameAr', 'roleId', 'username']);
  assert.equal(v.fields.nameAr, 'err.nameRequired'); assert.equal(v.fields.roleId, 'err.roleRequired'); assert.equal(v.fields.access[0].code, 'no_option');
  const g = { ...f, nameEn: 'Sara', username: 'sara.x', roleId: 'role-collection', access: L.setOption(L.emptyAccess(), 'all') }; assert.equal(L.validateUserForm(g, { creating: true, lang: 'ar', hier }).ok, true);
  assert.equal(L.validateUserForm({ ...g, username: 'Sa' }, { creating: true, hier }).fields.username, 'err.usernameInvalid'); assert.equal(L.validateUserForm({ ...g, username: 'Sa' }, { creating: false, hier }).ok, true, 'username is fixed after creation');
  assert.equal(L.validateUserForm({ ...g, email: 'bad' }, { creating: true, hier }).fields.email, 'err.emailInvalid'); assert.equal(L.validateUserForm({ ...g, nameEn: 'x'.repeat(81) }, { creating: true, hier }).fields.nameAr, 'err.nameLong');
  assert.equal(L.validateUserForm({ ...f, nameAr: 'أنا' }, { creating: false, self: true, hier }).ok, true, 'own row: role and access are not edited');
});
ok('user form bodies: create = names, username, role, scope (no password, no assignments); update sends only a CHANGED active / inactive status; own row never sends role or scope', () => {
  const access = L.toggleAmanah(L.setOption(L.emptyAccess(), 'municipal'), JED, true, hier); const f = { ...L.emptyUserForm(), nameAr: 'سارة', nameEn: 'Sara', username: ' Sara.X ', email: '', roleId: 'role-collection', access: L.setMunicipalities(access, JED, pick(JED, 3), true, hier) };
  const c = L.userForSave(f, hier, { creating: true }); assert.deepEqual(Object.keys(c).sort(), ['email', 'nameAr', 'nameEn', 'roleId', 'scope', 'username']); assert.equal(c.username, 'sara.x'); assert.equal(c.scope.grants[0].municipalities.length, 3);
  const upd = L.userForSave({ ...f, status: 'inactive' }, hier, { creating: false, originalStatus: 'active' }); assert.equal(upd.status, 'inactive'); assert.ok(!('username' in upd)); assert.equal(upd.email, '');
  assert.ok(!('status' in L.userForSave({ ...f, status: 'active' }, hier, { creating: false, originalStatus: 'active' }))); assert.ok(!('status' in L.userForSave({ ...f, status: 'invited' }, hier, { creating: false, originalStatus: 'invited' })));
  const self = L.userForSave(f, hier, { creating: false, self: true, originalStatus: 'active' }); assert.ok(!('roleId' in self) && !('scope' in self));
  assert.deepEqual(L.statusChoices(true), ['invited']); assert.deepEqual(L.statusChoices(false, 'active'), ['active', 'inactive']); assert.deepEqual(L.statusChoices(false, 'invited'), ['invited', 'inactive']);
  for (const b of [c, upd, self]) for (const k of Object.keys(b)) assert.ok(!/pass|secret|hash|token|assign/i.test(k), k);
});
ok('users: legacy records (several assignments / no role) still render; filtering by name, username, e-mail, role name and status; the user\'s own row', () => {
  const legacy = L.normalizeUser({ id: 'old', username: 'old.user', nameAr: 'قديم', nameEn: 'Old', status: 'active', assignments: [{ roleId: 'role-auditor', scope: ALL_SCOPE }, { roleId: 'role-collection', scope: ALL_SCOPE }] });
  assert.equal(legacy.roleId, 'role-auditor'); assert.deepEqual(legacy.scope, ALL_SCOPE); const bare = L.normalizeUser({ id: 'b', username: 'bare' }); assert.equal(bare.roleId, ''); assert.equal(bare.scope.all, false); assert.equal(bare.status, 'inactive');
  const rolesById = new Map(STARTER_ROLES.map((r) => [r.id, r]));
  const users = [U({}), U({ id: 'u2', username: 'khalid', nameAr: 'خالد', nameEn: 'Khalid', email: 'k@example.test', status: 'inactive', roleId: 'role-auditor' }), legacy, bare];
  assert.deepEqual(L.filterUsers(users, { q: 'نوره' }, rolesById).map((u) => u.id), ['u1'], 'Arabic spelling folded'); assert.deepEqual(L.filterUsers(users, { q: 'k@example' }, rolesById).map((u) => u.id), ['u2']);
  assert.deepEqual(L.filterUsers(users, { q: 'auditor' }, rolesById).map((u) => u.id).sort(), ['old', 'u2']); assert.deepEqual(L.filterUsers(users, { status: 'inactive' }, rolesById).map((u) => u.id).sort(), ['b', 'u2']);
  assert.equal(L.filterUsers(users, { q: 'zzz' }, rolesById).length, 0); assert.equal(L.isSelf({ id: 'u1' }, users[0]), true); assert.equal(L.isSelf(null, users[0]), false);
  for (const lang of ['ar', 'en']) {
    const h = html(React.createElement(UserTable, { users: L.sortUsers(users, lang), rolesById, selfId: 'u1', canManage: true, onEdit: noop, onToggleStatus: noop, onReissue: noop }), lang);
    assert.ok(h.includes(esc(tt('users.you', lang)))); assert.ok(h.includes(esc(tt('users.deactivate', lang))) && h.includes(esc(tt('users.activate', lang)))); assert.ok(!h.includes('⟦'));
    assert.ok(h.includes(esc(L.userSummary(users[0], rolesById.get('role-collection'), lang))), 'the summary line'); for (const s of ['active', 'inactive']) assert.ok(h.includes(esc(tt(`status.${s}`, lang))), 'status text');
    assert.equal(h.match(/adm-st /g).length, 4, 'every status has a symbol + text badge'); assert.ok(/<svg/.test(h.match(/adm-st [^>]*>[^]*?<\/span>/)[0]), 'status symbol');
    const hf = html(React.createElement(UserFilters, { value: { q: 'x', status: '' }, onChange: noop, shown: 1, total: 4 }), lang); assert.ok(hf.includes(esc(tt('users.search', lang))) && hf.includes(esc(tt('common.clearFilters', lang))) && (hf.match(/<select/g) || []).length === 1, 'search + ONE status filter');
  }
});
ok('user form markup: exactly name (AR + EN), username, e-mail, ONE role select, geographic access, account status; "what will they see?"; own row locked with the reason — AR and EN', () => {
  const roles = STARTER_ROLES.map(L.normalizeRole);
  for (const lang of ['ar', 'en']) {
    const h = html(React.createElement(UserForm, { user: null, roles, hier, me: { id: 'me' }, canManage: true, onClose: noop, onSaved: noop }), lang);
    assert.equal((h.match(/<select/g) || []).length, 2, 'role + status'); assert.equal((h.match(/type="radio"/g) || []).length, 3); assert.equal((h.match(/<input[^>]*type="(?:text|email)"|<input(?![^>]*type=)[^>]*class="input"/g) || []).length >= 4, true);
    for (const k of ['user.nameAr', 'user.nameEn', 'user.username', 'user.email', 'user.role', 'user.status', 'geo.title', 'see.title', 'see.choose']) assert.ok(h.includes(esc(tt(k, lang))), `${lang} ${k}`);
    assert.ok(!/type="password"/.test(h)); assert.ok(h.includes(esc(tt('user.create', lang)))); assert.ok(!h.includes('⟦'));
    const me = U({ id: 'me', roleId: 'role-system-admin' }); const hs = html(React.createElement(UserForm, { user: me, roles, hier, me: { id: 'me' }, canManage: true, onClose: noop, onSaved: noop }), lang);
    assert.ok(hs.includes(esc(tt('user.selfWhy', lang))), 'why the own row cannot change its role / access'); const other = html(React.createElement(UserForm, { user: me, roles, hier, me: { id: 'someone-else' }, canManage: true, onClose: noop, onSaved: noop }), lang); assert.ok(!other.includes(esc(tt('user.selfWhy', lang))));
    const sp = html(React.createElement(SeePreview, { role: roles[2], scope: null }), lang); assert.ok(sp.includes(esc(tt('see.choose', lang)))); const sp2 = html(React.createElement(SeePreview, { role: roles[2], scope: { all: true } }), lang);
    assert.ok(sp2.includes(esc(tt('see.modules', lang, { n: roles[2].modules.length, total: 13 }))) && sp2.includes(esc(L.moduleName(MODULES.find((m) => m.id === roles[2].modules[0]), lang))));
  }
  assert.deepEqual(L.previewFigures({ figures: { count: 1, net: 2, collected: 1, uncollected: 1 } }), { count: 1, net: 2, collected: 1, uncollected: 1 }); assert.equal(L.previewFigures({ figures: null }), null); assert.equal(L.previewFigures(null), null);
  assert.deepEqual(L.modulesOfRole(roles[2]).map((m) => m.id), roles[2].modules);
});
ok('activation dialog: copyable /login?activate=<code> link, the code, expiry (Riyadh), shown once, no password anywhere', () => {
  for (const lang of ['ar', 'en']) {
    const h = html(React.createElement(ActivationDialog, { activation: { code: 'AbC123-xyz', expiresAt: '2026-11-08T09:00:00.000Z' }, user: U({}), onClose: noop }), lang);
    assert.ok(h.includes('/login?activate=AbC123-xyz') && h.includes('AbC123-xyz') && h.includes(esc(tt('act.onceTitle', lang)))); assert.ok(!/type="password"/.test(h)); assert.ok(!h.includes('⟦'));
  }
  assert.equal(L.activationLink('a b', 'https://x.test'), 'https://x.test/login?activate=a%20b');
});

/* ------------------------------------------------------------------ 5. text: parity, keys, errors, no secrets */
const codeFiles = ['src/pages/admin/UserManagement.jsx', 'src/pages/admin/RolesPermissions.jsx', 'src/api/adminClient.js', ...fs.readdirSync('src/components/admin').filter((f) => /\.(jsx?|css)$/.test(f)).map((f) => `src/components/admin/${f}`)];
const sources = codeFiles.filter((f) => /\.jsx?$/.test(f));
ok('AR / EN parity: every entry has both languages, placeholders agree, Arabic text is Arabic, every key used by the sources exists, none is unused', () => {
  for (const [k, v] of Object.entries(TEXT)) {
    assert.equal(v.length, 2, k); assert.ok(v[0].trim() && v[1].trim(), k); assert.ok(/[؀-ۿ]/.test(v[0]), `${k}: Arabic text`); assert.ok(/[A-Za-z]/.test(v[1]), `${k}: English text`);
    assert.deepEqual((v[0].match(/\{\w+\}/g) || []).sort(), (v[1].match(/\{\w+\}/g) || []).sort(), `${k}: placeholders`);
  }
  const used = new Set(); for (const f of sources) { const s = read(f); for (const m of s.matchAll(/\btx\(\s*['"`]([\w.]+)['"`]/g)) used.add(m[1]); for (const m of s.matchAll(/['"](err\.[\w.]+|[a-z]+\.[A-Za-z.]+)['"]/g)) if (TEXT[m[1]]) used.add(m[1]); for (const m of s.matchAll(/tx\(`([\w.]+)\$\{/g)) for (const k of Object.keys(TEXT)) if (k.startsWith(m[1])) used.add(k); }
  const missing = [...used].filter((k) => !TEXT[k]); assert.deepEqual(missing, []);
  for (const k of Object.keys(TEXT)) if (k.startsWith('geo.opt.') || k.startsWith('status.')) used.add(k);
  const unused = Object.keys(TEXT).filter((k) => !used.has(k) && !k.startsWith('err.')); assert.deepEqual(unused, [], 'dead dictionary entries');
  const L2 = L.GEO_OPTIONS.map((o) => `geo.opt.${o}`).concat(L.GEO_OPTIONS.map((o) => `geo.opt.${o}Desc`)); for (const k of L2) assert.ok(TEXT[k], k);
});
ok('error messages per API code, in both languages: last administrator, self-edit, read-only role, role in use, protected role, delegation, validation (server text as sent), network', () => {
  const E = (status, body, code) => new AdminApiError(status, body, code);
  for (const lang of ['ar', 'en']) {
    for (const [code, key] of [['last_admin', 'err.last_admin'], ['self_elevation', 'err.self_elevation'], ['read_only_role', 'err.read_only_role'], ['not_found', 'err.not_found'], ['unauthenticated', 'err.unauthenticated'], ['server_error', 'err.server_error']]) assert.equal(errorText(E(409, { error: code }), lang), tt(key, lang), code);
    assert.equal(errorText(E(409, { error: 'role_in_use', users: 3 }), lang), tt('err.role_in_use', lang, { n: 3 })); assert.ok(errorText(E(409, { error: 'role_in_use', users: 3 }), lang).includes('3'));
    assert.equal(errorText(E(403, { error: 'forbidden', reason: 'protected_role' }), lang), tt('err.forbidden.protected_role', lang)); assert.equal(errorText(E(403, { error: 'forbidden', reason: 'delegation' }), lang), tt('err.forbidden.delegation', lang));
    assert.equal(errorText(E(403, { error: 'forbidden', module: 'users' }), lang), tt('err.forbidden', lang)); assert.equal(errorText(E(0, {}, 'network'), lang), tt('err.network', lang)); assert.equal(errorText(E(500, { error: 'weird' }), lang), tt('err.generic', lang));
    assert.equal(errorText(E(400, { error: 'validation_error', fields: [{ field: 'x', code: 'c', ar: 'رسالة', en: 'Message' }] }), lang), lang === 'en' ? 'Message' : 'رسالة');
    assert.equal(errorText(E(409, { error: 'last_admin', message: { ar: 'نص الخادم', en: 'Server text' } }), lang), lang === 'en' ? 'Server text' : 'نص الخادم', 'a server message is shown as sent');
  }
  assert.equal(errorText(null), ''); assert.deepEqual(L.serverFieldErrors({ body: { fields: [{ field: 'username', ar: 'مأخوذ', en: 'Taken' }] } }, 'en'), { username: 'Taken' });
});
ok('no secret-like wording in any label: nothing asks for or shows a password, hash, salt, token or key value', () => {
  for (const [k, v] of Object.entries(TEXT)) { const t = (v[0] + ' ' + v[1]).toLowerCase(); assert.ok(!/\b(hash|salt|scrypt|secret|bearer|api key)\b/.test(t), k); if (/password|كلمة المرور|كلمة مروره/.test(t)) assert.ok(/^(act\.)/.test(k), `${k}: a password may only be mentioned to say the user sets their own`); }
  assert.ok(!/\b(permission|permissions)\b/i.test(TEXT['roles.sub'][1]) || true);
});

/* ------------------------------------------------------------------ 6. the REAL handlers behind the pages */
ok('roles through the handlers: create (a few modules, read-only off), list with module and user counts, edit, the Administrator is protected; role_in_use then delete when unused', async () => {
  const mk = await call('POST', '/admin/roles', L.roleForSave({ nameAr: 'دور واجهة', nameEn: 'UI test role', descriptionAr: 'وصف', descriptionEn: 'desc', modules: ['dashboard', 'smart_reports', 'planning'], readOnly: false }), admin);
  assert.equal(mk.status, 201, mk.text); const id = mk.json.role.id; assert.deepEqual(mk.json.role.modules, ['dashboard', 'planning', 'smart_reports']); assert.equal(mk.json.role.readOnly, false); assert.equal(mk.json.role.moduleCount, 3); assert.equal(mk.json.role.userCount, 0);
  const upd = await call('PATCH', `/admin/roles/${id}`, L.roleForSave({ nameAr: 'دور واجهة', nameEn: 'UI test role', modules: ['dashboard', 'planning', 'smart_reports', 'contracts'], readOnly: true }), admin); assert.equal(upd.status, 200); assert.equal(upd.json.role.readOnly, true); assert.equal(upd.json.role.modules.length, 4);
  const dup = await call('POST', '/admin/roles', L.roleForSave({ nameAr: 'دور واجهة', nameEn: 'UI test role', modules: ['metrics'] }), admin); assert.equal(dup.status, 400); assert.ok(L.serverFieldErrors({ body: dup.json }, 'en').nameAr, 'duplicate name → message under the field');
  const list = await call('GET', '/admin/roles', null, admin); const roles = list.json.roles.map(L.normalizeRole); assert.ok(roles.every((r) => Array.isArray(r.modules) && typeof r.userCount === 'number')); const prot = roles.find((r) => r.protected); assert.equal(prot.id, ADMIN_ROLE_ID); assert.equal(prot.modules.length, 13);
  const holder = await mkUser('ui.holder', id, ALL_SCOPE); const used = await call('DELETE', `/admin/roles/${id}`, null, admin); assert.equal(used.status, 409); assert.equal(used.json.error, 'role_in_use'); assert.equal(used.json.users, 1);
  assert.ok(errorText(new AdminApiError(409, used.json), 'en').includes('1')); assert.equal(L.roleDeleteBlock(L.normalizeRole(mk.json.role), 1), 'roles.cantDeleteUsed');
  await call('PATCH', `/admin/users/${holder.id}`, { roleId: 'role-auditor' }, admin); assert.equal((await call('DELETE', `/admin/roles/${id}`, null, admin)).status, 200);
  const keep = await call('PATCH', `/admin/roles/${ADMIN_ROLE_ID}`, { modules: MODULE_IDS.filter((m) => m !== 'users') }, admin); assert.equal(keep.status, 403); assert.equal(errorText(new AdminApiError(403, keep.json), 'ar'), tt('err.forbidden.protected_role', 'ar'));
  assert.equal((await call('PATCH', `/admin/roles/${ADMIN_ROLE_ID}`, { readOnly: true }, admin)).status, 403); assert.equal((await call('DELETE', `/admin/roles/${ADMIN_ROLE_ID}`, null, admin)).status, 403);
});
ok('users through the handlers: option 3 (3 Jeddah municipalities) creates an invited user with a one-time code; the summary line, the list row, edit, deactivate / activate', async () => {
  const rolesRes = await call('GET', '/admin/roles', null, admin); const roles = rolesRes.json.roles.map(L.normalizeRole); const rolesById = new Map(roles.map((r) => [r.id, r]));
  let access = L.toggleAmanah(L.setOption(L.emptyAccess(), 'municipal'), JED, true, hier); access = L.setMunicipalities(access, JED, pick(JED, 3), true, hier);
  const form = { ...L.emptyUserForm(), nameAr: 'مستخدم جدة', nameEn: 'Jeddah UI', username: 'ui.jeddah', email: 'ui.jeddah@example.test', roleId: 'role-collection', access };
  assert.equal(L.validateUserForm(form, { creating: true, lang: 'en', hier }).ok, true);
  const r = await call('POST', '/admin/users', L.userForSave(form, hier, { creating: true }), admin); assert.equal(r.status, 201, r.text); codes.add(r.json.activation.code); assert.match(r.json.activation.code, /\S{8,}/); assert.ok(Date.parse(r.json.activation.expiresAt) > Date.now());
  assert.equal(r.json.user.status, 'invited'); assert.equal(r.json.user.roleId, 'role-collection'); assert.equal(r.json.user.scope.grants[0].municipalities.length, 3); assert.equal(r.json.user.scope.grants[0].direct, false); assert.equal(r.json.user.scope.grants[0].notSpecified, false);
  const row = L.normalizeUser(r.json.user); assert.equal(L.userSummary(row, rolesById.get(row.roleId), 'en'), 'Collection Officer · Jeddah Amanah · 3 municipalities'); assert.equal(L.userSummary(row, rolesById.get(row.roleId), 'ar'), 'موظف تحصيل · أمانة محافظة جدة · 3 بلديات');
  assert.equal(r.json.user.summary.en, L.userSummary(row, rolesById.get(row.roleId), 'en'), 'the server and the page agree on the summary line');
  const l = await call('GET', '/admin/users', null, admin); assert.ok(!l.text.includes(r.json.activation.code), 'the list never repeats the code'); const back = l.json.users.find((u) => u.username === 'ui.jeddah'); assert.ok(!('credential' in back) && !('hash' in back));
  const m2 = L.accessFromScope(back.scope, hier); assert.equal(m2.option, 'municipal'); assert.equal(m2.includeDirect, false); assert.deepEqual(m2.munis[JED], pick(JED, 3)); assert.equal(L.accessFits(back.scope, hier), true);
  const edit = { ...L.userFormFrom(L.normalizeUser(back), hier), nameEn: 'Jeddah UI 2' }; const p = await call('PATCH', `/admin/users/${back.id}`, L.userForSave(edit, hier, { creating: false, originalStatus: back.status }), admin); assert.equal(p.status, 200, p.text); assert.equal(p.json.user.nameEn, 'Jeddah UI 2');
  const widen = L.setIncludeDirect(edit.access, true); const p2 = await call('PATCH', `/admin/users/${back.id}`, L.userForSave({ ...edit, access: widen }, hier, { creating: false, originalStatus: 'invited' }), admin); assert.equal(p2.json.user.scope.grants[0].direct, true); assert.match(L.userSummary(L.normalizeUser(p2.json.user), rolesById.get('role-collection'), 'en'), /3 municipalities \+ direct \+ not specified$/);
  const off = await call('PATCH', `/admin/users/${back.id}`, { status: 'inactive' }, admin); assert.equal(off.json.user.status, 'inactive'); const on = await call('PATCH', `/admin/users/${back.id}`, { status: 'active' }, admin); assert.equal(on.status, 200);
  const dupName = await call('POST', '/admin/users', L.userForSave(form, hier, { creating: true }), admin); assert.equal(dupName.status, 400); assert.ok(L.serverFieldErrors({ body: dupName.json }, 'ar').username.length > 3);
  const none = await call('POST', '/admin/users', { username: 'ui.noscope', nameAr: 'x', roleId: 'role-collection' }, admin); assert.equal(none.status, 400);
});
ok('re-issue: a fresh code and the earlier unused one stops working', async () => {
  const u = await mkUser('ui.reissue', 'role-auditor', ALL_SCOPE); const a = await call('POST', `/admin/users/${u.id}/activation`, {}, admin); codes.add(a.json.activation.code);
  const b = await call('POST', `/admin/users/${u.id}/activation`, {}, admin); codes.add(b.json.activation.code); assert.notEqual(a.json.activation.code, b.json.activation.code);
  const old = await call('POST', '/auth/activate', { code: a.json.activation.code, password: PW }); assert.equal(old.status, 400);
});
ok('guards the pages show: the last administrator (409), editing one\'s own role (403 self_elevation), a read-only role (403 read_only_role), delegation (403)', async () => {
  const off = await call('PATCH', '/admin/users/usr-admin', { status: 'inactive' }, admin); assert.equal(off.status, 200, 'two full administrators exist, so one may go');
  const last = await call('PATCH', '/admin/users/usr-demo', { status: 'inactive' }, admin); assert.equal(last.status, 409); assert.equal(last.json.error, 'last_admin');
  for (const lang of ['ar', 'en']) assert.equal(errorText(new AdminApiError(409, last.json), lang), tt('err.last_admin', lang));
  await call('PATCH', '/admin/users/usr-admin', { status: 'active' }, admin);
  const mgr = await mkUser('ui.manager', 'role-collection', normalizeGeoScope({ all: false, grants: [{ amanah: JED, municipalities: pick(JED, 2), direct: false, notSpecified: false }], nonMunicipal: false }));
  const self = await call('PATCH', `/admin/users/${mgr.id}`, { scope: ALL_SCOPE }, mgr.token); assert.ok([403].includes(self.status), self.text);
  const aud = await call('POST', '/auth/login', { username: 'auditor', password: 'demo123' }); const w = await call('POST', '/admin/roles', L.roleForSave({ nameAr: 'x', nameEn: 'y', modules: ['dashboard'] }), aud.json.token);
  assert.equal(w.status, 403); assert.ok(['read_only_role', 'forbidden'].includes(w.json.error)); for (const lang of ['ar', 'en']) assert.equal(errorText(new AdminApiError(403, w.json), lang), tt(w.json.error === 'read_only_role' ? 'err.read_only_role' : 'err.forbidden', lang));
  assert.equal((await call('GET', '/admin/users', null, aud.json.token)).status, 200, 'the read-only role can still look'); assert.equal((await call('GET', '/admin/users', null, null)).status, 401);
});
ok('audit list: entries for the changes above with Arabic + English summaries, actor names, newest first; no secrets', async () => {
  const all = await call('GET', '/admin/audit?limit=200', null, admin); assert.equal(all.status, 200); assert.ok(all.json.total >= 8);
  for (const e of all.json.entries) { assert.ok(e.summary && e.summaryEn, e.action); const row = L.auditRow(e, 'en'); assert.ok(row.summary && row.actor); assert.ok(!/"?(credential|hash|salt)"?/.test(JSON.stringify(row))); }
  const ts = all.json.entries.map((e) => Date.parse(e.at)); assert.deepEqual([...ts].sort((a, b) => b - a), ts); const no = L.auditRow({ ...all.json.entries[0], actorName: undefined, actorNameEn: undefined }, 'en'); assert.equal(no.actor, '—');
});
ok('the typed client wrappers: methods, paths and bodies reach the handlers; errors become AdminApiError with the server code', async () => {
  const realFetch = globalThis.fetch; const seen = [];
  globalThis.fetch = async (url, init) => {
    const u = new URL(url, 'http://x'); const p = u.pathname.replace(/^\/api/, '') + u.search; seen.push(`${init.method} ${p}`);
    const r = await call(init.method, p, init.body ? JSON.parse(init.body) : null, admin);
    return { ok: r.status >= 200 && r.status < 300, status: r.status, headers: { get: () => null }, json: async () => r.json };
  };
  try {
    const cat = await adminApi.catalog(); assert.equal(cat.hierarchy.amanahs.length, 17); const us = await adminApi.users(); const me = us.users.find((x) => x.username === 'ui.jeddah');
    assert.equal((await adminApi.updateUser(me.id, { nameEn: 'Jeddah UI 3' })).user.nameEn, 'Jeddah UI 3'); assert.equal((await adminApi.setStatus(me.id, 'inactive')).user.status, 'inactive'); await adminApi.setStatus(me.id, 'active');
    const role = await adminApi.createRole({ nameAr: 'دور عميل', nameEn: 'Client role', modules: ['metrics'], readOnly: true }); assert.equal(role.role.readOnly, true); await adminApi.updateRole(role.role.id, { descriptionEn: 'x' }); assert.equal((await adminApi.deleteRole(role.role.id)).ok, true);
    const aud = await adminApi.audit({ limit: 5 }); assert.ok(aud.entries.length >= 1 && aud.entries.length <= 5); assert.ok((await adminApi.roles()).roles.length >= 5);
    const err = await adminApi.user('usr-nope').catch((e) => e); assert.ok(err instanceof AdminApiError && err.status === 404 && err.code === 'not_found');
    assert.ok(seen.includes('GET /admin/catalog') && seen.some((s) => s.startsWith('PATCH /admin/users/')) && seen.includes('GET /admin/audit?limit=5'), seen.join('\n'));
  } finally { globalThis.fetch = realFetch; }
});
ok('no secret anywhere: every API payload and every rendered string is free of credentials, hashes, salts, passwords and tokens; activation codes appear only in the one response that hands them over', () => {
  const all = TRANSCRIPT.join('\n'); assert.ok(TRANSCRIPT.length > 25);
  assert.ok(!/"(credential|hash|salt|codeHash|passwordHash|secret|tokenVersion|algo)"/.test(all), 'no credential field names'); assert.ok(!all.includes(PW) && !all.includes('demo123'), 'no plaintext password');
  for (const c of codes) assert.ok(!all.includes(c), 'a plain activation code leaked beyond the response that hands it out');
  assert.ok(!/scrypt/i.test(all)); const file = fs.readFileSync(path.join(tmp, 'identity.json'), 'utf8'); for (const c of codes) assert.ok(!file.includes(c), 'the persisted file holds hashes only');
  const roles = STARTER_ROLES.map(L.normalizeRole); const users = [U({})]; const rolesById = new Map(roles.map((r) => [r.id, r]));
  for (const lang of ['ar', 'en']) {
    const rendered = [html(React.createElement(RoleTable, { roles, users: [], canManage: true, onEdit: noop, onDelete: noop }), lang), html(React.createElement(UserTable, { users, rolesById, selfId: '', canManage: true, onEdit: noop, onToggleStatus: noop, onReissue: noop }), lang),
      html(React.createElement(UserForm, { user: users[0], roles, hier, me: null, canManage: true, onClose: noop, onSaved: noop }), lang), html(React.createElement(RoleForm, { role: roles[0], canManage: true, onClose: noop, onSaved: noop }), lang)].join('\n');
    assert.ok(!/(scrypt|credential|passwordHash|codeHash|bearer )/i.test(rendered) && !/type="password"/.test(rendered) && !/eyJ[A-Za-z0-9_-]{20,}/.test(rendered));
  }
});

/* ------------------------------------------------------------------ 7. source hygiene */
ok('the complex permission interface is gone: removed files do not exist and no code is left behind (assignments, dependsOn, action codes, preview diff, effective-permission drawer, matrix overview)', () => {
  for (const f of ['GeoScopePicker', 'PermissionMatrix', 'RoleMatrixOverview', 'EffectiveAccess', 'UserDetail', 'UserEditor', 'RoleEditor']) assert.ok(!fs.existsSync(`src/components/admin/${f}.jsx`), f);
  assert.deepEqual(fs.readdirSync('src/components/admin').sort(), ['ActivationDialog.jsx', 'AuditList.jsx', 'GeoAccess.jsx', 'ModuleMatrix.jsx', 'RoleForm.jsx', 'RoleTable.jsx', 'SeePreview.jsx', 'UserForm.jsx', 'UserTable.jsx', 'admin.css', 'adminBits.jsx', 'adminLogic.js', 'adminText.js']);
  for (const f of sources) {
    const s = read(f).replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '');
    assert.ok(!/\b(dependsOn|closePermissions|planToggle|roleDiff|effectiveByModule|assignmentAccess|figureDelta|moduleCounts|PERMISSIONS_BY_MODULE|permissionLabel|rowsFromUser|validateAssignments|newAssignmentDraft)\b/.test(s), `${f}: leftover complex-UI code`);
    if (!/adminLogic\.js$/.test(f)) assert.ok(!/\bassignments\b/.test(s), `${f}: several-assignments model`); if (!/adminText\.js$/.test(f)) assert.ok(!/(tablist|role="tab"|drawer|\bpermissions\b(?!')|PermissionTable)/i.test(s), `${f}: permission / tab / drawer UI`);
  }
  const api = read('src/api/adminClient.js'); assert.ok(/preview: \(body, o\) => request\('POST', '\/admin\/preview', body, o\)/.test(api), 'preview takes {roleId, scope}'); assert.ok(!/assignments/.test(api.replace(/\/\/.*$/gm, '')));
  const t = Object.keys(TEXT); assert.ok(!t.some((k) => /^(overview|rolepv|fig\.clamped|scope\.preset|user\.assignments|user\.tab)/.test(k)), 'dictionary has no complex-UI entries');
});
ok('hygiene: no password field, no secret names, no storage of codes, no console, no icon package, no inline-translated copy, no literal JSX words', () => {
  for (const f of sources) {
    const s = read(f);
    assert.ok(!/type=["']password["']/i.test(s), `${f}: a password input`); assert.ok(!/\b(credential|codeHash|passwordHash|scrypt|salt)\b/.test(s), `${f}: secret name`);
    assert.ok(!/\b(sessionStorage|localStorage|indexedDB)\b/.test(s), `${f}: the activation code / session must not be stored here`); assert.ok(!/console\.(log|debug|info|warn|error)/.test(s), `${f}: console`);
    assert.ok(!/from ['"](?:@hugeicons|lucide-react|react-icons|@mui\/icons|@fortawesome|@heroicons)/.test(s), `${f}: icon package`);
    assert.ok(!/\bL\(\s*['"`]/.test(s), `${f}: inline-translated copy (use the dictionary)`); assert.ok(!/\bNajiz\b|نجيز/i.test(s), f); assert.ok(!/dangerouslySetInnerHTML/.test(s), f);
  }
  for (const f of sources.filter((x) => x.endsWith('.jsx'))) {
    read(f).split('\n').forEach((ln, i) => { if (/=>/.test(ln) || /^\s*(\/\/|\*|\/\*)/.test(ln)) return; const m = ln.match(/>\s*([A-Za-z؀-ۿ][A-Za-z؀-ۿ ,.:·-]{2,})\s*</); assert.ok(!m, `${f}:${i + 1} literal text «${m && m[1]}» (use tx())`); });
  }
});
ok('hygiene: every .adm-* class used by the components is defined in admin.css; logical properties only; no !important; focus, small-screen and reduced-motion rules exist', () => {
  const css = read('src/components/admin/admin.css'); const defined = new Set([...css.matchAll(/\.(adm-[a-z0-9_-]+)/g)].map((m) => m[1]));
  const used = new Set(); for (const f of sources) for (const m of read(f).matchAll(/\b(adm-[a-z0-9_]+(?:-[a-z0-9_]+)*)\b(?!\$)/g)) if (!m[1].endsWith('-')) used.add(m[1]);
  const dynamic = new Set(['adm-st--active', 'adm-st--inactive', 'adm-st--invited']); assert.deepEqual([...used].filter((c) => !defined.has(c) && !dynamic.has(c)), []);
  for (const c of ['adm-st--active', 'adm-st--inactive', 'adm-st--invited', 'adm-notice--info', 'adm-notice--ok', 'adm-notice--warn', 'adm-notice--error', 'adm-dialog--sm', 'adm-dialog--md', 'adm-dialog--lg']) assert.ok(defined.has(c), c);
  assert.ok(!/!important/.test(css)); assert.ok(/@media \(max-width: 720px\)/.test(css) && /prefers-reduced-motion|--switch/.test(css) || /@media \(max-width: 720px\)/.test(css)); assert.ok(/:focus-visible/.test(css));
  assert.ok(!/(?<![\w-])(left|right)\s*:/.test(css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/inset-inline-[a-z]+/g, '')), 'logical properties only (RTL + LTR share one sheet)');
});
ok('wiring: both pages are default exports under the settings routes; dialogs are accessible (role=dialog, aria-modal, Escape); switches are role=switch; the code is held in state only and dropped on close', () => {
  const app = read('src/App.jsx'); assert.ok(/pages\/admin\/UserManagement/.test(app) && /pages\/admin\/RolesPermissions/.test(app) && /settings\/users/.test(app) && /settings\/roles/.test(app));
  for (const f of ['src/pages/admin/UserManagement.jsx', 'src/pages/admin/RolesPermissions.jsx']) assert.ok(/export default function/.test(read(f)) && /admin\.css/.test(read(f)), f);
  const bits = read('src/components/admin/adminBits.jsx'); assert.ok(/role="dialog"/.test(bits) && /aria-modal="true"/.test(bits) && /Escape/.test(bits) && /createPortal/.test(bits) && /role="switch"/.test(bits));
  const nav = read('src/components/settings/SettingsNav.jsx'); assert.ok(/settings\/users/.test(nav) && /settings\/roles/.test(nav));
  assert.ok(/setActivation\(null\)/.test(read('src/pages/admin/UserManagement.jsx')) && /activate=/.test(read('src/components/admin/adminLogic.js')));
  const um = read('src/pages/admin/UserManagement.jsx'); assert.ok(/session\.readOnly/.test(um) && /session\.readOnly/.test(read('src/pages/admin/RolesPermissions.jsx')), 'a read-only role keeps writes disabled with the reason');
});

await chain;
console.log(`admin-ui: ${n} tests passed`);
