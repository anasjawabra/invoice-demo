# 08 — Verification addendum (post chart library, 2026-11-06)

Agent R3 · REVIEW ONLY. Nothing in the application, tests, `package.json` or data was changed. Probes were bundled to unique `.test-build/_r3_*.mjs` files (deleted afterwards); their sources are kept in `scratch/r3/` (`probeM`, `probeRecon`, `probeCarry`, `probeTerm`, `probeNc`, `probePar`, `probeHist`, `probeDeck`, logs `test_*.log`, `probe*.json`).
Labels on every statement: **VERIFIED** (read or run — evidence given) · **RECOMMENDATION** · **SIMULATION** (illustrative) · **PENDING** (business alignment / external input) · **INFERRED** (follows from code, not observed).
All figures are the **synthetic demo baseline** (compact generated world, cut-off 2026-11-05 unless stated; the chart-matrix script uses its own 2026-10-09 world). No ministry figure appears here.
The working tree kept changing while I read (`assistantAnswers.js` was edited during the review — see §1); everything below was re-read at the time of writing.

Tests re-run by me (read-only, own bundles): `chart-integration` 29/29 · `chart-requests` 35/35 · `chart-picker-ui` 27 groups · `chart-export` 79 checks · `chart-catalog` 41 · `chart-data` 20 · `invoice-lists-ui` 28 — all pass (VERIFIED, logs in `scratch/r3/`).

---

## 1. Refresh of the current state — what the chart library and the collection-rate card changed

### 1.1 What changed in the platform (VERIFIED by reading the current code)

| Change | Where | Effect on R1's review |
|---|---|---|
| Shared chart library with picker «تغيير الرسم» / «تخصيص», per-chart saved choices `view.charts` | Dashboard `InsightsDashboard.jsx:79–81` (3 charts via `PageChart`), Non-collection analysis, Exclusions `Exclusions.jsx:157`, compact picker on `/invoices` and `/collection` summaries, Smart Reports (`ChartFrame`, `chartRequests.js`) | **Functionality only.** No figure, definition, population or label changed (a presentation change never refetches — `tests/chart-integration.test.mjs:328`). |
| Saved choices reach exports | Smart Reports `SmartReports.jsx:594–598` (`applyView` per version/language); dashboard `InsightsHub.jsx:21–23` (`withDashboardView`); NC `AnalysisResultPage.jsx:68` (`viewedModel`) | New capability; R1 had no row. |
| «سياق الفترة» panel on the Collected page replaced by compact card «نسبة التحصيل ضمن النطاق» | `src/components/invoices/CollectionRateCard.jsx`, `rateCardLogic.js`, used at `Invoices.jsx:144` | New: a **net-based** rate (Collected ÷ Net invoiced × 100) with denominators and a formula tooltip; `na` state instead of 0%; note that the register lists only paid/part-paid invoices (`CollectionRateCard.jsx` last `<p>`). Tested (`invoice-lists-ui` 28 pass, `rateParts` cases at `tests/invoice-lists-ui.test.mjs:148–155`). R1 did not cover this panel, so no R1 row became wrong. |

### 1.2 Which R1 findings / classes changed

| R1 item | R1 class | Now | Why (evidence) |
|---|---|---|---|
| Discoverability of a different view of the data (R5.* generally) | — | **new capability, not a gap** | Picker offers up to 9–11 types on aging/exclusions/by-Amanah charts (§3). It does **not** create an insight (see §2). |
| **R2.13** aging buckets (181–365, >1 year not split) | Partially | **Partially (unchanged class); exposure of the tail improved** | Aging chart still 5 buckets (`server/engine.js:314–315`). The picker now offers a **histogram of days overdue** (companion from `server/distributions.js`): probe `probeHist` → 60-day bins `1–60 … 721–780`, 138 overdue invoices, with count and amount per bin. So the >180-day tail is visible in finer slices (181–240: 12 invoices, 241–300: 18 … ) but the bins are **not** the requested 181–365 / >365 buckets (the 361–420 bin straddles 365), it is invoice **count** by default, and it is not on screen by default. GAP-R2-2 stays open. |
| R2.1 / R2.2 / GAP-R2-4 two outstanding totals | Partially | **unchanged** | §5: still two populations; the dashboard still never says «all periods» next to the aging chart. |
| R2.17 drill-through | Fully | **Fully, with a stated limit** | Changed charts map marks back to the page's own marks by label; folded «Other», flows, trees, scatters, histograms, boxes are **not clickable** (`tests/chart-integration.test.mjs:313`, `src/components/charts/chartDrill.js`). Browser verification of NC donut/pareto drill is recorded in `docs/chart-library.md` (screenshots exist: 22 `docs/screenshots/chart-*.jpg`; I did not re-run the browser). |
| R5.1 dashboard answers «likely to collect» / link to planning | Partially | **unchanged for the dashboard** | `grep /planning` in `src/components/insights`, `decisions`, `ExecutiveParts`: no hit. **Correction:** the uncollected list header **does** link to planning — «هدف التحصيل السنوي / Collection goal» `Collection.jsx:127`. R1 only recorded the dashboard. |
| Forecasts (R3.*) | Partially/Missing | **unchanged** | No forecast chart goes through the picker; Planning decided «not applicable» (`docs/chart-library.md` Platform integration). `PlanForecast.jsx:46` still reads «احتمالية تحقيق المستهدف». |
| R3.14 wording row — «assistantAnswers.js:82 … approved annual target (a demo input …)» | Partially | **stale reference, same defect elsewhere** | The phrase is no longer in `assistantAnswers.js` (line 82 is now the independent-forecast answer; the file was edited during this review). The «approved» + «demo input» pairing remains at `smartReport.js:101` («approved annual target (demo input …)»), `revenueInsights.js:364` (label «المستهدف السنوي المعتمد (مُدخل توضيحي)») and `revenueOutlook.js:4`. GAP-R3-3 still applies, evidence updated. |
| Aging in planning (`agingPlanning`) | «a third scheme (planning)» | **dead field** | `grep agingPlanning src server` → only `server/engine.js:460`; no consumer. It is not a user-visible third scheme today. |
| Dead components | — | **new finding** | `UncollectedBridge`, `PriorityDebt`, `ChangeExplanation` in `src/components/revenue/ExecutiveParts.jsx` are exported but imported nowhere (grep) — the old on-dashboard net-uncollected bridge is not shown. Relevant to §5 (no on-screen bridge between period cohort and standing balance). |
| R2.3 debtor missing from uncollected list | Partially | **unchanged** | `CoreInvoiceTable.jsx:78,97` still «Product» for the uncollected mode; payer only in collected mode. |
| R4.* prioritisation, R6 alignment, R7 examples, R1 slides, coordination actions | — | **unchanged** | Nothing in the chart library touches them. |
| Smart Reports forecast/priority inconsistency (GAP-R4-1) | Partially | **unchanged**, plus: the NC priority cards also print «Owner · deadline (suggested)» (`NcPriorities.jsx:30`) while the Decision Room deliberately has none. | |

