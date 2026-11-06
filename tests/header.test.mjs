// The shared application header: the pure logic (language switch model, user menu, phone menu). No organisation switcher, no notification control (tests/header-cleanup.test.mjs guards that).
// Run: npm run test:header
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LANG_OPTIONS, activeLang, languageSwitchModel, nextLangIndex, userMenuItems, mobileMenuItems, headerText, COMPACT_MAX_WIDTH } from '../src/components/header/headerModel.js';

let passed = 0; const test = (name, fn) => { try { fn(); passed += 1; console.log(`  ok  ${name}`); } catch (e) { process.exitCode = 1; console.error(`  FAIL  ${name}\n${e.stack}`); } };

test('exactly two languages, Arabic then English; no Chinese', () => {
  assert.deepEqual(LANG_OPTIONS.map((o) => o.code), ['ar', 'en']);
  assert.deepEqual(LANG_OPTIONS.map((o) => o.short), ['العربية', 'EN']);
  assert.ok(!JSON.stringify(languageSwitchModel('ar')).match(/[一-鿿]/), 'no CJK in the model');
  assert.ok(!JSON.stringify(headerText('en')).match(/[一-鿿]/) && !JSON.stringify(headerText('ar')).match(/[一-鿿]/));
});
test('active language: one pressed button; unknown / stale values fall back to Arabic', () => {
  for (const l of ['ar', 'en', 'zh', undefined, null, '', 'fr']) {
    const m = languageSwitchModel(l); const pressed = m.options.filter((o) => o.pressed);
    assert.equal(pressed.length, 1, `one pressed for ${l}`);
    assert.equal(pressed[0].code, activeLang(l));
  }
  assert.equal(activeLang('zh'), 'ar'); assert.equal(activeLang('en'), 'en');
});
test('each option carries its own lang / dir and an accessible full name', () => {
  const [ar, en] = languageSwitchModel('en').options;
  assert.equal(ar.htmlLang, 'ar'); assert.equal(ar.dir, 'rtl'); assert.equal(en.htmlLang, 'en'); assert.equal(en.dir, 'ltr');
  assert.equal(ar.label, 'العربية'); assert.equal(en.label, 'English');
  assert.match(en.title, /Current language/); assert.match(ar.title, /Switch to/);
  assert.match(languageSwitchModel('ar').options[0].title, /اللغة الحالية/);
  assert.equal(languageSwitchModel('ar').groupLabel, 'اللغة'); assert.equal(languageSwitchModel('en').groupLabel, 'Language');
});
test('arrow keys: LTR right = next, RTL right = previous, wraps, Home/End, others ignored', () => {
  assert.equal(nextLangIndex(0, 'ArrowRight', false), 1); assert.equal(nextLangIndex(1, 'ArrowRight', false), 0);
  assert.equal(nextLangIndex(0, 'ArrowRight', true), 1); // two buttons: previous = next (wraps)
  assert.equal(nextLangIndex(0, 'ArrowLeft', true), 1);
  assert.equal(nextLangIndex(1, 'ArrowLeft', false), 0);
  assert.equal(nextLangIndex(1, 'Home', true), 0); assert.equal(nextLangIndex(0, 'End', false), 1);
  assert.equal(nextLangIndex(0, 'ArrowRight', true, 3), 2); assert.equal(nextLangIndex(0, 'ArrowRight', false, 3), 1);
  assert.equal(nextLangIndex(0, 'a', false), null); assert.equal(nextLangIndex(0, 'Enter', true), null);
});
test('announcement of a switch is in the new language', () => {
  const m = languageSwitchModel('ar');
  assert.equal(m.announce('en'), 'Switched to English'); assert.match(m.announce('ar'), /العربية/);
});
test('user menu: Log out lives in the menu (both languages), flagged as the destructive action', () => {
  assert.deepEqual(userMenuItems('en').map((i) => i.label), ['Log out']); assert.deepEqual(userMenuItems('ar').map((i) => i.label), ['تسجيل الخروج']);
  assert.equal(userMenuItems('zh')[0].label, 'تسجيل الخروج'); assert.ok(userMenuItems('en')[0].danger);
  assert.equal(userMenuItems('en')[0].id, 'logout');
});
test('phone menu holds every secondary control, in order: language, theme, account (no organisation, no notifications)', () => {
  assert.deepEqual(mobileMenuItems().map((i) => i.id), ['language', 'theme', 'user']);
  assert.equal(COMPACT_MAX_WIDTH, 900);
});
test('source hygiene: the header and the login page carry no Chinese text or zh branch', () => {
  const files = ['src/components/Layout.jsx', 'src/pages/Login.jsx', ...fs.readdirSync('src/components/header').map((f) => `src/components/header/${f}`)];
  for (const f of files) {
    const s = fs.readFileSync(f, 'utf8');
    assert.ok(!/[一-鿿]/.test(s), `${f} has CJK text`);
    assert.ok(!/lang\s*===\s*'zh'|switched_zh|zh-CN/.test(s), `${f} has a zh branch`);
  }
});
test('one header implementation: Layout renders AppHeader; no other file defines a topbar or a header language group', () => {
  const layout = fs.readFileSync('src/components/Layout.jsx', 'utf8');
  assert.equal((layout.match(/<AppHeader/g) || []).length, 1); assert.ok(!/className="topbar/.test(layout));
  const login = fs.readFileSync('src/pages/Login.jsx', 'utf8');
  assert.ok(/<LanguageSwitch/.test(login) && !/className="pill"/.test(login));
});
console.log(`header: ${passed} tests passed`);
