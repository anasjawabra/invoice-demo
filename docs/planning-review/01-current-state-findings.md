# 01 — Current-state findings: the page, section by section

Route `/planning` → `PlanningArea` (`src/App.jsx:45`; `/strategic`, `/decision-room`, `/what-if` redirect here, `App.jsx:52-54`). One page, no tabs. Nav label `nav_planning` («التخطيط والتقارير» group, `Layout.jsx:164-165`). Synthetic compact world, cut-off 2026-11-06 [V].

## 0. How the page gets its data [V]
| Step | Code | Result |
|---|---|---|
| cut-off | `rev.cfg.cutoff` = `DEMO_TODAY` = today in Asia/Riyadh (`src/data/clock.js:30`, `revenueLedger.js:25`) | **cut-off = today by construction; there is no «latest complete data period» concept** (D17) |
| reporting date | `reportingDateFor(year, today)` (`collectionGoal.js:20-24`): today for the current year, 31 Dec for a past year, none for a future year | 2026-11-06 |
| inputs | `loadPlanInputs` (`planInputs.js:7-18`): `snapshot(scope 1 Jan→reporting, approved rules only)`, `series(...)`, and for an Amanah a second `snapshot` | `monthly` = `series.values` (receipts by **payment date**), `byAmanah`/`total` = `snapshot.receivedInPeriod`, `billedMonthly` = `byMonth[].net` (net billed by **issue** month), `standing` = `stock.netUncollected` (all issue years), `cells` = `matrix.amanahSource` (**invoices issued in the period only**) |
| targets | `entityTargets(tstore, year, visibleKeys…)` (`planTargets.js:90-106`) over the **localStorage** store `ib_plan_targets_v1` (`planTargets.js:7`) read once at mount (`PlanningArea.jsx:41`) | `total = totalTargets(entityRows)` (`:51`); `selected = total` for «الوزارة» (`:53`) |
| goal | `computeGoal` (`collectionGoal.js:53-78`) | `collected`, `plannedToDate`, `remaining`, `pace` |
| forecast | `forecastYear` (`planForecast.js:24-59`) | `forecast`, `probability`, `deviation`, `reasons` |

`approvedConfigOf` (`planInputs.js:5`) switches every exclusion rule that is not «approved» off, so planning counts approved exclusions only. On the synthetic data that makes no difference today (`unapprovedRulesApplied = []`, probe2) [V].

## 1. Header, definitions, filter bar (`PlanningArea.jsx:88-104`)
* Title «تخطيط إيرادات التحصيل» (`:91`), sub-title «أين نحن من الخطة: التغطية والمستهدفات والتقدير.» (`:92`).
* One-line definitions (`:96`): «نسبة التغطية = المحصّل ÷ الميزانية المبلغة · نسبة تحقق المستهدف = المحصّل ÷ المستهدف · نسبة التحصيل = المحصّل ÷ صافي المفوتر.» — the three percentages are kept apart correctly [V]. (Net invoiced = gross − exclusions is stated on the dashboard, not here.)
* Filters: fiscal year + Amanah in the URL (`PLANNING_KEYS`, `localPages.js:168-172`); an Amanah outside the user's organisation is dropped with the notice «أُعيد اختيار الأمانة لأنها خارج صلاحيات الجهة الحالية» (`:99`). **No revenue-source filter, no target version, no scenario, no cut-off control** — the reporting date is not shown in the filter bar (only inside tile labels and the basis note) [V].
* Budget line «الميزانية المبلغة للأبواب الثلاثة: 32.7 مليار» (`:101`) + «الميزانيات المحمّلة للعام المالي 2026 فقط.» (`:102`). Budgets exist for **2026 only** (`appropriations.js:6,30-33`): for any other year targets, forecast and map disappear («لا ميزانية مبلغة محمّلة للعام …», `:112`) [V].

## 2. Section «المستهدفات» (`TargetsPanel.jsx`, first section)
| On screen (AR) | What it is | Formula / function |
|---|---|---|
| «المستهدف السنوي للإيراد» **21.59 مليار** (`:59`) | sum over entities of `coverage × budget`; with override OFF = overall coverage × TOTAL budget (HQ included, 32,705 M) spread over entities by revenue-appropriation share | `entityTargets` `planTargets.js:94-101`, `totalTargets` `:40-44` |
| «مستهدف نسبة التغطية» 66.0 % (`:60`) | default overall input | `DEFAULT_OVERALL_COVERAGE = 0.66` (`planTargets.js:65`), illustrative |
| «مستهدف نسبة التحصيل» 68.0 % (`:61`) | default overall input, independent of coverage | `DEFAULT_OVERALL_COLLECTION = 0.68` (`:66`) |
| «الفوترة المطلوبة» **31.74 مليار** (`:62`) | `revenueTarget ÷ collectionRate` = 21,585.3 ÷ 0.68 = **31,743.1** M [V probe1] | `planTargets.js:102` |
| per-entity table (`:101-136`) | budget · coverage % · revenue target · collection % · required billing · collected to date · achievement | achievement = `collectedByKey[key] ÷ revenueTarget` — **annual achievement**, coloured by `PctBadge` (4 bands) |
| «التوزيع الشهري للمستهدف» (`:138-155`, collapsed) | monthly weights, default `1/12` each (`planTargets.js:10`); editable per entity | |
Target edits are saved on this device only (`saveTargetStore`, `TargetsPanel.jsx:33`), with `savedAt/savedBy` but **no version, owner, approval state or scenario** [V]. «دورك للقراءة فقط» for non-reviewers (`:98`).

