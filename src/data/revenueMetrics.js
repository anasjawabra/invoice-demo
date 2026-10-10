// ============================================================================
// Shared revenue-metric calculation layer.
//
// Every screen (executive dashboard, analyst dashboard, invoice details,
// noncollection analysis, forecasts, smart reports, the assistant) must get
// its revenue numbers from `computeSnapshot()` below, so matching scope always
// produces matching metrics. No page may re-implement exclusion, collected or
// ratio logic.
//
// Definitions (full text in METRIC_DEFINITIONS, shown to users in the UI):
//   Gross billed      = sum of original invoice amounts, invoices ISSUED in the period
//   Adjustments       = approved credit notes / reductions (negative), dated <= data cutoff
//   Exclusions        = cancelled + billed amount of invoices carrying an APPROVED exclusion under an
//                       ENABLED rule (versioned). Exclusion changes the KPI denominator only;
//                       it never means "uncollectible".
//   Net billed        = gross billed - exclusions   (gross already includes approved adjustments)
//   Collected (B)     = payments, dated <= the collection as-of date, ATTRIBUTED to the
//                       invoices issued in the period (non-excluded invoices)
//   Received (A)      = payments RECEIVED in the period, whatever period the invoice was
//                       issued in. A and B are different populations and are never mixed
//                       in one ratio.
//   Outstanding       = net billed - collected (never negative; overpayment tracked apart)
//   Collected / net   = analytical view; the stakeholder meeting describes the Ministry
//                       collection rate as collected over "net billed", but the exclusion
//                       approval rules are unresolved, so it is NOT labelled "official".
//   Collected / gross = analytical view before any exclusion.
// ============================================================================
import { DATA_CUTOFF, DATA_START, addDays, daysBetween, monthOf, REVENUE_SOURCE_KEYS, accessibleLedger } from './revenueLedger';

/* ---------- Not-calculable handling ---------- */
export const NOT_CALCULABLE_LABEL = { en: 'Not available', ar: 'غير متاحة', zh: '不可用' };

// Ratio that refuses zero / invalid denominators instead of returning 0 or Infinity.
export function ratio(num, den) {
  const ok = Number.isFinite(num) && Number.isFinite(den) && den > 0;
  return { calculable: ok, value: ok ? num / den : null, num, den };
}
export const pct1 = (r) => (r && r.calculable ? Math.round(r.value * 1000) / 10 : null);

// Percentage-point change from UNROUNDED ratios, rounded once for display.
export function ppChange(curr, prev) {
  if (!curr?.calculable || !prev?.calculable) return { calculable: false, value: null };
  return { calculable: true, value: Math.round((curr.value - prev.value) * 1000) / 10 };
}
export function relChange(curr, prev) {
  if (!Number.isFinite(curr) || !Number.isFinite(prev) || prev === 0) return { calculable: false, value: null };
  return { calculable: true, value: Math.round(((curr - prev) / Math.abs(prev)) * 1000) / 10 };
}

export function formatRatio(r, lang = 'en', digits = 1) {
  if (!r || !r.calculable) return NOT_CALCULABLE_LABEL[lang] || NOT_CALCULABLE_LABEL.en;
  return `${(r.value * 100).toFixed(digits)}%`;
}

/* ---------- Exclusion rule registry (versioned, configurable) ----------
   Each rule carries: version, enabled-by-default flag, `priority` (lowest number
   wins when an invoice carries several reasons — ONE primary reason, counted
   once), and `approval`. `approval: 'unapproved'` means the business has not
   confirmed the rule; it stays configurable and its effect is always shown as
   "غير معتمدة / unapproved" — it is never presented as an official figure. */
export const EXCLUSION_RULE_SET_VERSION = 'EXCL-RULES v2 (demo configuration)';

