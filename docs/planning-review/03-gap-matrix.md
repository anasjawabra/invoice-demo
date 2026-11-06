# 03 — Gap matrix: requested capability × class

Classes: **OK** Already implemented and correct · **REF** Implemented but needs refinement · **BAD** Incorrect or misleading · **MISS** Missing · **N/S** Not supportable with the available data.
Tags as in README ([V] code/data, [I] screenshots, [R] recommendation).

## A. Basis and scope (§3, §10, §12)
| # | Capability | Class | Evidence |
|---|---|---|---|
| A1 | One selected financial year and Amanah/entity for all sections | OK | year + Amanah in the URL, used by targets, tiles, forecast, map (`PlanningArea.jsx:34-37`) [V] |
| A2 | Revenue-source scope | MISS | no source filter; `focusRanking` shows sources only as rows; targets have no per-source basis (`revenueAnalysis.js` header: «There is NO per-source target») [V] |
| A3 | Target version and scenario in every section | MISS | store has `v:1` schema only; no version/scenario/owner/status (`planTargets.js:7,30`) [V] |
| A4 | Same target in every section of the page | OK (within a render) / BAD (across states, pages, users) | one `selected` (`:53`); 21.59 vs 22.89 = two edit states; dashboard/Smart Reports use 11,495 M; restricted users get other targets (D6, D10) [V] |
| A5 | Reporting cut-off consistent and visible | REF | cut-off shown in tile labels and the basis note, not in the filter bar; it is «today» (`clock.js:30`) [V] |
| A6 | Latest complete data period vs current date | MISS | no freshness/lag concept; synthetic world is generated to today (D17) [V] |
| A7 | Missing future data is not zero actual | OK | future months `null` (`collectionGoal.js:58`, `planForecast.js:26`); chart ends the line [V] |
| A8 | Definitions: net = gross − exclusions, uncollected = net − collected, rate = collected ÷ net, achievement = collected ÷ target | REF | the three percentages are defined in one line (`PlanningArea.jsx:96`); net/uncollected identities are enforced in the engine (`engine.js:308-315`, `checkEquation`) but not restated on the page [V] |
| A9 | National % from aggregated amounts | OK | `shareOf` = Σ collected ÷ Σ target (`EntityMap.jsx:20`); `totalTargets` coverage = Σ target ÷ Σ budget (`planTargets.js:43`) [V] |
| A10 | Annual target consistent with entities (Ministry = Σ entities) | OK | `totalTargets`; reconciliation table with remainder row (`EntityMap.jsx:57-66`) [V] |
| A11 | Target editing separate from performance analysis | REF | editing and analysis share one page; the first section is editable inputs (`TargetsPanel.jsx:66-82`) [V] |

## B. «الانحراف عن المستهدف حتى تاريخه» (§4)
| # | Capability | Class | Evidence |
|---|---|---|---|
| B1 | actual to date = qualifying collections through the cut-off | OK (population) | payment-date receipts, approved rules, main classes (`planInputs.js`, `engine.js:359-372`); population differs from the 8.72 bn KPI — bridge missing (02 §2) [V] |
| B2 | planned to date = approved cumulative plan | N/S (no approved plan) → REF | only an assumed even split exists; weights editable; no approval (`planTargets.js:10`) [V] |
| B3 | allocation labelled as an assumption | BAD | `g.plan.source` never shown; always `'saved'` (`PlanningArea.jsx:60`) [V] |
| B4 | deviation amount = actual − planned; % = ÷ planned when planned > 0 | OK | `planForecast.js:44-45` (`deviationPct` null when planned = 0) [V] |
| B5 | annual achievement % = actual ÷ target when target > 0 | OK | `TargetsPanel.jsx:110,132`, `EntityMap.jsx:52` [V] |
| B6 | remaining target = max(target − actual, 0) | OK | `collectionGoal.js:63` [V] |
| B7 | show cut-off, actual, planned, deviation, % together | REF | tile subtitle holds actual/planned; cut-off only in other tiles (`PlanForecast.jsx:51-53`) [V] |
| B8 | status text متقدم/متأخر/وفق الخطة | MISS | tone colour only (`:50`); Decision Room has a «Collection below plan» item with 10 %/25 % demo thresholds (`decisionRoom.js:51,55`) [V] |
| B9 | tolerance with documented basis | MISS | none; Decision Room thresholds undocumented → 10-open-decisions D-04 [V] |
| B10 | zero target / missing plan / partial month / exceeded target | REF | zero target: `no_target` state with callout (`PlanningArea.jsx:117-130`, test `platform.test.mjs:1436`); exceeded: `achieved`, `exceededBy`, remaining 0, probability 1 (UI shows no «exceeded by» text); missing plan: n/a (always assumed); partial month: day-prorated plan OK, but run-rate for the partial month uses `max(actual, avg)` and early-month ×10 (D3) [V] |