## 3. KPI tiles (`PlanningArea.jsx:127-142`)
«الميزانية المبلغة للأبواب الثلاثة» · «المحصّل حتى 6 نوفمبر 2026» (**9.21 bn**, «منذ بداية السنة — بتاريخ الدفع») · «نسبة التغطية» (collected ÷ budget = 28.2 %) · «المستهدف السنوي للإيراد» (**repeats** the target already shown in section 2 — `g.target`) · «المتبقي للوصول إلى المستهدف» (`target − collected`, floor 0). `g.collected` = Σ `series.values`; the table's «المحصّل حتى اليوم» uses `snapshot.receivedInPeriod` — equal today (9,210,040,076 both, probe2) but built by two different loops (`engine.js:368` vs `:519`); they can diverge if a payment sits on an invoice that has an exclusion mask (**D15, latent**) [V code / equal today].

## 4. «أين نحن من الخطة» (`PlanForecast.jsx`)
### 4.1 Chart (`:38-39`) [V]
`UnitLines` (own Chart.js wrapper, not the shared chart library) with three cumulative series: «المستهدف (الخطة)» = **month-end** cumulative plan; «التقدير (متوسط آخر 3 أشهر)» from the last actual point on; «الفعلي». Note: the plan line is month-end while the last actual point is at 6 Nov — they are not comparable on the same x position. The tag «تقدير تجريبي – للعرض التوضيحي» (`:36`).

### 4.2 Year-end estimate — `forecastYear` (`planForecast.js:24-59`) [V]
```
closed = m − 1  (12 if year ended)                         m = reporting month (11)
base   = last ≤3 closed months (Aug, Sep, Oct = 757.43, 898.92, 1139.66)   → avg = 932.00, spread = SD = 193.25
        (closed = 0: base = [actual[0] ÷ max(dayFraction, 0.1)], spread = 25 % of avg)
estCum[k] = actualCum for k < closed;  estCum[closed] = cum(closed) + max(actual[closed], avg);  later months + avg
forecast  = estCum[11] = 9,084.10 + max(125.94, 932.00) + 932.00 = 10,948.10
```
No seasonality, no scenario, no recovery assumption, no per-entity forecast. The page never prints «last 3 months = Aug–Oct», the average or the SD (the tag tooltip says «متوسط التحصيل الشهري لآخر ثلاثة أشهر مغلقة»).

### 4.3 Probability tile — **how exactly the «1 %» is produced** [V, probe1/probe3]
`PlanForecast.jsx:46-47` shows `pc(F.probability, 0)`; `planForecast.js:38-43`:
```
monthsLeft = 12 − closed = 2          (the current, partly elapsed month counts as a whole month)
sdTotal    = spread × √monthsLeft = 193.25 × 1.414 = 273.3
z          = (target − forecast) ÷ sdTotal = (22,893.5 − 10,948.1) ÷ 273.3 = 43.7     (66 % default: 38.9)
p          = clamp(1 − Φ(z), 0.01, 0.99)  →  Φ-tail ≈ 0  →  clamped to 0.01  →  «1%»
```
Therefore the tile is **the lower clamp**, not an estimate: for any z above ≈ 2.33 it prints 1 %. It is built from three monthly values (SD of 3 points), it assumes independent normal months, it ignores seasonality, the uncertainty of the mean, the partial month, and one-off payments. The colour (`:20`) is green ≥ 70 %, amber ≥ 35 %, red below — thresholds with no basis, giving a verdict colour to a non-probability. The dictionary documents the formula (`dictionaryDocs.js:162`) but not that 1 % is a floor. (`docs/sh-review/01` said «z = 2.0 → 2 %»: that came from a different input; on the current basis z is 39–44 at every non-early date — probe3.) **Verdict: not a probability (§5 of the request); see 05.**

