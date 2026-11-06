# /planning — study and implementation plan (P1, 6 Nov 2026)

**Status: Implemented 7 Nov 2026 — see `11-implementation-status.md`.** (The study below is the baseline it was built from; the numbers in files 01–03 describe the page BEFORE the implementation. Read-only probes lived in `scratch/p1/`.)

Scope of the study: the revenue-planning page `/planning` («تخطيط إيرادات التحصيل»), FY 2026, synthetic compact world, demo cut-off **2026-11-06**. Specification: `scratch/_planning-request.md` (§1–§12).

## Legend (every statement carries one)
| Tag | Meaning |
|---|---|
| **[V]** VERIFIED | read in code or computed by a read-only probe on the synthetic compact world — with `path:line` or the probe named |
| **[I]** INFERRED | from screenshots only (the user's screenshots and `docs/sh-review/screenshots/20b…25`); the live page could not be opened (data service answered `unauthenticated` during the access-control work, so no new screenshots were taken) |
| **[R]** RECOMMENDATION | what the plan proposes |
| **[S]** SIMULATION | a number computed on the synthetic generator; it says nothing about real accuracy or real behaviour |

All figures are synthetic/illustrative (the budget table says so: `src/data/appropriations.js:1`). Amounts below are SAR millions unless written «bn». Probes: `scratch/p1/probe1…6.mjs` (re-runnable: `npx esbuild scratch/p1/probeN.mjs --bundle --platform=node --format=esm --external:xlsx --external:docx --external:pptxgenjs --outfile=.test-build/_p1_probeN.mjs && node .test-build/_p1_probeN.mjs`).

## Files
| File | Content |
|---|---|
| `01-current-state-findings.md` | the page section by section, what each number is, which function computes it; **how exactly the «1 %» is produced** |
| `02-reconciliation-trace.md` | every screenshot number traced to its basis, with verdicts (changed target / scope / stale / dates / method / defect) |
| `03-gap-matrix.md` | every requested capability × the five classes |
| `04-metric-specification.md` | formulas, units, date basis, source fields, zero/missing behaviour, owner function, status text, tolerance proposal |
| `05-probability-assessment.md` | data sufficiency, backtest feasibility, the decision, and the method that would be defensible later |
| `06-page-layout-and-charts.md` | proposed hierarchy vs the existing page, chart decisions, map decision, wireframes, states |
| `07-priorities-and-drivers.md` | «أين نركز» and «مبررات…» review, ranking logic, gap decomposition (proved/disproved with numbers) |
| `08-implementation-plan.md` | phases tied to files/functions, tests, exports, migration, acceptance |
| `09-validation-and-demo-scenarios.md` | §12 as testable identities, edge cases, demo script |
| `12-revenue-plans-analysis.md`, `13-revised-proposal.md` | analysis and proposal for «خطط الإيرادات» — **partly superseded by spec §10** (`docs/revenue-plans-spec.md`) |
| `14-revenue-plans-implementation-status.md` | what was built per phase, rules, API, legacy import, the cleanup record, verification, limitations |
| `10-open-decisions.md` | what only the business can decide, each with a recommendation |

> **PD1 (layout refinement, see `11-implementation-status.md`):** the optional map and the «طريقة الحساب» panel were removed from `/planning` (the earlier «map decision» of `06` and the «التفاصيل» container no longer apply); the page order is now title + filters · إدارة المستهدفات · context row · position · cumulative chart · forecast & pace · deviation comparisons · أين نركز · العوامل; the metric definitions live in the dictionary (`/settings/metrics?category=planning`).

## Verdict (one paragraph)
The screenshot figures are **internally consistent** and are fully reproduced by the code (22.89 bn target ↔ overall coverage **70 %**, the 21.59 bn is the 66 % default — two states of one editable input, never both in one render); but the page rests on a basis that **cannot support what it says**: (1) the «probability» is the **floor of a clamp [1 %, 99 %]** applied to a normal tail of a z-score ≈ 44 built from three monthly points — not a probability; (2) the plan-to-date silently assumes **equal twelfths** and the planned/required figures are shown without that assumption; (3) the required pace divides by **whole months** (6.84 bn shown vs 7.60 bn on the real remaining 1.8 months); (4) the «19.74 bn maximum» adds the **all-time stock of 8.32 bn (6.18 bn of it older than 180 days)** and two full months of future billing — it is not a maximum collectible; (5) a second forecast (9.96 bn, Smart Reports) is **a horizon/partial-month defect**, not a method difference (like-for-like 11.16 bn vs 10.95 bn), and a third target basis (11.5 bn «appropriation») drives the dashboard; (6) a restricted user gets **different targets for the same entity** (Riyadh 4,037 M vs 3,307 M). A validated probability is **not supportable** (22 complete months, 0 target outcomes, no load dates); the page should show the labelled forecast, forecast achievement %, assumptions and «لا تتوفر بيانات كافية لتقدير احتمالية موثوقة», plus a distribution-free fact the data does support (the required pace is 5.7–6.3× the best month in 22). Entity contributions to the deviation **do** reconcile exactly (Σ = −10,249.43 M), so a sorted deviation bar chart is supportable; a source-level or cause-level waterfall is not.

## Key defects at a glance (details in 02 and 01)
| # | Defect | Where |
|---|---|---|
| D1 | probability = clamp floor of a z≈39–44 normal tail from ≤3 points | `src/data/planForecast.js:30,37,43` |
| D2 | required pace uses whole months (understates by 11 % on 6 Nov; ×2 on 15 Dec); the day-based `g.pace` exists but is never shown | `planForecast.js:36,52-55`, `collectionGoal.js:37,76` |
| D3 | early-month extrapolation ×10 (2 Jan → estimate 21.2 bn, probability 41 %) | `planForecast.js:29` |
| D4 | year-end: «pace short … required» text with 0 months left; «0 %» | `planForecast.js:36,55`, `PlanForecast.jsx:27` |
| D5 | even 1/12 plan is silent; `plan.source` is always `'saved'`, never «assumption» | `planTargets.js:10,104`, `PlanningArea.jsx:60` |
| D6 | per-entity target depends on who is looking; label stays «الوزارة (كل الجهات)» | `planTargets.js:91-96`, `PlanningArea.jsx:45-51,62` |
| D7 | «maximum» = stock (all years) + 2 whole months of billing; overlaps Nov billing | `planForecast.js:47-48`, `PlanForecast.jsx:26` |
| D8 | «أين نركز» ranks the 2026 cohort (3.89 bn) while «reasons» use the all-time stock (8.32 bn) | `PlanningArea.jsx:58`, `planInputs.js:17` |
| D9 | Smart Reports forecast: partial month fitted as a full point + horizon skips rest of the month; target 11.5 bn «approved (demo)» | `revenueOutlook.js:89,108`, `assistantAnswers.js:82` |
| D10 | dashboard attainment uses the 11.5 bn appropriation: −5.7 % vs plan, planning says −49.8 % | `revenueAnalysis.js:78-84` |
| D11–D18 | stale «غير المحدد» text, dead saved-plan store, plan-to-date computed 3×, probability colours at 70/35 %, latent series-vs-snapshot basis, per-device targets without version/owner, no data-freshness concept | see 01 §9 |
