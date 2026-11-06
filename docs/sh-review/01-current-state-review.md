# 01 — Current-state review (analytic): code, calculations, data, materials, coverage

Review of 2026-11-06 · agent R1 · branch `feat/furas-contracts-rework` + uncommitted working tree (git status: ~427 entries; another agent was editing chart-library code during the review — nothing read here looked in flux except where §I says so).
**REVIEW ONLY.** Nothing in the application, tests, package or data was modified. Probes were bundled to `.test-build/_r1_*.mjs` and read the in-memory synthetic world; their sources are in `scratch/r1/` (`probeA–D.mjs`, `runtests.sh`, logs).
Labels: **VERIFIED** (read or run; evidence given) · **RECOMMENDATION** · **SIMULATION** (illustrative) · **PENDING** (business alignment / external input).
All numbers are the **synthetic demo baseline** (compact generated world: 929 invoices, cutoff 2026-11-05; amounts are scaled so they are *not* operational volume). Nothing here is a ministry figure.

## 0. What was run (evidence log)

| Run | Result |
|---|---|
| `scratch/r1/probeA.mjs` — snapshot vs `list()` for the whole year, Jeddah, Jeddah + one municipality, a restricted organisation (Riyadh + Jeddah), status = overdue; aging buckets; missing-due check | **counts, gross, net and uncollected identical** between snapshot and list in all 5 scopes; identities hold (see §E) |
| `scratch/r1/probeB.mjs` — planning inputs, `forecastYear`, OLS forecast, same-scope comparison | see §B |
| `scratch/r1/probeC.mjs` — standing balance, concentration, priority levels over the whole uncollected list, legacy worklist score | see §A, §C, `06` |
| `scratch/r1/probeD.mjs` — **in memory only**: blank one invoice's due date and re-run snapshot / non-collection / list | see GAP-R2-3 |
| Tests (bundled to unique `.test-build/_r1_*.mjs`): decision-room (24 groups), decision-followup (13), noncollection (14), nc-drilldown (13), enforcement-exclusion (14), enforcement-collections (8), sanad-workflow (16), municipality (24), municipality-downstream, chat-workspace (22), nc-report (14), exclusions-register (7), furas-contracts (13) | **all pass** |
| `export-parity` (docx / xlsx / pptx of 18 report models) + `scripts/export_parity_check.py` | docx / xlsx / pptx: **3291 / 3291** shown items present; table cells **9573 / 9573**; exact SAR amounts **3666 / 3666** |

## 1. Headline findings (details and line references below)

