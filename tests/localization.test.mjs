// Localization scope: Arabic (default) and English are the only interface languages. Run with `npm run test:l10n`.
// Covers: the one normaliser, the field picker (T) fallbacks, stored-value migration (session language, backups, stored reports), the dictionaries, the demo data, and a repository scan for unsupported-language text.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { normalizeLang, readStoredLang, pickText, pickBi, migrateLangFields, SUPPORTED_LANGS, DEFAULT_LANG } from '../src/data/lang.js';
import { translations } from '../src/data/i18n.js';
import { buildBackup, validateBackup, applyBackup, backupLang, BACKUP_FORMAT } from '../src/data/localBackup.js';
import { makeRecord, modelOfRecord, verifyRecord } from '../src/data/reportStore.js';
import { DEMO_ACCOUNT_HINTS, INVOICES } from '../src/data/mock.js';
import { ENTITIES } from '../src/data/catalog.js';
import { actorName, shownActor } from '../src/utils/actor.js';

let n = 0; const ok = (name, fn) => { try { fn(); n += 1; } catch (e) { console.error(`FAIL: ${name}`); throw e; } };
const HAN = /[㐀-䶿一-鿿豈-﫿]/;
const ZH = String.fromCharCode(122, 104); // the retired language code, built so this file never holds the literal
const mem = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, dump: () => Object.fromEntries(m) }; };

ok('supported languages are exactly Arabic and English, Arabic by default', () => { assert.deepEqual(SUPPORTED_LANGS, ['ar', 'en']); assert.equal(DEFAULT_LANG, 'ar'); });

ok('normalizeLang: every unsupported or malformed value becomes Arabic; English variants stay English', () => {
  const table = [[ZH, 'ar'], [`${ZH}-CN`, 'ar'], [ZH.toUpperCase(), 'ar'], [`${ZH}_Hans`, 'ar'], ['cn', 'ar'], ['', 'ar'], ['   ', 'ar'], [null, 'ar'], [undefined, 'ar'], ['fr', 'ar'], ['xx-YY', 'ar'], [{}, 'ar'], [[], 'ar'], [42, 'ar'], [true, 'ar'],
    ['ar', 'ar'], ['AR', 'ar'], ['ar-SA', 'ar'], ['ar_EG', 'ar'], [' ar ', 'ar'], ['en', 'en'], ['EN', 'en'], ['en-US', 'en'], ['en-GB', 'en'], ['en_AU', 'en'], [' en ', 'en'], ['english', 'ar'], ['ens', 'ar']];
  for (const [v, want] of table) assert.equal(normalizeLang(v), want, `normalizeLang(${JSON.stringify(v)})`);
});

ok('a stored session language is read through the normaliser and rewritten once', () => {
  const s = mem({ ib_lang: ZH }); assert.equal(readStoredLang(s), 'ar'); assert.equal(s.getItem('ib_lang'), 'ar');
  const e = mem({ ib_lang: 'en-US' }); assert.equal(readStoredLang(e), 'en'); assert.equal(e.getItem('ib_lang'), 'en');
  const g = mem({ ib_lang: '\u0000garbage' }); assert.equal(readStoredLang(g), 'ar'); assert.equal(g.getItem('ib_lang'), 'ar');
  const clean = mem({ ib_lang: 'en' }); assert.equal(readStoredLang(clean), 'en');
  assert.equal(readStoredLang(mem()), 'ar'); assert.equal(readStoredLang(null), 'ar');
  assert.equal(readStoredLang({ getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } }), 'ar'); // storage that throws: still Arabic
});

