# 08 — Phased implementation plan (nothing implemented)

Principles: reuse before adding; fix the **basis** before the presentation; one calculation per metric; no new data-source/AI sections; Agents/Challenges pages, Data-sources/quality filter panels and Decision-Room assignment stay out (project rules). No calendar dates are given. Two areas are in flux and must be re-checked at implementation time: **server/identity + the data service** (access control) and the **shared chart library** (`docs/chart-library.md`, agent G).

## 0. What is reused / new
| Reused as is | Reused with change | New |
|---|---|---|
| `MetricTile`, `LocalFilterToolbar`, `AsyncBlock`, `PctBadge` (+ colour scale), `ProvinceMap`, `useUrlFilters`, `resolvePlanning`; `entityTargets`/`totalTargets` (arithmetic stays); `computeGoal` skeleton, `monthsLeft`, `reportingDateFor`; engine `snapshot/series/derive/makeCtx`; `/collection` list filters; Decision Room item pattern (facts/calculated/unknown); shared `PageChart` kinds `line`, `hbar`, `bullet` | `forecastYear`, `focusRanking` (retired), `PlanForecast.jsx` (split), `EntityMap.jsx` (measure + collapsed), `TargetsPanel.jsx` (collapsed, version fields), `revenueOutlook.js` (fit/horizon), `assistantAnswers.js:82`, `revenueInsights.js:364`, dashboard attainment label/target | `src/data/planningBasis.js` (basis object, profile, pace, status, tolerance), `src/data/planningCharts.js` (blocks for `hbar`/`bullet`/`line`, pattern of `decisionCharts.js`), `server/planningActions.js` + route + client method (action lines), `src/components/strategic/PlanContext.jsx`, `PlanPosition.jsx`, `PlanOutlook.jsx`, `PlanActions.jsx`, `PlanFactors.jsx`, tests |

## Phase 0 — One basis and the defect fixes (no layout change)
| Task | Files / functions | Fixes | Depends on |
|---|---|---|---|
| 0a `planningBasis({year, scope, store, today, latestDataDate})` returning target {value, versionId, status, editedAt/by}, `planProfile {kind, versionId}`, `asOf`, `latestCompleteMonth`, remaining days/months (`monthsLeft`), required daily/monthly pace, `plannedToDate` (**one** implementation replacing `collectionGoal.js:30`, `planForecast.js:44`, `decisionRoom.js:87`), deviation, status text + tolerance parameter | new `planningBasis.js`; `collectionGoal.js` keeps `computeGoal` as a thin wrapper; `decisionRoom.planSectionOf` and `useDecisions.js` call it | D2, D5, D13, D16-part | — |
| 0b targets computed on the **full** entity set; visibility filters rows only; restricted total labelled «إجمالي الجهات المتاحة لك» | `PlanningArea.jsx:45-53` (pass all keys to `entityTargets`, then filter), `planTargets.js` unchanged arithmetic; `useDecisions.js:36-37` same | D6 | 0a |
| 0c forecast function: complete months only; remaining days of the current month explicit; no `÷ max(dayFraction,0.1)`; year-end outcome state; **remove probability and clamp**, return `probabilityStatus:'unsupported'`, `forecastAchievement = F ÷ T`, assumptions list, `method {id:'runrate3_v2', window}`; remove `maxTotal`/`billing_insufficient` | `planForecast.js` (`forecastYear`) | D1, D3, D4, D7 | 0a |
| 0d one forecast engine for all surfaces: `revenueOutlook.js` fits complete months only, forecasts from the cut-off day (adds the rest of the current month), reads the planning target; or delegates to 0c — **method owner/alignment is decision D-05** | `revenueOutlook.js:89-142`, `FixedReports.jsx:26`, `analysisTasks.js:274-304`, `smartReport.js:90-102` | D9 | 0a; D-05 |
| 0e wording of «approved» for a `demo` target | `assistantAnswers.js:82` (AR twin follows), `revenueInsights.js:364`, `revenueOutlook.js` header text | R3 wording | — |
| 0f one receipts function (series and snapshot count payments identically; masked-invoice rule decided once) | `server/engine.js:359-372,498-531` — coordinate with the access-control agent's changes in `server/engine.js` | D15 | re-read the file first |
| 0g target store v2 meta (`versionId`, `status:'illustrative'|'approved'`, `owner`) read from v1 transparently | `planTargets.js` (`loadTargetStore`, `setOverall`, `setTargets`), `TargetsPanel.jsx` | A3, D16 | 0a |
| 0h single target for the year: dashboard attainment and `DEFAULT_TARGETS.collectionAmountAnnual` either read `planningBasis` or are renamed «نسبة تحقيق الاعتماد مقابل الإيراد» with their own basis shown | `revenueAnalysis.js:75-85`, `revenueMetrics.js:645-657`, `RevenueContext.jsx:61` | D10 | decision D-01 |
**Acceptance (phase 0):** one target and one planned-to-date per (year, scope) on every surface; at 6 Nov the page shows planned 19,459.48 M and required 7,601.9 M/month (70 %); no `probability` field remains; Riyadh target identical for both viewers; year-end prints no required pace; early-month cut-off gives no ×10; all existing tests pass or are updated deliberately.

