import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { ORGS } from '../data/mock';
import { ANCHOR_ENFORCEMENT_SEED, DATA_CUTOFF, DATA_START } from '../data/revenueLedger';
import { checkRange } from '../data/dateRange';
import { PRESETS } from '../data/periodPresets';
import { normalizeConfig, DEFAULT_TARGETS, scopeKey, DEFAULT_CONFIG } from '../data/revenueMetrics';
import { DEFAULT_SCENARIO } from '../data/revenueOutlook';
import { buildEffectiveCases, invoiceStatusMap, orderStatusOf, recordFileRestored, recordDocument, recordSupplementalExtraction, proposeLink, confirmLink, rejectLink, removeLink, dismissReference, reviewContractReference, recordManualReferences } from '../data/orderMatching';
import { loadEnforcement, saveEnforcement } from '../data/enforcementStore';
import { createTaskState, runTask } from '../analysis/analysisTasks';
import { loadComparison } from '../data/comparison';
import { addDaysIso, startOfYear, startOfMonth, prevMonthEnd, lastCompleteMonths } from '../data/clock';
import { api, bumpEpoch } from '../api/client';

const RevenueCtx = createContext(null);

// Presets follow the REAL date (Asia/Riyadh): year to date, month to date, the last complete month, the last three months, everything loaded.
export const SCOPE_PRESETS = Object.fromEntries(PRESETS.map((p) => [p.key, p.range(DATA_CUTOFF)])); // from the shared registry (src/data/periodPresets.js)
const legacyPreset = (p) => (p === 'fytd' ? 'ytd' : p);

const PACE_MS = 420;
const hashOf = (str) => { let h = 5381; for (let i = 0; i < str.length; i += 1) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0; return `${str.length}.${h.toString(36)}`; };

function usePersistent(key, initial) {
  const [v, setV] = useState(() => {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : typeof initial === 'function' ? initial() : initial;
    } catch { return typeof initial === 'function' ? initial() : initial; }
  });
  useEffect(() => { try { sessionStorage.setItem(key, JSON.stringify(v)); } catch { /* storage unavailable */ } }, [key, v]);
  return [v, setV];
}

