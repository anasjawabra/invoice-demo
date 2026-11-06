# 03 — Developer action register (SH feedback R1–R7)

Agent S1 · 2026-11-06 · **REVIEW ONLY — no SH refinement is implemented.** Source evidence: `00`, `01`, `02`, `08` of this folder and the 111 original screenshots in `screenshots/` (draft index: `screenshots/index-draft.md`).
**Labels on every statement:** **VERIFIED** (read in code / run / seen in a screenshot — reference given) · **RECOMMENDATION** (proposed) · **SIMULATION** (illustrative arithmetic, never a forecast) · **PENDING** (needs a business decision or an external input).
All figures are the **synthetic demo baseline** (generated world, cut-off 2026-11-05/06). No ministry figure appears here. Line numbers were re-read on 2026-11-06 during a working tree that other agents are still editing (access control, chart library): **re-verify the line before editing**.

## 0. How to read this register

* **De-duplicated.** Overlapping SH comments are one action linked to every requirement it serves. Each action reuses an existing page, component or calculation. No new card, chart, metric, forecast or queue is proposed; where a number is new it is arithmetic on two existing figures and is flagged.
* **IDs are stable** (`SH-A01…`), sequential across the three parts. Part A = supported by current data. Part B = needs additional data or methodology. Part C = business and coordination actions outside development.
* **Priority.** **P1** = on the SH demo path or makes a shown figure misleading, and small; **P2** = improves a surface or removes a trap; **P3** = hygiene / low risk. Each action gives its own one-line reason.
* **Screens / Placement / Needs wireframe** are for the agent that annotates screenshots (S2): the file names are exact names in `screenshots/`.
* **Access control (in progress, by other agents — `docs/access-control.md`).** Server-side authorization, users/roles pages, per-permission geographic scope. It changes `/settings`, every data endpoint, the sidebar guard and `me.scopeSummary`. **Nothing in this register duplicates it.** Where an action touches the same files (`server/engine.js`, `server/lists.js`, `Layout.jsx`, planning filters) the dependency line says «coordinate»; contract-page scoping is listed as a **verification item** (§D), not as development.
* **Already refined on 2026-11-06 at the user's request (not SH actions, not repeated here):** (1) Collected-invoices page card «نسبة التحصيل ضمن النطاق» replaced the «سياق الفترة» panel (`CollectionRateCard.jsx`, `Invoices.jsx:144`; VERIFIED net-based, `na` state, `invoice-lists-ui` passes per 08); (2) Exclusions page: one reasons table, three KPI cards, neutral chart colours (screenshots `*-final`, `06-exclusions-register-top-ar-final.jpg`, `181-exclusions-reasons-table-and-chart-ar-final.jpg`); (3) the `InfoTip` defect R2 found (first click left the tooltip closed, `InfoTip.jsx:13`) is reported fixed — hover shows, click pins (**PENDING re-check in a browser; S1 did not re-run it**).

## 1. Index

| ID | Title | Req | Prio | Gap keys | Part |
|---|---|---|---|---|---|
| SH-A01 | Dashboard: say that the aging chart is the standing balance, and show the carry-over | R2 R5 | P1 | GAP-R2-4 | A |
| SH-A02 | One aging scheme: six buckets + «due date unavailable» + stated basis + drill | R2 R4 | P1 | GAP-R2-2, -3 | A |
| SH-A03 | Show the debtor in the uncollected list, details and CSV; separate the issuer label | R2 | P1 | GAP-R2-1 | A |
| SH-A04 | Decision Room item link must open exactly what the item counts | R2 R4 R5 | P1 | (R2 D5) | A |
| SH-A05 | Journey navigation: dashboard → Planning, Decision Room in the sidebar, focus → item | R5 R3 | P1 | GAP-R5-1 | A |
| SH-A06 | Planning: expected remaining + «method and assumptions» panel + aged share of the ceiling | R3 R6 | P1 | GAP-R3-1 | A |
| SH-A07 | Planning: remove/relabel the «probability of reaching the target» tile and its traffic light | R3 R4 R6 | P1 | GAP-R3-2 | A |
| SH-A08 | One target source, one monthly shape, and honest status wording for demo targets | R3 R6 | P1 | GAP-R3-3, -4 | A |
| SH-A09 | Smart Reports chat: honest answer + pointer for forecast / probability / prioritisation | R3 R4 R5 | P2 | — | A |
| SH-A10 | Metrics dictionary: six missing definitions; correct the stale ones | R5 R4 R2 | P2 | GAP-R5-3, GAP-X-1 | A |
| SH-A11 | One priority language: limits sentence, no owner/deadline text, dead «probability» strings | R4 R5 R1 | P1 | GAP-R4-1, -2, -3 | A |
| SH-A12 | One insight sentence under the default dashboard charts (reuse the insight engine) | R5 | P2 | GAP-C-6 | A |
| SH-A13 | Restricted user's Planning page must not say «الوزارة (كل الجهات)» | R5 | P2 | — | A |
| SH-A14 | Collected rate card: explain the 30.6 m difference to the register (Investment) | R2 R5 | P3 | — | A |
| SH-A15 | Enforcement home: do not present the Databank (a tool) as the data source | R5 | P3 | — | A |
| SH-A16 | Chart-selection rules: no Pareto on ordered buckets, no share types without a whole | R5 | P2 | GAP-C-1, -2, -3 | A |
| SH-A17 | Export: warn when a picture falls back to the placeholder PNG | R5 R7 | P3 | GAP-C-4 | A |
| SH-A18 | Retired terms accepted as input only (one alias module) | R5 | P2 | GAP-C-5 | A |
| SH-A19 | Dashboard gross card: the link says «invoices and evidence» but opens the collected list | R2 R5 | P3 | — | A |
| SH-A20 | One forecast method per scope, aligned with the strategy/finance work | R3 R6 | P1 | GAP-R3-4 | B |
| SH-A21 | Expected billing, recovery assumptions, seasonality, drivers, scenarios | R3 R6 | P2 | GAP-R3-5 | B |
| SH-A22 | Approved annual targets and their status | R3 R5 R6 | P2 | GAP-R3-5 | B |
| SH-A23 | Debtor-level view (who owes most) | R2 | P2 | GAP-R2-1(b) | B |
| SH-A24 | Collection probability / delay risk / recoverability — prerequisites only, do not build | R4 | P3 | GAP-R4-2 | B |
| SH-A25 | Contract installments ↔ invoice link | R2 | P3 | GAP-R2-5 | B |
| SH-A26…A34 | Business and coordination actions (the 5 agreed + 4 supporting) | R1 R3 R5 R6 R7 | — | — | C |
| SH-A35 | Overdue-invoices report: one `overdue` section with a dimension parameter and four entry points (addendum R4) | R2 R4 R5 | P1 | overdue-1 | A |
| SH-A36 | «Overdue» is a due position, not a collection class (drops 15 / 369.41 m) (R4) | R2 R4 | P1 | overdue-2 | A |
| SH-A37 | Reporting date, issue-date vs due-date filters, default population, grace (R4) | R2 R4 | P1 | overdue-3 | A |
| SH-A38 | Overdue invoice details: debtor, municipality, source, due date, no 1970 dates, full export (R4) | R2 | P1 | overdue-4 | A |
| SH-A39 | Overdue drill-through carrying the full filter set (R4) | R2 R4 | P1 | overdue-5 | A |
| SH-A40 | Interpretation of overdue phrasing: never drop a qualifier (R4) | R2 R5 | P1 | overdue-6 | A |

Counts: **Part A 25 (19 + the six overdue-report actions of ADDENDUM R4) · Part B 6 · Part C 9 (5 agreed + 4 supporting)**. Verification items after access control: §D (3). Fully covered capabilities that need no change: §E. Candidates examined and dropped: §F.

---

# PART A — changes supported by current data

## SH-A01 — Dashboard: label the aging chart as the standing balance and show the carry-over (P1)

| Field | Content |
|---|---|
| Requirements / gap | R2 (what is owed), R5 · GAP-R2-4 |
| Existing coverage | Dashboard tile «غير المحصّل» (period cohort); aging chart (standing balance); the same distinction is already worded in Smart Reports («رصيد قائم وليس غير محصّل الفترة», `reportModel.js:215`), NC («مجتمع مختلف — لا يُجمع», `NcOverview.jsx:52`) and the Decision Room (`decisionUi.js:85`, «رصيد قائم حتى تاريخ القطع (لا يتأثر بالفترة)») — **VERIFIED (08 §5.2)**. |
| Current behaviour | **VERIFIED.** `/insights` shows 3.89 bn (tile) and an aging chart whose bars sum to 8.32 bn with no text that says «all issue periods» (screenshot `01b-insights-dashboard-full-ar.jpg`, `120-dashboard-charts-toolbar-v2-ar.jpg`). The two are bridged to 0.0 SAR: 3,889,535,253 + 4,433,134,471 (65 invoices issued before the period, all overdue) = 8,322,669,724 — national, Jeddah and Riyadh (08 §5.1–5.2). The carry-over figure appears on **no** screen. The old on-dashboard bridge `UncollectedBridge` (`ExecutiveParts.jsx:15`) is exported but unused. |
| Evidence | route `/insights` · `InsightsDashboard.jsx:21,46` (aging chart block) · `financialCharts.js:28–32` · `server/engine.js:454–455` (`stock.netUncollected`) · `scratch/r3/probeRecon.mjs` · 08 §5 |
| Gap / why a change | Not a calculation defect. The first page the SH sees shows two outstanding totals without saying why they differ. **RECOMMENDATION:** label the standing population and state the carry-over so the reader can reconcile in one glance. |
| Proposed refinement | (1) The existing basis chip `PERIOD_BASIS.standing` (`decisionUi.js:85`) as a subtitle of the aging chart card, directly under the title «الرصيد غير المحصّل حسب العمر بعد الاستحقاق» and above the «تغيير الرسم / تخصيص» toolbar. (2) One derived line beside it: «منها X صدرت قبل الفترة المختارة» (X = standing − period uncollected). (3) No seventh tile, no new chart; consider reusing `UncollectedBridge` only if it already renders these two numbers. |
| Required data / formula | Business definition: standing = net uncollected of every invoice issued up to the cut-off, any issue period; carry-over = the part of it issued before the selected period start. Formula: `carryOver = stock.netUncollected − totals.outstanding`. Source fields: `snapshot.stock.netUncollected`, `snapshot.totals.outstanding` (no new field). Grain: invoice. Date basis: cut-off; period membership = issue date. Filters: Amanah / municipality / source / organisation scope kept; period filter ignored by `stock`. Missing/edge: show the line **only** when the period ends at the cut-off (`collectionsAsOf='periodEnd'` moves the reference date otherwise — VERIFIED trap, 08 §5.3 note) and carry-over > 0; otherwise show the chip only. |
| Priority | **P1** — SH-visible, two numbers on one page, fix is wording plus one subtraction. |
| Dependencies | none; same card header as SH-A02 (caption) and SH-A12 (sentence): order = chip → basis caption → chart → insight sentence. Coordinate with access control for `server/engine.js`. |
| Acceptance | (a) chip text present on the dashboard aging chart in AR and EN; (b) for national, Jeddah and Riyadh the displayed carry-over equals the independent sum of list rows issued before the period start with `allPeriods` (0.0 SAR, the numbers above); (c) no line when the period ends before the cut-off or carry-over is 0; (d) the dashboard export (PDF/PPTX/DOCX/XLSX) carries the same text and `npm run verify:exports` parity holds; (e) a restricted user sees own-scope figures (Riyadh: aging total ≈ 0.32 bn, screenshot `90-restricted-riyadh-dashboard-ar.jpg`); (f) mobile 375 no overflow (`110b-insights-dashboard-mobile375-full-ar.jpg` pattern). |
| Screens | `01b-insights-dashboard-full-ar.jpg` (layout pre-picker, figures valid), `120-dashboard-charts-toolbar-v2-ar.jpg`, `122-dashboard-aging-chart-changed-to-horizontal-v2-ar.jpg`, `100b-insights-dashboard-full-en.jpg` |
| Placement | Third chart card of «من الإجمالي إلى المحصّل» (aging): one muted line under the chart title, above the picker toolbar. |
| Needs wireframe | no |
| Visuals | AR: [SH-A01-aging-standing-balance-ar](annotated/SH-A01-aging-standing-balance-ar.jpg); EN: [SH-A01-aging-standing-balance-en](annotated/SH-A01-aging-standing-balance-en.jpg); [detail 1](annotated/SH-A01-detail-1.jpg) |

## SH-A02 — One aging scheme: six buckets, «due date unavailable», stated basis, drill (P1)

