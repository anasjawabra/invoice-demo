# 12 — Revenue plans: analysis and recommended design («خطط الإيرادات»)

**Update (7 Nov 2026):** partly superseded by `docs/revenue-plans-spec.md` §10 (simplified workflow: no draft / active / archived states, no activation, no versions UI, no duplicate-baseline rule, no editable owner or status) — what was built is recorded in `14-revenue-plans-implementation-status.md`.
**Status:** analysis only. Nothing in the code was changed, deleted or redesigned for this document.
**Evidence base:** the running app (`/planning`, seeded demo account, 2026-11-06 cut-off), `src/data/planTargets.js`, `planningBasis.js`, `planForecast.js`, `planInputs.js`, `appropriations.js`, `viewerTargets.js`, `src/components/strategic/*`, `src/pages/PlanningArea.jsx`, the dictionary planning entries, and docs 01–11 of this folder.
**Convention:** **[C]** = confirmed in code/app today · **[P]** = proposed change. Amounts are synthetic. The live numbers quoted below come from this browser's saved target store (coverage 80 %); a fresh store gives 66 % → 21.59 bn.

---

## 1. CFO assessment

A finance leader opening this page needs to answer four questions in under a minute: *what is the target and is it approved? how far along are we against it? where will we end? where do I act?* The page answers all four, but three things reduce trust and clarity:

1. **The target cannot be audited.** [C] It lives in the browser's `localStorage` (`ib_plan_targets_v1`) — per device, not shared between users. Versions are a counter (`2026-v3`) with no retained history; every committed field edit — and even flipping the status — bumps the version. "Approved" is a dropdown anyone with `planning.update` can switch. «مالك المستهدف» is free text (this browser holds the literal value `issa`), and the last editor is a display-name string in the session language (`طارق`), not a user id.
2. **Six percentages compete for attention.** [C] Today the page shows 80.0 % coverage, 68.0 % collection rate, 35.2 % annual achievement, −58.6 % deviation, 41.6 % expected achievement, plus per-entity percentages. Only three of them answer the user's questions (achieved, on-plan, expected). Coverage and collection rate are *how the target was derived*, not performance.
3. **"Plan" does not exist as an object.** [C] The page is a fiscal-year view. There is no list, no plan identity, no scope other than the year, and only 2026 has a budget (`appropriationOf` returns `null` for any other year; data starts 2025-01-01 → 2025 shows "no budget").

What the CFO should *decide* from the redesigned screen: approve or revise the target; accept or challenge the allocation; direct effort to the entities/lines that drive the gap. What the CFO should *not* have to do: interpret derivation percentages, or wonder whether the figure is the same one other users see.

Demo-scale caveat (not a defect, already D-02): the synthetic target is ~2.5× all of 2025's receipts, so every reading is deep red. A demo narrative needs a target the data can plausibly approach.

---

## 2. Business model

| Concept | Definition (proposed) | Stored or computed |
|---|---|---|
| **Revenue plan** — «خطة إيرادات» | The container for one fiscal period and one entity scope, holding **one** collection target and its supporting breakdowns. Identified by a stable `planId`. | stored |
| **Target** — «المستهدف» | One amount: **collected revenue (cash by payment date, any invoice)** for the plan period, SAR. | stored (in a version) |
| **Entity allocation** | The split of the target across entities (Amanahs / sectors). A *breakdown* of the target; must sum to it. | stored (amounts) |
| **Periodic distribution** | The shape of the target across months (12 weights summing to 100 %). Gives "planned to date". | stored (weights) |
| **Plan version** | An immutable snapshot of {target, allocations, distribution, assumptions, status, creator, time}. One version is *in force*. | stored |
| **Actual performance** | Qualifying collections inside the period up to the cut-off. | computed |
| **Forecast** | Actual to cut-off + estimated collections for the rest of the period. **Never stored**, never an input to the target. | computed |

**Explicit non-rules:** an allocation is not a plan; a forecast is not a plan; a historical version is not a plan; an alternative scenario is not a plan (scenarios were removed on purpose, D-08).

