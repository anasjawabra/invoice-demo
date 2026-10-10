// OCR SIMULATION for the prepared demo samples (public/samples/prepared/index.json). It is NOT OCR and NOT live: a prepared sample carries the TRANSCRIPT of what was rendered onto each
// page (written by the sample generator from the same source text), and the simulation replays that transcript through the same reference extraction as real text. The result is
// deterministic and tied to the sample's content — never random, never inferred from a file name. A document is treated as a prepared sample only when its SHA-256 equals the sample's,
// or when the reviewer picked the sample from the list (then it is stored as that sample, separate from anything uploaded).
import { buildExtraction } from './orderMatching';

export const SIM_LABEL = { ar: 'محاكاة OCR — للعرض التجريبي', en: 'OCR simulation — demo only' };
let cache = null;
export async function loadPreparedSamples() {
  if (cache) return cache;
  try { const r = await fetch('/samples/prepared/index.json'); cache = r.ok ? (await r.json()).samples || [] : []; } catch { cache = []; }
  return cache;
}
export const samplesForOrder = (samples, orderNo) => (samples || []).filter((s) => s.orderNo === orderNo);
export const sampleByHash = (samples, sha) => (samples || []).find((s) => s.sha256 === sha) || null;

// the extraction a simulated reading of the sample produces (pure, synchronous: used by the app after its page-by-page progress, and by the tests)
export function extractionFromSample(sample, { orderNo = null } = {}) {
  const pages = sample.pages.map((p) => ({ page: p.page, text: p.text, hasTextLayer: false }));
  return buildExtraction(pages, 'ocr_simulated', { orderNo, format: 'pdf', simulation: { sampleId: sample.id, label: SIM_LABEL.ar, sampleOrder: sample.orderNo, sha256: sample.sha256 } });
}
// page-by-page progress for the screen (the pause only lets the reader follow the demo — it is part of the simulation, not a measure of any engine)
export async function simulateOcr(sample, { orderNo = null, onPage = () => {}, delayMs = 500 } = {}) {
  for (const p of sample.pages) { onPage(p.page, sample.pages.length); await new Promise((r) => setTimeout(r, delayMs)); }
  return extractionFromSample(sample, { orderNo });
}

// manual entry: one reference per line (a full number, or a bare serial); recorded as «typed by a person»
export function manualExtraction(text, { orderNo = null } = {}) {
  const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const prepared = lines.map((l) => (/^\d{4,7}$/.test(l) ? `Invoice number: ${l}` : /^(?:INV)[\s\-–/]*\d{4}/i.test(l) ? `Invoice ${l}` : l));
  return buildExtraction([{ page: 1, text: prepared.join('\n'), hasTextLayer: true }], 'manual_entry', { orderNo, format: 'manual' });
}