export const EXCLUSION_RULES = [
  { id: 'DUP-1', category: 'duplicate', version: 1, priority: 1, defaultEnabled: true, locked: false, basis: 'stated_in_meeting', approval: 'approved', effectiveFrom: '2026-07-01', owner: { en: 'Revenue data steward', ar: 'أمين بيانات الإيرادات' },
    label: { en: 'Duplicate / erroneous invoice', ar: 'فاتورة مكررة / خاطئة' },
    note: { en: 'Amanah exclusion lists cite invoices with errors; duplicate detection is in HLSD V0.4 scope. Formal approval authority unresolved.', ar: 'قوائم الاستبعاد من الأمانات تذكر فواتير بها أخطاء؛ كشف التكرار ضمن نطاق وثيقة التصميم. جهة الاعتماد الرسمية غير محسومة.' } },
  { id: 'CR-1', category: 'struck_off_registry', version: 1, priority: 2, defaultEnabled: true, locked: false, basis: 'stated_in_meeting', approval: 'approved', effectiveFrom: '2026-07-01', owner: { en: 'Revenue data steward', ar: 'أمين بيانات الإيرادات' },
    label: { en: 'Struck-off commercial registration', ar: 'سجل تجاري مشطوب' },
    note: { en: 'Meeting: all invoices of a struck-off registration are ready for exclusion without judgement. The raw CR status is kept as-is; only statuses listed in the rule parameter qualify, and only after human review.', ar: 'الاجتماع: جميع فواتير السجل التجاري المشطوب جاهزة للاستبعاد دون تقدير. تُحفظ حالة السجل الخام كما هي؛ والحالات المدرجة في معامل القاعدة فقط هي المؤهلة، وبعد المراجعة البشرية.' } },
  { id: 'DEC-1', category: 'deceased_debtor', version: 1, priority: 3, defaultEnabled: true, locked: false, basis: 'proposed', approval: 'unapproved', effectiveFrom: null, owner: { en: 'Not assigned', ar: 'غير محدد' },
    label: { en: 'Deceased debtor (evidence required)', ar: 'مدين متوفى (يتطلب دليلاً)' },
    note: { en: 'Proposed category; requires human review of evidence before it affects net billed.', ar: 'فئة مقترحة؛ تتطلب مراجعة بشرية للدليل قبل أن تؤثر على صافي المفوتر.' } },
  { id: 'NOC-1', category: 'no_contract', version: 1, priority: 4, defaultEnabled: true, locked: false, basis: 'proposed', approval: 'unapproved', effectiveFrom: null, owner: { en: 'Not assigned', ar: 'غير محدد' },
    label: { en: 'Investment invoice with no contract (confirmed by Furas)', ar: 'فاتورة استثمار بلا عقد (مؤكد من فرص)' },
    note: { en: 'Applies only when Furas confirms no contract exists. An UNMATCHED contract (not found) is never excluded — it stays in net billed and is flagged.', ar: 'تنطبق فقط عند تأكيد فرص عدم وجود عقد. العقد غير المطابق (لم يُعثر عليه) لا يُستبعد أبداً — يبقى في صافي المفوتر ويُعلَّم.' } },
  { id: 'INC-1', category: 'incomplete_data', version: 1, priority: 5, defaultEnabled: true, locked: false, basis: 'proposed', approval: 'unapproved', effectiveFrom: null, owner: { en: 'Not assigned', ar: 'غير محدد' },
    label: { en: 'Incomplete data (Efaa incomplete-violations report)', ar: 'بيانات غير مكتملة (تقرير إيفاء للمخالفات غير المكتملة)' },
    note: { en: 'Candidate rule from the Efaa incomplete report. Not confirmed by the business; configurable.', ar: 'قاعدة مرشحة من تقرير إيفاء غير المكتمل. غير مؤكدة من الجهة؛ قابلة للضبط.' } },
  { id: 'EXE-1', category: 'executed_against', version: 1, priority: 6, defaultEnabled: true, locked: false, basis: 'proposed', approval: 'unapproved', effectiveFrom: null, owner: { en: 'Not assigned', ar: 'غير محدد' },
    label: { en: 'Executed-against list (Efaa)', ar: 'قائمة المنفذ ضده (إيفاء)' },
    note: { en: 'Candidate rule. Being executed against does not mean the amount ended; treated as a configurable, unapproved exclusion.', ar: 'قاعدة مرشحة. كون المدين منفذاً ضده لا يعني انتهاء المبلغ؛ تُعامل كاستبعاد قابل للضبط وغير معتمد.' } },
  { id: 'EFA-1', category: 'outside_efaa', version: 1, priority: 7, defaultEnabled: true, locked: false, basis: 'proposed', approval: 'unapproved', effectiveFrom: null, owner: { en: 'Not assigned', ar: 'غير محدد' },
    label: { en: 'Violation not present in Efaa (system of record)', ar: 'مخالفة غير موجودة في إيفاء (النظام المرجعي)' },
    note: { en: 'Candidate rule. Tahseel and Efaa statuses are kept separate; a missing Efaa match is evidence for review, not proof.', ar: 'قاعدة مرشحة. تُحفظ حالتا تحصيل وإيفاء منفصلتين؛ غياب المطابقة في إيفاء دليل للمراجعة وليس إثباتاً.' } },
  { id: 'OBJ-1', category: 'objection', version: 1, priority: 8, defaultEnabled: false, locked: false, basis: 'unresolved', approval: 'unapproved', effectiveFrom: null, owner: { en: 'Not assigned', ar: 'غير محدد' },
    label: { en: 'Open objection / appeal', ar: 'اعتراض / استئناف مفتوح' },
    note: { en: 'Not confirmed in the latest meeting. Default OFF: an objection is a follow-up state, not an exclusion. Configurable.', ar: 'غير مؤكد في آخر اجتماع. الافتراضي: معطّل؛ الاعتراض حالة متابعة وليس استبعاداً. قابل للضبط.' } },
  { id: 'ENF-1', category: 'enforcement', version: 1, priority: 99, defaultEnabled: false, locked: true, basis: 'not_an_exclusion', approval: 'approved', effectiveFrom: '2026-07-01', owner: { en: 'Revenue data steward', ar: 'أمين بيانات الإيرادات' },
    label: { en: 'Referred to enforcement (reported as a separate dimension)', ar: 'محال إلى التنفيذ (يُعرض كبُعد منفصل)' },
    note: { en: 'Meeting correction: enforcement-referred invoices (often shown "cancelled" in the source) are counted UNCOLLECTED, not excluded. Locked off.', ar: 'تصحيح الاجتماع: الفواتير المحالة للتنفيذ (وتظهر غالباً "ملغاة" في المصدر) تُحتسب غير محصّلة وليست مستبعدة. مغلقة.' } }
];
export const EXCLUSION_CATEGORIES = EXCLUSION_RULES.map((r) => r.category);
export const ruleById = (id) => EXCLUSION_RULES.find((r) => r.id === id);

export const DEFAULT_CONFIG = {
  cutoff: DATA_CUTOFF,
  // Grace period treatment is UNRESOLVED in the supplied material. 0 = overdue the day after due date.
  graceDays: 0,
  // HEADLINE basis (EQ1, approved): 'periodEnd' = only payments up to the end of the selected period (a closed period is measured at its own end;
  // an open period at the data cutoff). 'cutoff' = every payment up to the data cutoff — shown ONLY as a separate, labelled figure on request.
  collectionsAsOf: 'periodEnd',
  // Which RAW commercial-registration statuses qualify under CR-1. The raw status is always kept as received;
  // "Suspended" is deliberately not listed (unresolved with the business).
  crStatuses: ['Deleted', 'Cancelled'],
  // 'total' = amounts as invoiced (VAT included where the source includes it). VAT is shown separately, never netted silently.
  amountBasis: 'total',
  rules: Object.fromEntries(EXCLUSION_RULES.map((r) => [r.id, r.defaultEnabled]))
};

export function normalizeConfig(cfg) {
  const c = { ...DEFAULT_CONFIG, ...(cfg || {}) };
  c.rules = { ...DEFAULT_CONFIG.rules, ...((cfg && cfg.rules) || {}) };
  // Locked rules cannot be switched on.
  for (const r of EXCLUSION_RULES) if (r.locked) c.rules[r.id] = r.defaultEnabled;
  return c;
}

/* ---------- Human review decisions (analytical layer only) ----------
   Decisions update this solution's own analytical state. They never write to a
   source system. A decision is keyed by invoice and (optionally) rule id; with no
   rule id it applies to the invoice's primary exclusion record. */
export function exclusionRecordsOf(rec) {
  if (rec.exclusions && rec.exclusions.length) return rec.exclusions;
  return rec.exclusion ? [rec.exclusion] : [];
}

export function applyReviewDecisions(ledger, decisions = {}) {
  if (!decisions || !Object.keys(decisions).length) return ledger;
  return ledger.map((r) => {
    const d = decisions[r.id];
    if (!d) return r;
    const list = exclusionRecordsOf(r);
    if (!list.length) return r;
    // new shape: { byRule: { [ruleId]: { exclusion, history } } }; legacy shape: { exclusion, history } → primary record
    const byRule = d.byRule || (d.exclusion ? { [d.ruleId || list[0].ruleId]: d } : null);
    if (!byRule) return r;
    const next = list.map((e) => {
      const x = byRule[e.ruleId] || (e === list[0] ? byRule._primary : null);
      return x && x.exclusion ? { ...e, ...x.exclusion, history: [...(e.history || []), ...(x.history || [])] } : e;
    });
    return { ...r, exclusions: next, exclusion: next[0] };
  });
}

