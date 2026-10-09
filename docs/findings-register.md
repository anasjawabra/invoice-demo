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
| F-10 | Exports differ from screen | PowerPoint tables are paginated (`paginateRows`, header repeated, «part n of m»), total row kept; Excel gets a «ملاحظات التقرير» sheet (narrative, callouts, relations incl. rates), «(%)» on percentage headers, sheet names cut at a word boundary; planning-summary coverage line no longer contradicts the expenditure report | Test «F-10»; **generated files parsed** (compact demo, Executive + Amanah sections): .pptx 23 slides — the Amanah table (19 Amanahs + total) is split «الجزء 1 من 2 / 2 من 2» with the «الإجمالي» row on the last slide, the municipality table in 5 parts ending with the total; .xlsx contains «ملاحظات التقرير» with the narrative and the relations line incl. both rates, sheet names cut at word boundaries | Fixed + verified for PowerPoint and Excel (parsed). Word (.docx) was not opened — only its text lines are shared with PowerPoint |
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

## Batch 3 — governance guards (no new approval policy)

| Id | Change | Evidence | Status |
|---|---|---|---|
| F-06 | «اقتراح إجراء من هذا السيناريو» now adds a **proposal** to «مقترحات بانتظار المراجعة» (`addProposal`); it no longer creates an *approved* action. The id is stable per plan+scenario, so repeating the click does not duplicate. Approving a proposal records `approvedBy` / `approvedAt` | Test «F-06» | Guarded (tests only). **Who may approve (a second person / role) is not decided here** — see EQ table |
| F-07 | Every edit of plan content goes through `editPlan`: field edits are logged (consecutive edits of one field coalesce), and an **approved plan that changes returns to draft** with a history line («edited after approval; the saved version is unchanged…») — the rule the store already applied to «save new version», now applied to every edit. A «changes not saved as a version» tag appears when the working copy differs from the latest version. «Restore as draft» uses the same path. New plans are no longer named «(مسودة)». Audit entries use the person's name in the interface language (`actorName`) instead of the Chinese display name | Test «F-07»; app: stored plan unchanged by loading Planning (dRate 3, approved, v1, history 3), no unsaved tag | Guarded (tests only) — the edit path itself was **not** exercised in the browser, to avoid altering the stored plan again |
| F-15 | Proposal ids carry `@period..|scope`; the same finding under another period/scope is a new proposal and shows «قرار سابق على مقترح مماثل…» instead of being hidden | Test «F-15»; app: the earlier-approved overdue follow-up is listed again with the note «اعتُمد 2026-10-09 (2026-01-01 → 2026-10-09)» | Fixed + verified |

Side effect to note: loading the register adds an empty `proposed: []` list to `ib_actions_v1` (schema addition, no existing field changed). The stored action `ACT-MV0XEEXSR21` and the stored plan are otherwise unchanged.
Test count after batch 3: 68 passing.

## Batch 4 — Smart-report interpretation, navigation, contrast and focus

| Id | Change | Evidence | Status |
|---|---|---|---|
| F-05 (guard + verified mis-readings) | Period matching now folds Arabic spelling and accepts the glued prefixes («للشهر الماضي», «للربع الثاني»); only the **object** of «قارن / مقارنة / compare with» is a comparison (so «تقرير الشهر الماضي مقارنة بالعام الماضي» = last month vs last year); a named comparison month is accepted only when it is the month right before the report month, otherwise the user is told so; «بلديات» no longer selects the municipal-fees source; «الأمانات الشرقية» and a single Amanah mention («في جدة») are applied; «قارن الرياض بجدة» applies both and adds the Amanah table; budget / coverage questions map to the budget section instead of the generic report; «تقرير الشهر الماضي» with an unchanged period is a report, not «could not understand»; English «compare with last month» no longer changes the period; a period phrase that cannot be resolved («قبل شهرين», «آخر 6 أشهر») gets a clarification, never a silent default | Test «F-05 golden phrases» (13 phrasings from the audit table, all pass) | Fixed (tests); the 100-phrase corpus asked for in the audit is **not** built yet (13 so far) |
| F-16 | (a) no auto-scroll on arrival/reopen — only when the open conversation grows; (b) `?q=` starts its own conversation and is removed from the URL once consumed, so reload does not replay it; (c) no «أعددتُ التقرير» bubble after a clarification question | App: `?view=smart&q=تقرير الشهر الماضي` → one new conversation (2 messages), period 2026-09-01 → 2026-09-30, `scrollY` 0, URL becomes `?view=smart`; reload → still 2 messages (no replay); the original conversation untouched. The verification conversation was then removed | Fixed + verified for (a)(b); (c) by code. (d)(e)(f)(g) not changed |
| F-17 | Collection → «التنبؤ والمستهدف» now goes to `/planning#outlook`; Planning scrolls to a `#section` once its content exists; section scroll margin raised from 54 to 136 px so the heading is not hidden under the sticky header (F-29); the browser tab title names the page (also for `/investment-invoices`) | App: `/planning#outlook` → section top 136 px; tab title «التخطيط المالي والاستراتيجي \| INTELLIBILL · AI Suite»; `/sanad-orders` title «تحليل الفواتير المُحالة للتنفيذ \| …» | Fixed + verified. Unknown-path 404 and `report=bad` feedback not done |
| G-06 (Sanad button) | `.rv-table a` colour no longer overrides button links: «فتح» is white on green | App DOM: `rgb(255,255,255)` on `rgb(27,131,84)` = **4.75:1** (was 1.15:1) | Fixed + verified for this control. The other contrast failures counted in the audit (Collection 83, Invoices 55, Risk 50, Exclusions 39, Data sources 30) were **not** re-run or fixed |
| G-07 (focus ring) | One visible focus ring for every focusable control (2 px, SA 700 / SA 300 in dark, offset 2 px), above the component rules that removed the outline | App: Tab key → `solid 2px rgb(22,106,69)`, `:focus-visible` true | Fixed + verified on one control; not re-audited page by page |
| (token) | Added `--danger-text` (DGA Error 700 / 400) used by the new date messages | – | Added; existing danger text colours not migrated yet |

