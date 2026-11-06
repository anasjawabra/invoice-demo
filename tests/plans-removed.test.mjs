// The OLD planning UI and its browser-storage dependency are really gone (cleanup phase of docs/revenue-plans-spec.md §10): none of the retired strings / ids / files exist in the source, nothing but the legacy reader knows the
// browser key, nothing WRITES it, and the retired modules are not imported by anything. A grep-style guard so a retired control cannot creep back. Pure file scans; no data. Run: npm run test:plansremoved
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

let n = 0; const ok = (name, fn) => { try { fn(); n += 1; } catch (e) { e.message = `[${name}] ${e.message}`; throw e; } };
const walk = (dir, out = []) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p, out); else if (/\.(jsx?|mjs|css)$/.test(e.name)) out.push(p); } return out; };
const SRC = walk('src'); const SERVER = walk('server');
const text = new Map([...SRC, ...SERVER].map((f) => [f, fs.readFileSync(f, 'utf8')]));
const hits = (needle, files = SRC) => files.filter((f) => (needle instanceof RegExp ? needle.test(text.get(f)) : text.get(f).includes(needle)));

ok('the retired controls and wording of the old target management are absent from src (status dropdown, approval note, owner field, version block, activation, probability block, four-dates box, tolerance)', () => {
  const retired = ['حالة المستهدف', 'معتمد / توضيحي', 'مالك المستهدف', 'الإصدار الحالي', 'تفعيل كأساس', 'التواريخ الأربعة', 'plan-probability', /(?<![A-Za-z])on_plan\b/, 'id="tg-status"', 'id="tg-owner"', 'id="tg-meta"', 'tg-ov-cov', 'plan-dates', 'pln-dates', 'PLAN_TOLERANCE', 'STATUS_TEXT', 'deviationOf', 'TARGET_STATUSES', 'activationChecks', 'ACTIVATION_CHECK_IDS', 'findDuplicateActiveBaseline', 'overlapNotes', 'duplicateBaseline', 'no_duplicate_active_baseline', 'type_baseline', 'planTolerance', 'forecastYear'];
  for (const s of retired) assert.deepEqual(hits(s), [], `«${s}» must not exist in src: ${hits(s)}`);
});
ok('the UI of the storage / readiness / meta-line the lead removed from the header stays removed', () => {
  for (const s of ['plans-storage-note', 'plan-readiness', 'plan-metaline', 'تخزين محلي للعرض التجريبي', 'pln-metaline', 'pln-gate', 'pln-storage', 'pln-ready']) assert.deepEqual(hits(s), [], `«${s}»: ${hits(s)}`);
});
ok('the browser key `ib_plan_targets_v1` is known to the legacy reader ONLY; nothing in src or server writes or deletes it', () => {
  assert.deepEqual(hits('ib_plan_targets_v1', [...SRC, ...SERVER]), ['src/data/plans/legacyStore.js'], 'only the legacy reader names the key');
  for (const f of [...SRC, ...SERVER]) { const code = text.get(f).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''); assert.ok(!/(setItem|removeItem)\([^)]*(LEGACY_KEY|TARGETS_KEY|ib_plan_targets)/.test(code), `${f}: writes / deletes the legacy value`); }
});
ok('the retired files do not exist and nothing imports them', () => {
  const gone = ['src/pages/PlanningArea.jsx', 'src/components/strategic/TargetsPanel.jsx', 'src/components/strategic/PlanContext.jsx', 'src/components/strategic/PlanPosition.jsx', 'src/components/strategic/PlanCumulative.jsx', 'src/components/strategic/PlanOutlook.jsx', 'src/components/strategic/PlanContribution.jsx', 'src/components/strategic/EntityMap.jsx', 'src/data/planTargets.js', 'src/data/planningCharts.js', 'src/data/collectionGoal.js', 'src/components/plans/planFigures.js'];
  for (const f of gone) { assert.ok(!fs.existsSync(f), `${f} must be deleted`); const base = path.basename(f).replace(/\.(jsx?|mjs)$/, ''); assert.deepEqual(hits(new RegExp(`from ['"][^'"]*/${base}(\\.jsx?)?['"]`)), [], `${base} is imported by ${hits(new RegExp(`from ['"][^'"]*/${base}(\\.jsx?)?['"]`))}`); }
});
ok('the retired planning stylesheet rules are gone (status / tolerance, probability, bullets, outlook, contribution, dictionary link)', () => {
  const css = [...SRC.filter((f) => f.endsWith('.css'))].map((f) => text.get(f)).join('\n');
  for (const s of ['.pl-status', '.pl-prob', '.pl-bul', '.pl-out ', '.pl-contrib', '.pl-deflink', '.pl-titlerow', '.pln-dates', '.pln-ready', '.pln-chips', '.pl-legend', '.pl-assume']) assert.ok(!css.includes(s), `${s} must not remain`);
});
ok('the retired API routes and the plan lifecycle are not offered by the client or the server routes', () => {
  const client = text.get('src/api/plansClient.js'); for (const s of ['/activate', '/archive', '/restore', 'discard-revision', '/draft']) assert.ok(!client.includes(s), `plansClient: ${s}`);
  const api = text.get('server/plansApi.js').replace(/\/\/.*$/gm, ''); for (const s of ['activate', 'archive', 'restore', 'discard-revision']) assert.ok(!new RegExp(`['"\`/]${s}['"\`/]`).test(api), `plansApi routes: ${s}`);
});

console.log(`plans removed: ${n} checks passed`);
