# Strategic Dashboard — reassessment and simplification (Round 18)

Synthetic-data demonstration; not production-ready. The page «التخطيط المالي والاستراتيجي» (`/planning`) is replaced by one very simple, working dashboard. Terminology «المقبوضات» is retired. Everything else (invoice details, review workflows, enforcement links, reports, assistant) is preserved.

## 1. What the dashboard answers
1. **What is our collection goal?** — an annual collection-rate goal with its equivalent target amount.
2. **How are we progressing month by month?** — one chart: cumulative collected revenue, plan against actual.
3. **How much remains?** — remaining amount to the target.
4. **What pace is needed?** — the average monthly collection needed in the remaining months.

It contains only: year and optional Amanah selection · the goal rate · four figures (target collection amount, collected revenue to the reporting date, current collection rate, remaining amount) · one chart · a short explanation. No tabs, scenarios, forecasts, assistant, action register, exports or configuration screens.

## 2. The calculations (`src/data/collectionGoal.js`, pure and tested)
* **Adjusted Total Invoices** = Gross Billed Amount − Approved Exclusions
* **Collection Rate** = Collected Revenue ÷ Adjusted Total Invoices
* **Target Collection Amount** = Target Collection Rate × Adjusted Total Invoices
* **Remaining Amount to Target** = max(Target − Collected Revenue, 0)

One scope for every figure and the chart: invoices **issued from 1 January of the selected year to the reporting date**, one Amanah selection (or all, including invoices Makeen assigns to none — otherwise Amanah figures could not add up to the national figure). **Collected revenue** is Tahseel payments by payment date up to the reporting date, per invoice up to the invoice's billed amount (an overpayment is not collected revenue), and never on excluded invoices — the same measure as the invoice's «المبلغ المحصل», so tile and chart agree exactly (a test asserts it for the national figure and every Amanah). **Approved exclusions** means the approval flags already in the data: the dashboard runs the data service with only approved rules enabled (today DUP-1 and CR-1; DEC-1, NOC-1, INC-1, EXE-1… are unapproved) and a human-approved decision on the invoice; cancelled invoices are removed with the exclusions (existing treatment, unchanged).

**Reporting date**: today for the current year; 31 December for a past year; a future year has none. Actual progress is shown only up to it; later months have **no value** (they are not drawn as zero).