ok('T / pickText: Arabic -> Ar, English -> En, falls back Ar <-> En <-> base, never blank when any exists, never another language', () => {
  const full = { name: 'Base', nameAr: 'عربي', nameEn: 'English' };
  assert.equal(pickText(full, 'name', 'ar'), 'عربي'); assert.equal(pickText(full, 'name', 'en'), 'English');
  assert.equal(pickText(full, 'name', ZH), 'عربي'); assert.equal(pickText(full, 'name', undefined), 'عربي'); assert.equal(pickText(full, 'name', 'en-GB'), 'English');
  assert.equal(pickText({ nameEn: 'E' }, 'name', 'ar'), 'E'); assert.equal(pickText({ nameAr: 'ع' }, 'name', 'en'), 'ع');
  assert.equal(pickText({ name: 'Base' }, 'name', 'ar'), 'Base'); assert.equal(pickText({ name: 'Base' }, 'name', 'en'), 'Base');
  assert.equal(pickText({ nameAr: '', nameEn: 'E', name: 'B' }, 'name', 'ar'), 'E'); // an empty variant is skipped
  assert.equal(pickText({ id: 7 }, 'id', 'ar'), '7'); assert.equal(pickText({}, 'name', 'ar'), ''); assert.equal(pickText(null, 'name', 'ar'), ''); assert.equal(pickText(undefined, 'name', 'en'), '');
  assert.equal(pickBi({ ar: 'ع', en: 'E' }, 'ar'), 'ع'); assert.equal(pickBi({ ar: 'ع', en: 'E' }, ZH), 'ع'); assert.equal(pickBi({ en: 'E' }, 'ar'), 'E'); assert.equal(pickBi({ ar: 'ع' }, 'en'), 'ع'); assert.equal(pickBi('x', 'ar'), 'x'); assert.equal(pickBi(null, 'ar'), '');
});

ok('dictionaries: only en and ar exist; every Arabic key has an English value and vice versa; no unsupported-language text', () => {
  assert.deepEqual(Object.keys(translations).sort(), ['ar', 'en']);
  const noHan = (v, where) => { if (typeof v === 'string') assert.ok(!HAN.test(v), `${where} holds Han characters`); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) noHan(x, `${where}.${k}`); };
  for (const l of ['ar', 'en']) for (const [k, v] of Object.entries(translations[l])) { assert.ok(v != null && v !== '', `${l}.${k} is empty`); noHan(v, `${l}.${k}`); }
  const missingEn = Object.keys(translations.ar).filter((k) => translations.en[k] == null);
  assert.ok(missingEn.length === 0, `Arabic keys without English: ${missingEn.slice(0, 5)}`);
  assert.ok(!Object.keys(translations.en).some((k) => /^switched_/.test(k) && k.endsWith(`_${ZH}`)), 'no language-switch toast key for the removed language');
});

