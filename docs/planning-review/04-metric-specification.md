# 04 — Metric specification (proposed canonical definitions)

Tags: **[V]** = where the current code does it (path:line); **[R]** = the specification the plan proposes. Where current code deviates, the deviation is named. Notation: `T` annual revenue target of the selected scope; `C(d)` collections through date `d`; `P(d)` approved cumulative plan through `d`; `asOf` = reporting date.

## 0. Common rules [R]
| Rule | Specification |
|---|---|
| Scope | financial year × entity set (Amanah / housing sector / HQ; all visible entities = «إجمالي الجهات المتاحة لك» for a restricted user) × revenue source (optional; targets exist at entity level only) |
| Basis object | one `planningBasis` per (year, scope): `{ year, scope, target:{value,versionId,status,source,editedBy,editedAt}, planProfile:{kind:'approved_monthly'|'prior_year_seasonal'|'assumed_even', versionId}, scenario:'baseline', asOf, latestDataDate, latestCompleteMonth, forecastMethod:{id,window,version}}` — every number on the page and in any export is computed from it |
| `asOf` vs current date | `asOf = min(today, latestDataDate)`; the page prints both when they differ and a «بيانات غير محدثة» state when `today − latestDataDate > staleDays` (config, owner: data owner). In the demo `latestDataDate = today` by construction [V `clock.js:30`] |
| Latest complete period | the last calendar month ≤ `asOf` whose last day ≤ `latestDataDate`; used for «recent pace» and for fitting any forecast. A partial month is **never** a data point of a fit |
| Money / units | SAR in the data; displayed via the shared `short()` (billions/millions + «ريال»/SAR); tables in millions; one unit per chart axis (`UnitLines` rule) |
| Missing vs zero | future or not-yet-reported periods are **missing (null)**, never 0 [V `collectionGoal.js:58`]; a denominator ≤ 0 → «غير متاح»/«—», never 0 or ∞ |
| Percentages | the four are never interchanged: **net invoiced = gross − exclusions · uncollected = net − collected · collection rate = collected ÷ net invoiced · target achievement = collected ÷ revenue target**; coverage = collected ÷ communicated budget [V `PlanningArea.jsx:96`, `engine.js:308-315`] |
| Aggregation | all percentages and per-unit figures at a higher level are ratios of **summed amounts**, never averages of entity percentages [V `EntityMap.jsx:20`, `planTargets.js:43`] |
| Colour | never alone: every status has text and a symbol (▲ ▼ =) |

## 1. Base amounts
| Metric | Definition & formula | Unit / level | Date basis | Source fields | Filters | Missing / zero | Owner function |
|---|---|---|---|---|---|---|---|
| **Actual to date** `C(asOf)` | Σ payments with `payDate ∈ [1 Jan, asOf]` on any invoice, approved exclusion rules only, main revenue classes (outside: «أخرى») | SAR; entity × month | **payment date** | `st.pDay/pAmt`, `ent`, `src` (engine); exclusions mask | scope, source (optional) | none → 0 with data present; no data → null | today: `series` (`engine.js:498`) + `snapshot.receivedInPeriod` (`:368,492`) — **proposed: one `receipts()` used by both** (D15) |
| Collected on period invoices | payments on invoices issued in the period, capped at billed (`D.collected`) | SAR | issue date cohort, measured at cut-off | `D.collected` | same | — | `snapshot.totals.collected` — **different population; show the bridge** (02 §2) |
| **Annual revenue target** `T` | `Σ_entity coverage_e × budget_e`; override OFF: `overallCoverage × Σ budget(all entities, HQ included)` spread by revenue-appropriation share; carries `version`, `status` | SAR; entity | fiscal year | `appropriations.js` TABLE, store overall coverage | entity | `T ≤ 0` → «لا مستهدف»; no achievement, no «achieved» | `entityTargets` (`planTargets.js:90`) — **must be computed on the FULL entity set** (D6) |
| Required billing | `T ÷ collectionRateTarget` | SAR | annual | store overall collection rate | entity | rate ≤ 0 → null | `planTargets.js:102` |
| **Planned to date** `P(asOf)` | `cum[m−1] + (cum[m] − cum[m−1]) × day/daysInMonth(asOf)` where `cum` = approved cumulative plan; plan profile kind printed next to the figure; **assumed_even = T×k/12 labelled «افتراض»** | SAR | calendar month + day proration (assumption, labelled) | `planProfile.cum[12]` | entity | `T ≤ 0` or no profile → null, no deviation | today three copies (`collectionGoal.js:30`, `planForecast.js:44`, `decisionRoom.js:87`) → **one** |
| **Remaining target** | `max(T − C(asOf), 0)` | SAR | — | | | `T ≤ 0` → null | `collectionGoal.js:63` ✓ |
| Exceeded by | `max(C − T, 0)` | SAR | | | | | `collectionGoal.js:73` (unused in UI) |

