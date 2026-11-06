# «تحليل أسباب عدم التحصيل» / Non-Collection Analysis — plan, model and contract (5 Nov 2026)

## 0. What the current implementation does (inspected)
* Entry: `/collection` button → `rev.startAnalysis('noncollection')` → `src/analysis/analysisTasks.js` runs seven stages (scope, retrieve, match, exclusionsReview, calculate, gaps, prepare) with a `paceMs` delay between them, showing a dark modal (`AnalysisProgress.jsx`); the result page `/analysis/:id` (`AnalysisResultView.jsx`) renders `buildAnalysisResult` (`revenueInsights.js`): indicator badges «نتيجة محسوبة», long «confirmed» sentences with up to 6 invoice-number chips per line, hypotheses, missing, recommendations.
* The task title stays «جارٍ تحليل أسباب عدم التحصيل» («analysing…») on the finished result; results live in session memory only (lost on refresh); stages carry a fixed artificial pace; verification claims ("reconcile") are partly stage text, not shown evidence.
* **Analytical problem:** `snapshot.noncollection` is ONE mutually exclusive classification (`classifyRecord` / engine `cls`): objection, linkage unresolved, ineligible for referral (missing payer id), partial, overdue, not due, + excluded/cancelled. It mixes payment position, due position, process and data quality as if they were "reasons". Overdue / partial / enforcement / missing data do not say why a payer has not paid.

## 1. The model (dimensions are separated; nothing is inferred from age)
| Dimension | Values | Source of truth |
|---|---|---|
| Payment position | fully unpaid · partly paid (received > 0) | Tahseel amounts: billed, received (`D.billed`, `D.received`) |
| Due-date position | not yet due · overdue (days, grace rule `lateness.js`) · due date unavailable | `st.due`, cutoff, `overdueDays` |
| Exclusion treatment | not excluded · excluded under an approved rule (primary reason; others are tags) | approved rules, unchanged (`D.excluded`, `D.mask`) |
| Collection process | confirmed enforcement order (open / suspended / closed) · proposed link (unverified) · objection recorded (status) · none | confirmed links `D.link`, objection flag + Mumtathil status |
| Data quality | missing payer identifier · amount conflict · unresolved status/link · investment invoice not matched to a Furas contract · report-only (unmatched) record | flags `F.*`, contract status, bridge |
| **Non-collection reason** | **documented** — only where the source records a cause (an objection by the payer with its recorded status); **otherwise «سبب عدم التحصيل غير موثق» / “Non-collection reason not documented”** | source record; never inferred |

Fact kinds shown on every finding: **source-reported fact** · **calculated classification** · **reviewer-confirmed** · **unverified hypothesis**; plus an **evidence status** (source record available / calculated only / missing) — no confidence percentages.

## 2. Financial populations (all SAR; one cutoff; period cohort = invoices issued in the period)
* **Gross unpaid** = Σ (billed − received) over uncollected, non-cancelled invoices **including** excluded ones.
* **Excluded unpaid** = the part under approved exclusions (amount basis: the unpaid remainder; a partial payment stays collected).
* **Net unpaid** = gross unpaid − excluded unpaid (= `totals.outstanding`, «غير المحصّل»; the word «القابل للتحصيل» is not used: recoverability is not assessed).
* Net unpaid partitions into: **overdue + not yet due + due date unavailable**, and also into **fully unpaid + partly paid**, and (primary allocation) into **documented reason + not documented**.
* **Standing balance at the cutoff** (`stock.netUncollected`) is a DIFFERENT population (every invoice ever issued, not the cohort); it is shown apart with its own bridge, never added to or compared as if it were the cohort.
* **Report-only / unmatched records** (`bridge.unmatched`) are listed in a separate reconciliation view and are **not** in any total; conflicting-amount invoices stay in the totals at their header amount and are flagged.
* Process states and data-quality flags **overlap** (a partly paid invoice can also be overdue and referred): they are labelled non-additive and never summed with payment states.

## 3. Action groups (primary allocation → additive; all other tags kept)
Precedence (each unpaid invoice lands in exactly ONE primary group; its other applicable groups are secondary tags): 1 review conflicting amount · 2 request missing payer / invoice information (including unavailable due date) · 3 verify proposed enforcement link · 4 review investment invoice against its Furas contract · 5 review the recorded objection status · 6 confirmed enforcement order — monitor (no new referral) · 7 follow up documented overdue invoice (complete data, no order) · 8 not yet due — no action. Groups are ranked by transparent factors shown as columns (unpaid amount, longest overdue days, process status, number of unresolved data issues) — no composite score. Owner / deadline fields are suggestions, marked as such. Nothing starts enforcement, approves an exclusion or changes a source record. A «full collection» figure, if shown, is the theoretical upper bound = net unpaid, with its assumptions.

