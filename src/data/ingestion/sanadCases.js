// An imported Sanad record → the case object the enforcement workspace already works with (links, documents, matching, history). Fields the source supplied are kept as `case.source`
// (adaptSourceCase leaves a case that already carries `source.requestNo` untouched), the ingestion provenance is kept as `case.ingestion`. The key of an imported Sanad request is `SND-<requestNo>`.
import { ENTITIES } from '../catalog';
import { statusById, SOURCE_STATUSES } from '../sanadSource';

export const sanadCaseKey = (requestNo) => `SND-${requestNo}`;
const amanahEnOf = (ar) => ENTITIES.find((e) => e.ar === ar)?.en || ar || '—';
const closedByText = (text) => /^\s*مغلق/.test(text || ''); // only a status the source writes as «مغلق…» is a stated closure
const val = (rec, n) => rec.fields[n]?.value ?? null;
const rawOf = (rec, n) => rec.fields[n]?.raw ?? '';

export function sanadRecordToCase(rec) {
  const statusText = val(rec, 'statusText'); const known = SOURCE_STATUSES.find((s) => s.text === statusText) || (val(rec, 'statusId') ? statusById(val(rec, 'statusId')) : null);
  const closed = known ? known.cls === 'closed' : closedByText(statusText);
  const raised = val(rec, 'raisedAt'); const invoice = val(rec, 'invoiceNo');
  const idFlags = ['requestNo', 'claimNo', 'enforcementNo', 'invoiceNo'].filter((n) => (rec.fields[n]?.flags || []).some((f) => f === 'damaged_scientific_notation' || f === 'excel_precision_risk'));
  const source = {
    requestNo: val(rec, 'requestNo'), claimNo: val(rec, 'claimNo') || '', claimDate: val(rec, 'claimDate'), statusId: val(rec, 'statusId') ? Number(val(rec, 'statusId')) : null, statusText: statusText || '',
    debtorTypeId: val(rec, 'debtorTypeId') ? Number(val(rec, 'debtorTypeId')) : null, debtorType: val(rec, 'debtorType') || '', raiseAt: raised || '', createdAt: val(rec, 'createdAt') || '',
    employeeId: val(rec, 'employeeId') || '', employeeName: val(rec, 'employeeName') || '', amount: val(rec, 'amount'), amountWords: val(rec, 'amountWords') || '', enforcementNo: val(rec, 'enforcementNo') || '',
    invoiceNo: invoice || '', executionTypeId: val(rec, 'executionTypeId') ? Number(val(rec, 'executionTypeId')) : null, executionType: val(rec, 'executionType') || '', municipality: val(rec, 'municipality'),
    amanahAr: val(rec, 'amanah')
  };
  // an identifier the source wrote in scientific notation keeps its raw string next to the (absent) usable value: it is flagged and never matched
  for (const [n, k] of [['enforcementNo', 'enforcementNoRaw'], ['claimNo', 'claimNoRaw']]) if ((rec.fields[n]?.flags || []).includes('damaged_scientific_notation')) source[k] = rawOf(rec, n);
  const refs = invoice ? [{ kind: 'invoice_no', value: invoice }] : (rec.fields.invoiceNo?.flags || []).includes('damaged_scientific_notation') ? [{ kind: 'invoice_no', value: rawOf(rec, 'invoiceNo') }] : [];
  return {
    enforceNum: sanadCaseKey(source.requestNo), system: 'sanad', amanahEn: amanahEnOf(source.amanahAr), amount: source.amount ?? 0, openedDate: raised ? String(raised).slice(0, 10) : '', contractNo: null,
    requestStatus: closed ? 'مغلق' : 'قيد التنفيذ', refs, debtorIdx: null, debtorName: null, debtorId: null, description: val(rec, 'description') || '', notes: '', attachments: [], closeReason: null,
    orderDocument: { retrievable: false, reason: 'sanad_document_integration_not_connected' }, feed: 'imported', documents: [], links: [], history: [], source,
    sourceMeta: { derived: false, imported: true, group: closed ? 'closed' : 'unclassified', groupBasis: known ? known.basis || 'stated' : 'unconfirmed', demoRequestStatus: null },
    ingestion: { ...rec.ingestion, recordId: rec.id, flags: rec.flags, idFlags, revisions: (rec.revisions || []).length }
  };
}
export const importedSanadCases = (records) => records.filter((r) => r.source === 'sanad').map(sanadRecordToCase);
