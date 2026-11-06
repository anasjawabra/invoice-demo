// Eefaa ↔ Mumtathil relationships. Mumtathil ENRICHES an Eefaa violation; it is never a second violation (counts always use Eefaa groups).
// The only matching rule: exact equality of normalised identifiers (Eefaa violation number = Mumtathil fine number). The rule is NOT verified by the data owner, so the page says so, but there is no confirm / reject step:
// where an exact match is found Mumtathil's information is simply shown inside the Eefaa details (the reviewer-decision functions below are kept for the data layer and are not used by the UI). Amount, date and text similarity never create a match.
export const RELATION_RULE = { id: 'violationNo=fineNo', verified: false,
  label: { ar: 'تساوي تام بين رقم المخالفة في إيفاء ورقم الغرامة في ممتثل', en: 'Exact equality of the Eefaa violation number and the Mumtathil fine number' },
  note: { ar: 'قاعدة مرشّحة لم يؤكدها مالك البيانات؛ لا يُفترض أن الرقمين يدلّان على الشيء نفسه ولا أنهما فريدان', en: 'Candidate rule not confirmed by the data owner; the two numbers are not assumed to denote the same thing or to be unique' } };
export const RELATION_STATUS = {
  proposed: { ar: 'مرتبط بممتثل (مطابقة تامة للرقم)', en: 'Linked to Mumtathil (exact number match)', tone: 'ok' },
  confirmed: { ar: 'مرتبط بممتثل (مطابقة تامة للرقم)', en: 'Linked to Mumtathil (exact number match)', tone: 'ok' },
  ambiguous: { ar: 'عدة سجلات في ممتثل بالرقم نفسه', en: 'Several Mumtathil records carry the same number', tone: 'warn' },
  rejected: { ar: 'لا سجل ممتثل مرتبط', en: 'No linked Mumtathil record', tone: 'muted' },
  unmatched: { ar: 'لا سجل في ممتثل', en: 'No Mumtathil record', tone: 'muted' }
};
export const relationId = (groupKey, mumtathilId) => `rel|${groupKey}|${mumtathilId}`;

// latest decision per subject (append-only history stays available through `historyOf`)
export function latestDecisions(reviews) {
  const by = new Map(); for (const r of [...reviews].sort((a, b) => String(a.at).localeCompare(String(b.at)) || String(a.id).localeCompare(String(b.id)))) by.set(`${r.kind}|${r.subject}`, r);
  return by;
}
export const historyOf = (reviews, kind, subject) => reviews.filter((r) => r.kind === kind && r.subject === subject).sort((a, b) => String(a.at).localeCompare(String(b.at)) || String(a.id).localeCompare(String(b.id)));

const eq = (a, b, amount) => (amount ? Math.abs(Number(a) - Number(b)) < 0.005 : String(a).trim() === String(b).trim());
// compare only what both sides carry; nothing is merged or overwritten
function compare(group, m) {
  const out = []; const g = group.fields; const mf = m.fields;
  const push = (field, ge, me, amount) => { if (ge?.value == null || me?.value == null) { out.push({ field, comparable: false, eefaa: ge ? { value: ge.value, label: ge.label, sources: ge.sources } : null, mumtathil: me ? { value: me.value, label: me.label } : null }); return; }
    out.push({ field, comparable: true, equal: eq(ge.value, me.value, amount), eefaa: { value: ge.value, label: ge.label, sources: ge.sources }, mumtathil: { value: me.value, label: me.label } }); };
  push('sadadNo', g.sadadNo, mf.sadadNo, false); push('amount', g.amount, mf.amount, true); if (g.amanah) push('amanah', g.amanah, mf.amanah, false);
  return out;
}

/** buildRelations(groups, mumtathilRecords, reviews) → { byGroup: Map(groupKey → relation summary), unlinkedMumtathil: [...], stats } */
export function buildRelations(groups, mumtathilRecords, reviews = []) {
  const decisions = latestDecisions(reviews); const idx = new Map(); const mum = mumtathilRecords.filter((r) => r.source === 'mumtathil');
  for (const m of mum) { const f = m.fields.fineNo; if (f && f.value && !(f.flags || []).some((x) => x === 'damaged_scientific_notation' || x === 'excel_precision_risk')) { if (!idx.has(f.value)) idx.set(f.value, []); idx.get(f.value).push(m); } }
  const byGroup = new Map(); const linked = new Set();
  for (const g of groups) {
    const cands = g.violationNo ? (idx.get(g.violationNo) || []) : [];
    const rels = cands.map((m) => { const id = relationId(g.key, m.id); const d = decisions.get(`relation|${id}`); const dec = d && d.decision !== 'reopened' ? d.decision : null;
      return { id, mumtathil: m, decision: dec, history: historyOf(reviews, 'relation', id), comparison: compare(g, m) }; });
    let status = 'unmatched';
    if (rels.length) {
      if (rels.some((x) => x.decision === 'confirmed')) status = 'confirmed';
      else if (rels.every((x) => x.decision === 'rejected')) status = 'rejected';
      else if (rels.filter((x) => x.decision !== 'rejected').length > 1) status = 'ambiguous';
      else status = 'proposed';
    }
    const active = rels.filter((x) => x.decision !== 'rejected' && (status !== 'confirmed' || x.decision === 'confirmed'));
    for (const x of active) linked.add(x.mumtathil.id);
    const conflicting = active.some((x) => x.comparison.some((c) => c.comparable && !c.equal));
    byGroup.set(g.key, { status, relations: rels, active, conflicting, rule: RELATION_RULE });
  }
  const unlinkedMumtathil = mum.filter((m) => !linked.has(m.id)).map((m) => ({ record: m, reason: !m.fields.fineNo?.value ? 'no_fine_number' : 'no_eefaa_match_or_rejected' }));
  const count = (s) => [...byGroup.values()].filter((x) => x.status === s).length;
  return { byGroup, unlinkedMumtathil, stats: { violations: groups.length, mumtathilRecords: mum.length, proposed: count('proposed'), confirmed: count('confirmed'), ambiguous: count('ambiguous'), rejected: count('rejected'), unmatched: count('unmatched'),
    conflicting: [...byGroup.values()].filter((x) => x.conflicting).length, unlinkedMumtathil: unlinkedMumtathil.length } };
}

// a reviewer decision (append-only): decision ∈ confirmed | rejected | reopened
export function reviewEntry(kind, subject, decision, { by, note = '', at = new Date().toISOString() } = {}) {
  return { id: `rv|${kind}|${subject}|${at}|${Math.random().toString(36).slice(2, 7)}`, kind, subject, decision, by: by || 'Reviewer', at, note };
}