1. **Receivables:** the core identities, the drill-through parity, the Amanah → municipality hierarchy and the restricted-organisation scope are **sound and tested**. The gaps are presentation and bucket definitions, not arithmetic.
2. **The debtor is not visible in the main receivables list.** The uncollected list shows Invoice · Amanah/municipality · **Product** · Unpaid · status · days · priority; the payer appears neither as a column nor in the expandable details, and the CSV export has no payer column (`CoreInvoiceTable.jsx:78,97`, `lists.js:387`). Arabic labels also confuse «المفوتر» (the biller/issuer) with «الجهة المفوترة» (the party billed = the debtor). → GAP-R2-1.
3. **Aging has five buckets, the SH asked for six.** `server/engine.js:314–315`: not yet due, 1–30, 31–90, 91–180, **180+**. Missing: 181–365 and over one year. In the synthetic baseline 74% of the standing balance sits in the unsplit 180+ bucket, exactly where the split matters. → GAP-R2-2.
4. **An undated receivable is silently counted as "over 180 days" in the snapshot** (and in the dashboard aging chart / `stock.overdue`) while the non-collection analysis and the list correctly show it as «due date unavailable». Reproduced in memory; the synthetic world has none today. → GAP-R2-3.
5. **Two "total outstanding" figures with different meanings:** period cohort (dashboard tile «غير المحصّل») vs standing balance (aging chart, Smart Reports). 3.89 bn vs 8.32 bn on the same dashboard (synthetic). The standing figure and the overdue / not-yet-due split are not headline tiles. → GAP-R2-4.
6. **Forecast is an explainable run-rate, labelled illustrative — but the screen shows a bare "probability".** The tile «احتمالية تحقيق المستهدف» is a normal-distribution tail computed from at most three monthly points and clamped to 1–99% (`planForecast.js:30–43`, `PlanForecast.jsx:46`). Synthetic baseline: z = 2.0 → "2%". No method id, version, history window, assumptions panel or scenarios on this page. → GAP-R3-1/2.
7. **Two different forecast methods give two different year-end numbers for the same scope** (run-rate 10.95 bn vs trend 9.96 bn, synthetic) and **two target sources** (planning store vs static `DEFAULT_TARGETS`, curved vs even monthly shape). → GAP-R3-4.
8. **Wording defect:** the chat answer calls the demo target "the approved annual target (a demo input …)" (`assistantAnswers.js:82`). Status in code is `demo`. → GAP-R3-3.
9. **No per-invoice collection probability exists, and none can be validated with the data available.** What exists is an explainable **High / Medium / Low follow-up priority** (amount tier × age tier, with caps) in the uncollected list and a **factor-threshold priority** in the Decision Room — both state their rules and carry no score. The official decks, however, promise "the system processes the probability of collecting every invoice" (SH #09 slide 9; intro deck slide 3). → GAP-R4-2 (wording) — **do not build a probability model**.
10. **Five prioritisation surfaces use five rules** (list tiers, Decision Room factors, planning "where to focus", a legacy numeric score behind Smart Reports recommendations, non-collection action groups). The calculation reference and the Handbook still document the numeric score as the list/Decision Room priority (M-15) — stale since the 6 Nov redesign. → GAP-R4-1, GAP-X-1.
11. **Decision Room is well aligned** with the SH asks (issue, affected amount, evidence, proposed action, follow-up flag, audit trail, no assignment, no recovery estimate, overlap disclosed, financial condition separate from follow-up). **The dashboard never links to the forecast page**, so the journey step «what we expect to collect» is a sidebar visit away. → GAP-R5-1.
12. **Coordination actions: no completion evidence found for any of the five** (see 02 §C). The only forecasting methodology present is the demo's own.

---

## A. Receivables visibility (R2)

### A1. What is owed — totals, overdue, not-yet-due, standing balance (VERIFIED, `probeA`, `probeC`)

| Measure | Definition in code | Synthetic baseline (cutoff 2026-11-05) |
|---|---|---|
| Period uncollected (dashboard tile «غير المحصّل») | net − collected over invoices **issued in the period** (`server/engine.js` `totals`) | 3.89 bn (YTD 2026) |
| **Standing balance** (الرصيد القائم) | net uncollected of **everything issued up to the cutoff**, any period (`stock.netUncollected`, accumulated `engine.js:357`, output `:453`) | 8.32 bn |
| Overdue / not yet due (standing) | `daysOverdue > 0` / otherwise (`engine.js:45`, output `:453`); overdue + not-yet-due = standing exactly | 7.74 bn (93.0%) / 0.58 bn (7.0%) |
| Aging buckets (standing) | `agingBucket(days)` `engine.js:315` | not due 0.58 · 1–30 0.41 · 31–90 0.32 · 91–180 0.82 · **180+ 6.18 bn (74.3%)**; Σ = 8.32 bn |
| Average days overdue (standing) | `engine.js:357` | 307 days |

Identity check (YTD): gross 15.82 − exclusions 3.21 − net 12.61 = **0**; net 12.61 − collected 8.72 − uncollected 3.89 = **0**; `snapshot.equation.ok = true`.
The uncollected list over *all periods* returns `sums.outstanding` = 8,322,669,724 = `stock.netUncollected` exactly, i.e. the standing balance is reachable from the list by widening the period (the aging chart's own drill is not verified).

**Reporting date and due-date basis.** `daysOverdue = max(0, cutoff − (due date + grace days))` (`src/data/lateness.js`), reported only while an amount is owed. Grace default 0 (`cfg.graceDays`; business decision EQ2 still open — the ministry monthly reports use cumulative 5/10/15/35 days on the collection-vs-target slide, `docs/monthly-reports-definitions-register.md`). The data cutoff is shown by the `DataStatus` strip; the aging chart title does not state the due-date/grace basis.

**Exact difference from the buckets requested** (not yet due · 1–30 · 31–90 · 91–180 · 181–365 · over 1 year):

| Where | Buckets | Difference |
|---|---|---|
| `server/engine.js:314–315` `AGING` / `agingBucket` (dashboard chart, Smart Reports, exports, Decision Room aged-180 item) | 0 · 1–30 · 31–90 · 91–180 · **180+** | 181–365 and >365 are not split |
| `server/noncollection.js:14` `AGE_KEYS` (non-collection analysis, drill-through) | same five + `unavailable` | same; but has the separate «due date unavailable» bucket |
| `engine.js:357,460` `agingPlanning` | current · 1–30 · 31–60 · 61–90 · 90+ | a **third** scheme (planning), different cut points |
| `lists.js:338` priority age tiers | 1–30 · 31–90 · 91–180 · >180 | follows the first scheme |

### A2. Who owes it — debtor vs managing entity (VERIFIED)

| Question | Answer |
|---|---|
| Is the debtor distinct from the government entity managing collection? | Yes in the data: each row carries `payerAr/payerEn` (the debtor), `amanahAr/En` (+ municipality) (the managing entity) and `billerId/billerAr/billerEn` (the issuing biller) — `server/lists.js:71–82`. |
| Where is the debtor shown? | Collected list («الجهة المفوترة»), invoice register (`InvoiceListTable.jsx:58`), invoice page, non-collection invoices tab (`NcInvoices.jsx:75`), enforcement pages. |
| **Where is it not shown?** | **Uncollected list** — the primary receivables view (`CoreInvoiceTable.jsx:78,97`: column is *Product*; `DetailRow` lines 24–50 has no payer). **CSV export** — no payer column (`lists.js:387`). |
| Debtor-level aggregation (who owes most)? | **None.** No snapshot field groups by payer; the only per-debtor view is the Sanad order page «same debtor's other invoices» (`server/orderMatch.js:77`). Search by payer works (`lists.js:resolveSearch`). |
| Unidentified debtors | Modelled as **missing debtor id number** (`F.MISSING_ID`, `materialize.js:82,98`): shown as «معرّف المدين ناقص» in the non-collection quality bucket and as the action group «request_missing_info» (`noncollection.js:31,75`). A debtor with no name is not modelled. |
| Wording risk | `CoreInvoiceTable.jsx:94` «Biller / المفوتر» (= issuer) beside `:78` «Billed party / الجهة المفوترة» (= debtor): one letter apart in Arabic. |

### A3. Due dates, disputes, payment history, contract, exclusions, enforcement (VERIFIED by reading `InvoicePage.jsx`, `InvoiceParts.jsx`, `lists.js`)

Invoice page: financial summary (invoice amount, collected, remaining, issue / due / payment date), cancellation-exclusion-balance-enforcement block (kept separate), findings («اعتراض مفتوح», duplicate, struck-off registry), **Payments** list, related investment contract (investment invoices only), related enforcement orders, Efaa violations. Row fields: `exclusionReason(s)`, `objectionStatus` (Mumtathil status), `enfOrders`, `contractNo`, `dueDate`, `daysOverdue`.

### A4. Missing due dates and unidentified data kept visibly separate (VERIFIED, `probeD`, simulation in memory)

| Consumer | Behaviour with one receivable whose due date is blank |
|---|---|
| `snapshot.stock.aging` / `stock.overdue` (dashboard aging chart, Smart Reports, exports) | **unchanged** — counted in **180+** and in *overdue* (`engine.js:220` has no `due > 0` guard; `overdueDays(cutoff, 0)` is huge) |
| Non-collection aging (`noncollection.js:100–103`) | moved to **`unavailable`** (41.2 m in the test) |
| List due facet (`lists.js:121,126`) | counted as **`unknown`** (1 invoice, 41.2 m) |
| Priority (`lists.js:337–340`) | «medium for a large amount, otherwise low — never read as overdue» |
→ inconsistent: GAP-R2-3. The synthetic world holds **0** undated invoices, so this is **not demonstrable** today and no screenshot will show it.

### A5. Summary → list drill-through (VERIFIED, `probeA` + tests)

| Scope | Snapshot count / list total | gross / net / uncollected equal? |
|---|---|---|
| YTD 2026, all | 419 / 419 | yes |
| Jeddah Amanah | 112 / 112 | yes |
| Jeddah + «بلدية العرضية الجنوبية» | 11 / 11 | yes |
| Restricted org (Riyadh + Jeddah) | 186 / 186 (Housing sector absent) | yes |
| Status = overdue | 58 / 58 | yes |
Municipality groups of Jeddah sum to the Amanah (112 = 112: 35 issued directly by the Amanah, 10 not specified, the rest mapped). `nc-drilldown` (13 tests): every non-collection chart mark opens exactly the invoices it counted.
Caveat: the **standing** balance (aging chart) uses all issue periods; the list page defaults to the period filter, so reaching 8.32 bn needs the period widened.

### A6. Contract installments without verified invoice links (VERIFIED by reading, PENDING on data)

* The Decision Room keeps them in their own categories, never added to receivables: `installments_unlinked` — `contracts:unlinked` («Due — no invoice linked», proposed rule, `needs_verification`, arrears «for context only») and `contracts:no_contract` (`decisionRoom.js` header, `docs/decision-room-redesign.md`). Overlap statement: "installments of the generated schedule have no invoice: no overlap".
* **Population caveat (new finding):** those Decision Room contract items are built from `rev.data.contracts` (the **generated** schedules, `useDecisions.js:41,52`), whereas the contract pages (`/contracts`, `/contracts/:no`, `/products/foras`) read the **local Databank-schema subset** (`server/furasData.js`; 100 contract numbers) and state that collected amounts, unpaid balances and installment-to-invoice links are «not available in the current data» (`docs/furas-dataset-mode.md`). The two never share a population. GAP-R2-5 (PENDING on D-… Databank payment/invoice linkage).
* `src/pages/furas/FurasDecisionRoom.jsx` is not imported anywhere (dead component).

### A7. Amanah → municipality hierarchy (VERIFIED)

Reference-driven (`src/data/amanahHierarchy.js`, 267 municipalities under 17 Amanahs; self-rows and ministry-HQ row never counted as municipalities). Checked by `municipality` (24) and `municipality-downstream` tests: Smart Reports interpretation → scope → report → exports, non-collection analysis, Decision Room evidence links, dashboard drill-down links and CSV all read the reference model; ids never leak to a person; an invalid municipality selects nothing (never widened). Probe: snapshot municipality rows partition each Amanah exactly. The compact world's municipality assignments are generated (demo); none was invented by this review.

---

## B. Forecasting (R3, R6)

### B1. What exists

| Capability | Where | Method (VERIFIED) |
|---|---|---|
| Annual targets | `/planning` — `PlanningArea.jsx`, `planTargets.js`, `appropriations.js` | communicated budget (**illustrative** table) × coverage target = annual revenue target; billing required = target ÷ collection-rate target; even 1/12 monthly plan; edits saved on the device |
| Progress to date | `collectionGoal.js:53 computeGoal` | collected (payment-date basis) vs planned-to-date; remaining = max(target − collected, 0); `no_target` / `future_year` states |
| «أين نحن من الخطة» | `planForecast.js:24 forecastYear`, `PlanForecast.jsx` | estimate = collected-to-date + max(current month, avg) + avg × remaining months, avg = mean of the **last ≤ 3 closed months**; spread = their SD (25% of avg with one point); probability = 1 − Φ((target − estimate) ÷ (spread·√monthsLeft)) clamped **[0.01, 0.99]** |
| Reasons | `forecastYear` `reasons` | ceiling = collected + **standing uncollected** + avg monthly net billing × months left; «billing insufficient» if ceiling < target, else «pace short» |
| Focus | `focusRanking` | entity × source cells ranked by outstanding × shortfall vs collection-rate target |
| Trend forecast (Smart Reports, chat) | `revenueOutlook.js` `forecastCore` | OLS linear trend on ≤ 12 trailing months (≥ 4 points), exceptional payments removed, indicative band ±1.28 residual SD "**not a validated confidence interval**" (`:148`), one-step backtest, assumptions and limitations lists, `FORECAST_METHOD.id = ols_trend_v1`; `applyScenario` (recover-overdue %, billing change %) **exists but is not used anywhere** |

### B2. Traced values (synthetic baseline, `probeB`)

| Item | Value |
|---|---|
| Illustrative revenue appropriation total (default annual target, status `demo`) | 11.495 bn |
| Collected to date (payment-date, approved rules; = Σ series = `receivedInPeriod.total`, difference 0) | 9.21 bn |
| Planned to date (even plan, day-prorated) | 9.74 bn → deviation −0.53 bn |
| Last 3 closed months used | 0.76 · 0.90 · 1.14 bn → avg 0.93 bn, spread 0.19 bn |
| Run-rate year-end estimate | 10.95 bn; z = 2.0 → displayed probability **2%** |
| Ceiling at 100% recovery | 19.74 bn = 9.21 + **8.32 standing** + 1.10 avg billing × 2.0 months |
| Trend (OLS) projection of the same scope | remainder 0.75 bn → total **9.96 bn** (range 9.54–10.37 bn); backtest n = 6, **MAPE ≈ 142%** (the demo says "small sample, not a guarantee") |
| Default annual target if instead set as coverage 66% × budget (voiced in meetings, illustrative) | 18.4 bn → z ≈ 27 → still displayed as the clamp floor, **1%** |

### B3. Answers to the specific questions

| Question | Finding (VERIFIED unless marked) |
|---|---|
| Expected **invoiced** revenue vs expected **cash collections** vs **approved targets** vs gaps | Targets: yes (demo). Cash: yes (run-rate). **Expected invoiced revenue is not forecast**; only the last-3-month average net billing appears inside the ceiling. Gap: deviation to date and year-end shortfall are shown; **not** a billing gap. |
| "Actual to the reporting date + expected for the remaining period" separated? | Actual: yes (tile + chart "actual"). The **expected remaining** is not a separate number — the chart/tile give the year-end estimate; the remainder = estimate − collected must be derived by the reader. |
| Overlap between expected collections from existing receivables and from future billing? | **Estimate:** not decomposed, so no double count but no split either. **Ceiling:** no overlap — standing balance (issued ≤ cutoff) and future billing (issued after) are disjoint; arithmetic above. But the ceiling assumes **100% recovery of the standing balance, 74% of which is >180 days**: it is a ceiling, not an expectation, and the screen does not say which part is old. |
| Reporting date and horizon visible? | Reporting date: yes (basis line). Horizon: implicit (year-end); not stated as such. |
| Historical coverage / source coverage | Not stated on `/planning` (label says "last-3-month average"). |
| Method / model / version | `/planning`: no method id or version. Smart Reports path: `ols_trend_v1` in the model text. |
| Assumptions and drivers; seasonality; recovery assumptions | `/planning`: none listed except the run-rate itself; even monthly plan (**no seasonality**; monthly weights are editable); **no recovery assumption** for outstanding balances. Trend path lists assumptions ("no seasonality … approved target NOT used"). |
| Base / conservative / improvement scenarios | **None exposed.** `docs/planning-cfo-review-plan.md §6` removed scenarios on purpose; `applyScenario` is dead code. |
| Limitations | `/planning`: footnote "illustrates the method; it is not an approved model" (`PlanForecast.jsx` last line) and the tag «تقدير تجريبي – للعرض التوضيحي». Smart Reports: a warning callout. |
| Alignment status | No statement on any screen that alignment with the strategy/finance forecast is pending. **PENDING** (00 §3). |
| Wording implying a validated AI forecast or confidence interval | See below. |

### B4. Wording to correct (quoted)

| Where | Text | Problem |
|---|---|---|
| `PlanForecast.jsx:46` | «احتمالية تحقيق المستهدف» / "Probability of reaching the target" (tile, no adjacent tag; the "demonstration" tag is in the panel header) | A normal-tail number from ≤ 3 points, clamped to 1–99%, presented as a probability. A reader can take "2%" as a model output. |
| `assistantAnswers.js:82` | "the approved annual target (a demo input, independent of the forecast)" (AR twin follows) | The target is **not approved** (`status: 'demo'`, `revenueMetrics.js:647–649`). |
| `revenueOutlook.js` header, `targetVsForecast` | "Approved management target (an INPUT)" | same word for a demo input. |
| intro deck slide 3 / SH #09 slide 9 | «يعالج النظام احتمالية تحصيل كل فاتورة أو تأخرها أو إلغائها» | capability the demo does not have (see C). |
Acceptable: the Smart Reports callout ("illustrates the function and is not an approved projection. No decision should rest on it"), the trend band label (not a validated confidence interval), the dictionary entry («تقدير بسيط … وليس نموذج تنبؤ»).

### B5. Locating the teams' methodology

Not found (00 §3). **PENDING alignment** — input list in `00 §3`. RECOMMENDATION: until alignment, show **one** method per screen with its version, state it is illustrative, show the split actual / expected remaining, and keep scenario and probability features off.

---

## C. Collection prioritisation (R4)

### C1. What the platform actually does (VERIFIED)

| Concept | Exists? | Where / rule |
|---|---|---|
| **Follow-up priority** (High / Medium / Low) — explainable rules | **Yes** | `server/lists.js:334 priorityCore` (age tiers `:338`): amount tier (top 10% = large, top 25% = medium, percentiles of unpaid non-excluded balances of the whole dataset) × age tier (1–30 / 31–90 / 91–180 / >180). High: >180 days with a medium-or-larger amount, or a large amount >30 days overdue. Medium: >90 days or a medium-or-larger amount. Low: otherwise, not-yet-due, excluded. Caps: evidence quality < 0.8 or an open objection lowers High to Medium. Each row carries `why` text and factors. **No numeric score is shown** (`InvoiceListTable` / `Badges`). |
| Decision Room priority | Yes | `decisionRoom.js:42–80` factors with stated thresholds; "No composite score"; items needing evidence verification are capped at Medium. |
| **Delayed-payment risk** | **No** | only the state «overdue / days overdue»; payment lateness of past payments exists only on contract cards (`server/contracts.js:32–38`) |
| **Collection probability within a horizon** | **No** | none per invoice. The only "probability" is the planning tail number (a target-attainment statistic, not a collection probability). |
| **Recoverability** | **No — deliberately** | «No recoverability is assessed» (`NcOverview.jsx:101`, `ncReportModel.js:16,49`, `noncollection.js:285`); exclusion ≠ uncollectible (`metricDictionary.js:30`). |
| Legacy numeric ranking score | Yes (API + Smart Reports) | `lists.js:407–436 worklist`: 0.40 amount + 0.25 age (÷180) + 0.25 actionability + 0.10 evidence; used for Smart Reports recommendation labels (`score ≥ 0.6` → "High", `smartReport.js:119`, `proposals.js:11`). Not a probability, but called "Priority score" in the reference docs. |

### C2. Inputs used / not used (VERIFIED)

Used: unpaid amount (percentile tier), days overdue, evidence quality (amount conflict, missing payer id, contract mismatch, pending exclusion), objection status, exclusion flag, due-date availability, action group (next step) from the non-collection classification. **Not used:** payment history, previous follow-up, recoverability indicators, enforcement outcome, available actions beyond the rule-based next-step text.

### C3. Does each prioritised case explain why / evidence / next action / limitations?

* List: `priority.why`, `priority.factors` (amount, due position, evidence), `nextStep` — **yes**; limitation text on the list footer is about exclusions, not about what the priority ignores (GAP-R4-3).
* Decision Room: facts / calculated / unknown / proposed / evidence / missing — **yes**.

### C4. Conflation check

* A score presented as probability? **No** in the UI. The probability appears only in planning (target attainment) and is mislabelled by proximity (B4). The decks promise it.
* **Long-outstanding balances stay visible: yes.** every non-excluded invoice older than 180 days is *Medium* or *High*, never *Low* (59 small-amount invoices >180 days are *Medium*; the large ones are *High*) — `priorityCore`; the dashboard aging chart keeps the 180+ bucket; the Decision Room `overdue_aging` item triggers on ≥10% of the aged balance.
* **Does age alone imply unrecoverable anywhere? No.** Searched `src/` and `server/` for unrecoverable / write-off / uncollectible: no hit used as a conclusion; the aging insight is typed «fact» with the caveat "the data does not record why a payer has not paid" (`insightsEngine.js:106–117`).

Synthetic result (all uncollected invoices, 293 incl. 136 excluded): High 34 invoices = 5.12 bn (≈ 62% of the 8.32 bn standing balance), Medium 80 = 2.14 bn, Low 179 = 1.06 bn (the excluded ones carry 0 net balance and are Low by rule).

RECOMMENDATION (no model without data): keep the explainable rules; **add one sentence of limits to every priority explanation** ("based on amount, age, evidence quality and recorded objection; payment history, prior follow-up and recoverability are not assessed"); present «collection probability» as **not available — requires labelled payment outcomes and calibration per HLSD AC-10**.

---

## D. Dashboard insights and Decision Room (R5)

### D1. Dashboard `/insights` (VERIFIED, `InsightsDashboard.jsx`)

Order: scope line → **Financial overview** (gross · exclusions · net · collected · uncollected · collection rate, gross-based rate not shown) → **From gross billed to collected** (3 charts: waterfall, collected share, **aging of the uncollected balance**) → **Performance over time** (cumulative net billed vs collected) → **Performance breakdown** (Amanahs / sources, with municipality drill) → geographic analysis + changes → **Top findings to review** (the Decision Room's top 4, same item model).

| Journey question | Answered by | Gap |
|---|---|---|
| Where do we stand? | tiles + waterfall + trend | the standing balance, overdue and not-yet-due are not tiles (A1) |
| Biggest issues? | breakdown by Amanah/source, aging chart, Top findings | — |
| Likely to collect? | **nothing on the dashboard** | forecast lives only on `/planning`; **no link** from the dashboard to it (`grep /planning` in `src/components/insights`, `ExecutiveParts`, `decisions`: none) |
| What next? | Top findings → Decision Room | — |
Exposure visibility: aging chart (long-outstanding), Decision Room items by Amanah / source / plan deviation; forecast gaps only in `/planning`.

### D2. Decision Room `/decisions` (VERIFIED: code + 24 + 13 tests)

* Six categories, an item exists only where the data supports it; each item: question, what happened, affected Amanah/municipality/source, labelled measure (exposure · gap · overdue · amount · count) with basis, comparison basis, **facts / calculated / unknown / proposed** kept apart, evidence links with status (source record / calculated / unverified / missing), High-Medium-Low with visible thresholds, `verification`, disclosed `overlap`, `additive` flag, `condition.open` (financial condition from the data).
* **Follow-up model preserved** (`decisionStore.js`): `none → flagged → followed_up` (+ unflag), note, history `{at, by, action}`; stored on the device (key `ib_decision_followup_v2`); the v1 store is migrated once. No assignee, owner, due date. «تمت المتابعة» never means resolved.
* **Proposed / recorded follow-up / completed / verified result:** proposed = the item (`proposed[]` is "never an approved decision"); recorded follow-up = flag + note + audit entry; completed = «تمت المتابعة»; **verified result = the data itself** (`ConditionChip`, `DecisionDetail.jsx:46`: "Financial condition (from the data)", an issue stays open after follow-up until the numbers change). There is no separately recorded "verified outcome" — by design.
* Duplicates / double counting: keys unique and stable; symmetric overlap notes; `financialTotal` only for `additive` Amanah overdue items (test asserts disjoint cells); `summaryOf` follows the filtered list.
* **Expected benefit:** none in the Decision Room (regex tests forbid "expected recovered revenue", recovery probability, owners, deadlines). Elsewhere: `proposals.js` `expectedImpact` is typed *upper bound* / *estimate* with notes ("not all collectible"); Smart Reports shows "Upper-bound impact: +x pp (arithmetic, not a forecast)" for exclusion-review cards. No uplift or savings figure exists anywhere in the demo. The only uplift/saving claims are in the **official deck KPI table** and are not evidenced by the demo (SIMULATION at best).
* Not removed but inconsistent: Smart Reports recommendations still print «Responsible: … Timeframe: …» (proposed) from `revenueInsights.js` cards (`smartReport.js:119`), while the Decision Room deliberately carries no owner or deadline (GAP-R4-1).

---

## E. Calculation and workflow integrity

### E1. Identities and ratios (VERIFIED: `engine.js:301–308 checkEquation`, `probeA`, tests)

| Rule | Check |
|---|---|
| Net = Gross − Exclusions (cancelled + rule exclusions, each invoice once) | YTD: 15.82 − 3.21 = 12.61 bn, diff 0 (`engine.js:219,225`: `exclAmt = billed − received`, `D.exclTotal = billed − net`) |
| Uncollected = Net − Collected | 12.61 − 8.72 = 3.89 bn, diff 0 |
| Rate = Collected ÷ Net × 100 | 8.72 ÷ 12.61 = 69.1%; `ratio()` returns `calculable:false` for a zero/invalid denominator (`revenueMetrics.js:37`) — never 0% |
| Overall rate = Σ collected ÷ Σ net (not an average of rates) | `equation.collectionRateFromSums` |
| Gross-based rate separately labelled | exists (`collectedOverGross` 55.1% YTD) **only** in the metric directory (`revenueMetrics.js:764`, "Analytical view … Not labelled official"); **not on any dashboard** |
| Parts sum to the whole | months, municipalities, status, Amanah, source, scope, matrix, reasons+cancelled = exclusions (`snapshot.equation`) |
| Each invoice once under its effective reason | primary reason by priority, `nReasons`, `overlapCount` (`engine.js:195` primary reason by priority, `:212` excluded, `:225`; `exclusions-register`, `enforcement-exclusion` tests) |
| Grain / dates | invoice grain; invoices by issue date, collections by payment date, cutoff = reference date; `periodEnd` mode exists; payments capped per invoice in `series(capped)` |
| Reversals / over-payment | `overpayment = received − base` kept apart (`engine.js:217`) |
Stale text: `revenueMetrics.js:762` still says "exclusion rules are unresolved, so this is not labelled official", while the 29 Oct status update says the methodology and exclusion reasons are approved (GAP-X-1).

### E2. Source authority and mirrored payments

Payments are stored once per payment record with a channel (`st.pCh`); `enforcementCollections.js` counts each payment once by record id however many orders link the invoice (test "each payment is counted ONCE"). Tahseel is the dictionary's collection source (`metricDictionary.js`). A generic "same payment mirrored from two sources" case is **not generated** in the synthetic world: VERIFIED only for the enforcement-channel case; the general rule is **UNVERIFIED** until real multi-source payment extracts exist.

### E3. Sanad workflow rules — enforcement points and tests

| Rule | Code path | Test | Status |
|---|---|---|---|
| Structured reference / amount match first | `src/data/sanadWorkflow.js` header principles; `server/orderMatch.js resolveReferences` (exact match; never on amount; ambiguous ≠ chosen) | `sanad-workflow` a) b) c) | VERIFIED |
| Extraction / manual entry when missing, invalid or inconsistent | `sanadWorkflow.js` banners `no_numbers`, `not_found`, `corrupted`, `manual`; same single path for every origin | scenarios d) e), 5, 8, 9 | VERIFIED |
| User confirmation before a link is confirmed | reducer-enforced; unconfirmed extraction / proposal changes nothing | "an UNCONFIRMED extraction … changes NOTHING"; `enforcement-exclusion` "a PROPOSED link … change nothing" | VERIFIED |
| Confirmed linkage → exclusion on the **uncollected remainder** | `engine.js:193 m |= SND_BIT` when an order exists or link ∈ 2–4; `exclAmt = billed − received` (`:219`) | "amount basis … the UNCOLLECTED REMAINDER"; fully collected → not excluded (D10 `ignoredExclusion`) | VERIFIED |
| No duplicate exclusion across reasons / orders | one primary reason, `exclTotal` once; evidence lists every order | "counted ONCE however many orders"; "not counted twice" | VERIFIED |
| A conflict flag creates no extra deduction | `D.enfConflict` is a flag only; S9 `stays` keeps the invoice billed | "source-CANCELLED … flagged; no amount … changes" | VERIFIED |
| Enforcement closure is not proof of payment | payment status and `collected` read payments only; `closed` link keeps the exclusion until revoked | "enforcement is not payment …"; enforcement-collections "never inferred from order status" | VERIFIED |
| Tahseel authoritative for collection | collected = payment records; Sanad order amount never counts as collected | as above | VERIFIED |
| No «Najiz» | `grep -rni 'najiz\|ناجز' src server` — no hit | — | VERIFIED (code) |
The amount basis ("uncollected remainder") is recorded as an implementation assumption, not a confirmed business decision (`enforcement-exclusion` test title).