Test count after batch 4: 69 passing. `npm run build` succeeds (bundle 2.4 MB, size warning unchanged).

## Batch 5 — visible states and labels (technical corrections only)

| Id | Change | Evidence | Status |
|---|---|---|---|
| F-12 | Dashboard / Fixed reports / Smart-free views and Planning show a status line while the figures refresh («جارٍ تحديث الأرقام لهذا الاختيار…») and dim the content; a failed refresh now shows an alert «تعذّر تحديث الأرقام… المعروض يخص الاختيار السابق» with **Retry**; the stored error is cleared on the next attempt (it used to stay forever) | App with a simulated outage (fetch rejected): status line, then after the service's retries the alert; Retry with the service restored → alert gone, figures current | Fixed + verified on the Dashboard (Planning shares the component) |
| F-04 (guard only) | Planning shows a warning banner whenever the dashboard filter differs from the plan's period/scope («الأرقام أدناه تتبع مرشحات لوحة المعلومات الحالية، وليست نطاق الخطة…») with a button to apply the plan scope. The analytics themselves still read the dashboard filter | App: with «هذا الشهر» selected the banner names both ranges; with year-to-date it is absent | Guarded + verified. **Binding the plan's figures to the plan scope is not done** (needs EQ4) |
| F-08 (labels only) | «قواعد معتمدة» / «approved rules» no longer label the whole rule-based exclusion amount in the relations bar, the exclusions tile, the Smart-report caption and the status name («مستبعدة وفق قاعدة (بقرار مراجعة معتمد)»); the split of approved vs unapproved rule *definitions* that already exists in the exclusions panel is unchanged | Test suite unchanged and passing; labels read in code | Relabelled. The unapproved-rule band and the treatment of those exclusions in net billed are **not** changed (EQ3) |

Test count after batch 5: 69 passing; `npm run build` succeeds.

## Status against the acceptance criteria (audit §30) — what has actually been verified

Only the items below were checked; everything else is **open**. None of the seven areas is closed.

| Area | Verified in Phase 0 | Not verified / not done |
|---|---|---|
| A — consistent figures | A4 (relations block shows the same rates as the KPI row, no `NaN` widths, no «غير متاحة» for a calculable rate — checked on the monthly report, one scope); A5 for the executive report (the false «no recommendations» sentence is gone) | A1–A3 (cross-view parity test over the 12-selection matrix and the visible basis) — blocked by EQ1; A6 (glossary lint) |
| B — plan-anchored planning | B3 partly (banner when the filter differs from the plan scope) | B1, B2, B4–B6: results are still computed from the dashboard filter; versions do not store period/scope/basis/config; no named scenarios |
| C — interpretation | C1 partly: 13 of the audit's phrasings pass (target ≥ 150 phrasings, ≥ 95 %); C2 for unresolved periods and unsupported named-month comparisons; C4 partly (`?q=` replay, scroll on reopen) | C1 corpus size; C3 interpreted-request line; C5 sync control; C6 (budget questions are routed to the budget section; no redirect/answer test); (d)–(g) of F-16 |
| D — dates | D1 (UI + code; network test not run), D5 (function test at 22:30 UTC; not run at all four hours), D7 (coverage line shown; «كل البيانات» label not changed) | D2/D3 (preset registry, «آخر 3 أشهر مكتملة» — needs EQ7), D4 partly (equal-length comparison for non-month scopes), D6 |
| E — governance | E5 (a proposal approved in one scope reappears in another), E4 partly (names in the interface language for new entries; old stored entries keep «李芳军») | E1 (the **manual** action path still creates an approved action), E2 (no second-person rule — EQ4), E3 partly (an edited approved plan returns to draft with a log line and an untouched saved version, but no new version number is created) |
| F — exports | F1 for PowerPoint (pagination, total row) and Excel notes (parsed files); F3 (« (%) » headers, word-boundary sheet names) | F1 for Word; callouts and every block in every format; F2 (cut-off/generated-time lines in every export); F4 |
| G — content and visual consistency | G4 partly: Sanad «فتح» 1.15:1 → 4.75:1; one visible focus ring | the remaining contrast failures (Collection 83, Invoices 55, Risk 50, Exclusions 39, Data sources 30), target sizes, `h1`/landmarks, tokens/typography/logo (G1–G3, G5, G6) |