ok('demo data: accounts, Amanahs and fixture invoices carry Arabic and English names and no Han text', () => {
  const walk = (v, where) => { if (typeof v === 'string') assert.ok(!HAN.test(v), `${where}: ${v}`); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${where}.${k}`); };
  walk(DEMO_ACCOUNT_HINTS, 'DEMO_ACCOUNT_HINTS'); walk(ENTITIES, 'ENTITIES'); walk(INVOICES, 'INVOICES');
  for (const c of DEMO_ACCOUNT_HINTS) for (const f of ['name', 'nameAr', 'nameEn', 'role', 'roleAr', 'roleEn']) assert.ok(c[f], `${c.user}.${f}`);
  for (const e of ENTITIES) { assert.ok(e.ar && e.en, JSON.stringify(e)); assert.ok(!(ZH in e)); }
  for (const i of INVOICES) { assert.ok(i.entityAr && i.entityEn && i.amanahAr && i.amanahEn, i.id); assert.ok(pickText(i, 'amanah', 'ar') && pickText(i, 'entity', 'en')); }
  for (const c of DEMO_ACCOUNT_HINTS) for (const l of ['ar', 'en']) assert.ok(actorName(c, l)); // the audit name exists in both languages
});

ok('actor names: a name stored by an older version is shown in Latin script, never as blank', () => {
  const legacy = String.fromCharCode(0x674e, 0x82b3, 0x519b);
  assert.equal(shownActor(legacy), 'Li Fangjun'); assert.equal(shownActor('Tariq'), 'Tariq'); assert.equal(shownActor(undefined), undefined);
  assert.ok(!HAN.test(shownActor(`${String.fromCharCode(0x5ba1, 0x8ba1)} Bob`))); assert.ok(shownActor(String.fromCharCode(0x5ba1, 0x8ba1)).length > 0);
});

const goodData = (lang) => ({ ib_plans_v1: { plans: [{ id: 'p1', name: 'خطة', history: [{ by: 'x' }] }], objectives: [] }, ib_actions_v1: { actions: [] }, ib_smart_convs_v1: [{ id: 'c1', title: 'محادثة', lang, messages: [{ id: 'm', role: 'user', text: 'نص كتبه المستخدم', lang }] }] });
ok('backup import: a Chinese language preference imports fine and becomes Arabic (top-level, preferences, data.ib_lang, nested lang fields)', () => {
  for (const shape of ['lang', 'preferences', 'data']) {
    const obj = { format: BACKUP_FORMAT, version: 1, createdAt: '2026-11-06T00:00:00.000Z', data: goodData(`${ZH}-CN`) };
    if (shape === 'lang') obj.lang = ZH; if (shape === 'preferences') obj.preferences = { lang: ZH }; if (shape === 'data') obj.data.ib_lang = ZH;
    assert.equal(validateBackup(obj).ok, true, shape); assert.equal(backupLang(obj), 'ar', shape);
    const local = mem(); const sess = mem(); const r = applyBackup(obj, local, sess);
    assert.equal(r.ok, true, shape); assert.equal(r.lang, 'ar'); assert.equal(sess.getItem('ib_lang'), 'ar');
    const conv = JSON.parse(local.getItem('ib_smart_convs_v1'))[0];
    assert.equal(conv.lang, 'ar'); assert.equal(conv.messages[0].lang, 'ar');
    assert.equal(conv.title, 'محادثة'); assert.equal(conv.messages[0].text, 'نص كتبه المستخدم'); // user-entered content is untouched
    assert.equal(JSON.parse(local.getItem('ib_plans_v1')).plans[0].name, 'خطة');
  }
});
ok('backup import: an English preference stays English; a backup without any preference leaves the session language alone; export has no language field', () => {
  const obj = { format: BACKUP_FORMAT, version: 1, createdAt: 'x', lang: 'en-GB', data: goodData('en') }; const sess = mem({ ib_lang: 'ar' });
  assert.equal(applyBackup(obj, mem(), sess).lang, 'en'); assert.equal(sess.getItem('ib_lang'), 'en');
  const none = { format: BACKUP_FORMAT, version: 1, createdAt: 'x', data: goodData('ar') }; const s2 = mem({ ib_lang: 'en' }); const r = applyBackup(none, mem(), s2);
  assert.equal(r.ok, true); assert.equal(r.lang, undefined); assert.equal(s2.getItem('ib_lang'), 'en');
  const b = buildBackup(mem({ ib_lang: ZH })); assert.ok(!('lang' in b) && !('ib_lang' in b.data));
});
ok('migrateLangFields: only language-code fields change; business text and other values are copied as they are', () => {
  const src = { lang: ZH, language: 'fr', locale: 'en-US', ib_lang: 'ar-SA', uiLang: { not: 'a string' }, note: ZH, title: 'lang', rows: [{ lang: 'ZH-cn', name: 'x' }], amount: 5, text: 'Arabic language course' };
  const { value, changed } = migrateLangFields(src);
  assert.equal(changed, true); assert.equal(value.lang, 'ar'); assert.equal(value.language, 'ar'); assert.equal(value.locale, 'en'); assert.equal(value.ib_lang, 'ar'); assert.deepEqual(value.uiLang, { not: 'a string' });
  assert.equal(value.note, ZH); assert.equal(value.title, 'lang'); assert.equal(value.rows[0].lang, 'ar'); assert.equal(value.rows[0].name, 'x'); assert.equal(value.amount, 5); assert.equal(value.text, 'Arabic language course');
  assert.equal(migrateLangFields({ lang: 'en', a: [1] }).changed, false); assert.equal(src.lang, ZH, 'the input is not mutated');
});

ok('saved Smart Reports: a stored model/record of an unsupported language opens in Arabic or English, never blank', () => {
  const m = (lang) => ({ id: 'r', title: `T-${lang}`, lang, sections: [], generatedAt: '2026-11-05T09:00:00.000Z' });
  const mk = (models, lang) => makeRecord({ msgId: 'a1', convId: 'c1', generatedAt: '2026-11-05T09:00:00.000Z', cutoff: '2026-11-05', lang, models });
  const both = mk({ ar: m('ar'), en: m('en') }, ZH); assert.ok(verifyRecord(both));
  assert.equal(modelOfRecord(both, ZH).title, 'T-ar'); assert.equal(modelOfRecord(both, 'en').title, 'T-en'); assert.equal(modelOfRecord(both, undefined).title, 'T-ar');
  const onlyEn = mk({ en: m('en') }, ZH); assert.equal(modelOfRecord(onlyEn, ZH).title, 'T-en'); assert.equal(modelOfRecord(onlyEn, 'ar').title, 'T-en');
  const legacy = mk({ [ZH]: m(ZH) }, ZH); const shown = modelOfRecord(legacy, 'ar'); assert.ok(shown, 'a record that only holds the retired language is still opened'); assert.equal(shown.lang, 'ar');
  assert.equal(modelOfRecord(null, 'ar'), null);
});

// repository scan: unsupported-language text is allowed ONLY in the listed data fixtures
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ALLOWED_HAN = [ /* none: src/ and server/ hold no Han text. A data fixture that must keep source text (an imported-file sample) is listed here with the reason. */ ];
const files = (dir) => { const out = []; const rec = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (!['node_modules', 'dist', '.test-build'].includes(e.name)) rec(p); } else if (/\.(js|jsx|mjs|css|html|json)$/.test(e.name)) out.push(p); } }; rec(path.join(ROOT, dir)); return out; };
ok('repository scan: no Han characters in src/ or server/ outside the documented allowlist', () => {
  const bad = [];
  for (const f of [...files('src'), ...files('server')]) { const rel = path.relative(ROOT, f); if (ALLOWED_HAN.includes(rel)) continue; const t = fs.readFileSync(f, 'utf8'); t.split('\n').forEach((l, i) => { if (HAN.test(l)) bad.push(`${rel}:${i + 1}`); }); }
  assert.deepEqual(bad.slice(0, 10), [], `Han text found in ${bad.length} line(s)`);
});
ok('repository scan: no quoted retired-language code, Chinese font stack or language-specific font file in src/ or server/', () => {
  const lit = new RegExp(`['"\`]${ZH}(-[A-Za-z]+)?['"\`]`); const fonts = /PingFang|YaHei|Noto Sans SC|SimSun|SimHei|Source Han|Noto Sans CJK/; const bad = [];
  for (const f of [...files('src'), ...files('server')]) { const rel = path.relative(ROOT, f); fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => { if (lit.test(l) || fonts.test(l) || /lang=["']zh/i.test(l)) bad.push(`${rel}:${i + 1}`); }); }
  assert.deepEqual(bad.slice(0, 10), [], 'unsupported-language literal or font stack found');
  const assets = fs.existsSync(path.join(ROOT, 'public')) ? fs.readdirSync(path.join(ROOT, 'public'), { recursive: true }).map(String) : [];
  assert.ok(!assets.some((a) => /(^|[\\/])(zh|cn|chinese)[-_.\\/]|\.(ttc|otf)$/i.test(a)), 'no Chinese locale or CJK font asset under public/');
});
ok('repository scan: the language switch offers only Arabic and English (no third option in the shell)', () => {
  const bad = []; for (const rel of ['src/components/Layout.jsx', 'src/pages/Login.jsx', 'src/components/smart/ExportDialog.jsx']) { const p = path.join(ROOT, rel); if (!fs.existsSync(p)) continue; fs.readFileSync(p, 'utf8').split('\n').forEach((l, i) => { if (new RegExp(`setLang\\(['"]${ZH}`).test(l) || HAN.test(l)) bad.push(`${rel}:${i + 1}`); }); }
  assert.deepEqual(bad, []);
});

console.log(`localization: ${n} tests passed`);