export function RevenueProvider({ children }) {
  const { user } = useAuth();
  const org = user?.org || ORGS[0];
  const canReview = user ? user.canReview !== false : false;

  const [scopeRaw, setScope] = usePersistent('ib_rev_scope', { preset: 'ytd', ...SCOPE_PRESETS.ytd, amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all' });
  // a stored preset always follows TODAY's date (a new day moves "year to date" / "this month" forward)
  const scope = useMemo(() => { const p = legacyPreset(scopeRaw.preset); return p && p !== 'custom' && SCOPE_PRESETS[p] ? { ...scopeRaw, preset: p, ...SCOPE_PRESETS[p] } : scopeRaw; }, [scopeRaw]);
  const [cfg, setCfg] = usePersistent('ib_rev_cfg2', { graceDays: DEFAULT_CONFIG.graceDays, collectionsAsOf: DEFAULT_CONFIG.collectionsAsOf, rules: DEFAULT_CONFIG.rules });
  const [targets, setTargets] = usePersistent('ib_rev_targets', DEFAULT_TARGETS);
  const [decisions, setDecisions] = usePersistent('ib_rev_decisions', {});
  // the older review state (sessionStorage) is only READ, shown as it was; the enforcement work of this version is kept in ib_enforcement_v1 and written only on a user action
  const casesSaved = useMemo(() => { try { const raw = sessionStorage.getItem('ib_rev_cases'); return raw ? JSON.parse(raw) : null; } catch { return null; } }, []);
  const [enfStore, setEnfStore] = useState(() => loadEnforcement());
  const enfRef = useRef(enfStore);
  const [uploads, setUploads] = usePersistent('ib_rev_uploads', { log: [], count: 0 });
  const [notes, setNotes] = usePersistent('ib_rev_notes', {});
  const [scenario, setScenario] = usePersistent('ib_rev_scenario', DEFAULT_SCENARIO);
  const [forecastVersions, setForecastVersions] = usePersistent('ib_rev_fc_versions', []);

  const cfgN = useMemo(() => normalizeConfig(cfg), [cfg]);

  /* ---------- the data service ---------- */
  const [meta, setMeta] = useState(null);
  const [serverCases, setServerCases] = useState(null);
  const [loadError, setLoadError] = useState(null);
  useEffect(() => {
    if (!user) return undefined; // F-31: nothing is requested (and nothing blocks the page) before sign-in
    let off = false;
    Promise.all([api.meta(), api.sanadCases()]).then(([m, c]) => { if (!off) { setMeta(m); setServerCases(c.cases); } }).catch((e) => { if (!off) setLoadError(e); });
    return () => { off = true; };
  }, [!!user]);

  // Enforcement orders: hand-anchored cases + the Sanad feed (demo data), then the person's own work (documents, proposed / confirmed / rejected links) on top.
  const casesBase = useMemo(() => {
    if (!serverCases) return casesSaved || ANCHOR_ENFORCEMENT_SEED;
    const saved = new Map((casesSaved || []).map((c) => [c.enforceNum, c]));
    return [...ANCHOR_ENFORCEMENT_SEED, ...serverCases].map((c) => saved.get(c.enforceNum) || c);
  }, [casesSaved, serverCases]);
  const casesAll = useMemo(() => buildEffectiveCases(casesBase, enfStore), [casesBase, enfStore]);
  const cases = useMemo(() => (org.amanahKeys ? casesAll.filter((c) => org.amanahKeys.includes(c.amanahEn)) : casesAll), [casesAll, org]);
  // invoice → the status its confirmed order(s) give it (open / suspended / closed); a merely proposed link is sent as «candidate» and changes nothing
  const links = useMemo(() => invoiceStatusMap(casesAll), [casesAll]);

  const orgKeys = org.amanahKeys || null;
  const scopeEff = useMemo(() => ({ from: scope.from, to: scope.to, amanah: scope.amanah, source: scope.source, scopeType: scope.scopeType || 'all', muni: scope.muni || 'all', status: scope.status || 'all', org }), [scope, org]);
  const currentScopeKey = useMemo(() => scopeKey(scopeEff), [scopeEff]);
  const dataVersion = useMemo(() => `${uploads.count}|${JSON.stringify(decisions).length}|${hashOf(JSON.stringify(links))}|${JSON.stringify(cfg)}`, [uploads.count, decisions, links, cfg]);

  // request body used by every data-service call (the scope carries only what the service needs from the organisation)
  const requestFor = useCallback((sc, extra = {}) => ({ scope: { ...sc, org: orgKeys ? { amanahKeys: orgKeys } : null }, cfg: cfgN, decisions, links, ...extra }), [orgKeys, cfgN, decisions, links]);

  // the same provider the analysis tasks use, for pages that need extra aggregates (series, bridge, contracts, ...)
  const data = useMemo(() => ({
    snapshot: (sc, extra) => api.snapshot(requestFor(sc, extra)),
    bridge: (sc, extra) => api.bridge(requestFor(sc, extra)),
    series: (sc, extra) => api.series(requestFor(sc, extra)),
    worklist: (sc, limit, extra) => api.worklist(requestFor(sc, { limit, ...extra })),
    anomalies: (sc, limit, extra) => api.anomalies(requestFor(sc, { limit, ...extra })),
    risk: (sc, extra) => api.risk(requestFor(sc, extra)),
    list: (sc, extra) => api.list(requestFor(sc, extra)),
    invoice: (id) => api.invoice(requestFor({ from: '2000-01-01', to: DATA_CUTOFF }, { id })),
    contracts: (sc) => api.contracts(requestFor(sc)),
    contract: (no) => api.contract(requestFor({ from: '2000-01-01', to: DATA_CUTOFF }, { no })),
    quality: (sc) => api.quality(requestFor(sc)),
    sources: (sc) => api.sources(requestFor(sc || { from: '2000-01-01', to: DATA_CUTOFF })),
    // a plain GET URL; review decisions / links ride along only while they are small enough for a URL
    exportUrl: (sc, extra) => {
      const full = requestFor(sc, extra);
      const small = JSON.stringify({ d: full.decisions, l: full.links }).length < 3000;
      return api.exportUrl(small ? full : { ...full, decisions: {}, links: {} });
    }
  }), [requestFor]);

  const [snapshot, setSnapshot] = useState(null);
  const [prevSnapshot, setPrevSnapshot] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0); // «retry» after a failed refresh
  useEffect(() => {
    if (!meta) return undefined;
    const ac = new AbortController(); setLoading(true); setLoadError(null);
    api.snapshot(requestFor({ from: scope.from, to: scope.to, amanah: scope.amanah, source: scope.source, scopeType: scope.scopeType || 'all', muni: scope.muni || 'all', status: scope.status || 'all' }), { signal: ac.signal })
      .then(async (main) => {
        const cmp = await loadComparison(data, { from: scope.from, to: scope.to, amanah: scope.amanah, source: scope.source, scopeType: scope.scopeType || 'all', muni: scope.muni || 'all', status: scope.status || 'all' }, cfgN, main);
        if (!ac.signal.aborted) { setSnapshot(main); setPrevSnapshot(cmp.prev); setComparison(cmp.comparison); setLoading(false); }
      })
      .catch((e) => { if (!ac.signal.aborted && e.name !== 'AbortError') { setLoadError(e); setLoading(false); } });
    return () => ac.abort();
  }, [meta, scope.from, scope.to, scope.amanah, scope.source, scope.scopeType, scope.muni, scope.status, requestFor, data, cfgN, reloadKey]);

  /* ---------- scope ---------- */
  const setPreset = useCallback((preset) => {
    if (SCOPE_PRESETS[preset]) setScope((s) => ({ ...s, preset, ...SCOPE_PRESETS[preset] }));
  }, [setScope]);
  const resetScope = useCallback(() => setScope({ preset: 'ytd', ...SCOPE_PRESETS.ytd, amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all' }), [setScope]);
  // a typed range is applied only when valid (D-01/D-02); the result tells the caller what happened so the control can explain it
  const setCustomRange = useCallback((from, to) => {
    const r = checkRange({ from, to }, { today: DATA_CUTOFF });
    if (r.ok) setScope((s) => ({ ...s, preset: 'custom', from: r.from, to: r.to }));
    return r;
  }, [setScope]);
  const setAmanah = useCallback((amanah) => setScope((s) => ({ ...s, amanah, muni: 'all' })), [setScope]); // a municipality belongs to one Amanah
  const setScopeType = useCallback((scopeType) => setScope((s) => ({ ...s, scopeType })), [setScope]);
  const setMuni = useCallback((muni) => setScope((s) => ({ ...s, muni })), [setScope]);
  const setStatus = useCallback((status) => setScope((s) => ({ ...s, status })), [setScope]);
  const setSource = useCallback((source) => setScope((s) => ({ ...s, source })), [setScope]);

  /* ---------- human review (analytical layer only) ---------- */
  const decideExclusion = useCallback((invoiceId, decision, note = '', ruleId = null) => {
    if (!canReview) return { ok: false, error: 'no_permission' };
    if (!['approved', 'rejected', 'pending'].includes(decision)) return { ok: false, error: 'bad_decision' };
    const reviewer = { en: `${user?.nameEn || user?.name || 'Reviewer'} (${user?.roleEn || 'role'})`, ar: `${user?.nameAr || user?.name || 'مراجع'}` };
    const today = DATA_CUTOFF;
    setDecisions((prev) => {
      const inv = prev[invoiceId] || { byRule: {} };
      const key = ruleId || '_primary';
      const prior = (inv.byRule || {})[key] || { history: [] };
      return {
        ...prev,
        [invoiceId]: {
          byRule: {
            ...(inv.byRule || {}),
            [key]: {
              exclusion: { reviewStatus: decision, reviewer, reviewDate: today, reviewNote: note },
              history: [...prior.history, { at: today, action: decision, by: reviewer, note }]
            }
          }
        }
      };
    });
    return { ok: true };
  }, [canReview, user, setDecisions]);

  /* ---------- enforcement orders: the person's work (every action is attributed, dated and kept in the order's history) ---------- */
  const enfAct = useCallback((enforceNum, fn) => {
    if (!canReview) return { ok: false, error: 'no_permission' };
    const c = cases.find((x) => x.enforceNum === enforceNum); if (!c) return { ok: false, error: 'not_accessible' };
    const r = fn(enfRef.current, { by: user?.nameEn || user?.name || 'Reviewer', at: new Date().toISOString(), orderStatus: orderStatusOf(c) });
    if (r.error) return { ok: false, error: r.error };
    if (!r.unchanged) { enfRef.current = r.store; setEnfStore(r.store); saveEnforcement(r.store); }
    return { ok: true, unchanged: !!r.unchanged };
  }, [cases, canReview, user]);
  const enforcement = useMemo(() => ({
    recordDocument: (en, doc) => enfAct(en, (st, o) => recordDocument(st, en, doc, o)),
    restoreFile: (en, docId, name) => enfAct(en, (st, o) => recordFileRestored(st, en, docId, { ...o, name })),
    recordSupplement: (en, docId, extraction) => enfAct(en, (st, o) => recordSupplementalExtraction(st, en, docId, extraction, o)),
    addManual: (en, extraction) => enfAct(en, (st, o) => recordManualReferences(st, en, extraction, o)),
    propose: (en, input) => enfAct(en, (st, o) => proposeLink(st, en, input, o)),
    confirm: (en, invoiceId, args = {}) => enfAct(en, (st, o) => confirmLink(st, en, invoiceId, { ...args, ...o })),
    reject: (en, invoiceId, args = {}) => enfAct(en, (st, o) => rejectLink(st, en, invoiceId, { ...args, ...o })),
    remove: (en, invoiceId, args = {}) => enfAct(en, (st, o) => removeLink(st, en, invoiceId, { ...args, ...o })),
    dismiss: (en, key, args = {}) => enfAct(en, (st, o) => dismissReference(st, en, key, { ...args, ...o })),
    // a contract number MENTIONED in an order's text/document: a reviewer confirms it as a direct referral (with evidence) or rejects it
    reviewContract: (en, contractNo, args = {}) => enfAct(en, (st, o) => reviewContractReference(st, en, contractNo, { ...args, ...o })),
    // the references of an order, resolved against the invoices by the data service (reference matching only — never by amount)
    resolve: (refs) => api.orderMatch(requestFor({ from: '2000-01-01', to: DATA_CUTOFF }, { refs })),
    debtorInvoices: (debtor, excludeIds) => api.orderDebtorInvoices(requestFor({ from: '2000-01-01', to: DATA_CUTOFF }, { debtor, excludeIds }))
  }), [enfAct, requestFor]);

  /* ---------- analyst notes (analytical layer only) ---------- */
  const addNote = useCallback((invoiceId, text) => {
    if (!canReview) return { ok: false, error: 'no_permission' };
    const by = user?.nameAr || user?.nameEn || user?.name || 'Analyst';
    setNotes((n) => ({ ...n, [invoiceId]: [...(n[invoiceId] || []), { at: DATA_CUTOFF, by, text }] }));
    return { ok: true };
  }, [canReview, user, setNotes]);

  /* ---------- uploads (held by the data service for this session) ---------- */
  const commitUpload = useCallback(async (importResult) => {
    const r = await api.upload(importResult.accepted);
    setUploads((u) => ({
      count: u.count + (r.added || 0),
      log: [...u.log, { ...importResult.meta, fileName: importResult.fileName, uploadedAt: new Date().toISOString(), accepted: r.added || 0, rejected: importResult.rejected.length + (r.duplicates?.length || 0), rowsRead: importResult.rowsRead, linesRead: importResult.linesRead, duplicateLines: importResult.duplicateLines, uploadCutoff: importResult.uploadCutoff, validations: importResult.validations }]
    }));
    return r;
  }, [setUploads]);
  const clearUploads = useCallback(async () => { await api.clearUploads(); setUploads({ log: [], count: 0 }); }, [setUploads]);

  /* ---------- configuration ---------- */
  const setRuleEnabled = useCallback((id, enabled) => setCfg((c) => ({ ...c, rules: { ...c.rules, [id]: enabled } })), [setCfg]);
  const setCrStatuses = useCallback((list) => setCfg((c) => ({ ...c, crStatuses: list })), [setCfg]);
  const setGraceDays = useCallback((n) => setCfg((c) => ({ ...c, graceDays: Math.max(0, Number(n) || 0) })), [setCfg]);
  const setCollectionsAsOf = useCallback((v) => setCfg((c) => ({ ...c, collectionsAsOf: v })), [setCfg]);
  const resetConfig = useCallback(() => { setCfg({ graceDays: DEFAULT_CONFIG.graceDays, collectionsAsOf: DEFAULT_CONFIG.collectionsAsOf, crStatuses: DEFAULT_CONFIG.crStatuses, rules: DEFAULT_CONFIG.rules }); setTargets(DEFAULT_TARGETS); }, [setCfg, setTargets]);

  /* ---------- analysis tasks ---------- */
  const [tasks, setTasks] = useState([]);
  const tasksRef = useRef([]);
  tasksRef.current = tasks;
  const [modalTaskId, setModalTaskId] = useState(null);
  const [resultTaskId, setResultTaskId] = useState(null);
  const controllers = useRef(new Map());
  const live = useRef({});
  live.current = { cases, decisions, cfg: cfgN, targets, dataVersion, scopeEff, currentScopeKey, requestFor };

  const startAnalysis = useCallback((kind, params = {}, opts = {}) => {
    const L = live.current;
    const scopeForTask = opts.scope ? { ...opts.scope, org } : L.scopeEff;
    const followsGlobal = opts.followsGlobal ?? !opts.scope;
    const state = createTaskState(kind, { scope: scopeForTask, params, background: !!opts.background, paceMs: opts.paceMs ?? PACE_MS });
    state.followsGlobal = followsGlobal;
    state.origin = opts.origin || null;
    state.inline = !!opts.inline;
    if (state.inline) state.modal = false;

    const existing = tasksRef.current.find((t) => t.key === state.key && (t.status === 'queued' || t.status === 'running'));
    if (existing) {
      if (!existing.background && existing.modal) setModalTaskId(existing.id);
      return { id: existing.id, duplicate: true, promise: Promise.resolve(existing) };
    }

    const ac = new AbortController();
    controllers.current.set(state.id, ac);
    tasksRef.current = [state, ...tasksRef.current];
    setTasks((prev) => [state, ...prev].slice(0, 12));
    if (state.modal && !opts.background) setModalTaskId(state.id);

    const data = {
      snapshot: (sc, extra) => api.snapshot(L.requestFor(sc, extra), { signal: ac.signal }),
      bridge: (sc, extra) => api.bridge(L.requestFor(sc, extra), { signal: ac.signal }),
      series: (sc, extra) => api.series(L.requestFor(sc, extra), { signal: ac.signal }),
      worklist: (sc, limit) => api.worklist(L.requestFor(sc, { limit }), { signal: ac.signal }),
      anomalies: (sc, limit) => api.anomalies(L.requestFor(sc, { limit }), { signal: ac.signal }),
      invoice: (id) => api.invoice(L.requestFor({ from: '2000-01-01', to: DATA_CUTOFF }, { id }), { signal: ac.signal }),
      contracts: (sc) => api.contracts(L.requestFor(sc), { signal: ac.signal })
    };
    const promise = runTask(state, {
      data, cases: L.cases, decisions: L.decisions, cfg: L.cfg, targets: L.targets,
      dataVersion: L.dataVersion, signal: ac.signal, paceMs: opts.paceMs ?? PACE_MS,
      onUpdate: (u) => setTasks((prev) => prev.map((t) => (t.id === u.id ? { ...t, ...u, background: t.background, followsGlobal: t.followsGlobal, origin: t.origin, inline: t.inline, modal: t.modal } : t)))
    }).then((final) => {
      controllers.current.delete(state.id);
      return final;
    });
    return { id: state.id, duplicate: false, promise };
  }, [org]);

  const cancelTask = useCallback((id) => { controllers.current.get(id)?.abort(); }, []);
  const sendToBackground = useCallback((id) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, background: true } : t)));
    setModalTaskId((m) => (m === id ? null : m));
  }, []);
  const dismissTask = useCallback((id) => {
    controllers.current.get(id)?.abort();
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setModalTaskId((m) => (m === id ? null : m));
  }, []);
  const closeModal = useCallback(() => setModalTaskId(null), []);
  const viewResult = useCallback((id) => { setModalTaskId(null); setResultTaskId(id); }, []);
  const closeResult = useCallback(() => setResultTaskId(null), []);
  const openTask = useCallback((id) => setModalTaskId(id), []);

  const isStale = useCallback((task) => {
    if (!task) return false;
    if (task.dataVersion != null && task.dataVersion !== dataVersion) return true;
    return !!task.followsGlobal && task.scopeKey !== currentScopeKey;
  }, [dataVersion, currentScopeKey]);

  const saveForecastVersion = useCallback((forecast) => {
    if (!forecast?.ready) return;
    setForecastVersions((v) => [...v, {
      id: `FCV-${v.length + 1}`,
      savedFromCutoff: forecast.cutoff,
      scopeKey: scopeKey(forecast.scope),
      method: forecast.method.id,
      rows: forecast.horizon.months.map((m, i) => ({ month: m, forecast: forecast.horizon.point[i], low: forecast.horizon.low[i], high: forecast.horizon.high[i] }))
    }]);
  }, [setForecastVersions]);

  const value = {
    user, org, canReview, meta, loading, loadError, retryLoad: () => setReloadKey((k) => k + 1), ready: !!(meta && snapshot && prevSnapshot && comparison),
    scope, scopeEff, currentScopeKey, resetScope, setPreset, setCustomRange, setAmanah, setSource, setScopeType, setMuni, setStatus,
    cfg: cfgN, setCrStatuses, setRuleEnabled, setGraceDays, setCollectionsAsOf, resetConfig,
    targets, setTargets,
    snapshot, prevSnapshot, comparison, decisions, links, dataVersion, requestFor, data,
    decideExclusion,
    cases, enforcement, enf1Decisions: enfStore?.enf1 || {},
    uploads, commitUpload, clearUploads, notes, addNote,
    scenario, setScenario,
    forecastVersions, saveForecastVersion,
    tasks, modalTaskId, resultTaskId, viewResult, closeResult, startAnalysis, cancelTask, sendToBackground, dismissTask, closeModal, openTask, isStale
  };
  // F-31: the sign-in page does not wait for (or fail with) the data service; the provider keeps one stable shape so signing in or out never remounts the tree
  const gate = !user ? null : (loadError && !snapshot) ? <DataServiceError error={loadError} /> : !value.ready ? <DataServiceLoading /> : null;
  return <RevenueCtx.Provider value={value}>{gate || children}</RevenueCtx.Provider>;
}

