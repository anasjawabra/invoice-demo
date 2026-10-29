import { EXCLUSION_RULES } from '../src/data/revenueMetrics.js';
import { makeCtx, resolveScope, lookupId, derive, inScope } from './engine.js';
import { canAccessInvoice } from './access.js';
import { rowOut, listEpoch } from './lists.js';
import { F } from '../src/data/catalog.js';
export async function workflowRecords(st, req, { signal } = {}) {
  if (!Array.isArray(req.ids) || req.ids.length > 5000) throw Object.assign(new Error('max_5000_records'), { status: 400 });
  const version = listEpoch(); const ctx = makeCtx(st, req); const sc = resolveScope(ctx, req.scope); const rows = [];
  for (const [k, id] of [...new Set(req.ids)].entries()) {
    if (k % 100 === 0) { await new Promise((r) => setImmediate(r)); if (signal?.aborted) throw Object.assign(new Error('query_cancelled'), { name: 'AbortError' }); }
    const i = lookupId(st, String(id), ctx.owner);
    if (!canAccessInvoice(st, req, i) || !inScope(st, sc, i) || st.issue[i] < sc.fromN || st.issue[i] > sc.toN || st.issue[i] > ctx.cutoffN) continue;
    derive(ctx, i, ctx.cutoffN); if (sc.statusSet && !sc.statusSet[ctx.D.cls]) continue;
    rows.push(rowOut(st, ctx, i, ctx.D));
  }
  if (version !== listEpoch()) throw Object.assign(new Error('dataset_changed_retry'), { status: 409 });
  return { rows };
}
export async function validateExclusionRows(st, req, { signal } = {}) {
  if (!Array.isArray(req.rows) || req.rows.length > 5000) throw Object.assign(new Error('max_5000_rows'), { status: 400 });
  const version = listEpoch(); const ctx = makeCtx(st, req); const sc = resolveScope(ctx, req.scope); const seen = new Set(); const accepted = [], rejected = [];
  for (let k = 0; k < req.rows.length; k++) {
    if (k % 100 === 0) { await new Promise((r) => setImmediate(r)); if (signal?.aborted) throw Object.assign(new Error('query_cancelled'), { name: 'AbortError' }); }
    const x = req.rows[k]; const r = { row: k + 2, invoiceId: String(x?.invoiceId || '').trim(), ruleId: String(x?.ruleId || '').trim(), evidence: String(x?.evidence || '').trim() };
    const rule = EXCLUSION_RULES.find((v) => v.id === r.ruleId && !v.locked && v.id !== 'DEC-1');
    let reason = !r.invoiceId || r.invoiceId.length > 160 ? 'invalid_invoice_id' : !rule ? 'unsupported_rule' : !ctx.cfg.rules[r.ruleId] ? 'rule_disabled' : r.evidence.length < 3 || r.evidence.length > 2000 ? 'evidence_required' : seen.has(`${r.invoiceId}|${r.ruleId}`) ? 'duplicate_row' : null;
    seen.add(`${r.invoiceId}|${r.ruleId}`);
    const i = reason ? -1 : lookupId(st, r.invoiceId, ctx.owner);
    if (!reason && !canAccessInvoice(st, req, i)) reason = 'not_accessible';
    if (!reason && (!inScope(st, sc, i) || st.issue[i] < sc.fromN || st.issue[i] > sc.toN || st.issue[i] > ctx.cutoffN)) reason = 'outside_selected_scope';
    if (!reason) {
      derive(ctx, i, ctx.cutoffN); const d = ctx.D;
      if (d.cancelled || !(d.outstanding + d.exclusionAmount > 0)) reason = 'no_eligible_balance';
      else if (req.decisions?.[r.invoiceId]?.byRule?.[r.ruleId]) reason = 'existing_review';
      else if (r.ruleId === 'CR-1' && (!st.crSt[i] || !ctx.crOk[st.crSt[i]]) || r.ruleId === 'NOC-1' && st.cstat[i] !== 3 || r.ruleId === 'SND-1' && st.exec[i] < 0 && !(ctx.ov.get(i)?.link >= 2 && ctx.ov.get(i)?.link <= 4) || r.ruleId === 'OBJ-1' && !(st.flags[i] & F.OBJECTION)) reason = 'rule_conditions_not_met';
      else r.balance = d.outstanding + d.exclusionAmount;
    }
    (reason ? rejected : accepted).push(reason ? { ...r, reason } : r);
  }
  if (version !== listEpoch()) throw Object.assign(new Error('dataset_changed_retry'), { status: 409 });
  return { accepted, rejected, rowsRead: req.rows.length };
}
