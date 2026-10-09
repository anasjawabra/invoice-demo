# Platform audit — reporting, planning, navigation, journeys, content clarity, hierarchy and dates

Contents: Part A §1–9 (journeys, findings F-01…F-31, consistency, corrected journeys, remediation, questions Q1–Q10, limits) · **Part B §10–16** (content and wording C-01…C-10, hierarchy, dates D-01…D-15, UX references, updated plan, questions Q11–Q18) · **Part C §17–23** (MOMAH/NHCI + DGA reference extracted, platform-wide visual and UX consistency, gap table G-01…G-26, proposed shared design system, consolidated remediation plan, questions Q19–Q27) · **Part D §26–32** (evidence update, plan-record status, consolidated backlog by root cause, work split A/B/C, ten essential questions, acceptance criteria, phased plan).

**Document status:** analysis only — no code, configuration or business data was changed on purpose (one unintended test side-effect is disclosed in §9). Version 3 — updated 2026-10-09 with the decisions on the Part C questions (§24–25), the direct review of the screenshots and monthly reports, the consolidated backlog, the essential questions, acceptance criteria and the implementation plan (Part D, §26–32).

## Executive summary

**What was reviewed.** The running application (compact demo, ≈ 895 synthetic invoices) and its code, across four briefs: (1) functional journeys, reports and planning; (2) content clarity, information hierarchy and date handling; (3) conformance with the MOMAH/NHCI UX reference (workshop deck + the DGA design system it adopts); (4) a consolidated remediation plan.

**Overall assessment.** The structure — two management areas plus operational modules — is sound and the build works end to end. The risks are not missing screens but (a) the same measure computed on different bases in different places, (b) silent failures that look like success, (c) governance gaps in plans and actions, (d) text that is too long, technical or contradictory, (e) unreliable date controls, and (f) a visual layer that follows a different source than the DGA foundation the reference makes mandatory.

**The ten findings to fix first**

| # | Finding | Id |
|---|---|---|
| 1 | The same closed period gives opposite comparison answers in the Dashboard, the fixed reports and the Smart reports (e.g. ▼ −3.0 pp vs ▲ +3.2 pp) | F-01 |
| 2 | Reports show available rates as "unavailable" and the exclusion bar is broken | F-02 |
| 3 | The monthly report says "no recommended interventions" beside findings that need action | F-03 |
| 4 | Planning results (scenario, funding, objective status) follow the dashboard filter, not the plan | F-04 |
| 5 | Smart reports silently misread common requests ("last month", "top 5 municipalities", comparisons) | F-05 |
| 6 | A scenario button creates an already-approved action; an approved plan can change without losing approval | F-06, F-07 |
| 7 | An inverted or pre-data date range is accepted and reported as "no invoices"; «آخر 3 أشهر» has no stable meaning | D-01–D-05 |
| 8 | The «فتح» buttons on Sanad orders are blue text on green (1.15:1); 30–83 AA contrast failures on five operational pages | G-06 |
| 9 | Exports differ from the screen (PowerPoint tables cut to 11 rows, no totals; Excel omits caveats) | F-10 |
| 10 | Colours, type scale, spacing, icons, date picker and filters do not follow the DGA foundation; no MOMAH logo | G-01–G-17 |

**What already works (keep).** Financial identities reconcile on every view; missing data is shown as "غير متاح" on narrowed scopes in Planning; all nine fixed reports open without errors and Excel matches the screen; no horizontal overflow at 1,280/390 px; the brand green `#1B8354` equals DGA SA 600; the font family is IBM Plex Sans Arabic; both assistants state clearly that they are rule-based.

### Decision log

| # | Decision | Source | Effect |
|---|---|---|---|
| D1 | Logo: **MOMAH** only | you | official files and usage rules still needed (G-01) |
| D2 | Product name **unchanged** | you | consistency only: same name in header, tab title and exports (G-25) |
| D3 | Icons: **Hugeicons, Stroke Rounded** (left to me) | recommendation | confirm licence or buy Pro (G-11) |
| D4 | Dark theme **not needed now** | you | lock to light and hide the toggle until a dark design exists (G-24) |
| D5 | **One font family** (IBM Plex Sans Arabic) for Arabic and Latin | you | documented deviation from slide 8; drop Plex Mono (G-02) |
| D6 | **DGA palettes only** — no extra accent colours | you | remove violet/orange/extra blue/gold; AI chip instead of an AI colour (G-04, G-05) |
| D7 | Accessibility: declare **WCAG 2.1 AA**, build to **2.2 AA** | recommendation | 24 px target floor, focus never hidden (G-07, G-08) |
| D8 | Exports carry logo, header/footer, cut-off and "demo data" statement | recommendation | product team builds from tokens; ministry brand owner approves (G-23) |

### Question status

| Questions | Status |
|---|---|
| Q19 logo · Q20 name · Q21 Figma · Q22 font · Q23 icons · Q24 dark theme · Q25 accents · Q26 WCAG · Q27 exports | **answered** (D1–D8); Q19 and Q21 still need files/values |
| Q1–Q18 | **reduced to ten essential questions EQ1–EQ10 (§29)**; the rest have recommended defaults — none blocks Phase 0 |

### Version 3 additions (Part D)

Screenshots and original monthly reports reviewed (§26) — **new findings F-32 grace periods, F-33 coverage definition, F-34 target wording, F-35 report parity**; the unintended plan change is **not yet restored** (record `PLAN-MV0YG5BNEW`, `scenario.dRate` 3 → 8, §26.3); all findings consolidated into **14 epics by root cause** (§27) and split into *no-decision / decision-needed / asset-dependent* work (§28); **measurable acceptance criteria** (§30); phased plan (§31).

### Inputs still needed

1. Official MOMAH logo files and usage rules.
2. Figma Components Library / Foundations values (or exports).
3. Hugeicons licence confirmation (or Pro).
4. Answers to the ten essential questions EQ1–EQ10 (§29).

### How to read this document

Part A (§1–9): journeys, findings F-01…F-31, consistency, corrected journeys, plan, questions Q1–Q10, limits. Part B (§10–16): content C-, hierarchy H-, dates D-, UX references, questions Q11–Q18. Part C (§17–25): the reference extracted, the gap table G-01…G-26, the proposed design system, the **consolidated remediation plan (§21 — supersedes §6 and §14)**, decisions (§24–25).

Audit date: 2026-10-09 (Asia/Riyadh) · Scope: the running app (`http://localhost:3000`, compact demo ≈ 895 invoices) and the working tree
Mode: **read-only**. No code, configuration or business data was changed on purpose (one unintended test side-effect is disclosed in §9).

How to read the evidence labels:

| Label | Meaning |
|---|---|
| **Verified (UI)** | reproduced in the running app, observed values quoted |
| **Verified (code)** | confirmed by reading the code at the stated line; behaviour not exercised in the browser |
| **Verified (data)** | observed in the stored browser data (localStorage / sessionStorage) |
| **Hypothesis** | plausible from the code, not reproduced |
| **Not tested** | could not be exercised (reason given) |

> **Superseded by §26 (version 3):** the screenshots of 9 Oct and the original monthly reports (July 2026 and January–March 2026) have now been reviewed directly. The mapping document `docs/monthly-reports-mapping-ar.md` was updated accordingly.
> There is no version history for the latest work: everything since commit `d947581` is **uncommitted** (122 changed paths; 54 tracked files
> changed, +1,302 / −7,673 lines against HEAD), so regressions cannot be bisected — they were identified by comparing behaviour with the code's own stated contracts.

---

## 1. Overall assessment

**The structure (two management areas + operational modules) is sound and the build is functional. The problem is not missing screens; it is that
the same measure is computed on different bases in different places, and several "complete-looking" features rest on placeholders or on silent
fallbacks.** Three kinds of defect dominate:

1. **Basis drift** — the same indicator, same filters, gives different (even opposite) answers in the Dashboard, the Fixed reports and the Smart reports (F-01), and planning results move with the *dashboard* filter instead of the *plan's* scope (F-04).
2. **Silent failure** — wrong interpretation reported as success (Smart reports, F-05), stale figures under new filters (F-12), a hidden filter (F-13), "unavailable" shown for calculable values (F-02), "no recommendations" shown where there are findings (F-03).
3. **Governance gaps** — a scenario button creates an *approved* action (F-06); an *approved* plan can change without losing approval (F-07); "approved" means two different things for exclusions (F-08).

| Area | Verdict | Why |
|---|---|---|
| Dashboard | **Usable, not yet trustworthy for closed periods** | Figures reconcile (gross = exclusions + net; net = collected + uncollected). KPI tile and its delta use different as-of dates (F-01); stale-under-filter (F-12). |
| Fixed reports | **Good structure; two wrong blocks** | All 9 open directly, no prompt, no errors, Excel matches the screen. Relations block and "recommendations" are wrong (F-02, F-03); comparison note is false for closed periods (F-01); PowerPoint truncates tables (F-10). |
| Smart reports | **Weakest area** | Rule-based interpreter silently misreads common phrasings (F-05); empty selections show zeros (F-11); several UX defects (F-16). |
| Planning | **Good coverage, wrong anchoring** | Objectives, plan, variance, forecast, scenarios, register all exist and are labelled actual/target/forecast/scenario. But they are computed from the dashboard filter, not from the plan (F-04); approval/integrity gaps (F-06, F-07). |
| Navigation / IA | **Needs a second pass** | 9 flat entries (2 off-screen at 1280 px), a misdirected link, hidden operational modules, split persistence (F-17–F-19). |
| Arabic / RTL / responsive | **Mostly good** | No horizontal overflow at 390 px; Arabic is default. Proposals are in the wrong language (F-09); `zh` falls back to English; phone header uses 39 % of the viewport. |

What works well (verified): identities hold on every checked view; missing data is shown as "غير متاح" on narrowed scopes in Planning; all fixed reports render with
no console/alert errors; no NaN/undefined text in any report; the empty selection is handled correctly on Dashboard/Fixed reports/Planning; Excel exports match the
displayed numbers; synthetic data is consistently labelled; legacy URLs redirect.

---

## 2. Current page and user-journey map

### 2.1 Routes and navigation (Verified: UI + `src/App.jsx`, `src/components/Layout.jsx:118`)

| Route | In top nav | Purpose | Notes |
|---|---|---|---|
| `/insights?view=dashboard` | ✔ «لوحة المعلومات والتقارير» | Monitoring | default home |
| `/insights?view=reports[&report=key]` | (tab) | 9 fixed reports | `report` invalid → silently shows the list |
| `/insights?view=smart[&q=]` | (tab) | Conversational reports | `q` is re-sent on every reload (F-16) |
| `/planning#objectives…#decisions` | ✔ «التخطيط المالي والاستراتيجي» | Plan, objectives, scenarios, register | anchors land under the sticky header (F-29) |
| `/invoices` (+`?id=`, `?src=`, `?amanah=`, `?co=`, `?filter=`) | ✔ | Invoice ledger | `?src` is a hidden filter (F-13) |
| `/noncollection` | ✔ «عدم التحصيل والاستبعادات» | Exclusion review + **global configuration** | changes management figures (F-20) |
| `/collection` | ✔ | Collection worklist | "Forecast & target" link is wrong (F-17) |
| `/contracts` | ✔ | Contracts and enforcement | |
| `/risk` | ✔ «جودة البيانات والمخاطر» | Data quality / risk radar | overlaps fixed report `quality` and `/data-sources` |
| `/data-sources` | ✔ (off-screen at 1280 px) | Source freshness, reconciliation | |
| `/metrics` | ✔ (off-screen at 1280 px) | Metric dictionary | has its own KPI values and filter bar |
| `/sanad-orders`, `/sanad-orders/:n`, `/investment-invoices`, `/investment-invoices/:id` | ✘ not in nav | Operational | reachable only from links; no nav highlight, page title falls back to "INTELLIBILL" |
| `/executive`, `/dashboard`, `/reports`, `/smart-reports`, `/assistant`, `/strategic`, `/decision-room`, `/what-if` | – | Legacy | all redirect correctly (Verified UI); `/executive#exec-q1` loses its anchor; `/reports?r=aging` is not normalised to `view=reports&report=aging` |
| any unknown path | – | – | silently becomes the dashboard (no 404) |

### 2.2 Journey status

| # | Journey | Status | Main blockers |
|---|---|---|---|
| J1 | Open dashboard → filter → drill down | ⚠ works | stale figures under new chips (F-12); `/invoices?src=` hidden filter (F-13); closed-period KPI vs delta (F-01) |
| J2 | Open fixed report → export | ⚠ works | wrong relations block (F-02), false recommendations (F-03), PowerPoint truncation (F-10), Excel omits caveats |
| J3 | Smart report: prompt → refine → reopen | ✖/⚠ | misinterpretation (F-05), scroll jump / replay / false "prepared" text (F-16), zeros on empty (F-11) |
| J4 | Review financial & strategic objectives | ⚠ | status depends on dashboard filter (F-04); thresholds hard-coded (F-26) |
| J5 | Create / compare / save / reopen scenarios | ✖/⚠ | one scenario per plan, no comparison view (F-24); results depend on filter (F-04); approved plan mutable (F-07) |
| J6 | Create decisions/actions and follow outcomes | ⚠ | scenario creates an *approved* action (F-06); proposal ids suppress items for ever (F-15) |
| J7 | Reporting ⇄ planning ⇄ invoices | ⚠ | shared filters work; Smart keeps its own scope (F-16); wrong "Forecast & target" link (F-17); plan scope vs filter mismatch unflagged (F-04) |

---

## 3. Prioritised findings

Severity: **P0** wrong or contradictory decision-relevant results · **P1** governance/integrity or visibly wrong output · **P2** consistency/UX · **P3** polish.

### P0 — fix first

#### F-01 · The same closed period gives opposite comparison answers in three views
- **Affected:** Dashboard, Fixed reports (all with comparison), Smart reports. **Journeys:** J1, J2, J3, J7.
- **Reproduce:** Filters → «الشهر الماضي». Read the collection-rate tile on the Dashboard. Open Fixed reports → *Monthly executive summary*. Open Smart reports → «أنشئ تقرير الإيرادات للشهر الماضي», then «قارن بالعام الماضي», then «بدون مقارنة».
- **Expected:** one collection rate for one period and basis, and one comparison conclusion.
- **Actual (Verified UI, Sept 2026 vs Sept 2025):**

| View | Rate shown | Delta vs same period last year | Collections counted to |
|---|---|---|---|
| Dashboard tile | **21.7 %** | **▼ −3.0 pp** (its own note says prior = 18.5 %, i.e. 21.7 − 18.5 = +3.2) | tile: 2026-10-09 · delta: 2026-09-30 |
| Fixed monthly report | 21.7 % | **▲ +3.2 pp** (note claims "each period is measured at its own end") | 2026-10-09 |
| Smart report + comparison | **15.5 %** | −3.0 pp | 2026-09-30 |
| Smart report, comparison off | 21.7 % | – | 2026-10-09 |

  Collected = 0.24 bn (21.7 %) vs 0.17 bn (15.5 %) for the same invoices; turning a comparison on silently changes the headline.
- **Evidence:** `src/data/comparison.js:9` (delta measured at period end), `src/components/insights/FixedReports.jsx:37` (cut-off snapshot passed with a period-end `prev`), `src/pages/SmartReports.jsx:112,118` (snapshot swapped to period end only when comparing), `src/components/insights/InsightsDashboard.jsx:54` (cut-off value beside a period-end delta), `src/data/revenueMetrics.js:182`.
- **Impact:** a manager can read "collection improved" on one page and "declined" on another for the same month; the fixed report's own note states a basis it does not use.
- **Root cause (confirmed):** the measurement date (`collectionsAsOf`) is decided separately in four places instead of one shared function.
- **Recommended correction:** one `measure(scope, basis)` in the metric layer. For a closed period the default headline *and* comparison are both "at period end", labelled "collections to YYYY-MM-DD"; "to date" is shown as a separate labelled measure. Remove the per-view overrides. Add a cross-view test: same scope → same numbers in Dashboard, Fixed, Smart, Planning.

#### F-02 · Reports show calculable rates as "unavailable", and the exclusion bar is broken
- **Affected:** *Monthly executive summary* and *Exclusions* fixed reports; every Smart report with an executive/exclusions section.
- **Reproduce:** Reports → Monthly → "Executive summary" → the green/red relations bar and the line under it.
- **Expected:** "Collection rate 57.8 %", "Exclusion rate 9.1 %" (as in the KPI row directly above and in the Excel summary).
- **Actual (Verified UI/DOM):** "المحصّل 7.83 مليار SAR · **غير متاحة**", "نسبة التحصيل **غير متاحة**", "نسبة الاستبعاد **غير متاحة**". The *cancelled* and *rules* segments have an empty `width` (NaN) and render as 16 px stubs, so the first bar no longer adds up to gross billed.
- **Evidence:** `src/data/reportModel.js:68` builds `ctxTotals` without `collectedOverNet`, `exclusionRate`, `cancelled`; `src/components/revenue/FinancialRelations.jsx:19-27` consumes them; `src/components/smart/ReportView.jsx:72`.
- **Impact:** every report states a measure is unavailable that is available. Exports differ from the screen: Excel omits the block, Word/PowerPoint show it only as two formulas without the rates.
- **Root cause (confirmed):** the same component is fed two different "totals" shapes (full snapshot totals on the Dashboard, a six-field subset in reports).
- **Correction:** pass the full totals object; give `relations` a typed contract and a unit test that renders it from a report model.

#### F-03 · The monthly executive report says "no recommended interventions" next to findings that say "action required"
- **Reproduce:** Reports → Monthly → scroll to «التوصيات المدعومة بالأدلة».
- **Actual (Verified UI + xlsx):** "[منخفضة] لا توجد تدخلات موصى بها لهذا النطاق." — while the insights above it are tagged «يستدعي إجراء» (white-lands rate 26.4 % vs 60 %; 82 % of the standing balance > 90 days). The same sentence is in the Excel sheet «التوصيات…».
- **Evidence:** `FixedReports.jsx:37` hard-codes `cards: [], anomalies: []`, so the recommendation builder receives nothing.
- **Impact:** a board-facing report asserts the opposite of its own findings. This is a placeholder presented as a result.
- **Correction:** either remove the section from fixed reports, or feed it from the same proposal source used in Planning (`src/data/proposals.js`).

#### F-04 · Planning results are anchored to the dashboard filter, not to the plan
- **Affected:** scenario results, funding projection, objective status, saved version summaries. **Journeys:** J4, J5, J7.
- **Reproduce:** open Planning with the saved plan (FY2026, all Amanahs, scenario: rate +3 pp, expenditure +10 %, slip 20 %). Compare "Year to date" with "This month", or national with Riyadh.
- **Actual (Verified UI):**
  - Funding scenario: receipts **10.23 bn → 9.91 bn**, balance **−12.61 bn → −12.93 bn** when only the period changed from YTD to this month; scenario "collected" base 7.83 bn vs 25.7 M.
  - Objective «رفع نسبة التحصيل إلى المستهدف»: national → 57.8 %, **96 % «على المسار»**; Riyadh → 73.5 %, **123 % «تحقق»** — the plan scope still reads "كل الأمانات" and no warning appears.
  - The plan bar keeps showing "2026-01-01 → 2026-12-31 · كل الأمانات" in every case.
  - Saved v1 stores `summary {rate, collected, balance}` (60.8 %, 8.24 bn, −12.61 bn) without the period/scope/config under which it was computed (Verified data).
- **Evidence:** `src/pages/PlanningArea.jsx:74-79` (`scenRes`, `funding` from the global `snapshot`), `:83-87` (`actuals`), `src/components/strategic/PlanBar.jsx:26` (summary), `src/data/planStore.js:31`.
- **Impact:** the plan's headline numbers are not reproducible and can flip with an unrelated filter click; a version cannot be compared with another.
- **Root cause (confirmed):** the plan owns a period and scope, but the analytics read `rev.snapshot` (the global filter). The page treats "applying the plan scope" as an optional button (`onApplyScope`).
- **Correction:** planning computations must take the **plan's** period/scope/basis. If the user changes the global filter, show an explicit banner ("viewing under filter X ≠ plan scope Y") or ignore the filter in this area. Store `{period, scope, basis, config hash, data cut-off}` inside every saved version.

#### F-05 · Smart reports silently misread common requests and report success
- **Affected:** Smart reports (J3). Verified through the interpreter and in the UI.
- **Reproduce:** type each phrase in a new conversation (shared filter = YTD, all Amanahs).

| Request | What happened | Expected |
|---|---|---|
| «أنشئ تقرير الإيرادات **للشهر الماضي**» | period unchanged (YTD); no change chip; "أعددتُ التقرير" | last month |
| «تقرير الشهر الماضي» while the dashboard is already on last month | "I could not turn this request into a report" | the report |
| «أريد تقريراً عن أكبر 5 **بلديات**» | source = municipal fees | municipalities table (top 5) |
| «تقرير الاستبعادات **للأمانات الشرقية**» | Amanah ignored | Eastern Amanah |
| «تقرير الشهر الماضي **مقارنة بالعام الماضي**» | comparison = *last month*, period unchanged | last month vs last year |
| «تقرير الاستبعادات شهر سبتمبر **مقارنة بأغسطس**» | period = **August**, no comparison | September vs August |
| «ما نسبة التحصيل في **جدة**؟» | national figures (Amanah not applied) | Jeddah |
| «ما الميزانية المتبقية؟» / «هل نغطي المصروفات؟» | labelled "answer computed from data" but returns the generic executive report | budget answer or a redirect to the budget report |
| «قارن الرياض بجدة» | "unsupported" | comparison of two Amanahs |
| "compare with last month" (English) | sets the *period* to last month | comparison |

- **Evidence:** `src/data/reportIntents.js:80-84` (comparison extraction), `:99` (Amanah needs a trigger word), `:126-153` (any question is "recognised"; `recognized` at `:151`), `SECTION_WORDS` has no budget/expenditure; `assistantRouter.parseSource` maps «بلديات» to municipal fees.
- **Impact:** the user sees chips but the assistant text claims success; a wrong period or Amanah can go into an exported report.
- **Root cause (confirmed):** keyword rules without a "recognised but not applied" check, and no confirmation step.
- **Correction:** (1) fail loudly when a token that looks like a period/Amanah/comparison is present but unapplied; (2) show an editable "I will prepare: period · Amanah · source · comparison" line and require one click when confidence is low; (3) a golden phrase corpus (≥100 Arabic/English phrasings) as a regression test; (4) a clear redirect for budget/expenditure requests to the fixed report; (5) questions must produce an answer, not a generic report.

