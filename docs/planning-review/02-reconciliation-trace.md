# 02 — Reconciliation trace: every screenshot number to its basis

Method: the page's own functions (`planTargets.js`, `collectionGoal.js`, `planForecast.js`, `planInputs.js`) were run **unchanged** on the synthetic compact world (`server/store.js` `loadStore('2026-11-06')`, `server/engine.js` `snapshot`/`series`) — `scratch/p1/probe1.mjs … probe5.mjs`. The user's screenshots are tagged **[I]**; the reproduction is **[V]**. Figures in SAR millions.

## 0. Result in one table
| Screenshot figure | Reproduced by | Basis | Verdict |
|---|---|---|---|
| target **21.59 bn** (target section) | overall coverage **66 %** (default) × 32,705 = **21,585.3** | planning store, default | **changed target input (66 % default)** |
| target **22.89 bn** (forecast + map sections) | overall coverage **70 %** × 32,705 = **22,893.5** | planning store, saved edit | **changed target input (70 %)** — the screenshots were taken in two states |
| 9.21 bn collected | Σ payments dated 1 Jan–6 Nov, any invoice, approved rules, main classes = **9,210.04** | payment-date receipts | correct, but a different population from the 8.72 bn KPI (bridge §2) |
| 19.46 bn planned to date | 22,893.5 × 0.85 = **19,459.48** | even 1/12 split, day-prorated | **assumption not disclosed** (defect D5) |
| −10.25 bn / −52.7 % | 9,210.04 − 19,459.48 = **−10,249.43**; ÷ 19,459.48 = **−52.67 %** | arithmetic OK | correct arithmetic; basis is an assumed plan |
| 10.95 bn estimate | 9,084.10 (Jan–Oct) + 932.00 + 932.00 = **10,948.10** | last-3-month run-rate | consistent; vs **9.96 bn** elsewhere → §5 |
| «احتمالية … 1 %» | z = 43.7 → tail ≈ 0 → clamp floor | normal tail, 3 points | **defect D1: not a probability** |
| 19.74 bn «maximum possible» | 9,210.04 + 8,322.67 + 2 × 1,103.66 = **19,740.0** | collected + all-time stock + 2 months of net billing | **misleading / defect D7** |
| 932 M vs 6.84 bn per month | avg(Aug, Sep, Oct) = **932.00**; (22,893.5 − 9,210.04) ÷ 2 = **6,841.7** | monthly, whole-month divisor | **defect D2** (day-based: 7,601.9) |
| map: Ministry 40.2 %, Housing 35.4 % | 9,210.04 ÷ 22,893.5 = 40.2 %; 789.16 ÷ 2,230.60 = 35.4 % (70 %) | annual achievement bands | consistent with the 22.89 state; time-agnostic bands (D-map) |

Same probe at 66 % reproduces the SH-review captures (−9.14 bn / −49.8 % / 18.35 bn planned / 6.19 bn per month / 19.74 bn) — so the two screenshot sets differ **only** by the overall coverage input [V].

## 1. 21.59 bn vs 22.89 bn — which target? (§2, §3)
| Candidate explanation | Test | Result |
|---|---|---|
| annual revenue target vs budget-derived | `target = coverage × budget`; the only target of the page | same quantity |
| **per-Amanah sum vs overall** | Σ entity targets = overall coverage × total budget (override off); at 66 % Σ = 21,585.3 (rows listed in probe2) | sums reconcile: the Ministry **is** the sum of rows (`planTargets.js:40`) |
| different scope | both sections use `selected = total` (`PlanningArea.jsx:51-53`); the target section uses `sum = total` for «الوزارة» (`TargetsPanel.jsx:41`) | **cannot differ inside one render** |
| different version / scenario | none exist | n/a |
| stale state | localStorage store changed between captures: coverage 66 % → 70 % reproduces **every** other number of the screenshot to the SAR (22,893.5; 19,459.48; −10,249.43; 40.2 %; 35.4 %; 6,841.7) | **yes: the two captures are two states** |
| defect | no code path renders two targets on `/planning` | none found |
**Verdict: changed target (overall coverage 66 → 70 %), captured at different times.** [V] reproduction; [I] that the user's target-section capture predates the edit. The live page could not be re-opened to prove it visually (auth in flux); the code proof is `PlanningArea.jsx:50-53`, `TargetsPanel.jsx:41,59`.
**What must change in the basis (not labels):** the page must show **which target is in force** next to every number that uses it — target value, version, status (illustrative / approved), who/when last edited, scenario — and a changed target must be visible where the forecast is shown. Today the store has `savedAt/savedBy` only (`planTargets.js:30`) and the forecast block shows no target provenance. Also remove the third and fourth targets (11,495 M appropriation on the dashboard and in Smart Reports): see §9.

