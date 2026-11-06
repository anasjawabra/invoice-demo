# 02 — Coverage matrix: Sector Head feedback R1–R7 against the platform as it is on 2026-11-06

Agent R1 · REVIEW ONLY · evidence is in `01-current-state-review.md` (section references like «01 §A5») and `00-materials-and-dependencies.md`.
Classes: **Fully** (works and satisfies — retain, no action) · **Partially** (exists; a specific refinement is needed) · **Missing** · **Unverifiable** (evidence, data or access insufficient).
Every row is a statement about behaviour that was **read or run**; a card, title or button was never taken as proof. Numbers are the **synthetic demo baseline**. Provisional gap keys (`GAP-…`) are for the register agent; each is listed once in §D and consolidated into one action per theme in §E.
Intended journey: **What is owed → Who owes it → What we expect to collect → What needs attention → What actions we should take.**

## Consolidated summary (added by S1, 2026-11-06 — final classes after the register; the detailed rows below are unchanged)

Action IDs refer to `03-developer-action-register.md` (Part A = current data, Part B = needs data/methodology, Part C = business actions). Screens are files in `screenshots/`. **Review only — no SH refinement is implemented.** Figures in the evidence column are the synthetic demo baseline. Classes did not change after S1's re-reading; two evidence items were added (see «S1 notes» below the table).

| Req | Class | One-line why | Action IDs (A = now · B = blocked · C = business) | Demo evidence screenshot |
|---|---|---|---|---|
| **R1** Business impact | **Partially** | Problem comes first but is qualitative; no scale figures; KPI set does not measure receivables outcomes; the per-invoice «collection probability» claim is not backed by the demo; editable #09 deck not local | A: SH-A11 (probability claim removed from the platform's own wording) · C: SH-A30(a), SH-A32 · storyline `06` (updated by S1) | `01b-insights-dashboard-full-ar.jpg` (the baseline figures reproduce on `/insights`) |
| **R2** Receivables visibility | **Partially** | Identities, drill parity, hierarchy, scope sound; gaps: debtor absent from uncollected list/CSV, five buckets not six, undated receivable mis-bucketed in the snapshot, two outstanding totals not labelled, one drill link opens a different population | A: SH-A01, A02, A03, A04, A14, A19 · B: SH-A23, A25 · C: SH-A31, A33 | `01b-insights-dashboard-full-ar.jpg`, `04-collection-uncollected-list-top-ar-v2.jpg`, `14-uncollected-list-rows-ar-v2.jpg`, `07-invoice-detail-top-ar.jpg` |
| **R3** Revenue forecasting | **Partially** | Explainable illustrative run-rate with target, deviation, reasons; no assumptions/method/version panel, remainder not stated, a bare «probability», two targets and two methods for one scope | A: SH-A06, A07, A08, A09 · B: SH-A20, A21, A22 · C: SH-A26, A27 | `23-planning-forecast-vs-target-ar.jpg`, `24-planning-probability-wording-ar.jpg`, `20b-planning-landing-full-ar.jpg` (reasons and «أين نركز») |
| **R4** Collection prioritisation | **Partially** | Explainable High/Medium/Low priority keeps long-outstanding balances visible; probability, delay risk and recoverability do not exist and cannot be validated — state so; three differently derived «High» labels; limits not stated | A: SH-A11, SH-A02, SH-A09 · B: SH-A24 (record, do not build) · C: SH-A33 | `15-uncollected-priority-badge-popover-ar.jpg`, `134-analysis-tab-priorities-invoices-ar-v2.jpg` |
| **R5** Dashboard and UI/UX | **Partially** | Decision Room, Top findings, NC priorities, chart picker fully satisfy the ask; chart-led defaults state no message, journey lacks dashboard → Planning and a sidebar entry for the Decision Room; guideline conformance Unverifiable | A: SH-A05, A10, A12, A13, A15, A16, A17, A18, A19 · C: SH-A29, SH-A34 | `30-decision-room-top-ar.jpg`, `122-dashboard-aging-chart-changed-to-horizontal-v2-ar.jpg`, `70-metrics-dictionary-ar.jpg` |
| **R6** Forecasting alignment | **Unverifiable** | No methodology, models, inputs, assumptions, drivers or version exist locally; alignment pending | A: SH-A06 (disclosure + «alignment pending» line) · B: SH-A20 · C: SH-A26, SH-A27 | `23-planning-forecast-vs-target-ar.jpg` |
| **R7** Shared Services examples | **Missing (dependency)** | Nothing supplied after 27 Oct; the monthly reports are real data and pre-date the feedback; the demo reproduces their structure with synthetic data | C: SH-A28 (+ SH-A34 for the real-viewer check) | `61-smart-receivables-report-ar.jpg`, `173-smart-export-dialog-chart-block-ar-v2.jpg` |
| **Overdue-invoice reports** (addendum R4: general · by Amanah · by municipality · by revenue source; `09-overdue-reports-review.md`) | **Partially** (none of the four exists; the data and calculation do) | Phrased in Smart Reports, the four titles return the generic revenue report built from the collection-class filter (collected 0, rate 0.0 %); the class drops 15 invoices / 369.41 m (cohort) and 29 / 707.30 m (standing); default issue window hides 65 invoices / 4.43 bn; Smart Reports drill loses the overdue filter (23 → 57 → 29); appendix lacks debtor and municipality and mislabels the product as source; the NC analysis already holds the overdue population, partition (Σ Amanah = Σ municipality = Σ source = Σ aging = 138 / 7,743,038,344 standing) and chart → invoices drill | A: SH-A35, A36, A37, A38, A39, A40 (extend SH-A02, A03, A04, A16, A18) | `190-overdue-general-report-top-ar.jpg`, `191-overdue-by-amanah-top-ar.jpg`, `201-drill-from-overdue-report-landing-collection-ar.jpg`, `203-nc-analysis-overdue-by-amanah-municipality-ar.jpg` |

