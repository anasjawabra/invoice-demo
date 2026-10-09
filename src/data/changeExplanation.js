// ============================================================================
// Explaining a change in the collection rate between two comparable periods.
//
// Everything here is MEASURABLE (mix / rate effects, exceptional receipts,
// cancellations, exclusions, data scope). None of it is a proven cause: a
// measured factor says WHERE the movement sits, not WHY the payers behaved that
// way. The causal question is always returned as "needs verification".
// ============================================================================
import { previousScope, compareSnapshots, ratio } from './revenueMetrics';
import { detectExceptionalPayments } from './revenueOutlook';
import { fmtBn } from '../utils/money';
const money = (n) => fmtBn(n, { lang: 'en' });
const mAr = (n) => fmtBn(n, { lang: 'ar' });

const BI = (ar, en) => ({ ar, en });

// Two-factor decomposition of Δ(collected ÷ net) over groups:
//   mix effect  = Σ (w_cur − w_prev) · r_prev       (share of net billed moved between groups)
//   rate effect = Σ  w_cur · (r_cur − r_prev)       (collection rate moved inside groups)
// where w = group net billed ÷ total net billed, r = group collected ÷ net billed.
export function decompose(currGroups, prevGroups) {
  const tc = currGroups.reduce((s, g) => s + g.net, 0);
  const tp = prevGroups.reduce((s, g) => s + g.net, 0);
  if (!(tc > 0) || !(tp > 0)) return null;
  const keys = new Set([...currGroups.map((g) => g.key), ...prevGroups.map((g) => g.key)]);
  const c = new Map(currGroups.map((g) => [g.key, g]));
  const p = new Map(prevGroups.map((g) => [g.key, g]));
  let mix = 0; let rate = 0;
  const rows = [];
  for (const k of keys) {
    const gc = c.get(k); const gp = p.get(k);
    const wc = gc ? gc.net / tc : 0; const wp = gp ? gp.net / tp : 0;
    const rc = gc && gc.net > 0 ? gc.collected / gc.net : 0; const rp = gp && gp.net > 0 ? gp.collected / gp.net : 0;
    const m = (wc - wp) * rp; const r = wc * (rc - rp);
    mix += m; rate += r;
    rows.push({ key: k, label: (gc || gp).label || null, mixPp: m * 100, ratePp: r * 100, totalPp: (m + r) * 100, netCurr: gc?.net || 0, netPrev: gp?.net || 0, rateCurr: gc && gc.net > 0 ? rc : null, ratePrev: gp && gp.net > 0 ? rp : null });
  }
  rows.sort((a, b) => Math.abs(b.totalPp) - Math.abs(a.totalPp));
  return { mixPp: mix * 100, ratePp: rate * 100, totalPp: (mix + rate) * 100, rows };
}