### E4. Proposed metric changes — definition cards (for the register agent)

**M1 — Aging bucket 181–365 / over 1 year (GAP-R2-2)**
Business definition: standing uncollected net balance by age past due date at the reporting date. Formula: bucket(days) with days = max(0, cutoff − (due + grace)); not due = 0; 1–30; 31–90; 91–180; 181–365; >365. Source fields: due date, payments, exclusion/cancellation flags (same `derive`). Grain: invoice. Date basis: cutoff (reporting date) + `graceDays`. Filters: same scope as the snapshot (standing: all issue periods). Missing data: due date blank → separate «due date unavailable» bucket, never a day-bucket. Sum of buckets = standing net balance (existing check `aging_sum_eq_net`).
**M2 — Standing balance headline (GAP-R2-4)**: no new metric; surface `stock.netUncollected`, `stock.overdue`, `stock.notYetDue` (already identities: overdue + not yet due = standing) with the label «الرصيد القائم عند تاريخ القطع — كل فترات الإصدار».
**M3 — Expected collections for the remaining period (GAP-R3-1)**: *Business definition:* cash expected from the reporting date to the end of the fiscal year. *Formula:* the existing `estimate − collected` (= expected remaining) shown beside `collected`; optional split into «existing receivables» / «future billing» **only after** recovery and billing assumptions are supplied (00 §3 items 3–4). *Source:* payments by payment date (Tahseel), net billing by issue month. *Grain:* month × entity. *Date basis:* reporting date. *Missing data:* fewer than 3 closed months → say "not enough history", not a number.