## 2. Position against plan
| Metric | Formula | Notes |
|---|---|---|
| **Deviation amount** | `C(asOf) − P(asOf)` (negative = behind) | `planForecast.js:45` ✓ |
| **Deviation %** | `(C − P) ÷ P × 100` when `P > 0`, else «غير متاح» | national % from summed amounts ✓ |
| **Annual achievement %** | `C ÷ T × 100` when `T > 0` (**not capped at 100**) | `TargetsPanel.jsx:110`; map text prints «100%+» (`EntityMap.jsx:37`) — keep the exact value in table/tooltip |
| Position vs plan | `C ÷ P` (used for the map colour, optional view) | new |
| **Status text** | `dev% > +tol` → «متقدم عن الخطة ▲» · `|dev%| ≤ tol` → «وفق الخطة =» · `dev% < −tol` → «متأخر عن الخطة ▼»; `T ≤ 0` → «لا مستهدف»; `P` missing → «لا خطة معتمدة» | new |
| **Tolerance proposal** `tol` | **default 0.5 % of P** — documented basis: the rounding precision of the figures shown (one decimal of «مليار»/%), i.e. differences smaller than the display resolution are not a business signal. A business tolerance (e.g. ±5 %) needs Finance approval and is then stored with `owner`, `approvedAt`, `versionId`. The Decision Room's 10 % / 25 % (`decisionRoom.js:51,55`) are demo thresholds and must be aligned to the same parameter | decision D-04 |
| Contribution to gap (entity i) | `g_i = P_i − C_i`; share `= g_i ÷ Σ g_j`; **Σ_i g_i = P − C exactly** (verified: Σ = 10,249.43 M at 70 %, residual < 1 SAR, probe2) — entities ahead of plan carry a negative contribution, shown separately; defined only while every entity has its own `T_i` and `P_i` | reconciles because `P_i = profile_i(T_i)` and `Σ T_i = T` ✓ |
| Source-level contribution | **not defined** — no source targets exist (`revenueAnalysis.js:12`); show collected share and rate by source, never a deviation by source | N/S |

## 3. Time and pace
| Metric | Formula | Edge rules |
|---|---|---|
| Remaining days `R` | `daysFrom(asOf+1 … 31 Dec)` | `asOf = 31 Dec` → 0 |
| Remaining months | `monthsLeft(asOf) = (dim − d)/dim + (12 − m)` (day-based; **not** whole months) = 24/30 + 1 = **1.8** on 6 Nov | today the UI uses `12 − closed` = 2 (D2); `collectionGoal.js:37-41` is the right function |
| **Required daily pace** | `remaining target ÷ R` = 13,683.5 ÷ 55 = 248.8 M/day on 6 Nov | `R = 0` or remaining 0 → «لا مطلوب» (never a number after year-end) |
| **Required monthly pace** | `remaining target ÷ remainingMonths` | 6 Nov: (22,893.5 − 9,210.04) ÷ 1.8 = 7,601.9 M (page shows 6,841.7 M) |
| **Recent actual pace** | mean of the last 3 **complete** months of `C` (one source, scope) = 932.00 M; also show the YTD mean and the best complete month; label the window | needs ≥ 3 complete months else «لا يكفي سجل» |
| Increase needed | `required ÷ recent` (× and %) | recent = 0 → «—» |
| Year-end rule | at `asOf = 31 Dec`: deviation = `C − T`, no pace, no forecast, outcome stated «تحقق/لم يتحقق» | currently «0 %» + «pace short» text (D4) |
| Early-month rule | the first days of a month must not annualise (no `÷ max(dayFraction, 0.1)`): use complete months only; in January with no complete month in the year, fall back to the previous year's December/last 3 complete months or show «لا يكفي سجل» | D3 |

