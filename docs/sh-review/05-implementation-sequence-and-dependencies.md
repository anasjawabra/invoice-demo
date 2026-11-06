# 05 — Implementation sequence, dependencies, decisions and validation limits

Agent S1 · 2026-11-06 · **REVIEW ONLY — nothing here is scheduled by the platform team and nothing is implemented.** Action IDs are from `03-developer-action-register.md`.
Labels: **VERIFIED** · **RECOMMENDATION** · **SIMULATION** · **PENDING**. Figures are the synthetic demo baseline. **No dates are invented**: phases are an order, not a calendar; the only date is the agreed original deadline, **2 November 2026**, retained for the five coordination actions.

## 1. Proposed sequence (RECOMMENDATION)

Principle: first remove what could mislead in front of the Sector Head (wording, links, one unvalidated «probability»), then complete receivables visibility (the part that can be fixed with data we already have), then the forecast disclosure, then hygiene; everything that needs the teams' input waits behind Part C. Part C runs from day 0 in parallel because it is the only way to unblock Phase 5.

| Phase | Actions | Why in this order | Can run in parallel with | Blocked by |
|---|---|---|---|---|
| **0 — Inputs (business)** | SH-A26…A34 (Part C) | The forecast, targets, examples and the UI/UX review cannot be produced by development; no evidence of completion exists for any of the five (`02 §C`). | everything below | owners (§3) |
| **1 — Trust and honesty (small, independent)** | SH-A07, SH-A08 (wording part), SH-A04, SH-A11, SH-A19, SH-A15, SH-A05 | Each removes a statement or link that overclaims or does not match what it opens; touching few files each (`PlanForecast.jsx`, `decisionRoom.js`, `smartReport.js`, `NcPriorities.jsx`, `CoreInvoiceTable.jsx` header only, `Layout.jsx`, `ingestion/reports.js`). SH-A07 is first because it frees the position SH-A06 uses. | each other (disjoint files) except A04 ↔ `Collection.jsx` and A05 ↔ `Layout.jsx` | SH-A05(b) after the access-control sidebar guard |
| **2 — Receivables visibility** | SH-A02 (engine, buckets, undated, drill) → SH-A01 (chip + carry-over, same card) → SH-A03 (debtor in list + CSV) → SH-A12 (insight sentences) → SH-A10 (dictionary) | A02 changes the shared bucket function and every consumer (`engine.js`, `noncollection.js`, `lists.js`, charts, exports, tests) — everything that quotes the aging figures must follow it. A01 and A12 share the aging card header with A02. A03 is independent of A02 but shares `CoreInvoiceTable.jsx` and `lists.js` (CSV). A10 documents the final wording last. | A03 can run beside A02 if two people own different files; A12 after A01/A02 | access control (same server files: rebase or sequence after its merge); decision Q4 (labels) for A03; Q5 changes values only |
| **3 — Forecast disclosure** | SH-A08 (single target source) → SH-A06 (expected remaining + panel + aged share) → SH-A09 (chat answers) | A06 needs A07 (tile position), A08 (target status shown in the panel) and A02 (aged share). A09 reuses A06/A11 text. | Phase 2 tail | A07, A08, A02 |
| **4 — Hygiene and library** | SH-A16 (after A02), SH-A18, SH-A17, SH-A13, SH-A14 | Low risk, independent; A16(a) needs the final bucket axis; A13 depends on the access-control scope label; A14 needs a trace. | any | A13 ← access control; A18 ← decision Q3 |
| **5 — Blocked on inputs** | SH-A20 (single method), SH-A22 (approved targets), SH-A21 (billing, recovery, seasonality, drivers, scenarios), SH-A23 (debtor view), SH-A25 (installment link), SH-A24 (record only) | Each needs an external input (§3); starting earlier would invent assumptions, scenario ranges or debtor keys. | — | SH-A26/A27 (A20, A21, A22), SH-A33 (A23, A24, A25) |
| **2b — Overdue-invoice reports (addendum R4)** | SH-A36 (definition) → SH-A37 (population, dates) → SH-A35 (the report; ships first with the five existing buckets, adopts SH-A02's six when ready) → SH-A38 (columns, CSV) → SH-A39 (drill + `Collection.jsx` URL contract, shared with SH-A04) → SH-A40 (interpreter) | A36/A37 fix what the report reads; A35 builds on the NC engine with no new calculation; A39 must follow A04's URL contract; A40 last because its test table needs the final section names | A38 can run beside A35 (appendix builder vs `lists.js` CSV); A40 beside A39 | Q14–Q16; SH-A02 for six buckets; Q4 for the debtor label (A38); access-control files (`engine.js`, `lists.js`, `reportModel.js`, `SmartReports.jsx`) |
| **6 — Verify** | SH-V01…V03, the SH-A34 human check, re-capture of screenshots 90–93 and the annotated set | Access-control delivery changes `/settings`, every data endpoint, the sidebar and the scope labels. | — | access-control delivery |

### 1.1 Dependency table (action → needs → unblocks)

| Action | Needs | Unblocks / shared with |
|---|---|---|
| SH-A01 | — (coordinate `engine.js`) | same card as A02, A12 |
| SH-A02 | grace rule only for values (Q5) | A01, A06 (aged share), A10, A12, A16(a), A23 labels |
| SH-A03 | label pair (Q4); CSV permission from access control | A23 |
| SH-A04 | URL contract on `Collection.jsx`; bucket keys if A02 first | — |
| SH-A05 | (b) sidebar guard from access control | A06 discoverability |
| SH-A06 | A07, A08, A02 | A09, A20 |
| SH-A07 | — | A06 |
| SH-A08 | A20 (which method), A22 (approved status) later | A06, A09 |
| SH-A09 | A06, A11 wording; A18 for the retired term | — |
| SH-A10 | A02, A06, A07, A11 wording | — |
| SH-A11 | — | A09, A10 |
| SH-A12 | A01/A02 (same card) | — |
| SH-A13 | access-control scope label | — |
| SH-A14 | trace of the Investment difference (O3) | — |
| SH-A16 | A02 (ordered axis), chart-library tree stable | — |
| SH-A17 | SH-A34 human check for the PENDING half | — |
| SH-A18 | Q3 | A09 |
| SH-A20 | A26, A27 | A21, A06 (remove «alignment pending») |
| SH-A21 | A26, A27, A02, A20 | — |
| SH-A22 | A26/A27 (SIMH targets, D-3), A08 | bullet chart availability |
| SH-A23 | A33 (D-10), A03 | — |
| SH-A24 | A33 (D-8) | — |
| SH-A25 | A33 (Databank key) | — |
| SH-A35 | A36, A37; A02 for six buckets (optional first release); A16 (a) | A38, A39, A40 |
| SH-A36 | Q17 | A35 |
| SH-A37 | Q14, Q15, Q16; Q5 for the grace value | A35, A39 |
| SH-A38 | A03 (Q4 label, CSV permission), A02 (undated rows) | A35 appendix |
| SH-A39 | A04 (URL contract), A36 | A35 |
| SH-A40 | A35, A37, A18 module | — |

### 1.2 Conflicts with the access-control work (in progress by other agents — `docs/access-control.md`)

**VERIFIED:** `git status` shows `server/api.js`, `server/engine.js`, `server/lists.js`, `server/materialize.js`, `src/components/Layout.jsx`, `src/context/AuthContext.jsx`, `SettingsNav.jsx` and others already modified. **RECOMMENDATION:** (1) do not start SH-A02/A03 on `server/*` until the access-control branch is merged, or rebase onto it; (2) SH-A05(b), SH-A13 and the CSV columns of SH-A03 must use its permission map and `me.scopeSummary` — no second guard; (3) after delivery, run §D of the register.

## 2. What can start today without waiting (RECOMMENDATION)

SH-A07, SH-A04, SH-A11 (a)(b), SH-A19, SH-A15, SH-A08 (wording), SH-A10 (content) — small, no data or methodology dependency, disjoint files. The five coordination actions are not started by development.

## 3. Stakeholder dependency table

Evidence = a file, message, minute or deliverable found locally (`00 §1–4`, `02 §C`). Nothing below is assumed complete.

| # | Owner | Needed input | Needed for | Status | Deadline |
|---|---|---|---|---|---|
| D-1 / SH-A27 | ByteDance | Models in use and the non-AI baseline; inputs/grain/source; assumptions; drivers; reporting date/calendar; horizons; history coverage; scenario definitions; version; approved targets; acceptance thresholds (HLSD AC-10) — the 11 items of `00 §3` | SH-A20, A21, A22, A06 («alignment pending» line) | **no evidence found** | **2 Nov 2026 (retained)** |
| D-2 / SH-A26 | Solution Owner | Forecasting review with Dr. Muath, Abdulmajeed and relevant teams (minutes, the single method) | SH-A20 | **no evidence found** | **2 Nov 2026 (retained)** |
| D-3 | Solution Owner / ByteDance (SIMH integration) | Approved annual targets with status and effective date | SH-A22, A08, bullet chart | **no evidence found**; manual demo inputs remain | none agreed |
| D-4 / SH-A28 | Shared Services + AI Champion | 1–2 reports, 1 dashboard, 1 document with **dummy data**, with reporting date and definitions | R7; comparison with Smart Reports exports | **no evidence found** (monthly reports are real data and pre-date the feedback) | **2 Nov 2026 (retained)** |
| D-5 / SH-A29 | OT | Dedicated UI/UX and demo review; DGA guidance, Figma kit, MOMAH web guideline, Hugeicons licence (D-7) | R5 conformance statement | **no evidence found** (the OT Alpha HLSD review of 25 Oct is not this review) | **2 Nov 2026 (retained)** |
| D-6 / SH-A30 | ByteDance | Editable SH #09 PPTX; the updated opening slides; the updated demo | R1 | slides: **no evidence found**; demo: **in progress — completion not evidenced** | **2 Nov 2026 (retained)** |
| D-8 / SH-A33 | data owners / ByteDance | Labelled collection outcomes at invoice level (on time / late / never, with dates), payment history by payer, follow-up records | SH-A24 (any probability) | not available; synthetic data cannot validate | none agreed |
| D-9 / SH-A31 | Solution Owner / business | Grace-period rule (EQ2) | values of every aging figure | open | none agreed |
| D-10 / SH-A33 | data owners | Payer-id uniqueness and verified debtor identifiers | SH-A23 | open | none agreed |
| D-11 / SH-A33 | data owners / Databank | Payment→invoice key for contracts | SH-A25 | open | none agreed |
| O3 / SH-A33 | data owners / developer | Cause of the 30.6 m Investment difference between the collected card and the register | SH-A14 | **not traced** | none agreed |
| D-12 / SH-A32 | data owners / Solution Owner | Verified real baselines and owner-approved targets for the five measures | slides (R1) | open | none agreed |
| D-13 / SH-A34 | OT / QA (unassigned) | Human check of exports in PowerPoint 365 / 2013, Keynote, Google Slides, Word | `08 §7d` items 1–4 | **UNVERIFIED** | none agreed |

## 4. Unresolved decisions for the user (each with a recommendation)

| # | Question | Recommendation | Affects |
|---|---|---|---|
| Q1 | Planning probability tile: remove it, or keep it relabelled («حساسية تقدير نهاية السنة للمستهدف — توضيحي») without the traffic light? | **Remove** it (and the colour). The reasons already compare pace needed with recent pace; a relabelled normal-tail number is still an unvalidated statistic. | SH-A07, A06, A10 |
| Q2 | Until the teams' method arrives: which of the two methods is shown on `/planning` and in Smart Reports (run-rate 10.95 bn vs trend 9.96 bn, synthetic)? | Show **one method per screen** with its name; keep run-rate on `/planning` and label the Smart Reports trend as an «alternative view»; make no accuracy claim. Final choice after SH-A26/A27. | SH-A20, A06, A08 |
| Q3 | Which approved term does the retired word «المقبوضات» map to as **input**: «الإيرادات المحصلة» (payment-date basis) or «المبلغ المحصّل» (invoice-cohort)? | «الإيرادات المحصلة», because the project notes list it as the replacement; the alias is input-only and never displayed. | SH-A18, A09 |
| Q4 | The Arabic label pair for **debtor** vs **issuer** (today «الجهة المفوترة» / «المفوتر» in the lists, «المُصدَر له» / «الجهة المصدرة» on the invoice page)? | One pair on every surface: debtor «المدين (الجهة المطالَبة بالسداد)», issuer «الجهة المُصدِرة للفاتورة»; confirm with Shared Services. | SH-A03, A10 |
| Q5 | Grace-period rule: default 0 days, or the cumulative 5/10/15/35 days used in the monthly reports? | Keep **0 and the caption** until the business decides; never change silently — every aging bucket moves. | SH-A02, A31 |
| Q6 | Dashboard: chip + one carry-over line under the aging chart (proposed), or a new «standing balance» tile? | **Chip + line** — a seventh tile adds a third «outstanding» to the strip. | SH-A01 |
| Q7 | Dashboard → Planning: link only, or the link with the year position numbers? | **Link only** — payment-date collected (9.21 bn) differs from the cohort tile (8.72 bn); repeating it creates a third «collected». | SH-A05 |
| Q8 | Decision Room in the sidebar: under «نظرة عامة» (proposed) or under «إدارة التحصيل»? | Under **«نظرة عامة»**, right below the dashboard, so the journey step «what needs attention» follows the dashboard. | SH-A05 |
| Q9 | Opening slides: ship with the labelled **synthetic baseline** or wait for verified real figures? | Ship with the baseline **stated on the slide** (synthetic, four status labels) and replace as real figures arrive (SH-A32). | SH-A30, `06` |
| Q10 | Retire the 13 Oct intro deck («15+ sources»)? | Yes, once the updated opening deck exists; until then state it is superseded. | SH-A30 |
| Q11 | Who assigns and runs the PowerPoint / Keynote / Slides check? | OT or the QA owner; until done, the exports are described as «verified at file-structure level» only. | SH-A34, A17 |
| Q12 | Investment 30.6 m difference: treat as a data rule to explain, or a defect to correct? | **Trace first** (O3); do not change figures before the cause is known. | SH-A14 |
| Q13 | Overdue reports: four reports, or **one report with four entry points** (dimension parameter {all, Amanah, municipality, source})? | **One report, four entry points** (starter chips, phrasings, follow-up chips). It reuses the non-collection engine, charts, appendix and exports; four implementations would diverge. | SH-A35 |
| Q14 | Default population of an overdue report: the 2026 issue-date cohort (73 / 3.31 bn) or **all issue periods** (138 / 7.74 bn)? | **All issue periods** by default — the 65 older overdue invoices (4.43 bn) are the longest-outstanding ones; the issue-date window stays available and is named. | SH-A37, A35 |
| Q15 | Show a due-date filter next to the issue-date period? | **Yes, in the overdue report's scope panel only**, empty by default, with both dates named («تاريخ الإصدار» / «تاريخ الاستحقاق»); do not add it to the dashboard. | SH-A37, A40 |
| Q16 | Grace period on the report? | **Show the value used (default 0 days) in the reporting-date line**; do not change it until the business answers Q5 / EQ2 (10 days moves standing overdue from 7.74 to 7.49 bn). | SH-A37, SH-A31 |
| Q17 | Wording of the collection-class option «متأخرة» (excludes partly paid, unlinked, missing-debtor-id overdue invoices)? | Relabel to make the exclusion explicit and keep «موقف الاستحقاق: متأخر» as the overdue notion; exact Arabic with the business. | SH-A36, A10 |
| Q18 | Excluded overdue invoices (approved rules, 134 / 6.90 bn standing)? | **A separate dashed tile and a «+N مستبعدة» note on drill rows; never inside the overdue KPI** (the existing rule of the due bar). | SH-A35, A39 |

## 5. Unverified claims and validation limitations (explicit)

| # | Limitation | Status |
|---|---|---|
| 1 | **No PowerPoint, Keynote or Google Slides verification.** The claim «PowerPoint 2016+/365 draws the SVG; older viewers show an empty frame» is an expectation from the OOXML structure; only LibreOffice 26.2.5.2 rendered a placeholder-PNG deck correctly (08 §4.2). Word's PNG pixels also unobserved. | **UNVERIFIED** (SH-A34) |
| 2 | **No real data.** Every figure is the generated synthetic world (929 invoices, cut-off 2026-11-05/06). Nothing here validates accuracy, forecast error or priority against real payments. The demo's own trend back-test error (≈ 142 %, n = 6) shows why no accuracy claim is made. | by design |
| 3 | **No MOMAH UI/UX guideline kit locally** (DGA guidance, Figma kit, MOMAH web guideline, Hugeicons licence): conformance to the agreed guidelines is not verifiable; only the DGA foundations summarised in the supplied workshop PDF were applied (`docs/design-dependencies.md`). | **Unverifiable** (SH-A29) |
| 4 | **No forecasting methodology** of Dr. Muath / Abdulmajeed / ByteDance / the strategy team exists locally; the only forecast methods are the demo's own two. | **PENDING** (SH-A26/A27) |
| 5 | **No editable SH Review #09 deck** and no Shared Services dummy-data examples; the monthly reports are real data and are not reproduced here. | **PENDING** (SH-A28, SH-A30) |
| 6 | **Items verified at code or service level only, not in a browser:** the undated-receivable behaviour (in-memory probe; the synthetic world has none), the aggregate drill-through parity (service level; browser drill of NC marks recorded in `docs/chart-library.md`, not re-run), saved-view → export composition in React (`SmartReports.jsx:598`, no DOM test), restricted users at municipality level in chart companions, the identity `net_eq_snapshot_outstanding`, the mirrored-payment rule beyond the enforcement channel. | stated per row in 01/08 |
| 7 | **Working tree in flux.** Files changed during the review (`assistantAnswers.js:82` lost and regained the phrase «approved annual target (a demo input …)»; `PlanForecast.jsx` moved to `src/components/strategic/`; line numbers drift). Access control and chart library are being edited by other agents. | re-verify at implementation |
| 8 | **Not run by this review:** the full `npm test` chain in one run; screenshots were taken before several later edits (superseded files are listed in `screenshots/index-draft.md`; the exclusions page has `*-final` captures). | stated |
| 9 | **InfoTip fix** (hover shows, click pins) is reported by the user; not re-verified in a browser by S1. | **PENDING** |
| 10 | The 30.6 m Investment difference between the collected card and the register is **not traced**. | **PENDING** (O3) |
| 11 | Proposed metric formulas in SH-A06, A21, A23 are specifications for review, not validated; A21 contains no numbers on purpose. | RECOMMENDATION |
| 12 | The contract screenshots are blurred (confidential Databank-derived subset); no contract value is recorded. | by design |