function DataServiceLoading() {
  const ar = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('ib_lang')) !== 'en';
  return (
    <div role="status" aria-live="polite" style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }} dir={ar ? 'rtl' : 'ltr'}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{ar ? 'جارٍ تجهيز البيانات التجريبية…' : 'Preparing the demo data…'}</div>
        <div style={{ opacity: 0.7, fontSize: 13 }}>{ar ? 'تُحسب المؤشرات في خدمة البيانات؛ لا تُحمَّل الفواتير في المتصفح.' : 'Indicators are computed in the data service; invoices are never loaded into the browser.'}</div>
      </div>
    </div>
  );
}
function DataServiceError({ error }) {
  const ar = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('ib_lang')) !== 'en';
  return (
    <div role="alert" style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }} dir={ar ? 'rtl' : 'ltr'}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{ar ? 'تعذّر الوصول إلى خدمة البيانات' : 'The data service is not reachable'}</div>
        <div style={{ opacity: 0.7, fontSize: 13 }}>{String(error.message || error)}</div>
        <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => window.location.reload()}>{ar ? 'إعادة المحاولة' : 'Retry'}</button>
      </div>
    </div>
  );
}

export function useRevenue() {
  const v = useContext(RevenueCtx);
  if (!v) throw new Error('useRevenue must be used inside <RevenueProvider>');
  return v;
}