### 4.4 Deviation tile — «الانحراف عن المستهدف حتى تاريخه» (`:50-54`) [V]
`plannedToDate` (`planForecast.js:44`) = `cum[m−2] + (cum[m−1] − cum[m−2]) × day/dim`; with even weights at 6 Nov: `10/12 + (1/12)(6/30) = 0.85` × target. `deviation = collected − plannedToDate` (−10,249.43), `deviationPct = deviation ÷ plannedToDate` (−52.67 %); sign printed by `sgn`, subtitle «الفعلي 9.21 مليار مقابل المخطط 19.46 مليار». Formula is the one requested in §4 of the spec — **but** the «planned» is an **assumed equal split that the page never labels as an assumption** (`collectionGoal.js:10-13` promised «each is stated on screen»; `g.plan.source` is never read in the UI, and is always `'saved'` because `PlanningArea.jsx:60` always passes `plan`). No status text («متقدم/متأخر/وفق الخطة»), no tolerance, no cut-off in the tile itself.

### 4.5 «أين نركز» (`:59-63`, `planForecast.js:62-65`) [V]
`focusRanking(cells, targetRate, 5)`: for each entity × source **cell of the 2026-issued invoices**, `rate = collected ÷ net`, `shortfall = max(0, 0.68 − rate)`, `score = outstanding × (shortfall or 0.02)`; top 5 by score. Text (AR): «التركيز على {المصدر} في {الأمانة}: رصيد غير محصّل {…} ونسبة تحصيل {…}.» No link per line (one link at the bottom to `/collection`), no action, no reason, no recoverable amount, no age/due/blocker. Cell sum = 3,889.54 M (the 2026 cohort), while the all-time stock is 8,322.67 M; the five lines total 2,345 M = 28.2 % of the stock (probe2). Evidence in 07.

### 4.6 «مبررات عدم تحقيق المستهدف» (`:65-68`, reasons `planForecast.js:49-57`) [V]
Heading flips to «مبررات تحقيق المستهدف» when nothing is missed. Two rule-generated sentences:
* `billing_insufficient` (`:26`): «حتى مع تحصيل 100% من الرصيد القائم والفوترة المتوقعة لن يتحقق المستهدف لأن الفوترة غير كافية: الحد الأقصى الممكن 19.74 مليار ريال، والفجوة 3.15 مليار ريال.» with `maxTotal = collected + standing + avgBilling × monthsLeft` = 9,210.04 + 8,322.67 + 1,103.66 × 2 = **19,740.0** M and `gap = target − maxTotal`.
* `pace_short` (`:27`): «وتيرة التحصيل الحالية (932 مليون شهريًا) أقل من المطلوب (6.84 مليار شهريًا)؛ التقدير يبلغ السنة بفجوة 11.95 مليار.»
Both claim a **cause** («billing is insufficient») from arithmetic; the two gaps (3.15 and 11.95) are different quantities on the same screen and look additive. «Reasons the target may be missed» presumes the outcome. Evidence in 02/07.

### 4.7 Footnote (`:70`) [V]
«يُعاد التقدير كل شهر عند وصول الفعلي. وهو عرض توضيحي لأسلوب العمل وليس نموذجًا معتمدًا.» — honest, but it sits beside a percentage tile coloured as a verdict.

## 5. Map + reconciliation table (`EntityMap.jsx`) [V]
* Title «قراءة جغرافية: أين التحصيل؟» (`:73`); two measures, default «نسبة تحقق المستهدف (المحصّل ÷ المستهدف)» and «المحصّل» (`:42`); reading note «اللون والرقم: نسبة تحقق المستهدف؛ الرقم لا يُكتب فوق 100%» (`:43`).
* Colours: red < 40 % · orange 40–<60 % · yellow 60–<80 % · green ≥ 80 % (`:10-13`) applied to **annual achievement** (collected ÷ annual target) — time-agnostic: 6 % in February and 42 % in November are both red/orange although each may be on plan; it never says ahead/behind the expected position at the reporting date [V].
* Regions = sums of Amanahs (`ksaProvinces.js`: Makkah region = Jeddah+Makkah+Taif; Eastern = Eastern+Al-Ahsa+Hafr Al-Batin; 13 regions, 17 Amanahs). Housing Sector (card «نطاق مستقل عن المناطق») and HQ are **outside** the map and listed beside it; the table «المناطق + ما هو خارجها = إجمالي الوزارة» adds up (regions 19,482 / 8,421 + housing 2,103 / 789 + HQ 0 = 21,585 / 9,210 at 66 %) with a remainder row «جهات أخرى» if anything is missing (`:57-66`) — **mapping and aggregation are sound; national % = Σ collected ÷ Σ target** (`:20,48`) [V]. Wording is stale: «والباقي (قطاع الإسكان وغير المحدد والديوان)» (`:92`) mentions «غير المحدد», an entity that no longer exists (D11).
* With an Amanah selected the map still shows the whole Ministry (rows from `byAmanah` of the all-entity snapshot, `planInputs.js:11`) while forecast/tiles follow the Amanah — the map is not scoped to the selection except by highlighting [V].