/* ---------- Exclusion reasons: several per invoice, ONE primary, counted once ---------- */
export function exclusionReasons(rec, cfg) {
  const reasons = [];
  for (const ex of exclusionRecordsOf(rec)) {
    if (ex.reviewStatus !== 'approved') continue;
    const rule = ruleById(ex.ruleId);
    if (rule && !cfg.rules[rule.id]) continue;
    if (ex.effectiveTo && ex.effectiveTo < cfg.cutoff) continue;
    if (ex.ruleId === 'CR-1' && ex.rawValue && !(cfg.crStatuses || []).includes(ex.rawValue)) continue;
    reasons.push({ ...ex, priority: rule ? rule.priority : 50, approval: rule ? rule.approval : 'unapproved' });
  }
  // Rule-driven (virtual) reason only when the rule is explicitly enabled.
  if (cfg.rules['OBJ-1'] && rec.objection?.open && !reasons.some((r) => r.ruleId === 'OBJ-1')) {
    const rule = ruleById('OBJ-1');
    reasons.push({ category: 'objection', ruleId: 'OBJ-1', ruleVersion: 1, reviewStatus: 'rule_applied', priority: rule.priority, approval: rule.approval, evidence: { en: 'Open objection (rule OBJ-1 enabled).', ar: 'اعتراض مفتوح (القاعدة OBJ-1 مفعّلة).' } });
  }
  reasons.sort((a, b) => a.priority - b.priority);
  return reasons;
}

/* ---------- Per-record derivation ---------- */
export function effectiveExclusion(rec, cfg) {
  return exclusionReasons(rec, cfg)[0] || null;
}

export function paymentsUpTo(rec, asOf) {
  return rec.payments.filter((p) => p.date <= asOf);
}

// A source "cancelled" status counts as cancelled unless a confirmed enforcement link exists (rule ENF-1:
// enforcement-referred invoices are shown "cancelled" in the source but are still uncollected).
export function isCancelled(rec, asOf) {
  if (!rec.cancelled || rec.cancelled.date > asOf) return false;
  return !(rec.enforcementLinks || []).some((l) => l.status === 'confirmed');
}

export function deriveRecord(rec, cfg, periodEnd) {
  const asOf = cfg.collectionsAsOf === 'periodEnd' && periodEnd ? (periodEnd < cfg.cutoff ? periodEnd : cfg.cutoff) : cfg.cutoff;
  const adjustments = rec.adjustments.filter((a) => a.date <= asOf).reduce((s, a) => s + a.amount, 0);
  const billedAfterAdj = rec.grossAmount + adjustments;
  const reasons = exclusionReasons(rec, cfg);
  const exclusion = reasons[0] || null;
  const received = paymentsUpTo(rec, asOf).reduce((s, p) => s + p.amount, 0);
  const cancelled = isCancelled(rec, asOf);
  // Cancelled takes precedence over exclusion so the same amount is never deducted twice.
  const excluded = !cancelled && !!exclusion;
  const overlapsCancelled = cancelled && !!exclusion;
  const cancelledAmount = cancelled ? Math.max(0, billedAfterAdj - received) : 0;
  const collected = excluded ? 0 : Math.min(received, Math.max(billedAfterAdj - cancelledAmount, 0));
  const overpayment = excluded ? 0 : Math.max(0, received - Math.max(billedAfterAdj - cancelledAmount, 0));
  const outstanding = excluded || cancelled ? 0 : Math.max(0, billedAfterAdj - received);
  const daysOverdue = Math.max(0, daysBetween(addDays(rec.dueDate, cfg.graceDays), cfg.cutoff));
  return {
    rec, asOf, excluded, exclusion, reasons,
    cancelled, cancelledAmount, overlapsCancelled,
    overlapAmount: overlapsCancelled ? cancelledAmount : 0,
    gross: rec.grossAmount,
    adjustments,
    billedAfterAdj,
    exclusionAmount: excluded ? billedAfterAdj : 0,
    net: excluded ? 0 : billedAfterAdj - cancelledAmount,
    received,
    receiptsOnExcluded: excluded ? received : 0,
    collected,
    overpayment,
    outstanding,
    daysOverdue
  };
}

/* ---------- Noncollection classification ----------
   Mutually exclusive PRIMARY category per invoice, plus descriptive tags.
   Precedence is deliberate and documented; it is a classification of the
   invoice's CURRENT STATE from source facts, not a statement about why the
   payer has not paid. */
export const NONCOLLECTION_CATEGORIES = [
  'cancelled',
  'excluded',
  'objection',
  'linkage_unresolved',
  'ineligible_referral',
  'partial',
  'overdue',
  'not_due'
];

export const CATEGORY_LABELS = {
  cancelled: { en: 'Cancelled in the source (removed from the base)', ar: 'ملغاة في المصدر (خارج الأساس)' },
  excluded: { en: 'Excluded under a rule (review decision approved)', ar: 'مستبعدة وفق قاعدة (بقرار مراجعة معتمد)' },
  objection: { en: 'Under objection', ar: 'قيد الاعتراض' },
  enforcement: { en: 'Enforcement (a separate dimension — no longer a collection category)', ar: 'الإنفاذ (بُعد منفصل — لم يعد فئة تحصيل)' },
  linkage_unresolved: { en: 'Status or linkage unresolved', ar: 'حالة أو ربط غير محسوم' },
  ineligible_referral: { en: 'Ineligible for referral (incomplete data)', ar: 'غير مؤهلة للإحالة (بيانات ناقصة)' },
  partial: { en: 'Partially collected', ar: 'محصّلة جزئياً' },
  overdue: { en: 'Due and overdue', ar: 'مستحقة ومتأخرة' },
  not_due: { en: 'Not yet due', ar: 'لم يحن موعد استحقاقها' }
};

const REFERRAL_REQUIRED_FIELDS = ['debtor_id_number'];

export function classifyRecord(d, cfg) {
  const { rec } = d;
  const tags = [];
  if (d.cancelled) return { primary: 'cancelled', tags: d.overlapsCancelled ? ['also_excluded_reason'] : tags, collectible: null };
  if (d.excluded) return { primary: 'excluded', tags: d.reasons.length > 1 ? ['multi_reason'] : tags, collectible: null };
  if (d.outstanding <= 0) return { primary: 'collected', tags: d.overpayment > 0 ? ['overpaid'] : [], collectible: null };

  const isPartial = d.received > 0 && d.outstanding > 0;
  const isOverdue = d.daysOverdue > 0;
  if (isPartial) tags.push('partial');
  if (isOverdue) tags.push('overdue');
  if (rec.sourceStatus === 'cancelled') tags.push('source_cancelled');
  if (rec.cancelled && !d.cancelled) tags.push('cancelled_but_enforced');
  if (rec.contract.status === 'unmatched') tags.push('contract_unmatched');
  if (rec.statusRawTahseel && rec.statusRawEfaa && rec.statusRawEfaa !== rec.statusRawTahseel) tags.push('status_differs_efaa_tahseel');
  if (rec.amountCheck?.status === 'conflict') tags.push('amount_conflict');
  if (rec.contract.status === 'unlinked') tags.push('contract_unlinked');
  if (rec.missingFields.length) tags.push('missing_fields');

  const hasCandidateLink = rec.enforcementLinks.some((l) => l.status === 'candidate');
  if (hasCandidateLink) tags.push('enforcement_candidate');
  if (rec.contract.status === 'unverified') tags.push('contract_unverified');

  let primary;
  if (rec.objection?.open) primary = 'objection';
  // enforcement links never decide the category: it follows the financial / payment state (the enforcement dimension is reported apart)
  else if (
    rec.sourceStatus === 'cancelled' ||
    (rec.contract.required && ['unlinked', 'unmatched'].includes(rec.contract.status) && isOverdue)
  ) primary = 'linkage_unresolved';
  else if (isOverdue && rec.missingFields.some((f) => REFERRAL_REQUIRED_FIELDS.includes(f))) primary = 'ineligible_referral';
  else if (isPartial) primary = 'partial';
  else if (isOverdue) primary = 'overdue';
  else primary = 'not_due';
  return { primary, tags, collectible: null };
}

