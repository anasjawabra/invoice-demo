// ============================================================================
// SYNTHETIC budget / commitment / accrual / payment data — a small deterministic set (4 chapters × months of the current year) that exists
// ONLY so planning and budget-execution views can be demonstrated. It is NOT actual Ministry data, it is national-level only, and every
// screen and export labels it «تجريبية اصطناعية». Real figures need the government financial-system integration (see the readiness study).
//
// Four different things are kept apart (as in public financial management):
//   approved budget  — the annual appropriation of the chapter (prorated by month for comparison)
//   commitments      — obligations contracted (≥ accrued)
//   accrued          — expenditure incurred for goods/services received (≥ paid)
//   payments         — cash actually paid
// No actual (committed / accrued / paid) amount is generated for a month after today; the current month is prorated by elapsed days.
// ============================================================================
export const FINANCE_STATUS = { ar: 'تجريبية اصطناعية — ليست بيانات إنفاق فعلية للوزارة', en: 'Synthetic demo data — not actual Ministry expenditure' };
export const CHAPTERS = [
  { key: 'ch1', ar: 'الباب 1', en: 'Chapter 1', annual: 12.0e9, weights: Array(12).fill(1 / 12), exec: [0.985, 1.0] },
  { key: 'ch2', ar: 'الباب 2', en: 'Chapter 2', annual: 6.0e9, weights: [0.06, 0.07, 0.08, 0.08, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09, 0.08], exec: [0.82, 1.04] },
  { key: 'ch3', ar: 'الباب 3', en: 'Chapter 3', annual: 2.4e9, weights: Array(12).fill(1 / 12), exec: [0.8, 0.98] },
  { key: 'ch4', ar: 'الباب 4 (مشاريع)', en: 'Chapter 4 (projects)', annual: 4.0e9, weights: [0.03, 0.04, 0.05, 0.06, 0.08, 0.09, 0.1, 0.11, 0.11, 0.12, 0.11, 0.1], exec: [0.45, 0.9] }
];
export const OPERATING_CHAPTERS = ['ch1', 'ch2', 'ch3']; // chapters 1–3, as in the monthly reports' coverage page

function rng(seed) { let t = seed >>> 0; return () => { t = (t + 0x6d2b79f5) >>> 0; let x = Math.imul(t ^ (t >>> 15), t | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export function generateFinance(today) {
  const y = Number(today.slice(0, 4)); const curM = Number(today.slice(5, 7)); const curD = Number(today.slice(8, 10));
  const chapters = CHAPTERS.map((c) => {
    const months = []; let cumC = 0; let cumA = 0; let cumP = 0; let cumB = 0;
    for (let m = 1; m <= curM; m += 1) {
      const frac = m === curM ? curD / daysIn(y, m) : 1; // the current month is only partly elapsed
      const r = rng(hash(`${y}|${c.key}|${m}`)); const planned = c.annual * c.weights[m - 1];
      const ex = c.exec[0] + (c.exec[1] - c.exec[0]) * r();
      const paid = planned * ex * frac; const accrued = paid / (0.93 + 0.05 * r()); const commit = accrued * (1.06 + 0.28 * r()) + (c.key === 'ch4' ? planned * 0.2 * r() : 0);
      cumB += planned * frac; cumP += paid; cumA += accrued; cumC += commit;
      months.push({ month: `${y}-${String(m).padStart(2, '0')}`, planned: planned * frac, paid, accrued, commit, cumBudget: cumB, cumPaid: cumP, cumAccrued: cumA, cumCommit: cumC });
    }
    return { ...c, months };
  });
  return { status: 'synthetic', label: FINANCE_STATUS, year: y, asOf: today, basis: { ar: 'مستوى وطني؛ الميزانية المعتمدة الاصطناعية مقابل الالتزام والاستحقاق والصرف؛ الصرف نقدي', en: 'National level; synthetic approved budget vs commitment, accrual and cash payment' }, chapters };
}

// execution per chapter and in total, through the last generated month
export function budgetExecution(fin) {
  const rows = fin.chapters.map((c) => { const l = c.months[c.months.length - 1]; return { key: c.key, label: { ar: c.ar, en: c.en }, annual: c.annual, budgetToDate: l.cumBudget, commitments: l.cumCommit, accrued: l.cumAccrued, paid: l.cumPaid, execution: l.cumBudget > 0 ? l.cumPaid / l.cumBudget : null, commitShareOfAnnual: c.annual > 0 ? l.cumCommit / c.annual : null, remaining: Math.max(0, c.annual - l.cumCommit) }; });
  const sum = (k, ks = null) => rows.filter((r) => !ks || ks.includes(r.key)).reduce((t, r) => t + r[k], 0);
  const total = { annual: sum('annual'), budgetToDate: sum('budgetToDate'), commitments: sum('commitments'), accrued: sum('accrued'), paid: sum('paid') };
  total.execution = total.budgetToDate > 0 ? total.paid / total.budgetToDate : null;
  const op = { annual: sum('annual', OPERATING_CHAPTERS), budgetToDate: sum('budgetToDate', OPERATING_CHAPTERS), paid: sum('paid', OPERATING_CHAPTERS), accrued: sum('accrued', OPERATING_CHAPTERS) };
  return { rows, total, operating: op };
}

// Only a national, all-source, unfiltered view is compatible with this national, all-revenue-source expenditure set.
export function financeCompatible(scope, org = null) {
  return scope.amanah === 'all' && scope.source === 'all' && (scope.muni || 'all') === 'all' && (scope.scopeType || 'all') === 'all' && (scope.status || 'all') === 'all' && !org?.amanahKeys;
}
// operating-expenditure coverage: cash receipts of the fiscal year to date ÷ cash payments of chapters 1–3 over the SAME period (cash basis on both sides)
export function operatingCoverage(fin, receiptsYtd) {
  const ex = budgetExecution(fin); const paid = ex.operating.paid;
  return { receiptsYtd, paid, ratio: receiptsYtd != null && paid > 0 ? receiptsYtd / paid : null, basis: { ar: 'نقدي على الطرفين: مقبوضات الإيرادات بتاريخ الدفع ÷ صرف الأبواب 1–3 للفترة نفسها (من بداية السنة حتى اليوم)، وطني', en: 'Cash on both sides: revenue receipts by payment date ÷ payments of chapters 1–3 over the same period (year to date), national' } };
}

// the monthly PLAN (approved synthetic budget) for all twelve months — a plan, not an actual, so future months are allowed here
export function plannedByMonth(year) {
  return Array.from({ length: 12 }, (_, i) => ({ month: `${year}-${String(i + 1).padStart(2, '0')}`, planned: CHAPTERS.reduce((t, c) => t + c.annual * c.weights[i], 0) }));
}