### P1 — integrity, governance and visibly wrong output

#### F-06 · "Propose an action from this scenario" creates an approved action
- **Reproduce (Verified code):** Planning → Scenarios → change a lever → «اقتراح إجراء من هذا السيناريو».
- **Actual:** the toast says «معتمد — بانتظار البدء» and the item enters the register with status `approved`, no approver, no owner. `createAction` always sets `status: 'approved'` (`src/data/actionRegister.js:32`) and the same user proposes and approves (`ActionRegister.jsx:37`); `PlanningArea.jsx:118-122` bypasses the proposal queue.
- **Impact:** recommendations are presented as approved decisions (explicitly forbidden by the requirements); the register cannot distinguish "proposed", "approved" and "approver".
- **Correction:** status model `proposed → approved (by, at) → in progress → done / cancelled`; scenario button creates `proposed`; approval requires a different identity/role (see Q4). Record `approvedBy`, `approvedAt`, plan id/version and objective id on every action.

#### F-07 · An approved plan can be changed without losing approval; labels and author are wrong
- **Verified (data + side-effect):** the stored plan was `v1 · معتمدة` with a saved scenario of +3 pp. One edit through the scenario input changed the live scenario to +8 pp; a field-by-field diff of the stored record showed **only** `scenario.dRate` changed — status stayed *approved*, version stayed 1, no history entry, the saved v1 still held +3 pp.
- **Also verified:** plan name «خطة السنة المالية 2026 **(مسودة)**» while approved; `approvedBy` = `createdBy` = «**李芳军**» (Chinese display name taken from `user.name`; the Arabic name «طارق» exists in `user.nameAr`); `approvePlan` allows self-approval.
- **Evidence:** `PlanningArea.jsx:56` (`setScenario` writes `{...p, scenario}` directly), `PlanBar.jsx:19-20,24` (name/owner/assumptions written without `patchPlan`, no history), `planStore.js:31-38`, `PlanBar.jsx:34` (restore-as-draft changes content but keeps `version`).
- **Impact:** "approved v1" no longer equals what was approved; audit trail shows a name in the wrong language/script.
- **Correction:** edits to an approved plan create a draft revision automatically (or are blocked); every field edit goes through `patchPlan`; show "unsaved changes" state; use a display-name resolver by language; remove "(مسودة)" from generated names or derive it from status.

#### F-08 · "Approved" means two different things for exclusions
- **Verified (UI + data):** Exclusions callout: *approved rules 2.41 M, unapproved rules 811.02 M* (of 1.36 bn total; the rest is cancellations). Yet the relations bar labels the whole non-cancelled part «**قواعد معتمدة**» (`FinancialRelations.jsx:19`), the Dashboard status table says «مستبعدة وفق قاعدة معتمدة» for those 16 invoices, and the report assumption says «فقط الاستبعادات المعتمدة… تخفض صافي المفوتر».
- **Evidence:** `src/data/revenueMetrics.js:60-88` (rule definitions: `approval: 'approved' | 'unapproved'`) vs `:149` (an exclusion counts only when the *review* is approved) — two approval concepts under one word. ≈ 99.7 % of the rule-based exclusion amount rests on rule definitions marked unapproved.
- **Impact:** the headline net billed and collection rate depend mostly on unapproved exclusion rules but the main screens say "approved".
- **Correction:** two distinct terms ("review decision approved" vs "rule definition approved"); the Dashboard exclusions tile should carry the unapproved share; see Q5.

#### F-09 · Proposals appear in the wrong language (regression)
- **Verified (UI):** in the Arabic UI the Planning proposals read «Rate 26.4% vs a demo target of 60%…», «الإجراء المقترح: Follow up this cell…», «Amount concerned», «Max days overdue», «The Amanah revenue unit concerned (proposed)», «Within 30 days (proposed)».
- **Root cause (confirmed):** `src/data/proposals.js:3` imports `bi` from `revenueInsights.js` where the signature is `bi(en, ar)` (`revenueInsights.js:20`), but `proposals.js:14-16,24-29` calls it Arabic-first. Every bilingual field in proposals is swapped (English users would get Arabic).
- **Correction:** use the Arabic-first helper (`insightsEngine.bi`) in `proposals.js`; one bilingual helper project-wide; a test that every user-visible string has the expected script per language.

#### F-10 · Exports differ from the screen
- **Verified (UI + parsed files):**
  - **PowerPoint**: tables are cut to 11 rows and the total row is dropped without notice. The Amanah table (19 Amanahs + total on screen) has 11 body rows and no total in the .pptx (`src/utils/exportReportModel.js:110` `rows.slice(0, 11)`); the municipality table (> 50 rows) likewise.
  - **Excel**: callouts, notes, the relations block and the narrative text are not exported (only tables, charts, insights, lists — `exportReportModel.js:72`); percentage columns are plain numbers (51.6) with no "%" in header or number format while money columns state their unit; sheet names are cut at 28 characters and mid-word («صافي المفوتر والمحصّل حسب ال»).
  - **Word/PowerPoint (Planning summary)**: the *targets* section always appends «تغطية النفقات التشغيلية: البيانات غير متاحة» (`src/data/commandModel.js:35`) although the same file contains the computed coverage table (the Excel has the sheet «تغطية الإنفاق التشغيلي…»). Word was not opened visually (Not tested).
  - **Excel summary vs screen** disagree on collection rate because of F-02.
- **Correction:** paginate tables across slides with a "page n of m" note and always keep the total row; export callouts as a "Notes" sheet; add `%` to header or number format; unit-test export parity: every on-screen number/label has a counterpart in each format.

#### F-11 · A Smart report with no invoices shows zeros and can be exported
- **Verified (UI):** «أنشئ تقرير الإيرادات لهذا الشهر لمصدر مبيعات الإسكان» → gross/net/collected/uncollected "**0 SAR**", "0 فاتورة", export buttons enabled; the same selection on the Dashboard/Fixed reports shows an explicit empty state and disables export.
- **Correction:** one shared empty-state rule in `buildReportModel`/`ReportView`. Also: the assistant message prints the raw key «المصدر: housing_sales» (`describeChange` prints `c.value`).

#### F-12 · Stale figures under new filters; failures are silent
- **Verified (UI sampling):** after clicking «الشهر الماضي» the chip showed the new period immediately while the KPI still showed the previous value ("332.31 M") for ~60 ms more; no loading state exists on the Dashboard or Fixed reports (`rev.loading` is read only by Planning, `PlanningArea.jsx:149`). With the full demo (~1.65 M invoices) the window is seconds.
- **Verified (code):** if the snapshot request fails after the first load, `loadError` is stored but nothing displays it (`RevenueContext.jsx:123,307`): old figures remain under the new chips.
- **Correction:** expose `loading/error` through context and show a header status + dimmed figures + retry on every view.

#### F-13 · Drill-down to the invoice ledger applies a hidden filter
- **Verified (UI):** Dashboard → «الاستثمار/الغرامات» source link → `/invoices?src=fines`: the source selector reads «جميع مصادر الإيراد», the KPI strip shows the national totals (386 invoices, 14.92 bn), but the list contains only fines. `Invoices.jsx:79` `source: srcParam || sc.source`.
- **Correction:** write `src` into the shared scope (or show a removable chip), and make the KPI strip use the same scope as the list.

#### F-14 · Planning disappears completely on an empty selection
- **Verified (UI):** with a selection that has no invoices, Planning shows only the empty message — the plan bar, objectives, register and scenarios are not rendered (all six section ids absent) although they do not depend on the filter. A user cannot reach existing decisions without first widening the filter. `PlanningArea.jsx:163`.

#### F-15 · A proposal, once approved or rejected, disappears for every scope and period
- **Verified (UI + code):** the approved item «فواتير متأخرة أو محصّلة جزئياً» (`card:overdue_followup`) is absent from the 7 pending proposals although overdue/partial is the largest standing risk (82 % of the standing balance > 90 days). Proposal ids contain no scope or period (`src/data/proposals.js:13,24`), and `pendingProposals` filters by id (`actionRegister.js:52`).
- **Correction:** include scope key and period in the id, or expire approvals; show "approved earlier under scope X" instead of hiding.

### P2 — consistency and UX