/* ---------- Scope ---------- */
export function normalizeScope(scope = {}, cfg = DEFAULT_CONFIG) {
  const to = scope.to || cfg.cutoff;
  const from = scope.from || '2026-01-01';
  return {
    from, to,
    amanah: scope.amanah ?? 'all',
    source: scope.source ?? 'all',
    scopeType: scope.scopeType ?? 'all',
    muni: scope.muni ?? 'all',
    status: scope.status ?? 'all',
    org: scope.org || null,
    ...(scope.basis ? { basis: scope.basis } : {})
  };
}

export function scopeLedger(ledger, scope = {}, cfg = DEFAULT_CONFIG) {
  const sc = normalizeScope(scope, cfg);
  let list = accessibleLedger(ledger, sc.org);
  if (sc.amanah !== 'all') {
    const set = new Set(Array.isArray(sc.amanah) ? sc.amanah : [sc.amanah]);
    list = list.filter((r) => set.has(r.amanahEn));
  }
  if (sc.source !== 'all') list = list.filter((r) => r.revenueSource === sc.source);
  return list;
}

export function scopeKey(scope = {}) {
  const sc = normalizeScope(scope);
  return `${sc.from}|${sc.to}|${Array.isArray(sc.amanah) ? sc.amanah.join(',') : sc.amanah}|${sc.source}|${sc.scopeType}|${sc.muni}|${sc.status}|${sc.org?.id || 'all'}`;
}

/* ---------- Aggregation over derived records ---------- */
function emptyAgg() {
  return {
    count: 0, gross: 0, adjustments: 0, exclusions: 0, net: 0, collected: 0, outstanding: 0, overpayment: 0, receiptsOnExcluded: 0, excludedCount: 0,
    cancelled: 0, cancelledCount: 0, overlapCount: 0, overlapAmount: 0, multiReasonCount: 0,
    exclusionsApproved: 0, exclusionsUnapproved: 0, overdueOutstanding: 0, notDueOutstanding: 0
  };
}

export function aggregate(derived) {
  const a = emptyAgg();
  for (const d of derived) {
    a.count += 1;
    a.gross += d.gross;
    a.adjustments += d.adjustments;
    a.exclusions += d.exclusionAmount;
    a.net += d.net;
    a.collected += d.collected;
    a.outstanding += d.outstanding;
    a.overpayment += d.overpayment;
    a.receiptsOnExcluded += d.receiptsOnExcluded;
    if (d.excluded) {
      a.excludedCount += 1;
      if (d.reasons.length > 1) a.multiReasonCount += 1;
      if (d.exclusion.approval === 'approved') a.exclusionsApproved += d.exclusionAmount; else a.exclusionsUnapproved += d.exclusionAmount;
    }
    if (d.cancelled) { a.cancelled += d.cancelledAmount; a.cancelledCount += 1; }
    if (d.overlapsCancelled) { a.overlapCount += 1; a.overlapAmount += d.overlapAmount; if (d.reasons.length > 1) a.multiReasonCount += 1; }
    if (d.outstanding > 0) { if (d.daysOverdue > 0) a.overdueOutstanding += d.outstanding; else a.notDueOutstanding += d.outstanding; }
  }
  a.billedAfterAdj = a.gross + a.adjustments;
  a.collectedOverNet = ratio(a.collected, a.net);
  a.collectedOverGross = ratio(a.collected, a.gross);
  a.exclusionKpiImpactPp = ppChange(a.collectedOverNet, a.collectedOverGross);
  return a;
}

function groupBy(derived, keyFn) {
  const m = new Map();
  for (const d of derived) {
    const k = keyFn(d);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(d);
  }
  return m;
}

/* ---------- Population A: receipts in period ---------- */
export function receiptsInPeriod(ledgerInScope, from, to, cfg) {
  const out = { total: 0, fromPeriodInvoices: 0, fromPriorInvoices: 0, onExcluded: 0, byChannel: {}, count: 0, payments: [] };
  for (const rec of ledgerInScope) {
    const excluded = !!effectiveExclusion(rec, cfg);
    for (const p of rec.payments) {
      if (p.date < from || p.date > to || p.date > cfg.cutoff) continue;
      out.count += 1;
      if (excluded) { out.onExcluded += p.amount; continue; }
      out.total += p.amount;
      out.byChannel[p.channel] = (out.byChannel[p.channel] || 0) + p.amount;
      if (rec.issueDate >= from && rec.issueDate <= to) out.fromPeriodInvoices += p.amount;
      else out.fromPriorInvoices += p.amount;
      out.payments.push({ invoiceId: rec.id, date: p.date, amount: p.amount, channel: p.channel });
    }
  }
  return out;
}

/* ---------- Data quality / completeness ---------- */
export function dataQualityOf(ledgerInScope, derived, cfg) {
  const conflicts = ledgerInScope.filter((r) => r.amountCheck?.status === 'conflict');
  const pendingExclusions = ledgerInScope.filter((r) => exclusionRecordsOf(r).some((e) => e.reviewStatus === 'pending'));
  const missing = ledgerInScope.filter((r) => r.missingFields.length);
  const contractIssues = ledgerInScope.filter((r) => r.contract.required && ['unlinked', 'unmatched'].includes(r.contract.status));
  const contractUnverified = ledgerInScope.filter((r) => r.contract.required && r.contract.status === 'unverified');
  const kinds = {};
  for (const r of ledgerInScope) kinds[r.provenance.kind] = (kinds[r.provenance.kind] || 0) + 1;
  const checkable = ledgerInScope.filter((r) => r.amountCheck?.status !== 'not_checkable').length;
  return {
    records: ledgerInScope.length,
    kinds,
    amountConflicts: conflicts.map((r) => r.id),
    amountCheckable: checkable,
    pendingExclusions: pendingExclusions.map((r) => r.id),
    missingFieldRecords: missing.map((r) => r.id),
    contractIssues: contractIssues.map((r) => r.id),
    contractUnverified: contractUnverified.map((r) => r.id),
    conflictAmountAtStake: conflicts.reduce((s, r) => s + r.grossAmount, 0),
    completenessNote: {
      en: `${checkable} of ${ledgerInScope.length} records have line-item evidence for an amount check; the rest could not be checked.`,
      ar: `${checkable} من ${ledgerInScope.length} سجلاً لديها بنود تفصيلية للتحقق من المبلغ؛ والباقي تعذّر فحصه.`
    }
  };
}

