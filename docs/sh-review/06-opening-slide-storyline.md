# 06 — Proposed opening storyline (R1: business impact before system features)

Agent R1 · 2026-11-06 · REVIEW OUTPUT — a proposal for the ByteDance deck update (action 5); no deck was edited and the editable 27 Oct deck is not local (00 D-6).
Rules applied: no invented savings, uplift or accuracy; four status labels on every figure; no real ministry figure is reproduced (the official KPI table of the SH deck stays in that deck).
**Checked by S1 (2026-11-06) against the final register `03-developer-action-register.md`; the text changed only where marked «updated by S1» (B1, B3, B7, B8, slides 3, 5, 8, 10).**

## 1. Figure status labels (use these four words, in this order, on every number)

| Label | Meaning | Example on these slides |
|---|---|---|
| **Observed baseline** | computed from a data set, with its source and cutoff named. **Here: «synthetic demo baseline» — generated data, not the ministry's.** Replace with verified real figures when the data owners supply them. | standing balance 8.32 bn (synthetic) |
| **Proposed target** | a number someone proposes and the owner has not approved | «proposed — pending Solution Owner» |
| **Illustrative scenario** | arithmetic on stated inputs, never a forecast and never a promise | «each 1 point of collection rate = 1% of net billed» |
| **Measured result** | a value measured after the solution runs on real data | «none yet» |

## 2. What the existing decks do (VERIFIED from slide text — 01 §F)

Intro AR (7 Sep / 13 Oct): title → five qualitative challenges (only "15+ sources", "3–5 days") → five AI improvements (incl. a per-invoice collection-probability claim) → official KPI table → agents map → KPI basis. SH Review #09 (27 Oct, PDF): the same story in slides 8–12, with "6 sources".
**Starts with the problem: yes. Figures that show its scale: no. Decisions that are hard today: one rhetorical question. Outcomes measured: productivity / expected collected revenue / AI adoption, not receivables outcomes.**

## 3. Observed baseline the platform can supply today (all «synthetic demo baseline», cutoff 2026-11-05, compact generated world)

| # | Figure | Value | How it is derived (reproducible on `/insights` and `/collection`) | Status |
|---|---|---|---|---|
| B1 | Standing uncollected balance (all issue periods) | 8.32 bn SAR | `stock.netUncollected` = net − collected, excluded/cancelled out. **Updated by S1:** on `/insights` it is the sum of the aging bars, not a stated figure, and the page does not yet say «all issue periods» (SH-A01); it equals the `/collection` list only when the period is widened | observed (synthetic) |
| B2 | Share overdue / not yet due | 93.0% / 7.0% | `stock.overdue`, `stock.notYetDue` (sum = B1) | observed (synthetic) |
| B3 | Share older than 180 days | 74.3% of B1 (6.18 bn; 92 of 157 open invoices; average 307 days overdue) | aging bucket "over 180 days" | observed (synthetic) — will split into 181–365 / >1 year after GAP-R2-2 (**SH-A02**, updated by S1) |
| B4 | Concentration of the >180-day balance | two entities hold 82% | `aged180ByAmanah` | observed (synthetic) |
| B5 | Exclusions as share of gross billed, year to date | 20.3% (3.21 of 15.82 bn) | `exclusionRate` | observed (synthetic) |
| B6 | Collection rate year to date | 69.1% = collected ÷ net billed (8.72 ÷ 12.61) | `collectedOverNet`; the gross-based 55.1% is a different, separately named measure and is not used as the KPI | observed (synthetic) |
| B7 | Year position against an illustrative target | collected 9.21 bn (payment-date basis) — **updated by S1:** the −0.53 bn deviation against a 9.74 bn planned-to-date was computed against `DEFAULT_TARGETS` and is **not what `/planning` shows**: the page shows an illustrative 21.59 bn target and −9.14 bn (`screenshots/24-planning-probability-wording-ar.jpg`). Two target sources exist (SH-A08). **Quote only the collected figure, or the on-screen illustrative target with the word «illustrative»; do not use −0.53 bn.** | `/planning`; target is a demo input | observed (synthetic) + target is *demo* |
| B8 | Where the follow-up effort concentrates | 34 High-priority invoices hold about 62% of the **standing balance** (5.12 of 8.32 bn; «net unpaid» was ambiguous — updated by S1) | list priority rules (amount tier × age tier) | observed (synthetic) |
| B9 | Accuracy of the demo's own trend forecast on its data | backtest error ≈ 142% (n = 6) | `revenueOutlook.backtestOneStep` | observed (synthetic) — shows why **no accuracy claim** is made |

## 4. Slide-by-slide