**S1 notes (evidence added or corrected, no class changed):** (1) the on-screen Planning target is 21.59 bn (screenshot 24) while the report/chat path reads `DEFAULT_TARGETS` (11.495 bn in R1's probe) — a visible instance of the «two target sources» finding (SH-A08); R1's «2 %» probability and −0.53 bn deviation were computed against the latter, the page shows 1 % and −9.14 bn. (2) `assistantAnswers.js:82` carries the phrase «approved annual target (a demo input …)» again on re-read (08 had recorded it removed; the file is in flux). (3) Already refined on 2026-11-06 at the user's request, not SH actions: Collected-page card «نسبة التحصيل ضمن النطاق» (R2.20), Exclusions page (one reasons table, three KPI cards, neutral colours), InfoTip tooltip (hover shows, click pins; re-check pending). (4) New verified hygiene item: legacy i18n strings promising a «recovery probability» have no consumer (SH-A11 (c)).

## A. Overall verdict per requirement

| Req | SH feedback (short) | Class | One-line reason |
|---|---|---|---|
| **R1** | Opening slides: business problem, figures, measurable outcomes before features | **Partially** | The problem comes first, but it is qualitative; no receivables-scale evidence; KPI set does not measure the receivables outcomes the demo supports; one capability claim (collection probability) is not backed by the demo. Editable deck of 27 Oct not local. |
| **R2** | Receivables visibility: outstanding, due, who pays | **Partially** | Arithmetic, drill-through, hierarchy and scope are sound. Gaps: debtor missing from the uncollected list and export; 5 aging buckets not 6; undated receivables mis-bucketed in the snapshot; two outstanding totals not reconciled on screen. |
| **R3** | Revenue forecasting: expected annual revenue, assumptions, drivers, actions | **Partially** | An explainable run-rate with target, deviation, reasons and focus exists and is labelled illustrative. No assumptions/drivers/method/version panel, no split of expected remaining, no scenarios, no expected-billing forecast, a bare "probability", and demo targets called "approved" in one place. |
| **R4** | Collection prioritisation: delays, probabilities, aging, recoverability | **Partially** | Explainable High/Medium/Low **follow-up priority** exists and keeps long-outstanding balances visible. **Collection probability, delayed-payment risk and recoverability do not exist and cannot be validated with the data available** — do not build them; say so. |
| **R5** | Dashboards and UI/UX: insights, issues, priorities, actions, MOMAH guidelines | **Partially** | Decision Room and Top findings meet the ask; journey lacks «what we expect» on the dashboard and a link to it; guideline conformance is **Unverifiable** (kit not local). |
| **R6** | Forecasting alignment with Dr. Muath / Abdulmajeed / teams | **Unverifiable** | No methodology, models, inputs, assumptions, drivers or version found anywhere locally. **Alignment pending** — exact input list in `00 §3`. |
| **R7** | Shared Services examples with dummy data (+ AI Champion) | **Missing** (dependency) | Nothing supplied since the feedback. Existing monthly reports are real data (not dummy) and pre-date the feedback; the demo already reproduces their structure with synthetic data. |

---

## B. Detailed matrix

Columns: **Class** · **Where it exists / how to demonstrate** · **Calculation references** · **Precise gap** · **Smallest refinement (key)**.

### R1 — Business impact in the opening slides

| # | Ask | Class | Where / how to demonstrate | Calculation / evidence | Precise gap | Smallest refinement |
|---|---|---|---|---|---|---|
| R1.1 | Start with the business problem, not features | **Fully** | SH Review #09 slide 8 and intro decks slide 2 («Current challenges …» + question «which invoice deserves urgent follow-up?») | slide text (00 §2) | — | Retain. |
| R1.2 | Problem with **evidenced scale** (figures) | **Missing** | none; only "15+ sources" (old) / "6 sources", "3–5 days manual" | 01 §F | No overdue exposure, aged share, collection rate, concentration. The platform can compute a labelled **synthetic baseline** (standing balance 8.32 bn; 93% overdue; 74% older than 180 days; two entities hold 82% of the over-180-day balance) | **GAP-R1-1** one evidence slide using labelled synthetic baseline figures (`06` slide 3) |
| R1.3 | Decisions that are difficult today | **Partially** | one rhetorical question on slide 8 | — | not tied to the decisions the demo supports (which receivables to chase, where the plan slips, which links to confirm) | **GAP-R1-1** (same slide set, `06` slide 4) |
| R1.4 | How IIM supports those decisions | **Partially** | slides 9, 12 (improvements, agents) | `/collection`, `/decisions`, `/planning` | includes «يعالج النظام احتمالية تحصيل كل فاتورة …» which the demo does not implement (R4.3) | **GAP-R1-3** reword to «explainable follow-up priority (rules)»; show probability as pending validated data |
| R1.5 | How outcomes are **measured** | **Partially** | KPI table (slide 11) + basis (slide 19): expected collected revenue, productivity, hours saved, AI adoption | official figures (not reproduced) | none of: overdue exposure, collection rate, time to identify priority cases, follow-up completion, forecast error; uplift is an assumption with no demo evidence | **GAP-R1-2** measure set with four labels: observed baseline / proposed target / illustrative scenario / measured result (`06`) |
| R1.6 | Editable deck updated | **Unverifiable** | only a PDF of #09 is local | 00 D-6 | cannot confirm the update (action 5) | dependency D-6 |

### R2 — Receivables visibility

| # | Ask | Class | Where / how to demonstrate | Calculation references | Precise gap | Smallest refinement (key) |
|---|---|---|---|---|---|---|
| R2.1 | Total outstanding receivables | **Partially** | `/insights` tile «غير المحصّل» (period cohort, 3.89 bn) vs aging chart total «الرصيد القائم» (standing, 8.32 bn); `/collection` KPI strip (total / excluded / net unpaid for the chosen period) | `engine.js` `totals.outstanding` vs `stock.netUncollected` (`:453`); list over all periods = 8,322,669,724 = stock | two totals, different meaning, same page; standing not a tile | **GAP-R2-4** tile «الرصيد القائم عند تاريخ القطع — كل فترات الإصدار» next to the period tile; same figure the aging chart already uses |
| R2.2 | Overdue and not-yet-due amounts | **Partially** | `/collection` «Due position of the net unpaid» bar (overdue / not yet due / unknown); dashboard aging chart (bucket 0 = not yet due) | `stock.overdue`+`stock.notYetDue` = standing exactly (7.74 + 0.58 = 8.32); `lists.js:121,126` | not headline figures on the dashboard | **GAP-R2-4** |
| R2.3 | Debtors responsible for payment (distinct from managing entity) | **Partially** | rows carry `payerAr/En` (debtor), Amanah + municipality (managing entity), biller; shown in the collected list, invoice register, invoice page, non-collection invoices | `lists.js:71–82`; `CoreInvoiceTable.jsx:78,97` | **uncollected list shows Product, not the debtor; details row has no payer; CSV has no payer column** (`lists.js:387`); Arabic «المفوتر» (issuer) vs «الجهة المفوترة» (debtor) | **GAP-R2-1** add payer (name + id status) and contract no. to the uncollected details row and CSV; rename the issuer line to «الجهة المُصدِرة (المفوتر)» |
| R2.4 | Debtor-level view (who owes most) | **Missing** | none; search by payer exists; Sanad page lists same-debtor invoices | `orderMatch.js:77` | no grouping by payer in snapshot or list | **GAP-R2-1(b)** optional, only after payer-id uniqueness is confirmed (D-10); do not invent a key |
| R2.5 | Revenue source | **Fully** | `/collection` «Unpaid by revenue source» (click filters), details row, `/insights` breakdown, CSV `revenue_source` | `bySource`, list facet `source` | — | Retain. |
| R2.6 | Invoice number / composite identity | **Fully** | list first column, invoice page, CSV `invoice_number`, `invoice_composite_key` | `docs/invoice-composite-key.md`; `lookupRef` ambiguity handling | — | Retain. |
| R2.7 | Contract | **Partially** | invoice page «Related investment contract» (investment only); CSV `contract_no` | `rowOut.contractNo` | not in the uncollected list or its details row | **GAP-R2-1** (same change) |
| R2.8 | Due date; outstanding balance | **Fully** | details row «Due date», «Net unpaid», invoice page summary, CSV `due_date`, `outstanding_sar` | `D.outstanding = billed − received` unless excluded/cancelled (`engine.js:218`) | — | Retain. |
| R2.9 | Payment history | **Fully** | invoice page «Payments» tab (date, amount, channel) | `paymentFacts` | — | Retain. |
| R2.10 | Disputes / objections | **Fully** | invoice finding «اعتراض مفتوح»; row `objectionStatus` (Mumtathil status, whether it excludes); non-collection reasons | `engine.js:188` (R7 rule) | — | Retain. |
| R2.11 | Exclusions | **Fully** | details row reason + amount + badge; `/exclusions` register; tests | 01 §E3 | — | Retain. |
| R2.12 | Enforcement status | **Fully** | invoice page «Enforcement orders»; list filter «enforcement»; non-collection process view; `/enforcement` | `D.link`, `stock.enforcement` | — | Retain. |
| R2.13 | Aging buckets: not yet due · 1–30 · 31–90 · 91–180 · 181–365 · >1 year | **Partially** | dashboard aging chart; non-collection «aging» chart and drill; Decision Room aged-180 item | `engine.js:314–315`: 0 · 1–30 · 31–90 · 91–180 · **180+**; `noncollection.js:14` same + `unavailable`; planning scheme `engine.js:357` (different cut points) | **181–365 and >1 year not split**; 74.3% of the standing balance is in the unsplit bucket (synthetic) | **GAP-R2-2** split bucket 5 into 181–365 and >365 (engine, NC, charts, exports, tests); keep Σ buckets = standing net; formula card M1 in 01 §E4 |
| R2.14 | Visible reporting date and due-date basis | **Partially** | cutoff in `DataStatus` strip and export footers; basis text in Smart Reports assumptions («grace: N days (unresolved)») | `lateness.js`; `cfg.graceDays` default 0 | the aging chart does not say "days past due date + grace"; grace rule unresolved (EQ2; monthly reports use 5/10/15/35) | **GAP-R2-2** caption «العمر = تاريخ القطع − (تاريخ الاستحقاق + فترة السماح)» + show the grace value; rule itself PENDING (D-9) |
| R2.15 | Missing due dates visibly separate | **Partially** | non-collection analysis `unavailable` bucket; list due facet `unknown`; priority «never read as overdue» | **snapshot.stock.aging / overdue count an undated invoice as >180 days** (`engine.js:220`, reproduced in memory: 41.2 m stays in 180+) | inconsistent between consumers; not demonstrable in the synthetic world (0 undated invoices) | **GAP-R2-3** bucket «due date unavailable» in `stock.aging` + chart + reconciliation check |
| R2.16 | Unidentified debtors visibly separate | **Partially** | «معرّف المدين ناقص» (non-collection quality bucket, action group, list flag `missing_fields`) | `F.MISSING_ID`, `noncollection.js:75` | only "missing id number" is modelled; a debtor with no name is not | note in R2 caption; no new work until real data shows other forms |
| R2.17 | Summary → list drill-through keeps filters and totals | **Fully** | any chart mark / KPI → list; `/collection?analysis=noncollection` marks | `probeA`: counts, gross, net, uncollected equal in 5 scopes incl. municipality and restricted org; `nc-drilldown` 13 tests; export parity 3291/3291 | standing balance needs the period widened (not stated on the aging chart) | add a «show all periods» note on the aging chart (within **GAP-R2-4**) |
| R2.18 | Contract installments without verified invoice links kept separate from invoice-backed receivables | **Partially** | Decision Room categories `contracts:unlinked`, `contracts:no_contract` (proposed rule label, `needs_verification`, arrears "for context only"); contract pages state collected/unpaid «not available» | `useDecisions.js:41` uses generated schedules; contract pages use the Databank subset | two different populations; the Databank pages cannot show invoice links at all (no key in exports) | **GAP-R2-5 — PENDING** Databank payment-to-invoice key; until then keep the «not available» statement |
| R2.19 | Amanah → municipality hierarchy respected everywhere | **Fully** | Amanah filter → dependent «البلدية» filter on lists, dashboard breakdown, NC analysis, Decision Room evidence links, Smart Reports interpretation, exports | `municipality` (24) + `municipality-downstream` tests pass; Jeddah municipality rows partition the Amanah (112 = 112) | — | Retain. |

### R3 — Revenue forecasting

| # | Ask | Class | Where / how to demonstrate | Calculation references | Precise gap | Smallest refinement (key) |
|---|---|---|---|---|---|---|
| R3.1 | Expected annual revenue | **Partially** | `/planning` tiles: annual target, collected, remaining; chart target / estimate / actual; «تقدير نهاية السنة» in the probability tile subtitle | `planForecast.js:24` (run-rate: avg of last ≤ 3 closed months) → 10.95 bn vs target 11.50 bn (synthetic) | labelled illustrative («تقدير تجريبي»); the estimate appears only as a sub-line of the probability tile | **GAP-R3-1** show «collected to date» and «expected for the remaining months» (= estimate − collected) as two stated figures |
| R3.2 | Expected **invoiced** revenue (billing) | **Missing** | only the last-3-month average net billing inside the ceiling; «required billing» is derived from the target | `forecastYear` `avgBilling` | no billing forecast | **GAP-R3-5 — PENDING** billing assumptions/drivers (00 §3 items 3–4); do not invent |
| R3.3 | Expected cash collections; existing receivables vs future billing without overlap | **Partially** | estimate (blended); ceiling = collected + standing + avg billing × months left | 9.21 + 8.32 + 2.21 = 19.74 bn — **disjoint populations, no double count** (probeB) | the estimate is not split; the ceiling assumes 100% recovery of a standing balance that is 74% >180 days, unstated | **GAP-R3-1** split only once recovery assumptions are supplied; meanwhile state «ceiling at 100% recovery; X% of the balance is older than 180 days» |
| R3.4 | Actual to reporting date vs expected remaining separated | **Partially** | chart distinguishes actual / estimate; tiles do not | `forecastYear` `collected`, `forecast` | remainder not a stated number | **GAP-R3-1** |
| R3.5 | Approved annual targets; status of targets | **Partially** | targets table (editable, saved on device, «آخر تعديل»); tag «بيانات توضيحية» | `appropriations.js` (illustrative), `DEFAULT_TARGETS.status = 'demo'` (`revenueMetrics.js:647–649`) | targets are demo inputs; SIMH approved targets pending (SH #09 slide 14) | **GAP-R3-4** one target source; **GAP-R3-3** status wording; real targets **PENDING** (D-3) |
| R3.6 | Forecast gaps (deviation, shortfall, reasons) | **Fully** | `/planning` «الانحراف عن المستهدف حتى تاريخه», reasons («billing insufficient» / «pace short»), «أين نركز» | deviation −0.53 bn = collected − planned-to-date (`forecastYear`); `focusRanking` | — | Retain. |
| R3.7 | Assumptions and drivers visible | **Missing** (`/planning`) / **Partially** (Smart Reports) | `/planning` has none; Smart Reports forecast section lists assumptions and limitations; dictionary «التقدير والاحتمال» | `revenueOutlook.js:149–160` | no "method & assumptions" panel on the planning page | **GAP-R3-1** panel generated from constants already in code (method, window = last ≤ 3 closed months, even plan, no seasonality, targets demo, cutoff) |
| R3.8 | Reporting date, horizon, history coverage, method, version | **Partially** | reporting date in the basis line; horizon implicit; history/method/version absent on `/planning`; `ols_trend_v1` on Smart Reports | `FORECAST_METHOD` | no horizon label, no coverage, no version on `/planning` | **GAP-R3-1** |
| R3.9 | Seasonality | **Missing** | even 1/12 plan; weights editable | `collectionGoal.js:27 evenPlan`; `DEFAULT_TARGETS.monthlyCurve` is a *different* curved shape | no seasonal model; two monthly shapes | **GAP-R3-4** (align shape) ; seasonal model **PENDING** (00 §3 item 3) |
| R3.10 | Recovery assumptions for outstanding balances | **Missing** | none | — | needed to expect cash from old receivables | **GAP-R3-5 — PENDING** |
| R3.11 | Base / conservative / improvement scenarios | **Missing** | code exists, unused (`revenueOutlook.js:202 applyScenario`); removed from planning on purpose (`planning-cfo-review-plan.md §6`) | — | no scenario definitions supplied | **GAP-R3-5 — PENDING** scenario definitions (00 §3 item 8); never as confidence intervals |
| R3.12 | Limitations stated | **Fully** | tag «تقدير تجريبي – للعرض التوضيحي»; footnote "not an approved model"; Smart Reports callout; trend band "not a validated confidence interval" | `PlanForecast.jsx`, `reportModel.js:303` | — | Retain. |
| R3.13 | Actions to improve collection | **Partially** | «أين نركز» (entity × source), reasons, link to uncollected list; Decision Room proposed steps | `focusRanking` | no explicit action list tied to the forecast | keep; link «أين نركز» items to the Decision Room item with the same Amanah (**GAP-R5-1**) |
| R3.14 | No wording that implies a validated AI forecast / confidence interval | **Partially** | acceptable: Smart Reports callout, band label; **to fix:** `PlanForecast.jsx:46` «Probability of reaching the target» (1–99% clamp, ≤ 3 points); `assistantAnswers.js:82` "approved annual target (a demo input …)"; two methods giving 10.95 vs 9.96 bn | `planForecast.js:30–43`; probeB | 3 strings and 1 duplicated method | **GAP-R3-2**, **GAP-R3-3**, **GAP-R3-4** |

### R4 — Collection prioritisation

| # | Ask | Class | Where / how to demonstrate | Calculation references | Precise gap | Smallest refinement (key) |
|---|---|---|---|---|---|---|
| R4.1 | Follow-up priority from aging and amount | **Fully** | `/collection` Priority column (sort «الأولوية: الأعلى أولاً»), priority badge opens its reason and factors; Decision Room priority with factor thresholds | `lists.js:334 priorityCore` (percentile amount tier × age tier; caps for evidence < 0.8 and objection); `decisionRoom.js:42–80` | — | Retain. |
| R4.2 | Payment delays | **Partially** | days overdue per invoice (list, invoice page); payment lateness of past payments only on contract cards | `lateness.js`; `server/contracts.js:32–38` | no lateness history by payer/Amanah | **GAP-R4-2** wording: «delay = days past due; payment-behaviour history not assessed» |
| R4.3 | **Collection probability** within a horizon | **Missing** — and **not buildable now** | none per invoice (decks promise it) | the only "probability" = planning target-attainment tail | needs labelled payment outcomes, history by payer, calibration/Brier by horizon vs non-AI baseline (HLSD AC-10) — unavailable (D-8) | **GAP-R4-2** wording; do **not** add a model |
| R4.4 | Recoverability | **Missing by design** | explicit statements «No recoverability is assessed» | `NcOverview.jsx:101`, `ncReportModel.js:16,49` | no data supports it | **GAP-R4-2** same wording |
| R4.5 | Long-outstanding amounts stay visible | **Fully** | aging chart (180+ = 74% synthetic), Decision Room `overdue_aging` (≥ 10% of aged balance), priority never Low for >180 days | `priorityCore`; probeC: 0 rows >180 days rated Low | — | Retain; improves with R2.13 split |
| R4.6 | Each prioritised case: why / evidence / next action / limitations | **Partially** | list: `why`, `factors`, `nextStep`; Decision Room: full | `lists.js:371 priorityRow` | limitation (what the rule does not consider) is not stated | **GAP-R4-3** one sentence in every priority explanation |
| R4.7 | Age alone never implies unrecoverable | **Fully** | grep of `src`/`server`: no write-off/unrecoverable conclusion; aging insight typed «fact» with caveat | `insightsEngine.js:106–117` | — | Retain. |
| R4.8 | One coherent prioritisation language | **Partially** | five rules: list tiers · Decision Room factors · planning focus · legacy numeric score (Smart Reports labels High if score ≥ 0.6, plus «Responsible/Timeframe») · NC action groups; dictionary/Handbook still document the numeric score as the list/Decision Room priority (M-15) | `smartReport.js:119`, `dictionaryDocs.js:168`, Handbook M-15 | users see three differently-derived "High" labels; stale docs | **GAP-R4-1** relabel Smart Reports recommendation priority to the list tiers or call the score a «ranking score»; drop owner/timeframe text; **GAP-X-1** docs |

### R5 — Dashboard and UI/UX

| # | Ask | Class | Where / how to demonstrate | Calculation references | Precise gap | Smallest refinement (key) |
|---|---|---|---|---|---|---|
| R5.1 | Dashboard answers where we stand / biggest issues / likely to collect / what next | **Partially** | `/insights`: overview tiles, 3 flow charts, trend, breakdown, Top findings (Decision Room) | `InsightsDashboard.jsx` | "likely to collect" absent; **no link to `/planning`** | **GAP-R5-1** one compact link/line «السنة مقابل الخطة» using the same `computeGoal`/`forecastYear` values — no new calculation, no duplicate chart |
| R5.2 | Outstanding / overdue / long-outstanding exposure, deviations by Amanah/municipality/source, priority cases, recommended actions | **Fully** (exposure, deviations, priority cases, actions) / see R2.1–2.2 for the headline totals | dashboard breakdown, aging chart, Decision Room items by Amanah / source, `/collection` priority | — | forecast gaps only on `/planning` (R5.1) | Retain. |
| R5.3 | Decision Room: issue, affected amount, supporting invoices/contracts, evidence, recommended action, follow-up status | **Fully** | `/decisions` (open an item: facts / calculated / unknown / proposed / evidence / missing; flag, note, history) | `decisionRoom.js` contract; `decision-room` 24 groups + `decision-followup` 13 pass | — | Retain. |
| R5.4 | Distinguish proposed / recorded follow-up / completed / **verified result** | **Fully** | item = proposed; flag + note = recorded; «تمت المتابعة» = completed (never "resolved"); **verified = the data's own condition** (`ConditionChip`, "Financial condition (from the data)") | `decisionStore.js` header; `DecisionDetail.jsx:46` | no separately stored "verified outcome" — by design | Retain; do not add owners/assignment. |
| R5.5 | No duplicate issues or double-counted benefits | **Fully** | stable unique keys, symmetric overlap notes, `financialTotal` only for additive items | tests; `summaryOf` | — | Retain. |
| R5.6 | Expected benefit only where defensibly calculated | **Fully** | none shown in Decision Room; Smart Reports: "Upper-bound impact: +x pp (arithmetic, not a forecast)" for exclusion review only | `revenueInsights.js` impact kinds | no uplift/savings figure anywhere in the demo | Retain; keep the official-deck uplift out of demo screens. |
| R5.7 | Consistent "no owner / no deadline" across surfaces | **Partially** | Decision Room has none; Smart Reports recommendations print «Responsible … Timeframe …» (proposed) | `smartReport.js:119`; cards' `responsible`, `timeframe` | contradicts the intentional removal of assignment | **GAP-R4-1** (same change) |
| R5.8 | Follow the agreed MOMAH UI/UX guidelines | **Unverifiable** | DGA foundations from the supplied PDF applied (tokens, 4 px grid, Arabic/English type, AI states); PPTX exports built in the supplied MOMAH templates | `docs/design-dependencies.md` | DGA guidance, Figma kit, MOMAH web guideline, Hugeicons licence not local | **GAP-R5-2 — dependency** (OT) |
| R5.9 | Definitions reachable (aging, priority, estimate) | **Partially** | `/settings/metrics` covers gross → net → collected → uncollected, standing, overdue, not yet due, rate, plan metrics | `metricDictionary.js` keys | no entry for aging buckets, High/Medium/Low priority, year-end estimate | **GAP-R5-3** three short entries (content) |

### R6 — Forecasting alignment

| # | Ask | Class | Where / evidence | Precise gap | Smallest refinement (key) |
|---|---|---|---|---|---|
| R6.1 | Methodology of Dr. Muath / Abdulmajeed / teams located and compared | **Unverifiable** | searched Downloads, Desktop, handover notes, repo (00 §1, §3): none. «Muath» = Data Bank lead; «Abdulmajeed» = a billing-target owner (garbled, unconfirmed) | no input exists to compare with | **GAP-R6-1** «alignment pending» stamp + the 11-item input list (00 §3) |
| R6.2 | Consistent sources, assumptions, forecasts for senior stakeholders | **Missing** | the demo itself runs two methods (run-rate, trend) and two target sources (planning store vs static `DEFAULT_TARGETS`) | cannot be "consistent with" anything yet | **GAP-R3-4** (internal consistency first) |
| R6.3 | Forecast disclosure per HLSD (horizon, uncertainty, freshness, version, cutoff; unavailable when unsupported) | **Partially** | Smart Reports: method id, backtest, "not available" state; `/planning`: tag only | `HLSD V0.6 FR-010, WF02-03/05` | version/horizon/cutoff stamp missing on `/planning` | **GAP-R3-1** |

### R7 — Shared Services examples

| # | Ask | Class | Where / evidence | Precise gap | Smallest refinement (key) |
|---|---|---|---|---|---|
| R7.1 | Representative reports with dummy data supplied by Shared Services / AI Champion | **Missing** | none supplied after 27 Oct. Local monthly reports (Jan–Mar, Jul) are **real data** | dependency | **GAP-R7-1** (dependency D-4): request 1–2 reports, 1 dashboard, 1 document with dummy data + a statement of the reporting date and definitions |
| R7.2 | Dashboards | **Missing** | none supplied; the 5 Nov financial-performance deck was generated by this demo | same | **GAP-R7-1** |
| R7.3 | Documents | **Missing** | none supplied | same | **GAP-R7-1** |
| R7.4 | What the demo already reproduces | **Partially** | monthly-report structure mapped (`monthly-reports-mapping-ar.md`); Smart Reports exports (PPTX in MOMAH template, DOCX, XLSX, PDF, CSV) with export parity 3291/3291 | cannot be matched to supplied examples | none until D-4 |

---

## C. Coordination actions — evidence of completion (business actions; original deadline **2 November 2026** retained)

Evidence means a file, message, minute or deliverable found locally. **No revised dates are stated. No completion is assumed.**

| # | Action | Owner (as agreed) | Deadline | Evidence found | Status |
|---|---|---|---|---|---|
| C1 | Coordinate the forecasting review | Solution Owner | 2 Nov 2026 | none: no invitation, minute, deck or note about a forecasting review with Dr. Muath / Abdulmajeed / strategy or finance teams (search: 00 §1) | **no evidence found** |
| C2 | Share models, inputs, assumptions, drivers | ByteDance | 2 Nov 2026 | none. HLSD V0.6 defines how forecasts must be validated (AC-10, NFR-009) but no model, input or driver specification; the 20 Oct deck lists WF-02 in Sprint scope only | **no evidence found** |
| C3 | Provide business examples (reports, dashboards, documents, dummy data) | Shared Services + AI Champion | 2 Nov 2026 | none dated after 27 Oct. `Data Sources Tracker SS` (4 Nov) is a data-source tracker, not business examples; monthly reports are earlier and real | **no evidence found** |
| C4 | Coordinate a dedicated UI/UX and demo review | OT | 2 Nov 2026 | none. An OT review of the Alpha HLSD (file dated 25 Oct, before the 27 Oct meeting) exists; it is not a UI/UX demo review | **no evidence found** |
| C5a | Update the demo | ByteDance | 2 Nov 2026 | **work in progress, not a completed/reviewed delivery:** commits to 3 Nov; uncommitted changes through 6 Nov include the Decision Room redesign (6 Nov), municipality hierarchy, simplified filters, chart library (`git status` ~427 entries) | **in progress — completion not evidenced** |
| C5b | Update the opening slides | ByteDance | 2 Nov 2026 | none: newest opening material is the 27 Oct PDF; the 13 Oct intro still says "more than 15 sources"; no editable #09 | **no evidence found** |

---

## D. Gap register (provisional keys; each gap listed once)

| Key | Requirements | Type | Gap | Smallest refinement | Dependency |
|---|---|---|---|---|---|
| GAP-R1-1 | R1 | Content | no evidenced scale / decisions slide | one slide with labelled synthetic baseline (`06`) | ByteDance deck |
| GAP-R1-2 | R1 | Content | KPI set does not measure the demo's receivables outcomes | add 5 measures with the four status labels | Solution Owner approval of targets |
| GAP-R1-3 | R1, R4 | Content | capability claim not supported | reword to «explainable follow-up priority (rules)»; probability pending data | — |
| GAP-R2-1 | R2 | UI + CSV | debtor/contract absent from uncollected list, details and CSV; issuer/billed-party label confusion | payer + contract in details row and CSV; relabel; optional debtor grouping later | payer-id uniqueness (D-10) for grouping |
| GAP-R2-2 | R2, R4 | Engine + tests | 5 aging buckets, basis not stated | 181–365 and >365 buckets; caption with due-date + grace basis | grace rule (D-9) |
| GAP-R2-3 | R2 | Engine | undated receivables inside 180+ in the snapshot | «due date unavailable» bucket in `stock.aging` / overdue | — |
| GAP-R2-4 | R2, R5 | UI | two outstanding totals, standing/overdue/not-yet-due not headline | standing + overdue + not-yet-due tiles with labels | — |
| GAP-R2-5 | R2 | Data | contract installments: two populations | keep «not available»; link when Databank key exists | Databank payment→invoice key |
| GAP-R3-1 | R3, R6 | UI (existing numbers) | no method/assumption/version/horizon panel; expected remaining not stated | «collected to date» + «expected for remaining months» + a method panel | — |
| GAP-R3-2 | R3 | Wording | bare "probability" | relabel «حساسية تقدير نهاية السنة للمستهدف (توضيحي)» and show inputs; or hide until alignment | R6 decision |
| GAP-R3-3 | R3 | Wording | demo target called "approved" | «مستهدف توضيحي غير معتمد» in chat, outlook, dictionary | — |
| GAP-R3-4 | R3, R6 | Code/decision | two methods, two target sources, two monthly shapes | one named method per surface, one target source (planning store), one monthly shape | R6 alignment |
| GAP-R3-5 | R3 | PENDING | no expected-billing forecast, recovery assumptions, seasonality or scenarios | none until inputs 3, 4, 8 of 00 §3 arrive | ByteDance/Solution Owner |
| GAP-R4-1 | R4, R5 | Wording/code small | five priority rules; Smart Reports owner/timeframe text | align labels; remove owner/timeframe | — |
| GAP-R4-2 | R4, R1 | Wording | probability / delayed-payment risk / recoverability not available | state «not available — requires labelled outcomes (HLSD AC-10)» | D-8 |
| GAP-R4-3 | R4 | Wording | priority limits unstated | one sentence of limits | — |
| GAP-R5-1 | R5, R3 | UI small | no dashboard → planning link; «أين نركز» not linked to Decision Room | one line + links | — |
| GAP-R5-2 | R5 | Dependency | guideline conformance unverifiable | obtain kit/guideline | OT |
| GAP-R5-3 | R5 | Content | dictionary lacks aging / priority / estimate | three entries | — |
| GAP-R6-1 | R6 | PENDING | alignment not started | stamp «alignment pending» + 11 inputs | Solution Owner |
| GAP-R7-1 | R7 | Dependency | no SS examples | request list (00 D-4) | SS + AI Champion |
| GAP-X-1 | R4, R5 | Docs | stale references: `dictionaryDocs.js` M-14/M-15, Handbook v0.2, `revenueMetrics.js:762` note, intro deck "15 sources" | refresh text | — |

## E. Consolidated actions (one per theme — avoids duplicate cards, charts, forecasts or queues)

| Action | Closes | Reuses (no new calculation unless stated) |
|---|---|---|
| **ACT-1 Forecast disclosure and alignment** | GAP-R3-1/2/3/4, GAP-R6-1, (GAP-R3-5 when inputs arrive) — R3, R6, R4, R1 | `forecastYear`, `computeGoal`, `FORECAST_METHOD`, `DEFAULT_TARGETS` |
| **ACT-2 Receivables view completion** | GAP-R2-1/2/3/4 (+ R5.1 headline) — R2, R5 | `list` rows (`payerAr`, `contractNo`), `snapshot.stock`, `agingBucket`, `noncollection` |
| **ACT-3 One priority language** | GAP-R4-1/3, GAP-X-1, GAP-R5-3 — R4, R5 | `priorityCore`, `decisionRoom` thresholds, dictionary |
| **ACT-4 Journey navigation** | GAP-R5-1 — R5, R3 | existing routes |
| **ACT-5 Opening slides** | GAP-R1-1/2/3 (+ GAP-R4-2 wording) — R1 | platform's synthetic baseline (`06`) |
| Dependencies (no development) | GAP-R2-5, GAP-R5-2, GAP-R7-1, D-3, D-8 | — |

**Do not build:** a per-invoice collection-probability model, recoverability scoring, scenario ranges, an expected-benefit figure, user assignment in the Decision Room, or any figure borrowed from the official deck.

---

## Update 2026-11-06 (post chart library) — agent R3 changed rows (evidence: `08-verification-addendum.md`)

**Changed rows are marked «CHANGED»; nothing above was silently rewritten.** Class vocabulary unchanged.

| Row | Was | Now | Reason |
|---|---|---|---|
| R2.1 / R2.2 totals | Partially | **Partially — CHANGED evidence** | The two totals are fully explained and bridge to **0.0 SAR** (period cohort 3,889,535,253 + issued-before-period 4,433,134,471 = standing 8,322,669,724, synthetic; verified national / Jeddah / Riyadh). The gap is **labelling only**: no «all issue periods» text beside the dashboard aging chart; the carry-over figure appears on no screen. GAP-R2-4 reworded: add the existing basis chip «رصيد قائم حتى تاريخ القطع — كل فترات الإصدار» + one derived line (§5.3 of 08). |
| R2.13 aging buckets | Partially | **Partially — CHANGED (exposure)** | Picker offers a days-overdue histogram (60-day bins) on aging charts; six requested buckets still not defined; GAP-R2-2 open. |
| R2.15 undated receivables | Partially | Partially (unchanged) | not demonstrable (0 undated invoices). |
| R2.17 drill-through | Fully | **Fully — CHANGED (limit stated)** | changed chart types keep drill by label; «Other», flows, trees, scatters, histograms, boxes are not clickable (tested). |
| R3.14 wording | Partially | **Partially — CHANGED (evidence)** | `assistantAnswers.js:82` no longer carries the phrase; «approved (demo input)» persists at `smartReport.js:101`, `revenueInsights.js:364`; plus the probability tile's traffic-light colour (`PlanForecast.jsx:20`). |
| R4.8 / R5.7 one prioritisation language, no owner/deadline | Partially | Partially — **CHANGED (one more surface)** | NC priority cards also print «Owner · deadline (suggested)». |
| R5.1 dashboard journey | Partially | Partially (unchanged) — **CHANGED detail** | link to planning absent on the dashboard but present on the uncollected list (`Collection.jsx:127`). |
| **R5.10 (new)** Chart choice: the same data in another form, kept in saved views and exports | — | **Fully (functionality)** | picker on Dashboard, Exclusions, NC, compact on `/invoices` `/collection`, Smart Reports; saved per user/page/version; exports carry it (`chart-integration` 29/29). **Does not by itself satisfy «meaningful insights»**: default chart-led surfaces carry no stated issue, priority or action (08 §2.1) — see R5.11. |
| **R5.11 (new)** Default visualizations state the business issue, priority and recommended action | — | **Partially** | Fully on Decision Room, Top findings, NC priorities, Smart Reports insights/recommendations; missing on dashboard KPI/flow/trend, exclusions, collected/uncollected summaries, planning tiles. Smallest refinement: one insight sentence under each default dashboard chart reusing `insightsEngine.js` output (no new calculation or chart). |
| **R5.12 (new)** Chart-library consistency | — | **Partially** | three catalog behaviours to correct: `pareto` offered on ordered aging buckets (re-orders them, contradicts the sort rule); share types offered on a top-N chart with no stated whole (NC «Overdue by Amanah (top 10)»); `stacked_area` unavailable-in-demo shows a wrong reason (08 §3.2). |
| **R2.20 (new)** Collection rate within scope (Collected page) | — | **Fully** | Collected ÷ Net invoiced × 100 over every invoice of the scope, denominators, formula tooltip, `na` state; says the register lists only paid/part-paid invoices (`CollectionRateCard.jsx`; `invoice-lists-ui` passes). Caveat: scope collected 8,715,793,497 vs register 8,685,173,389 (diff 30,620,108, not traced, the card says «can differ slightly»). |
| R3.* forecasting, R4.* probability/recoverability, R6, R7, R1, coordination actions C1–C5b | — | **unchanged** | chart library does not touch them. |

New gap keys for the register agent: **GAP-C-1** pareto on ordered axes · **GAP-C-2** share types on top-N without `whole` · **GAP-C-3** chart-matrix reason attribution (+ test) · **GAP-C-4** silent PNG-fallback warning (08 §4.3) · **GAP-C-5** input-only alias module for retired terminology (08 §6.4, PROPOSED) · **GAP-C-6** insight sentence under default dashboard charts (R5.11).