## Phase 1 — Page sections 1–3 (context, position, outlook)
Files: `PlanningArea.jsx` (composition), new `PlanContext.jsx` (scope, target version/status, plan profile, cut-off, freshness chips), `PlanPosition.jsx` (actual / planned / deviation / status + chart), `PlanOutlook.jsx` (forecast, forecast achievement %, bridge strip, required vs recent vs best month, probability slot message), `UnitLines.jsx` (marker at the cut-off, separate forecast segment, plan-source legend), `src/data/i18n.js` + inline `L()` strings (AR/EN twin), `global.css` `.st-*` additions only. Remove: duplicate target tile and probability tile, repeated achievement. Move: budget/coverage into the targets section.
**Acceptance:** sections in the order of 06; the unsupported-probability message appears with forecast + forecast achievement + assumptions; status text and ▲▼= beside colour; every number carries its cut-off; above-target, zero-target, missing-plan, partial-month, stale-data, year-end states render per 06 §4.

## Phase 2 — Contribution and priorities
| Task | Files |
|---|---|
| entity deviation bars (signed, sorted, «أخرى» remainder) and bullets (Ministry + top N) | new `planningCharts.js` building blocks for the shared `PageChart` (`hbar`, `bullet`), rendered in `PlanPosition`/new `PlanContribution` block; the chart library must be stable (re-check kinds then) |
| action lines | new `server/planningActions.js` (`actionLines(st, req)`: one scan with `derive`, class A–D assignment, due-by-year-end, oldest days, drill filters) + `case '/plan-actions'` in `server/api.js` (+ org mask like the other endpoints) + `src/api/client.js` method; reuses `makeCtx/derive/CLASSES` |
| action table | `PlanActions.jsx` (columns per 07 §3), drill links to `/collection` with filters carried; retire `focusRanking` and its test (replace) |
| factors panel | `PlanFactors.jsx` (four groups per 07 §4); content builders in `planningCharts.js` or `planningBasis.js` (pure, bilingual `bi()`) |
**Acceptance:** Σ bars = ministry deviation (±1 SAR); Σ action-line amounts = stock; row amount = `/collection` list total for the carried filters; no invoice in two lines; class D shown separately; «غير متاح» for expected impact; AR/EN same meaning.

## Phase 3 — Map and details
`EntityMap.jsx`: default collapsed in «التفاصيل»; measure «الموقف مقابل المخطط حتى تاريخه» (collected ÷ planned) with diverging, text-labelled scale (new measure id; keep «المحصّل»); delete stale «غير المحدد» (`:92`); national card from `planningBasis`. `TargetsPanel.jsx` collapsed as «إدارة المستهدفات» with version/status/owner inputs (reviewers only); monthly split stays; add «الخطة المعتمدة» import placeholder only if D-03 decides.
**Acceptance:** regions + housing + HQ + remainder = Ministry; map colours reproduce `collected ÷ planned` per entity; keyboard operation of region select; no change in totals.