**Planning assumptions, stated on the page**: no approved monthly plan exists, so the annual target is spread **evenly** over 12 months (cumulative = target × month ÷ 12). The current, partly elapsed month is **prorated by days** both for «planned to date» and for the pace: months left = days left in the current month ÷ its length + whole months after it; required monthly pace = remaining ÷ months left (shown against the plan's pace for the remaining months).

**Annual versus year-to-date** are labelled apart: the target is annual; collected revenue, the collection rate and the plan-to-date are to the reporting date.

**Saved plan.** The even plan is a draft until someone presses «حفظ الخطة»; a saved plan's months are fixed (stored locally, written only on that action). When billed amounts, exclusions or the rate later change the calculated target, the dashboard shows both figures and keeps the saved months; «تحديث الخطة» is an explicit action that keeps the closed months and spreads the new target over the current and later months. A closed year's plan is never updated. Nothing is recalculated silently.

**States.** Below target: gap, plan comparison and required pace. Reached or exceeded: remaining 0 and «تحقق الهدف» (the excess is stated); no pace is shown. **No valid denominator** (adjusted total ≤ 0, e.g. Hafr Al-Batin 2025): only the explanation of the empty base — no rate, target, chart or progress text. No suggested actions are shown, because invoice data alone does not show why there is a gap; a single link opens the collection worklist.

## 3. Terminology
«المقبوضات» (and «المقبوض/مقبوضة») no longer appears in any source file (a test fails if it comes back). The aggregate is **«الإيرادات المحصلة»**; the amount on one invoice is **«المبلغ المحصل»**; the payment-date measure that remains in reports carries its basis in the label («الإيرادات المحصلة بتاريخ الدفع»). Menus, dashboards, charts, tables, assistant answers, report text, the metric dictionary and invoice findings were updated.

## 4. What was removed
* The six sections of the page (objectives, revenue/expenditure plans, actual vs plan, forecasts and gaps, scenarios, initiatives and decisions), the plan bar and versions, named scenarios, the action register, the planning assistant panel, the receipts↔collected reconciliation bridge, the funding outlook and the Word/Excel/PowerPoint plan exports (components deleted).
* Dictionary entries for target achievement, revenue coverage (budget), the collection forecast and «received in period» (replaced by three entries: adjusted total, target collection amount, remaining to target).
* Duplicate dashboard items: the «received in period» indicators (executive indicators, smart-report key figures), the «two reporting bases» insight and the receipts-forecast insight.
The underlying collection data is untouched.

## 5. Wider reassessment — unclear or duplicated features (reported, not changed)
1. **Two measures of collected revenue** (on invoices issued in the period vs by payment date) still coexist in the monthly and channel reports; one definition is cleaner.
2. **Three stores for targets/plans**: the shared demo target (`ib_rev_targets`, used by smart reports, the assistant and analysis), the old plan store and action register (still in backups, now unused by any screen) and the new saved plan.
3. **Unused planning modules** remain in the code and tests (`strategicCalc`, `planStore`, `actionRegister`, `namedScenarios`, `revenueOutlook`, `commandModel`…): dead-code candidates.
4. **Assistant and smart reports** still offer forecast and target-coverage answers built on the removed flow's logic and on **synthetic expenditure data** (`syntheticFinance`) — unsupported by the supplied requirements.
5. **Approved-only exclusions** are used here; other pages still apply every enabled rule, so «net billed» elsewhere differs (e.g. 2026: 13.53 bn there, adjusted total 14.36 bn here). Decide one rule for the whole solution.
6. The global Amanah filter omits «غير محدد الأمانة».
7. Several dashboards repeat the same figures (executive indicators, smart-report key figures, decision cards).

## 6. Business questions that change the numbers
1. **Basis of the annual target.** Today the target is a rate of the adjusted total of invoices **billed so far this year**. Should it instead be based on the expected **full-year** billing (a budget or forecast)? This changes the target amount and the remaining amount.
2. **Are cancelled invoices part of «Approved Exclusions»?** They are deducted today (existing treatment).
3. **Approved-only everywhere?** Should the whole solution adopt the approved-only rule (question 5 above)?
4. **Goal granularity.** One rate per year applies to any Amanah view; do Amanahs have their own goals?
5. **Monthly plan.** Is an even spread acceptable until a plan is approved, or is there seasonality; and **who approves** the rate and the plan (EQ4)?

## 7. Verification
`npm test` 140 passed (new: the four approved formulas; below target; reached and exceeded; no valid denominator; future months empty and closed years; even plan and day-based proration; saved plan not recalculated silently and explicit update keeping closed months; collected revenue by month equals the snapshot, approved-only, every Amanah adds up; the retired term is absent). Browser: all Amanah × {2025, 2026} combinations (below target, reached, exceeded, no denominator), rate 40 / 55 / 60 / 70 / invalid, tile equals the chart's last actual, future months empty, mobile 375 px (single column, no overflow), no console errors, no retired term on any page.


## 8. Round 19 — corrections (zero target, consistent figures, one scope, no unsupported outputs)

**Zero / missing target (`computeGoal`).** Three distinct outcomes, never a success: `no_denominator` → «لا توجد قاعدة صالحة لاحتساب نسبة التحصيل» (adjusted total ≤ 0: no rate, target or chart); `no_target` → «لم يتم تحديد مستهدف تحصيل صالح» (valid base but the rate is missing, 0 or outside 1–100: only collected revenue and the current rate are shown); `ok`. «تم تحقيق المستهدف» appears only when the target is positive and collected ≥ target.

**Why 14.36 bn ≠ 13.53 bn (traced, 1 Jan–13 Oct 2026, national).** Gross 14,946.3 M − cancelled 579.7 M (23) − approved-rule exclusions 2.4 M (DUP-1 1.83 M, CR-1 0.58 M) = **14,364.2 M**. The «13.55 bn» elsewhere additionally deducted **811.0 M** under rules the business has NOT approved (NOC-1 649.7 M · 6 invoices, EFA-1 101.5 M · 3, INC-1 59.8 M · 4), which were switched on by default. Fix: every unapproved rule is now **off by default** (`defaultEnabled:false`; the session key `ib_rev_cfg3` replaces `ib_rev_cfg2`, so a session that stored the old defaults does not keep them). Their invoices stay visible as *pending candidates* in the rule registry; switching one on is an explicit, warned what-if. Net billed (Insights) = adjusted total (Strategic Dashboard) = 14.36 bn, verified in the browser and by test.

**Cancelled invoices.** Kept as a *separate deduction* (the documented treatment), shown on its own line («الفواتير الملغاة 579.7 M (23)») with a «تصنيف غير محسوم» flag: the requirements do not confirm cancelled invoices as an «approved exclusion». Nothing is merged into «approved exclusions» any more (`T.cancelled` and `T.exclusionsRules` are passed separately).

**Collected-revenue measures.** Two bases exist and are labelled, never mixed: *invoice-based* (payments on the year's own invoices, by payment date up to the reporting date, capped at the invoice — the dashboard and the collection rate) and *payment-date* (all payments in the period, any invoice — the monthly/channel reports). For 2026 to 13 Oct: 7.94 bn vs 8.53 bn, of which 0.58 bn were paid on prior-year invoices. The dashboard prints both and says which feeds the rate; the report section «أساس القياس» already tabulates them.

**Target basis.** Target = rate × adjusted total of the invoices **billed so far** (to the reporting date) — «مستهدف مبني على الفوترة الحالية»; the reporting date and denominator are printed beside the equivalent amount. The even monthly spread is labelled an assumption; a saved plan is labelled «مسودة … غير معتمدة» — saving is not approval.

**Simplification.** Active target storage is now one place: the draft plans in `ib_collection_goal_v1` (the unused per-session `ib_rev_targets` copy is gone; the 60 % demo rate is read from `DEFAULT_TARGETS`). Removed after dependency checks (git history keeps them): `strategicCalc` (its `fairComparison` moved to `amanahComparison.js`), `strategicModel`, `strategicAssistant`, `commandModel`, `planStore`, `namedScenarios`, `actionRegister`, `syntheticFinance`, the `scenario`/`whatif` analysis tasks and the unused scenario/forecast-version state in `RevenueContext`. Saved browser data is untouched: backup/restore still carries `ib_plans_v1` / `ib_actions_v1` and now also `ib_collection_goal_v1`. «غير محدد الأمانة» is in every Amanah filter (`amanahFilterOptions()`: scope bar, invoices, smart reports, labels) so the Amanah figures add up to the national figure.

**Unsupported outputs removed.** Budget and expenditure execution, operating-spending coverage (reports, Insights tile, fixed report «الميزانية وتنفيذ الإنفاق», smart-report/assistant coverage metrics, `coverageFrom`, the chapters 1–3 demo budget). A request about budget/spending is now declined openly by the report assistant ('expenditure' in `requestGuard`). Forecast sections in reports are headed «توضيحي — مبني على بيانات تجريبية» with a warning callout.


## 9. Round 20 — the dashboard follows the Ministry of Finance performance file (revenue appropriation + chapters 1–3 spending)

Source: the monthly financial-performance workbook (August 2026) for the Ministry and the Amanahs: per entity the **original** and **adjusted appropriation**, the **revenue appropriation «الاعتماد مقابل الإيراد»** (what must be collected during the fiscal year) and the Ministry of Finance **cumulative spending**. Only chapters 1–3 («النفقات») are in scope; chapter 4 is ignored.

**What changed.** The annual target is now the revenue appropriation after adjustment (a business input, not "60 % × billing"): the rate input, the adjusted-total basis and the billing-to-date question are gone. The page shows, for one fiscal year and one entity or the whole Ministry: the appropriation (original beside it), what was collected to the reporting date, the share collected, the remainder, the cumulative-vs-plan chart, and — as a second block — spending on chapters 1–3 (appropriation, cumulative spending, spending rate, remainder) with the last month closed by the Ministry of Finance. A table gives every entity (headquarters, each Amanah, housing sector, «غير محدد الأمانة») and the Ministry total with the same figures as the tiles.

**Collected = payments by payment date.** The appropriation is a fiscal-year cash figure, so collected is the Tahseel payments received in the year on any invoice (cancelled invoices and invoices excluded under approved rules left out) — `receivedInPeriod` (new `byAmanah` split in the data service) and `series`. This is the basis of the reports' monthly/channel tables; it differs from «collected on the period's invoices» (invoice pages) and is labelled so. Both reconcile: Amanah receipts add up to the national total (tested).

**No target without an appropriation.** Missing/zero/other-year appropriation → «لم يتم تحديد مستهدف تحصيل صالح» (collected still shown, nothing "achieved"). The report target (`DEFAULT_TARGETS.collectionAmountAnnual`) is the same figure, so the dashboard and the reports no longer carry two targets.

**Data.** `src/data/appropriations.js` holds ILLUSTRATIVE, invented figures on the structure of the file (loaded for 2026 only; headquarters = spending only). They are labelled «بيانات توضيحية» on screen; the real workbook's numbers are not in the repository. When real data is loaded only that table is replaced.

**Not done on purpose.** No coverage ratio (collection ÷ spending): its definition is a business decision (see below).

**Round 20b — answers from the business.** Coverage = cumulative spending on chapters 1–3 against what was actually collected (payments, not billing), compared over ONE period: collected from 1 January to the end of the last month closed by the Ministry of Finance ÷ cumulative spending. Shown for the Ministry (tile) and for every entity with revenue (table column); the headquarters has none. Collected stays on the payment-date basis. The monthly spread is equal (business direction), a saved plan remains a draft. Still open: whether payments in «غير محدد الأمانة» belong to the Ministry total only (current) and who approves the monthly plan.
