import { INVOICES } from '../data/mock';

// Display object the legacy invoice drawer and the AI-process widgets expect, built from a record the data service
// materialised for ONE invoice (the original fixture when the record came from it).
export function legacyInvoiceFor(rec) {
  const found = INVOICES.find((i) => i.id === rec.id);
  if (found) return found;
  return {
    id: rec.id, entity: rec.entity, entityEn: rec.entityEn, entityAr: rec.entityAr,
    amanah: rec.amanah, amanahEn: rec.amanahEn, amanahAr: rec.amanahAr,
    amount: rec.grossAmount, currency: rec.currency, source: rec.provenance?.kind === 'uploaded' ? 'Upload' : (rec.sourcePlatform || 'Upload'), co: rec.co || '—',
    date: rec.issueDate, status: rec.sourceStatus === 'collected' ? 'approved' : 'pending', risk: rec.aiRisk?.score || 0, tag: rec.aiRisk?.tag || 'normal'
  };
}

// A list row (from /api/list) shaped like a legacy invoice, enough for tables and for opening the drawer by id.
export function legacyFromRow(r) {
  return {
    id: r.id, entity: r.payerAr, entityEn: r.payerEn, entityAr: r.payerAr, amanah: r.amanahZh, amanahEn: r.amanahEn, amanahAr: r.amanahAr,
    amount: r.gross, currency: 'SAR', source: r.platform, co: r.contractNo || '—', date: r.issueDate, status: r.cls === 'collected' ? 'approved' : 'pending', risk: 0, tag: 'normal'
  };
}
