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
| F-12 | The Dashboard, the Fixed reports and Planning show a status line while the figures refresh («جارٍ تحديث الأرقام لهذا الاختيار…») and dim the content; a failed refresh now shows an alert «تعذّر تحديث الأرقام… المعروض يخص الاختيار السابق» with **Retry**; the stored error is cleared on the next attempt (it used to stay forever) | App with a simulated outage (fetch rejected): status line, then after the service's retries the alert; Retry with the service restored → alert gone, figures current | Fixed + verified on the Dashboard (Planning shares the component) |
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

## Decisions needed — EQ1 to EQ10

Everything below was left unchanged on purpose; each row says what stays blocked until it is answered. «Recommended» is my proposal, not a decision.

| ID | Decision required | Recommended option | Business impact of the decision | What remains blocked |
|---|---|---|---|---|
| **EQ1** | For a closed period, are collections counted to the **period end** or to **today** — and which basis does the comparison use? The monthly decks do not state theirs | Period end for headline and comparison (like-for-like); «to today» as a second, labelled figure; open periods count to today | Decides which collection rate a manager sees for «last month» and whether «improved / declined» is the same on every screen. Today the Dashboard, Fixed reports and Smart reports can disagree for the same invoices (21.7 % vs 15.5 % in the audit) | F-01 (one measurement module), the visible basis switch, AC-A1–A3, the cross-view parity test, D-06 |
| **EQ2** | Which **grace period** applies to (a) collection-vs-target comparison, (b) overdue/aging, (c) enforcement-referral eligibility? The decks state 5, 10, 15 and 35 days for (a) in four different months and 60 + 30 days for (c) (white-lands fees only) | One named parameter per use, each printed on the figure, values and effective dates from the official policy; until then show «بدون فترة سماح» | Moves invoices between «due» and «not yet due», changes every after-grace rate and the referral share. 5/10/15/35 look like 5 × month number, but only four decks were supplied | F-32 (parameterised grace), after-grace rates, referral eligibility; see `docs/monthly-reports-definitions-register.md` §1 |
| **EQ3** | Should exclusions that rest on **unapproved rule definitions** reduce the headline net billed and rate? | Keep today's calculation, add a visible band «منها استبعادات بقواعد غير معتمدة»; decide once the rules are approved | Almost all of the rule-based exclusion amount rests on rule definitions marked unapproved, so the headline net and the rate depend on them | The band and the final treatment (labels were corrected; numbers unchanged) |
| **EQ4** | Do planning figures always use the **saved plan's period and scope**, and **who may approve** plans, objectives and actions (can the proposer approve)? | Yes to plan-anchored figures with a banner when the filter differs (banner done); proposer ≠ approver, two configurable roles | Decides whether an approved plan's numbers are reproducible and whether approval is a real control | Plan binding (B1–B2), version contents, approver rule (E1–E2), second-person approval |
| **EQ5** | Which **coverage of operating expenditure** is official: collected ÷ prorated original appropriation of chapters 1–3 (as in the decks) or receipts ÷ cash payments? | The decks' definition as primary (national until per-Amanah appropriation exists); the payments ratio labelled «تغطية نقدية (اصطناعية)» | The two give different ratios and different messages about sustainability; the platform currently shows only the payments version | The coverage card and report (basis label only so far), planning variance and funding views |
| **EQ6** | Is the fiscal year the Gregorian calendar year, and are the uniform collection target and the annual sector targets **approved and versioned**? | Calendar year; store each target with source, version and «حالة الاعتماد: غير مؤكدة» until confirmed | Decides whether a target seen in a report may be shown as «approved» and whether «on track / off track» statuses are defensible | Objective statuses, required pace, variance (labels stay «غير معتمد») |
| **EQ7** | What does **«آخر 3 أشهر»** mean and which presets are offered? | Three complete calendar months; presets: today, month to date, last complete month, last 3 complete months, quarter to date, year to date, custom, all data | Today the label spans 77–107 days depending on the date | D-03, D-08, the preset registry, AC-D2–D3 |
| **EQ8** | Does a Smart-report conversation **follow the dashboard filters live**, and must it also produce **budget/expenditure** reports? | Own scope with an explicit sync control; budget requests redirect to the fixed report | Decides whether two screens can show different scopes without warning | C5 (sync control), F-16(f); the interpreter guards are done |
| **EQ9** | Which sections of the **July report** must be added: enforcement referral, income participation, e-invoice, quarterly bars? | Enforcement referral first (Sanad data exists, with gaps); quarterly bars next; income participation and e-invoice only when their sources exist | Adds report types the ministry already produces monthly; two of the three have **no data source** in the schema dictionaries | The three new fixed reports (data readiness in `docs/monthly-reports-definitions-register.md` §4) |
| **EQ10** | Is browser-local storage acceptable for the demo, and when is a server store with identities required? | Local storage now with a visible notice and plan export/import; server store later | Plans, actions and conversations exist only in one browser; two people cannot share or approve across machines | B-14 (server store, roles); nothing else |

Not decision-blocked but still open (no one needs to answer): the ≥ 150-phrase interpreter corpus, remaining contrast failures, the manual-action path (E1), F-11 UI check of an empty Smart report, a visual check of the .docx export, F-18–F-31 (P2/P3 items), the shared date picker (G-12) and the Figma/logo assets (D1, G-01).

# Round 2 — critical corrections after the approved decisions (EQ1, EQ4 scope, EQ7, EQ8, EQ10)

Approved: EQ1 headline = collections at period end, «to today» only as a separate labelled figure · EQ4 plan figures from the saved plan's period and scope (approval authority still pending) · EQ7 «آخر 3 أشهر» = the three complete calendar months before the current one · EQ8 Smart conversations keep their own scope with an explicit sync control · EQ10 browser-local storage with backup/export/import and a notice.
Not inferred from anything: grace periods (collection reporting and enforcement referral stay separate parameters, both unresolved — the Noncollection page now says so), exclusion treatment, official coverage definition, fiscal year, target approval, new report scope, approver policy.

**Implementation vs verification.** «Implemented» = code changed. «Verified» = checked by the method named in the evidence column. Unit tests and a successful build are never counted as verification of a journey.

## Closed — criteria checked

| Finding | What was implemented | Verification (method and result) |
|---|---|---|
| F-01 / D-06 shared measurement (AC-A1, A2) | `src/data/measure.js`: one headline basis (period end), `to-date` only as a labelled separate figure (`ToDateFigure`, toggled on the Dashboard and Fixed reports); every view (Dashboard, Fixed, Smart with/without comparison, Planning, comparison module) calls it; the per-view overrides and the global «collections up to» selector were removed | **Browser parity** — last month × Riyadh Amanah: the financial-relations block (gross, exclusions, net, collected, uncollected, both rates) is character-identical on the Dashboard, the monthly Fixed report, a Smart report, and a Smart report with «مقارنة بالعام الماضي» (the case that used to change 21.7 % → 15.5 %). Year-to-date: Dashboard = Planning baseline (13.56 bn / 7.83 bn / 57.8 %). **Engine parity test** over 13 selections (4 periods × all / one Amanah / one source + empty) and the comparison delta |
| AC-D2/D3, EQ7 | `lastCompleteMonths`; one preset registry `src/data/periodPresets.js` (today, month to date, last month, last 3 complete months, quarter to date, year to date, all data) used by the scope bar, the Smart filter panel, the stored scope, the report labels and the interpreter | Table-driven test over 24 reference dates (month ends, 1 Jan, 29 Feb, rollovers) for every preset and the interpreter; browser: the scope bar shows the seven presets |
| F-04 plan anchoring (AC-B1) | Planning computes everything from `planScopeOf(plan)` (plan period, capped at the cut-off, and plan scope); the dashboard filter bar was removed from Planning; the plan bar edits period, Amanah and source; saved versions store period, scope, basis, cut-off, configuration hash and targets | **Browser:** the full text of the Planning page is identical (13,483 characters, 0 differing lines) under the default filter and under «last month · Riyadh · fines» |
| F-06 / E1 proposed-only | Manual actions and scenario actions are proposals (`addProposal`); the register receives an action only through a reviewer's approval, which records `approvedBy/At` and keeps the manual origin | **Browser journeys:** the scenario button and the manual form both land in «مقترحات بانتظار المراجعة» with the register unchanged; rejecting with the inline reason field works |
| F-07 (AC-E3) | Edits of an approved plan return it to draft (logged), saved versions untouched | **Browser journey:** typing a new lever value into the approved plan → status «مسودة», `approvedBy` cleared, history «scenario changed / returned to draft» by «طارق» (Arabic UI), v1 still holds the approved lever value, the «unsaved changes» tag appears. Then «Save as new version» stored v2 with its context |
| F-11 | Empty Smart report | **Browser journey** (housing sales this month): chips show «المبيعات السكنية», the unavailable-not-zero message, no zero figures, Word/Excel/PowerPoint buttons disabled |
| F-10 / AC-F1, F2 | Word build extracted (`buildDocx`); every table's note, every section title, the data cut-off and the Riyadh-time «prepared» line are in all three formats; totals appear in the exact-SAR sheet | **`npm run verify:exports`** (generates 11 models × 3 formats: the 9 fixed reports, a detailed Smart report, the planning summary) → Word 1425/1425 shown items, Excel 1425/1425, PowerPoint 1425/1425; table cells 4783/4783 in Word and PowerPoint; 2226/2226 exact SAR amounts in Excel. **Word visually inspected** (LibreOffice render, RTL, tables, totals) |
| No writes on load | `usePersistOnChange` for plans, register and conversations; the register is returned exactly as stored; the first plan draft lives in memory until the first edit; the earlier empty `proposed: []` was removed from the stored record (restored to its pre-Phase-0 shape) | **Browser:** the three stored records are byte-identical before and after opening Planning and Smart reports |
| EQ10 | `LocalDataPanel` (notice + download backup + validated restore with confirmation); `localBackup.js` | Unit test (round trip, invalid files write nothing); **browser:** the panel shows the notice, a valid file raises the «replace the current data» confirmation, an invalid file is refused, storage unchanged |
| EQ8 | Sync control in the conversation: a notice when the conversation scope differs from the dashboard, never changes it silently | **Browser journey:** a conversation for Jeddah/last month shows the notice; «مزامنة…» regenerates the report for the dashboard scope (year to date · all) |
| G-17 (headings, landmarks) | Every page title is an `h1` (details pages included), skip link, `footer` | Computed on 11 routes: one `h1` on each, skip link present, one footer |

## Partially fixed