---

## F. Opening slides and business impact (R1) — summary (full storyline in `06-opening-slide-storyline.md`)

Verified from slide text (python-pptx / pdftotext):

| Deck | Structure | Starts with the problem? | Evidenced scale? | Measurable outcomes? |
|---|---|---|---|---|
| Intro AR (7 Sep / 13 Oct, 7 slides) | title → 5 challenges → 5 AI improvements → KPI table → 12 agents/capabilities → KPI basis | **yes** (slide 2) | only "15+ sources", "3–5 days manual" | KPI table: expected collected revenue (baseline + uplift assumption), productivity value, hours saved, AI adoption — **none measures receivables outcomes** |
| 20 Oct SH meeting (7 slides) | architecture, sources (6), squad, roadmap | n/a (delivery status) | none | none |
| SH Review #09 (27 Oct, PDF) | recap actions → status → spotlight (problem → improvements → timeline → KPIs → agents) → next steps | yes (slide 8) | "6 sources", "3–5 days" | same KPI table |
Findings: the problem is stated qualitatively; **no receivable-scale evidence** (overdue exposure, aged share, collection rate, concentration); "decisions currently difficult" appear only as one rhetorical question; the KPI set does not include overdue exposure, collection rate, time to identify priority cases, follow-up completion or forecast error; the **collection-probability claim** is not supported by the demo.

