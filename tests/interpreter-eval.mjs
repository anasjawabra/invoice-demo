import { interpret, defaultSpec } from '../src/data/reportIntents.js';
import { CORPUS, TODAY } from './interpreter-corpus.mjs';

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// → { ok, why } for one case
export function evaluate(c) {
  const base = defaultSpec(TODAY);
  let prev = null;
  if (c.after) { const r0 = interpret(c.after, null, TODAY); if (!r0.spec) return { ok: false, why: 'setup failed' }; prev = r0.spec; }
  const r = interpret(c.q, prev, TODAY);
  const e = c.exp; const wantKinds = [].concat(e.kind || 'report'); const sc = r.spec?.scope || {}; const why = [];
  if (!wantKinds.includes(r.kind) && !(wantKinds.includes('report') && r.kind === 'question' && e.kind === undefined)) why.push(`kind ${r.kind} ≠ ${wantKinds.join('|')}`);
  if (r.kind === 'clarify' || r.kind === 'unsupported' || r.kind === 'empty') {
    if (e.says) { const t = `${r.question?.ar || ''} ${r.question?.en || ''}`; if (!t.includes(e.says)) why.push(`clarification lacks «${e.says}»`); }
    return { ok: why.length === 0, why: why.join('; '), r };
  }
  if (e.from && sc.from !== e.from) why.push(`from ${sc.from} ≠ ${e.from}`);
  if (e.to && sc.to !== e.to) why.push(`to ${sc.to} ≠ ${e.to}`);
  if (e.compare && r.spec.compare !== e.compare) why.push(`compare ${r.spec.compare} ≠ ${e.compare}`);
  for (const k of ['amanah', 'source', 'status', 'scopeType', 'muni']) if (e[k] !== undefined) { const got = sc[k]; const want = e[k]; if (!(Array.isArray(want) ? eq([].concat(got).slice().sort(), want.slice().sort()) : got === want)) why.push(`${k} ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`); }
  if (e.sections) for (const s of e.sections) if (!r.spec.sections.includes(s)) why.push(`section ${s} missing (${r.spec.sections.join(',')})`);
  if (e.only && !eq(r.spec.sections, e.only)) why.push(`sections ${r.spec.sections.join(',')} ≠ ${e.only.join(',')}`);
  if (e.keep) { const ref = (prev || base).scope; for (const k of e.keep) if (!eq(sc[k], ref[k])) why.push(`${k} changed (${JSON.stringify(sc[k])} vs ${JSON.stringify(ref[k])})`); }
  return { ok: why.length === 0, why: why.join('; '), r };
}
export function runCorpus() { return CORPUS.map((c) => ({ c, ...evaluate(c) })); }
