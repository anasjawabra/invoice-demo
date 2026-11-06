import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { buildAccess, userOf } from '../data/accessModel';
import * as session from '../api/session';
import { bumpEpoch } from '../api/client';
import { plansApi } from '../api/plansClient';
import { clearPlans, hydratePlans, refreshPlans } from '../data/plans/planStore';

// Sign-in is SERVER-BACKED (POST /api/auth/login → token + `me`, docs/access-control.md §4). This context holds the session (api/session.js: token + me in sessionStorage, never a password), re-validates it with /api/auth/me on start, and exposes
//   useAuth()   → { user, login, activate, logout, notice, clearNotice, checking }   (`user` = the authenticated account: name, role, avatar — derived from `me`, nothing else)
//   useAccess() → { me, ready, can(moduleId), canAny, scopeFor, geoScope, scopeSummary(lang), summary(lang), role, readOnly, modules, accessVersion, effectiveScope, refresh, … }   (module access + the ONE role + the ONE geographic scope)
const AuthContext = createContext(null);
const AccessContext = createContext(null);

const useSession = () => useSyncExternalStore(session.subscribe, session.getState, session.getState);

export function AuthProvider({ children }) {
  const s = useSession();
  const startedRef = useRef(false);

  // re-validate a stored session once per page load (401 → signed out with a message)
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (session.getState().token) session.refreshMe();
  }, []);
  // a different person / access must never see another's cached answers
  const accessKeyRef = useRef(null);

  const signedIn = !!(s.token && s.me && !s.checking);
  const me = signedIn ? s.me : null;
  // identity, role and the authorised entities come ONLY from the authenticated account: `me` is what the data service issued for this token
  const access = useMemo(() => buildAccess(me), [me]);
  const user = useMemo(() => (me ? userOf(me) : null), [me]);

  useEffect(() => {
    if (accessKeyRef.current !== null && accessKeyRef.current !== access.accessKey) bumpEpoch(); // permission / scope / account changed (or sign in / out): cached answers are dropped
    accessKeyRef.current = access.accessKey;
  }, [access.accessKey]);

  // revenue plans are SERVER-owned: the synchronous cache (data/plans/planStore.js) is loaded after sign-in and whenever the access version changes, refreshed when the tab regains focus, and emptied on sign-out
  const plansToken = signedIn ? s.token : null; const plansAccessVersion = me?.accessVersion ?? 0; const canPlans = signedIn && access.can('planning');
  useEffect(() => {
    if (!plansToken || !canPlans) { clearPlans(); return undefined; }
    hydratePlans(plansApi, { key: `${plansToken.slice(-12)}|${plansAccessVersion}` });
    let last = Date.now();
    const onFocus = () => { if (Date.now() - last > 15000) { last = Date.now(); refreshPlans(); } };
    if (typeof window !== 'undefined') window.addEventListener('focus', onFocus);
    return () => { if (typeof window !== 'undefined') window.removeEventListener('focus', onFocus); };
  }, [plansToken, plansAccessVersion, canPlans]);

  const login = useCallback(async (username, password) => { bumpEpoch(); return session.login(username, password); }, []);
  const activate = useCallback(async (code, password) => { bumpEpoch(); return session.activate(code, password); }, []);
  const logout = useCallback(() => { session.signOut(null); bumpEpoch(); }, []);
  const refresh = useCallback(() => session.refreshMe(), []);

  const authValue = useMemo(() => ({ user, login, activate, logout, notice: s.notice, clearNotice: session.clearNotice, checking: !!(s.token && s.checking) }), [user, login, activate, logout, s.notice, s.token, s.checking]);
  const accessValue = useMemo(() => ({ ...access, ready: signedIn, accessVersion: me?.accessVersion ?? 0, refresh, gate: (key) => access.gates[key] || { allowed: false, permission: null, reason: null } }), [access, signedIn, me, refresh]);
  return (
    <AuthContext.Provider value={authValue}>
      <AccessContext.Provider value={accessValue}>{children}</AccessContext.Provider>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

const NO_ACCESS = (() => { const a = buildAccess(null); return { ...a, ready: false, accessVersion: 0, refresh: async () => null, gate: () => ({ allowed: false, permission: null, reason: null }) }; })();
/** module access + role + geographic scope of the signed-in person (simplified model, docs/access-control.md S1–S5):
 *  { me, ready, can(moduleId), canAny(ids), scopeFor(moduleId) → GeoScope, geoScope (union over the data modules), scopeSummary(lang), summary(lang) («Collection Officer · Jeddah Amanah · 3 municipalities»),
 *    role {id,nameAr,nameEn,readOnly}|null, readOnly, modules [ids], accessVersion, effectiveScope(moduleId) (= scopeFor — the account's own scope for the module), refresh(),
 *    permissions (Set of module ids — the older name), canReview (derived: a module with something to change AND not read-only), gates, gate(actionKey) } — outside the provider (or signed out) nothing is allowed. */
export function useAccess() {
  return useContext(AccessContext) || NO_ACCESS;
}
