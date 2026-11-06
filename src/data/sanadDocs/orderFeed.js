// From a completed SIMULATED Sanad-document extraction to the order store the existing review works on. There is ONE pipeline (orderMatching.js): the transcript pages go through
// buildExtraction(…, 'ocr_simulated', …) — the same call the prepared samples use (ocrSimulation.extractionFromSample) — and the result is recorded as a document of the order, keyed by the
// file's SHA-256. Nothing here matches an invoice or creates a link: extraction alone changes nothing; only a reviewer's confirmation does.
import { buildExtraction } from '../orderMatching.js';
import { SIM_LABEL } from './labels.js';

// pages: [{ page, text }] as returned by the provider (the transcript of what was printed on each page)
export function sanadExtraction(doc, pages, orderNo) {
  return buildExtraction(pages.map((p) => ({ page: p.page, text: p.text, hasTextLayer: false })), 'ocr_simulated', {
    orderNo, format: 'pdf', simulation: { sampleId: doc.scenarioId || null, label: SIM_LABEL.ar, labelEn: SIM_LABEL.en, sampleOrder: doc.orderId || orderNo, sha256: doc.sha256, source: 'sanad_document' }
  });
}
// the document record the order store keeps (same shape as a prepared sample added by useOrderWork.storeAndRecord, plus its analysis)
export function orderDocumentRecord(doc, pages, orderNo, { at = new Date().toISOString(), fileStored = false, size = null } = {}) {
  return {
    id: doc.sha256, name: doc.name, size: size ?? doc.size ?? 0, kind: 'prepared_sample', sampleId: doc.scenarioId || null, format: 'pdf', addedAt: doc.attachedAt || at, fileStored,
    extraction: sanadExtraction(doc, pages, orderNo), analysedAt: at, origin: 'sanad_document'
  };
}
