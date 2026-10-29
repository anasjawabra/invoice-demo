/* ---------- Decision Room demo-only data ----------
   This file exists because three sections the Decision Room brief asks for
   — Expense Coverage, Investment Contracts/Opportunities, and a forward
   Payment Schedule — have NO backing data anywhere else in this app (no
   budget/expense file, no contract-schedule file; confirmed by a full-repo
   search before writing this). Rather than leave those sections as bare
   empty shells OR silently invent numbers that look real, everything below
   is explicitly isolated demo data, following the exact convention already
   established by REVENUE_BENCHMARK_SAMPLE / OPEX_BASELINE in mock.js:
   clearly commented as fictional, never touched by the page's real
   period/Amanah filters, and never summed into a real KPI. Every UI card
   sourced from this file must render the shared <DemoDataBadge/> so the
   distinction is visible on screen, not just in source comments.
   Update (CFO Planning Room): cfoModel.js's computeCFOModel DOES now net
   these figures (expense chapters, contract/vendor payments, a proposed
   investment) into expected outflows/net position — that live simulation
   is the entire point of the CFO Control Panel's assumption sliders. The
   isolation policy still holds everywhere it matters: every card sourced
   from this file keeps its <DemoDataBadge/>, nothing here is ever presented
   as if it were real, and the Financial Risk Engine's "commitment risk"
   and "investment risk" categories exist specifically to flag when this
   demo-sourced outflow pressure gets large relative to real inflows. */

export const isDemoData = true;

// Standard four government-budget expenditure chapters (Salaries, Operating,
// Maintenance, Capital/Projects) — illustrative amounts, SAR.
export const DEMO_EXPENSE_CHAPTERS = [
  { id: 'ch1', nameEn: 'Chapter 1 — Salaries & Wages', nameAr: 'الباب الأول — الرواتب والأجور', name: '第一章 — 薪资', budget: 42000000, actual: 29400000, committed: 3200000, forecast: 41800000 },
  { id: 'ch2', nameEn: 'Chapter 2 — Operating Expenses', nameAr: 'الباب الثاني — المصروفات التشغيلية', name: '第二章 — 运营支出', budget: 18500000, actual: 15200000, committed: 2100000, forecast: 19400000 },
  { id: 'ch3', nameEn: 'Chapter 3 — Maintenance', nameAr: 'الباب الثالث — الصيانة', name: '第三章 — 维护', budget: 9000000, actual: 4100000, committed: 1800000, forecast: 8300000 },
  { id: 'ch4', nameEn: 'Chapter 4 — Capital / Projects', nameAr: 'الباب الرابع — المشاريع الرأسمالية', name: '第四章 — 资本项目', budget: 26000000, actual: 11700000, committed: 9800000, forecast: 24500000 }
];

// Existing (confirmed) investment-contract commitments — distinct from
// "opportunities" below, per the brief's explicit "existing commitments vs
// potential/future opportunities" requirement.
export const DEMO_INVESTMENT_CONTRACTS = [
  { id: 'IC-3301', nameEn: 'Riyadh Waterfront Retail Lease', nameAr: 'عقد إيجار واجهة الرياض التجارية', name: '利雅得滨水零售租赁', value: 18000000, paid: 11500000, remaining: 6500000, nextPaymentDate: '2026-11-15', nextPaymentAmount: 1200000, status: 'active' },
  { id: 'IC-3302', nameEn: 'Jeddah Logistics Hub Concession', nameAr: 'امتياز مركز جدة اللوجستي', name: '吉达物流枢纽特许经营', value: 27000000, paid: 9000000, remaining: 18000000, nextPaymentDate: '2026-10-01', nextPaymentAmount: 3000000, status: 'active' }
];

export const DEMO_INVESTMENT_OPPORTUNITIES = [
  { id: 'IO-9001', nameEn: 'Eastern Province Solar Car-Park Lease', nameAr: 'عقد إيجار مواقف شمسية بالمنطقة الشرقية', name: '东部省太阳能停车场租赁', value: 6200000, expectedReturn: 0.11, expectedStartDate: '2027-02-01', status: 'proposed', priority: 'high' },
  { id: 'IO-9002', nameEn: 'Makkah Municipal Market Redevelopment', nameAr: 'إعادة تطوير السوق البلدي بمكة', name: '麦加市政市场重建', value: 14500000, expectedReturn: 0.08, expectedStartDate: '2027-06-01', status: 'under_review', priority: 'medium' }
];

// Forward payment obligations — combines the demo contract payments above
// with a couple of illustrative non-invoice commitments. Real overdue
// COLLECTIONS items are merged in by the page itself (not duplicated here)
// so the Payment Schedule section can clearly label which rows are real.
export const DEMO_PAYMENT_SCHEDULE = [
  { id: 'IC-3301', category: 'investment_contract', amount: 1200000, dueDate: '2026-11-15' },
  { id: 'IC-3302', category: 'investment_contract', amount: 3000000, dueDate: '2026-10-01' },
  { id: 'PS-4401', category: 'vendor_commitment', amount: 850000, dueDate: '2026-10-20' },
  { id: 'PS-4402', category: 'vendor_commitment', amount: 2400000, dueDate: '2026-12-05' }
];

/* ---------- Illustrative 2026 Baseline ----------
   A SEPARATE, explicitly-opt-in "Illustrative Data Mode" for the Planning
   Room — a user-supplied prototype baseline (SAR), NOT derived from this
   app's real invoice ledger, which totals in the tens of millions SAR, not
   tens of billions. Mixing the two would contradict every other page in
   this app (Dashboard/Invoice Library/Risk Radar all show the real, much
   smaller figures). So this baseline is isolated here, only ever surfaces
   behind the Planning Room's "Illustrative 2026 Baseline" toggle, and every
   card sourced from it renders <DemoDataBadge/>. Only these 5 figures are
   literal; everything else the Planning Room derives from them (health
   score, risks, investment capacity) is CALCULATED from these numbers by
   cfoModel.buildIllustrativeModel, reusing the same real-mode formulas. */
export const ILLUSTRATIVE_BASELINE_2026 = {
  fiscalYear: 2026,
  revenue: 16000e6, // Net Collected Revenue
  expenditure: 35000e6, // Total Expenditure
  get fundingGap() { return this.expenditure - this.revenue; }, // 19,000M
  get coveragePct() { return Math.round((this.revenue / this.expenditure) * 1000) / 10; }, // 45.7%
  get uncoveredPct() { return Math.round(((this.expenditure - this.revenue) / this.expenditure) * 1000) / 10; } // 54.3%
};
