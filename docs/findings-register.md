# Findings register — Phase 0 (branch `phase0-fixes`)

Companion to `docs/platform-audit-en.md` (finding ids F-xx, D-xx, G-xx, C-xx and acceptance criteria AC-* are defined there).
Status vocabulary: **Fixed + verified** (code change, automated test, and checked in the running app) · **Fixed (tests only)** · **Guarded** (harm removed, full correction needs a business decision) · **Open**.
Nothing here is a claim of full platform compliance or of audit closure; only the items marked *verified* have evidence below.

Baseline before Phase 0: `npm test` = 56 passing. Code checkpoint = commit `3c98cd4`; data checkpoint = `docs/checkpoints/phase0-pre-data.json`.

## 0. Audit side effects — cleanup (done 2026-10-09, Asia/Riyadh)

| Item | Pre-check (current record vs documented audited state) | Action | Result |
|---|---|---|---|
| Plan `PLAN-MV0YG5BNEW`, `scenario.dRate` 8 → 3 | Matched exactly: status approved, version 1, 1 saved version, 3 history entries, scenario `{dRate 8, expense 10, slip 20, others 0}`, saved v1 `dRate 3` | Restored **only** `scenario.dRate` to 3 (no history entry, no version change) | Re-read after 1.5 s: scenario `{dRate 3, …}`; status/version/versions/history/objective/active id/name unchanged; action `ACT-MV0XEEXSR21` unchanged |
| Five test conversations `mv12a30lccy4`, `mv12amvb5m2c`, `mv12jjvcrk00`, `mv12rol4pq0u`, `mv12tj8lvjzi` | All five present with the documented message counts (2, 8, 8, 2, 2) | Deleted exactly those five | Remaining: `mv0yf555i7rh` (12 messages) only. No conflict found — no record had changed since inspection |

The values before the cleanup are preserved in `docs/checkpoints/phase0-pre-data.json`.

## Batch 1 — wrong or misleading output (technical corrections only)

| Id | Finding | Change | Evidence | Status |
|---|---|---|---|---|
| F-02 | Reports showed calculable rates as «غير متاحة»; exclusion bar had NaN segments | `ctxTotals` in `src/data/reportModel.js` now carries `cancelled`, `collectedOverNet`, `exclusionRate` (same shape as Dashboard totals). Word/PowerPoint relations table gains the two rates | Test «F-02»; app: Monthly report relations block reads «نسبة التحصيل 57.8%», «نسبة الاستبعاد 9.1%», 0 occurrences of «غير متاحة», all segment widths numeric | Fixed + verified |
| F-03 | Fixed executive report said «no recommended interventions» next to «action required» findings | Fixed reports feed the same `buildDecisionCards` source as Planning (`FixedReports.jsx`); the fallback sentence no longer asserts that nothing is needed («no proposal was generated… not a statement that no action is needed») | Test «F-03»; app: section now lists «[عالية] فواتير متأخرة أو محصّلة جزئياً…» and the false sentence is absent | Fixed + verified |
| F-09 | Proposal text in the wrong language | `src/data/proposals.js` used the English-first `bi` as Arabic-first; now a local Arabic-first helper | Test «F-09» (Arabic in `.ar`, Latin in `.en` for every field of every proposal); app: new pending proposals read in Arabic | Fixed + verified for new proposals. **Residual:** the already-stored approved action `ACT-MV0XEEXSR21` keeps the swapped evidence labels («Amount concerned», «Max days overdue») because stored test records were not to be altered |
| F-10 | Exports differ from screen | PowerPoint tables are paginated (`paginateRows`, header repeated, «part n of m»), total row kept; Excel gets a «ملاحظات التقرير» sheet (narrative, callouts, relations incl. rates), «(%)» on percentage headers, sheet names cut at a word boundary; planning-summary coverage line no longer contradicts the expenditure report | Test «F-10» (pagination, notes sheet, headers). PowerPoint/Word files not opened visually in this session | Fixed (tests only) — visual check of generated .pptx/.docx pending |
| F-11 | Smart report with no invoices showed zeros and allowed export; raw key in chip text | `buildReportModel` sets `empty`; Smart Reports shows the unavailable-not-zero message and disables export; `describeChange` prints source/status labels | Test «F-11» | Fixed (tests only) — UI check of the empty Smart report pending |
| C-01 | False statements | Interim wording for F-03 and the coverage line (above). The remaining C-01 items are definition-dependent (see decision table) | – | Partly done |

Test count after batch 1: 61 passing (56 + 5 new).

## Batch 2 — dates (technical corrections only)

| Id | Change | Evidence | Status |
|---|---|---|---|
| D-01 | One validator (`src/data/dateRange.js`) used by the Dashboard scope bar, the Smart-report filter panel and typed requests: an inverted, empty or impossible range is **never applied**; inline message «تاريخ البداية بعد تاريخ النهاية — صحّح الفترة.»; the Smart «Apply» button is disabled while invalid | Test «D-01/D-02»; app (typed 2026-06-01 → 2026-03-01): message shown, `aria-invalid` set, scope unchanged, no empty-state | Fixed + verified |
| D-02 | `min` = data start (2025-01-01) on both fields; a coverage line «البيانات متاحة من 2025-01-01 حتى 2026-10-09» is always visible; a partly-outside range is clamped and the control says so («البيانات تبدأ من 2025-01-01؛ ضُبط تاريخ البداية.»); a wholly-outside range is rejected | Same test; app (typed 2020-01-01): clamped to 2025-01-01 with the note | Fixed + verified |
| D-04 | A quarter/month that has not started is no longer turned into a reversed range: the interpreter asks which period is meant and shows the start date; an explicit year («الربع الثاني 2025») is now honoured; «للربع الثاني» (ل + الربع) is now recognised; a typed ISO range is validated; the previous-year choice for a bare month name is flagged (`yearAssumed`) and the interpreted dates are always shown in the change chip | Test «D-04» | Fixed (tests only) — conversation UI not exercised end-to-end |
| D-05 | «Previous month» compares equal elapsed days only for a single-month selection; for any other selection it is the preceding period of **equal length**, and the comparison chip/description says so | Test «D-05» (282-day YTD → the 282 days before it) | Fixed (tests only). Which comparison should be the *default* is not decided here (see EQ decision table) |
| D-07 | `fmtRiyadh` / `riyadhDateOf` (Asia/Riyadh) now format plan versions and history, action history and rejected proposals, conversation history, data-source timestamps, the «أُعدّ في» line (with «بتوقيت الرياض»), export file names and the generated-on dates of exports; storage stays UTC ISO | Test «D-07» (22:30 UTC → next day 01:30 Riyadh) | Fixed (tests only) |

Not changed on purpose: D-03 «آخر 3 أشهر» (two incompatible meanings — needs a definition), D-06 basis label (depends on EQ1).
Test count after batch 2: 65 passing.