| Finding | Done and verified | Still open |
|---|---|---|
| F-05 / AC-C1 | **209 phrases** (162 + 47 written blind) in `tests/interpreter-corpus*.mjs`, enforced by `npm test` (≥ 95 %, the audit's ten verified failures and every unsupported / unresolved-period case at 100 %). First-run results, before the fixes: first 162 = 153 (94.4 %) after my earlier tuning; the 47 blind phrases = **27 (57 %)**. All are fixed now | The corpus was written and the interpreter fixed by the same author, so 100 % is a regression guard, not an independent accuracy estimate. Real user phrasing is untested. C3 (interpreted-request line) and C5 (shown only as the sync notice) |
| AC-B2 / B6 | Versions store their calculation context and flag «data/config changed since saved» | Reopening a version does not recompute and diff its stored results; no named scenarios or side-by-side comparison |
| G-06 contrast (AC-G4) | Computed on 11 routes: failures went from 55 / 83 / 50 / 39 / 30 (Invoices / Collection / Risk / Exclusions / Data sources) to **0 on every route re-measured after the last colour change** (Invoices, Collection, Risk, Exclusions, Data sources, Metrics, Planning, Fixed report, Dashboard, Sanad orders, Contracts). Implemented with `--ink-ok`, `--danger-text`, a darker warning amber, the button-link colour and badge colours | The only remaining measured item is the disabled Smart send button (disabled controls are exempt from WCAG contrast). Dark mode not reviewed (not required now); the axe/screen-reader pass of AC-G4 was not done |
| G-08 target size | 24 px floor for table links, link-buttons, help «?» buttons, checkboxes/radios and range inputs; 44 px on touch pointers | Re-measured after the changes (controls below 24 px): Contracts 0, Planning 0, Sanad 0, Fixed report 0, Collection ≤ 2, Risk/Metrics ≤ 1, **Dashboard 12 (inline links), Exclusions 6 (not re-inspected), Data sources 1 (a 23 px-wide link)** — AC-G4's «≥ 24 px 100 %» is not met yet |
| D-08 / D-09 | One preset registry; active-filter count + reset + persistence statement (browser-verified) | Quarter-to-date and today have no interpreter phrasing beyond «اليوم»/«الربع…» |
| F-12, F-04 guard | See batch 5 | – |
| AC-F (F3, F4) | % headers, sheet names, file-name date in Riyadh time | – |

## Still open (not touched in this round)
F-02… were closed in Phase 0 round 1. Open: D-03 wording on all screens; D-10 date formatting («9 أكتوبر 2026»), D-11 date-column names, D-12 rollover refresh, D-14 comparison dates in the delta line; F-13 hidden drill-down filter; F-18–F-31 (navigation chrome, duplication, ambiguous duplicate municipality rows, planning scenarios comparison, etc.); G-01 logo/name assets and G-02–G-05, G-09–G-26 (typography/tokens/icons/DGA components); content items C-02…C-10; the Smart-report conversation items F-16(d)–(g); the unknown-path 404.

## Remaining business decisions
EQ2 grace periods (collection reporting vs enforcement referral — two parameters, neither set) · EQ3 exclusions on unapproved rules · EQ4 approval authority (who approves plans, objectives, actions) · EQ5 official coverage definition · EQ6 fiscal year and target approval · EQ9 new July report types (enforcement referral first; income participation and e-invoice need data sources) · logo and Figma assets (D1, G-01).

# Round 3 — content, dates, shared design, accessibility, functional verification

**Implemented ≠ verified.** «Implemented» means code changed; «verified» names the method. Screenshots: `docs/screenshots/before-*.jpg` (before this round) and `after-*.jpg` (after; 1280 px, Arabic). Closed only against the stated acceptance criteria; partial items are split.

## 1. Content and user experience (C-02 – C-10, journey issues)

| Finding | Implemented | Verified | Status |
|---|---|---|---|
| **C-02** one name per concept | Glossary applied on the main screens: «غير المحصّل» (period invoices), «الرصيد القائم» (all unpaid invoices at a date; replaces «صافي غير المحصل» and «الإجمالي القائم»), «المتبقي» no longer used for uncollected; «ريال» replaces «SAR» in Arabic text (SAR kept in English UI, ids and exact-amount columns) | Screenshots + string search of the touched pages; `npm test` (unit labels) | **Split.** Fixed on Dashboard, Fixed reports, Planning, Invoices, Collection, Noncollection labels. Still open: long caveat sentences in the metric dictionary, rule registry and some assistant answers still say «صافي غير المحصل»; «المقبوض/المقبوضات» vs «المحصّل» not audited page by page |
| **C-03** technical detail exposed | Rule version, reconciliation flag, grace note, reference date and data label moved into a «حالة البيانات» details block (operational pages) with a warning chip **only** when relevant (failed reconciliation; unapproved-rule exclusions amount); KPI «?» panel now shows what / how / what it does not mean, with technical details folded and the undefined «اكتمال البيانات» removed; the one «Grace days: 0 (unresolved)» chip now reads «لا تُطبَّق حالياً (السياسة غير محسومة)» — an unset grace is **not** shown as zero | Screenshot of the Invoices page; code for the popover | **Split.** Action-id pills in the register, `housing_sales`-style keys in some lists, «Σ» in a few dictionary entries remain |
| **C-04** repeated disclaimers | One global «بيانات تجريبية» marker in the header (with a short explanation, compact-sample size and Riyadh-time note); removed the per-page demo badges, the synthetic tags in the Dashboard / Planning headers, the repeated target disclaimers (one banner «المستهدفات الحالية تجريبية وغير معتمدة» + «تجريبي» chips), the plan-bar approval sentence (now a tooltip) and the per-answer assistant footer | Screenshots (Dashboard, Planning, Invoices) | **Split.** Page subtitles on some operational pages still repeat «بيانات تجريبية…» |
| **C-05** buried information | Dashboard: one status sentence, then tiles, then a «يحتاج انتباهاً» block (top three action insights); Fixed reports: catalogue in three groups without numbers, report header reduced to one summary line with «تفاصيل التقرير» expandable, assumptions / findings / forecast sections collapsed; Planning: plan bar reduced to plan, version, status and actions with the edit fields in an expandable block | Screenshots: first KPI visible in the first screen of the monthly report; Planning no longer opens with a 23-control block | **Split.** G1 thresholds (≤ 450 words, first KPI within 450 px, ≤ 6 pills) were **not measured** |
| **C-06** rhetorical headers | Removed the five-question Planning subtitle, the Dashboard slogan with the false «same numbers» claim, the tab sub-lines, the «يُفتح مباشرة» tags; headers now state the live period and scope | Screenshots | Fixed |
| **C-07** dense assistant text | Smart banner shortened (examples and «about the assistant» expandable); replies say what was understood instead of «prepared from system data»; unsupported reply = one line + three examples; proposal card details expandable | Browser: clarification and unsupported flows seen earlier; banner screenshot. Report-reply text checked in code only | **Split** (reply wording for a finished report not re-screenshotted) |
| **C-08** language and unit style | «ريال», «نقطة مئوية» instead of «pp», dates written as «9 أكتوبر 2026» / «1 يناير – 9 أكتوبر 2026» in headers, chips, notes, delta lines, Planning, Smart chips, invoice date columns, chart months | Browser DOM check: **0 ISO dates** in the Dashboard text; screenshots elsewhere | **Split.** Fixed-report tables and export context rows keep ISO dates on purpose (files/URLs) |
| **C-09** tooltips carry essential information | KPI definition is a click/focus panel (already keyboard-operable) with a visible short definition; `title` attributes unchanged elsewhere | Not exercised this round | **Open (partly implemented)** |
| **C-10** references to unseen material | Suggestion «…مشابهاً للتقارير المرفقة» → «جهّز تقريراً شهرياً بالمقارنة مع العام الماضي»; report purposes and assumptions no longer cite the monthly reports / «الديمو» | Code + screenshots of the catalogue | Fixed |

Journey issues also closed: unknown fixed-report key now says so; the Smart conversation notice for scope differences (earlier round); header duplicated page title removed.

## 2. Dates and filters

| Finding | Implemented | Verified | Status |
|---|---|---|---|
| **D-10** date format | `fmtDateText` / `fmtRangeText` / `fmtMonthText` (Gregorian, Western digits, Arabic month names); coverage and validation messages in words | Browser: 0 ISO dates on the Dashboard; messages seen earlier | **Split** (export contexts keep ISO) |
| **D-11** date columns | Invoice ledger: «تاريخ الإصدار», «تاريخ الاستحقاق», «أيام التأخر بعد الاستحقاق» | Browser: header cells read | Fixed for the ledger; aging labels elsewhere unchanged |
| **D-12** day rollover | A notice «تغيّر التاريخ منذ فتح الصفحة…» with «تحديث الآن» when Riyadh's date differs from the date the page loaded (checked on focus, visibility change and every 5 minutes; skipped in time-travel mode) | Browser, with `Date` stubbed one day ahead: banner appears | Fixed (simulated, not waited out) |
| **D-14** comparison dates | The delta line now names the comparison period: «+6.7 نقطة مئوية عن العام الماضي (1 يناير – 9 أكتوبر 2025)» | Browser DOM text | Fixed |
| **F-13** hidden drill-down filter | `/invoices?src=fines` writes the source into the shared filter and drops the URL parameter | Browser: shared scope source = fines, selector shows «الغرامات والجزاءات», URL clean, KPI strip 122 invoices (was 386 national) | Fixed + verified |
| Reset and persistence | «مرشحات مفعّلة (n)» + «إعادة الضبط» (earlier round) | Browser journey: set last month + Riyadh on the Dashboard → full page loads of the Fixed report, Invoices, Planning, Dashboard: filters persisted on all shared pages, **Planning stayed on its own plan scope**, reset returned to year-to-date/all | Verified |
| Reporting vs planning periods | The plan period (may end in the future, capped at the cut-off for computation) is edited in the plan; reporting filters cannot select future dates | Browser (earlier round: Planning text identical under two filters) | Verified |
| D-13, D-15 | – | – | **Open**: fiscal-year definition (EQ6); typed-range apply-on-Enter not changed |

## 3. Shared visual design (MOMAH / DGA reference)

Implemented: IBM Plex Sans Arabic **self-hosted** (`@fontsource`, weights 400/500/600/700; the Google request and Plex Mono were removed) as the only family; light-theme tokens rewritten to the DGA scales (Saudi Green 600 primary, Info 700, Success 700, Warning 700, Error 600/700, Gray 100–900 ground, text and lines); every raw hex in CSS/JSX snapped to the nearest DGA colour (143 of 143 remaining hex values are DGA/white/black) and every rgba base likewise; font sizes collapsed to {12, 13, 14, 16, 18, 20+}, weights to ≤ 700, radii to {4, 8, 12, 16, 24}; flat page ground; tab strip reduced from eleven entries to three (the two management areas plus one «وحدات تشغيلية» menu — no new pages).
Verified: browser computed styles — one font family on all 930 text nodes of a page, only Plex Arabic faces loaded; screenshots; contrast re-measured after the palette change (see §4).
**Not claimed:** exact Figma conformance (no Figma specification was supplied; the DGA scales come from the published system), logo/identity (candidate asset only), icon set (Hugeicons licence unresolved; inline SVG icons unchanged), 4-px spacing grid (not normalised), chart palettes beyond the colour snapping, dark theme (not required).

## 4. Accessibility and navigation

| Check | Method | Result |
|---|---|---|
| WCAG contrast | custom computed-style script on 15 routes; re-run on Dashboard, monthly report, Planning, Invoices, Collection **after** the palette change | 0 failures on those five (and on all routes measured before the palette change) |
| Automated accessibility | `axe-core` 4.x injected in the browser pane (WCAG 2 A/AA, 2.1 A/AA, 2.2 AA, best practice) on 15 routes + the 404 page + the open operations menu | Initial violations fixed (names on chart canvases, size-bar roles, focusable scroll regions, heading order, empty table headers, duplicate navigation labels, label-in-name on clickable invoice rows). Final runs: **0 violations** on Dashboard (also with the menu open), Fixed list, monthly report, Smart, Planning, Invoices, Collection, Risk, Contracts, Metrics, Sanad, Investment invoices, 404; Data sources, the 404 page and the unknown-report message were re-run after the last fixes (0 violations; the 404 h1 reads «الصفحة غير موجودة», the unknown key shows «لا يوجد تقرير بهذا الاسم…») |
| Keyboard | real key presses in the browser pane | Tab order on the Dashboard header is skip link → brand → demo note → theme → language buttons → organisation (matches the visual RTL order); operations menu opens with Enter, Tab enters it, Escape closes and returns focus; Planning assistant overlay: focus enters, Escape closes, focus returns to the opener; invoice detail opens from the id button with Enter. Date controls (typing, validation messages) verified in earlier rounds. **Not done:** a full keyboard walk-through of all five main journeys |
| Target size | computed 24 px floor | Re-measured after changes: Dashboard 3, Collection 2, Invoices 1, others 0–1 controls below 24 px → AC-G4 «100 %» **not met yet** |
| 404 | `NotFound` page inside the shell (links to the two management areas); unknown report key message | Browser: axe clean, heading and message text read; not screenshotted |
| Responsive | 390 px: no horizontal overflow on Dashboard, Planning, Invoices, Smart; header no longer sticky on phones | The header is still ~263 px tall at 390 px (31 % of the screen) — scrolls away but is not compact |
| Screen readers | – | **Not performed** (no NVDA / JAWS / VoiceOver / TalkBack run). Arabic announcement order, live-region behaviour of the data-status and rollover notices and chart alternatives therefore remain unverified |

## 5. Remaining functional verification

| Item | Result | Status |
|---|---|---|
| **Backup download** (EQ10) | Browser: the button hands the page's blob to the browser (captured by intercepting `createObjectURL`/anchor): file name `revenue-demo-backup-2026-10-09.json`, `format`/`version` correct, contents byte-equal to the stored plans/actions/conversations (15,873 bytes with two plan versions) | Verified (download observed through interception, not a saved file) |
| **Restore** | Browser: after the backup, a throwaway proposal was added; the backup was fed through the real file input → «replace the current data» confirmation (counts shown) → confirm → page reloaded → all three records equal the backup, the throwaway proposal gone, 2 plan versions present. Invalid file refused earlier. The original pre-test state was then restored | Verified with a programmatic `File` (not an OS picker) in an isolated test state |
| **Saved-version comparison** | New «مقارنة إصدارين محفوظين»: lever values, stored context and **saved** results side by side (tagged «نتائج محفوظة وقت الحفظ»); «إعادة الاحتساب بالبيانات الحالية» recalculates one version's scenario under its own period/scope on today's data and shows it tagged «محسوب الآن» with a match / differs note; only rate and collected are recalculated (the funding balance stays as saved, and says so). Browser: v2 saved with a different lever → comparison highlights the lever and the three results; recalculation reproduced both saved versions exactly | **Split:** the *match* path is verified; the *differs* path (after the data or configuration actually changes) was not exercised in the browser; AC-B2's «reopen reproduces results» is met only through this explicit recalculation |
| **Named side-by-side scenarios** (assessment, not implemented) | Feasible inside the existing Scenarios section without a new page: store `plan.scenarios = [{id, name, levers}]` next to the working scenario, run `runScenario` for each plus the baseline, and render the existing comparison table (≥ 6 outputs and deltas, AC-B6) reusing `VersionCompare`. Needs: schema addition (explicit documented migration), a name field, ≤ 4 scenarios, export of the comparison. Risk: the proposal and approval flow must say which scenario a proposal came from. Nothing blocks it except a decision on how many scenarios to keep and whether an approver must see them | **Open (assessed)** |
| **Interpreter, fresh held-out set** | 65 phrases written **before** looking at how the interpreter handles them (`tests/interpreter-corpus-heldout.mjs`): **first run 55/65 = 84.6 %** (`docs/interpreter-heldout-first-run.txt`). Failures: colloquial «اللي فات», «الأشهر الثلاثة الأخيرة», half-year, «last two weeks», English Amanah names without «Al», **«غير المسددة» read as «collected»**, «جودة بيانات», comparatives, reset wording. Fixed afterwards → 65/65, and the earlier 162 + 47 sets still pass. Combined regression corpus: 274 phrases enforced by `npm test` | The 84.6 % is the independent estimate; the 100 % is a regression guard (same author fixed the failures) |

## Other findings in this round
* The stored action `ACT-MV0XEEXSR21` was found with status `done` (it was `in_progress` in the earlier backup). I did not change it; it was preserved as found.
* `proposed: []` and the first-plan draft are no longer written on load (round 2); backups and restores go through `localBackup.js`.
* Plan names stored earlier («… (مسودة)») and the Chinese author names in old history entries were left untouched (stored data).

## Business decisions still required

| ID | Decision | Recommended | Blocks |
|---|---|---|---|
| EQ2 | Grace period for collection reporting vs enforcement referral (two parameters; both unset — nothing is assumed) | One named parameter per use, values from the official policy | After-grace rates, referral eligibility |
| EQ3 | Treatment of exclusions under unapproved rules | Keep the calculation and show the unapproved-rule band (band shown on operational pages) | Final net-billed treatment |
| EQ4 (rest) | Who approves plans, objectives and actions | Proposer ≠ approver, two configurable roles | Approval records, E2 |
| EQ5 | Official operating-spending coverage definition | The ministry reports' prorated-appropriation basis, payments basis labelled separately | Coverage card/report |
| EQ6 | Fiscal year and target approval | Calendar year; targets stay «غير معتمد» until documented | Objective statuses, D-13 |
| EQ9 | New July report types | Enforcement referral first; the other two need data sources | Three new reports |
| – | Logo, Figma specification, icon licence | Supply official files / confirm Hugeicons licence | Exact identity conformance |
| – | How many named scenarios and whether an approver sees them | ≤ 4 per plan | Named scenarios (B6) |

---

# Round 4 — content, mobile, accessibility evidence, named scenarios, storage, interpreter, closeout

Statuses: **Verified** = observed in the running app against the finding's own criterion · **Implemented, not fully verified** = built and tested at code level but not demonstrated end to end · **Blocked** = needs a named decision or asset · **Not implemented**. Passing `npm test` / `npm run build` / `npm run verify:exports` alone never moves a finding to Verified.

## 1. Content and mobile

| Item | What was done | Evidence | Status |
|---|---|---|---|
| «صافي غير المحصل» | Every display string now says «غير المحصّل» (invoices of the selected period) or «الرصيد القائم» (outstanding balance at a date): metric dictionary, rule registry, analysis tasks, assistant protocol, insights, report model, Metrics page; English «Standing balance». The matching keyword lists of the router (so old phrasings still route) were deliberately kept | `grep` over `src` = 0 display occurrences; a real Smart report and the six KPI help panels read in the browser (definitions say what they count; Escape closes) | **Verified** |
| KPI help panels | Clicked/keyboard-opened for the six KPIs | Text read; `aria-expanded` true; Escape closes | **Verified** |
| Smart Report replies | A real period request, a refinement («أضف تحليل الاستبعادات») and an unresolved period («الربع الحالي حتى اليوم» → one clarification, never a silent default) were run; the quarter-to-date phrase is now understood | Conversation records inspected, test conversations removed by restoring the backup | **Verified** |
| Mobile header | Compact bar (57 px) + labelled three-column tab strip (85 px) instead of 263 px; settings/account behind one toggle (`aria-expanded`); operations menu opens as a full-width list inside the viewport | 390 px: no horizontal overflow on Dashboard, Fixed report, Smart, Planning, invoice drawer; screenshots `before-m1..m3` / `after-m1..m5` | **Verified** (see limitation) |
| Mobile overlays | Invoice drawer body scrolled sideways (long source-table names) → `.btn-wrap` wraps them | `scrollWidth = clientWidth` after the fix | **Verified** |

Mobile limitation (round 4): the planning assistant overlay and the date pickers' native pop-ups were measured, not screenshotted at 390 px — the assistant overlay is screenshotted in round 5 (`after-m9`); native pop-ups still are not.

## 2. Accessibility evidence — reconciliation, not a conformance claim

* «0 axe violations» (round 3) means only that the automatic rules found nothing. It is **not** WCAG conformance and is not claimed as such.
* Target size (WCAG 2.5.8 AA, 24 px) re-measured with a script that also tests the spacing exception, on 12 routes at 1280 px: Dashboard 0, Fixed report 0, Invoices 0, Non-collection 0, Collection 0 (after the fix), Contracts 0, Risk 0, Metrics 0, Planning 0 under 24 px. Remaining undersized controls and their classification: (a) the sentence-level link «مزامنة نطاق المحادثة…» (20 px high, Smart) — **inline-in-text exception**; (b) the visually hidden native file input of «استعادة من ملف…» (1×1) — its visible proxy is the label button (≥ 24 px, same function) and the input now shows its focus on that label; (c) one data-source tag at 23.6 px (sub-pixel). Links that were 18 px (dashboard cross-references, collection → risk) now keep a 24 px target (`.xref`).
* **Keyboard walkthroughs (real key events in the browser pane):**
  (a) Dashboard: Tab order, open filters with Enter, preset activated with Enter (headline 386 → 34 invoices, `aria-pressed`), KPI drill-down link → Invoices (34 rows), row button → drawer, Escape returns focus to the row. **Defect found and fixed:** the drawer (`aria-modal`) did not trap focus — 30 Tabs reached the page behind. A central trap (`src/utils/modalFocus.js`, mounted once in `Layout`) now keeps focus inside the topmost modal; re-tested with 45 Tabs and Shift+Tab.
  (b) Fixed report: card → report with Enter. **Defect:** focus fell to `<body>` (the card disappeared). Now moves to the report heading (not on first load). Export Excel/Word with Enter works (48 KB / 11 KB blobs); **defect:** the pressed button was disabled during export and dropped focus → `aria-disabled` instead; a polite status line now says the file was created. Same pattern applied to Planning and Smart exports.
  (c) Smart Report: request typed and sent with Enter, refinement typed and sent; focus stays in the composer; reply recorded (the section list changed as asked).
  (d) Plan: edit name (Enter on the disclosure, Tab, type), save as a new version, reload (reopen), compare v2 with v1 (lever and result rows highlighted).
  (e) Proposal: «إجراء يدوي» → fields → «إضافة كمقترح» (proposal, not an action) → «مراجعة واعتماد…» → owner → approve; **defects:** focus was lost after add / open review / approve → each now moves to a stable target (toggle, first field, register heading).
  **Not verifiable here:** choosing a value in a native `<select>` by keyboard (the pane's synthetic keys do not drive the OS list) and typing into native `<input type="date">` segments; both are standard browser controls. Date handling logic was exercised programmatically (below).
* **Screen readers:** still **not performed** (no NVDA/JAWS/VoiceOver/TalkBack). Live-region behaviour and Arabic announcement order remain **explicitly open**.
* New: after the route changes, focus stays on `<body>` (skip link available); not changed — recorded as an improvement.

## 3. Planning — named scenarios (approved: up to four per plan)

Implemented inside the existing Scenarios section (no new page): `src/data/namedScenarios.js` (pure functions) + `NamedScenarios.jsx`. Stored under `scenarios[planId]` in `ib_plans_v1`, **separate** from the plan, its versions and its status. Operations: save the editor values under a name (unique per plan, ≤ 60 characters, levers clamped to their limits), rename, duplicate, update from the editor, delete with an inline confirmation (Escape cancels, focus returns), and a side-by-side comparison (baseline actual, every saved scenario, the unsaved editor) with levers changed, net billed, collected, uncollected, rate, difference vs baseline and the remaining gap to the unapproved demo target. Every scenario carries «سيناريو — غير معتمد»; messages say that saving/editing/deleting changes neither the plan nor its saved versions.
Verification: unit test (limit, duplicate names, clamping, plan untouched, backup shape validated — `bad_scenarios` refused); browser: saved from an unchanged editor on an **approved** plan → plan stayed approved, 1 version, history unchanged; 3 scenarios created, renamed and duplicated by keyboard, limit message at 4, delete confirmation, restored to the backup afterwards. The backup summary now counts scenarios. «Load in the editor» is the only action that edits the plan (an approved plan returns to draft by the existing rule, and the message says so).
**Saved vs recalculated differs:** shown as a table (saved · recalculated now · difference) under the version comparison, never overwriting the saved version. Tested with isolated synthetic data (saved rate 50.0 % / collected 1 bn written into a backed-up test state): recalculated 60.9 % / 8.24 bn, **+10.9 pp / +7.24 bn**, rows highlighted, note «the saved version is unchanged»; stored summary still the synthetic value afterwards. **Verified.**

## 4. Storage and backup

* **ACT-MV0XEEXSR21** (not reverted). Its own history: created from a proposal 2026-10-09 12:12:42Z and moved to `in_progress` 12:12:51Z, each recorded under «李芳军» (the demo account's Chinese display name; the interface language was Chinese then), then `in_progress → done` at **2026-10-09 20:44:08Z recorded under «طارق»** (the same demo account's Arabic display name — the recorded name follows the interface language, see `actor.js`). **What the record establishes:** a timestamp and the demo-account identity. **What it does not establish:** that a person pressed the button, which person, or by what method (interface, script or injected event). **Actor and method are unverified.** (*Correction, round 5:* round 4 wrote that this was a manual interaction; that inference is withdrawn.) Left as found.
* App-level checks (built and observed earlier): backup export contents byte-equal to storage; import validation, replace confirmation with counts, reload, state equal to the backup (programmatic `File`).
* **Real user journey (OS download + file chooser): NOT verified.** Claude in Chrome was not connected in this environment (no connected browser), so a real Chrome profile could not be used; the limitation stays. What remains unproven: the browser's actual file save, the OS file picker, and Safari/Firefox behaviour.

## 5. Interpreter (F-05)

| Run | Set | Result | Notes |
|---|---|---|---|
| Round 3 first run | held-out 1 (65) | 55/65 = 84.6 % | fixed afterwards |
| Round 4 first run | **held-out 2 (72)**, written before tuning | **55/72 = 76.4 %** — correct reading 39, appropriate clarification 16, over-clarification 2, **unsafe silent misread 15** | recorded in `docs/interpreter-heldout2-first-run.txt` before any change |
| After tuning on set 2 | same 72 | 72/72 | **regression only — not independent accuracy** |
| Round 4 fresh set 3 (64), written **after** the tuning, first run | **59/64 = 92.2 %** (60/64 = 93.8 % if one expectation typo of mine is corrected) — correct 38, appropriate clarification 21, over-clarification 1, **unsafe silent misread 4** | `docs/interpreter-heldout3-first-run.txt` | below the 95 % target |
| After fixing set 3's genuine failures | same 64 | 64/64 | regression only |

Tuned (general rules, not phrase patches): «منذ أول يناير / since January 1»; «… للعام الماضي»; day ranges «من 1 مارس إلى 15 مارس»; Hijri months, seasons, half-years and «tomorrow / day after tomorrow» → one clarification; unknown Amanah names («أمانة دبي», «Dubai Amanah») → clarification; «العاصمة المقدسة», «مكة؟», «للقصيم» (ل + ال), «Eastern»; several Amanahs joined by «and / و / مقابل / or»; «المسددة جزئياً» → partial; «ارتفع التحصيل عن …» → comparison; «قارن أغسطس بيوليو» → August vs the month before; two periods named together → clarification; «remove the Amanah / source / status / municipality filter»; «الربع الحالي حتى اليوم». The regression corpus is now 274 + 72 + 64 phrases and is **not independent accuracy**. **F-05 stays partial**: both fresh first runs are below 95 %, and the unsafe-silent-misread class is non-zero on the latest fresh set.

## 6. Closeout of untouched findings

| Finding | Result | Status |
|---|---|---|
| D-15 typed range applied on every keystroke | The range is checked and applied when typing pauses (0.9 s), on Enter or on blur | Verified with simulated rapid input events (0002→0020→0202→2026: no message, no apply mid-typing; applied after the pause). **Typing into native date segments** could not be driven in this pane |
| F-30 `window.prompt` | None left in `src` (only a comment) | Verified by search |
| F-31 login behind the data loader | `RevenueProvider` does not request data or show the loader before sign-in; one stable provider shape | Verified: login page renders immediately, sign-out/in without console errors |
| F-26 objective status rule | A «كيف تُحسب الحالة؟» disclosure states the 100 % / 90 % rule, inversion for lower-is-better, ±10 % for budget execution, and that status ≠ approved target | Verified (disclosure rendered and read in the browser; wording matches `objectiveProgress`) |
| F-25 order of empty state / comparison note | The «no equivalent comparison» note is shown only when there are invoices | Implemented, not browser-verified |
| F-20 settings differ from defaults | A tag «إعدادات الاحتساب معدّلة عن الافتراضي» + link next to the filter chips | Verified (absent by default; present with grace days 5; state restored) |
| F-21 KPI strip on budget / quality reports | Budget-only and quality-only reports no longer start with the billing KPI strip (screen and exports share the model) | Verified on the screen (no tiles) and by `verify:exports` (docx 4783/4783, pptx 4783/4783, xlsx 2226/2226, 100 % items) |
| F-22 identical municipality labels | *Round-4 conclusion withdrawn:* I had checked the catalogue labels, not the table the finding is about. Round 5 reproduced it (three rows «بلا بلدية — غير محدد الأمانة…» in the by-municipality table) and fixed it | See round 5 |
| F-28 orphan modules | 18 modules unreachable from the app entry, tests, scripts and server (old Planning-Room/CFO charts, province map, unpaid-report helper, …) removed; tests and build pass | Verified by import-graph + `npm test` + `npm run build` |
| F-16 (d), (g) conversation title, draft persistence | – | **Not implemented** |
| D-13 fiscal year | Needs the fiscal-year definition | **Blocked (EQ6)** |
| G-01 logo, Figma, icon licence | Needs official assets | **Blocked (assets)** |

## 7. Final status

| Verified and closed | Implemented but not fully verified | Blocked by a decision or asset | Not yet implemented |
|---|---|---|---|
| «الرصيد القائم» wording; KPI help; mobile header/tabs/overlay overflow; keyboard walkthroughs (a)–(e) with the five defects they found; focus trap; 24 px targets (exceptions documented); named scenarios; saved-vs-recalculated table; D-15 (simulated input); F-20, F-21, F-26, F-30, F-31, F-28; F-22 (not reproducible); ACT history explanation (who pressed it: unknown) | F-25 order; quarter-to-date phrase in Smart (unit-tested, not re-run in the UI after the change); mobile screens beyond the five photographed; F-05 interpreter (**partial**: fresh first runs 76.4 % and 92.2 %); backup/restore with a real OS download and file chooser | EQ2 grace periods (collection reporting vs enforcement referral stay separate and unset); EQ3 exclusion treatment; EQ4 approval authority; EQ5 coverage definition; EQ6 fiscal year/target approval (D-13); EQ9 new July reports; logo, Figma and icon licence (G-01…); screen-reader testing needs the assistive technologies | F-16 (d), (g); focus placement after route changes; a second held-out set after any further interpreter change; F-18/F-19/F-23/F-24/F-27/F-29 (listed in earlier rounds, not worked in this one) |

## 8. Before / after evidence of the main journeys

Desktop: `before-1…5` ↔ `after-1…4`, `after-6-invoices` (there is **no `after-5`**: the invoices pair is `before-5-invoices` ↔ `after-6-invoices`), plus `after-7-version-compare`, `after-8-recalculated-differs`, `after-9-named-scenarios`. Mobile: `before-m1-dashboard`, `before-m2-planning`, `before-m3-smart` ↔ `after-m1-dashboard`, `after-m1b-filters`, `after-m2-planning`, `after-m3-smart`, `after-m4-fixed-report`, `after-m5-scenarios`. **Missing:** mobile before/after of Invoices, the invoice drawer, the planning assistant overlay and the version comparison; desktop `after-1…4` pre-date this round's small changes (re-take if needed).

## 9. Remaining release limitations

Synthetic data only (no real ministry figures); data kept in one browser (backup is manual); the interpreter is rule-based and below its accuracy target; no screen-reader or real cross-browser verification; native select/date keyboard entry not driven in the test pane; grace periods, exclusion treatment, approval authority, official coverage definition, fiscal year/targets and new report scope all still pending decisions; no Figma-exact or logo claim.


---

# Round 5 — safe Smart Report behaviour and remaining journey defects

## 1. Smart Reports: interpretation summary and "ask before generating"

**Built (src/data/requestGuard.js, src/data/reportIntents.js, src/pages/SmartReports.jsx):**
* A compact **«كيف فهمتُ طلبك»** card on every report reply with the six deciding items — reporting period · Amanah/municipality · revenue source · invoice status · comparison period · reporting basis — each tagged «من طلبك» / «كما كان» (kept from the conversation) / «الافتراضي». It states what **was applied**, never that the request was applied in full. «تعديل» opens the filter panel inside the card (period presets and typed dates, Amanah, municipality, source, status, comparison); applying it regenerates the report. Exports carry the same context (a «no comparison» row was added so the comparison is always stated).
* **Parts that cannot be applied are asked about before anything is generated:** top-N rankings, grouping/sorting by an unsupported field, amount/count thresholds, currencies other than SAR, named payers/entities/districts, «excluding …», forecasts, partial periods («end of last year»), weeks/days/«n years ago», weekdays — and any **unknown word** standing where a qualifier would (after «report / for / about / عن / في / على» or glued «ل/ب»). The reply names what could not be applied and offers «تابع بدونه» (a real request built from the user's own words minus that part). **Actions outside reporting** (send, translate, schedule, print) are declined with the way to export instead. The same code path serves first requests and **follow-ups**; the edit panel only produces supported values.
* The conversational thread, composer, suggestions and follow-up chips are unchanged.

**Evidence — reported separately; unsafe silent misreads are not mixed with correct clarifications.** «Unsafe silent misread» = a report/answer produced with a scope the user did not ask for, or an answer where a question was right.

| Run (first run on the interpreter as it stood, before any change for that set) | Phrases | Correct reading | Appropriate clarification / refusal | Over-clarification | **Unsafe silent misread** | Score |
|---|---|---|---|---|---|---|
| Round 4, set 2 | 72 | 39 | 16 | 2 | **15** | 76.4 % |
| Round 4, set 3 (after set-2 tuning) | 64 | 38 | 21 | 1 | **4** (1 is my expectation typo) | 92.2 % |
| **Round 5, set 4** — written *before* the guards, emphasises unsupported qualifiers | 64 | 23 | 22 | 0 | **19** | **70.3 %** (45/64) |
| **Round 5, set 5** — written *after* the guards, never run before | 63 | 25 | 35 | 1 | **2** | **95.2 %** (60/63; Wilson 95 % interval ≈ 87–98 %) |

* Sets 4 and 5 failures: set 4 — 19 requests whose extra part was dropped silently («أكبر 10 دافعين», «in euros», «above 500000», «excluding Riyadh», «حي الملقا», «send by email», …) plus a hamza-folding failure on «الإحساء»; set 5 — a weekday («يوم الخميس») ignored and «Hail» not recognised as Ha'il (2 of 3 Amanahs applied), plus one over-clarification («year so far»).
* After each record the genuine failures were fixed and the set became a **regression** set (all passing: 64/64 and 63/63). **Passing the regression sets is not accuracy evidence.** The regression corpus is now 274 + 72 + 64 + 64 + 63 phrases, all by one author.
* **What can and cannot be claimed:** the latest fresh set shows 95.2 % with 2 unsafe silent misreads out of 63 (3.2 %) — one author, 63 phrases, a wide interval. The interpreter is **rule-based**, not a language model; this is **not evidence of reliable language understanding**, the unsafe-silent-misread class is **not zero**, and **F-05 stays partial**. Expect false clarifications (a vocabulary gap makes the system ask) — the deliberate trade-off against silent errors.
* A corpus expectation was changed: «أريد تقريراً عن أكبر 5 بلديات» used to be expected as a plain report (the «top 5» was silently dropped); it now expects a clarification.

## 2. Independent journey fixes

| Finding | Result | Status |
|---|---|---|
| **F-16(d)** conversation title | Named after its first report (title · period · Amanah · source); renaming in History (✎, Enter/Escape, focus returns); a user name is never overwritten | Verified in the browser |
| **F-16(g)** unsent draft | Kept per conversation in `sessionStorage` (written only when the user types; cleared on send; nothing written on load) | Verified (typed, navigated away and back: restored; cleared after send). Not kept across a browser restart (session scope — a stated choice) |
| Focus after route changes | After a route change focus moves to the new page's `h1` (not on first load, not for query-only changes); no ring on the heading | Verified with keyboard navigation (Planning ↔ Dashboard) |
| **F-25** empty-state order | The «no equivalent comparison» note is shown only when there are invoices | **Verified** (Today + Jazan + tobacco selection: only «no invoices — data unavailable, not zero») |
| Quarter-to-date request | «الربع الحالي حتى اليوم» / «this quarter» → quarter start → today | **Verified** in Smart (1–10 Oct 2026, tagged «من طلبك») |
| **Typed date ranges** (D-15) | Checked/applied when typing pauses, on Enter or blur; a partly typed year (0002, 0202, < 1900) or an empty field is **incomplete**: nothing is applied and the message says the filter is not applied until the date is complete | Logic unit-tested; applied/not-applied behaviour verified with rapid input events; native segment typing not driven (below) |
| **F-18** navigation/chrome | Three-tab navigation + compact phone header (round 4); the Arabic-only tab hints are gone; brand/title unchanged (product name kept by decision) | Verified |
| **F-19** split persistence | Not changed: needs a server-side store (production dependency). Backup/restore remains the mitigation; plan versions store their context | **Blocked (infrastructure)** |
| **F-21** duplication | Two planning-assistant entries → one (the floating button, placed early in the DOM; focus returns to it on close) | Verified (one button; open/Escape/focus return) |
| **F-22** identical municipality rows | Reproduced (three rows «بلا بلدية — غير محدد الأمانة…» at 55 rows) → one group per entity without a municipality (53 rows, no duplicates); groups still add up to the total | **Verified** (browser + test). Round-4 «not reproducible» withdrawn |
| **F-23** mixed bases on one planning page | Each basis is labelled; the **bridge between them is not shown** | **Not implemented** (needs a reconciliation design) |
| **F-24** scenarios cannot be compared | Named scenarios + comparison (round 4) | Verified (round 4) |
| **F-27** language | Raw-key leaks spot-checked clean (plan scope, Smart chips); `zh` still falls back to English in the new areas | Raw keys: spot-checked; zh: **Not implemented** |
| **F-29** anchors under the sticky header | Heading top at 136 px, sticky bar ends at 85 px | **Verified** (DOM measurement) |
| Mobile | Floating assistant button no longer covers the last lines of a page; the recalculated-figures panel fits the card (was 848 px in a 324 px card) | Verified (screenshots `after-m6`, `after-m10`) |

Also seen once and **not reproduced** in three repeats: a full-page navigation to `/invoices` that landed on `/insights`. Cause unknown (dev-server reload suspected, not shown).

## 3. Named scenarios — separate history

Every create / rename / duplicate / update-from-editor / delete / load-in-editor is recorded in `scenarioLog[planId]` (newest first, ≤ 200), shown under «سجل السيناريوهات — منفصل عن سجل الخطة». It never writes into the plan's content, history, versions or status (unit test: the plan JSON is byte-identical after all operations, history length unchanged); the backup validates its shape. **Verified** in the browser: creating a scenario left the plan history at «created» only. (Loading a scenario into the editor remains the one action that edits the plan, by the existing return-to-draft rule.)

## 4. Evidence corrections

* **ACT-MV0XEEXSR21**: the record establishes a timestamp and the demo-account identity; it does not prove manual use or the person responsible. **Actor and method: unverified** (round-4 text corrected above).
* **F-22**: «not reproduced in the tested scope» applies only to the **catalogue labels** I checked in round 4 (all unique); the finding itself (the report table) **was** reproduced and is now fixed.
* At the start of this round the browser pane's local storage was **empty** (no plans, actions or conversations, and no earlier backups): the action record above is therefore not present in this pane. I did not clear it; the cause is unknown. All round-5 test data created in the pane was removed at the end.

## 5. Final verification — native controls

* **Exercised with tooling:** native `<select>` values (Amanah, status, comparison) and a native `<input type="date">` were set through the browser tool's form input — the app handlers received the changes (the edit panel regenerated the report with Riyadh, overdue, comparison with last year and the typed period); the filter-pressing, Enter/Space and Tab behaviour of all other controls was exercised with real key events.
* **Not verified (exact interactions):** (1) choosing an option in a native select with the keyboard through the operating-system list (Arrow/Enter/type-ahead): synthetic keys did not drive it; (2) typing digits into the day/month/year segments of a native date input: the value did not change under synthetic typing; (3) the OS file chooser and the actual file save for backup/restore (Claude in Chrome was not connected); (4) screen readers.

## 6. Visual evidence added (no historical «before» recreated)

New «after» screenshots only: `after-m6-invoices`, `after-m6a-invoices-fab-overlap-found` (a defect found, kept for the record), `after-m7-smart-clarification`, `after-m7a-invoice-drawer`, `after-m8-smart-interpretation-summary`, `after-m9-planning-assistant`, `after-m10-version-recalculated-differs` (synthetic data). **Still missing:** matching mobile «before» shots for Invoices, the invoice drawer, the assistant overlay and the version comparison (they cannot be recreated honestly after the changes), and desktop shots of this round (the desktop pane rendered a narrow layout during capture and was not used). `after-1…4` pre-date round 4–5 changes.

## 7. Readiness assessment

**Ready for demo (as a clearly labelled synthetic-data demo):** the two management areas (Dashboard/Reports/Smart reports, Planning), shared metric layer with the approved identities, period-end headline with a separate «to date» figure, fixed reports with Word/Excel/PowerPoint exports whose content matches the screen (parity check 100 %), Smart reports that show how each request was read, ask before dropping anything they cannot apply, and decline actions, named scenarios kept apart from approved plans, proposal-first action register, local backup/restore, Arabic RTL with a compact phone layout, keyboard operation of the main journeys (automatic axe checks clean on the pages tested).

**Remaining demo limitations:** synthetic data only; the interpreter is rule-based and will sometimes ask when it need not, and may still misread (unsafe-silent-misread class not zero); data kept in one browser (manual backup); no screen-reader, real cross-browser, real OS download/file-chooser or native-popup keyboard verification; `zh` falls back to English in the newer areas; F-23 bridge between mixed bases not shown; no accessibility **conformance** claim (clean axe ≠ conformance).

**Production dependencies:** server-side store with identity, roles and audit for plans, scenarios, actions and conversations (F-19); real approval workflow and authenticated actor identity (the recorded name today is a display name by interface language); real data connections and the data-quality gaps listed in the evidence notes (e.g. missing invoice numbers on enforcement orders, unconnected collection platform); formal accessibility audit with assistive technologies; a language model — or a documented rule set with owner and test process — if free-form understanding beyond the supported wording is required; browser/device support matrix.

**Unresolved business decisions:** EQ2 grace periods (collection reporting vs enforcement referral, both unset); EQ3 treatment of exclusions under unapproved rules; EQ4 approval authority; EQ5 official operating-spending coverage definition; EQ6 fiscal year and target approval (D-13); EQ9 new July reports (enforcement referral first; income participation and e-invoice need data sources); logo, Figma specification and icon licence.

**Not claimed:** audit closure, accessibility conformance, or reliable AI understanding beyond the evidence above.


---

# Round 6 — demo stabilization (release candidate)

No new features and no redesign: one explanation block, one confirmation step, accuracy of the language notice, and a verification pass that found and fixed four real defects. Audit partial statuses are preserved (see §8).

## 1. F-23 — reconciling the figures used in Planning

* **Built:** «ما الذي يقيسه كل رقم؟» under the baseline card (`BasesReconciliation.jsx`): for each figure — collected (baseline), receipts since the start of the year, forecast of the rest of the year, scenario effect, expenditure coverage — its **period and scope**, **basis** (invoice basis vs payment-date basis), **kind** (actual / forecast / scenario / synthetic), and **data cut-off**; then an **exact bridge** from «collected on the plan period's invoices» to «receipts by payment date», and a list of what is deliberately **not** added together.
* **Why the two actuals differ, with numbers (reference date 2026-10-09, all Amanahs, all sources):** collected 7.83 bn (payments on invoices *issued* in the plan period) + measurement difference +50 thousand (one invoice paid 50,000 above its net; «collected» is capped at the invoice net) = received on the period's invoices 7.83 bn; + received on invoices issued **outside** the plan period 580.82 million (older invoices) = receipts by payment date 8.41 bn. The bridge is computed, not narrated: a small, tested option in the data service splits the same payment window by the invoice's issue date (`issuedFrom/issuedTo`; unit test: exact for a closed period, within the cap for open periods, three scopes). When the plan period is not inside the fiscal year, no bridge is computed and the block says so.
* **Not combined:** the forecast is not added to collected; the scenario effect (invoice basis) is not receipts; the target is a reference; expenditure coverage stays on synthetic data and its **official definition (EQ5) is neither invented nor assumed** — the block says it is pending.
* **(Superseded in Round 7 — the combination was removed; see below.)** Previously the funding outlook placed the scenario's collection effect (invoice basis) beside the projected receipts (payment-date basis). That is not reconciled; a note now appears beside the table whenever a scenario is active, linking to the block.
* **Status:** the explanation and bridge are **Verified** (browser, mobile and desktop widths, axe-clean after a heading fix); F-23 as originally written («the bridge between them is not shown») is closed, but a compatible funding view with the scenario depends on undefined conversions — partial (Round 7).

## 2. Transient `/invoices` → `/insights` navigation

* **Code review:** the only unconditional redirects are `*` → `/`, `/` → `/insights`, the legacy aliases, `ProtectedRoute` → `/login`, `Login` → `/insights` after sign-in, and the sign-out navigation. The page `/invoices` has no redirect of its own. **One latent defect found:** `Login` scheduled its post-sign-in navigation with a bare `setTimeout` (650 ms) that was never cancelled, so a sign-in followed quickly by a different navigation could be overridden. That is now cleared on unmount.
* **Evidence:** the single observation (round 5) is not explained by that timer (the sign-in had happened long before). It was **not reproduced** in 4 cold navigations to `/invoices` in this round (after Smart, after Planning, directly, and a deep link with `?id=`), nor in the 3 repeats of round 5 — 7 attempts in all.
* **Status:** **unreproduced observation retained**; the latent timer defect is fixed; no claim that the cause was found.

## 3. Language availability

Arabic and English are the authored languages. The Chinese dictionary covers 851 of 866 keys, but the current screens (navigation, pages, reports) are written with inline Arabic/English text and fall back to English. A visible bilingual notice now appears on every page when Chinese is selected («Chinese translation is incomplete … shown in English»), the Chinese selector says «incomplete» in a tooltip (also on the sign-in page), and the English fallback content is marked `lang="en"` for assistive technology. Chinese selection is **not** disabled; nothing implies a full translation. Verified in the browser (notice, `lang` attributes, selector title).

## 4. Confirmation of the interpreted scope (demo safety)

* **Categories** (from the fresh-run evidence): several Amanahs in one request; an Amanah name written in a variant or short form; a period written in a non-standard way (day ranges, «since…», «last year», «so far»); a comparison inferred from the wording; several changes in one follow-up. For these the Smart Report reply is **a confirmation card**, not a report: «قبل أن أُعدّ التقرير: هل هذا ما قصدته؟», the reason, the editable summary (the same filter panel), and **Confirm and build / Cancel**. Nothing is generated until the user confirms (or edits and applies, which counts as the user's own choice). A newer request supersedes a pending one. Standard requests (a single exact Amanah, standard period words, the follow-up chips) go straight through with the summary.
* **Evidence (set 6, 42 phrases written before the step, first run on the interpreter as it stood after round 5):** 32/42 = 76.2 % — correct 29, appropriate clarification 3, over-clarification 6, **unsafe silent misread 4**. After fixing the genuine failures and adding the step: 39/42, 0 unsafe silent misreads, 3 safe over-clarifications — **regression only**. Confirmation burden: 23/42 on set 6 (built from the risky categories), 8–22 % on sets 2–5.
* **What is and is not claimed:** the step catches the categories seen so far; a misreading outside them can still pass silently — **F-05 stays partial** and nothing here is evidence of reliable language understanding.
* **Verified in the browser (reference date 2026-10-09):** «تقرير الرياض وجدة ومكة هذا الشهر» → confirmation card (reasons: several Amanahs; a variant name) → no report in the thread, nothing stored → confirm with the keyboard → report; follow-up chip «قارن بالشهر الماضي» (no confirmation) keeps the three Amanahs and adds the comparison; edit → status «متأخرة» keeps the three Amanahs; mobile screenshot `after-m11`.

## 5. Final verification of the release candidate (isolated profile, reference date)

**Isolated profile.** Browser origin `http://127.0.0.1:3000` (a different origin from `http://localhost:3000`, so a separate local/session storage). **Start state:** localStorage empty; sessionStorage empty except the app's own session defaults and `ib_demo_today=2026-10-09` (set by `?demoToday=`). **End state:** after the checks the origin held one test conversation and one test plan (`ib_smart_convs_v1`, `ib_plans_v1`) and a session; I then cleared that origin (it was created for this test) and closed the emulation. **Not touched:** the `localhost:3000` origin — at the end I only listed its keys and found one Smart conversation and a signed-in session that I did not create in this round (I had left that origin empty at the end of round 5); they are untouched. Test sign-in used the project's seeded demo account.

**Journeys at the fixed reference date 2026-10-09 (Asia/Riyadh):**
| Journey | Result |
|---|---|
| Dashboard → fixed report → export | Dashboard: 386 invoices, gross 14.92 bn, exclusions 1.36 bn, net 13.56 bn, collected 7.83 bn, uncollected 5.72 bn, rate 57.8 %, comparison period «1 Jan – 9 Oct 2025». The fixed monthly report shows the same figures and period; Excel export with the keyboard produced a 279 KB file and the status line «تم إنشاء ملف Excel…». |
| Smart Report → follow-up → scope edit → export | Confirmation → report → follow-up (comparison) → scope edit (status, then period) → Excel export (36 KB). **Defects found here and fixed:** (1) a status-filtered report (overdue/partial/not due…) failed reconciliation («analysis_failed») because the net-uncollected bridge ignored the status filter — fixed in the data service, test for all eight statuses; (2) editing any filter of a multi-Amanah request silently reset the Amanah to «all» — the panel now keeps the list; (3) the report subtitle printed raw Amanah keys («Riyadh Amanah,Jeddah Amanah…») — now names; (4) a stale period label («هذا الشهر حتى اليوم») for a year range — now derived from the dates. |
| Planning → named scenario → saved-version comparison | Baseline equals the dashboard; reconciliation shown; scenario «تحسن أربع نقاط» saved without touching the plan; version saved; recalculated on current data: 61.8 % / 8.38 bn matches the saved version. |
| Invoice drill-down → return with filters | Dashboard last month + Riyadh (6 invoices) → drill-down link → Invoices shows the same 6 with the same scope → drawer opens/closes with focus returned to the row → browser back → Dashboard keeps scope and the 6 invoices. |

**Date coverage, presets and rollover (preset ranges checked against independent expected ranges for all seven presets):** 2026-09-30, 2026-10-01 (month rollover), 2026-12-31, 2027-01-01 (year rollover): 0 mismatches. At each date the coverage line, the headline («… المحصّل حتى <date>») and the KPI strip follow the date (377 invoices / 14.59 bn at both 09-30 and 10-01; 481 / 18.53 bn at 12-31; 4 / 392.32 m at 01-01), «last 3 months» is three complete months, «quarter to date» starts at the quarter start. **Midnight in real mode:** with `Date` stubbed to 00:00:30 Riyadh on the next day, the notice «تغيّر التاريخ منذ فتح الصفحة؛ الأرقام تخص اليوم السابق» with «تحديث الآن» appears (the page was loaded unshifted; the full-page refresh itself was not waited out).

**Automated checks:** `npm test` 84 passed (interpreter regression sets are NOT accuracy evidence); `npm run build` ok; `npm run verify:exports` docx 4735/4735 table cells, pptx 4735/4735, xlsx 2196/2196 exact amounts, 1399/1399 items in each format (100 %); `npm start` smoke (`/`, `/invoices`, `/api/meta` → 200); axe (WCAG 2 A/AA/2.1/2.2 AA + best practice) 0 violations on Smart (with the confirmation card) and Planning (after a heading-order fix) — **automated rules only, not conformance**.

## 6. Visual evidence added
`after-m11-smart-confirmation`, `after-m12-planning-reconciliation` (mobile). Not recreated: any «before».

## 7. Known limitations (unchanged unless stated)
Synthetic data; data kept in one browser; rule-based interpreter that asks more than it should and can still misread outside the confirmed categories; no screen-reader / real OS download or file-chooser / native-popup keyboard verification; Chinese is incomplete (now stated on screen); the funding side-by-side is an approximation (stated); desktop screenshots of this round were not captured (the pane rendered narrow); a session-scoped filter/config store is written when the app loads (before sign-in) — it holds only defaults until the user acts.

## 8. Audit statuses preserved
F-05 **partial**; F-19 **blocked (server store)**; F-23 **explanation closed, funding approximation partial**; F-27 **partial (zh incomplete, now disclosed)**; D-13 **blocked (EQ6)**; G-01 and exact-identity items **blocked (assets)**; screen-reader verification **open**. Unresolved business decisions: EQ2, EQ3, EQ4, EQ5 (coverage definition — not assumed), EQ6, EQ9, logo/Figma/icon licence.


---

# Round 7 — final targeted correction (scope frozen)

**Funding table.** The scenario's collection effect is measured on the plan period's **invoices**; projected receipts are **cash by payment date**. They are different measures, so they are no longer combined:
* the funding outlook shows **only the baseline** (actual receipts to date + forecast of the rest − payments; cash by payment date on both sides, synthetic payments) — the baseline does not move when a scenario is set (checked: 9.9 / 22.3 / −12.4 bn before and after a +5-point scenario);
* the scenario's effects appear **beside it, separately and labelled «سيناريو — غير معتمد»** («effect on collected: +0.68 bn, invoice basis, plan period»; the part that arrives after the planning date; the change in remaining payments), with the sentence that **there is no scenario funding balance** because the conversion from «collected» to «receipts» is not defined;
* `financeProjection` no longer returns scenario receipts, payments or balance (`scenarioEffects` instead); the plan-summary export (Word/Excel/PowerPoint) follows the same structure (baseline table + separate scenario-effects table, no combined total); a saved version stores the **baseline** funding balance (`balanceBasis: baseline`) and the comparison says that versions saved earlier may include the scenario effect (stored data was not rewritten).
* **Reconciliation bridge preserved** and extended with a plain definition: «collected» = paid up to the invoice net (capped); «received» = total cash by payment date, **including payments above an invoice's net** and payments on invoices outside the period (the bridge shows the one overpayment: +50 thousand).
* **F-23 stays partial.** The explanation and the bridge are done; a compatible funding view that includes the scenario would need a defined conversion from invoice-basis collections to payment-date receipts (timing/collection-curve definition) and the unresolved coverage definition (EQ5) — neither is assumed.

**Demo-only date override.** `?demoToday=` is documented in code and handover as demo/review only; while it is active every page shows a banner («وضع العرض: التاريخ مثبّت على … للعرض والمراجعة فقط») with an «unpin» link.

**Smart Reports for the demo.** The page now states, in bold next to the request box, that the assistant works with fixed rules, not a language model, and to check «How I read your request» before relying on a result; the supported prompts are listed in the handover.

**Verification (isolated origin `127.0.0.1:3000`; start: localStorage empty, session = demo date + sign-in; end: one test plan in localStorage, then cleared — the origin is my own test origin).** `npm test` 84 passed (the funding test now asserts no scenario figure and an unchanged baseline); `verify:exports` 100 % (the parity script now includes a funding table with an active scenario: docx/pptx tables 4744/4744, xlsx amounts 2202/2202, 1408/1408 items in each format); Planning in the browser: baseline unchanged under a scenario, effects separate, plan Excel export (79 KB), banner shown. **The `localhost:3000` profile was not touched** (it still holds the one Smart conversation I did not create).


---

# Round 8 — business correction: enforcement orders and invoice matching (branch `enforcement-order-matching`)

Full description, impact review and verification: `docs/enforcement-order-matching.md`.

**Finding E-01 — enforcement orders were modelled only at contract level; matching used amount + Amanah and simulated document text (fixed in this branch).** Orders from Sanad can cover one or several invoices of any type. Now: orders over all invoice types in the synthetic feed (labelled demo data); reference-only matching (invoice number, serial, SADAD, violation number) against the invoices; the order PDF is added by hand (Sanad retrieval is **not connected**) and its **text layer** is really read (every page, tables included) — **no OCR engine is connected**, so unread pages are flagged and block «fully matched» until external OCR text or typed references are supplied (recorded as such); an amount never creates a match; discrepancies stay visible; ambiguous / duplicate / conflicting references are shown for a person to decide; only a **confirmed** link reflects the order's status on an invoice and the payment status stays separate; partial matches stay partial; history is kept.

**Behaviour changes to be aware of:** (1) a proposed link no longer moves an invoice to «linkage unresolved»; (2) a confirmed link to a **closed** order no longer puts the invoice in «Referred to enforcement» (assumption — flagged for confirmation; demo effect: 4 → 3 invoices, net uncollected unchanged); (3) the old amount/Amanah candidate finder and its analysis task were removed.

**Status:** E-01 **fixed for the demo scope**; **dependencies open** — live Sanad retrieval, Sanad PDF retrieval, an OCR service, Arabic-PDF text verification, server-side store with identity/audit (F-19). Tests 84 → 93; exports 100 %.

**Audit statuses preserved:** F-05 partial; F-19 blocked (server store); F-23 explanation closed / funding approximation partial; F-27 partial; D-13 blocked (EQ6); G-01 blocked (assets); screen-reader verification open. EQ2, EQ3, EQ4, EQ5, EQ6, EQ9 and the logo / Figma / icon-licence decisions remain unresolved and are not inferred.


---

# Round 9 — full-page records and enforcement corrections (branch `enforcement-order-matching`)

Full description, drawer-to-page mapping, verification: `docs/full-page-records.md`; OCR assessment: `docs/ocr-integration-assessment.md`.

**E-02 — long detail drawers (fixed).** The invoice drawer, the stacked AI run-trace drawer (a fixture trace unrelated to generated records), the inline contract panel and the analysis-result drawer are replaced by directly addressable full pages (`/invoices/:id`, `/contracts/:no`, `/enforcement-orders/:n`, `/analysis/:id`) on one shared layout with breadcrumbs, a contextual return, three separate status groups, an essential-figures strip, findings that need action and folded secondary detail. Lists restore filters, sorting, page and scroll on return. No two competing detail experiences remain.

**E-03 — enforcement status conflated referral, current enforcement and closure (fixed).** One relationship/status model (`src/data/relations.js`): historical referral, current enforcement, each order's status (+ closure reason or «unknown»), payment status — kept apart; closing/withdrawing one order never removes another confirmed order's effect; the data service returns explicit unique-invoice counts (open vs ever referred). **Policy assumptions to confirm:** suspended counts as open; a closed order keeps «ever referred» but not the category.

**E-04 — one «Fully matched» label and reason-based conflict approval (fixed).** Reference matching, document extraction and financial reconciliation are shown separately; hard conflicts are resolved only by evidence (never by a typed reason); duplicates merge evidence and count an invoice amount once.

**E-05 — PDF files not in backups (clarified, handled).** Stated in the backup panel and on every affected order; after a restore documents are reported as unavailable, provenance and links survive, and re-association checks the SHA-256.

**Open dependencies (original requirement NOT fully delivered):** live Sanad retrieval; Sanad PDF retrieval; **real OCR** — none connected; an exploratory macOS Vision probe on ONE synthetic Arabic page (not an accuracy assessment, not an integrated capability) mangled the Latin invoice numbers and lost a table — a reason to review any OCR output; accuracy on real Arabic scans is unmeasured. **Statuses preserved:** F-05 partial; F-19 blocked; F-23 explanation closed / approximation partial; F-27 partial; D-13 blocked (EQ6); G-01 blocked; screen-reader verification open; EQ2, EQ3, EQ4, EQ5, EQ6, EQ9 and logo/Figma/icon licence unresolved and not inferred.


---

# Round 10 — independent enforcement management, status semantics, return journeys (branch `enforcement-order-matching`)

Description and evidence: `docs/enforcement-management.md`; old OCR review: `docs/old-ocr-review.md`.

**E-06 — enforcement management had no primary entry or landing (fixed).** «إدارة التنفيذ» is a third primary navigation entry (beside dashboards/reports and planning) with its own landing (`/enforcement`): explicit, defined counts (orders by status; unique invoices under an order in execution / only suspended / referred before with all orders closed / ever referred; contracts directly referred vs with referred invoices) and four views over the existing relationships — orders, referred invoices, related contracts, matching-review exceptions. No duplicate data or pages.

**E-07 — enforcement changed the collection category (fixed).** An open or suspended order moved an invoice out of overdue/partial/not-due into an «enforcement» category, and a closed order moved it back. The category and `payStatus` now follow the payment state only; enforcement is a separate dimension (filters, tags, counts). A cancelled-in-source invoice with any confirmed referral stays an uncollected invoice also after the order closes. Suspended orders are shown separately and described as «open, not proceeding». **Unresolved:** the mapping of this demo's three feed statuses (قيد التنفيذ / موقوف / مغلق) to **Sanad's official order statuses** (finer states such as partly executed, settled, cancelled, suspended by whom) is not known — an integration dependency, not inferred.

**E-08 — stale invoice list after a link changed (bug found and fixed).** The list cache was keyed by the NUMBER of review overlay entries, so changing a link's status (proposed → confirmed, open → closed) returned a cached page; it is now keyed by the overlay content.

**E-09 — contract relationship (clarified).** «Directly referred» (a Sanad order names the contract number) and «invoices referred» (the contract's own invoices carrying a confirmed order) are shown as two separate facts on the contract page, the contracts list view and the landing; neither implies the other.

**E-10 — return journeys (completed).** Collection, Risk, Noncollection (filter, page, scroll) now restore like Invoices, Contracts and Orders; a record page opens at its top; scroll restoration retries until the page has grown and no longer depends on animation frames.

**Old OCR code (reviewed):** the earlier upload-and-link flow was entirely **simulated** (file-name digits, canned fields, hard-coded «OCR complete» text); no OCR or PDF-text capability existed to reuse. **OCR performed by this system remains pending**; marking a scan «not read» verifies the fallback only.

**Statuses preserved:** F-05 partial; F-19 blocked; F-23 explanation closed / approximation partial; F-27 partial; D-13 blocked (EQ6); G-01 blocked; screen readers unverified; EQ2, EQ3, EQ4, EQ5, EQ6, EQ9 and logo/Figma/icon licence unresolved and not inferred.


---

# Round 11 — every source of invoice references, cancelled invoices vs enforcement, contract mentions (branch `enforcement-order-matching`)

Description, evidence and demo script: `docs/all-sources-and-cancelled-invoices.md`.

**E-11 — references were collected from the structured field and one PDF only (fixed).** Humans type invoice numbers in the description, the notes or only in attachments. The order page now reads **every** source (structured · description · notes · digital PDF · Word `.docx` paragraphs and tables), normalises typed variants without losing the typed text, de-duplicates across sources keeping every occurrence, matches each reference independently and lists a *Sources examined* table. Scanned PDFs, images, legacy `.doc` and unknown formats are **kept but flagged unread** with the reason — never treated as read; no OCR is performed.

**E-12 — «no reference yet» read as «no related invoices» (fixed).** Wording is now «Invoice references not identified — review required» everywhere (order page, list, landing exception); «complete» is stated to mean *every reference found is decided*, not *every covered invoice was found*.

**E-13 — contradicting references across sources (added).** The same serial with different years in different sources is a hard conflict on each member, resolved only by data evidence (one candidate belongs to the order's debtor), never by a typed reason.

**E-14 — cancelled invoices vs enforcement (clarified, flagged).** Source cancellation, effective treatment, remaining balance, payment status and enforcement (active / historical) are shown as separate facts. A cancelled invoice with a confirmed referral (any order status, or a link later withdrawn) keeps the documented ENF-1 treatment and is flagged «source/enforcement conflict — review required», **pending EQ3**; no order event moves an amount (tested). Landing count, Invoices filter/tag, invoice finding.

**E-15 — contract mention vs referral (added).** *Mentioned* · *directly referred* (structured field or reviewer-confirmed from a document) · *invoices referred* are three facts on the order, contract and landing pages; a mention alone is never a referral and a directly referred contract never implies all its invoices are referred.

**Tests:** 114 (10 new). **Open dependencies:** live Sanad retrieval and attachment retrieval; **actual OCR**; legacy `.doc` support; approximate `.docx` pagination; EQ3 decision on the treatment; Sanad's real description/attachment conventions.

**Statuses preserved:** F-05 partial; F-19 blocked; F-23 explanation closed / approximation partial; F-27 partial; D-13 blocked (EQ6); G-01 blocked; screen readers unverified; EQ2, EQ3, EQ4, EQ5, EQ6, EQ9 and logo/Figma/icon licence unresolved and not inferred.


---

# Round 12 — simplified journey, OCR simulation, corrected matching and ENF-1 clarification (branch `enforcement-order-matching`)

Description, evidence and demo script: `docs/simplified-journey-and-ocr-simulation.md`.

**E-16 — «same serial, different year» was treated as a hard conflict (fixed).** Two legitimate invoices of one order are matched independently; the cross-source conflict rule and its debtor-based auto-resolution were removed. An incomplete serial matching several invoices stays ambiguous; the order's debtor is shown as supporting evidence only.

**E-17 — contract mention confirmed from a document mention (fixed).** A document naming an existing contract is not evidence of a direct referral; confirmation needs a document location, an explicit statement that the contract itself is referred, and the recorded statement.

**E-18 — enforcement changed financial totals through an implementation assumption (fixed).** The documented rule ENF-1 (registry; recorded as a «meeting correction»; minutes not in the repository) was applied automatically to any confirmed link, including links created from documents. Enforcement — active, closed or withdrawn — no longer overrides a source cancellation, reinstates collectibility or changes a total; the conflict is flagged and ENF-1 is applied only on a reviewer's recorded decision. **EQ3 stays unresolved; no new financial policy.** (Visible change: the previous round's automatic retention is gone.)

**E-19 — the order page was a long technical review (simplified).** Three steps (add · analyse · review and confirm), one primary action, one consolidated review table with one confirm action, concise Arabic summaries, a compact «بيانات تجريبية · محاكاة OCR» marker with «تفاصيل التكامل», details and history under expandable sections.

**E-20 — OCR (clearly labelled simulation added).** Eight prepared scanned-style samples replayed through the real extraction from their own transcripts (deterministic, never from file names), labelled «محاكاة OCR — للعرض التجريبي»; other files use real extraction or are flagged unread; methods are stored and exported distinctly. **This is not live OCR; actual OCR and live Sanad remain pending.** Word evidence names table/row or paragraph (no approximate pages); legacy `.doc` unavailable.

**Tests:** 121. **Statuses preserved:** F-05 partial; F-19 blocked; F-23 explanation closed / approximation partial; F-27 partial; D-13 blocked (EQ6); G-01 blocked; screen readers unverified; EQ2, EQ3, EQ4, EQ5, EQ6, EQ9 and logo/Figma/icon licence unresolved and not inferred.


---

# Round 13 — the Sanad CSV structure, source-style demo, ENF-1 inert (branch `enforcement-order-matching`)

Mapping, data review and open questions: `docs/sanad-csv-mapping.md`.

**E-21 — the demo did not follow the source structure (fixed).** The 20 columns of the Sanad extract are mapped (record grain = one enforcement request; claim and «رقم الانفاذ» shared across rows; no debtor name or identity; invoice-number column ≈ 98 % empty, numbers mostly in the description; a share of identifiers corrupted to scientific notation; no «suspended» status). Every demo case now carries the structure deterministically; the orders list shows the essential source fields and one matching-review status, everything else (and the manual upload) is in the order page.

**E-22 — corrupted identifiers (added).** A structured invoice number in scientific notation is listed as «رقم فاتورة مشوّه», never matched, padded or repaired, and raises an exception; numeric 12-digit numbers found only in the description are matched normally.

**E-23 — a reviewer action established an undocumented financial policy (removed).** The «apply ENF-1» action is gone together with its engine path: no order event, review note or stored decision changes any amount; the established treatment (the invoice stays cancelled) is preserved and the conflict stays visible. Earlier decisions are retained in history with their policy basis flagged unresolved. **EQ3 stays unresolved.**

**Status vocabulary (provisional):** 33 source statuses kept verbatim; open/suspended/closed class stated or inferred per status and flagged for confirmation with Sanad.

**Tests:** 124. **Statuses preserved:** F-05 partial; F-19 blocked; F-23 explanation closed / approximation partial; F-27 partial; D-13 blocked (EQ6); G-01 blocked; screen readers unverified; EQ2, EQ3, EQ4, EQ5, EQ6, EQ9 and logo/Figma/icon licence unresolved and not inferred.



---

# Round 14 — status semantics, identifier quality, stable demo ids, enforcement simplification (branch `enforcement-order-matching`)

Details: `docs/sanad-csv-mapping.md` §11 and `docs/stable-demo-ids.md`.

**E-24 — a status was classified without a source (fixed).** The earlier build inferred «suspended» from «… تم إصدار امر بوقف المهل» and «open» for every other status. Now the source status is shown verbatim everywhere; only «مغلق …» is a stated closure; every other status is **unclassified** and is never counted as definitively active, suspended or closed. Source status, current enforcement, historical referral and payment status stay four separate facts; closing never implies payment, never removes the referral and never changes a balance.

**E-25 — scientific notation treated as one defect (refined).** Whether an identifier is recoverable is decided from the exact raw string: all digits written → preserved raw + normalised by string handling and matched; digits missing (rounded) or longer than the identifier lengths → «رقم غير موثوق», never padded, completed, repaired or matched. Detail on the order page, a small alert in the list. **Limit:** a value whose last digit was rounded but fully written cannot be told apart by the string — needs an export that keeps text (open question for Sanad).

**E-26 — demo ids could change meaning between builds (fixed and documented).** Scenario ids are fixed per scenario, the scenario list is append-only (new: `notation_exact` → EN-6298), and saved work is stamped `idScheme: 3`. Records saved by earlier builds under the shifted range EN-60xx/61xx are **set aside, never applied**, listed on the landing page, and restored by the reviewer to the order they choose (logged in the history). Old → new table: `docs/stable-demo-ids.md`. `cd27e3c` → current: all 17 ids identical.

**E-27 — the enforcement area was heavy to read (simplified).** Landing: four cards with stated counting units, breakdown on demand. List: request number, Amanah · municipality, source status, amount, linked invoices, one review status; three visible filters (search by request number or invoice reference — never by debtor identity; Amanah; review status), the rest under «فلاتر إضافية»; chips + one reset; filter/sort/page/scroll restored on return. Order page: compact summary first, then linked invoices, the financial-difference notice and the next action; the 20 source columns and the original description are secondary.

**E-28 — return path lost one level (fixed).** Returning from a contract to an invoice opened from an order sent the reader to the invoices list instead of the order. Each record page now remembers where it was opened from. **E-29 — mobile overflow (fixed):** a visually-hidden table header cell widened the page in right-to-left layout (enforcement landing, noncollection); the table wrappers now contain it, and the two-column section no longer sizes to its widest word.

**E-30 — sample documents printed «Suspended» (fixed):** the generators print «In execution» for anything not stated as closed (six PDFs changed in that line only).

**Wording:** internal terms (ENF-1, EQ numbers, audit ids) removed from user-facing screens; ENF-1 stays disabled — history only, no effect on any amount. **Unchanged:** financial calculations, cancellation treatment, approval policy, confirmed relationships.

**Statuses preserved:** F-05 partial; F-19 blocked; F-23 explanation closed / approximation partial; F-27 partial; D-13 blocked (EQ6); G-01 blocked; screen readers unverified; EQ2, EQ3, EQ4, EQ5, EQ6, EQ9 and logo/Figma/icon licence unresolved.


---

# Round 15 — navigation: operations vs system settings (branch `enforcement-order-matching`)

Details: `docs/navigation-structure.md`.

**N-01 — administration pages sat among daily operational pages (restructured).** «مصادر البيانات» and «قاموس المقاييس» moved to a new **إعدادات النظام** area with a breadcrumb and sub-navigation; old addresses redirect. **N-02 — one list, two jobs (split by function).** «جودة البيانات والمخاطر» is now **«المخاطر والانحرافات»** (risks: duplicate, struck-off registry, deceased debtor; deviations: value anomaly, amount conflict, payment on excluded invoice) and record-level data-quality monitoring (missing fields, contracts not linked or matched, pending links and exclusions) moved to **«جودة البيانات»** under system settings. **N-03 — name clash (fixed).** The topbar «الإعدادات والحساب» is «التفضيلات والحساب» (personal preferences). No figure, formula, workflow or permission changed; no role gating exists or was added (open point in the document). **Tests:** 131.

**Statuses preserved:** F-05 partial; F-19 blocked; F-23 explanation closed / approximation partial; F-27 partial; D-13 blocked (EQ6); G-01 blocked; screen readers unverified; EQ2, EQ3, EQ4, EQ5, EQ6, EQ9 and logo/Figma/icon licence unresolved.
