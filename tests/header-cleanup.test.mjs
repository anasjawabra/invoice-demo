// Shared header cleanup (agent H): NO organisation / persona switcher, NO notification bell / badge, the user menu shows the REAL signed-in account (name + role, initials generated from the displayed name),
// the language selector and the theme toggle work, and the authorised entity scope comes ONLY from the authenticated account (access.effectiveScope). Also: ONE identity per person (no language-specific persona), with an
// in-place migration of an old-shape identity store. Server-side render of the REAL components over a REAL (in-memory) identity store. Run: npm run test:headerclean
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server.js';
import { I18nProvider } from '../src/context/I18nContext.jsx';
import { ThemeProvider } from '../src/context/ThemeContext.jsx';
import { AuthProvider, useAccess, useAuth } from '../src/context/AuthContext.jsx';
import { UserMenu, UserBlock } from '../src/components/header/UserMenu.jsx';
import ThemeToggle from '../src/components/header/ThemeToggle.jsx';
import LanguageSwitch from '../src/components/header/LanguageSwitch.jsx';
import * as session from '../src/api/session.js';
import { resetForTests, login as svcLogin, reloadFromDisk, getDb, dbFile } from '../server/identity/index.js';
import { displayName, initialsOf, initialsFor } from '../src/utils/identity.js';
import { actorName } from '../src/utils/actor.js';
import { userOf, buildAccess, roleName } from '../src/data/accessModel.js';
import { translations } from '../src/data/i18n.js';
import { RIYADH_KEY } from './_headerFixtures.mjs';

let n = 0; const ok = async (name, fn) => { try { await fn(); } catch (e) { e.message = `[${name}] ${e.message}`; throw e; } n += 1; };
const E = React.createElement;
const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const text = (h) => h.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const store = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; };

/* ---------------- a REAL identity store (seeded accounts) and real `me` documents ---------------- */
resetForTests(':memory:');
const ME = {
  demo: svcLogin({ username: 'demo', password: 'demo123' }).me,
  auditor: svcLogin({ username: 'auditor', password: 'demo123' }).me,
  admin: svcLogin({ username: 'admin', password: 'admin' }).me
};
// a municipality-restricted account (the shape the service issues for a restricted user): the same fields, ONE narrower scope
const RIY_SCOPE = { all: false, grants: [{ amanah: RIYADH_KEY, municipalities: 'all', direct: true, notSpecified: true }], nonMunicipal: false };
const ME_RIY = { ...ME.demo, id: 'usr-riy', username: 'riyuser', nameAr: 'مستخدم الرياض', nameEn: 'Riyadh User', avatar: 'ZZ', role: { id: 'role-collection', nameAr: 'مسؤول التحصيل', nameEn: 'Collection Officer', readOnly: false }, scope: RIY_SCOPE, scopes: Object.fromEntries(Object.keys(ME.demo.scopes).map((m) => [m, RIY_SCOPE])), summary: { ar: 'مسؤول التحصيل · أمانة الرياض', en: 'Collection Officer · Riyadh Amanah' } };

async function signedIn(me, token = `tok.${me.id}`) {
  const st = store();
  const f = async (url) => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => (String(url).endsWith('/auth/login') ? { token, me } : {}) });
  session.__configure({ storage: st, fetch: f });
  const r = await session.login(me.username, 'x'); assert.equal(r.ok, true);
}
const render = (el, lang = 'ar') => {
  globalThis.sessionStorage = { getItem: (k) => (k === 'ib_lang' ? lang : null), setItem() {}, removeItem() {} };
  return renderToStaticMarkup(E(StaticRouter, { location: '/insights' }, E(I18nProvider, null, E(ThemeProvider, null, E(AuthProvider, null, el)))));
};