## 6. Shared pieces it already uses
`MetricTile`, `LocalFilterToolbar`, `AsyncBlock`, `PctBadge` (and its colour scale is **shared** with the dashboard: `RevenueAnalysis.jsx:11`), `ProvinceMap`. It does **not** use the shared chart library (`PageChart`, kinds `bullet`, `hbar`, `waterfall`, `combo` — `docs/chart-library.md`).

## 7. Other consumers of the same numbers [V]
| Consumer | Target it uses | Plan to date | Note |
|---|---|---|---|
| `/planning` | planning store: 66 % × 32,705 = 21,585 (default) | even `1/12`, day-prorated | this page |
| Decision Room `plan_deviation` (`decisionRoom.js:85-97`, `useDecisions.js:36-37`) | same store via `entityTargets`, **re-read from localStorage** | third copy of the plan-to-date formula (`decisionRoom.js:87`) | thresholds 10 % / 25 % (`decisionRoom.js:51,55`) |
| Dashboard `RevenueAnalysis` (`revenueAnalysis.js:75-85`) | `appropriationOf(key).revAdjusted` (Ministry **11,495 M**) | even, day-prorated | «نسبة تحقيق الاعتماد مقابل الإيراد»; on this basis the Ministry is at **80.1 %** of the year's appropriation vs 85 % time-proportional = **−561 M (−5.7 %)** while `/planning` says −9,137/−10,249 M (−49.8/−52.7 %) |
| Smart Reports / assistant / analysis (`DEFAULT_TARGETS`, `revenueMetrics.js:645-657`; `revenueOutlook.js`) | `collectionAmountAnnual = appropriationTotal().revAdjusted` = 11,495 M, status `demo`, **curved** monthly weights `[.05 … .10]` | curve, not even | labelled «المستهدف السنوي المعتمد (مُدخل توضيحي)» (`revenueInsights.js:364`) and «the approved annual target (a demo input…)» (`assistantAnswers.js:82`) while status is `demo` |
Exports: the dashboard export passes `forecast: not needed` (`dashboardReport.js:21`); the Fixed Reports and Smart Reports call `forecastReceipts` with `DEFAULT_TARGETS` (`FixedReports.jsx:26`). **No export contains the planning page's numbers**; the planning page itself has no export or print action [V].

## 8. Tests that cover planning [V]
`tests/platform.test.mjs`: `computeGoal`/`plannedToDate`/zero-target/future-year (`:1423-1465`), appropriations (`:1470-1535`), targets and overall/override (`:1705-1775`), `forecastYear` with an easy and an impossible target (`:1736-1748`), colour scale; `tests/decision-room.test.mjs:187-196,304` (plan items); `tests/filters-pages2.test.mjs:158-162` (`resolvePlanning`). **Not covered:** restricted-user target invariance, early-month extrapolation, year-end behaviour, required pace vs remaining days, probability wording/floor, map/table reconciliation with an edited target, planning-page integration, EN/AR parity of the page, export content.

## 9. Further defects and observations (all [V] unless marked)
| # | Finding | Evidence |
|---|---|---|
| D11 | stale word «غير المحدد» in the map note | `EntityMap.jsx:92` |
| D12 | saved-plan store `savePlan/rebasePlan/GOAL_KEY` and `g.pace`, `g.plan`, `g.versusPlan` are not used by any screen (dead code) | grep: only `collectionGoal.js` and tests |
| D13 | plan-to-date implemented three times (identical results at 6 Nov: 19,459.48) | `collectionGoal.js:30`, `planForecast.js:44`, `decisionRoom.js:87` |
| D14 | probability tile colour thresholds 70 % / 35 % | `PlanForecast.jsx:20` |
| D15 | collected by two loops (series vs snapshot) | `engine.js:368,519` |
| D16 | targets live in one browser's localStorage, read once at mount; the Decision Room re-reads them; no version/owner/approval | `PlanningArea.jsx:41`, `useDecisions.js:36` |
| D17 | cut-off = today; no data-freshness, no «latest complete period», current partial month is treated as the reporting month | `clock.js:30` |
| D18 | payments on invoices of the «أخرى» main class are outside the 9.21 bn (raw payment scan 9,563 M vs 9,210 M) — cause **[I]** from `engine.js:297-301` (D7 rule), not isolated | probe5 |
| D19 | the «المحصّل حتى …» (any invoice, by payment date) and the KPI «المحصّل» on the dashboard (period invoices) are different populations; the page says «بتاريخ الدفع» but does not name the other population | `PlanningArea.jsx:132`; bridge in 02 §2 |
| D20 | page title/«أين نحن من الخطة» has no scenario, driver, assumption list, target version, owner, model version (R3 of the SH review, confirmed) | `PlanForecast.jsx` whole file |