## C. «احتمالية تحقيق المستهدف» and forecast (§5)
| # | Capability | Class | Evidence |
|---|---|---|---|
| C1 | monetary year-end forecast | REF | 10.95 bn run-rate; one method; no window/assumptions panel; a second, inconsistent forecast elsewhere (D9) [V] |
| C2 | forecast achievement % = forecast ÷ target | MISS | not shown (the tile mixes forecast and target in a subtitle) [V] |
| C3 | probability P(actual to cut-off + future ≥ target) | BAD | clamp floor of a z≈44 normal tail from 3 points (D1) [V] |
| C4 | data-sufficiency statement / «لا تتوفر بيانات كافية …» | MISS | no such state [V] |
| C5 | prediction interval for year-end | MISS on `/planning`; BAD in Smart Reports (±1.28 SD of a partial-month fit, flagged not a CI) [V] |
| C6 | validated probability | N/S | 22 complete months, 0 target outcomes, no load dates (05) [V S] |
| C7 | assumptions, window, method id shown | MISS on `/planning`; OK in Smart Reports text (`revenueOutlook.js:67-71`) [V] |

## D. Required pace (§6)
| # | Capability | Class | Evidence |
|---|---|---|---|
| D1 | remaining target, remaining time | REF | remaining target OK (`g.remaining`); remaining time by days exists in `g.pace` but is not shown [V] |
| D2 | required monthly / daily pace | BAD | whole-month divisor (6.84 vs 7.60 bn); no daily pace (D2) [V] |
| D3 | recent actual pace from complete periods | OK | Aug–Oct (`planForecast.js:29`) [V] |
| D4 | increase needed (×) | MISS | not stated; 7.3× / 6.3× the best month computed in 02 [V] |
| D5 | partial month and year-end explicit | BAD | year-end prints «required» with 0 months left (D4) [V] |
| D6 | scenarios (baseline / improved / other) | MISS by decision | removed on purpose (`docs/planning-cfo-review-plan.md` §6); `applyScenario` is dead code (`revenueOutlook.js:202`) [V] |

## E. Priorities «أين نركز» (§7)
| # | Capability | Class | Evidence |
|---|---|---|---|
| E1 | ranked list/table | REF | 5 sentences, not a table [V] |
| E2 | not only balance × low rate | BAD | `score = outstanding × shortfall` is exactly that (`planForecast.js:63`) [V] |
| E3 | contribution to the monetary gap | MISS in the list; **supported** by data: entity deviations reconcile (07) [V] |
| E4 | amounts due within the remaining period | MISS; supported at invoice level (`st.due`), not aggregated [V probe5] |
| E5 | overdue and ageing | MISS in the list (cells carry `overdue/notDue/maxDaysOverdue`, unused by the list) [V] |
| E6 | collectibility/known blockers (objections, enforcement, exclusions) | MISS in the list; data exist (`stock.objectionOutstanding`, `enforcement`) — 0 in this world [V] |
| E7 | time required for action | N/S (no workflow-duration data) |
| E8 | already included in the forecast | N/S (the run-rate is not invoice-level) |
| E9 | priority · entity · source · amount · reason · action · link | MISS (only entity/source/amount/rate; one generic link) [V] |
| E10 | expected recoverable amount with explainable basis | N/S → show «غير متاح» [V S] |
| E11 | no double counting | OK inside the list (cells are disjoint); BAD vs «reasons» (cohort 3.89 vs stock 8.32) [V] |
| E12 | within selected scope and permissions | OK for amounts (org-masked data service); BAD for the target label (D6) [V] |