| ID | Finding | Evidence / status |
|---|---|---|
| **F-16** | **Smart-report conversation UX.** (a) Reopening/arriving jumps the page to the bottom (observed scrollY 3 043 to 12 964 px on a long page) because `scrollIntoView` runs on every message/step (`SmartReports.jsx:98`). (b) `?q=` is re-sent on every reload and appended to the most recent conversation (a duplicate user message was created on reload) (`:196-201`). (c) A clarification question is followed by «أعددتُ التقرير من بيانات النظام» because the "prepared" bubble is rendered for every non-"unsupported" kind (`:271`). (d) Conversation title = first message («قارن»). (e) Reopening re-runs the analysis: figures can differ from when the conversation was written and no "generated at / data as of" stamp is kept. (f) The conversation keeps its own scope; the shared filter chips are hidden on this tab (`InsightsHub.jsx:39`) with no notice that Smart's scope differs from the Dashboard's. (g) Leaving the tab loses the draft and in-memory reports; interrupting a long generation may leave a message in `working` state — *not reproduced: the compact demo answers in < 150 ms*. | Verified (UI) a–f; (g) Hypothesis |
| **F-17** | **Broken/misdirecting navigation.** Collection → «التنبؤ والمستهدف» goes to `/executive#exec-q1` → the Dashboard top (forecast/target now live in Planning `#outlook`) (`Collection.jsx:44`); the anchor is dropped. `/reports?r=aging` is not normalised; unknown path → dashboard with no 404; `report=bad` → list silently; `/sanad-orders` and `/investment-invoices` have no nav entry or active state and their page title falls back to "INTELLIBILL" (`Layout.jsx:133-146`). | Verified (UI + code) |
| **F-18** | **Navigation and chrome.** 9 flat items; at 1280 px «مصادر البيانات» and «قاموس المقاييس» are outside the visible area (scrollWidth 1495 > 1270). Brand and tab title are «منصة الفواتير الذكية · INTELLIBILL · AI SUITE» (`index.html:6`) — not the MoMAH revenue-intelligence product. At 390 px the header + tab strip take **328 px** of 844 (39 %); the three view tabs wrap with «التقارير الذكية» alone on a second line; the three tab hints are Arabic-only (`InsightsHub.jsx:15`), shown in the EN/ZH UI too. | Verified (UI) |
| **F-19** | **Persistence is split and not tied to the plan.** Scope, targets, config, language → `sessionStorage`; plans, objectives, actions, conversations → `localStorage`; nothing server-side. An edited target survives only the tab, while the plan that references it survives for ever — a reopened plan can show different results. Saved plans do not record targets/config/data version. | Verified (data/keys) |
| **F-20** | **Hidden configuration changes management figures.** `/noncollection` holds exclusion-rule toggles, grace days and «collections as of» (`Noncollection.jsx:229`, `RevenueContext.jsx` `cfg`). They change Dashboard, Fixed, Smart and Planning numbers, but no indicator on those pages shows that configuration is non-default, and plans/conversations do not record it. | Verified (code); not exercised (would change shared state) |
| **F-21** | **Duplication.** The seven-tile headline KPI block is repeated at the top of **all nine** fixed reports (including *Budget* and *Quality*, where it is irrelevant); headline KPIs also appear on Invoices, Collection, Noncollection, Risk, Metrics and the Planning baseline. Data quality lives in three places (fixed report `quality`, `/risk`, `/data-sources`). Three filter UIs (`FilterChips`+`ScopeBar`, Smart `FilterPanel`, operational pages' full `ScopeBar`). Two planning-assistant entries on one screen (header button + floating button, `PlanningArea.jsx:153,214`). Two assistants (planning, smart) with different composers. | Verified (UI/code) |
| **F-22** | **Ambiguous duplicate rows** in the municipality table: three different rows are all labelled «بلا بلدية — غير محدد الأمانة (لم تُطابق في مكين)» (2, 3 and 5 invoices) — the grouping key includes a field that is not displayed. | Verified (UI) |
| **F-23** | **Mixed bases on one planning page.** Collected on YTD invoices (7.83 bn) vs receipts YTD by payment date (8.41 bn) vs forecast total (9.9 bn); the scenario's cash delta (computed on invoices issued in the filtered period) is added to payment-date receipts in the funding table (`PlanningArea.jsx:75-79`). Each is labelled, but the bridge between them is not shown. | Verified (UI/code) |
| **F-24** | **Scenarios cannot be compared.** One scenario per plan; "versions" are single summaries (rate/collected/balance); no side-by-side comparison, no scenario names, no delta versus baseline version. The brief asks to create, compare, save and reopen scenarios. | Verified (UI/code) |
| **F-25** | **Missing-data handling is inconsistent across views:** Planning/Dashboard show "غير متاح" correctly; Smart shows zeros (F-11); the fixed report's empty-state callout wrongly says «العام السابق خارج نطاق البيانات» when the reason is that the selection has no invoices (`FixedReports.jsx:47`). | Verified (UI) |
| **F-26** | **Unsupported/undocumented calculation choices.** Objective states use a hard-coded 90 %/100 % rule (`planStore.js:55`, not explained in the UI). A proposal's "expected impact" equals the whole gap and impacts of different proposals may overlap (Hypothesis — nothing sums them, but nothing de-duplicates them). The synthetic expenditure drives a −12.4 bn funding deficit that dominates the planning page (clearly labelled synthetic). The `slip` lever applied to a *negative* cash delta reduces the loss (`strategicCalc.js:121`, Hypothesis). `Metrics` page shows «—» for *forecast* (placeholder). | Mixed (see text) |

### P3 — polish

| ID | Finding | Status |
|---|---|---|
| F-27 | Language: `zh` falls back to English in both new areas while the nav mixes English and Chinese («账单库»); raw keys leak into text (plan scope label shows the source key, `PlanningArea.jsx:48`; «المصدر: housing_sales»); suggestion «…مشابهاً للتقارير المرفقة» and fixed-report purposes («كما في ملحق التقرير الشهري») refer to documents the user of the product has not seen. | Verified |
| F-28 | ≈ 1,750 lines of orphaned modules remain (`cfoModel.js`, `cfoBoardPackReport.js`, `decisionRoomDemoData.js`, `CFOControlPanel.jsx`, six chart components, `ProvinceMap.jsx`, `ksaProvinces.js`, `provinceStats.js`, `planningData.js`, `unpaidReport.js`, `AmanahReports.jsx`, `Amt.jsx`, `DemoDataBadge.jsx`) plus unused CSS; legacy session state (`ib_rev_scenario`, `ib_rev_fc_versions`) is still written. Some orphans hold illustrative ministry-style figures that the "no real data" rule says must not live in the demo. Everything is uncommitted. | Verified (bundle metafile) |
| F-29 | Planning section anchors: after clicking «السيناريوهات» the section top is 54 px while the sticky header ends at 123 px — the heading is hidden under it (DOM measurement; not seen visually). | Verified (DOM) |
| F-30 | `window.prompt` is used to name a plan and to give a rejection reason (`PlanBar.jsx:14`, `ActionRegister.jsx:38`): blocking, not styled, unsuitable for RTL, and may be suppressed in embedded browsers. | Verified (code); Not tested (native dialog) |
| F-31 | The login page sits behind the data-service loader (provider order in `src/main.jsx`), so a data-service outage blocks sign-in. Tab title/branding see F-18. | Verified (code) |

---

## 4. Duplication and financial/reporting consistency assessment

### 4.1 Indicator matrix (same scope: YTD, all Amanahs, 2026-10-09)

| Measure | Dashboard | Fixed (monthly) | Smart | Planning | Consistent? |
|---|---|---|---|---|---|
| Gross billed | 14.92 bn | 14.92 bn | 14.92 bn | – | ✔ |
| Exclusions / rate | 1.36 bn · 9.1 % | 1.36 bn · 9.1 % (but "unavailable" in relations block) | same | – | ⚠ F-02 |
| Net billed | 13.56 bn | 13.56 bn | 13.56 bn | 13.56 bn | ✔ |
| Collected / rate | 7.83 bn · 57.8 % | same | same | same | ✔ for an open period; ✖ for a closed period (F-01) |
| Uncollected (period) | 5.72 bn | 5.72 bn | 5.72 bn | 5.72 bn | ✔ |
| Standing balance | 13.39 bn / 252 inv. | in aging/insights | in insights | – | ✔ but two "uncollected" numbers on one screen are easy to confuse |
| Receipts YTD (payment date) | – | in Trends | – | 8.41 bn | ⚠ F-23 |
| Delta vs last year | tile ▲▼ | table | chip | – | ✖ closed periods |
| Budget execution / coverage | synthetic card | synthetic report | not available | synthetic | ✔ labelled, national-only |

### 4.2 Definitions

- Formulas Net = Gross − Exclusions; Uncollected = Net − Collected; Rate = Collected ÷ Net; Exclusion rate = Exclusions ÷ Gross: **applied consistently** and the reconciliation checks pass on every checked view.
- Billed vs cash, period invoices vs period receipts, period uncollected vs standing balance: **distinguished and labelled** — but the *as-of* date of the collected amount is not (F-01).
- Units: one unit per table/chart (bn/M/K SAR) — consistent in the views checked; the retired unit «ألف مليون» does not appear.
- Actual vs synthetic vs target vs forecast vs scenario: tags are consistently present on the Planning page. **One gap:** the plan summary export's "coverage unavailable" statement contradicts its own coverage table (F-10).
- Missing vs zero: correct on Dashboard/Fixed/Planning; wrong in Smart (F-11).
- Dates/time zone: Asia/Riyadh, cut-off 2026-10-09 shown on every view; no future-dated actuals observed.

---

## 5. Proposed corrected journeys and navigation

### 5.1 Navigation

```
Management
 ├─ لوحة المعلومات والتقارير      (Dashboard · Fixed reports · Smart reports)   one shared context bar
 └─ التخطيط المالي والاستراتيجي   (Plans · Objectives · Scenarios · Decisions)  one plan header
Operations  (a grouped menu, not 7 more top-level tabs)
 ├─ Invoices (+ Sanad orders, Investment invoices as sub-views)
 ├─ Collection worklist
 ├─ Exclusions review (+ rule/config management, clearly marked "affects management figures")
 ├─ Contracts & enforcement
 └─ Data: sources, quality and the metric dictionary (one place; the fixed report "completeness" links here)
```

One **context bar** (period · scope · basis "collections to …" · data cut-off · configuration state · synthetic flag · loading/error) on every management page and on Smart reports, with an explicit "this conversation uses filters X (sync with dashboard)" control.

### 5.2 Journeys

1. **Monitor → drill:** Dashboard → click a tile/row → destination opens with the same scope as visible chips (never a hidden filter) → breadcrumb back.
2. **Report:** Fixed report opens with its own fixed basis; comparison uses one rule; Export (Word/Excel/PPT) shows a parity statement ("pages n/m, tables complete").
3. **Ask:** Smart report → prompt → "I understood: …" line (editable) → generate → report with "as of" stamp → refine → save/reopen (re-opens the *stored* result with an option to refresh).
4. **Plan:** pick or create a plan (period/scope/basis/owner/version) → all numbers computed for the plan's own scope → objectives → budget/expenditure → forecast/gap → scenarios.
5. **Scenarios:** several named scenarios per plan, side-by-side comparison against the baseline, saved with the plan version they belong to.
6. **Decide and follow:** proposal → approval by an authorised role → owner/due → status → outcome measured against the same indicator that motivated the action; each action links to plan version and objective.
7. **Back to operations:** every proposal/gap links to the exact invoices (scope carried over, visible).

---

## 6. Phased remediation plan

| Phase | Goal | Contents | Exit test |
|---|---|---|---|
| **0 — Stop-the-line** (days) | remove wrong output | F-01 shared measurement rule; F-02 totals contract; F-03 remove/replace recommendations; F-09 language swap; F-10 PowerPoint truncation + total row; F-12 loading/error banner; F-17 broken link; F-05 "recognised-but-not-applied" guard and the four worst phrasings; F-07 block/auto-draft on approved-plan edit; F-06 scenario button → *proposed* | cross-view consistency test (same scope → same numbers, same comparison conclusion); export-parity test; zero English strings in Arabic UI |
| **1 — Consistency** (1–2 weeks) | one data contract | plan-anchored planning (F-04) + version stores scope/basis/config/data version; shared context bar (F-18/F-21); unify empty states (F-11/F-14/F-25); proposal ids with scope (F-15); hidden-filter fix (F-13); exclusion terminology (F-08); configuration-state indicator (F-20); Smart golden corpus (F-05); display-name resolver (F-07) | golden-phrase suite; plan reproducibility (re-open v1 under a different filter → identical results); approval workflow tests |
| **2 — UX / IA** (1–2 weeks) | coherent journeys | navigation regrouping and brand/title (F-18); Smart UX (scroll, replay, titles, as-of stamp, filter sync, draft keep) (F-16); scenario comparison and named scenarios (F-24); mobile header; anchors under sticky header (F-29); replace `window.prompt` (F-30); remove duplicate KPI blocks and the second assistant button (F-21); municipality row labels (F-22) | usability pass on J1–J7; 390/768/1280 px review; keyboard/RTL checks |
| **3 — Platform** (planned dependencies) | persistence and trust | server-side store for plans/objectives/actions/conversations with identity and roles (F-19); real approval authority; commit history and removal of orphaned modules (F-28); LLM option if free-text is wanted | role-based tests; audit-trail review |

Regression tests to add now (cheap, high value): cross-view parity for one closed and one open period; `relations` block contract; export parity (rows/totals/units/notes); bilingual script check; interpreter golden phrases; plan reproducibility; proposal id stability.

---

## 7. Questions that materially affect the solution

1. **Basis for closed periods:** should the headline for a closed month be "collections to period end" (like-for-like, recommended) or "to today"? Should both be shown?
2. **Smart reports and filters:** should a Smart conversation follow the dashboard filters live, or keep its own scope with an explicit "sync" control (recommended)?
3. **Planning anchor:** may planning figures ignore the global filter and always use the plan's period/scope (recommended)? Are plans always fiscal-year based?
4. **Approval authority:** who may approve plans, objectives and actions; is self-approval allowed; do you need separate roles (proposer / approver / owner)?
5. **Exclusions:** should exclusions based on *unapproved* rule definitions reduce the headline net billed and collection rate, or be shown as a separate "pending" band until approved?
6. **Smart reports scope:** must they also cover budget/expenditure, or should they redirect to the fixed report?
7. **Languages:** is Chinese required in the new areas, or can it be removed/limited to navigation?
8. **Scale:** should the demo be reviewed at the compact size (~900 invoices) only, or at the full size where loading states matter?
9. **Synthetic expenditure:** keep the synthetic budget/expenditure card on the dashboard by default, or only in the budget report and planning?
10. **Persistence timing:** is a server-side store for plans/actions part of the next phase, or does the demo stay browser-local?

---

## 8. Limits of this audit (what was not tested)

- Screenshots attached to the brief were not visible to me.
- Roles/permissions: the demo has one reviewer user (`canReview: true`); read-only behaviour and organisation switching were **not** exercised.
- Native `window.prompt` flows (new plan, reject proposal): not exercised.
- Word files were not opened visually; Excel and PowerPoint were parsed programmatically.
- Full-size demo (~1.65 M invoices), dark mode and a data-service outage were not re-tested in this pass (a retry/error path was verified in an earlier session).
- Configuration changes on `/noncollection` and approval of plans/actions were deliberately not exercised (they would change shared state).
- Generation interrupted by navigation (F-16 g) could not be reproduced at the compact size.

## 9. Test artifacts and one unintended change (disclosure)

- **Unintended:** while testing, one scripted input event reached the saved plan «خطة السنة المالية 2026» and changed its live scenario `dRate` from **3 to 8**. Nothing else in the plan changed (verified by a field-by-field diff). The original value was **3**; a backup of the original `ib_plans_v1`, `ib_actions_v1` and `ib_smart_convs_v1` values is held in this tab's `sessionStorage` key `__audit_bak`. I did not repair it because further writes were blocked by the environment and you asked for no data changes.
- **Test conversations:** about four Smart-report conversations/messages created during the journey tests (they are visible in «السجل»).
- UI state only: shared filters were moved during testing and restored to *year to date / all*; language was switched to Chinese and back to Arabic.
- No source files, configuration or git state were modified; the only file added is this document.

---

# PART B — Content clarity, information hierarchy and dates (extension of the audit)

Added 2026-10-09. Same rules: read-only, evidence labelled as in the legend at the top. Finding ids continue the audit: **C-** content, **H-** hierarchy, **D-** dates and periods.
Priority rule used here: anything that can mislead about **financial results or reporting periods** comes first (P0/P1), wording and layout follow.

Measurements taken in the running app (Arabic UI, YTD, all Amanahs, 2026-10-09; "chrome" = sticky top bar + tab strip = 278 px at 1280 px):

| Page | Words on page | Explanatory text (notes, callouts, subtitles) | Page height | First KPI / first section at | Controls before first KPI/section | Other |
|---|---|---|---|---|---|---|
| Dashboard | 885 | 273 words (31 %) | 5,353 px | KPI at 628 px | 21 | 37 `title` tooltips; "SAR" ×57; "تجريبي/اصطناعي" ×6; the identity "الإجمالي − الاستبعادات / الصافي − المحصّل…" ×5 |
| Fixed list | 216 | – | – | – | – | the tag «يُفتح مباشرة» ×9 |
| Monthly fixed report | 3,531 | 30 notes + 3 callouts | 17,824 px | **first KPI at 1,000 px** (below a 900 px screen); first section heading at 1,465 px | – | "تجريبي/اصطناعي" ×14; "SAR" ×86; each insight = 12 lines / 86 words |
| Planning | 2,023 | – | 10,548 px | first section at **1,280 px** | 23 | 41 pills (23 distinct texts); "تجريبي" ×22; «غير معتمد» ×12; one proposal = 15 lines / 134 words; scenario lever = 15–27 words; the register section alone = 990 words |
| Smart (empty) | 99 | banner 33 words | – | composer at 724 px of 800 | – | – |

---

## 10. Content and clarity

### 10.1 What is wrong, in order of risk

| ID | Sev. | Finding | Evidence |
|---|---|---|---|
| **C-01** | P0 | **Unsupported or false statements shown as fact.** (a) Dashboard header: «أرقام واحدة في كل الواجهات الثلاث» — false for closed periods (F-01). (b) Monthly report: «لا توجد تدخلات موصى بها لهذا النطاق» next to «يستدعي إجراء» (F-03). (c) Fixed-report note «كل فترة تُقاس عند نهايتها (المدة المنقضية نفسها)» while the current figure is measured at today (F-01). (d) Relations block: «نسبة التحصيل غير متاحة» for an available figure (F-02). (e) «قواعد معتمدة» / «مستبعدة وفق قاعدة معتمدة» for exclusions that are 99.7 % unapproved (F-08). (f) Assumption «فقط الاستبعادات المعتمدة… تخفض صافي المفوتر» vs 811 M of unapproved exclusions in the same report. (g) Fixed-report empty state «العام السابق خارج نطاق البيانات» when the real reason is "no invoices" (F-25). (h) Tooltip «اكتمال البيانات 93 %» has no definition anywhere (Verified UI: the popover lists it with no explanation; Hypothesis: it is a derived field without a documented formula). | Verified (UI) a–g |
| **C-02** | P1 | **One concept, five names.** "Uncollected" is shown as «غير المحصّل» (period), «الإجمالي القائم» / «رصيد قائم» (standing balance), «المتبقي» (Collection page, Planning tile «غير المحصّل (المتبقي)»), «صافي غير المحصل» (Noncollection page, no shadda). The Dashboard shows two different "uncollected" numbers (5.72 bn and 13.39 bn) in adjacent cards. Likewise «المحصّل» (collected on period invoices) vs «المقبوض» (receipts by payment date) vs «المقبوضات» (Planning) are three words for two measures. | Verified (UI) |
| **C-03** | P1 | **Technical implementation exposed to business users:** rule codes and versions (`EXCL-RULES v2 (demo configuration)`, INC-1/EXE-1/EFA-1/NOC-1/DEC-1/OBJ-1/ENF-1), action ids (`ACT-MV0XEEXSR21`) as pills, "✓ المعادلات متحققة", «أيام السماح: 0 (غير محسوم)», raw keys (`housing_sales`), "Σ", "pp", "عينة مضغوطة 895", «الديمو», «خلية أمانة × مصدر», «مقام المؤشر», system names «تحصيل/مكين/إيفاء/فرص» as unexplained sources (and «تحصيل» is also the Arabic word for "collection"). | Verified (UI/code) |
| **C-04** | P1 | **Disclaimers repeated instead of stated once.** "Synthetic/demo" appears 6× on the Dashboard, 14× in a report, 22× in Planning; «غير معتمد» 12× in Planning; the same three-sentence caveat set (basis, target is a demo, not collectible) is repeated under every insight. | Verified (UI) |
| **C-05** | P1 | **Important information buried.** In the monthly report the first KPI starts at 1,000 px under a 9-row context table and a report selector; the "what needs attention" items sit mid-page; in Planning, 23 controls and a 62-word plan bar precede the first section; the Dashboard has **no** "needs attention" block at all although the engine computes insights. | Verified (UI) |
| **C-06** | P2 | **Rhetorical headers and meta-text** that explain the screen instead of using it: «كيف الأداء الآن، وأين الانحراف، وأي تقرير أرفع؟…», «ما أهدافنا؟ هل نحقق المستهدف؟ ما التوقع والفجوة؟ ماذا يتغير في السيناريوهات؟ ومن يتولى كل مبادرة؟», tab hints, «يُفتح مباشرة» ×9, intro paragraph above the Amanah map. | Verified (UI) |
| **C-07** | P2 | **Dense AI/assistant text.** Every Smart reply opens with «أعددتُ التقرير من بيانات النظام… وأبقيتُ بقية المرشحات كما هي»; the planning assistant repeats a rule-based/simulation disclaimer in the header **and** under every answer; a proposal card carries 15 lines. | Verified (UI) |
| **C-08** | P2 | **Mixed language and currency style in an Arabic UI:** "SAR" ×57 on the Dashboard, "pp", English strings in proposals (F-09), ISO dates with arrows («2026-01-01 → 2026-10-09»). | Verified (UI) |
| **C-09** | P2 | **Tooltips carry essential information** (the "?" popover holds the only explanation of each KPI's basis; `title` attributes ×37 are hover-only, not available on touch) and the popover lists 10 fields including system sources and rule version. | Verified (UI/code) |
| **C-10** | P3 | References to material the user cannot see in the product: suggestion «جهّز تقريراً شهرياً مشابهاً للتقارير المرفقة», report purposes «كما في التقارير الشهرية / ملحق التقرير الشهري». | Verified (UI) |

### 10.2 Current vs proposed Arabic wording

Principles used: lead with the conclusion, one idea per line, numbers before explanations, no system jargon, one unit style («مليار ريال»), exact dates in words, caveats once and in expandable details. (The proposals are drafts for review by an Arabic content owner — see question Q16.)

| # | Where | Current | Proposed | Remove / shorten / move |
|---|---|---|---|---|
| 1 | Dashboard title + subtitle | «لوحة المعلومات والتقارير» + «كيف الأداء الآن، وأين الانحراف، وأي تقرير أرفع؟ — أرقام واحدة في كل الواجهات الثلاث.» | **«أداء الإيرادات والتحصيل»** + «فواتير صدرت من 1 يناير إلى 9 أكتوبر 2026 · كل الأمانات · كل المصادر» | Remove the rhetorical sentence and the false "same numbers" claim; make the subtitle show the live period and scope. |
| 2 | View tabs | «لوحة المعلومات — رصد الأداء الآن» / «التقارير الثابتة — صيغ قياسية تُفتح مباشرة» / «التقارير الذكية — تحليل مخصص بالطلب» | «لوحة المعلومات» · «التقارير الجاهزة» · «اسأل واحصل على تقرير» | Remove the second line (also Arabic-only in EN/ZH). |
| 3 | Status strip (4 chips) | «بيانات حتى 2026-10-09 (الرياض)» · «386 فاتورة · 19 أمانة · 8 مصدر» · «بيانات تجريبية اصطناعية — عينة مضغوطة 895» · «فواتير صادرة في الفترة؛ التحصيل حتى 2026-10-09» | One line: **«386 فاتورة صدرت في هذه الفترة · المحصّل محسوب حتى 9 أكتوبر 2026»** + one global badge «بيانات تجريبية» in the header | Merge four chips into one sentence; move "عينة 895" and "الرياض" into the badge's details. The 386 vs 895 pair is confusing side by side. |
| 4 | KPI delta | «▲ +6.7 pp مقابل نفس الفترة من العام السابق» | «▲ 6.7 نقطة مئوية عن العام الماضي» | Replace "pp" and shorten. (Value and delta must use the same as-of date — F-01.) |
| 5 | KPI sub-lines + relations caption | «قبل الاستبعادات» · «الإجمالي − الاستبعادات» · «ضمن صافي المفوتر» · «الصافي − المحصّل» · «المحصّل ÷ صافي المفوتر × 100» + two caption lines repeating the same identities under the bar | Keep one short descriptor per tile («قبل الاستبعادات», «بعد الاستبعادات», «من الصافي», «المتبقي من الصافي», «من الصافي»); show the two identities **once** as the bar caption | Remove the repeated formulas from tiles; the formula belongs in the "?" panel. |
| 6 | Uncollected naming | tile «غير المحصّل» · table «الإجمالي القائم» · «رصيد قائم» · «المتبقي» | tile **«غير محصّل من فواتير الفترة»**; table **«الرصيد القائم — كل الفواتير غير المسددة حتى 9 أكتوبر»**; use «المتبقي» nowhere | One name per concept, across Dashboard, Collection, Planning, exports. |
| 7 | Standing-balance note | «رصيد في 2026-10-09 لكل ما صدر حتى ذلك التاريخ، وليس غير محصّل الفترة.» | «يشمل كل الفواتير غير المسددة مهما كان تاريخ إصدارها.» | Shorten; the title already says "حتى 9 أكتوبر". |
| 8 | Comparison note | «المقارنة بالفترة المكافئة (2025-01-01 → 2025-10-09): نسبة التحصيل 51.1% سابقاً.» | «في الفترة نفسها من العام الماضي (1 يناير – 9 أكتوبر 2025): 51.1٪» | Dates in words; drop "المكافئة". |
| 9 | Amanah map | intro «النسبة والمبلغ والاتجاه معاً، مع حجم كل أمانة… فالمبلغ وحده يرتب الأكبر فقط.»; columns «الاتجاه (نقطة)», «المتبقي», «% من صافيها», «% من الإجمالي»; tag «عينة صغيرة» | no intro; columns **«التغير عن العام الماضي (نقطة)»**, **«غير المحصّل»**, **«نسبة غير المحصّل من صافيها»**, **«حصتها من غير المحصّل»**; tag **«أقل من 10 فواتير»** | Remove the paragraph; name columns by what they show. |
| 10 | Budget card | tag «تجريبية اصطناعية» + «الميزانية المتناسبة حتى اليوم» + «تغطية الإنفاق التشغيلي (أبواب 1–3)… مقبوضات ÷ صرف نقدي للفترة نفسها» + «تجريبية اصطناعية — ليست بيانات إنفاق فعلية للوزارة.» | title «الميزانية والصرف (بيانات تجريبية)»; tiles «الميزانية حتى اليوم» · «الالتزامات» · «المصروف نقداً» · «تغطية المصروفات التشغيلية: 56٪ (المقبوضات ÷ المصروف)» | One synthetic marker; "المتناسبة" replaced by plain wording; definition in "?". |
| 11 | Operational links line | «وحدات تشغيلية: الفواتير · قائمة التحصيل · العقود… » | — | Remove from the page; it belongs to navigation (§5.1). |
| 12 | Data-status chips | «✓ المعادلات متحققة» · «قواعد الاستبعاد: v2 · مراجعة» · «أيام السماح: 0 (غير محسوم)» · «EXCL-RULES v2 (demo configuration)» | nothing in the normal state; show a **warning chip only when relevant**: «استبعادات غير معتمدة تؤثر على 811 مليون ريال» → opens the details | Move all of these into a «حالة البيانات ▾» panel. |
| 13 | KPI "?" panel (10 fields) | التعريف · المعادلة (with Σ) · الفترة · أساس التاريخ · النطاق · المصادر «تحصيل، مكين» · آخر تحديث · إصدار القاعدة · اكتمال البيانات 93% | **Visible:** «ما هو؟» (one sentence), «كيف يُحسب؟» (words, not Σ), «ما الذي لا يشمله؟». **تفاصيل تقنية ▾:** المصادر، إصدار القواعد، آخر تحديث | Define or remove "اكتمال البيانات 93%". Panel must open on keyboard focus and tap, not only hover (NN/g tooltip guidelines). |
| 14 | Fixed-report cards | «1. الملخص التنفيذي الشهري للإيرادات — الصيغة الشهرية المعتادة: الأداء مقابل نفس الفترة من العام السابق، المصادر، الأمانات، الاستبعادات وأكبر فجوات التحصيل. [يُفتح مباشرة]» | «ملخص شهري — الأداء والمقارنة بالعام الماضي وأبرز الفجوات» (no number, no tag) grouped under «ملخصات» · «تحليل» · «متابعة وجودة» | Remove numbers (they imply a sequence), the repeated tag, and the references to source monthly reports. |
| 15 | Fixed-report header | 9-row context table + report picker before the first KPI | one line «1 يناير – 9 أكتوبر 2026 · كل الأمانات · كل المصادر · المحصّل حتى 9 أكتوبر» + «تفاصيل التقرير ▾» | First KPI must be visible without scrolling. |
| 16 | Insight card (12 lines) | «فرصة متابعة: قطاع الإسكان — رسوم الأراضي البيضاء · تقدير — راجع الافتراضات · يستدعي إجراء · نسبة التحصيل 26.4% مقابل مستهدف تجريبي 60%. الفجوة التقديرية 977.58 مليون SAR هي ما يلزم تحصيله للوصول للمستهدف على صافي هذه الخلية. [5 أرقام] · الأساس: … · تحفظ: …» | **«رسوم الأراضي البيضاء (قطاع الإسكان): التحصيل 26.4٪ مقابل 60٪ مستهدف»** · «غير المحصّل 2.14 مليار ريال» · [عرض الفواتير] · «الأساس والتحفظات ▾» | 12 lines → 3 visible; basis/caveat in the expander. |
| 17 | Report tail callouts | «غير متاح في هذا الديمو: التحصيل الفعلي من «تحصيل» (غير مربوط)، مستهدفات… لا تُقدَّر.» + 8 assumption bullets | «بيانات غير متوفرة حالياً (5) ▾» listing them + «ملاحظات منهجية ▾» (3 bullets max) | Remove «الديمو», «موسومة», «بطرح تقارير تراكمية»; keep only what changes how to read the numbers. |
| 18 | Empty selection | «لا فواتير في هذا الاختيار. البيانات غير متاحة لهذه المرشحات؛ وسّع الفترة أو أزل مرشحاً. لا تُعرض أصفار بدلاً من الغياب.» | **«لا توجد فواتير ضمن هذا الاختيار.»** + «جرّب فترة أوسع أو أزل أحد المرشحات.» + button **[إعادة ضبط المرشحات]** | Remove the developer rationale; add the missing reset action. |
| 19 | Invalid range | (no message; falls into the empty state) | «تاريخ البداية بعد تاريخ النهاية — صحّح الفترة.» inline under the fields | New message (D-01). |
| 20 | Smart banner (33 words) | «يفهم هذا المساعد طلبات محددة (الفترة، الأمانة، البلدية، المصدر، الحالة، المقارنة، أقسام التقرير) بقواعد حسابية — وليس نموذجاً لغوياً — وتُبنى التقارير مباشرة من بيانات النظام. البيانات تجريبية اصطناعية.» | «اكتب طلبك: الفترة، الأمانة، المصدر، أو المقارنة.» + «أمثلة ▾» + «عن المساعد ▾» (rule-based, not a language model) | Keep the honesty note, but not as the first thing a manager reads. |
| 21 | Smart reply | «أعددتُ التقرير من بيانات النظام. الفترة: 2026-10-01 → 2026-10-09 وأبقيتُ بقية المرشحات كما هي.» (also after clarification questions — F-16c) | «تقرير الإيرادات · 1–9 أكتوبر 2026 · كل الأمانات» + chips of **what changed** («تغيّرت الفترة») | Say what was understood, not that data came from "system data". |
| 22 | Smart unsupported | «لم أستطع تحويل هذا الطلب إلى تقرير. أفهم طلبات محددة بقواعد وليس نصاً حراً. جرّب أحد الاقتراحات أو أعد صياغة الطلب:» | «لم أفهم الطلب. جرّب مثلاً: …» (3 examples) | Shorter, no "نصاً حراً". |
| 23 | Planning header | «ما أهدافنا؟ هل نحقق المستهدف؟ ما التوقع والفجوة؟ ماذا يتغير في السيناريوهات؟ ومن يتولى كل مبادرة؟» | «خطة {الاسم} · الإصدار {n} · {الفترة} · {النطاق}» | Remove the five questions; the plan bar already says what this is. |
| 24 | Target disclaimers (12×) | «لا مستهدفات معتمدة في البيانات؛ ما يُعرض مُدخل ينتظر اعتماداً» · «مُدخل تجريبي — يُعدَّل من الحقل أدناه» · «مدخلات المستهدف (غير معتمدة)» · «محسوبة من مستهدف غير معتمد» · «مستهدف الإيرادات — غير معتمد» | **One banner:** «المستهدفات الحالية تجريبية وغير معتمدة.» + one «تجريبي» chip on target columns + one legend «فعلي · مستهدف · تنبؤ · سيناريو» | 41 pills / 23 texts → ≤ 6. |
| 25 | Plan-bar disclaimer | «اعتماد الخطة يخص افتراضاتها فقط؛ لا يجعل أي مستهدف معتمداً ولا يغيّر أي بيانات فعلية.» | tooltip on **«اعتماد الخطة»**: «يعتمد افتراضات الخطة فقط، لا المستهدفات.» | Move to tooltip. |
| 26 | Scenario levers | «نسبة التحصيل الإضافي التي تصل بعد تاريخ التخطيط (0 … 100 %)» + 25-word hint; «حسم الحالات المعلقة» / «منها تُحسم كاستبعاد» + hints; button «اقتراح إجراء من هذا السيناريو» | «تأخّر المقبوضات الإضافية عن تاريخ الخطة (٪)»; «مراجعة الاستبعادات المعلّقة (٪)» / «نسبة ما يُقبل استبعاده (٪)»; hint in ⓘ; button **«إنشاء مقترح»** (and it must create a *proposal*, F-06) | Visible text per lever ≤ 8 words; range shown on focus. |
| 27 | Scenario result tile | «فجوة المستهدف (غير معتمد) 0 SAR — الأساس 0.3 مليار SAR · مستهدف 60%» | «المتبقي للوصول إلى 60٪: لا شيء (كان 0.3 مليار ريال)» | Plain wording; zero explained. |
| 28 | Proposal card (15 lines, partly English) | title · priority · «مقترح — لم يُعتمد» · issue sentence · «الإجراء المقترح: …» · evidence line · 5 evidence figures · «الأثر المتوقع: … (تقدير) · … · جهة مقترحة للمراجع: … · خلال 30 يوماً (مقترح)» · 2 buttons | **title · «التحصيل 26.4٪ مقابل 60٪ المستهدف» · «الأثر الأعلى المحتمل: 977 مليون ريال» · [مراجعة] [رفض]** and «التفاصيل ▾» for evidence, owner hint, timeframe | 15 → 5 visible lines; fix language swap (F-09). |
| 29 | Assistant disclaimers (planning) | header «محاكاة مساعد بقواعد حسابية — ليس نموذجاً لغوياً · بيانات تجريبية» + footer under every answer «إجابة محسوبة بقواعد (محاكاة) من البيانات التجريبية؛ لا تُنسب أسباب غير مسجلة.» | header only: «مساعد التخطيط (يعمل بقواعد محددة)»; no per-answer footer | Say it once. |
| 30 | Money and dates everywhere | «13.56 مليار SAR», «2026-01-01 → 2026-10-09» | «13.56 مليار ريال», «1 يناير – 9 أكتوبر 2026» (ISO stays in exports/URLs) | One style; see D-10 and Q12. |

### 10.3 Glossary to freeze (one term per concept, Arabic)

| Concept | Use | Do not use |
|---|---|---|
| Invoices issued in the period, before exclusions | **إجمالي المفوتر** | – |
| Removed from the base | **الاستبعادات** (and state which part is cancelled vs rule-based) | «مقام المؤشر» |
| After exclusions | **صافي المفوتر** | – |
| Paid on the period's invoices up to the stated date | **المحصّل** («حتى {تاريخ}») | المقبوض (different measure) |
| Cash received in the period by payment date | **المقبوضات** | المحصّل |
| Net billed − collected, for the period's invoices | **غير محصّل من فواتير الفترة** | المتبقي |
| All unpaid invoices as of a date, any issue date | **الرصيد القائم** | الإجمالي القائم / صافي غير المحصل |
| Collected ÷ net billed | **نسبة التحصيل** | – |
| System names | **نظام تحصيل / نظام مكين / نظام إيفاء / منصة فرص** (full form on first use) | «تحصيل» alone |
| Unit | **ريال** / مليون ريال / مليار ريال | SAR in Arabic text |

---

## 11. Information hierarchy

### 11.1 Can a decision-maker answer the five questions?

(● yes · ◐ partly · ○ no — Verified UI)

| Page | What is this page for? | Which period and scope? | What do the main figures mean? | What needs attention? | What can I do next? |
|---|---|---|---|---|---|
| Dashboard | ◐ rhetorical subtitle | ◐ chips exist but in ISO and 8 other chips compete | ● six KPIs + "?" | **○ no attention block** | ◐ 7 scattered links; no primary action |
| Fixed report | ● purpose line | ◐ 9-row table, KPI at 1,000 px | ● | ◐ insights mid-page (and wrong recommendations, F-03) | ◐ export only |
| Smart | ● welcome + examples | ● chips | ◐ depends on report | ○ | ● follow-ups |
| Planning | ○ five questions | ◐ plan bar shows plan scope, but the numbers follow the filter (F-04) | ◐ many tags | ○ no status summary of plan/objectives/risks | ◐ buttons spread over 6 sections |
| Operational pages | ◐ | ◐ own full filter bar | ● | ◐ | ● |

### 11.2 Recommended reading order and progressive disclosure

Rules (from the references in §13): a dashboard is a glanceable overview — the most important content first (for RTL: top-right), details one level down, at most **two** disclosure levels, labelled triggers; tooltips only for short supplementary text, never for essentials.

**Dashboard (target ≤ 450 words visible, first KPI above 450 px)**

1. **Header line:** title · exact period and scope in words · freshness · one «بيانات تجريبية» badge.
2. **«يتطلب انتباهاً» (max 3 items):** e.g. «82٪ من الرصيد القائم متأخر أكثر من 90 يوماً» · «التحصيل في رسوم الأراضي البيضاء 26٪» · «استبعادات غير معتمدة بقيمة 811 مليون ريال» — each with one link.
3. **The chain (4 tiles):** إجمالي المفوتر → الاستبعادات → صافي المفوتر → المحصّل, then **نسبة التحصيل** (with delta) and **غير محصّل من فواتير الفترة**.
4. **Trend** (one chart) with the comparison.
5. **Where:** Amanah table (top 5 + «عرض الكل») and sources.
6. **الرصيد القائم** (aging).
7. **Budget and expenditure** (collapsed by default; synthetic).
8. **حالة البيانات ▾** (rules, identities, coverage, config) — everything now in the chips/footers.

**Fixed report:** title + one-line scope → **headline KPIs** → the report body → «تفاصيل التقرير ▾» (context table, assumptions, unavailable data). One "report-specific" KPI strip instead of the same seven tiles in all nine reports (F-21).

**Smart:** keep the conversational layout; collapse the banner; show the interpreted request as the first line of every answer.

**Planning:** plan header (name · version · status · period · scope) → **plan status summary** (objectives met/at risk/off track, funding balance, open actions) → six sections with one-sentence purpose each; plan-bar editing fields behind «تعديل بيانات الخطة ▾»; register shows 3 lines per item.

**Targets for the next review (proposals, not research findings):** Dashboard ≤ 450 visible words; monthly report first KPI < 450 px, ≤ 1,800 words in the default view; Planning first section < 600 px; ≤ 6 pills per page; every tooltip ≤ 25 words.

---

## 12. Dates and reporting periods

### 12.1 Findings

| ID | Sev. | Finding | Reproduce / evidence | Root cause | Correction |
|---|---|---|---|---|---|
| **D-01** | **P0** | **An inverted range is accepted and reported as "no invoices".** | Dashboard → Filters → set "From" 2026-06-01 and "To" 2026-03-01 → chip «2026-06-01 → 2026-03-01» and the message «لا فواتير في هذا الاختيار… وسّع الفترة». *Verified (UI).* | `ScopeBar` (`RevenueUI.jsx:118-120`) sets `min/max` attributes only; `setCustomRange` (`RevenueContext.jsx:131`) does no validation; typed values bypass the attributes. The Smart `FilterPanel` has the same attribute-only protection (`SmartReports.jsx:50-52`). | Validate on every change; inline error «تاريخ البداية بعد تاريخ النهاية»; never run a query for an invalid range; never show the empty state for it. |
| **D-02** | **P0** | **Selected period can start before the data exists, with no coverage warning.** Data starts at 2025-01-01 (`DATA_START`); "From" has no `min`; 2020-01-01 → 2026-10-09 is accepted and shows 36.85 bn gross billed (895 invoices) as if 2020–2024 were covered. | *Verified (UI).* `ScopeBar` "From" has `min=""`; the fixed preset «كل البيانات» does not say it starts on 1 Jan 2025. | coverage is a constant, not part of the control. | `min = data start` on "From"; show a line «البيانات متاحة من 1 يناير 2025 حتى 9 أكتوبر 2026»; clamp or warn when the choice is partly outside; label «كل البيانات» with its actual start. |
| **D-03** | P1 | **«آخر 3 أشهر» has no stable meaning.** It is computed as `startOfMonth(startOfMonth(today) − 62 days)`, which gives **77–107 days** and **2 or 3 complete months** depending on the month: on 15 Feb it is 1 Dec–15 Feb (2 complete months + MTD); on 15 Sep it is 1 Jul–15 Sep (2 complete months + MTD); on 15 Oct it is 1 Jul–15 Oct (3 + MTD). The required-pace card separately uses "the last 3 **complete** months". | *Verified (function output for the 15th of each month of 2026).* `assistantRouter.js:38`, `RevenueContext.jsx:19`, `strategicCalc.js:99`. | a day-count heuristic instead of calendar arithmetic; two definitions. | Define two presets explicitly (see 12.2): **آخر 3 أشهر مكتملة** (e.g. on 9 Oct: 1 Jul–30 Sep) and, if needed, **آخر 90 يوماً**. Use one function everywhere, including the AI interpreter. |
| **D-04** | P1 | **Requests for a quarter that has not started produce a reversed range.** «الربع الثاني» asked on 2026-02-10 → 2026-04-01 → 2026-02-10; «الربع الرابع» asked on 2026-08-15 → 2026-10-01 → 2026-08-15. Month names silently mean the previous year when the month is later than today («مارس» in Feb = March 2025) with no statement. | *Verified (function output).* `assistantRouter.js:42-46,30-34`. | `q(n)` clamps only the end. | Reject future periods with a clear message («الربع الثاني لم يبدأ بعد»); show the interpreted dates; state the year choice. |
| **D-05** | P1 | **"Compare with last month" compares unequal periods.** For a year-to-date selection (1 Jan–9 Oct 2026) the Smart comparison "الشهر الماضي" uses **December 2025** (one month) against 282 days; for «آخر 3 أشهر» it uses June only. Only a single-month selection is compared with equal elapsed days (e.g. 1–9 Oct vs 1–9 Sep). | *Verified (function output).* `reportIntents.js:55-62` `previousMonthScope`. | the function assumes a one-month scope. | Allow "previous month" only for single-month scopes; otherwise offer "previous period of equal length" (which `previousScope` already supports) and say which was used. |
| **D-06** | P0 | **The as-of date of "collected" is hidden and differs by view and by comparison toggle** — see **F-01** (21.7 % vs 15.5 % for the same invoices). The label «التحصيل حتى 2026-10-09» exists but is a small muted line; in the Smart chips it always reads «حتى {نهاية الفترة}» even when the numbers were computed to today (`SmartReports.jsx:217`). | Verified (UI/code) | basis not part of the scope object. | Make **basis** an explicit, visible part of the scope: «المحصّل حتى: نهاية الفترة / اليوم». Default and wording in 12.3. |
| **D-07** | P1 | **Times shown to users are UTC and unlabelled.** Plan history, versions and action history print `at.slice(0,16)` of an ISO UTC string (`PlanBar.jsx:34-35`, `ActionRegister.jsx:125,130`); conversation history uses `toISOString()` (`SmartReports.jsx:239`); the report line «أُعدّ في …» and every export file name use the **UTC date** (`ReportView.jsx:87`, `exportReportModel.js:14`). Between 00:00 and 02:59 Asia/Riyadh the UTC date is the previous day, so a report can read «البيانات حتى 2026-10-10 · أُعدّ في 2026-10-09». | *Verified (code).* | `Date.toISOString()` used as a display format. | Format with `Intl.DateTimeFormat('ar-SA-u-nu-latn', {timeZone:'Asia/Riyadh'})`; show «بتوقيت الرياض» once; keep UTC in storage only. |
| **D-08** | P1 | **Preset set does not match the brief or common use.** Present: السنة حتى اليوم · هذا الشهر · الشهر الماضي · آخر 3 أشهر · كل البيانات. Missing: **اليوم**, **آخر ربع مكتمل / الربع الحالي حتى اليوم**, **آخر 12 شهراً**. «هذا الشهر» is really *month-to-date* and the label does not say so; the Smart panel has only two presets (`SmartReports.jsx:48-49`); the AI understands months/quarters that no control offers. | Verified (UI/code) | presets defined in three places (`RevenueContext.jsx:16`, `ScopeBar`, `SmartReports`). | One preset registry (12.2) used by the control, the chips, the AI interpreter and the exports. |
| **D-09** | P1 | **No clear active-filter state or reset.** Chips show values but there is no "filters changed from default" count, no removable chips and no «إعادة الضبط»; the empty state gives advice but no reset button; resetting means re-selecting each dropdown. Filters persist for the tab session (`sessionStorage`) and are shared by all pages, but nothing says so; Smart conversations keep their own scope. | Verified (UI/code) | `FilterChips.jsx` (no reset), `RevenueContext.jsx:43`. | Show «مرشحات مفعّلة (n)» + removable chips + one «إعادة ضبط» everywhere; state persistence («تُحفظ لهذه الجلسة»). |
| **D-10** | P2 | **Date format.** Dates are ISO strings («2026-01-01 → 2026-10-09») in chips, reports and tables; months in tables are «2026-01»; the arrow «→» between dates reverses visually in RTL; the native `<input type=date>` shows the browser/OS format with no on-screen hint; page `lang="ar"`, `dir="rtl"` are set correctly. The presentation of digits (Western vs Arabic-Indic) and of Hijri dates (Umm al-Qura is the official civil calendar of Saudi Arabia per secondary sources) is undecided. | Verified (UI/code); native control rendering not verified visually | no date formatter. | One formatter: «9 أكتوبر 2026» (Gregorian) with optional Hijri in a tooltip; ranges as «1 يناير – 9 أكتوبر 2026»; keep ISO in exports/URLs. Wrap embedded numbers/dates in `bdi` (W3C). See Q12–Q13. |
| **D-11** | P1 | **Issue, due, payment and as-of dates are not distinguished in the UI.** The invoice ledger has one date column, «التاريخ», plus «أيام التأخر»; the period filter selects by **issue date** but the page never says so; «أيام التأخر» is "—" for not-yet-due invoices with no due date shown; aging says «العمر بعد الاستحقاق» (due-date based) while the Dashboard trend says «شهر الإصدار». The basis exists in `snapshot.basis` and the "?" panel but not where users read figures. | Verified (UI) | one generic label. | Name every date column («تاريخ الإصدار», «تاريخ الاستحقاق», «تاريخ السداد»); add a «الفترة حسب: تاريخ الإصدار» line to the period control; see 12.3. |
| **D-12** | P2 | **Month-boundary and day-rollover.** `DEMO_TODAY` is evaluated once at page load (`clock.js:30`), so a tab left open past midnight keeps yesterday's "today"; stored presets re-anchor only on reload. Custom ranges stay fixed (correct). Time zone: the client and the server both use Asia/Riyadh (`server/store.js`, `engine.js` `timezone`) — **verified correct**. | Hypothesis (rollover); Verified (time zone) | static module constant. | Re-evaluate on focus / hourly and show «تم تحديث التاريخ». |
| **D-13** | P2 | **Planning periods.** The plan period is fixed to the calendar year when the plan is created and cannot be edited in the UI; the planning date is separate and may be in the future (correct separation); the page nevertheless analyses the dashboard filter (F-04). Fiscal year is treated as the calendar year (`targets.fiscalYear`, «السنة المالية» parsed as YTD) — correct only if the ministry's fiscal year is the Gregorian calendar year. | Verified (UI/code); fiscal-year assumption needs confirmation (Q14) | – | Editable plan period; one stated fiscal-year definition. |
| **D-14** | P2 | **Equivalent elapsed periods.** Year-over-year comparison uses the same dates one year earlier (correct, e.g. 1 Jan–9 Oct vs 1 Jan–9 Oct 2025); when the prior year starts before the data (< 2025-01-01) it silently switches to "previous period of equal length" and only the delta label changes; leap-day handling exists (`shiftYearIso`). | Verified (function output) | – | State the comparison dates in the delta line («مقابل 1 يناير – 9 أكتوبر 2025») and when the basis changes. |
| **D-15** | P2 | **Date-picker interaction.** Two native date inputs plus five presets in one row; no typed-format hint; no calendar-context support (day of week) because the native control is used; no keyboard/label review of the custom range (labels «من/إلى» are `aria-label` only); applies on every change (`onChange` calls `setCustomRange` immediately), so intermediate values while a year is being typed can trigger requests (Hypothesis: browser-dependent; not observed). | Verified (code); keyboard behaviour Not tested | native inputs applied on change. | Apply typed ranges on Enter/blur or with an «تطبيق» button; presets apply immediately (see 12.2). |

### 12.2 Recommended period control and exact preset meanings

**Design (one control, reused by Dashboard, Fixed reports, Planning baseline and the Smart panel):**

```
الفترة:  [ السنة حتى اليوم ▾ ]   من [ 01/01/2026 ]  إلى [ 09/10/2026 ]   [تطبيق]
         1 يناير – 9 أكتوبر 2026 (282 يوماً) · البيانات متاحة من 1 يناير 2025
         المحصّل حتى:  ( ) اليوم   (•) نهاية الفترة          [إعادة ضبط]   مرشحات مفعّلة (2)
```

- A **short preset list** (7 items, grouped «حتى اليوم» / «فترات مكتملة»), then «فترة مخصصة».
- Always allow **typing** the dates, with a visible format hint (example with day > 12 so the order is unmistakable, e.g. «مثال: 27/03/2026»), plus an optional calendar popover for context (day of the week); disabled dates outside coverage with an explanation; no auto-submit on partial input.
- **Inline validation** (start ≤ end, end ≤ today, start ≥ data start) with specific messages; never an empty state for an invalid range.
- **Always show the resolved dates in words** under the control; the same sentence is the report subtitle and the export header.
- The control owns **basis** and **coverage**, so every figure on the page uses the same ones.

| Preset | Exact meaning (today = 9 Oct 2026, Asia/Riyadh) | Comparison used | Notes |
|---|---|---|---|
| اليوم | 9 Oct → 9 Oct | same day last year (or hidden if tiny sample) | new |
| هذا الشهر حتى اليوم | 1 Oct → 9 Oct (MTD) | 1–9 Oct 2025 | rename of «هذا الشهر» |
| آخر شهر مكتمل | 1 Sep → 30 Sep | Sep 2025 | rename of «الشهر الماضي» |
| آخر 3 أشهر مكتملة | 1 Jul → 30 Sep | Jul–Sep 2025 | replaces «آخر 3 أشهر» (D-03) |
| الربع الحالي حتى اليوم | 1 Oct → 9 Oct | Q4-to-date 2025 | optional |
| آخر ربع مكتمل | 1 Jul → 30 Sep | Q3 2025 | optional |
| السنة حتى اليوم | 1 Jan → 9 Oct (calendar year, to be confirmed as fiscal year — Q14) | 1 Jan–9 Oct 2025 | |
| فترة مخصصة | typed start/end, validated | previous period of equal length unless last year is inside coverage | |
| كل البيانات | data start (1 Jan 2025) → today, **start date printed** | none | |

Rules for all presets: the end date never exceeds today; a partial period is compared only with the **same elapsed length**; presets re-anchor to the current date on every load (and on rollover — D-12).

### 12.3 Reporting bases — one sentence each (to appear in the control, the "?" panel and every export header)

| Basis | Exact meaning | Where it applies |
|---|---|---|
| **الفواتير حسب تاريخ الإصدار** | an invoice belongs to the period in which it was issued | all "flow" figures: gross, exclusions, net, collected, uncollected, rate |
| **المحصّل حتى** | payments dated up to the chosen date, counted only inside net billed. Default for a **closed** period: its end date (like-for-like); for an open period: today. «حتى اليوم» is available as a second labelled figure | collected, rate, comparisons |
| **المقبوضات حسب تاريخ السداد** | cash received in the period regardless of invoice date | trends (cash series), funding, receipts vs target |
| **الرصيد القائم حتى** | all unpaid invoices of any issue date as of the date | aging, standing balance |
| **تاريخ الاستحقاق** | basis of «متأخر» and «العمر بعد الاستحقاق» | aging, overdue |
| **أفق التخطيط** | future dates for plans, forecasts and scenarios; never mixed with actuals | Planning only |

---

## 13. UX references used (accessed 2026-10-09)

The platform has no UX guidance of its own; these sources support the recommendations. Where a page could not be read in full, that is stated — no claim below goes beyond what was retrieved.

| Source (published / date seen) | What it supports here | Limits |
|---|---|---|
| [GOV.UK Design System — Ask users for dates](https://design-system.service.gov.uk/patterns/dates/) | Calendar only when users must see day-of-week or relative dates; **never the only way to enter a date — always allow typing**; give a format example (day > 12 so order is clear) → §12.2, D-10, D-15 | does not cover validation errors or ranges (links to other pages) |
| [USWDS — Date range picker](https://designsystem.digital.gov/components/date-range-picker/) | Always allow typing; visible format hint; min/max limits and native validation; explain unavailable dates; **avoid auto-submitting on date change** → D-01, D-02, D-15 | US formats; no localisation guidance |
| [W3C WAI-ARIA APG — Date Picker Dialog example](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/) | Keyboard model (Esc, arrows, Page Up/Down), accessible names, format hint linked with `aria-describedby` → D-15 | an example, not a normative requirement |
| [Nielsen Norman Group — Progressive Disclosure (J. Nielsen, 3 Dec 2006)](https://www.nngroup.com/articles/progressive-disclosure/) | Core options first, specialised ones on request; keep to **two levels**; label the control so users can predict what they find → §10.2, §11.2 | old but still the standard reference |
| [Nielsen Norman Group — Tooltip Guidelines (A. Kendrick, 27 Jan 2019)](https://www.nngroup.com/articles/tooltip-guidelines/) | Tooltips for short supplementary context only, **not essential information**; must work on keyboard focus; do not rely on hover on touch → C-09, row 13 | – |
| [W3C WCAG 2.2 — SC 1.4.13 Content on Hover or Focus](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html) | Hover/focus content must be dismissible, hoverable and persistent (native `title` is excluded) → the 37 `title` attributes and the "?" panel | – |
| [Nielsen Norman Group — Dashboards: Making Charts and Graphs Easier to Understand (L. Laubheimer, 18 Jun 2017)](https://www.nngroup.com/articles/dashboards-preattentive/) | Dashboards are glanceable, one screen, for monitoring and acting; prefer bars/lines over pies/gauges → §11 | does **not** address hierarchy or clutter explicitly |
| [Microsoft Learn — Tips for designing a Power BI dashboard (ms.date 1 Oct 2025)](https://learn.microsoft.com/en-us/power-bi/create-reports/service-dashboards-design-tips) | Know the audience; most important information first (top-left; mirror to top-right for RTL); one screen; **don't put detail on the dashboard unless it is monitored**; scale numbers (3.4 million, not 3,400,000); **don't mix time frames** → §11, D-06 | vendor guidance for one product |
| [Nielsen Norman Group — Concise, SCANNABLE, and Objective (Morkes & Nielsen, 1997)](https://www.nngroup.com/articles/concise-scannable-and-objective-how-to-write-for-the-web/) | Concise, scannable, objective text measured better than promotional text (58 % / 47 % / 27 %; combined 124 %) → §10 | 1997 lab study, ~10 participants per condition; supportive, not decisive |
| [W3C i18n — Setting the base direction (`dir`)](https://www.w3.org/International/questions/qa-html-dir) and [Unicode bidi basics](https://www.w3.org/International/articles/inline-bidi-markup/uba-basics) | Declare `lang` and `dir`; digits and Latin runs inside Arabic are separate directional runs and boundary punctuation can land on the wrong side → D-10, C-08 (money strings such as «14.92 مليار SAR») | the pages do not discuss dates or `bdi` specifically |
| [GOV.UK writing guidelines](https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/) | Organise by user need, plain language, descriptive titles and summaries → §10 | only the section list was readable; specific rules not retrieved |

Not retrievable in this session (so **not** relied upon): the Saudi Digital Government Authority *Platform Code* design system (the page returned no readable content; only secondary news confirms it was launched in November 2024 — please check its date-picker, RTL and Hijri guidance directly), Carbon and Cloudscape date-picker pages (incomplete), Material's bidirectionality page (no text). Secondary, unfetched snippets that informed wording only: Siemens iX date-picker guide (disabled out-of-range dates), Uxcel pickers (short preset lists).

---

## 14. Updated priorities and remediation plan (adds to §6)

| Phase | Added items |
|---|---|
| **0 — Stop-the-line** | D-01 range validation; D-02 coverage limits and message; D-04 reject future quarters; D-05 comparison only for matching scopes; D-06/F-01 visible basis; D-07 Riyadh formatting for all timestamps and file names; C-01 correct or remove the false statements (a–h); C-02/C-03 freeze the glossary and strip codes/ids/keys from visible text |
| **1 — Consistency** | one preset registry and one date/period module shared by control, chips, AI interpreter, planning and exports (D-03, D-08, D-14); the period control of §12.2 (typed input, hints, validation, apply, reset, active-filter count — D-09, D-15); date formatter and unit style («ريال», dates in words) (C-08, D-10); empty/invalid/error copy (rows 18–19); microcopy pass rows 1–30; named date columns (D-11); revised "?" panel (row 13) |
| **2 — UX / IA** | hierarchy restructure per §11.2 (attention block, collapsed budget card, report headers, planning status summary); disclaimers once (C-04); tooltip → popup/tap behaviour and keyboard (C-09); proposal and insight cards at 3–5 lines (rows 16, 28); Smart wording (rows 20–22); mobile sticky header |
| **3 — Platform** | rollover refresh (D-12); Hijri/localised calendar if required (Q13); content owner and glossary governance (Q16) |

Tests to add: period-module table tests (each preset for 12 sample dates, month-ends, leap day, Jan 1); range validation; "closed period" cross-view parity; timestamp formatting at 22:00–03:00 UTC; copy lint (no English words, no raw keys/ids, no more than N pills per page).

## 15. Additional questions

11. **Preset list:** are the seven presets in §12.2 right (add *اليوم*, *آخر ربع مكتمل*, *آخر 12 شهراً*; rename «آخر 3 أشهر»)? Should "last 3 months" mean three **complete** months (recommended)?
12. **Digits and date style:** Western digits (current) or Arabic-Indic; Gregorian only, or Gregorian + Hijri (Umm al-Qura) side by side?
13. **Hijri requirement:** is a Hijri date picker/display mandatory for this audience, or optional?
14. **Fiscal year:** is the ministry fiscal year the Gregorian calendar year? (Currently assumed; drives «السنة حتى اليوم» and the targets.)
15. **Default basis:** confirm "collected up to the period end" as the default headline for closed periods, with "to today" as a secondary figure (see Q1).
16. **Content ownership:** who approves the Arabic glossary and microcopy (finance, communications, or the product owner), and may unit style move from «SAR» to «ريال»?
17. **Disclaimers:** is one global «بيانات تجريبية» badge acceptable, or must every export page carry the full statement?
18. **Attention block:** which three signals should the Dashboard always surface (e.g. aging > 90 days, lowest-performing source, unapproved exclusions)?

## 16. Limits of Part B

- Screenshots from the brief were not visible. Wording proposals are drafts and need review by an Arabic content owner.
- Native date-input rendering (format, digits, calendar popup) was not inspected visually; keyboard/screen-reader behaviour was not tested.
- Word counts include table text; they are a relative measure, not a readability score.
- UX sources are cited as retrieved on 2026-10-09; the DGA Platform Code, Carbon, Cloudscape and Material RTL pages could not be read.
- During Part B only UI state was changed (filters were set to invalid/wide ranges and then reset to *year to date*; no plan, action or conversation data was written). The disclosure in §9 about the plan scenario value still applies.

---

# PART C — Platform review against the UX and visual reference (extension of the audit)

Added 2026-10-09. Same rules: read-only analysis; nothing in the product was changed. Evidence labels as in the legend at the top (**Verified (UI)**, **Verified (code)**, **Verified (data)**, **Hypothesis**, **Not tested**). Findings continue as **G-** (gap against the reference). Earlier ids (F-, C-, H-, D-) are cross-referenced, not repeated.

## 17. The reference: what it is and what it actually specifies

### 17.1 Sources read

| Source | What was read | Limits |
|---|---|---|
| **«AI Foundations — Workshop #1 — UX/UI»** (`20260512 - AI Foundations - Workshop #1 - UX_UI.pdf`, 15 pages, author field "The Boston Consulting Group", May 2026; slides numbered 2, 21–31 and 47) | all 15 pages, text and images; colour codes read from a 200 dpi render; the six hyperlinks extracted | It is a **partial deck** (pages 3–20 and 32–46 are not in the file) prepared for the *Technical Oversight Team that supports NHCI and MOMAH AI solutions*. It carries the **NHC Innovation** logo, not a MOMAH identity manual. |
| **[design.dga.gov.sa](https://design.dga.gov.sa/)** (DGA "Platforms Code" design system, version 4.0, © 2024; linked from slides 5 and 11 and sent by you) | opened in the built-in browser and read: typography, layout and spacing, colour system (first part), iconography (first part), date picker, KPI card, charts, tooltip, table, buttons (first part), filter, top navigation header, chatbot template, accessibility article, consistency-and-unified-identity article | Not read: elevation, tabs, tags, notifications, modal, loading/skeleton, input, footer and the remaining templates. Component demos are "coming to Storybook". |
| [fonts.google.com — IBM Plex Sans](https://fonts.google.com/specimen/IBM+Plex+Sans) and [hugeicons.com](https://hugeicons.com/) (linked from slides 8 and 10 and sent by you) | Hugeicons home page read (60,000+ icons; Stroke/Twotone/Duotone/Solid/Bulk × Rounded/Standard/Sharp; free and Pro tiers; React/Vue/Angular/Flutter packages, icon font/CDN) | The Google Fonts page was provided as a link only; the DGA typography page already names IBM Plex Sans. |

**How to read "explicit".** Throughout this part each rule is labelled **[Deck]** (stated or shown in the workshop deck — treated as the MOMAH/NHCI requirement), **[DGA]** (stated on design.dga.gov.sa, which the deck makes the *fixed* foundation), or **Rec.** (my recommendation, not in either source). Where something is not specified it is listed in §17.4 and I did not guess it.

### 17.2 The ecosystem rules in the deck

| Rule | Where | Meaning for this platform |
|---|---|---|
| Three layers: **DGA Foundation (Fixed)** — colour system, typography, spacing and layout, core component behaviour; **Product customization (Flexible)** — layouts and workflows (dashboard, tools, chat-first), micro-interactions, visual tone (radius, density, optional brand accents); **AI extensions (Expandable)** — AI states (thinking, generating, refining), AI indicators (e.g. "AI-generated"), confidence levels and explainability cues, conversational UI | [Deck] p.6 | colours, type, spacing and core components may **not** vary per product; layouts, density, radius and accents may; AI-specific patterns are added on top |
| AI products must be **Consistent** (same patterns, voice, design language), **Trustworthy** ("users always know what AI is doing and why: transparent, honest, in control of the user") and **Compliant** (aligned with Saudi digital-government standards) | [Deck] p.4 | a shared look across NHCI/MOMAH solutions is the point of the framework |
| "AI solutions may introduce **additional accent colours** … while maintaining alignment with the core system" | [Deck] p.7 | the platform may keep a non-DGA accent if the core palette is respected |
| Component categories to use: Actions (buttons, dropdowns, links, chips); Content display (cards, lists, accordions); Data display (tables, charts, **metrics**, avatars); Forms and inputs (inputs, **datepicker**, upload, selection); Navigation (menu, tabs, pagination, **breadcrumbs**); Feedback (notifications, modals, **tooltips**, loading); Search and **filters** (search, tags, filtering); UI shell (**headers**, navigation drawer, **footer**) | [Deck] p.11 | maps to §19 |
| Design character and tone sliders (institutional↔accessible, serious↔approachable, analytical↔expressive, authoritative↔assistive, advanced↔familiar, structured↔flexible; formal↔conversational, directive↔suggestive, technical↔clear & plain) and the sentence "AI communication should feel **helpful, trustworthy and easy to understand, never overwhelming or unclear**" | [Deck] pp.12–13 | the sliders are qualitative (no numeric positions); the sentence is the only testable tone rule |

### 17.3 Concrete specifications extracted

**Colour** [Deck p.7] — six palettes with hex codes (read from the render):

| Palette | 25 | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Neutral (Gray) | FCFCFD | F9FAFB | F3F4F6 | E5E7EB | D2D6DB | 9DA4AE | 6C737F | 4D5761 | 384250 | 1F2A37 | 111927 | 0D121C |
| Primary "Saudi green" (SA) | F7FDF9 | F3FCF6 | DFF6E7 | B8EACB | 88D8AD | 54C08A | 25935F | **1B8354** | 166A45 | 14573A | 104631 | 092A1E |
| Warning | FFFCF5 | FFFAEB | FEF0C7 | FEDF89 | FEC84B | FDB022 | F79009 | DC6803 | B54708 | 93370D | 7A2E0E | 4E1D09 |
| Error | FFFBFA | FEF3F2 | FEE4E2 | FECDCA | FDA29B | F97066 | F04438 | D92D20 | B42318 | 912018 | 7A271A | 55160C |
| Info | F5FAFF | ECFDF3* | D1E9FF | B2DDFF | 84CAFF | 53B1FD | 2E90FA | 1570EF | 175CD3 | 1849A9 | 194185 | 102A56 |
| Success | F6FEF9 | ECFDF3 | DCFAE6 | ABEFC6 | 75E0A7 | 47CD89 | 17B26A | 079455 | 067647 | 085D3A | 074D31 | 053321 |

\* Info 50 is printed as ECFDF3, identical to Success 50 — most likely a typo in the slide; confirm with the Figma kit before using it.
[DGA] adds secondary **gold** and **lavender (Khuzama)** palettes and gradients (identity article: green from the flag; black and gold from the bisht; violet from lavender fields), and states the goal of **WCAG 2.1 AA**: use Gray 500/600/700/950 text on backgrounds numbered 400 and below, white text on 500 and above; minimum contrast 4.5:1 (3:1 large text; large = 18.5 px bold or 24 px).

**Typography** [Deck p.8; DGA]: **IBM Plex Sans** (English) and **IBM Plex Sans Arabic** (Arabic); weights Regular, Medium, Semibold, Bold; scale — Display 2xl 72/90, xl 60/72, lg 48/60, md 36/44, sm 30/38, xs 24/32; Text xl 20/30, lg 18/28, md 16/24, sm 14/20, xs 12/18, 2xs 10/14 (size/line-height px; display tracking −2 %). "Saudi font" only for national occasions, headlines only. WCAG line-height ≥ 1.5 for body text.

**Spacing and layout** [Deck p.9; DGA]: one unit = 4 px; DGA tokens 0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128, 160 px; container padding 16 px (mobile) / 32 px (desktop); container max width 1,280 px; paragraph max width 720 px; deck frames: desktop 1,280 / tablet 768 / phone 375; DGA breakpoints 0–599, 600–959, 960–1,279, 1,280+; 12-column desktop grid; minimum interactive target 44×44 px (cited from WCAG); logical reading order equal to visual order.

**Icons**: [Deck p.10] **Hugeicons**; [DGA] its own "Platforms Code" icon set (Figma + SVG, bundled in the DGA packages) with sizes 10, 14, 16, 18, 20, 24 (standard), 28, 32 px. *The two sources differ — see Q23.*

**Components** [DGA]: **date picker** — calendar pop-up with month/year navigation, keyboard date entry, single or two-month view, `role=dialog` + grid roles, focus moves to the selected/today date, arrows/Enter/Esc, live-region announcements; **tooltip** — `role=tooltip`, shown on focus as well as hover, `aria-describedby`, short delay, must not cover interactive elements; **KPI card (metric)** — label (with icon), main value, trend indicator with comparison, optional small chart, CTA, `aria-live=polite` for dynamic values; **charts** — pie ≤ 6 categories, line ≤ 3 series, bar ≤ 3 series, each a different colour; **table** — header cells (actions, sort, filter), row cells (link, badge, status, actions); **filter** — closed / open / results states, a filter button that shows the **number of active filters**, active filters as removable chips (×); **top navigation** — states selected, unselected, default, hover, pressed, focus, disabled; **buttons** — three emphasis levels, destructive buttons need confirmation; **chatbot template** — short welcome, highlight main capabilities, **feedback ("Was this helpful?")**, **option to escalate to a human**, accessibility tools first in tab order, floating button must not cover important content.

### 17.4 Not specified (missing assets and decisions) — nothing below was assumed

1. **Logo rules** — no MOMAH logo, no version (colour/mono/reverse), proportions, clear space, minimum size or background rules; the deck only *shows* the NHC Innovation logo (white on dark green, green on white) and the DGA/flag lockup. **A MOMAH (and/or NHC Innovation) logo asset and usage rules are missing.**
2. The **brand dark-green** used for slide backgrounds is not in the palette tables; no official hex for it.
3. Exact **component specs** (heights, padding, radii, states for each component) — only in the Figma kit and Storybook, not in the deck.
4. **Radius and elevation** values (the deck leaves them "flexible"); [DGA] has an elevation page I did not read.
5. **Data-visualisation palette and ordering**, number/currency formatting, Arabic-Indic vs Western digits, Hijri display.
6. **Dark theme** — not mentioned in either source.
7. **Reports and exports** (Word/Excel/PowerPoint templates, headers, page numbering) — not covered; §21 treats them by analogy.
8. Which Hugeicons style/pack and licence, and whether the DGA icon set or Hugeicons wins (§17.3).
9. Slides 3–20 and 32–46 of the deck, the Figma UI kit (`figma.com/@sdga`) and the full DGA component demos.
10. UX-writing rules beyond the tone sliders (terminology, number formats, error-message patterns).

---

## 18. Platform-wide visual and UX consistency assessment

### 18.1 Overall

The platform is **visually coherent with itself** (one green, one font family, cards, pills) and it already gets four things right against the reference: the **primary green `#1B8354` is exactly DGA SA 600**, the font family is **IBM Plex Sans Arabic**, the page is **RTL with `lang="ar"`**, and the AI assistants are **honest about being rule-based** (the deck's "Trustworthy" principle). But it is **not aligned to the DGA foundation that the deck fixes**: the other colour tokens, the type scale and weights, the spacing/breakpoints, the icons, the date picker and filters, and the brand/identity layer all come from a different source (the colour tokens' own comment says they were extracted from the *financial-imagination* prototype). Consistency **between** pages is weakest on the operational pages (no H1, 70–95 % small tap targets, many AA contrast failures) and strongest on the newer management pages.

### 18.2 Measured scorecard (1280 px, Arabic, 2026-10-09; Verified UI by scripted audit of every route)

| Page | Text nodes | Off-scale font sizes | Text < 12 px | Weights 800–900 | Exact DGA hex (text / bg) | Contrast fails (WCAG AA) | Targets < 44 px | Targets < 24 px | H1 | Heading sequence |
|---|---|---|---|---|---|---|---|---|---|---|
| Dashboard | 387 | 76 % | 69 (18 %) | 70 | 5 % / 1 % | 2 | 69 of 82 | 29 | 1 | H1 H3 (no H2) |
| Monthly report | 1,867 | 89 % | 44 | 184 | 0 % / 1 % | 4 | 30 of 41 | 0 | 1 | H1 H3 H4… |
| Smart reports | 232 | 55 % | 38 | 32 | 0 % / 4 % | 5 | 36 of 40 | 1 | 1 | H1 H3 H4 |
| Planning | 616 | 68 % | 90 | 108 | 0 % / 7 % | 2 | 79 of 98 | 8 | 1 | H1 H2 |
| Invoices | 775 | 87 % | 204 (26 %) | 238 | 18 % / 3 % | **55** | 47 of 105 | 10 | **0** | none |
| Exclusions review | 619 | 83 % | 228 (37 %) | 209 | 3 % / 11 % | **39** | 162 of 187 | **73** | 0 | H3 |
| Collection worklist | 882 | 84 % | 129 | 143 | 0 % / 8 % | **83** | 134 of 142 | **102** | 0 | none |
| Contracts | 113 | 85 % | 17 | 31 | 7 % / 7 % | 3 | 23 of 27 | 7 | 0 | none |
| Risk and data quality | 411 | 67 % | 124 | 129 | 1 % / 3 % | **50** | 122 of 130 | 47 | 0 | none |
| Data sources | 556 | 94 % | 230 (41 %) | 96 | 5 % / 2 % | **30** | 34 of 39 | 13 | 0 | H3 H4 |
| Metric dictionary | 376 | 90 % | 30 | 69 | 0 % / 5 % | 3 | 22 of 30 | 1 | 0 | H3 ×15 |
| Sanad orders | 159 | 80 % | 26 | 35 | 1 % / 32 % | **17** | 31 of 33 | 0 | 0 | none |
| Investment invoices | 64 | 41 % | 11 | 38 | 2 % / 43 % | 10 | 25 of 27 | 0 | 0 | none |

*Method:* computed styles of every visible text node/interactive element in `<main>`; "off-scale" = font size not in the DGA scale {10, 12, 14, 16, 18, 20, 24…}; contrast = WCAG ratio of the rendered text colour over the composited background (large-text threshold applied); the "IB" logo tile (a gradient the script cannot sample) is a known false positive on every page and is excluded from the counts above where it was the only failure. Counts are indicative, not a conformance test.

### 18.3 What is consistent and what is not

| Dimension | Consistent? | Notes |
|---|---|---|
| Brand colour | ✔ | `#1B8354` = SA 600 everywhere |
| Other palette colours | ✖ | 12 distinct text colours and 14 distinct background colours on the Dashboard alone; status/semantic hues are the prototype's, not DGA's |
| Font family | ◐ | one family, but Latin text uses the Arabic face; Plex **Mono** for numbers (111 text nodes on the Dashboard, 407 on Collection) |
| Type scale | ✖ | 10–16 distinct sizes per page, 10.4/10.5/11/11.5/12.5/13/13.5/15/22 px outside the scale |
| Spacing | ✖ | only 41–51 % of padding/margin/gap values are multiples of 4; 21 distinct values on the Dashboard |
| Radius | ◐ | 8 values (4, 9, 10, 12, 14, 50 %, 99, 999 px) |
| Icons | ✖ | custom inline SVG + 79 source lines using text glyphs/emoji |
| Page header pattern | ✖ | new pages: `h1` title + subtitle + tabs; operational pages: `div.page-title`, no `h1`, different filter bar |
| Filter UI | ✖ | three implementations (D-09, F-21) |
| Number/date/currency format | ✖ | «SAR» and ISO dates (C-08, D-10) |
| Language | ✖ | English Amanah names in Arabic tables, English proposals (F-09), zh fallback |

---

## 19. Reference-to-platform gap table

Severity: **P0** unusable or misleading for some users · **P1** breaks an explicit requirement of the fixed foundation or AA accessibility · **P2** consistency · **P3** polish. "Source" = where the requirement comes from.

| ID | Requirement (source) | Platform evidence | Affected pages / components | Sev. | Recommended correction |
|---|---|---|---|---|---|
| **G-01** | **Logo / identity.** The reference shows the NHC Innovation mark and says nothing else; **no MOMAH logo rules exist in the material** ([Deck] p.1–14; §17.4-1) | The header uses a square «IB» tile with a green→blue gradient (`.side-brand__logo`) and the text «منصة الفواتير الذكية · INTELLIBILL · AI SUITE»; no MOMAH, NHC or DGA mark anywhere; favicon is a teal→violet gradient «IB» in a font (`Basis Grotesque Arabic Pro`) the product does not load (`public/favicon.svg`); the login page says «INTELLIBILL» and «بنية HiAgent». Verified (UI/code) | `Layout`, `Login`, favicon, tab title (`index.html:6`), all exports | **P1** | Obtain the official MOMAH/NHC logo files and rules (**missing asset** — Q19); until then show a neutral text title in the product name approved by the team. Remove "HiAgent"/"INTELLIBILL" strings unless they are the approved product name. |
| **G-02** | **Typography** — IBM Plex Sans (English) + IBM Plex Sans Arabic (Arabic), 4 weights, DGA scale ([Deck] p.8, [DGA]) | Only **IBM Plex Sans Arabic** is loaded for all text (Latin included) and **IBM Plex Mono** for figures; `IBM Plex Sans` is never requested (`index.html:10`, `variables.css` `--font`, `--num`). Weights 800/850/900 (and 650/750) are used 70–238 times per page while only 400–700 are loaded (`font-weight: 800` ×54, `900` ×50 in the stylesheets). Verified | every page; `rv-tile__value`, tables, tags | **P1** | Load IBM Plex Sans for Latin text and Plex Sans Arabic for Arabic via `unicode-range`; drop Plex Mono (use `font-variant-numeric: tabular-nums`); allow only Regular/Medium/Semibold/Bold. Confirm whether Plex Sans Arabic's Latin glyphs are acceptable (Q22). Self-host the fonts instead of the Google CDN (government deployment, offline/privacy, CSP) — Rec. |
| **G-03** | **Type scale** — predefined styles Display/Text with fixed sizes and ≥ 1.5 line-height for body text ([Deck] p.8, [DGA] typography, layout) | 41–94 % of text nodes are at sizes outside the scale (10.4, 10.5, 11, 11.5, 12.5, 13, 13.5, 15, 22 px); 10–16 distinct sizes per page; 18–41 % of text is below 12 px on dense pages (Invoices 26 %, Exclusions 37 %, Data sources 41 %). Verified | all; worst: Data sources, Invoices, Exclusions | **P1** | Define the text styles as tokens (§20.2) and replace ad-hoc sizes; minimum 12 px for content, 10 px only for non-essential captions. |
| **G-04** | **Colour system** — DGA palettes are the fixed foundation; extra accents allowed for AI products ([Deck] pp.6–7, [DGA]) | `variables.css` defines 17+ colour tokens not taken from DGA: `--secondary #0A6FA6`, `--success #3E8540`, `--danger #C4514C`, `--warning #8c5f00`, `--accent #0d9668`, `--orange #9A5C00`, `--purple #6B57A6`, `--low #8a978f`, text/surface greens (`#062a1e`, `#0f2a20`, `#436254`, `#eef3f0`). Only `--primary` (SA 600) and, nearly, `--primary-2` (SA 700) match. Exact DGA hex appears on 0–18 % of text nodes and 1–43 % of backgrounds. The header comment says the palette was "extracted from financial-imagination.vercel.app". Verified | global tokens; every component | **P1** | Re-base the tokens on DGA (§20.1). The extra purple/orange/blue may remain **only** as documented AI/categorical accents (allowed by [Deck] p.7). |
| **G-05** | **Semantic colours** — red = danger, yellow = caution, green = positive, blue = info; consistent pairing with indicators ([DGA] colour) | Success green, brand green and "collected" green are near-identical hues; blue (`#0A6FA6`) is used for *net billed* (not information); red/green sit side by side in the relations and status bars with colour as the only cue; the 10-segment status bar uses 7 off-palette hues (`#c9a227`, `#8a978f`, `#6f7d76`, `#6B57A6`, `#9A5C00`, `#b07a9a`, `#4f8d94`); `#c9a227` on white = **2.42:1** | Dashboard (relations, payment status), reports charts | **P2** | Reserve semantic hues for status; give measures neutral/brand shades; add labels/patterns; follow the chart caps (G-13). |
| **G-06** | **Contrast** — WCAG 2.1 AA, 4.5:1 text, 3:1 large; white text on ≥ 500 backgrounds ([DGA] typography/colour) | **Sanad orders: the «فتح» buttons are blue text on the green primary background = 1.15:1** (label effectively invisible; `.btn-primary` colour overridden by a link colour; Verified UI + DOM). Danger red `#C4514C` on tinted rows/pills = 4.04–4.09:1 at 10.5–11 px; green on tint 4.05:1; warning on grey 4.38:1; `--primary` on the page background 4.23:1; `--low` text 3.04:1. Failures per page: Collection 83, Invoices 55, Risk 50, Exclusions 39, Data sources 30. Note: DGA's own "white on 500+" rule gives only 3.91:1 on Success 600 — pairings must be measured (§20.1) | Sanad orders, Collection, Invoices, Risk, Exclusions, Data sources, status tags | **P0** (Sanad) / **P1** | Fix the link-in-button colour rule; replace the danger/success text tokens with DGA Error 700 / Success 700 / SA 700 for small text; enforce an automated contrast check. |
| **G-07** | **Focus visibility and keyboard** — visible focus state on every interactive element; logical order; accessibility tools first in tab order ([DGA] nav header states, a11y article, chatbot template) | Buttons/inputs get a 3 px ring at **18 % opacity** (`rgba(27,131,84,.18)`, ≈ 1.3:1 against white) plus a 1 px border change (`global.css:461`, `540`); many component rules set `outline: none` with only a faint background change (`.tab`/nav links have no `:focus-visible` rule; `.sr-tab`, `.st-nav a`, `.sr-suggest__btn` use `outline: none`); no skip link; tab sequence starts with the header controls (language, org, bell) before the page content. Verified (UI keyboard Tab + code) | all interactive elements | **P1** | One 2 px solid focus ring in SA 700 with 2 px offset for all controls; add a skip-to-content link; test the full tab order. |
| **G-08** | **Target size** — min 44×44 px recommended; 24×24 is the WCAG 2.2 AA floor ([DGA] layout; WCAG 2.2) | 69 of 82 interactive elements on the Dashboard and **70–95 % on operational pages** are below 44 px in a dimension; **102 of 142 on Collection** and 73 of 187 on Exclusions are below 24 px. Verified | tables with row buttons, pills, icon buttons, chips | **P1** | Raise hit areas (padding) without changing the visual size; target 44 px on touch widths. |
| **G-09** | **Spacing** — 4 px unit, DGA spacing tokens; container padding 16 / 32; max width 1,280 ([Deck] p.9, [DGA]) | Only 41–51 % of paddings/margins/gaps are multiples of 4; 21 distinct values on the Dashboard; `.content` padding is **24 px** and `max-width` **1,320 px** (reference 32/16 and 1,280); paragraph width unrestricted (reference 720). Verified | global CSS, every card | **P2** | Replace literals with spacing tokens; set container tokens (§20.3). |
| **G-10** | **Breakpoints and responsive frames** — desktop 1,280 / tablet 768 / phone 375 ([Deck]); DGA 599 / 959 / 1,279 | 12 distinct media-query widths (520, 560, 640, 700, 760, 820, 900, 980, 1000, 1100, 1150, 1300); header + tab strip use 328 px of 844 at 390 px (39 %); the three view tabs wrap; icon-only nav below 820 px; no horizontal overflow (good). Verified | `Layout`, tab strips | **P2** | Adopt the three DGA tiers; collapse the header to a compact bar + drawer on tablet/phone. |
| **G-11** | **Iconography** — Hugeicons ([Deck]) or the DGA icon set; sizes 10–32 ([DGA]) | 12 custom inline SVGs in `Layout.jsx` (one glyph reused for different meanings: the «invoices» icon for *contracts*, «dashboard» for *dashboard* and *metric dictionary*, «what-if» for *exclusions*); 79 source lines use text glyphs or emoji as icons (↰ ➤ ▲▼ ▸▾ ✓✗ ＋ ↻ 🔑 👋 ⚠); the assistant avatar is the letter «ذ». Verified (code) | nav, buttons, deltas, login, assistant | **P2** | Choose the icon set (Q23), map every icon, remove emoji/glyph icons; give every nav item a distinct icon. |
| **G-12** | **Date picker** — DGA date picker (calendar pop-up, keyboard entry, a11y roles, announcements) ([DGA], [Deck] p.11 "Datepicker") | Native `<input type="date">` pairs with no calendar context, no format hint, no validation (D-01, D-02, D-15); the Smart panel has its own variant | `ScopeBar`, Smart `FilterPanel` | **P1** | Build the shared period control of §12.2 on the DGA date picker. |
| **G-13** | **Charts** — pie ≤ 6 categories, line/bar ≤ 3 series, distinct colours ([DGA] charts); NN/g/Power BI guidance for bars over gauges | Stacked 10-segment status bar; Amanah bar charts with 19 categories × 2 series; trend with 3 series (compliant); chart colours are hard-coded RGBA values (`rgba(45,95,139,.8)`, `rgba(255,193,7,.85)`, `rgba(175,8,24,.7)`, …) rather than tokens. Verified (code) | Dashboard, reports, Planning | **P2** | Cap series per [DGA]; switch long lists to ranked tables/top-N; draw colours from a token palette (§20.4). |
| **G-14** | **Tooltips** — `role="tooltip"`, on focus and hover, `aria-describedby`, not covering interactive content ([DGA] tooltip; NN/g, WCAG 1.4.13) | 37 native `title` attributes on the Dashboard (hover-only, not styled, not keyboard-reachable) plus a «?» button opening a dialog; the dialog content carries essential basis information (C-09). Verified | KPI tiles, tags | **P2** | Use one Tooltip + one "Definition" popover component; essentials move out of tooltips (C-09). |
| **G-15** | **Filters** — filter button with active count; active filters as removable chips; results state ([DGA] filtration) | Chips are read-only; no count, no per-chip remove, no reset (D-09); three separate filter bars (F-21) | all filtered pages | **P1** | Implement the DGA filter pattern once. |
| **G-16** | **KPI card** — label with icon, value, trend vs comparison, optional mini-chart, CTA, `aria-live` for dynamic values ([DGA] metric) | Label + help button, value, delta, sub-text and (on one tile) a CTA link ✔; no mini-trend; values wrap onto two lines at 1,280 px (e.g. «14.92 مليار / SAR»); `aria-live` not set on values (Dashboard re-renders silently on filter change — F-12). Verified | Dashboard, Planning, Collection, Risk | **P2** | One KPI-card component (§20.5): fixed value size, no wrap, sparkline option, live region. |
| **G-17** | **Headings and landmarks** — logical reading order matching visual order, structure for screen readers ([DGA] a11y) | **9 of 13 routes have no `h1`**; Dashboard goes H1→H3; Metric dictionary is 15 × H3; two `header` landmarks, no `footer`, no skip link; every control has an accessible name and every field a label (good: 0 unlabeled). Verified | all operational pages, Dashboard | **P1** | One page-header component producing `h1`, then `h2` sections; add `footer` (DGA UI shell lists it) and skip link. |
| **G-18** | **UI shell** — header, navigation (menu/tabs/breadcrumbs/pagination), **footer**; top-nav item states selected/hover/focus/disabled ([Deck] p.11, [DGA]) | Single sticky header + a 9-item tab strip (two items off-screen at 1,280 px); no breadcrumb component exists anywhere in the code (0 matches), so detail pages (invoice drawer, Sanad detail, investment detail) rely on back links only (code; pages not opened in this pass); no footer; unknown URL silently becomes the dashboard (no error page — DGA has a "page not found" template); the sticky bars cover anchor targets (F-29). Verified | `Layout`, detail pages | **P2** | Grouped navigation (§5.1), breadcrumbs on detail pages, footer with data/version info, 404 page. |
| **G-19** | **States** — hover, focus, selected, disabled, loading, empty, error ([DGA] nav/button states) | Hover ✔ (`.btn:hover`), active ✔, selected tab ✔, disabled = 55 % opacity ✔ (low contrast by design), skeleton ✔ (`Skeleton`, `st-skel`), error banner with retry ✔ on new pages; **missing**: focus (G-07), loading indicator on Dashboard/Fixed reports (F-12), empty-state reset button and invalid-range message (D-01, C-16), a distinct "stale" state | all | **P2** | Define the state matrix per component (§20.5) and test it. |
| **G-20** | **RTL and mixed content** — Arabic default; logical layout; mixed Arabic/Latin handled ([DGA], W3C) | `lang="ar" dir="rtl"` ✔; money strings are LTR runs with a Latin «SAR» inside an Arabic page; **English Amanah names in Arabic tables** («Jeddah Amanah», «Riyadh Amanah», «Al-Qassim Amanah», «Eastern Province Amanah», «Sanad») on `/sanad-orders`; ISO dates; only 6 `<bdi>` uses; the floating «اسأل المساعد» button overlaps table rows at the bottom-left (visible on `/sanad-orders`). Verified (UI) | Sanad orders, tables, floating assistant | **P2** | Arabic names from the Amanah catalogue everywhere; «ريال»; `bdi` around embedded numbers/IDs; place the assistant where it never covers content (DGA chatbot template). |
| **G-21** | **AI extensions** — AI states (thinking/generating/refining), AI indicators ("AI-generated"), confidence/explainability cues, conversational UI; chatbot: welcome, highlighted capabilities, **feedback**, **human escalation** ([Deck] p.6, [DGA] chatbot) | ✔ conversational UI, welcome + suggestions, 5-step progress, honest "rule-based, not a language model" notice, basis/caveat on each insight (explainability). ✖ no **AI indicator** on the generated report/insights themselves, no common confidence vocabulary (labels vary: «حقيقة محسوبة», «تقدير — راجع الافتراضات», «مقارنة فترات»), no "refining" state, **no feedback control**, **no human-escalation path** although the login page advertises "human-in-the-loop"; assistant avatar «ذ». Verified | Smart reports, Planning assistant, login | **P2** | Add an "AI-assisted / rule-based" chip to every generated block, one three-level confidence label, helpful/not-helpful control, an "ask a person / report an issue" route. |
| **G-22** | **Tone** — plain, clear, never overwhelming ([Deck] p.13); consistent voice | C-01…C-10: jargon, codes, repeated disclaimers, rhetorical headers. **Login copy** describes a different product: «منصة أتمتة الوكلاء … بنية HiAgent متعددة الوكلاء · الإشراف البشري (HITL)», English pills (Orchestrator, Ingestion, **OCR Extraction**, Normalization, Duplicates …), counters «0 / 8 أنظمة مصدرية متصلة» and «386 فاتورة تجريبية», emoji, and the demo passwords printed on the page. Verified (UI) | Login, all pages | **P1** | Rewrite the login hero for the revenue-intelligence purpose; remove claims the product does not support (OCR); apply §10.2/§10.3. |
| **G-23** | **Reports and exports** — not covered by the reference (§17.4-7) | Word/PowerPoint/Excel: no logo, header/footer or page numbers; no font specified (application default, not Plex); PowerPoint tables 9 pt, cut to 11 rows (F-10); slide titles in `1B8354` (= SA 600 ✔), table header fill `EFEFEF`; Excel unstyled | exports | **P2 (Rec.)** | Define an export template from the same tokens once the logo and rules are available (§21). |
| **G-24** | **Theme** — not mentioned (§17.4-6) | Light + dark + system preference with a toggle (`variables.css`, 4 `prefers-color-scheme` blocks); dark values are the prototype's, contrast not tested; glass panels (`backdrop-filter: blur(10px)`) and decorative backgrounds (`.bg-fx`, `.bg-grid`) | global | **P3** | Ask whether dark mode is required (Q24); if kept, derive it from DGA Gray/SA 900-950 and test AA. |
| **G-25** | **Brand string and title** — consistent product naming ([Deck] "Consistent") | Tab title «INTELLIBILL · AI Suite» on every page (`index.html:6`, never updated per route); header «منصة الفواتير الذكية»; `Layout.pageTitle` falls back to "INTELLIBILL" for Sanad/investment routes | all | **P2** | One product name; per-route document titles «{الصفحة} — {المنتج}». |
| **G-26** | **Radius / elevation** — flexible ("radius, density, optional accents") ([Deck] p.6) | 8 radius values; cards translucent (`rgba(255,255,255,.72)`), hairline brand-tinted borders, no shadow | global | **P3** | Fix three radii (control, card, pill) as product tokens; confirm elevation with the DGA page (not read). |

**Positive alignments worth keeping** (so they are not "fixed" by accident): primary `#1B8354` = SA 600; IBM Plex Sans Arabic as the Arabic face; RTL/`lang`; every control has an accessible name and every field a label; `prefers-reduced-motion` rules exist in 4 stylesheets; skeleton loaders; honest AI labelling; no horizontal page overflow at 1,280/390 px.

---

## 20. Proposed shared design system (for review — not implemented)

Principles: **DGA fixed → product tokens flexible → AI extensions added**, exactly the deck's three layers. Everything below is a *proposal* (Rec.) except values copied from the reference.

### 20.1 Colour tokens

| Role | Proposed token → value | Basis | Contrast note (computed) |
|---|---|---|---|
| Brand / primary action | `--color-primary` = SA 600 `#1B8354`; hover SA 700 `#166A45`; pressed SA 800 `#14573A` | [Deck]/[DGA]; unchanged from today | white on SA 600 = 4.75:1 ✔ |
| Link / small text in brand colour | SA 700 `#166A45` | Rec. | on white 6.60:1 ✔ (SA 600 on Gray 100 is only 4.32 ✖) |
| Page background | Gray 100 `#F3F4F6` (or SA 25/50 tint) | [DGA] neutral | – |
| Card/surface | White; Gray 50 `#F9FAFB` | [DGA] | – |
| Border | Gray 200 `#E5E7EB`; strong Gray 300 `#D2D6DB` | [DGA] | – |
| Text strong | Gray 950 `#0D121C` (headings), Gray 900 `#111927` | [DGA] ("Gray 500/600/700/950 on light") | – |
| Text body | Gray 700 `#384250` | [DGA] | on Gray 100 9.25:1 ✔ |
| Text muted | Gray 600 `#4D5761` (not Gray 500 on tinted surfaces) | Rec. | Gray 600 on Gray 100 6.69:1 ✔; Gray 500 on Gray 100 4.34 ✖ |
| Success | icon/border Success 600 `#079455`; text Success 700 `#067647` on Success 50 | [DGA] | 5.40:1 ✔; white on Success 600 only 3.91 ✖ → use dark text or Success 700 fill |
| Warning | icon Warning 500 `#F79009`; text Warning 700 `#B54708` on Warning 50 | [DGA] | 5.20:1 ✔ |
| Danger | Error 600 `#D92D20` (fill/icon); text Error 700 `#B42318` on Error 50 | [DGA] | 6.05:1 ✔ (Error 600 on Gray 100 = 4.39 ✖ for small text) |
| Info | Info 600 `#1570EF`; text Info 700 `#175CD3` on Info 25 | [DGA] | 5.70:1 ✔ |
| Focus ring | 2 px solid SA 700 + 2 px offset | Rec. | ≥ 3:1 against all surfaces |
| Categorical (charts, max 3–6) | SA 600 · Info 600 · Warning 500 · Gray 500 · Error 600 · lavender (DGA secondary, hex to be taken from the DGA colour page) | Rec. within [DGA] caps | always with labels; never red+green as the only pair |
| AI accent (optional) | one documented accent (e.g. today's violet `#6B57A6` or DGA lavender) for AI-generated blocks only | [Deck] p.7 allows | decide in Q25 |

Rule: **semantic colours only for status**; measures (net billed, collected, exclusions) use brand/neutral shades plus labels. Every text/background pair is added to a contrast table and checked in CI.

### 20.2 Typography tokens

Families: `IBM Plex Sans Arabic` (Arabic) and `IBM Plex Sans` (Latin/numerals), self-hosted, weights 400/500/600/700; tabular numerals for all figures.

| Role (platform) | DGA style | Size / line-height | Weight |
|---|---|---|---|
| Page title (H1) | Display xs | 24 / 32 | Bold |
| Section title (H2) | Text xl | 20 / 30 | Semibold |
| Card / sub-section title (H3) | Text lg | 18 / 28 | Semibold |
| KPI value | Display xs (tabular) | 24 / 32 | Semibold |
| Body, table cell, form text | Text sm → md | 14 / 20 → 16 / 24 | Regular |
| Label, chip, helper | Text xs | 12 / 18 | Medium |
| Smallest caption (non-essential) | Text 2xs | 10 / 14 | Regular |

No ad-hoc sizes; content never below 12 px; body line-height ≥ 1.5 for paragraphs (WCAG, [DGA]).

### 20.3 Spacing, layout, shape

- **Spacing tokens** = DGA scale (4, 8, 12, 16, 20, 24, 32, 40, 48, 64 px; 2 and 6 only inside controls).
- **Container**: max 1,280 px; padding 32 px (≥ 960), 16 px (< 600); paragraph max 720 px; 12-column grid on desktop.
- **Breakpoints**: 600 / 960 / 1,280 (DGA); design frames at 1,280 / 768 / 375 ([Deck]).
- **Radius**: control 8 px, card 12 px, pill 999 px (product-level choice allowed by [Deck] p.6); **elevation**: none or one subtle level — confirm with the DGA elevation page.
- **Targets**: interactive area ≥ 44 × 44 px on touch widths (≥ 24 × 24 on desktop minimum).

### 20.4 Icons and data visualisation

- One icon set (Q23) at 16/20/24 px in a single style; text glyphs/emoji removed; each navigation item has its own icon; icons never carry meaning alone (label or accessible name).
- Charts: bar/line/area first; ≤ 3 series, ≤ 6 slices; ranked tables for long lists; consistent axis/units (one unit per chart, already done); colours from §20.1; data-table fallback and text summary for each chart.

### 20.5 Reusable components (build once, use everywhere)

| Component | Replaces today | Key rules |
|---|---|---|
| **App shell** | `Layout` | header (logo slot, product name, language, user), primary nav (2 management areas + Operations menu), breadcrumbs, footer (version, data cut-off, "synthetic data"), skip link, one `h1` per page |
| **Page header** | per-page titles/subtitles | `h1` + one-line scope («1 يناير – 9 أكتوبر 2026 · كل الأمانات») + actions; optional «حالة البيانات ▾» |
| **Context bar** | `FilterChips`, `ScopeBar`, Smart panel | period control (§12.2) built on the DGA date picker, filters with count + removable chips + reset, basis switch, loading/error state |
| **KPI card** | `MetricTile` | label, value (no wrap), trend with comparison dates, optional sparkline, CTA, definition popover, `aria-live` |
| **Status tag / badge** | `st-tag`, `badge`, `rv-chip` | semantic variants Success/Warning/Error/Info/Neutral/AI; icon + text; ≤ 6 per page |
| **Data table** | `table`, `st-table-wrap` | sticky header, numeric columns right-aligned/tabular, named date columns, row actions with 44 px targets, pagination, empty/error rows |
| **Chart frame** | Chart.js wrappers | title, unit, legend, data-table toggle, caps per §20.4 |
| **Callout / notification** | `rv-callout`, banners | Info/Warning/Error/Success; one per page; expandable details |
| **Empty / error / loading** | ad-hoc | skeleton, empty (reason + reset action), error (retry + what happened), stale-data state |
| **Tooltip + Definition popover** | `title`, «?» dialog | per [DGA] tooltip; essentials never inside |
| **AI message & AI chip** | Smart/Planning bubbles | AI-assisted/rule-based chip, confidence level, "basis" expander, feedback and escalation controls, states thinking/generating/refining |
| **Report/export template** | `exportReportModel` | logo, header/footer, page numbers, token fonts/colours — pending the logo (G-01) |

### 20.6 Governance

A token file (`tokens.css`/JSON) as the single source; lint rules forbidding raw hex, off-scale font sizes and non-token spacing in new code; automated axe + contrast checks; a visual-regression set for the 13 routes; a copy lint (no raw keys/ids, no English in Arabic strings, ≤ N pills per page); a short «دليل المنتج» page listing the tokens and components for the team.

---

## 21. Consolidated remediation plan (supersedes the phases in §6 and §14)

One plan for the functional (F-), content (C-), date (D-), hierarchy (H-) and visual (G-) findings. Order follows risk: misleading numbers and unusable controls first, then the shared foundation, then page migration, then conformance.

| Phase | Goal | Work items (finding ids) | Depends on | Exit criteria |
|---|---|---|---|---|
| **0 — Stop-the-line** | nothing misleading or unusable | numbers and bases: F-01, F-02, F-03, F-04 (guard), F-05 (guard), F-08 (labels), F-09, F-12; dates: D-01, D-02, D-04, D-05, D-06, D-07; governance: F-06, F-07 (guards); **G-06 Sanad button (1.15:1) and the worst danger-text contrast**; F-10 PowerPoint truncation; F-17 broken link; C-01 false statements | – | cross-view parity test passes; no AA failure on the worst 5 pages' primary actions |
| **1 — Foundation** | one design system | tokens and fonts (G-02, G-03, G-04, G-09, G-26); self-hosted Plex; logo/identity slot and naming (G-01, G-25 — needs assets, Q19); icons (G-11); focus/targets (G-07, G-08); shell with headings/landmarks/skip link/footer/404 (G-17, G-18); glossary and microcopy (C-02–C-10, §10.2–10.3); shared period control and filter on the DGA patterns (D-03, D-08, D-09, D-15, G-12, G-15); KPI card, tag, table, callout, states (G-16, G-19, G-05) | assets and decisions Q19–Q25; DGA Figma kit | token lint + axe pass on a sample page built from the shell |
| **2 — Migration** | every page on the system | order: Dashboard → Fixed reports → Smart reports → Planning (+ F-04 plan anchoring, F-06/F-07 workflow, F-24 scenarios) → Invoices → Collection → Exclusions → Risk/Data sources/Metrics → Contracts/Sanad/Investment → Login rewrite (G-22) → charts per caps (G-13) → tooltips (G-14) → RTL/mixed content (G-20) → AI extensions (G-21) | Phase 1 | each page: one `h1`, ≤ 6 pills, only tokens, AA, 44 px targets; visual-regression baselines |
| **3 — Conformance and outputs** | prove it | accessibility pass (axe + keyboard + screen reader on the five main journeys); mobile/tablet/desktop review at 375/768/1,280; exports on the template (G-23) with parity tests (F-10); dark-mode decision (G-24); performance/loading states at the full demo size (F-12) | Phase 2 | conformance checklist signed off; remaining exceptions documented |
| **4 — Platform** | durable and governed | server-side store and roles (F-19), approval authority (Q4), content/glossary ownership (Q16), commit history and removal of orphaned modules (F-28), LLM option if wanted | decisions | audit trail; role tests |

**Acceptance tests to add (cumulative):** same-scope cross-view numbers; relations/report block contract; export parity; period-module table tests (D-); interpreter golden phrases (F-05); timestamp formatting in Asia/Riyadh; bilingual script and no-raw-key copy lint; **design-token lint, axe-core run per route, contrast table, target-size check, heading-structure check, visual-regression snapshots**.

## 22. Additional questions (Q19–Q27)

19. **Logo and identity:** which marks must appear (MOMAH, NHC Innovation, DGA/flag lockup), in which versions and where? Please provide the official files and usage rules — none were in the material.
20. **Product name:** keep «منصة الفواتير الذكية / INTELLIBILL» or adopt the approved MOMAH product name for the tab title, header and exports?
21. **Reference completeness:** can you share the rest of the deck (slides 3–20 and 32–46) and the DGA **Figma UI kit**, so component dimensions, states and the elevation/radius rules can be matched exactly?
22. **Latin font:** is IBM Plex Sans Arabic acceptable for Latin text/numerals, or must English use IBM Plex Sans (the deck shows both)?
23. **Icons:** Hugeicons (deck) or the DGA icon set (DGA site)? If Hugeicons, which style and licence (free vs Pro)?
24. **Dark theme:** required, optional or to be removed? (The reference is silent; the product ships one.)
25. **Accents:** may the product keep a documented violet/blue accent for AI and categorical data (the deck allows additional accents), or must it stay strictly on the DGA palettes?
26. **Compliance level:** is WCAG 2.1 AA (as stated by DGA) the target, or 2.2 AA (24 px target minimum)? Is a formal accessibility test required before release?
27. **Exports:** should Word/Excel/PowerPoint carry the logo and a standard header/footer, and who supplies the template?

## 23. Limits of Part C

- The deck supplied is **15 of 47 slides**; "explicit MOMAH requirements" are therefore limited to what these slides and the DGA site state. The deck is not a MOMAH identity manual (no logo rules).
- Colour codes were read from a 200 dpi render of the slide, not from the Figma source; one value (Info 50) looks mistyped.
- The DGA site is a single-page application; I read the text of the pages listed in §17.1 through the built-in browser. Pages not read are listed there. Component demos were not exercised.
- The contrast/size/spacing figures come from a scripted pass over computed styles (§18.2): they are indicative and use the composited background; gradients and images are not sampled. No screen reader was used; dark mode, the 375 px layout (measured earlier at 390 px) and the full demo size were not re-tested in this pass.
- Screenshots attached to the briefs were not visible to me; observations come from the running app and code.
- Nothing in the product was modified during Part C. UI filters were changed during testing and reset; the earlier disclosure in §9 still applies.

---

## 24. Decisions received on Part C questions (2026-10-09) and their effect

| Q | Your answer | What I verified afterwards | Effect on the findings and plan |
|---|---|---|---|
| **Q19** Logos | **MOMAH** | **No MOMAH logo file was provided, and I found none in the project.** The only logo present in your files is the **NHC Innovation** mark (inside `HLSD Template - Alpha Phase.docx`, `word/media/image1.png`, and on the workshop deck). I did not copy it anywhere. | G-01 stays open on one missing input: the **official MOMAH logo files and usage rules** (versions for light/dark backgrounds, minimum size, clear space). Only MOMAH appears; NHC/DGA marks are not added unless you ask. |
| **Q20** Product name | **Keep as is** («منصة الفواتير الذكية» / INTELLIBILL) | – | G-25 reduced to *consistency only*: keep the name, but use it identically in the header, the tab title and the exports, and give each route its own page title («{الصفحة} — {المنتج}»). The header «IB» tile is replaced by the MOMAH logo next to the unchanged name. Open point: whether the login line «بنية HiAgent…» and the English "agent" pills stay (G-22) — they describe an architecture, not the name. |
| **Q21** Rest of the deck and Figma kit | link: `figma.com/@sdga` | Opened the DGA Figma community profile. It lists the official resources: **Components Library**, **Foundations**, **Mobile Components**, **Icons**, and templates including **Chatbot**, **Page Not Found**, Form, Service, Home. The file pages state "DS-DGA@dga.gov.sa" for feedback. Opening a file ("Open in Figma") needs a Figma sign-in, so I could read each file's description but **not its component dimensions, states or tokens**. Slides 3–20 and 32–46 of the deck are still not in the file you sent. | The exact component specs (heights, paddings, radii, states) remain a Phase 1 input: someone with Figma access should duplicate the Components Library and Foundations files and share the values, or I can work from screenshots/exports you provide. |
| **Q23** Icons | "whatever is suitable" (left to me) | The DGA **Icons – Platforms Code** file carries a note dated 11 Jan 2026: *"the icon library is currently being updated; icons may be temporarily unavailable"* — and community comments ask when it returns. Hugeicons' pricing page lists a **Free** plan with **6,000+ Stroke Rounded icons** described as "perfect for personal projects, students, and learning", and **Pro** at $99/year per seat (60,000+ icons, 10 styles). | **Recommendation:** use **Hugeicons, Stroke Rounded** now (it is the set named on slide 10 and the style shown there; the free plan already covers that style) at 16/20/24 px, mapped through one icon component so it can be swapped for the DGA set when that library is available again. **Licence:** the free plan's wording suggests non-commercial use; for a government deployment confirm the licence terms or buy Pro before release (decision for the owner — I did not read the full licence text). |
| **Q24** Dark theme | **Not necessary now** | The product currently follows the *system* colour scheme (`prefers-color-scheme: dark` in `variables.css`), so users whose OS is dark already get an **untested** theme. | G-24 becomes: **out of scope for now**. Recommended (Rec.): lock the app to the light theme and hide the toggle until a dark design is approved, so nobody sees the untested one. Removes dark-mode testing from Phase 3. |

**Still open:** Q22 (Latin font), Q25 (extra accent colours), Q26 (WCAG 2.1 vs 2.2), Q27 (export template and who supplies it), and the earlier functional/date questions Q1–Q18.

**Plan changes:** Phase 1 loses the dark-mode work and gains "icon component + Hugeicons Stroke Rounded (licence check)"; the logo slot is built in Phase 1 but filled only when the MOMAH files arrive; Phase 3 acceptance no longer includes dark mode.

## 25. Decisions on the remaining Part C questions (2026-10-09)

| Q | Your answer | Check / reasoning | Effect |
|---|---|---|---|
| **Q22** Latin font | **One family for both languages** (IBM Plex Sans Arabic) | Verified in the running app: the Google Fonts delivery of *IBM Plex Sans Arabic* ships separate Latin (U+0000–00FF) and Latin-extended subsets, they load, and a Latin/number string measures differently from the fallback fonts — so Latin text and digits **are rendered by the same family** today. This is a documented deviation from slide 8, which shows IBM Plex Sans for English next to the Arabic face; it needs the product owner's sign-off, not a design-system exception. | G-02 narrowed: keep **one family**; drop **Plex Mono** (use tabular numerals), restrict weights to 400/500/600/700, self-host the family (all subsets used), keep a fallback stack. No second family to license/ship. |
| **Q25** Accent colours | **Stay with DGA only** | – | G-04/G-05 tightened: the violet (`#6B57A6`), orange (`#9A5C00`), the extra blue (`#0A6FA6`), gold chart colours and every non-DGA hue are **removed**, not kept as accents. Categorical colours come from the DGA palettes only (§20.1: SA 600, Info 600, Warning 500, Gray 500, Error 600; lavender/gold only if the DGA colour page publishes their hex values). AI-generated blocks are marked with an **AI chip + icon** in SA 700 / Gray 600, not a separate hue. Charts follow the DGA caps (≤ 3 series, ≤ 6 slices); more categories → ranked table. |
| **Q26** WCAG level | "I don't know which is suitable" | DGA states the target as **WCAG 2.1 AA**. WCAG 2.2 AA is a superset that adds, among others, **24 × 24 px minimum target size** and **focus not obscured** — directly relevant here: 29–102 controls per page are under 24 px (G-08) and the sticky header hides anchor targets and can cover focused items (F-29, G-07). | **Recommendation (my decision for the plan):** declare **WCAG 2.1 AA** as the compliance statement (it is what DGA requires) and build to **2.2 AA** where it costs little (24 px target floor, 44 px on touch, focus never hidden under the sticky header). Add an automated check (axe + contrast table) and a manual keyboard/screen-reader pass on the five main journeys before release. If the programme later asks for a formal statement, it can be issued against 2.1 AA without rework. |
| **Q27** Export template | "I don't know" | The reference does not cover exports (§17.4-7). Word and PowerPoint do **not** embed web fonts, so IBM Plex must be installed on the reader's machine or the file falls back to a default. | **Recommendation:** yes — every export carries the MOMAH logo (when supplied), the report title, the period/scope/basis line, the data cut-off, the "demo/synthetic data" statement, page numbers and a footer; colours from the DGA tokens (SA 600 headings, Gray fills); body font set to IBM Plex Sans Arabic **with a stated fallback (Arial/Calibri)** so documents stay readable when the font is missing; PowerPoint tables are paginated, never truncated (F-10). **Owner:** the product team builds the template from the tokens; the **ministry's brand/communications owner approves** it and supplies the logo. Until the logo arrives, exports keep a text-only header. |

**Updated list of what is still needed from you:** (1) the official **MOMAH logo files and usage rules** (Q19); (2) the **Figma components/foundations values** or exports (Q21); (3) confirmation of the **Hugeicons licence** or purchase of Pro (Q23); (4) the **functional and date decisions** Q1–Q18 (e.g. basis of closed periods, plan anchoring, approval authority, fiscal year, presets, digits/Hijri, Smart-report scope). None of these blocks Phase 0.

---

# PART D — Evidence update, consolidated backlog, decisions needed, acceptance criteria and implementation plan

Added 2026-10-09 (version 3). **Analysis only — nothing was implemented and no data was changed during this review** (only read operations; see §26.3). The agreed structure is preserved: **(1) لوحة المعلومات والتقارير** = Dashboard · Fixed reports · prompt-based Smart reports; **(2) التخطيط المالي والاستراتيجي** = revenues, expenditures, strategic objectives, scenarios and follow-up. The operational modules (invoices, collection, exclusions, contracts, data sources) stay as supporting pages.

This part **supersedes the limitation notes** in the header, §8, §16 and §23 that said the screenshots and monthly reports had not been reviewed.

## 26. Evidence update

### 26.1 Screenshots reviewed (8 files)

Reviewed in full: `Screenshot 2026-10-09 at 1.19.04 / 1.19.05 / 1.19.08 AM`, `2.57.36 / 2.57.40 PM`, `3.21.05 / 3.21.10 / 3.21.27 PM` (Desktop). They are the screenshots taken on the day of the restructuring and audit briefs. About 60 older screenshots (27 Sep – 8 Oct) were **not** opened: they predate these briefs; tell me if some of them were meant for this audit.

| Screenshot (URL, time) | What it shows | Effect on the audit |
|---|---|---|
| `/reports`, `/smart-reports` (1:19 AM) | the **previous** interface: 14 top-level tabs (التنفيذي، تحليل الإيرادات، سجل الفواتير، عدم التحصيل والاستبعادات، قائمة التحصيل، العقود والتنفيذ، جودة البيانات والمخاطر، غرفة التخطيط، المساعد الذكي، التقارير الذكية، مركز التقارير، اللوحة الاستراتيجية، مصادر البيانات، قاموس المقاييس); the report centre with 11 numbered sections; amounts in **«ألف مليون SAR»** (e.g. "0.461 ألف مليون SAR" for 461 million); a floating «مهام التحليل» tray (count bubble) over the content; a floating «اسأل المساعد» button | confirms the **duplication baseline** (F-21): the same KPI block and relations bar appeared on four pages. The new IA removed those four copies, but the **nine fixed reports still repeat a KPI strip** and the **floating elements remain** (assistant button, planning button, task tray — G-20). The retired unit «ألف مليون» no longer appears (verified in §4.2). |
| `/decision-room` (2:57 PM) | planning room with a red badge **«Failed to fetch»** (raw English network error shown to the user), «SAR 0 … 0 %» expected receipts, a count bubble over the task tray | confirms the failure-state problem now handled by `resilientFetch` and `AsyncBlock` (F-12 covers the **remaining** gap: stale figures and silent failure after the first load). The room no longer exists. |
| `/what-if` (2:57 PM) | «اللوحة الاستراتيجية» with sliders (0–100 %) for volume, rate, litigation, uncollectible, a disclaimer paragraph | scenario levers moved into Planning; the **long disclaimer paragraph** pattern persists in new pages (C-04). |
| `/dashboard`, `/executive`, `/strategic` (3:21 PM) | three pages repeating the same six KPI tiles (e.g. gross, net, collected, rate), the same equation bar and the same filter bar; the third labels the same delta «▼ -0.1 pp» | same as above. Note the filter state shown (this month, 9 invoices) is a **tiny sample** with no caution on the tiles (H-). |

**Limitation that remains:** the screenshots show the old routes, so I cannot tell whether they were captured from a stale browser tab or from before the restructuring. They add **no new defect of the restructured pages**; they strengthen F-21, F-12, G-20 and C-04, and they are the "before" baseline for the visual comparison.

### 26.2 Original monthly reports reviewed

Reviewed directly (converted from the originals in `Downloads` and read slide by slide): the **July 2026 report (26 slides)** and the **January, February and March 2026 reports (18–20 slides)**. The earlier mapping (`docs/monthly-reports-mapping-ar.md`) covered January–March only. **No ministry figures are reproduced in this document or in the product**; only structure, labels and definitions are recorded.

What the originals show, and what changes in the audit:

| # | Evidence in the reports | Effect |
|---|---|---|
| **E-1** | **Grace periods are applied and named in footnotes, and they differ:** March, Amanah-vs-target slide: «تم احتساب فترة سماح **15** يوماً»; July, Amanah-vs-target slide: «تم احتساب فترة سماح **35** يوم»; July, enforcement slide: «فترة السماح وفق نظام إيرادات الدولة (**60** يوماً) بالإضافة إلى فترة إشعار المطالبة بالأداء وفق نظام التنفيذ أمام ديوان المظالم (**30** يوماً)». The platform defaults to **«أيام السماح: 0 (غير محسوم)»** (`ScopeBar`, `cfg.graceDays`). | **New finding F-32** and essential question **EQ2**. The earlier mapping said "grace unresolved"; the originals show a policy that varies by report and period. |
| **E-2** | **Targets are present in the reports:** the Amanah comparison slide shows a **single collection-rate target applied to every Amanah** next to the actual ratio (map layout); the executive slide shows an annual appropriation/target per sector. The platform's demo target equals that displayed value. | The audit and UI say "no approved targets in the data". Reword: **targets appear in the monthly reports; their approval status, owner and version are not documented in the material provided** (**F-34**, EQ6). |
| **E-3** | **Operating-expenditure coverage is defined in the reports as collected-to-date ÷ the prorated original appropriation of chapters 1–3 to date**, per Amanah, with the annual appropriation as a separate column (checked arithmetically on two rows). The platform computes **receipts ÷ cash payments of chapters 1–3** (synthetic) — a different denominator — and has no per-Amanah appropriation. | **New finding F-33** and **EQ5**: the platform's "coverage" does not reproduce the reports' definition. The synthetic budget already holds the prorated budget, so the report's definition can be shown nationally without new data. |
| **E-4** | **July adds three sections absent from Jan–Mar and from the platform:** (a) **enforcement referral** — portfolio, referable amount, non-referable amount, enforced-against, collected from enforcement and ratios, by Amanah, with sources (Sanad, Eefaa, Tahseel) and three footnotes; (b) **income-participation report** — monthly counts per Amanah with future months left blank; (c) **e-invoice report** — counts per Amanah by revenue source. Also quarterly collection bars (2026 vs 2025). | **F-35 / B-12:** the nine fixed reports do not cover (a)–(c). (a) is partly supportable (Sanad cases exist); (b)–(c) need data sources the demo does not hold. |
| **E-5** | **Units and blanks:** one unit per table («المبالغ بالمليون» / «بالألف ريال») stated in a chip on each slide; future months are left **blank**, not zero. | confirms the platform's one-unit rule and "unavailable ≠ zero" (no change). |
| **E-6** | **Comparison style:** cumulative year-to-month for 2026 and 2025 side by side, change columns in % for amounts and in points for ratios. The slides **do not state the date up to which collections were counted**. | the platform's comparison design is consistent in form. The **official as-of basis cannot be inferred** from the reports → F-01's basis question stays a business decision (EQ1). |
| **E-7** | **Branding:** the reports carry the **MOMAH lockup** (emblem + «وزارة البلديات والإسكان / Ministry of Municipalities & Housing»): white on the teal cover/contents slides, coloured on white tiles. The July deck embeds a coloured **PNG 1058 × 325 px, transparent** (`ppt/media/image4.png`). The report template uses **teal/dark-green headers with a lime accent** — not DGA SA 600. | **Candidate source** for G-01 (not an official asset — raster, unknown version). It also opens **Q-asset-2:** exports/reports follow the *ministry report template* or the *DGA foundation*? |
| **E-8** | Tables label unit chips, totals rows and per-sector sub-totals («مجموع قطاع البلدي»، «الإسكان»، «الإجمالي»); exclusions appendix columns = no contract, enforced-against (Sanad), enforced-against (Eefaa), incomplete, outside Eefaa, written-off records, open objections. | matches the platform's exclusion reasons (no change). |

### 26.3 Plan modification — restoration status (read-only check)

**Not restored.** Verified now by reading the stored record and comparing it with the backup taken at the start of the audit (`sessionStorage.__audit_bak`, preview tab):

| Item | Value |
|---|---|
| Store / key | browser `localStorage` of the preview tab, key `ib_plans_v1` |
| Record | plan **`PLAN-MV0YG5BNEW`** — «خطة السنة المالية 2026 (مسودة)» |
| Field changed | `scenario.dRate` (collection-rate lever, percentage points) |
| Original → current | **3 → 8** |
| Everything else in the record | identical to the backup (status `approved`, version 1, `approvedBy` «李芳军», history 3 entries — **no history entry was written for the change**, the saved version 1 still holds `dRate = 3`) |
| `ib_actions_v1` | identical to the backup |
| `ib_smart_convs_v1` | original conversation `mv0yf555i7rh` («قارن», 12 messages) unchanged; **5 test conversations added** by me: `mv12a30lccy4`, `mv12amvb5m2c`, `mv12jjvcrk00`, `mv12rol4pq0u`, `mv12tj8lvjzi` |
| UI state | shared filters = year to date / all; language = Arabic |

No data was changed in this review. The correction needs your approval (set the lever back to 3 and, if you wish, delete the five test conversations); the backup values are still in the tab.

### 26.4 New findings from this evidence review

| ID | Finding | Evidence | Sev. |
|---|---|---|---|
| **F-32** | **Grace-period policy is missing from the platform.** Reports apply 15 / 35 days (target comparison) and 60 + 30 days (enforcement referral); the platform uses 0 and says "unresolved". Overdue/aging, "collected vs due" ratios and referral eligibility depend on it. | reports (E-1); `cfg.graceDays` | P1 |
| **F-33** | **"Operating-expenditure coverage" is not the reports' metric** (collected ÷ prorated appropriation, per Amanah) — the platform's is receipts ÷ cash payments, national only. | reports (E-3); `syntheticFinance.operatingCoverage` | P1 |
| **F-34** | **Target wording is inaccurate.** UI and exports say targets are demo-only/not in the data; the reports display a collection target per Amanah and annual targets. Approval status unknown. | reports (E-2); `ObjectivesPanel`, `PlanOutlook` texts | P2 |
| **F-35** | **Report parity gap:** enforcement-referral, income-participation and e-invoice sections of the July report have no counterpart; the platform's fixed reports were mapped from Jan–Mar only. | reports (E-4); `docs/monthly-reports-mapping-ar.md` | P2 |

---

## 27. Consolidated backlog (by root cause)

Every finding is grouped under the root cause that explains it, so each epic is **one change set**, not a list of symptoms. Type: **A** = verified defect, can be corrected without a business decision · **B** = needs a financial-definition or approval-policy decision · **C** = depends on official logo assets or exact design specifications. "Phase" refers to §31.

| Epic | Root cause | Findings it closes | Type | Pri. | Phase |
|---|---|---|---|---|---|
| **B-01 Shared measurement and period module** | the measurement date, period, comparison and scope are decided separately in each view; no loading/stale or configuration state is shared | F-01, F-12, F-13, F-20, F-23, F-25, D-03, D-04, D-05, D-06, D-08, D-14, C-02 (naming of the two "uncollected"), H- (basis line), F-32 (grace as parameter) | **A** (module, labels, states) + **B** (default basis EQ1, grace values EQ2) | P0 | 0–1 |
| **B-02 Date control and validation** | no validated date control; UTC used for display | D-01, D-02, D-07, D-09, D-10, D-11, D-12, D-15, G-12, G-15 | **A**; **C** for the visual form of the DGA date picker/filter | P0 | 0–1 |
| **B-03 Report-model contracts and export parity** | each block is fed ad-hoc shapes and placeholders; exports written separately from the screen | F-02, F-03, F-09, F-10, F-11, F-21 (repeated KPI strip), F-22, C-01 (a–d, g), F-34 (wording) | **A** | P0 | 0 |
| **B-04 Plan binding, versions and scenarios** | planning reads the dashboard filter, not the saved plan; versions store only a summary | F-04, F-14, F-19 (plan part), F-24, F-26, D-13, F-33 (coverage in planning) | **A** (binding, banner, version content) + **B** (EQ4, EQ5, EQ6) | P0 | 1–2 |
| **B-05 Proposal → approval → revision workflow** | no state model for proposed/approved/revised; identity and roles not modelled | F-06, F-07, F-15, F-30 (prompt dialogs), author-name defect | **A** (guards: scenario → *proposed*, approved plans immutable-or-revision, scoped ids, name resolver) + **B** (who approves — EQ4) | P0 (guards) / P1 | 0–2 |
| **B-06 Smart-report interpreter and conversation** | keyword rules without a "recognised but not applied" check or confirmation; session state not persisted correctly | F-05, F-16, C-07, G-21 (AI states, indicator, confidence, feedback, escalation) | **A** (guards, fixes, UX) + **B** (EQ8 scope/sync) | P0 / P1 | 0–2 |
| **B-07 Exclusion approval semantics** | one word «معتمد» used for rule approval and review approval | F-08, C-01 (e, f) | **B** (EQ3) — labels/band can ship before | P1 | 1 |
| **B-08 Content design and glossary** | no content standard; disclaimers and codes pasted into screens | C-01…C-10, H-hierarchy rows, F-18 (hints), F-27, G-22 (login) | **A** (removal, restructure, glossary draft) | P1 | 1–2 |
| **B-09 Accessibility quick wins** | contrast, focus, target size, headings not enforced | G-06 (Sanad «فتح» 1.15:1 first), G-07, G-08, G-17, G-19 | **A** | **P0** (G-06) / P1 | 0–1 |
| **B-10 Design-system foundation** | tokens come from another prototype; no shared components | G-02, G-03, G-04, G-05, G-09, G-10, G-11, G-13, G-14, G-16, G-18, G-20, G-24 (lock light theme), G-26, F-28, F-29 | **A** for tokens/fonts/scale/spacing/colour (DGA values are public and decided); **C** for exact component dimensions (Figma), icon licence | P1 | 1–2 |
| **B-11 Brand and identity** | no official logo asset or usage rules; export template undefined | G-01, G-23, G-25 | **C** | P1 | 1 (slot) / 3 (final) |
| **B-12 Navigation and IA residue** | legacy links and entries not cleaned | F-17, F-18, F-31, G-18 | **A** | P1 | 0–2 |
| **B-13 Report parity with the ministry monthly report** | fixed reports mapped from Jan–Mar only; coverage and referral definitions differ | F-33, F-35, E-4 | **B** (EQ5, EQ9) | P2 | 2–3 |
| **B-14 Persistence, roles and server store** | everything is browser-local; one demo user | F-19 | **B** (EQ10) | P2 | 4 |

**Coverage check:** F-01…F-35, C-01…C-10, D-01…D-15, G-01…G-26 each appear in at least one epic; no finding is left as a stand-alone change.

---

## 28. What can proceed — by dependency

### 28.1 Group A — verified defects correctable **without** a business decision

| Item | Findings | Verified by |
|---|---|---|
| Pass the full totals to the relations block; typed contract | F-02 | Verified (UI + code) |
| Remove the false "no recommended interventions" (or feed it from the proposal source); remove other false statements | F-03, C-01 | Verified (UI) |
| Fix the English-first helper in proposals | F-09 | Verified (code + UI) |
| PowerPoint pagination (no truncation, totals kept); Excel notes sheet, % in headers, sheet names; screen/export parity tests | F-10 | Verified (parsed files) |
| Smart reports: empty-state rule, no zeros, no raw keys in messages | F-11 | Verified (UI) |
| Loading/stale/error state on Dashboard and fixed reports | F-12 | Verified (sampling) |
| `?src=` becomes a visible removable filter; KPI strip uses the same scope | F-13 | Verified (UI) |
| Planning renders plan, objectives and register even when the filter returns no invoices | F-14 | Verified (UI) |
| Proposal ids include scope and period | F-15 | Verified (UI + code) |
| Smart UX: scroll to top, no `?q=` replay, correct clarification text, titles, "data as of" stamp, draft kept | F-16 | Verified (UI) |
| Broken link «التنبؤ والمستهدف», unknown-route page, nav entries, page titles | F-17, F-18 (part) | Verified |
| Date validation (start ≤ end ≤ today, coverage start), Riyadh time formatting, reject future quarters, equal-length comparison rules | D-01, D-02, D-04, D-05, D-07 | Verified (UI + function output) |
| Scenario action created as *proposed*; approved plan edits create a draft revision (or are blocked); history on every edit; author name by language; remove «(مسودة)» from approved names | F-06 (guard), F-07 (guard) | Verified (code + stored data) |
| Smart interpreter "recognised-but-not-applied" guard and the ten verified mis-readings | F-05 | Verified (function output + UI) |
| Sanad «فتح» contrast, danger/success text tokens, focus ring, target size, `h1` and landmarks | G-06, G-07, G-08, G-17 | Verified (UI + script) |
| Tokens, one font family (decided), type scale, spacing, DGA palette only (decided), light theme lock (decided), icon component | G-02–G-05, G-09–G-11, G-24 | specified by DGA + your decisions |
| Content: remove codes/keys/ids/jargon, one disclaimer, expandable details, hierarchy order | C-02…C-10, H- | Verified (UI) |
| English Amanah names in Arabic tables, `bdi` for embedded numbers | G-20 | Verified (UI) |
| Municipality duplicate-row labels | F-22 | Verified (UI) |

### 28.2 Group B — requires a financial definition or approval-policy decision

| Decision | Blocks only | Everything else proceeds with a labelled default |
|---|---|---|
| **EQ1** as-of basis for closed periods | the *default* shown in the headline | the module, the switch, the visible basis line |
| **EQ2** grace-period policy | the numbers of overdue/aging and ratios after grace | a grace parameter shown on every figure; value 0 is displayed as «بدون فترة سماح» until decided |
| **EQ3** meaning of "approved" exclusions | whether unapproved-rule exclusions reduce headline net | relabel + separate band «منها بقواعد غير معتمدة» |
| **EQ4** plan anchoring and approval authority | role model | binding to plan scope, banner, versions, proposed ≠ approved |
| **EQ5** coverage definition | the primary coverage tile | both definitions available, labelled |
| **EQ6** fiscal year and targets | target ownership/approval fields | targets stored with source and "approval: unknown" |
| **EQ7** presets / «آخر 3 أشهر» | the label of one preset | preset registry (table-driven) |
| **EQ8** Smart-report scope and sync | sync default | explicit control; budget requests redirected |
| **EQ9** which July sections to add | B-13 only | none of the others |
| **EQ10** persistence | B-14 only | local storage with an export/import of plans |

### 28.3 Group C — depends on official assets or exact specifications

| Needed | Blocks | Proceeds meanwhile |
|---|---|---|
| Official **MOMAH logo** files (vector, versions) and usage rules; confirmation whether the PNG found in the July deck may be used | final header, login, favicon, exports | a logo slot with the product name (unchanged) |
| DGA **Figma Components Library / Foundations** values (heights, radii, states), elevation, chart colours (lavender/gold hex), Info 50 value | pixel-level match of date picker, filter, KPI card, table | tokens from the published DGA pages and the deck |
| **Hugeicons licence** (or Pro purchase) | shipping the icon set | the icon component with placeholders |
| **Export template** decision: ministry report template (teal) vs DGA foundation (green), and who supplies it | final Word/PowerPoint/Excel look | text-only header; parity fixes (Group A) |
| Remaining deck slides 3–20 and 32–46 | none known | – |

---

## 29. Essential unresolved business questions (Q1–Q18 reduced to ten)

Each question: **affects** · **recommended option** · **what proceeds independently**.

| ID | Question | Affected calculation / journey | Recommendation | Proceeds independently |
|---|---|---|---|---|
| **EQ1** (Q1, Q15) | For a **closed** period (e.g. last month), are collections counted **to the period end** or **to today**? And which one does the comparison use? | collected, uncollected, rate and delta on Dashboard, fixed reports, Smart reports, Planning baseline (F-01, D-06) | **Period end** as the headline and comparison (like-for-like) with **"to today" as a second labelled figure**; open periods count to today. The monthly reports do not state their basis, so it cannot be copied from them. | build the shared module and the visible basis switch; keep today's behaviour behind a flag until you decide |
| **EQ2** (new) | Which **grace period** applies to (a) collection-rate-vs-target comparison (reports show 15 days in March, 35 in July), (b) overdue/aging, (c) enforcement-referral eligibility (reports state 60 + 30 days)? | overdue and aging classification, ratios after grace, referral share (F-32) | one named parameter per use, each shown on the figure; value and effective dates from the official policy; until then show «بدون فترة سماح» | parameterise and display; no silent default |
| **EQ3** (Q5) | Should exclusions that rest on **unapproved rule definitions** reduce the headline **net billed** and rate? | net billed, collection rate, exclusion rate, status labels (F-08) | keep the current calculation but show a visible band **«منها استبعادات بقواعد غير معتمدة»** and rename labels; decide treatment once the rules are approved | relabel and band |
| **EQ4** (Q3, Q4) | Do planning figures always use the **saved plan's period and scope** (not the dashboard filter), and **who may approve** plans, objectives and actions (can the proposer approve)? | planning results, saved versions, register, approvals (F-04, F-06, F-07) | **Yes** to plan-anchored figures with a banner when the filter differs; **proposer ≠ approver**, two roles (reviewer, approver) configurable | binding, versions, proposed/approved states, audit trail |
| **EQ5** (new) | Which definition of **operating-expenditure coverage** is official: collected ÷ prorated appropriation of chapters 1–3 (as in the reports) or receipts ÷ payments? | budget card, budget report, planning variance and funding (F-33) | **the reports' definition** as primary (labelled, national until per-Amanah appropriation exists); the payments-based ratio as «تغطية نقدية (اصطناعية)» | both computed and labelled |
| **EQ6** (Q14 + targets) | Is the fiscal year the Gregorian calendar year, and are the **collection target (uniform per Amanah)** and the annual sector targets **approved/versioned**? | YTD, objectives, variance, required pace (D-13, F-34) | calendar year; store each target with source, version and «حالة الاعتماد: غير مؤكدة» until confirmed | all planning screens with the label |
| **EQ7** (Q11) | What does **«آخر 3 أشهر»** mean, and which presets are offered? | presets, AI interpreter, comparisons (D-03, D-08) | **three complete calendar months**; presets: today, MTD, last complete month, last 3 complete months, QTD, YTD, custom, all data | a table-driven preset registry |
| **EQ8** (Q2, Q6) | Does a Smart-report conversation **follow the dashboard filters live**, and must it also produce **budget/expenditure** reports? | Smart-report context, scope chips, budget requests (F-05, F-16) | own scope with an explicit **sync** control; budget/expenditure requests **redirect to the fixed report** | interpretation guard, context persistence |
| **EQ9** (new) | Which sections of the **July report** must the platform add: enforcement referral, income participation, e-invoice, quarterly bars? | fixed-report catalogue (F-35) | add **enforcement referral** first (Sanad data exists); quarterly bars next; income participation and e-invoice only when their sources exist | everything else |
| **EQ10** (Q9, Q10) | Is browser-local storage acceptable for the demo, and when is a **server store with identities** required? | persistence of plans, actions, conversations (F-19) | local storage now with a visible notice and plan export/import; server store as Phase 4 | all of Phases 0–3 |

**Reduced to defaults (no decision needed; change on request):** Q7 languages → Arabic and English only in the new areas, Chinese kept in navigation only · Q8 scale → review at the compact size, test the full size in Phase 3 · Q9 synthetic budget card → keep, collapsed, labelled «تجريبية» · Q12 digits → Western digits, Gregorian dates · Q13 Hijri → optional later · Q16 content owner → product owner names a reviewer; glossary in §10.3 is the draft · Q17 disclaimers → one «بيانات تجريبية» badge, full statement in export footers · Q18 attention block → aging > 90 days, lowest-performing source, unapproved-rule exclusions.

---

## 30. Measurable acceptance criteria

Each criterion has a **method** and a **pass threshold**. "Reference matrix" = the same 12 selections run everywhere: {year to date, month to date, last complete month, last 3 complete months} × {all, one Amanah, one source} plus {empty selection}; the data is the compact demo at the fixed test date `2026-10-09`.

### AC-A — Consistent figures across Dashboard, Fixed reports and Smart reports

| ID | Criterion | Method | Threshold |
|---|---|---|---|
| A1 | gross, exclusions, net, collected, uncollected, invoice count, collection rate, exclusion rate are equal in the Dashboard, every fixed report that shows them, the Smart report (with and without comparison) and the Planning baseline | automated cross-view test over the reference matrix | difference **0 SAR / 0.0 pp** after identical rounding; 100 % of cells |
| A2 | the comparison **sign and value** are identical in all views for closed and open periods | same test | 0 mismatches; delta = displayed value − displayed comparison value (±0.05 pp) |
| A3 | every figure block states its collection date and it equals the computing parameter | parse the rendered label vs the request | 100 % of blocks |
| A4 | the relations block shows the same rates as the KPI row; its bar segments add to 100 % ±0.1 | DOM test on all reports | 0 occurrences of «غير متاحة» when the measure is calculable; 0 `NaN` widths |
| A5 | "no recommendations" is printed only when the proposal list is empty **and** no insight is flagged «يستدعي إجراء» | content test | 0 contradictions in the matrix |
| A6 | the period uncollected and the standing balance carry distinct names everywhere | glossary lint | 0 uses of «المتبقي» / duplicate labels |

### AC-B — Planning anchored to the saved plan's scope and period

| ID | Criterion | Method | Threshold |
|---|---|---|---|
| B1 | opening a saved plan under **any** global filter gives the same objective statuses, variance, forecast, scenario outputs and funding projection as under the plan's own scope | open under 8 different filters, diff the outputs | **0** differences |
| B2 | each saved version stores period, scope, basis, configuration hash, targets, data cut-off and the headline results; reopening it reproduces the stored results or shows «تغيّرت البيانات منذ الحفظ» with the diff | version round-trip test, also after a simulated date change | 100 % |
| B3 | a banner appears whenever the active filter differs from the plan scope | UI test over the matrix | 100 % |
| B4 | scenarios never change actuals or targets and never double count: total cash effect ≤ available uncollected; lever limits enforced | property test with 1,000 random lever sets | 0 violations |
| B5 | the funding projection and objectives use the plan period only | unit test | pass |
| B6 | at least two **named scenarios** per plan can be compared side by side with the baseline (≥ 6 outputs and deltas) | UI test | pass |

### AC-C — Prompt interpretation and conversation context

| ID | Criterion | Method | Threshold |
|---|---|---|---|
| C1 | interpretation accuracy on a golden corpus of **≥ 150** Arabic/English phrases (period, Amanah, source, status, comparison, sections) | automated | **≥ 95 %** overall and **100 %** on the 10 verified failures (§3 F-05) |
| C2 | requests the system cannot satisfy produce a clarification or an explicit "unsupported" with a pointer — never a generic report or a wrong scope | 30 adversarial phrases | 100 % |
| C3 | every report shows an interpreted-request line; changed chips equal the diff of the spec | UI test | 100 % |
| C4 | a six-step follow-up chain keeps all filters unless changed; reloading/reopening restores the last report with a «حتى {تاريخ}» stamp; five reloads of a `?q=` link add **0** messages; reopening lands at the top of the page; leaving and returning keeps the active conversation and the draft | UI test | pass |
| C5 | a new conversation starts from the shared filters; a visible control syncs or detaches them | UI test | pass |
| C6 | a question returns a figure with its basis, or a redirect (e.g. budget) | UI test | 100 % of 20 questions |

### AC-D — Reliable date controls and comparisons

| ID | Criterion | Method | Threshold |
|---|---|---|---|
| D1 | invalid ranges (start > end, end > today, start before data, empty) are rejected with a specific inline message and **no request is sent** | UI + network test, 12 cases | 100 % |
| D2 | every preset equals its definition in §12.2 | table-driven test over 24 reference dates (month ends, 1 Jan, 29 Feb, day rollover) | 100 % |
| D3 | «آخر 3 أشهر مكتملة» is exactly three complete calendar months for each month of 2026, and the Smart interpreter returns the same range | test | 12/12 |
| D4 | the comparison period has an equal elapsed length and both date ranges are displayed | test over all presets | 100 % |
| D5 | all displayed and exported times/dates use Asia/Riyadh | test at 21:00, 23:30, 00:30, 02:30 UTC | 0 off-by-one dates (screen, subtitle, file name, history) |
| D6 | the active-filter count is correct; one click resets to defaults; persistence is stated | UI test | pass |
| D7 | the data range is printed next to the control and «كل البيانات» shows its start date | UI test | pass |

### AC-E — Proposed vs approved actions and plan revisions

| ID | Criterion | Method | Threshold |
|---|---|---|---|
| E1 | every creation path (proposal, scenario, manual) yields status **proposed**; "approved" exists only after an approver action | test all 3 paths | 0 direct approvals |
| E2 | approval records approver, timestamp and version; the approver differs from the proposer when roles are enabled | UI + data test | 100 % of approvals |
| E3 | editing an approved plan or objective produces a **new draft revision** (version + 1, approval cleared) or is blocked; the approved version is byte-identical afterwards | repeat the observed case (change a scenario lever) and diff the stored record | 0 silent mutations |
| E4 | every history entry carries an identity shown in the interface language | data test | 100 % |
| E5 | approving or rejecting a proposal in one scope/period does not hide it in another | test | pass |

### AC-F — Screen/export consistency

| ID | Criterion | Method | Threshold |
|---|---|---|---|
| F1 | every table row (including totals), chart series and callout shown on screen exists in Word, Excel and PowerPoint; amounts match the exact-SAR sheet | parity script over 9 fixed reports + Smart report + plan summary | 100 % of rows; **0 truncated tables** |
| F2 | each export carries period, scope, basis, data cut-off, generated time (Riyadh) and the data label | parse files | 100 % |
| F3 | percentage columns show «٪/%» in the header; sheet names are not cut mid-word | file test | pass |
| F4 | export file name and subtitle use the same (Riyadh) date | test | pass |

### AC-G — Concise Arabic content and platform-wide visual consistency

| ID | Criterion | Method | Threshold |
|---|---|---|---|
| G1 | Dashboard default view ≤ **450** visible words; monthly report first KPI within **450 px** of the page top; Planning first section within **600 px**; ≤ **6** status pills per page; every tooltip ≤ **25** words | scripted measurement (as in §10) | all pass |
| G2 | copy lint: 0 raw keys/ids/rule codes, 0 English words in Arabic strings (allow-list only), 100 % glossary terms (§10.3), 0 strings on the false-statement blacklist | lint | pass |
| G3 | tokens: 0 raw hex values outside the token file; 100 % of text sizes within the DGA scale; spacing multiples of 4 ≥ 95 %; one font family; weights 400–700 only | lint + computed-style script | pass |
| G4 | accessibility: 0 WCAG 2.1 AA contrast failures on the 13 routes; targets ≥ 24 px (100 %) and ≥ 44 px on touch widths; one `h1` per page and landmarks on 13/13; visible focus (≥ 3:1); keyboard walk-through of the 5 main journeys passes | axe + custom script + manual pass | pass |
| G5 | responsive: no horizontal overflow at 375, 768, 1,280 px; header ≤ 25 % of the viewport height at 375 px | visual-regression snapshots | pass |
| G6 | logo and name appear per the supplied asset rules (when provided); favicon and tab title use the approved name | review | pass |

---

## 31. Phased implementation plan (not started)

Order: stop misleading output → one measurement/period contract → plan binding and workflow → foundation and migration → conformance. Items that wait for a decision or an asset are marked **[B]** or **[C]** and have a labelled default so work never stops.

| Phase | Goal | Work packages | Gate / dependency | Exit (acceptance) |
|---|---|---|---|---|
| **0 — Stop-the-line** (no decision needed) | no wrong, contradictory or invisible output | B-03 (F-02, F-03, F-09, F-10, F-11, C-01); B-09 first item (G-06 Sanad contrast, focus ring); B-02 validation (D-01, D-02, D-04, D-07); B-12 broken link and page titles (F-17); B-05 guards (scenario → proposed, approved-plan edits, scoped proposal ids, name resolver); B-06 guards (F-05 misreads, `?q=` replay, clarification text, scroll) | none | AC-A4, A5, D1, D5, E1, E3, E5, F1, C1 (critical set), C4 (part) |
| **1 — Contracts and foundation** | one measure, one period control, one token set | B-01 (shared module, basis line, states, grace parameter **[B EQ1, EQ2]**); B-02 (date control on the DGA date picker **[C]**); B-04 binding (F-04, F-14) **[B EQ4]**; B-07 labels/band **[B EQ3]**; B-10 tokens, DGA palette, one font family, type scale, spacing, icon component, light-theme lock **[C licence]**; B-08 glossary and microcopy; B-09 remaining accessibility; B-11 logo slot **[C]** | EQ1, EQ2, EQ4 answers (defaults available); Figma values | AC-A1–A3, A6, B1–B3, D2–D4, D6–D7, G2, G3 |
| **2 — Migration by page** | every page on the system, structure preserved | order: Dashboard → Fixed reports → Smart reports → Planning (versions, named scenarios, objectives, register) → Invoices → Collection → Exclusions → Risk / Data sources / Metrics → Contracts / Sanad / Investment → Login rewrite; B-05 workflow with roles **[B EQ4]**; B-06 AI states, indicator, feedback; B-12 navigation grouping, breadcrumbs, footer, error page; coverage definition **[B EQ5]** | Phase 1 | AC-B4–B6, C2–C6, E2, E4, G1, G4, G5 |
| **3 — Conformance and outputs** | prove it | export template **[C]** and parity (F-10 complete); B-13 report parity **[B EQ9]** (enforcement referral first); full-size demo performance and loading states; accessibility audit with a screen reader; final logo and name | assets; EQ9 | AC-F1–F4, G6; all AC pass |
| **4 — Platform** | durable and governed | B-14 server store, identities, roles **[B EQ10]**; commit history and dead-code removal (F-28); optional language model | decisions | audit trail and role tests |

**Sizing guide (relative effort, not a schedule):** Phase 0 ≈ 1 unit · Phase 1 ≈ 3 · Phase 2 ≈ 4 · Phase 3 ≈ 2 · Phase 4 ≈ 3. Phase 0 can start immediately; nothing in it depends on your open questions or on any asset.

## 32. Limits of this update

- Screenshots: only the 8 files of 9 Oct were opened; they show the pre-restructure interface (§26.1).
- Monthly reports: July 2026 was read slide by slide (selected slides at full resolution; footnotes read from renders); January–March were reviewed for layout, footnotes and titles. Arabic text extraction from the PowerPoint files is unreliable, so figures and footnotes were read from slide images; where a footnote was only partly legible I have not relied on it.
- The embedded logo PNG is a candidate, not an official asset, and was not copied into the project.
- Plan record check was read-only; the correction itself is pending your approval.