/* ---------------- 1. removed controls: grep-style guard ---------------- */
const walk = (dir, out = []) => { for (const f of fs.readdirSync(dir, { withFileTypes: true })) { const p = `${dir}/${f.name}`; if (f.isDirectory()) walk(p, out); else if (/\.(jsx?|mjs|css)$/.test(f.name)) out.push(p); } return out; };
const CODE = [...walk('src'), ...walk('server').filter((f) => !f.includes('/.data/'))];
await ok('the organisation switcher, the notification bell / badge and their session plumbing are gone from src and server (identifiers, CSS, i18n keys, strings)', () => {
  assert.ok(!fs.existsSync('src/components/header/OrgSelect.jsx') && !fs.existsSync('src/components/header/NotificationsButton.jsx'));
  const banned = [/\bOrgSelect\b/, /\bNotificationsButton\b/, /\bswitchOrg\b/, /\bselectOrg\b/, /\borgScoped\b/, /\blegacyUserOf\b/, /own-access/, /\bownAccess\b/, /\borgOptions\b/, /\bvalidOrgFor\b/, /\borgNarrowing(Of)?\b/, /\brev\.org\b/, /\buser\??\.org\b/,
    /\bORGS\b/, /org_not_allowed/, /\bNOTIFICATION_COUNT\b/, /\bnotificationBadge\b/, /hd-bell/, /hd-org/, /hd-tip/, /org-scope-switch/, /org-collapse/, /switch-row/, /org-select-label/, /org-scope-off/, /touchedAmanahs/, /عزل البيانات حسب الجهة/, /اختر جهتك/, /تم تبديل عرض الجهة/,
    /\bnotif_msg\b/, /\bnotif:/, /\borg_(label|ph|switched|login_hint|scope_toggle|scope_off_note)\b/, /\bdata_scope_consolidated\b/, /\ball_orgs\b/, /\btier_(central|local)\b/, /3 موافقات معلقة/, /pending approvals/];
  const hits = [];
  for (const f of CODE) { if (f.endsWith('tests')) continue; const s = fs.readFileSync(f, 'utf8'); for (const re of banned) if (re.test(s)) hits.push(`${f}: ${re}`); }
  assert.deepEqual(hits, []);
  for (const k of ['notif', 'notif_msg', 'org_label', 'org_ph', 'org_switched', 'org_scope_toggle', 'org_scope_off_note', 'org_login_hint', 'data_scope_consolidated', 'all_orgs', 'tier_central', 'tier_local']) for (const l of ['ar', 'en']) assert.ok(!(k in translations[l]), `${l}.${k}`);
});
await ok('no hardcoded red «5» badge and no placeholder notification in the header sources; the header has the demo-data badge, language, theme and the account menu', () => {
  const h = read('src/components/header/AppHeader.jsx');
  assert.ok(!/bell|notif|badge\b/i.test(h.replace(/\/\/[^\n]*/g, '').replace(/demoBadge|DemoBadge|hd-demo/g, '')), 'no bell / notification in AppHeader');
  for (const c of ['DemoBadge', 'LanguageSwitch', 'ThemeToggle', 'UserMenu', 'UserBlock']) assert.ok(h.includes(c), c);
  assert.ok(!/OrgSelect/.test(h) && (h.replace(/\/\/[^\n]*/g, '').match(/<header/g) || []).length === 1);
  const css = read('src/styles/global.css'); assert.ok(!/\.hd-(bell|org|tip)/.test(css));
  const icons = read('src/components/header/HeaderIcons.jsx'); assert.ok(!/case 'bell'|case 'building'/.test(icons));
});
await ok('the login page has no organisation selector and no «data isolation by organisation» switch, and the sign-in request carries only username + password', () => {
  const l = read('src/pages/Login.jsx'); assert.ok(!/ORGS|orgId|scopeByOrg|role="switch"|<select/.test(l));
  const s = read('src/api/session.js'); assert.ok(!/orgId|orgScoped|selectOrg/.test(s));
  const svc = read('server/identity/service.js'); assert.ok(!/orgId|orgOptionsFor/.test(svc));
});
await ok('the session stores the token and the account only (no organisation / persona), and an older stored session with orgId / orgScoped is read without them', async () => {
  const st = store(); st.setItem('ib_auth', JSON.stringify({ token: 'tok.old', me: ME.demo, orgId: 'riyadh', orgScoped: true }));
  session.__configure({ storage: st, fetch: async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ me: ME.demo }) }) });
  assert.deepEqual(Object.keys(session.getState()).sort(), ['checking', 'me', 'notice', 'token']);
  await session.refreshMe(); assert.deepEqual(Object.keys(JSON.parse(st.getItem('ib_auth'))).sort(), ['me', 'token']);
});