## F. «مبررات عدم تحقيق المستهدف» (§8)
| # | Capability | Class | Evidence |
|---|---|---|---|
| F1 | wording presumes failure | BAD | heading «مبررات عدم تحقيق المستهدف» (`PlanForecast.jsx:66`) [V] |
| F2 | observed facts / calculated contributors / hypotheses separated | MISS | two sentences mix them; Decision Room already does it for plan items (`facts / calculated / unknown`, `decisionRoom.js:285-300`) [V] |
| F3 | no invented causes | OK (no named causes) but «billing is insufficient» states a cause by arithmetic [V] |
| F4 | «maximum collectible» | BAD (D7) |
| F5 | reconciled decomposition | by entity: **exists** (exact); by source: N/S (no source targets); by driver: arithmetic identity exists but not a causal waterfall (07) [V] |
| F6 | data gaps separate from shortfalls | MISS (quality/missing-field counts exist in the snapshot, not used here) [V] |

## G. Map and charts (§9)
| # | Capability | Class | Evidence |
|---|---|---|---|
| G1 | cumulative actual vs planned + forecast + band | REF | line chart OK; plan is month-end vs actual-to-date; no uncertainty band; own chart component (`UnitLines.jsx`) [V] |
| G2 | sorted horizontal deviation bars | MISS; shared `hbar` exists (`docs/chart-library.md`) [V] |
| G3 | bullet chart | MISS; shared `bullet` exists and requires an approved target [V] |
| G4 | ranked action table with drill-downs | MISS (see E) |
| G5 | waterfall only if reconciled | N/S for the gap by cause; supportable only as the 2-term year-end bridge (07) |
| G6 | map as optional secondary view | REF — measure is time-agnostic; mapping verified [V]; the dashboard already has a «deviation» map measure on a different target (`revenueAnalysis.js:135`) |
| G7 | do not mix regions / Amanat / housing sector / HQ | OK | regions = Σ Amanahs; Housing and HQ listed separately; remainder row [V] |
| G8 | do not cap at 100 % | REF | figure printed «100%+» on the map (`EntityMap.jsx:37`), exact value in the card; table shows the true % [V] |
| G9 | «behind plan» judged by reporting-date performance | BAD for the map (annual %), OK for the tile [V] |

## H. Page, language, accessibility, exports, tests (§10–§12)
| # | Capability | Class | Evidence |
|---|---|---|---|
| H1 | hierarchy scope → actual vs plan → forecast/pace → entities/sources → actions → evidence | REF | order today: targets editor → 5 tiles → chart → 2 tiles → focus/reasons → map; target repeated 4×, achievement shown 5× [V] |
| H2 | MOMAH shared components / colours / IBM Plex | OK | shared tiles, buttons, tags; Hugeicons unavailable locally [V] |
| H3 | AR RTL + EN parity | OK for strings (every `L()` has both); no parity test for the page [V] |
| H4 | text/symbols beside colour | REF | tiles use colour + sign; probability tile has colour + number only; map has legend text and in-map labels [V] |
| H5 | keyboard / responsive | REF | tables are focusable (`tabIndex=0`), chart has an sr-only table; map region select is a `<select>` (keyboard OK); no responsive test [V] |
| H6 | exports of planning numbers | MISS | no planning export; Smart Reports carry a different forecast/target [V] |
| H7 | tests | REF | formulas covered; behaviour at edges not (01 §8) |