| Field | Content |
|---|---|
| Requirements / gap | R2 (aging), R4 (long-outstanding amounts) · GAP-R2-2, GAP-R2-3 |
| Existing coverage | Five buckets everywhere (dashboard, Smart Reports, exports, Decision Room aged item); the picker offers a **days-overdue histogram** (60-day bins) on aging charts (08 §1.2); the NC analysis has a separate `unavailable` bucket; the list already filters by age bucket and day range (`server/lists.js:135,184`). |
| Current behaviour | **VERIFIED.** `server/engine.js:316–317` `AGING`/`agingBucket` = not due · 1–30 · 31–90 · 91–180 · **180+**; `server/noncollection.js:14` same + `unavailable`. 6.18 of 8.32 bn (74.3 %) sits in the unsplit 180+ bucket (01 §A1), so the «long-outstanding» view says nothing inside the tail. The histogram bins (`1–60 … 721–780`) do not equal 181–365 / >365 (the 361–420 bin straddles 365). **VERIFIED (in-memory probe `scratch/r1/probeD.mjs`):** an undated receivable is counted in 180+ and in `stock.overdue` by the snapshot (`engine.js:221`, `overdueDays` with a blank due date) while NC and the list show «due date unavailable»; the synthetic world has none, so it is **not demonstrable** (code-level only). Dashboard aging bars are **not clickable** (`index-draft.md` D4; chart drill list in 08 §1.2). |
| Evidence | `engine.js:316–317,359` · `noncollection.js:14,18` · `lists.js:135,184,338` (priority age tiers) · `lateness.js` · screenshots `01b-insights-dashboard-full-ar.jpg`, `61b-smart-receivables-report-full-ar.jpg`, `132b-analysis-result-full-ar-v2.jpg` |
| Gap / why a change | SH asked for not-yet-due · 1–30 · 31–90 · 91–180 · 181–365 · over a year (R2.13). Three consumers use different treatments of the same invoice. The basis of the age is not on the chart. |
| Proposed refinement | **RECOMMENDATION.** (1) Split bucket 5: `181–365` and `>365`; add a seventh output `due date unavailable`, shown only when non-zero. (2) Update every consumer in one change: `engine.js` (stride at `:359`), `noncollection.js` `AGE_KEYS`, `lists.js:135` age filter, chart/label text, exports, tests; keep a derived «over 180 days» total for the Decision Room thresholds (`aged180ByAmanah`, `decisionRoom.js:148`) and the list priority tiers (`lists.js:338`). (3) Caption under the chart: «العمر = تاريخ القطع − (تاريخ الاستحقاق + فترة السماح)» with the grace value (default 0, rule unresolved — SH-A31). (4) Each bar opens `/collection` for that bucket over **all issue periods** (existing `f.age`/`ageMin–ageMax` + `allPeriods`); folded «Other» and histogram bins stay non-clickable (existing limit, 08 §1.2). |
| Required data / formula | Business definition: standing uncollected net balance by days past due at the reporting date. `days = max(0, cutoff − (due + graceDays))`; buckets: 0 not yet due; 1–30; 31–90; 91–180; 181–365; >365; blank due date → `unavailable` (never a day bucket). Source fields: due date, payments, exclusion/cancellation flags (same `derive`). Grain: invoice. Date basis: cut-off + `graceDays`. Filters: snapshot scope (standing = all issue periods). Identity: Σ buckets = `stock.netUncollected`; overdue + not-yet-due + unavailable = standing (the dictionary line «overdue + not yet due = standing» changes accordingly — SH-A10). |
| Priority | **P1** — the SH's long-outstanding question cannot be answered inside a 74 % bucket; the undated-invoice rule is a latent trap for real data. |
| Dependencies | Grace-period rule (SH-A31) changes values, not structure. Must land before/with SH-A16(a) (Pareto must not re-order these buckets) and SH-A10. **Coordinate** with access control (`engine.js`, `lists.js` are being edited). |
| Acceptance | (a) Σ buckets = standing net for national, Jeddah and Riyadh (existing check `aging_sum_eq_net`); (b) the two new buckets sum to the old 180+ bucket (regression: 6,184,489,884 SAR in the baseline); (c) drill parity test (pattern of `nc-drilldown`, 13 tests): every bar opens a list whose count and amount equal the bar; (d) test fixture (in memory) with one blank due date: the invoice moves from >365 to `unavailable` identically in snapshot, NC and list, and `stock.overdue` excludes it; (e) the same bucket labels AR/EN in dashboard, Smart Reports, NC, exports (export parity holds); (f) Decision Room aged item and list priority unchanged in value (tests `decision-room`, `invoice-lists-ui` still pass). |
| Screens | `01b-insights-dashboard-full-ar.jpg`, `61b-smart-receivables-report-full-ar.jpg`, `134-analysis-tab-reasons-concentration-ar-v2.jpg` (the NC aging card is in this tab, cut by the viewport after the fourth bar; the NC overview `132b` has no aging chart), `121-dashboard-aging-chart-picker-open-v2-ar.jpg` |
| Placement | Aging chart (dashboard third chart, Smart Reports aging section, NC aging card «صافي غير المسدد حسب التقادم» in the reasons & concentration tab): seven bars in one order (RTL aware); basis caption directly under SH-A01's chip. |
| Needs wireframe | no |
| Visuals | dashboard: [SH-A02-aging-scheme-dashboard-ar](annotated/SH-A02-aging-scheme-dashboard-ar.jpg); Smart Reports: [SH-A02-aging-scheme-smart-report-ar](annotated/SH-A02-aging-scheme-smart-report-ar.jpg); NC analysis: [SH-A02-aging-scheme-nc-analysis-ar](annotated/SH-A02-aging-scheme-nc-analysis-ar.jpg) |
| Extended by R4 | **SH-A38 / 09 §5:** the same undated invoice also prints `dueDate 1970-01-01` and `daysOverdue 20762` in list rows (`lists.js:85`), the CSV and the NC appendix — add to acceptance (d): rows, CSV and appendix print «—». The six overdue buckets are the aging axis of the overdue report (SH-A35); verified that 181–365 = 38 invoices / 2,431,218,972 and > 365 = 54 / 3,753,270,912 (sum = the old 180+ bucket 6,184,489,884 for standing overdue). | |

## SH-A03 — Show the debtor in the uncollected list, details and CSV; separate the issuer label (P1)

| Field | Content |
|---|---|
| Requirements / gap | R2 (who owes it) · GAP-R2-1 (a) |
| Existing coverage | Row data carries the debtor `payerAr/En` (`server/lists.js:82`), managing entity (Amanah + municipality) and issuing biller. The payer is shown in the collected list («الجهة المفوترة»), invoice register, invoice page (type, name, masked id), NC invoices; search by payer works. |
| Current behaviour | **VERIFIED.** In the uncollected list the column is **Product** (`CoreInvoiceTable.jsx:78,97`); the details row (`DetailRow`, `:24–50`) has no payer; the CSV (`exportChunks`, `lists.js:391`) has no payer column. The line under the invoice number «المفوتر 171 · قطاع الإسكان» (`:94`, screenshot `14-uncollected-list-rows-ar-v2.jpg`) is the **issuer**, while the collected list uses «الجهة المفوترة» for the **debtor** (`:78`): one letter apart in Arabic. The invoice page uses a third pair («المُصدَر له» / «الجهة المصدرة», screenshot `07-invoice-detail-top-ar.jpg`). |
| Evidence | route `/collection` · `CoreInvoiceTable.jsx:24–50,78,94,97` · `lists.js:71–82,391` · screenshots `14-uncollected-list-rows-ar-v2.jpg`, `16-uncollected-row-expanded-ar.jpg`, `07-invoice-detail-top-ar.jpg` |
| Gap / why a change | The primary receivables view cannot answer «who is responsible for payment» although the data exists (01 §A2). The label pair invites a wrong reading. |
| Proposed refinement | **RECOMMENDATION.** (1) Uncollected mode: the debtor (name; ID status chip «معرّف المدين ناقص» when missing) as the **primary line of the cell that today holds the product**, with the product as its muted second line — no extra column, same stacked-card behaviour on 375 px. (2) Details row: first item «المدين: name · ID type · masked ID», plus contract number (R2.7). (3) CSV: add `payer_name`, `payer_id_type`, `payer_id_masked`, `contract_no`. (4) One label pair on every surface, list/invoice page/CSV headers: debtor = «المدين (الجهة المطالَبة بالسداد)», issuer = «الجهة المُصدِرة للفاتورة» — **PENDING business confirmation of the Arabic pair** (decision Q4 in 05); the issuer line at `:94` is renamed. |
| Required data / formula | Not a metric. Fields: `payerAr/En`, payer id type + masked id (as the invoice page masks it, `••••••9171`), `contractNo`. Missing-data behaviour: blank name → «غير محدد» (never blank); missing id → the existing chip (`F.MISSING_ID`, `noncollection.js:75`). Full IDs are never shown in a list or CSV. |
| Priority | **P1** — SH point 2 asks for the entities responsible for payment; the data exists; small change. |
| Dependencies | Label decision (Q4). CSV permission follows `invoices.export` / `collection.export` from the access-control work (**coordinate**; do not add a second check). Debtor **aggregation** is SH-A23 (blocked). |
| Acceptance | (a) every row of the uncollected list shows its debtor at 1440 px and 375 px, AR and EN; (b) CSV header contains the four columns and its row count equals the list total; (c) the payer text of sampled rows equals the invoice page payer; masked id never shows more than the invoice page does; (d) searching a payer returns rows that display that payer; (e) a restricted user's CSV/list contains only visible rows' debtors; (f) the issuer and debtor labels are different words on every surface (snapshot test); (g) export parity unchanged for the other lists. |
| Screens | `14-uncollected-list-rows-ar-v2.jpg`, `16-uncollected-row-expanded-ar.jpg`, `07-invoice-detail-top-ar.jpg` (reference), `04-collection-uncollected-list-top-ar-v2.jpg` |
| Placement | In the «المنتج» cell of each row (debtor first line, product second line); first line of the expanded details row; CSV columns after `invoice_number`. |
| Needs wireframe | **yes** (small): the cell layout on desktop and the stacked card on mobile. |
| Visuals | list: [SH-A03-debtor-in-uncollected-list-ar](annotated/SH-A03-debtor-in-uncollected-list-ar.jpg); details row: [SH-A03-debtor-in-expanded-row-ar](annotated/SH-A03-debtor-in-expanded-row-ar.jpg); [detail 1](annotated/SH-A03-detail-1.jpg); [SH-A03-wireframe-ar](wireframes/SH-A03-wireframe-ar.jpg); [SH-A03-current-vs-proposed](wireframes/SH-A03-current-vs-proposed.jpg) |
| Extended by R4 | **SH-A38:** the overdue invoice appendix of the NC report, the NC screen table (due date, source) and the overdue CSV header (reporting date) use the same debtor columns; the debtor is already in the NC screen table (`NcInvoices.jsx:75`) and the row object. | |

## SH-A04 — Decision Room item link must open exactly what the item counts (P1)

| Field | Content |
|---|---|
| Requirements / gap | R2, R4, R5 · found by R2 (drill D5) |
| Existing coverage | Decision items carry evidence links with status; the list reads `from`/`to`, `amanah`, `muni`, `category` from the link (`Collection.jsx:48–53`); the list supports `allPeriods` (`lists.js:140`) and age filters (`lists.js:135,184`). |
| Current behaviour | **VERIFIED.** Item «قطاع الإسكان: متأخرات غير مسدّدة» states «31 فاتورة مرّ على استحقاقها أكثر من 180 يوماً، قيمتها 3.67 مليار (كل الفترات)» (`decisionRoom.js:186`) and offers the link «فواتير الجهة المتأخرة (وسّع الفترة لرؤية الأقدم)» with `count: 31` (`:208`); the link has **no period and no age filter**, so the list opens on the default period: **16 invoices / 1.64 bn** (screenshots `35-decision-item-evidence-links-ar-v2.jpg` → `36-drill-housing-overdue-all-periods-stock-ar-v2.jpg`). |
| Evidence | `decisionRoom.js:186,206–208` · `Collection.jsx:48–53` · screenshots 35, 36 · `index-draft.md` D5 |
| Gap / why a change | The count beside the link promises one population and the list shows another: a trust break on the exact drill the SH will click. |
| Proposed refinement | **RECOMMENDATION.** Build the link of the standing-balance item with the all-issue-periods range and the age filter that matches its count (>180 days → `ageMin=181`), so the list equals the item's figures; keep the hint «(كل الفترات)». If the list cannot carry the age filter from a URL, change the badge to what the link opens and say so. |
| Required data / formula | none new. Basis: standing balance (all issue periods) net of exclusions, age >180 days at the cut-off — the same `stock` definition as the item. |
| Priority | **P1** — demo-visible mismatch, small. |
| Dependencies | `Collection.jsx` must accept the all-periods and age parameters (URL contract); if SH-A02 changes bucket keys, use its keys. |
| Acceptance | For every Amanah item with an aged part, the link opens a list with count and net amount equal to the item's (31 / 3.67 bn for Housing in the baseline); same for a municipality-scoped item; restricted user sees their own items only; tests `decision-room` (24) and a new link-parity test pass. |
| Screens | `32b-decision-item-analysis-full-ar.jpg` (the third evidence link «(31)» is visible here, y≈3150; it is below the viewport of `35-decision-item-evidence-links-ar-v2.jpg`, which shows the item header only), `36-drill-housing-overdue-all-periods-stock-ar-v2.jpg` (landing list) |
| Placement | Third evidence link of the open Decision Room item in the analysis panel (the line with the count badge «31»; see `32b`). |
| Needs wireframe | no |
| Visuals | link: [SH-A04-decision-link-population-ar](annotated/SH-A04-decision-link-population-ar.jpg); landing list: [SH-A04-decision-link-landing-list-ar](annotated/SH-A04-decision-link-landing-list-ar.jpg) |
| Extended by R4 | **SH-A39:** the same `Collection.jsx` URL contract (it reads only `amanah, src, from, to, muni, category`) must also carry `dueState`, `allPeriods` and the age filter; verified for Smart Reports rows (Jeddah 23 → landing 57 → real 29). | |

## SH-A05 — Journey navigation: dashboard → Planning, Decision Room in the sidebar, «أين نركز» → item (P1)