/* ---------- Net uncollected STOCK ----------
   Everything issued up to the cutoff that is still unpaid, after removing cancelled invoices and
   non-overlapping approved exclusions — regardless of the selected issue period. This is a different
   metric from "net billed" (a period FLOW); the two must never be conflated. */
export function computeStock(ledgerInScope, cfg) {
  const derived = ledgerInScope.filter((r) => r.issueDate <= cfg.cutoff).map((r) => deriveRecord(r, cfg, null));
  const a = aggregate(derived);
  const open = derived.filter((d) => d.outstanding > 0);
  const grouped = (keyFn, labelFn) => [...groupBy(derived, keyFn).entries()].map(([k, list]) => ({ key: k, label: labelFn(list[0]), ...aggregate(list) })).sort((x, y) => y.outstanding - x.outstanding);
  return {
    netUncollected: a.outstanding,
    overdue: a.overdueOutstanding,
    notYetDue: a.notDueOutstanding,
    invoiceCount: open.length,
    cancelled: a.cancelled,
    cancelledCount: a.cancelledCount,
    excluded: a.exclusions,
    excludedUnapproved: a.exclusionsUnapproved,
    excludedApproved: a.exclusionsApproved,
    excludedCount: a.excludedCount,
    overlapCount: a.overlapCount,
    overlapAmount: a.overlapAmount,
    gross: a.gross + a.adjustments,
    collected: a.collected,
    // everything issued up to the cutoff, regardless of the selected issue period — used by ageing and concentration views
    derived,
    byAmanah: grouped((d) => d.rec.amanahEn, (d) => ({ en: d.rec.amanahEn, ar: d.rec.amanahAr, zh: d.rec.amanah })),
    bySource: grouped((d) => d.rec.revenueSource, () => null)
  };
}

/* ---------- The snapshot ---------- */
export function computeSnapshot(ledger, scope = {}, cfgIn = {}, decisions = {}) {
  const cfg = normalizeConfig(cfgIn);
  const sc = normalizeScope(scope, cfg);
  const ledgerAll = applyReviewDecisions(ledger, decisions);
  const inScopeAll = scopeLedger(ledgerAll, sc, cfg);
  const issued = inScopeAll.filter((r) => r.issueDate >= sc.from && r.issueDate <= sc.to && r.issueDate <= cfg.cutoff);
  const derived = issued.map((r) => deriveRecord(r, cfg, sc.to));
  const totals = aggregate(derived);

  const exclusionsByCategory = {};
  for (const d of derived) {
    if (!d.excluded) continue;
    const c = d.exclusion.category;
    const e = exclusionsByCategory[c] || { count: 0, amount: 0, invoices: [] };
    e.count += 1; e.amount += d.exclusionAmount; e.invoices.push(d.rec.id);
    exclusionsByCategory[c] = e;
  }

  // Every reason an excluded invoice carries (an invoice is still counted once, under its primary reason).
  const exclusionReasonCounts = {};
  for (const d of derived) {
    if (!d.excluded && !d.overlapsCancelled) continue;
    for (const r of d.reasons) exclusionReasonCounts[r.ruleId] = (exclusionReasonCounts[r.ruleId] || 0) + 1;
  }
  const unapprovedRulesApplied = [...new Set(derived.filter((d) => d.excluded && d.exclusion.approval !== 'approved').map((d) => d.exclusion.ruleId))];

  const classified = derived.map((d) => ({ d, c: classifyRecord(d, cfg) }));
  const noncollection = {};
  for (const k of [...NONCOLLECTION_CATEGORIES]) noncollection[k] = { count: 0, amount: 0, invoices: [] };
  for (const { d, c } of classified) {
    if (c.primary === 'collected') continue;
    const bucket = noncollection[c.primary];
    bucket.count += 1;
    bucket.amount += c.primary === 'excluded' ? d.exclusionAmount : c.primary === 'cancelled' ? d.cancelledAmount : d.outstanding;
    bucket.invoices.push(d.rec.id);
  }

  const byAmanah = [...groupBy(derived, (d) => d.rec.amanahEn).entries()].map(([k, list]) => ({
    key: k, label: { en: list[0].rec.amanahEn, ar: list[0].rec.amanahAr, zh: list[0].rec.amanah }, ...aggregate(list)
  })).sort((a, b) => b.outstanding - a.outstanding || b.gross - a.gross);
  const bySource = [...groupBy(derived, (d) => d.rec.revenueSource).entries()].map(([k, list]) => ({
    key: k, ...aggregate(list)
  })).sort((a, b) => b.outstanding - a.outstanding || b.gross - a.gross);

  const received = receiptsInPeriod(inScopeAll, sc.from, sc.to, cfg);

  return {
    scope: sc,
    config: cfg,
    cutoff: cfg.cutoff,
    ruleSetVersion: EXCLUSION_RULE_SET_VERSION,
    population: { issuedInPeriod: derived.length, ledgerInScope: inScopeAll.length },
    totals,
    exclusionsByCategory,
    exclusionReasonCounts,
    unapprovedRulesApplied,
    exclusionsApproval: { allApproved: unapprovedRulesApplied.length === 0, unapprovedAmount: totals.exclusionsUnapproved, approvedAmount: totals.exclusionsApproved },
    stock: computeStock(inScopeAll, cfg),
    noncollection,
    byAmanah,
    bySource,
    receivedInPeriod: received,
    quality: dataQualityOf(issued, derived, cfg),
    derived,
    classified
  };
}

/* ---------- Period comparison ---------- */
const shiftYear = (d, n) => `${Number(d.slice(0, 4)) + n}${d.slice(4)}`;

// The comparison period. When the same calendar period of the previous year lies inside the data coverage it is
// preferred (homogeneous: same dates, same basis, same scope); otherwise the immediately preceding period of equal length.
export function previousScope(scope = {}) {
  const sc = normalizeScope(scope);
  const yoyFrom = shiftYear(sc.from, -1);
  const yoyTo = shiftYear(sc.to, -1);
  if (yoyFrom >= DATA_START) return { ...sc, from: yoyFrom, to: yoyTo, basis: 'same_period_last_year' };
  const len = daysBetween(sc.from, sc.to) + 1;
  const prevTo = addDays(sc.from, -1);
  const prevFrom = addDays(prevTo, -(len - 1));
  return { ...sc, from: prevFrom, to: prevTo, basis: 'previous_period' };
}

