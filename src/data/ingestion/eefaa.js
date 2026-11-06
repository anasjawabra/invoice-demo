// Eefaa violations built from imported report rows. Each report row is its own record (provenance: which report supplied which field). Rows from different reports are grouped ONLY by equal
// candidate violation number (`رقم المخالفة` / `Finenumber` / `رقم الغرامة`) — a grouping on a CANDIDATE identifier, not a confirmed equivalence — and every disagreement between reports is kept, never overwritten.
// An Eefaa violation is NOT an enforcement order. Execution evidence is reported only as stated by a source field; nothing is classified "eligible".
import { REPORTS, reportById } from './reports';

export const EXECUTION_BASIS = {
  evidence: { ar: 'عليه دليل تنفيذ من المصدر', en: 'Source shows execution evidence' },
  unknown: { ar: 'أهلية التنفيذ / حالته غير معروفة', en: 'Execution eligibility / status unknown' }
};
export const AMOUNT_DEFINITION = { ar: 'قيمة المخالفة كما ورد في التقرير المصدري (ليست رصيداً مستحقاً ولا مبلغ فاتورة)', en: 'Violation amount as stated by the source report (not an outstanding balance, not an invoice amount)' };

const sameValue = (a, b, type) => (type === 'amount' ? Math.abs(Number(a) - Number(b)) < 0.005 : String(a).trim() === String(b).trim());
const typeOf = (reportId, name) => reportById(reportId)?.fields.find((x) => x.name === name)?.type;
const EVIDENCE_FIELDS = ['executionNo', 'executionRequestStatus', 'referralDate', 'executionDate'];

export function groupEefaa(records) {
  const groups = new Map();
  for (const r of records) {
    if (r.source !== 'eefaa') continue;
    const v = r.keyField === 'violationNo' ? r.keyValue : null;
    const gk = v ? `v:${v}` : `r:${r.id}`;
    if (!groups.has(gk)) groups.set(gk, { key: gk, violationNo: v, records: [] });
    groups.get(gk).records.push(r);
  }
  return [...groups.values()].map(finishGroup).sort((a, b) => a.key.localeCompare(b.key));
}

function finishGroup(g) {
  const recs = [...g.records].sort((a, b) => a.reportId.localeCompare(b.reportId));
  const fields = {}; const names = new Set(recs.flatMap((r) => Object.keys(r.fields)));
  for (const name of names) {
    const vals = recs.map((r) => ({ r, f: r.fields[name] })).filter((x) => x.f && x.f.value !== null && x.f.value !== undefined);
    if (!vals.length) { const anyF = recs.map((r) => r.fields[name]).find(Boolean); fields[name] = { name, value: null, label: anyF?.label || name, sources: [], conflict: false, personal: !!anyF?.personal, flags: anyF?.flags || [] }; continue; }
    const distinct = []; for (const { r, f } of vals) { const t = typeOf(r.reportId, name); if (!distinct.some((d) => sameValue(d.value, f.value, t))) distinct.push({ value: f.value, type: t }); }
    fields[name] = { name, value: vals[0].f.value, label: vals[0].f.label, personal: !!vals[0].f.personal, flags: [...new Set(vals.flatMap((x) => x.f.flags))],
      sources: vals.map(({ r, f }) => ({ report: r.reportId, label: f.label, value: f.value, recordId: r.id })), conflict: distinct.length > 1 && name !== 'violationNo', values: distinct.map((d) => d.value) };
  }
  const evidence = []; for (const r of recs) for (const n of EVIDENCE_FIELDS) { const f = r.fields[n]; if (f && f.value !== null && f.value !== undefined) evidence.push({ report: r.reportId, field: n, label: f.label, value: f.value }); }
  const listed = recs.some((r) => reportById(r.reportId)?.evidence === 'listed');
  const imports = recs.map((r) => r.ingestion);
  const last = imports.map((i) => i.importedAt).sort().pop();
  return { ...g, records: recs, reports: [...new Set(recs.map((r) => r.reportId))], fields, conflicts: Object.values(fields).filter((f) => f.conflict).map((f) => f.name),
    execution: { basis: evidence.length ? 'evidence' : 'unknown', evidence }, referableListed: listed, methods: [...new Set(imports.map((i) => i.method))], lastImportedAt: last,
    flags: [...new Set(recs.flatMap((r) => r.flags))], sadadNumbers: [...new Set((fields.sadadNo?.sources || []).map((s) => s.value))],
    grouping: g.violationNo ? 'candidate_violation_number' : 'single_report_row' };
}

// a printable "as written" source status (a source's own wording, never translated into another source's vocabulary)
export function sourceStatuses(g) {
  const out = [];
  for (const n of ['executionRequestStatus', 'efaaStatus', 'sadadStatus', 'invoiceStatus', 'completionStatus']) { const f = g.fields[n]; if (f) for (const s of f.sources) out.push({ report: s.report, label: s.label, value: s.value }); }
  return out;
}
export const REPORT_ORDER = REPORTS.filter((r) => r.source === 'eefaa').map((r) => r.id);