## 4. Data-service contract: `POST /api/noncollection` → `rev.data.noncollection(scope)`
```
{ version:1, kind:'noncollection', generatedAt, cutoff, scope,
  populations:{ issued:{count,gross}, unpaidGross:{count,amount}, excludedUnpaid:{count,amount}, netUnpaid:{count,amount},
    fullyUnpaid:{count,amount}, partlyPaid:{count,amount,collected}, overdue:{count,amount}, notYetDue:{count,amount}, dueUnknown:{count,amount},
    undocumented:{count,amount}, documented:{count,amount} },
  standingBalance:{ amount, overdue, notYetDue, bridge:[steps…] },            // different population
  unmatched:{ count, amount, includedInTotals:false },
  reconciliation:[ { key, ok, lhs, rhs, labelAr, labelEn } ],                  // every identity, with both sides
  reasons:[ { key, labelAr, labelEn, count, amount, evidence:'source_record'|'none', factKind } ],   // PRIMARY allocation; sums to netUnpaid
  process:[ {key,count,amount,nonAdditive:true} ], quality:[ {key,count,amount,nonAdditive:true} ],  // overlapping views
  aging:[ { key, labelAr, labelEn, count, amount } ],                          // not_due, 1-30, 31-90, 91-180, 180+, unavailable
  byAmanah:[ {key, labelAr, labelEn, unpaid, overdue, notYetDue, dueUnknown, undocumented, count} ], byMunicipality:[…], bySource:[…],
  heat:{ rows:[amanah], cols:[aging keys], values:[[amount|null]] },
  groups:[ { key, rank, titleAr, titleEn, count, amount, maxOverdueDays, process, dataIssues, evidence:{status,textAr,textEn}, missingAr, missingEn, nextStepAr, nextStepEn, rationaleAr, rationaleEn, filter:{…list filter…}, nonAdditiveTags:… } ],
  notes:[ … limitations … ] }
```
Every bucket / group / reason carries a `filter` (or the key maps to one) understood by `POST /api/list` (`filters.nc = {group, due, reason, process, quality, payment}` + the usual scope), so a chart mark or card opens exactly its supporting invoice population with the active scope.

## 5. UI, exports, versions (see the implementation sections below as they are completed)

## 6. Exports and Smart Reports (5 Nov 2026)
**One implementation.** `src/data/ncReportModel.js` turns the structured analysis into a normal report model. `buildNcReportModel(analysis, { lang, meta })` is the standalone export (title «تحليل أسباب عدم التحصيل» / “Non-Collection Analysis”, period subtitle, context chips, `generatedAt`, `cutoff`, `meta`, headline KPIs, sections) and keeps a non-enumerable `_inputs = { analysis, ncReport:true, spec:{scope} }`, so `rebuildNcModel(model, lang)` re-expresses the SAME snapshot in the other language (used by `inLanguage` of `ExportDialog.jsx`). `ncSections(analysis, lang)` is the section builder; Smart Reports' new section key `noncollection` (`reportModel.js`, input `ncAnalysis = null`) delegates to it, so a report, the export dialog and the files can never disagree.

**Sections** (main part first, findings first): executive summary (what remains unpaid · what is overdue · what explains it · how reliable · where to act first) with the waterfall gross unpaid → excluded → net unpaid and the stacked due-position bar; reasons (ranked bar incl. «سبب عدم التحصيل غير موثق», denominator stated, payment-position table); exposure (aging bar, Amanah and revenue-source OVERDUE bars, Amanah × aging heat map — `null` is a hatched «—», never 0 — and the full tables); action groups (main table: rank · group · invoices · amount · evidence status · next step, all marked suggested; detail table: missing information · longest overdue · data issues · overlapping tags · suggested owner · rationale; no deadline is invented — the owner sets it); data quality and reconciliation (every identity with both sides, process and quality views labelled non-additive with no total row, unmatched records and the standing balance as separate tables outside every total, the reconciliation bridge); methodology (definitions, formulas, sources); the **Appendix: supporting invoices**. Limitations are callouts placed before the result they qualify (they ride on that chart's slide in the deck). No «collectible» / expected recovery / confidence percentage anywhere.

**Appendix input.** The builder is pure. The caller attaches `analysis.invoices` (rows of `rev.data.list` with `withNc:true`, sorted by unpaid amount, `NC_APPENDIX_ROWS` = 50) and optionally `analysis.invoicesTotal`; Smart Reports' `generate()` does it (`rev.data.noncollection(scope)` + one `rev.data.list`). Without them the appendix says the list is available on screen (Collection page). The invoice table has no total row (a subtotal in the unit of the largest row would round the rest away); the note gives the listed total and the net unpaid in exact SAR.

**Request.** «حلل أسباب عدم التحصيل» / “non-collection analysis” / “why are invoices unpaid” / «أسباب عدم السداد» → `sections:['noncollection']` (no longer the exclusions section; «…والاستبعادات» keeps the exclusions + status pair); “why are invoices unpaid” does not filter the scope to unpaid invoices.

**Exports.** PDF (`pdfReport.js`): the sections in order, every chart followed by its data table, the appendix last. PowerPoint (`pptxDeckPlan.js`): `nc_executive` is the executive slide (KPIs once + the five statements), a table marked `main:true` (the priorities) is a main slide, every other table and every chart's data go to the appendix (`Appendix A`), the `nc_appendix` section keeps its own title; a block may ask for a smaller table font (`sz`). Numeric parity (`npm run verify:exports`, models `noncollection-ar/en`): 751 table cells, 167 exact-SAR amounts and 253 shown items per language present in Word, Excel and PowerPoint. Looked at: PDFs (AR 15 pages, EN 17) and LibreOffice renderings of both decks (33 / 35 slides, 13 main). Not verified: PowerPoint itself (LibreOffice ignores the table `rtl` flag, so Arabic column order in the renderings is mirrored relative to PowerPoint).