/* ---------------- 2. the user menu shows the REAL account: name + role (from the account, not a persona) ---------------- */
await ok('user menu: demo / auditor / admin / restricted — each shows its OWN name and ROLE, in Arabic and in English; log out is the menu action', async () => {
  const cases = [[ME.demo, 'Li Fangjun', 'Li Fangjun', 'مدير النظام', 'Administrator'], [ME.auditor, 'أحمد آل سعود', 'Ahmad Al-Saud', 'مدقق', 'Auditor'], [ME.admin, 'مدير النظام', 'System Admin', 'مدير النظام', 'Administrator'], [ME_RIY, 'مستخدم الرياض', 'Riyadh User', 'مسؤول التحصيل', 'Collection Officer']];
  for (const [me, nameAr, nameEn, roleAr, roleEn] of cases) {
    await signedIn(me);
    const ar = render(E(UserMenu), 'ar'); const en = render(E(UserMenu), 'en');
    assert.ok(ar.includes(`>${nameAr}<`) && ar.includes(`>${roleAr}<`), `${me.username} ar: ${text(ar)}`);
    assert.ok(en.includes(`>${nameEn}<`) && en.includes(`>${roleEn}<`), `${me.username} en: ${text(en)}`);
    assert.ok(ar.includes(`aria-label="قائمة المستخدم: ${nameAr}, ${roleAr}"`) && en.includes(`aria-label="User menu: ${nameEn}, ${roleEn}"`));
    const sheet = render(E(UserBlock), 'en'); assert.ok(sheet.includes('Log out') && sheet.includes(nameEn) && sheet.includes(roleEn));
  }
});
await ok('signed out: no identity is invented (no persona fallback)', () => {
  session.__configure({ storage: store(), fetch: async () => ({ ok: false, status: 401, headers: { get: () => null }, json: async () => ({}) }) });
  const h = render(E(UserMenu), 'ar'); assert.ok(!/Li Fangjun|طارق|Ahmad|System Admin/.test(h));
});
await ok('role labels are independent of the person\'s name: the SAME person has an Arabic and an English role label; two people with one role share it; renaming does not change it', () => {
  assert.equal(roleName(ME.demo, 'ar'), 'مدير النظام'); assert.equal(roleName(ME.demo, 'en'), 'Administrator');
  assert.equal(roleName(ME.admin, 'en'), roleName(ME.demo, 'en')); assert.notEqual(displayName(ME.admin, 'en'), displayName(ME.demo, 'en'));
  assert.equal(roleName({ ...ME.demo, nameAr: 'اسم آخر', nameEn: 'Another Name' }, 'en'), 'Administrator');
  assert.notEqual(roleName(ME.demo, 'ar'), roleName(ME.demo, 'en'));
});