## 4. Forecast
| Metric | Definition | Rule |
|---|---|---|
| **Forecast baseline** `F` | `C(asOf) + E[remaining receipts]`, where `E` covers **the rest of the current month by days** plus the remaining whole months. Baseline = recent pace (3-complete-month mean) × remaining months; method id `runrate3_v2`, window and assumptions printed; **no assumed action benefit** in the baseline | one engine for the page, Smart Reports and the assistant (D9); fitted only on complete months |
| **Forecast achievement %** | `F ÷ T × 100` | not capped; shown **instead of** the probability when unsupported |
| Forecast gap | `T − F` (signed) | year-end bridge: `T − F = (P − C) + ((T − P) − (F − C))` = behind-at-cut-off + remaining plan not covered by expected remaining receipts (exact; at 70 %: 10,249.43 + (3,434.02 − 1,738.07) = 11,945.39) [V probe5] |
| Prediction interval | shown only when a validated method yields it (05); otherwise «لا يتوفر نطاق مدعوم» — never ±1.28 SD of 3 points | |
| **Probability** `p` | `P(C(asOf) + Σ future receipts ≥ T)` conditional on the stated method, window and assumptions; **displayed only when `probabilityStatus = 'supported'`** (≥ 36 complete months, rolling-origin validation, calibration in tolerance); otherwise «لا تتوفر بيانات كافية لتقدير احتمالية موثوقة» | today's `planForecast.js:38-43` is removed (clamp floor, D1); no tone colour on a probability; never a lookup table or the forecast ÷ target |
| Probability if exceeded already | `C ≥ T` → «تحقق المستهدف» (fact, not a probability) | |

## 5. Entity/source tables
| Metric | Definition |
|---|---|
| Coverage ratio | `C ÷ communicated budget` (collection vs budget; not a target) |
| Collection rate | `Σ collected ÷ Σ net invoiced` (period invoices) — never confused with achievement (`dictionaryDocs.js:138-141`) |
| Outstanding by class | per invoice, exactly one class (`derive().cls` precedence, `dictionaryDocs.js` «الحالة الموحدة للفاتورة») → overdue ≤ 180 d, overdue > 180 d, not yet due (due ≤ year-end / later), partial, blocked (objection, enforcement-linked, unresolved linkage) |
| Standing balance | `stock.netUncollected` (all issue years) — labelled «الرصيد القائم (كل السنوات)» and kept apart from «غير المحصّل على فواتير 2026» |

## 6. Zero/missing/special-case matrix
| Case | Target | Plan | Page behaviour |
|---|---|---|---|
| Normal | > 0 | assumed or approved | all metrics; plan source printed |
| **Above target** | C ≥ T | — | «تحقق المستهدف — تجاوز بمقدار X»; remaining 0; no pace/forecast gap; deviation still shown vs plan |
| **Zero target** | 0 | — | «لا مستهدف»; actual shown; no %, no status, no forecast gap [V `PlanningArea.jsx:117-130`] |
| **Missing plan** | > 0 | none | status «لا خطة معتمدة»; deviation to an **assumed even plan** only if the user accepts the assumption banner |
| **Partial month** | — | prorated | planned prorated by calendar day; recent pace excludes the month; label «حتى 6 نوفمبر» |
| **Stale data** | — | — | `asOf = latestDataDate`; banner with both dates |
| **Year-end** | — | — | outcome statement only |
| No budget year | — | — | as today: «لا ميزانية مبلغة …» [V `:111-116`] |