## 2. 9.21 bn actual vs the 8.72 bn «collected» — exact bridge (§3)
```
Receipts, payment date 1 Jan–6 Nov 2026, any invoice (series total = snapshot.receivedInPeriod.total)     9,210,040,076
 − payments on invoices issued before 2026 (fromPriorInvoices)                                              −494,196,579
 = payments on invoices issued 1 Jan–6 Nov 2026 (fromPeriodInvoices)                                        8,715,843,497
 − overpayment above the billed amount (totals.overpayment; collected is capped at net billed)                   −50,000
 = «المحصّل» on period invoices (snapshot.totals.collected, the dashboard KPI)                              8,715,793,497   (= 8.72 bn)
and  net billed 12,605.33 = collected 8,715.79 + uncollected 3,889.54;  gross 15,818.77 − exclusions 3,213.44 = net 12,605.33
```
[V probe2; `engine.js:359-372,492`]. **Basis:** by payment date (not issue date), to the cut-off 2026-11-06 inclusive, approved rules only, «أخرى» main class outside (`engine.js:297-301`): a raw payment scan finds 9,563 M, i.e. **353 M** more — **[I]** cause = the «أخرى» class (VAT/refund-type invoices); not isolated. Verdict: **correct and consistent; different populations must be named** (the page says «بتاريخ الدفع» but not «including payments on 2025 invoices»). Basis change: add the one-line bridge (period-invoice collected vs all receipts) in the evidence details; cumulative actual must be labelled «المحصّل (تاريخ الدفع، كل الفواتير)».

## 3. 19.46 bn planned to date (§4)
`plannedToDate = cum[Oct] + (cum[Nov] − cum[Oct]) × 6/30`, `cum[k] = target × k/12` because every month weight is `1/12` unless a person edited the monthly split (`planTargets.js:10,104`): 22,893.5 × (10/12 + 1/12 × 0.2) = **19,459.48** (66 %: 18,347.51). No seasonality, no approved plan: `collectionGoal.js:10-13` says «no approved monthly plan exists, so each is stated on screen» but nothing on `/planning` says it (`g.plan.source` unread). The dashboard (appropriation basis) uses the same even rule; Smart Reports uses a **curved** profile (`DEFAULT_TARGETS.monthlyCurve`, `revenueMetrics.js:654-656`: Jan 5 % … Nov 10 %, cumulative to 6 Nov ≈ 82 %). **Verdict: inconsistent date profile + undisclosed assumption (defect D5).** Basis change: a `planProfile` object (source: `assumed_even` | `approved_monthly` | `prior_year_seasonal`; version; owner) feeding all three consumers; the UI prints «افتراض: توزيع متساوٍ على 12 شهرًا — لا خطة شهرية معتمدة» until an approved plan exists.

## 4. −10.25 bn / −52.7 % arithmetic check (§4)
`deviation = actual − planned = 9,210.04 − 19,459.48 = −10,249.43` ✓; `% = deviation ÷ planned = −52.67 %` ✓ (the spec's formula; `planForecast.js:45`). Annual achievement is a different number (9,210.04 ÷ 22,893.5 = 40.2 %); the page shows both on different tiles without saying which answers «are we on track?». Deviation % = 52.7 % **below plan** but achievement = 40.2 % **of the year's target** while 85 % of the year has elapsed — consistent only because the plan is even. **Verdict: arithmetic correct; interpretation depends on the undisclosed even plan.**
Cut-off sensitivity [V probe3]: the same page logic at 15 Feb gives −51.6 %, at 30 Jun −52.9 %, at 6 Nov −49.8 % (66 %) — i.e. the Ministry runs at ≈ 48–51 % of an even plan all year: the gap is a **level mismatch between the illustrative target and the synthetic world's scale**, not a deterioration (the target is 2.48× the whole of 2025's receipts of 9,238 M).