## G. Shared Services examples (R7) — summary

| Example | Local? | Dummy data? | Reproduced by the demo? |
|---|---|---|---|
| Monthly revenue & collection reports (Jan–Mar, Jul 2026) | yes | **no — real** | structure and definitions mapped (`monthly-reports-mapping-ar.md`); Smart Reports exports (PPTX in MOMAH template, DOCX, XLSX, PDF, CSV) reproduce the report structure with synthetic data; verified by export parity |
| Strategic / planning dashboard | no SS file | — | `/planning` (target · estimate · actual · map) built from D-xx meeting requests |
| Financial performance dashboard | generated by the demo (5 Nov) | synthetic | yes (`InsightsHub` export) |
| **Representative reports/dashboards/documents with dummy data supplied by Shared Services with AI Champion** | **not supplied** | — | **dependency D-4** |

## H. Pages and routes inventory (feeds the screenshot index)

| Route | Component | Primary calculation / data |
|---|---|---|
| `/` → `/insights` | `InsightsHub` → `InsightsDashboard` (+ `RevenueAnalysis`, `DecisionSummary`) | `snapshot.totals`, `stock.aging`, `byMonth`, `byAmanah`, `bySource`; export `buildDashboardModel` |
| `/decisions` (menu: under dashboard) | `DecisionRoom` | `buildDecisionItems`, `priorityOf`, `summaryOf`; follow-up store |
| `/planning` (`/strategic`, `/decision-room`, `/what-if` redirect here) | `PlanningArea` (+ `TargetsPanel`, `PlanForecast`, `EntityMap`) | `computeGoal`, `entityTargets`, `forecastYear`, `loadPlanInputs` |
| `/smart-reports` (`/assistant`, `/reports` redirect) | `SmartReportsPage` / `SmartReports` + floating assistant | `reportModel`, `analysisTasks`, `forecastReceipts`, rule-based router; 5 exports |
| `/collection` | `Collection` → `InvoiceListTable(mode=uncollected)` | `list(state=uncollected, withPriority, facets)`, `priorityCore` |
| `/invoices`, `/invoices/:id` | `Invoices`, `InvoicePage` | `list`, `materialize` |
| `/exclusions` | `Exclusions` (+ upload) | exclusion register, `exclusionUpload.js` |
| `/enforcement`, `/enforcement-orders/:enforceNum`, `/enforcement/violations/:key` | `EnforcementHome`, `EnforcementOrderPage`, `EefaaViolationPage` | `orderMatch.resolveReferences`, `sanadWorkflow.js`, `enforcementCollections.js` |
| `/contracts`, `/contracts/:no`, `/products/foras` | `FurasContracts`, `FurasContract`, `FurasProduct` | local Databank-schema subset (`furasData.js`) |
| `/collection?analysis=noncollection`, `/analysis/:taskId` | `AnalysisResultPage` (`nc/*`) | `nonCollectionAnalysis` (reasons, process, quality, aging, Amanah, source, heat) |
| `/products`, `/products/:key` | `Products`, `ProductPage` | data-source cards (no financial filters); product KPIs |
| `/settings/metrics`, `/settings/metrics/:id` | `Metrics`, `MetricDetail` | dictionary (no aging / priority / estimate entries — GAP-R5-3) |
| Exports | `ExportDialog` (PDF, PPTX native/template, DOCX, XLSX, CSV); list CSV `exportChunks` | `exportReportModel.js`, `lists.js:387` |
| Filters / access | `ScopeFilters`, URL filters, `rev.org.amanahKeys` | `resolveScope` (org, Amanah, municipality, source, status); parity verified in A5 |

