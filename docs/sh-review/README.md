# SH-feedback review of the IIM demo — index

**Status: Review only — no SH refinement implemented.** Date of review: 2026-11-06. Branch `feat/furas-contracts-rework` with many uncommitted changes; other agents are still editing the access-control and chart-library code, so line references drift (re-verify before editing). Nothing in the application, tests, `package.json` or data was changed by this review.

Scope: the seven Sector Head (SH) points R1–R7 — (1) business impact in the opening slides · (2) receivables visibility · (3) revenue forecasting · (4) collection prioritisation · (5) dashboard and UI/UX · (6) forecasting alignment · (7) Shared Services examples — against the journey **What is owed → Who owes it → What we expect to collect → What needs attention → What actions we should take.**

## Legend (used in every file)

| Label | Meaning |
|---|---|
| **VERIFIED** | read in code, run as a probe/test, or seen in a screenshot — a `path:line` or screenshot file is given |
| **RECOMMENDATION** | a proposed refinement or decision; not implemented |
| **SIMULATION** | illustrative arithmetic on stated inputs; never a forecast or a validated AI result |
| **PENDING** | needs a business decision or an external input (no date invented) |
| **UNVERIFIED / Unverifiable** | evidence, data or access is insufficient (e.g. PowerPoint rendering, the MOMAH guideline kit) |

All figures are the **synthetic demo baseline** (generated data; no ministry figure appears in any file). Coverage classes: **Fully covered · Partially covered · Missing · Unverifiable**.

## Reading order

| # | File | What it is | Read it when |
|---|---|---|---|
| 1 | `02-coverage-matrix.md` | **Start here:** the consolidated R1–R7 summary table at the top (class, why, action IDs, demo screenshot), then the detailed matrix, coordination-action evidence and gap keys | you need the verdict per requirement |
| 2 | `03-developer-action-register.md` | **The action register:** SH-A01…A34 in three parts (A current data · B needs data/methodology · C business/coordination), each with evidence, formula, acceptance criteria, screens, placement | you decide what to build or chase |
| 3 | `05-implementation-sequence-and-dependencies.md` | Phases, parallelism, conflicts with the access-control work, stakeholder dependency table, 12 open decisions (with recommendations), unverified claims | you plan the work |
| 4 | `07-demo-walkthrough.md` | A 10-minute demo script following the journey, with what not to claim and the live traps | you present to the Sector Head |
| 5 | `06-opening-slide-storyline.md` | Proposed opening-slide storyline (R1); checked against the register by S1 (changes marked «updated by S1») | you update the opening deck |
| 6 | `01-current-state-review.md` | Analytic review of code, calculations and data (R1 agent), incl. the «Update 2026-11-06» section | you need the traced numbers and formulas |
| 7 | `08-verification-addendum.md` | Re-verification after the chart library: reconciliation of totals to the SAR, chart support matrix, placeholder PNG, terminology, business usefulness of default visualizations | you need the evidence behind the chart/forecast findings |
| 10 | `09-overdue-reports-review.md` | **Addendum R4:** overdue-invoice reports (general · by Amanah · by municipality · by revenue source) — interpreter table (50 phrasings), existing-coverage inventory, 4 reports × content coverage, numbers reconciliation, definition check, report specification, decisions Q13–Q18, SH-A35…SH-A40 | you plan or review the overdue reports |
| 8 | `00-materials-and-dependencies.md` | Materials found / missing, the forecasting-methodology search result, the 11 inputs needed for alignment | you chase inputs |
| — | `screenshots/` + `screenshots/index-draft.md` | 143 original captures (111 + 32 files of the R4 addendum, 190–213) (headless Chromium, Arabic RTL, 1440×900; 375 px mobile where named) and the draft index with drill-through results | you need to see a screen |
| 9 | `04-screenshot-index.md` | **Visual index (S2):** every SH comment (R1.1…R7.4) → page → original screenshot → coverage → refinement → action ID → annotated placement / detail crop / wireframe; unchanged screenshots as demonstration evidence; rows without a screen (slides, forecasting alignment, Shared Services, coordination); register placement mismatches | you review where each proposed change goes |
| — | `annotated/` | **51 annotated placements** (47 Arabic + 4 English; 10 added by R4) and **8 detail crops (2×)**, one per UI-changing action of Part A/B (`SH-Axx-<name>-<ar\|en>.jpg`, `SH-Axx-detail-n.jpg`). Each carries the banner «Proposed change — not implemented / تغيير مقترح — غير منفّذ», the requirement and the action ID. Originals are copied, never modified; contract pages stay blurred | you review the proposed placements |
| — | `wireframes/` | **5 wireframes** (SH-A03, A06, A07 tile row, A23, A35) and **5 current-vs-proposed** images, Arabic RTL, existing components/tokens only, synthetic figures | you review the proposed layouts |

## Where the work stands

* **Register:** 40 actions — Part A 25 (19 + six overdue-report actions SH-A35…A40 of ADDENDUM R4) · Part B 6 · Part C 9 (the 5 agreed coordination actions + 4 supporting business inputs). Three verification items after access-control delivery (SH-V01…V03).
* **Coverage:** R1 Partially · R2 Partially · R3 Partially · R4 Partially · R5 Partially · R6 Unverifiable · R7 Missing (dependency).
* **Coordination actions (original deadline 2 Nov 2026 retained):** forecasting review, models/inputs/assumptions/drivers, Shared Services examples, UI/UX and demo review — **no evidence found**; opening-slide update — **no evidence found**; demo update — **in progress, completion not evidenced**. No revised dates are stated anywhere.
* **Already refined on 2026-11-06 at the user's request (not SH actions):** Collected-invoices card «نسبة التحصيل ضمن النطاق»; Exclusions page (one reasons table, three KPI cards, neutral chart colours); InfoTip tooltip (hover shows, click pins — re-check pending).
* **Access control** (server-side authorization, users/roles pages) is being implemented by other agents (`docs/access-control.md`); nothing in the register duplicates it — treat it as «in progress, verify after».

## Standing project rules respected

Synthetic data only; Tahseel authoritative for collection; the Databank/Makeen/Incorta are tools, never sources; no Agents/Challenges pages; Decision Room keeps its follow-up model and audit trail and assignment stays removed; Amanah → municipality hierarchy respected (no municipality was invented); Net invoiced = Gross − Exclusions, Uncollected = Net − Collected, collection rate = Collected ÷ Net × 100; a priority is never a collection probability; scenarios are never confidence intervals; an illustrative calculation is never a «validated AI forecast».

## Addendum R4 (overdue-invoice reports)

New user requirement (four overdue reports) reviewed in `09-overdue-reports-review.md`: **none of the four exists** (phrasing → generic revenue report from the collection-class filter), but the non-collection engine already reconciles the overdue population by Amanah, municipality and source to the riyadh. Actions SH-A35…SH-A40 and decisions Q13–Q18 added; the Collected-invoices card, Exclusions refinement, chart library and access control were already implemented and are treated as the post-review baseline. Nothing in the addendum is implemented.