## 5. 10.95 bn (run-rate) vs 9.96 bn (trend) for the same scope
| | Run-rate (`/planning`) | OLS trend (Smart Reports, assistant, fixed reports) |
|---|---|---|
| code | `planForecast.js:24-36` | `revenueOutlook.js:97-142` `forecastCore` (`ols_trend_v1`) |
| window | last 3 closed months (Aug–Oct) | trailing 12 **months including the partial 1–6 Nov** (hist = Dec-25 … Nov-26; last point 125.94) |
| horizon | rest of year = Nov (≥ avg) + Dec | **starts the month after the cut-off month**: Dec only (`revenueOutlook.js:108`) — 7–30 Nov never forecast |
| year-end | 10,948.10 | 9,210.04 + 748.10 (Dec) = **9,958.14**, «band» 9,542–10,374 (±1.28 SD, flagged «not a validated confidence interval») |
| target used | planning store 21.6/22.9 bn | `DEFAULT_TARGETS` **11,495 M** (`demo`) → «target above indicative range», gap 1,536.9 |
Like-for-like check [V python on probe values]: OLS fitted on the **11 complete months only**, forecasting Nov and Dec: Nov 1,029 + Dec 1,049 → year-end **11,162.5**; the run-rate on the same basis is 10,948.1. So the 1.0 bn gap between 10.95 and 9.96 is **mostly two defects** (partial month used as a full data point → negative slope −14.8 M/month instead of +20.0; rest of November omitted), **not a method difference** (±0.2 bn). **Verdict: different forecast method AND defect; different target basis.** Basis change: one forecast engine per scope that (a) fits only complete periods, (b) covers the remaining days of the current month explicitly, (c) is named and versioned (`method_id`, window) on every surface, (d) takes the target from the same store as the planning page. Alignment with the forecasting teams is pending (`docs/sh-review/00`).

## 6. 19.74 bn «maximum possible» — what it sums
| Component | Amount | Nature |
|---|---|---|
| collected to date | 9,210.04 | receipts (payment date) |
| `standing` = `stock.netUncollected` | **8,322.67** | **all issue years**: 2024 664.73 · 2025 3,768.40 · 2026 3,889.54; overdue 7,743.04, not yet due 579.63, **older than 180 days 6,184.49** (92 invoices; probe5) |
| `avgBilling × monthsLeft` | 1,103.66 × 2 = 2,207.3 | mean **net billed** by issue month Aug–Oct; whole months (Nov 1–6 already inside the stock, and 6/30 of Nov has elapsed) |
| **sum** | **19,740.0** | `planForecast.js:47-48` |
Why it is not a maximum collectible: (i) it assumes **100 % recovery** of every open balance, including 6.18 bn older than 180 days; in the synthetic generator **nothing aged over 90 days was ever recovered** in the following 4–5 months [S probe5: recovery after origin 30 Jun / 12 Sep: not due 61 % / 43 %, 1–30 d 41 % / 58 %, 31–90 d 28 % / 30 %, > 90 d 0 %]; (ii) future billing is assumed to be **billed and collected inside the same year** although receipts lag the invoice (only 51 % of 2026 receipts arrive on/before due date; 49 % later [V probe5]); (iii) two whole months are added although 1.8 remain, and Nov 1–6 billing (78 M) is both in the stock and in the future-billing average; (iv) exclusions, objections, enforcement and scope are not applied (objection and open enforcement are 0 in this world, so they do not show). Over-statement from (iii) alone ≈ 0.2 × 1,104 + 78 ≈ 0.3 bn. **Verdict: misleading wording and arithmetic (defect D7).** Basis change: replace with a labelled **«رصيد قائم يمكن العمل عليه»** composed by aging class (not a ceiling), and say future billing is outside the collectible stock; no «maximum».

