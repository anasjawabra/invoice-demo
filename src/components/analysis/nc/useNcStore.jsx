// The saved non-collection analyses as a React concern: the per-user store, the list of what the signed-in person may open, and the one place where a FINISHED task becomes a saved version.
//  - <NcAutoSave/> (mounted once, in AnalysisHost) saves every completed non-collection task as soon as it finishes; a task started by «تحديث التحليل» (origin `nc-refresh:<id>`) is appended
//    as a NEW version of that analysis, any other task becomes a new analysis. Saving is idempotent per task (the stored version remembers the task id).
//  - The page and the /collection list re-read the store whenever it changes (useSyncExternalStore).
import React, { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useRevenue } from '../../../context/RevenueContext';
import { useReportAccess } from '../../../data/useReportAccess';
import { createAnalysisStore, userKeyOf, subscribeStore, storeVersion, notifyStore } from '../../../data/analysisStore';

let singleton = null;
export const ncStore = () => { if (!singleton) singleton = createAnalysisStore(); return singleton; };
const saveErrors = new Map(); // taskId → error code (the result then lives in this session only)
export const saveErrorOf = (taskId) => saveErrors.get(taskId) || null;
export const REFRESH_PREFIX = 'nc-refresh:';
// task ids restart at task-1 on every page load, so the saved task key carries a per-load prefix (a stored version must never be mistaken for a task of a later session)
const PAGE = `${Date.now().toString(36)}${Math.floor(Math.random() * 46656).toString(36)}`;
export const taskKey = (t) => `${PAGE}:${t.id}`;
export const isNcTask = (t) => !!t && t.kind === 'noncollection' && !!t.result && t.result.kind === 'noncollection' && (t.status === 'completed' || t.status === 'completed_with_limitations');

/** saves a finished task: → { ok, id, n, duplicate?, error? } */
export function saveNcTask(uk, viewer, task) {
  if (!uk || !isNcTask(task)) return { ok: false, error: 'not_saveable' };
  const store = ncStore();
  const input = { analysis: task.result.analysis, taskScope: task.scope || null, generatedAt: task.result.generatedAt, cutoff: task.result.cutoff, sourceTaskId: taskKey(task), dataVersion: task.dataVersion ?? null };
  const target = typeof task.origin === 'string' && task.origin.startsWith(REFRESH_PREFIX) ? task.origin.slice(REFRESH_PREFIX.length) : null;
  let r = target ? store.addVersion(uk, target, input, { org: viewer }) : store.create(uk, input, { org: viewer });
  if (target && !r.ok && (r.error === 'not_found' || r.error === 'forbidden')) r = store.create(uk, input, { org: viewer }); // the analysis it refreshes was deleted meanwhile: the result is kept as a new analysis
  if (r.ok) saveErrors.delete(task.id); else saveErrors.set(task.id, r.error);
  if (r.ok && !r.duplicate) notifyStore();
  return r;
}

export function useNcStore() {
  const rev = useRevenue(); const uk = userKeyOf(rev.user); const viewer = useReportAccess('invoices_uncollected').viewer; // the signed-in account's CURRENT access: saved analyses are listed / opened only within it
  const ver = useSyncExternalStore(subscribeStore, storeVersion, storeVersion);
  const store = ncStore();
  const list = useMemo(() => store.list(uk, viewer), [store, uk, viewer, ver]); // eslint-disable-line react-hooks/exhaustive-deps
  return { uk, viewer, store, list, ver, remove: (id) => { const ok = store.remove(uk, id); notifyStore(); return ok; } };
}

export function NcAutoSave() {
  const rev = useRevenue(); const uk = userKeyOf(rev.user); const viewer = useReportAccess('invoices_uncollected').viewer; const done = useRef(new Set());
  useEffect(() => {
    if (!uk) return;
    for (const t of rev.tasks) { if (!isNcTask(t) || done.current.has(t.id)) continue; done.current.add(t.id); saveNcTask(uk, viewer, t); }
  }, [rev.tasks, uk, viewer]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