// `data` is the data-service provider ({ snapshot, series }); the explanation is computed from two server snapshots and their monthly receipts.
export async function explainChange(data, scope, cfg = {}, pre = {}) {
  const sc0 = { from: scope.from, to: scope.to, amanah: scope.amanah, source: scope.source, scopeType: scope.scopeType, muni: scope.muni, status: scope.status };
  const prevScopeV = previousScope(scope);
  const curr = pre.curr || await data.snapshot(sc0);
  const prev = pre.prev || await data.snapshot({ from: prevScopeV.from, to: prevScopeV.to, basis: prevScopeV.basis, amanah: scope.amanah, source: scope.source, scopeType: scope.scopeType, muni: scope.muni, status: scope.status });
  const cmp = compareSnapshots(curr, prev);
  const out = { curr, prev, cmp, comparable: cmp.comparable, scopeCurr: curr.scope, scopePrev: prev.scope, factors: [], needsVerification: [] };
  if (!cmp.comparable) {
    out.reason = cmp.notComparableReason;
    out.needsVerification.push(BI('لا توجد فترة سابقة مماثلة ضمن تغطية البيانات، لذا لا يُفسَّر تغير.', 'No like-for-like previous period inside the data coverage, so no change is explained.'));
    return out;
  }
  const dPp = cmp.collectedOverNetPp;
  out.deltaPp = dPp.calculable ? dPp.value : null;

  const bySrc = decompose(curr.bySource.map((g) => ({ key: g.key, net: g.net, collected: g.collected })), prev.bySource.map((g) => ({ key: g.key, net: g.net, collected: g.collected })));
  const byAm = decompose(curr.byAmanah.map((g) => ({ key: g.key, label: g.label, net: g.net, collected: g.collected })), prev.byAmanah.map((g) => ({ key: g.key, label: g.label, net: g.net, collected: g.collected })));
  out.bySource = bySrc; out.byAmanah = byAm;
  if (bySrc) out.factors.push({ key: 'source_mix', kind: 'measured', pp: bySrc.mixPp, text: BI(`أثر تغير مزيج مصادر الإيراد: ${bySrc.mixPp.toFixed(1)} نقطة مئوية؛ وأثر معدل التحصيل داخل المصادر: ${bySrc.ratePp.toFixed(1)}.`, `Revenue-source mix effect: ${bySrc.mixPp.toFixed(1)} pp; collection-rate effect inside sources: ${bySrc.ratePp.toFixed(1)} pp.`) });
  if (byAm) {
    const top = byAm.rows[0];
    out.factors.push({ key: 'entities', kind: 'measured', pp: byAm.totalPp, text: BI(`أثر الجهات (الأمانات): مزيج ${byAm.mixPp.toFixed(1)} + معدل ${byAm.ratePp.toFixed(1)} نقطة${top ? `؛ أكبر حركة في ${top.label?.ar || top.key} (${top.totalPp.toFixed(1)})` : ''}.`, `Entity (Amanah) effect: mix ${byAm.mixPp.toFixed(1)} + rate ${byAm.ratePp.toFixed(1)} pp${top ? `; largest movement in ${top.label?.en || top.key} (${top.totalPp.toFixed(1)})` : ''}.`) });
  }

  // exceptional collections
  const exceptionalOf = async (snap) => {
    try {
      const mr = await data.series({ from: snap.scope.from, to: snap.scope.to, amanah: snap.scope.amanah, source: snap.scope.source, scopeType: snap.scope.scopeType, muni: snap.scope.muni, status: snap.scope.status }, { asOf: snap.scope.to });
      return detectExceptionalPayments(mr.months, mr.values, mr.payments, { typicalPayment: mr.typicalPayment });
    } catch { return []; }
  };
  const [exC, exP] = await Promise.all([exceptionalOf(curr), exceptionalOf(prev)]);
  const sum = (a) => a.reduce((s, x) => s + x.amount, 0);
  out.exceptional = { curr: sum(exC), prev: sum(exP), currCount: exC.length, prevCount: exP.length };
  if (exC.length || exP.length) out.factors.push({ key: 'exceptional', kind: 'measured', amount: sum(exC) - sum(exP), text: BI(`تحصيلات استثنائية كبيرة: ${exC.length} دفعة بقيمة ${mAr(sum(exC))} في الفترة الحالية مقابل ${exP.length} دفعة بقيمة ${mAr(sum(exP))} في السابقة؛ تُفصل عن الاتجاه المعتاد.`, `Large exceptional collections: ${exC.length} payment(s) worth ${money(sum(exC))} now vs ${exP.length} worth ${money(sum(exP))} before; separated from the usual trend.`) });

  // cancellations and exclusions as a share of gross
  const share = (snap, k) => (snap.totals.gross > 0 ? (snap.totals[k] / snap.totals.gross) * 100 : 0);
  out.base = {
    cancelledPp: share(curr, 'cancelled') - share(prev, 'cancelled'),
    excludedPp: share(curr, 'exclusionsRules') - share(prev, 'exclusionsRules'),
    cancelled: [curr.totals.cancelled, prev.totals.cancelled],
    excluded: [curr.totals.exclusionsRules, prev.totals.exclusionsRules]
  };
  out.factors.push({ key: 'cancelled_excluded', kind: 'measured', text: BI(`الإلغاءات ${mAr(curr.totals.cancelled)} مقابل ${mAr(prev.totals.cancelled)}؛ استبعاد القواعد ${mAr(curr.totals.exclusionsRules)} مقابل ${mAr(prev.totals.exclusionsRules)}. تغير الحصة من الإجمالي: ملغى ${out.base.cancelledPp.toFixed(1)} واستبعاد ${out.base.excludedPp.toFixed(1)} نقطة.`, `Cancelled ${money(curr.totals.cancelled)} vs ${money(prev.totals.cancelled)}; excluded ${money(curr.totals.exclusions)} vs ${money(prev.totals.exclusions)}. Share of gross moved: cancelled ${out.base.cancelledPp.toFixed(1)} and excluded ${out.base.excludedPp.toFixed(1)} pp.`) });

  // data scope / quality change
  out.dataScope = { records: [curr.totals.count, prev.totals.count], unapprovedExclusion: [curr.totals.exclusionsUnapproved, prev.totals.exclusionsUnapproved], conflicts: [curr.quality.amountConflictCount, prev.quality.amountConflictCount] };
  out.factors.push({ key: 'data_scope', kind: 'measured', text: BI(`نطاق البيانات: ${curr.totals.count} فاتورة مقابل ${prev.totals.count}؛ تعارضات المبالغ ${curr.quality.amountConflictCount} مقابل ${prev.quality.amountConflictCount}؛ استبعادات بقواعد غير معتمدة ${mAr(curr.totals.exclusionsUnapproved)} مقابل ${mAr(prev.totals.exclusionsUnapproved)}.`, `Data scope: ${curr.totals.count} invoices vs ${prev.totals.count}; amount conflicts ${curr.quality.amountConflictCount} vs ${prev.quality.amountConflictCount}; exclusions under unapproved rules ${money(curr.totals.exclusionsUnapproved)} vs ${money(prev.totals.exclusionsUnapproved)}.`) });

  out.maturityCaveat = BI('كل فترة تُقاس عند نهايتها (العمر نفسه)، فلا تفسر نضجية التحصيل الفرق.', 'Each period is measured at its own end date (same age), so collection maturity does not explain the difference.');
  out.needsVerification.push(BI('لماذا غيّر الدافعون سلوكهم في السداد (سيولة، نزاع، تأخر إداري) غير مسجل في البيانات؛ يحتاج تحققاً ميدانياً قبل اعتباره سبباً.', 'Why payers changed their behaviour (cash-flow, dispute, administrative delay) is not recorded in the data; it needs field verification before it is treated as a cause.'));
  return out;
}

export { ratio };
