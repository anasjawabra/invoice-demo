// The saved chart presentation of a PAGE (Dashboard, Exclusions …): view = { chartKind, only, charts:{ [chartId]: config } } (src/data/reportView.js), kept in localStorage per signed-in user
// and per page. Pure + injectable storage so it is testable without a browser. A presentation change never refetches data: the page re-derives the displayed chart from the same block.
// Every access is wrapped: a full / unavailable storage only means the choice is not remembered (the chart still changes for the session).
import { emptyView, viewIsDefault } from '../../data/reportView';
import { cleanKnownView as cleanView } from '../../data/viewedModel';

export const PAGE_VIEW_KEY = 'ib_chartview_v1';
const MAX_CHARTS = 60;
const defaultStorage = () => { try { return typeof window !== 'undefined' ? window.localStorage : (typeof globalThis !== 'undefined' ? globalThis.localStorage : null) || null; } catch { return null; } };
const keyOf = (uk, page) => `${PAGE_VIEW_KEY}:${uk}:${page}`;

export function createPageViewStore(storage = defaultStorage()) {
  const load = (uk, page) => {
    if (!uk || !page || !storage) return emptyView();
    try { const t = storage.getItem(keyOf(uk, page)); if (!t) return emptyView(); const v = JSON.parse(t); return v && v.v === 1 ? cleanView(v.view) : emptyView(); } catch { return emptyView(); }
  };
  /** → true when stored (or removed because the view is the default); false when the browser refused */
  const save = (uk, page, view) => {
    if (!uk || !page || !storage) return false;
    try {
      const clean = cleanView(view);
      if (viewIsDefault(clean)) { storage.removeItem(keyOf(uk, page)); return true; }
      const ids = Object.keys(clean.charts); if (ids.length > MAX_CHARTS) ids.slice(0, ids.length - MAX_CHARTS).forEach((i) => delete clean.charts[i]);
      storage.setItem(keyOf(uk, page), JSON.stringify({ v: 1, view: clean })); return true;
    } catch { return false; }
  };
  const clear = (uk, page) => { try { storage?.removeItem(keyOf(uk, page)); } catch { /* storage unavailable */ } };
  return { load, save, clear };
}
let singleton = null;
export const pageViewStore = () => { if (!singleton) singleton = createPageViewStore(); return singleton; };