/* ---------------- 3. one identity per person ---------------- */
await ok('usr-demo: ONE verified display name «Li Fangjun» in both languages, the SAME initials, and no persona text anywhere in src / server', () => {
  assert.equal(displayName(ME.demo, 'ar'), 'Li Fangjun'); assert.equal(displayName(ME.demo, 'en'), 'Li Fangjun');
  assert.equal(initialsFor(ME.demo, 'ar'), 'LF'); assert.equal(initialsFor(ME.demo, 'en'), 'LF');
  const u = userOf(ME.demo); assert.equal(u.nameAr, 'Li Fangjun'); assert.equal(u.nameEn, 'Li Fangjun'); assert.equal(actorName(u, 'ar'), 'Li Fangjun'); assert.equal(actorName(u, 'en'), 'Li Fangjun');
  const persona = String.fromCharCode(0x0637, 0x0627, 0x0631, 0x0642); // the removed Arabic persona, built from code points so this file is not itself a hit
  for (const f of CODE) assert.ok(!fs.readFileSync(f, 'utf8').includes(persona), `${f} contains the removed persona`);
  assert.ok(String(ME.demo.avatar) === 'LF');
});
await ok('displayName: both names → the language\'s own; ONE name → shown in BOTH languages (never a guess / transliteration); none → username; nothing is invented', () => {
  assert.equal(displayName({ nameAr: 'سلمى', nameEn: 'Salma' }, 'ar'), 'سلمى'); assert.equal(displayName({ nameAr: 'سلمى', nameEn: 'Salma' }, 'en'), 'Salma');
  assert.equal(displayName({ nameEn: 'Only English' }, 'ar'), 'Only English'); assert.equal(displayName({ nameAr: 'اسم واحد' }, 'en'), 'اسم واحد'); assert.equal(displayName({ nameAr: '  ', nameEn: 'X Y' }, 'ar'), 'X Y');
  assert.equal(displayName({ username: 'u1' }, 'ar'), 'u1'); assert.equal(displayName(null, 'en'), ''); assert.equal(displayName({}, 'en'), '');
  assert.equal(userOf({ id: 'u', username: 'u', nameEn: 'Only English' }).nameAr, 'Only English');
});
await ok('initials come from the DISPLAYED name (a stored avatar that disagrees is ignored): Latin and Arabic, two-letter rule', () => {
  assert.equal(initialsOf('Li Fangjun'), 'LF'); assert.equal(initialsOf('Ahmad Al-Saud'), 'AS'); assert.equal(initialsOf('System Admin'), 'SA'); assert.equal(initialsOf('Madonna'), 'MA'); assert.equal(initialsOf('  john   ronald  tolkien '), 'JT');
  assert.equal(initialsOf('أحمد آل سعود'), 'أس'); assert.equal(initialsOf('مدير النظام'), 'من'); assert.equal(initialsOf('سلمى'), 'سل'); assert.equal(initialsOf(''), ''); assert.equal(initialsOf(null), '');
  assert.equal(initialsFor({ nameAr: 'مستخدم الرياض', nameEn: 'Riyadh User', avatar: 'ZZ' }, 'en'), 'RU');
  const html = (async () => { await signedIn(ME_RIY); return render(E(UserMenu), 'en'); });
  return html().then((h) => { assert.ok(h.includes('>RU<') && !h.includes('>ZZ<'), 'the stored avatar «ZZ» is ignored'); });
});
await ok('switching language keeps the user id, the session token, the permissions, the scope and the owner key (only the labels change)', async () => {
  await signedIn(ME_RIY, 'tok.keep');
  const probe = (lang) => { let seen; const P = () => { const a = useAccess(); const { user } = useAuth(); seen = { id: a.me.id, uid: user.id, modules: [...a.modules].sort().join(','), scope: JSON.stringify(a.effectiveScope('invoices_collected')), role: a.role.id, token: session.getToken(), ro: a.readOnly }; return null; }; render(E(P), lang); return seen; };
  const ar = probe('ar'); const en = probe('en'); assert.deepEqual(ar, en); assert.equal(ar.token, 'tok.keep');
  const o = (lang) => { let u; const P = () => { u = useAuth().user; return null; }; render(E(P), lang); return u; };
  assert.equal(o('ar').id, o('en').id); assert.equal(o('ar').user, o('en').user);
});

/* ---------------- 4. the language selector and the theme toggle work ---------------- */
await ok('language selector: العربية | EN, exactly one pressed; theme toggle: a labelled, pressed-state button in both languages', async () => {
  await signedIn(ME.demo);
  const ar = render(E(LanguageSwitch), 'ar'); const en = render(E(LanguageSwitch), 'en');
  assert.equal((ar.match(/aria-pressed="true"/g) || []).length, 1); assert.equal((en.match(/aria-pressed="true"/g) || []).length, 1); assert.ok(ar.includes('العربية') && ar.includes('EN'));
  assert.ok(/aria-pressed="true"[^>]*>العربية|العربية<\/button>/.test(ar));
  const t = render(E(ThemeToggle), 'ar'); assert.ok(t.includes('aria-pressed="false"') && t.includes('التبديل إلى الوضع الداكن')); assert.ok(render(E(ThemeToggle), 'en').includes('Switch to dark mode'));
  const src = read('src/components/header/ThemeToggle.jsx'); assert.ok(src.includes('toggleTheme'));
  const ls = read('src/components/header/LanguageSwitch.jsx'); assert.ok(ls.includes('setLang(code)'));
});

