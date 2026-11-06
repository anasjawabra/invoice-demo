# 09 — Validation criteria and demo scenarios

Reference values come from the read-only probes (`scratch/p1/probe1…7.mjs`) on the synthetic compact world at 2026-11-06 — they are **oracles for reconciliation cases, never hard-coded expectations** (§12): tests compute them from the same functions and compare identities.

## 1. §12 checklist as testable criteria
| # | Requirement (§12) | Test (identity / assertion) | Tolerance | Reference at 6 Nov (70 % target) |
|---|---|---|---|---|
| V1 | annual target consistent across sections for the same scope/version | every rendered target string = `planningBasis.target.value` formatted (context bar, pace block, bullet, table, map card, export); changing the coverage input changes **all** within one render | exact | 22,893.5 M (66 %: 21,585.3 M) |
| V2 | Ministry = Σ entities | `Σ_i T_i = T`; `Σ_i budget_i = budget`; map: regions + housing + HQ + remainder = Ministry | ±1 SAR | 32,705 M budget |
| V3 | monetary totals reconcile cards ↔ charts ↔ tables ↔ drill-downs ↔ exports | `C = last actual point of the chart = Σ monthly series = Σ_i C_i = recv.total`; chart sr-only table = chart data; action-row amount = `/collection` list total; export (if any) = screen | ±1 SAR | 9,210,040,076 |
| V4 | bridge to the period-invoice KPI | `C − fromPrior − overpayment = totals.collected` | ±1 SAR | 9,210,040,076 − 494,196,579 − 50,000 = 8,715,793,497 |
| V5 | financial identities | `gross = exclusions + net`; `net = collected + uncollected` (`checkEquation`, `engine.js:308`) per entity, source and total | ±0.5 SAR | 15,818.77 = 3,213.44 + 12,605.33; 12,605.33 = 8,715.79 + 3,889.54 |
| V6 | national % from aggregated amounts | for every ratio shown at Ministry level: `value = Σ numerator ÷ Σ denominator` of the rows (never the mean of row percentages) — property test over random entity subsets | 1e-9 | achievement 40.2 % = 9,210.04 ÷ 22,893.5 |
| V7 | the four percentages never interchanged | tooltip/definition strings differ; achievement ≠ collection rate (69.1 % cohort rate vs 40.2 % achievement) asserted as different fields | — | |
| V8 | cut-offs consistent; future periods never zero | all figures carry the same `asOf`; chart series after `asOf` are `null`; recent pace uses complete months only | exact | Aug–Oct mean 932.00 M |
| V9 | forecasts use only information available at their forecast date | **leakage test**: for random origins d, forecast computed on `loadStore(d)` equals the forecast computed on the full store restricted to payments/invoices dated ≤ d (same function, same output); forecast never reads `T` | exact | probe3 runs at 7 dates |
| V10 | unsupported probability and causal text removed | DOM/regex: no `%` in the probability slot while unsupported; the exact message «لا تتوفر بيانات كافية لتقدير احتمالية موثوقة» present; no «الحد الأقصى الممكن», no «مبررات عدم تحقيق», no named cause without a record | exact | |
| V11 | actions do not double-count | each invoice with `outstanding>0` in ≤ 1 line; `Σ lines = stock.netUncollected`; classes A–D partition | ±0.5 SAR | 8,322.67 M = 2,138.2 actionable + 6,184.5 aged (+ blocked within) |
| V12 | edge cases behave | scenarios of §2 | — | |
| V13 | AR/EN same meaning | every `L(ar,en)` has both; numbers extracted from AR and EN renders are equal; status text maps 1:1 | exact | |
| V14 | existing correct functionality preserved without duplicates | existing tests still pass; no second implementation of plan-to-date, no second forecast, no second map | — | |
| V15 | target independent of the viewer | the same entity's `T_i` is identical for a Ministry viewer and an org-restricted viewer; restricted label ≠ «الوزارة (كل الجهات)» | exact | Riyadh 4,037.3 M (66 %) both |
| V16 | pace arithmetic | `requiredMonthly × monthsLeft = remaining target`; `requiredDaily × remainingDays = remaining target`; no value when `remainingDays = 0` or `remaining = 0` | ±1 SAR | 7,601.9 M × 1.8 = 13,683.5 M; 248.8 M × 55 |
| V17 | year-end bridge | `T − F = (P − C) + ((T − P) − (F − C))` | ±1 SAR | 11,945.39 = 10,249.43 + 1,695.95 |
| V18 | entity contributions | `Σ_i (P_i − C_i) = P − C` and signed; entities ahead shown separately | ±1 SAR | −10,249.43 M |