export function compareSnapshots(curr, prev) {
  const sameBasis = curr.config.cutoff === prev.config.cutoff && curr.ruleSetVersion === prev.ruleSetVersion;
  const covered = prev.scope.from >= DATA_START && prev.totals.count > 0;
  return {
    collectedOverNetPp: ppChange(curr.totals.collectedOverNet, prev.totals.collectedOverNet),
    collectedOverGrossPp: ppChange(curr.totals.collectedOverGross, prev.totals.collectedOverGross),
    grossChange: relChange(curr.totals.gross, prev.totals.gross),
    collectedChange: relChange(curr.totals.collected, prev.totals.collected),
    receivedChange: relChange(curr.receivedInPeriod.total, prev.receivedInPeriod.total),
    sameBasis,
    // A change is only presented when the previous period is fully inside the data coverage and non-empty.
    comparable: sameBasis && covered,
    basis: prev.scope.basis || 'previous_period',
    notComparableReason: !sameBasis ? 'definition_or_cutoff_differs' : !covered ? 'previous_period_outside_data_coverage' : null,
    // Callers pass snapshots measured at the end of their own period (see comparison.js), so the periods have the same age.
    maturityCaveat: true
  };
}

/* ---------- Monthly series ---------- */
export function monthsBetween(from, to) {
  const out = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const endY = Number(to.slice(0, 4));
  const endM = Number(to.slice(5, 7));
  while (y < endY || (y === endY && m <= endM)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

// Receipts per calendar month (Population A), restricted to the same scope rules.
export function monthlyReceipts(ledger, scope = {}, cfgIn = {}, decisions = {}) {
  const cfg = normalizeConfig(cfgIn);
  const sc = normalizeScope(scope, cfg);
  const inScope = scopeLedger(applyReviewDecisions(ledger, decisions), sc, cfg);
  const months = monthsBetween(sc.from, sc.to < cfg.cutoff ? sc.to : cfg.cutoff);
  const map = new Map(months.map((m) => [m, 0]));
  const payments = [];
  for (const rec of inScope) {
    if (effectiveExclusion(rec, cfg)) continue;
    for (const p of rec.payments) {
      if (p.date < sc.from || p.date > sc.to || p.date > cfg.cutoff) continue;
      map.set(monthOf(p.date), (map.get(monthOf(p.date)) || 0) + p.amount);
      payments.push({ ...p, invoiceId: rec.id });
    }
  }
  return { months, values: months.map((m) => map.get(m) || 0), payments };
}

// Gross billed per issue month (for period views).
export function monthlyBilled(ledger, scope = {}, cfgIn = {}, decisions = {}) {
  const cfg = normalizeConfig(cfgIn);
  const sc = normalizeScope(scope, cfg);
  const inScope = scopeLedger(applyReviewDecisions(ledger, decisions), sc, cfg);
  const months = monthsBetween(sc.from, sc.to < cfg.cutoff ? sc.to : cfg.cutoff);
  const map = new Map(months.map((m) => [m, 0]));
  for (const rec of inScope) {
    if (rec.issueDate < sc.from || rec.issueDate > sc.to) continue;
    map.set(monthOf(rec.issueDate), (map.get(monthOf(rec.issueDate)) || 0) + rec.grossAmount);
  }
  return { months, values: months.map((m) => map.get(m) || 0) };
}

/* ---------- Cumulative report guard ----------
   Monthly/annual reports often print CUMULATIVE year-to-date values. Never sum
   them for an annual total, and only difference them when definition, scope and
   restatement status match. */
export function monthlyFromCumulative(series) {
  // series: [{ month:'2026-01', value, scopeKey, definitionKey, restated:boolean }]
  const problems = [];
  const out = [];
  for (let i = 0; i < series.length; i += 1) {
    const cur = series[i];
    if (i === 0) { out.push({ month: cur.month, value: cur.value, derivedFrom: 'first_cumulative_point' }); continue; }
    const prev = series[i - 1];
    if (prev.scopeKey !== cur.scopeKey) problems.push({ month: cur.month, reason: 'scope_mismatch' });
    else if (prev.definitionKey !== cur.definitionKey) problems.push({ month: cur.month, reason: 'definition_mismatch' });
    else if (prev.restated || cur.restated) problems.push({ month: cur.month, reason: 'restatement' });
    else if (cur.value < prev.value) problems.push({ month: cur.month, reason: 'cumulative_decreased' });
    else out.push({ month: cur.month, value: cur.value - prev.value, derivedFrom: 'cumulative_difference' });
  }
  return { ok: problems.length === 0, values: out, problems };
}

/* ---------- Targets & coverage (separate metrics, separate denominators) ---------- */
export const TARGET_STATUS = { demo: 'demo', approved: 'approved', unresolved: 'unresolved' };

// Approved management target — an INPUT, never computed from data. These
// defaults are labelled illustrative; no approved target was supplied.
export const DEFAULT_TARGETS = {
  fiscalYear: Number(DATA_CUTOFF.slice(0, 4)),
  collectionRate: { value: 0.6, status: 'demo', provenance: { en: 'Illustrative demo input — no approved collection-rate target was supplied. Replace via configuration.', ar: 'مُدخل توضيحي — لم يُزوَّد بهدف معتمد لمعدل التحصيل. استبدله عبر الإعدادات.' }, version: 1 },
  collectionAmountAnnual: { value: 17000000000, status: 'demo', provenance: { en: 'Illustrative demo input (SAR) — scaled like the monthly reports; the approved annual collection target was not supplied.', ar: 'مُدخل توضيحي (ريال) — لم يُزوَّد بالهدف السنوي المعتمد للتحصيل.' }, version: 1 },
  // Monthly weights summing to 1: the meeting says the annual target is curved low early in the year and
  // rising toward year end; exact weights were not supplied, so this is a configurable demo shape.
  // curveMode 'equal' reproduces the pro-rata (annual ÷ 12) basis printed in the monthly revenue reports;
  // 'curved' follows the meeting's description. Which one is the approved basis is unresolved.
  monthlyCurve: { curveMode: 'curved', weights: [0.05, 0.06, 0.07, 0.08, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09, 0.10, 0.10], equalWeights: Array(12).fill(1 / 12), status: 'demo' },
  coverage: {
    status: 'demo',
    // Eligible ORIGINAL (start-of-year) budget for chapters 1-3 only. Chapter 4 and Vision-programme initiative
    // costs are excluded; no reinforcement, revised appropriation or actual spend is substituted.
    chapters: { ch1: 14900000000, ch2: 8800000000, ch3: 3300000000 },
    visionInitiativeDeduction: { value: 0, status: 'unresolved', note: { en: 'Amount of Vision-programme initiative costs sitting inside chapters 1-3 was not supplied; left at 0.', ar: 'لم يُزوَّد بمبلغ تكاليف مبادرات الرؤية داخل الأبواب 1-3؛ تُركت صفراً.' } },
    targetPct: { value: 0.66, status: 'demo', provenance: { en: 'Illustrative demo input (the transcript example mentions a 66% ask; the Implementation Card mentions 85% — neither is confirmed as the live target).', ar: 'مُدخل توضيحي (مثال الاجتماع يذكر 66% وبطاقة التنفيذ تذكر 85% — ولا أيٌّ منهما مؤكد كهدف حالي).' } },
    proration: 'equal_monthly',
    transferRules: { status: 'unresolved', note: { en: 'Inter-chapter transfer eligibility rules unresolved (MoF matter).', ar: 'قواعد المناقلة بين الأبواب غير محسومة (شأن وزارة المالية).' } }
  }
};

export function curveWeights(targets) {
  const c = targets.monthlyCurve;
  return c.curveMode === 'equal' ? c.equalWeights : c.weights;
}

export function cumulativeTargetToDate(targets, throughMonth) {
  const year = String(targets.fiscalYear);
  if (!throughMonth.startsWith(year)) return null;
  const m = Number(throughMonth.slice(5, 7));
  const w = curveWeights(targets).slice(0, m).reduce((s, x) => s + x, 0);
  return targets.collectionAmountAnnual.value * w;
}

export function monthlyTargetSeries(targets, months) {
  return months.map((mo) => {
    if (!mo.startsWith(String(targets.fiscalYear))) return null;
    const idx = Number(mo.slice(5, 7)) - 1;
    return targets.collectionAmountAnnual.value * curveWeights(targets)[idx];
  });
}

// Target achievement: cumulative receipts (Population A, fiscal year to date) vs cumulative approved target.
// `fyReceipts` is the monthly-receipts series ({ months, values }) for the fiscal year to date, supplied by the data service.
export function targetAchievementFrom(fyReceipts, scope, cfgIn, targets = DEFAULT_TARGETS) {
  const cfg = normalizeConfig(cfgIn);
  const sc = normalizeScope(scope, cfg);
  const through = sc.to < cfg.cutoff ? sc.to : cfg.cutoff;
  const ytd = fyReceipts.values.reduce((s, v) => s + v, 0);
  const tgt = cumulativeTargetToDate(targets, through.slice(0, 7));
  return {
    receiptsYtd: ytd,
    targetYtd: tgt,
    gap: tgt == null ? null : tgt - ytd,
    achievement: tgt == null ? ratio(NaN, 0) : ratio(ytd, tgt),
    annualTarget: targets.collectionAmountAnnual.value,
    through,
    status: targets.collectionAmountAnnual.status,
    // An annual national target cannot be compared with a narrowed scope without an approved allocation.
    scopeCaveat: sc.amanah !== 'all' || sc.source !== 'all' || !!sc.org?.amanahKeys,
    accessShare: null
  };
}
export function computeTargetAchievement(ledger, scope, cfgIn, targets = DEFAULT_TARGETS, decisions = {}) {
  const cfg = normalizeConfig(cfgIn);
  const sc = normalizeScope(scope, cfg);
  const through = sc.to < cfg.cutoff ? sc.to : cfg.cutoff;
  return targetAchievementFrom(monthlyReceipts(ledger, { ...sc, from: `${targets.fiscalYear}-01-01`, to: through }, cfg, decisions), scope, cfgIn, targets);
}

// Revenue coverage: receipts / eligible original budget prorated to elapsed months. Own numerator and denominator.
export function coverageFrom(fyReceipts, scope, cfgIn, targets = DEFAULT_TARGETS) {
  const cfg = normalizeConfig(cfgIn);
  const sc = normalizeScope(scope, cfg);
  const cov = targets.coverage;
  const through = sc.to < cfg.cutoff ? sc.to : cfg.cutoff;
  const elapsedMonths = through.startsWith(String(targets.fiscalYear)) ? Number(through.slice(5, 7)) : (through > `${targets.fiscalYear}-12-31` ? 12 : 0);
  const annualEligible = Object.values(cov.chapters).reduce((s, v) => s + v, 0) - (cov.visionInitiativeDeduction.value || 0);
  const proratedBudget = annualEligible * (elapsedMonths / 12);
  const receipts = fyReceipts.values.reduce((s, v) => s + v, 0);
  return {
    receiptsYtd: receipts,
    annualEligibleBudget: annualEligible,
    elapsedMonths,
    proratedBudget,
    coverage: ratio(receipts, proratedBudget),
    targetPct: cov.targetPct.value,
    targetStatus: cov.targetPct.status,
    // The denominator is the department's eligible ORIGINAL budget; the figures are demo inputs until an approved budget is loaded.
    denominatorStatus: cov.status || 'demo',
    scopeCaveat: sc.amanah !== 'all' || sc.source !== 'all' || !!sc.org?.amanahKeys,
    unresolved: ['vision_initiative_deduction', 'transfer_rules']
  };
}
export function computeCoverage(ledger, scope, cfgIn, targets = DEFAULT_TARGETS, decisions = {}) {
  const cfg = normalizeConfig(cfgIn);
  const sc = normalizeScope(scope, cfg);
  const through = sc.to < cfg.cutoff ? sc.to : cfg.cutoff;
  return coverageFrom(monthlyReceipts(ledger, { ...sc, from: `${targets.fiscalYear}-01-01`, to: through }, cfg, decisions), scope, cfgIn, targets);
}

/* ---------- Metric definitions shown in the UI ---------- */
export const METRIC_DEFINITIONS = {
  gross: {
    label: { en: 'Gross billed', ar: 'إجمالي المفوتر' },
    numerator: { en: 'Value of invoices before exclusions (approved adjustments included)', ar: 'قيمة الفواتير قبل الاستبعادات (تشمل التسويات المعتمدة)' },
    denominator: null,
    dateBasis: { en: 'Invoice issue date within the selected period', ar: 'تاريخ إصدار الفاتورة ضمن الفترة المحددة' },
    population: 'B',
    notes: { en: 'Uses the source header amount. Records whose amount conflicts with line items are flagged, not corrected.', ar: 'يستخدم مبلغ رأس الفاتورة من المصدر. تُعلَّم السجلات التي يتعارض مبلغها مع بنودها ولا تُصحَّح.' }
  },
  exclusions: {
    label: { en: 'Exclusions', ar: 'الاستبعادات' },
    numerator: { en: 'Cancelled invoices + invoices with an approved exclusion under an enabled rule — each deducted once', ar: 'الفواتير الملغاة + الفواتير ذات الاستبعاد المعتمد وفق قاعدة مفعّلة — كل فاتورة تُخصم مرة واحدة' },
    denominator: null,
    dateBasis: { en: 'Effective at the data cutoff', ar: 'سارية عند تاريخ قطع البيانات' },
    population: 'B',
    notes: { en: 'Exclusion changes the KPI denominator only. It does not mean the amount is uncollectible.', ar: 'الاستبعاد يغيّر مقام المؤشر فقط. ولا يعني أن المبلغ غير قابل للتحصيل.' }
  },
  net: {
    label: { en: 'Net billed', ar: 'صافي المفوتر' },
    numerator: { en: 'Gross billed − exclusions (deducted once)', ar: 'إجمالي المفوتر − الاستبعادات (تُخصم مرة واحدة)' },
    denominator: null,
    dateBasis: { en: 'Invoice issue date within the period', ar: 'تاريخ إصدار الفاتورة ضمن الفترة' },
    population: 'B',
    notes: { en: 'Ministry-described "adjusted invoice amount". Exclusion approval rules are unresolved.', ar: 'يُوصف بأنه "المبلغ المعدّل للفواتير". قواعد اعتماد الاستبعاد غير محسومة.' }
  },
  collected: {
    label: { en: 'Collected (attributed to period invoices)', ar: 'المحصّل (منسوب لفواتير الفترة)' },
    numerator: { en: 'Payments up to the as-of date on invoices issued in the period (non-excluded)', ar: 'المدفوعات حتى تاريخ القياس على فواتير صادرة في الفترة (غير مستبعدة)' },
    denominator: null,
    dateBasis: { en: 'Payment date ≤ data cutoff (or period end if configured)', ar: 'تاريخ الدفع ≤ تاريخ قطع البيانات (أو نهاية الفترة إن ضُبط)' },
    population: 'B',
    notes: { en: 'Partial payments count as received; adjustments reduce the billed base; overpayments are shown separately.', ar: 'تُحتسب الدفعات الجزئية كمقبوضة؛ والتسويات تخفض الأساس المفوتر؛ والمدفوعات الزائدة تُعرض منفصلة.' }
  },
  received: {
    label: { en: 'Received in period', ar: 'المقبوض خلال الفترة' },
    numerator: { en: 'All payments dated within the period, on invoices of ANY issue period', ar: 'جميع المدفوعات المؤرخة ضمن الفترة على فواتير من أي فترة إصدار' },
    denominator: null,
    dateBasis: { en: 'Payment date within the selected period', ar: 'تاريخ الدفع ضمن الفترة المحددة' },
    population: 'A',
    notes: { en: 'Different population from "Collected": includes receipts on earlier-period invoices. Never divided by period-issued net billed.', ar: 'مجتمع مختلف عن "المحصّل": يشمل المقبوضات على فواتير فترات سابقة. لا يُقسم أبداً على صافي مفوتر الفترة.' }
  },
  outstanding: {
    label: { en: 'Uncollected', ar: 'غير المحصّل' },
    numerator: { en: 'Net billed − collected, per invoice, floored at zero', ar: 'صافي المفوتر − المحصّل لكل فاتورة، بحد أدنى صفر' },
    denominator: null,
    dateBasis: { en: 'As of the data cutoff', ar: 'حتى تاريخ قطع البيانات' },
    population: 'B',
    notes: { en: 'Includes not-yet-due amounts; see the noncollection breakdown for status.', ar: 'يشمل المبالغ التي لم يحن استحقاقها؛ راجع تفصيل عدم التحصيل.' }
  },
  collectedOverNet: {
    label: { en: 'Collected ÷ net billed', ar: 'المحصّل ÷ صافي المفوتر' },
    numerator: { en: 'Collected', ar: 'المحصّل' },
    denominator: { en: 'Net billed (after approved exclusions)', ar: 'صافي المفوتر (بعد الاستبعادات المعتمدة)' },
    dateBasis: { en: 'Population B (invoices issued in the period)', ar: 'المجتمع B (فواتير صادرة في الفترة)' },
    population: 'B',
    notes: { en: 'Analytical view. The meeting describes the Ministry collection rate over net billed, but exclusion rules are unresolved, so this is not labelled "official".', ar: 'عرض تحليلي. وصف الاجتماع معدل تحصيل الوزارة على صافي المفوتر، لكن قواعد الاستبعاد غير محسومة، لذا لا يُوصف بأنه "رسمي".' }
  },
  collectedOverGross: {
    label: { en: 'Collected ÷ gross billed', ar: 'المحصّل ÷ إجمالي المفوتر' },
    numerator: { en: 'Collected (non-excluded invoices)', ar: 'المحصّل (فواتير غير مستبعدة)' },
    denominator: { en: 'Gross billed before exclusions', ar: 'إجمالي المفوتر قبل الاستبعادات' },
    dateBasis: { en: 'Population B', ar: 'المجتمع B' },
    population: 'B',
    notes: { en: 'Analytical view before any exclusion. Not labelled official.', ar: 'عرض تحليلي قبل أي استبعاد. لا يُوصف بأنه رسمي.' }
  },
  targetAchievement: {
    label: { en: 'Collection target achievement', ar: 'تحقيق مستهدف التحصيل' },
    numerator: { en: 'Receipts, fiscal year to date (Population A)', ar: 'المقبوضات منذ بداية السنة المالية (المجتمع A)' },
    denominator: { en: 'Cumulative approved monthly target (annual target × monthly curve)', ar: 'المستهدف الشهري التراكمي المعتمد (المستهدف السنوي × المنحنى الشهري)' },
    dateBasis: { en: 'Fiscal year to the data cutoff', ar: 'السنة المالية حتى تاريخ قطع البيانات' },
    population: 'A',
    notes: { en: 'Target is an input, never derived from data. Shown separately from coverage.', ar: 'المستهدف مُدخل وليس مشتقاً من البيانات. يُعرض منفصلاً عن التغطية.' }
  },
  coverage: {
    label: { en: 'Revenue coverage of chapters 1–3', ar: 'تغطية الإيرادات للأبواب 1–3' },
    numerator: { en: 'Receipts, fiscal year to date', ar: 'المقبوضات منذ بداية السنة المالية' },
    denominator: { en: 'Eligible ORIGINAL annual budget, chapters 1–3 only, prorated to elapsed months', ar: 'الميزانية الأصلية السنوية المؤهلة للأبواب 1–3 فقط، موزعة على الأشهر المنقضية' },
    dateBasis: { en: 'Fiscal year to the data cutoff', ar: 'السنة المالية حتى تاريخ قطع البيانات' },
    population: 'A',
    notes: { en: 'Excludes chapter 4 and Vision-programme initiative costs. No revised appropriation or actual spend is substituted. Eligibility and transfer rules remain unresolved.', ar: 'يستثني الباب الرابع وتكاليف مبادرات الرؤية. لا يُستبدل بالاعتماد المعدّل أو الصرف الفعلي. قواعد الأهلية والمناقلة غير محسومة.' }
  }
};