## Phase 4 — Cross-surface and documentation
| Task | Files |
|---|---|
| Decision Room plan items read `planningBasis` (planned, tolerance); thresholds aligned to the documented tolerance | `decisionRoom.js:51,55,85-97`, `useDecisions.js` |
| Smart Reports / assistant / fixed reports: forecast from 0d, target and wording from 0e/0h; planning section is **not** added to exports unless D-06 asks for it (then: a planning block in `reportModel.js` using the same `planningBasis`, and parity rows in `scripts/export-parity.mjs`) | `reportModel.js`, `smartReport.js`, `scripts/export-parity.mjs` |
| Metrics dictionary: replace «الاحتمال», «سبب الفوترة غير كافية»; add the metrics of 04 | `src/data/dictionaryDocs.js:136-170` |
| remove dead code: saved-plan store (`savePlan`, `rebasePlan`, `GOAL_KEY`), unused `g.pace/plan/versusPlan` after Phase 0 | `collectionGoal.js`, tests `platform.test.mjs:1452-1469` |
| docs: record the final basis in `docs/planning-cfo-review-plan.md` successor | `docs/` |

## Phase 5 — Probability (only with real data)
Not scheduled: starts when the inputs in 05 §6 exist; add `probabilityStatus:'supported'` path, validation harness under `tests/` fed with as-of datasets, and the band series in the chart code.

## Migration of saved state [R]
* `ib_plan_targets_v1` (`v:1`): read as is; add `meta` lazily on first save; **values never change silently**; existing 70 %/66 % edits keep working; the status defaults to «illustrative».
* `ib_collection_goal_v1` (saved plans): unused by any screen — ignored, removed with the dead code; no user-visible effect.
* Decision-room store and saved analysis versions are untouched; reports saved earlier keep their stored method text (their `method.id` is `ols_trend_v1`, new runs carry the new id).

## Tests to add or update
| Test | Where |
|---|---|
| planned-to-date: one implementation; equal to the three old results on fixtures | `platform.test.mjs` goal block (`:1423-1469`) |
| required pace: day-based; none at year-end/after; 15 Dec case | new |
| early-month: no ×10; 2 Jan → «لا يكفي سجل» or complete-month fallback | new (replaces nothing) |
| forecast: complete months only; rest-of-month covered; method id; `probabilityStatus` is `unsupported`; no probability field | update `:1736-1748` |
| targets on the full set: restricted viewer keeps Riyadh = 4,037.3 M (default); visible subset rows only | new, after access-control lands |
| entity bars Σ = ministry deviation (±1 SAR) at default and at an edited coverage; map/table reconciliation with an edited target | new (use `scratch/p1/probe2.mjs` as the oracle) |
| action lines: disjoint, Σ = stock, drill parity with `list()` | new in `tests/list-facets.test.mjs` pattern |
| restricted user: no entity outside scope in bars, lines, factors; label «إجمالي الجهات المتاحة لك» | new |
| AR/EN parity: every new `L()` has both; same numbers in both | new |
| wording guard: no «احتمالية» percentage, no «الحد الأقصى الممكن», no «مبررات عدم تحقيق» in the planning bundle (regex test like the Decision Room's forbidden-phrase test) | new |
| exports: if D-06 → parity rows | `scripts/export-parity.mjs` |

## Order and parallelism
`0a` first; then `0b, 0c, 0e, 0g` in parallel; `0d` after D-05; `0f` after re-reading the engine (access-control agent); `0h` after D-01. Phase 1 after 0a–0c. Phase 2 server task (`planningActions`) can start with 0a; its UI after the chart library settles. Phase 3 parallel to Phase 2. Phase 4 last. The review gate of the request («do not implement until reviewed») applies before Phase 0.