## 2. Edge-case scenarios (how to set them up)
| Scenario | Setup | Expected |
|---|---|---|
| **Above target** | edit overall coverage to ≈ 20 % (target ≈ 6.5 bn < C) | context «تحقق المستهدف — تجاوز بمقدار X»; remaining 0; no pace/gap; deviation vs plan still shown; achievement printed above 100 % uncapped; map text «100%+» with exact value in card |
| **Zero target** | coverage 0 % or an entity with no revenue appropriation (HQ) | «لا مستهدف»; actual only; no %, no status, no «achieved» (`computeGoal` `no_target`; test `platform.test.mjs:1436`) |
| **Missing plan** | a year/entity without an approved profile | banner «لا خطة معتمدة — افتراض: توزيع متساوٍ»; deviation labelled as assumption; status text shows the assumption chip |
| **Partial month** | `?demoToday=2026-11-01` and `…-11-06` (`clock.js:19`) | planned prorated by days; recent pace unchanged by the partial month; forecast adds the remaining days of November; label «حتى 6 نوفمبر» |
| **Early month / year** | `?demoToday=2026-01-02` | **no** annualised ×10 (today 21.2 bn / 41 %); «لا يكفي سجل» or last-complete-months fallback |
| **Stale data** | latest data date 3 days before today (test injection) | banner with both dates; all figures `asOf = latest data date`; remaining days counted from it |
| **Year-end** | `?demoToday=2026-12-31` | outcome statement «لم يتحقق: −10.9 مليار»; no required pace, no forecast, no «0 %» (today: «pace short … required» text) |
| **Restricted user** | login with the Riyadh organisation | label «إجمالي الجهات المتاحة لك»; Riyadh target 4,037.3 M (not 3,306.6 M); bars/lines/factors only for Riyadh; no cross-entity figure |
| **Edited target** | coverage 66 → 70 % | context bar, pace block, bullet, table, map card all change together; «آخر تعديل» and version update; the previous value is not left anywhere on screen |
| **No budget year** | fiscal year 2025 | message «لا ميزانية مبلغة …»; actual only; no forecast |
| **Arabic/English** | switch language on each scenario | same numbers and same status meaning; direction and number alignment correct (`dir="ltr"` numerals) |
| **Keyboard / contrast** | tab through the page | every control, expander and table reachable; status never colour only; contrast ≥ AA on the shared tokens |

## 3. Demo script (≈ 6 minutes, Arabic) [R]
1. **Context (30 s)** — «هذا مستهدف توضيحي غير معتمد: 22.89 مليار، والخطة افتراض بتوزيع متساوٍ؛ البيانات حتى اليوم». Show that changing coverage 66 → 70 % updates every number together and the version line.
2. **Are we on track? (60 s)** — actual 9.21 vs planned 19.46, deviation −10.25 (−52.7 %), «متأخر عن الخطة ▼»; the chart: actual ends at today, the forecast is a separate dashed segment.
3. **Year-end outlook (60 s)** — forecast 10.95 bn = 47.8 % of the target; the bridge (10.25 behind + 1.70 uncovered); required 7.60 bn/month vs recent 0.93 vs best month 1.20. Say plainly: *no probability is shown because 22 months of illustrative history and no target history cannot validate one* — the message on screen.
4. **Who contributes? (60 s)** — sorted bars: Jeddah and Riyadh −1.9 bn each; the bars add up to the total deviation; sources show collected share only.
5. **Where do we act first? (90 s)** — the action table: Housing white lands: 4.17 bn balance but 0.58 bn actionable and 3.60 bn older than 180 days (a decision, not a push); Jeddah fines 0.47 bn; click a row → `/collection` with the same filters and the same total.
6. **Factors (45 s)** — observed (billing is 44 % of what the target requires), calculated indicators (not additive), hypotheses (not asserted), data gaps (no payment load date).
7. **Optional (30 s)** — map by position vs plan; restricted-user login shows «إجمالي الجهات المتاحة لك».
**Do not claim:** a validated forecast or probability, an approved target or plan, expected recoveries, causes of the shortfall, alignment with the forecasting teams (pending).
