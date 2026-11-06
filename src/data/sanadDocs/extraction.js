// THE EXTRACTION INTERFACE. The UI and the service talk only to a provider registered here; a real OCR provider can later be registered with the same shape and replace the simulation.
//
//   registerProvider({ id, label: {ar,en}, simulated: boolean, extract(doc, record, ctx) -> Promise<Result> })
//     doc    : { orderId, sha256, name, size, type, format, scenarioId?, source }  (the attached document; bytes are read by a real provider through ctx.readBytes)
//     record : the Sanad record being worked on (structured values via compare.structuredValues)
//     ctx    : { onPage(page, total), attempt (1-based, persisted), catalog, delayMs, readBytes() }
//     Result : { status: 'completed' | 'failed', pages: [{page, text}], fields: [{key, value, confidence, page, snippet, status}], error?: {code, message, page?, retryable?} }
//
// The 'simulation' provider returns PREDEFINED outputs of the synthetic scenarios (./scenarios.js) and ONLY for a file whose SHA-256 equals a scenario document's. For any other file it
// produces NO value at all (error 'not_a_scenario_document'): the system never read it. The simulation is deterministic: same document + same attempt number → same result.
import { DOC_FIELDS, structuredValues, classifyField } from './compare.js';
import { docBySha, loadCatalog } from './catalog.js';
import { scenarioById } from './scenarios.js';
import { SIM_LABEL } from './labels.js';

const providers = new Map();
export const DEFAULT_PROVIDER_ID = 'simulation';
export function registerProvider(p) {
  if (!p || !p.id || typeof p.extract !== 'function') throw new Error('provider needs an id and an extract() function');
  providers.set(p.id, { simulated: false, label: { ar: p.id, en: p.id }, ...p });
  return p.id;
}
export const getProvider = (id = DEFAULT_PROVIDER_ID) => providers.get(id) || null;
export const listProviders = () => [...providers.values()].map(({ id, label, simulated }) => ({ id, label, simulated }));
export const unregisterProvider = (id) => providers.delete(id);

const pause = (ms) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

export const simulationProvider = {
  id: 'simulation',
  label: SIM_LABEL,
  simulated: true,
  async extract(doc, record, ctx = {}) {
    const catalog = ctx.catalog || await loadCatalog();
    const entry = docBySha(catalog, doc?.sha256); const sc = entry ? scenarioById(entry.scenarioId) : null;
    if (!entry || !sc || !sc.file) {
      return { status: 'failed', pages: [], fields: [], error: { code: 'not_a_scenario_document', retryable: false } };
    }
    const total = entry.pages.length; const attempt = ctx.attempt || 1; const read = [];
    for (const p of entry.pages) {
      await pause(ctx.delayMs || 0);
      if ((sc.failOnAttempts || []).includes(attempt) && sc.failure && p.page === sc.failure.page) {
        return { status: 'failed', pages: read, fields: [], error: { code: sc.failure.code, page: sc.failure.page, message: sc.failure.message, retryable: true } };
      }
      read.push({ page: p.page, text: p.text }); ctx.onPage?.(p.page, total);
    }
    const structured = structuredValues(record);
    const fields = DOC_FIELDS.map((def) => {
      const out = sc.fields[def.key];
      if (!out) return { key: def.key, value: null, confidence: 0, page: null, snippet: null, status: 'missing' };
      return { key: def.key, value: out.value, confidence: out.confidence, page: out.page, snippet: out.snippet, status: classifyField(def.key, out.value, out.confidence, structured[def.key]) };
    });
    return { status: 'completed', pages: read, fields };
  }
};
registerProvider(simulationProvider);
