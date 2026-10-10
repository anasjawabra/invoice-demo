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

// Outcome classes for an evaluation run (reported separately — an «ok» is a correct reading OR the right clarification / refusal):
//   correct_interpretation  expected a reading and got exactly it
//   appropriate_clarification  expected a question / refusal and got one (any safe non-report kind)
//   over_clarification      expected a reading but the system asked or declined (safe, unhelpful)
//   unsafe_silent_misread   the system produced a report / answer with a scope the user did not ask for, or answered where it should have asked
export function classifyOutcome(c, res) {
  const safeKinds = ['clarify', 'unsupported', 'empty']; const wanted = [].concat(c.exp.kind || 'report'); const wantsAsk = wanted.every((k) => safeKinds.includes(k));
  const gotAsk = safeKinds.includes(res.r?.kind);
  if (res.ok) return wantsAsk || (gotAsk && wanted.some((k) => safeKinds.includes(k))) ? 'appropriate_clarification' : 'correct_interpretation';
  if (gotAsk) return wantsAsk ? 'appropriate_clarification' : 'over_clarification';
  if (res.r?.confirm?.length) return 'caught_by_confirmation'; // a wrong or doubtful scope that the demo shows to the user for confirmation before generating
  return 'unsafe_silent_misread';
}
export function summarize(items) {
  const out = { correct_interpretation: 0, appropriate_clarification: 0, over_clarification: 0, caught_by_confirmation: 0, unsafe_silent_misread: 0 };
  items.forEach((x) => { out[classifyOutcome(x.c, x)] += 1; });
  return out;
}
