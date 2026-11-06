// The chart integration of the non-collection result page (pure): which block of the exported report model each page chart corresponds to, so the page chart carries the model's chart id (the key of the
// saved chart view, shared with the exported file), its `dim` and its companion datasets (`alts`: sankey, histogram, box, treemap …). The municipality chart has no counterpart in the exported report,
// so it gets no picker (a change there could not reach the file).
import { ncSections } from '../../../data/ncReportModel';

export const MODEL_KEY = { waterfall: 'waterfall|step', due: 'stacked_hbar|due', reasons: 'hbar|reason', aging: 'bar|aging', amanah: 'hbar|amanah', source: 'hbar|source', heat: 'heatmap|amanah' };
/** → { [pageChartName]: { id, dim, alts?, altsNotes?, otherLabel?, ranked? } } for the analysis in `lang` (pass the analysis WITH `distributions` to make the histogram / box types available) */
export function ncChartEnrichment(analysis, lang) {
  const out = {}; let secs = []; try { secs = ncSections(analysis, lang); } catch { return out; }
  const byKey = new Map(); for (const sec of secs) for (const b of sec.blocks || []) if (b && b.type === 'chart' && b.dim) { const k = `${b.kind}|${b.dim.dimension}`; if (!byKey.has(k)) byKey.set(k, b); }
  for (const [name, key] of Object.entries(MODEL_KEY)) { const b = byKey.get(key); if (b) out[name] = { id: b.id, dim: b.dim, ...(b.alts ? { alts: b.alts } : {}), ...(b.altsNotes ? { altsNotes: b.altsNotes } : {}), ...(b.otherLabel ? { otherLabel: b.otherLabel } : {}), ...(b.ranked ? { ranked: true } : {}) }; }
  return out;
}
