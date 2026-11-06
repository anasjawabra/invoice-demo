// Entry point of the Sanad document workflow for list pages and hosts: `const idx = await loadDocsIndex(); documentState(record, idx)` → 'missing' | 'attached' | 'extracted' | 'under_review' | 'reviewed' | 'failed'.
export { loadDocsIndex, documentState, currentDoc, runExtraction, attachScenarioDoc, attachUpload } from './service.js';
export { STATE_LABEL, MISSING_DOC_FLAG, SIM_LABEL, SIM_EXPLAIN } from './labels.js';
export { registerProvider, getProvider, listProviders, DEFAULT_PROVIDER_ID } from './extraction.js';
export { SANAD_SCENARIO_ROWS } from './scenarioRecords.js';
