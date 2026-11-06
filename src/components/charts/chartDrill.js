// Drill-down across a CHANGED chart type (pure). A page whose marks open something (a list, a filter) knows its marks by the BASE block's indexes. When the person changes the type
// (sorted, Top N, pareto, donut …) the drawn marks carry the DISPLAYED block's indexes, so a click is translated back by its label — and where it cannot be translated honestly
// (a treemap, a scatter, a flow …, the folded «Other» group) the chart is simply not clickable. Never a broken target.
import { typeIdOf } from '../../data/chartCatalog';

// kinds whose marks are category marks (data-i = index into `labels`, data-j = series) — a click can be mapped back by the category label
export const LABEL_KINDS = new Set(['bar', 'hbar', 'stacked_col', 'stacked_hbar', 'stacked100_col', 'stacked100_hbar', 'line', 'area', 'stacked_area', 'combo', 'pareto', 'pie', 'donut']);
// kinds that keep the base block's own mark geometry (a matrix, a bridge): a click is passed through unchanged while the labels and series are the same
const SAME_GEOMETRY = new Set(['heatmap', 'waterfall']);

const sameList = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => String(x) === String(b[i]));
const serLabels = (b) => (b.series || []).map((s) => s.label);
/** the displayed block has exactly the base block's labels and series (nothing re-ordered, folded or replaced) */
export const sameShape = (base, disp) => !!base && !!disp && disp.kind === base.kind && sameList(base.labels, disp.labels) && sameList(serLabels(base), serLabels(disp));

/** can a click on the displayed chart be turned into a base-block mark? */
export function drillable(base, disp) {
  if (!base || !disp) return false;
  if (sameShape(base, disp)) return true;
  if (SAME_GEOMETRY.has(disp.kind)) return false; // (same kind but re-shaped: not possible for these)
  return LABEL_KINDS.has(disp.kind);
}

/** a click { kind, i, j, label, key } on the displayed chart → the same click expressed in the BASE block, or null (the «Other» group, an unknown label …) */
export function translateSelect(base, disp, s) {
  if (!s) return null;
  if (disp && sameShape(base, disp)) return s;
  const lbl = s.label == null ? null : String(s.label);
  if (lbl == null) return null;
  if (disp && disp.otherIndex != null && s.i === disp.otherIndex) return null; // the folded «Other» group is not a single entity
  const bi = (base.labels || []).findIndex((l) => String(l) === lbl);
  if (bi >= 0) return { ...s, i: bi, label: base.labels[bi] };
  if ((base.labels || []).length === 1) { // the parts of one whole were the SERIES (a stacked bar → a donut): the clicked label is a series label
    const sj = serLabels(base).findIndex((l) => String(l) === lbl);
    if (sj >= 0) return { ...s, i: 0, j: sj, seriesIndex: sj };
  }
  return null;
}

/** the base-block mark { i, j? } that is selected → the mark of the displayed chart (or null when the displayed chart does not show it) */
export function selectedToDisplay(base, disp, sel) {
  if (!sel || !base || !disp) return null;
  if (sameShape(base, disp)) return sel;
  if (!LABEL_KINDS.has(disp.kind)) return null;
  const lbl = (base.labels || [])[sel.i];
  const di = (disp.labels || []).findIndex((l) => String(l) === String(lbl));
  if (di >= 0 && !(disp.otherIndex != null && di === disp.otherIndex)) return { ...sel, i: di };
  if ((base.labels || []).length === 1 && sel.j != null) { const sl = serLabels(base)[sel.j]; const dj = (disp.labels || []).findIndex((l) => String(l) === String(sl)); if (dj >= 0) return { i: dj }; }
  return null;
}
export const kindOf = typeIdOf;
