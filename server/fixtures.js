// Appends full record objects (the hand-anchored fixtures and uploaded rows) to the columnar store, so they are
// scanned, scoped and aggregated by exactly the same engine as the generated invoices.
import { gfsCodeOf, gfsIndexOf, objectionStatusIndex } from '../src/data/iim.js';
import { ITEMS, ENTITY_INDEX, SOURCE_INDEX, ITEM_INDEX, RULE_BIT, CR_STATUS, CHANNELS, CSTAT, F, dayNum } from '../src/data/catalog.js';

export function appendRecord(st, rec, { owner = 0, kind = 'fixture' } = {}) {
  const i = st.addInvoice();
  const e = ENTITY_INDEX[rec.amanahEn];
  if (e == null) throw new Error(`unknown Amanah: ${rec.amanahEn}`);
  st.idKey[i] = 0; st.issue[i] = dayNum(rec.issueDate); st.due[i] = dayNum(rec.dueDate); st.gross[i] = rec.grossAmount;
  const adj = (rec.adjustments || [])[0];
  st.adjAmt[i] = adj ? adj.amount : 0; st.adjDay[i] = adj ? dayNum(adj.date) : 0;
  st.ent[i] = e; st.muni[i] = 255; st.scope[i] = rec.scopeType === 'internal' ? 1 : 0;
  st.src[i] = SOURCE_INDEX[rec.revenueSource] ?? SOURCE_INDEX.municipal_fees;
  st.item[i] = rec.revenueItem?.key && ITEM_INDEX[rec.revenueItem.key] !== undefined ? ITEM_INDEX[rec.revenueItem.key] : 0;
  st.lines[i] = Math.max(1, (rec.lineItems || []).length);
  { let h = 5381; for (const ch of String(rec.id)) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0; st.gfs[i] = gfsIndexOf(rec.gfsCode || gfsCodeOf(ITEMS[st.item[i]].key, h)); } // رقم حساب الإيراد
  st.payStart[i] = st.pn;
  const pays = [...(rec.payments || [])].sort((a, b) => a.date.localeCompare(b.date));
  for (const p of pays) st.addPayment(i, dayNum(p.date), p.amount, Math.max(0, CHANNELS.indexOf(p.channel)));
  st.payCount[i] = pays.length;
  st.cancelDay[i] = rec.cancelled?.date ? dayNum(rec.cancelled.date) : 0;
  let mask = 0; let appr = 0;
  const ex = rec.exclusions?.length ? rec.exclusions : rec.exclusion ? [rec.exclusion] : [];
  for (const x of ex) { const bit = RULE_BIT[x.ruleId]; if (!bit) continue; mask |= bit; if (x.reviewStatus === 'approved') appr |= bit; }
  st.exMask[i] = mask; st.exAppr[i] = appr; st.exRev[i] = 0;
  let flags = kind === 'upload' ? F.UPLOADED : F.FIXTURE;
  if (rec.objection?.open) { flags |= F.OBJECTION; st.objSt[i] = objectionStatusIndex(rec.objection.status || 'awaiting_member'); } else st.objSt[i] = 0;
  if ((rec.missingFields || []).length) flags |= F.MISSING_ID;
  if (rec.amountCheck?.status === 'conflict') flags |= F.AMT_CONFLICT;
  if (rec.amountCheck?.status === 'not_checkable') flags |= F.NOT_CHECKABLE;
  if (rec.sourceStatus === 'cancelled' && !rec.cancelled) flags |= F.LEGACY_CANCELLED;
  if (rec.workflowStatus === 'duplicate') flags |= F.DUPLICATE_WF;
  st.flags[i] = flags;
  st.contract[i] = -1; st.inst[i] = 0; st.cstat[i] = Math.max(0, CSTAT.indexOf(rec.contract?.status || 'not_applicable'));
  st.crSt[i] = Math.max(0, CR_STATUS.indexOf(rec.crStatusRaw || null)); st.exec[i] = -1; st.efaa[i] = 0;
  st.payer[i] = 0; st.owner[i] = owner;
  st.fixtures.set(i, rec); st.fixtureById.set(rec.id, i);
  return i;
}