## 7. 932 M vs 6.84 bn — units and period handling
* 932.00 M = mean of **complete** months Aug 757.43, Sep 898.92, Oct 1,139.66 — monthly, complete periods ✓ (`planForecast.js:29`).
* 6,841.7 M = (target − collected) ÷ `max(monthsLeft,1)` with `monthsLeft = 12 − closed = 2` (`planForecast.js:36,52-55`). Real remaining time: 7 Nov–31 Dec = 55 days = **1.80 months** → (22,893.5 − 9,210.04) ÷ 1.8 = **7,601.9** M/month (`collectionGoal.js:37-41,76` already computes it as `g.pace.requiredPerMonth` and the UI ignores it). The page understates the requirement by **10 %** on 6 Nov, by **2×** on 15 Dec (11.6 vs 22.5 bn/month), and after 31 Dec still prints «المطلوب (10.9 مليار شهريًا)» with 0 months left [V probe3] (§4 of the request forbids «remaining monthly requirement after the period ended»).
* Comparison: the required pace is 7.3× the recent pace and **6.3× the best of 22 complete months** (1,204 M, Jul 2026); at 66 %: 6.6× / 5.7×.
* The 932 M compares a **cash average** with a requirement that includes the same-month partial collection already in `collected` — consistent in amount (the requirement uses `target − collected`), inconsistent in period (whole vs remaining).
**Verdict: defect D2.** Basis change: `requiredPerMonth = remaining ÷ remainingMonths(by days)`, daily pace shown, «no requirement» once the year ended, recent pace from complete periods only (already so).

## 8. Map bands — basis (§9)
Colour = collected ÷ **annual** target of the region (`EntityMap.jsx:20,36`); tiers fixed at 40/60/80 %. At 85 % of the year elapsed a region at 79 % is «yellow» although it may be on plan, and in February every region is red. Per-entity position vs the even plan to 6 Nov [V probe2, 70 %]: Eastern 62 % of plan (annual 53.0 %, orange), Jeddah 55 % (46.4 %), Asir 24 % (20.4 %), Najran 24 % (20.6 %) — with an even plan the two rankings coincide, but only because the plan is even; they would diverge under a seasonal plan. Largest monetary deviations: Jeddah −1,907, Riyadh −1,886, Housing −1,107, Makkah −1,090, Asir −1,074 — the **largest gaps are the large entities**, which a percentage map hides (Asir is the reddest region but 4th–5th in money). **Verdict: different measure than the question asked («ahead/behind the expected position at the reporting date»).** Basis change: map (if kept) colours **position vs planned-to-date** (collected ÷ planned) with a diverging, text-labelled scale, and the primary comparison is a sorted deviation chart (06).

## 9. Targets that exist in the code (and which page uses which)
| # | Target | Value | Used by |
|---|---|---|---|
| 1 | planning overall coverage × total budget (66 %) | 21,585.3 | `/planning`, Decision Room |
| 2 | same, edited (70 %) | 22,893.5 | `/planning` after an edit |
| 3 | revenue appropriation after adjustment `revAdjusted` | 11,495 | dashboard attainment (`revenueAnalysis.js:78`), `DEFAULT_TARGETS`, Smart Reports, assistant, fixed reports |
| 4 | restricted-user variant of #1 | e.g. Riyadh 3,306.6 instead of 4,037.3 | `/planning` for a restricted organisation (D6) |
The first-draft rule (`docs/strategic-dashboard-simplification.md` §round 20) made the appropriation the target; IIM-28 (21 Oct) replaced it by coverage × budget **only on `/planning`**, leaving 11,495 M elsewhere. **Verdict: stale basis / inconsistent targets across pages.** Basis change: one `getPlanningBasis({year, scope})` returning target, version, status, profile, used by every surface; the dashboard and Smart Reports either read it or state that they show a different measure (appropriation attainment) under a different name.

## 10. Restricted user (D6) [V probe3]
`entityTargets(store, year, visibleItems)` computes `baseTarget = coverage × Σ(visible budget) × (rev ÷ Σ visible revenue appropriation)` (`planTargets.js:91-96`) — a function of the **visible set**. Riyadh-only viewer: 66 % × 5,010 = **3,306.6**; Ministry viewer: **4,037.3** for the same entity. Riyadh + Jeddah viewer: Σ 6,765 vs 8,694. The label stays «الوزارة (كل الجهات)» / «إجمالي الوزارة» (`PlanningArea.jsx:62,63`, `TargetsPanel.jsx:53,130`) although the total is the user's own entities (SH review observation, confirmed). **Verdict: defect.** Basis change: compute targets once for the full entity set (visibility filters rows, never the arithmetic); label the restricted total «إجمالي الجهات المتاحة لك».