/* ---------------- 5. the authorised scope comes ONLY from the account ---------------- */
await ok('scope is derived from the account: admin = all, restricted = exactly its grant (summary, effectiveScope, picker options); nothing a persona could choose', async () => {
  const admin = buildAccess(ME.demo); assert.equal(admin.effectiveScope('dashboard').all, true); assert.equal(admin.allScope, true);
  const r = buildAccess(ME_RIY); assert.equal(r.effectiveScope('dashboard').all, false); assert.deepEqual(r.effectiveScope('dashboard').grants.map((g) => g.amanah), [RIYADH_KEY]); assert.equal(r.allScope, false);
  const { permittedAmanahOptions } = await import('../src/components/filters/filterLogic.js');
  assert.deepEqual(permittedAmanahOptions(r.effectiveScope('dashboard')).map((a) => a.key), [RIYADH_KEY]); assert.ok(permittedAmanahOptions(admin.effectiveScope('dashboard')).length > 10);
  assert.equal(r.summary('en'), 'Collection Officer · Riyadh Amanah'); assert.ok(r.summary('ar').includes('أمانة الرياض'));
  for (const f of ['src/context/RevenueContext.jsx', 'src/data/useDecisions.js', 'src/components/filters/ScopeFilters.jsx', 'src/pages/SmartReports.jsx', 'src/components/insights/InsightsDashboard.jsx', 'src/pages/PlanDetail.jsx']) assert.ok(!/\borg\.amanahKeys|rev\.org/.test(read(f)), `${f} reads no persona`);
  assert.ok(/effectiveScope\('decisions'\)/.test(read('src/data/useDecisions.js')) && /effectiveScope\('planning'\)/.test(read('src/pages/PlanDetail.jsx')));
});

/* ---------------- 6. the identity store: seed + in-place migration of an old-shape store ---------------- */
await ok('migration: an old-shape store (usr-demo with the old two-persona names) is fixed IN PLACE — same id / credential / role / scope / tokenVersion, ONE audit event, ONE backup, idempotent, history untouched, an edited name never touched', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'iim-names-')); const file = path.join(dir, 'identity.json');
  resetForTests(file); const db0 = JSON.parse(fs.readFileSync(file, 'utf8'));
  const persona = String.fromCharCode(0x0637, 0x0627, 0x0631, 0x0642);
  const demo0 = db0.users.find((u) => u.id === 'usr-demo'); demo0.nameAr = persona; // the old shape
  const aud0 = db0.users.find((u) => u.id === 'usr-auditor'); aud0.nameAr = 'اسم عدّله المسؤول';
  db0.audit.push({ id: 'aud-old', at: '2026-11-01T00:00:00.000Z', actorId: 'usr-demo', actorName: persona, actorNameEn: 'Li Fangjun', action: 'user_create', targetType: 'user', targetId: 'x', summary: 's', summaryEn: 's' });
  fs.writeFileSync(file, JSON.stringify(db0));
  const before = { id: demo0.id, credential: demo0.credential, roleId: demo0.roleId, scope: JSON.stringify(demo0.scope), tokenVersion: demo0.tokenVersion, username: demo0.username };
  const nAudit = db0.audit.length;
  const db1 = reloadFromDisk(); const d1 = db1.users.find((u) => u.id === 'usr-demo');
  assert.equal(d1.nameAr, 'Li Fangjun'); assert.equal(d1.nameEn, 'Li Fangjun'); assert.equal(d1.avatar, 'LF');
  assert.deepEqual({ id: d1.id, credential: d1.credential, roleId: d1.roleId, scope: JSON.stringify(d1.scope), tokenVersion: d1.tokenVersion, username: d1.username }, before, 'identity, credential, role, scope and tokens are untouched');
  assert.equal(db1.users.find((u) => u.id === 'usr-auditor').nameAr, 'اسم عدّله المسؤول', 'an edited name is never overwritten');
  assert.equal(db1.audit.length, nAudit + 1); assert.equal(db1.audit.filter((e) => e.targetId === 'usr-demo' && e.action === 'migration').length, 1);
  assert.equal(db1.audit.find((e) => e.id === 'aud-old').actorName, persona, 'historical audit entries are not rewritten');
  assert.ok(fs.existsSync(`${dbFile()}.pre-names.bak`)); assert.equal(JSON.parse(fs.readFileSync(`${file}.pre-names.bak`, 'utf8')).users.find((u) => u.id === 'usr-demo').nameAr, persona, 'the backup is the old shape');
  const stored = JSON.parse(fs.readFileSync(file, 'utf8')); assert.equal(stored.users.find((u) => u.id === 'usr-demo').nameAr, 'Li Fangjun', 'written to disk');
  const db2 = reloadFromDisk(); assert.equal(db2.audit.length, nAudit + 1, 'idempotent: a second start changes nothing');
  assert.equal(svcLogin({ username: 'demo', password: 'demo123' }).me.nameAr, 'Li Fangjun', 'the same password still signs in');
  resetForTests(':memory:');
});

console.log(`header cleanup: ${n} test groups passed`);