## I. Limits of this review

* Behaviour was verified at the **service and unit level**, not by browser; screenshots belong to agent R2. Nothing in the files read looked in flux except chart code under `src/components/charts` and `src/data/chart*` (another agent), which the findings do not depend on.
* The synthetic world is small (929 invoices) and has no undated invoices, no multi-source payment mirrors and no real payment history: findings about those are code-level.
* The Databank-schema Furas subset is local and confidential; no values were read or recorded here.
* The probability, forecast and uplift **cannot be validated** with synthetic data; none of the statements here assess forecast accuracy.

---

## Update 2026-11-06 (post chart library) — agent R3 corrections (full evidence in `08-verification-addendum.md`)

The platform changed while this review was written (shared chart library, collection-rate card). Re-read at the time of this update; the rows below are **changed or corrected** — everything not listed here stands. Labels as above.

| § / item | What changed | Status |
|---|---|---|
| §I «chart code in flux» | Settled: `chart-integration` 29/29, `chart-requests` 35/35, `chart-picker-ui` 27, `chart-export` 79, `chart-catalog` 41, `chart-data` 20, `invoice-lists-ui` 28 re-run and pass. | **CHANGED** |
| §H routes | `/invoices` now carries the card «نسبة التحصيل ضمن النطاق» (`CollectionRateCard.jsx`, `Invoices.jsx:144`; net-based, `na` instead of 0 %, tested). Dashboard `/insights`, `/analysis/:id`, `/exclusions`, `/invoices`, `/collection` and Smart Reports now offer the chart picker «تغيير الرسم»; saved choices (`view.charts`) reach the Smart Reports / dashboard / NC exports. | **CHANGED** |
| §A1 aging buckets | Still 5 buckets (`engine.js:314–315`). New: the picker offers a **histogram of days overdue** on the aging charts (60-day bins `1–60 … 721–780`, count + amount per bin) so the >180-day tail is visible in finer slices; not the requested 181–365 / >365 buckets; GAP-R2-2 remains. | **CHANGED (exposure), gap open** |
| §A1 / headline 5 (two totals) | Re-traced to the SAR: 3,889,535,253 (period cohort) + 4,433,134,471 (issued before the period) = 8,322,669,724 (standing); difference 0.0 for national, Jeddah and Riyadh. The dashboard still does not say «all periods» beside the aging chart. | **CONFIRMED & explained**, labelling gap stays |
| §A1 `agingPlanning` «third scheme» | `agingPlanning` is computed (`engine.js:460`) but **no code reads it**; it is not a user-visible scheme. | **CORRECTED** |
| §B4 wording row `assistantAnswers.js:82` | The quoted sentence is no longer in that file (the file was edited during the review). The «approved … (demo input)» pairing persists at `smartReport.js:101`, `revenueInsights.js:364` (label «المستهدف السنوي المعتمد (مُدخل توضيحي)») and `revenueOutlook.js:4`. GAP-R3-3 stands, evidence moved. | **CORRECTED** |
| §B4 `PlanForecast.jsx:46` | Unchanged; additionally the tile is colour-coded green/amber/red at 70 % / 35 % (`PlanForecast.jsx:20`), which gives the unvalidated statistic a verdict colour. | **ADDED** |
| §D1 «dashboard never links to the forecast page» | True for the dashboard; the **uncollected list header links to planning** («هدف التحصيل السنوي», `Collection.jsx:127`) — not recorded before. | **CORRECTED** |
| §D1 dead UI | `UncollectedBridge`, `PriorityDebt`, `ChangeExplanation` (`ExecutiveParts.jsx`) are unused; no on-dashboard net-uncollected bridge is shown. | **ADDED** |
| §C / R4 | NC priority cards print «Owner · deadline (suggested)» (`NcPriorities.jsx:30`) — one more surface in GAP-R4-1. | **ADDED** |
| Everything else in §A–§G (identities, drill-through parity, hierarchy, forecast method, prioritisation rules, slides, Shared Services) | re-read; not affected. | unchanged |