| # | Slide | Purpose | Message (one sentence) | Evidence source | Figure status | What is missing |
|---|---|---|---|---|---|---|
| 1 | Title | context | Intelligent Invoice Management — from what is owed to what we do next | — | — | — |
| 2 | The question | frame the decision | «Which receivable needs urgent follow-up, which entity needs early intervention, and where does the year stand?» | existing slide 8 question (retain) | — | — |
| 3 | **The problem in numbers** | show scale before features (updated by S1: until SH-A01/A02 land, state the population: «standing balance, all issue periods»; the bridge 3.89 + 4.43 = 8.32 bn is verified, 08 §5) | Most of what is owed is already overdue, and most of that is old and concentrated in few entities | B1–B5 (platform), replaced by real verified figures when supplied | observed baseline (synthetic) — **state it on the slide** | real figures from data owners; Tahseel-based standing balance; agreed grace rule (changes the overdue share) |
| 4 | Decisions that are hard today | tie the problem to decisions | Six sources, manual matching of enforcement orders to invoices, no single view of debtor + age + objection + enforcement, a plan that is checked after the fact | existing slides 8–9 ("6 sources", "3–5 days manual" — stated by the deck, **not measured here**) | "stated, not measured" | a measured current-state time for report preparation (to be timed with Shared Services) |
| 5 | How IIM supports each decision — the journey | map capability to decision | **What is owed → who owes it → what we expect to collect → what needs attention → what we do**: dashboard · uncollected list with debtor, age and priority · year plan with estimate · Decision Room · exclusions & enforcement links | `/insights`, `/collection`, `/planning`, `/decisions` | capability, not result | remove «collection probability of every invoice» (also removed from the platform's own wording: SH-A11, SH-A07); say «explainable follow-up priority (rules, with reasons)»; forecast shown as an **illustrative estimate** (updated by S1: action SH-A30(a)) |
| 6 | How outcomes will be measured | answer "how do we know it worked" | Five measures, each with a definition, a source and four labelled values (below) | HLSD V0.6 §5 + this table | see §5 | owner-approved targets; real baselines; measurement method for time-based measures |
| 7 | One illustrative scenario (optional) | show sensitivity without promising | Each point of collection rate on the year's net billing is worth 1% of net billed (arithmetic) | B6 | **illustrative scenario** — arithmetic, not a forecast | none; omit if the audience may read it as a target |
| 8 | What the demo shows | live path | Dashboard → uncollected list → plan → Decision Room, one filter set, one set of figures | `07-demo-walkthrough.md` (steps, screenshots, what not to claim) | screens use synthetic data | — |
| 9 | What we do not claim | pre-empt over-reading | No per-invoice collection probability, no recoverability, no expected-benefit figure; forecasts are illustrative until aligned with the strategy/finance forecast; all figures are synthetic | HLSD AC-10, NFR-009; 01 §B, §C | — | — |
| 10 | Dependencies and next steps | transparent plan | Forecast alignment (models, inputs, assumptions, drivers, version) · approved targets · Shared Services examples · UI/UX review · real data. Original date 2 Nov 2026 stays on the record; status only where evidence exists | 00 §4, 02 §C | status: «no evidence found» for the forecasting review, the models/inputs, the Shared Services examples, the UI/UX review and the opening-slide update; the demo update is «in progress — completion not evidenced»; register IDs SH-A26…A30 (updated by S1) | revised dates only if the owners provide them |

## 5. Measures to propose (slide 6) — status of each value

| Measure | Definition (formula) | Source / grain | Observed baseline | Proposed target | Illustrative scenario | Measured result |
|---|---|---|---|---|---|---|
| **Overdue exposure** | standing net uncollected with days past due > 0 (and share older than 180 days) | `stock.overdue`, `stock.aging`; invoice grain; cutoff date | 7.74 bn, 93% of standing; 74% over 180 days (synthetic) | proposed — pending Solution Owner; reduction basis to be agreed (amount or share) | none | none yet |
| **Collection rate** | collected ÷ net billed × 100 (net = gross − exclusions); gross-based rate only if separately named | `collectedOverNet`; invoice cohort of the period | 69.1% year to date (synthetic) | existing business KPI target per the agreed methodology (value from the official source — **not** reproduced here) | 1 point = 1% of net billed | none yet |
| **Time to identify priority cases** | seconds from opening the uncollected list to the first High-priority case with its reason; and hours to prepare the monthly collection report | timed sessions with Shared Services | **not measured** | proposed — to be set after the first timing | none | none yet |
| **Follow-up completion** | items flagged for follow-up that reach «تمت المتابعة» ÷ flagged items, shown next to the share whose financial condition is still open (the data condition, not the flag) | Decision Room store + `condition.open` | **no baseline** (device-local store, empty at start) | proposed — pending | none | none yet |
| **Forecast error** | absolute error of the year-end estimate by horizon against an agreed **non-AI baseline** (HLSD AC-10); no probability shown until calibrated | forecast archive per cutoff | the demo's trend method: ≈ 142% backtest error on synthetic data (n = 6) — i.e. **not fit for a claim** | thresholds to be approved by the owner | none | none yet |

## 6. Inputs still needed to complete the storyline

1. Verified real baseline figures (standing balance by age, overdue share, concentration, collection rate) from the data owners — to replace B1–B6.
2. The agreed grace-period rule (D-9) — it changes the overdue share and every aging bucket.
3. Owner-approved targets for the five measures, and approved annual targets from SIMH (D-3).
4. A measured current-state timing for report preparation and for locating a priority case (Shared Services).
5. The editable 27 Oct deck (D-6) and a decision on whether the 13 Oct intro deck is retired (it still says "15+ sources").
6. The forecast alignment inputs (00 §3) — until then slide 9 states that forecasts are illustrative.