**One target type or several? Recommendation: one.** The requirement and the implementation both measure one thing: collected revenue against a target (`planningBasis` compares one `target.value` with receipts). The other numbers on the page are **assumptions that derive or sanity-check that target**:
- *Coverage target* (`target = coverage × communicated budget, chapters 1–3`) → a **derivation method** for the target amount, not a second target.
- *Collection-rate target* and *required billing* (`= target ÷ rate`) → **billing requirement assumptions**. [C] They do not enter achievement, deviation, forecast or pace; they feed exactly one place — a billing-sufficiency factor in `planningFactors.js:33`.
- *Billing target* (optional, typed) → a check against required billing (`billingCheck`).

So: the plan holds one collection target; coverage/collection/billing become optional supporting assumptions (§6).

---

## 3. Current-state findings (evidence)

| # | Finding | Evidence |
|---|---|---|
| F1 | No plan entity, list or id; plan = fiscal year. Period is hard-coded Jan–Dec (`${year}-01-01`, 12 months, `monthsLeft`, `remainingDays`). Only 2026 has a budget. | `PlanningArea.jsx`, `planningBasis.js`, `appropriations.js:30` |
| F2 | Target store is device-local. `meta[year]` = {version, versionId, status, owner, savedAt, savedBy}; meta is per **year**, not per scope. | `planTargets.js:15-47` |
| F3 | Owner is free text; last editor is a language-dependent name string. Ownership can be changed by anyone who can edit. No user id stored (ids exist: `usr-demo`, …). | `TargetsPanel.jsx` `OwnerInput`; `actor.js` |
| F4 | A version bump occurs on every commit, including a status flip; no previous version is kept. | `planTargets.js bump()`; `setTargetMeta` |
| F5 | Status "approved" is a plain select; the UI itself says there is no approval workflow. | `TargetsPanel.jsx` `#tg-status` |
| F6 | With the per-entity override **off**, the Ministry target (80 % × the *whole* budget, headquarters' 4.86 bn included) is spread over entities by revenue-appropriation share, so each entity shows its own coverage % (≠ the overall 80 %). | `planTargets.js entityTargets()`; D-14 |
| F7 | With the override **on**, typed per-entity coverage wins and the Ministry total becomes Σ entities — the overall coverage input stays displayed but no longer equals the Ministry coverage. No "unallocated"/difference indicator exists. | `entityTargets()`, `totalTargets()` |
| F8 | Allocation is edited as **coverage %** and **collection-rate %** per entity — not as amounts or shares of the target. | `TargetsPanel.jsx` table |
| F9 | Monthly weights are edited **per entity only** (Ministry months are Σ entities, read-only). Saving rescales *all* twelve weights to 100 % (`normalizeWeights`) — editing one month silently changes the others; disclosed only in small print. | `planTargets.js normalizeWeights`, `TargetsPanel.jsx` |
| F10 | Target amount **26.16 bn appears 5 times** on one screen; version id 2×; the word «توضيحي» (illustrative) 5×; **42 form controls** in the management section (page section ≈ 915 px collapsed). | live DOM count |
| F11 | The three requested percentages exist but are named/split differently: achievement-to-date is «نسبة تحقق المستهدف السنوي» (35.2 %, "annual" in the label); **actual ÷ planned-to-date is not shown** — only its complement as deviation % (−58.6 % ⇒ 41.4 %); expected achievement is «نسبة التحقق المتوقعة» (41.6 %). | `PlanPosition.jsx`, `PlanOutlook.jsx` |
| F12 | A full "Probability of reaching the target" block renders only to say the estimate is unavailable. | `PlanOutlook.jsx #plan-probability` |
| F13 | Period is not selectable; "future year" and "year ended" states exist; zero target, missing data, stale data, above-target are handled (no cap at 100 %). | `planningBasis.js` |
| F14 | Consumers of the stored target: the planning page, Decision Room (`useDecisions`), `revenueMetrics.liveTargets`, `viewerTargets` (Smart Reports, assistant). "One target everywhere" therefore holds only on one device. | grep of `loadTargetStore` |
| F15 | Restricted viewers: targets are computed on the full entity set and only rows are filtered; they see «إجمالي الجهات المتاحة لك». | `planInputs.js`, `viewerTargets.js` |

---

## 4. Keep / merge / simplify / move / remove

Everything below is **presentation or input redundancy**; no calculation changes unless stated.

| Element (what appears now) | Verdict | Why | Where it remains | Affects calculation? |
|---|---|---|---|---|
| Four target tiles (annual target, coverage %, collection %, required billing) | **Merge** target into the plan summary; **move** the other three | Only the target is a plan figure; the rest are derivation/billing assumptions | Summary band (target); «افتراضات متقدمة» (coverage, collection, billing) | No |
| Annual target repeated in position sub-line, forecast sub-line, cumulative chart, context | **Simplify** | Same amount ×5 | Once in the summary; other places name it ("المستهدف") and carry the value in an info-tip | No |
| Version / status / owner as three always-visible controls | **Simplify** | Metadata, not daily inputs; owner must become read-only (§4a) | Summary band: read-only chips; «اعتماد» as an action; version history in the editor | Status feeds "illustrative" notices only |
| Context chip repeating version + status | **Remove** (keep cut-off, plan assumption, scope, stale/year-end notices) | Duplicates the summary | Summary band | No |
| Overall coverage / collection / billing inputs, always visible | **Move** to advanced | Target amount should be the primary input; coverage becomes an optional helper "derive target from coverage × budget" | Advanced panel | No — `target = coverage × budget` stays the derivation |
| Per-entity override checkbox + 4-column editable table | **Merge** into one allocation editor (amounts/shares, inherited vs manual, balance) | F6–F8 | Allocation tab (§6) | Yes, by design: allocation model changes (see §6) — flagged |
| 12 monthly weight inputs for one entity, silent rescale | **Replace** with a distribution editor with explicit total check | F9 | Distribution tab | Yes: rescale removed, validation added — flagged |
| Position tiles: actual, planned, deviation (amount + %), achievement | **Simplify** to: actual, planned, **on-plan ratio** + deviation amount, achievement | Two near-complementary percentages (−58.6 % / 41.4 %) confuse; show the requested ratio, keep amount | Position block | No |
| Forecast tiles (forecast, expected %, gap, pace multiple) | **Keep**; move *expected %* and *expected shortfall/surplus* also into the summary | Requirement 5 | Summary + outlook | No |
| «احتمالية تحقيق المستهدف» block | **Remove** the block; keep one line "no probability is estimated" with the dictionary link | Not supported by data (D-09); a whole block for a negative adds noise | One-line footnote | No |
| «افتراضات هذا التوقع» collapsible | **Keep** (explicit earlier decision) | Shows this run's inputs | Outlook | No |
| Cumulative chart, deviation bars, ranked action table, factors | **Keep** | Each answers a distinct question (§8) | Unchanged | No |
| Map, method panel | Already removed | — | Dictionary | — |

**Billing assumptions: primary workflow or advanced?** Advanced. Evidence (§2 and F14): they do not drive the achieved/on-plan/expected metrics; one factor uses required billing. A target is meaningful without them; show them as optional supporting assumptions with an "inputs used by: billing-sufficiency factor" note.

### 4a. Ownership rule (confirmed by the user)

- **[P]** On creation, store `createdBy = { userId, nameSnapshot }` from the authenticated session; show the **current** name resolved from `userId` (fallback to the snapshot). Never a picker.
- **[P]** Owner is immutable. Viewing or editing by another authorised user changes only `lastEditedBy { userId, nameSnapshot }` and `updatedAt`.
- **[P]** Every version records `createdBy`; the plan's owner = creator of the plan (version 1).
- **Existing records:** [C] the saved store has no creator, only a free-text owner and a last-editor name. Do **not** backfill: the free text is not an authenticated identity and `savedBy` is the last editor, not the creator. Migrated plans show **«غير محدد (سجل سابق)»**; the old text is kept as read-only "legacy note: issa". No one — including an admin — assigns an owner by hand (consistent with "no manual owner picker"); a new plan created after migration gets a true owner. *(Open question Q6.)*

---

## 5. Revenue-plan list

**Recommendation: list-and-detail inside the planning module, without a new top-level page.** `/planning` = the list; `/planning/:planId` = the selected plan. Reasons: the detail is long (nine sections), so stacking a list above it would push target management and performance down and duplicate the summary; a separate list route keeps the list compact and the detail focused. The sidebar item and the permission (`planning`) are unchanged; existing deep links `/planning#plan-targets` redirect to the current plan.

| Option | Pros | Cons |
|---|---|---|
| A. Keep one page, year switcher only (today) | Zero change | No plan identity; cannot compare plans; target management grows |
| B. List stacked above detail on `/planning` | One page | Doubles length; summary duplicated; edit controls pushed down |
| **C. List route + detail route (recommended)** | Compact list, focused detail, shareable links | One extra click for the common case — mitigated by highlighting the current-year plan and opening it from the row |

**Columns (8):** الخطة (name; period beneath) · النطاق · المالك · المستهدف · المحصّل حتى تاريخه · نسبة تحقيق المستهدف حتى تاريخه · نسبة تحقيق المستهدف المتوقعة بنهاية الفترة · الحالة.
Secondary information (version id, last editor/time, coverage %, allocation count, collection rate, billing) goes to the detail. "الحالة" is shown only with the **implemented** definition: the status of the version in force (*توضيحي* / *معتمد*) — no invented "on track/at risk" status. On mobile each row is a card with name+period, target, achievement, expected.

**Actions:** open (row), create plan (needs `planning.update`), duplicate as a draft for another period (copies target/allocation/distribution as an *unapproved proposal*, labelled as copied), archive. **Filters:** fiscal year / period, entity, owner, status; default = current year.

**Identity and uniqueness [P]:**
- `planId` is an opaque stable id; the display name is generated ("خطة إيرادات التحصيل 2026") and editable.
- Natural key for rules: `(period start–end, entity scope, kind='collection')`.
- **At most one active plan per overlapping period × overlapping entity scope.** Creating or activating a conflicting plan is blocked with a message naming the existing plan. A revision is a **new version**, never a new plan.
- Alternative scenarios are not supported (D-08). If later wanted, they are labelled versions of one plan, not plans.
- The plan **in force** (active, version in force) supplies the performance analysis for its period and scope. Opening an archived plan or an older version shows a read-only historical analysis with a banner.
- **No double counting:** a payment belongs to the plan whose period contains its payment date; entity allocations form a partition of the target; an entity may be in several plans only with disjoint periods.
- Restricted viewers: the list shows plans whose scope includes their entities, with figures labelled «إجمالي الجهات المتاحة لك» (existing rule, F15).

**Expected size today:** with current evidence the list has one real row (2026); 2025 has no budget/target. State this honestly in the UI (a "no plan" row for years with data but no plan is useful; fabricating one is not).

---

## 6. Targets for a year or a specific period; allocations and distribution

### Target for a period

- The target is **collected revenue** (payment-date basis, any invoice), SAR; display unit follows the platform unit (billions/millions) with the full amount in a tooltip. Cut-off = today for the running period, the period end for a closed one, never beyond the latest data date [C].
- **Full fiscal year:** [C] works today, assumed Jan–Dec (no Finance source for the fiscal calendar — Q3).
- **Specific start/end:** not supported today [C]. **[P]** Plans carry `periodStart/periodEnd`, with the fiscal year as the default preset. A shorter period is **entered directly as its own plan**, never derived silently from an annual target. A quarter *inside* an annual plan is a **view** of the distribution ("المخطط للربع الثالث = مجموع أشهره"), labelled "derived from the monthly distribution". Partial months use the existing, documented calendar-day proration.
- Recommended scope for the next build: fiscal-year plans only, with the period fields displayed read-only; arbitrary periods only if Q2 says they are needed.

### One editing model (top-down, hybrid)

| Value | Entered or calculated |
|---|---|
| Plan target **T** (amount) | **Entered** (primary). Optional helper "derive from coverage × budget" fills it and records the basis |
| Entity allocation | **Stored as amounts**; share-of-T shown (derived). Entering a share converts to an amount |
| Allocation rows | *Inherited* (default: share of revenue appropriation — the current rule) or *manual* (fixed amount) |
| Remainder | **R = T − Σ manual**, spread over inherited rows by appropriation share and **shown with its basis**. R < 0 → error; no inherited row left and R ≠ 0 → **"غير موزَّع"** shown in red |
| Monthly distribution | **12 weights, entered** (even / saved profile presets); amounts calculated; **total must equal 100 %** — an error, not a silent rescale |
| Entity monthly | Inherits the plan profile; optional per-entity override; Ministry months = Σ entity months, so entity and plan reconcile by construction |

Reconciliation rules: Σ allocations = T; Σ monthly = period target; Σ entity monthly = plan monthly. All three are displayed as a check row ("المجموع = المستهدف ✓" / "الفرق …").

When things change: changing **T** keeps manual rows and recomputes inherited ones, with a preview ("الجهات اليدوية لم تتغير؛ المتبقي الجديد …"). Changing the **period** drops months outside it only after confirmation. Nothing is overwritten without a before/after preview and a saved version.

**Calculation impact (flagged):** this replaces the bottom-up override (Ministry = Σ entity coverage) with a top-down hybrid. The Ministry target, planned-to-date and deviation formulas are unchanged; only how allocations are produced/validated changes. Existing saved overrides are migrated as manual amounts (their current computed values), so no number changes silently. *(Open question Q5 — top-down vs bottom-up.)*

---

## 7. Metric table

All amounts are taken from the single planning basis. Percentages aggregate **from amounts**, never by averaging entity percentages. None is capped at 100 %.

| Arabic label | Meaning | Formula | Period basis | Edge cases |
|---|---|---|---|---|
| المستهدف | Collection target of the plan in force | stored amount | whole plan period | zero/absent → no ratios; "لا مستهدف" state |
| المحصّل الفعلي حتى تاريخه | Qualifying collections in the period | Σ receipts by payment date, period start → cut-off | to cut-off | no data → "—"; stale data flagged |
| **نسبة تحقيق المستهدف حتى تاريخه** | Progress against the full-period target (not ahead/behind) | actual ÷ **full-period target** × 100 | actual to cut-off, target full period | zero target → N/A; > 100 % shown; future period → N/A; closed period → final outcome |
| المخطط حتى تاريخه | Plan accumulated to the cut-off | Σ closed months + current month × days elapsed ÷ days in month | to cut-off | even-split assumption labelled until an approved profile exists |
| **نسبة الإنجاز مقابل المخطط حتى تاريخه** | Progress against the elapsed plan | actual ÷ **planned to date** × 100 | same cut-off for both | planned = 0 (period not started) → N/A; current page shows only the deviation % (F11) |
| الانحراف (مبلغ) | Ahead/behind in money | actual − planned to date | cut-off | status text only beyond tolerance (default ±0.5 %, not approved) |
| **نسبة تحقيق المستهدف المتوقعة بنهاية الفترة** | Expected end-of-period achievement — **not a probability** | forecast total ÷ target × 100, where forecast total = actual to cut-off + forecast for the rest | whole period | no baseline (<3 complete months) → "غير متاح" with reason; closed period → replaced by the outcome; zero target → N/A |
| المتوقع تحصيله / الفائض أو العجز المتوقع | Expected amount and gap | forecast total; target − forecast total (surplus when negative) | whole period | same as above |
| أساس التوقع وتاريخ البيانات | Forecast basis | `runrate3_v2`, last 3 complete months, cut-off date | — | shown with the figure; alignment note retained |
| الوتيرة المطلوبة | Pace to close the gap | remaining target ÷ remaining months (by days) | remainder | none after the period ends or the target is reached |

Naming change: «نسبة تحقق المستهدف السنوي» → period-generic **«نسبة تحقيق المستهدف حتى تاريخه»**; «نسبة التحقق المتوقعة» → **«نسبة تحقيق المستهدف المتوقعة بنهاية الفترة»**. The word "احتمالية" is not used for any ratio.

---

## 8. Recommended presentation

### Plan detail — section order and wireframe

Journey: list → plan summary → manage target → actual vs expected → gaps and actions. The editor is **collapsed to one row but at the top**, because reading performance is the frequent task and editing the occasional one; it opens in place in one click (and via `#plan-targets`).

```
[← خطط الإيرادات]   خطة إيرادات التحصيل 2026            [توضيحي · v3]  [اعتماد]  [تعديل المستهدف]
المالك: <creator, read-only> · آخر تعديل: <editor, date> · النطاق: الوزارة (18 جهة) · الفترة: 1 يناير – 31 ديسمبر 2026 · التاريخ المرجعي: 6 نوفمبر

┌ ملخص الخطة ────────────────────────────────────────────────────────────────────────┐
│ المستهدف 26.16 | المحصّل 9.21 | نسبة تحقيق المستهدف حتى تاريخه 35.2% |              │
│ المتوقع بنهاية الفترة 10.89 (41.6%) | العجز المتوقع 15.28                           │
└──────────────────────────────────────────────────────────────────────────────────┘
┌ إدارة المستهدف (مطوية: «26.16 · 18 جهة · توزيع متساوٍ» [تعديل]) ───────────────────┐
│ تبويبات: المستهدف | التخصيص | التوزيع الشهري | افتراضات متقدمة | سجل الإصدارات      │
└──────────────────────────────────────────────────────────────────────────────────┘
[سياق: مصدر الخطة الشهرية · تنبيهات البيانات]            (one row, only when relevant)
الأداء مقابل الخطة   المحصّل | المخطط | نسبة الإنجاز مقابل المخطط 41.4% | الانحراف −13.03
الرسم التراكمي: فعلي / مخطط / متوقع
التوقع والوتيرة المطلوبة  (+ «افتراضات هذا التوقع»، سطر عدم تقدير الاحتمالية)
أين نركز: انحراف حسب الجهة ← جدول الإجراءات المرتبة
العوامل المؤثرة في الفجوة
```

### Charts and tables per question

| Question | Best form | Do not add |
|---|---|---|
| Which plan is which? | Compact table (list), no charts | Per-row sparklines |
| What is the target and its status? | Summary band (numbers + chips) | A second target card |
| How is it split? | Allocation table with share bars + reconciliation row | Pie of entities |
| How is it phased? | 12-bar monthly editor with cumulative line | A second cumulative chart |
| Are we on plan? | Existing cumulative actual / planned / forecast line | Gauge duplicating the ratio |
| Where will we end? | Summary figures + existing forecast block | Probability gauge |
| Where is the gap? | Ranked deviation bars → ranked action table (existing) | Map (removed by decision) |
| What changed in the target? | Version history table (who/when/what) | Chart |

Standards: shared components (`MetricTile`, `AsyncBlock`, filters), IBM Plex Sans, Arabic RTL with English, keyboard/focus order, mobile cards, existing icon family only (Hugeicons/DGA kit still unavailable locally). Detailed formulas stay in the dictionary under «تخطيط إيرادات التحصيل».

---

## 9. User journeys

1. **Create a plan.** List → إنشاء خطة → period (fiscal-year preset) and scope → target amount (or derive from coverage × budget) → default allocation (inherited) and even distribution shown with their basis → save as version 1, owner = signed-in user. Conflict with an active plan blocks with the plan named.
2. **Edit a target.** Summary → تعديل المستهدف → change amount → preview ("المحصّل المتوقع لا يتغير؛ المخطط حتى تاريخه يصبح … ; الجهات اليدوية ثابتة") → save → new version; the previous one is kept; owner unchanged, last editor recorded.
3. **Allocate.** Allocation tab → rows show inherited/manual and share; edit one amount → remainder recomputed with its basis → check row must read "المجموع = المستهدف ✓" before saving.
4. **Distribute.** Distribution tab → choose preset or edit weights → total must equal 100 % → monthly amounts and cumulative line update; per-entity override optional.
5. **Review performance.** List → open plan → summary (achieved, expected, shortfall) → on-plan ratio and cumulative chart → expected outlook → deviation by entity → ranked actions; each drill keeps the plan's period and scope.
6. **Approve.** Action on the summary, by an authorised user, marks the version in force as approved and keeps it immutable; later edits create a new unapproved version (Q4).

---

## 10. Implementation plan

| Phase | Scope | Depends on | Acceptance criteria |
|---|---|---|---|
| **P0 Definitions and labels** | Rename the three percentages; add «نسبة الإنجاز مقابل المخطط»; remove the probability block (one-line note); update the dictionary and tests | none | Labels match §7; no formula output changes (existing planning tests unchanged); dictionary entries updated |
| **P1 Plan model and persistence** | `plan` + `planVersion` records in the data service; `planId`; owner/lastEditor by user id; audit; one-time import of the device store as an **ownerless** version; API keeps `planTarget()`/`viewerTargets()` outputs | identity ids (exist), access gate `planning.update` | Two users on two devices see the same target; owner immutable; ownerless import never gets an owner; all consumers (page, Decision Room, Smart Reports, assistant) read identical numbers |
| **P2 List + routes** | `/planning` list, `/planning/:planId`, filters, overlap rule, redirects for old links | P1 | 8 columns; filters work; overlap blocked with named plan; restricted viewers labelled; mobile cards |
| **P3 Summary + focused editor** | Summary band; collapsed editor with tabs; amount-first target; coverage/collection/billing in advanced; version history; approve action | P1, P2 | Target amount appears once as a value; version/status/owner read-only; ≤ 1 click to edit; status change does **not** bump content version |
| **P4 Allocation and distribution model** | Inherited/manual rows, remainder with basis, reconciliation checks, explicit 100 % validation, change preview, migration of saved overrides as manual amounts | P1, P3 | Σ allocations = T; Σ months = period target; Σ entity months = plan months; no silent overwrite/rescale; migrated numbers identical to before |
| **P5 Period flexibility** *(only if Q2)* | Start/end dates, partial-month proration, derived sub-period views | P1–P4 | Shorter-period plan entered directly; no silent proration of an annual target |

**Invariants for every phase:** the approved financial identities (net, uncollected, collection rate, target achievement = collected ÷ target) are untouched; composite invoice identity unchanged; synthetic data only; no passwords/hashes in any payload; platform terminology test stays green; `npm test`, `verify:exports`, `verify:identity` and the build stay green.

---

## 11. Unresolved business questions (not answerable from existing evidence)

| ID | Question | Why evidence cannot settle it | Impact |
|---|---|---|---|
| Q1 | Exactly one Ministry plan per fiscal year, or also plans for a sector/program/subset of entities? | No requirement text distinguishes them; code is Ministry-or-entity *view* only | Overlap rule, list scope column |
| Q2 | Are plans for a period shorter than a year needed in 2026–27? | The page only supports the fiscal year | Whether P5 is built |
| Q3 | Is the fiscal year the calendar year? | Hard-coded in code; no Finance source in the repository | Period defaults |
| Q4 | Who approves, and does approval freeze a version? | The demo states it has no approval workflow | Status model, edit rules |
| Q5 | Top-down (target fixed, allocations distribute) or bottom-up (target = Σ entity inputs)? | Current code supports both through the override | Allocation model in P4 |
| Q6 | May an administrator assign ownership of legacy ownerless plans? | The confirmed rule says owner = creator and no picker | Legacy handling |
| Q7 | Is the target entered as an amount or always derived from budget × coverage in Finance's practice? | Only the demo's IIM-14/28 notes | Whether coverage stays a helper or becomes primary |
| Q8 | Approved monthly profile, tolerance and forecast alignment | Already open as D-03 / D-04 / D-05 | "Planned to date" quality; status text |

Server persistence for the demo (P1) is a product decision rather than a business question: today the target lives on one device, so shared ownership and audit are impossible without it.

---

## Recommended design (one sentence and why)

**A list of revenue plans at `/planning` and a plan detail at `/planning/:planId`, where each plan holds one collected-revenue target with versioned, reconciling allocations and a monthly distribution; the detail opens with a single summary of target, achieved, and expected end-of-period achievement, keeps target management one click away at the top, and shows coverage, collection rate and required billing only as optional advanced assumptions.**
Why: it matches what the platform actually measures (one collection target), gives plans an identity and a safe ownership/versioning model, removes the repeated target and percentage clutter without removing any capability, makes allocations and months reconcile by construction, and keeps forecast and probability honest.

*Confirmed behaviour is described in §3 and the [C] marks; everything marked [P] is a proposal awaiting review. Nothing has been implemented.*