---

## 2. Business usefulness, separate from chart functionality

A picker satisfies «choose a form». It does **not** satisfy SH point 5 («meaningful business insights, key issues, priorities, recommended actions»): every picker option shows the same numbers with the same (descriptive) title. Rating below looks only at what a default visualization **says**: Issue (a stated business problem), Priority (what first, and by what stated rule), Action (a recommended next step with a link). F = fully · P = partially · M = missing.

### 2.1 Default visualization ratings (VERIFIED by reading titles, subtitles, callouts, insight text, links)

| Page / default visualization | Issue | Priority | Action | Overall | Evidence |
|---|---|---|---|---|---|
| **Dashboard** — six KPI tiles | M | M | M | **Missing** (status only) | `InsightsDashboard.jsx:67–75`: labels + definitions («الصافي − المحصّل»); no threshold, colour verdict or link except gross → `/invoices`. |
| Dashboard — «من الإجمالي إلى المحصّل» (waterfall, share, aging) | P | M | M | **Partially** | Titles are descriptive («الرصيد غير المحصّل حسب العمر بعد الاستحقاق», `financialCharts.js:32`); the 180+ bar dominates visually but no callout says «X% is older than 180 days» (the statement exists only as an insight in `insightsEngine.js:106–117`, not on this section). |
| Dashboard — «الأداء عبر الزمن» (cumulative lines) | M | M | M | **Missing** | Basis text and «last point equals the cards» only (`InsightsDashboard.jsx:86–91`). |
| Dashboard — «تفصيل الأداء» (Amanah/source table, rate, change vs last year) | P | P | M | **Partially** | Collection rate column, change in pp, sort by size; rows click through to the Amanah; no statement of which entity is the problem. |
| Dashboard — geographic map | P | P | M | **Partially** | Colour bands (<40 % … ≥80 %) and legend; no sentence. |
| Dashboard — «أبرز ما يحتاج مراجعة» (Top findings) | F | F | P | **Fully** | `DecisionSummary.jsx:18–35`: item title (issue), affected entity, labelled amount, High/Medium/Low badge with its rule, follow-up flag; the proposed step is one click away in the Decision Room (not on the card). |
| **Strategic dashboard = Planning** (`/strategic` redirects to `/planning`) — tiles | P | M | M | **Partially** | Budget, collected-to-date, coverage, target, remaining; coverage tile coloured vs the target (`PctBadge`); no sentence. |
| Planning — target / estimate / actual chart + deviation tile | P | M | M | **Partially** | Deviation tile red/green (`PlanForecast.jsx:20,47`) states the issue numerically; labelled «تقدير تجريبي – للعرض التوضيحي». |
| Planning — «أين نركز» + reasons | P | P | P | **Partially** | Ranked entity × source lines with a recommended focus («التركيز على X في Y: رصيد غير محصّل …», `PlanForecast.jsx:61`) and rule-based reasons («billing_insufficient» / «pace_short», `:26–31`); rank rule (outstanding × shortfall) is not stated; link goes to the unfiltered `/collection`. |
| **Collected page** — KPI strip, source chart, rate card | M | M | M | **Missing — by design** (a register) | `Invoices.jsx:137–144`; the rate card states a fact («69.1 %») with its formula, nothing more. Acceptable for a register; not an insight page. |
| **Uncollected page** — KPI strip (3 populations), source chart, due-position bar | P | F (per invoice) | P | **Partially** | Strip defines the populations (`listLogic.js:142`); due bar shows the overdue share; priority column + badge with factors per invoice; sort «الأولوية»; recommended next step is inside each row's details; primary button «تحليل أسباب عدم التحصيل» (`Collection.jsx` head). No page-level sentence on the biggest exposure. |
| **Non-collection analysis** — executive summary, KPIs, priorities, management questions | F | F | F | **Fully** | `NcOverview.jsx:13` (summary lines with fact tags), `NcPriorities.jsx:68–78` (ranked action groups: amount, longest overdue, evidence, what is missing, **proposed next step**, «suggested» tags, drill to invoices, «no composite score»). Overview charts alone: P (descriptive notes). |
| **Exclusions** — chart by effective reason | P | M | M | **Partially / register** | Note says bars add up to the total (`exclusionsChart.js:19`); a bar selects the reason; no recommendation. |
| **Decision Room** — charts, ranked items, analysis | F | F | F | **Fully** | Issue question, labelled measure, thresholds, facts/calculated/unknown/proposed, evidence, flag/note/audit (R1 §D2; 24+13 tests). Charts there are filters of the queue (no picker, decided). |
| **Smart Reports default (summary) report** | F | P | F | **Fully / Partially** | Default spec `sections: ['executive']` (`reportIntents.js:39`) → summary text, KPIs, 2 charts, «أبرز النتائج والرؤى» (typed insights) and «التوصيات المدعومة بالأدلة (مقترحات)» (`reportModel.js:129,138,298–299`). Priority label comes from the legacy score (High if ≥ 0.6) — inconsistent with the list/Decision Room tiers (GAP-R4-1). |

**Reading.** Issue/priority/action are satisfied where the platform builds **text from the item model** (Decision Room, Top findings, NC priorities, Smart Reports insights). They are missing on the **chart-led surfaces** — exactly the surfaces the chart picker decorates (dashboard flow charts, trend, exclusions, summaries). RECOMMENDATION: reuse the existing insight engine output as ONE sentence under each default dashboard chart (e.g. the aging insight already typed «fact» in `insightsEngine.js:106–117`) and link it to the Decision Room item with the same basis — no new chart, no new calculation.

### 2.2 Forecasting — separate from charts

| Aspect | Status | Evidence |
|---|---|---|
| Method on `/planning` | **SIMULATION** — run-rate: collected-to-date + max(current month, mean of last ≤ 3 closed months) + mean × remaining months | `planForecast.js:24–47`; tag «تقدير تجريبي – للعرض التوضيحي» and footnote «not an approved model» (`PlanForecast.jsx`, last paragraph) |
| «Probability of reaching the target» | **Overclaim risk** — a normal-tail statistic from ≤ 3 monthly points, clamped to 1–99 %, shown as a tile «احتمالية …» and **colour-coded** green/amber/red at 70 % / 35 % (`PlanForecast.jsx:20`) | `planForecast.js:38–43`; the colour turns an unvalidated statistic into a verdict. RECOMMENDATION: relabel «حساسية تقدير نهاية السنة للمستهدف (توضيحي)», remove the traffic-light, or hide until alignment (R6). |
| Validation | **None.** Synthetic data cannot validate accuracy; Smart Reports' own backtest (MAPE ≈ 142 %, n = 6, R1 §B2) says so; the planning page shows no backtest | PENDING — ACs of HLSD V0.6 AC-10 |
| Ceiling | «Even with 100 % collection of the balance owed …» (`PlanForecast.jsx:26`): standing balance assumes full recovery of a balance that is 74 % older than 180 days (R1 §B3); the page never says how old | RECOMMENDATION: add the aged share to the reason line (the figure exists: `stock.aging`) |
| Assumptions / drivers / scenarios / version / horizon | **Missing** on `/planning` (GAP-R3-1, GAP-R3-5) | unchanged from R1 |
| Two methods, two target sources | still true (run-rate vs OLS; planning store vs `DEFAULT_TARGETS`) | R1 GAP-R3-4 |
| Gap vs SH 3 (annual revenue, assumptions, drivers, actions) | Partially: expected annual revenue yes (illustrative); assumptions/drivers no; actions = «أين نركز» | |
| Gap vs SH 6 (alignment with Dr. Muath / Abdulmajeed) | **PENDING**, nothing local to align with (00 §3) | |