| Field | Content |
|---|---|
| Requirements / gap | R5 (insights → actions), R3 (actions to improve collection) · GAP-R5-1 |
| Existing coverage | Uncollected list header already links to Planning («هدف التحصيل السنوي», `Collection.jsx:127`); dashboard has «أبرز ما يحتاج مراجعة» with «فتح غرفة القرارات» (`DecisionSummary.jsx:21`); Planning's «أين نركز» lines link to the list. |
| Current behaviour | **VERIFIED.** The dashboard has no link to `/planning` (`grep '/planning'` in `src/components/insights`, `ExecutiveParts`, `decisions`: none); the Decision Room has **no sidebar entry** (`Layout.jsx:155–171`; on `/decisions` the dashboard item is highlighted, `Layout.jsx:188`); «أين نركز» lines open the unfiltered `/collection` (`PlanForecast.jsx:61`) although a Decision Room item `plan:<entity>` exists (`decisionRoom.js:324`). |
| Evidence | `Layout.jsx:155–171,188` · `DecisionSummary.jsx:21` · `Collection.jsx:127` · `PlanForecast.jsx:61` · `decisionRoom.js:324` · screenshots `01-insights-dashboard-top-ar-v2.jpg`, `25-planning-focus-and-reasons-ar.jpg`, `30-decision-room-top-ar.jpg` |
| Gap / why a change | Journey step 3 («what we expect to collect») is a sidebar visit away from the dashboard and step 5 («actions») is reachable only through one panel. |
| Proposed refinement | **RECOMMENDATION.** (a) One link row at the end of the dashboard section «الأداء عبر الزمن»: «أين نحن من الخطة السنوية؟ ← تخطيط إيرادات التحصيل» with the existing tag «تقدير تجريبي». **No number is repeated** (collected-to-date there is payment-date basis and differs from the tile — see 08 §5.2 — so it would create a third «collected»). (b) Sidebar: «غرفة القرارات» under «نظرة عامة» directly below the dashboard item; remove the `/decisions` → dashboard active mapping (`Layout.jsx:188`). (c) Each «أين نركز» line links to `/decisions?item=plan:<entity>` when that item exists, otherwise keeps today's link — never a dead link. |
| Required data / formula | none. |
| Priority | **P1** — closes the weakest journey step with three links, no new content. |
| Dependencies | (b) uses the permission map of the access-control work (`decisions.view`): **coordinate** with `Layout.jsx` edits. |
| Acceptance | (a) link visible AR/EN, opens `/planning` with the user's Amanah scope; (b) sidebar item present, active only on `/decisions`, hidden for a user without `decisions.view` (after access control), keyboard focus order correct; (c) every «أين نركز» link resolves to an existing item or falls back; (d) mobile drawer lists the new item; no layout shift on 375 px. |
| Screens | `01-insights-dashboard-top-ar-v2.jpg`, `20b-planning-landing-full-ar.jpg` (the «أين نركز» list, y≈2730–2880; `25-planning-focus-and-reasons-ar.jpg` shows the targets table and tile row, not that list), `30-decision-room-top-ar.jpg` |
| Placement | (a) Last line inside «الأداء عبر الزمن» (above «تفصيل الأداء»); (b) sidebar group «نظرة عامة», second row; (c) each line of the «أين نركز» list (visible in `20b`), trailing link. |
| Needs wireframe | no |
| Visuals | (a) dashboard link row: [SH-A05-journey-dashboard-to-planning-ar](annotated/SH-A05-journey-dashboard-to-planning-ar.jpg); (b) sidebar: [SH-A05-journey-sidebar-decision-room-ar](annotated/SH-A05-journey-sidebar-decision-room-ar.jpg); (c) focus lines: [SH-A05-journey-focus-to-item-ar](annotated/SH-A05-journey-focus-to-item-ar.jpg) |

## SH-A06 — Planning: expected remaining, «method and assumptions» panel, aged share of the ceiling (P1)

| Field | Content |
|---|---|
| Requirements / gap | R3 (expected annual revenue, assumptions, drivers), R6 (disclosure) · GAP-R3-1 |
| Existing coverage | `/planning`: targets, collected-to-date, deviation, chart target/estimate/actual, reasons («billing insufficient» / «pace short»), «أين نركز»; tag «تقدير تجريبي – للعرض التوضيحي» and the footnote «not an approved model»; reporting date line; Smart Reports forecast text lists method id and assumptions (`revenueOutlook.js:149–160`, `FORECAST_METHOD.id = ols_trend_v1`). |
| Current behaviour | **VERIFIED.** The year-end estimate (10.95 bn) appears only as the sub-line of the probability tile (screenshot `24-planning-probability-wording-ar.jpg`); the remainder = estimate − collected is not a stated number; no horizon, history window, method/version, assumption list, seasonality, recovery assumption or alignment status on the page; the ceiling sentence («حتى مع تحصيل 100 % …», `PlanForecast.jsx:26`) assumes full recovery of a standing balance that is 74 % older than 180 days and does not say so (01 §B3). |
| Evidence | `src/data/planForecast.js:24–47` · `PlanForecast.jsx:19–46,61` · `revenueOutlook.js:149–160` · 01 §B1–B3 · screenshots `23-planning-forecast-vs-target-ar.jpg`, `24-planning-probability-wording-ar.jpg`, `102-planning-forecast-en.jpg` |
| Gap / why a change | SH 3 asks for expected annual revenue **with assumptions and drivers**; HLSD V0.6 FR-010/WF02-03/05 requires horizon, data freshness, method/version and cut-off to be shown (00 §3). Everything needed is already in constants or inputs. |
| Proposed refinement | **RECOMMENDATION.** (1) In the position freed by SH-A07 (the right-hand tile under the chart): tile «المتوقع تحصيله للأشهر المتبقية (تقدير توضيحي)» = estimate − collected, sub-line «المحصّل حتى اليوم + المتوقع = تقدير نهاية السنة». (2) Directly under the chart legend, a panel «الطريقة والافتراضات» (collapsed summary line by default): reporting date (cut-off) · horizon (to fiscal year-end, N months) · method name «متوسط الوتيرة — آخر ≤3 أشهر مغلقة» + a version string constant (proposal `plan_runrate_v1`) · history months used / available · basis (payments by payment date) · monthly plan shape (even/curved, as set) · «لا موسمية · لا افتراض استرداد للأرصدة القائمة» · target status and «آخر تعديل» · «غير مُوفَّق مع منهجية فريق التخطيط — بانتظار المراجعة» (PENDING, SH-A26/A27) · limitation text. (3) Ceiling sentence gains the aged share from `stock.aging`: «منها X % مرّ على استحقاقه أكثر من 180 يوماً». **No scenarios, no range, no «AI forecast» wording.** |
| Required data / formula | **Expected remaining** — business definition: cash expected from the reporting date to the fiscal year-end under the stated run-rate. Formula: `estimate − collectedToDate` (both from `forecastYear`; `estimate = collected + max(current month, avg) + avg × remaining months`, avg = mean of the last ≤3 closed months). Source: payments by payment date (Tahseel authoritative). Grain: month × selected entity. Date basis: reporting date = cut-off. Filters: the page's fiscal year + Amanah. Missing data: fewer than 1 closed month → «غير متاح — لا يكفي التاريخ» instead of a number; with 1–2 months, the panel states the number of months used. Aged share = `aging[>180] ÷ stock.netUncollected` (after SH-A02: the two last buckets). |
| Priority | **P1** — answers SH 3 and 6 for the disclosure part without needing the teams' methodology. |
| Dependencies | SH-A07 (tile position), SH-A08 (target source shown in the panel), SH-A02 (aged share). The «alignment pending» line is removed only by SH-A20. |
| Acceptance | (a) the panel lists every item above and its values come from the constants/inputs (a test changes the months window and target and the panel text changes); (b) `collected + expected remaining = estimate` to 0 SAR; (c) no «AI», «confidence», «probability» word on the page; (d) AR/EN; (e) restricted scope shows its own values; (f) if the page is exported (`planning.export`), the panel is in the export (parity check). |
| Screens | `23-planning-forecast-vs-target-ar.jpg`, `24-planning-probability-wording-ar.jpg`, `102-planning-forecast-en.jpg` |
| Placement | Tile: right-hand of the two tiles under the chart. Panel: between the chart legend and the tile row (collapsed line), expanding in place. Ceiling line: inside «مبررات عدم تحقيق المستهدف», first bullet. |
| Needs wireframe | **yes** (new panel and the tile row). |
| Visuals | AR: [SH-A06-planning-method-panel-ar](annotated/SH-A06-planning-method-panel-ar.jpg); EN: [SH-A06-planning-method-panel-en](annotated/SH-A06-planning-method-panel-en.jpg); [detail 1](annotated/SH-A06-detail-1.jpg); [detail 2](annotated/SH-A06-detail-2.jpg); [SH-A06-wireframe-ar](wireframes/SH-A06-wireframe-ar.jpg); [SH-A06-current-vs-proposed](wireframes/SH-A06-current-vs-proposed.jpg) |

## SH-A07 — Planning: remove/relabel «احتمالية تحقيق المستهدف» and its traffic light (P1)

| Field | Content |
|---|---|
| Requirements / gap | R3, R4, R6 · GAP-R3-2 |
| Existing coverage | The same page already shows the deviation and the reasons («pace needed vs recent pace»). |
| Current behaviour | **VERIFIED.** Tile «احتمالية تحقيق المستهدف **1 %**» (`PlanForecast.jsx:46`, screenshot `24-planning-probability-wording-ar.jpg`) = `1 − Φ((target − estimate) ÷ (sd·√monthsLeft))` from ≤3 monthly points, clamped to [0.01, 0.99] (`planForecast.js:30–43`); colour-coded at 70 % / 35 % (`PlanForecast.jsx:20`); documented as «Probability» in `dictionaryDocs.js:158–162`. It is a normal-tail statistic, **not** a probability a model has validated (HLSD AC-10 requires calibration; none exists — 00 §3). `F.probability` is read only by this tile (grep). The demo shows 1 % because the on-screen target is far above the estimate; the 1 % is the clamp floor. |
| Evidence | `planForecast.js:30–43` · `PlanForecast.jsx:19–20,46` · `dictionaryDocs.js:158–162` · 01 §B4 · 08 §2.2 |
| Gap / why a change | A bare «probability» with a verdict colour gives an unvalidated statistic the look of a model output — the exact wording the project rules forbid («illustrative calculation is never a validated AI forecast»). |
| Proposed refinement | **RECOMMENDATION.** Step 1 (now): remove the tile, the traffic-light classes and the dictionary entry's «Probability» wording; the SD/z arithmetic is no longer displayed (keep or delete the code, not shown); the freed position is used by SH-A06's tile. Step 2 (only if the SH wants a likelihood cue): the existing reasons already compare «pace needed per remaining month» with the recent pace — keep it there; **no new tile**. Never replace it with «confidence» or «scenario range». |
| Required data / formula | none (removal). |
| Priority | **P1** — wording that overclaims on the SH's forecasting page. |
| Dependencies | SH-A06 (position), SH-A10 (dictionary entry rewrite). |
| Acceptance | (a) no «احتمال/Probability» string for target attainment on `/planning`, in its export, in the dictionary, in chat answers; (b) no traffic-light colour derived from the estimate (the actual-vs-plan deviation tile may keep its colour: it states observed data); (c) the terminology test list gains the retired phrases (AR/EN); (d) `planForecast` tests still pass for `estimate`, `reasons`. |
| Screens | `24-planning-probability-wording-ar.jpg`, `23-planning-forecast-vs-target-ar.jpg` |
| Placement | The right-hand tile under the chart (the one titled «احتمالية تحقيق المستهدف»). |
| Needs wireframe | no (see SH-A06) |
| Visuals | AR: [SH-A07-planning-remove-probability-tile-ar](annotated/SH-A07-planning-remove-probability-tile-ar.jpg); [detail 1](annotated/SH-A07-detail-1.jpg); [SH-A07-wireframe-ar](wireframes/SH-A07-wireframe-ar.jpg); [SH-A07-current-vs-proposed](wireframes/SH-A07-current-vs-proposed.jpg); the tile row also appears in the A06 wireframe |

## SH-A08 — One target source, one monthly shape, honest status wording (P1)

