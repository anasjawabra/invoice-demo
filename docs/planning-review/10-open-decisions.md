# 10 — Open business decisions (cannot be resolved from existing evidence)

Each item: why the evidence cannot settle it · what each option changes · **recommendation**. None is decided here.

| ID | Decision | Owner (suggested) | Blocks |
|---|---|---|---|
| D-01 | Which annual target is *the* revenue target | Finance / Solution Owner | Phase 0h, V1 |
| D-02 | Scale of the illustrative budget/coverage vs the synthetic world | Product (demo) | demo narrative |
| D-03 | Source and shape of the approved cumulative plan (seasonality) | Finance | Phase 0a, status text |
| D-04 | Tolerance for «وفق الخطة» | Finance | status text |
| D-05 | Forecast method owner and alignment with the forecasting teams | Solution Owner + forecasting teams | Phase 0d |
| D-06 | Whether planning numbers are exported | Product | Phase 4 |
| D-07 | Target version / owner / approval state and where it is stored | Finance | Phase 0g |
| D-08 | Scenarios (baseline / improved collection) | Finance | section 3 |
| D-09 | Data needed for a probability | Data owners | Phase 5 |
| D-10 | What counts as «actionable» and the 180-day line | Collection owners | Phase 2 |
| D-11 | Proration and pace conventions | Finance | metrics |
| D-12 | Keep the map? | Product | Phase 3 |
| D-13 | Data-freshness source and stale threshold | Data owners | stale state |
| D-14 | Allocation of the Ministry target to entities (HQ share) and to restricted viewers | Finance | Phase 0b |

## Details
**D-01 Target basis.** Evidence: four targets coexist (02 §9): coverage × budget 21.59 bn (default) / 22.89 bn (70 %), revenue appropriation 11.50 bn (dashboard attainment, Smart Reports, assistant, `DEFAULT_TARGETS`), and the viewer-dependent variant. The history shows the basis changed twice (appropriation → coverage × budget on 21 Oct, `docs/iim-oct21-plan.md`), and the monthly-reports register says a target seen in a report is «shown in source report», never «approved» (`docs/monthly-reports-definitions-register.md` §3, EQ6). **Recommendation:** one target per (year, scope), status `illustrative` until a document and an approver exist (EQ6); the planning page's coverage × budget is the single «المستهدف السنوي للإيراد»; the appropriation measure keeps its own name «نسبة تحقيق الاعتماد مقابل الإيراد» with its basis shown, or reads the same store.

**D-02 Scale.** The target (22.89 bn) is 2.48× the whole of 2025's receipts and 1.8× the net billed YTD; the Ministry sits at ≈ 50 % of an even plan all year (−51.6 % in Feb, −49.8 % in Nov at 66 %), so every demo of «behind plan» looks like failure and a probability is meaningless. Budget figures are invented (`appropriations.js:1`) and real ministry figures must not appear in the demo. **Recommendation:** keep the arithmetic, but recalibrate the **illustrative** budget table so that the default target is within the order of the synthetic receipts (so that on-plan, ahead and behind states are all demonstrable), or explicitly script the demo around «the target is far above observed behaviour». Decide before the demo, not in code.

**D-03 Approved plan / seasonality.** No monthly plan file exists in the repository; the three plan shapes in the code are inconsistent (even, curved `[.05 … .10]`, saved weights). `strategic-dashboard-simplification.md` §open questions already asks «even spread or seasonality, and who approves». **Recommendation:** until Finance supplies an approved monthly (by entity) plan, use the labelled assumption «توزيع متساوٍ» everywhere; design the profile object (`planProfile.kind`) so an approved or prior-year-seasonal profile drops in; do not infer seasonality from the 22 months (05).

**D-04 Tolerance.** No source for a threshold exists; the Decision Room's 10 %/25 % are demo values. **Recommendation:** default = display resolution (0.5 % of planned) with the basis documented; ask Finance for the business tolerance (and whether it differs by entity size) and store it with owner and approval date; align the Decision Room.

**D-05 Forecast method and alignment.** The platform has two forecasts (run-rate, OLS) and neither is aligned with the forecasting work of Dr. Muath / Abdulmajeed / the ByteDance team: no method, input or assumption material exists in the repository (`docs/sh-review/00-materials-and-dependencies.md` §3 lists the requests; completion unverified). **Recommendation:** ship **one** explainable baseline (3 complete months) with method id and window on every surface, state «غير مُواءَم مع منهجية فرق التنبؤ — قيد التنسيق», and ask the teams for: model description, inputs, assumptions/drivers, scenario definitions, versioned outputs for the same scope and cut-off, and their validation results.

**D-06 Exports.** No export carries planning numbers today; Smart Reports carry a different forecast. **Recommendation:** no planning export in this round; Smart Reports/assistant read the corrected single forecast and target; add a planning block to the report model only if senior stakeholders ask for a printable position page (then with parity rows).

**D-07 Version/owner/approval.** The store has `savedAt/savedBy`; there is no owner, version or status, and targets live on one device. **Recommendation:** add `versionId`, `status` (illustrative/approved), `owner` now (display and tests), keep device storage for the demo, no approval workflow (explicitly excluded in `docs/planning-cfo-review-plan.md` §6); the production design needs a shared store.

**D-08 Scenarios.** Removed on purpose; `applyScenario` is dead code. The request asks to distinguish baseline / improved collection / other **if they exist**. **Recommendation:** baseline only; if scenarios are wanted later they are user-entered what-ifs labelled «افتراض», shown beside — never inside — the baseline, with no benefit credited without evidence.

**D-09 Data for a probability.** See 05 §6: ≥ 36 months of Tahseel payments with payment **and load** dates, approved targets/plans by version for ≥ 3 years, due dates and status history, Finance-confirmed one-offs, scope/process change log, entity/source mapping history. **Recommendation:** request these through the data-owner channel already tracked for Tahseel; until then the unsupported message stays.

**D-10 Actionable amount.** The 180-day line comes from the existing ageing tiers; whether long-outstanding balances are a collection push or a legal/accounting decision is a business rule, as is whether enforcement-linked balances belong to class A. **Recommendation:** adopt the tiers as stated (A blocked · B ≤ 180 d · C due this year · D > 180 d separate), confirm with the collection owners, keep the list rule-based, expected impact «غير متاح».

**D-11 Conventions.** Calendar-day proration of the current month and a 3-complete-month recent pace are conventions, not evidence. **Recommendation:** keep them, print them, and let Finance replace them (business days; seasonal baseline) through the profile object.

**D-12 Map.** Mapping is correct and reconciled; its value is context. **Recommendation:** keep as an optional collapsed secondary view with the plan-position measure; revisit when the dashboard map is moved to the single basis (then one map component is enough).

**D-13 Freshness.** The demo has no load date; production needs the Tahseel posting date. **Recommendation:** define `latestDataDate` from the source posting date and `staleDays` (suggest 3) as a data-owner parameter; the demo keeps today.

**D-14 Allocation.** With override off, 66 % of the **whole** budget including headquarters' chapters (4.86 bn, no revenue) is spread over the Amanahs by revenue-appropriation share (`planTargets.js:94-96`; `docs/iim-oct21-plan.md` open item). That is a modelling choice made to hit the 21 Oct scenario (70 % → 22.9 bn) — not evidence. For restricted viewers the allocation must not depend on visibility (D6). **Recommendation:** keep the allocation for now, compute it on the full set, label it «موزَّع بنسبة اعتمادات الإيراد» in the targets section, and ask Finance to confirm or replace it with entity-specific targets.
