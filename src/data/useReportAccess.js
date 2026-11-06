// The access of the signed-in person as the report / picker code needs it (React side; the pure rules are in reportAccess.js).
//   useReportAccess(permission = 'smart_reports') → { ready, viewer, geo, permitted, canExport, uid, accessVersion, signature, summary(lang) }
//     viewer = reportAccess.makeViewer(...) — the CURRENT effective scope of the account for the permission + whether the permission is held; pass it wherever a saved result is checked.
//   usePickerAccess() → { scope: GeoScope, ready } · usePickerScope() → GeoScope — the scope the filter pickers (Amanah / municipality lists) draw their options from: the union of the account's data-module scopes.
// Never widens: both come from AuthContext.useAccess (server-issued `me`).
import { useMemo } from 'react';
import { useAccess } from '../context/AuthContext';
import { geoScopeKey } from './geoScope';
import { makeViewer, accessSignature, describeAccess } from './reportAccess';

export function useReportAccess(permission = 'smart_reports') {
  const a = useAccess();
  const geo = a.effectiveScope(permission); const key = geoScopeKey(geo);
  const permitted = a.can(permission); const canExport = permitted; // export has no separate permission: the module that owns the report allows it (a read-only role may export)
  const uid = a.me?.id ?? null; const accessVersion = a.accessVersion ?? 0;
  const viewer = useMemo(() => makeViewer({ uid, geo, permitted, canExport, accessVersion }), [uid, key, permitted, canExport, accessVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const signature = useMemo(() => accessSignature(viewer), [viewer]);
  return { ready: !!a.ready, viewer, geo: viewer.geo, permitted, canExport, uid, accessVersion, signature, can: a.can, summary: (lang) => describeAccess(viewer.geo, lang) };
}

export function usePickerAccess() {
  const a = useAccess();
  const scope = a.geoScope; const key = geoScopeKey(scope);
  const stable = useMemo(() => scope, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return { scope: stable, ready: !!a.ready };
}
export const usePickerScope = () => usePickerAccess().scope;