### 2.3 Collection prioritisation — separate from charts

* **Rules-based, explainable** (VERIFIED, R1 §C): High/Medium/Low from amount tier × age tier with evidence-quality and objection caps (`lists.js:334 priorityCore`); no score displayed; Decision Room factors with thresholds. **Validated: nothing** — a priority is a follow-up order, not a probability (project rule respected in the UI).
* **Illustrative / not validated:** none of the tiers has a back-test against payment outcomes (data absent, D-8).
* **Wording that overclaims:** the official decks (SH #09 slide 9, intro deck slide 3) say the system «يعالج احتمالية تحصيل كل فاتورة …» — not implemented; the planning «probability» tile (above); the Smart Reports label «High» from a numeric score (`smartReport.js:119`) next to list tiers.
* **Gap vs SH 4** (payment delays, collection probabilities, aging, recoverability): delays = days overdue (yes), aging (5 buckets, histogram on request), **probability / recoverability: not available and must be stated as such** (GAP-R4-2, unchanged).
* **Gap vs SH 3/6 link:** the chart library adds no input to either.

### 2.4 The SH journey mapped to the existing screens

| Step | Screens that answer it | Strength |
|---|---|---|
| 1 What is owed | Dashboard tiles (period cohort) + aging chart (standing); `/collection` strip; NC populations | **Partially** — right numbers, two populations not tied on the dashboard (§5) |
| 2 Who owes it | Amanah/municipality/source breakdowns (managing entity); payer only in the **collected** list, invoice page, NC invoices | **Weak** — payer absent from the uncollected list and CSV, no debtor aggregation (GAP-R2-1); **fixable now: the data exists** |
| 3 What we expect to collect | `/planning` forecast (illustrative); Smart Reports trend forecast (callout, not an approved projection) | **Weakest** — separate page, no link from the dashboard, no assumptions/drivers/method/version, bare «probability»; cannot be completed without PENDING inputs (00 §3) |
| 4 What needs attention | Top findings, Decision Room, NC priorities, uncollected priority column | **Strongest** (Fully) |
| 5 What actions we should take | Decision Room proposed steps + follow-up; NC next steps; Smart Reports recommendations; «أين نركز» | **Partially** — Fully in the Decision Room; three different owner/deadline conventions elsewhere (GAP-R4-1) |

**Weakest step: 3 («what we expect to collect»)** for business credibility; **step 2 is the weakest step that can be improved without external input.** (Assessment of the existing screens; RECOMMENDATION only.)

---

## 3. Chart support reconciliation

### 3.1 What the numbers mean (VERIFIED: `scripts/chart-support-matrix.mjs:99–106`, `src/data/chartCatalog.js:44–48`, `tests/chart-integration.test.mjs:57–91`)

| Number | Definition in code |
|---|---|
| **24 catalog types** | `CHART_TYPES` = 24 ids (`chartCatalog.js:64–87`). `line` and `line_markers` are two ids of the same renderer kind (`line` + `markers`), so there are **23 renderer kinds**. |
| **13 implemented** | `status = 'implemented'` when: every proof passes (renderer registered, preview drawn, AR + EN drawing, table text, PDF html, PowerPoint mode = declared, Word = `png`) **and** the type is offered on **at least one** real chart of the synthetic world **and** its catalog `needs` carries **no `alts`** companion. |
| **9 data-dependent** | same proofs, offered on ≥ 1 real chart, **and** `needs.alts` is set (it relies on a saved companion dataset). |
| **2 unavailable-in-demo** | proofs pass but **no** chart of any of the 5 measured pages offers it (`offeredOn` empty). |

Reproduced by running the matrix (`probeM`): implemented 13 = bar, hbar, stacked_col, stacked_hbar, stacked100_col, stacked100_hbar, line, line_markers, area, combo, pie, donut, pareto; data-dependent 9 = waterfall, treemap, sunburst, heatmap, scatter, bubble, histogram, box, sankey; unavailable 2 = stacked_area, bullet. Pages measured: Smart Reports 16 charts (the **detailed** report with all sections), Dashboard 3, NC 7, Exclusions 1, Invoice summaries 2 (compact).

### 3.2 Consequences — what the statuses do NOT say (VERIFIED)

1. **«Implemented» ≠ available on every chart.** It means «offered somewhere». `combo` is offered on **2** of 16 Smart Reports charts only (the two monthly charts) and on no other page; `stacked_*` on 2 charts (collected/uncollected share, due position); `line` on 4.
2. **«Data-dependent» is not a uniform concept.** `waterfall` and `heatmap` are «data-dependent» only because their `needs` carry an `alts` key; in practice they are offered **only on blocks that already are a waterfall / heat map** (the current type is always available) and **no other chart can become one** (reasons: «A waterfall comes from a reconciliation saved in the report; it is not derived from bars»). They are not conversion targets at all. Conversely `treemap` and `scatter` are labelled `alts.treemap` / `alts.scatter` but are offered on charts **without** any companion (flat single series → treemap on Exclusions/summaries; two series → scatter on the monthly chart) — column «Data it depends on» shows only the first route.
3. **The reason quoted for `stacked_area` is not its reason.** `unavailableWhy` is the **first** reason found over all blocks (`why[lang][u.id] ||= …`, `chart-support-matrix.mjs:89`), and the first non-waterfall block is `executive:1` (collected/uncollected, unordered) → «This axis has no meaningful order (categories such as Amanahs …)». Per-block reasons (`probeM`): executive:1 / due position → no meaningful order; monthly + by-Amanah + by-source → «not non-overlapping parts of one whole (net billed and collected overlap, for example) … collected + uncollected would be fine»; aging and every single-series chart → «Needs two or more series». The true statement is: **no real chart is simultaneously ordered, additive and multi-series**. The hint «collected + uncollected would be fine» shows a monthly collected + uncollected-by-issue-month chart *could* exist (INFERRED: `byMonth` carries net and collected; uncollected = net − collected is additive) — so `unavailable-in-demo` for stacked area is a **chart-builder gap, not a data impossibility**. The test only asserts the bullet reason text (`chart-integration.test.mjs:67–73`), so the misattribution is not guarded.
4. **`bullet`** is correctly unavailable (no approved target; every demo target is `status:'demo'`) and its reason is right (VERIFIED `NEEDS_TEXT.bullet`, test line 100).
5. **Pareto on ordered axes contradicts the sort rule.** The doc/catalog say a sort never applies to an ordered axis (`bar` + sort on the aging chart → «Sorting does not apply to a time or ordered axis», `probePar`), yet `pareto` is offered on the aging charts (Dashboard, NC, Smart Reports) and **re-orders the age buckets** (Over 180 → 31–90 → Not yet due → 91–180 → 1–30) with the cumulative-share caption. The change message discloses «sorted descending», but «80 % reached by N buckets» over age buckets has no meaning. RECOMMENDATION: refuse `pareto` when `dim.ordered`; acceptance: `evaluateChart(aging,'pareto').ok === false` with a reason in both languages, and the matrix test lists pareto's pages without any aging chart.
6. **Top-N charts without a stated whole accept share-of-whole types.** NC «Overdue by Amanah (top 10)» (`nc_exposure:1`, `dim.additive:false`, no `dim.whole`) is offered donut / pareto / pie / treemap (`probeNc`): shares and cumulative % are of the **top-10 subtotal**, not of total overdue (INFERRED from the absence of `whole`; the donut change message says «the total is unchanged»). RECOMMENDATION: give the builder a `whole` (total overdue) so the donut folds the rest into «Other (rest of total)» as the invoice summaries already do, or hide share types.
7. **The matrix is measured on one world** (`TODAY = '2026-10-09'`, compact synthetic, national scope, all report sections). Availability in the live app depends on the scope: a restricted or narrow scope can remove companions (≥ 3 entities for scatter, n ≥ 5 per box group, ≥ 2 parts for donut — e.g. NC reasons offer only bar/hbar because the synthetic world has a single non-zero reason). The **default** Smart Report (summary) carries 2 charts (`executive:0/1`), so it offers only waterfall/sankey and the share family.
8. The exclusions **page** chart is a plain block (no `alts`), while Smart Reports' «Exclusions by reason» chart carries `sankey` and `byAmanah` companions: the same figures, different options by page (`probeM`).

### 3.3 The 24-row reconciliation table

Columns: (a) catalog (purpose; `more` = under «مخططات أخرى») · (b) required data (`needs`) · (c) offered in today's demo — counts are charts offering the type / charts on the page; «not offered» lists charts that do NOT offer it and the reason (from `probeM`) · (d) export: PDF = vector SVG (all types) · Word = PNG of the SVG + table (all types; PNG rasterised in the browser, not pixel-tested) · PowerPoint = declared mode (`PPTX_SUPPORT`; a block-level `nativeBlocker` can force a picture, `pptxCharts.js:214–224`) · Excel/CSV = table (all types).

| # | Type | (a) catalog | (b) required data | (c) demo availability | (d) PowerPoint |
|---|---|---|---|---|---|
| 1 | `bar` | comparison | category × series, one unit | SR 12/16 · Dash 2/3 · NC 5/7 · Excl 1/1 · Sum 2/2. Not: waterfalls (4), heat maps (3) — «never converted» | native |
| 2 | `hbar` | comparison | same | same as `bar` | native |
| 3 | `stacked_col` | composition | ≥ 2 **additive** series, no negatives | SR 2 · Dash 1 · NC 1 (collected/uncollected share; due position). Not: single-series charts («needs two or more series»); monthly / Amanah / source («net billed and collected overlap») | native |
| 4 | `stacked_hbar` | composition | same | same | native |
| 5 | `stacked100_col` | composition (more) | same + non-zero total per category | same | native |
| 6 | `stacked100_hbar` | composition (more) | same | same | native |
| 7 | `line` | trend | ordered axis, ≥ 2 points | SR 4 (2 monthly + 2 aging) · Dash 1 (aging) · NC 1 (aging). Not: unordered breakdowns («no meaningful order») | native |
| 8 | `line_markers` | trend | same | same | native |
| 9 | `area` | trend | ordered, one series, no gaps/negatives | SR 2 · Dash 1 · NC 1 (aging only). Not: the monthly charts (2–3 overlapping series) | native (picture if a value is missing) |
| 10 | `stacked_area` | composition | ordered **and** additive, ≥ 2 series | **none** — no real chart is ordered + additive + multi-series (§3.2 #3; matrix text shows the wrong reason) | native (picture if a value is missing) |
| 11 | `combo` | comparison (more) | ordered, ≥ 2 series, ≤ 2 units | SR 2 (monthly charts only). Not: Dashboard / NC / Exclusions / summaries | native |
| 12 | `waterfall` | composition | saved reconciliation only | own blocks only: SR 2 · Dash 1 · NC 1; never a conversion target (§3.2 #2) | native (signed steps if the running total crosses zero) |
| 13 | `pie` | composition | one non-negative single series of parts of ONE whole (≥ 2 parts; > 8 → 7 + Other) | SR 7 · Dash 2 · NC 4 · Excl 1 · Sum 2. Not: multi-series overlapping charts, trends | native |
| 14 | `donut` | composition | same | same as `pie` | native (picture if > 8 parts) |
| 15 | `treemap` | composition (more) | flat single series **or** saved additive tree | SR 6 · Dash 1 (aging) · NC 3 · Excl 1 · Sum 2. Not: waterfalls, share bar, monthly, heat maps, NC reasons (single reason) | vector-image + table |
| 16 | `sunburst` | composition (more) | saved 2–3-level additive tree | SR 2 (by-Amanah, NC Amanah overdue) · NC 1. Not: Dashboard, Exclusions, summaries (no hierarchy companion) | vector-image + table |
| 17 | `heatmap` | comparison | matrix block (`alts.heatmap` / one measure × two dimensions) | own blocks only: SR 2 · NC 1 (never a conversion target) | native shaded table |
| 18 | `scatter` | relationship | ≥ 2 measures with ≥ 3 complete categories, or saved points | SR 3 (monthly, by-Amanah, by-source). Not: Dashboard, NC, Exclusions, summaries | native |
| 19 | `bubble` | relationship (more) | + size measure / saved points | SR 2 (by-Amanah, by-source) | native |
| 20 | `histogram` | distribution (more) | saved bins from `distributions` payload | SR 4 · Dash 1 · NC 1 (aging-age, by-Amanah, by-source). Not: Exclusions, summaries, NC Amanah/source overdue (no distribution) | native |
| 21 | `box` | distribution (more) | saved quartiles, group n ≥ 5 | same as histogram | vector-image + table |
| 22 | `pareto` | comparison (more) | one non-negative series, ≥ 3 categories | SR 5 · Dash 1 · NC 3 · Excl 1 · Sum 2 — **also on the ordered aging charts, contrary to the sort rule** (§3.2 #5) | native (picture if negative/missing) |
| 23 | `bullet` | comparison (more) | saved bullets with an **approved** target | **none** — every target is `status:'demo'` (reason correct) | vector-image + table |
| 24 | `sankey` | composition (more) | saved reconciling flow | SR 3 · Dash 1 · NC 1 (gross→net bridges, exclusions by reason in Smart Reports only). Not: the Exclusions **page** chart (no companion), other charts | vector-image + table |

Export columns common to all 24 (VERIFIED by `WORD_SUPPORT`, `PDF_SUPPORT`, `chartExportData.js` and the matrix proofs): PDF vector SVG with data table; Word PNG + table; Excel/CSV table with exact SAR; the PowerPoint appendix carries the table for every picture fallback. PowerPoint counts: 18 native (incl. line_markers and waterfall), 5 vector-image (treemap, sunburst, box, bullet, sankey), 1 native table (heatmap) — equals the document summary (`docs/chart-library.md` final status). **PowerPoint's own rendering of any of them was not observed** (§4).

---

## 4. The placeholder PNG in Node exports

### 4.1 Which real user paths run where (VERIFIED by code)

| Path | Rasteriser | Result |
|---|---|---|
| Browser: `exportModelToPptx` (`exportReportModel.js:150–153`) → `buildTemplatePptx(…, { rasterize: rasterizeSvg(svg,w,h,2) })`; reached from **Smart Reports** export (`SmartReports.jsx:404,540` via `exportModel`), the **export dialog** (`ExportDialog.jsx:63`) used by Smart Reports versions, the dashboard export and the NC page export, and `FixedReports.jsx:38` | canvas (`pptxTemplate.js:132–142`; the chart SVG carries explicit `width`/`height`, `chartDraw.js:88`) | real 2× PNG fallback + the SVG |
| Node scripts without `opts.rasterize`: `scripts/make-report-deck.mjs:26`, `scripts/make-nc-report.mjs:30`, `scripts/export-parity.mjs:86`, and all Node tests (`tests/chart-export.test.mjs`, `nc-report.test.mjs`, `platform.test.mjs`) | none | SVG + **1×1 placeholder PNG** (`pptxTemplate.js:130,240`) |
| `scripts/make-chart-decks.mjs:53` | headless Chromium if found | real PNG, else placeholder (script prints which) |
| There is **no server / API path** that builds a PowerPoint (`grep pptx server api` → none). | | |

**Is there a real user flow that produces a placeholder?** Not in the normal browser path. **Yes in one silent failure path**: `rasterizeSvg` returns `null` when `document`/`Image` is missing, the SVG fails to load as an image, `toBlob` is null, or any exception (`pptxTemplate.js:132–142`), and `assembleDeck` then writes `png || PLACEHOLDER_PNG` with `real: false` — **the flag is collected (`picJobs`) but never read**, so the user gets no warning (VERIFIED). No test exercises the in-browser failure. Also, **any deck produced by the offline scripts above** (including handover / demonstration decks built by script rather than exported from the browser) carries placeholders for its picture slides (treemap, sunburst, box, bullet, sankey) — whether such decks were delivered to anyone is not known (PENDING).

### 4.2 What a viewer shows

| Viewer | Status |
|---|---|
| **LibreOffice 26.2.5.2 (this machine)** | **VERIFIED by observation:** I built a deck without a rasteriser (`scratch/r3/placeholder-deck.pptx`, media `chartimg1.png` = 70 bytes) and converted it with `soffice --headless`; the treemap slide shows the full drawing (rendered from the SVG, not a blank frame) (`scratch/r3/lo/ph-03.png`). |
| PowerPoint 2016+/365 | **UNVERIFIED.** The document states «PowerPoint 2016+/365 draws the SVG, older viewers show an empty frame» (`docs/chart-library.md` PNG fallback) — an expectation based on the documented `asvg:svgBlip` extension, **not an observation**. Microsoft PowerPoint was never opened (the doc says so). |
| Older PowerPoint (≤ 2013), Keynote, Google Slides | **UNVERIFIED.** Viewers that do not read `svgBlip` would use the `a:blip` PNG, i.e. the 1×1 image stretched to the frame (INFERRED from the OOXML structure; not observed). |

### 4.3 Assessment and refinement

* **Limitation, not a defect of the browser flow.** The structural tests prove the package; they cannot prove pixels (stated by the tests' header and the doc).
* The only justified refinement is **making the silent fallback visible**: when `rasterize` returns `null` for any picture, surface a one-line warning in the export dialog («الصور البديلة غير متاحة في هذا المتصفح»), because `picJobs[].real` already exists. RECOMMENDATION. Acceptance test (Node-level, existing pattern): `buildTemplatePptx(model, tpl, { rasterize: async () => null })` returns a result (or an `onWarning` callback / return field) listing the picture count with a placeholder; `{ rasterize: async () => someValidPng }` lists none; a PNG larger than 1×1 is asserted in the second case. A pixel assertion in a headless browser would be the only real proof for the browser path — **PENDING** (not buildable in the current Node test runner).
* A human check in Microsoft PowerPoint (open a browser-exported deck with a treemap and a sankey; confirm the picture is the drawing, not an empty frame) remains **UNVERIFIABLE by this review**.

---

## 5. Reconciling the totals (synthetic, cut-off 2026-11-05, national, period 2026-01-01 → cut-off)

Method: `scratch/r3/probeRecon.mjs`, `probeCarry.mjs` (read-only; `loadStore` / `snapshot` / `list` / `nonCollectionAnalysis` / `bridge` of `server/`), run for national, Jeddah Amanah and Riyadh Amanah. **VERIFIED to the exact SAR** unless stated.

### 5.1 The figures

| Figure | Page(s) | Population | Date basis | Filters / definition | Value (SAR) |
|---|---|---|---|---|---|
| **Period uncollected** (tile «غير المحصّل») | Dashboard tile `InsightsDashboard.jsx:72` | invoices **issued in the period** (419; 92 with a net balance) | membership: issue date; balance at the cut-off (`collectionsAsOf='periodEnd'` = cut-off here) | net of approved exclusions, cancelled out; partly paid = remainder | **3,889,535,253** (`snapshot.totals.outstanding`) |
| = Net unpaid | `/collection` strip «صافي غير المحصّل بعد الاستبعاد المعتمد»; NC `populations.netUnpaid` | same period cohort | same | `list(state=uncollected).sums.outstanding`; NC check `net_eq_snapshot_outstanding` true | 3,889,535,253 (identical) |
| Total unpaid (excluded included) / excluded unpaid | `/collection` strip; NC `unpaidGross` / `excludedUnpaid` | period cohort (145 invoices, 53 excluded) | same | gross unpaid = net + excluded | 6,582,161,993 = 3,889,535,253 + 2,692,626,740 |
| Due position (period) | `/collection` bar (`Collection.jsx:140`), NC due chart | period cohort, net | days past due + grace at the cut-off | overdue / not yet due / unknown | 3,309,903,873 (73) / 579,631,380 (19) / 0 = 3,889,535,253 |
| **Standing balance** (aging chart total, Smart Reports aging, `stock`) | Dashboard aging chart (`financialCharts.js:28`), SR aging section, Decision Room aged items, Planning input `planInputs.js:17`, NC `standingBalance` | **every invoice issued up to the cut-off, any period** (921 issued; 157 with a net balance) | issue ≤ cut-off; age = cut-off − (due + grace) | same exclusions; **period filter ignored**; Amanah/source/municipality/org scope kept | **8,322,669,724** (`stock.netUncollected`) |
| Standing overdue / not yet due | same | same | same | `overdue + notYetDue = standing` | 7,743,038,344 / 579,631,380 |
| Aging buckets (standing, dashboard) | Dashboard aging chart | standing | same | 5 buckets | 579,631,380 · 412,512,974 · 322,022,040 · 824,013,446 · **6,184,489,884** (Σ = 8,322,669,724) |
| Aging buckets (period, NC) | NC aging tab | period cohort | same | 5 buckets + unavailable | 579,631,380 · 412,512,974 · 322,022,040 · 824,013,446 · **1,751,355,413** (Σ = 3,889,535,253) |
| `agingPlanning` (3 cut points) | none (dead field) | standing | same | current · 1–30 · 31–60 · 61–90 · 90+ | Σ 8,322,669,724; 90+ = 7,008,503,330 = 824,013,446 + 6,184,489,884 |
| Standing via list «all periods» | `/collection` with the period widened (`filters.allPeriods`) | standing (293 invoices incl. 136 excluded) | same | `sums.outstanding`; excluded part 6,971,786,300 | 8,322,669,724 (identical) |
| Planning «أين نركز» «رصيد غير محصّل» | `PlanForecast.jsx:61` | period cohort (`matrix.amanahSource`) | same | Σ cells | **3,889,535,253** |
| Planning ceiling «100 % of the balance owed» | `PlanForecast.jsx:26` | standing (`standingUncollected`) | same | approved rules only (`planInputs.js:5`) | 8,322,669,724 (+ billing × months left) |
| Collected tile | Dashboard | period invoices | payments up to cut-off | capped at billed; overpayment apart | 8,715,793,497 |
| Planning «collected to date» | `/planning` | **any invoice**, payment dated in the year | payment date | | 9,210,040,076 |

### 5.2 Bridges and verdicts

| Pair | Verdict | Verified arithmetic | Labelled on screen? |
|---|---|---|---|
| **Tile 3.89 bn ↔ aging chart / standing 8.32 bn** (R1's main question) | **Explained by population + date basis — verified to 0.0 SAR.** Standing = period cohort + invoices issued **before 2026-01-01** still owing. | 3,889,535,253 + **4,433,134,471** (65 pre-2026 invoices, all overdue; summed from the list rows by issue date) = 8,322,669,724, difference **0.0**. Same for Jeddah Amanah (976,074,400 + 1,028,733,214 = 2,004,807,614) and Riyadh Amanah (154,511,018 + 164,823,545 = 319,334,563). Also: 6,184,489,884 − 1,751,355,413 = 4,433,134,471 (the whole carry-over sits in the 180+ bucket). | **Insufficient on the Dashboard** — no text says «all periods»; tile sub «الصافي − المحصّل»; aging title «الرصيد غير المحصّل حسب العمر بعد الاستحقاق» (`financialCharts.js:32`); the `dim.whole` label «الرصيد القائم» is read only on pie/donut/treemap conversion (`chartConfig.js:363,399`). **Clear elsewhere:** Smart Reports callout «رصيد قائم وليس غير محصّل الفترة: كل ما صدر حتى …» (`reportModel.js:215`); NC «Different population — shown apart, never added or compared» (`NcOverview.jsx:52`); Decision Room «رصيد قائم حتى تاريخ القطع (لا يتأثر بالفترة)» (`decisionUi.js:85`). **The carry-over figure (4.43 bn) is shown nowhere.** |
| Standing ↔ **bridge** (`standingBalance.bridge`) | **Verified to 0.0 SAR** (`check = 0`; NC check `standing_eq_bridge`). | Report 15,270,865,462 − reconciliation 125,935,418 − excluded 6,900,306,820 + new invoices 78,046,500 = **8,322,669,724**. (The bridge starts from the previous month-end unpaid report; it is **not** a period → standing bridge.) The bridge's «excluded» 6,900,306,820 differs from the standing excluded 6,971,786,300 by 71,479,480 = excluded invoices issued after the report date, which the bridge skips (INFERRED from `engine.js:558–568`; the two numbers add to the standing excluded exactly). | NC fold «How the standing balance reaches its figure (its own bridge)» (`NcOverview.jsx:74`); not on the dashboard (the old `UncollectedBridge` is unused). |
| Standing ↔ NC `standingBalance` ↔ Planning input | **Identical (0.0).** `stock.netUncollected` is independent of the period (3 different `from` dates → 8,322,669,724 each); approved-only config = default config today (all rules approved). | | Planning shows only the ceiling sentence, not the number. **Conditional (INFERRED):** Planning forces the approved rule set (`planInputs.js:5`) while the dashboard uses the user's `cfg`; if a user toggles an exclusion rule or the grace days, the two would diverge. Not demonstrable today. |
| Period net ↔ NC `netUnpaid` ↔ `/collection` net | **Identical (0.0)**, 20 NC reconciliation checks true. | | NC and the list define the populations in words (`listLogic.js:142–150`, `NcOverview.jsx:46–55`). |
| Dashboard aging bars ↔ `/collection` due-position bar | **Same population only when the list period is widened** (`filters.allPeriods`): then 7,743,038,344 + 579,631,380 = 8,322,669,724. With the default period the bar is the 3.89 bn cohort. | | `Collection.jsx:140` caption says «الشريط يمثل صافي غير المحصّل»; the period is visible in the toolbar; no «show all periods» cue. |
| Aging (standing, dashboard) ↔ aging (period, NC) | **Same bucket scheme, different populations** (8.32 vs 3.89); difference 4,433,134,471 as above. | | Not labelled as different on the dashboard; NC labels it. |
| Planning «أين نركز» (3.89) ↔ planning ceiling (8.32) | **Explained** (period cohort vs standing) — **same panel, same wording «غير محصّل/owed», not labelled**. | | `PlanForecast.jsx:26,61`. |
| Collected tile 8.72 ↔ Planning collected-to-date 9.21 | **Explained, verified to 0.0:** 8,715,793,497 + overpayment 50,000 = 8,715,843,497 (`receivedInPeriod.fromPeriodInvoices`) + 494,196,579 (payments dated in the year on earlier invoices, `fromPriorInvoices`) = **9,210,040,076**. | | **Well labelled:** tile sub «من صافي فواتير الفترة» (`InsightsDashboard.jsx:71`) vs «منذ بداية السنة — بتاريخ الدفع» (`PlanningArea.jsx:128`). |
| Collected rate card/tile ↔ register collected | 8,715,793,497 (scope) vs 8,685,173,389 (register) differ by 30,620,108. | cause **not traced** (PENDING a trace); the card's tooltip warns it «can differ slightly» (`CollectionRateCard.jsx`). | Partly. |

**Overall verdict:** no unexplained gap; every pair bridges to **0.0 SAR** from records. The weakness is **labelling**: the Dashboard (the page SH sees first) shows 3.89 bn and a chart that sums to 8.32 bn with no statement of the difference, and the carry-over number that explains it exists in no screen.

### 5.3 Proposed refinement (only because the Dashboard labelling is insufficient) — RECOMMENDATION

One change, reusing existing values (no new calculation, chart or component): under the aging chart (and in the Planning ceiling line) add the existing basis chip **«رصيد قائم حتى تاريخ القطع — كل فترات الإصدار» / «Standing balance to the cut-off — all issue periods»** (`PERIOD_BASIS.standing`, `decisionUi.js:85`, already used by the Decision Room) and one line: «منها X صدرت قبل الفترة المختارة» where X = `stock.netUncollected − totals.outstanding` (arithmetic on two existing figures; for a period that ends before the cut-off, state it only when `collectionsAsOf='periodEnd'` does not move the reference date, otherwise omit — see note). Acceptance: (a) the dashboard aging chart text contains the chip; (b) for national, Jeddah and Riyadh scopes the displayed carry-over equals the independent sum of list rows issued before the period start (the numbers above, 0.0 SAR); (c) no chip when the period starts before the earliest issue date; (d) Smart Reports and NC wording unchanged.
*Note (VERIFIED trap):* the snapshot of a period that **ends before the cut-off** measures balances at the period end (`collectionsAsOf='periodEnd'` is the default, `revenueMetrics.js:116`, `engine.js:343`), so «period + carry-over = standing» holds only for periods that end at the cut-off; my first probe (`to = 2025-12-31`) produced a different number for that reason. Any displayed carry-over must therefore be computed as standing − period only for the open period; otherwise the dashboard would state a wrong bridge.

---

## 6. Terminology versus language understanding

### 6.1 What happens today (VERIFIED, `probeTerm`)

| Input | Chart interpreter (`interpretChartRequest`) | Report interpreter (`interpret`) |
|---|---|---|
| «اعرض المحصل كحلقي» | `apply` → the collected/uncollected chart as donut | — |
| «اعرض المقبوض كحلقي» / «المقبوضات كحلقي» | `ask` («أي رسم تقصد؟») — the word is **not understood** but degrades to a clarifying question, never a wrong chart | — |
| «تقرير المقبوضات الشهرية» | — | `clarify`: «لم أتعرف على «المقبوضات، الشهرية» …» (graceful) |
| «قارن المقبوضات حسب الامانة» | — | `report` (Amanah section) — the unknown word is **silently ignored** (no clarification) |
| «show received as a donut» / «show receipts as a donut» | `apply` / `ask` (English «received» is a synonym of collected at `chartRequests.js:128`; «receipts» is not) | |

So the retired term is **not accepted by any interpreter**; this is not new — at `HEAD` none of `reportIntents.js`, `chatIntents.js`, `requestEntities.js`, `textNorm.js`, `measure.js`, `chatAnalysis.js` contained «مقبوض» (`git show HEAD:… | grep -c` = 0 for all). The chart interpreter's measure list (`chartRequests.js:128`: `['المحصل','محصل','collected','received']`) is where agent F had to drop it.

### 6.2 What the terminology test protects (VERIFIED, `tests/platform.test.mjs:1588–1592`)

It walks `src/` and `server/`, reads **every** `.js/.jsx/.mjs` file and fails on the **substring** «مقبوض» anywhere — display strings, comments, identifiers, **and any future input-alias list**. It therefore protects what a user *sees*, but it cannot distinguish a label from an alias, and a legitimate «we understand the old word» table would have to break the test. It also checks that the approved dictionary entries exist.

### 6.3 Judgement

A business user (and Shared Services staff trained on the old reports) will keep typing «المقبوضات». **Accepting a retired term as input while never displaying it is the better behaviour**: it removes a failure mode (an unanswered or silently-ignored request) without changing any label. Input recognition and output wording are different contracts and should be tested separately. (RECOMMENDATION.)

### 6.4 Proposed refinement (PROPOSED — no file edited)

* **One module**, e.g. `src/data/legacyTerms.js`, exporting an **input-only** alias table: `{ retired: 'مقبوض…', maps: 'collected_by_payment_date' | …, note }` — the single place the retired stem may appear, with a header «INPUT ALIASES — never displayed».
* Consumers: `textNorm.js` (a `foldLegacy(text)` applied before intent matching) so **all** interpreters (report, chat, entities, chart requests) share it; the chart measure list reads the mapped canonical word instead of embedding the stem.
* Which approved term it maps to must be decided by the business (PENDING): «الإيرادات المحصلة» (collected by payment date) is the term that replaced it per project notes; «المبلغ المحصّل» is the invoice-cohort measure.
* **Test change:** keep the full-tree scan but exempt exactly `src/data/legacyTerms.js` (allow-list of one path, asserted to be the only hit); add (1) a test that every alias resolves in each interpreter to the same result as its approved term (`interpret`, `interpretChartRequest`, chat intent); (2) a **response-side** test that renders the answers/labels of those requests (report titles, chart titles, chat answers, exports' text) in AR and EN and asserts none contains «مقبوض»; (3) a test that the alias file contains no other retired stem and is not imported by any component (no path from the table to a rendered string except through the canonical term).
* **Acceptance criteria:** «تقرير المقبوضات الشهرية» produces the same report spec as the approved-term request; «اعرض المقبوض كحلقي» applies to the same chart as «اعرض المحصل كحلقي»; the generated report title and the interpretation note show the **approved** term; the global scan finds the stem in exactly one file; full test suite passes.

---

## 7. Other post-chart-library checks

### 7a. Saved chart choices versus exports (VERIFIED by reading; tests cited)

| Surface | Path | Test evidence |
|---|---|---|
| Smart Reports | `exportVersions` builds, per saved version and language, `applyView(modelOfRecord(r,l), view)` where `view` = the latest `kind:'view'` message for that report (`SmartReports.jsx:594–598`); `ExportDialog.jsx:20,29` reads the same model and lists the plan (`ChartsDisclosure`, `exportPlan(model, model.view)`) | pure parts: `tests/chart-catalog.test.mjs:339–344,398` (exportPlan, round-trip of a saved view); the **React composition** at `SmartReports.jsx:598` is not exercised by a DOM test (chart-picker-ui covers pure logic and server renders) — INFERRED correct, observed only via the screenshot `chart-export-dialog-fallbacks-ar.jpg` |
| Dashboard | `InsightsHub.jsx:21–23`: `withDashboardView(model, view, inputs)` in **both** languages | `tests/chart-integration.test.mjs:240–252` (kinds in the exported model, same figures, no refetch, AR + EN) |
| Non-collection | `AnalysisResultPage.jsx:68`: `viewedModel(buildNcReportModel(…))`; the view is stored with the analysis **version** outside the checksum | `chart-integration.test.mjs:296–312` (saved, restored, exported, damaged view reduced, another user cannot write) |
| Exclusions, invoice summaries | their charts are **not** in any export model (plain page charts); the picker choice is page-local (localStorage key `ib_chartview_v1:<user>:<page>`) | `chart-integration.test.mjs:253` (store), `:265`, `:277` |

### 7b. Restricted users in chart companions (VERIFIED by tests)

`chart-integration.test.mjs:177–189` (organisation restricted to its two largest Amanahs): no non-permitted Amanah name in any block, companion or **drawing of every available type**, in AR and EN; restricted totals equal the dashboard's; Smart Reports by-Amanah bars ≤ permitted count. `:190–198` municipality scope leaks no other municipality. `tests/chart-data.test.mjs:202` (4-Amanah and 2-Amanah organisations, companions, distributions) and `:173–182` (a restricted/narrowed scope gets no bullet). Browser observation recorded in the chart-library doc («Riyadh Municipality» user; screenshot `chart-page-restricted-riyadh-picker-en.jpg`) — I did not repeat it. Not covered: a view saved by an unrestricted user then opened by a restricted one on the same browser profile (the stored view holds only presentation keys, no figures — INFERRED safe; `cleanKnownView` drops unknown kinds), and the Amanah → municipality **hierarchy** in the treemap/sunburst companion beyond the «no other municipality» label check.

### 7c. New wording that could overclaim (VERIFIED by grep of `src/components/charts`, `chartCatalog.js`, `chartConfig.js`, `chartRequests.js`, `chartAlts.js`, `reportView.js`)

* **No «probability», «forecast», «expected» or financial recommendation** appears in the chart library. «Recommended / موصى به» (`ChartPicker.jsx:30`, reset button `:151`, `ChartCustomize.jsx:50`) is `recommendedKind(block)` — a **chart-type** rule (many/long categories → horizontal bars; a line on an unordered axis → columns; a pie of > 8 parts → bars; `chartCatalog.js:115–131`). RECOMMENDATION (low priority): qualify the badge as «نوع الرسم الموصى به / Recommended chart type» so that on a finance page it cannot be read as advice about the money; acceptance: the string appears in AR/EN in the picker and the reset tooltip.
* `chartCatalog.js:66` «الأنسب للأسماء الطويلة …» is about label length. `chartRequests.js:95` («الأفضل / best fit») is an input synonym for the recommended chart type.
* Alternative companions state their population and measure in their note (`chartAlts.js:154–161`: «… N invoices, value = gross billed before exclusions …»), which mitigates the measure change when a user switches the aging bar to a histogram or the by-Amanah bars to a box plot. The scatter/bubble carry the fixed «not causation» caption. Items 5–6 of §3.2 (pareto on ordered buckets; share types on a top-N subset) are the only chart-library behaviours that could mislead.

### 7d. Unverified claims in the chart-library documents

| # | Claim (document) | Status | What would prove it |
|---|---|---|---|
| 1 | PowerPoint 2016+/365 draws the SVG; older viewers show an empty frame (`chart-library.md` PNG fallback) | **UNVERIFIED** (LibreOffice 26.2.5.2 shows the drawing from a 70-byte placeholder — observed by me; PowerPoint never opened) | open a browser-exported and a script-exported deck in PowerPoint 365 / 2013 / Keynote / Slides |
| 2 | Native charts open and «Edit data» works in PowerPoint (export notes) | **UNVERIFIED** (structure tests only; doc: «Microsoft PowerPoint itself was not opened») | same |
| 3 | Browser export supplies real PNG fallbacks | **UNVERIFIED by observation** (code path read; no exported file inspected; silent `null` path, §4) | export from Chrome and Safari, unzip, check `chartimg*.png` size and pixels |
| 4 | Word PNG of the SVG is correct (`WORD_SUPPORT = png`) | **Structure only** (`test:chartexport`, 79 checks pass); pixels not tested | open the .docx in Word |
| 5 | «The picker is verified in the real app (Chrome pane) … reloading restored every choice … 0 network requests … keyboard» | **Recorded, not re-run** (22 screenshots exist in `docs/screenshots/chart-*.jpg`); no DOM test runner | repeat in a browser or add a DOM test |
| 6 | «npm run render with LibreOffice and look» as a verification step (`make:chartdecks`) | **No result recorded in the doc**; I rendered one picture slide only | a recorded visual check of all 24 kinds |
| 7 | Size claims (detailed national report 73.4 k → 116.1 k chars; raw distributions 41 k) | **UNVERIFIED** (not re-measured) | measure `JSON.stringify(model).length` with/without companions |
| 8 | «every default chart is unchanged» (Platform integration) | **Partly proved**: hashes for the six legacy native kinds (`chart-export.test.mjs`); the dashboard figures equal the plain builders (`chart-integration.test.mjs:227`); no screenshot diff of the defaults | before/after screenshots |
| 9 | Support matrix pages/«offered in» = demo reality | **Proved for one synthetic world** (`TODAY 2026-10-09`, national, detailed report); not for other scopes | run the matrix per scope, or state the world |
| 10 | Reason shown for `stacked_area` in §6 | **Wrong text** (§3.2 #3) — doc and test agree because the doc is generated from the same code | assert the per-block reason |
| 11 | Known gaps (3) `stacked_hbar` «Total 0» row; (4) bullet note language mix | **Accepted limits** (no platform chart triggers them) — unverified by me | |
| 12 | `npm test` chain (`package.json:12`) all green in one run | **Not run by me** (individual chart suites + list/NC suites re-run: all pass) | `npm test` |
| 13 | Export parity 9,573 / 9,573 cells, 3,666 / 3,666 exact SAR incl. every kind | **R1 ran it** (`01 §0`) on 18 report models; not re-run here | `npm run verify:exports` |
| 14 | Municipality/Amanah restricted-user scopes in the real app | **Test-level proved; browser run recorded, not repeated** | |

### 7e. Explicitly **not** verifiable by this review

Microsoft PowerPoint / Keynote / Google Slides rendering; Word's rendering of the PNG; real Shared Services examples and the Dr. Muath / Abdulmajeed methodology (still absent, `00 §3–4`); the MOMAH UI/UX guideline kit; accuracy of any forecast or priority on real data; the cause of the 30.6 m register-vs-scope collected difference.
