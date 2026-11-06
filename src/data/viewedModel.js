// A report model with a saved chart view applied (reportView.applyView), keeping its non-enumerable build inputs — the ONE helper a page's export uses so the file shows the chart types the page shows.
import { applyView, viewIsDefault, cleanView } from './reportView';
import { typeById } from './chartCatalog';

export function viewedModel(model, view, inputs = null) {
  if (!model || viewIsDefault(view)) return model;
  const m = applyView(model, view).model;
  const keep = inputs || model._inputs; if (keep) Object.defineProperty(m, '_inputs', { value: keep, enumerable: false });
  return m;
}

/** a view read back from storage: only valid parts, and only chart types the catalog knows (an unknown type could never be drawn, so it is dropped rather than kept) */
export function cleanKnownView(view) {
  const v = cleanView(view); const charts = {};
  for (const [id, cfg] of Object.entries(v.charts)) { if (cfg.kind && !typeById(cfg.kind)) continue; charts[id] = cfg; }
  return { ...v, charts };
}
