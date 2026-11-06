import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { createSourceStore } from '../data/ingestion/store';
import { importRows } from '../data/ingestion/importer';
import { syntheticTables } from '../data/ingestion/synthetic';
import { groupEefaa } from '../data/ingestion/eefaa';
import { buildRelations, reviewEntry } from '../data/ingestion/relations';
import { importedSanadCases } from '../data/ingestion/sanadCases';
import { displayName } from '../utils/identity';

// Imported source records (Sanad / Eefaa / Mumtathil), import batches and reviewer decisions. Browser storage (IndexedDB) holds only SYNTHETIC demo records and the reviewer history:
// browser storage is not permission to retain confidential source data, so the import panel tells the user to use the synthetic templates.
const Ctx = createContext(null);
const EMPTY = { ready: true, records: [], batches: [], reviews: [], groups: [], relations: { byGroup: new Map(), unlinkedMumtathil: [], stats: {} }, importedCases: [], error: null, actions: {} };
export const useSourceRecords = () => useContext(Ctx) || EMPTY;

export function SourceRecordsProvider({ children }) {
  const { user } = useAuth() || {};
  const store = useMemo(() => createSourceStore(), []);
  const [state, setState] = useState({ ready: false, records: [], batches: [], reviews: [], error: null });
  const alive = useRef(true); useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []); // StrictMode mounts twice: mark alive again on every mount
  const reload = useCallback(async () => {
    try { const [records, batches, reviews] = await Promise.all([store.records(), store.batches(), store.reviews()]); if (alive.current) setState({ ready: true, records, batches, reviews, error: null }); }
    catch (e) { if (alive.current) setState((s) => ({ ...s, ready: true, error: String(e?.message || e) })); }
  }, [store]);
  useEffect(() => { reload(); }, [reload]);

  // The records are READ FROM THE DATA BANK in production. In the demo, synthetic records stand in for that read: they are seeded through the same ingestion pipeline on every load (idempotent: unchanged rows are not rewritten).
  const seeded = useRef(false);
  const readDataBank = useCallback(async () => {
    const T = syntheticTables(); const out = [];
    let existing = await store.recordMap();
    if ([...existing.values()].some((r) => r.ingestion?.method === 'excel')) { await store.resetSynthetic(); existing = new Map(); } // records of the retired Excel method are replaced (reviewer history is kept)
    for (const [id, t] of Object.entries(T)) {
      const result = importRows({ headers: t.headers, rows: t.rows, reportId: id, file: { name: 'data-bank-demo', sha256: 'synthetic' }, method: 'data_bank', existing });
      if (result.ok) { await store.commit(result); for (const r of result.upserts) existing.set(r.id, r); }
      out.push({ id, result });
    }
    await reload(); return out;
  }, [store, reload]);
  useEffect(() => { if (seeded.current) return; seeded.current = true; readDataBank().catch((e) => { if (alive.current) setState((x) => ({ ...x, ready: true, error: String(e?.message || e) })); }); }, [readDataBank]);
  const decide = useCallback(async (kind, subject, decision, note = '') => { await store.putReview(reviewEntry(kind, subject, decision, { by: displayName(user, 'en') || 'Reviewer', note })); await reload(); }, [store, user, reload]);

  const derived = useMemo(() => {
    const groups = groupEefaa(state.records); const relations = buildRelations(groups, state.records, state.reviews);
    return { groups, relations, importedCases: importedSanadCases(state.records) };
  }, [state.records, state.reviews]);
  const value = useMemo(() => ({ ...state, ...derived, actions: { readDataBank, decide, reload } }), [state, derived, readDataBank, decide, reload]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
