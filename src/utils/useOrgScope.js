import { useCallback, useEffect, useState } from 'react';
import { loadOrgScope, normalizeOrgScope, saveOrgScope } from '../data/orgScope';
const storage = () => { try { return window.sessionStorage; } catch { return null; } };
export function useOrgScope(namespace, org, defaults) {
  const [state, setState] = useState(() => loadOrgScope(storage(), namespace, org, defaults));
  const setScope = useCallback((value) => setState((previous) => {
    const result = normalizeOrgScope(typeof value === 'function' ? value(previous.scope) : value, org, defaults);
    return { scope: result.scope, adjusted: previous.adjusted || result.adjusted };
  }), [namespace]);
  const dismiss = useCallback(() => setState((previous) => ({ ...previous, adjusted: false })), []);
  useEffect(() => { saveOrgScope(storage(), namespace, state.scope); }, [namespace, state.scope]);
  return [state.scope, setScope, state.adjusted, dismiss];
}
