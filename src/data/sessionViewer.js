// The CURRENT access of the signed-in session as a viewer (reportAccess.makeViewer) for code that has no React context: the saved-result stores (reportStore.canView, analysisStore) re-check
// a stored result against it each time it is listed or opened. Reads the plain session module (api/session.js: token + `me`) and the SAME pure rule the access context uses
// (accessModel.buildAccess), so the two can never disagree. No session (signed out, node tests) → null → the caller keeps its own check.
import { getState } from '../api/session';
import { buildAccess } from './accessModel';
import { makeViewer } from './reportAccess';

let memo = { me: null, byPerm: new Map() };
/** the viewer for ONE module (the module whose effective scope applies to the stored result: 'smart_reports' for Smart reports, 'invoices_uncollected' for the non-collection analyses) */
export function sessionViewer(permission = 'smart_reports') {
  const st = getState();
  if (!st || !st.token || !st.me) return null;
  if (memo.me !== st.me) memo = { me: st.me, byPerm: new Map() };
  let v = memo.byPerm.get(permission);
  if (!v) {
    const a = buildAccess(st.me);
    v = makeViewer({ uid: st.me.id, geo: a.effectiveScope(permission), permitted: a.can(permission), canExport: a.can(permission), accessVersion: st.me.accessVersion ?? 0 });
    memo.byPerm.set(permission, v);
  }
  return v;
}