| Field | Content |
|---|---|
| Requirements / gap | R3, R6 · GAP-R3-3, GAP-R3-4 (target part) |
| Existing coverage | `/planning` targets come from the editable planning store (`planTargets.js`, saved on the device, «آخر تعديل»). Smart Reports/chat/analysis tasks use the static `DEFAULT_TARGETS`. |
| Current behaviour | **VERIFIED.** Two annual targets exist for the same year: `/planning` shows 21.59 bn (66 % coverage × 32.7 bn communicated budget, screenshot `24-planning-probability-wording-ar.jpg`) while `DEFAULT_TARGETS.collectionAmountAnnual` (`revenueMetrics.js:645+`; used by `RevenueContext.jsx:61`, `analysisTasks.js:96,274`, `revenueOutlook.js:87`) is the revenue appropriation total — 11.495 bn in R1's probe (01 §B2, `probeB`). Monthly shapes differ too (planning: even/edited weights; `DEFAULT_TARGETS.monthlyCurve`: a curved shape, status `demo`). The code comment «one target, not two» (`revenueMetrics.js` above `collectionAmountAnnual`) is stale. Wording: «approved annual target (a demo input …)» is back in `assistantAnswers.js:82` (re-read today; 08 said it had been removed — the file is in flux), and persists at `smartReport.js:101`, `revenueInsights.js:364` (label «المستهدف السنوي المعتمد (مُدخل توضيحي)»), `revenueOutlook.js:4`. The status in code is `demo`. |
| Evidence | `planTargets.js` (header, `targetsOf`) · `revenueMetrics.js:645–680` · `RevenueContext.jsx:61` · `analysisTasks.js:96,274,286,303` · screenshots 24, 92 · 01 §B2, B4 · 08 §1.2 |
| Gap / why a change | The same scope and date give two different targets and two year-end numbers (10.95 vs 9.96 bn) depending on which door the SH uses — contrary to SH 6 («consistent sources, assumptions, forecasts»). «Approved» next to a demo figure is false. |
| Proposed refinement | **RECOMMENDATION.** (1) Smart Reports, chat and analysis tasks read the target through the same function as `/planning` (planning store → entity targets) for the same scope and year; (2) one monthly shape (the planning store's weights); (3) a status-driven word: «مستهدف توضيحي غير معتمد» while `status === 'demo'`, «معتمد» only when `approved` (SH-A22); replace the four strings above; (4) the planning panel (SH-A06) shows the status and last edit. Saved reports keep the target they were built with (versioned records) and state it. |
| Required data / formula | Target = planning store value for scope/year (coverage × communicated budget, per entity, summed); no new data. Missing: no target for the scope → existing `no_target` state, never 0. |
| Priority | **P1** — two targets for one scope is visible in a single demo (planning page vs Smart Reports forecast). |
| Dependencies | SH-A20 (which method), SH-A22 (approved status). The planning store is device-local: Smart Reports on the same device only (state it). |
| Acceptance | (a) same scope + year ⇒ identical annual target on `/planning`, Smart Reports forecast section, chat answer and analysis task (test); (b) a target edited on `/planning` appears in the next Smart Reports forecast; (c) grep of UI strings: no «approved/معتمد» adjacent to a `demo` status (status-driven label test); (d) one monthly shape in every consumer; (e) AR/EN. |
| Screens | `24-planning-probability-wording-ar.jpg`, `104-chat-forecast-prioritisation-en.jpg`, `22-planning-monthly-targets-ar.jpg` |
| Placement | Target tile «المستهدف السنوي للإيراد» and the targets panel header (status word); Smart Reports forecast sentence; chat answer. |
| Needs wireframe | no |
| Visuals | tile AR: [SH-A08-one-target-honest-status-ar](annotated/SH-A08-one-target-honest-status-ar.jpg); chat EN: [SH-A08-one-target-chat-answer-en](annotated/SH-A08-one-target-chat-answer-en.jpg) |

## SH-A09 — Smart Reports chat: an honest answer and a pointer for forecast / probability / prioritisation (P2)

| Field | Content |
|---|---|
| Requirements / gap | R3, R4, R5 |
| Existing coverage | The floating assistant has a `forecast` intent (`assistantAnswers.js:75–83`); Smart Reports chat creates reports and refines charts (screens 60, 61, 171–174). |
| Current behaviour | **VERIFIED (screenshots).** «كم نتوقع أن نحصّل من الإيرادات بنهاية السنة؟» → «لا أستطيع تطبيق جزء من فترة (بداية/نهاية/منتصف) … هل أتابع بدونه؟» (`62-chat-forecast-question-ar.jpg`); «ما احتمال تحصيل المبالغ المتأخرة منذ أكثر من 180 يوماً؟» → misread as an amount threshold «حدّ مبلغ أو عدد (اكثر من 180)» (`64-chat-probability-question-ar.jpg`); «ما الفواتير التي يجب أن نعطيها أولوية؟» → a generic revenue report, not an invoice priority list (`63-chat-prioritization-question-ar.jpg`; R2 index). EN: «forecast (not available in Smart Reports)» (`104-chat-forecast-prioritisation-en.jpg`). No pointer to `/planning` or to the priority-sorted list. |
| Evidence | screenshots 62, 63, 64, 104 · `chatIntents.js`, `reportIntents.js`, `assistantAnswers.js:75–83` |
| Gap / why a change | The three questions the SH is most likely to ask the assistant get a misparse. Honest «not available here — here is where it is» is part of R3/R4 credibility. |
| Proposed refinement | **RECOMMENDATION.** Intent rules for forecast / expect / probability / likelihood / prioritise / «أولوية»: answer = what exists (illustrative run-rate on Planning; High/Medium/Low follow-up priority on the uncollected list sorted by priority; Decision Room) + what does not exist (per-invoice collection probability, recoverability) + three links (`/planning`, `/collection` sorted by priority, `/decisions`). Text reuses SH-A06/A11 wording. No new calculation, no «AI forecast». |
| Required data / formula | none. |
| Priority | **P2** — high odds in a live demo, but the walkthrough can avoid it. |
| Dependencies | SH-A06, SH-A11 (wording), SH-A18 (alias) for the retired term. |
| Acceptance | Scripted questions AR and EN (year-end expectation; probability of collecting >180 days; which invoices first) each give: no misparse message, the explicit not-available statement for probability/recoverability, a working link in scope; a restricted user's answer says it is within their scope; tests in the chat-workspace suite (22) extended. |
| Screens | `62-chat-forecast-question-ar.jpg` and `64-chat-probability-question-ar.jpg` (both show the clarification bubble), `63-chat-prioritization-question-ar.jpg` (shows a generic revenue report under «الإجابة:», not a clarification bubble), `104-chat-forecast-prioritisation-en.jpg` |
| Placement | Forecast and probability questions: the assistant's reply bubble (replace the clarification bubble) with the link buttons in the same row as «تابع بدونه». Prioritisation question: the «الإجابة:» block of `63` (replace the generic report by the priority answer + links). |
| Needs wireframe | no |
| Visuals | forecast AR: [SH-A09-chat-forecast-answer-ar](annotated/SH-A09-chat-forecast-answer-ar.jpg); priority AR: [SH-A09-chat-prioritisation-answer-ar](annotated/SH-A09-chat-prioritisation-answer-ar.jpg); probability AR: [SH-A09-chat-probability-answer-ar](annotated/SH-A09-chat-probability-answer-ar.jpg); forecast EN: [SH-A09-chat-forecast-answer-en](annotated/SH-A09-chat-forecast-answer-en.jpg) |

## SH-A10 — Metrics dictionary: six missing definitions; correct the stale ones (P2)

| Field | Content |
|---|---|
| Requirements / gap | R5 (definitions reachable), R4, R2 · GAP-R5-3, GAP-X-1 |
| Existing coverage | `/settings/metrics` lists gross → net → collected → uncollected, standing, overdue, not yet due, rate, plan metrics, cut-off, grace, due date, Amanah, composite key (`metricDictionary.js:13–78`; screenshot `70-metrics-dictionary-ar.jpg`; no financial filters, as required). |
| Current behaviour | **VERIFIED.** No entry for aging buckets, follow-up priority, year-end estimate, target achievement, municipality, debtor/payer (page-text search by R2; screenshot 70). Stale text: `dictionaryDocs.js:168` documents a numeric «Priority score» (0.40·amount + 0.25·age + …), while the list shows High/Medium/Low from `priorityCore` (`lists.js:334`); `dictionaryDocs.js:158–162` documents a «Probability» (SH-A07); `revenueMetrics.js:762` says exclusion rules are unresolved (the 29 Oct status update says the methodology and exclusion reasons are approved); the Handbook M-14/M-15 (outside the repo, `~/Desktop/IIM-Requirements-Handover`) repeats the numeric score. |
| Evidence | `metricDictionary.js` · `dictionaryDocs.js:158–168` · `lists.js:334` · `revenueMetrics.js:762` · screenshot 70 |
| Gap / why a change | An SH question «what is aging / priority / the estimate?» has no in-app answer; two documents describe a rule the screens no longer use. |
| Proposed refinement | **RECOMMENDATION.** Six entries after «مفتاح الفاتورة المركّب», reusing tooltip wording: aging buckets (seven outputs, SH-A02), follow-up priority (amount tier = top 10 % / 25 % percentiles × age tier, caps, «not a probability»), year-end estimate (run-rate, illustrative, SH-A06), target achievement, municipality (Amanah → municipality; direct / not specified), debtor vs issuer vs managing entity. Rewrite `dictionaryDocs.js:158–168`; update `revenueMetrics.js:762`; note the Handbook correction in Part C (business doc). The identity line «overdue + not yet due = standing» gains «+ due date unavailable» (SH-A02). |
| Required data / formula | Definition cards (label AR/EN, formula, source, grain, date basis) — content only; thresholds read from `priorityCore` constants. |
| Priority | **P2** — content; no logic. |
| Dependencies | SH-A02, SH-A06, SH-A07, SH-A11 (wording consistency). |
| Acceptance | Six entries searchable on the page; each has formula/source/grain/basis; no financial filter appears on the page; documented priority thresholds are read from the same constants as `priorityCore` (test); no entry says «Probability» for target attainment; AR/EN. |
| Screens | `70-metrics-dictionary-ar.jpg` |
| Placement | Last group of the dictionary list, after «مفتاح الفاتورة المركّب» (below the fold of `70-metrics-dictionary-ar.jpg`, at its bottom edge). |
| Needs wireframe | no |
| Visuals | AR: [SH-A10-metrics-dictionary-new-group-ar](annotated/SH-A10-metrics-dictionary-new-group-ar.jpg) |

## SH-A11 — One priority language: limits stated, no owner/deadline text, dead «probability» strings (P1)

| Field | Content |
|---|---|
| Requirements / gap | R4 (prioritisation), R5, R1 · GAP-R4-1, GAP-R4-2, GAP-R4-3 |
| Existing coverage | **Fully covered core (retain):** list priority High/Medium/Low with the reason popover (`lists.js:334 priorityCore`, screenshot `15-uncollected-priority-badge-popover-ar.jpg`), Decision Room factors with thresholds (`decisionRoom.js:42–80`), NC priority groups with stated factors. Long-outstanding balances are never «Low» (0 rows >180 days rated Low — 01 §C4). |
| Current behaviour | **VERIFIED.** (a) No explanation states what the rule ignores (payment history, prior follow-up, recoverability). (b) Smart Reports recommendations take their «High» from a legacy numeric score `c.score >= 0.6` and print «Responsible … Timeframe …» (`smartReport.js:119`); NC priority cards print «Owner · deadline (suggested)» (`NcPriorities.jsx:30`) — while the Decision Room deliberately carries no owner or deadline (assignment features were intentionally removed). Three differently derived «High» labels exist. (c) `i18n.js:247,327,1090,1110,1118,1130,1190` hold strings promising a «recovery probability» (`th_prob`, `col_prob_dist`, `chart_recovery`, `col_list_sub`, `chart_collection`): **VERIFIED no consumer** (grep outside `i18n.js`: none) — dead, but shipped. (d) The invoice page has no priority rationale/next-step block (screenshot `07-invoice-detail-top-ar.jpg`; R2 index). |
| Evidence | `lists.js:334–340,371,407–436` · `smartReport.js:119` · `NcPriorities.jsx:30` · `decisionRoom.js:6` (header: no owners/deadlines) · `i18n.js` lines above · screenshots 15, 134-priorities, 61, 07 |
| Gap / why a change | SH 4 asks for prioritisation with aging and recoverability; the platform honestly has rule-based follow-up priority only. The limits must be said at the point of use, and the surfaces must not contradict the Decision Room principle. |
| Proposed refinement | **RECOMMENDATION.** (a) One sentence appended to every priority explanation (list popover, Decision Room «لماذا؟», NC priorities, invoice page card): «مبنية على المبلغ والعمر وجودة الدليل والاعتراض المسجّل؛ لا تُقيَّم سجلات السداد السابقة ولا المتابعات ولا إمكانية الاسترداد، وليست احتمالاً للتحصيل». (b) Smart Reports recommendations: priority from the list tiers for the same invoices, or the field is renamed «ترتيب مقترح»; remove «Responsible/Timeframe» text; NC cards: remove «Owner · deadline (suggested)» (keep the proposed next step). **Do not reintroduce assignment.** (c) Delete the five dead strings. (d) Invoice page: reuse the list's «سبب الأولوية + الخطوة التالية» as one card directly under the status strip, above «معلومات الفاتورة والتواريخ». |
| Required data / formula | none (reuse `priorityCore`). |
| Priority | **P1** for (a)+(b) (R4 honesty, contradiction with a standing decision); P2 for (c)+(d). |
| Dependencies | none; wording shared with SH-A06, SH-A09, SH-A10. |
| Acceptance | (a) every priority explanation in AR/EN contains the limits sentence (test over `priorityRow().why`, Decision Room `why`, NC card, invoice card); (b) «Responsible»/«المسؤول» and «Timeframe»/«الإطار الزمني» absent from Smart Reports recommendations and NC cards (test); Smart Reports priority values equal `priorityCore` for the same invoices or the field is not labelled High/Medium/Low; Decision Room tests unchanged (24 + 13); (c) grep: the five keys gone; (d) invoice card shows the same level and reason as the list for the same invoice. |
| Screens | `15-uncollected-priority-badge-popover-ar.jpg`, `134-analysis-tab-priorities-invoices-ar-v2.jpg` (shows the NC cards' «المالك · الموعد»), `07-invoice-detail-top-ar.jpg`, `31-decision-item-why-expanded-ar.jpg`; the Smart Reports «المسؤول / الإطار الزمني» lines are **not visible** in `61`/`61b` (textual change, part (b)) |
| Placement | End of each explanation text; invoice-page card directly under the status strip (above the amounts/dates card that sits between the strip and the info blocks). |
| Needs wireframe | no |
| Visuals | popover: [SH-A11-priority-limits-list-popover-ar](annotated/SH-A11-priority-limits-list-popover-ar.jpg); NC priorities: [SH-A11-priority-nc-owner-deadline-ar](annotated/SH-A11-priority-nc-owner-deadline-ar.jpg); invoice page: [SH-A11-priority-invoice-page-card-ar](annotated/SH-A11-priority-invoice-page-card-ar.jpg); Decision Room: [SH-A11-priority-decision-why-ar](annotated/SH-A11-priority-decision-why-ar.jpg) |

## SH-A12 — One insight sentence under the default dashboard charts (P2)

| Field | Content |
|---|---|
| Requirements / gap | R5 (insights, issues, priorities, actions) · GAP-C-6 |
| Existing coverage | Decision Room, Top findings, NC priorities and Smart Reports insights already state issue / priority / action (08 §2.1, rated Fully). The insight engine already produces typed facts, e.g. the aging fact with its caveat (`insightsEngine.js:106–117`). |
| Current behaviour | **VERIFIED (08 §2.1).** Dashboard KPI tiles, the three flow charts, the trend, the Exclusions page chart and the Planning tiles state no issue, priority or action. The chart picker (**already covered, functionality**) changes the form, not the message. |
| Evidence | `InsightsDashboard.jsx:46–91` · `insightsEngine.js:106–117` · 08 §2.1 · screenshots `01b-insights-dashboard-full-ar.jpg`, `122-...` |
| Gap / why a change | SH 5 asks for «meaningful business insights», not only choice of form. **Smallest coherent change:** reuse the existing insight text. |
| Proposed refinement | **RECOMMENDATION.** One muted sentence directly under each of the three flow charts and the trend, generated from the insight engine facts (e.g. aging: «X % من الرصيد القائم أقدم من 180 يوماً (كل الفترات)»), with a link to the Decision Room item of the same basis. **Rendered only where the engine already emits a fact** — nothing otherwise, no filler, no new chart/metric/recommendation. |
| Required data / formula | none new; values = the engine's. Missing: engine returns nothing → no sentence. |
| Priority | **P2** — improves the default view; not a gap in a number. |
| Dependencies | SH-A01/A02 (same card; order chip → caption → chart → sentence). |
| Acceptance | sentence values equal the insight engine's; absent when no insight; same text in the dashboard export (parity); AR/EN; restricted scope uses its own scope; a link resolves to an existing item; no recovery/probability wording. |
| Screens | `01b-insights-dashboard-full-ar.jpg`, `120-dashboard-charts-toolbar-v2-ar.jpg` |
| Placement | Under the legend of each flow chart card (below the chart, above the card edge) and under the trend chart. |
| Needs wireframe | no |
| Visuals | flow charts: [SH-A12-insight-sentence-flow-charts-ar](annotated/SH-A12-insight-sentence-flow-charts-ar.jpg); trend: [SH-A12-insight-sentence-trend-ar](annotated/SH-A12-insight-sentence-trend-ar.jpg) |

## SH-A13 — Restricted user's Planning page must not say «الوزارة (كل الجهات)» (P2)

| Field | Content |
|---|---|
| Requirements / gap | R5 |
| Existing coverage | Restricted organisations narrow every figure (tests; 08 §7b). |
| Current behaviour | **VERIFIED (screenshot `92-restricted-riyadh-planning-ar.jpg`).** A user of «أمانة منطقة الرياض» sees the entity filter value «الوزارة (كل الجهات)», the title «المستهدفات · الوزارة (كل الجهات)» and the totals row «إجمالي الوزارة» although only one entity row exists (`PlanningArea.jsx:62–63`, `TargetsPanel.jsx:53`, `filters/localPages.js:175`). |
| Gap / why a change | The label claims a scope the user does not have. |
| Proposed refinement | **RECOMMENDATION.** Use the user's scope label (organisation name / `me.scopeSummary` from the access-control work) in those three places when the user's access is not «all»; totals row «إجمالي النطاق». |
| Required data / formula | none. |
| Priority | **P2** — label only. |
| Dependencies | **Coordinate with access control** (`describeGeoScope`, `scopeSummary`): verify first, it may already be changed. |
| Acceptance | restricted user: scope label + «إجمالي النطاق»; unrestricted unchanged; test with two organisations; AR/EN. |
| Screens | `92-restricted-riyadh-planning-ar.jpg`, `90-restricted-riyadh-dashboard-ar.jpg` |
| Placement | Entity filter value, targets panel title, totals row of the entity table. |
| Needs wireframe | no |
| Visuals | AR: [SH-A13-restricted-planning-scope-label-ar](annotated/SH-A13-restricted-planning-scope-label-ar.jpg) |

## SH-A14 — Collected rate card: explain the difference to the register (P3)

| Field | Content |
|---|---|
| Requirements / gap | R2, R5 · (the card itself is **already refined** on 2026-11-06 and is Fully covered) |
| Existing coverage | Card «نسبة التحصيل ضمن النطاق»: Collected ÷ Net invoiced × 100 with denominators and formula tooltip; says the register lists only paid/part-paid invoices (`CollectionRateCard.jsx`). |
| Current behaviour | **VERIFIED (R2/R3).** Scope collected 8,715,793,497 vs register 8,685,173,389: difference 30,620,108, **entirely in the Investment source** (register 783.8 m vs card 814.42 m); the other seven sources match exactly (`index-draft.md` D6; screenshot `153-collected-rate-card-tooltip-investment-mismatch-ar-v2.jpg`). The tooltip says only «قد يختلف قليلاً». Cause **not traced**. |
| Gap / why a change | An unexplained difference between a card and the list beneath it undermines the «traceable to records» rule. It is **a data question, not a defect** until traced. |
| Proposed refinement | **RECOMMENDATION.** (1) Trace the Investment difference in the synthetic data (candidates: payments counted per contract instalment, matching rule for unmatched investment invoices, payment cap) and document it. (2) Replace «قد يختلف قليلاً» by the named cause when known; if the cause is a data rule, state it in the tooltip; if unknown, open question O3 to the data owners. |
| Required data / formula | none new. |
| Priority | **P3** — small, source-specific. |
| Dependencies | none; open question O3. |
| Acceptance | cause reproduced by a test for source = Investment (card collected − register collected = the stated component); other sources 0; tooltip text matches AR/EN. |
| Screens | `153-collected-rate-card-tooltip-investment-mismatch-ar-v2.jpg`, `152-collected-rate-card-tooltip-fines-ar-v2.jpg`, `05-invoices-collected-list-top-ar-v2.jpg` |
| Placement | Existing (i) tooltip of the rate card. |
| Needs wireframe | no |
| Visuals | AR: [SH-A14-collected-rate-tooltip-cause-ar](annotated/SH-A14-collected-rate-tooltip-cause-ar.jpg); [detail 1](annotated/SH-A14-detail-1.jpg) |

## SH-A15 — Enforcement home: the Databank is a tool, not a source (P3)

| Field | Content |
|---|---|
| Requirements / gap | R5 (wording rule) |
| Existing coverage | The page states «بيانات تجريبية · OCR محاكاة» (screenshot `50-enforcement-home-ar.jpg`). |
| Current behaviour | **VERIFIED.** The ingestion chip reads «بنك البيانات — قراءة مباشرة · آخر قراءة …» (`src/data/ingestion/reports.js:12`), presenting the Databank as the origin; the code says the data is synthetic. Standing rule: Databank/Makeen/Incorta are tools, never sources. |
| Gap / why a change | Wording presents a tool as a source. |
| Proposed refinement | **RECOMMENDATION.** Method-first label: «طريقة الإدخال: قراءة مباشرة (بيانات تجريبية)»; sources (Sanad, Eefaa, Mumtathil) remain the only «source» chips. |
| Required data / formula | none. |
| Priority | **P3** — one label. |
| Dependencies | none. |
| Acceptance | no screen shows a tool name as a data source (scan of `ingestion/reports.js` labels); AR/EN. |
| Screens | `50-enforcement-home-ar.jpg` |
| Placement | The chip at the top of the page, right of «آخر قراءة». |
| Needs wireframe | no |
| Visuals | AR: [SH-A15-enforcement-ingestion-label-ar](annotated/SH-A15-enforcement-ingestion-label-ar.jpg); [detail 1](annotated/SH-A15-detail-1.jpg) |

## SH-A16 — Chart-selection rules: no Pareto on ordered buckets, no share types without a whole (P2)

| Field | Content |
|---|---|
| Requirements / gap | R5 (chart library) · GAP-C-1, GAP-C-2, GAP-C-3 (+ a low item) |
| Existing coverage | Picker, 24 types, support matrix (13 implemented · 9 data-dependent · 2 unavailable-in-demo), proofs, exports — **Fully covered as functionality** (`docs/chart-library.md` §6; 08 §3). |
| Current behaviour | **VERIFIED (08 §3.2).** (a) `paretoGate` (`chartConfig.js:216–220`) has no ordered-axis check although `p.ordered` is computed (`:122–125`): Pareto is offered on the aging charts and **re-orders the age buckets** (Over 180 → 31–90 → …) with a cumulative-share caption; «80 % reached by N buckets» has no meaning on ordered buckets. (b) NC «Overdue by Amanah (top 10)» has no `dim.whole`: donut/pareto/pie/treemap are offered and their shares are of the **top-10 subtotal**, not of total overdue. (c) The matrix row for `stacked_area` quotes the first block's reason (`scripts/chart-support-matrix.mjs:89`); the true statement is «no real chart is ordered + additive + multi-series»; the test asserts only the bullet text. (d) The picker badge «موصى به» (`ChartPicker.jsx:30,151`, `ChartCustomize.jsx:50`) reads as advice on a finance page; it is a chart-type rule (`chartCatalog.js:115–131`). |
| Gap / why a change | (a) and (b) can mislead on the SH's aging/concentration views; (c) is a documentation/test accuracy issue; (d) a wording risk. **Not proposed:** building a monthly collected+uncollected stacked-area chart (an inferred possibility, not requested). |
| Proposed refinement | **RECOMMENDATION.** (a) Refuse `pareto` when the axis is ordered (reason AR/EN). (b) Give the NC top-10 builder a `whole` (total overdue) so share types fold the rest into «أخرى (بقية الإجمالي)» as the invoice summaries already do, or hide share types for that chart. (c) Per-block reasons in the matrix script and a test asserting them; regenerate §6 of `docs/chart-library.md` with the script (never by hand). (d) «نوع الرسم الموصى به / Recommended chart type». |
| Required data / formula | for (b): `whole` = total overdue of the scope (existing figure). |
| Priority | **P2** for (a)(b); **P3** for (c)(d). |
| Dependencies | SH-A02 (the new aging buckets are the ordered axis); the chart library tree was still being edited by another agent — **verify the lines before editing**. |
| Acceptance | `evaluateChart(aging,'pareto').ok === false` with a reason in both languages; matrix lists Pareto's pages without any aging chart; NC top-10 chart offers no share type without a whole (or a folded Other that makes the donut total equal total overdue); the matrix script prints per-block reasons and `test:chartint` asserts them; picker string present AR/EN; `chart-integration` 29/29 still pass. |
| Screens | `121-dashboard-aging-chart-picker-open-v2-ar.jpg` (picker header/badge and the composition group; the «باريتو» card is below the visible part of the dialog), `134-analysis-tab-reasons-concentration-ar-v2.jpg`, `133-analysis-waterfall-picker-options-ar-v2.jpg` (the disabled-type reason format) |
| Placement | Picker dialog type list (disabled types with reason); badge in the picker header. |
| Needs wireframe | no |
| Visuals | picker: [SH-A16-chart-picker-rules-ar](annotated/SH-A16-chart-picker-rules-ar.jpg); reason format: [SH-A16-chart-picker-reason-format-ar](annotated/SH-A16-chart-picker-reason-format-ar.jpg) |
| Extended by R4 | **SH-A35:** the overdue report's aging chart is an ordered axis (no Pareto) and its ranked-bar charts carry `dim.whole` = overdue total, which satisfies (b) for the new charts. | |

## SH-A17 — Export: warn when a picture falls back to the placeholder PNG (P3)

| Field | Content |
|---|---|
| Requirements / gap | R5, R7 (examples are PowerPoint reports) · GAP-C-4 |
| Existing coverage | Browser export rasterises every picture (`pptxTemplate.js:132–142`, `exportReportModel.js:150–153`); LibreOffice renders the SVG even from a 70-byte placeholder (08 §4.2). |
| Current behaviour | **VERIFIED.** When `rasterizeSvg` returns `null` (no `document`/`Image`, load failure, null blob, exception) `assembleDeck` writes `PLACEHOLDER_PNG` (`:239–240`) and records `real:false` in `picJobs` — **the flag is never read**; no warning; no test exercises the browser failure. Any deck from the offline scripts (`make-report-deck.mjs`, `make-nc-report.mjs`, `export-parity.mjs`) carries placeholders for picture slides. PowerPoint/Keynote/Slides behaviour is **UNVERIFIED** (`docs/chart-library.md` expectation only). |
| Gap / why a change | A silent fallback can ship a deck whose picture slides show a stretched 1×1 image in a viewer that ignores the SVG. |
| Proposed refinement | **RECOMMENDATION.** Surface `picJobs[].real === false`: `buildTemplatePptx` returns (or calls `onWarning` with) the count of placeholder pictures; `ExportDialog` shows one line «الصور البديلة غير متاحة في هذا المتصفح» in the chart block. |
| Required data / formula | none. |
| Priority | **P3** — rare path; honest limitation. |
| Dependencies | A human check in PowerPoint remains **PENDING** (SH-A34). |
| Acceptance | Node test: `buildTemplatePptx(model, tpl, { rasterize: async () => null })` reports N>0 placeholders; with a valid PNG reports 0 and the media PNG is larger than 1×1; dialog line AR/EN; no change to the export parity numbers. |
| Screens | `173-smart-export-dialog-chart-block-ar-v2.jpg`, `174-smart-export-dialog-chart-block-expanded-ar-v2.jpg`, `80-dashboard-export-dialog-ar.jpg` |
| Placement | Inside the block «كيف ستظهر الرسوم في الملف», below the per-chart list. |
| Needs wireframe | no |
| Visuals | AR: [SH-A17-export-placeholder-warning-ar](annotated/SH-A17-export-placeholder-warning-ar.jpg); [detail 1](annotated/SH-A17-detail-1.jpg) |

## SH-A18 — Retired terms accepted as input only (P2)

| Field | Content |
|---|---|
| Requirements / gap | R5 · GAP-C-5 |
| Existing coverage | The terminology test forbids the retired stem «مقبوض» anywhere in `src`/`server` (`tests/platform.test.mjs:1588–1592`); labels use «الإيرادات المحصلة / المبلغ المحصّل». |
| Current behaviour | **VERIFIED (08 §6.1).** «اعرض المقبوض كحلقي» → `ask` («أي رسم تقصد؟»); «تقرير المقبوضات الشهرية» → `clarify`; «قارن المقبوضات حسب الامانة» → the unknown word is **silently ignored** (a report is produced). Users trained on the old reports will keep typing the retired word. |
| Gap / why a change | An input-recognition failure is avoidable without ever displaying the word. |
| Proposed refinement | **RECOMMENDATION.** One module `src/data/legacyTerms.js` (input aliases only, header «never displayed»), `foldLegacy()` in `textNorm.js` before intent matching so every interpreter shares it; the chart measure list reads the canonical word. Test change: keep the global scan, allow-list exactly that one path (asserted as the only hit), add a **response-side** test that no label, title, answer or export text contains the stem in AR/EN. |
| Required data / formula | none; mapping to the approved term is a business decision (Q3 in 05). |
| Priority | **P2** — protects usability for Shared Services staff; low risk. |
| Dependencies | Decision Q3 (which approved term the alias maps to). |
| Acceptance | per 08 §6.4: the alias request yields the same report/chart spec as the approved-term request; generated titles show the approved term; the scan finds the stem in exactly one file; response-side test passes; full suite passes. |
| Screens | `171-smart-chat-request-show-as-columns-ar-v2.jpg` (chat chart request) |
| Placement | Chat input handling (no visual change). |
| Needs wireframe | no |
| Visuals | none — no visual change (see `04-screenshot-index.md` §1). |

## SH-A19 — Dashboard gross card: link text says «invoices and evidence» but opens the collected list (P3)

| Field | Content |
|---|---|
| Requirements / gap | R2, R5 |
| Existing coverage | Gross tile with a drill link (`InsightsDashboard.jsx:68`, `RevenueUI.jsx:91`). |
| Current behaviour | **VERIFIED.** The link «التفاصيل: الفواتير والأدلة» of the **gross billed** tile opens `/invoices`, which is the **collected (paid)** list (`'all'` collection filter = paid, `pageFilters.js:94–95`); there is no billed-invoices list (screenshot `02-drill-gross-detail-link-ar.jpg`). |
| Gap / why a change | A drill whose destination does not equal the figure it hangs from. |
| Proposed refinement | **RECOMMENDATION.** Smallest: remove the link from the gross tile, or rename it «عرض قائمة الفواتير المحصّلة» (not «evidence of gross»). A «billed invoices» list would be a new page — **not proposed**. |
| Required data / formula | none. |
| Priority | **P3**. |
| Dependencies | none. |
| Acceptance | link text accurate or absent on the gross tile; the other tiles unchanged; AR/EN. |
| Screens | `02-drill-gross-detail-link-ar.jpg`, `01-insights-dashboard-top-ar-v2.jpg` |
| Placement | Gross tile footer line («التفاصيل: الفواتير والأدلة ←»). |
| Needs wireframe | no |
| Visuals | link: [SH-A19-gross-card-link-ar](annotated/SH-A19-gross-card-link-ar.jpg); destination: [SH-A19-gross-card-link-destination-ar](annotated/SH-A19-gross-card-link-destination-ar.jpg) |

---

# PART B — changes requiring additional data or methodology

## SH-A20 — One forecast method per scope, aligned with the strategy/finance work (P1, blocked)

| Field | Content |
|---|---|
| Requirements / gap | R3, R6 · GAP-R3-4 (method part) |
| Existing coverage | `/planning` run-rate (`planForecast.js:24`); Smart Reports/chat trend `ols_trend_v1` (`revenueOutlook.js`, band ±1.28 residual SD labelled «not a validated confidence interval»). |
| Current behaviour | **VERIFIED (01 §B2, `probeB`).** Same scope, two year-end numbers: run-rate 10.95 bn vs trend 9.96 bn (range 9.54–10.37 bn); the trend's own back-test error ≈ 142 % (n = 6) on synthetic history; no methodology of Dr. Muath / Abdulmajeed / the strategy team was found anywhere (00 §3) — **PENDING**. |
| Gap / why a change | SH 6: consistent sources, assumptions, forecasts for senior stakeholders. Cannot be satisfied by development alone. |
| Proposed refinement | **RECOMMENDATION (after Part C inputs).** (1) Decide the single method per screen/scope; (2) the other becomes a labelled «alternative view» or is retired; (3) method id + version on both and in exports; (4) show back-test vs the agreed non-AI baseline by horizon **only if** thresholds exist. Interim wording is SH-A06. |
| Required data / formula | The 11 inputs in `00 §3`: models in use and the non-AI baseline; inputs/grain/source (Tahseel authoritative for collection); assumptions; drivers; reporting date/calendar; horizons; history coverage; scenario definitions; version; approved targets; acceptance thresholds (HLSD AC-10). |
| Priority | **P1** — the single most important SH 6 item; blocked. |
| Dependencies | SH-A26, SH-A27 (no evidence of completion), SH-A08, SH-A22. |
| Acceptance | same scope + date → same year-end figure on `/planning`, Smart Reports, chat and exports to the SAR, or a labelled two-method comparison; method id/version in model and exports; no «confidence interval» wording; no accuracy claim without the approved threshold test. |
| Screens | `23-planning-forecast-vs-target-ar.jpg` (no forecast section is visible in `61`/`61b`) |
| Placement | Method line of the SH-A06 panel on Planning; the forecast section of the Smart Reports document (textual change, not visible in any original screenshot). |
| Needs wireframe | no |
| Visuals | AR: [SH-A20-one-forecast-method-line-ar](annotated/SH-A20-one-forecast-method-line-ar.jpg) |

## SH-A21 — Expected billing, recovery assumptions, seasonality, drivers, scenarios (P2, blocked)

| Field | Content |
|---|---|
| Requirements / gap | R3 · GAP-R3-5 |
| Existing coverage | Targets, run-rate estimate, ceiling (collected + standing + average billing × months left; disjoint populations — no double count, 08/01 §B3); `applyScenario` exists but is unused (`revenueOutlook.js:202`); scenarios were removed from Planning on purpose (`planning-cfo-review-plan.md §6`). |
| Current behaviour | **VERIFIED.** No expected-billing forecast, no recovery assumption by age, no seasonality (even or user-edited weights), no drivers, no scenarios (01 §B3). |
| Gap / why a change | SH 3 asks for assumptions and drivers; without supplied inputs any of these would be invented. |
| Proposed refinement | **RECOMMENDATION (only after inputs arrive).** Structure: expected collections = Σ standing balance by age bucket × approved recovery rate by bucket (SH-A02 buckets) + Σ future billing by month × approved collection-lag profile; seasonality from approved monthly weights; scenarios as base / conservative / improvement **with definitions and an approver**, shown as **scenarios, never as confidence intervals**. |
| Required data / formula | Inputs 3, 4, 8 of `00 §3` (assumptions, drivers, scenario definitions). Formula placeholders above are **PENDING** — no numbers until supplied. Existing + future populations must stay disjoint (standing issued ≤ cut-off; billing after). |
| Priority | **P2**, blocked. |
| Dependencies | SH-A26, SH-A27, SH-A02, SH-A20. |
| Acceptance | the identity «existing + future = expected» holds with no overlap (test as the ceiling identity); every scenario carries its definition, approver and status; the word «confidence» is absent; an unapproved scenario is not displayed. |
| Screens | `23-planning-forecast-vs-target-ar.jpg`, `25-planning-focus-and-reasons-ar.jpg` |
| Placement | New rows inside the SH-A06 panel; no new chart. |
| Needs wireframe | no |
| Visuals | AR: [SH-A21-assumption-rows-in-panel-ar](annotated/SH-A21-assumption-rows-in-panel-ar.jpg) |

## SH-A22 — Approved annual targets and their status (P2, blocked)

| Field | Content |
|---|---|
| Requirements / gap | R3, R5, R6 · D-3 |
| Existing coverage | Targets are demo inputs with `status:'demo'` (`revenueMetrics.js:645+`; `planTargets.js` defaults); SH #09 slide 14: integration with SIMH for approved targets while keeping manual inputs for simulations (00 §3). |
| Current behaviour | **VERIFIED.** The bullet chart is `unavailable-in-demo` precisely because no approved target exists (`docs/chart-library.md` §6; reason correct, 08 §3.2 #4). |
| Gap / why a change | Replacing demo targets requires an approved source. |
| Proposed refinement | **RECOMMENDATION.** Enter approved targets through the existing planning store with status, effective date and source; label switches demo → approved everywhere (SH-A08); keep manual simulation inputs separate and labelled. |
| Required data / formula | Approved annual targets (collection, coverage, billing) with status and effective date. |
| Priority | **P2**, blocked. |
| Dependencies | SH-A26/A27 (the Solution Owner / ByteDance SIMH integration, D-3), SH-A08. |
| Acceptance | status shown wherever a target appears; «approved» only when supplied; the bullet chart becomes available for approved scopes; the store records who set the value (`savedBy`); demo and approved never mixed in one comparison. |
| Screens | `20-planning-landing-ar.jpg` (targets panel header and the target tile; `22-planning-monthly-targets-ar.jpg` shows the Amanah table, not the header) |
| Placement | Targets panel header (status word) and the target tile, both in `20`. |
| Needs wireframe | no |
| Visuals | AR: [SH-A22-approved-targets-status-ar](annotated/SH-A22-approved-targets-status-ar.jpg) |

## SH-A23 — Debtor-level view: who owes most (P2, blocked)

| Field | Content |
|---|---|
| Requirements / gap | R2 · GAP-R2-1(b), R2.4 (Missing) |
| Existing coverage | Search by payer; Sanad order page «same debtor's other invoices» (`orderMatch.js:77`); NC concentration views by Amanah and by source. |
| Current behaviour | **VERIFIED.** No grouping by payer in the snapshot or any list (01 §A2). Payer-id uniqueness is **unconfirmed** (`docs/invoice-composite-key.md`; D-10). |
| Gap / why a change | «Who owes the most» cannot be answered; but a key invented now would merge different debtors. |
| Proposed refinement | **RECOMMENDATION (after D-10 is confirmed).** A fifth concentration card «حسب المدين» (after the municipality card; the tab has four cards today) **inside the NC «reasons & concentration» tab**, next to the Amanah and source views, reusing its component, drill and picker. Group only by a verified payer id (type + number), show it masked, keep invoices without id in one «معرّف المدين ناقص» row, never merge by name. |
| Required data / formula | Σ net uncollected by payer key; grain invoice → payer; date basis cut-off; population = the NC page's (period cohort; the standing balance stays on its own labelled line); missing id → separate row. |
| Priority | **P2**, blocked. |
| Dependencies | SH-A33 (payer-id uniqueness), SH-A03 (labels), access control (visible rows only). |
| Acceptance | Σ rows = NC net unpaid; each row drills to the list filtered by payer id with the same total; no name-based merge; masked ids; restricted users see only their visible invoices; export parity. |
| Screens | `134-analysis-tab-reasons-concentration-ar-v2.jpg` |
| Placement | A fifth card of the concentration tab, after the municipality card (the tab has four cards today: source, aging, Amanah, municipality), below the fold of `134-analysis-tab-reasons-concentration-ar-v2.jpg`. |
| Needs wireframe | **yes** (a third view in an existing tab). |
| Visuals | AR: [SH-A23-debtor-concentration-view-ar](annotated/SH-A23-debtor-concentration-view-ar.jpg); [SH-A23-wireframe-ar](wireframes/SH-A23-wireframe-ar.jpg); [SH-A23-current-vs-proposed](wireframes/SH-A23-current-vs-proposed.jpg) |

## SH-A24 — Collection probability, delayed-payment risk, recoverability: prerequisites only — do not build (P3)

| Field | Content |
|---|---|
| Requirements / gap | R4 · GAP-R4-2 |
| Existing coverage | Explainable High/Medium/Low priority; delay = days past due; «No recoverability is assessed» statements (`NcOverview.jsx:101`, `ncReportModel.js:16,49`). |
| Current behaviour | **VERIFIED.** No per-invoice probability, delay-risk or recoverability exists, and none can be validated: no labelled outcomes, no payer history, no follow-up records; the synthetic data cannot validate a model (00 D-8; 01 §C). The official decks promise a per-invoice probability (SH #09 slide 9; intro deck slide 3) — see SH-A30. |
| Gap / why a change | Registered as a **decision record**: no development until prerequisites exist. A priority is a follow-up order, never a probability. |
| Proposed refinement | **No development now.** Keep the «not available» statements (SH-A11). Prerequisites: labelled outcomes at invoice level (on time / late / never, with dates), payment history by payer, follow-up records, an agreed non-AI baseline, calibration/Brier and monetary error by horizon per HLSD AC-10, a named owner who approves. |
| Required data / formula | none until the above exist. |
| Priority | **P3** (record). |
| Dependencies | SH-A33. |
| Acceptance (future) | no probability is displayed unless calibrated against the agreed baseline, version-stamped and approved; priority is never shown as probability. |
| Screens | `15-uncollected-priority-badge-popover-ar.jpg`, `64-chat-probability-question-ar.jpg` |
| Placement | n/a (statement stays in the priority explanation, SH-A11). |
| Needs wireframe | no |
| Visuals | none — no development (decision record); see `04-screenshot-index.md` §1. |

## SH-A25 — Contract installments ↔ invoice link (P3, blocked)

| Field | Content |
|---|---|
| Requirements / gap | R2 · GAP-R2-5 |
| Existing coverage | Contract pages read the local Databank-schema subset and label unavailable fields «غير متاح في البيانات الحالية» (screenshots 40–43, blurred); Decision Room keeps installments without an invoice in their own categories. |
| Current behaviour | **VERIFIED.** The Decision Room contract items read **generated** schedules (`useDecisions.js:41,52`) while the contract pages read the Databank subset (`server/furasData.js`): two populations; the exports carry no payment-to-invoice key. |
| Gap / why a change | Cannot show verified links until the key exists. |
| Proposed refinement | **RECOMMENDATION.** Keep the «not available» statements; when the Databank exports a payment→invoice key, link and align the Decision Room items with the same population. |
| Required data / formula | Databank payment→invoice key. |
| Priority | **P3**, blocked. |
| Dependencies | SH-A33; contract access scoping is a verification item (§D). |
| Acceptance | installments linked only through the supplied key; unlinked ones stay separate and are never added to receivables; one population on both surfaces. |
| Screens | `42-contract-payments-installments-blurred-ar.jpg`, `43-contract-invoices-refs-blurred-ar.jpg` |
| Placement | Installments table: a column «الفاتورة» is **added** (the table has only «تاريخ الفاتورة» today), next to it. |
| Needs wireframe | no |
| Visuals | AR: [SH-A25-installment-invoice-link-column-ar](annotated/SH-A25-installment-invoice-link-column-ar.jpg) |

---

# PART C — business and coordination actions (outside development)

Original agreed deadline for the five actions: **2 November 2026 — retained.** «Evidence» means a file, message, minute or deliverable found locally. **No completion is assumed and no revised date is invented.**

| ID | Action | Owner (as agreed) | Deadline | Evidence status (VERIFIED against `02 §C`, `00 §4`) | Reqs | Unblocks |
|---|---|---|---|---|---|---|
| **SH-A26** | Coordinate the forecasting review with Dr. Muath, Abdulmajeed and the relevant teams | Solution Owner | 2 Nov 2026 | **no evidence found** (no invitation, minute, deck or note in `~/Downloads`, `~/Desktop`, repo) | R3 R6 | SH-A20, A21 |
| **SH-A27** | Share models, inputs, assumptions, drivers (the 11-item list in `00 §3`) | ByteDance | 2 Nov 2026 | **no evidence found** (HLSD V0.6 defines how a forecast must be validated; no model, input or driver specification; WF-02 in Sprint scope only) | R3 R6 | SH-A20, A21, A22 |
| **SH-A28** | Provide representative reports, dashboards and documents with dummy data | Shared Services + AI Champion | 2 Nov 2026 | **no evidence found** (nothing dated after 27 Oct; the monthly reports are earlier and real; `Data Sources Tracker SS` is a data-source tracker) | R7 | R7 comparison; SH-A17 (real decks) |
| **SH-A29** | Coordinate a dedicated UI/UX and demo review (with the DGA guidance, Figma kit, MOMAH web guideline and Hugeicons licence as inputs) | OT | 2 Nov 2026 | **no evidence found** (an OT review of the Alpha HLSD dated 25 Oct exists; not a UI/UX demo review; the kit is not local — `docs/design-dependencies.md`) | R5 | conformance statement (GAP-R5-2) — **Unverifiable** until then |
| **SH-A30** | Update (a) the opening slides and (b) the demo | ByteDance | 2 Nov 2026 | (a) slides: **no evidence found** (newest opening material is the 27 Oct PDF; no editable #09 PPTX; the 13 Oct intro still says «15+ sources»). (b) demo: **in progress — completion not evidenced** (commits to 3 Nov; many uncommitted changes through 6 Nov incl. Decision Room redesign, municipality hierarchy, chart library, collection-rate card) | R1 | R1; content = `06-opening-slide-storyline.md` (GAP-R1-1/2/3 and the removal of the «probability of every invoice» claim) |
| SH-A31 | Confirm the grace-period rule (the monthly reports use cumulative 5/10/15/35 days; the demo default is 0, «unresolved», EQ2) | Solution Owner / business | none agreed — **no evidence found** | open (D-9) | R2 | values of SH-A02, A01, A06 |
| SH-A32 | Supply verified real baseline figures and owner-approved targets for the five proposed measures (overdue exposure, collection rate, time to identify priority cases, follow-up completion, forecast error) | data owners / Solution Owner | none agreed — **no evidence found** | open (06 §6) | R1 | replaces the synthetic baseline on the slides |
| SH-A33 | Data-owner confirmations: payer-id uniqueness (D-10); Databank payment→invoice key; labelled collection outcomes and payer history (D-8); the 30.6 m Investment difference (O3) | data owners / ByteDance | none agreed — **no evidence found** | open | R2 R4 | SH-A23, A24, A25, A14 |
| SH-A34 | Human check of an exported deck in Microsoft PowerPoint (365 and 2013), Keynote and Google Slides (a browser-exported and a script-exported deck with a treemap and a sankey) and of Word's rendering | OT / QA owner (**not agreed — PENDING assignment**) | none | **UNVERIFIED** — never observed by any agent | R5 R7 | closes `08 §7d` items 1–4 |

Also for the business (not development): correct the Handbook M-14/M-15 text (numeric priority score) and decide whether the 13 Oct intro deck is retired (`06 §6`).

---

# ADDENDUM R4 — overdue-invoice reports (new actions SH-A35…SH-A40; review only, nothing implemented)

Agent R4 · 2026-11-06 · full evidence, numbers and the 50-phrasing interpreter table: `09-overdue-reports-review.md`. Part = A (supported by current data). These six actions are **one coherent delivery**: A35 is the report, A36–A40 remove the defects on its path; they share the numbers below. Sequence and decisions Q13–Q18: `05`. Extends (does not duplicate): **SH-A02** (six buckets, undated invoices), **SH-A03** (debtor in list and CSV), **SH-A04** (Collection URL contract), **SH-A16** (no Pareto on ordered buckets), **SH-A18** (alias module), **SH-A10** (dictionary wording). Shared acceptance numbers (synthetic baseline, cut-off 2026-11-06): national standing overdue **138 invoices / 7,743,038,344 SAR**; 2026 cohort **73 / 3,309,903,873**; Riyadh-only cohort **4 / 58,091,018**; Jeddah cohort **29 / 819,133,660**; excluded overdue (separate) standing 134 / 6,895,603,970; not yet due 19 / 579,631,380; five proposed overdue buckets 412,512,974 · 322,022,040 · 824,013,446 · 2,431,218,972 · 3,753,270,912.

## SH-A35 — One «overdue invoices» report with a dimension parameter and four entry points (P1)

| Field | Content |
|---|---|
| Requirements / gap | R2 (who owes, how much is late), R4 (long-outstanding), R5 · new user requirement (4 reports) |
| Existing coverage | NC analysis (page + report section) already computes the overdue population, aging, overdue by Amanah / municipality / source, heat map and reconciliation (`server/noncollection.js`, `ncReportModel.js`); Smart Reports `aging`, `amanah`, `sources` sections; list due-position facet — **VERIFIED (09 §2)**. |
| Current behaviour | **VERIFIED.** «تقرير عام عن الفواتير المتأخرة» / «…حسب الأمانة / البلدية / مصدر الإيراد» and the English equivalents return the generic «تقرير الإيرادات والتحصيل» built from the class filter: KPI «المحصّل 0 · نسبة التحصيل 0.0 %», collection-performance tables, a 0.0 % heat map (screenshots 190–197, 200). English «by municipality» yields only an executive summary (`reportIntents.js:64`); no municipality section word exists. A zero-overdue scope says «البيانات غير متاحة وليست صفراً» (213). The starter chip «حلّل المتأخرات حسب مصدر الإيراد» opens the generic report (210). |
| Evidence | `reportIntents.js:51,64,124,394,418` · `reportModel.js:27,217,315` · `ncReportModel.js:78–96,178–192` · `SmartReports.jsx:332–341` (generate) · 09 §1, §3 · screenshots 190–197, 200, 210, 213 |
| Gap / why a change | The four reports are requested by name; the data and the calculation exist in the NC engine but are reachable only with the phrase «أسباب عدم التحصيل». **Not** four implementations. |
| Proposed refinement | **RECOMMENDATION.** (1) New section key `overdue` (+ `spec.overdueBy ∈ {all, amanah, municipality, source}`) in `SECTION_ORDER`/`SECTION_META`; its builder reuses `ncSections` pieces (KPI, aging bar, ranked bars, tables, appendix) over `nonCollectionAnalysis` run on an all-issue-periods scope unless the user states an issue window (SH-A37). (2) Municipality table added (the NC report has the chart only), explicit groups kept as rows. (3) Title follows the dimension; KPI strip = overdue count · overdue remaining · share of net unpaid · longest overdue · separate dashed tiles (not yet due, excluded overdue, due date unavailable if > 0); **no collected amount / rate**. (4) Four starter chips + the same four as follow-up chips; the old chip «حلّل المتأخرات حسب مصدر الإيراد» becomes entry 4. (5) Zero-overdue state: «لا توجد فواتير متأخرة في هذا الاختيار» plus the not-yet-due figure. (6) Specification per report, metric definitions and acceptance criteria: `09 §6`. |
| Required data / formula | Business definition: invoice with remaining collectible balance > 0 after approved exclusions and a due date earlier than the reporting date (+ grace). Formula `Σ max(0, billed − received)`; source fields as `derive()`; grain invoice; date basis = reporting date (data cut-off); filters scope ∩ access (+ optional issue / due windows); missing due date → «due date unavailable» (never overdue); unspecified municipality / source → explicit groups. No new calculation. |
| Priority | **P1** — the SH asked for these reports by name and the present answer is a 0.0 % collection report. |
| Dependencies | SH-A36 (definition), SH-A02 (buckets; may ship with the five existing buckets first), SH-A37 (population/dates), SH-A38/A39/A40; shared chart defaults SH-A16 (a). Coordinate with the chart-library and access-control files (`reportModel.js`, `SmartReports.jsx`). |
| Acceptance | `09 §6` criteria (1)–(9); in addition: each of the four titles in Arabic and English builds the report (no class filter in the context chips); KPI = Σ chart = Σ table = list «متأخر» = CSV count; restricted Riyadh user: 4 / 58,091,018 (cohort) with only Riyadh rows; `buildReportModel` unit test for the four `overdueBy` values on the compact world with the §4 numbers; export parity (`npm run verify:exports`) holds. |
| Screens | `60-smart-reports-landing-ar.jpg`, `191-overdue-by-amanah-top-ar.jpg`, `190b-overdue-general-report-full-ar.jpg`, `210-starter-chip-overdue-by-source-top-ar.jpg`, `213-overdue-zero-state-alahsa-ar.jpg` |
| Placement | Landing: second row of starter chips; result: title, KPI strip, reporting-date line, dimension chart + aging bar, dimension table, appendix, export. |
| Needs wireframe | **yes** — done: `wireframes/SH-A35-wireframe-ar.jpg`, `wireframes/SH-A35-current-vs-proposed.jpg` |
| Visuals | [entry points](annotated/SH-A35-overdue-entry-points-ar.jpg) · [title + KPI](annotated/SH-A35-overdue-report-header-and-kpis-ar.jpg) · [wireframe](wireframes/SH-A35-wireframe-ar.jpg) · [current-vs-proposed](wireframes/SH-A35-current-vs-proposed.jpg) |

## SH-A36 — «Overdue» is a due position, not a collection class (P1)

| Field | Content |
|---|---|
| Requirements / gap | R2, R4 · definition |
| Existing coverage | The list already has a separate due-position dimension (`filters.dueState`, `lists.js:126–128`) and the NC population `due:'overdue'`; the scope panel offers the class list (202). |
| Current behaviour | **VERIFIED.** The interpreter and the scope panel write `scope.status='overdue'` = collection class `overdue` (`engine.js:282–287`; class order objection > linkage > ineligible > partial > overdue, `engine.js:234–247`), so overdue invoices that are partly paid, unlinked or with a missing debtor id are dropped: cohort −15 invoices / −369.41 m (58 / 2,940,491,690 vs 73 / 3,309,903,873); standing −29 / −707.30 m (109 / 7,035,740,770 vs 138 / 7,743,038,344); Riyadh cohort 2 / 13,475,880 vs 4 / 58,091,018. The class filter also restricts the whole snapshot, hence collected = 0. |
| Evidence | `engine.js:234–247,282–287` · `reportIntents.js:124,394–407` · `scratch/r4/classes.mjs`, `recon.mjs` · screenshots 191, 202 |
| Gap / why a change | An overdue report must follow the business definition (due date + remaining), including partly paid invoices at their remaining amount. |
| Proposed refinement | **RECOMMENDATION.** (1) Add `scope.due ∈ {all, overdue, not_due, unknown}` to the Smart Reports spec/scope panel («موقف الاستحقاق»), evaluated like `dueClassOf` across all classes; overdue phrasings set it, never `status`. (2) Keep the class list unchanged but relabel its «متأخرة» (wording Q17) and say what it excludes in the metrics dictionary (SH-A10). (3) The report context line reads «موقف الاستحقاق: متأخر». |
| Required data / formula | `due='overdue'` ⇔ `remaining>0 ∧ due present ∧ days>0`; fields as `derive()`. No new calculation (the list already implements it). |
| Priority | **P1** — silently understates overdue by 9–11 % nationally and 56–77 % for a small scope. |
| Dependencies | Q17 (label); SH-A35 consumes it; touches `server/engine.js` scope resolution (**coordinate** with access control) — alternatively pass the list's `dueState` through the report generation. |
| Acceptance | For national, Jeddah and Riyadh scopes the overdue count/amount of the report = NC `populations.overdue` = list `state=open,dueState=overdue` (73 / 3,309,903,873; 29 / 819,133,660; 4 / 58,091,018); a partly paid overdue invoice appears with its remaining amount; the class filter «متأخرة» still returns the 58 / 109 populations; no overdue phrasing writes `scope.status`. |
| Screens | `202-smart-reports-scope-edit-panel-ar.jpg`, `191-overdue-by-amanah-top-ar.jpg` |
| Placement | Scope panel: new «موقف الاستحقاق» field in the free action row; the «حالة الفاتورة» option relabelled; the «فهمتُ الطلب» chip. |
| Needs wireframe | no |
| Visuals | [SH-A36-overdue-status-and-due-position-ar](annotated/SH-A36-overdue-status-and-due-position-ar.jpg) |

## SH-A37 — Reporting date, issue-date vs due-date filters, default population, grace (P1)

| Field | Content |
|---|---|
| Requirements / gap | R2, R4 · definition |
| Existing coverage | Data date shown («بيانات حتى», «التحصيل حتى»), the period control is labelled «الفترة · تاريخ الإصدار» (202), grace parameter `cfg.graceDays` (`lateness.js:12`), carry-over of overdue issued before the period quantified by SH-A01. |
| Current behaviour | **VERIFIED.** The default period is the 2026 *issue* window, so the overdue report covers 73 / 3.31 bn and hides **65 invoices / 4,433,134,471 SAR** (138 / 7.74 bn standing); no due-date filter exists (no `dueFrom/dueTo` in `server/` or `src/`), so «استحقت قبل 30 يونيو» is read as the issue period 30 Jun→30 Jun (row 47) or June (row 48); the reporting date is shown only as «data to / collections up to»; grace is not stated (value 0 changes to 7.49 bn / 7.33 bn at 10 / 30 days). |
| Evidence | `SmartReports.jsx:332–339` · `contextChips` `reportModel.js:48–70` · `lateness.js:12` · `scratch/r4/recon.mjs` (`grace`), `allper.mjs` · screenshots 191, 202 |
| Gap / why a change | The ask is explicit: show the reporting date and distinguish the due-date filter from the issue-date filter. |
| Proposed refinement | **RECOMMENDATION.** (1) Fixed line under the title: reporting date (days are measured from it) · issue window (default «كل الفترات» for overdue reports) · due-date window (default empty) · grace days. (2) Optional «تاريخ الاستحقاق (من – إلى)» in the scope panel, carried into the spec, NC, list (`filters.dueFrom/dueTo`) and the export context. (3) Overdue reports default to all issue periods; the existing issue-date control stays and is named. (4) Decisions Q14, Q15, Q16. |
| Required data / formula | `dueFrom ≤ due ≤ dueTo` on the existing `st.due` column; reporting date = data cut-off (no time travel); grace from `cfg.graceDays`. |
| Priority | **P1** (default population) · **P2** (due-date filter). |
| Dependencies | Q14–Q16; SH-A31 / Q5 for the grace value; server `lists.js`/`noncollection.js` (coordinate with access control). |
| Acceptance | The strip shows the four values in AR and EN and in every export; default overdue report = 138 / 7,743,038,344; with an issue window 2026-01-01→cut-off = 73 / 3,309,903,873; a due window «before 2026-06-30» returns exactly the list rows with `due < 2026-06-30` (list and report equal); «استحقت قبل 30 يونيو» sets the due window, not the period; with `graceDays=10` the strip says so and the amounts equal 7,493,432,831. |
| Screens | `191-overdue-by-amanah-top-ar.jpg`, `202-smart-reports-scope-edit-panel-ar.jpg` |
| Placement | Under the report title; scope panel next to «الفترة · تاريخ الإصدار». |
| Needs wireframe | no (shown in the SH-A35 wireframe, item ①) |
| Visuals | [reporting-date line](annotated/SH-A37-reporting-date-and-issue-vs-due-ar.jpg) · [due-date range](annotated/SH-A37-due-date-range-filter-ar.jpg) |

## SH-A38 — Overdue invoice details: debtor, municipality, revenue source, due date, no 1970 dates, full export (P1)

| Field | Content |
|---|---|
| Requirements / gap | R2 (who owes it) |
| Existing coverage | Row object carries `payerAr/En`, municipality, source, `dueDate`, `daysOverdue`, remaining (`lists.js:82–85`); the NC screen table shows the debtor (`NcInvoices.jsx:67–76`); the NC appendix lists 50 invoices; list CSV streams all filtered rows. |
| Current behaviour | **VERIFIED.** NC appendix columns: invoice · Amanah · «مصدر الإيراد» · due date · days · unpaid · position · reason · group — **no debtor, no municipality**, and the «مصدر الإيراد» cell prints the **product** (`ncReportModel.js:249` reads `productAr`; «ممتثل» instead of «الغرامات والجزاءات», screenshot 211); it also lists not-yet-due invoices. The NC screen table has no due-date and no source column (204). `EXPORT_COLUMNS` (`lists.js:389`) has no payer and no reporting date. With a blank due date the row shows `1970-01-01` and 20,762 days, in the CSV too (fixture, `undated.mjs`). Appendix capped at `NC_APPENDIX_ROWS = 50`. |
| Evidence | `ncReportModel.js:28,248–249` · `NcInvoices.jsx:67–76` · `lists.js:82–85,389–402` · screenshots 204, 211, 209 |
| Gap / why a change | The requested invoice details are all in the row object, but the report appendix, the screen table and the CSV each omit different ones. |
| Proposed refinement | **RECOMMENDATION.** (1) Overdue appendix columns: invoice · debtor · Amanah · municipality · revenue source (fix the product/source mix-up) · due date · days overdue · remaining; overdue only; «top 50 of N» + link to the full list. (2) NC screen table: add due date and source. (3) CSV/XLSX: add `payer_name`, `payer_id_type`, `payer_id_masked` (shared with SH-A03) and a header block with reporting date and filters; undated rows blank, never 1970 / 20,762 (also SH-A02 acceptance). (4) All rows in CSV/XLSX for 1000+ invoices (streamed). |
| Required data / formula | Not a metric; fields as listed; missing payer → «غير محدد» + «معرّف المدين ناقص»; full IDs never shown. |
| Priority | **P1** (debtor, product/source label) · **P2** (rest). |
| Dependencies | **SH-A03** (debtor label pair Q4, CSV permission from access control); SH-A02 (undated rows); SH-A35 (appendix lives in the overdue section). |
| Acceptance | Appendix total of the listed rows ≤ overdue remaining and the note states «N of total»; the source column equals the list's source for sampled rows; debtor equals the invoice page; undated fixture prints «—»; CSV row count = list count for the same filter and includes the reporting-date header; restricted user's file contains only authorised rows. |
| Screens | `211-nc-smart-report-appendix-supporting-invoices-ar.jpg`, `204-nc-analysis-after-amanah-bar-click-ar.jpg`, `209-uncollected-overdue-list-expanded-row-ar.jpg` |
| Placement | Appendix table; NC «الفواتير الداعمة» table header; CSV header. |
| Needs wireframe | no (SH-A35 wireframe item ⑤) |
| Visuals | [appendix columns](annotated/SH-A38-invoice-appendix-columns-ar.jpg) · [NC table](annotated/SH-A38-invoices-table-due-date-and-source-ar.jpg) |

## SH-A39 — Overdue drill-through that carries the full filter set (P1)

| Field | Content |
|---|---|
| Requirements / gap | R2, R4 · found by R4 |
| Existing coverage | NC page drills carry `nc:{due:'overdue'}` + scope patch and show «يطابق الرقم المعروض» (204); Smart Reports tables link rows to `/collection` (`reportModel.js:200,214`). |
| Current behaviour | **VERIFIED.** `drill()` (`reportModel.js:86`) builds only `from,to,amanah,src,muni`; `Collection.jsx:49–54` reads only those (+ `category`). Jeddah: report row 23 invoices / 0.63 bn → landing 57 invoices (34 open + 23 excluded) → real overdue 29 / 819.13 m (screenshots 200, 201). The aging tables, the NC report tables and the appendix have no links (`links:false`; 1 link on the whole NC report). |
| Evidence | `reportModel.js:86,200,214,227` · `Collection.jsx:49–54` · `scratch/r4/chain.mjs` · screenshots 200, 201 |
| Gap / why a change | A click must open exactly what the row counts. |
| Proposed refinement | **RECOMMENDATION.** (1) Links of the overdue report carry `dueState=overdue`, the dimension value, the issue/due windows and `allPeriods` when no issue window is set; (2) extend the `Collection.jsx` URL contract (shared with **SH-A04**: `allPeriods`, age) and preselect the «متأخرة» segment; (3) a «جئت من التقرير» strip with the count that matches the row; (4) links on aging buckets and appendix invoice numbers; (5) the landing keeps «+N مستبعدة» visible so 29 open + 21 excluded is explained. |
| Required data / formula | none new. |
| Priority | **P1** — a trust break on the exact click the SH will make. |
| Dependencies | SH-A04 (URL contract), SH-A35, SH-A36 (due position). |
| Acceptance | For each row of each dimension the landing's overdue segment equals the row (Jeddah 29 / 819,133,660; Riyadh 4 / 58,091,018) and the appendix invoice opens the invoice page; links also work for a restricted user (only authorised rows); a test compares row figure vs landing for all 12 Amanahs, 7 sources and the municipality groups. |
| Screens | `200-overdue-by-amanah-report-row-link-ar.jpg`, `201-drill-from-overdue-report-landing-collection-ar.jpg`, `199-uncollected-list-due-overdue-segment-ar.jpg` |
| Placement | Table row links; landing strip above the title; due-bar segment. |
| Needs wireframe | no |
| Visuals | [row link](annotated/SH-A39-report-row-drill-link-ar.jpg) · [landing](annotated/SH-A39-collection-landing-after-drill-ar.jpg) |

## SH-A40 — Interpretation of overdue phrasing: never drop a qualifier (P1)

| Field | Content |
|---|---|
| Requirements / gap | R2, R5 |
| Existing coverage | The interpreter asks about unresolved Amanah / municipality / source when the sentence has a cue word, and refuses unauthorised scopes (access tests). |
| Current behaviour | **VERIFIED (09 §1, 50 phrasings).** (a) No overdue intent (see SH-A35). (b) Qualifiers silently dropped when no cue word: «حسب البلدية رابغ», «حسب أمانة غير موجودة», «حسب بلدية الخرج», «older than 180 days», «منذ سنة», English municipality names (rows 41, 43, 44, 49, 50, 7, 14, 32; screenshot 207) because `unknownTerms` only examines words after «تقرير / for / of / عن / في» (`reportIntents.js:106–108`). (c) Due-date phrases read as issue periods (47, 48). (d) Broken continue-options: «تقرير المتأخرات لأمانة أمانة الرياض», «الفواتير المتأخرة يوما», «…المتأخرة الاستحقاق»; «غير ممكن» for «المتأخرات حسب العمر» although an aging section exists (26). (e) Follow-up «by municipality» (EN) unsupported; «حسب البلدية» replaces the overdue section. (f) misspelling «invocies» → unsupported without a suggestion. |
| Evidence | `reportIntents.js:51,64,106–108,124,394,418` · `scratch/r4/interp.json`, `interp2.mjs` · screenshots 205–207 |
| Gap / why a change | The interpreter's own contract (header of `reportIntents.js`: nothing is dropped or widened) is broken for exactly the four titles requested. |
| Proposed refinement | **RECOMMENDATION.** Details in `09 §6 «Interpreter additions»`: `overdue` section + `overdueBy` phrases (AR/EN, singular/plural, misspellings tolerated as for status words), no write to `scope.status`; run the unknown-term guard on any sentence with an overdue term; due-date phrases → due window; thresholds → age filter or a correct clarification; fix the three option texts; follow-up dimension changes keep the overdue section. Synonyms live in the existing alias module (SH-A18) — no retired-terminology alias needed. |
| Required data / formula | none. |
| Priority | **P1** (silent drops) · **P2** (texts, follow-ups). |
| Dependencies | SH-A35 (section), SH-A37 (due window), SH-A18 (module). Test home: `tests/request-interpretation.test.mjs` (add the 50-row table of `09 §1`). |
| Acceptance | All 50 phrasings of `09 §1`: either the right report (title, `overdueBy`, no class filter) or one precise question with a correct option; none leaves a stated Amanah / municipality / source / threshold / due-date phrase unapplied and unmentioned; restricted user: unauthorised scope refused with a valid in-scope option; English follow-ups work. |
| Screens | `207-overdue-municipality-name-dropped-ar.jpg`, `205-overdue-count-question-ar.jpg`, `206-overdue-followup-by-municipality-en.jpg` |
| Placement | «فهمتُ الطلب» block of the assistant message. |
| Needs wireframe | no |
| Visuals | [SH-A40-interpretation-unresolved-municipality-ar](annotated/SH-A40-interpretation-unresolved-municipality-ar.jpg) |

---

## D. Verification items after access-control delivery (NOT new development)

| ID | What to verify | Evidence now (VERIFIED) | Screens |
|---|---|---|---|
| SH-V01 | Contract pages (`/contracts`, `/contracts/:no`, `/products/foras`) are access-scoped: a restricted user must not see other Amanahs' contracts | `93-restricted-riyadh-contracts-list-unscoped-blurred-ar.jpg`: the same 81 contracts and a Jazan contract open for a Riyadh user; invoices are scoped (an invoice of another Amanah answers «غير موجود») — being fixed by the access-control work (`/contracts,/contract,/furas/*` → `contracts.view` + scope, `docs/access-control.md §5`) | 93, 40 |
| SH-V02 | Restricted users in every register action: SH-A01 (own-scope figures), SH-A03 (CSV/list visible rows), SH-A05(b) (sidebar entry guard), SH-A12, SH-A13 (scope label), municipality-level scope in the chart companions (08 §7b gaps) | tests cover Amanah/municipality scope at service level; browser run recorded for one user | 90, 91, 92 |
| SH-V03 | The «municipality stays disabled — اختر أمانة أولاً» for a user with exactly one allowed Amanah | `91-restricted-riyadh-amanah-filter-ar.jpg` | 91 |

## E. Fully covered — retain, no development action (where and how to demo: `07`)

| Capability | Where | Evidence |
|---|---|---|
| Identities, gross → net → collected → uncollected; summary → list drill parity incl. municipality and restricted organisation | `/insights`, `/collection` | `probeA` 5 scopes equal; `nc-drilldown` 13; export parity 3291/3291 (01 §0, §A5) |
| Amanah → municipality hierarchy everywhere | filters, dashboard, NC, Decision Room links, Smart Reports, exports | `municipality` 24 + downstream tests; screenshots 10–12 |
| Revenue source, invoice number/composite key, due date, outstanding, payment history, objections, exclusions, enforcement status | list, invoice page, `/exclusions`, `/enforcement` | 02 R2.5–R2.12; screenshots 07–13, 51 |
| Follow-up priority with visible reason and next step; long-outstanding never Low | `/collection` | `priorityCore`; screenshots 15, 16 |
| Decision Room (issue, evidence, proposed, follow-up flag, audit trail, no assignment, overlap disclosed) | `/decisions` | 24 + 13 tests; screenshots 30–35 |
| Non-collection analysis (summary, reconciliation, priorities, data quality) | `/collection?analysis=noncollection` | screenshots 130–134 |
| Collection-rate card within scope; exclusions page (refined 6 Nov) | `/invoices`, `/exclusions` | screenshots 151–155, `*-final` |
| Chart picker, saved views, exports with chart choice | dashboard, Exclusions, NC, summaries, Smart Reports | `chart-integration` 29/29 etc. (08) |
| Smart Reports saved versioned reports, five exports, MOMAH PPTX template | `/smart-reports` | screenshots 60, 61, 173, 174 |
| Sanad workflow (reference match → extraction/manual → confirmation; remainder-only exclusion; closure ≠ payment) | `/enforcement`, order page | 01 §E3; screenshots 50, 51 |

## F. Candidates examined and dropped (not verified gaps, or deliberately not built)

| Candidate | Why dropped |
|---|---|
| Per-invoice collection-probability model; recoverability score | No labelled outcomes; cannot be validated (SH-A24). A priority is never a probability. |
| Scenario ranges / «confidence interval» / uncertainty bands as a headline | No evidence; scenarios only with supplied definitions (SH-A21). |
| A new forecast chart, a second priority queue, a debtor ranking card on the dashboard | Duplicates; the debtor view is one view inside an existing tab (SH-A23). |
| Re-introducing assignment / owners in the Decision Room | Intentionally removed. |
| An expected-benefit / uplift figure in the demo | No demo evidence; it exists only in the official deck KPI table (SH-A30). |
| A «billed invoices» list for the gross tile | A new page; SH-A19 removes the misleading link instead. |
| `agingPlanning` (third bucket scheme) | **VERIFIED dead field** — no consumer (`engine.js:460`); not user-visible; not an action. |
| Dead components `UncollectedBridge`, `PriorityDebt`, `ChangeExplanation` (`ExecutiveParts.jsx`), `FurasDecisionRoom.jsx` | Hygiene only; `UncollectedBridge` may be reused by SH-A01 if it fits. |
| Monthly collected + uncollected stacked-area chart (to make `stacked_area` available) | Inferred possibility, not requested (SH-A16). |
| «Enforcement closure ≠ payment», Tahseel authority, no «Najiz», no duplicate exclusion | Already enforced and tested (01 §E3). |
